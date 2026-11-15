// pages/programmes.jsx — Programmes de formation (par poste et par filière : terrain / réserve), suivi des recrues et critères de titularisation.
import React, { useEffect, useState } from "react";
import { doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { loadCollection } from "../lib/donnees.js";
import { NeoCarte, NeoAlerte, NeoBouton, NEO_INP, NEO_LAB, N } from "../composants/neo.jsx";
import { FILIERES, PROGRAMMES_EXEMPLES } from "../lib/selection.js";

const BTN = { border: "1px solid #123A7A", background: "#fff", color: "#123A7A", borderRadius: 10, padding: "7px 13px", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
const BTN_KO = { ...BTN, borderColor: "#C0172D", color: "#C0172D" };
const TYPES = { cours: "📖 Cours", pratique: "🛠️ Pratique", eval: "🎯 Évaluation" };
const POSTES = ["GAV", "SOG", "Officier"];
const jour = (x) => { const d = new Date(x); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR"); };

export const obligatoires = (prog) => (prog && Array.isArray(prog.modules) ? prog.modules.filter((m) => m.obligatoire !== false) : []);
export const avancement = (prog, suivi) => {
  const ob = obligatoires(prog);
  const faits = ob.filter((m) => suivi && suivi.modules && suivi.modules[m.id] && suivi.modules[m.id].valide);
  const heuresTot = (prog && prog.modules ? prog.modules : []).reduce((t, m) => t + (Number(m.heures) || 0), 0);
  return { total: ob.length, faits: faits.length, pct: ob.length ? Math.round((faits.length / ob.length) * 100) : 0, pret: ob.length > 0 && faits.length === ob.length, heuresTot };
};

// ───────────────────────── Administration des programmes ─────────────────────────
export function ProgrammesAdmin({ programmes, setProgrammes, dit }) {
  const [edit, setEdit] = useState(null);
  const [occupe, setOccupe] = useState(false);

  async function exemples() {
    if (!window.confirm("Ajouter les 6 programmes types (GAV, SOG, Officier × terrain / réserve) ? Ceux qui existent déjà avec le même nom seront remplacés.")) return;
    setOccupe(true);
    try {
      for (const p of PROGRAMMES_EXEMPLES) {
        const { id, ...donnees } = p;
        await setDoc(doc(db, "programmes_formation", id), donnees);
        setProgrammes((prev) => [...prev.filter((x) => x.id !== id), { id, ...donnees }]);
      }
      dit("Programmes types ajoutés : adapte-les à ton serveur.");
    } catch (e) { console.error(e); dit("Échec : règles Firestore publiées ?", "danger"); }
    setOccupe(false);
  }
  async function enregistrer() {
    const p = edit;
    const modules = p.modules.filter((m) => m.titre.trim()).map((m, i) => ({ id: m.id || "m" + (i + 1) + Date.now().toString(36).slice(-3), titre: m.titre.trim(), heures: Number(m.heures) || 0, type: m.type || "cours", obligatoire: m.obligatoire !== false }));
    if (!p.titre.trim() || !modules.length) { dit("Donne un titre et au moins un module.", "attention"); return; }
    const id = p.id || `${String(p.poste).toLowerCase()}-${p.filiere}-${Date.now().toString(36).slice(-3)}`;
    const donnees = { poste: p.poste, filiere: p.filiere, titre: p.titre.trim(), jours: Number(p.jours) || 5, modules };
    setOccupe(true);
    try { await setDoc(doc(db, "programmes_formation", id), donnees); setProgrammes((prev) => [...prev.filter((x) => x.id !== id), { id, ...donnees }]); setEdit(null); dit("Programme enregistré."); }
    catch (e) { console.error(e); dit("Échec de l'enregistrement.", "danger"); }
    setOccupe(false);
  }
  async function supprimer(p) {
    if (!window.confirm(`Supprimer « ${p.titre} » ?`)) return;
    try { await deleteDoc(doc(db, "programmes_formation", p.id)); setProgrammes((prev) => prev.filter((x) => x.id !== p.id)); dit("Programme supprimé."); } catch (e) { console.error(e); dit("Échec.", "danger"); }
  }

  if (edit) {
    const maj = (x) => setEdit((e) => ({ ...e, ...x }));
    const majM = (i, x) => maj({ modules: edit.modules.map((m, k) => (k === i ? { ...m, ...x } : m)) });
    return (
      <NeoCarte titre={edit.id ? "Modifier le programme" : "Nouveau programme"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}><label style={NEO_LAB}>Titre</label><input style={NEO_INP} value={edit.titre} onChange={(e) => maj({ titre: e.target.value })} /></div>
          <div><label style={NEO_LAB}>Poste</label><select style={NEO_INP} value={edit.poste} onChange={(e) => maj({ poste: e.target.value })}>{POSTES.map((p) => <option key={p}>{p}</option>)}</select></div>
          <div><label style={NEO_LAB}>Filière</label><select style={NEO_INP} value={edit.filiere} onChange={(e) => maj({ filiere: e.target.value })}>{Object.entries(FILIERES).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}</select></div>
          <div><label style={NEO_LAB}>Durée visée (jours)</label><input style={NEO_INP} type="number" min="1" value={edit.jours} onChange={(e) => maj({ jours: e.target.value })} /></div>
        </div>
        <div style={{ marginTop: 12, fontWeight: 800, color: N.encre }}>Modules</div>
        {edit.modules.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6, border: "1px solid #E1E8F2", borderRadius: 10, padding: 8, background: "#FAFCFF" }}>
            <input style={{ ...NEO_INP, flex: "3 1 220px" }} placeholder="Titre du module" value={m.titre} onChange={(e) => majM(i, { titre: e.target.value })} />
            <select style={{ ...NEO_INP, flex: "1 1 120px" }} value={m.type} onChange={(e) => majM(i, { type: e.target.value })}>{Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input style={{ ...NEO_INP, width: 74 }} type="number" min="0" step="0.5" placeholder="h" title="Heures" value={m.heures} onChange={(e) => majM(i, { heures: e.target.value })} />
            <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={m.obligatoire !== false} onChange={(e) => majM(i, { obligatoire: e.target.checked })} /> obligatoire</label>
            <button type="button" onClick={() => maj({ modules: edit.modules.filter((_, k) => k !== i) })} style={BTN_KO}>✕</button>
          </div>
        ))}
        <button type="button" onClick={() => maj({ modules: [...edit.modules, { id: "", titre: "", heures: 1, type: "cours", obligatoire: true }] })} style={{ ...BTN, marginTop: 8 }}>➕ Ajouter un module</button>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}><NeoBouton disabled={occupe} onClick={enregistrer}>💾 Enregistrer</NeoBouton><button type="button" onClick={() => setEdit(null)} style={BTN}>Annuler</button></div>
      </NeoCarte>
    );
  }
  const tries = programmes.slice().sort((a, b) => `${a.poste}${a.filiere}`.localeCompare(`${b.poste}${b.filiere}`));
  return (
    <>
      <NeoAlerte ton="info" icone="🎓">Un programme par <b>poste</b> (GAV, SOG, Officier) et par <b>filière</b> (terrain, réserve). La titularisation d'une recrue est possible quand tous les modules obligatoires de son programme sont validés.</NeoAlerte>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <NeoBouton onClick={() => setEdit({ id: "", titre: "", poste: "GAV", filiere: "terrain", jours: 5, modules: [{ id: "", titre: "", heures: 1, type: "cours", obligatoire: true }] })}>➕ Nouveau programme</NeoBouton>
        <button type="button" disabled={occupe} onClick={exemples} style={BTN}>📚 Charger les programmes types</button>
      </div>
      {!tries.length && <NeoAlerte ton="attention" icone="ℹ️">Aucun programme pour le moment : charge les programmes types pour démarrer.</NeoAlerte>}
      {tries.map((p) => {
        const f = FILIERES[p.filiere] || FILIERES.terrain;
        const h = (p.modules || []).reduce((t, m) => t + (Number(m.heures) || 0), 0);
        return (
          <NeoCarte key={p.id} style={{ padding: "12px 16px", borderLeft: `6px solid ${f.couleur}` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 800, color: N.encre }}>{p.titre}</div>
                <div style={{ fontSize: 12, color: N.gris }}><span style={{ color: f.couleur, fontWeight: 800 }}>{f.label}</span> · {(p.modules || []).length} modules · {h} h · ~{p.jours} jours</div>
              </div>
              <button type="button" onClick={() => setEdit({ ...p, modules: (p.modules || []).map((m) => ({ ...m })) })} style={BTN}>Modifier</button>
              <button type="button" onClick={() => supprimer(p)} style={BTN_KO}>Supprimer</button>
            </div>
          </NeoCarte>
        );
      })}
    </>
  );
}

