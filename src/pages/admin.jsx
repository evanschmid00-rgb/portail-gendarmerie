// pages/admin.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useEffect, useState } from "react";
import { Field, Select, buttonPrimary, h2Style, labelStyle, selectStyle, smallBtn } from "../composants/ui.jsx";
import { GRADES, GRADES_TAGS, QUALIFICATIONS, REGLAGES, UNITES, UNITES_PROTEGEES } from "../lib/constantes.js";
import { lienValide, newId } from "../lib/utils.js";

const ROLE_COLORS = ["#123A7A", "#C0172D", "#2F6FDE", "#2E7D4F", "#3A4D6B", "#7A3B9C", "#1A6B8C"];

export function RolesPage({ roles, onCreate, onUpdate, onDelete }) {
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
      <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 20 }}>
        Crée des rôles réutilisables (comme sur Discord). Applique-les ensuite depuis "Gestion du personnel" pour préremplir les droits d'un compte — les autorisations restent toujours modifiables au cas par cas.
      </div>

      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier le rôle" : "Créer un rôle"}</div>
        <Field label="Nom du rôle" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} placeholder="Ex : Négociateur Senior" />
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Couleur</label>
          <div style={{ display: "flex", gap: 8 }}>
            {ROLE_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, couleur: c })} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: form.couleur === c ? "3px solid #14213A" : "1px solid #C3D0E2", cursor: "pointer" }} />
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
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#123A7A", border: "1px solid #123A7A" }}>Annuler</button>}
        </div>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {roles.map((r) => (
          <div key={r.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: r.couleur || "#5A6B84", display: "inline-block" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{r.nom}</div>
                <div style={{ fontSize: 11, color: "#5A6B84" }}>{r.isAdmin ? "Administrateur — " : ""}{(r.qualifications || []).join(", ") || "Aucune autorisation particulière"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => startEdit(r)} style={smallBtn}>Modifier</button>
              <button onClick={() => onDelete(r.id)} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Suppr.</button>
            </div>
          </div>
        ))}
        {roles.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun rôle créé pour l'instant.</div>}
      </div>
    </div>
  );
}

