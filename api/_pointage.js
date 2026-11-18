// api/_pointage.js — Outils communs du pointage de service par Discord (le « _ » = ce n'est pas une page de l'API).
// Règles (identiques à celles du site, voir src/lib/utils.js) : pointage 1 h après le début du service puis 1 h après chaque pointage,
// 10 minutes pour répondre, service de 3 h maximum.
import crypto from "node:crypto";
import { discordFetch } from "./_discordApi.js";

export const DUREE_MAX_SERVICE_MS = 3 * 3600 * 1000;
export const INTERVALLE_POINTAGE_MS = 60 * 60000;
export const DELAI_REPONSE_POINTAGE_MS = 10 * 60000;
export const SEUIL_POINTAGE_MS = INTERVALLE_POINTAGE_MS + DELAI_REPONSE_POINTAGE_MS;
const GRACE_MS = 5 * 60000;

export const dernierPointageMs = (s) => new Date(s.dernierPointage || s.debut).getTime();
export const echeancePointageMs = (s) => dernierPointageMs(s) + INTERVALLE_POINTAGE_MS; // heure à laquelle il faut pointer
export const limitePointageMs = (s) => echeancePointageMs(s) + DELAI_REPONSE_POINTAGE_MS; // dernier instant pour répondre
export const finAuto = (s) => new Date(Math.min(new Date(s.debut).getTime() + DUREE_MAX_SERVICE_MS, dernierPointageMs(s) + GRACE_MS)).toISOString();

// ---------- Firestore (API REST, compte de service) ----------
const b64url = (b) => Buffer.from(b).toString("base64url");
function signJwt(payload, privateKey) {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  return `${head}.${body}.${b64url(crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey))}`;
}
let jetonCache = null;
async function googleToken(sa) {
  if (jetonCache && jetonCache.exp > Date.now() + 60000) return jetonCache.token;
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, sa.private_key);
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("Jeton Google refusé");
  jetonCache = { token: j.access_token, exp: Date.now() + 3500 * 1000 };
  return j.access_token;
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
const toFs = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
  return { nullValue: null };
};

export async function ouvrirBase() {
  const { FIREBASE_SERVICE_ACCOUNT } = process.env;
  const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  const h = { Authorization: `Bearer ${await googleToken(sa)}`, "Content-Type": "application/json" };
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  return {
    async lire(chemin) {
      const r = await fetch(`${base}/${chemin}`, { headers: h });
      return r.ok ? versObjet(await r.json()) : null;
    },
    async requete(sq) {
      const r = await fetch(`${base}:runQuery`, { method: "POST", headers: h, body: JSON.stringify({ structuredQuery: sq }) });
      const arr = await r.json();
      if (!Array.isArray(arr)) throw new Error("requête Firestore refusée");
      return arr.filter((x) => x.document).map((x) => ({ id: x.document.name.split("/").pop(), ...versObjet(x.document) }));
    },
    async modifier(chemin, champs) {
      const masque = Object.keys(champs).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
      const r = await fetch(`${base}/${chemin}?${masque}`, { method: "PATCH", headers: h, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, toFs(v)])) }) });
      return r.ok;
    },
    async supprimer(chemin) { const r = await fetch(`${base}/${chemin}`, { method: "DELETE", headers: h }); return r.ok || r.status === 404; },
    async personneParMatricule(matricule) {
      const l = await this.requete({ from: [{ collectionId: "personnel" }], where: { fieldFilter: { field: { fieldPath: "matricule" }, op: "EQUAL", value: { stringValue: String(matricule) } } }, limit: 1 });
      return l[0] || null;
    },
  };
}

// ---------- Messages Discord ----------
const hms = (ms) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const entete = { name: "GENDARMERIE NATIONALE · CGD SAINT-TROPEZ RP" };
const ts = (ms) => Math.floor(ms / 1000);

