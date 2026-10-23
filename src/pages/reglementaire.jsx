// pages/reglementaire.jsx — « Équipement réglementaire » et « Tenue réglementaire » : fiches lisibles par tous les gendarmes,
// créées et modifiées par les admins et le Corps de Commandement, avec photos.
// Données : collection reglementaire_items (champ type = "equipement" | "tenue").
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Field, h2Style, smallBtn } from "../composants/ui.jsx";
import { db } from "../firebase";
import { peutGererEquipement } from "../lib/droits.js";
import { ContenuFiche } from "./formation.jsx";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const BLEU = "#123A7A";
const TAILLE_MAX_IMAGES = 750000; // un document Firestore ne dépasse pas 1 Mo

const CONFIG = {
  equipement: {
    emoji: "🎒",
    titre: "Équipement réglementaire",
    intro: "L'équipement que chaque gendarme doit porter ou avoir à bord en service.",
    categories: ["Armement", "Protection", "Transmission", "Véhicule", "Documents"],
    ajouter: "+ Ajouter un équipement",
    vide: "Aucun équipement n'a encore été renseigné.",
    placeholderTitre: "Ex : Gilet pare-balles",
    placeholderDescription: "Quand le porter, comment le vérifier, règles d'utilisation…",
  },
  tenue: {
    emoji: "👮",
    titre: "Tenue réglementaire",
    intro: "Les tenues réglementaires, avec photos : vérifie que ta tenue est conforme avant de prendre ton service.",
    categories: ["Tenue de service", "Tenue d'intervention", "Tenue de cérémonie", "Tenue de sortie"],
    ajouter: "+ Ajouter une tenue",
    vide: "Aucune tenue n'a encore été renseignée.",
    placeholderTitre: "Ex : Tenue de service quotidienne",
    placeholderDescription: "Pièces de la tenue, grades concernés, quand la porter…",
  },
};

function compresser(file, max = 1000, qualite = 0.72) {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onerror = () => ko(new Error("Lecture impossible"));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => ko(new Error("Image illisible"));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL("image/jpeg", qualite));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

// Photo avec repli : si le lien est mort (ex : lien Discord expiré), on affiche un message au lieu d'une case vide.
// referrerPolicy="no-referrer" évite le blocage de certains hébergeurs d'images quand elles sont affichées sur un autre site.
function Photo({ src, alt, style, onClick, titre }) {
  const [casse, setCasse] = useState(false);
  useEffect(() => { setCasse(false); }, [src]);
  if (casse) {
    return (
      <div style={{ ...style, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "#EEF2F8", color: "#5A6B84", fontSize: 12, textAlign: "center", padding: 10, minHeight: 90, cursor: "default" }}>
        <span style={{ fontSize: 26 }}>🖼️</span>Photo indisponible<span style={{ fontSize: 10.5 }}>(lien expiré ou bloqué)</span>
      </div>
    );
  }
  return <img src={src} alt={alt || titre || ""} referrerPolicy="no-referrer" loading="lazy" onError={() => setCasse(true)} onClick={onClick} style={style} />;
}
const lienEphemere = (u) => /(?:cdn\.discordapp\.com|media\.discordapp\.net)/i.test(u) || /[?&](?:ex|expires?)=/i.test(u);

const tailleImages = (imgs) => (imgs || []).reduce((s, im) => s + String(im.src || "").length, 0);
const zone = { width: "100%", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: FONT, lineHeight: 1.5, resize: "vertical", background: "#fff" };
const champ = { boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 10, padding: "9px 11px", fontSize: 13, fontFamily: FONT, background: "#fff" };

