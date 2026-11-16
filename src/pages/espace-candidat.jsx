// pages/espace-candidat.jsx — Espace candidat : inscription (identité RP + Roblox + Discord), suivi du dossier, enquête de moralité.
//  • InscriptionCandidat : formulaire d'inscription, puis liaison Discord. L'enquête administrative (TAJ, CJN, FPR) part toute seule.
//  • EspaceCandidatConnecte : l'espace du candidat connecté (frise du dossier, liaison Roblox, candidatures, épreuves, admission).
//  • EnquetesMoralite : la vue du recrutement (résultat de l'enquête, avis, relance).
import React, { useCallback, useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Field, buttonPrimary } from "../composants/ui.jsx";
import { LogoNeogend } from "../composants/LogoNeogend.jsx";
import { FONT_TITRE } from "../lib/constantes.js";
import { chercherDossier, enregistrerDossierLocal, lireDossiersLocaux, normaliserNumeroDossier } from "../lib/dossier.js";
import { resoudreRoblox } from "../lib/dossierPersonne.js";
import { EtapesSelectionCandidat } from "./selection-candidat.jsx";
import { N, NeoAlerte, NeoBouton, NeoCarte, NeoOnglets, NEO_INP, NEO_LAB } from "../composants/neo.jsx";

const FOND = "radial-gradient(700px 420px at 90% 0%, rgba(92,200,255,0.3), transparent 70%), radial-gradient(600px 400px at 0% 100%, rgba(229,56,79,0.22), transparent 70%), linear-gradient(160deg, #0B3A8F 0%, #1D5BD6 55%, #0A2A6B 100%)";
const TRICOLORE = "linear-gradient(90deg, #2F6FDE 0 33.3%, #fff 33.3% 66.6%, #E5384F 66.6%)";
const MAJ = (s) => String(s || "").replace(/\s+/g, " ").toLocaleUpperCase("fr-FR");
const jour = (s) => { if (!s) return "—"; const d = new Date(String(s).length <= 10 ? `${s}T12:00:00` : s); return isNaN(d) ? String(s) : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); };
const heure = (s) => { const d = new Date(s); return isNaN(d) ? "" : d.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); };
const MOTIF_NOM = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;

