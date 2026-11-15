// pages/selection.jsx — Sélection des candidats à la gendarmerie (côté recrutement / CEGN).
// Parcours : épreuve écrite → tests psychotechniques → entretien devant le jury → visite médicale → enquête de moralité → décision
// (admis / liste d'attente / refusé). Écrit et psycho sont passés EN LIGNE par le candidat et corrigés par le serveur.
import React, { useEffect, useMemo, useState } from "react";
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { lireConfigAmgn } from "../lib/amgn.js";
import { db } from "../firebase";
import { loadCollection } from "../lib/donnees.js";
import { NeoBandeau, NeoCompteur, NeoOnglets, NeoCarte, NeoAlerte, NeoBouton, NEO_INP, NEO_LAB, N } from "../composants/neo.jsx";
import {
  ETAPES_SELECTION, FILIERES, filiereDe, etapeOk, etapeKo, LIBELLES_STATUT, couleurStatut, selectionVide, resumeSelection, moyenneSelection,
  toutesValidees, uneEliminee, lireQuestionsTexte, EPREUVES_EXEMPLES,
} from "../lib/selection.js";
import { infosDuCandidat } from "./candidatures.jsx";
import { ProgrammesAdmin, SuiviRecrues } from "./programmes.jsx";

const BTN = { border: "1px solid #123A7A", background: "#fff", color: "#123A7A", borderRadius: 10, padding: "7px 13px", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
const BTN_OK = { ...BTN, borderColor: "#1F9D55", color: "#1F6B42" };
const BTN_KO = { ...BTN, borderColor: "#C0172D", color: "#C0172D" };
const jour = (x) => { const d = new Date(x); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
const nomCandidat = (c) => { const i = infosDuCandidat(c); return `${i.prenom || ""} ${i.nom || ""}`.trim() || c.displayName || "Candidat"; };

function Puce({ statut }) {
  const c = couleurStatut(statut);
  return <span style={{ background: c + "1f", color: c, border: `1px solid ${c}`, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 800 }}>{LIBELLES_STATUT[statut] || statut}</span>;
}

// ───────────────────────── Page principale ─────────────────────────
export function SelectionPage({ current, candidatures = [], personnel = [], programmesInitiaux = [], onUpdateStatut, verifierCasier, onNavigate }) {
  const [onglet, setOnglet] = useState("candidats");
  const [selections, setSelections] = useState({});
  const [epreuves, setEpreuves] = useState([]);
  const [programmes, setProgrammes] = useState(programmesInitiaux);
  const [chargement, setChargement] = useState(true);
  const [msg, setMsg] = useState({ ton: "ok", texte: "" });

  async function recharger() {
    setChargement(true);
    try {
      const [s, e, p] = await Promise.all([loadCollection("selections"), loadCollection("selection_epreuves"), loadCollection("programmes_formation")]);
      setSelections(Object.fromEntries((s || []).map((x) => [x.id, x])));
      setEpreuves(e || []); setProgrammes(p || []);
    } catch (err) { console.error(err); setMsg({ ton: "danger", texte: "Lecture impossible : les règles Firestore de la sélection sont-elles publiées ?" }); }
    setChargement(false);
  }
  useEffect(() => { recharger(); }, []);

  const dit = (texte, ton = "ok") => setMsg({ texte, ton });
  const candidats = candidatures.filter((c) => c.ref && c.statut !== "Refusée" || (c.ref && selections[c.ref]));
  const enSel = candidats.filter((c) => selections[c.ref]);
  const decisions = (d) => enSel.filter((c) => (selections[c.ref].decision || "en-cours") === d).length;

  async function sauver(c, sel) {
    const numero = c.ref;
    // JSON.parse(JSON.stringify(…)) retire les valeurs « undefined », que Firestore refuse d'enregistrer
    const complet = JSON.parse(JSON.stringify({ ...sel, numero, candidatureId: c.id || "", updatedAt: new Date().toISOString() }));
    await setDoc(doc(db, "selections", numero), complet);
    try { await updateDoc(doc(db, "suivi_candidatures", numero), { selection: resumeSelection(complet), updatedAt: new Date().toISOString() }); }
    catch (e) { console.error("Résumé public non mis à jour", e); }
    setSelections((prev) => ({ ...prev, [numero]: { id: numero, ...complet } }));
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <NeoBandeau
        surtitre="Recrutement · CEGN" titre="Sélection des candidats"
        texte="Épreuves en ligne, entretien du jury, visite médicale et enquête de moralité : suis chaque candidat jusqu'à son admission, puis sa formation."
        droite={[
          <NeoCompteur key="a" n={decisions("en-cours")} label="En sélection" couleur="#6FA3FF" />,
          <NeoCompteur key="b" n={decisions("admis")} label="Admis" couleur="#6FE0A8" />,
          <NeoCompteur key="c" n={decisions("liste-attente")} label="Liste d'attente" couleur="#F0B048" />,
        ]}
      />
      {msg.texte && <NeoAlerte ton={msg.ton} icone={msg.ton === "ok" ? "✅" : "⚠️"}>{msg.texte}</NeoAlerte>}
      <NeoOnglets actif={onglet} onChange={setOnglet} onglets={[
        { id: "candidats", label: "Candidats", n: candidats.length },
        { id: "attente", label: "Admis & liste d'attente", n: decisions("admis") + decisions("liste-attente"), couleur: "#1F9D55" },
        { id: "epreuves", label: "Épreuves en ligne", n: epreuves.length },
        { id: "programmes", label: "Programmes de formation", n: programmes.length },
        { id: "recrues", label: "Suivi des recrues" },
      ]} />
      {chargement && <div style={{ color: N.gris, fontSize: 13, marginBottom: 10 }}>Chargement…</div>}

      {onglet === "candidats" && <ListeCandidats candidats={candidats} selections={selections} sauver={sauver} dit={dit} onUpdateStatut={onUpdateStatut} verifierCasier={verifierCasier} current={current} />}
      {onglet === "attente" && <AdmisAttente candidats={candidats} selections={selections} sauver={sauver} dit={dit} onUpdateStatut={onUpdateStatut} />}
      {onglet === "epreuves" && <EpreuvesAdmin epreuves={epreuves} setEpreuves={setEpreuves} dit={dit} />}
      {onglet === "programmes" && <ProgrammesAdmin programmes={programmes} setProgrammes={setProgrammes} dit={dit} />}
      {onglet === "recrues" && <SuiviRecrues personnel={personnel} programmes={programmes} selections={selections} current={current} dit={dit} onNavigate={onNavigate} />}
    </div>
  );
}

// ───────────────────────── Liste des candidats ─────────────────────────
function ListeCandidats({ candidats, selections, sauver, dit, onUpdateStatut, verifierCasier, current }) {
  const [filtre, setFiltre] = useState("tous");
  const [q, setQ] = useState("");
  const [ouvert, setOuvert] = useState("");
  const [occupe, setOccupe] = useState(false);

  const filtres = [["tous", "Tous"], ["a-demarrer", "À démarrer"], ["en-cours", "En sélection"], ["admis", "Admis"], ["liste-attente", "Liste d'attente"], ["refuse", "Éliminés"]];
  const etat = (c) => { const s = selections[c.ref]; return s ? (s.decision || "en-cours") : "a-demarrer"; };
  const liste = candidats
    .filter((c) => filtre === "tous" || etat(c) === filtre || (filtre === "en-cours" && etat(c) === "en-cours"))
    .filter((c) => !q.trim() || `${nomCandidat(c)} ${c.poste} ${c.ref}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  async function demarrer(c) {
    try { await sauver(c, selectionVide(c, c.poste)); dit(`Sélection démarrée pour ${nomCandidat(c)}.`); setOuvert(c.ref); }
    catch (e) { console.error(e); dit(`Impossible de démarrer : ${(e && e.code) === "permission-denied" ? "les règles Firestore ne sont pas publiées (ou tu n'as pas le droit)." : ((e && e.message) || "erreur inconnue")}`, "danger"); }
  }
  async function demarrerTous() {
    const aDemarrer = liste.filter((c) => !selections[c.ref] && c.statut === "En attente");
    if (!aDemarrer.length || !window.confirm(`Démarrer la sélection pour ${aDemarrer.length} candidat(s) en attente ?`)) return;
    setOccupe(true);
    try { for (const c of aDemarrer) await sauver(c, selectionVide(c, c.poste)); dit(`${aDemarrer.length} sélection(s) démarrée(s).`); }
    catch (e) { console.error(e); dit("Échec : règles Firestore de la sélection publiées ?", "danger"); }
    setOccupe(false);
  }

  return (
    <>
      <NeoCarte style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...NEO_INP, flex: "1 1 220px" }} placeholder="Rechercher (nom, poste, n° de dossier)…" value={q} onChange={(e) => setQ(e.target.value)} />
          <NeoBouton disabled={occupe} onClick={demarrerTous}>▶ Démarrer pour tous les « en attente »</NeoBouton>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {filtres.map(([id, l]) => <button key={id} type="button" onClick={() => setFiltre(id)} style={{ ...BTN, background: filtre === id ? "#123A7A" : "#fff", color: filtre === id ? "#fff" : "#123A7A", padding: "5px 12px" }}>{l}</button>)}
        </div>
      </NeoCarte>
      {!liste.length && <NeoAlerte ton="info" icone="ℹ️">Aucun candidat dans cette vue. Les candidatures GAV / SOG / Officier arrivent ici dès leur dépôt.</NeoAlerte>}
      {liste.map((c) => {
        const sel = selections[c.ref];
        const fil = FILIERES[(sel && sel.filiere) || filiereDe(c.poste)];
        const moy = sel ? moyenneSelection(sel) : null;
        const ouv = ouvert === c.ref;
        return (
          <NeoCarte key={c.id} style={{ padding: "12px 16px", borderLeft: `6px solid ${sel ? (sel.decision === "admis" ? "#1F9D55" : sel.decision === "refuse" ? "#D62B45" : sel.decision === "liste-attente" ? "#E0A02B" : "#2F7BFF") : "#C3D0E2"}` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: N.encre, overflowWrap: "anywhere" }}>{nomCandidat(c)}</div>
                <div style={{ fontSize: 12, color: N.gris }}>{c.poste} · <span style={{ color: fil.couleur, fontWeight: 800 }}>{fil.label}</span> · {c.ref}</div>
              </div>
              {sel ? (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                  {ETAPES_SELECTION.map((e) => { const st = (sel.etapes[e.id] || {}).statut || "a-faire"; return <span key={e.id} title={`${e.label} : ${LIBELLES_STATUT[st] || st}`} style={{ width: 30, height: 30, borderRadius: "50%", background: couleurStatut(st) + "22", border: `2px solid ${couleurStatut(st)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{e.icone}</span>; })}
                  {moy !== null && <span style={{ fontWeight: 800, color: N.encre, fontSize: 13, marginLeft: 4 }}>{String(moy).replace(".", ",")}/20</span>}
                </div>
              ) : <span style={{ fontSize: 12.5, color: N.gris }}>Sélection non démarrée</span>}
              {sel ? <button type="button" onClick={() => setOuvert(ouv ? "" : c.ref)} style={BTN}>{ouv ? "Fermer" : "Gérer"}</button> : <button type="button" onClick={() => demarrer(c)} style={BTN_OK}>▶ Démarrer</button>}
            </div>
            {sel && ouv && <FicheSelection c={c} sel={sel} sauver={sauver} dit={dit} onUpdateStatut={onUpdateStatut} verifierCasier={verifierCasier} current={current} />}
          </NeoCarte>
        );
      })}
    </>
  );
}