export function embedDemande(prenom, service) {
  const limite = limitePointageMs(service);
  return {
    author: entete,
    title: "⏰ Pointage de service",
    description: `Bonjour **${prenom || "gendarme"}**,\nEs-tu toujours en service ? Confirme ta présence avec le bouton ci-dessous.`,
    color: 0xE0A23A,
    fields: [
      { name: "⏱️ À faire avant", value: `<t:${ts(limite)}:T> (<t:${ts(limite)}:R>)`, inline: true },
      { name: "🚪 Prise de service", value: `<t:${ts(new Date(service.debut).getTime())}:t>`, inline: true },
      { name: "⚠️ Sans réponse", value: `Ton service sera arrêté et ne sera compté que jusqu'à ton dernier pointage (${hms(dernierPointageMs(service) + GRACE_MS)}).` },
    ],
    footer: { text: "Tu peux aussi pointer directement sur le site." },
    timestamp: new Date().toISOString(),
  };
}
export const boutonPointage = (serviceId, echeanceMs) => [{ type: 1, components: [{ type: 2, style: 3, label: "Je suis là — je pointe", emoji: { name: "✅" }, custom_id: `pointer:${serviceId}:${echeanceMs}` }] }];

export const embedConfirme = (prochainMs) => ({
  author: entete, title: "✅ Pointage confirmé", color: 0x2E7D4F,
  description: "Merci, ta présence est enregistrée : ton temps de service continue d'être compté.",
  fields: [{ name: "⏭️ Prochain pointage", value: `vers <t:${ts(prochainMs)}:t>`, inline: true }],
  timestamp: new Date().toISOString(),
});
export const embedManque = (finMs) => ({
  author: entete, title: "⏱️ Pointage manqué — service arrêté", color: 0xC0172D,
  description: `Tu n'as pas pointé à temps : ton service a été arrêté automatiquement. Il est compté jusqu'à **${hms(finMs)}**.`,
  footer: { text: "Reprends ton service sur le site quand tu es de nouveau disponible." },
  timestamp: new Date().toISOString(),
});
export const embedInfo = (titre, texte) => ({ author: entete, title: titre, description: texte, color: 0x5A6B84, timestamp: new Date().toISOString() });

const botH = () => ({ Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" });
export async function envoyerMP(discordId, corps) {
  const dm = await discordFetch("https://discord.com/api/users/@me/channels", { method: "POST", headers: botH(), body: JSON.stringify({ recipient_id: discordId }) });
  if (!dm.ok) return null;
  const canal = await dm.json();
  const m = await discordFetch(`https://discord.com/api/channels/${canal.id}/messages`, { method: "POST", headers: botH(), body: JSON.stringify(corps) });
  if (!m.ok) return null;
  const msg = await m.json();
  return { c: canal.id, m: msg.id };
}
export async function modifierMessage(c, m, corps) {
  try { await discordFetch(`https://discord.com/api/channels/${c}/messages/${m}`, { method: "PATCH", headers: botH(), body: JSON.stringify(corps) }); } catch (e) { /* tant pis */ }
}

// ---------- Signature des appels de Discord (Ed25519) ----------
export function signatureValide(corpsBrut, signatureHex, horodatage, cleHex) {
  try {
    const cle = crypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(cleHex, "hex")]), format: "der", type: "spki" });
    return crypto.verify(null, Buffer.from(horodatage + corpsBrut), cle, Buffer.from(signatureHex, "hex"));
  } catch (e) { return false; }
}

// ═══════════════ Messages de prise / fin de service, totaux, archivage hebdomadaire ═══════════════
const fmtD = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };

// Lundi 00:00 (heure de Paris) de la semaine qui contient « ms »
export function lundiParis(ms) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  return ms - (dow * 86400000 + Number(p.hour) * 3600000 + Number(p.minute) * 60000 + Number(p.second) * 1000);
}

// Même calcul que le site (src/lib/utils.js : dureeService)
export function dureeServiceMs(s, now = Date.now()) {
  if (s.type === "ajustement") return (Number(s.minutes) || 0) * 60000;
  const debut = new Date(s.debut).getTime();
  const plafond = Math.min(debut + DUREE_MAX_SERVICE_MS, s.pointage ? dernierPointageMs(s) + SEUIL_POINTAGE_MS : Infinity);
  const fin = s.fin ? new Date(s.fin).getTime() : Math.min(now, plafond);
  return Math.max(0, fin - debut);
}

