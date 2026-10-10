// pages/plaintes.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useState } from "react";
import { PreuvesAffichage, PreuvesEditeur } from "../composants/Preuves.jsx";
import { ArchiveTabs, Field, FieldRow, Select, StatutBadge, buttonPrimary, h2Style, smallBtn } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE, NATURES_INFRACTION } from "../lib/constantes.js";
import { dateFR } from "../lib/utils.js";
import { FichePV } from "./pv.jsx";

/* ---------- Formulaire public : plainte ---------- */

export function PlainteForm({ onSubmit, onCancel }) {
  const blank = { plaignantPrenom: "", plaignantNom: "", plaignantPseudoRoblox: "", plaignantPseudoDiscord: "", dateFaits: "", lieuFaits: "", nature: NATURES_INFRACTION[0], misEnCause: "", temoins: "", description: "", certifie: false, preuves: [] };
  const [form, setForm] = useState(blank);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.plaignantPrenom.trim() || !form.plaignantNom.trim()) { setErreur("Indique ton prénom et ton nom."); return; }
    if (!form.plaignantPseudoRoblox.trim() && !form.plaignantPseudoDiscord.trim()) { setErreur("Indique au moins un pseudo (Roblox ou Discord) pour que la gendarmerie puisse te recontacter."); return; }
    if (form.description.trim().length < 20) { setErreur("Décris les faits plus précisément (20 caractères minimum)."); return; }
    if (!form.certifie) { setErreur("Coche la case de certification pour envoyer ta plainte."); return; }
    setErreur(""); setBusy(true);
    await onSubmit({ ...form, plaignantPrenom: form.plaignantPrenom.trim(), plaignantNom: form.plaignantNom.trim(), description: form.description.trim() });
    setBusy(false);
  }
  const bloc = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: "20px 22px", marginBottom: 16, boxShadow: "0 6px 20px -12px rgba(7,20,46,0.3)" };
  const titreBloc = (n, t) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#C0172D", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{n}</span>
      <span style={{ fontFamily: FONT_TITRE, fontSize: 17, fontWeight: 700, color: "#14213A" }}>{t}</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: FONT_TITRE, fontSize: 28, fontWeight: 700, marginBottom: 4, color: "#14213A" }}>🚨 Dépôt de plainte en ligne</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 22, lineHeight: 1.55 }}>Ce formulaire ne remplace pas un dépôt en brigade en cas d'urgence. Toute déclaration mensongère peut être sanctionnée en jeu. À la fin, tu recevras un <b>numéro de plainte</b> à conserver.</div>
        <form onSubmit={submit}>
          <div style={bloc}>
            {titreBloc(1, "Qui es-tu ?")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Prénom" value={form.plaignantPrenom} onChange={(v) => setForm({ ...form, plaignantPrenom: v })} />
              <Field label="Nom" value={form.plaignantNom} onChange={(v) => setForm({ ...form, plaignantNom: v })} />
              <Field label="Pseudo Roblox" value={form.plaignantPseudoRoblox} onChange={(v) => setForm({ ...form, plaignantPseudoRoblox: v })} />
              <Field label="Pseudo Discord" value={form.plaignantPseudoDiscord} onChange={(v) => setForm({ ...form, plaignantPseudoDiscord: v })} />
            </div>
          </div>
          <div style={bloc}>
            {titreBloc(2, "Que s'est-il passé ?")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => setForm({ ...form, dateFaits: v })} />
              <Field label="Lieu des faits" value={form.lieuFaits} onChange={(v) => setForm({ ...form, lieuFaits: v })} placeholder="Ex : Black RP, quartier…" />
            </div>
            <Select label="Nature de l'infraction" value={form.nature} onChange={(v) => setForm({ ...form, nature: v })} options={NATURES_INFRACTION} />
            <Field label="Description détaillée des faits" textarea value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Décris précisément le déroulement des faits : qui, quoi, où, quand…" />
            <div style={{ fontSize: 11.5, color: form.description.trim().length >= 20 ? "#5A6B84" : "#B25E00", margin: "-6px 0 12px" }}>{form.description.trim().length} caractère(s) — 20 minimum</div>
            <Field label="Personne mise en cause (si connue)" value={form.misEnCause} onChange={(v) => setForm({ ...form, misEnCause: v })} placeholder="Pseudo ou description" />
            <Field label="Témoins (si présents)" value={form.temoins} onChange={(v) => setForm({ ...form, temoins: v })} placeholder="Pseudos des témoins" />
          </div>
          <div style={bloc}>
            {titreBloc(3, "Tes preuves (facultatif)")}
            <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 12, lineHeight: 1.5 }}>Captures d'écran, enregistrements, messages… Elles aident beaucoup la gendarmerie à traiter ta plainte.</div>
            <PreuvesEditeur preuves={form.preuves} onChange={(p) => setForm({ ...form, preuves: p })} />
          </div>
          <div style={bloc}>
            {titreBloc(4, "Validation")}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#3A4D6B", marginBottom: 16, lineHeight: 1.5 }}>
              <input type="checkbox" checked={form.certifie} onChange={(e) => setForm({ ...form, certifie: e.target.checked })} style={{ marginTop: 3 }} />
              Je certifie sur l'honneur que les déclarations ci-dessus sont sincères et véritables.
            </label>
            {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
            <button type="submit" disabled={busy} className="gh-btn-anim" style={{ ...buttonPrimary, background: "#C0172D", marginTop: 0 }}>{busy ? "Envoi en cours…" : "Envoyer ma plainte"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Registre des plaintes : plaintes en ligne + plaintes prises en brigade (procès-verbaux de plainte), au même endroit
export const estPVPlainte = (pv) => pv.modeleType === "Plainte" || /plainte/i.test(pv.modeleTitre || "");

export function AdminPlaintes({ plaintes, pvs = [], current, onUpdateStatut, onTakeCharge, onVisa }) {
  const [tab, setTab] = useState("en-cours");
  const [source, setSource] = useState("toutes");
  const [recherche, setRecherche] = useState("");
  const [ouverts, setOuverts] = useState({});
  const [fichePV, setFichePV] = useState(null);
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const estOPJ = current.isAdmin || (current.qualifications || []).includes("OPJ") || current.qualiteJudiciaire === "OPJ";

  // Les deux sources sont ramenées à la même forme
  const enLigne = plaintes.map((p) => ({
    cle: `l-${p.id}`, source: "ligne", brut: p, ref: p.ref, date: p.createdAt,
    plaignant: `${p.plaignantPrenom || ""} ${p.plaignantNom || ""}`.trim(), nature: p.nature || "Plainte",
    statut: p.statut, archivee: p.statut === "Traitée" || p.statut === "Classée", preuves: p.preuves || [],
  }));
  const brigade = pvs.filter(estPVPlainte).map((pv) => {
    const reps = pv.answers || [];
    const pers = reps.find((a) => a.type === "personne" && a.value && (a.value.nom || a.value.prenom) && /plaignant|victime/i.test(a.label)) || reps.find((a) => a.type === "personne" && a.value && (a.value.nom || a.value.prenom));
    const nature = reps.find((a) => /nature/i.test(a.label) && typeof a.value === "string" && a.value.trim());
    return {
      cle: `b-${pv.id}`, source: "brigade", brut: pv, ref: pv.ref, date: pv.createdAt,
      plaignant: pers ? `${(pers.value.prenom || "").trim()} ${(pers.value.nom || "").toUpperCase()}`.trim() : "Plaignant non précisé",
      nature: nature ? nature.value : pv.modeleTitre, statut: pv.traite ? "Visée" : "À viser", archivee: !!pv.traite,
      preuves: reps.filter((a) => a.type === "preuves").flatMap((a) => a.value || []),
    };
  });
  const tous = [...enLigne, ...brigade].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const parSource = tous.filter((x) => source === "toutes" || x.source === source);
  const filtres = parSource.filter((x) => norm(`${x.ref} ${x.plaignant} ${x.nature} ${x.brut.description || ""} ${x.brut.lieuFaits || ""}`).includes(norm(recherche)));
  const enCours = filtres.filter((x) => !x.archivee);
  const archivees = filtres.filter((x) => x.archivee);
  const affiches = tab === "en-cours" ? enCours : archivees;

  const aTraiter = tous.filter((x) => !x.archivee);
  const sansPrise = enLigne.filter((x) => !x.archivee && !x.brut.prisEnChargeMatricule).length;
  const tuile = (l, v, c) => (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );
  const chip = (actif, label, onClick) => (
    <button onClick={onClick} style={{ ...smallBtn, background: actif ? "#123A7A" : "transparent", color: actif ? "#fff" : "#14213A", borderColor: actif ? "#123A7A" : "#C3D0E2" }}>{label}</button>
  );
  const COUL = { ligne: "#2F6FDE", brigade: "#0E7C86" };

  if (fichePV) {
    const pv = pvs.find((p) => p.id === fichePV);
    if (pv) return <div style={{ maxWidth: 860 }}><FichePV pv={pv} onClose={() => setFichePV(null)} canVisa={estOPJ} onVisa={onVisa} /></div>;
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={h2Style}>Plaintes</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        {tuile("À traiter", aTraiter.length, "#C0172D")}
        {tuile("Plaintes en ligne", enLigne.filter((x) => !x.archivee).length, COUL.ligne)}
        {tuile("Plaintes en brigade", brigade.filter((x) => !x.archivee).length, COUL.brigade)}
        {tuile("Non prises en charge", sansPrise, "#B25E00")}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {chip(source === "toutes", `Toutes (${tous.length})`, () => setSource("toutes"))}
        {chip(source === "ligne", `🌐 En ligne (${enLigne.length})`, () => setSource("ligne"))}
        {chip(source === "brigade", `🏛️ En brigade (${brigade.length})`, () => setSource("brigade"))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {chip(tab === "en-cours", `À traiter (${enCours.length})`, () => setTab("en-cours"))}
        {chip(tab === "archivees", `Archivées (${archivees.length})`, () => setTab("archivees"))}
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (n°, plaignant, nature, lieu…)" style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #C3D0E2", borderRadius: 8, fontSize: 13.5, background: "#fff" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affiches.map((x) => {
          const p = x.brut;
          const c = COUL[x.source];
          const isMine = p.prisEnChargeMatricule === current.matricule;
          const canAct = current.isAdmin || isMine;
          const longue = x.source === "ligne" && (p.description || "").length > 320;
          const ouvert = !!ouverts[x.cle];
          return (
            <div key={x.cle} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${c}`, borderRadius: 12, padding: "16px 18px", boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{x.plaignant} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#123A7A", fontWeight: 600, background: "#E9EFF7", padding: "2px 7px", borderRadius: 5, marginLeft: 4 }}>{x.ref}</span></div>
                  <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>
                    {x.nature}
                    {x.source === "ligne" ? ` — ${p.dateFaits ? dateFR(p.dateFaits) : "date non précisée"} — ${p.lieuFaits || "lieu non précisé"}` : ` — rédigée le ${new Date(x.date).toLocaleDateString("fr-FR")}${p.faits && p.faits.lieu ? ` — ${p.faits.lieu}` : ""}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ background: c, color: "#fff", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, borderRadius: 20, padding: "3px 10px" }}>{x.source === "ligne" ? "🌐 EN LIGNE" : "🏛️ BRIGADE"}</span>
                  {x.source === "ligne" ? <StatutBadge statut={p.statut} /> : <span style={{ background: p.traite ? "#E3F2E8" : "#FFF4E0", color: p.traite ? "#1F6B42" : "#B25E00", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px" }}>{x.statut}</span>}
                </div>
              </div>

              {x.source === "ligne" ? (
                <>
                  <FieldRow label="Description" value={longue && !ouvert ? p.description.slice(0, 320) + "…" : p.description} />
                  {longue && <button onClick={() => setOuverts({ ...ouverts, [x.cle]: !ouvert })} style={{ ...smallBtn, marginTop: 4 }}>{ouvert ? "Réduire" : "Lire la suite"}</button>}
                  <FieldRow label="Mis en cause" value={p.misEnCause} />
                  <FieldRow label="Témoins" value={p.temoins} />
                  <FieldRow label="Contact" value={[p.plaignantPseudoRoblox && `Roblox ${p.plaignantPseudoRoblox}`, p.plaignantPseudoDiscord && `Discord ${p.plaignantPseudoDiscord}`].filter(Boolean).join(" — ")} />
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: "#3A4D6B", marginTop: 8 }}>Procès-verbal rédigé par <b>{p.auteurGrade ? p.auteurGrade + " " : ""}{p.auteurNom}</b>{p.visa ? ` — visé par ${p.visa.par}` : ""}.</div>
              )}

              {x.preuves.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 4 }}>Preuves ({x.preuves.length})</div>
                  <PreuvesAffichage preuves={x.preuves} />
                </div>
              )}

              {x.source === "ligne" && (p.prisEnChargeMatricule
                ? <div style={{ fontSize: 11, color: "#2F6FDE", marginTop: 8 }}>Prise en charge par {p.prisEnChargeNom} ({p.prisEnChargeMatricule})</div>
                : <div style={{ fontSize: 11, color: "#C0172D", marginTop: 8 }}>Non prise en charge</div>)}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {x.source === "brigade" && <button onClick={() => setFichePV(p.id)} style={{ ...smallBtn, background: "#0E7C86", color: "#fff", borderColor: "#0E7C86" }}>{estOPJ && !p.traite ? "Ouvrir / viser le PV" : "Ouvrir le PV"}</button>}
                {x.source === "ligne" && !p.prisEnChargeMatricule && <button onClick={() => onTakeCharge(p.id)} style={{ ...smallBtn, background: "#123A7A", color: "#fff" }}>Prendre en charge</button>}
                {x.source === "ligne" && canAct && p.prisEnChargeMatricule && (
                  <>
                    <button onClick={() => onUpdateStatut(p.id, "En cours")} style={{ ...smallBtn, color: "#2F6FDE", borderColor: "#2F6FDE" }}>Marquer en cours</button>
                    <button onClick={() => onUpdateStatut(p.id, "Traitée")} style={{ ...smallBtn, color: "#2E7D4F", borderColor: "#2E7D4F" }}>Marquer traitée</button>
                    <button onClick={() => onUpdateStatut(p.id, "Classée")} style={smallBtn}>Classer sans suite</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {affiches.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>{tab === "en-cours" ? "Aucune plainte à traiter." : "Aucune plainte archivée."}</div>}
      </div>
      <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 14 }}>Les plaintes prises en brigade sont rédigées avec le modèle « Procès-verbal de plainte » (page Procès-verbaux) ; elles apparaissent ici dès leur envoi et sont supprimées 7 jours après leur visa.</div>
    </div>
  );
}

export function AdminPlaintesGendarmes({ plaintes, current, onUpdateStatut, onTakeCharge }) {
  const [tab, setTab] = useState("en-cours");
  const enCours = plaintes.filter((p) => p.statut === "En attente" || p.statut === "En cours");
  const archivees = plaintes.filter((p) => p.statut === "Traitée" || p.statut === "Classée");
  const shown = tab === "en-cours" ? enCours : archivees;
  return (
    <div>
      <h2 style={h2Style}>Plaintes contre des gendarmes</h2>
      <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 16 }}>Réservé au Corps d'Encadrement et au Corps de Commandement.</div>
      <ArchiveTabs tab={tab} setTab={setTab} countEnCours={enCours.length} countArchivees={archivees.length} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.slice().reverse().map((p) => {
          const isMine = p.prisEnChargeMatricule === current.matricule;
          const canAct = current.isAdmin || isMine;
          return (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "18px 20px", boxShadow: "0 4px 16px -8px rgba(7,20,46,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Concerne : {p.gendarmeConcerne} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#123A7A", fontWeight: 600, background: "#E9EFF7", padding: "2px 7px", borderRadius: 5, marginLeft: 4 }}>({p.ref})</span></div>
                  <div style={{ fontSize: 12, color: "#5A6B84" }}>Plaignant : {p.plaignantPrenom} {p.plaignantNom} — {p.dateFaits || "date non précisée"} — {p.lieuFaits || "lieu non précisé"}</div>
                </div>
                <StatutBadge statut={p.statut} />
              </div>
              <FieldRow label="Description" value={p.description} />
              <FieldRow
                label="Contact"
                value={[p.plaignantPseudoRoblox && `Roblox ${p.plaignantPseudoRoblox}`, p.plaignantPseudoDiscord && `Discord ${p.plaignantPseudoDiscord}`].filter(Boolean).join(" — ")}
              />
              {p.prisEnChargeMatricule ? (
                <div style={{ fontSize: 11, color: "#2F6FDE", marginTop: 8 }}>Prise en charge par {p.prisEnChargeNom} ({p.prisEnChargeMatricule})</div>
              ) : (
                <div style={{ fontSize: 11, color: "#C0172D", marginTop: 8 }}>Non prise en charge</div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {!p.prisEnChargeMatricule && <button onClick={() => onTakeCharge(p.id)} style={{ ...smallBtn, background: "#123A7A", color: "#fff" }}>Prendre en charge</button>}
                {canAct && p.prisEnChargeMatricule && (
                  <>
                    <button onClick={() => onUpdateStatut(p.id, "En cours")} style={{ ...smallBtn, color: "#2F6FDE", borderColor: "#2F6FDE" }}>Marquer en cours</button>
                    <button onClick={() => onUpdateStatut(p.id, "Traitée")} style={{ ...smallBtn, color: "#2E7D4F", borderColor: "#2E7D4F" }}>Marquer traitée</button>
                    <button onClick={() => onUpdateStatut(p.id, "Classée")} style={smallBtn}>Classer sans suite</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>{tab === "en-cours" ? "Aucun signalement en cours." : "Aucun signalement archivé."}</div>}
      </div>
    </div>
  );
}
