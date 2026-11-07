// État-Major de la compagnie : remplace les anciens « État-Major » et « État-Major ».
// La fonction est stockée sur la fiche de l'agent dans le champ `etatMajor` (code : COC, COS, COA, DRH, SRH).
export const NOM_ETAT_MAJOR = "État-Major";

export const FONCTIONS_ETAT_MAJOR = [
  { code: "COC", label: "Commandant de Compagnie", court: "Commandant de Compagnie", commandement: true, couleur: "#B3261E" },
  { code: "COS", label: "Commandant en Second", court: "Commandant en Second", commandement: true, couleur: "#C2571A" },
  { code: "COA", label: "Commandant Adjoint", court: "Commandant Adjoint", commandement: true, couleur: "#B7791F" },
  { code: "DRH", label: "Chef Secrétaire en Compagnie", court: "Chef Secrétaire", commandement: false, couleur: "#2F6FDE" },
  { code: "SRH", label: "Secrétaire en Compagnie", court: "Secrétaire", commandement: false, couleur: "#4C8DF6" },
];

export const fonctionEtatMajor = (p) => FONCTIONS_ETAT_MAJOR.find((f) => f.code === (p && p.etatMajor)) || null;
// Membre de l'État-Major (COC, COS, COA, DRH, SRH) : demande et lit les comptes rendus, voit les rapports
export const estEtatMajor = (p) => !!fonctionEtatMajor(p);
// Droits de commandement (annonces, Vigipirate, habilitations, équipement, plaintes contre un gendarme) : COC, COS, COA
export const estCommandement = (p) => { const f = fonctionEtatMajor(p); return !!f && f.commandement; };
// Secrétariat / RH : DRH et SRH
export const estSecretariat = (p) => { const f = fonctionEtatMajor(p); return !!f && !f.commandement; };
