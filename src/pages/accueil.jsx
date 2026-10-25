// pages/accueil.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { BadgeCheck, BookOpen, ClipboardList, Landmark, FileSearch, MessageSquare, ScrollText, Siren, Star, Users } from "lucide-react";
import React from "react";
import { CachetJustice } from "../composants/CachetJustice.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";

/* ---------- Page d'accueil publique ---------- */

// Photos d'illustration — remplace ces URL par de vraies photos libres de droits
// (ex: unsplash.com → clic droit sur une photo → "copier l'adresse de l'image").
const IMG_HERO = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/ImmersionBTA-Dammartin_%40GndBriceLapointe-110.jpg/1280px-ImmersionBTA-Dammartin_%40GndBriceLapointe-110.jpg";
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

export function PublicHome({ onNavigate, recrutementOuvert, nbQuestionnaires = 0, lienDiscord = "", lienJustice = "" }) {
  const cartes = [
    { key: "plainte", icon: Siren, titre: "Déposer plainte", texte: "Signalez des faits dont vous êtes victime ou témoin (comptes Roblox et Discord requis).", color: "#C0172D" },
    { key: "casier-public", icon: FileSearch, titre: "Consulter mon casier", texte: "Consultez les mentions enregistrées à votre nom.", color: "#2F6FDE" },
    { key: "hierarchie", icon: Landmark, titre: "Hiérarchie", texte: "Découvrez les gradés et les gendarmes de la brigade.", color: "#16305C" },
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
    <div className="gn-appear" style={{ background: "#E9EFF7", minHeight: "100vh", fontFamily: FONT_BASE, color: "#14213A" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 5, zIndex: 50, display: "flex" }}>
        <div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#FFFFFF" }} /><div style={{ flex: 1, background: "#C0172D" }} />
      </div>

      <div style={{ background: "#07142E", color: "#B9C2CF", fontSize: 11.5, textAlign: "center", padding: "9px 14px 7px", letterSpacing: 0.4 }}>Site de jeu de rôle (Roblox) · Serveur Nîmes RP · Contenu fictif</div>
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
            {lienJustice && <a href={lienJustice} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", background: "#8A6D1F", border: "1px solid #C9A227", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600 }}>⚖️ Palais de justice</a>}
            {lienDiscord && <a href={lienDiscord} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", background: "#5865F2", border: "1px solid #5865F2", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600 }}>💬 Rejoindre le Discord</a>}
            <button onClick={() => onNavigate("creer-compte")} className="gh-link-anim" style={{ background: "#2F6FDE", border: "1px solid #2F6FDE", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Créer mon compte</button>
            <button onClick={() => onNavigate("login")} className="gh-link-anim" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Espace gendarmes</button>
          </div>
        </div>

        <div style={{ maxWidth: 880, margin: "56px auto 0", textAlign: "center" }}>
          <div style={{ display: "inline-block", background: recrutementOuvert ? "#2E7D4F" : "#C0172D", color: "#fff", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, padding: "6px 14px", borderRadius: 20 }}>
            {recrutementOuvert ? "● RECRUTEMENT OUVERT" : "● RECRUTEMENT FERMÉ"}
          </div>
          <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 44, lineHeight: 1.15, fontWeight: 700, margin: "18px 0 14px", letterSpacing: 0.3 }}>Gendarmerie Nationale de Nîmes RP</h1>
          <div style={{ display: "flex", justifyContent: "center", margin: "0 auto 16px", width: 150, height: 4 }}><div style={{ flex: 1, background: "#2F6FDE" }} /><div style={{ flex: 1, background: "#FFFFFF" }} /><div style={{ flex: 1, background: "#E5384F" }} /></div>
          <div style={{ fontSize: 17, lineHeight: 1.6, color: "#D8E2F2" }}>Votre espace pour déposer plainte, consulter votre casier, donner votre avis et rejoindre nos rangs.</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
            <button onClick={() => onNavigate("plainte")} className="gh-link-anim" style={{ background: "linear-gradient(180deg, #D81F36, #B3142A)", border: "none", color: "#fff", borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 16px 30px -14px rgba(192,23,45,0.9)", fontFamily: FONT_BASE }}>🚨 Déposer plainte</button>
            {nbQuestionnaires > 0 && <button onClick={() => onNavigate("questionnaires")} className="gh-link-anim" style={{ background: "linear-gradient(180deg, #3D7DEB, #2A5FC4)", border: "none", color: "#fff", borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 16px 30px -14px rgba(47,111,222,0.9)", fontFamily: FONT_BASE }}>🎖️ Rejoindre la gendarmerie</button>}
            <button onClick={() => onNavigate("hierarchie")} className="gh-link-anim" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(4px)", fontFamily: FONT_BASE }}>Voir la hiérarchie</button>
          </div>
          <div style={{ marginTop: 22, display: "inline-block", background: "rgba(255,244,214,0.12)", border: "1px solid rgba(255,233,168,0.45)", color: "#FFE9A8", fontSize: 12.5, fontWeight: 600, padding: "7px 16px", borderRadius: 20 }}>⚠️ Site de jeu de rôle Roblox — usage RP uniquement, sans lien avec la Gendarmerie nationale réelle</div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "-38px auto 0", padding: "0 20px 60px", position: "relative" }}>
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: "4px solid #123A7A", borderRadius: 16, padding: "26px 26px 30px", boxShadow: "0 18px 40px -22px rgba(7,20,46,0.45)" }}>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, fontWeight: 700, marginBottom: 4, paddingBottom: 8, borderBottom: "3px solid transparent", borderImage: "linear-gradient(90deg, #0B3A8F 0 28px, #FFFFFF 28px 36px, #C0172D 36px 64px, #D3DDEA 64px 100%) 1" }}>Que souhaitez-vous faire ?</div>
          <div style={{ fontSize: 14, color: "#5A6B84", marginBottom: 20 }}>Choisissez une démarche ci-dessous.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14 }}>
            {cartes.map((c) => {
              const Icone = c.icon;
              return (
                <button key={c.key} onClick={() => onNavigate(c.key)} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 16, textAlign: "left", background: "#F5F8FC", border: "1px solid #D3DDEA", borderLeft: `5px solid ${c.color}`, borderRadius: 14, padding: "18px 18px", cursor: "pointer", fontFamily: FONT_BASE }}>
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

        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: "4px solid #123A7A", borderRadius: 16, padding: "24px 26px 28px", marginTop: 20, boxShadow: "0 18px 40px -26px rgba(7,20,46,0.4)" }}>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, fontWeight: 700, marginBottom: 4, paddingBottom: 8, borderBottom: "3px solid transparent", borderImage: "linear-gradient(90deg, #0B3A8F 0 28px, #FFFFFF 28px 36px, #C0172D 36px 64px, #D3DDEA 64px 100%) 1" }}>Votre avis compte</div>
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

        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: "4px solid #123A7A", borderRadius: 16, padding: "24px 26px 28px", marginTop: 20, boxShadow: "0 18px 40px -26px rgba(7,20,46,0.4)" }}>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, fontWeight: 700, marginBottom: 4, paddingBottom: 8, borderBottom: "3px solid transparent", borderImage: "linear-gradient(90deg, #0B3A8F 0 28px, #FFFFFF 28px 36px, #C0172D 36px 64px, #D3DDEA 64px 100%) 1" }}>Comment ça marche ?</div>
          <div style={{ fontSize: 14, color: "#5A6B84", marginBottom: 18 }}>Trois étapes, quelle que soit la démarche.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
            {[["1", "Liez vos comptes", "Roblox et Discord, vérifiés par un code reçu en message privé, pour que la gendarmerie puisse vous recontacter.", "#2F6FDE"], ["2", "Remplissez le formulaire", "Plainte, candidature, avis ou suggestion : tout se fait en ligne, étape par étape.", "#7B3FA0"], ["3", "Suivez la réponse", "Vous recevez un numéro de dossier et une réponse d'un gendarme, d'un OPJ ou de la Brigade de Recherche.", "#2E7D4F"]].map(([n, t, d, c]) => (
              <div key={n} style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 14, padding: "16px" }}>
                <span style={{ width: 36, height: 36, borderRadius: "50%", background: c, color: "#fff", fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
                <span>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#14213A" }}>{t}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "#5A6B84", marginTop: 3, lineHeight: 1.5 }}>{d}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {lienJustice && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px 20px" }}>
          <a href={lienJustice} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 18, textDecoration: "none", background: "linear-gradient(135deg, #0E2A5C, #123A7A 65%, #2B4F8F)", color: "#fff", borderRadius: 16, padding: "18px 26px", borderBottom: "4px solid #C9A227", boxShadow: "0 18px 40px -22px rgba(7,20,46,0.7)", flexWrap: "wrap" }}>
            <span style={{ background: "#fff", borderRadius: "50%", padding: 4, display: "inline-flex", flexShrink: 0 }}><CachetJustice taille={64} /></span>
            <span style={{ flex: 1, minWidth: 200 }}>
              <span style={{ display: "block", fontFamily: FONT_TITRE, fontSize: 22, fontWeight: 700 }}>Palais de justice — Tribunal judiciaire de Nîmes</span>
              <span style={{ display: "block", fontSize: 13.5, opacity: 0.9, marginTop: 2 }}>Retrouvez la justice du serveur : tribunal, magistrats et procédures.</span>
            </span>
            <span style={{ background: "#fff", color: "#123A7A", fontWeight: 700, fontSize: 13.5, borderRadius: 8, padding: "9px 18px" }}>Accéder →</span>
          </a>
        </div>
      )}

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

      <div style={{ background: "#07142E", color: "#B9C2CF", fontSize: 12.5, lineHeight: 1.7 }}>
        <div style={{ display: "flex", height: 4 }}><div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#FFFFFF" }} /><div style={{ flex: 1, background: "#C0172D" }} /></div>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 26 }}>
          <div>
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 17, fontWeight: 700, color: "#F2F6FC", marginBottom: 6 }}>Gendarmerie Nationale<br />Nîmes RP</div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#8FA0BA" }}>RÉPUBLIQUE FRANÇAISE — RP</div>
          </div>
          <div>
            <div style={{ color: "#F2F6FC", fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>Démarches</div>
            {[["plainte", "Déposer plainte"], ["casier-public", "Consulter mon casier"], ["suivi-candidature", "Suivre ma candidature"], ["code-penal", "Code pénal"], ["reglements", "Règlements"], ["hierarchie", "Hiérarchie"]].map(([k, l]) => (
              <div key={k}><button onClick={() => onNavigate(k)} style={{ background: "none", border: "none", color: "#B9C2CF", cursor: "pointer", padding: 0, fontSize: 12.5, fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>{l}</button></div>
            ))}
          </div>
          <div>
            <div style={{ color: "#F2F6FC", fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>Communauté</div>
            {lienDiscord && <div><a href={lienDiscord} target="_blank" rel="noopener noreferrer" style={{ color: "#B9C2CF" }}>Serveur Discord</a></div>}
            {lienJustice && <div><a href={lienJustice} target="_blank" rel="noopener noreferrer" style={{ color: "#B9C2CF" }}>Palais de justice</a></div>}
            <div><button onClick={() => onNavigate("login")} style={{ background: "none", border: "none", color: "#B9C2CF", cursor: "pointer", padding: 0, fontSize: 12.5, fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>Espace gendarmes</button></div>
          </div>
        </div>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "14px 20px 60px", borderTop: "1px solid rgba(255,255,255,0.12)", fontSize: 11.5, color: "#8FA0BA" }}>
          Nîmes RP — communauté de jeu de rôle sur Roblox. Les gendarmes, grades, plaintes et documents présentés sur ce site sont fictifs et sans aucune valeur officielle. Ce site n'est pas affilié à la Gendarmerie nationale ni à une administration réelle.
        </div>
      </div>
    </div>
  );
}

export const cardButtonStyle = { textAlign: "left", background: "#F2F6FC", border: "none", borderRadius: 14, padding: "16px 20px", cursor: "pointer", color: "#14213A", boxShadow: "0 10px 26px -10px rgba(0,0,0,0.55)", transition: "transform 0.15s ease" };
