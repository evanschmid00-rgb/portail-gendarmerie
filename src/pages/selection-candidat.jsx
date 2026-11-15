// pages/selection-candidat.jsx — Côté candidat : suivi des étapes de la sélection et passage des épreuves en ligne.
// Le candidat s'identifie par son numéro de dossier. Les réponses sont corrigées par le serveur (/api/epreuves).
import React, { useEffect, useRef, useState } from "react";
import { ETAPES_SELECTION, etapeOk, etapeKo } from "../lib/selection.js";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";

async function appelEpreuves(corps) {
  const r = await fetch("/api/epreuves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
  let j = {};
  try { j = await r.json(); } catch (e) { /* réponse vide */ }
  return j && typeof j === "object" ? j : {};
}
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

// État affiché au candidat : tant que la décision n'est pas publiée, les résultats détaillés restent neutres
function etatAffiche(statut, publie) {
  if (statut === "ouvert") return { t: "À passer", c: "#E0A02B", i: "🟡" };
  if (statut === "en-cours") return { t: "En cours", c: "#E0A02B", i: "🟡" };
  if (!statut || statut === "a-faire") return { t: "À venir", c: "#8FA6C8", i: "⚪" };
  if (!publie) return { t: "Terminée", c: "#2F7BFF", i: "🔵" };
  if (etapeOk(statut)) return { t: "Validée", c: "#1F9D55", i: "🟢" };
  if (etapeKo(statut)) return { t: "Non validée", c: "#D62B45", i: "🔴" };
  return { t: "Terminée", c: "#2F7BFF", i: "🔵" };
}

export function EtapesSelectionCandidat({ numero, dossier, onRecharger }) {
  const sel = dossier && dossier.selection;
  const [epreuve, setEpreuve] = useState(null); // étape en cours de passage
  if (!sel || !sel.etapes) return null;
  const publie = dossier.statut === "Acceptée" || dossier.statut === "Refusée";
  const etapes = sel.etapes;
  const aPasser = ["ecrit", "psycho"].filter((k) => etapes[k] === "ouvert" || etapes[k] === "en-cours");
  return (
    <div className="gn-appear" style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 22, padding: "18px 20px", marginTop: 16, textAlign: "left", fontFamily: FONT, boxShadow: "0 24px 46px -28px rgba(7,20,46,0.6)" }}>
      <div style={{ fontSize: 10.5, letterSpacing: 2.5, fontWeight: 800, color: "#5A6B84" }}>PARCOURS DE SÉLECTION</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#14213A", margin: "2px 0 12px" }}>Où en es-tu ?</div>
      {aPasser.length > 0 && (
        <div style={{ background: "#FFF4E0", border: "1px solid #E8D28A", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: "#6B4E00", marginBottom: 6 }}>📣 Tu es convoqué(e) : {aPasser.length > 1 ? "des épreuves t'attendent" : "une épreuve t'attend"}.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {aPasser.map((k) => { const e = ETAPES_SELECTION.find((x) => x.id === k); return <button key={k} type="button" onClick={() => setEpreuve(k)} style={{ background: "linear-gradient(180deg,#2F7BFF,#123A7A)", color: "#fff", border: 0, borderRadius: 12, padding: "10px 16px", fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>{e.icone} {etapes[k] === "en-cours" ? "Reprendre" : "Passer"} : {e.label.toLowerCase()}</button>; })}
          </div>
          <div style={{ fontSize: 12, color: "#6B4E00", marginTop: 8 }}>Une fois commencée, l'épreuve est chronométrée et ne peut être passée qu'une fois. Prépare-toi au calme, sans aide.</div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ETAPES_SELECTION.map((e, i) => {
          const a = etatAffiche(etapes[e.id], publie);
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F6F9FD", border: "1px solid #E1E8F2", borderLeft: `5px solid ${a.c}`, borderRadius: 12, padding: "10px 12px" }}>
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: a.c + "22", border: `2px solid ${a.c}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{e.icone}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#14213A", fontSize: 14 }}>{i + 1}. {e.label}</div>
                <div style={{ fontSize: 12, color: "#5A6B84" }}>{e.id === "entretien" ? "Passé avec le jury, sur convocation." : e.id === "medical" ? "Aptitude validée par un responsable." : e.id === "moralite" ? "Casier, comportement et fréquentations." : "En ligne, chronométrée, corrigée automatiquement."}</div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: a.c, whiteSpace: "nowrap" }}>{a.i} {a.t}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 13, color: "#3A4D6B", lineHeight: 1.6, background: "#F6F9FD", border: "1px solid #E1E8F2", borderRadius: 12, padding: "10px 14px" }}>
        {!publie && (sel.decision === "en-cours" || !sel.decision ? "Ta sélection est en cours. Le détail des résultats et la décision te seront communiqués avec la réponse du recrutement." : "Ta sélection est terminée : la décision te sera communiquée avec la réponse du recrutement.")}
        {publie && sel.decision === "admis" && "🎉 Tu es admis(e) : bravo ! Ton dossier passe à la formation selon ta filière (" + (sel.filiere === "reserve" ? "réserve" : "terrain") + ")."}
        {publie && sel.decision === "liste-attente" && "⏳ Tu es sur liste d'attente : tu seras appelé(e) dès qu'une place se libère."}
        {publie && (sel.decision === "refuse") && "Ta sélection n'a pas abouti cette fois. Tu pourras retenter ta chance avec une nouvelle candidature."}
        {publie && sel.decision === "en-cours" && "La réponse du recrutement est publiée ci-dessus."}
      </div>
      {epreuve && <FenetreEpreuve numero={numero} etape={epreuve} onFermer={() => { setEpreuve(null); onRecharger && onRecharger(); }} />}
    </div>
  );
}

function FenetreEpreuve({ numero, etape, onFermer }) {
  const [etat, setEtat] = useState({ phase: "chargement", erreur: "", sujet: null, termine: null });
  const [reponses, setReponses] = useState([]);
  const [reste, setReste] = useState(0);
  const envoye = useRef(false);
  const repRef = useRef([]);
  repRef.current = reponses;
  const infos = ETAPES_SELECTION.find((x) => x.id === etape);

  useEffect(() => {
    let v = true;
    appelEpreuves({ action: "sujet", numero, etape }).then((j) => {
      if (!v) return;
      if (!j.ok) { setEtat({ phase: "erreur", erreur: j.message || "Impossible de démarrer l'épreuve.", sujet: null, termine: null }); return; }
      if (j.termine) { setEtat({ phase: "fini", erreur: "", sujet: null, termine: { retard: true } }); return; }
      setReponses(j.questions.map(() => -1));
      setEtat({ phase: "epreuve", erreur: "", sujet: j, termine: null });
    }).catch(() => v && setEtat({ phase: "erreur", erreur: "Connexion impossible. Réessaie dans un instant.", sujet: null, termine: null }));
    return () => { v = false; };
  }, [numero, etape]);

  async function rendre(auto) {
    if (envoye.current) return; envoye.current = true;
    setEtat((e) => ({ ...e, phase: "envoi" }));
    try {
      const j = await appelEpreuves({ action: "rendre", numero, etape, reponses: repRef.current });
      setEtat({ phase: j.ok ? "fini" : "erreur", erreur: j.ok ? "" : (j.message || "Envoi impossible."), sujet: null, termine: j.ok ? { retard: !!j.retard, auto } : null });
      if (!j.ok) envoye.current = false;
    } catch (e) { envoye.current = false; setEtat((s) => ({ ...s, phase: "epreuve", erreur: "Connexion perdue : réessaie d'envoyer." })); }
  }

  useEffect(() => {
    if (etat.phase !== "epreuve" || !etat.sujet) return undefined;
    const fin = Date.parse(etat.sujet.fin);
    const tick = () => { const r = fin - Date.now(); setReste(r); if (r <= 0) rendre(true); };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [etat.phase]);

  const s = etat.sujet;
  const repondues = reponses.filter((x) => x >= 0).length;
  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(7,16,31,0.82)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "16px 12px", fontFamily: FONT }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 680, overflow: "hidden", boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6)" }}>
        <div style={{ background: "linear-gradient(135deg,#0D1A2E,#123A7A)", color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 2 }}>
          <span style={{ fontSize: 24 }}>{infos.icone}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>{(s && s.titre) || infos.label}</div>
            {etat.phase === "epreuve" && <div style={{ fontSize: 12, opacity: 0.85 }}>{repondues}/{s.questions.length} répondues</div>}
          </div>
          {etat.phase === "epreuve" && <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 800, fontSize: 20, background: reste < 60000 ? "#D62B45" : "rgba(255,255,255,0.15)", borderRadius: 10, padding: "4px 12px" }}>{mmss(reste)}</div>}
        </div>
        <div style={{ padding: "18px 18px 22px" }}>
          {etat.phase === "chargement" && <div style={{ color: "#5A6B84" }}>Préparation de l'épreuve…</div>}
          {etat.phase === "envoi" && <div style={{ color: "#5A6B84" }}>Correction en cours…</div>}
          {etat.phase === "erreur" && (
            <>
              <div style={{ background: "#FDECEE", border: "1px solid #E9A3AD", color: "#8A1020", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>{etat.erreur}</div>
              <button type="button" onClick={onFermer} style={{ background: "#123A7A", color: "#fff", border: 0, borderRadius: 12, padding: "10px 18px", fontWeight: 800, cursor: "pointer" }}>Fermer</button>
            </>
          )}
          {etat.phase === "epreuve" && s && (
            <>
              {s.consigne && <div style={{ background: "#F3F7FD", border: "1px solid #D3DDEA", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#3A4D6B", marginBottom: 14 }}>{s.consigne}</div>}
              {etat.erreur && <div style={{ color: "#C0172D", fontSize: 13, marginBottom: 10 }}>{etat.erreur}</div>}
              {s.questions.map((q, i) => (
                <div key={i} style={{ marginBottom: 18 }}>
                  <div style={{ fontWeight: 800, color: "#14213A", marginBottom: 8, lineHeight: 1.45 }}>{i + 1}. {q.q}</div>
                  {q.choix.map((ch, k) => {
                    const on = reponses[i] === k;
                    return (
                      <label key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", marginBottom: 6, border: `2px solid ${on ? "#2F7BFF" : "#E1E8F2"}`, background: on ? "#EAF2FF" : "#fff", borderRadius: 12, cursor: "pointer", fontSize: 14, color: "#14213A" }}>
                        <input type="radio" name={`q${i}`} checked={on} onChange={() => setReponses((r) => r.map((x, m) => (m === i ? k : x)))} style={{ marginTop: 3 }} />
                        <span style={{ overflowWrap: "anywhere" }}>{ch}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
              <button type="button" onClick={() => { if (repondues < s.questions.length && !window.confirm(`Il te reste ${s.questions.length - repondues} question(s) sans réponse. Rendre quand même ?`)) return; rendre(false); }} style={{ width: "100%", background: "linear-gradient(180deg,#2F7BFF,#123A7A)", color: "#fff", border: 0, borderRadius: 14, padding: "14px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Rendre ma copie</button>
            </>
          )}
          {etat.phase === "fini" && (
            <>
              <div style={{ background: "#EAF7EF", border: "1px solid #8FD0AA", borderRadius: 14, padding: "16px", marginBottom: 14, color: "#14532D", lineHeight: 1.6 }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>✅ Épreuve terminée</div>
                {etat.termine && etat.termine.retard ? "Le temps était écoulé : ta copie a été clôturée avec les réponses données." : "Tes réponses sont enregistrées et corrigées."} Le résultat te sera communiqué avec la décision du recrutement.
              </div>
              <button type="button" onClick={onFermer} style={{ background: "#123A7A", color: "#fff", border: 0, borderRadius: 12, padding: "10px 18px", fontWeight: 800, cursor: "pointer" }}>Retour à mon dossier</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
