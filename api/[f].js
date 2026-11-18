// api/[f].js — UNE seule fonction Vercel qui remplace 9 petites fonctions (Vercel gratuit = 12 fonctions maximum).
// Les adresses du site ne changent pas : /api/notify, /api/roblox-head, /api/roblox-link, /api/sync-grade, /api/quota-hebdo,
// /api/candidat, /api/purge-candidats, /api/pointage-cron et /api/service arrivent ici, puis sont envoyées au bon fichier
// (commençant par « _ » pour ne plus compter comme fonction).
// Chaque fichier est chargé SEULEMENT quand on l'appelle : si l'un manque ou a un défaut, les autres adresses continuent de marcher,
// et la réponse indique quel fichier pose problème.

const ROUTES = {
  "notify": () => import("./_notify.js"),
  "roblox-head": () => import("./_roblox-head.js"),
  "roblox-link": () => import("./_roblox-link.js"),
  "sync-grade": () => import("./_sync-grade.js"),
  "quota-hebdo": () => import("./_quota-hebdo.js"),
  "candidat": () => import("./_candidat.js"),
  "purge-candidats": () => import("./_purge.js"),
  "pointage-cron": () => import("./_pointage-cron.js"),
  "service": () => import("./_service.js"),
};

const FICHIERS = {
  "notify": "_notify.js", "roblox-head": "_roblox-head.js", "roblox-link": "_roblox-link.js", "sync-grade": "_sync-grade.js", "quota-hebdo": "_quota-hebdo.js",
  "candidat": "_candidat.js", "purge-candidats": "_purge.js", "pointage-cron": "_pointage-cron.js", "service": "_service.js",
};

export default async function handler(req, res) {
  const nom = String((req.query && req.query.f) || "");
  if (!Object.prototype.hasOwnProperty.call(ROUTES, nom)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, message: "Introuvable." }));
  }
  let fonction;
  try {
    const mod = await ROUTES[nom]();
    fonction = mod.default;
  } catch (e) {
    console.error(`Chargement de ${FICHIERS[nom]} impossible :`, e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, message: `Le fichier api/${FICHIERS[nom]} est manquant ou contient une erreur.`, detail: String((e && e.message) || e).slice(0, 300) }));
  }
  return fonction(req, res);
}
