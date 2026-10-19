// pages/habilitations.jsx — Habilitations : formations à valider (conduite, armes d'épaule…).
// Chaque agent a, pour chaque formation, un statut : validée (rôle attribué), en cours ou non validée.
// Données : habilitations_def/{id} (les formations, créées par les admins) et habilitations/{uid} (les statuts d'un agent).
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { PseudosAgent } from "../composants/Pseudos.jsx";
import { Field, h2Style, smallBtn } from "../composants/ui.jsx";
import { db } from "../firebase";
import { peutCreerHabilitations, peutValiderHabilitations } from "../lib/droits.js";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const BLEU = "#123A7A";

export const STATUTS_HABILITATION = {
  validee: { label: "Validée", ico: "✅", c: "#1F6B42", bord: "#2E7D4F", fond: "#E3F2E8" },
  en_cours: { label: "En cours", ico: "🟡", c: "#8A5A00", bord: "#E0A23A", fond: "#FFF1DC" },
  non_validee: { label: "Non validée", ico: "⛔", c: "#8A1020", bord: "#C0172D", fond: "#FBE3E7" },
};
const ORDRE_STATUTS = ["validee", "en_cours", "non_validee"];
const statutDe = (statuts, id) => {
  const s = statuts && statuts[id] && statuts[id].statut;
  return STATUTS_HABILITATION[s] ? s : "non_validee";
};
const dateCourte = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); };

async function chargerDefs() {
  const s = await getDocs(collection(db, "habilitations_def"));
  return s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || String(a.nom).localeCompare(String(b.nom)));
}

// Pastille de statut (réutilisable ailleurs dans le site)
export function PastilleStatut({ statut, texte }) {
  const s = STATUTS_HABILITATION[statut] || STATUTS_HABILITATION.non_validee;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.fond, color: s.c, border: `1px solid ${s.bord}`, borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{s.ico} {texte || s.label}</span>;
}

/* ---------- Pour tous les agents : mes habilitations ---------- */