export async function totauxMatricule(db, matricule, now = Date.now()) {
  const liste = await db.requete({ from: [{ collectionId: "services" }], where: { fieldFilter: { field: { fieldPath: "matricule" }, op: "EQUAL", value: { stringValue: String(matricule) } } }, limit: 2000 });
  const lundi = lundiParis(now);
  let total = 0, semaine = 0;
  liste.forEach((s) => {
    const ref = new Date(s.type === "ajustement" ? s.date : s.debut).getTime();
    if (!ref) return;
    const ms = dureeServiceMs(s, now);
    total += ms;
    if (ref >= lundi) semaine += ms;
  });
  return { total, semaine };
}

export const motifFin = (s) => (s.force ? "admin" : s.motifArret === "pointage" ? "pointage" : s.motifArret === "duree" ? "duree" : "normal");

// ---------- Contexte d'un message : photo (tête Roblox), quota, lien vers le site ----------
const barre = (ratio, n = 10) => { const r = Math.max(0, Math.min(1, ratio || 0)); const p = Math.round(r * n); return "▰".repeat(p) + "▱".repeat(n - p); };
const lienSite = () => { try { return process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : ""; } catch (e) { return ""; } };
const boutonSite = (libelle = "Ouvrir mon espace gendarme") => (lienSite() ? [{ type: 1, components: [{ type: 2, style: 5, label: libelle, emoji: { name: "🛡️" }, url: lienSite() }] }] : []);
const identite = (p) => [p && p.grade, p && `${p.prenom || ""} ${p.nom || ""}`.trim()].filter(Boolean).join(" ");

async function teteRoblox(robloxId) {
  if (!robloxId || !/^\d{1,15}$/.test(String(robloxId))) return "";
  try {
    const r = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    return (j && j.data && j.data[0] && j.data[0].state === "Completed" && j.data[0].imageUrl) || "";
  } catch (e) { return ""; }
}
export async function contexteMessage(db, perso) {
  const ctx = { thumb: await teteRoblox(perso && perso.robloxId), quotaMs: 0 };
  try {
    const g = (await db.lire("settings/general")) || {};
    const min = (Array.isArray(perso && perso.qualifications) && perso.qualifications.includes("Réserviste") ? Number(g.quotaReserveMin) || 180 : Number(g.quotaHebdoMin) || 300);
    ctx.quotaMs = min * 60000;
  } catch (e) { /* pas de quota affiché */ }
  return ctx;
}

export function embedDebut(perso, s, taches = [], ctx = {}) {
  const debutMs = new Date(s.debut).getTime();
  const lignes = (taches || []).slice(0, 8).map((t, i) => `**${i + 1}.** ${t.icone || "•"} ${String(t.titre || "").slice(0, 60)}${t.nombre > 1 ? ` — **${t.nombre}**` : ""}${t.detail ? `\n　 *${String(t.detail).slice(0, 110)}*` : ""}`);
  return {
    author: entete,
    title: "🟢 Service pris — bonne patrouille !",
    description: `${identite(perso) ? `**${identite(perso)}**\n` : ""}Ton service a bien démarré. Voici le programme :\n\n🚪 Début **<t:${ts(debutMs)}:t>**　→　✅ 1er pointage **<t:${ts(debutMs + INTERVALLE_POINTAGE_MS)}:t>**　→　🛑 fin max **<t:${ts(debutMs + DUREE_MAX_SERVICE_MS)}:t>**`,
    color: 0x2E7D4F,
    ...(ctx.thumb ? { thumbnail: { url: ctx.thumb } } : {}),
    fields: [
      { name: lignes.length ? `📋 À faire (${taches.length})` : "📋 Tes tâches", value: lignes.length ? lignes.join("\n").slice(0, 1000) : "✅ Rien en attente : tu es à jour !" },
      { name: "⚠️ Règle du pointage", value: "Toutes les heures, je t'écris ici avec le bouton **« Je pointe »**. Tu as **10 minutes** pour répondre, sinon ton service est **arrêté** et compté jusqu'à ton dernier pointage." },
      { name: "📝 À la fin", value: "N'oublie pas d'écrire ton **résumé** sur le site : je te le renverrai ici avec tes heures." },
    ],
    footer: { text: "Gendarmerie Nationale · Saint-Tropez RP" },
    timestamp: new Date().toISOString(),
  };
}

