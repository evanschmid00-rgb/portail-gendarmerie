// lib/liaisonLocale.js — garde sur l'appareil l'avancée des liaisons (Discord, Roblox) et la page en cours,
// pour qu'un rechargement de la page (fréquent sur mobile quand on part chercher le code sur Discord) ne fasse rien perdre.
const P = "gn_liaison_";

export function lire(cle) {
  try { const v = JSON.parse(window.localStorage.getItem(P + cle) || "null"); return v && typeof v === "object" ? v : null; } catch (e) { return null; }
}
export function ecrire(cle, patch) {
  try { window.localStorage.setItem(P + cle, JSON.stringify({ ...(lire(cle) || {}), ...patch })); } catch (e) { /* stockage indisponible */ }
}
export function effacer(cle) {
  try { window.localStorage.removeItem(P + cle); } catch (e) { /* rien */ }
}
// Compte Discord déjà validé et encore valable : { preuve, pseudo, exp } ou null
export function preuveValide(usage) {
  const s = lire(usage);
  return s && s.preuve && s.exp > Date.now() + 60000 ? { preuve: s.preuve, pseudo: s.pseudo || "", exp: s.exp } : null;
}
// Code déjà demandé il y a moins de 9 minutes (il est valable 10 minutes) : { defi, pseudo } ou null
export function defiValide(usage) {
  const s = lire(usage);
  return s && s.defi && Date.now() - (s.tDefi || 0) < 9 * 60000 ? { defi: s.defi, pseudo: s.pseudo || "" } : null;
}
// Compte Roblox vérifié il y a moins de 6 h
export function robloxMemorise(cle = "roblox") {
  const s = lire(cle);
  return s && s.compte && Date.now() - (s.t || 0) < 6 * 3600000 ? s.compte : null;
}
export function memoriserRoblox(compte, cle = "roblox") {
  if (compte) ecrire(cle, { compte, t: Date.now() }); else effacer(cle);
}
