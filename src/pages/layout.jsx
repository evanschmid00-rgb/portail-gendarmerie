// pages/layout.jsx — Habillage du tableau de bord : barre du haut, menu latéral (catégories repliables + recherche), tuiles.
import { Award, BadgeCheck, BookOpen, ChevronDown, ClipboardCheck, ClipboardList, Clock, FileSearch, FileText, GraduationCap, Home, Landmark, LayoutGrid, Medal, Megaphone, MessageSquare, Network, Package, Radio, Scale, ScrollText, Search, Settings, Shield, ShieldAlert, ShieldCheck, Shirt, Siren, Star, TrendingUp, UserCog, UserPlus, Users, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { DISCIPLINE_MIN_INDEX, FONT_BASE, GRADES, REGLAGES, estCommandement, estCorps } from "../lib/constantes.js";
import { peutCreerHabilitations, peutGererFormation, peutModifierConditions, peutModifierVigipirate, peutValiderHabilitations } from "../lib/droits.js";
import { SECTIONS_BLOQUEES, estBloque, peutVoirFiches } from "../lib/formation.js";
import { estPalaisJustice, fmtHeure } from "../lib/utils.js";

/* ---------- Habillage : icônes, couleurs par catégorie, outils ---------- */

const ICONES_MENU = {
  dossier: BadgeCheck, annonces: Megaphone, "demandes-justice": Scale, "mon-profil-justice": UserCog, mandats: ScrollText, communaute: Users, "cartes-pro": BadgeCheck, "main-courante": Radio, "code-penal-interne": BookOpen, reglements: ScrollText, "mes-avis": Star, "questionnaires-internes": ClipboardList,
  "mon-service": Clock, "services-equipe": Users, pv: FileText, casier: FileSearch, "comptes-rendus": MessageSquare, "rapports-internes": ShieldAlert, 
  "admin-candidatures": UserPlus, promotions: Award, sanctions: Scale, "mes-sanctions": Scale, "admin-personnel": Users, roles: UserCog, "admin-questionnaires": ClipboardList, "admin-modeles-pv": FileText,
  "admin-services": Clock, "admin-grades": Settings, "admin-liens": Radio, "admin-plaintes": Siren, "plaintes-gendarmes": ShieldAlert, "avis-suggestions": MessageSquare, vigipirate: Shield, hierarchie: Network, equipement: Package, tenue: Shirt, habilitations: Medal, "habilitations-admin": ShieldCheck, formation: GraduationCap, "formation-admin": ClipboardCheck, "conditions-admission": ClipboardList,
};

// Une couleur et une icône par catégorie, pour se repérer d'un coup d'œil
const COULEURS_GROUPE = { "Palais de justice": "#8A6D1F", "Justice": "#8A6D1F", "Général": "#4C8DF6", "Terrain": "#34C38F", "Ressources humaines": "#F0B048", "Direction": "#EF6B7E" };
const ICONES_GROUPE = { "Palais de justice": Scale, "Justice": Scale, "Général": LayoutGrid, "Terrain": Siren, "Ressources humaines": Users, "Direction": Landmark };
const couleurGroupe = (label) => COULEURS_GROUPE[label] || "#4C8DF6";

// Les compteurs sont écrits dans le libellé : « Annonces (3) » → texte « Annonces » + pastille 3
function separerCompteur(label) {
  const m = String(label).match(/^(.*?)\s*\((\d+)\)$/);
  return m ? { texte: m[1], n: Number(m[2]) } : { texte: String(label), n: 0 };
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const CLE_OUVERTS = "gn_menu_groupes_ouverts";
function lireOuverts() {
  try { return JSON.parse(localStorage.getItem(CLE_OUVERTS) || "{}") || {}; } catch (e) { return {}; }
}

const FONT_MENU = "'Inter', 'Segoe UI', system-ui, sans-serif";

export function RPRibbon() {
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999, background: "#FFF4D6", borderTop: "1px solid #E8D28A", color: "#6B4E00", fontSize: 11.5, fontWeight: 600, textAlign: "center", padding: "6px 12px", fontFamily: FONT_BASE, lineHeight: 1.35 }}>
      ⚠️ Site de jeu de rôle (Roblox) — usage RP uniquement. Aucun lien avec la Gendarmerie nationale réelle. Urgence réelle : 17 ou 112.
    </div>
  );
}

