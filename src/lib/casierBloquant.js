// lib/casierBloquant.js — Repère les mentions de casier qui empêchent de déposer une candidature (délits et crimes).
// Les contraventions ne bloquent pas. Une mention porte sa gravité (champ « gravite ») ; pour les anciennes mentions
// qui n'en ont pas, on la retrouve en comparant le texte de la mention aux articles du code pénal.
import { memePersonne } from "./dossierPersonne.js";

export const GRAVITES = ["Contravention", "Délit", "Crime"];
const RANG = { Contravention: 1, "Délit": 2, Crime: 3 };

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const estGrave = (g) => g === "Délit" || g === "Crime";

// Gravité la plus haute d'une liste de types (Contravention < Délit < Crime)
export function graviteMax(types) {
  return (types || []).reduce((max, t) => ((RANG[t] || 0) > (RANG[max] || 0) ? t : max), "");
}

// Retrouve la gravité à partir du texte « nature » (noms d'articles du code pénal séparés par des virgules).
// On traite les noms les plus longs d'abord, pour qu'un nom court contenu dans un nom long ne soit pas pris à tort.
export function graviteDepuisNature(nature, codePenal) {
  let reste = norm(nature);
  if (!reste) return "";
  const articles = (codePenal || [])
    .filter((a) => a && a.nom && RANG[a.type])
    .map((a) => ({ nom: norm(a.nom), type: a.type }))
    .filter((a) => a.nom)
    .sort((a, b) => b.nom.length - a.nom.length);
  const trouves = [];
  for (const a of articles) {
    const re = new RegExp("(^|[^a-z0-9])" + echapper(a.nom) + "(?![a-z0-9])", "g");
    if (re.test(reste)) {
      trouves.push(a.type);
      reste = reste.replace(re, "$1|");
    }
  }
  return graviteMax(trouves);
}

// Gravité d'une mention : celle enregistrée, sinon celle déduite du code pénal ("" si on ne sait pas)
export function graviteDeMention(m, codePenal) {
  if (m && RANG[m.gravite]) return m.gravite;
  return graviteDepuisNature(m && m.nature, codePenal);
}

export const mentionGrave = (m, codePenal) => estGrave(graviteDeMention(m, codePenal));

// Mentions de délit ou de crime au casier du compte Roblox donné
export function mentionsGravesDe(casier, compte, codePenal) {
  const dossiers = (casier || []).filter((d) => memePersonne(d, { robloxId: compte.id, robloxUsername: compte.username, pseudoRoblox: compte.displayName }));
  return dossiers.flatMap((d) => d.mentions || []).filter((m) => mentionGrave(m, codePenal));
}
