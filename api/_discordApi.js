// api/_discordApi.js — Appels à Discord qui réessaient tout seuls (limites de débit 429, pannes passagères 5xx).
// Le « _ » au début = ce n'est pas une page de l'API.

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

export async function discordFetch(url, options = {}, essais = 3) {
  let r = null;
  for (let i = 0; i < essais; i++) {
    const dernier = i === essais - 1;
    try { r = await fetch(url, options); } catch (e) { if (dernier) throw e; await attendre(400 * (i + 1)); continue; }
    if (r.status === 429 && !dernier) {
      let ms = 1000;
      try { const j = await r.clone().json(); ms = Math.min(3500, Math.ceil((Number(j.retry_after) || 1) * 1000) + 100); } catch (e) { /* délai par défaut */ }
      await attendre(ms);
      continue;
    }
    if (r.status >= 500 && !dernier) { await attendre(500 * (i + 1)); continue; }
    return r;
  }
  return r;
}

export const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// « @Pseudo#1234 » → « pseudo » : on compare des pseudos Discord sans @, sans ancien discriminant, sans accents ni majuscules
export const pseudoNet = (s) => sansAccents(String(s || "").replace(/^@/, "").split("#")[0]);
