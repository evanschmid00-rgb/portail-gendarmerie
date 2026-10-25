// composants/PorteComptes.jsx — Écran « lie tes comptes Roblox et Discord » placé avant un formulaire public
// (suggestion, avis sur la brigade, avis sur un gendarme). Une fois les deux comptes liés, le formulaire s'affiche.
// children = fonction qui reçoit { robloxUsername, preuveDiscord } et renvoie le formulaire.
import React, { useEffect, useState } from "react";
import { memoriserRoblox, preuveValide, robloxMemorise } from "../lib/liaisonLocale.js";
import { Avatar, useAvatars } from "./Avatar.jsx";
import { LiaisonDiscord } from "./LiaisonDiscord.jsx";
import { buttonPrimary, smallBtn } from "./ui.jsx";
import { FONT_BASE, FONT_TITRE } from "../lib/constantes.js";
import { resoudreRoblox } from "../lib/dossierPersonne.js";

function Carte({ icone, titre, couleur, lie, resume, children }) {
  return (
    <div style={{ border: `1px solid ${lie ? "#9AD0AE" : "#D3DDEA"}`, background: lie ? "#F2FAF5" : "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: lie ? 0 : 12 }}>
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

export function PorteComptes({ titre, sous, icone = "📝", couleur = "#123A7A", onCancel, children }) {
  const [at, setAt] = useState("");
  const [roblox, setRoblox] = useState(() => robloxMemorise());
  const [verif, setVerif] = useState({ busy: false, erreur: "" });
  const [discord, setDiscord] = useState(() => preuveValide("envoi")); // { preuve, pseudo, exp }
  useEffect(() => { memoriserRoblox(roblox); }, [roblox]);
  const [pret, setPret] = useState(false);
  const avatars = useAvatars(roblox ? [roblox.id] : []);
  const discordOk = !!discord && discord.exp > Date.now();
  const input = { boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 10, padding: "10px 12px", fontSize: 14, background: "#fff", flex: "1 1 200px", fontFamily: FONT_BASE };

  async function verifierRoblox() {
    const nom = at.trim().replace(/^@/, "");
    if (!nom) { setVerif({ busy: false, erreur: "Indique ton @ Roblox (nom d'utilisateur)." }); return; }
    setVerif({ busy: true, erreur: "" });
    let c = null;
    try { c = await resoudreRoblox(nom); } catch (e) { c = null; }
    if (c) { setRoblox({ id: String(c.id), username: c.username, displayName: c.displayName }); setVerif({ busy: false, erreur: "" }); }
    else setVerif({ busy: false, erreur: "Compte Roblox introuvable (ou Roblox ne répond pas). Vérifie l'orthographe exacte de ton @." });
  }

  if (pret && roblox && discordOk) {
    return (
      <>
        <div style={{ background: "#F2FAF5", borderBottom: "1px solid #9AD0AE", color: "#1F6B42", fontSize: 12.5, fontWeight: 700, padding: "8px 16px", textAlign: "center", fontFamily: FONT_BASE }}>
          ✓ Comptes liés — Roblox : {roblox.displayName} (@{roblox.username}) · Discord : {discord.pseudo}
        </div>
        {children({ robloxUsername: roblox.username, preuveDiscord: discord.preuve })}
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 60px", fontFamily: FONT_BASE }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16, background: "#fff" }}>← Retour</button>
        <div style={{ background: `linear-gradient(135deg, #0F2A5C 0%, ${couleur} 100%)`, color: "#fff", borderRadius: 16, padding: "22px 24px", marginBottom: 18, boxShadow: "0 14px 34px -18px rgba(7,20,46,0.6)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{icone} {titre}</div>
          <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.6 }}>{sous}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 16, padding: "22px 24px", boxShadow: "0 10px 30px -18px rgba(7,20,46,0.35)" }}>
          <div style={{ fontFamily: FONT_TITRE, fontSize: 19, fontWeight: 700, color: "#14213A", marginBottom: 4 }}>Lie tes comptes Roblox et Discord</div>
          <div style={{ fontSize: 13, color: "#3A4D6B", lineHeight: 1.55, marginBottom: 16 }}>Obligatoire : cela évite les faux messages et permet à la gendarmerie de te recontacter si besoin. Tes comptes ne sont visibles que de l'administration.</div>

          <Carte icone="🎮" titre="Compte Roblox" couleur="#2F6FDE" lie={!!roblox} resume={roblox ? `${roblox.displayName} (@${roblox.username})` : ""}>
            <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 8 }}>Ton nom d'utilisateur Roblox exact (le « @ », pas le nom affiché).</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={at} onChange={(e) => setAt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); verifierRoblox(); } }} placeholder="@TonPseudoRoblox" style={input} />
              <button type="button" disabled={verif.busy} onClick={verifierRoblox} style={{ ...smallBtn, padding: "10px 16px", background: "#2F6FDE", color: "#fff", border: "none" }}>{verif.busy ? "Vérification…" : "Lier Roblox"}</button>
            </div>
            {verif.erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginTop: 8 }}>{verif.erreur}</div>}
          </Carte>
          {roblox && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "-6px 0 14px 4px" }}>
              {avatars[roblox.id] && <Avatar src={avatars[roblox.id]} taille={36} />}
              <button type="button" onClick={() => setRoblox(null)} style={{ ...smallBtn, padding: "3px 10px" }}>Changer</button>
            </div>
          )}

          <Carte icone="💬" titre="Compte Discord" couleur="#5865F2" lie={discordOk} resume={discord ? discord.pseudo : ""}>
            <LiaisonDiscord usage="envoi" onLie={(d) => setDiscord(d)} />
          </Carte>
          {discordOk && <div style={{ margin: "-6px 0 14px 4px" }}><button type="button" onClick={() => setDiscord(null)} style={{ ...smallBtn, padding: "3px 10px" }}>Changer de compte Discord</button></div>}

          <button type="button" disabled={!roblox || !discordOk} onClick={() => setPret(true)} style={{ ...buttonPrimary, width: "auto", padding: "11px 26px", marginTop: 4, background: couleur, opacity: !roblox || !discordOk ? 0.5 : 1 }}>Continuer →</button>
        </div>
      </div>
    </div>
  );
}
