// pages/pv.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useRef, useState } from "react";
import { PreuvesAffichage, PreuvesEditeur } from "../composants/Preuves.jsx";
import { Field, Select, buttonPrimary, h2Style, labelStyle, selectStyle, smallBtn } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";
import { QUALITE_LONGUE, ROMAIN, cleJour, dateEnLettres, dateFR, heureEnLettres, newId } from "../lib/utils.js";

const TYPES_PV = ["Constatation", "Interpellation", "Audition", "Saisie", "Accident", "Autre"];
const COULEURS_PV = { Plainte: "#0E7C86", Constatation: "#123A7A", Interpellation: "#C0172D", Audition: "#6B3FA0", Saisie: "#B25E00", Accident: "#2E7D4F", Autre: "#3A4D6B" };
const TYPES_CHAMP_PV = [
  { value: "text", label: "Texte court" }, { value: "textarea", label: "Texte long" }, { value: "number", label: "Nombre" },
  { value: "date", label: "Date" }, { value: "time", label: "Heure" }, { value: "select", label: "Liste de choix" },
  { value: "cases", label: "Cases à cocher" }, { value: "oui_non", label: "Oui / Non" },
  { value: "personne", label: "Identité d'une personne" }, { value: "vehicule", label: "Véhicule" },
  { value: "preuves", label: "Preuves (photos, vidéos, liens)" },
];

const FP = (label, type = "text", opt = {}) => ({ label, type, required: !!opt.required, options: opt.options || [] });
const MODELES_PV_TYPES = [
  { nom: "Procès-verbal de plainte", type: "Plainte", serie: "PLT", visa: "Vu le Code pénal et le règlement en vigueur au sein de la communauté.", sections: [
    { title: "Plaignant", fields: [FP("Plaignant", "personne", { required: true }), FP("Contact Discord", "text")] },
    { title: "Les faits", fields: [FP("Nature de l'infraction", "text", { required: true }), FP("Date des faits", "date"), FP("Lieu des faits", "text"), FP("Déclaration du plaignant", "textarea", { required: true })] },
    { title: "Personne mise en cause", fields: [FP("Personne mise en cause", "personne")] },
    { title: "Témoins et preuves", fields: [FP("Témoins éventuels", "textarea"), FP("Éléments de preuve", "preuves")] },
  ] },
  { nom: "Procès-verbal de constatation", type: "Constatation", serie: "CST", visa: "Vu le Code pénal et le règlement en vigueur au sein de la communauté.", sections: [
    { title: "Circonstances", fields: [FP("Nature de l'infraction", "text", { required: true }), FP("Infraction retenue (article)"), FP("Description des faits", "textarea", { required: true })] },
    { title: "Personne mise en cause", fields: [FP("Personne mise en cause", "personne", { required: true })] },
    { title: "Véhicule", fields: [FP("Véhicule concerné", "vehicule")] },
    { title: "Constatations", fields: [FP("Éléments relevés", "textarea"), FP("Éléments de preuve", "cases", { options: ["Photos", "Vidéo", "Témoignage", "Mesure radar", "Aucun"] }), FP("Témoins éventuels", "textarea")] },
  ] },
  { nom: "Procès-verbal d'interpellation", type: "Interpellation", serie: "INT", visa: "", sections: [
    { title: "Circonstances de l'interpellation", fields: [FP("Heure de l'interpellation", "time", { required: true }), FP("Lieu précis", "text"), FP("Motif de l'interpellation", "textarea", { required: true }), FP("Résistance opposée", "oui_non", { required: true }), FP("Usage de la force", "oui_non", { required: true }), FP("Précisions sur l'usage de la force", "textarea")] },
    { title: "Personne interpellée", fields: [FP("Personne interpellée", "personne", { required: true })] },
    { title: "Fouille et objets découverts", fields: [FP("Fouille de sécurité effectuée", "oui_non", { required: true }), FP("Objets découverts", "textarea")] },
    { title: "Suites données", fields: [FP("Placement en garde à vue", "oui_non", { required: true }), FP("Droits notifiés", "oui_non", { required: true }), FP("Heure de notification des droits", "time"), FP("Officier de police judiciaire avisé", "oui_non", { required: true })] },
  ] },
  { nom: "Procès-verbal d'audition", type: "Audition", serie: "AUD", visa: "", sections: [
    { title: "Personne entendue", fields: [FP("Personne entendue", "personne", { required: true }), FP("Qualité de la personne", "select", { required: true, options: ["Mis en cause", "Victime", "Témoin"] })] },
    { title: "Déroulement", fields: [FP("Début de l'audition", "time", { required: true }), FP("Fin de l'audition", "time", { required: true }), FP("Assistance d'un avocat", "oui_non", { required: true })] },
    { title: "Déclarations", fields: [FP("Déclarations recueillies", "textarea", { required: true }), FP("Observations de l'enquêteur", "textarea")] },
  ] },
  { nom: "Procès-verbal de saisie", type: "Saisie", serie: "SAI", visa: "", sections: [
    { title: "Objets saisis", fields: [FP("Nature des objets", "text", { required: true }), FP("Description détaillée", "textarea", { required: true }), FP("Quantité", "number"), FP("Lieu de la saisie", "text")] },
    { title: "Personne concernée", fields: [FP("Personne concernée", "personne")] },
    { title: "Conservation", fields: [FP("Placé sous scellé", "oui_non", { required: true }), FP("Numéro de scellé", "text")] },
  ] },
  { nom: "Procès-verbal d'accident de la route", type: "Accident", serie: "ACC", visa: "", sections: [
    { title: "Circonstances", fields: [FP("Conditions de circulation", "select", { options: ["Normales", "Pluie", "Brouillard", "Nuit", "Chaussée dégradée"] }), FP("Déroulement de l'accident", "textarea", { required: true })] },
    { title: "Véhicule n° 1", fields: [FP("Véhicule n° 1", "vehicule", { required: true }), FP("Conducteur n° 1", "personne", { required: true })] },
    { title: "Véhicule n° 2", fields: [FP("Véhicule n° 2", "vehicule"), FP("Conducteur n° 2", "personne")] },
    { title: "Bilan", fields: [FP("Nombre de blessés", "number"), FP("Secours sur place", "oui_non"), FP("Observations", "textarea")] },
  ] },
];
const avecIdsPV = (m) => ({
  id: newId(), titre: m.nom, type: m.type, serie: m.serie, visa: m.visa || "", actif: true,
  sections: m.sections.map((s) => ({ id: newId(), title: s.title, fields: s.fields.map((f) => ({ ...f, key: "f_" + newId() })) })),
});

