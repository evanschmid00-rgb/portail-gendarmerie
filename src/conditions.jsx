// pages/conditions.jsx — Conditions d'admission : écran affiché aux civils avant la candidature (avec bouton de confirmation)
// + page de modification pour les admins. Le texte est stocké dans Firestore : settings/conditions_admission.
import React, { useState } from "react";
import { h2Style, smallBtn } from "../composants/ui.jsx";
import { ContenuFiche } from "./formation.jsx";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
export const CONDITIONS_DOC = "conditions_admission";
export const aDesConditions = (c) => !!(c && String(c.texte || "").trim());

/* ---------- Écran affiché aux civils avant le formulaire ---------- */

export function ConditionsAdmission({ texte, onConfirm, onCancel }) {
  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 60px", fontFamily: FONT }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>

        <div style={{ background: "linear-gradient(135deg, #0C2655, #123A7A)", color: "#fff", borderRadius: 16, padding: "22px 24px", marginBottom: 16, boxShadow: "0 10px 30px -14px rgba(7,20,46,0.6)" }}>
          <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>📋 Conditions d'admission</div>
          <div style={{ fontSize: 13.5, opacity: 0.88, lineHeight: 1.5 }}>Avant de remplir ta candidature, lis attentivement les conditions ci-dessous. Tu devras confirmer que tu les remplis toutes.</div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: "20px 22px", boxShadow: "0 6px 20px -12px rgba(7,20,46,0.3)", marginBottom: 18 }}>
          <ContenuFiche texte={texte} />
        </div>

        <div style={{ background: "#E3F2E8", border: "1px solid #2E7D4F", borderRadius: 14, padding: "18px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 13.5, color: "#1F4D33", lineHeight: 1.5, marginBottom: 12 }}>En continuant, tu certifies sur l'honneur que tu respectes <b>toutes</b> les conditions d'admission ci-dessus. Cette confirmation sera visible par le recrutement dans ta candidature.</div>
          <button type="button" onClick={onConfirm} className="gh-btn-anim" style={{ background: "#2E7D4F", color: "#fff", border: "none", borderRadius: 12, padding: "13px 26px", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: FONT }}>✅ Je confirme respecter les conditions d'admission</button>
        </div>
      </div>
    </div>
  );
}

// Bandeau affiché au-dessus du formulaire une fois la confirmation donnée
export function BandeauConditionsConfirmees() {
  return (
    <div style={{ background: "#E3F2E8", borderBottom: "1px solid #2E7D4F", color: "#1F6B42", fontFamily: FONT, fontSize: 13, fontWeight: 700, textAlign: "center", padding: "8px 14px" }}>
      ✅ Conditions d'admission confirmées — cette mention sera jointe à ta candidature.
    </div>
  );
}

/* ---------- Page de modification (admins) ---------- */

const zone = { width: "100%", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: FONT, lineHeight: 1.5, resize: "vertical", background: "#fff" };

export function ConditionsAdmin({ conditions, onSave }) {
  const [texte, setTexte] = useState((conditions && conditions.texte) || "");
  const [etat, setEtat] = useState({ busy: false, msg: "", ok: false });

  async function enregistrer() {
    setEtat({ busy: true, msg: "", ok: false });
    const ok = await onSave(texte.trim());
    setEtat(ok ? { busy: false, msg: texte.trim() ? "✓ Conditions publiées : les civils les verront avant la candidature." : "✓ Conditions retirées : la candidature s'ouvre directement.", ok: true } : { busy: false, msg: "Échec de l'enregistrement (droits ou connexion).", ok: false });
  }

  return (
    <div style={{ maxWidth: 860, fontFamily: FONT }}>
      <h2 style={h2Style}>Conditions d'admission</h2>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 16, lineHeight: 1.5 }}>
        Ce texte s'affiche aux civils quand ils cliquent sur « Rejoindre la gendarmerie », avant le formulaire. Ils doivent appuyer sur un bouton pour confirmer qu'ils respectent les conditions ; la confirmation est jointe à la candidature.
        Laisse le champ vide pour ne pas afficher de conditions.
      </div>

      <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 18, boxShadow: "0 6px 20px -12px rgba(7,20,46,0.3)", marginBottom: 18 }}>
        <div style={{ fontSize: 11.5, color: "#5A6B84", marginBottom: 6, lineHeight: 1.5 }}>Mise en forme : <code># Grand titre</code> · <code>## Sous-titre</code> · <code>- une condition par puce</code> · <code>&gt; remarque encadrée</code> · <code>**gras**</code> · une ligne vide sépare les paragraphes.</div>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value.slice(0, 6000))} rows={14} style={{ ...zone, marginBottom: 12 }} placeholder={"# Conditions pour rejoindre la Gendarmerie\n\n- Avoir un compte Roblox\n- Être présent sur le Discord\n- …"} />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={enregistrer} disabled={etat.busy} style={{ background: "#123A7A", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontFamily: FONT, opacity: etat.busy ? 0.7 : 1 }}>{etat.busy ? "Enregistrement…" : "Publier les conditions"}</button>
          {etat.msg && <span style={{ fontSize: 13, fontWeight: 600, color: etat.ok ? "#1F6B42" : "#C0172D" }}>{etat.msg}</span>}
        </div>
        {conditions && conditions.updatedAt && <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 10 }}>Dernière modification : {new Date(conditions.updatedAt).toLocaleString("fr-FR")}{conditions.updatedBy ? ` — ${conditions.updatedBy}` : ""}</div>}
      </div>

      {texte.trim() && (
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 8 }}>Aperçu</div>
          <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: "20px 22px" }}><ContenuFiche texte={texte} /></div>
        </div>
      )}
    </div>
  );
}
