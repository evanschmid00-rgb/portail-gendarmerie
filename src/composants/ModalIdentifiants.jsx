// composants/ModalIdentifiants.jsx — Après une connexion Discord, propose (et crée) un identifiant + mot de passe personnels
// pour pouvoir se connecter ensuite sans Discord. Le compte est rattaché au même profil (aucun doublon).
import { EmailAuthProvider, linkWithCredential } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import React, { useState } from "react";
import { db } from "../firebase";
import { usernameToEmail } from "../lib/donnees.js";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");

function motDePasseAleatoire(n = 12) {
  const car = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const tab = new Uint32Array(n);
  window.crypto.getRandomValues(tab);
  return Array.from(tab, (x) => car[x % car.length]).join("");
}

export function ModalIdentifiants({ auth, current, onFini, obligatoire = false }) {
  const [identifiant, setIdentifiant] = useState(() => (current.username && String(current.username).trim()) || sansAccents(`${current.prenom}.${current.nom}`));
  const [mdp, setMdp] = useState(() => motDePasseAleatoire());
  const [etat, setEtat] = useState({ busy: false, erreur: "", ok: false });
  const [copie, setCopie] = useState(false);

  async function creer() {
    const id = identifiant.trim();
    if (id.length < 3) { setEtat({ busy: false, erreur: "L'identifiant doit faire au moins 3 caractères.", ok: false }); return; }
    if (mdp.length < 6) { setEtat({ busy: false, erreur: "Mot de passe trop court (6 caractères minimum).", ok: false }); return; }
    setEtat({ busy: true, erreur: "", ok: false });
    try {
      await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(usernameToEmail(id), mdp));
      try { if (id !== current.username) await updateDoc(doc(db, "personnel", auth.currentUser.uid), { username: id }); } catch (e) { /* l'identifiant fonctionne quand même */ }
      setEtat({ busy: false, erreur: "", ok: true });
    } catch (e) {
      const code = String((e && e.code) || "");
      const msg = code.includes("email-already-in-use") || code.includes("credential-already-in-use") ? "Cet identifiant est déjà pris : choisis-en un autre."
        : code.includes("provider-already-linked") ? "Tu as déjà un identifiant et un mot de passe."
        : code.includes("weak-password") ? "Mot de passe trop faible."
        : "Création impossible, réessaie dans un instant.";
      setEtat({ busy: false, erreur: msg, ok: false });
    }
  }
  function copier() {
    try { navigator.clipboard.writeText(`Identifiant : ${identifiant.trim()}\nMot de passe : ${mdp}`).then(() => setCopie(true)); } catch (e) { /* tant pis */ }
  }
  const champ = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #C3D0E2", borderRadius: 8, fontSize: 15, fontFamily: FONT, marginBottom: 12 };
  const lab = { fontSize: 11.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#5A6B84", marginBottom: 4, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(7,20,46,0.7)", zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: FONT }}>
      <div style={{ background: "#fff", borderRadius: 16, maxWidth: 440, width: "100%", padding: "24px 26px", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)", maxHeight: "92vh", overflowY: "auto" }}>
        {!etat.ok ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#14213A", marginBottom: 6 }}>🔑 Tes identifiants personnels</div>
            <div style={{ fontSize: 13, color: "#5A6B84", lineHeight: 1.55, marginBottom: 16 }}>{obligatoire ? <>Bienvenue ! Tu viens de te connecter avec Discord : c'est la <b>seule fois</b>. Crée maintenant ton identifiant et ton mot de passe : <b>c'est avec eux que tu te connecteras ensuite</b>. Nous t'en proposons déjà : tu peux les modifier.</> : <>Tu es connecté avec Discord. Crée un identifiant et un mot de passe pour pouvoir aussi te connecter <b>sans Discord</b>. Nous t'en proposons déjà : tu peux les modifier.</>}</div>
            <label style={lab}>Identifiant</label>
            <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoCapitalize="none" autoCorrect="off" style={champ} />
            <label style={lab}>Mot de passe</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={mdp} onChange={(e) => setMdp(e.target.value)} style={{ ...champ, marginBottom: 0, fontFamily: "'Courier New', monospace", letterSpacing: 1 }} />
              <button type="button" onClick={() => setMdp(motDePasseAleatoire())} title="Générer un autre mot de passe" style={{ border: "1px solid #C3D0E2", background: "#F5F8FC", borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 16 }}>🔄</button>
            </div>
            {etat.erreur && <div style={{ color: "#C0172D", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{etat.erreur}</div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" disabled={etat.busy} onClick={creer} style={{ background: "#123A7A", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT }}>{etat.busy ? "Création…" : "Créer mes identifiants"}</button>
              {!obligatoire && <button type="button" onClick={() => onFini(false)} style={{ background: "transparent", border: "1px solid #C3D0E2", borderRadius: 8, padding: "10px 14px", fontSize: 13, cursor: "pointer", fontFamily: FONT, color: "#3A4D6B" }}>Plus tard</button>}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1F6B42", marginBottom: 6 }}>✅ C'est fait !</div>
            <div style={{ fontSize: 13, color: "#3A4D6B", lineHeight: 1.55, marginBottom: 14 }}>Note-les bien : le mot de passe ne sera plus affiché. Tu pourras te connecter avec ces identifiants, sans passer par Discord.</div>
            <div style={{ background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: "12px 14px", fontFamily: "'Courier New', monospace", fontSize: 15, lineHeight: 1.8, marginBottom: 14 }}>
              <div><span style={{ color: "#5A6B84" }}>Identifiant : </span><b>{identifiant.trim()}</b></div>
              <div><span style={{ color: "#5A6B84" }}>Mot de passe : </span><b>{mdp}</b></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={copier} style={{ border: "1px solid #C3D0E2", background: "#fff", borderRadius: 8, padding: "10px 14px", fontSize: 13, cursor: "pointer", fontFamily: FONT }}>{copie ? "✔ Copié" : "📋 Copier"}</button>
              <button type="button" onClick={() => onFini(true)} style={{ background: "#123A7A", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT }}>J'ai noté, continuer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
