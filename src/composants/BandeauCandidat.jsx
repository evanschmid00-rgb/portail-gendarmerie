// composants/BandeauCandidat.jsx — bloc « Espace candidat » : photo (public/photo-candidat.jpg) intégrée dans un cadre bleu nuit, texte et bouton à côté.
import React, { useState } from "react";

const TRICOLORE = "linear-gradient(90deg, #2F6FDE 0 33.3%, #FFFFFF 33.3% 66.6%, #E5384F 66.6%)";

export function BandeauCandidat({ recrutementOuvert, titre, texte, bouton, onClick, principal = false, surtitre = "ESPACE CANDIDAT" }) {
  const [sansPhoto, setSansPhoto] = useState(false);
  const Titre = principal ? "h1" : "h2";
  return (
    <div className="gh-card-anim" style={{ position: "relative", overflow: "hidden", borderRadius: 26, background: "radial-gradient(520px 320px at 8% 0%, rgba(47,111,222,0.38), transparent 70%), linear-gradient(135deg, #0F3A85, #0A2150 70%, #07142E)", color: "#fff", boxShadow: "0 38px 70px -36px rgba(7,20,46,0.95)", marginBottom: 26 }}>
      <div style={{ height: 5, background: TRICOLORE }} />
      <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap", padding: "26px 28px 28px" }}>
        {!sansPhoto && (
          <div style={{ flex: "1 1 300px", maxWidth: 470, margin: "0 auto", position: "relative" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: -8, borderRadius: 24, background: "linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.05))" }} />
            <img src="/photo-candidat.jpg" alt="Espace candidat — Gendarmerie, centre d'information et de recrutement" onError={() => setSansPhoto(true)} style={{ position: "relative", display: "block", width: "100%", height: "auto", borderRadius: 18, boxShadow: "0 26px 44px -22px rgba(0,0,0,0.85)" }} />
          </div>
        )}
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: recrutementOuvert ? "rgba(46,125,79,0.95)" : "rgba(192,23,45,0.95)", fontSize: 11, fontWeight: 800, letterSpacing: 1, padding: "6px 14px", borderRadius: 20 }}>
            <span className="gn-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />{recrutementOuvert ? "RECRUTEMENT OUVERT" : "RECRUTEMENT FERMÉ"}
          </div>
          <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.7, fontWeight: 700, margin: "16px 0 6px" }}>{surtitre}</div>
          <Titre style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(24px, 4vw, 33px)", lineHeight: 1.15, margin: "0 0 10px", textShadow: "0 8px 30px rgba(0,0,0,0.45)" }}>{titre}</Titre>
          <div style={{ width: 70, height: 4, borderRadius: 2, background: "linear-gradient(90deg, #2F6FDE, #E5384F)", marginBottom: 12 }} />
          <div style={{ fontSize: 14.5, lineHeight: 1.65, color: "#D8E2F2", marginBottom: 20 }}>{texte}</div>
          <button type="button" onClick={onClick} className="gh-btn-anim" style={{ background: "#fff", color: "#0B3A8F", border: "none", borderRadius: 13, padding: "13px 26px", fontSize: 14.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 16px 28px -12px rgba(0,0,0,0.6)", fontFamily: "inherit" }}>{bouton}</button>
        </div>
      </div>
    </div>
  );
}
