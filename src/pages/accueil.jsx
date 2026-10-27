// pages/accueil.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { BadgeCheck, BookOpen, ClipboardList, FileSearch, MessageSquare, ScrollText, Siren, Star, Users } from "lucide-react";
import React from "react";
import { CachetJustice } from "../composants/CachetJustice.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";
import { LogoGN } from "../composants/LogoGN.jsx";

/* ---------- Page d'accueil publique ---------- */

// Photos d'illustration — remplace ces URL par de vraies photos libres de droits
// (ex: unsplash.com → clic droit sur une photo → "copier l'adresse de l'image").
const IMG_HERO = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/ImmersionBTA-Dammartin_%40GndBriceLapointe-110.jpg/1280px-ImmersionBTA-Dammartin_%40GndBriceLapointe-110.jpg";
const IMG_MISSIONS = "https://images.pexels.com/photos/4646839/pexels-photo-4646839.jpeg?auto=compress&cs=tinysrgb&w=900&h=700&fit=crop";
const IMG_GAV = "https://images.pexels.com/photos/4827706/pexels-photo-4827706.jpeg?auto=compress&cs=tinysrgb&w=900&h=700&fit=crop";

const TRICOLORE = "linear-gradient(90deg, #0B3A8F 0 33.3%, #FFFFFF 33.3% 66.6%, #C0172D 66.6% 100%)";
const TITRE_PANNEAU = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, fontWeight: 700, color: "#0F1E3D", lineHeight: 1.2 };

function Entete({ surtitre, titre, sous }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 2.4, fontWeight: 800, color: "#C0172D", textTransform: "uppercase", marginBottom: 6 }}>{surtitre}</div>
      <div style={TITRE_PANNEAU}>{titre}</div>
      <div style={{ display: "flex", width: 74, height: 4, borderRadius: 2, overflow: "hidden", margin: "10px 0 8px" }}><span style={{ flex: 1, background: "#0B3A8F" }} /><span style={{ flex: 1, background: "#D3DDEA" }} /><span style={{ flex: 1, background: "#C0172D" }} /></div>
      {sous && <div style={{ fontSize: 14, color: "#5A6B84", lineHeight: 1.5 }}>{sous}</div>}
    </div>
  );
}

// Grande carte cliquable : pastille d'icône, titre, texte et flèche
function CarteAction({ icon: Icone, titre, texte, color, onClick, grand = false }) {
  return (
    <button onClick={onClick} className="gh-btn-anim" style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, textAlign: "left", background: `linear-gradient(165deg, #fff 52%, ${color}14)`, border: "1px solid #D3DDEA", borderRadius: 20, padding: grand ? "26px 24px 22px" : "20px 20px 18px", cursor: "pointer", fontFamily: FONT_BASE, boxShadow: "0 14px 30px -20px rgba(7,20,46,0.5)", minHeight: grand ? 184 : 150 }}>
      <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: color }} />
      <span style={{ position: "absolute", right: -26, top: -26, width: 110, height: 110, borderRadius: "50%", background: `${color}14` }} />
      <span style={{ position: "relative", width: grand ? 56 : 50, height: grand ? 56 : 50, borderRadius: 16, background: `linear-gradient(135deg, ${color}, ${color}cc)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 12px 22px -12px ${color}` }}>
        <Icone size={grand ? 28 : 25} color="#fff" strokeWidth={2} />
      </span>
      <span style={{ position: "relative", display: "block" }}>
        <span style={{ display: "block", fontSize: grand ? 19 : 17, fontWeight: 800, color: "#14213A", letterSpacing: -0.2 }}>{titre}</span>
        <span style={{ display: "block", fontSize: 13.3, color: "#5A6B84", marginTop: 5, lineHeight: 1.5 }}>{texte}</span>
      </span>
      <span style={{ position: "relative", marginTop: "auto", fontSize: 12.5, fontWeight: 800, color, display: "inline-flex", alignItems: "center", gap: 8, background: `${color}14`, border: `1px solid ${color}40`, borderRadius: 20, padding: "5px 6px 5px 14px" }}>Accéder <span style={{ width: 22, height: 22, borderRadius: "50%", background: color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>→</span></span>
    </button>
  );
}

function PuceAvis({ icon: Icone, titre, texte, color, onClick }) {
  return (
    <button onClick={onClick} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", background: "#F7FAFD", border: "1px solid #D3DDEA", borderRadius: 16, padding: "14px 16px", cursor: "pointer", fontFamily: FONT_BASE }}>
      <span style={{ width: 46, height: 46, borderRadius: 14, background: `${color}1f`, border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icone size={22} color={color} strokeWidth={2.1} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: "#14213A" }}>{titre}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "#5A6B84", marginTop: 2, lineHeight: 1.45 }}>{texte}</span>
      </span>
      <span style={{ color, fontSize: 18, fontWeight: 800 }}>→</span>
    </button>
  );
}

