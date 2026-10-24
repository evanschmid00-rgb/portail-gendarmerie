// pages/taches.jsx — « Mes tâches » : tout ce qui attend la personne, au même endroit.
import React from "react";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";

// Construit la liste des tâches à partir des données déjà chargées. Chaque tâche : { id, icone, titre, detail, nombre, section, couleur }
export function construireTaches({ current, isAdmin, estOPJ, estRecruteur, estCorpsOuAdmin, estCommandementOuAdmin, compteurs, pvs, crAFaire, sanctionsActives, essaisEcheance = 0 }) {
  const t = [];
  if (sanctionsActives > 0) t.push({ id: "sanctions", icone: "⚠️", titre: "Sanction en cours", detail: "Consulte les détails et la date de fin.", nombre: sanctionsActives, section: "mes-sanctions", couleur: "#C0172D", urgent: true });
  if (crAFaire > 0) t.push({ id: "cr", icone: "📝", titre: "Comptes rendus à rédiger", detail: "Une intervention attend ton compte rendu.", nombre: crAFaire, section: "comptes-rendus", couleur: "#B25E00", urgent: true });
  if (estOPJ) {
    const aViser = pvs.filter((p) => !p.traite).length;
    const aTransmettre = pvs.filter((p) => p.traite && !p.transmisJustice).length;
    if (aViser > 0) t.push({ id: "pv-viser", icone: "✔", titre: "Procès-verbaux à viser", detail: "Relis puis vise les PV de tes gendarmes.", nombre: aViser, section: "pv", couleur: "#123A7A" });
    if (aTransmettre > 0) t.push({ id: "pv-transmettre", icone: "⚖️", titre: "PV visés à transmettre au Palais de justice", detail: "Ouvre le PV puis « Transmettre ».", nombre: aTransmettre, section: "pv", couleur: "#8A6D1F" });
    if (compteurs.plaintes > 0) t.push({ id: "plaintes", icone: "📨", titre: "Plaintes en attente", detail: "Prends en charge les nouvelles plaintes.", nombre: compteurs.plaintes, section: "admin-plaintes", couleur: "#7A1F2B" });
  }
  if (estRecruteur && compteurs.candidatures > 0) t.push({ id: "cand", icone: "👤", titre: "Candidatures en attente", detail: "Étudie et réponds aux candidats.", nombre: compteurs.candidatures, section: "admin-candidatures", couleur: "#2E7D4F" });
  if (estRecruteur && essaisEcheance > 0) t.push({ id: "essai", icone: "⏳", titre: "Périodes d'essai à échéance", detail: "Titularise ou prolonge ces recrues (3 jours ou moins).", nombre: essaisEcheance, section: "essai", couleur: "#2F6FDE" });
  if (estCorpsOuAdmin && compteurs.plaintesGendarmes > 0) t.push({ id: "pg", icone: "🛡", titre: "Signalements contre des gendarmes", detail: "À traiter par l'inspection.", nombre: compteurs.plaintesGendarmes, section: "plaintes-gendarmes", couleur: "#C0172D" });
  if (estCommandementOuAdmin && compteurs.rapports > 0) t.push({ id: "rap", icone: "📄", titre: "Rapports internes nouveaux", detail: "À lire et à traiter.", nombre: compteurs.rapports, section: "rapports-internes", couleur: "#16305C" });
  return t;
}

