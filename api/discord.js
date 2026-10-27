// Connexion avec Discord + création automatique du compte.
// Aucune dépendance : tout passe par les API de Discord et de Google.
// Les clés sont dans les variables d'environnement Vercel (jamais dans le code).

import crypto from "node:crypto";
import { signer, lire as lireJeton } from "./_liaison.js";
import { discordFetch, pseudoNet } from "./_discordApi.js";

// Valeurs par défaut, remplacées par les réglages faits dans « Grades & unités » sur le site
const GRADES_DEFAUT = [
  "Gendarme Adjoint Volontaire 2ème Classe", "Gendarme Adjoint Volontaire 1ère Classe", "Brigadier", "Brigadier-chef",
  "Maréchal des Logis", "Gendarme Sous Contrat", "Gendarme de Carrière", "Maréchal des Logis-Chef", "Adjudant",
  "Adjudant-Chef", "Major", "Sous-Lieutenant", "Lieutenant", "Capitaine", "Commandant", "Lieutenant-Colonel", "Colonel",
  "Général de Brigade", "Général de Division", "Général de Corps d'Armée", "Général d'Armée",
];
const TAGS_DEFAUT = ["GA2", "GA1", "BRI", "BRC", "MDL", "GSC", "GNC", "MDC", "ADJ", "ADC", "MAJ", "SLT", "LTN", "CNE", "CDT", "LCL", "COL", "", "", "", ""];

const b64url = (b) => Buffer.from(b).toString("base64url");
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Prénom RP et NOM RP choisis par le gendarme à la création du compte : lettres, espaces, tirets et apostrophes seulement
const MOTIF_IDENTITE = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
function nettoyerIdentite(prenom, nom) {
  const p = String(prenom || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr-FR").replace(/(^|[ '’-])([a-zà-öø-ÿ])/g, (m, sep, l) => sep + l.toLocaleUpperCase("fr-FR"));
  const n = String(nom || "").replace(/\s+/g, " ").trim().toLocaleUpperCase("fr-FR");
  if (p.length < 2 || p.length > 40 || !MOTIF_IDENTITE.test(p)) return null;
  if (n.length < 2 || n.length > 40 || !MOTIF_IDENTITE.test(n)) return null;
  return { prenom: p, nom: n };
}

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
  if ("mapValue" in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, v]) => [k, fromFs(v)]));
  return null;
};
const toFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toFs(v)]));

