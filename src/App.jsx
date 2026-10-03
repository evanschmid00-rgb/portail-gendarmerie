import React, { useState, useEffect, useCallback, useRef } from "react";
import { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithCustomToken, signOut } from "firebase/auth";
import { db, auth, FIREBASE_API_KEY } from "./firebase";
import cipcFond from "./cipc-fond.jpg";
import { ShieldAlert, FileSearch, UserPlus, Siren, Users, Car, BookOpen, Award, Radio, ClipboardList, BadgeCheck, ScrollText, Star, Clock, FileText, MessageSquare, TrendingUp, Scale, UserCog, Settings } from "lucide-react";

const FONT_BASE = "'Inter', 'Segoe UI', system-ui, sans-serif";
const FONT_TITRE = "'Barlow Semi Condensed', 'Inter', sans-serif";

function usernameToEmail(username) {
  const clean = (username || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return clean + "@ghgendarmerie.app";
}

// Crée un compte Firebase Authentication sans déconnecter la session en cours
// (appel REST direct, indépendant du SDK client).
async function createAuthUser(email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Erreur de création du compte.");
  return data.localId;
}

async function loadCollection(name) {
  try {
    const snap = await getDocs(collection(db, name));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(name, e);
    return [];
  }
}

// Envoie une notification Discord via la fonction serveur /api/notify (le lien du webhook reste secret côté Vercel)
function notifierDiscord(type, texte) {
  try {
    fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, texte }) }).catch(() => {});
  } catch (e) { /* une notification ratée ne doit jamais bloquer le site */ }
}

// Photos (tête du personnage) Roblox : une seule requête pour plusieurs comptes, avec mémoire
const AVATAR_CACHE = {};
function useAvatars(ids) {
  const [, forcer] = useState(0);
  const cle = Array.from(new Set(ids.filter(Boolean))).sort().join(",");
  useEffect(() => {
    const manquants = cle.split(",").filter((i) => i && !(i in AVATAR_CACHE));
    if (!manquants.length) return undefined;
    let off = false;
    (async () => {
      for (let i = 0; i < manquants.length; i += 50) {
        const lot = manquants.slice(i, i + 50);
        try {
          const r = await fetch(`/api/roblox-head?ids=${lot.join(",")}`);
          const j = await r.json();
          lot.forEach((id) => { AVATAR_CACHE[id] = (j.images && j.images[id]) || ""; });
        } catch (e) { lot.forEach((id) => { AVATAR_CACHE[id] = ""; }); }
      }
      if (!off) forcer((n) => n + 1);
    })();
    return () => { off = true; };
  }, [cle]);
  return AVATAR_CACHE;
}
function Avatar({ src, taille = 44 }) {
  return (
    <div style={{ width: taille, height: taille, borderRadius: 10, background: "linear-gradient(180deg, #3b3e45, #2a2d33)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#9aa0ab", fontSize: taille / 2.6 }}>?</span>}
    </div>
  );
}

// Ajoute une ligne automatique dans la main courante (prise de service, PV, casier…) ; ne bloque jamais l'action d'origine
async function journaliserMC(auteur, texte) {
  try {
    if (!auteur || !auteur.id) return;
    await addDoc(collection(db, "main_courante"), {
      createdAt: new Date().toISOString(), jour: cleJour(new Date()), type: "Activité", lieu: "", agents: "",
      description: String(texte).slice(0, 380), auto: true,
      auteurUid: auteur.id, auteurNom: `${auteur.prenom} ${auteur.nom}`, auteurGrade: auteur.grade, auteurRIO: auteur.cipcNumero || "",
    });
  } catch (e) { console.error("Main courante automatique :", e); }
}

// Met à jour le rôle Discord [TAG] d'un gendarme d'après son grade sur le site (via /api/sync-grade)
async function syncGradeDiscord(uid) {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const idToken = await user.getIdToken();
    const r = await fetch("/api/sync-grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, uid }) });
    return await r.json();
  } catch (e) { return null; }
}

/* ---------- Données de référence ---------- */

const GRADES = [
  "Gendarme Adjoint Volontaire 2ème Classe",
  "Gendarme Adjoint Volontaire 1ère Classe",
  "Brigadier",
  "Brigadier-chef",
  "Maréchal des Logis",
  "Gendarme Sous Contrat",
  "Gendarme de Carrière",
  "Maréchal des Logis-Chef",
  "Adjudant",
  "Adjudant-Chef",
  "Major",
  "Sous-Lieutenant",
  "Lieutenant",
  "Capitaine",
  "Commandant",
  "Lieutenant-Colonel",
  "Colonel",
  "Général de Brigade",
  "Général de Division",
  "Général de Corps d'Armée",
  "Général d'Armée",
];

const QUALIFICATIONS = [
  "Formateur",
  "Recruteur",
  "OPJ",
  "Négociateur",
  "Assistant Secrétaire GN",
];

const GRADES_TAGS = ["GA2", "GA1", "BRI", "BRC", "MDL", "GSC", "GNC", "MDC", "ADJ", "ADC", "MAJ", "SLT", "LTN", "CNE", "CDT", "LCL", "COL", "", "", "", ""];
const REGLAGES = { seuilOfficier: "Sous-Lieutenant", seuilSog: "Maréchal des Logis", seuilCandOfficier: "Major", seuilHaut: "Commandant" };
let OFFICIER_INDEX = 0, SOG_MIN_INDEX = 0, OFFICIER_CANDIDATURE_MIN_INDEX = 0, DISCIPLINE_MIN_INDEX = 0;
function recalculerSeuils() {
  const i = (n) => { const x = GRADES.indexOf(n); return x >= 0 ? x : GRADES.length; };
  OFFICIER_INDEX = i(REGLAGES.seuilOfficier);
  SOG_MIN_INDEX = i(REGLAGES.seuilSog);
  OFFICIER_CANDIDATURE_MIN_INDEX = i(REGLAGES.seuilCandOfficier);
  DISCIPLINE_MIN_INDEX = i(REGLAGES.seuilHaut);
}
recalculerSeuils();

const UNITE_CMD = "Corps de Commandement";
const UNITE_ENC = "Corps d'Encadrement";
const UNITE_ALIAS = { DGGN: UNITE_CMD, IGGN: UNITE_ENC }; // anciens noms
const normUnite = (u) => UNITE_ALIAS[u] || u;
const estCorps = (u) => normUnite(u) === UNITE_CMD || normUnite(u) === UNITE_ENC;
const estCommandement = (u) => normUnite(u) === UNITE_CMD;
const UNITES = [
  "Brigade territoriale",
  "CORG",
  "Section de recherche",
  "Formation & Recrutement",
  UNITE_CMD,
  UNITE_ENC,
  "OPJ",
];
const UNITES_PROTEGEES = [UNITE_CMD, UNITE_ENC];
const UNITE_ORDER = {};
function recalculerUnites() {
  Object.keys(UNITE_ORDER).forEach((k) => delete UNITE_ORDER[k]);
  UNITES.forEach((u, i) => { UNITE_ORDER[u] = i; });
}
recalculerUnites();

// Applique les réglages enregistrés (settings/general) : on modifie les tableaux en place pour que tout le site les voie
function appliquerReglages(d) {
  if (Array.isArray(d.grades) && d.grades.length) {
    GRADES.splice(0, GRADES.length, ...d.grades);
    GRADES_TAGS.splice(0, GRADES_TAGS.length, ...d.grades.map((_, i) => (Array.isArray(d.gradesTags) && d.gradesTags[i]) || ""));
  }
  if (Array.isArray(d.unites) && d.unites.length) {
    const u = Array.from(new Set(d.unites.map(normUnite)));
    UNITES_PROTEGEES.forEach((n) => { if (!u.includes(n)) u.push(n); });
    UNITES.splice(0, UNITES.length, ...u);
  }
  ["seuilOfficier", "seuilSog", "seuilCandOfficier", "seuilHaut"].forEach((k) => { if (typeof d[k] === "string" && d[k]) REGLAGES[k] = d[k]; });
  recalculerSeuils();
  recalculerUnites();
}

// Base initiale du code pénal — importable une fois depuis l'admin, puis modifiable/complétable sur le site.
const CODE_PENAL_BASE = [
  { type: "Contravention", classe: "Classe 1", nom: "Stationnement gênant", article: "art. R417-10 C. route", amende: 1000, tempsGav: "" },
  { type: "Contravention", classe: "Classe 1", nom: "Stationnement sur trottoir", article: "art. R417-11 C. route", amende: 1000, tempsGav: "" },
  { type: "Contravention", classe: "Classe 1", nom: "Klaxon abusif / bruit inutile", article: "art. R416-1 C. route", amende: 1000, tempsGav: "" },
  { type: "Contravention", classe: "Classe 1", nom: "Défaut de plaque d'immatriculation lisible", article: "art. R317-8 C. route", amende: 1000, tempsGav: "" },
  { type: "Contravention", classe: "Classe 2", nom: "Circulation sans éclairage la nuit", article: "art. R416-14 C. route", amende: 1200, tempsGav: "" },
  { type: "Contravention", classe: "Classe 2", nom: "Non-respect d'un cédez-le-passage", article: "art. R415-7 C. route", amende: 1200, tempsGav: "" },
  { type: "Contravention", classe: "Classe 3", nom: "Défaut de présentation du permis", article: "art. R221-3 C. route", amende: 1400, tempsGav: "" },
  { type: "Contravention", classe: "Classe 3", nom: "Non-port du casque moto/scooter", article: "art. R431-1 C. route", amende: 1400, tempsGav: "" },
  { type: "Contravention", classe: "Classe 3", nom: "Stationnement devant caserne, hôpital, bouche d'incendie", article: "art. R417-10 C. route", amende: 1400, tempsGav: "" },
  { type: "Contravention", classe: "Classe 3", nom: "Défaut de présentation de la carte grise", article: "art. R322-4 C. route", amende: 1400, tempsGav: "" },
  { type: "Contravention", classe: "Classe 4", nom: "Excès de vitesse, moins de 20 km/h", article: "art. R413-14 C. route", amende: 1600, tempsGav: "" },
  { type: "Contravention", classe: "Classe 4", nom: "Refus de priorité", article: "art. R415-5 C. route", amende: 1600, tempsGav: "" },
  { type: "Contravention", classe: "Classe 4", nom: "Circulation en sens interdit", article: "art. R412-28 C. route", amende: 1600, tempsGav: "" },
  { type: "Contravention", classe: "Classe 4", nom: "Dépassement dangereux", article: "art. R414-4 C. route", amende: 1600, tempsGav: "" },
  { type: "Contravention", classe: "Classe 5", nom: "Excès de vitesse, 20 à 30 km/h", article: "art. R413-14 C. route", amende: 1800, tempsGav: "" },
  { type: "Contravention", classe: "Classe 5", nom: "Défaut d'assurance", article: "art. L324-2 C. route", amende: 1800, tempsGav: "" },
  { type: "Contravention", classe: "Classe 5", nom: "Conduite sans permis, 1ère fois", article: "art. L221-2 C. route", amende: 1800, tempsGav: "" },
  { type: "Contravention", classe: "Classe 5", nom: "Franchissement d'un feu rouge", article: "art. R412-30 C. route", amende: 1800, tempsGav: "" },
  { type: "Contravention", classe: "Classe 5", nom: "Circulation à contresens sur voie rapide", article: "", amende: 1800, tempsGav: "" },

  { type: "Délit", classe: "", nom: "Usage de stupéfiants", article: "art. L3421-1 CSP", amende: 2000, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Outrage à agent", article: "art. 433-5", amende: 2000, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Rébellion", article: "art. 433-6", amende: 2200, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Conduite en état d'ivresse", article: "art. L234-1 C. route", amende: 2200, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Menaces de mort", article: "art. 222-17", amende: 2400, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Conduite sans permis, récidive", article: "art. L221-2", amende: 2400, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Dégradation de bien", article: "art. 322-1", amende: 2400, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Vol simple", article: "art. 311-3", amende: 2600, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Refus d'obtempérer simple", article: "art. L233-1", amende: 2800, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Détention de stupéfiants", article: "art. 222-37", amende: 2800, tempsGav: "15 min" },
  { type: "Délit", classe: "", nom: "Violences légères", article: "art. 222-13", amende: 3000, tempsGav: "15 min" },
  { type: "Délit", classe: "", nom: "Délit de fuite", article: "art. L231-1", amende: 3000, tempsGav: "15 min" },
  { type: "Délit", classe: "", nom: "Escroquerie", article: "art. 313-1", amende: 3400, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Port d'arme sans autorisation", article: "art. L317-8 CSI", amende: 3600, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Refus d'obtempérer avec mise en danger", article: "art. L233-1-1", amende: 3600, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Vol avec effraction", article: "art. 311-4", amende: 3800, tempsGav: "15 min" },
  { type: "Délit", classe: "", nom: "Violences", article: "art. 222-11", amende: 4000, tempsGav: "10 min" },
  { type: "Délit", classe: "", nom: "Détention d'arme de catégorie interdite", article: "art. L317-4 CSI", amende: 4400, tempsGav: "5 min" },
  { type: "Délit", classe: "", nom: "Trafic de stupéfiants, petite échelle", article: "art. 222-37 al. 2", amende: 4800, tempsGav: "15 min" },
  { type: "Délit", classe: "", nom: "Association de malfaiteurs", article: "art. 450-1", amende: 5000, tempsGav: "20 min" },

  { type: "Crime", classe: "", nom: "Séquestration", article: "art. 224-1", amende: 5500, tempsGav: "25 min" },
  { type: "Crime", classe: "", nom: "Vol à main armée / braquage", article: "art. 311-8, 311-9", amende: 5500, tempsGav: "20 min" },
  { type: "Crime", classe: "", nom: "Prise d'otage", article: "art. 224-4", amende: 6000, tempsGav: "25 min" },
  { type: "Crime", classe: "", nom: "Homicide involontaire", article: "art. 221-6-1", amende: 6000, tempsGav: "20 min" },
  { type: "Crime", classe: "", nom: "Trafic de stupéfiants en bande organisée", article: "art. 222-34 à 222-36", amende: 7500, tempsGav: "25 min" },
  { type: "Crime", classe: "", nom: "Meurtre", article: "art. 221-1", amende: 7000, tempsGav: "25 min" },
  { type: "Crime", classe: "", nom: "Assassinat avec préméditation (mort RP)", article: "art. 221-3", amende: 8000, tempsGav: "30 min" },
];

const TYPES_INFRACTION = ["Contravention", "Délit", "Crime"];

const NATURES_INFRACTION = [
  "Vol",
  "Agression / violences",
  "Dégradation de bien",
  "Escroquerie / arnaque",
  "Menaces",
  "Trafic illégal",
  "Autre",
];

const GRAVITE_INFRACTION = ["Contravention", "Délit", "Crime"];

const OUI_NON = ["Oui", "Non"];

function insignia(gradeName) {
  const idx = GRADES.indexOf(gradeName);
  if (idx < 0) return null;
  const isOfficier = idx >= OFFICIER_INDEX;
  const count = isOfficier ? idx - OFFICIER_INDEX + 1 : idx;
  if (count <= 0) return <span style={{ opacity: 0.5, fontSize: 11 }}>recrue</span>;
  const symbol = isOfficier ? "★" : "▲";
  return (
    <span style={{ letterSpacing: 2, color: "#2F6FDE", fontSize: 13 }}>
      {symbol.repeat(Math.min(count, 6))}
    </span>
  );
}

// RIO : 5 chiffres au hasard + 2 derniers chiffres uniques à chaque agent (100 agents maximum)
function genererRIO(personnel, extra = []) {
  const pris = new Set([...personnel.map((p) => p.cipcNumero).filter(Boolean), ...extra].map((n) => String(n).slice(-2)));
  const libres = [];
  for (let i = 0; i < 100; i++) { const s = String(i).padStart(2, "0"); if (!pris.has(s)) libres.push(s); }
  if (!libres.length) return null;
  return String(Math.floor(Math.random() * 100000)).padStart(5, "0") + libres[Math.floor(Math.random() * libres.length)];
}

function nextRef(list, prefix) {
  const year = new Date().getFullYear();
  const n = list.length + 1;
  return prefix + "-" + year + "-" + String(n).padStart(4, "0");
}

// Note : les anciennes données (avant la refonte sécurité) restent dans les
// documents "gendarmerie/*" et ne sont plus lues automatiquement — voir le
// message de conversation pour la marche à suivre si besoin de les récupérer.

/* ---------- Primitives UI partagées ---------- */

function Field({ label, value, onChange, type = "text", autoFocus, textarea, placeholder }) {
  const common = {
    value,
    autoFocus,
    placeholder,
    onChange: (e) => onChange(e.target.value),
    style: {
      width: "100%",
      padding: "9px 10px",
      borderRadius: 6,
      border: "1px solid #C3D0E2",
      background: "#FFFFFF",
      fontSize: 14,
      boxSizing: "border-box",
      outline: "none",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      resize: "vertical",
    },
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {textarea ? <textarea rows={4} {...common} /> : <input type={type} {...common} />}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 4 };
const selectStyle = { width: "100%", padding: "9px 10px", borderRadius: 6, border: "1px solid #C3D0E2", background: "#fff", fontSize: 13, boxSizing: "border-box" };
const smallBtn = { fontSize: 12, fontWeight: 600, background: "transparent", border: "1px solid #C3D0E2", borderRadius: 20, padding: "6px 14px", cursor: "pointer" };
const h2Style = { fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 22, marginBottom: 20, color: "#14213A", paddingBottom: 10, borderBottom: "2px solid #123A7A" };
const buttonPrimary = {
  width: "100%",
  padding: "10px 0",
  marginTop: 6,
  background: "#123A7A",
  color: "#F2F6FC",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 14px -4px rgba(22,48,92,0.5)",
};

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function FieldRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "#5A6B84", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#14213A", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}

/* ---------- Carte de service ---------- */

/* ---------- CIPC : Carte d'Identité Professionnelle et de Circulation ---------- */

function CartePro({ p, onLinked, lectureSeule }) {
  const [pseudo, setPseudo] = useState("");
  const [photo, setPhoto] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [modif, setModif] = useState(false);
  const lie = !!p.robloxVerifie && !!p.robloxId;

  useEffect(() => {
    let off = false;
    (async () => {
      if (!lie) { setPhoto(""); return; }
      try {
        const r = await fetch(`/api/roblox-head?id=${p.robloxId}`);
        const j = await r.json();
        if (!off && j.imageUrl) setPhoto(j.imageUrl);
      } catch (e) { /* la carte reste affichée sans photo */ }
    })();
    return () => { off = true; };
  }, [p.robloxId, lie]);

  async function appel(action) {
    const user = auth.currentUser;
    if (!user) throw new Error("non connecté");
    const idToken = await user.getIdToken();
    const r = await fetch("/api/roblox-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, action, pseudo: pseudo.trim() }) });
    return r.json();
  }
  async function demarrer() {
    if (!pseudo.trim()) { setMsg("Écris ton pseudo Roblox."); return; }
    setBusy(true); setMsg("");
    try {
      const j = await appel("start");
      if (j.ok) setCode(j.code); else setMsg(j.message || "Erreur, réessaie.");
    } catch (e) { setMsg("Erreur de connexion, réessaie."); }
    setBusy(false);
  }
  async function verifier() {
    setBusy(true); setMsg("");
    try {
      const j = await appel("verify");
      if (j.ok) {
        await onLinked({ pseudoRoblox: j.nom, robloxId: String(j.id), robloxVerifie: true });
        setCode(""); setModif(false); setPseudo(""); setMsg("Compte Roblox lié ✅");
      } else setMsg(j.message || "Vérification impossible, réessaie.");
    } catch (e) { setMsg("Erreur de connexion, réessaie."); }
    setBusy(false);
  }

  const nom = (p.nom || "").toUpperCase();
  const prenom = (p.prenom || "").toUpperCase();
  const num = p.cipcNumero || "";
  const qualite = p.qualiteJudiciaire || "APJA";
  const taille = (t) => Math.min(3.7, (3.7 * 15) / Math.max(t.length, 15)) + "cqw";
  const txt = { position: "absolute", fontFamily: "'Open Sans', 'Segoe UI', Arial, sans-serif", fontWeight: 800, color: "#0d0d0d", whiteSpace: "nowrap", transform: "translateY(-50%)", lineHeight: 1 };
  const inp = { flex: 1, minWidth: 180, padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 14 };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ containerType: "inline-size", width: "100%" }}>
        <div style={{ position: "relative", aspectRatio: "1367 / 768", backgroundImage: `url(${cipcFond})`, backgroundSize: "100% 100%", borderRadius: 14, overflow: "hidden", boxShadow: "0 14px 34px -14px rgba(7,20,46,0.55)" }}>
          <div style={{ position: "absolute", left: "68.3%", top: "5.2%", width: "29.1%", height: "62.8%", boxSizing: "border-box", border: "0.55cqw solid #17275a", borderRadius: "0.9cqw", background: "linear-gradient(180deg, #3b3e45, #2a2d33)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {photo ? <img src={photo} alt="Photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#9aa0ab", fontSize: "1.8cqw", fontFamily: "Arial, sans-serif", textAlign: "center", padding: "0 6%" }}>{lie ? "Photo Roblox" : "Compte Roblox à lier"}</span>}
          </div>
          <div style={{ ...txt, left: "28.3%", top: "66.5%", fontSize: taille(nom) }}>{nom}</div>
          <div style={{ ...txt, left: "28.3%", top: "74%", fontSize: taille(prenom) }}>{prenom}</div>
          <div style={{ ...txt, left: "6.4%", top: "81.4%", fontSize: "4.2cqw" }}>{qualite}</div>
          <div style={{ ...txt, left: "28.3%", top: "81.6%", fontSize: "3.7cqw", letterSpacing: "0.02em" }}>{num || "—"}</div>
        </div>
      </div>

      {!lectureSeule && <div style={{ marginTop: 14, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 16 }}>
        {lie && !modif ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13 }}>Compte Roblox lié : <b>{p.pseudoRoblox}</b> ✅</div>
            <button type="button" style={smallBtn} onClick={() => { setModif(true); setMsg(""); setCode(""); }}>Changer de compte</button>
          </div>
        ) : !code ? (
          <>
            <label style={labelStyle}>Lier mon compte Roblox (la photo de ta carte sera la tête de ton personnage)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Ton pseudo Roblox" style={inp} />
              <button type="button" disabled={busy} onClick={demarrer} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>{busy ? "…" : "Lier mon compte"}</button>
              {lie && <button type="button" style={smallBtn} onClick={() => { setModif(false); setMsg(""); }}>Annuler</button>}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, marginBottom: 8 }}>Pour prouver que ce compte est bien le tien :</div>
            <ol style={{ fontSize: 13, margin: "0 0 10px 18px", padding: 0, lineHeight: 1.6 }}>
              <li>Copie ce code : <b style={{ fontFamily: "'Courier New', monospace", background: "#E9EFF7", padding: "2px 8px", borderRadius: 5, userSelect: "all" }}>{code}</b></li>
              <li>Sur Roblox, ouvre ton profil → <b>Modifier</b>, colle le code dans la description (« À propos ») et enregistre.</li>
              <li>Reviens ici et clique sur « J'ai mis le code ». Tu pourras l'enlever ensuite.</li>
            </ol>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" disabled={busy} onClick={verifier} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>{busy ? "Vérification…" : "J'ai mis le code"}</button>
              <button type="button" style={smallBtn} onClick={() => { setCode(""); setMsg(""); }}>Annuler</button>
            </div>
          </>
        )}
        {msg && <div style={{ fontSize: 12, color: msg.includes("✅") ? "#2E7D4F" : "#C0172D", marginTop: 8 }}>{msg}</div>}
        {!num && <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 8 }}>Ton RIO n'est pas encore attribué : demande à un administrateur de l'attribuer.</div>}
      </div>}
    </div>
  );
}

/* ---------- Page d'accueil publique ---------- */

// Photos d'illustration — remplace ces URL par de vraies photos libres de droits
// (ex: unsplash.com → clic droit sur une photo → "copier l'adresse de l'image").
const IMG_HERO = "https://images.pexels.com/photos/18403814/pexels-photo-18403814.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop";
const IMG_MISSIONS = "https://images.pexels.com/photos/4646839/pexels-photo-4646839.jpeg?auto=compress&cs=tinysrgb&w=900&h=700&fit=crop";
const IMG_GAV = "https://images.pexels.com/photos/4827706/pexels-photo-4827706.jpeg?auto=compress&cs=tinysrgb&w=900&h=700&fit=crop";

