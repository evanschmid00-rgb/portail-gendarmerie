// pages/candidatures.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useCallback, useEffect, useState } from "react";
import { ArchiveTabs, Confirmation, Field, Select, StatutBadge, buttonPrimary, h2Style, smallBtn } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";
import { chercherDossier, lireDossiersLocaux, normaliserNumeroDossier } from "../lib/dossier.js";
import { GAV_SECTIONS } from "../lib/questionsCandidature.js";
import { dateLongue, newId } from "../lib/utils.js";
import { cardButtonStyle } from "./accueil.jsx";

const STATUTS_DOSSIER = {
  "En attente": { icone: "⏳", titre: "En cours d'étude", texte: "Ta candidature a bien été reçue mais n'a pas encore été traitée. Reviens consulter cette page régulièrement.", couleur: "#B25E00", fond: "#FFF4E0" },
  "Acceptée": { icone: "✅", titre: "Candidature acceptée", texte: "Félicitations ! Ton dossier a été accepté. Tu seras recontacté via Discord pour la suite.", couleur: "#1F6B42", fond: "#E3F2E8" },
  "Refusée": { icone: "❌", titre: "Candidature refusée", texte: "Ta candidature n'a pas été retenue cette fois. Tu pourras postuler à nouveau plus tard.", couleur: "#8A2A2A", fond: "#FDECEC" },
};

export function NumeroDossierBloc({ numero }) {
  const [copie, setCopie] = useState(false);
  async function copier() {
    try { await navigator.clipboard.writeText(numero); setCopie(true); setTimeout(() => setCopie(false), 2000); } catch (e) { /* copie impossible : le numéro reste sélectionnable */ }
  }
  return (
    <div style={{ marginBottom: 16, textAlign: "left" }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 6, textAlign: "center" }}>Ton numéro de dossier</div>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 24, fontWeight: 700, letterSpacing: 2, textAlign: "center", background: "#fff", border: "2px dashed #123A7A", borderRadius: 10, padding: "12px 8px", color: "#123A7A", userSelect: "all", wordBreak: "break-all" }}>{numero}</div>
      <div style={{ textAlign: "center", marginTop: 8 }}><button type="button" onClick={copier} style={smallBtn}>{copie ? "✓ Copié" : "Copier le numéro"}</button></div>
      <div style={{ background: "#FFF4D6", border: "1px solid #E8D28A", color: "#6B4E00", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5, marginTop: 12 }}>
        <b>⚠️ Garde bien ce numéro !</b> Note-le, fais une capture d'écran ou envoie-le-toi sur Discord. C'est le seul moyen de consulter la réponse à ta candidature, et il ne peut pas être retrouvé si tu le perds.
      </div>
    </div>
  );
}

function CarteStatutDossier({ dossier }) {
  const s = STATUTS_DOSSIER[dossier.statut] || STATUTS_DOSSIER["En attente"];
  return (
    <div style={{ background: s.fond, border: `1px solid ${s.couleur}`, borderRadius: 12, padding: 18, textAlign: "left" }}>
      <div style={{ fontFamily: FONT_TITRE, fontSize: 20, fontWeight: 700, color: s.couleur }}>{s.icone} {s.titre}</div>
      <div style={{ fontSize: 13.5, color: "#14213A", margin: "8px 0 10px", lineHeight: 1.55 }}>{s.texte}</div>
      <div style={{ fontSize: 12, color: "#5A6B84" }}>
        Poste : <b>{dossier.poste}</b>
        {dossier.createdAt ? <> · Déposée le {dateLongue(dossier.createdAt)}</> : null}
        {dossier.updatedAt && dossier.updatedAt !== dossier.createdAt ? <> · Mise à jour le {dateLongue(dossier.updatedAt)}</> : null}
      </div>
    </div>
  );
}

