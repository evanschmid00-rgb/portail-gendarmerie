// lib/dossierPersonne.js — Dossier personnel : rattache les PV et les plaintes au casier judiciaire d'une personne.
//
// Principe : le casier (collection « casier ») reste inchangé. Chaque PV visé / plainte traitée laisse une
// « pièce » dans la collection « dossier_pieces » (réservée au personnel, JAMAIS lue par le site public).
// Une pièce est une copie résumée : elle survit donc à la suppression automatique des PV 7 jours après leur visa.
// La personne est identifiée par son compte Roblox (identifiant unique), comme dans le casier.
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

export const COL_PIECES = "dossier_pieces";

const bas = (s) => String(s || "").trim().toLowerCase().replace(/^@/, "");

// Identité d'une personne : l'id Roblox s'il existe, sinon l'@ / le pseudo
export function clesPersonne(p) {
  const k = [];
  if (p && p.robloxId) k.push(`id:${p.robloxId}`);
  [p && p.robloxUsername, p && p.pseudoRoblox, p && p.robloxDisplayName].forEach((v) => { const b = bas(v); if (b) k.push(`u:${b}`); });
  return Array.from(new Set(k));
}
// Deux fiches sont la même personne si leurs ids Roblox sont identiques ; à défaut d'id des deux côtés, si un @ / pseudo est commun.
export function memePersonne(a, b) {
  if (a.robloxId && b.robloxId) return String(a.robloxId) === String(b.robloxId);
  const ka = clesPersonne(a).filter((x) => x.startsWith("u:"));
  const kb = clesPersonne(b).filter((x) => x.startsWith("u:"));
  return ka.some((x) => kb.includes(x));
}

// Retrouve le compte Roblox à partir d'un @ (même service que la page Casier)
export async function resoudreRoblox(pseudo) {
  const at = String(pseudo || "").trim().replace(/^@/, "");
  if (!at) return null;
  try {
    const r = await fetch(`/api/roblox-head?pseudo=${encodeURIComponent(at)}`);
    const j = await r.json();
    if (!j || !j.id) return null;
    return { id: String(j.id), username: j.nom || at, displayName: j.displayName || j.nom || at };
  } catch (e) { return null; }
}

/* ---------- PV ---------- */

// Les personnes citées dans un PV (champs de type « personne ») avec un compte Roblox renseigné
export function personnesDuPV(pv) {
  return (pv.answers || [])
    .filter((a) => a.type === "personne" && a.value)
    .map((a) => ({ role: a.label || "Personne", nom: a.value.nom || "", prenom: a.value.prenom || "", roblox: String(a.value.roblox || "").trim() }))
    .filter((p) => p.nom || p.prenom || p.roblox);
}
// Résumé court du PV, conservé dans le dossier (le PV complet disparaît 7 jours après son visa)
export function resumePV(pv) {
  const textes = (pv.answers || []).filter((a) => a.type === "textarea" && String(a.value || "").trim()).map((a) => String(a.value).trim());
  const t = textes.join(" — ").replace(/\s+/g, " ");
  return t.length > 500 ? t.slice(0, 497) + "…" : t;
}

async function piecesDeSource(sourceId) {
  const snap = await getDocs(query(collection(db, COL_PIECES), where("sourceId", "==", sourceId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Ajoute un PV visé au dossier de chaque personne citée. Renvoie { pieces: [...créées], ignores: ["raison", ...] }
export async function lierPVAuxDossiers(pv, visa) {
  const pieces = [];
  const ignores = [];
  const personnes = personnesDuPV(pv);
  if (personnes.length === 0) return { pieces, ignores };
  const existantes = await piecesDeSource(pv.id);
  const faits = pv.faits || {};
  for (const p of personnes) {
    const nomAffiche = [p.prenom, p.nom].filter(Boolean).join(" ") || p.roblox;
    if (!p.roblox) { ignores.push(`${nomAffiche} (${p.role} : aucun pseudo Roblox renseigné)`); continue; }
    const compte = await resoudreRoblox(p.roblox);
    if (!compte) { ignores.push(`${nomAffiche} (${p.role} : compte Roblox « ${p.roblox} » introuvable)`); continue; }
    if (existantes.some((x) => x.robloxId === compte.id && x.role === p.role)) continue; // déjà rattaché
    const piece = {
      type: "PV", sousType: pv.modeleType || "", titre: pv.modeleTitre || "Procès-verbal", ref: pv.ref || "", role: p.role,
      robloxId: compte.id, robloxUsername: compte.username, pseudoRoblox: compte.displayName, nom: p.nom, prenom: p.prenom,
      dateFaits: faits.date || "", lieu: faits.lieu || "", resume: resumePV(pv),
      auteurNom: pv.auteurNom || "", auteurGrade: pv.auteurGrade || "", viseParNom: (visa && visa.par) || "", viseLe: (visa && visa.le) || "",
      sourceCol: "pv", sourceId: pv.id, createdAt: new Date().toISOString(),
    };
    const r = await addDoc(collection(db, COL_PIECES), piece);
    pieces.push({ id: r.id, ...piece });
  }
  return { pieces, ignores };
}

/* ---------- Plaintes en ligne ---------- */

// Une plainte traitée est ajoutée au dossier du PLAIGNANT uniquement (il s'identifie lui-même).
// La personne mise en cause n'est jamais rattachée automatiquement : le texte est libre et n'importe qui peut déposer une plainte.
export async function lierPlainteAuDossier(plainte) {
  const pseudo = String(plainte.plaignantPseudoRoblox || "").trim();
  if (!pseudo) return { pieces: [], ignores: ["plaignant sans pseudo Roblox"] };
  const compte = await resoudreRoblox(pseudo);
  if (!compte) return { pieces: [], ignores: [`compte Roblox « ${pseudo} » introuvable`] };
  const existantes = await piecesDeSource(plainte.id);
  if (existantes.some((x) => x.robloxId === compte.id)) return { pieces: [], ignores: [] };
  const desc = String(plainte.description || "").replace(/\s+/g, " ").trim();
  const piece = {
    type: "Plainte", sousType: plainte.nature || "", titre: `Plainte en ligne${plainte.nature ? " — " + plainte.nature : ""}`, ref: plainte.ref || "", role: "Plaignant",
    robloxId: compte.id, robloxUsername: compte.username, pseudoRoblox: compte.displayName, nom: plainte.plaignantNom || "", prenom: plainte.plaignantPrenom || "",
    dateFaits: plainte.dateFaits || "", lieu: plainte.lieuFaits || "", resume: desc.length > 500 ? desc.slice(0, 497) + "…" : desc,
    auteurNom: plainte.prisEnChargeNom || "", auteurGrade: "", viseParNom: "", viseLe: "",
    sourceCol: "plaintes", sourceId: plainte.id, createdAt: new Date().toISOString(),
  };
  const r = await addDoc(collection(db, COL_PIECES), piece);
  return { pieces: [{ id: r.id, ...piece }], ignores: [] };
}

export async function supprimerPiece(id) {
  await deleteDoc(doc(db, COL_PIECES, id));
}
