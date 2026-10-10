// composants/Avatar.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useEffect, useState } from "react";

// Photos (tête du personnage) Roblox : une seule requête pour plusieurs comptes, avec mémoire
const AVATAR_CACHE = {};
export function useAvatars(ids) {
  const [, forcer] = useState(0);
  const cle = Array.from(new Set(ids.filter(Boolean))).sort().join(",");
  useEffect(() => {
    const manquants = cle.split(",").filter((i) => i && !(i in AVATAR_CACHE));
    if (!manquants.length) return undefined;
    let off = false;
    (async () => {
      for (let i = 0; i < manquants.length; i += 50) {
        const lot = manquants.slice(i, i + 50);
        try {
          const r = await fetch(`/api/roblox-head?ids=${lot.join(",")}`);
          const j = await r.json();
          lot.forEach((id) => { AVATAR_CACHE[id] = (j.images && j.images[id]) || ""; });
        } catch (e) { lot.forEach((id) => { AVATAR_CACHE[id] = ""; }); }
      }
      if (!off) forcer((n) => n + 1);
    })();
    return () => { off = true; };
  }, [cle]);
  return AVATAR_CACHE;
}
export function Avatar({ src, taille = 44 }) {
  return (
    <div style={{ width: taille, height: taille, borderRadius: 10, background: "linear-gradient(180deg, #3b3e45, #2a2d33)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#9aa0ab", fontSize: taille / 2.6 }}>?</span>}
    </div>
  );
}
