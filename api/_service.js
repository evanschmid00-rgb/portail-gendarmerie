// api/_service.js — Messages Discord de prise et de fin de service (appelé par le site via /api/service, voir api/[f].js).
//  • action "debut" : MP « service démarré » + liste des tâches de la personne ;
//  • action "fin"   : MP avec le résumé du service (ou l'avertissement si pointage manqué / arrêt par l'administration).
// Le contenu (résumé, motif d'arrêt) est lu dans la base, pas envoyé par le navigateur : impossible de le truquer.
import { Refus, verifierJeton } from "./_enquete.js";
import { envoyerDebutService, envoyerFinService, ouvrirBase } from "./_pointage.js";

export default async function handler(req, res) {
  const rep = (corps, code = 200) => res.status(code).json(corps);
  if (req.method !== "POST") return rep({ ok: false, message: "Méthode refusée." }, 405);
  const { FIREBASE_SERVICE_ACCOUNT, DISCORD_BOT_TOKEN } = process.env;
  if (!FIREBASE_SERVICE_ACCOUNT || !DISCORD_BOT_TOKEN) return rep({ ok: false, message: "Discord pas configuré." }, 500);
  try {
    const corps = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const db = await ouvrirBase();
    let uid;
    try { uid = await verifierJeton(corps.idToken, JSON.parse(FIREBASE_SERVICE_ACCOUNT).project_id); } catch (e) { throw new Refus("Connexion invalide.", 401); }
    const moi = await db.lire(`personnel/${encodeURIComponent(uid)}`);
    if (!moi) throw new Refus("Réservé aux gendarmes.", 403);
    const serviceId = String(corps.serviceId || "");
    if (!/^[A-Za-z0-9_-]{5,40}$/.test(serviceId)) throw new Refus("Service invalide.");
    const s = await db.lire(`services/${serviceId}`);
    if (!s || s.type === "ajustement" || !s.matricule) throw new Refus("Service introuvable.", 404);
    s.id = serviceId;
    const perso = await db.personneParMatricule(s.matricule);
    if (!perso) return rep({ ok: true, envoye: false });
    const proprietaire = perso.id === uid;
    if (corps.action === "debut") {
      if (!proprietaire) throw new Refus("Ce service n'est pas le tien.", 403);
      if (s.fin) return rep({ ok: true, envoye: false });
      if (Date.now() - new Date(s.debut).getTime() > 15 * 60000) return rep({ ok: true, envoye: false });
      const taches = (Array.isArray(corps.taches) ? corps.taches : []).slice(0, 8).map((t) => ({ icone: String(t.icone || "").slice(0, 4), titre: String(t.titre || "").slice(0, 80), detail: String(t.detail || "").slice(0, 140), nombre: Math.min(999, Number(t.nombre) || 1) }));
      return rep({ ok: true, envoye: await envoyerDebutService(db, s, perso, taches) });
    }
    if (corps.action === "fin") {
      if (!s.fin) throw new Refus("Ce service n'est pas terminé.");
      if (!proprietaire && !moi.isAdmin) throw new Refus("Action refusée.", 403);
      return rep({ ok: true, envoye: await envoyerFinService(db, s, perso) });
    }
    throw new Refus("Action inconnue.");
  } catch (e) {
    if (e instanceof Refus) return rep({ ok: false, message: e.message }, e.statut || e.code || 400);
    console.error(e);
    return rep({ ok: false, message: "Erreur du serveur." }, 500);
  }
}
