// pages/justice.jsx — Palais de justice : demandes des OPJ (comparution immédiate, procès, mandats, rapports) et mandats (fiches officielles).
import { estOPJ } from "../lib/droits.js";
import React, { useCallback, useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { CachetJustice } from "../composants/CachetJustice.jsx";
import { buttonPrimary, h2Style, labelStyle, selectStyle } from "../composants/ui.jsx";
import { resoudreRoblox } from "../lib/dossierPersonne.js";
import { estPalaisJustice, refAleatoire } from "../lib/utils.js";

export const TYPES_DEMANDE = ["Comparution immédiate", "Procès", "Mandat de perquisition", "Mandat d'arrêt", "Mandat d'amener", "Autre mandat", "Rapport"];
export const estMandat = (t) => String(t || "").startsWith("Mandat") || t === "Autre mandat";
const VALIDITE_DEFAUT = { "Mandat de perquisition": 7, "Mandat d'arrêt": 30, "Mandat d'amener": 15, "Autre mandat": 7 };
const SANS_COMPTE = ["Mandat de perquisition", "Rapport"]; // pour ces types, le compte Roblox n'est pas obligatoire
const LIBELLE_CIBLE = { "Mandat de perquisition": "Lieu à perquisitionner (adresse)", "Comparution immédiate": "Personne déférée (pseudo Roblox / identité)", "Procès": "Personne poursuivie (pseudo Roblox / identité)", "Mandat d'arrêt": "Personne visée (pseudo Roblox / identité)", "Mandat d'amener": "Personne visée (pseudo Roblox / identité)", "Autre mandat": "Personne ou lieu visé" };

const CARTE = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 18 };
const INP = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, marginBottom: 14, fontFamily: "inherit" };
const COULEUR = { "En attente": "#C77700", "Acceptée": "#1F6B42", "Refusée": "#C0172D", "Lu": "#123A7A" };
const Pastille = ({ statut }) => <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: COULEUR[statut] || "#5A6B84", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>{statut}</span>;
const dateFR = (iso) => { try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
const jourLong = (iso) => { try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return ""; } };
const jourCle = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const plusJours = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return jourCle(d); };
const nomDe = (p) => `${p.grade || ""} ${p.prenom || ""} ${p.nom || ""}`.trim();
// Signature d'un magistrat : son prénom et son nom (sans grade de gendarme)
const nomSignature = (p) => (estPalaisJustice(p) ? `${p.prenom || ""} ${p.nom || ""}`.trim() : nomDe(p));
const btn = (fond) => ({ background: fond, color: "#fff", border: 0, borderRadius: 6, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" });
const puce = (actif) => ({ border: "1px solid #C3D0E2", background: actif ? "#123A7A" : "#fff", color: actif ? "#fff" : "#123A7A", borderRadius: 20, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" });
const SERIF = "'Georgia', 'Times New Roman', serif";

/* ---------- Fiche de mandat (document officiel) ---------- */

export function statutMandat(m) {
  if (m.statut === "Actif" && m.valableJusqu && m.valableJusqu < jourCle(new Date())) return "Expiré";
  return m.statut;
}
const STAMP = { "Exécuté": ["#123A7A", "EXÉCUTÉ"], "Révoqué": ["#C0172D", "RÉVOQUÉ"], "Expiré": ["#5A6B84", "EXPIRÉ"] };
const TITRES = { "Mandat de perquisition": "MANDAT DE PERQUISITION", "Mandat d'arrêt": "MANDAT D'ARRÊT", "Mandat d'amener": "MANDAT D'AMENER", "Autre mandat": "MANDAT" };
const FORMULES = {
  "Mandat de perquisition": "Autorisons les officiers de police judiciaire à procéder, en tout lieu désigné ci-dessous, à une perquisition en vue de la recherche et de la saisie de tous éléments utiles à la manifestation de la vérité.",
  "Mandat d'arrêt": "Ordonnons aux officiers de police judiciaire de rechercher la personne désignée ci-dessous, de l'appréhender et de la conduire devant nous pour être placée sous main de justice.",
  "Mandat d'amener": "Ordonnons aux officiers de police judiciaire de conduire sans délai devant nous la personne désignée ci-dessous, afin qu'elle soit entendue.",
  "Autre mandat": "Ordonnons aux officiers de police judiciaire d'exécuter la mission décrite ci-dessous.",
};
const Ligne = ({ titre, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: "#4A5568", fontWeight: 700, fontFamily: "'Inter', sans-serif", marginBottom: 2 }}>{titre}</div>
    <div style={{ fontSize: 14.5, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{children}</div>
  </div>
);
export function FicheMandat({ m, actions }) {
  const st = statutMandat(m);
  const tampon = STAMP[st];
  const avatars = useAvatars([m.cibleRobloxId]);
  const liste = Array.isArray(m.infractionsListe) ? m.infractionsListe : [];
  return (
    <div style={{ position: "relative", background: "#fff", border: "1px solid #C9CFD9", borderRadius: 4, padding: 8, margin: "0 0 26px", boxShadow: "0 12px 30px -16px rgba(15,25,45,0.45)", fontFamily: SERIF, color: "#111827", overflow: "hidden" }}>
      <div style={{ border: "1.5px solid #123A7A", padding: "24px 30px 22px", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", opacity: 0.07 }}><CachetJustice taille={340} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between", flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ minWidth: 170 }}>
            <div style={{ display: "inline-block", height: 5, width: 78, background: "linear-gradient(90deg,#123A7A 33%,#fff 33% 66%,#C0172D 66%)", outline: "1px solid #C9CFD9", marginBottom: 6 }} />
            <div style={{ fontSize: 12, letterSpacing: 3, fontWeight: 700 }}>RÉPUBLIQUE FRANÇAISE</div>
            <div style={{ fontSize: 10.5, fontStyle: "italic", color: "#4A5568" }}>Liberté · Égalité · Fraternité</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11.5, color: "#374151", lineHeight: 1.45 }}>
            <b style={{ fontSize: 12.5 }}>TRIBUNAL JUDICIAIRE DE NÎMES</b><br />Palais de justice<br />Cabinet du magistrat
          </div>
        </div>
        <div style={{ borderTop: "3px double #111827", borderBottom: "3px double #111827", padding: "12px 0", textAlign: "center", margin: "0 0 18px" }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3 }}>{TITRES[m.type] || "MANDAT"}</div>
          <div style={{ fontSize: 12.5, marginTop: 4, fontFamily: "'Courier New', monospace", letterSpacing: 1 }}>N° {m.numero || m.id}</div>
        </div>
        <div style={{ fontSize: 14, marginBottom: 16, lineHeight: 1.6, textAlign: "justify" }}>
          Nous, <b>{m.delivrePar}</b>, magistrat au Tribunal judiciaire de Nîmes, saisi par {m.demandeur || "un officier de police judiciaire"} ; vu les éléments de la procédure ; {FORMULES[m.type] || FORMULES["Autre mandat"]}
        </div>
        {m.cibleRobloxId ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: "#4A5568", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{m.type === "Mandat de perquisition" ? "Occupant / propriétaire" : "Personne visée"}</div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6, border: "1px solid #D1D5DB", borderRadius: 6, padding: "8px 12px", background: "#FAFAFB" }}>
              <Avatar src={avatars[m.cibleRobloxId]} taille={56} />
              <div style={{ fontSize: 15, lineHeight: 1.4 }}><b>{m.cibleDisplayName}</b> <span style={{ color: "#4A5568" }}>(@{m.cibleUsername})</span><div style={{ fontSize: 11.5, fontFamily: "'Courier New', monospace", color: "#4A5568" }}>Compte Roblox · ID {m.cibleRobloxId}</div></div>
            </div>
          </div>
        ) : null}
        {(m.lieu || !m.cibleRobloxId) && <Ligne titre={m.type === "Mandat de perquisition" ? "Lieu visé" : "Personne ou lieu visé"}>{m.lieu || m.cible || "—"}</Ligne>}
        {m.objet && <Ligne titre="Objet">{m.objet}</Ligne>}
        {(liste.length > 0 || m.infractions) && (
          <Ligne titre="Infractions reprochées">
            {liste.length > 0 ? liste.map((x, k) => <div key={k}>• {x.nom} <span style={{ fontSize: 12, color: "#4A5568" }}>({x.type})</span></div>) : m.infractions}
          </Ligne>
        )}
        <Ligne titre="Exposé des faits">{m.motif}</Ligne>
        <Ligne titre="Exécutoire">{`Du ${jourLong(m.delivreLe)}${m.valableJusqu ? ` au ${jourLong(`${m.valableJusqu}T12:00:00`)} inclus` : " — sans limitation de durée"}.`}</Ligne>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CachetJustice taille={96} style={{ mixBlendMode: "multiply" }} />
            <div style={{ fontSize: 13 }}>Fait à Nîmes,<br />le {jourLong(m.delivreLe)}.</div>
          </div>
          <div style={{ textAlign: "center", minWidth: 200 }}>
            <div style={{ fontSize: 11, color: "#4A5568", marginBottom: 2 }}>Le magistrat</div>
            <div style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: 28, color: "#123A7A", transform: "rotate(-3deg)", lineHeight: 1.1 }}>{m.delivrePar}</div>
            <div style={{ borderTop: "1px solid #111827", fontSize: 11, paddingTop: 3, marginTop: 4 }}>Signé électroniquement</div>
          </div>
        </div>
        {m.executePar && <div style={{ marginTop: 16, fontSize: 12.5, borderTop: "1px dashed #9CA3AF", paddingTop: 8 }}>Exécuté par <b>{m.executePar}</b> le {dateFR(m.executeLe)}.</div>}
        {tampon && (
          <div style={{ position: "absolute", top: "40%", right: "6%", transform: "rotate(-14deg)", border: `4px double ${tampon[0]}`, color: tampon[0], borderRadius: 8, padding: "6px 16px", fontSize: 28, fontWeight: 800, letterSpacing: 4, opacity: 0.75, fontFamily: "'Inter', sans-serif", pointerEvents: "none", background: "rgba(255,255,255,0.6)" }}>{tampon[1]}</div>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, padding: "12px 14px 6px", flexWrap: "wrap", fontFamily: "'Inter', sans-serif" }}>{actions}</div>}
    </div>
  );
}