export function TachesCarte({ tache, onOpen }) {
  return (
    <button onClick={() => onOpen(tache.section)} className="gh-btn-anim" style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 14, width: "100%", background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${tache.couleur}`, borderRadius: 12, padding: "13px 16px", cursor: "pointer", fontFamily: FONT, boxShadow: "0 4px 14px -10px rgba(7,20,46,0.35)" }}>
      <span style={{ fontSize: 24, width: 34, textAlign: "center", flexShrink: 0 }}>{tache.icone}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "#14213A" }}>{tache.titre}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "#5A6B84", marginTop: 2 }}>{tache.detail}</span>
      </span>
      <span style={{ minWidth: 34, height: 34, borderRadius: 17, background: tache.couleur, color: "#fff", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px" }}>{tache.nombre}</span>
      <span style={{ color: "#8A97AB", fontSize: 18 }}>›</span>
    </button>
  );
}

// Parcours d'intégration d'une recrue : étapes calculées à partir de son profil (aucune lecture supplémentaire)
export function construireParcours({ current, aMotDePasse, aPrisService }) {
  if (!current || current.isAdmin) return null;
  // Parcours affiché pendant les 30 premiers jours du compte (date de création du compte)
  const debut = current.creeLe;
  if (!debut || Date.now() - new Date(debut).getTime() > 30 * 86400000) return null;
  const etapes = [
    { id: "compte", titre: "Compte créé", detail: "Bienvenue dans la Gendarmerie !", fait: true },
    { id: "roblox", titre: "Lier ton compte Roblox", detail: "Dans ton CIPC, renseigne ton compte Roblox.", fait: !!(current.robloxId || current.robloxVerifie), section: "dossier" },
    { id: "ident", titre: "Créer tes identifiants personnels", detail: "Pour te connecter aussi sans Discord (page « Mon compte »).", fait: !!aMotDePasse, section: "compte" },
    ...(current.enEntretien ? [{ id: "entretien", titre: "Entretien de recrutement", detail: "Un recruteur te contactera : reste disponible sur Discord.", fait: false }] : []),
    { id: "service", titre: "Prendre ton premier service", detail: "Passe en service depuis « Mon service » pour démarrer.", fait: !!aPrisService, section: "mon-service" },
  ];
  const essai = current.essaiStatut === "En cours" || current.essaiStatut === "Prolongée" ? { fin: current.essaiFin, parrain: current.parrainNom || "" } : null;
  const suivante = etapes.find((e) => !e.fait && !e.bloque) || null;
  return { essai, etapes, suivante, faites: etapes.filter((e) => e.fait).length };
}

export function ParcoursRecrue({ parcours, onOpen, compact = false }) {
  if (!parcours) return null;
  const { etapes, suivante, faites, essai } = parcours;
  const pct = Math.round((faites / etapes.length) * 100);
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: "4px solid #2E7D4F", borderRadius: 12, padding: "16px 18px", marginBottom: 20, fontFamily: FONT, boxShadow: "0 6px 20px -14px rgba(7,20,46,0.3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, fontWeight: 700, color: "#14213A" }}>🎖 Ton intégration</div>
        <div style={{ fontSize: 12.5, color: "#5A6B84", fontWeight: 600 }}>{faites}/{etapes.length} étapes · {pct}%</div>
      </div>
      <div style={{ height: 7, background: "#E3EAF4", borderRadius: 4, margin: "10px 0 12px", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "#2E7D4F" }} /></div>
      {essai && (
        <div style={{ fontSize: 12.5, color: "#3A4D6B", marginBottom: 10, lineHeight: 1.6 }}>
          🧭 <b>Parrain :</b> {essai.parrain || "pas encore désigné"}{essai.fin ? <> · <b>Fin de la période d'essai :</b> {new Date(essai.fin).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</> : null}
        </div>
      )}
      {suivante && (
        <button type="button" onClick={() => suivante.section && onOpen(suivante.section)} disabled={!suivante.section} className="gh-btn-anim" style={{ display: "block", width: "100%", textAlign: "left", background: "#EAF3FF", border: "1px solid #9CC0F0", borderRadius: 10, padding: "10px 14px", cursor: suivante.section ? "pointer" : "default", fontFamily: FONT, marginBottom: compact ? 0 : 12 }}>
          <span style={{ display: "block", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#123A7A", fontWeight: 800 }}>Ta prochaine étape</span>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "#14213A", marginTop: 2 }}>{suivante.titre}{suivante.section ? " ›" : ""}</span>
          <span style={{ display: "block", fontSize: 12.5, color: "#3A4D6B", marginTop: 2 }}>{suivante.detail}</span>
        </button>
      )}
      {!compact && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {etapes.map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, color: e.fait ? "#1F6B42" : e.bloque ? "#9AA8BD" : "#14213A" }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: e.fait ? "#2E7D4F" : "#D3DDEA", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{e.fait ? "✓" : ""}</span>
              <span style={{ textDecoration: e.fait ? "line-through" : "none" }}>{e.titre}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TachesPage({ taches, onOpen, prenom, parcours }) {
  const total = taches.reduce((n, t) => n + t.nombre, 0);
  return (
    <div style={{ maxWidth: 760, fontFamily: FONT }}>
      <h2 style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 26, fontWeight: 700, color: "#14213A", margin: "0 0 4px" }}>Mes tâches</h2>
      <ParcoursRecrue parcours={parcours} onOpen={onOpen} />
      <div style={{ fontSize: 13, color: "#5A6B84", marginBottom: 20 }}>{total > 0 ? `${prenom ? prenom + ", " : ""}voici ce qui t'attend (${total} élément${total > 1 ? "s" : ""}).` : "Tout est à jour 🎉"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {taches.map((t) => <TachesCarte key={t.id} tache={t} onOpen={onOpen} />)}
        {taches.length === 0 && <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 22, color: "#5A6B84", fontSize: 14, textAlign: "center" }}>Rien à faire pour le moment. Profites-en !</div>}
      </div>
    </div>
  );
}
