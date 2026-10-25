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
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#A9B8CE", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>← Retour à l'accueil</button>
        <div className="gn-appear" style={{ textAlign: "center", marginBottom: 22, color: "#F2F6FC" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 12px", background: "linear-gradient(135deg, #1A4A96, #0C2655)", border: "2px solid #CFE0FF", boxShadow: "0 0 0 6px rgba(207,224,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_TITRE, fontWeight: 700, fontSize: 24, color: "#CFE0FF" }}>GN</div>
          <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6 }}>GENDARMERIE NATIONALE DE NÎMES RP</div>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 30, fontWeight: 700, marginTop: 4 }}>Créer mon compte</div>
        </div>
        <form onSubmit={continuer} style={{ background: "#F7FAFD", borderRadius: 18, padding: 26, borderTop: "5px solid #123A7A", boxShadow: "0 30px 60px -24px rgba(0,0,0,0.7)" }}>
          <div style={{ fontSize: 13, color: "#3A4D6B", marginBottom: 16, lineHeight: 1.5 }}>Indique l'identité de ton personnage <b>sur le serveur RP</b> (pas ton vrai nom), puis valide avec Discord.</div>
          <Field label="Prénom RP" value={prenom} onChange={setPrenom} placeholder="Ex : Jean" autoFocus />
          <Field label="NOM RP" value={nom} onChange={(v) => setNom(v.toLocaleUpperCase("fr-FR"))} placeholder="Ex : DUPONT" />
          {(prenomOk || nomOk) && (
            <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 12 }}>Ton compte s'appellera : <b style={{ color: "#14213A" }}>{prenomOk} {nomOk}</b></div>
          )}
          {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 10 }}>{erreur}</div>}
          <button type="submit" style={{ ...buttonPrimary, background: "#5865F2", marginTop: 0 }}>Continuer avec Discord</button>
          <div style={{ textAlign: "center", color: "#5A6B84", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>Réservé aux membres du serveur Discord. Si ta candidature a été acceptée, le rôle « Militaire Engagé » te sera donné automatiquement à la création du compte.</div>
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
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#A9B8CE", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>← Retour à l'accueil</button>
        <div className="gn-appear" style={{ textAlign: "center", marginBottom: 22, color: "#F2F6FC" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 12px", background: "linear-gradient(135deg, #1A4A96, #0C2655)", border: "2px solid #CFE0FF", boxShadow: "0 0 0 6px rgba(207,224,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_TITRE, fontWeight: 700, fontSize: 24, color: "#CFE0FF" }}>GN</div>
          <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6 }}>GENDARMERIE NATIONALE DE NÎMES RP</div>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 30, fontWeight: 700, marginTop: 4 }}>Nîmes RP</div>
          <div style={{ display: "inline-block", marginTop: 10, background: "rgba(255,244,214,0.12)", border: "1px solid rgba(255,233,168,0.45)", color: "#FFE9A8", fontSize: 11.5, fontWeight: 600, padding: "5px 12px", borderRadius: 20 }}>⚠️ Jeu de rôle Roblox uniquement</div>
        </div>
        {blockedMsg && <div role="alert" style={{ background: "#FDECEE", border: "1px solid #E8A0AA", borderLeft: "5px solid #C0172D", color: "#7A0F1E", borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}><b style={{ display: "block", marginBottom: 2 }}>Connexion impossible</b>{blockedMsg}</div>}
        <div style={{ background: "#F7FAFD", borderRadius: 18, padding: 26, borderTop: "5px solid #123A7A", boxShadow: "0 30px 60px -24px rgba(0,0,0,0.7)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 22, fontWeight: 700, color: "#14213A", textAlign: "center", marginBottom: 14 }}>Connexion</div>
          <a href="/api/discord?mode=connexion" style={{ display: "block", textAlign: "center", textDecoration: "none", background: "#5865F2", color: "#fff", borderRadius: 12, padding: "14px 14px", fontSize: 15, fontWeight: 700, boxShadow: "0 12px 24px -12px rgba(88,101,242,0.8)" }}>💬 Se connecter avec Discord</a>
          <div style={{ textAlign: "center", color: "#5A6B84", fontSize: 12, marginTop: 10 }}>Réservé aux membres ayant le rôle « Militaire Engagé » sur le Discord.</div>
          <details style={{ marginTop: 14, background: "#EEF3FA", border: "1px solid #D3DDEA", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.55 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, color: "#123A7A" }}>Un problème pour te connecter ? Vérifie ceci</summary>
            <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              <li>Tu es bien membre du <b>serveur Discord</b> de la gendarmerie.</li>
              <li>Tu as le rôle <b>« Militaire Engagé »</b> (il est donné automatiquement si ta candidature est acceptée).</li>
              <li>Ton compte Discord est <b>vérifié</b> (e-mail confirmé).</li>
              <li>Sur téléphone, ouvre le site dans <b>Chrome ou Safari</b> plutôt que dans le navigateur intégré d'une application.</li>
              <li>Tu as déjà un compte créé par un admin ? Il doit y avoir ton <b>pseudo Discord exact</b> sur ta fiche. Sinon, utilise l'identifiant et le mot de passe ci-dessous.</li>
              <li>Pas encore de compte ? Retourne à l'accueil et clique sur <b>« Créer mon compte »</b>.</li>
            </ol>
          </details>
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
