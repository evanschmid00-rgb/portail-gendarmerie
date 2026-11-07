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
  const dateFr = date ? new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }) : "";
  const ICONE = { Contravention: "🟢", "Délit": "🟠", Crime: "🔴" };
  const ico = ICONE[m.gravite] || "🔵";
  const lienRoblox = idRoblox ? `https://www.roblox.com/users/${encodeURIComponent(idRoblox)}/profile` : undefined;

  // Photo du joueur (tête du personnage Roblox)
  let avatar;
  if (idRoblox) {
    try {
      const rr = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(idRoblox)}&size=150x150&format=Png&isCircular=false`);
      if (rr.ok) { const j = await rr.json(); const x = (j.data || [])[0]; if (x && x.imageUrl) avatar = x.imageUrl; }
    } catch (e) { /* pas de photo */ }
  }
  const ENTETE = "Gendarmerie Nationale · CGD Saint-Tropez RP";
  const embed = {
    author: { name: `${nomPersonne} — @${net(c.robloxUsername || c.pseudoRoblox, 60)}`, url: lienRoblox },
    title: `${ico}  ${(m.gravite || "Mention").toUpperCase()} — ${net(m.nature || "Mention de casier", 200)}`.slice(0, 250),
    color: COULEUR[m.gravite] || 0x123a7a,
    description: [
      secours ? "> ⚠️ **COPIE DE SECOURS** — la base était saturée : à saisir sur le site dès son retour.\n" : "",
      m.remarques ? `>>> ${net(m.remarques, 1500)}` : "*Aucune remarque.*",
    ].join("\n"),
    fields: [
      champ("📅  Date des faits", dateFr),
      champ("⚖️  Gravité", m.gravite),
      champ("💶  Amende", m.amende ? `**${net(m.amende, 20)} €**` : ""),
      champ("⛓️  Garde à vue", m.tempsGav ? `**${net(m.tempsGav, 30)}**` : ""),
      champ("📄  Procès-verbal", m.pvRef ? `\`${net(m.pvRef, 60)}\`` : ""),
      champ("👮  Rédigé par", `${net(m.gendarmeNom, 80)}${m.gendarmeMatricule ? ` · n° ${net(m.gendarmeMatricule, 20)}` : ""}`),
    ].filter(Boolean),
    footer: { text: `${ENTETE} · Réf. ${net(m.id, 8)}` },
    timestamp: new Date().toISOString(),
    thumbnail: avatar ? { url: avatar } : undefined,
  };
  const profil = {
    title: `🗂️  DOSSIER — ${nomPersonne.toUpperCase()}`,
    url: lienRoblox,
    color: 0x0b3a8f,
    description: `🎮 Roblox : **${net(c.pseudoRoblox, 80)}** (@${net(c.robloxUsername, 80)})\n🆔 Identifiant : \`${idRoblox || "—"}\`\n\nChaque nouvelle mention s'ajoute ci-dessous, de la plus ancienne à la plus récente.`,
    footer: { text: ENTETE },
    thumbnail: avatar ? { url: avatar } : undefined,
  };
  const corps = { embeds: [embed], allowed_mentions: { parse: [] } };
  const corpsNouveau = { embeds: [profil, embed], allowed_mentions: { parse: [] } };

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
  const r = await discordFetch(`${base}/threads`, { method: "POST", headers: entetes, body: JSON.stringify({ name: titreFil, message: corpsNouveau }) });
  return !!(r && r.ok);
}