async function appelCandidat(corps) {
  const user = auth.currentUser;
  if (!user) throw new Error("non connecté");
  const idToken = await user.getIdToken();
  const r = await fetch("/api/candidat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, ...corps }) });
  return r.json();
}

/* ───────────────────────── Inscription ───────────────────────── */

export function InscriptionCandidat({ onBack, onLogin }) {
  const [f, setF] = useState({ nom: "", prenom: "", naissance: "", lieu: "", roblox: "" });
  const [accord, setAccord] = useState(false);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  const maj = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const lab = { display: "block", fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#3A4D6B", margin: "14px 0 6px" };
  const pastille = (n, t, actif) => <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 800, color: actif ? "#fff" : "rgba(255,255,255,0.7)" }}><span style={{ width: 24, height: 24, borderRadius: "50%", background: actif ? "#E5384F" : "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{n}</span>{t}</span>;

  async function continuer(e) {
    e.preventDefault();
    const nom = MAJ(f.nom).trim(), prenom = f.prenom.replace(/\s+/g, " ").trim(), lieu = f.lieu.replace(/\s+/g, " ").trim(), roblox = f.roblox.trim().replace(/^@/, "");
    if (nom.length < 2 || !MOTIF_NOM.test(nom)) return setErreur("Indique ton NOM RP en lettres (ex : DUPONT).");
    if (prenom.length < 2 || !MOTIF_NOM.test(prenom)) return setErreur("Indique ton prénom RP en lettres.");
    if (!f.naissance || f.naissance > new Date().toISOString().slice(0, 10) || f.naissance < "1900-01-01") return setErreur("Indique une date de naissance RP valide.");
    if (lieu.length < 2) return setErreur("Indique ton lieu de naissance RP.");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(roblox)) return setErreur("Pseudo Roblox invalide : 3 à 20 caractères (lettres, chiffres, _), sans espace.");
    if (!accord) return setErreur("Coche la case pour confirmer que tu as compris l'enquête administrative.");
    setErreur(""); setBusy(true);
    try {
      const c = await resoudreRoblox(roblox);
      if (!c) { setErreur("Compte Roblox introuvable. Vérifie l'orthographe exacte de ton nom d'utilisateur (celui qui commence par @)."); setBusy(false); return; }
    } catch (x) { /* Roblox injoignable : le serveur revérifiera */ }
    window.location.href = `/api/discord?mode=candidat&prenom=${encodeURIComponent(prenom)}&nom=${encodeURIComponent(nom)}&naissance=${encodeURIComponent(f.naissance)}&lieu=${encodeURIComponent(lieu)}&roblox=${encodeURIComponent(roblox)}`;
  }

  return (
    <div style={{ minHeight: "100vh", background: FOND, display: "flex", justifyContent: "center", padding: "26px 16px 60px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: "#fff" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <button onClick={onBack} style={{ background: "none", border: 0, color: "rgba(255,255,255,0.8)", fontSize: 13, cursor: "pointer", marginBottom: 12 }}>← Retour à l'accueil</button>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ display: "inline-block", background: "#fff", borderRadius: 18, padding: "10px 24px", marginBottom: 12 }}><LogoNeogend hauteur={46} /></div>
          <div style={{ fontSize: 11, letterSpacing: 3.5, opacity: 0.75 }}>GENDARMERIE NATIONALE · RECRUTEMENT</div>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 31, fontWeight: 700, marginTop: 4 }}>Espace candidat</div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
            {pastille("1", "Identité RP", true)}{pastille("2", "Compte Roblox", true)}{pastille("3", "Discord", false)}
          </div>
        </div>
        <form onSubmit={continuer} style={{ background: "#fff", color: "#0A1F44", borderRadius: 22, padding: "22px 24px 20px", borderTop: "6px solid #E5384F", borderBottom: "6px solid #0B3A8F", boxShadow: "0 40px 70px -30px rgba(0,0,0,0.7)" }}>
          <div style={{ fontSize: 13.5, color: "#3A4D6B", lineHeight: 1.55 }}>Crée ton dossier de candidat. Indique l'identité de ton personnage <b>sur le serveur RP</b> (pas ton vrai nom).</div>
          <label style={lab}>Identité RP</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}><Field label="NOM" value={f.nom} onChange={(v) => maj("nom")(MAJ(v))} placeholder="DUPONT" autoFocus /></div>
            <div style={{ flex: "1 1 200px" }}><Field label="Prénom" value={f.prenom} onChange={maj("prenom")} placeholder="Jean" /></div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}><Field label="Date de naissance" type="date" value={f.naissance} onChange={maj("naissance")} /></div>
            <div style={{ flex: "1 1 200px" }}><Field label="Lieu de naissance" value={f.lieu} onChange={maj("lieu")} placeholder="Marseille" /></div>
          </div>
          <label style={lab}>Compte Roblox</label>
          <Field label="Nom d'utilisateur Roblox (commence par @ sur ton profil)" value={f.roblox} onChange={maj("roblox")} placeholder="MonPseudoRoblox" />
          <div style={{ fontSize: 12, color: "#5A6B84", marginTop: -4 }}>Tu confirmeras que ce compte est bien le tien depuis ton espace candidat (un code à coller dans ta description Roblox).</div>
          <label style={lab}>Compte Discord</label>
          <div style={{ fontSize: 13, color: "#3A4D6B", lineHeight: 1.55 }}>À l'étape suivante, tu te connectes avec <b>Discord</b> : tu dois être membre du serveur de la Gendarmerie et avoir un compte vérifié.</div>
          <div style={{ background: "#EEF4FF", border: "1px solid #BFD3F5", borderLeft: "5px solid #123A7A", borderRadius: 12, padding: "12px 14px", margin: "16px 0 4px", fontSize: 13, color: "#14213A", lineHeight: 1.55 }}>
            <b>🔎 Enquête administrative de moralité.</b> Dès ton inscription, une première enquête est lancée <b>automatiquement</b> : consultation des fichiers judiciaires (<b>TAJ</b>, <b>CJN</b> et fichier des personnes recherchées). Le résultat est examiné par le recrutement.
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, cursor: "pointer", fontWeight: 700 }}><input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} style={{ width: 17, height: 17, marginTop: 2 }} /> J'ai compris et j'accepte que cette enquête soit lancée.</label>
          </div>
          {erreur && <div role="alert" style={{ background: "#FDECEE", border: "1px solid #E8A0AA", color: "#7A0F1E", borderRadius: 10, padding: "9px 12px", fontSize: 13, margin: "12px 0 0" }}>{erreur}</div>}
          <button type="submit" disabled={busy} style={{ ...buttonPrimary, background: "#5865F2", marginTop: 14, opacity: busy ? 0.7 : 1 }}>{busy ? "Vérification…" : "Continuer avec Discord"}</button>
          <div style={{ borderTop: "1px solid #D3DDEA", margin: "16px 0 10px" }} />
          <button type="button" onClick={onLogin} style={{ background: "none", border: 0, color: "#123A7A", fontSize: 12.5, cursor: "pointer", width: "100%", textDecoration: "underline" }}>J'ai déjà un espace candidat ou un compte : me connecter</button>
        </form>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>⚠️ Site de jeu de rôle (Roblox) — usage RP uniquement.</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Espace du candidat connecté ───────────────────────── */