/* ---------- En-tête et tuiles du pôle judiciaire ---------- */

export function EnteteJustice({ titre, sousTitre, tuiles = [] }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ background: "linear-gradient(135deg,#0E2A5C,#123A7A 60%,#2B4F8F)", color: "#fff", borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 10px 26px -14px rgba(7,20,46,0.6)", borderBottom: "4px solid #C9A227" }}>
        <div style={{ background: "#fff", borderRadius: "50%", padding: 3, flexShrink: 0 }}><CachetJustice taille={54} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 22, fontWeight: 700 }}>{titre}</div>
          {sousTitre && <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 2 }}>{sousTitre}</div>}
        </div>
      </div>
      {tuiles.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${tuiles.length}, 1fr)`, gap: 10, marginTop: 12 }}>
          {tuiles.map(([n, label, couleur]) => (
            <div key={label} style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `3px solid ${couleur}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: couleur, lineHeight: 1.1 }}>{n}</div>
              <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const ICONE_TYPE = { "Comparution immédiate": "⏱️", "Procès": "🏛️", "Mandat de perquisition": "🔍", "Mandat d'arrêt": "🚔", "Mandat d'amener": "🤝", "Autre mandat": "📜", Rapport: "📝" };
const BORD_STATUT = { "En attente": "#C77700", "Acceptée": "#1F6B42", "Refusée": "#C0172D", "Lu": "#123A7A" };

