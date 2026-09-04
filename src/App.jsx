import React, { useState, useEffect, useCallback } from "react";
import { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db, auth, FIREBASE_API_KEY } from "./firebase";
import { ShieldAlert, FileSearch, UserPlus, Siren, Users, Car, BookOpen, Award, Radio } from "lucide-react";

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

const OFFICIER_INDEX = GRADES.indexOf("Sous-Lieutenant");
const SOG_MIN_INDEX = GRADES.indexOf("Maréchal des Logis");
const OFFICIER_CANDIDATURE_MIN_INDEX = GRADES.indexOf("Major");
const DISCIPLINE_MIN_INDEX = GRADES.indexOf("Commandant"); // Commandant → Général d'Armée

const UNITES = [
  "Brigade territoriale",
  "CORG",
  "Section de recherche",
  "Formation & Recrutement",
  "DGGN",
  "IGGN",
  "OPJ",
];

const UNITE_ORDER = UNITES.reduce((acc, u, i) => ({ ...acc, [u]: i }), {});

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
    <span style={{ letterSpacing: 2, color: "#B08D57", fontSize: 13 }}>
      {symbol.repeat(Math.min(count, 6))}
    </span>
  );
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
      border: "1px solid #D8D2C2",
      background: "#FFFFFF",
      fontSize: 14,
      boxSizing: "border-box",
      outline: "none",
      fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif",
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

