// lib/accesQuestionnaires.js — Qui peut accéder à un questionnaire interne (selon le grade et l'unité de l'agent).
// Champs d'un questionnaire :
//   gradeMode   : "tous" (défaut) | "min" (à partir d'un grade) | "liste" (certains grades seulement)
//   gradeMin    : grade minimum (mode "min")
//   gradesListe : grades autorisés (mode "liste")
//   unitesListe : unités autorisées (vide = toutes les unités)
import { GRADES } from "./constantes.js";

export const LIBELLES_MODE_GRADE = { tous: "Tous les grades", min: "À partir d'un grade minimum", liste: "Seulement certains grades" };

export function peutAcceder(q, agent) {
  if (!q || !agent) return false;
  if (agent.isAdmin) return true; // les admins ont toujours accès (pour tester)
  const mode = q.gradeMode || "tous";
  const rang = agent.gradeRank ?? GRADES.indexOf(agent.grade);
  if (mode === "min" && q.gradeMin) {
    const seuil = GRADES.indexOf(q.gradeMin);
    if (seuil >= 0 && !(rang >= seuil)) return false;
  }
  if (mode === "liste" && (q.gradesListe || []).length && !q.gradesListe.includes(agent.grade)) return false;
  if ((q.unitesListe || []).length && !q.unitesListe.includes(agent.unite)) return false;
  return true;
}

// Phrase lisible : « Grade minimum : Major · Unités : Brigade, GIGN »
export function resumeAcces(q) {
  const mode = q.gradeMode || "tous";
  const g = mode === "min" && q.gradeMin ? `à partir du grade ${q.gradeMin}`
    : mode === "liste" && (q.gradesListe || []).length ? `grades : ${q.gradesListe.join(", ")}`
    : "tous les grades";
  const u = (q.unitesListe || []).length ? `unités : ${q.unitesListe.join(", ")}` : "toutes les unités";
  return `${g} · ${u}`;
}
