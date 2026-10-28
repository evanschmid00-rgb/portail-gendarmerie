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
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !FIREBASE_SERVICE_ACCOUNT) return reponse(500, { ok: false, message: "Discord n'est pas configuré sur le serveur." });
  try {
    const { idToken, candidatureId, identifiants } = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    if (!candidatureId || !/^[A-Za-z0-9]{10,40}$/.test(String(candidatureId))) return reponse(400, { ok: false, message: "Candidature invalide." });
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    let uid;
    try { uid = await verifierJeton(idToken, sa.project_id); } catch (e) { return reponse(401, { ok: false, message: "Connexion invalide, reconnecte-toi." }); }

    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const gh = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };

    // Réservé aux admins et aux recruteurs
    const moi = await lireDoc(base, gh, `personnel/${encodeURIComponent(uid)}`);
    if (!moi || !(moi.isAdmin === true || (Array.isArray(moi.qualifications) && moi.qualifications.includes("Recruteur")))) return reponse(403, { ok: false, message: "Réservé au recrutement." });

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
          const embed = {
            title: "🎖️ Bienvenue dans la Gendarmerie de Nîmes RP !",
            description: "Félicitations, **ta candidature est acceptée** et ton compte est prêt. Voici tout ce qu'il te faut pour commencer.",
            color: 0x123A7A,
            fields: [
              { name: "🔐 Tes identifiants", value: `Identifiant : \`${identifiants.username}\`\nMot de passe : ||${identifiants.password}||\n*(clique sur le mot de passe pour l'afficher)*` },
              { name: "🚀 Pour commencer", value: "1️⃣ Connecte-toi sur le site avec ces identifiants (ou avec Discord).\n2️⃣ Change ton mot de passe dans **Mon compte**.\n3️⃣ Suis ta formation : tu as **5 jours** de période d'essai, avec un parrain pour t'accompagner." },
              { name: "🛡️ À savoir", value: "Ton rôle **Militaire Engagé** t'a été attribué sur le serveur. Garde ce message pour toi et ne partage jamais ton mot de passe." },
            ],
            footer: { text: "Gendarmerie Nationale · Nîmes RP — jeu de rôle Roblox" },
            timestamp: new Date().toISOString(),
          };
          const mr = await discordFetch(`https://discord.com/api/channels/${canal.id}/messages`, { method: "POST", headers: { ...bot, "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [embed] }) });
          dm = mr.ok;
        }
      } catch (e) { dm = false; }
    }
    return reponse(200, { ok: true, dm, message: `Rôle « Militaire Engagé » attribué à ${cible.user.username}.${identifiants ? (dm ? " Identifiants envoyés en message privé." : " ⚠️ Message privé impossible : transmets les identifiants à la main.") : ""}`, roleDiscordLe: maintenant });
  } catch (e) {
    console.error(e);
    return reponse(500, { ok: false, message: "Erreur pendant l'attribution du rôle." });
  }
}