// ───────────────────────── Suivi des recrues (pour les formateurs) ─────────────────────────
export function SuiviRecrues({ personnel, programmes, selections, current, dit, onNavigate }) {
  const [dossiers, setDossiers] = useState({});
  const [ouvert, setOuvert] = useState("");
  const [occupe, setOccupe] = useState(false);
  useEffect(() => { loadCollection("programmes_suivi").then((l) => setDossiers(Object.fromEntries((l || []).map((d) => [d.id, d])))).catch(() => {}); }, []);

  const enFormation = personnel.filter((p) => p.essaiStatut === "En cours" || p.essaiStatut === "Prolongée");
  const par = `${current.grade || ""} ${current.prenom || ""} ${current.nom || ""}`.trim();

  // Programme conseillé : celui du poste/filière d'une sélection portant le même nom
  const conseille = (p) => {
    const nom = `${p.prenom || ""} ${p.nom || ""}`.trim().toLowerCase();
    const sel = Object.values(selections || {}).find((s) => String(s.nom || "").trim().toLowerCase() === nom);
    if (!sel) return null;
    return (programmes || []).find((x) => String(sel.poste || "").toLowerCase().startsWith(String(x.poste).toLowerCase().slice(0, 3)) && x.filiere === (sel.filiere || "terrain")) || null;
  };
  async function ecrire(uid, programme) {
    setOccupe(true);
    try {
      await setDoc(doc(db, "programmes_suivi", uid), { programme }, { merge: true });
      setDossiers((prev) => ({ ...prev, [uid]: { ...(prev[uid] || { id: uid }), programme } }));
    } catch (e) { console.error(e); dit("Échec de l'enregistrement.", "danger"); }
    setOccupe(false);
  }
  const assigner = (uid, id) => ecrire(uid, id ? { id, modules: {}, assigneLe: new Date().toISOString() } : null);
  const basculer = (uid, prog, mid) => {
    const cur = (dossiers[uid] && dossiers[uid].programme) || { id: prog.id, modules: {} };
    const deja = cur.modules && cur.modules[mid] && cur.modules[mid].valide;
    const modules = { ...(cur.modules || {}) };
    if (deja) delete modules[mid]; else modules[mid] = { valide: true, par, le: new Date().toISOString() };
    return ecrire(uid, { ...cur, id: prog.id, modules });
  };

  if (!enFormation.length) return <NeoAlerte ton="info" icone="ℹ️">Aucune recrue en formation ou en période d'essai pour le moment.</NeoAlerte>;
  return (
    <>
      <NeoAlerte ton="info" icone="🎓">Valide les modules au fur et à mesure. Quand tous les modules obligatoires sont validés, la recrue est <b>prête pour la titularisation</b> (page « Recrues en essai »).</NeoAlerte>
      {enFormation.map((p) => {
        const sv = dossiers[p.id] && dossiers[p.id].programme;
        const prog = sv ? programmes.find((x) => x.id === sv.id) : null;
        const av = avancement(prog, sv);
        const reco = conseille(p);
        const ouv = ouvert === p.id;
        return (
          <NeoCarte key={p.id} style={{ padding: "12px 16px", borderLeft: `6px solid ${av.pret ? "#1F9D55" : prog ? "#2F7BFF" : "#C3D0E2"}` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: N.encre }}>{p.grade} {p.prenom} {p.nom}</div>
                <div style={{ fontSize: 12, color: N.gris }}>{prog ? prog.titre : "Aucun programme affecté"}{p.essaiFin ? ` · fin d'essai ${jour(p.essaiFin)}` : ""}</div>
              </div>
              {prog && <div style={{ flex: "1 1 150px", minWidth: 120 }}>
                <div style={{ height: 8, background: "#E1E9F6", borderRadius: 6, overflow: "hidden" }}><div style={{ width: av.pct + "%", height: "100%", background: av.pret ? "#1F9D55" : "#2F7BFF" }} /></div>
                <div style={{ fontSize: 11.5, color: N.gris, marginTop: 3 }}>{av.faits}/{av.total} modules · {av.pct}%</div>
              </div>}
              {av.pret && <span style={{ background: "#1F9D5522", color: "#1F6B42", border: "1px solid #1F9D55", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 800 }}>PRÊTE À TITULARISER</span>}
              <button type="button" onClick={() => setOuvert(ouv ? "" : p.id)} style={BTN}>{ouv ? "Fermer" : "Gérer"}</button>
            </div>
            {ouv && (
              <div style={{ marginTop: 10, borderTop: "1px dashed #C3D0E2", paddingTop: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                  <select style={{ ...NEO_INP, maxWidth: 360 }} value={prog ? prog.id : ""} disabled={occupe} onChange={(e) => assigner(p.id, e.target.value)}>
                    <option value="">— Choisir un programme —</option>
                    {programmes.map((x) => <option key={x.id} value={x.id}>{x.titre}</option>)}
                  </select>
                  {!prog && reco && <button type="button" disabled={occupe} onClick={() => assigner(p.id, reco.id)} style={BTN}>Appliquer le conseillé : {reco.titre}</button>}
                </div>
                {prog && (prog.modules || []).map((m) => {
                  const fait = sv && sv.modules && sv.modules[m.id] && sv.modules[m.id].valide;
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderBottom: "1px solid #EEF2F8", flexWrap: "wrap" }}>
                      <button type="button" disabled={occupe} onClick={() => basculer(p.id, prog, m.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `2px solid ${fait ? "#1F9D55" : "#B8C7E0"}`, background: fait ? "#1F9D55" : "#fff", color: "#fff", cursor: "pointer", fontWeight: 900 }}>{fait ? "✓" : ""}</button>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontWeight: 700, color: N.encre, fontSize: 13.5 }}>{m.titre}</div>
                        <div style={{ fontSize: 11.5, color: N.gris }}>{TYPES[m.type] || m.type} · {m.heures} h{m.obligatoire === false ? " · facultatif" : ""}{fait ? ` · validé par ${sv.modules[m.id].par || "—"} le ${jour(sv.modules[m.id].le)}` : ""}</div>
                      </div>
                    </div>
                  );
                })}
                {av.pret && onNavigate && <div style={{ marginTop: 10 }}><NeoBouton onClick={() => onNavigate("essai")}>🎖️ Aller titulariser (Recrues en essai)</NeoBouton></div>}
              </div>
            )}
          </NeoCarte>
        );
      })}
    </>
  );
}

