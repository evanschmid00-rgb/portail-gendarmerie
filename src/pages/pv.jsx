// pages/pv.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { N, NeoAlerte, NeoBandeau, NeoBouton, NeoCarte, NeoCompteur, NeoOnglets, NEO_INP } from "../composants/neo.jsx";
import React, { useEffect, useRef, useState } from "react";
import { PreuvesAffichage, PreuvesEditeur } from "../composants/Preuves.jsx";
import { Field, Select, buttonPrimary, h2Style, labelStyle, selectStyle, smallBtn } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";
import { QUALITE_LONGUE, ROMAIN, cleJour, dateEnLettres, dateFR, heureEnLettres, newId } from "../lib/utils.js";
import { CodeBarres } from "../composants/CodeBarres.jsx";
import { LogoGN } from "../composants/LogoGN.jsx";
import { ChoixInfractions } from "../composants/ChoixInfractions.jsx";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { personnesDuPV } from "../lib/dossierPersonne.js";
import { PseudosAgent, trouverAgent } from "../composants/Pseudos.jsx";

const COULEUR_GRAVITE = { Contravention: "#2E7D4F", "Délit": "#C77700", Crime: "#C0172D" };
const TYPES_PV = ["Constatation", "Interpellation", "Audition", "Saisie", "Accident", "Autre"];
const COULEURS_PV = { Plainte: "#0E7C86", Constatation: "#123A7A", Interpellation: "#C0172D", Audition: "#6B3FA0", Saisie: "#B25E00", Accident: "#2E7D4F", Autre: "#3A4D6B" };
const TYPES_CHAMP_PV = [
  { value: "text", label: "Texte court" }, { value: "textarea", label: "Texte long" }, { value: "number", label: "Nombre" },
  { value: "date", label: "Date" }, { value: "time", label: "Heure" }, { value: "select", label: "Liste de choix" },
  { value: "cases", label: "Cases à cocher" }, { value: "oui_non", label: "Oui / Non" },
  { value: "personne", label: "Identité d'une personne" }, { value: "vehicule", label: "Véhicule" },
  { value: "preuves", label: "Preuves (photos, vidéos, liens)" },
  { value: "infractions", label: "Infractions (choix dans le code pénal)" },
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
    { title: "Circonstances", fields: [FP("Nature de l'infraction", "text", { required: true }), FP("Infractions retenues", "infractions"), FP("Description des faits", "textarea", { required: true })] },
    { title: "Personne mise en cause", fields: [FP("Personne mise en cause", "personne", { required: true })] },
    { title: "Véhicule", fields: [FP("Véhicule concerné", "vehicule")] },
    { title: "Constatations", fields: [FP("Éléments relevés", "textarea"), FP("Éléments de preuve", "cases", { options: ["Photos", "Vidéo", "Témoignage", "Mesure radar", "Aucun"] }), FP("Témoins éventuels", "textarea")] },
  ] },
  { nom: "Procès-verbal d'interpellation", type: "Interpellation", serie: "INT", visa: "", sections: [
    { title: "Circonstances de l'interpellation", fields: [FP("Heure de l'interpellation", "time", { required: true }), FP("Lieu précis", "text"), FP("Motif de l'interpellation", "textarea", { required: true }), FP("Infractions reprochées", "infractions"), FP("Résistance opposée", "oui_non", { required: true }), FP("Usage de la force", "oui_non", { required: true }), FP("Précisions sur l'usage de la force", "textarea")] },
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

// Modèle « plainte à la CGD » proposé à tous les gendarmes tant qu'aucun modèle de plainte n'existe
export const MODELE_PLAINTE_DEFAUT = { ...avecIdsPV(MODELES_PV_TYPES[0]), id: "plainte-defaut" };

// Valeur vide selon le type de champ
function valeurVidePV(type) {
  if (type === "cases" || type === "preuves" || type === "infractions") return [];
  if (type === "personne") return { nom: "", prenom: "", naissance: "", roblox: "", robloxPseudo: "", robloxId: "", robloxUsername: "" };
  if (type === "vehicule") return { modele: "", plaque: "", couleur: "" };
  return "";
}
const estVidePV = (type, v) => {
  if (type === "cases" || type === "preuves" || type === "infractions") return !v || v.length === 0;
  if (type === "personne") return !v || !(v.nom || "").trim() || !(v.prenom || "").trim() || !v.robloxId; // un compte Roblox vérifié est obligatoire (dossier de la personne)
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
        {v.roblox ? ` — compte Roblox : ${v.robloxPseudo ? v.robloxPseudo + " " : ""}(@${String(v.roblox).replace(/^@/, "")})` : ""}
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
  if (a.type === "infractions") {
    if (!v || !v.length) return vide;
    return <span>{v.map((x, k) => <div key={k}>• <b>{x.nom}</b>{x.type ? <span style={{ color: COULEUR_GRAVITE[x.type] || "#555", fontSize: 12, fontWeight: 700 }}> ({x.type})</span> : null}</div>)}</span>;
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

export function FichePV({ pv, apercu, onClose, canVisa, onVisa, onDupliquer, onRenvoi, onCorriger }) {
  const refDoc = useRef(null);
  const [visaOuvert, setVisaOuvert] = useState(false);
  const [renvoiOuvert, setRenvoiOuvert] = useState(false);
  const [motifRenvoi, setMotifRenvoi] = useState("");
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
  // Infractions relevées dans tout le PV (champs « Infractions » choisis dans le code pénal)
  const infractions = [];
  (pv.answers || []).forEach((a) => { if (a.type === "infractions" && Array.isArray(a.value)) a.value.forEach((x) => { if (x && x.nom && !infractions.some((y) => y.nom === x.nom)) infractions.push(x); }); });

  function imprimer() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${pv.ref || "Procès-verbal"}</title><style>body{margin:16px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:10mm}</style></head><body>${refDoc.current.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }
  async function renvoyer() {
    if (!motifRenvoi.trim()) return;
    setBusy(true);
    const ok = await onRenvoi(pv.id, motifRenvoi.trim());
    setBusy(false);
    if (ok) { setRenvoiOuvert(false); setMotifRenvoi(""); }
  }
  async function viser() {
    setBusy(true);
    const ok = await onVisa(pv.id, obs.trim());
    setBusy(false);
    if (ok) { setVisaOuvert(false); setObs(""); }
  }

  const serif = "Georgia, 'Times New Roman', serif";
  const sans = "Arial, sans-serif";
  const cellule = { padding: "8px 11px", borderTop: "1px solid #D9DFEA", verticalAlign: "top", fontSize: 13.5, lineHeight: 1.5 };
  const etape = (ok, titre, detail) => (
    <div style={{ flex: 1, minWidth: 150, display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: ok ? "#2E7D4F" : "#D3DDEA", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{ok ? "✓" : ""}</span>
      <span style={{ fontSize: 12, lineHeight: 1.35, color: ok ? "#14213A" : "#8A97AB" }}><b>{titre}</b><br />{detail}</span>
    </div>
  );

  return (
    <div>
      {!apercu && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          {onClose && <button style={smallBtn} onClick={onClose}>← Retour aux procès-verbaux</button>}
          <button style={smallBtn} onClick={imprimer}>🖨 Imprimer / PDF</button>
          {onDupliquer && <button style={smallBtn} onClick={onDupliquer}>⧉ Dupliquer ce PV</button>}
          {onCorriger && !pv.traite && pv.aCorriger && <button style={{ ...smallBtn, background: "#C0172D", color: "#fff", borderColor: "#C0172D" }} onClick={onCorriger}>✏️ Corriger et renvoyer</button>}
          {canVisa && !pv.traite && !pv.aCorriger && <button style={{ ...smallBtn, background: "#123A7A", color: "#fff", borderColor: "#123A7A" }} onClick={() => { setVisaOuvert(!visaOuvert); setRenvoiOuvert(false); }}>✔ Viser ce PVe</button>}
          {canVisa && onRenvoi && !pv.traite && !pv.aCorriger && <button style={smallBtn} onClick={() => { setRenvoiOuvert(!renvoiOuvert); setVisaOuvert(false); }}>↩ Renvoyer pour correction</button>}
        </div>
      )}
      {!apercu && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "10px 14px", marginBottom: 14, maxWidth: 820, fontFamily: "'Inter', Arial, sans-serif" }}>
          {etape(true, "Rédigé", new Date(pv.createdAt).toLocaleString("fr-FR"))}
          {(pv.aCorriger || pv.correction) && etape(!pv.aCorriger, "Renvoyé pour correction", pv.correction ? new Date(pv.correction.le).toLocaleString("fr-FR") : "")}
          {etape(!!pv.traite, "Visé par un OPJ", pv.visa ? new Date(pv.visa.le).toLocaleString("fr-FR") : "en attente")}
        </div>
      )}
      {!apercu && pv.aCorriger && !pv.traite && (
        <div style={{ background: "#FDECEE", border: "1px solid #E8A0AA", borderLeft: "5px solid #C0172D", borderRadius: 10, padding: "11px 15px", marginBottom: 14, maxWidth: 820, fontSize: 13.5, color: "#7A0F1E", lineHeight: 1.5 }}>
          <b>↩ Renvoyé pour correction</b>{pv.correction ? ` par ${pv.correction.grade} ${pv.correction.par}` : ""}<br />« {pv.correction ? pv.correction.commentaire : ""} »
        </div>
      )}
      {renvoiOuvert && !apercu && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 16, marginBottom: 14, maxWidth: 820 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Renvoyer le PVe à son rédacteur</div>
          <Field label="Ce qu'il faut corriger (obligatoire)" textarea value={motifRenvoi} onChange={setMotifRenvoi} />
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={busy || !motifRenvoi.trim()} onClick={renvoyer} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 0, background: "#C0172D" }}>{busy ? "…" : "Renvoyer au rédacteur"}</button>
            <button style={smallBtn} onClick={() => setRenvoiOuvert(false)}>Annuler</button>
          </div>
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

      <div ref={refDoc} style={{ position: "relative", background: "#fff", backgroundImage: "repeating-linear-gradient(45deg, rgba(18,58,122,0.022) 0 2px, transparent 2px 9px)", border: "1px solid #C9D3E3", borderRadius: 4, maxWidth: 820, fontFamily: serif, color: "#111", boxShadow: "0 14px 34px -22px rgba(7,20,46,0.55)", overflow: "hidden" }}>
        <div style={{ display: "flex", height: 7 }}><div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: "#C0172D" }} /></div>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", opacity: 0.035, fontSize: 96, fontWeight: 700, letterSpacing: 8, transform: "rotate(-24deg)", whiteSpace: "nowrap", color: couleur }}>GENDARMERIE</div>
        <div style={{ padding: "24px 38px 28px", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <LogoGN taille={62} anneau={false} style={{ boxShadow: `0 0 0 2px ${couleur}`, flexShrink: 0 }} />
              <div style={{ fontSize: 12, lineHeight: 1.5, letterSpacing: 0.4 }}>
                <div style={{ fontSize: 10.5, letterSpacing: 2.5, color: "#555" }}>RÉPUBLIQUE FRANÇAISE · NÉOGEND</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>GENDARMERIE NATIONALE</div>
                <div>CGD de Saint-Tropez RP · {pv.auteurUnite || "Brigade territoriale"}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.5, color: "#555" }}>PROCÈS-VERBAL ÉLECTRONIQUE · PVe N°</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 15, border: `2px solid ${couleur}`, color: couleur, padding: "3px 10px", display: "inline-block", marginTop: 3 }}>{pv.ref || "—"}</div>
              <div style={{ marginTop: 6 }}><CodeBarres valeur={pv.ref || "PV"} largeur={170} hauteur={26} /></div>
            </div>
          </div>

          <div style={{ textAlign: "center", margin: "20px 0 4px", borderTop: "3px double #111", borderBottom: "3px double #111", padding: "12px 0" }}>
            <div style={{ fontSize: 21, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, lineHeight: 1.25 }}>{pv.modeleTitre || "Procès-verbal"}</div>
            {pv.modeleType && <div style={{ fontSize: 12, color: "#555", marginTop: 4, letterSpacing: 2, textTransform: "uppercase" }}>— {pv.modeleType} —</div>}
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.75, textAlign: "justify", margin: "16px 0" }}>
            L'an {l.an}, le {l.jour} {l.mois}, à {heureEnLettres(d.getHours(), d.getMinutes())},<br />
            Nous soussigné(e) <b>{pv.auteurGrade} {(pv.auteurNom || "").trim().split(/\s+/)[0]} {(pv.auteurNom || "").trim().split(/\s+/).slice(1).join(" ").toUpperCase()}</b>, {qualiteLongue}
            {pv.auteurRIO ? <> (RIO n° <span style={{ fontFamily: "'Courier New', monospace" }}>{pv.auteurRIO}</span>)</> : null}, affecté(e) à l'unité « {pv.auteurUnite || "Brigade territoriale"} », agissant dans le cadre de nos fonctions,<br />
            rapportons les opérations suivantes :
          </p>
          {pv.visaLegal && <p style={{ fontSize: 13, fontStyle: "italic", color: "#333", margin: "0 0 14px" }}>{pv.visaLegal}</p>}

          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #B8C3D6", marginBottom: 18, fontFamily: sans }}>
            <tbody>
              <tr>
                {[["Date des faits", faits.date ? dateFR(faits.date) : ""], ["Heure des faits", faits.heure ? faits.heure.replace(":", "h") : ""], ["Lieu de rédaction", faits.lieu || ""]].map(([k, v]) => (
                  <td key={k} style={{ padding: "8px 12px", borderRight: "1px solid #B8C3D6", background: "#F4F7FB", width: k === "Lieu de rédaction" ? "44%" : "28%" }}>
                    <div style={{ fontSize: 10, letterSpacing: 1, color: "#555", textTransform: "uppercase" }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{v || (apercu ? "……………" : "—")}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          {!Number.isNaN(hF) && faits.heure && <div style={{ fontSize: 12, color: "#555", margin: "-10px 0 16px", fontStyle: "italic" }}>Faits survenus à {heureEnLettres(hF, mF || 0)}.</div>}

          {infractions.length > 0 && (
            <div style={{ border: `1.5px solid ${couleur}`, borderRadius: 4, padding: "10px 14px", marginBottom: 18, background: "rgba(255,255,255,0.8)" }}>
              <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: couleur, fontWeight: 800, marginBottom: 4 }}>Qualification juridique — infractions relevées</div>
              {infractions.map((x) => <div key={x.nom} style={{ fontSize: 14 }}>• <b>{x.nom}</b>{x.type ? <span style={{ fontFamily: sans, fontSize: 11.5, fontWeight: 700, color: COULEUR_GRAVITE[x.type] || "#555" }}> · {x.type}</span> : null}</div>)}
            </div>
          )}

          {chapitres.map((c, i) => (
            <div key={c.titre + i} style={{ marginBottom: 16 }}>
              <div style={{ background: couleur, color: "#fff", fontFamily: sans, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, padding: "6px 12px", textTransform: "uppercase" }}>{ROMAIN[i] || i + 1}. {c.titre || "Informations"}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #B8C3D6", borderTop: "none", background: "rgba(255,255,255,0.85)" }}>
                <tbody>
                  {c.lignes.map((a, k) => (
                    a.type === "textarea" ? (
                      <tr key={k}><td colSpan={2} style={cellule}><div style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: "#444", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{a.label}</div><ValeurPV a={a} apercu={apercu} /></td></tr>
                    ) : (
                      <tr key={k}>
                        <td style={{ ...cellule, width: "34%", background: "#F4F7FB", fontFamily: sans, fontSize: 12, fontWeight: 700, color: "#333" }}>{a.label}</td>
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
            <div style={{ flex: 1, minWidth: 220, border: "1px solid #B8C3D6", padding: "10px 14px", minHeight: 110, background: "rgba(255,255,255,0.85)" }}>
              <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: 1, color: "#555", textTransform: "uppercase" }}>Le rédacteur</div>
              <div style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: 26, color: "#123A7A", margin: "8px 0 2px", lineHeight: 1.1 }}>{(pv.auteurNom || "").split(" ").slice(-1)[0] || ""}</div>
              <div style={{ fontSize: 12 }}>{pv.auteurGrade} {pv.auteurNom}{pv.auteurRIO ? ` — RIO ${pv.auteurRIO}` : ""}</div>
            </div>
            <div style={{ flex: 1, minWidth: 220, border: "1px solid #B8C3D6", padding: "10px 14px", minHeight: 110, position: "relative", background: "rgba(255,255,255,0.85)" }}>
              <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: 1, color: "#555", textTransform: "uppercase" }}>Visa de l'officier de police judiciaire</div>
              {pv.visa ? (
                <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5 }}>
                  <div style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: 24, color: "#1F6B42", lineHeight: 1.1 }}>{(pv.visa.par || "").split(" ").slice(-1)[0]}</div>
                  <div>{pv.visa.grade} {pv.visa.par}{pv.visa.rio ? ` — RIO ${pv.visa.rio}` : ""}</div>
                  <div style={{ color: "#555" }}>Visé le {new Date(pv.visa.le).toLocaleString("fr-FR")}</div>
                  {pv.visa.observations && <div style={{ marginTop: 4, fontStyle: "italic" }}>« {pv.visa.observations} »</div>}
                  <div style={{ position: "absolute", right: 10, bottom: 8, transform: "rotate(-12deg)", border: "3px double #1F6B42", color: "#1F6B42", borderRadius: 6, padding: "2px 10px", fontFamily: sans, fontSize: 15, fontWeight: 800, letterSpacing: 3, opacity: 0.8 }}>VISÉ</div>
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12.5, color: "#8A97AB" }}>{apercu ? "Zone réservée au visa" : "En attente de visa"}</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 10, borderTop: "1px solid #D9DFEA", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontFamily: sans, fontSize: 10, color: "#777", lineHeight: 1.5, flex: 1, minWidth: 220 }}>
              Document de jeu de rôle (Roblox) — sans valeur officielle, sans lien avec la Gendarmerie nationale réelle.<br />Feuillet 1/1 · Réf. {pv.ref || "—"}
            </div>
            <CodeBarres valeur={(pv.ref || "PV").replace(/[^A-Z0-9]/gi, "")} largeur={150} hauteur={22} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Rédaction d'un PV par un gendarme ---------- */

