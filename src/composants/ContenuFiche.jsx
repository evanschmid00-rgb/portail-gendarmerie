// composants/ContenuFiche.jsx — Affichage d'un texte avec mini-mise en forme (titres, listes, **gras**), utilisé par la page Équipement/Réglementaire.
import React from "react";

const BLEU = "#123A7A";

function Gras({ t }) {
  return String(t).split(/\*\*(.+?)\*\*/g).map((x, i) => (i % 2 ? <b key={i}>{x}</b> : <React.Fragment key={i}>{x}</React.Fragment>));
}

export function ContenuFiche({ texte }) {
  const blocs = [];
  let liste = [];
  const vider = () => {
    if (liste.length) {
      blocs.push(<ul key={`u${blocs.length}`} style={{ margin: "6px 0 12px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>{liste.map((x, i) => <li key={i} style={{ fontSize: 14, color: "#14213A", lineHeight: 1.6 }}><Gras t={x} /></li>)}</ul>);
      liste = [];
    }
  };
  String(texte || "").split("\n").forEach((brut) => {
    const l = brut.trimEnd();
    if (/^\s*[-•]\s+/.test(l)) { liste.push(l.replace(/^\s*[-•]\s+/, "")); return; }
    vider();
    const k = `b${blocs.length}`;
    if (!l.trim()) return;
    if (l.startsWith("## ")) blocs.push(<h4 key={k} style={{ fontSize: 15, fontWeight: 800, color: BLEU, margin: "16px 0 6px" }}>{l.slice(3)}</h4>);
    else if (l.startsWith("# ")) blocs.push(<h3 key={k} style={{ fontSize: 18, fontWeight: 800, color: "#14213A", margin: "20px 0 8px", paddingBottom: 4, borderBottom: "2px solid #E3EAF4" }}>{l.slice(2)}</h3>);
    else if (l.startsWith("> ")) blocs.push(<div key={k} style={{ background: "#FFF6E0", border: "1px solid #F0D58A", borderLeft: "4px solid #E0A23A", borderRadius: 8, padding: "9px 12px", margin: "8px 0", fontSize: 13.5, color: "#5C4300", lineHeight: 1.55 }}>💡 <Gras t={l.slice(2)} /></div>);
    else blocs.push(<p key={k} style={{ margin: "0 0 10px", fontSize: 14, color: "#14213A", lineHeight: 1.65 }}><Gras t={l} /></p>);
  });
  vider();
  return <div>{blocs}</div>;
}

