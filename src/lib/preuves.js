// lib/preuves.js — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)


/* ---------- Preuves : photos, vidéos (liens) et autres liens ---------- */

export const MAX_PHOTOS = 4;
export const MAX_LIENS = 6;
const MAX_OCTETS_PHOTO = 200 * 1024; // chaque photo est réduite à ~200 Ko pour tenir dans la base de données

export function urlValide(s) {
  try { const u = new URL(String(s || "").trim()); return u.protocol === "https:" || u.protocol === "http:" ? u.href : ""; } catch (e) { return ""; }
}
export function typeDeLien(url) {
  const u = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp)(\?|#|$)/.test(u) || /(cdn\.discordapp\.com|media\.discordapp\.net|i\.imgur\.com|i\.ibb\.co|prnt\.sc)/.test(u)) return "image";
  if (/(youtube\.com|youtu\.be|medal\.tv|streamable\.com|twitch\.tv|vimeo\.com|\.mp4|\.webm|\.mov)/.test(u)) return "video";
  return "lien";
}
export const hoteDe = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return url; } };

function lireFichierImage(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = r.result; };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
// Réduit une photo (taille et qualité) pour qu'elle pèse moins de ~200 Ko
export async function compresserImage(file) {
  if (!/^image\//.test(file.type)) throw new Error("type");
  const img = await lireFichierImage(file);
  let max = 1280, q = 0.78;
  for (let i = 0; i < 9; i++) {
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * ratio)); c.height = Math.max(1, Math.round(img.height * ratio));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL("image/jpeg", q);
    if (data.length * 0.75 <= MAX_OCTETS_PHOTO) return data;
    if (q > 0.5) q -= 0.1; else max = Math.round(max * 0.8);
  }
  throw new Error("trop lourde");
}
