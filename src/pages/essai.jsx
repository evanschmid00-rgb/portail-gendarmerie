// pages/essai.jsx — « Recrues en essai » : période d'essai, parrain, notes et commentaires par domaine, titularisation.
// - Recruteurs / admins : voient toutes les recrues, gèrent parrain, prolongation, titularisation.
// - Parrains : voient leurs filleuls et ajoutent des notes / commentaires par domaine.
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { h2Style, smallBtn } from "../composants/ui.jsx";
import { db } from "../firebase";
import { numAgent } from "../lib/utils.js";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const BLEU = "#123A7A";
const JOUR = 86400000;
export const joursRestants = (fin) => (fin ? Math.ceil((new Date(fin).getTime() - Date.now()) / JOUR) : null);
export const enEssai = (p) => p.essaiStatut === "En cours" || p.essaiStatut === "Prolongée";
const dateFR = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—");
const dateCourte = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

// Domaines évalués par le parrain
export const DOMAINES = [
  { id: "ponctualite", nom: "Ponctualité & assiduité", icone: "⏱️", aide: "Présence, respect des horaires, prise de service." },
  { id: "reglement", nom: "Connaissance du règlement", icone: "📘", aide: "Règlement intérieur, code pénal, procédures." },
  { id: "procedures", nom: "Procédures (PV, contrôles, plaintes)", icone: "📝", aide: "Rédaction des PV, contrôle routier, prise de plainte." },
  { id: "conduite", nom: "Conduite & véhicules", icone: "🚓", aide: "Conduite en patrouille, course-poursuite, respect du code de la route." },
  { id: "armes", nom: "Maniement des armes & tenue", icone: "🔫", aide: "Sécurité, maniement, tenue réglementaire." },
  { id: "radio", nom: "Communication radio", icone: "📻", aide: "Phraséologie, clarté, respect des fréquences." },
  { id: "terrain", nom: "Sang-froid & gestion d'intervention", icone: "🧠", aide: "Réaction face aux situations tendues, initiative." },
  { id: "equipe", nom: "Esprit d'équipe & attitude", icone: "🤝", aide: "Respect de la hiérarchie, entraide, comportement RP." },
  { id: "autre", nom: "Autre", icone: "💬", aide: "Tout ce qui ne rentre pas dans les autres domaines." },
];
const domaineDe = (id) => DOMAINES.find((d) => d.id === id) || DOMAINES[DOMAINES.length - 1];
const LIBELLE_NOTE = { 1: "Insuffisant", 2: "À améliorer", 3: "Correct", 4: "Bien", 5: "Excellent" };
const couleurNote = (n) => (n >= 4 ? "#2E7D4F" : n >= 3 ? "#2F6FDE" : n >= 2 ? "#B25E00" : "#C0172D");
const moyenne = (liste) => { const ns = liste.map((e) => Number(e.note)).filter((n) => n > 0); return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null; };

function Etoiles({ valeur, onChange, taille = 22 }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} role={onChange ? "button" : undefined} onClick={onChange ? () => onChange(valeur === n ? 0 : n) : undefined}
          style={{ fontSize: taille, lineHeight: 1, cursor: onChange ? "pointer" : "default", color: n <= Math.round(valeur || 0) ? "#E0A23A" : "#D3DDEA", userSelect: "none" }}>★</span>
      ))}
    </span>
  );
}

function Pastille({ texte, c, fond }) {
  return <span style={{ display: "inline-block", background: fond, color: c, borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 700 }}>{texte}</span>;
}

