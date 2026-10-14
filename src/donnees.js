// lib/donnees.js — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { FIREBASE_API_KEY, auth, db } from "../firebase";
import { addDoc, collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { cleJour } from "./utils.js";

export function usernameToEmail(username) {
  const clean = (username || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return clean + "@ghgendarmerie.app";
}

// Crée un compte Firebase Authentication sans déconnecter la session en cours
// (appel REST direct, indépendant du SDK client).
export async function createAuthUser(email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Erreur de création du compte.");
  return data.localId;
}

// Charge seulement les N documents les plus récents (évite de relire toute une collection qui grossit)
// Charge seulement les documents qui correspondent à un filtre (utilisé quand on n'a le droit de lire que les siens)
export async function loadWhere(name, champ, op, valeur) {
  try {
    const snap = await getDocs(query(collection(db, name), where(champ, op, valeur)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error(name, e); return []; }
}
export async function loadRecent(name, n, champ = "createdAt") {
  try {
    const snap = await getDocs(query(collection(db, name), orderBy(champ, "desc"), limit(n)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(name, e);
    return [];
  }
}

// Lecture « stricte » : lève une erreur en cas d'échec (pour pouvoir réessayer plus tard)
export async function loadStrict(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
// Les services d'un seul gendarme (au lieu de ceux de tout le monde)
export async function loadServicesDe(matricule) {
  try {
    const snap = await getDocs(query(collection(db, "services"), where("matricule", "==", matricule)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("services", e); return []; }
}

export async function loadCollection(name) {
  try {
    const snap = await getDocs(collection(db, name));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(name, e);
    return [];
  }
}

// Envoie une notification Discord via la fonction serveur /api/notify (le lien du webhook reste secret côté Vercel)
export function notifierDiscord(type, texte) {
  try {
    fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, texte }) }).catch(() => {});
  } catch (e) { /* une notification ratée ne doit jamais bloquer le site */ }
}

// Ajoute une ligne automatique dans la main courante (prise de service, PV, casier…) ; ne bloque jamais l'action d'origine
export async function journaliserMC(auteur, texte) {
  try {
    if (!auteur || !auteur.id) return;
    await addDoc(collection(db, "main_courante"), {
      createdAt: new Date().toISOString(), jour: cleJour(new Date()), type: "Activité", lieu: "", agents: "",
      description: String(texte).slice(0, 380), auto: true,
      auteurUid: auteur.id, auteurNom: `${auteur.prenom} ${auteur.nom}`, auteurGrade: auteur.grade, auteurRIO: auteur.cipcNumero || "",
    });
  } catch (e) { console.error("Main courante automatique :", e); }
}

// Met à jour le rôle Discord [TAG] d'un gendarme d'après son grade sur le site (via /api/sync-grade)
export async function syncGradeDiscord(uid) {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const idToken = await user.getIdToken();
    const r = await fetch("/api/sync-grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, uid }) });
    return await r.json();
  } catch (e) { return null; }
}

// Donne ou retire le rôle Discord de sanction (via /api/sync-sanction) ; action : "ajouter" ou "retirer"
export async function syncSanctionDiscord(sanctionId, action) {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const idToken = await user.getIdToken();
    const r = await fetch("/api/sync-sanction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, sanctionId, action }) });
    return await r.json();
  } catch (e) { return null; }
}
