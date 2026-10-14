// Envois publics protégés : candidatures, plaintes, avis, suggestions.
// Les visiteurs n'écrivent plus directement dans la base : tout passe ici, où l'on
//   - vérifie la forme et la taille des données (rien d'autre n'est enregistré),
//   - limite le nombre d'envois par connexion (par heure et par jour) et au total,
//   - refuse les robots simples (champ piège, envoi trop rapide, requête venue d'un autre site).
// Variables utilisées : FIREBASE_SERVICE_ACCOUNT (déjà en place). Facultative : SPAM_SALT (mot aléatoire quelconque).

import crypto from "node:crypto";

const b64url = (b) => Buffer.from(b).toString("base64url");
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

// Conversion JS -> Firestore (valeurs simples, listes et objets)
const toFs = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
};
const toFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toFs(v)]));

class Refus extends Error { constructor(message, statut = 400) { super(message); this.statut = statut; } }

// ---------- Nettoyage et contrôle des données ----------
const chaine = (v, max) => String(v === null || v === undefined ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
const urlValide = (s) => { try { const u = new URL(String(s || "").trim()); return u.protocol === "https:" || u.protocol === "http:" ? u.href : ""; } catch (e) { return ""; } };
const noteValide = (n) => { const x = Number(n); if (!Number.isInteger(x) || x < 1 || x > 5) throw new Refus("Choisis une note entre 1 et 5."); return x; };

const SCHEMAS = {
  suggestion: {
    collection: "suggestions", limites: { h: 5, j: 15, global: 200 },
    construire: (d) => { const texte = chaine(d.texte, 3000); if (texte.length < 3) throw new Refus("Écris ta suggestion."); return { texte }; },
  },
  avis_general: {
    collection: "avis_generaux", limites: { h: 5, j: 15, global: 200 },
    construire: (d) => ({ note: noteValide(d.note), commentaire: chaine(d.commentaire, 2000) }),
  },
  avis_gendarme: {
    collection: "avis_gendarmes", limites: { h: 5, j: 15, global: 200 },
    construire: (d) => {
      const cible = chaine(d.cibleIdentifiant, 100);
      if (!cible) throw new Refus("Indique le gendarme concerné.");
      return { cibleIdentifiant: cible, note: noteValide(d.note), commentaire: chaine(d.commentaire, 2000) };
    },
  },
  plainte: {
    collection: "plaintes", prefixe: "PLT", limites: { h: 4, j: 10, global: 100 },
    construire: (d) => {
      const o = {
        plaignantPrenom: chaine(d.plaignantPrenom, 100), plaignantNom: chaine(d.plaignantNom, 100),
        plaignantPseudoRoblox: chaine(d.plaignantPseudoRoblox, 100), plaignantPseudoDiscord: chaine(d.plaignantPseudoDiscord, 100),
        dateFaits: chaine(d.dateFaits, 10), lieuFaits: chaine(d.lieuFaits, 200), nature: chaine(d.nature, 100),
        misEnCause: chaine(d.misEnCause, 300), temoins: chaine(d.temoins, 300), description: chaine(d.description, 4900),
        certifie: d.certifie === true,
      };
      if (!o.plaignantPrenom || !o.plaignantNom) throw new Refus("Indique ton prénom et ton nom.");
      if (!o.plaignantPseudoRoblox && !o.plaignantPseudoDiscord) throw new Refus("Indique au moins un pseudo (Roblox ou Discord).");
      if (o.description.length < 20) throw new Refus("Décris les faits plus précisément (20 caractères minimum).");
      if (!o.certifie) throw new Refus("Tu dois certifier l'exactitude de ta déclaration.");
      const preuves = [];
      let photos = 0;
      for (const p of Array.isArray(d.preuves) ? d.preuves.slice(0, 12) : []) {
        if (p && typeof p.data === "string") {
          if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.data) || p.data.length > 330000 || ++photos > 4) continue;
          preuves.push({ type: "image", data: p.data, nom: chaine(p.nom, 60) });
        } else if (p && p.url) {
          const url = urlValide(p.url);
          if (url && url.length <= 500) preuves.push({ type: ["image", "video", "lien"].includes(p.type) ? p.type : "lien", url });
        }
      }
      o.preuves = preuves;
      return { ...o, source: "en_ligne" };
    },
  },
  candidature: {
    collection: "candidatures", prefixe: "CAND", suivi: true, limites: { h: 3, j: 6, global: 100 },
    construire: (d) => {
      const poste = chaine(d.poste, 100);
      if (!poste) throw new Refus("Poste manquant.");
      const answers = (Array.isArray(d.answers) ? d.answers.slice(0, 120) : []).map((a) => ({ label: chaine(a && a.label, 300), value: chaine(a && a.value, 5000) }));
      if (JSON.stringify(answers).length > 90000) throw new Refus("Candidature trop longue.");
      return { poste, displayName: chaine(d.displayName, 200) || "Candidat", contact: chaine(d.contact, 200), answers };
    },
  },
};
const prefixeDossier = (poste) => { const p = String(poste || "").toUpperCase(); return p === "GAV" ? "GAV" : p === "SOG" ? "SOG" : p === "OFFICIER" ? "OFF" : "CAND"; };
function genererNumero(prefixe) {
  const c = Array.from(crypto.randomBytes(10), (v) => ALPHABET[v % 32]).join("");
  return `${prefixe}-${c.slice(0, 5)}-${c.slice(5)}`;
}
export const __test = { SCHEMAS, chaine, urlValide };

