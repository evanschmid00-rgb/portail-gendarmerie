// Lie un compte Roblox à un gendarme en PROUVANT qu'il en est le propriétaire :
// le gendarme colle un code dans la description de son profil Roblox, le serveur la lit et vérifie.
// Aucun mot de passe, aucune clé supplémentaire : on réutilise FIREBASE_SERVICE_ACCOUNT.

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
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("booleanValue" in f) return f.booleanValue;
  if ("arrayValue" in f) return (f.arrayValue.values || []).map(fromFs);
  return null;
};

// Code propre à CE gendarme et CE compte Roblox (impossible à deviner pour un autre)
const CONSONNES = "BCDFGHJKLMNPQRSTVWXZ";
function codePour(secret, uid, robloxId) {
  const h = crypto.createHmac("sha256", secret).update(`${uid}:${robloxId}`).digest();
  let s = "";
  for (let i = 0; i < 10; i++) s += CONSONNES[h[i] % CONSONNES.length];
  return `GHP-${s}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const { FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!FIREBASE_SERVICE_ACCOUNT) return res.status(200).json({ ok: false, message: "Liaison Roblox pas encore configurée." });
  const rep = (ok, message, extra = {}) => res.status(200).json({ ok, message, ...extra });

  try {
    const { idToken, action } = req.body || {};
    const pseudo = String((req.body || {}).pseudo || "").trim();
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const uid = await verifierJeton(idToken, sa.project_id);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(pseudo)) return rep(false, "Pseudo Roblox invalide.");

    const r = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [pseudo], excludeBannedUsers: true }),
    });
    const u = ((await r.json()).data || [])[0];
    if (!u) return rep(false, "Pseudo Roblox introuvable.");
    const robloxId = String(u.id);
    const code = codePour(sa.private_key, uid, robloxId);

    // Un compte Roblox ne peut être lié qu'à un seul gendarme
    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const gh = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };
    let pageToken = "";
    do {
      const j = await (await fetch(`${base}/personnel?pageSize=300${pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""}`, { headers: gh })).json();
      for (const d of j.documents || []) {
        const autre = d.name.split("/").pop();
        const lie = d.fields && d.fields.robloxId ? fromFs(d.fields.robloxId) : "";
        const verifie = d.fields && d.fields.robloxVerifie ? fromFs(d.fields.robloxVerifie) : false;
        if (autre !== uid && verifie && lie === robloxId) return rep(false, "Ce compte Roblox est déjà lié à un autre gendarme.");
      }
      pageToken = j.nextPageToken || "";
    } while (pageToken);

    if (action === "start") return rep(true, "", { code, nom: u.name, id: robloxId });

    if (action === "verify") {
      const prof = await (await fetch(`https://users.roblox.com/v1/users/${robloxId}`)).json();
      const description = String(prof.description || "").toUpperCase();
      if (!description.includes(code)) return rep(false, "Code introuvable dans la description de ton profil Roblox. Vérifie qu'il y est bien (enregistre ton profil), puis réessaie.");
      const champs = { pseudoRoblox: { stringValue: u.name }, robloxId: { stringValue: robloxId }, robloxVerifie: { booleanValue: true } };
      const mask = Object.keys(champs).map((k) => "updateMask.fieldPaths=" + k).join("&");
      const w = await fetch(`${base}/personnel/${encodeURIComponent(uid)}?${mask}&currentDocument.exists=true`, { method: "PATCH", headers: gh, body: JSON.stringify({ fields: champs }) });
      if (!w.ok) return rep(false, "Impossible d'enregistrer la liaison, réessaie.");
      return rep(true, "Compte Roblox lié.", { id: robloxId, nom: u.name });
    }
    return rep(false, "Action inconnue.");
  } catch (e) {
    console.error(e);
    return rep(false, "Erreur pendant la liaison Roblox, réessaie dans un instant.");
  }
}
