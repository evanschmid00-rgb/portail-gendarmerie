// lib/selection.js — Sélection des candidats : étapes, statuts, résumé public, exemples d'épreuves et de programmes.
// Étapes : épreuve écrite → tests psychotechniques → entretien devant le jury → visite médicale → enquête de moralité → décision (admis / liste d'attente / refusé).

export const ETAPES_SELECTION = [
  { id: "ecrit", label: "Épreuve écrite", court: "Écrit", icone: "📝", auto: true },
  { id: "psycho", label: "Tests psychotechniques", court: "Psycho", icone: "🧠", auto: true },
  { id: "entretien", label: "Entretien devant le jury", court: "Jury", icone: "🎙️" },
  { id: "medical", label: "Visite médicale", court: "Médical", icone: "🩺" },
  { id: "moralite", label: "Enquête de moralité", court: "Moralité", icone: "🕵️" },
];

export const FILIERES = { terrain: { label: "Terrain", couleur: "#123A7A" }, reserve: { label: "Réserve", couleur: "#7A3FB5" } };
export const filiereDe = (poste) => (/r[ée]serv/i.test(String(poste || "")) ? "reserve" : "terrain");

// Statuts : a-faire · ouvert · en-cours · reussi · echoue · apte · inapte · conforme · non-conforme · dispense
export const STATUTS_OK = ["reussi", "apte", "conforme", "dispense"];
export const STATUTS_KO = ["echoue", "inapte", "non-conforme"];
export const etapeOk = (s) => STATUTS_OK.includes(s);
export const etapeKo = (s) => STATUTS_KO.includes(s);
export const LIBELLES_STATUT = {
  "a-faire": "À faire", ouvert: "Ouverte", "en-cours": "En cours", reussi: "Réussi", echoue: "Échoué", apte: "Apte", inapte: "Inapte", conforme: "Conforme", "non-conforme": "Non conforme", dispense: "Dispensé",
};
export const couleurStatut = (s) => (etapeOk(s) ? "#1F9D55" : etapeKo(s) ? "#D62B45" : s === "ouvert" || s === "en-cours" ? "#E0A02B" : "#8FA6C8");

export const selectionVide = (c, poste) => ({
  numero: c.ref, candidatureId: c.id, poste: poste || c.poste || "", filiere: filiereDe(poste || c.poste), nom: c.displayName || "",
  etapes: Object.fromEntries(ETAPES_SELECTION.map((e) => [e.id, { statut: "a-faire" }])), decision: "en-cours",
  creeLe: new Date().toISOString(),
});

// Résumé public (visible par le candidat via son numéro de dossier) : aucun détail sensible, seulement les états
export const resumeSelection = (sel) => ({
  etapes: Object.fromEntries(ETAPES_SELECTION.map((e) => [e.id, ((sel.etapes || {})[e.id] || {}).statut || "a-faire"])),
  decision: sel.decision || "en-cours", filiere: sel.filiere || "terrain",
});

// Moyenne des notes /20 (écrit, psycho, entretien) disponibles
export const moyenneSelection = (sel) => {
  const n = ["ecrit", "psycho", "entretien"].map((k) => (sel.etapes || {})[k]).filter((e) => e && typeof e.note === "number").map((e) => e.note);
  return n.length ? Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 10) / 10 : null;
};
export const toutesValidees = (sel) => ETAPES_SELECTION.every((e) => etapeOk(((sel.etapes || {})[e.id] || {}).statut));
export const uneEliminee = (sel) => ETAPES_SELECTION.some((e) => etapeKo(((sel.etapes || {})[e.id] || {}).statut));

// Import de questions en texte : une question = un bloc ; "- choix" ; "* bonne réponse"
export function lireQuestionsTexte(texte) {
  const questions = [];
  String(texte || "").split(/\n\s*\n/).forEach((bloc) => {
    const lignes = bloc.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lignes.length < 3) return;
    const q = lignes[0].replace(/^\d+[.)]\s*/, "");
    const choix = []; let bonne = -1;
    lignes.slice(1).forEach((l) => {
      const m = /^([*-])\s*(.+)$/.exec(l);
      if (!m) return;
      if (m[1] === "*") bonne = choix.length;
      choix.push(m[2].trim());
    });
    if (choix.length >= 2 && bonne >= 0) questions.push({ q, choix, bonne });
  });
  return questions;
}