// ───────────────────────── Fiche de sélection d'un candidat ─────────────────────────
function FicheSelection({ c, sel, sauver, dit, onUpdateStatut, verifierCasier, current }) {
  const [occupe, setOccupe] = useState(false);
  const par = `${current.grade || ""} ${current.prenom || ""} ${current.nom || ""}`.trim();
  const etapeDe = (id) => sel.etapes[id] || { statut: "a-faire" };

  async function maj(id, patch) {
    setOccupe(true);
    try { await sauver(c, { ...sel, etapes: { ...sel.etapes, [id]: { ...etapeDe(id), ...patch, par, le: new Date().toISOString() } } }); }
    catch (e) { console.error(e); dit(`Échec de l'enregistrement : ${(e && e.code) === "permission-denied" ? "règles Firestore non publiées (ou droit manquant)." : ((e && e.message) || "erreur")}`, "danger"); }
    setOccupe(false);
  }
  async function decider(decision, extra = {}) {
    setOccupe(true);
    try { await sauver(c, { ...sel, decision, decideLe: new Date().toISOString(), decidePar: par, ...extra }); dit(decision === "admis" ? "Candidat admis." : decision === "liste-attente" ? "Placé sur liste d'attente." : decision === "refuse" ? "Candidat éliminé." : "Décision annulée."); }
    catch (e) { console.error(e); dit("Échec de l'enregistrement.", "danger"); }
    setOccupe(false);
  }
  async function changerFiliere(f) { try { await sauver(c, { ...sel, filiere: f }); } catch (e) { console.error(e); dit("Échec de l'enregistrement.", "danger"); } }

  const eliminee = uneEliminee(sel);
  return (
    <div style={{ marginTop: 12, borderTop: "1px dashed #C3D0E2", paddingTop: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: N.gris, fontWeight: 700 }}>Filière :</span>
        {Object.entries(FILIERES).map(([id, f]) => <button key={id} type="button" onClick={() => changerFiliere(id)} style={{ ...BTN, padding: "4px 12px", background: sel.filiere === id ? f.couleur : "#fff", color: sel.filiere === id ? "#fff" : f.couleur, borderColor: f.couleur }}>{f.label}</button>)}
        <span style={{ fontSize: 11.5, color: N.gris }}>Détermine les épreuves proposées et le programme de formation.</span>
      </div>
      {ETAPES_SELECTION.map((e) => (
        <BlocEtape key={e.id} e={e} etape={etapeDe(e.id)} occupe={occupe} maj={(p) => maj(e.id, p)} c={c} verifierCasier={verifierCasier} />
      ))}
      {eliminee && sel.decision !== "refuse" && (
        <NeoAlerte ton="danger" icone="⛔">Une étape est échouée : le candidat est éliminé.
          <div style={{ marginTop: 8 }}><button type="button" disabled={occupe} onClick={async () => { await decider("refuse"); if (c.statut !== "Refusée" && onUpdateStatut && window.confirm("Refuser aussi la candidature (le candidat sera informé à la publication des réponses) ?")) onUpdateStatut(c, "Refusée"); }} style={BTN_KO}>Éliminer et refuser la candidature</button></div>
        </NeoAlerte>
      )}
      <div style={{ background: "#F3F7FD", border: "1px solid #D3DDEA", borderRadius: 12, padding: 12, marginTop: 10 }}>
        <div style={{ fontWeight: 800, color: N.encre, marginBottom: 6 }}>Décision finale {sel.decision !== "en-cours" && <Puce statut={sel.decision === "admis" ? "reussi" : sel.decision === "refuse" ? "echoue" : "ouvert"} />}</div>
        {sel.decision !== "en-cours" && <div style={{ fontSize: 12.5, color: N.gris, marginBottom: 8 }}>{sel.decision === "admis" ? "Admis" : sel.decision === "liste-attente" ? "Sur liste d'attente" : "Éliminé"}{sel.decidePar ? ` · ${sel.decidePar}` : ""}{sel.decideLe ? ` · ${jour(sel.decideLe)}` : ""}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" disabled={occupe || !toutesValidees(sel)} onClick={() => decider("admis")} style={{ ...BTN_OK, opacity: toutesValidees(sel) ? 1 : 0.45 }}>✅ Déclarer admis</button>
          <button type="button" disabled={occupe || !toutesValidees(sel)} onClick={() => decider("liste-attente")} style={{ ...BTN, borderColor: "#B25E00", color: "#B25E00", opacity: toutesValidees(sel) ? 1 : 0.45 }}>⏳ Liste d'attente</button>
          <button type="button" disabled={occupe} onClick={() => decider("refuse")} style={BTN_KO}>⛔ Refuser</button>
          {sel.decision !== "en-cours" && <button type="button" disabled={occupe} onClick={() => decider("en-cours")} style={BTN}>↩ Annuler la décision</button>}
        </div>
        {!toutesValidees(sel) && <div style={{ fontSize: 12, color: N.gris, marginTop: 8 }}>Les 5 étapes doivent être validées pour admettre ou mettre sur liste d'attente.</div>}
        {sel.decision === "admis" && c.statut !== "Acceptée" && onUpdateStatut && (
          <div style={{ marginTop: 10 }}><NeoBouton onClick={() => onUpdateStatut(c, "Acceptée")}>🎖️ Accepter la candidature (compte + rôles Discord)</NeoBouton></div>
        )}
        {sel.decision === "admis" && c.statut === "Acceptée" && <div style={{ fontSize: 12.5, color: "#1F6B42", marginTop: 8 }}>✔ Candidature acceptée : le compte et les rôles suivent le circuit habituel.</div>}
      </div>
    </div>
  );
}

function BlocEtape({ e, etape, occupe, maj, c, verifierCasier }) {
  const [note, setNote] = useState(etape.note !== undefined ? String(etape.note) : "");
  const [avis, setAvis] = useState(etape.avis || "");
  const [jury, setJury] = useState(etape.jury || "");
  const [texte, setTexte] = useState(etape.commentaire || "");
  const [motif, setMotif] = useState(etape.motif || "");
  const [verif, setVerif] = useState("");
  const st = etape.statut || "a-faire";

  const noteValide = note !== "" && !isNaN(Number(note.replace(",", "."))) && Number(note.replace(",", ".")) >= 0 && Number(note.replace(",", ".")) <= 20;
  const n20 = () => Math.round(Number(note.replace(",", ".")) * 10) / 10;

  async function relancerCasier() {
    const i = infosDuCandidat(c);
    if (!verifierCasier || !i.robloxUsername) { setVerif("Compte Roblox du candidat introuvable dans le dossier."); return; }
    setVerif("Vérification en cours…");
    try { const r = await verifierCasier(i.robloxUsername); setVerif(r.ok ? "✅ Aucun délit ni crime au casier." : "⛔ " + r.error); setMotif(r.ok ? motif : String(r.error || "")); }
    catch (err) { setVerif("Vérification impossible pour le moment."); }
  }

  return (
    <div style={{ border: "1px solid #E1E8F2", borderLeft: `5px solid ${couleurStatut(st)}`, borderRadius: 12, padding: "10px 14px", marginBottom: 8, background: "#fff" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 18 }}>{e.icone}</span>
        <b style={{ flex: 1, color: N.encre }}>{e.label}</b>
        <Puce statut={st} />
      </div>
      {etape.par && <div style={{ fontSize: 11.5, color: N.gris, marginTop: 2 }}>{etape.automatique ? "Corrigé automatiquement" : `Par ${etape.par}`}{etape.le ? ` · ${jour(etape.le)}` : ""}</div>}

      {e.auto && (
        <div style={{ marginTop: 8 }}>
          {typeof etape.note === "number" && <div style={{ fontSize: 13.5, color: N.encre, marginBottom: 6 }}>Note : <b>{String(etape.note).replace(".", ",")}/20</b>{etape.seuil ? ` (seuil ${etape.seuil})` : ""}{etape.bonnes !== undefined ? ` · ${etape.bonnes}/${etape.questions} bonnes réponses` : ""}{etape.epreuve ? ` · ${etape.epreuve}` : ""}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {(st === "a-faire" || st === "echoue" || st === "reussi") && <button type="button" disabled={occupe} onClick={() => maj({ statut: "ouvert", automatique: false, note: undefined, bonnes: undefined, tentatives: 0 })} style={BTN}>{st === "a-faire" ? "📨 Ouvrir l'épreuve au candidat" : "🔁 Rouvrir (nouvelle tentative)"}</button>}
            {(st === "ouvert" || st === "en-cours") && <><span style={{ fontSize: 12.5, color: "#8A5A00" }}>{st === "ouvert" ? "Ouverte : le candidat la passe depuis son suivi de dossier." : "Le candidat est en train de la passer."}</span><button type="button" disabled={occupe} onClick={() => maj({ statut: "a-faire" })} style={BTN}>Fermer</button></>}
            <span style={{ fontSize: 12, color: N.gris }}>ou saisir à la main :</span>
            <input style={{ ...NEO_INP, width: 80 }} placeholder="/20" value={note} onChange={(ev) => setNote(ev.target.value)} />
            <button type="button" disabled={occupe || !noteValide} onClick={() => maj({ statut: n20() >= 10 ? "reussi" : "echoue", note: n20(), sur: 20, automatique: false })} style={BTN}>Enregistrer</button>
            <button type="button" disabled={occupe} onClick={() => maj({ statut: "dispense" })} style={BTN}>Dispenser</button>
          </div>
        </div>
      )}

      {e.id === "entretien" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 8 }}>
            <div><label style={NEO_LAB}>Note /20</label><input style={NEO_INP} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Ex. 14" /></div>
            <div><label style={NEO_LAB}>Avis du jury</label>
              <select style={NEO_INP} value={avis} onChange={(ev) => setAvis(ev.target.value)}><option value="">—</option><option>Favorable</option><option>Réservé</option><option>Défavorable</option></select></div>
            <div><label style={NEO_LAB}>Membres du jury</label><input style={NEO_INP} value={jury} onChange={(ev) => setJury(ev.target.value)} placeholder="Noms" /></div>
          </div>
          <label style={NEO_LAB}>Commentaire (motivation, maturité, connaissance des règles…)</label>
          <textarea style={{ ...NEO_INP, minHeight: 60 }} value={texte} onChange={(ev) => setTexte(ev.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={occupe || !noteValide || !avis} onClick={() => maj({ statut: avis === "Défavorable" || n20() < 10 ? "echoue" : "reussi", note: n20(), sur: 20, avis, jury, commentaire: texte })} style={BTN_OK}>Valider l'entretien</button>
            {st !== "a-faire" && <button type="button" disabled={occupe} onClick={() => maj({ statut: "a-faire" })} style={BTN}>Réinitialiser</button>}
          </div>
        </div>
      )}

      {e.id === "medical" && (
        <div style={{ marginTop: 8 }}>
          <label style={NEO_LAB}>Observations / motif d'inaptitude</label>
          <input style={NEO_INP} value={motif} onChange={(ev) => setMotif(ev.target.value)} placeholder="Ex. vue, audition, aptitude physique…" />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={occupe} onClick={() => maj({ statut: "apte", motif })} style={BTN_OK}>🩺 Déclarer apte</button>
            <button type="button" disabled={occupe || !motif.trim()} onClick={() => maj({ statut: "inapte", motif })} style={BTN_KO}>Déclarer inapte (motif requis)</button>
            {st !== "a-faire" && <button type="button" disabled={occupe} onClick={() => maj({ statut: "a-faire" })} style={BTN}>Réinitialiser</button>}
          </div>
        </div>
      )}

      {e.id === "moralite" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={relancerCasier} style={BTN}>🔎 Vérifier le casier (TAJ / CJN)</button>
            {verif && <span style={{ fontSize: 12.5, color: N.encre }}>{verif}</span>}
          </div>
          <label style={NEO_LAB}>Comportement et fréquentations (enquête)</label>
          <textarea style={{ ...NEO_INP, minHeight: 56 }} value={texte} onChange={(ev) => setTexte(ev.target.value)} placeholder="Sanctions sur le serveur, comportement, signalements, antécédents…" />
          <label style={NEO_LAB}>Motif si non conforme</label>
          <input style={NEO_INP} value={motif} onChange={(ev) => setMotif(ev.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={occupe} onClick={() => maj({ statut: "conforme", commentaire: texte })} style={BTN_OK}>✅ Conforme</button>
            <button type="button" disabled={occupe || !motif.trim()} onClick={() => maj({ statut: "non-conforme", commentaire: texte, motif })} style={BTN_KO}>⛔ Non conforme (éliminatoire)</button>
            {st !== "a-faire" && <button type="button" disabled={occupe} onClick={() => maj({ statut: "a-faire" })} style={BTN}>Réinitialiser</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Admis & liste d'attente ─────────────────────────
function AdmisAttente({ candidats, selections, sauver, dit, onUpdateStatut }) {
  const [occupe, setOccupe] = useState(false);
  const classe = (d) => candidats.filter((c) => selections[c.ref] && selections[c.ref].decision === d)
    .sort((a, b) => (moyenneSelection(selections[b.ref]) || 0) - (moyenneSelection(selections[a.ref]) || 0));
  const admis = classe("admis"); const attente = classe("liste-attente");
  async function promouvoir(c) {
    setOccupe(true);
    try { await sauver(c, { ...selections[c.ref], decision: "admis", decideLe: new Date().toISOString() }); dit(`${nomCandidat(c)} passe de la liste d'attente aux admis.`); }
    catch (e) { console.error(e); dit("Échec.", "danger"); }
    setOccupe(false);
  }
  const ligne = (c, i, rang) => {
    const s = selections[c.ref]; const moy = moyenneSelection(s); const fil = FILIERES[s.filiere || "terrain"];
    return (
      <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid #EEF2F8", flexWrap: "wrap" }}>
        {rang && <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#E0A02B", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{i + 1}</span>}
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: N.encre }}>{nomCandidat(c)}</div>
          <div style={{ fontSize: 12, color: N.gris }}>{c.poste} · <span style={{ color: fil.couleur, fontWeight: 800 }}>{fil.label}</span></div>
        </div>
        <b style={{ color: N.encre }}>{moy !== null ? String(moy).replace(".", ",") + "/20" : "—"}</b>
        {rang ? <button type="button" disabled={occupe} onClick={() => promouvoir(c)} style={BTN_OK}>Admettre</button> : c.statut !== "Acceptée" && onUpdateStatut ? <button type="button" onClick={() => onUpdateStatut(c, "Acceptée")} style={BTN_OK}>🎖️ Accepter</button> : <span style={{ fontSize: 12, color: "#1F6B42" }}>✔ acceptée</span>}
      </div>
    );
  };
  return (
    <>
      <NeoCarte titre={`Admis (${admis.length})`}>{!admis.length && <div style={{ color: N.gris, fontSize: 13 }}>Aucun admis pour le moment.</div>}{admis.map((c, i) => ligne(c, i, false))}</NeoCarte>
      <NeoCarte titre={`Liste d'attente (${attente.length})`} droite={<span style={{ fontSize: 12, color: N.gris }}>classée par moyenne</span>}>{!attente.length && <div style={{ color: N.gris, fontSize: 13 }}>Personne en liste d'attente.</div>}{attente.map((c, i) => ligne(c, i, true))}</NeoCarte>
    </>
  );
}

// ───────────────────────── Épreuves en ligne (banque de questions) ─────────────────────────
function EpreuvesAdmin({ epreuves, setEpreuves, dit }) {
  const [edit, setEdit] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [import_, setImport] = useState("");
  // Domaines évalués par le CEGN : une épreuve dont le « type » est un domaine devient un test de formation pour les recrues
  const [domaines, setDomaines] = useState(lireConfigAmgn(null).domaines);
  useEffect(() => { getDoc(doc(db, "amgn_config", "general")).then((sn) => setDomaines(lireConfigAmgn(sn.exists() ? sn.data() : null).domaines)).catch(() => {}); }, []);
  const domaineDe = (type) => domaines.find((d) => d.id === type);

  const nouvelle = (type) => ({ id: "", titre: type === "ecrit" ? "Épreuve écrite" : type === "psycho" ? "Tests psychotechniques" : `Test de formation — ${(domaineDe(type) || {}).nom || type}`, type, filieres: ["terrain", "reserve"], dureeMin: 15, nbQuestions: 0, seuil: 10, actif: true, consigne: "", questions: [] });
  async function enregistrer() {
    const e = edit;
    if (!e.titre.trim()) { dit("Donne un titre à l'épreuve.", "attention"); return; }
    const questions = e.questions.filter((q) => q.q.trim() && q.choix.filter((x) => x.trim()).length >= 2).map((q) => ({ q: q.q.trim(), choix: q.choix.map((x) => x.trim()).filter(Boolean), bonne: Math.min(Math.max(0, Number(q.bonne) || 0), q.choix.filter((x) => x.trim()).length - 1) }));
    if (!questions.length) { dit("Ajoute au moins une question complète (énoncé + 2 choix).", "attention"); return; }
    const id = e.id || "ep" + Date.now().toString(36);
    const donnees = { titre: e.titre.trim(), type: e.type, filieres: e.filieres, dureeMin: Number(e.dureeMin) || 15, nbQuestions: Number(e.nbQuestions) || 0, seuil: Number(e.seuil) || 10, actif: e.actif !== false, consigne: e.consigne || "", questions };
    setOccupe(true);
    try {
      await setDoc(doc(db, "selection_epreuves", id), donnees);
      setEpreuves((prev) => [...prev.filter((x) => x.id !== id), { id, ...donnees }]);
      setEdit(null); dit("Épreuve enregistrée.");
    } catch (err) { console.error(err); dit("Échec de l'enregistrement.", "danger"); }
    setOccupe(false);
  }
  async function supprimer(e) {
    if (!window.confirm(`Supprimer « ${e.titre} » ?`)) return;
    try { await deleteDoc(doc(db, "selection_epreuves", e.id)); setEpreuves((prev) => prev.filter((x) => x.id !== e.id)); dit("Épreuve supprimée."); } catch (err) { console.error(err); dit("Échec.", "danger"); }
  }
  async function exemples() {
    if (!window.confirm("Ajouter les épreuves d'exemple (écrit, psychotechnique et 3 tests de formation pour les recrues) ?")) return;
    setOccupe(true);
    try {
      for (const ex of EPREUVES_EXEMPLES) {
        const id = "ex-" + ex.type;
        await setDoc(doc(db, "selection_epreuves", id), ex);
        setEpreuves((prev) => [...prev.filter((x) => x.id !== id), { id, ...ex }]);
      }
      dit("Épreuves d'exemple ajoutées : modifie-les à ta guise.");
    } catch (err) { console.error(err); dit("Échec : règles Firestore publiées ?", "danger"); }
    setOccupe(false);
  }

  if (edit) {
    const maj = (p) => setEdit((e) => ({ ...e, ...p }));
    const majQ = (i, p) => maj({ questions: edit.questions.map((q, k) => (k === i ? { ...q, ...p } : q)) });
    return (
      <NeoCarte titre={edit.id ? "Modifier l'épreuve" : "Nouvelle épreuve"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}><label style={NEO_LAB}>Titre</label><input style={NEO_INP} value={edit.titre} onChange={(e) => maj({ titre: e.target.value })} /></div>
          <div><label style={NEO_LAB}>Type</label><select style={NEO_INP} value={edit.type} onChange={(e) => maj({ type: e.target.value })}><option value="ecrit">Candidats : épreuve écrite</option><option value="psycho">Candidats : test psychotechnique</option>{domaines.map((d) => <option key={d.id} value={d.id}>Recrues CEGN : {d.nom}</option>)}</select></div>
          <div><label style={NEO_LAB}>Durée (minutes)</label><input style={NEO_INP} type="number" min="1" value={edit.dureeMin} onChange={(e) => maj({ dureeMin: e.target.value })} /></div>
          <div><label style={NEO_LAB}>Questions tirées au sort (0 = toutes)</label><input style={NEO_INP} type="number" min="0" value={edit.nbQuestions} onChange={(e) => maj({ nbQuestions: e.target.value })} /></div>
          <div><label style={NEO_LAB}>Seuil de réussite (/20)</label><input style={NEO_INP} type="number" min="1" max="20" value={edit.seuil} onChange={(e) => maj({ seuil: e.target.value })} /></div>
        </div>
        <label style={NEO_LAB}>Proposée aux filières</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(FILIERES).map(([id, f]) => { const on = edit.filieres.includes(id); return <button key={id} type="button" onClick={() => maj({ filieres: on ? edit.filieres.filter((x) => x !== id) : [...edit.filieres, id] })} style={{ ...BTN, background: on ? f.couleur : "#fff", color: on ? "#fff" : f.couleur, borderColor: f.couleur }}>{on ? "✓ " : ""}{f.label}</button>; })}
          <button type="button" onClick={() => maj({ actif: !edit.actif })} style={{ ...BTN, marginLeft: "auto", background: edit.actif ? "#1F9D55" : "#fff", color: edit.actif ? "#fff" : "#1F6B42", borderColor: "#1F9D55" }}>{edit.actif ? "● Active" : "○ Désactivée"}</button>
        </div>
        <label style={NEO_LAB}>Consigne affichée au candidat</label>
        <input style={NEO_INP} value={edit.consigne} onChange={(e) => maj({ consigne: e.target.value })} placeholder="Ex. Réponds seul(e), sans aide." />
        <div style={{ marginTop: 14, fontWeight: 800, color: N.encre }}>Questions ({edit.questions.length})</div>
        {edit.questions.map((q, i) => (
          <div key={i} style={{ border: "1px solid #E1E8F2", borderRadius: 12, padding: 10, marginTop: 8, background: "#FAFCFF" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...NEO_INP, flex: 1 }} placeholder={`Question ${i + 1}`} value={q.q} onChange={(e) => majQ(i, { q: e.target.value })} />
              <button type="button" onClick={() => maj({ questions: edit.questions.filter((_, k) => k !== i) })} style={BTN_KO}>✕</button>
            </div>
            {q.choix.map((ch, k) => (
              <div key={k} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <input type="radio" name={`b${i}`} checked={Number(q.bonne) === k} onChange={() => majQ(i, { bonne: k })} title="Bonne réponse" />
                <input style={{ ...NEO_INP, flex: 1 }} placeholder={`Choix ${k + 1}`} value={ch} onChange={(e) => majQ(i, { choix: q.choix.map((x, m) => (m === k ? e.target.value : x)) })} />
                {q.choix.length > 2 && <button type="button" onClick={() => majQ(i, { choix: q.choix.filter((_, m) => m !== k), bonne: Number(q.bonne) === k ? 0 : Number(q.bonne) > k ? Number(q.bonne) - 1 : q.bonne })} style={{ ...BTN, padding: "4px 9px" }}>−</button>}
              </div>
            ))}
            {q.choix.length < 6 && <button type="button" onClick={() => majQ(i, { choix: [...q.choix, ""] })} style={{ ...BTN, marginTop: 6, padding: "4px 10px" }}>+ choix</button>}
            <div style={{ fontSize: 11.5, color: N.gris, marginTop: 4 }}>Coche le rond de la bonne réponse.</div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={() => maj({ questions: [...edit.questions, { q: "", choix: ["", "", "", ""], bonne: 0 }] })} style={BTN}>➕ Ajouter une question</button>
        </div>
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 800, color: "#123A7A", fontSize: 13 }}>Importer plusieurs questions en texte</summary>
          <div style={{ fontSize: 12, color: N.gris, margin: "6px 0" }}>Une question par bloc (ligne vide entre deux). « - » devant un choix, « * » devant la bonne réponse.</div>
          <textarea style={{ ...NEO_INP, minHeight: 130, fontFamily: "ui-monospace, monospace" }} value={import_} onChange={(e) => setImport(e.target.value)} placeholder={"Quelle est la capitale de la France ?\n- Lyon\n* Paris\n- Marseille"} />
          <button type="button" style={{ ...BTN, marginTop: 6 }} onClick={() => { const l = lireQuestionsTexte(import_); if (!l.length) { dit("Aucune question reconnue : vérifie le format.", "attention"); return; } maj({ questions: [...edit.questions, ...l] }); setImport(""); dit(`${l.length} question(s) importée(s).`); }}>Importer</button>
        </details>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <NeoBouton disabled={occupe} onClick={enregistrer}>💾 Enregistrer l'épreuve</NeoBouton>
          <button type="button" onClick={() => setEdit(null)} style={BTN}>Annuler</button>
        </div>
      </NeoCarte>
    );
  }
  return (
    <>
      <NeoAlerte ton="info" icone="🔒">Les bonnes réponses restent sur le serveur : le candidat ne reçoit que les questions, et la correction est faite automatiquement.</NeoAlerte>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <NeoBouton onClick={() => setEdit(nouvelle("ecrit"))}>➕ Épreuve écrite</NeoBouton>
        <NeoBouton onClick={() => setEdit(nouvelle("psycho"))}>➕ Test psychotechnique</NeoBouton>
        <NeoBouton onClick={() => setEdit(nouvelle(domaines[0].id))}>➕ Test de formation (recrues)</NeoBouton>
        <button type="button" disabled={occupe} onClick={exemples} style={BTN}>📚 Ajouter des épreuves d'exemple</button>
      </div>
      {!epreuves.length && <NeoAlerte ton="attention" icone="ℹ️">Aucune épreuve pour le moment : sans épreuve, un candidat ne peut pas passer l'écrit ni les tests en ligne. Ajoute les exemples pour démarrer.</NeoAlerte>}
      {epreuves.map((e) => (
        <NeoCarte key={e.id} style={{ padding: "12px 16px", opacity: e.actif === false ? 0.6 : 1 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 22 }}>{e.type === "ecrit" ? "📝" : e.type === "psycho" ? "🧠" : (domaineDe(e.type) || {}).icone || "🎓"}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 800, color: N.encre }}>{e.titre}</div>
              <div style={{ fontSize: 12, color: N.gris }}>{(e.questions || []).length} questions{e.nbQuestions ? ` (${e.nbQuestions} tirées)` : ""} · {e.dureeMin} min · seuil {e.seuil}/20 · {e.type !== "ecrit" && e.type !== "psycho" ? `recrues CEGN : ${(domaineDe(e.type) || {}).nom || e.type}` : ""}{e.type === "ecrit" || e.type === "psycho" ? ((e.filieres || []).map((f) => (FILIERES[f] || {}).label).join(" + ") || "toutes filières") : ""}{e.actif === false ? " · désactivée" : ""}</div>
            </div>
            <button type="button" onClick={() => setEdit({ ...e, questions: (e.questions || []).map((q) => ({ ...q, choix: [...q.choix] })), filieres: e.filieres || [] })} style={BTN}>Modifier</button>
            <button type="button" onClick={() => supprimer(e)} style={BTN_KO}>Supprimer</button>
          </div>
        </NeoCarte>
      ))}
    </>
  );
}
