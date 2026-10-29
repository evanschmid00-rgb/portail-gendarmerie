// pages/iggn.jsx — Contacter l'Inspection Générale de la Gendarmerie Nationale (IGGN) pour signaler un gendarme.
// Présenté comme un document officiel (bannière + logo). Le signalement n'est lisible que par les administrateurs
// et les Référents Déontologie. Le formulaire lui-même est PlainteForm (mode « iggn »).
import React, { useState } from "react";
import { PlainteForm } from "./plaintes.jsx";
import { buttonPrimary, smallBtn } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";


// Petite carte pour l'accueil civil
export function CarteIGGN({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="gh-card-anim" style={{ display: "flex", alignItems: "center", gap: 18, width: "100%", textAlign: "left", cursor: "pointer", border: "1px solid #1B3F7D", background: "linear-gradient(135deg, #07142E 0%, #0F2A5C 70%, #14377A 100%)", color: "#fff", borderRadius: 20, padding: "18px 22px", boxShadow: "0 22px 44px -26px rgba(7,20,46,0.8)", fontFamily: FONT_BASE, flexWrap: "wrap" }}>
      <img src="/logo-iggn.png" alt="Inspection Générale de la Gendarmerie Nationale" style={{ width: 84, height: 84, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.5))" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <span style={{ flex: 1, minWidth: 220 }}>
        <span style={{ display: "block", fontSize: 11, letterSpacing: 3, color: "#E2C275", fontWeight: 700 }}>INSPECTION GÉNÉRALE</span>
        <span style={{ display: "block", fontFamily: FONT_TITRE, fontSize: 23, fontWeight: 700, marginTop: 2 }}>Contacter l'IGGN pour signaler un gendarme</span>
        <span style={{ display: "block", fontSize: 13.5, opacity: 0.88, marginTop: 4, lineHeight: 1.5 }}>Comportement abusif, manquement à la déontologie… Votre signalement n'est lu que par les administrateurs et les référents déontologie.</span>
      </span>
      <span style={{ background: "#fff", color: "#0F2A5C", fontWeight: 800, fontSize: 13.5, borderRadius: 10, padding: "10px 20px", flexShrink: 0 }}>Rédiger un signalement →</span>
    </button>
  );
}

const li = { margin: "0 0 7px", lineHeight: 1.6 };