// 7 chiffres : 5 au hasard + 2 derniers chiffres uniques à chaque gendarme
function numeroCipc(personnel, selfId) {
  const pris = new Set(personnel.filter((p) => p.id !== selfId && p.cipcNumero).map((p) => String(p.cipcNumero).slice(-2)));
  const libres = [];
  for (let i = 0; i < 100; i++) { const s = String(i).padStart(2, "0"); if (!pris.has(s)) libres.push(s); }
  if (!libres.length) return null;
  return String(crypto.randomInt(0, 100000)).padStart(5, "0") + libres[crypto.randomInt(0, libres.length)];
}

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
    const mode = req.query.mode === "creation" ? "creation" : "connexion";
    let identite = null;
    if (mode === "creation") {
      identite = nettoyerIdentite(req.query.prenom, req.query.nom);
      if (!identite) return fail("Indique ton Prénom RP et ton NOM RP (lettres uniquement) pour créer ton compte.");
    }
    // L'état est signé et voyage avec la demande : plus besoin de cookie (qui se perdait dans le navigateur intégré de Discord et sur mobile)
    const state = signer({ t: "etat", mode, ...(identite || {}), n: crypto.randomBytes(8).toString("hex"), exp: Date.now() + 20 * 60000 });
    const p = new URLSearchParams({ client_id: DISCORD_CLIENT_ID, response_type: "code", redirect_uri: redirectUri, scope: "identify guilds.members.read", state });
    return redirect(`https://discord.com/oauth2/authorize?${p}`);
  }

  // 2) Retour de Discord
  try {
    if (req.query.error) return fail("Connexion Discord annulée.");
    const etat = lireJeton(req.query.state);
    if (!etat || etat.t !== "etat") return fail("La demande de connexion a expiré (plus de 20 minutes) : reviens sur le site et recommence.");

    // Mode choisi sur le site : « connexion » (compte existant) ou « creation » (avec Prénom RP et NOM RP)
    let demande = { mode: "connexion" };
    if (etat.mode === "creation") {
      const identite = nettoyerIdentite(etat.prenom, etat.nom);
      if (identite) demande = { mode: "creation", ...identite };
    }

    const tok = await (await discordFetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code: req.query.code, redirect_uri: redirectUri }),
    })).json();
    if (!tok.access_token) return fail("Connexion Discord refusée.");
    const auth = { Authorization: `Bearer ${tok.access_token}` };

    const user = await (await discordFetch("https://discord.com/api/users/@me", { headers: auth })).json();
    if (!user || !user.id) return fail("Discord n'a pas répondu correctement, réessaie dans un instant.");
    const mres = await discordFetch(`https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`, { headers: auth });
    if (!mres.ok) {
      let code = 0;
      try { code = (await mres.json()).code || 0; } catch (e) { /* réponse vide */ }
      if (code === 40002) return fail("Ton compte Discord n'est pas vérifié : confirme ton adresse e-mail (et ton numéro de téléphone si Discord le demande) dans Paramètres → Mon compte, puis réessaie.");
      if (mres.status === 404 || code === 10007 || code === 10004) return fail("Tu n'es pas membre du serveur Discord de la Gendarmerie.");
      console.error("Lecture du profil serveur refusée", mres.status, code);
      return fail(`Discord a refusé la lecture de ton profil sur le serveur (erreur ${code || mres.status}).`);
    }
    const member = await mres.json();

    const bot = { Authorization: `Bot ${DISCORD_BOT_TOKEN}` };
    const rres = await discordFetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/roles`, { headers: bot });
    const roles = rres.ok ? await rres.json() : null;
    if (!Array.isArray(roles)) { console.error("Lecture des rôles refusée", rres.status); return fail(rres.status === 401 || rres.status === 403 ? "Le bot Discord n'a pas accès au serveur : préviens un administrateur." : "Impossible de lire les rôles du serveur pour le moment, réessaie dans un instant."); }
    const mine = roles.filter((r) => (member.roles || []).includes(r.id));

    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const gh = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };
    const majDoc = (chemin, champs) => fetch(`${base}/${chemin}?${Object.keys(champs).map((k) => "updateMask.fieldPaths=" + k).join("&")}`, { method: "PATCH", headers: gh, body: JSON.stringify({ fields: toFields(champs) }) });

    // Candidature de cette personne (retrouvée grâce au compte Discord vérifié lors de la candidature)
    let candidature; // undefined = pas encore cherchée
    const chercherCandidature = async () => {
      if (candidature !== undefined) return candidature;
      candidature = null;
      try {
        const q = await fetch(`${base}:runQuery`, { method: "POST", headers: gh, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "candidatures" }], where: { fieldFilter: { field: { fieldPath: "discordId" }, op: "EQUAL", value: { stringValue: String(user.id) } } }, limit: 20 } }) });
        const lignes = q.ok ? await q.json() : [];
        const toutes = lignes.filter((l) => l.document).map((l) => {
          const o = { id: l.document.name.split("/").pop() };
          Object.entries(l.document.fields || {}).forEach(([k, v]) => { try { o[k] = fromFs(v); } catch (e) { /* champ complexe ignoré */ } });
          return o;
        });
        // « Acceptée » ET publiée au candidat (ou ancienne candidature sans publication)
        const acceptees = toutes.filter((c) => c.statut === "Acceptée" && (c.statutPublie === undefined || c.statutPublie === "Acceptée"));
        acceptees.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        candidature = { acceptee: acceptees[0] || null, enCours: toutes.find((c) => c.statut === "En attente") || toutes[0] || null };
      } catch (e) { console.error("Recherche de candidature impossible", e); }
      return candidature;
    };

    // Rôle « Militaire Engagé » : s'il manque mais que la candidature est acceptée, le bot le donne tout de suite
    if (!mine.some((r) => norm(r.name).includes("militaire engage"))) {
      const cand = await chercherCandidature();
      if (cand && cand.acceptee) {
        const role = roles.find((r) => norm(r.name).includes("militaire engage"));
        if (!role) return fail("Le rôle « Militaire Engagé » n'existe pas sur le serveur Discord : préviens un administrateur.");
        const pr = await discordFetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${user.id}/roles/${role.id}`, { method: "PUT", headers: { ...bot, "X-Audit-Log-Reason": encodeURIComponent("Candidature acceptée (connexion au site)") } });
        if (!pr.ok) { console.error("Attribution du rôle refusée", pr.status); return fail(`Ta candidature est acceptée, mais le rôle Discord n'a pas pu t'être donné automatiquement (erreur ${pr.status}). Préviens le recrutement.`); }
        mine.push(role);
        const maintenant = new Date().toISOString();
        await majDoc(`candidatures/${cand.acceptee.id}`, { roleDiscordLe: maintenant, roleDiscordPar: "Automatique (connexion)" }).catch(() => {});
        if (cand.acceptee.ref) await majDoc(`suivi_candidatures/${encodeURIComponent(cand.acceptee.ref)}`, { roleDiscord: true }).catch(() => {});
      } else if (cand && cand.enCours) {
        return fail(`Ta candidature (dossier ${cand.enCours.ref || "—"}) n'a pas encore été acceptée : tu pourras créer ton compte dès que la réponse sera publiée.`);
      } else {
        return fail("Il te faut le rôle « Militaire Engagé » sur Discord pour créer ou utiliser un compte. Si ta candidature a été acceptée, vérifie que tu l'as bien envoyée avec ce compte Discord.");
      }
    }

    // Réglages (grades, tags Discord) faits depuis le site
    let GRADES = GRADES_DEFAUT, TAGS = TAGS_DEFAUT;
    const sres = await fetch(`${base}/settings/general`, { headers: gh });
    if (sres.ok) {
      const f = (await sres.json()).fields || {};
      if (f.grades && f.gradesTags) {
        const g = fromFs(f.grades), t = fromFs(f.gradesTags);
        if (Array.isArray(g) && g.length) { GRADES = g; TAGS = g.map((_, i) => (t && t[i]) || ""); }
      }
    }

    // Grade = le plus haut grade Discord de la personne (le plus bas par défaut)
    let gradeRank = 0;
    mine.forEach((r) => {
      const m = /^\s*\[([A-Z0-9]{3})\]/.exec(r.name);
      const i = m ? TAGS.indexOf(m[1]) : -1;
      if (i > gradeRank) gradeRank = i;
    });

    // Qualité judiciaire de départ (carte CIPC) d'après les rôles [OPJ] / [APJ] / [APJA]
    const quals = mine.map((r) => (/^\s*\[(OPJ|APJA|APJ)\]/.exec(r.name) || [])[1]).filter(Boolean);
    const qualiteGrade = (grade) => { const g = String(grade || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); return /adjoint volontaire|^brigadier|^marechal des logis$/.test(g) ? "APJA" : /lieutenant|capitaine|commandant|colonel|general/.test(g) ? "OPJ" : "APJ"; };
    const qualite = qualiteGrade(GRADES[gradeRank]); // la qualité judiciaire suit le grade

    const patch = (id, champs) => fetch(`${base}/personnel/${encodeURIComponent(id)}?${Object.keys(champs).map((k) => "updateMask.fieldPaths=" + k).join("&")}`, { method: "PATCH", headers: gh, body: JSON.stringify({ fields: toFields(champs) }) });

    // Lecture directe d'une fiche par son identifiant (fiable, ne dépend d'aucune liste)
    let quotaFs = false; // la base répond « quota atteint » (429)
    const lire = async (id) => {
      const r = await fetch(`${base}/personnel/${encodeURIComponent(id)}`, { headers: gh });
      if (r.status === 429) quotaFs = true;
      if (!r.ok) return null;
      const d = await r.json();
      const o = { id };
      Object.entries(d.fields || {}).forEach(([k, v]) => { o[k] = fromFs(v); });
      return o;
    };

    // Liste du personnel (petite collection), lue seulement quand c'est nécessaire
    let cache = null;
    const liste = async () => {
      if (cache) return cache;
      const out = [];
      let ok = true;
      let pageToken = "";
      do {
        const r = await fetch(`${base}/personnel?pageSize=100${pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""}`, { headers: gh });
        if (!r.ok) { ok = false; console.error("Lecture du personnel refusée", r.status, (await r.text()).slice(0, 300)); break; }
        const j = await r.json();
        (j.documents || []).forEach((d) => {
          const o = { id: d.name.split("/").pop() };
          Object.entries(d.fields || {}).forEach(([k, v]) => { o[k] = fromFs(v); });
          out.push(o);
        });
        pageToken = j.nextPageToken || "";
      } while (pageToken);
      cache = { personnel: out, ok };
      return cache;
    };

    const pseudo = user.username || "";
    const uidDiscord = `discord-${user.id}`;

    // 1) Compte déjà créé par une connexion Discord précédente
    let existing = await lire(uidDiscord);
    // Base saturée : on ne peut rien lire. Une connexion (pas une création) vers le compte Discord habituel reste possible :
    // les droits réels sont contrôlés par la base, et le site garde la copie de la fiche sur l'appareil.
    if (!existing && quotaFs && demande.mode !== "creation") return redirect(`${site}/#dt=${firebaseCustomToken(sa, uidDiscord)}`);
    let lien = false;
    if (!existing) {
      // 2) Compte ancien relié par discordId, ou créé par l'admin avec le même pseudo Discord
      const { personnel, ok } = await liste();
      existing = personnel.find((p) => p.discordId === user.id);
      if (!existing) {
        existing = personnel.find((p) => !p.discordId && p.pseudoDiscord && pseudoNet(p.pseudoDiscord) === pseudoNet(pseudo));
        lien = !!existing;
      }
      if (!existing && !ok) return fail("Lecture de la base impossible, réessaie dans un instant.");
    }

    let uid;
    if (existing) {
      uid = existing.id;
      const champs = {};
      if (!existing.qualiteJudiciaire) champs.qualiteJudiciaire = qualite; // valeur de départ seulement : ensuite elle se modifie à la main sur le site
      if (lien) champs.discordId = user.id;
      if (!existing.cipcNumero) {
        const { personnel } = await liste();
        const n = numeroCipc(personnel, existing.id);
        if (n) champs.cipcNumero = n;
      }
      const pr = Object.keys(champs).length ? await patch(uid, champs) : { ok: true };
      if (!pr.ok) console.error("Mise à jour de la fiche refusée", pr.status, (await pr.text()).slice(0, 300));
    } else {
      // 3) Aucun compte : on ne le crée que si la personne a choisi « Créer mon compte »
      if (demande.mode !== "creation") {
        const cand = await chercherCandidature();
        if (cand && cand.acceptee) return fail("Ta candidature est acceptée : il ne reste qu'à créer ton compte. Sur l'écran de connexion du site, clique sur « Première connexion ? Créer mon compte ».");
        return fail(`Aucun compte n'est relié à ce Discord (@${pseudo}). Première connexion ? Utilise « Créer mon compte » sur l'écran de connexion du site. Tu as déjà un compte créé par un administrateur ? Demande-lui de renseigner exactement « ${pseudo} » comme pseudo Discord sur ta fiche.`);
      }
      uid = uidDiscord;
      const { personnel } = await liste();
      const prenom = demande.prenom;
      const nomRP = demande.nom;
      const year = new Date().getFullYear();
      // Numéro jamais réutilisé : plus grand numéro existant + 1 (un compte supprimé ne redonne pas son matricule)
      let n = Math.max(personnel.length, ...personnel.map((p) => Number((String(p.matricule || "").match(/-(\d+)$/) || [])[1] || 0))) + 1;
      let matricule;
      do { matricule = `GH-${year}-${String(n++).padStart(4, "0")}`; } while (personnel.some((p) => p.matricule === matricule));

      // Parrain tiré au hasard dans la brigade : grade strictement supérieur à Adjudant, pas lui-même en essai
      const sansAcc = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const miniParrain = GRADES.findIndex((g) => sansAcc(g) === "adjudant");
      const hauts = miniParrain < 0 ? [] : personnel.filter((p) => p.matricule && !["En cours", "Prolongée"].includes(p.essaiStatut) && (Number.isFinite(Number(p.gradeRank)) ? Number(p.gradeRank) : GRADES.indexOf(p.grade)) > miniParrain);
      const brigadeP = hauts.filter((p) => /brigade territoriale/.test(sansAcc(p.unite)));
      const patrouilleP = hauts.filter((p) => !/psig|gign|recherche|bmo|commandement|encadrement|dggn|iggn/.test(sansAcc(p.unite)));
      const choix = brigadeP.length ? brigadeP : patrouilleP.length ? patrouilleP : hauts;
      const parrain = choix.length ? choix[crypto.randomInt(0, choix.length)] : null;

      const fiche = {
        matricule, nom: nomRP, prenom, pseudoRoblox: "", pseudoDiscord: pseudo, username: pseudo,
        grade: GRADES[gradeRank], gradeRank, unite: "Brigade territoriale", fonction: "", qualifications: [], isAdmin: false,
        discordId: user.id, qualiteJudiciaire: qualite, creeLe: new Date().toISOString(),
        // période d'essai de 30 jours (suivi par le recrutement)
        essaiStatut: "En cours", essaiFin: new Date(Date.now() + 5 * 86400000).toISOString(), parrainMatricule: parrain ? parrain.matricule : "", parrainNom: parrain ? `${parrain.grade} ${parrain.prenom} ${parrain.nom}` : "",
      };
      // Compte Roblox vérifié lors de la candidature : repris automatiquement sur la fiche
      const candC = await chercherCandidature();
      const ligneRoblox = candC && candC.acceptee ? (candC.acceptee.answers || []).find((a) => a && a.label === "Compte Roblox vérifié") : null;
      const mr = ligneRoblox && /\(@([A-Za-z0-9_]{3,20})\)/.exec(String(ligneRoblox.value || ""));
      if (mr) { fiche.pseudoRoblox = mr[1]; fiche.robloxUsername = mr[1]; fiche.robloxVerifie = true; }
      const num = numeroCipc(personnel, uid);
      if (num) fiche.cipcNumero = num;
      const c1 = await fetch(`${base}/personnel?documentId=${encodeURIComponent(uid)}`, { method: "POST", headers: gh, body: JSON.stringify({ fields: toFields(fiche) }) });
      if (c1.ok) {
        // Coche l'étape « Compte créé » de la candidature acceptée correspondante (sans bloquer la connexion si ça échoue)
        try {
          let cible = candC && candC.acceptee && !candC.acceptee.compteCreeLe ? candC.acceptee : null;
          if (!cible) {
            // Anciennes candidatures sans compte Discord lié : repérées par le pseudo Discord donné dans le formulaire
            const q = await fetch(`${base}:runQuery`, { method: "POST", headers: gh, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "candidatures" }], where: { fieldFilter: { field: { fieldPath: "statut" }, op: "EQUAL", value: { stringValue: "Acceptée" } } }, limit: 300 } }) });
            const lignes = q.ok ? await q.json() : [];
            const lireS = (f) => (f && "stringValue" in f ? f.stringValue : "");
            for (const l of lignes) {
              const d = l.document; if (!d) continue;
              const f = d.fields || {};
              if (f.compteCreeLe) continue;
              const reponses = ((f.answers || {}).arrayValue || {}).values || [];
              const ligne = reponses.map((a) => (a.mapValue || {}).fields || {}).find((a) => /discord/i.test(lireS(a.label)) && pseudoNet(lireS(a.value)) === pseudoNet(pseudo));
              if (!ligne) continue;
              cible = { id: d.name.split("/").pop(), ref: lireS(f.ref) };
              break;
            }
          }
          if (cible) {
            await majDoc(`candidatures/${cible.id}`, { compteCreeLe: new Date().toISOString(), compteCreePar: "Discord", compteIdentifiant: pseudo });
            if (cible.ref) await majDoc(`suivi_candidatures/${encodeURIComponent(cible.ref)}`, { compteCree: true });
          }
        } catch (e) { console.error("Étape compte non cochée", e); }
        await fetch(`${base}/annuaire_public?documentId=${encodeURIComponent(uid)}`, {
          method: "POST", headers: gh,
          body: JSON.stringify({ fields: toFields({ prenom, nom: fiche.nom, pseudoRoblox: fiche.pseudoRoblox || "", pseudoDiscord: pseudo }) }),
        });
      } else if (c1.status !== 409) {
        // 409 = la fiche existe déjà (double clic, connexion simultanée) : on s'y connecte simplement
        console.error("Création du compte refusée", c1.status, (await c1.text()).slice(0, 300));
        return fail(`Création du compte impossible (erreur ${c1.status}), préviens un administrateur.`);
      }
    }

    return redirect(`${site}/#dt=${firebaseCustomToken(sa, uid)}`);
  } catch (e) {
    console.error(e);
    return fail("Erreur pendant la connexion Discord, réessaie.");
  }
}
