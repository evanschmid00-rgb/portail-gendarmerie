// api/pointage.js — Pointage de service par Discord (une seule fonction pour rester sous la limite de 12 fonctions de Vercel).
//  • POST (Discord) : clic sur le bouton « Je pointe » du message privé. URL à mettre dans le Developer Portal →
//    General Information → « Interactions Endpoint URL » : https://TON-SITE/api/pointage (+ variable Vercel DISCORD_PUBLIC_KEY).
//  • GET (cron-job.org, toutes les 2 minutes) : https://TON-SITE/api/pointage?cle=TON_CRON_SECRET
//    envoie les rappels de pointage en message privé et arrête les services dont le pointage n'a pas été fait (ou > 3 h).
import { envoyerFinService, DUREE_MAX_SERVICE_MS, INTERVALLE_POINTAGE_MS, SEUIL_POINTAGE_MS, boutonPointage, dernierPointageMs, echeancePointageMs, embedConfirme, embedDemande, embedInfo, embedManque, envoyerMP, finAuto, limitePointageMs, modifierMessage, ouvrirBase, signatureValide } from "./_pointage.js";

import { cycleServices } from "./_cycle.js";

export const config = { api: { bodyParser: false } };

async function corpsBrut(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body); // déjà lu par Vercel : on reconstitue le texte
  const morceaux = [];
  for await (const m of req) morceaux.push(typeof m === "string" ? Buffer.from(m) : m);
  return Buffer.concat(morceaux).toString("utf8");
}

async function interaction(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end("Méthode non autorisée"); }
  const { DISCORD_PUBLIC_KEY, FIREBASE_SERVICE_ACCOUNT } = process.env;
  const brut = await corpsBrut(req);
  if (!DISCORD_PUBLIC_KEY || !signatureValide(brut, String(req.headers["x-signature-ed25519"] || ""), String(req.headers["x-signature-timestamp"] || ""), DISCORD_PUBLIC_KEY)) {
    res.statusCode = 401; return res.end("Signature invalide");
  }
  const rep = (obj) => { res.statusCode = 200; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
  let i;
  try { i = JSON.parse(brut); } catch (e) { res.statusCode = 400; return res.end("Requête illisible"); }
  if (i.type === 1) return rep({ type: 1 }); // PING de vérification
  const majMessage = (embed) => rep({ type: 7, data: { embeds: [embed], components: [] } });
  const prive = (texte) => rep({ type: 4, data: { content: texte, flags: 64 } });

  if (i.type !== 3 || !String((i.data || {}).custom_id || "").startsWith("pointer:")) return prive("Action inconnue.");
  if (!FIREBASE_SERVICE_ACCOUNT) return prive("Le pointage n'est pas configuré sur le serveur.");
  try {
    const [, serviceId, echeance] = String(i.data.custom_id).split(":");
    const qui = (i.member && i.member.user && i.member.user.id) || (i.user && i.user.id) || "";
    const db = await ouvrirBase();
    const s = await db.lire(`services/${encodeURIComponent(serviceId)}`);
    if (!s || s.type === "ajustement") return majMessage(embedInfo("Service introuvable", "Ce service n'existe plus."));
    const perso = await db.personneParMatricule(s.matricule);
    if (!perso || !perso.discordId || String(perso.discordId) !== String(qui)) return prive("Ce bouton ne t'est pas destiné.");
    if (s.fin) return majMessage(embedInfo("Service terminé", "Ton service est déjà terminé : plus besoin de pointer."));
    if (String(echeancePointageMs(s)) !== String(echeance)) return majMessage(embedInfo("Pointage déjà fait", "Cette demande n'est plus valable : tu as déjà pointé (sur le site ou ici)."));
    const maintenant = Date.now();
    if (maintenant > limitePointageMs(s) || maintenant - new Date(s.debut).getTime() >= DUREE_MAX_SERVICE_MS) {
      const fin = finAuto(s);
      await db.modifier(`services/${encodeURIComponent(serviceId)}`, { fin, arretAuto: true, motifArret: "pointage" });
      await db.supprimer(`en_service/${encodeURIComponent(perso.id)}`);
      try { await envoyerFinService(db, { ...s, id: serviceId, fin, arretAuto: true, motifArret: "pointage" }, perso); } catch (e) { console.error(e); }
      return majMessage(embedManque(new Date(fin).getTime()));
    }
    const ok = await db.modifier(`services/${encodeURIComponent(serviceId)}`, { dernierPointage: new Date(maintenant).toISOString(), pointages: (Number(s.pointages) || 0) + 1 });
    if (!ok) return prive("Le pointage n'a pas pu être enregistré : réessaie dans un instant ou pointe sur le site.");
    return majMessage(embedConfirme(maintenant + INTERVALLE_POINTAGE_MS));
  } catch (e) {
    console.error(e);
    return prive("Erreur pendant le pointage : réessaie dans un instant ou pointe sur le site.");
  }
}

async function planifie(req, res) {
  const { CRON_SECRET, DISCORD_BOT_TOKEN, FIREBASE_SERVICE_ACCOUNT } = process.env;
  const url = new URL(req.url, "http://x");
  const fourni = url.searchParams.get("cle") || String(req.headers.authorization || "").replace(/^Bearer /, "");
  if (!CRON_SECRET || fourni !== CRON_SECRET) return res.status(401).json({ ok: false });
  if (!DISCORD_BOT_TOKEN || !FIREBASE_SERVICE_ACCOUNT) return res.status(500).json({ ok: false, message: "Discord ou Firebase pas configuré." });
  try {
    return res.status(200).json({ ok: true, ...(await cycleServices(await ouvrirBase())) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erreur du pointage automatique." });
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") return planifie(req, res);
  return interaction(req, res);
}
