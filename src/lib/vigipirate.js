// lib/vigipirate.js — Plan Vigipirate (version jeu de rôle) : niveaux, textes par défaut, fusion avec ce que le commandement a saisi.
// Le niveau en vigueur est stocké dans Firestore : settings/vigipirate (lisible par tous, modifiable par le Corps de Commandement et les admins).

export const VIGIPIRATE_DOC = "vigipirate";

export const NIVEAUX_VIGIPIRATE = {
  1: {
    n: 1,
    nom: "Vigilance",
    c: "#C99A00",
    fond: "#FFF7D6",
    resume: "Posture permanente de sécurité : restez attentifs, signalez ce qui vous paraît anormal.",
    explication:
      "Le niveau « Vigilance » est la posture de sécurité de base, appliquée en permanence. La menace terroriste existe, mais aucune menace précise n'est identifiée sur le territoire. Les forces de l'ordre assurent une surveillance renforcée des lieux sensibles et des grands rassemblements, sans bouleverser la vie quotidienne.",
    consignesCivils: [
      "Restez attentif à votre environnement : objet ou bagage abandonné, comportement inhabituel.",
      "Signalez immédiatement toute situation suspecte à la gendarmerie, sans vous en approcher.",
      "Acceptez sans résistance les contrôles de sécurité à l'entrée des lieux publics.",
      "Ne laissez jamais un sac ou un colis sans surveillance.",
    ],
    consignesGendarmes: [
      "Patrouilles de surveillance régulières aux abords des lieux sensibles (administrations, commerces, lieux de rassemblement).",
      "Vigilance sur les véhicules et bagages abandonnés ; ne pas manipuler, sécuriser et rendre compte.",
      "Contrôles aléatoires et visibles aux abords des sites sensibles.",
      "Tout fait suspect est consigné en main courante avec heure, lieu et description.",
    ],
  },
  2: {
    n: 2,
    nom: "Sécurité renforcée – Risque attentat",
    c: "#E8830C",
    fond: "#FFEBD2",
    resume: "Menace caractérisée : contrôles renforcés, présence accrue des forces de l'ordre.",
    explication:
      "Le niveau « Sécurité renforcée – Risque attentat » s'applique lorsque la menace est caractérisée. Des mesures supplémentaires sont mises en place sur les sites sensibles et lors des rassemblements : contrôles d'accès, fouille des sacs, présence visible des forces de l'ordre, limitation de certains événements.",
    consignesCivils: [
      "Acceptez les fouilles de sacs et les contrôles à l'entrée des lieux publics et des événements.",
      "Évitez les attroupements inutiles et les zones signalées par les forces de l'ordre.",
      "Respectez immédiatement les consignes d'évacuation ou de déviation données par la gendarmerie.",
      "Signalez tout colis, véhicule ou comportement suspect, sans intervenir vous-même.",
    ],
    consignesGendarmes: [
      "Renforcement des patrouilles et présence visible aux abords des lieux de rassemblement.",
      "Contrôle systématique des accès aux sites sensibles et aux événements.",
      "Équipement de protection porté en service ; vérification du matériel avant chaque prise de poste.",
      "Liaison radio permanente avec le Corps de Commandement ; rendre compte de tout incident sans délai.",
      "Aucune patrouille isolée : intervention en équipage de deux minimum.",
    ],
  },
  3: {
    n: 3,
    nom: "Urgence attentat",
    c: "#D0182E",
    fond: "#FBDFE3",
    resume: "Menace maximale : suivez strictement les consignes des forces de l'ordre.",
    explication:
      "Le niveau « Urgence attentat » correspond à la menace la plus élevée : un attentat vient d'avoir lieu ou est jugé imminent. Les mesures sont maximales : périmètres de sécurité, contrôles renforcés, mobilisation de tous les effectifs, restrictions de circulation et de rassemblement. Les consignes des forces de l'ordre priment sur tout.",
    consignesCivils: [
      "Suivez à la lettre les consignes de la gendarmerie : confinement ou évacuation selon l'ordre donné.",
      "Éloignez-vous des zones concernées et n'entravez pas les accès des secours.",
      "Ne diffusez ni rumeur ni image de la scène ; informez-vous uniquement auprès de sources officielles.",
      "Libérez les lignes d'urgence : n'appelez que pour signaler un danger immédiat.",
    ],
    consignesGendarmes: [
      "Tous les effectifs sont mobilisables : rejoindre immédiatement le point de ralliement indiqué par le commandement.",
      "Mise en place et tenue des périmètres de sécurité ; contrôle strict de toutes les entrées et sorties.",
      "Présence visible et équipement complet pour tous les équipages.",
      "Compte rendu immédiat au Corps de Commandement de tout fait, même mineur.",
      "Discipline radio : messages courts, pas de bavardage sur les fréquences opérationnelles.",
    ],
  },
};

export const lignesDe = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);

// Fusionne ce qui est enregistré avec les textes par défaut du niveau (pas de document = niveau 1 « Vigilance »)
export function planEffectif(d) {
  const n = [1, 2, 3].includes(Number(d && d.niveau)) ? Number(d.niveau) : 1;
  const def = NIVEAUX_VIGIPIRATE[n];
  const ou = (saisi, defaut) => (typeof saisi === "string" && saisi.trim() ? saisi : defaut);
  return {
    niveau: n,
    def,
    message: (d && typeof d.message === "string" ? d.message.trim() : ""),
    explication: ou(d && d.explication, def.explication),
    consignesCivils: lignesDe(ou(d && d.consignesCivils, def.consignesCivils.join("\n"))),
    consignesGendarmes: lignesDe(ou(d && d.consignesGendarmes, def.consignesGendarmes.join("\n"))),
    updatedAt: (d && d.updatedAt) || "",
    updatedBy: (d && d.updatedBy) || "",
    defini: !!d,
  };
}
