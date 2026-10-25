// pages/hierarchiePublique.jsx — Hiérarchie de la Gendarmerie, visible par les civils (espace public).
// Données : /api/hierarchie (nom, grade, unité, fonction uniquement — ni RIO, ni pseudos, ni Discord).
import React, { useEffect, useState } from "react";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { smallBtn } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE, GRADES } from "../lib/constantes.js";

const BLEU = "#123A7A";
const couleurRang = (i, n) => `hsl(218, 64%, ${22 + (n > 1 ? i / (n - 1) : 0) * 30}%)`;

export function HierarchiePublique({ onCancel }) {
  const [agents, setAgents] = useState(null); // null = chargement
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [unite, setUnite] = useState("");

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const r = await fetch("/api/hierarchie");
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error("indisponible");
        if (!annule) setAgents(j.agents || []);
      } catch (e) { if (!annule) { setErreur(true); setAgents([]); } }
    })();
    return () => { annule = true; };
  }, []);

  const liste = agents || [];
  const avatars = useAvatars(liste.map((p) => p.robloxId).filter(Boolean));
  const connus = [...GRADES].reverse();
  const inconnus = Array.from(new Set(liste.map((p) => p.grade).filter((g) => g && !GRADES.includes(g)))).sort();
  const grades = [...connus, ...inconnus];
  const unites = Array.from(new Set(liste.map((p) => p.unite).filter(Boolean))).sort();
  const q = recherche.trim().toLowerCase();
  const garde = (p) => (!unite || p.unite === unite) && (!q || `${p.prenom} ${p.nom} ${p.fonction} ${p.sousFonction} ${p.unite} ${p.grade}`.toLowerCase().includes(q));
  const lignes = grades.map((g, i) => ({ g, i, agents: liste.filter((p) => p.grade === g && garde(p)).sort((a, b) => String(a.nom).localeCompare(String(b.nom))) })).filter((l) => l.agents.length > 0);
  const total = lignes.reduce((n, l) => n + l.agents.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 60px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 1050, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16, background: "#fff" }}>← Retour</button>
        <div style={{ background: "linear-gradient(135deg, #0F2A5C 0%, #123A7A 55%, #2F6FDE 100%)", color: "#fff", borderRadius: 16, padding: "22px 24px", marginBottom: 18, boxShadow: "0 14px 34px -18px rgba(7,20,46,0.6)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 27, fontWeight: 700, marginBottom: 4 }}>🏛 Hiérarchie de la Gendarmerie</div>
          <div style={{ fontSize: 13, opacity: 0.88, lineHeight: 1.6, maxWidth: 640 }}>Les gradés et gendarmes de Nîmes RP, du plus haut grade au plus bas. Pour contacter un agent, passez par le dépôt de plainte ou par notre serveur Discord.</div>
          {agents && !erreur && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              {[[liste.length, "gendarmes"], [lignes.length, "grades représentés"], [unites.length, "unités"]].map(([n, l]) => (
                <div key={l} style={{ background: "rgba(255,255,255,0.14)", borderRadius: 10, padding: "6px 14px" }}><b style={{ fontSize: 18 }}>{n}</b> <span style={{ fontSize: 12, opacity: 0.9 }}>{l}</span></div>
              ))}
            </div>
          )}
        </div>

        {agents === null && <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement de la hiérarchie…</div>}
        {erreur && <div style={{ color: "#C0172D", fontSize: 13 }}>Impossible de charger la hiérarchie pour l'instant. Réessaie plus tard.</div>}

        {agents && !erreur && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔎 Rechercher un nom, une fonction…" style={{ flex: "1 1 260px", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 24, padding: "10px 16px", fontSize: 13.5, fontFamily: FONT_BASE, background: "#fff" }} />
              <span style={{ fontSize: 12, color: "#5A6B84" }}>{total} résultat{total > 1 ? "s" : ""}</span>
            </div>
            {unites.length > 1 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {["", ...unites].map((u) => <button key={u || "toutes"} onClick={() => setUnite(u)} style={{ ...smallBtn, background: unite === u ? BLEU : "#fff", color: unite === u ? "#fff" : "#14213A", borderColor: unite === u ? BLEU : "#C3D0E2" }}>{u || "Toutes les unités"}</button>)}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lignes.map(({ g, i, agents: ag }) => (
                <div key={g} style={{ display: "flex", flexWrap: "wrap", background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, overflow: "hidden", boxShadow: "0 6px 20px -14px rgba(7,20,46,0.35)" }}>
                  <div style={{ flex: "0 0 220px", maxWidth: "100%", boxSizing: "border-box", background: couleurRang(i, grades.length), color: "#fff", padding: "14px 18px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontFamily: FONT_TITRE, fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{g}</div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>{ag.length} agent{ag.length > 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ flex: "1 1 320px", minWidth: 0, padding: "12px 14px", display: "flex", flexWrap: "wrap", gap: 10, alignContent: "center" }}>
                    {ag.map((p, k) => (
                      <div key={`${p.nom}-${p.prenom}-${k}`} style={{ flex: "1 1 240px", maxWidth: 360, display: "flex", alignItems: "center", gap: 12, background: "#F9FBFE", border: "1px solid #E3EAF4", borderRadius: 12, padding: "9px 12px" }}>
                        {p.robloxId && avatars[p.robloxId]
                          ? <Avatar src={avatars[p.robloxId]} taille={44} />
                          : <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#E3EAF4", color: BLEU, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{`${(p.prenom || "?")[0]}${(p.nom || "?")[0]}`.toUpperCase()}</div>}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 13.5, color: "#14213A", lineHeight: 1.25 }}>{p.prenom} {p.nom}</div>
                          <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 2, lineHeight: 1.35 }}>
                            {p.unite}
                            {p.fonction || p.sousFonction ? <><br />{[p.fonction, p.sousFonction].filter(Boolean).join(" · ")}</> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {lignes.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun agent ne correspond à cette recherche.</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
