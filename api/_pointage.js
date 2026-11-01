// api/_pointage.js — Outils communs du pointage de service par Discord (le « _ » = ce n'est pas une page de l'API).
// Règles (identiques à celles du site, voir src/lib/utils.js) : pointage 1 h après le début du service puis 1 h après chaque pointage,
// 10 minutes pour répondre, service de 3 h maximum.
import crypto from "node:crypto";
import { discordFetch } from "./_discordApi.js";

export const DUREE_MAX_SERVICE_MS = 3 * 3600 * 1000;
export const INTERVALLE_POINTAGE_MS = 60 * 60000;
export const DELAI_REPONSE_POINTAGE_MS = 10 * 60000;
export const SEUIL_POINTAGE_MS = INTERVALLE_POINTAGE_MS + DELAI_REPONSE_POINTAGE_MS;
const GRACE_MS = 5 * 60000;

export const dernierPointageMs = (s) => new Date(s.dernierPointage || s.debut).getTime();
export const echeancePointageMs = (s) => dernierPointageMs(s) + INTERVALLE_POINTAGE_MS; // heure à laquelle il faut pointer
export const limitePointageMs = (s) => echeancePointageMs(s) + DELAI_REPONSE_POINTAGE_MS; // dernier instant pour répondre
export const finAuto = (s) => new Date(Math.min(new Date(s.debut).getTime() + DUREE_MAX_SERVICE_MS, dernierPointageMs(s) + GRACE_MS)).toISOString();

// ---------- Firestore (API REST, compte de service) ----------
const b64url = (b) => Buffer.from(b).toString("base64url");
function signJwt(payload, privateKey) {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  return `${head}.${body}.${b64url(crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey))}`;
}
let jetonCache = null;
async function googleToken(sa) {
  if (jetonCache && jetonCache.exp > Date.now() + 60000) return jetonCache.token;
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, sa.private_key);
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("Jeton Google refusé");
  jetonCache = { token: j.access_token, exp: Date.now() + 3500 * 1000 };
  return j.access_token;
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
const toFs = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
  return { nullValue: null };
};

export async function ouvrirBase() {
  const { FIREBASE_SERVICE_ACCOUNT } = process.env;
  const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  const h = { Authorization: `Bearer ${await googleToken(sa)}`, "Content-Type": "application/json" };
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  return {
    async lire(chemin) {
      const r = await fetch(`${base}/${chemin}`, { headers: h });
      return r.ok ? versObjet(await r.json()) : null;
    },
    async requete(sq) {
      const r = await fetch(`${base}:runQuery`, { method: "POST", headers: h, body: JSON.stringify({ structuredQuery: sq }) });
      const arr = await r.json();
      if (!Array.isArray(arr)) throw new Error("requête Firestore refusée");
      return arr.filter((x) => x.document).map((x) => ({ id: x.document.name.split("/").pop(), ...versObjet(x.document) }));
    },
    async modifier(chemin, champs) {
      const masque = Object.keys(champs).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
      const r = await fetch(`${base}/${chemin}?${masque}`, { method: "PATCH", headers: h, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, toFs(v)])) }) });
      return r.ok;
    },
    async supprimer(chemin) { const r = await fetch(`${base}/${chemin}`, { method: "DELETE", headers: h }); return r.ok || r.status === 404; },
    async personneParMatricule(matricule) {
      const l = await this.requete({ from: [{ collectionId: "personnel" }], where: { fieldFilter: { field: { fieldPath: "matricule" }, op: "EQUAL", value: { stringValue: String(matricule) } } }, limit: 1 });
      return l[0] || null;
    },
  };
}

// ---------- Messages Discord ----------
const hms = (ms) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const entete = { name: "GENDARMERIE NATIONALE · NÎMES RP" };
const ts = (ms) => Math.floor(ms / 1000);

export function embedDemande(prenom, service) {
  const limite = limitePointageMs(service);
  return {
    author: entete,
    title: "⏰ Pointage de service",
    description: `Bonjour **${prenom || "gendarme"}**,\nEs-tu toujours en service ? Confirme ta présence avec le bouton ci-dessous.`,
    color: 0xE0A23A,
    fields: [
      { name: "⏱️ À faire avant", value: `<t:${ts(limite)}:T> (<t:${ts(limite)}:R>)`, inline: true },
      { name: "🚪 Prise de service", value: `<t:${ts(new Date(service.debut).getTime())}:t>`, inline: true },
      { name: "⚠️ Sans réponse", value: `Ton service sera arrêté et ne sera compté que jusqu'à ton dernier pointage (${hms(dernierPointageMs(service) + GRACE_MS)}).` },
    ],
    footer: { text: "Tu peux aussi pointer directement sur le site." },
    timestamp: new Date().toISOString(),
  };
}
export const boutonPointage = (serviceId, echeanceMs) => [{ type: 1, components: [{ type: 2, style: 3, label: "Je suis là — je pointe", emoji: { name: "✅" }, custom_id: `pointer:${serviceId}:${echeanceMs}` }] }];

export const embedConfirme = (prochainMs) => ({
  author: entete, title: "✅ Pointage confirmé", color: 0x2E7D4F,
  description: "Merci, ta présence est enregistrée : ton temps de service continue d'être compté.",
  fields: [{ name: "⏭️ Prochain pointage", value: `vers <t:${ts(prochainMs)}:t>`, inline: true }],
  timestamp: new Date().toISOString(),
});
export const embedManque = (finMs) => ({
  author: entete, title: "⏱️ Pointage manqué — service arrêté", color: 0xC0172D,
  description: `Tu n'as pas pointé à temps : ton service a été arrêté automatiquement. Il est compté jusqu'à **${hms(finMs)}**.`,
  footer: { text: "Reprends ton service sur le site quand tu es de nouveau disponible." },
  timestamp: new Date().toISOString(),
});
export const embedInfo = (titre, texte) => ({ author: entete, title: titre, description: texte, color: 0x5A6B84, timestamp: new Date().toISOString() });

const botH = () => ({ Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" });
export async function envoyerMP(discordId, corps) {
  const dm = await discordFetch("https://discord.com/api/users/@me/channels", { method: "POST", headers: botH(), body: JSON.stringify({ recipient_id: discordId }) });
  if (!dm.ok) return null;
  const canal = await dm.json();
  const m = await discordFetch(`https://discord.com/api/channels/${canal.id}/messages`, { method: "POST", headers: botH(), body: JSON.stringify(corps) });
  if (!m.ok) return null;
  const msg = await m.json();
  return { c: canal.id, m: msg.id };
}
export async function modifierMessage(c, m, corps) {
  try { await discordFetch(`https://discord.com/api/channels/${c}/messages/${m}`, { method: "PATCH", headers: botH(), body: JSON.stringify(corps) }); } catch (e) { /* tant pis */ }
}

// ---------- Signature des appels de Discord (Ed25519) ----------
export function signatureValide(corpsBrut, signatureHex, horodatage, cleHex) {
  try {
    const cle = crypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(cleHex, "hex")]), format: "der", type: "spki" });
    return crypto.verify(null, Buffer.from(horodatage + corpsBrut), cle, Buffer.from(signatureHex, "hex"));
  } catch (e) { return false; }
}
