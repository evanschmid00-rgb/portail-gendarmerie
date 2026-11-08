// pages/convocations.jsx — Convocations : à partir d'Adjudant-Chef, on convoque un gendarme ; le bot lui envoie un message privé (où, quand, par qui, pourquoi).
import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { loadWhere, envoyerConvocationDiscord } from "../lib/donnees.js";
import { peutConvoquer } from "../lib/droits.js";

const SERIF = "Georgia, 'Times New Roman', serif";
const CARTE = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 20, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 16 };
const INP = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #C3D0E2", borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: "#fff", color: "#14213A" };
const LAB = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase", color: "#5A6B84", margin: "12px 0 5px" };
const nomDe = (p) => `${p.grade ? p.grade + " " : ""}${p.prenom || ""} ${p.nom || ""}`.trim();
const quand = (iso) => { const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); };
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Ligne({ c, sens, onRepondre }) {
  const passe = new Date(c.dateHeure) < new Date();
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid #EEF2F7" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <b style={{ fontSize: 14, color: "#14213A" }}>{sens === "emise" ? `→ ${c.cibleNom}` : `← ${c.parGrade || ""} ${c.parNom}`}</b>
        <span style={{ fontSize: 12, fontWeight: 700, color: passe ? "#7B8AA3" : "#B25E00" }}>{passe ? "passée" : "à venir"}</span>
        {sens === "emise" && <span style={{ fontSize: 11.5, color: c.mpEnvoye ? "#1F6B42" : "#C0172D" }}>{c.mpEnvoye ? "✓ MP envoyé" : "⚠ MP non envoyé"}</span>}
      </div>
      <div style={{ fontSize: 13, color: "#3A4D6B", marginTop: 3 }}>📅 {quand(c.dateHeure)} · 📍 {c.lieu}</div>
      <div style={{ fontSize: 13, color: "#5A6B84", marginTop: 2 }}>📝 {c.motif}</div>
      {c.reponse && <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4, color: c.reponse === "Confirmée" ? "#1F6B42" : "#C0172D" }}>{c.reponse === "Confirmée" ? "✅ Présence confirmée" : `❌ Empêché${c.reponseMotif ? " : " + c.reponseMotif : ""}`}</div>}
      {sens === "recue" && !passe && !c.reponse && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => onRepondre(c, "Confirmée")} style={{ border: 0, borderRadius: 8, padding: "7px 14px", background: "#2E7D4F", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✅ Je serai présent</button>
          <button type="button" onClick={() => onRepondre(c, "Empêché")} style={{ border: "1px solid #C0172D", borderRadius: 8, padding: "7px 14px", background: "#fff", color: "#C0172D", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>❌ Je suis empêché</button>
        </div>
      )}
    </div>
  );
}

