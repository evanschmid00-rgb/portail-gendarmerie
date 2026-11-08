// pages/documentation.jsx — Centre de documentation : un seul point d'entrée vers règlements, cadre juridique, fiches, cours AMGN et hiérarchie.
import React, { useState } from "react";

const SERIF = "Georgia, 'Times New Roman', serif";
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const RUBRIQUES = [
  { id: "cadre-juridique", ico: "⚖️", titre: "Cadre juridique", texte: "Code pénal du serveur : infractions, amendes, gravité.", couleur: "#123A7A", mots: "code penal infractions amende delit crime contravention loi" },
  { id: "reglements", ico: "📜", titre: "Règlements", texte: "Règlement du serveur, règlement intérieur et textes officiels.", couleur: "#8A6D1F", mots: "reglement regles interieur discipline" },
  { id: "fiches", ico: "🗂️", titre: "Fiches de référence", texte: "AMER, cadre légal d'usage des armes, charte du respect.", couleur: "#2E7D4F", mots: "fiche amer armes usage charte respect memo" },
  { id: "amgn-cours", ico: "🎓", titre: "Cours du CEGN", texte: "Les cours du CEGN, par catégorie.", couleur: "#C9A227", mots: "cours formation academie amgn" },
  { id: "hierarchie", ico: "🏛️", titre: "Hiérarchie", texte: "Organigramme : État-Major, commandants d'unité, grades.", couleur: "#14305F", mots: "organigramme hierarchie grades etat major commandant unite" },
];

export function DocumentationPage({ reglements = [], onNavigate }) {
  const [q, setQ] = useState("");
  const s = norm(q.trim());
  const rubriques = RUBRIQUES.filter((r) => !s || norm(`${r.titre} ${r.texte} ${r.mots}`).includes(s));
  const textes = s ? reglements.filter((r) => norm(`${r.titre} ${r.categorie} ${r.contenu}`).includes(s)).slice(0, 12) : [];
  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(120deg, #0B1D44 0%, #14305F 70%, #1B3F7D 100%)", borderRadius: 18, padding: "24px 26px", marginBottom: 20, color: "#fff" }}>
        <div style={{ position: "absolute", right: -40, top: -50, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(47,111,222,0.4), transparent 70%)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10.5, letterSpacing: 2.6, color: "#8FB6FF", fontWeight: 700 }}>CENTRE DE DOCUMENTATION</div>
          <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, marginTop: 3 }}>Tout savoir en un seul endroit</div>
          <div style={{ fontSize: 13.5, color: "#C9D6EC", marginTop: 4 }}>Cherche un texte, un article, une fiche ou un cours.</div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Ex : usage des armes, garde à vue, tenue, amende…" style={{ marginTop: 14, width: "100%", maxWidth: 520, boxSizing: "border-box", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, fontFamily: "inherit" }} />
        </div>
      </div>
      {s && textes.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 18, marginBottom: 18 }}>
          <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Dans les règlements</div>
          {textes.map((r) => (
            <button key={r.id} type="button" onClick={() => onNavigate("reglements")} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid #EEF2F8", padding: "9px 0", cursor: "pointer", fontFamily: "inherit" }}>
              <b style={{ color: "#14213A" }}>{r.titre}</b>{r.categorie && <span style={{ color: "#5A6B84", fontSize: 12, marginLeft: 8 }}>{r.categorie}</span>}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14 }}>
        {rubriques.map((r) => (
          <button key={r.id} type="button" onClick={() => onNavigate(r.id)} className="gh-card-anim" style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: "#fff", border: "1px solid #D3DDEA", borderTop: `5px solid ${r.couleur}`, borderRadius: 16, padding: "18px 20px", boxShadow: "0 8px 22px -14px rgba(7,20,46,0.4)" }}>
            <div style={{ fontSize: 30 }}>{r.ico}</div>
            <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: "#14213A", margin: "6px 0 4px" }}>{r.titre}</div>
            <div style={{ fontSize: 13, color: "#5A6B84", lineHeight: 1.5 }}>{r.texte}</div>
            <div style={{ marginTop: 10, fontWeight: 800, fontSize: 12.5, color: r.couleur }}>Ouvrir →</div>
          </button>
        ))}
      </div>
      {!rubriques.length && !textes.length && <div style={{ color: "#5A6B84", textAlign: "center", padding: 24 }}>Rien ne correspond à « {q} ».</div>}
    </div>
  );
}
