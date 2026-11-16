// api/_enquete.js — Outils communs de l'espace candidat (compte candidat, liaison Roblox, enquête administrative de moralité).
// Fichier avec un « _ » devant : Vercel ne le compte pas comme une fonction, il est seulement importé par les autres.
import crypto from "node:crypto";

const b64url = (b) => Buffer.from(b).toString("base64url");
function signJwt(payload, privateKey) {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64url(sig)}`;
}
export async function googleToken(sa, scope = "https://www.googleapis.com/auth/datastore") {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({ iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, sa.private_key);
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("Jeton Google refusé");
  return j.access_token;
}
export const toFs = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, toFs(x)])) } };
};
export const fromFs = (v) => {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFs);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  return null;
};
const champs = (d) => Object.fromEntries(Object.entries((d && d.fields) || {}).map(([k, x]) => [k, fromFs(x)]));

export class Refus extends Error { constructor(message, statut = 400) { super(message); this.statut = statut; } }

// ───────── Accès à la base (clé de service) ─────────
export async function ouvrirBase(saJson) {
  const sa = typeof saJson === "string" ? JSON.parse(saJson) : saJson;
  const gtok = await googleToken(sa);
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  const H = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };
  const lire = async (chemin) => { const r = await fetch(`${base}/${chemin}`, { headers: H }); if (r.status === 404) return null; if (!r.ok) throw new Error(`lecture ${chemin} ${r.status}`); return champs(await r.json()); };
  // Écrit seulement les clés données ; une clé listée dans `supprimer` est effacée
  const ecrire = async (chemin, obj, supprimer = []) => {
    const cles = [...Object.keys(obj).filter((k) => obj[k] !== undefined), ...supprimer];
    const masque = cles.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
    const r = await fetch(`${base}/${chemin}?${masque}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: Object.fromEntries(Object.keys(obj).filter((k) => obj[k] !== undefined).map((k) => [k, toFs(obj[k])])) }) });
    if (!r.ok) throw new Error(`écriture ${chemin} ${r.status}`);
  };
  // Documents d'une collection dont un champ vaut une des valeurs données
  const trouver = async (collection, champ, valeurs) => {
    const vals = valeurs.map((v) => toFs(v));
    const r = await fetch(`${base}:runQuery`, { method: "POST", headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: champ }, op: "IN", value: { arrayValue: { values: vals } } } }, limit: 200 } }) });
    if (!r.ok) throw new Error(`requête ${collection} ${r.status}`);
    return (await r.json()).filter((l) => l.document).map((l) => ({ id: String(l.document.name).split("/").pop(), ...champs(l.document) }));
  };
  const lister = async (collection, max = 500) => {
    const out = []; let page = "";
    for (let i = 0; i < 10 && out.length < max; i++) {
      const r = await fetch(`${base}/${collection}?pageSize=100${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`, { headers: H });
      if (!r.ok) throw new Error(`liste ${collection} ${r.status}`);
      const j = await r.json();
      for (const d of j.documents || []) out.push({ id: String(d.name).split("/").pop(), ...champs(d) });
      if (!j.nextPageToken) break; page = j.nextPageToken;
    }
    return out;
  };
  return { sa, base, H, lire, ecrire, trouver, lister };
}

