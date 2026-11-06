// composants/LogoAMGN.jsx — logo de l'Académie Militaire de la Gendarmerie Nationale (image /logo-amgn.png, à placer dans le dossier public).
// Si l'image manque, on affiche « AMGN » sur une pastille bleu nuit.
import React, { useState } from "react";

export function LogoAMGN({ taille = 44, style }) {
  const [absent, setAbsent] = useState(false);
  return (
    <span style={{ width: taille, height: taille, borderRadius: absent ? "50%" : 0, background: absent ? "radial-gradient(circle at 30% 25%, #1B3F7D, #07142E 70%)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", ...style }}>
      {absent
        ? <span style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontWeight: 700, fontSize: Math.round(taille * 0.26), color: "#CFE0FF", letterSpacing: 0.5 }}>AMGN</span>
        : <img src="/logo-amgn.png" alt="Académie Militaire de la Gendarmerie Nationale" onError={() => setAbsent(true)} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
    </span>
  );
}
