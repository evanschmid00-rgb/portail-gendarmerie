// pages/justice.jsx — Palais de justice : demandes des OPJ (comparution immédiate, procès, mandats, rapports) et mandats (fiches officielles).
import React, { useCallback, useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { buttonPrimary, h2Style, labelStyle, selectStyle } from "../composants/ui.jsx";
import { estPalaisJustice, refAleatoire } from "../lib/utils.js";

export const TYPES_DEMANDE = ["Comparution immédiate", "Procès", "Mandat de perquisition", "Mandat d'arrêt", "Mandat d'amener", "Autre mandat", "Rapport"];
export const estMandat = (t) => String(t || "").startsWith("Mandat") || t === "Autre mandat";
const VALIDITE_DEFAUT = { "Mandat de perquisition": 7, "Mandat d'arrêt": 30, "Mandat d'amener": 15, "Autre mandat": 7 };
const LIBELLE_CIBLE = { "Mandat de perquisition": "Lieu à perquisitionner (adresse)", "Comparution immédiate": "Personne déférée (pseudo Roblox / identité)", "Procès": "Personne poursuivie (pseudo Roblox / identité)", "Mandat d'arrêt": "Personne visée (pseudo Roblox / identité)", "Mandat d'amener": "Personne visée (pseudo Roblox / identité)", "Autre mandat": "Personne ou lieu visé" };

const CARTE = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 18 };
const INP = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, marginBottom: 14, fontFamily: "inherit" };
const COULEUR = { "En attente": "#C77700", "Acceptée": "#1F6B42", "Refusée": "#C0172D", "Lu": "#123A7A" };
const Pastille = ({ statut }) => <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: COULEUR[statut] || "#5A6B84", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>{statut}</span>;
const dateFR = (iso) => { try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
const jourLong = (iso) => { try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return ""; } };
const jourCle = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const plusJours = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return jourCle(d); };
const nomDe = (p) => `${p.grade || ""} ${p.prenom || ""} ${p.nom || ""}`.trim();
const btn = (fond) => ({ background: fond, color: "#fff", border: 0, borderRadius: 6, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" });
const puce = (actif) => ({ border: "1px solid #C3D0E2", background: actif ? "#123A7A" : "#fff", color: actif ? "#fff" : "#123A7A", borderRadius: 20, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" });
const SERIF = "'Georgia', 'Times New Roman', serif";

/* ---------- Fiche de mandat (document officiel) ---------- */

export function statutMandat(m) {
  if (m.statut === "Actif" && m.valableJusqu && m.valableJusqu < jourCle(new Date())) return "Expiré";
  return m.statut;
}
const STAMP = { "Exécuté": ["#123A7A", "EXÉCUTÉ"], "Révoqué": ["#C0172D", "RÉVOQUÉ"], "Expiré": ["#5A6B84", "EXPIRÉ"] };
const TITRES = { "Mandat de perquisition": "MANDAT DE PERQUISITION", "Mandat d'arrêt": "MANDAT D'ARRÊT", "Mandat d'amener": "MANDAT D'AMENER", "Autre mandat": "MANDAT" };
const FORMULES = {
  "Mandat de perquisition": "Autorisons les officiers de police judiciaire à procéder, en tout lieu désigné ci-dessous, à une perquisition en vue de la recherche et de la saisie de tous éléments utiles à la manifestation de la vérité.",
  "Mandat d'arrêt": "Ordonnons aux officiers de police judiciaire de rechercher la personne désignée ci-dessous, de l'appréhender et de la conduire devant nous pour être placée sous main de justice.",
  "Mandat d'amener": "Ordonnons aux officiers de police judiciaire de conduire sans délai devant nous la personne désignée ci-dessous, afin qu'elle soit entendue.",
  "Autre mandat": "Ordonnons aux officiers de police judiciaire d'exécuter la mission décrite ci-dessous.",
};
const Ligne = ({ titre, children }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: "#6B5B2A", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{titre}</div>
    <div style={{ fontSize: 14.5, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{children}</div>
  </div>
);

export function FicheMandat({ m, actions }) {
  const st = statutMandat(m);
  const tampon = STAMP[st];
  return (
    <div style={{ position: "relative", background: "linear-gradient(180deg,#FFFEF8,#FBF6E6)", border: "1px solid #D8C98F", borderLeft: "6px solid #123A7A", borderRadius: 6, padding: "26px 30px", margin: "0 0 22px", boxShadow: "0 10px 26px -14px rgba(60,45,10,0.5)", fontFamily: SERIF, color: "#1D2433", overflow: "hidden" }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ display: "inline-block", height: 4, width: 90, background: "linear-gradient(90deg,#123A7A 33%,#fff 33% 66%,#C0172D 66%)", marginBottom: 8, border: "1px solid #D8C98F" }} />
        <div style={{ fontSize: 12, letterSpacing: 3, fontWeight: 700 }}>RÉPUBLIQUE FRANÇAISE</div>
        <div style={{ fontSize: 11, fontStyle: "italic", color: "#6B5B2A" }}>Liberté · Égalité · Fraternité</div>
        <div style={{ fontSize: 12.5, marginTop: 6, fontWeight: 700 }}>TRIBUNAL JUDICIAIRE DE NÎMES</div>
        <div style={{ fontSize: 11.5, color: "#6B5B2A" }}>Palais de justice · Cabinet du magistrat</div>
      </div>
      <div style={{ borderTop: "2px solid #1D2433", borderBottom: "1px solid #1D2433", padding: "10px 0", textAlign: "center", margin: "0 0 16px" }}>
        <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: 2 }}>{TITRES[m.type] || "MANDAT"}</div>
        <div style={{ fontSize: 12.5, marginTop: 3, fontFamily: "'Courier New', monospace" }}>N° {m.numero || m.id}</div>
      </div>
      <div style={{ fontSize: 14, fontStyle: "italic", marginBottom: 14, lineHeight: 1.55 }}>
        Nous, <b style={{ fontStyle: "normal" }}>{m.delivrePar}</b>, magistrat au Tribunal judiciaire de Nîmes, saisi par {m.demandeur || "un officier de police judiciaire"}, {FORMULES[m.type] || FORMULES["Autre mandat"]}
      </div>
      <Ligne titre={m.type === "Mandat de perquisition" ? "Lieu visé" : "Personne ou lieu visé"}>{m.cible || "—"}</Ligne>
      {m.objet && <Ligne titre="Objet">{m.objet}</Ligne>}
      {m.infractions && <Ligne titre="Infractions reprochées / fondement légal">{m.infractions}</Ligne>}
      <Ligne titre="Exposé des faits">{m.motif}</Ligne>
      <Ligne titre="Exécutoire">{`Du ${jourLong(m.delivreLe)}${m.valableJusqu ? ` au ${jourLong(`${m.valableJusqu}T12:00:00`)} inclus` : " — sans limitation de durée"}.`}</Ligne>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
        <div style={{ fontSize: 13 }}>Fait à Nîmes, le {jourLong(m.delivreLe)}.</div>
        <div style={{ textAlign: "center", minWidth: 190 }}>
          <div style={{ fontSize: 11, color: "#6B5B2A", marginBottom: 2 }}>Le magistrat</div>
          <div style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: 26, color: "#123A7A", transform: "rotate(-3deg)" }}>{m.delivrePar}</div>
          <div style={{ borderTop: "1px solid #1D2433", fontSize: 11, paddingTop: 3 }}>Signé électroniquement</div>
        </div>
      </div>
      {m.executePar && <div style={{ marginTop: 14, fontSize: 12.5, borderTop: "1px dashed #B8A560", paddingTop: 8 }}>Exécuté par <b>{m.executePar}</b> le {dateFR(m.executeLe)}.</div>}
      {tampon && (
        <div style={{ position: "absolute", top: "38%", right: "8%", transform: "rotate(-14deg)", border: `4px double ${tampon[0]}`, color: tampon[0], borderRadius: 8, padding: "6px 16px", fontSize: 26, fontWeight: 800, letterSpacing: 4, opacity: 0.72, fontFamily: "'Inter', sans-serif", pointerEvents: "none" }}>{tampon[1]}</div>
      )}
      {actions && <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", fontFamily: "'Inter', sans-serif" }}>{actions}</div>}
    </div>
  );
}

/* ---------- Demandes et rapports ---------- */

export function DemandesJusticePage({ current }) {
  const juge = estPalaisJustice(current) || !!current.isAdmin;
  const opj = (current.qualifications || []).includes("OPJ") || !!current.isAdmin;
  const [liste, setListe] = useState(null);
  const [onglet, setOnglet] = useState("attente");
  const vide = { type: TYPES_DEMANDE[0], cible: "", refPV: "", objet: "", infractions: "", motif: "", urgence: "Normale" };
  const [form, setForm] = useState(vide);
  const [etat, setEtat] = useState({ busy: false, msg: "", ok: false });
  const [champs, setChamps] = useState({}); // par demande : commentaire, validité, audience

  const charger = useCallback(async () => {
    try {
      const col = collection(db, "demandes_justice");
      // Un OPJ ne peut lire que ses propres demandes (règle Firestore) : la requête doit le préciser
      const q = juge ? query(col, orderBy("createdAt", "desc"), limit(100)) : query(col, where("auteurUid", "==", current.id), limit(100));
      const s = await getDocs(q);
      setListe(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
    } catch (e) { console.error(e); setListe([]); }
  }, [juge, current.id]);
  useEffect(() => { charger(); }, [charger]);

  const setC = (id, k, v) => setChamps((c) => ({ ...c, [id]: { ...(c[id] || {}), [k]: v } }));

  async function envoyer(e) {
    e.preventDefault();
    const f = { type: form.type, cible: form.cible.trim().slice(0, 200), refPV: form.refPV.trim().slice(0, 60), objet: form.objet.trim().slice(0, 200), infractions: form.infractions.trim().slice(0, 500), motif: form.motif.trim().slice(0, 4000), urgence: form.urgence };
    if (!f.objet || !f.motif) { setEtat({ busy: false, ok: false, msg: "Renseigne l'objet et l'exposé des faits." }); return; }
    if (f.type !== "Rapport" && !f.cible) { setEtat({ busy: false, ok: false, msg: "Indique la personne ou le lieu concerné." }); return; }
    setEtat({ busy: true, ok: false, msg: "Envoi…" });
    try {
      await addDoc(collection(db, "demandes_justice"), { ...f, statut: "En attente", auteurUid: current.id, auteurMatricule: current.matricule || "", auteurNom: nomDe(current), createdAt: new Date().toISOString() });
      setForm({ ...vide, type: form.type });
      setEtat({ busy: false, ok: true, msg: "Envoyé au Palais de justice." });
      await charger();
    } catch (err) { console.error(err); setEtat({ busy: false, ok: false, msg: "Échec de l'envoi (réservé aux OPJ)." }); }
  }

  async function decider(d, statut) {
    const c = champs[d.id] || {};
    const commentaire = String(c.commentaire || "").trim().slice(0, 2000);
    if (statut === "Refusée" && !commentaire) { alert("Indique le motif du refus dans le commentaire."); return; }
    try {
      const maintenant = new Date().toISOString();
      const patch = { statut, commentaire, decidePar: nomDe(current), decideLe: maintenant };
      if (statut === "Acceptée" && estMandat(d.type)) {
        const duree = VALIDITE_DEFAUT[d.type] || 7;
        const r = await addDoc(collection(db, "mandats"), {
          numero: refAleatoire("MAN"), type: d.type, cible: d.cible || "", motif: d.motif || "", objet: d.objet || "", infractions: d.infractions || "", demandeId: d.id, demandeur: d.auteurNom || "",
          delivrePar: nomDe(current), delivreLe: maintenant, valableJusqu: c.validite || plusJours(maintenant, duree), statut: "Actif",
        });
        patch.mandatId = r.id;
      }
      if (statut === "Acceptée" && (d.type === "Procès" || d.type === "Comparution immédiate") && c.audience) patch.audience = c.audience;
      await updateDoc(doc(db, "demandes_justice", d.id), patch);
      await charger();
    } catch (e) { console.error(e); alert("Impossible d'enregistrer la décision."); }
  }

  const attente = (liste || []).filter((d) => d.statut === "En attente");
  const traitees = (liste || []).filter((d) => d.statut !== "En attente");
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
            <label style={labelStyle}>{LIBELLE_CIBLE[form.type] || "Personne ou lieu concerné"}</label>
            <input value={form.cible} onChange={(e) => setForm({ ...form, cible: e.target.value })} style={INP} />
            <label style={labelStyle}>Infractions reprochées / fondement légal</label>
            <input value={form.infractions} onChange={(e) => setForm({ ...form, infractions: e.target.value })} placeholder="Ex. : trafic de stupéfiants, détention d'arme (articles du code pénal)" style={INP} />
            <label style={labelStyle}>Urgence</label>
            <select value={form.urgence} onChange={(e) => setForm({ ...form, urgence: e.target.value })} style={{ ...selectStyle, marginBottom: 14 }}>
              <option>Normale</option><option>Urgente</option><option>Flagrance</option>
            </select>
          </>)}
          <label style={labelStyle}>Objet</label>
          <input value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} placeholder="Résumé en une ligne" style={INP} />
          <label style={labelStyle}>Numéro de PV (facultatif)</label>
          <input value={form.refPV} onChange={(e) => setForm({ ...form, refPV: e.target.value })} placeholder="PV-2026-XXXXX" style={INP} />
          <label style={labelStyle}>{form.type === "Rapport" ? "Rapport" : "Exposé des faits et justification (indices, éléments de l'enquête)"}</label>
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
        {affichees.map((d) => {
          const c = champs[d.id] || {};
          return (
            <div key={d.id} style={{ borderTop: "1px solid #E3EAF4", padding: "14px 0" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ fontSize: 14 }}>{d.type}</b> <Pastille statut={d.statut} />
                {d.urgence && d.urgence !== "Normale" && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#C0172D" }}>⚠ {d.urgence}</span>}
                <span style={{ fontSize: 12, color: "#5A6B84" }}>{dateFR(d.createdAt)} · par {d.auteurNom}</span>
              </div>
              <div style={{ fontWeight: 600, margin: "6px 0 2px", fontSize: 13.5 }}>{d.objet}</div>
              {d.cible && <div style={{ fontSize: 13 }}>Concerné : <b>{d.cible}</b></div>}
              {d.infractions && <div style={{ fontSize: 13 }}>Infractions : {d.infractions}</div>}
              {d.refPV && <div style={{ fontSize: 13 }}>PV : {d.refPV}</div>}
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "6px 0", color: "#243549" }}>{d.motif}</div>
              {d.statut !== "En attente" && (
                <div style={{ fontSize: 12.5, background: "#F2F6FC", borderRadius: 8, padding: "8px 10px", marginTop: 6 }}>
                  {d.decidePar ? `Traité par ${d.decidePar} le ${dateFR(d.decideLe)}` : ""}
                  {d.audience && <div style={{ marginTop: 4, fontWeight: 700 }}>⚖️ Audience : {dateFR(d.audience)}</div>}
                  {d.commentaire && <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>💬 {d.commentaire}</div>}
                  {d.mandatId && <div style={{ marginTop: 4, fontWeight: 600 }}>📜 Mandat délivré (voir la page « Mandats »)</div>}
                </div>
              )}
              {juge && d.statut === "En attente" && (
                <div style={{ marginTop: 8 }}>
                  <textarea value={c.commentaire || ""} onChange={(e) => setC(d.id, "commentaire", e.target.value)} rows={2} placeholder="Commentaire / motivation (obligatoire en cas de refus)" style={{ ...INP, marginBottom: 8, resize: "vertical" }} />
                  {estMandat(d.type) && (
                    <div style={{ marginBottom: 8, fontSize: 12.5 }}>Valable jusqu'au (par défaut {VALIDITE_DEFAUT[d.type] || 7} jours) : <input type="date" value={c.validite || ""} onChange={(e) => setC(d.id, "validite", e.target.value)} style={{ padding: "5px 8px", border: "1px solid #C3D0E2", borderRadius: 6 }} /></div>
                  )}
                  {(d.type === "Procès" || d.type === "Comparution immédiate") && (
                    <div style={{ marginBottom: 8, fontSize: 12.5 }}>Date et heure de l'audience : <input type="datetime-local" value={c.audience || ""} onChange={(e) => setC(d.id, "audience", e.target.value)} style={{ padding: "5px 8px", border: "1px solid #C3D0E2", borderRadius: 6 }} /></div>
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
          );
        })}
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

  const charger = useCallback(async () => {
    try {
      const s = await getDocs(query(collection(db, "mandats"), orderBy("delivreLe", "desc"), limit(150)));
      setListe(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); setListe([]); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function changer(m, patch) {
    try { await updateDoc(doc(db, "mandats", m.id), patch); await charger(); } catch (e) { console.error(e); alert("Action impossible."); }
  }

  const q = recherche.trim().toLowerCase();
  const affiches = (liste || []).filter((m) => (filtre === "tous" || statutMandat(m) === "Actif") && (!q || `${m.cible} ${m.type} ${m.objet} ${m.motif} ${m.numero}`.toLowerCase().includes(q)));

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={h2Style}>Mandats</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button onClick={() => setFiltre("actifs")} style={puce(filtre === "actifs")}>Mandats actifs</button>
        <button onClick={() => setFiltre("tous")} style={puce(filtre === "tous")}>Tous</button>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔎 Personne, lieu, numéro…" style={{ ...INP, marginBottom: 0, flex: 1, minWidth: 180 }} />
      </div>
      {liste === null && <div style={{ fontSize: 13, color: "#5A6B84" }}>Chargement…</div>}
      {liste !== null && affiches.length === 0 && <div style={{ fontSize: 13, color: "#5A6B84" }}>Aucun mandat.</div>}
      {affiches.map((m) => (
        <FicheMandat key={m.id} m={m} actions={m.statut === "Actif" && (
          <>
            {opj && <button onClick={() => changer(m, { statut: "Exécuté", executeLe: new Date().toISOString(), executePar: nomDe(current) })} style={btn("#123A7A")}>✓ Marquer comme exécuté</button>}
            {juge && <button onClick={() => window.confirm("Révoquer ce mandat ?") && changer(m, { statut: "Révoqué" })} style={btn("#C0172D")}>Révoquer</button>}
          </>
        )} />
      ))}
    </div>
  );
}