function ChampPV({ f, v, onChange, codePenal = [] }) {
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
  if (f.type === "infractions") return <div style={{ marginBottom: 14 }}>{lab}<ChoixInfractions codePenal={codePenal} choisies={Array.isArray(v) ? v : []} onChange={onChange} /></div>;
  if (f.type === "personne") return <ChampPersonnePV lab={lab} v={v} onChange={onChange} />;
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

/* ---------- Personne citée dans un PV : identité + compte Roblox vérifié (sert à classer le PV dans son dossier) ---------- */

// Vérifie un compte Roblox. Renvoie { ok, patch } ou { ok:false, erreur }
async function verifierRoblox(v) {
  const at = String(v.roblox || "").trim().replace(/^@/, "");
  if (!at) return { ok: false, erreur: "Renseigne le @ Roblox exact de la personne (nom d'utilisateur, sans espace)." };
  try {
    const r = await fetch(`/api/roblox-head?pseudo=${encodeURIComponent(at)}`);
    const j = await r.json();
    if (!j.id) return { ok: false, erreur: j.message || "Compte Roblox introuvable." };
    const pseudo = String(v.robloxPseudo || "").trim();
    if (pseudo && j.displayName && j.displayName.trim().toLowerCase() !== pseudo.toLowerCase()) {
      return { ok: false, erreur: `Le compte @${j.nom} s'appelle « ${j.displayName} » sur Roblox, pas « ${pseudo} ». Corrige le pseudo ou laisse-le vide.` };
    }
    return { ok: true, patch: { robloxId: String(j.id), roblox: j.nom || at, robloxUsername: j.nom || at, robloxPseudo: j.displayName || pseudo || j.nom || at } };
  } catch (e) { return { ok: false, erreur: "Roblox ne répond pas, réessaie dans un instant." }; }
}

function ChampPersonnePV({ lab, v, onChange }) {
  const [verif, setVerif] = useState({ busy: false, erreur: "" });
  const avatars = useAvatars([v.robloxId]);
  const set = (patch) => onChange({ ...v, ...patch });
  const verifie = !!v.robloxId;
  async function verifier() {
    setVerif({ busy: true, erreur: "" });
    const r = await verifierRoblox(v);
    if (r.ok) { set(r.patch); setVerif({ busy: false, erreur: "" }); } else setVerif({ busy: false, erreur: r.erreur });
  }
  // Vérification automatique quand on quitte le champ @ Roblox
  const auDepart = () => { if (!verifie && !verif.busy && String(v.roblox || "").trim()) verifier(); };
  return (
    <div style={{ marginBottom: 14, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 12 }}>
      {lab}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Nom" value={v.nom} onChange={(x) => set({ nom: x })} />
        <Field label="Prénom" value={v.prenom} onChange={(x) => set({ prenom: x })} />
        <Field label="Date de naissance" type="date" value={v.naissance} onChange={(x) => set({ naissance: x })} />
        <span />
        <div onBlur={auDepart}><Field label="@ Roblox (nom d'utilisateur exact) — vérifié automatiquement" value={v.roblox} onChange={(x) => set({ roblox: x, robloxId: "", robloxUsername: "" })} placeholder="Ex : @MonPseudo" /></div>
        <Field label="Pseudo Roblox (nom affiché) — rempli automatiquement" value={v.robloxPseudo || ""} onChange={(x) => set({ robloxPseudo: x, robloxId: "", robloxUsername: "" })} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={verifier} disabled={verif.busy} style={smallBtn}>{verif.busy ? "Vérification…" : "Vérifier le compte Roblox"}</button>
        {verifie && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar src={avatars[v.robloxId]} taille={40} />
            <div style={{ fontSize: 12 }}><b>{v.robloxPseudo}</b> · @{v.robloxUsername || v.roblox} ✅<div style={{ color: "#2E7D4F" }}>Ce PV sera classé dans le dossier de cette personne.</div></div>
          </div>
        )}
        {!verifie && !verif.erreur && <span style={{ fontSize: 11.5, color: "#5A6B84" }}>Le compte Roblox sert à retrouver le dossier de la personne.</span>}
      </div>
      {verif.erreur && <div style={{ color: "#C0172D", fontSize: 12, marginTop: 6 }}>{verif.erreur}</div>}
    </div>
  );
}

