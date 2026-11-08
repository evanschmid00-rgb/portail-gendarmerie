// pages/accueil.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { BadgeCheck, BookOpen, Car, FileSearch, GraduationCap, Scale, ScrollText, Shield, Siren, UserPlus, Users } from "lucide-react";
import React from "react";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";
import { LogoGN } from "../composants/LogoGN.jsx";
import { LogoAMGN } from "../composants/LogoAMGN.jsx";
import { BandeauCandidat } from "../composants/BandeauCandidat.jsx";

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

// Carte de démarche compacte : icône, titre, texte, flèche
function CarteSimple({ icon: Icone, titre, texte, color, onClick }) {
  return (
    <button onClick={onClick} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", background: "#F7FAFD", border: "1px solid #D3DDEA", borderLeft: `5px solid ${color}`, borderRadius: 16, padding: "16px 18px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 10px 24px -20px rgba(7,20,46,0.5)" }}>
      <span style={{ width: 50, height: 50, borderRadius: 15, background: `linear-gradient(135deg, ${color}, ${color}cc)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 10px 18px -10px ${color}` }}><Icone size={24} color="#fff" strokeWidth={2} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: "#14213A" }}>{titre}</span>
        <span style={{ display: "block", fontSize: 12.8, color: "#5A6B84", marginTop: 3, lineHeight: 1.45 }}>{texte}</span>
      </span>
      <span style={{ color, fontSize: 20, fontWeight: 800 }}>→</span>
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

const aller = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
const OR = "#C9A227";

function Section({ id, surtitre, titre, sous, children, fond = "transparent" }) {
  return (
    <section id={id} style={{ background: fond, padding: "58px 20px", scrollMarginTop: 64 }}>
      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        <Entete surtitre={surtitre} titre={titre} sous={sous} />
        {children}
      </div>
    </section>
  );
}

