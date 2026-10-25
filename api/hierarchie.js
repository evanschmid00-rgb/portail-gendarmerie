// api/hierarchie.js — Hiérarchie publique : nom, grade, unité et fonction des agents (rien d'autre n'est exposé).
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
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("Jeton Google refusé");
  return j.access_token;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") { res.statusCode = 405; return res.end(JSON.stringify({ ok: false })); }
  try {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    const gtok = await googleToken(sa);
    const champs = ["prenom", "nom", "grade", "unite", "fonction", "sousFonction", "robloxId"];
    const agents = [];
    let page = "";
    for (let i = 0; i < 10; i++) {
      const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/personnel?pageSize=300${champs.map((c) => `&mask.fieldPaths=${c}`).join("")}${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${gtok}` } });
      if (!r.ok) throw new Error(`Firestore ${r.status}`);
      const j = await r.json();
      for (const d of j.documents || []) {
        const f = d.fields || {};
        const v = (k) => (f[k] && (f[k].stringValue !== undefined ? f[k].stringValue : f[k].integerValue !== undefined ? String(f[k].integerValue) : "")) || "";
        if (v("nom") || v("prenom")) agents.push({ prenom: v("prenom"), nom: v("nom"), grade: v("grade"), unite: v("unite"), fonction: v("fonction"), sousFonction: v("sousFonction"), robloxId: v("robloxId") });
      }
      page = j.nextPageToken || "";
      if (!page) break;
    }
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, agents }));
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, message: "Hiérarchie indisponible pour le moment.", detail: String((e && e.message) || e).slice(0, 200) }));
  }
}
