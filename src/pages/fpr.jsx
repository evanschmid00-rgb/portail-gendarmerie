// pages/fpr.jsx — FPR : Fichier des Personnes Recherchées. Les OPJ inscrivent ; tous les gendarmes consultent (alerte aussi dans le TAJ).
import React, { useState, useEffect } from "react";
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { loadCollection } from "../lib/donnees.js";
import { estOPJ } from "../lib/droits.js";
import { resoudreRoblox } from "../lib/dossierPersonne.js";
import { N, NeoAlerte, NeoBandeau, NeoBouton, NeoCarte, NeoCompteur, NeoLigne, NeoOnglets, NEO_INP, NEO_LAB } from "../composants/neo.jsx";

export const COL_FPR = "fpr";
export const CATEGORIES_FPR = ["Mandat de recherche", "Évadé", "Disparition inquiétante", "Interdiction de territoire", "Personne à surveiller"];
const DANGER = ["Faible", "Moyenne", "Élevée"];
const nomDe = (p) => `${p.grade ? p.grade + " " : ""}${p.prenom || ""} ${p.nom || ""}`.trim();
const dateFr = (iso) => { const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleDateString("fr-FR"); };

// Fiches FPR actives d'une personne (utilisé par le TAJ).
export async function chargerFprDe(compte) {
  const id = String(compte.id);
  const s = await getDocs(query(collection(db, COL_FPR), where("robloxId", "==", id)));
  return s.docs.map((d) => ({ ...d.data(), id: d.id })).filter((x) => x.actif !== false);
}

