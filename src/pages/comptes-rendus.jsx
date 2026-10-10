// pages/comptes-rendus.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useState } from "react";
import { ArchiveTabs, BarreTemps, Field, buttonPrimary, h2Style, labelStyle, smallBtn } from "../composants/ui.jsx";
import { FONT_TITRE, UNITE_CMD, UNITE_ENC, estCommandement, estCorps } from "../lib/constantes.js";
import { cleJour, dateCourteFR, fmtJourFR } from "../lib/utils.js";

/* ---------- Comptes rendus internes à l'attention de l'IGGN / DGGN ---------- */

const DESTINATAIRES_CR = [UNITE_ENC, UNITE_CMD];

/* ---------- Journal d'activité (admin) ---------- */

/* ---------- Comptes rendus d'intervention (à la demande) et rapports internes ---------- */

const GRAVITES_RAPPORT = ["Information", "Important", "Urgent"];
const COUL_GRAVITE = { Information: "#2F6FDE", Important: "#B25E00", Urgent: "#C0172D" };

// Demandes de compte rendu qui attendent encore une réponse de cette personne
export function demandesAFaire(demandes, comptesRendus, personne) {
  if (!personne) return [];
  return demandes.filter((d) => !d.cloturee && (d.cibleUids || []).includes(personne.id) && !comptesRendus.some((c) => c.demandeId === d.id && c.auteurMatricule === personne.matricule));
}

// Message affiché à la connexion
export function PopupDemandesCR({ demandes, onOpen, onLater }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(7,20,46,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "26px 26px 22px", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)", borderTop: "6px solid #B25E00" }}>
        <div style={{ fontSize: 34, textAlign: "center" }}>📝</div>
        <div style={{ fontFamily: FONT_TITRE, fontSize: 22, fontWeight: 700, textAlign: "center", color: "#14213A", marginBottom: 6 }}>Compte rendu demandé</div>
        <div style={{ fontSize: 13.5, color: "#3A4D6B", textAlign: "center", marginBottom: 16, lineHeight: 1.5 }}>Le commandement te demande de rédiger {demandes.length > 1 ? `${demandes.length} comptes rendus` : "un compte rendu"} :</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {demandes.map((d) => (
            <div key={d.id} style={{ background: "#FFF4E0", border: "1px solid #E8D28A", borderRadius: 10, padding: "10px 13px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#14213A" }}>{d.intervention}</div>
              <div style={{ fontSize: 12, color: "#6B4E00", marginTop: 3 }}>
                {d.dateIntervention ? `Intervention du ${fmtJourFR(d.dateIntervention)}` : "Date non précisée"} · demandé par {d.demandeParNom}
                {d.echeance ? ` · à rendre avant le ${fmtJourFR(d.echeance)}` : ""}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onOpen} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "10px 24px", marginTop: 0, background: "#B25E00" }}>Rédiger maintenant</button>
          <button onClick={onLater} style={{ ...smallBtn, padding: "10px 20px" }}>Plus tard</button>
        </div>
      </div>
    </div>
  );
}

