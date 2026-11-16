// api/_candidat.js — Actions de l'espace candidat (appelées via /api/candidat, voir api/[f].js) :
//   • roblox-start / roblox-verify : lier son compte Roblox en collant un code dans sa description Roblox ;
//   • enquete-avis / enquete-relancer : réservées au recrutement (enquête administrative de moralité).
// Variable utilisée : FIREBASE_SERVICE_ACCOUNT (déjà en place).
import { Refus, ouvrirBase, verifierJeton, resoudreRoblox, descriptionRoblox, codeRoblox, lancerEnquete } from "./_enquete.js";

const AVIS = { favorable: "Avis favorable", reserve: "Avis réservé", defavorable: "Avis défavorable" };

export default async function handler(req, res) {
  const rep = (corps, code = 200) => res.status(code).json(corps);
  if (req.method !== "POST") return rep({ ok: false, message: "Méthode refusée." }, 405);
  const { FIREBASE_SERVICE_ACCOUNT, SITE_URL } = process.env;
  if (!FIREBASE_SERVICE_ACCOUNT) return rep({ ok: false, message: "Service indisponible pour le moment." }, 500);
  try {
    const hotes = new Set([String(req.headers.host || "")]);
    try { if (SITE_URL) hotes.add(new URL(SITE_URL).host); } catch (e) { /* ignoré */ }
    let origine = "";
    try { origine = new URL(String(req.headers.origin || req.headers.referer || "")).host; } catch (e) { /* vide */ }
    if (!origine || !hotes.has(origine)) throw new Refus("Requête refusée.", 403);

    const corps = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const action = String(corps.action || "");
    const db = await ouvrirBase(FIREBASE_SERVICE_ACCOUNT);
    let uid;
    try { uid = await verifierJeton(corps.idToken, db.sa.project_id); } catch (e) { throw new Refus("Connexion invalide, reconnecte-toi.", 401); }

    // ── Actions du candidat sur son propre dossier ──
    if (action === "roblox-start" || action === "roblox-verify") {
      const cand = await db.lire(`candidats/${uid}`);
      if (!cand) throw new Refus("Aucun dossier candidat pour ce compte.", 404);
      if (action === "roblox-start") {
        const pseudo = String(corps.pseudo || "").trim().replace(/^@/, "");
        if (!/^[A-Za-z0-9_]{3,20}$/.test(pseudo)) throw new Refus("Pseudo Roblox invalide.");
        const compte = await resoudreRoblox(pseudo);
        if (!compte) throw new Refus("Compte Roblox introuvable. Vérifie l'orthographe exacte du nom d'utilisateur.", 404);
        const code = codeRoblox();
        await db.ecrire(`candidats/${uid}`, { robloxEnAttente: { id: compte.id, nom: compte.username, code, le: new Date().toISOString() } });
        return rep({ ok: true, code, nom: compte.username });
      }
      const att = cand.robloxEnAttente;
      if (!att || !att.code) throw new Refus("Commence d'abord par saisir ton pseudo Roblox pour obtenir ton code.");
      const desc = await descriptionRoblox(att.id);
      if (desc === null) throw new Refus("Roblox ne répond pas, réessaie dans un instant.", 502);
      if (!desc.includes(att.code)) throw new Refus(`Le code ${att.code} n'est pas encore dans la description de ton profil Roblox. Enregistre-le, puis réessaie.`);
      const maj = { pseudoRoblox: att.nom, robloxUsername: att.nom, robloxId: String(att.id), robloxVerifie: true };
      await db.ecrire(`candidats/${uid}`, maj, ["robloxEnAttente"]);
      // Un autre compte Roblox que celui déclaré à l'inscription : l'enquête repart sur le bon compte
      if (String(cand.robloxId || "") !== String(att.id)) await lancerEnquete(db, uid, { ...cand, ...maj });
      return rep({ ok: true, nom: att.nom, id: String(att.id) });
    }

    // ── Actions réservées au recrutement ──
    if (action === "enquete-avis" || action === "enquete-relancer") {
      const moi = await db.lire(`personnel/${uid}`);
      const quals = (moi && moi.qualifications) || [];
      if (!moi || !(moi.isAdmin === true || quals.includes("Recruteur") || quals.includes("Personnel AMGN"))) throw new Refus("Réservé au recrutement.", 403);
      const cible = String(corps.uid || "");
      if (!/^[A-Za-z0-9_-]{5,128}$/.test(cible)) throw new Refus("Candidat inconnu.");
      const cand = await db.lire(`candidats/${cible}`);
      if (!cand) throw new Refus("Candidat introuvable.", 404);
      if (action === "enquete-relancer") {
        const r = await lancerEnquete(db, cible, cand);
        return rep({ ok: true, ...r });
      }
      const avis = String(corps.avis || "");
      if (!AVIS[avis]) throw new Refus("Avis inconnu.");
      const maintenant = new Date().toISOString();
      const nomMoi = `${moi.grade ? moi.grade + " " : ""}${moi.prenom || ""} ${moi.nom || ""}`.trim();
      await db.ecrire(`enquetes_moralite/${cible}`, { avis, commentaire: String(corps.commentaire || "").slice(0, 1000), par: nomMoi, le: maintenant });
      await db.ecrire(`candidats/${cible}`, { enquete: { statut: "terminee", lancee: (cand.enquete && cand.enquete.lancee) || maintenant, terminee: maintenant } });
      return rep({ ok: true });
    }
    throw new Refus("Action inconnue.");
  } catch (e) {
    if (e instanceof Refus) return rep({ ok: false, message: e.message }, e.statut);
    console.error(e);
    return rep({ ok: false, message: "Erreur du serveur, réessaie dans un instant." }, 500);
  }
}
