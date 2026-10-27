// lib/profilLocal.js — Copie de SA PROPRE fiche, gardée sur l'appareil : si la base de données est saturée (quota du jour),
// le gendarme reste connecté au lieu d'être renvoyé à l'écran de connexion. Les droits réels restent contrôlés par Firestore.
const PREFIXE = "gn_profil_";
export function ecrireProfilLocal(p) {
  try { if (p && p.id) window.localStorage.setItem(PREFIXE + p.id, JSON.stringify({ t: Date.now(), p })); } catch (e) { /* stockage indisponible */ }
}
export function lireProfilLocal(uid) {
  try {
    const brut = window.localStorage.getItem(PREFIXE + uid);
    if (!brut) return null;
    const { t, p } = JSON.parse(brut);
    return p && p.id === uid && Date.now() - t < 30 * 86400000 ? p : null;
  } catch (e) { return null; }
}
