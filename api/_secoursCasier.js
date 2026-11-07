// api/_secoursCasier.js — Copie de secours d'une mention de casier dans un salon Discord (forum ou salon texte),
// quand la base est saturée. Ne lit ni n'écrit Firestore. Variable Vercel : DISCORD_CASIER_CHANNEL_ID.
// Le « _ » au début = ce n'est pas une page de l'API (n'ajoute pas de fonction Vercel).
import { discordFetch } from "./_discordApi.js";

const net = (v, n) => String(v == null ? "" : v).replace(/[`@]/g, "'").slice(0, n);

export async function envoyerCopieCasier(c, { DISCORD_BOT_TOKEN, DISCORD_CASIER_CHANNEL_ID }) {
  if (!DISCORD_BOT_TOKEN || !DISCORD_CASIER_CHANNEL_ID) return false;
  c = c || {};
  const m = c.mention || {};
  const champs = Object.entries(m).filter(([k, v]) => v !== "" && v != null && typeof v !== "object").slice(0, 20).map(([k, v]) => `• **${net(k, 40)}** : ${net(v, 400)}`);
  const texte = [
    "🗂️ **Copie de secours — mention de casier** (base saturée, à saisir dès son retour)",
    `**Personne** : ${net([c.prenom, c.nom].filter(Boolean).join(" "), 120) || "—"} · Roblox : ${net(c.pseudoRoblox, 80)} (@${net(c.robloxUsername, 80)}) · ID ${net(c.robloxId, 30)}`,
    ...champs,
    `Réf. mention : \`${net(m.id, 60)}\` · ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
  ].join("\n").slice(0, 1900);
  const entetes = { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" };
  const base = `https://discord.com/api/v10/channels/${encodeURIComponent(DISCORD_CASIER_CHANNEL_ID)}`;
  // Salon « forum » (type 15) ou média (16) : on ne peut pas y écrire directement, on crée un post (fil) à chaque copie
  let type = 0;
  try { const info = await discordFetch(base, { headers: entetes }); if (info && info.ok) type = (await info.json()).type; } catch (e) { /* on tente un message simple */ }
  const nomPersonne = net([c.prenom, c.nom].filter(Boolean).join(" ") || c.pseudoRoblox || "Inconnu", 60);
  const r = (type === 15 || type === 16)
    ? await discordFetch(`${base}/threads`, { method: "POST", headers: entetes, body: JSON.stringify({ name: `Casier — ${nomPersonne}`.slice(0, 100), message: { content: texte, allowed_mentions: { parse: [] } } }) })
    : await discordFetch(`${base}/messages`, { method: "POST", headers: entetes, body: JSON.stringify({ content: texte, allowed_mentions: { parse: [] } }) });
  return !!(r && r.ok);
}
