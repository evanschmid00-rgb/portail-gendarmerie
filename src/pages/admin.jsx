// pages/admin.jsx — rôles et permissions, gestion du personnel, liens utiles, grades et unités, recrutement
import React, { useEffect, useState } from "react";
import { Field, Select, buttonPrimary, h2Style, labelStyle, selectStyle, smallBtn } from "../composants/ui.jsx";
import { GRADES, GRADES_TAGS, REGLAGES, UNITES, UNITES_COMMANDEMENT, UNITES_ENCADREMENT } from "../lib/constantes.js";
import { CATEGORIES_DROITS, TOUS_LES_DROITS } from "../lib/droits.js";
import { DROIT_SAISIE_JUSTICE, calculerDroits, lienValide, newId } from "../lib/utils.js";


const COULEURS_ROLE = ["#123A7A", "#2F6FDE", "#1A6B8C", "#2E7D4F", "#7A9B2E", "#E0A23A", "#E8830C", "#C0172D", "#B0132A", "#7A3B9C", "#C2417C", "#3A4D6B"];
const FONT_ROLES = "'Inter', 'Segoe UI', system-ui, sans-serif";

export function RolesPage({ roles, personnel = [], postesCandidature = [], onCreate, onUpdate, onDelete }) {
  // candidaturesSelection : le rôle ne gère que certaines candidatures (liste candidaturesPostes) ; sinon il les gère toutes
  const vide = { nom: "", description: "", couleur: COULEURS_ROLE[0], isAdmin: false, qualifications: [], candidaturesSelection: false, candidaturesPostes: [] };
  const [form, setForm] = useState(vide);
  const [editingId, setEditingId] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const [rechercheRole, setRechercheRole] = useState("");
  const [rechercheDroit, setRechercheDroit] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const membresDe = (r) => personnel.filter((p) => (p.roles || []).includes(r.id));
  const q = rechercheRole.trim().toLowerCase();
  const liste = roles.filter((r) => !q || `${r.nom} ${r.description || ""}`.toLowerCase().includes(q)).sort((a, b) => Number(!!b.isAdmin) - Number(!!a.isAdmin) || String(a.nom).localeCompare(String(b.nom)));

  const nouveau = () => { setEditingId(null); setForm(vide); setRechercheDroit(""); setMsg(""); setOuvert(true); };
  const modifier = (r) => { setEditingId(r.id); setForm({ nom: r.nom || "", description: r.description || "", couleur: r.couleur || COULEURS_ROLE[0], isAdmin: !!r.isAdmin, qualifications: r.qualifications || [], candidaturesSelection: (r.candidaturesPostes || []).length > 0, candidaturesPostes: [...(r.candidaturesPostes || [])] }); setRechercheDroit(""); setMsg(""); setOuvert(true); };
  const dupliquer = (r) => { setEditingId(null); setForm({ nom: `${r.nom} (copie)`, description: r.description || "", couleur: r.couleur || COULEURS_ROLE[0], isAdmin: !!r.isAdmin, qualifications: [...(r.qualifications || [])], candidaturesSelection: (r.candidaturesPostes || []).length > 0, candidaturesPostes: [...(r.candidaturesPostes || [])] }); setRechercheDroit(""); setMsg(""); setOuvert(true); };
  const fermer = () => { setOuvert(false); setEditingId(null); setForm(vide); };
  const basculer = (nom) => setForm((f) => ({ ...f, qualifications: f.qualifications.includes(nom) ? f.qualifications.filter((x) => x !== nom) : [...f.qualifications, nom] }));
  const toutes = (cat, actif) => setForm((f) => {
    const noms = cat.droits.map((d) => d.nom);
    return { ...f, qualifications: actif ? Array.from(new Set([...f.qualifications, ...noms])) : f.qualifications.filter((x) => !noms.includes(x)) };
  });

  async function enregistrer(e) {
    e.preventDefault();
    if (!form.nom.trim()) { setMsg("Donne un nom au rôle."); return; }
    if (roles.some((r) => r.id !== editingId && String(r.nom).trim().toLowerCase() === form.nom.trim().toLowerCase())) { setMsg("Un rôle porte déjà ce nom."); return; }
    const limiteCandidatures = !form.isAdmin && form.qualifications.includes("Recruteur") && form.candidaturesSelection;
    if (limiteCandidatures && form.candidaturesPostes.length === 0) { setMsg("Choisis au moins une candidature, ou repasse sur « Toutes les candidatures »."); return; }
    setBusy(true);
    const data = { nom: form.nom.trim(), description: form.description.trim(), couleur: form.couleur, isAdmin: !!form.isAdmin, qualifications: form.qualifications, candidaturesPostes: limiteCandidatures ? form.candidaturesPostes : [] };
    if (editingId) await onUpdate(editingId, data); else await onCreate(data);
    setBusy(false);
    setMsg(`✓ Rôle « ${data.nom} » enregistré.`);
    fermer();
  }
  async function supprimer(r) {
    const nb = membresDe(r).length;
    if (!window.confirm(`Supprimer le rôle « ${r.nom} » ?${nb ? `\n\n${nb} personne(s) le perdront, avec les droits qu'il donnait.` : ""}`)) return;
    await onDelete(r.id);
  }

  const dq = rechercheDroit.trim().toLowerCase();
  const nbAdmins = roles.filter((r) => r.isAdmin).length;
  const champ = { width: "100%", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: FONT_ROLES, background: "#fff" };
  const membresEdition = editingId ? personnel.filter((p) => (p.roles || []).includes(editingId)) : [];

  return (
    <div style={{ fontFamily: FONT_ROLES, maxWidth: 1000 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <h2 style={{ ...h2Style, marginBottom: 0 }}>Rôles & Permissions</h2>
        <button type="button" onClick={nouveau} style={{ background: "#123A7A", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: FONT_ROLES }}>+ Nouveau rôle</button>
      </div>
      <div style={{ fontSize: 12.5, color: "#5A6B84", margin: "6px 0 16px", lineHeight: 1.55 }}>
        Crée des rôles réutilisables (comme sur Discord). Une personne peut en avoir plusieurs : ses droits sont la somme de tous ses rôles. Attribue-les depuis « Gestion du personnel » ; si tu modifies un rôle, tous ceux qui l'ont sont mis à jour.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[["Rôles", roles.length, "#123A7A"], ["Rôles administrateur", nbAdmins, "#C0172D"], ["Personnes avec un rôle", personnel.filter((p) => (p.roles || []).length > 0).length, "#2E7D4F"]].map(([l, v, c]) => (
          <div key={l} style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 12, padding: "10px 14px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
            <div style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>{l}</div>
          </div>
        ))}
      </div>

      {msg && !ouvert && <div style={{ background: "#E3F2E8", border: "1px solid #2E7D4F", color: "#1F6B42", borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{msg}</div>}
      <input value={rechercheRole} onChange={(e) => setRechercheRole(e.target.value)} placeholder="🔎 Rechercher un rôle" style={{ ...champ, maxWidth: 360, marginBottom: 14 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, alignItems: "start" }}>
        {liste.map((r) => {
          const membres = membresDe(r);
          const droits = r.qualifications || [];
          return (
            <div key={r.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `5px solid ${r.couleur || "#5A6B84"}`, borderRadius: 14, padding: "14px 16px", boxShadow: "0 6px 20px -14px rgba(7,20,46,0.4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: r.couleur || "#5A6B84", flexShrink: 0 }} />
                <div style={{ fontWeight: 800, fontSize: 15.5, color: "#14213A" }}>{r.nom}</div>
                {r.isAdmin && <span style={{ background: "#FBE3E7", color: "#8A1020", border: "1px solid #C0172D", borderRadius: 999, padding: "0 8px", fontSize: 10.5, fontWeight: 800 }}>ADMIN</span>}
              </div>
              {r.description && <div style={{ fontSize: 12.5, color: "#5A6B84", margin: "6px 0 0", lineHeight: 1.45 }}>{r.description}</div>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, margin: "10px 0" }}>
                {r.isAdmin && <span style={{ background: "#F5F8FC", color: "#8A1020", borderRadius: 999, padding: "1px 9px", fontSize: 11.5, fontWeight: 700 }}>Accès complet</span>}
                {droits.slice(0, 4).map((d) => <span key={d} style={{ background: "#ECEEFE", color: "#3B45B5", borderRadius: 999, padding: "1px 9px", fontSize: 11.5, fontWeight: 700 }}>{d}</span>)}
                {droits.length > 4 && <span style={{ background: "#EEF2F8", color: "#5A6B84", borderRadius: 999, padding: "1px 9px", fontSize: 11.5, fontWeight: 700 }}>+{droits.length - 4}</span>}
                {!r.isAdmin && droits.includes("Recruteur") && (r.candidaturesPostes || []).length > 0 && <span title={(r.candidaturesPostes || []).join(", ")} style={{ background: "#FFF1DC", color: "#8A5A00", borderRadius: 999, padding: "1px 9px", fontSize: 11.5, fontWeight: 700 }}>📋 {r.candidaturesPostes.length} candidature{r.candidaturesPostes.length > 1 ? "s" : ""}</span>}
                {!r.isAdmin && droits.length === 0 && <span style={{ color: "#9AA8BD", fontSize: 12 }}>Aucun droit particulier</span>}
              </div>
              <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 10 }}>👥 {membres.length} personne{membres.length > 1 ? "s" : ""}{membres.length > 0 ? ` : ${membres.slice(0, 3).map((p) => `${p.prenom} ${p.nom}`).join(", ")}${membres.length > 3 ? "…" : ""}` : ""}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" onClick={() => modifier(r)} style={{ ...smallBtn, background: "#E6EDF7", fontWeight: 700 }}>Modifier</button>
                <button type="button" onClick={() => dupliquer(r)} style={smallBtn}>Dupliquer</button>
                <button type="button" onClick={() => supprimer(r)} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Suppr.</button>
              </div>
            </div>
          );
        })}
        {roles.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18 }}>Aucun rôle créé pour l'instant. Clique sur « Nouveau rôle ».</div>}
      </div>

      {ouvert && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", justifyContent: "flex-end", background: "rgba(7,20,46,0.55)" }} onClick={fermer}>
          <form onSubmit={enregistrer} onClick={(e) => e.stopPropagation()} style={{ width: "min(580px, 100%)", height: "100%", background: "#F3F6FB", overflowY: "auto", boxShadow: "-12px 0 40px rgba(0,0,0,0.35)" }}>
            <div style={{ position: "sticky", top: 0, zIndex: 2, background: form.couleur, color: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>{form.nom || (editingId ? "Modifier le rôle" : "Nouveau rôle")}</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>{editingId ? "Modification du rôle" : "Création d'un rôle"}{form.isAdmin ? " · Administrateur" : ""}</div>
              </div>
              <button type="button" onClick={fermer} aria-label="Fermer" style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, width: 36, height: 36, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ padding: 18 }}>
              <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 800, marginBottom: 10 }}>Identité du rôle</div>
                <label style={{ display: "block", marginBottom: 10 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 3 }}>Nom du rôle</span>
                  <input style={champ} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex : Négociateur Senior" autoFocus />
                </label>
                <label style={{ display: "block", marginBottom: 10 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 3 }}>Description (facultatif)</span>
                  <textarea style={{ ...champ, resize: "vertical" }} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="À quoi sert ce rôle ?" />
                </label>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Couleur</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {COULEURS_ROLE.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, couleur: c })} aria-label={`Couleur ${c}`} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: form.couleur === c ? "3px solid #14213A" : "1px solid #C3D0E2", cursor: "pointer" }} />
                  ))}
                  <input type="color" value={form.couleur} onChange={(e) => setForm({ ...form, couleur: e.target.value })} title="Couleur personnalisée" style={{ width: 34, height: 30, border: "none", background: "none", cursor: "pointer" }} />
                </div>
              </div>

              <div style={{ background: form.isAdmin ? "#FBE3E7" : "#fff", border: `1px solid ${form.isAdmin ? "#C0172D" : "#D3DDEA"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.isAdmin} onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })} style={{ marginTop: 3, width: 17, height: 17 }} />
                  <span>
                    <b style={{ fontSize: 13.5 }}>Administrateur (accès complet)</b>
                    <span style={{ display: "block", fontSize: 12, color: form.isAdmin ? "#8A1020" : "#5A6B84", marginTop: 3, lineHeight: 1.45 }}>
                      {form.isAdmin ? "⚠️ Les personnes ayant ce rôle peuvent tout gérer sur le site : personnel, rôles, grades, unités, questionnaires… Donne-le avec précaution. Les droits ci-dessous deviennent inutiles." : "Donne accès à toutes les pages de gestion du site. Pour un accès limité, choisis plutôt des droits précis ci-dessous."}
                    </span>
                  </span>
                </label>
              </div>

              {!form.isAdmin && (
                <div style={{ background: form.qualifications.includes("Palais de justice") ? "#FFF6DD" : "#fff", border: `1px solid ${form.qualifications.includes("Palais de justice") ? "#C9A227" : "#D3DDEA"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                    <input type="checkbox" checked={form.qualifications.includes("Palais de justice")} onChange={() => basculer("Palais de justice")} style={{ marginTop: 3, width: 17, height: 17 }} />
                    <span>
                      <b style={{ fontSize: 13.5 }}>⚖️ Membre du Palais de justice</b>
                      <span style={{ display: "block", fontSize: 12, color: "#5A6B84", marginTop: 3, lineHeight: 1.45 }}>Accès limité : procès-verbaux visés, casiers, code pénal, mandats, et les demandes et rapports des OPJ (qu'ils acceptent ou refusent). Rien d'autre du site n'est visible.</span>
                    </span>
                  </label>
                  {form.qualifications.includes("Palais de justice") && (
                    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginTop: 12, paddingTop: 12, borderTop: "1px dashed #D9C26A" }}>
                      <input type="checkbox" checked={form.qualifications.includes(DROIT_SAISIE_JUSTICE)} onChange={() => basculer(DROIT_SAISIE_JUSTICE)} style={{ marginTop: 3, width: 17, height: 17 }} />
                      <span>
                        <b style={{ fontSize: 13 }}>✍️ Autoriser aussi à enregistrer des casiers et des PV</b>
                        <span style={{ display: "block", fontSize: 12, color: "#5A6B84", marginTop: 3, lineHeight: 1.45 }}>Par défaut, le Palais de justice consulte seulement. Coche cette option pour ce rôle si ses membres doivent pouvoir saisir.</span>
                      </span>
                    </label>
                  )}
                </div>
              )}

              <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <div style={{ fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 800 }}>Droits donnés par ce rôle ({form.qualifications.length}/{TOUS_LES_DROITS.length})</div>
                  <input value={rechercheDroit} onChange={(e) => setRechercheDroit(e.target.value)} placeholder="🔎 Filtrer les droits" style={{ ...champ, width: 190, padding: "6px 9px" }} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 700 }}>Profils rapides :</span>
                  {[
                    { n: "Recruteur", d: ["Recruteur"] },
                    { n: "OPJ", d: ["OPJ"] },
                    { n: "Palais de justice", d: ["Palais de justice", DROIT_SAISIE_JUSTICE] },
                    { n: "Tout cocher", d: TOUS_LES_DROITS.map((x) => (typeof x === "string" ? x : x.nom)) },
                    { n: "Tout décocher", d: [] },
                  ].map((pr) => (
                    <button key={pr.n} type="button" onClick={() => setForm((f) => ({ ...f, qualifications: Array.from(new Set(pr.n.startsWith("Tout") ? pr.d : [...f.qualifications, ...pr.d])) }))} style={{ ...smallBtn, padding: "3px 10px", fontSize: 11.5 }}>{pr.n}</button>
                  ))}
                </div>
                {CATEGORIES_DROITS.map((cat) => {
                  const visibles = cat.droits.filter((d) => !dq || `${d.nom} ${d.aide}`.toLowerCase().includes(dq));
                  if (visibles.length === 0) return null;
                  const nbCoches = cat.droits.filter((d) => form.qualifications.includes(d.nom)).length;
                  return (
                    <div key={cat.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #E3EAF4", paddingBottom: 5, marginBottom: 6 }}>
                        <span style={{ fontSize: 17 }}>{cat.icone}</span>
                        <b style={{ fontSize: 13, flex: 1 }}>{cat.titre} <span style={{ color: "#5A6B84", fontWeight: 600 }}>· {nbCoches}/{cat.droits.length}</span></b>
                        <button type="button" onClick={() => toutes(cat, true)} style={{ ...smallBtn, padding: "2px 8px", fontSize: 11 }}>Tout</button>
                        <button type="button" onClick={() => toutes(cat, false)} style={{ ...smallBtn, padding: "2px 8px", fontSize: 11 }}>Aucun</button>
                      </div>
                      {visibles.map((d) => {
                        const coche = form.qualifications.includes(d.nom);
                        return (
                          <label key={d.nom} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: "7px 9px", borderRadius: 8, background: coche ? "#ECEEFE" : "transparent", marginBottom: 2 }}>
                            <input type="checkbox" checked={coche} onChange={() => basculer(d.nom)} style={{ marginTop: 3 }} />
                            <span><b style={{ fontSize: 13 }}>{d.nom}</b><span style={{ display: "block", fontSize: 11.5, color: "#5A6B84", lineHeight: 1.4 }}>{d.aide}</span></span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {!form.isAdmin && form.qualifications.includes("Recruteur") && (() => {
                const choix = Array.from(new Set([...postesCandidature, ...form.candidaturesPostes])).sort((a, b) => String(a).localeCompare(String(b), "fr"));
                const basculerPoste = (p) => setForm((f) => ({ ...f, candidaturesPostes: f.candidaturesPostes.includes(p) ? f.candidaturesPostes.filter((x) => x !== p) : [...f.candidaturesPostes, p] }));
                const ligne = { display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: "7px 9px", borderRadius: 8, marginBottom: 2 };
                return (
                  <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                    <div style={{ fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 800, marginBottom: 6 }}>📋 Candidatures gérées par ce rôle</div>
                    <div style={{ fontSize: 12, color: "#5A6B84", lineHeight: 1.5, marginBottom: 10 }}>Le droit « Recruteur » donne accès aux candidatures. Choisis si ce rôle les gère toutes ou seulement certaines.</div>
                    <label style={{ ...ligne, background: !form.candidaturesSelection ? "#ECEEFE" : "transparent" }}>
                      <input type="radio" name="portee-candidatures" checked={!form.candidaturesSelection} onChange={() => setForm({ ...form, candidaturesSelection: false })} style={{ marginTop: 3 }} />
                      <span><b style={{ fontSize: 13 }}>Toutes les candidatures</b><span style={{ display: "block", fontSize: 11.5, color: "#5A6B84" }}>Y compris les questionnaires créés plus tard.</span></span>
                    </label>
                    <label style={{ ...ligne, background: form.candidaturesSelection ? "#ECEEFE" : "transparent" }}>
                      <input type="radio" name="portee-candidatures" checked={form.candidaturesSelection} onChange={() => setForm({ ...form, candidaturesSelection: true })} style={{ marginTop: 3 }} />
                      <span><b style={{ fontSize: 13 }}>Seulement certaines candidatures</b><span style={{ display: "block", fontSize: 11.5, color: "#5A6B84" }}>Coche celles que ce rôle peut lire, accepter ou refuser.</span></span>
                    </label>
                    {form.candidaturesSelection && (
                      <div style={{ margin: "8px 0 0 26px", borderLeft: "3px solid #C9CEF7", paddingLeft: 10 }}>
                        {choix.map((p) => (
                          <label key={p} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", padding: "4px 0", fontSize: 13 }}>
                            <input type="checkbox" checked={form.candidaturesPostes.includes(p)} onChange={() => basculerPoste(p)} /> {p}
                            {!postesCandidature.includes(p) && <span style={{ fontSize: 11, color: "#B25E00" }}>(n'existe plus dans les questionnaires)</span>}
                          </label>
                        ))}
                        {choix.length === 0 && <div style={{ fontSize: 12.5, color: "#5A6B84" }}>Aucun questionnaire de candidature pour l'instant.</div>}
                      </div>
                    )}
                    <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 8, lineHeight: 1.5 }}>Une personne qui cumule plusieurs rôles gère l'ensemble des candidatures de ses rôles. Le droit « Recruteur » coché directement sur la personne (hors rôle) lui donne toutes les candidatures.</div>
                  </div>
                );
              })()}

              {editingId && (
                <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.5 }}>
                  👥 <b>{membresEdition.length} personne{membresEdition.length > 1 ? "s" : ""}</b> ont ce rôle{membresEdition.length ? " : " + membresEdition.map((p) => `${p.prenom} ${p.nom}`).join(", ") : ""}.
                  <br />Leurs droits seront mis à jour à l'enregistrement.
                </div>
              )}

              {msg && <div style={{ background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "9px 12px", fontSize: 13, marginBottom: 12 }}>{msg}</div>}
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <button type="submit" disabled={busy} style={{ background: "#123A7A", color: "#fff", border: "none", borderRadius: 10, padding: "12px 22px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: FONT_ROLES, opacity: busy ? 0.7 : 1 }}>{busy ? "Enregistrement…" : editingId ? "Enregistrer le rôle" : "Créer le rôle"}</button>
                <button type="button" onClick={fermer} style={{ ...smallBtn, padding: "11px 16px" }}>Annuler</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function AdminPanel({ personnel, roles, onCreate, onDelete, onUpdate, onAssignRIO }) {
  const blank = { matricule: "", nom: "", prenom: "", pseudoRoblox: "", pseudoDiscord: "", grade: GRADES[0], unite: UNITES[0], fonction: "", sousFonction: "", qualifications: [], isAdmin: false, roles: [], qualifsManuelles: [], adminManuel: false, qualiteJudiciaire: "APJA", cipcNumero: "", discordId: "" };
  const vide = { prenom: "", nom: "", username: "", password: "", grade: GRADES[0], unite: UNITES[0], fonction: "", sousFonction: "", qualiteJudiciaire: "APJA" };
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
    // Droits effectifs = tous les rôles choisis + ajouts manuels (stockés dans qualifications / isAdmin, lus par les règles Firebase)
    const droits = calculerDroits(form.roles, roles, form.qualifsManuelles, form.adminManuel);
    const data = { ...reste, gradeRank: GRADES.indexOf(form.grade), roles: form.roles || [], qualifsManuelles: form.qualifsManuelles || [], adminManuel: !!form.adminManuel, qualifications: droits.qualifications, isAdmin: droits.isAdmin };
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
    setForm({ matricule: p.matricule || "", nom: p.nom || "", prenom: p.prenom || "", pseudoRoblox: p.pseudoRoblox || "", robloxVerifie: !!p.robloxVerifie, delierRoblox: false, pseudoDiscord: p.pseudoDiscord || "", grade: GRADES.includes(p.grade) ? p.grade : GRADES[0], unite: UNITES.includes(p.unite) ? p.unite : UNITES[0], fonction: p.fonction || "", sousFonction: p.sousFonction || "", qualifications: p.qualifications || [], isAdmin: !!p.isAdmin, qualiteJudiciaire: p.qualiteJudiciaire || "APJA", cipcNumero: p.cipcNumero || "", discordId: p.discordId || "" , roles: Array.isArray(p.roles) ? p.roles : [], qualifsManuelles: Array.isArray(p.qualifsManuelles) ? p.qualifsManuelles : (p.qualifications || []), adminManuel: p.adminManuel !== undefined ? !!p.adminManuel : !!p.isAdmin });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function toggleQualification(q) {
    setForm((f) => ({ ...f, qualifsManuelles: f.qualifsManuelles.includes(q) ? f.qualifsManuelles.filter((x) => x !== q) : [...f.qualifsManuelles, q] }));
  }
  function toggleRole(roleId) {
    setForm((f) => ({ ...f, roles: f.roles.includes(roleId) ? f.roles.filter((x) => x !== roleId) : [...f.roles, roleId] }));
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
            <Field label="Sous-fonction" value={nouveau.sousFonction} onChange={(v) => setNouveau({ ...nouveau, sousFonction: v })} />
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
            <Field label="Sous-fonction" value={form.sousFonction} onChange={(v) => setForm({ ...form, sousFonction: v })} />
            <Select label="Grade" value={form.grade} onChange={(v) => setForm({ ...form, grade: v })} options={GRADES} />
            <Select label="Unité" value={form.unite} onChange={(v) => setForm({ ...form, unite: v })} options={UNITES} />
            <Select label="Qualité judiciaire (carte)" value={form.qualiteJudiciaire} onChange={(v) => setForm({ ...form, qualiteJudiciaire: v })} options={["OPJ", "APJ", "APJA"]} />
          </div>
          {roles.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Rôles ({form.roles.length} attribué{form.roles.length > 1 ? "s" : ""}) — plusieurs possibles</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {roles.map((r) => {
                  const actif = form.roles.includes(r.id);
                  return (
                    <button type="button" key={r.id} onClick={() => toggleRole(r.id)} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1.5px solid ${r.couleur || "#5A6B84"}`, background: actif ? (r.couleur || "#5A6B84") : "#fff", color: actif ? "#fff" : "#14213A", borderRadius: 20, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: actif ? "#fff" : (r.couleur || "#5A6B84") }} />
                      {actif ? "✓ " : ""}{r.nom}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {(() => {
            const droits = calculerDroits(form.roles, roles, form.qualifsManuelles, form.adminManuel);
            const viaRole = (q) => roles.filter((r) => form.roles.includes(r.id) && (r.qualifications || []).includes(q)).map((r) => r.nom);
            const adminViaRole = roles.filter((r) => form.roles.includes(r.id) && r.isAdmin).map((r) => r.nom);
            return (
              <>
                <div style={{ margin: "4px 0 14px" }}>
                  <label style={labelStyle}>Qualifications (celles des rôles sont cochées automatiquement)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {TOUS_LES_DROITS.map((q) => {
                      const via = viaRole(q);
                      return (
                        <label key={q} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, opacity: via.length ? 0.85 : 1 }} title={via.length ? `Donnée par : ${via.join(", ")}` : ""}>
                          <input type="checkbox" checked={via.length > 0 || form.qualifsManuelles.includes(q)} disabled={via.length > 0} onChange={() => toggleQualification(q)} /> {q}{via.length > 0 ? " (rôle)" : ""}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={adminViaRole.length > 0 || !!form.adminManuel} disabled={adminViaRole.length > 0} onChange={(e) => setForm({ ...form, adminManuel: e.target.checked })} /> Administrateur{adminViaRole.length > 0 ? ` (via le rôle ${adminViaRole.join(", ")})` : ""}
                  </label>
                </div>
                <div style={{ fontSize: 12, color: "#3A4D6B", background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 8, padding: "8px 11px", marginBottom: 14 }}>
                  <b>Droits effectifs :</b> {droits.isAdmin ? "Administrateur" : "—"}{droits.qualifications.length ? ` · ${droits.qualifications.join(", ")}` : droits.isAdmin ? "" : " aucune autorisation particulière"}
                </div>
              </>
            );
          })()}
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
              {(p.roles || []).length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                  {(p.roles || []).map((id) => roles.find((r) => r.id === id)).filter(Boolean).map((r) => <span key={r.id} style={{ background: r.couleur || "#5A6B84", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 12, padding: "2px 9px" }}>{r.nom}</span>)}
                </div>
              )}
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

export function LiensUtilesAdmin({ lienDiscord, lienRoblox, lienJustice, onSave }) {
  const [discord, setDiscord] = useState(lienDiscord || "");
  const [roblox, setRoblox] = useState(lienRoblox || "");
  const [justice, setJustice] = useState(lienJustice || "");
  const [etat, setEtat] = useState("");
  useEffect(() => { setDiscord(lienDiscord || ""); setRoblox(lienRoblox || ""); setJustice(lienJustice || ""); }, [lienDiscord, lienRoblox, lienJustice]);
  const inp = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, marginBottom: 14 };

  async function enregistrer(e) {
    e.preventDefault();
    const d = discord.trim() ? lienValide(discord) : "";
    const z = roblox.trim() ? lienValide(roblox) : "";
    if (discord.trim() && !d) { setEtat("Le lien Discord doit commencer par https://"); return; }
    if (roblox.trim() && !z) { setEtat("Le lien de la communauté Roblox doit commencer par https://"); return; }
    const j = justice.trim() ? lienValide(justice) : "";
    if (justice.trim() && !j) { setEtat("Le lien du Palais de justice doit commencer par https://"); return; }
    setEtat("Enregistrement…");
    const ok = await onSave({ discord: d, roblox: z, justice: j });
    setEtat(ok ? "Liens enregistrés." : "Échec de l'enregistrement.");
  }
  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={h2Style}>Liens utiles</h2>
      <form onSubmit={enregistrer} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
        <label style={labelStyle}>💬 Lien d'invitation du serveur Discord</label>
        <input value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="https://discord.gg/..." style={inp} />
        <div style={{ fontSize: 12, color: "#5A6B84", margin: "-8px 0 16px" }}>Affiché sur l'accueil public (bouton « Rejoindre le Discord ») et dans le menu des gendarmes.</div>
        <label style={labelStyle}>🎮 Lien de la communauté Roblox</label>
        <input value={roblox} onChange={(e) => setRoblox(e.target.value)} placeholder="https://www.roblox.com/communities/..." style={inp} />
        <div style={{ fontSize: 12, color: "#5A6B84", margin: "-8px 0 16px" }}>🔒 Visible uniquement par les gendarmes connectés, en permanence dans le menu de gauche. Laisse vide pour masquer un lien.</div>
        <label style={labelStyle}>⚖️ Lien du Palais de justice</label>
        <input value={justice} onChange={(e) => setJustice(e.target.value)} placeholder="https://discord.gg/... ou lien du groupe Roblox" style={inp} />
        <div style={{ fontSize: 12, color: "#5A6B84", margin: "-8px 0 16px" }}>Affiché sur l'accueil public (bandeau « Palais de justice ») et dans le menu des gendarmes et du Palais de justice.</div>
        <label style={labelStyle}>📖 Lien direct vers le code pénal (à coller dans Discord)</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/?page=code-penal`} onFocus={(e) => e.target.select()} style={{ ...inp, marginBottom: 0 }} />
          <button type="button" onClick={() => { try { navigator.clipboard.writeText(`${window.location.origin}/?page=code-penal`); setEtat("Lien du code pénal copié."); } catch (err) { setEtat("Sélectionne le lien et copie-le (Ctrl+C)."); } }} style={{ ...smallBtn, whiteSpace: "nowrap" }}>Copier</button>
        </div>
        <div style={{ fontSize: 12, color: "#5A6B84", margin: "0 0 16px" }}>Ouvre directement la page publique du code pénal, sans compte.</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 22px", marginTop: 0 }}>Enregistrer</button>
          {etat && <span style={{ fontSize: 12.5, fontWeight: 600, color: etat.startsWith("Lien") ? "#1F6B42" : etat.startsWith("Enreg") ? "#5A6B84" : "#C0172D" }}>{etat}</span>}
        </div>
      </form>
    </div>
  );
}

export function GradesUnitesAdmin({ personnel, onSave }) {
  const [grades, setGrades] = useState(() => GRADES.map((nom, i) => ({ key: newId(), nom, tag: GRADES_TAGS[i] || "", ancien: nom })));
  const [unites, setUnites] = useState(() => UNITES.map((nom) => ({ key: newId(), nom, ancien: nom, cmd: UNITES_COMMANDEMENT.includes(nom), enc: UNITES_ENCADREMENT.includes(nom) })));
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
      unitesCommandement: un.filter((u) => u.cmd).map((u) => u.nom), unitesEncadrement: un.filter((u) => u.enc).map((u) => u.nom),
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
        {seuilRow("seuilHaut", "Haut grade (sanctions, promotions) à partir de")}
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Unités</div>
        <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 12, lineHeight: 1.5 }}>
          Toutes les unités peuvent être renommées, déplacées, créées ou supprimées (une unité qui a encore des agents ne peut pas être supprimée). Coche les droits de chaque unité : ils ne dépendent plus de son nom.
        </div>
        {unites.map((u, i) => {
          const membres = personnel.filter((p) => p.unite === u.ancien || p.unite === u.nom).length;
          const majU = (patch) => setUnites(unites.map((x, k) => (k === i ? { ...x, ...patch } : x)));
          return (
            <div key={u.key} style={{ border: "1px solid #E3EAF4", borderLeft: `4px solid ${u.cmd ? "#123A7A" : u.enc ? "#2F6FDE" : "#C3D0E2"}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, background: "#F9FBFE" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input value={u.nom} onChange={(e) => majU({ nom: e.target.value })} placeholder="Nom de l'unité" style={{ ...inp, flex: 1, minWidth: 180 }} />
                <span style={{ fontSize: 11.5, color: "#5A6B84", whiteSpace: "nowrap" }}>👥 {membres}</span>
                <button type="button" style={btn} onClick={() => setUnites(bouger(unites, i, -1))}>↑</button>
                <button type="button" style={btn} onClick={() => setUnites(bouger(unites, i, 1))}>↓</button>
                <button type="button" style={{ ...btn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => setUnites(unites.filter((_, k) => k !== i))}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={!!u.cmd} onChange={(e) => majU({ cmd: e.target.checked })} /> <b>Droits du commandement</b></label>
                <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={!!u.enc} onChange={(e) => majU({ enc: e.target.checked })} /> <b>Droits d'encadrement</b></label>
              </div>
            </div>
          );
        })}
        <button type="button" style={{ ...smallBtn, marginTop: 6 }} onClick={() => setUnites([...unites, { key: newId(), nom: "", ancien: "", cmd: false, enc: false }])}>+ Ajouter une unité</button>
        <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 12, lineHeight: 1.6, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 8, padding: "9px 12px" }}>
          <b>Droits du commandement</b> : annonces, plan Vigipirate, habilitations, rapports internes, comptes rendus, équipement et tenue.<br />
          <b>Droits d'encadrement</b> : signalements et comptes rendus destinés à l'encadrement.<br />
          Les administrateurs ont toujours tous les droits, quelle que soit leur unité.
        </div>
      </div>

      {msg && <div style={{ color: ok ? "#2E7D4F" : "#C0172D", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      <button className="gh-btn-anim" disabled={busy} onClick={enregistrer} style={{ ...buttonPrimary, width: "auto", padding: "10px 22px", marginTop: 0 }}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
    </div>
  );
}

export function RecrutementPanel({ recrutementOuvert, onToggle }) {
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
