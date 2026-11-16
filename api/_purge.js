// api/_purge.js — Nettoyage des comptes candidats (appelé chaque jour via /api/purge-candidats?cle=TON_SECRET, voir api/[f].js).
// Supprime tout espace candidat créé il y a plus de 7 jours SANS candidature déposée (fiche, enquête de moralité et compte de connexion).
// Ne touche jamais à un candidat devenu gendarme (fiche « personnel » existante). Protégé par la variable CRON_SECRET.
import { googleToken, ouvrirBase } from "./_enquete.js";

const SEMAINE_MS = 7 * 24 * 3600 * 1000;

export default async function handler(req, res) {
  const { CRON_SECRET, FIREBASE_SERVICE_ACCOUNT } = process.env;
  const url = new URL(req.url, "http://x");
  const fourni = url.searchParams.get("cle") || String(req.headers.authorization || "").replace(/^Bearer /, "");
  if (!CRON_SECRET || fourni !== CRON_SECRET) return res.status(401).json({ ok: false });
  if (!FIREBASE_SERVICE_ACCOUNT) return res.status(500).json({ ok: false, message: "Firebase pas configuré." });
  try {
    const db = await ouvrirBase(FIREBASE_SERVICE_ACCOUNT);
    const effacer = async (chemin) => { const r = await fetch(`${db.base}/${chemin}`, { method: "DELETE", headers: db.H }); return r.ok || r.status === 404; };
    let jetonAuth = null;
    const supprimerCompte = async (uid) => {
      try {
        if (!jetonAuth) jetonAuth = await googleToken(db.sa, "https://www.googleapis.com/auth/cloud-platform");
        const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${db.sa.project_id}/accounts:delete`, { method: "POST", headers: { Authorization: `Bearer ${jetonAuth}`, "Content-Type": "application/json" }, body: JSON.stringify({ localId: uid }) });
        return r.ok;
      } catch (e) { return false; }
    };
    const maintenant = Date.now();
    const candidats = await db.lister("candidats", 1000);
    let supprimes = 0, gardes = 0, comptesSupprimes = 0;
    for (const c of candidats) {
      const cree = new Date(c.creeLe || 0).getTime();
      const trop = cree && maintenant - cree >= SEMAINE_MS;
      if (!trop || c.candidatureLe || c.statut === "gendarme") { gardes++; continue; }
      if (await db.lire(`personnel/${c.id}`)) { gardes++; continue; } // devenu gendarme : on ne touche à rien
      if (!(await effacer(`candidats/${c.id}`))) continue;
      await effacer(`enquetes_moralite/${c.id}`);
      if (await supprimerCompte(c.id)) comptesSupprimes++;
      supprimes++;
    }
    return res.status(200).json({ ok: true, supprimes, comptesSupprimes, gardes });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Erreur pendant le nettoyage." });
  }
}
