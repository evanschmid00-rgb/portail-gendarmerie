// pages/justice.jsx — Palais de justice : demandes des OPJ (comparution immédiate, procès, mandats, rapports) et liste des mandats.
import React, { useCallback, useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { buttonPrimary, h2Style, labelStyle, selectStyle } from "../composants/ui.jsx";
import { estPalaisJustice } from "../lib/utils.js";

export const TYPES_DEMANDE = ["Comparution immédiate", "Procès", "Mandat de perquisition", "Mandat d'arrêt", "Mandat d'amener", "Autre mandat", "Rapport"];
export const estMandat = (t) => String(t || "").startsWith("Mandat") || t === "Autre mandat";

const CARTE = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 18 };
const INP = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, marginBottom: 14, fontFamily: "inherit" };
const COULEUR = { "En attente": "#C77700", "Acceptée": "#1F6B42", "Refusée": "#C0172D", "Lu": "#123A7A", Actif: "#1F6B42", "Exécuté": "#123A7A", "Révoqué": "#C0172D", "Expiré": "#5A6B84" };
const Pastille = ({ statut }) => <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: COULEUR[statut] || "#5A6B84", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>{statut}</span>;
const dateFR = (iso) => { try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
const jourFR = (s) => { try { return new Date(`${s}T12:00:00`).toLocaleDateString("fr-FR"); } catch (e) { return s; } };
const nomDe = (p) => `${p.grade || ""} ${p.prenom || ""} ${p.nom || ""}`.trim();
const btn = (fond) => ({ background: fond, color: "#fff", border: 0, borderRadius: 6, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" });
const puce = (actif) => ({ border: "1px solid #C3D0E2", background: actif ? "#123A7A" : "#fff", color: actif ? "#fff" : "#123A7A", borderRadius: 20, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" });

/* ---------- Demandes et rapports ---------- */

export function DemandesJusticePage({ current }) {
  const juge = estPalaisJustice(current) || !!current.isAdmin;
  const opj = (current.qualifications || []).includes("OPJ") || !!current.isAdmin;
  const [liste, setListe] = useState(null);
  const [onglet, setOnglet] = useState("attente");
  const [form, setForm] = useState({ type: TYPES_DEMANDE[0], cible: "", refPV: "", objet: "", motif: "" });
  const [etat, setEtat] = useState({ busy: false, msg: "", ok: false });
  const [notes, setNotes] = useState({});
  const [validites, setValidites] = useState({});

  const charger = useCallback(async () => {
    try {
      const s = await getDocs(collection(db, "demandes_justice"));
      setListe(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
    } catch (e) { console.error(e); setListe([]); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function envoyer(e) {
    e.preventDefault();
    const f = { type: form.type, cible: form.cible.trim().slice(0, 200), refPV: form.refPV.trim().slice(0, 60), objet: form.objet.trim().slice(0, 200), motif: form.motif.trim().slice(0, 4000) };
    if (!f.objet || !f.motif) { setEtat({ busy: false, ok: false, msg: "Renseigne l'objet et l'exposé des faits." }); return; }
    if (f.type !== "Rapport" && !f.cible) { setEtat({ busy: false, ok: false, msg: "Indique la personne ou le lieu concerné." }); return; }
    setEtat({ busy: true, ok: false, msg: "Envoi…" });
    try {
      await addDoc(collection(db, "demandes_justice"), { ...f, statut: "En attente", auteurUid: current.id, auteurMatricule: current.matricule || "", auteurNom: nomDe(current), createdAt: new Date().toISOString() });
      setForm({ type: form.type, cible: "", refPV: "", objet: "", motif: "" });
      setEtat({ busy: false, ok: true, msg: "Envoyé au Palais de justice." });
      await charger();
    } catch (err) { console.error(err); setEtat({ busy: false, ok: false, msg: "Échec de l'envoi (réservé aux OPJ)." }); }
  }

  async function decider(d, statut) {
    const commentaire = String(notes[d.id] || "").trim().slice(0, 2000);
    try {
      let mandatId = "";
      if (statut === "Acceptée" && estMandat(d.type)) {
        const r = await addDoc(collection(db, "mandats"), {
          type: d.type, cible: d.cible || "", motif: d.motif || "", objet: d.objet || "", demandeId: d.id, demandeur: d.auteurNom || "",
          delivrePar: nomDe(current), delivreLe: new Date().toISOString(), valableJusqu: validites[d.id] || "", statut: "Actif",
        });
        mandatId = r.id;
      }
      await updateDoc(doc(db, "demandes_justice", d.id), { statut, commentaire, decidePar: nomDe(current), decideLe: new Date().toISOString(), ...(mandatId ? { mandatId } : {}) });
      await charger();
    } catch (e) { console.error(e); alert("Impossible d'enregistrer la décision."); }
  }

  const visibles = (liste || []).filter((d) => juge || d.auteurUid === current.id);
  const attente = visibles.filter((d) => d.statut === "En attente");
  const traitees = visibles.filter((d) => d.statut !== "En attente");
  const affichees = onglet === "attente" ? attente : traitees;

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={h2Style}>{juge ? "Demandes & rapports" : "Demandes au Palais de justice"}</h2>

      {opj && (
        <form onSubmit={envoyer} style={CARTE}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Nouvelle demande ou nouveau rapport</div>
          <label style={labelStyle}>Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ ...selectStyle, marginBottom: 14 }}>
            {TYPES_DEMANDE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {form.type !== "Rapport" && (<>
            <label style={labelStyle}>Personne ou lieu concerné</label>
            <input value={form.cible} onChange={(e) => setForm({ ...form, cible: e.target.value })} placeholder="Pseudo Roblox / identité, ou adresse du lieu" style={INP} />
          </>)}
          <label style={labelStyle}>Objet</label>
          <input value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} placeholder="Résumé en une ligne" style={INP} />
          <label style={labelStyle}>Numéro de PV (facultatif)</label>
          <input value={form.refPV} onChange={(e) => setForm({ ...form, refPV: e.target.value })} placeholder="PV-2026-XXXXX" style={INP} />
          <label style={labelStyle}>{form.type === "Rapport" ? "Rapport" : "Exposé des faits et justification"}</label>
          <textarea value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} rows={6} style={{ ...INP, resize: "vertical" }} />
          <button type="submit" disabled={etat.busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 22px", marginTop: 0 }}>Envoyer</button>
          {etat.msg && <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 600, color: etat.ok ? "#1F6B42" : etat.busy ? "#5A6B84" : "#C0172D" }}>{etat.msg}</span>}
        </form>
      )}

      <div style={CARTE}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setOnglet("attente")} style={puce(onglet === "attente")}>{juge ? "À traiter" : "En attente"} ({attente.length})</button>
          <button onClick={() => setOnglet("traitees")} style={puce(onglet === "traitees")}>Traitées ({traitees.length})</button>
        </div>
        {liste === null && <div style={{ fontSize: 13, color: "#5A6B84" }}>Chargement…</div>}
        {liste !== null && affichees.length === 0 && <div style={{ fontSize: 13, color: "#5A6B84" }}>Rien pour le moment.</div>}
        {affichees.map((d) => (
          <div key={d.id} style={{ borderTop: "1px solid #E3EAF4", padding: "14px 0" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ fontSize: 14 }}>{d.type}</b> <Pastille statut={d.statut} />
              <span style={{ fontSize: 12, color: "#5A6B84" }}>{dateFR(d.createdAt)} · par {d.auteurNom}</span>
            </div>
            <div style={{ fontWeight: 600, margin: "6px 0 2px", fontSize: 13.5 }}>{d.objet}</div>
            {d.cible && <div style={{ fontSize: 13 }}>Concerné : <b>{d.cible}</b></div>}
            {d.refPV && <div style={{ fontSize: 13 }}>PV : {d.refPV}</div>}
            <div style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "6px 0", color: "#243549" }}>{d.motif}</div>
            {d.statut !== "En attente" && (
              <div style={{ fontSize: 12.5, background: "#F2F6FC", borderRadius: 8, padding: "8px 10px", marginTop: 6 }}>
                {d.decidePar ? `Traité par ${d.decidePar} le ${dateFR(d.decideLe)}` : ""}
                {d.commentaire && <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>💬 {d.commentaire}</div>}
                {d.mandatId && <div style={{ marginTop: 4, fontWeight: 600 }}>📜 Mandat délivré (voir la page « Mandats »)</div>}
              </div>
            )}
            {juge && d.statut === "En attente" && (
              <div style={{ marginTop: 8 }}>
                <textarea value={notes[d.id] || ""} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} rows={2} placeholder="Commentaire (facultatif)" style={{ ...INP, marginBottom: 8, resize: "vertical" }} />
                {estMandat(d.type) && (
                  <div style={{ marginBottom: 8, fontSize: 12.5 }}>Valable jusqu'au (facultatif) : <input type="date" value={validites[d.id] || ""} onChange={(e) => setValidites({ ...validites, [d.id]: e.target.value })} style={{ padding: "5px 8px", border: "1px solid #C3D0E2", borderRadius: 6 }} /></div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  {d.type === "Rapport"
                    ? <button onClick={() => decider(d, "Lu")} style={btn("#123A7A")}>✓ Marquer comme lu</button>
                    : (<>
                        <button onClick={() => decider(d, "Acceptée")} style={btn("#1F6B42")}>✓ Accepter</button>
                        <button onClick={() => decider(d, "Refusée")} style={btn("#C0172D")}>✕ Refuser</button>
                      </>)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Mandats ---------- */

export function MandatsPage({ current }) {
  const juge = estPalaisJustice(current) || !!current.isAdmin;
  const opj = (current.qualifications || []).includes("OPJ") || !!current.isAdmin;
  const [liste, setListe] = useState(null);
  const [filtre, setFiltre] = useState("actifs");
  const [recherche, setRecherche] = useState("");
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const charger = useCallback(async () => {
    try {
      const s = await getDocs(collection(db, "mandats"));
      setListe(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.delivreLe || "").localeCompare(String(a.delivreLe || ""))));
    } catch (e) { console.error(e); setListe([]); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const statutReel = (m) => (m.statut === "Actif" && m.valableJusqu && m.valableJusqu < aujourdhui ? "Expiré" : m.statut);
  async function changer(m, patch) {
    try { await updateDoc(doc(db, "mandats", m.id), patch); await charger(); } catch (e) { console.error(e); alert("Action impossible."); }
  }

  const q = recherche.trim().toLowerCase();
  const affiches = (liste || []).filter((m) => (filtre === "tous" || statutReel(m) === "Actif") && (!q || `${m.cible} ${m.type} ${m.objet} ${m.motif}`.toLowerCase().includes(q)));

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={h2Style}>Mandats</h2>
      <div style={CARTE}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <button onClick={() => setFiltre("actifs")} style={puce(filtre === "actifs")}>Mandats actifs</button>
          <button onClick={() => setFiltre("tous")} style={puce(filtre === "tous")}>Tous</button>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔎 Rechercher une personne, un lieu…" style={{ ...INP, marginBottom: 0, flex: 1, minWidth: 180 }} />
        </div>
        {liste === null && <div style={{ fontSize: 13, color: "#5A6B84" }}>Chargement…</div>}
        {liste !== null && affiches.length === 0 && <div style={{ fontSize: 13, color: "#5A6B84" }}>Aucun mandat.</div>}
        {affiches.map((m) => {
          const st = statutReel(m);
          return (
            <div key={m.id} style={{ borderTop: "1px solid #E3EAF4", padding: "14px 0" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ fontSize: 14 }}>📜 {m.type}</b> <Pastille statut={st} />
              </div>
              <div style={{ fontSize: 13.5, margin: "5px 0" }}>Concerné : <b>{m.cible}</b></div>
              {m.objet && <div style={{ fontSize: 13, fontWeight: 600 }}>{m.objet}</div>}
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "#243549", margin: "4px 0" }}>{m.motif}</div>
              <div style={{ fontSize: 12, color: "#5A6B84" }}>
                Délivré le {dateFR(m.delivreLe)} par {m.delivrePar}{m.valableJusqu ? ` · valable jusqu'au ${jourFR(m.valableJusqu)}` : ""}{m.demandeur ? ` · demandé par ${m.demandeur}` : ""}
                {m.executePar ? ` · exécuté par ${m.executePar} le ${dateFR(m.executeLe)}` : ""}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {opj && m.statut === "Actif" && <button onClick={() => changer(m, { statut: "Exécuté", executeLe: new Date().toISOString(), executePar: nomDe(current) })} style={btn("#123A7A")}>✓ Marquer comme exécuté</button>}
                {juge && m.statut === "Actif" && <button onClick={() => window.confirm("Révoquer ce mandat ?") && changer(m, { statut: "Révoqué" })} style={btn("#C0172D")}>Révoquer</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