/* ---------- Choix des infractions dans le code pénal ---------- */

const COULEUR_TYPE = { Contravention: ["#2E7D4F", "#E3F2E8"], "Délit": ["#C77700", "#FFF1DC"], Crime: ["#C0172D", "#FBE3E7"] };
const sansAcc = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function ChoixInfractions({ codePenal, choisies, onChange }) {
  const [q, setQ] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const articles = Array.isArray(codePenal) ? codePenal : [];
  const noms = new Set(choisies.map((c) => c.nom));
  const trouves = articles.filter((a) => a && a.nom && !noms.has(a.nom) && (!q.trim() || sansAcc(`${a.nom} ${a.type}`).includes(sansAcc(q.trim())))).slice(0, 30);
  const ajouter = (a) => { onChange([...choisies, { nom: String(a.nom).slice(0, 120), type: a.type || "" }]); setQ(""); };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: choisies.length ? 8 : 0 }}>
        {choisies.map((c) => {
          const [fg, bg] = COULEUR_TYPE[c.type] || ["#123A7A", "#E6EDF7"];
          return (
            <span key={c.nom} style={{ background: bg, color: fg, border: `1px solid ${fg}`, borderRadius: 20, padding: "3px 6px 3px 11px", fontSize: 12.5, fontWeight: 700, display: "inline-flex", gap: 6, alignItems: "center" }}>
              {c.nom}{c.type ? ` · ${c.type}` : ""}
              <button type="button" onClick={() => onChange(choisies.filter((x) => x.nom !== c.nom))} aria-label="Retirer" style={{ border: 0, background: "transparent", color: fg, cursor: "pointer", fontWeight: 800, fontSize: 14, lineHeight: 1 }}>×</button>
            </span>
          );
        })}
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setOuvert(true); }} onFocus={() => setOuvert(true)} placeholder={articles.length ? "🔎 Rechercher une infraction dans le code pénal…" : "Chargement du code pénal…"} style={{ ...INP, marginBottom: 0 }} />
      {ouvert && trouves.length > 0 && (
        <div style={{ border: "1px solid #C3D0E2", borderRadius: 8, marginTop: 4, maxHeight: 210, overflowY: "auto", background: "#fff" }}>
          {trouves.map((a) => {
            const [fg] = COULEUR_TYPE[a.type] || ["#123A7A"];
            return (
              <button key={a.id || a.nom} type="button" onClick={() => ajouter(a)} style={{ display: "flex", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #EEF2F7", background: "#fff", padding: "8px 12px", cursor: "pointer", fontSize: 13.5 }}>
                <span>{a.nom}</span><b style={{ color: fg, fontSize: 12 }}>{a.type}</b>
              </button>
            );
          })}
        </div>
      )}
      {ouvert && <button type="button" onClick={() => setOuvert(false)} style={{ border: 0, background: "transparent", color: "#5A6B84", fontSize: 12, cursor: "pointer", marginTop: 4 }}>Fermer la liste</button>}
    </div>
  );
}