export const EPREUVES_EXEMPLES = [
  {
    titre: "Épreuve écrite — culture générale et expression", type: "ecrit", filieres: ["terrain", "reserve"], dureeMin: 15, nbQuestions: 8, seuil: 10, actif: true,
    consigne: "Réponds seul(e), sans aide. Une seule réponse possible par question.",
    questions: [
      { q: "De quel ministère dépend la Gendarmerie nationale ?", choix: ["Ministère de l'Intérieur", "Ministère des Armées", "Ministère de la Justice", "Ministère des Transports"], bonne: 0 },
      { q: "Quel numéro d'urgence appeler pour joindre la gendarmerie ou la police ?", choix: ["17", "15", "18", "112 uniquement"], bonne: 0 },
      { q: "Quelle est la durée initiale d'une garde à vue ?", choix: ["12 heures", "24 heures", "48 heures", "72 heures"], bonne: 1 },
      { q: "Que signifie « OPJ » ?", choix: ["Officier de police judiciaire", "Opérateur de police judiciaire", "Officier de proximité juridique", "Officier de permanence judiciaire"], bonne: 0 },
      { q: "Quelle phrase est correctement orthographiée ?", choix: ["Les gendarmes ont dressé les procès-verbaux.", "Les gendarmes ont dressés les procès-verbaux.", "Les gendarmes on dressé les procès-verbaux.", "Les gendarme ont dressé les procès-verbaux."], bonne: 0 },
      { q: "Une patrouille parcourt 90 km en 1 h 30. Quelle est sa vitesse moyenne ?", choix: ["50 km/h", "60 km/h", "75 km/h", "90 km/h"], bonne: 1 },
      { q: "Le flagrant délit désigne :", choix: ["Une infraction en train de se commettre ou qui vient de se commettre", "Une infraction prescrite", "Une infraction commise il y a plus d'un an", "Une simple contravention"], bonne: 0 },
      { q: "Un gendarme qui constate une infraction doit :", choix: ["Dresser un procès-verbal selon la procédure", "L'ignorer si l'auteur est connu", "Attendre l'ordre du maire", "Laisser l'auteur décider"], bonne: 0 },
    ],
  },
  {
    titre: "Tests psychotechniques — logique et jugement", type: "psycho", filieres: ["terrain", "reserve"], dureeMin: 15, nbQuestions: 8, seuil: 10, actif: true,
    consigne: "Raisonnement logique et mises en situation. Une seule réponse possible.",
    questions: [
      { q: "Suite logique : 2, 4, 8, 16, ?", choix: ["24", "30", "32", "64"], bonne: 2 },
      { q: "Quel est l'intrus ?", choix: ["Pomme", "Poire", "Carotte", "Banane"], bonne: 2 },
      { q: "Tous les gendarmes sont des militaires. Paul est gendarme. Donc :", choix: ["Paul est militaire", "Paul n'est pas militaire", "Paul est officier", "On ne peut pas savoir"], bonne: 0 },
      { q: "Suite logique : A, C, E, G, ?", choix: ["H", "I", "J", "K"], bonne: 1 },
      { q: "Lors d'une intervention, un supérieur donne un ordre qui vous semble dangereux. Vous :", choix: ["Exécutez sans rien dire", "Exprimez calmement vos réserves, puis suivez la décision finale si elle est légale", "Quittez les lieux", "Agissez à votre façon sans prévenir"], bonne: 1 },
      { q: "Combien font 15 % de 200 ?", choix: ["15", "20", "30", "45"], bonne: 2 },
      { q: "Un témoin agité vous insulte. Quelle attitude adopter ?", choix: ["Répondre sur le même ton", "Rester calme, poli et ferme", "L'ignorer complètement", "Le menacer d'une amende"], bonne: 1 },
      { q: "5 agents contrôlent 20 véhicules en 1 heure. Combien de véhicules contrôlent 10 agents au même rythme ?", choix: ["30", "40", "50", "60"], bonne: 1 },
    ],
  },
];

