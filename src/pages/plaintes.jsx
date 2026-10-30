// pages/plaintes.jsx — dépôt de plainte en ligne (comptes Roblox + Discord liés) et registre des plaintes (OPJ / Brigade de Recherche)
import React, { useEffect, useState } from "react";
import { defiValide, ecrire, effacer, lire, memoriserRoblox, preuveValide, robloxMemorise } from "../lib/liaisonLocale.js";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { PreuvesAffichage, PreuvesEditeur } from "../composants/Preuves.jsx";
import { Field, FieldRow, Select, StatutBadge, buttonPrimary, h2Style, smallBtn } from "../composants/ui.jsx";
import { FONT_BASE, FONT_TITRE, NATURES_INFRACTION } from "../lib/constantes.js";
import { resoudreRoblox } from "../lib/dossierPersonne.js";
import { dateFR, numAgent } from "../lib/utils.js";
import { FichePV } from "./pv.jsx";

/* ---------- Formulaire public : plainte (comptes Roblox et Discord obligatoires) ---------- */

export const MANQUEMENTS_IGGN = [
  "Abus d'autorité / abus de pouvoir",
  "Violences ou comportement agressif",
  "Propos ou comportement discriminatoire",
  "Corruption / avantage indu",
  "Faux ou dissimulation de preuves",
  "Manquement au secret professionnel",
  "Usage abusif du matériel de service",
  "Farm de service / fausse déclaration d'activité",
  "Comportement HRP répréhensible",
  "Autre manquement à la déontologie",
];

const ETAPES = ["Comptes", "Identité", "Faits", "Envoi"];
const ORIENTATIONS = [
  { id: "À orienter", titre: "Pas de préférence", texte: "La gendarmerie choisit le bon service.", icone: "🧭" },
  { id: "OPJ", titre: "Officier de police judiciaire", texte: "Plaintes courantes : vols, violences, dégradations, litiges…", icone: "⚖️" },
  { id: "Brigade de Recherche", titre: "Brigade de Recherche", texte: "Enquêtes plus longues : trafics, disparitions, affaires complexes.", icone: "🔎" },
];