export default async function handler(req, res) {
  const rep = (corps, code = 200) => res.status(code).json(corps);
  if (req.method !== "POST") return rep({ ok: false, message: "Méthode refusée." }, 405);
  const { FIREBASE_SERVICE_ACCOUNT, SPAM_SALT, SITE_URL } = process.env;
  if (!FIREBASE_SERVICE_ACCOUNT) return rep({ ok: false, message: "Service indisponible pour le moment." }, 500);

  try {
    // 1. La requête doit venir de ton propre site
    const hotes = new Set([String(req.headers.host || "")]);
    try { if (SITE_URL) hotes.add(new URL(SITE_URL).host); } catch (e) { /* SITE_URL invalide : ignoré */ }
    let hoteOrigine = "";
    try { hoteOrigine = new URL(String(req.headers.origin || req.headers.referer || "")).host; } catch (e) { /* vide */ }
    if (!hoteOrigine || !hotes.has(hoteOrigine)) throw new Refus("Requête refusée.", 403);

    const corps = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { type, data, idToken, hp, t } = corps;
    const schema = SCHEMAS[type];
    if (!schema) throw new Refus("Type d'envoi inconnu.");
    // 2. Robots simples : champ piège rempli ou formulaire envoyé en moins de 2,5 secondes
    if (hp) throw new Refus("Requête refusée.", 403);
    if (!(Number(t) >= 2500)) throw new Refus("Envoi trop rapide : prends le temps de remplir le formulaire.", 429);
    if (JSON.stringify(data || {}).length > 1000000) throw new Refus("Envoi trop volumineux.", 413);

    // 3. Données propres (rien d'autre que ce qui est attendu n'est enregistré)
    const propre = schema.construire(data || {});

    // 4. Limites par connexion (heure / jour) et globales
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const fsH = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };
    const ip = String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "inconnue").split(",")[0].trim();
    const empreinte = crypto.createHash("sha256").update(ip + (SPAM_SALT || "pulsar")).digest("hex").slice(0, 20);
    const iso = new Date().toISOString();
    const heure = iso.slice(0, 13).replace(/\D/g, "");
    const jour = heure.slice(0, 8);
    const compteurs = [
      [`${type}-${empreinte}-h${heure}`, schema.limites.h, "Trop d'envois en peu de temps depuis ta connexion : réessaie dans une heure."],
      [`${type}-${empreinte}-j${jour}`, schema.limites.j, "Limite quotidienne atteinte depuis ta connexion : réessaie demain."],
      [`global-${type}-h${heure}`, schema.limites.global, "Le service reçoit beaucoup d'envois en ce moment : réessaie un peu plus tard."],
    ];
    const valeurs = [];
    for (const [cle, max, message] of compteurs) {
      const r = await fetch(`${base}/limites_envois/${encodeURIComponent(cle)}`, { headers: fsH });
      const n = r.ok ? Number(((await r.json()).fields || {}).n?.integerValue || 0) : 0;
      if (n >= max) throw new Refus(message, 429);
      valeurs.push(n);
    }
    const expire = new Date(Date.now() + 2 * 86400000).toISOString();
    await Promise.all(compteurs.map(([cle], i) => fetch(`${base}/limites_envois/${encodeURIComponent(cle)}`, { method: "PATCH", headers: fsH, body: JSON.stringify({ fields: toFields({ n: valeurs[i] + 1, expireLe: expire }) }) })));

    // 5. Si la personne est connectée (gendarme), on retrouve son matricule côté serveur
    let auteurMatricule = null;
    if (idToken) {
      try {
        const uid = await verifierJeton(idToken, sa.project_id);
        const pr = await fetch(`${base}/personnel/${encodeURIComponent(uid)}`, { headers: fsH });
        if (pr.ok) auteurMatricule = ((await pr.json()).fields || {}).matricule?.stringValue || null;
      } catch (e) { /* jeton invalide : envoi anonyme */ }
    }

    // 6. Enregistrement
    const ref = schema.prefixe ? genererNumero(schema.prefixe === "CAND" ? prefixeDossier(propre.poste) : schema.prefixe) : null;
    const document = { ...propre, createdAt: iso };
    if (ref) { document.ref = ref; document.statut = "En attente"; }
    if (type === "candidature") document.auteurMatricule = auteurMatricule;
    const c = await fetch(`${base}/${schema.collection}`, { method: "POST", headers: fsH, body: JSON.stringify({ fields: toFields(document) }) });
    if (!c.ok) { console.error("Création refusée", c.status, (await c.text()).slice(0, 300)); throw new Refus("Enregistrement impossible, réessaie dans un instant.", 500); }
    const id = String((await c.json()).name || "").split("/").pop();
    if (schema.suivi) {
      await fetch(`${base}/suivi_candidatures?documentId=${encodeURIComponent(ref)}`, { method: "POST", headers: fsH, body: JSON.stringify({ fields: toFields({ poste: propre.poste, statut: "En attente", createdAt: iso, updatedAt: iso }) }) });
    }
    return rep({ ok: true, ref, id });
  } catch (e) {
    if (e instanceof Refus) return rep({ ok: false, message: e.message }, e.statut);
    console.error(e);
    return rep({ ok: false, message: "Erreur pendant l'envoi, réessaie dans un instant." }, 500);
  }
}
