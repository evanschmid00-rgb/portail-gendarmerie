// pages/avis.jsx — formulaires publics (avis, suggestions) et pages internes : « Avis du personnel » et « Avis & Suggestions »
import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Field, buttonPrimary, h2Style, labelStyle, smallBtn } from "../composants/ui.jsx";
import { estCommandement } from "../lib/constantes.js";

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

export function AvisGendarmeForm({ onSubmit, onCancel }) {
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

export function AvisGeneralForm({ onSubmit, onCancel }) {
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

export function SuggestionForm({ onSubmit, onCancel }) {
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

/* ---------- Éléments communs des pages internes ---------- */

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const BLEU = "#123A7A";
const couleurNote = (n) => (n >= 4 ? "#2E7D4F" : n >= 3 ? "#2F6FDE" : n >= 2 ? "#B25E00" : "#C0172D");
const dateCourte = (iso) => { try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } };
const moyenneDe = (l) => (l.length ? l.reduce((s, a) => s + (Number(a.note) || 0), 0) / l.length : 0);
const repartition = (l) => [5, 4, 3, 2, 1].map((n) => ({ n, nb: l.filter((a) => Number(a.note) === n).length }));
const norm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function Etoiles({ valeur, taille = 16 }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ fontSize: taille, lineHeight: 1, color: n <= Math.round(valeur) ? "#E0A23A" : "#D3DDEA" }}>★</span>)}
    </span>
  );
}

function Tuile({ label, valeur, couleur, sous }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${couleur}`, borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: couleur, lineHeight: 1.1 }}>{valeur}</div>
      <div style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>{label}</div>
      {sous && <div style={{ fontSize: 11, color: "#8A97AB", marginTop: 2 }}>{sous}</div>}
    </div>
  );
}

function BilanNotes({ liste, filtre, onFiltre }) {
  const moy = moyenneDe(liste);
  const rep = repartition(liste);
  const max = Math.max(1, ...rep.map((r) => r.nb));
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center", boxShadow: "0 6px 20px -14px rgba(7,20,46,0.35)" }}>
      <div style={{ textAlign: "center", minWidth: 120 }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: liste.length ? couleurNote(moy) : "#8A97AB", lineHeight: 1 }}>{liste.length ? moy.toFixed(1) : "—"}</div>
        <div style={{ margin: "6px 0 2px" }}><Etoiles valeur={moy} taille={20} /></div>
        <div style={{ fontSize: 12, color: "#5A6B84" }}>{liste.length} avis</div>
      </div>
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        {rep.map(({ n, nb }) => (
          <button key={n} type="button" onClick={() => onFiltre && onFiltre(filtre === n ? 0 : n)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: filtre === n ? "#EEF4FF" : "none", border: "none", padding: "3px 4px", borderRadius: 6, cursor: onFiltre ? "pointer" : "default", fontFamily: FONT }}>
            <span style={{ fontSize: 12, fontWeight: 700, width: 22, color: "#14213A" }}>{n} ★</span>
            <span style={{ flex: 1, height: 8, background: "#E6EDF7", borderRadius: 4, overflow: "hidden" }}><span style={{ display: "block", width: `${(nb / max) * 100}%`, height: "100%", background: couleurNote(n) }} /></span>
            <span style={{ fontSize: 12, color: "#5A6B84", width: 28, textAlign: "right" }}>{nb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CarteAvis({ a }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${couleurNote(a.note)}`, borderRadius: 12, padding: "12px 16px", boxShadow: "0 4px 16px -12px rgba(7,20,46,0.3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Etoiles valeur={a.note} taille={17} /><b style={{ fontSize: 13, color: couleurNote(a.note) }}>{a.note}/5</b></span>
        <span style={{ fontSize: 11.5, color: "#8A97AB" }}>{dateCourte(a.createdAt)}</span>
      </div>
      {a.commentaire ? <div style={{ fontSize: 13.5, color: "#26364F", lineHeight: 1.55, marginTop: 7, whiteSpace: "pre-wrap" }}>{a.commentaire}</div> : <div style={{ fontSize: 12, color: "#9AA8BD", marginTop: 6 }}>Pas de commentaire</div>}
    </div>
  );
}

