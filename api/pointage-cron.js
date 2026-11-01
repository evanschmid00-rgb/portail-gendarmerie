// api/pointage-cron.js — Appelé toutes les 2 minutes par un service de planification (cron-job.org) :
//  • envoie le rappel de pointage en message privé (bouton « Je pointe ») aux gendarmes en service dont le pointage est dû ;
//  • arrête les services dont le pointage n'a pas été fait dans les 10 minutes (ou qui dépassent 3 h), même si le site est fermé.
// Protégé par la variable CRON_SECRET : appel GET /api/pointage-cron?cle=TON_SECRET
import { DUREE_MAX_SERVICE_MS, SEUIL_POINTAGE_MS, boutonPointage, dernierPointageMs, echeancePointageMs, embedDemande, embedManque, envoyerMP, finAuto, modifierMessage, ouvrirBase } from "./_pointage.js";

export default async function handler(req, res) {
  const { CRON_SECRET, DISCORD_BOT_TOKEN, FIREBASE_SERVICE_ACCOUNT } = process.env;
  const url = new URL(req.url, "http://x");
  const fourni = url.searchParams.get("cle") || String(req.headers.authorization || "").replace(/^Bearer /, "");
  if (!CRON_SECRET || fourni !== CRON_SECRET) return res.status(401).json({ ok: false });
  if (!DISCORD_BOT_TOKEN || !FIREBASE_SERVICE_ACCOUNT) return res.status(500).json({ ok: false, message: "Discord ou Firebase pas configuré." });
  try {
    const db = await ouvrirBase();
    const ouverts = await db.requete({ from: [{ collectionId: "services" }], where: { fieldFilter: { field: { fieldPath: "fin" }, op: "EQUAL", value: { nullValue: null } } } });
    const t = Date.now();
    let rappels = 0, arrets = 0;
    for (const s of ouverts) {
      if (s.type === "ajustement" || !s.debut || !s.pointage) continue;
      const chemin = `services/${encodeURIComponent(s.id)}`;
      const dernier = dernierPointageMs(s);
      const tropLong = t - new Date(s.debut).getTime() >= DUREE_MAX_SERVICE_MS;
      const manque = t - dernier >= SEUIL_POINTAGE_MS;
      if (tropLong || manque) {
        const fin = finAuto(s);
        if (!(await db.modifier(chemin, { fin, arretAuto: true, motifArret: manque && !tropLong ? "pointage" : "duree" }))) continue;
        const p = await db.personneParMatricule(s.matricule);
        if (p) await db.supprimer(`en_service/${encodeURIComponent(p.id)}`);
        if (s.pointageMsg && s.pointageMsg.c) await modifierMessage(s.pointageMsg.c, s.pointageMsg.m, { embeds: [embedManque(new Date(fin).getTime())], components: [] });
        arrets++;
        continue;
      }
      // Pointage dû et rappel pas encore envoyé pour cette échéance
      const echeance = echeancePointageMs(s);
      if (t >= echeance && !(s.pointageDemandeLe && new Date(s.pointageDemandeLe).getTime() > dernier)) {
        const p = await db.personneParMatricule(s.matricule);
        let msg = null;
        if (p && p.discordId) msg = await envoyerMP(String(p.discordId), { content: "⏰ **Pointage de service** : confirme ta présence !", embeds: [embedDemande(p.prenom, s)], components: boutonPointage(s.id, echeance) });
        await db.modifier(chemin, { pointageDemandeLe: new Date(t).toISOString(), ...(msg ? { pointageMsg: msg } : {}) });
        rappels++;
      }
    }
    return res.status(200).json({ ok: true, enService: ouverts.length, rappels, arrets });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erreur du pointage automatique." });
  }
}