// ───────── Jeton de connexion Firebase (envoyé par le navigateur) ─────────
export async function verifierJeton(idToken, projectId) {
  const [h, p, s] = String(idToken || "").split(".");
  if (!h || !p || !s) throw new Error("jeton invalide");
  const head = JSON.parse(Buffer.from(h, "base64url").toString());
  const pay = JSON.parse(Buffer.from(p, "base64url").toString());
  const now = Math.floor(Date.now() / 1000);
  if (pay.aud !== projectId || pay.iss !== `https://securetoken.google.com/${projectId}` || !pay.sub || pay.exp < now) throw new Error("jeton refusé");
  const certs = await (await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com")).json();
  const cert = certs[head.kid];
  if (!cert) throw new Error("clé inconnue");
  if (!crypto.createVerify("RSA-SHA256").update(`${h}.${p}`).verify(cert, Buffer.from(s, "base64url"))) throw new Error("signature invalide");
  return pay.sub;
}

// ───────── Identité RP d'un candidat ─────────
const MOTIF_NOM = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const MAJ = (s) => String(s || "").replace(/\s+/g, " ").trim().toLocaleUpperCase("fr-FR");
const TITRE = (s) => String(s || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr-FR").replace(/(^|[ '’-])([a-zà-öø-ÿ])/g, (m, sep, l) => sep + l.toLocaleUpperCase("fr-FR"));
// Renvoie l'identité nettoyée, ou lance un Refus avec le message à afficher
export function nettoyerCandidat(q) {
  const nom = MAJ(q.nom), prenom = TITRE(q.prenom), lieu = String(q.lieu || "").replace(/\s+/g, " ").trim();
  const naissance = String(q.naissance || "").trim();
  const roblox = String(q.roblox || "").trim().replace(/^@/, "");
  if (nom.length < 2 || nom.length > 40 || !MOTIF_NOM.test(nom)) throw new Refus("Indique ton NOM RP (lettres uniquement).");
  if (prenom.length < 2 || prenom.length > 40 || !MOTIF_NOM.test(prenom)) throw new Refus("Indique ton prénom RP (lettres uniquement).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(naissance) || isNaN(Date.parse(naissance + "T12:00:00Z")) || Date.parse(naissance) > Date.now() || Number(naissance.slice(0, 4)) < 1900) throw new Refus("Date de naissance invalide.");
  if (lieu.length < 2 || lieu.length > 60) throw new Refus("Indique ton lieu de naissance RP.");
  if (!/^[A-Za-z0-9_]{3,20}$/.test(roblox)) throw new Refus("Pseudo Roblox invalide (3 à 20 caractères : lettres, chiffres, _).");
  return { nom, prenom, dateNaissance: naissance, lieuNaissance: lieu, roblox };
}

// ───────── Roblox ─────────
export async function resoudreRoblox(pseudo) {
  const r = await fetch("https://users.roblox.com/v1/usernames/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernames: [String(pseudo)], excludeBannedUsers: false }) });
  if (!r.ok) return null;
  const u = ((await r.json()).data || [])[0];
  return u && u.id ? { id: String(u.id), username: u.name, displayName: u.displayName || u.name } : null;
}
export async function descriptionRoblox(id) {
  const r = await fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  const u = await r.json();
  return String(u.description || "");
}
export const codeRoblox = () => `NEO-${Array.from(crypto.randomBytes(6), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("")}`;
export const numeroCandidat = () => `CAND-${Array.from(crypto.randomBytes(8), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("").replace(/^(.{4})(.{4})$/, "$1-$2")}`;

// ───────── Gravité d'une mention de casier (copie de lib/casierBloquant.js) ─────────
const RANG = { Contravention: 1, "Délit": 2, Crime: 3 };
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function graviteDepuisNature(nature, codePenal) {
  let reste = norm(nature);
  if (!reste) return "";
  const articles = (codePenal || []).filter((a) => a && a.nom && RANG[a.type]).map((a) => ({ nom: norm(a.nom), type: a.type })).filter((a) => a.nom).sort((a, b) => b.nom.length - a.nom.length);
  let max = "";
  for (const a of articles) {
    const re = new RegExp("(^|[^a-z0-9])" + echapper(a.nom) + "(?![a-z0-9])", "g");
    if (re.test(reste)) { if ((RANG[a.type] || 0) > (RANG[max] || 0)) max = a.type; reste = reste.replace(re, "$1|"); }
  }
  return max;
}

// ───────── Enquête administrative de moralité (consultation du TAJ, du CJN et du FPR) ─────────
// Écrit le résultat détaillé dans « enquetes_moralite » (visible du recrutement uniquement)
// et un simple statut dans la fiche du candidat (visible de lui).
export async function lancerEnquete(db, uid, cand) {
  const maintenant = new Date().toISOString();
  if (!cand.robloxId) {
    await db.ecrire(`candidats/${uid}`, { enquete: { statut: "en-attente", lancee: "", terminee: "" } });
    return { statut: "en-attente" };
  }
  const id = String(cand.robloxId);
  const noms = Array.from(new Set([cand.pseudoRoblox, cand.robloxUsername].filter(Boolean)));
  const sur = async (p) => { try { return await p; } catch (e) { console.error("Enquête : fichier illisible", e); return null; } };
  const [c1, c2, c3, cjn, fpr] = await Promise.all([
    sur(db.trouver("casier", "robloxId", [id, Number(id)])),
    noms.length ? sur(db.trouver("casier", "robloxUsername", noms)) : [],
    noms.length ? sur(db.trouver("casier", "pseudoRoblox", noms)) : [],
    sur(db.trouver("cjn", "robloxId", [id, Number(id)])),
    sur(db.trouver("fpr", "robloxId", [id])),
  ]);
  const illisibles = [c1, cjn, fpr].filter((x) => x === null).length;
  const vus = new Map();
  [c1, c2, c3].forEach((l) => (l || []).forEach((d) => vus.set(d.id, d)));
  const mentions = Array.from(vus.values()).flatMap((d) => d.mentions || []);
  let codePenal = [];
  if (mentions.some((m) => !RANG[m.gravite])) codePenal = (await sur(db.lister("code_penal", 400))) || [];
  const lignes = [];
  const compte = { contraventions: 0, delits: 0, crimes: 0, cjn: 0, fpr: 0 };
  mentions.forEach((m) => {
    const g = RANG[m.gravite] ? m.gravite : graviteDepuisNature(m.nature, codePenal);
    if (g === "Contravention") compte.contraventions++; else if (g === "Délit") compte.delits++; else if (g === "Crime") compte.crimes++; else compte.contraventions++;
    lignes.push({ fichier: "TAJ", libelle: String(m.nature || "Mention").slice(0, 200), gravite: g || "Non classée", date: String(m.dateFaits || m.createdAt || "").slice(0, 10) });
  });
  (cjn || []).forEach((d) => {
    compte.cjn++;
    lignes.push({ fichier: "CJN", libelle: String((d.infractions || []).map((i) => i.nom).join(", ") || d.libelle || "Condamnation").slice(0, 200), gravite: d.gravite || "Condamnation", date: String(d.dateDecision || "").slice(0, 10) });
  });
  (fpr || []).filter((x) => x.actif !== false).forEach((x) => {
    compte.fpr++;
    lignes.push({ fichier: "FPR", libelle: String(x.motif || x.libelle || "Fiche de personne recherchée").slice(0, 200), gravite: "Recherché(e)", date: String(x.createdAt || "").slice(0, 10) });
  });
  const defavorable = compte.delits + compte.crimes + compte.cjn + compte.fpr > 0;
  const niveau = illisibles ? "incomplet" : defavorable ? "defavorable" : compte.contraventions > 0 ? "a-etudier" : "ras";
  await db.ecrire(`enquetes_moralite/${uid}`, {
    uid, nom: cand.nom || "", prenom: cand.prenom || "", pseudoRoblox: cand.pseudoRoblox || cand.robloxUsername || "", robloxId: id, robloxVerifie: !!cand.robloxVerifie,
    numero: cand.numero || "", lancee: maintenant, compte, niveau, lignes: lignes.slice(0, 60), fichiers: ["TAJ", "CJN", "FPR"],
  }, ["avis", "commentaire", "par", "le"]);
  await db.ecrire(`candidats/${uid}`, { enquete: { statut: "en-cours", lancee: maintenant, terminee: "" } });
  return { statut: "en-cours", niveau };
}
