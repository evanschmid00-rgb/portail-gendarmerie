// composants/Pseudos.jsx — Pseudos Roblox / Discord d'un agent, affichés à côté de son nom pour l'identifier vite.
import React from "react";

export const trouverAgent = (personnel, matricule) => (personnel || []).find((p) => p.matricule === matricule) || null;

const puce = { display: "inline-flex", alignItems: "center", gap: 4, background: "#EEF2F8", color: "#3A4D6B", border: "1px solid #D3DDEA", borderRadius: 10, padding: "0 7px", fontSize: 11, fontWeight: 600, lineHeight: 1.6, whiteSpace: "nowrap", verticalAlign: "middle" };

// agent = document personnel (pseudoRoblox, pseudoDiscord). Ne rend rien si aucun pseudo n'est renseigné.
export function PseudosAgent({ agent, style }) {
  if (!agent) return null;
  const rb = String(agent.pseudoRoblox || "").trim();
  const dc = String(agent.pseudoDiscord || "").trim();
  if (!rb && !dc) return null;
  return (
    <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap", marginLeft: 6, ...style }}>
      {rb && <span style={puce} title="Pseudo Roblox">🎮 {rb}</span>}
      {dc && <span style={{ ...puce, background: "#ECEEFE", color: "#3B45B5", borderColor: "#C9CEF7" }} title="Pseudo Discord">💬 {dc}</span>}
    </span>
  );
}
