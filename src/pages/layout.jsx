// pages/layout.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { Award, BadgeCheck, BookOpen, ClipboardList, Clock, FileSearch, FileText, MessageSquare, Radio, Scale, ScrollText, Settings, ShieldAlert, Siren, Star, TrendingUp, UserCog, UserPlus, Users } from "lucide-react";
import React from "react";
import { DISCIPLINE_MIN_INDEX, FONT_BASE, GRADES, REGLAGES, estCorps } from "../lib/constantes.js";
import { fmtHeure } from "../lib/utils.js";

/* ---------- Habillage : barre du haut, tuiles, mention RP ---------- */

const ICONES_MENU = {
  dossier: BadgeCheck, "cartes-pro": BadgeCheck, "main-courante": Radio, "code-penal-interne": BookOpen, reglements: ScrollText, "mes-avis": Star, "questionnaires-internes": ClipboardList,
  "mon-service": Clock, "services-equipe": Users, pv: FileText, casier: FileSearch, "comptes-rendus": MessageSquare, "rapports-internes": ShieldAlert, "postuler-sog": TrendingUp, "postuler-officier": TrendingUp,
  "admin-candidatures": UserPlus, promotions: Award, sanctions: Scale, "mes-sanctions": Scale, "admin-personnel": Users, roles: UserCog, "admin-questionnaires": ClipboardList, "admin-modeles-pv": FileText,
  "admin-services": Clock, "admin-grades": Settings, "admin-liens": Radio, "admin-plaintes": Siren, "plaintes-gendarmes": ShieldAlert, "avis-suggestions": MessageSquare,
};

export function RPRibbon() {
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999, background: "#FFF4D6", borderTop: "1px solid #E8D28A", color: "#6B4E00", fontSize: 11.5, fontWeight: 600, textAlign: "center", padding: "6px 12px", fontFamily: FONT_BASE, lineHeight: 1.35 }}>
      ⚠️ Site de jeu de rôle (Roblox) — usage RP uniquement. Aucun lien avec la Gendarmerie nationale réelle. Urgence réelle : 17 ou 112.
    </div>
  );
}

