// pages/parcours.jsx — « Mon parcours » : le résumé de ma carrière en un coup d'œil (grade, habilitations, services, promotions, sanctions, convocations).
import React, { useState, useEffect } from "react";
import { loadWhere } from "../lib/donnees.js";
import { dureeService, fmtDuree } from "../lib/utils.js";

const SERIF = "Georgia, 'Times New Roman', serif";
const CARTE = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 18, marginBottom: 14 };
const jour = (s) => { const d = new Date(s); return isNaN(d) ? "—" : d.toLocaleDateString("fr-FR"); };
const Tuile = ({ n, label, onClick }) => (
  <button type="button" onClick={onClick} style={{ border: "1px solid #D3DDEA", background: "#fff", borderRadius: 12, padding: "12px 10px", textAlign: "center", cursor: onClick ? "pointer" : "default", minWidth: 110, flex: "1 1 110px" }}>
    <div style={{ fontSize: 22, fontWeight: 800, color: "#123A7A" }}>{n}</div>
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "#5A6B84" }}>{label}</div>
  </button>
);

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
    <div style={{ maxWidth: 860 }}>
      <div style={{ background: "linear-gradient(120deg, #0B1D44 0%, #14305F 70%, #1B3F7D 100%)", borderRadius: 18, padding: "22px 26px", marginBottom: 16, color: "#fff" }}>
        <div style={{ fontSize: 10.5, letterSpacing: 2.6, color: "#8FB6FF", fontWeight: 700 }}>🧭 MON PARCOURS</div>
        <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, marginTop: 3 }}>{current.grade} {current.prenom} {current.nom}</div>
        <div style={{ fontSize: 13.5, color: "#C9D6EC", marginTop: 4 }}>{current.unite}{current.fonction ? ` · ${current.fonction}` : ""} · matricule {mat}</div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <Tuile n={mesPromos.length} label="Mouvements de grade" />
        <Tuile n={actives.length} label="Sanctions en cours" onClick={() => onNavigate("mes-sanctions")} />
        <Tuile n={avenir.length} label="Convocations à venir" onClick={() => onNavigate("convocations")} />
        <Tuile n={quals.length} label="Habilitations" onClick={() => onNavigate("habilitations")} />
        <Tuile n={totalMs ? fmtDuree(totalMs) : "—"} label="Service (période chargée)" onClick={() => onNavigate("mon-service")} />
      </div>
      {avenir.length > 0 && (
        <div style={{ ...CARTE, borderColor: "#E0B15A", background: "#FFF9EC" }}>
          <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700 }}>📣 Prochaine convocation</div>
          <div style={{ fontSize: 14, marginTop: 6 }}>{new Date(avenir[0].dateHeure).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {avenir[0].lieu}</div>
          <div style={{ fontSize: 13, color: "#5A6B84" }}>Par {avenir[0].parGrade} {avenir[0].parNom} — {avenir[0].motif}</div>
        </div>
      )}
      <div style={CARTE}>
        <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Mes grades</div>
        {mesPromos.length === 0 ? <div style={{ fontSize: 13.5, color: "#5A6B84" }}>Aucun mouvement enregistré.</div> : mesPromos.map((p) => (
          <div key={p.id} style={{ padding: "8px 0", borderTop: "1px solid #EEF2F7", fontSize: 14 }}>
            <b style={{ color: p.type === "Promotion" ? "#1F6B42" : "#C0172D" }}>{p.type === "Promotion" ? "⬆️ Promotion" : "⬇️ Rétrogradation"}</b> · {p.ancienGrade} → <b>{p.nouveauGrade}</b>
            <span style={{ color: "#7B8AA3", fontSize: 12.5 }}> · {jour(p.createdAt)}</span>
            {p.motif && <div style={{ fontSize: 12.5, color: "#5A6B84" }}>{p.motif}</div>}
          </div>
        ))}
      </div>
      <div style={CARTE}>
        <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Mes habilitations</div>
        {quals.length === 0 ? <div style={{ fontSize: 13.5, color: "#5A6B84" }}>Aucune habilitation particulière.</div> : <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{quals.map((q) => <span key={q} style={{ background: "#E8EEF8", color: "#123A7A", borderRadius: 14, padding: "3px 11px", fontSize: 12.5, fontWeight: 700 }}>{q}</span>)}</div>}
      </div>
      <div style={CARTE}>
        <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Mes sanctions</div>
        {mesSanctions.length === 0 ? <div style={{ fontSize: 13.5, color: "#5A6B84" }}>✅ Aucune sanction.</div> : mesSanctions.slice().sort((a, b) => String(b.dateDebut).localeCompare(String(a.dateDebut))).slice(0, 5).map((s) => (
          <div key={s.id} style={{ padding: "8px 0", borderTop: "1px solid #EEF2F7", fontSize: 14 }}><b>{s.type}</b> · {jour(s.dateDebut)} → {jour(s.dateFin)}{s.levee ? " (levée)" : ""}<div style={{ fontSize: 12.5, color: "#5A6B84" }}>{s.motif}</div></div>
        ))}
      </div>
    </div>
  );
}