// ───────────────────────── Carte « Mon programme » (dans le dossier de l'agent) ─────────────────────────
export function CarteProgramme({ agentId }) {
  const [etat, setEtat] = useState({ prog: null, suivi: null, fini: false });
  useEffect(() => {
    let v = true;
    (async () => {
      try {
        const d = await getDoc(doc(db, "programmes_suivi", agentId));
        const sv = d.exists() ? d.data().programme : null;
        if (!sv) { if (v) setEtat({ prog: null, suivi: null, fini: true }); return; }
        const p = await getDoc(doc(db, "programmes_formation", sv.id));
        if (v) setEtat({ prog: p.exists() ? { id: p.id, ...p.data() } : null, suivi: sv, fini: true });
      } catch (e) { if (v) setEtat({ prog: null, suivi: null, fini: true }); }
    })();
    return () => { v = false; };
  }, [agentId]);
  if (!etat.prog) return null;
  const av = avancement(etat.prog, etat.suivi);
  return (
    <NeoCarte titre="🎓 Programme de formation" droite={<span style={{ fontSize: 12.5, color: av.pret ? "#1F6B42" : N.gris, fontWeight: 800 }}>{av.pret ? "Prêt pour la titularisation" : `${av.faits}/${av.total} modules`}</span>}>
      <div style={{ fontSize: 13, color: N.gris, marginBottom: 8 }}>{etat.prog.titre}</div>
      <div style={{ height: 9, background: "#E1E9F6", borderRadius: 6, overflow: "hidden", marginBottom: 10 }}><div style={{ width: av.pct + "%", height: "100%", background: av.pret ? "#1F9D55" : "#2F7BFF" }} /></div>
      {(etat.prog.modules || []).map((m) => {
        const fait = etat.suivi && etat.suivi.modules && etat.suivi.modules[m.id] && etat.suivi.modules[m.id].valide;
        return <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, padding: "4px 0", color: fait ? "#1F6B42" : N.encre }}><span>{fait ? "✅" : "⬜"}</span><span style={{ flex: 1 }}>{m.titre}</span><span style={{ fontSize: 11.5, color: N.gris }}>{m.heures} h</span></div>;
      })}
    </NeoCarte>
  );
}
