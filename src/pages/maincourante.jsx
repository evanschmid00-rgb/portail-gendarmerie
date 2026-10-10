// pages/maincourante.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useCallback, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { Field, Select, buttonPrimary, h2Style, labelStyle, selectStyle, smallBtn } from "../composants/ui.jsx";
import { FONT_TITRE } from "../lib/constantes.js";
import { cleJour } from "../lib/utils.js";

/* ---------- Main courante numérique ---------- */

const TYPE_DEBUT = "Début de patrouille";
const TYPE_CHANGEMENT = "Changement de patrouille";
const TYPE_FIN = "Fin de patrouille";
const TYPE_PATROUILLE = TYPE_DEBUT; // ancien nom, conservé pour les filtres
const TYPES_PATROUILLE = [TYPE_DEBUT, TYPE_CHANGEMENT, TYPE_FIN];
const ANCIENS_TYPES_DEBUT = ["Prise de patrouille", "Patrouille"]; // anciennes entrées, toujours lisibles
const estDebut = (t) => t === TYPE_DEBUT || ANCIENS_TYPES_DEBUT.includes(t);
const estTypePatrouille = (t) => TYPES_PATROUILLE.includes(t) || ANCIENS_TYPES_DEBUT.includes(t);
const DESCRIPTIONS_AUTO = ["Prise de patrouille.", "Début de patrouille.", "Changement de patrouille.", "Fin de patrouille."];
const TYPES_MC = [TYPE_DEBUT, TYPE_CHANGEMENT, TYPE_FIN, "Intervention", "Contrôle routier", "Incident", "Information", "Relève / consigne", "Autre"];
// Liste par défaut du matériel : les admins peuvent la modifier (enregistrée dans settings/general)
export const MATERIEL_PATROUILLE = [
  "HK G36 en calibre 5,56 x 45 mm OTAN", "Plots", "Ruban", "Herse Stop Stick", "PIE", "Pistolet-Radar", "Grenades assourdissantes",
];
const PATROUILLE_VIDE = { nbAgents: "", vehicule: "", plaque: "", materiel: [], membres: [], patrouilleId: "" };
const TYPES_MC_EDIT = [...TYPES_MC, "Activité"];
const COULEURS_MC = { Activité: "#6B7A90", [TYPE_DEBUT]: "#123A7A", [TYPE_CHANGEMENT]: "#7B3FA0", [TYPE_FIN]: "#0E7C86", "Prise de patrouille": "#123A7A", Patrouille: "#123A7A", Intervention: "#C0172D", "Contrôle routier": "#2F6FDE", Incident: "#B25E00", Information: "#5A6B84", "Relève / consigne": "#2E7D4F", Autre: "#3A4D6B" };

const nomsMembres = (membres) => (membres || []).map((m) => m.nom).join(", ");
const libellePatrouille = (p) => `${p.vehicule || "Patrouille"}${p.plaque ? ` (${p.plaque})` : ""} — ${nomsMembres(p.membres) || "sans agent"} · depuis ${p.debut}`;
const patchDepuis = (p) => ({ patrouilleId: p.id, membres: p.membres, vehicule: p.vehicule, plaque: p.plaque, materiel: p.materiel });

// Patrouilles en cours : on rejoue les entrées dans l'ordre ; un « Fin de patrouille » ferme la patrouille, un « Changement » met à jour sa composition
function calculerPatrouillesActives(entrees) {
  const parId = {};
  entrees
    .filter((en) => !en.auto && en.patrouilleId && estTypePatrouille(en.type))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .forEach((en) => {
      const pid = en.patrouilleId;
      if (en.type === TYPE_FIN) { delete parId[pid]; return; }
      const avant = parId[pid];
      parId[pid] = {
        id: pid, debut: avant ? avant.debut : heureDe(en), derniere: heureDe(en),
        vehicule: en.vehicule || (avant ? avant.vehicule : ""), plaque: en.plaque || (avant ? avant.plaque : ""),
        materiel: en.materiel || [], membres: en.membres || [],
        changements: (avant ? avant.changements : 0) + (en.type === TYPE_CHANGEMENT ? 1 : 0),
      };
    });
  return Object.values(parId).sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
}

