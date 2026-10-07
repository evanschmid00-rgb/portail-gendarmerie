// Rôles Discord de sanction : donnés pendant la sanction, retirés à la fin (ou à la levée anticipée).
// Les rôles utilisables sont ceux configurés par un admin sur le site (réglage « sanctionRoles ») : le navigateur ne peut pas choisir un rôle.
//
// Actions (POST, connecté au site) :
//   "ajouter"  : donne le rôle de la sanction (admin ou haut grade)
//   "retirer"  : retire le rôle d'une sanction levée ou terminée (admin)
//   "balayer"  : retire les rôles de TOUTES les sanctions terminées ou levées (n'importe quel gendarme connecté, sans risque :
//                le serveur ne regarde que les dates enregistrées)
// Appel automatique (GET) : tâche planifiée Vercel, protégée par la variable CRON_SECRET.

import crypto from "node:crypto";

const b64url = (b) => Buffer.from(b).toString("base64url");

function signJwt(payload, privateKey) {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64url(sig)}`;
}

async function googleToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, sa.private_key);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Jeton Google refusé");
  return j.access_token;
}

// Vérifie que la personne qui appelle est bien connectée au site (jeton Firebase signé par Google)
async function verifierJeton(idToken, projectId) {
  const [h, p, s] = String(idToken || "").split(".");
  if (!h || !p || !s) throw new Error("jeton");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  const certs = await (await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com")).json();
  const cert = certs[header.kid];
  const now = Math.floor(Date.now() / 1000);
  const ok = cert && header.alg === "RS256" && crypto.createVerify("RSA-SHA256").update(`${h}.${p}`).verify(cert, Buffer.from(s, "base64url"));
  if (!ok || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || payload.exp < now || !payload.sub) throw new Error("jeton invalide");
  return payload.sub;
}

const fromFs = (f) => {
  if (!f) return null;
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return f.doubleValue;
  if ("booleanValue" in f) return f.booleanValue;
  if ("arrayValue" in f) return (f.arrayValue.values || []).map(fromFs);
  if ("mapValue" in f) { const o = {}; Object.entries(f.mapValue.fields || {}).forEach(([k, v]) => { o[k] = fromFs(v); }); return o; }
  return null;
};
const versObjet = (d) => { const o = {}; Object.entries((d && d.fields) || {}).forEach(([k, v]) => { o[k] = fromFs(v); }); return o; };

export default async function handler(req, res) {
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, FIREBASE_SERVICE_ACCOUNT, CRON_SECRET } = process.env;
  const reponse = (ok, message, alerte = false) => res.status(200).json({ ok, message, alerte });
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !FIREBASE_SERVICE_ACCOUNT) return reponse(false, "Synchronisation Discord pas configurée.");
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ ok: false });

  try {
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const fsHeaders = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };

    const lireDoc = async (chemin) => {
      const r = await fetch(`${base}/${chemin}`, { headers: fsHeaders });
      return r.ok ? versObjet(await r.json()) : null;
    };
    const requete = async (structuredQuery) => {
      const r = await fetch(`${base}:runQuery`, { method: "POST", headers: fsHeaders, body: JSON.stringify({ structuredQuery }) });
      const arr = await r.json();
      return Array.isArray(arr) ? arr.filter((x) => x.document).map((x) => ({ id: x.document.name.split("/").pop(), ...versObjet(x.document) })) : [];
    };
    const personnelParMatricule = async (matricule) => {
      const l = await requete({ from: [{ collectionId: "personnel" }], where: { fieldFilter: { field: { fieldPath: "matricule" }, op: "EQUAL", value: { stringValue: String(matricule) } } }, limit: 1 });
      return l[0] || null;
    };
    const marquer = (id, statut) => fetch(`${base}/sanctions/${encodeURIComponent(id)}?updateMask.fieldPaths=statutDiscord`, { method: "PATCH", headers: fsHeaders, body: JSON.stringify({ fields: { statutDiscord: { stringValue: statut } } }) });

    // Réglages faits sur le site : rôles de sanction (type -> ID du rôle Discord) et seuil « haut grade »
    const reglages = (await lireDoc("settings/general")) || {};
    const rolesSanction = reglages.sanctionRoles && typeof reglages.sanctionRoles === "object" ? reglages.sanctionRoles : {};
    const seuilHaut = reglages.seuilHautRang || 14;

    const bot = { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "X-Audit-Log-Reason": encodeURIComponent("Sanction portail") };
    const urlRole = (discordId, roleId) => `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${discordId}/roles/${roleId}`;
    const donnerRole = (discordId, roleId) => fetch(urlRole(discordId, roleId), { method: "PUT", headers: bot });
    const retirerRole = async (discordId, roleId) => { const r = await fetch(urlRole(discordId, roleId), { method: "DELETE", headers: bot }); return r.ok || r.status === 404; };

    const termine = (s) => s.levee === true || new Date(s.dateFin) <= new Date();

    // Retire le rôle d'une sanction terminée/levée ; renvoie "retire", "attente" (à réessayer) ou "ignore"
    const retirerPourSanction = async (s) => {
      const roleId = rolesSanction[s.type];
      if (!roleId) { await marquer(s.id, "retiré"); return "ignore"; }
      const cible = await personnelParMatricule(s.matricule);
      if (!cible || !cible.discordId) { await marquer(s.id, "retiré"); return "ignore"; }
      // On ne retire pas le rôle si le gendarme a une AUTRE sanction du même type encore en cours
      const memes = await requete({ from: [{ collectionId: "sanctions" }], where: { fieldFilter: { field: { fieldPath: "matricule" }, op: "EQUAL", value: { stringValue: String(s.matricule) } } } });
      if (memes.some((x) => x.id !== s.id && x.type === s.type && !termine(x))) { await marquer(s.id, "retiré"); return "ignore"; }
      const ok = await retirerRole(cible.discordId, roleId);
      if (!ok) return "attente";
      await marquer(s.id, "retiré");
      return "retire";
    };

    const balayer = async () => {
      const actives = await requete({ from: [{ collectionId: "sanctions" }], where: { fieldFilter: { field: { fieldPath: "statutDiscord" }, op: "EQUAL", value: { stringValue: "actif" } } } });
      let retires = 0, attente = 0;
      for (const s of actives) {
        if (!termine(s)) continue;
        const r = await retirerPourSanction(s);
        if (r === "retire") retires++;
        if (r === "attente") attente++;
      }
      if (attente) return reponse(false, `${attente} rôle(s) de sanction n'ont pas pu être retirés : place le rôle du bot AU-DESSUS des rôles de sanction.`, true);
      return reponse(true, `${retires} rôle(s) de sanction retiré(s).`);
    };

    // Appel automatique (tâche planifiée Vercel)
    if (req.method === "GET") {
      if (!CRON_SECRET || String(req.headers.authorization || "") !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false });
      return await balayer();
    }

    const { idToken, sanctionId, action } = req.body || {};
    const uid = await verifierJeton(idToken, sa.project_id);
    const moi = await lireDoc(`personnel/${encodeURIComponent(uid)}`);
    if (!moi) return res.status(403).json({ ok: false, message: "Non autorisé." });

    if (action === "balayer") return await balayer();

    const s0 = await lireDoc(`sanctions/${encodeURIComponent(String(sanctionId || ""))}`);
    if (!s0) return reponse(false, "Sanction introuvable.", true);
    const s = { id: String(sanctionId), ...s0 };

    if (action === "ajouter") {
      if (!(moi.isAdmin === true || moi.gradeRank >= seuilHaut)) return res.status(403).json({ ok: false, message: "Non autorisé." });
      if (termine(s)) return reponse(false, "Cette sanction n'est plus active.");
      const roleId = rolesSanction[s.type];
      if (!roleId) return reponse(false, `Aucun rôle Discord n'est configuré pour « ${s.type} ».`);
      const cible = await personnelParMatricule(s.matricule);
      if (!cible || !cible.discordId) { await marquer(s.id, "erreur"); return reponse(false, "Ce gendarme n'est pas relié à Discord : le rôle de sanction n'a pas été attribué.", true); }
      const r = await donnerRole(cible.discordId, roleId);
      if (!r.ok) {
        await marquer(s.id, "erreur");
        return reponse(false, r.status === 404 ? "Ce gendarme n'est plus sur le serveur Discord." : "Discord refuse d'ajouter le rôle : place le rôle du bot AU-DESSUS des rôles de sanction.", true);
      }
      await marquer(s.id, "actif");
      return reponse(true, "Rôle de sanction attribué.");
    }

    if (action === "retirer") {
      if (moi.isAdmin !== true) return res.status(403).json({ ok: false, message: "Non autorisé." });
      if (!termine(s)) return reponse(false, "Cette sanction est encore en cours.");
      const r = await retirerPourSanction(s);
      if (r === "attente") return reponse(false, "Discord refuse de retirer le rôle : place le rôle du bot AU-DESSUS des rôles de sanction.", true);
      return reponse(true, "Rôle de sanction retiré.");
    }

    return reponse(false, "Action inconnue.");
  } catch (e) {
    console.error(e);
    return reponse(false, "Erreur pendant la synchronisation Discord.", true);
  }
}
