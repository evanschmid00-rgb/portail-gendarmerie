// pages/casier.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useState } from "react";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { Field, Select, buttonPrimary, h2Style, selectStyle, smallBtn } from "../composants/ui.jsx";
import { FONT_TITRE, TYPES_INFRACTION } from "../lib/constantes.js";

/* ---------- Consultation publique du code pénal ---------- */

export function CodePenalPublic({ codePenal, onCancel }) {
  const [search, setSearch] = useState("");
  const s = search.trim().toLowerCase();
  const filtered = codePenal.filter((a) => !s || a.nom.toLowerCase().includes(s) || (a.article || "").toLowerCase().includes(s));

  const groups = {};
  filtered.forEach((a) => {
    const key = a.type + (a.classe ? " — " + a.classe : "");
    groups[key] = groups[key] || [];
    groups[key].push(a);
  });
  Object.keys(groups).forEach((k) => groups[k].sort((a, b) => (Number(a.amende) || 0) - (Number(b.amende) || 0)));
  const TYPE_SORT_ORDER = { Contravention: 0, Délit: 1, Crime: 2 };
  const groupKeys = Object.keys(groups).sort((a, b) => {
    const typeA = a.split(" — ")[0], typeB = b.split(" — ")[0];
    const orderA = TYPE_SORT_ORDER[typeA] ?? 99, orderB = TYPE_SORT_ORDER[typeB] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 26, fontWeight: 700, marginBottom: 4, color: "#14213A" }}>📖 Code Pénal de Black RP</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 6 }}>
          <b>Contravention</b> = amende seule. <b>Délit</b> = prison + amende, tribunal correctionnel. <b>Crime</b> = infraction la plus grave, cour d'assises.
        </div>
        <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 24 }}>
          Les amendes de toutes les infractions retenues s'additionnent toujours. Le temps de GAV ne s'additionne jamais : seul le temps le plus élevé de la sélection est retenu.
        </div>
        <div style={{ maxWidth: 320, marginBottom: 24 }}>
          <Field label="Rechercher une infraction" value={search} onChange={setSearch} placeholder="Ex : stationnement, vitesse..." />
        </div>
        {groupKeys.map((g) => (
          <div key={g} style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>{g}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {groups[g].map((a) => (
                <div key={a.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.18)" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nom}</div>
                    {a.article && <div style={{ fontSize: 11, color: "#5A6B84" }}>{a.article}</div>}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12, color: "#3A4D6B", flexShrink: 0, marginLeft: 12 }}>
                    {a.amende ? `${a.amende} crédits` : ""}{a.amende && a.tempsGav ? " — " : ""}{a.tempsGav}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {groupKeys.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune infraction enregistrée pour l'instant.</div>}
      </div>
    </div>
  );
}

/* ---------- Consultation publique du casier judiciaire ---------- */

/* ---------- Casier judiciaire : outils d'affichage communs ---------- */

const nombreDe = (s) => { const m = String(s || "").replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/); return m ? Number(m[1].replace(",", ".")) : 0; };
const fmtDateCasier = (s) => {
  if (!s) return "Date non précisée";
  const d = new Date(`${s}T12:00:00`);
  return isNaN(d) ? s : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};
function niveauCasier(n) {
  if (n === 0) return { label: "Casier vierge", couleur: "#2E7D4F", fond: "#E3F2E8" };
  if (n <= 2) return { label: "Casier léger", couleur: "#B7791F", fond: "#FFF6E0" };
  if (n <= 5) return { label: "Casier chargé", couleur: "#D1471F", fond: "#FDE3DA" };
  return { label: "Multirécidiviste", couleur: "#8A1020", fond: "#F8DADF" };
}
const resumeCasier = (mentions) => ({ n: mentions.length, amendes: mentions.reduce((s, m) => s + nombreDe(m.amende), 0), gav: mentions.filter((m) => m.tempsGav).length });
const cleDateMention = (m) => String(m.dateFaits || m.createdAt || "");

function BadgeNiveau({ n }) {
  const nv = niveauCasier(n);
  return <span style={{ background: nv.fond, color: nv.couleur, border: `1px solid ${nv.couleur}`, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 11px", whiteSpace: "nowrap" }}>{nv.label}</span>;
}

function PuceCasier({ children, couleur = "#3A4D6B", fond = "#F0F4FA" }) {
  return <span style={{ background: fond, color: couleur, fontSize: 12, fontWeight: 600, borderRadius: 14, padding: "3px 10px" }}>{children}</span>;
}

// Une mention sur la frise du casier (le public ne voit ni les remarques ni l'agent)
function CarteMention({ m, interne, children, dernier }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#C0172D", marginTop: 14, flexShrink: 0 }} />
        {!dernier && <span style={{ flex: 1, width: 2, background: "#D3DDEA", marginTop: 4 }} />}
      </div>
      <div style={{ flex: 1, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "12px 14px", marginBottom: 10, boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "#14213A" }}>{m.nature}</div>
        <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>📅 {fmtDateCasier(m.dateFaits)}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {m.amende && <PuceCasier couleur="#8A5A00" fond="#FFF6E0">💶 Amende : {m.amende}</PuceCasier>}
          {m.tempsGav && <PuceCasier couleur="#8A1020" fond="#F8DADF">⏱ GAV : {m.tempsGav}</PuceCasier>}
          {!m.amende && !m.tempsGav && <PuceCasier>Peine non précisée</PuceCasier>}
        </div>
        {interne && m.remarques && <div style={{ fontSize: 12.5, color: "#3A4D6B", background: "#F5F8FC", borderRadius: 8, padding: "7px 10px", marginTop: 8, whiteSpace: "pre-wrap" }}>{m.remarques}</div>}
        {interne && <div style={{ fontSize: 11, color: "#2F6FDE", marginTop: 8 }}>Agent verbalisateur : {m.gendarmeNom} ({m.gendarmeMatricule})</div>}
        {children}
      </div>
    </div>
  );
}

function ResumeCasier({ r }) {
  const tuile = (l, v, c) => (
    <div style={{ flex: 1, minWidth: 110, background: "#F5F8FC", border: "1px solid #D3DDEA", borderTop: `3px solid ${c}`, borderRadius: 10, padding: "9px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {tuile("Mentions", r.n, "#C0172D")}
      {tuile("Total des amendes", r.amendes || "—", "#B7791F")}
      {tuile("Passages en GAV", r.gav, "#8A1020")}
    </div>
  );
}

export function CasierPublicLookup({ casier, onCancel }) {
  const [pseudo, setPseudo] = useState("");
  const [recherche, setRecherche] = useState("");

  const s = recherche.trim().toLowerCase().replace(/^@/, "");
  const dossier = s ? casier.find((d) => [d.robloxUsername, d.pseudoRoblox, d.robloxDisplayName].some((v) => (v || "").trim().toLowerCase() === s)) : null;
  const mentions = dossier ? dossier.mentions.slice().sort((a, b) => cleDateMention(b).localeCompare(cleDateMention(a))) : [];
  const avatars = useAvatars([dossier && dossier.robloxId]);
  const r = resumeCasier(mentions);

  function chercher(e) { e.preventDefault(); setRecherche(pseudo); }

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 4, color: "#14213A" }}>⚖️ Consultation de casier judiciaire</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 22, lineHeight: 1.55 }}>Renseigne ton @ Roblox (nom d'utilisateur exact) ou ton pseudo Roblox pour voir les mentions enregistrées à ton nom.</div>

        <form onSubmit={chercher} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 18 }}>
          <Field label="@ Roblox ou pseudo Roblox" value={pseudo} onChange={setPseudo} placeholder="Ex : @MonPseudo" />
          <button type="submit" className="gh-btn-anim" style={{ ...buttonPrimary, marginTop: 0 }}>Consulter mon casier</button>
        </form>

        {recherche.trim() && (
          dossier && mentions.length > 0 ? (
            <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
                {dossier.robloxId && <Avatar src={avatars[dossier.robloxId]} taille={64} />}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontFamily: FONT_TITRE, fontSize: 20, fontWeight: 700, color: "#14213A" }}>{dossier.pseudoRoblox}</div>
                  {dossier.robloxUsername && <div style={{ fontSize: 13, color: "#5A6B84" }}>@{dossier.robloxUsername}</div>}
                </div>
                <BadgeNiveau n={mentions.length} />
              </div>
              <div style={{ marginBottom: 20 }}><ResumeCasier r={r} /></div>
              <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 10 }}>Historique des mentions</div>
              {mentions.map((m, i) => <CarteMention key={m.id} m={m} dernier={i === mentions.length - 1} />)}
            </div>
          ) : (
            <div style={{ background: "#E3F2E8", border: "1px solid #2E7D4F", borderRadius: 14, padding: "22px 22px", textAlign: "center" }}>
              <div style={{ fontSize: 34 }}>✅</div>
              <div style={{ fontFamily: FONT_TITRE, fontSize: 20, fontWeight: 700, color: "#1F6B42", margin: "4px 0" }}>Casier vierge</div>
              <div style={{ fontSize: 13, color: "#3A4D6B" }}>Aucune mention n'est enregistrée pour « {recherche.trim()} ». Vérifie l'orthographe si tu t'attendais à un résultat.</div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function CodePenalPage({ current, codePenal, onAdd, onUpdate, onDelete }) {
  const isAdmin = !!current.isAdmin;
  const blank = { type: "Contravention", classe: "", nom: "", article: "", amende: "", tempsGav: "" };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!form.nom.trim()) return;
    const data = { ...form, amende: form.amende ? Number(form.amende) : "" };
    if (editingId) { onUpdate(editingId, data); setEditingId(null); } else { onAdd(data); }
    setForm(blank);
  }
  function startEdit(a) {
    setEditingId(a.id);
    setForm({ type: a.type, classe: a.classe || "", nom: a.nom, article: a.article || "", amende: a.amende || "", tempsGav: a.tempsGav || "" });
  }
  const s = search.trim().toLowerCase();
  const filtered = codePenal.filter((a) => !s || a.nom.toLowerCase().includes(s));
  const groups = {};
  filtered.forEach((a) => {
    const key = a.type + (a.classe ? " — " + a.classe : "");
    groups[key] = groups[key] || [];
    groups[key].push(a);
  });
  Object.keys(groups).forEach((k) => groups[k].sort((a, b) => (Number(a.amende) || 0) - (Number(b.amende) || 0)));
  const TYPE_SORT_ORDER = { Contravention: 0, Délit: 1, Crime: 2 };
  const groupKeys = Object.keys(groups).sort((a, b) => {
    const typeA = a.split(" — ")[0], typeB = b.split(" — ")[0];
    const orderA = TYPE_SORT_ORDER[typeA] ?? 99, orderB = TYPE_SORT_ORDER[typeB] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  return (
    <div>
      <h2 style={h2Style}>Code Pénal</h2>

      {isAdmin && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier l'article" : "Ajouter un article"}</div>
          <form onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={TYPES_INFRACTION} />
              <Field label="Classe / précision (facultatif)" value={form.classe} onChange={(v) => setForm({ ...form, classe: v })} placeholder="Ex : Classe 3" />
            </div>
            <Field label="Nom de l'infraction" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
            <Field label="Référence légale (facultatif)" value={form.article} onChange={(v) => setForm({ ...form, article: v })} placeholder="Ex : art. R412-30 C. route" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Amende (€)" type="number" value={form.amende} onChange={(v) => setForm({ ...form, amende: v })} />
              <Field label="Temps de GAV" value={form.tempsGav} onChange={(v) => setForm({ ...form, tempsGav: v })} placeholder="Ex : 3 jours" />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>{editingId ? "Enregistrer" : "Ajouter"}</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#123A7A", border: "1px solid #123A7A" }}>Annuler</button>}
            </div>
          </form>
        </div>
      )}

      <div style={{ maxWidth: 320, marginBottom: 16 }}>
        <Field label="Filtrer" value={search} onChange={setSearch} placeholder="Ex : stationnement, vitesse..." />
      </div>
      {groupKeys.map((g) => (
        <div key={g} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>{g}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {groups[g].map((a) => (
              <div key={a.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.18)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nom}</div>
                  {a.article && <div style={{ fontSize: 11, color: "#5A6B84" }}>{a.article}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right", fontSize: 12, color: "#3A4D6B" }}>
                    {a.amende ? `${a.amende} crédits` : ""}{a.amende && a.tempsGav ? " — " : ""}{a.tempsGav}
                  </div>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startEdit(a)} style={smallBtn}>Modifier</button>
                      <button onClick={() => onDelete(a.id)} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Suppr.</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {groupKeys.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune infraction enregistrée.</div>}
    </div>
  );
}

export function CasierPage({ current, casier, codePenal, onAdd, onUpdateMention, onDeleteMention }) {
  const canModify = current.isAdmin || (current.qualifications || []).includes("OPJ");
  const blank = { pseudoRoblox: "", robloxUsername: "", nom: "", prenom: "", nature: "", dateFaits: "", amende: "", tempsGav: "", remarques: "" };
  const [form, setForm] = useState(blank);
  const [roblox, setRoblox] = useState(null); // compte Roblox vérifié { id, username, displayName, imageUrl, cle }
  const [verifBusy, setVerifBusy] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // { dossierId, mentionId }
  const [editForm, setEditForm] = useState(blank);
  const [showCodePenal, setShowCodePenal] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [articleSearch, setArticleSearch] = useState("");
  const [tri, setTri] = useState("recent");
  const [ouverts, setOuverts] = useState({});

  const cleSaisie = `${form.pseudoRoblox.trim()}|${form.robloxUsername.trim().replace(/^@/, "")}`;
  const verifieOk = !!roblox && roblox.cle === cleSaisie;
  const existingDossier = verifieOk
    ? casier.find((d) => d.robloxId === roblox.id)
      || casier.find((d) => !d.robloxId && [roblox.displayName, roblox.username].some((v) => (d.pseudoRoblox || "").trim().toLowerCase() === v.trim().toLowerCase()))
    : null;

  const [error, setError] = useState("");

  function toggleArticle(id) {
    setSelectedArticleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applySelection() {
    const selected = codePenal.filter((a) => selectedArticleIds.includes(a.id));
    if (selected.length === 0) return;
    const totalAmende = selected.reduce((s, a) => s + (Number(a.amende) || 0), 0);
    // Le temps de GAV ne s'additionne jamais : on retient seulement le plus élevé de la sélection.
    function minutesDe(str) {
      const m = String(str || "").match(/(\d+)/);
      return m ? Number(m[1]) : 0;
    }
    let pireTempsGav = "";
    let pireMinutes = -1;
    selected.forEach((a) => {
      const mins = minutesDe(a.tempsGav);
      if (mins > pireMinutes) { pireMinutes = mins; pireTempsGav = a.tempsGav || ""; }
    });
    const nature = selected.map((a) => a.nom).join(", ");
    setForm((f) => ({ ...f, nature, amende: totalAmende ? String(totalAmende) : f.amende, tempsGav: pireTempsGav || f.tempsGav }));
    setShowCodePenal(false);
  }

  const filteredArticles = codePenal.filter((a) => !articleSearch.trim() || a.nom.toLowerCase().includes(articleSearch.trim().toLowerCase()));

  // Vérifie que le pseudo et l'@ correspondent bien au même compte Roblox
  async function verifierRoblox() {
    const at = form.robloxUsername.trim().replace(/^@/, "");
    const pseudo = form.pseudoRoblox.trim();
    if (!pseudo || !at) { setRoblox(null); setError("Renseigne le pseudo ET l'@ exact du joueur : ils servent à retrouver son compte Roblox."); return null; }
    setVerifBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/roblox-head?pseudo=${encodeURIComponent(at)}`);
      const j = await r.json();
      if (!j.id) { setRoblox(null); setError(j.message || "Compte Roblox introuvable."); return null; }
      if (j.displayName && j.displayName.trim().toLowerCase() !== pseudo.toLowerCase()) {
        setRoblox(null);
        setError(`Le compte @${j.nom} s'appelle « ${j.displayName} » sur Roblox, pas « ${pseudo} ». Vérifie le pseudo.`);
        return null;
      }
      const res = { id: String(j.id), username: j.nom, displayName: j.displayName || pseudo, imageUrl: j.imageUrl || "", cle: `${pseudo}|${at}` };
      setRoblox(res);
      return res;
    } catch (e) { setRoblox(null); setError("Roblox ne répond pas, réessaie dans un instant."); return null; }
    finally { setVerifBusy(false); }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.nature.trim()) { setError("La nature de l'infraction est obligatoire."); return; }
    const rb = verifieOk ? roblox : await verifierRoblox();
    if (!rb) return;
    const dossier = casier.find((d) => d.robloxId === rb.id)
      || casier.find((d) => !d.robloxId && [rb.displayName, rb.username].some((v) => (d.pseudoRoblox || "").trim().toLowerCase() === v.trim().toLowerCase()));
    setError("");
    onAdd({ ...form, pseudoRoblox: rb.displayName, robloxUsername: rb.username, robloxId: rb.id });
    setConfirmMsg(dossier ? `Mention ajoutée au casier existant de ${rb.displayName} (@${rb.username}).` : `Nouveau casier créé pour ${rb.displayName} (@${rb.username}).`);
    setForm(blank);
    setRoblox(null);
    setSelectedArticleIds([]);
    setTimeout(() => setConfirmMsg(""), 4000);
  }

  function startEdit(dossierId, m) {
    setEditing({ dossierId, mentionId: m.id });
    setEditForm({ nature: m.nature, dateFaits: m.dateFaits || "", amende: m.amende || "", tempsGav: m.tempsGav || "", remarques: m.remarques || "" });
  }
  function submitEdit(e) {
    e.preventDefault();
    onUpdateMention(editing.dossierId, editing.mentionId, editForm);
    setEditing(null);
  }

  // Aplatit tous les dossiers/mentions pour l'affichage, filtré par pseudo
  const flat = casier
    .filter((d) => `${d.pseudoRoblox || ""} ${d.robloxUsername || ""} ${d.nom || ""} ${d.prenom || ""}`.toLowerCase().includes(search.trim().toLowerCase().replace(/^@/, "")))
    .flatMap((d) => d.mentions.map((m) => ({ dossier: d, mention: m })))
    .sort((a, b) => new Date(a.mention.createdAt) - new Date(b.mention.createdAt));

  const avatars = useAvatars(flat.map(({ dossier }) => dossier.robloxId));

  return (
    <div>
      <h2 style={h2Style}>Casier judiciaire</h2>

      <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Ajouter une mention</div>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Pseudo Roblox (nom affiché)" value={form.pseudoRoblox} onChange={(v) => setForm({ ...form, pseudoRoblox: v })} />
            <Field label="@ Roblox (nom d'utilisateur exact)" value={form.robloxUsername} onChange={(v) => setForm({ ...form, robloxUsername: v })} placeholder="Ex : @MonPseudo" />
            <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => setForm({ ...form, dateFaits: v })} />
            <Field label="Nom (si connu)" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
            <Field label="Prénom (si connu)" value={form.prenom} onChange={(v) => setForm({ ...form, prenom: v })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "0 0 14px" }}>
            <button type="button" onClick={verifierRoblox} disabled={verifBusy} style={smallBtn}>{verifBusy ? "Vérification…" : "Vérifier le compte Roblox"}</button>
            {verifieOk && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar src={roblox.imageUrl} taille={48} />
                <div style={{ fontSize: 12 }}>
                  <div><b>{roblox.displayName}</b> · @{roblox.username} ✅</div>
                  <div style={{ color: existingDossier ? "#2F6FDE" : "#2E7D4F", marginTop: 2 }}>
                    {existingDossier ? "Un casier existe déjà pour ce compte : cette entrée s'y ajoutera." : "Aucun casier existant pour ce compte : un nouveau sera créé."}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <button type="button" onClick={() => setShowCodePenal((s) => !s)} style={{ ...smallBtn, background: "#2F6FDE", color: "#14213A" }}>
              📖 {showCodePenal ? "Fermer le code pénal" : "Choisir dans le code pénal"}
            </button>
            {showCodePenal && (
              <div style={{ marginTop: 10, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 14, maxHeight: 280, overflowY: "auto" }}>
                <Field label="Filtrer" value={articleSearch} onChange={setArticleSearch} placeholder="Ex : vitesse, vol..." />
                {codePenal.length === 0 && <div style={{ fontSize: 12, color: "#5A6B84" }}>Aucun article enregistré — demande à un admin d'importer/ajouter le code pénal.</div>}
                {filteredArticles.map((a) => (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 0" }}>
                    <input type="checkbox" checked={selectedArticleIds.includes(a.id)} onChange={() => toggleArticle(a.id)} />
                    <span style={{ flex: 1 }}>{a.nom} <span style={{ color: "#5A6B84" }}>({a.type}{a.classe ? " " + a.classe : ""})</span></span>
                    <span style={{ color: "#5A6B84" }}>{a.amende ? `${a.amende}€` : ""}</span>
                  </label>
                ))}
                {selectedArticleIds.length > 0 && (
                  <button type="button" onClick={applySelection} style={{ ...smallBtn, background: "#123A7A", color: "#fff", marginTop: 10 }}>
                    Appliquer la sélection ({selectedArticleIds.length})
                  </button>
                )}
              </div>
            )}
          </div>
          <Field label="Nature de l'infraction" value={form.nature} onChange={(v) => setForm({ ...form, nature: v })} placeholder="Décris librement l'infraction" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Amende" value={form.amende} onChange={(v) => setForm({ ...form, amende: v })} placeholder="Ex : 500 crédits" />
            <Field label="Temps de GAV" value={form.tempsGav} onChange={(v) => setForm({ ...form, tempsGav: v })} placeholder="Ex : 3 jours" />
          </div>
          <Field label="Remarques (facultatif)" textarea value={form.remarques} onChange={(v) => setForm({ ...form, remarques: v })} />
          {error && <div style={{ color: "#C0172D", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {confirmMsg && <div style={{ color: "#2E7D4F", fontSize: 12, marginBottom: 10 }}>{confirmMsg}</div>}
          <button className="gh-btn-anim" type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Enregistrer la mention</button>
        </form>
      </div>

      {(() => {
        const q = search.trim().toLowerCase().replace(/^@/, "");
        const maintenant = Date.now();
        const tousDossiers = casier.filter((d) => d.mentions && d.mentions.length > 0);
        const dossiers = tousDossiers
          .filter((d) => `${d.pseudoRoblox || ""} ${d.robloxUsername || ""} ${d.nom || ""} ${d.prenom || ""}`.toLowerCase().includes(q))
          .map((d) => ({ d, r: resumeCasier(d.mentions), derniere: d.mentions.reduce((mx, m) => (String(m.createdAt) > mx ? String(m.createdAt) : mx), "") }))
          .sort((a, b) => (tri === "mentions" ? b.r.n - a.r.n : tri === "nom" ? String(a.d.pseudoRoblox).localeCompare(String(b.d.pseudoRoblox)) : b.derniere.localeCompare(a.derniere)));
        const totalMentions = tousDossiers.reduce((n, d) => n + d.mentions.length, 0);
        const recentes = tousDossiers.reduce((n, d) => n + d.mentions.filter((m) => maintenant - new Date(m.createdAt).getTime() < 30 * 86400000).length, 0);
        const recidivistes = tousDossiers.filter((d) => d.mentions.length >= 3).length;
        const tuile = (l, v, c) => (
          <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
            <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
          </div>
        );
        return (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
              {tuile("Casiers ouverts", tousDossiers.length, "#123A7A")}
              {tuile("Mentions au total", totalMentions, "#C0172D")}
              {tuile("Ajoutées ces 30 jours", recentes, "#B7791F")}
              {tuile("Récidivistes (3 mentions et +)", recidivistes, "#8A1020")}
            </div>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8, fontWeight: 700 }}>
              Casiers ({dossiers.length}){!canModify && " — lecture seule"}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
              <div style={{ flex: "1 1 240px", maxWidth: 340 }}><Field label="Filtrer par pseudo, @ ou nom" value={search} onChange={setSearch} placeholder="Tape un pseudo ou un @" /></div>
              <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ ...selectStyle, width: "auto", marginBottom: 12 }}>
                <option value="recent">Trier : dernière mention</option>
                <option value="mentions">Trier : nombre de mentions</option>
                <option value="nom">Trier : pseudo</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dossiers.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun casier trouvé.</div>}
              {dossiers.map(({ d: dossier, r }) => {
                const ouvert = !!ouverts[dossier.id];
                const nv = niveauCasier(r.n);
                const mentions = dossier.mentions.slice().sort((a, b) => cleDateMention(b).localeCompare(cleDateMention(a)));
                return (
                  <div key={dossier.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${nv.couleur}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)" }}>
                    <div onClick={() => setOuverts({ ...ouverts, [dossier.id]: !ouvert })} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", cursor: "pointer", flexWrap: "wrap" }}>
                      {dossier.robloxId ? <Avatar src={avatars[dossier.robloxId]} taille={48} /> : <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E6EDF7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#123A7A" }}>{String(dossier.pseudoRoblox || "?").charAt(0).toUpperCase()}</div>}
                      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{dossier.pseudoRoblox}{dossier.robloxUsername && <span style={{ fontWeight: 400, fontSize: 12.5, color: "#5A6B84" }}> · @{dossier.robloxUsername}</span>}</div>
                        {(dossier.nom || dossier.prenom) && <div style={{ fontSize: 12, color: "#5A6B84" }}>{dossier.prenom} {dossier.nom}</div>}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          <PuceCasier couleur="#8A1020" fond="#F8DADF">{r.n} mention{r.n > 1 ? "s" : ""}</PuceCasier>
                          {r.amendes > 0 && <PuceCasier couleur="#8A5A00" fond="#FFF6E0">💶 {r.amendes} au total</PuceCasier>}
                          {r.gav > 0 && <PuceCasier>⏱ {r.gav} GAV</PuceCasier>}
                        </div>
                      </div>
                      <BadgeNiveau n={r.n} />
                      <span style={{ fontSize: 13, color: "#5A6B84" }}>{ouvert ? "▲" : "▼"}</span>
                    </div>
                    {ouvert && (
                      <div style={{ padding: "6px 16px 8px", borderTop: "1px solid #E3EAF4", background: "#F9FBFE" }}>
                        <div style={{ height: 8 }} />
                        {mentions.map((m, i) =>
                          editing && editing.dossierId === dossier.id && editing.mentionId === m.id ? (
                            <form key={m.id} onSubmit={submitEdit} style={{ background: "#fff", border: "1px solid #123A7A", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                              <Field label="Nature de l'infraction" value={editForm.nature} onChange={(v) => setEditForm({ ...editForm, nature: v })} />
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <Field label="Date des faits" type="date" value={editForm.dateFaits} onChange={(v) => setEditForm({ ...editForm, dateFaits: v })} />
                                <Field label="Amende" value={editForm.amende} onChange={(v) => setEditForm({ ...editForm, amende: v })} />
                                <Field label="Temps de GAV" value={editForm.tempsGav} onChange={(v) => setEditForm({ ...editForm, tempsGav: v })} />
                              </div>
                              <Field label="Remarques" textarea value={editForm.remarques} onChange={(v) => setEditForm({ ...editForm, remarques: v })} />
                              <div style={{ display: "flex", gap: 8 }}>
                                <button type="submit" style={{ ...smallBtn, background: "#123A7A", color: "#fff" }}>Enregistrer</button>
                                <button type="button" onClick={() => setEditing(null)} style={smallBtn}>Annuler</button>
                              </div>
                            </form>
                          ) : (
                            <CarteMention key={m.id} m={m} interne dernier={i === mentions.length - 1}>
                              {canModify && (
                                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                  <button onClick={() => startEdit(dossier.id, m)} style={smallBtn}>Modifier</button>
                                  <button onClick={() => { if (window.confirm("Supprimer cette mention du casier ?")) onDeleteMention(dossier.id, m.id); }} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Supprimer</button>
                                </div>
                              )}
                            </CarteMention>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
}
