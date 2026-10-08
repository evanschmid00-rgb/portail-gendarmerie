// Contrôle hebdomadaire du quota de service.
// Chaque lundi (tâche planifiée Vercel), on regarde la semaine PRÉCÉDENTE (lundi → dimanche, heure de Paris) :
// tout gendarme sous son quota reçoit une « Mise en garde » automatique, sauf s'il était déclaré absent pendant la semaine,
// s'il a créé son compte pendant cette semaine ou s'il était en « Mise à pied ».
// Quota par défaut 5 h, 3 h pour les réservistes (qualification « Réserviste ») : réglable par un admin sur le site.
// Une sanction automatique a un identifiant unique par gendarme et par semaine : relancer le contrôle ne crée jamais de doublon.
//
// GET  (tâche planifiée) : applique réellement le contrôle, protégé par CRON_SECRET.
// POST (admin connecté)  : SIMULATION uniquement, ne crée aucune sanction.

import crypto from "node:crypto";

const TZ = "Europe/Paris";
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
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("Jeton Google refusé");
  return j.access_token;
}
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
  if ("timestampValue" in f) return f.timestampValue;
  if ("arrayValue" in f) return (f.arrayValue.values || []).map(fromFs);
  if ("mapValue" in f) { const o = {}; Object.entries(f.mapValue.fields || {}).forEach(([k, v]) => { o[k] = fromFs(v); }); return o; }
  return null;
};
const versObjet = (d) => { const o = {}; Object.entries((d && d.fields) || {}).forEach(([k, v]) => { o[k] = fromFs(v); }); return o; };
const toFs = (v) => {
  if (v === null) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { integerValue: String(v) };
  return { nullValue: null };
};
const toFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toFs(v)]));