// Modèle « plainte en brigade » proposé à tous les gendarmes tant qu'aucun modèle de plainte n'existe
export const MODELE_PLAINTE_DEFAUT = { ...avecIdsPV(MODELES_PV_TYPES[0]), id: "plainte-defaut" };

// Valeur vide selon le type de champ
function valeurVidePV(type) {
  if (type === "cases" || type === "preuves") return [];
  if (type === "personne") return { nom: "", prenom: "", naissance: "", roblox: "" };
  if (type === "vehicule") return { modele: "", plaque: "", couleur: "" };
  return "";
}
const estVidePV = (type, v) => {
  if (type === "cases" || type === "preuves") return !v || v.length === 0;
  if (type === "personne") return !v || !(v.nom || "").trim() || !(v.prenom || "").trim();
  if (type === "vehicule") return !v || !(v.plaque || "").trim();
  return !String(v == null ? "" : v).trim();
};

/* ---------- Affichage d'un PV rempli : la « fiche » ---------- */

function ValeurPV({ a, apercu }) {
  const v = a.value;
  const vide = <span style={{ color: "#8A97AB" }}>{apercu ? "……………………" : "—"}</span>;
  if (a.type === "personne") {
    if (!v || (!v.nom && !v.prenom)) return vide;
    return (
      <span>
        <b>{(v.nom || "").toUpperCase()} {v.prenom}</b>
        {v.naissance ? `, né(e) le ${dateFR(v.naissance)}` : ""}
        {v.roblox ? ` — compte Roblox : ${v.roblox}` : ""}
      </span>
    );
  }
  if (a.type === "vehicule") {
    if (!v || (!v.plaque && !v.modele)) return vide;
    return <span>{v.modele || "véhicule"}{v.couleur ? `, ${v.couleur}` : ""}{v.plaque ? " — immatriculé " : ""}{v.plaque ? <b style={{ fontFamily: "'Courier New', monospace" }}>{v.plaque}</b> : null}</span>;
  }
  if (a.type === "preuves") {
    if (!v || !v.length) return vide;
    return <PreuvesAffichage preuves={v} />;
  }
  if (a.type === "cases") {
    if (!v || !v.length) return vide;
    return <span>{v.map((x) => <span key={x} style={{ marginRight: 14, whiteSpace: "nowrap" }}>☑ {x}</span>)}</span>;
  }
  if (a.type === "oui_non") {
    if (!v) return vide;
    return <span><b>{v === "Oui" ? "☑" : "☐"}</b> Oui &nbsp; <b>{v === "Non" ? "☑" : "☐"}</b> Non</span>;
  }
  if (a.type === "date") return v ? dateFR(v) : vide;
  if (a.type === "time") return v ? String(v).replace(":", "h") : vide;
  return String(v == null ? "" : v).trim() ? <span style={{ whiteSpace: "pre-wrap" }}>{String(v)}</span> : vide;
}

