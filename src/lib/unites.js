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

// ── Configuration propre à chaque unité (collection « unites_config », un document par unité) ──
// Identifiant du document = nom de l'unité (le « / » est remplacé par « - » car interdit dans un identifiant).
export const idConfigUnite = (nom) => String(nom || "").trim().replace(/\//g, "-");
// fonctions : créées par le commandant de l'unité [{ id, nom, couleur }]
// rolesDiscord : rôles Discord donnés automatiquement à l'acceptation d'une candidature pour cette unité (réglés par les admins)
// rolesFonctions : { idFonction: idRoleDiscord } — rôle Discord lié à une fonction (réglé par les admins)
export const configUnite = (configs, nom) => {
  const c = (configs && configs[idConfigUnite(nom)]) || {};
  return {
    fonctions: Array.isArray(c.fonctions) ? c.fonctions : [],
    rolesDiscord: Array.isArray(c.rolesDiscord) ? c.rolesDiscord.map(String) : [],
    rolesFonctions: c.rolesFonctions && typeof c.rolesFonctions === "object" ? c.rolesFonctions : {},
  };
};
export const COULEURS_FONCTION = ["#2F7BFF", "#1F9D55", "#C2571A", "#B3261E", "#7A3FB5", "#0F8B8D", "#8A6D00", "#4A5568"];
// Fonctions d'un gendarme (identifiants), uniquement celles qui existent encore dans son unité
export const fonctionsDe = (p, cfg) => {
  const ids = Array.isArray(p && p.fonctionsUnite) ? p.fonctionsUnite : [];
  return (cfg.fonctions || []).filter((f) => ids.includes(f.id));
};
