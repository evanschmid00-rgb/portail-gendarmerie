// pages/fiches.jsx — Fiches de référence : méthode AMER, cadre légal d'usage des armes, charte du respect (images dans public/fiches/).
import React, { useEffect, useState } from "react";
import { h2Style, smallBtn } from "../composants/ui.jsx";

const FICHES = [
  {
    id: "amer", couleur: "#C0172D", icone: "🎯", img: "/fiches/amer.jpg",
    titre: "Méthode AMER — usage des armes",
    sous: "Analyse réflexe préalable à un usage des armes : trois questions sous le signe de l'urgence.",
    texte: [
      ["Les 3 questions", "Proportionnalité ? Usage adapté ? Absolue nécessité ?"],
      ["A — Atteinte", "Atteinte à l'intégrité physique de moi-même ou d'autrui : mise en danger de mon intégrité (ou d'autrui), menace avec arme, individu en fuite avec volonté d'attenter à l'intégrité physique d'autrui, ou individu susceptible de réitérer un meurtre. Si une condition est remplie : l'usage de mon arme est proportionné."],
      ["M — Menace", "Menace avec arme sur mon intégrité ou celle d'autrui."],
      ["E — Environnement sécurisé", "J'évalue le risque de dommages pour les tiers et si l'espace est sécurisé. Si les conditions sont réunies : l'usage de mon arme est adapté."],
      ["R — Recours", "Je vérifie s'il existe une alternative immédiate à mon action. Si les conditions sont réunies : l'usage de mon arme est absolument nécessaire."],
    ],
  },
  {
    id: "cadre", couleur: "#123A7A", icone: "⚖️", img: "/fiches/cadre-legal-armes.jpg",
    titre: "Cadre légal d'usage des armes",
    sous: "Absolue nécessité et proportionnalité : les textes et les 5 cas de l'article L.435-1 du Code de la sécurité intérieure.",
    texte: [
      ["Les textes", "Code pénal : légitime défense (art. 122-5) et état de nécessité (art. 122-7). Code de la sécurité intérieure : cadre commun Police-Gendarmerie (art. L.435-1). Code de la défense : zone de défense hautement sensible et OPEX (art. 4123-12)."],
      ["Cas n° 1", "Atteintes à la vie ou à l'intégrité physique contre soi-même ou autrui."],
      ["Cas n° 2", "Ne peuvent défendre autrement les lieux qu'ils occupent ou les personnes qui leur sont confiées."],
      ["Cas n° 3", "Ne peuvent arrêter autrement les personnes qui cherchent à échapper à leur garde."],
      ["Cas n° 4", "Ne peuvent immobiliser autrement des véhicules ou moyens de transport dont les conducteurs n'obtempèrent pas à l'ordre d'arrêt."],
      ["Cas n° 5", "Empêcher la réitération d'un ou de plusieurs meurtres ou tentatives de meurtre."],
      ["Sommations", "« Halte gendarmerie, halte ou je fais feu » (cas n° 2, 3 et 4)."],
    ],
  },
  {
    id: "charte", couleur: "#8A6D1F", icone: "🤝", img: "/fiches/charte-respect.jpg",
    titre: "Charte du respect — CGD de Saint-Tropez RP",
    sous: "Les 8 règles de conduite de tous les membres de la compagnie.",
    texte: [
      ["1. Règles de vocabulaire", "Un vocabulaire enrichi et respectueux vis-à-vis de la vie des autres est demandé à toute personne communiquant sur le serveur."],
      ["2. Hiérarchie et obéissance", "Le respect de la chaîne de commandement est absolu. Toute insubordination ou refus d'obtempérer aux ordres d'un supérieur sera sanctionné."],
      ["3. Comportement", "Il est strictement interdit d'avoir un comportement toxique, d'insulter ou d'insalubrité envers un autre membre, peu importe le contexte."],
      ["4. Immersion et réalisme", "L'authenticité est notre force. Maintenez une attitude professionnelle et crédible, digne de la Gendarmerie de Saint-Tropez."],
      ["5. Fair-play et écoute", "Privilégiez le dialogue et la diplomatie. Tout comportement « win-RP » ou refus d'admettre ses erreurs est interdit."],
      ["6. Discrétion et secret", "Ce qui se passe en service reste en service. La divulgation d'informations confidentielles est une faute grave."],
      ["7. Solidarité et cohésion", "L'esprit d'équipe est primordial. Aidez vos collègues et favorisez une ambiance de travail saine et constructive."],
      ["8. Éthique et déontologie", "L'intégrité et l'impartialité sont le fondement de notre action. Soyez justes et exemplaires en toutes circonstances."],
      ["Sanctions", "Tout manquement aux règles de la charte peut entraîner une punition ou une sanction progressives et individualisées."],
    ],
  },
];

