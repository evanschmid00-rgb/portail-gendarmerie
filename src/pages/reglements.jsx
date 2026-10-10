// pages/reglements.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import React, { useState } from "react";
import { Field, buttonPrimary, h2Style, labelStyle, selectStyle, smallBtn } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";
import { dateLongue } from "../lib/utils.js";

/* ---------- Règlements (gendarmes, civils ou tout le monde) ---------- */

const AUDIENCES_REGLEMENT = [
  { id: "gendarmes", label: "Gendarmes", color: "#123A7A", icone: "🛡️" },
  { id: "civils", label: "Civils", color: "#2E7D4F", icone: "👥" },
  { id: "tous", label: "Tout le monde", color: "#B7791F", icone: "🌐" },
];
function audienceReglement(r) { return AUDIENCES_REGLEMENT.find((a) => a.id === r.audience) || AUDIENCES_REGLEMENT[0]; }
export function trierReglements(liste) {
  return liste.slice().sort((a, b) => {
    const oa = a.ordre === undefined || a.ordre === null ? 1e9 : Number(a.ordre);
    const ob = b.ordre === undefined || b.ordre === null ? 1e9 : Number(b.ordre);
    if (oa !== ob) return oa - ob;
    return String(a.createdAt || a.updatedAt || "").localeCompare(String(b.createdAt || b.updatedAt || ""));
  });
}
function reglementCorrespond(r, s) {
  if (!s) return true;
  return [r.titre, r.contenu, r.categorie].join(" ").toLowerCase().includes(s);
}

// Règlements visibles par les civils (sans connexion) : seulement ceux marqués « civils » ou « tout le monde »
export async function loadReglementsPublics() {
  const snap = await getDocs(query(collection(db, "reglements"), where("audience", "in", ["civils", "tous"])));
  return trierReglements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

// Mise en forme simple du texte : « # Titre » = intertitre, « - » = puce, « Article 1 » = ligne en gras
function ContenuReglement({ texte }) {
  const lignes = String(texte || "").split("\n");
  return (
    <div style={{ fontSize: 13.5, color: "#2A3B57", lineHeight: 1.65, fontFamily: FONT_BASE }}>
      {lignes.map((l, i) => {
        const t = l.trim();
        if (!t) return <div key={i} style={{ height: 8 }} />;
        if (t.startsWith("# ")) return <div key={i} style={{ fontFamily: FONT_TITRE, fontSize: 16, fontWeight: 700, color: "#123A7A", margin: "14px 0 4px" }}>{t.slice(2)}</div>;
        if (/^[-•*] /.test(t)) return (
          <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 6, margin: "2px 0" }}>
            <span style={{ color: "#2F6FDE", fontWeight: 700 }}>•</span><span>{t.slice(2)}</span>
          </div>
        );
        if (/^(art\.?|article)\s*\d+/i.test(t)) return <div key={i} style={{ fontWeight: 700, color: "#14213A", margin: "10px 0 2px" }}>{t}</div>;
        return <div key={i}>{t}</div>;
      })}
    </div>
  );
}

function BadgeAudience({ r }) {
  const a = audienceReglement(r);
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: "#fff", background: a.color, borderRadius: 20, padding: "2px 9px" }}>{a.icone} {a.label}</span>;
}

