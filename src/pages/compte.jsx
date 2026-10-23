// pages/compte.jsx — « Mon compte » : identifiant de connexion et changement de mot de passe.
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import React, { useState } from "react";
import { Field, buttonPrimary, h2Style } from "../composants/ui.jsx";
import { ModalIdentifiants } from "../composants/ModalIdentifiants.jsx";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";

export function MonComptePage({ auth, current }) {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [etat, setEtat] = useState({ busy: false, msg: "", ok: false });
  const [creation, setCreation] = useState(false);
  const [, rafraichir] = useState(0);

  const user = auth.currentUser;
  const aMotDePasse = !!(user && user.providerData && user.providerData.some((x) => x.providerId === "password"));
  const identifiant = (user && user.email ? user.email.split("@")[0] : "") || current.username || "";

  async function changer(e) {
    e.preventDefault();
    if (nouveau.length < 6) { setEtat({ busy: false, ok: false, msg: "Le nouveau mot de passe doit faire au moins 6 caractères." }); return; }
    if (nouveau !== confirmation) { setEtat({ busy: false, ok: false, msg: "La confirmation ne correspond pas au nouveau mot de passe." }); return; }
    setEtat({ busy: true, ok: false, msg: "" });
    try {
      if (ancien) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, ancien));
      await updatePassword(user, nouveau);
      setAncien(""); setNouveau(""); setConfirmation("");
      setEtat({ busy: false, ok: true, msg: "Mot de passe modifié. Utilise-le à ta prochaine connexion." });
    } catch (err) {
      const code = String((err && err.code) || "");
      const msg = code.includes("wrong-password") || code.includes("invalid-credential") ? "Le mot de passe actuel est incorrect."
        : code.includes("requires-recent-login") ? "Pour ta sécurité, saisis ton mot de passe actuel (ou reconnecte-toi avec Discord, puis réessaie)."
        : code.includes("weak-password") ? "Nouveau mot de passe trop faible."
        : code.includes("too-many-requests") ? "Trop de tentatives, réessaie dans quelques minutes."
        : "Modification impossible, réessaie dans un instant.";
      setEtat({ busy: false, ok: false, msg });
    }
  }

  const carte = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: "20px 22px", maxWidth: 520, marginBottom: 18, boxShadow: "0 6px 20px -14px rgba(7,20,46,0.3)" };
  return (
    <div style={{ fontFamily: FONT, maxWidth: 760 }}>
      <h2 style={h2Style}>Mon compte</h2>

      <div style={carte}>
        <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 8 }}>Connexion</div>
        <div style={{ fontSize: 14, color: "#14213A", lineHeight: 1.7 }}>
          <div>Nom : <b>{current.prenom} {current.nom}</b></div>
          <div>Identifiant : <b style={{ fontFamily: "'Courier New', monospace" }}>{aMotDePasse ? identifiant : "— aucun —"}</b></div>
          <div style={{ color: "#5A6B84", fontSize: 12.5 }}>{aMotDePasse ? "Tu peux te connecter avec cet identifiant et ton mot de passe, ou avec Discord." : "Tu te connectes uniquement avec Discord pour le moment."}</div>
        </div>
      </div>

      {!aMotDePasse ? (
        <div style={carte}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🔑 Créer un identifiant et un mot de passe</div>
          <div style={{ fontSize: 13, color: "#5A6B84", lineHeight: 1.55, marginBottom: 12 }}>Pour te connecter aussi sans Discord. Un identifiant et un mot de passe te sont proposés automatiquement.</div>
          <button type="button" onClick={() => setCreation(true)} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>Créer mes identifiants</button>
        </div>
      ) : (
        <form onSubmit={changer} style={carte}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>🔒 Changer mon mot de passe</div>
          <Field label="Mot de passe actuel" type="password" value={ancien} onChange={setAncien} />
          <Field label="Nouveau mot de passe (6 caractères minimum)" type="password" value={nouveau} onChange={setNouveau} />
          <Field label="Confirmer le nouveau mot de passe" type="password" value={confirmation} onChange={setConfirmation} />
          {etat.msg && <div style={{ color: etat.ok ? "#1F6B42" : "#C0172D", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{etat.msg}</div>}
          <button type="submit" disabled={etat.busy} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>{etat.busy ? "Modification…" : "Modifier le mot de passe"}</button>
          <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 10 }}>Mot de passe oublié ? Connecte-toi avec Discord : tu pourras alors le changer sans saisir l'ancien.</div>
        </form>
      )}

      {creation && <ModalIdentifiants auth={auth} current={current} onFini={() => { setCreation(false); rafraichir((x) => x + 1); }} />}
    </div>
  );
}
