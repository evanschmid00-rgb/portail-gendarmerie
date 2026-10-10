// lib/utils.js — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { useEffect, useState } from "react";
import { ALPHABET_DOSSIER } from "./dossier.js";

export function newId() { return Math.random().toString(36).slice(2, 10); }

/* ---------- Prise / fin de service ---------- */

export function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}
export function debutSemaine(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // la semaine commence le lundi
  return x;
}
export function cleJour(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export function dateRefService(s) { return s.type === "ajustement" ? s.date : s.debut; }
export function dureeService(s, now) {
  if (s.type === "ajustement") return (s.minutes || 0) * 60000;
  const fin = s.fin ? new Date(s.fin).getTime() : now;
  return Math.max(0, fin - new Date(s.debut).getTime());
}
export function fmtDuree(ms) {
  const neg = ms < 0;
  const m = Math.round(Math.abs(ms) / 60000);
  return `${neg ? "−" : ""}${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}
export function fmtHeure(iso) { return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }
export function fmtJourCourt(d) { return new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" }); }

export function statsService(list, now) {
  const lundi = debutSemaine(now);
  const cleAuj = cleJour(now);
  const parJour = [];
  for (let i = 0; i < 7; i++) { const d = new Date(lundi); d.setDate(lundi.getDate() + i); parJour.push({ date: d, cle: cleJour(d), ms: 0 }); }
  const parSemaine = [];
  for (let i = 0; i < 6; i++) { const d = new Date(lundi); d.setDate(lundi.getDate() - 7 * i); parSemaine.push({ date: d, cle: d.getTime(), ms: 0 }); }
  let total = 0, jour = 0, semaine = 0;
  list.forEach((s) => {
    const ref = dateRefService(s);
    if (!ref) return;
    const ms = dureeService(s, now);
    const sem = debutSemaine(ref).getTime();
    total += ms;
    if (cleJour(ref) === cleAuj) jour += ms;
    if (sem === lundi.getTime()) semaine += ms;
    const pj = parJour.find((x) => x.cle === cleJour(ref)); if (pj) pj.ms += ms;
    const ps = parSemaine.find((x) => x.cle === sem); if (ps) ps.ms += ms;
  });
  return { total, jour, semaine, parJour, parSemaine };
}

export function grouperParMatricule(services) {
  const m = {};
  services.forEach((s) => { (m[s.matricule] = m[s.matricule] || []).push(s); });
  return m;
}

export const triDate = (a, b) => new Date(dateRefService(b)) - new Date(dateRefService(a));

/* ---------- Quota de service et absences ---------- */

export const QUOTA_DEFAUT = { quotaHebdoMin: 300, quotaReserveMin: 180, quotaDebut: "", quotaAuto: false };
export const estReserviste = (p) => !!p && Array.isArray(p.qualifications) && p.qualifications.includes("Réserviste");
export const quotaMsDe = (p, q) => (estReserviste(p) ? q.quotaReserveMin : q.quotaHebdoMin) * 60000;
export const absenceActive = (a, jour) => a.annulee !== true && a.debut <= jour && a.fin >= jour;
export const absenceSemaine = (a, lundi) => {
  const dim = new Date(lundi); dim.setDate(dim.getDate() + 6);
  return a.annulee !== true && a.debut <= cleJour(dim) && a.fin >= cleJour(lundi);
};
export const fmtJourFR = (s) => new Date(`${s}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
export function lundiProchainStr() { const d = debutSemaine(new Date()); d.setDate(d.getDate() + 7); return cleJour(d); }

/* ====================== PROCÈS-VERBAUX ====================== */

// --- Nombres et dates en toutes lettres (formule d'ouverture d'un PV) ---
const U_FR = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
function dizainesFR(n) {
  if (n < 20) return U_FR[n];
  const d = Math.floor(n / 10), u = n % 10;
  if (d === 7) return "soixante" + (u === 1 ? " et " : "-") + U_FR[10 + u];
  if (d === 9) return "quatre-vingt-" + U_FR[10 + u];
  const noms = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante", 8: "quatre-vingt" };
  if (u === 0) return d === 8 ? "quatre-vingts" : noms[d];
  if (u === 1 && d !== 8) return noms[d] + " et un";
  return noms[d] + "-" + U_FR[u];
}
function centainesFR(n) {
  if (n < 100) return dizainesFR(n);
  const c = Math.floor(n / 100), r = n % 100;
  if (r === 0) return c === 1 ? "cent" : U_FR[c] + " cents";
  return (c === 1 ? "cent" : U_FR[c] + " cent") + " " + dizainesFR(r);
}
function nombreEnLettres(n) {
  if (n === 0) return "zéro";
  if (n < 1000) return centainesFR(n);
  const m = Math.floor(n / 1000), r = n % 1000;
  const mille = m === 1 ? "mille" : centainesFR(m) + " mille";
  return r ? mille + " " + centainesFR(r) : mille;
}
const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function dateEnLettres(d) {
  return { an: nombreEnLettres(d.getFullYear()), jour: d.getDate() === 1 ? "premier" : nombreEnLettres(d.getDate()), mois: MOIS_FR[d.getMonth()] };
}
export function heureEnLettres(h, m) {
  let t = nombreEnLettres(h);
  if (t === "un" || t.endsWith(" un")) t = t.slice(0, -2) + "une";
  const heures = `${t} heure${h > 1 ? "s" : ""}`;
  return m ? `${heures} ${nombreEnLettres(m)}` : heures;
}
export const QUALITE_LONGUE = { OPJ: "Officier de Police Judiciaire", APJ: "Agent de Police Judiciaire", APJA: "Agent de Police Judiciaire Adjoint" };
export const ROMAIN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
export const dateFR = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR") : "");

/* ---------- Grades & unités modifiables par l'admin ---------- */

/* ---------- Liens utiles : Discord (public) et radio Zello (gendarmes) ---------- */

// Accepte uniquement les liens https (et zello:// pour l'application Zello)
export function lienValide(url, autoriserZello = false) {
  try {
    const u = new URL(String(url || "").trim());
    if (u.protocol === "https:") return u.href;
    if (autoriserZello && u.protocol === "zello:") return u.href;
    return "";
  } catch (e) { return ""; }
}
export const refAleatoire = (prefixe) => {
  const tab = new Uint32Array(5);
  window.crypto.getRandomValues(tab);
  return `${prefixe}-${new Date().getFullYear()}-${Array.from(tab, (v) => ALPHABET_DOSSIER[v % 32]).join("")}`;
};
export const dateCourteFR = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");
export function dateLongue(iso) {
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }); } catch (e) { return ""; }
}
