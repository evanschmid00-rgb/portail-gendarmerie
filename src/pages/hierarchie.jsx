// pages/hierarchie.jsx — Hiérarchie : tous les grades (du plus haut au plus bas) avec les agents qui portent chaque grade.
import React, { useState } from "react";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { PseudosAgent } from "../composants/Pseudos.jsx";
import { h2Style, smallBtn } from "../composants/ui.jsx";
import { GRADES } from "../lib/constantes.js";
import { numAgent } from "../lib/utils.js";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const champ = { boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 10, padding: "9px 11px", fontSize: 13, fontFamily: FONT, background: "#fff" };

// Du plus haut grade (bleu nuit) au plus bas (bleu clair)
const couleurRang = (i, n) => {
  const t = n > 1 ? i / (n - 1) : 0;
  return `hsl(218, 64%, ${22 + t * 30}%)`;
};

export function HierarchiePage({ current, personnel = [] }) {
  const [recherche, setRecherche] = useState("");
  const [unite, setUnite] = useState("");
  const [gradesVides, setGradesVides] = useState(true);

  // GRADES est classé du plus bas au plus haut : on l'inverse. Les grades inconnus de la liste sont ajoutés à la fin.
  const connus = [...GRADES].reverse();
  const inconnus = Array.from(new Set(personnel.map((p) => p.grade).filter((g) => g && !GRADES.includes(g)))).sort();
  const grades = [...connus, ...inconnus];

  const unites = Array.from(new Set(personnel.map((p) => p.unite).filter(Boolean))).sort();
  const q = recherche.trim().toLowerCase();
  const garde = (p) => (!unite || p.unite === unite) && (!q || `${p.prenom} ${p.nom} ${numAgent(p)} ${p.pseudoRoblox} ${p.pseudoDiscord} ${p.fonction} ${p.sousFonction} ${p.unite}`.toLowerCase().includes(q));
  const agentsDe = (g) => personnel.filter((p) => p.grade === g && garde(p)).sort((a, b) => String(a.nom).localeCompare(String(b.nom)));

  const avatars = useAvatars(personnel.map((p) => p.robloxId).filter(Boolean));
  const lignes = grades.map((g, i) => ({ g, i, agents: agentsDe(g) })).filter((l) => gradesVides || l.agents.length > 0);
  const nbAgents = lignes.reduce((n, l) => n + l.agents.length, 0);
  const nbOccupes = lignes.filter((l) => l.agents.length > 0).length;

  const tuile = (label, valeur) => (
    <div key={label} style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: "4px solid #123A7A", borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#123A7A", lineHeight: 1.1 }}>{valeur}</div>
      <div style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ fontFamily: FONT, maxWidth: 1050 }}>
      <h2 style={h2Style}>🏛 Hiérarchie</h2>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 16, lineHeight: 1.5 }}>Tous les grades de la Gendarmerie, du plus haut au plus bas, avec les agents qui les portent.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        {tuile("Agents", nbAgents)}
        {tuile("Grades occupés", `${nbOccupes} / ${lignes.length}`)}
        {tuile("Unités", unites.length)}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔎 Nom, n° d'agent, pseudo, fonction…" style={{ ...champ, flex: "1 1 240px" }} />
        <select value={unite} onChange={(e) => setUnite(e.target.value)} style={champ}>
          <option value="">Toutes les unités</option>
          {unites.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <button type="button" onClick={() => setGradesVides(!gradesVides)} style={{ ...smallBtn, background: gradesVides ? "#E6EDF7" : "transparent" }}>{gradesVides ? "✓ Grades vides affichés" : "Grades vides masqués"}</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lignes.map(({ g, i, agents }) => {
          const couleur = couleurRang(i, grades.length);
          const vide = agents.length === 0;
          return (
            <div key={g} style={{ display: "flex", flexWrap: "wrap", background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, overflow: "hidden", boxShadow: "0 6px 20px -14px rgba(7,20,46,0.35)", opacity: vide ? 0.7 : 1 }}>
              <div style={{ flex: "0 0 220px", maxWidth: "100%", boxSizing: "border-box", background: couleur, color: "#fff", padding: "14px 18px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{g}</div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>{vide ? "Aucun agent" : `${agents.length} agent${agents.length > 1 ? "s" : ""}`}</div>
              </div>
              <div style={{ flex: "1 1 320px", minWidth: 0, padding: "12px 14px", display: "flex", flexWrap: "wrap", gap: 10, alignContent: "center" }}>
                {agents.map((p) => {
                  const moi = p.id === current.id;
                  return (
                    <div key={p.id} style={{ flex: "1 1 240px", maxWidth: 360, display: "flex", alignItems: "center", gap: 12, background: moi ? "#E6EDF7" : "#F9FBFE", border: `1px solid ${moi ? "#123A7A" : "#E3EAF4"}`, borderRadius: 12, padding: "9px 12px" }}>
                      {p.robloxId
                        ? <Avatar src={avatars[p.robloxId]} taille={44} />
                        : <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#E3EAF4", color: "#123A7A", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{`${(p.prenom || "?")[0]}${(p.nom || "?")[0]}`.toUpperCase()}</div>}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 13.5, color: "#14213A", lineHeight: 1.25 }}>
                          {p.prenom} {p.nom}
                          {moi && <span style={{ marginLeft: 6, background: "#123A7A", color: "#fff", borderRadius: 999, padding: "0 7px", fontSize: 10.5, fontWeight: 700 }}>Toi</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 2, lineHeight: 1.35 }}>
                          {[p.cipcNumero ? `N° ${numAgent(p)}` : "", p.unite].filter(Boolean).join(" · ")}
                          {p.fonction || p.sousFonction ? <><br />{[p.fonction, p.sousFonction].filter(Boolean).join(" · ")}</> : null}
                        </div>
                        <div style={{ marginTop: 3 }}><PseudosAgent agent={p} style={{ marginLeft: 0 }} /></div>
                      </div>
                    </div>
                  );
                })}
                {vide && <div style={{ fontSize: 12.5, color: "#9AA8BD", padding: "6px 2px" }}>—</div>}
              </div>
            </div>
          );
        })}
        {lignes.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun grade à afficher.</div>}
      </div>
    </div>
  );
}
