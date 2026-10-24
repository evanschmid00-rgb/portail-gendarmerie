// pages/carte.jsx — « Carte de la ville » : carte des secteurs + patrouilles affectées (créées par les Opérateurs CORG)
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import { db } from "../firebase";
import { Field, buttonPrimary, h2Style, selectStyle, smallBtn } from "../composants/ui.jsx";
import { avecCacheSession, viderCacheSession } from "../lib/cache.js";

export const DROIT_CORG = "Opérateur CORG";
const NON_AFFECTEE = "Non affectée";
const SECTEURS = [
  { nom: "Secteur Uniforme", type: "Secteur Urbain", couleur: "#E0192E" },
  { nom: "Secteur India", type: "Secteur Industriel", couleur: "#1F4BE8" },
  { nom: "Secteur Papa-Uniforme", type: "Secteur Péri-Urbain", couleur: "#27B336" },
  { nom: "Secteur Roméo", type: "Secteur Rural", couleur: "#E8C411" },
];
const CLE_CACHE = "patrouilles_corg";

export function CarteVillePage({ current, personnel = [], roles = [] }) {
  const [zoom, setZoom] = useState(false);
  const [patrouilles, setPatrouilles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [creation, setCreation] = useState(false);
  const peutGerer = !!(current && (current.isAdmin || (current.qualifications || []).includes(DROIT_CORG)));
  // Diagnostic affiché aux gendarmes sans le droit : quels rôles le site voit-il sur leur fiche ?
  const mesRoles = roles.filter((r) => ((current && current.roles) || []).includes(r.id));
  const droitParRole = mesRoles.some((r) => (r.qualifications || []).includes(DROIT_CORG));

  const charger = useCallback(async (force = false) => {
    setChargement(true);
    try {
      const liste = await avecCacheSession(CLE_CACHE, 60000, async () => {
        const snap = await getDocs(query(collection(db, "patrouilles_corg"), where("statut", "==", "Active")));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }, force);
      setPatrouilles(liste);
      setErreur("");
    } catch (e) { console.error(e); setErreur("Impossible de charger les patrouilles pour le moment."); }
    setChargement(false);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function creer(data) {
    try {
      const complet = { ...data, disponible: true, membresMatricules: (data.membres || []).map((m) => m.matricule), statut: "Active", creePar: `${current.prenom} ${current.nom}`, creeLe: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const ref = await addDoc(collection(db, "patrouilles_corg"), complet);
      setPatrouilles((p) => [...p, { id: ref.id, ...complet }]);
      viderCacheSession();
      return true;
    } catch (e) { console.error(e); setErreur("Création impossible (droits ou connexion)."); return false; }
  }
  async function modifier(id, champs) {
    try {
      const c = { ...champs, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, "patrouilles_corg", id), c);
      setPatrouilles((p) => (c.statut && c.statut !== "Active" ? p.filter((x) => x.id !== id) : p.map((x) => (x.id === id ? { ...x, ...c } : x))));
      viderCacheSession();
    } catch (e) { console.error(e); setErreur("Modification impossible (droits ou connexion)."); }
  }
  async function supprimer(id) {
    if (!window.confirm("Supprimer cette patrouille ?")) return;
    try { await deleteDoc(doc(db, "patrouilles_corg", id)); setPatrouilles((p) => p.filter((x) => x.id !== id)); viderCacheSession(); }
    catch (e) { console.error(e); setErreur("Suppression impossible."); }
  }

  const colonnes = [...SECTEURS.map((s) => ({ ...s, cle: s.nom })), { nom: NON_AFFECTEE, type: "En attente d'affectation", couleur: "#7A8CA8", cle: NON_AFFECTEE }];

  return (
    <div style={{ maxWidth: 1100 }}>
      <h2 style={h2Style}>Carte de la ville</h2>
      <p style={{ color: "#5A6B84", fontSize: 13.5, margin: "0 0 14px" }}>Les quatre secteurs d'intervention de la ville. Clique sur la carte pour l'agrandir.</p>
      <img src="/carte-ville.webp" alt="Carte de la ville avec les secteurs Uniforme, India, Papa-Uniforme et Roméo" onClick={() => setZoom(true)} style={{ width: "100%", display: "block", borderRadius: 12, border: "1px solid #D3DDEA", boxShadow: "0 10px 28px -14px rgba(7,20,46,0.45)", cursor: "zoom-in" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, marginTop: 16 }}>
        {SECTEURS.map((s) => (
          <div key={s.nom} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `6px solid ${s.couleur}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#14213A" }}>{s.nom}</div>
            <div style={{ fontSize: 13, color: "#5A6B84", marginTop: 3 }}>= {s.type}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", margin: "26px 0 10px" }}>
        <h3 style={{ margin: 0, fontSize: 18, color: "#14213A" }}>Patrouilles en cours</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => charger(true)} style={smallBtn}>↻ Actualiser</button>
          {peutGerer && <button type="button" onClick={() => setCreation(!creation)} style={{ ...smallBtn, background: "#123A7A", color: "#fff", borderColor: "#123A7A" }}>{creation ? "Fermer" : "+ Créer une patrouille"}</button>}
        </div>
      </div>
      {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
      {peutGerer && creation && <FormPatrouille personnel={personnel} onCreer={async (d) => { if (await creer(d)) setCreation(false); }} />}
      {!peutGerer && <p style={{ color: "#5A6B84", fontSize: 12.5, margin: "0 0 10px" }}>Les patrouilles sont créées et affectées par les Opérateurs CORG.</p>}
      {!peutGerer && droitParRole && <div style={{ background: "#FFF6DD", border: "1px solid #E6C766", color: "#6B4E00", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, marginBottom: 10 }}>Ton rôle a bien le droit « Opérateur CORG », mais ta fiche n'est pas encore à jour. Demande à un administrateur d'ouvrir ta fiche dans « Personnel » et de l'enregistrer, puis reconnecte-toi.</div>}
      {!peutGerer && !droitParRole && <div style={{ fontSize: 11.5, color: "#8896AB", marginBottom: 10 }}>Rôles sur ton compte du site : {mesRoles.length ? mesRoles.map((r) => r.nom).join(", ") : "aucun"}. Le droit « Opérateur CORG » doit être coché dans l'un de ces rôles.</div>}

      {chargement && patrouilles.length === 0 ? <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {colonnes.map((col) => {
            const liste = patrouilles.filter((p) => (p.secteur || NON_AFFECTEE) === col.cle);
            if (col.cle === NON_AFFECTEE && liste.length === 0) return null;
            return (
              <div key={col.cle} style={{ background: "#F5F8FC", border: "1px solid #D3DDEA", borderTop: `5px solid ${col.couleur}`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: "#14213A" }}>{col.nom} <span style={{ color: "#5A6B84", fontWeight: 600 }}>· {liste.length}{liste.length ? ` (${liste.filter((x) => x.disponible !== false).length} dispo)` : ""}</span></div>
                {liste.length === 0 && <div style={{ fontSize: 12, color: "#8896AB", marginTop: 8 }}>Aucune patrouille</div>}
                {liste.map((p) => {
                  const dispo = p.disponible !== false;
                  const estMembre = (p.membresMatricules || []).includes(current && current.matricule);
                  return (
                  <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${dispo ? "#2E9E5B" : "#C0172D"}`, borderRadius: 8, padding: "9px 10px", marginTop: 8, opacity: dispo ? 1 : 0.85 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5, color: "#123A7A" }}>🚓 {p.nom}</div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: dispo ? "#1F6B42" : "#C0172D", background: dispo ? "#E3F5EA" : "#FDE7EA", borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" }}>{dispo ? "🟢 Disponible" : "🔴 Indisponible"}</span>
                    </div>
                    {p.lieu && <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 2 }}>📍 {p.lieu}</div>}
                    {(peutGerer || estMembre) && <button type="button" onClick={() => modifier(p.id, { disponible: !dispo })} style={{ ...smallBtn, padding: "3px 8px", fontSize: 11.5, marginTop: 6 }}>{dispo ? "Passer indisponible" : "Passer disponible"}</button>}
                    {p.vehicule && <div style={{ fontSize: 12, color: "#5A6B84" }}>Véhicule : {p.vehicule}</div>}
                    {p.mission && <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 2 }}>Mission : {p.mission}</div>}
                    <div style={{ fontSize: 12.5, marginTop: 5, lineHeight: 1.5 }}>{(p.membres || []).length ? (p.membres || []).map((m) => <div key={m.matricule}>• {m.nom}</div>) : <i style={{ color: "#8896AB" }}>Aucun membre</i>}</div>
                    {peutGerer && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                        <select value={p.secteur || NON_AFFECTEE} onChange={(e) => modifier(p.id, { secteur: e.target.value })} style={{ ...selectStyle, padding: "4px 6px", fontSize: 12, width: "auto", flex: 1, minWidth: 120 }} aria-label="Affecter à un secteur">
                          {[...SECTEURS.map((s) => s.nom), NON_AFFECTEE].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <input defaultValue={p.lieu || ""} placeholder="📍 Lieu" maxLength={120} onBlur={(e) => { if (e.target.value.trim() !== (p.lieu || "")) modifier(p.id, { lieu: e.target.value.trim() }); }} style={{ flexBasis: "100%", boxSizing: "border-box", padding: "4px 7px", border: "1px solid #C5D0E0", borderRadius: 6, fontSize: 12 }} />
                        <button type="button" onClick={() => modifier(p.id, { statut: "Terminée" })} style={{ ...smallBtn, padding: "3px 8px", fontSize: 11.5 }}>Terminer</button>
                        <button type="button" onClick={() => supprimer(p.id)} style={{ ...smallBtn, padding: "3px 8px", fontSize: 11.5, color: "#C0172D", borderColor: "#C0172D" }}>✕</button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {zoom && (
        <div onClick={() => setZoom(false)} style={{ position: "fixed", inset: 0, background: "rgba(7,20,46,0.9)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, cursor: "zoom-out" }}>
          <img src="/carte-ville.webp" alt="Carte de la ville" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}

function FormPatrouille({ personnel, onCreer }) {
  const [nom, setNom] = useState("");
  const [secteur, setSecteur] = useState(SECTEURS[0].nom);
  const [vehicule, setVehicule] = useState("");
  const [mission, setMission] = useState("");
  const [lieu, setLieu] = useState("");
  const [membres, setMembres] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState("");

  const q = recherche.trim().toLowerCase();
  const propositions = q ? personnel.filter((p) => !membres.some((m) => m.matricule === p.matricule) && `${p.prenom} ${p.nom} ${p.matricule}`.toLowerCase().includes(q)).slice(0, 6) : [];

  function valider(e) {
    e.preventDefault();
    if (nom.trim().length < 2) { setErreur("Donne un nom à la patrouille (ex : Alpha 1)."); return; }
    if (membres.length === 0) { setErreur("Ajoute au moins un gendarme."); return; }
    onCreer({ nom: nom.trim().slice(0, 60), secteur, vehicule: vehicule.trim().slice(0, 80), mission: mission.trim().slice(0, 200), lieu: lieu.trim().slice(0, 120), membres });
  }

  return (
    <form onSubmit={valider} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <Field label="Nom / indicatif" value={nom} onChange={setNom} placeholder="Ex : Alpha 1" />
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#3A4D6B", marginBottom: 5 }}>Secteur</label>
          <select value={secteur} onChange={(e) => setSecteur(e.target.value)} style={selectStyle}>
            {[...SECTEURS.map((s) => s.nom), NON_AFFECTEE].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <Field label="Véhicule (facultatif)" value={vehicule} onChange={setVehicule} placeholder="Ex : Renault Master" />
        <Field label="Mission (facultatif)" value={mission} onChange={setMission} placeholder="Ex : Contrôles routiers" />
        <Field label="Lieu / position (facultatif)" value={lieu} onChange={setLieu} placeholder="Ex : Place de la mairie" />
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#3A4D6B", margin: "6px 0 5px" }}>Membres</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {membres.map((m) => (
          <span key={m.matricule} style={{ background: "#ECEEFE", border: "1px solid #C9CFF7", borderRadius: 16, padding: "3px 6px 3px 10px", fontSize: 12.5 }}>
            {m.nom} <button type="button" onClick={() => setMembres(membres.filter((x) => x.matricule !== m.matricule))} aria-label="Retirer" style={{ background: "none", border: "none", cursor: "pointer", color: "#C0172D", fontWeight: 800 }}>×</button>
          </span>
        ))}
      </div>
      <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔎 Chercher un gendarme (nom, prénom, matricule)" style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #C5D0E0", borderRadius: 8, fontSize: 13.5 }} />
      {propositions.length > 0 && (
        <div style={{ border: "1px solid #D3DDEA", borderRadius: 8, marginTop: 4, overflow: "hidden" }}>
          {propositions.map((p) => (
            <button key={p.id} type="button" onClick={() => { setMembres([...membres, { matricule: p.matricule, nom: `${p.prenom} ${p.nom}` }]); setRecherche(""); }} style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: "none", borderBottom: "1px solid #EEF2F8", padding: "8px 11px", cursor: "pointer", fontSize: 13 }}>
              {p.prenom} {p.nom} <span style={{ color: "#8896AB" }}>· {p.matricule}{p.grade ? ` · ${p.grade}` : ""}</span>
            </button>
          ))}
        </div>
      )}
      {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginTop: 8 }}>{erreur}</div>}
      <button type="submit" style={{ ...buttonPrimary, marginTop: 12 }}>Créer la patrouille</button>
    </form>
  );
}
