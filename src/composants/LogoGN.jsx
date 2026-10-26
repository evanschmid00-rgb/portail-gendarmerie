// composants/LogoGN.jsx — logo « Gendarmerie Nationale » (image /logo-gn.png, à placer dans le dossier public).
// Il est blanc sur fond transparent : il est donc posé sur une pastille bleu nuit. Si l'image manque, on affiche « GN ».
import React, { useState } from "react";

export function LogoGN({ taille = 44, anneau = true, style }) {
  const [absent, setAbsent] = useState(false);
  return (
    <span style={{ width: taille, height: taille, borderRadius: "50%", background: "radial-gradient(circle at 30% 25%, #1B3F7D, #07142E 70%)", boxShadow: anneau ? "0 0 0 2px rgba(207,224,255,0.55), 0 8px 18px -8px rgba(0,0,0,0.6)" : "0 6px 14px -8px rgba(0,0,0,0.6)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", ...style }}>
      {absent
        ? <span style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontWeight: 700, fontSize: Math.round(taille * 0.36), color: "#CFE0FF" }}>GN</span>
        : <img src="/logo-gn.png" alt="Gendarmerie nationale" onError={() => setAbsent(true)} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
    </span>
  );
}