export function embedFin(perso, s, motif, stats, ctx = {}) {
  const debutMs = new Date(s.debut).getTime(), finMs = new Date(s.fin).getTime();
  const dureeMs = finMs - debutMs;
  const base = [
    { name: "⏱️ Durée comptée", value: `**${fmtD(dureeMs)}**`, inline: true },
    { name: "🕒 Horaires", value: `<t:${ts(debutMs)}:t> → <t:${ts(finMs)}:t>`, inline: true },
    { name: "✅ Pointages", value: `**${Number(s.pointages) || 0}**`, inline: true },
  ];
  const sem = stats ? [{ name: "📅 Ta semaine", value: ctx.quotaMs ? `${barre(stats.semaine / ctx.quotaMs)} **${fmtD(stats.semaine)}** / ${fmtD(ctx.quotaMs)}${stats.semaine >= ctx.quotaMs ? "\n🎯 **Quota atteint, bravo !**" : `\nIl te reste **${fmtD(ctx.quotaMs - stats.semaine)}** pour ton quota.`}` : `**${fmtD(stats.semaine)}**` },
    { name: "🏁 Total d'heures", value: `**${fmtD(stats.total)}**`, inline: true }] : [];
  const e = { author: entete, ...(ctx.thumb ? { thumbnail: { url: ctx.thumb } } : {}), footer: { text: "Gendarmerie Nationale · Saint-Tropez RP" }, timestamp: new Date().toISOString() };
  const qui = identite(perso) ? `**${identite(perso)}**\n` : "";
  if (motif === "normal") {
    return { ...e, title: "🏁 Service terminé — merci !", color: 0x123A7A, description: `${qui}Voici le résumé de ton service.`,
      fields: [...base, ...(typeof s.activite === "number" ? [{ name: "📝 PV / CR rédigés", value: `**${s.activite}**`, inline: true }] : []),
        { name: "🗒️ Ton résumé", value: s.resume ? `> ${String(s.resume).slice(0, 900).replace(/\n/g, "\n> ")}` : "*Aucun résumé rédigé.*" }, ...sem] };
  }
  if (motif === "admin") {
    return { ...e, title: "🛑 Service arrêté par l'administration", color: 0xC0172D,
      description: `${qui}${s.forcePar ? `**${s.forcePar}**` : "Un membre de l'administration"} a mis fin à ton service.\n\n⚠️ **Fais attention :** si tu penses qu'il s'agit d'une erreur, contacte-le rapidement.`,
      fields: [...base, ...(s.resume ? [{ name: "🗒️ Résumé", value: `> ${String(s.resume).slice(0, 900)}` }] : []), ...sem] };
  }
  if (motif === "pointage") {
    return { ...e, title: "⏱️ Pointage non confirmé — service arrêté", color: 0xC0172D,
      description: `${qui}Tu n'as pas confirmé ta présence à temps : ton service a été **arrêté automatiquement** et compté seulement jusqu'à ton dernier pointage.\n\n⚠️ **Fais attention :** les services arrêtés faute de pointage sont signalés à l'administration.`,
      fields: [...base, ...sem, { name: "💡 La prochaine fois", value: "Clique sur **« Je pointe »** dans le message reçu (ou pointe sur le site) dans les **10 minutes**." }] };
  }
  return { ...e, title: "⏱️ Service arrêté automatiquement (3 h)", color: 0xE0A23A,
    description: `${qui}Ton service a atteint la durée maximale de **3 heures** : il a été arrêté automatiquement.\n\n⚠️ **Fais attention :** pense à terminer ton service toi-même, avec ton résumé.`,
    fields: [...base, ...sem] };
}

