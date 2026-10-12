// pages/annonces.jsx — annonces du commandement (page + carte épinglée du tableau de bord)
import React, { useState } from "react";
import { estCommandement } from "../lib/constantes.js";
import { FONT_TITRE } from "../lib/constantes.js";
import { dateCourteFR } from "../lib/utils.js";
import { Field, buttonPrimary, h2Style, labelStyle, smallBtn } from "../composants/ui.jsx";

const IMPORTANCES = ["Information", "Important", "Urgent"];
const COUL_IMP = { Information: "#2F6FDE", Important: "#B25E00", Urgent: "#C0172D" };
const FOND_IMP = { Information: "#E6EDF7", Important: "#FFF4E0", Urgent: "#FDECEC" };

// Le commandement et les administrateurs publient ; tous les gendarmes lisent
export const peutPublierAnnonce = (p) => !!p && (p.isAdmin === true || estCommandement(p.unite));
export const trierAnnonces = (liste) => liste.slice().sort((a, b) => (b.epingle === true) - (a.epingle === true) || String(b.createdAt).localeCompare(String(a.createdAt)));

// Carte affichée tout en haut du tableau de bord de chaque gendarme
export function AnnonceEpinglee({ annonce, onOpen }) {
  const c = COUL_IMP[annonce.importance] || COUL_IMP.Information;
  const extrait = String(annonce.contenu || "").length > 260 ? annonce.contenu.slice(0, 260).trim() + "…" : annonce.contenu;
  return (
    <div style={{ background: "#fff", border: `1px solid ${c}`, borderLeft: `6px solid ${c}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20, boxShadow: `0 10px 28px -18px ${c}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: c }}>📌 ANNONCE DU COMMANDEMENT{annonce.importance === "Urgent" ? " — URGENT" : ""}</span>
        <span style={{ fontSize: 11.5, color: "#5A6B84" }}>{annonce.auteurNom} · {dateCourteFR(annonce.createdAt)}</span>
      </div>
      <div style={{ fontFamily: FONT_TITRE, fontSize: 19, fontWeight: 700, color: "#14213A", marginBottom: 6 }}>{annonce.titre}</div>
      <div style={{ fontSize: 13.5, color: "#2A3B57", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{extrait}</div>
      <button onClick={onOpen} style={{ ...smallBtn, marginTop: 12, background: c, color: "#fff", borderColor: c }}>Lire l'annonce</button>
    </div>
  );
}

export function AnnoncesPage({ current, annonces, onCreate, onUpdate, onDelete, onPin }) {
  const publie = peutPublierAnnonce(current);
  const blank = { titre: "", contenu: "", importance: "Information", epingle: false };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  const liste = trierAnnonces(annonces);

  function annuler() { setForm(blank); setEditId(null); setOuvert(false); setErreur(""); }
  function modifier(a) {
    setForm({ titre: a.titre || "", contenu: a.contenu || "", importance: a.importance || "Information", epingle: a.epingle === true });
    setEditId(a.id); setOuvert(true); setErreur("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function submit(e) {
    e.preventDefault();
    if (form.titre.trim().length < 3) { setErreur("Donne un titre à l'annonce."); return; }
    if (form.contenu.trim().length < 5) { setErreur("Écris le contenu de l'annonce."); return; }
    if (form.contenu.length > 4500) { setErreur("L'annonce est trop longue (4 500 caractères maximum)."); return; }
    setErreur(""); setBusy(true);
    const ok = editId ? await onUpdate(editId, form) : await onCreate(form);
    setBusy(false);
    if (ok) annuler(); else setErreur("Impossible d'enregistrer l'annonce, réessaie.");
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={h2Style}>Annonces du commandement</h2>

      {publie && !ouvert && <button onClick={() => setOuvert(true)} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 20px", marginTop: 0, marginBottom: 20 }}>+ Nouvelle annonce</button>}
      {publie && ouvert && (
        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, fontFamily: FONT_TITRE }}>{editId ? "Modifier l'annonce" : "Nouvelle annonce"}</div>
          <Field label="Titre" value={form.titre} onChange={(v) => setForm({ ...form, titre: v })} placeholder="Ex : Réunion générale samedi 21h" />
          <label style={labelStyle}>Importance</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {IMPORTANCES.map((i) => (
              <button type="button" key={i} onClick={() => setForm({ ...form, importance: i })} style={{ border: `1.5px solid ${COUL_IMP[i]}`, background: form.importance === i ? COUL_IMP[i] : "#fff", color: form.importance === i ? "#fff" : COUL_IMP[i], borderRadius: 20, padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{i}</button>
            ))}
          </div>
          <Field label="Contenu" textarea value={form.contenu} onChange={(v) => setForm({ ...form, contenu: v })} placeholder="Ton message à tous les gendarmes…" />
          <div style={{ fontSize: 11, color: form.contenu.length > 4500 ? "#C0172D" : "#7B8AA3", margin: "-6px 0 12px", textAlign: "right" }}>{form.contenu.length} / 4500</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={form.epingle} onChange={(e) => setForm({ ...form, epingle: e.target.checked })} />
            📌 Épingler en haut du tableau de bord de chaque gendarme <span style={{ color: "#5A6B84" }}>(remplace l'annonce épinglée actuelle)</span>
          </label>
          {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 20px", marginTop: 0 }}>{busy ? "Enregistrement…" : editId ? "Enregistrer" : "Publier"}</button>
            <button type="button" onClick={annuler} style={{ ...smallBtn, padding: "9px 16px" }}>Annuler</button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {liste.map((a) => {
          const c = COUL_IMP[a.importance] || COUL_IMP.Information;
          return (
            <div key={a.id} style={{ background: a.epingle ? FOND_IMP[a.importance] || "#fff" : "#fff", border: "1px solid #D3DDEA", borderLeft: `6px solid ${c}`, borderRadius: 12, padding: "16px 20px", boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {a.epingle && <span style={{ fontSize: 11, fontWeight: 800, color: c }}>📌 ÉPINGLÉE</span>}
                  <span style={{ background: c, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 14, padding: "2px 10px" }}>{a.importance}</span>
                </div>
                <span style={{ fontSize: 11.5, color: "#5A6B84" }}>{a.auteurNom} · {dateCourteFR(a.createdAt)}{a.updatedAt && a.updatedAt !== a.createdAt ? " (modifiée)" : ""}</span>
              </div>
              <div style={{ fontFamily: FONT_TITRE, fontSize: 18, fontWeight: 700, color: "#14213A", marginBottom: 6 }}>{a.titre}</div>
              <div style={{ fontSize: 13.5, color: "#2A3B57", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{a.contenu}</div>
              {publie && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={() => onPin(a.id, !a.epingle)} style={smallBtn}>{a.epingle ? "Désépingler" : "📌 Épingler"}</button>
                  <button onClick={() => modifier(a)} style={smallBtn}>Modifier</button>
                  <button onClick={() => { if (window.confirm(`Supprimer l'annonce « ${a.titre} » ?`)) onDelete(a.id); }} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Supprimer</button>
                </div>
              )}
            </div>
          );
        })}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune annonce pour le moment.</div>}
      </div>
    </div>
  );
}
