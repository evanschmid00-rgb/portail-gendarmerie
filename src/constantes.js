// lib/constantes.js — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)


export const FONT_BASE = "'Inter', 'Segoe UI', system-ui, sans-serif";
export const FONT_TITRE = "'Barlow Semi Condensed', 'Inter', sans-serif";

/* ---------- Données de référence ---------- */

export const GRADES = [
  "Gendarme Adjoint Volontaire 2ème Classe",
  "Gendarme Adjoint Volontaire 1ère Classe",
  "Brigadier",
  "Brigadier-chef",
  "Maréchal des Logis",
  "Gendarme Sous Contrat",
  "Gendarme de Carrière",
  "Maréchal des Logis-Chef",
  "Adjudant",
  "Adjudant-Chef",
  "Major",
  "Sous-Lieutenant",
  "Lieutenant",
  "Capitaine",
  "Commandant",
  "Lieutenant-Colonel",
  "Colonel",
  "Général de Brigade",
  "Général de Division",
  "Général de Corps d'Armée",
  "Général d'Armée",
];

export const QUALIFICATIONS = [
  "Formateur",
  "Recruteur",
  "OPJ",
  "Négociateur",
  "Assistant Secrétaire GN",
  "Réserviste",
];

export const GRADES_TAGS = ["GA2", "GA1", "BRI", "BRC", "MDL", "GSC", "GNC", "MDC", "ADJ", "ADC", "MAJ", "SLT", "LTN", "CNE", "CDT", "LCL", "COL", "", "", "", ""];
export const REGLAGES = { seuilOfficier: "Sous-Lieutenant", seuilSog: "Maréchal des Logis", seuilCandOfficier: "Major", seuilHaut: "Commandant" };
export let OFFICIER_INDEX = 0, SOG_MIN_INDEX = 0, OFFICIER_CANDIDATURE_MIN_INDEX = 0, DISCIPLINE_MIN_INDEX = 0;
function recalculerSeuils() {
  const i = (n) => { const x = GRADES.indexOf(n); return x >= 0 ? x : GRADES.length; };
  OFFICIER_INDEX = i(REGLAGES.seuilOfficier);
  SOG_MIN_INDEX = i(REGLAGES.seuilSog);
  OFFICIER_CANDIDATURE_MIN_INDEX = i(REGLAGES.seuilCandOfficier);
  DISCIPLINE_MIN_INDEX = i(REGLAGES.seuilHaut);
}
recalculerSeuils();

export const UNITE_CMD = "Corps de Commandement";
export const UNITE_ENC = "Corps d'Encadrement";
export const UNITE_ALIAS = { DGGN: UNITE_CMD, IGGN: UNITE_ENC }; // anciens noms
export const normUnite = (u) => UNITE_ALIAS[u] || u;
export const estCorps = (u) => normUnite(u) === UNITE_CMD || normUnite(u) === UNITE_ENC;
export const estCommandement = (u) => normUnite(u) === UNITE_CMD;
export const UNITES = [
  "Brigade territoriale",
  "CORG",
  "Section de recherche",
  "Formation & Recrutement",
  UNITE_CMD,
  UNITE_ENC,
  "OPJ",
];
export const UNITES_PROTEGEES = [UNITE_CMD, UNITE_ENC];
const UNITE_ORDER = {};
function recalculerUnites() {
  Object.keys(UNITE_ORDER).forEach((k) => delete UNITE_ORDER[k]);
  UNITES.forEach((u, i) => { UNITE_ORDER[u] = i; });
}
recalculerUnites();

// Applique les réglages enregistrés (settings/general) : on modifie les tableaux en place pour que tout le site les voie
export function appliquerReglages(d) {
  if (Array.isArray(d.grades) && d.grades.length) {
    GRADES.splice(0, GRADES.length, ...d.grades);
    GRADES_TAGS.splice(0, GRADES_TAGS.length, ...d.grades.map((_, i) => (Array.isArray(d.gradesTags) && d.gradesTags[i]) || ""));
  }
  if (Array.isArray(d.unites) && d.unites.length) {
    const u = Array.from(new Set(d.unites.map(normUnite)));
    UNITES_PROTEGEES.forEach((n) => { if (!u.includes(n)) u.push(n); });
    UNITES.splice(0, UNITES.length, ...u);
  }
  ["seuilOfficier", "seuilSog", "seuilCandOfficier", "seuilHaut"].forEach((k) => { if (typeof d[k] === "string" && d[k]) REGLAGES[k] = d[k]; });
  recalculerSeuils();
  recalculerUnites();
}