function ReglementCarte({ r, numero, ouvert, onToggle, afficherAudience, children }) {
  const aud = audienceReglement(r);
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${aud.color}`, borderRadius: 12, boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)", overflow: "hidden" }}>
      <button onClick={onToggle} aria-expanded={ouvert} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: aud.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_TITRE, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{numero}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: FONT_TITRE, fontSize: 16, fontWeight: 700, color: "#14213A" }}>{r.titre}</span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {afficherAudience && <BadgeAudience r={r} />}
            {r.categorie && <span style={{ fontSize: 10.5, fontWeight: 600, color: "#3A4D6B", background: "#E9EFF7", borderRadius: 20, padding: "2px 9px" }}>{r.categorie}</span>}
          </span>
        </span>
        <span style={{ fontSize: 13, color: "#5A6B84", flexShrink: 0 }}>{ouvert ? "▲" : "▼"}</span>
      </button>
      {ouvert && (
        <div style={{ padding: "14px 20px 18px", borderTop: "1px solid #E3EAF4" }}>
          <ContenuReglement texte={r.contenu} />
          {r.updatedAt && <div style={{ fontSize: 11, color: "#7B8AA3", marginTop: 14 }}>Dernière mise à jour : {dateLongue(r.updatedAt)}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

function BarreRecherche({ valeur, onChange, categories, categorie, onCategorie, tout, onTout, toutOuvert }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 240px", maxWidth: 360 }}>
          <Field label="Rechercher" value={valeur} onChange={onChange} placeholder="Mot-clé, titre, catégorie…" />
        </div>
        <button onClick={onTout} style={{ ...smallBtn, marginBottom: 12 }}>{toutOuvert ? "Tout replier" : "Tout déplier"}</button>
      </div>
      {categories.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["", ...categories].map((c) => (
            <button key={c || "toutes"} onClick={() => onCategorie(c)} style={{ ...smallBtn, background: categorie === c ? "#123A7A" : "transparent", color: categorie === c ? "#fff" : "#14213A", borderColor: categorie === c ? "#123A7A" : "#C3D0E2" }}>{c || "Toutes les catégories"}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Page publique pour les civils
export function ReglementsPublic({ reglements, onCancel }) {
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState("");
  const [ouverts, setOuverts] = useState({});
  const chargement = reglements === null || reglements === undefined;
  const erreur = reglements === "erreur";
  const liste = Array.isArray(reglements) ? trierReglements(reglements) : [];
  const categories = Array.from(new Set(liste.map((r) => r.categorie).filter(Boolean)));
  const s = search.trim().toLowerCase();
  const filtres = liste.filter((r) => reglementCorrespond(r, s) && (!categorie || r.categorie === categorie));
  const toutOuvert = filtres.length > 0 && filtres.every((r) => ouverts[r.id]);
  function toutBasculer() {
    const n = { ...ouverts };
    filtres.forEach((r) => { n[r.id] = !toutOuvert; });
    setOuverts(n);
  }
  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "40px 20px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>
        <div style={{ fontFamily: FONT_TITRE, fontSize: 28, fontWeight: 700, marginBottom: 4, color: "#14213A" }}>📜 Règlements de Black RP</div>
        <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 22, lineHeight: 1.6 }}>Les règles à respecter sur le serveur. Merci de les lire avant de jouer : l'ignorance d'une règle n'empêche pas la sanction.</div>
        {liste.length > 0 && <BarreRecherche valeur={search} onChange={setSearch} categories={categories} categorie={categorie} onCategorie={setCategorie} onTout={toutBasculer} toutOuvert={toutOuvert} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtres.map((r, i) => (
            <ReglementCarte key={r.id} r={r} numero={liste.indexOf(r) + 1} ouvert={!!ouverts[r.id]} onToggle={() => setOuverts({ ...ouverts, [r.id]: !ouverts[r.id] })} afficherAudience={false} />
          ))}
          {chargement && <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement…</div>}
          {erreur && <div style={{ color: "#C0172D", fontSize: 13 }}>Impossible de charger les règlements pour l'instant. Réessaie plus tard.</div>}
          {!chargement && !erreur && liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun règlement publié pour l'instant.</div>}
          {liste.length > 0 && filtres.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun résultat pour cette recherche.</div>}
        </div>
      </div>
    </div>
  );
}

// Page interne (gendarmes) : voit tous les règlements ; l'admin peut créer / modifier / ordonner
export function ReglementsPage({ current, reglements, onCreate, onUpdate, onDelete, onMove }) {
  const blank = { titre: "", contenu: "", audience: "gendarmes", categorie: "" };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [ouverts, setOuverts] = useState({});
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState("");
  const [filtre, setFiltre] = useState("toutes");
  const [apercu, setApercu] = useState(false);
  const [formOuvert, setFormOuvert] = useState(false);

  const liste = trierReglements(reglements);
  const categories = Array.from(new Set(liste.map((r) => r.categorie).filter(Boolean)));
  const s = search.trim().toLowerCase();
  const filtres = liste.filter((r) => (filtre === "toutes" || (r.audience || "gendarmes") === filtre) && reglementCorrespond(r, s) && (!categorie || r.categorie === categorie));
  const peutOrdonner = current.isAdmin && filtre === "toutes" && !s && !categorie;
  const toutOuvert = filtres.length > 0 && filtres.every((r) => ouverts[r.id]);
  const compte = (id) => liste.filter((r) => (r.audience || "gendarmes") === id).length;

  function toutBasculer() {
    const n = { ...ouverts };
    filtres.forEach((r) => { n[r.id] = !toutOuvert; });
    setOuverts(n);
  }
  function submit(e) {
    e.preventDefault();
    if (!form.titre.trim() || !form.contenu.trim()) return;
    if (editingId) onUpdate(editingId, form); else onCreate(form);
    setEditingId(null); setForm(blank); setApercu(false); setFormOuvert(false);
  }
  function startEdit(r) {
    setEditingId(r.id);
    setForm({ titre: r.titre || "", contenu: r.contenu || "", audience: r.audience || "gendarmes", categorie: r.categorie || "" });
    setFormOuvert(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function annuler() { setEditingId(null); setForm(blank); setApercu(false); setFormOuvert(false); }

  const onglets = [{ id: "toutes", label: "Tous", n: liste.length }, ...AUDIENCES_REGLEMENT.map((a) => ({ id: a.id, label: a.label, n: compte(a.id) }))];

  return (
    <div>
      <h2 style={h2Style}>Règlements</h2>

      {current.isAdmin && !formOuvert && (
        <button onClick={() => setFormOuvert(true)} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginBottom: 20 }}>+ Nouveau règlement</button>
      )}
      {current.isAdmin && formOuvert && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier le règlement" : "Nouveau règlement"}</div>
          <form onSubmit={submit}>
            <Field label="Titre" value={form.titre} onChange={(v) => setForm({ ...form, titre: v })} placeholder="Ex : Règlement de la route" />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px" }}>
                <label style={labelStyle}>Visible par</label>
                <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} style={{ ...selectStyle, marginBottom: 12 }}>
                  {AUDIENCES_REGLEMENT.map((a) => <option key={a.id} value={a.id}>{a.icone} {a.label}{a.id === "civils" ? " (page publique)" : a.id === "tous" ? " (gendarmes + civils)" : " (espace gendarmes)"}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 220px" }}>
                <Field label="Catégorie (facultatif)" value={form.categorie} onChange={(v) => setForm({ ...form, categorie: v })} placeholder="Ex : Circulation, Zones, Armes…" />
              </div>
            </div>
            <Field label="Contenu" textarea value={form.contenu} onChange={(v) => setForm({ ...form, contenu: v })} placeholder={"# Intertitre\nArticle 1 — ...\n- une puce\n- une autre puce"} />
            <div style={{ fontSize: 11.5, color: "#5A6B84", margin: "-6px 0 12px" }}>Mise en forme : <b># Titre</b> pour un intertitre, <b>- </b> pour une puce, une ligne commençant par <b>Article 1</b> s'affiche en gras.</div>
            {apercu && form.contenu.trim() && (
              <div style={{ background: "#F5F8FC", border: "1px dashed #C3D0E2", borderRadius: 10, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8 }}>Aperçu</div>
                <ContenuReglement texte={form.contenu} />
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>{editingId ? "Enregistrer" : "Publier"}</button>
              <button type="button" onClick={() => setApercu(!apercu)} style={{ ...smallBtn, padding: "9px 16px" }}>{apercu ? "Masquer l'aperçu" : "Aperçu"}</button>
              <button type="button" onClick={annuler} style={{ ...smallBtn, padding: "9px 16px" }}>Annuler</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {onglets.map((o) => (
          <button key={o.id} onClick={() => setFiltre(o.id)} style={{ ...smallBtn, background: filtre === o.id ? "#123A7A" : "transparent", color: filtre === o.id ? "#fff" : "#14213A", borderColor: filtre === o.id ? "#123A7A" : "#C3D0E2" }}>{o.label} ({o.n})</button>
        ))}
      </div>
      <BarreRecherche valeur={search} onChange={setSearch} categories={categories} categorie={categorie} onCategorie={setCategorie} onTout={toutBasculer} toutOuvert={toutOuvert} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtres.map((r) => {
          const pos = liste.findIndex((x) => x.id === r.id);
          return (
            <ReglementCarte key={r.id} r={r} numero={pos + 1} ouvert={!!ouverts[r.id]} onToggle={() => setOuverts({ ...ouverts, [r.id]: !ouverts[r.id] })} afficherAudience>
              {current.isAdmin && (
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  <button onClick={() => startEdit(r)} style={smallBtn}>Modifier</button>
                  {peutOrdonner && <button onClick={() => onMove(r.id, -1)} disabled={pos === 0} style={{ ...smallBtn, opacity: pos === 0 ? 0.4 : 1 }}>↑ Monter</button>}
                  {peutOrdonner && <button onClick={() => onMove(r.id, 1)} disabled={pos === liste.length - 1} style={{ ...smallBtn, opacity: pos === liste.length - 1 ? 0.4 : 1 }}>↓ Descendre</button>}
                  <button onClick={() => { if (window.confirm(`Supprimer le règlement « ${r.titre} » ?`)) onDelete(r.id); }} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Supprimer</button>
                </div>
              )}
            </ReglementCarte>
          );
        })}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun règlement pour l'instant.</div>}
        {liste.length > 0 && filtres.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun résultat.</div>}
      </div>
    </div>
  );
}
