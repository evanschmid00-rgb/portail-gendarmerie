// lib/compteurLectures.js — Compte (sur cet appareil) les documents Firestore lus aujourd'hui.
// C'est une estimation : Firebase compte les lectures de TOUS les appareils (limite gratuite : 50 000 par jour).
const cle = () => `gn-lectures:${new Date().toISOString().slice(0, 10)}`;
export function compterLectures(n) {
  try { window.localStorage.setItem(cle(), String(lecturesDuJour() + Math.max(1, Number(n) || 0))); } catch (e) { /* rien */ }
}
export function lecturesDuJour() {
  try { return Number(window.localStorage.getItem(cle())) || 0; } catch (e) { return 0; }
}
export const LIMITE_LECTURES = 50000;
