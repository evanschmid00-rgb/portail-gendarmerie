// api/epreuves.js — Épreuves de sélection passées EN LIGNE par les candidats (écrit, psychotechnique).
// Le candidat s'identifie avec son numéro de dossier. Les bonnes réponses ne quittent JAMAIS le serveur :
//   • action « sujet »  : renvoie les questions (sans les réponses), démarre le chronomètre ;
//   • action « rendre » : corrige côté serveur, enregistre la note et le résultat (réussi / échoué).
// Les épreuves (questions, durée, seuil) sont réglées par le recrutement dans le site (collection « selection_epreuves »).
// Variable utilisée : FIREBASE_SERVICE_ACCOUNT (déjà en place).

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
const toFs = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
};
const fromFs = (v) => {
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

class Refus extends Error { constructor(message, statut = 400) { super(message); this.statut = statut; } }
const FORMAT_DOSSIER = /^[A-Z]{3,4}-[A-Z2-9]{5}-[A-Z2-9]{5}$/;
const ETAPES = ["ecrit", "psycho"];
const NOMS = { ecrit: "épreuve écrite", psycho: "test psychotechnique" };

export default async function handler(req, res) {
  const rep = (corps, code = 200) => res.status(code).json(corps);
  if (req.method !== "POST") return rep({ ok: false, message: "Méthode refusée." }, 405);
  const { FIREBASE_SERVICE_ACCOUNT, SITE_URL } = process.env;
  if (!FIREBASE_SERVICE_ACCOUNT) return rep({ ok: false, message: "Service indisponible pour le moment." }, 500);
  try {
    // La requête doit venir de ton propre site
    const hotes = new Set([String(req.headers.host || "")]);
    try { if (SITE_URL) hotes.add(new URL(SITE_URL).host); } catch (e) { /* ignoré */ }
    let origine = "";
    try { origine = new URL(String(req.headers.origin || req.headers.referer || "")).host; } catch (e) { /* vide */ }
    if (!origine || !hotes.has(origine)) throw new Refus("Requête refusée.", 403);

    const corps = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const action = String(corps.action || "");
    const numero = String(corps.numero || "").toUpperCase();
    const etape = String(corps.etape || "");
    if (!["sujet", "rendre"].includes(action)) throw new Refus("Action inconnue.");
    if (!FORMAT_DOSSIER.test(numero)) throw new Refus("Numéro de dossier invalide.");
    if (!ETAPES.includes(etape)) throw new Refus("Épreuve inconnue.");

    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const fsH = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };
    const lire = async (chemin) => { const r = await fetch(`${base}/${chemin}`, { headers: fsH }); if (r.status === 404) return null; if (!r.ok) throw new Error(`lecture ${chemin} ${r.status}`); return champs(await r.json()); };
    const ecrire = async (chemin, obj, cles) => {
      const masque = cles.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
      const r = await fetch(`${base}/${chemin}?${masque}`, { method: "PATCH", headers: fsH, body: JSON.stringify({ fields: Object.fromEntries(cles.filter((k) => obj[k] !== undefined).map((k) => [k, toFs(obj[k])])) }) });
      if (!r.ok) throw new Error(`écriture ${chemin} ${r.status}`);
    };
    const resumer = (sel) => ({ etapes: Object.fromEntries(Object.entries(sel.etapes || {}).map(([k, v]) => [k, (v && v.statut) || "a-faire"])), decision: sel.decision || "en-cours", filiere: sel.filiere || "terrain", ...(sel.rang ? { rang: sel.rang } : {}) });
    const publier = async (sel) => { try { await ecrire(`suivi_candidatures/${numero}`, { selection: resumer(sel), updatedAt: new Date().toISOString() }, ["selection", "updatedAt"]); } catch (e) { console.error("Résumé public", e); } };

    const sel = await lire(`selections/${numero}`);
    if (!sel) throw new Refus("Aucune épreuve n'est encore ouverte pour ce dossier.", 404);
    const etapes = { ...(sel.etapes || {}) };
    const e = etapes[etape] || {};
    const maintenant = Date.now();

    // Correction (utilisée par « rendre » et par la reprise d'une session expirée)
    const corriger = async (session, reponses) => {
      const epr = await lire(`selection_epreuves/${session.epreuveId}`);
      if (!epr) throw new Refus("Épreuve introuvable, préviens le recrutement.", 404);
      const qs = Array.isArray(epr.questions) ? epr.questions : [];
      let gagne = 0, total = 0;
      (session.ids || []).forEach((idx, i) => {
        const q = qs[idx]; if (!q) return;
        const pts = Number(q.points) > 0 ? Number(q.points) : 1;
        total += pts;
        if (Number.isInteger(reponses[i]) && reponses[i] === Number(q.bonne)) gagne += pts;
      });
      const note = total ? Math.round((gagne / total) * 200) / 10 : 0;
      const seuil = Number(epr.seuil) > 0 ? Number(epr.seuil) : 10;
      const reussi = note >= seuil;
      etapes[etape] = { statut: reussi ? "reussi" : "echoue", note, sur: 20, seuil, bonnes: Math.round(gagne), questions: (session.ids || []).length, le: new Date().toISOString(), tentatives: Number(e.tentatives || 1), epreuve: epr.titre || "", automatique: true };
      const maj = { ...sel, etapes };
      delete maj.session;
      await ecrire(`selections/${numero}`, { etapes, session: undefined, updatedAt: new Date().toISOString() }, ["etapes", "session", "updatedAt"]);
      await publier(maj);
      return { note, seuil, reussi };
    };

    if (action === "sujet") {
      if (!["ouvert", "en-cours"].includes(e.statut)) throw new Refus(`Cette épreuve (${NOMS[etape]}) n'est pas ouverte pour ton dossier. Le recrutement te convoquera.`, 403);
      let session = sel.session && sel.session.etape === etape ? sel.session : null;
      if (session && maintenant > Date.parse(session.fin) + 30000) {
        // Temps écoulé sans remise : l'épreuve est corrigée avec les réponses manquantes (0 point)
        const r = await corriger(session, []);
        return rep({ ok: true, termine: true, note: r.note, reussi: r.reussi, message: "Le temps était écoulé : ton épreuve a été clôturée." });
      }
      if (!session) {
        const liste = [];
        let page = "";
        for (let i = 0; i < 10; i++) {
          const r = await fetch(`${base}/selection_epreuves?pageSize=100${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`, { headers: fsH });
          if (!r.ok) throw new Error(`lecture épreuves ${r.status}`);
          const j = await r.json();
          for (const d of j.documents || []) liste.push({ id: String(d.name).split("/").pop(), ...champs(d) });
          if (!j.nextPageToken) break; page = j.nextPageToken;
        }
        const dispo = liste.filter((x) => x.actif !== false && x.type === etape && Array.isArray(x.questions) && x.questions.length && (!Array.isArray(x.filieres) || !x.filieres.length || x.filieres.includes(sel.filiere || "terrain")));
        if (!dispo.length) throw new Refus(`Aucun ${NOMS[etape]} n'est disponible pour le moment. Préviens le recrutement.`, 404);
        const epr = dispo[crypto.randomInt(dispo.length)];
        const idx = epr.questions.map((_, i) => i);
        for (let i = idx.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
        const nb = Number(epr.nbQuestions) > 0 ? Math.min(Number(epr.nbQuestions), idx.length) : idx.length;
        const duree = Number(epr.dureeMin) > 0 ? Number(epr.dureeMin) : 20;
        session = { etape, epreuveId: epr.id, debut: new Date(maintenant).toISOString(), fin: new Date(maintenant + duree * 60000).toISOString(), ids: idx.slice(0, nb), dureeMin: duree };
        etapes[etape] = { ...e, statut: "en-cours", tentatives: Number(e.tentatives || 0) + 1, debut: session.debut };
        await ecrire(`selections/${numero}`, { etapes, session, updatedAt: new Date().toISOString() }, ["etapes", "session", "updatedAt"]);
        await publier({ ...sel, etapes });
      }
      const epr = await lire(`selection_epreuves/${session.epreuveId}`);
      if (!epr) throw new Refus("Épreuve introuvable, préviens le recrutement.", 404);
      const questions = (session.ids || []).map((idx) => { const q = (epr.questions || [])[idx] || {}; return { q: String(q.q || ""), choix: (q.choix || []).map(String) }; });
      return rep({ ok: true, titre: epr.titre || NOMS[etape], consigne: epr.consigne || "", fin: session.fin, dureeMin: session.dureeMin, questions });
    }

    // action « rendre »
    const session = sel.session && sel.session.etape === etape ? sel.session : null;
    if (!session) throw new Refus("Aucune épreuve en cours pour ce dossier.", 400);
    const reps = Array.isArray(corps.reponses) ? corps.reponses.slice(0, 200).map((x) => (Number.isInteger(x) ? x : -1)) : [];
    const retard = maintenant > Date.parse(session.fin) + 30000;
    const r = await corriger(session, retard ? [] : reps);
    return rep({ ok: true, note: r.note, seuil: r.seuil, reussi: r.reussi, retard });
  } catch (e) {
    if (e instanceof Refus) return rep({ ok: false, message: e.message }, e.statut);
    console.error(e);
    return rep({ ok: false, message: "Erreur du serveur, réessaie dans un instant." }, 500);
  }
}
