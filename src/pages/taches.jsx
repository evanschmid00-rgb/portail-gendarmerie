// pages/taches.jsx — « Mes tâches » : tout ce qui attend la personne, au même endroit.
import React from "react";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";

// Construit la liste des tâches à partir des données déjà chargées. Chaque tâche : { id, icone, titre, detail, nombre, section, couleur }
export function construireTaches({ current, isAdmin, estOPJ, estRecruteur, estCorpsOuAdmin, estCommandementOuAdmin, compteurs, pvs, crAFaire, sanctionsActives }) {
  const t = [];
  if (sanctionsActives > 0) t.push({ id: "sanctions", icone: "⚠️", titre: "Sanction en cours", detail: "Consulte les détails et la date de fin.", nombre: sanctionsActives, section: "mes-sanctions", couleur: "#C0172D", urgent: true });
  if (crAFaire > 0) t.push({ id: "cr", icone: "📝", titre: "Comptes rendus à rédiger", detail: "Une intervention attend ton compte rendu.", nombre: crAFaire, section: "comptes-rendus", couleur: "#B25E00", urgent: true });
  if (estOPJ) {
    const aViser = pvs.filter((p) => !p.traite).length;
    const aTransmettre = pvs.filter((p) => p.traite && !p.transmisJustice).length;
    if (aViser > 0) t.push({ id: "pv-viser", icone: "✔", titre: "Procès-verbaux à viser", detail: "Relis puis vise les PV de tes gendarmes.", nombre: aViser, section: "pv", couleur: "#123A7A" });
    if (aTransmettre > 0) t.push({ id: "pv-transmettre", icone: "⚖️", titre: "PV visés à transmettre au Palais de justice", detail: "Ouvre le PV puis « Transmettre ».", nombre: aTransmettre, section: "pv", couleur: "#8A6D1F" });
    if (compteurs.plaintes > 0) t.push({ id: "plaintes", icone: "📨", titre: "Plaintes en attente", detail: "Prends en charge les nouvelles plaintes.", nombre: compteurs.plaintes, section: "admin-plaintes", couleur: "#7A1F2B" });
  }
  if (estRecruteur && compteurs.candidatures > 0) t.push({ id: "cand", icone: "👤", titre: "Candidatures en attente", detail: "Étudie et réponds aux candidats.", nombre: compteurs.candidatures, section: "admin-candidatures", couleur: "#2E7D4F" });
  if (estCorpsOuAdmin && compteurs.plaintesGendarmes > 0) t.push({ id: "pg", icone: "🛡", titre: "Signalements contre des gendarmes", detail: "À traiter par l'inspection.", nombre: compteurs.plaintesGendarmes, section: "plaintes-gendarmes", couleur: "#C0172D" });
  if (estCommandementOuAdmin && compteurs.rapports > 0) t.push({ id: "rap", icone: "📄", titre: "Rapports internes nouveaux", detail: "À lire et à traiter.", nombre: compteurs.rapports, section: "rapports-internes", couleur: "#16305C" });
  if (compteurs.annonces > 0) t.push({ id: "ann", icone: "📣", titre: "Annonces non lues", detail: "Les dernières informations du commandement.", nombre: compteurs.annonces, section: "annonces", couleur: "#4C8DF6" });
  if (compteurs.questionnaires > 0) t.push({ id: "quest", icone: "📋", titre: "Questionnaires disponibles", detail: "Réponds à ceux qui te concernent.", nombre: compteurs.questionnaires, section: "questionnaires-internes", couleur: "#9B7BE8" });
  return t;
}

export function TachesCarte({ tache, onOpen }) {
  return (
    <button onClick={() => onOpen(tache.section)} className="gh-btn-anim" style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 14, width: "100%", background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${tache.couleur}`, borderRadius: 12, padding: "13px 16px", cursor: "pointer", fontFamily: FONT, boxShadow: "0 4px 14px -10px rgba(7,20,46,0.35)" }}>
      <span style={{ fontSize: 24, width: 34, textAlign: "center", flexShrink: 0 }}>{tache.icone}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "#14213A" }}>{tache.titre}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "#5A6B84", marginTop: 2 }}>{tache.detail}</span>
      </span>
      <span style={{ minWidth: 34, height: 34, borderRadius: 17, background: tache.couleur, color: "#fff", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px" }}>{tache.nombre}</span>
      <span style={{ color: "#8A97AB", fontSize: 18 }}>›</span>
    </button>
  );
}

export function TachesPage({ taches, onOpen, prenom }) {
  const total = taches.reduce((n, t) => n + t.nombre, 0);
  return (
    <div style={{ maxWidth: 760, fontFamily: FONT }}>
      <h2 style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 26, fontWeight: 700, color: "#14213A", margin: "0 0 4px" }}>Mes tâches</h2>
      <div style={{ fontSize: 13, color: "#5A6B84", marginBottom: 20 }}>{total > 0 ? `${prenom ? prenom + ", " : ""}voici ce qui t'attend (${total} élément${total > 1 ? "s" : ""}).` : "Tout est à jour 🎉"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {taches.map((t) => <TachesCarte key={t.id} tache={t} onOpen={onOpen} />)}
        {taches.length === 0 && <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 22, color: "#5A6B84", fontSize: 14, textAlign: "center" }}>Rien à faire pour le moment. Profites-en !</div>}
      </div>
    </div>
  );
}