function BarreOutils({ recherche, onRecherche, tri, onTri, options, placeholder }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "14px 0" }}>
      <input value={recherche} onChange={(e) => onRecherche(e.target.value)} placeholder={placeholder} style={{ flex: "1 1 240px", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 24, padding: "9px 16px", fontSize: 13.5, fontFamily: FONT, background: "#fff" }} />
      <select value={tri} onChange={(e) => onTri(e.target.value)} style={{ border: "1px solid #C3D0E2", borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "#fff", fontFamily: FONT }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Hero({ titre, sous }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #0F2A5C 0%, #123A7A 55%, #2F6FDE 100%)", color: "#fff", borderRadius: 16, padding: "18px 22px", marginBottom: 16, boxShadow: "0 14px 34px -18px rgba(7,20,46,0.6)", fontFamily: FONT }}>
      <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 24, fontWeight: 700 }}>{titre}</div>
      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.55, marginTop: 3 }}>{sous}</div>
    </div>
  );
}

const TRIS_AVIS = [["recents", "Plus récents"], ["anciens", "Plus anciens"], ["hauts", "Meilleures notes"], ["bas", "Notes les plus basses"]];
function trierAvis(liste, tri) {
  const t = liste.slice();
  const d = (a) => String(a.createdAt || "");
  if (tri === "anciens") return t.sort((a, b) => d(a).localeCompare(d(b)));
  if (tri === "hauts") return t.sort((a, b) => b.note - a.note || d(b).localeCompare(d(a)));
  if (tri === "bas") return t.sort((a, b) => a.note - b.note || d(b).localeCompare(d(a)));
  return t.sort((a, b) => d(b).localeCompare(d(a)));
}

/* ---------- Mes avis (gendarme connecté, lecture seule) ---------- */

export function MesAvisPage({ current, avisGendarmes, personnel }) {
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("moyenne");
  const [ouvert, setOuvert] = useState({});
  const [filtre, setFiltre] = useState(0);
  const mine = avisGendarmes.filter((a) => {
    const id = (a.cibleIdentifiant || "").trim().toLowerCase();
    return id && (id === (current.pseudoRoblox || "").trim().toLowerCase() || id === (current.pseudoDiscord || "").trim().toLowerCase());
  });
  const mesAffiches = trierAvis(mine.filter((a) => !filtre || Number(a.note) === filtre), "recents");

  function agentPour(identifiant) {
    const id = identifiant.trim().toLowerCase();
    return personnel.find((per) => (per.pseudoRoblox || "").trim().toLowerCase() === id || (per.pseudoDiscord || "").trim().toLowerCase() === id);
  }
  const parPersonne = {};
  avisGendarmes.forEach((a) => {
    const key = (a.cibleIdentifiant || "?").trim().toLowerCase();
    if (!parPersonne[key]) { const p = agentPour(a.cibleIdentifiant || "?"); parPersonne[key] = { cle: key, nom: p ? `${p.prenom} ${p.nom}` : a.cibleIdentifiant || "?", grade: p ? p.grade : "", unite: p ? p.unite : "", avis: [] }; }
    parPersonne[key].avis.push(a);
  });
  let groupes = Object.values(parPersonne).map((g) => ({ ...g, moy: moyenneDe(g.avis) }));
  groupes = groupes.filter((g) => !recherche.trim() || norm(`${g.nom} ${g.grade} ${g.unite}`).includes(norm(recherche)));
  groupes.sort((a, b) => (tri === "nom" ? a.nom.localeCompare(b.nom) : tri === "nombre" ? b.avis.length - a.avis.length : tri === "bas" ? a.moy - b.moy : b.moy - a.moy));
  const ceMois = avisGendarmes.filter((a) => a.createdAt && Date.now() - new Date(a.createdAt).getTime() < 30 * 86400000).length;

  return (
    <div style={{ fontFamily: FONT, maxWidth: 980 }}>
      <h2 style={h2Style}>Avis du personnel</h2>
      <Hero titre="⭐ Ce que les civils pensent de nous" sous="Les avis laissés par les civils sur les gendarmes. Les auteurs restent anonymes. Ils sont là pour progresser et valoriser le travail de chacun." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
        <Tuile label="Avis reçus par moi" valeur={mine.length} couleur="#2F6FDE" />
        <Tuile label="Ma note moyenne" valeur={mine.length ? `${moyenneDe(mine).toFixed(1)}/5` : "—"} couleur={mine.length ? couleurNote(moyenneDe(mine)) : "#8A97AB"} />
        <Tuile label="Avis sur tout le personnel" valeur={avisGendarmes.length} couleur="#16305C" />
        <Tuile label="Avis ces 30 derniers jours" valeur={ceMois} couleur="#2E7D4F" />
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, margin: "6px 0 8px" }}>Mes avis</div>
      {!current.pseudoRoblox && !current.pseudoDiscord && (
        <div style={{ background: "#FDECEE", border: "1px solid #F3B9C0", color: "#8A1020", borderRadius: 10, padding: "9px 13px", fontSize: 12.5, marginBottom: 12 }}>Aucun pseudo Roblox/Discord enregistré sur ton compte : demande à un admin de le renseigner pour que les avis te soient attribués.</div>
      )}
      {mine.length > 0 && <BilanNotes liste={mine} filtre={filtre} onFiltre={setFiltre} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {mesAffiches.map((a) => <CarteAvis key={a.id} a={a} />)}
        {mine.length === 0 && <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, color: "#5A6B84", fontSize: 13 }}>Aucun avis reçu pour l'instant.</div>}
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, margin: "30px 0 0" }}>Avis sur tout le personnel ({avisGendarmes.length})</div>
      <BarreOutils recherche={recherche} onRecherche={setRecherche} tri={tri} onTri={setTri} placeholder="🔎 Rechercher un gendarme…" options={[["moyenne", "Meilleure moyenne"], ["bas", "Moyenne la plus basse"], ["nombre", "Plus d'avis"], ["nom", "Nom (A → Z)"]]} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {groupes.map((g) => {
          const est = !!ouvert[g.cle];
          const avecCom = g.avis.filter((a) => a.commentaire);
          return (
            <div key={g.cle} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, boxShadow: "0 4px 16px -12px rgba(7,20,46,0.3)", overflow: "hidden" }}>
              <button type="button" onClick={() => setOuvert({ ...ouvert, [g.cle]: !est })} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: FONT }}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#E6EDF7", color: BLEU, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{g.nom.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</span>
                <span style={{ flex: "1 1 180px", minWidth: 0 }}>
                  <b style={{ fontSize: 14, color: "#14213A" }}>{g.nom}</b>
                  <span style={{ display: "block", fontSize: 12, color: "#5A6B84" }}>{[g.grade, g.unite].filter(Boolean).join(" · ") || "Gendarme"}</span>
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Etoiles valeur={g.moy} /><b style={{ fontSize: 14, color: couleurNote(g.moy) }}>{g.moy.toFixed(1)}</b><span style={{ fontSize: 12, color: "#5A6B84" }}>({g.avis.length} avis)</span></span>
                <span style={{ fontSize: 13, color: "#5A6B84", transform: est ? "rotate(180deg)" : "none" }}>▼</span>
              </button>
              {est && (
                <div style={{ padding: "4px 16px 14px", borderTop: "1px solid #E3EAF4", display: "flex", flexDirection: "column", gap: 8 }}>
                  {trierAvis(g.avis, "recents").map((a) => <CarteAvis key={a.id} a={a} />)}
                  {avecCom.length === 0 && <div style={{ fontSize: 12, color: "#9AA8BD" }}>Aucun commentaire écrit, uniquement des notes.</div>}
                </div>
              )}
            </div>
          );
        })}
        {avisGendarmes.length === 0 && <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, color: "#5A6B84", fontSize: 13 }}>Aucun avis enregistré pour l'instant.</div>}
        {avisGendarmes.length > 0 && groupes.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun gendarme ne correspond à cette recherche.</div>}
      </div>
    </div>
  );
}

