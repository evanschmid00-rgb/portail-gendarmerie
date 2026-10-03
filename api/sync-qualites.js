// Met à jour la « qualité judiciaire » (OPJ / APJ / APJA) affichée sur la CIPC
// d'après les rôles [OPJ] / [APJ] / [APJA] que chaque gendarme a sur le serveur Discord.
// Appelée par le site quand quelqu'un ouvre sa CIPC ou les cartes pro (au plus une fois toutes les 2 minutes),
// ou à la demande d'un administrateur (bouton « Synchroniser avec Discord »).

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
  const rep = (ok, extra = {}) => res.status(200).json({ ok, ...extra });

  try {
    const { idToken, force } = req.body || {};
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const appelant = await verifierJeton(idToken, sa.project_id);
    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const gh = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };

    const ga = { Authorization: `Bearer ${gtok}` }; // lectures : sans en-tête Content-Type

    // Lit toutes les fiches du personnel (petite collection)
    const lister = async () => {
      const out = [];
      let pageToken = "";
      do {
        const r = await fetch(`${base}/personnel?pageSize=100${pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""}`, { headers: ga });
        if (!r.ok) { console.error("Lecture du personnel refusée", r.status, (await r.text()).slice(0, 300)); break; }
        const j = await r.json();
        (j.documents || []).forEach((d) => {
          const o = { id: d.name.split("/").pop() };
          Object.entries(d.fields || {}).forEach(([k, v]) => { o[k] = fromFs(v); });
          out.push(o);
        });
        pageToken = j.nextPageToken || "";
      } while (pageToken);
      return out;
    };

    // L'appelant est-il administrateur ? (seul un admin peut forcer la synchronisation)
    let admin = false, diag = "";
    let liste = null;
    if (force) {
      const rc = await fetch(`${base}/personnel/${encodeURIComponent(appelant)}`, { headers: ga });
      if (rc.ok) {
        const fc = (await rc.json()).fields || {};
        admin = !!(fc.isAdmin && fromFs(fc.isAdmin) === true);
      } else {
        diag = `lecture directe refusée (statut ${rc.status})`;
        console.error("Fiche de l'appelant illisible", appelant, rc.status, (await rc.text()).slice(0, 300));
        liste = await lister();
        const moi = liste.find((x) => x.id === appelant);
        if (moi) admin = moi.isAdmin === true;
        else diag += `, et aucune fiche n'a l'identifiant ${appelant}`;
      }
      if (!admin) return rep(false, { message: `Réservé aux administrateurs${diag ? " (" + diag + ")" : ""}.` });
    }

    // Anti-abus : au plus une synchronisation toutes les 2 minutes (sauf demande d'un admin)
    const rs = await fetch(`${base}/settings/sync`, { headers: ga });
    if (rs.ok && !(force && admin)) {
      const f = (await rs.json()).fields || {};
      const dernier = f.qualitesAt ? Number(fromFs(f.qualitesAt)) : 0;
      if (Date.now() - dernier < 120000) return rep(true, { ignore: true, updated: 0 });
    }
    await fetch(`${base}/settings/sync?updateMask.fieldPaths=qualitesAt`, { method: "PATCH", headers: gh, body: JSON.stringify({ fields: { qualitesAt: { integerValue: String(Date.now()) } } }) });

    // Rôles du serveur : on repère [OPJ], [APJ], [APJA]
    const bot = { Authorization: `Bot ${DISCORD_BOT_TOKEN}` };
    const roles = await (await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/roles`, { headers: bot })).json();
    if (!Array.isArray(roles)) return rep(false, { message: "Impossible de lire les rôles du serveur Discord." });
    const tagDe = {};
    roles.forEach((r) => { const m = /^\s*\[(OPJ|APJA|APJ)\]/.exec(r.name || ""); if (m) tagDe[r.id] = m[1]; });

    // Gendarmes reliés à Discord
    const tous = liste || await lister();
    const gens = tous.filter((x) => x.discordId).map((x) => ({ id: x.id, discordId: x.discordId, qualite: x.qualiteJudiciaire || "" }));

    let updated = 0, limite = false, intent = false;
    for (let i = 0; i < gens.length && !limite; i += 8) {
      await Promise.all(gens.slice(i, i + 8).map(async (g) => {
        const mr = await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${g.discordId}`, { headers: bot });
        if (mr.status === 429) { limite = true; return; }
        if (mr.status === 403) { intent = true; return; }
        if (!mr.ok) return; // a quitté le serveur : on ne touche à rien
        const membre = await mr.json();
        const tags = (membre.roles || []).map((r) => tagDe[r]).filter(Boolean);
        const qualite = tags.includes("OPJ") ? "OPJ" : tags.includes("APJ") ? "APJ" : "APJA";
        if (qualite !== g.qualite) {
          const w = await fetch(`${base}/personnel/${encodeURIComponent(g.id)}?updateMask.fieldPaths=qualiteJudiciaire&currentDocument.exists=true`, { method: "PATCH", headers: gh, body: JSON.stringify({ fields: { qualiteJudiciaire: { stringValue: qualite } } }) });
          if (w.ok) updated++;
        }
      }));
    }
    const message = intent ? "Discord refuse la lecture des membres : active « Server Members Intent » dans l'onglet Bot du portail développeur." : limite ? "Discord limite les requêtes, réessaie dans une minute." : "";
    return rep(true, { updated, total: gens.length, message });
  } catch (e) {
    console.error(e);
    return rep(false, { message: "Erreur pendant la synchronisation Discord." });
  }
}