/* ---------- Page « Consulter un document me concernant » ---------- */

export function DocumentsPublic({ onNavigate, onCancel }) {
  return (
    <div className="gn-appear" style={{ minHeight: "100vh", background: "#E9EFF7", padding: "0 0 60px", fontFamily: FONT_BASE }}>
      <div style={{ height: 5, background: TRICOLORE }} />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "26px 20px 0" }}>
        <button onClick={onCancel} style={{ background: "#fff", border: "1px solid #C3D0E2", borderRadius: 20, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, marginBottom: 18 }}>← Retour</button>
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: "4px solid #123A7A", borderRadius: 18, padding: "26px 26px 28px", boxShadow: "0 18px 40px -26px rgba(7,20,46,0.45)" }}>
          <Entete surtitre="Mes démarches" titre="Consulter un document me concernant" sous="Choisis le document que tu souhaites consulter." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            <CarteAction icon={FileSearch} titre="Mon casier judiciaire" texte="Consulte les mentions enregistrées à ton nom, avec ton compte Roblox." color="#2F6FDE" onClick={() => onNavigate("casier-public")} />
            <CarteAction icon={BadgeCheck} titre="Ma candidature" texte="Suis la réponse à ta candidature avec ton numéro de dossier." color="#2E7D4F" onClick={() => onNavigate("suivi-candidature")} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page d'accueil publique ---------- */

