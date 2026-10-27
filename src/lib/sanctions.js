// lib/sanctions.js — Règles communes aux sanctions : à qui elles s'appliquent, et si elles sont encore actives.
// Une sanction est rattachée à la PERSONNE (cibleUid). Les anciennes sanctions (sans cibleUid) sont rattachées par matricule,
// mais seulement si le compte existait déjà quand la sanction a été émise (un matricule réutilisé ne reprend pas les sanctions d'un ancien agent).

export function sanctionConcerne(s, p) {
  if (!s || !p) return false;
  if (s.cibleUid) return s.cibleUid === p.id;
  if (!s.matricule || s.matricule !== p.matricule) return false;
  if (p.creeLe && s.dateDebut && String(p.creeLe) > String(s.dateDebut)) return false;
  return true;
}
export const sanctionEnCours = (s, maintenant = new Date()) => !!s && !s.levee && new Date(s.dateFin) > maintenant;
export const sanctionsActivesDe = (sanctions, p, maintenant = new Date()) => (sanctions || []).filter((s) => sanctionConcerne(s, p) && sanctionEnCours(s, maintenant));