export function ConvocationsPage({ current, personnel = [] }) {
  const peut = peutConvoquer(current);
  const [emises, setEmises] = useState([]);
  const [recues, setRecues] = useState([]);
  const [f, setF] = useState({ cible: "", lieu: "", dateHeure: "", motif: "" });
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const uid = current.id || current.uid;
  const tri = (l) => l.slice().sort((a, b) => String(b.dateHeure).localeCompare(String(a.dateHeure)));

  useEffect(() => {
    let vivant = true;
    (async () => {
      const [r, e] = await Promise.all([loadWhere("convocations", "cibleUid", "==", uid), peut ? loadWhere("convocations", "parUid", "==", uid) : Promise.resolve([])]);
      if (vivant) { setRecues(tri(r)); setEmises(tri(e)); }
    })();
    return () => { vivant = false; };
  }, [uid, peut]);

  async function repondre(c, reponse) {
    let reponseMotif = "";
    if (reponse === "Empêché") { reponseMotif = (window.prompt("Pourquoi es-tu empêché ? (visible par la personne qui t'a convoqué)") || "").trim().slice(0, 300); if (!reponseMotif) return; }
    try {
      const patch = { reponse, reponseLe: new Date().toISOString(), reponseMotif };
      await updateDoc(doc(db, "convocations", c.id), patch);
      setRecues((l) => l.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    } catch (e) { console.error(e); setMsg({ ok: false, t: "Réponse non enregistrée (règles Firestore des convocations publiées ?)." }); }
  }
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const cibles = personnel.filter((p) => p.id !== uid && (!q.trim() || norm(`${p.prenom} ${p.nom} ${p.matricule}`).includes(norm(q.trim())))).slice(0, 8);
  const cible = personnel.find((p) => p.id === f.cible);

  async function envoyer(e) {
    e.preventDefault();
    if (!cible) { setMsg({ ok: false, t: "Choisis le gendarme à convoquer." }); return; }
    if (!f.lieu.trim() || !f.motif.trim() || !f.dateHeure) { setMsg({ ok: false, t: "Renseigne le lieu, la date et l'heure, et le motif." }); return; }
    const d = new Date(f.dateHeure);
    if (isNaN(d)) { setMsg({ ok: false, t: "Date invalide." }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await envoyerConvocationDiscord({ cibleUid: cible.id, lieu: f.lieu, dateHeure: d.toISOString(), motif: f.motif });
      if (r && r.convocation) setEmises((l) => tri([r.convocation, ...l]));
      setMsg({ ok: !!(r && r.ok), t: r && r.message ? r.message : "Envoi impossible pour le moment." });
      if (r && r.ok) setF({ cible: "", lieu: "", dateHeure: "", motif: "" });
    } catch (x) { console.error(x); setMsg({ ok: false, t: "Échec de l'envoi." }); } finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ background: "linear-gradient(120deg, #0B1D44 0%, #14305F 70%, #1B3F7D 100%)", borderRadius: 18, padding: "22px 26px", marginBottom: 16, color: "#fff" }}>
        <div style={{ fontSize: 10.5, letterSpacing: 2.6, color: "#8FB6FF", fontWeight: 700 }}>📣 CONVOCATIONS</div>
        <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, marginTop: 3 }}>Convocations</div>
        <div style={{ fontSize: 13.5, color: "#C9D6EC", marginTop: 4, lineHeight: 1.5 }}>{peut ? "Convoque un gendarme : le bot lui envoie aussitôt un message privé avec le lieu, la date, l'auteur et le motif." : "Retrouve ici les convocations qui te concernent."}</div>
        <div style={{ height: 3, width: 90, marginTop: 10, background: "linear-gradient(90deg,#1F4E9F 33%,#fff 33% 66%,#C0172D 66%)", borderRadius: 2 }} />
      </div>

      {peut && (
        <form onSubmit={envoyer} style={CARTE}>
          <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: "#14213A" }}>Nouvelle convocation</div>
          <label style={LAB}>Gendarme à convoquer</label>
          {cible ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ fontSize: 14.5 }}>{nomDe(cible)}</b>
              {!cible.discordId && <span style={{ fontSize: 12, color: "#C0172D", fontWeight: 600 }}>⚠ non relié à Discord : pas de message privé possible</span>}
              <button type="button" onClick={() => { maj("cible", ""); setQ(""); }} style={{ border: "1px solid #C3D0E2", background: "#fff", borderRadius: 16, padding: "3px 12px", cursor: "pointer", fontSize: 12 }}>Changer</button>
            </div>
          ) : (
            <>
              <input style={INP} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Nom, prénom ou matricule…" />
              {q.trim() && (
                <div style={{ border: "1px solid #C3D0E2", borderRadius: 10, marginTop: 4, maxHeight: 220, overflowY: "auto" }}>
                  {cibles.length === 0 ? <div style={{ padding: 10, fontSize: 13, color: "#5A6B84" }}>Aucun résultat.</div> : cibles.map((p) => (
                    <button key={p.id} type="button" onClick={() => maj("cible", p.id)} style={{ display: "block", width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #EEF2F7", background: "#fff", padding: "9px 12px", cursor: "pointer", fontSize: 13.5 }}>{nomDe(p)} <span style={{ color: "#7B8AA3" }}>· {p.unite}</span></button>
                  ))}
                </div>
              )}
            </>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "0 14px" }}>
            <div><label style={LAB}>Date et heure</label><input type="datetime-local" style={INP} value={f.dateHeure} onChange={(e) => maj("dateHeure", e.target.value)} /></div>
            <div><label style={LAB}>Lieu</label><input style={INP} value={f.lieu} onChange={(e) => maj("lieu", e.target.value)} placeholder="Ex : Bureau du commandant, caserne" /></div>
          </div>
          <label style={LAB}>Motif de la convocation</label>
          <textarea style={{ ...INP, minHeight: 80 }} value={f.motif} onChange={(e) => maj("motif", e.target.value)} placeholder="Explique pourquoi le gendarme est convoqué." />
          <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" disabled={busy} style={{ border: 0, borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", background: "#123A7A", color: "#fff", opacity: busy ? 0.7 : 1 }}>{busy ? "Envoi…" : "📣 Convoquer et prévenir par MP"}</button>
            {msg && <span style={{ fontSize: 13.5, fontWeight: 600, color: msg.ok ? "#1F6B42" : "#8A1020" }}>{msg.ok ? "✅ " : "⚠️ "}{msg.t}</span>}
          </div>
        </form>
      )}

      <div style={CARTE}>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: "#14213A" }}>Mes convocations reçues</div>
        {recues.length === 0 ? <div style={{ fontSize: 14, color: "#5A6B84", padding: "12px 0" }}>Aucune convocation.</div> : recues.map((c) => <Ligne key={c.id} c={c} sens="recue" onRepondre={repondre} />)}
      </div>
      {peut && (
        <div style={CARTE}>
          <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: "#14213A" }}>Convocations que j'ai émises</div>
          {emises.length === 0 ? <div style={{ fontSize: 14, color: "#5A6B84", padding: "12px 0" }}>Aucune convocation émise.</div> : emises.map((c) => <Ligne key={c.id} c={c} sens="emise" />)}
        </div>
      )}
    </div>
  );
}