// Présentation du dispositif sous forme de document officiel
export function IGGNPresentation({ onStart, onCancel, interne = false }) {
  const jour = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div style={{ minHeight: interne ? undefined : "100vh", background: "#E9EFF7", padding: interne ? "0 0 40px" : "32px 20px 60px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {onCancel && <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16, background: "#fff" }}>← Retour</button>}
        <div style={{ background: "#fff", borderRadius: 6, overflow: "hidden", boxShadow: "0 30px 60px -30px rgba(7,20,46,0.6)", border: "1px solid #C3D0E2" }}>
          <img src="/banniere-iggn.jpg" alt="Inspection Générale de la Gendarmerie Nationale" style={{ display: "block", width: "100%", height: "auto" }} />
          <div style={{ display: "flex", height: 6 }}><div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: "#C0172D" }} /></div>
          <div style={{ padding: "30px clamp(20px, 5vw, 52px) 36px", color: "#14213A" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#5A6B84", borderBottom: "1px solid #D3DDEA", paddingBottom: 12, marginBottom: 22 }}>
              <span><b style={{ color: "#14213A" }}>GENDARMERIE NATIONALE — NÎMES RP</b><br />Inspection Générale (IGGN)</span>
              <span style={{ textAlign: "right" }}>Nîmes, le {jour}<br />Document à diffusion restreinte</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 6 }}>
              <img src="/logo-iggn.png" alt="" style={{ width: 74, height: 74, objectFit: "contain", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <div>
                <div style={{ fontSize: 11, letterSpacing: 3, color: "#9A6F1E", fontWeight: 700 }}>NOTE D'INFORMATION</div>
                <h1 style={{ fontFamily: FONT_TITRE, fontSize: "clamp(22px, 4.5vw, 30px)", margin: "2px 0 0", color: "#0F2A5C", lineHeight: 1.2 }}>Signaler le comportement d'un gendarme à l'Inspection Générale</h1>
              </div>
            </div>
            <div style={{ height: 3, background: "linear-gradient(90deg, #0B3A8F 0 33%, #D3DDEA 33% 66%, #C0172D 66%)", borderRadius: 2, margin: "16px 0 22px" }} />

            <p style={{ fontSize: 14.5, lineHeight: 1.75, margin: "0 0 18px" }}>L'Inspection Générale de la Gendarmerie Nationale (IGGN) veille au respect de la déontologie au sein de la gendarmerie de Nîmes RP. Toute personne – civil ou membre de la gendarmerie – peut lui signaler un comportement qu'elle estime contraire aux règles ou à l'éthique d'un gendarme.</p>

            <h2 style={{ fontFamily: FONT_TITRE, fontSize: 18, color: "#0F2A5C", margin: "0 0 8px" }}>Article 1 — Ce que vous pouvez signaler</h2>
            <ul style={{ fontSize: 14, paddingLeft: 20, margin: "0 0 18px" }}>
              <li style={li}>Un abus d'autorité, des violences ou un comportement agressif ;</li>
              <li style={li}>Un propos ou un comportement discriminatoire ;</li>
              <li style={li}>De la corruption, un faux, ou la dissimulation de preuves ;</li>
              <li style={li}>Un manquement au secret professionnel ou une fausse déclaration d'activité (« farm de service »).</li>
            </ul>

            <h2 style={{ fontFamily: FONT_TITRE, fontSize: 18, color: "#0F2A5C", margin: "0 0 8px" }}>Article 2 — Confidentialité</h2>
            <div style={{ background: "#EEF4FF", border: "1px solid #BBD0F2", borderLeft: "5px solid #123A7A", borderRadius: 8, padding: "12px 16px", fontSize: 14, lineHeight: 1.65, margin: "0 0 18px" }}>
              🔒 Votre signalement est lu <b>uniquement</b> par les <b>administrateurs</b> et les <b>Référents Déontologie</b>. Ni le Corps de Commandement, ni les OPJ, ni la Brigade de Recherche, ni le gendarme mis en cause n'y ont accès.
            </div>

            <h2 style={{ fontFamily: FONT_TITRE, fontSize: 18, color: "#0F2A5C", margin: "0 0 8px" }}>Article 3 — Déroulement</h2>
            <ol style={{ fontSize: 14, paddingLeft: 20, margin: "0 0 18px" }}>
              <li style={li}>Vous liez vos comptes <b>Roblox</b> et <b>Discord</b> (obligatoire, pour pouvoir vous recontacter et éviter les faux signalements) ;</li>
              <li style={li}>Vous indiquez le gendarme concerné et décrivez les faits, preuves à l'appui (captures, vidéos, messages) ;</li>
              <li style={li}>Un <b>numéro de dossier</b> vous est remis. Un Référent Déontologie ou un administrateur prend le dossier en charge et vous recontacte <b>sur Discord</b>.</li>
            </ol>

            <h2 style={{ fontFamily: FONT_TITRE, fontSize: 18, color: "#0F2A5C", margin: "0 0 8px" }}>Article 4 — Engagement</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>Un signalement doit être sincère et fondé sur des faits. Un signalement mensonger ou abusif peut entraîner des sanctions à l'encontre de son auteur.</p>

            <div style={{ borderTop: "1px solid #D3DDEA", paddingTop: 20, textAlign: "center" }}>
              <button type="button" onClick={onStart} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "14px 34px", fontSize: 15.5, background: "#0F2A5C", marginTop: 0 }}>📝 Rédiger mon signalement</button>
              <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 12, lineHeight: 1.6 }}>Pour une plainte ordinaire contre un civil, utilisez plutôt « Déposer plainte ». Jeu de rôle Roblox : document fictif, sans valeur officielle.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Version « espace gendarme » : présentation → formulaire → confirmation, sans quitter l'espace
export function IGGNInterne({ onSubmit }) {
  const [etape, setEtape] = useState("presentation");
  const [ref, setRef] = useState("");
  if (etape === "formulaire") {
    return <PlainteForm iggn onCancel={() => setEtape("presentation")} onSubmit={async (d) => { const r = await onSubmit(d); if (r && r.ok) { setRef(r.ref || ""); setEtape("fini"); } return r; }} />;
  }
  if (etape === "fini") {
    return (
      <div style={{ maxWidth: 560, margin: "30px auto", background: "#fff", border: "1px solid #D3DDEA", borderTop: "5px solid #2E7D4F", borderRadius: 16, padding: "28px 26px", textAlign: "center", fontFamily: FONT_BASE }}>
        <div style={{ fontSize: 42 }}>✅</div>
        <div style={{ fontFamily: FONT_TITRE, fontSize: 24, fontWeight: 700, color: "#14213A", margin: "6px 0 8px" }}>Signalement transmis à l'IGGN</div>
        <div style={{ fontSize: 14, color: "#3A4D6B", lineHeight: 1.6 }}>Il est lu uniquement par les administrateurs et les Référents Déontologie, qui te recontacteront sur Discord.</div>
        {ref && <div style={{ marginTop: 14, fontFamily: "'Courier New', monospace", fontSize: 20, fontWeight: 700, color: "#0F2A5C", background: "#EEF4FF", borderRadius: 10, padding: "10px 14px", display: "inline-block" }}>{ref}</div>}
        <div style={{ fontSize: 12, color: "#7B8AA3", marginTop: 8 }}>Note bien ce numéro : il identifie ton dossier.</div>
        <div style={{ marginTop: 18 }}><button onClick={() => setEtape("presentation")} style={smallBtn}>Fermer</button></div>
      </div>
    );
  }
  return <IGGNPresentation interne onStart={() => setEtape("formulaire")} />;
}
