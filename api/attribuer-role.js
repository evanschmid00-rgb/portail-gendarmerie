// Donne le rôle Discord « Militaire Engagé » à un candidat accepté (appelé par un recruteur ou un admin depuis le site).
// Variables Vercel utilisées (déjà présentes pour la connexion Discord) : DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, FIREBASE_SERVICE_ACCOUNT.
import crypto from "node:crypto";
import { discordFetch, pseudoNet } from "./_discordApi.js";

const b64url = (b) => Buffer.from(b).toString("base64url");
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function signJwt(payload, privateKey) {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64url(sig)}`;
}
async function googleToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, sa.private_key);
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("Jeton Google refusé");
  return j.access_token;
}

// Vérifie un jeton de connexion Firebase (signature, projet, expiration) et renvoie l'uid
async function verifierJeton(idToken, projectId) {
  const [h, p, s] = String(idToken || "").split(".");
  if (!h || !p || !s) throw new Error("jeton invalide");
  const head = JSON.parse(Buffer.from(h, "base64url").toString());
  const pay = JSON.parse(Buffer.from(p, "base64url").toString());
  const now = Math.floor(Date.now() / 1000);
  if (pay.aud !== projectId || pay.iss !== `https://securetoken.google.com/${projectId}` || !pay.sub || pay.exp < now) throw new Error("jeton refusé");
  const certs = await (await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com")).json();
  const cert = certs[head.kid];
  if (!cert) throw new Error("clé inconnue");
  const ok = crypto.createVerify("RSA-SHA256").update(`${h}.${p}`).verify(cert, Buffer.from(s, "base64url"));
  if (!ok) throw new Error("signature invalide");
  return pay.sub;
}

