// pages/accueil.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { BadgeCheck, BookOpen, ClipboardList, FileSearch, MessageSquare, ScrollText, Siren, Star, Users } from "lucide-react";
import React from "react";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";

/* ---------- Page d'accueil publique ---------- */

// Photos d'illustration — remplace ces URL par de vraies photos libres de droits
// (ex: unsplash.com → clic droit sur une photo → "copier l'adresse de l'image").
const IMG_HERO = "https://images.pexels.com/photos/18403814/pexels-photo-18403814.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop";
const IMG_MISSIONS = "https://images.pexels.com/photos/4646839/pexels-photo-4646839.jpeg?auto=compress&cs=tinysrgb&w=900&h=700&fit=crop";
const IMG_GAV = "https://images.pexels.com/photos/4827706/pexels-photo-4827706.jpeg?auto=compress&cs=tinysrgb&w=900&h=700&fit=crop";

function SideAction({ icon: Icon, label, color, onClick, side }) {
  return (
    <button
      onClick={onClick}
      className="gh-btn-anim"
      title={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        background: "rgba(7,20,46,0.55)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(242,246,252,0.15)",
        borderRadius: 14,
        padding: "12px 10px",
        cursor: "pointer",
        width: 84,
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 10, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={17} color="#F2F6FC" strokeWidth={1.8} />
      </div>
      <div style={{ fontSize: 10, color: "#F2F6FC", textAlign: "center", lineHeight: 1.25, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{label}</div>
    </button>
  );
}

function InfoCard({ icon: Icon, title, children }) {
  return (
    <div className="gh-card-anim" style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -12px rgba(7,20,46,0.25)" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#123A7A", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Icon size={19} color="#F2F6FC" strokeWidth={1.8} />
      </div>
      <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#14213A" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#3A4D6B", lineHeight: 1.6, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{children}</div>
    </div>
  );
}

export function PublicHome({ onNavigate, recrutementOuvert, nbQuestionnaires = 0, lienDiscord = "" }) {
  const cartes = [
    { key: "plainte", icon: Siren, titre: "Déposer plainte", texte: "Signalez des faits dont vous êtes victime ou témoin.", color: "#C0172D" },
    { key: "casier-public", icon: FileSearch, titre: "Consulter mon casier", texte: "Consultez les mentions enregistrées à votre nom.", color: "#2F6FDE" },
    { key: "code-penal", icon: BookOpen, titre: "Code pénal", texte: "Retrouvez les infractions et leurs sanctions.", color: "#123A7A" },
    { key: "reglements", icon: ScrollText, titre: "Règlements", texte: "Consultez les règles à respecter sur le serveur.", color: "#B7791F" },
    { key: "suivi-candidature", icon: BadgeCheck, titre: "Suivre ma candidature", texte: "Consultez la réponse avec votre numéro de dossier.", color: "#2E7D4F" },
    ...(nbQuestionnaires > 0 ? [{ key: "questionnaires", icon: ClipboardList, titre: "Rejoindre la gendarmerie", texte: recrutementOuvert ? "Le recrutement est ouvert : accédez aux candidatures." : "Consultez les questionnaires actuellement ouverts.", color: "#2E7D4F" }] : []),
  ];
  // Donner son avis ou une idée (formulaires anonymes ouverts à tous)
  const avis = [
    { key: "avis-general", icon: Star, titre: "Avis sur la brigade", texte: "Notez la gendarmerie et dites-nous ce que vous en pensez.", color: "#B7791F" },
    { key: "avis-gendarme", icon: Users, titre: "Avis sur un agent", texte: "Félicitez ou commentez le comportement d'un gendarme.", color: "#2E7D4F" },
    { key: "suggestion", icon: MessageSquare, titre: "Faire une suggestion", texte: "Une idée pour améliorer la gendarmerie ou le site ? Écrivez-nous.", color: "#7B3FA0" },
  ];

  return (
    <div style={{ background: "#E9EFF7", minHeight: "100vh", fontFamily: FONT_BASE, color: "#14213A" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 5, zIndex: 50, display: "flex" }}>
        <div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#FFFFFF" }} /><div style={{ flex: 1, background: "#C0172D" }} />
      </div>

      <div style={{ backgroundImage: `linear-gradient(180deg, rgba(7,20,46,0.78), rgba(7,20,46,0.92)), url(${IMG_HERO})`, backgroundSize: "cover", backgroundPosition: "center", color: "#F2F6FC", padding: "5px 20px 70px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid #CFE0FF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_TITRE, fontWeight: 700, fontSize: 18, color: "#CFE0FF" }}>GN</div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 2.5, opacity: 0.75 }}>RÉPUBLIQUE FRANÇAISE — RP</div>
              <div style={{ fontFamily: FONT_TITRE, fontSize: 19, fontWeight: 700 }}>Gendarmerie Nationale</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {lienDiscord && <a href={lienDiscord} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", background: "#5865F2", border: "1px solid #5865F2", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600 }}>💬 Rejoindre le Discord</a>}
            <button onClick={() => onNavigate("creer-compte")} className="gh-link-anim" style={{ background: "#2F6FDE", border: "1px solid #2F6FDE", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Créer mon compte</button>
            <button onClick={() => onNavigate("login")} className="gh-link-anim" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Espace gendarmes</button>
          </div>
        </div>

        <div style={{ maxWidth: 880, margin: "56px auto 0", textAlign: "center" }}>
          <div style={{ display: "inline-block", background: recrutementOuvert ? "#2E7D4F" : "#C0172D", color: "#fff", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, padding: "6px 14px", borderRadius: 20 }}>
            {recrutementOuvert ? "● RECRUTEMENT OUVERT" : "● RECRUTEMENT FERMÉ"}
          </div>
          <h1 style={{ fontFamily: FONT_TITRE, fontSize: 46, lineHeight: 1.1, fontWeight: 700, margin: "18px 0 12px" }}>Gendarmerie Nationale de Black RP</h1>
          <div style={{ fontSize: 17, lineHeight: 1.6, color: "#D8E2F2" }}>Votre espace pour déposer plainte, consulter votre casier, donner votre avis et rejoindre nos rangs.</div>
          <div style={{ marginTop: 22, display: "inline-block", background: "rgba(255,244,214,0.12)", border: "1px solid rgba(255,233,168,0.45)", color: "#FFE9A8", fontSize: 12.5, fontWeight: 600, padding: "7px 16px", borderRadius: 20 }}>⚠️ Site de jeu de rôle Roblox — usage RP uniquement, sans lien avec la Gendarmerie nationale réelle</div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "-38px auto 0", padding: "0 20px 60px", position: "relative" }}>
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 16, padding: "26px 26px 30px", boxShadow: "0 18px 40px -22px rgba(7,20,46,0.45)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Que souhaitez-vous faire ?</div>
          <div style={{ fontSize: 14, color: "#5A6B84", marginBottom: 20 }}>Choisissez une démarche ci-dessous.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14 }}>
            {cartes.map((c) => {
              const Icone = c.icon;
              return (
                <button key={c.key} onClick={() => onNavigate(c.key)} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 16, textAlign: "left", background: "#F5F8FC", border: "1px solid #D3DDEA", borderLeft: `5px solid ${c.color}`, borderRadius: 12, padding: "18px 18px", cursor: "pointer", fontFamily: FONT_BASE }}>
                  <span style={{ width: 48, height: 48, borderRadius: 12, background: c.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icone size={24} color="#fff" strokeWidth={2} />
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: "#14213A" }}>{c.titre}</span>
                    <span style={{ display: "block", fontSize: 13, color: "#5A6B84", marginTop: 3, lineHeight: 1.45 }}>{c.texte}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 16, padding: "24px 26px 28px", marginTop: 20, boxShadow: "0 18px 40px -26px rgba(7,20,46,0.4)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Votre avis compte</div>
          <div style={{ fontSize: 14, color: "#5A6B84", marginBottom: 18 }}>Donnez votre avis sur la brigade ou sur un agent, ou proposez une idée. C'est simple et rapide.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
            {avis.map((c) => {
              const Icone = c.icon;
              return (
                <button key={c.key} onClick={() => onNavigate(c.key)} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", background: "#F5F8FC", border: "1px solid #D3DDEA", borderLeft: `5px solid ${c.color}`, borderRadius: 12, padding: "16px 16px", cursor: "pointer", fontFamily: FONT_BASE }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: c.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icone size={22} color="#fff" strokeWidth={2} />
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: "#14213A" }}>{c.titre}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "#5A6B84", marginTop: 3, lineHeight: 1.45 }}>{c.texte}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {lienDiscord && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px 30px" }}>
          <a href={lienDiscord} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 16, textDecoration: "none", background: "linear-gradient(135deg, #5865F2, #3A46C4)", color: "#fff", borderRadius: 16, padding: "20px 26px", boxShadow: "0 18px 40px -22px rgba(88,101,242,0.7)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 34 }}>💬</span>
            <span style={{ flex: 1, minWidth: 200 }}>
              <span style={{ display: "block", fontFamily: FONT_TITRE, fontSize: 22, fontWeight: 700 }}>Rejoins notre serveur Discord</span>
              <span style={{ display: "block", fontSize: 13.5, opacity: 0.9, marginTop: 2 }}>Retrouve la communauté de la gendarmerie, les annonces et le recrutement.</span>
            </span>
            <span style={{ background: "#fff", color: "#3A46C4", fontWeight: 700, fontSize: 13.5, borderRadius: 8, padding: "9px 18px" }}>Rejoindre →</span>
          </a>
        </div>
      )}

      <div style={{ background: "#07142E", color: "#B9C2CF", padding: "26px 20px 60px", textAlign: "center", fontSize: 12, lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, color: "#F2F6FC", marginBottom: 4 }}>Black RP — communauté de jeu de rôle sur Roblox</div>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>Les gendarmes, grades, plaintes et documents présentés sur ce site sont fictifs et sans aucune valeur officielle. Ce site n'est pas affilié à la Gendarmerie nationale ni à l'État. En cas d'urgence réelle, appelle le 17 ou le 112.</div>
      </div>
    </div>
  );
}

export const cardButtonStyle = { textAlign: "left", background: "#F2F6FC", border: "none", borderRadius: 14, padding: "16px 20px", cursor: "pointer", color: "#14213A", boxShadow: "0 10px 26px -10px rgba(0,0,0,0.55)", transition: "transform 0.15s ease" };