function Lightbox({ fiche, onClose }) {
  useEffect(() => {
    const f = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(5,12,30,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflow: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, color: "#fff", flexWrap: "wrap" }}>
          <b style={{ fontFamily: "Georgia, serif", fontSize: 18 }}>{fiche.titre}</b>
          <span style={{ display: "flex", gap: 8 }}>
            <a href={fiche.img} download style={{ ...smallBtn, textDecoration: "none", background: "#fff" }}>⬇ Télécharger</a>
            <button onClick={onClose} style={{ ...smallBtn, background: "#fff" }}>✕ Fermer</button>
          </span>
        </div>
        <img src={fiche.img} alt={fiche.titre} style={{ maxWidth: "100%", maxHeight: "82vh", borderRadius: 10, boxShadow: "0 30px 60px -20px rgba(0,0,0,0.8)", background: "#fff" }} />
      </div>
    </div>
  );
}

export function FichesPage() {
  const [ouverte, setOuverte] = useState(null);
  const [detail, setDetail] = useState({});
  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #0F3A85, #0A2150 60%, #07142E)", color: "#fff", borderRadius: 22, padding: "24px 28px", marginBottom: 22, boxShadow: "0 30px 56px -34px rgba(7,20,46,0.9)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: "linear-gradient(90deg, #2F6FDE 0 33.3%, #fff 33.3% 66.6%, #E5384F 66.6%)" }} />
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#E3C766", fontWeight: 800 }}>DOCUMENTATION</div>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 30, fontWeight: 700, margin: "4px 0 6px" }}>Fiches de référence</div>
        <div style={{ fontSize: 14, color: "#C9D6EC", lineHeight: 1.55, maxWidth: 620 }}>Les documents à connaître : méthode AMER, cadre légal d'usage des armes et charte du respect. Clique sur une fiche pour l'agrandir.</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {FICHES.map((f) => (
          <div key={f.id} style={{ display: "flex", gap: 22, flexWrap: "wrap", background: "#fff", border: "1px solid #D3DDEA", borderTop: `5px solid ${f.couleur}`, borderRadius: 20, padding: 20, boxShadow: "0 22px 44px -30px rgba(7,20,46,0.6)" }}>
            <button type="button" onClick={() => setOuverte(f)} className="gh-card-anim" title="Agrandir" style={{ flex: "0 0 auto", width: 230, maxWidth: "100%", padding: 0, border: "1px solid #D3DDEA", borderRadius: 12, overflow: "hidden", background: "#EEF2F8", cursor: "zoom-in", alignSelf: "flex-start" }}>
              <img src={f.img} alt={f.titre} style={{ display: "block", width: "100%", height: "auto" }} />
            </button>
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg, ${f.couleur}, ${f.couleur}b0)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23, flexShrink: 0 }}>{f.icone}</span>
                <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 21, fontWeight: 700, color: "#0B1D44", lineHeight: 1.2 }}>{f.titre}</div>
              </div>
              <div style={{ fontSize: 13.5, color: "#5A6B84", lineHeight: 1.55, margin: "10px 0 14px" }}>{f.sous}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <button type="button" onClick={() => setOuverte(f)} style={{ ...smallBtn, background: f.couleur, color: "#fff", borderColor: f.couleur }}>🔍 Voir la fiche</button>
                <a href={f.img} download style={{ ...smallBtn, textDecoration: "none", display: "inline-block" }}>⬇ Télécharger</a>
                <button type="button" onClick={() => setDetail({ ...detail, [f.id]: !detail[f.id] })} style={smallBtn}>{detail[f.id] ? "Masquer le texte" : "📖 Lire le texte"}</button>
              </div>
              {detail[f.id] && (
                <div style={{ background: "#F6F9FD", border: "1px solid #E1E8F2", borderRadius: 14, padding: "6px 16px" }}>
                  {f.texte.map(([t, d]) => (
                    <div key={t} style={{ padding: "10px 0", borderBottom: "1px solid #E8EEF6" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: f.couleur, letterSpacing: 0.3 }}>{t}</div>
                      <div style={{ fontSize: 13.3, color: "#14213A", lineHeight: 1.6, marginTop: 2 }}>{d}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {ouverte && <Lightbox fiche={ouverte} onClose={() => setOuverte(null)} />}
    </div>
  );
}
