// pages/unite.jsx — « Mon unité » : le commandant d'unité et son adjoint gèrent leurs gendarmes (rôle Opérateur) et leurs candidatures.
import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { roleUnite } from "../lib/unites.js";

const SERIF = "Georgia, 'Times New Roman', serif";
const CARTE = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 20, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 16 };
const nomDe = (p) => `${p.grade ? p.grade + " " : ""}${p.prenom || ""} ${p.nom || ""}`.trim();

export function MonUnitePage({ current, personnel = [], nbCandidatures = 0, onOpenCandidatures, onChange }) {
  const [msg, setMsg] = useState("");
  const unite = current.unite;
  const equipe = personnel.filter((p) => p.unite === unite).sort((a, b) => (b.gradeRank ?? 0) - (a.gradeRank ?? 0));
  const avatars = useAvatars(equipe.map((p) => p.robloxId).filter(Boolean));
  const autorise = !!current.isAdmin || !!roleUnite(current);
  if (!autorise) return <div style={CARTE}>🔒 Cet espace est réservé au commandant d'unité et à son adjoint.</div>;
  const nbOp = equipe.filter((p) => p.operateurUnite).length;
  async function basculer(p) {
    try {
      await updateDoc(doc(db, "personnel", p.id), { operateurUnite: !p.operateurUnite });
      setMsg(`${nomDe(p)} ${p.operateurUnite ? "n'est plus" : "est maintenant"} opérateur de l'unité.`);
      onChange && onChange(p.id, !p.operateurUnite);
    } catch (e) { console.error(e); setMsg("Échec : les règles Firestore des unités sont-elles publiées ?"); }
  }
  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(120deg, #0B1D44 0%, #14305F 70%, #1B3F7D 100%)", borderRadius: 18, padding: "22px 26px", marginBottom: 20, color: "#fff" }}>
        <div style={{ fontSize: 10.5, letterSpacing: 2.6, color: "#8FB6FF", fontWeight: 700 }}>{(roleUnite(current) ? roleUnite(current).label : "Administration").toUpperCase()}</div>
        <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, marginTop: 3 }}>{unite || "Mon unité"}</div>
        <div style={{ fontSize: 13.5, color: "#C9D6EC", marginTop: 4 }}>{equipe.length} gendarme{equipe.length > 1 ? "s" : ""} · {nbOp} opérateur{nbOp > 1 ? "s" : ""}</div>
        <div style={{ height: 3, width: 90, marginTop: 10, background: "linear-gradient(90deg,#1F4E9F 33%,#fff 33% 66%,#C0172D 66%)", borderRadius: 2 }} />
      </div>
      <button type="button" onClick={onOpenCandidatures} className="gh-card-anim" style={{ ...CARTE, display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", borderLeft: "6px solid #F0B048" }}>
        <span style={{ fontSize: 30 }}>📨</span>
        <span style={{ flex: 1 }}><b style={{ fontSize: 15, color: "#14213A" }}>Candidatures de l'unité</b><br /><span style={{ fontSize: 13, color: "#5A6B84" }}>{nbCandidatures ? `${nbCandidatures} candidature${nbCandidatures > 1 ? "s" : ""} en attente de ta décision` : "Aucune candidature en attente."}</span></span>
        <span style={{ fontWeight: 800, color: "#123A7A" }}>Ouvrir →</span>
      </button>
      <div style={CARTE}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, marginBottom: 4 }}>🎛️ Opérateurs de l'unité</div>
        <div style={{ fontSize: 13, color: "#5A6B84", marginBottom: 12, lineHeight: 1.5 }}>Donne ou retire la fonction d'opérateur aux gendarmes de ton unité.</div>
        {msg && <div style={{ color: "#2E7D4F", fontWeight: 700, marginBottom: 10 }}>{msg}</div>}
        {!equipe.length && <div style={{ color: "#7A8CA8" }}>Aucun gendarme dans cette unité.</div>}
        {equipe.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid #EEF2F8", flexWrap: "wrap" }}>
            <Avatar src={avatars[p.robloxId]} taille={38} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 800, color: "#14213A" }}>{nomDe(p)}</div>
              <div style={{ fontSize: 12, color: "#5A6B84" }}>{[roleUnite(p) && roleUnite(p).label, p.fonction].filter(Boolean).join(" · ") || "Gendarme"}</div>
            </div>
            {p.operateurUnite && <span style={{ background: "#E3F2E8", color: "#2E7D4F", borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 800 }}>Opérateur</span>}
            <button type="button" onClick={() => basculer(p)} disabled={p.id === current.id && !current.isAdmin} style={{ border: `1px solid ${p.operateurUnite ? "#C3D0E2" : "#123A7A"}`, background: p.operateurUnite ? "#fff" : "#123A7A", color: p.operateurUnite ? "#26364F" : "#fff", borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{p.operateurUnite ? "Retirer" : "Nommer opérateur"}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
