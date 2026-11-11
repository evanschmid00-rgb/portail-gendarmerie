// pages/parcours.jsx — « Mon parcours » : le résumé de ma carrière en un coup d'œil (grade, habilitations, services, promotions, sanctions, convocations).
import React, { useState, useEffect } from "react";
import { loadWhere } from "../lib/donnees.js";
import { dureeService, fmtDuree } from "../lib/utils.js";
import { N, NeoAlerte, NeoBandeau, NeoCarte, NeoCompteur, NeoFiche, NeoLigne } from "../composants/neo.jsx";

const jour = (x) => { const d = new Date(x); return isNaN(d) ? "—" : d.toLocaleDateString("fr-FR"); };

export function ParcoursPage({ current, promotions = [], sanctions = [], services = [], onNavigate }) {
  const uid = current.id || current.uid;
  const [convocs, setConvocs] = useState([]);
  useEffect(() => { let v = true; loadWhere("convocations", "cibleUid", "==", uid).then((l) => v && setConvocs(l)); return () => { v = false; }; }, [uid]);
  const mat = current.matricule;
  const mesPromos = promotions.filter((p) => p.matricule === mat).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const mesSanctions = sanctions.filter((s) => s.matricule === mat || s.cibleUid === uid);
  const actives = mesSanctions.filter((s) => s.levee !== true && new Date(s.dateFin) > new Date());
  const now = Date.now();
  const mesServices = services.filter((s) => s.matricule === mat && s.type !== "ajustement");
  const totalMs = mesServices.reduce((t, s) => t + (dureeService(s, now) || 0), 0);
  const avenir = convocs.filter((c) => new Date(c.dateHeure) > new Date()).sort((a, b) => String(a.dateHeure).localeCompare(String(b.dateHeure)));
  const quals = current.qualifications || [];

  return (
    <div style={{ maxWidth: 900 }}>
      <NeoBandeau surtitre="Mon espace" titre={`${current.grade} ${current.prenom} ${current.nom}`} texte={`${current.unite || ""}${current.fonction ? " · " + current.fonction : ""} · matricule ${mat}`}
        droite={<>
          <NeoCompteur n={mesPromos.length} label="Mouvements" couleur="#6FA3FF" />
          <NeoCompteur n={actives.length} label="Sanctions" couleur="#FF6B7E" onClick={() => onNavigate("mes-sanctions")} />
          <NeoCompteur n={avenir.length} label="Convocations" couleur="#F0B048" onClick={() => onNavigate("convocations")} />
          <NeoCompteur n={quals.length} label="Habilitations" couleur="#6FE0A8" onClick={() => onNavigate("habilitations")} />
        </>} />
      {avenir.length > 0 && <NeoAlerte ton="attention" icone="📣"><b>Prochaine convocation :</b> {new Date(avenir[0].dateHeure).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {avenir[0].lieu} — par {avenir[0].parGrade} {avenir[0].parNom} ({avenir[0].motif})</NeoAlerte>}
      {actives.length > 0 && <NeoAlerte ton="danger" icone="⚖️">{actives.length} sanction{actives.length > 1 ? "s" : ""} en cours.</NeoAlerte>}
      <NeoCarte titre="Situation">
        <NeoFiche champs={[["Grade", current.grade], ["Unité", current.unite], ["Poste occupé", current.fonction], ["Matricule", mat], ["Qualité judiciaire", current.qualiteJudiciaire], ["Temps de service (période chargée)", totalMs ? fmtDuree(totalMs) : "—"]]} />
      </NeoCarte>
      <NeoCarte titre="Habilitations">
        {quals.length === 0 ? <div style={{ fontSize: 13.5, color: N.gris }}>Aucune habilitation particulière.</div> : <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{quals.map((q) => <span key={q} style={{ background: "#E8EEF8", color: "#123A7A", border: "1px solid #B8C7E0", borderRadius: 8, padding: "4px 12px", fontSize: 12.5, fontWeight: 800, letterSpacing: 0.4 }}>{q}</span>)}</div>}
      </NeoCarte>
      <NeoCarte titre="Mes grades">
        {mesPromos.length === 0 ? <div style={{ fontSize: 13.5, color: N.gris }}>Aucun mouvement enregistré.</div> : mesPromos.map((p) => (
          <NeoLigne key={p.id} couleur={p.type === "Promotion" ? "#1F9D55" : "#D62B45"} pastille={p.type === "Promotion" ? "PROMOTION" : "RÉTROGRADATION"} titre={`${p.ancienGrade} → ${p.nouveauGrade}`} sous={p.motif} date={jour(p.createdAt)} />
        ))}
      </NeoCarte>
      <NeoCarte titre="Mes sanctions" droite={mesSanctions.length > 5 ? <button type="button" onClick={() => onNavigate("mes-sanctions")} style={{ border: 0, background: "none", color: N.accent, fontWeight: 700, cursor: "pointer" }}>Tout voir →</button> : null}>
        {mesSanctions.length === 0 ? <NeoAlerte ton="ok" icone="✅">Aucune sanction.</NeoAlerte> : mesSanctions.slice().sort((a, b) => String(b.dateDebut).localeCompare(String(a.dateDebut))).slice(0, 5).map((s) => (
          <NeoLigne key={s.id} couleur="#D62B45" pastille={s.levee ? "LEVÉE" : (new Date(s.dateFin) > new Date() ? "EN COURS" : "TERMINÉE")} titre={s.type} sous={s.motif} date={`${jour(s.dateDebut)} → ${jour(s.dateFin)}`} />
        ))}
      </NeoCarte>
    </div>
  );
}
