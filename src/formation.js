// lib/formation.js — Formation PULSAR : statuts (« rôles »), blocages, délais.
// Champs ajoutés sur le document personnel :
//   statutFormation : "non-effectuee" | "effectuee"  (absent = agent déjà en poste, jamais bloqué)
//   enEntretien     : true quand l'agent est « En entretien de recrutement » (les fiches lui sont alors masquées)
//   formationDebut  : date ISO de début de la formation (sert au calcul du délai)

export const ROLE_NON_EFFECTUEE = "Formation PULSAR non-effectuée";
export const ROLE_EFFECTUEE = "Formation PULSAR effectuée";
export const ROLE_ENTRETIEN = "En entretien de recrutement";
export const DELAI_DEFAUT_JOURS = 7;

// Pages verrouillées tant que la formation n'est pas validée (casiers, PV, service, main courante…)
export const SECTIONS_BLOQUEES = [
  "mon-service", "services-equipe", "main-courante", "pv", "casier", "dossiers-opj",
  "comptes-rendus", "rapports-internes", "postuler-sog", "postuler-officier",
  "admin-plaintes", "plaintes-gendarmes",
];

export const estEnFormation = (p) => !!p && p.statutFormation === "non-effectuee";
export const estBloque = (p) => !!p && !p.isAdmin && p.statutFormation === "non-effectuee";
export const estEnEntretien = (p) => !!p && p.enEntretien === true;
export const peutVoirFiches = (p) => !!p && (!!p.isAdmin || !estEnEntretien(p));

// Étiquettes de « rôle » affichées pour une personne
export function rolesFormation(p) {
  const r = [];
  if (p && p.statutFormation === "non-effectuee") r.push(ROLE_NON_EFFECTUEE);
  if (p && p.statutFormation === "effectuee") r.push(ROLE_EFFECTUEE);
  if (estEnEntretien(p)) r.push(ROLE_ENTRETIEN);
  return r;
}

// Jours restants avant la fin du délai (négatif = délai dépassé) ; null si inconnu
export function joursRestants(p, delaiJours) {
  if (!p || !p.formationDebut) return null;
  const fin = new Date(p.formationDebut).getTime() + Number(delaiJours || DELAI_DEFAUT_JOURS) * 86400000;
  if (isNaN(fin)) return null;
  return Math.ceil((fin - Date.now()) / 86400000);
}
export const dateFinDelai = (p, delaiJours) => {
  const t = new Date(p.formationDebut).getTime() + Number(delaiJours || DELAI_DEFAUT_JOURS) * 86400000;
  return isNaN(t) ? "" : new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
};
