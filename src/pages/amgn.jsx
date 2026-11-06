// pages/amgn.jsx — Académie Militaire de la Gendarmerie Nationale (AMGN) : cours, planning des formations,
// évaluation des recrues par le personnel de l'AMGN, et page « Mon évaluation » de la recrue.
import React, { useCallback, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { LogoAMGN } from "../composants/LogoAMGN.jsx";
import { buttonPrimary, h2Style, labelStyle, smallBtn } from "../composants/ui.jsx";
import { COULEUR_STATUT_AMGN, LIBELLE_NOTE, SEUIL_DEFAUT, estPersonnelAmgn, lireConfigAmgn, moyenneAmgn, nbNotes, notesDe } from "../lib/amgn.js";
import { lienValide } from "../lib/utils.js";

const CARTE = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 20, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 16 };
const INP = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, marginBottom: 12, fontFamily: "inherit" };
const SERIF = "Georgia, 'Times New Roman', serif";
const couleurNote = (n) => (n >= 4 ? "#2E7D4F" : n >= 3 ? "#2F6FDE" : n >= 2 ? "#B25E00" : "#C0172D");
const nomDe = (p) => `${p.grade ? p.grade + " " : ""}${p.prenom || ""} ${p.nom || ""}`.trim();
const jourFR = (iso) => { try { return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (e) { return iso || ""; } };
const aujourdhui = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const ERREUR_REGLES = "Lecture impossible : les règles Firestore de l'AMGN ne sont pas encore publiées (voir les instructions).";

function useListe(nom) {
  const [liste, setListe] = useState(null);
  const [erreur, setErreur] = useState("");
  const charger = useCallback(async () => {
    try { const s = await getDocs(collection(db, nom)); setListe(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setErreur(""); }
    catch (e) { console.error(e); setListe([]); setErreur(ERREUR_REGLES); }
  }, [nom]);
  useEffect(() => { charger(); }, [charger]);
  return [liste, charger, erreur];
}

function useConfigAmgn() {
  const [cfg, setCfg] = useState(lireConfigAmgn(null));
  const charger = useCallback(async () => {
    try { const sn = await getDoc(doc(db, "amgn_config", "general")); setCfg(lireConfigAmgn(sn.exists() ? sn.data() : null)); } catch (e) { setCfg(lireConfigAmgn(null)); }
  }, []);
  useEffect(() => { charger(); }, [charger]);
  return [cfg, charger];
}

const OR = "#C9A227";
export function EnteteAmgn({ titre, sous }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(120deg, #0B1D44 0%, #14305F 60%, #1B3F7D 100%)", borderRadius: 18, padding: "20px 24px", marginBottom: 22, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", border: `1px solid ${OR}`, boxShadow: "0 14px 30px -18px rgba(7,20,46,0.7)" }}>
      <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,162,39,0.25), transparent 70%)" }} />
      <LogoAMGN taille={88} style={{ position: "relative", filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.45))" }} />
      <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 10.5, letterSpacing: 2.4, color: "#E3C766", fontWeight: 700 }}>ACADÉMIE MILITAIRE DE LA GENDARMERIE NATIONALE</div>
        <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: "#fff", marginTop: 4, lineHeight: 1.15 }}>{titre}</div>
        {sous && <div style={{ fontSize: 13.5, color: "#C9D6EC", marginTop: 5 }}>{sous}</div>}
        <div style={{ height: 3, width: 90, marginTop: 10, background: "linear-gradient(90deg,#1F4E9F 33%,#fff 33% 66%,#C0172D 66%)", borderRadius: 2 }} />
      </div>
    </div>
  );
}

