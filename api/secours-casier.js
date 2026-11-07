// api/secours-casier.js — Copie de secours d'une mention de casier dans un salon Discord,
// quand la base de données est saturée (quota Firestore atteint). Ne lit ni n'écrit jamais Firestore.
// Variable Vercel à créer : DISCORD_CASIER_CHANNEL_ID (identifiant du salon). DISCORD_BOT_TOKEN et FIREBASE_SERVICE_ACCOUNT existent déjà.

import crypto from "node:crypto";
import { discordFetch } from "./_discordApi.js";

// Vérifie que l'appelant est connecté au site (jeton Firebase signé par Google) — sans toucher à la base
async function verifierJeton(idToken, projectId) {
  const [h, p, s] = String(idToken || "").split(".");
  if (!h || !p || !s) throw new Error("jeton");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  const certs = await (await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com")).json();
  const cert = certs[header.kid];
  const now = Math.floor(Date.now() / 1000);
  const ok = cert && header.alg === "RS256" && crypto.createVerify("RSA-SHA256").update(`${h}.${p}`).verify(cert, Buffer.from(s, "base64url"));
  if (!ok || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || payload.exp < now || !payload.sub) throw new Error("jeton invalide");
  return payload.sub;
}

const net = (v, n) => String(v == null ? "" : v).replace(/[`@]/g, "'").slice(0, n);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const { DISCORD_BOT_TOKEN, DISCORD_CASIER_CHANNEL_ID, FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_CASIER_CHANNEL_ID || !FIREBASE_SERVICE_ACCOUNT) return res.status(200).json({ ok: false, message: "Copie Discord pas configurée." });
  try {
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const { idToken, casier } = req.body || {};
    await verifierJeton(idToken, sa.project_id);
    const c = casier || {};
    const m = c.mention || {};
    const champs = Object.entries(m).filter(([k, v]) => v !== "" && v != null && typeof v !== "object").slice(0, 20).map(([k, v]) => `• **${net(k, 40)}** : ${net(v, 400)}`);
    const texte = [
      "🗂️ **Copie de secours — mention de casier** (base saturée, à saisir dès son retour)",
      `**Personne** : ${net([c.prenom, c.nom].filter(Boolean).join(" "), 120) || "—"} · Roblox : ${net(c.pseudoRoblox, 80)} (@${net(c.robloxUsername, 80)}) · ID ${net(c.robloxId, 30)}`,
      ...champs,
      `Réf. mention : \`${net(m.id, 60)}\` · ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
    ].join("\n").slice(0, 1900);
    const r = await discordFetch(`https://discord.com/api/v10/channels/${encodeURIComponent(DISCORD_CASIER_CHANNEL_ID)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: texte, allowed_mentions: { parse: [] } }),
    });
    return res.status(200).json({ ok: !!(r && r.ok) });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
}
