// composants/Ecusson.jsx — écusson de la Gendarmerie (image /ecusson-gn.png, à placer dans le dossier public).
// Posé sur un halo lumineux pour bien le détacher du fond sombre. Si l'image manque, rien n'est affiché.
import React, { useState } from "react";

export function Ecusson({ taille = 90, halo = true, style }) {
  const [absent, setAbsent] = useState(false);
  if (absent) return null;
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: taille, height: Math.round(taille * 1.28), flexShrink: 0, ...style }}>
      {halo && <span aria-hidden="true" style={{ position: "absolute", inset: "-28%", borderRadius: "50%", background: "radial-gradient(circle, rgba(120,170,255,0.38), rgba(120,170,255,0) 68%)", pointerEvents: "none" }} />}
      <img src="/ecusson-gn.png" alt="Gendarmerie nationale" onError={() => setAbsent(true)} style={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", display: "block", filter: "drop-shadow(0 10px 16px rgba(0,0,0,0.55))" }} />
    </span>
  );
}