// Affiché à la place du formulaire quand la personne a déjà postulé depuis ce navigateur
export function DejaPostule({ poste, numero, onCancel, onNouvelle }) {
  const [etat, setEtat] = useState({ chargement: true, dossier: null, erreur: false });
  const charger = useCallback(async () => {
    setEtat((e) => ({ ...e, chargement: true }));
    try { setEtat({ chargement: false, dossier: await chercherDossier(numero), erreur: false }); }
    catch (e) { console.error(e); setEtat({ chargement: false, dossier: null, erreur: true }); }
  }, [numero]);
  useEffect(() => { charger(); }, [charger]);
  const refusee = etat.dossier && etat.dossier.statut === "Refusée";
  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 26, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 24, fontWeight: 700, color: "#14213A", marginBottom: 6 }}>Tu as déjà postulé ({poste})</div>
          <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 18, lineHeight: 1.5 }}>Une seule candidature par poste : voici ton numéro de dossier et l'état de ta candidature.</div>
          <NumeroDossierBloc numero={numero} />
          {etat.chargement && <div style={{ fontSize: 13, color: "#5A6B84" }}>Consultation du dossier…</div>}
          {etat.erreur && <div style={{ fontSize: 13, color: "#C0172D" }}>Impossible de consulter le dossier pour le moment. Réessaie dans quelques instants.</div>}
          {!etat.chargement && !etat.erreur && !etat.dossier && <div style={{ fontSize: 13, color: "#B25E00" }}>Ce numéro n'est plus reconnu. Si tu penses que c'est une erreur, contacte le recrutement sur Discord.</div>}
          {etat.dossier && <CarteStatutDossier dossier={etat.dossier} />}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            <button onClick={charger} style={smallBtn}>↻ Actualiser</button>
            {(refusee || (!etat.chargement && !etat.erreur && !etat.dossier)) && <button onClick={onNouvelle} style={smallBtn}>Déposer une nouvelle candidature</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Page publique : consulter la réponse avec le numéro de dossier
export function SuiviCandidaturePublic({ onCancel }) {
  const dernier = Object.values(lireDossiersLocaux()).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const [saisie, setSaisie] = useState(dernier ? dernier.numero : "");
  const [etat, setEtat] = useState({ chargement: false, dossier: null, cherche: false, erreur: "" });
  async function chercher(e) {
    e.preventDefault();
    const numero = normaliserNumeroDossier(saisie);
    if (!numero) { setEtat({ chargement: false, dossier: null, cherche: false, erreur: "Numéro invalide : il ressemble à GAV-XXXXX-XXXXX." }); return; }
    setEtat({ chargement: true, dossier: null, cherche: false, erreur: "" });
    try { setEtat({ chargement: false, dossier: await chercherDossier(numero), cherche: true, erreur: "" }); }
    catch (e2) { console.error(e2); setEtat({ chargement: false, dossier: null, cherche: false, erreur: "Impossible de consulter le dossier pour le moment. Réessaie dans quelques instants." }); }
  }
  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: FONT_TITRE, fontSize: 26, fontWeight: 700, color: "#14213A", marginBottom: 4 }}>Suivre ma candidature</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 20, lineHeight: 1.55 }}>Entre le numéro de dossier que tu as reçu après ton envoi pour savoir si ta candidature est acceptée ou refusée.</div>
        <form onSubmit={chercher} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 18 }}>
          <Field label="Numéro de dossier" value={saisie} onChange={(v) => setSaisie(v.toUpperCase())} placeholder="Ex : GAV-7K3MQ-9XR4T" />
          {etat.erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{etat.erreur}</div>}
          <button className="gh-btn-anim" type="submit" disabled={etat.chargement} style={{ ...buttonPrimary, marginTop: 0 }}>{etat.chargement ? "Recherche…" : "Consulter mon dossier"}</button>
        </form>
        {etat.cherche && (etat.dossier
          ? <CarteStatutDossier dossier={etat.dossier} />
          : <div style={{ background: "#FFF4E0", border: "1px solid #E8D28A", borderRadius: 12, padding: 16, fontSize: 13.5, color: "#6B4E00" }}>Aucun dossier ne correspond à ce numéro. Vérifie la saisie (attention aux lettres et aux chiffres) ou contacte le recrutement sur Discord.</div>)}
        <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 16 }}>Les dossiers déposés avant la mise en place du suivi en ligne ne peuvent pas être consultés ici.</div>
      </div>
    </div>
  );
}

/* ---------- Formulaire de candidature générique (GAV / SOG / Officier) ---------- */

