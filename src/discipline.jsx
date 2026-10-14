// pages/discipline.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useEffect, useState } from "react";
import { Field, buttonPrimary, h2Style, labelStyle, selectStyle, smallBtn } from "../composants/ui.jsx";
import { DISCIPLINE_MIN_INDEX, FONT_TITRE, GRADES } from "../lib/constantes.js";
import { useNow } from "../lib/utils.js";

/* ---------- Sanctions disciplinaires ---------- */

const SANCTION_TYPES = [
  { type: "Mise en garde", defaultDuree: 3, couleur: "#B7791F", fond: "#FFF6E0", gravite: 1 },
  { type: "Avertissement 1", defaultDuree: 7, couleur: "#B25E00", fond: "#FFEBD6", gravite: 2 },
  { type: "Avertissement 2", defaultDuree: 14, couleur: "#D1471F", fond: "#FDE3DA", gravite: 3 },
  { type: "Mise à pied", defaultDuree: 7, couleur: "#8A1020", fond: "#F8DADF", gravite: 4 },
];
const styleSanction = (type) => SANCTION_TYPES.find((t) => t.type === type) || { couleur: "#C0172D", fond: "#FDECEC", gravite: 1 };
const sanctionActive = (s, maintenant) => !s.levee && new Date(s.dateFin) > maintenant;
const dateHeureSanction = (iso) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
function fmtRestantSanction(ms) {
  if (ms <= 0) return "terminée";
  const m = Math.floor(ms / 60000);
  const j = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (j > 0) return `${j} j ${h} h`;
  if (h > 0) return `${h} h ${mm} min`;
  return `${Math.max(1, mm)} min`;
}