function SelecteurAgents({ v, onChange, agents, actives }) {
  const ailleurs = {};
  actives.forEach((p) => { if (p.id !== v.patrouilleId) p.membres.forEach((m) => { ailleurs[m.id] = true; }); });
  const connus = new Set(agents.map((a) => a.id));
  const options = [...agents, ...v.membres.filter((m) => !connus.has(m.id)).map((m) => ({ id: m.id, nom: m.nom, grade: "", horsService: true }))];
  const choisi = (id) => v.membres.some((m) => m.id === id);
  const bascule = (a) => onChange({ ...v, membres: choisi(a.id) ? v.membres.filter((m) => m.id !== a.id) : [...v.membres, { id: a.id, nom: a.nom }] });
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>Agents en service dans la patrouille ({v.membres.length} sélectionné{v.membres.length > 1 ? "s" : ""})</label>
      {options.length === 0 && <div style={{ fontSize: 12.5, color: "#5A6B84" }}>Aucun agent en service pour le moment.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 7 }}>
        {options.map((a) => {
          const pris = ailleurs[a.id] && !choisi(a.id);
          return (
            <label key={a.id} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: pris ? "not-allowed" : "pointer", opacity: pris ? 0.5 : 1 }}>
              <input type="checkbox" checked={choisi(a.id)} disabled={pris} onChange={() => bascule(a)} />
              <span>{a.grade ? `${a.grade} ` : ""}{a.nom}{pris ? " (déjà en patrouille)" : ""}{a.horsService ? " (hors service)" : ""}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PatrouilleChamps({ v, onChange, type, ctx, edition }) {
  const fin = type === TYPE_FIN;
  const choix = !edition && (type === TYPE_FIN || type === TYPE_CHANGEMENT);
  const liste = [...ctx.materiel, ...(v.materiel || []).filter((m) => !ctx.materiel.includes(m))];
  const bascule = (m) => onChange({ ...v, materiel: v.materiel.includes(m) ? v.materiel.filter((x) => x !== m) : [...v.materiel, m] });
  const titre = fin ? "Patrouille à terminer" : type === TYPE_CHANGEMENT ? "Changement de patrouille" : "Détails de la patrouille";
  return (
    <div style={{ background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 14, margin: "4px 0 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 10 }}>{titre}</div>
      {choix && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Patrouille concernée</label>
          {ctx.actives.length === 0 ? (
            <div style={{ fontSize: 13, color: "#B25E00" }}>Aucune patrouille active pour le moment : commence par un « {TYPE_DEBUT} ».</div>
          ) : (
            <select value={v.patrouilleId} onChange={(e) => { const p = ctx.actives.find((x) => x.id === e.target.value); onChange(p ? { ...v, ...patchDepuis(p) } : { ...v, ...PATROUILLE_VIDE }); }} style={selectStyle}>
              <option value="">— Choisir —</option>
              {ctx.actives.map((p) => <option key={p.id} value={p.id}>{libellePatrouille(p)}</option>)}
            </select>
          )}
        </div>
      )}
      {fin ? (
        v.patrouilleId && <div style={{ fontSize: 13 }}><b>{(v.membres || []).length}</b> agent(s) : {nomsMembres(v.membres) || "—"}{v.vehicule ? ` · 🚓 ${v.vehicule} ${v.plaque || ""}` : ""}</div>
      ) : (!choix || v.patrouilleId) && (
        <>
          <SelecteurAgents v={v} onChange={onChange} agents={ctx.agents} actives={ctx.actives} />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr", gap: 12 }}>
            <Field label="Véhicule" value={v.vehicule} onChange={(x) => onChange({ ...v, vehicule: x })} />
            <Field label="Plaque d'immatriculation" value={v.plaque} onChange={(x) => onChange({ ...v, plaque: x.toUpperCase() })} />
          </div>
          <label style={labelStyle}>Matériel emporté</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 7 }}>
            {liste.map((m) => (
              <label key={m} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={(v.materiel || []).includes(m)} onChange={() => bascule(m)} /> {m}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Vérifie et nettoie les champs de patrouille ; renvoie { erreur } ou { champs }
function champsPatrouille(v, type) {
  const membres = v.membres || [];
  const base = {
    patrouilleId: v.patrouilleId || "", membres,
    nbAgents: membres.length || parseInt(v.nbAgents, 10) || null,
    vehicule: (v.vehicule || "").trim(), plaque: (v.plaque || "").trim().toUpperCase(), materiel: v.materiel || [],
  };
  if (type === TYPE_FIN) {
    if (!base.patrouilleId) return { erreur: "Choisis la patrouille à terminer." };
    return { champs: base };
  }
  if (type === TYPE_CHANGEMENT && !base.patrouilleId) return { erreur: "Choisis la patrouille concernée par le changement." };
  if (!membres.length && !(v.nbAgents && !base.patrouilleId)) return { erreur: "Sélectionne au moins un agent dans la patrouille." };
  if (!base.vehicule) return { erreur: "Indique le véhicule utilisé." };
  if (!base.plaque) return { erreur: "Indique la plaque du véhicule." };
  return { champs: base };
}

// Panneau admin : modifier la liste du matériel à cocher
function GestionMateriel({ liste, onSave }) {
  const [items, setItems] = useState(liste);
  const [nouveau, setNouveau] = useState("");
  const [etat, setEtat] = useState("");
  useEffect(() => { setItems(liste); }, [liste]);
  const inp = { padding: "8px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, background: "#fff", boxSizing: "border-box", flex: 1, minWidth: 0 };
  function ajouterItem() {
    const t = nouveau.trim();
    if (!t || items.includes(t)) return;
    setItems([...items, t]); setNouveau("");
  }
  async function enregistrer() {
    const propre = items.map((s) => s.trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
    if (propre.length === 0) { setEtat("Garde au moins un élément."); return; }
    setEtat("Enregistrement…");
    const ok = await onSave(propre);
    setEtat(ok ? "Liste enregistrée." : "Échec de l'enregistrement.");
  }
  return (
    <details style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 16px", marginBottom: 18 }}>
      <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#123A7A" }}>⚙ Gérer le matériel de patrouille (admin)</summary>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input value={m} onChange={(e) => setItems(items.map((x, k) => (k === i ? e.target.value : x)))} style={inp} />
            <button type="button" style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => setItems(items.filter((_, k) => k !== i))}>Retirer</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={nouveau} onChange={(e) => setNouveau(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterItem(); } }} placeholder="Nouveau matériel…" style={inp} />
          <button type="button" style={smallBtn} onClick={ajouterItem}>+ Ajouter</button>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={enregistrer} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 0 }}>Enregistrer la liste</button>
          {etat && <span style={{ fontSize: 12.5, color: etat.startsWith("Liste") ? "#1F6B42" : "#5A6B84", fontWeight: 600 }}>{etat}</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "#5A6B84" }}>Retirer un élément ne modifie pas les anciennes entrées de la main courante.</div>
      </div>
    </details>
  );
}

const PRIORITES_MC = ["Routine", "Important", "Urgent"];
const COULEURS_PRIO = { Routine: "#5A6B84", Important: "#B25E00", Urgent: "#C0172D" };
const SUITES_MC = ["Aucune", "Rapport / PV rédigé", "Interpellation", "Transmis à l'OPJ", "Évacuation / secours", "Renfort demandé", "Autre"];

const heureMaintenant = () => new Date().toTimeString().slice(0, 5);
const valeursEntreeVides = () => ({ type: TYPES_MC[0], heure: heureMaintenant(), priorite: "Routine", lieu: "", description: "", agents: "", personnes: "", vehiculeTiers: "", suite: "Aucune", ...PATROUILLE_VIDE });
const heureDe = (en) => en.heure || new Date(en.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

// Vérifie le formulaire et prépare les champs à enregistrer
function validerEntree(v) {
  if (!/^\d{2}:\d{2}$/.test(v.heure || "")) return { erreur: "Indique l'heure de l'événement." };
  const patrouille = estTypePatrouille(v.type);
  if (!patrouille && v.description.trim().length < 3) return { erreur: "Décris l'événement (quelques mots suffisent)." };
  let extra = { patrouilleId: "", membres: [], nbAgents: null, vehicule: "", plaque: "", materiel: [] };
  if (patrouille) {
    const r = champsPatrouille(v, v.type);
    if (r.erreur) return { erreur: r.erreur };
    extra = r.champs;
  }
  return {
    champs: {
      type: v.type, heure: v.heure, priorite: v.priorite, lieu: v.lieu.trim(),
      description: v.description.trim() || (patrouille ? `${v.type}.` : ""), agents: v.agents.trim(),
      personnes: patrouille ? "" : v.personnes.trim(), vehiculeTiers: patrouille ? "" : v.vehiculeTiers.trim(), suite: patrouille ? "Aucune" : v.suite,
      ...extra,
    },
  };
}

// Champs de saisie (utilisés pour ajouter ET pour modifier une entrée)
function FormulaireEntree({ v, onChange, edition, ctx = { agents: [], actives: [], materiel: MATERIEL_PATROUILLE, moi: null } }) {
  const patrouille = estTypePatrouille(v.type);
  const set = (patch) => onChange({ ...v, ...patch });
  const changerType = (t) => {
    const patch = { type: t, ...PATROUILLE_VIDE };
    if (t === TYPE_DEBUT && ctx.moi) patch.membres = [ctx.moi];
    if (t === TYPE_FIN || t === TYPE_CHANGEMENT) {
      const mienne = ctx.moi && ctx.actives.find((p) => p.membres.some((m) => m.id === ctx.moi.id));
      if (mienne) Object.assign(patch, patchDepuis(mienne));
    }
    set(patch);
  };
  const inp = { padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 14, background: "#fff", boxSizing: "border-box", width: "100%" };
  return (
    <div>
      {edition ? (
        <Select label="Type" value={v.type} onChange={(t) => set({ type: t })} options={TYPES_MC_EDIT} />
      ) : (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Type d'événement</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TYPES_MC.map((t) => {
              const actif = v.type === t;
              const c = COULEURS_MC[t] || "#3A4D6B";
              return (
                <button key={t} type="button" onClick={() => changerType(t)} style={{ border: `1.5px solid ${c}`, background: actif ? c : "#fff", color: actif ? "#fff" : c, borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{t}</button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "130px 150px 1fr", gap: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Heure</label>
          <input type="time" value={v.heure} onChange={(e) => set({ heure: e.target.value })} style={inp} />
        </div>
        <Select label="Priorité" value={v.priorite} onChange={(x) => set({ priorite: x })} options={PRIORITES_MC} />
        <Field label="Lieu (facultatif)" value={v.lieu} onChange={(x) => set({ lieu: x })} placeholder="Ex : Rue principale, secteur nord…" />
      </div>

      {patrouille && <PatrouilleChamps v={v} onChange={(x) => set(x)} type={v.type} ctx={ctx} edition={edition} />}
      <Field label={patrouille ? "Observations (facultatif)" : "Que s'est-il passé ?"} textarea value={v.description} onChange={(x) => set({ description: x })} placeholder={patrouille ? "" : "Décris les faits : qui, quoi, où, comment…"} />

      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#123A7A", marginBottom: 10 }}>Détails complémentaires (facultatif)</summary>
        <Field label="Agents intervenants" value={v.agents} onChange={(x) => set({ agents: x })} placeholder="Noms des agents présents" />
        {!patrouille && (
          <>
            <Field label="Personnes impliquées" value={v.personnes} onChange={(x) => set({ personnes: x })} placeholder="Identité ou description" />
            <Field label="Véhicule concerné" value={v.vehiculeTiers} onChange={(x) => set({ vehiculeTiers: x })} placeholder="Modèle et plaque" />
            <Select label="Suite donnée" value={v.suite} onChange={(x) => set({ suite: x })} options={SUITES_MC} />
          </>
        )}
      </details>
    </div>
  );
}

export function MainCourantePage({ current, enService, nbEnService = 0, agentsEnService = [], materiel = MATERIEL_PATROUILLE, onSaveMateriel, canEdit, canDelete, onGoService, onLog }) {
  const today = cleJour(new Date());
  const [jour, setJour] = useState(today);
  const [entries, setEntries] = useState([]);
  const [entriesPatrouille, setEntriesPatrouille] = useState([]); // aujourd'hui + hier, pour les patrouilles en cours
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("Tous");
  const [masquerAuto, setMasquerAuto] = useState(false);
  const [form, setForm] = useState(valeursEntreeVides);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const charger = useCallback(async () => {
    try {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const hier = cleJour(d);
      const lire = async (jours) => {
        const q = jours.length === 1 ? where("jour", "==", jours[0]) : where("jour", "in", jours);
        const snap = await getDocs(query(collection(db, "main_courante"), q));
        return snap.docs.map((x) => ({ id: x.id, ...x.data() }));
      };
      if (jour === today) {
        const tout = await lire([hier, today]);
        setEntries(tout.filter((en) => en.jour === today));
        setEntriesPatrouille(tout);
      } else {
        const [duJour, tout] = await Promise.all([lire([jour]), lire([hier, today])]);
        setEntries(duJour);
        setEntriesPatrouille(tout);
      }
    } catch (e) { console.error(e); setMsg("Impossible de charger la main courante."); }
    setLoading(false);
  }, [jour, today]);

  // Rafraîchissement automatique modéré (économise les lectures Firebase) ; bouton « Actualiser » pour le reste
  useEffect(() => {
    setLoading(true);
    charger();
    if (jour !== today) return undefined;
    const t = setInterval(() => { if (document.visibilityState === "visible") charger(); }, 90000);
    return () => clearInterval(t);
  }, [charger, jour, today]);

  async function ajouter(e) {
    e.preventDefault();
    const r = validerEntree(form);
    if (r.erreur) { setMsg(r.erreur); return; }
    setBusy(true);
    setMsg("");
    try {
      const maintenant = new Date();
      const ref = `MC-${cleJour(maintenant).replace(/-/g, "").slice(2)}-${maintenant.toTimeString().slice(0, 8).replace(/:/g, "")}`;
      await addDoc(collection(db, "main_courante"), {
        ...r.champs, ...(form.type === TYPE_DEBUT ? { patrouilleId: ref } : {}), ref, createdAt: maintenant.toISOString(), jour: cleJour(maintenant),
        auteurUid: current.id, auteurNom: `${current.prenom} ${current.nom}`, auteurGrade: current.grade, auteurRIO: current.cipcNumero || "",
      });
      setForm({ ...valeursEntreeVides(), type: form.type });
      setMsg(`Entrée ${ref} enregistrée.`);
      if (jour !== today) setJour(today); else await charger();
    } catch (e2) { console.error(e2); setMsg("Impossible d'ajouter l'entrée : vérifie que ton service est bien pris, puis réessaie dans quelques secondes."); }
    setBusy(false);
  }
  function commencerEdition(en) {
    setEditId(en.id);
    setEditForm({
      type: estDebut(en.type) ? TYPE_DEBUT : (en.type || TYPES_MC[0]), heure: en.heure || heureDe(en), priorite: en.priorite || "Routine", lieu: en.lieu || "", description: en.description || "",
      agents: en.agents || "", personnes: en.personnes || "", vehiculeTiers: en.vehiculeTiers || "", suite: en.suite || "Aucune",
      nbAgents: en.nbAgents ? String(en.nbAgents) : "", vehicule: en.vehicule || "", plaque: en.plaque || "", materiel: en.materiel || [], membres: en.membres || [], patrouilleId: en.patrouilleId || "",
    });
  }
  async function enregistrerEdition() {
    const r = validerEntree(editForm);
    if (r.erreur) { setMsg(r.erreur); return; }
    setBusy(true);
    try {
      await updateDoc(doc(db, "main_courante", editId), { ...r.champs, modifie: true, modifiePar: `${current.prenom} ${current.nom}`, modifieLe: new Date().toISOString() });
      onLog("Main courante", "Entrée modifiée");
      setEditId(null); setEditForm(null); setMsg("Entrée modifiée.");
      await charger();
    } catch (e) { console.error(e); setMsg("Modification refusée (réservée aux OPJ)."); }
    setBusy(false);
  }
  async function supprimer(en) {
    if (!window.confirm("Supprimer définitivement cette entrée de la main courante ?")) return;
    try {
      await deleteDoc(doc(db, "main_courante", en.id));
      onLog("Main courante", "Entrée supprimée");
      await charger();
    } catch (e) { console.error(e); setMsg("Suppression refusée."); }
  }

  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const manuelles = entries.filter((en) => !en.auto);
  const compte = (t) => manuelles.filter((en) => en.type === t || (t === TYPE_DEBUT && ANCIENS_TYPES_DEBUT.includes(en.type))).length;
  const affiches = entries
    .filter((en) => !(masquerAuto && en.auto))
    .filter((en) => filtre === "Tous" || en.type === filtre || (filtre === TYPE_DEBUT && ANCIENS_TYPES_DEBUT.includes(en.type)))
    .filter((en) => norm(`${en.type} ${en.lieu} ${en.description} ${en.agents} ${en.personnes} ${en.vehiculeTiers} ${en.auteurNom} ${en.vehicule || ""} ${en.plaque || ""} ${nomsMembres(en.membres)} ${en.ref || ""}`).includes(norm(recherche)))
    .sort((a, b) => heureDe(b).localeCompare(heureDe(a)) || String(b.createdAt).localeCompare(String(a.createdAt))); // les plus récents en haut
  const decaler = (n) => { const d = new Date(`${jour}T12:00:00`); d.setDate(d.getDate() + n); const k = cleJour(d); if (k <= today) setJour(k); };
  const dateLongue = new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const inp = { padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 14, background: "#fff", boxSizing: "border-box" };
  const card = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 20, marginBottom: 22, boxShadow: "0 6px 20px -12px rgba(7,20,46,0.3)" };

  function imprimerJournee() {
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const lignes = affiches.slice().reverse().map((en) => { // la version imprimée reste dans l'ordre chronologique
      const details = [
        estTypePatrouille(en.type) && (en.vehicule || (en.membres || []).length) ? `${en.nbAgents || (en.membres || []).length} agent(s)${(en.membres || []).length ? " (" + nomsMembres(en.membres) + ")" : ""}${en.vehicule ? " — " + en.vehicule + " (" + en.plaque + ")" : ""}${en.type !== TYPE_FIN && (en.materiel || []).length ? " — Matériel : " + en.materiel.join(", ") : ""}` : "",
        en.agents ? `Agents : ${en.agents}` : "", en.personnes ? `Personnes : ${en.personnes}` : "", en.vehiculeTiers ? `Véhicule : ${en.vehiculeTiers}` : "",
        en.suite && en.suite !== "Aucune" ? `Suite : ${en.suite}` : "",
      ].filter(Boolean).join(" | ");
      return `<tr><td>${esc(heureDe(en))}</td><td>${esc(en.type)}${en.priorite && en.priorite !== "Routine" ? `<br><b>${esc(en.priorite)}</b>` : ""}</td><td>${esc(en.lieu)}</td><td>${esc(DESCRIPTIONS_AUTO.includes(en.description) ? "" : en.description)}${details ? `<div class="d">${esc(details)}</div>` : ""}</td><td>${esc(`${en.auteurGrade || ""} ${en.auteurNom || ""}`)}${en.auteurRIO ? `<br>RIO ${esc(en.auteurRIO)}` : ""}</td></tr>`;
    }).join("");
    const w = window.open("", "_blank");
    if (!w) { setMsg("Autorise les fenêtres pop-up pour imprimer la journée."); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Main courante — ${esc(dateLongue)}</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}h1{font-size:18px;margin:0 0 2px}.s{color:#555;margin-bottom:14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top}th{background:#e6edf7}.d{color:#444;font-size:11px;margin-top:4px}.f{margin-top:16px;font-size:10px;color:#777}</style></head><body><h1>Main courante — Gendarmerie Nationale de Black RP</h1><div class="s">${esc(dateLongue)} · ${affiches.length} événement(s)</div><table><thead><tr><th style="width:50px">Heure</th><th style="width:110px">Type</th><th style="width:110px">Lieu</th><th>Faits</th><th style="width:140px">Rédigé par</th></tr></thead><tbody>${lignes || '<tr><td colspan="5">Aucun événement.</td></tr>'}</tbody></table><div class="f">Document de jeu de rôle (Roblox) — sans valeur officielle, sans lien avec la Gendarmerie nationale réelle.</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const actives = calculerPatrouillesActives(entriesPatrouille);
  const idsEnService = new Set(agentsEnService.map((a) => a.id));
  const nbAgentsPatrouille = actives.reduce((n, p) => n + p.membres.length, 0);
  const ctx = { agents: agentsEnService, actives, materiel, moi: { id: current.id, nom: `${current.prenom} ${current.nom}` } };

  const Info = ({ label, children }) => (children ? <div style={{ fontSize: 12.5, marginTop: 3 }}><span style={{ color: "#5A6B84", fontWeight: 600 }}>{label} : </span>{children}</div> : null);

  return (
    <div style={{ maxWidth: 940 }}>
      <h2 style={h2Style}>Main courante</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Entrées du jour", v: manuelles.length, c: "#123A7A" },
          { l: "Interventions", v: compte("Intervention"), c: "#C0172D" },
          { l: "Incidents", v: compte("Incident"), c: "#B25E00" },
          { l: "Agents en service", v: nbEnService, c: "#2E7D4F" },
          { l: "Patrouilles actives", v: actives.length, c: "#7B3FA0" },
        ].map((x) => (
          <div key={x.l} style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${x.c}`, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: x.c, lineHeight: 1.1 }}>{x.v}</div>
            <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{x.l}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: "14px 16px", marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#14213A", marginBottom: 10 }}>🚓 Patrouilles actives ({actives.length}) · {nbAgentsPatrouille} agent{nbAgentsPatrouille > 1 ? "s" : ""} sur le terrain</div>
        {actives.length === 0 ? (
          <div style={{ fontSize: 13, color: "#5A6B84" }}>Aucune patrouille en cours.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {actives.map((p) => (
              <div key={p.id} style={{ border: "1px solid #D3DDEA", borderLeft: "5px solid #7B3FA0", borderRadius: 10, padding: "10px 12px", background: "#FBFCFE" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.vehicule || "Patrouille"} {p.plaque && <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12.5 }}>{p.plaque}</span>}</div>
                <div style={{ fontSize: 12, color: "#5A6B84", margin: "2px 0 8px" }}>Depuis {p.debut} · {p.membres.length} agent{p.membres.length > 1 ? "s" : ""}{p.changements > 0 ? ` · ${p.changements} changement${p.changements > 1 ? "s" : ""}` : ""}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {p.membres.map((m) => <span key={m.id} style={{ background: idsEnService.has(m.id) ? "#E6EDF7" : "#F3E3E3", color: idsEnService.has(m.id) ? "#123A7A" : "#8A2A2A", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 12 }} title={idsEnService.has(m.id) ? "" : "N'est plus en service"}>{m.nom}</span>)}
                </div>
                {p.materiel.length > 0 && <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 7 }}>Matériel : {p.materiel.join(", ")}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {current.isAdmin && onSaveMateriel && <GestionMateriel liste={materiel} onSave={onSaveMateriel} />}

      {enService ? (
        <form onSubmit={ajouter} style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "#14213A" }}>Nouvelle entrée</div>
          <FormulaireEntree v={form} onChange={setForm} ctx={ctx} />
          <button type="submit" disabled={busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "10px 24px", marginTop: 0 }}>{busy ? "Enregistrement…" : "Enregistrer dans la main courante"}</button>
        </form>
      ) : (
        <div style={{ ...card, background: "#FFF4D6", borderColor: "#E8D28A", color: "#6B4E00", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Tu n'es pas en service : tu peux consulter la main courante, mais pas y ajouter d'entrée.</div>
          <button onClick={onGoService} style={smallBtn}>Prendre mon service</button>
        </div>
      )}
      {msg && <div style={{ fontSize: 12.5, color: msg.startsWith("Entrée") || msg.startsWith("Entrée modifiée") ? "#1F6B42" : "#C0172D", marginBottom: 14, fontWeight: 600 }}>{msg}</div>}

      <div style={{ ...card, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button style={smallBtn} onClick={() => decaler(-1)}>←</button>
          <input type="date" value={jour} max={today} onChange={(e) => e.target.value && setJour(e.target.value)} style={inp} />
          <button style={smallBtn} onClick={() => decaler(1)} disabled={jour >= today}>→</button>
          {jour !== today && <button style={smallBtn} onClick={() => setJour(today)}>Aujourd'hui</button>}
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (lieu, plaque, nom, référence…)" style={{ ...inp, flex: 1, minWidth: 200 }} />
          <button style={smallBtn} onClick={charger}>↻ Actualiser</button>
          <button style={smallBtn} onClick={imprimerJournee}>🖨 Imprimer la journée</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          {["Tous", ...TYPES_MC].map((t) => {
            const n = t === "Tous" ? entries.length : compte(t);
            const actif = filtre === t;
            return <button key={t} onClick={() => setFiltre(t)} style={{ border: "1px solid #C3D0E2", background: actif ? "#123A7A" : "#fff", color: actif ? "#fff" : "#14213A", borderRadius: 16, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t} <span style={{ opacity: 0.7 }}>({n})</span></button>;
          })}
          <label style={{ fontSize: 12, color: "#5A6B84", display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <input type="checkbox" checked={masquerAuto} onChange={(e) => setMasquerAuto(e.target.checked)} /> Masquer les lignes automatiques
          </label>
        </div>
      </div>

      <div style={{ fontFamily: FONT_TITRE, fontSize: 20, fontWeight: 700, textTransform: "capitalize", margin: "18px 0 12px", color: "#14213A" }}>{loading ? "Chargement…" : `${dateLongue} — ${affiches.length} événement${affiches.length > 1 ? "s" : ""}`}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affiches.map((en) => {
          const couleur = COULEURS_MC[en.type] || "#3A4D6B";
          const heure = heureDe(en);
          const modifiable = canEdit || canDelete;

          if (en.auto && editId !== en.id) {
            return (
              <div key={en.id} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 12, alignItems: "center" }}>
                <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 13, color: "#6B7A90", textAlign: "right" }}>{heure}</div>
                <div style={{ background: "#F2F5FA", border: "1px dashed #C3D0E2", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, color: "#3A4D6B", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span>🤖 {en.description} <span style={{ color: "#6B7A90" }}>— {en.auteurGrade} {en.auteurNom}</span></span>
                  {modifiable && (
                    <span style={{ display: "flex", gap: 6 }}>
                      {canEdit && <button style={{ ...smallBtn, padding: "3px 9px", fontSize: 11 }} onClick={() => commencerEdition(en)}>Modifier</button>}
                      {canDelete && <button style={{ ...smallBtn, padding: "3px 9px", fontSize: 11, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => supprimer(en)}>Supprimer</button>}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          if (editId === en.id && editForm) {
            return (
              <div key={en.id} style={{ ...card, marginBottom: 0, borderLeft: `5px solid ${couleur}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Modifier l'entrée {en.ref || ""}</div>
                <FormulaireEntree v={editForm} onChange={setEditForm} edition ctx={ctx} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button disabled={busy} onClick={enregistrerEdition} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 0 }}>Enregistrer</button>
                  <button onClick={() => { setEditId(null); setEditForm(null); }} style={smallBtn}>Annuler</button>
                </div>
              </div>
            );
          }

          const prio = en.priorite && en.priorite !== "Routine" ? en.priorite : null;
          return (
            <div key={en.id} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 12 }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 800, fontSize: 15, color: "#14213A", textAlign: "right", paddingTop: 14 }} title={`Saisi à ${new Date(en.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}>{heure}</div>
              <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${prio ? COULEURS_PRIO[prio] : couleur}`, borderRadius: 12, padding: "14px 16px", boxShadow: "0 3px 12px -9px rgba(7,20,46,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ background: couleur, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12 }}>{en.type}</span>
                    {prio && <span style={{ background: COULEURS_PRIO[prio], color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 12 }}>{prio === "Urgent" ? "⚠ URGENT" : "IMPORTANT"}</span>}
                    {en.lieu && <span style={{ fontSize: 12.5, color: "#3A4D6B", fontWeight: 600 }}>📍 {en.lieu}</span>}
                  </div>
                  {en.ref && <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#6B7A90" }}>{en.ref}</span>}
                </div>

                {estTypePatrouille(en.type) && (en.vehicule || (en.membres || []).length > 0) && (
                  <div style={{ marginTop: 10, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}>
                    <div><b>{en.nbAgents || (en.membres || []).length}</b> agent{(en.nbAgents || (en.membres || []).length) > 1 ? "s" : ""}{en.vehicule ? <> · 🚓 {en.vehicule} — <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700 }}>{en.plaque}</span></> : null}</div>
                    {(en.membres || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                        {en.membres.map((m) => <span key={m.id} style={{ background: "#fff", border: "1px solid #C3D0E2", color: "#14213A", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 12 }}>👤 {m.nom}</span>)}
                      </div>
                    )}
                    {en.type !== TYPE_FIN && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                        {(en.materiel || []).length > 0
                          ? en.materiel.map((m) => <span key={m} style={{ background: "#E6EDF7", color: "#123A7A", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 12 }}>{m}</span>)
                          : <span style={{ color: "#5A6B84", fontSize: 12 }}>Aucun matériel spécifique</span>}
                      </div>
                    )}
                  </div>
                )}

                {en.description && !DESCRIPTIONS_AUTO.includes(en.description) && <div style={{ fontSize: 14, marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.55, color: "#14213A" }}>{en.description}</div>}

                <div style={{ marginTop: 6 }}>
                  <Info label="Agents">{en.agents}</Info>
                  <Info label="Personnes impliquées">{en.personnes}</Info>
                  <Info label="Véhicule concerné">{en.vehiculeTiers}</Info>
                  <Info label="Suite donnée">{en.suite && en.suite !== "Aucune" ? en.suite : ""}</Info>
                </div>

                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #EAF0F7", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 11.5, color: "#5A6B84" }}>Rédigé par <b>{en.auteurGrade} {en.auteurNom}</b>{en.auteurRIO ? ` · RIO ${en.auteurRIO}` : ""}</div>
                  {modifiable && (
                    <div style={{ display: "flex", gap: 6 }}>
                      {canEdit && <button style={smallBtn} onClick={() => commencerEdition(en)}>Modifier</button>}
                      {canDelete && <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => supprimer(en)}>Supprimer</button>}
                    </div>
                  )}
                </div>
                {en.modifie && <div style={{ fontSize: 11, color: "#B25E00", marginTop: 6 }}>✎ Modifié par {en.modifiePar} le {new Date(en.modifieLe).toLocaleString("fr-FR")}</div>}
              </div>
            </div>
          );
        })}
        {!loading && affiches.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13, padding: "16px 0" }}>Aucun événement{filtre !== "Tous" || recherche ? " ne correspond à ce filtre" : " enregistré ce jour-là"}.</div>}
      </div>
    </div>
  );
}
