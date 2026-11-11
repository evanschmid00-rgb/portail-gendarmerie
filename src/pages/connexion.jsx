// pages/connexion.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useEffect, useState } from "react";
import { Field, buttonPrimary } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";
import { Ecusson } from "../composants/Ecusson.jsx";
import { LogoNeogend } from "../composants/LogoNeogend.jsx";

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
    <div style={{ minHeight: "100vh", background: "radial-gradient(700px 420px at 90% 0%, rgba(92,200,255,0.3), transparent 70%), linear-gradient(160deg, #0B3A8F 0%, #1D5BD6 55%, #0A2A6B 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_BASE }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#A9B8CE", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>← Retour à l'accueil</button>
        <div className="gn-appear" style={{ textAlign: "center", marginBottom: 22, color: "#F2F6FC" }}>
          <div style={{ display: "inline-block", background: "#fff", borderRadius: 16, padding: "10px 22px", marginBottom: 10 }}><LogoNeogend hauteur={44} /></div>
          <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6 }}>CGD DE SAINT-TROPEZ RP · GENDARMERIE NATIONALE</div>
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

const CLE_ID = "gn_login_identifiant";
const STYLE_LOGIN = `
  @keyframes loginEntree { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes loginSecoue { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-7px); } 40%,80% { transform: translateX(7px); } }
  .login-carte { animation: loginEntree .4s ease-out; }
  .login-secoue { animation: loginSecoue .4s; }
  .login-champ { width: 100%; box-sizing: border-box; padding: 13px 14px; border: 2px solid #C9D6EC; border-radius: 12px; font-size: 16px; font-family: inherit; background: #F7F9FD; color: #0A1F44; transition: border-color .15s, box-shadow .15s; }
  .login-champ:focus { outline: none; border-color: #0B3A8F; box-shadow: 0 0 0 4px rgba(29,91,214,.18); background: #fff; }
  .login-btn { transition: transform .12s, filter .15s; }
  .login-btn:hover:not(:disabled) { filter: brightness(1.08); }
  .login-btn:active:not(:disabled) { transform: scale(.98); }
  @media (prefers-reduced-motion: reduce) { .login-carte, .login-secoue { animation: none; } }
`;

function HorlogeLogin() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "'Roboto Mono', ui-monospace, monospace", fontSize: 38, fontWeight: 700, letterSpacing: 2 }}>{t.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}</div>
      <div style={{ fontSize: 13, opacity: 0.85, textTransform: "capitalize" }}>{t.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })}</div>
    </div>
  );
}

