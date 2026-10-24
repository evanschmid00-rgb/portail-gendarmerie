// pages/essai.jsx — « Recrues en essai » : période d'essai, parrain, titularisation.
import React, { useState } from "react";
import { h2Style, smallBtn } from "../composants/ui.jsx";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const JOUR = 86400000;
export const joursRestants = (fin) => (fin ? Math.ceil((new Date(fin).getTime() - Date.now()) / JOUR) : null);
export const enEssai = (p) => p.essaiStatut === "En cours" || p.essaiStatut === "Prolongée";
const dateFR = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—");

export function EssaiPage({ personnel, onUpdate }) {
  const [filtre, setFiltre] = useState("cours");
  const [msg, setMsg] = useState("");
  const liste = personnel
    .filter((p) => (filtre === "cours" ? enEssai(p) : filtre === "titularises" ? p.essaiStatut === "Titularisée" : false))
    .slice().sort((a, b) => String(a.essaiFin || "").localeCompare(String(b.essaiFin || "")));
  const nbCours = personnel.filter(enEssai).length;
  const nbTit = personnel.filter((p) => p.essaiStatut === "Titularisée").length;
  const candidatsParrain = personnel.filter((p) => !enEssai(p)).sort((a, b) => String(a.nom).localeCompare(String(b.nom)));

  async function agir(p, patch, ok) {
    const r = await onUpdate(p.id, patch);
    setMsg(r ? ok : "Échec de l'enregistrement.");
  }
  const chip = (actif) => ({ border: "1px solid #C3D0E2", background: actif ? "#123A7A" : "#fff", color: actif ? "#fff" : "#14213A", borderRadius: 16, padding: "5px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" });

  return (
    <div style={{ fontFamily: FONT, maxWidth: 900 }}>
      <h2 style={h2Style}>Recrues en essai</h2>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 14, lineHeight: 1.5 }}>Suivi des périodes d'essai (30 jours par défaut à la création du compte) : désigne un parrain, prolonge ou titularise.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button style={chip(filtre === "cours")} onClick={() => setFiltre("cours")}>En cours ({nbCours})</button>
        <button style={chip(filtre === "titularises")} onClick={() => setFiltre("titularises")}>Titularisées ({nbTit})</button>
      </div>
      {msg && <div style={{ background: "#EAF3FF", border: "1px solid #9CC0F0", color: "#123A7A", borderRadius: 10, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{msg}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {liste.map((p) => {
          const j = joursRestants(p.essaiFin);
          const urgent = enEssai(p) && j !== null && j <= 3;
          return (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${urgent ? "#C0172D" : p.essaiStatut === "Titularisée" ? "#2E7D4F" : "#2F6FDE"}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#14213A" }}>{p.grade} {p.prenom} {p.nom}</div>
                  <div style={{ fontSize: 12.5, color: "#5A6B84" }}>{p.unite} · RIO {p.cipcNumero || "—"}{p.creeLe ? ` · arrivé(e) le ${dateFR(p.creeLe)}` : ""}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700, color: urgent ? "#C0172D" : "#14213A" }}>{p.essaiStatut === "Titularisée" ? `Titularisé(e) le ${dateFR(p.titulariseLe)}` : j === null ? "Fin d'essai non définie" : j < 0 ? `Essai dépassé de ${-j} j` : `Fin d'essai : ${dateFR(p.essaiFin)} (${j} j)`}</div>
                  {p.essaiStatut === "Prolongée" && <div style={{ color: "#B25E00", fontWeight: 700 }}>Prolongée</div>}
                </div>
              </div>
              {enEssai(p) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
                  <label style={{ fontSize: 12.5, color: "#3A4D6B" }}>Parrain :{" "}
                    <select value={p.parrainMatricule || ""} onChange={(e) => { const m = candidatsParrain.find((x) => x.matricule === e.target.value); agir(p, { parrainMatricule: m ? m.matricule : "", parrainNom: m ? `${m.grade} ${m.prenom} ${m.nom}` : "" }, m ? `Parrain désigné : ${m.prenom} ${m.nom}.` : "Parrain retiré."); }} style={{ padding: "6px 8px", border: "1px solid #C3D0E2", borderRadius: 8, fontSize: 13, background: "#fff" }}>
                      <option value="">— Aucun —</option>
                      {candidatsParrain.map((x) => <option key={x.id} value={x.matricule}>{x.grade} {x.prenom} {x.nom}</option>)}
                    </select>
                  </label>
                  <div style={{ flex: 1 }} />
                  <button type="button" style={smallBtn} onClick={() => agir(p, { essaiFin: new Date(Math.max(Date.now(), new Date(p.essaiFin || Date.now()).getTime()) + 14 * JOUR).toISOString(), essaiStatut: "Prolongée" }, "Période d'essai prolongée de 14 jours.")}>+14 jours</button>
                  <button type="button" style={{ ...smallBtn, background: "#2E7D4F", color: "#fff", borderColor: "#2E7D4F" }} onClick={() => { if (window.confirm(`Titulariser ${p.prenom} ${p.nom} ?`)) agir(p, { essaiStatut: "Titularisée", titulariseLe: new Date().toISOString() }, `${p.prenom} ${p.nom} est titularisé(e).`); }}>✓ Titulariser</button>
                </div>
              )}
              {!enEssai(p) && p.parrainNom && <div style={{ fontSize: 12.5, color: "#5A6B84", marginTop: 8 }}>Parrain : {p.parrainNom}</div>}
            </div>
          );
        })}
        {liste.length === 0 && <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, color: "#5A6B84", fontSize: 13 }}>{filtre === "cours" ? "Aucune recrue en période d'essai." : "Aucune recrue titularisée pour le moment."}</div>}
      </div>
    </div>
  );
}