// Petite maison : ouvre la page d'accueil (tuiles de navigation)
function BoutonAccueil({ onHome, actif, taille = 38 }) {
  if (!onHome) return null;
  return (
    <button type="button" onClick={onHome} title="Accueil" aria-label="Accueil" style={{ width: taille, height: taille, borderRadius: 10, border: `1px solid ${actif ? "#123A7A" : "#C3D0E2"}`, background: actif ? "#123A7A" : "#EEF2F8", color: actif ? "#fff" : "#123A7A", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
      <Home size={taille > 36 ? 20 : 18} strokeWidth={2.2} />
    </button>
  );
}

export function DashTopBar({ current, titre, actif, mobile = false, onMenu, onHome, accueilActif = false }) {
  const pill = actif
    ? { background: "#E3F4EA", color: "#1F6B42", border: "1px solid #A9D9BC" }
    : { background: "#EEF2F8", color: "#5A6B84", border: "1px solid #D3DDEA" };
  if (mobile) {
    return (
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(6px)", borderBottom: "1px solid #D3DDEA", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, fontFamily: FONT_BASE }}>
        <button onClick={onMenu} aria-label="Ouvrir le menu" style={{ background: "#123A7A", border: "none", color: "#fff", borderRadius: 8, width: 40, height: 40, fontSize: 20, cursor: "pointer", flexShrink: 0 }}>☰</button>
        <BoutonAccueil onHome={onHome} actif={accueilActif} taille={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#14213A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titre}</div>
          <div style={{ fontSize: 11, color: "#5A6B84", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.grade} {current.prenom} {current.nom}</div>
        </div>
        <span style={{ ...pill, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}>{actif ? "● En service" : "○ Hors service"}</span>
      </div>
    );
  }
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(6px)", borderBottom: "1px solid #D3DDEA", padding: "10px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: FONT_BASE }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BoutonAccueil onHome={onHome} actif={accueilActif} />
        <span style={{ background: "#123A7A", color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, padding: "4px 8px", borderRadius: 4 }}>PULSAR RP</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#14213A" }}>{titre}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ ...pill, fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 20 }}>{actif ? `● En service depuis ${fmtHeure(actif.debut)}` : "○ Hors service"}</span>
        <div style={{ textAlign: "right", lineHeight: 1.25 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#14213A" }}>{current.grade} {current.prenom} {current.nom}</div>
          <div style={{ fontSize: 11, color: "#5A6B84" }}>RIO {current.cipcNumero || "—"}{current.unite ? ` · ${current.unite}` : ""}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page d'accueil du tableau de bord : tuiles par catégorie ---------- */

export function PulsarTuiles({ groups, onOpen, inclureCipc = false }) {
  const visibles = groups.map((g) => ({ ...g, items: inclureCipc ? g.items : g.items.filter((it) => it.id !== "dossier") })).filter((g) => g.items.length > 0);
  return (
    <div style={{ marginBottom: 30, fontFamily: FONT_BASE }}>
      {visibles.map((g) => {
        const c = couleurGroupe(g.label);
        const IconeG = ICONES_GROUPE[g.label] || LayoutGrid;
        return (
          <div key={g.label} style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${c}33` }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: `${c}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconeG size={16} color={c} strokeWidth={2.2} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#14213A" }}>{g.label}</span>
              <span style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600 }}>{g.items.length} page{g.items.length > 1 ? "s" : ""}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {g.items.map((it) => {
                const Icone = ICONES_MENU[it.id] || FileText;
                const { texte, n } = separerCompteur(it.label);
                return (
                  <button key={it.id} onClick={() => onOpen(it.id)} className="gh-btn-anim" style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "#fff", border: "1px solid #D3DDEA", borderLeft: `4px solid ${c}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", boxShadow: "0 4px 14px -10px rgba(7,20,46,0.35)", fontFamily: FONT_BASE }}>
                    <span style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${c}, ${c}bb)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icone size={20} color="#fff" strokeWidth={2} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#14213A", lineHeight: 1.25, minWidth: 0, overflowWrap: "anywhere" }}>{texte}</span>
                    {n > 0 && <span style={{ position: "absolute", top: 8, right: 8, background: "#E5384F", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "1px 7px", lineHeight: 1.4 }}>{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Tableau de bord connecté : contenu du menu ---------- */

export function construireMenu(current, isAdmin, counts) {
  // Membre du Palais de justice : uniquement ces pages
  if (estPalaisJustice(current)) {
    return [{ label: "Palais de justice", items: [
      { id: "demandes-justice", label: "Demandes & rapports" },
      { id: "mandats", label: "Mandats" },
      { id: "pv", label: "Procès-verbaux" },
      { id: "casier", label: "Casier judiciaire" },
      { id: "code-penal-interne", label: "Code pénal" },
      { id: "mon-profil-justice", label: "Mon profil" },
    ] }];
  }
  const isOPJ = (current.qualifications || []).includes("OPJ");
  const isRecruteur = (current.qualifications || []).includes("Recruteur");
  const canSeeCandidatures = isAdmin || isRecruteur;
  const canSeePlaintes = isAdmin || isOPJ;
  const canSeePV = isAdmin || isOPJ;

  const isDggnOuIggn = estCorps(current.unite);
  const isHautGrade = (current.gradeRank ?? GRADES.indexOf(current.grade)) >= DISCIPLINE_MIN_INDEX;

  const groups = [
    {
      label: "Général",
      items: [
        { id: "dossier", label: "𝐂𝐈𝐏𝐂" },
        { id: "annonces", label: "Annonces" + (counts.annonces ? ` (${counts.annonces})` : "") },
        { id: "communaute", label: "Communauté Roblox" },
        { id: "hierarchie", label: "Hiérarchie" },
        ...(peutVoirFiches(current) ? [{ id: "formation", label: "Formation" }] : []),
        { id: "habilitations", label: "Mes habilitations" },
        { id: "code-penal-interne", label: "Code Pénal" },
        { id: "reglements", label: "Règlements" },
        { id: "equipement", label: "Équipement réglementaire" },
        { id: "tenue", label: "Tenue réglementaire" },
        { id: "mes-avis", label: "Mes avis" },
        ...(counts.questionnaires ? [{ id: "questionnaires-internes", label: "Questionnaires" }] : []),
      ],
    },
    {
      label: "Terrain",
      items: [
        { id: "mon-service", label: "Mon service" },
        { id: "services-equipe", label: "Services de l'équipe" },
        { id: "pv", label: "Procès-verbaux" + (canSeePV && counts.pv ? ` (${counts.pv})` : "") },
        { id: "casier", label: "Casier judiciaire" },
        { id: "comptes-rendus", label: "Comptes rendus" + (counts.cr ? ` (${counts.cr})` : "") },
        { id: "rapports-internes", label: "Rapports internes" + (counts.rapports ? ` (${counts.rapports})` : "") },
      ],
    },
    {
      label: "Ressources humaines",
      items: [
        ...(peutModifierConditions(current) ? [{ id: "conditions-admission", label: "Conditions d'admission" }] : []),
        ...(canSeeCandidatures ? [{ id: "admin-candidatures", label: "Candidatures" + (counts.candidatures ? ` (${counts.candidatures})` : "") }] : []),
        { id: "mes-sanctions", label: "Mes sanctions" },
        { id: "promotions", label: "Promotions" },
        ...(isAdmin || isHautGrade ? [{ id: "sanctions", label: "Sanctions" }] : []),
        ...(isAdmin ? [{ id: "admin-personnel", label: "Gestion du personnel" }] : []),
        ...(peutGererFormation(current) ? [{ id: "formation-admin", label: "Gestion de la formation" }] : []),
        ...(peutValiderHabilitations(current) || peutCreerHabilitations(current) ? [{ id: "habilitations-admin", label: "Habilitations" }] : []),
        ...(isAdmin ? [{ id: "roles", label: "Rôles & Permissions" }] : []),
        ...(isAdmin ? [{ id: "admin-questionnaires", label: "Questionnaires" }] : []),
        ...(isAdmin ? [{ id: "admin-modeles-pv", label: "Modèles de PV" }] : []),
        ...(isAdmin ? [{ id: "admin-services", label: "Gestion des services" }] : []),
        ...(isAdmin ? [{ id: "admin-grades", label: "Grades & unités" }, { id: "admin-liens", label: "Liens utiles" }] : []),
      ],
    },
    {
      label: "Justice",
      items: [
        { id: "mandats", label: "Mandats" },
        ...(canSeePlaintes ? [{ id: "demandes-justice", label: "Demandes au Palais de justice" }] : []),
      ],
    },
    {
      label: "Direction",
      items: [
        ...(canSeePlaintes ? [{ id: "admin-plaintes", label: "Plaintes" + (counts.plaintes ? ` (${counts.plaintes})` : "") }] : []),
        ...(isAdmin || isDggnOuIggn ? [{ id: "plaintes-gendarmes", label: "Plaintes contre gendarmes" + (counts.plaintesGendarmes ? ` (${counts.plaintesGendarmes})` : "") }] : []),
        ...(peutModifierVigipirate(current) ? [{ id: "vigipirate", label: "Plan Vigipirate" }] : []),
        { id: "avis-suggestions", label: "Avis & Suggestions" },
      ],
    },
  ]
    // Recrue dont la formation n'est pas validée : les pages terrain disparaissent du menu
    .map((g) => (estBloque(current) ? { ...g, items: g.items.filter((it) => !SECTIONS_BLOQUEES.includes(it.id)) } : g))
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
    if (g) setOuverts((o) => (o[g.label] ? o : { ...o, [g.label]: true }));
  }, [section]);

  // On retient les catégories ouvertes / fermées
  useEffect(() => {
    try { localStorage.setItem(CLE_OUVERTS, JSON.stringify(ouverts)); } catch (e) { /* stockage indisponible */ }
  }, [ouverts]);

  const q = norm(recherche.trim());
  const groupesAffiches = (q ? groups.map((g) => ({ ...g, items: g.items.filter((it) => norm(separerCompteur(it.label).texte).includes(q)) })).filter((g) => g.items.length > 0) : groups);
  const toutOuvrir = () => { const o = {}; groups.forEach((g) => { o[g.label] = true; }); setOuverts(o); };
  const toutFermer = () => setOuverts({});

  const initiales = `${(current.prenom || "?")[0]}${(current.nom || "?")[0]}`.toUpperCase();

  return (
    <div style={{ width: 260, background: "linear-gradient(180deg, #0C2655, #07142E)", color: "#F2F6FC", padding: "18px 12px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box", overflowY: "auto", position: "sticky", top: 0, height: "100vh", alignSelf: "flex-start", flexShrink: 0, ...(mobile ? { position: "fixed", top: 0, left: 0, width: "min(88vw, 310px)", height: "100%", padding: "14px 12px 96px", zIndex: 500, transform: ouvert ? "translateX(0)" : "translateX(-105%)", transition: "transform .25s ease", boxShadow: ouvert ? "8px 0 30px rgba(0,0,0,0.45)" : "none" } : {}) }}>
      {mobile && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button onClick={onClose} aria-label="Fermer le menu" style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✕ Fermer</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "0 4px" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #2F6FDE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 12, color: "#2F6FDE" }}>GN</span>
        </div>
        <div>
          <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>Gendarmerie Nationale de Nîmes RP</div>
          <div style={{ fontSize: 10, opacity: 0.6 }}>Pulsar RP · jeu de rôle</div>
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
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 6, padding: "0 4px" }}>
          <button onClick={toutOuvrir} style={{ background: "transparent", border: "none", color: "#8FA0B8", fontSize: 11, cursor: "pointer", fontFamily: FONT_MENU, padding: 0 }}>Tout ouvrir</button>
          <button onClick={toutFermer} style={{ background: "transparent", border: "none", color: "#8FA0B8", fontSize: 11, cursor: "pointer", fontFamily: FONT_MENU, padding: 0 }}>Tout fermer</button>
        </div>
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
          <div key={g.label} style={{ marginBottom: 8, background: deplie ? "rgba(255,255,255,0.035)" : "transparent", borderRadius: 10 }}>
            <button
              onClick={() => !q && setOuverts({ ...ouverts, [g.label]: !ouverts[g.label] })}
              aria-expanded={deplie}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none", color: "#F2F6FC", cursor: q ? "default" : "pointer", padding: "9px 8px", fontFamily: FONT_MENU, textAlign: "left" }}
            >
              <span style={{ width: 26, height: 26, borderRadius: 8, background: `${c}2b`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconeG size={15} color={c} strokeWidth={2.2} />
              </span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{g.label}</span>
              {!deplie && totalAlertes > 0 && <span style={{ background: "#E5384F", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 10, padding: "1px 7px" }}>{totalAlertes}</span>}
              {!q && <ChevronDown size={16} color="#8FA0B8" style={{ transition: "transform .2s", transform: deplie ? "rotate(0deg)" : "rotate(-90deg)", flexShrink: 0 }} />}
            </button>

            {deplie && (
              <div style={{ padding: "0 6px 8px 6px" }}>
                {g.items.map((it) => {
                  const Icone = ICONES_MENU[it.id] || FileText;
                  const { texte, n } = separerCompteur(it.label);
                  const actif = section === it.id;
                  return (
                    <button
                      key={it.id}
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
                        borderRadius: 7,
                        padding: "8px 9px",
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
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#123A7A", border: "1px solid rgba(47,111,222,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#2F6FDE", flexShrink: 0 }}>
            {initiales}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.prenom} {current.nom}</div>
            <div style={{ fontSize: 10, opacity: 0.55, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.grade}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ fontSize: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.25)", color: "#F2F6FC", padding: "6px 10px", borderRadius: 6, cursor: "pointer", width: "100%" }}>Déconnexion</button>
      </div>
    </div>
  );
}