export function ReglementairePage({ type, current }) {
  const cfg = CONFIG[type] || CONFIG.equipement;
  const canEdit = peutGererEquipement(current);
  const [items, setItems] = useState([]);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState("");
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState(null);
  const [urlImage, setUrlImage] = useState("");
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("");
  const [ouverts, setOuverts] = useState({});
  const [zoom, setZoom] = useState("");

  async function recharger() {
    try {
      const s = await getDocs(collection(db, "reglementaire_items"));
      const liste = s.docs.map((d) => ({ ...d.data(), id: d.id })).filter((x) => x.type === type)
        .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
      setItems(liste);
      setErreur("");
    } catch (e) { console.error(e); setErreur("Impossible de charger cette page (droits ou connexion)."); }
    setCharge(true);
  }
  useEffect(() => { recharger(); }, [type]);

  const nomCat = (x) => (x.categorie || "").trim() || "Autres";
  const categoriesPresentes = Array.from(new Set(items.map(nomCat)));
  const q = recherche.trim().toLowerCase();
  const visibles = items.filter((x) => (!categorie || nomCat(x) === categorie) && (!q || `${x.titre} ${x.description} ${x.categorie}`.toLowerCase().includes(q)));
  const groupes = categoriesPresentes.filter((c) => visibles.some((x) => nomCat(x) === c));

  async function deplacer(item, sens) {
    const voisins = items.filter((x) => nomCat(x) === nomCat(item));
    const i = voisins.findIndex((x) => x.id === item.id);
    const autre = voisins[i + sens];
    if (!autre) return;
    // On échange les rangs des deux fiches ; si elles ont le même rang (anciennes données), on renumérote tout le groupe
    let a = item.ordre ?? 0;
    let b = autre.ordre ?? 0;
    if (a === b) { a = i; b = i + sens; }
    try {
      await Promise.all([updateDoc(doc(db, "reglementaire_items", item.id), { ordre: b }), updateDoc(doc(db, "reglementaire_items", autre.id), { ordre: a })]);
      recharger();
    } catch (e) { console.error(e); setMsg("Échec du déplacement."); }
  }

  async function sauver(e) {
    e.preventDefault();
    if (!String(edit.titre || "").trim()) { setMsg("Donne un titre."); return; }
    if (tailleImages(edit.images) > TAILLE_MAX_IMAGES) { setMsg("Les photos sont trop lourdes : retires-en une ou utilise des liens d'images au lieu de fichiers."); return; }
    const champs = { type, titre: edit.titre.trim(), categorie: (edit.categorie || "").trim(), description: edit.description || "", images: edit.images || [], updatedAt: new Date().toISOString() };
    try {
      if (edit.id) await updateDoc(doc(db, "reglementaire_items", edit.id), champs);
      else await addDoc(collection(db, "reglementaire_items"), { ...champs, ordre: Math.max(-1, ...items.map((x) => x.ordre ?? 0)) + 1, createdAt: new Date().toISOString() });
      setEdit(null); setMsg(""); recharger();
    } catch (err) { console.error(err); setMsg("Échec de l'enregistrement (fiche trop volumineuse ou droits insuffisants)."); }
  }
  async function supprimer(item) {
    if (!window.confirm(`Supprimer « ${item.titre} » ?`)) return;
    try { await deleteDoc(doc(db, "reglementaire_items", item.id)); recharger(); } catch (err) { console.error(err); setMsg("Échec de la suppression."); }
  }
  async function ajouterFichier(ev) {
    const fichier = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!fichier) return;
    try {
      const src = await compresser(fichier);
      setEdit((f) => ({ ...f, images: [...(f.images || []), { src, legende: "" }] }));
      setMsg("");
    } catch (err) { setMsg("Image impossible à lire."); }
  }
  function ajouterUrl() {
    const u = urlImage.trim();
    if (!/^https?:\/\//i.test(u)) { setMsg("Le lien de l'image doit commencer par http:// ou https://"); return; }
    setEdit((f) => ({ ...f, images: [...(f.images || []), { src: u, legende: "" }] }));
    setUrlImage("");
    setMsg(lienEphemere(u) ? "⚠️ Ce lien (Discord ou lien temporaire) cessera de fonctionner au bout de quelques jours : les gendarmes ne verront plus la photo. Préfère « Ajouter une photo (fichier) » ou un lien Imgur." : "");
  }

  const bouton = { ...smallBtn, padding: "4px 9px" };
  const suggestions = Array.from(new Set([...cfg.categories, ...categoriesPresentes.filter((c) => c !== "Autres")]));

  return (
    <div style={{ fontFamily: FONT, maxWidth: 1000 }}>
      <h2 style={h2Style}>{cfg.emoji} {cfg.titre}</h2>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 16, lineHeight: 1.5 }}>{cfg.intro}</div>

      {erreur && <div style={{ background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>{erreur}</div>}
      {msg && <div style={{ background: "#FFF6E0", border: "1px solid #F0D58A", color: "#5C4300", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔎 Rechercher" style={{ ...champ, flex: "1 1 220px" }} />
        {canEdit && <button type="button" onClick={() => { setEdit({ titre: "", categorie: categorie || "", description: "", images: [] }); setMsg(""); }} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>{cfg.ajouter}</button>}
      </div>

      {categoriesPresentes.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {["", ...categoriesPresentes].map((c) => (
            <button key={c || "toutes"} type="button" onClick={() => setCategorie(c)} style={{ ...smallBtn, background: categorie === c ? BLEU : "transparent", color: categorie === c ? "#fff" : "#14213A", borderColor: categorie === c ? BLEU : "#C3D0E2" }}>{c || "Toutes"}</button>
          ))}
        </div>
      )}

      {edit && (
        <form onSubmit={sauver} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 18, boxShadow: "0 6px 20px -12px rgba(7,20,46,0.3)", marginBottom: 20 }}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>{edit.id ? "Modifier la fiche" : "Nouvelle fiche"}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}><Field label="Titre" value={edit.titre} onChange={(v) => setEdit({ ...edit, titre: v })} placeholder={cfg.placeholderTitre} /></div>
            <div style={{ flex: "1 1 220px" }}>
              <Field label="Catégorie" value={edit.categorie} onChange={(v) => setEdit({ ...edit, categorie: v })} placeholder="Choisis ou écris la tienne" />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "-6px 0 10px" }}>
                {suggestions.map((s) => <button key={s} type="button" onClick={() => setEdit({ ...edit, categorie: s })} style={{ ...smallBtn, padding: "2px 8px", fontSize: 11 }}>{s}</button>)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#14213A", marginBottom: 4 }}>Description</div>
          <div style={{ fontSize: 11.5, color: "#5A6B84", marginBottom: 5, lineHeight: 1.5 }}>Mise en forme : <code># Grand titre</code> · <code>## Sous-titre</code> · <code>- puce</code> · <code>&gt; remarque encadrée</code> · <code>**gras**</code> · une ligne vide sépare les paragraphes.</div>
          <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={8} placeholder={cfg.placeholderDescription} style={{ ...zone, marginBottom: 14 }} />

          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#14213A", marginBottom: 6 }}>📷 Photos</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <label style={{ ...smallBtn, cursor: "pointer", display: "inline-block" }}>
              Ajouter une photo (fichier)
              <input type="file" accept="image/*" onChange={ajouterFichier} style={{ display: "none" }} />
            </label>
            <input value={urlImage} onChange={(e) => setUrlImage(e.target.value)} placeholder="…ou colle un lien d'image (https://)" style={{ ...zone, width: "auto", flex: "1 1 240px", resize: "none" }} />
            <button type="button" onClick={ajouterUrl} style={smallBtn}>Ajouter le lien</button>
          </div>
          <div style={{ fontSize: 11, color: "#5A6B84", marginBottom: 8 }}>Les photos envoyées sont réduites automatiquement. Espace utilisé : {Math.round(tailleImages(edit.images) / 1000)} Ko / {Math.round(TAILLE_MAX_IMAGES / 1000)} Ko. La première photo sert d'image de couverture. Pour beaucoup de photos, préfère des liens.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10, marginBottom: 14 }}>
            {(edit.images || []).map((im, i) => (
              <div key={i} style={{ border: "1px solid #D3DDEA", borderRadius: 10, padding: 6, background: "#F9FBFE" }}>
                <Photo src={im.src} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 6, display: "block" }} />
                <input value={im.legende || ""} onChange={(e) => setEdit({ ...edit, images: edit.images.map((x, k) => (k === i ? { ...x, legende: e.target.value } : x)) })} placeholder="Légende (facultatif)" style={{ ...zone, margin: "6px 0", padding: "5px 7px", fontSize: 12, resize: "none" }} />
                <div style={{ display: "flex", gap: 5 }}>
                  {i > 0 && <button type="button" onClick={() => { const a = edit.images.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; setEdit({ ...edit, images: a }); }} style={{ ...smallBtn, flex: 1 }} title="Avancer">←</button>}
                  <button type="button" onClick={() => setEdit({ ...edit, images: edit.images.filter((_, k) => k !== i) })} style={{ ...smallBtn, flex: 2, color: "#C0172D", borderColor: "#C0172D" }}>Retirer</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Enregistrer</button>
            <button type="button" onClick={() => { setEdit(null); setMsg(""); }} style={smallBtn}>Annuler</button>
          </div>
        </form>
      )}

      {!charge && <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement…</div>}
      {charge && !erreur && items.length === 0 && !edit && <div style={{ color: "#5A6B84", fontSize: 13, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18 }}>{cfg.vide}{canEdit ? " Clique sur « Ajouter » pour commencer." : ""}</div>}
      {charge && items.length > 0 && visibles.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucune fiche ne correspond à ta recherche.</div>}

      {groupes.map((cat) => {
        const liste = visibles.filter((x) => nomCat(x) === cat);
        return (
          <div key={cat} style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 6, borderBottom: "2px solid #D3DDEA" }}>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#14213A" }}>{cat}</span>
              <span style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600 }}>{liste.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16, alignItems: "start" }}>
              {liste.map((x, i) => {
                const imgs = x.images || [];
                const ouvert = !!ouverts[x.id];
                return (
                  <div key={x.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, overflow: "hidden", boxShadow: "0 6px 20px -12px rgba(7,20,46,0.35)" }}>
                    {imgs.length > 0 ? (
                      <div style={{ position: "relative", background: "#E9EFF7" }}>
                        <Photo src={imgs[0].src} alt={imgs[0].legende || x.titre} onClick={() => setZoom(imgs[0].src)} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block", cursor: "zoom-in" }} />
                        {imgs.length > 1 && <span style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(7,20,46,0.78)", color: "#fff", fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "2px 9px" }}>📷 {imgs.length}</span>}
                      </div>
                    ) : type === "tenue" ? (
                      <div style={{ aspectRatio: "4 / 3", background: "linear-gradient(135deg, #E9EFF7, #D3DDEA)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54 }}>{cfg.emoji}</div>
                    ) : null}
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "#14213A", lineHeight: 1.25 }}>{x.titre}</div>
                      {!ouvert && x.description && <div style={{ fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.5, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.description.replace(/[#>*-]/g, "").trim()}</div>}
                      {ouvert && (
                        <div style={{ marginTop: 10 }}>
                          <ContenuFiche texte={x.description} />
                          {imgs.length > 1 && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginTop: 8 }}>
                              {imgs.slice(1).map((im, k) => (
                                <figure key={k} style={{ margin: 0 }}>
                                  <Photo src={im.src} alt={im.legende || x.titre} onClick={() => setZoom(im.src)} style={{ width: "100%", borderRadius: 8, border: "1px solid #D3DDEA", cursor: "zoom-in", display: "block" }} />
                                  {im.legende && <figcaption style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 3 }}>{im.legende}</figcaption>}
                                </figure>
                              ))}
                            </div>
                          )}
                          {imgs[0] && imgs[0].legende && <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 8 }}>📷 {imgs[0].legende}</div>}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                        {(x.description || imgs.length > 1) && <button type="button" onClick={() => setOuverts({ ...ouverts, [x.id]: !ouvert })} style={smallBtn}>{ouvert ? "▲ Réduire" : "Voir le détail"}</button>}
                        {canEdit && (
                          <>
                            <div style={{ flex: 1 }} />
                            <button type="button" onClick={() => deplacer(x, -1)} disabled={i === 0} style={bouton} title="Avancer">↑</button>
                            <button type="button" onClick={() => deplacer(x, 1)} disabled={i === liste.length - 1} style={bouton} title="Reculer">↓</button>
                            <button type="button" onClick={() => { setEdit({ ...x, images: x.images || [] }); setMsg(""); window.scrollTo(0, 0); }} style={bouton}>Modifier</button>
                            <button type="button" onClick={() => supprimer(x)} style={{ ...bouton, color: "#C0172D", borderColor: "#C0172D" }}>Suppr.</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {zoom && (
        <div onClick={() => setZoom("")} style={{ position: "fixed", inset: 0, background: "rgba(7,20,46,0.88)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <img src={zoom} alt="" referrerPolicy="no-referrer" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}
