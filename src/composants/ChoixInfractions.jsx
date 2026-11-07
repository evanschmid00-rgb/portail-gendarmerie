// composants/ChoixInfractions.jsx — sélecteur d'infractions du code pénal (utilisé dans les PV).
import React, { useState } from "react";

const COULEUR_TYPE = { Contravention: ["#2E7D4F", "#E3F2E8"], "Délit": ["#C77700", "#FFF1DC"], Crime: ["#C0172D", "#FBE3E7"] };
const INP = { width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #C3D0E2", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", background: "#fff", color: "#14213A" };
const sansAcc = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function ChoixInfractions({ codePenal, choisies, onChange }) {
  const [q, setQ] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const articles = Array.isArray(codePenal) ? codePenal : [];
  const noms = new Set(choisies.map((c) => c.nom));
  const trouves = articles.filter((a) => a && a.nom && !noms.has(a.nom) && (!q.trim() || sansAcc(`${a.nom} ${a.type}`).includes(sansAcc(q.trim())))).slice(0, 30);
  const ajouter = (a) => { onChange([...choisies, { nom: String(a.nom).slice(0, 120), type: a.type || "" }]); setQ(""); };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: choisies.length ? 8 : 0 }}>
        {choisies.map((c) => {
          const [fg, bg] = COULEUR_TYPE[c.type] || ["#123A7A", "#E6EDF7"];
          return (
            <span key={c.nom} style={{ background: bg, color: fg, border: `1px solid ${fg}`, borderRadius: 20, padding: "3px 6px 3px 11px", fontSize: 12.5, fontWeight: 700, display: "inline-flex", gap: 6, alignItems: "center" }}>
              {c.nom}{c.type ? ` · ${c.type}` : ""}
              <button type="button" onClick={() => onChange(choisies.filter((x) => x.nom !== c.nom))} aria-label="Retirer" style={{ border: 0, background: "transparent", color: fg, cursor: "pointer", fontWeight: 800, fontSize: 14, lineHeight: 1 }}>×</button>
            </span>
          );
        })}
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setOuvert(true); }} onFocus={() => setOuvert(true)} placeholder={articles.length ? "🔎 Rechercher une infraction dans le code pénal…" : "Chargement du code pénal…"} style={{ ...INP, marginBottom: 0 }} />
      {ouvert && trouves.length > 0 && (
        <div style={{ border: "1px solid #C3D0E2", borderRadius: 8, marginTop: 4, maxHeight: 210, overflowY: "auto", background: "#fff" }}>
          {trouves.map((a) => {
            const [fg] = COULEUR_TYPE[a.type] || ["#123A7A"];
            return (
              <button key={a.id || a.nom} type="button" onClick={() => ajouter(a)} style={{ display: "flex", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #EEF2F7", background: "#fff", padding: "8px 12px", cursor: "pointer", fontSize: 13.5 }}>
                <span>{a.nom}</span><b style={{ color: fg, fontSize: 12 }}>{a.type}</b>
              </button>
            );
          })}
        </div>
      )}
      {ouvert && <button type="button" onClick={() => setOuvert(false)} style={{ border: 0, background: "transparent", color: "#5A6B84", fontSize: 12, cursor: "pointer", marginTop: 4 }}>Fermer la liste</button>}
    </div>
  );
}
