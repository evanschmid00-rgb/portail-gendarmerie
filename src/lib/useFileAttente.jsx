// lib/useFileAttente.jsx — Rejoue la file d'attente (envois mis de côté pendant une saturation) et affiche un bandeau d'information.
import { onAuthStateChanged } from "firebase/auth";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "../firebase";
import { estErreurQuota, lireFile, marquerEssai, rejouerCasier, retirerFile } from "./fileAttente.js";
import { envoyerPublic } from "./envoiPublic.js";
import { viderCacheSession } from "./cache.js";

const LIBELLES = { candidature: "candidature", plainte: "plainte", avis_gendarme: "avis", avis_general: "avis", suggestion: "suggestion", casier: "mention de casier" };

export function useFileAttente() {
  const [info, setInfo] = useState(null);
  const [restant, setRestant] = useState(() => lireFile().length);
  const enCours = useRef(false);

  const traiter = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    try {
      for (const it of lireFile()) {
        const lib = LIBELLES[it.type] || "demande";
        try {
          if (it.kind === "casier") {
            if (!auth.currentUser || auth.currentUser.uid !== it.auteurUid) continue; // rejoué à la prochaine connexion de ce gendarme
            await rejouerCasier(it.payload);
            viderCacheSession();
            retirerFile(it.id);
            setInfo({ ok: true, texte: "Une mention de casier mise en attente a bien été enregistrée." });
          } else {
            if (it.connecte && !auth.currentUser) continue;
            const r = await envoyerPublic(it.type, it.data, { connecte: !!it.connecte, sansFile: true });
            retirerFile(it.id);
            setInfo({ ok: true, texte: `Ta ${lib} mise en attente a bien été envoyée${r && r.ref ? ` (n° ${r.ref})` : ""}.` });
          }
        } catch (e) {
          if (estErreurQuota(e)) break; // la base est toujours saturée : on réessaiera plus tard
          marquerEssai(it.id);
          if ((it.essais || 0) + 1 >= 3) {
            retirerFile(it.id);
            setInfo({ ok: false, texte: `Une ${lib} mise en attente n'a pas pu être envoyée : ${(e && e.message) || "erreur"}. Merci de la refaire.` });
          }
        }
      }
    } finally {
      enCours.current = false;
      setRestant(lireFile().length);
    }
  }, []);

  useEffect(() => {
    const premier = setTimeout(traiter, 4000);
    const t = setInterval(traiter, 5 * 60000);
    const reveil = () => { setRestant(lireFile().length); traiter(); };
    window.addEventListener("online", reveil);
    window.addEventListener("gn-file-maj", reveil);
    const unsub = onAuthStateChanged(auth, () => setTimeout(traiter, 2500));
    return () => { clearTimeout(premier); clearInterval(t); window.removeEventListener("online", reveil); window.removeEventListener("gn-file-maj", reveil); unsub(); };
  }, [traiter]);

  const bandeau = (info || restant > 0) ? (
    <div role="status" style={{ background: info && !info.ok ? "#FDECEE" : info ? "#E3F2E8" : "#FFF6DD", border: `1px solid ${info && !info.ok ? "#E8A0AA" : info ? "#2E7D4F" : "#E6C766"}`, color: info && !info.ok ? "#7A0F1E" : info ? "#1F6B42" : "#6B4E00", borderRadius: 10, padding: "10px 14px", fontSize: 13, lineHeight: 1.5, margin: "10px 14px", fontFamily: "'Inter', system-ui, sans-serif", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 200 }}>
        {info ? <>{info.ok ? "✅ " : "⚠️ "}{info.texte}</> : <>⏳ <b>{restant} envoi{restant > 1 ? "s" : ""} en attente sur cet appareil</b> (la base de données est saturée). Il sera transmis automatiquement : garde ce navigateur et rouvre le site plus tard (la limite se remet à zéro dans la nuit).</>}
      </span>
      {info ? <button type="button" onClick={() => setInfo(null)} style={{ background: "none", border: "none", textDecoration: "underline", cursor: "pointer", color: "inherit", fontSize: 13 }}>Fermer</button> : <button type="button" onClick={traiter} style={{ background: "none", border: "none", textDecoration: "underline", cursor: "pointer", color: "inherit", fontSize: 13 }}>Réessayer maintenant</button>}
    </div>
  ) : null;
  return bandeau;
}