function PVNouveau({ modele, current, onSubmit, onCancel, codePenal = [], initial = null, correction = null }) {
  const aujourdhui = cleJour(new Date());
  const cleBrouillon = `pv_brouillon_${current.matricule || ""}_${modele.id}`;
  const brouillon = initial || (correction ? null : (() => { try { return JSON.parse(localStorage.getItem(cleBrouillon) || "null"); } catch (e) { return null; } })());
  const lieuxRecents = (() => { try { return JSON.parse(localStorage.getItem("pv_lieux_recents") || "[]"); } catch (e) { return []; } })();
  const [restaure, setRestaure] = useState(!!brouillon && !initial);
  const [faits, setFaits] = useState(brouillon && brouillon.faits ? brouillon.faits : { date: aujourdhui, heure: new Date().toTimeString().slice(0, 5), lieu: "" });
  const [values, setValues] = useState(() => {
    const v = {};
    modele.sections.forEach((s) => s.fields.forEach((f) => { v[f.key] = brouillon && brouillon.values && brouillon.values[f.key] !== undefined ? brouillon.values[f.key] : valeurVidePV(f.type); }));
    return v;
  });
  const [etape, setEtape] = useState(0);
  const [sauve, setSauve] = useState(null);
  const [certifie, setCertifie] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const haut = useRef(null);
  const total = modele.sections.length + 2; // 0 = faits, 1..n = chapitres, dernier = relecture
  const derniere = total - 1;

  useEffect(() => {
    if (correction) return undefined;
    const t = setTimeout(() => { try { localStorage.setItem(cleBrouillon, JSON.stringify({ faits, values, savedAt: new Date().toISOString() })); setSauve(new Date()); } catch (e) { /* stockage indisponible */ } }, 600);
    return () => clearTimeout(t);
  }, [faits, values]);
  function effacerBrouillon() { try { localStorage.removeItem(cleBrouillon); } catch (e) { /* rien */ } }

  const couleur = COULEURS_PV[modele.type] || "#123A7A";
  const card = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "16px 18px", marginBottom: 14 };
  const titreEtape = (i) => (i === 0 ? "Faits" : i === derniere ? "Relecture" : modele.sections[i - 1].title);

  function verifierEtape(i) {
    if (i === 0) return faits.lieu.trim() ? "" : "Indique le lieu de rédaction.";
    if (i === derniere) return "";
    const sec = modele.sections[i - 1];
    for (const f of sec.fields) if (f.required && estVidePV(f.type, values[f.key])) return `Champ obligatoire à compléter : « ${f.label} ».`;
    return "";
  }
  function aller(i) { setEtape(i); setError(""); if (haut.current) haut.current.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function suivant() { const e = verifierEtape(etape); if (e) { setError(e); return; } aller(Math.min(derniere, etape + 1)); }

  const answersDe = (vals) => modele.sections.flatMap((s) => s.fields.map((f) => ({ section: s.title, label: f.label, type: f.type, value: vals[f.key] })));
  const apercu = {
    ref: correction ? correction.ref : "attribué à l'envoi", modeleTitre: modele.titre, modeleType: modele.type, visaLegal: modele.visa || "", faits, answers: answersDe(values),
    createdAt: new Date().toISOString(), auteurNom: `${current.prenom} ${current.nom}`, auteurGrade: current.grade, auteurRIO: current.cipcNumero || "", auteurQualite: current.qualiteJudiciaire || "APJA", auteurUnite: current.unite || "",
  };

  async function envoyer() {
    for (let i = 0; i < derniere; i++) { const e = verifierEtape(i); if (e) { setEtape(i); setError(`Étape « ${titreEtape(i)} » : ${e}`); return; } }
    // Une personne dont on a saisi un @ Roblox doit avoir son compte vérifié : fait automatiquement ici si ce n'est pas déjà fait
    const valeursFinales = { ...values };
    for (const s of modele.sections) for (const f of s.fields) {
      const pv = valeursFinales[f.key];
      if (f.type === "personne" && pv && String(pv.roblox || "").trim() && !pv.robloxId) {
        setBusy(true);
        const r = await verifierRoblox(pv);
        setBusy(false);
        if (!r.ok) { setError(`« ${f.label} » : ${r.erreur}`); return; }
        valeursFinales[f.key] = { ...pv, ...r.patch };
      }
    }
    if (!certifie) { setError("Coche la case de certification pour clore et signer le PVe."); return; }
    setError("");
    setBusy(true);
    const saved = await onSubmit({ modeleId: modele.id, modeleTitre: modele.titre, modeleType: modele.type || "Autre", serie: modele.serie || "PV", visaLegal: modele.visa || "", faits: { ...faits, lieu: faits.lieu.trim() }, answers: answersDe(valeursFinales) });
    setBusy(false);
    if (!saved) setError("Échec de l'envoi, réessaie dans un instant.");
    else {
      effacerBrouillon();
      try { const l = faits.lieu.trim(); localStorage.setItem("pv_lieux_recents", JSON.stringify([l, ...lieuxRecents.filter((x) => x !== l)].slice(0, 8))); } catch (e) { /* rien */ }
    }
  }
  const soumettre = (e) => { e.preventDefault(); if (etape < derniere) suivant(); else envoyer(); };
  const numeroRomain = (i) => ROMAIN[i - 1] || i;

  return (
    <form onSubmit={soumettre} ref={haut}>
      <button type="button" style={{ ...smallBtn, marginBottom: 14 }} onClick={onCancel}>← Retour {correction ? "" : "(le brouillon est gardé)"}</button>
      <div style={{ background: couleur, color: "#fff", borderRadius: 14, padding: "16px 20px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.8 }}>{correction ? "CORRECTION DU PVe " + (correction.ref || "") : "NOUVEAU PVe"}</div>
        <div style={{ fontFamily: FONT_TITRE, fontSize: 24, fontWeight: 700, margin: "2px 0 6px" }}>{modele.titre}</div>
        <div style={{ fontSize: 12.5, opacity: 0.9 }}>Rédacteur : {current.grade} {current.prenom} {current.nom} — {QUALITE_LONGUE[current.qualiteJudiciaire] || QUALITE_LONGUE.APJA}{current.unite ? ` — ${current.unite}` : ""}</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{sauve ? `💾 Brouillon enregistré à ${sauve.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Le numéro, la date et l'heure de rédaction sont ajoutés automatiquement."}</div>
      </div>

      {correction && correction.correction && (
        <div style={{ background: "#FDECEE", border: "1px solid #E8A0AA", borderLeft: "5px solid #C0172D", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13.5, color: "#7A0F1E", lineHeight: 1.5 }}>
          <b>Renvoyé pour correction par {correction.correction.grade} {correction.correction.par}</b><br />« {correction.correction.commentaire || "Aucun commentaire"} »
        </div>
      )}

      {/* Barre d'étapes */}
      <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ height: 6, borderRadius: 4, background: "#E3EAF5", overflow: "hidden", marginBottom: 12 }}><div style={{ width: `${((etape + 1) / total) * 100}%`, height: "100%", background: couleur, transition: "width .25s" }} /></div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {Array.from({ length: total }).map((_, i) => {
            const fait = i < etape, courant = i === etape;
            return (
              <button key={i} type="button" disabled={i > etape} onClick={() => aller(i)} style={{ display: "flex", alignItems: "center", gap: 7, border: 0, background: courant ? couleur : "transparent", color: courant ? "#fff" : fait ? "#2E7D4F" : "#8A97AB", borderRadius: 20, padding: "5px 12px 5px 6px", cursor: i > etape ? "default" : "pointer", fontFamily: FONT_BASE, flexShrink: 0 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: courant ? "#fff" : fait ? "#2E7D4F" : "#E3EAF5", color: courant ? couleur : fait ? "#fff" : "#8A97AB", fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{fait ? "✓" : i + 1}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>{titreEtape(i)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {restaure && etape === 0 && (
        <div style={{ background: "#FFF4E0", border: "1px solid #E8A33A", color: "#6B4E00", borderRadius: 10, padding: "9px 14px", marginBottom: 14, fontSize: 13, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span>📝 Brouillon retrouvé : tu reprends là où tu t'étais arrêté.</span>
          <button type="button" style={smallBtn} onClick={() => { effacerBrouillon(); const v = {}; modele.sections.forEach((s) => s.fields.forEach((f) => { v[f.key] = valeurVidePV(f.type); })); setValues(v); setFaits({ date: aujourdhui, heure: new Date().toTimeString().slice(0, 5), lieu: "" }); setRestaure(false); }}>Repartir de zéro</button>
        </div>
      )}

      {etape === 0 && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800, color: couleur, letterSpacing: 0.6, marginBottom: 10, textTransform: "uppercase" }}>Informations générales</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <Field label="Date des faits" type="date" value={faits.date} onChange={(v) => setFaits({ ...faits, date: v })} />
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Heure des faits</label>
              <input type="time" value={faits.heure} onChange={(e) => setFaits({ ...faits, heure: e.target.value })} style={{ padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 14, background: "#fff", boxSizing: "border-box", width: "100%" }} />
            </div>
            <div style={{ marginBottom: 12, gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Lieu de rédaction *</label>
              <input list="pv-lieux" value={faits.lieu} onChange={(e) => setFaits({ ...faits, lieu: e.target.value })} placeholder={lieuxRecents.length ? "Choisis un lieu récent ou écris-en un" : ""} style={{ width: "100%", padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 14, background: "#fff", boxSizing: "border-box" }} />
              <datalist id="pv-lieux">{lieuxRecents.map((l) => <option key={l} value={l} />)}</datalist>
            </div>
          </div>
        </div>
      )}

      {etape >= 1 && etape < derniere && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800, color: couleur, letterSpacing: 0.6, marginBottom: 10, textTransform: "uppercase" }}>{numeroRomain(etape)}. {modele.sections[etape - 1].title}</div>
          {modele.sections[etape - 1].fields.map((f) => <ChampPV key={f.key} f={f} v={values[f.key]} codePenal={codePenal} onChange={(val) => setValues({ ...values, [f.key]: val })} />)}
        </div>
      )}

      {etape === derniere && (
        <>
          <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 10 }}>Relis ton procès-verbal tel qu'il sera transmis. Utilise « Précédent » pour corriger.</div>
          <FichePV pv={apercu} apercu />
          <div style={{ ...card, background: "#F5F8FC", marginTop: 14 }}>
            <label style={{ fontSize: 13.5, display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", lineHeight: 1.5 }}>
              <input type="checkbox" checked={certifie} onChange={(e) => setCertifie(e.target.checked)} style={{ marginTop: 4 }} />
              <span>Je certifie l'exactitude des faits relatés dans ce procès-verbal et le clos sous ma signature. Il sera transmis à l'officier de police judiciaire pour visa.</span>
            </label>
          </div>
        </>
      )}

      {error && <div role="alert" style={{ color: "#C0172D", fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>⚠️ {error}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {etape > 0 && <button type="button" style={{ ...smallBtn, padding: "11px 20px" }} onClick={() => aller(etape - 1)}>← Précédent</button>}
        {etape < derniere
          ? <button type="submit" className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "11px 26px", marginTop: 0, background: couleur }}>Suivant →</button>
          : <button type="submit" disabled={busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "11px 26px", marginTop: 0, background: couleur }}>{busy ? "Envoi…" : correction ? "Corriger et renvoyer à l'OPJ" : "Clore, signer et transmettre à l'OPJ"}</button>}
      </div>
    </form>
  );
}

/* ---------- Page « Procès-verbaux » ---------- */

// Brouillons enregistrés sur cet appareil (un par modèle)
function lireBrouillons(matricule, modeles) {
  const r = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const pref = `pv_brouillon_${matricule || ""}_`;
      if (!k || !k.startsWith(pref)) continue;
      const m = modeles.find((x) => x.id === k.slice(pref.length));
      if (!m) continue;
      let d = null; try { d = JSON.parse(localStorage.getItem(k)); } catch (e) { d = null; }
      if (d) r.push({ cle: k, modele: m, savedAt: d.savedAt || null, lieu: d.faits && d.faits.lieu });
    }
  } catch (e) { /* stockage indisponible */ }
  return r.sort((x, y) => String(y.savedAt).localeCompare(String(x.savedAt)));
}
const STATUTS_PV = { "a-viser": { t: "À VISER", c: "#B25E00" }, "a-corriger": { t: "À CORRIGER", c: "#C0172D" }, vise: { t: "VISÉ", c: "#2E7D4F" } };
const statutDe = (p) => (p.traite ? "vise" : p.aCorriger ? "a-corriger" : "a-viser");

export function PVPage({ current, modeles, pvs, onSubmit, onVisa, onRenvoi, onCorriger, onNavigate, personnel = [], codePenal = [] }) {
  const estOPJ = current.isAdmin || (current.qualifications || []).includes("OPJ") || current.qualiteJudiciaire === "OPJ";
  const peutVisa = estOPJ;
  const [vue, setVue] = useState(null); // null | { nouveau: modele, initial?, corriger? } | { fiche: id }
  const [tab, setTab] = useState("a-viser");
  const [recherche, setRecherche] = useState("");
  const [typeF, setTypeF] = useState("");
  const [tri, setTri] = useState("recent");
  const [seulementMes, setSeulementMes] = useState(false);
  const [pre, setPre] = useState(() => { try { const r = sessionStorage.getItem("gn-pve-pre"); if (r) { sessionStorage.removeItem("gn-pve-pre"); return JSON.parse(r); } } catch (e) { /* rien */ } return null; });
  const [brouillons, setBrouillons] = useState(() => lireBrouillons(current.matricule, Array.isArray(modeles) ? modeles : []));
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const toutes = (estOPJ ? pvs : pvs.filter((p) => p.auteurMatricule === current.matricule)).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const mesPV = toutes.filter((p) => p.auteurMatricule === current.matricule);
  const base = seulementMes ? mesPV : toutes;
  const aViser = base.filter((p) => statutDe(p) === "a-viser");
  const aCorriger = base.filter((p) => statutDe(p) === "a-corriger");
  const vises = base.filter((p) => p.traite);
  const mesACorriger = mesPV.filter((p) => statutDe(p) === "a-corriger");
  const heuresAttente = (p) => Math.max(0, (Date.now() - new Date(p.createdAt).getTime()) / 3600000);
  const enRetard = aViser.filter((p) => heuresAttente(p) >= 48).length;
  const types = Array.from(new Set(toutes.map((p) => p.modeleType).filter(Boolean)));
  const gens = (p) => personnesDuPV(p).map((x) => `${x.robloxPseudo || ""} ${x.roblox || ""} ${x.prenom} ${x.nom}`).join(" ");
  const infrDe = (p) => { const r = []; (p.answers || []).forEach((a) => { if (a.type === "infractions" && Array.isArray(a.value)) a.value.forEach((x) => { if (x && x.nom && !r.includes(x.nom)) r.push(x.nom); }); }); return r; };
  const source = tab === "a-viser" ? aViser : tab === "a-corriger" ? aCorriger : vises;
  const liste = source
    .filter((p) => !typeF || p.modeleType === typeF)
    .filter((p) => norm(`${p.ref} ${p.modeleTitre} ${p.auteurNom} ${p.faits ? p.faits.lieu : ""} ${gens(p)} ${infrDe(p).join(" ")}`).includes(norm(recherche)))
    .slice()
    .sort((a, b) => (tri === "ancien" ? String(a.createdAt).localeCompare(String(b.createdAt)) : tri === "type" ? String(a.modeleType).localeCompare(String(b.modeleType)) : String(b.createdAt).localeCompare(String(a.createdAt))));
  const puisRedigerModeles = Array.isArray(modeles) ? modeles : [];

  function valeursDe(m, pv) {
    const values = {};
    m.sections.forEach((s) => s.fields.forEach((f) => {
      const a = (pv.answers || []).find((x) => x.section === s.title && x.label === f.label && x.type === f.type);
      if (a && a.value !== undefined) values[f.key] = a.value;
    }));
    return values;
  }
  function dupliquer(pv) {
    const m = puisRedigerModeles.find((x) => x.id === pv.modeleId);
    if (!m) { window.alert("Le modèle de ce PVe n'existe plus : impossible de le dupliquer."); return; }
    const f = pv.faits || {};
    setVue({ nouveau: m, initial: { faits: { date: cleJour(new Date()), heure: new Date().toTimeString().slice(0, 5), lieu: f.lieu || "" }, values: valeursDe(m, pv) } });
  }
  function corriger(pv) {
    const m = puisRedigerModeles.find((x) => x.id === pv.modeleId);
    if (!m) { window.alert("Le modèle de ce PVe n'existe plus : impossible de le corriger."); return; }
    setVue({ nouveau: m, corriger: pv, initial: { faits: pv.faits || {}, values: valeursDe(m, pv) } });
  }
  // Ouvre un modèle ; si on vient du TAJ, la personne concernée est déjà renseignée
  function ouvrirModele(m) {
    if (!pre) { setVue({ nouveau: m }); return; }
    const champs = m.sections.flatMap((s) => s.fields).filter((f) => f.type === "personne");
    const cible = champs.find((f) => /mis en cause|interpell|concern|entendue|conducteur n° 1/i.test(f.label)) || champs[0];
    const values = {};
    if (cible) values[cible.key] = { ...valeurVidePV("personne"), roblox: pre.roblox || "", robloxPseudo: pre.robloxPseudo || "", robloxId: pre.robloxId || "", robloxUsername: pre.roblox || "" };
    setVue({ nouveau: m, initial: { faits: { date: cleJour(new Date()), heure: new Date().toTimeString().slice(0, 5), lieu: "" }, values } });
    setPre(null);
  }
  function supprimerBrouillon(cle) { try { localStorage.removeItem(cle); } catch (e) { /* rien */ } setBrouillons((l) => l.filter((x) => x.cle !== cle)); }

  if (vue && vue.nouveau) {
    return (
      <div style={{ maxWidth: 860 }}>
        <PVNouveau key={vue.corriger ? "corr" + vue.corriger.id : vue.initial ? "dup" : "new"} initial={vue.initial || null} correction={vue.corriger || null} modele={vue.nouveau} current={current} codePenal={codePenal}
          onCancel={() => { setVue(null); setBrouillons(lireBrouillons(current.matricule, puisRedigerModeles)); }}
          onSubmit={async (data) => {
            if (vue.corriger) { const ok = await onCorriger(vue.corriger.id, data); if (ok) { setVue({ fiche: vue.corriger.id }); setTab("a-viser"); } return ok; }
            const saved = await onSubmit(data); if (saved) { setVue({ fiche: saved.id }); setTab("a-viser"); } return saved;
          }} />
      </div>
    );
  }
  if (vue && vue.fiche) {
    const pv = pvs.find((p) => p.id === vue.fiche);
    if (pv) return <div style={{ maxWidth: 860 }}><FichePV pv={pv} onClose={() => { setVue(null); setBrouillons(lireBrouillons(current.matricule, puisRedigerModeles)); }} onDupliquer={pv.auteurMatricule === current.matricule ? () => dupliquer(pv) : null} onCorriger={pv.auteurMatricule === current.matricule && pv.aCorriger ? () => corriger(pv) : null} canVisa={peutVisa} onVisa={onVisa} onRenvoi={onRenvoi} /></div>;
  }

  const vide = tab === "a-viser" ? "Aucun PVe en attente de visa." : tab === "a-corriger" ? "Aucun PVe à corriger." : tab === "brouillons" ? "Aucun brouillon." : "Aucun PVe visé.";

  return (
    <div style={{ maxWidth: 940 }}>
      <NeoBandeau surtitre="NÉOGEND · Procédure" titre="PVe — PROCÈS-VERBAUX ÉLECTRONIQUES" texte={estOPJ ? "Rédige un procès-verbal électronique, ou vise ceux de tes gendarmes en tant qu'OPJ." : "Rédige tes procès-verbaux électroniques ; un OPJ les visera."}
        droite={<><NeoCompteur n={aViser.length} label="À viser" couleur="#F0B048" /><NeoCompteur n={aCorriger.length} label="À corriger" couleur={aCorriger.length ? "#EF6B7E" : "#8FA6C8"} /><NeoCompteur n={enRetard} label="+48 h" couleur={enRetard ? "#EF6B7E" : "#8FA6C8"} /><NeoCompteur n={vises.length} label="Visés" couleur="#34C38F" /></>} />

      {mesACorriger.length > 0 && (
        <NeoAlerte ton="danger" icone="↩">
          <b>{mesACorriger.length} de tes PVe {mesACorriger.length > 1 ? "ont été renvoyés" : "a été renvoyé"} pour correction.</b>{" "}
          <button type="button" onClick={() => setTab("a-corriger")} style={{ background: "none", border: 0, color: "inherit", textDecoration: "underline", cursor: "pointer", fontWeight: 800, fontFamily: "inherit", fontSize: "inherit", padding: 0 }}>Les voir</button>
        </NeoAlerte>
      )}
      {pre && (
        <NeoAlerte ton="info" icone="👤">
          <b>Personne pré-remplie depuis le TAJ : @{pre.roblox}{pre.robloxPseudo ? ` (${pre.robloxPseudo})` : ""}.</b> Choisis un modèle ci-dessous.{" "}
          <button type="button" onClick={() => setPre(null)} style={{ background: "none", border: 0, color: "inherit", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", padding: 0 }}>Annuler</button>
        </NeoAlerte>
      )}

      <NeoCarte titre="Nouveau PVe">
        {puisRedigerModeles.length === 0 ? (
          <div style={{ color: N.gris, fontSize: 14 }}>Aucun modèle de PVe disponible pour le moment.{current.isAdmin ? " Crée-en un dans « Modèles de PV »." : ""}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {puisRedigerModeles.map((m) => {
              const c = COULEURS_PV[m.type] || "#123A7A";
              const aBrouillon = brouillons.some((b) => b.modele.id === m.id);
              return (
                <button key={m.id} onClick={() => ouvrirModele(m)} style={{ position: "relative", textAlign: "left", background: "#F7F9FD", border: `1px solid ${N.ligne}`, borderLeft: `5px solid ${c}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: FONT_BASE }}>
                  {aBrouillon && <span style={{ position: "absolute", top: 8, right: 10, fontSize: 10.5, fontWeight: 800, color: "#B25E00", background: "#FFF4E0", borderRadius: 10, padding: "1px 8px" }}>📝 brouillon</span>}
                  <span style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: c, textTransform: "uppercase" }}>{m.type || "PVe"}</span>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: N.encre, margin: "4px 0 2px", lineHeight: 1.3 }}>{m.titre}</span>
                  <span style={{ display: "block", fontSize: 12, color: N.gris }}>{m.sections.length + 2} étapes</span>
                </button>
              );
            })}
          </div>
        )}
      </NeoCarte>

      <NeoOnglets onglets={[{ id: "a-viser", label: "À VISER", n: aViser.length, couleur: "#B25E00" }, { id: "a-corriger", label: "À CORRIGER", n: aCorriger.length, couleur: "#C0172D" }, { id: "vises", label: "VISÉS", n: vises.length, couleur: "#2E7D4F" }, ...(brouillons.length ? [{ id: "brouillons", label: "MES BROUILLONS", n: brouillons.length }] : [])]} actif={tab} onChange={setTab} />

      {tab === "brouillons" ? (
        <>
          <div style={{ fontSize: 11.5, color: N.gris, margin: "0 2px 10px" }}>📝 Les brouillons sont gardés sur cet appareil uniquement.</div>
          {brouillons.length === 0 && <NeoAlerte ton="info" icone="📝">{vide}</NeoAlerte>}
          {brouillons.map((b) => {
            const c = COULEURS_PV[b.modele.type] || "#123A7A";
            return (
              <div key={b.cle} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#F7F9FD", border: `1px solid ${N.ligne}`, borderLeft: `5px solid ${c}`, borderRadius: 12, padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: N.encre }}>{b.modele.titre}</div>
                  <div style={{ fontSize: 12.5, color: N.gris }}>{b.lieu ? `${b.lieu} · ` : ""}{b.savedAt ? "enregistré le " + new Date(b.savedAt).toLocaleString("fr-FR") : ""}</div>
                </div>
                <NeoBouton onClick={() => setVue({ nouveau: b.modele })}>REPRENDRE</NeoBouton>
                <NeoBouton variante="secondaire" onClick={() => supprimerBrouillon(b.cle)}>SUPPRIMER</NeoBouton>
              </div>
            );
          })}
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (n°, type, rédacteur, lieu, infraction, @ Roblox…)" style={{ ...NEO_INP, flex: 1, minWidth: 220, width: "auto" }} />
            {estOPJ && <NeoBouton variante={seulementMes ? "primaire" : "secondaire"} onClick={() => setSeulementMes(!seulementMes)}>MES PVe ({mesPV.length})</NeoBouton>}
            <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ ...NEO_INP, width: "auto" }}>
              <option value="recent">Plus récents</option><option value="ancien">Plus anciens</option><option value="type">Par type</option>
            </select>
            {types.length > 1 && <select value={typeF} onChange={(e) => setTypeF(e.target.value)} style={{ ...NEO_INP, width: "auto" }}><option value="">Tous types</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select>}
          </div>
          <div style={{ fontSize: 11.5, color: N.gris, margin: "0 2px 10px" }}>🗑 Les PVe sont supprimés 7 jours après leur visa.</div>
          {liste.length === 0 && <NeoAlerte ton="info" icone="📄">{vide}</NeoAlerte>}
          {liste.map((p) => {
            const c = COULEURS_PV[p.modeleType] || "#123A7A";
            const infr = infrDe(p);
            const pers = personnesDuPV(p).filter((x) => x.roblox);
            const st = STATUTS_PV[statutDe(p)];
            const retard = statutDe(p) === "a-viser" && heuresAttente(p) >= 48;
            return (
              <button key={p.id} onClick={() => setVue({ fiche: p.id })} style={{ display: "block", width: "100%", textAlign: "left", background: "#F7F9FD", border: `1px solid ${N.ligne}`, borderLeft: `5px solid ${retard || statutDe(p) === "a-corriger" ? "#D62B45" : c}`, borderRadius: 12, padding: "12px 16px", marginBottom: 8, cursor: "pointer", fontFamily: FONT_BASE }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: N.encre }}>{p.modeleTitre}</span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {retard && <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 12, color: "#C0172D", background: "#FDECEC" }}>⏱ {Math.floor(heuresAttente(p) / 24)} j</span>}
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 12, color: "#fff", background: st.c }}>{st.t}</span>
                  </span>
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: N.gris, marginTop: 3 }}><span style={{ fontFamily: "'Roboto Mono', monospace", color: c, fontWeight: 700 }}>{p.ref}</span> · {p.auteurGrade ? p.auteurGrade + " " : ""}{p.auteurNom}<PseudosAgent agent={trouverAgent(personnel, p.auteurMatricule)} /> · {new Date(p.createdAt).toLocaleString("fr-FR")}{p.faits && p.faits.lieu ? ` · ${p.faits.lieu}` : ""}</span>
                {infr.length > 0 && <span style={{ display: "block", fontSize: 12.5, color: "#7A1F2B", marginTop: 3, fontWeight: 600 }}>⚖️ {infr.slice(0, 3).join(" · ")}{infr.length > 3 ? ` +${infr.length - 3}` : ""}</span>}
                {pers.length > 0 && <span style={{ display: "block", fontSize: 12.5, color: "#123A7A", marginTop: 3 }}>👤 {pers.map((x) => `${x.robloxPseudo ? x.robloxPseudo + " " : ""}@${String(x.roblox).replace(/^@/, "")}`).join(" · ")}</span>}
                {p.aCorriger && p.correction && <span style={{ display: "block", fontSize: 12.5, color: "#C0172D", marginTop: 3, fontWeight: 600 }}>↩ {p.correction.commentaire}</span>}
              </button>
            );
          })}
        </>
      )}
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
            <b>Ajoutés automatiquement à chaque PV :</b> numéro, date et heure de rédaction, rédacteur (grade, nom, RIO, qualité judiciaire), unité, date / heure des faits, lieu de rédaction, formule de clôture, signature et visa de l'OPJ. Tu n'as à définir que les chapitres et rubriques ci-dessous.
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