// Le commandement / l'encadrement demande un compte rendu à un ou plusieurs gendarmes
function DemandeCRForm({ personnel, current, onCreate, onCancel }) {
  const blank = { intervention: "", dateIntervention: cleJour(new Date()), lieu: "", consignes: "", echeance: "", cibles: [] };
  const [form, setForm] = useState(blank);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const candidats = personnel.filter((p) => p.matricule && norm(`${p.prenom} ${p.nom} ${p.grade}`).includes(norm(recherche)));
  const choisi = (p) => form.cibles.some((c) => c.uid === p.id);
  const bascule = (p) => setForm({ ...form, cibles: choisi(p) ? form.cibles.filter((c) => c.uid !== p.id) : [...form.cibles, { uid: p.id, matricule: p.matricule, nom: `${p.prenom} ${p.nom}` }] });

  async function submit(e) {
    e.preventDefault();
    if (form.intervention.trim().length < 3) { setErreur("Indique l'intervention concernée."); return; }
    if (form.cibles.length === 0) { setErreur("Choisis au moins un gendarme."); return; }
    if (form.cibles.length > 30) { setErreur("30 gendarmes au maximum par demande."); return; }
    setErreur(""); setBusy(true);
    const ok = await onCreate(form);
    setBusy(false);
    if (ok) { setForm(blank); onCancel(); } else setErreur("Impossible d'envoyer la demande, réessaie.");
  }
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, fontFamily: FONT_TITRE }}>Demander un compte rendu</div>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 14 }}>Les gendarmes choisis recevront un message à leur prochaine connexion pour rédiger ce compte rendu.</div>
      <form onSubmit={submit}>
        <Field label="Intervention concernée" value={form.intervention} onChange={(v) => setForm({ ...form, intervention: v })} placeholder="Ex : Course-poursuite du 8 octobre, braquage de la banque…" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Date de l'intervention" type="date" value={form.dateIntervention} onChange={(v) => setForm({ ...form, dateIntervention: v })} />
          <Field label="Lieu (facultatif)" value={form.lieu} onChange={(v) => setForm({ ...form, lieu: v })} />
          <Field label="À rendre avant (facultatif)" type="date" value={form.echeance} onChange={(v) => setForm({ ...form, echeance: v })} />
        </div>
        <Field label="Consignes (facultatif)" textarea value={form.consignes} onChange={(v) => setForm({ ...form, consignes: v })} placeholder="Ce que tu attends dans le compte rendu…" />
        <label style={labelStyle}>Gendarmes concernés ({form.cibles.length} sélectionné{form.cibles.length > 1 ? "s" : ""})</label>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un gendarme…" style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, marginBottom: 8 }} />
        <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #D3DDEA", borderRadius: 8, padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 7, marginBottom: 14 }}>
          {candidats.map((p) => (
            <label key={p.id} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={choisi(p)} onChange={() => bascule(p)} /> {p.grade ? `${p.grade} ` : ""}{p.prenom} {p.nom}
            </label>
          ))}
          {candidats.length === 0 && <span style={{ fontSize: 12.5, color: "#5A6B84" }}>Aucun gendarme trouvé.</span>}
        </div>
        {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" disabled={busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 20px", marginTop: 0 }}>{busy ? "Envoi…" : "Envoyer la demande"}</button>
          <button type="button" onClick={onCancel} style={{ ...smallBtn, padding: "9px 16px" }}>Annuler</button>
        </div>
      </form>
    </div>
  );
}

