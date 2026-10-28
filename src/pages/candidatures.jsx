// pages/candidatures.jsx — formulaires de candidature, questionnaires et suivi des dossiers
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { Ecusson } from "../composants/Ecusson.jsx";
import { BandeauCandidat } from "../composants/BandeauCandidat.jsx";
import { LiaisonDiscord } from "../composants/LiaisonDiscord.jsx";
import { memoriserRoblox, preuveValide, robloxMemorise } from "../lib/liaisonLocale.js";
import { Confirmation, Field, Select, StatutBadge, buttonPrimary, h2Style, smallBtn } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE, GRADES, UNITES } from "../lib/constantes.js";
import { chercherDossier, lireDossiersLocaux, normaliserNumeroDossier } from "../lib/dossier.js";
import { LIBELLES_MODE_GRADE, resumeAcces } from "../lib/accesQuestionnaires.js";
import { dateLongue, newId, numAgent } from "../lib/utils.js";

const STATUTS_DOSSIER = {
  "En attente": { icone: "⏳", titre: "En cours d'étude", texte: "Ta candidature est en cours d'étude. Le recrutement publie les réponses à un moment donné : reviens consulter cette page régulièrement.", couleur: "#B25E00", fond: "#FFF4E0" },
  "Acceptée": { icone: "✅", titre: "Candidature acceptée", texte: "Félicitations ! Ton dossier a été accepté. Pour la suite : 1) rejoins le serveur Discord de la gendarmerie, 2) attends que le recrutement te donne le rôle « Militaire Engagé », 3) clique sur « Créer mon compte » puis connecte-toi avec Discord.", couleur: "#1F6B42", fond: "#E3F2E8" },
  "Refusée": { icone: "❌", titre: "Candidature refusée", texte: "Ta candidature n'a pas été retenue cette fois. Tu pourras postuler à nouveau plus tard.", couleur: "#8A2A2A", fond: "#FDECEC" },
};

export function NumeroDossierBloc({ numero }) {
  const [copie, setCopie] = useState(false);
  async function copier() {
    try { await navigator.clipboard.writeText(numero); setCopie(true); setTimeout(() => setCopie(false), 2000); } catch (e) { /* copie impossible : le numéro reste sélectionnable */ }
  }
  return (
    <div style={{ marginBottom: 18, textAlign: "left" }}>
      <div style={{ position: "relative", background: "linear-gradient(135deg, #0B3A8F, #123A7A 60%, #0C2655)", color: "#fff", borderRadius: 18, padding: "18px 18px 16px", boxShadow: "0 22px 40px -24px rgba(7,20,46,0.9)", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: "linear-gradient(90deg, #2F6FDE 0 33.3%, #fff 33.3% 66.6%, #E5384F 66.6%)" }} />
        <span style={{ position: "absolute", left: -11, top: "50%", width: 22, height: 22, borderRadius: "50%", background: "#E9EFF7" }} />
        <span style={{ position: "absolute", right: -11, top: "50%", width: 22, height: 22, borderRadius: "50%", background: "#E9EFF7" }} />
        <div style={{ fontSize: 10.5, letterSpacing: 3, opacity: 0.75, fontWeight: 700, textAlign: "center", marginTop: 4 }}>NUMÉRO DE DOSSIER</div>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 25, fontWeight: 700, letterSpacing: 2.5, textAlign: "center", padding: "12px 4px 10px", userSelect: "all", wordBreak: "break-all" }}>{numero}</div>
        <div style={{ textAlign: "center" }}><button type="button" onClick={copier} style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{copie ? "✓ Copié" : "📋 Copier le numéro"}</button></div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#FFF4E0", border: "1px solid #F0D49A", color: "#6B4E00", borderRadius: 12, padding: "11px 14px", fontSize: 12.5, lineHeight: 1.55, marginTop: 12 }}>
        <span style={{ fontSize: 18 }}>⚠️</span><span><b>Garde bien ce numéro !</b> Note-le, fais une capture d'écran ou envoie-le-toi sur Discord. C'est le seul moyen de consulter la réponse à ta candidature, et il ne peut pas être retrouvé si tu le perds.</span>
      </div>
    </div>
  );
}

// Frise « Reçue → En étude → Décision » avec barre de progression
function Chronologie({ statut, roleDiscord = false, compteCree = false, dateRecue, dateMaj }) {
  const accepte = statut === "Acceptée";
  const refuse = statut === "Refusée";
  const couleurFin = accepte ? "#2E7D4F" : refuse ? "#C0172D" : "#9AA8BD";
  const decide = accepte || refuse;
  const etapes = [
    { t: "Reçue", i: "📨", fait: true, couleur: "#2F6FDE", date: dateRecue },
    { t: "En étude", i: "🔎", fait: true, couleur: "#2F6FDE", actif: !decide },
    { t: "Décision", i: accepte ? "✅" : refuse ? "❌" : "⚖️", fait: decide, couleur: couleurFin, date: decide ? dateMaj : null },
    ...(accepte ? [{ t: "Rôle Discord", i: "🎖", fait: !!roleDiscord, couleur: "#5865F2" }, { t: "Ton compte", i: "👤", fait: !!compteCree, couleur: "#5865F2" }] : []),
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", margin: "6px 0 4px", overflowX: "auto", paddingBottom: 6 }}>
      {etapes.map((e, k) => (
        <React.Fragment key={e.t}>
          {k > 0 && <div style={{ flex: 1, minWidth: 14, height: 4, background: e.fait ? e.couleur : "#D3DDEA", margin: "20px 4px 0", borderRadius: 2 }} />}
          <div style={{ textAlign: "center", width: 80, flexShrink: 0 }}>
            <div className={e.actif ? "gn-pulse" : undefined} style={{ width: 44, height: 44, borderRadius: "50%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", background: e.fait ? e.couleur : "#E3EAF4", boxShadow: e.actif ? "0 0 0 6px rgba(47,111,222,0.22)" : e.fait ? `0 10px 18px -10px ${e.couleur}` : "none", border: e.fait ? "none" : "2px dashed #B8C6DB" }}>{e.fait ? e.i : ""}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: e.fait ? "#14213A" : "#9AA8BD", marginTop: 7 }}>{e.t}</div>
            {e.date && <div style={{ fontSize: 10.5, color: "#5A6B84", marginTop: 1 }}>{dateLongue(e.date)}</div>}
            {e.actif && <div style={{ fontSize: 10.5, color: "#2F6FDE", fontWeight: 700, marginTop: 1 }}>en cours</div>}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function CarteStatutDossier({ dossier, onCreerCompte }) {
  const s = STATUTS_DOSSIER[dossier.statut] || STATUTS_DOSSIER["En attente"];
  const accepte = dossier.statut === "Acceptée";
  const maj = dossier.updatedAt && dossier.updatedAt !== dossier.createdAt ? dossier.updatedAt : null;
  const infos = [["🎖️", "Poste", dossier.poste], ["📅", "Déposée le", dossier.createdAt ? dateLongue(dossier.createdAt) : null], ["🔄", "Dernière mise à jour", maj ? dateLongue(maj) : null]].filter((x) => x[2]);
  return (
    <div className="gn-appear" style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 20, overflow: "hidden", textAlign: "left", boxShadow: "0 24px 46px -28px rgba(7,20,46,0.6)" }}>
      <div style={{ background: `linear-gradient(135deg, ${s.couleur}, ${s.couleur}dd)`, color: "#fff", padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 54, height: 54, borderRadius: 16, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.45)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>{s.icone}</span>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: 2.5, opacity: 0.85, fontWeight: 700 }}>ÉTAT DE VOTRE CANDIDATURE</div>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{s.titre}</div>
        </div>
      </div>
      <div style={{ padding: "20px 20px 22px" }}>
        <Chronologie statut={dossier.statut} roleDiscord={dossier.roleDiscord} compteCree={dossier.compteCree} dateRecue={dossier.createdAt} dateMaj={maj} />
        <div style={{ background: s.fond, border: `1px solid ${s.couleur}55`, borderRadius: 14, padding: "14px 16px", fontSize: 13.5, color: "#14213A", lineHeight: 1.65, margin: "14px 0" }}>{s.texte}</div>
        {accepte && onCreerCompte && <button type="button" onClick={onCreerCompte} className="gh-btn-anim" style={{ ...buttonPrimary, background: "linear-gradient(180deg, #6D79F7, #5865F2)", marginTop: 0, marginBottom: 14 }}>Créer mon compte →</button>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          {infos.map(([e, l, v]) => (
            <div key={l} style={{ background: "#F6F9FD", border: "1px solid #E1E8F2", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 800 }}>{e} {l}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#14213A", marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Entête commune des pages de suivi
function EnteteSuivi({ surtitre, titre, sous }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #0B3A8F, #0C2655)", color: "#fff", borderRadius: 20, padding: "22px 24px", marginBottom: 18, display: "flex", alignItems: "center", gap: 18, boxShadow: "0 24px 44px -28px rgba(7,20,46,0.9)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: "linear-gradient(90deg, #2F6FDE 0 33.3%, #fff 33.3% 66.6%, #E5384F 66.6%)" }} />
      <Ecusson taille={54} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, letterSpacing: 3, opacity: 0.75, fontWeight: 700 }}>{surtitre}</div>
        <div style={{ fontFamily: FONT_TITRE, fontSize: 26, fontWeight: 700, lineHeight: 1.15, margin: "3px 0 4px" }}>{titre}</div>
        {sous && <div style={{ fontSize: 13, opacity: 0.88, lineHeight: 1.55 }}>{sous}</div>}
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
        <EnteteSuivi surtitre="CANDIDATURE DÉJÀ DÉPOSÉE" titre={`Tu as déjà postulé (${poste})`} sous="Une seule candidature par poste : voici ton numéro de dossier et l'état de ta candidature." />
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 20, padding: 22, boxShadow: "0 18px 40px -26px rgba(7,20,46,0.5)" }}>
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
export function SuiviCandidaturePublic({ onCancel, onCreerCompte }) {
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
        <EnteteSuivi surtitre="SUIVI DE CANDIDATURE" titre="Suivre ma candidature" sous="Entre le numéro de dossier reçu après ton envoi pour savoir si ta candidature est acceptée ou refusée." />
        <form onSubmit={chercher} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 20, padding: 22, boxShadow: "0 18px 40px -26px rgba(7,20,46,0.5)", marginBottom: 18 }}>
          <Field label="Numéro de dossier" value={saisie} onChange={(v) => setSaisie(v.toUpperCase())} placeholder="Ex : GAV-7K3MQ-9XR4T" />
          {etat.erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{etat.erreur}</div>}
          <button className="gh-btn-anim" type="submit" disabled={etat.chargement} style={{ ...buttonPrimary, marginTop: 0 }}>{etat.chargement ? "Recherche…" : "Consulter mon dossier"}</button>
        </form>
        {etat.cherche && (etat.dossier
          ? <CarteStatutDossier dossier={etat.dossier} onCreerCompte={onCreerCompte} />
          : <div style={{ background: "#FFF4E0", border: "1px solid #E8D28A", borderRadius: 12, padding: 16, fontSize: 13.5, color: "#6B4E00" }}>Aucun dossier ne correspond à ce numéro. Vérifie la saisie (attention aux lettres et aux chiffres) ou contacte le recrutement sur Discord.</div>)}
        <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 16 }}>Les dossiers déposés avant la mise en place du suivi en ligne ne peuvent pas être consultés ici.</div>
      </div>
    </div>
  );
}

