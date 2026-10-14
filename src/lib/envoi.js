// lib/envoi.js — envois publics (candidatures, plaintes, avis, suggestions) via le service protégé /api/soumettre
import { auth } from "../firebase";

// Renvoie { ok, ref, id } ou lève une erreur dont le message est affichable à la personne
export async function envoyerPublic(type, data, { connecte = false } = {}) {
  let idToken;
  try { if (connecte && auth.currentUser) idToken = await auth.currentUser.getIdToken(); } catch (e) { /* envoi anonyme */ }
  const piege = typeof document !== "undefined" ? document.querySelector('input[name="siteweb"]') : null;
  const ouvert = typeof window !== "undefined" && window.__formOuvert ? window.__formOuvert : Date.now();
  let r;
  try {
    r = await fetch("/api/soumettre", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, data, idToken, hp: piege ? piege.value : "", t: Date.now() - ouvert }) });
  } catch (e) { throw new Error("Connexion impossible : vérifie ta connexion internet et réessaie."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.message || "Envoi refusé, réessaie dans un instant.");
  return j;
}