async function appelerDiscord(corps) {
  try {
    const r = await fetch("/api/lier-discord", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
    return await r.json();
  } catch (e) { return { ok: false, message: "Connexion impossible : vérifie ta connexion internet et réessaie." }; }
}

function CarteLiaison({ icone, titre, lie, couleur, children, resume }) {
  return (
    <div style={{ border: `1px solid ${lie ? "#9AD0AE" : "#D3DDEA"}`, background: lie ? "#F2FAF5" : "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: lie ? 4 : 12 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: couleur, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icone}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#14213A" }}>{titre}</div>
          {lie && <div style={{ fontSize: 12.5, color: "#1F6B42", fontWeight: 700 }}>✓ Compte lié : {resume}</div>}
        </div>
      </div>
      {!lie && children}
    </div>
  );
}

export function PlainteForm({ onSubmit, onCancel, iggn = false }) {
  const CLE_BROUILLON = iggn ? "iggn_brouillon" : "plainte_brouillon";
  const blank = { plaignantPrenom: "", plaignantNom: "", dateFaits: "", lieuFaits: "", nature: iggn ? MANQUEMENTS_IGGN[0] : NATURES_INFRACTION[0], misEnCause: "", temoins: "", description: "", certifie: false, preuves: [], orientation: "À orienter", urgent: false, cible: iggn ? "gendarme" : "civil" };
  // Brouillon gardé sur l'appareil : un rechargement (retour depuis Discord sur mobile) ne fait rien perdre
  const [brouillon] = useState(() => { const b = lire(CLE_BROUILLON); return b && b.form && Date.now() - (b.t || 0) < 6 * 3600000 ? b : null; });
  const [form, setForm] = useState(() => (brouillon ? { ...blank, ...brouillon.form, preuves: [], certifie: false } : blank));
  const [etape, setEtape] = useState(() => (brouillon && Number.isInteger(brouillon.etape) ? Math.min(brouillon.etape, 3) : 0));
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  // Roblox
  const [at, setAt] = useState("");
  const [roblox, setRoblox] = useState(() => robloxMemorise()); // { id, username, displayName }
  const [verifRoblox, setVerifRoblox] = useState({ busy: false, erreur: "" });
  // Discord
  const [repriseD] = useState(() => defiValide("plainte"));
  const [okD] = useState(() => preuveValide("plainte"));
  const [pseudoDiscord, setPseudoDiscord] = useState((repriseD && repriseD.pseudo) || "");
  const [defi, setDefi] = useState((repriseD && repriseD.defi) || "");
  const [code, setCode] = useState("");
  const [preuve, setPreuve] = useState(okD ? okD.preuve : "");
  const [discordNom, setDiscordNom] = useState((okD && okD.pseudo) || (repriseD && repriseD.pseudo) || "");
  const [verifDiscord, setVerifDiscord] = useState({ busy: false, erreur: "", info: repriseD && !okD ? `Un code a déjà été envoyé en message privé à ${repriseD.pseudo} sur Discord. Saisis-le ci-dessous.` : "" });
  useEffect(() => { memoriserRoblox(roblox); }, [roblox]);
  useEffect(() => {
    const t = setTimeout(() => { if (form.description || form.plaignantNom || form.plaignantPrenom || form.misEnCause) ecrire(CLE_BROUILLON, { form: { ...form, preuves: [], certifie: false, cible: iggn ? "gendarme" : form.cible }, etape, t: Date.now() }); }, 400);
    return () => clearTimeout(t);
  }, [form, etape]);
  const avatars = useAvatars(roblox ? [roblox.id] : []);

  const maj = (patch) => setForm((f) => ({ ...f, ...patch }));
  const comptesOk = !!roblox && !!preuve;

  async function verifierRoblox() {
    const nom = at.trim().replace(/^@/, "");
    if (!nom) { setVerifRoblox({ busy: false, erreur: "Indique ton @ Roblox (nom d'utilisateur)." }); return; }
    setVerifRoblox({ busy: true, erreur: "" });
    let c = null;
    try { c = await resoudreRoblox(nom); } catch (e) { c = null; }
    if (c) { setRoblox({ id: String(c.id), username: c.username, displayName: c.displayName }); setVerifRoblox({ busy: false, erreur: "" }); }
    else setVerifRoblox({ busy: false, erreur: "Compte Roblox introuvable (ou Roblox ne répond pas). Vérifie l'orthographe exacte de ton @." });
  }
  async function envoyerCode() {
    setVerifDiscord({ busy: true, erreur: "", info: "" });
    const r = await appelerDiscord({ action: "envoyer", pseudo: pseudoDiscord, situation: iggn ? "iggn" : "plainte" });
    if (r.ok) { ecrire("plainte", { defi: r.defi, pseudo: r.pseudo, tDefi: Date.now(), preuve: "", exp: 0 }); setDefi(r.defi); setDiscordNom(r.pseudo); setCode(""); setVerifDiscord({ busy: false, erreur: "", info: `Un code à 8 chiffres vient d'être envoyé en message privé à ${r.pseudo} sur Discord.` }); }
    else setVerifDiscord({ busy: false, erreur: r.message || "Envoi du code impossible.", info: "" });
  }
  async function validerCode() {
    setVerifDiscord((v) => ({ ...v, busy: true, erreur: "" }));
    const r = await appelerDiscord({ action: "verifier", defi, code });
    if (r.ok) { ecrire("plainte", { preuve: r.preuve, pseudo: r.pseudo, exp: Date.now() + (r.duree || 25 * 60000), defi: "" }); setPreuve(r.preuve); setDiscordNom(r.pseudo); setVerifDiscord({ busy: false, erreur: "", info: "" }); }
    else setVerifDiscord((v) => ({ ...v, busy: false, erreur: r.message || "Code incorrect." }));
  }

  function suivant() {
    setErreur("");
    if (etape === 0 && !comptesOk) { setErreur("Lie ton compte Roblox ET ton compte Discord pour continuer : sans cela, la gendarmerie ne pourrait pas te recontacter."); return; }
    if (etape === 1 && (!form.plaignantPrenom.trim() || !form.plaignantNom.trim())) { setErreur("Indique ton prénom et ton nom (ceux de ton personnage)."); return; }
    if (etape === 2 && form.description.trim().length < 20) { setErreur("Décris les faits plus précisément (20 caractères minimum)."); return; }
    if (etape === 2 && form.cible === "gendarme" && !form.misEnCause.trim()) { setErreur("Indique le gendarme mis en cause (nom, prénom ou numéro de matricule si tu le connais)."); return; }
    setEtape(etape + 1); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function envoyer() {
    if (!form.certifie) { setErreur("Coche la case de certification pour envoyer " + (iggn ? "ton signalement" : "ta plainte") + "."); return; }
    setErreur(""); setBusy(true);
    const res = await onSubmit({ ...form, plaignantPrenom: form.plaignantPrenom.trim(), plaignantNom: form.plaignantNom.trim(), description: form.description.trim(), plaignantRobloxUsername: roblox.username, preuveDiscord: preuve, ...(iggn ? { cible: "iggn" } : {}) });
    setBusy(false);
    if (res && res.ok === false) setErreur(res.error || "Envoi impossible, réessaie.");
    else effacer(CLE_BROUILLON);
  }

  const bloc = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 16, padding: "22px 24px", marginBottom: 16, boxShadow: "0 10px 30px -18px rgba(7,20,46,0.35)" };
  const titreBloc = (t, sous) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: FONT_TITRE, fontSize: 19, fontWeight: 700, color: "#14213A" }}>{t}</div>
      {sous && <div style={{ fontSize: 13, color: "#3A4D6B", lineHeight: 1.55, marginTop: 3 }}>{sous}</div>}
    </div>
  );
  const btnSec = { ...smallBtn, padding: "11px 20px", fontSize: 13.5, background: "#fff" };
  const btnPri = { ...buttonPrimary, width: "auto", padding: "11px 26px", marginTop: 0, background: "#C0172D" };
  const input = { width: "100%", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 10, padding: "11px 13px", fontSize: 14, fontFamily: FONT_BASE };

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 60px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16, background: "#fff" }}>← Retour</button>
        {iggn ? (
          <div style={{ background: "#fff", borderRadius: 6, overflow: "hidden", marginBottom: 18, border: "1px solid #C3D0E2", boxShadow: "0 18px 40px -26px rgba(7,20,46,0.6)" }}>
            <img src="/banniere-iggn.jpg" alt="Inspection Générale de la Gendarmerie Nationale" style={{ display: "block", width: "100%", height: "auto" }} />
            <div style={{ display: "flex", height: 5 }}><div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: "#C0172D" }} /></div>
            <div style={{ padding: "16px 22px", display: "flex", alignItems: "center", gap: 14 }}>
              <img src="/logo-iggn.png" alt="" style={{ width: 52, height: 52, objectFit: "contain", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <div>
                <div style={{ fontFamily: FONT_TITRE, fontSize: 22, fontWeight: 700, color: "#0F2A5C" }}>Signalement à l'Inspection Générale</div>
                <div style={{ fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.5 }}>🔒 Lu <b>uniquement</b> par les administrateurs et les Référents Déontologie. Tu es recontacté(e) <b>sur Discord</b>.</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: "linear-gradient(135deg, #7A0F1E 0%, #C0172D 100%)", color: "#fff", borderRadius: 16, padding: "22px 24px", marginBottom: 18, boxShadow: "0 14px 34px -18px rgba(122,15,30,0.7)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 27, fontWeight: 700, marginBottom: 4 }}>🚨 Dépôt de plainte en ligne</div>
          <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.6 }}>{form.cible === "gendarme" ? <>Ta plainte est transmise <b>uniquement au Corps de Commandement et au Référent Déontologie</b>, qui te recontactent <b>sur Discord</b>.</> : <>Ta plainte est transmise aux officiers de police judiciaire et à la Brigade de Recherche, qui te recontactent <b>sur Discord</b>.</>} Ce formulaire ne remplace pas un dépôt en brigade en cas d'urgence. Toute déclaration mensongère peut être sanctionnée en jeu.</div>
        </div>
        )}

        {/* Étapes */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18 }}>
          {ETAPES.map((nom, i) => (
            <React.Fragment key={nom}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, opacity: i <= etape ? 1 : 0.5 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: i < etape ? "#2E7D4F" : i === etape ? "#C0172D" : "#C3D0E2", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{i < etape ? "✓" : i + 1}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#14213A" }}>{nom}</span>
              </div>
              {i < ETAPES.length - 1 && <div style={{ flex: 1, height: 3, borderRadius: 2, background: i < etape ? "#2E7D4F" : "#D3DDEA" }} />}
            </React.Fragment>
          ))}
        </div>

        {etape === 0 && (
          <div style={bloc}>
            {titreBloc("Lie tes comptes Roblox et Discord", "Obligatoire : c'est par ces deux comptes que la gendarmerie te recontactera, et cela évite les fausses plaintes.")}
            <CarteLiaison icone="🎮" titre="Compte Roblox" couleur="#2F6FDE" lie={!!roblox} resume={roblox ? `${roblox.displayName} (@${roblox.username})` : ""}>
              <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 8 }}>Ton nom d'utilisateur Roblox exact (le « @ », pas le nom affiché).</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input value={at} onChange={(e) => setAt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); verifierRoblox(); } }} placeholder="@TonPseudoRoblox" style={{ ...input, flex: "1 1 220px", width: "auto" }} />
                <button type="button" disabled={verifRoblox.busy} onClick={verifierRoblox} style={{ ...btnSec, background: "#2F6FDE", color: "#fff", border: "none" }}>{verifRoblox.busy ? "Vérification…" : "Lier Roblox"}</button>
              </div>
              {verifRoblox.erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginTop: 8 }}>{verifRoblox.erreur}</div>}
            </CarteLiaison>
            {roblox && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "-6px 0 14px 4px", fontSize: 12.5, color: "#3A4D6B" }}>
                {avatars[roblox.id] && <Avatar src={avatars[roblox.id]} taille={36} />}
                <button type="button" onClick={() => { setRoblox(null); }} style={{ ...smallBtn, padding: "3px 10px" }}>Changer</button>
              </div>
            )}

            <CarteLiaison icone="💬" titre="Compte Discord" couleur="#5865F2" lie={!!preuve} resume={discordNom}>
              {!defi ? (
                <>
                  <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 8 }}>Ton nom d'utilisateur Discord, sur <b>notre serveur Discord</b>. Un code te sera envoyé en message privé par le bot de la gendarmerie.</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input value={pseudoDiscord} onChange={(e) => setPseudoDiscord(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); envoyerCode(); } }} placeholder="ton_pseudo_discord" style={{ ...input, flex: "1 1 220px", width: "auto" }} />
                    <button type="button" disabled={verifDiscord.busy || pseudoDiscord.trim().length < 2} onClick={envoyerCode} style={{ ...btnSec, background: "#5865F2", color: "#fff", border: "none", opacity: pseudoDiscord.trim().length < 2 ? 0.6 : 1 }}>{verifDiscord.busy ? "Envoi…" : "Recevoir un code"}</button>
                  </div>
                </>
              ) : (
                <>
                  {verifDiscord.info && <div style={{ background: "#EEF0FF", border: "1px solid #C5CAFB", color: "#2C34A8", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, marginBottom: 10 }}>{verifDiscord.info}</div>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validerCode(); } }} inputMode="numeric" placeholder="Code à 8 chiffres" style={{ ...input, flex: "1 1 180px", width: "auto", letterSpacing: 4, fontFamily: "'Courier New', monospace", fontWeight: 700 }} />
                    <button type="button" disabled={verifDiscord.busy || code.length !== 8} onClick={validerCode} style={{ ...btnSec, background: "#5865F2", color: "#fff", border: "none", opacity: code.length !== 8 ? 0.6 : 1 }}>{verifDiscord.busy ? "Vérification…" : "Valider le code"}</button>
                    <button type="button" disabled={verifDiscord.busy} onClick={envoyerCode} style={btnSec}>Renvoyer</button>
                    <button type="button" onClick={() => { ecrire("plainte", { defi: "" }); setDefi(""); setCode(""); setVerifDiscord({ busy: false, erreur: "", info: "" }); }} style={btnSec}>Changer de pseudo</button>
                  </div>
                </>
              )}
              {verifDiscord.erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginTop: 8, lineHeight: 1.5 }}>{verifDiscord.erreur}</div>}
              <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 10 }}>Pas de message ? Vérifie que tes messages privés sont autorisés pour le serveur, et que tu l'as bien rejoint.</div>
            </CarteLiaison>
            {preuve && <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "-6px 0 14px 4px" }}><button type="button" onClick={() => { ecrire("plainte", { preuve: "", exp: 0, defi: "" }); setPreuve(""); setDefi(""); setCode(""); setPseudoDiscord(""); }} style={{ ...smallBtn, padding: "3px 10px" }}>Changer de compte Discord</button></div>}
          </div>
        )}

        {etape === 1 && (
          <div style={bloc}>
            {titreBloc("Qui es-tu ?", "L'identité de ton personnage dans le jeu de rôle.")}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Field label="Prénom" value={form.plaignantPrenom} onChange={(v) => maj({ plaignantPrenom: v })} />
              <Field label="Nom" value={form.plaignantNom} onChange={(v) => maj({ plaignantNom: v })} />
            </div>
            <div style={{ background: "#F2FAF5", border: "1px solid #9AD0AE", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#1F6B42", lineHeight: 1.6 }}>
              ✓ Roblox : <b>{roblox && `${roblox.displayName} (@${roblox.username})`}</b><br />✓ Discord : <b>{discordNom}</b>
            </div>
          </div>
        )}

        {etape === 2 && (
          <div style={bloc}>
            {!iggn && titreBloc("Ta plainte vise…")}
            {!iggn && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginBottom: 22 }}>
              {[["civil", "👤", "Un civil", "Traitée par les officiers de police judiciaire (OPJ) et la Brigade de Recherche."], ["gendarme", "👮", "Un gendarme", "Traitée uniquement par le Corps de Commandement et le Référent Déontologie."]].map(([id, ic, t, d]) => (
                <label key={id} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", border: `2px solid ${form.cible === id ? (id === "gendarme" ? "#123A7A" : "#C0172D") : "#D3DDEA"}`, background: form.cible === id ? (id === "gendarme" ? "#EEF4FF" : "#FDF3F4") : "#fff", borderRadius: 14, padding: "12px 14px", transition: "all .15s" }}>
                  <input type="radio" name="cible" checked={form.cible === id} onChange={() => maj({ cible: id })} style={{ marginTop: 4 }} />
                  <span style={{ fontSize: 26 }}>{ic}</span>
                  <span><b style={{ fontSize: 14 }}>{t}</b><br /><span style={{ fontSize: 12.5, color: "#5A6B84", lineHeight: 1.45 }}>{d}</span></span>
                </label>
              ))}
            </div>}
            {titreBloc("Que s'est-il passé ?")}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => maj({ dateFaits: v })} />
              <Field label="Lieu des faits" value={form.lieuFaits} onChange={(v) => maj({ lieuFaits: v })} placeholder="Ex : Nîmes RP, quartier…" />
            </div>
            <Select label={iggn ? "Nature du manquement" : "Nature de l'infraction"} value={form.nature} onChange={(v) => maj({ nature: v })} options={iggn ? MANQUEMENTS_IGGN : NATURES_INFRACTION} />
            <Field label="Description détaillée des faits" textarea value={form.description} onChange={(v) => maj({ description: v })} placeholder="Décris précisément le déroulement des faits : qui, quoi, où, quand…" />
            <div style={{ fontSize: 11.5, color: form.description.trim().length >= 20 ? "#5A6B84" : "#B25E00", margin: "-6px 0 12px" }}>{form.description.trim().length} caractère(s) — 20 minimum</div>
            <Field label={form.cible === "gendarme" ? "Gendarme mis en cause" : "Personne mise en cause (si connue)"} value={form.misEnCause} onChange={(v) => maj({ misEnCause: v })} placeholder={form.cible === "gendarme" ? "Nom, prénom, grade ou numéro d'agent" : "Pseudo ou description"} />
            <Field label="Témoins (si présents)" value={form.temoins} onChange={(v) => maj({ temoins: v })} placeholder="Pseudos des témoins" />
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: form.urgent ? "#8A1020" : "#3A4D6B", background: form.urgent ? "#FDECEE" : "transparent", borderRadius: 10, padding: form.urgent ? "8px 10px" : 0, lineHeight: 1.5 }}>
              <input type="checkbox" checked={form.urgent} onChange={(e) => maj({ urgent: e.target.checked })} style={{ marginTop: 3 }} />
              <span><b>Les faits sont récents ou en cours</b> (la plainte sera marquée urgente).</span>
            </label>
          </div>
        )}

        {etape === 3 && (
          <>
            {form.cible === "gendarme" ? (
              <div style={{ ...bloc, background: "#EEF4FF", borderColor: "#BBD0F2" }}>
                {titreBloc(iggn ? "Qui lira ton signalement ?" : "Qui s'occupera de ta plainte ?")}
                <div style={{ fontSize: 13.5, color: "#26364F", lineHeight: 1.6 }}>{iggn ? <>🔒 Signalement à l'IGGN : il sera lu <b>uniquement</b> par les <b>administrateurs</b> et les <b>Référents Déontologie</b>. Personne d'autre n'y a accès, pas même le gendarme concerné.</> : null}{iggn ? null : <>👮 Plainte contre un gendarme : elle sera lue <b>uniquement</b> par le <b>Corps de Commandement</b> et le <b>Référent Déontologie</b>. Les OPJ et la Brigade de Recherche n'y ont pas accès.</>}</div>
              </div>
            ) : (
            <div style={bloc}>
              {titreBloc("Qui doit s'occuper de ta plainte ?", "Facultatif : la gendarmerie peut toujours réorienter ta plainte.")}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ORIENTATIONS.map((o) => (
                  <label key={o.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", border: `1px solid ${form.orientation === o.id ? "#C0172D" : "#D3DDEA"}`, background: form.orientation === o.id ? "#FDF3F4" : "#fff", borderRadius: 12, padding: "10px 14px" }}>
                    <input type="radio" name="orientation" checked={form.orientation === o.id} onChange={() => maj({ orientation: o.id })} style={{ marginTop: 4 }} />
                    <span style={{ fontSize: 22 }}>{o.icone}</span>
                    <span><b style={{ fontSize: 13.5 }}>{o.titre}</b><br /><span style={{ fontSize: 12.5, color: "#5A6B84" }}>{o.texte}</span></span>
                  </label>
                ))}
              </div>
            </div>
            )}
            <div style={bloc}>
              {titreBloc("Tes preuves (facultatif)", "Captures d'écran, enregistrements, messages… Elles aident beaucoup la gendarmerie à traiter ta plainte.")}
              <PreuvesEditeur preuves={form.preuves} onChange={(p) => maj({ preuves: p })} />
            </div>
            <div style={bloc}>
              {titreBloc("Récapitulatif")}
              <div style={{ fontSize: 13, color: "#26364F", lineHeight: 1.8, marginBottom: 14 }}>
                <b>{form.plaignantPrenom} {form.plaignantNom}</b> · Roblox @{roblox && roblox.username} · Discord {discordNom}<br />
                {form.nature}{form.dateFaits ? ` — ${dateFR(form.dateFaits)}` : ""}{form.lieuFaits ? ` — ${form.lieuFaits}` : ""}{form.urgent ? " — 🚨 urgent" : ""}<br />
                {iggn ? <>Signalement à l'<b>IGGN</b> : <b>administrateurs et Référents Déontologie</b></> : form.cible === "gendarme" ? <>Plainte contre un <b>gendarme</b> : <b>Corps de Commandement et Référent Déontologie</b></> : <>Service sollicité : <b>{form.orientation === "À orienter" ? "au choix de la gendarmerie" : form.orientation}</b></>} · {form.preuves.length} preuve{form.preuves.length > 1 ? "s" : ""}
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#3A4D6B", marginBottom: 14, lineHeight: 1.5 }}>
                <input type="checkbox" checked={form.certifie} onChange={(e) => maj({ certifie: e.target.checked })} style={{ marginTop: 3 }} />
                Je certifie sur l'honneur que les déclarations ci-dessus sont sincères et véritables, et j'accepte d'être recontacté(e) sur Discord.
              </label>
            </div>
          </>
        )}

        {erreur && <div style={{ background: "#FDECEE", border: "1px solid #F3B9C0", color: "#8A1020", borderRadius: 10, padding: "9px 13px", fontSize: 13, marginBottom: 12 }}>{erreur}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          {etape > 0 ? <button type="button" onClick={() => { setErreur(""); setEtape(etape - 1); }} style={btnSec}>← Précédent</button> : <span />}
          {etape < 3
            ? <button type="button" onClick={suivant} style={{ ...btnPri, opacity: etape === 0 && !comptesOk ? 0.55 : 1 }}>Continuer →</button>
            : <button type="button" disabled={busy} onClick={envoyer} className="gh-btn-anim" style={btnPri}>{busy ? "Envoi en cours…" : iggn ? "Envoyer mon signalement" : "Envoyer ma plainte"}</button>}
        </div>
      </div>
    </div>
  );
}