const STATUT_DOSSIER = { "En attente": ["En cours d'examen", "#8A5A00", "#FFF4E0"], "Acceptée": ["Acceptée", "#1F6B42", "#E3F2E8"], "Refusée": ["Terminée", "#3A4D6B", "#EEF2F8"] };
const ENQUETE = {
  "en-attente": ["⏳", "En attente de ton compte Roblox", "#8A5A00", "#FFF4E0", "Elle démarrera dès que ton compte Roblox sera renseigné."],
  "en-cours": ["🔎", "En cours d'examen", "#123A7A", "#E8F0FF", "Les fichiers ont été consultés. Le recrutement examine le résultat."],
  "terminee": ["✅", "Terminée", "#1F6B42", "#E3F2E8", "L'enquête est close. Le recrutement te communique la suite de ton dossier."],
};

function Etape({ n, titre, etat, enfants, dernier }) {
  const coul = etat === "fait" ? "#1F9D55" : etat === "cours" ? "#E5384F" : "#9AA9C0";
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: etat === "attente" ? "#fff" : coul, border: `3px solid ${coul}`, color: etat === "attente" ? coul : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{etat === "fait" ? "✓" : n}</div>
        {!dernier && <div style={{ flex: 1, width: 3, background: etat === "fait" ? "#1F9D55" : "#D3DDEA", minHeight: 18, margin: "4px 0" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: dernier ? 0 : 18 }}>
        <div style={{ fontFamily: FONT_TITRE, fontSize: 19, fontWeight: 700, color: etat === "attente" ? "#7A8AA3" : "#0A1F44", marginBottom: 6, lineHeight: 1.25, paddingTop: 5 }}>{titre}</div>
        {enfants}
      </div>
    </div>
  );
}

