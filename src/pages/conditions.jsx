// pages/conditions.jsx — conditions générales (communes à toutes les candidatures externes) : page admin, écran candidat, bandeau de confirmation.
import React, { useState } from "react";
import { buttonPrimary, h2Style, smallBtn } from "../composants/ui.jsx";
import { Ecusson } from "../composants/Ecusson.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";
import { dateLongue } from "../lib/utils.js";

export const CONDITIONS_DOC = "conditions_admission";
export const aDesConditions = (c) => !!(c && String(c.texte || "").trim());

const MODELE = `Conditions de recrutement :
- Avoir 14 ans minimum
- Posséder un compte Roblox et un compte Discord
- Être actif sur le serveur Discord de la gendarmerie
- Avoir lu et accepté le règlement du serveur

Engagements :
- Respecter la hiérarchie et les autres joueurs
- Jouer son rôle avec sérieux et fair-play
- Ne jamais partager ses identifiants de connexion`;

// Affiche un texte de conditions : lignes en liste (- ou •), sous-titres (ligne finissant par « : »), paragraphes
export function TexteConditions({ texte, compact = false }) {
  const lignes = String(texte || "").split(/\r?\n/);
  const blocs = lignes.map((l, i) => {
    const t = l.trim();
    if (!t) return <div key={i} style={{ height: compact ? 6 : 10 }} />;
    const puce = /^([-•*–]|\d+[.)])\s+/.exec(t);
    if (puce) return (
      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "0 0 7px" }}>
        <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#E3F2E8", color: "#2E7D4F", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>✓</span>
        <span style={{ fontSize: compact ? 13 : 14, color: "#14213A", lineHeight: 1.55 }}>{t.slice(puce[0].length)}</span>
      </div>
    );
    if (/:\s*$/.test(t) || (t === t.toUpperCase() && /[A-ZÉÈ]{4,}/.test(t))) return <div key={i} style={{ fontFamily: FONT_TITRE, fontSize: compact ? 15 : 17, fontWeight: 700, color: "#123A7A", margin: "10px 0 8px" }}>{t}</div>;
    return <div key={i} style={{ fontSize: compact ? 13 : 14, color: "#3A4D6B", lineHeight: 1.6, margin: "0 0 6px" }}>{t}</div>;
  });
  return <div>{blocs}</div>;
}

// Bandeau affiché au-dessus du formulaire une fois les conditions acceptées
export function BandeauConditionsConfirmees() {
  return (
    <div style={{ background: "#E3F2E8", borderBottom: "1px solid #2E7D4F", color: "#1F6B42", textAlign: "center", fontSize: 13, fontWeight: 700, padding: "9px 14px", fontFamily: FONT_BASE }}>
      ✅ Conditions générales acceptées
    </div>
  );
}

