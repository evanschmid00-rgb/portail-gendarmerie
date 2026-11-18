// api/pointage-cron.js — Appelé toutes les 2 minutes par un service de planification (cron-job.org) :
//  • rappels de pointage en message privé (bouton « Je pointe ») ;
//  • arrêt automatique des services sans pointage (ou > 3 h), avec message Discord d'avertissement ;
//  • archivage hebdomadaire des historiques de service (le total d'heures est conservé).
// Protégé par la variable CRON_SECRET : appel GET /api/pointage-cron?cle=TON_SECRET
import { ouvrirBase } from "./_pointage.js";
import { cycleServices } from "./_cycle.js";

export default async function handler(req, res) {
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