// Base initiale du code pénal — importable une fois depuis l'admin, puis modifiable/complétable sur le site.
const CODE_PENAL_BASE = [
  { type: "Contravention", classe: "Classe 1", nom: "Stationnement gênant", article: "art. R417-10 C. route", amende: 1000, tempsGav: "" },
  { type: "Contravention", classe: "Classe 1", nom: "Stationnement sur trottoir", article: "art. R417-11 C. route", amende: 1000, tempsGav: "" },
  { type: "Contravention", classe: "Classe 1", nom: "Klaxon abusif / bruit inutile", article: "art. R416-1 C. route", amende: 1000, tempsGav: "" },
  { type: "Contravention", classe: "Classe 1", nom: "Défaut de plaque d'immatriculation lisible", article: "art. R317-8 C. route", amende: 1000, tempsGav: "" },
  { type: "Contravention", classe: "Classe 2", nom: "Circulation sans éclairage la nuit", article: "art. R416-14 C. route", amende: 1200, tempsGav: "" },
  { type: "Contravention", classe: "Classe 2", nom: "Non-respect d'un cédez-le-passage", article: "art. R415-7 C. route", amende: 1200, tempsGav: "" },
  { type: "Contravention", classe: "Classe 3", nom: "Défaut de présentation du permis", article: "art. R221-3 C. route", amende: 1400, tempsGav: "" },
  { type: "Contravention", classe: "Classe 3", nom: "Non-port du casque moto/scooter", article: "art. R431-1 C. route", amende: 1400, tempsGav: "" },
  { type: "Contravention", classe: "Classe 3", nom: "Stationnement devant caserne, hôpital, bouche d'incendie", article: "art. R417-10 C. route", amende: 1400, tempsGav: "" },
  { type: "Contravention", classe: "Classe 3", nom: "Défaut de présentation de la carte grise", article: "art. R322-4 C. route", amende: 1400, tempsGav: "" },
  { type: "Contravention", classe: "Classe 4", nom: "Excès de vitesse, moins de 20 km/h", article: "art. R413-14 C. route", amende: 1600, tempsGav: "" },
  { type: "Contravention", classe: "Classe 4", nom: "Refus de priorité", article: "art. R415-5 C. route", amende: 1600, tempsGav: "" },
  { type: "Contravention", classe: "Classe 4", nom: "Circulation en sens interdit", article: "art. R412-28 C. route", amende: 1600, tempsGav: "" },
  { type: "Contravention", classe: "Classe 4", nom: "Dépassement dangereux", article: "art. R414-4 C. route", amende: 1600, tempsGav: "" },
  { type: "Contravention", classe: "Classe 5", nom: "Excès de vitesse, 20 à 30 km/h", article: "art. R413-14 C. route", amende: 1800, tempsGav: "" },
  { type: "Contravention", classe: "Classe 5", nom: "Défaut d'assurance", article: "art. L324-2 C. route", amende: 1800, tempsGav: "" },
  { type: "Contravention", classe: "Classe 5", nom: "Conduite sans permis, 1ère fois", article: "art. L221-2 C. route", amende: 1800, tempsGav: "" },
  { type: "Contravention", classe: "Classe 5", nom: "Franchissement d'un feu rouge", article: "art. R412-30 C. route", amende: 1800, tempsGav: "" },
  { type: "Contravention", classe: "Classe 5", nom: "Circulation à contresens sur voie rapide", article: "", amende: 1800, tempsGav: "" },

  { type: "Délit", classe: "", nom: "Usage de stupéfiants", article: "art. L3421-1 CSP", amende: 2000, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Outrage à agent", article: "art. 433-5", amende: 2000, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Rébellion", article: "art. 433-6", amende: 2200, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Conduite en état d'ivresse", article: "art. L234-1 C. route", amende: 2200, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Menaces de mort", article: "art. 222-17", amende: 2400, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Conduite sans permis, récidive", article: "art. L221-2", amende: 2400, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Dégradation de bien", article: "art. 322-1", amende: 2400, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Vol simple", article: "art. 311-3", amende: 2600, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Refus d'obtempérer simple", article: "art. L233-1", amende: 2800, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Détention de stupéfiants", article: "art. 222-37", amende: 2800, tempsGav: "15 min" },
  { type: "Délit", classe: "", nom: "Violences légères", article: "art. 222-13", amende: 3000, tempsGav: "15 min" },
  { type: "Délit", classe: "", nom: "Délit de fuite", article: "art. L231-1", amende: 3000, tempsGav: "15 min" },
  { type: "Délit", classe: "", nom: "Escroquerie", article: "art. 313-1", amende: 3400, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Port d'arme sans autorisation", article: "art. L317-8 CSI", amende: 3600, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Refus d'obtempérer avec mise en danger", article: "art. L233-1-1", amende: 3600, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Vol avec effraction", article: "art. 311-4", amende: 3800, tempsGav: "15 min" },
  { type: "Délit", classe: "", nom: "Violences", article: "art. 222-11", amende: 4000, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Détention d'arme de catégorie interdite", article: "art. L317-4 CSI", amende: 4400, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Trafic de stupéfiants, petite échelle", article: "art. 222-37 al. 2", amende: 4800, tempsGav: "15 min" },
  { type: "Délit", classe: "", nom: "Association de malfaiteurs", article: "art. 450-1", amende: 5000, tempsGav: "20 min" },

  { type: "Crime", classe: "", nom: "Séquestration", article: "art. 224-1", amende: 5500, tempsGav: "25 min" },
  { type: "Crime", classe: "", nom: "Vol à main armée / braquage", article: "art. 311-8, 311-9", amende: 5500, tempsGav: "20 min" },
  { type: "Crime", classe: "", nom: "Prise d'otage", article: "art. 224-4", amende: 6000, tempsGav: "25 min" },
  { type: "Crime", classe: "", nom: "Homicide involontaire", article: "art. 221-6-1", amende: 6000, tempsGav: "20 min" },
  { type: "Crime", classe: "", nom: "Trafic de stupéfiants en bande organisée", article: "art. 222-34 à 222-36", amende: 7500, tempsGav: "25 min" },
  { type: "Crime", classe: "", nom: "Meurtre", article: "art. 221-1", amende: 7000, tempsGav: "25 min" },
  { type: "Crime", classe: "", nom: "Assassinat avec préméditation (mort RP)", article: "art. 221-3", amende: 8000, tempsGav: "30 min" },
];

export const TYPES_INFRACTION = ["Contravention", "Délit", "Crime"];

export const NATURES_INFRACTION = [
  "Vol",
  "Agression / violences",
  "Dégradation de bien",
  "Escroquerie / arnaque",
  "Menaces",
  "Trafic illégal",
  "Autre",
];

const GRAVITE_INFRACTION = ["Contravention", "Délit", "Crime"];

export const OUI_NON = ["Oui", "Non"];

// RIO : 5 chiffres au hasard + 2 derniers chiffres uniques à chaque agent (100 agents maximum)
export function genererRIO(personnel, extra = []) {
  const pris = new Set([...personnel.map((p) => p.cipcNumero).filter(Boolean), ...extra].map((n) => String(n).slice(-2)));
  const libres = [];
  for (let i = 0; i < 100; i++) { const s = String(i).padStart(2, "0"); if (!pris.has(s)) libres.push(s); }
  if (!libres.length) return null;
  return String(Math.floor(Math.random() * 100000)).padStart(5, "0") + libres[Math.floor(Math.random() * libres.length)];
}

export function nextRef(list, prefix) {
  const year = new Date().getFullYear();
  const max = list.reduce((m, x) => { const r = /-(\d+)$/.exec(String(x.ref || "")); return r ? Math.max(m, parseInt(r[1], 10)) : m; }, 0);
  const n = Math.max(max, list.length) + 1;
  return prefix + "-" + year + "-" + String(n).padStart(4, "0");
}
