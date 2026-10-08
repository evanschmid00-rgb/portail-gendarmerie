import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from "firebase/firestore";
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

// Charge seulement les N documents les plus récents (évite de relire toute une collection qui grossit)
async function loadRecent(name, n, champ = "createdAt") {
  try {
    const snap = await getDocs(query(collection(db, name), orderBy(champ, "desc"), limit(n)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(name, e);
    return [];
  }
}

// Lecture « stricte » : lève une erreur en cas d'échec (pour pouvoir réessayer plus tard)
async function loadStrict(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
// Les services d'un seul gendarme (au lieu de ceux de tout le monde)
async function loadServicesDe(matricule) {
  try {
    const snap = await getDocs(query(collection(db, "services"), where("matricule", "==", matricule)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("services", e); return []; }
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

// Donne ou retire le rôle Discord de sanction (via /api/sync-sanction) ; action : "ajouter" ou "retirer"
async function syncSanctionDiscord(sanctionId, action) {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const idToken = await user.getIdToken();
    const r = await fetch("/api/sync-sanction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, sanctionId, action }) });
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
  "Réserviste",
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
  const max = list.reduce((m, x) => { const r = /-(\d+)$/.exec(String(x.ref || "")); return r ? Math.max(m, parseInt(r[1], 10)) : m; }, 0);
  const n = Math.max(max, list.length) + 1;
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
    { key: "casier-public", icon: FileSearch, titre: "Consulter mon casier", texte: "Consultez les mentions enregistrées à votre nom.", color: "#2F6FDE" },
    { key: "code-penal", icon: BookOpen, titre: "Code pénal", texte: "Retrouvez les infractions et leurs sanctions.", color: "#123A7A" },
    { key: "reglements", icon: ScrollText, titre: "Règlements", texte: "Consultez les règles à respecter sur le serveur.", color: "#B7791F" },
    { key: "suivi-candidature", icon: BadgeCheck, titre: "Suivre ma candidature", texte: "Consultez la réponse avec votre numéro de dossier.", color: "#2E7D4F" },
    ...(nbQuestionnaires > 0 ? [{ key: "questionnaires", icon: ClipboardList, titre: "Rejoindre la gendarmerie", texte: recrutementOuvert ? "Le recrutement est ouvert : accédez aux candidatures." : "Consultez les questionnaires actuellement ouverts.", color: "#2E7D4F" }] : []),
  ];
  // Donner son avis ou une idée (formulaires anonymes ouverts à tous)
  const avis = [
    { key: "avis-general", icon: Star, titre: "Avis sur la brigade", texte: "Notez la gendarmerie et dites-nous ce que vous en pensez.", color: "#B7791F" },
    { key: "avis-gendarme", icon: Users, titre: "Avis sur un agent", texte: "Félicitez ou commentez le comportement d'un gendarme.", color: "#2E7D4F" },
    { key: "suggestion", icon: MessageSquare, titre: "Faire une suggestion", texte: "Une idée pour améliorer la gendarmerie ou le site ? Écrivez-nous.", color: "#7B3FA0" },
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
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => onNavigate("creer-compte")} className="gh-link-anim" style={{ background: "#2F6FDE", border: "1px solid #2F6FDE", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Créer mon compte</button>
            <button onClick={() => onNavigate("login")} className="gh-link-anim" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Espace gendarmes</button>
          </div>
        </div>

        <div style={{ maxWidth: 880, margin: "56px auto 0", textAlign: "center" }}>
          <div style={{ display: "inline-block", background: recrutementOuvert ? "#2E7D4F" : "#C0172D", color: "#fff", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, padding: "6px 14px", borderRadius: 20 }}>
            {recrutementOuvert ? "● RECRUTEMENT OUVERT" : "● RECRUTEMENT FERMÉ"}
          </div>
          <h1 style={{ fontFamily: FONT_TITRE, fontSize: 46, lineHeight: 1.1, fontWeight: 700, margin: "18px 0 12px" }}>Gendarmerie Nationale de Black RP</h1>
          <div style={{ fontSize: 17, lineHeight: 1.6, color: "#D8E2F2" }}>Votre espace pour déposer plainte, consulter votre casier, donner votre avis et rejoindre nos rangs.</div>
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

        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 16, padding: "24px 26px 28px", marginTop: 20, boxShadow: "0 18px 40px -26px rgba(7,20,46,0.4)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Votre avis compte</div>
          <div style={{ fontSize: 14, color: "#5A6B84", marginBottom: 18 }}>Donnez votre avis sur la brigade ou sur un agent, ou proposez une idée. C'est simple et rapide.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
            {avis.map((c) => {
              const Icone = c.icon;
              return (
                <button key={c.key} onClick={() => onNavigate(c.key)} className="gh-btn-anim" style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", background: "#F5F8FC", border: "1px solid #D3DDEA", borderLeft: `5px solid ${c.color}`, borderRadius: 12, padding: "16px 16px", cursor: "pointer", fontFamily: FONT_BASE }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: c.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icone size={22} color="#fff" strokeWidth={2} />
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: "#14213A" }}>{c.titre}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "#5A6B84", marginTop: 3, lineHeight: 1.45 }}>{c.texte}</span>
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

function Confirmation({ title, message, refNumber, onBack, dossier, onSuivi }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 20%, #123A7A, #07142E 60%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ background: "#F2F6FC", borderRadius: 10, padding: 28, maxWidth: dossier ? 480 : 420, width: "100%", textAlign: "center", boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10, color: "#14213A" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 14, lineHeight: 1.5 }}>{message}</div>
        {refNumber && !dossier && <div style={{ fontFamily: "'Courier New', monospace", fontSize: 15, background: "#fff", border: "1px solid #C3D0E2", borderRadius: 6, padding: "8px 0", marginBottom: 18 }}>{refNumber}</div>}
        {refNumber && dossier && <NumeroDossierBloc numero={refNumber} />}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {dossier && onSuivi && <button onClick={onSuivi} style={{ ...smallBtn, padding: "9px 18px" }}>Suivre ma candidature</button>}
          <button onClick={onBack} style={{ ...buttonPrimary, width: "auto", padding: "9px 20px" }}>Retour</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Numéro de dossier de candidature (suivi public) ---------- */

const ALPHABET_DOSSIER = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 caractères, sans 0/O/1/I pour éviter les confusions
const FORMAT_DOSSIER = /^[A-Z]{3,4}-[A-Z2-9]{5}-[A-Z2-9]{5}$/;
function prefixeDossier(poste) {
  const p = String(poste || "").toUpperCase();
  return p === "GAV" ? "GAV" : p === "SOG" ? "SOG" : p === "OFFICIER" ? "OFF" : p === "PLT" ? "PLT" : "CAND";
}
// Numéro aléatoire et impossible à deviner (10 caractères tirés au hasard par le navigateur)
function genererNumeroDossier(poste) {
  const tab = new Uint32Array(10);
  window.crypto.getRandomValues(tab);
  const c = Array.from(tab, (v) => ALPHABET_DOSSIER[v % 32]).join("");
  return `${prefixeDossier(poste)}-${c.slice(0, 5)}-${c.slice(5)}`;
}
function normaliserNumeroDossier(s) {
  const t = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const n = t.length === 13 ? 3 : t.length === 14 ? 4 : 0;
  if (!n) return "";
  const num = `${t.slice(0, n)}-${t.slice(n, n + 5)}-${t.slice(n + 5)}`;
  return FORMAT_DOSSIER.test(num) ? num : "";
}
async function chercherDossier(numero) {
  const snap = await getDoc(doc(db, "suivi_candidatures", numero));
  return snap.exists() ? snap.data() : null;
}

// Mémoire du navigateur : retient le dossier déjà déposé pour chaque poste
const CLE_DOSSIERS = "pulsar_dossiers_candidature";
function lireDossiersLocaux() {
  try { return JSON.parse(window.localStorage.getItem(CLE_DOSSIERS) || "{}") || {}; } catch (e) { return {}; }
}
function enregistrerDossierLocal(poste, numero) {
  try { const d = lireDossiersLocaux(); d[poste] = { numero, date: new Date().toISOString() }; window.localStorage.setItem(CLE_DOSSIERS, JSON.stringify(d)); } catch (e) { /* navigation privée : tant pis */ }
}
function oublierDossierLocal(poste) {
  try { const d = lireDossiersLocaux(); delete d[poste]; window.localStorage.setItem(CLE_DOSSIERS, JSON.stringify(d)); } catch (e) { /* rien */ }
}

const STATUTS_DOSSIER = {
  "En attente": { icone: "⏳", titre: "En cours d'étude", texte: "Ta candidature a bien été reçue mais n'a pas encore été traitée. Reviens consulter cette page régulièrement.", couleur: "#B25E00", fond: "#FFF4E0" },
  "Acceptée": { icone: "✅", titre: "Candidature acceptée", texte: "Félicitations ! Ton dossier a été accepté. Tu seras recontacté via Discord pour la suite.", couleur: "#1F6B42", fond: "#E3F2E8" },
  "Refusée": { icone: "❌", titre: "Candidature refusée", texte: "Ta candidature n'a pas été retenue cette fois. Tu pourras postuler à nouveau plus tard.", couleur: "#8A2A2A", fond: "#FDECEC" },
};

function NumeroDossierBloc({ numero }) {
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
function DejaPostule({ poste, numero, onCancel, onNouvelle }) {
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
function SuiviCandidaturePublic({ onCancel }) {
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

/* ---------- Preuves : photos, vidéos (liens) et autres liens ---------- */

const MAX_PHOTOS = 4;
const MAX_LIENS = 6;
const MAX_OCTETS_PHOTO = 200 * 1024; // chaque photo est réduite à ~200 Ko pour tenir dans la base de données

function urlValide(s) {
  try { const u = new URL(String(s || "").trim()); return u.protocol === "https:" || u.protocol === "http:" ? u.href : ""; } catch (e) { return ""; }
}
function typeDeLien(url) {
  const u = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp)(\?|#|$)/.test(u) || /(cdn\.discordapp\.com|media\.discordapp\.net|i\.imgur\.com|i\.ibb\.co|prnt\.sc)/.test(u)) return "image";
  if (/(youtube\.com|youtu\.be|medal\.tv|streamable\.com|twitch\.tv|vimeo\.com|\.mp4|\.webm|\.mov)/.test(u)) return "video";
  return "lien";
}
const hoteDe = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return url; } };

function lireFichierImage(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = r.result; };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
// Réduit une photo (taille et qualité) pour qu'elle pèse moins de ~200 Ko
async function compresserImage(file) {
  if (!/^image\//.test(file.type)) throw new Error("type");
  const img = await lireFichierImage(file);
  let max = 1280, q = 0.78;
  for (let i = 0; i < 9; i++) {
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * ratio)); c.height = Math.max(1, Math.round(img.height * ratio));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL("image/jpeg", q);
    if (data.length * 0.75 <= MAX_OCTETS_PHOTO) return data;
    if (q > 0.5) q -= 0.1; else max = Math.round(max * 0.8);
  }
  throw new Error("trop lourde");
}

function PreuvesEditeur({ preuves, onChange }) {
  const [lien, setLien] = useState("");
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  const nbPhotos = preuves.filter((p) => p.data).length;
  const nbLiens = preuves.filter((p) => p.url).length;

  function ajouterLien() {
    const u = urlValide(lien);
    if (!u) { setErreur("Ce lien n'est pas valide : il doit commencer par https://"); return; }
    if (nbLiens >= MAX_LIENS) { setErreur(`Tu peux ajouter ${MAX_LIENS} liens au maximum.`); return; }
    if (preuves.some((p) => p.url === u)) { setErreur("Ce lien est déjà ajouté."); return; }
    onChange([...preuves, { type: typeDeLien(u), url: u }]);
    setLien(""); setErreur("");
  }
  async function ajouterPhotos(e) {
    const fichiers = Array.from(e.target.files || []);
    e.target.value = "";
    if (!fichiers.length) return;
    setBusy(true); setErreur("");
    let courant = [...preuves];
    for (const f of fichiers) {
      if (courant.filter((p) => p.data).length >= MAX_PHOTOS) { setErreur(`Tu peux ajouter ${MAX_PHOTOS} photos au maximum (utilise un lien pour le reste).`); break; }
      try { courant = [...courant, { type: "image", data: await compresserImage(f), nom: f.name.slice(0, 60) }]; }
      catch (err) { setErreur(`« ${f.name} » n'a pas pu être ajoutée (image uniquement, ou fichier illisible).`); }
    }
    onChange(courant);
    setBusy(false);
  }
  const retirer = (i) => onChange(preuves.filter((_, k) => k !== i));
  const champ = { padding: "9px 11px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, boxSizing: "border-box", flex: 1, minWidth: 0 };

  return (
    <div style={{ background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 14 }}>
      {preuves.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {preuves.map((p, i) => (
            <div key={i} style={{ position: "relative", background: "#fff", border: "1px solid #C3D0E2", borderRadius: 8, overflow: "hidden", width: p.data ? 110 : "auto", maxWidth: 240 }}>
              {p.data ? <img src={p.data} alt={p.nom || "preuve"} style={{ width: 110, height: 80, objectFit: "cover", display: "block" }} />
                : <div style={{ padding: "8px 30px 8px 10px", fontSize: 12.5 }}>{p.type === "video" ? "▶ Vidéo" : p.type === "image" ? "🖼 Image" : "🔗 Lien"} · <span style={{ color: "#5A6B84" }}>{hoteDe(p.url)}</span></div>}
              <button type="button" onClick={() => retirer(i)} aria-label="Retirer" style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(20,33,58,0.75)", color: "#fff", fontSize: 12, cursor: "pointer", lineHeight: "20px", padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input value={lien} onChange={(e) => setLien(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterLien(); } }} placeholder="Colle un lien (YouTube, Medal, Streamable, Imgur, Drive…)" style={champ} />
        <button type="button" onClick={ajouterLien} style={smallBtn}>+ Ajouter le lien</button>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ ...smallBtn, display: "inline-block", cursor: busy || nbPhotos >= MAX_PHOTOS ? "not-allowed" : "pointer", opacity: nbPhotos >= MAX_PHOTOS ? 0.5 : 1 }}>
          📷 Ajouter des photos ({nbPhotos}/{MAX_PHOTOS})
          <input type="file" accept="image/*" multiple disabled={busy || nbPhotos >= MAX_PHOTOS} onChange={ajouterPhotos} style={{ display: "none" }} />
        </label>
        {busy && <span style={{ fontSize: 12.5, color: "#5A6B84" }}>Compression des photos…</span>}
      </div>
      {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginTop: 8 }}>{erreur}</div>}
      <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 10, lineHeight: 1.55 }}>
        <b>Photos :</b> jusqu'à {MAX_PHOTOS}, réduites automatiquement. <b>Vidéos :</b> trop lourdes pour être envoyées ici ; mets-les en ligne (YouTube en « non répertorié », Medal, Streamable, Google Drive avec partage par lien…) puis colle le lien. N'envoie que des éléments en rapport avec les faits.
      </div>
    </div>
  );
}

// Affichage des preuves (photos envoyées, liens). Les images distantes ne se chargent qu'au clic, pour ne pas exposer l'adresse IP du lecteur.
function PreuvesAffichage({ preuves }) {
  const [zoom, setZoom] = useState(null);
  const [ouvertes, setOuvertes] = useState({});
  const liste = Array.isArray(preuves) ? preuves : [];
  if (!liste.length) return null;
  const lienStyle = { display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #C3D0E2", borderRadius: 8, padding: "7px 11px", fontSize: 12.5, color: "#123A7A", textDecoration: "none", fontWeight: 600 };
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
      {liste.map((p, i) => {
        if (p.data) return <img key={i} src={p.data} alt={p.nom || "preuve"} onClick={() => setZoom(p.data)} style={{ width: 120, height: 88, objectFit: "cover", borderRadius: 8, border: "1px solid #C3D0E2", cursor: "zoom-in" }} />;
        const u = urlValide(p.url);
        if (!u) return null;
        if (p.type === "image" && ouvertes[i]) return <img key={i} src={u} alt="preuve" referrerPolicy="no-referrer" onClick={() => setZoom(u)} style={{ width: 120, height: 88, objectFit: "cover", borderRadius: 8, border: "1px solid #C3D0E2", cursor: "zoom-in" }} />;
        if (p.type === "image") return <button key={i} type="button" onClick={() => setOuvertes({ ...ouvertes, [i]: true })} style={{ ...lienStyle, cursor: "pointer" }}>🖼 Afficher l'image · <span style={{ color: "#5A6B84", fontWeight: 400 }}>{hoteDe(u)}</span></button>;
        return <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={lienStyle}>{p.type === "video" ? "▶ Vidéo" : "🔗 Lien"} · <span style={{ color: "#5A6B84", fontWeight: 400 }}>{hoteDe(u)}</span> ↗</a>;
      })}
      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, background: "rgba(7,20,46,0.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <img src={zoom} alt="preuve" referrerPolicy="no-referrer" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}

/* ---------- Formulaire public : plainte ---------- */

function PlainteForm({ onSubmit, onCancel }) {
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

function StatBox({ label, ms, accent = "#123A7A" }) {
  return (
    <div style={{ flex: 1, minWidth: 130, background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${accent}`, borderRadius: 12, padding: "12px 16px" }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: accent }}>{fmtDuree(ms)}</div>
    </div>
  );
}

function BarreTemps({ ms, max, couleur = "#2F6FDE" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (ms / max) * 100)) : 0;
  return (
    <div style={{ height: 7, background: "#E6EDF7", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: couleur, borderRadius: 4, transition: "width .3s" }} />
    </div>
  );
}

function RepartitionService({ st }) {
  const aujourdhui = cleJour(new Date());
  const maxJ = Math.max(1, ...st.parJour.map((j) => j.ms));
  const maxS = Math.max(1, ...st.parSemaine.map((w) => w.ms));
  const ligne = { display: "grid", gridTemplateColumns: "92px 1fr 64px", gap: 10, alignItems: "center", fontSize: 12.5, padding: "4px 0" };
  const bloc = { flex: 1, minWidth: 250, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px" };
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div style={bloc}>
        <div style={labelStyle}>Par jour (cette semaine)</div>
        {st.parJour.map((j) => (
          <div key={j.cle} style={{ ...ligne, fontWeight: j.cle === aujourdhui ? 700 : 400 }}>
            <span style={{ textTransform: "capitalize" }}>{fmtJourCourt(j.date)}</span>
            <BarreTemps ms={j.ms} max={maxJ} couleur={j.cle === aujourdhui ? "#2E7D4F" : "#2F6FDE"} />
            <b style={{ textAlign: "right" }}>{fmtDuree(j.ms)}</b>
          </div>
        ))}
      </div>
      <div style={bloc}>
        <div style={labelStyle}>Par semaine</div>
        {st.parSemaine.map((w, i) => (
          <div key={w.cle} style={{ ...ligne, fontWeight: i === 0 ? 700 : 400 }}>
            <span>{i === 0 ? "Cette semaine" : `Sem. du ${w.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`}</span>
            <BarreTemps ms={w.ms} max={maxS} couleur={i === 0 ? "#2E7D4F" : "#7A93BD"} />
            <b style={{ textAlign: "right" }}>{fmtDuree(w.ms)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

const initialesDe = (p) => `${(p.prenom || "?").charAt(0)}${(p.nom || "?").charAt(0)}`.toUpperCase();

function grouperParMatricule(services) {
  const m = {};
  services.forEach((s) => { (m[s.matricule] = m[s.matricule] || []).push(s); });
  return m;
}

// Une ligne par gendarme avec son temps de service (utilisée par la page équipe et par la gestion admin)
function lignesTemps(personnel, parMat, now, recherche, tri) {
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = norm(recherche);
  const cles = { semaine: (x) => x.st.semaine, jour: (x) => x.st.jour, total: (x) => x.st.total };
  return personnel
    .filter((p) => p.matricule)
    .map((p) => { const list = parMat[p.matricule] || []; return { p, st: statsService(list, now), actif: list.find((s) => s.type !== "ajustement" && !s.fin) }; })
    .filter(({ p }) => !q || norm(`${p.prenom} ${p.nom} ${p.matricule} ${p.grade} ${p.cipcNumero || ""}`).includes(q))
    .sort((a, b) => (tri === "nom" ? 0 : (cles[tri] || cles.semaine)(b) - (cles[tri] || cles.semaine)(a)) || `${a.p.nom}${a.p.prenom}`.localeCompare(`${b.p.nom}${b.p.prenom}`));
}

function CarteTemps({ p, st, actif, now, max, moi, ouvert, onToggle, action, quotaMs, absence }) {
  const enService = !!actif;
  return (
    <div style={{ background: "#fff", border: `1px solid ${moi ? "#9DB6DD" : "#D3DDEA"}`, borderLeft: `5px solid ${enService ? "#2E7D4F" : "#C3D0E2"}`, borderRadius: 12, overflow: "hidden", boxShadow: moi ? "0 4px 16px -10px rgba(18,58,122,0.45)" : "none" }}>
      <div onClick={onToggle} style={{ padding: "12px 16px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", cursor: onToggle ? "pointer" : "default" }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: enService ? "#2E7D4F" : "#123A7A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_TITRE, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{initialesDe(p)}</div>
        <div style={{ flex: "1 1 190px", minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#14213A" }}>
            {p.prenom} {p.nom}
            {moi && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#123A7A", borderRadius: 10, padding: "2px 8px" }}>TOI</span>}
            {estReserviste(p) && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#7B3FA0", borderRadius: 10, padding: "2px 8px" }}>RÉSERVISTE</span>}
            {absence && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#6B4E00", background: "#FFF4D6", border: "1px solid #E8D28A", borderRadius: 10, padding: "2px 8px" }}>🏖️ ABSENT(E) jusqu'au {fmtJourFR(absence.fin)}</span>}
          </div>
          <div style={{ fontSize: 12, color: "#5A6B84" }}>{[p.grade, p.unite].filter(Boolean).join(" · ") || `Matricule ${p.matricule}`}</div>
          <div style={{ fontSize: 12, marginTop: 3, fontWeight: 600, color: enService ? "#1F6B42" : "#7B8AA3" }}>
            {enService ? `🟢 En service depuis ${fmtHeure(actif.debut)} (${fmtDuree(dureeService(actif, now))})` : "⚪ Hors service"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {[["Aujourd'hui", st.jour], ["Semaine", st.semaine], ["Total", st.total]].map(([l, ms]) => (
            <div key={l} style={{ textAlign: "center", minWidth: 62 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", color: "#7B8AA3", fontWeight: 600 }}>{l}</div>
              <div style={{ fontFamily: FONT_TITRE, fontSize: 16, fontWeight: 700, color: l === "Total" ? "#123A7A" : "#14213A" }}>{fmtDuree(ms)}</div>
            </div>
          ))}
        </div>
        {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
      </div>
      <div style={{ padding: "0 16px 12px" }}>
        <BarreTemps ms={st.semaine} max={quotaMs || max} couleur={quotaMs && st.semaine >= quotaMs ? "#2E7D4F" : enService ? "#2E7D4F" : "#2F6FDE"} />
        {quotaMs ? <div style={{ fontSize: 11, color: st.semaine >= quotaMs ? "#1F6B42" : "#5A6B84", marginTop: 4, fontWeight: 600 }}>{st.semaine >= quotaMs ? "✅ " : ""}Quota : {fmtDuree(st.semaine)} / {fmtDuree(quotaMs)}</div> : null}
      </div>
      {ouvert && <div style={{ padding: "14px 16px 0", borderTop: "1px solid #E3EAF4", background: "#F9FBFE" }}><RepartitionService st={st} /></div>}
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

/* ---------- Quota de service et absences ---------- */

const QUOTA_DEFAUT = { quotaHebdoMin: 300, quotaReserveMin: 180, quotaDebut: "", quotaAuto: false };
const estReserviste = (p) => !!p && Array.isArray(p.qualifications) && p.qualifications.includes("Réserviste");
const quotaMsDe = (p, q) => (estReserviste(p) ? q.quotaReserveMin : q.quotaHebdoMin) * 60000;
const absenceActive = (a, jour) => a.annulee !== true && a.debut <= jour && a.fin >= jour;
const absenceSemaine = (a, lundi) => {
  const dim = new Date(lundi); dim.setDate(dim.getDate() + 6);
  return a.annulee !== true && a.debut <= cleJour(dim) && a.fin >= cleJour(lundi);
};
const fmtJourFR = (s) => new Date(`${s}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
function lundiProchainStr() { const d = debutSemaine(new Date()); d.setDate(d.getDate() + 7); return cleJour(d); }

// Progression de la semaine par rapport au quota
function CarteQuota({ st, quotaMs, reserviste, auto, absenceSem }) {
  const fait = st.semaine;
  const atteint = fait >= quotaMs;
  const reste = Math.max(0, quotaMs - fait);
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${atteint ? "#2E7D4F" : absenceSem ? "#B7791F" : "#2F6FDE"}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>🎯 Quota de la semaine {reserviste && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#7B3FA0", borderRadius: 10, padding: "2px 8px" }}>RÉSERVISTE</span>}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: atteint ? "#1F6B42" : "#14213A" }}>{fmtDuree(fait)} / {fmtDuree(quotaMs)}</div>
      </div>
      <BarreTemps ms={fait} max={quotaMs} couleur={atteint ? "#2E7D4F" : "#2F6FDE"} />
      <div style={{ fontSize: 12.5, color: "#3A4D6B", marginTop: 8, lineHeight: 1.5 }}>
        {atteint ? "✅ Quota atteint pour cette semaine, bravo !" : `Il te reste ${fmtDuree(reste)} à effectuer avant dimanche soir.`}
        {!atteint && auto && !absenceSem && " Sans quota atteint, une mise en garde automatique est émise à la fin de la semaine."}
        {!atteint && auto && absenceSem && " 🏖️ Tu as une absence déclarée cette semaine : tu ne seras pas sanctionné(e)."}
      </div>
    </div>
  );
}

// Déclarer / annuler une absence
function AbsencesCard({ current, absences, onAdd, onCancel }) {
  const aujourdhui = cleJour(new Date());
  const [debut, setDebut] = useState(aujourdhui);
  const [fin, setFin] = useState(aujourdhui);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState("");
  const [msg, setMsg] = useState("");
  const miennes = absences.filter((a) => a.matricule === current.matricule && a.annulee !== true && a.fin >= aujourdhui).sort((a, b) => a.debut.localeCompare(b.debut));
  const passees = absences.filter((a) => a.matricule === current.matricule && (a.annulee === true || a.fin < aujourdhui)).sort((a, b) => b.debut.localeCompare(a.debut)).slice(0, 5);

  async function submit(e) {
    e.preventDefault();
    if (!debut || !fin) { setErreur("Indique les dates de début et de fin."); return; }
    if (fin < debut) { setErreur("La date de fin doit être après la date de début."); return; }
    if (fin < aujourdhui) { setErreur("L'absence ne peut pas être entièrement dans le passé."); return; }
    const jours = Math.round((new Date(`${fin}T12:00:00`) - new Date(`${debut}T12:00:00`)) / 86400000) + 1;
    if (jours > 60) { setErreur("Une absence ne peut pas dépasser 60 jours : contacte ton commandement pour une absence plus longue."); return; }
    setErreur("");
    const ok = await onAdd({ debut, fin, motif });
    if (ok) { setMsg("Absence enregistrée : tu ne seras pas sanctionné(e) pour le quota pendant cette période."); setMotif(""); setTimeout(() => setMsg(""), 6000); }
    else setErreur("Impossible d'enregistrer l'absence, réessaie.");
  }
  const ligne = (a, passee) => (
    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", background: passee ? "#F5F8FC" : a.debut <= aujourdhui ? "#FFF4E0" : "#fff", border: "1px solid #D3DDEA", borderRadius: 8, padding: "9px 12px", fontSize: 13, opacity: passee ? 0.75 : 1 }}>
      <div>
        <b>{fmtJourFR(a.debut)}{a.fin !== a.debut ? ` → ${fmtJourFR(a.fin)}` : ""}</b>
        {a.annulee === true ? <span style={{ color: "#8A2A2A" }}> · annulée</span> : !passee && a.debut <= aujourdhui ? <span style={{ color: "#B25E00", fontWeight: 700 }}> · en cours</span> : !passee ? <span style={{ color: "#5A6B84" }}> · à venir</span> : null}
        {a.motif ? <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>{a.motif}</div> : null}
      </div>
      {!passee && <button style={smallBtn} onClick={() => { if (window.confirm("Annuler cette absence ?")) onCancel(a.id); }}>Annuler</button>}
    </div>
  );
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "16px 18px", marginBottom: 22 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🏖️ Mes absences</div>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 12, lineHeight: 1.5 }}>Pendant une absence déclarée, tu n'es pas sanctionné(e) si tu n'atteins pas ton quota de la semaine. Déclare-la <b>avant</b> la fin de la semaine concernée.</div>
      <form onSubmit={submit}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px" }}><Field label="Du" type="date" value={debut} onChange={setDebut} /></div>
          <div style={{ flex: "1 1 150px" }}><Field label="Au (inclus)" type="date" value={fin} onChange={setFin} /></div>
        </div>
        <Field label="Motif (facultatif)" value={motif} onChange={setMotif} placeholder="Ex : vacances, examens, indisponible…" />
        {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 8 }}>{erreur}</div>}
        {msg && <div style={{ color: "#2E7D4F", fontSize: 12.5, marginBottom: 8, fontWeight: 600 }}>{msg}</div>}
        <button type="submit" className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>Déclarer mon absence</button>
      </form>
      {(miennes.length > 0 || passees.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
          {miennes.map((a) => ligne(a, false))}
          {passees.map((a) => ligne(a, true))}
        </div>
      )}
    </div>
  );
}

// Panneau admin : quotas, date de début, activation, simulation
function QuotaAdminPanel({ reglages, onSave }) {
  const [heures, setHeures] = useState(String(reglages.quotaHebdoMin / 60));
  const [heuresRes, setHeuresRes] = useState(String(reglages.quotaReserveMin / 60));
  const [debut, setDebut] = useState(reglages.quotaDebut || lundiProchainStr());
  const [auto, setAuto] = useState(reglages.quotaAuto === true);
  const [etat, setEtat] = useState("");
  const [sim, setSim] = useState(null);
  useEffect(() => {
    setHeures(String(reglages.quotaHebdoMin / 60)); setHeuresRes(String(reglages.quotaReserveMin / 60));
    setDebut(reglages.quotaDebut || lundiProchainStr()); setAuto(reglages.quotaAuto === true);
  }, [reglages]);
  const inp = { padding: "8px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, width: 110, boxSizing: "border-box" };

  async function enregistrer() {
    const h = Number(String(heures).replace(",", ".")), hr = Number(String(heuresRes).replace(",", "."));
    if (!(h > 0 && h <= 100) || !(hr > 0 && hr <= 100)) { setEtat("Indique des quotas valides (en heures)."); return; }
    if (auto && !debut) { setEtat("Choisis la date de début des sanctions automatiques."); return; }
    setEtat("Enregistrement…");
    const ok = await onSave({ quotaHebdoMin: Math.round(h * 60), quotaReserveMin: Math.round(hr * 60), quotaDebut: debut, quotaAuto: auto });
    setEtat(ok ? "Réglages enregistrés." : "Échec de l'enregistrement.");
  }
  async function simuler() {
    setSim({ chargement: true });
    try {
      const idToken = await auth.currentUser.getIdToken();
      const r = await fetch("/api/quota-hebdo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
      setSim({ data: await r.json() });
    } catch (e) { setSim({ erreur: "Simulation impossible (le fichier serveur est-il en ligne ?)." }); }
  }
  const libelle = { sanction: "🔴 Mise en garde", "exempt-absent": "🏖️ Absent(e)", "exempt-nouveau": "🆕 Nouveau compte", "exempt-mise-a-pied": "⛔ Mise à pied", ok: "✅ OK" };
  return (
    <details style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 16px", marginBottom: 18 }}>
      <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#123A7A" }}>🎯 Quota hebdomadaire et sanctions automatiques (admin)</summary>
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <div><label style={labelStyle}>Quota gendarme (heures)</label><input value={heures} onChange={(e) => setHeures(e.target.value)} style={inp} /></div>
          <div><label style={labelStyle}>Quota réserviste (heures)</label><input value={heuresRes} onChange={(e) => setHeuresRes(e.target.value)} style={inp} /></div>
          <div><label style={labelStyle}>Contrôle à partir du lundi</label><input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} style={{ ...inp, width: 160 }} /></div>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Émettre automatiquement une mise en garde aux gendarmes sous leur quota
        </label>
        <div style={{ fontSize: 12, color: "#5A6B84", lineHeight: 1.5, marginBottom: 12 }}>Chaque lundi matin, la semaine précédente est contrôlée. Sont dispensés : les gendarmes déclarés absents pendant la semaine, les comptes créés pendant la semaine et les gendarmes en mise à pied. Pour qu'un gendarme soit réserviste, ajoute-lui la qualification « Réserviste » dans la gestion du personnel.</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={enregistrer} style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 0 }}>Enregistrer</button>
          <button type="button" onClick={simuler} style={smallBtn}>Simuler le contrôle de la semaine dernière</button>
          {etat && <span style={{ fontSize: 12.5, color: etat.startsWith("Réglages") ? "#1F6B42" : "#5A6B84", fontWeight: 600 }}>{etat}</span>}
        </div>
        {sim && (
          <div style={{ marginTop: 14, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 12 }}>
            {sim.chargement && <div style={{ fontSize: 13 }}>Calcul en cours…</div>}
            {sim.erreur && <div style={{ fontSize: 13, color: "#C0172D" }}>{sim.erreur}</div>}
            {sim.data && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{sim.data.message}{sim.data.lundi ? ` (semaine du ${fmtJourFR(sim.data.lundi)} au ${fmtJourFR(sim.data.dimanche)})` : ""}</div>
                {(sim.data.resultats || []).filter((r) => r.statut !== "ok").map((r) => (
                  <div key={r.matricule} style={{ fontSize: 12.5, padding: "3px 0" }}>{libelle[r.statut]} — <b>{r.nom}</b> : {fmtDuree(r.minutes * 60000)} / {fmtDuree(r.quota * 60000)}{r.reserviste ? " (réserviste)" : ""}</div>
                ))}
                {sim.data.resultats && sim.data.resultats.every((r) => r.statut === "ok") && <div style={{ fontSize: 12.5 }}>Tout le monde a atteint son quota.</div>}
              </>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

function MonServicePage({ current, services, onStart, onStop, quotaReglages = QUOTA_DEFAUT, absences = [], onAddAbsence, onCancelAbsence }) {
  const now = useNow(1000);
  const mine = services.filter((s) => s.matricule === current.matricule);
  const actif = mine.find((s) => s.type !== "ajustement" && !s.fin);
  const st = statsService(mine, now);
  const groupes = [];
  mine.slice().sort(triDate).slice(0, 60).forEach((s) => {
    const ref = dateRefService(s);
    const cle = cleJour(ref);
    let g = groupes.find((x) => x.cle === cle);
    if (!g) { g = { cle, date: ref, items: [], ms: 0 }; groupes.push(g); }
    g.items.push(s);
    g.ms += dureeService(s, now);
  });

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={h2Style}>Mon service</h2>
      <div style={{ background: actif ? "linear-gradient(135deg, #E3F2E8, #F4FAF6)" : "#fff", border: "1px solid " + (actif ? "#2E7D4F" : "#D3DDEA"), borderRadius: 16, padding: "26px 22px", marginBottom: 20, textAlign: "center", boxShadow: "0 8px 24px -16px rgba(7,20,46,0.35)" }}>
        {actif ? (
          <>
            <div style={{ fontSize: 13, color: "#2E7D4F", fontWeight: 700, letterSpacing: 1 }}>🟢 EN SERVICE depuis {fmtHeure(actif.debut)}</div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 42, fontWeight: 700, margin: "8px 0 16px", color: "#14213A" }}>{fmtDuree(dureeService(actif, now))}</div>
            <button className="gh-btn-anim" onClick={() => onStop(actif.id)} style={{ ...buttonPrimary, width: "auto", padding: "10px 28px", background: "#C0172D" }}>Terminer mon service</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: "#5A6B84", marginBottom: 14 }}>🔴 Tu n'es pas en service</div>
            <button className="gh-btn-anim" onClick={onStart} style={{ ...buttonPrimary, width: "auto", padding: "10px 28px", background: "#2E7D4F" }}>Prendre mon service</button>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="Aujourd'hui" ms={st.jour} accent="#2E7D4F" />
        <StatBox label="Cette semaine" ms={st.semaine} accent="#2F6FDE" />
        <StatBox label="Total" ms={st.total} accent="#123A7A" />
      </div>
      <CarteQuota st={st} quotaMs={quotaMsDe(current, quotaReglages)} reserviste={estReserviste(current)} auto={quotaReglages.quotaAuto === true} absenceSem={absences.some((a) => a.matricule === current.matricule && absenceSemaine(a, debutSemaine(new Date(now))))} />
      <RepartitionService st={st} />
      {onAddAbsence && <AbsencesCard current={current} absences={absences} onAdd={onAddAbsence} onCancel={onCancelAbsence} />}
      <div style={{ ...labelStyle, marginBottom: 10 }}>Historique de mes services</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {groupes.map((g) => (
          <div key={g.cle}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, color: "#3A4D6B", marginBottom: 6, textTransform: "capitalize" }}>
              <span>{new Date(g.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
              <span style={{ color: "#123A7A" }}>{fmtDuree(g.ms)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.items.map((s) => <LigneService key={s.id} s={s} now={now} />)}
            </div>
          </div>
        ))}
        {groupes.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun service enregistré.</div>}
      </div>
    </div>
  );
}

// Visible par tous les gendarmes : temps de service de toute l'équipe
function ServicesEquipePage({ current, personnel, services, etat, quotaReglages = QUOTA_DEFAUT, absences = [] }) {
  const now = useNow(30000);
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("semaine");
  const [ouverts, setOuverts] = useState({});
  const parMat = useMemo(() => grouperParMatricule(services), [services]);
  const toutes = useMemo(() => lignesTemps(personnel, parMat, now, "", tri), [personnel, parMat, now, tri]);
  const lignes = useMemo(() => lignesTemps(personnel, parMat, now, recherche, tri), [personnel, parMat, now, recherche, tri]);
  const enService = toutes.filter((x) => x.actif).sort((a, b) => new Date(a.actif.debut) - new Date(b.actif.debut));
  const totalSemaine = toutes.reduce((n, x) => n + x.st.semaine, 0);
  const actifsSemaine = toutes.filter((x) => x.st.semaine > 0).length;
  const maxSemaine = Math.max(1, ...lignes.map((x) => x.st.semaine));
  const auj = cleJour(now);
  const absenceDe = (mat) => absences.find((a) => a.matricule === mat && absenceActive(a, auj)) || null;
  const nbAbsents = toutes.filter((x) => absenceDe(x.p.matricule)).length;
  const tuile = (l, v, c) => (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );
  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={h2Style}>Services de l'équipe</h2>
      {etat === "erreur" ? (
        <div style={{ background: "#FDECEC", border: "1px solid #E5B4B4", color: "#8A2A2A", borderRadius: 10, padding: 16, fontSize: 13.5 }}>
          Impossible de charger les services de l'équipe pour le moment. Si le problème continue, les règles Firestore de la collection « services » doivent autoriser la lecture à tous les gendarmes connectés.
        </div>
      ) : etat !== "ok" ? (
        <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
            {tuile("En service maintenant", enService.length, "#2E7D4F")}
            {tuile("Heures de l'équipe cette semaine", fmtDuree(totalSemaine), "#2F6FDE")}
            {tuile("Gendarmes actifs cette semaine", actifsSemaine, "#123A7A")}
            {tuile("Absents aujourd'hui", nbAbsents, "#B7791F")}
          </div>

          <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🟢 En service maintenant ({enService.length})</div>
            {enService.length === 0 ? <div style={{ fontSize: 13, color: "#5A6B84" }}>Personne n'est en service.</div> : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {enService.map(({ p, actif }) => (
                  <span key={p.id} style={{ background: "#E3F2E8", color: "#1F6B42", fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 16 }}>
                    {p.prenom} {p.nom} · depuis {fmtHeure(actif.debut)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un gendarme…" style={{ padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, flex: "1 1 220px", boxSizing: "border-box" }} />
            <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
              <option value="semaine">Trier : cette semaine</option>
              <option value="jour">Trier : aujourd'hui</option>
              <option value="total">Trier : total</option>
              <option value="nom">Trier : nom</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lignes.map(({ p, st, actif }) => (
              <CarteTemps key={p.id} p={p} st={st} actif={actif} now={now} max={maxSemaine} quotaMs={quotaMsDe(p, quotaReglages)} absence={absenceDe(p.matricule)} moi={p.id === current.id} ouvert={!!ouverts[p.id]} onToggle={() => setOuverts({ ...ouverts, [p.id]: !ouverts[p.id] })} />
            ))}
            {lignes.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun gendarme trouvé.</div>}
          </div>
          <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 14 }}>Clique sur un gendarme pour voir le détail de sa semaine. Les temps se mettent à jour quand tu rouvres la page.</div>
        </>
      )}
    </div>
  );
}

function AdminServicesPage({ personnel, services, onForceStop, onAdjust, onDelete, quotaReglages = QUOTA_DEFAUT, absences = [], onSaveQuota }) {
  const now = useNow(1000);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ sens: "Retirer du temps", heures: "", minutes: "", motif: "" });
  const [msg, setMsg] = useState("");
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("semaine");
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
      {onSaveQuota && <QuotaAdminPanel reglages={quotaReglages} onSave={onSaveQuota} />}
      <div style={{ ...labelStyle, marginBottom: 8 }}>Heures par gendarme</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un gendarme…" style={{ padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, flex: "1 1 220px", boxSizing: "border-box" }} />
        <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
          <option value="semaine">Trier : cette semaine</option>
          <option value="jour">Trier : aujourd'hui</option>
          <option value="total">Trier : total</option>
          <option value="nom">Trier : nom</option>
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(() => {
          const parMat = grouperParMatricule(services);
          const lignes = lignesTemps(personnel, parMat, now, recherche, tri);
          const max = Math.max(1, ...lignes.map((x) => x.st.semaine));
          return lignes.map(({ p, st, actif }) => (
            <CarteTemps key={p.id} p={p} st={st} actif={actif} now={now} max={max} quotaMs={quotaMsDe(p, quotaReglages)} absence={absences.find((a) => a.matricule === p.matricule && absenceActive(a, cleJour(now))) || null} action={<button style={smallBtn} onClick={() => { setSel(p.matricule); setMsg(""); }}>Détails / modifier</button>} />
          ));
        })()}
      </div>
    </div>
  );
}

/* ====================== PROCÈS-VERBAUX ====================== */

// --- Nombres et dates en toutes lettres (formule d'ouverture d'un PV) ---
const U_FR = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
function dizainesFR(n) {
  if (n < 20) return U_FR[n];
  const d = Math.floor(n / 10), u = n % 10;
  if (d === 7) return "soixante" + (u === 1 ? " et " : "-") + U_FR[10 + u];
  if (d === 9) return "quatre-vingt-" + U_FR[10 + u];
  const noms = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante", 8: "quatre-vingt" };
  if (u === 0) return d === 8 ? "quatre-vingts" : noms[d];
  if (u === 1 && d !== 8) return noms[d] + " et un";
  return noms[d] + "-" + U_FR[u];
}
function centainesFR(n) {
  if (n < 100) return dizainesFR(n);
  const c = Math.floor(n / 100), r = n % 100;
  if (r === 0) return c === 1 ? "cent" : U_FR[c] + " cents";
  return (c === 1 ? "cent" : U_FR[c] + " cent") + " " + dizainesFR(r);
}
function nombreEnLettres(n) {
  if (n === 0) return "zéro";
  if (n < 1000) return centainesFR(n);
  const m = Math.floor(n / 1000), r = n % 1000;
  const mille = m === 1 ? "mille" : centainesFR(m) + " mille";
  return r ? mille + " " + centainesFR(r) : mille;
}
const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function dateEnLettres(d) {
  return { an: nombreEnLettres(d.getFullYear()), jour: d.getDate() === 1 ? "premier" : nombreEnLettres(d.getDate()), mois: MOIS_FR[d.getMonth()] };
}
function heureEnLettres(h, m) {
  let t = nombreEnLettres(h);
  if (t === "un" || t.endsWith(" un")) t = t.slice(0, -2) + "une";
  const heures = `${t} heure${h > 1 ? "s" : ""}`;
  return m ? `${heures} ${nombreEnLettres(m)}` : heures;
}
const QUALITE_LONGUE = { OPJ: "Officier de Police Judiciaire", APJ: "Agent de Police Judiciaire", APJA: "Agent de Police Judiciaire Adjoint" };
const ROMAIN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

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
const MODELE_PLAINTE_DEFAUT = { ...avecIdsPV(MODELES_PV_TYPES[0]), id: "plainte-defaut" };

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
const dateFR = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR") : "");

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

function FichePV({ pv, apercu, onClose, canVisa, onVisa }) {
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

function PVPage({ current, modeles, pvs, onSubmit, onVisa }) {
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

function PVModelesAdmin({ modeles, onSave }) {
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

/* ---------- Habillage : barre du haut, tuiles, mention RP ---------- */

const ICONES_MENU = {
  dossier: BadgeCheck, "cartes-pro": BadgeCheck, "main-courante": Radio, "code-penal-interne": BookOpen, reglements: ScrollText, "mes-avis": Star, "questionnaires-internes": ClipboardList,
  "mon-service": Clock, "services-equipe": Users, pv: FileText, casier: FileSearch, "comptes-rendus": MessageSquare, "postuler-sog": TrendingUp, "postuler-officier": TrendingUp,
  "admin-candidatures": UserPlus, promotions: Award, sanctions: Scale, "mes-sanctions": Scale, "admin-personnel": Users, roles: UserCog, "admin-questionnaires": ClipboardList, "admin-modeles-pv": FileText,
  "admin-services": Clock, "admin-grades": Settings, "admin-plaintes": Siren, "plaintes-gendarmes": ShieldAlert, "avis-suggestions": MessageSquare,
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

const TYPE_DEBUT = "Début de patrouille";
const TYPE_CHANGEMENT = "Changement de patrouille";
const TYPE_FIN = "Fin de patrouille";
const TYPE_PATROUILLE = TYPE_DEBUT; // ancien nom, conservé pour les filtres
const TYPES_PATROUILLE = [TYPE_DEBUT, TYPE_CHANGEMENT, TYPE_FIN];
const ANCIENS_TYPES_DEBUT = ["Prise de patrouille", "Patrouille"]; // anciennes entrées, toujours lisibles
const estDebut = (t) => t === TYPE_DEBUT || ANCIENS_TYPES_DEBUT.includes(t);
const estTypePatrouille = (t) => TYPES_PATROUILLE.includes(t) || ANCIENS_TYPES_DEBUT.includes(t);
const DESCRIPTIONS_AUTO = ["Prise de patrouille.", "Début de patrouille.", "Changement de patrouille.", "Fin de patrouille."];
const TYPES_MC = [TYPE_DEBUT, TYPE_CHANGEMENT, TYPE_FIN, "Intervention", "Contrôle routier", "Incident", "Information", "Relève / consigne", "Autre"];
// Liste par défaut du matériel : les admins peuvent la modifier (enregistrée dans settings/general)
const MATERIEL_PATROUILLE = [
  "HK G36 en calibre 5,56 x 45 mm OTAN", "Plots", "Ruban", "Herse Stop Stick", "PIE", "Pistolet-Radar", "Grenades assourdissantes",
];
const PATROUILLE_VIDE = { nbAgents: "", vehicule: "", plaque: "", materiel: [], membres: [], patrouilleId: "" };
const TYPES_MC_EDIT = [...TYPES_MC, "Activité"];
const COULEURS_MC = { Activité: "#6B7A90", [TYPE_DEBUT]: "#123A7A", [TYPE_CHANGEMENT]: "#7B3FA0", [TYPE_FIN]: "#0E7C86", "Prise de patrouille": "#123A7A", Patrouille: "#123A7A", Intervention: "#C0172D", "Contrôle routier": "#2F6FDE", Incident: "#B25E00", Information: "#5A6B84", "Relève / consigne": "#2E7D4F", Autre: "#3A4D6B" };

const nomsMembres = (membres) => (membres || []).map((m) => m.nom).join(", ");
const libellePatrouille = (p) => `${p.vehicule || "Patrouille"}${p.plaque ? ` (${p.plaque})` : ""} — ${nomsMembres(p.membres) || "sans agent"} · depuis ${p.debut}`;
const patchDepuis = (p) => ({ patrouilleId: p.id, membres: p.membres, vehicule: p.vehicule, plaque: p.plaque, materiel: p.materiel });

// Patrouilles en cours : on rejoue les entrées dans l'ordre ; un « Fin de patrouille » ferme la patrouille, un « Changement » met à jour sa composition
function calculerPatrouillesActives(entrees) {
  const parId = {};
  entrees
    .filter((en) => !en.auto && en.patrouilleId && estTypePatrouille(en.type))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .forEach((en) => {
      const pid = en.patrouilleId;
      if (en.type === TYPE_FIN) { delete parId[pid]; return; }
      const avant = parId[pid];
      parId[pid] = {
        id: pid, debut: avant ? avant.debut : heureDe(en), derniere: heureDe(en),
        vehicule: en.vehicule || (avant ? avant.vehicule : ""), plaque: en.plaque || (avant ? avant.plaque : ""),
        materiel: en.materiel || [], membres: en.membres || [],
        changements: (avant ? avant.changements : 0) + (en.type === TYPE_CHANGEMENT ? 1 : 0),
      };
    });
  return Object.values(parId).sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
}

function SelecteurAgents({ v, onChange, agents, actives }) {
  const ailleurs = {};
  actives.forEach((p) => { if (p.id !== v.patrouilleId) p.membres.forEach((m) => { ailleurs[m.id] = true; }); });
  const connus = new Set(agents.map((a) => a.id));
  const options = [...agents, ...v.membres.filter((m) => !connus.has(m.id)).map((m) => ({ id: m.id, nom: m.nom, grade: "", horsService: true }))];
  const choisi = (id) => v.membres.some((m) => m.id === id);
  const bascule = (a) => onChange({ ...v, membres: choisi(a.id) ? v.membres.filter((m) => m.id !== a.id) : [...v.membres, { id: a.id, nom: a.nom }] });
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>Agents en service dans la patrouille ({v.membres.length} sélectionné{v.membres.length > 1 ? "s" : ""})</label>
      {options.length === 0 && <div style={{ fontSize: 12.5, color: "#5A6B84" }}>Aucun agent en service pour le moment.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 7 }}>
        {options.map((a) => {
          const pris = ailleurs[a.id] && !choisi(a.id);
          return (
            <label key={a.id} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: pris ? "not-allowed" : "pointer", opacity: pris ? 0.5 : 1 }}>
              <input type="checkbox" checked={choisi(a.id)} disabled={pris} onChange={() => bascule(a)} />
              <span>{a.grade ? `${a.grade} ` : ""}{a.nom}{pris ? " (déjà en patrouille)" : ""}{a.horsService ? " (hors service)" : ""}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PatrouilleChamps({ v, onChange, type, ctx, edition }) {
  const fin = type === TYPE_FIN;
  const choix = !edition && (type === TYPE_FIN || type === TYPE_CHANGEMENT);
  const liste = [...ctx.materiel, ...(v.materiel || []).filter((m) => !ctx.materiel.includes(m))];
  const bascule = (m) => onChange({ ...v, materiel: v.materiel.includes(m) ? v.materiel.filter((x) => x !== m) : [...v.materiel, m] });
  const titre = fin ? "Patrouille à terminer" : type === TYPE_CHANGEMENT ? "Changement de patrouille" : "Détails de la patrouille";
  return (
    <div style={{ background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 14, margin: "4px 0 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 10 }}>{titre}</div>
      {choix && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Patrouille concernée</label>
          {ctx.actives.length === 0 ? (
            <div style={{ fontSize: 13, color: "#B25E00" }}>Aucune patrouille active pour le moment : commence par un « {TYPE_DEBUT} ».</div>
          ) : (
            <select value={v.patrouilleId} onChange={(e) => { const p = ctx.actives.find((x) => x.id === e.target.value); onChange(p ? { ...v, ...patchDepuis(p) } : { ...v, ...PATROUILLE_VIDE }); }} style={selectStyle}>
              <option value="">— Choisir —</option>
              {ctx.actives.map((p) => <option key={p.id} value={p.id}>{libellePatrouille(p)}</option>)}
            </select>
          )}
        </div>
      )}
      {fin ? (
        v.patrouilleId && <div style={{ fontSize: 13 }}><b>{(v.membres || []).length}</b> agent(s) : {nomsMembres(v.membres) || "—"}{v.vehicule ? ` · 🚓 ${v.vehicule} ${v.plaque || ""}` : ""}</div>
      ) : (!choix || v.patrouilleId) && (
        <>
          <SelecteurAgents v={v} onChange={onChange} agents={ctx.agents} actives={ctx.actives} />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr", gap: 12 }}>
            <Field label="Véhicule" value={v.vehicule} onChange={(x) => onChange({ ...v, vehicule: x })} />
            <Field label="Plaque d'immatriculation" value={v.plaque} onChange={(x) => onChange({ ...v, plaque: x.toUpperCase() })} />
          </div>
          <label style={labelStyle}>Matériel emporté</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 7 }}>
            {liste.map((m) => (
              <label key={m} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={(v.materiel || []).includes(m)} onChange={() => bascule(m)} /> {m}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Vérifie et nettoie les champs de patrouille ; renvoie { erreur } ou { champs }
function champsPatrouille(v, type) {
  const membres = v.membres || [];
  const base = {
    patrouilleId: v.patrouilleId || "", membres,
    nbAgents: membres.length || parseInt(v.nbAgents, 10) || null,
    vehicule: (v.vehicule || "").trim(), plaque: (v.plaque || "").trim().toUpperCase(), materiel: v.materiel || [],
  };
  if (type === TYPE_FIN) {
    if (!base.patrouilleId) return { erreur: "Choisis la patrouille à terminer." };
    return { champs: base };
  }
  if (type === TYPE_CHANGEMENT && !base.patrouilleId) return { erreur: "Choisis la patrouille concernée par le changement." };
  if (!membres.length && !(v.nbAgents && !base.patrouilleId)) return { erreur: "Sélectionne au moins un agent dans la patrouille." };
  if (!base.vehicule) return { erreur: "Indique le véhicule utilisé." };
  if (!base.plaque) return { erreur: "Indique la plaque du véhicule." };
  return { champs: base };
}

// Panneau admin : modifier la liste du matériel à cocher
function GestionMateriel({ liste, onSave }) {
  const [items, setItems] = useState(liste);
  const [nouveau, setNouveau] = useState("");
  const [etat, setEtat] = useState("");
  useEffect(() => { setItems(liste); }, [liste]);
  const inp = { padding: "8px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, background: "#fff", boxSizing: "border-box", flex: 1, minWidth: 0 };
  function ajouterItem() {
    const t = nouveau.trim();
    if (!t || items.includes(t)) return;
    setItems([...items, t]); setNouveau("");
  }
  async function enregistrer() {
    const propre = items.map((s) => s.trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
    if (propre.length === 0) { setEtat("Garde au moins un élément."); return; }
    setEtat("Enregistrement…");
    const ok = await onSave(propre);
    setEtat(ok ? "Liste enregistrée." : "Échec de l'enregistrement.");
  }
  return (
    <details style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 16px", marginBottom: 18 }}>
      <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#123A7A" }}>⚙ Gérer le matériel de patrouille (admin)</summary>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input value={m} onChange={(e) => setItems(items.map((x, k) => (k === i ? e.target.value : x)))} style={inp} />
            <button type="button" style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => setItems(items.filter((_, k) => k !== i))}>Retirer</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={nouveau} onChange={(e) => setNouveau(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterItem(); } }} placeholder="Nouveau matériel…" style={inp} />
          <button type="button" style={smallBtn} onClick={ajouterItem}>+ Ajouter</button>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={enregistrer} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 0 }}>Enregistrer la liste</button>
          {etat && <span style={{ fontSize: 12.5, color: etat.startsWith("Liste") ? "#1F6B42" : "#5A6B84", fontWeight: 600 }}>{etat}</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "#5A6B84" }}>Retirer un élément ne modifie pas les anciennes entrées de la main courante.</div>
      </div>
    </details>
  );
}

const PRIORITES_MC = ["Routine", "Important", "Urgent"];
const COULEURS_PRIO = { Routine: "#5A6B84", Important: "#B25E00", Urgent: "#C0172D" };
const SUITES_MC = ["Aucune", "Rapport / PV rédigé", "Interpellation", "Transmis à l'OPJ", "Évacuation / secours", "Renfort demandé", "Autre"];

const heureMaintenant = () => new Date().toTimeString().slice(0, 5);
const valeursEntreeVides = () => ({ type: TYPES_MC[0], heure: heureMaintenant(), priorite: "Routine", lieu: "", description: "", agents: "", personnes: "", vehiculeTiers: "", suite: "Aucune", ...PATROUILLE_VIDE });
const heureDe = (en) => en.heure || new Date(en.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

// Vérifie le formulaire et prépare les champs à enregistrer
function validerEntree(v) {
  if (!/^\d{2}:\d{2}$/.test(v.heure || "")) return { erreur: "Indique l'heure de l'événement." };
  const patrouille = estTypePatrouille(v.type);
  if (!patrouille && v.description.trim().length < 3) return { erreur: "Décris l'événement (quelques mots suffisent)." };
  let extra = { patrouilleId: "", membres: [], nbAgents: null, vehicule: "", plaque: "", materiel: [] };
  if (patrouille) {
    const r = champsPatrouille(v, v.type);
    if (r.erreur) return { erreur: r.erreur };
    extra = r.champs;
  }
  return {
    champs: {
      type: v.type, heure: v.heure, priorite: v.priorite, lieu: v.lieu.trim(),
      description: v.description.trim() || (patrouille ? `${v.type}.` : ""), agents: v.agents.trim(),
      personnes: patrouille ? "" : v.personnes.trim(), vehiculeTiers: patrouille ? "" : v.vehiculeTiers.trim(), suite: patrouille ? "Aucune" : v.suite,
      ...extra,
    },
  };
}

// Champs de saisie (utilisés pour ajouter ET pour modifier une entrée)
function FormulaireEntree({ v, onChange, edition, ctx = { agents: [], actives: [], materiel: MATERIEL_PATROUILLE, moi: null } }) {
  const patrouille = estTypePatrouille(v.type);
  const set = (patch) => onChange({ ...v, ...patch });
  const changerType = (t) => {
    const patch = { type: t, ...PATROUILLE_VIDE };
    if (t === TYPE_DEBUT && ctx.moi) patch.membres = [ctx.moi];
    if (t === TYPE_FIN || t === TYPE_CHANGEMENT) {
      const mienne = ctx.moi && ctx.actives.find((p) => p.membres.some((m) => m.id === ctx.moi.id));
      if (mienne) Object.assign(patch, patchDepuis(mienne));
    }
    set(patch);
  };
  const inp = { padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 14, background: "#fff", boxSizing: "border-box", width: "100%" };
  return (
    <div>
      {edition ? (
        <Select label="Type" value={v.type} onChange={(t) => set({ type: t })} options={TYPES_MC_EDIT} />
      ) : (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Type d'événement</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TYPES_MC.map((t) => {
              const actif = v.type === t;
              const c = COULEURS_MC[t] || "#3A4D6B";
              return (
                <button key={t} type="button" onClick={() => changerType(t)} style={{ border: `1.5px solid ${c}`, background: actif ? c : "#fff", color: actif ? "#fff" : c, borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{t}</button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "130px 150px 1fr", gap: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Heure</label>
          <input type="time" value={v.heure} onChange={(e) => set({ heure: e.target.value })} style={inp} />
        </div>
        <Select label="Priorité" value={v.priorite} onChange={(x) => set({ priorite: x })} options={PRIORITES_MC} />
        <Field label="Lieu (facultatif)" value={v.lieu} onChange={(x) => set({ lieu: x })} placeholder="Ex : Rue principale, secteur nord…" />
      </div>

      {patrouille && <PatrouilleChamps v={v} onChange={(x) => set(x)} type={v.type} ctx={ctx} edition={edition} />}
      <Field label={patrouille ? "Observations (facultatif)" : "Que s'est-il passé ?"} textarea value={v.description} onChange={(x) => set({ description: x })} placeholder={patrouille ? "" : "Décris les faits : qui, quoi, où, comment…"} />

      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#123A7A", marginBottom: 10 }}>Détails complémentaires (facultatif)</summary>
        <Field label="Agents intervenants" value={v.agents} onChange={(x) => set({ agents: x })} placeholder="Noms des agents présents" />
        {!patrouille && (
          <>
            <Field label="Personnes impliquées" value={v.personnes} onChange={(x) => set({ personnes: x })} placeholder="Identité ou description" />
            <Field label="Véhicule concerné" value={v.vehiculeTiers} onChange={(x) => set({ vehiculeTiers: x })} placeholder="Modèle et plaque" />
            <Select label="Suite donnée" value={v.suite} onChange={(x) => set({ suite: x })} options={SUITES_MC} />
          </>
        )}
      </details>
    </div>
  );
}

function MainCourantePage({ current, enService, nbEnService = 0, agentsEnService = [], materiel = MATERIEL_PATROUILLE, onSaveMateriel, canEdit, canDelete, onGoService, onLog }) {
  const today = cleJour(new Date());
  const [jour, setJour] = useState(today);
  const [entries, setEntries] = useState([]);
  const [entriesPatrouille, setEntriesPatrouille] = useState([]); // aujourd'hui + hier, pour les patrouilles en cours
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("Tous");
  const [masquerAuto, setMasquerAuto] = useState(false);
  const [form, setForm] = useState(valeursEntreeVides);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const charger = useCallback(async () => {
    try {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const hier = cleJour(d);
      const lire = async (jours) => {
        const q = jours.length === 1 ? where("jour", "==", jours[0]) : where("jour", "in", jours);
        const snap = await getDocs(query(collection(db, "main_courante"), q));
        return snap.docs.map((x) => ({ id: x.id, ...x.data() }));
      };
      if (jour === today) {
        const tout = await lire([hier, today]);
        setEntries(tout.filter((en) => en.jour === today));
        setEntriesPatrouille(tout);
      } else {
        const [duJour, tout] = await Promise.all([lire([jour]), lire([hier, today])]);
        setEntries(duJour);
        setEntriesPatrouille(tout);
      }
    } catch (e) { console.error(e); setMsg("Impossible de charger la main courante."); }
    setLoading(false);
  }, [jour, today]);

  // Rafraîchissement automatique modéré (économise les lectures Firebase) ; bouton « Actualiser » pour le reste
  useEffect(() => {
    setLoading(true);
    charger();
    if (jour !== today) return undefined;
    const t = setInterval(() => { if (document.visibilityState === "visible") charger(); }, 90000);
    return () => clearInterval(t);
  }, [charger, jour, today]);

  async function ajouter(e) {
    e.preventDefault();
    const r = validerEntree(form);
    if (r.erreur) { setMsg(r.erreur); return; }
    setBusy(true);
    setMsg("");
    try {
      const maintenant = new Date();
      const ref = `MC-${cleJour(maintenant).replace(/-/g, "").slice(2)}-${maintenant.toTimeString().slice(0, 8).replace(/:/g, "")}`;
      await addDoc(collection(db, "main_courante"), {
        ...r.champs, ...(form.type === TYPE_DEBUT ? { patrouilleId: ref } : {}), ref, createdAt: maintenant.toISOString(), jour: cleJour(maintenant),
        auteurUid: current.id, auteurNom: `${current.prenom} ${current.nom}`, auteurGrade: current.grade, auteurRIO: current.cipcNumero || "",
      });
      setForm({ ...valeursEntreeVides(), type: form.type });
      setMsg(`Entrée ${ref} enregistrée.`);
      if (jour !== today) setJour(today); else await charger();
    } catch (e2) { console.error(e2); setMsg("Impossible d'ajouter l'entrée : vérifie que ton service est bien pris, puis réessaie dans quelques secondes."); }
    setBusy(false);
  }
  function commencerEdition(en) {
    setEditId(en.id);
    setEditForm({
      type: estDebut(en.type) ? TYPE_DEBUT : (en.type || TYPES_MC[0]), heure: en.heure || heureDe(en), priorite: en.priorite || "Routine", lieu: en.lieu || "", description: en.description || "",
      agents: en.agents || "", personnes: en.personnes || "", vehiculeTiers: en.vehiculeTiers || "", suite: en.suite || "Aucune",
      nbAgents: en.nbAgents ? String(en.nbAgents) : "", vehicule: en.vehicule || "", plaque: en.plaque || "", materiel: en.materiel || [], membres: en.membres || [], patrouilleId: en.patrouilleId || "",
    });
  }
  async function enregistrerEdition() {
    const r = validerEntree(editForm);
    if (r.erreur) { setMsg(r.erreur); return; }
    setBusy(true);
    try {
      await updateDoc(doc(db, "main_courante", editId), { ...r.champs, modifie: true, modifiePar: `${current.prenom} ${current.nom}`, modifieLe: new Date().toISOString() });
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
  const manuelles = entries.filter((en) => !en.auto);
  const compte = (t) => manuelles.filter((en) => en.type === t || (t === TYPE_DEBUT && ANCIENS_TYPES_DEBUT.includes(en.type))).length;
  const affiches = entries
    .filter((en) => !(masquerAuto && en.auto))
    .filter((en) => filtre === "Tous" || en.type === filtre || (filtre === TYPE_DEBUT && ANCIENS_TYPES_DEBUT.includes(en.type)))
    .filter((en) => norm(`${en.type} ${en.lieu} ${en.description} ${en.agents} ${en.personnes} ${en.vehiculeTiers} ${en.auteurNom} ${en.vehicule || ""} ${en.plaque || ""} ${nomsMembres(en.membres)} ${en.ref || ""}`).includes(norm(recherche)))
    .sort((a, b) => heureDe(b).localeCompare(heureDe(a)) || String(b.createdAt).localeCompare(String(a.createdAt))); // les plus récents en haut
  const decaler = (n) => { const d = new Date(`${jour}T12:00:00`); d.setDate(d.getDate() + n); const k = cleJour(d); if (k <= today) setJour(k); };
  const dateLongue = new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const inp = { padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 14, background: "#fff", boxSizing: "border-box" };
  const card = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 20, marginBottom: 22, boxShadow: "0 6px 20px -12px rgba(7,20,46,0.3)" };

  function imprimerJournee() {
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const lignes = affiches.slice().reverse().map((en) => { // la version imprimée reste dans l'ordre chronologique
      const details = [
        estTypePatrouille(en.type) && (en.vehicule || (en.membres || []).length) ? `${en.nbAgents || (en.membres || []).length} agent(s)${(en.membres || []).length ? " (" + nomsMembres(en.membres) + ")" : ""}${en.vehicule ? " — " + en.vehicule + " (" + en.plaque + ")" : ""}${en.type !== TYPE_FIN && (en.materiel || []).length ? " — Matériel : " + en.materiel.join(", ") : ""}` : "",
        en.agents ? `Agents : ${en.agents}` : "", en.personnes ? `Personnes : ${en.personnes}` : "", en.vehiculeTiers ? `Véhicule : ${en.vehiculeTiers}` : "",
        en.suite && en.suite !== "Aucune" ? `Suite : ${en.suite}` : "",
      ].filter(Boolean).join(" | ");
      return `<tr><td>${esc(heureDe(en))}</td><td>${esc(en.type)}${en.priorite && en.priorite !== "Routine" ? `<br><b>${esc(en.priorite)}</b>` : ""}</td><td>${esc(en.lieu)}</td><td>${esc(DESCRIPTIONS_AUTO.includes(en.description) ? "" : en.description)}${details ? `<div class="d">${esc(details)}</div>` : ""}</td><td>${esc(`${en.auteurGrade || ""} ${en.auteurNom || ""}`)}${en.auteurRIO ? `<br>RIO ${esc(en.auteurRIO)}` : ""}</td></tr>`;
    }).join("");
    const w = window.open("", "_blank");
    if (!w) { setMsg("Autorise les fenêtres pop-up pour imprimer la journée."); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Main courante — ${esc(dateLongue)}</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}h1{font-size:18px;margin:0 0 2px}.s{color:#555;margin-bottom:14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top}th{background:#e6edf7}.d{color:#444;font-size:11px;margin-top:4px}.f{margin-top:16px;font-size:10px;color:#777}</style></head><body><h1>Main courante — Gendarmerie Nationale de Black RP</h1><div class="s">${esc(dateLongue)} · ${affiches.length} événement(s)</div><table><thead><tr><th style="width:50px">Heure</th><th style="width:110px">Type</th><th style="width:110px">Lieu</th><th>Faits</th><th style="width:140px">Rédigé par</th></tr></thead><tbody>${lignes || '<tr><td colspan="5">Aucun événement.</td></tr>'}</tbody></table><div class="f">Document de jeu de rôle (Roblox) — sans valeur officielle, sans lien avec la Gendarmerie nationale réelle.</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const actives = calculerPatrouillesActives(entriesPatrouille);
  const idsEnService = new Set(agentsEnService.map((a) => a.id));
  const nbAgentsPatrouille = actives.reduce((n, p) => n + p.membres.length, 0);
  const ctx = { agents: agentsEnService, actives, materiel, moi: { id: current.id, nom: `${current.prenom} ${current.nom}` } };

  const Info = ({ label, children }) => (children ? <div style={{ fontSize: 12.5, marginTop: 3 }}><span style={{ color: "#5A6B84", fontWeight: 600 }}>{label} : </span>{children}</div> : null);

  return (
    <div style={{ maxWidth: 940 }}>
      <h2 style={h2Style}>Main courante</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Entrées du jour", v: manuelles.length, c: "#123A7A" },
          { l: "Interventions", v: compte("Intervention"), c: "#C0172D" },
          { l: "Incidents", v: compte("Incident"), c: "#B25E00" },
          { l: "Agents en service", v: nbEnService, c: "#2E7D4F" },
          { l: "Patrouilles actives", v: actives.length, c: "#7B3FA0" },
        ].map((x) => (
          <div key={x.l} style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${x.c}`, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: x.c, lineHeight: 1.1 }}>{x.v}</div>
            <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{x.l}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: "14px 16px", marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#14213A", marginBottom: 10 }}>🚓 Patrouilles actives ({actives.length}) · {nbAgentsPatrouille} agent{nbAgentsPatrouille > 1 ? "s" : ""} sur le terrain</div>
        {actives.length === 0 ? (
          <div style={{ fontSize: 13, color: "#5A6B84" }}>Aucune patrouille en cours.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {actives.map((p) => (
              <div key={p.id} style={{ border: "1px solid #D3DDEA", borderLeft: "5px solid #7B3FA0", borderRadius: 10, padding: "10px 12px", background: "#FBFCFE" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.vehicule || "Patrouille"} {p.plaque && <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12.5 }}>{p.plaque}</span>}</div>
                <div style={{ fontSize: 12, color: "#5A6B84", margin: "2px 0 8px" }}>Depuis {p.debut} · {p.membres.length} agent{p.membres.length > 1 ? "s" : ""}{p.changements > 0 ? ` · ${p.changements} changement${p.changements > 1 ? "s" : ""}` : ""}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {p.membres.map((m) => <span key={m.id} style={{ background: idsEnService.has(m.id) ? "#E6EDF7" : "#F3E3E3", color: idsEnService.has(m.id) ? "#123A7A" : "#8A2A2A", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 12 }} title={idsEnService.has(m.id) ? "" : "N'est plus en service"}>{m.nom}</span>)}
                </div>
                {p.materiel.length > 0 && <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 7 }}>Matériel : {p.materiel.join(", ")}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {current.isAdmin && onSaveMateriel && <GestionMateriel liste={materiel} onSave={onSaveMateriel} />}

      {enService ? (
        <form onSubmit={ajouter} style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "#14213A" }}>Nouvelle entrée</div>
          <FormulaireEntree v={form} onChange={setForm} ctx={ctx} />
          <button type="submit" disabled={busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "10px 24px", marginTop: 0 }}>{busy ? "Enregistrement…" : "Enregistrer dans la main courante"}</button>
        </form>
      ) : (
        <div style={{ ...card, background: "#FFF4D6", borderColor: "#E8D28A", color: "#6B4E00", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Tu n'es pas en service : tu peux consulter la main courante, mais pas y ajouter d'entrée.</div>
          <button onClick={onGoService} style={smallBtn}>Prendre mon service</button>
        </div>
      )}
      {msg && <div style={{ fontSize: 12.5, color: msg.startsWith("Entrée") || msg.startsWith("Entrée modifiée") ? "#1F6B42" : "#C0172D", marginBottom: 14, fontWeight: 600 }}>{msg}</div>}

      <div style={{ ...card, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button style={smallBtn} onClick={() => decaler(-1)}>←</button>
          <input type="date" value={jour} max={today} onChange={(e) => e.target.value && setJour(e.target.value)} style={inp} />
          <button style={smallBtn} onClick={() => decaler(1)} disabled={jour >= today}>→</button>
          {jour !== today && <button style={smallBtn} onClick={() => setJour(today)}>Aujourd'hui</button>}
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (lieu, plaque, nom, référence…)" style={{ ...inp, flex: 1, minWidth: 200 }} />
          <button style={smallBtn} onClick={charger}>↻ Actualiser</button>
          <button style={smallBtn} onClick={imprimerJournee}>🖨 Imprimer la journée</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          {["Tous", ...TYPES_MC].map((t) => {
            const n = t === "Tous" ? entries.length : compte(t);
            const actif = filtre === t;
            return <button key={t} onClick={() => setFiltre(t)} style={{ border: "1px solid #C3D0E2", background: actif ? "#123A7A" : "#fff", color: actif ? "#fff" : "#14213A", borderRadius: 16, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t} <span style={{ opacity: 0.7 }}>({n})</span></button>;
          })}
          <label style={{ fontSize: 12, color: "#5A6B84", display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <input type="checkbox" checked={masquerAuto} onChange={(e) => setMasquerAuto(e.target.checked)} /> Masquer les lignes automatiques
          </label>
        </div>
      </div>

      <div style={{ fontFamily: FONT_TITRE, fontSize: 20, fontWeight: 700, textTransform: "capitalize", margin: "18px 0 12px", color: "#14213A" }}>{loading ? "Chargement…" : `${dateLongue} — ${affiches.length} événement${affiches.length > 1 ? "s" : ""}`}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affiches.map((en) => {
          const couleur = COULEURS_MC[en.type] || "#3A4D6B";
          const heure = heureDe(en);
          const modifiable = canEdit || canDelete;

          if (en.auto && editId !== en.id) {
            return (
              <div key={en.id} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 12, alignItems: "center" }}>
                <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 13, color: "#6B7A90", textAlign: "right" }}>{heure}</div>
                <div style={{ background: "#F2F5FA", border: "1px dashed #C3D0E2", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, color: "#3A4D6B", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span>🤖 {en.description} <span style={{ color: "#6B7A90" }}>— {en.auteurGrade} {en.auteurNom}</span></span>
                  {modifiable && (
                    <span style={{ display: "flex", gap: 6 }}>
                      {canEdit && <button style={{ ...smallBtn, padding: "3px 9px", fontSize: 11 }} onClick={() => commencerEdition(en)}>Modifier</button>}
                      {canDelete && <button style={{ ...smallBtn, padding: "3px 9px", fontSize: 11, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => supprimer(en)}>Supprimer</button>}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          if (editId === en.id && editForm) {
            return (
              <div key={en.id} style={{ ...card, marginBottom: 0, borderLeft: `5px solid ${couleur}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Modifier l'entrée {en.ref || ""}</div>
                <FormulaireEntree v={editForm} onChange={setEditForm} edition ctx={ctx} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button disabled={busy} onClick={enregistrerEdition} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 0 }}>Enregistrer</button>
                  <button onClick={() => { setEditId(null); setEditForm(null); }} style={smallBtn}>Annuler</button>
                </div>
              </div>
            );
          }

          const prio = en.priorite && en.priorite !== "Routine" ? en.priorite : null;
          return (
            <div key={en.id} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 12 }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 800, fontSize: 15, color: "#14213A", textAlign: "right", paddingTop: 14 }} title={`Saisi à ${new Date(en.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}>{heure}</div>
              <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${prio ? COULEURS_PRIO[prio] : couleur}`, borderRadius: 12, padding: "14px 16px", boxShadow: "0 3px 12px -9px rgba(7,20,46,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ background: couleur, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12 }}>{en.type}</span>
                    {prio && <span style={{ background: COULEURS_PRIO[prio], color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 12 }}>{prio === "Urgent" ? "⚠ URGENT" : "IMPORTANT"}</span>}
                    {en.lieu && <span style={{ fontSize: 12.5, color: "#3A4D6B", fontWeight: 600 }}>📍 {en.lieu}</span>}
                  </div>
                  {en.ref && <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#6B7A90" }}>{en.ref}</span>}
                </div>

                {estTypePatrouille(en.type) && (en.vehicule || (en.membres || []).length > 0) && (
                  <div style={{ marginTop: 10, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}>
                    <div><b>{en.nbAgents || (en.membres || []).length}</b> agent{(en.nbAgents || (en.membres || []).length) > 1 ? "s" : ""}{en.vehicule ? <> · 🚓 {en.vehicule} — <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700 }}>{en.plaque}</span></> : null}</div>
                    {(en.membres || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                        {en.membres.map((m) => <span key={m.id} style={{ background: "#fff", border: "1px solid #C3D0E2", color: "#14213A", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 12 }}>👤 {m.nom}</span>)}
                      </div>
                    )}
                    {en.type !== TYPE_FIN && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                        {(en.materiel || []).length > 0
                          ? en.materiel.map((m) => <span key={m} style={{ background: "#E6EDF7", color: "#123A7A", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 12 }}>{m}</span>)
                          : <span style={{ color: "#5A6B84", fontSize: 12 }}>Aucun matériel spécifique</span>}
                      </div>
                    )}
                  </div>
                )}

                {en.description && !DESCRIPTIONS_AUTO.includes(en.description) && <div style={{ fontSize: 14, marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.55, color: "#14213A" }}>{en.description}</div>}

                <div style={{ marginTop: 6 }}>
                  <Info label="Agents">{en.agents}</Info>
                  <Info label="Personnes impliquées">{en.personnes}</Info>
                  <Info label="Véhicule concerné">{en.vehiculeTiers}</Info>
                  <Info label="Suite donnée">{en.suite && en.suite !== "Aucune" ? en.suite : ""}</Info>
                </div>

                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #EAF0F7", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 11.5, color: "#5A6B84" }}>Rédigé par <b>{en.auteurGrade} {en.auteurNom}</b>{en.auteurRIO ? ` · RIO ${en.auteurRIO}` : ""}</div>
                  {modifiable && (
                    <div style={{ display: "flex", gap: 6 }}>
                      {canEdit && <button style={smallBtn} onClick={() => commencerEdition(en)}>Modifier</button>}
                      {canDelete && <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => supprimer(en)}>Supprimer</button>}
                    </div>
                  )}
                </div>
                {en.modifie && <div style={{ fontSize: 11, color: "#B25E00", marginTop: 6 }}>✎ Modifié par {en.modifiePar} le {new Date(en.modifieLe).toLocaleString("fr-FR")}</div>}
              </div>
            </div>
          );
        })}
        {!loading && affiches.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13, padding: "16px 0" }}>Aucun événement{filtre !== "Tous" || recherche ? " ne correspond à ce filtre" : " enregistré ce jour-là"}.</div>}
      </div>
    </div>
  );
}

/* ---------- Écran de connexion ---------- */

/* ---------- Création de compte gendarme (Prénom RP + NOM RP, puis Discord) ---------- */

const MOTIF_NOM_RP = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const formaterNomRP = (s) => String(s || "").replace(/\s+/g, " ").trim().toLocaleUpperCase("fr-FR");
const formaterPrenomRP = (s) => String(s || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr-FR").replace(/(^|[ '’-])([a-zà-öø-ÿ])/g, (m, sep, l) => sep + l.toLocaleUpperCase("fr-FR"));

function CreerCompteScreen({ onBack, onLogin }) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState("");
  const prenomOk = formaterPrenomRP(prenom);
  const nomOk = formaterNomRP(nom);

  function continuer(e) {
    e.preventDefault();
    if (prenomOk.length < 2 || !MOTIF_NOM_RP.test(prenomOk)) { setErreur("Indique ton Prénom RP (lettres uniquement)."); return; }
    if (nomOk.length < 2 || !MOTIF_NOM_RP.test(nomOk)) { setErreur("Indique ton NOM RP (lettres uniquement)."); return; }
    setErreur("");
    window.location.href = `/api/discord?mode=creation&prenom=${encodeURIComponent(prenomOk)}&nom=${encodeURIComponent(nomOk)}`;
  }

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 15%, #123A7A, #07142E 62%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_BASE }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#8FA0B8", fontSize: 12, cursor: "pointer", marginBottom: 16 }}>← Retour à l'accueil</button>
        <div style={{ textAlign: "center", marginBottom: 22, color: "#F2F6FC" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6 }}>GENDARMERIE NATIONALE DE BLACK RP</div>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 30, fontWeight: 700, marginTop: 4 }}>Créer mon compte</div>
        </div>
        <form onSubmit={continuer} style={{ background: "#F2F6FC", borderRadius: 14, padding: 24, boxShadow: "0 18px 40px -16px rgba(0,0,0,0.6)" }}>
          <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 16, lineHeight: 1.5 }}>Indique l'identité de ton personnage <b>sur le serveur RP</b> (pas ton vrai nom), puis valide avec Discord.</div>
          <Field label="Prénom RP" value={prenom} onChange={setPrenom} placeholder="Ex : Jean" autoFocus />
          <Field label="NOM RP" value={nom} onChange={(v) => setNom(v.toLocaleUpperCase("fr-FR"))} placeholder="Ex : DUPONT" />
          {(prenomOk || nomOk) && (
            <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 12 }}>Ton compte s'appellera : <b style={{ color: "#14213A" }}>{prenomOk} {nomOk}</b></div>
          )}
          {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
          <button type="submit" style={{ ...buttonPrimary, background: "#5865F2", marginTop: 0 }}>Continuer avec Discord</button>
          <div style={{ textAlign: "center", color: "#5A6B84", fontSize: 12, marginTop: 10 }}>Réservé aux membres ayant le rôle « Militaire Engagé » sur le Discord.</div>
          <div style={{ borderTop: "1px solid #D3DDEA", margin: "16px 0 10px" }} />
          <button type="button" onClick={onLogin} style={{ background: "none", border: "none", color: "#123A7A", fontSize: 12.5, cursor: "pointer", width: "100%", textDecoration: "underline" }}>J'ai déjà un compte : me connecter</button>
        </form>
      </div>
    </div>
  );
}

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
          <div style={{ fontFamily: FONT_TITRE, fontSize: 22, fontWeight: 700, color: "#14213A", textAlign: "center", marginBottom: 14 }}>Connexion</div>
          <a href="/api/discord?mode=connexion" style={{ display: "block", textAlign: "center", textDecoration: "none", background: "#5865F2", color: "#fff", borderRadius: 10, padding: "13px 14px", fontSize: 15, fontWeight: 700 }}>Se connecter avec Discord</a>
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
        { id: "services-equipe", label: "Services de l'équipe" },
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
        { id: "mes-sanctions", label: "Mes sanctions" },
        { id: "promotions", label: "Promotions" },
        ...(isAdmin || isHautGrade ? [{ id: "sanctions", label: "Sanctions" }] : []),
        ...(isAdmin ? [{ id: "admin-personnel", label: "Gestion du personnel" }] : []),
        ...(isAdmin ? [{ id: "roles", label: "Rôles & Permissions" }] : []),
        ...(isAdmin ? [{ id: "admin-questionnaires", label: "Questionnaires" }] : []),
        ...(isAdmin ? [{ id: "admin-modeles-pv", label: "Modèles de PV" }] : []),
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

function AdminPanel({ personnel, roles, onCreate, onDelete, onUpdate, onAssignRIO }) {
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
            <Select label="Qualité judiciaire (carte)" value={form.qualiteJudiciaire} onChange={(v) => setForm({ ...form, qualiteJudiciaire: v })} options={["OPJ", "APJ", "APJA"]} />
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
  // (les éléments archivés sont supprimés automatiquement au bout de 7 jours)
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <button onClick={() => setTab("en-cours")} style={{ ...smallBtn, background: tab === "en-cours" ? "#123A7A" : "transparent", color: tab === "en-cours" ? "#fff" : "#14213A", borderColor: tab === "en-cours" ? "#123A7A" : "#C3D0E2" }}>En cours ({countEnCours})</button>
      <button onClick={() => setTab("archivees")} style={{ ...smallBtn, background: tab === "archivees" ? "#5A6B84" : "transparent", color: tab === "archivees" ? "#fff" : "#14213A", borderColor: tab === "archivees" ? "#5A6B84" : "#C3D0E2" }}>📁 Archivées ({countArchivees})</button>
      <span style={{ fontSize: 11.5, color: "#5A6B84", alignSelf: "center", marginLeft: 6 }}>🗑 Les archives sont supprimées au bout de 7 jours.</span>
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

// Registre des plaintes : plaintes en ligne + plaintes prises en brigade (procès-verbaux de plainte), au même endroit
const estPVPlainte = (pv) => pv.modeleType === "Plainte" || /plainte/i.test(pv.modeleTitre || "");

function AdminPlaintes({ plaintes, pvs = [], current, onUpdateStatut, onTakeCharge, onVisa }) {
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

/* ---------- Sanctions disciplinaires ---------- */

const SANCTION_TYPES = [
  { type: "Mise en garde", defaultDuree: 3, couleur: "#B7791F", fond: "#FFF6E0", gravite: 1 },
  { type: "Avertissement 1", defaultDuree: 7, couleur: "#B25E00", fond: "#FFEBD6", gravite: 2 },
  { type: "Avertissement 2", defaultDuree: 14, couleur: "#D1471F", fond: "#FDE3DA", gravite: 3 },
  { type: "Mise à pied", defaultDuree: 7, couleur: "#8A1020", fond: "#F8DADF", gravite: 4 },
];
const styleSanction = (type) => SANCTION_TYPES.find((t) => t.type === type) || { couleur: "#C0172D", fond: "#FDECEC", gravite: 1 };
const sanctionActive = (s, maintenant) => !s.levee && new Date(s.dateFin) > maintenant;
const dateHeureSanction = (iso) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
function fmtRestantSanction(ms) {
  if (ms <= 0) return "terminée";
  const m = Math.floor(ms / 60000);
  const j = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (j > 0) return `${j} j ${h} h`;
  if (h > 0) return `${h} h ${mm} min`;
  return `${Math.max(1, mm)} min`;
}

// Carte d'une sanction : le motif est toujours visible (utilisée par les chefs et par le gendarme concerné)
function CarteSanction({ s, maintenant, voirCible, action }) {
  const st = styleSanction(s.type);
  const active = sanctionActive(s, maintenant);
  const total = new Date(s.dateFin) - new Date(s.dateDebut);
  const ecoule = Math.min(total, Math.max(0, maintenant - new Date(s.dateDebut)));
  const pct = total > 0 ? (ecoule / total) * 100 : 100;
  const couleur = active ? st.couleur : "#8FA0B8";
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${couleur}`, borderRadius: 12, padding: "14px 16px", boxShadow: active ? "0 4px 16px -10px rgba(7,20,46,0.3)" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ background: couleur, color: "#fff", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, borderRadius: 20, padding: "3px 11px" }}>{s.type}</span>
          {voirCible && <span style={{ fontWeight: 700, fontSize: 14, color: "#14213A" }}>{s.nomCible} <span style={{ fontWeight: 400, fontSize: 12, color: "#5A6B84" }}>({s.matricule})</span></span>}
          {s.levee && <span style={{ fontSize: 11, fontWeight: 700, color: "#1F6B42", background: "#E3F2E8", borderRadius: 10, padding: "2px 9px" }}>Levée</span>}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: active ? st.couleur : "#7B8AA3" }}>
          {active ? `⏳ ${fmtRestantSanction(new Date(s.dateFin) - maintenant)} restant` : s.levee ? `Levée le ${new Date(s.leveeLe).toLocaleDateString("fr-FR")}` : `Terminée le ${new Date(s.dateFin).toLocaleDateString("fr-FR")}`}
        </div>
      </div>
      <div style={{ background: active ? st.fond : "#F5F8FC", borderRadius: 8, padding: "10px 12px", marginTop: 10 }}>
        <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 3 }}>Motif</div>
        <div style={{ fontSize: 13.5, color: "#14213A", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{s.motif}</div>
      </div>
      {active && (
        <div style={{ height: 6, background: "#E6EDF7", borderRadius: 4, overflow: "hidden", marginTop: 12 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: st.couleur, borderRadius: 4 }} />
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 8, lineHeight: 1.5 }}>
        Du {dateHeureSanction(s.dateDebut)} au {dateHeureSanction(s.dateFin)} · {s.dureeJours} jour{s.dureeJours > 1 ? "s" : ""} · émise par {s.emisParNom}
        {s.levee && s.leveePar ? ` · levée par ${s.leveePar}` : ""}
      </div>
      {s.roleDiscordId && (
        <div style={{ fontSize: 11.5, marginTop: 6, color: s.statutDiscord === "erreur" ? "#8A2A2A" : "#4752C4", fontWeight: 600 }}>
          {s.statutDiscord === "erreur" ? "⚠️ Rôle Discord de sanction non attribué (à vérifier)" : active ? "🎭 Rôle Discord de sanction attribué pendant la durée de la sanction" : "🎭 Rôle Discord de sanction retiré"}
        </div>
      )}
      {action}
    </div>
  );
}

function SanctionsPage({ current, personnel, sanctions, onIssue, onLever, sanctionRoles = {}, onSaveRoles }) {
  const rangCourant = current.gradeRank ?? GRADES.indexOf(current.grade);
  const canIssue = current.isAdmin || rangCourant >= DISCIPLINE_MIN_INDEX;
  const cibles = personnel.filter((p) => p.id !== current.id && (p.gradeRank ?? GRADES.indexOf(p.grade)) < rangCourant);
  const maintenant = new Date(useNow(60000));

  const blank = { matricule: "", type: SANCTION_TYPES[0].type, dureeJours: SANCTION_TYPES[0].defaultDuree, motif: "" };
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState("");
  const [erreur, setErreur] = useState("");
  const [recherche, setRecherche] = useState("");
  const [rolesEdit, setRolesEdit] = useState(sanctionRoles);
  const [rolesEtat, setRolesEtat] = useState("");
  useEffect(() => { setRolesEdit(sanctionRoles); }, [sanctionRoles]);

  const cible = personnel.find((p) => p.matricule === form.matricule);
  const st = styleSanction(form.type);
  const duree = Math.floor(Number(form.dureeJours));
  const finPrevue = duree > 0 ? new Date(maintenant.getTime() + duree * 86400000) : null;
  const roleConfigure = (sanctionRoles || {})[form.type];

  async function submit(e) {
    e.preventDefault();
    if (!cible) { setErreur("Choisis le personnel visé."); return; }
    if (!(duree >= 1 && duree <= 365)) { setErreur("La durée doit être comprise entre 1 et 365 jours."); return; }
    if (form.motif.trim().length < 10) { setErreur("Explique le motif en quelques mots (10 caractères minimum) : le gendarme le verra."); return; }
    setErreur("");
    const res = await onIssue({ ...form, dureeJours: duree, nomCible: `${cible.prenom} ${cible.nom}` });
    if (res.ok) { setMsg("Sanction enregistrée. Le gendarme peut consulter le motif dans « Mes sanctions »."); setForm(blank); setTimeout(() => setMsg(""), 6000); }
    else setErreur(res.error || "Échec de l'envoi.");
  }

  const q = recherche.trim().toLowerCase();
  const filtre = (s) => !q || `${s.nomCible} ${s.matricule} ${s.type} ${s.motif}`.toLowerCase().includes(q);
  const actives = sanctions.filter((s) => sanctionActive(s, maintenant) && filtre(s)).sort((a, b) => new Date(a.dateFin) - new Date(b.dateFin));
  const passees = sanctions.filter((s) => !sanctionActive(s, maintenant) && filtre(s)).sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));
  const toutesActives = sanctions.filter((s) => sanctionActive(s, maintenant));
  const sanctionnes = new Set(toutesActives.map((s) => s.matricule)).size;
  const recentes = sanctions.filter((s) => maintenant - new Date(s.dateDebut) < 30 * 86400000).length;

  const tuile = (l, v, c) => (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );

  async function enregistrerRoles() {
    const propre = {};
    Object.keys(rolesEdit).forEach((k) => { const v = String(rolesEdit[k] || "").replace(/\D/g, ""); if (v) propre[k] = v; });
    setRolesEtat("Enregistrement…");
    const ok = await onSaveRoles(propre);
    setRolesEtat(ok ? "Rôles enregistrés." : "Échec de l'enregistrement.");
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={h2Style}>Sanctions disciplinaires</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 22 }}>
        {tuile("Sanctions actives", toutesActives.length, "#C0172D")}
        {tuile("Agents sanctionnés", sanctionnes, "#B25E00")}
        {tuile("Émises ces 30 jours", recentes, "#123A7A")}
      </div>

      {canIssue && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, fontFamily: FONT_TITRE }}>Émettre une sanction</div>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Personnel visé</label>
              <select value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} style={selectStyle}>
                <option value="">— Choisir —</option>
                {cibles.map((p) => <option key={p.id} value={p.matricule}>{p.prenom} {p.nom} ({p.grade})</option>)}
              </select>
            </div>
            <label style={labelStyle}>Type de sanction</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {SANCTION_TYPES.map((t) => {
                const sel = form.type === t.type;
                return (
                  <button type="button" key={t.type} onClick={() => setForm({ ...form, type: t.type, dureeJours: t.defaultDuree })} style={{ border: `1.5px solid ${t.couleur}`, background: sel ? t.couleur : "#fff", color: sel ? "#fff" : t.couleur, borderRadius: 20, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{t.type}</button>
                );
              })}
            </div>
            <label style={labelStyle}>Durée</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
              {[1, 3, 7, 14, 30].map((j) => (
                <button type="button" key={j} onClick={() => setForm({ ...form, dureeJours: j })} style={{ ...smallBtn, background: duree === j ? "#123A7A" : "transparent", color: duree === j ? "#fff" : "#14213A", borderColor: duree === j ? "#123A7A" : "#C3D0E2" }}>{j} j</button>
              ))}
              <input type="number" min="1" max="365" value={form.dureeJours} onChange={(e) => setForm({ ...form, dureeJours: e.target.value })} style={{ width: 90, padding: "7px 9px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5 }} />
              <span style={{ fontSize: 12.5, color: "#5A6B84" }}>jours</span>
            </div>
            <Field label="Motif (visible par le gendarme sanctionné)" textarea value={form.motif} onChange={(v) => setForm({ ...form, motif: v })} placeholder="Décris précisément les faits reprochés…" />
            <div style={{ fontSize: 11.5, color: form.motif.trim().length >= 10 ? "#5A6B84" : "#B25E00", margin: "-6px 0 12px" }}>{form.motif.trim().length} caractère(s) — 10 minimum</div>
            {cible && finPrevue && (
              <div style={{ background: st.fond, border: `1px solid ${st.couleur}`, borderRadius: 10, padding: "11px 14px", fontSize: 13, color: "#14213A", marginBottom: 14, lineHeight: 1.55 }}>
                <b>{form.type}</b> pour <b>{cible.prenom} {cible.nom}</b> jusqu'au <b>{dateHeureSanction(finPrevue.toISOString())}</b>.
                {roleConfigure ? <><br />🎭 Le rôle Discord de cette sanction lui sera attribué, puis retiré automatiquement à la fin.</> : null}
              </div>
            )}
            {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
            {msg && <div style={{ color: "#2E7D4F", fontSize: 12.5, marginBottom: 10, fontWeight: 600 }}>{msg}</div>}
            <button type="submit" className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "10px 22px", background: "#C0172D" }}>Émettre la sanction</button>
          </form>
        </div>
      )}

      {current.isAdmin && onSaveRoles && (
        <details style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 16px", marginBottom: 22 }}>
          <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#4752C4" }}>🎭 Rôles Discord des sanctions (admin)</summary>
          <div style={{ fontSize: 12.5, color: "#5A6B84", margin: "10px 0" }}>Colle l'ID du rôle Discord pour chaque type (Discord → clic droit sur le rôle → « Copier l'ID du rôle »). Le rôle est donné au gendarme pendant la sanction uniquement, puis retiré. Laisse vide pour ne pas utiliser de rôle.</div>
          {SANCTION_TYPES.map((t) => (
            <div key={t.type} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.couleur }}>{t.type}</span>
              <input value={rolesEdit[t.type] || ""} onChange={(e) => setRolesEdit({ ...rolesEdit, [t.type]: e.target.value })} placeholder="ID du rôle Discord" style={{ padding: "8px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, fontFamily: "'Courier New', monospace" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <button type="button" onClick={enregistrerRoles} style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 0 }}>Enregistrer</button>
            {rolesEtat && <span style={{ fontSize: 12.5, color: rolesEtat.startsWith("Rôles") ? "#1F6B42" : "#5A6B84", fontWeight: 600 }}>{rolesEtat}</span>}
          </div>
        </details>
      )}

      <div style={{ marginBottom: 14, maxWidth: 360 }}>
        <Field label="Rechercher" value={recherche} onChange={setRecherche} placeholder="Nom, matricule, type, motif…" />
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8, fontWeight: 700 }}>Sanctions actives ({actives.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {actives.map((s) => (
          <CarteSanction key={s.id} s={s} maintenant={maintenant} voirCible action={current.isAdmin && onLever ? (
            <div style={{ marginTop: 10 }}><button style={smallBtn} onClick={() => { if (window.confirm(`Lever la sanction « ${s.type} » de ${s.nomCible} ? Son rôle Discord de sanction sera retiré.`)) onLever(s.id); }}>Lever la sanction</button></div>
          ) : null} />
        ))}
        {actives.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune sanction active.</div>}
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8, fontWeight: 700 }}>Historique ({passees.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {passees.map((s) => <CarteSanction key={s.id} s={s} maintenant={maintenant} voirCible />)}
        {passees.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun historique.</div>}
      </div>
    </div>
  );
}

// Visible par tous les gendarmes : leurs propres sanctions, avec le motif
function MesSanctionsPage({ current, sanctions }) {
  const maintenant = new Date(useNow(60000));
  const miennes = sanctions.filter((s) => s.matricule === current.matricule);
  const actives = miennes.filter((s) => sanctionActive(s, maintenant)).sort((a, b) => new Date(a.dateFin) - new Date(b.dateFin));
  const passees = miennes.filter((s) => !sanctionActive(s, maintenant)).sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));
  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={h2Style}>Mes sanctions</h2>
      {actives.length === 0 ? (
        <div style={{ background: "#E3F2E8", border: "1px solid #2E7D4F", color: "#1F6B42", borderRadius: 12, padding: "16px 18px", fontSize: 14, fontWeight: 600, marginBottom: 24 }}>✅ Tu n'as aucune sanction en cours.</div>
      ) : (
        <>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#C0172D", marginBottom: 8, fontWeight: 700 }}>Sanctions en cours ({actives.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
            {actives.map((s) => <CarteSanction key={s.id} s={s} maintenant={maintenant} />)}
          </div>
        </>
      )}
      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8, fontWeight: 700 }}>Historique ({passees.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {passees.map((s) => <CarteSanction key={s.id} s={s} maintenant={maintenant} />)}
        {passees.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune sanction passée.</div>}
      </div>
      <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 18 }}>Pour contester une sanction, adresse-toi à ton commandement.</div>
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
  const [motif, setMotif] = useState("");
  const [msg, setMsg] = useState("");
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("Tous");
  const [recherche, setRecherche] = useState("");

  const cible = personnel.find((p) => p.matricule === matricule);
  const rangCible = cible ? (cible.gradeRank ?? GRADES.indexOf(cible.grade)) : -1;
  const suivant = cible && rangCible + 1 < currentRank ? GRADES[rangCible + 1] : null;
  const precedent = cible && rangCible - 1 >= 0 ? GRADES[rangCible - 1] : null;
  const idxNouveau = nouveauGrade ? GRADES.indexOf(nouveauGrade) : -1;
  const mouvement = cible && nouveauGrade ? (idxNouveau > rangCible ? "Promotion" : idxNouveau < rangCible ? "Rétrogradation" : "") : "";

  async function submit(e) {
    e.preventDefault();
    if (!cible) { setErreur("Choisis le personnel visé."); return; }
    if (!nouveauGrade || !mouvement) { setErreur("Choisis un nouveau grade différent du grade actuel."); return; }
    if (mouvement === "Rétrogradation" && motif.trim().length < 5) { setErreur("Indique le motif de la rétrogradation."); return; }
    setErreur("");
    const res = await onIssue(cible, nouveauGrade, motif.trim());
    if (res.ok) { setMsg("Grade mis à jour (le rôle Discord est synchronisé automatiquement)."); setMatricule(""); setNouveauGrade(""); setMotif(""); setTimeout(() => setMsg(""), 6000); }
    else setErreur(res.error || "Échec de l'opération.");
  }

  const il30 = Date.now() - 30 * 86400000;
  const recents = promotions.filter((p) => new Date(p.createdAt).getTime() > il30);
  const q = recherche.trim().toLowerCase();
  const liste = promotions
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((p) => (filtre === "Tous" || p.type === filtre) && (!q || `${p.nomCible} ${p.matricule} ${p.ancienGrade} ${p.nouveauGrade} ${p.motif || ""}`.toLowerCase().includes(q)));

  const tuile = (l, v, c) => (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );
  const chipGrade = (g, c) => <span style={{ background: "#fff", border: `1px solid ${c}`, color: c, borderRadius: 14, padding: "3px 11px", fontSize: 12, fontWeight: 700 }}>{g}</span>;
  const couleurMvt = (t) => (t === "Promotion" ? "#2E7D4F" : "#C0172D");

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={h2Style}>Promotions & Rétrogradations</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 22 }}>
        {tuile("Promotions (30 jours)", recents.filter((p) => p.type === "Promotion").length, "#2E7D4F")}
        {tuile("Rétrogradations (30 jours)", recents.filter((p) => p.type !== "Promotion").length, "#C0172D")}
        {tuile("Mouvements au total", promotions.length, "#123A7A")}
      </div>

      {canIssue && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 26, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, fontFamily: FONT_TITRE }}>Changer le grade d'un subordonné</div>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Personnel visé</label>
              <select value={matricule} onChange={(e) => { setMatricule(e.target.value); setNouveauGrade(""); }} style={selectStyle}>
                <option value="">— Choisir —</option>
                {cibles.map((p) => <option key={p.id} value={p.matricule}>{p.prenom} {p.nom} ({p.grade})</option>)}
              </select>
            </div>
            {cible && (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <button type="button" disabled={!suivant} onClick={() => setNouveauGrade(suivant)} style={{ ...smallBtn, opacity: suivant ? 1 : 0.4, borderColor: "#2E7D4F", color: "#2E7D4F" }}>⬆️ Grade suivant{suivant ? ` : ${suivant}` : ""}</button>
                  <button type="button" disabled={!precedent} onClick={() => setNouveauGrade(precedent)} style={{ ...smallBtn, opacity: precedent ? 1 : 0.4, borderColor: "#C0172D", color: "#C0172D" }}>⬇️ Grade précédent{precedent ? ` : ${precedent}` : ""}</button>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Ou choisir un autre grade</label>
                  <select value={nouveauGrade} onChange={(e) => setNouveauGrade(e.target.value)} style={selectStyle}>
                    <option value="">— Choisir —</option>
                    {gradesDisponibles.filter((g) => g !== cible.grade).map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </>
            )}
            {mouvement && (
              <div style={{ background: mouvement === "Promotion" ? "#E3F2E8" : "#FDECEC", border: `1px solid ${couleurMvt(mouvement)}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: couleurMvt(mouvement), marginBottom: 8 }}>{mouvement === "Promotion" ? "⬆️ PROMOTION" : "⬇️ RÉTROGRADATION"} — {cible.prenom} {cible.nom}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {chipGrade(cible.grade, "#5A6B84")}<span style={{ fontWeight: 700 }}>→</span>{chipGrade(nouveauGrade, couleurMvt(mouvement))}
                </div>
              </div>
            )}
            <Field label={mouvement === "Rétrogradation" ? "Motif (obligatoire)" : "Motif / commentaire (facultatif)"} textarea value={motif} onChange={setMotif} placeholder={mouvement === "Rétrogradation" ? "Pourquoi cette rétrogradation ?" : "Ex : félicitations pour l'investissement…"} />
            {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
            {msg && <div style={{ color: "#2E7D4F", fontSize: 12.5, marginBottom: 10, fontWeight: 600 }}>{msg}</div>}
            <button type="submit" className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "10px 22px", background: mouvement === "Rétrogradation" ? "#C0172D" : "#2E7D4F" }}>{mouvement ? `Valider la ${mouvement.toLowerCase()}` : "Valider"}</button>
          </form>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
        <div style={{ flex: "1 1 220px", maxWidth: 340 }}><Field label="Rechercher" value={recherche} onChange={setRecherche} placeholder="Nom, grade, motif…" /></div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {["Tous", "Promotion", "Rétrogradation"].map((f) => (
            <button key={f} onClick={() => setFiltre(f)} style={{ ...smallBtn, background: filtre === f ? "#123A7A" : "transparent", color: filtre === f ? "#fff" : "#14213A", borderColor: filtre === f ? "#123A7A" : "#C3D0E2" }}>{f === "Tous" ? "Tous" : f + "s"}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {liste.map((p) => {
          const c = couleurMvt(p.type);
          return (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${c}`, borderRadius: 12, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.type === "Promotion" ? "⬆️" : "⬇️"} {p.nomCible}</div>
                <span style={{ background: c, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 11px" }}>{p.type}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "10px 0 6px" }}>
                {chipGrade(p.ancienGrade, "#5A6B84")}<span style={{ fontWeight: 700 }}>→</span>{chipGrade(p.nouveauGrade, c)}
              </div>
              {p.motif && <div style={{ fontSize: 13, color: "#2A3B57", background: "#F5F8FC", borderRadius: 8, padding: "8px 11px", margin: "8px 0", whiteSpace: "pre-wrap" }}>{p.motif}</div>}
              <div style={{ fontSize: 11.5, color: "#5A6B84" }}>Par {p.emisParNom} · {new Date(p.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
          );
        })}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun mouvement de grade trouvé.</div>}
      </div>
    </div>
  );
}

/* ---------- Journal d'activité (admin) ---------- */

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

/* ---------- Règlements (gendarmes, civils ou tout le monde) ---------- */

const AUDIENCES_REGLEMENT = [
  { id: "gendarmes", label: "Gendarmes", color: "#123A7A", icone: "🛡️" },
  { id: "civils", label: "Civils", color: "#2E7D4F", icone: "👥" },
  { id: "tous", label: "Tout le monde", color: "#B7791F", icone: "🌐" },
];
function audienceReglement(r) { return AUDIENCES_REGLEMENT.find((a) => a.id === r.audience) || AUDIENCES_REGLEMENT[0]; }
function trierReglements(liste) {
  return liste.slice().sort((a, b) => {
    const oa = a.ordre === undefined || a.ordre === null ? 1e9 : Number(a.ordre);
    const ob = b.ordre === undefined || b.ordre === null ? 1e9 : Number(b.ordre);
    if (oa !== ob) return oa - ob;
    return String(a.createdAt || a.updatedAt || "").localeCompare(String(b.createdAt || b.updatedAt || ""));
  });
}
function dateLongue(iso) {
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }); } catch (e) { return ""; }
}
function reglementCorrespond(r, s) {
  if (!s) return true;
  return [r.titre, r.contenu, r.categorie].join(" ").toLowerCase().includes(s);
}

// Règlements visibles par les civils (sans connexion) : seulement ceux marqués « civils » ou « tout le monde »
async function loadReglementsPublics() {
  const snap = await getDocs(query(collection(db, "reglements"), where("audience", "in", ["civils", "tous"])));
  return trierReglements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

// Mise en forme simple du texte : « # Titre » = intertitre, « - » = puce, « Article 1 » = ligne en gras
function ContenuReglement({ texte }) {
  const lignes = String(texte || "").split("\n");
  return (
    <div style={{ fontSize: 13.5, color: "#2A3B57", lineHeight: 1.65, fontFamily: FONT_BASE }}>
      {lignes.map((l, i) => {
        const t = l.trim();
        if (!t) return <div key={i} style={{ height: 8 }} />;
        if (t.startsWith("# ")) return <div key={i} style={{ fontFamily: FONT_TITRE, fontSize: 16, fontWeight: 700, color: "#123A7A", margin: "14px 0 4px" }}>{t.slice(2)}</div>;
        if (/^[-•*] /.test(t)) return (
          <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 6, margin: "2px 0" }}>
            <span style={{ color: "#2F6FDE", fontWeight: 700 }}>•</span><span>{t.slice(2)}</span>
          </div>
        );
        if (/^(art\.?|article)\s*\d+/i.test(t)) return <div key={i} style={{ fontWeight: 700, color: "#14213A", margin: "10px 0 2px" }}>{t}</div>;
        return <div key={i}>{t}</div>;
      })}
    </div>
  );
}

function BadgeAudience({ r }) {
  const a = audienceReglement(r);
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: "#fff", background: a.color, borderRadius: 20, padding: "2px 9px" }}>{a.icone} {a.label}</span>;
}

function ReglementCarte({ r, numero, ouvert, onToggle, afficherAudience, children }) {
  const aud = audienceReglement(r);
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${aud.color}`, borderRadius: 12, boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)", overflow: "hidden" }}>
      <button onClick={onToggle} aria-expanded={ouvert} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: aud.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_TITRE, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{numero}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: FONT_TITRE, fontSize: 16, fontWeight: 700, color: "#14213A" }}>{r.titre}</span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {afficherAudience && <BadgeAudience r={r} />}
            {r.categorie && <span style={{ fontSize: 10.5, fontWeight: 600, color: "#3A4D6B", background: "#E9EFF7", borderRadius: 20, padding: "2px 9px" }}>{r.categorie}</span>}
          </span>
        </span>
        <span style={{ fontSize: 13, color: "#5A6B84", flexShrink: 0 }}>{ouvert ? "▲" : "▼"}</span>
      </button>
      {ouvert && (
        <div style={{ padding: "14px 20px 18px", borderTop: "1px solid #E3EAF4" }}>
          <ContenuReglement texte={r.contenu} />
          {r.updatedAt && <div style={{ fontSize: 11, color: "#7B8AA3", marginTop: 14 }}>Dernière mise à jour : {dateLongue(r.updatedAt)}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

function BarreRecherche({ valeur, onChange, categories, categorie, onCategorie, tout, onTout, toutOuvert }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 240px", maxWidth: 360 }}>
          <Field label="Rechercher" value={valeur} onChange={onChange} placeholder="Mot-clé, titre, catégorie…" />
        </div>
        <button onClick={onTout} style={{ ...smallBtn, marginBottom: 12 }}>{toutOuvert ? "Tout replier" : "Tout déplier"}</button>
      </div>
      {categories.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["", ...categories].map((c) => (
            <button key={c || "toutes"} onClick={() => onCategorie(c)} style={{ ...smallBtn, background: categorie === c ? "#123A7A" : "transparent", color: categorie === c ? "#fff" : "#14213A", borderColor: categorie === c ? "#123A7A" : "#C3D0E2" }}>{c || "Toutes les catégories"}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Page publique pour les civils
function ReglementsPublic({ reglements, onCancel }) {
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState("");
  const [ouverts, setOuverts] = useState({});
  const chargement = reglements === null || reglements === undefined;
  const erreur = reglements === "erreur";
  const liste = Array.isArray(reglements) ? trierReglements(reglements) : [];
  const categories = Array.from(new Set(liste.map((r) => r.categorie).filter(Boolean)));
  const s = search.trim().toLowerCase();
  const filtres = liste.filter((r) => reglementCorrespond(r, s) && (!categorie || r.categorie === categorie));
  const toutOuvert = filtres.length > 0 && filtres.every((r) => ouverts[r.id]);
  function toutBasculer() {
    const n = { ...ouverts };
    filtres.forEach((r) => { n[r.id] = !toutOuvert; });
    setOuverts(n);
  }
  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: FONT_TITRE, fontSize: 28, fontWeight: 700, marginBottom: 4, color: "#14213A" }}>📜 Règlements de Black RP</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 22, lineHeight: 1.6 }}>Les règles à respecter sur le serveur. Merci de les lire avant de jouer : l'ignorance d'une règle n'empêche pas la sanction.</div>
        {liste.length > 0 && <BarreRecherche valeur={search} onChange={setSearch} categories={categories} categorie={categorie} onCategorie={setCategorie} onTout={toutBasculer} toutOuvert={toutOuvert} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtres.map((r, i) => (
            <ReglementCarte key={r.id} r={r} numero={liste.indexOf(r) + 1} ouvert={!!ouverts[r.id]} onToggle={() => setOuverts({ ...ouverts, [r.id]: !ouverts[r.id] })} afficherAudience={false} />
          ))}
          {chargement && <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement…</div>}
          {erreur && <div style={{ color: "#C0172D", fontSize: 13 }}>Impossible de charger les règlements pour l'instant. Réessaie plus tard.</div>}
          {!chargement && !erreur && liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun règlement publié pour l'instant.</div>}
          {liste.length > 0 && filtres.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun résultat pour cette recherche.</div>}
        </div>
      </div>
    </div>
  );
}

// Page interne (gendarmes) : voit tous les règlements ; l'admin peut créer / modifier / ordonner
function ReglementsPage({ current, reglements, onCreate, onUpdate, onDelete, onMove }) {
  const blank = { titre: "", contenu: "", audience: "gendarmes", categorie: "" };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [ouverts, setOuverts] = useState({});
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState("");
  const [filtre, setFiltre] = useState("toutes");
  const [apercu, setApercu] = useState(false);
  const [formOuvert, setFormOuvert] = useState(false);

  const liste = trierReglements(reglements);
  const categories = Array.from(new Set(liste.map((r) => r.categorie).filter(Boolean)));
  const s = search.trim().toLowerCase();
  const filtres = liste.filter((r) => (filtre === "toutes" || (r.audience || "gendarmes") === filtre) && reglementCorrespond(r, s) && (!categorie || r.categorie === categorie));
  const peutOrdonner = current.isAdmin && filtre === "toutes" && !s && !categorie;
  const toutOuvert = filtres.length > 0 && filtres.every((r) => ouverts[r.id]);
  const compte = (id) => liste.filter((r) => (r.audience || "gendarmes") === id).length;

  function toutBasculer() {
    const n = { ...ouverts };
    filtres.forEach((r) => { n[r.id] = !toutOuvert; });
    setOuverts(n);
  }
  function submit(e) {
    e.preventDefault();
    if (!form.titre.trim() || !form.contenu.trim()) return;
    if (editingId) onUpdate(editingId, form); else onCreate(form);
    setEditingId(null); setForm(blank); setApercu(false); setFormOuvert(false);
  }
  function startEdit(r) {
    setEditingId(r.id);
    setForm({ titre: r.titre || "", contenu: r.contenu || "", audience: r.audience || "gendarmes", categorie: r.categorie || "" });
    setFormOuvert(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function annuler() { setEditingId(null); setForm(blank); setApercu(false); setFormOuvert(false); }

  const onglets = [{ id: "toutes", label: "Tous", n: liste.length }, ...AUDIENCES_REGLEMENT.map((a) => ({ id: a.id, label: a.label, n: compte(a.id) }))];

  return (
    <div>
      <h2 style={h2Style}>Règlements</h2>

      {current.isAdmin && !formOuvert && (
        <button onClick={() => setFormOuvert(true)} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginBottom: 20 }}>+ Nouveau règlement</button>
      )}
      {current.isAdmin && formOuvert && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier le règlement" : "Nouveau règlement"}</div>
          <form onSubmit={submit}>
            <Field label="Titre" value={form.titre} onChange={(v) => setForm({ ...form, titre: v })} placeholder="Ex : Règlement de la route" />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px" }}>
                <label style={labelStyle}>Visible par</label>
                <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} style={{ ...selectStyle, marginBottom: 12 }}>
                  {AUDIENCES_REGLEMENT.map((a) => <option key={a.id} value={a.id}>{a.icone} {a.label}{a.id === "civils" ? " (page publique)" : a.id === "tous" ? " (gendarmes + civils)" : " (espace gendarmes)"}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 220px" }}>
                <Field label="Catégorie (facultatif)" value={form.categorie} onChange={(v) => setForm({ ...form, categorie: v })} placeholder="Ex : Circulation, Zones, Armes…" />
              </div>
            </div>
            <Field label="Contenu" textarea value={form.contenu} onChange={(v) => setForm({ ...form, contenu: v })} placeholder={"# Intertitre\nArticle 1 — ...\n- une puce\n- une autre puce"} />
            <div style={{ fontSize: 11.5, color: "#5A6B84", margin: "-6px 0 12px" }}>Mise en forme : <b># Titre</b> pour un intertitre, <b>- </b> pour une puce, une ligne commençant par <b>Article 1</b> s'affiche en gras.</div>
            {apercu && form.contenu.trim() && (
              <div style={{ background: "#F5F8FC", border: "1px dashed #C3D0E2", borderRadius: 10, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>Aperçu</div>
                <ContenuReglement texte={form.contenu} />
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>{editingId ? "Enregistrer" : "Publier"}</button>
              <button type="button" onClick={() => setApercu(!apercu)} style={{ ...smallBtn, padding: "9px 16px" }}>{apercu ? "Masquer l'aperçu" : "Aperçu"}</button>
              <button type="button" onClick={annuler} style={{ ...smallBtn, padding: "9px 16px" }}>Annuler</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {onglets.map((o) => (
          <button key={o.id} onClick={() => setFiltre(o.id)} style={{ ...smallBtn, background: filtre === o.id ? "#123A7A" : "transparent", color: filtre === o.id ? "#fff" : "#14213A", borderColor: filtre === o.id ? "#123A7A" : "#C3D0E2" }}>{o.label} ({o.n})</button>
        ))}
      </div>
      <BarreRecherche valeur={search} onChange={setSearch} categories={categories} categorie={categorie} onCategorie={setCategorie} onTout={toutBasculer} toutOuvert={toutOuvert} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtres.map((r) => {
          const pos = liste.findIndex((x) => x.id === r.id);
          return (
            <ReglementCarte key={r.id} r={r} numero={pos + 1} ouvert={!!ouverts[r.id]} onToggle={() => setOuverts({ ...ouverts, [r.id]: !ouverts[r.id] })} afficherAudience>
              {current.isAdmin && (
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  <button onClick={() => startEdit(r)} style={smallBtn}>Modifier</button>
                  {peutOrdonner && <button onClick={() => onMove(r.id, -1)} disabled={pos === 0} style={{ ...smallBtn, opacity: pos === 0 ? 0.4 : 1 }}>↑ Monter</button>}
                  {peutOrdonner && <button onClick={() => onMove(r.id, 1)} disabled={pos === liste.length - 1} style={{ ...smallBtn, opacity: pos === liste.length - 1 ? 0.4 : 1 }}>↓ Descendre</button>}
                  <button onClick={() => { if (window.confirm(`Supprimer le règlement « ${r.titre} » ?`)) onDelete(r.id); }} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Supprimer</button>
                </div>
              )}
            </ReglementCarte>
          );
        })}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun règlement pour l'instant.</div>}
        {liste.length > 0 && filtres.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun résultat.</div>}
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

// Sur téléphone et tablette, le site s'affiche comme sur ordinateur (mise en page large, que l'on peut agrandir avec les doigts)
const LARGEUR_BUREAU = 1100;
function appliquerVueBureau() {
  try {
    if (!window.screen || window.screen.width >= LARGEUR_BUREAU) return; // ordinateur : rien à changer
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
    meta.setAttribute("content", `width=${LARGEUR_BUREAU}, minimum-scale=0.1, maximum-scale=5, user-scalable=yes`);
  } catch (e) { /* tant pis : le site reste utilisable */ }
}

function AppInner() {
  useEffect(() => { appliquerVueBureau(); }, []);
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
  const [avisGendarmes, setAvisGendarmes] = useState([]);
  const [avisGeneraux, setAvisGeneraux] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [notesService, setNotesService] = useState([]);
  const [reglements, setReglements] = useState([]);
  const [reglementsPublic, setReglementsPublic] = useState(null);
  const [materielPatrouille, setMaterielPatrouille] = useState(MATERIEL_PATROUILLE);
  const [servicesEquipeEtat, setServicesEquipeEtat] = useState("idle");
  const [reouverts, setReouverts] = useState({}); // postes pour lesquels la personne a choisi de redéposer une candidature
  const [sanctionRoles, setSanctionRoles] = useState({});
  const [quotaReglages, setQuotaReglages] = useState(QUOTA_DEFAUT);
  const [absences, setAbsences] = useState([]);
  const [recrutementOuvert, setRecrutementOuvert] = useState(true);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [questionnaireId, setQuestionnaireId] = useState(null);
  const [pvs, setPvs] = useState([]);
  const [modelesPVState, setModelesPVState] = useState(null);
  const [, setTickReglages] = useState(0);
  const [purgeInfo, setPurgeInfo] = useState(null); // { le, legacy } lu dans settings/general
  const purgeEnCours = useRef(false);
  const [migrUnites, setMigrUnites] = useState([]);
  const [services, setServices] = useState([]);
  const [enService, setEnService] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  // Retire les rôles Discord des sanctions terminées (au plus toutes les 10 minutes par session)
  useEffect(() => {
    if (!current) return;
    try {
      const k = "pulsar_balayage_sanctions";
      const dernier = Number(window.sessionStorage.getItem(k) || 0);
      if (Date.now() - dernier < 10 * 60 * 1000) return;
      window.sessionStorage.setItem(k, String(Date.now()));
    } catch (e) { /* stockage indisponible : on continue */ }
    syncSanctionDiscord("", "balayer");
  }, [current && current.id]);
  const [dashSection, setDashSection] = useState("dossier");
  const [saveError, setSaveError] = useState("");
  const [loginBlockedMsg, setLoginBlockedMsg] = useState("");

  // Charge les données visibles compte tenu des règles Firestore (les collections
  // restreintes reviendront vides pour un visiteur non autorisé, sans erreur).
  // Données chargées « à la demande » (casier, code pénal, avis, services de toute l'équipe) : une seule fois par visite
  const dejaCharge = useRef({});
  const servicesTousRef = useRef(false);

  const loadAll = useCallback(async () => {
    const user = auth.currentUser;
    let pNorm = [];
    let san = [];
    if (user) {
      // Temps 1 : le personnel, pour savoir qui est connecté et ce qu'il a le droit de lire
      const [p, ens] = await Promise.all([loadCollection("personnel"), loadCollection("en_service")]);
      pNorm = p.map((x) => (UNITE_ALIAS[x.unite] ? { ...x, unite: UNITE_ALIAS[x.unite] } : x));
      setMigrUnites(p.filter((x) => UNITE_ALIAS[x.unite]).map((x) => ({ id: x.id, unite: UNITE_ALIAS[x.unite] })));
      setPersonnel(pNorm);
      setEnService(ens);
      const moi = pNorm.find((x) => x.id === user.uid);
      const quals = (moi && moi.qualifications) || [];
      const admin = !!(moi && moi.isAdmin);
      const corps = !!(moi && estCorps(moi.unite));
      const cmd = !!(moi && estCommandement(moi.unite));
      const vide = Promise.resolve([]);
      // Temps 2 : seulement ce que cette personne peut lire, et seulement les plus récents quand la liste grossit
      const [c, pl, plg, cr, sanL, promo, rl, ns, rgl, pvl, mesServices] = await Promise.all([
        admin || quals.includes("Recruteur") ? loadRecent("candidatures", 150) : vide,
        admin || quals.includes("OPJ") ? loadRecent("plaintes", 150) : vide,
        admin || corps ? loadRecent("plaintes_gendarmes", 100) : vide,
        admin || corps ? loadRecent("comptes_rendus", 100) : vide,
        loadCollection("sanctions"),
        loadCollection("promotions"),
        loadCollection("roles"),
        loadCollection("notes_service"),
        loadCollection("reglements"),
        loadRecent("pv", 80),
        moi ? (servicesTousRef.current ? loadCollection("services") : loadServicesDe(moi.matricule)) : vide,
      ]);
      setCandidatures(c); setPlaintes(pl); setPlaintesGendarmes(plg); setComptesRendus(cr);
      setSanctions(sanL); setPromotions(promo); setRoles(rl); setNotesService(ns); setReglements(rgl); setPvs(pvl); setServices(mesServices);
      san = sanL;
    } else {
      // Visiteur : on ne charge rien de privé (et on vide ce qui aurait pu rester en mémoire)
      setPersonnel([]); setEnService([]); setCandidatures([]); setPlaintes([]); setPlaintesGendarmes([]); setComptesRendus([]);
      setSanctions([]); setPromotions([]); setRoles([]); setNotesService([]); setReglements([]); setPvs([]); setServices([]);
      setAvisGendarmes([]); setAvisGeneraux([]); setSuggestions([]);
      dejaCharge.current.avisGendarmes = false; dejaCharge.current.avisGeneraux = false; dejaCharge.current.suggestions = false; servicesTousRef.current = false; dejaCharge.current.servicesTous = false; dejaCharge.current.absences = false; setAbsences([]); setServicesEquipeEtat("idle");
    }
    try {
      const snap = await getDoc(doc(db, "settings", "general"));
      if (snap.exists()) {
        setRecrutementOuvert(snap.data().recrutementOuvert !== false);
        setQuestionnaires(Array.isArray(snap.data().questionnaires) ? snap.data().questionnaires : []);
        setModelesPVState(Array.isArray(snap.data().modelesPV) ? snap.data().modelesPV : null);
        if (Array.isArray(snap.data().materielPatrouille) && snap.data().materielPatrouille.length) setMaterielPatrouille(snap.data().materielPatrouille);
        if (snap.data().sanctionRoles && typeof snap.data().sanctionRoles === "object") setSanctionRoles(snap.data().sanctionRoles);
        setQuotaReglages({ quotaHebdoMin: Number(snap.data().quotaHebdoMin) > 0 ? Number(snap.data().quotaHebdoMin) : 300, quotaReserveMin: Number(snap.data().quotaReserveMin) > 0 ? Number(snap.data().quotaReserveMin) : 180, quotaDebut: snap.data().quotaDebut || "", quotaAuto: snap.data().quotaAuto === true });
        appliquerReglages(snap.data());
        setTickReglages((t) => t + 1);
        setPurgeInfo({ le: snap.data().purgeLe || "", legacy: !!snap.data().purgeLegacyFait });
      } else setPurgeInfo({ le: "", legacy: false });
    } catch (e) { /* visible par tous, pas d'erreur bloquante */ }
    return { personnel: pNorm, sanctions: san };
  }, []);

  // Chargement à la demande selon la page ouverte
  const chargerUneFois = useCallback(async (cle, fn) => {
    if (dejaCharge.current[cle]) return;
    dejaCharge.current[cle] = true;
    try { await fn(); } catch (e) { dejaCharge.current[cle] = false; console.error("Chargement", cle, e); }
  }, []);
  useEffect(() => {
    const pub = view === "public" ? publicSection : "";
    const dash = view === "dashboard" ? dashSection : "";
    if (pub === "casier-public" || dash === "casier") chargerUneFois("casier", async () => setCasier(await loadStrict("casier")));
    if (pub === "code-penal" || dash === "casier" || dash === "code-penal-interne") chargerUneFois("codePenal", async () => setCodePenal(await loadStrict("code_penal")));
    if (pub === "reglements") chargerUneFois("reglementsPublic", async () => {
      try { setReglementsPublic(await loadReglementsPublics()); } catch (e) { console.error("Règlements publics", e); setReglementsPublic("erreur"); }
    });
    if (dash === "mes-avis") chargerUneFois("avisGendarmes", async () => setAvisGendarmes(await loadStrict("avis_gendarmes")));
    if (dash === "avis-suggestions") {
      chargerUneFois("avisGeneraux", async () => setAvisGeneraux(await loadStrict("avis_generaux")));
      chargerUneFois("suggestions", async () => setSuggestions(await loadCollection("suggestions")));
    }
    if (current && (dash === "mon-service" || dash === "services-equipe" || dash === "admin-services")) {
      chargerUneFois("absences", async () => { setAbsences(await loadStrict("absences")); });
    }
    if (current && (dash === "services-equipe" || (dash === "admin-services" && current.isAdmin))) {
      chargerUneFois("servicesTous", async () => {
        try {
          const tous = await loadStrict("services");
          servicesTousRef.current = true;
          setServices(tous);
          setServicesEquipeEtat("ok");
        } catch (e) { setServicesEquipeEtat("erreur"); throw e; }
      });
    }
  }, [view, publicSection, dashSection, current && current.isAdmin, chargerUneFois]);

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

  // Nettoyage automatique : les éléments archivés depuis plus de 7 jours sont supprimés (lancé par un administrateur, au plus 1 fois par jour)
  useEffect(() => {
    if (!current || !current.isAdmin || !purgeInfo || purgeEnCours.current) return;
    const dernier = purgeInfo.le ? new Date(purgeInfo.le).getTime() : 0;
    if (purgeInfo.legacy && Date.now() - dernier < 20 * 3600 * 1000) return;
    purgeEnCours.current = true; // verrou : une seule exécution par visite, même si l'enregistrement de la date échoue
    (async () => {
      try {
        const maintenant = new Date();
        const coupe7 = new Date(maintenant.getTime() - 7 * 86400000).toISOString();
        const coupe30 = new Date(maintenant.getTime() - 30 * 86400000).toISOString();
        const COLS = ["candidatures", "plaintes", "plaintes_gendarmes", "comptes_rendus", "pv"];
        const archive = (col, d) => (col === "candidatures" ? d.statut && d.statut !== "En attente" : col === "comptes_rendus" || col === "pv" ? !!d.traite : d.statut === "Traitée" || d.statut === "Classée");
        let supprimes = 0;
        for (const col of COLS) {
          // 1) archivés depuis plus de 7 jours
          const snap = await getDocs(query(collection(db, col), where("archiveLe", "<", coupe7)));
          for (const d of snap.docs) { await deleteDoc(doc(db, col, d.id)); supprimes++; }
          // 2) une seule fois : anciens éléments déjà archivés avant cette fonction (sans date d'archivage)
          if (!purgeInfo.legacy) {
            const tous = await loadStrict(col);
            for (const d of tous) {
              if (d.archiveLe || !archive(col, d)) continue;
              if (String(d.createdAt || "") < coupe30) { await deleteDoc(doc(db, col, d.id)); supprimes++; }
              else await updateDoc(doc(db, col, d.id), { archiveLe: maintenant.toISOString() });
            }
          }
        }
        await setDoc(doc(db, "settings", "general"), { purgeLe: maintenant.toISOString(), purgeLegacyFait: true }, { merge: true });
        setPurgeInfo({ le: maintenant.toISOString(), legacy: true });
        if (supprimes > 0) await loadAll();
      } catch (e) { console.error("Nettoyage des archives :", e); }
      // on ne remet PAS le verrou à zéro : prochain nettoyage à la prochaine visite
    })();
  }, [current, purgeInfo, loadAll]);

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

  // Journal d'activité retiré : aucune écriture (économise le quota Firebase)
  async function logAction() {}

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
    const ref = genererNumeroDossier(data.poste);
    const maintenant = new Date().toISOString();
    const nomAuteur = auteur ? `${auteur.prenom} ${auteur.nom}` : "";
    const c = { ref, statut: "En attente", createdAt: maintenant, auteurMatricule: auteur ? auteur.matricule : null, ...data, displayName: data.displayName === "Candidat" && nomAuteur ? nomAuteur : data.displayName };
    try {
      // Fiche de suivi consultable par le candidat avec son numéro (ne contient que le poste et l'état)
      let suiviOk = true;
      try {
        await setDoc(doc(db, "suivi_candidatures", ref), { poste: data.poste, statut: "En attente", createdAt: maintenant, updatedAt: maintenant });
      } catch (e0) { suiviOk = false; console.error("Suivi de candidature indisponible (règles Firestore ?)", e0); }
      const docRef = await addDoc(collection(db, "candidatures"), c);
      setCandidatures([...candidatures, { id: docRef.id, ...c }]);
      notifierDiscord("candidature", `${c.displayName} — ${c.poste} (${ref})`);
      const conf = suiviOk
        ? { title: "Candidature envoyée", message: "Ta candidature a bien été transmise à l'administration. Tu seras recontacté via Discord, et tu peux aussi consulter la réponse avec ton numéro de dossier.", refNumber: ref, dossier: true }
        : { title: "Candidature envoyée", message: "Ta candidature a bien été transmise à l'administration. Tu seras recontacté via Discord.", refNumber: ref };
      if (auteur) setConfirmationDash(conf);
      else {
        if (suiviOk) enregistrerDossierLocal(data.poste, ref);
        setReouverts({});
        setConfirmation(conf);
        setPublicSection("confirmation");
      }
    } catch (e) { console.error(e); setSaveError("Échec de l'envoi, réessaie."); }
  }
  async function handleUpdateCandidatureStatut(id, statut) {
    try {
      const maintenant = new Date().toISOString();
      const patch = { statut, archiveLe: statut !== "En attente" ? maintenant : null };
      await updateDoc(doc(db, "candidatures", id), patch);
      setCandidatures(candidatures.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      const cand = candidatures.find((c) => c.id === id);
      if (cand && FORMAT_DOSSIER.test(String(cand.ref || ""))) {
        try { await updateDoc(doc(db, "suivi_candidatures", cand.ref), { statut, updatedAt: maintenant }); }
        catch (e1) { console.error("Mise à jour du suivi public impossible", e1); setSaveError("Statut enregistré, mais le suivi public du candidat n'a pas pu être mis à jour (règles Firestore)."); }
      }
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }

  // Plaintes (publiques)
  async function handleSubmitPlainte(data) {
    const ref = genererNumeroDossier("PLT");
    const p = { ref, statut: "En attente", source: "en_ligne", createdAt: new Date().toISOString(), ...data, preuves: (data.preuves || []).slice(0, 12) };
    try {
      const docRef = await addDoc(collection(db, "plaintes"), p);
      setPlaintes([...plaintes, { id: docRef.id, ...p }]);
      setConfirmation({ title: "Plainte enregistrée", message: "Ta plainte a bien été transmise à la gendarmerie. Un gendarme la traitera prochainement. Note bien ton numéro de plainte : il identifie ton dossier.", refNumber: ref });
      setPublicSection("confirmation");
    } catch (e) { console.error(e); setSaveError("Échec de l'envoi, réessaie."); }
  }
  async function handleUpdatePlainteStatut(id, statut) {
    try {
      const patch = { statut, archiveLe: statut === "Traitée" || statut === "Classée" ? new Date().toISOString() : null };
      await updateDoc(doc(db, "plaintes", id), patch);
      setPlaintes(plaintes.map((p) => (p.id === id ? { ...p, ...patch } : p)));
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
  async function handleUpdatePlainteGendarmeStatut(id, statut) {
    try {
      const patch = { statut, archiveLe: statut === "Traitée" || statut === "Classée" ? new Date().toISOString() : null };
      await updateDoc(doc(db, "plaintes_gendarmes", id), patch);
      setPlaintesGendarmes(plaintesGendarmes.map((p) => (p.id === id ? { ...p, ...patch } : p)));
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
      const patch = { traite: true, archiveLe: new Date().toISOString() };
      await updateDoc(doc(db, "comptes_rendus", id), patch);
      setComptesRendus(comptesRendus.map((cr) => (cr.id === id ? { ...cr, ...patch } : cr)));
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
    const now = new Date();
    const serie = String(data.serie || "PV").toUpperCase();
    const ref = `${serie}-${cleJour(now).replace(/-/g, "").slice(2)}-${now.toTimeString().slice(0, 8).replace(/:/g, "")}`;
    const p = {
      ref, traite: false, createdAt: now.toISOString(),
      auteurMatricule: current.matricule, auteurUid: current.id, auteurNom: `${current.prenom} ${current.nom}`, auteurGrade: current.grade,
      auteurRIO: current.cipcNumero || "", auteurQualite: current.qualiteJudiciaire || "APJA", auteurUnite: current.unite || "",
      ...data,
    };
    try {
      const r = await addDoc(collection(db, "pv"), p);
      const saved = { id: r.id, ...p };
      setPvs((prev) => [saved, ...prev]);
      notifierDiscord("pv", `${p.modeleTitre} — par ${p.auteurNom} (${p.ref})`);
      journaliserMC(current, `PV transmis à l'OPJ : ${p.modeleTitre} (${p.ref}).`);
      return saved;
    } catch (e) { console.error(e); return null; }
  }
  async function handleVisaPV(id, observations) {
    const visa = { par: `${current.prenom} ${current.nom}`, grade: current.grade, rio: current.cipcNumero || "", le: new Date().toISOString(), observations: observations || "" };
    try {
      const patch = { traite: true, traitePar: visa.par, visa, archiveLe: visa.le };
      await updateDoc(doc(db, "pv", id), patch);
      setPvs((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      logAction("PV visé", id);
      return true;
    } catch (e) { console.error(e); setSaveError("Échec du visa (réservé aux OPJ)."); return false; }
  }
  async function handleSavePVModeles(list) {
    try {
      const garde = questionnaires.filter((q) => q.visibilite !== "pv"); // les anciens modèles de PV sont repris dans la nouvelle liste
      await setDoc(doc(db, "settings", "general"), { modelesPV: list, questionnaires: garde }, { merge: true });
      setModelesPVState(list);
      setQuestionnaires(garde);
      logAction("Modèles de PV", `${list.length} modèle(s) enregistré(s)`);
      return true;
    } catch (e) { console.error(e); setSaveError("Échec de l'enregistrement des modèles de PV."); return false; }
  }

  // Questionnaires personnalisés (stockés dans settings/general, lisibles par le public)
  async function handleSaveQuestionnaires(list) {
    try {
      const complet = [...list, ...questionnaires.filter((q) => q.visibilite === "pv")]; // on garde les anciens modèles de PV non encore migrés
      await setDoc(doc(db, "settings", "general"), { questionnaires: complet }, { merge: true });
      setQuestionnaires(complet);
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
    const roleDiscordId = (sanctionRoles && sanctionRoles[data.type]) || "";
    const s = {
      matricule: data.matricule,
      nomCible: data.nomCible,
      type: data.type,
      motif: data.motif.trim(),
      dureeJours: Number(data.dureeJours),
      dateDebut: dateDebut.toISOString(),
      dateFin: dateFin.toISOString(),
      emisPar: current.matricule,
      emisParNom: `${current.prenom} ${current.nom}`,
      levee: false,
      roleDiscordId,
      statutDiscord: roleDiscordId ? "en attente" : "aucun",
    };
    try {
      const docRef = await addDoc(collection(db, "sanctions"), s);
      setSanctions([...sanctions, { id: docRef.id, ...s }]);
      logAction("Sanction émise", `${s.type} — ${s.nomCible} (${s.matricule})`);
      if (roleDiscordId) syncSanctionDiscord(docRef.id, "ajouter").then((j) => { if (j && j.alerte) setSaveError("Sanction enregistrée, mais Discord : " + j.message); });
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false, error: "Échec de l'envoi." }; }
  }
  async function handleLeverSanction(id) {
    const s = sanctions.find((x) => x.id === id);
    if (!s) return;
    const patch = { levee: true, leveeLe: new Date().toISOString(), leveePar: `${current.prenom} ${current.nom}` };
    try {
      await updateDoc(doc(db, "sanctions", id), patch);
      setSanctions(sanctions.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      logAction("Sanction levée", `${s.type} — ${s.nomCible}`);
      if (s.roleDiscordId) syncSanctionDiscord(id, "retirer").then((j) => { if (j && j.alerte) setSaveError("Sanction levée, mais Discord : " + j.message); });
    } catch (e) { console.error(e); setSaveError("Échec de la levée de la sanction."); }
  }
  async function handleAddAbsence(data) {
    const a = { matricule: current.matricule, nom: `${current.prenom} ${current.nom}`, debut: data.debut, fin: data.fin, motif: (data.motif || "").trim().slice(0, 300), annulee: false, createdAt: new Date().toISOString() };
    try {
      const r = await addDoc(collection(db, "absences"), a);
      setAbsences((prev) => [...prev, { id: r.id, ...a }]);
      logAction("Absence déclarée", `${a.nom} du ${a.debut} au ${a.fin}`);
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleCancelAbsence(id) {
    try {
      await updateDoc(doc(db, "absences", id), { annulee: true });
      setAbsences((prev) => prev.map((a) => (a.id === id ? { ...a, annulee: true } : a)));
    } catch (e) { console.error(e); setSaveError("Impossible d'annuler l'absence."); }
  }
  async function handleSaveQuota(r) {
    try {
      await setDoc(doc(db, "settings", "general"), r, { merge: true });
      setQuotaReglages(r);
      logAction("Quota de service", `${r.quotaHebdoMin} min (réserviste ${r.quotaReserveMin} min), contrôle auto ${r.quotaAuto ? "activé" : "désactivé"}`);
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleSaveSanctionRoles(map) {
    try {
      await setDoc(doc(db, "settings", "general"), { sanctionRoles: map }, { merge: true });
      setSanctionRoles(map);
      logAction("Rôles Discord des sanctions", `${Object.keys(map).length} rôle(s) configuré(s)`);
      return true;
    } catch (e) { console.error(e); return false; }
  }

  // Promotions / rétrogradations (Commandant et grades supérieurs, sur grade inférieur au sien)
  async function handleIssuePromotion(targetPersonnel, nouveauGrade, motif = "") {
    const ancienGrade = targetPersonnel.grade;
    const type = GRADES.indexOf(nouveauGrade) > GRADES.indexOf(ancienGrade) ? "Promotion" : "Rétrogradation";
    const p = {
      matricule: targetPersonnel.matricule,
      nomCible: `${targetPersonnel.prenom} ${targetPersonnel.nom}`,
      ancienGrade,
      nouveauGrade,
      type,
      motif,
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
    const now = new Date().toISOString();
    const r = { titre: data.titre.trim(), contenu: data.contenu, audience: data.audience || "gendarmes", categorie: (data.categorie || "").trim(), ordre: Date.now(), createdAt: now, updatedAt: now };
    try {
      const docRef = await addDoc(collection(db, "reglements"), r);
      setReglements([...reglements, { id: docRef.id, ...r }]);
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
      logAction("Règlement créé", data.titre);
    } catch (e) { console.error(e); setSaveError("Échec de la création."); }
  }
  async function handleUpdateReglement(id, data) {
    const r = { titre: data.titre.trim(), contenu: data.contenu, audience: data.audience || "gendarmes", categorie: (data.categorie || "").trim(), updatedAt: new Date().toISOString() };
    try {
      await updateDoc(doc(db, "reglements", id), r);
      setReglements(reglements.map((x) => (x.id === id ? { ...x, ...r } : x)));
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
      logAction("Règlement modifié", data.titre);
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleMoveReglement(id, dir) {
    const liste = trierReglements(reglements);
    const i = liste.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= liste.length) return;
    const nouvelle = liste.slice();
    [nouvelle[i], nouvelle[j]] = [nouvelle[j], nouvelle[i]];
    // On renumérote proprement (0, 1, 2…) pour que l'ordre reste stable
    const changes = nouvelle.map((x, k) => ({ x, k })).filter(({ x, k }) => x.ordre !== k);
    try {
      await Promise.all(changes.map(({ x, k }) => updateDoc(doc(db, "reglements", x.id), { ordre: k })));
      const ordres = {}; nouvelle.forEach((x, k) => { ordres[x.id] = k; });
      setReglements(reglements.map((x) => ({ ...x, ordre: ordres[x.id] })));
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
    } catch (e) { console.error(e); setSaveError("Échec du déplacement."); }
  }
  async function handleDeleteReglement(id) {
    try {
      await deleteDoc(doc(db, "reglements", id));
      setReglements(reglements.filter((r) => r.id !== id));
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  async function handleSaveMateriel(liste) {
    try {
      await setDoc(doc(db, "settings", "general"), { materielPatrouille: liste }, { merge: true });
      setMaterielPatrouille(liste);
      logAction("Matériel de patrouille", `${liste.length} élément(s)`);
      return true;
    } catch (e) { console.error(e); return false; }
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
  // Modèles de PV : liste dédiée ; à défaut, reprise des anciens modèles créés dans les questionnaires
  const modelesPVListe = modelesPVState || questionnaires.filter((q) => q.visibilite === "pv").map((q) => ({
    id: q.id, titre: q.titre, type: "Autre", serie: "PV", visa: "", actif: !!q.actif,
    sections: (q.sections || []).map((s) => ({ id: s.id, title: s.title, fields: (s.fields || []).map((f) => ({ key: f.key, label: f.label, type: f.type || "text", required: !!f.required, options: f.options || [] })) })),
  }));
  const modelesPVActifs = modelesPVListe.filter((m) => m.actif);
  const modelesPV = modelesPVActifs.some((m) => m.type === "Plainte" || /plainte/i.test(m.titre || "")) ? modelesPVActifs : [...modelesPVActifs, MODELE_PLAINTE_DEFAUT];

  if (view === "public") {
    if (publicSection === "home") return <PublicHome onNavigate={(s) => (s === "login" ? setView("login") : s === "creer-compte" ? setView("creer-compte") : setPublicSection(s))} recrutementOuvert={recrutementOuvert} nbQuestionnaires={questionnairesPublics.length} />;
    if (publicSection === "plainte") return <PlainteForm onSubmit={handleSubmitPlainte} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "suivi-candidature") return <SuiviCandidaturePublic onCancel={() => setPublicSection("home")} />;
    if (publicSection === "candidature") {
      const gavQ = questionnaires.find((q) => q.id === "gav");
      const dejaGav = lireDossiersLocaux().GAV;
      if (dejaGav && !reouverts.GAV) return <DejaPostule poste="GAV" numero={dejaGav.numero} onCancel={() => setPublicSection("home")} onNouvelle={() => { oublierDossierLocal("GAV"); setReouverts({ ...reouverts, GAV: true }); }} />;
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
      const posteQ = q ? (q.poste || q.titre) : "";
      const dejaQ = posteQ ? lireDossiersLocaux()[posteQ] : null;
      if (q && dejaQ && !reouverts[posteQ]) return <DejaPostule poste={posteQ} numero={dejaQ.numero} onCancel={() => setPublicSection("home")} onNouvelle={() => { oublierDossierLocal(posteQ); setReouverts({ ...reouverts, [posteQ]: true }); }} />;
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
    if (publicSection === "reglements") return <ReglementsPublic reglements={reglementsPublic} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "code-penal") return <CodePenalPublic codePenal={codePenal} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "avis-gendarme") return <AvisGendarmeForm onSubmit={handleSubmitAvisGendarme} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "avis-general") return <AvisGeneralForm onSubmit={handleSubmitAvisGeneral} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "suggestion") return <SuggestionForm onSubmit={handleSubmitSuggestion} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "confirmation" && confirmation) {
      return <Confirmation {...confirmation} onBack={() => { setPublicSection("home"); setConfirmation(null); }} onSuivi={() => { setPublicSection("suivi-candidature"); setConfirmation(null); }} />;
    }
  }

  if (view === "creer-compte") return <CreerCompteScreen onBack={() => setView("public")} onLogin={() => setView("login")} />;
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
    plaintes: plaintes.filter((p) => p.statut === "En attente").length + pvs.filter((p) => estPVPlainte(p) && !p.traite).length,
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
              const mesSanctionsActives = sanctions.filter((s) => s.matricule === current.matricule && !s.levee && new Date(s.dateFin) > now);
              const heure = now.getHours();
              const salutation = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
              const isRecruteurOuAdmin = current.isAdmin || (current.qualifications || []).includes("Recruteur");
              const isOpjOuAdmin = current.isAdmin || (current.qualifications || []).includes("OPJ");
              const stats = [
                isRecruteurOuAdmin && { label: "Candidatures en attente", value: candidatures.filter((c) => c.statut === "En attente").length },
                isOpjOuAdmin && { label: "Plaintes en attente", value: plaintes.filter((p) => p.statut === "En attente").length + pvs.filter((p) => estPVPlainte(p) && !p.traite).length },
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
                    <div style={{ background: "#C0172D", color: "#fff", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, lineHeight: 1.55 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ Tu as {mesSanctionsActives.length} sanction{mesSanctionsActives.length > 1 ? "s" : ""} en cours</div>
                      {mesSanctionsActives.map((s) => (
                        <div key={s.id} style={{ background: "rgba(255,255,255,0.14)", borderRadius: 8, padding: "8px 11px", marginBottom: 6 }}>
                          <b>{s.type}</b> — jusqu'au {new Date(s.dateFin).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                          <div style={{ marginTop: 2 }}>Motif : {s.motif}</div>
                        </div>
                      ))}
                      <button onClick={() => setDashSection("mes-sanctions")} style={{ background: "#fff", color: "#C0172D", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>Voir le détail</button>
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
          <ReglementsPage current={current} reglements={reglements} onCreate={handleCreateReglement} onUpdate={handleUpdateReglement} onDelete={handleDeleteReglement} onMove={handleMoveReglement} />
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
          <MainCourantePage current={current} enService={!!serviceActif} canEdit={!!current.isAdmin || (current.qualifications || []).includes("OPJ") || current.qualiteJudiciaire === "OPJ"} canDelete={!!current.isAdmin} nbEnService={enService.length} agentsEnService={enService.map((e) => { const p = personnel.find((x) => x.id === e.id); return { id: e.id, nom: p ? `${p.prenom} ${p.nom}` : (e.nom || "Agent"), grade: p ? p.grade : "" }; })} materiel={materielPatrouille} onSaveMateriel={handleSaveMateriel} onGoService={() => setDashSection("mon-service")} onLog={logAction} />
        )}
        {dashSection === "mon-service" && <MonServicePage current={current} services={services} onStart={handleStartService} onStop={(id) => handleStopService(id)} quotaReglages={quotaReglages} absences={absences} onAddAbsence={handleAddAbsence} onCancelAbsence={handleCancelAbsence} />}
        {dashSection === "services-equipe" && <ServicesEquipePage current={current} personnel={personnel} services={services} etat={servicesEquipeEtat} quotaReglages={quotaReglages} absences={absences} />}
        {dashSection === "pv" && <PVPage current={current} modeles={modelesPV} pvs={pvs} onSubmit={handleSubmitPV} onVisa={handleVisaPV} />}
        {dashSection === "admin-services" && current.isAdmin && (
          <AdminServicesPage personnel={personnel} services={services} onForceStop={(id) => handleStopService(id, `${current.prenom} ${current.nom}`)} onAdjust={handleAdjustService} onDelete={handleDeleteService} quotaReglages={quotaReglages} absences={absences} onSaveQuota={handleSaveQuota} />
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
          <QuestionnairesAdmin questionnaires={questionnaires.filter((q) => q.visibilite !== "pv")} onSave={handleSaveQuestionnaires} />
        )}
        {dashSection === "admin-modeles-pv" && current.isAdmin && (
          <PVModelesAdmin modeles={modelesPVListe} onSave={handleSavePVModeles} />
        )}
        {dashSection === "admin-personnel" && current.isAdmin && (
          <div>
            <RecrutementPanel recrutementOuvert={recrutementOuvert} onToggle={handleToggleRecrutement} />
            <AdminPanel personnel={personnel} roles={roles} onCreate={handleCreatePersonnel} onDelete={handleDeletePersonnel} onUpdate={handleUpdatePersonnel} onAssignRIO={handleAssignRIO} />
          </div>
        )}
        {dashSection === "roles" && current.isAdmin && (
          <RolesPage roles={roles} onCreate={handleCreateRole} onUpdate={handleUpdateRole} onDelete={handleDeleteRole} />
        )}
        {dashSection === "admin-candidatures" && (current.isAdmin || (current.qualifications || []).includes("Recruteur")) && (
          <AdminCandidatures candidatures={candidatures} onUpdateStatut={handleUpdateCandidatureStatut} />
        )}
        {dashSection === "admin-plaintes" && (current.isAdmin || (current.qualifications || []).includes("OPJ")) && (
          <AdminPlaintes plaintes={plaintes} pvs={pvs} current={current} onUpdateStatut={handleUpdatePlainteStatut} onTakeCharge={handleTakeChargePlainte} onVisa={handleVisaPV} />
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
          <SanctionsPage current={current} personnel={personnel} sanctions={sanctions} onIssue={handleIssueSanction} onLever={handleLeverSanction} sanctionRoles={sanctionRoles} onSaveRoles={handleSaveSanctionRoles} />
        )}
        {dashSection === "mes-sanctions" && <MesSanctionsPage current={current} sanctions={sanctions} />}
        {dashSection === "promotions" && (
          <PromotionsPage current={current} personnel={personnel} promotions={promotions} onIssue={handleIssuePromotion} />
        )}
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
