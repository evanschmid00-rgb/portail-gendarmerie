// pages/layout.jsx — Habillage du tableau de bord : barre du haut, menu latéral (catégories repliables + recherche), tuiles.
import { Map as MapIcon, Award, BadgeCheck, BookOpen, ChevronDown, ClipboardCheck, ClipboardList, Clock, FileSearch, FileText, GraduationCap, Home, Landmark, LayoutGrid, Medal, Megaphone, MessageSquare, Network, Package, Radio, Scale, ScrollText, Search, Settings, Shield, ShieldAlert, ShieldCheck, Shirt, Siren, Star, TrendingUp, UserCog, UserPlus, Users, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { DISCIPLINE_MIN_INDEX, FONT_BASE, GRADES, REGLAGES, estCommandement, estCorps } from "../lib/constantes.js";
import { peutCreerHabilitations, peutModifierConditions, peutModifierVigipirate, peutValiderHabilitations, estOPJ } from "../lib/droits.js";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { LogoGN } from "../composants/LogoGN.jsx";
import { LogoAMGN } from "../composants/LogoAMGN.jsx";
import { fmtHeure } from "../lib/utils.js";

/* ---------- Habillage : icônes, couleurs par catégorie, outils ---------- */

const ICONES_MENU = {
  "carte-ville": MapIcon, "cadre-juridique": Scale, "amgn-eval": ClipboardCheck, fiches: ClipboardList, "amgn-cours": BookOpen, "amgn-planning": Clock, "amgn-evaluations": GraduationCap,
  dossier: BadgeCheck, annonces: Megaphone, communaute: Users, "cartes-pro": BadgeCheck, "main-courante": Radio, "code-penal-interne": BookOpen, reglements: ScrollText, "mes-avis": Star, "questionnaires-internes": ClipboardList,
  "mon-service": Clock, "services-equipe": Users, pv: FileText, casier: FileSearch, "comptes-rendus": MessageSquare, 
  "admin-candidatures": UserPlus, promotions: Award, sanctions: Scale, "mes-sanctions": Scale, "admin-personnel": Users, roles: UserCog, "admin-questionnaires": ClipboardList, "admin-modeles-pv": FileText,
  "admin-services": Clock, "admin-grades": Settings, "admin-liens": Radio, essai: UserCog, "admin-plaintes": Siren, "plaintes-gendarmes": ShieldAlert, "avis-suggestions": MessageSquare, vigipirate: Shield, hierarchie: Network, equipement: Package, tenue: Shirt, habilitations: Medal, "habilitations-admin": ShieldCheck, formation: GraduationCap, "formation-admin": ClipboardCheck, "conditions-admission": ClipboardList,
};

// Une couleur et une icône par catégorie, pour se repérer d'un coup d'œil
const COULEURS_GROUPE = { "Académie AMGN": "#C9A227", "Justice": "#8A6D1F", "Général": "#4C8DF6", "Terrain": "#34C38F", "Ressources humaines": "#F0B048", "Direction": "#EF6B7E", "Mon espace": "#4C8DF6", "Carte de la ville": "#34C38F", "Mon service": "#34C38F", "Documentation": "#9B7BE8", "Plaintes internes": "#5B6EE1", "Recrutement": "#F0B048", "Commandement": "#EF6B7E", "Administration du site": "#7A8CA8" };
const ICONES_GROUPE = { "Académie AMGN": GraduationCap, "Justice": Scale, "Général": LayoutGrid, "Terrain": Siren, "Ressources humaines": Users, "Direction": Landmark, "Mon espace": Home, "Carte de la ville": MapIcon, "Mon service": Siren, "Documentation": BookOpen, "Plaintes internes": ShieldAlert, "Recrutement": UserPlus, "Commandement": Landmark, "Administration du site": Settings };
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
  const avatarsTop = useAvatars(current.robloxId ? [current.robloxId] : []);
  const photoTop = current.robloxId ? avatarsTop[current.robloxId] : null;
  const pill = actif
    ? { background: "#E3F4EA", color: "#1F6B42", border: "1px solid #A9D9BC" }
    : { background: "#EEF2F8", color: "#5A6B84", border: "1px solid #D3DDEA" };
  if (mobile) {
    return (
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: `${"linear-gradient(90deg, #0B3A8F 0 33.3%, #FFFFFF 33.3% 66.6%, #C0172D 66.6% 100%)"} top / 100% 3px no-repeat, rgba(255,255,255,0.97)`, backdropFilter: "blur(6px)", borderBottom: "1px solid #D3DDEA", padding: "9px 12px 8px", display: "flex", alignItems: "center", gap: 10, fontFamily: FONT_BASE }}>
        <button onClick={onMenu} aria-label="Ouvrir le menu" style={{ background: "#123A7A", border: "none", color: "#fff", borderRadius: 8, width: 40, height: 40, fontSize: 20, cursor: "pointer", flexShrink: 0 }}>☰</button>
        <BoutonAccueil onHome={onHome} actif={accueilActif} taille={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#14213A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titre}</div>
          <div style={{ fontSize: 11, color: "#5A6B84", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{`${current.grade} `}{current.prenom} {current.nom}</div>
        </div>
        <span style={{ ...pill, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}>{actif ? "● En service" : "○ Hors service"}</span>
      </div>
    );
  }
  const initialesTop = `${(current.prenom || "?")[0]}${(current.nom || "?")[0]}`.toUpperCase();
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, background: "linear-gradient(90deg, #0B3A8F 0 33.3%, #FFFFFF 33.3% 66.6%, #C0172D 66.6% 100%) top / 100% 4px no-repeat, rgba(255,255,255,0.94)", backdropFilter: "blur(10px)", borderBottom: "1px solid #D3DDEA", boxShadow: "0 10px 30px -22px rgba(7,20,46,0.6)", padding: "14px 40px 11px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: FONT_BASE }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <BoutonAccueil onHome={onHome} actif={accueilActif} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 2.4, color: "#8A97AB", fontWeight: 800 }}>ESPACE GENDARME</div>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, fontWeight: 700, color: "#0B1D44", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titre}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ ...pill, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20 }}>
          <span className={actif ? "gn-pulse" : undefined} style={{ width: 8, height: 8, borderRadius: "50%", background: actif ? "#1F9D55" : "#9AA8BD" }} />
          {actif ? `En service depuis ${fmtHeure(actif.debut)}` : "Hors service"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 14, borderLeft: "1px solid #D3DDEA" }}>
          <div style={{ textAlign: "right", lineHeight: 1.25 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#14213A" }}>{`${current.grade} `}{current.prenom} {current.nom}</div>
            <div style={{ fontSize: 11, color: "#5A6B84" }}>{`RIO ${current.cipcNumero || "—"}${current.unite ? ` · ${current.unite}` : ""}`}</div>
          </div>
          <span style={{ width: 46, height: 46, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg, #2F6FDE, #0B1D44)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, boxShadow: "0 10px 18px -8px #123A7A", border: "2px solid #fff", outline: "1px solid #C3D0E2", flexShrink: 0 }}>{photoTop ? <Avatar src={photoTop} taille={46} /> : initialesTop}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Accueil du tableau de bord : bandeau personnel, accès rapides, à traiter, toutes les pages ---------- */

const A_TRAITER = [
  ["taches", "taches", "tâche(s) à faire", "✅", "#2F6FDE"],
  ["pv", "pv", "PV à traiter", "📄", "#8A6D1F"],
  ["plaintes", "admin-plaintes", "plainte(s) en attente", "🚨", "#C0172D"],
  ["plaintesGendarmes", "plaintes-gendarmes", "plainte(s) contre un gendarme", "🛡️", "#5B6EE1"],
  ["candidatures", "admin-candidatures", "candidature(s) en attente", "📨", "#F0B048"],
  ["cr", "comptes-rendus", "compte(s) rendu(s)", "💬", "#34C38F"],
];
const RACCOURCIS = ["mon-service", "pv", "casier", "comptes-rendus", "dossier", "cadre-juridique", "amgn-cours", "carte-ville"];

export function AccueilGendarme({ current, actif, compteurs = {}, groups, onOpen }) {
  const now = new Date();
  const h = now.getHours();
  const salut = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  const dateTxt = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  const tous = groups.flatMap((g) => g.items);
  const existe = (id) => tous.find((it) => it.id === id);
  const raccourcis = RACCOURCIS.map(existe).filter(Boolean).slice(0, 6);
  const alertes = A_TRAITER.filter(([k, id]) => Number(compteurs[k]) > 0 && existe(id));
  const puce = { background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "#EAF1FF" };
  return (
    <div style={{ fontFamily: FONT_BASE }}>
      <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap", background: "radial-gradient(560px 320px at 8% 0%, rgba(47,111,222,0.5), transparent 70%), radial-gradient(420px 300px at 100% 100%, rgba(201,162,39,0.22), transparent 70%), linear-gradient(135deg, #0F3A85, #0A2150 60%, #07142E)", color: "#F2F6FC", borderRadius: 26, padding: "30px 32px", marginBottom: 22, boxShadow: "0 36px 64px -36px rgba(7,20,46,0.9)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: "linear-gradient(90deg, #2F6FDE 0 33.3%, #fff 33.3% 66.6%, #E5384F 66.6%)" }} />
        <LogoGN taille={92} />
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#E3C766", fontWeight: 800, textTransform: "capitalize" }}>{dateTxt}</div>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, margin: "6px 0 10px", lineHeight: 1.1, textShadow: "0 6px 24px rgba(0,0,0,0.45)" }}>{salut}, {current.grade} {current.nom}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={puce}>🎖️ {current.grade}</span>
            {current.unite && <span style={puce}>🏛️ {current.unite}</span>}
            {current.fonction && <span style={puce}>📌 {current.fonction}</span>}
            <span style={puce}>🪪 RIO {current.cipcNumero || "—"}</span>
          </div>
        </div>
        <div style={{ flex: "0 1 260px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20, padding: "16px 18px", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: actif ? "#7BE0A4" : "#C9D6EC" }}>
            <span className={actif ? "gn-pulse" : undefined} style={{ width: 10, height: 10, borderRadius: "50%", background: actif ? "#34D07A" : "#8FA0BA" }} />{actif ? "EN SERVICE" : "HORS SERVICE"}
          </div>
          <div style={{ fontSize: 13.5, margin: "6px 0 12px", color: "#EAF1FF" }}>{actif ? `Depuis ${fmtHeure(actif.debut)}` : "Tu n'as pas encore pris ton service."}</div>
          <button onClick={() => onOpen("mon-service")} className="gh-btn-anim" style={{ width: "100%", background: "#fff", color: "#0B3A8F", border: 0, borderRadius: 12, padding: "11px 14px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: FONT_BASE }}>{actif ? "Gérer mon service →" : "Prendre mon service →"}</button>
        </div>
      </div>

      {raccourcis.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 11, letterSpacing: 2.4, fontWeight: 800, color: "#C0172D", marginBottom: 10 }}>ACCÈS RAPIDES</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {raccourcis.map((it) => {
              const Icone = ICONES_MENU[it.id] || FileText;
              const g = groups.find((x) => x.items.some((y) => y.id === it.id));
              const c = couleurGroupe(g ? g.label : "");
              const { texte, n } = separerCompteur(it.label);
              return (
                <button key={it.id} onClick={() => onOpen(it.id)} className="gh-btn-anim" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, textAlign: "left", background: "#fff", border: "1px solid #D3DDEA", borderRadius: 18, padding: "16px 16px 14px", boxShadow: "0 16px 30px -24px rgba(7,20,46,0.7)", fontFamily: FONT_BASE, overflow: "hidden" }}>
                  <span style={{ position: "absolute", right: -22, top: -22, width: 84, height: 84, borderRadius: "50%", background: `${c}16` }} />
                  <span style={{ position: "relative", width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg, ${c}, ${c}b0)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 12px 20px -10px ${c}` }}><Icone size={23} color="#fff" strokeWidth={2} /></span>
                  <span style={{ position: "relative", fontSize: 14, fontWeight: 800, color: "#14213A", lineHeight: 1.25 }}>{texte}</span>
                  {n > 0 && <span style={{ position: "absolute", top: 10, right: 10, background: "#E5384F", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "1px 8px" }}>{n}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: 2.4, fontWeight: 800, color: "#C0172D", marginBottom: 10 }}>À TRAITER</div>
        {alertes.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
            {alertes.map(([k, id, label, ic, c]) => (
              <button key={k} onClick={() => onOpen(id)} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", background: "#fff", border: "1px solid #D3DDEA", borderLeft: `6px solid ${c}`, borderRadius: 16, padding: "13px 16px", fontFamily: FONT_BASE, boxShadow: "0 14px 26px -22px rgba(7,20,46,0.7)" }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: c, lineHeight: 1, minWidth: 38, textAlign: "center" }}>{compteurs[k]}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#14213A", lineHeight: 1.3 }}>{ic} {label}</span>
                <span style={{ color: c, fontWeight: 800 }}>→</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ background: "#E8F6EE", border: "1px solid #A9D9BC", color: "#1F6B42", borderRadius: 16, padding: "16px 20px", fontSize: 14, fontWeight: 600 }}>🎉 Rien à traiter pour le moment. Beau travail !</div>
        )}
      </div>

      <div style={{ fontSize: 11, letterSpacing: 2.4, fontWeight: 800, color: "#C0172D", marginBottom: 10 }}>TOUTES LES PAGES</div>
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
          <div key={g.label} style={{ marginBottom: 28, background: `linear-gradient(180deg, ${c}0f, transparent 120px)`, border: "1px solid #E1E8F2", borderRadius: 18, padding: "14px 16px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${c}33` }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: `${c}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconeG size={16} color={c} strokeWidth={2.2} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#14213A" }}>{g.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: c, background: `${c}1c`, borderRadius: 12, padding: "2px 10px", fontWeight: 800 }}>{g.items.length} page{g.items.length > 1 ? "s" : ""}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {g.items.map((it) => {
                const Icone = ICONES_MENU[it.id] || FileText;
                const { texte, n } = separerCompteur(it.label);
                return (
                  <button key={it.id} onClick={() => onOpen(it.id)} className="gh-btn-anim" style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "#fff", border: "1px solid #D3DDEA", borderBottom: `3px solid ${c}`, borderRadius: 14, padding: "14px 14px", cursor: "pointer", boxShadow: "0 8px 20px -14px rgba(7,20,46,0.5)", fontFamily: FONT_BASE }}>
                    <span style={{ width: 44, height: 44, borderRadius: 13, background: `linear-gradient(135deg, ${c}, ${c}aa)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 10px 18px -10px ${c}` }}>
                      <Icone size={22} color="#fff" strokeWidth={2} />
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
  // Recrue en formation à l'AMGN : uniquement l'espace de l'Académie
  if (counts.amgnRestreint) {
    return [{ label: "Académie AMGN", items: [
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

  const isDggnOuIggn = estCorps(current.unite);
  const isHautGrade = (current.gradeRank ?? GRADES.indexOf(current.grade)) >= DISCIPLINE_MIN_INDEX;

  const groups = [
    { label: "Carte de la ville", direct: true, items: [{ id: "carte-ville", label: "Carte de la ville" }] },
    {
      label: "Mon espace",
      items: [
        { id: "dossier", label: "𝐂𝐈𝐏𝐂" },
        { id: "taches", label: "Mes tâches" + (counts.taches ? ` (${counts.taches})` : "") },
        { id: "habilitations", label: "Mes habilitations" },
        { id: "mes-sanctions", label: "Mes sanctions" },
        ...(counts.questionnaires ? [{ id: "questionnaires-internes", label: "Candidatures internes" }] : []),
        { id: "compte", label: "Mon compte" },
      ],
    },
    {
      label: "Académie AMGN",
      items: [
        { id: "amgn-cours", label: "Cours de l'AMGN" },
        { id: "amgn-planning", label: "Planning des formations" },
        ...(isAdmin || (current.qualifications || []).includes("Personnel AMGN") ? [{ id: "amgn-evaluations", label: "Évaluation des recrues" }] : []),
      ],
    },
    {
      label: "Mon service",
      items: [
        { id: "mon-service", label: "Mon service" },
        { id: "services-equipe", label: "Services de l'équipe" },
        { id: "pv", label: "Procès-verbaux" + (canSeePV && counts.pv ? ` (${counts.pv})` : "") },
        { id: "casier", label: "Casier judiciaire" },
        { id: "comptes-rendus", label: "Comptes rendus" + (counts.cr ? ` (${counts.cr})` : "") },
      ],
    },
    {
      label: "Plaintes internes",
      items: [
        ...(isAdmin || estCommandement(current.unite) ? [{ id: "plaintes-gendarmes", label: "Plaintes contre un gendarme" + (counts.plaintesGendarmes ? ` (${counts.plaintesGendarmes})` : "") }] : []),
      ],
    },
    {
      label: "Documentation",
      items: [
        { id: "cadre-juridique", label: "Cadre juridique" },
        { id: "reglements", label: "Règlements" },
        { id: "hierarchie", label: "Hiérarchie" },
        { id: "fiches", label: "Fiches de référence" },
      ],
    },
    {
      label: "Justice",
      items: [
        ...(canSeePlaintes ? [{ id: "admin-plaintes", label: "Plaintes" + (counts.plaintes ? ` (${counts.plaintes})` : "") }] : []),
      ],
    },
    {
      label: "Recrutement",
      items: [
        ...(canSeeCandidatures ? [{ id: "essai", label: "Recrues en essai" }] : []),
        ...(!canSeeCandidatures && counts.filleuls ? [{ id: "essai", label: "Mes filleuls (" + counts.filleuls + ")" }] : []),
        ...(canSeeCandidatures ? [{ id: "admin-candidatures", label: "Candidatures" + (counts.candidatures ? ` (${counts.candidatures})` : "") }] : []),
        ...(peutModifierConditions(current) ? [{ id: "conditions-admission", label: "Conditions générales" }] : []),
      ],
    },
    {
      label: "Commandement",
      items: [
        { id: "promotions", label: "Promotions" },
        ...(isAdmin || isHautGrade ? [{ id: "sanctions", label: "Sanctions" }] : []),
        ...(isAdmin ? [{ id: "admin-personnel", label: "Gestion du personnel" }] : []),
        ...(peutValiderHabilitations(current) || peutCreerHabilitations(current) ? [{ id: "habilitations-admin", label: "Habilitations" }] : []),
        ...(peutModifierVigipirate(current) ? [{ id: "vigipirate", label: "Plan Vigipirate" }] : []),
      ],
    },
    {
      label: "Administration du site",
      items: isAdmin ? [
        { id: "roles", label: "Rôles & Permissions" },
        { id: "admin-grades", label: "Grades & unités" },
        { id: "admin-services", label: "Gestion des services" },
        { id: "admin-questionnaires", label: "Postes & candidatures" },
        { id: "admin-modeles-pv", label: "Modèles de PV" },
        { id: "admin-liens", label: "Liens utiles" },
      ] : [],
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
          <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{counts.amgnRestreint ? "Académie Militaire de la Gendarmerie Nationale" : "CGD de Saint-Tropez RP · Gendarmerie nationale"}</div>
          <div style={{ fontSize: 10, opacity: 0.6 }}>{counts.amgnRestreint ? "AMGN · Des chefs pour votre défense" : "Saint-Tropez RP · jeu de rôle"}</div>
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
          <div key={g.label} style={{ marginBottom: 8, background: deplie || (g.direct && section === g.items[0].id) ? "rgba(255,255,255,0.035)" : "transparent", borderRadius: 10 }}>
            <button
              className="gn-groupe"
              onClick={() => (g.direct ? setSection(g.items[0].id) : !q && setOuverts({ ...ouverts, [g.label]: !ouverts[g.label] }))}
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