export function DashTopBar({ current, titre, actif }) {
  const pill = actif
    ? { background: "#E3F4EA", color: "#1F6B42", border: "1px solid #A9D9BC" }
    : { background: "#EEF2F8", color: "#5A6B84", border: "1px solid #D3DDEA" };
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(6px)", borderBottom: "1px solid #D3DDEA", padding: "10px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: FONT_BASE }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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

export function PulsarTuiles({ groups, onOpen }) {
  const visibles = groups.map((g) => ({ ...g, items: g.items.filter((it) => it.id !== "dossier") })).filter((g) => g.items.length > 0);
  return (
    <div style={{ marginBottom: 30, fontFamily: FONT_BASE }}>
      {visibles.map((g) => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "#5A6B84", marginBottom: 10 }}>{g.label}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 12 }}>
            {g.items.map((it) => {
              const Icone = ICONES_MENU[it.id] || FileText;
              return (
                <button key={it.id} onClick={() => onOpen(it.id)} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 14px", cursor: "pointer", boxShadow: "0 4px 14px -10px rgba(7,20,46,0.35)", fontFamily: FONT_BASE }}>
                  <span style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #123A7A, #2F6FDE)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icone size={20} color="#fff" strokeWidth={2} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#14213A", lineHeight: 1.25, minWidth: 0, overflowWrap: "anywhere" }}>{it.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Tableau de bord connecté ---------- */

export function construireMenu(current, isAdmin, counts) {
  const isOPJ = (current.qualifications || []).includes("OPJ");
  const isRecruteur = (current.qualifications || []).includes("Recruteur");
  const canSOG = current.grade === REGLAGES.seuilSog;
  const canOfficier = current.grade === REGLAGES.seuilCandOfficier;
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
        { id: "cartes-pro", label: "Cartes pro" },
        { id: "code-penal-interne", label: "Code Pénal" },
        { id: "reglements", label: "Règlements" },
        { id: "mes-avis", label: "Mes avis" },
        ...(counts.questionnaires ? [{ id: "questionnaires-internes", label: "Questionnaires" }] : []),
      ],
    },
    {
      label: "Terrain",
      items: [
        { id: "mon-service", label: "Mon service" },
        { id: "services-equipe", label: "Services de l'équipe" },
        { id: "main-courante", label: "Main courante" },
        { id: "pv", label: "Procès-verbaux" + (canSeePV && counts.pv ? ` (${counts.pv})` : "") },
        { id: "casier", label: "Casier judiciaire" },
        { id: "comptes-rendus", label: "Comptes rendus" + (counts.cr ? ` (${counts.cr})` : "") },
        { id: "rapports-internes", label: "Rapports internes" + (counts.rapports ? ` (${counts.rapports})` : "") },
        ...(canSOG ? [{ id: "postuler-sog", label: "Postuler SOG" }] : []),
        ...(canOfficier ? [{ id: "postuler-officier", label: "Postuler Officier" }] : []),
      ],
    },
    {
      label: "Ressources humaines",
      items: [
        ...(canSeeCandidatures ? [{ id: "admin-candidatures", label: "Candidatures" + (counts.candidatures ? ` (${counts.candidatures})` : "") }] : []),
        { id: "mes-sanctions", label: "Mes sanctions" },
        { id: "promotions", label: "Promotions" },
        ...(isAdmin || isHautGrade ? [{ id: "sanctions", label: "Sanctions" }] : []),
        ...(isAdmin ? [{ id: "admin-personnel", label: "Gestion du personnel" }] : []),
        ...(isAdmin ? [{ id: "roles", label: "Rôles & Permissions" }] : []),
        ...(isAdmin ? [{ id: "admin-questionnaires", label: "Questionnaires" }] : []),
        ...(isAdmin ? [{ id: "admin-modeles-pv", label: "Modèles de PV" }] : []),
        ...(isAdmin ? [{ id: "admin-services", label: "Gestion des services" }] : []),
        ...(isAdmin ? [{ id: "admin-grades", label: "Grades & unités" }, { id: "admin-liens", label: "Liens utiles" }] : []),
      ],
    },
    {
      label: "Direction",
      items: [
        ...(canSeePlaintes ? [{ id: "admin-plaintes", label: "Plaintes" + (counts.plaintes ? ` (${counts.plaintes})` : "") }] : []),
        ...(isAdmin || isDggnOuIggn ? [{ id: "plaintes-gendarmes", label: "Plaintes contre gendarmes" + (counts.plaintesGendarmes ? ` (${counts.plaintesGendarmes})` : "") }] : []),
        { id: "avis-suggestions", label: "Avis & Suggestions" },
      ],
    },
  ].filter((g) => g.items.length > 0);

  return groups;
}

export function Sidebar({ current, section, setSection, isAdmin, onLogout, counts, lienDiscord, lienZello }) {
  const groups = construireMenu(current, isAdmin, counts);

  const initiales = `${(current.prenom || "?")[0]}${(current.nom || "?")[0]}`.toUpperCase();

  return (
    <div style={{ width: 244, background: "linear-gradient(180deg, #0C2655, #07142E)", color: "#F2F6FC", padding: "22px 14px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box", overflowY: "auto", position: "sticky", top: 0, height: "100vh", alignSelf: "flex-start", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px solid #2F6FDE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 12, color: "#2F6FDE" }}>GN</span>
        </div>
        <div>
          <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>Gendarmerie Nationale de Black RP</div>
          <div style={{ fontSize: 10, opacity: 0.6 }}>Pulsar RP · jeu de rôle</div>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "#8FA0B8", opacity: 0.7, padding: "0 11px 6px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{g.label}</div>
          {g.items.map((it) => (
            <button
              key={it.id}
              onClick={() => setSection(it.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: section === it.id ? "#123A7A" : "transparent",
                color: "#F2F6FC",
                border: "none",
                borderLeft: section === it.id ? "3px solid #2F6FDE" : "3px solid transparent",
                borderRadius: 6,
                padding: "9px 11px",
                marginBottom: 2,
                fontSize: 13,
                fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                cursor: "pointer",
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      ))}

      <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        {(lienZello || lienDiscord || isAdmin) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
            {lienZello && <a href={lienZello} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", textDecoration: "none", background: "#2E7D4F", color: "#fff", borderRadius: 8, padding: "9px 10px", fontSize: 12.5, fontWeight: 700 }}>🎧 Radio Zello</a>}
            {lienDiscord && <a href={lienDiscord} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", textDecoration: "none", background: "#5865F2", color: "#fff", borderRadius: 8, padding: "9px 10px", fontSize: 12.5, fontWeight: 700 }}>💬 Serveur Discord</a>}
            {isAdmin && !lienZello && !lienDiscord && <button onClick={() => setSection("admin-liens")} style={{ fontSize: 11.5, background: "transparent", border: "1px dashed rgba(255,255,255,0.35)", color: "#F2F6FC", padding: "7px 8px", borderRadius: 8, cursor: "pointer" }}>+ Ajouter les liens Discord / Zello</button>}
          </div>
        )}
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
