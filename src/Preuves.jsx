// composants/Preuves.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useState } from "react";
import { smallBtn } from "./ui.jsx";
import { MAX_LIENS, MAX_PHOTOS, compresserImage, hoteDe, typeDeLien, urlValide } from "../lib/preuves.js";

export function PreuvesEditeur({ preuves, onChange }) {
  const [lien, setLien] = useState("");
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  const nbPhotos = preuves.filter((p) => p.data).length;
  const nbLiens = preuves.filter((p) => p.url).length;

  function ajouterLien() {
    const u = urlValide(lien);
    if (!u) { setErreur("Ce lien n'est pas valide : il doit commencer par https://"); return; }
    if (nbLiens >= MAX_LIENS) { setErreur(`Tu peux ajouter ${MAX_LIENS} liens au maximum.`); return; }
    if (preuves.some((p) => p.url === u)) { setErreur("Ce lien est déjà ajouté."); return; }
    onChange([...preuves, { type: typeDeLien(u), url: u }]);
    setLien(""); setErreur("");
  }
  async function ajouterPhotos(e) {
    const fichiers = Array.from(e.target.files || []);
    e.target.value = "";
    if (!fichiers.length) return;
    setBusy(true); setErreur("");
    let courant = [...preuves];
    for (const f of fichiers) {
      if (courant.filter((p) => p.data).length >= MAX_PHOTOS) { setErreur(`Tu peux ajouter ${MAX_PHOTOS} photos au maximum (utilise un lien pour le reste).`); break; }
      try { courant = [...courant, { type: "image", data: await compresserImage(f), nom: f.name.slice(0, 60) }]; }
      catch (err) { setErreur(`« ${f.name} » n'a pas pu être ajoutée (image uniquement, ou fichier illisible).`); }
    }
    onChange(courant);
    setBusy(false);
  }
  const retirer = (i) => onChange(preuves.filter((_, k) => k !== i));
  const champ = { padding: "9px 11px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, boxSizing: "border-box", flex: 1, minWidth: 0 };

  return (
    <div style={{ background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 14 }}>
      {preuves.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {preuves.map((p, i) => (
            <div key={i} style={{ position: "relative", background: "#fff", border: "1px solid #C3D0E2", borderRadius: 8, overflow: "hidden", width: p.data ? 110 : "auto", maxWidth: 240 }}>
              {p.data ? <img src={p.data} alt={p.nom || "preuve"} style={{ width: 110, height: 80, objectFit: "cover", display: "block" }} />
                : <div style={{ padding: "8px 30px 8px 10px", fontSize: 12.5 }}>{p.type === "video" ? "▶ Vidéo" : p.type === "image" ? "🖼 Image" : "🔗 Lien"} · <span style={{ color: "#5A6B84" }}>{hoteDe(p.url)}</span></div>}
              <button type="button" onClick={() => retirer(i)} aria-label="Retirer" style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(20,33,58,0.75)", color: "#fff", fontSize: 12, cursor: "pointer", lineHeight: "20px", padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input value={lien} onChange={(e) => setLien(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterLien(); } }} placeholder="Colle un lien (YouTube, Medal, Streamable, Imgur, Drive…)" style={champ} />
        <button type="button" onClick={ajouterLien} style={smallBtn}>+ Ajouter le lien</button>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ ...smallBtn, display: "inline-block", cursor: busy || nbPhotos >= MAX_PHOTOS ? "not-allowed" : "pointer", opacity: nbPhotos >= MAX_PHOTOS ? 0.5 : 1 }}>
          📷 Ajouter des photos ({nbPhotos}/{MAX_PHOTOS})
          <input type="file" accept="image/*" multiple disabled={busy || nbPhotos >= MAX_PHOTOS} onChange={ajouterPhotos} style={{ display: "none" }} />
        </label>
        {busy && <span style={{ fontSize: 12.5, color: "#5A6B84" }}>Compression des photos…</span>}
      </div>
      {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginTop: 8 }}>{erreur}</div>}
      <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 10, lineHeight: 1.55 }}>
        <b>Photos :</b> jusqu'à {MAX_PHOTOS}, réduites automatiquement. <b>Vidéos :</b> trop lourdes pour être envoyées ici ; mets-les en ligne (YouTube en « non répertorié », Medal, Streamable, Google Drive avec partage par lien…) puis colle le lien. N'envoie que des éléments en rapport avec les faits.
      </div>
    </div>
  );
}

// Affichage des preuves (photos envoyées, liens). Les images distantes ne se chargent qu'au clic, pour ne pas exposer l'adresse IP du lecteur.
export function PreuvesAffichage({ preuves }) {
  const [zoom, setZoom] = useState(null);
  const [ouvertes, setOuvertes] = useState({});
  const liste = Array.isArray(preuves) ? preuves : [];
  if (!liste.length) return null;
  const lienStyle = { display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #C3D0E2", borderRadius: 8, padding: "7px 11px", fontSize: 12.5, color: "#123A7A", textDecoration: "none", fontWeight: 600 };
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
      {liste.map((p, i) => {
        if (p.data) return <img key={i} src={p.data} alt={p.nom || "preuve"} onClick={() => setZoom(p.data)} style={{ width: 120, height: 88, objectFit: "cover", borderRadius: 8, border: "1px solid #C3D0E2", cursor: "zoom-in" }} />;
        const u = urlValide(p.url);
        if (!u) return null;
        if (p.type === "image" && ouvertes[i]) return <img key={i} src={u} alt="preuve" referrerPolicy="no-referrer" onClick={() => setZoom(u)} style={{ width: 120, height: 88, objectFit: "cover", borderRadius: 8, border: "1px solid #C3D0E2", cursor: "zoom-in" }} />;
        if (p.type === "image") return <button key={i} type="button" onClick={() => setOuvertes({ ...ouvertes, [i]: true })} style={{ ...lienStyle, cursor: "pointer" }}>🖼 Afficher l'image · <span style={{ color: "#5A6B84", fontWeight: 400 }}>{hoteDe(u)}</span></button>;
        return <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={lienStyle}>{p.type === "video" ? "▶ Vidéo" : "🔗 Lien"} · <span style={{ color: "#5A6B84", fontWeight: 400 }}>{hoteDe(u)}</span> ↗</a>;
      })}
      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, background: "rgba(7,20,46,0.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <img src={zoom} alt="preuve" referrerPolicy="no-referrer" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
