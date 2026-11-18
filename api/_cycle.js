// api/_cycle.js — Cycle automatique des services (appelé toutes les 2 minutes par le cron : /api/pointage-cron ou /api/pointage).
//  • rappel de pointage en message privé, puis dernier rappel 5 min plus tard ;
//  • arrêt automatique des services sans pointage (ou > 3 h) + message de fin avec avertissement ;
//  • archivage hebdomadaire des historiques (le total d'heures est conservé).
import { DUREE_MAX_SERVICE_MS, SEUIL_POINTAGE_MS, boutonPointage, dernierPointageMs, echeancePointageMs, embedDemande, embedManque, envoyerFinService, envoyerMP, finAuto, limitePointageMs, modifierMessage, purgerHebdo } from "./_pointage.js";

export async function cycleServices(db) {
  const ouverts = await db.requete({ from: [{ collectionId: "services" }], where: { fieldFilter: { field: { fieldPath: "fin" }, op: "EQUAL", value: { nullValue: null } } } });
  const t = Date.now();
  let rappels = 0, derniersRappels = 0, arrets = 0;
  for (const s of ouverts) {
    if (s.type === "ajustement" || !s.debut || !s.pointage) continue;
    const chemin = `services/${encodeURIComponent(s.id)}`;
    const dernier = dernierPointageMs(s);
    const tropLong = t - new Date(s.debut).getTime() >= DUREE_MAX_SERVICE_MS;
    const manque = t - dernier >= SEUIL_POINTAGE_MS;
    if (tropLong || manque) {
      const fin = finAuto(s);
      const motifArret = manque && !tropLong ? "pointage" : "duree";
      if (!(await db.modifier(chemin, { fin, arretAuto: true, motifArret }))) continue;
      const p = await db.personneParMatricule(s.matricule);
      if (p) await db.supprimer(`en_service/${encodeURIComponent(p.id)}`);
      if (s.pointageMsg && s.pointageMsg.c) await modifierMessage(s.pointageMsg.c, s.pointageMsg.m, { embeds: [embedManque(new Date(fin).getTime())], components: [] });
      try { await envoyerFinService(db, { ...s, fin, arretAuto: true, motifArret }, p); } catch (e) { console.error(e); }
      arrets++;
      continue;
    }
    const echeance = echeancePointageMs(s);
    const demandeLe = s.pointageDemandeLe ? new Date(s.pointageDemandeLe).getTime() : 0;
    if (t >= echeance && !(demandeLe > dernier)) {
      const p = await db.personneParMatricule(s.matricule);
      let msg = null;
      if (p && p.discordId) msg = await envoyerMP(String(p.discordId), { content: "⏰ **Pointage de service** : confirme ta présence !", embeds: [embedDemande(p.prenom, s)], components: boutonPointage(s.id, echeance) });
      await db.modifier(chemin, { pointageDemandeLe: new Date(t).toISOString(), ...(msg ? { pointageMsg: msg } : {}) });
      rappels++;
    } else if (demandeLe > dernier && t >= echeance + 5 * 60000 && !(s.pointageRappel2Le && new Date(s.pointageRappel2Le).getTime() > dernier)) {
      const p = await db.personneParMatricule(s.matricule);
      if (p && p.discordId) await envoyerMP(String(p.discordId), { content: `⚠️ **Dernier rappel** : tu n'as pas encore pointé. Sans réponse avant <t:${Math.floor(limitePointageMs(s) / 1000)}:T>, ton service sera **arrêté automatiquement**.` });
      await db.modifier(chemin, { pointageRappel2Le: new Date(t).toISOString() });
      derniersRappels++;
    }
  }
  let archivage = null;
  try { archivage = await purgerHebdo(db, t); } catch (e) { console.error("Archivage hebdomadaire :", e); }
  return { enService: ouverts.length, rappels, derniersRappels, arrets, archivage };
}
