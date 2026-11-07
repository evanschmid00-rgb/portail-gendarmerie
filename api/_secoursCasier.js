// api/_secoursCasier.js — Publie chaque mention de casier dans un forum Discord : un post par personne, une fiche par mention.
// Sert aussi de copie de secours quand la base est saturée. Ne lit ni n'écrit Firestore.
// Variables Vercel : DISCORD_CASIER_CHANNEL_ID (le forum ou un salon texte), DISCORD_BOT_TOKEN, DISCORD_GUILD_ID.
// Le « _ » au début = ce n'est pas une page de l'API (n'ajoute pas de fonction Vercel).
import { discordFetch } from "./_discordApi.js";

const net = (v, n) => String(v == null ? "" : v).replace(/[`@]/g, "'").slice(0, n);
const COULEUR = { Contravention: 0x2e7d4f, "Délit": 0xc77700, Crime: 0xc0172d };

export async function envoyerCopieCasier(c, env, secours = false) {
  const { DISCORD_BOT_TOKEN, DISCORD_CASIER_CHANNEL_ID, DISCORD_GUILD_ID } = env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_CASIER_CHANNEL_ID) return false;
  c = c || {};
  const m = c.mention || {};
  const entetes = { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" };
  const base = `https://discord.com/api/v10/channels/${encodeURIComponent(DISCORD_CASIER_CHANNEL_ID)}`;
  const idRoblox = net(c.robloxId, 30);
  const nomPersonne = net([c.prenom, c.nom].filter(Boolean).join(" ") || c.pseudoRoblox || "Inconnu", 60);
  const titreFil = `Casier — ${nomPersonne} · ${idRoblox || net(c.robloxUsername, 30)}`.slice(0, 100);

  const champ = (name, value, inline = true) => (value ? { name, value: net(value, 1000), inline } : null);
  const date = m.dateFaits || m.createdAt;
  const embed = {
    title: `${m.gravite ? `${m.gravite} — ` : ""}${net(m.nature || "Mention de casier", 200)}`.slice(0, 250),
    color: COULEUR[m.gravite] || 0x123a7a,
    description: secours ? "⚠️ **Copie de secours** — la base de données était saturée, cette mention est à saisir dès son retour." : undefined,
    fields: [
      champ("Personne", `${nomPersonne}\nRoblox : ${net(c.pseudoRoblox, 80)} (@${net(c.robloxUsername, 80)})`, false),
      champ("Date des faits", date ? String(date).slice(0, 10) : ""),
      champ("Amende", m.amende ? `${m.amende} €` : ""),
      champ("Garde à vue", m.tempsGav),
      champ("PV", m.pvRef),
      champ("Agent", `${net(m.gendarmeNom, 80)}${m.gendarmeMatricule ? ` (n° ${net(m.gendarmeMatricule, 20)})` : ""}`),
      champ("Remarques", m.remarques, false),
    ].filter(Boolean),
    footer: { text: `Réf. ${net(m.id, 60)}` },
    timestamp: new Date().toISOString(),
  };
  const corps = { embeds: [embed], allowed_mentions: { parse: [] } };

  let type = 0;
  try { const info = await discordFetch(base, { headers: entetes }); if (info && info.ok) type = (await info.json()).type; } catch (e) { /* on tente un message simple */ }
  if (type !== 15 && type !== 16) {
    const r = await discordFetch(`${base}/messages`, { method: "POST", headers: entetes, body: JSON.stringify(corps) });
    return !!(r && r.ok);
  }

  // Forum : on cherche le post de cette personne (actif, puis archivé), sinon on le crée
  const cle = idRoblox || net(c.robloxUsername, 30);
  let fil = null;
  try {
    if (DISCORD_GUILD_ID) {
      const a = await discordFetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(DISCORD_GUILD_ID)}/threads/active`, { headers: entetes });
      if (a && a.ok) fil = ((await a.json()).threads || []).find((t) => t.parent_id === String(DISCORD_CASIER_CHANNEL_ID) && cle && String(t.name).includes(cle)) || null;
    }
    if (!fil && cle) {
      const ar = await discordFetch(`${base}/threads/archived/public?limit=100`, { headers: entetes });
      if (ar && ar.ok) fil = ((await ar.json()).threads || []).find((t) => String(t.name).includes(cle)) || null;
    }
  } catch (e) { /* on crée un nouveau post */ }
  if (fil) {
    if (fil.thread_metadata && fil.thread_metadata.archived) await discordFetch(`https://discord.com/api/v10/channels/${fil.id}`, { method: "PATCH", headers: entetes, body: JSON.stringify({ archived: false }) });
    const r = await discordFetch(`https://discord.com/api/v10/channels/${fil.id}/messages`, { method: "POST", headers: entetes, body: JSON.stringify(corps) });
    if (r && r.ok) return true;
  }
  const r = await discordFetch(`${base}/threads`, { method: "POST", headers: entetes, body: JSON.stringify({ name: titreFil, message: corps }) });
  return !!(r && r.ok);
}