// --- Dates à l'heure de Paris ---
function partsParis(date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" });
  const o = {};
  f.formatToParts(date).forEach((p) => { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second, wd: { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[o.weekday] };
}
const decalageParis = (instant) => { const p = partsParis(new Date(instant)); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - instant; };
// Instant (en ms) de minuit à Paris pour la date y-m-d (d peut déborder : il est normalisé)
function minuitParis(y, m, d) {
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const t1 = guess - decalageParis(guess);
  return guess - decalageParis(t1);
}
const jourStr = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const fmtH = (min) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`;
const fmtCourt = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export default async function handler(req, res) {
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, FIREBASE_SERVICE_ACCOUNT, CRON_SECRET } = process.env;
  const rep = (corps, code = 200) => res.status(code).json(corps);
  if (!FIREBASE_SERVICE_ACCOUNT) return rep({ ok: false, message: "Base de données pas configurée." });
  if (req.method !== "GET" && req.method !== "POST") return rep({ ok: false }, 405);

  try {
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const gtok = await googleToken(sa);
    const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    const fsH = { Authorization: `Bearer ${gtok}`, "Content-Type": "application/json" };
    const lireDoc = async (chemin) => { const r = await fetch(`${base}/${chemin}`, { headers: fsH }); return r.ok ? versObjet(await r.json()) : null; };
    const requete = async (structuredQuery) => {
      const r = await fetch(`${base}:runQuery`, { method: "POST", headers: fsH, body: JSON.stringify({ structuredQuery }) });
      const arr = await r.json();
      if (!Array.isArray(arr)) throw new Error("Requête refusée");
      return arr.filter((x) => x.document).map((x) => ({ id: x.document.name.split("/").pop(), ...versObjet(x.document) }));
    };
    const champ = (nom, op, valeur) => ({ fieldFilter: { field: { fieldPath: nom }, op, value: { stringValue: valeur } } });
    const entre = (nom, a, b) => ({ compositeFilter: { op: "AND", filters: [champ(nom, "GREATER_THAN_OR_EQUAL", a), champ(nom, "LESS_THAN", b)] } });

    let simulation = false;
    if (req.method === "GET") {
      if (!CRON_SECRET || String(req.headers.authorization || "") !== `Bearer ${CRON_SECRET}`) return rep({ ok: false }, 401);
    } else {
      const uid = await verifierJeton((req.body || {}).idToken, sa.project_id);
      const moi = await lireDoc(`personnel/${encodeURIComponent(uid)}`);
      if (!moi || moi.isAdmin !== true) return rep({ ok: false, message: "Non autorisé." }, 403);
      simulation = true;
    }

    // Semaine contrôlée : la dernière semaine COMPLÈTE (lundi 00:00 → dimanche 24:00, heure de Paris)
    const maintenant = new Date();
    const pn = partsParis(maintenant);
    const debutMs = minuitParis(pn.y, pn.m, pn.d - pn.wd - 7);
    const finMs = minuitParis(pn.y, pn.m, pn.d - pn.wd);
    const lundi = jourStr(pn.y, pn.m, pn.d - pn.wd - 7);
    const dimanche = jourStr(pn.y, pn.m, pn.d - pn.wd - 1);
    const debutISO = new Date(debutMs).toISOString();
    const finISO = new Date(finMs).toISOString();

    const reglages = (await lireDoc("settings/general")) || {};
    const quotaNormal = Number(reglages.quotaHebdoMin) > 0 ? Number(reglages.quotaHebdoMin) : 300;
    const quotaReserve = Number(reglages.quotaReserveMin) > 0 ? Number(reglages.quotaReserveMin) : 180;
    const rolesSanction = reglages.sanctionRoles && typeof reglages.sanctionRoles === "object" ? reglages.sanctionRoles : {};
    const infosSemaine = { lundi, dimanche, quotaNormal, quotaReserve };

    if (!simulation) {
      if (reglages.quotaAuto !== true || !reglages.quotaDebut) return rep({ ok: true, message: "Sanctions automatiques de quota non activées.", ...infosSemaine });
      if (lundi < String(reglages.quotaDebut)) return rep({ ok: true, message: `Le contrôle commence avec la semaine du ${reglages.quotaDebut}.`, ...infosSemaine });
    }

    // Temps de service de la semaine (même règle que le site : un service compte dans la semaine où il commence)
    const [services, ajustements, personnel, absences, sanctions] = await Promise.all([
      requete({ from: [{ collectionId: "services" }], where: entre("debut", debutISO, finISO) }),
      requete({ from: [{ collectionId: "services" }], where: entre("date", debutISO, finISO) }),
      requete({ from: [{ collectionId: "personnel" }] }),
      requete({ from: [{ collectionId: "absences" }], where: champ("fin", "GREATER_THAN_OR_EQUAL", lundi) }),
      requete({ from: [{ collectionId: "sanctions" }], where: champ("dateFin", "GREATER_THAN_OR_EQUAL", debutISO) }),
    ]);

    const minutes = {};
    services.filter((s) => s.type !== "ajustement").forEach((s) => {
      const fin = s.fin ? new Date(s.fin).getTime() : Math.min(maintenant.getTime(), finMs);
      minutes[s.matricule] = (minutes[s.matricule] || 0) + Math.max(0, (fin - new Date(s.debut).getTime()) / 60000);
    });
    ajustements.filter((s) => s.type === "ajustement").forEach((s) => { minutes[s.matricule] = (minutes[s.matricule] || 0) + (Number(s.minutes) || 0); });

    // Sécurité : si personne n'a aucun service sur toute la semaine, on suppose un problème de lecture et on n'applique rien
    const totalEquipe = Object.values(minutes).reduce((n, v) => n + v, 0);
    if (totalEquipe <= 0) return rep({ ok: false, message: "Aucun temps de service trouvé pour cette semaine : contrôle annulé par sécurité.", ...infosSemaine });

    const absents = new Set(absences.filter((a) => a.annulee !== true && a.debut <= dimanche && a.fin >= lundi).map((a) => a.matricule));
    const misesAPied = new Set(sanctions.filter((s) => s.type === "Mise à pied" && s.levee !== true && s.dateDebut < finISO).map((s) => s.matricule));

    const bot = DISCORD_BOT_TOKEN ? { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "X-Audit-Log-Reason": encodeURIComponent("Quota de service non atteint") } : null;
    const roleMiseEnGarde = rolesSanction["Mise en garde"] || "";
    const resultats = [];
    let creees = 0;

    for (const p of personnel) {
      if (!p.matricule) continue;
      const reserviste = Array.isArray(p.qualifications) && p.qualifications.includes("Réserviste");
      const quota = reserviste ? quotaReserve : quotaNormal;
      const fait = Math.round(minutes[p.matricule] || 0);
      const nom = `${p.prenom || ""} ${p.nom || ""}`.trim() || p.matricule;
      const ligne = { matricule: p.matricule, nom, minutes: fait, quota, reserviste, statut: "ok" };
      if (fait >= quota) { resultats.push(ligne); continue; }
      if (p.creeLe && String(p.creeLe) >= debutISO) ligne.statut = "exempt-nouveau";
      else if (absents.has(p.matricule)) ligne.statut = "exempt-absent";
      else if (misesAPied.has(p.matricule)) ligne.statut = "exempt-mise-a-pied";
      else ligne.statut = "sanction";

      if (ligne.statut === "sanction" && !simulation) {
        const debut = new Date();
        const fin = new Date(debut.getTime() + 3 * 86400000);
        const sanction = {
          matricule: p.matricule, nomCible: nom, type: "Mise en garde",
          motif: `Quota de service non atteint (semaine du ${fmtCourt(lundi)} au ${fmtCourt(dimanche)}) : ${fmtH(fait)} effectuées sur ${fmtH(quota)} requises${reserviste ? " pour un réserviste" : ""}. Sanction automatique : si tu étais absent(e), préviens ton commandement.`,
          dureeJours: 3, dateDebut: debut.toISOString(), dateFin: fin.toISOString(),
          emisPar: "SYSTEME", emisParNom: "Système automatique", levee: false, auto: true,
          roleDiscordId: roleMiseEnGarde, statutDiscord: roleMiseEnGarde ? "en attente" : "aucun",
        };
        const id = `quota-${p.matricule}-${lundi}`;
        const c = await fetch(`${base}/sanctions?documentId=${encodeURIComponent(id)}`, { method: "POST", headers: fsH, body: JSON.stringify({ fields: toFields(sanction) }) });
        if (c.ok) {
          creees++;
          ligne.sanctionCreee = true;
          if (roleMiseEnGarde && p.discordId && bot && DISCORD_GUILD_ID) {
            const a = await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${p.discordId}/roles/${roleMiseEnGarde}`, { method: "PUT", headers: bot });
            await fetch(`${base}/sanctions/${encodeURIComponent(id)}?updateMask.fieldPaths=statutDiscord`, { method: "PATCH", headers: fsH, body: JSON.stringify({ fields: { statutDiscord: { stringValue: a.ok ? "actif" : "erreur" } } }) });
          }
        } else if (c.status === 409) ligne.sanctionCreee = false; // déjà émise pour cette semaine
        else console.error("Création de la sanction refusée", c.status, (await c.text()).slice(0, 200));
      }
      resultats.push(ligne);
    }

    const aSanctionner = resultats.filter((r) => r.statut === "sanction").length;
    return rep({ ok: true, simulation, message: simulation ? `Simulation : ${aSanctionner} mise(s) en garde seraient émises.` : `${creees} mise(s) en garde automatique(s) émise(s).`, ...infosSemaine, resultats });
  } catch (e) {
    console.error(e);
    return rep({ ok: false, message: "Erreur pendant le contrôle du quota." });
  }
}
