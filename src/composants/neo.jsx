// composants/neo.jsx — Éléments d'interface « NEO-G » partagés par les pages : bandeau, onglets, lignes de liste, fiches, alertes, boutons.
import React, { useState } from "react";

export const N = { fond: "#07101F", panneau: "#0D1A2E", panneau2: "#12233D", bord: "#1E3558", texte: "#E8F0FF", doux: "#8FA6C8", accent: "#2F7BFF", ok: "#1F9D55", alerte: "#D62B45", encre: "#14213A", gris: "#5A6B84", ligne: "#DCE5F2" };
export const FONT_N = "'Barlow Semi Condensed', 'Inter', 'Segoe UI', system-ui, sans-serif";
export const TRI = "linear-gradient(90deg, #0B3A8F 0 33.3%, #FFFFFF 33.3% 66.6%, #E5384F 66.6% 100%)";

// Bandeau d'application : bloc bleu nuit avec le résumé de la page
export function NeoBandeau({ surtitre, titre, texte, droite, couleur = N.accent }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: `radial-gradient(520px 260px at 0% 0%, ${couleur}55, transparent 70%), linear-gradient(135deg, #0D1A2E, #0A1424)`, border: `1px solid ${N.bord}`, borderRadius: 18, padding: "20px 22px", marginBottom: 16, color: N.texte, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: TRI }} />
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        {surtitre && <div style={{ fontFamily: FONT_N, fontSize: 11.5, letterSpacing: 2.6, fontWeight: 700, color: N.doux, textTransform: "uppercase" }}>{surtitre}</div>}
        <div style={{ fontFamily: FONT_N, fontSize: 26, fontWeight: 700, lineHeight: 1.15, margin: "2px 0" }}>{titre}</div>
        {texte && <div style={{ fontSize: 13.5, color: "#B9C9E6", lineHeight: 1.5, maxWidth: 640 }}>{texte}</div>}
      </div>
      {droite && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{droite}</div>}
    </div>
  );
}

// Compteur : chiffre en grand sur fond sombre
export function NeoCompteur({ n, label, couleur = N.accent, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${n ? couleur : N.bord}`, borderRadius: 12, padding: "9px 14px", minWidth: 84, textAlign: "center", cursor: onClick ? "pointer" : "default", color: N.texte, fontFamily: "inherit" }}>
      <div style={{ fontFamily: FONT_N, fontSize: 24, fontWeight: 700, color: n ? couleur : N.doux, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: N.doux, marginTop: 3 }}>{label}</div>
    </Tag>
  );
}

// Onglets segmentés (avec compteur)
export function NeoOnglets({ onglets, actif, onChange }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 6, overflowX: "auto", padding: 4, background: "#E1E9F6", borderRadius: 14, marginBottom: 14 }}>
      {onglets.map((o) => {
        const on = o.id === actif;
        return (
          <button key={o.id} role="tab" aria-selected={on} type="button" onClick={() => onChange(o.id)} style={{ flex: "1 0 auto", border: 0, borderRadius: 10, padding: "9px 14px", cursor: "pointer", background: on ? "#fff" : "transparent", color: on ? N.encre : N.gris, fontWeight: 800, fontSize: 13, fontFamily: FONT_N, letterSpacing: 0.5, boxShadow: on ? "0 4px 10px -4px rgba(7,20,46,0.35)" : "none", whiteSpace: "nowrap" }}>
            {o.label}{o.n !== undefined && <span style={{ marginLeft: 7, background: on ? o.couleur || N.accent : "#C3D0E2", color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11 }}>{o.n}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Carte blanche
export function NeoCarte({ titre, droite, children, style }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${N.ligne}`, borderRadius: 16, padding: "16px 18px", marginBottom: 14, boxShadow: "0 10px 24px -18px rgba(7,20,46,0.5)", ...style }}>
      {(titre || droite) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ fontFamily: FONT_N, fontSize: 17, fontWeight: 700, color: N.encre, letterSpacing: 0.3 }}>{titre}</div>
          {droite}
        </div>
      )}
      {children}
    </div>
  );
}

