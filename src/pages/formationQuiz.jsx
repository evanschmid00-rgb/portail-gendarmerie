// pages/formationQuiz.jsx — Quiz de formation corrigés automatiquement (un quiz par livre + un examen final).
// Questions : collection « formation_quiz » (un document par livre, « final » pour l'examen).
// Résultats : collection « formation_quiz_resultats » (un document par agent).
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import { Field, smallBtn } from "../composants/ui.jsx";
import { db } from "../firebase";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const BLEU = "#123A7A";
export const SEUIL_DEFAUT = 70;
export const ID_FINAL = "final";

export const quizPret = (q) => !!q && Array.isArray(q.questions) && q.questions.length > 0;

export async function chargerQuiz() {
  const s = await getDocs(collection(db, "formation_quiz"));
  const m = {};
  s.docs.forEach((d) => { m[d.id] = { ...d.data(), id: d.id }; });
  return m;
}
export async function chargerMesResultats(uid) {
  try {
    const s = await getDoc(doc(db, "formation_quiz_resultats", uid));
    return s.exists() ? (s.data().resultats || {}) : {};
  } catch (e) { console.error(e); return {}; }
}
export async function chargerTousResultats() {
  const s = await getDocs(collection(db, "formation_quiz_resultats"));
  const m = {};
  s.docs.forEach((d) => { m[d.id] = d.data().resultats || {}; });
  return m;
}

// Résumé pour le suivi d'un agent : livres réussis / livres avec quiz, examen final
export function resumeQuiz(quizzes, resultats = {}) {
  const ids = Object.keys(quizzes).filter((id) => id !== ID_FINAL && quizPret(quizzes[id]));
  const reussis = ids.filter((id) => resultats[id] && resultats[id].reussi).length;
  const fin = quizzes[ID_FINAL] && quizPret(quizzes[ID_FINAL]) ? (resultats[ID_FINAL] || { essais: 0 }) : null;
  return { total: ids.length, reussis, final: fin };
}

/* ---------- Passage d'un quiz (côté recrue) ---------- */