export function LoginScreen({ onLogin, onBack, onCreerCompte, blockedMsg }) {
  let idSauve = "";
  try { idSauve = localStorage.getItem(CLE_ID) || ""; } catch (e) { /* stockage indisponible */ }
  const [onglet, setOnglet] = useState("identifiants");
  const [username, setUsername] = useState(idSauve);
  const [password, setPassword] = useState("");
  const [voir, setVoir] = useState(false);
  const [maj, setMaj] = useState(false);
  const [retenir, setRetenir] = useState(!!idSauve);
  const [error, setError] = useState("");
  const [secoue, setSecoue] = useState(0);
  const [busy, setBusy] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!username.trim() || !password) { setError("Renseigne ton identifiant et ton mot de passe."); setSecoue((n) => n + 1); return; }
    setBusy(true);
    setError("");
    const res = await onLogin(username, password);
    if (!res.ok) { setError(res.error || "Identifiants incorrects."); setSecoue((n) => n + 1); }
    else { try { if (retenir) localStorage.setItem(CLE_ID, username.trim()); else localStorage.removeItem(CLE_ID); } catch (x) { /* rien */ } }
    setBusy(false);
  }
  const touche = (e) => setMaj(!!(e.getModifierState && e.getModifierState("CapsLock")));
  const pastille = { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700 };
  const lab = { display: "block", fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#3A4D6B", margin: "14px 0 6px" };
  const ong = (actif) => ({ flex: 1, border: 0, borderRadius: 10, padding: "10px 8px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", background: actif ? "#fff" : "transparent", color: actif ? "#0B3A8F" : "#5A6B84", boxShadow: actif ? "0 4px 12px -6px rgba(11,58,143,0.6)" : "none" });

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(700px 420px at 90% 0%, rgba(92,200,255,0.3), transparent 70%), radial-gradient(600px 400px at 0% 100%, rgba(229,56,79,0.22), transparent 70%), linear-gradient(160deg, #0B3A8F 0%, #1D5BD6 55%, #0A2A6B 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 18px", fontFamily: FONT_BASE, color: "#fff" }}>
      <style>{STYLE_LOGIN}</style>
      <div style={{ width: "100%", maxWidth: 940, display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center", justifyContent: "center" }}>
        <div style={{ flex: "1 1 320px", maxWidth: 420, textAlign: "center" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 13, cursor: "pointer", marginBottom: 14 }}>← Retour à l'accueil du site</button>
          <div style={{ display: "inline-block", background: "#fff", borderRadius: 22, padding: "16px 30px", boxShadow: "0 24px 50px -24px rgba(0,0,0,0.7)" }}><LogoNeogend hauteur={74} /></div>
          <div style={{ fontSize: 12, letterSpacing: 2.4, fontWeight: 700, margin: "16px 0 4px", opacity: 0.9, textTransform: "uppercase" }}>Nouvel Équipement Opérationnel<br />de la Gendarmerie</div>
          <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.7, marginBottom: 20 }}>CGD DE SAINT-TROPEZ RP</div>
          <HorlogeLogin />
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 18 }}>
            <span style={pastille}>🔒 Réseau chiffré</span>
            <span style={pastille}>🛡️ VPN d'État actif</span>
          </div>
        </div>

        <div className="login-carte" style={{ flex: "1 1 340px", maxWidth: 440, color: "#0A1F44" }}>
          {blockedMsg && <div role="alert" style={{ background: "#FDECEE", border: "1px solid #E8A0AA", borderLeft: "5px solid #C0172D", color: "#7A0F1E", borderRadius: 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}><b style={{ display: "block", marginBottom: 2 }}>Connexion impossible</b>{blockedMsg}</div>}
          <div style={{ background: "#fff", borderRadius: 24, padding: "22px 24px 20px", borderTop: "6px solid #E5384F", borderBottom: "6px solid #0B3A8F", boxShadow: "0 40px 70px -30px rgba(0,0,0,0.75)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ width: 48, height: 48, borderRadius: "50%", background: "#fff", border: "4px solid #0B3A8F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🪪</span>
              <div><div style={{ fontWeight: 800, fontSize: 18, color: "#0A1F44" }}>Authentification forte</div><div style={{ fontSize: 12, color: "#5A6B84" }}>Carte professionnelle (CIPC) · accès nominatif</div></div>
            </div>
            <div style={{ display: "flex", gap: 4, background: "#E8EEF8", borderRadius: 12, padding: 4 }}>
              <button type="button" onClick={() => setOnglet("identifiants")} style={ong(onglet === "identifiants")}>🔑 Identifiants</button>
              <button type="button" onClick={() => setOnglet("discord")} style={ong(onglet === "discord")}>💬 Première connexion</button>
            </div>

            {onglet === "identifiants" && (
              <form onSubmit={handleLogin} noValidate>
                <label style={lab} htmlFor="lg-id">Identifiant nominatif</label>
                <input id="lg-id" className="login-champ" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="ex : jean.dupont" autoFocus={!idSauve} />
                <label style={lab} htmlFor="lg-mdp">Code lecteur / mot de passe</label>
                <div style={{ position: "relative" }}>
                  <input id="lg-mdp" className="login-champ" type={voir ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={touche} onKeyDown={touche} autoComplete="current-password" placeholder="••••••••" autoFocus={!!idSauve} style={{ paddingRight: 48 }} />
                  <button type="button" onClick={() => setVoir(!voir)} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"} style={{ position: "absolute", right: 6, top: 6, width: 38, height: 38, border: 0, background: "transparent", cursor: "pointer", fontSize: 18 }}>{voir ? "🙈" : "👁️"}</button>
                </div>
                {maj && <div style={{ fontSize: 12.5, color: "#8A5A00", background: "#FFF4D6", borderRadius: 8, padding: "6px 10px", marginTop: 8 }}>⇪ Verrouillage majuscules activé</div>}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3A4D6B", margin: "14px 0 4px", cursor: "pointer" }}>
                  <input type="checkbox" checked={retenir} onChange={(e) => setRetenir(e.target.checked)} style={{ width: 17, height: 17 }} /> Mémoriser mon identifiant sur cet appareil
                </label>
                {error && <div key={secoue} className="login-secoue" role="alert" style={{ background: "#FDECEE", border: "1px solid #E8A0AA", color: "#7A0F1E", borderRadius: 10, padding: "9px 12px", fontSize: 13, margin: "10px 0 2px", lineHeight: 1.45 }}>⚠️ {error}</div>}
                <button type="submit" disabled={busy} className="login-btn" style={{ width: "100%", marginTop: 14, background: "linear-gradient(135deg, #0B3A8F, #1D5BD6)", color: "#fff", border: 0, borderRadius: 14, padding: "15px 18px", fontSize: 15.5, fontWeight: 800, letterSpacing: 1.2, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.75 : 1, fontFamily: "inherit", boxShadow: "0 16px 28px -14px rgba(11,58,143,0.9)" }}>{busy ? "AUTHENTIFICATION…" : "S'AUTHENTIFIER"}</button>
                <button type="button" onClick={() => setOnglet("discord")} style={{ display: "block", margin: "12px auto 0", background: "none", border: 0, color: "#0B3A8F", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>Mot de passe oublié ? Reconnecte-toi avec Discord</button>
              </form>
            )}

            {onglet === "discord" && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13.5, color: "#3A4D6B", lineHeight: 1.55, marginBottom: 12 }}>Pour ta <b>première connexion</b> (ou si tu as oublié ton mot de passe), identifie-toi avec Discord. C'est ce qui lie ton compte à ta carte professionnelle.</div>
                {[["1", "Clique sur « Me connecter avec Discord »."], ["2", "Autorise l'accès (compte Discord vérifié, membre du serveur)."], ["3", "Crée ton identifiant et ton mot de passe : tu n'auras plus besoin de Discord."]].map(([n, t]) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13, color: "#0A1F44" }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#0B3A8F", color: "#fff", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>{t}
                  </div>
                ))}
                <a href="/api/discord?mode=connexion" className="login-btn" style={{ display: "block", textAlign: "center", textDecoration: "none", background: "#5865F2", color: "#fff", borderRadius: 14, padding: "15px 14px", fontSize: 15.5, fontWeight: 800, marginTop: 14, boxShadow: "0 16px 28px -14px rgba(88,101,242,0.9)" }}>💬 Me connecter avec Discord</a>
                <div style={{ textAlign: "center", color: "#5A6B84", fontSize: 12, marginTop: 8 }}>Réservé aux membres ayant le rôle « Militaire Engagé ».</div>
                <button type="button" onClick={() => setOnglet("identifiants")} style={{ display: "block", margin: "12px auto 0", background: "none", border: 0, color: "#0B3A8F", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>← J'ai déjà mes identifiants</button>
              </div>
            )}

            <details style={{ marginTop: 16, background: "#F2F6FC", border: "1px solid #DCE5F2", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.55 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, color: "#0B3A8F" }}>Un problème pour te connecter ?</summary>
              <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                <li>Pour Discord : tu dois être membre du <b>serveur Discord</b> avec le rôle <b>« Militaire Engagé »</b> (donné automatiquement si ta candidature est acceptée).</li>
                <li>Ton compte Discord doit être <b>vérifié</b> (e-mail confirmé).</li>
                <li>Sur téléphone, ouvre le site dans <b>Chrome ou Safari</b>, pas dans le navigateur intégré d'une appli.</li>
                <li>Compte créé par un admin ? Utilise l'identifiant et le mot de passe donnés.</li>
              </ol>
            </details>
            {onCreerCompte && <button type="button" onClick={onCreerCompte} style={{ display: "block", width: "100%", marginTop: 12, background: "#fff", border: "2px solid #C9D6EC", borderRadius: 12, padding: "11px 12px", color: "#0B3A8F", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Nouveau gendarme ? Créer mon compte</button>}
          </div>
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 11.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>⚠️ Site de jeu de rôle (Roblox) — usage RP uniquement.<br />Aucun lien avec la Gendarmerie nationale réelle.</div>
        </div>
      </div>
    </div>
  );
}