/* ---------- Demandes et rapports ---------- */

export function DemandesJusticePage({ current, codePenal = [] }) {
  const juge = estPalaisJustice(current) || !!current.isAdmin;
  const opj = estOPJ(current) || !!current.isAdmin;
  const [liste, setListe] = useState(null);
  const [onglet, setOnglet] = useState("attente");
  const vide = { type: TYPES_DEMANDE[0], cible: "", lieu: "", refPV: "", objet: "", infractions: "", infractionsListe: [], motif: "", urgence: "Normale" };
  const [form, setForm] = useState(vide);
  const [etat, setEtat] = useState({ busy: false, msg: "", ok: false });
  const [champs, setChamps] = useState({}); // par demande : commentaire, validité, audience
  const [formOuvert, setFormOuvert] = useState(false);
  const [filtreType, setFiltreType] = useState("");
  const [arobase, setArobase] = useState("");
  const [compte, setCompte] = useState(null); // compte Roblox vérifié { id, username, displayName, imageUrl }
  const [verif, setVerif] = useState({ busy: false, msg: "" });

  const charger = useCallback(async () => {
    try {
      const col = collection(db, "demandes_justice");
      // Un OPJ ne peut lire que ses propres demandes (règle Firestore) : la requête doit le préciser
      const q = juge ? query(col, orderBy("createdAt", "desc"), limit(100)) : query(col, where("auteurUid", "==", current.id), limit(100));
      const s = await getDocs(q);
      setListe(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
    } catch (e) { console.error(e); setListe([]); }
  }, [juge, current.id]);
  useEffect(() => { charger(); }, [charger]);

  const setC = (id, k, v) => setChamps((c) => ({ ...c, [id]: { ...(c[id] || {}), [k]: v } }));

  async function verifierCompte() {
    const a = arobase.trim().replace(/^@/, "");
    if (!a) { setVerif({ busy: false, msg: "Saisis le @ Roblox exact." }); return; }
    setVerif({ busy: true, msg: "Vérification…" });
    const c = await resoudreRoblox(a);
    if (!c) { setCompte(null); setVerif({ busy: false, msg: "Compte Roblox introuvable. Vérifie le @ exact." }); return; }
    setCompte(c); setVerif({ busy: false, msg: "" });
  }

  async function envoyer(e) {
    e.preventDefault();
    const avecCompte = form.type !== "Rapport";
    const cibleTexte = form.type === "Mandat de perquisition" ? form.lieu.trim().slice(0, 200) : compte ? `${compte.displayName} (@${compte.username})` : "";
    const f = { type: form.type, cible: cibleTexte, lieu: form.type === "Mandat de perquisition" ? form.lieu.trim().slice(0, 200) : "",
      ...(avecCompte && compte ? { cibleRobloxId: String(compte.id), cibleUsername: compte.username, cibleDisplayName: compte.displayName } : {}), refPV: form.refPV.trim().slice(0, 60), objet: form.objet.trim().slice(0, 200), infractions: [...form.infractionsListe.map((x) => x.nom), form.infractions.trim()].filter(Boolean).join(" ; ").slice(0, 500), infractionsListe: form.infractionsListe.slice(0, 20), motif: form.motif.trim().slice(0, 4000), urgence: form.urgence };
    if (f.type !== "Rapport" && !f.infractionsListe.length && !form.infractions.trim()) { setEtat({ busy: false, ok: false, msg: "Choisis au moins une infraction dans le code pénal." }); return; }
    if (!f.objet || !f.motif) { setEtat({ busy: false, ok: false, msg: "Renseigne l'objet et l'exposé des faits." }); return; }
    if (f.type === "Mandat de perquisition" && !f.lieu) { setEtat({ busy: false, ok: false, msg: "Indique le lieu à perquisitionner." }); return; }
    if (!SANS_COMPTE.includes(f.type) && !compte) { setEtat({ busy: false, ok: false, msg: "Lie le compte Roblox de la personne concernée (@ exact, puis « Vérifier »)." }); return; }
    setEtat({ busy: true, ok: false, msg: "Envoi…" });
    try {
      await addDoc(collection(db, "demandes_justice"), { ...f, statut: "En attente", auteurUid: current.id, auteurMatricule: current.matricule || "", auteurNom: nomDe(current), createdAt: new Date().toISOString() });
      setForm({ ...vide, type: form.type }); setCompte(null); setArobase("");
      setEtat({ busy: false, ok: true, msg: "Envoyé au Palais de justice." });
      await charger();
    } catch (err) { console.error(err); setEtat({ busy: false, ok: false, msg: "Échec de l'envoi (réservé aux OPJ)." }); }
  }

  async function decider(d, statut) {
    const c = champs[d.id] || {};
    const commentaire = String(c.commentaire || "").trim().slice(0, 2000);
    if (statut === "Refusée" && !commentaire) { alert("Indique le motif du refus dans le commentaire."); return; }
    try {
      const maintenant = new Date().toISOString();
      const patch = { statut, commentaire, decidePar: nomSignature(current), decideLe: maintenant };
      if (statut === "Acceptée" && estMandat(d.type)) {
        const duree = VALIDITE_DEFAUT[d.type] || 7;
        const r = await addDoc(collection(db, "mandats"), {
          numero: refAleatoire("MAN"), type: d.type, cible: d.cible || "", lieu: d.lieu || "", cibleRobloxId: d.cibleRobloxId || "", cibleUsername: d.cibleUsername || "", cibleDisplayName: d.cibleDisplayName || "", motif: d.motif || "", objet: d.objet || "", infractions: d.infractions || "", infractionsListe: d.infractionsListe || [], demandeId: d.id, demandeur: d.auteurNom || "",
          delivrePar: nomSignature(current), delivreParUid: current.id, delivreLe: maintenant, valableJusqu: c.validite || plusJours(maintenant, duree), statut: "Actif",
        });
        patch.mandatId = r.id;
      }
      if (statut === "Acceptée" && (d.type === "Procès" || d.type === "Comparution immédiate") && c.audience) patch.audience = c.audience;
      await updateDoc(doc(db, "demandes_justice", d.id), patch);
      await charger();
    } catch (e) { console.error(e); alert("Impossible d'enregistrer la décision."); }
  }

  const attente = (liste || []).filter((d) => d.statut === "En attente");
  const traitees = (liste || []).filter((d) => d.statut !== "En attente");
  const affichees = (onglet === "attente" ? attente : traitees).filter((d) => !filtreType || d.type === filtreType);

  return (
    <div style={{ maxWidth: 820 }}>
      <EnteteJustice titre={juge ? "Demandes & rapports" : "Demandes au Palais de justice"} sousTitre={juge ? "Comparutions, procès, mandats et rapports transmis par les OPJ" : "Comparution immédiate, procès, mandats et rapports"}
        tuiles={[[attente.length, juge ? "À traiter" : "En attente", "#C77700"], [(liste || []).filter((d) => d.statut === "Acceptée").length, "Acceptées", "#1F6B42"], [(liste || []).filter((d) => d.statut === "Refusée").length, "Refusées", "#C0172D"]]} />

      {opj && !formOuvert && <button type="button" onClick={() => setFormOuvert(true)} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "10px 22px", marginTop: 0, marginBottom: 18 }}>➕ Nouvelle demande ou rapport</button>}
      {opj && formOuvert && (
        <form onSubmit={envoyer} style={CARTE}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>Nouvelle demande ou nouveau rapport</div>
            <button type="button" onClick={() => setFormOuvert(false)} style={{ border: 0, background: "transparent", color: "#5A6B84", cursor: "pointer", fontSize: 13 }}>Réduire ▲</button>
          </div>
          <label style={labelStyle}>Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ ...selectStyle, marginBottom: 14 }}>
            {TYPES_DEMANDE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {form.type !== "Rapport" && (<>
            {form.type === "Mandat de perquisition" && (<>
              <label style={labelStyle}>{LIBELLE_CIBLE[form.type]}</label>
              <input value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} style={INP} />
            </>)}
            <label style={labelStyle}>{form.type === "Mandat de perquisition" ? "Occupant / propriétaire — compte Roblox (facultatif)" : "Compte Roblox de la personne concernée"}</label>
            {compte ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center", background: "#F2F6FC", border: "1px solid #C3D0E2", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                <Avatar src={compte.imageUrl} taille={44} />
                <div style={{ flex: 1, fontSize: 13.5 }}><b>{compte.displayName}</b> (@{compte.username})<div style={{ fontSize: 11.5, color: "#1F6B42", fontWeight: 700 }}>✓ Compte Roblox vérifié</div></div>
                <button type="button" onClick={() => { setCompte(null); setArobase(""); }} style={btn("#5A6B84")}>Changer</button>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={arobase} onChange={(e) => setArobase(e.target.value)} placeholder="@ Roblox exact (nom d'utilisateur)" style={{ ...INP, marginBottom: 0 }} />
                  <button type="button" disabled={verif.busy} onClick={verifierCompte} style={{ ...btn("#123A7A"), whiteSpace: "nowrap" }}>Vérifier</button>
                </div>
                {verif.msg && <div style={{ fontSize: 12.5, marginTop: 6, fontWeight: 600, color: verif.busy ? "#5A6B84" : "#C0172D" }}>{verif.msg}</div>}
              </div>
            )}
            <label style={labelStyle}>Infractions reprochées / fondement légal</label>
            <ChoixInfractions codePenal={codePenal} choisies={form.infractionsListe} onChange={(l) => setForm({ ...form, infractionsListe: l })} />
            <input value={form.infractions} onChange={(e) => setForm({ ...form, infractions: e.target.value })} placeholder="Précision libre (facultatif)" style={INP} />
            <label style={labelStyle}>Urgence</label>
            <select value={form.urgence} onChange={(e) => setForm({ ...form, urgence: e.target.value })} style={{ ...selectStyle, marginBottom: 14 }}>
              <option>Normale</option><option>Urgente</option><option>Flagrance</option>
            </select>
          </>)}
          <label style={labelStyle}>Objet</label>
          <input value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} placeholder="Résumé en une ligne" style={INP} />
          <label style={labelStyle}>Numéro de PV (facultatif)</label>
          <input value={form.refPV} onChange={(e) => setForm({ ...form, refPV: e.target.value })} placeholder="PV-2026-XXXXX" style={INP} />
          <label style={labelStyle}>{form.type === "Rapport" ? "Rapport" : "Exposé des faits et justification (indices, éléments de l'enquête)"}</label>
          <textarea value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} rows={6} style={{ ...INP, resize: "vertical" }} />
          <button type="submit" disabled={etat.busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 22px", marginTop: 0 }}>Envoyer</button>
          {etat.msg && <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 600, color: etat.ok ? "#1F6B42" : etat.busy ? "#5A6B84" : "#C0172D" }}>{etat.msg}</span>}
        </form>
      )}

      <div style={CARTE}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setOnglet("attente")} style={puce(onglet === "attente")}>{juge ? "À traiter" : "En attente"} ({attente.length})</button>
          <button onClick={() => setOnglet("traitees")} style={puce(onglet === "traitees")}>Traitées ({traitees.length})</button>
          <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} style={{ ...selectStyle, width: "auto", marginLeft: "auto", padding: "5px 8px", fontSize: 12.5 }}>
            <option value="">Tous les types</option>
            {TYPES_DEMANDE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {liste === null && <div style={{ fontSize: 13, color: "#5A6B84" }}>Chargement…</div>}
        {liste !== null && affichees.length === 0 && <div style={{ fontSize: 13, color: "#5A6B84" }}>Rien pour le moment.</div>}
        {affichees.map((d) => {
          const c = champs[d.id] || {};
          return (
            <div key={d.id} style={{ borderLeft: `4px solid ${BORD_STATUT[d.statut] || "#C3D0E2"}`, background: "#FAFCFF", borderRadius: 8, padding: "12px 14px", marginBottom: 12, border: "1px solid #E3EAF4", borderLeftWidth: 4, borderLeftColor: BORD_STATUT[d.statut] || "#C3D0E2" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ fontSize: 14 }}>{ICONE_TYPE[d.type] || "📄"} {d.type}</b> <Pastille statut={d.statut} />
                {d.urgence && d.urgence !== "Normale" && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#C0172D" }}>⚠ {d.urgence}</span>}
                <span style={{ fontSize: 12, color: "#5A6B84" }}>{dateFR(d.createdAt)} · par {d.auteurNom}</span>
              </div>
              <div style={{ fontWeight: 600, margin: "6px 0 2px", fontSize: 13.5 }}>{d.objet}</div>
              {d.lieu && <div style={{ fontSize: 13 }}>Lieu : <b>{d.lieu}</b></div>}
              {d.cibleRobloxId && <div style={{ fontSize: 13 }}>Compte Roblox : <b>{d.cibleDisplayName}</b> (@{d.cibleUsername}) · ID {d.cibleRobloxId}</div>}
              {d.cible && !d.lieu && !d.cibleRobloxId && <div style={{ fontSize: 13 }}>Concerné : <b>{d.cible}</b></div>}
              {Array.isArray(d.infractionsListe) && d.infractionsListe.length > 0
                ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0" }}>{d.infractionsListe.map((x) => { const [fg, bg] = COULEUR_TYPE[x.type] || ["#123A7A", "#E6EDF7"]; return <span key={x.nom} style={{ background: bg, color: fg, border: `1px solid ${fg}`, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{x.nom}</span>; })}</div>
                : d.infractions && <div style={{ fontSize: 13 }}>Infractions : {d.infractions}</div>}
              {d.refPV && <div style={{ fontSize: 13 }}>PV : {d.refPV}</div>}
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "6px 0", color: "#243549" }}>{d.motif}</div>
              {d.statut !== "En attente" && (
                <div style={{ fontSize: 12.5, background: "#F2F6FC", borderRadius: 8, padding: "8px 10px", marginTop: 6 }}>
                  {d.decidePar ? `Traité par ${d.decidePar} le ${dateFR(d.decideLe)}` : ""}
                  {d.audience && <div style={{ marginTop: 4, fontWeight: 700 }}>⚖️ Audience : {dateFR(d.audience)}</div>}
                  {d.commentaire && <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>💬 {d.commentaire}</div>}
                  {d.mandatId && <div style={{ marginTop: 4, fontWeight: 600 }}>📜 Mandat délivré (voir la page « Mandats »)</div>}
                </div>
              )}
              {juge && d.statut === "En attente" && (
                <div style={{ marginTop: 8 }}>
                  <textarea value={c.commentaire || ""} onChange={(e) => setC(d.id, "commentaire", e.target.value)} rows={2} placeholder="Commentaire / motivation (obligatoire en cas de refus)" style={{ ...INP, marginBottom: 8, resize: "vertical" }} />
                  {estMandat(d.type) && (
                    <div style={{ marginBottom: 8, fontSize: 12.5 }}>Valable jusqu'au (par défaut {VALIDITE_DEFAUT[d.type] || 7} jours) : <input type="date" value={c.validite || ""} onChange={(e) => setC(d.id, "validite", e.target.value)} style={{ padding: "5px 8px", border: "1px solid #C3D0E2", borderRadius: 6 }} /></div>
                  )}
                  {(d.type === "Procès" || d.type === "Comparution immédiate") && (
                    <div style={{ marginBottom: 8, fontSize: 12.5 }}>Date et heure de l'audience : <input type="datetime-local" value={c.audience || ""} onChange={(e) => setC(d.id, "audience", e.target.value)} style={{ padding: "5px 8px", border: "1px solid #C3D0E2", borderRadius: 6 }} /></div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    {d.type === "Rapport"
                      ? <button onClick={() => decider(d, "Lu")} style={btn("#123A7A")}>✓ Marquer comme lu</button>
                      : (<>
                          <button onClick={() => decider(d, "Acceptée")} style={btn("#1F6B42")}>✓ Accepter</button>
                          <button onClick={() => decider(d, "Refusée")} style={btn("#C0172D")}>✕ Refuser</button>
                        </>)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Mandats ---------- */

export function MandatsPage({ current }) {
  const juge = estPalaisJustice(current) || !!current.isAdmin;
  const opj = estOPJ(current) || !!current.isAdmin;
  const [liste, setListe] = useState(null);
  const [filtre, setFiltre] = useState("actifs");
  const [recherche, setRecherche] = useState("");

  const charger = useCallback(async () => {
    try {
      const s = await getDocs(query(collection(db, "mandats"), orderBy("delivreLe", "desc"), limit(150)));
      setListe(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); setListe([]); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function changer(m, patch) {
    try { await updateDoc(doc(db, "mandats", m.id), patch); await charger(); } catch (e) { console.error(e); alert("Action impossible."); }
  }

  const q = recherche.trim().toLowerCase();
  const affiches = (liste || []).filter((m) => (filtre === "tous" || statutMandat(m) === "Actif") && (!q || `${m.cible} ${m.cibleUsername || ""} ${m.cibleRobloxId || ""} ${m.type} ${m.objet} ${m.motif} ${m.numero}`.toLowerCase().includes(q)));

  return (
    <div style={{ maxWidth: 780 }}>
      <EnteteJustice titre="Mandats" sousTitre="Registre des mandats délivrés par le Palais de justice"
        tuiles={[[(liste || []).filter((m) => statutMandat(m) === "Actif").length, "Actifs", "#1F6B42"], [(liste || []).filter((m) => m.statut === "Exécuté").length, "Exécutés", "#123A7A"], [(liste || []).filter((m) => ["Révoqué", "Expiré"].includes(statutMandat(m))).length, "Révoqués / expirés", "#5A6B84"]]} />
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button onClick={() => setFiltre("actifs")} style={puce(filtre === "actifs")}>Mandats actifs</button>
        <button onClick={() => setFiltre("tous")} style={puce(filtre === "tous")}>Tous</button>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔎 Personne, @Roblox, lieu, numéro…" style={{ ...INP, marginBottom: 0, flex: 1, minWidth: 180 }} />
      </div>
      {liste === null && <div style={{ fontSize: 13, color: "#5A6B84" }}>Chargement…</div>}
      {liste !== null && affiches.length === 0 && <div style={{ fontSize: 13, color: "#5A6B84" }}>Aucun mandat.</div>}
      {affiches.map((m) => (
        <FicheMandat key={m.id} m={m} actions={m.statut === "Actif" && (
          <>
            {opj && <button onClick={() => changer(m, { statut: "Exécuté", executeLe: new Date().toISOString(), executePar: nomDe(current) })} style={btn("#123A7A")}>✓ Marquer comme exécuté</button>}
            {juge && <button onClick={() => window.confirm("Révoquer ce mandat ?") && changer(m, { statut: "Révoqué" })} style={btn("#C0172D")}>Révoquer</button>}
          </>
        )} />
      ))}
    </div>
  );
}

/* ---------- Mon profil (membre du Palais de justice) : nom, prénom et compte Roblox ---------- */

export function ProfilJusticePage({ current, onSave }) {
  const [prenom, setPrenom] = useState(current.prenom || "");
  const [nom, setNom] = useState(current.nom || "");
  const [arobase, setArobase] = useState("");
  const [compte, setCompte] = useState(null);
  const [etat, setEtat] = useState({ ok: false, msg: "" });
  const avatars = useAvatars([current.robloxId]);

  async function verifier() {
    const a = arobase.trim().replace(/^@/, "");
    if (!a) { setEtat({ ok: false, msg: "Saisis ton @ Roblox exact." }); return; }
    setEtat({ ok: false, msg: "Vérification…" });
    const c = await resoudreRoblox(a);
    if (!c) { setCompte(null); setEtat({ ok: false, msg: "Compte Roblox introuvable. Vérifie ton @ exact." }); return; }
    setCompte(c); setEtat({ ok: false, msg: "" });
  }
  async function enregistrer(e) {
    e.preventDefault();
    const p = prenom.trim().slice(0, 60), n = nom.trim().slice(0, 60);
    if (!p || !n) { setEtat({ ok: false, msg: "Le prénom et le nom sont obligatoires." }); return; }
    const patch = { prenom: p, nom: n };
    if (compte) Object.assign(patch, { pseudoRoblox: compte.displayName, robloxUsername: compte.username, robloxId: String(compte.id), robloxVerifie: false });
    const ok = await onSave(patch);
    if (ok) { setCompte(null); setArobase(""); }
    setEtat({ ok, msg: ok ? "Profil enregistré. Tes prochains mandats seront signés à ce nom." : "Échec de l'enregistrement." });
  }

  return (
    <div style={{ maxWidth: 620 }}>
      <h2 style={h2Style}>Mon profil</h2>
      <form onSubmit={enregistrer} style={CARTE}>
        <label style={labelStyle}>Prénom</label>
        <input value={prenom} onChange={(e) => setPrenom(e.target.value)} style={INP} />
        <label style={labelStyle}>Nom</label>
        <input value={nom} onChange={(e) => setNom(e.target.value)} style={INP} />
        <div style={{ fontSize: 12, color: "#5A6B84", margin: "-8px 0 16px" }}>Ton nom et ton prénom apparaissent sur la signature des mandats que tu délivres.</div>

        <label style={labelStyle}>Compte Roblox</label>
        {current.robloxId && !compte && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", background: "#F2F6FC", border: "1px solid #C3D0E2", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
            <Avatar src={avatars[current.robloxId]} taille={44} />
            <div style={{ fontSize: 13.5 }}><b>{current.pseudoRoblox}</b>{current.robloxUsername ? ` (@${current.robloxUsername})` : ""}<div style={{ fontSize: 11.5, color: "#5A6B84" }}>Compte lié</div></div>
          </div>
        )}
        {compte ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", background: "#E3F2E8", border: "1px solid #2E7D4F", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
            <Avatar src={compte.imageUrl} taille={44} />
            <div style={{ flex: 1, fontSize: 13.5 }}><b>{compte.displayName}</b> (@{compte.username})<div style={{ fontSize: 11.5, color: "#1F6B42", fontWeight: 700 }}>✓ Trouvé : clique sur Enregistrer pour le lier</div></div>
            <button type="button" onClick={() => { setCompte(null); setArobase(""); }} style={btn("#5A6B84")}>Annuler</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={arobase} onChange={(e) => setArobase(e.target.value)} placeholder={current.robloxId ? "Changer de compte : @ Roblox exact" : "@ Roblox exact (nom d'utilisateur)"} style={{ ...INP, marginBottom: 0 }} />
            <button type="button" onClick={verifier} style={{ ...btn("#123A7A"), whiteSpace: "nowrap" }}>Vérifier</button>
          </div>
        )}
        <button type="submit" className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 22px", marginTop: 0 }}>Enregistrer</button>
        {etat.msg && <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 600, color: etat.ok ? "#1F6B42" : "#C0172D" }}>{etat.msg}</span>}
      </form>
    </div>
  );
}