function Tuile({ label, valeur, couleur }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${couleur}`, borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: couleur, lineHeight: 1.1 }}>{valeur}</div>
      <div style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>{label}</div>
    </div>
  );
}

function SuiviRecrue({ p, evals, current, peutGerer, onAjout, onSuppr }) {
  const [domaine, setDomaine] = useState(DOMAINES[0].id);
  const [note, setNote] = useState(0);
  const [texte, setTexte] = useState("");
  const [busy, setBusy] = useState(false);
  const [filtre, setFiltre] = useState("");
  const parDomaine = DOMAINES.map((d) => { const l = evals.filter((e) => e.domaine === d.id); return { d, nb: l.length, moy: moyenne(l) }; });
  const liste = evals.filter((e) => !filtre || e.domaine === filtre).slice().sort((a, b) => String(b.creeLe).localeCompare(String(a.creeLe)));

  async function ajouter() {
    if (!texte.trim() && !note) return;
    setBusy(true);
    const ok = await onAjout(p, { domaine, note, commentaire: texte.trim() });
    setBusy(false);
    if (ok) { setTexte(""); setNote(0); }
  }

  return (
    <div style={{ marginTop: 14, borderTop: "1px dashed #D3DDEA", paddingTop: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#14213A", marginBottom: 8 }}>Bilan par domaine</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8, marginBottom: 16 }}>
        {parDomaine.filter((x) => x.d.id !== "autre" || x.nb > 0).map(({ d, nb, moy }) => (
          <button key={d.id} type="button" onClick={() => setFiltre(filtre === d.id ? "" : d.id)} title={d.aide}
            style={{ textAlign: "left", background: filtre === d.id ? "#EEF4FF" : "#F5F8FC", border: `1px solid ${filtre === d.id ? BLEU : "#E1E8F2"}`, borderRadius: 10, padding: "8px 10px", cursor: "pointer", fontFamily: FONT }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#14213A" }}>{d.icone} {d.nom}</div>
            <div style={{ height: 6, background: "#E1E8F2", borderRadius: 4, margin: "7px 0 5px", overflow: "hidden" }}>
              <div style={{ width: `${moy ? (moy / 5) * 100 : 0}%`, height: "100%", background: moy ? couleurNote(moy) : "#C3D0E2" }} />
            </div>
            <div style={{ fontSize: 11.5, color: "#5A6B84" }}>{moy ? <><b style={{ color: couleurNote(moy) }}>{moy.toFixed(1)}/5</b> · {nb} avis</> : nb ? `${nb} commentaire${nb > 1 ? "s" : ""} sans note` : "Pas encore évalué"}</div>
          </button>
        ))}
      </div>

      <div style={{ background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#14213A", marginBottom: 8 }}>Ajouter une note ou un commentaire</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <select value={domaine} onChange={(e) => setDomaine(e.target.value)} style={{ padding: "7px 9px", border: "1px solid #C3D0E2", borderRadius: 8, fontSize: 13, background: "#fff", fontFamily: FONT }}>
            {DOMAINES.map((d) => <option key={d.id} value={d.id}>{d.icone} {d.nom}</option>)}
          </select>
          <Etoiles valeur={note} onChange={setNote} />
          <span style={{ fontSize: 12, color: note ? couleurNote(note) : "#8A97AB", fontWeight: 700 }}>{note ? `${note}/5 · ${LIBELLE_NOTE[note]}` : "Note facultative"}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#5A6B84", marginBottom: 6 }}>{domaineDe(domaine).aide}</div>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} placeholder="Ton commentaire : points forts, axes d'amélioration, situation observée…" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: FONT, resize: "vertical" }} />
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <button type="button" disabled={busy || (!texte.trim() && !note)} onClick={ajouter} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: FONT, opacity: busy || (!texte.trim() && !note) ? 0.5 : 1 }}>{busy ? "Envoi…" : "Enregistrer l'avis"}</button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#14213A" }}>Historique{filtre ? ` — ${domaineDe(filtre).nom}` : ""} ({liste.length})</div>
        {filtre && <button type="button" style={smallBtn} onClick={() => setFiltre("")}>Tout afficher</button>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {liste.map((e) => (
          <div key={e.id} style={{ background: "#fff", border: "1px solid #E1E8F2", borderLeft: `4px solid ${e.note ? couleurNote(e.note) : "#C3D0E2"}`, borderRadius: 10, padding: "9px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#14213A" }}>{domaineDe(e.domaine).icone} {domaineDe(e.domaine).nom}</span>
              {e.note > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Etoiles valeur={e.note} taille={15} /><b style={{ fontSize: 12, color: couleurNote(e.note) }}>{e.note}/5</b></span>}
            </div>
            {e.commentaire && <div style={{ fontSize: 13, color: "#26364F", lineHeight: 1.55, marginTop: 4, whiteSpace: "pre-wrap" }}>{e.commentaire}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11.5, color: "#5A6B84" }}>
              <span>{e.auteurNom || "—"} · {dateCourte(e.creeLe)}</span>
              {(peutGerer || e.auteurMatricule === current.matricule) && <button type="button" onClick={() => { if (window.confirm("Supprimer cet avis ?")) onSuppr(e); }} style={{ background: "none", border: "none", color: "#C0172D", cursor: "pointer", fontSize: 11.5, fontFamily: FONT }}>Supprimer</button>}
            </div>
          </div>
        ))}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 12.5 }}>Aucun avis pour le moment.</div>}
      </div>
    </div>
  );
}

export function EssaiPage({ personnel, current, onUpdate }) {
  const peutGerer = !!current.isAdmin || (current.qualifications || []).includes("Recruteur");
  const [filtre, setFiltre] = useState("cours");
  const [msg, setMsg] = useState("");
  const [ouvert, setOuvert] = useState(null);
  const [evals, setEvals] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const ref = collection(db, "essai_evaluations");
        const snap = await getDocs(peutGerer ? ref : query(ref, where("parrainMatricule", "==", current.matricule)));
        if (!annule) setEvals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error("Avis d'essai", e); if (!annule) setMsg("Impossible de charger les avis (droits Firestore à mettre à jour ?)."); }
      if (!annule) setChargement(false);
    })();
    return () => { annule = true; };
  }, [peutGerer, current.matricule]);

  const mesFilleuls = (p) => p.parrainMatricule === current.matricule;
  const visibles = peutGerer ? personnel : personnel.filter(mesFilleuls);
  const liste = visibles
    .filter((p) => (filtre === "cours" ? enEssai(p) : p.essaiStatut === "Titularisée"))
    .slice().sort((a, b) => String(a.essaiFin || "").localeCompare(String(b.essaiFin || "")));
  const enCours = visibles.filter(enEssai);
  const nbTit = visibles.filter((p) => p.essaiStatut === "Titularisée").length;
  const candidatsParrain = personnel.filter((p) => !enEssai(p)).sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
  const evalsDe = useMemo(() => { const m = {}; evals.forEach((e) => { (m[e.recrueId] = m[e.recrueId] || []).push(e); }); return m; }, [evals]);

  async function agir(p, patch, ok) {
    const r = await onUpdate(p.id, patch);
    setMsg(r ? ok : "Échec de l'enregistrement.");
  }
  async function ajouterAvis(p, { domaine, note, commentaire }) {
    const e = { recrueId: p.id, recrueNom: `${p.prenom} ${p.nom}`, parrainMatricule: p.parrainMatricule || "", domaine, note: note || 0, commentaire, auteurMatricule: current.matricule, auteurNom: `${current.grade || ""} ${current.prenom} ${current.nom}`.trim(), creeLe: new Date().toISOString() };
    try {
      const ref = await addDoc(collection(db, "essai_evaluations"), e);
      setEvals((x) => [...x, { id: ref.id, ...e }]);
      setMsg("Avis enregistré.");
      return true;
    } catch (err) { console.error(err); setMsg("Échec : tu n'as peut-être pas le droit d'évaluer cette recrue (seul son parrain ou un recruteur le peut)."); return false; }
  }
  async function supprimerAvis(e) {
    try { await deleteDoc(doc(db, "essai_evaluations", e.id)); setEvals((x) => x.filter((y) => y.id !== e.id)); setMsg("Avis supprimé."); }
    catch (err) { console.error(err); setMsg("Suppression impossible."); }
  }

  const chip = (actif) => ({ border: "1px solid #C3D0E2", background: actif ? BLEU : "#fff", color: actif ? "#fff" : "#14213A", borderRadius: 16, padding: "5px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT });
  const echeance = enCours.filter((p) => joursRestants(p.essaiFin) !== null && joursRestants(p.essaiFin) <= 3).length;
  const sansParrain = enCours.filter((p) => !p.parrainMatricule).length;

  return (
    <div style={{ fontFamily: FONT, maxWidth: 960 }}>
      <h2 style={h2Style}>{peutGerer ? "Recrues en essai" : "Mes filleuls"}</h2>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 14, lineHeight: 1.5 }}>
        {peutGerer ? "Suivi des périodes d'essai : désigne un parrain, consulte les avis par domaine, prolonge ou titularise." : "Tu es parrain / marraine de ces recrues : note leur progression et laisse tes commentaires par domaine."}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Tuile label="En essai" valeur={enCours.length} couleur="#2F6FDE" />
        <Tuile label="Fin d'essai ≤ 3 jours" valeur={echeance} couleur={echeance ? "#C0172D" : "#8A97AB"} />
        {peutGerer && <Tuile label="Sans parrain" valeur={sansParrain} couleur={sansParrain ? "#E0A23A" : "#8A97AB"} />}
        <Tuile label="Titularisées" valeur={nbTit} couleur="#2E7D4F" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button style={chip(filtre === "cours")} onClick={() => setFiltre("cours")}>En cours ({enCours.length})</button>
        <button style={chip(filtre === "titularises")} onClick={() => setFiltre("titularises")}>Titularisées ({nbTit})</button>
      </div>
      {msg && <div style={{ background: "#EAF3FF", border: "1px solid #9CC0F0", color: BLEU, borderRadius: 10, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{msg}</div>}
      {chargement && <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 10 }}>Chargement des avis…</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {liste.map((p) => {
          const j = joursRestants(p.essaiFin);
          const urgent = enEssai(p) && j !== null && j <= 3;
          const mesEvals = evalsDe[p.id] || [];
          const moy = moyenne(mesEvals);
          const debut = p.creeLe ? new Date(p.creeLe).getTime() : null;
          const fin = p.essaiFin ? new Date(p.essaiFin).getTime() : null;
          const pct = debut && fin && fin > debut ? Math.max(0, Math.min(100, ((Date.now() - debut) / (fin - debut)) * 100)) : 0;
          const couleurCarte = urgent ? "#C0172D" : p.essaiStatut === "Titularisée" ? "#2E7D4F" : "#2F6FDE";
          const estOuvert = ouvert === p.id;
          const peutNoter = peutGerer || mesFilleuls(p);
          return (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${couleurCarte}`, borderRadius: 14, padding: "14px 16px", boxShadow: "0 6px 20px -14px rgba(7,20,46,0.35)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#E6EDF7", color: BLEU, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{`${(p.prenom || "?")[0]}${(p.nom || "?")[0]}`.toUpperCase()}</div>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#14213A" }}>{p.grade} {p.prenom} {p.nom}</div>
                  <div style={{ fontSize: 12.5, color: "#5A6B84" }}>{p.unite}{p.cipcNumero ? ` · N° ${numAgent(p)}` : ""}{p.creeLe ? ` · arrivé(e) le ${dateFR(p.creeLe)}` : ""}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                    {p.essaiStatut === "Prolongée" && <Pastille texte="Prolongée" c="#8A5A00" fond="#FFF1DC" />}
                    {enEssai(p) && !p.parrainMatricule && <Pastille texte="Sans parrain" c="#8A1020" fond="#FBE3E7" />}
                    {p.parrainNom && <Pastille texte={`Parrain : ${p.parrainNom}`} c="#3B45B5" fond="#ECEEFE" />}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700, color: urgent ? "#C0172D" : "#14213A" }}>{p.essaiStatut === "Titularisée" ? `Titularisé(e) le ${dateFR(p.titulariseLe)}` : j === null ? "Fin d'essai non définie" : j < 0 ? `Essai dépassé de ${-j} j` : `Fin le ${dateFR(p.essaiFin)} (${j} j)`}</div>
                  <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Etoiles valeur={moy || 0} taille={15} />
                    <span style={{ fontSize: 12, color: moy ? couleurNote(moy) : "#8A97AB", fontWeight: 700 }}>{moy ? `${moy.toFixed(1)}/5` : "pas de note"} · {mesEvals.length} avis</span>
                  </div>
                </div>
              </div>
              {enEssai(p) && (
                <div style={{ height: 6, background: "#E1E8F2", borderRadius: 4, margin: "12px 0 2px", overflow: "hidden" }} title="Avancement de la période d'essai">
                  <div style={{ width: `${pct}%`, height: "100%", background: urgent ? "#C0172D" : "#2F6FDE" }} />
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
                {peutGerer && enEssai(p) && (
                  <label style={{ fontSize: 12.5, color: "#3A4D6B" }}>Parrain :{" "}
                    <select value={p.parrainMatricule || ""} onChange={(e) => { const m = candidatsParrain.find((x) => x.matricule === e.target.value); agir(p, { parrainMatricule: m ? m.matricule : "", parrainNom: m ? `${m.grade} ${m.prenom} ${m.nom}` : "" }, m ? `Parrain désigné : ${m.prenom} ${m.nom}.` : "Parrain retiré."); }} style={{ padding: "6px 8px", border: "1px solid #C3D0E2", borderRadius: 8, fontSize: 13, background: "#fff", fontFamily: FONT }}>
                      <option value="">— Aucun —</option>
                      {candidatsParrain.map((x) => <option key={x.id} value={x.matricule}>{x.grade} {x.prenom} {x.nom}</option>)}
                    </select>
                  </label>
                )}
                <div style={{ flex: 1 }} />
                <button type="button" style={{ ...smallBtn, background: estOuvert ? "#E6EDF7" : undefined, fontWeight: 700 }} onClick={() => setOuvert(estOuvert ? null : p.id)}>{estOuvert ? "Fermer le suivi" : `📋 Suivi & avis (${mesEvals.length})`}</button>
                {peutGerer && enEssai(p) && <>
                  <button type="button" style={smallBtn} onClick={() => agir(p, { essaiFin: new Date(Math.max(Date.now(), new Date(p.essaiFin || Date.now()).getTime()) + 14 * JOUR).toISOString(), essaiStatut: "Prolongée" }, "Période d'essai prolongée de 14 jours.")}>+14 jours</button>
                  <button type="button" style={{ ...smallBtn, background: "#2E7D4F", color: "#fff", borderColor: "#2E7D4F" }} onClick={() => { if (window.confirm(`Titulariser ${p.prenom} ${p.nom} ?${moy ? `\nMoyenne des avis : ${moy.toFixed(1)}/5.` : "\nAucune note enregistrée."}`)) agir(p, { essaiStatut: "Titularisée", titulariseLe: new Date().toISOString() }, `${p.prenom} ${p.nom} est titularisé(e).`); }}>✓ Titulariser</button>
                </>}
              </div>

              {estOuvert && (peutNoter
                ? <SuiviRecrue p={p} evals={mesEvals} current={current} peutGerer={peutGerer} onAjout={ajouterAvis} onSuppr={supprimerAvis} />
                : <div style={{ marginTop: 12, fontSize: 12.5, color: "#5A6B84" }}>Seuls le parrain et les recruteurs peuvent voir et ajouter des avis.</div>)}
            </div>
          );
        })}
        {liste.length === 0 && <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, color: "#5A6B84", fontSize: 13 }}>{filtre === "cours" ? (peutGerer ? "Aucune recrue en période d'essai." : "Tu n'as aucun filleul en période d'essai.") : "Aucune recrue titularisée pour le moment."}</div>}
      </div>
    </div>
  );
}
