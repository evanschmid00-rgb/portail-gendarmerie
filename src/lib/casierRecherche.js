// lib/casierRecherche.js — retrouve le casier d'UN compte Roblox sans lire toute la collection (quelques lectures au lieu de centaines)
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

export async function chargerCasierDe(compte) {
  const id = String(compte.id);
  const noms = Array.from(new Set([compte.username, compte.displayName].filter(Boolean)));
  const requetes = [
    getDocs(query(collection(db, "casier"), where("robloxId", "in", [id, Number(id)]))),
    getDocs(query(collection(db, "casier"), where("robloxUsername", "in", noms))),
    getDocs(query(collection(db, "casier"), where("pseudoRoblox", "in", noms))),
  ];
  const resultats = await Promise.all(requetes);
  const vus = new Map();
  resultats.forEach((s) => s.docs.forEach((d) => vus.set(d.id, { ...d.data(), id: d.id })));
  return Array.from(vus.values());
}