export function FprPage({ current }) {
  const peut = !!current.isAdmin || estOPJ(current);
  const [liste, setListe] = useState([]);
  const [charge, setCharge] = useState(false);
  const [vue, setVue] = useState("actives");
  const [f, setF] = useState({ at: "", categorie: CATEGORIES_FPR[0], danger: "Moyenne", motif: "", conduite: "Ne pas intervenir seul ; contacter immédiatement un OPJ." });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const uid = current.id || current.uid;

  useEffect(() => {
    let vivant = true;
    (async () => { const l = await loadCollection(COL_FPR); if (vivant) { setListe(l); setCharge(true); } })();
    return () => { vivant = false; };
  }, []);
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function inscrire(e) {
    e.preventDefault();
    const n = f.at.trim().replace(/^@/, "");
    if (!n || !f.motif.trim()) { setMsg({ ok: false, t: "Renseigne le @ Roblox et le motif." }); return; }
    setBusy(true); setMsg(null);
    try {
      const c = await resoudreRoblox(n);
      if (!c) { setMsg({ ok: false, t: "Compte Roblox introuvable." }); return; }
      const fiche = {
        robloxId: String(c.id), robloxUsername: c.username, pseudoRoblox: c.displayName || c.username,
        categorie: f.categorie, danger: f.danger, motif: f.motif.trim().slice(0, 600), conduite: f.conduite.trim().slice(0, 400),
        actif: true, saisiParUid: uid, saisiParNom: nomDe(current), saisiParMatricule: current.matricule || "", createdAt: new Date().toISOString(),
      };
      const r = await addDoc(collection(db, COL_FPR), fiche);
      setListe((l) => [{ ...fiche, id: r.id }, ...l]);
      setF({ ...f, at: "", motif: "" }); setMsg({ ok: true, t: `@${c.username} inscrit au FPR.` }); setVue("actives");
    } catch (x) { console.error(x); setMsg({ ok: false, t: "Inscription impossible (règles Firestore du FPR publiées ?)." }); }
    finally { setBusy(false); }
  }
  async function lever(x) {
    if (!window.confirm(`Lever la recherche de @${x.robloxUsername} ?`)) return;
    const patch = { actif: false, leveeLe: new Date().toISOString(), leveeParNom: nomDe(current) };
    try { await updateDoc(doc(db, COL_FPR, x.id), patch); setListe((l) => l.map((y) => (y.id === x.id ? { ...y, ...patch } : y))); } catch (e) { console.error(e); setMsg({ ok: false, t: "Action refusée." }); }
  }

  const actives = liste.filter((x) => x.actif !== false).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const levees = liste.filter((x) => x.actif === false);
  const ligne = (x) => (
    <NeoLigne key={x.id} couleur={x.danger === "Élevée" ? "#D62B45" : x.danger === "Moyenne" ? "#F0B048" : "#2F7BFF"} pastille={x.categorie.toUpperCase()} titre={`@${x.robloxUsername}${x.pseudoRoblox && x.pseudoRoblox !== x.robloxUsername ? " (" + x.pseudoRoblox + ")" : ""}`}
      sous={`Dangerosité ${x.danger} · inscrit par ${x.saisiParNom}`} date={dateFr(x.createdAt)}
      detail={<div style={{ fontSize: 14, lineHeight: 1.6, color: N.encre }}>
        <div><b>Motif :</b> {x.motif}</div><div><b>Conduite à tenir :</b> {x.conduite || "—"}</div>
        {x.actif === false && <div><b>Levée le</b> {dateFr(x.leveeLe)} par {x.leveeParNom}</div>}
        {peut && x.actif !== false && <div style={{ marginTop: 10 }}><NeoBouton variante="secondaire" onClick={() => lever(x)}>LEVER LA RECHERCHE</NeoBouton></div>}
      </div>} />
  );

  return (
    <div style={{ maxWidth: 940 }}>
      <NeoBandeau surtitre="Fichiers · consultation" titre="FPR — Personnes Recherchées" texte="Personnes sous mandat, évadées, disparues ou à surveiller. Une alerte s'affiche aussi dans le TAJ."
        droite={<NeoCompteur n={actives.length} label="Recherches actives" couleur="#EF6B7E" />} />
      <NeoOnglets onglets={[{ id: "actives", label: "ACTIVES", n: actives.length, couleur: "#D62B45" }, { id: "levees", label: "LEVÉES", n: levees.length }, ...(peut ? [{ id: "nouvelle", label: "INSCRIRE" }] : [])]} actif={vue} onChange={setVue} />
      {msg && <NeoAlerte ton={msg.ok ? "ok" : "danger"} icone={msg.ok ? "✅" : "⚠️"}>{msg.t}</NeoAlerte>}
      {vue === "nouvelle" && peut && (
        <NeoCarte titre="Inscrire une personne recherchée">
          <form onSubmit={inscrire}>
            <label style={{ ...NEO_LAB, marginTop: 0 }}>@ Roblox</label><input style={NEO_INP} value={f.at} onChange={(e) => maj("at", e.target.value)} placeholder="NomUtilisateur" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div><label style={NEO_LAB}>Catégorie</label><select style={NEO_INP} value={f.categorie} onChange={(e) => maj("categorie", e.target.value)}>{CATEGORIES_FPR.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label style={NEO_LAB}>Dangerosité</label><select style={NEO_INP} value={f.danger} onChange={(e) => maj("danger", e.target.value)}>{DANGER.map((c) => <option key={c}>{c}</option>)}</select></div>
            </div>
            <label style={NEO_LAB}>Motif *</label><textarea style={{ ...NEO_INP, minHeight: 80 }} value={f.motif} onChange={(e) => maj("motif", e.target.value)} />
            <label style={NEO_LAB}>Conduite à tenir</label><input style={NEO_INP} value={f.conduite} onChange={(e) => maj("conduite", e.target.value)} />
            <div style={{ marginTop: 16 }}><NeoBouton type="submit" disabled={busy}>{busy ? "…" : "INSCRIRE AU FPR"}</NeoBouton></div>
          </form>
        </NeoCarte>
      )}
      {vue === "actives" && (!charge ? <div style={{ color: N.gris }}>Chargement…</div> : actives.length === 0 ? <NeoAlerte ton="ok" icone="✅">Aucune personne recherchée actuellement.</NeoAlerte> : actives.map(ligne))}
      {vue === "levees" && (levees.length === 0 ? <div style={{ color: N.gris }}>Aucune recherche levée.</div> : levees.map(ligne))}
    </div>
  );
}
