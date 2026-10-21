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
