// pages/cadreJuridique.jsx — « Cadre juridique » : Code pénal + tous les autres codes (procédure pénale, sécurité intérieure, route…).
// Les autres codes sont des textes créés par les admins (rubrique « code » dans la collection des règlements).
import React, { useState } from "react";
import { CodePenalPage, CodePenalPublic } from "./casier.jsx";
import { ReglementsPage, ReglementsPublic, trierReglements } from "./reglements.jsx";
import { h2Style, smallBtn } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";

const BLEU = "#123A7A";

function Bandeau({ nbCodes }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #0F2A5C 0%, #123A7A 55%, #2F6FDE 100%)", color: "#fff", borderRadius: 16, padding: "22px 24px", marginBottom: 16, boxShadow: "0 14px 34px -18px rgba(7,20,46,0.6)", fontFamily: FONT_BASE }}>
      <div style={{ fontFamily: FONT_TITRE, fontSize: 27, fontWeight: 700, marginBottom: 4 }}>⚖️ Cadre juridique</div>
      <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.6, maxWidth: 680 }}>Le Code pénal et l'ensemble des codes applicables à Nîmes RP : procédure pénale, sécurité intérieure, route…</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <div style={{ background: "rgba(255,255,255,0.14)", borderRadius: 10, padding: "6px 14px" }}><b style={{ fontSize: 18 }}>{nbCodes + 1}</b> <span style={{ fontSize: 12, opacity: 0.9 }}>code{nbCodes > 0 ? "s" : ""}</span></div>
      </div>
    </div>
  );
}

function Onglets({ onglets, actif, onChoisir }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {onglets.map((o) => (
        <button key={o.id} onClick={() => onChoisir(o.id)} style={{ ...smallBtn, padding: "9px 18px", fontSize: 13, fontWeight: 700, background: actif === o.id ? BLEU : "#fff", color: actif === o.id ? "#fff" : "#14213A", borderColor: actif === o.id ? BLEU : "#C3D0E2", boxShadow: actif === o.id ? "0 8px 18px -10px rgba(18,58,122,0.8)" : "none" }}>{o.label}</button>
      ))}
    </div>
  );
}

// Côté gendarmes
export function CadreJuridiquePage({ current, codePenal, onAddArticle, onUpdateArticle, onDeleteArticle, reglements, onCreate, onUpdate, onDelete, onMove }) {
  const [onglet, setOnglet] = useState("penal");
  const codes = trierReglements(reglements).filter((r) => r.rubrique === "code");
  const onglets = [
    { id: "penal", label: "📖 Code pénal" },
    ...codes.map((c) => ({ id: `code:${c.id}`, label: `📚 ${c.titre}` })),
    ...(current.isAdmin ? [{ id: "gerer", label: "⚙️ Gérer les codes" }] : []),
  ];
  const actif = onglets.some((o) => o.id === onglet) ? onglet : "penal";
  const pageReglements = { current, reglements, onCreate, onUpdate, onDelete, onMove, mode: "codes" };

  return (
    <div style={{ maxWidth: 1020 }}>
      <h2 style={h2Style}>Cadre juridique</h2>
      <Bandeau nbCodes={codes.length} />
      <Onglets onglets={onglets} actif={actif} onChoisir={setOnglet} />
      {actif === "penal" && <CodePenalPage current={current} codePenal={codePenal} onAdd={onAddArticle} onUpdate={onUpdateArticle} onDelete={onDeleteArticle} embed />}
      {actif.startsWith("code:") && <ReglementsPage key={actif} {...pageReglements} selectionId={actif.slice(5)} embed />}
      {actif === "gerer" && <ReglementsPage key="gerer" {...pageReglements} />}
      {codes.length === 0 && actif === "penal" && current.isAdmin && (
        <div style={{ background: "#FFF8E5", border: "1px solid #F0D58A", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#5C4300", marginTop: 16, lineHeight: 1.6 }}>
          💡 Pour ajouter un code (procédure pénale, sécurité intérieure, route…), ouvre l'onglet <b>⚙️ Gérer les codes</b>. Un règlement déjà créé peut aussi y être déplacé avec le bouton « ↔ Passer dans le Cadre juridique » (page Règlements).
        </div>
      )}
    </div>
  );
}

// Côté civils (sans connexion)
export function CadreJuridiquePublic({ codePenal, reglements, onCancel }) {
  const [onglet, setOnglet] = useState("penal");
  const codes = Array.isArray(reglements) ? trierReglements(reglements).filter((r) => r.rubrique === "code") : [];
  const onglets = [{ id: "penal", label: "📖 Code pénal" }, ...codes.map((c) => ({ id: `code:${c.id}`, label: `📚 ${c.titre}` }))];
  const actif = onglets.some((o) => o.id === onglet) ? onglet : "penal";
  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 60px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 1020, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16, background: "#fff" }}>← Retour</button>
        <Bandeau nbCodes={codes.length} />
        <Onglets onglets={onglets} actif={actif} onChoisir={setOnglet} />
        {actif === "penal" && <div style={{ maxWidth: 780 }}><CodePenalPublic codePenal={codePenal} embed /></div>}
        {actif.startsWith("code:") && <ReglementsPublic key={actif} reglements={reglements} mode="codes" selectionId={actif.slice(5)} embed />}
      </div>
    </div>
  );
}
