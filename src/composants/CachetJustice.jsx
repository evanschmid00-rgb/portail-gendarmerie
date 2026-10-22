// composants/CachetJustice.jsx — cachet officiel du Palais de justice (image à placer dans public/cachet-justice.png)
import React, { useState } from "react";

export function CachetJustice({ taille = 80, style }) {
  const [absent, setAbsent] = useState(false);
  if (absent) return <span style={{ fontSize: taille * 0.6, lineHeight: 1, ...style }} role="img" aria-label="Palais de justice">⚖️</span>;
  return <img src="/cachet-justice.png" alt="Cachet du Palais de justice" width={taille} height={taille} onError={() => setAbsent(true)} style={{ display: "block", objectFit: "contain", ...style }} />;
}
