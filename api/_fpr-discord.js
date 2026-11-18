// api/_fpr-discord.js — Publie le Fichier des Personnes Recherchées (FPR) dans son propre forum Discord (route /api/fpr-discord, voir api/[f].js).
//  • "inscrit" : crée un post « 🚨 RECHERCHÉ — @pseudo » avec la fiche (catégorie, dangerosité, motif, conduite à tenir) ;
//  • "leve"    : ajoute « ✅ Recherche levée », renomme le post et l'archive.
// Le contenu est relu dans la base (collection fpr) : le navigateur n'envoie que l'identifiant de la fiche.
// Variables Vercel : DISCORD_FPR_CHANNEL_ID (le forum des personnes recherchées), DISCORD_BOT_TOKEN, FIREBASE_SERVICE_ACCOUNT.
import { discordFetch } from "./_discordApi.js";
import { Refus, verifierJeton } from "./_enquete.js";
import { ouvrirBase } from "./_pointage.js";

const net = (v, n) => String(v == null ? "" : v).replace(/[`@]/g, "'").slice(0, n);
const DANGER = { "Élevée": { couleur: 0xC0172D, icone: "🔴" }, Moyenne: { couleur: 0xE0A23A, icone: "🟠" }, Faible: { couleur: 0x2F6FDE, icone: "🔵" } };
const ENTETE = "Gendarmerie Nationale · CGD Saint-Tropez RP";
const API = "https://discord.com/api/v10";

async function tete(robloxId) {
  if (!/^\d{1,15}$/.test(String(robloxId || ""))) return "";
  try {
    const r = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    return (j && j.data && j.data[0] && j.data[0].imageUrl) || "";
  } catch (e) { return ""; }
}

export function embedRecherche(f, photo) {
  const d = DANGER[f.danger] || DANGER.Moyenne;
  const lien = f.robloxId ? `https://www.roblox.com/users/${encodeURIComponent(f.robloxId)}/profile` : undefined;
  return {
    author: { name: ENTETE },
    title: `🚨  RECHERCHÉ — @${net(f.robloxUsername, 60)}`,
    url: lien,
    color: d.couleur,
    description: `**${net(f.categorie, 60).toUpperCase()}**${f.pseudoRoblox && f.pseudoRoblox !== f.robloxUsername ? `\n🎮 Pseudo affiché : ${net(f.pseudoRoblox, 60)}` : ""}`,
    ...(photo ? { thumbnail: { url: photo } } : {}),
    fields: [
      { name: `${d.icone} Dangerosité`, value: `**${net(f.danger, 20)}**`, inline: true },
      { name: "📅 Inscrit le", value: f.createdAt ? `<t:${Math.floor(new Date(f.createdAt).getTime() / 1000)}:D>` : "—", inline: true },
      { name: "👮 Inscrit par", value: net(f.saisiParNom, 80) || "—", inline: true },
      { name: "📋 Motif", value: net(f.motif, 900) || "—" },
      { name: "⚠️ Conduite à tenir", value: net(f.conduite, 400) || "Contacter un OPJ." },
    ],
    footer: { text: `${ENTETE} · Réf. ${net(f.id, 8)}` },
    timestamp: new Date().toISOString(),
  };
}

export async function publierRecherche(db, f, evenement, env = process.env) {
  const { DISCORD_BOT_TOKEN, DISCORD_FPR_CHANNEL_ID } = env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_FPR_CHANNEL_ID) return { ok: false, raison: "forum non configuré" };
  const h = { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" };
  const base = `${API}/channels/${encodeURIComponent(DISCORD_FPR_CHANNEL_ID)}`;
  const chemin = `fpr/${encodeURIComponent(f.id)}`;
  let type = 0;
  try { const i = await discordFetch(base, { headers: h }); if (i && i.ok) type = (await i.json()).type; } catch (e) { /* salon simple */ }
  const forum = type === 15 || type === 16;
  const nom = net(f.robloxUsername, 40);

  if (evenement === "inscrit") {
    if (f.discordFil) return { ok: true, deja: true };
    const photo = await tete(f.robloxId);
    const corps = { embeds: [embedRecherche(f, photo)], allowed_mentions: { parse: [] } };
    if (forum) {
      const r = await discordFetch(`${base}/threads`, { method: "POST", headers: h, body: JSON.stringify({ name: `🚨 ${net(f.categorie, 30)} — @${nom}`.slice(0, 100), message: corps }) });
      if (!r || !r.ok) return { ok: false, raison: "Discord a refusé" };
      const fil = await r.json();
      await db.modifier(chemin, { discordFil: String(fil.id) });
      return { ok: true };
    }
    const r = await discordFetch(`${base}/messages`, { method: "POST", headers: h, body: JSON.stringify(corps) });
    if (r && r.ok) { const m = await r.json(); await db.modifier(chemin, { discordMsg: String(m.id) }); }
    return { ok: !!(r && r.ok) };
  }

  // recherche levée
  const embedLevee = { author: { name: ENTETE }, title: `✅  RECHERCHE LEVÉE — @${nom}`, color: 0x2E7D4F, description: `La recherche de **@${nom}** (${net(f.categorie, 60)}) est **levée**${f.leveeParNom ? ` par **${net(f.leveeParNom, 80)}**` : ""}.`, footer: { text: ENTETE }, timestamp: new Date().toISOString() };
  if (forum && f.discordFil) {
    await discordFetch(`${API}/channels/${encodeURIComponent(f.discordFil)}/messages`, { method: "POST", headers: h, body: JSON.stringify({ embeds: [embedLevee], allowed_mentions: { parse: [] } }) });
    await discordFetch(`${API}/channels/${encodeURIComponent(f.discordFil)}`, { method: "PATCH", headers: h, body: JSON.stringify({ name: `✅ LEVÉE — @${nom}`.slice(0, 100), archived: true }) });
    return { ok: true };
  }
  const r = await discordFetch(`${base}/messages`, { method: "POST", headers: h, body: JSON.stringify({ embeds: [embedLevee], allowed_mentions: { parse: [] } }) });
  return { ok: !!(r && r.ok) };
}

export default async function handler(req, res) {
  const rep = (corps, code = 200) => res.status(code).json(corps);
  if (req.method !== "POST") return rep({ ok: false, message: "Méthode refusée." }, 405);
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.DISCORD_BOT_TOKEN) return rep({ ok: false, message: "Discord pas configuré." }, 500);
  try {
    const corps = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const db = await ouvrirBase();
    let uid;
    try { uid = await verifierJeton(corps.idToken, JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).project_id); } catch (e) { throw new Refus("Connexion invalide.", 401); }
    const moi = await db.lire(`personnel/${encodeURIComponent(uid)}`);
    if (!moi) throw new Refus("Réservé aux gendarmes.", 403);
    const id = String(corps.ficheId || "");
    if (!/^[A-Za-z0-9_-]{5,40}$/.test(id)) throw new Refus("Fiche invalide.");
    const fiche = await db.lire(`fpr/${id}`);
    if (!fiche) throw new Refus("Fiche introuvable.", 404);
    fiche.id = id;
    const ev = corps.evenement === "leve" ? "leve" : "inscrit";
    if (ev === "inscrit" && fiche.actif === false) return rep({ ok: true, ignore: true });
    if (ev === "leve" && fiche.actif !== false) return rep({ ok: true, ignore: true });
    return rep(await publierRecherche(db, fiche, ev));
  } catch (e) {
    if (e instanceof Refus) return rep({ ok: false, message: e.message }, e.statut || 400);
    console.error(e);
    return rep({ ok: false, message: "Erreur du serveur." }, 500);
  }
}
