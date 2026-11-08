// Fonctions au sein d'une unité : Commandant d'unité et Adjoint (choisis par un admin sur la fiche de l'agent),
// et rôle « Opérateur » de l'unité (donné par le commandant ou l'adjoint à un gendarme de SON unité).
export const ROLES_UNITE = [
  { code: "Commandant", label: "Commandant d'unité", couleur: "#B3261E" },
  { code: "Adjoint", label: "Adjoint au commandant d'unité", couleur: "#C2571A" },
];
export const roleUnite = (p) => ROLES_UNITE.find((r) => r.code === (p && p.roleUnite)) || null;
// Commandant ou adjoint d'une unité (il faut que l'agent ait une unité)
export const estCmdUnite = (p) => !!roleUnite(p) && !!(p && p.unite);
export const estOperateurUnite = (p) => !!(p && p.operateurUnite);
