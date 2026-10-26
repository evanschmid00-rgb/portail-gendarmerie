// lib/fileAttente.js — File d'attente locale : quand la base de données est saturée (quota du jour atteint),
// l'envoi est gardé sur l'appareil puis rejoué automatiquement dès que la base répond de nouveau.
import { addDoc, collection, doc, getDocs, limit, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";

const CLE = "gn_file_attente_v1";
const MAX_AGE = 72 * 3600 * 1000;

export function estErreurQuota(e) {
  const s = `${(e && e.code) || ""} ${(e && e.message) || ""}`;
  return /resource-exhausted|quota|exhausted|RESOURCE_EXHAUSTED/i.test(s) || !!(e && e.quota);
}

export function lireFile() {
  try {
    const l = JSON.parse(window.localStorage.getItem(CLE) || "[]");
    return Array.isArray(l) ? l.filter((x) => x && Date.now() - x.at < MAX_AGE) : [];
  } catch (e) { return []; }
}
function ecrireFile(l) {
  try { window.localStorage.setItem(CLE, JSON.stringify(l)); } catch (e) { /* stockage plein ou indisponible */ }
}
export function ajouterFile(item) {
  const l = lireFile();
  l.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(), essais: 0, ...item });
  ecrireFile(l);
}
export function retirerFile(id) { ecrireFile(lireFile().filter((x) => x.id !== id)); }
export function marquerEssai(id) { ecrireFile(lireFile().map((x) => (x.id === id ? { ...x, essais: (x.essais || 0) + 1 } : x))); }
export function nbEnAttente() { return lireFile().length; }

// Rejoue l'ajout d'une mention de casier (sans doublon : la mention a un identifiant unique)
export async function rejouerCasier(p) {
  const { robloxId, robloxUsername, pseudoRoblox, nom, prenom, mention } = p;
  const lire = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
  let existant = null;
  if (robloxId) {
    const l = await lire(query(collection(db, "casier"), where("robloxId", "in", [robloxId, Number(robloxId)]), limit(1)));
    existant = l[0] || null;
  }
  if (!existant) {
    const noms = Array.from(new Set([pseudoRoblox, robloxUsername].filter(Boolean)));
    if (noms.length) {
      const l = await lire(query(collection(db, "casier"), where("pseudoRoblox", "in", noms), limit(5)));
      existant = l.find((d) => !d.robloxId) || null;
    }
  }
  if (existant) {
    const mentions = Array.isArray(existant.mentions) ? existant.mentions : [];
    if (mentions.some((m) => m && m.id === mention.id)) return;
    const patch = { mentions: [...mentions, mention], nom: nom || existant.nom || "", prenom: prenom || existant.prenom || "" };
    if (!existant.robloxId && robloxId) Object.assign(patch, { robloxId, robloxUsername, robloxDisplayName: pseudoRoblox });
    await updateDoc(doc(db, "casier", existant.id), patch);
  } else {
    await addDoc(collection(db, "casier"), { pseudoRoblox, pseudoDiscord: "", robloxId, robloxUsername, robloxDisplayName: pseudoRoblox, nom, prenom, mentions: [mention] });
  }
}
