// composants/CodeBarres.jsx — code-barres décoratif généré à partir d'un numéro (aspect « document officiel »)
import React from "react";

export function CodeBarres({ valeur = "", largeur = 190, hauteur = 34, couleur = "#111827" }) {
  let h = 2166136261;
  for (const c of String(valeur)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const barres = [];
  let x = 0;
  for (let i = 0; i < 46 && x < largeur - 2; i++) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const l = 1 + (h % 3);
    const noir = i % 2 === 0;
    if (noir) barres.push(<rect key={i} x={x} y={0} width={l} height={hauteur} fill={couleur} />);
    x += l + (noir ? 0 : 0);
  }
  return (
    <div style={{ display: "inline-block", textAlign: "center", lineHeight: 1 }}>
      <svg width={largeur} height={hauteur} viewBox={`0 0 ${x} ${hauteur}`} preserveAspectRatio="none" role="img" aria-label={`Code ${valeur}`} style={{ display: "block" }}>{barres}</svg>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9.5, letterSpacing: 2, marginTop: 3, color: couleur }}>{String(valeur).toUpperCase()}</div>
    </div>
  );
}