export function MesHabilitations({ current }) {
  const [etat, setEtat] = useState({ charge: false, erreur: "" });
  const [defs, setDefs] = useState([]);
  const [statuts, setStatuts] = useState({});

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const [d, m] = await Promise.all([chargerDefs(), getDoc(doc(db, "habilitations", current.id))]);
        if (!vivant) return;
        setDefs(d);
        setStatuts(m.exists() && m.data().statuts ? m.data().statuts : {});
        setEtat({ charge: true, erreur: "" });
      } catch (e) {
        console.error(e);
        if (vivant) setEtat({ charge: true, erreur: "Impossible de charger tes habilitations (droits ou connexion)." });
      }
    })();
    return () => { vivant = false; };
  }, [current.id]);

  const nb = (st) => defs.filter((d) => statutDe(statuts, d.id) === st).length;
  const tuile = (st) => {
    const s = STATUTS_HABILITATION[st];
    return (
      <div key={st} style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${s.bord}`, borderRadius: 12, padding: "10px 14px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: s.c, lineHeight: 1.1 }}>{nb(st)}</div>
        <div style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>{s.ico} {s.label}</div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: FONT, maxWidth: 940 }}>
      <h2 style={h2Style}>Mes habilitations</h2>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 16, lineHeight: 1.5 }}>Les formations à valider (conduite, armes d'épaule…). Quand une formation est validée, tu obtiens le rôle correspondant.</div>
      {etat.erreur && <div style={{ background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>{etat.erreur}</div>}
      {!etat.charge && <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement…</div>}
      {etat.charge && !etat.erreur && defs.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune formation n'a encore été créée.</div>}
      {defs.length > 0 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>{ORDRE_STATUTS.map(tuile)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {defs.map((d) => {
              const st = statutDe(statuts, d.id);
              const s = STATUTS_HABILITATION[st];
              const e = statuts[d.id] || {};
              return (
                <div key={d.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `6px solid ${s.bord}`, borderRadius: 14, padding: "16px 18px", boxShadow: "0 6px 20px -12px rgba(7,20,46,0.35)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 30 }}>{d.emoji || "🎓"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15.5, color: "#14213A", lineHeight: 1.2 }}>{d.nom}</div>
                      <div style={{ marginTop: 5 }}><PastilleStatut statut={st} /></div>
                    </div>
                  </div>
                  {d.description && <div style={{ fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.5, marginBottom: 8 }}>{d.description}</div>}
                  {st === "validee" && (
                    <div style={{ background: s.fond, borderRadius: 8, padding: "7px 10px", fontSize: 12, color: s.c, lineHeight: 1.45 }}>
                      🎖 Rôle obtenu : <b>{d.roleNom || d.nom}</b>
                      {e.le ? <><br />Validée le {dateCourte(e.le)}{e.par ? ` par ${e.par}` : ""}</> : null}
                    </div>
                  )}
                  {st === "en_cours" && <div style={{ fontSize: 12, color: s.c, fontWeight: 600 }}>Ta formation est en cours : continue, la validation arrive.</div>}
                  {st === "non_validee" && <div style={{ fontSize: 12, color: "#5A6B84" }}>Pas encore validée. Rapproche-toi d'un formateur pour t'inscrire.</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Gestion : formations + suivi des agents (admins ; suivi aussi pour le Corps de Commandement) ---------- */

const champ = { boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 10, padding: "9px 11px", fontSize: 13, fontFamily: FONT, background: "#fff" };
const carte = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 18, boxShadow: "0 6px 20px -12px rgba(7,20,46,0.3)", marginBottom: 16 };

export function HabilitationsAdmin({ current, personnel = [] }) {
  const peutCreer = peutCreerHabilitations(current);
  const peutValider = peutValiderHabilitations(current);
  const [onglet, setOnglet] = useState(peutValider ? "suivi" : "formations");
  const [defs, setDefs] = useState([]);
  const [tous, setTous] = useState({});
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState("");

  async function recharger() {
    try {
      const [d, h] = await Promise.all([chargerDefs(), getDocs(collection(db, "habilitations"))]);
      setDefs(d);
      const m = {};
      h.docs.forEach((x) => { m[x.id] = x.data().statuts || {}; });
      setTous(m);
      setErreur("");
    } catch (e) { console.error(e); setErreur("Chargement impossible (droits ou connexion)."); }
    setCharge(true);
  }
  useEffect(() => { recharger(); }, []);

  if (!peutValider && !peutCreer) return <div style={{ color: "#5A6B84", fontSize: 13 }}>Tu n'as pas les droits pour gérer les habilitations.</div>;

  const onglets = [...(peutValider ? [["suivi", "👥 Suivi des agents"]] : []), ...(peutCreer ? [["formations", "🎓 Formations à créer"]] : [])];
  return (
    <div style={{ fontFamily: FONT, maxWidth: 1100 }}>
      <h2 style={h2Style}>Habilitations</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {onglets.map(([id, t]) => (
          <button key={id} type="button" onClick={() => setOnglet(id)} style={{ background: onglet === id ? BLEU : "#fff", color: onglet === id ? "#fff" : "#14213A", border: `1px solid ${onglet === id ? BLEU : "#C3D0E2"}`, borderRadius: 999, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>{t}</button>
        ))}
      </div>
      {erreur && <div style={{ background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>{erreur}</div>}
      {!charge && <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement…</div>}
      {charge && onglet === "suivi" && <OngletSuivi current={current} defs={defs} personnel={personnel} tous={tous} setTous={setTous} setErreur={setErreur} />}
      {charge && onglet === "formations" && peutCreer && <OngletFormations defs={defs} recharger={recharger} />}
    </div>
  );
}

function OngletSuivi({ current, defs, personnel, tous, setTous, setErreur }) {
  const [recherche, setRecherche] = useState("");
  const [formation, setFormation] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [occupe, setOccupe] = useState("");

  if (defs.length === 0) {
    return <div style={{ ...carte, color: "#5A6B84", fontSize: 13 }}>Aucune formation n'existe pour l'instant. {peutCreerHabilitations(current) ? "Crée-en dans l'onglet « Formations à créer »." : "Un admin doit d'abord en créer."}</div>;
  }

  const colonnes = formation ? defs.filter((d) => d.id === formation) : defs;
  const q = recherche.trim().toLowerCase();
  const agents = personnel
    .filter((p) => !q || `${p.prenom} ${p.nom} ${p.matricule} ${p.pseudoRoblox} ${p.pseudoDiscord}`.toLowerCase().includes(q))
    .filter((p) => !(formation && filtreStatut) || statutDe(tous[p.id], formation) === filtreStatut)
    .sort((a, b) => String(a.nom).localeCompare(String(b.nom)));

  async function changer(agent, def, statut) {
    const cle = `${agent.id}|${def.id}`;
    setOccupe(cle);
    const le = new Date().toISOString();
    const entree = { statut, par: `${current.grade} ${current.prenom} ${current.nom}`, le };
    try {
      await setDoc(doc(db, "habilitations", agent.id), { statuts: { [def.id]: entree }, updatedAt: le }, { merge: true });
      setTous((t) => ({ ...t, [agent.id]: { ...(t[agent.id] || {}), [def.id]: entree } }));
      setErreur("");
    } catch (e) { console.error(e); setErreur("Échec de l'enregistrement (droits : admin ou Corps de Commandement)."); }
    setOccupe("");
  }

  const nbValidees = (d) => personnel.filter((p) => statutDe(tous[p.id], d.id) === "validee").length;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔎 Agent (nom, matricule, pseudo)" style={{ ...champ, flex: "1 1 240px" }} />
        <select value={formation} onChange={(e) => { setFormation(e.target.value); setFiltreStatut(""); }} style={champ}>
          <option value="">Toutes les formations</option>
          {defs.map((d) => <option key={d.id} value={d.id}>{d.emoji || "🎓"} {d.nom}</option>)}
        </select>
        {formation && (
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={champ}>
            <option value="">Tous les statuts</option>
            {ORDRE_STATUTS.map((st) => <option key={st} value={st}>{STATUTS_HABILITATION[st].ico} {STATUTS_HABILITATION[st].label}</option>)}
          </select>
        )}
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 8 }}>{agents.length} agent{agents.length > 1 ? "s" : ""}</div>
      <div style={{ overflowX: "auto", border: "1px solid #D3DDEA", borderRadius: 14, background: "#fff", boxShadow: "0 6px 20px -12px rgba(7,20,46,0.3)" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 280 + colonnes.length * 150 }}>
          <thead>
            <tr style={{ background: "#F5F8FC" }}>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#5A6B84", position: "sticky", left: 0, background: "#F5F8FC", minWidth: 250, zIndex: 1 }}>Agent</th>
              {colonnes.map((d) => (
                <th key={d.id} style={{ textAlign: "left", padding: "10px 10px", fontSize: 12.5, color: "#14213A", minWidth: 150 }}>
                  <div>{d.emoji || "🎓"} {d.nom}</div>
                  <div style={{ fontSize: 11, color: "#1F6B42", fontWeight: 600 }}>{nbValidees(d)} validée{nbValidees(d) > 1 ? "s" : ""}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid #E3EAF4" }}>
                <td style={{ padding: "9px 14px", position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.grade} {p.prenom} {p.nom}</div>
                  <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 2 }}>{p.matricule}<PseudosAgent agent={p} /></div>
                </td>
                {colonnes.map((d) => {
                  const st = statutDe(tous[p.id], d.id);
                  const s = STATUTS_HABILITATION[st];
                  const e = (tous[p.id] || {})[d.id] || {};
                  return (
                    <td key={d.id} style={{ padding: "8px 10px" }}>
                      <select
                        value={st}
                        disabled={occupe === `${p.id}|${d.id}`}
                        onChange={(ev) => changer(p, d, ev.target.value)}
                        title={e.le ? `Modifié le ${dateCourte(e.le)}${e.par ? ` par ${e.par}` : ""}` : "Jamais modifié"}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: `1px solid ${s.bord}`, background: s.fond, color: s.c, fontWeight: 800, fontSize: 12.5, fontFamily: FONT, cursor: "pointer", opacity: occupe === `${p.id}|${d.id}` ? 0.5 : 1 }}
                      >
                        {ORDRE_STATUTS.map((k) => <option key={k} value={k}>{STATUTS_HABILITATION[k].ico} {STATUTS_HABILITATION[k].label}</option>)}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
            {agents.length === 0 && <tr><td colSpan={colonnes.length + 1} style={{ padding: 18, color: "#5A6B84", fontSize: 13 }}>Aucun agent ne correspond.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 10 }}>Survole un statut pour voir qui l'a modifié et quand. Chaque changement est enregistré immédiatement.</div>
    </div>
  );
}

function OngletFormations({ defs, recharger }) {
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState("");
  const bouton = { ...smallBtn, padding: "4px 9px" };

  async function deplacer(def, sens) {
    const arr = defs.slice();
    const i = arr.findIndex((x) => x.id === def.id);
    const j = i + sens;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await Promise.all(arr.map((x, k) => (x.ordre === k ? null : updateDoc(doc(db, "habilitations_def", x.id), { ordre: k }))));
    recharger();
  }
  async function sauver(e) {
    e.preventDefault();
    if (!String(edit.nom || "").trim()) { setMsg("Donne un nom à la formation."); return; }
    const champs = { nom: edit.nom.trim(), emoji: (edit.emoji || "🎓").trim(), roleNom: (edit.roleNom || "").trim(), description: (edit.description || "").trim(), updatedAt: new Date().toISOString() };
    try {
      if (edit.id) await updateDoc(doc(db, "habilitations_def", edit.id), champs);
      else await addDoc(collection(db, "habilitations_def"), { ...champs, ordre: defs.length, createdAt: new Date().toISOString() });
      setEdit(null); setMsg(""); recharger();
    } catch (err) { console.error(err); setMsg("Échec de l'enregistrement."); }
  }
  async function supprimer(d) {
    if (!window.confirm(`Supprimer la formation « ${d.nom} » ? Les statuts déjà enregistrés pour cette formation ne seront plus affichés.`)) return;
    try { await deleteDoc(doc(db, "habilitations_def", d.id)); recharger(); } catch (err) { console.error(err); setMsg("Échec de la suppression."); }
  }

  return (
    <div>
      {msg && <div style={{ background: "#FFF6E0", border: "1px solid #F0D58A", color: "#5C4300", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, marginBottom: 12 }}>{msg}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "#5A6B84" }}>{defs.length} formation{defs.length > 1 ? "s" : ""} à valider</div>
        <button type="button" onClick={() => { setEdit({ nom: "", emoji: "🎓", roleNom: "", description: "" }); setMsg(""); }} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>+ Nouvelle formation</button>
      </div>

      {edit && (
        <form onSubmit={sauver} style={carte}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>{edit.id ? "Modifier la formation" : "Nouvelle formation"}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 90px" }}><Field label="Emoji" value={edit.emoji} onChange={(v) => setEdit({ ...edit, emoji: v })} placeholder="🚓" /></div>
            <div style={{ flex: "1 1 240px" }}><Field label="Nom de la formation" value={edit.nom} onChange={(v) => setEdit({ ...edit, nom: v })} placeholder="Ex : Conduite" /></div>
            <div style={{ flex: "1 1 240px" }}><Field label="Rôle attribué si validée" value={edit.roleNom} onChange={(v) => setEdit({ ...edit, roleNom: v })} placeholder="Ex : Habilité conduite (par défaut : le nom)" /></div>
          </div>
          <Field label="Description (facultatif)" value={edit.description} onChange={(v) => setEdit({ ...edit, description: v })} placeholder="Ce que l'agent doit maîtriser pour la valider" textarea />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Enregistrer</button>
            <button type="button" onClick={() => setEdit(null)} style={smallBtn}>Annuler</button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {defs.map((d, i) => (
          <div key={d.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${BLEU}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 28 }}>{d.emoji || "🎓"}</span>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: "#14213A" }}>{d.nom}</div>
              <div style={{ fontSize: 12, color: "#5A6B84", lineHeight: 1.45 }}>🎖 Rôle si validée : <b>{d.roleNom || d.nom}</b>{d.description ? ` · ${d.description}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <button type="button" onClick={() => deplacer(d, -1)} disabled={i === 0} style={bouton} title="Monter">↑</button>
              <button type="button" onClick={() => deplacer(d, 1)} disabled={i === defs.length - 1} style={bouton} title="Descendre">↓</button>
              <button type="button" onClick={() => { setEdit({ ...d }); setMsg(""); window.scrollTo(0, 0); }} style={bouton}>Modifier</button>
              <button type="button" onClick={() => supprimer(d)} style={{ ...bouton, color: "#C0172D", borderColor: "#C0172D" }}>Suppr.</button>
            </div>
          </div>
        ))}
        {defs.length === 0 && !edit && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune formation. Clique sur « Nouvelle formation » (exemples : Conduite, Armes d'épaule, Secourisme…).</div>}
      </div>
    </div>
  );
}
