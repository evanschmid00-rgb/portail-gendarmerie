// api/discord-interactions.js — Reçoit les clics sur le bouton « Je pointe » du message privé Discord.
// À configurer une fois : Discord Developer Portal → ton application → General Information → « Interactions Endpoint URL »
// = https://TON-SITE/api/discord-interactions , et la variable Vercel DISCORD_PUBLIC_KEY (clé publique de la même page).
import { DUREE_MAX_SERVICE_MS, embedConfirme, embedInfo, embedManque, INTERVALLE_POINTAGE_MS, echeancePointageMs, finAuto, limitePointageMs, ouvrirBase, signatureValide } from "./_pointage.js";

export const config = { api: { bodyParser: false } };

async function corpsBrut(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body); // déjà lu par Vercel : on reconstitue le texte
  const morceaux = [];
  for await (const m of req) morceaux.push(typeof m === "string" ? Buffer.from(m) : m);
  return Buffer.concat(morceaux).toString("utf8");
}

export default async function handler(req, res) {
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