/* ---------- Avis généraux (tous les gendarmes) + suggestions (DGGN uniquement) ---------- */

function lireLus() { try { return JSON.parse(window.localStorage.getItem("gn_suggestions_lues") || "{}"); } catch (e) { return {}; } }

export function AvisSuggestionsPage({ current, avisGeneraux, suggestions }) {
  const canSeeSuggestions = current.isAdmin || estCommandement(current.unite);
  const [onglet, setOnglet] = useState("avis");
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("recents");
  const [filtre, setFiltre] = useState(0);
  const [lus, setLus] = useState(lireLus);
  const [vue, setVue] = useState("toutes"); // suggestions : toutes | nouvelles

  function basculerLu(id) {
    const n = { ...lus, [id]: !lus[id] };
    setLus(n);
    try { window.localStorage.setItem("gn_suggestions_lues", JSON.stringify(n)); } catch (e) { /* tant pis */ }
  }
  const ceMois = (l) => l.filter((a) => a.createdAt && Date.now() - new Date(a.createdAt).getTime() < 30 * 86400000).length;
  const avisAffiches = trierAvis(avisGeneraux.filter((a) => (!filtre || Number(a.note) === filtre) && (!recherche.trim() || norm(a.commentaire).includes(norm(recherche)))), tri);
  const nouvelles = suggestions.filter((s) => !lus[s.id]).length;
  const suggAffichees = suggestions
    .filter((s) => (vue === "toutes" || !lus[s.id]) && (!recherche.trim() || norm(s.texte).includes(norm(recherche))))
    .sort((a, b) => (tri === "anciens" ? String(a.createdAt || "").localeCompare(String(b.createdAt || "")) : String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
  const chip = (actif, label, onClick) => <button type="button" onClick={onClick} style={{ border: "1px solid #C3D0E2", background: actif ? BLEU : "#fff", color: actif ? "#fff" : "#14213A", borderRadius: 16, padding: "6px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>{label}</button>;

  return (
    <div style={{ fontFamily: FONT, maxWidth: 980 }}>
      <h2 style={h2Style}>Avis & Suggestions</h2>
      <Hero titre="💬 La parole des civils" sous="Les avis sur la gendarmerie et les idées déposées par les civils. Les auteurs restent anonymes pour le personnel." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
        <Tuile label="Note moyenne" valeur={avisGeneraux.length ? `${moyenneDe(avisGeneraux).toFixed(1)}/5` : "—"} couleur={avisGeneraux.length ? couleurNote(moyenneDe(avisGeneraux)) : "#8A97AB"} />
        <Tuile label="Avis sur la gendarmerie" valeur={avisGeneraux.length} couleur="#2F6FDE" sous={`${ceMois(avisGeneraux)} ces 30 derniers jours`} />
        {canSeeSuggestions && <Tuile label="Suggestions" valeur={suggestions.length} couleur="#7B3FA0" sous={`${nouvelles} non lue${nouvelles > 1 ? "s" : ""}`} />}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        {chip(onglet === "avis", `⭐ Avis (${avisGeneraux.length})`, () => { setOnglet("avis"); setRecherche(""); })}
        {chip(onglet === "suggestions", `💡 Suggestions${canSeeSuggestions ? ` (${suggestions.length})` : ""}`, () => { setOnglet("suggestions"); setRecherche(""); })}
      </div>

      {onglet === "avis" && (
        <>
          <div style={{ marginTop: 14 }}><BilanNotes liste={avisGeneraux} filtre={filtre} onFiltre={setFiltre} /></div>
          <BarreOutils recherche={recherche} onRecherche={setRecherche} tri={tri} onTri={setTri} options={TRIS_AVIS} placeholder="🔎 Rechercher dans les commentaires…" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {avisAffiches.map((a) => <CarteAvis key={a.id} a={a} />)}
            {avisGeneraux.length === 0 && <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, color: "#5A6B84", fontSize: 13 }}>Aucun avis pour l'instant.</div>}
            {avisGeneraux.length > 0 && avisAffiches.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun avis ne correspond à ces filtres.</div>}
          </div>
        </>
      )}

      {onglet === "suggestions" && (canSeeSuggestions ? (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0 0", alignItems: "center" }}>
            {chip(vue === "toutes", `Toutes (${suggestions.length})`, () => setVue("toutes"))}
            {chip(vue === "nouvelles", `Non lues (${nouvelles})`, () => setVue("nouvelles"))}
            <span style={{ fontSize: 11.5, color: "#8A97AB" }}>Le marquage « lu » est personnel : il reste sur cet appareil.</span>
          </div>
          <BarreOutils recherche={recherche} onRecherche={setRecherche} tri={tri} onTri={setTri} options={[["recents", "Plus récentes"], ["anciens", "Plus anciennes"]]} placeholder="🔎 Rechercher dans les suggestions…" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {suggAffichees.map((s) => {
              const lu = !!lus[s.id];
              return (
                <div key={s.id} style={{ background: lu ? "#FAFBFD" : "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${lu ? "#C3D0E2" : "#7B3FA0"}`, borderRadius: 12, padding: "12px 16px", boxShadow: "0 4px 16px -12px rgba(7,20,46,0.3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, color: "#8A97AB" }}>{dateCourte(s.createdAt)}{!lu && <span style={{ marginLeft: 8, background: "#7B3FA0", color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>Nouvelle</span>}</span>
                    <button type="button" onClick={() => basculerLu(s.id)} style={{ ...smallBtn, padding: "3px 12px" }}>{lu ? "Marquer non lue" : "✓ Marquer comme lue"}</button>
                  </div>
                  <div style={{ fontSize: 14, color: "#14213A", lineHeight: 1.6, marginTop: 7, whiteSpace: "pre-wrap" }}>{s.texte}</div>
                </div>
              );
            })}
            {suggestions.length === 0 && <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, color: "#5A6B84", fontSize: 13 }}>Aucune suggestion pour l'instant.</div>}
            {suggestions.length > 0 && suggAffichees.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune suggestion à afficher ici.</div>}
          </div>
        </>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, marginTop: 14, fontSize: 13, color: "#5A6B84" }}>🔒 Les suggestions sont réservées au Corps de Commandement.</div>
      ))}
    </div>
  );
}
