// pages/layout.jsx — Habillage du tableau de bord : barre du haut, menu latéral (catégories repliables + recherche), tuiles.
import { Map as MapIcon, Award, BadgeCheck, BookOpen, ChevronDown, ClipboardCheck, ClipboardList, Clock, FileSearch, FileText, GraduationCap, Home, Landmark, LayoutGrid, Medal, Megaphone, MessageSquare, Network, Package, Radio, Scale, ScrollText, Search, Settings, Shield, ShieldAlert, ShieldCheck, Shirt, Siren, Star, TrendingUp, UserCog, UserPlus, Users, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { DISCIPLINE_MIN_INDEX, FONT_BASE, GRADES, REGLAGES } from "../lib/constantes.js";
import { estCommandement, estEtatMajor } from "../lib/etatmajor.js";
import { estCmdUnite } from "../lib/unites.js";
import { peutCreerHabilitations, peutModifierConditions, peutModifierVigipirate, peutValiderHabilitations, estOPJ } from "../lib/droits.js";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { LogoGN } from "../composants/LogoGN.jsx";
import { LogoNeogend } from "../composants/LogoNeogend.jsx";
import { LogoAMGN } from "../composants/LogoAMGN.jsx";
import { fmtHeure } from "../lib/utils.js";

/* ---------- Habillage : icônes, couleurs par catégorie, outils ---------- */

const ICONES_MENU = {
  "carte-ville": MapIcon, fpr: ShieldAlert, "cadre-juridique": Scale, "amgn-eval": ClipboardCheck, fiches: ClipboardList, "amgn-cours": BookOpen, "br-enquetes": FileSearch, "amgn-accueil": LayoutGrid, documentation: BookOpen, retrogradations: Scale, "mon-unite": Users, "amgn-planning": Clock, "amgn-evaluations": GraduationCap,
  dossier: BadgeCheck, annonces: Megaphone, communaute: Users, "cartes-pro": BadgeCheck, "main-courante": Radio, "code-penal-interne": BookOpen, reglements: ScrollText, "mes-avis": Star, "questionnaires-internes": ClipboardList,
  "mon-service": Clock, "services-equipe": Users, pv: FileText, casier: FileSearch, taj: FileSearch, convocations: MessageSquare, parcours: Award, cjn: FileText, "comptes-rendus": MessageSquare, 
  "admin-candidatures": UserPlus, promotions: Award, sanctions: Scale, "mes-sanctions": Scale, "admin-personnel": Users, roles: UserCog, "admin-questionnaires": ClipboardList, "admin-modeles-pv": FileText,
  "admin-services": Clock, "admin-grades": Settings, "admin-unites": Users, "admin-liens": Radio, essai: UserCog, "admin-plaintes": Siren, "plaintes-gendarmes": ShieldAlert, "avis-suggestions": MessageSquare, vigipirate: Shield, hierarchie: Network, equipement: Package, tenue: Shirt, habilitations: Medal, "habilitations-admin": ShieldCheck, formation: GraduationCap, "formation-admin": ClipboardCheck, "conditions-admission": ClipboardList,
};

// Une couleur et une icône par catégorie, pour se repérer d'un coup d'œil
const COULEURS_GROUPE = { "CEGN": "#C9A227", "Brigade de Recherche": "#E5384F", "Mon unité": "#F0B048", "Carrières & discipline": "#F0B048", "Justice": "#8A6D1F", "Général": "#4C8DF6", "Terrain": "#34C38F", "Ressources humaines": "#F0B048", "Direction": "#EF6B7E", "Mon espace": "#4C8DF6", "Carte de la ville": "#34C38F", "Mon service": "#34C38F", "Fichiers": "#5CC8FF", "Procédure": "#9B7BE8", "Carnet de service": "#F0B048", "Documentation": "#9B7BE8", "Plaintes internes": "#5B6EE1", "Recrutement": "#F0B048", "État-Major": "#EF6B7E", "Administration du site": "#7A8CA8" };
const ICONES_GROUPE = { "CEGN": GraduationCap, "Brigade de Recherche": FileSearch, "Mon unité": Users, "Carrières & discipline": Award, "Justice": Scale, "Général": LayoutGrid, "Terrain": Siren, "Ressources humaines": Users, "Direction": Landmark, "Mon espace": Home, "Carte de la ville": MapIcon, "Mon service": Siren, "Fichiers": FileSearch, "Procédure": ScrollText, "Carnet de service": ClipboardList, "Documentation": BookOpen, "Plaintes internes": ShieldAlert, "Recrutement": UserPlus, "État-Major": Landmark, "Administration du site": Settings };
const couleurGroupe = (label) => COULEURS_GROUPE[label] || "#4C8DF6";

// Les compteurs sont écrits dans le libellé : « Annonces (3) » → texte « Annonces » + pastille 3
function separerCompteur(label) {
  const m = String(label).match(/^(.*?)\s*\((\d+)\)$/);
  return m ? { texte: m[1], n: Number(m[2]) } : { texte: String(label), n: 0 };
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const CLE_OUVERTS = "gn_menu_groupes_ouverts_v2";
function lireOuverts() {
  try { return JSON.parse(localStorage.getItem(CLE_OUVERTS) || "{}") || {}; } catch (e) { return {}; }
}

const FONT_MENU = "'Inter', 'Segoe UI', system-ui, sans-serif";

export function RPRibbon({ bas = 0 }) {
  return (
    <div className="rp-ribbon" style={{ position: "fixed", left: 0, right: 0, bottom: bas, zIndex: 9999, background: "#FFF4D6", borderTop: "1px solid #E8D28A", color: "#6B4E00", fontSize: 11.5, fontWeight: 600, textAlign: "center", padding: "6px 12px", fontFamily: FONT_BASE, lineHeight: 1.35 }}>
      ⚠️ Site de jeu de rôle (Roblox) — usage RP uniquement. Aucun lien avec la Gendarmerie nationale réelle. Urgence réelle : 17 ou 112.
    </div>
  );
}

/* ---------- NÉOGEND : thème du terminal (bleu nuit, texte clair, accent bleu gendarmerie) ---------- */
const NEO = { fond: "#07101F", panneau: "#0D1A2E", panneau2: "#12233D", bord: "#1E3558", texte: "#E8F0FF", doux: "#8FA6C8", accent: "#2F7BFF", ok: "#34D07A", alerte: "#FF4D63" };
const TRICOLORE = "linear-gradient(90deg, #0B3A8F 0 33.3%, #FFFFFF 33.3% 66.6%, #E5384F 66.6% 100%)";
const FONT_NEO = "'Barlow Semi Condensed', 'Inter', 'Segoe UI', system-ui, sans-serif";

// Heure du terminal, à la seconde (heure de Paris)
function HorlogeNeo({ taille = 15 }) {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return <span style={{ fontFamily: "'Roboto Mono', ui-monospace, Menlo, monospace", fontSize: taille, fontWeight: 700, color: NEO.texte, letterSpacing: 1 }}>{t.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}</span>;
}

export function DashTopBar({ current, actif, mobile = false, onHome, accueilActif = false, notifs = 0, onNotifs, onLogout }) {
  const avatarsTop = useAvatars(current.robloxId ? [current.robloxId] : []);
  const photoTop = current.robloxId ? avatarsTop[current.robloxId] : null;
  const initialesTop = `${(current.prenom || "?")[0]}${(current.nom || "?")[0]}`.toUpperCase();
  const rond = (actifB) => ({ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${actifB ? NEO.accent : NEO.bord}`, background: actifB ? NEO.accent : NEO.panneau2, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0, position: "relative" });
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, background: NEO.fond, borderBottom: `1px solid ${NEO.bord}` }}>
      <div style={{ height: 3, background: TRICOLORE }} />
      <div style={{ height: 46, padding: mobile ? "0 10px" : "0 22px", display: "flex", alignItems: "center", gap: mobile ? 7 : 14, minWidth: 0, overflow: "hidden" }}>
        <button type="button" onClick={onHome} title="Écran d'accueil" aria-label="Accueil" style={rond(accueilActif)}><Home size={17} /></button>
        <span style={{ background: "#fff", borderRadius: 10, padding: "3px 10px", display: "flex", alignItems: "center", flexShrink: 0 }}><LogoNeogend hauteur={24} /></span>
        {!mobile && <span style={{ flexShrink: 0 }}><HorlogeNeo taille={13} /></span>}
        <span style={{ flex: 1, minWidth: 0, textAlign: mobile ? "left" : "center", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: NEO.ok, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mobile ? "🔒 VPN actif" : "🔒 Réseau chiffré · 🛡️ VPN d'État actif"}</span>
        <button type="button" onClick={onNotifs} title="Notifications" aria-label="Notifications" style={{ ...rond(false), borderColor: notifs ? "#E5384F" : NEO.bord }}>
          <Megaphone size={16} />
          {notifs > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#E5384F", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "0 5px", lineHeight: "16px", border: `2px solid ${NEO.fond}` }}>{notifs}</span>}
        </button>
        <span title={actif ? `En service depuis ${fmtHeure(actif.debut)}` : "Hors service"} style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 20, whiteSpace: "nowrap", background: actif ? "rgba(52,208,122,0.14)" : "rgba(143,166,200,0.12)", color: actif ? NEO.ok : NEO.doux, border: `1px solid ${actif ? "rgba(52,208,122,0.45)" : NEO.bord}` }}>
          <span className={actif ? "gn-pulse" : undefined} style={{ width: 7, height: 7, borderRadius: "50%", background: actif ? NEO.ok : NEO.doux }} />{mobile ? "" : actif ? "En service" : "Hors service"}
        </span>
        {!mobile && <span style={{ flexShrink: 1, minWidth: 0, maxWidth: 210, textAlign: "right", lineHeight: 1.2 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: NEO.texte, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.grade} {current.nom}</span>
          <span style={{ display: "block", fontSize: 10.5, color: NEO.doux, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>RIO {current.cipcNumero || "—"}{current.unite ? ` · ${current.unite}` : ""}</span>
        </span>}
        <span style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg, #2F6FDE, #0B1D44)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, border: `2px solid ${NEO.bord}` }}>
          {photoTop ? <img src={photoTop} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initialesTop}
        </span>
        {onLogout && <button type="button" onClick={onLogout} title="Fermer la session" aria-label="Fermer la session" style={rond(false)}><X size={16} /></button>}
      </div>
    </div>
  );
}

/* ---------- NÉOGEND : en-tête d'application (au-dessus de chaque page, comme une appli du terminal) ---------- */
export function NeoEnteteApp({ section, groups, titre, mobile = false, onHome }) {
  const groupe = groups.find((g) => g.items.some((it) => it.id === section));
  const Icone = ICONES_MENU[section] || FileText;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: mobile ? 10 : 14, padding: mobile ? "12px 12px 2px" : "18px 40px 2px", fontFamily: FONT_NEO, minWidth: 0 }}>
      <button type="button" onClick={onHome} aria-label="Retour à l'écran d'accueil" className="gh-btn-anim" style={{ width: 40, height: 40, borderRadius: "50%", background: NEO.panneau2, border: `1px solid ${NEO.bord}`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0, fontSize: 20, fontWeight: 700 }}>‹</button>
      <span style={{ width: 46, height: 46, borderRadius: "50%", background: "#fff", border: "3px solid #0B3A8F", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 8px 16px -8px rgba(0,0,0,0.7)" }}>
        <Icone size={22} color="#0B3A8F" strokeWidth={2.3} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, letterSpacing: 2.2, color: NEO.doux, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{groupe ? groupe.label : "Application"}</div>
        <div style={{ fontSize: mobile ? 20 : 24, fontWeight: 700, color: NEO.texte, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titre}</div>
      </div>
    </div>
  );
}

// Fond du terminal derrière les pages + petits réglages (défilement, sélection)
export const FOND_NEO = `radial-gradient(900px 420px at 0% 0%, rgba(47,123,255,0.16), transparent 70%), radial-gradient(700px 400px at 100% 100%, rgba(229,56,79,0.08), transparent 70%), ${NEO.fond}`;
export const STYLE_NEO = `
  ::selection { background: ${NEO.accent}; color: #fff; }
  * { scrollbar-width: thin; scrollbar-color: #35507d transparent; }
  .neo-fenetre { animation: neoEntree .25s ease-out; position: relative; }
  @keyframes neoEntree { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  /* liseré tricolore en haut de la fenêtre d'application */
  .neo-fenetre::before { content: ""; position: absolute; top: -1px; left: 28px; right: 28px; height: 3px; border-radius: 0 0 4px 4px; background: ${TRICOLORE}; }
  /* titres : police condensée du terminal */
  .neo-fenetre::after { content: "NÉOGEND"; position: absolute; right: 26px; bottom: 14px; font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 800; font-size: 54px; letter-spacing: 6px; color: rgba(18,58,122,0.07); pointer-events: none; user-select: none; }
  .neo-fenetre h1, .neo-fenetre h2, .neo-fenetre h3 { font-family: ${FONT_NEO} !important; letter-spacing: .2px; }
  .neo-fenetre h2 { font-size: 1.35em; }
  /* champs de saisie : même gabarit partout, anneau bleu à la sélection */
  .neo-fenetre input:not([type=checkbox]):not([type=radio]):not([type=range]), .neo-fenetre select, .neo-fenetre textarea { border-radius: 10px !important; border-color: #B8C7E0 !important; transition: border-color .15s, box-shadow .15s; min-height: 40px; }
  .neo-fenetre textarea { min-height: 70px; }
  .neo-fenetre input:focus, .neo-fenetre select:focus, .neo-fenetre textarea:focus { outline: none !important; border-color: ${NEO.accent} !important; box-shadow: 0 0 0 3px rgba(47,123,255,.22) !important; }
  .neo-fenetre input::placeholder, .neo-fenetre textarea::placeholder { color: #8A9BB5; }
  /* boutons : retour au toucher, comme sur un écran tactile */
  .neo-fenetre button { transition: transform .12s, filter .15s, box-shadow .15s; -webkit-tap-highlight-color: transparent; }
  .neo-fenetre button:hover:not(:disabled) { filter: brightness(1.07); }
  .neo-fenetre button:active:not(:disabled) { transform: scale(.975); }
  .neo-fenetre button:disabled { cursor: not-allowed; }
  .neo-fenetre button:focus-visible, .neo-fenetre a:focus-visible { outline: 3px solid rgba(47,123,255,.45); outline-offset: 2px; }
  /* tableaux : en-tête fixe style terminal, lignes survolées */
  .neo-fenetre table { border-collapse: separate; border-spacing: 0; }
  .neo-fenetre th { background: #E1E9F6 !important; color: #2B3F63 !important; text-transform: uppercase; letter-spacing: .07em; font-size: 11px !important; font-weight: 800 !important; }
  .neo-fenetre tbody tr:hover td { background: rgba(47,123,255,.07); }
  .neo-fenetre a { transition: color .15s; }
  /* barre de navigation du bas (téléphone) */
  .neo-pages::-webkit-scrollbar { display: none; }
  .neo-recherche::placeholder { color: rgba(255,255,255,0.85); }
  .neo-barre button { transition: transform .12s, background .15s; }
  .neo-barre button:active { transform: scale(.94); }
  @media (prefers-reduced-motion: reduce) { .neo-fenetre { animation: none; } .neo-fenetre button { transition: none; } }
`;

/* ---------- NÉOGEND : dock du bas (comme sur une tablette) ---------- */
export function BarreNeoMobile({ section, groups, onOpen, mobile = false }) {
  const existe = (id) => groups.some((g) => g.items.some((it) => it.id === id));
  const items = [
    { id: "accueil", label: "Accueil", Icone: Home },
    existe("mon-service") && { id: "mon-service", label: "Service", Icone: Clock },
    existe("pv") && { id: "pv", label: "PVe", Icone: FileText },
    existe("taj") && { id: "taj", label: "TAJ", Icone: FileSearch },
    existe("fpr") && { id: "fpr", label: "FPR", Icone: ShieldAlert },
  ].filter(Boolean);
  return (
    <nav className="neo-barre" aria-label="Dock NÉOGEND" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: mobile ? 58 : 44, zIndex: 9990, display: "flex", gap: mobile ? 10 : 18, padding: "9px 16px", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: 30, boxShadow: "0 18px 40px -14px rgba(0,0,0,0.75)" }}>
      {items.map(({ id, label, Icone }) => {
        const act = section === id;
        return (
          <button key={id} type="button" onClick={() => onOpen(id)} aria-label={label} title={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: 0, cursor: "pointer", padding: 0, fontFamily: FONT_BASE }}>
            <span style={{ width: 50, height: 50, borderRadius: "50%", background: act ? "#0B3A8F" : "#fff", border: "3px solid #0B3A8F", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone size={23} color={act ? "#fff" : "#0B3A8F"} strokeWidth={2.2} /></span>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#0A1F44" }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ---------- Accueil du tableau de bord : bandeau personnel, accès rapides, à traiter, toutes les pages ---------- */

const A_TRAITER = [
  ["taches", "taches", "tâche(s) à faire", "✅", "#2F6FDE"],
  ["pv", "pv", "PVe à traiter", "📄", "#8A6D1F"],
  ["plaintes", "admin-plaintes", "plainte(s) en attente", "🚨", "#C0172D"],
  ["plaintesGendarmes", "plaintes-gendarmes", "plainte(s) contre un gendarme", "🛡️", "#5B6EE1"],
  ["candidatures", "admin-candidatures", "candidature(s) en attente", "📨", "#F0B048"],
  ["cr", "comptes-rendus", "compte(s) rendu(s)", "💬", "#34C38F"],
];
const RACCOURCIS = ["taj", "fpr", "pv", "mon-service", "casier", "comptes-rendus", "dossier", "cadre-juridique", "amgn-cours", "carte-ville"];

const BLEU = "#0B3A8F";
const BLEU2 = "#123A7A";
// Noms « d'applications » façon NÉOGEND
const NOMS_APPS = { pv: "PVe", taj: "TAJ", fpr: "FPR", cjn: "CJN", casier: "Saisie TAJ", "mon-service": "Service", "services-equipe": "Équipe", convocations: "Convoc.", "comptes-rendus": "Comptes rendus", dossier: "CIPC", parcours: "Parcours", taches: "Tâches", habilitations: "Habilit.", "mes-sanctions": "Sanctions", compte: "Mon compte", "carte-ville": "Carte", "cadre-juridique": "Cadre juridique", "admin-plaintes": "Plaintes", "br-enquetes": "Enquêtes BR" };

export function totalAlertes(compteurs = {}) {
  return A_TRAITER.reduce((n, [k]) => n + (Number(compteurs[k]) || 0), 0);
}

export const FOND_ACCUEIL = "radial-gradient(700px 420px at 90% 0%, rgba(92,200,255,0.35), transparent 70%), radial-gradient(600px 400px at 0% 100%, rgba(229,56,79,0.22), transparent 70%), linear-gradient(160deg, #0B3A8F 0%, #1D5BD6 55%, #0A2A6B 100%)";
const VERRE = { background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.32)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderRadius: 26, color: "#fff", boxShadow: "0 20px 40px -24px rgba(0,0,0,0.7)" };

export function AccueilGendarme({ current, actif, compteurs = {}, groups, onOpen, liens = [] }) {
  const now = new Date();
  const h = now.getHours();
  const salut = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  const dateTxt = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  const tous = groups.flatMap((g) => g.items);
  const trouve = (id) => tous.find((it) => it.id === id);
  const alertes = A_TRAITER.filter(([k, id]) => Number(compteurs[k]) > 0 && trouve(id));
  const rapides = RACCOURCIS.map(trouve).filter(Boolean).slice(0, 6);
  const puce = { background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 20, padding: "3px 11px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" };
  const titreSec = { fontFamily: FONT_NEO, fontSize: 12, letterSpacing: 2.4, fontWeight: 800, margin: "0 0 10px", opacity: 0.95 };
  const lien = (l) => (
    <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="gh-btn-anim" style={{ flex: "1 1 240px", display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "#fff", background: `linear-gradient(135deg, ${l.couleur}, ${l.couleur2 || l.couleur})`, borderRadius: 20, padding: "14px 18px", boxShadow: "0 16px 30px -18px rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.35)" }}>
      <span style={{ width: 52, height: 52, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{l.emoji}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: FONT_NEO, fontSize: 18, fontWeight: 800, letterSpacing: 0.6 }}>{l.label}</span>
        <span style={{ display: "block", fontSize: 12.5, opacity: 0.92 }}>{l.texte}</span>
      </span>
      <span style={{ marginLeft: "auto", fontSize: 22, fontWeight: 700 }}>↗</span>
    </a>
  );
  return (
    <div style={{ fontFamily: FONT_BASE, color: "#fff" }}>
      <div style={{ ...VERRE, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <LogoGN taille={64} />
        <div style={{ flex: "1 1 230px", minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.85, fontWeight: 700, textTransform: "uppercase" }}>{dateTxt}</div>
          <div style={{ fontFamily: FONT_NEO, fontSize: 25, fontWeight: 700, lineHeight: 1.1, margin: "3px 0 8px" }}>{salut}, {current.grade} {current.nom}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {current.unite && <span style={puce}>{current.unite}</span>}
            <span style={puce}>🪪 {current.matricule || "—"}</span>
          </div>
        </div>
        <button onClick={() => onOpen("mon-service")} style={{ flex: "0 1 220px", textAlign: "left", cursor: "pointer", fontFamily: FONT_BASE, color: "#fff", background: actif ? "rgba(52,208,122,0.22)" : "rgba(255,255,255,0.14)", border: `1px solid ${actif ? "rgba(52,208,122,0.85)" : "rgba(255,255,255,0.35)"}`, borderRadius: 16, padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT_NEO, fontSize: 16, fontWeight: 800, letterSpacing: 1.3 }}>
            <span className={actif ? "gn-pulse" : undefined} style={{ width: 11, height: 11, borderRadius: "50%", background: actif ? "#34D07A" : "#C9D6EC" }} />{actif ? "EN SERVICE" : "HORS SERVICE"}
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 4 }}>{actif ? `Depuis ${fmtHeure(actif.debut)}` : "Prendre mon service"}</div>
        </button>
      </div>

      {liens.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={titreSec}>COMMUNAUTÉ</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{liens.map(lien)}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, alignItems: "start" }}>
        <div style={{ ...VERRE, padding: "14px 16px" }}>
          <div style={titreSec}>🔔 NOTIFICATIONS</div>
          {alertes.length === 0 ? <div style={{ fontSize: 13.5, opacity: 0.92 }}>✔ Aucune alerte opérationnelle.</div> : alertes.map(([k, id, label, ic]) => (
            <button key={k} onClick={() => onOpen(id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 14, padding: "7px 12px", marginBottom: 6, color: "#fff", cursor: "pointer", fontFamily: FONT_BASE }}>
              <b style={{ fontFamily: FONT_NEO, fontSize: 20, minWidth: 26 }}>{compteurs[k]}</b>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{ic} {label.replace("PV à traiter", "PVe à traiter")}</span>
              <span>›</span>
            </button>
          ))}
        </div>
        <div style={{ ...VERRE, padding: "14px 16px 6px" }}>
          <div style={titreSec}>ACCÈS RAPIDES</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2 }}>
            {rapides.map((it) => <AppNeo key={it.id} it={it} onOpen={onOpen} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Une « application » NÉOGEND : icône ronde blanche cerclée de bleu institutionnel + libellé
function AppNeo({ it, onOpen }) {
  const Icone = ICONES_MENU[it.id] || FileText;
  const { texte, n } = separerCompteur(it.label);
  const nom = NOMS_APPS[it.id] || texte;
  return (
    <button onClick={() => onOpen(it.id)} className="gh-btn-anim" title={texte} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, background: "transparent", border: 0, padding: "8px 2px", cursor: "pointer", fontFamily: FONT_BASE, color: "#fff" }}>
      <span style={{ position: "relative", width: 76, height: 76, borderRadius: "50%", background: "#fff", border: `4px solid ${BLEU}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 20px -10px rgba(0,0,0,0.65)" }}>
        <Icone size={34} color={BLEU} strokeWidth={2.2} />
        {n > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: "#D62B45", color: "#fff", fontSize: 11.5, fontWeight: 800, borderRadius: 12, padding: "1px 7px", border: "2px solid #fff", lineHeight: 1.4 }}>{n}</span>}
      </span>
      <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2, textAlign: "center", overflowWrap: "anywhere", maxWidth: 104, textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}>{nom}</span>
    </button>
  );
}

/* ---------- Écran d'accueil : pages d'applications qu'on feuillette comme sur un téléphone ---------- */

export function PulsarTuiles({ groups, onOpen, inclureCipc = false, mobile = false, premierePage = null }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const zone = useRef(null);
  const glisse = useRef(null);
  const n = norm(q.trim());
  const cols = mobile ? 4 : 6;
  const parPage = mobile ? 12 : 18;
  const groupesOk = groups.map((g) => ({ ...g, items: g.items.filter((it) => inclureCipc || it.id !== "dossier") })).filter((g) => g.items.length > 0);
  const apps = groupesOk.flatMap((g) => g.items.map((it) => ({ type: "app", it })));
  const trouvees = n ? apps.filter(({ it }) => norm(`${separerCompteur(it.label).texte} ${NOMS_APPS[it.id] || ""}`).includes(n)) : [];
  // Plusieurs familles par page tant que ça tient (moins de pages à tourner)
  const budget = mobile ? 4.3 : 3.7;
  const pages = [];
  const nouvellePage = () => { const pg = { sections: [], cout: 0 }; pages.push(pg); return pg; };
  let cour = nouvellePage();
  groupesOk.forEach((g) => {
    for (let i = 0; i < g.items.length; ) {
      let dispo = Math.floor(budget - cour.cout - 0.45);
      if (dispo < 1) { if (cour.sections.length) { cour = nouvellePage(); dispo = Math.floor(budget - 0.45); } else dispo = 1; }
      const part = g.items.slice(i, i + dispo * cols);
      cour.sections.push({ label: g.label, suite: i > 0, items: part.map((it) => ({ type: "app", it })) });
      cour.cout += Math.ceil(part.length / cols) + 0.45; i += part.length;
    }
  });
  const total = (premierePage ? 1 : 0) + pages.length;

  const aller = (i) => {
    const z = zone.current; if (!z) return;
    const k = Math.max(0, Math.min(total - 1, i));
    z.scrollTo({ left: k * z.clientWidth, behavior: "smooth" });
  };
  useEffect(() => {
    const clavier = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "")) return;
      if (e.key === "ArrowRight") aller(page + 1);
      if (e.key === "ArrowLeft") aller(page - 1);
    };
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  });
  // glisser à la souris (au doigt, le défilement natif s'en charge)
  const bas = (e) => { if (e.pointerType === "mouse" && zone.current) glisse.current = { x: e.clientX, g: zone.current.scrollLeft, bouge: false }; };
  const bouge = (e) => { const d = glisse.current; if (!d) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 6) d.bouge = true; if (d.bouge) { zone.current.style.scrollSnapType = "none"; zone.current.scrollLeft = d.g - dx; } };
  const lache = () => {
    const d = glisse.current; glisse.current = null; const z = zone.current;
    if (!d || !z || !d.bouge) return;
    z.style.scrollSnapType = "";
    aller(Math.round(z.scrollLeft / z.clientWidth + (z.scrollLeft - d.g > 0 ? 0.25 : -0.25)));
  };

  const icone = (x) => x.type === "app"
    ? <AppNeo key={x.it.id} it={x.it} onOpen={onOpen} />
    : (
      <a key={x.l.label} href={x.l.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "8px 2px", textDecoration: "none", color: "#fff" }}>
        <span style={{ width: 76, height: 76, borderRadius: "50%", background: "#fff", border: `4px solid ${x.l.couleur}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, boxShadow: "0 12px 20px -10px rgba(0,0,0,0.65)" }}>{x.l.emoji}</span>
        <span style={{ fontSize: 13, fontWeight: 800, textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}>{x.l.label}</span>
      </a>
    );
  const grille = { display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: mobile ? "6px 2px" : "14px 8px", alignContent: "start" };
  const fleche = (cote) => ({ position: "absolute", top: "50%", [cote]: mobile ? 2 : -8, transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.22)", color: "#fff", fontSize: 24, cursor: "pointer", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 });

  return (
    <div style={{ fontFamily: FONT_BASE, marginBottom: 20, maxWidth: 1100, margin: "0 auto 20px" }}>
      <input className="neo-recherche" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Rechercher une application" aria-label="Rechercher une application" style={{ display: "block", width: "100%", maxWidth: 420, margin: "0 auto 14px", boxSizing: "border-box", background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 24, padding: "11px 18px", color: "#fff", fontSize: 14, fontFamily: FONT_BASE, outline: "none" }} />
      {n ? (
        <div style={{ ...VERRE, padding: "16px 14px" }}>
          {trouvees.length === 0 ? <div style={{ textAlign: "center", fontSize: 14 }}>Aucune application ne correspond.</div> : <div style={grille}>{trouvees.map(icone)}</div>}
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {!mobile && page > 0 && <button type="button" aria-label="Page précédente" onClick={() => aller(page - 1)} style={fleche("left")}>‹</button>}
          {!mobile && page < total - 1 && <button type="button" aria-label="Page suivante" onClick={() => aller(page + 1)} style={fleche("right")}>›</button>}
          <div ref={zone} className="neo-pages" onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))} onPointerDown={bas} onPointerMove={bouge} onPointerUp={lache} onPointerLeave={lache} style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", cursor: "grab", userSelect: "none" }}>
            {premierePage && <div style={{ flex: "0 0 100%", scrollSnapAlign: "start", boxSizing: "border-box", padding: "2px 4px" }}>{premierePage}</div>}
            {pages.map((l, i) => (
              <div key={i} style={{ flex: "0 0 100%", scrollSnapAlign: "start", boxSizing: "border-box", padding: "2px 4px", minHeight: mobile ? 430 : 420 }}>
                <div style={{ ...VERRE, padding: mobile ? "12px 8px" : "18px 30px", minHeight: mobile ? 400 : 380, boxSizing: "border-box" }}>
                  {l.sections.map((sec, k) => (
                    <div key={sec.label + k} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: mobile ? "4px 8px 6px" : "4px 0 6px", borderBottom: "1px solid rgba(255,255,255,0.3)" }}>
                        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{React.createElement(ICONES_GROUPE[sec.label] || LayoutGrid, { size: 15, color: BLEU, strokeWidth: 2.4 })}</span>
                        <span style={{ fontFamily: FONT_NEO, fontSize: 14.5, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>{sec.label}{sec.suite ? " (suite)" : ""}</span>
                      </div>
                      <div style={grille}>{sec.items.map(icone)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
            {Array.from({ length: total }).map((_, i) => (
              <button key={i} type="button" aria-label={`Page ${i + 1}`} onClick={() => aller(i)} style={{ width: i === page ? 22 : 9, height: 9, borderRadius: 5, border: 0, padding: 0, cursor: "pointer", background: i === page ? "#fff" : "rgba(255,255,255,0.45)", transition: "width .2s" }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Tableau de bord connecté : contenu du menu ---------- */

export function construireMenu(current, isAdmin, counts) {
  // Recrue en formation au CEGN : uniquement l'espace du CEGN
  if (counts.amgnRestreint) {
    return [{ label: "CEGN", items: [
      { id: "amgn-eval", label: "Mon évaluation" },
      { id: "amgn-cours", label: "Cours" },
      { id: "amgn-planning", label: "Planning des formations" },
      { id: "compte", label: "Mon compte" },
    ] }];
  }
  const isOPJ = estOPJ(current);
  const isRecruteur = (current.qualifications || []).includes("Recruteur");
  const canSeeCandidatures = isAdmin || isRecruteur;
  const isBR = (current.qualifications || []).includes("Brigade de Recherche");
  const canSeePlaintes = isAdmin || isOPJ || isBR;
  const canSeePV = isAdmin || isOPJ;

  const isDggnOuIggn = estEtatMajor(current);
  const isHautGrade = (current.gradeRank ?? GRADES.indexOf(current.grade)) >= DISCIPLINE_MIN_INDEX;

  const nb = (n) => (n ? ` (${n})` : "");
  const cmdUnite = estCmdUnite(current);
  const personnelAmgn = isAdmin || (current.qualifications || []).includes("Personnel AMGN");
  const groups = [
    { label: "Carte de la ville", direct: true, items: [{ id: "carte-ville", label: "Carte de la ville" }] },
    {
      label: "Mon espace",
      items: [
        { id: "dossier", label: "𝐂𝐈𝐏𝐂" },
        { id: "parcours", label: "Mon parcours" },
        { id: "taches", label: "Mes tâches" + nb(counts.taches) },
        { id: "habilitations", label: "Mes habilitations" },
        { id: "mes-sanctions", label: "Mes sanctions" },
        ...(counts.questionnaires ? [{ id: "questionnaires-internes", label: "Candidatures internes" }] : []),
        { id: "compte", label: "Mon compte" },
      ],
    },
    {
      label: "Terrain",
      items: [
        { id: "mon-service", label: "Prise de service" },
        { id: "services-equipe", label: "Services de l'équipe" },
      ],
    },
    {
      label: "Fichiers",
      items: [
        { id: "taj", label: "TAJ · Antécédents" },
        { id: "fpr", label: "FPR · Personnes recherchées" },
        { id: "cjn", label: "CJN · Casier judiciaire" },
      ],
    },
    {
      label: "Procédure",
      items: [
        { id: "pv", label: "PVe · Procès-verbaux" + (canSeePV ? nb(counts.pv) : "") },
        { id: "casier", label: "Saisie TAJ · Antécédents" },
        { id: "comptes-rendus", label: "Comptes rendus" + nb(counts.cr) },
        ...(canSeePlaintes ? [{ id: "admin-plaintes", label: "Plaintes du public" + nb(counts.plaintes) }] : []),
      ],
    },
    { label: "Carnet de service", items: [{ id: "convocations", label: "Convocations" }] },
    ...(isAdmin || isBR ? [{ label: "Brigade de Recherche", items: [{ id: "br-enquetes", label: "Enquêtes" }] }] : []),
    ...(cmdUnite ? [{ label: "Mon unité", items: [{ id: "mon-unite", label: "Mon unité & fonctions" }, ...(!canSeeCandidatures ? [{ id: "admin-candidatures", label: "Candidatures de l'unité" + nb(counts.candidatures) }] : [])] }] : []),
    {
      label: "CEGN",
      items: [
        ...(personnelAmgn ? [{ id: "amgn-accueil", label: "Tableau de bord" }] : []),
        { id: "amgn-cours", label: "Cours" },
        { id: "amgn-planning", label: "Planning des formations" },
        ...(personnelAmgn ? [{ id: "amgn-evaluations", label: "Évaluation des recrues" }] : []),
        ...(personnelAmgn && !canSeeCandidatures ? [{ id: "admin-candidatures", label: "Candidatures" + nb(counts.candidatures) }] : []),
        ...(personnelAmgn && (peutValiderHabilitations(current) || peutCreerHabilitations(current)) ? [{ id: "habilitations-admin", label: "Habilitations" }] : []),
      ],
    },
    {
      label: "Documentation",
      items: [
        { id: "documentation", label: "Centre de documentation" },
        { id: "cadre-juridique", label: "Cadre juridique" },
        { id: "reglements", label: "Règlements" },
        { id: "fiches", label: "Fiches de référence" },
        { id: "hierarchie", label: "Hiérarchie" },
      ],
    },
    {
      label: "Carrières & discipline",
      items: [
        { id: "promotions", label: "Promotions" },
        { id: "retrogradations", label: "Rétrogradations" },
        ...(isAdmin || isHautGrade ? [{ id: "sanctions", label: "Sanctions" }] : []),
      ],
    },
    {
      label: "Ressources humaines",
      items: [
        ...(canSeeCandidatures ? [{ id: "admin-candidatures", label: "Candidatures" + nb(counts.candidatures) }] : []),
        ...(canSeeCandidatures ? [{ id: "essai", label: "Recrues en essai" }] : counts.filleuls ? [{ id: "essai", label: "Mes filleuls (" + counts.filleuls + ")" }] : []),
        ...(isAdmin ? [{ id: "admin-personnel", label: "Gestion du personnel" }] : []),
        ...(!personnelAmgn && (peutValiderHabilitations(current) || peutCreerHabilitations(current)) ? [{ id: "habilitations-admin", label: "Habilitations" }] : []),
      ],
    },
    {
      label: "État-Major",
      items: [
        ...(isAdmin || estCommandement(current) ? [{ id: "plaintes-gendarmes", label: "Plaintes contre un gendarme" + nb(counts.plaintesGendarmes) }] : []),
        ...(peutModifierVigipirate(current) ? [{ id: "vigipirate", label: "Plan Vigipirate" }] : []),
      ],
    },
    {
      label: "Administration du site",
      items: isAdmin ? [
        { id: "roles", label: "Rôles & permissions" },
        { id: "admin-grades", label: "Grades & unités" },
        { id: "admin-unites", label: "Unités & commandants" },
        { id: "admin-questionnaires", label: "Postes & candidatures" },
        ...(peutModifierConditions(current) ? [{ id: "conditions-admission", label: "Conditions générales" }] : []),
        { id: "admin-services", label: "Gestion des services" },
        { id: "admin-modeles-pv", label: "Modèles de PV" },
        { id: "admin-liens", label: "Liens utiles" },
      ] : (peutModifierConditions(current) ? [{ id: "conditions-admission", label: "Conditions générales" }] : []),
    },
  ]
    .filter((g) => g.items.length > 0);

  return groups;
}

/* ---------- Menu latéral : catégories repliables, recherche, pastilles ---------- */

export function Sidebar({ current, section, setSection, isAdmin, onLogout, counts, lienDiscord, lienRoblox, mobile = false, ouvert = false, onClose }) {
  const groups = construireMenu(current, isAdmin, counts);
  const [recherche, setRecherche] = useState("");
  const [ouverts, setOuverts] = useState(lireOuverts);

  // La catégorie de la page affichée s'ouvre toute seule
  useEffect(() => {
    const g = groups.find((x) => x.items.some((it) => it.id === section));
    if (g) setOuverts((o) => (o[g.label] && Object.keys(o).filter((k) => o[k]).length === 1 ? o : { [g.label]: true }));
  }, [section]);

  // On retient les catégories ouvertes / fermées
  useEffect(() => {
    try { localStorage.setItem(CLE_OUVERTS, JSON.stringify(ouverts)); } catch (e) { /* stockage indisponible */ }
  }, [ouverts]);

  const q = norm(recherche.trim());
  const groupesAffiches = (q ? groups.map((g) => ({ ...g, items: g.items.filter((it) => norm(separerCompteur(it.label).texte).includes(q)) })).filter((g) => g.items.length > 0) : groups);

  const initiales = `${(current.prenom || "?")[0]}${(current.nom || "?")[0]}`.toUpperCase();
  const avatars = useAvatars(current.robloxId ? [current.robloxId] : []);
  const photo = current.robloxId ? avatars[current.robloxId] : null;

  return (
    <div style={{ width: 260, background: "radial-gradient(420px 260px at 0% 0%, rgba(47,111,222,0.28), transparent 70%), radial-gradient(360px 240px at 100% 100%, rgba(184,146,58,0.12), transparent 70%), linear-gradient(180deg, #0C2655, #06112A)", borderRight: "1px solid rgba(184,146,58,0.28)", color: "#F2F6FC", padding: "22px 12px 18px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box", overflowY: "auto", position: "sticky", top: 0, height: "100vh", alignSelf: "flex-start", flexShrink: 0, ...(mobile ? { position: "fixed", top: 0, left: 0, width: "min(88vw, 310px)", height: "100%", padding: "14px 12px 96px", zIndex: 500, transform: ouvert ? "translateX(0)" : "translateX(-105%)", transition: "transform .25s ease", boxShadow: ouvert ? "8px 0 30px rgba(0,0,0,0.45)" : "none" } : {}) }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, display: "flex" }}><div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#FFFFFF" }} /><div style={{ flex: 1, background: "#C0172D" }} /></div>
      {mobile && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button onClick={onClose} aria-label="Fermer le menu" style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✕ Fermer</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "12px 12px", background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))", border: "1px solid rgba(201,162,39,0.4)", borderRadius: 16, boxShadow: "0 14px 24px -18px rgba(0,0,0,0.8)" }}>
        {counts.amgnRestreint ? <LogoAMGN taille={50} /> : <LogoGN taille={46} />}
        <div>
          <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{counts.amgnRestreint ? "Commandement des Écoles de la Gendarmerie Nationale" : "CGD de Saint-Tropez RP · Gendarmerie nationale"}</div>
          <div style={{ fontSize: 10, opacity: 0.6 }}>{counts.amgnRestreint ? "CEGN · Recruter · Former" : "Saint-Tropez RP · jeu de rôle"}</div>
        </div>
      </div>

      {(lienRoblox || lienDiscord) && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {lienRoblox && <a href={lienRoblox} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "#2E7D4F", color: "#fff", borderRadius: 8, padding: "8px 6px", fontSize: 12, fontWeight: 700 }}>🎮 Roblox</a>}
          {lienDiscord && <a href={lienDiscord} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "#5865F2", color: "#fff", borderRadius: 8, padding: "8px 6px", fontSize: 12, fontWeight: 700 }}>💬 Discord</a>}
        </div>
      )}

      {/* Recherche d'une page */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={15} color="#8FA0B8" style={{ position: "absolute", left: 10, top: 10, pointerEvents: "none" }} />
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une page…"
          aria-label="Rechercher une page"
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: "#F2F6FC", borderRadius: 8, padding: "8px 30px 8px 31px", fontSize: 13, fontFamily: FONT_MENU, outline: "none" }}
        />
        {recherche && (
          <button onClick={() => setRecherche("")} aria-label="Effacer la recherche" style={{ position: "absolute", right: 6, top: 6, background: "transparent", border: "none", color: "#8FA0B8", cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={15} />
          </button>
        )}
      </div>

      {!q && (
        <button className={section === "accueil" ? "gn-menu-item gn-actif" : "gn-menu-item"} onClick={() => setSection("accueil")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: section === "accueil" ? "linear-gradient(90deg, #2F7BFF55, #2F7BFF14)" : "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "3px solid #2F7BFF", borderRadius: 10, padding: "10px 11px", marginBottom: 10, fontSize: 13.5, fontWeight: 700, fontFamily: FONT_MENU, cursor: "pointer" }}>
          <Home size={17} color="#5CC8FF" /> <span style={{ flex: 1 }}>Accueil NÉOGEND</span>
        </button>
      )}

      {q && groupesAffiches.length === 0 && (
        <div style={{ fontSize: 12.5, color: "#8FA0B8", padding: "10px 6px" }}>Aucune page ne correspond à « {recherche} ».</div>
      )}

      {groupesAffiches.map((g) => {
        const c = couleurGroupe(g.label);
        const IconeG = ICONES_GROUPE[g.label] || LayoutGrid;
        const deplie = q ? true : !!ouverts[g.label];
        const totalAlertes = g.items.reduce((s, it) => s + separerCompteur(it.label).n, 0);
        return (
          <div key={g.label} style={{ marginBottom: 8, background: deplie || (g.direct && section === g.items[0].id) ? "rgba(255,255,255,0.035)" : "transparent", borderRadius: 10 }}>
            <button
              className="gn-groupe"
              onClick={() => (g.direct ? setSection(g.items[0].id) : !q && setOuverts(ouverts[g.label] ? {} : { [g.label]: true }))}
              aria-expanded={deplie}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none", color: "#F2F6FC", cursor: q ? "default" : "pointer", padding: "9px 8px", fontFamily: FONT_MENU, textAlign: "left" }}
            >
              <span style={{ width: 26, height: 26, borderRadius: 8, background: `${c}2b`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconeG size={15} color={c} strokeWidth={2.2} />
              </span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{g.label}</span>
              {!deplie && totalAlertes > 0 && <span style={{ background: "#E5384F", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 10, padding: "1px 7px" }}>{totalAlertes}</span>}
              {!q && !g.direct && <ChevronDown size={16} color="#8FA0B8" style={{ transition: "transform .2s", transform: deplie ? "rotate(0deg)" : "rotate(-90deg)", flexShrink: 0 }} />}
            </button>

            {deplie && !g.direct && (
              <div style={{ padding: "0 6px 8px 6px" }}>
                {g.items.map((it) => {
                  const Icone = ICONES_MENU[it.id] || FileText;
                  const { texte, n } = separerCompteur(it.label);
                  const actif = section === it.id;
                  return (
                    <button
                      key={it.id}
                      className={actif ? "gn-menu-item gn-actif" : "gn-menu-item"}
                      onClick={() => setSection(it.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        textAlign: "left",
                        background: actif ? `linear-gradient(90deg, ${c}40, ${c}12)` : "transparent",
                        color: actif ? "#fff" : "#D5DEEC",
                        border: "none",
                        borderLeft: actif ? `3px solid ${c}` : "3px solid transparent",
                        borderRadius: 9,
                        padding: "8px 9px",
                        boxShadow: actif ? `0 6px 16px -10px ${c}` : "none",
                        marginBottom: 1,
                        fontSize: 13,
                        fontWeight: actif ? 700 : 500,
                        fontFamily: FONT_MENU,
                        cursor: "pointer",
                      }}
                    >
                      <Icone size={16} color={actif ? c : "#8FA0B8"} strokeWidth={2} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25, overflowWrap: "anywhere" }}>{texte}</span>
                      {n > 0 && <span style={{ background: "#E5384F", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 10, padding: "1px 7px", flexShrink: 0 }}>{n}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        {isAdmin && !lienRoblox && !lienDiscord && <button onClick={() => setSection("admin-liens")} style={{ width: "100%", fontSize: 11.5, background: "transparent", border: "1px dashed rgba(255,255,255,0.35)", color: "#F2F6FC", padding: "7px 8px", borderRadius: 8, cursor: "pointer", marginBottom: 12 }}>+ Ajouter les liens Discord / Roblox</button>}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {photo
            ? <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.45)", overflow: "hidden", flexShrink: 0, background: "#123A7A" }}><Avatar src={photo} taille={40} /></div>
            : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #2F6FDE, #123A7A)", border: "2px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{initiales}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.prenom} {current.nom}</div>
            <div style={{ fontSize: 10, opacity: 0.55, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.grade}</div>
          </div>
        </div>
        <button onClick={onLogout} className="gn-menu-item" style={{ fontSize: 12.5, fontWeight: 600, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.22)", color: "#F2F6FC", padding: "8px 10px", borderRadius: 9, cursor: "pointer", width: "100%", fontFamily: FONT_MENU }}>⏻ Déconnexion</button>
      </div>
    </div>
  );
}
