import React, { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const personnelRef = doc(db, "gendarmerie", "personnel");
const candidaturesRef = doc(db, "gendarmerie", "candidatures");
const plaintesRef = doc(db, "gendarmerie", "plaintes");
const casierRef = doc(db, "gendarmerie", "casier");

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
  "Recruteur",
  "Formateur",
  "Opérateur CORG",
  "Habilitation OPJ",
  "Habilitation ERI",
  "Habilitation BMO",
  "Habilitation Négociateur",
  "Brigade Alpha",
  "Brigade Bravo",
];

const OFFICIER_INDEX = GRADES.indexOf("Sous-Lieutenant");
const SOG_MIN_INDEX = GRADES.indexOf("Maréchal des Logis");
const OFFICIER_CANDIDATURE_MIN_INDEX = GRADES.indexOf("Major");

const UNITES = [
  "Brigade Territoriale",
  "ERI",
  "PSIG",
  "Section de Recherches",
  "UNPJ",
  "GIGN",
  "IGGN",
  "BMO",
  "DGGN",
];

const UNITE_ORDER = UNITES.reduce((acc, u, i) => ({ ...acc, [u]: i }), {});

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

// Convertit d'anciens casiers "à plat" (une entrée = une infraction) vers la nouvelle
// structure par dossier (un pseudo Roblox = un dossier contenant plusieurs mentions).
function migrateCasier(list) {
  let changed = false;
  const dossiers = {};
  const order = [];
  list.forEach((item) => {
    if (item.mentions) {
      const key = "d:" + item.id;
      dossiers[key] = item;
      order.push(key);
      return;
    }
    changed = true;
    const pseudo = item.pseudoRoblox || item.pseudoDiscord || "Pseudo inconnu";
    const key = "p:" + pseudo.toLowerCase();
    if (!dossiers[key]) {
      dossiers[key] = { id: crypto.randomUUID(), pseudoRoblox: pseudo, nom: item.nom || "", prenom: item.prenom || "", mentions: [] };
      order.push(key);
    }
    dossiers[key].mentions.push({
      id: item.id || crypto.randomUUID(),
      createdAt: item.createdAt || new Date().toISOString(),
      gendarmeMatricule: item.gendarmeMatricule || "",
      gendarmeNom: item.gendarmeNom || "",
      nature: item.nature || "Infraction (ancien format)",
      dateFaits: item.dateFaits || "",
      amende: item.peine || "",
      tempsGav: "",
      remarques: item.remarques || (item.gravite ? `Ancienne gravité enregistrée : ${item.gravite}` : ""),
    });
  });
  return { list: order.map((k) => dossiers[k]), changed };
}

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
const smallBtn = { fontSize: 12, background: "transparent", border: "1px solid #D8D2C2", borderRadius: 6, padding: "5px 10px", cursor: "pointer" };
const h2Style = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, marginBottom: 16, color: "#1A1F29" };
const buttonPrimary = {
  width: "100%",
  padding: "10px 0",
  marginTop: 6,
  background: "#16305C",
  color: "#F5F2EA",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
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

function PublicHome({ onNavigate }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 20%, #16305C, #0B1626 60%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6, color: "#F5F2EA" }}>EMERGENCY HAMBOURG</div>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 30, fontWeight: 700, color: "#F5F2EA", marginTop: 4, marginBottom: 6 }}>Gendarmerie Nationale</div>
        <div style={{ color: "#B9C2CF", fontSize: 13, marginBottom: 32 }}>Portail citoyen — dépôt de plainte et candidatures</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={() => onNavigate("plainte")} style={cardButtonStyle}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Déposer plainte</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Signaler des faits dont vous avez été victime ou témoin</div>
          </button>
          <button onClick={() => onNavigate("candidature")} style={cardButtonStyle}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Candidater en tant que GAV</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Rejoindre les rangs de la gendarmerie</div>
          </button>
          <button onClick={() => onNavigate("casier-public")} style={cardButtonStyle}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Consulter mon casier judiciaire</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Voir les mentions enregistrées à mon nom</div>
          </button>
        </div>
        <button onClick={() => onNavigate("login")} style={{ marginTop: 28, background: "none", border: "none", color: "#8FA0B8", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
          Espace gendarmes — connexion
        </button>
      </div>
    </div>
  );
}

const cardButtonStyle = { textAlign: "left", background: "#F5F2EA", border: "none", borderRadius: 10, padding: "16px 18px", cursor: "pointer", color: "#1A1F29", boxShadow: "0 8px 20px -8px rgba(0,0,0,0.5)" };

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
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 10 }}>Identité du plaignant</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Prénom" value={form.plaignantPrenom} onChange={(v) => setForm({ ...form, plaignantPrenom: v })} />
            <Field label="Nom" value={form.plaignantNom} onChange={(v) => setForm({ ...form, plaignantNom: v })} />
          </div>
          <Field label="Pseudo Roblox + @" value={form.plaignantPseudoRoblox} onChange={(v) => setForm({ ...form, plaignantPseudoRoblox: v })} />
          <Field label="Pseudo Discord + @" value={form.plaignantPseudoDiscord} onChange={(v) => setForm({ ...form, plaignantPseudoDiscord: v })} />
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", margin: "18px 0 10px" }}>Les faits</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => setForm({ ...form, dateFaits: v })} />
            <Field label="Lieu des faits" value={form.lieuFaits} onChange={(v) => setForm({ ...form, lieuFaits: v })} placeholder="Ex : Hambourg, quartier..." />
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