function LiaisonRoblox({ candidat, onRecharger }) {
  const [pseudo, setPseudo] = useState(candidat.pseudoRoblox || "");
  const att = candidat.robloxEnAttente;
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState("");
  useEffect(() => {
    let off = false;
    if (!candidat.robloxVerifie || !candidat.robloxId) return undefined;
    fetch(`/api/roblox-head?id=${candidat.robloxId}`).then((r) => r.json()).then((j) => { if (!off && j.imageUrl) setPhoto(j.imageUrl); }).catch(() => {});
    return () => { off = true; };
  }, [candidat.robloxVerifie, candidat.robloxId]);
  async function agir(corps) {
    setBusy(true); setMsg("");
    try { const j = await appelCandidat(corps); if (j.ok) { await onRecharger(); setMsg(corps.action === "roblox-verify" ? "Compte Roblox lié ✅" : ""); } else setMsg(j.message || "Erreur, réessaie."); }
    catch (e) { setMsg("Erreur de connexion, réessaie."); }
    setBusy(false);
  }
  if (candidat.robloxVerifie) {
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "center", background: "#F2FAF5", border: "1px solid #BDE0CB", borderRadius: 14, padding: "10px 14px" }}>
        {photo ? <img src={photo} alt="" width={52} height={52} style={{ borderRadius: 12, background: "#E8EEF8" }} /> : <span style={{ fontSize: 28 }}>🎮</span>}
        <div><b style={{ color: "#14213A" }}>Roblox : @{candidat.pseudoRoblox}</b><div style={{ fontSize: 12.5, color: "#1F6B42", fontWeight: 700 }}>✅ Compte vérifié</div></div>
      </div>
    );
  }
  return (
    <div style={{ background: "#FFF9EC", border: "1px solid #E8D28A", borderRadius: 14, padding: "12px 14px" }}>
      <div style={{ fontSize: 13.5, color: "#14213A", marginBottom: 8 }}>🎮 Compte Roblox déclaré : <b>@{candidat.pseudoRoblox || "—"}</b> <span style={{ color: "#8A5A00", fontWeight: 700 }}>· à confirmer</span></div>
      {!att ? (
        <>
          <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 8 }}>Pour prouver que ce compte est bien le tien, tu vas coller un code dans la description de ton profil Roblox.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo Roblox" style={{ ...NEO_INP, flex: "1 1 180px", width: "auto" }} />
            <NeoBouton disabled={busy || !pseudo.trim()} onClick={() => agir({ action: "roblox-start", pseudo })}>Obtenir mon code</NeoBouton>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#14213A", lineHeight: 1.6 }}>
            1. Ouvre ton profil Roblox <b>@{att.nom}</b> → « À propos » (description).<br />
            2. Colle ce code et enregistre :
            <div style={{ fontFamily: "'Roboto Mono', ui-monospace, monospace", fontSize: 22, fontWeight: 800, letterSpacing: 2, background: "#fff", border: "2px dashed #C99A1B", borderRadius: 10, padding: "8px 14px", display: "inline-block", margin: "6px 0" }}>{att.code}</div><br />
            3. Reviens ici et clique sur « Vérifier ».
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <NeoBouton disabled={busy} onClick={() => agir({ action: "roblox-verify" })}>{busy ? "Vérification…" : "Vérifier mon compte"}</NeoBouton>
            <NeoBouton variante="clair" disabled={busy} onClick={() => agir({ action: "roblox-start", pseudo: att.nom })}>Nouveau code</NeoBouton>
          </div>
        </>
      )}
      {msg && <div style={{ fontSize: 12.5, marginTop: 8, color: msg.includes("✅") ? "#1F6B42" : "#C0172D" }}>{msg}</div>}
    </div>
  );
}

