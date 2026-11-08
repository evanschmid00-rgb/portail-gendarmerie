// composants/BandeauCandidat.jsx — bloc « Espace candidat » : texte, atouts et boutons à gauche, photo (public/photo-candidat.jpg) dans un cadre doré à droite.
import React, { useState } from "react";
import { LogoGN } from "./LogoGN.jsx";

const TRICOLORE = "linear-gradient(90deg, #2F6FDE 0 33.3%, #FFFFFF 33.3% 66.6%, #E5384F 66.6%)";
const OR = "#C9A227";
const ATOUTS = [["📋", "Candidature 100 % en ligne"], ["⏱", "Réponse rapide"], ["🎓", "Formation au CEGN"], ["💬", "Suivi par Discord"]];

export function BandeauCandidat({ recrutementOuvert, titre, texte, bouton, onClick, principal = false, surtitre = "ESPACE CANDIDAT", boutonSecondaire, onSecondaire }) {
  const [sansPhoto, setSansPhoto] = useState(false);
  const Titre = principal ? "h1" : "h2";
  return (
    <div className="gh-card-anim" style={{ position: "relative", overflow: "hidden", borderRadius: 28, background: "radial-gradient(620px 380px at 0% 0%, rgba(47,111,222,0.45), transparent 70%), radial-gradient(520px 340px at 100% 100%, rgba(201,162,39,0.22), transparent 70%), linear-gradient(135deg, #0F3A85, #0A2150 60%, #07142E)", color: "#fff", boxShadow: "0 42px 80px -40px rgba(7,20,46,0.9)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ height: 6, background: TRICOLORE }} />
      <div style={{ display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap", padding: "38px 40px 40px" }}>
        <div style={{ flex: "1 1 340px", minWidth: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: recrutementOuvert ? "rgba(46,125,79,0.95)" : "rgba(192,23,45,0.95)", fontSize: 11, fontWeight: 800, letterSpacing: 1.2, padding: "7px 15px", borderRadius: 20, boxShadow: "0 10px 20px -10px rgba(0,0,0,0.6)" }}>
            <span className="gn-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />{recrutementOuvert ? "RECRUTEMENT OUVERT" : "RECRUTEMENT FERMÉ"}
          </div>
          <div style={{ fontSize: 11, letterSpacing: 3.2, color: "#E3C766", fontWeight: 800, margin: "18px 0 8px" }}>{surtitre}</div>
          <Titre style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(28px, 4.6vw, 44px)", lineHeight: 1.1, margin: "0 0 14px", textShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>{titre}</Titre>
          <div style={{ width: 90, height: 4, borderRadius: 2, background: `linear-gradient(90deg, #2F6FDE, ${OR}, #E5384F)`, marginBottom: 16 }} />
          <div style={{ fontSize: 15.5, lineHeight: 1.7, color: "#D8E2F2", marginBottom: 20, maxWidth: 520 }}>{texte}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {ATOUTS.map(([ic, t]) => <span key={t} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, color: "#EAF1FF" }}>{ic} {t}</span>)}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={onClick} className="gh-btn-anim" style={{ background: "#fff", color: "#0B3A8F", border: "none", borderRadius: 14, padding: "15px 30px", fontSize: 15.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 18px 30px -12px rgba(0,0,0,0.7)", fontFamily: "inherit" }}>{bouton}</button>
            {boutonSecondaire && <button type="button" onClick={onSecondaire} className="gh-btn-anim" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.55)", borderRadius: 14, padding: "15px 24px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{boutonSecondaire}</button>}
          </div>
        </div>
        {!sansPhoto && (
          <div style={{ flex: "1 1 340px", maxWidth: 500, margin: "0 auto", position: "relative" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: -10, borderRadius: 26, background: `linear-gradient(135deg, ${OR}, rgba(255,255,255,0.15) 55%, ${OR})`, opacity: 0.9, transform: "rotate(2deg)" }} />
            <img src="/photo-candidat.jpg" alt="Espace candidat — Gendarmerie, centre d'information et de recrutement" onError={() => setSansPhoto(true)} style={{ position: "relative", display: "block", width: "100%", height: "auto", borderRadius: 20, boxShadow: "0 30px 50px -22px rgba(0,0,0,0.9)", border: "3px solid #0A2150" }} />
            <div style={{ position: "absolute", left: -18, bottom: -18, background: "#0A2150", borderRadius: "50%", padding: 5, boxShadow: "0 14px 24px -10px rgba(0,0,0,0.8)", border: `2px solid ${OR}` }}><LogoGN taille={66} anneau={false} /></div>
          </div>
        )}
      </div>
    </div>
  );
}