export function ApplicationForm({ title, intro, sections, poste, prefill, onSubmit, onCancel }) {
  const buildInitial = () => {
    const initial = {};
    sections.forEach((s) =>
      s.fields.forEach((f) => {
        if (prefill && prefill[f.key] !== undefined) initial[f.key] = prefill[f.key];
        else if (f.type === "select") initial[f.key] = f.options[0];
        else initial[f.key] = "";
      })
    );
    return initial;
  };
  const [values, setValues] = useState(buildInitial);
  const [error, setError] = useState("");

  function setField(key, v) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function submit(e) {
    e.preventDefault();
    for (const s of sections) {
      for (const f of s.fields) {
        if (f.required && !String(values[f.key] || "").trim()) {
          setError("Merci de compléter tous les champs obligatoires avant d'envoyer.");
          return;
        }
      }
    }
    const answers = sections.flatMap((s) => s.fields.map((f) => ({ label: f.label, value: values[f.key] })));
    const nom = values.nom_rp || "";
    const prenom = values.prenom_rp || "";
    const displayName = prenom || nom ? `${prenom} ${nom}`.trim() : values.pseudoDiscord || "Candidat";
    onSubmit({ poste, displayName, contact: values.pseudoDiscord || "", answers });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#14213A" }}>{title}</div>
        {intro && <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 24 }}>{intro}</div>}
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 26, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          {sections.map((s) => (
            <div key={s.title}>
              <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", margin: "18px 0 10px" }}>{s.title}</div>
              {s.fields.map((f) =>
                f.type === "select" ? (
                  <Select key={f.key} label={f.label} value={values[f.key]} onChange={(v) => setField(f.key, v)} options={f.options} />
                ) : (
                  <Field
                    key={f.key}
                    label={f.label}
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    textarea={f.type === "textarea"}
                    value={values[f.key]}
                    onChange={(v) => setField(f.key, v)}
                  />
                )
              )}
            </div>
          ))}
          {error && <div style={{ color: "#C0172D", fontSize: 12, margin: "10px 0" }}>{error}</div>}
          <div style={{ background: "#FFF4D6", border: "1px solid #E8D28A", color: "#6B4E00", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5, margin: "14px 0 4px" }}>
            <b>ℹ️ Numéro de dossier :</b> après l'envoi, un numéro de dossier te sera donné. <b>Garde-le précieusement</b> (note-le ou fais une capture d'écran) : il te permettra de consulter la réponse à ta candidature.
          </div>
          <button className="gh-btn-anim" type="submit" style={{ ...buttonPrimary, marginTop: 10 }}>Envoyer ma candidature</button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Questionnaires personnalisables (créés depuis le panneau admin) ---------- */

const TYPES_CHAMP = [
  { value: "text", label: "Texte court" },
  { value: "textarea", label: "Texte long" },
  { value: "number", label: "Nombre" },
  { value: "date", label: "Date" },
  { value: "select", label: "Liste de choix" },
];
const OPT_PUBLIC = "Public (tout le monde, via le site)";
const OPT_INTERNE = "Interne (gendarmes connectés)";

// Transforme un questionnaire enregistré en "sections" lisibles par ApplicationForm
export function sectionsDe(q) {
  const sections = (q.sections || [])
    .map((s) => ({
      title: s.title || "Sans titre",
      fields: (s.fields || []).map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type === "text" ? undefined : f.type,
        required: !!f.required,
        options: f.type === "select" ? ((f.options || []).length ? f.options : ["Oui", "Non"]) : undefined,
      })),
    }))
    .filter((s) => s.fields.length > 0);
  if (q.identite !== false) {
    sections.unshift({
      title: "Identité",
      fields: [
        { key: "pseudoRoblox", label: "Pseudo Roblox", required: true },
        { key: "pseudoDiscord", label: "Pseudo Discord", required: true },
      ],
    });
  }
  return sections;
}

// Convertit un ancien formulaire codé en dur en questionnaire modifiable
function questionnaireDepuis(id, titre, intro, poste, sections) {
  return {
    id, titre, intro, poste, visibilite: "public", actif: true, identite: false,
    sections: sections.map((s) => ({
      id: newId(),
      title: s.title,
      fields: s.fields.map((f) => ({ key: f.key, label: f.label, type: f.type || "text", required: !!f.required, options: f.options || [] })),
    })),
  };
}

export function QuestionnaireFerme({ onBack }) {
  return <Confirmation title="Questionnaire indisponible" message="Ce questionnaire est fermé ou n'existe plus." onBack={onBack} />;
}

// Liste de questionnaires à choisir (page publique si onCancel, sinon dans le tableau de bord)
export function QuestionnairesListe({ liste, onOpen, onCancel }) {
  const contenu = (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {onCancel && <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>}
      <h2 style={h2Style}>Questionnaires disponibles</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {liste.map((q) => (
          <button key={q.id} onClick={() => onOpen(q.id)} className="gh-btn-anim" style={cardButtonStyle}>
            <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 16, fontWeight: 700 }}>{q.titre}</div>
            {q.intro && <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 4 }}>{q.intro}</div>}
          </button>
        ))}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun questionnaire ouvert pour le moment.</div>}
      </div>
    </div>
  );
  if (!onCancel) return contenu;
  return <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{contenu}</div>;
}