export function EspaceCandidatConnecte({ candidat, onLogout, onPostuler, onRecharger }) {
  const [dossiers, setDossiers] = useState([]);
  const [numero, setNumero] = useState("");
  const [erreurDossier, setErreurDossier] = useState("");
  const charger = useCallback(async () => {
    const locaux = Object.entries(lireDossiersLocaux()).map(([poste, d]) => ({ poste, numero: d.numero, date: d.date }));
    const lus = await Promise.all(locaux.map(async (d) => { try { return { ...d, suivi: await chercherDossier(d.numero) }; } catch (e) { return { ...d, suivi: null }; } }));
    setDossiers(lus.sort((a, b) => String(b.date).localeCompare(String(a.date))));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function ajouterDossier(e) {
    e.preventDefault();
    const n = normaliserNumeroDossier(numero);
    if (!n) { setErreurDossier("Numéro de dossier invalide (ex : GAV-XXXXX-XXXXX)."); return; }
    try {
      const d = await chercherDossier(n);
      if (!d) { setErreurDossier("Aucun dossier avec ce numéro."); return; }
      enregistrerDossierLocal(d.poste || "Candidature", n);
      setNumero(""); setErreurDossier(""); await charger();
    } catch (x) { setErreurDossier("Lecture impossible, réessaie."); }
  }

  const enq = ENQUETE[(candidat.enquete && candidat.enquete.statut) || "en-attente"] || ENQUETE["en-attente"];
  const acceptes = dossiers.filter((d) => d.suivi && d.suivi.statut === "Acceptée");
  const aDepose = dossiers.length > 0;
  const comptesLies = !!candidat.robloxVerifie;
  const enqueteLancee = !!(candidat.enquete && candidat.enquete.lancee);
  const initiales = `${(candidat.prenom || "?")[0]}${(candidat.nom || "?")[0]}`.toUpperCase();
  const CARTE = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 16, padding: "14px 16px", boxShadow: "0 10px 24px -18px rgba(7,20,46,0.5)" };

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: "#0A1F44" }}>
      <div style={{ background: FOND, color: "#fff", padding: "20px 20px 78px", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: TRICOLORE }} />
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ background: "#fff", borderRadius: 14, padding: "6px 14px" }}><LogoNeogend hauteur={34} /></div>
            <div><div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.8 }}>GENDARMERIE NATIONALE · RECRUTEMENT</div><div style={{ fontFamily: FONT_TITRE, fontSize: 26, fontWeight: 700 }}>Espace candidat</div></div>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.45)", color: "#fff", borderRadius: 999, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Se déconnecter</button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "-56px auto 0", padding: "0 16px 70px", position: "relative" }}>
        {/* Carte de candidat */}
        <div style={{ background: "linear-gradient(135deg, #0C2655, #123A7A)", color: "#fff", borderRadius: 20, padding: "18px 22px", display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", boxShadow: "0 24px 46px -26px rgba(7,20,46,0.8)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: TRICOLORE }} />
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "rgba(255,255,255,0.14)", border: "2px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_TITRE, fontSize: 28, fontWeight: 700 }}>{initiales}</div>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.75 }}>CARTE DE CANDIDAT</div>
            <div style={{ fontFamily: FONT_TITRE, fontSize: 25, fontWeight: 700, lineHeight: 1.2 }}>{candidat.nom} {candidat.prenom}</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>Né(e) le {jour(candidat.dateNaissance)} à {candidat.lieuNaissance || "—"}</div>
          </div>
          <div style={{ textAlign: "right", flex: "0 1 auto" }}>
            <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.75 }}>N° DE CANDIDAT</div>
            <div style={{ fontFamily: "'Roboto Mono', ui-monospace, monospace", fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{candidat.numero || "—"}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Inscrit(e) le {jour(candidat.creeLe)}</div>
          </div>
        </div>

        {acceptes.length > 0 && (
          <div style={{ marginTop: 16, background: "linear-gradient(135deg, #1F7A4A, #2FA864)", color: "#fff", borderRadius: 18, padding: "18px 22px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 38 }}>🎖️</span>
            <div style={{ flex: "1 1 260px" }}><div style={{ fontFamily: FONT_TITRE, fontSize: 21, fontWeight: 700 }}>Candidature acceptée !</div><div style={{ fontSize: 13.5, opacity: 0.95 }}>Bienvenue dans la Gendarmerie. Il te reste à créer ton compte gendarme avec ton Discord : tes informations sont déjà reprises.</div></div>
            <a href={`/api/discord?mode=creation&prenom=${encodeURIComponent(candidat.prenom || "")}&nom=${encodeURIComponent(candidat.nom || "")}`} style={{ background: "#fff", color: "#14663C", fontWeight: 800, borderRadius: 12, padding: "12px 20px", textDecoration: "none", fontSize: 14.5 }}>Créer mon compte gendarme</a>
          </div>
        )}

        <div style={{ ...CARTE, marginTop: 16, padding: "22px 22px 20px" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Suivi de ton dossier</div>

          <Etape n="1" titre="Inscription" etat="fait" enfants={<div style={{ fontSize: 13.5, color: "#3A4D6B" }}>Identité RP enregistrée le {jour(candidat.creeLe)}.</div>} />

          <Etape n="2" titre="Liaison de tes comptes" etat={comptesLies ? "fait" : "cours"} enfants={
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", background: "#F2FAF5", border: "1px solid #BDE0CB", borderRadius: 14, padding: "10px 14px" }}><span style={{ fontSize: 26 }}>💬</span><div><b>Discord : @{candidat.pseudoDiscord || "—"}</b><div style={{ fontSize: 12.5, color: "#1F6B42", fontWeight: 700 }}>✅ Compte vérifié par Discord</div></div></div>
              <LiaisonRoblox candidat={candidat} onRecharger={onRecharger} />
            </div>
          } />

          <Etape n="3" titre="Enquête administrative de moralité" etat={(candidat.enquete && candidat.enquete.statut === "terminee") ? "fait" : enqueteLancee ? "cours" : "attente"} enfants={
            <div style={{ background: enq[3], border: `1px solid ${enq[2]}33`, borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 24 }}>{enq[0]}</span>
                <b style={{ color: enq[2], fontSize: 15 }}>{enq[1]}</b>
                {enqueteLancee && <span style={{ fontSize: 12, color: "#5A6B84" }}>lancée automatiquement le {heure(candidat.enquete.lancee)}</span>}
              </div>
              <div style={{ fontSize: 13, color: "#3A4D6B", marginTop: 6, lineHeight: 1.5 }}>{enq[4]}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{["TAJ", "CJN", "FPR"].map((t) => <span key={t} style={{ background: "#fff", border: "1px solid #C9D6EC", color: "#123A7A", borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 800 }}>{t}</span>)}</div>
            </div>
          } />

          <Etape n="4" titre="Ma candidature" etat={aDepose ? "fait" : "cours"} enfants={
            <div style={{ display: "grid", gap: 10 }}>
              {dossiers.map((d) => {
                const st = STATUT_DOSSIER[(d.suivi && d.suivi.statut) || "En attente"] || STATUT_DOSSIER["En attente"];
                return (
                  <div key={d.numero} style={{ border: "1px solid #D3DDEA", borderRadius: 14, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "#FBFCFE" }}>
                    <div style={{ flex: "1 1 200px" }}><b style={{ fontSize: 15 }}>{d.poste}</b><div style={{ fontSize: 12, color: "#5A6B84" }}>Dossier <span style={{ fontFamily: "'Roboto Mono', ui-monospace, monospace" }}>{d.numero}</span> · déposé le {jour(d.date)}</div></div>
                    <span style={{ background: st[2], color: st[1], borderRadius: 999, padding: "3px 12px", fontSize: 12.5, fontWeight: 800 }}>{st[0]}</span>
                  </div>
                );
              })}
              <div><NeoBouton onClick={onPostuler}>{aDepose ? "➕ Déposer une autre candidature" : "📋 Choisir une candidature"}</NeoBouton></div>
              <form onSubmit={ajouterDossier} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Retrouver un dossier déjà déposé : GAV-XXXXX-XXXXX" style={{ ...NEO_INP, flex: "1 1 260px", width: "auto", fontSize: 13 }} />
                <NeoBouton type="submit" variante="clair">Ajouter</NeoBouton>
              </form>
              {erreurDossier && <div style={{ color: "#C0172D", fontSize: 12.5 }}>{erreurDossier}</div>}
            </div>
          } />

          <Etape n="5" titre="Sélection : épreuves, jury, visite médicale" etat={dossiers.some((d) => d.suivi && d.suivi.selection) ? "cours" : "attente"} enfants={
            dossiers.some((d) => d.suivi && d.suivi.selection)
              ? <div style={{ display: "grid", gap: 10 }}>{dossiers.filter((d) => d.suivi && d.suivi.selection).map((d) => <EtapesSelectionCandidat key={d.numero} numero={d.numero} dossier={d.suivi} onRecharger={charger} />)}</div>
              : <div style={{ fontSize: 13.5, color: "#7A8AA3", lineHeight: 1.5 }}>Quand le recrutement t'y convoque, tes épreuves de culture générale et tes tests psychotechniques apparaissent ici, à passer en ligne.</div>
          } />

          <Etape dernier n="6" titre="Admission" etat={acceptes.length ? "fait" : "attente"} enfants={
            <div style={{ fontSize: 13.5, color: acceptes.length ? "#1F6B42" : "#7A8AA3", lineHeight: 1.5 }}>{acceptes.length ? "Candidature acceptée : crée ton compte gendarme avec le bouton en haut de page." : "Déclaré(e) admis(e), puis formation et titularisation."}</div>
          } />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Vue du recrutement ───────────────────────── */

const NIVEAUX = { "ras": ["RAS", "#1F6B42", "#E3F2E8"], "a-etudier": ["À étudier", "#8A5A00", "#FFF4E0"], "defavorable": ["Défavorable", "#8A1020", "#FDECEE"], "incomplet": ["Incomplet", "#3A4D6B", "#EEF2F8"] };
const AVIS = { favorable: "Avis favorable", reserve: "Avis réservé", defavorable: "Avis défavorable" };

export function EnquetesMoralite() {
  const [liste, setListe] = useState(null);
  const [filtre, setFiltre] = useState("traiter");
  const [ouvert, setOuvert] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const charger = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([getDocs(collection(db, "candidats")), getDocs(collection(db, "enquetes_moralite"))]);
      const enq = Object.fromEntries(e.docs.map((d) => [d.id, d.data()]));
      setListe(c.docs.map((d) => ({ ...d.data(), uid: d.id, rapport: enq[d.id] || null })).sort((a, b) => String(b.creeLe || "").localeCompare(String(a.creeLe || ""))));
    } catch (x) { console.error(x); setListe([]); setMsg("Lecture impossible : les règles Firestore (candidats, enquetes_moralite) sont-elles publiées ?"); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function agir(corps, ok) {
    setBusy(true); setMsg("");
    try { const j = await appelCandidat(corps); if (j.ok) { setMsg(ok); setCommentaire(""); await charger(); } else setMsg(`❌ ${j.message || "Erreur."}`); }
    catch (x) { setMsg("❌ Erreur de connexion."); }
    setBusy(false);
  }
  if (!liste) return <div style={{ padding: 20, color: "#5A6B84" }}>Chargement des inscrits…</div>;
  const nbTraiter = liste.filter((c) => (c.enquete && c.enquete.statut) !== "terminee").length;
  const nbDef = liste.filter((c) => c.rapport && c.rapport.niveau === "defavorable").length;
  const filtrees = liste.filter((c) => filtre === "tous" || (filtre === "traiter" && (c.enquete && c.enquete.statut) !== "terminee") || (filtre === "defavorable" && c.rapport && c.rapport.niveau === "defavorable") || (filtre === "terminee" && c.enquete && c.enquete.statut === "terminee"));

  return (
    <div>
      <NeoAlerte ton="info" icone="🔎">À l'inscription d'un candidat, le site consulte automatiquement le <b>TAJ</b> (mentions de casier), le <b>CJN</b> (condamnations) et le <b>FPR</b> (personnes recherchées). Tu vois ici le résultat, tu rends un avis, et le candidat voit seulement « en cours » puis « terminée ».</NeoAlerte>
      <NeoOnglets actif={filtre} onChange={setFiltre} onglets={[{ id: "traiter", label: "À traiter", n: nbTraiter }, { id: "defavorable", label: "Défavorables", n: nbDef }, { id: "terminee", label: "Terminées" }, { id: "tous", label: "Tous", n: liste.length }]} />
      {msg && <NeoAlerte ton={msg.startsWith("❌") ? "danger" : "ok"}>{msg}</NeoAlerte>}
      {filtrees.length === 0 && <NeoCarte><div style={{ color: "#5A6B84", fontSize: 14 }}>Aucun candidat dans cette liste.</div></NeoCarte>}
      {filtrees.map((c) => {
        const r = c.rapport;
        const niv = r ? NIVEAUX[r.niveau] || NIVEAUX.incomplet : ["Pas d'enquête", "#3A4D6B", "#EEF2F8"];
        const ouvertCe = ouvert === c.uid;
        return (
          <NeoCarte key={c.uid}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", cursor: "pointer" }} onClick={() => setOuvert(ouvertCe ? "" : c.uid)}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <b style={{ fontSize: 15.5 }}>{c.nom} {c.prenom}</b>
                <div style={{ fontSize: 12, color: "#5A6B84" }}>{c.numero || ""} · né(e) le {jour(c.dateNaissance)} à {c.lieuNaissance || "—"} · inscrit(e) le {jour(c.creeLe)}</div>
                <div style={{ fontSize: 12, color: "#5A6B84" }}>Roblox : @{c.pseudoRoblox || "—"} {c.robloxVerifie ? "✅ vérifié" : "⚠️ non vérifié"} · Discord : @{c.pseudoDiscord || "—"}</div>
              </div>
              <span style={{ background: niv[2], color: niv[1], borderRadius: 999, padding: "3px 12px", fontSize: 12.5, fontWeight: 800 }}>{niv[0]}</span>
              <span style={{ fontSize: 12.5, color: c.enquete && c.enquete.statut === "terminee" ? "#1F6B42" : "#8A5A00", fontWeight: 700 }}>{c.enquete && c.enquete.statut === "terminee" ? `Close : ${AVIS[r && r.avis] || "—"}` : "À examiner"}</span>
            </div>
            {ouvertCe && (
              <div style={{ marginTop: 12, borderTop: "1px solid #E4EBF5", paddingTop: 12 }}>
                {!r ? <div style={{ color: "#5A6B84", fontSize: 13.5 }}>L'enquête n'a pas pu être menée (compte Roblox manquant ou fichiers illisibles). Relance-la ci-dessous.</div> : (
                  <>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      {[["Contraventions", r.compte && r.compte.contraventions], ["Délits", r.compte && r.compte.delits], ["Crimes", r.compte && r.compte.crimes], ["CJN", r.compte && r.compte.cjn], ["FPR", r.compte && r.compte.fpr]].map(([l, n]) => <span key={l} style={{ background: n > 0 && l !== "Contraventions" ? "#FDECEE" : "#EEF2F8", color: n > 0 && l !== "Contraventions" ? "#8A1020" : "#3A4D6B", borderRadius: 999, padding: "3px 12px", fontSize: 12.5, fontWeight: 800 }}>{l} : {n || 0}</span>)}
                    </div>
                    <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 6 }}>Enquête lancée le {heure(r.lancee)} sur le compte Roblox {r.pseudoRoblox ? `@${r.pseudoRoblox}` : ""}.</div>
                    {(r.lignes || []).length === 0 ? <div style={{ fontSize: 13.5, color: "#1F6B42", fontWeight: 700 }}>Aucune mention trouvée dans le TAJ, le CJN et le FPR.</div> : (
                      <div style={{ display: "grid", gap: 4 }}>
                        {r.lignes.map((l, i) => <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, background: "#F6F9FD", border: "1px solid #E1E8F2", borderRadius: 8, padding: "5px 10px", flexWrap: "wrap" }}><b style={{ color: "#123A7A", minWidth: 40 }}>{l.fichier}</b><span style={{ flex: 1 }}>{l.libelle}</span><span style={{ color: l.gravite === "Délit" || l.gravite === "Crime" || l.fichier !== "TAJ" ? "#C0172D" : "#8A5A00", fontWeight: 700 }}>{l.gravite}</span><span style={{ color: "#8A97AB" }}>{l.date}</span></div>)}
                      </div>
                    )}
                    {r.avis && <div style={{ fontSize: 13, marginTop: 8 }}>🗂️ <b>{AVIS[r.avis]}</b> par {r.par || "—"}{r.commentaire ? ` : « ${r.commentaire} »` : ""}</div>}
                  </>
                )}
                <label style={NEO_LAB}>Commentaire (facultatif)</label>
                <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} style={{ ...NEO_INP, resize: "vertical" }} placeholder="Précise ton avis…" />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <NeoBouton disabled={busy || !r} onClick={() => agir({ action: "enquete-avis", uid: c.uid, avis: "favorable", commentaire }, "✅ Enquête close : avis favorable.")}>✅ Avis favorable</NeoBouton>
                  <NeoBouton variante="clair" disabled={busy || !r} onClick={() => agir({ action: "enquete-avis", uid: c.uid, avis: "reserve", commentaire }, "Enquête close : avis réservé.")}>🟡 Avis réservé</NeoBouton>
                  <NeoBouton variante="danger" disabled={busy || !r} onClick={() => agir({ action: "enquete-avis", uid: c.uid, avis: "defavorable", commentaire }, "Enquête close : avis défavorable.")}>⛔ Avis défavorable</NeoBouton>
                  <NeoBouton variante="clair" disabled={busy} onClick={() => agir({ action: "enquete-relancer", uid: c.uid }, "🔄 Enquête relancée.")}>🔄 Relancer l'enquête</NeoBouton>
                </div>
              </div>
            )}
          </NeoCarte>
        );
      })}
    </div>
  );
}
