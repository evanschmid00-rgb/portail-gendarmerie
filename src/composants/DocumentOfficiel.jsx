// composants/DocumentOfficiel.jsx — « papier à en-tête » commun aux comptes rendus, rapports internes (et autres documents).
// Mise en page de document officiel : bande tricolore, logo, numéro + code-barres, titre encadré, signatures, tampons, pied de page.
import React from "react";
import { CodeBarres } from "./CodeBarres.jsx";
import { LogoGN } from "./LogoGN.jsx";

export const SERIF = "Georgia, 'Times New Roman', serif";
export const SANS = "Arial, 'Helvetica Neue', sans-serif";
export const ROMAINS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function imprimerDocument(noeud, titre = "Document") {
  if (!noeud) return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${String(titre).replace(/</g, "")}</title><style>body{margin:16px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:10mm}</style></head><body>${noeud.outerHTML}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export function Tampon({ texte, couleur = "#1F6B42", rotation = -10, style }) {
  return (
    <span style={{ display: "inline-block", transform: `rotate(${rotation}deg)`, border: `3px double ${couleur}`, color: couleur, borderRadius: 6, padding: "2px 12px", fontFamily: SANS, fontSize: 15, fontWeight: 800, letterSpacing: 3, opacity: 0.82, textTransform: "uppercase", whiteSpace: "nowrap", ...style }}>{texte}</span>
  );
}

export function PapierOfficiel({ innerRef, couleur = "#123A7A", typeDoc, numero, unite, classification, classificationCouleur = "#7A1F2B", tamponHaut, children, pied }) {
  return (
    <div ref={innerRef} style={{ position: "relative", background: "#fff", backgroundImage: "repeating-linear-gradient(45deg, rgba(18,58,122,0.02) 0 2px, transparent 2px 9px)", border: "1px solid #C9D3E3", borderRadius: 4, maxWidth: 820, fontFamily: SERIF, color: "#111", boxShadow: "0 18px 40px -24px rgba(7,20,46,0.6)", overflow: "hidden" }}>
      <div style={{ display: "flex", height: 7 }}><div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: "#C0172D" }} /></div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", opacity: 0.035, fontSize: 92, fontWeight: 700, letterSpacing: 8, transform: "rotate(-24deg)", whiteSpace: "nowrap", color: couleur }}>GENDARMERIE</div>
      <div style={{ padding: "24px 38px 26px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <LogoGN taille={62} anneau={false} style={{ boxShadow: `0 0 0 2px ${couleur}` }} />
            <div style={{ fontSize: 12, lineHeight: 1.5, letterSpacing: 0.4 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 2.5, color: "#555" }}>RÉPUBLIQUE FRANÇAISE</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>GENDARMERIE NATIONALE</div>
              <div>Compagnie de Nîmes RP{unite ? ` · ${unite}` : ""}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10.5, letterSpacing: 1.5, color: "#555", textTransform: "uppercase" }}>{typeDoc} N°</div>
            <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 15, border: `2px solid ${couleur}`, color: couleur, padding: "3px 10px", display: "inline-block", marginTop: 3 }}>{numero || "—"}</div>
            <div style={{ marginTop: 6 }}><CodeBarres valeur={numero || "DOC"} largeur={170} hauteur={26} /></div>
          </div>
        </div>
        {classification && (
          <div style={{ marginTop: 14, textAlign: "center", border: `1.5px solid ${classificationCouleur}`, color: classificationCouleur, fontFamily: SANS, fontSize: 11.5, fontWeight: 800, letterSpacing: 3, padding: "4px 10px", textTransform: "uppercase" }}>{classification}</div>
        )}
        {tamponHaut && <div style={{ position: "absolute", top: 118, right: 40 }}>{tamponHaut}</div>}
        {children}
        <div style={{ marginTop: 20, paddingTop: 10, borderTop: "1px solid #D9DFEA", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontFamily: SANS, fontSize: 10, color: "#777", lineHeight: 1.5, flex: 1, minWidth: 220 }}>
            Document de jeu de rôle (Roblox) — sans valeur officielle, sans lien avec la Gendarmerie nationale réelle.<br />{pied || `Feuillet 1/1 · Réf. ${numero || "—"}`}
          </div>
          <CodeBarres valeur={String(numero || "DOC").replace(/[^A-Z0-9]/gi, "")} largeur={150} hauteur={22} />
        </div>
      </div>
    </div>
  );
}

export function TitreDocument({ titre, sous }) {
  return (
    <div style={{ textAlign: "center", margin: "20px 0 6px", borderTop: "3px double #111", borderBottom: "3px double #111", padding: "12px 0" }}>
      <div style={{ fontSize: 21, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, lineHeight: 1.25 }}>{titre}</div>
      {sous && <div style={{ fontSize: 12, color: "#555", marginTop: 4, letterSpacing: 2, textTransform: "uppercase" }}>— {sous} —</div>}
    </div>
  );
}

// Bloc « De / À / Objet / Réf. » comme sur une note de service
export function BlocCourrier({ lignes, lieuDate }) {
  return (
    <div style={{ margin: "14px 0 16px" }}>
      {lieuDate && <div style={{ textAlign: "right", fontSize: 13, fontStyle: "italic", marginBottom: 8 }}>{lieuDate}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #B8C3D6", fontFamily: SANS }}>
        <tbody>
          {lignes.filter(([, v]) => v).map(([k, v]) => (
            <tr key={k}>
              <td style={{ width: "22%", padding: "7px 12px", background: "#F4F7FB", borderBottom: "1px solid #D9DFEA", fontSize: 11, letterSpacing: 0.8, fontWeight: 700, color: "#444", textTransform: "uppercase", verticalAlign: "top" }}>{k}</td>
              <td style={{ padding: "7px 12px", borderBottom: "1px solid #D9DFEA", fontSize: 13.5, lineHeight: 1.5 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Rubrique({ numero, titre, couleur = "#123A7A", children }) {
  if (!children) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ background: couleur, color: "#fff", fontFamily: SANS, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, padding: "6px 12px", textTransform: "uppercase" }}>{ROMAINS[numero - 1] || numero}. {titre}</div>
      <div style={{ border: "1px solid #B8C3D6", borderTop: "none", background: "rgba(255,255,255,0.85)", padding: "10px 14px", fontSize: 14, lineHeight: 1.7, textAlign: "justify", whiteSpace: "pre-wrap" }}>{children}</div>
    </div>
  );
}

export function BlocSignature({ titre, nom, grade, rio, date, couleur = "#123A7A", tampon, vide }) {
  const nomFamille = String(nom || "").trim().split(/\s+/).slice(-1)[0] || "";
  return (
    <div style={{ flex: 1, minWidth: 220, border: "1px solid #B8C3D6", padding: "10px 14px", minHeight: 116, position: "relative", background: "rgba(255,255,255,0.85)" }}>
      <div style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: 1, color: "#555", textTransform: "uppercase" }}>{titre}</div>
      {vide ? <div style={{ marginTop: 10, fontSize: 12.5, color: "#8A97AB", fontFamily: SANS }}>{vide}</div> : (
        <>
          <div style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: 26, color: couleur, margin: "8px 0 2px", lineHeight: 1.1 }}>{nomFamille}</div>
          <div style={{ fontSize: 12 }}>{grade ? `${grade} ` : ""}{nom}{rio ? ` — RIO ${rio}` : ""}</div>
          {date && <div style={{ fontSize: 11.5, color: "#555" }}>{date}</div>}
          {tampon && <div style={{ position: "absolute", right: 10, bottom: 8 }}>{tampon}</div>}
        </>
      )}
    </div>
  );
}
