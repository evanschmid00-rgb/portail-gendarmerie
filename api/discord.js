// Connexion avec Discord + création automatique du compte.
// Aucune dépendance : tout passe par les API de Discord et de Google.
// Les clés sont dans les variables d'environnement Vercel (jamais dans le code).

import crypto from "node:crypto";

const GRADES = [
  "Gendarme Adjoint Volontaire 2ème Classe", "Gendarme Adjoint Volontaire 1ère Classe", "Brigadier", "Brigadier-chef",
  "Maréchal des Logis", "Gendarme Sous Contrat", "Gendarme de Carrière", "Maréchal des Logis-Chef", "Adjudant",
  "Adjudant-Chef", "Major", "Sous-Lieutenant", "Lieutenant", "Capitaine", "Commandant", "Lieutenant-Colonel", "Colonel",
  "Général de Brigade", "Général de Division", "Général de Corps d'Armée", "Général d'Armée",
];

// Le tag entre crochets dans le nom du rôle Discord, ex. "[GA2] - Gendarme Adjoint 2e Classe"
const TAGS = {
  GA2: "Gendarme Adjoint Volontaire 2ème Classe", GA1: "Gendarme Adjoint Volontaire 1ère Classe",
  BRI: "Brigadier", BRC: "Brigadier-chef", MDL: "Maréchal des Logis", GSC: "Gendarme Sous Contrat",
  GNC: "Gendarme de Carrière", MDC: "Maréchal des Logis-Chef", ADJ: "Adjudant", ADC: "Adjudant-Chef", MAJ: "Major",
  SLT: "Sous-Lieutenant", LTN: "Lieutenant", CNE: "Capitaine", CDT: "Commandant", LCL: "Lieutenant-Colonel", COL: "Colonel",
};

const b64url = (b) => Buffer.from(b).toString("base64url");
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

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

function firebaseCustomToken(sa, uid) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    iss: sa.client_email, sub: sa.client_email,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now, exp: now + 3600, uid,
  }, sa.private_key);
}

const toFs = (v) => {
  if (v === null) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { integerValue: String(v) };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  return { nullValue: null };
};
const fromFs = (f) => {
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("booleanValue" in f) return f.booleanValue;
  if ("arrayValue" in f) return (f.arrayValue.values || []).map(fromFs);
  return null;
};
const toFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toFs(v)]));

export default async function handler(req, res) {
  const site = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, "");
  const redirect = (url) => { res.statusCode = 302; res.setHeader("Location", url); res.end(); };
  const fail = (msg) => redirect(`${site}/?discord_error=${encodeURIComponent(msg)}`);

  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !FIREBASE_SERVICE_ACCOUNT) {
    return fail("Connexion Discord pas encore configurée.");
  }
  const redirectUri = `${site}/api/discord`;

  // 1) Départ : on envoie la personne vers Discord
  if (!req.query.code && !req.query.error) {
    const state = crypto.randomBytes(16).toString("hex");
    res.setHeader("Set-Cookie", `ds=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=600`);
    const p = new URLSearchParams({ client_id: DISCORD_CLIENT_ID, response_type: "code", redirect_uri: redirectUri, scope: "identify guilds.members.read", state });
    return redirect(`https://discord.com/oauth2/authorize?${p}`);
  }

  // 2) Retour de Discord
  try {
    if (req.query.error) return fail("Connexion Discord annulée.");
    const cookie = (req.headers.cookie || "").split(";").map((s) => s.trim()).find((s) => s.startsWith("ds="));
    if (!cookie || cookie.slice(3) !== req.query.state) return fail("Session expirée, réessaie.");

    const tok = await (await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code: req.query.code, redirect_uri: redirectUri }),
    })).json();
    if (!tok.access_token) return fail("Connexion Discord refusée.");
    const auth = { Authorization: `Bearer ${tok.access_token}` };

    const user = await (await fetch("https://discord.com/api/users/@me", { headers: auth })).json();
    const mres = await fetch(`https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`, { headers: auth });
    if (!mres.ok) return fail("Tu n'es pas membre du serveur Discord de la Gendarmerie.");
    const member = await mres.json();

    const roles = await (await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/roles`, { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } })).json();
    if (!Array.isArray(roles)) return fail("Impossible de lire les rôles du serveur.");
    const mine = roles.filter((r) => (member.roles || []).includes(r.id));
    if (!mine.some((r) => norm(r.name).includes("militaire engage"))) return fail("Il te faut le rôle « Militaire Engagé » sur Discord pour créer ou utiliser un compte.");

    // Grade = le plus haut grade Discord de la personne (GA2 par défaut)
    let gradeRank = 0;
    mine.forEach((r) => {
      const m = /^\s*\[([A-Z0-9]{3})\]/.exec(r.name);
      if (m && TAGS[m[1]]) gradeRank = Math.max(gradeRank, GRADES.indexOf(TAGS[m[1]]));
    });

    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const gh = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };

    // Liste du personnel (petite collection)
    const personnel = [];
    let pageToken = "";
    do {
      const j = await (await fetch(`${base}/personnel?pageSize=300${pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""}`, { headers: gh })).json();
      (j.documents || []).forEach((d) => {
        const o = { id: d.name.split("/").pop() };
        Object.entries(d.fields || {}).forEach(([k, v]) => { o[k] = fromFs(v); });
        personnel.push(o);
      });
      pageToken = j.nextPageToken || "";
    } while (pageToken);

    const pseudo = user.username || "";
    let existing = personnel.find((p) => p.discordId === user.id);
    if (!existing) {
      // Compte déjà créé par l'admin : on le relie via le pseudo Discord renseigné
      existing = personnel.find((p) => !p.discordId && p.pseudoDiscord && norm(p.pseudoDiscord) === norm(pseudo));
      if (existing) {
        await fetch(`${base}/personnel/${existing.id}?updateMask.fieldPaths=discordId`, { method: "PATCH", headers: gh, body: JSON.stringify({ fields: toFields({ discordId: user.id }) }) });
      }
    }

    let uid;
    if (existing) {
      uid = existing.id;
    } else {
      uid = `discord-${user.id}`;
      const affiche = String(member.nick || user.global_name || pseudo).replace(/^\s*\[[^\]]*\]\s*[-–]?\s*/, "").trim() || pseudo;
      const [prenom, ...reste] = affiche.split(/\s+/);
      const year = new Date().getFullYear();
      let n = personnel.length + 1;
      let matricule;
      do { matricule = `GH-${year}-${String(n++).padStart(4, "0")}`; } while (personnel.some((p) => p.matricule === matricule));

      const fiche = {
        matricule, nom: reste.join(" "), prenom, pseudoRoblox: "", pseudoDiscord: pseudo, username: pseudo,
        grade: GRADES[gradeRank], gradeRank, unite: "Brigade territoriale", fonction: "", qualifications: [], isAdmin: false, discordId: user.id,
      };
      const c1 = await fetch(`${base}/personnel?documentId=${uid}`, { method: "POST", headers: gh, body: JSON.stringify({ fields: toFields(fiche) }) });
      if (!c1.ok) return fail("Création du compte impossible, préviens un administrateur.");
      await fetch(`${base}/annuaire_public?documentId=${uid}`, {
        method: "POST", headers: gh,
        body: JSON.stringify({ fields: toFields({ prenom, nom: fiche.nom, pseudoRoblox: "", pseudoDiscord: pseudo }) }),
      });
    }

    return redirect(`${site}/#dt=${firebaseCustomToken(sa, uid)}`);
  } catch (e) {
    console.error(e);
    return fail("Erreur pendant la connexion Discord, réessaie.");
  }
}
