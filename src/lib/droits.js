// lib/droits.js — Droits que l'on peut donner à un rôle (en plus d'« Administrateur »).
// Ils sont enregistrés dans les « qualifications » du rôle (lues aussi par les règles Firebase) : les libellés ci-dessous
// doivent rester identiques à ceux des règles Firestore.
import { estCommandement } from "./constantes.js";

export const DROITS = {
  VIGIPIRATE: "Modifier le plan Vigipirate",
  CONDITIONS: "Modifier les conditions d'admission",
  CODE_PENAL: "Gérer le code pénal",
  EQUIPEMENT: "Gérer l'équipement et la tenue",
  HAB_CREER: "Créer les habilitations",
  HAB_VALIDER: "Valider les habilitations",
};

// Catalogue affiché dans la page Rôles & Permissions (anciennes qualifications comprises)
export const CATEGORIES_DROITS = [
  {
    id: "site", titre: "Contenu du site", icone: "🧩",
    droits: [
      { nom: DROITS.VIGIPIRATE, aide: "Choisir le niveau Vigipirate affiché à tous, ses explications et ses consignes." },
      { nom: DROITS.CONDITIONS, aide: "Écrire les conditions d'admission montrées aux civils avant une candidature." },
      { nom: DROITS.CODE_PENAL, aide: "Ajouter, modifier et supprimer les infractions du code pénal." },
      { nom: DROITS.EQUIPEMENT, aide: "Gérer les fiches d'équipement et de tenue réglementaires (avec photos)." },
    ],
  },
  {
    id: "formation", titre: "Habilitations", icone: "🎓",
    droits: [
      { nom: DROITS.HAB_CREER, aide: "Créer et modifier les formations à valider (conduite, armes d'épaule…)." },
      { nom: DROITS.HAB_VALIDER, aide: "Changer le statut des agents sur chaque formation (validée, en cours, non validée)." },
      { nom: "Formateur", aide: "Qualification de formateur (affichée sur le profil)." },
    ],
  },
  {
    id: "terrain", titre: "Terrain et judiciaire", icone: "🚓",
    droits: [
      { nom: "OPJ", aide: "Officier de police judiciaire : vise les PV, gère casiers, plaintes et main courante." },
      { nom: "Brigade de Recherche", aide: "Traite les plaintes en ligne (avec les OPJ) : prise en charge, contact du plaignant, classement." },
      { nom: "Référent Déontologie", aide: "Reçoit, avec le Corps de Commandement, les plaintes déposées contre un gendarme." },
      { nom: "Négociateur", aide: "Qualification de négociateur (affichée sur le profil)." },
      { nom: "Assistant Secrétaire GN", aide: "Qualification d'assistant du secrétariat." },
      { nom: "Réserviste", aide: "Quota de service réduit (réserviste)." },
    ],
  },
  {
    id: "recrutement", titre: "Recrutement", icone: "📨",
    droits: [{ nom: "Recruteur", aide: "Voir et traiter les candidatures." }],
  },
];
export const TOUS_LES_DROITS = CATEGORIES_DROITS.flatMap((c) => c.droits.map((d) => d.nom));

export const aDroit = (p, droit) => !!p && (!!p.isAdmin || (p.qualifications || []).includes(droit));
// Les unités qui ont les droits du commandement gardent leurs accès habituels
export const peutModifierVigipirate = (p) => !!p && (!!p.isAdmin || estCommandement(p.unite) || aDroit(p, DROITS.VIGIPIRATE));
export const peutModifierConditions = (p) => aDroit(p, DROITS.CONDITIONS);
export const peutGererCodePenal = (p) => aDroit(p, DROITS.CODE_PENAL);
export const peutGererEquipement = (p) => !!p && (!!p.isAdmin || estCommandement(p.unite) || aDroit(p, DROITS.EQUIPEMENT));
export const peutCreerHabilitations = (p) => aDroit(p, DROITS.HAB_CREER);
export const peutValiderHabilitations = (p) => !!p && (!!p.isAdmin || estCommandement(p.unite) || aDroit(p, DROITS.HAB_VALIDER));