/* ---------- Formulaire de candidature : assistant en étapes (GAV / SOG / Officier / questionnaires) ---------- */

const brouillonKey = (poste) => "gn_brouillon_" + String(poste || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
const compterQuestions = (sections) => sections.reduce((n, sec) => n + sec.fields.length, 0);
const FONT_UI = "'Inter', 'Segoe UI', system-ui, sans-serif";

function ChampCandidature({ f, value, onChange, erreur }) {
  const libelle = f.label + (f.required ? " *" : "");
  return (
    <div id={`champ-${f.key}`} style={erreur ? { borderLeft: "3px solid #C0172D", background: "#FFF5F6", borderRadius: 8, padding: "6px 0 2px 10px", margin: "0 0 10px" } : undefined}>
      {f.type === "select" ? (
        <Select label={libelle} value={value} onChange={onChange} options={f.options} />
      ) : (
        <Field label={libelle} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} textarea={f.type === "textarea"} value={value} onChange={onChange} />
      )}
      {f.aide && <div style={{ fontSize: 11.5, color: "#5A6B84", margin: "-6px 0 10px", lineHeight: 1.45 }}>💡 {f.aide}</div>}
      {f.type === "textarea" && <div style={{ fontSize: 11, color: "#9AA8BD", textAlign: "right", margin: "-6px 0 8px" }}>{String(value || "").length} caractères</div>}
      {erreur && <div style={{ color: "#C0172D", fontSize: 12, fontWeight: 600, margin: "0 0 8px" }}>Ce champ est obligatoire.</div>}
    </div>
  );
}

// Repère de version : permet de vérifier d'un coup d'œil que la dernière mise à jour du site est bien en ligne
const VERSION_FORMULAIRE = "21/10 · a";

