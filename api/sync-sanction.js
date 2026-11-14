// Rôles Discord de sanction : donnés pendant la sanction, retirés à la fin (ou à la levée anticipée).
// Sert aussi à arrêter automatiquement les services restés ouverts plus de 6 h (action « balayer »).
// Les rôles utilisables sont ceux configurés par un admin sur le site (réglage « sanctionRoles ») : le navigateur ne peut pas choisir un rôle.
//
// Actions (POST, connecté au site) :
//   "ajouter"  : donne le rôle de la sanction (admin ou haut grade)
//   "retirer"  : retire le rôle d'une sanction levée ou terminée (admin)
//   "balayer"  : retire les rôles de TOUTES les sanctions terminées ou levées (n'importe quel gendarme connecté, sans risque :
//                le serveur ne regarde que les dates enregistrées)
// Appel automatique (GET) : tâche planifiée Vercel, protégée par la variable CRON_SECRET.

import crypto from "node:crypto";
import { envoyerCopieCasier } from "./_secoursCasier.js";

const b64url = (b) => Buffer.from(b).toString("base64url");

function signJwt(payload, privateKey) {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64url(sig)}`;
}

async function googleToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, sa.private_key);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Jeton Google refusé");
  return j.access_token;
}

// Vérifie que la personne qui appelle est bien connectée au site (jeton Firebase signé par Google)
async function verifierJeton(idToken, projectId) {
  const [h, p, s] = String(idToken || "").split(".");
  if (!h || !p || !s) throw new Error("jeton");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  const certs = await (await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com")).json();
  const cert = certs[header.kid];
  const now = Math.floor(Date.now() / 1000);
  const ok = cert && header.alg === "RS256" && crypto.createVerify("RSA-SHA256").update(`${h}.${p}`).verify(cert, Buffer.from(s, "base64url"));
  if (!ok || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || payload.exp < now || !payload.sub) throw new Error("jeton invalide");
  return payload.sub;
}

const fromFs = (f) => {
  if (!f) return null;
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return f.doubleValue;
  if ("booleanValue" in f) return f.booleanValue;
  if ("arrayValue" in f) return (f.arrayValue.values || []).map(fromFs);
  if ("mapValue" in f) { const o = {}; Object.entries(f.mapValue.fields || {}).forEach(([k, v]) => { o[k] = fromFs(v); }); return o; }
  return null;
};
const versObjet = (d) => { const o = {}; Object.entries((d && d.fields) || {}).forEach(([k, v]) => { o[k] = fromFs(v); }); return o; };

export default async function handler(req, res) {
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, FIREBASE_SERVICE_ACCOUNT, CRON_SECRET } = process.env;
  const reponse = (ok, message, alerte = false) => res.status(200).json({ ok, message, alerte });
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !FIREBASE_SERVICE_ACCOUNT) return reponse(false, "Synchronisation Discord pas configurée.");
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ ok: false });

  try {
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const fsHeaders = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };

    let dernierStatut = 0;
    const lireDoc = async (chemin) => {
      const r = await fetch(`${base}/${chemin}`, { headers: fsHeaders });
      if (!r.ok && r.status !== 404) dernierStatut = r.status;
      return r.ok ? versObjet(await r.json()) : null;
    };
    const requete = async (structuredQuery) => {
      const r = await fetch(`${base}:runQuery`, { method: "POST", headers: fsHeaders, body: JSON.stringify({ structuredQuery }) });
      const arr = await r.json();
      return Array.isArray(arr) ? arr.filter((x) => x.document).map((x) => ({ id: x.document.name.split("/").pop(), ...versObjet(x.document) })) : [];
    };
    const personnelParMatricule = async (matricule) => {
      const l = await requete({ from: [{ collectionId: "personnel" }], where: { fieldFilter: { field: { fieldPath: "matricule" }, op: "EQUAL", value: { stringValue: String(matricule) } } }, limit: 1 });
      return l[0] || null;
    };
    // La personne visée par une sanction : par son compte (cibleUid) ; pour les anciennes sanctions, par matricule
    // en ignorant les comptes créés APRÈS la sanction (un matricule réutilisé ne doit pas reprendre l'ancienne sanction).
    const personneDeSanction = async (s) => {
      if (s.cibleUid) {
        const d = await lireDoc(`personnel/${encodeURIComponent(String(s.cibleUid))}`);
        return d ? { id: String(s.cibleUid), ...d } : null;
      }
      const l = await requete({ from: [{ collectionId: "personnel" }], where: { fieldFilter: { field: { fieldPath: "matricule" }, op: "EQUAL", value: { stringValue: String(s.matricule) } } }, limit: 10 });
      const ok = l.filter((p) => !p.creeLe || !s.dateDebut || String(p.creeLe) <= String(s.dateDebut));
      ok.sort((a, b) => String(b.creeLe || "").localeCompare(String(a.creeLe || "")));
      return ok[0] || null;
    };
    const marquer = (id, statut) => fetch(`${base}/sanctions/${encodeURIComponent(id)}?updateMask.fieldPaths=statutDiscord`, { method: "PATCH", headers: fsHeaders, body: JSON.stringify({ fields: { statutDiscord: { stringValue: statut } } }) });

    // Réglages faits sur le site : rôles de sanction (type -> ID du rôle Discord) et seuil « haut grade »
    const reglages = (await lireDoc("settings/general")) || {};
    const rolesSanction = reglages.sanctionRoles && typeof reglages.sanctionRoles === "object" ? reglages.sanctionRoles : {};
    const seuilHaut = reglages.seuilHautRang || 14;

    const bot = { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "X-Audit-Log-Reason": encodeURIComponent("Sanction portail") };
    const urlRole = (discordId, roleId) => `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${discordId}/roles/${roleId}`;
    const donnerRole = (discordId, roleId) => fetch(urlRole(discordId, roleId), { method: "PUT", headers: bot });
    const retirerRole = async (discordId, roleId) => { const r = await fetch(urlRole(discordId, roleId), { method: "DELETE", headers: bot }); return r.ok || r.status === 404; };

    const termine = (s) => s.levee === true || new Date(s.dateFin) <= new Date();

    // Message privé du bot (embed) ; renvoie true si Discord l'a accepté
    const netT = (v, n) => String(v == null ? "" : v).replace(/@/g, "＠").slice(0, n);
    const envoyerMp = async (discordId, embed) => {
      try {
        const hb = { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" };
        const ch = await fetch("https://discord.com/api/v10/users/@me/channels", { method: "POST", headers: hb, body: JSON.stringify({ recipient_id: String(discordId) }) });
        const cj = ch.ok ? await ch.json() : null;
        if (!cj || !cj.id) return false;
        return (await fetch(`https://discord.com/api/v10/channels/${cj.id}/messages`, { method: "POST", headers: hb, body: JSON.stringify({ embeds: [embed] }) })).ok;
      } catch (e) { console.error(e); return false; }
    };
    // Rappel automatique des convocations des prochaines 24 h (au passage de la tâche planifiée)
    const rappelerConvocations = async () => {
      try {
        const maintenant = new Date(), limite = new Date(Date.now() + 24 * 3600 * 1000);
        const l = await requete({ from: [{ collectionId: "convocations" }], where: { compositeFilter: { op: "AND", filters: [
          { fieldFilter: { field: { fieldPath: "dateHeure" }, op: "GREATER_THAN" , value: { stringValue: maintenant.toISOString() } } },
          { fieldFilter: { field: { fieldPath: "dateHeure" }, op: "LESS_THAN", value: { stringValue: limite.toISOString() } } } ] } }, limit: 50 });
        for (const c of l) {
          if (c.rappelEnvoye === true || c.reponse === "Empêché") continue;
          const cible = await lireDoc(`personnel/${encodeURIComponent(String(c.cibleUid || ""))}`);
          if (!cible || !cible.discordId) continue;
          const t = Math.floor(Date.parse(c.dateHeure) / 1000);
          const ok = await envoyerMp(cible.discordId, { title: "⏰ Rappel de convocation", description: `Tu es convoqué(e) <t:${t}:R>.`, color: 0xc77700, fields: [
            { name: "📅 Quand", value: `<t:${t}:F>`, inline: false }, { name: "📍 Où", value: netT(c.lieu, 200) || "—", inline: true },
            { name: "👤 Par qui", value: netT(`${c.parGrade || ""} ${c.parNom || ""}`.trim(), 120) || "—", inline: true }, { name: "📝 Pourquoi", value: netT(c.motif, 900) || "—", inline: false } ] });
          if (ok) await fetch(`${base}/convocations/${encodeURIComponent(c.id)}?updateMask.fieldPaths=rappelEnvoye`, { method: "PATCH", headers: fsHeaders, body: JSON.stringify({ fields: { rappelEnvoye: { booleanValue: true } } }) });
        }
      } catch (e) { console.error("Rappels de convocation", e); }
    };

    // PVe en attente de visa depuis plus de 48 h : un seul message récapitulatif aux OPJ (le PVe est ensuite marqué « rappelé »)
    const rappelerPVe = async () => {
      try {
        const seuil = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
        const l = await requete({ from: [{ collectionId: "pv" }], where: { fieldFilter: { field: { fieldPath: "traite" }, op: "EQUAL", value: { booleanValue: false } } }, limit: 100 });
        const attente = l.filter((p) => p.aCorriger !== true && p.rappelOPJ !== true && String(p.createdAt) < seuil);
        if (!attente.length) return;
        const opjs = await requete({ from: [{ collectionId: "personnel" }], where: { fieldFilter: { field: { fieldPath: "qualifications" }, op: "ARRAY_CONTAINS", value: { stringValue: "OPJ" } } }, limit: 100 });
        let envoye = false;
        for (const o of opjs) {
          if (!o.discordId) continue;
          const liste = attente.slice(0, 10).map((p) => `• **${netT(p.ref || "PVe", 40)}** — ${netT(p.modeleTitre || "", 60)} (${netT(p.auteurNom || "", 40)})`).join("\n");
          const ok = await envoyerMp(o.discordId, { title: "⏰ PVe en attente de visa", description: `**${attente.length}** procès-verbal(aux) électronique(s) attendent ton visa depuis plus de 48 h :\n${liste}${attente.length > 10 ? "\n…" : ""}`, color: 0xc77700, timestamp: new Date().toISOString() });
          envoye = envoye || ok;
        }
        if (envoye) for (const p of attente) await fetch(`${base}/pv/${encodeURIComponent(p.id)}?updateMask.fieldPaths=rappelOPJ`, { method: "PATCH", headers: fsHeaders, body: JSON.stringify({ fields: { rappelOPJ: { booleanValue: true } } }) });
      } catch (e) { console.error("Rappels PVe", e); }
    };

    // Services oubliés : tout service ouvert depuis plus de 6 h est arrêté (fin = début + 6 h, jamais « maintenant »)
    const MAX_SERVICE_MS = 6 * 3600 * 1000;
    const balayerServices = async () => {
      const seuil = new Date(Date.now() - MAX_SERVICE_MS).toISOString();
      const ouverts = await requete({ from: [{ collectionId: "services" }], where: { fieldFilter: { field: { fieldPath: "fin" }, op: "EQUAL", value: { nullValue: null } } } });
      let arretes = 0;
      for (const s of ouverts) {
        if (s.type === "ajustement" || !s.debut || String(s.debut) > seuil) continue;
        const fin = new Date(new Date(s.debut).getTime() + MAX_SERVICE_MS).toISOString();
        const r = await fetch(`${base}/services/${encodeURIComponent(s.id)}?updateMask.fieldPaths=fin&updateMask.fieldPaths=arretAuto`, { method: "PATCH", headers: fsHeaders, body: JSON.stringify({ fields: { fin: { stringValue: fin }, arretAuto: { booleanValue: true } } }) });
        if (!r.ok) continue;
        const p = await personnelParMatricule(s.matricule);
        if (p) await fetch(`${base}/en_service/${encodeURIComponent(p.id)}`, { method: "DELETE", headers: fsHeaders });
        arretes++;
      }
      return arretes;
    };

    // Retire le rôle d'une sanction terminée/levée ; renvoie "retire", "attente" (à réessayer) ou "ignore"
    const retirerPourSanction = async (s) => {
      const roleId = rolesSanction[s.type];
      if (!roleId) { await marquer(s.id, "retiré"); return "ignore"; }
      const cible = await personneDeSanction(s);
      if (!cible || !cible.discordId) { await marquer(s.id, "retiré"); return "ignore"; }
      // On ne retire pas le rôle si le gendarme a une AUTRE sanction du même type encore en cours
      const champ = s.cibleUid ? "cibleUid" : "matricule";
      const memes = await requete({ from: [{ collectionId: "sanctions" }], where: { fieldFilter: { field: { fieldPath: champ }, op: "EQUAL", value: { stringValue: String(s[champ]) } } } });
      if (memes.some((x) => x.id !== s.id && x.type === s.type && !termine(x) && (x.cibleUid ? x.cibleUid === cible.id : true))) { await marquer(s.id, "retiré"); return "ignore"; }
      const ok = await retirerRole(cible.discordId, roleId);
      if (!ok) return "attente";
      await marquer(s.id, "retiré");
      return "retire";
    };

    // Compteurs anti-spam expirés (créés par /api/soumettre) : nettoyage
    const purgerLimites = async () => {
      const vieux = await requete({ from: [{ collectionId: "limites_envois" }], where: { fieldFilter: { field: { fieldPath: "expireLe" }, op: "LESS_THAN", value: { stringValue: new Date().toISOString() } } }, limit: 300 });
      for (const d of vieux) await fetch(`${base}/limites_envois/${encodeURIComponent(d.id)}`, { method: "DELETE", headers: fsHeaders });
      return vieux.length;
    };

    const balayer = async () => {
      try { await purgerLimites(); } catch (e) { console.error("Purge des limites", e); }
      let nbServices = 0;
      try { nbServices = await balayerServices(); } catch (e) { console.error("Balayage des services", e); }
      const actives = await requete({ from: [{ collectionId: "sanctions" }], where: { fieldFilter: { field: { fieldPath: "statutDiscord" }, op: "EQUAL", value: { stringValue: "actif" } } } });
      let retires = 0, attente = 0;
      for (const s of actives) {
        if (!termine(s)) continue;
        const r = await retirerPourSanction(s);
        if (r === "retire") retires++;
        if (r === "attente") attente++;
      }
      if (attente) return reponse(false, `${attente} rôle(s) de sanction n'ont pas pu être retirés : place le rôle du bot AU-DESSUS des rôles de sanction. (${nbServices} service(s) oublié(s) arrêté(s).)`, true);
      return reponse(true, `${retires} rôle(s) de sanction retiré(s), ${nbServices} service(s) oublié(s) arrêté(s).`);
    };

    // Appel automatique (tâche planifiée Vercel)
    if (req.method === "GET") {
      if (!CRON_SECRET || String(req.headers.authorization || "") !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false });
      await rappelerConvocations();
      await rappelerPVe();
      return await balayer();
    }

    const { idToken, sanctionId, action } = req.body || {};
    const uid = await verifierJeton(idToken, sa.project_id);
    // Copie de secours d'un casier sur Discord (base saturée) : on ne touche pas à Firestore ici
    if (action === "secours-casier") return res.status(200).json({ ok: await envoyerCopieCasier((req.body || {}).casier, process.env, !!(req.body || {}).secours) });
    let moi = await lireDoc(`personnel/${encodeURIComponent(uid)}`);
    // Compte dont la fiche n'a pas pour identifiant l'uid de connexion : on la retrouve par son identifiant (partie avant le @ de l'adresse de connexion)
    if (!moi) {
      try {
        const mail = JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString()).email || "";
        const ident = mail.split("@")[0];
        if (ident) { const l = await requete({ from: [{ collectionId: "personnel" }], where: { fieldFilter: { field: { fieldPath: "username" }, op: "EQUAL", value: { stringValue: ident } } }, limit: 1 }); if (l[0]) moi = l[0]; }
      } catch (e) { console.error(e); }
    }
    const reglagesGen = action === "convocation" ? ((await lireDoc("settings/general")) || {}) : {};
    if (!moi && dernierStatut === 429) return res.status(200).json({ ok: false, alerte: true, message: "La base de données est saturée (quota Firebase du jour atteint) : le serveur ne peut plus rien lire. Réessaie après 9 h, ou passe au forfait Blaze." });
    if (!moi && dernierStatut) return res.status(200).json({ ok: false, alerte: true, message: "Le serveur n'arrive pas à lire la base de données (erreur " + dernierStatut + "). Vérifie la variable FIREBASE_SERVICE_ACCOUNT sur Vercel." });
    if (!moi) return res.status(200).json({ ok: false, alerte: true, message: "Ta fiche de personnel est introuvable côté serveur (identifiant de connexion " + uid + "). Préviens un administrateur." });

    // PVe visé ou renvoyé pour correction : le bot prévient son auteur en message privé (action réservée aux OPJ / admins)
    if (action === "pv-vise" || action === "pv-renvoye") {
      const opj = moi.isAdmin === true || (Array.isArray(moi.qualifications) && moi.qualifications.includes("OPJ")) || moi.qualiteJudiciaire === "OPJ";
      if (!opj) return res.status(200).json({ ok: false, message: "Réservé aux OPJ." });
      const renvoi = action === "pv-renvoye";
      const pv = await lireDoc(`pv/${encodeURIComponent(String((req.body || {}).pvId || ""))}`);
      if (!pv || (renvoi ? pv.aCorriger !== true : pv.traite !== true)) return res.status(200).json({ ok: false, message: renvoi ? "PVe introuvable ou non renvoyé." : "PV introuvable ou pas encore visé." });
      const auteur = pv.auteurUid ? await lireDoc(`personnel/${encodeURIComponent(String(pv.auteurUid))}`) : await personnelParMatricule(pv.auteurMatricule);
      if (!auteur || !auteur.discordId) return res.status(200).json({ ok: false, message: "Auteur non relié à Discord." });
      if (renvoi) {
        const c = pv.correction || {};
        const ok = await envoyerMp(auteur.discordId, { title: "↩ Ton PVe est renvoyé pour correction", description: `Ton procès-verbal **${netT(pv.modeleTitre || "PVe", 100)}** (${netT(pv.ref || "", 40)}) doit être corrigé. Ouvre l'application PVe, onglet « À corriger ».`, color: 0xc0172d, fields: [
          { name: "Renvoyé par", value: netT(`${c.grade || ""} ${c.par || ""}`.trim(), 120) || "—", inline: true },
          { name: "À corriger", value: netT(c.commentaire, 900) || "—", inline: false } ], timestamp: new Date().toISOString() });
        return res.status(200).json({ ok });
      }
      const v = pv.visa || {};
      const ok = await envoyerMp(auteur.discordId, { title: "✅ Ton PVe a été visé", description: `Ton procès-verbal **${netT(pv.modeleTitre || "PVe", 100)}** (${netT(pv.ref || "", 40)}) a été visé.`, color: 0x2e7d4f, fields: [
        { name: "Visé par", value: netT(`${v.grade || ""} ${v.par || ""}`.trim(), 120) || "—", inline: true },
        ...(v.observations ? [{ name: "Observations", value: netT(v.observations, 900), inline: false }] : []) ], timestamp: new Date().toISOString() });
      return res.status(200).json({ ok });
    }

    if (action === "balayer") return await balayer();

    // Convocation d'un gendarme : message privé du bot (réservé à Adjudant-Chef et au-dessus)
    if (action === "convocation") {
      const nm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const liste = Array.isArray(reglagesGen.grades) && reglagesGen.grades.length ? reglagesGen.grades : ["Gendarme Adjoint Volontaire 2ème Classe", "Gendarme Adjoint Volontaire 1ère Classe", "Brigadier", "Brigadier-chef", "Maréchal des Logis", "Gendarme Sous Contrat", "Gendarme de Carrière", "Maréchal des Logis-Chef", "Adjudant", "Adjudant-Chef"];
      const iMini = liste.findIndex((g) => nm(g) === "adjudantchef");
      const rangMini = iMini >= 0 ? iMini : 9;
      const rangMoi = Math.max(Number.isFinite(Number(moi.gradeRank)) ? Number(moi.gradeRank) : -1, liste.findIndex((g) => nm(g) === nm(moi.grade)));
      if (!(moi.isAdmin === true || rangMoi >= rangMini)) return res.status(200).json({ ok: false, alerte: true, message: `Il faut être Adjudant-Chef ou plus pour convoquer (ton grade : ${moi.grade || "inconnu"}).` });
      const dem = (req.body || {}).convocation || {};
      const cible = await lireDoc(`personnel/${encodeURIComponent(String(dem.cibleUid || ""))}`);
      if (!cible) return reponse(false, "Gendarme à convoquer introuvable.", true);
      const dh = new Date(dem.dateHeure);
      if (isNaN(dh) || !String(dem.lieu || "").trim() || !String(dem.motif || "").trim()) return reponse(false, "Lieu, date et motif obligatoires.", true);
      const cv = {
        cibleUid: String(dem.cibleUid), cibleNom: `${cible.grade ? cible.grade + " " : ""}${cible.prenom || ""} ${cible.nom || ""}`.trim(), cibleMatricule: String(cible.matricule || ""),
        parUid: uid, parNom: `${moi.prenom || ""} ${moi.nom || ""}`.trim(), parGrade: moi.grade || "",
        lieu: String(dem.lieu).trim().slice(0, 200), dateHeure: dh.toISOString(), motif: String(dem.motif).trim().slice(0, 900), createdAt: new Date().toISOString(),
      };
      const cr = await fetch(`${base}/convocations`, { method: "POST", headers: fsHeaders, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(cv).map(([k, v]) => [k, { stringValue: v }])) }) });
      if (!cr.ok) return reponse(false, "Enregistrement de la convocation impossible (base saturée ?).", true);
      const idCv = (await cr.json()).name.split("/").pop();
      const marquerCv = (mp) => fetch(`${base}/convocations/${encodeURIComponent(idCv)}?updateMask.fieldPaths=mpEnvoye`, { method: "PATCH", headers: fsHeaders, body: JSON.stringify({ fields: { mpEnvoye: { booleanValue: mp } } }) });
      const sortie = (ok, message, alerte) => res.status(200).json({ ok, message, alerte, convocation: { ...cv, id: idCv, mpEnvoye: ok } });
      if (!cible.discordId) { await marquerCv(false); return sortie(false, "Ce gendarme n'est pas relié à Discord : la convocation est enregistrée mais aucun message n'a pu lui être envoyé.", true); }
      const net = (v, n) => String(v == null ? "" : v).replace(/@/g, "＠").slice(0, n);
      const t = Math.floor(Date.parse(cv.dateHeure) / 1000);
      const embed = {
        title: "📣 Convocation",
        description: `Gendarme **${net(cv.cibleNom, 80)}**, tu es convoqué(e). Merci de te présenter à l'heure indiquée.`,
        color: 0x123a7a,
        fields: [
          { name: "📅 Quand", value: Number.isFinite(t) ? `<t:${t}:F>\n(<t:${t}:R>)` : net(cv.dateHeure, 100), inline: false },
          { name: "📍 Où", value: net(cv.lieu, 200) || "—", inline: true },
          { name: "👤 Par qui", value: net(`${cv.parGrade ? cv.parGrade + " " : ""}${cv.parNom || ""}`, 120) || "—", inline: true },
          { name: "📝 Pourquoi", value: net(cv.motif, 900) || "—", inline: false },
        ],
        footer: { text: "Gendarmerie de Saint-Tropez RP · en cas d'empêchement, préviens l'autorité qui te convoque" },
        timestamp: new Date().toISOString(),
      };
      const hb = { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" };
      let ok = false;
      try {
        const ch = await fetch("https://discord.com/api/v10/users/@me/channels", { method: "POST", headers: hb, body: JSON.stringify({ recipient_id: String(cible.discordId) }) });
        const cj = ch.ok ? await ch.json() : null;
        if (cj && cj.id) { const m = await fetch(`https://discord.com/api/v10/channels/${cj.id}/messages`, { method: "POST", headers: hb, body: JSON.stringify({ embeds: [embed] }) }); ok = m.ok; }
      } catch (e) { console.error(e); }
      await marquerCv(ok);
      return sortie(ok, ok ? "Convocation envoyée en message privé." : "Message privé refusé : le gendarme a peut-être bloqué les MP du serveur. La convocation est enregistrée.", !ok);
    }

    const s0 = await lireDoc(`sanctions/${encodeURIComponent(String(sanctionId || ""))}`);
    if (!s0) return reponse(false, "Sanction introuvable.", true);
    const s = { id: String(sanctionId), ...s0 };

    if (action === "ajouter") {
      if (!(moi.isAdmin === true || moi.gradeRank >= seuilHaut)) return res.status(403).json({ ok: false, message: "Non autorisé." });
      if (termine(s)) return reponse(false, "Cette sanction n'est plus active.");
      const roleId = rolesSanction[s.type];
      if (!roleId) return reponse(false, `Aucun rôle Discord n'est configuré pour « ${s.type} ».`);
      const cible = await personneDeSanction(s);
      if (!cible || !cible.discordId) { await marquer(s.id, "erreur"); return reponse(false, "Ce gendarme n'est pas relié à Discord : le rôle de sanction n'a pas été attribué.", true); }
      const r = await donnerRole(cible.discordId, roleId);
      if (!r.ok) {
        await marquer(s.id, "erreur");
        return reponse(false, r.status === 404 ? "Ce gendarme n'est plus sur le serveur Discord." : "Discord refuse d'ajouter le rôle : place le rôle du bot AU-DESSUS des rôles de sanction.", true);
      }
      await marquer(s.id, "actif");
      return reponse(true, "Rôle de sanction attribué.");
    }

    if (action === "retirer") {
      if (moi.isAdmin !== true) return res.status(403).json({ ok: false, message: "Non autorisé." });
      if (!termine(s)) return reponse(false, "Cette sanction est encore en cours.");
      const r = await retirerPourSanction(s);
      if (r === "attente") return reponse(false, "Discord refuse de retirer le rôle : place le rôle du bot AU-DESSUS des rôles de sanction.", true);
      return reponse(true, "Rôle de sanction retiré.");
    }

    return reponse(false, "Action inconnue.");
  } catch (e) {
    console.error(e);
    return reponse(false, "Erreur pendant la synchronisation Discord.", true);
  }
}