const fromFs = (f) => {
  if (!f) return null;
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("booleanValue" in f) return f.booleanValue;
  if ("arrayValue" in f) return (f.arrayValue.values || []).map(fromFs);
  if ("mapValue" in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, v]) => [k, fromFs(v)]));
  return null;
};
const lireDoc = async (base, gh, chemin) => {
  const r = await fetch(`${base}/${chemin}`, { headers: gh });
  if (!r.ok) return null;
  const d = await r.json();
  return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromFs(v)]));
};
const patcher = (base, gh, chemin, champs) => fetch(`${base}/${chemin}?${Object.keys(champs).map((k) => "updateMask.fieldPaths=" + k).join("&")}`, {
  method: "PATCH", headers: gh,
  body: JSON.stringify({ fields: Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, typeof v === "boolean" ? { booleanValue: v } : { stringValue: String(v) }])) }),
});

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const reponse = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return reponse(405, { ok: false, message: "Méthode non autorisée." });
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, FIREBASE_SERVICE_ACCOUNT, SITE_URL } = process.env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !FIREBASE_SERVICE_ACCOUNT) return reponse(500, { ok: false, message: "Discord n'est pas configuré sur le serveur." });
  try {
    const corps = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { idToken, candidatureId, identifiants } = corps;
    const action = ["roles", "titulariser", "synchroniser"].includes(corps.action) ? corps.action : "accepter";
    if (action === "accepter" && (!candidatureId || !/^[A-Za-z0-9]{10,40}$/.test(String(candidatureId)))) return reponse(400, { ok: false, message: "Candidature invalide." });
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    let uid;
    try { uid = await verifierJeton(idToken, sa.project_id); } catch (e) { return reponse(401, { ok: false, message: "Connexion invalide, reconnecte-toi." }); }

    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const gh = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };

    // Réservé aux admins et aux recruteurs
    const moi = await lireDoc(base, gh, `personnel/${encodeURIComponent(uid)}`);
    if (!moi || !(moi.isAdmin === true || (Array.isArray(moi.qualifications) && moi.qualifications.includes("Recruteur")))) return reponse(403, { ok: false, message: "Réservé au recrutement." });

    const bot0 = { Authorization: `Bot ${DISCORD_BOT_TOKEN}` };
    const idRole = (x) => /^\d{5,25}$/.test(String(x));
    const reglages = (await lireDoc(base, gh, "settings/general")) || {};
    const rr0 = reglages.rolesRecrutement && typeof reglages.rolesRecrutement === "object" ? reglages.rolesRecrutement : {};
    const liste = (k) => (Array.isArray(rr0[k]) ? rr0[k] : []).map(String).filter(idRole);
    const urlRole = (membre, role) => `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${membre}/roles/${role}`;
    const donner = async (membre, ids, raison) => { let echecs = 0; for (const r of ids) { const x = await discordFetch(urlRole(membre, r), { method: "PUT", headers: { ...bot0, "X-Audit-Log-Reason": encodeURIComponent(raison) } }); if (!x.ok) echecs++; } return echecs; };
    const retirer = async (membre, ids, raison) => { for (const r of ids) { try { await discordFetch(urlRole(membre, r), { method: "DELETE", headers: { ...bot0, "X-Audit-Log-Reason": encodeURIComponent(raison) } }); } catch (e) { /* tant pis */ } } };
    const texteEchecs = (n) => (n ? ` ⚠️ ${n} rôle(s) refusé(s) par Discord : place le rôle du bot AU-DESSUS de ces rôles dans Paramètres du serveur → Rôles.` : "");

    // Liste des rôles du serveur (pour choisir les rôles automatiques sur le site) : admins uniquement
    if (action === "roles") {
      if (moi.isAdmin !== true) return reponse(403, { ok: false, message: "Réservé aux administrateurs." });
      const r = await discordFetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/roles`, { headers: bot0 });
      const tous = r.ok ? await r.json() : null;
      if (!Array.isArray(tous)) return reponse(200, { ok: false, message: `Impossible de lire les rôles du serveur (erreur ${r.status}).` });
      return reponse(200, { ok: true, roles: tous.filter((x) => x.name !== "@everyone" && !x.managed).sort((a, b) => b.position - a.position).map((x) => ({ id: x.id, name: x.name, color: x.color })) });
    }
    // Retrouve le membre Discord d'un agent : identifiant relié, sinon recherche par pseudo
    const membreDe = async (p) => {
      if (p.discordId && /^\d{5,25}$/.test(String(p.discordId))) return String(p.discordId);
      const pseudo = String(p.pseudoDiscord || "").trim().replace(/^@/, "").split("#")[0].trim();
      if (!pseudo) return null;
      const sr = await discordFetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/search?query=${encodeURIComponent(pseudo)}&limit=25`, { headers: bot0 });
      const ms = sr.ok ? await sr.json() : [];
      const m = (Array.isArray(ms) ? ms : []).find((x) => x.user && [x.user.username, x.user.global_name, x.nick].some((n) => n && pseudoNet(n) === pseudoNet(pseudo)));
      return m ? m.user.id : null;
    };
    // Titularisation : rôles « titulaire » donnés, rôles « en période d'essai » retirés
    if (action === "titulariser") {
      const cibleUid = String(corps.uid || "");
      if (!/^[A-Za-z0-9]{10,40}$/.test(cibleUid)) return reponse(400, { ok: false, message: "Agent invalide." });
      const p = await lireDoc(base, gh, `personnel/${encodeURIComponent(cibleUid)}`);
      if (!p) return reponse(404, { ok: false, message: "Agent introuvable." });
      if (!liste("titulaire").length && !liste("essai").length) return reponse(200, { ok: true, message: "Aucun rôle Discord de titularisation n'est configuré." });
      const membre = await membreDe(p);
      if (!membre) return reponse(200, { ok: false, message: `${p.prenom || ""} ${p.nom || ""} n'est pas relié à Discord : les rôles de titularisation n'ont pas été modifiés.`.trim() });
      const echecs = await donner(membre, liste("titulaire"), "Titularisation (portail)");
      await retirer(membre, liste("essai").filter((r) => !liste("titulaire").includes(r)), "Fin de période d'essai (portail)");
      return reponse(200, { ok: !echecs, message: `Rôles Discord de titularisation appliqués.${texteEchecs(echecs)}` });
    }
    // Rôles « période d'essai » pour les recrues déjà en essai (utile juste après avoir configuré les rôles)
    if (action === "synchroniser") {
      if (!liste("essai").length) return reponse(200, { ok: false, message: "Choisis d'abord les rôles de la période d'essai." });
      const rq = await fetch(`${base}:runQuery`, { method: "POST", headers: gh, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "personnel" }], where: { fieldFilter: { field: { fieldPath: "essaiStatut" }, op: "EQUAL", value: { stringValue: "En cours" } } }, limit: 80 } }) });
      const lignes = rq.ok ? await rq.json() : [];
      let ok = 0, sans = 0, echecs = 0;
      for (const l of lignes.filter((x) => x.document)) {
        const f = Object.fromEntries(Object.entries(l.document.fields || {}).map(([k, v]) => [k, fromFs(v)]));
        const membre = await membreDe(f);
        if (!membre) { sans++; continue; }
        echecs += await donner(membre, liste("essai"), "Période d'essai (portail)");
        ok++;
      }
      return reponse(200, { ok: !echecs, message: `${ok} recrue(s) mise(s) à jour${sans ? `, ${sans} sans compte Discord relié` : ""}.${texteEchecs(echecs)}` });
    }

    const cand = await lireDoc(base, gh, `candidatures/${candidatureId}`);
    if (!cand) return reponse(404, { ok: false, message: "Candidature introuvable." });
    if (cand.statut !== "Acceptée") return reponse(400, { ok: false, message: "La candidature n'est pas acceptée." });

    const bot = { Authorization: `Bot ${DISCORD_BOT_TOKEN}` };
    const nonRejoint = (nom) => `${nom} n'a pas encore rejoint le serveur Discord. Le rôle lui sera donné automatiquement dès sa première connexion au site avec Discord.`;
    let cible = null;
    if (cand.discordId && /^\d{5,25}$/.test(String(cand.discordId))) {
      // Compte Discord lié et vérifié lors de la candidature : on retrouve le membre par son identifiant
      const mr = await discordFetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${cand.discordId}`, { headers: bot });
      if (mr.status === 404) return reponse(200, { ok: false, message: nonRejoint(cand.discordPseudo || "Le candidat") });
      if (!mr.ok) return reponse(200, { ok: false, message: mr.status === 429 ? "Discord est surchargé, réessaie dans une minute." : `Discord a refusé la recherche du membre (erreur ${mr.status}). Vérifie les droits du bot.` });
      cible = await mr.json();
    } else {
      // Ancienne candidature : pseudo Discord donné dans le formulaire
      const ligne = (cand.answers || []).find((a) => a && /discord/i.test(String(a.label || "")) && String(a.value || "").trim());
      const pseudo = ligne ? String(ligne.value).trim().replace(/^@/, "").split("#")[0].trim() : "";
      if (!pseudo) return reponse(200, { ok: false, message: "Aucun pseudo Discord dans la candidature : donne le rôle à la main." });
      const sr = await discordFetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/search?query=${encodeURIComponent(pseudo)}&limit=25`, { headers: bot });
      if (!sr.ok) return reponse(200, { ok: false, message: sr.status === 429 ? "Discord est surchargé, réessaie dans une minute." : `Discord a refusé la recherche du membre (erreur ${sr.status}). Vérifie les droits du bot.` });
      const membres = await sr.json();
      cible = (Array.isArray(membres) ? membres : []).find((m) => m.user && [m.user.username, m.user.global_name, m.nick].some((x) => x && pseudoNet(x) === pseudoNet(pseudo)));
      if (!cible) return reponse(200, { ok: false, message: `« ${pseudo} » est introuvable sur le serveur Discord. S'il l'a rejoint depuis, vérifie l'orthographe exacte du pseudo ; sinon, le rôle lui sera donné dès sa connexion au site avec Discord (si sa candidature a été envoyée avec ce compte).` });
    }

    const rr = await discordFetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/roles`, { headers: bot });
    const roles = rr.ok ? await rr.json() : null;
    if (!Array.isArray(roles)) return reponse(200, { ok: false, message: `Impossible de lire les rôles du serveur (erreur ${rr.status}). Réessaie dans un instant.` });
    const role = roles.find((r) => norm(r.name).includes("militaire engage"));
    if (!role) return reponse(200, { ok: false, message: "Le rôle « Militaire Engagé » n'existe pas sur le serveur." });

    if (!(cible.roles || []).includes(role.id)) {
      const pr = await discordFetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${cible.user.id}/roles/${role.id}`, { method: "PUT", headers: { ...bot, "X-Audit-Log-Reason": encodeURIComponent("Candidature acceptée (site)") } });
      if (!pr.ok) return reponse(200, { ok: false, message: pr.status === 403 ? "Discord a refusé d'attribuer le rôle : le rôle du bot doit être placé AU-DESSUS de « Militaire Engagé » dans Paramètres du serveur → Rôles." : `Discord a refusé d'attribuer le rôle (erreur ${pr.status}).` });
    }

    // Rôles supplémentaires de l'arrivée + rôles de la période d'essai (la recrue entre en essai à l'acceptation)
    const extras = Array.from(new Set([...liste("arrivee"), ...liste("essai")])).filter((r) => r !== role.id);
    const echecsExtras = extras.length ? await donner(cible.user.id, extras, "Candidature acceptée (portail)") : 0;
    const extrasTxt = extras.length ? ` ${extras.length - echecsExtras} autre(s) rôle(s) attribué(s).${texteEchecs(echecsExtras)}` : "";

    const maintenant = new Date().toISOString();
    await patcher(base, gh, `candidatures/${candidatureId}`, { roleDiscordLe: maintenant, roleDiscordPar: `${moi.prenom || ""} ${moi.nom || ""}`.trim() }).catch(() => {});
    if (cand.ref) await patcher(base, gh, `suivi_candidatures/${encodeURIComponent(cand.ref)}`, { roleDiscord: true }).catch(() => {});
    // Compte créé automatiquement : on envoie les identifiants au candidat en message privé (sans jamais les enregistrer)
    let dm = false;
    if (identifiants && typeof identifiants.username === "string" && typeof identifiants.password === "string" && identifiants.username.length <= 60 && identifiants.password.length <= 60) {
      try {
        const ch = await discordFetch("https://discord.com/api/users/@me/channels", { method: "POST", headers: { ...bot, "Content-Type": "application/json" }, body: JSON.stringify({ recipient_id: cible.user.id }) });
        if (ch.ok) {
          const canal = await ch.json();
          const prenom = String((cand && (cand.displayName || "")) || "").trim().split(/\s+/)[0] || cible.user.global_name || cible.user.username;
          let lienSite = "";
          try { if (SITE_URL) lienSite = new URL(SITE_URL).origin; } catch (e) { lienSite = ""; }
          const embed = {
            author: { name: "GENDARMERIE NATIONALE · NÎMES RP" },
            title: "🎖️ Candidature acceptée — bienvenue !",
            description: `Félicitations **${prenom}**, ta candidature est **acceptée** et ton compte est prêt.\nVoici tout ce qu'il te faut pour commencer ton aventure dans la gendarmerie de Nîmes RP.`,
            color: 0x2E7D4F,
            fields: [
              { name: "🔐 Tes identifiants", value: `Identifiant : \`${identifiants.username}\`\nMot de passe : ||${identifiants.password}||\n*(clique sur le mot de passe pour l'afficher)*` },
              { name: "🚀 Pour commencer", value: `1️⃣ Connecte-toi${lienSite ? ` sur [le site de la gendarmerie](${lienSite})` : " sur le site de la gendarmerie"} avec ces identifiants (ou avec Discord).\n2️⃣ Change ton mot de passe dans **Mon compte**.\n3️⃣ Lis les fiches de **Formation** : tu as **5 jours** de période d'essai, avec un parrain pour t'accompagner.` },
              { name: "🛡️ Ton rôle", value: "Le rôle **Militaire Engagé** t'a été attribué sur le serveur Discord.", inline: true },
              { name: "⚠️ Sécurité", value: "Ne partage jamais ton mot de passe, même avec un membre du personnel.", inline: true },
            ],
            footer: { text: "Message automatique — pour toute question, contacte le recrutement sur le serveur" },
            timestamp: new Date().toISOString(),
          };
          if (lienSite) embed.thumbnail = { url: lienSite + "/ecusson-gn.png" };
          const mr = await discordFetch(`https://discord.com/api/channels/${canal.id}/messages`, { method: "POST", headers: { ...bot, "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [embed] }) });
          dm = mr.ok;
        }
      } catch (e) { dm = false; }
    }
    return reponse(200, { ok: true, dm, message: `Rôle « Militaire Engagé » attribué à ${cible.user.username}.${extrasTxt}${identifiants ? (dm ? " Identifiants envoyés en message privé." : " ⚠️ Message privé impossible : transmets les identifiants à la main.") : ""}`, roleDiscordLe: maintenant });
  } catch (e) {
    console.error(e);
    return reponse(500, { ok: false, message: "Erreur pendant l'attribution du rôle." });
  }
}