// verifierCompte (formulaires publics) : fonction qui vérifie le compte Roblox et le casier ; renvoie { ok, compte } ou { ok: false, error }
export function ApplicationForm({ title, intro, sections, poste, prefill, onSubmit, onCancel, diag, verifierCompte }) {
  const cle = brouillonKey(poste);
  const nbEtapes = sections.length; // le récapitulatif porte l'indice nbEtapes

  const valeursInitiales = () => {
    const initial = {};
    sections.forEach((sec) =>
      sec.fields.forEach((f) => {
        if (prefill && prefill[f.key] !== undefined) initial[f.key] = prefill[f.key];
        else if (f.type === "select") initial[f.key] = f.options[0];
        else initial[f.key] = "";
      })
    );
    return initial;
  };
  // Brouillon : ce que la personne a déjà écrit est gardé sur son appareil (pas pour les formulaires préremplis)
  const [brouillon] = useState(() => {
    try { const b = JSON.parse(window.localStorage.getItem(cle) || "null"); return b && typeof b === "object" && b.values ? b : null; } catch (e) { return null; }
  });
  const [values, setValues] = useState(() => {
    const base = valeursInitiales();
    if (brouillon) Object.keys(base).forEach((k) => { if (typeof brouillon.values[k] === "string") base[k] = brouillon.values[k]; });
    return base;
  });
  const [etape, setEtape] = useState(() => (brouillon && Number.isInteger(brouillon.etape) ? Math.max(0, Math.min(brouillon.etape, nbEtapes)) : 0));
  const [restaure, setRestaure] = useState(!!brouillon);
  const [erreurs, setErreurs] = useState({});
  const [message, setMessage] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const enHaut = useRef(null);

  // Compte Roblox (formulaires publics) : il doit être vérifié, et son casier ne doit contenir ni délit ni crime
  const etapeCompte = verifierCompte ? sections.findIndex((s) => s.fields.some((f) => f.key === "pseudoRoblox")) : -1;
  const [compte, setCompte] = useState(() => robloxMemorise("roblox_cand")); // { id, username, displayName, cle }
  useEffect(() => { if (compte) memoriserRoblox(compte, "roblox_cand"); }, [compte]);
  const [verif, setVerif] = useState({ busy: false, erreur: "" });
  const cleCompte = String(values.pseudoRoblox || "").trim().replace(/^@/, "").toLowerCase();
  const compteOk = etapeCompte < 0 || (!!compte && compte.cle === cleCompte); // modifier le pseudo après vérification annule la vérification
  const avatars = useAvatars([compte && compte.id]);

  // Compte Discord (formulaires publics) : lié par un code reçu en message privé ; sert à recontacter le candidat
  const etapeDiscord = verifierCompte ? (etapeCompte >= 0 ? etapeCompte : 0) : -1;
  const [discord, setDiscord] = useState(() => preuveValide("candidature")); // { preuve, pseudo, exp }
  const discordOk = etapeDiscord < 0 || (!!discord && discord.exp > Date.now());

  useEffect(() => {
    const aSaisie = sections.some((sec) => sec.fields.some((f) => f.type !== "select" && String(values[f.key] || "").trim()));
    const t = setTimeout(() => {
      try { if (aSaisie) window.localStorage.setItem(cle, JSON.stringify({ values, etape, maj: Date.now() })); } catch (e) { /* stockage indisponible */ }
    }, 400);
    return () => clearTimeout(t);
  }, [values, etape]);

  const manquants = (i) => (sections[i] ? sections[i].fields.filter((f) => f.required && !String(values[f.key] || "").trim()) : []);
  const compteAVerifier = (i) => i === etapeCompte && !compteOk;
  const discordAVerifier = (i) => i === etapeDiscord && !discordOk;
  const incomplet = (i) => manquants(i).length > 0 || compteAVerifier(i) || discordAVerifier(i);
  const premierIncomplet = () => { for (let i = 0; i < nbEtapes; i++) if (incomplet(i)) return i; return -1; };
  const peutAller = (i) => { for (let j = 0; j < i && j < nbEtapes; j++) if (incomplet(j)) return false; return true; };
  const defilerHaut = () => { if (enHaut.current) enHaut.current.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const aller = (i) => { setEtape(i); setMessage(""); setErreurs({}); setTimeout(defilerHaut, 30); };

  async function verifier() {
    const at = String(values.pseudoRoblox || "").trim().replace(/^@/, "");
    if (!at) { setVerif({ busy: false, erreur: "Renseigne d'abord ton pseudo Roblox (nom d'utilisateur exact)." }); return; }
    setVerif({ busy: true, erreur: "" });
    let res;
    try { res = await verifierCompte(at); }
    catch (err) { console.error(err); res = { ok: false, error: "Vérification impossible pour le moment, réessaie dans un instant." }; }
    if (res && res.ok) { setCompte({ ...res.compte, cle: at.toLowerCase() }); setVerif({ busy: false, erreur: "" }); }
    else { setCompte(null); setVerif({ busy: false, erreur: (res && res.error) || "Compte Roblox introuvable." }); }
    setMessage("");
  }
  function signaler(i) {
    const m = manquants(i);
    if (!m.length) {
      if (compteAVerifier(i)) setMessage("Vérifie ton compte Roblox avant de continuer : clique sur « Vérifier mon compte Roblox ».");
      else if (discordAVerifier(i)) setMessage("Lie ton compte Discord avant de continuer : le recrutement te recontactera par ce compte.");
      return;
    }
    const e = {};
    m.forEach((f) => { e[f.key] = true; });
    setErreurs(e);
    setMessage(`${m.length} champ${m.length > 1 ? "s" : ""} obligatoire${m.length > 1 ? "s" : ""} à compléter.`);
    setTimeout(() => { const el = document.getElementById("champ-" + m[0].key); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60);
  }
  function suivant() {
    if (incomplet(etape)) { signaler(etape); return; }
    aller(Math.min(etape + 1, nbEtapes));
  }
  function setField(key, v) {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (erreurs[key]) setErreurs((e) => { const c = { ...e }; delete c[key]; return c; });
  }

  async function envoyer() {
    const i = premierIncomplet();
    if (i !== -1) { setEtape(i); setTimeout(() => signaler(i), 80); return; }
    const answers = sections.flatMap((sec) => sec.fields.map((f) => ({ label: f.label, value: values[f.key] })));
    if (compte && etapeCompte >= 0) answers.push({ label: "Compte Roblox vérifié", value: `${compte.displayName} (@${compte.username}) — ID ${compte.id}` });
    const nom = values.nom_rp || "";
    const prenom = values.prenom_rp || "";
    const displayName = prenom || nom ? `${prenom} ${nom}`.trim() : values.pseudoDiscord || "Candidat";
    setMessage("");
    setEnvoiEnCours(true);
    let res;
    try { res = await onSubmit({ poste, displayName, contact: (discord && discord.pseudo) || values.pseudoDiscord || "", answers, ...(discord ? { preuveDiscord: discord.preuve } : {}) }); }
    catch (err) { console.error(err); res = { ok: false, error: "Échec de l'envoi, réessaie dans un instant." }; }
    setEnvoiEnCours(false);
    // En cas d'échec, on affiche la raison (limite d'envois, connexion…) au lieu de ne rien faire
    if (res && res.ok === false) { setMessage(res.error || "L'envoi a échoué, réessaie dans un instant."); return; }
    try { window.localStorage.removeItem(cle); } catch (e) { /* rien */ }
  }
  function submit(e) {
    e.preventDefault();
    if (envoiEnCours) return;
    if (etape < nbEtapes) suivant(); else envoyer();
  }

  const total = compterQuestions(sections);
  const duree = Math.max(1, Math.round(total * 0.6));
  const pct = nbEtapes ? Math.round((Math.min(etape, nbEtapes) / nbEtapes) * 100) : 100;
  const sec = sections[etape];
  const dernier = etape >= nbEtapes;
  const manque = premierIncomplet();
  const titres = [...sections.map((x) => x.title), "Récapitulatif"];
  const carte = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 16, padding: "24px 26px", boxShadow: "0 8px 26px -14px rgba(7,20,46,0.35)" };

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 70px", fontFamily: FONT_UI }}>
      <div ref={enHaut} style={{ maxWidth: 740, margin: "0 auto", scrollMarginTop: 16 }}>
        <button type="button" onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>

        <div style={{ background: "linear-gradient(135deg, #0C2655, #123A7A)", color: "#fff", borderRadius: 16, padding: "22px 24px", marginBottom: 16, boxShadow: "0 10px 30px -14px rgba(7,20,46,0.6)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 27, fontWeight: 700, marginBottom: 4, lineHeight: 1.15 }}>{title}</div>
          {intro && <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.55, marginBottom: 12 }}>{intro}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[`📝 ${total} question${total > 1 ? "s" : ""}`, `⏱ environ ${duree} min`, `🧭 ${nbEtapes} étape${nbEtapes > 1 ? "s" : ""}`, "💾 brouillon enregistré"].map((t) => (
              <span key={t} style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 600 }}>{t}</span>
            ))}
          </div>
        </div>

        {restaure && (
          <div style={{ background: "#E6EDF7", border: "1px solid #9FB6D8", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#14213A", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: "1 1 240px" }}>💾 Nous avons retrouvé ton brouillon : tu reprends là où tu t'étais arrêté.</span>
            <button type="button" style={smallBtn} onClick={() => { try { window.localStorage.removeItem(cle); } catch (e) { /* rien */ } setValues(valeursInitiales()); setEtape(0); setRestaure(false); }}>Repartir de zéro</button>
          </div>
        )}

        {/* Étapes */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 2px 8px" }}>
          {titres.map((t, i) => {
            const fait = i < etape;
            const actif = i === etape;
            const accessible = i === etape || i < etape || peutAller(i);
            return (
              <button key={i} type="button" disabled={!accessible} onClick={() => aller(i)} style={{ flex: "1 0 auto", minWidth: 104, display: "flex", alignItems: "center", gap: 8, textAlign: "left", background: actif ? "#123A7A" : "#fff", color: actif ? "#fff" : "#14213A", border: `1px solid ${actif ? "#123A7A" : "#C3D0E2"}`, borderRadius: 10, padding: "7px 10px", cursor: accessible ? "pointer" : "not-allowed", opacity: accessible ? 1 : 0.55, fontFamily: FONT_UI }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: actif ? "#fff" : fait ? "#2E7D4F" : "#E3EAF4", color: actif ? "#123A7A" : fait ? "#fff" : "#5A6B84", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{fait ? "✓" : i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>{t}</span>
              </button>
            );
          })}
        </div>
        <div style={{ height: 6, background: "#D3DDEA", borderRadius: 4, overflow: "hidden", margin: "4px 2px 16px" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #2F6FDE, #2E7D4F)", transition: "width .3s" }} />
        </div>

        <form onSubmit={submit} noValidate style={carte}>
          {!dernier && sec && (
            <div>
              <div style={{ fontFamily: FONT_TITRE, fontSize: 21, fontWeight: 700, color: "#14213A", marginBottom: 2 }}>{sec.title}</div>
              <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 16 }}>Étape {etape + 1} sur {nbEtapes} · les champs marqués d'un * sont obligatoires</div>
              {sec.fields.map((f) => (
                <ChampCandidature key={f.key} f={f} value={values[f.key]} onChange={(v) => setField(f.key, v)} erreur={!!erreurs[f.key]} />
              ))}
              {etape === etapeCompte && (
                <div style={{ background: compteOk ? "#E3F2E8" : "#F5F8FC", border: `1px solid ${compteOk ? "#2E7D4F" : "#C3D0E2"}`, borderRadius: 12, padding: "14px 16px", margin: "6px 0 4px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#14213A", marginBottom: 4 }}>🔗 Lier mon compte Roblox</div>
                  <div style={{ fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.5, marginBottom: 10 }}>Ton compte Roblox doit être vérifié pour continuer. On consulte aussi ton casier judiciaire : <b>un délit ou un crime empêche de déposer une candidature</b> (les contraventions ne bloquent pas).</div>
                  {compteOk ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar src={avatars[compte.id]} taille={44} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#1F6B42" }}>✓ Compte Roblox vérifié</div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#14213A" }}>{compte.displayName} <span style={{ fontWeight: 400, color: "#5A6B84" }}>@{compte.username}</span></div>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={verifier} disabled={verif.busy} style={{ ...smallBtn, background: "#123A7A", color: "#fff", borderColor: "#123A7A", padding: "9px 16px", opacity: verif.busy ? 0.7 : 1 }}>{verif.busy ? "Vérification…" : "Vérifier mon compte Roblox"}</button>
                  )}
                  {verif.erreur && !compteOk && <div style={{ marginTop: 10, background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.45 }}>{verif.erreur}</div>}
                </div>
              )}
              {etape === etapeDiscord && (
                <div style={{ background: discordOk ? "#E3F2E8" : "#F5F8FC", border: `1px solid ${discordOk ? "#2E7D4F" : "#C3D0E2"}`, borderRadius: 12, padding: "14px 16px", margin: "10px 0 4px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#14213A", marginBottom: 4 }}>💬 Lier mon compte Discord</div>
                  {discordOk ? (
                    <div style={{ fontSize: 13, color: "#1F6B42", fontWeight: 700 }}>✓ Compte Discord lié : {discord.pseudo}
                      <button type="button" onClick={() => setDiscord(null)} style={{ ...smallBtn, marginLeft: 10, padding: "3px 10px" }}>Changer</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.5, marginBottom: 10 }}>Obligatoire : c'est sur Discord que le recrutement te répondra et te donnera ton rôle si tu es accepté(e).</div>
                      <LiaisonDiscord usage="candidature" defaut={values.pseudoDiscord || ""} onLie={(d) => { setDiscord(d); setMessage(""); if (Object.prototype.hasOwnProperty.call(values, "pseudoDiscord")) setField("pseudoDiscord", d.pseudo); }} />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {dernier && (
            <div>
              <div style={{ fontFamily: FONT_TITRE, fontSize: 21, fontWeight: 700, color: "#14213A", marginBottom: 2 }}>Récapitulatif</div>
              <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 16, lineHeight: 1.5 }}>Relis tes réponses avant d'envoyer. Tu peux corriger n'importe quelle étape avec « Modifier ».</div>
              {manque !== -1 && (
                <div style={{ background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>
                  ⚠️ {manquants(manque).length ? "Il reste des champs obligatoires à compléter" : compteAVerifier(manque) ? "Ton compte Roblox doit être vérifié" : "Ton compte Discord doit être lié (la liaison dure 3 h : refais-la si elle a expiré)"} dans l'étape « {sections[manque].title} ».
                  <button type="button" onClick={() => aller(manque)} style={{ ...smallBtn, marginLeft: 8 }}>Y aller</button>
                </div>
              )}
              {sections.map((x, i) => (
                <div key={i} style={{ border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 14px", marginBottom: 12, background: "#F9FBFE" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 800 }}>{x.title}</div>
                    <button type="button" onClick={() => aller(i)} style={smallBtn}>Modifier</button>
                  </div>
                  {x.fields.map((f) => {
                    const v = String(values[f.key] || "").trim();
                    return (
                      <div key={f.key} style={{ marginBottom: 9 }}>
                        <div style={{ fontSize: 11.5, color: "#5A6B84", marginBottom: 2 }}>{f.label}</div>
                        {v ? <div style={{ fontSize: 13.5, color: "#14213A", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{v}</div>
                          : <div style={{ fontSize: 13, color: f.required ? "#C0172D" : "#9AA8BD", fontWeight: f.required ? 700 : 400 }}>{f.required ? "⚠ À compléter" : "— non renseigné"}</div>}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div style={{ background: "#FFF4D6", border: "1px solid #E8D28A", color: "#6B4E00", borderRadius: 10, padding: "11px 13px", fontSize: 12.5, lineHeight: 1.55, margin: "14px 0 4px" }}>
                <b>ℹ️ Numéro de dossier :</b> après l'envoi, un numéro de dossier te sera donné. <b>Garde-le précieusement</b> (note-le ou fais une capture d'écran) : il te permettra de consulter la réponse à ta candidature.
              </div>
            </div>
          )}

          {message && <div style={{ color: "#8A1020", background: "#FBE3E7", border: "1px solid #C0172D", borderRadius: 10, padding: "10px 12px", fontSize: 13, margin: "14px 0 0", lineHeight: 1.45 }}>{message}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap", alignItems: "center" }}>
            {etape > 0 && <button type="button" onClick={() => aller(etape - 1)} style={{ ...smallBtn, padding: "11px 18px" }}>← Précédent</button>}
            <div style={{ flex: 1 }} />
            {!dernier && <button type="button" onClick={suivant} className="gh-btn-anim" style={{ background: "#123A7A", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: FONT_UI }}>{etape === nbEtapes - 1 ? "Voir le récapitulatif →" : "Suivant →"}</button>}
            {dernier && <button type="submit" disabled={envoiEnCours} className="gh-btn-anim" style={{ background: "#2E7D4F", color: "#fff", border: "none", borderRadius: 10, padding: "13px 28px", fontWeight: 800, fontSize: 15, cursor: envoiEnCours ? "wait" : "pointer", opacity: envoiEnCours ? 0.7 : 1, fontFamily: FONT_UI }}>{envoiEnCours ? "Envoi en cours…" : "✅ Envoyer ma candidature"}</button>}
          </div>
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
// L'identité est obligatoire pour toute candidature publique ; un questionnaire interne peut s'en passer
export const identiteDemandee = (q) => q.visibilite !== "interne" || q.identite !== false;

export function sectionsDe(q) {
  const sections = (q.sections || [])
    .map((s) => ({
      title: s.title || "Sans titre",
      fields: (s.fields || []).map((f) => ({
        key: f.key,
        label: f.label,
        aide: f.aide || undefined,
        type: f.type === "text" ? undefined : f.type,
        required: !!f.required,
        options: f.type === "select" ? ((f.options || []).length ? f.options : ["Oui", "Non"]) : undefined,
      })),
    }))
    .filter((s) => s.fields.length > 0);
  // Candidature externe (publique) : l'identité est toujours demandée (RP, naissance, comptes Roblox et Discord à lier)
  if (identiteDemandee(q)) {
    const deja = (re) => sections.some((sec) => sec.fields.some((f) => re.test(String(f.key || "")) || re.test(String(f.label || "").toLowerCase())));
    const champs = [];
    if (!deja(/pr[ée]nom/)) champs.push({ key: "prenom_rp", label: "Prénom RP", aide: "Le prénom de ton personnage (il sera inscrit sur ta fiche d'agent).", required: true });
    if (!deja(/^nom_rp$|(^|\s)nom\s*(rp|de famille)?$/)) champs.push({ key: "nom_rp", label: "Nom RP", aide: "Le nom de famille de ton personnage.", required: true });
    if (!deja(/naissance.*(date)|date.*naissance|date_naissance/)) champs.push({ key: "date_naissance", label: "Date de naissance RP", type: "date", required: true });
    if (!deja(/lieu.*naissance|lieu_naissance/)) champs.push({ key: "lieu_naissance", label: "Lieu de naissance RP", aide: "Ville ou commune de naissance de ton personnage.", required: true });
    champs.push(
      { key: "pseudoRoblox", label: "Pseudo Roblox", aide: "Ton nom d'utilisateur Roblox exact (celui qui commence par @ sur ton profil), pas ton nom affiché.", required: true },
      { key: "pseudoDiscord", label: "Pseudo Discord", required: true },
    );
    sections.unshift({ title: "Identité", fields: champs });
  }
  return sections;
}

export function QuestionnaireFerme({ onBack }) {
  return <Confirmation title="Questionnaire indisponible" message="Ce questionnaire est fermé ou n'existe plus." onBack={onBack} />;
}

// Liste de questionnaires à choisir (page publique si onCancel, sinon dans le tableau de bord)
const nbQuestionsQ = (q) => (q.sections || []).reduce((n, sec) => n + (sec.fields || []).length, 0) + (identiteDemandee(q) ? 6 : 0);
const dureeQ = (n) => Math.max(1, Math.round(n * 0.6));

export function QuestionnairesListe({ liste, onOpen, onCancel }) {
  const contenu = (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {onCancel && <button type="button" onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>}
      {onCancel ? (
        <div style={{ background: "linear-gradient(135deg, #0C2655, #123A7A)", color: "#fff", borderRadius: 16, padding: "22px 24px", marginBottom: 18, boxShadow: "0 10px 30px -14px rgba(7,20,46,0.6)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 28, fontWeight: 700, marginBottom: 4 }}>📋 Rejoindre la Gendarmerie</div>
          <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.55 }}>Choisis le poste qui te correspond. Chaque formulaire se remplit en quelques étapes, avec un brouillon enregistré automatiquement.</div>
        </div>
      ) : <h2 style={h2Style}>Questionnaires disponibles</h2>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {liste.map((q) => {
          const n = nbQuestionsQ(q);
          const nbSec = (q.sections || []).length;
          return (
            <button key={q.id} type="button" onClick={() => onOpen(q.id)} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 16, textAlign: "left", background: "#fff", border: "1px solid #D3DDEA", borderLeft: "6px solid #123A7A", borderRadius: 14, padding: "16px 18px", cursor: "pointer", boxShadow: "0 8px 24px -14px rgba(7,20,46,0.4)", fontFamily: FONT_UI }}>
              <span style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #123A7A, #2F6FDE)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>📋</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: FONT_TITRE, fontSize: 18, fontWeight: 700, color: "#14213A", lineHeight: 1.2 }}>{q.titre}</span>
                {q.intro && <span style={{ display: "block", fontSize: 12.5, color: "#3A4D6B", margin: "4px 0 8px", lineHeight: 1.5 }}>{q.intro}</span>}
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[`📝 ${n} questions`, `⏱ ~${dureeQ(n)} min`, `🧭 ${nbSec + 1} étapes`].map((t) => <span key={t} style={{ background: "#EEF2F8", color: "#3A4D6B", border: "1px solid #D3DDEA", borderRadius: 999, padding: "1px 9px", fontSize: 11.5, fontWeight: 600 }}>{t}</span>)}
                </span>
              </span>
              <span style={{ color: "#123A7A", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>Commencer →</span>
            </button>
          );
        })}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18 }}>Aucun questionnaire ouvert pour le moment. Reviens bientôt !</div>}
      </div>
    </div>
  );
  if (!onCancel) return contenu;
  return <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 60px", fontFamily: FONT_UI }}>{contenu}</div>;
}

/* ---------- Espace candidat : accueil, candidatures en cours, dépôt, conditions ---------- */

const PHOTOS_CANDIDAT = ["/photo-candidat.jpg", "https://images.pexels.com/photos/4827706/pexels-photo-4827706.jpeg?auto=compress&cs=tinysrgb&w=1400&h=800&fit=crop", "https://images.pexels.com/photos/4646839/pexels-photo-4646839.jpeg?auto=compress&cs=tinysrgb&w=1400&h=800&fit=crop"];

function PhotoCandidat({ style }) {
  const [i, setI] = useState(0);
  if (i >= PHOTOS_CANDIDAT.length) return null;
  return <img src={PHOTOS_CANDIDAT[i]} alt="" aria-hidden="true" onError={() => setI(i + 1)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }} />;
}

const lignesConditions = (t) => String(t || "").split(/\r?\n/).map((l) => l.replace(/^\s*[-•*–]\s*/, "").trim()).filter(Boolean);

function CarteDossierEnCours({ poste, numero, date }) {
  const [etat, setEtat] = useState({ chargement: true, dossier: null, erreur: false });
  const [ouvert, setOuvert] = useState(false);
  const charger = useCallback(async () => {
    setEtat((e) => ({ ...e, chargement: true }));
    try { setEtat({ chargement: false, dossier: await chercherDossier(numero), erreur: false }); }
    catch (e) { setEtat({ chargement: false, dossier: null, erreur: true }); }
  }, [numero]);
  useEffect(() => { charger(); }, [charger]);
  const s = etat.dossier ? (STATUTS_DOSSIER[etat.dossier.statut] || STATUTS_DOSSIER["En attente"]) : null;
  const couleur = s ? s.couleur : "#5A6B84";
  return (
    <div className="gn-appear" style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `6px solid ${couleur}`, borderRadius: 16, padding: "16px 18px", boxShadow: "0 12px 28px -20px rgba(7,20,46,0.5)", fontFamily: FONT_UI }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, background: `${couleur}1c`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{s ? s.icone : "📄"}</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 18, fontWeight: 700, color: "#14213A", lineHeight: 1.2 }}>{poste}</div>
          <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 3 }}>Dossier <b style={{ fontFamily: "'Courier New', monospace", color: "#123A7A" }}>{numero}</b>{date ? <> · envoyé le {dateLongue(date)}</> : null}</div>
        </div>
        <span style={{ background: couleur, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", padding: "5px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>{etat.chargement ? "Consultation…" : etat.erreur ? "Indisponible" : etat.dossier ? s.titre : "Dossier introuvable"}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setOuvert(!ouvert)} style={smallBtn}>{ouvert ? "Masquer le suivi" : "Voir le suivi"}</button>
        <button type="button" onClick={charger} style={smallBtn}>↻ Actualiser</button>
      </div>
      {ouvert && (
        <div style={{ marginTop: 14 }}>
          {etat.dossier ? <CarteStatutDossier dossier={etat.dossier} /> : <div style={{ fontSize: 13, color: "#6B4E00", background: "#FFF4E0", border: "1px solid #E8D28A", borderRadius: 10, padding: 12 }}>{etat.erreur ? "Impossible de consulter le dossier pour le moment. Réessaie dans quelques instants." : "Ce numéro n'est plus reconnu. Contacte le recrutement sur Discord."}</div>}
        </div>
      )}
    </div>
  );
}

export function EspaceCandidat({ liste, recrutementOuvert, onOpen, onCancel, onSuivi }) {
  const [vue, setVue] = useState("accueil");
  const dossiers = Object.entries(lireDossiersLocaux()).map(([poste, d]) => ({ poste, ...d })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const peutDeposer = liste.length > 0;

  if (vue === "choix") {
    return (
      <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 70px", fontFamily: FONT_UI }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <button type="button" onClick={() => setVue("accueil")} style={{ ...smallBtn, marginBottom: 16 }}>← Mon espace candidat</button>
          <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #0C2655, #123A7A)", color: "#fff", borderRadius: 20, padding: "26px 28px", marginBottom: 20, boxShadow: "0 22px 44px -26px rgba(7,20,46,0.8)" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #0B3A8F, #FFFFFF, #C0172D)" }} />
            <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.75, fontWeight: 700 }}>DÉPOSER UNE CANDIDATURE</div>
            <div style={{ fontFamily: FONT_TITRE, fontSize: 30, fontWeight: 700, margin: "6px 0 6px" }}>Choisissez votre candidature</div>
            <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.6, maxWidth: 560 }}>Chaque candidature a ses propres conditions d'admission. Vous les consulterez, avec les conditions générales, avant de remplir le formulaire. Votre brouillon est enregistré automatiquement.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {liste.map((q) => {
              const n = nbQuestionsQ(q);
              const lignes = lignesConditions(q.conditionsPropres);
              const dejaDepose = !!lireDossiersLocaux()[q.poste || q.titre];
              return (
                <div key={q.id} className="gh-card-anim" style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: "5px solid #123A7A", borderRadius: 18, padding: "20px 22px", boxShadow: "0 16px 34px -24px rgba(7,20,46,0.55)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                    <span style={{ width: 54, height: 54, borderRadius: 16, background: "linear-gradient(135deg, #123A7A, #2F6FDE)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 27, flexShrink: 0, boxShadow: "0 12px 22px -12px #123A7A" }}>🎖️</span>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontFamily: FONT_TITRE, fontSize: 21, fontWeight: 700, color: "#14213A", lineHeight: 1.2 }}>{q.titre}</div>
                      {q.intro && <div style={{ fontSize: 13, color: "#3A4D6B", margin: "5px 0 0", lineHeight: 1.55 }}>{q.intro}</div>}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
                        {[`📝 ${n} questions`, `⏱ ~${dureeQ(n)} min`, `🧭 ${(q.sections || []).length + 1} étapes`].map((t) => <span key={t} style={{ background: "#EEF2F8", color: "#3A4D6B", border: "1px solid #D3DDEA", borderRadius: 999, padding: "1px 10px", fontSize: 11.5, fontWeight: 600 }}>{t}</span>)}
                        {dejaDepose && <span style={{ background: "#FFF4E0", color: "#8A5A00", border: "1px solid #E8D28A", borderRadius: 999, padding: "1px 10px", fontSize: 11.5, fontWeight: 700 }}>Déjà déposée depuis cet appareil</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, background: "#F6F9FD", border: "1px solid #E1E8F2", borderRadius: 14, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#2B3F66", marginBottom: 6 }}>📜 Conditions d'admission</div>
                    {lignes.length > 0
                      ? <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#14213A", lineHeight: 1.65 }}>{lignes.slice(0, 5).map((l, i) => <li key={i}>{l}</li>)}{lignes.length > 5 && <li style={{ listStyle: "none", marginLeft: -18, color: "#5A6B84" }}>… et {lignes.length - 5} autre{lignes.length - 5 > 1 ? "s" : ""} à l'étape suivante</li>}</ul>
                      : <div style={{ fontSize: 13, color: "#5A6B84" }}>Aucune condition particulière : seules les conditions générales s'appliquent.</div>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                    <button type="button" onClick={() => onOpen(q.id)} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "11px 26px", marginTop: 0 }}>Postuler →</button>
                  </div>
                </div>
              );
            })}
            {!peutDeposer && <div style={{ color: "#5A6B84", fontSize: 13.5, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, textAlign: "center" }}>Aucune candidature n'est ouverte pour le moment. Reviens bientôt !</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 70px", fontFamily: FONT_UI }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <button type="button" onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour à l'accueil</button>
        <BandeauCandidat principal recrutementOuvert={recrutementOuvert} surtitre="GENDARMERIE NATIONALE · NÎMES RP" titre="Bienvenue dans votre espace candidat" texte="Suivez l'avancement de vos candidatures et déposez-en une nouvelle pour rejoindre nos rangs." bouton="📝 Déposer une candidature" onClick={() => setVue("choix")} />

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2.5, fontWeight: 800, color: "#2B3F66" }}>MON SUIVI</div>
            <div style={{ fontFamily: FONT_TITRE, fontSize: 26, fontWeight: 700, color: "#14213A" }}>Candidatures en cours</div>
          </div>
          {onSuivi && <button type="button" onClick={onSuivi} style={smallBtn}>🔎 J'ai un numéro de dossier</button>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {dossiers.map((d) => <CarteDossierEnCours key={d.poste} poste={d.poste} numero={d.numero} date={d.date} />)}
          {dossiers.length === 0 && (
            <div style={{ background: "#fff", border: "1px dashed #B8C6DB", borderRadius: 18, padding: "30px 22px", textAlign: "center" }}>
              <div style={{ fontSize: 34, marginBottom: 6 }}>📭</div>
              <div style={{ fontFamily: FONT_TITRE, fontSize: 19, fontWeight: 700, color: "#14213A" }}>Aucune candidature en cours</div>
              <div style={{ fontSize: 13, color: "#5A6B84", margin: "6px 0 14px", lineHeight: 1.55 }}>Vos candidatures déposées depuis cet appareil apparaîtront ici avec leur état.</div>
              {peutDeposer && <button type="button" onClick={() => setVue("choix")} style={{ ...buttonPrimary, width: "auto", padding: "10px 24px", marginTop: 0 }}>Déposer une candidature</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Parcours avant le formulaire : conditions générales (à cocher) puis conditions d'admission propres à la candidature
export function ParcoursConditions({ q, texteGeneral, onConfirm, onCancel }) {
  const etapes = [];
  if (texteGeneral) etapes.push({ cle: "general", titre: "Conditions générales", texte: texteGeneral, case: "J'ai lu et j'accepte les conditions générales." });
  if (String(q.conditionsPropres || "").trim()) etapes.push({ cle: "propres", titre: `Conditions d'admission — ${q.titre}`, texte: q.conditionsPropres, case: "Je remplis toutes ces conditions d'admission." });
  const [i, setI] = useState(0);
  const [coche, setCoche] = useState(false);
  const e = etapes[i];
  if (!e) return null;
  const libelles = [...etapes.map((x) => (x.cle === "general" ? "Conditions générales" : "Conditions d'admission")), "Candidature"];
  function continuer() {
    if (!coche) return;
    if (i + 1 < etapes.length) { setI(i + 1); setCoche(false); window.scrollTo(0, 0); } else onConfirm();
  }
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 10%, #123A7A, #07142E 65%)", padding: "32px 20px 60px", fontFamily: FONT_UI }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><Ecusson taille={58} /></div>
        <button type="button" onClick={onCancel} style={{ background: "none", border: "none", color: "#A9B8CE", fontSize: 13, cursor: "pointer", marginBottom: 14 }}>← Annuler</button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {libelles.map((l, k) => (
            <React.Fragment key={l}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: k <= i ? "#fff" : "#7F93B2", fontSize: 12, fontWeight: 700 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: k < i ? "#2E7D4F" : k === i ? "#2F6FDE" : "rgba(255,255,255,0.12)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{k < i ? "✓" : k + 1}</span>{l}
              </span>
              {k < libelles.length - 1 && <span style={{ width: 22, height: 2, background: "rgba(255,255,255,0.2)" }} />}
            </React.Fragment>
          ))}
        </div>
        <div className="gn-appear" key={e.cle} style={{ background: "#F7FAFD", borderRadius: 20, overflow: "hidden", boxShadow: "0 34px 64px -26px rgba(0,0,0,0.75)" }}>
          <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: "#C0172D" }} /></div>
          <div style={{ padding: "24px 26px 26px" }}>
            <div style={{ fontSize: 11, letterSpacing: 2.5, fontWeight: 800, color: "#2B3F66" }}>ÉTAPE {i + 1} SUR {etapes.length + 1}</div>
            <div style={{ fontFamily: FONT_TITRE, fontSize: 25, fontWeight: 700, color: "#14213A", margin: "4px 0 14px" }}>{e.titre}</div>
            <div style={{ maxHeight: "46vh", overflowY: "auto", background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: "16px 18px", fontSize: 13.5, color: "#14213A", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{e.texte}</div>
            <label style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, padding: "13px 15px", background: coche ? "#E3F2E8" : "#fff", border: `2px solid ${coche ? "#2E7D4F" : "#C3D0E2"}`, borderRadius: 14, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#14213A" }}>
              <input type="checkbox" checked={coche} onChange={(ev) => setCoche(ev.target.checked)} style={{ width: 20, height: 20, flexShrink: 0 }} />
              {e.case}
            </label>
            <button type="button" onClick={continuer} disabled={!coche} className={coche ? "gh-btn-anim" : undefined} style={{ ...buttonPrimary, marginTop: 14, opacity: coche ? 1 : 0.45 }}>{coche ? "Continuer →" : "Cochez la case pour continuer"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Panneau admin : création et modification des questionnaires
export function QuestionnairesAdmin({ questionnaires, onSave, grades = [], unites = [] }) {
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
    if (!window.confirm(`Supprimer « ${q.titre} » ? Les candidatures déjà reçues sont conservées.`)) return;
    sauver(questionnaires.filter((x) => x.id !== q.id), "Questionnaire supprimé.");
  }

  /* ----- Vue liste ----- */
  if (!editing) {
    return (
      <div>
        <h2 style={h2Style}>Questionnaires</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => nouveau("public")} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>+ Nouveau questionnaire</button>
        </div>
        {msg && <div style={{ fontSize: 12, color: "#123A7A", marginBottom: 12, wordBreak: "break-all" }}>{msg}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {questionnaires.map((q) => (
            <div key={q.id} style={{ ...cardBox, marginBottom: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{q.titre}</div>
              <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>
                {q.visibilite === "interne" ? "Interne" : "Public"} — {q.actif ? "🟢 Ouvert" : "🔴 Fermé"} — {nbQuestions(q)} question(s)
              </div>
              {q.visibilite === "interne" && <div style={{ fontSize: 12, color: "#3B45B5", marginTop: 4 }}>🔐 Accessible à : {resumeAcces(q)}</div>}
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
            <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun questionnaire pour l'instant. Clique sur « Nouveau questionnaire » pour créer ta première candidature.</div>
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
        <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>
          <input type="checkbox" checked={q.visibilite === "interne" ? q.identite !== false : true} disabled={q.visibilite !== "interne"} onChange={(e) => upd({ identite: e.target.checked })} /> Demander automatiquement l'identité (prénom, nom, naissance) et lier les comptes Roblox et Discord{q.visibilite !== "interne" ? " — toujours activé pour une candidature externe" : ""}
        </label>
        <label style={{ display: "block", fontSize: 13 }}>
          <input type="checkbox" checked={!!q.actif} onChange={(e) => upd({ actif: e.target.checked })} /> Questionnaire ouvert aux réponses
        </label>
        {q.visibilite !== "interne" && (
          <label style={{ display: "block", fontSize: 13, marginTop: 8 }}>
            <input type="checkbox" checked={q.conditions !== false} onChange={(e) => upd({ conditions: e.target.checked })} /> Afficher les conditions d'admission avant ce questionnaire (recrutement)
          </label>
        )}
        {q.visibilite !== "interne" && (
          <div style={{ marginTop: 12 }}>
            <Field label="Conditions d'admission propres à cette candidature (une par ligne, facultatif)" value={q.conditionsPropres || ""} onChange={(v) => upd({ conditionsPropres: v })} textarea placeholder={"Avoir 14 ans minimum\nÊtre actif sur Discord\nAvoir lu le règlement"} />
            <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: -6 }}>Elles s'affichent sur la carte de la candidature, puis à cocher avant le formulaire. Les conditions générales (communes à toutes) se règlent dans la page « Conditions d'admission ».</div>
          </div>
        )}
      </div>

      {q.visibilite === "interne" && (
        <div style={cardBox}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>🔐 Qui peut accéder à ce questionnaire ?</div>
          <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 14, lineHeight: 1.5 }}>Seuls les agents qui remplissent ces conditions le voient dans leur menu. Les admins y ont toujours accès.</div>

          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Grades</div>
          <select value={q.gradeMode || "tous"} onChange={(e) => upd({ gradeMode: e.target.value, gradeMin: q.gradeMin || (grades[0] || "") })} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 8, padding: "9px 11px", fontSize: 13, background: "#fff", marginBottom: 10 }}>
            {Object.entries(LIBELLES_MODE_GRADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {(q.gradeMode || "tous") === "min" && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 4 }}>Grade minimum (ce grade et tous les grades au-dessus) :</div>
              <select value={q.gradeMin || ""} onChange={(e) => upd({ gradeMin: e.target.value })} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 8, padding: "9px 11px", fontSize: 13, background: "#fff" }}>
                {grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}
          {(q.gradeMode || "tous") === "liste" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {[...grades].reverse().map((g) => {
                const actif = (q.gradesListe || []).includes(g);
                return <button key={g} type="button" onClick={() => upd({ gradesListe: actif ? q.gradesListe.filter((x) => x !== g) : [...(q.gradesListe || []), g] })} style={{ ...smallBtn, background: actif ? "#123A7A" : "transparent", color: actif ? "#fff" : "#14213A", borderColor: actif ? "#123A7A" : "#C3D0E2" }}>{actif ? "✓ " : ""}{g}</button>;
              })}
              {grades.length === 0 && <span style={{ fontSize: 12, color: "#5A6B84" }}>Aucun grade disponible.</span>}
            </div>
          )}

          <div style={{ fontSize: 12.5, fontWeight: 700, margin: "6px 0 4px" }}>Unités <span style={{ fontWeight: 400, color: "#5A6B84" }}>(aucune sélection = toutes les unités)</span></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {unites.map((u) => {
              const actif = (q.unitesListe || []).includes(u);
              return <button key={u} type="button" onClick={() => upd({ unitesListe: actif ? q.unitesListe.filter((x) => x !== u) : [...(q.unitesListe || []), u] })} style={{ ...smallBtn, background: actif ? "#123A7A" : "transparent", color: actif ? "#fff" : "#14213A", borderColor: actif ? "#123A7A" : "#C3D0E2" }}>{actif ? "✓ " : ""}{u}</button>;
            })}
            {unites.length === 0 && <span style={{ fontSize: 12, color: "#5A6B84" }}>Aucune unité disponible.</span>}
          </div>
          <div style={{ marginTop: 14, background: "#ECEEFE", border: "1px solid #C9CEF7", color: "#3B45B5", borderRadius: 8, padding: "8px 11px", fontSize: 12.5, fontWeight: 600 }}>Accessible à : {resumeAcces(q)}</div>
        </div>
      )}

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
              <Field label="Texte d'aide (facultatif)" value={f.aide || ""} onChange={(v) => majChamp(s.id, f.key, { aide: v })} placeholder="Précision affichée sous la question (ex : 5 lignes minimum)" />
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

const COULEURS_STATUT = { "En attente": "#E0A23A", "Acceptée": "#2E7D4F", "Refusée": "#C0172D" };
const joursDepuis = (iso) => { const t = new Date(iso).getTime(); return isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000); };
const initiales = (nom) => String(nom || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";
const texteCandidature = (c) => [
  `${c.displayName} (${c.ref}) — ${c.poste}`,
  c.contact ? `Contact : ${c.contact}` : "",
  c.conditionsAcceptees ? "Conditions d'admission : confirmées" : "",
  "",
  ...(c.answers || []).map((a) => `${a.label} : ${a.value || "—"}`),
].join("\n");

export function AdminCandidatures({ candidatures, onUpdateStatut, onUpdateNote, onPublier, onCreerCompte, onUpdateEntretien, onRoleDiscord, unites = [] }) {
  const [creation, setCreation] = useState(null); // id de la candidature dont on crée le compte
  const [statutFiltre, setStatutFiltre] = useState("En attente");
  const [poste, setPoste] = useState("Toutes");
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("recentes");
  const [ouvertes, setOuvertes] = useState({});
  const [notes, setNotes] = useState({});
  const [retour, setRetour] = useState("");
  const [publication, setPublication] = useState(false);
  const [aTransmettre, setATransmettre] = useState([]); // comptes créés automatiquement dont le message Discord n'a pas pu partir

  const postes = ["Toutes", ...Array.from(new Set(candidatures.map((c) => c.poste).filter(Boolean)))];
  const nb = (st) => candidatures.filter((c) => c.statut === st).length;
  // « Non publiée » : la décision est enregistrée, mais le candidat voit encore l'ancien statut (il ne voit la réponse qu'après « Publier les réponses »)
  const nonPubliee = (c) => c.statutPublie !== undefined && c.statutPublie !== c.statut;
  const nbNonPubliees = candidatures.filter(nonPubliee).length;
  const aPublier = candidatures.filter((c) => nonPubliee(c) && (poste === "Toutes" || c.poste === poste));
  const q = recherche.trim().toLowerCase();
  const liste = candidatures
    .filter((c) => statutFiltre === "Toutes" || (statutFiltre === "À publier" ? nonPubliee(c) : c.statut === statutFiltre))
    .filter((c) => poste === "Toutes" || c.poste === poste)
    .filter((c) => !q || `${c.displayName} ${c.ref} ${c.contact} ${c.poste} ${(c.answers || []).map((a) => a.value).join(" ")}`.toLowerCase().includes(q))
    .sort((a, b) => (tri === "anciennes" ? 1 : -1) * String(a.createdAt || "").localeCompare(String(b.createdAt || "")));

  function signaler(msg) { setRetour(msg); setTimeout(() => setRetour(""), 2500); }
  async function copier(c) {
    try { await navigator.clipboard.writeText(texteCandidature(c)); signaler("📋 Candidature copiée."); } catch (e) { signaler("Copie impossible sur ce navigateur."); }
  }
  async function decider(c, statut) {
    const verbe = statut === "Acceptée" ? "accepter" : statut === "Refusée" ? "refuser" : "remettre en attente";
    if (!window.confirm(`Confirmer : ${verbe} la candidature de ${c.displayName} ?\n\nLe candidat ne verra cette réponse qu'après avoir cliqué sur « Publier les réponses ».`)) return;
    await onUpdateStatut(c.id, statut);
  }
  async function publier() {
    const n = aPublier.length;
    if (!n || !onPublier) return;
    const cible = poste === "Toutes" ? "" : ` pour « ${poste} »`;
    if (!window.confirm(`Publier ${n} réponse${n > 1 ? "s" : ""}${cible} ?\n\nLes candidats concernés verront tout de suite leur décision. Pour les candidatures acceptées, le compte est créé et le rôle Discord donné automatiquement, et les identifiants sont envoyés au candidat en message privé Discord.`)) return;
    setPublication(true);
    const res = await onPublier(aPublier.map((c) => c.id));
    setPublication(false);
    const r = res.roles || { donnes: 0, echecs: [] };
    const base = res.echecs ? `${res.ok} réponse(s) publiée(s), ${res.echecs} en échec : réessaie.` : `📢 ${res.ok} réponse${res.ok > 1 ? "s" : ""} publiée${res.ok > 1 ? "s" : ""}.`;
    const roles = r.donnes ? ` 🎖 Rôle Discord donné à ${r.donnes} candidat${r.donnes > 1 ? "s" : ""}.` : "";
    const rates = r.echecs.length ? ` ⚠️ Rôle Discord non attribué : ${r.echecs.join(" · ")} (utilise « Donner le rôle Discord » sur la candidature).` : "";
    const cmp = res.comptes || { crees: 0, echecs: [] };
    const comptes = cmp.crees ? ` 👤 ${cmp.crees} compte${cmp.crees > 1 ? "s" : ""} créé${cmp.crees > 1 ? "s" : ""} automatiquement.` : "";
    const cRates = cmp.echecs.length ? ` ⚠️ Compte non créé : ${cmp.echecs.join(" · ")} (utilise « Créer le compte » sur la candidature).` : "";
    const dms = r.dms ? ` ✉️ Identifiants envoyés en message privé Discord à ${r.dms} candidat${r.dms > 1 ? "s" : ""}.` : "";
    setATransmettre(res.aTransmettre || []);
    setRetour(base + roles + comptes + dms + rates + cRates);
    setTimeout(() => setRetour(""), cRates || rates ? 14000 : 6000);
  }
  async function enregistrerNote(c) {
    const ok = await onUpdateNote(c.id, notes[c.id] !== undefined ? notes[c.id] : (c.noteRecruteur || ""));
    signaler(ok ? "✓ Note enregistrée." : "Échec de l'enregistrement de la note.");
  }

  const tuile = (label, valeur, couleur, filtre) => {
    const actif = statutFiltre === filtre;
    return (
      <button key={label} type="button" onClick={() => setStatutFiltre(filtre)} style={{ textAlign: "left", cursor: "pointer", background: actif ? "#fff" : "#F5F8FC", border: `1px solid ${actif ? couleur : "#D3DDEA"}`, borderTop: `4px solid ${couleur}`, borderRadius: 12, padding: "10px 14px", boxShadow: actif ? `0 6px 18px -10px ${couleur}` : "none", fontFamily: FONT_UI }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: couleur, lineHeight: 1.1 }}>{valeur}</div>
        <div style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>{label}</div>
      </button>
    );
  };

  return (
    <div style={{ fontFamily: FONT_UI, maxWidth: 940 }}>
      <h2 style={h2Style}>Candidatures reçues</h2>

      {aTransmettre.length > 0 && (
        <div style={{ background: "#FFF4E0", border: "1px solid #E8D28A", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: "#6B4E00", marginBottom: 4 }}>✉️ À transmettre à la main</div>
          <div style={{ fontSize: 12.5, color: "#6B4E00", marginBottom: 10, lineHeight: 1.5 }}>Ces comptes sont créés, mais le message privé Discord n'a pas pu être envoyé (messages privés fermés ou membre absent du serveur). Copie le message et envoie-le au candidat. Ces mots de passe ne seront plus affichés.</div>
          {aTransmettre.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#fff", border: "1px solid #E8D28A", borderRadius: 10, padding: "8px 12px", marginBottom: 6 }}>
              <span style={{ flex: 1, minWidth: 180, fontSize: 13 }}><b>{t.nom}</b> — identifiant <code>{t.username}</code> · mot de passe <code>{t.password}</code></span>
              <button type="button" style={smallBtn} onClick={() => { try { navigator.clipboard.writeText(`Bienvenue dans la Gendarmerie ! Ton compte est prêt.\nIdentifiant : ${t.username}\nMot de passe : ${t.password}\nConnecte-toi sur le site (ou avec Discord) puis suis ta formation. Pense à changer ton mot de passe dans « Mon compte ».`); signaler("📋 Message copié."); } catch (e) { /* rien */ } }}>📋 Copier le message</button>
            </div>
          ))}
          <button type="button" style={{ ...smallBtn, marginTop: 4 }} onClick={() => setATransmettre([])}>C'est fait, masquer</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        {tuile("En attente", nb("En attente"), "#E0A23A", "En attente")}
        {tuile("Acceptées", nb("Acceptée"), "#2E7D4F", "Acceptée")}
        {tuile("Refusées", nb("Refusée"), "#C0172D", "Refusée")}
        {tuile("À publier", nbNonPubliees, "#8A5A00", "À publier")}
        {tuile("Toutes", candidatures.length, "#123A7A", "Toutes")}
      </div>

      {onPublier && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: aPublier.length ? "#FFF4E0" : "#F5F8FC", border: `1px solid ${aPublier.length ? "#E8D28A" : "#D3DDEA"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ flex: "1 1 280px", fontSize: 13, color: "#3A4D6B", lineHeight: 1.55 }}>
            <b>Réponses aux candidats.</b> Accepter ou refuser une candidature reste interne : les candidats ne voient leur décision qu'après un clic sur « Publier les réponses ».
            {" "}{aPublier.length ? <b style={{ color: "#8A5A00" }}>{aPublier.length} décision{aPublier.length > 1 ? "s" : ""} en attente de publication{poste !== "Toutes" ? ` pour « ${poste} »` : ""}.</b> : "Aucune décision en attente de publication."}
          </div>
          <button type="button" onClick={publier} disabled={!aPublier.length || publication} style={{ ...smallBtn, background: aPublier.length ? "#123A7A" : "transparent", color: aPublier.length ? "#fff" : "#9AA8BD", borderColor: aPublier.length ? "#123A7A" : "#C3D0E2", padding: "9px 18px", fontSize: 13, opacity: publication ? 0.7 : 1, cursor: aPublier.length && !publication ? "pointer" : "not-allowed" }}>{publication ? "Publication…" : `📢 Publier les réponses (${aPublier.length})`}</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔎 Rechercher (nom, numéro, Discord, réponse…)" style={{ flex: "1 1 260px", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontFamily: FONT_UI, background: "#fff" }} />
        <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ border: "1px solid #C3D0E2", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontFamily: FONT_UI, background: "#fff" }}>
          <option value="recentes">Plus récentes d'abord</option>
          <option value="anciennes">Plus anciennes d'abord</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {postes.map((p) => (
          <button key={p} type="button" onClick={() => setPoste(p)} style={{ ...smallBtn, background: poste === p ? "#123A7A" : "transparent", color: poste === p ? "#fff" : "#14213A", borderColor: poste === p ? "#123A7A" : "#C3D0E2" }}>{p}</button>
        ))}
      </div>

      {retour && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#14213A", color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9000, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>{retour}</div>}

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 10 }}>{liste.length} candidature{liste.length > 1 ? "s" : ""}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {liste.map((c) => {
          const couleur = COULEURS_STATUT[c.statut] || "#9AA8BD";
          const ouvert = !!ouvertes[c.id];
          const jours = c.createdAt ? joursDepuis(c.createdAt) : null;
          const attente = c.statut === "En attente" && jours !== null;
          const reponses = c.answers || [];
          return (
            <div key={c.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `6px solid ${couleur}`, borderRadius: 14, padding: "16px 18px", boxShadow: "0 6px 20px -12px rgba(7,20,46,0.3)" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: `${couleur}22`, color: couleur, fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initiales(c.displayName)}</div>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: "#14213A" }}>{c.displayName}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11.5, color: "#123A7A", fontWeight: 700, background: "#E9EFF7", padding: "2px 8px", borderRadius: 6 }}>{c.ref}</span>
                    <span style={{ background: "#EEF2F8", color: "#3A4D6B", border: "1px solid #D3DDEA", borderRadius: 999, padding: "1px 9px", fontSize: 11.5, fontWeight: 700 }}>{c.poste}</span>
                    {c.contact && <span style={{ background: "#ECEEFE", color: "#3B45B5", border: "1px solid #C9CEF7", borderRadius: 999, padding: "1px 9px", fontSize: 11.5, fontWeight: 700 }}>💬 {c.contact}</span>}
                    {c.conditionsAcceptees && <span style={{ background: "#E3F2E8", color: "#1F6B42", border: "1px solid #2E7D4F", borderRadius: 999, padding: "1px 9px", fontSize: 11.5, fontWeight: 700 }}>✅ Conditions d'admission confirmées</span>}
                    {c.auteurMatricule && <span style={{ background: "#FFF1DC", color: "#8A5A00", borderRadius: 999, padding: "1px 9px", fontSize: 11.5, fontWeight: 700 }}>soumis par n° {numAgent(c.auteurMatricule)}</span>}
                    {c.noteRecruteur && <span style={{ background: "#FFF6E0", color: "#8A5A00", borderRadius: 999, padding: "1px 9px", fontSize: 11.5, fontWeight: 700 }}>🗒 note</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <StatutBadge statut={c.statut} />
                  {nonPubliee(c)
                    ? <div style={{ fontSize: 11, fontWeight: 700, color: "#8A5A00", background: "#FFF1DC", border: "1px solid #E8D28A", borderRadius: 999, padding: "1px 9px", marginTop: 6, display: "inline-block" }}>🔒 Non publiée — le candidat voit « {c.statutPublie} »</div>
                    : c.statut !== "En attente" && <div style={{ fontSize: 11, fontWeight: 700, color: "#1F6B42", marginTop: 6 }}>📢 Réponse publiée</div>}
                  <div style={{ fontSize: 11.5, color: attente && jours >= 3 ? "#B25E00" : "#5A6B84", fontWeight: attente && jours >= 3 ? 700 : 500, marginTop: 6 }}>
                    {c.createdAt ? `Reçue le ${dateLongue(c.createdAt)}` : ""}
                    {attente ? ` · ${jours === 0 ? "aujourd'hui" : `en attente depuis ${jours} j`}` : ""}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                <button type="button" onClick={() => setOuvertes({ ...ouvertes, [c.id]: !ouvert })} style={{ ...smallBtn, background: ouvert ? "#E6EDF7" : "transparent" }}>{ouvert ? "▲ Masquer" : `📖 Lire la candidature (${reponses.length})`}</button>
                <button type="button" onClick={() => copier(c)} style={smallBtn}>📋 Copier</button>
                <div style={{ flex: 1 }} />
                {c.statut !== "Acceptée" && <button type="button" onClick={() => decider(c, "Acceptée")} style={{ ...smallBtn, color: "#1F6B42", borderColor: "#2E7D4F", background: "#E3F2E8" }}>✓ Accepter</button>}
                {c.statut !== "Refusée" && <button type="button" onClick={() => decider(c, "Refusée")} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>✕ Refuser</button>}
                {c.statut !== "En attente" && <button type="button" onClick={() => decider(c, "En attente")} style={smallBtn}>↺ Remettre en attente</button>}
                {c.statut === "Acceptée" && onRoleDiscord && (c.roleDiscordLe
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: "#3B47B5", alignSelf: "center" }}>🎖 Rôle Discord donné</span>
                  : <button type="button" onClick={async () => { const r = await onRoleDiscord(c.id); signaler(r.ok ? `🎖 ${r.message}` : `⚠️ ${r.message}`); }} style={{ ...smallBtn, color: "#3B47B5", borderColor: "#5865F2" }}>🎖 Donner le rôle Discord</button>)}
                {c.statut === "Acceptée" && onCreerCompte && (c.compteCreeLe || !(c.answers || []).some((a) => a && /discord/i.test(String(a.label || "")) && String(a.value || "").trim())
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: "#1F6B42", alignSelf: "center" }}>👤 Compte créé ({c.compteIdentifiant || "—"})</span>
                  : <button type="button" onClick={() => setCreation(creation === c.id ? null : c.id)} style={{ ...smallBtn, background: "#123A7A", color: "#fff", borderColor: "#123A7A" }}>👤 Créer le compte</button>)}
              </div>
              {creation === c.id && onCreerCompte && <CreerCompteCandidat candidature={c} unites={unites} onCreer={onCreerCompte} onFermer={() => setCreation(null)} />}

              {ouvert && (
                <div style={{ marginTop: 14, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 12, padding: 16 }}>
                  {c.conditionsAcceptees && (
                    <div style={{ background: "#E3F2E8", border: "1px solid #2E7D4F", color: "#1F6B42", borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>✅ Le candidat confirme respecter toutes les conditions d'admission{c.createdAt ? ` (le ${dateLongue(c.createdAt)})` : ""}</div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px 22px" }}>
                    {reponses.map((a, i) => {
                      const long = String(a.value || "").length > 90;
                      return (
                        <div key={i} style={long ? { gridColumn: "1 / -1" } : undefined}>
                          <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "#5A6B84", marginBottom: 3, fontWeight: 700 }}>{a.label}</div>
                          <div style={{ fontSize: 14, color: "#14213A", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", background: long ? "#fff" : "transparent", border: long ? "1px solid #E3EAF4" : "none", borderRadius: 8, padding: long ? "8px 10px" : 0 }}>{a.value || "—"}</div>
                        </div>
                      );
                    })}
                  </div>

                  {onUpdateNote && (
                    <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px dashed #C3D0E2" }}>
                      <div style={{ fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: "#8A5A00", fontWeight: 800, marginBottom: 6 }}>🗒 Note interne du recrutement (jamais visible du candidat)</div>
                      <textarea value={notes[c.id] !== undefined ? notes[c.id] : (c.noteRecruteur || "")} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value.slice(0, 2000) })} rows={3} placeholder="Impressions, points à vérifier, date d'entretien…" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E0C36B", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: FONT_UI, background: "#FFFDF4", resize: "vertical" }} />
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => enregistrerNote(c)} style={smallBtn}>Enregistrer la note</button>
                        {c.noteParNom && <span style={{ fontSize: 11.5, color: "#5A6B84" }}>Dernière note : {c.noteParNom}{c.noteParLe ? `, le ${dateLongue(c.noteParLe)}` : ""}</span>}
                      </div>
                    </div>
                  )}
                  {onUpdateEntretien && <FicheEntretien c={c} onSave={onUpdateEntretien} signaler={signaler} />}
                </div>
              )}
            </div>
          );
        })}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18 }}>Aucune candidature ne correspond à ces filtres.</div>}
      </div>
    </div>
  );
}
/* ---------- Création du compte d'un candidat accepté ---------- */

export const sansAccentsId = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
export function mdpAleatoire(n = 10) {
  const car = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const t = new Uint32Array(n); window.crypto.getRandomValues(t);
  return Array.from(t, (x) => car[x % car.length]).join("");
}
// Retrouve prénom, nom, compte Roblox et pseudo Discord dans les réponses du candidat
export function infosDuCandidat(c) {
  const reps = c.answers || [];
  const val = (re) => { const a = reps.find((x) => re.test(String(x.label || "").toLowerCase())); return a ? String(a.value || "").trim() : ""; };
  const prenom = val(/pr[ée]nom/);
  const nom = reps.find((x) => /(^|\s)nom/.test(String(x.label || "").toLowerCase()) && !/pr[ée]nom|pseudo|utilisateur|discord|roblox/.test(String(x.label || "").toLowerCase()));
  const rob = reps.find((x) => x.label === "Compte Roblox vérifié");
  const m = rob ? /^(.*?)\s*\(@([A-Za-z0-9_]{3,20})\)/.exec(String(rob.value || "")) : null;
  const idRob = rob ? (/ID\s+(\d{3,})/.exec(String(rob.value || "")) || [])[1] : "";
  return { prenom, nom: nom ? String(nom.value || "").trim() : "", pseudoRoblox: m ? m[1] : "", robloxUsername: m ? m[2] : "", robloxId: idRob || "", pseudoDiscord: val(/discord/), dateNaissance: val(/date.*naissance|naissance.*date/), lieuNaissance: val(/lieu.*naissance/) };
}

export function CreerCompteCandidat({ candidature, onCreer, unites = [], onFermer }) {
  const info = infosDuCandidat(candidature);
  const [f, setF] = useState({ prenom: info.prenom, nom: info.nom, username: sansAccentsId(`${info.prenom}.${info.nom}`), password: mdpAleatoire(), grade: GRADES[0], unite: unites[0] || (UNITES && UNITES[0]) || "", pseudoRoblox: info.pseudoRoblox, robloxUsername: info.robloxUsername, robloxId: info.robloxId, pseudoDiscord: info.pseudoDiscord, dateNaissance: info.dateNaissance, lieuNaissance: info.lieuNaissance, discordId: candidature.discordId || "" });
  const [etat, setEtat] = useState({ busy: false, erreur: "", fait: false });
  const [copie, setCopie] = useState(false);
  const liste = unites.length ? unites : UNITES || [];
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  async function creer(e) {
    e.preventDefault();
    if (!f.prenom.trim() || !f.nom.trim()) { setEtat({ busy: false, erreur: "Indique le prénom et le nom.", fait: false }); return; }
    if (f.username.trim().length < 3) { setEtat({ busy: false, erreur: "Identifiant trop court (3 caractères minimum).", fait: false }); return; }
    setEtat({ busy: true, erreur: "", fait: false });
    const r = await onCreer(candidature, { ...f, qualiteJudiciaire: "APJA", fonction: "" });
    setEtat(r && r.ok ? { busy: false, erreur: "", fait: true } : { busy: false, erreur: (r && r.error) || "Création impossible.", fait: false });
  }
  const message = `Bienvenue dans la Gendarmerie ! Ton compte est prêt.\nIdentifiant : ${f.username.trim()}\nMot de passe : ${f.password}\nConnecte-toi sur le site (ou avec Discord) puis suis ta formation. Pense à changer ton mot de passe dans « Mon compte ».`;
  const champ = { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, background: "#fff" };
  const lab = { fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 3, display: "block" };
  if (etat.fait) {
    return (
      <div style={{ marginTop: 14, background: "#E3F2E8", border: "1px solid #2E7D4F", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 800, color: "#1F6B42", marginBottom: 6 }}>✅ Compte créé pour {f.prenom} {f.nom}</div>
        <div style={{ fontSize: 12.5, color: "#3A4D6B", marginBottom: 8 }}>Copie ce message et envoie-le au candidat (Discord). Le mot de passe ne sera plus affiché.</div>
        <pre style={{ whiteSpace: "pre-wrap", background: "#fff", border: "1px solid #C3D0E2", borderRadius: 8, padding: 10, fontSize: 13, margin: "0 0 10px", fontFamily: "inherit" }}>{message}</pre>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={smallBtn} onClick={() => { try { navigator.clipboard.writeText(message).then(() => setCopie(true)); } catch (e) { /* rien */ } }}>{copie ? "✔ Copié" : "📋 Copier le message"}</button>
          <button type="button" style={smallBtn} onClick={onFermer}>Fermer</button>
        </div>
      </div>
    );
  }
  return (
    <form onSubmit={creer} style={{ marginTop: 14, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 12, padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>👤 Créer le compte de ce candidat</div>
      <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 12 }}>Champs pré-remplis depuis la candidature. Le RIO est attribué automatiquement ; la recrue démarre avec la formation à valider.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <div><label style={lab}>Prénom</label><input style={champ} value={f.prenom} onChange={(e) => set("prenom")(e.target.value)} /></div>
        <div><label style={lab}>Nom</label><input style={champ} value={f.nom} onChange={(e) => set("nom")(e.target.value)} /></div>
        <div><label style={lab}>Identifiant</label><input style={champ} value={f.username} onChange={(e) => set("username")(e.target.value)} autoCapitalize="none" /></div>
        <div><label style={lab}>Mot de passe (généré)</label><input style={{ ...champ, fontFamily: "'Courier New', monospace" }} value={f.password} onChange={(e) => set("password")(e.target.value)} /></div>
        <div><label style={lab}>Grade</label><select style={champ} value={f.grade} onChange={(e) => set("grade")(e.target.value)}>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
        <div><label style={lab}>Unité</label><select style={champ} value={f.unite} onChange={(e) => set("unite")(e.target.value)}>{liste.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
      </div>
      {(f.pseudoRoblox || f.pseudoDiscord) && <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 10 }}>Repris de la candidature : {f.pseudoRoblox ? `Roblox ${f.pseudoRoblox} (@${f.robloxUsername})` : ""}{f.pseudoRoblox && f.pseudoDiscord ? " · " : ""}{f.pseudoDiscord ? `Discord ${f.pseudoDiscord}` : ""}</div>}
      {etat.erreur && <div style={{ color: "#C0172D", fontSize: 13, fontWeight: 600, marginTop: 10 }}>{etat.erreur}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="submit" disabled={etat.busy} style={{ ...smallBtn, background: "#123A7A", color: "#fff", borderColor: "#123A7A" }}>{etat.busy ? "Création…" : "Créer le compte"}</button>
        <button type="button" style={smallBtn} onClick={onFermer}>Annuler</button>
      </div>
    </form>
  );
}

/* ---------- Fiche d'entretien de recrutement (interne : jamais visible du candidat) ---------- */

const CRITERES_ENTRETIEN = ["Motivation", "Maturité en jeu de rôle", "Connaissance des règles", "Expression et politesse", "Disponibilité"];
const AVIS_ENTRETIEN = [["Favorable", "#2E7D4F"], ["Réservé", "#B25E00"], ["Défavorable", "#C0172D"]];

export function FicheEntretien({ c, onSave, signaler }) {
  const e0 = c.entretien || {};
  const [f, setF] = useState({ date: e0.date || "", criteres: e0.criteres || {}, avis: e0.avis || "", commentaire: e0.commentaire || "" });
  const [busy, setBusy] = useState(false);
  const moyenne = (() => { const v = CRITERES_ENTRETIEN.map((k) => Number(f.criteres[k])).filter((x) => x > 0); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; })();
  async function enregistrer() {
    setBusy(true);
    const ok = await onSave(c.id, { date: f.date, criteres: f.criteres, avis: f.avis, commentaire: String(f.commentaire || "").slice(0, 3000) });
    setBusy(false);
    signaler(ok ? "✓ Fiche d'entretien enregistrée." : "Échec de l'enregistrement de la fiche d'entretien.");
  }
  const zone = { width: "100%", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "#fff" };
  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px dashed #C3D0E2" }}>
      <div style={{ fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: "#123A7A", fontWeight: 800, marginBottom: 8 }}>🎤 Fiche d'entretien (jamais visible du candidat)</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <label style={{ fontSize: 12.5, color: "#3A4D6B" }}>Date de l'entretien <input type="date" value={f.date} onChange={(ev) => setF({ ...f, date: ev.target.value })} style={{ ...zone, width: "auto", marginLeft: 6 }} /></label>
        {moyenne && <span style={{ fontSize: 13, fontWeight: 800, color: "#123A7A" }}>Moyenne : {moyenne} / 5</span>}
      </div>
      <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        {CRITERES_ENTRETIEN.map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#14213A", minWidth: 190 }}>{k}</span>
            <span style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const actif = Number(f.criteres[k]) === n;
                return <button key={n} type="button" onClick={() => setF({ ...f, criteres: { ...f.criteres, [k]: actif ? 0 : n } })} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${actif ? "#123A7A" : "#C3D0E2"}`, background: actif ? "#123A7A" : "#fff", color: actif ? "#fff" : "#14213A", fontWeight: 700, cursor: "pointer" }}>{n}</button>;
              })}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#14213A" }}>Avis :</span>
        {AVIS_ENTRETIEN.map(([a, col]) => <button key={a} type="button" onClick={() => setF({ ...f, avis: f.avis === a ? "" : a })} style={{ ...smallBtn, background: f.avis === a ? col : "transparent", color: f.avis === a ? "#fff" : col, borderColor: col }}>{a}</button>)}
      </div>
      <textarea value={f.commentaire} onChange={(ev) => setF({ ...f, commentaire: ev.target.value })} rows={3} placeholder="Points forts, réserves, questions posées…" style={zone} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
        <button type="button" disabled={busy} onClick={enregistrer} style={smallBtn}>{busy ? "…" : "Enregistrer la fiche d'entretien"}</button>
        {e0.parNom && <span style={{ fontSize: 11.5, color: "#5A6B84" }}>Dernière mise à jour : {e0.parNom}{e0.le ? `, le ${dateLongue(e0.le)}` : ""}</span>}
      </div>
    </div>
  );
}
