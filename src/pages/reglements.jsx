// pages/reglements.jsx — Règlements (gendarmes, civils ou tout le monde) : lecture avec sommaire, recherche surlignée,
// mise en forme riche, éditeur avec barre d'outils et aperçu en direct (admins).
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import React, { useRef, useState } from "react";
import { buttonPrimary, h2Style, labelStyle, selectStyle, smallBtn } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";
import { dateLongue } from "../lib/utils.js";

const BLEU = "#123A7A";
const AUDIENCES_REGLEMENT = [
  { id: "gendarmes", label: "Gendarmes", color: "#123A7A", fond: "#E6EDF7", icone: "🛡️" },
  { id: "civils", label: "Civils", color: "#2E7D4F", fond: "#E3F2E8", icone: "👥" },
  { id: "tous", label: "Tout le monde", color: "#B7791F", fond: "#FFF1DC", icone: "🌐" },
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
const nbMots = (t) => String(t || "").split(/\s+/).filter(Boolean).length;
const minutesLecture = (t) => Math.max(1, Math.round(nbMots(t) / 180));
const joursDepuis = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : 9999);
const nbArticles = (t) => String(t || "").split("\n").filter((l) => /^(art\.?|article)\s*\d+/i.test(l.trim())).length;

// Règlements visibles par les civils (sans connexion) : seulement ceux marqués « civils » ou « tout le monde »
export async function loadReglementsPublics() {
  const snap = await getDocs(query(collection(db, "reglements"), where("audience", "in", ["civils", "tous"])));
  return trierReglements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/* ---------- Mise en forme du texte ---------- */
// # Intertitre · ## Sous-titre · Article 1 — … · - puce · 1. liste numérotée · > note · !! attention/sanction · --- séparateur · **gras**

function Inline({ texte, surligne }) {
  const morceaux = String(texte).split(/\*\*(.+?)\*\*/g);
  const surligner = (t, k) => {
    if (!surligne) return t;
    const bas = t.toLowerCase();
    const sortie = [];
    let i = 0;
    for (;;) {
      const j = bas.indexOf(surligne, i);
      if (j < 0) { sortie.push(t.slice(i)); break; }
      sortie.push(t.slice(i, j));
      sortie.push(<mark key={`${k}-${j}`} style={{ background: "#FFE58A", borderRadius: 3, padding: "0 1px" }}>{t.slice(j, j + surligne.length)}</mark>);
      i = j + surligne.length;
    }
    return sortie;
  };
  return morceaux.map((m, i) => (i % 2 ? <b key={i} style={{ color: "#14213A" }}>{surligner(m, i)}</b> : <React.Fragment key={i}>{surligner(m, i)}</React.Fragment>));
}

function ContenuReglement({ texte, surligne }) {
  const lignes = String(texte || "").split("\n");
  return (
    <div style={{ fontSize: 14, color: "#2A3B57", lineHeight: 1.7, fontFamily: FONT_BASE }}>
      {lignes.map((l, i) => {
        const t = l.trim();
        if (!t) return <div key={i} style={{ height: 6 }} />;
        if (/^-{3,}$/.test(t)) return <hr key={i} style={{ border: "none", borderTop: "1px solid #D3DDEA", margin: "14px 0" }} />;
        if (t.startsWith("## ")) return <div key={i} style={{ fontSize: 14.5, fontWeight: 800, color: "#14213A", margin: "14px 0 3px" }}><Inline texte={t.slice(3)} surligne={surligne} /></div>;
        if (t.startsWith("# ")) return (
          <div key={i} style={{ margin: "20px 0 8px" }}>
            <div style={{ fontFamily: FONT_TITRE, fontSize: 17, fontWeight: 700, color: BLEU }}><Inline texte={t.slice(2)} surligne={surligne} /></div>
            <div style={{ height: 3, width: 44, background: "#2F6FDE", borderRadius: 2, marginTop: 4 }} />
          </div>
        );
        if (t.startsWith("!! ")) return (
          <div key={i} style={{ background: "#FDECEE", border: "1px solid #F3B9C0", borderLeft: "4px solid #C0172D", borderRadius: 8, padding: "9px 13px", margin: "8px 0", color: "#6B0F1C" }}>
            <b>⚠️ </b><Inline texte={t.slice(3)} surligne={surligne} />
          </div>
        );
        if (t.startsWith("> ")) return (
          <div key={i} style={{ background: "#FFF8E5", border: "1px solid #F0D58A", borderLeft: "4px solid #E0A23A", borderRadius: 8, padding: "9px 13px", margin: "8px 0", color: "#5C4300" }}>
            <b>💡 </b><Inline texte={t.slice(2)} surligne={surligne} />
          </div>
        );
        const num = t.match(/^(\d+)[.)] (.*)$/);
        if (num) return (
          <div key={i} style={{ display: "flex", gap: 10, padding: "2px 0 2px 4px" }}>
            <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: "#E6EDF7", color: BLEU, fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>{num[1]}</span>
            <span><Inline texte={num[2]} surligne={surligne} /></span>
          </div>
        );
        if (/^[-•*] /.test(t)) return (
          <div key={i} style={{ display: "flex", gap: 9, padding: "2px 0 2px 8px" }}>
            <span style={{ color: "#2F6FDE", fontWeight: 800 }}>•</span><span><Inline texte={t.slice(2)} surligne={surligne} /></span>
          </div>
        );
        const art = t.match(/^(art\.?|article)\s*(\d+)\s*[:.\-–—]?\s*(.*)$/i);
        if (art) return (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "12px 0 3px" }}>
            <span style={{ background: BLEU, color: "#fff", borderRadius: 7, padding: "2px 9px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", marginTop: 2 }}>Art. {art[2]}</span>
            <span style={{ fontWeight: 700, color: "#14213A" }}><Inline texte={art[3] || ""} surligne={surligne} /></span>
          </div>
        );
        return <div key={i}><Inline texte={t} surligne={surligne} /></div>;
      })}
    </div>
  );
}