// Programmes de formation proposés par défaut (modifiables dans le site) : terrain et réserve, un par poste
const mod = (id, titre, heures, type = "cours", obligatoire = true) => ({ id, titre, heures, type, obligatoire });
export const PROGRAMMES_EXEMPLES = [
  { id: "gav-terrain", poste: "GAV", filiere: "terrain", titre: "GAV — formation terrain", moyenneMin: 10, jours: 5,
    modules: [mod("m1", "Accueil, règlement intérieur et déontologie", 1), mod("m2", "Prise de service et radio", 1, "pratique"), mod("m3", "Les fichiers : TAJ, FPR, CJN", 1), mod("m4", "Initiation à la procédure et au PVe", 2), mod("m5", "Mise en situation : patrouille encadrée", 2, "pratique"), mod("m6", "Évaluation finale", 1, "eval")] },
  { id: "gav-reserve", poste: "GAV", filiere: "reserve", titre: "GAV — formation réserve", moyenneMin: 10, jours: 3,
    modules: [mod("m1", "Accueil, règlement intérieur et déontologie", 1), mod("m2", "Prise de service et radio", 1, "pratique"), mod("m3", "Missions de la réserve et renfort", 1), mod("m4", "Évaluation finale", 1, "eval")] },
  { id: "sog-terrain", poste: "SOG", filiere: "terrain", titre: "SOG — formation terrain", moyenneMin: 12, jours: 7,
    modules: [mod("m1", "Statut, déontologie et discipline", 1), mod("m2", "Procédure pénale : flagrance, garde à vue, droits", 3), mod("m3", "Rédaction des PVe et des comptes rendus", 2), mod("m4", "Fichiers (TAJ, FPR, CJN) et casier", 1), mod("m5", "Intervention, usage de la force et armement", 2, "pratique"), mod("m6", "Stage en unité encadré", 3, "pratique"), mod("m7", "Évaluation finale", 1, "eval")] },
  { id: "sog-reserve", poste: "SOG", filiere: "reserve", titre: "SOG — formation réserve", moyenneMin: 11, jours: 4,
    modules: [mod("m1", "Statut, déontologie et discipline", 1), mod("m2", "Procédure pénale essentielle", 2), mod("m3", "Rédaction des PVe", 1), mod("m4", "Stage en unité encadré", 2, "pratique"), mod("m5", "Évaluation finale", 1, "eval")] },
  { id: "og-terrain", poste: "Officier", filiere: "terrain", titre: "Officier — formation terrain", moyenneMin: 13, jours: 10,
    modules: [mod("m1", "Commandement et responsabilité", 2), mod("m2", "Droit pénal et procédure approfondis", 3), mod("m3", "Conduite d'une enquête et direction d'un service", 3), mod("m4", "Gestion d'une unité et des ressources humaines", 2), mod("m5", "Gestion de crise et Plan Vigipirate", 2), mod("m6", "Stage de commandement encadré", 4, "pratique"), mod("m7", "Évaluation finale devant le jury", 1, "eval")] },
  { id: "og-reserve", poste: "Officier", filiere: "reserve", titre: "Officier — formation réserve", moyenneMin: 12, jours: 5,
    modules: [mod("m1", "Commandement et responsabilité", 2), mod("m2", "Droit pénal et procédure essentiels", 2), mod("m3", "Emploi de la réserve et coordination", 2), mod("m4", "Stage de commandement encadré", 2, "pratique"), mod("m5", "Évaluation finale", 1, "eval")] },
];
export const programmePourPoste = (programmes, poste, filiere) => {
  const p = String(poste || "").toLowerCase();
  const cle = /off|og\b/.test(p) ? "officier" : /sog/.test(p) ? "sog" : /gav/.test(p) ? "gav" : "";
  return (programmes || []).find((x) => String(x.poste || "").toLowerCase().startsWith(cle || "~") && (x.filiere || "terrain") === filiere) || null;
};
