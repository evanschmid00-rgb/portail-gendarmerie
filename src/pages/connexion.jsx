// pages/connexion.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useState } from "react";
import { Field, buttonPrimary } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";

/* ---------- Écran de connexion ---------- */

/* ---------- Création de compte gendarme (Prénom RP + NOM RP, puis Discord) ---------- */

const MOTIF_NOM_RP = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const formaterNomRP = (s) => String(s || "").replace(/\s+/g, " ").trim().toLocaleUpperCase("fr-FR");
const formaterPrenomRP = (s) => String(s || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr-FR").replace(/(^|[ '’-])([a-zà-öø-ÿ])/g, (m, sep, l) => sep + l.toLocaleUpperCase("fr-FR"));

export function CreerCompteScreen({ onBack, onLogin }) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState("");
  const prenomOk = formaterPrenomRP(prenom);
  const nomOk = formaterNomRP(nom);

  function continuer(e) {
    e.preventDefault();
    if (prenomOk.length < 2 || !MOTIF_NOM_RP.test(prenomOk)) { setErreur("Indique ton Prénom RP (lettres uniquement)."); return; }
    if (nomOk.length < 2 || !MOTIF_NOM_RP.test(nomOk)) { setErreur("Indique ton NOM RP (lettres uniquement)."); return; }
    setErreur("");
    window.location.href = `/api/discord?mode=creation&prenom=${encodeURIComponent(prenomOk)}&nom=${encodeURIComponent(nomOk)}`;
  }

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 15%, #123A7A, #07142E 62%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_BASE }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#8FA0B8", fontSize: 12, cursor: "pointer", marginBottom: 16 }}>← Retour à l'accueil</button>
        <div style={{ textAlign: "center", marginBottom: 22, color: "#F2F6FC" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6 }}>GENDARMERIE NATIONALE DE BLACK RP</div>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 30, fontWeight: 700, marginTop: 4 }}>Créer mon compte</div>
        </div>
        <form onSubmit={continuer} style={{ background: "#F2F6FC", borderRadius: 14, padding: 24, boxShadow: "0 18px 40px -16px rgba(0,0,0,0.6)" }}>
          <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 16, lineHeight: 1.5 }}>Indique l'identité de ton personnage <b>sur le serveur RP</b> (pas ton vrai nom), puis valide avec Discord.</div>
          <Field label="Prénom RP" value={prenom} onChange={setPrenom} placeholder="Ex : Jean" autoFocus />
          <Field label="NOM RP" value={nom} onChange={(v) => setNom(v.toLocaleUpperCase("fr-FR"))} placeholder="Ex : DUPONT" />
          {(prenomOk || nomOk) && (
            <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 12 }}>Ton compte s'appellera : <b style={{ color: "#14213A" }}>{prenomOk} {nomOk}</b></div>
          )}
          {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
          <button type="submit" style={{ ...buttonPrimary, background: "#5865F2", marginTop: 0 }}>Continuer avec Discord</button>
          <div style={{ textAlign: "center", color: "#5A6B84", fontSize: 12, marginTop: 10 }}>Réservé aux membres ayant le rôle « Militaire Engagé » sur le Discord.</div>
          <div style={{ borderTop: "1px solid #D3DDEA", margin: "16px 0 10px" }} />
          <button type="button" onClick={onLogin} style={{ background: "none", border: "none", color: "#123A7A", fontSize: 12.5, cursor: "pointer", width: "100%", textDecoration: "underline" }}>J'ai déjà un compte : me connecter</button>
        </form>
      </div>
    </div>
  );
}

export function LoginScreen({ onLogin, onBack, blockedMsg }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ancien, setAncien] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await onLogin(username, password);
    if (!res.ok) setError(res.error || "Identifiants incorrects.");
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 20% 15%, #123A7A, #07142E 62%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_BASE }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#8FA0B8", fontSize: 12, cursor: "pointer", marginBottom: 16 }}>← Retour à l'accueil</button>
        <div style={{ textAlign: "center", marginBottom: 22, color: "#F2F6FC" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6 }}>GENDARMERIE NATIONALE DE BLACK RP</div>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 30, fontWeight: 700, marginTop: 4 }}>Pulsar RP</div>
          <div style={{ display: "inline-block", marginTop: 10, background: "rgba(255,244,214,0.12)", border: "1px solid rgba(255,233,168,0.45)", color: "#FFE9A8", fontSize: 11.5, fontWeight: 600, padding: "5px 12px", borderRadius: 20 }}>⚠️ Jeu de rôle Roblox uniquement</div>
        </div>
        {blockedMsg && <div style={{ background: "#C0172D", color: "#fff", borderRadius: 8, padding: "10px 14px", fontSize: 12, marginBottom: 14, textAlign: "center" }}>{blockedMsg}</div>}
        <div style={{ background: "#F2F6FC", borderRadius: 14, padding: 24, boxShadow: "0 18px 40px -16px rgba(0,0,0,0.6)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 22, fontWeight: 700, color: "#14213A", textAlign: "center", marginBottom: 14 }}>Connexion</div>
          <a href="/api/discord?mode=connexion" style={{ display: "block", textAlign: "center", textDecoration: "none", background: "#5865F2", color: "#fff", borderRadius: 10, padding: "13px 14px", fontSize: 15, fontWeight: 700 }}>Se connecter avec Discord</a>
          <div style={{ textAlign: "center", color: "#5A6B84", fontSize: 12, marginTop: 10 }}>Réservé aux membres ayant le rôle « Militaire Engagé » sur le Discord.</div>
          <div style={{ borderTop: "1px solid #D3DDEA", margin: "18px 0 12px" }} />
          {!ancien ? (
            <button type="button" onClick={() => setAncien(true)} style={{ background: "none", border: "none", color: "#5A6B84", fontSize: 12, cursor: "pointer", width: "100%", textDecoration: "underline" }}>Compte sans Discord (identifiant et mot de passe)</button>
          ) : (
            <form onSubmit={handleLogin}>
              <Field label="Identifiant" value={username} onChange={setUsername} autoFocus />
              <Field label="Mot de passe" value={password} onChange={setPassword} type="password" />
              {error && <div style={{ color: "#C0172D", fontSize: 12, marginBottom: 10 }}>{error}</div>}
              <button type="submit" disabled={busy} style={buttonPrimary}>{busy ? "Connexion…" : "Se connecter"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
