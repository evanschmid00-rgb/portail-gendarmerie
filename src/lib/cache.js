// lib/cache.js — petit cache navigateur pour les listes qui changent rarement (économise les lectures Firestore)
const PREFIXE = "gn_cache_";
export function lireCache(cle, ttlMs) {
  try {
    const brut = window.localStorage.getItem(PREFIXE + cle);
    if (!brut) return null;
    const { t, v } = JSON.parse(brut);
    return Date.now() - t < ttlMs ? v : null;
  } catch (e) { return null; }
}
export function ecrireCache(cle, valeur) {
  try { window.localStorage.setItem(PREFIXE + cle, JSON.stringify({ t: Date.now(), v: valeur })); } catch (e) { /* stockage plein ou indisponible */ }
}
export function viderCache(...cles) {
  try { cles.forEach((c) => window.localStorage.removeItem(PREFIXE + c)); } catch (e) { /* stockage indisponible */ }
}
// Renvoie la liste en cache si elle est récente, sinon la charge (une seule lecture Firestore) et la garde
export async function avecCache(cle, ttlMs, charger) {
  const en = lireCache(cle, ttlMs);
  if (en) return en;
  const v = await charger();
  ecrireCache(cle, v);
  return v;
}

// Cache « de session » : survit au rafraîchissement de la page mais disparaît à la fermeture de l'onglet
// (pour les données internes : personnel, PV, plaintes… on ne les laisse pas durablement sur l'appareil).
const PREFIXE_S = "gn_sess_";
export function viderCacheSession() {
  try { Object.keys(window.sessionStorage).filter((k) => k.startsWith(PREFIXE_S)).forEach((k) => window.sessionStorage.removeItem(k)); } catch (e) { /* stockage indisponible */ }
}
// force = true : on recharge depuis Firestore et on remplace le cache
export async function avecCacheSession(cle, ttlMs, charger, force = false) {
  if (!force) {
    try {
      const brut = window.sessionStorage.getItem(PREFIXE_S + cle);
      if (brut) { const { t, v } = JSON.parse(brut); if (Date.now() - t < ttlMs) return v; }
    } catch (e) { /* cache illisible : on recharge */ }
  }
  const v = await charger();
  try { window.sessionStorage.setItem(PREFIXE_S + cle, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* plein : tant pis */ }
  return v;
}
