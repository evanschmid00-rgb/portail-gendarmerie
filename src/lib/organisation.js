// lib/organisation.js — Organisation de la brigade (unités, branches, période d'essai, parrainage).
// Tout ce qui se règle d'un coup d'œil est ici : durée d'essai, grade minimum d'un parrain, liste des unités spécialisées.

export const DUREE_ESSAI_JOURS = 5; // durée de la période d'essai d'une recrue
export const PROLONGATION_ESSAI_JOURS = 5; // durée d'une prolongation
export const GRADE_PARRAIN_MINI = "Adjudant"; // un parrain a un grade STRICTEMENT supérieur à celui-ci

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Unités spécialisées : confiées au Colonel des unités spécialisées (les autres sont des unités de patrouille)
export const UNITES_SPECIALISEES = [
  { nom: "PSIG", motif: /psig|peloton de surveillance/ },
  { nom: "GIGN", motif: /gign/ },
  { nom: "Brigade de Recherche", motif: /recherche/ },
  { nom: "BMO", motif: /\bbmo\b|motorisee/ },
];
export const estUniteSpecialisee = (unite) => UNITES_SPECIALISEES.some((u) => u.motif.test(norm(unite)));
export const uniteCanonique = (unite) => (UNITES_SPECIALISEES.find((u) => u.motif.test(norm(unite))) || {}).nom || "";

// Unités du commandement (ne fournissent pas de parrains de terrain)
const MOTIF_COMMANDEMENT = /commandement|encadrement|dggn|iggn|etat-major|direction/;
export const estUniteCommandement = (unite) => MOTIF_COMMANDEMENT.test(norm(unite));

export const estColonel = (p) => /^colonel/.test(norm(p && p.grade));
// Le Colonel des unités spécialisées : sa fiche le dit (fonction / sous-fonction / unité)
export const estColonelSpecialise = (p) => estColonel(p) && /specialis|gign|psig|recherche|bmo/.test(norm(`${p.fonction || ""} ${p.sousFonction || ""} ${p.unite || ""}`));

export const rangDe = (p, grades = []) => (Number.isFinite(Number(p && p.gradeRank)) && p.gradeRank !== undefined && p.gradeRank !== null ? Number(p.gradeRank) : grades.indexOf(p && p.grade));
export const rangMiniParrain = (grades = []) => grades.findIndex((g) => norm(g) === norm(GRADE_PARRAIN_MINI));

const enEssai = (p) => p && (p.essaiStatut === "En cours" || p.essaiStatut === "Prolongée");

// Parrains possibles : membres de la brigade (unités de patrouille d'abord), grade supérieur à Adjudant, pas eux-mêmes en essai
export function parrainsPossibles(personnel = [], grades = [], exclure = "") {
  const mini = rangMiniParrain(grades);
  if (mini < 0) return [];
  const hauts = personnel.filter((p) => p && p.matricule && p.matricule !== exclure && !enEssai(p) && rangDe(p, grades) > mini);
  const brigade = hauts.filter((p) => /brigade territoriale/.test(norm(p.unite)));
  if (brigade.length) return brigade;
  const patrouille = hauts.filter((p) => !estUniteSpecialisee(p.unite) && !estUniteCommandement(p.unite));
  return patrouille.length ? patrouille : hauts;
}
export function tirerParrain(personnel, grades, exclure = "") {
  const l = parrainsPossibles(personnel, grades, exclure);
  return l.length ? l[Math.floor(Math.random() * l.length)] : null;
}
export const champsParrain = (p) => (p ? { parrainMatricule: p.matricule, parrainNom: `${p.grade} ${p.prenom} ${p.nom}` } : { parrainMatricule: "", parrainNom: "" });
export const finEssai = () => new Date(Date.now() + DUREE_ESSAI_JOURS * 86400000).toISOString();
