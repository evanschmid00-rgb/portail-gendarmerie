// api/_concours.js — Rôle « Concours … validé(e) » selon le poste de la candidature acceptée (le « _ » = ce n'est pas une page de l'API).
// Cherche, parmi les rôles du serveur, ceux dont le nom contient « concours », « valid » et le sigle du poste (SOG ou GAV).
// Si plusieurs rôles correspondent (ex. un SOG externe et un SOG interne), on choisit selon que la candidature vient d'un gendarme connecté (interne) ou non (externe).
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function rolesConcours(roles, poste, interne) {
  const p = norm(poste);
  const cles = [];
  if (/\bgav\b/.test(p)) cles.push("gav");
  if (/\bsog\b/.test(p)) cles.push("sog");
  const trouves = [];
  for (const cle of cles) {
    let ok = (roles || []).filter((r) => { const n = norm(r.name); return n.includes("concours") && n.includes("valid") && new RegExp(`\\b${cle}\\b`).test(n); });
    if (ok.length > 1) {
      const voulu = interne ? "intern" : "extern";
      const filtre = ok.filter((r) => norm(r.name).includes(voulu));
      ok = filtre.length ? filtre : ok.slice(0, 1);
    }
    trouves.push(...ok);
  }
  return trouves;
}