// Carte d'une sanction : le motif est toujours visible (utilisée par les chefs et par le gendarme concerné)
function CarteSanction({ s, maintenant, voirCible, action }) {
  const st = styleSanction(s.type);
  const active = sanctionActive(s, maintenant);
  const total = new Date(s.dateFin) - new Date(s.dateDebut);
  const ecoule = Math.min(total, Math.max(0, maintenant - new Date(s.dateDebut)));
  const pct = total > 0 ? (ecoule / total) * 100 : 100;
  const couleur = active ? st.couleur : "#8FA0B8";
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${couleur}`, borderRadius: 12, padding: "14px 16px", boxShadow: active ? "0 4px 16px -10px rgba(7,20,46,0.3)" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ background: couleur, color: "#fff", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, borderRadius: 20, padding: "3px 11px" }}>{s.type}</span>
          {voirCible && <span style={{ fontWeight: 700, fontSize: 14, color: "#14213A" }}>{s.nomCible} <span style={{ fontWeight: 400, fontSize: 12, color: "#5A6B84" }}>({s.matricule})</span></span>}
          {s.levee && <span style={{ fontSize: 11, fontWeight: 700, color: "#1F6B42", background: "#E3F2E8", borderRadius: 10, padding: "2px 9px" }}>Levée</span>}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: active ? st.couleur : "#7B8AA3" }}>
          {active ? `⏳ ${fmtRestantSanction(new Date(s.dateFin) - maintenant)} restant` : s.levee ? `Levée le ${new Date(s.leveeLe).toLocaleDateString("fr-FR")}` : `Terminée le ${new Date(s.dateFin).toLocaleDateString("fr-FR")}`}
        </div>
      </div>
      <div style={{ background: active ? st.fond : "#F5F8FC", borderRadius: 8, padding: "10px 12px", marginTop: 10 }}>
        <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 3 }}>Motif</div>
        <div style={{ fontSize: 13.5, color: "#14213A", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{s.motif}</div>
      </div>
      {active && (
        <div style={{ height: 6, background: "#E6EDF7", borderRadius: 4, overflow: "hidden", marginTop: 12 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: st.couleur, borderRadius: 4 }} />
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 8, lineHeight: 1.5 }}>
        Du {dateHeureSanction(s.dateDebut)} au {dateHeureSanction(s.dateFin)} · {s.dureeJours} jour{s.dureeJours > 1 ? "s" : ""} · émise par {s.emisParNom}
        {s.levee && s.leveePar ? ` · levée par ${s.leveePar}` : ""}
      </div>
      {s.roleDiscordId && (
        <div style={{ fontSize: 11.5, marginTop: 6, color: s.statutDiscord === "erreur" ? "#8A2A2A" : "#4752C4", fontWeight: 600 }}>
          {s.statutDiscord === "erreur" ? "⚠️ Rôle Discord de sanction non attribué (à vérifier)" : active ? "🎭 Rôle Discord de sanction attribué pendant la durée de la sanction" : "🎭 Rôle Discord de sanction retiré"}
        </div>
      )}
      {action}
    </div>
  );
}

export function SanctionsPage({ current, personnel, sanctions, onIssue, onLever, sanctionRoles = {}, onSaveRoles }) {
  const rangCourant = current.gradeRank ?? GRADES.indexOf(current.grade);
  const canIssue = current.isAdmin || rangCourant >= DISCIPLINE_MIN_INDEX;
  const cibles = personnel.filter((p) => p.id !== current.id && (p.gradeRank ?? GRADES.indexOf(p.grade)) < rangCourant);
  const maintenant = new Date(useNow(60000));

  const blank = { matricule: "", type: SANCTION_TYPES[0].type, dureeJours: SANCTION_TYPES[0].defaultDuree, motif: "" };
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState("");
  const [erreur, setErreur] = useState("");
  const [recherche, setRecherche] = useState("");
  const [rolesEdit, setRolesEdit] = useState(sanctionRoles);
  const [rolesEtat, setRolesEtat] = useState("");
  useEffect(() => { setRolesEdit(sanctionRoles); }, [sanctionRoles]);

  const cible = personnel.find((p) => p.matricule === form.matricule);
  const st = styleSanction(form.type);
  const duree = Math.floor(Number(form.dureeJours));
  const finPrevue = duree > 0 ? new Date(maintenant.getTime() + duree * 86400000) : null;
  const roleConfigure = (sanctionRoles || {})[form.type];

  async function submit(e) {
    e.preventDefault();
    if (!cible) { setErreur("Choisis le personnel visé."); return; }
    if (!(duree >= 1 && duree <= 365)) { setErreur("La durée doit être comprise entre 1 et 365 jours."); return; }
    if (form.motif.trim().length < 10) { setErreur("Explique le motif en quelques mots (10 caractères minimum) : le gendarme le verra."); return; }
    setErreur("");
    const res = await onIssue({ ...form, dureeJours: duree, nomCible: `${cible.prenom} ${cible.nom}` });
    if (res.ok) { setMsg("Sanction enregistrée. Le gendarme peut consulter le motif dans « Mes sanctions »."); setForm(blank); setTimeout(() => setMsg(""), 6000); }
    else setErreur(res.error || "Échec de l'envoi.");
  }

  const q = recherche.trim().toLowerCase();
  const filtre = (s) => !q || `${s.nomCible} ${s.matricule} ${s.type} ${s.motif}`.toLowerCase().includes(q);
  const actives = sanctions.filter((s) => sanctionActive(s, maintenant) && filtre(s)).sort((a, b) => new Date(a.dateFin) - new Date(b.dateFin));
  const passees = sanctions.filter((s) => !sanctionActive(s, maintenant) && filtre(s)).sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));
  const toutesActives = sanctions.filter((s) => sanctionActive(s, maintenant));
  const sanctionnes = new Set(toutesActives.map((s) => s.matricule)).size;
  const recentes = sanctions.filter((s) => maintenant - new Date(s.dateDebut) < 30 * 86400000).length;

  const tuile = (l, v, c) => (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );

  async function enregistrerRoles() {
    const propre = {};
    Object.keys(rolesEdit).forEach((k) => { const v = String(rolesEdit[k] || "").replace(/\D/g, ""); if (v) propre[k] = v; });
    setRolesEtat("Enregistrement…");
    const ok = await onSaveRoles(propre);
    setRolesEtat(ok ? "Rôles enregistrés." : "Échec de l'enregistrement.");
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={h2Style}>Sanctions disciplinaires</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 22 }}>
        {tuile("Sanctions actives", toutesActives.length, "#C0172D")}
        {tuile("Agents sanctionnés", sanctionnes, "#B25E00")}
        {tuile("Émises ces 30 jours", recentes, "#123A7A")}
      </div>

      {canIssue && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, fontFamily: FONT_TITRE }}>Émettre une sanction</div>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Personnel visé</label>
              <select value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} style={selectStyle}>
                <option value="">— Choisir —</option>
                {cibles.map((p) => <option key={p.id} value={p.matricule}>{p.prenom} {p.nom} ({p.grade})</option>)}
              </select>
            </div>
            <label style={labelStyle}>Type de sanction</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {SANCTION_TYPES.map((t) => {
                const sel = form.type === t.type;
                return (
                  <button type="button" key={t.type} onClick={() => setForm({ ...form, type: t.type, dureeJours: t.defaultDuree })} style={{ border: `1.5px solid ${t.couleur}`, background: sel ? t.couleur : "#fff", color: sel ? "#fff" : t.couleur, borderRadius: 20, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{t.type}</button>
                );
              })}
            </div>
            <label style={labelStyle}>Durée</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
              {[1, 3, 7, 14, 30].map((j) => (
                <button type="button" key={j} onClick={() => setForm({ ...form, dureeJours: j })} style={{ ...smallBtn, background: duree === j ? "#123A7A" : "transparent", color: duree === j ? "#fff" : "#14213A", borderColor: duree === j ? "#123A7A" : "#C3D0E2" }}>{j} j</button>
              ))}
              <input type="number" min="1" max="365" value={form.dureeJours} onChange={(e) => setForm({ ...form, dureeJours: e.target.value })} style={{ width: 90, padding: "7px 9px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5 }} />
              <span style={{ fontSize: 12.5, color: "#5A6B84" }}>jours</span>
            </div>
            <Field label="Motif (visible par le gendarme sanctionné)" textarea value={form.motif} onChange={(v) => setForm({ ...form, motif: v })} placeholder="Décris précisément les faits reprochés…" />
            <div style={{ fontSize: 11.5, color: form.motif.trim().length >= 10 ? "#5A6B84" : "#B25E00", margin: "-6px 0 12px" }}>{form.motif.trim().length} caractère(s) — 10 minimum</div>
            {cible && finPrevue && (
              <div style={{ background: st.fond, border: `1px solid ${st.couleur}`, borderRadius: 10, padding: "11px 14px", fontSize: 13, color: "#14213A", marginBottom: 14, lineHeight: 1.55 }}>
                <b>{form.type}</b> pour <b>{cible.prenom} {cible.nom}</b> jusqu'au <b>{dateHeureSanction(finPrevue.toISOString())}</b>.
                {roleConfigure ? <><br />🎭 Le rôle Discord de cette sanction lui sera attribué, puis retiré automatiquement à la fin.</> : null}
              </div>
            )}
            {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
            {msg && <div style={{ color: "#2E7D4F", fontSize: 12.5, marginBottom: 10, fontWeight: 600 }}>{msg}</div>}
            <button type="submit" className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "10px 22px", background: "#C0172D" }}>Émettre la sanction</button>
          </form>
        </div>
      )}

      {current.isAdmin && onSaveRoles && (
        <details style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 16px", marginBottom: 22 }}>
          <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#4752C4" }}>🎭 Rôles Discord des sanctions (admin)</summary>
          <div style={{ fontSize: 12.5, color: "#5A6B84", margin: "10px 0" }}>Colle l'ID du rôle Discord pour chaque type (Discord → clic droit sur le rôle → « Copier l'ID du rôle »). Le rôle est donné au gendarme pendant la sanction uniquement, puis retiré. Laisse vide pour ne pas utiliser de rôle.</div>
          {SANCTION_TYPES.map((t) => (
            <div key={t.type} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.couleur }}>{t.type}</span>
              <input value={rolesEdit[t.type] || ""} onChange={(e) => setRolesEdit({ ...rolesEdit, [t.type]: e.target.value })} placeholder="ID du rôle Discord" style={{ padding: "8px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, fontFamily: "'Courier New', monospace" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <button type="button" onClick={enregistrerRoles} style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 0 }}>Enregistrer</button>
            {rolesEtat && <span style={{ fontSize: 12.5, color: rolesEtat.startsWith("Rôles") ? "#1F6B42" : "#5A6B84", fontWeight: 600 }}>{rolesEtat}</span>}
          </div>
        </details>
      )}

      <div style={{ marginBottom: 14, maxWidth: 360 }}>
        <Field label="Rechercher" value={recherche} onChange={setRecherche} placeholder="Nom, matricule, type, motif…" />
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8, fontWeight: 700 }}>Sanctions actives ({actives.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {actives.map((s) => (
          <CarteSanction key={s.id} s={s} maintenant={maintenant} voirCible action={current.isAdmin && onLever ? (
            <div style={{ marginTop: 10 }}><button style={smallBtn} onClick={() => { if (window.confirm(`Lever la sanction « ${s.type} » de ${s.nomCible} ? Son rôle Discord de sanction sera retiré.`)) onLever(s.id); }}>Lever la sanction</button></div>
          ) : null} />
        ))}
        {actives.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune sanction active.</div>}
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8, fontWeight: 700 }}>Historique ({passees.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {passees.map((s) => <CarteSanction key={s.id} s={s} maintenant={maintenant} voirCible />)}
        {passees.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun historique.</div>}
      </div>
    </div>
  );
}

// Visible par tous les gendarmes : leurs propres sanctions, avec le motif
export function MesSanctionsPage({ current, sanctions }) {
  const maintenant = new Date(useNow(60000));
  const miennes = sanctions.filter((s) => s.matricule === current.matricule);
  const actives = miennes.filter((s) => sanctionActive(s, maintenant)).sort((a, b) => new Date(a.dateFin) - new Date(b.dateFin));
  const passees = miennes.filter((s) => !sanctionActive(s, maintenant)).sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));
  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={h2Style}>Mes sanctions</h2>
      {actives.length === 0 ? (
        <div style={{ background: "#E3F2E8", border: "1px solid #2E7D4F", color: "#1F6B42", borderRadius: 12, padding: "16px 18px", fontSize: 14, fontWeight: 600, marginBottom: 24 }}>✅ Tu n'as aucune sanction en cours.</div>
      ) : (
        <>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#C0172D", marginBottom: 8, fontWeight: 700 }}>Sanctions en cours ({actives.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
            {actives.map((s) => <CarteSanction key={s.id} s={s} maintenant={maintenant} />)}
          </div>
        </>
      )}
      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8, fontWeight: 700 }}>Historique ({passees.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {passees.map((s) => <CarteSanction key={s.id} s={s} maintenant={maintenant} />)}
        {passees.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune sanction passée.</div>}
      </div>
      <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 18 }}>Pour contester une sanction, adresse-toi à ton commandement.</div>
    </div>
  );
}

/* ---------- Promotions / rétrogradations ---------- */

export function PromotionsPage({ current, personnel, promotions, onIssue }) {
  const canIssue = current.isAdmin || current.gradeRank >= DISCIPLINE_MIN_INDEX;
  const currentRank = current.gradeRank ?? GRADES.indexOf(current.grade);
  const cibles = personnel.filter((p) => p.id !== current.id && (p.gradeRank ?? GRADES.indexOf(p.grade)) < currentRank);
  const gradesDisponibles = GRADES.filter((g) => GRADES.indexOf(g) < currentRank);

  const [matricule, setMatricule] = useState("");
  const [nouveauGrade, setNouveauGrade] = useState("");
  const [motif, setMotif] = useState("");
  const [msg, setMsg] = useState("");
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("Tous");
  const [recherche, setRecherche] = useState("");

  const cible = personnel.find((p) => p.matricule === matricule);
  const rangCible = cible ? (cible.gradeRank ?? GRADES.indexOf(cible.grade)) : -1;
  const suivant = cible && rangCible + 1 < currentRank ? GRADES[rangCible + 1] : null;
  const precedent = cible && rangCible - 1 >= 0 ? GRADES[rangCible - 1] : null;
  const idxNouveau = nouveauGrade ? GRADES.indexOf(nouveauGrade) : -1;
  const mouvement = cible && nouveauGrade ? (idxNouveau > rangCible ? "Promotion" : idxNouveau < rangCible ? "Rétrogradation" : "") : "";

  async function submit(e) {
    e.preventDefault();
    if (!cible) { setErreur("Choisis le personnel visé."); return; }
    if (!nouveauGrade || !mouvement) { setErreur("Choisis un nouveau grade différent du grade actuel."); return; }
    if (mouvement === "Rétrogradation" && motif.trim().length < 5) { setErreur("Indique le motif de la rétrogradation."); return; }
    setErreur("");
    const res = await onIssue(cible, nouveauGrade, motif.trim());
    if (res.ok) { setMsg("Grade mis à jour (le rôle Discord est synchronisé automatiquement)."); setMatricule(""); setNouveauGrade(""); setMotif(""); setTimeout(() => setMsg(""), 6000); }
    else setErreur(res.error || "Échec de l'opération.");
  }

  const il30 = Date.now() - 30 * 86400000;
  const recents = promotions.filter((p) => new Date(p.createdAt).getTime() > il30);
  const q = recherche.trim().toLowerCase();
  const liste = promotions
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((p) => (filtre === "Tous" || p.type === filtre) && (!q || `${p.nomCible} ${p.matricule} ${p.ancienGrade} ${p.nouveauGrade} ${p.motif || ""}`.toLowerCase().includes(q)));

  const tuile = (l, v, c) => (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );
  const chipGrade = (g, c) => <span style={{ background: "#fff", border: `1px solid ${c}`, color: c, borderRadius: 14, padding: "3px 11px", fontSize: 12, fontWeight: 700 }}>{g}</span>;
  const couleurMvt = (t) => (t === "Promotion" ? "#2E7D4F" : "#C0172D");

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={h2Style}>Promotions & Rétrogradations</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 22 }}>
        {tuile("Promotions (30 jours)", recents.filter((p) => p.type === "Promotion").length, "#2E7D4F")}
        {tuile("Rétrogradations (30 jours)", recents.filter((p) => p.type !== "Promotion").length, "#C0172D")}
        {tuile("Mouvements au total", promotions.length, "#123A7A")}
      </div>

      {canIssue && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 26, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, fontFamily: FONT_TITRE }}>Changer le grade d'un subordonné</div>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Personnel visé</label>
              <select value={matricule} onChange={(e) => { setMatricule(e.target.value); setNouveauGrade(""); }} style={selectStyle}>
                <option value="">— Choisir —</option>
                {cibles.map((p) => <option key={p.id} value={p.matricule}>{p.prenom} {p.nom} ({p.grade})</option>)}
              </select>
            </div>
            {cible && (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <button type="button" disabled={!suivant} onClick={() => setNouveauGrade(suivant)} style={{ ...smallBtn, opacity: suivant ? 1 : 0.4, borderColor: "#2E7D4F", color: "#2E7D4F" }}>⬆️ Grade suivant{suivant ? ` : ${suivant}` : ""}</button>
                  <button type="button" disabled={!precedent} onClick={() => setNouveauGrade(precedent)} style={{ ...smallBtn, opacity: precedent ? 1 : 0.4, borderColor: "#C0172D", color: "#C0172D" }}>⬇️ Grade précédent{precedent ? ` : ${precedent}` : ""}</button>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Ou choisir un autre grade</label>
                  <select value={nouveauGrade} onChange={(e) => setNouveauGrade(e.target.value)} style={selectStyle}>
                    <option value="">— Choisir —</option>
                    {gradesDisponibles.filter((g) => g !== cible.grade).map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </>
            )}
            {mouvement && (
              <div style={{ background: mouvement === "Promotion" ? "#E3F2E8" : "#FDECEC", border: `1px solid ${couleurMvt(mouvement)}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: couleurMvt(mouvement), marginBottom: 8 }}>{mouvement === "Promotion" ? "⬆️ PROMOTION" : "⬇️ RÉTROGRADATION"} — {cible.prenom} {cible.nom}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {chipGrade(cible.grade, "#5A6B84")}<span style={{ fontWeight: 700 }}>→</span>{chipGrade(nouveauGrade, couleurMvt(mouvement))}
                </div>
              </div>
            )}
            <Field label={mouvement === "Rétrogradation" ? "Motif (obligatoire)" : "Motif / commentaire (facultatif)"} textarea value={motif} onChange={setMotif} placeholder={mouvement === "Rétrogradation" ? "Pourquoi cette rétrogradation ?" : "Ex : félicitations pour l'investissement…"} />
            {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
            {msg && <div style={{ color: "#2E7D4F", fontSize: 12.5, marginBottom: 10, fontWeight: 600 }}>{msg}</div>}
            <button type="submit" className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "10px 22px", background: mouvement === "Rétrogradation" ? "#C0172D" : "#2E7D4F" }}>{mouvement ? `Valider la ${mouvement.toLowerCase()}` : "Valider"}</button>
          </form>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
        <div style={{ flex: "1 1 220px", maxWidth: 340 }}><Field label="Rechercher" value={recherche} onChange={setRecherche} placeholder="Nom, grade, motif…" /></div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {["Tous", "Promotion", "Rétrogradation"].map((f) => (
            <button key={f} onClick={() => setFiltre(f)} style={{ ...smallBtn, background: filtre === f ? "#123A7A" : "transparent", color: filtre === f ? "#fff" : "#14213A", borderColor: filtre === f ? "#123A7A" : "#C3D0E2" }}>{f === "Tous" ? "Tous" : f + "s"}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {liste.map((p) => {
          const c = couleurMvt(p.type);
          return (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${c}`, borderRadius: 12, padding: "14px 16px", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.type === "Promotion" ? "⬆️" : "⬇️"} {p.nomCible}</div>
                <span style={{ background: c, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 11px" }}>{p.type}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "10px 0 6px" }}>
                {chipGrade(p.ancienGrade, "#5A6B84")}<span style={{ fontWeight: 700 }}>→</span>{chipGrade(p.nouveauGrade, c)}
              </div>
              {p.motif && <div style={{ fontSize: 13, color: "#2A3B57", background: "#F5F8FC", borderRadius: 8, padding: "8px 11px", margin: "8px 0", whiteSpace: "pre-wrap" }}>{p.motif}</div>}
              <div style={{ fontSize: 11.5, color: "#5A6B84" }}>Par {p.emisParNom} · {new Date(p.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
          );
        })}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun mouvement de grade trouvé.</div>}
      </div>
    </div>
  );
}