export function AdminPanel({ personnel, roles, onCreate, onDelete, onUpdate, onAssignRIO }) {
  const blank = { matricule: "", nom: "", prenom: "", pseudoRoblox: "", pseudoDiscord: "", grade: GRADES[0], unite: UNITES[0], fonction: "", qualifications: [], isAdmin: false, qualiteJudiciaire: "APJA", cipcNumero: "", discordId: "" };
  const vide = { prenom: "", nom: "", username: "", password: "", grade: GRADES[0], unite: UNITES[0], fonction: "", qualiteJudiciaire: "APJA" };
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
    const data = { ...reste, gradeRank: GRADES.indexOf(form.grade) };
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
    setForm({ matricule: p.matricule || "", nom: p.nom || "", prenom: p.prenom || "", pseudoRoblox: p.pseudoRoblox || "", robloxVerifie: !!p.robloxVerifie, delierRoblox: false, pseudoDiscord: p.pseudoDiscord || "", grade: GRADES.includes(p.grade) ? p.grade : GRADES[0], unite: UNITES.includes(p.unite) ? p.unite : UNITES[0], fonction: p.fonction || "", qualifications: p.qualifications || [], isAdmin: !!p.isAdmin, qualiteJudiciaire: p.qualiteJudiciaire || "APJA", cipcNumero: p.cipcNumero || "", discordId: p.discordId || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            <Select label="Grade" value={form.grade} onChange={(v) => setForm({ ...form, grade: v })} options={GRADES} />
            <Select label="Unité" value={form.unite} onChange={(v) => setForm({ ...form, unite: v })} options={UNITES} />
            <Select label="Qualité judiciaire (carte)" value={form.qualiteJudiciaire} onChange={(v) => setForm({ ...form, qualiteJudiciaire: v })} options={["OPJ", "APJ", "APJA"]} />
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

export function LiensUtilesAdmin({ lienDiscord, lienZello, onSave }) {
  const [discord, setDiscord] = useState(lienDiscord || "");
  const [zello, setZello] = useState(lienZello || "");
  const [etat, setEtat] = useState("");
  useEffect(() => { setDiscord(lienDiscord || ""); setZello(lienZello || ""); }, [lienDiscord, lienZello]);
  const inp = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, marginBottom: 14 };

  async function enregistrer(e) {
    e.preventDefault();
    const d = discord.trim() ? lienValide(discord) : "";
    const z = zello.trim() ? lienValide(zello, true) : "";
    if (discord.trim() && !d) { setEtat("Le lien Discord doit commencer par https://"); return; }
    if (zello.trim() && !z) { setEtat("Le lien Zello doit commencer par https:// (ou zello://)"); return; }
    setEtat("Enregistrement…");
    const ok = await onSave({ discord: d, zello: z });
    setEtat(ok ? "Liens enregistrés." : "Échec de l'enregistrement.");
  }
  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={h2Style}>Liens utiles</h2>
      <form onSubmit={enregistrer} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
        <label style={labelStyle}>💬 Lien d'invitation du serveur Discord</label>
        <input value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="https://discord.gg/..." style={inp} />
        <div style={{ fontSize: 12, color: "#5A6B84", margin: "-8px 0 16px" }}>Affiché sur l'accueil public (bouton « Rejoindre le Discord ») et dans le menu des gendarmes.</div>
        <label style={labelStyle}>🎧 Lien de la radio Zello</label>
        <input value={zello} onChange={(e) => setZello(e.target.value)} placeholder="https://zello.com/channels/..." style={inp} />
        <div style={{ fontSize: 12, color: "#5A6B84", margin: "-8px 0 16px" }}>🔒 Visible uniquement par les gendarmes connectés, en permanence dans le menu de gauche. Laisse vide pour masquer un lien.</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 22px", marginTop: 0 }}>Enregistrer</button>
          {etat && <span style={{ fontSize: 12.5, fontWeight: 600, color: etat.startsWith("Liens") ? "#1F6B42" : etat.startsWith("Enreg") ? "#5A6B84" : "#C0172D" }}>{etat}</span>}
        </div>
      </form>
    </div>
  );
}

export function GradesUnitesAdmin({ personnel, onSave }) {
  const [grades, setGrades] = useState(() => GRADES.map((nom, i) => ({ key: newId(), nom, tag: GRADES_TAGS[i] || "", ancien: nom })));
  const [unites, setUnites] = useState(() => UNITES.map((nom) => ({ key: newId(), nom, ancien: nom })));
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
    const manquante = UNITES_PROTEGEES.find((n) => !un.some((u) => u.nom === n && u.ancien === n));
    if (manquante) { setMsg(`L'unité « ${manquante} » ne peut être ni renommée ni supprimée (des accès en dépendent).`); return; }

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
        {seuilRow("seuilCandOfficier", "Le grade qui peut postuler Officier est")}
        {seuilRow("seuilHaut", "Haut grade (sanctions, promotions) à partir de")}
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Unités</div>
        {unites.map((u, i) => {
          const protegee = UNITES_PROTEGEES.includes(u.ancien);
          return (
            <div key={u.key} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <input value={u.nom} disabled={protegee} onChange={(e) => setUnites(unites.map((x, k) => (k === i ? { ...x, nom: e.target.value } : x)))} placeholder="Nom de l'unité" style={{ ...inp, flex: 1, background: protegee ? "#E6EDF7" : "#fff" }} />
              <button type="button" style={btn} onClick={() => setUnites(bouger(unites, i, -1))}>↑</button>
              <button type="button" style={btn} onClick={() => setUnites(bouger(unites, i, 1))}>↓</button>
              {protegee ? <span style={{ fontSize: 11, color: "#5A6B84", width: 34, textAlign: "center" }}>🔒</span> : <button type="button" style={{ ...btn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => setUnites(unites.filter((_, k) => k !== i))}>✕</button>}
            </div>
          );
        })}
        <button type="button" style={{ ...smallBtn, marginTop: 6 }} onClick={() => setUnites([...unites, { key: newId(), nom: "", ancien: "" }])}>+ Ajouter une unité</button>
        <div style={{ fontSize: 11, color: "#5A6B84", marginTop: 8 }}>🔒 Le Corps de Commandement et le Corps d'Encadrement sont protégés : des accès du site en dépendent.</div>
      </div>

      {msg && <div style={{ color: ok ? "#2E7D4F" : "#C0172D", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      <button className="gh-btn-anim" disabled={busy} onClick={enregistrer} style={{ ...buttonPrimary, width: "auto", padding: "10px 22px", marginTop: 0 }}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
    </div>
  );
}

export function NotesServicePanel({ current, notesService, onCreate, onDelete }) {
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
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
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
          <div key={n.id} style={{ background: "#EEF4FF", border: "1px solid #C9D8F0", borderLeft: "4px solid #2F6FDE", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>📌 {n.titre}</div>
              {current.isAdmin && <button onClick={() => onDelete(n.id)} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Retirer</button>}
            </div>
            <div style={{ fontSize: 13, color: "#3A4D6B", marginTop: 6, whiteSpace: "pre-wrap" }}>{n.contenu}</div>
            <div style={{ fontSize: 11, color: "#5A6B84", marginTop: 8 }}>{n.auteurNom} — {new Date(n.createdAt).toLocaleDateString("fr-FR")}</div>
          </div>
        ))}
        {notesService.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune note de service pour l'instant.</div>}
      </div>
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