export function PublicHome({ onNavigate, recrutementOuvert, nbQuestionnaires = 0, lienDiscord = "" }) {
  const lienFooter = { background: "none", border: "none", color: "#B9C2CF", cursor: "pointer", padding: 0, fontSize: 12.5, fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 };
  const lienNav = { background: "none", border: "none", color: "#D8E2F2", cursor: "pointer", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", padding: "6px 4px" };
  const acces = [
    { key: "plainte", icon: Siren, titre: "Déposer plainte", texte: "Contre un civil ou contre un gendarme", color: "#C0172D" },
    { key: "casier-public", icon: FileSearch, titre: "Mon casier judiciaire", texte: "Avec ton compte Roblox", color: "#2F6FDE" },
    { key: "suivi-candidature", icon: BadgeCheck, titre: "Suivre ma candidature", texte: "Avec ton numéro de dossier", color: "#2E7D4F" },
  ];
  const missions = [
    { icon: Shield, titre: "Sécurité & prévention", texte: "Patrouilles, présence sur le terrain et protection des habitants de Saint-Tropez.", color: "#123A7A" },
    { icon: Car, titre: "Sécurité routière", texte: "Contrôles, constatation des infractions et prévention des accidents.", color: "#0E7C86" },
    { icon: Scale, titre: "Police judiciaire", texte: "Enquêtes, procès-verbaux, plaintes et suivi des affaires par nos OPJ.", color: "#8A6D1F" },
    { icon: Users, titre: "Proximité & assistance", texte: "Accueil du public, aide aux victimes et lien avec la population.", color: "#2E7D4F" },
  ];
  const etapes = [
    ["1", "Choisis la démarche", "Plainte contre un civil ou contre un gendarme : le formulaire s'adapte."],
    ["2", "Décris les faits", "Date, lieu, personnes concernées, témoins et preuves éventuelles."],
    ["3", "On s'en occupe", "Ta plainte est transmise aux officiers de police judiciaire ; celles visant un gendarme sont traitées par l'État-Major."],
  ];
  return (
    <div className="gn-appear" style={{ background: "#EEF3F9", minHeight: "100vh", fontFamily: FONT_BASE, color: "#14213A" }}>
      <style>{`@media (max-width: 760px) { .acc-nav-liens { display: none !important; } .acc-hero-grid { grid-template-columns: 1fr !important; } }`}</style>
      <div style={{ background: "#07142E", color: "#B9C2CF", fontSize: 11.5, textAlign: "center", padding: "8px 14px", letterSpacing: 0.4 }}>Site de jeu de rôle (Roblox) · Serveur Saint-Tropez RP · Contenu fictif</div>

      {/* Barre de navigation */}
      <div style={{ position: "sticky", top: 0, zIndex: 60, background: "rgba(11,29,68,0.96)", backdropFilter: "blur(8px)", boxShadow: "0 8px 24px -14px rgba(0,0,0,0.6)" }}>
        <div style={{ height: 4, background: TRICOLORE }} />
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", gap: 18, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, color: "#fff" }}>
            <LogoGN taille={42} />
            <div style={{ lineHeight: 1.15 }}><div style={{ fontSize: 9.5, letterSpacing: 2.2, opacity: 0.7 }}>RÉPUBLIQUE FRANÇAISE — RP</div><div style={{ fontFamily: FONT_TITRE, fontSize: 16.5, fontWeight: 700 }}>Gendarmerie · Saint-Tropez</div></div>
          </div>
          <div className="acc-nav-liens" style={{ display: "flex", gap: 14 }}>
            <button style={lienNav} onClick={() => aller("demarches")}>Démarches</button>
            <button style={lienNav} onClick={() => aller("missions")}>Missions</button>
            <button style={lienNav} onClick={() => aller("academie")}>CEGN</button>
            <button style={lienNav} onClick={() => aller("recrutement")}>Recrutement</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {lienDiscord && <a href={lienDiscord} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", background: "#5865F2", color: "#fff", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>Discord</a>}
            <button onClick={() => onNavigate("login")} className="gh-link-anim" style={{ background: "#fff", border: 0, color: "#0B1D44", borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Espace gendarmes</button>
          </div>
        </div>
      </div>

      {/* Bandeau d'accueil */}
      <div style={{ position: "relative", overflow: "hidden", backgroundImage: `linear-gradient(115deg, rgba(7,20,46,0.96) 20%, rgba(11,29,68,0.82) 70%, rgba(20,48,95,0.7)), url(${IMG_HERO})`, backgroundSize: "cover", backgroundPosition: "center", color: "#F2F6FC", padding: "70px 20px 90px" }}>
        <div style={{ position: "absolute", top: -160, right: -120, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle, rgba(47,111,222,0.4), transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -200, left: -120, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(192,23,45,0.28), transparent 70%)" }} />
        <div className="acc-hero-grid" style={{ position: "relative", maxWidth: 1060, margin: "0 auto", display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 44, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: recrutementOuvert ? "rgba(46,125,79,0.92)" : "rgba(192,23,45,0.92)", color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 1.2, padding: "6px 14px", borderRadius: 999 }}>
              <span className="gn-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />{recrutementOuvert ? "RECRUTEMENT OUVERT" : "RECRUTEMENT FERMÉ"}
            </div>
            <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(34px, 6vw, 56px)", lineHeight: 1.08, fontWeight: 700, margin: "20px 0 14px", textShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
              Au service de <span style={{ color: "#8FB6FF" }}>Saint-Tropez</span>,<br />jour et nuit.
            </h1>
            <div style={{ width: 130, height: 4, borderRadius: 2, background: TRICOLORE, marginBottom: 18 }} />
            <div style={{ fontSize: 17, lineHeight: 1.65, color: "#D8E2F2", maxWidth: 520 }}>La Compagnie de Gendarmerie Départementale de Saint-Tropez RP : déposez plainte, consultez vos documents et rejoignez nos rangs.</div>
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <button onClick={() => onNavigate("plainte")} className="gh-btn-anim" style={{ background: "#C0172D", color: "#fff", border: 0, borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 14px 28px -12px rgba(192,23,45,0.8)" }}>Déposer plainte</button>
              <button onClick={() => onNavigate("questionnaires")} className="gh-btn-anim" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Nous rejoindre →</button>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 22, padding: 20, backdropFilter: "blur(10px)", boxShadow: "0 30px 60px -30px rgba(0,0,0,0.7)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <LogoGN taille={64} />
              <div><div style={{ fontSize: 11, letterSpacing: 2, color: "#8FB6FF", fontWeight: 700 }}>ACCÈS RAPIDE</div><div style={{ fontFamily: FONT_TITRE, fontSize: 20, fontWeight: 700 }}>Que souhaitez-vous faire ?</div></div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {acces.map((a) => (
                <button key={a.key} onClick={() => onNavigate(a.key)} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 13, textAlign: "left", background: "#fff", border: 0, borderLeft: `5px solid ${a.color}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: a.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><a.icon size={21} color="#fff" /></span>
                  <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: "#14213A" }}>{a.titre}</span><span style={{ display: "block", fontSize: 12.3, color: "#5A6B84" }}>{a.texte}</span></span>
                  <span style={{ color: a.color, fontWeight: 800, fontSize: 18 }}>→</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "#D8E2F2", lineHeight: 1.5 }}>🚨 Urgence réelle ? Composez le 17 ou le 112. Ce site est un jeu de rôle.</div>
          </div>
        </div>
      </div>

      {/* Démarches */}
      <Section id="demarches" surtitre="Démarches" titre="Déposer plainte en trois étapes" sous="Que le mis en cause soit un civil ou un gendarme, la démarche est la même.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {etapes.map(([n, t, d]) => (
            <div key={n} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 18, padding: "22px 22px 24px", boxShadow: "0 18px 36px -26px rgba(7,20,46,0.5)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", right: 14, top: -6, fontFamily: "Georgia, serif", fontSize: 92, fontWeight: 700, color: "#123A7A12" }}>{n}</div>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "#123A7A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, marginBottom: 12 }}>{n}</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{t}</div>
              <div style={{ fontSize: 13.5, color: "#5A6B84", lineHeight: 1.55, marginTop: 6, position: "relative" }}>{d}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          <CarteSimple icon={Siren} titre="Déposer plainte" texte="Signalez des faits dont vous êtes victime ou témoin, contre un civil ou un gendarme." color="#C0172D" onClick={() => onNavigate("plainte")} />
          <CarteSimple icon={FileSearch} titre="Consulter un document me concernant" texte="Votre casier judiciaire ou le suivi de votre candidature." color="#2F6FDE" onClick={() => onNavigate("documents")} />
          <CarteSimple icon={BookOpen} titre="Cadre juridique" texte="Code pénal, procédure pénale, sécurité intérieure, route…" color="#123A7A" onClick={() => onNavigate("cadre-juridique")} />
          <CarteSimple icon={ScrollText} titre="Règlements" texte="Consultez les règles à respecter sur le serveur." color="#0E7C86" onClick={() => onNavigate("reglements")} />
        </div>
      </Section>

      {/* Missions */}
      <Section id="missions" surtitre="Nos missions" titre="Une gendarmerie, quatre missions" sous="Ce que font les gendarmes de la compagnie au quotidien." fond="#fff">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
          {missions.map((m) => (
            <div key={m.titre} style={{ background: "#F7FAFD", border: "1px solid #D3DDEA", borderTop: `5px solid ${m.color}`, borderRadius: 16, padding: "22px 20px" }}>
              <span style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${m.color}, ${m.color}cc)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><m.icon size={26} color="#fff" /></span>
              <div style={{ fontSize: 16.5, fontWeight: 800 }}>{m.titre}</div>
              <div style={{ fontSize: 13.3, color: "#5A6B84", lineHeight: 1.55, marginTop: 6 }}>{m.texte}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Académie */}
      <section id="academie" style={{ background: "linear-gradient(120deg, #0B1D44, #14305F 65%, #1B3F7D)", color: "#fff", padding: "58px 20px", scrollMarginTop: 64, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -80, top: -80, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,162,39,0.28), transparent 70%)" }} />
        <div style={{ position: "relative", maxWidth: 1060, margin: "0 auto", display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
          <LogoAMGN taille={190} style={{ filter: "drop-shadow(0 14px 24px rgba(0,0,0,0.5))" }} />
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 11, letterSpacing: 2.4, fontWeight: 800, color: "#E3C766" }}>COMMANDEMENT DES ÉCOLES DE LA GENDARMERIE NATIONALE</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 700, margin: "6px 0 10px", lineHeight: 1.15 }}>Des chefs pour votre défense et votre sécurité</div>
            <div style={{ fontSize: 15, lineHeight: 1.65, color: "#C9D6EC", maxWidth: 560 }}>Chaque recrue passe par le CEGN avant de rejoindre le terrain : cours, mises en situation et évaluation sur le code pénal, la procédure, la discipline et la pratique. Seuls les élèves admis accèdent à l'espace gendarme.</div>
          </div>
        </div>
      </section>

      {/* Recrutement */}
      <Section id="recrutement" surtitre="Recrutement" titre="Devenez gendarme" sous="Du dépôt de candidature au CEGN, un parcours clair pour rejoindre la compagnie.">
        <BandeauCandidat recrutementOuvert={recrutementOuvert} titre="Rejoignez la CGD de Saint-Tropez RP" texte="Déposez votre candidature, suivez son avancement et découvrez les conditions d'admission. Une fois accepté, vous suivez votre formation au CEGN avant de rejoindre le terrain." bouton="Accéder à l'espace candidat →" onClick={() => onNavigate("questionnaires")} boutonSecondaire="🔎 Suivre ma candidature" onSecondaire={() => onNavigate("suivi-candidature")} />
      </Section>

      {lienDiscord && (
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: "0 20px 40px" }}>
          <a href={lienDiscord} target="_blank" rel="noopener noreferrer" className="gh-card-anim" style={{ display: "flex", alignItems: "center", gap: 16, textDecoration: "none", background: "linear-gradient(135deg, #5865F2, #3A46C4)", color: "#fff", borderRadius: 18, padding: "20px 24px", flexWrap: "wrap", boxShadow: "0 20px 40px -24px rgba(58,70,196,0.8)" }}>
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
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: "30px 20px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 26 }}>
          <div>
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 17, fontWeight: 700, color: "#F2F6FC", marginBottom: 6 }}>Compagnie de Gendarmerie<br />Départementale · Saint-Tropez RP</div>
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
            <div><button onClick={() => onNavigate("questionnaires")} style={lienFooter}>Recrutement</button></div>
            <div><button onClick={() => onNavigate("login")} style={lienFooter}>Espace gendarmes</button></div>
          </div>
        </div>
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: "14px 20px 60px", borderTop: "1px solid rgba(255,255,255,0.12)", fontSize: 11.5, color: "#8FA0BA" }}>
          Saint-Tropez RP — communauté de jeu de rôle sur Roblox. Les gendarmes, grades, plaintes et documents présentés sur ce site sont fictifs et sans aucune valeur officielle. Ce site n'est pas affilié à la Gendarmerie nationale.
        </div>
      </div>
    </div>
  );
}

export const cardButtonStyle = { textAlign: "left", background: "#F2F6FC", border: "none", borderRadius: 14, padding: "16px 20px", cursor: "pointer", color: "#14213A", boxShadow: "0 10px 26px -10px rgba(0,0,0,0.55)", transition: "transform 0.15s ease" };
