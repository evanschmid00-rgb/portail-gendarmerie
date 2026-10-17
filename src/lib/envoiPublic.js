// lib/envoiPublic.js — Envoi des formulaires publics (candidature, plainte, avis, suggestion) vers /api/soumettre.
// Le serveur refuse un envoi s'il arrive moins de 2,5 s après l'ouverture du site (anti-robots) : on lui transmet
// donc le temps écoulé en MILLISECONDES depuis le chargement de la page.
import { auth } from "../firebase";

const DEBUT_PAGE = Date.now();

// Renvoie la réponse du serveur ({ ok, ref, id }) ou lève une Error dont le message est affiché à la personne.
export async function envoyerPublic(type, data, options = {}) {
  let idToken;
  if (options.connecte && auth.currentUser) {
    try { idToken = await auth.currentUser.getIdToken(); } catch (e) { idToken = undefined; }
  }
  let reponse;
  try {
    reponse = await fetch("/api/soumettre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data, idToken, hp: "", t: Date.now() - DEBUT_PAGE }),
    });
  } catch (e) {
    throw new Error("Connexion impossible : vérifie ta connexion internet et réessaie.");
  }
  let corps = null;
  try { corps = await reponse.json(); } catch (e) { /* réponse non JSON */ }
  if (!reponse.ok || !corps || corps.ok !== true) {
    throw new Error((corps && corps.message) || "Envoi impossible pour le moment, réessaie dans un instant.");
  }
  return corps;
}