export function PublicHome({ onNavigate, recrutementOuvert, nbQuestionnaires = 0, lienDiscord = "", lienJustice = "" }) {
  const cartes = [
    { key: "plainte", icon: Siren, titre: "Déposer plainte", texte: "Signalez des faits dont vous êtes victime ou témoin, contre un civil ou contre un gendarme.", color: "#C0172D", grand: true },
    { key: "documents", icon: FileSearch, titre: "Consulter un document me concernant", texte: "Votre casier judiciaire ou le suivi de votre candidature.", color: "#2F6FDE", grand: true },
    ...(nbQuestionnaires > 0 ? [{ key: "questionnaires", icon: ClipboardList, titre: "Rejoindre la gendarmerie", texte: recrutementOuvert ? "Le recrutement est ouvert : accédez aux candidatures." : "Consultez les questionnaires actuellement ouverts.", color: "#2E7D4F", grand: true }] : []),
    { key: "cadre-juridique", icon: BookOpen, titre: "Cadre juridique", texte: "Code pénal, procédure pénale, sécurité intérieure, route…", color: "#123A7A" },
    { key: "reglements", icon: ScrollText, titre: "Règlements", texte: "Consultez les règles à respecter sur le serveur.", color: "#B7791F" },
  ];
  // Donner son avis ou une idée (formulaires ouverts à tous, comptes Roblox et Discord liés)
  const avis = [
    { key: "avis-general", icon: Star, titre: "Avis sur la brigade", texte: "Notez la gendarmerie et dites-nous ce que vous en pensez.", color: "#B7791F" },
    { key: "avis-gendarme", icon: Users, titre: "Avis sur un agent", texte: "Félicitez ou commentez le comportement d'un gendarme.", color: "#2E7D4F" },
    { key: "suggestion", icon: MessageSquare, titre: "Faire une suggestion", texte: "Une idée pour améliorer la gendarmerie ou le site ?", color: "#7B3FA0" },
  ];
  const principales = cartes.filter((c) => c.grand);
  const secondaires = cartes.filter((c) => !c.grand);
  const lienFooter = { background: "none", border: "none", color: "#B9C2CF", cursor: "pointer", padding: 0, fontSize: 12.5, fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 };

  return (
    <div className="gn-appear" style={{ background: "#E9EFF7", minHeight: "100vh", fontFamily: FONT_BASE, color: "#14213A" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 5, zIndex: 50, background: TRICOLORE }} />

      <div style={{ background: "#07142E", color: "#B9C2CF", fontSize: 11.5, textAlign: "center", padding: "10px 14px 7px", letterSpacing: 0.4 }}>Site de jeu de rôle (Roblox) · Serveur Nîmes RP · Contenu fictif</div>

      {/* Bandeau d'accueil */}
      <div style={{ position: "relative", backgroundImage: `linear-gradient(180deg, rgba(7,20,46,0.8), rgba(7,20,46,0.95)), url(${IMG_HERO})`, backgroundSize: "cover", backgroundPosition: "center", color: "#F2F6FC", padding: "5px 20px 96px", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -140, right: -120, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(47,111,222,0.35), transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -160, left: -100, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(192,23,45,0.25), transparent 70%)" }} />
        <><style>{".gn-ecusson{display:none}@media (min-width:1300px){.gn-ecusson{display:block}}"}</style><img className="gn-ecusson" src="/ecusson-gn.png" alt="" aria-hidden="true" style={{ position: "absolute", right: "3%", top: 150, width: 150, height: "auto", opacity: 0.95, pointerEvents: "none", filter: "drop-shadow(0 14px 24px rgba(0,0,0,0.55))" }} /></>
        <div style={{ position: "relative", maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LogoGN taille={56} />
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 2.5, opacity: 0.75 }}>RÉPUBLIQUE FRANÇAISE — RP</div>
              <div style={{ fontFamily: FONT_TITRE, fontSize: 19, fontWeight: 700 }}>Gendarmerie Nationale</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {lienJustice && <a href={lienJustice} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", background: "#8A6D1F", border: "1px solid #C9A227", color: "#fff", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600 }}>⚖️ Palais de justice</a>}
            {lienDiscord && <a href={lienDiscord} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", background: "#5865F2", border: "1px solid #5865F2", color: "#fff", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600 }}>💬 Rejoindre le Discord</a>}
            <button onClick={() => onNavigate("login")} className="gh-link-anim" style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", backdropFilter: "blur(4px)" }}>🔐 Espace gendarmes</button>
          </div>
        </div>

        <div style={{ position: "relative", maxWidth: 880, margin: "56px auto 0", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: recrutementOuvert ? "rgba(46,125,79,0.9)" : "rgba(192,23,45,0.9)", color: "#fff", fontSize: 11.5, fontWeight: 800, letterSpacing: 1, padding: "7px 16px", borderRadius: 20, boxShadow: "0 10px 24px -12px rgba(0,0,0,0.6)" }}>
            <span className="gn-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
            {recrutementOuvert ? "RECRUTEMENT OUVERT" : "RECRUTEMENT FERMÉ"}
          </div>
          <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(30px, 6vw, 50px)", lineHeight: 1.12, fontWeight: 700, margin: "20px 0 16px", letterSpacing: 0.3, textShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>Gendarmerie Nationale de Nîmes RP</h1>
          <div style={{ display: "flex", justifyContent: "center", margin: "0 auto 18px", width: 160, height: 4, borderRadius: 2, overflow: "hidden" }}><div style={{ flex: 1, background: "#2F6FDE" }} /><div style={{ flex: 1, background: "#FFFFFF" }} /><div style={{ flex: 1, background: "#E5384F" }} /></div>
          <div style={{ fontSize: 17.5, lineHeight: 1.65, color: "#D8E2F2", maxWidth: 680, margin: "0 auto" }}>Votre espace pour déposer plainte, consulter vos documents, donner votre avis et rejoindre nos rangs.</div>
          <div style={{ marginTop: 24, display: "inline-block", background: "rgba(255,244,214,0.12)", border: "1px solid rgba(255,233,168,0.45)", color: "#FFE9A8", fontSize: 12.5, fontWeight: 600, padding: "8px 18px", borderRadius: 20 }}>⚠️ Site de jeu de rôle Roblox — usage RP uniquement, sans lien avec la Gendarmerie nationale réelle</div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "-56px auto 0", padding: "0 20px 40px", position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 16 }}>
          {[["🛡️", "Gendarmerie de Nîmes RP", "Serveur de jeu de rôle Roblox"], ["📨", "Démarches en ligne", "Plainte, documents, candidature"], ["🚨", "Urgence réelle", "Composez le 17 ou le 112"]].map(([e, t, s]) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.96)", border: "1px solid #D3DDEA", borderRadius: 14, padding: "11px 14px", boxShadow: "0 12px 26px -20px rgba(7,20,46,0.6)" }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: "#E9EFF7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>{e}</span>
              <span style={{ lineHeight: 1.3 }}><span style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#14213A" }}>{t}</span><span style={{ display: "block", fontSize: 12, color: "#5A6B84" }}>{s}</span></span>
            </div>
          ))}
        </div>
        {/* Démarches */}
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 22, padding: "28px 26px 30px", boxShadow: "0 24px 50px -26px rgba(7,20,46,0.55)" }}>
          <Entete surtitre="Démarches" titre="Que souhaitez-vous faire ?" sous="Choisissez une démarche ci-dessous." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 16, marginBottom: 16 }}>
            {principales.map((c) => <CarteAction key={c.key} icon={c.icon} titre={c.titre} texte={c.texte} color={c.color} grand onClick={() => onNavigate(c.key)} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
            {secondaires.map((c) => <CarteAction key={c.key} icon={c.icon} titre={c.titre} texte={c.texte} color={c.color} onClick={() => onNavigate(c.key)} />)}
          </div>
        </div>

        {/* Avis et suggestions */}
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: "5px solid #B7791F", borderRadius: 22, padding: "26px 26px 28px", marginTop: 22, boxShadow: "0 18px 40px -28px rgba(7,20,46,0.45)" }}>
          <Entete surtitre="Votre parole" titre="Votre avis compte" sous="Donnez votre avis sur la brigade ou sur un agent, ou proposez une idée. Comptes Roblox et Discord requis." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 12 }}>
            {avis.map((c) => <PuceAvis key={c.key} icon={c.icon} titre={c.titre} texte={c.texte} color={c.color} onClick={() => onNavigate(c.key)} />)}
          </div>
        </div>
      </div>

      {lienJustice && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px 20px" }}>
          <a href={lienJustice} target="_blank" rel="noopener noreferrer" className="gh-card-anim" style={{ display: "flex", alignItems: "center", gap: 18, textDecoration: "none", background: "linear-gradient(135deg, #0E2A5C, #123A7A 65%, #2B4F8F)", color: "#fff", borderRadius: 20, padding: "20px 28px", borderBottom: "4px solid #C9A227", boxShadow: "0 18px 40px -22px rgba(7,20,46,0.7)", flexWrap: "wrap" }}>
            <span style={{ background: "#fff", borderRadius: "50%", padding: 4, display: "inline-flex", flexShrink: 0 }}><CachetJustice taille={64} /></span>
            <span style={{ flex: 1, minWidth: 200 }}>
              <span style={{ display: "block", fontFamily: FONT_TITRE, fontSize: 22, fontWeight: 700 }}>Palais de justice — Tribunal judiciaire de Nîmes</span>
              <span style={{ display: "block", fontSize: 13.5, opacity: 0.9, marginTop: 2 }}>Retrouvez la justice du serveur : tribunal, magistrats et procédures.</span>
            </span>
            <span style={{ background: "#fff", color: "#123A7A", fontWeight: 700, fontSize: 13.5, borderRadius: 10, padding: "10px 20px" }}>Accéder →</span>
          </a>
        </div>
      )}

      {lienDiscord && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px 34px" }}>
          <a href={lienDiscord} target="_blank" rel="noopener noreferrer" className="gh-card-anim" style={{ display: "flex", alignItems: "center", gap: 16, textDecoration: "none", background: "linear-gradient(135deg, #5865F2, #3A46C4)", color: "#fff", borderRadius: 20, padding: "22px 28px", boxShadow: "0 18px 40px -22px rgba(88,101,242,0.7)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 36 }}>💬</span>
            <span style={{ flex: 1, minWidth: 200 }}>
              <span style={{ display: "block", fontFamily: FONT_TITRE, fontSize: 22, fontWeight: 700 }}>Rejoins notre serveur Discord</span>
              <span style={{ display: "block", fontSize: 13.5, opacity: 0.9, marginTop: 2 }}>Retrouve la communauté de la gendarmerie, les annonces et le recrutement.</span>
            </span>
            <span style={{ background: "#fff", color: "#3A46C4", fontWeight: 700, fontSize: 13.5, borderRadius: 10, padding: "10px 20px" }}>Rejoindre →</span>
          </a>
        </div>
      )}

      <div style={{ background: "#07142E", color: "#B9C2CF", fontSize: 12.5, lineHeight: 1.7 }}>
        <div style={{ height: 4, background: TRICOLORE }} />
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "30px 20px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 26 }}>
          <div>
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 17, fontWeight: 700, color: "#F2F6FC", marginBottom: 6 }}>Gendarmerie Nationale<br />Nîmes RP</div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#8FA0BA" }}>RÉPUBLIQUE FRANÇAISE — RP</div>
          </div>
          <div>
            <div style={{ color: "#F2F6FC", fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>Démarches</div>
            {[["plainte", "Déposer plainte"], ["documents", "Consulter un document me concernant"], ["cadre-juridique", "Cadre juridique"], ["reglements", "Règlements"]].map(([k, l]) => (
              <div key={k}><button onClick={() => onNavigate(k)} style={lienFooter}>{l}</button></div>
            ))}
          </div>
          <div>
            <div style={{ color: "#F2F6FC", fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>Communauté</div>
            {lienDiscord && <div><a href={lienDiscord} target="_blank" rel="noopener noreferrer" style={{ color: "#B9C2CF" }}>Serveur Discord</a></div>}
            {lienJustice && <div><a href={lienJustice} target="_blank" rel="noopener noreferrer" style={{ color: "#B9C2CF" }}>Palais de justice</a></div>}
            <div><button onClick={() => onNavigate("login")} style={lienFooter}>Espace gendarmes</button></div>
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
