// composants/LogoNeogend.jsx — logo NEOGend (image /logo-neogend.png dans le dossier public). Texte de secours si l'image manque.
import React, { useState } from "react";

export function LogoNeogend({ hauteur = 30, style }) {
  const [absent, setAbsent] = useState(false);
  if (absent) return <span style={{ fontWeight: 800, letterSpacing: 2, color: "#25B0E6", fontSize: hauteur * 0.6, ...style }}>NÉOGEND</span>;
  return <img src="/logo-neogend.png" alt="NÉOGEND" onError={() => setAbsent(true)} style={{ height: hauteur, width: "auto", display: "block", ...style }} />;
}
