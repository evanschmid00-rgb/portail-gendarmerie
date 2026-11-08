// pages/recherche.jsx — Recherche globale : gendarmes, PV, plaintes, sanctions, candidatures, comptes rendus, et accès direct au TAJ par @ Roblox.
// Ne cherche que dans les données déjà chargées pour la personne connectée (aucune lecture Firebase en plus).
import React, { useState } from "react";

const SERIF = "Georgia, 'Times New Roman', serif";
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const texte = (o) => Object.values(o || {}).filter((v) => typeof v === "string" || typeof v === "number").join(" ");
const titre = (o) => o.titre || o.modeleTitre || o.objet || o.displayName || o.motif || o.ref || o.id;
const nomAgent = (p) => `${p.grade ? p.grade + " " : ""}${p.prenom || ""} ${p.nom || ""}`.trim();

export function RecherchePage({ current, personnel = [], pvs = [], plaintes = [], sanctions = [], candidatures = [], comptesRendus = [], onNavigate }) {
  const [q, setQ] = useState("");
  const t = norm(q.trim().replace(/^@/, ""));
  const groupes = !t ? [] : [
    { cle: "g", ico: "👮", nom: "Gendarmes", page: "admin-personnel", liste: personnel.filter((p) => norm(`${p.prenom} ${p.nom} ${p.matricule} ${p.username} ${p.unite} ${p.pseudoRoblox}`).includes(t)).map((p) => ({ id: p.id, t: nomAgent(p), s: `${p.unite || ""} · ${p.matricule || ""}` })) },
    { cle: "pv", ico: "📄", nom: "PV", page: "pv", liste: pvs.filter((x) => norm(texte(x)).includes(t)).map((x) => ({ id: x.id, t: `${x.modeleTitre || "PV"} ${x.ref ? "· " + x.ref : ""}`, s: `${x.auteurNom || ""}${x.traite ? " · visé" : " · à viser"}` })) },
    { cle: "pl", ico: "📝", nom: "Plaintes", page: "admin-plaintes", liste: plaintes.filter((x) => norm(texte(x)).includes(t)).map((x) => ({ id: x.id, t: String(titre(x)), s: x.statut || "" })) },
    { cle: "sa", ico: "⚖️", nom: "Sanctions", page: "sanctions", liste: sanctions.filter((x) => norm(texte(x)).includes(t)).map((x) => ({ id: x.id, t: `${x.type || "Sanction"} · ${x.nomCible || x.matricule || ""}`, s: x.motif || "" })) },
    { cle: "ca", ico: "📬", nom: "Candidatures", page: "admin-candidatures", liste: candidatures.filter((x) => norm(texte(x)).includes(t)).map((x) => ({ id: x.id, t: `${x.displayName || x.nom || "Candidat"} — ${x.poste || ""}`, s: x.statut || "" })) },
    { cle: "cr", ico: "🗒️", nom: "Comptes rendus", page: "comptes-rendus", liste: comptesRendus.filter((x) => norm(texte(x)).includes(t)).map((x) => ({ id: x.id, t: String(titre(x)), s: x.auteurNom || "" })) },
  ].filter((g) => g.liste.length);

  function ouvrirTaj() {
    try { window.sessionStorage.setItem("gn-taj-pre", q.trim().replace(/^@/, "")); } catch (e) { /* rien */ }
    onNavigate("taj");
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ background: "linear-gradient(120deg, #0B1D44 0%, #14305F 70%, #1B3F7D 100%)", borderRadius: 18, padding: "22px 26px", marginBottom: 16, color: "#fff" }}>
        <div style={{ fontSize: 10.5, letterSpacing: 2.6, color: "#8FB6FF", fontWeight: 700 }}>🔎 RECHERCHE</div>
        <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, marginTop: 3 }}>Recherche globale</div>
        <div style={{ fontSize: 13.5, color: "#C9D6EC", marginTop: 4 }}>Un nom, un matricule, une référence de PV… ou un @ Roblox pour ouvrir ses antécédents (TAJ).</div>
      </div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" style={{ width: "100%", boxSizing: "border-box", padding: "13px 16px", border: "1px solid #C3D0E2", borderRadius: 12, fontSize: 16, fontFamily: "inherit", marginBottom: 16 }} />
      {t && (
        <button type="button" onClick={ouvrirTaj} style={{ display: "block", width: "100%", textAlign: "left", background: "#F3E6FA", border: "1px solid #7A1FA2", color: "#4A1166", borderRadius: 12, padding: "12px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 16 }}>🗂️ Chercher « @{q.trim().replace(/^@/, "")} » dans le TAJ (antécédents judiciaires) →</button>
      )}
      {t && groupes.length === 0 && <div style={{ color: "#5A6B84", fontSize: 14 }}>Aucun résultat parmi les données auxquelles tu as accès.</div>}
      {groupes.map((g) => (
        <div key={g.cle} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: "#14213A" }}>{g.ico} {g.nom} <span style={{ fontSize: 12, color: "#7B8AA3", fontWeight: 600 }}>({g.liste.length})</span></div>
            <button type="button" onClick={() => onNavigate(g.page)} style={{ border: "1px solid #123A7A", background: "#fff", color: "#123A7A", borderRadius: 16, padding: "3px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Ouvrir la page →</button>
          </div>
          {g.liste.slice(0, 6).map((r) => (
            <div key={r.id} style={{ padding: "8px 0", borderTop: "1px solid #EEF2F7" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#14213A", overflowWrap: "anywhere" }}>{r.t}</div>
              {r.s && <div style={{ fontSize: 12.5, color: "#5A6B84", overflowWrap: "anywhere" }}>{r.s}</div>}
            </div>
          ))}
          {g.liste.length > 6 && <div style={{ fontSize: 12, color: "#7B8AA3", paddingTop: 6 }}>… et {g.liste.length - 6} autre(s) : affine ta recherche.</div>}
        </div>
      ))}
    </div>
  );
}
