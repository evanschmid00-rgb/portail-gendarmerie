// api/_liaison.js — Outils communs : preuves signées de liaison Discord (le « _ » au début = ce n'est pas une page de l'API).
// Une preuve prouve qu'une personne a bien reçu un code par message privé du bot Discord. Elle est signée avec une clé
// dérivée du compte de service Firebase (aucune variable supplémentaire à créer).
import crypto from "node:crypto";

const b64url = (b) => Buffer.from(b).toString("base64url");

function cle() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  return crypto.createHash("sha256").update(String(sa.private_key || "") + "|liaison-discord").digest();
}
const hmac = (texte) => crypto.createHmac("sha256", cle()).update(texte).digest("base64url");

export function signer(objet) {
  const corps = b64url(JSON.stringify(objet));
  return `${corps}.${hmac(corps)}`;
}
export function lire(jeton) {
  const [corps, sig] = String(jeton || "").split(".");
  if (!corps || !sig) return null;
  const attendu = hmac(corps);
  if (sig.length !== attendu.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(attendu))) return null;
  try {
    const o = JSON.parse(Buffer.from(corps, "base64url").toString());
    return o && o.exp > Date.now() ? o : null;
  } catch (e) { return null; }
}
export const empreinteCode = (code, id, exp) => hmac(`code:${code}:${id}:${exp}`);