export function FichePV({ pv, apercu, onClose, canVisa, onVisa }) {
  const refDoc = useRef(null);
  const [visaOuvert, setVisaOuvert] = useState(false);
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const d = new Date(pv.createdAt || Date.now());
  const l = dateEnLettres(d);
  const qualiteLongue = QUALITE_LONGUE[pv.auteurQualite] || QUALITE_LONGUE.APJA;
  const faits = pv.faits || {};
  const [hF, mF] = (faits.heure || "").split(":").map(Number);
  const couleur = COULEURS_PV[pv.modeleType] || "#123A7A";

  const chapitres = [];
  (pv.answers || []).forEach((a) => {
    let c = chapitres.find((x) => x.titre === (a.section || ""));
    if (!c) { c = { titre: a.section || "", lignes: [] }; chapitres.push(c); }
    c.lignes.push(a);
  });

  function imprimer() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${pv.ref || "Procès-verbal"}</title><style>body{margin:16px;background:#fff}@page{margin:10mm}</style></head><body>${refDoc.current.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }
  async function viser() {
    setBusy(true);
    const ok = await onVisa(pv.id, obs.trim());
    setBusy(false);
    if (ok) { setVisaOuvert(false); setObs(""); }
  }

  const serif = "Georgia, 'Times New Roman', serif";
  const cellule = { padding: "7px 10px", borderTop: "1px solid #D9DFEA", verticalAlign: "top", fontSize: 13.5, lineHeight: 1.5 };

  return (
    <div>
      {!apercu && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          {onClose && <button style={smallBtn} onClick={onClose}>← Retour aux procès-verbaux</button>}
          <button style={smallBtn} onClick={imprimer}>🖨 Imprimer / PDF</button>
          {canVisa && !pv.traite && <button style={{ ...smallBtn, background: "#123A7A", color: "#fff", borderColor: "#123A7A" }} onClick={() => setVisaOuvert(!visaOuvert)}>✔ Viser ce PV</button>}
        </div>
      )}
      {visaOuvert && !apercu && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Viser le procès-verbal</div>
          <Field label="Observations de l'OPJ (facultatif)" textarea value={obs} onChange={setObs} />
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={busy} onClick={viser} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 0 }}>{busy ? "…" : "Confirmer le visa"}</button>
            <button style={smallBtn} onClick={() => setVisaOuvert(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div ref={refDoc} style={{ background: "#fff", border: "1px solid #C9D3E3", borderRadius: 4, maxWidth: 820, fontFamily: serif, color: "#111", boxShadow: "0 14px 34px -22px rgba(7,20,46,0.55)", overflow: "hidden" }}>
        <div style={{ display: "flex", height: 6 }}><div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: "#C0172D" }} /></div>
        <div style={{ padding: "26px 38px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
            <div style={{ fontSize: 12, lineHeight: 1.55, letterSpacing: 0.4 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>GENDARMERIE NATIONALE</div>
              <div>Compagnie de Black RP</div>
              <div>{pv.auteurUnite || "Brigade territoriale"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.5, color: "#555" }}>PROCÈS-VERBAL N°</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 15, border: `2px solid ${couleur}`, color: couleur, padding: "3px 10px", display: "inline-block", marginTop: 3 }}>{pv.ref || "—"}</div>
            </div>
          </div>

          <div style={{ textAlign: "center", margin: "22px 0 4px" }}>
            <div style={{ fontSize: 21, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, lineHeight: 1.25 }}>{pv.modeleTitre || "Procès-verbal"}</div>
            {pv.modeleType && <div style={{ fontSize: 12, color: "#555", marginTop: 4, letterSpacing: 2, textTransform: "uppercase" }}>— {pv.modeleType} —</div>}
          </div>
          {!apercu && (
            <div style={{ textAlign: "center", margin: "10px 0 16px" }}>
              <span style={{ display: "inline-block", fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: 1.2, padding: "4px 12px", border: `2px solid ${pv.traite ? "#1F6B42" : "#B25E00"}`, color: pv.traite ? "#1F6B42" : "#B25E00", transform: "rotate(-2deg)" }}>{pv.traite ? "VISÉ PAR L'OPJ" : "À VISER PAR UN OPJ"}</span>
            </div>
          )}

          <p style={{ fontSize: 14, lineHeight: 1.75, textAlign: "justify", margin: "14px 0" }}>
            L'an {l.an}, le {l.jour} {l.mois}, à {heureEnLettres(d.getHours(), d.getMinutes())},<br />
            Nous soussigné(e) <b>{pv.auteurGrade} {(pv.auteurNom || "").trim().split(/\s+/)[0]} {(pv.auteurNom || "").trim().split(/\s+/).slice(1).join(" ").toUpperCase()}</b>, {qualiteLongue}
            {pv.auteurRIO ? <> (RIO n° <span style={{ fontFamily: "'Courier New', monospace" }}>{pv.auteurRIO}</span>)</> : null}, affecté(e) à l'unité « {pv.auteurUnite || "Brigade territoriale"} », agissant dans le cadre de nos fonctions,<br />
            rapportons les opérations suivantes :
          </p>
          {pv.visaLegal && <p style={{ fontSize: 13, fontStyle: "italic", color: "#333", margin: "0 0 14px" }}>{pv.visaLegal}</p>}

          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #B8C3D6", marginBottom: 18, fontFamily: "Arial, sans-serif" }}>
            <tbody>
              <tr>
                {[["Date des faits", faits.date ? dateFR(faits.date) : ""], ["Heure des faits", faits.heure ? faits.heure.replace(":", "h") : ""], ["Lieu des faits", faits.lieu || ""]].map(([k, v]) => (
                  <td key={k} style={{ padding: "8px 12px", borderRight: "1px solid #B8C3D6", background: "#F4F7FB", width: k === "Lieu des faits" ? "44%" : "28%" }}>
                    <div style={{ fontSize: 10, letterSpacing: 1, color: "#555", textTransform: "uppercase" }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{v || (apercu ? "……………" : "—")}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          {!Number.isNaN(hF) && faits.heure && <div style={{ fontSize: 12, color: "#555", margin: "-10px 0 16px", fontStyle: "italic" }}>Faits survenus à {heureEnLettres(hF, mF || 0)}.</div>}

          {chapitres.map((c, i) => (
            <div key={c.titre + i} style={{ marginBottom: 16 }}>
              <div style={{ background: couleur, color: "#fff", fontFamily: "Arial, sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, padding: "6px 12px", textTransform: "uppercase" }}>{ROMAIN[i] || i + 1}. {c.titre || "Informations"}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #B8C3D6", borderTop: "none" }}>
                <tbody>
                  {c.lignes.map((a, k) => (
                    a.type === "textarea" ? (
                      <tr key={k}><td colSpan={2} style={cellule}><div style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, color: "#444", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{a.label}</div><ValeurPV a={a} apercu={apercu} /></td></tr>
                    ) : (
                      <tr key={k}>
                        <td style={{ ...cellule, width: "34%", background: "#F4F7FB", fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, color: "#333" }}>{a.label}</td>
                        <td style={cellule}><ValeurPV a={a} apercu={apercu} /></td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <p style={{ fontSize: 14, lineHeight: 1.7, textAlign: "justify", margin: "20px 0 16px" }}>
            Dont procès-verbal que nous avons clos et signé, les jour, mois et an que dessus, pour servir et valoir ce que de droit.
          </p>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220, border: "1px solid #B8C3D6", padding: "10px 14px", minHeight: 96 }}>
              <div style={{ fontFamily: "Arial, sans-serif", fontSize: 10.5, letterSpacing: 1, color: "#555", textTransform: "uppercase" }}>Le rédacteur</div>
              <div style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: 26, color: "#123A7A", margin: "8px 0 2px", lineHeight: 1.1 }}>{(pv.auteurNom || "").split(" ").slice(-1)[0] || ""}</div>
              <div style={{ fontSize: 12 }}>{pv.auteurGrade} {pv.auteurNom}{pv.auteurRIO ? ` — RIO ${pv.auteurRIO}` : ""}</div>
            </div>
            <div style={{ flex: 1, minWidth: 220, border: "1px solid #B8C3D6", padding: "10px 14px", minHeight: 96 }}>
              <div style={{ fontFamily: "Arial, sans-serif", fontSize: 10.5, letterSpacing: 1, color: "#555", textTransform: "uppercase" }}>Visa de l'officier de police judiciaire</div>
              {pv.visa ? (
                <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5 }}>
                  <div style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: 24, color: "#1F6B42", lineHeight: 1.1 }}>{(pv.visa.par || "").split(" ").slice(-1)[0]}</div>
                  <div>{pv.visa.grade} {pv.visa.par}{pv.visa.rio ? ` — RIO ${pv.visa.rio}` : ""}</div>
                  <div style={{ color: "#555" }}>Visé le {new Date(pv.visa.le).toLocaleString("fr-FR")}</div>
                  {pv.visa.observations && <div style={{ marginTop: 4, fontStyle: "italic" }}>« {pv.visa.observations} »</div>}
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12.5, color: "#8A97AB" }}>{apercu ? "Zone réservée au visa" : "En attente de visa"}</div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 18, paddingTop: 10, borderTop: "1px solid #D9DFEA", fontFamily: "Arial, sans-serif", fontSize: 10, color: "#777", textAlign: "center", lineHeight: 1.5 }}>
            Document de jeu de rôle (Roblox) — sans valeur officielle, sans lien avec la Gendarmerie nationale réelle.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Rédaction d'un PV par un gendarme ---------- */

function ChampPV({ f, v, onChange }) {
  const lab = <label style={labelStyle}>{f.label}{f.required ? <span style={{ color: "#C0172D" }}> *</span> : null}</label>;
  const inp = { padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 14, background: "#fff", boxSizing: "border-box", width: "100%" };
  if (f.type === "textarea") return <Field label={f.label + (f.required ? " *" : "")} textarea value={v} onChange={onChange} />;
  if (f.type === "number") return <Field label={f.label + (f.required ? " *" : "")} type="number" value={v} onChange={onChange} />;
  if (f.type === "date") return <Field label={f.label + (f.required ? " *" : "")} type="date" value={v} onChange={onChange} />;
  if (f.type === "time") return <div style={{ marginBottom: 12 }}>{lab}<input type="time" value={v} onChange={(e) => onChange(e.target.value)} style={{ ...inp, maxWidth: 160 }} /></div>;
  if (f.type === "select") {
    return (
      <div style={{ marginBottom: 12 }}>{lab}
        <select value={v} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
          <option value="">— Choisir —</option>
          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (f.type === "oui_non") {
    return (
      <div style={{ marginBottom: 12 }}>{lab}
        <div style={{ display: "flex", gap: 8 }}>
          {["Oui", "Non"].map((o) => (
            <button key={o} type="button" onClick={() => onChange(v === o ? "" : o)} style={{ border: "1.5px solid #123A7A", background: v === o ? "#123A7A" : "#fff", color: v === o ? "#fff" : "#123A7A", borderRadius: 8, padding: "7px 22px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>{o}</button>
          ))}
        </div>
      </div>
    );
  }
  if (f.type === "cases") {
    return (
      <div style={{ marginBottom: 12 }}>{lab}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 7 }}>
          {(f.options || []).map((o) => (
            <label key={o} style={{ fontSize: 13.5, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={(v || []).includes(o)} onChange={() => onChange((v || []).includes(o) ? v.filter((x) => x !== o) : [...(v || []), o])} /> {o}
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (f.type === "preuves") {
    return <div style={{ marginBottom: 14 }}>{lab}<PreuvesEditeur preuves={Array.isArray(v) ? v : []} onChange={onChange} /></div>;
  }
  if (f.type === "personne") {
    const set = (patch) => onChange({ ...v, ...patch });
    return (
      <div style={{ marginBottom: 14, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 12 }}>
        {lab}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Nom" value={v.nom} onChange={(x) => set({ nom: x })} />
          <Field label="Prénom" value={v.prenom} onChange={(x) => set({ prenom: x })} />
          <Field label="Date de naissance" type="date" value={v.naissance} onChange={(x) => set({ naissance: x })} />
          <Field label="Pseudo ou @ Roblox" value={v.roblox} onChange={(x) => set({ roblox: x })} />
        </div>
      </div>
    );
  }
  if (f.type === "vehicule") {
    const set = (patch) => onChange({ ...v, ...patch });
    return (
      <div style={{ marginBottom: 14, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 12 }}>
        {lab}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr", gap: 10 }}>
          <Field label="Marque / modèle" value={v.modele} onChange={(x) => set({ modele: x })} />
          <Field label="Plaque" value={v.plaque} onChange={(x) => set({ plaque: x.toUpperCase() })} />
          <Field label="Couleur" value={v.couleur} onChange={(x) => set({ couleur: x })} />
        </div>
      </div>
    );
  }
  return <Field label={f.label + (f.required ? " *" : "")} value={v} onChange={onChange} />;
}

function PVNouveau({ modele, current, onSubmit, onCancel }) {
  const aujourdhui = cleJour(new Date());
  const [faits, setFaits] = useState({ date: aujourdhui, heure: new Date().toTimeString().slice(0, 5), lieu: "" });
  const [values, setValues] = useState(() => {
    const v = {};
    modele.sections.forEach((s) => s.fields.forEach((f) => { v[f.key] = valeurVidePV(f.type); }));
    return v;
  });
  const [certifie, setCertifie] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const couleur = COULEURS_PV[modele.type] || "#123A7A";
  const card = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "16px 18px", marginBottom: 14 };
  let numero = 0;

  async function envoyer(e) {
    e.preventDefault();
    if (!faits.lieu.trim()) { setError("Indique le lieu des faits."); return; }
    for (const s of modele.sections) for (const f of s.fields) {
      if (f.required && estVidePV(f.type, values[f.key])) { setError(`Champ obligatoire à compléter : « ${f.label} » (chapitre « ${s.title} »).`); return; }
    }
    if (!certifie) { setError("Coche la case de certification pour clore et signer le PV."); return; }
    setError("");
    setBusy(true);
    const answers = modele.sections.flatMap((s) => s.fields.map((f) => ({ section: s.title, label: f.label, type: f.type, value: values[f.key] })));
    const saved = await onSubmit({ modeleId: modele.id, modeleTitre: modele.titre, modeleType: modele.type || "Autre", serie: modele.serie || "PV", visaLegal: modele.visa || "", faits: { ...faits, lieu: faits.lieu.trim() }, answers });
    setBusy(false);
    if (!saved) setError("Échec de l'envoi, réessaie dans un instant.");
  }

  return (
    <form onSubmit={envoyer}>
      <button type="button" style={{ ...smallBtn, marginBottom: 14 }} onClick={onCancel}>← Annuler</button>
      <div style={{ background: couleur, color: "#fff", borderRadius: 12, padding: "16px 20px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.8 }}>NOUVEAU PROCÈS-VERBAL</div>
        <div style={{ fontFamily: FONT_TITRE, fontSize: 24, fontWeight: 700, margin: "2px 0 6px" }}>{modele.titre}</div>
        <div style={{ fontSize: 12.5, opacity: 0.9 }}>Rédacteur : {current.grade} {current.prenom} {current.nom} — {QUALITE_LONGUE[current.qualiteJudiciaire] || QUALITE_LONGUE.APJA}{current.unite ? ` — ${current.unite}` : ""}</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Le numéro du PV, la date et l'heure de rédaction sont ajoutés automatiquement.</div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: couleur, letterSpacing: 0.6, marginBottom: 10, textTransform: "uppercase" }}>Informations générales</div>
        <div style={{ display: "grid", gridTemplateColumns: "170px 130px 1fr", gap: 12 }}>
          <Field label="Date des faits" type="date" value={faits.date} onChange={(v) => setFaits({ ...faits, date: v })} />
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Heure des faits</label>
            <input type="time" value={faits.heure} onChange={(e) => setFaits({ ...faits, heure: e.target.value })} style={{ padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 14, background: "#fff", boxSizing: "border-box", width: "100%" }} />
          </div>
          <Field label="Lieu des faits *" value={faits.lieu} onChange={(v) => setFaits({ ...faits, lieu: v })} />
        </div>
      </div>

      {modele.sections.map((s) => {
        numero += 1;
        return (
          <div key={s.id} style={card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: couleur, letterSpacing: 0.6, marginBottom: 10, textTransform: "uppercase" }}>{ROMAIN[numero - 1] || numero}. {s.title}</div>
            {s.fields.map((f) => <ChampPV key={f.key} f={f} v={values[f.key]} onChange={(val) => setValues({ ...values, [f.key]: val })} />)}
          </div>
        );
      })}

      <div style={{ ...card, background: "#F5F8FC" }}>
        <label style={{ fontSize: 13.5, display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", lineHeight: 1.5 }}>
          <input type="checkbox" checked={certifie} onChange={(e) => setCertifie(e.target.checked)} style={{ marginTop: 4 }} />
          <span>Je certifie l'exactitude des faits relatés dans ce procès-verbal et le clos sous ma signature. Il sera transmis à l'officier de police judiciaire pour visa.</span>
        </label>
      </div>
      {error && <div style={{ color: "#C0172D", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <button type="submit" disabled={busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "11px 26px", marginTop: 0, background: couleur }}>{busy ? "Envoi…" : "Clore, signer et transmettre à l'OPJ"}</button>
    </form>
  );
}

/* ---------- Page « Procès-verbaux » ---------- */

export function PVPage({ current, modeles, pvs, onSubmit, onVisa }) {
  const estOPJ = current.isAdmin || (current.qualifications || []).includes("OPJ") || current.qualiteJudiciaire === "OPJ";
  const [vue, setVue] = useState(null); // null | { nouveau: modele } | { fiche: id }
  const [tab, setTab] = useState("a-viser");
  const [recherche, setRecherche] = useState("");
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const base = (estOPJ ? pvs : pvs.filter((p) => p.auteurMatricule === current.matricule)).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const aViser = base.filter((p) => !p.traite);
  const vises = base.filter((p) => p.traite);
  const liste = (tab === "a-viser" ? aViser : vises).filter((p) => norm(`${p.ref} ${p.modeleTitre} ${p.auteurNom} ${p.faits ? p.faits.lieu : ""}`).includes(norm(recherche)));

  if (vue && vue.nouveau) {
    return (
      <div style={{ maxWidth: 860 }}>
        <PVNouveau modele={vue.nouveau} current={current} onCancel={() => setVue(null)} onSubmit={async (data) => { const saved = await onSubmit(data); if (saved) setVue({ fiche: saved.id }); return saved; }} />
      </div>
    );
  }
  if (vue && vue.fiche) {
    const pv = pvs.find((p) => p.id === vue.fiche);
    if (pv) return <div style={{ maxWidth: 860 }}><FichePV pv={pv} onClose={() => setVue(null)} canVisa={estOPJ} onVisa={onVisa} /></div>;
  }

  return (
    <div style={{ maxWidth: 940 }}>
      <h2 style={h2Style}>Procès-verbaux</h2>

      <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 10 }}>Rédiger un procès-verbal</div>
      {modeles.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, color: "#5A6B84", fontSize: 13, marginBottom: 26 }}>Aucun modèle de PV n'est disponible pour le moment.{current.isAdmin ? " Crée-en un dans « Modèles de PV »." : ""}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 28 }}>
          {modeles.map((m) => {
            const c = COULEURS_PV[m.type] || "#123A7A";
            const nbChamps = m.sections.reduce((n, s) => n + s.fields.length, 0);
            return (
              <button key={m.id} onClick={() => setVue({ nouveau: m })} className="gh-btn-anim" style={{ textAlign: "left", background: "#fff", border: "1px solid #D3DDEA", borderTop: `5px solid ${c}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", boxShadow: "0 4px 14px -10px rgba(7,20,46,0.35)", fontFamily: FONT_BASE }}>
                <span style={{ display: "inline-block", background: c, color: "#fff", fontSize: 10.5, fontWeight: 700, letterSpacing: 1, padding: "2px 9px", borderRadius: 10, textTransform: "uppercase" }}>{m.type || "PV"}</span>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#14213A", margin: "8px 0 4px", lineHeight: 1.3 }}>{m.titre}</span>
                <span style={{ display: "block", fontSize: 12, color: "#5A6B84" }}>{m.sections.length} chapitre{m.sections.length > 1 ? "s" : ""} · {nbChamps} champ{nbChamps > 1 ? "s" : ""}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 10 }}>{estOPJ ? "PV reçus (à l'attention de l'OPJ)" : "Mes procès-verbaux"}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {[["a-viser", `À viser (${aViser.length})`], ["vises", `Visés (${vises.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ border: "1px solid #C3D0E2", background: tab === k ? "#123A7A" : "#fff", color: tab === k ? "#fff" : "#14213A", borderRadius: 16, padding: "5px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
        <span style={{ fontSize: 11.5, color: "#5A6B84" }}>🗑 Les PV visés sont supprimés 7 jours après leur visa.</span>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (n°, type, rédacteur, lieu…)" style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #C3D0E2", borderRadius: 8, fontSize: 13.5, background: "#fff" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {liste.map((p) => {
          const c = COULEURS_PV[p.modeleType] || "#123A7A";
          return (
            <button key={p.id} onClick={() => setVue({ fiche: p.id })} style={{ textAlign: "left", background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${c}`, borderRadius: 10, padding: "11px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: FONT_BASE, boxShadow: "0 3px 12px -10px rgba(7,20,46,0.3)" }}>
              <span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#14213A" }}>{p.modeleTitre}</span>
                <span style={{ display: "block", fontSize: 12, color: "#5A6B84", marginTop: 2 }}>{p.auteurGrade ? p.auteurGrade + " " : ""}{p.auteurNom} · {new Date(p.createdAt).toLocaleString("fr-FR")}{p.faits && p.faits.lieu ? ` · ${p.faits.lieu}` : ""}</span>
              </span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11.5, color: c, fontWeight: 700 }}>{p.ref}</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 12, color: "#fff", background: p.traite ? "#2E7D4F" : "#B25E00" }}>{p.traite ? "VISÉ" : "À VISER"}</span>
              </span>
            </button>
          );
        })}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13, padding: "10px 0" }}>{tab === "a-viser" ? "Aucun PV en attente de visa." : "Aucun PV visé."}</div>}
      </div>
    </div>
  );
}

/* ---------- Création des MODÈLES de PV (distincte des questionnaires) ---------- */

function apercuPV(m) {
  const now = new Date();
  return {
    ref: `${m.serie || "PV"}-${cleJour(now).replace(/-/g, "").slice(2)}-143000`, createdAt: now.toISOString(), traite: false,
    modeleTitre: m.titre || "Titre du procès-verbal", modeleType: m.type, visaLegal: m.visa,
    auteurGrade: "Brigadier", auteurNom: "Jean DUPONT", auteurRIO: "1234567", auteurQualite: "OPJ", auteurUnite: "Brigade territoriale",
    faits: { date: cleJour(now), heure: "14:30", lieu: "" },
    answers: m.sections.flatMap((s) => s.fields.filter((f) => f.label.trim()).map((f) => ({ section: s.title || "Chapitre", label: f.label, type: f.type, value: valeurVidePV(f.type) }))),
  };
}

export function PVModelesAdmin({ modeles, onSave }) {
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState("");
  const [choixType, setChoixType] = useState(MODELES_PV_TYPES[0].nom);
  const accent = "#7A1F2B";
  const card = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, marginBottom: 14 };
  const inp = { padding: "8px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, background: "#fff", boxSizing: "border-box" };
  const btn = { ...smallBtn, padding: "6px 10px" };
  const bouger = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const c = arr.slice(); [c[i], c[j]] = [c[j], c[i]]; return c; };

  async function sauver(list, ok) {
    const res = await onSave(list);
    setMsg(res ? ok : "Échec de l'enregistrement, réessaie.");
    return res;
  }
  const vierge = () => ({ id: newId(), titre: "", type: "Constatation", serie: "PV", visa: "", actif: true, sections: [{ id: newId(), title: "Faits constatés", fields: [] }] });

  if (!editing) {
    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ borderLeft: `6px solid ${accent}`, paddingLeft: 14, marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: accent, fontWeight: 800 }}>DOCUMENTS OFFICIELS</div>
          <h2 style={{ ...h2Style, margin: "2px 0 4px", borderBottom: "none", paddingBottom: 0 }}>Modèles de procès-verbaux</h2>
          <div style={{ fontSize: 13, color: "#5A6B84" }}>Un modèle de PV définit la trame d'un procès-verbal (chapitres, rubriques, personnes, véhicules…). Ce n'est <b>pas</b> un questionnaire : les questionnaires se gèrent dans « Questionnaires ».</div>
        </div>

        <div style={{ ...card, background: "#FBF3F4", borderColor: "#E8C9CD" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Créer un modèle</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => { setMsg(""); setEditing(vierge()); }} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0, background: accent }}>+ Modèle vierge</button>
            <span style={{ fontSize: 12, color: "#5A6B84" }}>ou partir d'un modèle type :</span>
            <select value={choixType} onChange={(e) => setChoixType(e.target.value)} style={{ ...inp, minWidth: 250 }}>
              {MODELES_PV_TYPES.map((m) => <option key={m.nom} value={m.nom}>{m.nom}</option>)}
            </select>
            <button onClick={() => { setMsg(""); setEditing(avecIdsPV(MODELES_PV_TYPES.find((m) => m.nom === choixType))); }} style={smallBtn}>Utiliser ce modèle type</button>
          </div>
        </div>

        {msg && <div style={{ fontSize: 12.5, color: "#16305C", marginBottom: 12 }}>{msg}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {modeles.map((m) => {
            const c = COULEURS_PV[m.type] || "#123A7A";
            const nb = m.sections.reduce((n, s) => n + s.fields.length, 0);
            return (
              <div key={m.id} style={{ ...card, marginBottom: 0, borderLeft: `6px solid ${c}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{m.titre}</div>
                    <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>{m.type || "PV"} · série « {m.serie || "PV"} » · {m.sections.length} chapitre(s) · {nb} rubrique(s) · {m.actif ? "🟢 Disponible" : "🔴 Masqué"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={smallBtn} onClick={() => { setMsg(""); setEditing(JSON.parse(JSON.stringify(m))); }}>Modifier</button>
                    <button style={smallBtn} onClick={() => sauver(modeles.map((x) => (x.id === m.id ? { ...x, actif: !x.actif } : x)), m.actif ? "Modèle masqué." : "Modèle disponible.")}>{m.actif ? "Masquer" : "Rendre disponible"}</button>
                    <button style={smallBtn} onClick={() => sauver([...modeles, { ...JSON.parse(JSON.stringify(m)), id: newId(), titre: m.titre + " (copie)", actif: false }], "Modèle dupliqué (masqué par défaut).")}>Dupliquer</button>
                    <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => { if (window.confirm(`Supprimer le modèle « ${m.titre} » ? Les PV déjà rédigés sont conservés.`)) sauver(modeles.filter((x) => x.id !== m.id), "Modèle supprimé."); }}>Supprimer</button>
                  </div>
                </div>
              </div>
            );
          })}
          {modeles.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun modèle de PV pour l'instant. Pars d'un modèle type ci-dessus pour gagner du temps.</div>}
        </div>
      </div>
    );
  }

  /* ----- Éditeur d'un modèle ----- */
  const m = editing;
  const upd = (patch) => setEditing((e) => ({ ...e, ...patch }));
  const majSection = (sid, fn) => upd({ sections: m.sections.map((s) => (s.id === sid ? fn(s) : s)) });
  const majChamp = (sid, key, patch) => majSection(sid, (s) => ({ ...s, fields: s.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
  const existe = modeles.some((x) => x.id === m.id);

  async function enregistrer() {
    if (!m.titre.trim()) { setMsg("Donne un titre au modèle (ex : Procès-verbal de constatation)."); return; }
    const propre = {
      ...m, titre: m.titre.trim(), serie: (m.serie || "PV").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "PV",
      sections: m.sections.map((s) => ({ ...s, title: s.title.trim() || "Chapitre", fields: s.fields.filter((f) => f.label.trim()).map((f) => ({ ...f, label: f.label.trim(), options: (f.options || []).map((o) => o.trim()).filter(Boolean) })) })).filter((s) => s.fields.length > 0),
    };
    if (propre.sections.length === 0) { setMsg("Ajoute au moins une rubrique avec un intitulé."); return; }
    if (propre.sections.some((s) => s.fields.some((f) => (f.type === "select" || f.type === "cases") && f.options.length === 0))) { setMsg("Une liste de choix ou des cases à cocher n'ont aucune option : ajoute-en (une par ligne)."); return; }
    const ok = await sauver(existe ? modeles.map((x) => (x.id === propre.id ? propre : x)) : [...modeles, propre], "Modèle enregistré.");
    if (ok) setEditing(null);
  }

  return (
    <div>
      <div style={{ borderLeft: `6px solid ${accent}`, paddingLeft: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: accent, fontWeight: 800 }}>ÉDITEUR DE MODÈLE DE PV</div>
        <h2 style={{ ...h2Style, margin: "2px 0 0", borderBottom: "none", paddingBottom: 0 }}>{existe ? "Modifier le modèle" : "Nouveau modèle de PV"}</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 22, alignItems: "start" }}>
        <div>
          <div style={card}>
            <Field label="Titre du procès-verbal" value={m.titre} onChange={(v) => upd({ titre: v })} placeholder="Ex : Procès-verbal de constatation" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Type de PV" value={m.type || "Autre"} onChange={(v) => upd({ type: v })} options={TYPES_PV} />
              <Field label="Préfixe du numéro (2 à 6 lettres)" value={m.serie} onChange={(v) => upd({ serie: v.toUpperCase() })} placeholder="Ex : CST" />
            </div>
            <Field label="Mention de visa / textes applicables (facultatif)" textarea value={m.visa} onChange={(v) => upd({ visa: v })} placeholder="Ex : Vu les articles … du Code pénal." />
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={!!m.actif} onChange={(e) => upd({ actif: e.target.checked })} /> Modèle disponible pour les gendarmes</label>
          </div>
          <div style={{ background: "#F4F7FB", border: "1px dashed #B8C3D6", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#3A4D6B", marginBottom: 14, lineHeight: 1.55 }}>
            <b>Ajoutés automatiquement à chaque PV :</b> numéro, date et heure de rédaction, rédacteur (grade, nom, RIO, qualité judiciaire), unité, date / heure / lieu des faits, formule de clôture, signature et visa de l'OPJ. Tu n'as à définir que les chapitres et rubriques ci-dessous.
          </div>

          {m.sections.map((s, si) => (
            <div key={s.id} style={{ ...card, borderTop: `4px solid ${accent}` }}>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                <div style={{ width: 34, fontWeight: 800, color: accent, paddingBottom: 18, fontSize: 15 }}>{ROMAIN[si] || si + 1}.</div>
                <div style={{ flex: 1 }}><Field label="Titre du chapitre" value={s.title} onChange={(v) => majSection(s.id, (x) => ({ ...x, title: v }))} /></div>
                <button type="button" style={{ ...btn, marginBottom: 12 }} onClick={() => upd({ sections: bouger(m.sections, si, -1) })}>↑</button>
                <button type="button" style={{ ...btn, marginBottom: 12 }} onClick={() => upd({ sections: bouger(m.sections, si, 1) })}>↓</button>
                <button type="button" style={{ ...btn, marginBottom: 12, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => { if (window.confirm("Supprimer ce chapitre et ses rubriques ?")) upd({ sections: m.sections.filter((x) => x.id !== s.id) }); }}>✕</button>
              </div>
              {s.fields.map((f, fi) => (
                <div key={f.key} style={{ border: "1px solid #E0E7F1", borderRadius: 8, padding: 10, marginBottom: 8, background: "#FAFBFD" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <input value={f.label} onChange={(e) => majChamp(s.id, f.key, { label: e.target.value })} placeholder="Intitulé de la rubrique" style={{ ...inp, flex: 2, minWidth: 160 }} />
                    <select value={f.type} onChange={(e) => majChamp(s.id, f.key, { type: e.target.value })} style={{ ...inp, flex: 1.2, minWidth: 150 }}>
                      {TYPES_CHAMP_PV.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={!!f.required} onChange={(e) => majChamp(s.id, f.key, { required: e.target.checked })} /> Obligatoire</label>
                    <button type="button" style={btn} onClick={() => majSection(s.id, (x) => ({ ...x, fields: bouger(x.fields, fi, -1) }))}>↑</button>
                    <button type="button" style={btn} onClick={() => majSection(s.id, (x) => ({ ...x, fields: bouger(x.fields, fi, 1) }))}>↓</button>
                    <button type="button" style={{ ...btn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => majSection(s.id, (x) => ({ ...x, fields: x.fields.filter((y) => y.key !== f.key) }))}>✕</button>
                  </div>
                  {(f.type === "select" || f.type === "cases") && (
                    <textarea value={(f.options || []).join("\n")} onChange={(e) => majChamp(s.id, f.key, { options: e.target.value.split("\n") })} placeholder="Une option par ligne" rows={3} style={{ ...inp, width: "100%", marginTop: 8, resize: "vertical" }} />
                  )}
                </div>
              ))}
              <button type="button" style={smallBtn} onClick={() => majSection(s.id, (x) => ({ ...x, fields: [...x.fields, { key: "f_" + newId(), label: "", type: "text", required: false, options: [] }] }))}>+ Ajouter une rubrique</button>
            </div>
          ))}
          <button type="button" style={{ ...smallBtn, marginBottom: 16 }} onClick={() => upd({ sections: [...m.sections, { id: newId(), title: "", fields: [] }] })}>+ Ajouter un chapitre</button>
          {msg && <div style={{ color: "#C0172D", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="gh-btn-anim" onClick={enregistrer} style={{ ...buttonPrimary, width: "auto", padding: "10px 22px", marginTop: 0, background: accent }}>Enregistrer le modèle</button>
            <button style={smallBtn} onClick={() => { setEditing(null); setMsg(""); }}>Annuler</button>
          </div>
        </div>

        <div style={{ position: "sticky", top: 70 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.6, color: "#5A6B84", fontWeight: 800, marginBottom: 8 }}>APERÇU DU PV (mise à jour en direct)</div>
          <div style={{ transform: "scale(0.9)", transformOrigin: "top left", width: "111%" }}>
            <FichePV pv={apercuPV(m)} apercu />
          </div>
        </div>
      </div>
    </div>
  );
}
