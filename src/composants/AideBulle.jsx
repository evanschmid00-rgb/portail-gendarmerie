// composants/AideBulle.jsx — Petite bulle « Comment ça marche ? » en haut d'une page (texte dans lib/aide.js).
import React, { useState, useEffect } from "react";
import { AIDE } from "../lib/aide.js";

export function AideBulle({ section }) {
  const a = AIDE[section];
  const [ouverte, setOuverte] = useState(false);
  useEffect(() => { setOuverte(false); }, [section]);
  if (!a) return null;
  return (
    <div style={{ maxWidth: 860, margin: "0 0 12px", textAlign: "right" }}>
      <button type="button" onClick={() => setOuverte(!ouverte)} aria-expanded={ouverte} style={{ border: "1px solid #B8C7E0", background: ouverte ? "#E8EEF8" : "#fff", color: "#123A7A", borderRadius: 18, padding: "5px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
        <span style={{ display: "inline-block", width: 18, height: 18, lineHeight: "18px", borderRadius: 9, background: "#123A7A", color: "#fff", fontSize: 12, textAlign: "center", marginRight: 7 }}>?</span>
        Comment ça marche ?
      </button>
      {ouverte && (
        <div style={{ textAlign: "left", marginTop: 8, background: "#F4F8FF", border: "1px solid #B8C7E0", borderRadius: 14, padding: "14px 18px" }}>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 16, fontWeight: 700, color: "#14213A", marginBottom: 8 }}>{a.titre}</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6, color: "#2A3A55" }}>{a.etapes.map((e, i) => <li key={i} style={{ marginBottom: 3 }}>{e}</li>)}</ol>
          {a.astuce && <div style={{ marginTop: 10, background: "#FFF6DD", border: "1px solid #E6C766", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#6B4E00" }}>💡 {a.astuce}</div>}
          <div style={{ textAlign: "right", marginTop: 8 }}><button type="button" onClick={() => setOuverte(false)} style={{ border: 0, background: "transparent", color: "#5A6B84", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Fermer</button></div>
        </div>
      )}
    </div>
  );
}