function SideAction({ icon: Icon, label, color, onClick, side }) {
  return (
    <button
      onClick={onClick}
      className="gh-btn-anim"
      title={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        background: "rgba(7,20,46,0.55)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(242,246,252,0.15)",
        borderRadius: 14,
        padding: "12px 10px",
        cursor: "pointer",
        width: 84,
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 10, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={17} color="#F2F6FC" strokeWidth={1.8} />
      </div>
      <div style={{ fontSize: 10, color: "#F2F6FC", textAlign: "center", lineHeight: 1.25, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{label}</div>
    </button>
  );
}

function InfoCard({ icon: Icon, title, children }) {
  return (
    <div className="gh-card-anim" style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -12px rgba(7,20,46,0.25)" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#123A7A", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Icon size={19} color="#F2F6FC" strokeWidth={1.8} />
      </div>
      <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#14213A" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#3A4D6B", lineHeight: 1.6, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{children}</div>
    </div>
  );
}

function PublicHome({ onNavigate, recrutementOuvert, nbQuestionnaires = 0 }) {
  const cartes = [
    { key: "plainte", icon: Siren, titre: "Déposer plainte", texte: "Signalez des faits dont vous êtes victime ou témoin.", color: "#C0172D" },
    { key: "plainte-gendarme", icon: ShieldAlert, titre: "Signaler un gendarme", texte: "Faites part d'un comportement contraire à la déontologie.", color: "#3A4D6B" },
    { key: "casier-public", icon: FileSearch, titre: "Consulter mon casier", texte: "Consultez les mentions enregistrées à votre nom.", color: "#2F6FDE" },
    { key: "code-penal", icon: BookOpen, titre: "Code pénal", texte: "Retrouvez les infractions et leurs sanctions.", color: "#123A7A" },
    ...(nbQuestionnaires > 0 ? [{ key: "questionnaires", icon: ClipboardList, titre: "Rejoindre la gendarmerie", texte: recrutementOuvert ? "Le recrutement est ouvert : accédez aux candidatures." : "Consultez les questionnaires actuellement ouverts.", color: "#2E7D4F" }] : []),
  ];

  return (
    <div style={{ background: "#E9EFF7", minHeight: "100vh", fontFamily: FONT_BASE, color: "#14213A" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 5, zIndex: 50, display: "flex" }}>
        <div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#FFFFFF" }} /><div style={{ flex: 1, background: "#C0172D" }} />
      </div>

      <div style={{ backgroundImage: `linear-gradient(180deg, rgba(7,20,46,0.78), rgba(7,20,46,0.92)), url(${IMG_HERO})`, backgroundSize: "cover", backgroundPosition: "center", color: "#F2F6FC", padding: "5px 20px 70px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid #CFE0FF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_TITRE, fontWeight: 700, fontSize: 18, color: "#CFE0FF" }}>GN</div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 2.5, opacity: 0.75 }}>RÉPUBLIQUE FRANÇAISE — RP</div>
              <div style={{ fontFamily: FONT_TITRE, fontSize: 19, fontWeight: 700 }}>Gendarmerie Nationale</div>
            </div>
          </div>
          <button onClick={() => onNavigate("login")} className="gh-link-anim" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Espace gendarmes</button>
        </div>

        <div style={{ maxWidth: 880, margin: "56px auto 0", textAlign: "center" }}>
          <div style={{ display: "inline-block", background: recrutementOuvert ? "#2E7D4F" : "#C0172D", color: "#fff", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, padding: "6px 14px", borderRadius: 20 }}>
            {recrutementOuvert ? "● RECRUTEMENT OUVERT" : "● RECRUTEMENT FERMÉ"}
          </div>
          <h1 style={{ fontFamily: FONT_TITRE, fontSize: 46, lineHeight: 1.1, fontWeight: 700, margin: "18px 0 12px" }}>Gendarmerie Nationale de Black RP</h1>
          <div style={{ fontSize: 17, lineHeight: 1.6, color: "#D8E2F2" }}>Votre espace pour déposer plainte, consulter votre casier et rejoindre nos rangs.</div>
          <div style={{ marginTop: 22, display: "inline-block", background: "rgba(255,244,214,0.12)", border: "1px solid rgba(255,233,168,0.45)", color: "#FFE9A8", fontSize: 12.5, fontWeight: 600, padding: "7px 16px", borderRadius: 20 }}>⚠️ Site de jeu de rôle Roblox — usage RP uniquement, sans lien avec la Gendarmerie nationale réelle</div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "-38px auto 0", padding: "0 20px 60px", position: "relative" }}>
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 16, padding: "26px 26px 30px", boxShadow: "0 18px 40px -22px rgba(7,20,46,0.45)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Que souhaitez-vous faire ?</div>
          <div style={{ fontSize: 14, color: "#5A6B84", marginBottom: 20 }}>Choisissez une démarche ci-dessous.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14 }}>
            {cartes.map((c) => {
              const Icone = c.icon;
              return (
                <button key={c.key} onClick={() => onNavigate(c.key)} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 16, textAlign: "left", background: "#F5F8FC", border: "1px solid #D3DDEA", borderLeft: `5px solid ${c.color}`, borderRadius: 12, padding: "18px 18px", cursor: "pointer", fontFamily: FONT_BASE }}>
                  <span style={{ width: 48, height: 48, borderRadius: 12, background: c.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icone size={24} color="#fff" strokeWidth={2} />
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: "#14213A" }}>{c.titre}</span>
                    <span style={{ display: "block", fontSize: 13, color: "#5A6B84", marginTop: 3, lineHeight: 1.45 }}>{c.texte}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ background: "#07142E", color: "#B9C2CF", padding: "26px 20px 60px", textAlign: "center", fontSize: 12, lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, color: "#F2F6FC", marginBottom: 4 }}>Black RP — communauté de jeu de rôle sur Roblox</div>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>Les gendarmes, grades, plaintes et documents présentés sur ce site sont fictifs et sans aucune valeur officielle. Ce site n'est pas affilié à la Gendarmerie nationale ni à l'État. En cas d'urgence réelle, appelle le 17 ou le 112.</div>
      </div>
    </div>
  );
}

const cardButtonStyle = { textAlign: "left", background: "#F2F6FC", border: "none", borderRadius: 14, padding: "16px 20px", cursor: "pointer", color: "#14213A", boxShadow: "0 10px 26px -10px rgba(0,0,0,0.55)", transition: "transform 0.15s ease" };

/* ---------- Écran de confirmation générique ---------- */

function Confirmation({ title, message, refNumber, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 20%, #123A7A, #07142E 60%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ background: "#F2F6FC", borderRadius: 10, padding: 28, maxWidth: 420, textAlign: "center", boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10, color: "#14213A" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 14, lineHeight: 1.5 }}>{message}</div>
        {refNumber && <div style={{ fontFamily: "'Courier New', monospace", fontSize: 15, background: "#fff", border: "1px solid #C3D0E2", borderRadius: 6, padding: "8px 0", marginBottom: 18 }}>{refNumber}</div>}
        <button onClick={onBack} style={{ ...buttonPrimary, width: "auto", padding: "9px 20px" }}>Retour</button>
      </div>
    </div>
  );
}

/* ---------- Formulaire public : plainte ---------- */

function PlainteForm({ onSubmit, onCancel }) {
  const blank = { plaignantPrenom: "", plaignantNom: "", plaignantPseudoRoblox: "", plaignantPseudoDiscord: "", dateFaits: "", lieuFaits: "", nature: NATURES_INFRACTION[0], misEnCause: "", temoins: "", description: "", certifie: false };
  const [form, setForm] = useState(blank);

  function submit(e) {
    e.preventDefault();
    if (!form.plaignantPrenom || !form.plaignantNom || !form.description || !form.certifie) return;
    onSubmit(form);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#14213A" }}>Dépôt de plainte en ligne</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 24 }}>Ce formulaire ne remplace pas un dépôt en brigade en cas d'urgence. Toute déclaration mensongère peut être sanctionnée en jeu.</div>
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 26, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 10 }}>Identité du plaignant</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Prénom" value={form.plaignantPrenom} onChange={(v) => setForm({ ...form, plaignantPrenom: v })} />
            <Field label="Nom" value={form.plaignantNom} onChange={(v) => setForm({ ...form, plaignantNom: v })} />
          </div>
          <Field label="Pseudo Roblox" value={form.plaignantPseudoRoblox} onChange={(v) => setForm({ ...form, plaignantPseudoRoblox: v })} />
          <Field label="Pseudo Discord" value={form.plaignantPseudoDiscord} onChange={(v) => setForm({ ...form, plaignantPseudoDiscord: v })} />
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", margin: "18px 0 10px" }}>Les faits</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => setForm({ ...form, dateFaits: v })} />
            <Field label="Lieu des faits" value={form.lieuFaits} onChange={(v) => setForm({ ...form, lieuFaits: v })} placeholder="Ex : Black RP, quartier..." />
          </div>
          <Select label="Nature de l'infraction" value={form.nature} onChange={(v) => setForm({ ...form, nature: v })} options={NATURES_INFRACTION} />
          <Field label="Description détaillée des faits" textarea value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Décrivez précisément le déroulement des faits" />
          <Field label="Personne mise en cause (si connue)" value={form.misEnCause} onChange={(v) => setForm({ ...form, misEnCause: v })} placeholder="Pseudo ou description" />
          <Field label="Témoins (si présents)" value={form.temoins} onChange={(v) => setForm({ ...form, temoins: v })} placeholder="Pseudos des témoins" />
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#3A4D6B", margin: "14px 0 18px" }}>
            <input type="checkbox" checked={form.certifie} onChange={(e) => setForm({ ...form, certifie: e.target.checked })} style={{ marginTop: 2 }} />
            Je certifie sur l'honneur que les déclarations ci-dessus sont sincères et véritables.
          </label>
          <button type="submit" style={buttonPrimary}>Envoyer ma plainte</button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Consultation publique du code pénal ---------- */

function CodePenalPublic({ codePenal, onCancel }) {
  const [search, setSearch] = useState("");
  const s = search.trim().toLowerCase();
  const filtered = codePenal.filter((a) => !s || a.nom.toLowerCase().includes(s) || (a.article || "").toLowerCase().includes(s));

  const groups = {};
  filtered.forEach((a) => {
    const key = a.type + (a.classe ? " — " + a.classe : "");
    groups[key] = groups[key] || [];
    groups[key].push(a);
  });
  Object.keys(groups).forEach((k) => groups[k].sort((a, b) => (Number(a.amende) || 0) - (Number(b.amende) || 0)));
  const TYPE_SORT_ORDER = { Contravention: 0, Délit: 1, Crime: 2 };
  const groupKeys = Object.keys(groups).sort((a, b) => {
    const typeA = a.split(" — ")[0], typeB = b.split(" — ")[0];
    const orderA = TYPE_SORT_ORDER[typeA] ?? 99, orderB = TYPE_SORT_ORDER[typeB] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 26, fontWeight: 700, marginBottom: 4, color: "#14213A" }}>📖 Code Pénal de Black RP</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 6 }}>
          <b>Contravention</b> = amende seule. <b>Délit</b> = prison + amende, tribunal correctionnel. <b>Crime</b> = infraction la plus grave, cour d'assises.
        </div>
        <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 24 }}>
          Les amendes de toutes les infractions retenues s'additionnent toujours. Le temps de GAV ne s'additionne jamais : seul le temps le plus élevé de la sélection est retenu.
        </div>
        <div style={{ maxWidth: 320, marginBottom: 24 }}>
          <Field label="Rechercher une infraction" value={search} onChange={setSearch} placeholder="Ex : stationnement, vitesse..." />
        </div>
        {groupKeys.map((g) => (
          <div key={g} style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>{g}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {groups[g].map((a) => (
                <div key={a.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.18)" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nom}</div>
                    {a.article && <div style={{ fontSize: 11, color: "#5A6B84" }}>{a.article}</div>}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12, color: "#3A4D6B", flexShrink: 0, marginLeft: 12 }}>
                    {a.amende ? `${a.amende} crédits` : ""}{a.amende && a.tempsGav ? " — " : ""}{a.tempsGav}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {groupKeys.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune infraction enregistrée pour l'instant.</div>}
      </div>
    </div>
  );
}

/* ---------- Consultation publique du casier judiciaire ---------- */

function CasierPublicLookup({ casier, onCancel }) {
  const [pseudo, setPseudo] = useState("");
  const [searched, setSearched] = useState(false);

  const s = pseudo.trim().toLowerCase().replace(/^@/, "");
  const dossier = s ? casier.find((d) => [d.robloxUsername, d.pseudoRoblox, d.robloxDisplayName].some((v) => (v || "").trim().toLowerCase() === s)) : null;
  const mentions = dossier ? dossier.mentions.slice().reverse() : [];
  const avatars = useAvatars([dossier && dossier.robloxId]);

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#14213A" }}>Consultation de casier judiciaire</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 24 }}>Renseigne ton @ Roblox (nom d'utilisateur exact) ou ton pseudo Roblox pour voir les mentions enregistrées à ton nom.</div>
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 26, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <Field label="@ Roblox ou pseudo Roblox" value={pseudo} onChange={setPseudo} placeholder="Ex : @MonPseudo" />
          <button onClick={() => setSearched(true)} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Rechercher</button>

          {searched && (
            <div style={{ marginTop: 22 }}>
              {mentions.length === 0 ? (
                <div style={{ fontSize: 13, color: "#2E7D4F" }}>Aucune mention trouvée pour ce pseudo. Casier vierge.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {dossier && dossier.robloxId && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                      <Avatar src={avatars[dossier.robloxId]} taille={56} />
                      <div style={{ fontSize: 13 }}><b>{dossier.pseudoRoblox}</b>{dossier.robloxUsername ? <span style={{ color: "#5A6B84" }}> · @{dossier.robloxUsername}</span> : null}</div>
                    </div>
                  )}
                  {mentions.map((m) => (
                    <div key={m.id} style={{ border: "1px solid #D3DDEA", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
                      <b style={{ fontSize: 13 }}>{m.nature}</b>
                      <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 4 }}>{m.dateFaits || "Date non précisée"}</div>
                      <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 2 }}>
                        {m.amende && `Amende : ${m.amende}`}{m.amende && m.tempsGav ? " — " : ""}{m.tempsGav && `Temps de GAV : ${m.tempsGav}`}
                        {!m.amende && !m.tempsGav && "Peine non précisée"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Formulaire public : plainte contre un gendarme (traitée par IGGN/DGGN) ---------- */

/* ---------- Composant étoiles réutilisable ---------- */

function StarRating({ value, onChange, readOnly }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => !readOnly && onChange && onChange(n)}
          style={{ fontSize: readOnly ? 15 : 26, cursor: readOnly ? "default" : "pointer", color: n <= value ? "#2F6FDE" : "#C3D0E2" }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

/* ---------- Avis public sur un gendarme ---------- */

function AvisGendarmeForm({ onSubmit, onCancel }) {
  const [cibleIdentifiant, setCibleIdentifiant] = useState("");
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [annuaire, setAnnuaire] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "annuaire_public"));
        setAnnuaire(snap.docs.map((d) => d.data()));
      } catch (e) { console.error(e); }
    })();
  }, []);

  const s = cibleIdentifiant.trim().toLowerCase();
  const suggestions = s.length >= 2
    ? annuaire.filter((p) => (p.pseudoRoblox || "").toLowerCase().startsWith(s) || (p.pseudoDiscord || "").toLowerCase().startsWith(s)).slice(0, 6)
    : [];

  async function submit(e) {
    e.preventDefault();
    if (!cibleIdentifiant.trim() || note === 0) { setError("Renseigne le pseudo du gendarme et une note."); return; }
    const res = await onSubmit({ cibleIdentifiant: cibleIdentifiant.trim(), note, commentaire });
    if (res.ok) setSent(true); else setError("Échec de l'envoi, réessaie.");
  }

  if (sent) {
    return (
      <div style={{ minHeight: "100vh", background: "#E9EFF7", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Merci pour ton avis !</div>
          <button onClick={onCancel} style={{ ...buttonPrimary, width: "auto", padding: "9px 20px" }}>Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 16, color: "#14213A" }}>Noter un gendarme</div>
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <label style={labelStyle}>Pseudo Roblox ou Discord du gendarme</label>
            <input
              type="text"
              value={cibleIdentifiant}
              onChange={(e) => { setCibleIdentifiant(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Tape les premières lettres..."
              style={{ width: "100%", padding: "9px 10px", borderRadius: 6, border: "1px solid #C3D0E2", background: "#fff", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #C3D0E2", borderRadius: 8, marginTop: 4, boxShadow: "0 8px 20px -8px rgba(0,0,0,0.3)", zIndex: 10, overflow: "hidden" }}>
                {suggestions.map((p, i) => (
                  <div
                    key={i}
                    onMouseDown={() => { setCibleIdentifiant(p.pseudoRoblox || p.pseudoDiscord); setShowSuggestions(false); }}
                    style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13, borderBottom: i < suggestions.length - 1 ? "1px solid #E6EDF7" : "none" }}
                  >
                    <b>{p.prenom} {p.nom}</b>
                    <span style={{ color: "#5A6B84", marginLeft: 6 }}>
                      {[p.pseudoRoblox, p.pseudoDiscord].filter(Boolean).join(" / ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Note</label>
            <StarRating value={note} onChange={setNote} />
          </div>
          <Field label="Commentaire (facultatif)" textarea value={commentaire} onChange={setCommentaire} />
          {error && <div style={{ color: "#C0172D", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <button type="submit" style={buttonPrimary}>Envoyer</button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Avis public sur la gendarmerie ---------- */

function AvisGeneralForm({ onSubmit, onCancel }) {
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (note === 0) { setError("Choisis une note."); return; }
    const res = await onSubmit({ note, commentaire });
    if (res.ok) setSent(true); else setError("Échec de l'envoi, réessaie.");
  }

  if (sent) {
    return (
      <div style={{ minHeight: "100vh", background: "#E9EFF7", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Merci pour ton retour !</div>
          <button onClick={onCancel} style={{ ...buttonPrimary, width: "auto", padding: "9px 20px" }}>Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 16, color: "#14213A" }}>Noter la Gendarmerie</div>
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Note générale</label>
            <StarRating value={note} onChange={setNote} />
          </div>
          <Field label="Commentaire (facultatif)" textarea value={commentaire} onChange={setCommentaire} />
          {error && <div style={{ color: "#C0172D", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <button type="submit" style={buttonPrimary}>Envoyer</button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Boîte à suggestions publique ---------- */

function SuggestionForm({ onSubmit, onCancel }) {
  const [texte, setTexte] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!texte.trim()) return;
    const res = await onSubmit({ texte: texte.trim() });
    if (res.ok) setSent(true); else setError("Échec de l'envoi, réessaie.");
  }

  if (sent) {
    return (
      <div style={{ minHeight: "100vh", background: "#E9EFF7", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Suggestion envoyée, merci !</div>
          <button onClick={onCancel} style={{ ...buttonPrimary, width: "auto", padding: "9px 20px" }}>Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#14213A" }}>Boîte à suggestions</div>
        <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 16 }}>Lue uniquement par le Corps de Commandement.</div>
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <Field label="Ta suggestion" textarea value={texte} onChange={setTexte} placeholder="Idée, amélioration, remarque..." />
          {error && <div style={{ color: "#C0172D", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <button type="submit" style={buttonPrimary}>Envoyer</button>
        </form>
      </div>
    </div>
  );
}

function PlainteGendarmeForm({ onSubmit, onCancel }) {
  const blank = { plaignantPrenom: "", plaignantNom: "", plaignantPseudoRoblox: "", plaignantPseudoDiscord: "", gendarmeConcerne: "", dateFaits: "", lieuFaits: "", description: "", certifie: false };
  const [form, setForm] = useState(blank);

  function submit(e) {
    e.preventDefault();
    if (!form.plaignantPrenom || !form.plaignantNom || !form.gendarmeConcerne || !form.description || !form.certifie) return;
    onSubmit(form);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#14213A" }}>Signaler un gendarme</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 24 }}>Ce signalement est traité exclusivement par le Corps d'Encadrement et le Corps de Commandement, en dehors de la chaîne de commandement habituelle. Toute déclaration mensongère peut être sanctionnée en jeu.</div>
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 26, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 10 }}>Identité du plaignant</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Prénom" value={form.plaignantPrenom} onChange={(v) => setForm({ ...form, plaignantPrenom: v })} />
            <Field label="Nom" value={form.plaignantNom} onChange={(v) => setForm({ ...form, plaignantNom: v })} />
          </div>
          <Field label="Pseudo Roblox" value={form.plaignantPseudoRoblox} onChange={(v) => setForm({ ...form, plaignantPseudoRoblox: v })} />
          <Field label="Pseudo Discord" value={form.plaignantPseudoDiscord} onChange={(v) => setForm({ ...form, plaignantPseudoDiscord: v })} />

          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", margin: "18px 0 10px" }}>Les faits</div>
          <Field label="Gendarme concerné (pseudo, nom ou RIO)" value={form.gendarmeConcerne} onChange={(v) => setForm({ ...form, gendarmeConcerne: v })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => setForm({ ...form, dateFaits: v })} />
            <Field label="Lieu des faits" value={form.lieuFaits} onChange={(v) => setForm({ ...form, lieuFaits: v })} />
          </div>
          <Field label="Description détaillée des faits" textarea value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Décris précisément le comportement signalé" />

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#3A4D6B", margin: "14px 0 18px" }}>
            <input type="checkbox" checked={form.certifie} onChange={(e) => setForm({ ...form, certifie: e.target.checked })} style={{ marginTop: 2 }} />
            Je certifie sur l'honneur que les déclarations ci-dessus sont sincères et véritables.
          </label>
          <button type="submit" style={buttonPrimary}>Envoyer le signalement</button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Configuration des questions de candidature (GAV / SOG / Officier) ---------- */

const GAV_SECTIONS = [
  {
    title: "Informations générales",
    fields: [
      { key: "pseudoRoblox", label: "Pseudo Roblox", required: true },
      { key: "pseudoDiscord", label: "Pseudo Discord", required: true },
      { key: "age", label: "Âge", type: "number", required: true },
      { key: "anciennete_serveur", label: "Depuis combien de temps es-tu sur le serveur ?", required: true },
      { key: "sanctions_anterieures", label: "As-tu déjà été sanctionné (kick/ban/blacklist) sur un serveur RP ? Si oui, précise.", type: "textarea" },
    ],
  },
  {
    title: "Informations RP",
    fields: [
      { key: "nom_rp", label: "Nom", required: true },
      { key: "prenom_rp", label: "Prénom", required: true },
      { key: "date_naissance_rp", label: "Date de naissance", type: "date" },
      { key: "lieu_naissance_rp", label: "Lieu de naissance" },
      { key: "sexe_rp", label: "Sexe", type: "select", options: ["Homme", "Femme", "Autre"] },
    ],
  },
  {
    title: "Disponibilités",
    fields: [
      { key: "heures_semaine", label: "Combien d'heures par semaine peux-tu consacrer au RP ?", required: true },
      { key: "creneaux", label: "Quels créneaux horaires te conviennent le mieux (matin/après-midi/soir/nuit) ?" },
      { key: "dispo_weekend", label: "Es-tu disponible les week-ends ?", type: "select", options: ["Oui", "Non", "Parfois"] },
    ],
  },
  {
    title: "Motivation",
    fields: [
      { key: "pourquoi_gav", label: "Pourquoi souhaites-tu devenir GAV au sein de la gendarmerie ?", type: "textarea", required: true },
      { key: "sens_metier", label: "Qu'est-ce que le métier de gendarme représente pour toi, en RP comme dans la réalité ?", type: "textarea" },
      { key: "experience_autre_serveur", label: "As-tu déjà occupé un rôle dans les forces de l'ordre (RP) sur un autre serveur ? Lequel, et pourquoi es-tu parti ?", type: "textarea" },
      { key: "attentes", label: "Qu'attends-tu de cette expérience au sein de notre unité ?", type: "textarea" },
    ],
  },
  {
    title: "Connaissances de base",
    fields: [
      { key: "diff_grade_fonction", label: "Quelle est la différence entre un grade et une fonction ?", type: "textarea", required: true },
      { key: "def_gav", label: "Sais-tu ce que signifie l'acronyme GAV ? Explique brièvement son statut (contrat, durée, missions).", type: "textarea", required: true },
      { key: "missions_gendarme", label: "Cite 3 missions principales d'un gendarme sur le terrain.", type: "textarea", required: true },
      { key: "temoin_abus", label: "Que fais-tu si tu es témoin d'un abus de pouvoir commis par un collègue en RP ?", type: "textarea" },
    ],
  },
  {
    title: "Mise en situation RP",
    fields: [
      { key: "situation_controle", label: "Tu contrôles un véhicule qui refuse de s'arrêter. Décris ta procédure étape par étape.", type: "textarea", required: true },
      { key: "situation_agressif", label: "Un civil devient agressif verbalement lors d'un contrôle. Comment réagis-tu ?", type: "textarea" },
      { key: "situation_ordre_illegal", label: "Que fais-tu si un supérieur te donne un ordre qui te semble contraire au règlement ?", type: "textarea" },
    ],
  },
  {
    title: "Engagement",
    fields: [
      { key: "reglement_lu", label: "As-tu lu et accepté le règlement intérieur de la gendarmerie ? (Oui/Non)", type: "select", options: OUI_NON, required: true },
      { key: "engagement_discipline", label: "T'engages-tu à respecter la hiérarchie et la discipline propres au RP militaire ?", type: "select", options: OUI_NON, required: true },
      { key: "questions_remarques", label: "As-tu des questions ou remarques avant l'entretien ?", type: "textarea" },
    ],
  },
];

const SOG_SECTIONS = [
  {
    title: "Informations générales",
    fields: [
      { key: "pseudoRoblox", label: "Pseudo Roblox", required: true },
      { key: "pseudoDiscord", label: "Pseudo Discord", required: true },
      { key: "grade_actuel", label: "Grade actuel", type: "select", options: GRADES, required: true },
      { key: "date_integration", label: "Date d'intégration dans la gendarmerie", type: "date" },
      { key: "unite_actuelle", label: "Unité actuelle (SR, COG, PSIG, GIGN, etc. si applicable)" },
      { key: "heures_service", label: "Nombre d'heures de service effectuées" },
    ],
  },
  {
    title: "Bilan de service",
    fields: [
      { key: "interventions_marquantes", label: "Cite 2-3 interventions marquantes que tu as menées ou auxquelles tu as participé", type: "textarea", required: true },
      { key: "encadrement_experience", label: "As-tu déjà occupé une fonction d'encadrement (chef de patrouille, formateur, tuteur de GAV) ?", type: "textarea" },
      { key: "sanctions_sog", label: "As-tu des sanctions disciplinaires à ton actif ? Si oui, lesquelles et que retiens-tu de ces erreurs ?", type: "textarea" },
    ],
  },
  {
    title: "Motivation",
    fields: [
      { key: "pourquoi_sog", label: "Pourquoi souhaites-tu devenir SOG ?", type: "textarea", required: true },
      { key: "diff_gav_sog", label: "Qu'est-ce que ce grade change concrètement dans tes responsabilités par rapport à GAV ?", type: "textarea" },
      { key: "role_encadrement", label: "Comment envisages-tu ton rôle vis-à-vis des GAV que tu encadreras ?", type: "textarea" },
    ],
  },
  {
    title: "Connaissances hiérarchiques et légales",
    fields: [
      { key: "place_sog_hierarchie", label: "Quelle est la place du SOG dans la chaîne de commandement (entre qui et qui) ?", type: "textarea", required: true },
      { key: "diff_sousofficier_officier", label: "Quelle est la différence entre un sous-officier et un officier ?", type: "textarea" },
      { key: "opj_sog", label: "Qu'est-ce qu'un OPJ, et un SOG peut-il l'être automatiquement ?", type: "textarea" },
      { key: "grades_sousofficier", label: "Cite les grades de sous-officier dans l'ordre croissant", type: "textarea" },
    ],
  },
  {
    title: "Mises en situation (encadrement)",
    fields: [
      { key: "situation_erreur_gav", label: "Un GAV sous tes ordres commet une erreur de procédure pendant une intervention. Comment réagis-tu sur le moment, puis après ?", type: "textarea", required: true },
      { key: "situation_repartition", label: "Tu dois répartir les tâches entre plusieurs GAV lors d'une patrouille. Comment organises-tu le groupe ?", type: "textarea" },
      { key: "situation_conflit", label: "Un GAV te rapporte un conflit avec un autre gradé. Quelle est ta démarche ?", type: "textarea" },
      { key: "situation_demotive", label: "Comment gères-tu un GAV démotivé ou peu impliqué ?", type: "textarea" },
    ],
  },
  {
    title: "Leadership et discipline",
    fields: [
      { key: "qualites_sog", label: "Selon toi, quelles qualités doit avoir un bon sous-officier ?", type: "textarea" },
      { key: "sanction_ami", label: "Es-tu prêt à sanctionner un ami RP en cas de faute grave ?", type: "select", options: OUI_NON },
      { key: "formation_complementaire", label: "Acceptes-tu de suivre une formation/évaluation complémentaire si ta candidature est validée sous conditions ?", type: "select", options: OUI_NON },
    ],
  },
  {
    title: "Engagement",
    fields: [
      { key: "engagement_exemplaire", label: "T'engages-tu à être exemplaire en service comme référence pour les grades inférieurs ?", type: "select", options: OUI_NON, required: true },
      { key: "remarques_sog", label: "Remarques ou questions avant l'entretien ?", type: "textarea" },
    ],
  },
];

const OFFICIER_SECTIONS = [
  {
    title: "Informations générales",
    fields: [
      { key: "pseudoRoblox", label: "Pseudo Roblox", required: true },
      { key: "pseudoDiscord", label: "Pseudo Discord", required: true },
      { key: "grade_actuel", label: "Grade actuel", type: "select", options: GRADES, required: true },
      { key: "unite_fonction", label: "Unité actuelle et fonction(s) occupée(s)" },
      { key: "anciennete_totale", label: "Ancienneté totale dans la gendarmerie" },
      { key: "anciennete_sog", label: "Ancienneté en tant que SOG" },
    ],
  },
  {
    title: "Bilan de carrière",
    fields: [
      { key: "parcours", label: "Résume ton parcours depuis ton entrée (GAV → SOG → aujourd'hui)", type: "textarea", required: true },
      { key: "responsabilites_encadrement", label: "Quelles responsabilités d'encadrement as-tu déjà exercées (chef de groupe, formateur, commandant d'unité...) ?", type: "textarea" },
      { key: "realisations", label: "Cite 2-3 réalisations concrètes dont tu es fier (opérations menées, formations dispensées, projets internes)", type: "textarea" },
      { key: "gestion_recrutement", label: "As-tu déjà géré un recrutement, une formation, ou un rapport disciplinaire en tant que gradé ?", type: "textarea" },
      { key: "sanctions_officier", label: "As-tu des sanctions à ton actif ? Comment les expliques-tu ?", type: "textarea" },
      { key: "appui_officiers", label: "Un ou plusieurs officiers peuvent-ils appuyer ta candidature ? Lesquels ?", type: "textarea" },
    ],
  },
  {
    title: "Motivation et vision",
    fields: [
      { key: "pourquoi_officier", label: "Pourquoi souhaites-tu devenir officier ?", type: "textarea", required: true },
      { key: "diff_sog_officier_chaine", label: "Quelle différence fais-tu entre le rôle d'un sous-officier et celui d'un officier dans la chaîne de commandement ?", type: "textarea" },
      { key: "vision_unite", label: "As-tu un projet ou une vision pour l'unité/le serveur si tu obtiens ce grade (formation, réorganisation, recrutement) ?", type: "textarea" },
      { key: "conciliation_dispo", label: "Comment comptes-tu concilier ce rôle avec ta disponibilité ?", type: "textarea" },
    ],
  },
  {
    title: "Connaissances institutionnelles",
    fields: [
      { key: "diff_commandement", label: "Quelle est la différence entre commandement opérationnel et commandement administratif ?", type: "textarea", required: true },
      { key: "role_iggn", label: "Qu'est-ce que le Corps d'Encadrement et quel est son rôle vis-à-vis des officiers ?", type: "textarea" },
      { key: "opj_apj_officier", label: "Un officier peut-il être OPJ ou APJ ? Quelle est la nuance ?", type: "textarea" },
      { key: "grades_officier_ordre", label: "Cite les grades d'officier dans l'ordre croissant", type: "textarea" },
    ],
  },
  {
    title: "Mises en situation (commandement)",
    fields: [
      { key: "situation_conflit_sog", label: "Deux sous-officiers sous ton commandement sont en conflit ouvert. Comment gères-tu la situation ?", type: "textarea", required: true },
      { key: "situation_decision_seul", label: "Tu dois prendre une décision stratégique en l'absence de ta hiérarchie directe. Comment procèdes-tu ?", type: "textarea" },
      { key: "situation_motivation_unite", label: "Comment motives-tu une unité en perte d'effectifs ou de dynamique ?", type: "textarea" },
      { key: "situation_ordre_dggn", label: "Un ordre venu du Corps de Commandement te semble en décalage avec le terrain. Que fais-tu ?", type: "textarea" },
    ],
  },
  {
    title: "Leadership et exemplarité",
    fields: [
      { key: "qualites_officier", label: "Quelles qualités humaines et RP juges-tu indispensables à un officier ?", type: "textarea" },
      { key: "gestion_pression", label: "Comment gères-tu la pression et les responsabilités qui viennent avec ce grade ?", type: "textarea" },
      { key: "rendre_comptes", label: "Es-tu prêt à rendre des comptes directement au commandement supérieur (Corps de Commandement / Corps d'Encadrement) ?", type: "select", options: OUI_NON },
      { key: "periode_essai", label: "Acceptes-tu une période d'essai ou d'observation avant confirmation définitive du grade ?", type: "select", options: OUI_NON },
    ],
  },
  {
    title: "Engagement",
    fields: [
      { key: "engagement_exemplarite", label: "T'engages-tu à incarner l'exemplarité et la rigueur attendues à ce niveau ?", type: "select", options: OUI_NON, required: true },
      { key: "mot_libre", label: "Souhaites-tu ajouter un mot de motivation libre ou une remarque avant l'entretien ?", type: "textarea" },
    ],
  },
];

/* ---------- Formulaire de candidature générique (GAV / SOG / Officier) ---------- */

function ApplicationForm({ title, intro, sections, poste, prefill, onSubmit, onCancel }) {
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
const OPT_PV = "Modèle de PV (rempli par les gendarmes, pour l'OPJ)";

function newId() { return Math.random().toString(36).slice(2, 10); }

// Transforme un questionnaire enregistré en "sections" lisibles par ApplicationForm
function sectionsDe(q) {
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

function QuestionnaireFerme({ onBack }) {
  return <Confirmation title="Questionnaire indisponible" message="Ce questionnaire est fermé ou n'existe plus." onBack={onBack} />;
}

// Liste de questionnaires à choisir (page publique si onCancel, sinon dans le tableau de bord)
function QuestionnairesListe({ liste, onOpen, onCancel }) {
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
function QuestionnairesAdmin({ questionnaires, onSave }) {
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
        <h2 style={h2Style}>Questionnaires et modèles de PV</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => nouveau("public")} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>+ Nouveau questionnaire</button>
          <button onClick={() => nouveau("pv")} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0, background: "#3A4D6B" }}>+ Nouveau modèle de PV</button>
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
                {q.visibilite === "interne" ? "Interne" : q.visibilite === "pv" ? "Modèle de PV" : "Public"} — {q.actif ? "🟢 Ouvert" : "🔴 Fermé"} — {nbQuestions(q)} question(s)
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
        <Select label="Type / qui peut répondre ?" value={q.visibilite === "interne" ? OPT_INTERNE : q.visibilite === "pv" ? OPT_PV : OPT_PUBLIC} onChange={(v) => upd({ visibilite: v === OPT_INTERNE ? "interne" : v === OPT_PV ? "pv" : "public", identite: v === OPT_PUBLIC })} options={[OPT_PUBLIC, OPT_INTERNE, OPT_PV]} />
        {q.visibilite !== "pv" && (
          <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>
            <input type="checkbox" checked={q.identite !== false} onChange={(e) => upd({ identite: e.target.checked })} /> Demander automatiquement le pseudo Roblox et le pseudo Discord
          </label>
        )}
        <label style={{ display: "block", fontSize: 13 }}>
          <input type="checkbox" checked={!!q.actif} onChange={(e) => upd({ actif: e.target.checked })} /> {q.visibilite === "pv" ? "Modèle disponible pour les gendarmes" : "Questionnaire ouvert aux réponses"}
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

/* ---------- Prise / fin de service ---------- */

function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}
function debutSemaine(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // la semaine commence le lundi
  return x;
}
function cleJour(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function dateRefService(s) { return s.type === "ajustement" ? s.date : s.debut; }
function dureeService(s, now) {
  if (s.type === "ajustement") return (s.minutes || 0) * 60000;
  const fin = s.fin ? new Date(s.fin).getTime() : now;
  return Math.max(0, fin - new Date(s.debut).getTime());
}
function fmtDuree(ms) {
  const neg = ms < 0;
  const m = Math.round(Math.abs(ms) / 60000);
  return `${neg ? "−" : ""}${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}
function fmtHeure(iso) { return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }
function fmtJourCourt(d) { return new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" }); }

function statsService(list, now) {
  const lundi = debutSemaine(now);
  const cleAuj = cleJour(now);
  const parJour = [];
  for (let i = 0; i < 7; i++) { const d = new Date(lundi); d.setDate(lundi.getDate() + i); parJour.push({ date: d, cle: cleJour(d), ms: 0 }); }
  const parSemaine = [];
  for (let i = 0; i < 6; i++) { const d = new Date(lundi); d.setDate(lundi.getDate() - 7 * i); parSemaine.push({ date: d, cle: d.getTime(), ms: 0 }); }
  let total = 0, jour = 0, semaine = 0;
  list.forEach((s) => {
    const ref = dateRefService(s);
    if (!ref) return;
    const ms = dureeService(s, now);
    const sem = debutSemaine(ref).getTime();
    total += ms;
    if (cleJour(ref) === cleAuj) jour += ms;
    if (sem === lundi.getTime()) semaine += ms;
    const pj = parJour.find((x) => x.cle === cleJour(ref)); if (pj) pj.ms += ms;
    const ps = parSemaine.find((x) => x.cle === sem); if (ps) ps.ms += ms;
  });
  return { total, jour, semaine, parJour, parSemaine };
}

function StatBox({ label, ms }) {
  return (
    <div style={{ flex: 1, minWidth: 130, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px" }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 22, fontWeight: 700, color: "#123A7A" }}>{fmtDuree(ms)}</div>
    </div>
  );
}

function RepartitionService({ st }) {
  const ligne = { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "1px solid #E6EDF7" };
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div style={{ flex: 1, minWidth: 220, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px" }}>
        <div style={labelStyle}>Par jour (cette semaine)</div>
        {st.parJour.map((j) => <div key={j.cle} style={ligne}><span style={{ textTransform: "capitalize" }}>{fmtJourCourt(j.date)}</span><b>{fmtDuree(j.ms)}</b></div>)}
      </div>
      <div style={{ flex: 1, minWidth: 220, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px" }}>
        <div style={labelStyle}>Par semaine</div>
        {st.parSemaine.map((w) => <div key={w.cle} style={ligne}><span>Semaine du {w.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span><b>{fmtDuree(w.ms)}</b></div>)}
      </div>
    </div>
  );
}

function LigneService({ s, now, onDelete, onForceStop }) {
  const box = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" };
  if (s.type === "ajustement") {
    return (
      <div style={{ ...box, background: "#EEF3FA" }}>
        <div style={{ fontSize: 13 }}>
          <b>{fmtJourCourt(s.date)}</b> — Ajustement par l'administration : <b style={{ color: s.minutes < 0 ? "#C0172D" : "#2E7D4F" }}>{fmtDuree(s.minutes * 60000)}</b>
          {s.motif ? <span style={{ color: "#5A6B84" }}> ({s.motif})</span> : null}
        </div>
        {onDelete && <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => onDelete(s.id)}>Supprimer</button>}
      </div>
    );
  }
  return (
    <div style={box}>
      <div style={{ fontSize: 13 }}>
        <b style={{ textTransform: "capitalize" }}>{fmtJourCourt(s.debut)}</b> — {fmtHeure(s.debut)} → {s.fin ? fmtHeure(s.fin) : "en cours"} : <b>{fmtDuree(dureeService(s, now))}</b>
        {s.force && <span style={{ color: "#C0172D", fontSize: 11 }}> (arrêt forcé{s.forcePar ? " par " + s.forcePar : ""})</span>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {!s.fin && onForceStop && <button style={smallBtn} onClick={() => onForceStop(s.id)}>Forcer l'arrêt</button>}
        {onDelete && <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => onDelete(s.id)}>Supprimer</button>}
      </div>
    </div>
  );
}

const triDate = (a, b) => new Date(dateRefService(b)) - new Date(dateRefService(a));

function MonServicePage({ current, services, onStart, onStop }) {
  const now = useNow(1000);
  const mine = services.filter((s) => s.matricule === current.matricule);
  const actif = mine.find((s) => s.type !== "ajustement" && !s.fin);
  const st = statsService(mine, now);
  const histo = mine.slice().sort(triDate).slice(0, 30);

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={h2Style}>Mon service</h2>
      <div style={{ background: actif ? "#E9F4EC" : "#fff", border: "1px solid " + (actif ? "#2E7D4F" : "#D3DDEA"), borderRadius: 14, padding: 22, marginBottom: 20, textAlign: "center" }}>
        {actif ? (
          <>
            <div style={{ fontSize: 13, color: "#2E7D4F", fontWeight: 700 }}>🟢 EN SERVICE depuis {fmtHeure(actif.debut)}</div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 34, margin: "8px 0 14px" }}>{fmtDuree(dureeService(actif, now)).replace(" h ", " h ")}</div>
            <button className="gh-btn-anim" onClick={() => onStop(actif.id)} style={{ ...buttonPrimary, width: "auto", padding: "10px 26px", background: "#C0172D" }}>Terminer mon service</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#5A6B84", marginBottom: 12 }}>🔴 Tu n'es pas en service</div>
            <button className="gh-btn-anim" onClick={onStart} style={{ ...buttonPrimary, width: "auto", padding: "10px 26px", background: "#2E7D4F" }}>Prendre mon service</button>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="Aujourd'hui" ms={st.jour} />
        <StatBox label="Cette semaine" ms={st.semaine} />
        <StatBox label="Total" ms={st.total} />
      </div>
      <RepartitionService st={st} />
      <div style={{ ...labelStyle, marginBottom: 8 }}>Historique de mes services</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {histo.map((s) => <LigneService key={s.id} s={s} now={now} />)}
        {histo.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun service enregistré.</div>}
      </div>
    </div>
  );
}

function AdminServicesPage({ personnel, services, onForceStop, onAdjust, onDelete }) {
  const now = useNow(1000);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ sens: "Retirer du temps", heures: "", minutes: "", motif: "" });
  const [msg, setMsg] = useState("");
  const actifs = services.filter((s) => s.type !== "ajustement" && !s.fin);
  const nomDe = (mat) => { const p = personnel.find((x) => x.matricule === mat); return p ? `${p.prenom} ${p.nom}` : mat; };
  const card = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, marginBottom: 18 };

  if (sel) {
    const p = personnel.find((x) => x.matricule === sel);
    const liste = services.filter((s) => s.matricule === sel);
    const st = statsService(liste, now);
    const histo = liste.slice().sort(triDate).slice(0, 60);
    async function ajuster(e) {
      e.preventDefault();
      const total = Number(form.heures || 0) * 60 + Number(form.minutes || 0);
      if (!(total > 0)) { setMsg("Indique une durée (heures et/ou minutes)."); return; }
      const ok = await onAdjust({ matricule: sel, nom: nomDe(sel), minutes: form.sens === "Retirer du temps" ? -total : total, motif: form.motif.trim() });
      if (ok) { setMsg("Ajustement enregistré."); setForm({ ...form, heures: "", minutes: "", motif: "" }); }
    }
    return (
      <div style={{ maxWidth: 760 }}>
        <button style={{ ...smallBtn, marginBottom: 14 }} onClick={() => { setSel(null); setMsg(""); }}>← Retour à la liste</button>
        <h2 style={h2Style}>{p ? `${p.prenom} ${p.nom}` : sel} <span style={{ fontSize: 13, color: "#5A6B84" }}>({sel})</span></h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <StatBox label="Aujourd'hui" ms={st.jour} />
          <StatBox label="Cette semaine" ms={st.semaine} />
          <StatBox label="Total" ms={st.total} />
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Ajouter ou retirer du temps</div>
          <form onSubmit={ajuster}>
            <Select label="Action" value={form.sens} onChange={(v) => setForm({ ...form, sens: v })} options={["Retirer du temps", "Ajouter du temps"]} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Heures" type="number" value={form.heures} onChange={(v) => setForm({ ...form, heures: v })} /></div>
              <div style={{ flex: 1 }}><Field label="Minutes" type="number" value={form.minutes} onChange={(v) => setForm({ ...form, minutes: v })} /></div>
            </div>
            <Field label="Motif (facultatif)" value={form.motif} onChange={(v) => setForm({ ...form, motif: v })} />
            {msg && <div style={{ fontSize: 12, color: "#123A7A", marginBottom: 8 }}>{msg}</div>}
            <button className="gh-btn-anim" type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>Valider</button>
          </form>
        </div>
        <RepartitionService st={st} />
        <div style={{ ...labelStyle, marginBottom: 8 }}>Historique</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {histo.map((s) => <LigneService key={s.id} s={s} now={now} onDelete={(id) => { if (window.confirm("Supprimer cette ligne définitivement ?")) onDelete(id); }} onForceStop={onForceStop} />)}
          {histo.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun service enregistré.</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={h2Style}>Gestion des services</h2>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🟢 Actuellement en service ({actifs.length})</div>
        {actifs.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #E6EDF7", fontSize: 13 }}>
            <span><b>{nomDe(s.matricule)}</b> — depuis {fmtHeure(s.debut)} ({fmtDuree(dureeService(s, now))})</span>
            <button style={smallBtn} onClick={() => { if (window.confirm(`Forcer l'arrêt du service de ${nomDe(s.matricule)} ?`)) onForceStop(s.id); }}>Forcer l'arrêt</button>
          </div>
        ))}
        {actifs.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Personne n'est en service.</div>}
      </div>
      <div style={{ ...labelStyle, marginBottom: 8 }}>Heures par gendarme</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {personnel.slice().sort((a, b) => `${a.nom}${a.prenom}`.localeCompare(`${b.nom}${b.prenom}`)).map((p) => {
          const st = statsService(services.filter((s) => s.matricule === p.matricule), now);
          return (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13 }}><b>{p.prenom} {p.nom}</b> <span style={{ color: "#5A6B84" }}>(RIO {p.cipcNumero || "—"})</span></div>
              <div style={{ fontSize: 12, color: "#3A4D6B" }}>Jour {fmtDuree(st.jour)} · Semaine {fmtDuree(st.semaine)} · Total <b>{fmtDuree(st.total)}</b></div>
              <button style={smallBtn} onClick={() => { setSel(p.matricule); setMsg(""); }}>Détails / modifier</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Procès-verbaux (modèles créés par l'admin, remplis par les gendarmes pour l'OPJ) ---------- */

function PVRemplir({ modele, onSubmit }) {
  const sections = sectionsDe(modele);
  const init = () => {
    const v = {};
    sections.forEach((s) => s.fields.forEach((f) => { v[f.key] = f.type === "select" ? f.options[0] : ""; }));
    return v;
  };
  const [values, setValues] = useState(init);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function submit(e) {
    e.preventDefault();
    for (const s of sections) for (const f of s.fields) {
      if (f.required && !String(values[f.key] || "").trim()) { setError("Merci de compléter tous les champs obligatoires."); return; }
    }
    const answers = sections.flatMap((s) => s.fields.map((f) => ({ section: s.title, label: f.label, value: values[f.key] })));
    const res = await onSubmit({ modeleId: modele.id, modeleTitre: modele.titre, answers });
    if (res) { setError(""); setValues(init()); setOk("PV transmis à l'OPJ."); setTimeout(() => setOk(""), 4000); }
    else setError("Échec de l'envoi, réessaie.");
  }

  return (
    <form onSubmit={submit}>
      {modele.intro && <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 12 }}>{modele.intro}</div>}
      {sections.map((s) => (
        <div key={s.title}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", margin: "14px 0 8px" }}>{s.title}</div>
          {s.fields.map((f) =>
            f.type === "select" ? (
              <Select key={f.key} label={f.label} value={values[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} options={f.options} />
            ) : (
              <Field key={f.key} label={f.label} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} textarea={f.type === "textarea"} value={values[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} />
            )
          )}
        </div>
      ))}
      {error && <div style={{ color: "#C0172D", fontSize: 12, margin: "8px 0" }}>{error}</div>}
      {ok && <div style={{ color: "#2E7D4F", fontSize: 12, margin: "8px 0" }}>{ok}</div>}
      <button className="gh-btn-anim" type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Envoyer le PV à l'OPJ</button>
    </form>
  );
}

function PVPage({ current, modeles, pvs, onSubmit, onMarkTraite }) {
  const canSeeAll = current.isAdmin || (current.qualifications || []).includes("OPJ");
  const [tab, setTab] = useState("en-cours");
  const [modeleTitre, setModeleTitre] = useState(modeles[0] ? modeles[0].titre : "");
  const modele = modeles.find((m) => m.titre === modeleTitre) || modeles[0];
  const base = canSeeAll ? pvs : pvs.filter((p) => p.auteurMatricule === current.matricule);
  const enCours = base.filter((p) => !p.traite);
  const archives = base.filter((p) => p.traite);
  const shown = tab === "en-cours" ? enCours : archives;

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={h2Style}>Procès-verbaux</h2>
      <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Rédiger un PV</div>
        {modeles.length === 0 ? (
          <div style={{ fontSize: 13, color: "#5A6B84" }}>Aucun modèle de PV n'est disponible pour le moment.</div>
        ) : (
          <>
            <Select label="Type de PV" value={modele.titre} onChange={setModeleTitre} options={modeles.map((m) => m.titre)} />
            <PVRemplir key={modele.id} modele={modele} onSubmit={onSubmit} />
          </>
        )}
      </div>

      <div style={{ ...labelStyle, marginBottom: 8 }}>{canSeeAll ? "PV reçus (à l'attention de l'OPJ)" : "Mes PV"}</div>
      <ArchiveTabs tab={tab} setTab={setTab} countEnCours={enCours.length} countArchivees={archives.length} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.slice().reverse().map((p) => (
          <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.modeleTitre} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#123A7A", background: "#E9EFF7", padding: "2px 7px", borderRadius: 5 }}>{p.ref}</span></div>
              <span style={{ fontSize: 11, color: p.traite ? "#2E7D4F" : "#2F6FDE", fontWeight: 700 }}>{p.traite ? "Traité" : "En attente"}</span>
            </div>
            <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>Rédigé par {p.auteurNom} ({p.auteurMatricule}) le {new Date(p.createdAt).toLocaleString("fr-FR")}</div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#123A7A" }}>Voir le PV</summary>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 8, padding: 14 }}>
                {(p.answers || []).map((a, i) => (
                  <div key={i}>
                    {a.section && (i === 0 || p.answers[i - 1].section !== a.section) && <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#2F6FDE", marginBottom: 6 }}>{a.section}</div>}
                    <div style={{ fontSize: 11, color: "#5A6B84", marginBottom: 2 }}>{a.label}</div>
                    <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{a.value || "—"}</div>
                  </div>
                ))}
              </div>
            </details>
            {canSeeAll && !p.traite && <button onClick={() => onMarkTraite(p.id)} style={{ ...smallBtn, marginTop: 10, background: "#123A7A", color: "#fff" }}>Marquer comme traité</button>}
          </div>
        ))}
        {shown.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>{tab === "en-cours" ? "Aucun PV en attente." : "Aucun PV traité."}</div>}
      </div>
    </div>
  );
}

/* ---------- Habillage : barre du haut, tuiles, mention RP ---------- */

const ICONES_MENU = {
  dossier: BadgeCheck, "cartes-pro": BadgeCheck, "main-courante": Radio, "code-penal-interne": BookOpen, reglements: ScrollText, "mes-avis": Star, "questionnaires-internes": ClipboardList,
  "mon-service": Clock, pv: FileText, casier: FileSearch, "comptes-rendus": MessageSquare, "postuler-sog": TrendingUp, "postuler-officier": TrendingUp,
  "admin-candidatures": UserPlus, promotions: Award, sanctions: Scale, "admin-personnel": Users, roles: UserCog, "admin-questionnaires": ClipboardList,
  "admin-services": Clock, "admin-grades": Settings, "admin-plaintes": Siren, "plaintes-gendarmes": ShieldAlert, "avis-suggestions": MessageSquare, logs: ScrollText,
};

function RPRibbon() {
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999, background: "#FFF4D6", borderTop: "1px solid #E8D28A", color: "#6B4E00", fontSize: 11.5, fontWeight: 600, textAlign: "center", padding: "6px 12px", fontFamily: FONT_BASE, lineHeight: 1.35 }}>
      ⚠️ Site de jeu de rôle (Roblox) — usage RP uniquement. Aucun lien avec la Gendarmerie nationale réelle. Urgence réelle : 17 ou 112.
    </div>
  );
}

function DashTopBar({ current, titre, actif }) {
  const pill = actif
    ? { background: "#E3F4EA", color: "#1F6B42", border: "1px solid #A9D9BC" }
    : { background: "#EEF2F8", color: "#5A6B84", border: "1px solid #D3DDEA" };
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(6px)", borderBottom: "1px solid #D3DDEA", padding: "10px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: FONT_BASE }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ background: "#123A7A", color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, padding: "4px 8px", borderRadius: 4 }}>PULSAR RP</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#14213A" }}>{titre}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ ...pill, fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 20 }}>{actif ? `● En service depuis ${fmtHeure(actif.debut)}` : "○ Hors service"}</span>
        <div style={{ textAlign: "right", lineHeight: 1.25 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#14213A" }}>{current.grade} {current.prenom} {current.nom}</div>
          <div style={{ fontSize: 11, color: "#5A6B84" }}>RIO {current.cipcNumero || "—"}{current.unite ? ` · ${current.unite}` : ""}</div>
        </div>
      </div>
    </div>
  );
}

function PulsarTuiles({ groups, onOpen }) {
  const visibles = groups.map((g) => ({ ...g, items: g.items.filter((it) => it.id !== "dossier") })).filter((g) => g.items.length > 0);
  return (
    <div style={{ marginBottom: 30, fontFamily: FONT_BASE }}>
      {visibles.map((g) => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "#5A6B84", marginBottom: 10 }}>{g.label}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 12 }}>
            {g.items.map((it) => {
              const Icone = ICONES_MENU[it.id] || FileText;
              return (
                <button key={it.id} onClick={() => onOpen(it.id)} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 14px", cursor: "pointer", boxShadow: "0 4px 14px -10px rgba(7,20,46,0.35)", fontFamily: FONT_BASE }}>
                  <span style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #123A7A, #2F6FDE)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icone size={20} color="#fff" strokeWidth={2} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#14213A", lineHeight: 1.25, minWidth: 0, overflowWrap: "anywhere" }}>{it.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Cartes professionnelles de tous les agents ---------- */

function CartesProPage({ personnel }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const liste = personnel
    .filter((p) => norm(`${p.prenom} ${p.nom} ${p.cipcNumero || ""} ${p.grade} ${p.unite}`).includes(norm(q)))
    .slice()
    .sort((a, b) => (b.gradeRank || 0) - (a.gradeRank || 0) || `${a.nom}${a.prenom}`.localeCompare(`${b.nom}${b.prenom}`));
  const choisi = personnel.find((p) => p.id === sel);

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={h2Style}>Cartes professionnelles</h2>
      {choisi && (
        <div style={{ marginBottom: 26 }}>
          <button style={{ ...smallBtn, marginBottom: 10 }} onClick={() => setSel(null)}>✕ Fermer la carte</button>
          <CartePro p={choisi} lectureSeule />
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un agent (nom, prénom, RIO, grade…)" style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", border: "1px solid #C3D0E2", borderRadius: 10, fontSize: 14, marginBottom: 14, background: "#fff" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 10 }}>
        {liste.map((p) => (
          <button key={p.id} onClick={() => { setSel(p.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="gh-btn-anim" style={{ textAlign: "left", background: sel === p.id ? "#E6EDF7" : "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 14px", cursor: "pointer", boxShadow: "0 3px 12px -9px rgba(7,20,46,0.35)" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#14213A" }}>{p.prenom} {p.nom}</div>
            <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>{p.grade} — {p.unite}</div>
            <div style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontFamily: "'Courier New', monospace", background: "#E6EDF7", color: "#123A7A", padding: "2px 7px", borderRadius: 5, fontWeight: 700 }}>RIO {p.cipcNumero || "—"}</span>
              <span style={{ color: "#5A6B84", fontWeight: 600 }}>{p.qualiteJudiciaire || "APJA"}</span>
            </div>
          </button>
        ))}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun agent trouvé.</div>}
      </div>
    </div>
  );
}

/* ---------- Main courante numérique ---------- */

const TYPE_PATROUILLE = "Prise de patrouille";
const TYPES_MC = [TYPE_PATROUILLE, "Intervention", "Contrôle routier", "Incident", "Information", "Relève / consigne", "Autre"];
const MATERIEL_PATROUILLE = [
  "HK G36 en calibre 5,56 x 45 mm OTAN", "Plots", "Ruban", "Herse Stop Stick", "PIE", "Pistolet-Radar", "Grenades assourdissantes",
];
const PATROUILLE_VIDE = { nbAgents: "", vehicule: "", plaque: "", materiel: [] };
const TYPES_MC_EDIT = [...TYPES_MC, "Activité"];
const COULEURS_MC = { Activité: "#6B7A90", [TYPE_PATROUILLE]: "#123A7A", Patrouille: "#123A7A", Intervention: "#C0172D", "Contrôle routier": "#2F6FDE", Incident: "#B25E00", Information: "#5A6B84", "Relève / consigne": "#2E7D4F", Autre: "#3A4D6B" };

function PatrouilleChamps({ v, onChange }) {
  const bascule = (m) => onChange({ ...v, materiel: v.materiel.includes(m) ? v.materiel.filter((x) => x !== m) : [...v.materiel, m] });
  return (
    <div style={{ background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 14, margin: "4px 0 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 10 }}>Détails de la patrouille</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1.4fr", gap: 12 }}>
        <Field label="Nombre d'agents" type="number" value={v.nbAgents} onChange={(x) => onChange({ ...v, nbAgents: x })} />
        <Field label="Véhicule" value={v.vehicule} onChange={(x) => onChange({ ...v, vehicule: x })} />
        <Field label="Plaque d'immatriculation" value={v.plaque} onChange={(x) => onChange({ ...v, plaque: x.toUpperCase() })} />
      </div>
      <label style={labelStyle}>Matériel emporté</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 7 }}>
        {MATERIEL_PATROUILLE.map((m) => (
          <label key={m} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={v.materiel.includes(m)} onChange={() => bascule(m)} /> {m}
          </label>
        ))}
      </div>
    </div>
  );
}

// Vérifie et nettoie les champs de patrouille ; renvoie { erreur } ou { champs }
function champsPatrouille(v) {
  const n = parseInt(v.nbAgents, 10);
  if (!(n >= 1 && n <= 50)) return { erreur: "Indique le nombre d'agents qui partent en patrouille (entre 1 et 50)." };
  if (!v.vehicule.trim()) return { erreur: "Indique le véhicule utilisé." };
  if (!v.plaque.trim()) return { erreur: "Indique la plaque du véhicule." };
  return { champs: { nbAgents: n, vehicule: v.vehicule.trim(), plaque: v.plaque.trim().toUpperCase(), materiel: v.materiel } };
}

function MainCourantePage({ current, enService, canEdit, canDelete, onGoService, onLog }) {
  const today = cleJour(new Date());
  const [jour, setJour] = useState(today);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [form, setForm] = useState({ type: TYPES_MC[0], lieu: "", description: "", agents: "", ...PATROUILLE_VIDE });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const charger = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "main_courante"), where("jour", "==", jour)));
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); setMsg("Impossible de charger la main courante."); }
    setLoading(false);
  }, [jour]);

  useEffect(() => {
    setLoading(true);
    charger();
    if (jour !== today) return undefined;
    const t = setInterval(charger, 30000);
    return () => clearInterval(t);
  }, [charger, jour, today]);

  async function ajouter(e) {
    e.preventDefault();
    const patrouille = form.type === TYPE_PATROUILLE;
    if (!patrouille && !form.description.trim()) { setMsg("Décris l'événement."); return; }
    let extra = {};
    if (patrouille) {
      const r = champsPatrouille(form);
      if (r.erreur) { setMsg(r.erreur); return; }
      extra = r.champs;
    }
    setBusy(true);
    setMsg("");
    try {
      await addDoc(collection(db, "main_courante"), {
        createdAt: new Date().toISOString(), jour: cleJour(new Date()), type: form.type, lieu: form.lieu.trim(),
        description: form.description.trim() || "Prise de patrouille.", agents: form.agents.trim(), ...extra,
        auteurUid: current.id, auteurNom: `${current.prenom} ${current.nom}`, auteurGrade: current.grade, auteurRIO: current.cipcNumero || "",
      });
      setForm({ ...form, lieu: "", description: "", agents: "", ...PATROUILLE_VIDE });
      setMsg("Entrée ajoutée à la main courante.");
      if (jour !== today) setJour(today); else await charger();
    } catch (e2) { console.error(e2); setMsg("Impossible d'ajouter l'entrée : vérifie que ton service est bien pris, puis réessaie dans quelques secondes."); }
    setBusy(false);
  }
  function commencerEdition(en) {
    setEditId(en.id);
    setEditForm({ type: en.type || TYPES_MC[0], lieu: en.lieu || "", description: en.description || "", agents: en.agents || "", nbAgents: en.nbAgents ? String(en.nbAgents) : "", vehicule: en.vehicule || "", plaque: en.plaque || "", materiel: en.materiel || [] });
  }
  async function enregistrerEdition() {
    const patrouille = editForm.type === TYPE_PATROUILLE;
    if (!patrouille && !editForm.description.trim()) { setMsg("La description ne peut pas être vide."); return; }
    let extra = { nbAgents: null, vehicule: "", plaque: "", materiel: [] };
    if (patrouille) {
      const r = champsPatrouille(editForm);
      if (r.erreur) { setMsg(r.erreur); return; }
      extra = r.champs;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "main_courante", editId), {
        type: editForm.type, lieu: editForm.lieu.trim(), description: editForm.description.trim() || "Prise de patrouille.", agents: editForm.agents.trim(), ...extra,
        modifie: true, modifiePar: `${current.prenom} ${current.nom}`, modifieLe: new Date().toISOString(),
      });
      onLog("Main courante", "Entrée modifiée");
      setEditId(null); setEditForm(null); setMsg("Entrée modifiée.");
      await charger();
    } catch (e) { console.error(e); setMsg("Modification refusée (réservée aux OPJ)."); }
    setBusy(false);
  }
  async function supprimer(en) {
    if (!window.confirm("Supprimer définitivement cette entrée de la main courante ?")) return;
    try {
      await deleteDoc(doc(db, "main_courante", en.id));
      onLog("Main courante", "Entrée supprimée");
      await charger();
    } catch (e) { console.error(e); setMsg("Suppression refusée."); }
  }

  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const affiches = entries
    .filter((en) => norm(`${en.type} ${en.lieu} ${en.description} ${en.agents} ${en.auteurNom} ${en.vehicule || ""} ${en.plaque || ""}`).includes(norm(recherche)))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const decaler = (n) => { const d = new Date(`${jour}T12:00:00`); d.setDate(d.getDate() + n); const k = cleJour(d); if (k <= today) setJour(k); };
  const inp = { padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 14, background: "#fff", boxSizing: "border-box", width: "100%" };
  const card = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 20, marginBottom: 22, boxShadow: "0 6px 20px -12px rgba(7,20,46,0.3)" };

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={h2Style}>Main courante</h2>

      {enService ? (
        <form onSubmit={ajouter} style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Nouvelle entrée</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 4 }}>
            <Select label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={TYPES_MC} />
            <Field label="Lieu (facultatif)" value={form.lieu} onChange={(v) => setForm({ ...form, lieu: v })} />
          </div>
          {form.type === TYPE_PATROUILLE && <PatrouilleChamps v={form} onChange={(v) => setForm({ ...form, ...v })} />}
          <Field label={form.type === TYPE_PATROUILLE ? "Observations (facultatif)" : "Description de l'événement"} textarea value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <Field label={form.type === TYPE_PATROUILLE ? "Noms des agents (facultatif)" : "Agents / personnes impliqués (facultatif)"} value={form.agents} onChange={(v) => setForm({ ...form, agents: v })} />
          <button type="submit" disabled={busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 20px", marginTop: 4 }}>{busy ? "Envoi…" : "Ajouter à la main courante"}</button>
        </form>
      ) : (
        <div style={{ ...card, background: "#FFF4D6", borderColor: "#E8D28A", color: "#6B4E00", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Tu n'es pas en service : tu peux consulter la main courante, mais pas y ajouter d'entrée.</div>
          <button onClick={onGoService} style={smallBtn}>Prendre mon service</button>
        </div>
      )}
      {msg && <div style={{ fontSize: 12.5, color: msg.startsWith("Entrée") ? "#1F6B42" : "#C0172D", marginBottom: 14 }}>{msg}</div>}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <button style={smallBtn} onClick={() => decaler(-1)}>←</button>
        <input type="date" value={jour} max={today} onChange={(e) => e.target.value && setJour(e.target.value)} style={{ ...inp, width: "auto" }} />
        <button style={smallBtn} onClick={() => decaler(1)} disabled={jour >= today}>→</button>
        {jour !== today && <button style={smallBtn} onClick={() => setJour(today)}>Aujourd'hui</button>}
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher dans la journée…" style={{ ...inp, flex: 1, minWidth: 180 }} />
      </div>
      <div style={{ ...labelStyle, marginBottom: 8 }}>{loading ? "Chargement…" : `${affiches.length} événement(s) — ${new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affiches.map((en) => {
          const couleur = COULEURS_MC[en.type] || "#3A4D6B";
          if (editId === en.id && editForm) {
            return (
              <div key={en.id} style={{ ...card, marginBottom: 0, borderLeft: `5px solid ${couleur}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                  <Select label="Type" value={editForm.type} onChange={(v) => setEditForm({ ...editForm, type: v })} options={TYPES_MC_EDIT} />
                  <Field label="Lieu" value={editForm.lieu} onChange={(v) => setEditForm({ ...editForm, lieu: v })} />
                </div>
                {editForm.type === TYPE_PATROUILLE && <PatrouilleChamps v={editForm} onChange={(v) => setEditForm({ ...editForm, ...v })} />}
                <Field label="Description" textarea value={editForm.description} onChange={(v) => setEditForm({ ...editForm, description: v })} />
                <Field label="Agents / personnes impliqués" value={editForm.agents} onChange={(v) => setEditForm({ ...editForm, agents: v })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button disabled={busy} onClick={enregistrerEdition} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 0 }}>Enregistrer</button>
                  <button onClick={() => { setEditId(null); setEditForm(null); }} style={smallBtn}>Annuler</button>
                </div>
              </div>
            );
          }
          return (
            <div key={en.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${couleur}`, borderRadius: 12, padding: "14px 16px", boxShadow: "0 3px 12px -9px rgba(7,20,46,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 14 }}>{new Date(en.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span style={{ background: couleur, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 12 }}>{en.type}</span>
                  {en.auto && <span style={{ fontSize: 11, color: "#5A6B84", fontWeight: 600 }}>🤖 automatique</span>}
                  {en.lieu && <span style={{ fontSize: 12.5, color: "#3A4D6B", fontWeight: 600 }}>📍 {en.lieu}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "#5A6B84" }}>{en.auteurGrade} {en.auteurNom}{en.auteurRIO ? ` · RIO ${en.auteurRIO}` : ""}</div>
              </div>
              {en.type === TYPE_PATROUILLE && en.vehicule && (
                <div style={{ marginTop: 8, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}>
                  <div><b>{en.nbAgents}</b> agent{en.nbAgents > 1 ? "s" : ""} · 🚓 {en.vehicule} — <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700 }}>{en.plaque}</span></div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                    {(en.materiel || []).length > 0
                      ? en.materiel.map((m) => <span key={m} style={{ background: "#E6EDF7", color: "#123A7A", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 12 }}>{m}</span>)
                      : <span style={{ color: "#5A6B84", fontSize: 12 }}>Aucun matériel spécifique</span>}
                  </div>
                </div>
              )}
              {en.description && en.description !== "Prise de patrouille." && <div style={{ fontSize: 14, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{en.description}</div>}
              {en.agents && <div style={{ fontSize: 12.5, color: "#3A4D6B", marginTop: 6 }}>👥 {en.agents}</div>}
              {en.modifie && <div style={{ fontSize: 11, color: "#B25E00", marginTop: 6 }}>✎ Modifié par {en.modifiePar} le {new Date(en.modifieLe).toLocaleString("fr-FR")}</div>}
              {(canEdit || canDelete) && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {canEdit && <button style={smallBtn} onClick={() => commencerEdition(en)}>Modifier</button>}
                  {canDelete && <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => supprimer(en)}>Supprimer</button>}
                </div>
              )}
            </div>
          );
        })}
        {!loading && affiches.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun événement enregistré ce jour-là.</div>}
      </div>
    </div>
  );
}

/* ---------- Écran de connexion ---------- */

function LoginScreen({ onLogin, onBack, blockedMsg }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ancien, setAncien] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await onLogin(username, password);
    if (!res.ok) setError(res.error || "Identifiants incorrects.");
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 15%, #123A7A, #07142E 62%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_BASE }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#8FA0B8", fontSize: 12, cursor: "pointer", marginBottom: 16 }}>← Retour à l'accueil</button>
        <div style={{ textAlign: "center", marginBottom: 22, color: "#F2F6FC" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6 }}>GENDARMERIE NATIONALE DE BLACK RP</div>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 30, fontWeight: 700, marginTop: 4 }}>Pulsar RP</div>
          <div style={{ display: "inline-block", marginTop: 10, background: "rgba(255,244,214,0.12)", border: "1px solid rgba(255,233,168,0.45)", color: "#FFE9A8", fontSize: 11.5, fontWeight: 600, padding: "5px 12px", borderRadius: 20 }}>⚠️ Jeu de rôle Roblox uniquement</div>
        </div>
        {blockedMsg && <div style={{ background: "#C0172D", color: "#fff", borderRadius: 8, padding: "10px 14px", fontSize: 12, marginBottom: 14, textAlign: "center" }}>{blockedMsg}</div>}
        <div style={{ background: "#F2F6FC", borderRadius: 14, padding: 24, boxShadow: "0 18px 40px -16px rgba(0,0,0,0.6)" }}>
          <a href="/api/discord" style={{ display: "block", textAlign: "center", textDecoration: "none", background: "#5865F2", color: "#fff", borderRadius: 10, padding: "13px 14px", fontSize: 15, fontWeight: 700 }}>Se connecter / créer mon compte avec Discord</a>
          <div style={{ textAlign: "center", color: "#5A6B84", fontSize: 12, marginTop: 10 }}>Réservé aux membres ayant le rôle « Militaire Engagé » sur le Discord.</div>
          <div style={{ borderTop: "1px solid #D3DDEA", margin: "18px 0 12px" }} />
          {!ancien ? (
            <button type="button" onClick={() => setAncien(true)} style={{ background: "none", border: "none", color: "#5A6B84", fontSize: 12, cursor: "pointer", width: "100%", textDecoration: "underline" }}>Compte sans Discord (identifiant et mot de passe)</button>
          ) : (
            <form onSubmit={handleLogin}>
              <Field label="Identifiant" value={username} onChange={setUsername} autoFocus />
              <Field label="Mot de passe" value={password} onChange={setPassword} type="password" />
              {error && <div style={{ color: "#C0172D", fontSize: 12, marginBottom: 10 }}>{error}</div>}
              <button type="submit" disabled={busy} style={buttonPrimary}>{busy ? "Connexion…" : "Se connecter"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Tableau de bord connecté ---------- */

function construireMenu(current, isAdmin, counts) {
  const isOPJ = (current.qualifications || []).includes("OPJ");
  const isRecruteur = (current.qualifications || []).includes("Recruteur");
  const canSOG = current.grade === REGLAGES.seuilSog;
  const canOfficier = current.grade === REGLAGES.seuilCandOfficier;
  const canSeeCandidatures = isAdmin || isRecruteur;
  const canSeePlaintes = isAdmin || isOPJ;
  const canSeePV = isAdmin || isOPJ;

  const isDggnOuIggn = estCorps(current.unite);
  const isHautGrade = (current.gradeRank ?? GRADES.indexOf(current.grade)) >= DISCIPLINE_MIN_INDEX;

  const groups = [
    {
      label: "Général",
      items: [
        { id: "dossier", label: "𝐂𝐈𝐏𝐂" },
        { id: "cartes-pro", label: "Cartes pro" },
        { id: "code-penal-interne", label: "Code Pénal" },
        { id: "reglements", label: "Règlements" },
        { id: "mes-avis", label: "Mes avis" },
        ...(counts.questionnaires ? [{ id: "questionnaires-internes", label: "Questionnaires" }] : []),
      ],
    },
    {
      label: "Terrain",
      items: [
        { id: "mon-service", label: "Mon service" },
        { id: "main-courante", label: "Main courante" },
        { id: "pv", label: "Procès-verbaux" + (canSeePV && counts.pv ? ` (${counts.pv})` : "") },
        { id: "casier", label: "Casier judiciaire" },
        { id: "comptes-rendus", label: "Comptes rendus" },
        ...(canSOG ? [{ id: "postuler-sog", label: "Postuler SOG" }] : []),
        ...(canOfficier ? [{ id: "postuler-officier", label: "Postuler Officier" }] : []),
      ],
    },
    {
      label: "Ressources humaines",
      items: [
        ...(canSeeCandidatures ? [{ id: "admin-candidatures", label: "Candidatures" + (counts.candidatures ? ` (${counts.candidatures})` : "") }] : []),
        { id: "promotions", label: "Promotions" },
        ...(isAdmin || isHautGrade ? [{ id: "sanctions", label: "Sanctions" }] : []),
        ...(isAdmin ? [{ id: "admin-personnel", label: "Gestion du personnel" }] : []),
        ...(isAdmin ? [{ id: "roles", label: "Rôles & Permissions" }] : []),
        ...(isAdmin ? [{ id: "admin-questionnaires", label: "Questionnaires & modèles de PV" }] : []),
        ...(isAdmin ? [{ id: "admin-services", label: "Gestion des services" }] : []),
        ...(isAdmin ? [{ id: "admin-grades", label: "Grades & unités" }] : []),
      ],
    },
    {
      label: "Direction",
      items: [
        ...(canSeePlaintes ? [{ id: "admin-plaintes", label: "Plaintes" + (counts.plaintes ? ` (${counts.plaintes})` : "") }] : []),
        ...(isAdmin || isDggnOuIggn ? [{ id: "plaintes-gendarmes", label: "Plaintes contre gendarmes" + (counts.plaintesGendarmes ? ` (${counts.plaintesGendarmes})` : "") }] : []),
        { id: "avis-suggestions", label: "Avis & Suggestions" },
        ...(isAdmin ? [{ id: "logs", label: "Journal d'activité" }] : []),
      ],
    },
  ].filter((g) => g.items.length > 0);

  return groups;
}

function Sidebar({ current, section, setSection, isAdmin, onLogout, counts }) {
  const groups = construireMenu(current, isAdmin, counts);

  const initiales = `${(current.prenom || "?")[0]}${(current.nom || "?")[0]}`.toUpperCase();

  return (
    <div style={{ width: 244, background: "linear-gradient(180deg, #0C2655, #07142E)", color: "#F2F6FC", padding: "22px 14px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px solid #2F6FDE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 12, color: "#2F6FDE" }}>GN</span>
        </div>
        <div>
          <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>Gendarmerie Nationale de Black RP</div>
          <div style={{ fontSize: 10, opacity: 0.6 }}>Pulsar RP · jeu de rôle</div>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "#8FA0B8", opacity: 0.7, padding: "0 11px 6px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{g.label}</div>
          {g.items.map((it) => (
            <button
              key={it.id}
              onClick={() => setSection(it.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: section === it.id ? "#123A7A" : "transparent",
                color: "#F2F6FC",
                border: "none",
                borderLeft: section === it.id ? "3px solid #2F6FDE" : "3px solid transparent",
                borderRadius: 6,
                padding: "9px 11px",
                marginBottom: 2,
                fontSize: 13,
                fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                cursor: "pointer",
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      ))}

      <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#123A7A", border: "1px solid rgba(47,111,222,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#2F6FDE", flexShrink: 0 }}>
            {initiales}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.prenom} {current.nom}</div>
            <div style={{ fontSize: 10, opacity: 0.55, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.grade}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ fontSize: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.25)", color: "#F2F6FC", padding: "6px 10px", borderRadius: 6, cursor: "pointer", width: "100%" }}>Déconnexion</button>
      </div>
    </div>
  );
}

const ROLE_COLORS = ["#123A7A", "#C0172D", "#2F6FDE", "#2E7D4F", "#3A4D6B", "#7A3B9C", "#1A6B8C"];

function RolesPage({ roles, onCreate, onUpdate, onDelete }) {
  const blank = { nom: "", couleur: ROLE_COLORS[0], isAdmin: false, qualifications: [] };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  function submit(e) {
    e.preventDefault();
    if (!form.nom.trim()) return;
    if (editingId) { onUpdate(editingId, form); setEditingId(null); } else { onCreate(form); }
    setForm(blank);
  }
  function startEdit(r) {
    setEditingId(r.id);
    setForm({ nom: r.nom, couleur: r.couleur || ROLE_COLORS[0], isAdmin: !!r.isAdmin, qualifications: r.qualifications || [] });
  }
  function toggleQualification(q) {
    setForm((f) => ({ ...f, qualifications: f.qualifications.includes(q) ? f.qualifications.filter((x) => x !== q) : [...f.qualifications, q] }));
  }

  return (
    <div>
      <h2 style={h2Style}>Rôles & Permissions</h2>
      <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 20 }}>
        Crée des rôles réutilisables (comme sur Discord). Applique-les ensuite depuis "Gestion du personnel" pour préremplir les droits d'un compte — les autorisations restent toujours modifiables au cas par cas.
      </div>

      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier le rôle" : "Créer un rôle"}</div>
        <Field label="Nom du rôle" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} placeholder="Ex : Négociateur Senior" />
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Couleur</label>
          <div style={{ display: "flex", gap: 8 }}>
            {ROLE_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, couleur: c })} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: form.couleur === c ? "3px solid #14213A" : "1px solid #C3D0E2", cursor: "pointer" }} />
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={form.isAdmin} onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })} /> Administrateur (accès complet)
          </label>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Autorisations incluses</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {QUALIFICATIONS.map((q) => (
              <label key={q} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={form.qualifications.includes(q)} onChange={() => toggleQualification(q)} /> {q}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>{editingId ? "Enregistrer" : "Créer le rôle"}</button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#123A7A", border: "1px solid #123A7A" }}>Annuler</button>}
        </div>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {roles.map((r) => (
          <div key={r.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: r.couleur || "#5A6B84", display: "inline-block" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{r.nom}</div>
                <div style={{ fontSize: 11, color: "#5A6B84" }}>{r.isAdmin ? "Administrateur — " : ""}{(r.qualifications || []).join(", ") || "Aucune autorisation particulière"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => startEdit(r)} style={smallBtn}>Modifier</button>
              <button onClick={() => onDelete(r.id)} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Suppr.</button>
            </div>
          </div>
        ))}
        {roles.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun rôle créé pour l'instant.</div>}
      </div>
    </div>
  );
}

function AdminPanel({ personnel, roles, onCreate, onDelete, onUpdate, onAssignRIO, onSyncQualites }) {
  const blank = { matricule: "", nom: "", prenom: "", pseudoRoblox: "", pseudoDiscord: "", grade: GRADES[0], unite: UNITES[0], fonction: "", qualifications: [], isAdmin: false, qualiteJudiciaire: "APJA", cipcNumero: "", discordId: "" };
  const vide = { prenom: "", nom: "", username: "", password: "", grade: GRADES[0], unite: UNITES[0], fonction: "", qualiteJudiciaire: "APJA" };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nouveau, setNouveau] = useState(vide);
  const [msg, setMsg] = useState("");
  const sansRIO = personnel.filter((p) => !p.cipcNumero).length;
  const card = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" };

  async function submit(e) {
    e.preventDefault();
    if (!form.nom || !form.prenom) return;
    setBusy(true);
    setError("");
    const { delierRoblox, robloxVerifie, cipcNumero, discordId, ...reste } = form;
    const data = { ...reste, gradeRank: GRADES.indexOf(form.grade) };
    if (discordId) delete data.qualiteJudiciaire; // défini par les rôles Discord
    if (delierRoblox) { data.pseudoRoblox = ""; data.robloxId = ""; data.robloxVerifie = false; }
    const res = await onUpdate(editingId, data);
    setBusy(false);
    if (res && !res.ok) { setError(res.error || "Une erreur est survenue."); return; }
    setEditingId(null);
    setForm(blank);
  }
  async function creer(e) {
    e.preventDefault();
    if (!nouveau.prenom.trim() || !nouveau.nom.trim() || !nouveau.username.trim() || !nouveau.password) { setError("Prénom, nom, identifiant et mot de passe sont obligatoires."); return; }
    setBusy(true);
    setError("");
    const res = await onCreate(nouveau);
    setBusy(false);
    if (res && !res.ok) { setError(res.error || "Une erreur est survenue."); return; }
    setNouveau(vide);
    setCreating(false);
    setMsg("Compte créé. Le RIO a été attribué automatiquement.");
  }
  function startEdit(p) {
    setEditingId(p.id);
    setCreating(false);
    setError("");
    setForm({ matricule: p.matricule || "", nom: p.nom || "", prenom: p.prenom || "", pseudoRoblox: p.pseudoRoblox || "", robloxVerifie: !!p.robloxVerifie, delierRoblox: false, pseudoDiscord: p.pseudoDiscord || "", grade: GRADES.includes(p.grade) ? p.grade : GRADES[0], unite: UNITES.includes(p.unite) ? p.unite : UNITES[0], fonction: p.fonction || "", qualifications: p.qualifications || [], isAdmin: !!p.isAdmin, qualiteJudiciaire: p.qualiteJudiciaire || "APJA", cipcNumero: p.cipcNumero || "", discordId: p.discordId || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function toggleQualification(q) {
    setForm((f) => ({ ...f, qualifications: f.qualifications.includes(q) ? f.qualifications.filter((x) => x !== q) : [...f.qualifications, q] }));
  }
  function applyRole(roleId) {
    const r = roles.find((x) => x.id === roleId);
    if (!r) return;
    setForm((f) => ({ ...f, isAdmin: !!r.isAdmin, qualifications: r.qualifications || [] }));
  }

  return (
    <div>
      <h2 style={h2Style}>Gestion du personnel</h2>
      <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 14 }}>Les comptes se créent tout seuls quand un gendarme se connecte avec Discord. Pour quelqu'un qui ne peut pas lier son Discord, crée-lui un compte ici.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => { setCreating(!creating); setEditingId(null); setError(""); setMsg(""); }} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>{creating ? "Fermer" : "+ Créer un compte (sans Discord)"}</button>
        <button onClick={async () => { setMsg("Synchronisation avec Discord…"); setMsg(await onSyncQualites()); }} style={smallBtn}>Synchroniser les qualités avec Discord</button>
        {sansRIO > 0 && <button onClick={async () => { const n = await onAssignRIO(); setMsg(n >= 0 ? `${n} RIO attribué(s).` : "Échec de l'attribution."); }} style={smallBtn}>Attribuer les RIO manquants ({sansRIO})</button>}
      </div>
      {msg && <div style={{ fontSize: 12, color: "#1F6B42", marginBottom: 12 }}>{msg}</div>}

      {creating && (
        <form onSubmit={creer} style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Nouveau compte (identifiant + mot de passe)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Prénom" value={nouveau.prenom} onChange={(v) => setNouveau({ ...nouveau, prenom: v })} />
            <Field label="Nom" value={nouveau.nom} onChange={(v) => setNouveau({ ...nouveau, nom: v })} />
            <Field label="Identifiant de connexion" value={nouveau.username} onChange={(v) => setNouveau({ ...nouveau, username: v })} />
            <Field label="Mot de passe (6 caractères minimum)" type="password" value={nouveau.password} onChange={(v) => setNouveau({ ...nouveau, password: v })} />
            <Select label="Grade" value={nouveau.grade} onChange={(v) => setNouveau({ ...nouveau, grade: v })} options={GRADES} />
            <Select label="Unité" value={nouveau.unite} onChange={(v) => setNouveau({ ...nouveau, unite: v })} options={UNITES} />
            <Field label="Fonction" value={nouveau.fonction} onChange={(v) => setNouveau({ ...nouveau, fonction: v })} />
            <Select label="Qualité judiciaire (carte)" value={nouveau.qualiteJudiciaire} onChange={(v) => setNouveau({ ...nouveau, qualiteJudiciaire: v })} options={["OPJ", "APJ", "APJA"]} />
          </div>
          {error && <div style={{ color: "#C0172D", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>{busy ? "Création…" : "Créer le compte"}</button>
        </form>
      )}

      {editingId && (
        <form onSubmit={submit} style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Modifier le compte</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>RIO (attribué automatiquement)</label>
              <div style={{ padding: "9px 10px", fontSize: 14, fontFamily: "'Courier New', monospace", color: "#123A7A", fontWeight: 700 }}>{form.cipcNumero || "pas encore attribué"}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Pseudo Discord</label>
              <div style={{ padding: "9px 10px", fontSize: 14, color: "#5A6B84" }}>{form.pseudoDiscord || "—"}{form.discordId ? " (relié automatiquement)" : " (compte sans Discord)"}</div>
            </div>
            <Field label="Prénom" value={form.prenom} onChange={(v) => setForm({ ...form, prenom: v })} />
            <Field label="Nom" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Compte Roblox</label>
              <div style={{ padding: "9px 10px", fontSize: 14, color: "#5A6B84" }}>{form.pseudoRoblox ? `${form.pseudoRoblox}${form.robloxVerifie ? " ✅ lié" : " (non vérifié)"}` : "Pas encore lié"}</div>
              {form.pseudoRoblox && (
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={!!form.delierRoblox} onChange={(e) => setForm({ ...form, delierRoblox: e.target.checked })} /> Délier ce compte Roblox
                </label>
              )}
            </div>
            <Field label="Fonction" value={form.fonction} onChange={(v) => setForm({ ...form, fonction: v })} />
            <Select label="Grade" value={form.grade} onChange={(v) => setForm({ ...form, grade: v })} options={GRADES} />
            <Select label="Unité" value={form.unite} onChange={(v) => setForm({ ...form, unite: v })} options={UNITES} />
            {form.discordId ? (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Qualité judiciaire (carte)</label>
                <div style={{ padding: "9px 10px", fontSize: 14, color: "#5A6B84" }}>{form.qualiteJudiciaire} (selon les rôles Discord)</div>
              </div>
            ) : (
              <Select label="Qualité judiciaire (carte)" value={form.qualiteJudiciaire} onChange={(v) => setForm({ ...form, qualiteJudiciaire: v })} options={["OPJ", "APJ", "APJA"]} />
            )}
          </div>
          {roles.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Appliquer un rôle (préremplit les autorisations ci-dessous)</label>
              <select defaultValue="" onChange={(e) => e.target.value && applyRole(e.target.value)} style={selectStyle}>
                <option value="">— Choisir un rôle —</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
              </select>
            </div>
          )}
          <div style={{ margin: "4px 0 14px" }}>
            <label style={labelStyle}>Qualifications</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {QUALIFICATIONS.map((q) => (
                <label key={q} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={form.qualifications.includes(q)} onChange={() => toggleQualification(q)} /> {q}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={form.isAdmin} onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })} /> Administrateur
            </label>
          </div>
          {error && <div style={{ color: "#C0172D", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={busy} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>{busy ? "…" : "Enregistrer"}</button>
            <button type="button" onClick={() => { setEditingId(null); setError(""); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#123A7A", border: "1px solid #123A7A" }}>Annuler</button>
          </div>
        </form>
      )}
      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>Registre ({personnel.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {personnel.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "12px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.18)" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.prenom} {p.nom} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#5A6B84" }}>(RIO {p.cipcNumero || "—"})</span></div>
              <div style={{ fontSize: 12, color: "#5A6B84" }}>{p.grade} — {p.unite}{p.isAdmin ? " — Admin" : ""}{p.discordId ? " — Discord ✅" : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => startEdit(p)} style={smallBtn}>Modifier</button>
              <button onClick={() => { if (window.confirm(`Supprimer le compte de ${p.prenom} ${p.nom} ? S'il se reconnecte avec Discord, un nouveau compte sera recréé.`)) onDelete(p.id); }} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Grades & unités modifiables par l'admin ---------- */

function GradesUnitesAdmin({ personnel, onSave }) {
  const [grades, setGrades] = useState(() => GRADES.map((nom, i) => ({ key: newId(), nom, tag: GRADES_TAGS[i] || "", ancien: nom })));
  const [unites, setUnites] = useState(() => UNITES.map((nom) => ({ key: newId(), nom, ancien: nom })));
  const [seuils, setSeuils] = useState(() => {
    const trouve = (n) => { const i = GRADES.indexOf(n); return i >= 0 ? i : 0; };
    return { seuilOfficier: trouve(REGLAGES.seuilOfficier), seuilSog: trouve(REGLAGES.seuilSog), seuilCandOfficier: trouve(REGLAGES.seuilCandOfficier), seuilHaut: trouve(REGLAGES.seuilHaut) };
  });
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const card = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, marginBottom: 20 };
  const inp = { padding: "8px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13, background: "#fff", boxSizing: "border-box" };
  const btn = { ...smallBtn, padding: "6px 10px" };
  const bouger = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const c = arr.slice(); [c[i], c[j]] = [c[j], c[i]]; return c; };
  const suivre = (i, d) => { // garde les seuils sur le bon grade quand on déplace une ligne
    const j = i + d;
    if (j < 0 || j >= grades.length) return;
    setSeuils((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === i ? j : v === j ? i : v])));
  };
  const retirerGrade = (i) => {
    setSeuils((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === i ? 0 : v > i ? v - 1 : v])));
    setGrades((g) => g.filter((_, x) => x !== i));
  };

  async function enregistrer() {
    setOk(false);
    const gn = grades.map((g) => ({ ...g, nom: g.nom.trim(), tag: g.tag.trim().toUpperCase() }));
    const un = unites.map((u) => ({ ...u, nom: u.nom.trim() }));
    if (gn.length === 0 || un.length === 0) { setMsg("Il faut au moins un grade et une unité."); return; }
    if (gn.some((g) => !g.nom) || un.some((u) => !u.nom)) { setMsg("Aucun nom ne peut être vide."); return; }
    if (new Set(gn.map((g) => g.nom)).size !== gn.length) { setMsg("Deux grades ont le même nom."); return; }
    if (new Set(un.map((u) => u.nom)).size !== un.length) { setMsg("Deux unités ont le même nom."); return; }
    if (gn.some((g) => g.tag && !/^[A-Z0-9]{3}$/.test(g.tag))) { setMsg("Un tag Discord doit faire exactement 3 lettres ou chiffres (ex. GA2)."); return; }
    const tags = gn.map((g) => g.tag).filter(Boolean);
    if (new Set(tags).size !== tags.length) { setMsg("Deux grades ont le même tag Discord."); return; }
    const manquante = UNITES_PROTEGEES.find((n) => !un.some((u) => u.nom === n && u.ancien === n));
    if (manquante) { setMsg(`L'unité « ${manquante} » ne peut être ni renommée ni supprimée (des accès en dépendent).`); return; }

    const renomGrades = {}; gn.forEach((g) => { if (g.ancien && g.ancien !== g.nom) renomGrades[g.ancien] = g.nom; });
    const renomUnites = {}; un.forEach((u) => { if (u.ancien && u.ancien !== u.nom) renomUnites[u.ancien] = u.nom; });
    const gradesFinaux = new Set(gn.map((g) => g.nom));
    const unitesFinales = new Set(un.map((u) => u.nom));
    const gBloques = Array.from(new Set(personnel.map((p) => p.grade).filter((g) => g && !gradesFinaux.has(renomGrades[g] || g))));
    if (gBloques.length) { setMsg(`Des gendarmes ont encore le grade : ${gBloques.join(", ")}. Change leur grade avant de le supprimer.`); return; }
    const uBloquees = Array.from(new Set(personnel.map((p) => p.unite).filter((u) => u && !unitesFinales.has(renomUnites[u] || u))));
    if (uBloquees.length) { setMsg(`Des gendarmes sont encore dans l'unité : ${uBloquees.join(", ")}. Change leur unité avant de la supprimer.`); return; }

    const nomSeuil = (i) => (gn[i] ? gn[i].nom : gn[0].nom);
    setBusy(true);
    setMsg("");
    const res = await onSave({
      grades: gn.map((g) => g.nom), gradesTags: gn.map((g) => g.tag), unites: un.map((u) => u.nom),
      seuils: { seuilOfficier: nomSeuil(seuils.seuilOfficier), seuilSog: nomSeuil(seuils.seuilSog), seuilCandOfficier: nomSeuil(seuils.seuilCandOfficier), seuilHaut: nomSeuil(seuils.seuilHaut) },
      renomGrades, renomUnites,
    });
    setBusy(false);
    if (res && res.ok) {
      setGrades(gn.map((g) => ({ ...g, ancien: g.nom })));
      setUnites(un.map((u) => ({ ...u, ancien: u.nom })));
      setOk(true);
      setMsg("Enregistré. Les gendarmes ont été mis à jour.");
    } else setMsg((res && res.error) || "Échec de l'enregistrement.");
  }

  const optionsSeuil = grades.map((g, i) => <option key={g.key} value={i}>{g.nom || "(sans nom)"}</option>);
  const seuilRow = (cle, label) => (
    <div style={{ marginBottom: 10 }}>
      <label style={labelStyle}>{label}</label>
      <select value={seuils[cle]} onChange={(e) => setSeuils({ ...seuils, [cle]: Number(e.target.value) })} style={selectStyle}>{optionsSeuil}</select>
    </div>
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={h2Style}>Grades & unités</h2>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Grades (du plus bas au plus haut)</div>
        <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 12 }}>Le tag Discord est le texte entre crochets du rôle, par exemple GA2 pour « [GA2] - … ». Laisse-le vide s'il n'y a pas de rôle Discord.</div>
        {grades.map((g, i) => (
          <div key={g.key} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ width: 24, fontSize: 11, color: "#5A6B84" }}>{i + 1}</span>
            <input value={g.nom} onChange={(e) => setGrades(grades.map((x, k) => (k === i ? { ...x, nom: e.target.value } : x)))} placeholder="Nom du grade" style={{ ...inp, flex: 1, minWidth: 170 }} />
            <input value={g.tag} maxLength={3} onChange={(e) => setGrades(grades.map((x, k) => (k === i ? { ...x, tag: e.target.value.toUpperCase() } : x)))} placeholder="Tag" style={{ ...inp, width: 64, textAlign: "center" }} />
            <button type="button" style={btn} onClick={() => { suivre(i, -1); setGrades(bouger(grades, i, -1)); }}>↑</button>
            <button type="button" style={btn} onClick={() => { suivre(i, 1); setGrades(bouger(grades, i, 1)); }}>↓</button>
            <button type="button" style={{ ...btn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => retirerGrade(i)}>✕</button>
          </div>
        ))}
        <button type="button" style={{ ...smallBtn, marginTop: 6 }} onClick={() => setGrades([...grades, { key: newId(), nom: "", tag: "", ancien: "" }])}>+ Ajouter un grade (en haut de la liste, à déplacer ensuite)</button>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Seuils (qui a accès à quoi)</div>
        {seuilRow("seuilOfficier", "Les officiers commencent au grade")}
        {seuilRow("seuilSog", "Les sous-officiers (SOG) commencent au grade")}
        {seuilRow("seuilCandOfficier", "Le grade qui peut postuler Officier est")}
        {seuilRow("seuilHaut", "Haut grade (sanctions, promotions) à partir de")}
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Unités</div>
        {unites.map((u, i) => {
          const protegee = UNITES_PROTEGEES.includes(u.ancien);
          return (
            <div key={u.key} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <input value={u.nom} disabled={protegee} onChange={(e) => setUnites(unites.map((x, k) => (k === i ? { ...x, nom: e.target.value } : x)))} placeholder="Nom de l'unité" style={{ ...inp, flex: 1, background: protegee ? "#E6EDF7" : "#fff" }} />
              <button type="button" style={btn} onClick={() => setUnites(bouger(unites, i, -1))}>↑</button>
              <button type="button" style={btn} onClick={() => setUnites(bouger(unites, i, 1))}>↓</button>
              {protegee ? <span style={{ fontSize: 11, color: "#5A6B84", width: 34, textAlign: "center" }}>🔒</span> : <button type="button" style={{ ...btn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => setUnites(unites.filter((_, k) => k !== i))}>✕</button>}
            </div>
          );
        })}
        <button type="button" style={{ ...smallBtn, marginTop: 6 }} onClick={() => setUnites([...unites, { key: newId(), nom: "", ancien: "" }])}>+ Ajouter une unité</button>
        <div style={{ fontSize: 11, color: "#5A6B84", marginTop: 8 }}>🔒 Le Corps de Commandement et le Corps d'Encadrement sont protégés : des accès du site en dépendent.</div>
      </div>

      {msg && <div style={{ color: ok ? "#2E7D4F" : "#C0172D", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      <button className="gh-btn-anim" disabled={busy} onClick={enregistrer} style={{ ...buttonPrimary, width: "auto", padding: "10px 22px", marginTop: 0 }}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
    </div>
  );
}

const STATUT_COLORS = { "En attente": "#2F6FDE", "Acceptée": "#2E7D4F", "Refusée": "#C0172D", "En cours": "#2F6FDE", "Traitée": "#2E7D4F", "Classée": "#5A6B84" };

function StatutBadge({ statut }) {
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", background: STATUT_COLORS[statut] || "#5A6B84", color: "#fff", padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{statut}</span>;
}

function ArchiveTabs({ tab, setTab, countEnCours, countArchivees }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <button onClick={() => setTab("en-cours")} style={{ ...smallBtn, background: tab === "en-cours" ? "#123A7A" : "transparent", color: tab === "en-cours" ? "#fff" : "#14213A", borderColor: tab === "en-cours" ? "#123A7A" : "#C3D0E2" }}>En cours ({countEnCours})</button>
      <button onClick={() => setTab("archivees")} style={{ ...smallBtn, background: tab === "archivees" ? "#5A6B84" : "transparent", color: tab === "archivees" ? "#fff" : "#14213A", borderColor: tab === "archivees" ? "#5A6B84" : "#C3D0E2" }}>📁 Archivées ({countArchivees})</button>
    </div>
  );
}

function AdminCandidatures({ candidatures, onUpdateStatut }) {
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

function AdminPlaintes({ plaintes, current, onUpdateStatut, onTakeCharge }) {
  const [tab, setTab] = useState("en-cours");
  const enCours = plaintes.filter((p) => p.statut === "En attente" || p.statut === "En cours");
  const archivees = plaintes.filter((p) => p.statut === "Traitée" || p.statut === "Classée");
  const shown = tab === "en-cours" ? enCours : archivees;
  return (
    <div>
      <h2 style={h2Style}>Plaintes reçues</h2>
      <ArchiveTabs tab={tab} setTab={setTab} countEnCours={enCours.length} countArchivees={archivees.length} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.slice().reverse().map((p) => {
          const isMine = p.prisEnChargeMatricule === current.matricule;
          const canAct = current.isAdmin || isMine;
          return (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "18px 20px", boxShadow: "0 4px 16px -8px rgba(7,20,46,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.plaignantPrenom} {p.plaignantNom} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#123A7A", fontWeight: 600, background: "#E9EFF7", padding: "2px 7px", borderRadius: 5, marginLeft: 4 }}>({p.ref})</span></div>
                  <div style={{ fontSize: 12, color: "#5A6B84" }}>{p.nature} — {p.dateFaits || "date non précisée"} — {p.lieuFaits || "lieu non précisé"}</div>
                </div>
                <StatutBadge statut={p.statut} />
              </div>
              <FieldRow label="Description" value={p.description} />
              <FieldRow label="Mis en cause" value={p.misEnCause} />
              <FieldRow label="Témoins" value={p.temoins} />
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
                {!p.prisEnChargeMatricule && (
                  <button onClick={() => onTakeCharge(p.id)} style={{ ...smallBtn, background: "#123A7A", color: "#fff" }}>Prendre en charge</button>
                )}
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
        {shown.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>{tab === "en-cours" ? "Aucune plainte en cours." : "Aucune plainte archivée."}</div>}
      </div>
    </div>
  );
}

function CodePenalPage({ current, codePenal, onAdd, onUpdate, onDelete }) {
  const isAdmin = !!current.isAdmin;
  const blank = { type: "Contravention", classe: "", nom: "", article: "", amende: "", tempsGav: "" };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!form.nom.trim()) return;
    const data = { ...form, amende: form.amende ? Number(form.amende) : "" };
    if (editingId) { onUpdate(editingId, data); setEditingId(null); } else { onAdd(data); }
    setForm(blank);
  }
  function startEdit(a) {
    setEditingId(a.id);
    setForm({ type: a.type, classe: a.classe || "", nom: a.nom, article: a.article || "", amende: a.amende || "", tempsGav: a.tempsGav || "" });
  }
  const s = search.trim().toLowerCase();
  const filtered = codePenal.filter((a) => !s || a.nom.toLowerCase().includes(s));
  const groups = {};
  filtered.forEach((a) => {
    const key = a.type + (a.classe ? " — " + a.classe : "");
    groups[key] = groups[key] || [];
    groups[key].push(a);
  });
  Object.keys(groups).forEach((k) => groups[k].sort((a, b) => (Number(a.amende) || 0) - (Number(b.amende) || 0)));
  const TYPE_SORT_ORDER = { Contravention: 0, Délit: 1, Crime: 2 };
  const groupKeys = Object.keys(groups).sort((a, b) => {
    const typeA = a.split(" — ")[0], typeB = b.split(" — ")[0];
    const orderA = TYPE_SORT_ORDER[typeA] ?? 99, orderB = TYPE_SORT_ORDER[typeB] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  return (
    <div>
      <h2 style={h2Style}>Code Pénal</h2>

      {isAdmin && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier l'article" : "Ajouter un article"}</div>
          <form onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={TYPES_INFRACTION} />
              <Field label="Classe / précision (facultatif)" value={form.classe} onChange={(v) => setForm({ ...form, classe: v })} placeholder="Ex : Classe 3" />
            </div>
            <Field label="Nom de l'infraction" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
            <Field label="Référence légale (facultatif)" value={form.article} onChange={(v) => setForm({ ...form, article: v })} placeholder="Ex : art. R412-30 C. route" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Amende (€)" type="number" value={form.amende} onChange={(v) => setForm({ ...form, amende: v })} />
              <Field label="Temps de GAV" value={form.tempsGav} onChange={(v) => setForm({ ...form, tempsGav: v })} placeholder="Ex : 3 jours" />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>{editingId ? "Enregistrer" : "Ajouter"}</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#123A7A", border: "1px solid #123A7A" }}>Annuler</button>}
            </div>
          </form>
        </div>
      )}

      <div style={{ maxWidth: 320, marginBottom: 16 }}>
        <Field label="Filtrer" value={search} onChange={setSearch} placeholder="Ex : stationnement, vitesse..." />
      </div>
      {groupKeys.map((g) => (
        <div key={g} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>{g}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {groups[g].map((a) => (
              <div key={a.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.18)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nom}</div>
                  {a.article && <div style={{ fontSize: 11, color: "#5A6B84" }}>{a.article}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right", fontSize: 12, color: "#3A4D6B" }}>
                    {a.amende ? `${a.amende} crédits` : ""}{a.amende && a.tempsGav ? " — " : ""}{a.tempsGav}
                  </div>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startEdit(a)} style={smallBtn}>Modifier</button>
                      <button onClick={() => onDelete(a.id)} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Suppr.</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {groupKeys.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune infraction enregistrée.</div>}
    </div>
  );
}

function CasierPage({ current, casier, codePenal, onAdd, onUpdateMention, onDeleteMention }) {
  const canModify = current.isAdmin || (current.qualifications || []).includes("OPJ");
  const blank = { pseudoRoblox: "", robloxUsername: "", nom: "", prenom: "", nature: "", dateFaits: "", amende: "", tempsGav: "", remarques: "" };
  const [form, setForm] = useState(blank);
  const [roblox, setRoblox] = useState(null); // compte Roblox vérifié { id, username, displayName, imageUrl, cle }
  const [verifBusy, setVerifBusy] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // { dossierId, mentionId }
  const [editForm, setEditForm] = useState(blank);
  const [showCodePenal, setShowCodePenal] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [articleSearch, setArticleSearch] = useState("");

  const cleSaisie = `${form.pseudoRoblox.trim()}|${form.robloxUsername.trim().replace(/^@/, "")}`;
  const verifieOk = !!roblox && roblox.cle === cleSaisie;
  const existingDossier = verifieOk
    ? casier.find((d) => d.robloxId === roblox.id)
      || casier.find((d) => !d.robloxId && [roblox.displayName, roblox.username].some((v) => (d.pseudoRoblox || "").trim().toLowerCase() === v.trim().toLowerCase()))
    : null;

  const [error, setError] = useState("");

  function toggleArticle(id) {
    setSelectedArticleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applySelection() {
    const selected = codePenal.filter((a) => selectedArticleIds.includes(a.id));
    if (selected.length === 0) return;
    const totalAmende = selected.reduce((s, a) => s + (Number(a.amende) || 0), 0);
    // Le temps de GAV ne s'additionne jamais : on retient seulement le plus élevé de la sélection.
    function minutesDe(str) {
      const m = String(str || "").match(/(\d+)/);
      return m ? Number(m[1]) : 0;
    }
    let pireTempsGav = "";
    let pireMinutes = -1;
    selected.forEach((a) => {
      const mins = minutesDe(a.tempsGav);
      if (mins > pireMinutes) { pireMinutes = mins; pireTempsGav = a.tempsGav || ""; }
    });
    const nature = selected.map((a) => a.nom).join(", ");
    setForm((f) => ({ ...f, nature, amende: totalAmende ? String(totalAmende) : f.amende, tempsGav: pireTempsGav || f.tempsGav }));
    setShowCodePenal(false);
  }

  const filteredArticles = codePenal.filter((a) => !articleSearch.trim() || a.nom.toLowerCase().includes(articleSearch.trim().toLowerCase()));

  // Vérifie que le pseudo et l'@ correspondent bien au même compte Roblox
  async function verifierRoblox() {
    const at = form.robloxUsername.trim().replace(/^@/, "");
    const pseudo = form.pseudoRoblox.trim();
    if (!pseudo || !at) { setRoblox(null); setError("Renseigne le pseudo ET l'@ exact du joueur : ils servent à retrouver son compte Roblox."); return null; }
    setVerifBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/roblox-head?pseudo=${encodeURIComponent(at)}`);
      const j = await r.json();
      if (!j.id) { setRoblox(null); setError(j.message || "Compte Roblox introuvable."); return null; }
      if (j.displayName && j.displayName.trim().toLowerCase() !== pseudo.toLowerCase()) {
        setRoblox(null);
        setError(`Le compte @${j.nom} s'appelle « ${j.displayName} » sur Roblox, pas « ${pseudo} ». Vérifie le pseudo.`);
        return null;
      }
      const res = { id: String(j.id), username: j.nom, displayName: j.displayName || pseudo, imageUrl: j.imageUrl || "", cle: `${pseudo}|${at}` };
      setRoblox(res);
      return res;
    } catch (e) { setRoblox(null); setError("Roblox ne répond pas, réessaie dans un instant."); return null; }
    finally { setVerifBusy(false); }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.nature.trim()) { setError("La nature de l'infraction est obligatoire."); return; }
    const rb = verifieOk ? roblox : await verifierRoblox();
    if (!rb) return;
    const dossier = casier.find((d) => d.robloxId === rb.id)
      || casier.find((d) => !d.robloxId && [rb.displayName, rb.username].some((v) => (d.pseudoRoblox || "").trim().toLowerCase() === v.trim().toLowerCase()));
    setError("");
    onAdd({ ...form, pseudoRoblox: rb.displayName, robloxUsername: rb.username, robloxId: rb.id });
    setConfirmMsg(dossier ? `Mention ajoutée au casier existant de ${rb.displayName} (@${rb.username}).` : `Nouveau casier créé pour ${rb.displayName} (@${rb.username}).`);
    setForm(blank);
    setRoblox(null);
    setSelectedArticleIds([]);
    setTimeout(() => setConfirmMsg(""), 4000);
  }

  function startEdit(dossierId, m) {
    setEditing({ dossierId, mentionId: m.id });
    setEditForm({ nature: m.nature, dateFaits: m.dateFaits || "", amende: m.amende || "", tempsGav: m.tempsGav || "", remarques: m.remarques || "" });
  }
  function submitEdit(e) {
    e.preventDefault();
    onUpdateMention(editing.dossierId, editing.mentionId, editForm);
    setEditing(null);
  }

  // Aplatit tous les dossiers/mentions pour l'affichage, filtré par pseudo
  const flat = casier
    .filter((d) => `${d.pseudoRoblox || ""} ${d.robloxUsername || ""} ${d.nom || ""} ${d.prenom || ""}`.toLowerCase().includes(search.trim().toLowerCase().replace(/^@/, "")))
    .flatMap((d) => d.mentions.map((m) => ({ dossier: d, mention: m })))
    .sort((a, b) => new Date(a.mention.createdAt) - new Date(b.mention.createdAt));

  const avatars = useAvatars(flat.map(({ dossier }) => dossier.robloxId));

  return (
    <div>
      <h2 style={h2Style}>Casier judiciaire</h2>

      <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Ajouter une mention</div>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Pseudo Roblox (nom affiché)" value={form.pseudoRoblox} onChange={(v) => setForm({ ...form, pseudoRoblox: v })} />
            <Field label="@ Roblox (nom d'utilisateur exact)" value={form.robloxUsername} onChange={(v) => setForm({ ...form, robloxUsername: v })} placeholder="Ex : @MonPseudo" />
            <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => setForm({ ...form, dateFaits: v })} />
            <Field label="Nom (si connu)" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
            <Field label="Prénom (si connu)" value={form.prenom} onChange={(v) => setForm({ ...form, prenom: v })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "0 0 14px" }}>
            <button type="button" onClick={verifierRoblox} disabled={verifBusy} style={smallBtn}>{verifBusy ? "Vérification…" : "Vérifier le compte Roblox"}</button>
            {verifieOk && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar src={roblox.imageUrl} taille={48} />
                <div style={{ fontSize: 12 }}>
                  <div><b>{roblox.displayName}</b> · @{roblox.username} ✅</div>
                  <div style={{ color: existingDossier ? "#2F6FDE" : "#2E7D4F", marginTop: 2 }}>
                    {existingDossier ? "Un casier existe déjà pour ce compte : cette entrée s'y ajoutera." : "Aucun casier existant pour ce compte : un nouveau sera créé."}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <button type="button" onClick={() => setShowCodePenal((s) => !s)} style={{ ...smallBtn, background: "#2F6FDE", color: "#14213A" }}>
              📖 {showCodePenal ? "Fermer le code pénal" : "Choisir dans le code pénal"}
            </button>
            {showCodePenal && (
              <div style={{ marginTop: 10, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 14, maxHeight: 280, overflowY: "auto" }}>
                <Field label="Filtrer" value={articleSearch} onChange={setArticleSearch} placeholder="Ex : vitesse, vol..." />
                {codePenal.length === 0 && <div style={{ fontSize: 12, color: "#5A6B84" }}>Aucun article enregistré — demande à un admin d'importer/ajouter le code pénal.</div>}
                {filteredArticles.map((a) => (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 0" }}>
                    <input type="checkbox" checked={selectedArticleIds.includes(a.id)} onChange={() => toggleArticle(a.id)} />
                    <span style={{ flex: 1 }}>{a.nom} <span style={{ color: "#5A6B84" }}>({a.type}{a.classe ? " " + a.classe : ""})</span></span>
                    <span style={{ color: "#5A6B84" }}>{a.amende ? `${a.amende}€` : ""}</span>
                  </label>
                ))}
                {selectedArticleIds.length > 0 && (
                  <button type="button" onClick={applySelection} style={{ ...smallBtn, background: "#123A7A", color: "#fff", marginTop: 10 }}>
                    Appliquer la sélection ({selectedArticleIds.length})
                  </button>
                )}
              </div>
            )}
          </div>
          <Field label="Nature de l'infraction" value={form.nature} onChange={(v) => setForm({ ...form, nature: v })} placeholder="Décris librement l'infraction" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Amende" value={form.amende} onChange={(v) => setForm({ ...form, amende: v })} placeholder="Ex : 500 crédits" />
            <Field label="Temps de GAV" value={form.tempsGav} onChange={(v) => setForm({ ...form, tempsGav: v })} placeholder="Ex : 3 jours" />
          </div>
          <Field label="Remarques (facultatif)" textarea value={form.remarques} onChange={(v) => setForm({ ...form, remarques: v })} />
          {error && <div style={{ color: "#C0172D", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {confirmMsg && <div style={{ color: "#2E7D4F", fontSize: 12, marginBottom: 10 }}>{confirmMsg}</div>}
          <button className="gh-btn-anim" type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Enregistrer la mention</button>
        </form>
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>
        Historique des casiers ({flat.length}){!canModify && " — lecture seule"}
      </div>
      <div style={{ marginBottom: 14, maxWidth: 320 }}>
        <Field label="Filtrer par pseudo ou @" value={search} onChange={setSearch} placeholder="Tape un pseudo ou un @" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flat.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune mention enregistrée.</div>}
        {flat.slice().reverse().map(({ dossier, mention: m }) =>
          editing && editing.dossierId === dossier.id && editing.mentionId === m.id ? (
            <form key={m.id} onSubmit={submitEdit} style={{ background: "#fff", border: "1px solid #123A7A", borderRadius: 8, padding: 12 }}>
              <Field label="Nature de l'infraction" value={editForm.nature} onChange={(v) => setEditForm({ ...editForm, nature: v })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Date des faits" type="date" value={editForm.dateFaits} onChange={(v) => setEditForm({ ...editForm, dateFaits: v })} />
                <Field label="Amende" value={editForm.amende} onChange={(v) => setEditForm({ ...editForm, amende: v })} />
                <Field label="Temps de GAV" value={editForm.tempsGav} onChange={(v) => setEditForm({ ...editForm, tempsGav: v })} />
              </div>
              <Field label="Remarques" textarea value={editForm.remarques} onChange={(v) => setEditForm({ ...editForm, remarques: v })} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" style={{ ...smallBtn, background: "#123A7A", color: "#fff" }}>Enregistrer</button>
                <button type="button" onClick={() => setEditing(null)} style={smallBtn}>Annuler</button>
              </div>
            </form>
          ) : (
            <div key={m.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {dossier.robloxId && <Avatar src={avatars[dossier.robloxId]} taille={44} />}
                <div>
                  <b style={{ fontSize: 13 }}>{dossier.pseudoRoblox}</b>
                  {dossier.robloxUsername && <span style={{ fontSize: 12, color: "#5A6B84" }}> · @{dossier.robloxUsername}</span>}
                  {(dossier.nom || dossier.prenom) && <span style={{ fontSize: 12, color: "#5A6B84" }}> — {dossier.prenom} {dossier.nom}</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 4 }}>{m.nature} — {m.dateFaits || "date non précisée"}</div>
              <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 2 }}>
                {m.amende && `Amende : ${m.amende}`}{m.amende && m.tempsGav ? " — " : ""}{m.tempsGav && `Temps de GAV : ${m.tempsGav}`}
                {!m.amende && !m.tempsGav && "Peine non précisée"}
              </div>
              {m.remarques && <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 4 }}>{m.remarques}</div>}
              <div style={{ fontSize: 11, color: "#2F6FDE", marginTop: 6 }}>Agent verbalisateur : {m.gendarmeNom} ({m.gendarmeMatricule})</div>
              {canModify && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => startEdit(dossier.id, m)} style={smallBtn}>Modifier</button>
                  <button onClick={() => onDeleteMention(dossier.id, m.id)} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Supprimer</button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function AdminPlaintesGendarmes({ plaintes, current, onUpdateStatut, onTakeCharge }) {
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

/* ---------- Comptes rendus internes à l'attention de l'IGGN / DGGN ---------- */

const DESTINATAIRES_CR = [UNITE_ENC, UNITE_CMD];

function modeleContenu() {
  return `J'ai l'honneur de vous rendre compte des faits suivants, le ../../.... à ..h.. :

[Décrivez ici le déroulement des faits]

De retour à la brigade territoriale de Gendarmerie de Black RP et à la demande de ma hiérarchie, j'ai rédigé ce présent rapport.`;
}

/* ---------- Mes avis (gendarme connecté, lecture seule) ---------- */

function MesAvisPage({ current, avisGendarmes, personnel }) {
  const mine = avisGendarmes.filter((a) => {
    const id = (a.cibleIdentifiant || "").trim().toLowerCase();
    return id && (id === (current.pseudoRoblox || "").trim().toLowerCase() || id === (current.pseudoDiscord || "").trim().toLowerCase());
  });
  const moyenne = mine.length ? (mine.reduce((s, a) => s + a.note, 0) / mine.length).toFixed(1) : null;

  // Regroupe tous les avis par personne visée, pour que chacun voie les avis de tout le personnel.
  function nomPour(identifiant) {
    const id = identifiant.trim().toLowerCase();
    const p = personnel.find((per) => (per.pseudoRoblox || "").trim().toLowerCase() === id || (per.pseudoDiscord || "").trim().toLowerCase() === id);
    return p ? `${p.prenom} ${p.nom}` : identifiant;
  }
  const parPersonne = {};
  avisGendarmes.forEach((a) => {
    const key = (a.cibleIdentifiant || "?").trim().toLowerCase();
    parPersonne[key] = parPersonne[key] || { nom: nomPour(a.cibleIdentifiant || "?"), avis: [] };
    parPersonne[key].avis.push(a);
  });

  return (
    <div>
      <h2 style={h2Style}>Avis du personnel</h2>

      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>Mes avis</div>
        {!current.pseudoRoblox && !current.pseudoDiscord && (
          <div style={{ fontSize: 12, color: "#C0172D", marginBottom: 16 }}>Aucun pseudo Roblox/Discord enregistré sur ton compte — demande à un admin de le renseigner pour que les avis te soient attribués.</div>
        )}
        {moyenne && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <StarRating value={Math.round(moyenne)} readOnly />
            <span style={{ fontSize: 14, fontWeight: 700 }}>{moyenne} / 5</span>
            <span style={{ fontSize: 12, color: "#5A6B84" }}>({mine.length} avis)</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mine.slice().reverse().map((a) => (
            <div key={a.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
              <StarRating value={a.note} readOnly />
              {a.commentaire && <div style={{ fontSize: 13, color: "#3A4D6B", marginTop: 6 }}>{a.commentaire}</div>}
            </div>
          ))}
          {mine.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun avis reçu pour l'instant.</div>}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>Avis sur tout le personnel ({avisGendarmes.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Object.values(parPersonne).map((grp, i) => {
            const moy = (grp.avis.reduce((s, a) => s + a.note, 0) / grp.avis.length).toFixed(1);
            return (
              <div key={i} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <b style={{ fontSize: 13 }}>{grp.nom}</b>
                  <StarRating value={Math.round(moy)} readOnly />
                  <span style={{ fontSize: 12, color: "#5A6B84" }}>{moy} / 5 ({grp.avis.length})</span>
                </div>
                {grp.avis.slice().reverse().map((a) => a.commentaire && (
                  <div key={a.id} style={{ fontSize: 12, color: "#3A4D6B", marginTop: 4 }}>« {a.commentaire} »</div>
                ))}
              </div>
            );
          })}
          {avisGendarmes.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun avis enregistré pour l'instant.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Avis généraux (tous les gendarmes) + suggestions (DGGN uniquement) ---------- */

function AvisSuggestionsPage({ current, avisGeneraux, suggestions }) {
  const canSeeSuggestions = current.isAdmin || estCommandement(current.unite);
  const moyenne = avisGeneraux.length ? (avisGeneraux.reduce((s, a) => s + a.note, 0) / avisGeneraux.length).toFixed(1) : null;

  return (
    <div>
      <h2 style={h2Style}>Avis & Suggestions</h2>

      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>Avis sur la Gendarmerie ({avisGeneraux.length})</div>
        {moyenne && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <StarRating value={Math.round(moyenne)} readOnly />
            <span style={{ fontSize: 14, fontWeight: 700 }}>{moyenne} / 5</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {avisGeneraux.slice().reverse().map((a) => (
            <div key={a.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
              <StarRating value={a.note} readOnly />
              {a.commentaire && <div style={{ fontSize: 13, color: "#3A4D6B", marginTop: 6 }}>{a.commentaire}</div>}
            </div>
          ))}
          {avisGeneraux.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun avis pour l'instant.</div>}
        </div>
      </div>

      {canSeeSuggestions ? (
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>Suggestions ({suggestions.length}) — réservé au Corps de Commandement</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.slice().reverse().map((s) => (
              <div key={s.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
                <div style={{ fontSize: 13, color: "#14213A" }}>{s.texte}</div>
              </div>
            ))}
            {suggestions.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune suggestion pour l'instant.</div>}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#5A6B84" }}>Les suggestions sont réservées au Corps de Commandement.</div>
      )}
    </div>
  );
}

/* ---------- Sanctions disciplinaires (Commandant et grades supérieurs) ---------- */

const SANCTION_TYPES = [
  { type: "Mise en garde", defaultDuree: 3 },
  { type: "Avertissement 1", defaultDuree: 7 },
  { type: "Avertissement 2", defaultDuree: 14 },
  { type: "Mise à pied", defaultDuree: 7 },
];

function SanctionsPage({ current, personnel, sanctions, onIssue }) {
  const canIssue = current.isAdmin || current.gradeRank >= DISCIPLINE_MIN_INDEX;
  const cibles = personnel.filter((p) => p.id !== current.id && (p.gradeRank ?? GRADES.indexOf(p.grade)) < (current.gradeRank ?? GRADES.indexOf(current.grade)));

  const blank = { matricule: "", type: SANCTION_TYPES[0].type, dureeJours: SANCTION_TYPES[0].defaultDuree, motif: "" };
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    const target = personnel.find((p) => p.matricule === form.matricule);
    if (!target || !form.motif.trim()) return;
    const res = await onIssue({ ...form, nomCible: `${target.prenom} ${target.nom}` });
    if (res.ok) { setMsg("Sanction enregistrée."); setForm(blank); setTimeout(() => setMsg(""), 4000); }
  }

  const now = new Date();
  const actives = sanctions.filter((s) => new Date(s.dateFin) > now).sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));
  const expirees = sanctions.filter((s) => new Date(s.dateFin) <= now).sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));

  return (
    <div>
      <h2 style={h2Style}>Sanctions disciplinaires</h2>

      {canIssue && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Émettre une sanction</div>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Personnel visé</label>
              <select value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} style={selectStyle}>
                <option value="">— Choisir —</option>
                {cibles.map((p) => <option key={p.id} value={p.matricule}>{p.prenom} {p.nom} ({p.grade})</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Type de sanction</label>
              <select
                value={form.type}
                onChange={(e) => { const t = SANCTION_TYPES.find((x) => x.type === e.target.value); setForm({ ...form, type: e.target.value, dureeJours: t.defaultDuree }); }}
                style={selectStyle}
              >
                {SANCTION_TYPES.map((t) => <option key={t.type} value={t.type}>{t.type}</option>)}
              </select>
            </div>
            <Field label="Durée (jours)" type="number" value={form.dureeJours} onChange={(v) => setForm({ ...form, dureeJours: v })} />
            <Field label="Motif" textarea value={form.motif} onChange={(v) => setForm({ ...form, motif: v })} />
            {msg && <div style={{ color: "#2E7D4F", fontSize: 12, marginBottom: 10 }}>{msg}</div>}
            <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Émettre</button>
          </form>
        </div>
      )}

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>Sanctions actives ({actives.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {actives.map((s) => (
          <div key={s.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: "4px solid #C0172D", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{s.type} — {s.nomCible} ({s.matricule})</div>
            <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 4 }}>{s.motif}</div>
            <div style={{ fontSize: 11, color: "#5A6B84", marginTop: 4 }}>Jusqu'au {new Date(s.dateFin).toLocaleString("fr-FR")} — émis par {s.emisParNom}</div>
          </div>
        ))}
        {actives.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune sanction active.</div>}
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>Historique (expirées)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {expirees.map((s) => (
          <div key={s.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "12px 16px", opacity: 0.6 }}>
            <div style={{ fontSize: 12 }}>{s.type} — {s.nomCible} ({s.matricule}) — expirée le {new Date(s.dateFin).toLocaleDateString("fr-FR")}</div>
          </div>
        ))}
        {expirees.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun historique.</div>}
      </div>
    </div>
  );
}

/* ---------- Promotions / rétrogradations ---------- */

function PromotionsPage({ current, personnel, promotions, onIssue }) {
  const canIssue = current.isAdmin || current.gradeRank >= DISCIPLINE_MIN_INDEX;
  const currentRank = current.gradeRank ?? GRADES.indexOf(current.grade);
  const cibles = personnel.filter((p) => p.id !== current.id && (p.gradeRank ?? GRADES.indexOf(p.grade)) < currentRank);
  const gradesDisponibles = GRADES.filter((g) => GRADES.indexOf(g) < currentRank);

  const [matricule, setMatricule] = useState("");
  const [nouveauGrade, setNouveauGrade] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    const target = personnel.find((p) => p.matricule === matricule);
    if (!target || !nouveauGrade) return;
    const res = await onIssue(target, nouveauGrade);
    if (res.ok) { setMsg("Grade mis à jour."); setMatricule(""); setNouveauGrade(""); setTimeout(() => setMsg(""), 4000); }
  }

  return (
    <div>
      <h2 style={h2Style}>Promotions & Rétrogradations</h2>

      {canIssue && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Changer le grade d'un subordonné</div>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Personnel visé</label>
              <select value={matricule} onChange={(e) => setMatricule(e.target.value)} style={selectStyle}>
                <option value="">— Choisir —</option>
                {cibles.map((p) => <option key={p.id} value={p.matricule}>{p.prenom} {p.nom} ({p.grade})</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Nouveau grade</label>
              <select value={nouveauGrade} onChange={(e) => setNouveauGrade(e.target.value)} style={selectStyle}>
                <option value="">— Choisir —</option>
                {gradesDisponibles.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            {msg && <div style={{ color: "#2E7D4F", fontSize: 12, marginBottom: 10 }}>{msg}</div>}
            <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Valider</button>
          </form>
        </div>
      )}

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>Historique</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {promotions.slice().reverse().map((p) => (
          <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `4px solid ${p.type === "Promotion" ? "#2E7D4F" : "#C0172D"}`, borderRadius: 10, padding: "12px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{p.type === "Promotion" ? "⬆️" : "⬇️"} {p.nomCible}</div>
            <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 2 }}>{p.ancienGrade} → {p.nouveauGrade}</div>
            <div style={{ fontSize: 11, color: "#5A6B84", marginTop: 4 }}>Par {p.emisParNom} — {new Date(p.createdAt).toLocaleDateString("fr-FR")}</div>
          </div>
        ))}
        {promotions.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun mouvement de grade enregistré.</div>}
      </div>
    </div>
  );
}

/* ---------- Journal d'activité (admin) ---------- */

function LogsPage({ logs }) {
  return (
    <div>
      <h2 style={h2Style}>Journal d'activité</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {logs.slice().reverse().slice(0, 200).map((l) => (
          <div key={l.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
            <span style={{ color: "#5A6B84" }}>{new Date(l.timestamp).toLocaleString("fr-FR")}</span> — <b>{l.auteurNom}</b> ({l.auteurMatricule}) : {l.action}{l.details ? ` — ${l.details}` : ""}
          </div>
        ))}
        {logs.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune activité enregistrée.</div>}
      </div>
    </div>
  );
}

function CompteRenduPage({ current, comptesRendus, onAdd, onMarkTraite }) {
  const canConsult = current.isAdmin || estCorps(current.unite);
  const [monNumero, setMonNumero] = useState(null);
  const [tab, setTab] = useState("en-cours");
  const blank = { destinataire: DESTINATAIRES_CR[0], objet: "", contenu: "" };
  const [form, setForm] = useState(blank);
  const [confirmMsg, setConfirmMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadMonCompte() {
      try {
        const snap = await getDocs(query(collection(db, "comptes_rendus"), where("auteurMatricule", "==", current.matricule)));
        if (!cancelled) setMonNumero(snap.size + 1);
      } catch (e) {
        console.error(e);
        if (!cancelled) setMonNumero(1);
      }
    }
    loadMonCompte();
    return () => { cancelled = true; };
  }, [current.matricule]);

  useEffect(() => {
    if (monNumero !== null) {
      const numeroFormate = String(monNumero).padStart(3, "0");
      setForm((f) => (f.objet ? f : { ...f, objet: `Rapport d'intervention N°${numeroFormate}`, contenu: modeleContenu() }));
    }
  }, [monNumero]);

  function submit(e) {
    e.preventDefault();
    if (!form.objet || !form.contenu) return;
    onAdd(form);
    const next = (monNumero || 1) + 1;
    setMonNumero(next);
    setForm({ destinataire: form.destinataire, objet: `Rapport d'intervention N°${String(next).padStart(3, "0")}`, contenu: modeleContenu() });
    setConfirmMsg("Compte rendu envoyé à " + form.destinataire + ".");
    setTimeout(() => setConfirmMsg(""), 4000);
  }

  const enCours = comptesRendus.filter((cr) => !cr.traite);
  const archives = comptesRendus.filter((cr) => cr.traite);
  const shown = tab === "en-cours" ? enCours : archives;

  return (
    <div>
      <h2 style={h2Style}>Comptes rendus</h2>

      <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Rédiger un compte rendu</div>
        <form onSubmit={submit}>
          <Select label="Destinataire" value={form.destinataire} onChange={(v) => setForm({ ...form, destinataire: v })} options={DESTINATAIRES_CR} />
          <Field label="Objet" value={form.objet} onChange={(v) => setForm({ ...form, objet: v })} />
          <Field label="Contenu" textarea value={form.contenu} onChange={(v) => setForm({ ...form, contenu: v })} />
          {confirmMsg && <div style={{ color: "#2E7D4F", fontSize: 12, marginBottom: 10 }}>{confirmMsg}</div>}
          <button className="gh-btn-anim" type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Envoyer</button>
        </form>
      </div>

      {canConsult ? (
        <div>
          <ArchiveTabs tab={tab} setTab={setTab} countEnCours={enCours.length} countArchivees={archives.length} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shown.slice().reverse().map((cr) => (
              <div key={cr.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <b style={{ fontSize: 13 }}>{cr.objet}</b>
                  <span style={{ fontSize: 11, color: "#5A6B84" }}>À : {cr.destinataire}</span>
                </div>
                <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 4, whiteSpace: "pre-wrap" }}>{cr.contenu}</div>
                <div style={{ fontSize: 11, color: "#2F6FDE", marginTop: 6 }}>Rédigé par {cr.auteurNom} ({cr.auteurMatricule})</div>
                {!cr.traite && <button onClick={() => onMarkTraite(cr.id)} style={{ ...smallBtn, marginTop: 10, background: "#123A7A", color: "#fff" }}>Marquer comme traité</button>}
              </div>
            ))}
            {shown.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>{tab === "en-cours" ? "Aucun compte rendu en cours." : "Aucun compte rendu archivé."}</div>}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#5A6B84" }}>La consultation des comptes rendus est réservée au Corps d'Encadrement et au Corps de Commandement.</div>
      )}
    </div>
  );
}

function NotesServicePanel({ current, notesService, onCreate, onDelete }) {
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!titre.trim() || !contenu.trim()) return;
    onCreate({ titre: titre.trim(), contenu: contenu.trim() });
    setTitre(""); setContenu("");
  }

  return (
    <div>
      {current.isAdmin && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Publier une note de service</div>
          <form onSubmit={submit}>
            <Field label="Titre" value={titre} onChange={setTitre} />
            <Field label="Contenu" textarea value={contenu} onChange={setContenu} />
            <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Publier</button>
          </form>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {notesService.slice().reverse().map((n) => (
          <div key={n.id} style={{ background: "#EEF4FF", border: "1px solid #C9D8F0", borderLeft: "4px solid #2F6FDE", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>📌 {n.titre}</div>
              {current.isAdmin && <button onClick={() => onDelete(n.id)} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Retirer</button>}
            </div>
            <div style={{ fontSize: 13, color: "#3A4D6B", marginTop: 6, whiteSpace: "pre-wrap" }}>{n.contenu}</div>
            <div style={{ fontSize: 11, color: "#5A6B84", marginTop: 8 }}>{n.auteurNom} — {new Date(n.createdAt).toLocaleDateString("fr-FR")}</div>
          </div>
        ))}
        {notesService.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune note de service pour l'instant.</div>}
      </div>
    </div>
  );
}

function ReglementsPage({ current, reglements, onCreate, onUpdate, onDelete }) {
  const blank = { titre: "", contenu: "" };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [openId, setOpenId] = useState(null);

  function submit(e) {
    e.preventDefault();
    if (!form.titre.trim() || !form.contenu.trim()) return;
    if (editingId) { onUpdate(editingId, form); setEditingId(null); } else { onCreate(form); }
    setForm(blank);
  }
  function startEdit(r) {
    setEditingId(r.id);
    setForm({ titre: r.titre, contenu: r.contenu });
  }

  return (
    <div>
      <h2 style={h2Style}>Règlements</h2>

      {current.isAdmin && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier le règlement" : "Créer une case de règlement"}</div>
          <form onSubmit={submit}>
            <Field label="Titre" value={form.titre} onChange={(v) => setForm({ ...form, titre: v })} placeholder="Ex : Règlement intérieur" />
            <Field label="Contenu" textarea value={form.contenu} onChange={(v) => setForm({ ...form, contenu: v })} />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>{editingId ? "Enregistrer" : "Créer"}</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#123A7A", border: "1px solid #123A7A" }}>Annuler</button>}
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {reglements.map((r) => (
          <div key={r.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)", overflow: "hidden" }}>
            <button onClick={() => setOpenId(openId === r.id ? null : r.id)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 15, fontWeight: 700, color: "#14213A" }}>
              📘 {r.titre}
              <span style={{ fontSize: 13, color: "#5A6B84" }}>{openId === r.id ? "▲" : "▼"}</span>
            </button>
            {openId === r.id && (
              <div style={{ padding: "0 20px 20px" }}>
                <div style={{ fontSize: 13, color: "#3A4D6B", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.contenu}</div>
                {current.isAdmin && (
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button onClick={() => startEdit(r)} style={smallBtn}>Modifier</button>
                    <button onClick={() => onDelete(r.id)} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Supprimer</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {reglements.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun règlement pour l'instant.</div>}
      </div>
    </div>
  );
}

function RecrutementPanel({ recrutementOuvert, onToggle }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Statut du recrutement</div>
        <div style={{ fontSize: 12, color: "#5A6B84" }}>Affiché en gros sur la page d'accueil publique.</div>
      </div>
      <button onClick={onToggle} className="gh-btn-anim" style={{ ...smallBtn, background: recrutementOuvert ? "#2E7D4F" : "#C0172D", color: "#fff", padding: "8px 16px" }}>
        {recrutementOuvert ? "🟢 Ouvert — cliquer pour fermer" : "🔴 Fermé — cliquer pour ouvrir"}
      </button>
    </div>
  );
}

function AppInner() {
  const [view, setView] = useState("public"); // public | login | dashboard
  const [publicSection, setPublicSection] = useState("home"); // home | plainte | candidature | confirmation
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationDash, setConfirmationDash] = useState(null);

  const [personnel, setPersonnel] = useState([]);
  const [candidatures, setCandidatures] = useState([]);
  const [plaintes, setPlaintes] = useState([]);
  const [plaintesGendarmes, setPlaintesGendarmes] = useState([]);
  const [comptesRendus, setComptesRendus] = useState([]);
  const [casier, setCasier] = useState([]);
  const [codePenal, setCodePenal] = useState([]);
  const [logs, setLogs] = useState([]);
  const [avisGendarmes, setAvisGendarmes] = useState([]);
  const [avisGeneraux, setAvisGeneraux] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [notesService, setNotesService] = useState([]);
  const [reglements, setReglements] = useState([]);
  const [recrutementOuvert, setRecrutementOuvert] = useState(true);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [questionnaireId, setQuestionnaireId] = useState(null);
  const [pvs, setPvs] = useState([]);
  const [, setTickReglages] = useState(0);
  const [migrUnites, setMigrUnites] = useState([]);
  const [services, setServices] = useState([]);
  const [enService, setEnService] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [dashSection, setDashSection] = useState("dossier");
  const [saveError, setSaveError] = useState("");
  const [loginBlockedMsg, setLoginBlockedMsg] = useState("");

  // Charge les données visibles compte tenu des règles Firestore (les collections
  // restreintes reviendront vides pour un visiteur non autorisé, sans erreur).
  const loadAll = useCallback(async () => {
    const [p, c, pl, plg, cr, ca, cp, lg, ag, agn, sug, san, promo, rl, ns, rgl, pvl, svc, ens] = await Promise.all([
      loadCollection("personnel"),
      loadCollection("candidatures"),
      loadCollection("plaintes"),
      loadCollection("plaintes_gendarmes"),
      loadCollection("comptes_rendus"),
      loadCollection("casier"),
      loadCollection("code_penal"),
      loadCollection("logs"),
      loadCollection("avis_gendarmes"),
      loadCollection("avis_generaux"),
      loadCollection("suggestions"),
      loadCollection("sanctions"),
      loadCollection("promotions"),
      loadCollection("roles"),
      loadCollection("notes_service"),
      loadCollection("reglements"),
      loadCollection("pv"),
      loadCollection("services"),
      loadCollection("en_service"),
    ]);
    const pNorm = p.map((x) => (UNITE_ALIAS[x.unite] ? { ...x, unite: UNITE_ALIAS[x.unite] } : x));
    setMigrUnites(p.filter((x) => UNITE_ALIAS[x.unite]).map((x) => ({ id: x.id, unite: UNITE_ALIAS[x.unite] })));
    setPersonnel(pNorm); setCandidatures(c); setPlaintes(pl); setPlaintesGendarmes(plg); setComptesRendus(cr); setCasier(ca); setCodePenal(cp);
    setLogs(lg); setAvisGendarmes(ag); setAvisGeneraux(agn); setSuggestions(sug); setSanctions(san); setPromotions(promo); setRoles(rl);
    setNotesService(ns); setReglements(rgl); setPvs(pvl); setServices(svc); setEnService(ens);
    try {
      const snap = await getDoc(doc(db, "settings", "general"));
      if (snap.exists()) {
        setRecrutementOuvert(snap.data().recrutementOuvert !== false);
        setQuestionnaires(Array.isArray(snap.data().questionnaires) ? snap.data().questionnaires : []);
        appliquerReglages(snap.data());
        setTickReglages((t) => t + 1);
      }
    } catch (e) { /* visible par tous, pas d'erreur bloquante */ }
    return { personnel: pNorm, sanctions: san };
  }, []);

  // Écoute l'état de connexion Firebase Auth : reste connecté après un rafraîchissement,
  // sans jamais stocker de mot de passe côté navigateur.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      const { personnel: p, sanctions: san } = await loadAll();
      if (user) {
        const found = p.find((pers) => pers.id === user.uid);
        if (found) {
          const now = new Date();
          const miseAPied = san.find((s) => s.matricule === found.matricule && s.type === "Mise à pied" && new Date(s.dateFin) > now);
          if (miseAPied) {
            setCurrent(null);
            setLoginBlockedMsg(`Compte suspendu (mise à pied) jusqu'au ${new Date(miseAPied.dateFin).toLocaleString("fr-FR")}.`);
            try { await signOut(auth); } catch (e) {}
          } else {
            setCurrent(found);
            setView("dashboard");
          }
        } else {
          setCurrent(null);
          try { await signOut(auth); } catch (e) {}
        }
      } else {
        setCurrent(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [loadAll]);

  // Retour de la connexion Discord (jeton dans le # de l'adresse, ou message d'erreur)
  useEffect(() => {
    const dt = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("dt");
    const err = new URLSearchParams(window.location.search).get("discord_error");
    if (dt) {
      window.history.replaceState(null, "", window.location.pathname);
      signInWithCustomToken(auth, dt).catch((e) => { console.error(e); setLoginBlockedMsg("Connexion Discord impossible, réessaie."); setView("login"); });
    } else if (err) {
      window.history.replaceState(null, "", window.location.pathname);
      setLoginBlockedMsg(err);
      setView("login");
    }
  }, []);

  // Rafraîchit les qualités judiciaires depuis Discord quand on ouvre sa CIPC ou les cartes pro
  const derniereSync = useRef(0);
  useEffect(() => {
    if (!current || (dashSection !== "dossier" && dashSection !== "cartes-pro")) return;
    if (Date.now() - derniereSync.current < 60000) return;
    derniereSync.current = Date.now();
    syncQualites(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current && current.id, dashSection]);

  // Marqueur « en service » (lu par les règles Firebase pour autoriser la main courante)
  useEffect(() => {
    if (!current) return;
    const actif = services.find((s) => s.matricule === current.matricule && s.type !== "ajustement" && !s.fin);
    const marqueur = enService.some((e) => e.id === current.id);
    if (actif && !marqueur) {
      setDoc(doc(db, "en_service", current.id), { matricule: current.matricule, nom: `${current.prenom} ${current.nom}`, debut: actif.debut })
        .then(() => setEnService((prev) => [...prev, { id: current.id }])).catch((e) => console.error(e));
    } else if (!actif && marqueur) {
      deleteDoc(doc(db, "en_service", current.id))
        .then(() => setEnService((prev) => prev.filter((e) => e.id !== current.id))).catch((e) => console.error(e));
    }
  }, [current, services, enService]);

  // Migration automatique des anciens noms d'unités (DGGN/IGGN) par un administrateur
  useEffect(() => {
    if (!current || !current.isAdmin || migrUnites.length === 0) return;
    const aFaire = migrUnites;
    setMigrUnites([]);
    Promise.all(aFaire.map((m) => updateDoc(doc(db, "personnel", m.id), { unite: m.unite }))).catch((e) => console.error(e));
  }, [current, migrUnites]);

  // Lien direct vers un questionnaire : https://ton-site.vercel.app/?q=ID
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("q");
    if (id) { setQuestionnaireId(id); setPublicSection("questionnaire"); }
  }, []);

  async function refresh() {
    await loadAll();
  }

  // Journal d'activité : trace les actions importantes effectuées sur le site.
  async function logAction(action, details) {
    try {
      await addDoc(collection(db, "logs"), {
        timestamp: new Date().toISOString(),
        auteurMatricule: current ? current.matricule : "—",
        auteurNom: current ? `${current.prenom} ${current.nom}` : "Visiteur (civil)",
        action,
        details: details || "",
      });
    } catch (e) { console.error("Log échoué :", e); }
  }

  // Connexion
  async function handleLogin(username, password) {
    try {
      await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "Identifiants incorrects." };
    }
  }

  // Premier compte administrateur (à utiliser une seule fois)
  async function handleCreateFirstAdmin(data) {
    try {
      const uid = await createAuthUser(usernameToEmail(data.username), data.password);
      const profile = { matricule: nextRef([], "GH"), nom: data.nom, prenom: data.prenom, username: data.username, grade: "Colonel", gradeRank: GRADES.indexOf("Colonel"), unite: UNITE_CMD, fonction: "Directeur Général", qualifications: ["OPJ"], isAdmin: true };
      await setDoc(doc(db, "personnel", uid), profile);
      await signInWithEmailAndPassword(auth, usernameToEmail(data.username), data.password);
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false, error: e.message || "Erreur lors de la création du compte." };
    }
  }

  // Gestion du personnel (admin uniquement)
  async function handleCreatePersonnel(data) {
    try {
      const username = (data.username || "").trim();
      if (!username || !data.password) return { ok: false, error: "Identifiant et mot de passe obligatoires." };
      if (data.password.length < 6) return { ok: false, error: "Mot de passe trop court (6 caractères minimum)." };
      const rio = genererRIO(personnel);
      if (!rio) return { ok: false, error: "Plus de RIO disponible (100 agents maximum)." };
      const year = new Date().getFullYear();
      let n = personnel.length + 1;
      let matricule;
      do { matricule = `GH-${year}-${String(n++).padStart(4, "0")}`; } while (personnel.some((p) => p.matricule === matricule));
      const uid = await createAuthUser(usernameToEmail(username), data.password);
      const profile = {
        matricule, cipcNumero: rio, qualiteJudiciaire: data.qualiteJudiciaire || "APJA",
        nom: data.nom.trim(), prenom: data.prenom.trim(), username, pseudoRoblox: "", pseudoDiscord: "",
        grade: data.grade, gradeRank: GRADES.indexOf(data.grade), unite: data.unite, fonction: data.fonction || "", qualifications: [], isAdmin: false,
      };
      await setDoc(doc(db, "personnel", uid), profile);
      await setDoc(doc(db, "annuaire_public", uid), { prenom: profile.prenom, nom: profile.nom, pseudoRoblox: "", pseudoDiscord: "" });
      await refresh();
      logAction("Création de compte", `${profile.prenom} ${profile.nom} (RIO ${rio})`);
      return { ok: true };
    } catch (e) {
      console.error(e);
      const m = String(e.message || "");
      return { ok: false, error: m.includes("EMAIL_EXISTS") ? "Cet identifiant existe déjà." : m.includes("WEAK_PASSWORD") ? "Mot de passe trop court (6 caractères minimum)." : (m || "Erreur lors de la création du compte.") };
    }
  }
  // Attribue un RIO à tous les agents qui n'en ont pas encore
  async function handleAssignRIO() {
    try {
      const manque = personnel.filter((p) => !p.cipcNumero);
      const nouveaux = {};
      for (const p of manque) {
        const n = genererRIO(personnel, Object.values(nouveaux));
        if (!n) break;
        nouveaux[p.id] = n;
      }
      await Promise.all(Object.entries(nouveaux).map(([id, n]) => updateDoc(doc(db, "personnel", id), { cipcNumero: n })));
      await refresh();
      logAction("RIO", `${Object.keys(nouveaux).length} RIO attribué(s)`);
      return Object.keys(nouveaux).length;
    } catch (e) { console.error(e); return -1; }
  }
  async function handleUpdatePersonnel(id, data) {
    try {
      const { password, username, ...profile } = data;
      const avant = personnel.find((p) => p.id === id);
      await updateDoc(doc(db, "personnel", id), profile);
      if (avant && avant.grade !== profile.grade) {
        syncGradeDiscord(id).then((j) => { if (j && j.alerte) setSaveError("Grade modifié sur le site, mais Discord : " + j.message); });
      }
      await setDoc(doc(db, "annuaire_public", id), { prenom: profile.prenom, nom: profile.nom, pseudoRoblox: profile.pseudoRoblox || "", pseudoDiscord: profile.pseudoDiscord || "" });
      if (current?.id === id) setCurrent({ ...current, ...profile });
      await refresh();
      logAction("Modification de compte", `${profile.prenom} ${profile.nom} (${profile.matricule})`);
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false, error: "Erreur lors de la mise à jour." };
    }
  }
  async function handleDeletePersonnel(id) {
    if (id === current?.id) return;
    const target = personnel.find((p) => p.id === id);
    try {
      await deleteDoc(doc(db, "personnel", id));
      try { await deleteDoc(doc(db, "annuaire_public", id)); } catch (e) {}
      await refresh();
      logAction("Suppression de compte", target ? `${target.prenom} ${target.nom} (${target.matricule})` : id);
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  // Candidatures (GAV publique, SOG/Officier internes)
  async function handleSubmitCandidature(data, auteur) {
    const ref = nextRef(candidatures, "CD");
    const nomAuteur = auteur ? `${auteur.prenom} ${auteur.nom}` : "";
    const c = { ref, statut: "En attente", createdAt: new Date().toISOString(), auteurMatricule: auteur ? auteur.matricule : null, ...data, displayName: data.displayName === "Candidat" && nomAuteur ? nomAuteur : data.displayName };
    try {
      const docRef = await addDoc(collection(db, "candidatures"), c);
      setCandidatures([...candidatures, { id: docRef.id, ...c }]);
      notifierDiscord("candidature", `${c.displayName} — ${c.poste} (${ref})`);
      const conf = { title: "Candidature envoyée", message: "Ta candidature a bien été transmise à l'administration. Tu seras recontacté via Discord.", refNumber: ref };
      if (auteur) setConfirmationDash(conf);
      else { setConfirmation(conf); setPublicSection("confirmation"); }
    } catch (e) { console.error(e); setSaveError("Échec de l'envoi, réessaie."); }
  }
  async function handleUpdateCandidatureStatut(id, statut) {
    try {
      await updateDoc(doc(db, "candidatures", id), { statut });
      setCandidatures(candidatures.map((c) => (c.id === id ? { ...c, statut } : c)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }

  // Plaintes (publiques)
  async function handleSubmitPlainte(data) {
    const ref = nextRef(plaintes, "PL");
    const p = { ref, statut: "En attente", createdAt: new Date().toISOString(), ...data };
    try {
      const docRef = await addDoc(collection(db, "plaintes"), p);
      setPlaintes([...plaintes, { id: docRef.id, ...p }]);
      setConfirmation({ title: "Plainte enregistrée", message: "Ta plainte a bien été transmise à la gendarmerie. Un gendarme la traitera prochainement.", refNumber: ref });
      setPublicSection("confirmation");
    } catch (e) { console.error(e); setSaveError("Échec de l'envoi, réessaie."); }
  }
  async function handleUpdatePlainteStatut(id, statut) {
    try {
      await updateDoc(doc(db, "plaintes", id), { statut });
      setPlaintes(plaintes.map((p) => (p.id === id ? { ...p, statut } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleTakeChargePlainte(id) {
    const data = { prisEnChargeMatricule: current.matricule, prisEnChargeNom: `${current.prenom} ${current.nom}` };
    try {
      await updateDoc(doc(db, "plaintes", id), data);
      setPlaintes(plaintes.map((p) => (p.id === id ? { ...p, ...data } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la prise en charge."); }
  }

  // Plaintes contre des gendarmes (traitées par IGGN/DGGN uniquement)
  async function handleSubmitPlainteGendarme(data) {
    const ref = nextRef(plaintesGendarmes, "PG");
    const p = { ref, statut: "En attente", createdAt: new Date().toISOString(), ...data };
    try {
      const docRef = await addDoc(collection(db, "plaintes_gendarmes"), p);
      setPlaintesGendarmes([...plaintesGendarmes, { id: docRef.id, ...p }]);
      setConfirmation({ title: "Signalement envoyé", message: "Ton signalement a été transmis directement au Corps d'Encadrement et au Corps de Commandement.", refNumber: ref });
      setPublicSection("confirmation");
    } catch (e) { console.error(e); setSaveError("Échec de l'envoi, réessaie."); }
  }
  async function handleUpdatePlainteGendarmeStatut(id, statut) {
    try {
      await updateDoc(doc(db, "plaintes_gendarmes", id), { statut });
      setPlaintesGendarmes(plaintesGendarmes.map((p) => (p.id === id ? { ...p, statut } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleTakeChargePlainteGendarme(id) {
    const data = { prisEnChargeMatricule: current.matricule, prisEnChargeNom: `${current.prenom} ${current.nom}` };
    try {
      await updateDoc(doc(db, "plaintes_gendarmes", id), data);
      setPlaintesGendarmes(plaintesGendarmes.map((p) => (p.id === id ? { ...p, ...data } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la prise en charge."); }
  }

  // Comptes rendus internes
  async function handleAddCompteRendu(data) {
    const cr = { createdAt: new Date().toISOString(), auteurMatricule: current.matricule, auteurNom: `${current.prenom} ${current.nom}`, traite: false, ...data };
    try {
      const docRef = await addDoc(collection(db, "comptes_rendus"), cr);
      setComptesRendus([...comptesRendus, { id: docRef.id, ...cr }]);
    } catch (e) { console.error(e); setSaveError("Échec de l'envoi, réessaie."); }
  }
  async function handleMarkCompteRenduTraite(id) {
    try {
      await updateDoc(doc(db, "comptes_rendus", id), { traite: true });
      setComptesRendus(comptesRendus.map((cr) => (cr.id === id ? { ...cr, traite: true } : cr)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }

  // Casier judiciaire (un dossier par pseudo Discord, chaque dossier contient plusieurs mentions)
  // Code pénal
  // Grades, unités et seuils (réglages enregistrés dans settings/general)
  async function handleSaveReglages({ grades, gradesTags, unites, seuils, renomGrades, renomUnites }) {
    try {
      await setDoc(doc(db, "settings", "general"), { grades, gradesTags, unites, ...seuils, seuilHautRang: grades.indexOf(seuils.seuilHaut) }, { merge: true });
      await Promise.all(personnel.map(async (p) => {
        const g = renomGrades[p.grade] || p.grade;
        const u = renomUnites[p.unite] || p.unite;
        const rank = grades.indexOf(g);
        if (g !== p.grade || u !== p.unite || rank !== p.gradeRank) await updateDoc(doc(db, "personnel", p.id), { grade: g, unite: u, gradeRank: rank });
      }));
      appliquerReglages({ grades, gradesTags, unites, ...seuils });
      await loadAll();
      setTickReglages((t) => t + 1);
      logAction("Réglages", "Grades et unités modifiés");
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false, error: "Échec de l'enregistrement (vérifie les règles Firebase)." }; }
  }

  // Compte Roblox lié (vérifié par le serveur) pour la photo de la CIPC
  function handleRobloxLinked(data) {
    setCurrent((c) => ({ ...c, ...data }));
    setPersonnel((prev) => prev.map((p) => (p.id === current.id ? { ...p, ...data } : p)));
    return true;
  }

  // Synchronise la qualité judiciaire (OPJ/APJ/APJA) avec les rôles Discord (via /api/sync-qualites)
  async function syncQualites(force) {
    try {
      const user = auth.currentUser;
      if (!user) return null;
      const idToken = await user.getIdToken();
      const r = await fetch("/api/sync-qualites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, force: !!force }) });
      const j = await r.json();
      if (j && j.updated > 0) {
        const res = await loadAll();
        const moi = res && res.personnel ? res.personnel.find((p) => p.id === user.uid) : null;
        if (moi) setCurrent(moi);
      }
      return j;
    } catch (e) { return null; }
  }
  async function handleSyncQualites() {
    const j = await syncQualites(true);
    if (!j) return "Échec de la synchronisation.";
    if (!j.ok) return j.message || "Échec de la synchronisation.";
    return j.message ? j.message : `${j.updated} qualité(s) mise(s) à jour sur ${j.total} agent(s) reliés à Discord.`;
  }

  // Service (prise / fin de service)
  async function handleStartService() {
    if (services.some((s) => s.matricule === current.matricule && s.type !== "ajustement" && !s.fin)) return;
    const s = { type: "service", matricule: current.matricule, nom: `${current.prenom} ${current.nom}`, debut: new Date().toISOString(), fin: null };
    try {
      const ref = await addDoc(collection(db, "services"), s);
      setServices((prev) => [...prev, { id: ref.id, ...s }]);
      notifierDiscord("service_debut", `${s.nom} (${s.matricule}) prend son service`);
      try {
        await setDoc(doc(db, "en_service", current.id), { matricule: current.matricule, nom: s.nom, debut: s.debut });
        setEnService((prev) => (prev.some((e) => e.id === current.id) ? prev : [...prev, { id: current.id }]));
      } catch (e2) { console.error(e2); }
      journaliserMC(current, "Prise de service.");
    } catch (e) { console.error(e); setSaveError("Impossible de prendre le service, réessaie."); }
  }
  async function handleStopService(id, forcePar) {
    const patch = { fin: new Date().toISOString(), ...(forcePar ? { force: true, forcePar } : {}) };
    try {
      await updateDoc(doc(db, "services", id), patch);
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      const t = services.find((s) => s.id === id);
      if (t) notifierDiscord("service_fin", `${t.nom} (${t.matricule}) termine son service — ${fmtDuree(new Date(patch.fin) - new Date(t.debut))}${forcePar ? " (arrêt forcé par " + forcePar + ")" : ""}`);
      if (forcePar) logAction("Service", `Arrêt forcé du service de ${t ? t.nom : id}`);
      if (t) {
        const duree = fmtDuree(new Date(patch.fin) - new Date(t.debut));
        journaliserMC(current, forcePar ? `Service de ${t.nom} terminé de force par ${forcePar} — durée ${duree}.` : `Fin de service — durée ${duree}.`);
      }
      if (forcePar && t) {
        const pp = personnel.find((x) => x.matricule === t.matricule);
        if (pp) deleteDoc(doc(db, "en_service", pp.id)).then(() => setEnService((prev) => prev.filter((e) => e.id !== pp.id))).catch(() => {});
      }
    } catch (e) { console.error(e); setSaveError("Impossible de terminer le service, réessaie."); }
  }
  async function handleAdjustService(data) {
    const a = { type: "ajustement", matricule: data.matricule, nom: data.nom, minutes: data.minutes, motif: data.motif || "", date: new Date().toISOString(), auteur: `${current.prenom} ${current.nom}` };
    try {
      const ref = await addDoc(collection(db, "services"), a);
      setServices((prev) => [...prev, { id: ref.id, ...a }]);
      logAction("Service", `Ajustement de ${data.minutes} min pour ${data.nom}${data.motif ? " (" + data.motif + ")" : ""}`);
      return true;
    } catch (e) { console.error(e); setSaveError("Échec de l'ajustement."); return false; }
  }
  async function handleDeleteService(id) {
    try {
      const t = services.find((s) => s.id === id);
      await deleteDoc(doc(db, "services", id));
      setServices((prev) => prev.filter((s) => s.id !== id));
      if (t && t.type !== "ajustement" && !t.fin) {
        const pp = personnel.find((x) => x.matricule === t.matricule);
        if (pp) deleteDoc(doc(db, "en_service", pp.id)).then(() => setEnService((prev) => prev.filter((e) => e.id !== pp.id))).catch(() => {});
      }
      logAction("Service", "Suppression d'une ligne de service");
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  // Procès-verbaux
  async function handleSubmitPV(data) {
    const p = { ref: "PV-" + Date.now().toString(36).toUpperCase(), traite: false, createdAt: new Date().toISOString(), auteurMatricule: current.matricule, auteurNom: `${current.prenom} ${current.nom}`, ...data };
    try {
      const ref = await addDoc(collection(db, "pv"), p);
      setPvs((prev) => [...prev, { id: ref.id, ...p }]);
      notifierDiscord("pv", `${p.modeleTitre} — par ${p.auteurNom} (${p.ref})`);
      journaliserMC(current, `PV transmis à l'OPJ : ${p.modeleTitre} (${p.ref}).`);
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleMarkPVTraite(id) {
    try {
      await updateDoc(doc(db, "pv", id), { traite: true, traitePar: `${current.prenom} ${current.nom}` });
      setPvs((prev) => prev.map((p) => (p.id === id ? { ...p, traite: true } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }

  // Questionnaires personnalisés (stockés dans settings/general, lisibles par le public)
  async function handleSaveQuestionnaires(list) {
    try {
      await setDoc(doc(db, "settings", "general"), { questionnaires: list }, { merge: true });
      setQuestionnaires(list);
      logAction("Questionnaires", `${list.length} questionnaire(s) enregistré(s)`);
      return true;
    } catch (e) { console.error(e); setSaveError("Échec de l'enregistrement des questionnaires."); return false; }
  }

  // Recrutement (bandeau d'accueil)
  async function handleToggleRecrutement() {
    const next = !recrutementOuvert;
    try {
      await setDoc(doc(db, "settings", "general"), { recrutementOuvert: next }, { merge: true });
      setRecrutementOuvert(next);
      logAction("Recrutement", next ? "Ouvert" : "Fermé");
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }

  // Avis sur un gendarme (publics, non modifiables par les gendarmes)
  async function handleSubmitAvisGendarme(data) {
    const a = { ...data, createdAt: new Date().toISOString() };
    try {
      const docRef = await addDoc(collection(db, "avis_gendarmes"), a);
      setAvisGendarmes([...avisGendarmes, { id: docRef.id, ...a }]);
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false }; }
  }

  // Avis généraux sur la gendarmerie
  async function handleSubmitAvisGeneral(data) {
    const a = { ...data, createdAt: new Date().toISOString() };
    try {
      const docRef = await addDoc(collection(db, "avis_generaux"), a);
      setAvisGeneraux([...avisGeneraux, { id: docRef.id, ...a }]);
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false }; }
  }

  // Suggestions (lecture réservée DGGN)
  async function handleSubmitSuggestion(data) {
    const s = { ...data, createdAt: new Date().toISOString() };
    try {
      const docRef = await addDoc(collection(db, "suggestions"), s);
      setSuggestions([...suggestions, { id: docRef.id, ...s }]);
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false }; }
  }

  // Sanctions disciplinaires (Commandant et grades supérieurs)
  async function handleIssueSanction(data) {
    const dateDebut = new Date();
    const dateFin = new Date(dateDebut.getTime() + Number(data.dureeJours) * 24 * 60 * 60 * 1000);
    const s = {
      matricule: data.matricule,
      nomCible: data.nomCible,
      type: data.type,
      motif: data.motif,
      dureeJours: Number(data.dureeJours),
      dateDebut: dateDebut.toISOString(),
      dateFin: dateFin.toISOString(),
      emisPar: current.matricule,
      emisParNom: `${current.prenom} ${current.nom}`,
    };
    try {
      const docRef = await addDoc(collection(db, "sanctions"), s);
      setSanctions([...sanctions, { id: docRef.id, ...s }]);
      logAction("Sanction émise", `${s.type} — ${s.nomCible} (${s.matricule})`);
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false, error: "Échec de l'envoi." }; }
  }

  // Promotions / rétrogradations (Commandant et grades supérieurs, sur grade inférieur au sien)
  async function handleIssuePromotion(targetPersonnel, nouveauGrade) {
    const ancienGrade = targetPersonnel.grade;
    const type = GRADES.indexOf(nouveauGrade) > GRADES.indexOf(ancienGrade) ? "Promotion" : "Rétrogradation";
    const p = {
      matricule: targetPersonnel.matricule,
      nomCible: `${targetPersonnel.prenom} ${targetPersonnel.nom}`,
      ancienGrade,
      nouveauGrade,
      type,
      emisPar: current.matricule,
      emisParNom: `${current.prenom} ${current.nom}`,
      createdAt: new Date().toISOString(),
    };
    try {
      await updateDoc(doc(db, "personnel", targetPersonnel.id), { grade: nouveauGrade, gradeRank: GRADES.indexOf(nouveauGrade) });
      const docRef = await addDoc(collection(db, "promotions"), p);
      setPromotions([...promotions, { id: docRef.id, ...p }]);
      await refresh();
      logAction(type, `${p.nomCible} : ${ancienGrade} → ${nouveauGrade}`);
      syncGradeDiscord(targetPersonnel.id).then((j) => { if (j && j.alerte) setSaveError("Grade modifié sur le site, mais Discord : " + j.message); });
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false, error: "Échec de l'opération." }; }
  }

  // Rôles personnalisés
  // Notes de service (épinglées à l'accueil du tableau de bord)
  async function handleCreateNoteService(data) {
    const n = { ...data, auteurNom: `${current.prenom} ${current.nom}`, createdAt: new Date().toISOString() };
    try {
      const docRef = await addDoc(collection(db, "notes_service"), n);
      setNotesService([...notesService, { id: docRef.id, ...n }]);
      logAction("Note de service publiée", data.titre);
    } catch (e) { console.error(e); setSaveError("Échec de la publication."); }
  }
  async function handleDeleteNoteService(id) {
    try {
      await deleteDoc(doc(db, "notes_service", id));
      setNotesService(notesService.filter((n) => n.id !== id));
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  // Règlements (cases créées/modifiables par l'admin)
  async function handleCreateReglement(data) {
    const r = { ...data, updatedAt: new Date().toISOString() };
    try {
      const docRef = await addDoc(collection(db, "reglements"), r);
      setReglements([...reglements, { id: docRef.id, ...r }]);
      logAction("Règlement créé", data.titre);
    } catch (e) { console.error(e); setSaveError("Échec de la création."); }
  }
  async function handleUpdateReglement(id, data) {
    const r = { ...data, updatedAt: new Date().toISOString() };
    try {
      await updateDoc(doc(db, "reglements", id), r);
      setReglements(reglements.map((x) => (x.id === id ? { ...x, ...r } : x)));
      logAction("Règlement modifié", data.titre);
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleDeleteReglement(id) {
    try {
      await deleteDoc(doc(db, "reglements", id));
      setReglements(reglements.filter((r) => r.id !== id));
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  async function handleCreateRole(data) {
    try {
      const docRef = await addDoc(collection(db, "roles"), data);
      setRoles([...roles, { id: docRef.id, ...data }]);
      logAction("Création de rôle", data.nom);
    } catch (e) { console.error(e); setSaveError("Échec de la création du rôle."); }
  }
  async function handleUpdateRole(id, data) {
    try {
      await updateDoc(doc(db, "roles", id), data);
      setRoles(roles.map((r) => (r.id === id ? { ...r, ...data } : r)));
      logAction("Modification de rôle", data.nom);
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour du rôle."); }
  }
  async function handleDeleteRole(id) {
    try {
      await deleteDoc(doc(db, "roles", id));
      setRoles(roles.filter((r) => r.id !== id));
    } catch (e) { console.error(e); setSaveError("Échec de la suppression du rôle."); }
  }

  async function handleAddArticle(data) {
    try {
      const docRef = await addDoc(collection(db, "code_penal"), data);
      setCodePenal([...codePenal, { id: docRef.id, ...data }]);
    } catch (e) { console.error(e); setSaveError("Échec de l'ajout, réessaie."); }
  }
  async function handleUpdateArticle(id, data) {
    try {
      await updateDoc(doc(db, "code_penal", id), data);
      setCodePenal(codePenal.map((a) => (a.id === id ? { ...a, ...data } : a)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleDeleteArticle(id) {
    try {
      await deleteDoc(doc(db, "code_penal", id));
      setCodePenal(codePenal.filter((a) => a.id !== id));
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }
  async function handleAddCasier(data, auteur) {
    const { pseudoRoblox, robloxUsername, robloxId, nom, prenom, ...mentionFields } = data;
    const mention = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), gendarmeMatricule: auteur.matricule, gendarmeNom: `${auteur.prenom} ${auteur.nom}`, ...mentionFields };
    const bas = (s) => String(s || "").trim().toLowerCase();
    // Le compte Roblox (identifiant unique) sert de clé ; à défaut, ancien dossier au même pseudo : on le relie au compte
    const existing = casier.find((d) => d.robloxId && d.robloxId === robloxId)
      || casier.find((d) => !d.robloxId && [pseudoRoblox, robloxUsername].some((v) => bas(v) && bas(v) === bas(d.pseudoRoblox)));
    try {
      if (existing) {
        const mentions = [...existing.mentions, mention];
        const patch = { mentions, nom: nom || existing.nom || "", prenom: prenom || existing.prenom || "" };
        if (!existing.robloxId) Object.assign(patch, { robloxId, robloxUsername, robloxDisplayName: pseudoRoblox });
        await updateDoc(doc(db, "casier", existing.id), patch);
        setCasier(casier.map((d) => (d.id === existing.id ? { ...d, ...patch } : d)));
      } else {
        const dossier = { pseudoRoblox, pseudoDiscord: "", robloxId, robloxUsername, robloxDisplayName: pseudoRoblox, nom, prenom, mentions: [mention] };
        const docRef = await addDoc(collection(db, "casier"), dossier);
        setCasier([...casier, { id: docRef.id, ...dossier }]);
      }
      logAction("Ajout mention casier", `${pseudoRoblox} (@${robloxUsername}) — ${mentionFields.nature}`);
      const cible = [prenom, nom].filter(Boolean).join(" ") || `${pseudoRoblox} (@${robloxUsername})`;
      journaliserMC(auteur, `Casier judiciaire : ${existing ? "mention ajoutée au dossier" : "nouveau dossier ouvert"} — ${cible}${mentionFields.nature ? ` (${mentionFields.nature})` : ""}.`);
    } catch (e) { console.error(e); setSaveError("Échec de l'enregistrement, réessaie."); }
  }
  async function handleUpdateCasierMention(dossierId, mentionId, data) {
    const dossier = casier.find((d) => d.id === dossierId);
    if (!dossier) return;
    const mentions = dossier.mentions.map((m) => (m.id === mentionId ? { ...m, ...data } : m));
    try {
      await updateDoc(doc(db, "casier", dossierId), { mentions });
      setCasier(casier.map((d) => (d.id === dossierId ? { ...d, mentions } : d)));
      logAction("Modification mention casier", `${dossier.pseudoRoblox || dossier.pseudoDiscord}`);
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleDeleteCasierMention(dossierId, mentionId) {
    const dossier = casier.find((d) => d.id === dossierId);
    if (!dossier) return;
    const mentions = dossier.mentions.filter((m) => m.id !== mentionId);
    try {
      await updateDoc(doc(db, "casier", dossierId), { mentions });
      setCasier(casier.map((d) => (d.id === dossierId ? { ...d, mentions } : d)));
      logAction("Suppression mention casier", `${dossier.pseudoRoblox || dossier.pseudoDiscord}`);
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  /* ---------- Routage ---------- */

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#07142E", display: "flex", alignItems: "center", justifyContent: "center", color: "#F2F6FC", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
        Chargement…
      </div>
    );
  }

  const questionnairesPublics = questionnaires.filter((q) => q.visibilite === "public" && q.actif);
  const questionnairesInternes = questionnaires.filter((q) => q.visibilite === "interne" && q.actif);
  const modelesPV = questionnaires.filter((q) => q.visibilite === "pv" && q.actif);

  if (view === "public") {
    if (publicSection === "home") return <PublicHome onNavigate={(s) => (s === "login" ? setView("login") : setPublicSection(s))} recrutementOuvert={recrutementOuvert} nbQuestionnaires={questionnairesPublics.length} />;
    if (publicSection === "plainte") return <PlainteForm onSubmit={handleSubmitPlainte} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "candidature") {
      const gavQ = questionnaires.find((q) => q.id === "gav");
      if (gavQ && !gavQ.actif) return <QuestionnaireFerme onBack={() => setPublicSection("home")} />;
      return (
        <ApplicationForm
          title={gavQ ? gavQ.titre : "Candidature — Gendarme Adjoint Volontaire (GAV)"}
          intro={gavQ ? gavQ.intro : "Rejoins les rangs de la Gendarmerie Nationale de Black RP. Réponds avec sérieux, ta candidature sera étudiée par l'administration."}
          sections={gavQ ? sectionsDe(gavQ) : GAV_SECTIONS}
          poste="GAV"
          onSubmit={(data) => handleSubmitCandidature(data)}
          onCancel={() => setPublicSection("home")}
        />
      );
    }
    if (publicSection === "questionnaires")
      return <QuestionnairesListe liste={questionnairesPublics} onOpen={(id) => { setQuestionnaireId(id); setPublicSection("questionnaire"); }} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "questionnaire") {
      const q = questionnaires.find((x) => x.id === questionnaireId && x.visibilite === "public");
      if (!q || !q.actif) return <QuestionnaireFerme onBack={() => setPublicSection("home")} />;
      return (
        <ApplicationForm
          key={q.id}
          title={q.titre}
          intro={q.intro}
          sections={sectionsDe(q)}
          poste={q.poste || q.titre}
          onSubmit={(data) => handleSubmitCandidature(data)}
          onCancel={() => setPublicSection("home")}
        />
      );
    }
    if (publicSection === "casier-public") return <CasierPublicLookup casier={casier} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "code-penal") return <CodePenalPublic codePenal={codePenal} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "avis-gendarme") return <AvisGendarmeForm onSubmit={handleSubmitAvisGendarme} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "avis-general") return <AvisGeneralForm onSubmit={handleSubmitAvisGeneral} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "suggestion") return <SuggestionForm onSubmit={handleSubmitSuggestion} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "plainte-gendarme") return <PlainteGendarmeForm onSubmit={handleSubmitPlainteGendarme} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "confirmation" && confirmation) {
      return <Confirmation {...confirmation} onBack={() => { setPublicSection("home"); setConfirmation(null); }} />;
    }
  }

  if (view === "login") {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onBack={() => setView("public")}
        blockedMsg={loginBlockedMsg}
      />
    );
  }

  // view === "dashboard"
  if (!current) { setView("public"); return null; }

  if (confirmationDash) {
    return <Confirmation {...confirmationDash} onBack={() => { setConfirmationDash(null); setDashSection("dossier"); }} />;
  }

  const compteurs = {
    candidatures: candidatures.filter((c) => c.statut === "En attente").length,
    plaintes: plaintes.filter((p) => p.statut === "En attente").length,
    plaintesGendarmes: plaintesGendarmes.filter((p) => p.statut === "En attente").length,
    questionnaires: questionnairesInternes.length,
    pv: pvs.filter((p) => !p.traite).length,
  };
  const menuDash = construireMenu(current, !!current.isAdmin, compteurs);
  const itemDash = menuDash.flatMap((g) => g.items).find((it) => it.id === dashSection);
  const titreSection = itemDash ? itemDash.label.replace(/ \(\d+\)$/, "") : dashSection.startsWith("postuler") ? "Candidature" : "Pulsar RP";
  const serviceActif = services.find((s) => s.matricule === current.matricule && s.type !== "ajustement" && !s.fin);

  return (
    <div style={{ display: "flex", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", background: "#E9EFF7", minHeight: "100vh" }}>
      <Sidebar
        current={current}
        section={dashSection}
        setSection={setDashSection}
        isAdmin={!!current.isAdmin}
        onLogout={async () => { try { await signOut(auth); } catch (e) {} setView("public"); setPublicSection("home"); }}
        counts={compteurs}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <DashTopBar current={current} titre={titreSection} actif={serviceActif} />
      <div style={{ flex: 1, padding: dashSection.startsWith("postuler") ? 0 : "32px 40px" }}>
        {saveError && <div style={{ color: "#C0172D", fontSize: 12, margin: "14px 0 0 40px" }}>{saveError}</div>}
        {dashSection === "dossier" && (
          <div>
            {(() => {
              const now = new Date();
              const mesSanctionsActives = sanctions.filter((s) => s.matricule === current.matricule && new Date(s.dateFin) > now);
              const heure = now.getHours();
              const salutation = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
              const isRecruteurOuAdmin = current.isAdmin || (current.qualifications || []).includes("Recruteur");
              const isOpjOuAdmin = current.isAdmin || (current.qualifications || []).includes("OPJ");
              const stats = [
                isRecruteurOuAdmin && { label: "Candidatures en attente", value: candidatures.filter((c) => c.statut === "En attente").length },
                isOpjOuAdmin && { label: "Plaintes en attente", value: plaintes.filter((p) => p.statut === "En attente").length },
                (current.isAdmin || estCorps(current.unite)) && { label: "Signalements gendarmes", value: plaintesGendarmes.filter((p) => p.statut === "En attente").length },
                { label: "Personnel enregistré", value: personnel.length },
              ].filter(Boolean);
              return (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 26, fontWeight: 700, color: "#14213A" }}>{salutation}, {current.prenom} 👋</div>
                    <div style={{ fontSize: 13, color: "#5A6B84", marginTop: 4 }}>{current.grade} — {current.unite}{current.fonction ? ` — ${current.fonction}` : ""}</div>
                  </div>
                  {mesSanctionsActives.length > 0 && (
                    <div style={{ background: "#C0172D", color: "#fff", borderRadius: 10, padding: "14px 18px", marginBottom: 20, fontSize: 13 }}>
                      ⚠️ Tu as {mesSanctionsActives.length} sanction(s) active(s) : {mesSanctionsActives.map((s) => s.type).join(", ")}.
                    </div>
                  )}
                  {stats.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
                      {stats.map((s) => (
                        <div key={s.label} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "16px 18px", boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)" }}>
                          <div style={{ fontSize: 24, fontWeight: 700, color: "#123A7A", fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif" }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: "#5A6B84", marginTop: 2, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            <PulsarTuiles groups={menuDash} onOpen={setDashSection} />
            {(current.isAdmin || notesService.length > 0) && (
              <div style={{ marginBottom: 28 }}>
                <h2 style={h2Style}>Notes de service</h2>
                <NotesServicePanel current={current} notesService={notesService} onCreate={handleCreateNoteService} onDelete={handleDeleteNoteService} />
              </div>
            )}
            <h2 style={h2Style}>𝐂𝐈𝐏𝐂 — Carte d'Identité Professionnelle et de Circulation</h2>
          <CartePro p={current} onLinked={handleRobloxLinked} />
          </div>
        )}
        {dashSection === "reglements" && (
          <ReglementsPage current={current} reglements={reglements} onCreate={handleCreateReglement} onUpdate={handleUpdateReglement} onDelete={handleDeleteReglement} />
        )}
        {dashSection === "casier" && <CasierPage current={current} casier={casier} codePenal={codePenal} onAdd={(data) => handleAddCasier(data, current)} onUpdateMention={handleUpdateCasierMention} onDeleteMention={handleDeleteCasierMention} />}
        {dashSection === "code-penal-interne" && <CodePenalPage current={current} codePenal={codePenal} onAdd={handleAddArticle} onUpdate={handleUpdateArticle} onDelete={handleDeleteArticle} />}
        {dashSection === "postuler-sog" && (
          <ApplicationForm
            title="Candidature — Sous-Officier de Gendarmerie (SOG)"
            intro="Réservé au personnel ayant au minimum le grade de Maréchal des Logis."
            sections={SOG_SECTIONS}
            poste="SOG"
            prefill={{ grade_actuel: current.grade }}
            onSubmit={(data) => handleSubmitCandidature(data, current)}
            onCancel={() => setDashSection("dossier")}
          />
        )}
        {dashSection === "postuler-officier" && (
          <ApplicationForm
            title="Candidature — Officier"
            intro="Réservé au personnel ayant au minimum le grade de Major."
            sections={OFFICIER_SECTIONS}
            poste="Officier"
            prefill={{ grade_actuel: current.grade }}
            onSubmit={(data) => handleSubmitCandidature(data, current)}
            onCancel={() => setDashSection("dossier")}
          />
        )}
        {dashSection === "admin-grades" && current.isAdmin && <GradesUnitesAdmin personnel={personnel} onSave={handleSaveReglages} />}
        {dashSection === "cartes-pro" && <CartesProPage personnel={personnel} />}
        {dashSection === "main-courante" && (
          <MainCourantePage current={current} enService={!!serviceActif} canEdit={!!current.isAdmin || (current.qualifications || []).includes("OPJ") || current.qualiteJudiciaire === "OPJ"} canDelete={!!current.isAdmin} onGoService={() => setDashSection("mon-service")} onLog={logAction} />
        )}
        {dashSection === "mon-service" && <MonServicePage current={current} services={services} onStart={handleStartService} onStop={(id) => handleStopService(id)} />}
        {dashSection === "pv" && <PVPage current={current} modeles={modelesPV} pvs={pvs} onSubmit={handleSubmitPV} onMarkTraite={handleMarkPVTraite} />}
        {dashSection === "admin-services" && current.isAdmin && (
          <AdminServicesPage personnel={personnel} services={services} onForceStop={(id) => handleStopService(id, `${current.prenom} ${current.nom}`)} onAdjust={handleAdjustService} onDelete={handleDeleteService} />
        )}
        {dashSection === "questionnaires-internes" && (
          <QuestionnairesListe liste={questionnairesInternes} onOpen={(id) => { setQuestionnaireId(id); setDashSection("postuler-questionnaire"); }} />
        )}
        {dashSection === "postuler-questionnaire" && (() => {
          const q = questionnairesInternes.find((x) => x.id === questionnaireId);
          if (!q) return <div style={{ padding: "32px 40px" }}>Questionnaire introuvable ou fermé.</div>;
          return (
            <ApplicationForm
              key={q.id}
              title={q.titre}
              intro={q.intro}
              sections={sectionsDe(q)}
              poste={q.poste || q.titre}
              onSubmit={(data) => handleSubmitCandidature(data, current)}
              onCancel={() => setDashSection("questionnaires-internes")}
            />
          );
        })()}
        {dashSection === "admin-questionnaires" && current.isAdmin && (
          <QuestionnairesAdmin questionnaires={questionnaires} onSave={handleSaveQuestionnaires} />
        )}
        {dashSection === "admin-personnel" && current.isAdmin && (
          <div>
            <RecrutementPanel recrutementOuvert={recrutementOuvert} onToggle={handleToggleRecrutement} />
            <AdminPanel personnel={personnel} roles={roles} onCreate={handleCreatePersonnel} onDelete={handleDeletePersonnel} onUpdate={handleUpdatePersonnel} onAssignRIO={handleAssignRIO} onSyncQualites={handleSyncQualites} />
          </div>
        )}
        {dashSection === "roles" && current.isAdmin && (
          <RolesPage roles={roles} onCreate={handleCreateRole} onUpdate={handleUpdateRole} onDelete={handleDeleteRole} />
        )}
        {dashSection === "admin-candidatures" && (current.isAdmin || (current.qualifications || []).includes("Recruteur")) && (
          <AdminCandidatures candidatures={candidatures} onUpdateStatut={handleUpdateCandidatureStatut} />
        )}
        {dashSection === "admin-plaintes" && (current.isAdmin || (current.qualifications || []).includes("OPJ")) && (
          <AdminPlaintes plaintes={plaintes} current={current} onUpdateStatut={handleUpdatePlainteStatut} onTakeCharge={handleTakeChargePlainte} />
        )}
        {dashSection === "plaintes-gendarmes" && (current.isAdmin || estCorps(current.unite)) && (
          <AdminPlaintesGendarmes plaintes={plaintesGendarmes} current={current} onUpdateStatut={handleUpdatePlainteGendarmeStatut} onTakeCharge={handleTakeChargePlainteGendarme} />
        )}
        {dashSection === "comptes-rendus" && (
          <CompteRenduPage current={current} comptesRendus={comptesRendus} onAdd={handleAddCompteRendu} onMarkTraite={handleMarkCompteRenduTraite} />
        )}
        {dashSection === "mes-avis" && <MesAvisPage current={current} avisGendarmes={avisGendarmes} personnel={personnel} />}
        {dashSection === "avis-suggestions" && (
          <AvisSuggestionsPage current={current} avisGeneraux={avisGeneraux} suggestions={suggestions} />
        )}
        {dashSection === "sanctions" && (current.isAdmin || (current.gradeRank ?? GRADES.indexOf(current.grade)) >= DISCIPLINE_MIN_INDEX) && (
          <SanctionsPage current={current} personnel={personnel} sanctions={sanctions} onIssue={handleIssueSanction} />
        )}
        {dashSection === "promotions" && (
          <PromotionsPage current={current} personnel={personnel} promotions={promotions} onIssue={handleIssuePromotion} />
        )}
        {dashSection === "logs" && current.isAdmin && <LogsPage logs={logs} />}
      </div>
      </div>
    </div>
  );
}


export default function App() {
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Barlow+Semi+Condensed:wght@500;600;700&family=Open+Sans:wght@800&display=swap";
    document.head.appendChild(l);
    const s = document.createElement("style");
    s.textContent = "html,body{background:#E9EFF7;font-family:'Inter','Segoe UI',system-ui,sans-serif;-webkit-font-smoothing:antialiased}button,input,select,textarea{font-family:inherit}::selection{background:#2F6FDE;color:#fff}";
    document.head.appendChild(s);
  }, []);
  return (
    <div style={{ paddingBottom: 30 }}>
      <AppInner />
      <RPRibbon />
    </div>
  );
}