function Pastille({ texte, c, fond }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, color: c, background: fond, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>{texte}</span>;
}
function BadgeAudience({ r }) {
  const a = audienceReglement(r);
  return <Pastille texte={`${a.icone} ${a.label}`} c="#fff" fond={a.color} />;
}
function BadgeFraicheur({ r }) {
  if (joursDepuis(r.createdAt) <= 14) return <Pastille texte="🆕 Nouveau" c="#fff" fond="#E0A23A" />;
  if (joursDepuis(r.updatedAt) <= 14) return <Pastille texte="✏️ Mis à jour" c="#8A5A00" fond="#FFF1DC" />;
  return null;
}

function ReglementCarte({ r, numero, ouvert, onToggle, afficherAudience, surligne, children }) {
  const aud = audienceReglement(r);
  const na = nbArticles(r.contenu);
  return (
    <div id={`reg-${r.id}`} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${aud.color}`, borderRadius: 14, boxShadow: ouvert ? "0 12px 30px -16px rgba(7,20,46,0.4)" : "0 4px 16px -12px rgba(7,20,46,0.25)", overflow: "hidden", scrollMarginTop: 80, transition: "box-shadow .2s" }}>
      <button onClick={onToggle} aria-expanded={ouvert} style={{ width: "100%", textAlign: "left", background: ouvert ? "#F7FAFE" : "#fff", border: "none", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: aud.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_TITRE, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{numero}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: FONT_TITRE, fontSize: 16.5, fontWeight: 700, color: "#14213A" }}>{r.titre}</span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5, alignItems: "center" }}>
            {afficherAudience && <BadgeAudience r={r} />}
            {r.categorie && <Pastille texte={r.categorie} c="#3A4D6B" fond="#E9EFF7" />}
            <BadgeFraicheur r={r} />
            <span style={{ fontSize: 11, color: "#7B8AA3" }}>{na ? `${na} article${na > 1 ? "s" : ""} · ` : ""}~{minutesLecture(r.contenu)} min de lecture</span>
          </span>
        </span>
        <span style={{ fontSize: 14, color: "#5A6B84", flexShrink: 0, transform: ouvert ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
      </button>
      {ouvert && (
        <div style={{ padding: "6px 22px 20px", borderTop: "1px solid #E3EAF4" }}>
          <ContenuReglement texte={r.contenu} surligne={surligne} />
          {r.updatedAt && <div style={{ fontSize: 11, color: "#7B8AA3", marginTop: 16, paddingTop: 10, borderTop: "1px dashed #E3EAF4" }}>Dernière mise à jour : {dateLongue(r.updatedAt)}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

function BarreRecherche({ valeur, onChange, categories, categorie, onCategorie, onTout, toutOuvert, nbResultats }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: categories.length ? 10 : 0 }}>
        <div style={{ flex: "1 1 260px", position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}>🔎</span>
          <input value={valeur} onChange={(e) => onChange(e.target.value)} placeholder="Rechercher un mot, un article, une catégorie…" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 24, padding: "10px 14px 10px 36px", fontSize: 13.5, fontFamily: FONT_BASE, background: "#fff" }} />
        </div>
        {valeur.trim() && <span style={{ fontSize: 12, color: "#5A6B84" }}>{nbResultats} résultat{nbResultats > 1 ? "s" : ""}</span>}
        <button onClick={onTout} style={smallBtn}>{toutOuvert ? "Tout replier" : "Tout déplier"}</button>
      </div>
      {categories.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["", ...categories].map((c) => (
            <button key={c || "toutes"} onClick={() => onCategorie(c)} style={{ ...smallBtn, background: categorie === c ? BLEU : "transparent", color: categorie === c ? "#fff" : "#14213A", borderColor: categorie === c ? BLEU : "#C3D0E2" }}>{c || "Toutes les catégories"}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Sommaire : liste cliquable des règlements (ouvre et fait défiler jusqu'à la carte)
function Sommaire({ liste, tous, onChoisir }) {
  if (liste.length < 2) return null;
  return (
    <nav style={{ flex: "0 0 230px", position: "sticky", top: 78, alignSelf: "flex-start", background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 14, boxShadow: "0 4px 16px -12px rgba(7,20,46,0.25)", maxHeight: "calc(100vh - 110px)", overflowY: "auto" }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 8 }}>Sommaire</div>
      {liste.map((r) => (
        <button key={r.id} onClick={() => onChoisir(r.id)} style={{ display: "flex", gap: 8, alignItems: "flex-start", width: "100%", textAlign: "left", background: "none", border: "none", padding: "6px 4px", cursor: "pointer", borderRadius: 8, fontFamily: FONT_BASE, fontSize: 12.5, color: "#14213A" }}>
          <span style={{ color: audienceReglement(r).color, fontWeight: 800, minWidth: 18 }}>{tous.indexOf(r) + 1}.</span>
          <span>{r.titre}</span>
        </button>
      ))}
    </nav>
  );
}

function Hero({ titre, sous, chiffres }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #0F2A5C 0%, #123A7A 55%, #2F6FDE 100%)", color: "#fff", borderRadius: 16, padding: "22px 24px", marginBottom: 18, boxShadow: "0 14px 34px -18px rgba(7,20,46,0.6)" }}>
      <div style={{ fontFamily: FONT_TITRE, fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{titre}</div>
      <div style={{ fontSize: 13, opacity: 0.88, lineHeight: 1.6, maxWidth: 640 }}>{sous}</div>
      {chiffres.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          {chiffres.map(([n, l]) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.14)", borderRadius: 10, padding: "6px 14px" }}>
              <b style={{ fontSize: 18 }}>{n}</b> <span style={{ fontSize: 12, opacity: 0.9 }}>{l}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function defilerVers(id) {
  setTimeout(() => { const el = document.getElementById(`reg-${id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
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
  const estOuvert = (r) => !!ouverts[r.id] || !!s;
  const toutOuvert = filtres.length > 0 && filtres.every(estOuvert);
  function toutBasculer() {
    const n = { ...ouverts };
    filtres.forEach((r) => { n[r.id] = !toutOuvert; });
    setOuverts(n);
  }
  function choisir(id) { setOuverts({ ...ouverts, [id]: true }); setSearch(""); setCategorie(""); defilerVers(id); }
  const derniere = liste.reduce((m, r) => (String(r.updatedAt || "") > m ? String(r.updatedAt) : m), "");
  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 60px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 1020, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16, background: "#fff" }}>← Retour</button>
        <Hero titre="📜 Règlements de Nîmes RP" sous="Les règles à respecter sur le serveur. Merci de les lire avant de jouer : l'ignorance d'une règle n'empêche pas la sanction."
          chiffres={liste.length ? [[liste.length, `règlement${liste.length > 1 ? "s" : ""}`], ...(derniere ? [[dateLongue(derniere), "dernière mise à jour"]] : [])] : []} />
        {liste.length > 0 && <BarreRecherche valeur={search} onChange={setSearch} categories={categories} categorie={categorie} onCategorie={setCategorie} onTout={toutBasculer} toutOuvert={toutOuvert} nbResultats={filtres.length} />}
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <Sommaire liste={filtres} tous={liste} onChoisir={choisir} />
          <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {filtres.map((r) => (
              <ReglementCarte key={r.id} r={r} numero={liste.indexOf(r) + 1} ouvert={estOuvert(r)} surligne={s} onToggle={() => setOuverts({ ...ouverts, [r.id]: !ouverts[r.id] })} afficherAudience={false} />
            ))}
            {chargement && <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement…</div>}
            {erreur && <div style={{ color: "#C0172D", fontSize: 13 }}>Impossible de charger les règlements pour l'instant. Réessaie plus tard.</div>}
            {!chargement && !erreur && liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun règlement publié pour l'instant.</div>}
            {liste.length > 0 && filtres.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun résultat pour cette recherche.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

const OUTILS = [
  { label: "Titre", ins: "# ", aide: "Intertitre", bloc: true },
  { label: "Sous-titre", ins: "## ", aide: "Sous-titre", bloc: true },
  { label: "Article", ins: "Article 1 — ", aide: "Article numéroté", bloc: true },
  { label: "• Puce", ins: "- ", aide: "Liste à puces", bloc: true },
  { label: "1. Liste", ins: "1. ", aide: "Liste numérotée", bloc: true },
  { label: "💡 Note", ins: "> ", aide: "Encadré d'information", bloc: true },
  { label: "⚠️ Attention", ins: "!! ", aide: "Encadré rouge (sanctions, interdits)", bloc: true },
  { label: "Gras", ins: "**texte**", aide: "Mettre en gras", bloc: false },
  { label: "― Ligne", ins: "---", aide: "Ligne de séparation", bloc: true },
];

// Page interne (gendarmes) : voit tous les règlements ; l'admin peut créer / modifier / ordonner
export function ReglementsPage({ current, reglements, onCreate, onUpdate, onDelete, onMove }) {
  const blank = { titre: "", contenu: "", audience: "gendarmes", categorie: "" };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [ouverts, setOuverts] = useState({});
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState("");
  const [filtre, setFiltre] = useState("toutes");
  const [formOuvert, setFormOuvert] = useState(false);
  const zone = useRef(null);

  const liste = trierReglements(reglements);
  const categories = Array.from(new Set(liste.map((r) => r.categorie).filter(Boolean)));
  const s = search.trim().toLowerCase();
  const filtres = liste.filter((r) => (filtre === "toutes" || (r.audience || "gendarmes") === filtre) && reglementCorrespond(r, s) && (!categorie || r.categorie === categorie));
  const peutOrdonner = current.isAdmin && filtre === "toutes" && !s && !categorie;
  const estOuvert = (r) => !!ouverts[r.id] || !!s;
  const toutOuvert = filtres.length > 0 && filtres.every(estOuvert);
  const compte = (id) => liste.filter((r) => (r.audience || "gendarmes") === id).length;
  const derniere = liste.reduce((m, r) => (String(r.updatedAt || "") > m ? String(r.updatedAt) : m), "");

  function toutBasculer() {
    const n = { ...ouverts };
    filtres.forEach((r) => { n[r.id] = !toutOuvert; });
    setOuverts(n);
  }
  function submit(e) {
    e.preventDefault();
    if (!form.titre.trim() || !form.contenu.trim()) return;
    if (editingId) onUpdate(editingId, form); else onCreate(form);
    setEditingId(null); setForm(blank); setFormOuvert(false);
  }
  function startEdit(r) {
    setEditingId(r.id);
    setForm({ titre: r.titre || "", contenu: r.contenu || "", audience: r.audience || "gendarmes", categorie: r.categorie || "" });
    setFormOuvert(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function dupliquer(r) {
    onCreate({ titre: `${r.titre} (copie)`, contenu: r.contenu || "", audience: r.audience || "gendarmes", categorie: r.categorie || "" });
  }
  function annuler() { setEditingId(null); setForm(blank); setFormOuvert(false); }
  function inserer(o) {
    const el = zone.current;
    const texte = form.contenu;
    const debut = el ? el.selectionStart : texte.length;
    const fin = el ? el.selectionEnd : texte.length;
    let nouveau; let pos;
    if (o.bloc) {
      const avant = texte.slice(0, debut);
      const sautAvant = avant.length === 0 || avant.endsWith("\n") ? "" : "\n";
      nouveau = avant + sautAvant + o.ins + texte.slice(debut);
      pos = avant.length + sautAvant.length + o.ins.length;
    } else {
      const choisi = texte.slice(debut, fin);
      const ajout = choisi ? `**${choisi}**` : o.ins;
      nouveau = texte.slice(0, debut) + ajout + texte.slice(fin);
      pos = debut + ajout.length;
    }
    setForm({ ...form, contenu: nouveau });
    setTimeout(() => { if (zone.current) { zone.current.focus(); zone.current.setSelectionRange(pos, pos); } }, 0);
  }
  function choisir(id) { setOuverts({ ...ouverts, [id]: true }); defilerVers(id); }

  const onglets = [{ id: "toutes", label: "Tous", n: liste.length }, ...AUDIENCES_REGLEMENT.map((a) => ({ id: a.id, label: a.label, n: compte(a.id) }))];

  return (
    <div>
      <h2 style={h2Style}>Règlements</h2>
      <Hero titre="📜 Règlements" sous="Tous les règlements du serveur : espace gendarmes, page publique des civils, ou les deux. Utilise le sommaire pour aller directement à un règlement."
        chiffres={[[liste.length, `règlement${liste.length > 1 ? "s" : ""}`], [compte("gendarmes"), "gendarmes"], [compte("civils") + compte("tous"), "publics"], ...(derniere ? [[dateLongue(derniere), "dernière mise à jour"]] : [])]} />

      {current.isAdmin && !formOuvert && (
        <button onClick={() => setFormOuvert(true)} style={{ ...buttonPrimary, width: "auto", padding: "10px 20px", marginBottom: 18 }}>+ Nouveau règlement</button>
      )}
      {current.isAdmin && formOuvert && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 16, padding: 22, marginBottom: 24, boxShadow: "0 10px 30px -14px rgba(7,20,46,0.35)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>{editingId ? "✏️ Modifier le règlement" : "➕ Nouveau règlement"}</div>
          <form onSubmit={submit}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "2 1 260px" }}>
                <label style={labelStyle}>Titre</label>
                <input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Ex : Règlement de la route" style={{ ...selectStyle, marginBottom: 12 }} />
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label style={labelStyle}>Visible par</label>
                <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} style={{ ...selectStyle, marginBottom: 12 }}>
                  {AUDIENCES_REGLEMENT.map((a) => <option key={a.id} value={a.id}>{a.icone} {a.label}{a.id === "civils" ? " (page publique)" : a.id === "tous" ? " (gendarmes + civils)" : " (espace gendarmes)"}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label style={labelStyle}>Catégorie (facultatif)</label>
                <input list="categories-reglements" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} placeholder="Ex : Circulation, Zones, Armes…" style={{ ...selectStyle, marginBottom: 12 }} />
                <datalist id="categories-reglements">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
            </div>

            <label style={labelStyle}>Contenu</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {OUTILS.map((o) => <button key={o.label} type="button" title={o.aide} onClick={() => inserer(o)} style={{ ...smallBtn, padding: "5px 11px", background: "#F5F8FC" }}>{o.label}</button>)}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
              <textarea ref={zone} value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} placeholder={"# Intertitre\nArticle 1 — Titre de l'article\nTexte de l'article avec du **gras**.\n- une puce\n> une note\n!! une interdiction ou une sanction"} style={{ flex: "1 1 320px", minHeight: 320, boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 10, padding: "11px 13px", fontSize: 13, fontFamily: "'Courier New', monospace", lineHeight: 1.6, resize: "vertical" }} />
              <div style={{ flex: "1 1 320px", minHeight: 320, maxHeight: 520, overflowY: "auto", background: "#F5F8FC", border: "1px dashed #C3D0E2", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 6 }}>Aperçu en direct</div>
                {form.contenu.trim() ? <ContenuReglement texte={form.contenu} /> : <div style={{ color: "#8A97AB", fontSize: 13 }}>Ce que tu écris apparaît ici, mis en forme.</div>}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "#5A6B84", margin: "8px 0 14px" }}>
              {nbMots(form.contenu)} mots · ~{minutesLecture(form.contenu)} min de lecture · <b># </b>titre · <b>## </b>sous-titre · <b>Article 1 — </b>article · <b>- </b>puce · <b>1. </b>liste · <b>&gt; </b>note · <b>!! </b>attention · <b>**gras**</b>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "10px 22px", marginTop: 0 }}>{editingId ? "Enregistrer" : "Publier"}</button>
              <button type="button" onClick={annuler} style={{ ...smallBtn, padding: "10px 18px" }}>Annuler</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {onglets.map((o) => (
          <button key={o.id} onClick={() => setFiltre(o.id)} style={{ ...smallBtn, background: filtre === o.id ? BLEU : "transparent", color: filtre === o.id ? "#fff" : "#14213A", borderColor: filtre === o.id ? BLEU : "#C3D0E2" }}>{o.label} ({o.n})</button>
        ))}
      </div>
      <BarreRecherche valeur={search} onChange={setSearch} categories={categories} categorie={categorie} onCategorie={setCategorie} onTout={toutBasculer} toutOuvert={toutOuvert} nbResultats={filtres.length} />

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Sommaire liste={filtres} tous={liste} onChoisir={choisir} />
        <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {filtres.map((r) => {
            const pos = liste.findIndex((x) => x.id === r.id);
            return (
              <ReglementCarte key={r.id} r={r} numero={pos + 1} ouvert={estOuvert(r)} surligne={s} onToggle={() => setOuverts({ ...ouverts, [r.id]: !ouverts[r.id] })} afficherAudience>
                {current.isAdmin && (
                  <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                    <button onClick={() => startEdit(r)} style={smallBtn}>✏️ Modifier</button>
                    <button onClick={() => dupliquer(r)} style={smallBtn}>⧉ Dupliquer</button>
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
    </div>
  );
}
