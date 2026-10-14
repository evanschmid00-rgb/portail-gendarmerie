// lib/dossier.js — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/* ---------- Numéro de dossier de candidature (suivi public) ---------- */

export const ALPHABET_DOSSIER = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 caractères, sans 0/O/1/I pour éviter les confusions
export const FORMAT_DOSSIER = /^[A-Z]{3,4}-[A-Z2-9]{5}-[A-Z2-9]{5}$/;
function prefixeDossier(poste) {
  const p = String(poste || "").toUpperCase();
  return p === "GAV" ? "GAV" : p === "SOG" ? "SOG" : p === "OFFICIER" ? "OFF" : p === "PLT" ? "PLT" : "CAND";
}
// Numéro aléatoire et impossible à deviner (10 caractères tirés au hasard par le navigateur)
export function genererNumeroDossier(poste) {
  const tab = new Uint32Array(10);
  window.crypto.getRandomValues(tab);
  const c = Array.from(tab, (v) => ALPHABET_DOSSIER[v % 32]).join("");
  return `${prefixeDossier(poste)}-${c.slice(0, 5)}-${c.slice(5)}`;
}
export function normaliserNumeroDossier(s) {
  const t = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const n = t.length === 13 ? 3 : t.length === 14 ? 4 : 0;
  if (!n) return "";
  const num = `${t.slice(0, n)}-${t.slice(n, n + 5)}-${t.slice(n + 5)}`;
  return FORMAT_DOSSIER.test(num) ? num : "";
}
export async function chercherDossier(numero) {
  const snap = await getDoc(doc(db, "suivi_candidatures", numero));
  return snap.exists() ? snap.data() : null;
}

// Mémoire du navigateur : retient le dossier déjà déposé pour chaque poste
const CLE_DOSSIERS = "pulsar_dossiers_candidature";
export function lireDossiersLocaux() {
  try { return JSON.parse(window.localStorage.getItem(CLE_DOSSIERS) || "{}") || {}; } catch (e) { return {}; }
}
export function enregistrerDossierLocal(poste, numero) {
  try { const d = lireDossiersLocaux(); d[poste] = { numero, date: new Date().toISOString() }; window.localStorage.setItem(CLE_DOSSIERS, JSON.stringify(d)); } catch (e) { /* navigation privée : tant pis */ }
}
export function oublierDossierLocal(poste) {
  try { const d = lireDossiersLocaux(); delete d[poste]; window.localStorage.setItem(CLE_DOSSIERS, JSON.stringify(d)); } catch (e) { /* rien */ }
}