/* ---------- Consultation publique du casier judiciaire ---------- */

function CasierPublicLookup({ casier, onCancel }) {
  const [pseudoRoblox, setPseudoRoblox] = useState("");
  const [searched, setSearched] = useState(false);

  const dossier = casier.find((d) => (d.pseudoRoblox || "").trim().toLowerCase() === pseudoRoblox.trim().toLowerCase());
  const mentions = dossier ? dossier.mentions.slice().reverse() : [];

  return (
    <div style={{ minHeight: "100vh", background: "#EFECE2", padding: "40px 20px", fontFamily: "'EB Garamond', Georgia, serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#1A1F29" }}>Consultation de casier judiciaire</div>
        <div style={{ fontSize: 13, color: "#5A4A32", marginBottom: 24 }}>Renseigne ton pseudo Roblox exact (celui utilisé lors de tes contrôles) pour voir les mentions enregistrées à ton nom.</div>
        <div style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: 22 }}>
          <Field label="Pseudo Roblox + @" value={pseudoRoblox} onChange={setPseudoRoblox} placeholder="Ton pseudo Roblox exact" />
          <button onClick={() => setSearched(true)} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Rechercher</button>

          {searched && (
            <div style={{ marginTop: 22 }}>
              {mentions.length === 0 ? (
                <div style={{ fontSize: 13, color: "#2E7D4F" }}>Aucune mention trouvée pour ce pseudo. Casier vierge.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mentions.map((m) => (
                    <div key={m.id} style={{ border: "1px solid #E4E0D4", borderRadius: 8, padding: 12 }}>
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

/* ---------- Configuration des questions de candidature (GAV / SOG / Officier) ---------- */

const GAV_SECTIONS = [
  {
    title: "Informations générales",
    fields: [
      { key: "pseudoRoblox", label: "Pseudo Roblox + @", required: true },
      { key: "pseudoDiscord", label: "Pseudo Discord + @", required: true },
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
      { key: "pseudoRoblox", label: "Pseudo Roblox + @", required: true },
      { key: "pseudoDiscord", label: "Pseudo Discord + @", required: true },
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
      { key: "pseudoRoblox", label: "Pseudo Roblox + @", required: true },
      { key: "pseudoDiscord", label: "Pseudo Discord + @", required: true },
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
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: 22 }}>
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
          <button type="submit" style={{ ...buttonPrimary, marginTop: 10 }}>Envoyer ma candidature</button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Écran de connexion ---------- */

function LoginScreen({ personnel, onLogin, onCreateFirstAdmin, onBack, loading }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [setupNom, setSetupNom] = useState("");
  const [setupPrenom, setSetupPrenom] = useState("");
  const [setupUser, setSetupUser] = useState("");
  const [setupPass, setSetupPass] = useState("");

  const isEmpty = !loading && personnel.length === 0;

  function handleLogin(e) {
    e.preventDefault();
    const found = personnel.find((p) => p.username === username.trim() && p.password === password);
    if (!found) { setError("Identifiants incorrects."); return; }
    setError("");
    onLogin(found);
  }

  function handleSetup(e) {
    e.preventDefault();
    if (!setupNom || !setupPrenom || !setupUser || !setupPass) return;
    onCreateFirstAdmin({ nom: setupNom, prenom: setupPrenom, username: setupUser.trim(), password: setupPass });
  }

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 20%, #16305C, #0B1626 60%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#8FA0B8", fontSize: 12, cursor: "pointer", marginBottom: 16 }}>← Retour à l'accueil</button>
        <div style={{ textAlign: "center", marginBottom: 24, color: "#F5F2EA" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6 }}>EMERGENCY HAMBOURG</div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, marginTop: 4 }}>Portail Gendarmerie</div>
        </div>
        {loading ? (
          <div style={{ color: "#F5F2EA", textAlign: "center", opacity: 0.7 }}>Chargement…</div>
        ) : isEmpty ? (
          <form onSubmit={handleSetup} style={{ background: "#F5F2EA", borderRadius: 10, padding: 24, boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "#1A1F29" }}>Configuration initiale</div>
            <div style={{ fontSize: 12, color: "#5A4A32", marginBottom: 14 }}>Aucun compte n'existe encore. Crée le premier compte administrateur (Directeur Général).</div>
            <Field label="Prénom" value={setupPrenom} onChange={setSetupPrenom} />
            <Field label="Nom" value={setupNom} onChange={setSetupNom} />
            <Field label="Identifiant" value={setupUser} onChange={setSetupUser} />
            <Field label="Mot de passe" value={setupPass} onChange={setSetupPass} type="password" />
            <button type="submit" style={buttonPrimary}>Créer le compte administrateur</button>
          </form>
        ) : (
          <form onSubmit={handleLogin} style={{ background: "#F5F2EA", borderRadius: 10, padding: 24, boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}>
            <Field label="Identifiant" value={username} onChange={setUsername} autoFocus />
            <Field label="Mot de passe" value={password} onChange={setPassword} type="password" />
            {error && <div style={{ color: "#9C2B2B", fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <button type="submit" style={buttonPrimary}>Se connecter</button>
          </form>
        )}
        <div style={{ textAlign: "center", color: "#F5F2EA", opacity: 0.45, fontSize: 11, marginTop: 16 }}>Usage interne roleplay — données non chiffrées.</div>
      </div>
    </div>
  );
}

/* ---------- Tableau de bord connecté ---------- */

function Sidebar({ current, section, setSection, isAdmin, onLogout, counts }) {
  const isOPJ = (current.qualifications || []).includes("Habilitation OPJ");
  const isRecruteur = (current.qualifications || []).includes("Recruteur");
  const canSOG = current.grade === "Maréchal des Logis";
  const canOfficier = current.grade === "Major";
  const canSeeCandidatures = isAdmin || isRecruteur;
  const canSeePlaintes = isAdmin || isOPJ;

  const items = [
    { id: "dossier", label: "Mon dossier" },
    { id: "annuaire", label: "Annuaire" },
    { id: "casier", label: "Casier judiciaire" },
    ...(canSOG ? [{ id: "postuler-sog", label: "Postuler SOG" }] : []),
    ...(canOfficier ? [{ id: "postuler-officier", label: "Postuler Officier" }] : []),
    ...(isAdmin ? [{ id: "admin-personnel", label: "Gestion du personnel" }] : []),
    ...(canSeeCandidatures ? [{ id: "admin-candidatures", label: "Candidatures" + (counts.candidatures ? ` (${counts.candidatures})` : "") }] : []),
    ...(canSeePlaintes ? [{ id: "admin-plaintes", label: "Plaintes" + (counts.plaintes ? ` (${counts.plaintes})` : "") }] : []),
  ];

  return (
    <div style={{ width: 230, background: "#10233D", color: "#F5F2EA", padding: "20px 14px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box" }}>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Emergency Hambourg</div>
      <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 24 }}>Portail Gendarmerie</div>
      {items.map((it) => (
        <button key={it.id} onClick={() => setSection(it.id)} style={{ textAlign: "left", background: section === it.id ? "#16305C" : "transparent", color: "#F5F2EA", border: "none", borderRadius: 6, padding: "9px 10px", marginBottom: 4, fontSize: 13, cursor: "pointer" }}>
          {it.label}
        </button>
      ))}
      <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{current.prenom} {current.nom}</div>
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
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #E4E0D4", borderRadius: 8, padding: "10px 14px" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.prenom} {p.nom}</div>
                  <div style={{ fontSize: 12, color: "#7A7362" }}>{p.grade}{p.fonction ? " — " + p.fonction : ""}</div>
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

function AdminPanel({ personnel, onCreate, onDelete, onUpdate }) {
  const blank = { matricule: nextRef(personnel, "GH"), nom: "", prenom: "", username: "", password: "", grade: GRADES[1], unite: UNITES[0], fonction: "", qualifications: [], isAdmin: false };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  function submit(e) {
    e.preventDefault();
    if (!form.nom || !form.prenom || !form.username || !form.password || !form.matricule) return;
    if (editingId) { onUpdate(editingId, form); setEditingId(null); } else { onCreate(form); }
    setForm({ ...blank, matricule: nextRef(personnel, "GH") });
  }
  function startEdit(p) {
    setEditingId(p.id);
    setForm({ matricule: p.matricule, nom: p.nom, prenom: p.prenom, username: p.username, password: p.password, grade: p.grade, unite: p.unite, fonction: p.fonction || "", qualifications: p.qualifications || [], isAdmin: !!p.isAdmin });
  }
  function toggleQualification(q) {
    setForm((f) => ({ ...f, qualifications: f.qualifications.includes(q) ? f.qualifications.filter((x) => x !== q) : [...f.qualifications, q] }));
  }

  return (
    <div>
      <h2 style={h2Style}>Gestion du personnel</h2>
      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: 18, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier le compte" : "Créer un compte"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Matricule" value={form.matricule} onChange={(v) => setForm({ ...form, matricule: v })} />
          <Field label="Prénom" value={form.prenom} onChange={(v) => setForm({ ...form, prenom: v })} />
          <Field label="Nom" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
          <Field label="Identifiant" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          <Field label="Mot de passe" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <Select label="Grade" value={form.grade} onChange={(v) => setForm({ ...form, grade: v })} options={GRADES} />
          <Select label="Unité" value={form.unite} onChange={(v) => setForm({ ...form, unite: v })} options={UNITES} />
          <Field label="Fonction" value={form.fonction} onChange={(v) => setForm({ ...form, fonction: v })} />
        </div>
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
        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>{editingId ? "Enregistrer" : "Créer le compte"}</button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#16305C", border: "1px solid #16305C" }}>Annuler</button>}
        </div>
      </form>
      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>Registre ({personnel.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {personnel.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #E4E0D4", borderRadius: 8, padding: "10px 14px" }}>
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
  return <span style={{ fontSize: 10, fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif", background: STATUT_COLORS[statut] || "#7A7362", color: "#fff", padding: "3px 8px", borderRadius: 20 }}>{statut}</span>;
}

function AdminCandidatures({ candidatures, onUpdateStatut }) {
  const [filter, setFilter] = useState("Toutes");
  const postes = ["Toutes", "GAV", "SOG", "Officier"];
  const filtered = filter === "Toutes" ? candidatures : candidatures.filter((c) => c.poste === filter);

  return (
    <div>
      <h2 style={h2Style}>Candidatures reçues</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {postes.map((p) => (
          <button key={p} onClick={() => setFilter(p)} style={{ ...smallBtn, background: filter === p ? "#16305C" : "transparent", color: filter === p ? "#fff" : "#1A1F29", borderColor: filter === p ? "#16305C" : "#D8D2C2" }}>{p}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.slice().reverse().map((c) => (
          <div key={c.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 8, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.displayName} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#7A7362", fontWeight: 400 }}>({c.ref})</span></div>
                <div style={{ fontSize: 12, color: "#7A7362" }}>{c.poste}{c.contact ? " — " + c.contact : ""}{c.auteurMatricule ? " — soumis par " + c.auteurMatricule : ""}</div>
              </div>
              <StatutBadge statut={c.statut} />
            </div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "#16305C" }}>Voir les réponses complètes</summary>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {c.answers?.map((a, i) => (
                  <div key={i} style={{ fontSize: 12 }}><b>{a.label}</b> — {a.value || "—"}</div>
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
  return (
    <div>
      <h2 style={h2Style}>Plaintes reçues</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plaintes.slice().reverse().map((p) => {
          const isMine = p.prisEnChargeMatricule === current.matricule;
          const canAct = current.isAdmin || isMine;
          return (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.plaignantPrenom} {p.plaignantNom} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#7A7362", fontWeight: 400 }}>({p.ref})</span></div>
                  <div style={{ fontSize: 12, color: "#7A7362" }}>{p.nature} — {p.dateFaits || "date non précisée"} — {p.lieuFaits || "lieu non précisé"}</div>
                </div>
                <StatutBadge statut={p.statut} />
              </div>
              <div style={{ fontSize: 12, marginTop: 8 }}><b>Description :</b> {p.description}</div>
              {p.misEnCause && <div style={{ fontSize: 12, marginTop: 4 }}><b>Mis en cause :</b> {p.misEnCause}</div>}
              {p.temoins && <div style={{ fontSize: 12, marginTop: 4 }}><b>Témoins :</b> {p.temoins}</div>}
              {(p.plaignantPseudoRoblox || p.plaignantPseudoDiscord) && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  <b>Contact :</b> {p.plaignantPseudoRoblox && `Roblox ${p.plaignantPseudoRoblox}`}{p.plaignantPseudoRoblox && p.plaignantPseudoDiscord ? " — " : ""}{p.plaignantPseudoDiscord && `Discord ${p.plaignantPseudoDiscord}`}
                </div>
              )}

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
        {plaintes.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucune plainte reçue.</div>}
      </div>
    </div>
  );
}

function CasierPage({ current, casier, onAdd, onUpdateMention, onDeleteMention }) {
  const canModify = current.isAdmin || (current.qualifications || []).includes("Habilitation OPJ");
  const blank = { pseudoRoblox: "", nom: "", prenom: "", nature: "", dateFaits: "", amende: "", tempsGav: "", remarques: "" };
  const [form, setForm] = useState(blank);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // { dossierId, mentionId }
  const [editForm, setEditForm] = useState(blank);

  const existingDossier = form.pseudoRoblox
    ? casier.find((d) => (d.pseudoRoblox || "").trim().toLowerCase() === form.pseudoRoblox.trim().toLowerCase())
    : null;

  function submit(e) {
    e.preventDefault();
    if (!form.pseudoRoblox || !form.nature) return;
    onAdd(form);
    setConfirmMsg(existingDossier ? `Mention ajoutée au casier existant de ${form.pseudoRoblox}.` : `Nouveau casier créé pour ${form.pseudoRoblox}.`);
    setForm(blank);
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
    .filter((d) => (d.pseudoRoblox || "").toLowerCase().includes(search.trim().toLowerCase()))
    .flatMap((d) => d.mentions.map((m) => ({ dossier: d, mention: m })))
    .sort((a, b) => new Date(a.mention.createdAt) - new Date(b.mention.createdAt));

  return (
    <div>
      <h2 style={h2Style}>Casier judiciaire</h2>

      <div style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: 18, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Ajouter une mention</div>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Pseudo Roblox + @" value={form.pseudoRoblox} onChange={(v) => setForm({ ...form, pseudoRoblox: v })} />
            <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => setForm({ ...form, dateFaits: v })} />
            <Field label="Nom (si connu)" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
            <Field label="Prénom (si connu)" value={form.prenom} onChange={(v) => setForm({ ...form, prenom: v })} />
          </div>
          {form.pseudoRoblox && (
            <div style={{ fontSize: 11, color: existingDossier ? "#B08D57" : "#2E7D4F", margin: "0 0 12px" }}>
              {existingDossier ? `Un casier existe déjà pour ${form.pseudoRoblox} — cette entrée s'y ajoutera.` : `Aucun casier existant pour ${form.pseudoRoblox} — un nouveau sera créé.`}
            </div>
          )}
          <Field label="Nature de l'infraction" value={form.nature} onChange={(v) => setForm({ ...form, nature: v })} placeholder="Décris librement l'infraction" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Amende" value={form.amende} onChange={(v) => setForm({ ...form, amende: v })} placeholder="Ex : 500 crédits" />
            <Field label="Temps de GAV" value={form.tempsGav} onChange={(v) => setForm({ ...form, tempsGav: v })} placeholder="Ex : 3 jours" />
          </div>
          <Field label="Remarques (facultatif)" textarea value={form.remarques} onChange={(v) => setForm({ ...form, remarques: v })} />
          {confirmMsg && <div style={{ color: "#2E7D4F", fontSize: 12, marginBottom: 10 }}>{confirmMsg}</div>}
          <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Enregistrer la mention</button>
        </form>
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>
        Historique des casiers ({flat.length}){!canModify && " — lecture seule"}
      </div>
      <div style={{ marginBottom: 14, maxWidth: 320 }}>
        <Field label="Filtrer par pseudo Roblox" value={search} onChange={setSearch} placeholder="Tape un pseudo pour filtrer" />
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
            <div key={m.id} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 8, padding: 12 }}>
              <div>
                <b style={{ fontSize: 13 }}>{dossier.pseudoRoblox}</b>
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

/* ---------- App racine ---------- */

export default function App() {
  const [view, setView] = useState("public"); // public | login | dashboard
  const [publicSection, setPublicSection] = useState("home"); // home | plainte | candidature | confirmation
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationDash, setConfirmationDash] = useState(null);

  const [personnel, setPersonnel] = useState([]);
  const [candidatures, setCandidatures] = useState([]);
  const [plaintes, setPlaintes] = useState([]);
  const [casier, setCasier] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [dashSection, setDashSection] = useState("dossier");
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    async function safeGet(ref) {
      try {
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data().list || [] : [];
      } catch (e) {
        console.error(e);
        return [];
      }
    }
    const [p, c, pl, caRaw] = await Promise.all([safeGet(personnelRef), safeGet(candidaturesRef), safeGet(plaintesRef), safeGet(casierRef)]);
    setPersonnel(p); setCandidatures(c); setPlaintes(pl);
    const { list: ca, changed } = migrateCasier(caRaw);
    setCasier(ca);
    if (changed) {
      try { await setDoc(casierRef, { list: ca }); } catch (e) { console.error("Migration casier échouée :", e); }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function persist(ref, list, setter) {
    setter(list);
    try {
      await setDoc(ref, { list });
      setSaveError("");
    } catch (e) {
      console.error(e);
      setSaveError("Échec de l'enregistrement, réessaie.");
    }
  }

  // Personnel
  function handleCreateFirstAdmin(data) {
    const p = { id: crypto.randomUUID(), matricule: nextRef([], "GH"), grade: "Colonel", unite: "DGGN", fonction: "Directeur Général", qualifications: ["Habilitation OPJ"], isAdmin: true, ...data };
    persist(personnelRef, [p], setPersonnel);
    setCurrent(p);
    setView("dashboard");
  }
  function handleCreatePersonnel(data) {
    const p = { id: crypto.randomUUID(), ...data };
    persist(personnelRef, [...personnel, p], setPersonnel);
  }
  function handleUpdatePersonnel(id, data) {
    const list = personnel.map((p) => (p.id === id ? { ...p, ...data } : p));
    persist(personnelRef, list, setPersonnel);
    if (current?.id === id) setCurrent({ ...current, ...data });
  }
  function handleDeletePersonnel(id) {
    if (id === current?.id) return;
    persist(personnelRef, personnel.filter((p) => p.id !== id), setPersonnel);
  }

  // Candidatures (GAV publique, SOG/Officier internes)
  function handleSubmitCandidature(data, auteur) {
    const ref = nextRef(candidatures, "CD");
    const c = { id: crypto.randomUUID(), ref, statut: "En attente", createdAt: new Date().toISOString(), auteurMatricule: auteur ? auteur.matricule : null, ...data };
    persist(candidaturesRef, [...candidatures, c], setCandidatures);
    const conf = { title: "Candidature envoyée", message: "Ta candidature a bien été transmise à l'administration. Tu seras recontacté via Discord.", refNumber: ref };
    if (auteur) {
      setConfirmationDash(conf);
    } else {
      setConfirmation(conf);
      setPublicSection("confirmation");
    }
  }
  function handleUpdateCandidatureStatut(id, statut) {
    persist(candidaturesRef, candidatures.map((c) => (c.id === id ? { ...c, statut } : c)), setCandidatures);
  }

  // Plaintes (publiques)
  function handleSubmitPlainte(data) {
    const ref = nextRef(plaintes, "PL");
    const p = { id: crypto.randomUUID(), ref, statut: "En attente", createdAt: new Date().toISOString(), ...data };
    persist(plaintesRef, [...plaintes, p], setPlaintes);
    setConfirmation({ title: "Plainte enregistrée", message: "Ta plainte a bien été transmise à la gendarmerie. Un gendarme la traitera prochainement.", refNumber: ref });
    setPublicSection("confirmation");
  }
  function handleUpdatePlainteStatut(id, statut) {
    persist(plaintesRef, plaintes.map((p) => (p.id === id ? { ...p, statut } : p)), setPlaintes);
  }
  function handleTakeChargePlainte(id) {
    persist(plaintesRef, plaintes.map((p) => (p.id === id ? { ...p, prisEnChargeMatricule: current.matricule, prisEnChargeNom: `${current.prenom} ${current.nom}` } : p)), setPlaintes);
  }

  // Casier judiciaire (un dossier par pseudo Roblox, chaque dossier contient plusieurs mentions)
  function handleAddCasier(data, auteur) {
    const { pseudoRoblox, nom, prenom, ...mentionFields } = data;
    const mention = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), gendarmeMatricule: auteur.matricule, gendarmeNom: `${auteur.prenom} ${auteur.nom}`, ...mentionFields };
    const existingIdx = casier.findIndex((d) => (d.pseudoRoblox || "").trim().toLowerCase() === pseudoRoblox.trim().toLowerCase());
    let list;
    if (existingIdx >= 0) {
      list = casier.map((d, i) => (i === existingIdx ? { ...d, nom: nom || d.nom, prenom: prenom || d.prenom, mentions: [...d.mentions, mention] } : d));
    } else {
      list = [...casier, { id: crypto.randomUUID(), pseudoRoblox, nom, prenom, mentions: [mention] }];
    }
    persist(casierRef, list, setCasier);
  }
  function handleUpdateCasierMention(dossierId, mentionId, data) {
    const list = casier.map((d) => (d.id === dossierId ? { ...d, mentions: d.mentions.map((m) => (m.id === mentionId ? { ...m, ...data } : m)) } : d));
    persist(casierRef, list, setCasier);
  }
  function handleDeleteCasierMention(dossierId, mentionId) {
    const list = casier.map((d) => (d.id === dossierId ? { ...d, mentions: d.mentions.filter((m) => m.id !== mentionId) } : d));
    persist(casierRef, list, setCasier);
  }

  /* ---------- Routage ---------- */

  if (view === "public") {
    if (publicSection === "home") return <PublicHome onNavigate={(s) => (s === "login" ? setView("login") : setPublicSection(s))} />;
    if (publicSection === "plainte") return <PlainteForm onSubmit={handleSubmitPlainte} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "candidature")
      return (
        <ApplicationForm
          title="Candidature — Gendarme Adjoint Volontaire (GAV)"
          intro="Rejoins les rangs de la gendarmerie d'Emergency Hambourg. Réponds avec sérieux, ta candidature sera étudiée par l'administration."
          sections={GAV_SECTIONS}
          poste="GAV"
          onSubmit={(data) => handleSubmitCandidature(data)}
          onCancel={() => setPublicSection("home")}
        />
      );
    if (publicSection === "casier-public") return <CasierPublicLookup casier={casier} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "confirmation" && confirmation) {
      return <Confirmation {...confirmation} onBack={() => { setPublicSection("home"); setConfirmation(null); }} />;
    }
  }

  if (view === "login") {
    return (
      <LoginScreen
        personnel={personnel}
        loading={loading}
        onLogin={(p) => { setCurrent(p); setView("dashboard"); }}
        onCreateFirstAdmin={handleCreateFirstAdmin}
        onBack={() => setView("public")}
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
        onLogout={() => { setCurrent(null); setView("public"); setPublicSection("home"); }}
        counts={{
          candidatures: candidatures.filter((c) => c.statut === "En attente").length,
          plaintes: plaintes.filter((p) => p.statut === "En attente").length,
        }}
      />
      <div style={{ flex: 1, padding: dashSection.startsWith("postuler") ? 0 : "32px 40px" }}>
        {saveError && <div style={{ color: "#9C2B2B", fontSize: 12, margin: "14px 0 0 40px" }}>{saveError}</div>}
        {dashSection === "dossier" && (
          <div>
            <h2 style={h2Style}>Mon dossier</h2>
            <CarteService p={current} />
          </div>
        )}
        {dashSection === "annuaire" && <Annuaire personnel={personnel} />}
        {dashSection === "casier" && <CasierPage current={current} casier={casier} onAdd={(data) => handleAddCasier(data, current)} onUpdateMention={handleUpdateCasierMention} onDeleteMention={handleDeleteCasierMention} />}
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
          <AdminPanel personnel={personnel} onCreate={handleCreatePersonnel} onDelete={handleDeletePersonnel} onUpdate={handleUpdatePersonnel} />
        )}
        {dashSection === "admin-candidatures" && (current.isAdmin || (current.qualifications || []).includes("Recruteur")) && (
          <AdminCandidatures candidatures={candidatures} onUpdateStatut={handleUpdateCandidatureStatut} />
        )}
        {dashSection === "admin-plaintes" && (current.isAdmin || (current.qualifications || []).includes("Habilitation OPJ")) && (
          <AdminPlaintes plaintes={plaintes} current={current} onUpdateStatut={handleUpdatePlainteStatut} onTakeCharge={handleTakeChargePlainte} />
        )}
      </div>
    </div>
  );
}
