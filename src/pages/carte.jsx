// pages/carte.jsx — « Carte de la ville » : carte des secteurs, visible par tous les gendarmes
import React, { useState } from "react";
import { h2Style } from "../composants/ui.jsx";

const SECTEURS = [
  { nom: "Secteur Uniforme", type: "Secteur Urbain", couleur: "#E0192E" },
  { nom: "Secteur India", type: "Secteur Industriel", couleur: "#1F4BE8" },
  { nom: "Secteur Papa-Uniforme", type: "Secteur Péri-Urbain", couleur: "#27B336" },
  { nom: "Secteur Roméo", type: "Secteur Rural", couleur: "#E8C411" },
];

export function CarteVillePage() {
  const [zoom, setZoom] = useState(false);
  return (
    <div style={{ maxWidth: 1100 }}>
      <h2 style={h2Style}>Carte de la ville</h2>
      <p style={{ color: "#5A6B84", fontSize: 13.5, margin: "0 0 14px" }}>Les quatre secteurs d'intervention de la ville. Clique sur la carte pour l'agrandir.</p>
      <img src="/carte-ville.webp" alt="Carte de la ville avec les secteurs Uniforme, India, Papa-Uniforme et Roméo" onClick={() => setZoom(true)} style={{ width: "100%", display: "block", borderRadius: 12, border: "1px solid #D3DDEA", boxShadow: "0 10px 28px -14px rgba(7,20,46,0.45)", cursor: "zoom-in" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, marginTop: 16 }}>
        {SECTEURS.map((s) => (
          <div key={s.nom} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `6px solid ${s.couleur}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#14213A" }}>{s.nom}</div>
            <div style={{ fontSize: 13, color: "#5A6B84", marginTop: 3 }}>= {s.type}</div>
          </div>
        ))}
      </div>
      {zoom && (
        <div onClick={() => setZoom(false)} style={{ position: "fixed", inset: 0, background: "rgba(7,20,46,0.9)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, cursor: "zoom-out" }}>
          <img src="/carte-ville.webp" alt="Carte de la ville" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