// Ligne de liste « terminal » : barre colorée, pastille, titre, détail, chevron ; se déplie au clic si elle a un détail
export function NeoLigne({ couleur = N.accent, pastille, titre, sous, date, detail }) {
  const [ouvert, setOuvert] = useState(false);
  const cliquable = !!detail;
  return (
    <div style={{ borderLeft: `5px solid ${couleur}`, background: "#F7F9FD", border: `1px solid ${N.ligne}`, borderLeftWidth: 5, borderLeftColor: couleur, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
      <button type="button" onClick={() => cliquable && setOuvert(!ouvert)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, textAlign: "left", background: "transparent", border: 0, padding: "12px 14px", cursor: cliquable ? "pointer" : "default", fontFamily: "inherit" }}>
        {pastille && <span style={{ background: couleur + "1f", color: couleur, border: `1px solid ${couleur}`, borderRadius: 8, padding: "2px 9px", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{pastille}</span>}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: N.encre, overflowWrap: "anywhere" }}>{titre}</span>
          {sous && <span style={{ display: "block", fontSize: 12.5, color: N.gris, marginTop: 2, overflowWrap: "anywhere" }}>{sous}</span>}
        </span>
        {date && <span style={{ fontFamily: "'Roboto Mono', ui-monospace, monospace", fontSize: 12, color: N.gris, whiteSpace: "nowrap" }}>{date}</span>}
        {cliquable && <span style={{ color: N.gris, fontWeight: 800, transform: ouvert ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>}
      </button>
      {ouvert && <div style={{ padding: "0 14px 14px", fontSize: 13, color: N.encre, lineHeight: 1.55, borderTop: `1px dashed ${N.ligne}` }}>{detail}</div>}
    </div>
  );
}

// Champ de fiche : petit libellé + valeur (grille)
export function NeoFiche({ champs, colonnes = 2 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${colonnes > 2 ? 140 : 200}px, 1fr))`, gap: "10px 18px" }}>
      {champs.filter((c) => c && c[1] !== undefined && c[1] !== "").map(([l, v]) => (
        <div key={l}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: N.gris }}>{l}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: N.encre, overflowWrap: "anywhere" }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

// Alerte : bande colorée (info / ok / attention / danger)
const TONS = { info: ["#E8F0FF", N.accent, "#123A7A"], ok: ["#E3F4EA", N.ok, "#1F6B42"], attention: ["#FFF3DC", "#E0A02B", "#7A5200"], danger: ["#FDE7EA", N.alerte, "#8A1020"], justice: ["#F3E6FA", "#7A1FA2", "#4A1166"] };
export function NeoAlerte({ ton = "info", icone, children }) {
  const [fond, bord, texte] = TONS[ton] || TONS.info;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: fond, border: `1px solid ${bord}`, borderLeftWidth: 5, color: texte, borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 }}>
      {icone && <span style={{ fontSize: 17 }}>{icone}</span>}<div>{children}</div>
    </div>
  );
}

// Boutons
export function NeoBouton({ children, variante = "primaire", ...p }) {
  const v = variante === "primaire" ? { background: N.accent, color: "#fff", border: 0 } : variante === "danger" ? { background: N.alerte, color: "#fff", border: 0 } : { background: "#fff", color: "#123A7A", border: "1px solid #123A7A" };
  return <button type="button" {...p} style={{ ...v, borderRadius: 12, padding: "11px 20px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: FONT_N, letterSpacing: 0.5, opacity: p.disabled ? 0.6 : 1, ...(p.style || {}) }}>{children}</button>;
}

export const NEO_LAB = { display: "block", fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: N.gris, margin: "12px 0 5px" };
export const NEO_INP = { width: "100%", boxSizing: "border-box", padding: "11px 13px", border: "1px solid #B8C7E0", borderRadius: 10, fontSize: 14.5, fontFamily: "inherit", background: "#fff", color: N.encre };