function Tuile({ label, valeur, couleur }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${couleur}`, borderRadius: 12, padding: "10px 16px", minWidth: 120, flex: "1 1 120px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: couleur, lineHeight: 1.1 }}>{valeur}</div>
      <div style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>{label}</div>
    </div>
  );
}

function BarreNote({ moy, seuil }) {
  const pct = moy ? Math.min(100, (moy / 5) * 100) : 0;
  return (
    <div style={{ position: "relative", height: 10, background: "#E6EDF7", borderRadius: 6, overflow: "visible" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: moy >= seuil ? "linear-gradient(90deg,#2E7D4F,#4CAF78)" : "linear-gradient(90deg,#B25E00,#E0A23A)" }} />
      <div title={`Moyenne minimale : ${seuil}/5`} style={{ position: "absolute", left: `${(seuil / 5) * 100}%`, top: -4, width: 2, height: 18, background: "#0B1D44" }} />
    </div>
  );
}

function Etoiles({ valeur, onChange, taille = 24 }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} role={onChange ? "button" : undefined} onClick={onChange ? () => onChange(valeur === n ? 0 : n) : undefined}
          style={{ fontSize: taille, lineHeight: 1, cursor: onChange ? "pointer" : "default", color: n <= Math.round(valeur || 0) ? "#E0A23A" : "#D3DDEA", userSelect: "none" }}>★</span>
      ))}
    </span>
  );
}

function Pastille({ statut }) {
  const [c, f] = COULEUR_STATUT_AMGN[statut] || ["#5A6B84", "#EEF2F8"];
  return <span style={{ display: "inline-block", background: f, color: c, border: `1px solid ${c}`, borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 800 }}>{statut}</span>;
}

/* ---------- Cours ---------- */

export function AmgnCoursPage({ current }) {
  const staff = estPersonnelAmgn(current);
  const [cours, recharger, erreur] = useListe("amgn_cours");
  const [edit, setEdit] = useState(null);
  const [ouvert, setOuvert] = useState(null);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [catF, setCatF] = useState("");
  const vide = { titre: "", categorie: "", contenu: "", lien: "", ordre: 10 };

  async function enregistrer(e) {
    e.preventDefault();
    if (!edit.titre.trim() || !edit.contenu.trim()) { setMsg("Le titre et le contenu sont obligatoires."); return; }
    const lien = edit.lien.trim() ? lienValide(edit.lien.trim()) : "";
    if (edit.lien.trim() && !lien) { setMsg("Le lien doit commencer par https://"); return; }
    const data = { titre: edit.titre.trim().slice(0, 150), categorie: (edit.categorie || "Général").trim().slice(0, 60), contenu: edit.contenu.trim().slice(0, 20000), lien, ordre: Number(edit.ordre) || 0, maj: new Date().toISOString(), par: nomDe(current) };
    try {
      if (edit.id) await updateDoc(doc(db, "amgn_cours", edit.id), data);
      else await addDoc(collection(db, "amgn_cours"), { ...data, creeLe: data.maj });
      setEdit(null); setMsg(""); recharger();
    } catch (err) { console.error(err); setMsg("Échec de l'enregistrement (règles Firestore de l'AMGN ?)."); }
  }
  async function supprimer(c) {
    if (!window.confirm(`Supprimer le cours « ${c.titre} » ?`)) return;
    try { await deleteDoc(doc(db, "amgn_cours", c.id)); recharger(); } catch (err) { setMsg("Suppression impossible."); }
  }

  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtres = (cours || []).filter((c) => (!catF || (c.categorie || "Général") === catF) && (!q.trim() || norm(`${c.titre} ${c.categorie} ${c.contenu}`).includes(norm(q))));
  const cats = Array.from(new Set(filtres.map((c) => c.categorie || "Général"))).sort((a, b) => a.localeCompare(b, "fr"));
  const toutesCats = Array.from(new Set((cours || []).map((c) => c.categorie || "Général"))).sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <div style={{ maxWidth: 900 }}>
      <EnteteAmgn titre="Cours de l'AMGN" sous="Tous les cours de l'Académie, classés par catégorie." />
      {erreur && <div style={{ ...CARTE, color: "#C0172D", fontSize: 13 }}>{erreur}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Rechercher un cours" style={{ ...INP, marginBottom: 0, flex: 1, minWidth: 200 }} />
        {staff && !edit && <button onClick={() => setEdit({ ...vide })} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>＋ Nouveau cours</button>}
      </div>
      {toutesCats.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {["", ...toutesCats].map((c) => <button key={c || "tous"} onClick={() => setCatF(c)} style={{ ...smallBtn, background: catF === c ? "#123A7A" : "transparent", color: catF === c ? "#fff" : "#14213A", borderColor: catF === c ? "#123A7A" : "#C3D0E2" }}>{c || "Toutes les catégories"}</button>)}
        </div>
      )}
      {msg && <div style={{ color: "#C0172D", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      {edit && (
        <form onSubmit={enregistrer} style={CARTE}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>{edit.id ? "Modifier le cours" : "Nouveau cours"}</div>
          <label style={labelStyle}>Titre</label>
          <input value={edit.titre} onChange={(e) => setEdit({ ...edit, titre: e.target.value })} style={INP} maxLength={150} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={labelStyle}>Catégorie</label>
              <input value={edit.categorie} onChange={(e) => setEdit({ ...edit, categorie: e.target.value })} placeholder="Ex. Code pénal, Procédure, Terrain…" list="amgn-cats" style={INP} maxLength={60} />
              <datalist id="amgn-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={labelStyle}>Ordre</label>
              <input type="number" value={edit.ordre} onChange={(e) => setEdit({ ...edit, ordre: e.target.value })} style={INP} />
            </div>
          </div>
          <label style={labelStyle}>Contenu du cours</label>
          <textarea value={edit.contenu} onChange={(e) => setEdit({ ...edit, contenu: e.target.value })} rows={12} style={{ ...INP, resize: "vertical", lineHeight: 1.5 }} />
          <label style={labelStyle}>Lien (facultatif : document, vidéo, Google Doc…)</label>
          <input value={edit.lien} onChange={(e) => setEdit({ ...edit, lien: e.target.value })} placeholder="https://…" style={INP} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 22px", marginTop: 0 }}>Enregistrer</button>
            <button type="button" onClick={() => { setEdit(null); setMsg(""); }} style={smallBtn}>Annuler</button>
          </div>
        </form>
      )}
      {cours === null && <div style={{ color: "#5A6B84" }}>Chargement…</div>}
      {cours && !filtres.length && !erreur && <div style={{ ...CARTE, color: "#5A6B84" }}>{staff ? "Aucun cours pour l'instant : clique sur « Nouveau cours »." : "Aucun cours n'a encore été publié."}</div>}
      {cats.map((cat) => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: "#5A6B84", fontWeight: 800, marginBottom: 8 }}>{cat}</div>
          {filtres.filter((c) => (c.categorie || "Général") === cat).sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || String(a.titre).localeCompare(String(b.titre), "fr")).map((c) => (
            <div key={c.id} style={{ ...CARTE, padding: 0, marginBottom: 10, overflow: "hidden" }}>
              <button onClick={() => setOuvert(ouvert === c.id ? null : c.id)} style={{ width: "100%", textAlign: "left", background: "transparent", border: 0, padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontFamily: "inherit" }}>
                <span style={{ fontFamily: SERIF, fontSize: 16.5, fontWeight: 700, color: "#0B1D44" }}>📘 {c.titre}</span>
                <span style={{ color: "#5A6B84", fontSize: 18 }}>{ouvert === c.id ? "▾" : "▸"}</span>
              </button>
              {ouvert === c.id && (
                <div style={{ padding: "0 18px 16px", borderTop: "1px solid #EEF2F8" }}>
                  <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.65, color: "#14213A", paddingTop: 12 }}>{c.contenu}</div>
                  {c.lien && <div style={{ marginTop: 12 }}><a href={c.lien} target="_blank" rel="noopener noreferrer" style={{ ...smallBtn, textDecoration: "none", display: "inline-block", background: "#123A7A", color: "#fff", borderColor: "#123A7A" }}>🔗 Ouvrir le document lié</a></div>}
                  <div style={{ fontSize: 11.5, color: "#8A97AB", marginTop: 12 }}>{c.par ? `Par ${c.par}` : ""}{c.maj ? ` · mis à jour le ${new Date(c.maj).toLocaleDateString("fr-FR")}` : ""}</div>
                  {staff && <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button style={smallBtn} onClick={() => { setEdit({ id: c.id, titre: c.titre || "", categorie: c.categorie || "", contenu: c.contenu || "", lien: c.lien || "", ordre: c.ordre || 0 }); window.scrollTo(0, 0); }}>✏️ Modifier</button>
                    <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => supprimer(c)}>🗑 Supprimer</button>
                  </div>}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------- Planning des formations ---------- */

export function AmgnPlanningPage({ current }) {
  const staff = estPersonnelAmgn(current);
  const [sessions, recharger, erreur] = useListe("amgn_planning");
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState("");
  const [passees, setPassees] = useState(false);
  const vide = { titre: "", date: aujourdhui(), debut: "20:00", fin: "21:00", lieu: "", formateur: "", description: "" };

  async function enregistrer(e) {
    e.preventDefault();
    if (!edit.titre.trim() || !edit.date) { setMsg("Le titre et la date sont obligatoires."); return; }
    const data = { titre: edit.titre.trim().slice(0, 150), date: edit.date, debut: edit.debut || "", fin: edit.fin || "", lieu: edit.lieu.trim().slice(0, 120), formateur: edit.formateur.trim().slice(0, 120), description: edit.description.trim().slice(0, 3000), maj: new Date().toISOString() };
    try {
      if (edit.id) await updateDoc(doc(db, "amgn_planning", edit.id), data);
      else await addDoc(collection(db, "amgn_planning"), { ...data, creeLe: data.maj, par: nomDe(current) });
      setEdit(null); setMsg(""); recharger();
    } catch (err) { console.error(err); setMsg("Échec de l'enregistrement (règles Firestore de l'AMGN ?)."); }
  }
  async function supprimer(s) {
    if (!window.confirm(`Supprimer la séance « ${s.titre} » ?`)) return;
    try { await deleteDoc(doc(db, "amgn_planning", s.id)); recharger(); } catch (err) { setMsg("Suppression impossible."); }
  }

  const tri = (a, b) => `${a.date} ${a.debut}`.localeCompare(`${b.date} ${b.debut}`);
  const auj = aujourdhui();
  const avenir = (sessions || []).filter((s) => s.date >= auj).sort(tri);
  const passe = (sessions || []).filter((s) => s.date < auj).sort((a, b) => tri(b, a));
  const jours = (iso) => Math.round((new Date(`${iso}T12:00:00`) - new Date(`${auj}T12:00:00`)) / 86400000);
  const carte = (s, grise, prochaine) => (
    <div key={s.id} style={{ ...CARTE, marginBottom: 10, ...(prochaine ? { border: `2px solid ${OR}` } : {}), display: "flex", gap: 16, alignItems: "flex-start", opacity: grise ? 0.7 : 1, flexWrap: "wrap" }}>
      <div style={{ minWidth: 150, background: grise ? "#EEF2F8" : "#123A7A", color: grise ? "#5A6B84" : "#fff", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "capitalize" }}>{jourFR(s.date)}</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{s.debut}{s.fin ? ` – ${s.fin}` : ""}</div>
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        {!grise && <div style={{ fontSize: 11.5, fontWeight: 800, color: prochaine ? "#8A6D1F" : "#5A6B84", letterSpacing: 0.8 }}>{prochaine ? "⭐ PROCHAINE SÉANCE · " : ""}{jours(s.date) === 0 ? "AUJOURD'HUI" : jours(s.date) === 1 ? "DEMAIN" : `DANS ${jours(s.date)} JOURS`}</div>}
        <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: "#0B1D44" }}>{s.titre}</div>
        <div style={{ fontSize: 13, color: "#5A6B84", marginTop: 3 }}>{s.lieu ? `📍 ${s.lieu}` : ""}{s.lieu && s.formateur ? "  ·  " : ""}{s.formateur ? `🎓 ${s.formateur}` : ""}</div>
        {s.description && <div style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 8, whiteSpace: "pre-wrap" }}>{s.description}</div>}
        {staff && <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={smallBtn} onClick={() => { setEdit({ id: s.id, titre: s.titre || "", date: s.date || auj, debut: s.debut || "", fin: s.fin || "", lieu: s.lieu || "", formateur: s.formateur || "", description: s.description || "" }); window.scrollTo(0, 0); }}>✏️ Modifier</button>
          <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => supprimer(s)}>🗑 Supprimer</button>
        </div>}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900 }}>
      <EnteteAmgn titre="Planning des formations" sous="Les prochaines séances de l'Académie." />
      {erreur && <div style={{ ...CARTE, color: "#C0172D", fontSize: 13 }}>{erreur}</div>}
      {staff && !edit && <div style={{ marginBottom: 16 }}><button onClick={() => setEdit({ ...vide })} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>＋ Nouvelle séance</button></div>}
      {msg && <div style={{ color: "#C0172D", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      {edit && (
        <form onSubmit={enregistrer} style={CARTE}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>{edit.id ? "Modifier la séance" : "Nouvelle séance"}</div>
          <label style={labelStyle}>Intitulé</label>
          <input value={edit.titre} onChange={(e) => setEdit({ ...edit, titre: e.target.value })} style={INP} maxLength={150} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}><label style={labelStyle}>Date</label><input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} style={INP} /></div>
            <div style={{ flex: 1, minWidth: 110 }}><label style={labelStyle}>Début</label><input type="time" value={edit.debut} onChange={(e) => setEdit({ ...edit, debut: e.target.value })} style={INP} /></div>
            <div style={{ flex: 1, minWidth: 110 }}><label style={labelStyle}>Fin</label><input type="time" value={edit.fin} onChange={(e) => setEdit({ ...edit, fin: e.target.value })} style={INP} /></div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}><label style={labelStyle}>Lieu</label><input value={edit.lieu} onChange={(e) => setEdit({ ...edit, lieu: e.target.value })} placeholder="Ex. Salle de cours, vocal Discord…" style={INP} /></div>
            <div style={{ flex: 1, minWidth: 180 }}><label style={labelStyle}>Formateur</label><input value={edit.formateur} onChange={(e) => setEdit({ ...edit, formateur: e.target.value })} style={INP} /></div>
          </div>
          <label style={labelStyle}>Description (facultatif)</label>
          <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={4} style={{ ...INP, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 22px", marginTop: 0 }}>Enregistrer</button>
            <button type="button" onClick={() => { setEdit(null); setMsg(""); }} style={smallBtn}>Annuler</button>
          </div>
        </form>
      )}
      {sessions === null && <div style={{ color: "#5A6B84" }}>Chargement…</div>}
      {sessions && !avenir.length && !erreur && <div style={{ ...CARTE, color: "#5A6B84" }}>Aucune séance à venir pour l'instant.</div>}
      {avenir.map((s, i) => carte(s, false, i === 0))}
      {passe.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button onClick={() => setPassees(!passees)} style={smallBtn}>{passees ? "Masquer" : "Voir"} les séances passées ({passe.length})</button>
          <div style={{ marginTop: 12 }}>{passees && passe.map((s) => carte(s, true))}</div>
        </div>
      )}
    </div>
  );
}

/* ---------- Mon évaluation (côté recrue) ---------- */

export function AmgnMonEvaluationPage({ dossier, current, onReload }) {
  const [charge, setCharge] = useState(false);
  const [{ domaines, seuil }] = useConfigAmgn();
  const [sessions] = useListe("amgn_planning");
  const prochaine = (sessions || []).filter((x) => x.date >= aujourdhui()).sort((a, b) => `${a.date} ${a.debut}`.localeCompare(`${b.date} ${b.debut}`))[0];
  const statut = (dossier && dossier.statut) || "En formation";
  const notes = notesDe(dossier);
  const moy = moyenneAmgn(dossier, domaines);
  const banniere = statut === "Admis"
    ? { f: "#E3F2E8", c: "#1F6B42", t: "🎖️ Félicitations, tu es admis !", d: "Tu as terminé ta formation à l'AMGN. Tu peux maintenant accéder à tout l'espace gendarme." }
    : statut === "Ajourné"
      ? { f: "#FBE3E7", c: "#C0172D", t: "Formation non validée pour le moment", d: "Le personnel de l'AMGN n'a pas validé ta formation. Rapproche-toi d'eux pour connaître la suite." }
      : { f: "#FFF1DC", c: "#B25E00", t: "Formation en cours", d: "Avant d'accéder à l'espace gendarme, le personnel de l'AMGN évalue ton niveau dans plusieurs domaines. Consulte les cours et le planning." };
  return (
    <div style={{ maxWidth: 860 }}>
      <EnteteAmgn titre="Mon évaluation" sous={`Bienvenue à l'Académie, ${current.prenom || ""} !`} />
      <div style={{ background: banniere.f, border: `1px solid ${banniere.c}`, borderRadius: 14, padding: "16px 20px", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><b style={{ color: banniere.c, fontSize: 16 }}>{banniere.t}</b><Pastille statut={statut} /></div>
        <div style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>{banniere.d}</div>
        {onReload && <button onClick={async () => { setCharge(true); await onReload(); setCharge(false); }} style={{ ...smallBtn, marginTop: 10 }}>{charge ? "Actualisation…" : "🔄 Actualiser mon statut"}</button>}
      </div>
      {prochaine && statut === "En formation" && (
        <div style={{ ...CARTE, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", borderLeft: `5px solid ${OR}` }}>
          <span style={{ fontSize: 28 }}>📅</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11.5, letterSpacing: 1.2, color: "#8A6D1F", fontWeight: 800 }}>PROCHAINE SÉANCE</div>
            <b style={{ fontSize: 15 }}>{prochaine.titre}</b>
            <div style={{ fontSize: 13, color: "#5A6B84", textTransform: "capitalize" }}>{jourFR(prochaine.date)}{prochaine.debut ? ` · ${prochaine.debut}` : ""}{prochaine.lieu ? ` · ${prochaine.lieu}` : ""}</div>
          </div>
        </div>
      )}
      <div style={CARTE}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <b style={{ fontSize: 15 }}>Mes notes par domaine</b>
          <span style={{ fontSize: 13, color: "#5A6B84" }}>{nbNotes(dossier, domaines)}/{domaines.length} domaines évalués{moy !== null ? ` · moyenne ${moy.toFixed(1).replace(".", ",")}/5` : ""}</span>
        </div>
        <BarreNote moy={moy || 0} seuil={seuil} />
        <div style={{ fontSize: 11.5, color: "#8A97AB", margin: "6px 0 10px" }}>Le trait foncé marque la moyenne visée pour être admis ({String(seuil).replace(".", ",")}/5).</div>
        {domaines.map((d) => {
          const n = notes[d.id] || {};
          return (
            <div key={d.id} style={{ padding: "12px 0", borderTop: "1px solid #EEF2F8" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div><b style={{ fontSize: 14 }}>{d.icone} {d.nom}</b><div style={{ fontSize: 12, color: "#5A6B84" }}>{d.aide}</div></div>
                {Number(n.note) > 0 ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Etoiles valeur={n.note} taille={20} /><b style={{ color: couleurNote(n.note), fontSize: 12.5 }}>{LIBELLE_NOTE[n.note]}</b></span> : <span style={{ fontSize: 12.5, color: "#8A97AB" }}>Pas encore évalué</span>}
              </div>
              {n.commentaire && <div style={{ fontSize: 13, background: "#F5F8FC", borderLeft: "3px solid #123A7A", padding: "8px 12px", marginTop: 8, whiteSpace: "pre-wrap" }}>{n.commentaire}{n.par ? <div style={{ fontSize: 11, color: "#8A97AB", marginTop: 4 }}>— {n.par}</div> : null}</div>}
            </div>
          );
        })}
        {dossier && dossier.observation && <div style={{ marginTop: 6, padding: "12px 14px", background: "#F5F8FC", borderRadius: 10, fontSize: 13.5, whiteSpace: "pre-wrap" }}><b>Appréciation générale :</b> {dossier.observation}</div>}
      </div>
    </div>
  );
}

/* ---------- Évaluation des recrues (personnel AMGN) ---------- */

function FicheEvaluation({ dossier, current, onClose, onSaved }) {
  const [{ domaines, seuil }] = useConfigAmgn();
  const [notes, setNotes] = useState(notesDe(dossier));
  const [obs, setObs] = useState(dossier.observation || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const par = nomDe(current);
  const maj = (id, patch) => setNotes((n) => ({ ...n, [id]: { ...(n[id] || {}), ...patch, par, le: new Date().toISOString() } }));
  const complet = domaines.every((d) => Number(notes[d.id] && notes[d.id].note) > 0);
  const nettoye = () => { const o = {}; domaines.forEach((d) => { const n = notes[d.id]; if (n && (Number(n.note) > 0 || n.commentaire)) o[d.id] = { note: Number(n.note) || 0, commentaire: String(n.commentaire || "").slice(0, 1500), par: n.par || par, le: n.le || new Date().toISOString() }; }); return o; };

  async function enregistrer(extra, texte) {
    setBusy(true); setMsg("");
    try {
      const patch = { notes: nettoye(), observation: obs.trim().slice(0, 3000), evalueLe: new Date().toISOString(), ...extra };
      await updateDoc(doc(db, "amgn_dossiers", dossier.id), patch);
      setMsg(texte || "Enregistré.");
      onSaved({ ...dossier, ...patch });
    } catch (e) { console.error(e); setMsg("Échec de l'enregistrement (règles Firestore de l'AMGN ?)."); }
    setBusy(false);
  }
  function decider(statut) {
    if (statut === "Admis" && !complet) { setMsg("Note d'abord tous les domaines avant d'admettre la recrue."); return; }
    const moyNow = moyenneAmgn({ notes }, domaines);
    if (statut === "Admis" && moyNow !== null && moyNow < seuil && !window.confirm(`Sa moyenne (${moyNow.toFixed(1).replace(".", ",")}/5) est inférieure à la moyenne visée (${seuil}/5). Admettre quand même ?`)) return;
    const txt = statut === "Admis" ? "Admettre cette recrue ? Elle aura accès à tout l'espace gendarme." : statut === "Ajourné" ? "Ajourner cette recrue ? Elle ne pourra pas accéder à l'espace gendarme." : "Remettre cette recrue en formation ?";
    if (!window.confirm(txt)) return;
    enregistrer({ statut, decisionPar: par, decisionLe: new Date().toISOString() }, `Décision enregistrée : ${statut}.`);
  }
  return (
    <div style={{ maxWidth: 860 }}>
      <button style={{ ...smallBtn, marginBottom: 14 }} onClick={onClose}>← Retour aux recrues</button>
      <div style={CARTE}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div><div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700 }}>{dossier.prenom} {dossier.nom}</div><div style={{ fontSize: 12.5, color: "#5A6B84" }}>{dossier.matricule || ""}{dossier.creeLe ? ` · arrivée le ${new Date(dossier.creeLe).toLocaleDateString("fr-FR")}` : ""}</div></div>
          <Pastille statut={dossier.statut || "En formation"} />
        </div>
        {dossier.decisionLe && <div style={{ fontSize: 12, color: "#8A97AB", marginTop: 6 }}>Dernière décision : {dossier.decisionPar || "—"} le {new Date(dossier.decisionLe).toLocaleString("fr-FR")}</div>}
      </div>
      <div style={CARTE}>
        {domaines.map((d, i) => {
          const n = notes[d.id] || {};
          return (
            <div key={d.id} style={{ padding: "12px 0", borderTop: i ? "1px solid #EEF2F8" : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                <div><b style={{ fontSize: 14 }}>{d.icone} {d.nom}</b><div style={{ fontSize: 12, color: "#5A6B84" }}>{d.aide}</div></div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Etoiles valeur={n.note} onChange={(v) => maj(d.id, { note: v })} />{Number(n.note) > 0 && <b style={{ color: couleurNote(n.note), fontSize: 12.5 }}>{LIBELLE_NOTE[n.note]}</b>}</span>
              </div>
              <textarea value={n.commentaire || ""} onChange={(e) => maj(d.id, { commentaire: e.target.value })} placeholder="Commentaire (visible par la recrue)" rows={2} style={{ ...INP, marginBottom: 0, resize: "vertical" }} />
            </div>
          );
        })}
        <label style={{ ...labelStyle, marginTop: 14 }}>Appréciation générale (visible par la recrue)</label>
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} style={{ ...INP, resize: "vertical" }} />
        <button disabled={busy} onClick={() => enregistrer({}, "Notes enregistrées.")} style={{ ...buttonPrimary, width: "auto", padding: "9px 22px", marginTop: 0 }}>{busy ? "Enregistrement…" : "Enregistrer les notes"}</button>
        {msg && <span style={{ marginLeft: 12, fontSize: 13, color: /chec|Note d/.test(msg) ? "#C0172D" : "#1F6B42" }}>{msg}</span>}
      </div>
      <div style={CARTE}>
        <b style={{ fontSize: 14 }}>Décision</b>
        <div style={{ fontSize: 12.5, color: "#5A6B84", margin: "4px 0 12px" }}>Tant que la recrue n'est pas « Admis », elle n'a accès qu'à l'espace AMGN (cours, planning, son évaluation).</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={busy} onClick={() => decider("Admis")} style={{ ...smallBtn, background: "#1F6B42", color: "#fff", borderColor: "#1F6B42" }}>✅ Admettre</button>
          <button disabled={busy} onClick={() => decider("Ajourné")} style={{ ...smallBtn, background: "#C0172D", color: "#fff", borderColor: "#C0172D" }}>⛔ Ajourner</button>
          <button disabled={busy} onClick={() => decider("En formation")} style={smallBtn}>↩️ Remettre en formation</button>
        </div>
      </div>
    </div>
  );
}

export function AmgnEvaluationsPage({ current, personnel = [] }) {
  const [dossiers, recharger, erreur] = useListe("amgn_dossiers");
  const [{ domaines, seuil }, rechargerCfg] = useConfigAmgn();
  const [reglages, setReglages] = useState(null);
  const [filtre, setFiltre] = useState("En formation");
  const [vue, setVue] = useState(null);
  const [q, setQ] = useState("");
  const [ajout, setAjout] = useState("");
  const [msg, setMsg] = useState("");
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const liste = (dossiers || []).filter((d) => (filtre === "Tous" || (d.statut || "En formation") === filtre) && (!q.trim() || norm(`${d.prenom} ${d.nom} ${d.matricule}`).includes(norm(q))))
    .sort((a, b) => String(b.creeLe || "").localeCompare(String(a.creeLe || "")));
  const ouvert = vue && (dossiers || []).find((d) => d.id === vue);
  const sansDossier = personnel.filter((p) => p.id && !p.isAdmin && !(dossiers || []).some((d) => d.id === p.id)).sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr"));

  async function creerDossier() {
    const p = personnel.find((x) => x.id === ajout);
    if (!p) return;
    try {
      await setDoc(doc(db, "amgn_dossiers", p.id), { statut: "En formation", notes: {}, prenom: p.prenom || "", nom: p.nom || "", matricule: p.matricule || "", grade: p.grade || "", creeLe: new Date().toISOString() });
      setAjout(""); setMsg(""); recharger();
    } catch (e) { console.error(e); setMsg("Création impossible (règles Firestore de l'AMGN ?)."); }
  }

  const compte = (s) => (dossiers || []).filter((d) => (d.statut || "En formation") === s).length;
  if (ouvert) return <FicheEvaluation key={ouvert.id} dossier={ouvert} current={current} onClose={() => { setVue(null); recharger(); }} onSaved={() => recharger()} />;
  return (
    <div style={{ maxWidth: 900 }}>
      <EnteteAmgn titre="Évaluation des recrues" sous={`Note chaque recrue sur les ${domaines.length} domaines, puis décide de son admission.`} />
      {erreur && <div style={{ ...CARTE, color: "#C0172D", fontSize: 13 }}>{erreur}</div>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <Tuile label="En formation" valeur={compte("En formation")} couleur="#B25E00" />
        <Tuile label="Admis" valeur={compte("Admis")} couleur="#2E7D4F" />
        <Tuile label="Ajournés" valeur={compte("Ajourné")} couleur="#C0172D" />
        <Tuile label="Moyenne visée" valeur={`${String(seuil).replace(".", ",")}/5`} couleur="#123A7A" />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        {["En formation", "Admis", "Ajourné", "Tous"].map((s) => (
          <button key={s} onClick={() => setFiltre(s)} style={{ ...smallBtn, background: filtre === s ? "#123A7A" : "transparent", color: filtre === s ? "#fff" : "#14213A", borderColor: filtre === s ? "#123A7A" : "#C3D0E2" }}>{s}{s !== "Tous" ? ` (${compte(s)})` : ""}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Rechercher" style={{ ...INP, marginBottom: 0, width: 200 }} />
      </div>
      {dossiers === null && <div style={{ color: "#5A6B84" }}>Chargement…</div>}
      {dossiers && !liste.length && !erreur && <div style={{ ...CARTE, color: "#5A6B84" }}>Aucune recrue dans cette catégorie.</div>}
      {liste.map((d) => (
        <div key={d.id} onClick={() => setVue(d.id)} style={{ ...CARTE, padding: "14px 18px", marginBottom: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div><b style={{ fontSize: 15 }}>{d.prenom} {d.nom}</b><div style={{ fontSize: 12, color: "#5A6B84" }}>{d.matricule || ""}{d.creeLe ? ` · arrivée le ${new Date(d.creeLe).toLocaleDateString("fr-FR")}` : ""}</div></div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: "#5A6B84" }}>{nbNotes(d, domaines)}/{domaines.length} notés{moyenneAmgn(d, domaines) !== null ? ` · ${moyenneAmgn(d, domaines).toFixed(1).replace(".", ",")}/5` : ""}</span>
            <Pastille statut={d.statut || "En formation"} />
          </div>
        </div>
      ))}
      <div style={{ ...CARTE, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <b style={{ fontSize: 13.5 }}>⚙️ Réglages de l'évaluation</b>
          {!reglages && <button style={smallBtn} onClick={() => setReglages({ domaines: domaines.map((x) => ({ ...x })), seuil, msg: "" })}>Modifier les domaines et la moyenne visée</button>}
        </div>
        {reglages && (
          <div style={{ marginTop: 14 }}>
            {reglages.domaines.map((x, i) => {
              const maj = (patch) => setReglages({ ...reglages, domaines: reglages.domaines.map((y, k) => (k === i ? { ...y, ...patch } : y)) });
              return (
                <div key={x.id} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
                  <input value={x.icone} onChange={(e) => maj({ icone: e.target.value.slice(0, 4) })} style={{ ...INP, marginBottom: 0, width: 56, textAlign: "center" }} />
                  <input value={x.nom} onChange={(e) => maj({ nom: e.target.value.slice(0, 80) })} placeholder="Nom du domaine" style={{ ...INP, marginBottom: 0, flex: 1, minWidth: 180 }} />
                  <input value={x.aide} onChange={(e) => maj({ aide: e.target.value.slice(0, 200) })} placeholder="Description" style={{ ...INP, marginBottom: 0, flex: 2, minWidth: 200 }} />
                  <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => setReglages({ ...reglages, domaines: reglages.domaines.filter((_, k) => k !== i) })}>✕</button>
                </div>
              );
            })}
            <button style={smallBtn} onClick={() => setReglages({ ...reglages, domaines: [...reglages.domaines, { id: `d${Date.now().toString(36)}`, nom: "", icone: "📌", aide: "" }] })}>＋ Ajouter un domaine</button>
            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Moyenne visée (sur 5)</label>
              <input type="number" min="1" max="5" step="0.5" value={reglages.seuil} onChange={(e) => setReglages({ ...reglages, seuil: e.target.value })} style={{ ...INP, marginBottom: 0, width: 90 }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
              <button style={{ ...buttonPrimary, width: "auto", padding: "8px 20px", marginTop: 0 }} onClick={async () => {
                const dom = reglages.domaines.filter((x) => x.nom.trim()).map((x) => ({ id: x.id, nom: x.nom.trim(), icone: x.icone || "📌", aide: x.aide.trim() }));
                if (!dom.length) { setReglages({ ...reglages, msg: "Garde au moins un domaine." }); return; }
                try { await setDoc(doc(db, "amgn_config", "general"), { domaines: dom, seuil: Math.min(5, Math.max(1, Number(reglages.seuil) || SEUIL_DEFAUT)), maj: new Date().toISOString() }); await rechargerCfg(); setReglages(null); }
                catch (e) { console.error(e); setReglages({ ...reglages, msg: "Échec (règles Firestore de l'AMGN à mettre à jour ?)." }); }
              }}>Enregistrer</button>
              <button style={smallBtn} onClick={() => setReglages(null)}>Annuler</button>
              {reglages.msg && <span style={{ color: "#C0172D", fontSize: 12.5 }}>{reglages.msg}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: "#8A97AB", marginTop: 8 }}>Supprimer un domaine ne détruit pas les notes déjà données : elles sont simplement masquées.</div>
          </div>
        )}
      </div>
      {dossiers && sansDossier.length > 0 && (
        <div style={{ ...CARTE, marginTop: 20 }}>
          <b style={{ fontSize: 13.5 }}>Ajouter un gendarme existant à l'AMGN</b>
          <div style={{ fontSize: 12, color: "#5A6B84", margin: "3px 0 10px" }}>Les nouvelles recrues arrivent automatiquement. Utilise ceci pour une personne déjà en poste qui doit passer par l'Académie.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={ajout} onChange={(e) => setAjout(e.target.value)} style={{ ...INP, marginBottom: 0, flex: 1, minWidth: 220 }}>
              <option value="">— Choisir un gendarme —</option>
              {sansDossier.map((p) => <option key={p.id} value={p.id}>{p.grade} {p.prenom} {p.nom}</option>)}
            </select>
            <button disabled={!ajout} onClick={creerDossier} style={smallBtn}>Ajouter</button>
          </div>
          {msg && <div style={{ color: "#C0172D", fontSize: 12.5, marginTop: 8 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