// Le gendarme rédige le compte rendu demandé
function FormCRIntervention({ demande, onSubmit, onCancel }) {
  const [f, setF] = useState({ heure: "", effectifs: "", deroulement: "", personnes: "", bilan: "" });
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  const LIM = { effectifs: 300, deroulement: 2500, personnes: 600, bilan: 1000 };
  const compteur = (k) => <div style={{ fontSize: 11, color: f[k].length > LIM[k] ? "#C0172D" : "#7B8AA3", margin: "-6px 0 10px", textAlign: "right" }}>{f[k].length} / {LIM[k]}</div>;

  async function submit(e) {
    e.preventDefault();
    if (f.deroulement.trim().length < 20) { setErreur("Décris le déroulement de l'intervention (20 caractères minimum)."); return; }
    if (Object.keys(LIM).some((k) => f[k].length > LIM[k])) { setErreur("Un des champs est trop long."); return; }
    setErreur(""); setBusy(true);
    await onSubmit(demande, f);
    setBusy(false);
  }
  return (
    <form onSubmit={submit} style={{ background: "#F5F8FC", border: "1px solid #C3D0E2", borderRadius: 12, padding: 18, marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
        <Field label="Heure des faits" type="time" value={f.heure} onChange={(v) => setF({ ...f, heure: v })} />
        <Field label="Effectifs et moyens engagés" value={f.effectifs} onChange={(v) => setF({ ...f, effectifs: v })} placeholder="Agents présents, véhicules, matériel…" />
      </div>
      {compteur("effectifs")}
      <Field label="Déroulement de l'intervention" textarea value={f.deroulement} onChange={(v) => setF({ ...f, deroulement: v })} placeholder="Décris les faits dans l'ordre : ce qui s'est passé, ce que tu as fait…" />
      {compteur("deroulement")}
      <Field label="Personnes concernées (facultatif)" textarea value={f.personnes} onChange={(v) => setF({ ...f, personnes: v })} placeholder="Suspects, victimes, témoins…" />
      {compteur("personnes")}
      <Field label="Bilan et suites données" textarea value={f.bilan} onChange={(v) => setF({ ...f, bilan: v })} placeholder="Interpellations, PV rédigés, amendes, blessés…" />
      {compteur("bilan")}
      {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 20px", marginTop: 0 }}>{busy ? "Envoi…" : "Envoyer le compte rendu"}</button>
        <button type="button" onClick={onCancel} style={{ ...smallBtn, padding: "9px 16px" }}>Annuler</button>
      </div>
    </form>
  );
}

function CarteCR({ cr, canTraiter, onMarkTraite }) {
  const ch = cr.champs || null;
  const ligne = (l, v) => (v ? <div style={{ marginTop: 8 }}><div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700 }}>{l}</div><div style={{ fontSize: 13, color: "#14213A", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{v}</div></div> : null);
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${cr.type === "intervention" ? "#B25E00" : "#8FA0B8"}`, borderRadius: 12, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: 14 }}>{cr.objet}</b>
        <span style={{ fontSize: 11.5, color: "#5A6B84" }}>{dateCourteFR(cr.createdAt)}{cr.demandeRef ? ` · ${cr.demandeRef}` : ""}</span>
      </div>
      <div style={{ fontSize: 11.5, color: "#2F6FDE", marginTop: 3 }}>Rédigé par {cr.auteurNom} ({cr.auteurMatricule}){cr.destinataire ? ` · à ${cr.destinataire}` : ""}</div>
      {ch ? (
        <>
          {ligne("Heure des faits", ch.heure)}
          {ligne("Effectifs et moyens", ch.effectifs)}
          {ligne("Déroulement", ch.deroulement)}
          {ligne("Personnes concernées", ch.personnes)}
          {ligne("Bilan et suites", ch.bilan)}
        </>
      ) : <div style={{ fontSize: 13, color: "#3A4D6B", marginTop: 8, whiteSpace: "pre-wrap" }}>{cr.contenu}</div>}
      {canTraiter && !cr.traite && <button onClick={() => onMarkTraite(cr.id)} style={{ ...smallBtn, marginTop: 12, background: "#123A7A", color: "#fff" }}>Marquer comme traité</button>}
      {cr.traite && <div style={{ fontSize: 11.5, color: "#1F6B42", marginTop: 10, fontWeight: 600 }}>✅ Traité</div>}
    </div>
  );
}

export function CompteRenduPage({ current, personnel, demandes, comptesRendus, onCreateDemande, onCloseDemande, onSubmitCR, onMarkTraite }) {
  const peutDemander = current.isAdmin || estCorps(current.unite);
  const aFaire = demandesAFaire(demandes, comptesRendus, current);
  const miens = comptesRendus.filter((c) => c.auteurMatricule === current.matricule);
  const [tab, setTab] = useState(aFaire.length > 0 ? "a-rediger" : peutDemander ? "suivi" : "mes");
  const [ouvertId, setOuvertId] = useState(null);
  const [nouvelle, setNouvelle] = useState(false);
  const [suiviClos, setSuiviClos] = useState(false);
  const [recuTab, setRecuTab] = useState("en-cours");
  const auj = cleJour(new Date());

  const recus = comptesRendus.filter((c) => (recuTab === "en-cours" ? !c.traite : c.traite)).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const suivi = demandes.filter((d) => (suiviClos ? d.cloturee : !d.cloturee)).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const onglets = [
    { id: "a-rediger", label: `À rédiger (${aFaire.length})` },
    { id: "mes", label: `Mes comptes rendus (${miens.length})` },
    ...(peutDemander ? [{ id: "suivi", label: "Suivi des demandes" }, { id: "recus", label: "Comptes rendus reçus" }] : []),
  ];

  async function envoyer(demande, f) {
    const ok = await onSubmitCR(demande, f);
    if (ok) { setOuvertId(null); setTab("mes"); }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={h2Style}>Comptes rendus</h2>
      {peutDemander && (nouvelle
        ? <DemandeCRForm personnel={personnel} current={current} onCreate={onCreateDemande} onCancel={() => setNouvelle(false)} />
        : <button onClick={() => setNouvelle(true)} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 20px", marginBottom: 18, marginTop: 0 }}>+ Demander un compte rendu</button>)}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {onglets.map((o) => <button key={o.id} onClick={() => setTab(o.id)} style={{ ...smallBtn, background: tab === o.id ? "#123A7A" : "transparent", color: tab === o.id ? "#fff" : "#14213A", borderColor: tab === o.id ? "#123A7A" : "#C3D0E2" }}>{o.label}</button>)}
      </div>

      {tab === "a-rediger" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {aFaire.map((d) => {
            const enRetard = d.echeance && d.echeance < auj;
            return (
              <div key={d.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${enRetard ? "#C0172D" : "#B25E00"}`, borderRadius: 12, padding: "16px 18px", boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{d.intervention}</div>
                  {d.echeance && <span style={{ fontSize: 11.5, fontWeight: 700, color: enRetard ? "#C0172D" : "#B25E00", background: enRetard ? "#FDECEC" : "#FFF4E0", borderRadius: 14, padding: "3px 10px" }}>{enRetard ? "⚠️ En retard — " : "À rendre avant le "}{fmtJourFR(d.echeance)}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 3 }}>
                  {d.dateIntervention ? `Intervention du ${fmtJourFR(d.dateIntervention)}` : ""}{d.lieu ? ` · ${d.lieu}` : ""} · demandé par {d.demandeParNom} le {dateCourteFR(d.createdAt)}
                </div>
                {d.consignes && <div style={{ fontSize: 13, color: "#3A4D6B", background: "#F5F8FC", borderRadius: 8, padding: "8px 11px", marginTop: 10, whiteSpace: "pre-wrap" }}><b>Consignes :</b> {d.consignes}</div>}
                {ouvertId === d.id
                  ? <FormCRIntervention demande={d} onSubmit={envoyer} onCancel={() => setOuvertId(null)} />
                  : <button onClick={() => setOuvertId(d.id)} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 12, background: "#B25E00" }}>Rédiger le compte rendu</button>}
              </div>
            );
          })}
          {aFaire.length === 0 && <div style={{ background: "#E3F2E8", border: "1px solid #2E7D4F", color: "#1F6B42", borderRadius: 12, padding: "16px 18px", fontSize: 14, fontWeight: 600 }}>✅ Aucun compte rendu ne t'est demandé pour le moment.</div>}
        </div>
      )}

      {tab === "mes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {miens.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((c) => <CarteCR key={c.id} cr={c} />)}
          {miens.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Tu n'as encore rédigé aucun compte rendu.</div>}
        </div>
      )}

      {tab === "suivi" && peutDemander && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button onClick={() => setSuiviClos(false)} style={{ ...smallBtn, background: !suiviClos ? "#123A7A" : "transparent", color: !suiviClos ? "#fff" : "#14213A" }}>En cours</button>
            <button onClick={() => setSuiviClos(true)} style={{ ...smallBtn, background: suiviClos ? "#123A7A" : "transparent", color: suiviClos ? "#fff" : "#14213A" }}>Clôturées</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {suivi.map((d) => {
              const lignes = (d.cibles || []).map((c) => ({ c, cr: comptesRendus.find((x) => x.demandeId === d.id && x.auteurMatricule === c.matricule) }));
              const faits = lignes.filter((l) => l.cr).length;
              const retard = d.echeance && d.echeance < auj && faits < lignes.length;
              return (
                <div key={d.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${faits === lignes.length ? "#2E7D4F" : retard ? "#C0172D" : "#B25E00"}`, borderRadius: 12, padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{d.intervention} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#123A7A", background: "#E9EFF7", padding: "2px 7px", borderRadius: 5, marginLeft: 4 }}>{d.ref}</span></div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: faits === lignes.length ? "#1F6B42" : "#14213A" }}>{faits} / {lignes.length} reçu{faits > 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#5A6B84", margin: "3px 0 8px" }}>Demandé par {d.demandeParNom} le {dateCourteFR(d.createdAt)}{d.echeance ? ` · avant le ${fmtJourFR(d.echeance)}` : ""}{retard ? " · ⚠️ en retard" : ""}</div>
                  <BarreTemps ms={faits} max={Math.max(1, lignes.length)} couleur={faits === lignes.length ? "#2E7D4F" : "#B25E00"} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                    {lignes.map(({ c, cr }) => <span key={c.uid} style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 14, background: cr ? "#E3F2E8" : "#FFF4E0", color: cr ? "#1F6B42" : "#8A5A00" }}>{cr ? "✅" : "⏳"} {c.nom}</span>)}
                  </div>
                  {!d.cloturee && <button onClick={() => { if (window.confirm("Clôturer cette demande ? Elle n'apparaîtra plus aux gendarmes qui n'ont pas répondu.")) onCloseDemande(d.id); }} style={{ ...smallBtn, marginTop: 12 }}>Clôturer la demande</button>}
                </div>
              );
            })}
            {suivi.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>{suiviClos ? "Aucune demande clôturée." : "Aucune demande en cours."}</div>}
          </div>
        </div>
      )}

      {tab === "recus" && peutDemander && (
        <div>
          <ArchiveTabs tab={recuTab} setTab={setRecuTab} countEnCours={comptesRendus.filter((c) => !c.traite).length} countArchivees={comptesRendus.filter((c) => c.traite).length} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recus.map((c) => <CarteCR key={c.id} cr={c} canTraiter onMarkTraite={onMarkTraite} />)}
            {recus.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>{recuTab === "en-cours" ? "Aucun compte rendu à traiter." : "Aucun compte rendu traité."}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// Rapports internes : tout gendarme peut signaler quelque chose ; seuls le Corps de Commandement et les admins les lisent
export function RapportsInternesPage({ current, rapports, onCreate, onUpdate }) {
  const lecteur = current.isAdmin || estCommandement(current.unite);
  const blank = { objet: "", gravite: "Information", contenu: "" };
  const [form, setForm] = useState(blank);
  const [erreur, setErreur] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [filtre, setFiltre] = useState("A traiter");
  const [reponses, setReponses] = useState({});
  const miens = rapports.filter((r) => r.auteurMatricule === current.matricule);
  const liste = (lecteur ? rapports : miens).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const affiches = lecteur ? liste.filter((r) => (filtre === "A traiter" ? r.statut !== "Pris en compte" : r.statut === "Pris en compte")) : liste;
  const nouveaux = rapports.filter((r) => r.statut === "Nouveau").length;

  async function submit(e) {
    e.preventDefault();
    if (form.objet.trim().length < 3) { setErreur("Indique l'objet du rapport."); return; }
    if (form.contenu.trim().length < 20) { setErreur("Décris la situation (20 caractères minimum)."); return; }
    if (form.contenu.length > 4500) { setErreur("Le rapport est trop long (4 500 caractères maximum)."); return; }
    setErreur(""); setBusy(true);
    const ok = await onCreate(form);
    setBusy(false);
    if (ok) { setForm(blank); setMsg("Rapport transmis au Corps de Commandement."); setTimeout(() => setMsg(""), 6000); }
    else setErreur("Impossible d'envoyer le rapport, réessaie.");
  }
  const badgeStatut = (s) => <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 14, padding: "3px 10px", background: s === "Pris en compte" ? "#E3F2E8" : s === "Lu" ? "#E6EDF7" : "#FFF4E0", color: s === "Pris en compte" ? "#1F6B42" : s === "Lu" ? "#123A7A" : "#8A5A00" }}>{s}</span>;

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={h2Style}>Rapports internes</h2>
      <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 26, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, fontFamily: FONT_TITRE }}>Signaler quelque chose</div>
        <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 14, lineHeight: 1.5 }}>🔒 Ce rapport sera lu <b>uniquement par le Corps de Commandement</b>. Utilise-le pour signaler un problème, un comportement ou une situation.</div>
        <form onSubmit={submit}>
          <Field label="Objet" value={form.objet} onChange={(v) => setForm({ ...form, objet: v })} placeholder="Ex : Problème de matériel, comportement d'un agent…" />
          <label style={labelStyle}>Gravité</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {GRAVITES_RAPPORT.map((g) => <button type="button" key={g} onClick={() => setForm({ ...form, gravite: g })} style={{ border: `1.5px solid ${COUL_GRAVITE[g]}`, background: form.gravite === g ? COUL_GRAVITE[g] : "#fff", color: form.gravite === g ? "#fff" : COUL_GRAVITE[g], borderRadius: 20, padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{g}</button>)}
          </div>
          <Field label="Description" textarea value={form.contenu} onChange={(v) => setForm({ ...form, contenu: v })} placeholder="Explique clairement ce que tu souhaites signaler…" />
          {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
          {msg && <div style={{ color: "#2E7D4F", fontSize: 12.5, marginBottom: 10, fontWeight: 600 }}>{msg}</div>}
          <button type="submit" disabled={busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 20px", marginTop: 0 }}>{busy ? "Envoi…" : "Envoyer le rapport"}</button>
        </form>
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 10 }}>{lecteur ? `Rapports reçus (${nouveaux} nouveau${nouveaux > 1 ? "x" : ""})` : "Mes rapports envoyés"}</div>
      {lecteur && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {["A traiter", "Traités"].map((f) => <button key={f} onClick={() => setFiltre(f)} style={{ ...smallBtn, background: filtre === f ? "#123A7A" : "transparent", color: filtre === f ? "#fff" : "#14213A" }}>{f === "A traiter" ? "À traiter" : "Pris en compte"}</button>)}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affiches.map((r) => (
          <div key={r.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${COUL_GRAVITE[r.gravite] || "#2F6FDE"}`, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{r.objet} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#123A7A", background: "#E9EFF7", padding: "2px 7px", borderRadius: 5, marginLeft: 4 }}>{r.ref}</span></div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ background: COUL_GRAVITE[r.gravite], color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 14, padding: "3px 10px" }}>{r.gravite}</span>
                {badgeStatut(r.statut)}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "#5A6B84", margin: "3px 0 8px" }}>{lecteur ? `Par ${r.auteurNom} (${r.auteurMatricule}) — ` : ""}{dateCourteFR(r.createdAt)}</div>
            <div style={{ fontSize: 13.5, color: "#14213A", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{r.contenu}</div>
            {r.reponse && <div style={{ background: "#E3F2E8", borderRadius: 8, padding: "9px 12px", marginTop: 10, fontSize: 13 }}><b>Réponse du commandement :</b> {r.reponse}</div>}
            {lecteur && (
              <div style={{ marginTop: 12 }}>
                {r.statut !== "Pris en compte" && (
                  <>
                    <Field label="Réponse (facultative, visible par l'auteur)" textarea value={reponses[r.id] || ""} onChange={(v) => setReponses({ ...reponses, [r.id]: v })} />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {r.statut === "Nouveau" && <button onClick={() => onUpdate(r.id, { statut: "Lu" })} style={smallBtn}>Marquer comme lu</button>}
                      <button onClick={() => onUpdate(r.id, { statut: "Pris en compte", reponse: (reponses[r.id] || "").trim().slice(0, 1000) })} style={{ ...smallBtn, background: "#2E7D4F", color: "#fff", borderColor: "#2E7D4F" }}>Marquer comme pris en compte</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {affiches.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>{lecteur ? "Aucun rapport dans cette liste." : "Tu n'as envoyé aucun rapport."}</div>}
      </div>
    </div>
  );
}
