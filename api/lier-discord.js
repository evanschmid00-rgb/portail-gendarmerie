// api/lier-discord.js — Liaison d'un compte Discord pour les civils (dépôt de plainte).
// 1) action "envoyer"  : le bot cherche la personne sur le serveur Discord et lui envoie un code par message privé.
// 2) action "verifier" : la personne recopie le code ; si c'est bon, on renvoie une preuve signée (valable 30 minutes).
import crypto from "node:crypto";
import { empreinteCode, lire, signer } from "./_liaison.js";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const essais = new Map(); // limite simple par adresse (par instance du serveur)

function limite(ip, max, fenetreMs) {
  const maintenant = Date.now();
  const liste = (essais.get(ip) || []).filter((t) => maintenant - t < fenetreMs);
  if (liste.length >= max) return false;
  liste.push(maintenant);
  essais.set(ip, liste);
  return true;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const reponse = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return reponse(405, { ok: false, message: "Méthode non autorisée." });
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, FIREBASE_SERVICE_ACCOUNT, SITE_URL } = process.env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !FIREBASE_SERVICE_ACCOUNT) return reponse(500, { ok: false, message: "Discord n'est pas configuré sur le serveur." });

  // La requête doit venir de ton propre site
  const hotes = new Set([String(req.headers.host || "")]);
  try { if (SITE_URL) hotes.add(new URL(SITE_URL).host); } catch (e) { /* ignoré */ }
  let origine = "";
  try { origine = new URL(String(req.headers.origin || req.headers.referer || "")).host; } catch (e) { /* vide */ }
  if (!origine || !hotes.has(origine)) return reponse(403, { ok: false, message: "Requête refusée." });

  const ip = String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "inconnue").split(",")[0].trim();
  try {
    const corps = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const bot = { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" };

    if (corps.action === "envoyer") {
      if (!limite(`e-${ip}`, 5, 10 * 60000)) return reponse(429, { ok: false, message: "Trop d'essais : attends quelques minutes puis réessaie." });
      const pseudo = String(corps.pseudo || "").trim().replace(/^@/, "").split("#")[0].trim();
      if (pseudo.length < 2 || pseudo.length > 40) return reponse(200, { ok: false, message: "Indique ton pseudo Discord exact (nom d'utilisateur)." });
      const sr = await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/search?query=${encodeURIComponent(pseudo)}&limit=10`, { headers: bot });
      if (!sr.ok) return reponse(200, { ok: false, message: "Discord ne répond pas pour le moment, réessaie dans un instant." });
      const membres = await sr.json();
      const cible = (Array.isArray(membres) ? membres : []).find((m) => m.user && !m.user.bot && [m.user.username, m.user.global_name, m.nick].some((x) => x && norm(x) === norm(pseudo)));
      if (!cible) return reponse(200, { ok: false, message: `« ${pseudo} » est introuvable sur notre serveur Discord. Rejoins d'abord le serveur, puis réessaie avec ton nom d'utilisateur exact.` });

      const code = String(crypto.randomInt(0, 100000000)).padStart(8, "0");
      const exp = Date.now() + 10 * 60000;
      const dm = await fetch("https://discord.com/api/users/@me/channels", { method: "POST", headers: bot, body: JSON.stringify({ recipient_id: cible.user.id }) });
      if (!dm.ok) return reponse(200, { ok: false, message: "Impossible de t'écrire en message privé. Autorise les messages privés des membres du serveur (Paramètres de confidentialité du serveur), puis réessaie." });
      const canal = await dm.json();
      const msg = await fetch(`https://discord.com/api/channels/${canal.id}/messages`, { method: "POST", headers: bot, body: JSON.stringify({ content: `🔐 **Gendarmerie Nîmes RP** — ton code de vérification pour déposer plainte : **${code}**\nIl est valable 10 minutes. Si ce n'est pas toi, ignore ce message.` }) });
      if (!msg.ok) return reponse(200, { ok: false, message: "Le message privé a été refusé. Autorise les messages privés des membres du serveur, puis réessaie." });
      const defi = signer({ t: "defi", id: cible.user.id, u: cible.user.username, exp, h: empreinteCode(code, cible.user.id, exp) });
      return reponse(200, { ok: true, defi, pseudo: cible.user.username, message: "Code envoyé en message privé Discord." });
    }

    if (corps.action === "verifier") {
      if (!limite(`v-${ip}`, 10, 10 * 60000)) return reponse(429, { ok: false, message: "Trop d'essais : attends quelques minutes puis recommence." });
      const defi = lire(corps.defi);
      const code = String(corps.code || "").replace(/\D/g, "");
      if (!defi || defi.t !== "defi") return reponse(200, { ok: false, message: "Le code a expiré : demande-en un nouveau." });
      if (code.length !== 8 || empreinteCode(code, defi.id, defi.exp) !== defi.h) return reponse(200, { ok: false, message: "Code incorrect." });
      const duree = corps.usage === "candidature" ? 12 * 3600000 : 30 * 60000; // un formulaire de candidature est long à remplir
      const preuve = signer({ t: "preuve", id: defi.id, u: defi.u, exp: Date.now() + duree });
      return reponse(200, { ok: true, preuve, pseudo: defi.u, duree: duree - 60000 });
    }
    return reponse(400, { ok: false, message: "Action inconnue." });
  } catch (e) {
    console.error(e);
    return reponse(500, { ok: false, message: "Erreur pendant la liaison Discord." });
  }
}
