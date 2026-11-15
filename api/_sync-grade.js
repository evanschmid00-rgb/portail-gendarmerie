// Synchronise le grade d'un gendarme (site) vers son rôle Discord [TAG].
// Le grade est lu dans la base par le serveur : le navigateur ne peut pas choisir un rôle arbitraire.

import crypto from "node:crypto";

// Valeurs par défaut, remplacées par les réglages faits dans « Grades & unités » sur le site
const GRADES_DEFAUT = [
  "Gendarme Adjoint Volontaire 2ème Classe", "Gendarme Adjoint Volontaire 1ère Classe", "Brigadier", "Brigadier-chef",
  "Maréchal des Logis", "Gendarme Sous Contrat", "Gendarme de Carrière", "Maréchal des Logis-Chef", "Adjudant",
  "Adjudant-Chef", "Major", "Sous-Lieutenant", "Lieutenant", "Capitaine", "Commandant", "Lieutenant-Colonel", "Colonel",
  "Général de Brigade", "Général de Division", "Général de Corps d'Armée", "Général d'Armée",
];
const TAGS_DEFAUT = ["GA2", "GA1", "BRI", "BRC", "MDL", "GSC", "GNC", "MDC", "ADJ", "ADC", "MAJ", "SLT", "LTN", "CNE", "CDT", "LCL", "COL", "", "", "", ""];

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
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("booleanValue" in f) return f.booleanValue;
  if ("arrayValue" in f) return (f.arrayValue.values || []).map(fromFs);
  return null;
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !FIREBASE_SERVICE_ACCOUNT) return res.status(200).json({ ok: false, message: "Synchronisation Discord pas configurée." });

  const reponse = (ok, message, alerte = false) => res.status(200).json({ ok, message, alerte });

  try {
    const { idToken, uid } = req.body || {};
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const appelant = await verifierJeton(idToken, sa.project_id);
    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;

    const lire = async (id) => {
      const r = await fetch(`${base}/personnel/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${gtok}` } });
      if (!r.ok) return null;
      const d = await r.json();
      const o = {};
      Object.entries(d.fields || {}).forEach(([k, v]) => { o[k] = fromFs(v); });
      return o;
    };

    // Réglages (grades, tags Discord, seuil « haut grade ») faits depuis le site
    let GRADES = GRADES_DEFAUT, TAGS = TAGS_DEFAUT, seuilHaut = 14;
    const sres = await fetch(`${base}/settings/general`, { headers: { Authorization: `Bearer ${gtok}` } });
    if (sres.ok) {
      const f = (await sres.json()).fields || {};
      const g = f.grades ? fromFs(f.grades) : null;
      const t = f.gradesTags ? fromFs(f.gradesTags) : null;
      if (Array.isArray(g) && g.length) { GRADES = g; TAGS = g.map((_, i) => (t && t[i]) || ""); }
      if (f.seuilHautRang) seuilHaut = fromFs(f.seuilHautRang);
    }
    const tagDe = (nom) => { const m = /^\s*\[([A-Z0-9]{3})\]/.exec(nom || ""); return m && TAGS.includes(m[1]) ? m[1] : null; };

    const moi = await lire(appelant);
    if (!moi || !(moi.isAdmin === true || moi.gradeRank >= seuilHaut)) return res.status(403).json({ ok: false, message: "Non autorisé." });
    const cible = await lire(String(uid || ""));
    if (!cible) return reponse(false, "Compte introuvable.", true);
    if (!cible.discordId) return reponse(false, "Ce compte n'est pas relié à Discord (le gendarme doit se connecter une fois avec le bouton Discord).");

    const tag = TAGS[GRADES.indexOf(cible.grade)];
    if (!tag) return reponse(false, `Pas de rôle Discord prévu pour le grade « ${cible.grade} ».`);

    const bot = { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "X-Audit-Log-Reason": encodeURIComponent("Synchronisation grade portail") };
    const roles = await (await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/roles`, { headers: bot })).json();
    if (!Array.isArray(roles)) return reponse(false, "Impossible de lire les rôles du serveur Discord.", true);
    const rolesGrade = roles.filter((r) => tagDe(r.name));
    const nouveau = rolesGrade.find((r) => tagDe(r.name) === tag);
    if (!nouveau) return reponse(false, `Le rôle Discord [${tag}] est introuvable.`, true);

    const mres = await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${cible.discordId}`, { headers: bot });
    if (mres.status === 404) return reponse(false, "Ce gendarme n'est plus sur le serveur Discord.", true);
    if (!mres.ok) return reponse(false, "Impossible de lire le membre Discord (active « Server Members Intent » dans l'onglet Bot du portail développeur).", true);
    const membre = await mres.json();

    const url = (r) => `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${cible.discordId}/roles/${r.id}`;
    for (const r of rolesGrade) {
      if (r.id !== nouveau.id && (membre.roles || []).includes(r.id)) {
        const d = await fetch(url(r), { method: "DELETE", headers: bot });
        if (!d.ok) return reponse(false, "Discord refuse de modifier les rôles : place le rôle du bot AU-DESSUS des rôles de grade.", true);
      }
    }
    if (!(membre.roles || []).includes(nouveau.id)) {
      const a = await fetch(url(nouveau), { method: "PUT", headers: bot });
      if (!a.ok) return reponse(false, "Discord refuse d'ajouter le rôle : place le rôle du bot AU-DESSUS des rôles de grade.", true);
    }
    return reponse(true, `Rôle Discord mis à jour : [${tag}].`);
  } catch (e) {
    console.error(e);
    return reponse(false, "Erreur pendant la synchronisation Discord.", true);
  }
}