export function QuizRunner({ quiz, titre, uid, resultatsActuels, onTermine, onClose }) {
  const [rep, setRep] = useState({});
  const [fin, setFin] = useState(null); // { score, reussi, faux:[index] }
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const qs = quiz.questions;
  const seuil = Number(quiz.seuil) > 0 ? Number(quiz.seuil) : SEUIL_DEFAUT;
  const repondu = Object.keys(rep).length;

  async function valider() {
    if (repondu < qs.length) { setErreur("Réponds à toutes les questions avant de valider."); return; }
    setErreur(""); setBusy(true);
    const faux = qs.map((q, i) => (rep[i] === q.bonne ? -1 : i)).filter((i) => i >= 0);
    const score = Math.round(((qs.length - faux.length) / qs.length) * 100);
    const reussi = score >= seuil;
    const avant = (resultatsActuels && resultatsActuels[quiz.id]) || {};
    const res = { meilleur: Math.max(avant.meilleur || 0, score), reussi: !!avant.reussi || reussi, essais: (avant.essais || 0) + 1, dernier: score, le: new Date().toISOString() };
    try {
      await setDoc(doc(db, "formation_quiz_resultats", uid), { resultats: { [quiz.id]: res }, updatedAt: new Date().toISOString() }, { merge: true });
      onTermine({ ...(resultatsActuels || {}), [quiz.id]: res });
      setFin({ score, reussi, faux });
    } catch (e) { console.error(e); setErreur("Résultat non enregistré (droits ou connexion) : réessaie."); }
    setBusy(false);
  }
  function recommencer() { setRep({}); setFin(null); setErreur(""); window.scrollTo({ top: 0, behavior: "smooth" }); }

  const carte = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: "18px 20px", marginBottom: 14, boxShadow: "0 6px 20px -14px rgba(7,20,46,0.35)" };
  return (
    <div style={{ fontFamily: FONT, maxWidth: 760 }}>
      <button type="button" onClick={onClose} style={{ ...smallBtn, marginBottom: 14 }}>← Retour à la formation</button>
      <div style={{ background: "linear-gradient(135deg, #0F2A5C, #123A7A)", color: "#fff", borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.75, fontWeight: 700 }}>{quiz.id === ID_FINAL ? "EXAMEN FINAL" : "QUIZ"}</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{titre}</div>
        <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 4 }}>{qs.length} question{qs.length > 1 ? "s" : ""} · réussite à partir de <b>{seuil} %</b> · tu peux recommencer autant de fois que nécessaire.</div>
      </div>

      {fin && (
        <div style={{ ...carte, borderTop: `5px solid ${fin.reussi ? "#2E7D4F" : "#C0172D"}`, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>{fin.reussi ? "🎉" : "📖"}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: fin.reussi ? "#1F6B42" : "#8A1020" }}>{fin.score} %</div>
          <div style={{ fontSize: 14, color: "#26364F", marginTop: 4 }}>{fin.reussi ? "Bravo, quiz réussi !" : `Il faut ${seuil} % pour réussir. Relis les fiches, puis réessaie.`}</div>
          {!fin.reussi && fin.faux.length > 0 && <div style={{ fontSize: 12.5, color: "#5A6B84", marginTop: 8 }}>Questions à revoir : {fin.faux.map((i) => i + 1).join(", ")}</div>}
          <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {!fin.reussi && <button type="button" onClick={recommencer} style={{ ...smallBtn, background: BLEU, color: "#fff", borderColor: BLEU, padding: "9px 18px" }}>Réessayer</button>}
            <button type="button" onClick={onClose} style={{ ...smallBtn, padding: "9px 18px" }}>Retour à la formation</button>
          </div>
        </div>
      )}

      {qs.map((q, i) => {
        const bonne = fin && fin.reussi;
        return (
          <div key={i} style={{ ...carte, borderLeft: `5px solid ${fin ? (fin.faux.includes(i) ? "#C0172D" : "#2E7D4F") : "#C3D0E2"}` }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: "#14213A", marginBottom: 10 }}>{i + 1}. {q.q}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {q.options.map((o, k) => {
                const choisi = rep[i] === k;
                const estBonne = bonne && q.bonne === k;
                return (
                  <label key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: fin ? "default" : "pointer", border: `1px solid ${estBonne ? "#2E7D4F" : choisi ? BLEU : "#D3DDEA"}`, background: estBonne ? "#E3F2E8" : choisi ? "#EEF4FF" : "#fff", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, color: "#26364F" }}>
                    <input type="radio" name={`q${i}`} checked={choisi} disabled={!!fin} onChange={() => setRep({ ...rep, [i]: k })} style={{ marginTop: 3 }} />
                    <span>{o}{estBonne ? " ✓" : ""}</span>
                  </label>
                );
              })}
            </div>
            {bonne && q.explication && <div style={{ fontSize: 12.5, color: "#3A4D6B", marginTop: 8, background: "#F5F8FC", borderRadius: 8, padding: "7px 10px" }}>💡 {q.explication}</div>}
          </div>
        );
      })}

      {!fin && (
        <>
          {erreur && <div style={{ background: "#FDECEE", border: "1px solid #F3B9C0", color: "#8A1020", borderRadius: 10, padding: "9px 13px", fontSize: 13, marginBottom: 12 }}>{erreur}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button type="button" disabled={busy} onClick={valider} className="gh-btn-anim" style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "12px 26px", fontWeight: 800, fontSize: 14.5, cursor: "pointer", opacity: repondu < qs.length ? 0.6 : 1 }}>{busy ? "Correction…" : "Valider mes réponses"}</button>
            <span style={{ fontSize: 12.5, color: "#5A6B84" }}>{repondu}/{qs.length} répondue{repondu > 1 ? "s" : ""}</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Éditeur de quiz (côté gestion de la formation) ---------- */

const questionVide = () => ({ q: "", options: ["", "", "", ""], bonne: 0, explication: "" });

export function OngletQuiz({ livres, quizzes, recharger }) {
  const [sel, setSel] = useState(livres[0] ? livres[0].id : ID_FINAL);
  const [brouillon, setBrouillon] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const cibles = [...livres.map((l) => ({ id: l.id, titre: `${l.emoji || "📘"} ${l.titre}` })), { id: ID_FINAL, titre: "🎓 Examen final" }];
  const actuel = quizzes[sel];
  const edition = brouillon && brouillon.id === sel ? brouillon : { id: sel, seuil: actuel && actuel.seuil ? actuel.seuil : SEUIL_DEFAUT, questions: actuel && quizPret(actuel) ? actuel.questions.map((q) => ({ ...questionVide(), ...q, options: [...q.options, "", "", "", ""].slice(0, 4) })) : [] };
  const maj = (patch) => setBrouillon({ ...edition, ...patch });
  const majQ = (i, patch) => maj({ questions: edition.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  const majOpt = (i, k, v) => majQ(i, { options: edition.questions[i].options.map((o, j) => (j === k ? v : o)) });

  async function enregistrer() {
    setMsg("");
    const propres = [];
    for (let i = 0; i < edition.questions.length; i++) {
      const q = edition.questions[i];
      const opts = q.options.map((o, k) => ({ o: o.trim(), k })).filter((x) => x.o);
      if (!q.q.trim()) { setMsg(`Question ${i + 1} : écris l'énoncé.`); return; }
      if (opts.length < 2) { setMsg(`Question ${i + 1} : il faut au moins 2 réponses.`); return; }
      const idx = opts.findIndex((x) => x.k === q.bonne);
      if (idx < 0) { setMsg(`Question ${i + 1} : la bonne réponse cochée est vide.`); return; }
      propres.push({ q: q.q.trim(), options: opts.map((x) => x.o), bonne: idx, ...(q.explication.trim() ? { explication: q.explication.trim() } : {}) });
    }
    const seuil = Math.min(100, Math.max(1, Number(edition.seuil) || SEUIL_DEFAUT));
    setBusy(true);
    try {
      await setDoc(doc(db, "formation_quiz", sel), { livreId: sel, seuil, questions: propres, updatedAt: new Date().toISOString() });
      setBrouillon(null); setMsg(propres.length ? "✓ Quiz enregistré." : "✓ Quiz vide : il n'est pas proposé aux recrues.");
      await recharger();
    } catch (e) { console.error(e); setMsg("Enregistrement impossible (droits Firestore de « formation_quiz »)."); }
    setBusy(false);
  }

  const carte = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px", marginBottom: 12 };
  return (
    <div>
      <div style={{ ...carte, fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.6 }}>
        <b>Comment ça marche :</b> chaque livre peut avoir un quiz (questions à choix multiples corrigées automatiquement). La recrue doit avoir lu toutes les fiches du livre pour le passer. Quand tous les quiz des livres sont réussis, l'<b>examen final</b> se débloque. Un quiz sans question n'est pas proposé.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {cibles.map((c) => (
          <button key={c.id} type="button" onClick={() => { setSel(c.id); setBrouillon(null); setMsg(""); }} style={{ background: sel === c.id ? "#14213A" : "#fff", color: sel === c.id ? "#fff" : "#14213A", border: "1px solid #C3D0E2", borderRadius: 999, padding: "6px 13px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
            {c.titre}{quizPret(quizzes[c.id]) ? ` · ${quizzes[c.id].questions.length}` : ""}
          </button>
        ))}
      </div>

      <div style={{ ...carte, maxWidth: 260 }}>
        <Field label="Note minimale pour réussir (%)" type="number" value={String(edition.seuil)} onChange={(v) => maj({ seuil: v })} />
      </div>

      {edition.questions.map((q, i) => (
        <div key={i} style={{ ...carte, borderLeft: `5px solid ${BLEU}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <b style={{ fontSize: 13.5 }}>Question {i + 1}</b>
            <button type="button" onClick={() => maj({ questions: edition.questions.filter((_, k) => k !== i) })} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Supprimer</button>
          </div>
          <Field label="Énoncé" textarea value={q.q} onChange={(v) => majQ(i, { q: v })} />
          <div style={{ fontSize: 12, color: "#5A6B84", margin: "0 0 6px" }}>Réponses (coche la bonne ; laisse vide les réponses inutiles) :</div>
          {q.options.map((o, k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input type="radio" name={`bonne-${sel}-${i}`} checked={q.bonne === k} onChange={() => majQ(i, { bonne: k })} title="Bonne réponse" />
              <input value={o} onChange={(e) => majOpt(i, k, e.target.value)} placeholder={`Réponse ${k + 1}`} style={{ flex: 1, border: "1px solid #C3D0E2", borderRadius: 8, padding: "8px 10px", fontSize: 13.5, fontFamily: FONT, background: q.bonne === k ? "#E3F2E8" : "#fff" }} />
            </div>
          ))}
          <Field label="Explication (affichée quand le quiz est réussi, facultatif)" value={q.explication} onChange={(v) => majQ(i, { explication: v })} />
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => maj({ questions: [...edition.questions, questionVide()] })} style={{ ...smallBtn, padding: "9px 16px" }}>+ Ajouter une question</button>
        <button type="button" disabled={busy} onClick={enregistrer} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>{busy ? "Enregistrement…" : "Enregistrer ce quiz"}</button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith("✓") ? "#1F6B42" : "#8A1020" }}>{msg}</span>}
      </div>
    </div>
  );
}