const labelStyle = { display: "block", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 4 };
const selectStyle = { width: "100%", padding: "9px 10px", borderRadius: 6, border: "1px solid #D8D2C2", background: "#fff", fontSize: 13, boxSizing: "border-box" };
const smallBtn = { fontSize: 12, fontWeight: 600, background: "transparent", border: "1px solid #D8D2C2", borderRadius: 20, padding: "6px 14px", cursor: "pointer" };
const h2Style = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, marginBottom: 20, color: "#1A1F29", paddingBottom: 10, borderBottom: "2px solid #16305C" };
const buttonPrimary = {
  width: "100%",
  padding: "10px 0",
  marginTop: 6,
  background: "#16305C",
  color: "#F5F2EA",
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
      <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "#7A7362", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#1A1F29", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}

/* ---------- Carte de service ---------- */

function CarteService({ p }) {
  return (
    <div style={{ background: "#F5F2EA", borderRadius: 10, overflow: "hidden", boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)", maxWidth: 420, fontFamily: "'Playfair Display', 'Playfair Display', Georgia, serif", border: "1px solid #D8D2C2" }}>
      <div style={{ background: "linear-gradient(135deg, #0B1626, #16305C)", color: "#F5F2EA", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, opacity: 0.75, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>RÉPUBLIQUE FRANÇAISE — RP</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Carte de Service</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px solid #B08D57", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#B08D57", fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>GN</div>
      </div>
      <div style={{ padding: "16px 18px", color: "#1A1F29" }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{p.prenom} {p.nom?.toUpperCase()}</div>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#5A4A32", marginTop: 2 }}>Matricule {p.matricule}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1, color: "#7A7362", textTransform: "uppercase" }}>Grade</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.grade}</div>
            <div style={{ marginTop: 2 }}>{insignia(p.grade)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1, color: "#7A7362", textTransform: "uppercase" }}>Unité</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.unite}</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 10, letterSpacing: 1, color: "#7A7362", textTransform: "uppercase" }}>Fonction</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.fonction || "—"}</div>
          </div>
          {(p.pseudoRoblox || p.pseudoDiscord) && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 10, letterSpacing: 1, color: "#7A7362", textTransform: "uppercase" }}>Identité en jeu</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                {[p.pseudoRoblox && `Roblox : ${p.pseudoRoblox}`, p.pseudoDiscord && `Discord : ${p.pseudoDiscord}`].filter(Boolean).join(" — ")}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
          {(p.qualifications || []).map((q) => (
            <span key={q} style={{ fontSize: 10, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif", background: "#16305C", color: "#F5F2EA", padding: "3px 8px", borderRadius: 20 }}>{q}</span>
          ))}
          {p.isAdmin && <span style={{ fontSize: 10, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif", background: "#B08D57", color: "#1A1F29", padding: "3px 8px", borderRadius: 20 }}>ADMINISTRATION</span>}
        </div>
      </div>
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
        background: "rgba(11,22,38,0.55)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(245,242,234,0.15)",
        borderRadius: 14,
        padding: "12px 10px",
        cursor: "pointer",
        width: 84,
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 10, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={17} color="#F5F2EA" strokeWidth={1.8} />
      </div>
      <div style={{ fontSize: 10, color: "#F5F2EA", textAlign: "center", lineHeight: 1.25, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>{label}</div>
    </button>
  );
}

function InfoCard({ icon: Icon, title, children }) {
  return (
    <div className="gh-card-anim" style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -12px rgba(11,22,38,0.25)" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#16305C", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Icon size={19} color="#F5F2EA" strokeWidth={1.8} />
      </div>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#1A1F29" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#5A4A32", lineHeight: 1.6, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>{children}</div>
    </div>
  );
}

function PublicHome({ onNavigate, recrutementOuvert }) {
  const leftActions = [
    { key: "plainte", icon: Siren, label: "Déposer plainte", color: "#9C2B2B" },
    { key: "plainte-gendarme", icon: ShieldAlert, label: "Signaler un gendarme", color: "#5A4A32" },
  ];
  const rightActions = [
    { key: "candidature", icon: UserPlus, label: "Candidater GAV", color: "#16305C" },
    { key: "casier-public", icon: FileSearch, label: "Mon casier", color: "#B08D57" },
    { key: "code-penal", icon: BookOpen, label: "Code Pénal", color: "#5A4A32" },
  ];

  return (
    <div style={{ background: "#EFECE2", fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
      {/* Actions fixées sur les côtés */}
      <div style={{ position: "fixed", left: 16, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 10, zIndex: 20 }}>
        {leftActions.map((a) => <SideAction key={a.key} icon={a.icon} label={a.label} color={a.color} onClick={() => onNavigate(a.key)} />)}
      </div>
      <div style={{ position: "fixed", right: 16, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 10, zIndex: 20 }}>
        {rightActions.map((a) => <SideAction key={a.key} icon={a.icon} label={a.label} color={a.color} onClick={() => onNavigate(a.key)} />)}
      </div>

      {/* Lien connexion, coin haut droit */}
      <button onClick={() => onNavigate("login")} className="gh-link-anim" style={{ position: "fixed", top: 16, right: 16, zIndex: 21, background: "rgba(11,22,38,0.55)", backdropFilter: "blur(6px)", border: "1px solid rgba(245,242,234,0.2)", borderRadius: 20, padding: "8px 16px", color: "#F5F2EA", fontSize: 11, cursor: "pointer", fontFamily: "-apple-system, Segoe UI, sans-serif" }}>
        Espace gendarmes
      </button>

      {/* Bandeau recrutement, coin haut gauche */}
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 21, background: recrutementOuvert ? "#2E7D4F" : "#9C2B2B", borderRadius: 20, padding: "8px 16px", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>
        {recrutementOuvert ? "🟢 RECRUTEMENT OUVERT" : "🔴 RECRUTEMENT FERMÉ"}
      </div>

      {/* Bandeau héro plein écran */}
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", backgroundImage: `linear-gradient(180deg, rgba(11,22,38,0.55), rgba(11,22,38,0.85)), url(${IMG_HERO})`, backgroundSize: "cover", backgroundPosition: "center", padding: "20px" }}>
        <div style={{ textAlign: "center", maxWidth: 560 }}>
          <div style={{ width: 76, height: 76, margin: "0 auto 18px", borderRadius: "50%", border: "2px solid #B08D57", outline: "1px solid rgba(176,141,87,0.35)", outlineOffset: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #16305C, #0B1626)", boxShadow: "0 8px 28px -8px rgba(176,141,87,0.5)" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#B08D57", letterSpacing: 2 }}>GN</span>
            <span style={{ width: 22, height: 2, background: "#B08D57", marginTop: 4, opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.7, color: "#B9C2CF", fontFamily: "-apple-system, Segoe UI, sans-serif" }}>RÉPUBLIQUE FRANÇAISE — RP</div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 38, fontWeight: 700, color: "#F5F2EA", marginTop: 8, marginBottom: 10 }}>Gendarmerie Nationale de Nîmes RP</div>
          <div style={{ color: "#D8DEE8", fontSize: 15, fontStyle: "italic" }}>Servir, protéger, encadrer — une communauté roleplay structurée comme une véritable unité de gendarmerie.</div>
          <button
            onClick={() => document.getElementById("gh-presentation")?.scrollIntoView({ behavior: "smooth" })}
            className="gh-link-anim"
            style={{ marginTop: 34, background: "none", border: "none", color: "#B9C2CF", fontSize: 12, cursor: "pointer", fontFamily: "-apple-system, Segoe UI, sans-serif" }}
          >
            ↓ Découvrir la gendarmerie
          </button>
        </div>
      </div>

      <div id="gh-presentation" style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px 70px" }}>
        {/* Nos missions */}
        <div className="gh-fade" style={{ marginBottom: 50, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1A1F29" }}>Nos missions sur le terrain</div>
            <div style={{ fontSize: 13, color: "#5A4A32", lineHeight: 1.7, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>
              Comme dans la réalité, chaque gendarme intervient au quotidien sur des missions variées : patrouilles, contrôles routiers,
              réponse aux urgences, accueil du public et rédaction de procédures. Une communauté exigeante, où la rigueur RP est reine.
              Victime ou témoin de faits ?{" "}
              <button onClick={() => onNavigate("plainte")} className="gh-link-anim" style={{ background: "none", border: "none", padding: 0, color: "#9C2B2B", fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", fontSize: 13 }}>
                Dépose plainte en ligne →
              </button>
            </div>
          </div>
          <img src={IMG_MISSIONS} alt="Intervention sur le terrain" style={{ width: "100%", borderRadius: 16, boxShadow: "0 12px 30px -14px rgba(11,22,38,0.4)" }} />
        </div>

        <div className="gh-fade" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 50 }}>
          <InfoCard icon={Car} title="Patrouilles & contrôles">Surveillance des axes, contrôles d'identité et de véhicules sur le territoire de Nîmes.</InfoCard>
          <InfoCard icon={Radio} title="Interventions & urgences">Réponse aux appels de détresse et premières constatations sur les lieux d'infraction.</InfoCard>
          <InfoCard icon={Users} title="Contact population">Accueil en brigade, recueil de plaintes, prévention et médiation.</InfoCard>
          <InfoCard icon={BookOpen} title="Procédure & enquête">Rapports, casier judiciaire, transmission aux unités spécialisées.</InfoCard>
        </div>

        {/* Le rôle du GAV */}
        <div className="gh-fade" style={{ marginBottom: 50, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, alignItems: "center" }}>
          <img src={IMG_GAV} alt="Formation GAV" style={{ width: "100%", borderRadius: 16, boxShadow: "0 12px 30px -14px rgba(11,22,38,0.4)", order: 2 }} />
          <div style={{ order: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Award size={20} color="#B08D57" />
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1A1F29" }}>Le rôle du GAV</div>
            </div>
            <div style={{ fontSize: 13, color: "#5A4A32", lineHeight: 1.7, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>
              Le Gendarme Adjoint Volontaire est la porte d'entrée dans la gendarmerie. Encadré par des gradés expérimentés, il participe
              aux patrouilles, assiste aux contrôles et se forme aux procédures de base — rédaction de rapports, code pénal RP, hiérarchie militaire.
              {" "}
              <button onClick={() => onNavigate("candidature")} className="gh-link-anim" style={{ background: "none", border: "none", padding: 0, color: "#16305C", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
                Candidate dès maintenant →
              </button>
            </div>
          </div>
        </div>

        {/* Trois niveaux de grades */}
        <div className="gh-fade" style={{ marginBottom: 50 }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1A1F29" }}>Du GAV à l'Officier</div>
          <div style={{ fontSize: 13, color: "#5A4A32", marginBottom: 20, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>Trois niveaux de responsabilité, une hiérarchie exigeante.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <InfoCard icon={UserPlus} title="Gendarme Adjoint Volontaire">
              Premiers pas sur le terrain, en binôme avec un tuteur. Apprentissage des procédures et de la discipline militaire.
            </InfoCard>
            <InfoCard icon={Award} title="Sous-Officier (SOG)">
              À partir de Maréchal des Logis : autonomie sur les missions courantes, encadrement des GAV, premières responsabilités de patrouille.
            </InfoCard>
            <InfoCard icon={ShieldAlert} title="Officier">
              À partir de Major : commandement d'unité, gestion administrative, recrutement et stratégie de la gendarmerie.
            </InfoCard>
          </div>
        </div>

        {/* Unités spécialisées */}
        <div className="gh-fade" style={{ marginBottom: 50 }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1A1F29" }}>Nos unités</div>
          <div style={{ fontSize: 13, color: "#5A4A32", marginBottom: 20, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>
            Chaque unité a sa spécialité, comme dans la vraie gendarmerie.{" "}
            <button onClick={() => onNavigate("candidature")} className="gh-link-anim" style={{ background: "none", border: "none", padding: 0, color: "#16305C", fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", fontSize: 13 }}>
              Rejoins-en une →
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <InfoCard icon={ShieldAlert} title="GIGN">Intervention spécialisée sur les situations à haut risque : prises d'otages, forcenés, terrorisme.</InfoCard>
            <InfoCard icon={FileSearch} title="IGGN">Inspection générale : déontologie, contrôle interne, traitement des plaintes contre gendarmes.</InfoCard>
            <InfoCard icon={Car} title="EDSR">Escadron départemental de sécurité routière : contrôles vitesse, alcoolémie, accidents.</InfoCard>
            <InfoCard icon={Radio} title="CORG">Centre opérationnel : réception des appels, coordination et régulation des interventions en temps réel.</InfoCard>
            <InfoCard icon={Users} title="Brigade Alpha">Brigade territoriale de proximité — secteur A de la gendarmerie départementale.</InfoCard>
            <InfoCard icon={Users} title="Brigade Bravo">Brigade territoriale de proximité — secteur B de la gendarmerie départementale.</InfoCard>
          </div>
        </div>

        {/* Votre avis compte */}
        <div className="gh-fade" style={{ marginBottom: 50 }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1A1F29" }}>Votre avis compte</div>
          <div style={{ fontSize: 13, color: "#5A4A32", marginBottom: 20, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>Aidez-nous à améliorer la gendarmerie.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <button onClick={() => onNavigate("avis-gendarme")} className="gh-btn-anim gh-card-anim" style={{ ...cardButtonStyle, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>⭐ Noter un gendarme</div>
            </button>
            <button onClick={() => onNavigate("avis-general")} className="gh-btn-anim gh-card-anim" style={{ ...cardButtonStyle, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>⭐ Noter la Gendarmerie</div>
            </button>
            <button onClick={() => onNavigate("suggestion")} className="gh-btn-anim gh-card-anim" style={{ ...cardButtonStyle, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>💡 Faire une suggestion</div>
            </button>
          </div>
        </div>

        {/* CTA final */}
        <div className="gh-fade gh-card-anim" style={{ textAlign: "center", background: "linear-gradient(135deg, #16305C, #0B1626)", borderRadius: 18, padding: "36px 24px", boxShadow: "0 14px 34px -14px rgba(11,22,38,0.55)" }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, color: "#F5F2EA", marginBottom: 8 }}>Prêt à servir sous nos couleurs ?</div>
          <div style={{ fontSize: 13, color: "#B9C2CF", marginBottom: 20, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>Rejoins la Gendarmerie Nationale de Nîmes RP en tant que Gendarme Adjoint Volontaire.</div>
          <button onClick={() => onNavigate("candidature")} className="gh-btn-anim" style={{ background: "#B08D57", color: "#1A1F29", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "-apple-system, Segoe UI, sans-serif" }}>
            Candidater maintenant
          </button>
        </div>
      </div>
    </div>
  );
}

const cardButtonStyle = { textAlign: "left", background: "#F5F2EA", border: "none", borderRadius: 14, padding: "16px 20px", cursor: "pointer", color: "#1A1F29", boxShadow: "0 10px 26px -10px rgba(0,0,0,0.55)", transition: "transform 0.15s ease" };

/* ---------- Écran de confirmation générique ---------- */

function Confirmation({ title, message, refNumber, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 20%, #16305C, #0B1626 60%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
      <div style={{ background: "#F5F2EA", borderRadius: 10, padding: 28, maxWidth: 420, textAlign: "center", boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, marginBottom: 10, color: "#1A1F29" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#5A4A32", marginBottom: 14, lineHeight: 1.5 }}>{message}</div>
        {refNumber && <div style={{ fontFamily: "'Courier New', monospace", fontSize: 15, background: "#fff", border: "1px solid #D8D2C2", borderRadius: 6, padding: "8px 0", marginBottom: 18 }}>{refNumber}</div>}
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
    <div style={{ minHeight: "100vh", background: "#EFECE2", padding: "40px 20px", fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#1A1F29" }}>Dépôt de plainte en ligne</div>
        <div style={{ fontSize: 13, color: "#5A4A32", marginBottom: 24 }}>Ce formulaire ne remplace pas un dépôt en brigade en cas d'urgence. Toute déclaration mensongère peut être sanctionnée en jeu.</div>
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 26, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 10 }}>Identité du plaignant</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Prénom" value={form.plaignantPrenom} onChange={(v) => setForm({ ...form, plaignantPrenom: v })} />
            <Field label="Nom" value={form.plaignantNom} onChange={(v) => setForm({ ...form, plaignantNom: v })} />
          </div>
          <Field label="Pseudo Roblox" value={form.plaignantPseudoRoblox} onChange={(v) => setForm({ ...form, plaignantPseudoRoblox: v })} />
          <Field label="Pseudo Discord" value={form.plaignantPseudoDiscord} onChange={(v) => setForm({ ...form, plaignantPseudoDiscord: v })} />
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", margin: "18px 0 10px" }}>Les faits</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => setForm({ ...form, dateFaits: v })} />
            <Field label="Lieu des faits" value={form.lieuFaits} onChange={(v) => setForm({ ...form, lieuFaits: v })} placeholder="Ex : Nîmes, quartier..." />
          </div>
          <Select label="Nature de l'infraction" value={form.nature} onChange={(v) => setForm({ ...form, nature: v })} options={NATURES_INFRACTION} />
          <Field label="Description détaillée des faits" textarea value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Décrivez précisément le déroulement des faits" />
          <Field label="Personne mise en cause (si connue)" value={form.misEnCause} onChange={(v) => setForm({ ...form, misEnCause: v })} placeholder="Pseudo ou description" />
          <Field label="Témoins (si présents)" value={form.temoins} onChange={(v) => setForm({ ...form, temoins: v })} placeholder="Pseudos des témoins" />
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#5A4A32", margin: "14px 0 18px" }}>
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
    <div style={{ minHeight: "100vh", background: "#EFECE2", padding: "40px 20px", fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, marginBottom: 4, color: "#1A1F29" }}>📖 Code Pénal de Nîmes RP</div>
        <div style={{ fontSize: 13, color: "#5A4A32", marginBottom: 6 }}>
          <b>Contravention</b> = amende seule. <b>Délit</b> = prison + amende, tribunal correctionnel. <b>Crime</b> = infraction la plus grave, cour d'assises.
        </div>
        <div style={{ fontSize: 12, color: "#7A7362", marginBottom: 24 }}>
          Les amendes de toutes les infractions retenues s'additionnent toujours. Le temps de GAV ne s'additionne jamais : seul le temps le plus élevé de la sélection est retenu.
        </div>
        <div style={{ maxWidth: 320, marginBottom: 24 }}>
          <Field label="Rechercher une infraction" value={search} onChange={setSearch} placeholder="Ex : stationnement, vitesse..." />
        </div>
        {groupKeys.map((g) => (
          <div key={g} style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>{g}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {groups[g].map((a) => (
                <div key={a.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.18)" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nom}</div>
                    {a.article && <div style={{ fontSize: 11, color: "#7A7362" }}>{a.article}</div>}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12, color: "#5A4A32", flexShrink: 0, marginLeft: 12 }}>
                    {a.amende ? `${a.amende} crédits` : ""}{a.amende && a.tempsGav ? " — " : ""}{a.tempsGav}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {groupKeys.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucune infraction enregistrée pour l'instant.</div>}
      </div>
    </div>
  );
}

/* ---------- Consultation publique du casier judiciaire ---------- */

function CasierPublicLookup({ casier, onCancel }) {
  const [pseudo, setPseudo] = useState("");
  const [searched, setSearched] = useState(false);

  const s = pseudo.trim().toLowerCase();
  const dossier = casier.find((d) => (d.pseudoRoblox || "").trim().toLowerCase() === s || (d.pseudoDiscord || "").trim().toLowerCase() === s);
  const mentions = dossier ? dossier.mentions.slice().reverse() : [];

  return (
    <div style={{ minHeight: "100vh", background: "#EFECE2", padding: "40px 20px", fontFamily: "'EB Garamond', Georgia, serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#1A1F29" }}>Consultation de casier judiciaire</div>
        <div style={{ fontSize: 13, color: "#5A4A32", marginBottom: 24 }}>Renseigne ton pseudo Roblox ou Discord exact (celui utilisé lors de tes contrôles) pour voir les mentions enregistrées à ton nom.</div>
        <div style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 26, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
          <Field label="Pseudo Roblox ou Discord" value={pseudo} onChange={setPseudo} placeholder="Ton pseudo exact" />
          <button onClick={() => setSearched(true)} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Rechercher</button>

          {searched && (
            <div style={{ marginTop: 22 }}>
              {mentions.length === 0 ? (
                <div style={{ fontSize: 13, color: "#2E7D4F" }}>Aucune mention trouvée pour ce pseudo. Casier vierge.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mentions.map((m) => (
                    <div key={m.id} style={{ border: "1px solid #E4E0D4", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.2)" }}>
                      <b style={{ fontSize: 13 }}>{m.nature}</b>
                      <div style={{ fontSize: 12, color: "#5A4A32", marginTop: 4 }}>{m.dateFaits || "Date non précisée"}</div>
                      <div style={{ fontSize: 12, color: "#5A4A32", marginTop: 2 }}>
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
          style={{ fontSize: readOnly ? 15 : 26, cursor: readOnly ? "default" : "pointer", color: n <= value ? "#B08D57" : "#D8D2C2" }}
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
      <div style={{ minHeight: "100vh", background: "#EFECE2", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Merci pour ton avis !</div>
          <button onClick={onCancel} style={{ ...buttonPrimary, width: "auto", padding: "9px 20px" }}>Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#EFECE2", padding: "40px 20px", fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 16, color: "#1A1F29" }}>Noter un gendarme</div>
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <label style={labelStyle}>Pseudo Roblox ou Discord du gendarme</label>
            <input
              type="text"
              value={cibleIdentifiant}
              onChange={(e) => { setCibleIdentifiant(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Tape les premières lettres..."
              style={{ width: "100%", padding: "9px 10px", borderRadius: 6, border: "1px solid #D8D2C2", background: "#fff", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "-apple-system, Segoe UI, sans-serif" }}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #D8D2C2", borderRadius: 8, marginTop: 4, boxShadow: "0 8px 20px -8px rgba(0,0,0,0.3)", zIndex: 10, overflow: "hidden" }}>
                {suggestions.map((p, i) => (
                  <div
                    key={i}
                    onMouseDown={() => { setCibleIdentifiant(p.pseudoRoblox || p.pseudoDiscord); setShowSuggestions(false); }}
                    style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13, borderBottom: i < suggestions.length - 1 ? "1px solid #F0EDE5" : "none" }}
                  >
                    <b>{p.prenom} {p.nom}</b>
                    <span style={{ color: "#7A7362", marginLeft: 6 }}>
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
          {error && <div style={{ color: "#9C2B2B", fontSize: 12, marginBottom: 10 }}>{error}</div>}
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
      <div style={{ minHeight: "100vh", background: "#EFECE2", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Merci pour ton retour !</div>
          <button onClick={onCancel} style={{ ...buttonPrimary, width: "auto", padding: "9px 20px" }}>Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#EFECE2", padding: "40px 20px", fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 16, color: "#1A1F29" }}>Noter la Gendarmerie</div>
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Note générale</label>
            <StarRating value={note} onChange={setNote} />
          </div>
          <Field label="Commentaire (facultatif)" textarea value={commentaire} onChange={setCommentaire} />
          {error && <div style={{ color: "#9C2B2B", fontSize: 12, marginBottom: 10 }}>{error}</div>}
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
      <div style={{ minHeight: "100vh", background: "#EFECE2", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Suggestion envoyée, merci !</div>
          <button onClick={onCancel} style={{ ...buttonPrimary, width: "auto", padding: "9px 20px" }}>Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#EFECE2", padding: "40px 20px", fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1A1F29" }}>Boîte à suggestions</div>
        <div style={{ fontSize: 12, color: "#7A7362", marginBottom: 16 }}>Lue uniquement par la DGGN.</div>
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
          <Field label="Ta suggestion" textarea value={texte} onChange={setTexte} placeholder="Idée, amélioration, remarque..." />
          {error && <div style={{ color: "#9C2B2B", fontSize: 12, marginBottom: 10 }}>{error}</div>}
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
    <div style={{ minHeight: "100vh", background: "#EFECE2", padding: "40px 20px", fontFamily: "'EB Garamond', Georgia, serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#1A1F29" }}>Signaler un gendarme</div>
        <div style={{ fontSize: 13, color: "#5A4A32", marginBottom: 24 }}>Ce signalement est traité exclusivement par l'IGGN et la DGGN, en dehors de la chaîne de commandement habituelle. Toute déclaration mensongère peut être sanctionnée en jeu.</div>
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 26, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 10 }}>Identité du plaignant</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Prénom" value={form.plaignantPrenom} onChange={(v) => setForm({ ...form, plaignantPrenom: v })} />
            <Field label="Nom" value={form.plaignantNom} onChange={(v) => setForm({ ...form, plaignantNom: v })} />
          </div>
          <Field label="Pseudo Roblox" value={form.plaignantPseudoRoblox} onChange={(v) => setForm({ ...form, plaignantPseudoRoblox: v })} />
          <Field label="Pseudo Discord" value={form.plaignantPseudoDiscord} onChange={(v) => setForm({ ...form, plaignantPseudoDiscord: v })} />

          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", margin: "18px 0 10px" }}>Les faits</div>
          <Field label="Gendarme concerné (pseudo, nom ou matricule)" value={form.gendarmeConcerne} onChange={(v) => setForm({ ...form, gendarmeConcerne: v })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => setForm({ ...form, dateFaits: v })} />
            <Field label="Lieu des faits" value={form.lieuFaits} onChange={(v) => setForm({ ...form, lieuFaits: v })} />
          </div>
          <Field label="Description détaillée des faits" textarea value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Décris précisément le comportement signalé" />

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#5A4A32", margin: "14px 0 18px" }}>
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
      { key: "role_iggn", label: "Qu'est-ce que l'IGGN et quel est son rôle vis-à-vis des officiers ?", type: "textarea" },
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
      { key: "situation_ordre_dggn", label: "Un ordre venu du DGGN te semble en décalage avec le terrain. Que fais-tu ?", type: "textarea" },
    ],
  },
  {
    title: "Leadership et exemplarité",
    fields: [
      { key: "qualites_officier", label: "Quelles qualités humaines et RP juges-tu indispensables à un officier ?", type: "textarea" },
      { key: "gestion_pression", label: "Comment gères-tu la pression et les responsabilités qui viennent avec ce grade ?", type: "textarea" },
      { key: "rendre_comptes", label: "Es-tu prêt à rendre des comptes directement au commandement supérieur (DGGN/IGGN) ?", type: "select", options: OUI_NON },
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
    <div style={{ minHeight: "100vh", background: "#EFECE2", padding: "40px 20px", fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#1A1F29" }}>{title}</div>
        {intro && <div style={{ fontSize: 13, color: "#5A4A32", marginBottom: 24 }}>{intro}</div>}
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 26, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
          {sections.map((s) => (
            <div key={s.title}>
              <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", margin: "18px 0 10px" }}>{s.title}</div>
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
          {error && <div style={{ color: "#9C2B2B", fontSize: 12, margin: "10px 0" }}>{error}</div>}
          <button className="gh-btn-anim" type="submit" style={{ ...buttonPrimary, marginTop: 10 }}>Envoyer ma candidature</button>
        </form>
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

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await onLogin(username, password);
    if (!res.ok) setError(res.error || "Identifiants incorrects.");
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 20%, #16305C, #0B1626 60%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#8FA0B8", fontSize: 12, cursor: "pointer", marginBottom: 16 }}>← Retour à l'accueil</button>
        <div style={{ textAlign: "center", marginBottom: 24, color: "#F5F2EA" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6 }}>GENDARMERIE NATIONALE DE NÎMES RP</div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, marginTop: 4 }}>Portail Gendarmerie</div>
        </div>
        {blockedMsg && <div style={{ background: "#9C2B2B", color: "#fff", borderRadius: 8, padding: "10px 14px", fontSize: 12, marginBottom: 14, textAlign: "center" }}>{blockedMsg}</div>}
        <form onSubmit={handleLogin} style={{ background: "#F5F2EA", borderRadius: 10, padding: 24, boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}>
          <Field label="Identifiant" value={username} onChange={setUsername} autoFocus />
          <Field label="Mot de passe" value={password} onChange={setPassword} type="password" />
          {error && <div style={{ color: "#9C2B2B", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <button type="submit" disabled={busy} style={buttonPrimary}>{busy ? "Connexion…" : "Se connecter"}</button>
        </form>
        <div style={{ textAlign: "center", color: "#F5F2EA", opacity: 0.45, fontSize: 11, marginTop: 16 }}>Usage interne roleplay — authentification sécurisée par Firebase.</div>
      </div>
    </div>
  );
}

/* ---------- Tableau de bord connecté ---------- */

function Sidebar({ current, section, setSection, isAdmin, onLogout, counts }) {
  const isOPJ = (current.qualifications || []).includes("OPJ");
  const isRecruteur = (current.qualifications || []).includes("Recruteur");
  const canSOG = current.grade === "Maréchal des Logis";
  const canOfficier = current.grade === "Major";
  const canSeeCandidatures = isAdmin || isRecruteur;
  const canSeePlaintes = isAdmin || isOPJ;

  const isDggnOuIggn = current.unite === "DGGN" || current.unite === "IGGN";
  const isHautGrade = (current.gradeRank ?? GRADES.indexOf(current.grade)) >= DISCIPLINE_MIN_INDEX;

  const groups = [
    {
      label: "Général",
      items: [
        { id: "dossier", label: "Mon dossier" },
        { id: "annuaire", label: "Annuaire" },
        { id: "code-penal-interne", label: "Code Pénal" },
        { id: "reglements", label: "Règlements" },
        { id: "mes-avis", label: "Mes avis" },
      ],
    },
    {
      label: "Terrain",
      items: [
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

  const initiales = `${(current.prenom || "?")[0]}${(current.nom || "?")[0]}`.toUpperCase();

  return (
    <div style={{ width: 244, background: "linear-gradient(180deg, #10233D, #0B1626)", color: "#F5F2EA", padding: "22px 14px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px solid #B08D57", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 12, color: "#B08D57" }}>GN</span>
        </div>
        <div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>Gendarmerie Nationale de Nîmes RP</div>
          <div style={{ fontSize: 10, opacity: 0.55 }}>Portail Gendarmerie</div>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "#8FA0B8", opacity: 0.7, padding: "0 11px 6px", fontFamily: "-apple-system, Segoe UI, sans-serif" }}>{g.label}</div>
          {g.items.map((it) => (
            <button
              key={it.id}
              onClick={() => setSection(it.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: section === it.id ? "#16305C" : "transparent",
                color: "#F5F2EA",
                border: "none",
                borderLeft: section === it.id ? "3px solid #B08D57" : "3px solid transparent",
                borderRadius: 6,
                padding: "9px 11px",
                marginBottom: 2,
                fontSize: 13,
                fontFamily: "-apple-system, Segoe UI, sans-serif",
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
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#16305C", border: "1px solid rgba(176,141,87,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#B08D57", flexShrink: 0 }}>
            {initiales}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.prenom} {current.nom}</div>
            <div style={{ fontSize: 10, opacity: 0.55, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current.grade}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ fontSize: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.25)", color: "#F5F2EA", padding: "6px 10px", borderRadius: 6, cursor: "pointer", width: "100%" }}>Déconnexion</button>
      </div>
    </div>
  );
}

function Annuaire({ personnel }) {
  const byUnite = {};
  personnel.forEach((p) => { byUnite[p.unite] = byUnite[p.unite] || []; byUnite[p.unite].push(p); });
  const unites = Object.keys(byUnite).sort((a, b) => (UNITE_ORDER[a] ?? 99) - (UNITE_ORDER[b] ?? 99));

  return (
    <div>
      <h2 style={h2Style}>Annuaire du personnel</h2>

      {unites.map((u) => (
        <div key={u} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>{u}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {byUnite[u].sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade)).map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "12px 16px", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.18)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.prenom} {p.nom}</div>
                  <div style={{ fontSize: 12, color: "#7A7362" }}>{p.grade}{p.fonction ? " — " + p.fonction : ""}</div>
                  {(p.pseudoRoblox || p.pseudoDiscord) && (
                    <div style={{ fontSize: 11, color: "#B08D57", marginTop: 3 }}>
                      {[p.pseudoRoblox && `Roblox : ${p.pseudoRoblox}`, p.pseudoDiscord && `Discord : ${p.pseudoDiscord}`].filter(Boolean).join("  •  ")}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#7A7362" }}>{p.matricule}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {unites.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucun personnel enregistré.</div>}
    </div>
  );
}

const ROLE_COLORS = ["#16305C", "#9C2B2B", "#B08D57", "#2E7D4F", "#5A4A32", "#7A3B9C", "#1A6B8C"];

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
      <div style={{ fontSize: 12, color: "#7A7362", marginBottom: 20 }}>
        Crée des rôles réutilisables (comme sur Discord). Applique-les ensuite depuis "Gestion du personnel" pour préremplir les droits d'un compte — les autorisations restent toujours modifiables au cas par cas.
      </div>

      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier le rôle" : "Créer un rôle"}</div>
        <Field label="Nom du rôle" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} placeholder="Ex : Négociateur Senior" />
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Couleur</label>
          <div style={{ display: "flex", gap: 8 }}>
            {ROLE_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, couleur: c })} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: form.couleur === c ? "3px solid #1A1F29" : "1px solid #D8D2C2", cursor: "pointer" }} />
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
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#16305C", border: "1px solid #16305C" }}>Annuler</button>}
        </div>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {roles.map((r) => (
          <div key={r.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: r.couleur || "#7A7362", display: "inline-block" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{r.nom}</div>
                <div style={{ fontSize: 11, color: "#7A7362" }}>{r.isAdmin ? "Administrateur — " : ""}{(r.qualifications || []).join(", ") || "Aucune autorisation particulière"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => startEdit(r)} style={smallBtn}>Modifier</button>
              <button onClick={() => onDelete(r.id)} style={{ ...smallBtn, color: "#9C2B2B", borderColor: "#9C2B2B" }}>Suppr.</button>
            </div>
          </div>
        ))}
        {roles.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucun rôle créé pour l'instant.</div>}
      </div>
    </div>
  );
}

function AdminPanel({ personnel, roles, onCreate, onDelete, onUpdate }) {
  const blank = { matricule: nextRef(personnel, "GH"), nom: "", prenom: "", pseudoRoblox: "", pseudoDiscord: "", username: "", password: "", grade: GRADES[1], unite: UNITES[0], fonction: "", qualifications: [], isAdmin: false };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.nom || !form.prenom || !form.matricule) return;
    if (!editingId && (!form.username || !form.password)) return;
    setBusy(true);
    setError("");
    const data = { ...form, gradeRank: GRADES.indexOf(form.grade) };
    const res = editingId ? await onUpdate(editingId, data) : await onCreate(data);
    setBusy(false);
    if (res && !res.ok) { setError(res.error || "Une erreur est survenue."); return; }
    setEditingId(null);
    setForm({ ...blank, matricule: nextRef(personnel, "GH") });
  }
  function startEdit(p) {
    setEditingId(p.id);
    setError("");
    setForm({ matricule: p.matricule, nom: p.nom, prenom: p.prenom, pseudoRoblox: p.pseudoRoblox || "", pseudoDiscord: p.pseudoDiscord || "", username: p.username, password: "", grade: p.grade, unite: p.unite, fonction: p.fonction || "", qualifications: p.qualifications || [], isAdmin: !!p.isAdmin });
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
      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier le compte" : "Créer un compte"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Matricule" value={form.matricule} onChange={(v) => setForm({ ...form, matricule: v })} />
          <Field label="Prénom" value={form.prenom} onChange={(v) => setForm({ ...form, prenom: v })} />
          <Field label="Nom" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
          {editingId ? (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Identifiant</label>
              <div style={{ padding: "9px 10px", fontSize: 14, color: "#7A7362" }}>{form.username} (non modifiable)</div>
            </div>
          ) : (
            <>
              <Field label="Identifiant" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
              <Field label="Mot de passe" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
            </>
          )}
          <Field label="Pseudo Roblox" value={form.pseudoRoblox} onChange={(v) => setForm({ ...form, pseudoRoblox: v })} />
          <Field label="Pseudo Discord" value={form.pseudoDiscord} onChange={(v) => setForm({ ...form, pseudoDiscord: v })} />
          <Select label="Grade" value={form.grade} onChange={(v) => setForm({ ...form, grade: v })} options={GRADES} />
          <Select label="Unité" value={form.unite} onChange={(v) => setForm({ ...form, unite: v })} options={UNITES} />
          <Field label="Fonction" value={form.fonction} onChange={(v) => setForm({ ...form, fonction: v })} />
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
        {error && <div style={{ color: "#9C2B2B", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" disabled={busy} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>{busy ? "…" : editingId ? "Enregistrer" : "Créer le compte"}</button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setError(""); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#16305C", border: "1px solid #16305C" }}>Annuler</button>}
        </div>
      </form>
      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>Registre ({personnel.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {personnel.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "12px 16px", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.18)" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.prenom} {p.nom} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#7A7362" }}>({p.matricule})</span></div>
              <div style={{ fontSize: 12, color: "#7A7362" }}>{p.grade} — {p.unite}{p.isAdmin ? " — Admin" : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => startEdit(p)} style={smallBtn}>Modifier</button>
              <button onClick={() => onDelete(p.id)} style={{ ...smallBtn, color: "#9C2B2B", borderColor: "#9C2B2B" }}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUT_COLORS = { "En attente": "#B08D57", "Acceptée": "#2E7D4F", "Refusée": "#9C2B2B", "En cours": "#B08D57", "Traitée": "#2E7D4F", "Classée": "#7A7362" };

function StatutBadge({ statut }) {
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "-apple-system, Segoe UI, sans-serif", background: STATUT_COLORS[statut] || "#7A7362", color: "#fff", padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{statut}</span>;
}

function ArchiveTabs({ tab, setTab, countEnCours, countArchivees }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <button onClick={() => setTab("en-cours")} style={{ ...smallBtn, background: tab === "en-cours" ? "#16305C" : "transparent", color: tab === "en-cours" ? "#fff" : "#1A1F29", borderColor: tab === "en-cours" ? "#16305C" : "#D8D2C2" }}>En cours ({countEnCours})</button>
      <button onClick={() => setTab("archivees")} style={{ ...smallBtn, background: tab === "archivees" ? "#7A7362" : "transparent", color: tab === "archivees" ? "#fff" : "#1A1F29", borderColor: tab === "archivees" ? "#7A7362" : "#D8D2C2" }}>📁 Archivées ({countArchivees})</button>
    </div>
  );
}

function AdminCandidatures({ candidatures, onUpdateStatut }) {
  const [filter, setFilter] = useState("Toutes");
  const [tab, setTab] = useState("en-cours");
  const postes = ["Toutes", "GAV", "SOG", "Officier"];
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
          <button key={p} onClick={() => setFilter(p)} style={{ ...smallBtn, background: filter === p ? "#16305C" : "transparent", color: filter === p ? "#fff" : "#1A1F29", borderColor: filter === p ? "#16305C" : "#D8D2C2" }}>{p}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.slice().reverse().map((c) => (
          <div key={c.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 12, padding: "18px 20px", boxShadow: "0 4px 16px -8px rgba(11,22,38,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.displayName} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#16305C", fontWeight: 600, background: "#EFECE2", padding: "2px 7px", borderRadius: 5, marginLeft: 4 }}>({c.ref})</span></div>
                <div style={{ fontSize: 12, color: "#7A7362" }}>{c.poste}{c.contact ? " — " + c.contact : ""}{c.auteurMatricule ? " — soumis par " + c.auteurMatricule : ""}</div>
              </div>
              <StatutBadge statut={c.statut} />
            </div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#16305C" }}>Voir les réponses complètes ({c.answers?.length || 0})</summary>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14, background: "#FAF9F5", border: "1px solid #E4E0D4", borderRadius: 8, padding: 16 }}>
                {c.answers?.map((a, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: "#7A7362", marginBottom: 3 }}>{a.label}</div>
                    <div style={{ fontSize: 14, color: "#1A1F29", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{a.value || "—"}</div>
                  </div>
                ))}
              </div>
            </details>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => onUpdateStatut(c.id, "Acceptée")} style={{ ...smallBtn, color: "#2E7D4F", borderColor: "#2E7D4F" }}>Accepter</button>
              <button onClick={() => onUpdateStatut(c.id, "Refusée")} style={{ ...smallBtn, color: "#9C2B2B", borderColor: "#9C2B2B" }}>Refuser</button>
              <button onClick={() => onUpdateStatut(c.id, "En attente")} style={smallBtn}>Remettre en attente</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucune candidature.</div>}
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
            <div key={p.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 12, padding: "18px 20px", boxShadow: "0 4px 16px -8px rgba(11,22,38,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.plaignantPrenom} {p.plaignantNom} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#16305C", fontWeight: 600, background: "#EFECE2", padding: "2px 7px", borderRadius: 5, marginLeft: 4 }}>({p.ref})</span></div>
                  <div style={{ fontSize: 12, color: "#7A7362" }}>{p.nature} — {p.dateFaits || "date non précisée"} — {p.lieuFaits || "lieu non précisé"}</div>
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
                <div style={{ fontSize: 11, color: "#B08D57", marginTop: 8 }}>Prise en charge par {p.prisEnChargeNom} ({p.prisEnChargeMatricule})</div>
              ) : (
                <div style={{ fontSize: 11, color: "#9C2B2B", marginTop: 8 }}>Non prise en charge</div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {!p.prisEnChargeMatricule && (
                  <button onClick={() => onTakeCharge(p.id)} style={{ ...smallBtn, background: "#16305C", color: "#fff" }}>Prendre en charge</button>
                )}
                {canAct && p.prisEnChargeMatricule && (
                  <>
                    <button onClick={() => onUpdateStatut(p.id, "En cours")} style={{ ...smallBtn, color: "#B08D57", borderColor: "#B08D57" }}>Marquer en cours</button>
                    <button onClick={() => onUpdateStatut(p.id, "Traitée")} style={{ ...smallBtn, color: "#2E7D4F", borderColor: "#2E7D4F" }}>Marquer traitée</button>
                    <button onClick={() => onUpdateStatut(p.id, "Classée")} style={smallBtn}>Classer sans suite</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>{tab === "en-cours" ? "Aucune plainte en cours." : "Aucune plainte archivée."}</div>}
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
        <div style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
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
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#16305C", border: "1px solid #16305C" }}>Annuler</button>}
            </div>
          </form>
        </div>
      )}

      <div style={{ maxWidth: 320, marginBottom: 16 }}>
        <Field label="Filtrer" value={search} onChange={setSearch} placeholder="Ex : stationnement, vitesse..." />
      </div>
      {groupKeys.map((g) => (
        <div key={g} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>{g}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {groups[g].map((a) => (
              <div key={a.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.18)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nom}</div>
                  {a.article && <div style={{ fontSize: 11, color: "#7A7362" }}>{a.article}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right", fontSize: 12, color: "#5A4A32" }}>
                    {a.amende ? `${a.amende} crédits` : ""}{a.amende && a.tempsGav ? " — " : ""}{a.tempsGav}
                  </div>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startEdit(a)} style={smallBtn}>Modifier</button>
                      <button onClick={() => onDelete(a.id)} style={{ ...smallBtn, color: "#9C2B2B", borderColor: "#9C2B2B" }}>Suppr.</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {groupKeys.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucune infraction enregistrée.</div>}
    </div>
  );
}

function CasierPage({ current, casier, codePenal, onAdd, onUpdateMention, onDeleteMention }) {
  const canModify = current.isAdmin || (current.qualifications || []).includes("OPJ");
  const blank = { pseudoRoblox: "", pseudoDiscord: "", nom: "", prenom: "", nature: "", dateFaits: "", amende: "", tempsGav: "", remarques: "" };
  const [form, setForm] = useState(blank);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // { dossierId, mentionId }
  const [editForm, setEditForm] = useState(blank);
  const [showCodePenal, setShowCodePenal] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [articleSearch, setArticleSearch] = useState("");

  const identifiant = (form.pseudoRoblox || form.pseudoDiscord || "").trim();
  const existingDossier = identifiant
    ? casier.find((d) => {
        const matchRoblox = form.pseudoRoblox.trim() && (d.pseudoRoblox || "").trim().toLowerCase() === form.pseudoRoblox.trim().toLowerCase();
        const matchDiscord = form.pseudoDiscord.trim() && (d.pseudoDiscord || "").trim().toLowerCase() === form.pseudoDiscord.trim().toLowerCase();
        return matchRoblox || matchDiscord;
      })
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

  function submit(e) {
    e.preventDefault();
    if (!form.pseudoRoblox.trim() && !form.pseudoDiscord.trim()) { setError("Renseigne au moins le pseudo Roblox ou Discord : c'est ce qui permet de retrouver le casier."); return; }
    if (!form.nature.trim()) { setError("La nature de l'infraction est obligatoire."); return; }
    setError("");
    onAdd(form);
    setConfirmMsg(existingDossier ? `Mention ajoutée au casier existant de ${identifiant}.` : `Nouveau casier créé pour ${identifiant}.`);
    setForm(blank);
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
    .filter((d) => (d.pseudoRoblox || "").toLowerCase().includes(search.trim().toLowerCase()) || (d.pseudoDiscord || "").toLowerCase().includes(search.trim().toLowerCase()))
    .flatMap((d) => d.mentions.map((m) => ({ dossier: d, mention: m })))
    .sort((a, b) => new Date(a.mention.createdAt) - new Date(b.mention.createdAt));

  return (
    <div>
      <h2 style={h2Style}>Casier judiciaire</h2>

      <div style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Ajouter une mention</div>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Pseudo Roblox" value={form.pseudoRoblox} onChange={(v) => setForm({ ...form, pseudoRoblox: v })} />
            <Field label="Pseudo Discord" value={form.pseudoDiscord} onChange={(v) => setForm({ ...form, pseudoDiscord: v })} />
            <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => setForm({ ...form, dateFaits: v })} />
            <Field label="Nom (si connu)" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
            <Field label="Prénom (si connu)" value={form.prenom} onChange={(v) => setForm({ ...form, prenom: v })} />
          </div>
          {form.pseudoDiscord && (
            <div style={{ fontSize: 11, color: existingDossier ? "#B08D57" : "#2E7D4F", margin: "0 0 12px" }}>
              {existingDossier ? `Un casier existe déjà pour ${form.pseudoDiscord} — cette entrée s'y ajoutera.` : `Aucun casier existant pour ${form.pseudoDiscord} — un nouveau sera créé.`}
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <button type="button" onClick={() => setShowCodePenal((s) => !s)} style={{ ...smallBtn, background: "#B08D57", color: "#1A1F29" }}>
              📖 {showCodePenal ? "Fermer le code pénal" : "Choisir dans le code pénal"}
            </button>
            {showCodePenal && (
              <div style={{ marginTop: 10, background: "#FAF9F5", border: "1px solid #E4E0D4", borderRadius: 10, padding: 14, maxHeight: 280, overflowY: "auto" }}>
                <Field label="Filtrer" value={articleSearch} onChange={setArticleSearch} placeholder="Ex : vitesse, vol..." />
                {codePenal.length === 0 && <div style={{ fontSize: 12, color: "#7A7362" }}>Aucun article enregistré — demande à un admin d'importer/ajouter le code pénal.</div>}
                {filteredArticles.map((a) => (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 0" }}>
                    <input type="checkbox" checked={selectedArticleIds.includes(a.id)} onChange={() => toggleArticle(a.id)} />
                    <span style={{ flex: 1 }}>{a.nom} <span style={{ color: "#7A7362" }}>({a.type}{a.classe ? " " + a.classe : ""})</span></span>
                    <span style={{ color: "#7A7362" }}>{a.amende ? `${a.amende}€` : ""}</span>
                  </label>
                ))}
                {selectedArticleIds.length > 0 && (
                  <button type="button" onClick={applySelection} style={{ ...smallBtn, background: "#16305C", color: "#fff", marginTop: 10 }}>
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
          {error && <div style={{ color: "#9C2B2B", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {confirmMsg && <div style={{ color: "#2E7D4F", fontSize: 12, marginBottom: 10 }}>{confirmMsg}</div>}
          <button className="gh-btn-anim" type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Enregistrer la mention</button>
        </form>
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>
        Historique des casiers ({flat.length}){!canModify && " — lecture seule"}
      </div>
      <div style={{ marginBottom: 14, maxWidth: 320 }}>
        <Field label="Filtrer par pseudo" value={search} onChange={setSearch} placeholder="Tape un pseudo pour filtrer" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flat.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucune mention enregistrée.</div>}
        {flat.slice().reverse().map(({ dossier, mention: m }) =>
          editing && editing.dossierId === dossier.id && editing.mentionId === m.id ? (
            <form key={m.id} onSubmit={submitEdit} style={{ background: "#fff", border: "1px solid #16305C", borderRadius: 8, padding: 12 }}>
              <Field label="Nature de l'infraction" value={editForm.nature} onChange={(v) => setEditForm({ ...editForm, nature: v })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Date des faits" type="date" value={editForm.dateFaits} onChange={(v) => setEditForm({ ...editForm, dateFaits: v })} />
                <Field label="Amende" value={editForm.amende} onChange={(v) => setEditForm({ ...editForm, amende: v })} />
                <Field label="Temps de GAV" value={editForm.tempsGav} onChange={(v) => setEditForm({ ...editForm, tempsGav: v })} />
              </div>
              <Field label="Remarques" textarea value={editForm.remarques} onChange={(v) => setEditForm({ ...editForm, remarques: v })} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" style={{ ...smallBtn, background: "#16305C", color: "#fff" }}>Enregistrer</button>
                <button type="button" onClick={() => setEditing(null)} style={smallBtn}>Annuler</button>
              </div>
            </form>
          ) : (
            <div key={m.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.2)" }}>
              <div>
                <b style={{ fontSize: 13 }}>{[dossier.pseudoRoblox, dossier.pseudoDiscord].filter(Boolean).join(" — ")}</b>
                {(dossier.nom || dossier.prenom) && <span style={{ fontSize: 12, color: "#7A7362" }}> — {dossier.prenom} {dossier.nom}</span>}
              </div>
              <div style={{ fontSize: 12, color: "#5A4A32", marginTop: 4 }}>{m.nature} — {m.dateFaits || "date non précisée"}</div>
              <div style={{ fontSize: 12, color: "#5A4A32", marginTop: 2 }}>
                {m.amende && `Amende : ${m.amende}`}{m.amende && m.tempsGav ? " — " : ""}{m.tempsGav && `Temps de GAV : ${m.tempsGav}`}
                {!m.amende && !m.tempsGav && "Peine non précisée"}
              </div>
              {m.remarques && <div style={{ fontSize: 12, color: "#7A7362", marginTop: 4 }}>{m.remarques}</div>}
              <div style={{ fontSize: 11, color: "#B08D57", marginTop: 6 }}>Agent verbalisateur : {m.gendarmeNom} ({m.gendarmeMatricule})</div>
              {canModify && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => startEdit(dossier.id, m)} style={smallBtn}>Modifier</button>
                  <button onClick={() => onDeleteMention(dossier.id, m.id)} style={{ ...smallBtn, color: "#9C2B2B", borderColor: "#9C2B2B" }}>Supprimer</button>
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
      <div style={{ fontSize: 12, color: "#7A7362", marginBottom: 16 }}>Réservé à l'IGGN et à la DGGN.</div>
      <ArchiveTabs tab={tab} setTab={setTab} countEnCours={enCours.length} countArchivees={archivees.length} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.slice().reverse().map((p) => {
          const isMine = p.prisEnChargeMatricule === current.matricule;
          const canAct = current.isAdmin || isMine;
          return (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 12, padding: "18px 20px", boxShadow: "0 4px 16px -8px rgba(11,22,38,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Concerne : {p.gendarmeConcerne} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#16305C", fontWeight: 600, background: "#EFECE2", padding: "2px 7px", borderRadius: 5, marginLeft: 4 }}>({p.ref})</span></div>
                  <div style={{ fontSize: 12, color: "#7A7362" }}>Plaignant : {p.plaignantPrenom} {p.plaignantNom} — {p.dateFaits || "date non précisée"} — {p.lieuFaits || "lieu non précisé"}</div>
                </div>
                <StatutBadge statut={p.statut} />
              </div>
              <FieldRow label="Description" value={p.description} />
              <FieldRow
                label="Contact"
                value={[p.plaignantPseudoRoblox && `Roblox ${p.plaignantPseudoRoblox}`, p.plaignantPseudoDiscord && `Discord ${p.plaignantPseudoDiscord}`].filter(Boolean).join(" — ")}
              />
              {p.prisEnChargeMatricule ? (
                <div style={{ fontSize: 11, color: "#B08D57", marginTop: 8 }}>Prise en charge par {p.prisEnChargeNom} ({p.prisEnChargeMatricule})</div>
              ) : (
                <div style={{ fontSize: 11, color: "#9C2B2B", marginTop: 8 }}>Non prise en charge</div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {!p.prisEnChargeMatricule && <button onClick={() => onTakeCharge(p.id)} style={{ ...smallBtn, background: "#16305C", color: "#fff" }}>Prendre en charge</button>}
                {canAct && p.prisEnChargeMatricule && (
                  <>
                    <button onClick={() => onUpdateStatut(p.id, "En cours")} style={{ ...smallBtn, color: "#B08D57", borderColor: "#B08D57" }}>Marquer en cours</button>
                    <button onClick={() => onUpdateStatut(p.id, "Traitée")} style={{ ...smallBtn, color: "#2E7D4F", borderColor: "#2E7D4F" }}>Marquer traitée</button>
                    <button onClick={() => onUpdateStatut(p.id, "Classée")} style={smallBtn}>Classer sans suite</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>{tab === "en-cours" ? "Aucun signalement en cours." : "Aucun signalement archivé."}</div>}
      </div>
    </div>
  );
}

/* ---------- Comptes rendus internes à l'attention de l'IGGN / DGGN ---------- */

const DESTINATAIRES_CR = ["IGGN", "DGGN"];

function modeleContenu() {
  return `J'ai l'honneur de vous rendre compte des faits suivants, le ../../.... à ..h.. :

[Décrivez ici le déroulement des faits]

De retour à la brigade territoriale de Gendarmerie de Nîmes et à la demande de ma hiérarchie, j'ai rédigé ce présent rapport.`;
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
        <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>Mes avis</div>
        {!current.pseudoRoblox && !current.pseudoDiscord && (
          <div style={{ fontSize: 12, color: "#9C2B2B", marginBottom: 16 }}>Aucun pseudo Roblox/Discord enregistré sur ton compte — demande à un admin de le renseigner pour que les avis te soient attribués.</div>
        )}
        {moyenne && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <StarRating value={Math.round(moyenne)} readOnly />
            <span style={{ fontSize: 14, fontWeight: 700 }}>{moyenne} / 5</span>
            <span style={{ fontSize: 12, color: "#7A7362" }}>({mine.length} avis)</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mine.slice().reverse().map((a) => (
            <div key={a.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.2)" }}>
              <StarRating value={a.note} readOnly />
              {a.commentaire && <div style={{ fontSize: 13, color: "#5A4A32", marginTop: 6 }}>{a.commentaire}</div>}
            </div>
          ))}
          {mine.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucun avis reçu pour l'instant.</div>}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>Avis sur tout le personnel ({avisGendarmes.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Object.values(parPersonne).map((grp, i) => {
            const moy = (grp.avis.reduce((s, a) => s + a.note, 0) / grp.avis.length).toFixed(1);
            return (
              <div key={i} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <b style={{ fontSize: 13 }}>{grp.nom}</b>
                  <StarRating value={Math.round(moy)} readOnly />
                  <span style={{ fontSize: 12, color: "#7A7362" }}>{moy} / 5 ({grp.avis.length})</span>
                </div>
                {grp.avis.slice().reverse().map((a) => a.commentaire && (
                  <div key={a.id} style={{ fontSize: 12, color: "#5A4A32", marginTop: 4 }}>« {a.commentaire} »</div>
                ))}
              </div>
            );
          })}
          {avisGendarmes.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucun avis enregistré pour l'instant.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Avis généraux (tous les gendarmes) + suggestions (DGGN uniquement) ---------- */

function AvisSuggestionsPage({ current, avisGeneraux, suggestions }) {
  const canSeeSuggestions = current.isAdmin || current.unite === "DGGN";
  const moyenne = avisGeneraux.length ? (avisGeneraux.reduce((s, a) => s + a.note, 0) / avisGeneraux.length).toFixed(1) : null;

  return (
    <div>
      <h2 style={h2Style}>Avis & Suggestions</h2>

      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>Avis sur la Gendarmerie ({avisGeneraux.length})</div>
        {moyenne && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <StarRating value={Math.round(moyenne)} readOnly />
            <span style={{ fontSize: 14, fontWeight: 700 }}>{moyenne} / 5</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {avisGeneraux.slice().reverse().map((a) => (
            <div key={a.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.2)" }}>
              <StarRating value={a.note} readOnly />
              {a.commentaire && <div style={{ fontSize: 13, color: "#5A4A32", marginTop: 6 }}>{a.commentaire}</div>}
            </div>
          ))}
          {avisGeneraux.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucun avis pour l'instant.</div>}
        </div>
      </div>

      {canSeeSuggestions ? (
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>Suggestions ({suggestions.length}) — réservé DGGN</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.slice().reverse().map((s) => (
              <div key={s.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.2)" }}>
                <div style={{ fontSize: 13, color: "#1A1F29" }}>{s.texte}</div>
              </div>
            ))}
            {suggestions.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucune suggestion pour l'instant.</div>}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#7A7362" }}>Les suggestions sont réservées à la DGGN.</div>
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
        <div style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
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

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>Sanctions actives ({actives.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {actives.map((s) => (
          <div key={s.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderLeft: "4px solid #9C2B2B", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.2)" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{s.type} — {s.nomCible} ({s.matricule})</div>
            <div style={{ fontSize: 12, color: "#5A4A32", marginTop: 4 }}>{s.motif}</div>
            <div style={{ fontSize: 11, color: "#7A7362", marginTop: 4 }}>Jusqu'au {new Date(s.dateFin).toLocaleString("fr-FR")} — émis par {s.emisParNom}</div>
          </div>
        ))}
        {actives.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucune sanction active.</div>}
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>Historique (expirées)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {expirees.map((s) => (
          <div key={s.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "12px 16px", opacity: 0.6 }}>
            <div style={{ fontSize: 12 }}>{s.type} — {s.nomCible} ({s.matricule}) — expirée le {new Date(s.dateFin).toLocaleDateString("fr-FR")}</div>
          </div>
        ))}
        {expirees.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucun historique.</div>}
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
        <div style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
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

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>Historique</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {promotions.slice().reverse().map((p) => (
          <div key={p.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderLeft: `4px solid ${p.type === "Promotion" ? "#2E7D4F" : "#9C2B2B"}`, borderRadius: 10, padding: "12px 16px", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.2)" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{p.type === "Promotion" ? "⬆️" : "⬇️"} {p.nomCible}</div>
            <div style={{ fontSize: 12, color: "#5A4A32", marginTop: 2 }}>{p.ancienGrade} → {p.nouveauGrade}</div>
            <div style={{ fontSize: 11, color: "#7A7362", marginTop: 4 }}>Par {p.emisParNom} — {new Date(p.createdAt).toLocaleDateString("fr-FR")}</div>
          </div>
        ))}
        {promotions.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucun mouvement de grade enregistré.</div>}
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
          <div key={l.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
            <span style={{ color: "#7A7362" }}>{new Date(l.timestamp).toLocaleString("fr-FR")}</span> — <b>{l.auteurNom}</b> ({l.auteurMatricule}) : {l.action}{l.details ? ` — ${l.details}` : ""}
          </div>
        ))}
        {logs.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucune activité enregistrée.</div>}
      </div>
    </div>
  );
}

function CompteRenduPage({ current, comptesRendus, onAdd, onMarkTraite }) {
  const canConsult = current.isAdmin || current.unite === "DGGN" || current.unite === "IGGN";
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

      <div style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
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
              <div key={cr.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(11,22,38,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <b style={{ fontSize: 13 }}>{cr.objet}</b>
                  <span style={{ fontSize: 11, color: "#7A7362" }}>À : {cr.destinataire}</span>
                </div>
                <div style={{ fontSize: 12, color: "#5A4A32", marginTop: 4, whiteSpace: "pre-wrap" }}>{cr.contenu}</div>
                <div style={{ fontSize: 11, color: "#B08D57", marginTop: 6 }}>Rédigé par {cr.auteurNom} ({cr.auteurMatricule})</div>
                {!cr.traite && <button onClick={() => onMarkTraite(cr.id)} style={{ ...smallBtn, marginTop: 10, background: "#16305C", color: "#fff" }}>Marquer comme traité</button>}
              </div>
            ))}
            {shown.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>{tab === "en-cours" ? "Aucun compte rendu en cours." : "Aucun compte rendu archivé."}</div>}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#7A7362" }}>La consultation des comptes rendus est réservée à l'IGGN et à la DGGN.</div>
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
        <div style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
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
          <div key={n.id} style={{ background: "#FFF9E8", border: "1px solid #E8DDB0", borderLeft: "4px solid #B08D57", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>📌 {n.titre}</div>
              {current.isAdmin && <button onClick={() => onDelete(n.id)} style={{ ...smallBtn, color: "#9C2B2B", borderColor: "#9C2B2B" }}>Retirer</button>}
            </div>
            <div style={{ fontSize: 13, color: "#5A4A32", marginTop: 6, whiteSpace: "pre-wrap" }}>{n.contenu}</div>
            <div style={{ fontSize: 11, color: "#7A7362", marginTop: 8 }}>{n.auteurNom} — {new Date(n.createdAt).toLocaleDateString("fr-FR")}</div>
          </div>
        ))}
        {notesService.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucune note de service pour l'instant.</div>}
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
        <div style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier le règlement" : "Créer une case de règlement"}</div>
          <form onSubmit={submit}>
            <Field label="Titre" value={form.titre} onChange={(v) => setForm({ ...form, titre: v })} placeholder="Ex : Règlement intérieur" />
            <Field label="Contenu" textarea value={form.contenu} onChange={(v) => setForm({ ...form, contenu: v })} />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>{editingId ? "Enregistrer" : "Créer"}</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#16305C", border: "1px solid #16305C" }}>Annuler</button>}
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {reglements.map((r) => (
          <div key={r.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 12, boxShadow: "0 4px 16px -10px rgba(11,22,38,0.25)", overflow: "hidden" }}>
            <button onClick={() => setOpenId(openId === r.id ? null : r.id)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontWeight: 700, color: "#1A1F29" }}>
              📘 {r.titre}
              <span style={{ fontSize: 13, color: "#7A7362" }}>{openId === r.id ? "▲" : "▼"}</span>
            </button>
            {openId === r.id && (
              <div style={{ padding: "0 20px 20px" }}>
                <div style={{ fontSize: 13, color: "#5A4A32", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.contenu}</div>
                {current.isAdmin && (
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button onClick={() => startEdit(r)} style={smallBtn}>Modifier</button>
                    <button onClick={() => onDelete(r.id)} style={{ ...smallBtn, color: "#9C2B2B", borderColor: "#9C2B2B" }}>Supprimer</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {reglements.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucun règlement pour l'instant.</div>}
      </div>
    </div>
  );
}

function RecrutementPanel({ recrutementOuvert, onToggle }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(11,22,38,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Statut du recrutement</div>
        <div style={{ fontSize: 12, color: "#7A7362" }}>Affiché en gros sur la page d'accueil publique.</div>
      </div>
      <button onClick={onToggle} className="gh-btn-anim" style={{ ...smallBtn, background: recrutementOuvert ? "#2E7D4F" : "#9C2B2B", color: "#fff", padding: "8px 16px" }}>
        {recrutementOuvert ? "🟢 Ouvert — cliquer pour fermer" : "🔴 Fermé — cliquer pour ouvrir"}
      </button>
    </div>
  );
}

export default function App() {
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
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [dashSection, setDashSection] = useState("dossier");
  const [saveError, setSaveError] = useState("");
  const [loginBlockedMsg, setLoginBlockedMsg] = useState("");

  // Charge les données visibles compte tenu des règles Firestore (les collections
  // restreintes reviendront vides pour un visiteur non autorisé, sans erreur).
  const loadAll = useCallback(async () => {
    const [p, c, pl, plg, cr, ca, cp, lg, ag, agn, sug, san, promo, rl, ns, rgl] = await Promise.all([
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
    ]);
    setPersonnel(p); setCandidatures(c); setPlaintes(pl); setPlaintesGendarmes(plg); setComptesRendus(cr); setCasier(ca); setCodePenal(cp);
    setLogs(lg); setAvisGendarmes(ag); setAvisGeneraux(agn); setSuggestions(sug); setSanctions(san); setPromotions(promo); setRoles(rl);
    setNotesService(ns); setReglements(rgl);
    try {
      const snap = await getDoc(doc(db, "settings", "general"));
      if (snap.exists()) setRecrutementOuvert(snap.data().recrutementOuvert !== false);
    } catch (e) { /* visible par tous, pas d'erreur bloquante */ }
    return { personnel: p, sanctions: san };
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
      const profile = { matricule: nextRef([], "GH"), nom: data.nom, prenom: data.prenom, username: data.username, grade: "Colonel", gradeRank: GRADES.indexOf("Colonel"), unite: "DGGN", fonction: "Directeur Général", qualifications: ["OPJ"], isAdmin: true };
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
      const uid = await createAuthUser(usernameToEmail(data.username), data.password);
      const { password, ...profile } = data;
      await setDoc(doc(db, "personnel", uid), profile);
      await setDoc(doc(db, "annuaire_public", uid), { prenom: profile.prenom, nom: profile.nom, pseudoRoblox: profile.pseudoRoblox || "", pseudoDiscord: profile.pseudoDiscord || "" });
      await refresh();
      logAction("Création de compte", `${profile.prenom} ${profile.nom} (${profile.matricule})`);
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false, error: e.message || "Erreur lors de la création du compte." };
    }
  }
  async function handleUpdatePersonnel(id, data) {
    try {
      const { password, username, ...profile } = data;
      await updateDoc(doc(db, "personnel", id), profile);
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
    const c = { ref, statut: "En attente", createdAt: new Date().toISOString(), auteurMatricule: auteur ? auteur.matricule : null, ...data };
    try {
      const docRef = await addDoc(collection(db, "candidatures"), c);
      setCandidatures([...candidatures, { id: docRef.id, ...c }]);
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
      setConfirmation({ title: "Signalement envoyé", message: "Ton signalement a été transmis directement à l'IGGN et à la DGGN.", refNumber: ref });
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
    const { pseudoRoblox, pseudoDiscord, nom, prenom, ...mentionFields } = data;
    const mention = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), gendarmeMatricule: auteur.matricule, gendarmeNom: `${auteur.prenom} ${auteur.nom}`, ...mentionFields };
    const existing = casier.find((d) => {
      const matchRoblox = pseudoRoblox.trim() && (d.pseudoRoblox || "").trim().toLowerCase() === pseudoRoblox.trim().toLowerCase();
      const matchDiscord = pseudoDiscord.trim() && (d.pseudoDiscord || "").trim().toLowerCase() === pseudoDiscord.trim().toLowerCase();
      return matchRoblox || matchDiscord;
    });
    try {
      if (existing) {
        const mentions = [...existing.mentions, mention];
        await updateDoc(doc(db, "casier", existing.id), { mentions, pseudoRoblox: pseudoRoblox || existing.pseudoRoblox, pseudoDiscord: pseudoDiscord || existing.pseudoDiscord, nom: nom || existing.nom, prenom: prenom || existing.prenom });
        setCasier(casier.map((d) => (d.id === existing.id ? { ...d, mentions, pseudoRoblox: pseudoRoblox || d.pseudoRoblox, pseudoDiscord: pseudoDiscord || d.pseudoDiscord, nom: nom || d.nom, prenom: prenom || d.prenom } : d)));
      } else {
        const dossier = { pseudoRoblox, pseudoDiscord, nom, prenom, mentions: [mention] };
        const docRef = await addDoc(collection(db, "casier"), dossier);
        setCasier([...casier, { id: docRef.id, ...dossier }]);
      }
      logAction("Ajout mention casier", `${pseudoRoblox || pseudoDiscord} — ${mentionFields.nature}`);
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
      <div style={{ minHeight: "100vh", background: "#0B1626", display: "flex", alignItems: "center", justifyContent: "center", color: "#F5F2EA", fontFamily: "'EB Garamond', Georgia, serif" }}>
        Chargement…
      </div>
    );
  }

  if (view === "public") {
    if (publicSection === "home") return <PublicHome onNavigate={(s) => (s === "login" ? setView("login") : setPublicSection(s))} recrutementOuvert={recrutementOuvert} />;
    if (publicSection === "plainte") return <PlainteForm onSubmit={handleSubmitPlainte} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "candidature")
      return (
        <ApplicationForm
          title="Candidature — Gendarme Adjoint Volontaire (GAV)"
          intro="Rejoins les rangs de la Gendarmerie Nationale de Nîmes RP. Réponds avec sérieux, ta candidature sera étudiée par l'administration."
          sections={GAV_SECTIONS}
          poste="GAV"
          onSubmit={(data) => handleSubmitCandidature(data)}
          onCancel={() => setPublicSection("home")}
        />
      );
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

  return (
    <div style={{ display: "flex", fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif", background: "#EFECE2", minHeight: "100vh" }}>
      <Sidebar
        current={current}
        section={dashSection}
        setSection={setDashSection}
        isAdmin={!!current.isAdmin}
        onLogout={async () => { try { await signOut(auth); } catch (e) {} setView("public"); setPublicSection("home"); }}
        counts={{
          candidatures: candidatures.filter((c) => c.statut === "En attente").length,
          plaintes: plaintes.filter((p) => p.statut === "En attente").length,
          plaintesGendarmes: plaintesGendarmes.filter((p) => p.statut === "En attente").length,
        }}
      />
      <div style={{ flex: 1, padding: dashSection.startsWith("postuler") ? 0 : "32px 40px" }}>
        {saveError && <div style={{ color: "#9C2B2B", fontSize: 12, margin: "14px 0 0 40px" }}>{saveError}</div>}
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
                (current.isAdmin || current.unite === "DGGN" || current.unite === "IGGN") && { label: "Signalements gendarmes", value: plaintesGendarmes.filter((p) => p.statut === "En attente").length },
                { label: "Personnel enregistré", value: personnel.length },
              ].filter(Boolean);
              return (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: "#1A1F29" }}>{salutation}, {current.prenom} 👋</div>
                    <div style={{ fontSize: 13, color: "#7A7362", marginTop: 4 }}>{current.grade} — {current.unite}{current.fonction ? ` — ${current.fonction}` : ""}</div>
                  </div>
                  {mesSanctionsActives.length > 0 && (
                    <div style={{ background: "#9C2B2B", color: "#fff", borderRadius: 10, padding: "14px 18px", marginBottom: 20, fontSize: 13 }}>
                      ⚠️ Tu as {mesSanctionsActives.length} sanction(s) active(s) : {mesSanctionsActives.map((s) => s.type).join(", ")}.
                    </div>
                  )}
                  {stats.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
                      {stats.map((s) => (
                        <div key={s.label} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 12, padding: "16px 18px", boxShadow: "0 4px 16px -10px rgba(11,22,38,0.25)" }}>
                          <div style={{ fontSize: 24, fontWeight: 700, color: "#16305C", fontFamily: "'Playfair Display', Georgia, serif" }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: "#7A7362", marginTop: 2, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            {(current.isAdmin || notesService.length > 0) && (
              <div style={{ marginBottom: 28 }}>
                <h2 style={h2Style}>Notes de service</h2>
                <NotesServicePanel current={current} notesService={notesService} onCreate={handleCreateNoteService} onDelete={handleDeleteNoteService} />
              </div>
            )}
            <h2 style={h2Style}>Ma carte de service</h2>
            <CarteService p={current} />
          </div>
        )}
        {dashSection === "annuaire" && <Annuaire personnel={personnel} />}
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
        {dashSection === "admin-personnel" && current.isAdmin && (
          <div>
            <RecrutementPanel recrutementOuvert={recrutementOuvert} onToggle={handleToggleRecrutement} />
            <AdminPanel personnel={personnel} roles={roles} onCreate={handleCreatePersonnel} onDelete={handleDeletePersonnel} onUpdate={handleUpdatePersonnel} />
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
        {dashSection === "plaintes-gendarmes" && (current.isAdmin || current.unite === "DGGN" || current.unite === "IGGN") && (
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
  );
}
