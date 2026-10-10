// pages/avis.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
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

/* ---------- Mes avis (gendarme connecté, lecture seule) ---------- */

export function MesAvisPage({ current, avisGendarmes, personnel }) {
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

export function AvisSuggestionsPage({ current, avisGeneraux, suggestions }) {
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
