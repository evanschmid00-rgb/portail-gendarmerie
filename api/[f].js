// api/[f].js — UNE seule fonction Vercel qui remplace 7 petites fonctions (Vercel gratuit = 12 fonctions maximum).
// Les adresses du site ne changent pas : /api/notify, /api/roblox-head, /api/roblox-link, /api/sync-grade et /api/quota-hebdo
// arrivent ici, puis sont envoyées au bon fichier (renommé avec un « _ » devant pour ne plus compter comme fonction).
import notify from "./_notify.js";
import robloxHead from "./_roblox-head.js";
import robloxLink from "./_roblox-link.js";
import syncGrade from "./_sync-grade.js";
import quotaHebdo from "./_quota-hebdo.js";
import candidat from "./_candidat.js";
import purgeCandidats from "./_purge.js";

const ROUTES = {
  "notify": notify,
  "roblox-head": robloxHead,
  "roblox-link": robloxLink,
  "sync-grade": syncGrade,
  "quota-hebdo": quotaHebdo,
  "candidat": candidat,
  "purge-candidats": purgeCandidats,
};

export default async function handler(req, res) {
  const nom = String((req.query && req.query.f) || "");
  const fonction = Object.prototype.hasOwnProperty.call(ROUTES, nom) ? ROUTES[nom] : null;
  if (!fonction) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, message: "Introuvable." }));
  }
  return fonction(req, res);
}
