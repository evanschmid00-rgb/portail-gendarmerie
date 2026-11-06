// lib/amgn.js — Académie Militaire de la Gendarmerie Nationale (AMGN) : droit du personnel, domaines évalués, statuts.
export const QUAL_AMGN = "Personnel AMGN";
export const estPersonnelAmgn = (p) => !!p && (!!p.isAdmin || (Array.isArray(p.qualifications) && p.qualifications.includes(QUAL_AMGN)));

// Domaines sur lesquels le personnel de l'AMGN note chaque recrue (note de 1 à 5 + commentaire)
export const DOMAINES_AMGN = [
  { id: "code", nom: "Connaissance du code pénal", icone: "⚖️", aide: "Infractions, qualifications, sanctions, cadre juridique." },
  { id: "pv", nom: "Procédure & rédaction de PV", icone: "📝", aide: "Qualité des PV, respect des procédures, clarté de la rédaction." },
  { id: "discipline", nom: "Comportement & discipline", icone: "🎖️", aide: "Tenue, respect de la hiérarchie, ponctualité, attitude." },
  { id: "terrain", nom: "Pratique terrain", icone: "🚓", aide: "Patrouille, contrôle, interpellation, mises en situation RP." },
];

export const STATUTS_AMGN = ["En formation", "Admis", "Ajourné"];
export const COULEUR_STATUT_AMGN = { "En formation": ["#B25E00", "#FFF1DC"], Admis: ["#1F6B42", "#E3F2E8"], "Ajourné": ["#C0172D", "#FBE3E7"] };
export const LIBELLE_NOTE = { 1: "Insuffisant", 2: "À améliorer", 3: "Correct", 4: "Bien", 5: "Excellent" };

export const notesDe = (d) => (d && d.notes && typeof d.notes === "object" ? d.notes : {});
export const nbNotes = (d) => DOMAINES_AMGN.filter((x) => Number(notesDe(d)[x.id] && notesDe(d)[x.id].note) > 0).length;
export const moyenneAmgn = (d) => {
  const ns = DOMAINES_AMGN.map((x) => Number(notesDe(d)[x.id] && notesDe(d)[x.id].note)).filter((n) => n > 0);
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
};
export const SECTIONS_RECRUE_AMGN = ["amgn-eval", "amgn-cours", "amgn-planning", "compte"];
