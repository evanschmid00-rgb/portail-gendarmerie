// pages/layout.jsx — Habillage du tableau de bord : barre du haut, menu latéral (catégories repliables + recherche), tuiles.
import { Map as MapIcon, Award, BadgeCheck, BookOpen, ChevronDown, ClipboardCheck, ClipboardList, Clock, FileSearch, FileText, GraduationCap, Home, Landmark, LayoutGrid, Medal, Megaphone, MessageSquare, Network, Package, Radio, Scale, ScrollText, Search, Settings, Shield, ShieldAlert, ShieldCheck, Shirt, Siren, Star, TrendingUp, UserCog, UserPlus, Users, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { DISCIPLINE_MIN_INDEX, FONT_BASE, GRADES, REGLAGES } from "../lib/constantes.js";
import { estCommandement, estEtatMajor } from "../lib/etatmajor.js";
import { estCmdUnite } from "../lib/unites.js";
import { peutCreerHabilitations, peutModifierConditions, peutModifierVigipirate, peutValiderHabilitations, estOPJ } from "../lib/droits.js";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { LogoGN } from "../composants/LogoGN.jsx";
import { LogoAMGN } from "../composants/LogoAMGN.jsx";
import { fmtHeure } from "../lib/utils.js";

/* ---------- Habillage : icônes, couleurs par catégorie, outils ---------- */

const ICONES_MENU = {
  "carte-ville": MapIcon, fpr: ShieldAlert, "cadre-juridique": Scale, "amgn-eval": ClipboardCheck, fiches: ClipboardList, "amgn-cours": BookOpen, "br-enquetes": FileSearch, "amgn-accueil": LayoutGrid, documentation: BookOpen, retrogradations: Scale, "mon-unite": Users, "amgn-planning": Clock, "amgn-evaluations": GraduationCap,
  dossier: BadgeCheck, annonces: Megaphone, communaute: Users, "cartes-pro": BadgeCheck, "main-courante": Radio, "code-penal-interne": BookOpen, reglements: ScrollText, "mes-avis": Star, "questionnaires-internes": ClipboardList,
  "mon-service": Clock, "services-equipe": Users, pv: FileText, casier: FileSearch, taj: FileSearch, convocations: MessageSquare, parcours: Award, cjn: FileText, "comptes-rendus": MessageSquare, 
  "admin-candidatures": UserPlus, promotions: Award, sanctions: Scale, "mes-sanctions": Scale, "admin-personnel": Users, roles: UserCog, "admin-questionnaires": ClipboardList, "admin-modeles-pv": FileText,
  "admin-services": Clock, "admin-grades": Settings, "admin-liens": Radio, essai: UserCog, "admin-plaintes": Siren, "plaintes-gendarmes": ShieldAlert, "avis-suggestions": MessageSquare, vigipirate: Shield, hierarchie: Network, equipement: Package, tenue: Shirt, habilitations: Medal, "habilitations-admin": ShieldCheck, formation: GraduationCap, "formation-admin": ClipboardCheck, "conditions-admission": ClipboardList,
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

export function DashTopBar({ current, titre, actif, mobile = false, onMenu, onHome, accueilActif = false, notifs = 0, onNotifs }) {
  const avatarsTop = useAvatars(current.robloxId ? [current.robloxId] : []);
  const photoTop = current.robloxId ? avatarsTop[current.robloxId] : null;
  const pill = actif
    ? { background: "rgba(52,208,122,0.14)", color: NEO.ok, border: "1px solid rgba(52,208,122,0.45)" }
    : { background: "rgba(143,166,200,0.12)", color: NEO.doux, border: `1px solid ${NEO.bord}` };
  const accueil = onHome && (
    <button type="button" onClick={onHome} title="Accueil NÉOGEND" aria-label="Accueil" style={{ width: mobile ? 40 : 42, height: mobile ? 40 : 42, borderRadius: 12, border: `1px solid ${accueilActif ? NEO.accent : NEO.bord}`, background: accueilActif ? NEO.accent : NEO.panneau2, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
      <Home size={20} strokeWidth={2.2} />
    </button>
  );
  if (mobile) {
    return (
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: NEO.fond, borderBottom: `1px solid ${NEO.bord}` }}>
        <div style={{ height: 3, background: TRICOLORE }} />
        <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 9 }}>
          <button onClick={onMenu} aria-label="Ouvrir le menu" style={{ background: NEO.panneau2, border: `1px solid ${NEO.bord}`, color: "#fff", borderRadius: 12, width: 40, height: 40, fontSize: 20, cursor: "pointer", flexShrink: 0 }}>☰</button>
          {accueil}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT_NEO, fontSize: 16, fontWeight: 800, letterSpacing: 3, color: NEO.accent }}>NÉOGEND</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}><HorlogeNeo taille={11} /><span style={{ fontSize: 10.5, color: NEO.ok }}>🔒 VPN actif</span></div>
          </div>
          <span style={{ ...pill, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}>{actif ? "● En service" : "○ Hors service"}</span>
        </div>
      </div>
    );
  }
  const initialesTop = `${(current.prenom || "?")[0]}${(current.nom || "?")[0]}`.toUpperCase();
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, background: NEO.fond, borderBottom: `1px solid ${NEO.bord}`, boxShadow: "0 12px 30px -20px rgba(0,0,0,0.8)" }}>
      <div style={{ height: 4, background: TRICOLORE }} />
      <div style={{ padding: "11px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          {accueil}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: FONT_NEO, fontSize: 11, letterSpacing: 3, color: NEO.accent, fontWeight: 800 }}>NÉOGEND</span>
              <span style={{ fontSize: 10, color: NEO.doux, letterSpacing: 1.6 }}>NOUVEL ÉQUIPEMENT OPÉRATIONNEL DE LA GENDARMERIE</span>
            </div>
            <div style={{ fontFamily: FONT_NEO, fontSize: 23, fontWeight: 700, color: NEO.texte, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titre}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right", lineHeight: 1.2 }}>
            <HorlogeNeo />
            <div style={{ fontSize: 10.5, color: NEO.ok, fontWeight: 700, letterSpacing: 1 }}>🔒 RÉSEAU CHIFFRÉ · VPN D'ÉTAT ACTIF</div>
          </div>
          <button type="button" onClick={onNotifs} title="Notifications opérationnelles" aria-label="Notifications" style={{ position: "relative", width: 42, height: 42, borderRadius: "50%", border: `1px solid ${notifs ? "#E5384F" : NEO.bord}`, background: NEO.panneau2, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Megaphone size={19} />
            {notifs > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#E5384F", color: "#fff", fontSize: 10.5, fontWeight: 800, borderRadius: 10, padding: "1px 6px", border: `2px solid ${NEO.fond}` }}>{notifs}</span>}
          </button>
          <span style={{ ...pill, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20 }}>
            <span className={actif ? "gn-pulse" : undefined} style={{ width: 8, height: 8, borderRadius: "50%", background: actif ? NEO.ok : NEO.doux }} />
            {actif ? `En service depuis ${fmtHeure(actif.debut)}` : "Hors service"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 16, borderLeft: `1px solid ${NEO.bord}` }}>
            <div style={{ textAlign: "right", lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: NEO.texte }}>{`${current.grade} `}{current.prenom} {current.nom}</div>
              <div style={{ fontSize: 11, color: NEO.doux }}>{`RIO ${current.cipcNumero || "—"}${current.unite ? ` · ${current.unite}` : ""}`}</div>
            </div>
            <span style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg, #2F6FDE, #0B1D44)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, border: `2px solid ${NEO.bord}` }}>
              {photoTop ? <img src={photoTop} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initialesTop}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- NÉOGEND : en-tête d'application (au-dessus de chaque page, comme une appli du terminal) ---------- */
export function NeoEnteteApp({ section, groups, titre, mobile = false, onHome }) {
  const groupe = groups.find((g) => g.items.some((it) => it.id === section));
  const c = couleurGroupe(groupe ? groupe.label : "");
  const Icone = ICONES_MENU[section] || FileText;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: mobile ? 11 : 16, padding: mobile ? "14px 14px 4px" : "26px 40px 4px", fontFamily: FONT_NEO }}>
      <span style={{ width: mobile ? 42 : 52, height: mobile ? 42 : 52, borderRadius: mobile ? 13 : 16, background: `linear-gradient(145deg, ${c}, ${c}88)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 14px 24px -12px ${c}, inset 0 1px 0 rgba(255,255,255,0.35)` }}>
        <Icone size={mobile ? 21 : 26} color="#fff" strokeWidth={1.9} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, letterSpacing: 2.4, color: NEO.doux, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>NÉOGEND <span style={{ color: c }}>›</span> {groupe ? groupe.label : "Application"}</div>
        <div style={{ fontSize: mobile ? 22 : 28, fontWeight: 700, color: NEO.texte, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titre}</div>
      </div>
      <button type="button" onClick={onHome} className="gh-btn-anim" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: NEO.panneau2, border: `1px solid ${NEO.bord}`, color: NEO.texte, borderRadius: 12, padding: mobile ? "9px 11px" : "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT_BASE, flexShrink: 0 }}>
        <Home size={16} /> {mobile ? "" : "Accueil"}
      </button>
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
  .neo-barre button { transition: transform .12s, background .15s; }
  .neo-barre button:active { transform: scale(.94); }
  @media (prefers-reduced-motion: reduce) { .neo-fenetre { animation: none; } .neo-fenetre button { transition: none; } }
`;

/* ---------- NÉOGEND : barre de navigation du bas (téléphone) ---------- */
export function BarreNeoMobile({ section, groups, onOpen, onMenu }) {
  const existe = (id) => groups.some((g) => g.items.some((it) => it.id === id));
  const items = [
    { id: "accueil", label: "Accueil", Icone: Home },
    existe("mon-service") && { id: "mon-service", label: "Service", Icone: Clock },
    existe("pv") && { id: "pv", label: "PVe", Icone: FileText },
    existe("taj") && { id: "taj", label: "TAJ", Icone: FileSearch },
  ].filter(Boolean);
  const btn = (actif) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: actif ? "rgba(47,123,255,0.18)" : "transparent", border: 0, borderRadius: 12, padding: "7px 2px", color: actif ? "#fff" : NEO.doux, fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT_NEO, letterSpacing: 0.6 });
  return (
    <nav className="neo-barre" aria-label="Navigation NÉOGEND" style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 60, zIndex: 9990, display: "flex", gap: 4, padding: "5px 8px", background: NEO.fond, borderTop: `1px solid ${NEO.bord}`, boxShadow: "0 -10px 30px -12px rgba(0,0,0,0.7)" }}>
      {items.map(({ id, label, Icone }) => (
        <button key={id} type="button" onClick={() => onOpen(id)} style={btn(section === id)}><Icone size={20} strokeWidth={2} />{label.toUpperCase()}</button>
      ))}
      <button type="button" onClick={onMenu} style={btn(false)}><LayoutGrid size={20} strokeWidth={2} />MENU</button>
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

export function AccueilGendarme({ current, actif, compteurs = {}, groups, onOpen }) {
  const now = new Date();
  const h = now.getHours();
  const salut = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  const dateTxt = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  const tous = groups.flatMap((g) => g.items);
  const existe = (id) => tous.find((it) => it.id === id);
  const alertes = A_TRAITER.filter(([k, id]) => Number(compteurs[k]) > 0 && existe(id));
  const puce = { background: "#fff", border: "1px solid #C9D6EC", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: BLEU2 };
  const sec = { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 20, padding: "4px 11px", fontSize: 11.5, fontWeight: 700 };
  return (
    <div style={{ fontFamily: FONT_BASE, background: "#fff", border: "1px solid #C9D6EC", borderRadius: 22, overflow: "hidden", marginBottom: 16, boxShadow: "0 24px 50px -30px rgba(0,0,0,0.9)" }}>
      <div style={{ background: `linear-gradient(135deg, ${BLEU}, #1D5BD6)`, color: "#fff", padding: "16px 22px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontFamily: FONT_NEO, fontSize: 15, fontWeight: 800, letterSpacing: 3 }}>NÉOGEND <span style={{ fontWeight: 600, opacity: 0.8, letterSpacing: 1.6, fontSize: 12 }}>· PORTAIL GENDARMERIE</span></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={sec}>🔒 Réseau chiffré</span>
            <span style={sec}>🛡️ VPN d'État actif</span>
            <span style={sec}>🪪 {current.cipcNumero ? `RIO ${current.cipcNumero}` : "Session CIPC"}</span>
          </div>
        </div>
      </div>
      <div style={{ height: 4, background: TRICOLORE }} />
      <div style={{ padding: "20px 22px 6px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", background: "linear-gradient(180deg, #F2F6FD, #fff)" }}>
        <LogoGN taille={74} />
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 2.2, color: "#5A6B84", fontWeight: 700, textTransform: "uppercase" }}>{dateTxt}</div>
          <div style={{ fontFamily: FONT_NEO, fontSize: "clamp(24px, 3.6vw, 32px)", fontWeight: 700, margin: "3px 0 9px", lineHeight: 1.1, color: "#0A1F44" }}>{salut}, {current.grade} {current.nom}</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {current.unite && <span style={puce}>🏛️ {current.unite}</span>}
            {current.fonction && <span style={puce}>📌 {current.fonction}</span>}
            <span style={puce}>🪪 {current.matricule || "—"}</span>
          </div>
        </div>
        <button onClick={() => onOpen("mon-service")} className="gh-btn-anim" style={{ flex: "0 1 230px", textAlign: "left", background: actif ? "#E7F5EC" : "#fff", border: `2px solid ${actif ? "#2E9D5F" : "#C9D6EC"}`, borderRadius: 16, padding: "12px 16px", cursor: "pointer", fontFamily: FONT_BASE }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT_NEO, fontSize: 14, fontWeight: 800, letterSpacing: 1.5, color: actif ? "#1F7A46" : BLEU2 }}>
            <span className={actif ? "gn-pulse" : undefined} style={{ width: 10, height: 10, borderRadius: "50%", background: actif ? "#2E9D5F" : "#8FA6C8" }} />{actif ? "EN SERVICE" : "HORS SERVICE"}
          </div>
          <div style={{ fontSize: 12.5, color: "#5A6B84", marginTop: 4 }}>{actif ? `Depuis ${fmtHeure(actif.debut)} — gérer` : "Appuie pour prendre ton service"}</div>
        </button>
      </div>
      <div style={{ padding: "12px 22px 20px" }}>
        <div style={{ fontFamily: FONT_NEO, fontSize: 12, letterSpacing: 2.6, fontWeight: 800, color: BLEU, margin: "0 0 8px" }}>🔔 NOTIFICATIONS OPÉRATIONNELLES</div>
        {alertes.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
            {alertes.map(([k, id, label, ic, c]) => (
              <button key={k} onClick={() => onOpen(id)} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "#F7F9FD", border: "1px solid #DCE5F2", borderLeft: `5px solid ${c}`, borderRadius: 12, padding: "10px 14px", fontFamily: FONT_BASE, cursor: "pointer", color: "#14213A" }}>
                <span style={{ fontFamily: FONT_NEO, fontSize: 28, fontWeight: 700, color: c, lineHeight: 1, minWidth: 34, textAlign: "center" }}>{compteurs[k]}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{ic} {label.replace("PV à traiter", "PVe à traiter")}</span>
                <span style={{ color: c, fontWeight: 800 }}>→</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ background: "#E7F5EC", border: "1px solid #9FD3B2", color: "#1F7A46", borderRadius: 12, padding: "12px 16px", fontSize: 13.5, fontWeight: 600 }}>✔ Aucune alerte opérationnelle. Tout est à jour.</div>
        )}
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
    <button onClick={() => onOpen(it.id)} className="gh-btn-anim" title={texte} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "transparent", border: 0, padding: "8px 2px", cursor: "pointer", fontFamily: FONT_BASE, color: "#0A1F44" }}>
      <span style={{ position: "relative", width: 72, height: 72, borderRadius: "50%", background: "#fff", border: `4px solid ${BLEU}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 18px -10px rgba(11,58,143,0.7)" }}>
        <Icone size={32} color={BLEU} strokeWidth={2.2} />
        {n > 0 && <span style={{ position: "absolute", top: -6, right: -6, background: "#D62B45", color: "#fff", fontSize: 11.5, fontWeight: 800, borderRadius: 12, padding: "1px 7px", border: "2px solid #fff", lineHeight: 1.4 }}>{n}</span>}
      </span>
      <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2, textAlign: "center", overflowWrap: "anywhere", maxWidth: 100 }}>{nom}</span>
    </button>
  );
}

/* ---------- Hub d'applications : une famille = une rangée d'icônes rondes ---------- */

export function PulsarTuiles({ groups, onOpen, inclureCipc = false }) {
  const visibles = groups.map((g) => ({ ...g, items: inclureCipc ? g.items : g.items.filter((it) => it.id !== "dossier") })).filter((g) => g.items.length > 0);
  return (
    <div style={{ fontFamily: FONT_BASE, background: "#fff", border: "1px solid #C9D6EC", borderRadius: 22, padding: "18px 22px 10px", marginBottom: 30, boxShadow: "0 24px 50px -30px rgba(0,0,0,0.9)" }}>
      <div style={{ fontFamily: FONT_NEO, fontSize: 13, letterSpacing: 2.6, fontWeight: 800, color: BLEU, margin: "0 0 14px" }}>MES APPLICATIONS</div>
      {visibles.map((g) => {
        const IconeG = ICONES_GROUPE[g.label] || LayoutGrid;
        return (
          <div key={g.label} style={{ marginBottom: 16, paddingBottom: 6, borderBottom: "1px solid #E3EAF5" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <IconeG size={15} color={BLEU2} strokeWidth={2.4} />
              <span style={{ fontFamily: FONT_NEO, fontSize: 13, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", color: BLEU2 }}>{g.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 4 }}>
              {g.items.map((it) => <AppNeo key={it.id} it={it} onOpen={onOpen} />)}
            </div>
          </div>
        );
      })}
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
    ...(cmdUnite ? [{ label: "Mon unité", items: [{ id: "mon-unite", label: "Mon unité & opérateurs" }, ...(!canSeeCandidatures ? [{ id: "admin-candidatures", label: "Candidatures de l'unité" + nb(counts.candidatures) }] : [])] }] : []),
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