// Registre des plaintes : plaintes en ligne + plaintes prises en brigade (procès-verbaux de plainte), au même endroit
export const estPVPlainte = (pv) => pv.modeleType === "Plainte" || /plainte/i.test(pv.modeleTitre || "");

export function AdminPlaintes({ plaintes, pvs = [], current, onUpdateStatut, onTakeCharge, onOrienter, onVisa }) {
  const [tab, setTab] = useState("en-cours");
  const [source, setSource] = useState("toutes");
  const [orient, setOrient] = useState("toutes");
  const [recherche, setRecherche] = useState("");
  const [ouverts, setOuverts] = useState({});
  const [fichePV, setFichePV] = useState(null);
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const estOPJ = current.isAdmin || (current.qualifications || []).includes("OPJ") || current.qualiteJudiciaire === "OPJ";

  // Les deux sources sont ramenées à la même forme
  const enLigne = plaintes.map((p) => ({
    cle: `l-${p.id}`, source: "ligne", brut: p, ref: p.ref, date: p.createdAt,
    plaignant: `${p.plaignantPrenom || ""} ${p.plaignantNom || ""}`.trim(), nature: p.nature || "Plainte",
    statut: p.statut, archivee: p.statut === "Traitée" || p.statut === "Classée", preuves: p.preuves || [],
  }));
  const brigade = pvs.filter(estPVPlainte).map((pv) => {
    const reps = pv.answers || [];
    const pers = reps.find((a) => a.type === "personne" && a.value && (a.value.nom || a.value.prenom) && /plaignant|victime/i.test(a.label)) || reps.find((a) => a.type === "personne" && a.value && (a.value.nom || a.value.prenom));
    const nature = reps.find((a) => /nature/i.test(a.label) && typeof a.value === "string" && a.value.trim());
    return {
      cle: `b-${pv.id}`, source: "brigade", brut: pv, ref: pv.ref, date: pv.createdAt,
      plaignant: pers ? `${(pers.value.prenom || "").trim()} ${(pers.value.nom || "").toUpperCase()}`.trim() : "Plaignant non précisé",
      nature: nature ? nature.value : pv.modeleTitre, statut: pv.traite ? "Visée" : "À viser", archivee: !!pv.traite,
      preuves: reps.filter((a) => a.type === "preuves").flatMap((a) => a.value || []),
    };
  });
  const tous = [...enLigne, ...brigade].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const parSource = tous.filter((x) => source === "toutes" || x.source === source);
  const parOrient = parSource.filter((x) => orient === "toutes" || (x.source === "ligne" && (x.brut.orientation || "À orienter") === orient));
  const filtres = parOrient.filter((x) => norm(`${x.ref} ${x.plaignant} ${x.nature} ${x.brut.description || ""} ${x.brut.lieuFaits || ""}`).includes(norm(recherche)));
  const enCours = filtres.filter((x) => !x.archivee);
  const archivees = filtres.filter((x) => x.archivee);
  const affiches = tab === "en-cours" ? enCours : archivees;

  const aTraiter = tous.filter((x) => !x.archivee);
  const sansPrise = enLigne.filter((x) => !x.archivee && !x.brut.prisEnChargeMatricule).length;
  const tuile = (l, v, c) => (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );
  const chip = (actif, label, onClick) => (
    <button onClick={onClick} style={{ ...smallBtn, background: actif ? "#123A7A" : "transparent", color: actif ? "#fff" : "#14213A", borderColor: actif ? "#123A7A" : "#C3D0E2" }}>{label}</button>
  );
  const COUL = { ligne: "#2F6FDE", brigade: "#0E7C86" };

  if (fichePV) {
    const pv = pvs.find((p) => p.id === fichePV);
    if (pv) return <div style={{ maxWidth: 860 }}><FichePV pv={pv} onClose={() => setFichePV(null)} canVisa={estOPJ} onVisa={onVisa} /></div>;
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={h2Style}>Plaintes</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        {tuile("À traiter", aTraiter.length, "#C0172D")}
        {tuile("Plaintes en ligne", enLigne.filter((x) => !x.archivee).length, COUL.ligne)}
        {tuile("Plaintes en brigade", brigade.filter((x) => !x.archivee).length, COUL.brigade)}
        {tuile("Non prises en charge", sansPrise, "#B25E00")}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {chip(source === "toutes", `Toutes (${tous.length})`, () => setSource("toutes"))}
        {chip(source === "ligne", `🌐 En ligne (${enLigne.length})`, () => setSource("ligne"))}
        {chip(source === "brigade", `🏛️ En brigade (${brigade.length})`, () => setSource("brigade"))}
        <span style={{ width: 1, height: 22, background: "#C3D0E2", margin: "0 4px" }} />
        {chip(orient === "toutes", "Tous services", () => setOrient("toutes"))}
        {chip(orient === "OPJ", `⚖️ OPJ (${enLigne.filter((x) => x.brut.orientation === "OPJ").length})`, () => setOrient("OPJ"))}
        {chip(orient === "Brigade de Recherche", `🔎 Brigade de Recherche (${enLigne.filter((x) => x.brut.orientation === "Brigade de Recherche").length})`, () => setOrient("Brigade de Recherche"))}
        {chip(orient === "À orienter", `🧭 À orienter (${enLigne.filter((x) => !x.brut.orientation || x.brut.orientation === "À orienter").length})`, () => setOrient("À orienter"))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {chip(tab === "en-cours", `À traiter (${enCours.length})`, () => setTab("en-cours"))}
        {chip(tab === "archivees", `Archivées (${archivees.length})`, () => setTab("archivees"))}
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (n°, plaignant, nature, lieu…)" style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #C3D0E2", borderRadius: 8, fontSize: 13.5, background: "#fff" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affiches.map((x) => {
          const p = x.brut;
          const c = COUL[x.source];
          const isMine = p.prisEnChargeMatricule === current.matricule;
          const canAct = current.isAdmin || isMine;
          const longue = x.source === "ligne" && (p.description || "").length > 320;
          const ouvert = !!ouverts[x.cle];
          return (
            <div key={x.cle} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${c}`, borderRadius: 12, padding: "16px 18px", boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{x.plaignant}{x.brut.urgent && <span style={{ marginLeft: 6, background: "#C0172D", color: "#fff", borderRadius: 20, padding: "2px 9px", fontSize: 10.5, fontWeight: 800 }}>🚨 URGENT</span>} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#123A7A", fontWeight: 600, background: "#E9EFF7", padding: "2px 7px", borderRadius: 5, marginLeft: 4 }}>{x.ref}</span></div>
                  <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>
                    {x.nature}
                    {x.source === "ligne" ? ` — ${p.dateFaits ? dateFR(p.dateFaits) : "date non précisée"} — ${p.lieuFaits || "lieu non précisé"}` : ` — rédigée le ${new Date(x.date).toLocaleDateString("fr-FR")}${p.faits && p.faits.lieu ? ` — ${p.faits.lieu}` : ""}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ background: c, color: "#fff", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, borderRadius: 20, padding: "3px 10px" }}>{x.source === "ligne" ? "🌐 EN LIGNE" : "🏛️ BRIGADE"}</span>
                  {x.source === "ligne" && <span style={{ background: "#E9EFF7", color: "#123A7A", fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: "3px 10px" }}>{p.orientation && p.orientation !== "À orienter" ? (p.orientation === "OPJ" ? "⚖️ OPJ" : "🔎 Brigade de Recherche") : "🧭 À orienter"}</span>}
                  {x.source === "ligne" ? <StatutBadge statut={p.statut} /> : <span style={{ background: p.traite ? "#E3F2E8" : "#FFF4E0", color: p.traite ? "#1F6B42" : "#B25E00", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px" }}>{x.statut}</span>}
                </div>
              </div>

              {x.source === "ligne" ? (
                <>
                  <FieldRow label="Description" value={longue && !ouvert ? p.description.slice(0, 320) + "…" : p.description} />
                  {longue && <button onClick={() => setOuverts({ ...ouverts, [x.cle]: !ouvert })} style={{ ...smallBtn, marginTop: 4 }}>{ouvert ? "Réduire" : "Lire la suite"}</button>}
                  <FieldRow label="Mis en cause" value={p.misEnCause} />
                  <FieldRow label="Témoins" value={p.temoins} />
                  <div style={{ background: p.comptesLies ? "#F2FAF5" : "#F5F8FC", border: `1px solid ${p.comptesLies ? "#9AD0AE" : "#D3DDEA"}`, borderRadius: 10, padding: "9px 12px", marginTop: 10, fontSize: 12.5, color: "#26364F", lineHeight: 1.8 }}>
                    <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: p.comptesLies ? "#1F6B42" : "#5A6B84", fontWeight: 800 }}>{p.comptesLies ? "✓ Contact vérifié (Roblox + Discord liés)" : "Contact"}</div>
                    {p.plaignantPseudoRoblox && <div>🎮 Roblox : <b>{p.plaignantPseudoRoblox}</b>{p.plaignantRobloxId && <> — <a href={`https://www.roblox.com/users/${encodeURIComponent(p.plaignantRobloxId)}/profile`} target="_blank" rel="noopener noreferrer" style={{ color: "#123A7A", fontWeight: 600 }}>voir le profil</a></>}</div>}
                    {p.plaignantPseudoDiscord && <div>💬 Discord : <b>{p.plaignantPseudoDiscord}</b>{p.plaignantDiscordId && <> — <button onClick={() => { try { navigator.clipboard.writeText(p.plaignantDiscordId); } catch (e) { /* tant pis */ } }} style={{ background: "none", border: "none", color: "#123A7A", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 12.5, textDecoration: "underline" }}>copier l'ID ({p.plaignantDiscordId})</button></>}</div>}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: "#3A4D6B", marginTop: 8 }}>Procès-verbal rédigé par <b>{p.auteurGrade ? p.auteurGrade + " " : ""}{p.auteurNom}</b>{p.visa ? ` — visé par ${p.visa.par}` : ""}.</div>
              )}

              {x.preuves.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 4 }}>Preuves ({x.preuves.length})</div>
                  <PreuvesAffichage preuves={x.preuves} />
                </div>
              )}

              {x.source === "ligne" && (p.prisEnChargeMatricule
                ? <div style={{ fontSize: 11, color: "#2F6FDE", marginTop: 8 }}>Prise en charge par {p.prisEnChargeNom} (n° {numAgent(p.prisEnChargeMatricule)}){p.prisEnChargeService ? ` — ${p.prisEnChargeService}` : ""}</div>
                : <div style={{ fontSize: 11, color: "#C0172D", marginTop: 8 }}>Non prise en charge</div>)}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {x.source === "brigade" && <button onClick={() => setFichePV(p.id)} style={{ ...smallBtn, background: "#0E7C86", color: "#fff", borderColor: "#0E7C86" }}>{estOPJ && !p.traite ? "Ouvrir / viser le PV" : "Ouvrir le PV"}</button>}
                {x.source === "ligne" && !x.archivee && onOrienter && ["OPJ", "Brigade de Recherche"].filter((o) => o !== (p.orientation || "")).map((o) => <button key={o} onClick={() => onOrienter(p.id, o)} style={smallBtn}>↪ Orienter vers {o === "OPJ" ? "les OPJ" : "la Brigade de Recherche"}</button>)}
                {x.source === "ligne" && !p.prisEnChargeMatricule && <button onClick={() => onTakeCharge(p.id)} style={{ ...smallBtn, background: "#123A7A", color: "#fff" }}>Prendre en charge</button>}
                {x.source === "ligne" && canAct && p.prisEnChargeMatricule && (
                  <>
                    <button onClick={() => onUpdateStatut(p.id, "En cours")} style={{ ...smallBtn, color: "#2F6FDE", borderColor: "#2F6FDE" }}>Marquer en cours</button>
                    <button onClick={() => onUpdateStatut(p.id, "Traitée")} style={{ ...smallBtn, color: "#2E7D4F", borderColor: "#2E7D4F" }}>Marquer traitée</button>
                    <button onClick={() => onUpdateStatut(p.id, "Classée")} style={smallBtn}>Classer sans suite</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {affiches.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>{tab === "en-cours" ? (iggn ? "Aucun signalement à traiter." : "Aucune plainte à traiter.") : (iggn ? "Aucun signalement archivé." : "Aucune plainte archivée.")}</div>}
      </div>
      <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 14 }}>Les plaintes prises en brigade sont rédigées avec le modèle « Procès-verbal de plainte » (page Procès-verbaux) ; elles apparaissent ici dès leur envoi et sont supprimées 7 jours après leur visa.</div>
    </div>
  );
}

/* ---------- Plaintes contre un gendarme : Corps de Commandement, Référent Déontologie, admins ---------- */

export function AdminPlaintesGendarmes({ plaintes, current, onUpdate, iggn = false }) {
  const [tab, setTab] = useState("en-cours");
  const [recherche, setRecherche] = useState("");
  const [ouverts, setOuverts] = useState({});
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const tri = plaintes.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const filtres = tri.filter((p) => norm(`${p.ref} ${p.plaignantPrenom} ${p.plaignantNom} ${p.misEnCause} ${p.nature} ${p.description} ${p.lieuFaits}`).includes(norm(recherche)));
  const archivee = (p) => p.statut === "Traitée" || p.statut === "Classée";
  const enCours = filtres.filter((p) => !archivee(p));
  const archivees = filtres.filter(archivee);
  const affiches = tab === "en-cours" ? enCours : archivees;
  const service = current.isAdmin ? "Administration" : (current.qualifications || []).includes("Référent Déontologie") ? "Référent Déontologie" : iggn ? "IGGN" : "Corps de Commandement";
  const chip = (actif, label, onClick) => <button onClick={onClick} style={{ ...smallBtn, background: actif ? "#123A7A" : "transparent", color: actif ? "#fff" : "#14213A", borderColor: actif ? "#123A7A" : "#C3D0E2" }}>{label}</button>;
  const tuile = (l, v, c) => (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={h2Style}>{iggn ? "Signalements IGGN" : "Plaintes contre un gendarme"}</h2>
      <div style={{ background: "linear-gradient(135deg, #0F2A5C, #123A7A)", color: "#fff", borderRadius: 14, padding: "14px 18px", marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
        {iggn
          ? <>🔒 Ces signalements adressés à l'Inspection Générale sont visibles <b>uniquement</b> par les <b>administrateurs</b> et les <b>Référents Déontologie</b>. Le Corps de Commandement, les OPJ et la Brigade de Recherche n'y ont pas accès. L'auteur est recontacté sur Discord.</>
          : <>🔒 Ces plaintes sont visibles <b>uniquement</b> par le Corps de Commandement, le Référent Déontologie et les administrateurs. Les OPJ et la Brigade de Recherche n'y ont pas accès. Le plaignant est recontacté sur Discord.</>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
        {tuile("À traiter", plaintes.filter((p) => !archivee(p)).length, "#C0172D")}
        {tuile("Non prises en charge", plaintes.filter((p) => !archivee(p) && !p.prisEnChargeMatricule).length, "#B25E00")}
        {tuile("Traitées / classées", plaintes.filter(archivee).length, "#2E7D4F")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {chip(tab === "en-cours", `À traiter (${enCours.length})`, () => setTab("en-cours"))}
        {chip(tab === "archivees", `Archivées (${archivees.length})`, () => setTab("archivees"))}
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (n°, plaignant, gendarme, lieu…)" style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #C3D0E2", borderRadius: 8, fontSize: 13.5, background: "#fff" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affiches.map((p) => {
          const longue = (p.description || "").length > 320;
          const ouvert = !!ouverts[p.id];
          const isMine = p.prisEnChargeMatricule === current.matricule;
          const canAct = current.isAdmin || isMine;
          return (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: "5px solid #123A7A", borderRadius: 12, padding: "16px 18px", boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{`${p.plaignantPrenom || ""} ${p.plaignantNom || ""}`.trim() || "Plaignant"}{p.urgent && <span style={{ marginLeft: 6, background: "#C0172D", color: "#fff", borderRadius: 20, padding: "2px 9px", fontSize: 10.5, fontWeight: 800 }}>🚨 URGENT</span>} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#123A7A", fontWeight: 600, background: "#E9EFF7", padding: "2px 7px", borderRadius: 5, marginLeft: 4 }}>{p.ref}</span></div>
                  <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>{p.nature || "Plainte"} — {p.dateFaits ? dateFR(p.dateFaits) : "date non précisée"} — {p.lieuFaits || "lieu non précisé"}</div>
                </div>
                <StatutBadge statut={p.statut} />
              </div>
              <div style={{ background: "#EEF4FF", border: "1px solid #BBD0F2", borderRadius: 10, padding: "8px 12px", marginTop: 10, fontSize: 13, color: "#14213A" }}>👮 Gendarme mis en cause : <b>{p.misEnCause || "—"}</b></div>
              <FieldRow label="Description" value={longue && !ouvert ? p.description.slice(0, 320) + "…" : p.description} />
              {longue && <button onClick={() => setOuverts({ ...ouverts, [p.id]: !ouvert })} style={{ ...smallBtn, marginTop: 4 }}>{ouvert ? "Réduire" : "Lire la suite"}</button>}
              <FieldRow label="Témoins" value={p.temoins} />
              <div style={{ background: p.comptesLies ? "#F2FAF5" : "#F5F8FC", border: `1px solid ${p.comptesLies ? "#9AD0AE" : "#D3DDEA"}`, borderRadius: 10, padding: "9px 12px", marginTop: 10, fontSize: 12.5, color: "#26364F", lineHeight: 1.8 }}>
                <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: p.comptesLies ? "#1F6B42" : "#5A6B84", fontWeight: 800 }}>{p.comptesLies ? "✓ Contact vérifié (Roblox + Discord liés)" : "Contact"}</div>
                {p.plaignantPseudoRoblox && <div>🎮 Roblox : <b>{p.plaignantPseudoRoblox}</b></div>}
                {p.plaignantPseudoDiscord && <div>💬 Discord : <b>{p.plaignantPseudoDiscord}</b>{p.plaignantDiscordId && <> — <button onClick={() => { try { navigator.clipboard.writeText(p.plaignantDiscordId); } catch (e) { /* tant pis */ } }} style={{ background: "none", border: "none", color: "#123A7A", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 12.5, textDecoration: "underline" }}>copier l'ID ({p.plaignantDiscordId})</button></>}</div>}
              </div>
              {(p.preuves || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 4 }}>Preuves ({p.preuves.length})</div>
                  <PreuvesAffichage preuves={p.preuves} />
                </div>
              )}
              {p.prisEnChargeMatricule
                ? <div style={{ fontSize: 11, color: "#2F6FDE", marginTop: 8 }}>Prise en charge par {p.prisEnChargeNom}{p.prisEnChargeService ? ` — ${p.prisEnChargeService}` : ""}</div>
                : <div style={{ fontSize: 11, color: "#C0172D", marginTop: 8 }}>Non prise en charge</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {!archivee(p) && !p.prisEnChargeMatricule && <button onClick={() => onUpdate(p.id, { prisEnChargeMatricule: current.matricule, prisEnChargeNom: `${current.prenom} ${current.nom}`, prisEnChargeService: service })} style={{ ...smallBtn, background: "#123A7A", color: "#fff" }}>Prendre en charge</button>}
                {canAct && p.prisEnChargeMatricule && !archivee(p) && (
                  <>
                    <button onClick={() => onUpdate(p.id, { statut: "En cours" })} style={{ ...smallBtn, color: "#2F6FDE", borderColor: "#2F6FDE" }}>Marquer en cours</button>
                    <button onClick={() => onUpdate(p.id, { statut: "Traitée", archiveLe: new Date().toISOString() })} style={{ ...smallBtn, color: "#2E7D4F", borderColor: "#2E7D4F" }}>Marquer traitée</button>
                    <button onClick={() => onUpdate(p.id, { statut: "Classée", archiveLe: new Date().toISOString() })} style={smallBtn}>Classer sans suite</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {affiches.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>{tab === "en-cours" ? "Aucune plainte à traiter." : "Aucune plainte archivée."}</div>}
      </div>
    </div>
  );
}
