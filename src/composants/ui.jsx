// composants/ui.jsx — éléments d'interface partagés
import React from "react";
import { fmtDuree } from "../lib/utils.js";
import { NumeroDossierBloc } from "../pages/candidatures.jsx";

/* ---------- Primitives UI partagées ---------- */

export function Field({ label, value, onChange, type = "text", autoFocus, textarea, placeholder }) {
  const common = {
    value,
    autoFocus,
    placeholder,
    onChange: (e) => onChange(e.target.value),
    style: {
      width: "100%",
      padding: "9px 10px",
      borderRadius: 6,
      border: "1px solid #C3D0E2",
      background: "#FFFFFF",
      fontSize: 14,
      boxSizing: "border-box",
      outline: "none",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      resize: "vertical",
    },
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {textarea ? <textarea rows={4} {...common} /> : <input type={type} {...common} />}
    </div>
  );
}

export const labelStyle = { display: "block", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 4 };
export const selectStyle = { width: "100%", padding: "9px 10px", borderRadius: 6, border: "1px solid #C3D0E2", background: "#fff", fontSize: 13, boxSizing: "border-box" };
export const smallBtn = { fontSize: 12, fontWeight: 600, background: "transparent", border: "1px solid #C3D0E2", borderRadius: 20, padding: "6px 14px", cursor: "pointer" };
// Titre de page « officiel » : empattements, filet gris avec un court trait bleu-blanc-rouge au début
export const h2Style = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, fontWeight: 700, letterSpacing: 0.2, marginBottom: 22, color: "#0F1E3D", paddingBottom: 10, borderBottom: "3px solid transparent", borderImage: "linear-gradient(90deg, #0B3A8F 0 28px, #FFFFFF 28px 36px, #C0172D 36px 64px, #D3DDEA 64px 100%) 1" };
export const buttonPrimary = {
  width: "100%",
  padding: "10px 0",
  marginTop: 6,
  background: "#123A7A",
  color: "#F2F6FC",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 14px -4px rgba(22,48,92,0.5)",
};

export function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function FieldRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "#5A6B84", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#14213A", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}

/* ---------- Écran de confirmation générique ---------- */

export function Confirmation({ title, message, refNumber, onBack, dossier, onSuivi }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 20%, #123A7A, #07142E 60%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ background: "#F2F6FC", borderRadius: 10, padding: 28, maxWidth: dossier ? 480 : 420, width: "100%", textAlign: "center", boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10, color: "#14213A" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 14, lineHeight: 1.5 }}>{message}</div>
        {refNumber && !dossier && <div style={{ fontFamily: "'Courier New', monospace", fontSize: 15, background: "#fff", border: "1px solid #C3D0E2", borderRadius: 6, padding: "8px 0", marginBottom: 18 }}>{refNumber}</div>}
        {refNumber && dossier && <NumeroDossierBloc numero={refNumber} />}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {dossier && onSuivi && <button onClick={onSuivi} style={{ ...smallBtn, padding: "9px 18px" }}>Suivre ma candidature</button>}
          <button onClick={onBack} style={{ ...buttonPrimary, width: "auto", padding: "9px 20px" }}>Retour</button>
        </div>
      </div>
    </div>
  );
}

export function StatBox({ label, ms, accent = "#123A7A" }) {
  return (
    <div style={{ flex: 1, minWidth: 130, background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${accent}`, borderRadius: 12, padding: "12px 16px" }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: accent }}>{fmtDuree(ms)}</div>
    </div>
  );
}

export function BarreTemps({ ms, max, couleur = "#2F6FDE" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (ms / max) * 100)) : 0;
  return (
    <div style={{ height: 7, background: "#E6EDF7", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: couleur, borderRadius: 4, transition: "width .3s" }} />
    </div>
  );
}

const STATUT_COLORS = { "En attente": "#2F6FDE", "Acceptée": "#2E7D4F", "Refusée": "#C0172D", "En cours": "#2F6FDE", "Traitée": "#2E7D4F", "Classée": "#5A6B84" };

export function StatutBadge({ statut }) {
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", background: STATUT_COLORS[statut] || "#5A6B84", color: "#fff", padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{statut}</span>;
}

export function ArchiveTabs({ tab, setTab, countEnCours, countArchivees }) {
  // (les éléments archivés sont supprimés automatiquement au bout de 7 jours)
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <button onClick={() => setTab("en-cours")} style={{ ...smallBtn, background: tab === "en-cours" ? "#123A7A" : "transparent", color: tab === "en-cours" ? "#fff" : "#14213A", borderColor: tab === "en-cours" ? "#123A7A" : "#C3D0E2" }}>En cours ({countEnCours})</button>
      <button onClick={() => setTab("archivees")} style={{ ...smallBtn, background: tab === "archivees" ? "#5A6B84" : "transparent", color: tab === "archivees" ? "#fff" : "#14213A", borderColor: tab === "archivees" ? "#5A6B84" : "#C3D0E2" }}>📁 Archivées ({countArchivees})</button>
      <span style={{ fontSize: 11.5, color: "#5A6B84", alignSelf: "center", marginLeft: 6 }}>🗑 Les archives sont supprimées au bout de 7 jours.</span>
    </div>
  );
}