// Ancien écran unique (conservé pour compatibilité) : conditions générales avec case à cocher
export function ConditionsAdmission({ texte, onConfirm, onCancel }) {
  const [coche, setCoche] = useState(false);
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 10%, #123A7A, #07142E 65%)", padding: "32px 20px 60px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><Ecusson taille={58} /></div>
        <button type="button" onClick={onCancel} style={{ background: "none", border: "none", color: "#A9B8CE", fontSize: 13, cursor: "pointer", marginBottom: 14 }}>← Annuler</button>
        <div style={{ background: "#F7FAFD", borderRadius: 20, overflow: "hidden", boxShadow: "0 34px 64px -26px rgba(0,0,0,0.75)" }}>
          <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: "#C0172D" }} /></div>
          <div style={{ padding: "24px 26px 26px" }}>
            <div style={{ fontFamily: FONT_TITRE, fontSize: 25, fontWeight: 700, color: "#14213A", marginBottom: 14 }}>Conditions générales</div>
            <div style={{ maxHeight: "46vh", overflowY: "auto", background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: "16px 18px" }}><TexteConditions texte={texte} /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, padding: "13px 15px", background: coche ? "#E3F2E8" : "#fff", border: `2px solid ${coche ? "#2E7D4F" : "#C3D0E2"}`, borderRadius: 14, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#14213A" }}>
              <input type="checkbox" checked={coche} onChange={(e) => setCoche(e.target.checked)} style={{ width: 20, height: 20 }} /> J'ai lu et j'accepte les conditions générales.
            </label>
            <button type="button" onClick={() => coche && onConfirm()} disabled={!coche} style={{ ...buttonPrimary, marginTop: 14, opacity: coche ? 1 : 0.45 }}>{coche ? "Continuer →" : "Cochez la case pour continuer"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Page admin : rédaction et publication des conditions générales
export function ConditionsAdmin({ conditions, onSave }) {
  const [texte, setTexte] = useState((conditions && conditions.texte) || "");
  const [etat, setEtat] = useState({ busy: false, msg: "", ok: true });
  const publiees = aDesConditions(conditions);
  const modifie = texte.trim() !== String((conditions && conditions.texte) || "").trim();
  const nbLignes = texte.split(/\r?\n/).filter((l) => /^\s*([-•*–]|\d+[.)])\s+/.test(l)).length;
  const MAX = 6000;

  async function enregistrer(valeur, message) {
    setEtat({ busy: true, msg: "", ok: true });
    const ok = await onSave(valeur);
    setEtat({ busy: false, ok, msg: ok ? message : "Échec de l'enregistrement, réessaie." });
    if (ok) setTimeout(() => setEtat((e) => ({ ...e, msg: "" })), 5000);
  }

  return (
    <div style={{ maxWidth: 960, fontFamily: FONT_BASE }}>
      <h2 style={h2Style}>Conditions générales</h2>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: publiees ? "#E3F2E8" : "#FFF4E0", border: `1px solid ${publiees ? "#2E7D4F" : "#E8D28A"}`, borderRadius: 16, padding: "14px 18px", marginBottom: 18 }}>
        <span style={{ width: 44, height: 44, borderRadius: 14, background: publiees ? "#2E7D4F" : "#E0A23A", color: "#fff", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{publiees ? "✓" : "!"}</span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: publiees ? "#1F6B42" : "#8A5A00" }}>{publiees ? "Conditions générales publiées" : "Aucune condition générale publiée"}</div>
          <div style={{ fontSize: 12.5, color: "#3A4D6B", marginTop: 2, lineHeight: 1.5 }}>
            {publiees ? <>Dernière mise à jour{conditions.updatedAt ? ` le ${dateLongue(conditions.updatedAt)}` : ""}{conditions.updatedBy ? ` par ${conditions.updatedBy}` : ""}.</> : "Les candidats passent directement au formulaire tant que rien n'est publié."}
          </div>
        </div>
      </div>

      <div style={{ background: "#F6F9FD", border: "1px solid #D3DDEA", borderRadius: 14, padding: "12px 16px", marginBottom: 18, fontSize: 13, color: "#3A4D6B", lineHeight: 1.6 }}>
        <b>Comment ça marche ?</b> Chaque candidat externe lit ces <b>conditions générales</b> (communes à toutes les candidatures) et coche une case, puis il voit les <b>conditions d'admission propres</b> à la candidature choisie (à régler dans « Questionnaires »), avant de remplir le formulaire. Astuce : commence une ligne par « - » pour en faire une condition à cocher, et termine une ligne par « : » pour créer un titre.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: "4px solid #123A7A", borderRadius: 18, padding: 20, boxShadow: "0 18px 40px -28px rgba(7,20,46,0.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ fontFamily: FONT_TITRE, fontSize: 18, fontWeight: 700, color: "#14213A" }}>✍️ Rédaction</div>
            <button type="button" style={smallBtn} onClick={() => { if (!texte.trim() || window.confirm("Remplacer le texte actuel par le modèle ?")) setTexte(MODELE); }}>📄 Insérer un modèle</button>
          </div>
          <textarea value={texte} onChange={(e) => setTexte(e.target.value.slice(0, MAX))} rows={16} placeholder={"Conditions de recrutement :\n- Avoir 14 ans minimum\n- Être actif sur Discord"} style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #C3D0E2", borderRadius: 12, padding: "12px 14px", fontSize: 14, lineHeight: 1.6, fontFamily: "inherit", resize: "vertical", color: "#14213A" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#5A6B84", margin: "6px 2px 14px" }}>
            <span>{nbLignes} condition{nbLignes > 1 ? "s" : ""} à cocher</span>
            <span>{texte.length} / {MAX} caractères</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" disabled={etat.busy || !texte.trim()} onClick={() => enregistrer(texte.trim(), "✅ Conditions générales publiées.")} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "11px 22px", marginTop: 0, opacity: !texte.trim() ? 0.5 : 1 }}>{etat.busy ? "Enregistrement…" : modifie ? "Publier les modifications" : "Publier"}</button>
            {publiees && <button type="button" disabled={etat.busy} onClick={() => { if (window.confirm("Retirer les conditions générales ? Les candidats passeront directement au formulaire.")) { setTexte(""); enregistrer("", "Conditions générales retirées."); } }} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D", padding: "10px 16px" }}>Retirer</button>}
            {modifie && !etat.busy && <span style={{ fontSize: 12, color: "#8A5A00", fontWeight: 700 }}>● Modifications non publiées</span>}
          </div>
          {etat.msg && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: etat.ok ? "#1F6B42" : "#C0172D" }}>{etat.msg}</div>}
        </div>

        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: "4px solid #2E7D4F", borderRadius: 18, padding: 20, boxShadow: "0 18px 40px -28px rgba(7,20,46,0.5)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 18, fontWeight: 700, color: "#14213A", marginBottom: 10 }}>👁️ Aperçu pour le candidat</div>
          <div style={{ background: "#F7FAFD", border: "1px solid #E1E8F2", borderRadius: 14, padding: "16px 18px", minHeight: 200 }}>
            <div style={{ fontFamily: FONT_TITRE, fontSize: 20, fontWeight: 700, color: "#14213A", marginBottom: 12 }}>Conditions générales</div>
            {texte.trim() ? <TexteConditions texte={texte} compact /> : <div style={{ fontSize: 13, color: "#8FA0B8" }}>Le texte que tu écris apparaîtra ici, tel que le candidat le verra.</div>}
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "2px solid #C3D0E2", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>
              <span style={{ width: 18, height: 18, border: "2px solid #8FA0B8", borderRadius: 4, flexShrink: 0 }} /> J'ai lu et j'accepte les conditions générales.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
