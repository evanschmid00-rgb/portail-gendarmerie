// composants/LiaisonDiscord.jsx — Liaison d'un compte Discord : pseudo → code reçu en message privé du bot → validation.
// Appelle /api/lier-discord. onLie({ preuve, pseudo, exp }) est appelé quand le code est validé.
import React, { useEffect, useState } from "react";
import { smallBtn } from "./ui.jsx";
import { defiValide, ecrire, preuveValide } from "../lib/liaisonLocale.js";

async function appeler(corps) {
  try {
    const r = await fetch("/api/lier-discord", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
    return await r.json();
  } catch (e) { return { ok: false, message: "Connexion impossible : vérifie ta connexion internet et réessaie." }; }
}

export function LiaisonDiscord({ usage = "plainte", onLie, defaut = "" }) {
  // Si la page a été rechargée (mobile : retour depuis Discord), on reprend là où la personne en était
  const [reprise] = useState(() => defiValide(usage));
  const [pseudo, setPseudo] = useState((reprise && reprise.pseudo) || defaut);
  const [defi, setDefi] = useState((reprise && reprise.defi) || "");
  const [code, setCode] = useState("");
  const [etat, setEtat] = useState({ busy: false, erreur: "", info: reprise ? `Un code a déjà été envoyé en message privé à ${reprise.pseudo} sur Discord. Saisis-le ci-dessous.` : "" });

  useEffect(() => {
    const ok = preuveValide(usage);
    if (ok) onLie({ ...ok });
  }, []);
  const input = { boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 10, padding: "10px 12px", fontSize: 14, background: "#fff", flex: "1 1 200px" };
  const btn = { ...smallBtn, padding: "10px 16px", background: "#5865F2", color: "#fff", border: "none" };

  async function envoyer() {
    setEtat({ busy: true, erreur: "", info: "" });
    const r = await appeler({ action: "envoyer", pseudo });
    if (r.ok) { ecrire(usage, { defi: r.defi, pseudo: r.pseudo, tDefi: Date.now(), preuve: "", exp: 0 }); setDefi(r.defi); setCode(""); setEtat({ busy: false, erreur: "", info: `Un code à 8 chiffres vient d'être envoyé en message privé à ${r.pseudo} sur Discord.` }); }
    else setEtat({ busy: false, erreur: r.message || "Envoi du code impossible.", info: "" });
  }
  async function valider() {
    setEtat((e) => ({ ...e, busy: true, erreur: "" }));
    const r = await appeler({ action: "verifier", defi, code, usage });
    if (r.ok) { const exp = Date.now() + (r.duree || 25 * 60000); ecrire(usage, { preuve: r.preuve, pseudo: r.pseudo, exp, defi: "" }); onLie({ preuve: r.preuve, pseudo: r.pseudo, exp }); }
    else setEtat((e) => ({ ...e, busy: false, erreur: r.message || "Code incorrect." }));
  }

  return (
    <div>
      {!defi ? (
        <>
          <div style={{ fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.5, marginBottom: 10 }}>Indique ton nom d'utilisateur Discord <b>sur notre serveur Discord</b> (rejoins-le d'abord si ce n'est pas fait). Le bot de la gendarmerie t'enverra un code en message privé.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (pseudo.trim().length > 1) envoyer(); } }} placeholder="ton_pseudo_discord" style={input} />
            <button type="button" disabled={etat.busy || pseudo.trim().length < 2} onClick={envoyer} style={{ ...btn, opacity: pseudo.trim().length < 2 ? 0.6 : 1 }}>{etat.busy ? "Envoi…" : "Recevoir un code"}</button>
          </div>
        </>
      ) : (
        <>
          {etat.info && <div style={{ background: "#EEF0FF", border: "1px solid #C5CAFB", color: "#2C34A8", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, marginBottom: 10 }}>{etat.info}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (code.length === 8) valider(); } }} inputMode="numeric" placeholder="Code à 8 chiffres" style={{ ...input, letterSpacing: 4, fontFamily: "'Courier New', monospace", fontWeight: 700 }} />
            <button type="button" disabled={etat.busy || code.length !== 8} onClick={valider} style={{ ...btn, opacity: code.length !== 8 ? 0.6 : 1 }}>{etat.busy ? "Vérification…" : "Valider le code"}</button>
            <button type="button" disabled={etat.busy} onClick={envoyer} style={{ ...smallBtn, padding: "10px 14px", background: "#fff" }}>Renvoyer</button>
            <button type="button" onClick={() => { ecrire(usage, { defi: "" }); setDefi(""); setCode(""); setEtat({ busy: false, erreur: "", info: "" }); }} style={{ ...smallBtn, padding: "10px 14px", background: "#fff" }}>Changer de pseudo</button>
          </div>
        </>
      )}
      {etat.erreur && <div style={{ marginTop: 10, background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.45 }}>{etat.erreur}</div>}
      <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 10 }}>Pas de message ? Vérifie que tes messages privés sont autorisés pour le serveur et que tu l'as bien rejoint.</div>
    </div>
  );
}
