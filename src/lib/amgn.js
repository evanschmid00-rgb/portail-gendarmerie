// lib/amgn.js — Commandement des Écoles de la Gendarmerie Nationale (CEGN) : droit du personnel, domaines évalués, statuts.
export const QUAL_AMGN = "Personnel AMGN";
export const estPersonnelAmgn = (p) => !!p && (!!p.isAdmin || (Array.isArray(p.qualifications) && p.qualifications.includes(QUAL_AMGN)));

// Domaines sur lesquels le personnel du CEGN note chaque recrue (note de 1 à 5 + commentaire)
export const DOMAINES_AMGN = [
  { id: "code", nom: "Connaissance du code pénal", icone: "⚖️", aide: "Infractions, qualifications, sanctions, cadre juridique." },
  { id: "pv", nom: "Procédure & rédaction de PV", icone: "📝", aide: "Qualité des PV, respect des procédures, clarté de la rédaction." },
  { id: "discipline", nom: "Comportement & discipline", icone: "🎖️", aide: "Tenue, respect de la hiérarchie, ponctualité, attitude." },
  { id: "terrain", nom: "Pratique terrain", icone: "🚓", aide: "Patrouille, contrôle, interpellation, mises en situation RP." },
];

// Candidatures gérées par le CEGN (les candidatures d'une unité précise, comme la Brigade de Recherche, restent à cette unité)
export const IDS_CANDIDATURES_AMGN = ["off_gav_apja", "off_sog_externe", "off_sog_interne", "off_og_opj", "off_reserviste"];

export const STATUTS_AMGN = ["En formation", "Admis", "Ajourné"];
export const COULEUR_STATUT_AMGN = { "En formation": ["#B25E00", "#FFF1DC"], Admis: ["#1F6B42", "#E3F2E8"], "Ajourné": ["#C0172D", "#FBE3E7"] };
export const LIBELLE_NOTE = { 1: "Insuffisant", 2: "À améliorer", 3: "Correct", 4: "Bien", 5: "Excellent" };

export const SEUIL_DEFAUT = 3;
export const notesDe = (d) => (d && d.notes && typeof d.notes === "object" ? d.notes : {});
export const nbNotes = (d, domaines = DOMAINES_AMGN) => domaines.filter((x) => Number(notesDe(d)[x.id] && notesDe(d)[x.id].note) > 0).length;
export const moyenneAmgn = (d, domaines = DOMAINES_AMGN) => {
  const ns = domaines.map((x) => Number(notesDe(d)[x.id] && notesDe(d)[x.id].note)).filter((n) => n > 0);
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
};
// Réglages enregistrés (collection amgn_config, document « general ») : domaines évalués et moyenne minimale d'admission
export const lireConfigAmgn = (c) => {
  const dom = c && Array.isArray(c.domaines) ? c.domaines.filter((x) => x && x.id && x.nom).map((x) => ({ id: String(x.id), nom: String(x.nom), icone: x.icone || "📌", aide: x.aide || "" })) : [];
  const seuil = c && Number(c.seuil) > 0 ? Number(c.seuil) : SEUIL_DEFAUT;
  return { domaines: dom.length ? dom : DOMAINES_AMGN, seuil };
};
export const SECTIONS_RECRUE_AMGN = ["amgn-eval", "amgn-cours", "amgn-planning", "compte"];
