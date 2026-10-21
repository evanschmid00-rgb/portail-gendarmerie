// pages/communaute.jsx — Communauté Roblox : demande d'acceptation des gendarmes, traitée par le Colonel et le Lieutenant-Colonel.
import React, { useCallback, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { buttonPrimary, h2Style, labelStyle } from "../composants/ui.jsx";
import { resoudreRoblox } from "../lib/dossierPersonne.js";
import { peutGererCommunaute } from "../lib/utils.js";

const COL = "demandes_communaute";
const CARTE = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 18 };
const INP = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, marginBottom: 14 };
const COULEUR = { "En attente": "#C77700", "Acceptée": "#1F6B42", "Refusée": "#C0172D" };
const Pastille = ({ statut }) => <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: COULEUR[statut] || "#5A6B84", borderRadius: 20, padding: "3px 10px" }}>{statut}</span>;
const dateFR = (iso) => { try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };

export function CommunautePage({ current, lienRoblox }) {
  const gere = peutGererCommunaute(current);
  const [mienne, setMienne] = useState(undefined); // undefined = chargement, null = aucune demande
  const [pseudo, setPseudo] = useState("");
  const [arobase, setArobase] = useState("");
  const [etat, setEtat] = useState({ busy: false, msg: "" });
  const [liste, setListe] = useState([]);
  const [onglet, setOnglet] = useState("attente");

  const charger = useCallback(async () => {
    try { const s = await getDoc(doc(db, COL, current.id)); setMienne(s.exists() ? { id: s.id, ...s.data() } : null); } catch (e) { console.error(e); setMienne(null); }
    if (gere) {
      try {
        const s = await getDocs(collection(db, COL));
        setListe(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
      } catch (e) { console.error(e); }
    }
  }, [current.id, gere]);
  useEffect(() => { charger(); }, [charger]);

  async function envoyer(e) {
    e.preventDefault();
    const p = pseudo.trim(), a = arobase.trim().replace(/^@/, "");
    if (!p || !a) { setEtat({ busy: false, msg: "Renseigne ton pseudo exact ET ton @ exact." }); return; }
    setEtat({ busy: true, msg: "Vérification de ton compte Roblox…" });
    const c = await resoudreRoblox(a);
    if (!c) { setEtat({ busy: false, msg: "Compte Roblox introuvable (ou Roblox ne répond pas). Vérifie ton @ exact." }); return; }
    if (c.username.toLowerCase() !== a.toLowerCase() || c.displayName.trim() !== p) {
      setEtat({ busy: false, msg: `Ces informations ne correspondent pas : ce compte s'appelle « ${c.displayName} » (@${c.username}). Recopie-les exactement.` });
      return;
    }
    try {
      await setDoc(doc(db, COL, current.id), {
        uid: current.id, matricule: current.matricule || "", nom: `${current.prenom} ${current.nom}`, grade: current.grade || "",
        pseudoRoblox: c.displayName, arobase: c.username, robloxId: String(c.id), statut: "En attente", createdAt: new Date().toISOString(),
      });
      setEtat({ busy: false, msg: "" });
      await charger();
    } catch (err) { console.error(err); setEtat({ busy: false, msg: "Échec de l'envoi, réessaie dans un instant." }); }
  }

  async function decider(d, statut) {
    try {
      await updateDoc(doc(db, COL, d.id), { statut, traiteLe: new Date().toISOString(), traitePar: `${current.grade} ${current.prenom} ${current.nom}` });
      await charger();
    } catch (e) { console.error(e); alert("Impossible d'enregistrer la décision."); }
  }

  const attente = liste.filter((d) => d.statut === "En attente");
  const traitees = liste.filter((d) => d.statut !== "En attente");
  const affichees = onglet === "attente" ? attente : traitees;
  const peutDemander = mienne === null || (mienne && mienne.statut === "Refusée");

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={h2Style}>Communauté Roblox</h2>

      {lienRoblox && (
        <div style={CARTE}>
          <div style={{ fontSize: 13.5, marginBottom: 12 }}>Rejoins la communauté Roblox pour jouer avec le reste de l'équipe :</div>
          <a href={lienRoblox} target="_blank" rel="noopener noreferrer" style={{ ...buttonPrimary, display: "inline-block", width: "auto", padding: "9px 22px", marginTop: 0, textDecoration: "none" }}>🎮 Ouvrir la communauté Roblox</a>
        </div>
      )}

      <div style={CARTE}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Ma demande d'acceptation</div>
        {mienne === undefined && <div style={{ fontSize: 13, color: "#5A6B84" }}>Chargement…</div>}
        {mienne && (
          <div style={{ fontSize: 13.5, marginBottom: peutDemander ? 16 : 0 }}>
            <Pastille statut={mienne.statut} /> <span style={{ marginLeft: 8 }}>{mienne.pseudoRoblox} (@{mienne.arobase}) · envoyée le {dateFR(mienne.createdAt)}</span>
            {mienne.statut === "Acceptée" && <div style={{ marginTop: 8, color: "#1F6B42" }}>Ta demande a été acceptée : tu peux rejoindre la communauté.</div>}
            {mienne.statut === "Refusée" && <div style={{ marginTop: 8, color: "#C0172D" }}>Ta demande a été refusée. Tu peux la renvoyer en vérifiant tes informations.</div>}
            {mienne.statut === "En attente" && <div style={{ marginTop: 8, color: "#5A6B84" }}>Un Colonel ou Lieutenant-Colonel va la traiter.</div>}
          </div>
        )}
        {peutDemander && (
          <form onSubmit={envoyer}>
            <label style={labelStyle}>Pseudo Roblox exact (nom affiché)</label>
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Ex. : Alice" style={INP} />
            <label style={labelStyle}>@ Roblox exact (nom d'utilisateur)</label>
            <input value={arobase} onChange={(e) => setArobase(e.target.value)} placeholder="Ex. : @Alice_RP" style={INP} />
            <div style={{ fontSize: 12, color: "#5A6B84", margin: "-8px 0 14px" }}>Les deux doivent correspondre exactement à ton compte Roblox : ils sont vérifiés automatiquement.</div>
            <button type="submit" disabled={etat.busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 22px", marginTop: 0 }}>Envoyer ma demande</button>
            {etat.msg && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: etat.busy ? "#5A6B84" : "#C0172D" }}>{etat.msg}</div>}
          </form>
        )}
      </div>

      {gere && (
        <div style={CARTE}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Demandes des gendarmes</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["attente", `À traiter (${attente.length})`], ["traitees", `Traitées (${traitees.length})`]].map(([k, l]) => (
              <button key={k} onClick={() => setOnglet(k)} style={{ border: "1px solid #C3D0E2", background: onglet === k ? "#123A7A" : "#fff", color: onglet === k ? "#fff" : "#123A7A", borderRadius: 20, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
          {affichees.length === 0 && <div style={{ fontSize: 13, color: "#5A6B84" }}>Aucune demande.</div>}
          {affichees.map((d) => (
            <div key={d.id} style={{ borderTop: "1px solid #E3EAF4", padding: "12px 0" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{d.grade} {d.nom} <span style={{ fontWeight: 400, color: "#5A6B84" }}>· {d.matricule}</span> <Pastille statut={d.statut} /></div>
              <div style={{ fontSize: 13.5, margin: "4px 0" }}>Pseudo : <b>{d.pseudoRoblox}</b> · @ : <b>@{d.arobase}</b></div>
              <div style={{ fontSize: 12, color: "#5A6B84" }}>Demandé le {dateFR(d.createdAt)}{d.traitePar ? ` · traité par ${d.traitePar} le ${dateFR(d.traiteLe)}` : ""}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {d.robloxId && <a href={`https://www.roblox.com/users/${encodeURIComponent(d.robloxId)}/profile`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: "#123A7A", alignSelf: "center" }}>Voir le profil Roblox ↗</a>}
                {d.statut !== "Acceptée" && <button onClick={() => decider(d, "Acceptée")} style={{ background: "#1F6B42", color: "#fff", border: 0, borderRadius: 6, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>✓ Accepter</button>}
                {d.statut !== "Refusée" && <button onClick={() => decider(d, "Refusée")} style={{ background: "#C0172D", color: "#fff", border: 0, borderRadius: 6, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>✕ Refuser</button>}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 10 }}>Ici tu notes ta décision : l'acceptation dans le groupe Roblox se fait ensuite sur Roblox.</div>
        </div>
      )}
    </div>
  );
}