// Message de début de service (une seule fois par service)
export async function envoyerDebutService(db, s, perso, taches) {
  const chemin = `services/${encodeURIComponent(s.id)}`;
  if (s.debutMsgLe) return false;
  await db.modifier(chemin, { debutMsgLe: new Date().toISOString() });
  if (!perso || !perso.discordId) return false;
  const ctx = await contexteMessage(db, perso);
  return !!(await envoyerMP(String(perso.discordId), { embeds: [embedDebut(perso, s, taches, ctx)], components: boutonSite("Ouvrir mon service") }));
}

// Message de fin de service avec résumé (une seule fois par service, que l'arrêt vienne du site, de l'admin ou du pointage manqué)
export async function envoyerFinService(db, s, perso) {
  if (!s.fin || s.finMsgLe) return false;
  const chemin = `services/${encodeURIComponent(s.id)}`;
  await db.modifier(chemin, { finMsgLe: new Date().toISOString() });
  if (!perso || !perso.discordId) return false;
  let stats = null;
  try { stats = await totauxMatricule(db, s.matricule); } catch (e) { /* message sans totaux */ }
  const ctx = await contexteMessage(db, perso);
  return !!(await envoyerMP(String(perso.discordId), { embeds: [embedFin(perso, s, motifFin(s), stats, ctx)], components: boutonSite(motifFin(s) === "normal" ? "Voir mon carnet de service" : "Ouvrir mon espace gendarme") }));
}

// ── Archivage hebdomadaire : les services des semaines passées sont supprimés, leurs heures sont cumulées dans une ligne « archive »
// (le total d'heures ne baisse jamais). On garde la semaine en cours + la précédente (le contrôle du quota du lundi en a besoin).
export async function purgerHebdo(db, now = Date.now(), maxDocs = 300) {
  const lundi = lundiParis(now);
  const cleSemaine = new Date(lundi).toISOString().slice(0, 10);
  const marque = await db.lire("settings/purge_services");
  if (marque && marque.semaine === cleSemaine) return { fait: false, supprimes: 0 };
  const seuil = new Date(lundi - 7 * 86400000).toISOString();
  const requete = (champ) => db.requete({ from: [{ collectionId: "services" }], where: { fieldFilter: { field: { fieldPath: champ }, op: "LESS_THAN", value: { stringValue: seuil } } }, limit: maxDocs });
  const vieux = [...(await requete("debut")).filter((s) => s.type === "service" && s.fin), ...(await requete("date")).filter((s) => s.type === "ajustement" && !String(s.id).startsWith("archive-"))];
  const parMat = {};
  vieux.forEach((s) => { if (s.matricule) (parMat[s.matricule] = parMat[s.matricule] || []).push(s); });
  let supprimes = 0;
  for (const [mat, liste] of Object.entries(parMat)) {
    const ms = liste.reduce((n, s) => n + dureeServiceMs(s, now), 0);
    const idArch = `archive-${mat}`;
    const ancien = await db.lire(`services/${encodeURIComponent(idArch)}`);
    const ok = await db.modifier(`services/${encodeURIComponent(idArch)}`, { type: "ajustement", archive: true, matricule: mat, nom: (ancien && ancien.nom) || liste[0].nom || "", minutes: ((ancien && Number(ancien.minutes)) || 0) + ms / 60000, date: "2000-01-01T12:00:00.000Z", motif: "Heures cumulées des semaines archivées", archiveLe: new Date(now).toISOString() });
    if (!ok) continue; // on ne supprime rien si le cumul n'a pas pu être écrit
    for (const s of liste) { if (await db.supprimer(`services/${encodeURIComponent(s.id)}`)) supprimes++; }
  }
  if (vieux.length < maxDocs) await db.modifier("settings/purge_services", { semaine: cleSemaine, le: new Date(now).toISOString(), supprimes });
  return { fait: vieux.length < maxDocs, supprimes };
}