// Panneau admin : création et modification des questionnaires
export function QuestionnairesAdmin({ questionnaires, onSave }) {
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState("");

  const cardBox = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 20, marginBottom: 14, boxShadow: "0 4px 16px -8px rgba(7,20,46,0.25)" };
  const iconBtn = { ...smallBtn, padding: "6px 10px" };
  const lien = (q) => `${window.location.origin}/?q=${q.id}`;
  const nbQuestions = (q) => (q.sections || []).reduce((n, s) => n + (s.fields || []).length, 0);

  async function sauver(list, ok) {
    const res = await onSave(list);
    setMsg(res ? ok : "Échec de l'enregistrement, réessaie.");
    return res;
  }
  async function copier(q) {
    try { await navigator.clipboard.writeText(lien(q)); setMsg("Lien copié : " + lien(q)); }
    catch (e) { setMsg("Lien : " + lien(q)); }
  }
  function nouveau(vis = "public") {
    setMsg("");
    setEditing({ id: newId(), titre: "", intro: "", poste: "", visibilite: vis, actif: true, identite: vis === "public", sections: [{ id: newId(), title: "Questions", fields: [] }] });
  }
  function dupliquer(q) {
    const copie = { ...q, id: newId(), titre: q.titre + " (copie)", poste: q.titre + " (copie)", actif: false, sections: q.sections.map((s) => ({ ...s, id: newId() })) };
    sauver([...questionnaires, copie], "Questionnaire dupliqué (fermé par défaut).");
  }
  function supprimer(q) {
    const extra = q.id === "gav" ? " Le formulaire GAV d'origine sera de nouveau utilisé." : "";
    if (!window.confirm(`Supprimer « ${q.titre} » ?${extra} Les candidatures déjà reçues sont conservées.`)) return;
    sauver(questionnaires.filter((x) => x.id !== q.id), "Questionnaire supprimé.");
  }

  /* ----- Vue liste ----- */
  if (!editing) {
    return (
      <div>
        <h2 style={h2Style}>Questionnaires</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => nouveau("public")} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>+ Nouveau questionnaire</button>
          {!questionnaires.some((q) => q.id === "gav") && (
            <button
              className="gh-btn-anim"
              style={smallBtn}
              onClick={() => sauver(
                [...questionnaires, questionnaireDepuis("gav", "Candidature — Gendarme Adjoint Volontaire (GAV)", "Rejoins les rangs de la Gendarmerie Nationale de Black RP. Réponds avec sérieux, ta candidature sera étudiée par l'administration.", "GAV", GAV_SECTIONS)],
                "Questionnaire GAV importé : tu peux maintenant le modifier."
              )}
            >
              Importer le questionnaire GAV actuel pour le modifier
            </button>
          )}
        </div>
        {msg && <div style={{ fontSize: 12, color: "#123A7A", marginBottom: 12, wordBreak: "break-all" }}>{msg}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {questionnaires.map((q) => (
            <div key={q.id} style={{ ...cardBox, marginBottom: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{q.titre}</div>
              <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>
                {q.visibilite === "interne" ? "Interne" : "Public"} — {q.actif ? "🟢 Ouvert" : "🔴 Fermé"} — {nbQuestions(q)} question(s)
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button style={smallBtn} onClick={() => { setMsg(""); setEditing(JSON.parse(JSON.stringify(q))); }}>Modifier</button>
                <button style={smallBtn} onClick={() => sauver(questionnaires.map((x) => (x.id === q.id ? { ...x, actif: !x.actif } : x)), q.actif ? "Questionnaire fermé." : "Questionnaire ouvert.")}>{q.actif ? "Fermer" : "Ouvrir"}</button>
                {q.visibilite === "public" && <button style={smallBtn} onClick={() => copier(q)}>Copier le lien</button>}
                <button style={smallBtn} onClick={() => dupliquer(q)}>Dupliquer</button>
                <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => supprimer(q)}>Supprimer</button>
              </div>
            </div>
          ))}
          {questionnaires.length === 0 && (
            <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun questionnaire pour l'instant. Le formulaire GAV actuel reste utilisé tant que tu ne l'as pas importé ci-dessus.</div>
          )}
        </div>
      </div>
    );
  }

  /* ----- Vue édition ----- */
  const q = editing;
  const upd = (patch) => setEditing((e) => ({ ...e, ...patch }));
  const majSection = (sid, fn) => upd({ sections: q.sections.map((s) => (s.id === sid ? fn(s) : s)) });
  const majChamp = (sid, key, patch) => majSection(sid, (s) => ({ ...s, fields: s.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
  const deplacer = (arr, i, d) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const c = arr.slice();
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  };
  const existe = questionnaires.some((x) => x.id === q.id);

  async function enregistrer() {
    if (!q.titre.trim()) { setMsg("Le titre du questionnaire est obligatoire."); return; }
    const propre = {
      ...q,
      titre: q.titre.trim(),
      poste: (q.poste || q.titre).trim(),
      sections: q.sections.map((s) => ({
        ...s,
        title: s.title.trim() || "Questions",
        fields: s.fields
          .filter((f) => f.label.trim())
          .map((f) => ({ ...f, label: f.label.trim(), options: (f.options || []).map((o) => o.trim()).filter(Boolean) })),
      })),
    };
    if (nbQuestions(propre) === 0) { setMsg("Ajoute au moins une question (avec un texte) avant d'enregistrer."); return; }
    const ok = await sauver(existe ? questionnaires.map((x) => (x.id === propre.id ? propre : x)) : [...questionnaires, propre], "Questionnaire enregistré.");
    if (ok) setEditing(null);
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={h2Style}>{existe ? "Modifier le questionnaire" : "Nouveau questionnaire"}</h2>
      <div style={cardBox}>
        <Field label="Titre du questionnaire" value={q.titre} onChange={(v) => upd({ titre: v })} autoFocus />
        <Field label="Texte d'introduction (facultatif)" value={q.intro} onChange={(v) => upd({ intro: v })} textarea />
        <Field label="Nom court (affiché dans la liste des candidatures)" value={q.poste} onChange={(v) => upd({ poste: v })} placeholder={q.titre || "Ex : Formation"} />
        <Select label="Type / qui peut répondre ?" value={q.visibilite === "interne" ? OPT_INTERNE : OPT_PUBLIC} onChange={(v) => upd({ visibilite: v === OPT_INTERNE ? "interne" : "public", identite: v === OPT_PUBLIC })} options={[OPT_PUBLIC, OPT_INTERNE]} />
        {true && (
          <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>
            <input type="checkbox" checked={q.identite !== false} onChange={(e) => upd({ identite: e.target.checked })} /> Demander automatiquement le pseudo Roblox et le pseudo Discord
          </label>
        )}
        <label style={{ display: "block", fontSize: 13 }}>
          <input type="checkbox" checked={!!q.actif} onChange={(e) => upd({ actif: e.target.checked })} /> Questionnaire ouvert aux réponses
        </label>
      </div>

      {q.sections.map((s, si) => (
        <div key={s.id} style={cardBox}>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Field label={`Catégorie ${si + 1}`} value={s.title} onChange={(v) => majSection(s.id, (x) => ({ ...x, title: v }))} />
            </div>
            <button type="button" style={{ ...iconBtn, marginBottom: 12 }} onClick={() => upd({ sections: deplacer(q.sections, si, -1) })}>↑</button>
            <button type="button" style={{ ...iconBtn, marginBottom: 12 }} onClick={() => upd({ sections: deplacer(q.sections, si, 1) })}>↓</button>
            <button
              type="button"
              style={{ ...iconBtn, marginBottom: 12, color: "#C0172D", borderColor: "#C0172D" }}
              onClick={() => { if (window.confirm("Supprimer cette catégorie et ses questions ?")) upd({ sections: q.sections.filter((x) => x.id !== s.id) }); }}
            >✕</button>
          </div>

          {s.fields.map((f, fi) => (
            <div key={f.key} style={{ border: "1px solid #D3DDEA", borderRadius: 8, padding: 12, marginBottom: 10, background: "#F5F8FC" }}>
              <Field label={`Question ${fi + 1}`} value={f.label} onChange={(v) => majChamp(s.id, f.key, { label: v })} placeholder="Ex : Pourquoi veux-tu nous rejoindre ?" />
              <Select
                label="Type de réponse"
                value={(TYPES_CHAMP.find((t) => t.value === f.type) || TYPES_CHAMP[0]).label}
                onChange={(v) => majChamp(s.id, f.key, { type: TYPES_CHAMP.find((t) => t.label === v).value })}
                options={TYPES_CHAMP.map((t) => t.label)}
              />
              {f.type === "select" && (
                <Field label="Choix proposés (un par ligne)" textarea value={(f.options || []).join("\n")} onChange={(v) => majChamp(s.id, f.key, { options: v.split("\n") })} />
              )}
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 13, flex: 1 }}>
                  <input type="checkbox" checked={!!f.required} onChange={(e) => majChamp(s.id, f.key, { required: e.target.checked })} /> Réponse obligatoire
                </label>
                <button type="button" style={iconBtn} onClick={() => majSection(s.id, (x) => ({ ...x, fields: deplacer(x.fields, fi, -1) }))}>↑</button>
                <button type="button" style={iconBtn} onClick={() => majSection(s.id, (x) => ({ ...x, fields: deplacer(x.fields, fi, 1) }))}>↓</button>
                <button type="button" style={{ ...iconBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => majSection(s.id, (x) => ({ ...x, fields: x.fields.filter((y) => y.key !== f.key) }))}>✕</button>
              </div>
            </div>
          ))}
          <button type="button" style={smallBtn} onClick={() => majSection(s.id, (x) => ({ ...x, fields: [...x.fields, { key: "q_" + newId(), label: "", type: "text", required: false, options: [] }] }))}>+ Ajouter une question</button>
        </div>
      ))}

      <button type="button" style={{ ...smallBtn, marginBottom: 16 }} onClick={() => upd({ sections: [...q.sections, { id: newId(), title: "", fields: [] }] })}>+ Ajouter une catégorie</button>
      {msg && <div style={{ color: "#C0172D", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="gh-btn-anim" onClick={enregistrer} style={{ ...buttonPrimary, width: "auto", padding: "10px 22px", marginTop: 0 }}>Enregistrer</button>
        <button style={smallBtn} onClick={() => { setEditing(null); setMsg(""); }}>Annuler</button>
      </div>
    </div>
  );
}

export function AdminCandidatures({ candidatures, onUpdateStatut }) {
  const [filter, setFilter] = useState("Toutes");
  const [tab, setTab] = useState("en-cours");
  const postes = ["Toutes", ...Array.from(new Set(["GAV", "SOG", "Officier", ...candidatures.map((c) => c.poste).filter(Boolean)]))];
  const enCours = candidatures.filter((c) => c.statut === "En attente");
  const archivees = candidatures.filter((c) => c.statut !== "En attente");
  const base = tab === "en-cours" ? enCours : archivees;
  const filtered = filter === "Toutes" ? base : base.filter((c) => c.poste === filter);

  return (
    <div>
      <h2 style={h2Style}>Candidatures reçues</h2>
      <ArchiveTabs tab={tab} setTab={setTab} countEnCours={enCours.length} countArchivees={archivees.length} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {postes.map((p) => (
          <button key={p} onClick={() => setFilter(p)} style={{ ...smallBtn, background: filter === p ? "#123A7A" : "transparent", color: filter === p ? "#fff" : "#14213A", borderColor: filter === p ? "#123A7A" : "#C3D0E2" }}>{p}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.slice().reverse().map((c) => (
          <div key={c.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "18px 20px", boxShadow: "0 4px 16px -8px rgba(7,20,46,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.displayName} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#123A7A", fontWeight: 600, background: "#E9EFF7", padding: "2px 7px", borderRadius: 5, marginLeft: 4 }}>({c.ref})</span></div>
                <div style={{ fontSize: 12, color: "#5A6B84" }}>{c.poste}{c.contact ? " — " + c.contact : ""}{c.auteurMatricule ? " — soumis par " + c.auteurMatricule : ""}</div>
              </div>
              <StatutBadge statut={c.statut} />
            </div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#123A7A" }}>Voir les réponses complètes ({c.answers?.length || 0})</summary>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 8, padding: 16 }}>
                {c.answers?.map((a, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "#5A6B84", marginBottom: 3 }}>{a.label}</div>
                    <div style={{ fontSize: 14, color: "#14213A", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{a.value || "—"}</div>
                  </div>
                ))}
              </div>
            </details>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => onUpdateStatut(c.id, "Acceptée")} style={{ ...smallBtn, color: "#2E7D4F", borderColor: "#2E7D4F" }}>Accepter</button>
              <button onClick={() => onUpdateStatut(c.id, "Refusée")} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Refuser</button>
              <button onClick={() => onUpdateStatut(c.id, "En attente")} style={smallBtn}>Remettre en attente</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune candidature.</div>}
      </div>
    </div>
  );
}
