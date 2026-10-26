// lib/envoiPublic.js — Envoi des formulaires publics (candidature, plainte, avis, suggestion) vers /api/soumettre.
// Le serveur refuse un envoi s'il arrive moins de 2,5 s après l'ouverture du site (anti-robots) : on lui transmet
// donc le temps écoulé en MILLISECONDES depuis le chargement de la page.
import { auth } from "../firebase";
import { ajouterFile } from "./fileAttente.js";

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
  if (corps && corps.quota && !options.sansFile) {
    // Base de données saturée : l'envoi est gardé sur l'appareil et partira tout seul dès que possible
    ajouterFile({ kind: "public", type, data, connecte: !!options.connecte });
    try { window.dispatchEvent(new Event("gn-file-maj")); } catch (e) { /* rien */ }
    const err = new Error("Le site a atteint sa limite quotidienne de la base de données. Ton envoi est conservé sur cet appareil et sera transmis automatiquement dès que possible (garde ce navigateur et rouvre le site demain matin). Inutile de le refaire.");
    err.quota = true; err.enAttente = true;
    throw err;
  }
  if (corps && corps.quota) { const err = new Error("quota"); err.quota = true; throw err; }
  if (!reponse.ok || !corps || corps.ok !== true) {
    throw new Error((corps && corps.message) || "Envoi impossible pour le moment, réessaie dans un instant.");
  }
  return corps;
}
