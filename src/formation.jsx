// pages/formation.jsx — Formation PULSAR : livres et fiches de formation (lecture pour tous les gendarmes),
// gestion des livres/fiches + suivi des recrues (admins), bandeau de rappel pour les recrues.
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { PseudosAgent } from "../composants/Pseudos.jsx";
import { Field, h2Style, smallBtn } from "../composants/ui.jsx";
import { db } from "../firebase";
import { DELAI_DEFAUT_JOURS, ROLE_EFFECTUEE, ROLE_ENTRETIEN, ROLE_NON_EFFECTUEE, dateFinDelai, estEnEntretien, estEnFormation, joursRestants, peutVoirFiches } from "../lib/formation.js";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const BLEU = "#123A7A";
const trierOrdre = (a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));

async function chargerContenu() {
  const [l, f] = await Promise.all([getDocs(collection(db, "formation_livres")), getDocs(collection(db, "formation_fiches"))]);
  return {
    livres: l.docs.map((d) => ({ ...d.data(), id: d.id })).sort(trierOrdre),
    fiches: f.docs.map((d) => ({ ...d.data(), id: d.id })).sort(trierOrdre),
  };
}
async function chargerDelai() {
  try {
    const s = await getDoc(doc(db, "settings", "formation"));
    const n = s.exists() ? Number(s.data().delaiJours) : NaN;
    return n > 0 ? n : DELAI_DEFAUT_JOURS;
  } catch (e) { return DELAI_DEFAUT_JOURS; }
}

/* ---------- Affichage du contenu d'une fiche (mini-mise en forme) ---------- */

function Gras({ t }) {
  return String(t).split(/\*\*(.+?)\*\*/g).map((x, i) => (i % 2 ? <b key={i}>{x}</b> : <React.Fragment key={i}>{x}</React.Fragment>));
}

export function ContenuFiche({ texte }) {
  const blocs = [];
  let liste = [];
  const vider = () => {
    if (liste.length) {
      blocs.push(<ul key={`u${blocs.length}`} style={{ margin: "6px 0 12px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>{liste.map((x, i) => <li key={i} style={{ fontSize: 14, color: "#14213A", lineHeight: 1.6 }}><Gras t={x} /></li>)}</ul>);
      liste = [];
    }
  };
  String(texte || "").split("\n").forEach((brut) => {
    const l = brut.trimEnd();
    if (/^\s*[-•]\s+/.test(l)) { liste.push(l.replace(/^\s*[-•]\s+/, "")); return; }
    vider();
    const k = `b${blocs.length}`;
    if (!l.trim()) return;
    if (l.startsWith("## ")) blocs.push(<h4 key={k} style={{ fontSize: 15, fontWeight: 800, color: BLEU, margin: "16px 0 6px" }}>{l.slice(3)}</h4>);
    else if (l.startsWith("# ")) blocs.push(<h3 key={k} style={{ fontSize: 18, fontWeight: 800, color: "#14213A", margin: "20px 0 8px", paddingBottom: 4, borderBottom: "2px solid #E3EAF4" }}>{l.slice(2)}</h3>);
    else if (l.startsWith("> ")) blocs.push(<div key={k} style={{ background: "#FFF6E0", border: "1px solid #F0D58A", borderLeft: "4px solid #E0A23A", borderRadius: 8, padding: "9px 12px", margin: "8px 0", fontSize: 13.5, color: "#5C4300", lineHeight: 1.55 }}>💡 <Gras t={l.slice(2)} /></div>);
    else blocs.push(<p key={k} style={{ margin: "0 0 10px", fontSize: 14, color: "#14213A", lineHeight: 1.65 }}><Gras t={l} /></p>);
  });
  vider();
  return <div>{blocs}</div>;
}

/* ---------- Lecture : livres et fiches (tous les gendarmes, sauf « en entretien de recrutement ») ---------- */

export function FormationPage({ current }) {
  const [etat, setEtat] = useState({ charge: false, erreur: "" });
  const [livres, setLivres] = useState([]);
  const [fiches, setFiches] = useState([]);
  const [lues, setLues] = useState([]);
  const [delai, setDelai] = useState(DELAI_DEFAUT_JOURS);
  const [livreId, setLivreId] = useState("");
  const [ficheId, setFicheId] = useState("");
  const [zoom, setZoom] = useState("");
  const autorise = peutVoirFiches(current);

  useEffect(() => {
    if (!autorise) return;
    let vivant = true;
    (async () => {
      try {
        const [c, p, d] = await Promise.all([chargerContenu(), getDoc(doc(db, "formation_progres", current.id)), chargerDelai()]);
        if (!vivant) return;
        setLivres(c.livres); setFiches(c.fiches); setDelai(d);
        setLues(p.exists() && Array.isArray(p.data().lues) ? p.data().lues : []);
        setEtat({ charge: true, erreur: "" });
      } catch (e) {
        console.error(e);
        if (vivant) setEtat({ charge: true, erreur: "Impossible de charger les fiches (droits ou connexion)." });
      }
    })();
    return () => { vivant = false; };
  }, [autorise, current.id]);

  if (!autorise) {
    return (
      <div>
        <h2 style={h2Style}>Formation PULSAR</h2>
        <div style={{ background: "#FFF6E0", border: "1px solid #F0D58A", borderRadius: 14, padding: "22px 22px", maxWidth: 560 }}>
          <div style={{ fontSize: 26 }}>🗣️</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#5C4300", margin: "4px 0" }}>Tu es en entretien de recrutement</div>
          <div style={{ fontSize: 13.5, color: "#5C4300", lineHeight: 1.55 }}>Les fiches de formation ne sont plus consultables pendant l'entretien. Bonne chance !</div>
        </div>
      </div>
    );
  }

  const fichesDe = (id) => fiches.filter((f) => f.livreId === id);
  const idsFiches = new Set(fiches.map((f) => f.id));
  const nbLues = (id) => fichesDe(id).filter((f) => lues.includes(f.id)).length;
  const livre = livres.find((l) => l.id === livreId);
  const listeFiches = livre ? fichesDe(livre.id) : [];
  const fiche = listeFiches.find((f) => f.id === ficheId) || listeFiches[0];
  const iFiche = fiche ? listeFiches.findIndex((f) => f.id === fiche.id) : -1;
  const totalLues = lues.filter((id) => idsFiches.has(id)).length;

  async function basculerLue(id) {
    const arr = lues.includes(id) ? lues.filter((x) => x !== id) : [...lues, id];
    setLues(arr);
    try { await setDoc(doc(db, "formation_progres", current.id), { lues: arr, updatedAt: new Date().toISOString() }); } catch (e) { console.error(e); }
  }

  const reste = estEnFormation(current) && !current.isAdmin ? joursRestants(current, delai) : null;

  return (
    <div style={{ fontFamily: FONT }}>
      <h2 style={h2Style}>Formation PULSAR</h2>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 16, lineHeight: 1.5 }}>Tous les livres et fiches de formation de la Gendarmerie. Marque chaque fiche comme lue pour suivre ta progression.</div>

      {reste !== null && (
        <div style={{ background: reste >= 0 ? "#E6EDF7" : "#FBE3E7", border: `1px solid ${reste >= 0 ? "#9FB6D8" : "#C0172D"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontSize: 13.5, color: "#14213A", lineHeight: 1.5 }}>
          🎓 <b>Formation PULSAR non-effectuée.</b> {reste >= 0 ? <>Il te reste <b>{reste} jour{reste > 1 ? "s" : ""}</b> (jusqu'au {dateFinDelai(current, delai)}) pour apprendre les fiches avant ton entretien.</> : <>Le délai est dépassé de <b>{-reste} jour{-reste > 1 ? "s" : ""}</b> : contacte le recrutement.</>}
          {idsFiches.size > 0 && <> Progression : <b>{totalLues}/{idsFiches.size}</b> fiches lues.</>}
        </div>
      )}

      {etat.erreur && <div style={{ background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>{etat.erreur}</div>}
      {!etat.charge && <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement des fiches…</div>}
      {etat.charge && !etat.erreur && livres.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun livre de formation n'est publié pour l'instant.</div>}

      {!livre && livres.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
          {livres.map((l) => {
            const total = fichesDe(l.id).length;
            const n = nbLues(l.id);
            const fini = total > 0 && n === total;
            return (
              <button key={l.id} type="button" onClick={() => { setLivreId(l.id); setFicheId(""); }} className="gh-btn-anim" style={{ textAlign: "left", cursor: "pointer", background: "#fff", border: `1px solid ${fini ? "#2E7D4F" : "#D3DDEA"}`, borderTop: `5px solid ${fini ? "#2E7D4F" : BLEU}`, borderRadius: 14, padding: "16px 16px 14px", boxShadow: "0 6px 18px -12px rgba(7,20,46,0.4)", fontFamily: FONT }}>
                <div style={{ fontSize: 34, lineHeight: 1 }}>{l.emoji || "📘"}</div>
                <div style={{ fontWeight: 800, fontSize: 15.5, color: "#14213A", margin: "8px 0 4px" }}>{l.titre}</div>
                {l.description && <div style={{ fontSize: 12.5, color: "#5A6B84", lineHeight: 1.45, marginBottom: 10 }}>{l.description}</div>}
                <div style={{ height: 7, background: "#E3EAF4", borderRadius: 4, overflow: "hidden", marginBottom: 5 }}>
                  <div style={{ width: total ? `${Math.round((n / total) * 100)}%` : "0%", height: "100%", background: fini ? "#2E7D4F" : "#2F6FDE" }} />
                </div>
                <div style={{ fontSize: 11.5, color: fini ? "#1F6B42" : "#5A6B84", fontWeight: 600 }}>{fini ? "✓ Livre terminé" : `${n}/${total} fiche${total > 1 ? "s" : ""} lue${n > 1 ? "s" : ""}`}</div>
              </button>
            );
          })}
        </div>
      )}

      {livre && (
        <div>
          <button type="button" onClick={() => setLivreId("")} style={{ ...smallBtn, marginBottom: 14 }}>← Tous les livres</button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 34 }}>{livre.emoji || "📘"}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 19, color: "#14213A" }}>{livre.titre}</div>
              {livre.description && <div style={{ fontSize: 12.5, color: "#5A6B84" }}>{livre.description}</div>}
            </div>
          </div>
          {listeFiches.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Ce livre ne contient pas encore de fiche.</div>}
          {listeFiches.length > 0 && (
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "0 0 250px", maxWidth: "100%", background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                {listeFiches.map((f, i) => {
                  const lue = lues.includes(f.id);
                  const actif = fiche && f.id === fiche.id;
                  return (
                    <button key={f.id} type="button" onClick={() => setFicheId(f.id)} style={{ display: "flex", alignItems: "center", gap: 9, textAlign: "left", background: actif ? "#E6EDF7" : "transparent", border: "none", borderLeft: `3px solid ${actif ? BLEU : "transparent"}`, borderRadius: 7, padding: "8px 9px", cursor: "pointer", fontFamily: FONT, fontSize: 13, color: "#14213A", fontWeight: actif ? 700 : 500 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: lue ? "#2E7D4F" : "#E3EAF4", color: lue ? "#fff" : "#5A6B84", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{lue ? "✓" : i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>{f.titre}</span>
                    </button>
                  );
                })}
              </div>

              {fiche && (
                <div style={{ flex: "1 1 380px", minWidth: 0, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: "20px 22px", boxShadow: "0 6px 20px -12px rgba(7,20,46,0.35)" }}>
                  <div style={{ fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700 }}>Fiche {iFiche + 1} sur {listeFiches.length}</div>
                  <div style={{ fontWeight: 800, fontSize: 22, color: "#14213A", margin: "4px 0 14px" }}>{fiche.titre}</div>
                  <ContenuFiche texte={fiche.contenu} />
                  {(fiche.images || []).length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
                      {fiche.images.map((im, i) => (
                        <figure key={i} style={{ margin: 0 }}>
                          <img src={im.src} alt={im.legende || fiche.titre} onClick={() => setZoom(im.src)} style={{ width: "100%", borderRadius: 10, border: "1px solid #D3DDEA", cursor: "zoom-in", display: "block" }} />
                          {im.legende && <figcaption style={{ fontSize: 12, color: "#5A6B84", marginTop: 4 }}>{im.legende}</figcaption>}
                        </figure>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 20, paddingTop: 14, borderTop: "1px solid #E3EAF4" }}>
                    <button type="button" onClick={() => basculerLue(fiche.id)} style={{ background: lues.includes(fiche.id) ? "#E3F2E8" : BLEU, color: lues.includes(fiche.id) ? "#1F6B42" : "#fff", border: lues.includes(fiche.id) ? "1px solid #2E7D4F" : "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: FONT }}>
                      {lues.includes(fiche.id) ? "✓ Fiche lue (annuler)" : "Marquer comme lue"}
                    </button>
                    {iFiche > 0 && <button type="button" onClick={() => setFicheId(listeFiches[iFiche - 1].id)} style={smallBtn}>← Précédente</button>}
                    {iFiche < listeFiches.length - 1 && <button type="button" onClick={() => { if (!lues.includes(fiche.id)) basculerLue(fiche.id); setFicheId(listeFiches[iFiche + 1].id); }} style={smallBtn}>Suivante →</button>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {zoom && (
        <div onClick={() => setZoom("")} style={{ position: "fixed", inset: 0, background: "rgba(7,20,46,0.88)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <img src={zoom} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}

/* ---------- Bandeau de rappel (recrues en formation / en entretien) ---------- */

export function BandeauFormation({ current, onOpen, style }) {
  const [delai, setDelai] = useState(DELAI_DEFAUT_JOURS);
  const concerne = !current.isAdmin && (estEnFormation(current) || estEnEntretien(current));
  useEffect(() => { if (concerne) chargerDelai().then(setDelai); }, [concerne]);
  if (!concerne) return null;

  const entretien = estEnEntretien(current);
  const reste = joursRestants(current, delai);
  const c = entretien ? "#6B4E00" : BLEU;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: entretien ? "#FFF6E0" : "#E6EDF7", border: `1px solid ${entretien ? "#E0C36B" : "#9FB6D8"}`, borderLeft: `6px solid ${entretien ? "#E0A23A" : BLEU}`, borderRadius: 14, padding: "12px 16px", fontFamily: FONT, ...style }}>
      <span style={{ fontSize: 28 }}>{entretien ? "🗣️" : "🎓"}</span>
      <div style={{ flex: "1 1 260px", minWidth: 0, fontSize: 13, color: "#14213A", lineHeight: 1.5 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, color: c }}>{entretien ? ROLE_ENTRETIEN : ROLE_NON_EFFECTUEE}</div>
        {entretien
          ? "Ton entretien est en cours. Tes accès au terrain (casiers, PV, service, main courante) restent verrouillés jusqu'à la validation de ta formation."
          : <>Casiers, PV, prise de service et main courante sont verrouillés jusqu'à la validation de ta formation.{reste !== null && (reste >= 0 ? <> Il te reste <b>{reste} jour{reste > 1 ? "s" : ""}</b> pour apprendre les fiches.</> : <> <b>Délai dépassé</b> : contacte le recrutement.</>)}</>}
      </div>
      {!entretien && onOpen && <button type="button" onClick={onOpen} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Ouvrir les fiches →</button>}
    </div>
  );
}

/* ---------- Gestion (admins) : livres, fiches, suivi des recrues, réglages ---------- */

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

const zone = { width: "100%", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: FONT, lineHeight: 1.5, resize: "vertical", background: "#fff" };
const carte = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 18, boxShadow: "0 6px 20px -12px rgba(7,20,46,0.3)", marginBottom: 16 };
const TAILLE_MAX_IMAGES = 750000; // un document Firestore ne dépasse pas 1 Mo

export function FormationAdmin({ current, personnel = [], onUpdate }) {
  const [onglet, setOnglet] = useState("contenu");
  const [livres, setLivres] = useState([]);
  const [fiches, setFiches] = useState([]);
  const [progres, setProgres] = useState({});
  const [delai, setDelai] = useState(DELAI_DEFAUT_JOURS);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState("");

  async function recharger() {
    try {
      const [c, p, d] = await Promise.all([chargerContenu(), getDocs(collection(db, "formation_progres")), chargerDelai()]);
      setLivres(c.livres); setFiches(c.fiches); setDelai(d);
      const m = {}; p.docs.forEach((x) => { m[x.id] = x.data(); });
      setProgres(m);
      setErreur("");
    } catch (e) { console.error(e); setErreur("Chargement impossible (droits ou connexion)."); }
    setCharge(true);
  }
  useEffect(() => { recharger(); }, []);

  if (!current.isAdmin) return <div style={{ color: "#5A6B84", fontSize: 13 }}>Réservé aux admins.</div>;

  const onglets = [["contenu", "📚 Livres et fiches"], ["suivi", "👥 Suivi des recrues"], ["reglages", "⚙️ Réglages"]];
  return (
    <div style={{ fontFamily: FONT, maxWidth: 980 }}>
      <h2 style={h2Style}>Gestion de la formation</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {onglets.map(([id, t]) => (
          <button key={id} type="button" onClick={() => setOnglet(id)} style={{ background: onglet === id ? BLEU : "#fff", color: onglet === id ? "#fff" : "#14213A", border: `1px solid ${onglet === id ? BLEU : "#C3D0E2"}`, borderRadius: 999, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>{t}</button>
        ))}
      </div>
      {erreur && <div style={{ background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>{erreur}</div>}
      {!charge && <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement…</div>}
      {charge && onglet === "contenu" && <OngletContenu livres={livres} fiches={fiches} recharger={recharger} />}
      {charge && onglet === "suivi" && <OngletSuivi personnel={personnel} fiches={fiches} progres={progres} delai={delai} onUpdate={onUpdate} />}
      {charge && onglet === "reglages" && <OngletReglages delai={delai} onSaved={(n) => setDelai(n)} />}
    </div>
  );
}

function OngletContenu({ livres, fiches, recharger }) {
  const [livreId, setLivreId] = useState("");
  const [editLivre, setEditLivre] = useState(null);
  const [editFiche, setEditFiche] = useState(null);
  const [urlImage, setUrlImage] = useState("");
  const [msg, setMsg] = useState("");
  const livre = livres.find((l) => l.id === livreId);
  const fichesLivre = livre ? fiches.filter((f) => f.livreId === livre.id) : [];

  async function deplacer(liste, item, sens, coll) {
    const arr = liste.slice();
    const i = arr.findIndex((x) => x.id === item.id);
    const j = i + sens;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await Promise.all(arr.map((x, k) => (x.ordre === k ? null : updateDoc(doc(db, coll, x.id), { ordre: k }))));
    recharger();
  }

  async function sauverLivre(e) {
    e.preventDefault();
    const d = editLivre;
    if (!String(d.titre || "").trim()) { setMsg("Donne un titre au livre."); return; }
    const champs = { titre: d.titre.trim(), emoji: (d.emoji || "📘").trim(), description: (d.description || "").trim(), updatedAt: new Date().toISOString() };
    try {
      if (d.id) await updateDoc(doc(db, "formation_livres", d.id), champs);
      else await addDoc(collection(db, "formation_livres"), { ...champs, ordre: livres.length, createdAt: new Date().toISOString() });
      setEditLivre(null); setMsg(""); recharger();
    } catch (err) { console.error(err); setMsg("Échec de l'enregistrement du livre."); }
  }
  async function supprimerLivre(l) {
    const liees = fiches.filter((f) => f.livreId === l.id);
    if (!window.confirm(`Supprimer le livre « ${l.titre} » et ses ${liees.length} fiche(s) ? Cette action est définitive.`)) return;
    try {
      for (const f of liees) await deleteDoc(doc(db, "formation_fiches", f.id));
      await deleteDoc(doc(db, "formation_livres", l.id));
      if (livreId === l.id) setLivreId("");
      recharger();
    } catch (err) { console.error(err); setMsg("Échec de la suppression."); }
  }

  const tailleImages = (imgs) => (imgs || []).reduce((s, im) => s + String(im.src || "").length, 0);
  async function sauverFiche(e) {
    e.preventDefault();
    const d = editFiche;
    if (!String(d.titre || "").trim()) { setMsg("Donne un titre à la fiche."); return; }
    if (tailleImages(d.images) > TAILLE_MAX_IMAGES) { setMsg("Les images de cette fiche sont trop lourdes : retire-en une ou utilise des liens (URL) au lieu de fichiers."); return; }
    const champs = { livreId: livre.id, titre: d.titre.trim(), contenu: d.contenu || "", images: d.images || [], updatedAt: new Date().toISOString() };
    try {
      if (d.id) await updateDoc(doc(db, "formation_fiches", d.id), champs);
      else await addDoc(collection(db, "formation_fiches"), { ...champs, ordre: fichesLivre.length, createdAt: new Date().toISOString() });
      setEditFiche(null); setMsg(""); recharger();
    } catch (err) { console.error(err); setMsg("Échec de l'enregistrement de la fiche (trop volumineuse ?)."); }
  }
  async function supprimerFiche(f) {
    if (!window.confirm(`Supprimer la fiche « ${f.titre} » ?`)) return;
    try { await deleteDoc(doc(db, "formation_fiches", f.id)); recharger(); } catch (err) { console.error(err); setMsg("Échec de la suppression."); }
  }

  async function ajouterFichier(e) {
    const fichier = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!fichier) return;
    try {
      const src = await compresser(fichier);
      setEditFiche((f) => ({ ...f, images: [...(f.images || []), { src, legende: "" }] }));
      setMsg("");
    } catch (err) { setMsg("Image impossible à lire."); }
  }
  function ajouterUrl() {
    const u = urlImage.trim();
    if (!/^https?:\/\//i.test(u)) { setMsg("Le lien de l'image doit commencer par http:// ou https://"); return; }
    setEditFiche((f) => ({ ...f, images: [...(f.images || []), { src: u, legende: "" }] }));
    setUrlImage(""); setMsg("");
  }

  const bouton = { ...smallBtn, padding: "4px 9px" };
  return (
    <div>
      {msg && <div style={{ background: "#FFF6E0", border: "1px solid #F0D58A", color: "#5C4300", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, marginBottom: 12 }}>{msg}</div>}

      {!livre && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "#5A6B84" }}>{livres.length} livre{livres.length > 1 ? "s" : ""} de formation</div>
            <button type="button" onClick={() => { setEditLivre({ titre: "", emoji: "📘", description: "" }); setMsg(""); }} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>+ Nouveau livre</button>
          </div>

          {editLivre && (
            <form onSubmit={sauverLivre} style={carte}>
              <div style={{ fontWeight: 800, marginBottom: 12 }}>{editLivre.id ? "Modifier le livre" : "Nouveau livre"}</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "0 0 90px" }}><Field label="Emoji" value={editLivre.emoji} onChange={(v) => setEditLivre({ ...editLivre, emoji: v })} placeholder="📘" /></div>
                <div style={{ flex: "1 1 260px" }}><Field label="Titre du livre" value={editLivre.titre} onChange={(v) => setEditLivre({ ...editLivre, titre: v })} placeholder="Ex : Procédures de contrôle routier" /></div>
              </div>
              <Field label="Description (facultatif)" value={editLivre.description} onChange={(v) => setEditLivre({ ...editLivre, description: v })} placeholder="À quoi sert ce livre ?" />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Enregistrer</button>
                <button type="button" onClick={() => setEditLivre(null)} style={smallBtn}>Annuler</button>
              </div>
            </form>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {livres.map((l, i) => (
              <div key={l.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${BLEU}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 28 }}>{l.emoji || "📘"}</span>
                <button type="button" onClick={() => { setLivreId(l.id); setMsg(""); }} style={{ flex: "1 1 220px", minWidth: 0, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: FONT, padding: 0 }}>
                  <span style={{ display: "block", fontWeight: 800, fontSize: 14.5, color: "#14213A" }}>{l.titre}</span>
                  <span style={{ display: "block", fontSize: 12, color: "#5A6B84" }}>{fiches.filter((f) => f.livreId === l.id).length} fiche(s){l.description ? ` · ${l.description}` : ""}</span>
                </button>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => deplacer(livres, l, -1, "formation_livres")} disabled={i === 0} style={bouton} title="Monter">↑</button>
                  <button type="button" onClick={() => deplacer(livres, l, 1, "formation_livres")} disabled={i === livres.length - 1} style={bouton} title="Descendre">↓</button>
                  <button type="button" onClick={() => { setLivreId(l.id); setMsg(""); }} style={bouton}>Fiches</button>
                  <button type="button" onClick={() => { setEditLivre({ ...l }); setMsg(""); }} style={bouton}>Modifier</button>
                  <button type="button" onClick={() => supprimerLivre(l)} style={{ ...bouton, color: "#C0172D", borderColor: "#C0172D" }}>Suppr.</button>
                </div>
              </div>
            ))}
            {livres.length === 0 && !editLivre && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun livre. Clique sur « Nouveau livre » pour commencer.</div>}
          </div>
        </div>
      )}

      {livre && (
        <div>
          <button type="button" onClick={() => { setLivreId(""); setEditFiche(null); setMsg(""); }} style={{ ...smallBtn, marginBottom: 12 }}>← Tous les livres</button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{livre.emoji || "📘"} {livre.titre}</div>
            <button type="button" onClick={() => { setEditFiche({ titre: "", contenu: "", images: [] }); setMsg(""); }} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>+ Nouvelle fiche</button>
          </div>

          {editFiche && (
            <form onSubmit={sauverFiche} style={carte}>
              <div style={{ fontWeight: 800, marginBottom: 12 }}>{editFiche.id ? "Modifier la fiche" : "Nouvelle fiche"}</div>
              <Field label="Titre de la fiche" value={editFiche.titre} onChange={(v) => setEditFiche({ ...editFiche, titre: v })} placeholder="Ex : Le contrôle d'identité" />
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#14213A", marginBottom: 4 }}>Contenu</div>
              <div style={{ fontSize: 11.5, color: "#5A6B84", marginBottom: 5, lineHeight: 1.5 }}>Mise en forme : <code># Grand titre</code> · <code>## Sous-titre</code> · <code>- puce</code> · <code>&gt; astuce encadrée</code> · <code>**gras**</code> · une ligne vide sépare les paragraphes.</div>
              <textarea value={editFiche.contenu} onChange={(e) => setEditFiche({ ...editFiche, contenu: e.target.value })} rows={12} style={{ ...zone, marginBottom: 14 }} />

              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#14213A", marginBottom: 6 }}>Photos / images</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <label style={{ ...smallBtn, cursor: "pointer", display: "inline-block" }}>
                  📷 Ajouter une photo (fichier)
                  <input type="file" accept="image/*" onChange={ajouterFichier} style={{ display: "none" }} />
                </label>
                <input value={urlImage} onChange={(e) => setUrlImage(e.target.value)} placeholder="…ou colle un lien d'image (https://)" style={{ ...zone, width: "auto", flex: "1 1 240px", resize: "none" }} />
                <button type="button" onClick={ajouterUrl} style={smallBtn}>Ajouter le lien</button>
              </div>
              <div style={{ fontSize: 11, color: "#5A6B84", marginBottom: 8 }}>Les photos envoyées sont réduites automatiquement. Taille utilisée : {Math.round(tailleImages(editFiche.images) / 1000)} Ko / {Math.round(TAILLE_MAX_IMAGES / 1000)} Ko. Pour beaucoup d'images, préfère des liens.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
                {(editFiche.images || []).map((im, i) => (
                  <div key={i} style={{ border: "1px solid #D3DDEA", borderRadius: 10, padding: 6, background: "#F9FBFE" }}>
                    <img src={im.src} alt="" style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 6, display: "block" }} />
                    <input value={im.legende || ""} onChange={(e) => setEditFiche({ ...editFiche, images: editFiche.images.map((x, k) => (k === i ? { ...x, legende: e.target.value } : x)) })} placeholder="Légende (facultatif)" style={{ ...zone, margin: "6px 0", padding: "5px 7px", fontSize: 12, resize: "none" }} />
                    <button type="button" onClick={() => setEditFiche({ ...editFiche, images: editFiche.images.filter((_, k) => k !== i) })} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D", width: "100%" }}>Retirer</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Enregistrer la fiche</button>
                <button type="button" onClick={() => { setEditFiche(null); setMsg(""); }} style={smallBtn}>Annuler</button>
              </div>
            </form>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fichesLivre.map((f, i) => (
              <div key={f.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#E6EDF7", color: BLEU, fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{f.titre}</div>
                  <div style={{ fontSize: 11.5, color: "#5A6B84" }}>{(f.images || []).length} image(s) · {String(f.contenu || "").length} caractères</div>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => deplacer(fichesLivre, f, -1, "formation_fiches")} disabled={i === 0} style={bouton}>↑</button>
                  <button type="button" onClick={() => deplacer(fichesLivre, f, 1, "formation_fiches")} disabled={i === fichesLivre.length - 1} style={bouton}>↓</button>
                  <button type="button" onClick={() => { setEditFiche({ ...f, images: f.images || [] }); setMsg(""); window.scrollTo(0, 0); }} style={bouton}>Modifier</button>
                  <button type="button" onClick={() => supprimerFiche(f)} style={{ ...bouton, color: "#C0172D", borderColor: "#C0172D" }}>Suppr.</button>
                </div>
              </div>
            ))}
            {fichesLivre.length === 0 && !editFiche && <div style={{ color: "#5A6B84", fontSize: 13 }}>Ce livre est vide. Ajoute une première fiche.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function OngletSuivi({ personnel, fiches, progres, delai, onUpdate }) {
  const [filtre, setFiltre] = useState("formation");
  const [recherche, setRecherche] = useState("");
  const [busy, setBusy] = useState("");
  const idsFiches = new Set(fiches.map((f) => f.id));
  const bas = (s) => String(s || "").toLowerCase();

  const agents = personnel.filter((p) => !p.isAdmin);
  const categorie = (p) => (estEnEntretien(p) ? "entretien" : p.statutFormation === "non-effectuee" ? "formation" : p.statutFormation === "effectuee" ? "effectuee" : "ancien");
  const compte = (c) => agents.filter((p) => categorie(p) === c).length;
  const q = bas(recherche.trim());
  const liste = agents
    .filter((p) => (filtre === "tous" ? true : categorie(p) === filtre))
    .filter((p) => !q || bas(`${p.prenom} ${p.nom} ${p.pseudoRoblox} ${p.pseudoDiscord} ${p.matricule}`).includes(q))
    .sort((a, b) => String(a.nom).localeCompare(String(b.nom)));

  async function agir(p, patch, question) {
    if (question && !window.confirm(question)) return;
    setBusy(p.id);
    await onUpdate(p.id, patch);
    setBusy("");
  }
  const maintenant = () => new Date().toISOString();
  const btn = { ...smallBtn, padding: "5px 10px", fontSize: 12 };

  const filtres = [["formation", `En formation (${compte("formation")})`], ["entretien", `En entretien (${compte("entretien")})`], ["effectuee", `Formation effectuée (${compte("effectuee")})`], ["ancien", `Agents en poste (${compte("ancien")})`], ["tous", "Tous"]];
  return (
    <div>
      <div style={{ ...carte, padding: "12px 16px", fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.6 }}>
        <b>Comment ça marche :</b> chaque nouveau gendarme reçoit automatiquement <b>« {ROLE_NON_EFFECTUEE} »</b> : il peut lire les fiches mais ne peut ni faire de casier ou de PV, ni prendre son service, ni voir la main courante.
        Quand tu le passes <b>« {ROLE_ENTRETIEN} »</b>, les fiches lui sont masquées. <b>« Valider la formation »</b> lui donne <b>« {ROLE_EFFECTUEE} »</b> et débloque tout.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {filtres.map(([id, t]) => (
          <button key={id} type="button" onClick={() => setFiltre(id)} style={{ background: filtre === id ? "#14213A" : "#fff", color: filtre === id ? "#fff" : "#14213A", border: "1px solid #C3D0E2", borderRadius: 999, padding: "6px 13px", fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: FONT }}>{t}</button>
        ))}
      </div>
      <div style={{ maxWidth: 340 }}><Field label="Rechercher un agent" value={recherche} onChange={setRecherche} placeholder="Nom, matricule, pseudo Roblox ou Discord" /></div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {liste.map((p) => {
          const cat = categorie(p);
          const lues = ((progres[p.id] && progres[p.id].lues) || []).filter((id) => idsFiches.has(id)).length;
          const reste = cat === "formation" || cat === "entretien" ? joursRestants(p, delai) : null;
          return (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${cat === "effectuee" ? "#2E7D4F" : cat === "entretien" ? "#E0A23A" : cat === "formation" ? BLEU : "#9AA8BD"}`, borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", opacity: busy === p.id ? 0.6 : 1 }}>
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.grade} {p.prenom} {p.nom}<PseudosAgent agent={p} /></div>
                <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 3 }}>
                  {p.matricule}
                  {cat === "formation" || cat === "entretien" ? ` · fiches lues : ${lues}/${idsFiches.size}` : ""}
                  {reste !== null ? (reste >= 0 ? ` · délai : ${reste} j restant${reste > 1 ? "s" : ""}` : ` · délai dépassé de ${-reste} j`) : ""}
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                  {p.statutFormation === "non-effectuee" && <span style={{ background: "#E6EDF7", color: BLEU, fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "1px 8px" }}>{ROLE_NON_EFFECTUEE}</span>}
                  {p.statutFormation === "effectuee" && <span style={{ background: "#E3F2E8", color: "#1F6B42", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "1px 8px" }}>{ROLE_EFFECTUEE}</span>}
                  {estEnEntretien(p) && <span style={{ background: "#FFF1DC", color: "#8A5A00", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "1px 8px" }}>{ROLE_ENTRETIEN}</span>}
                  {cat === "ancien" && <span style={{ background: "#EEF2F8", color: "#5A6B84", fontSize: 11, fontWeight: 600, borderRadius: 10, padding: "1px 8px" }}>Agent en poste — non concerné</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(cat === "formation") && <button type="button" style={btn} onClick={() => agir(p, { enEntretien: true })}>🗣️ Mettre en entretien</button>}
                {cat === "entretien" && <button type="button" style={btn} onClick={() => agir(p, { enEntretien: false })}>Fin d'entretien (fiches visibles)</button>}
                {(cat === "formation" || cat === "entretien") && <button type="button" style={{ ...btn, background: "#E3F2E8", color: "#1F6B42", borderColor: "#2E7D4F" }} onClick={() => agir(p, { statutFormation: "effectuee", enEntretien: false, formationValideeLe: maintenant() }, `Valider la formation de ${p.prenom} ${p.nom} ? Tous ses accès seront débloqués.`)}>✓ Valider la formation</button>}
                {(cat === "effectuee" || cat === "ancien") && <button type="button" style={btn} onClick={() => agir(p, { statutFormation: "non-effectuee", enEntretien: false, formationDebut: maintenant() }, `Remettre ${p.prenom} ${p.nom} en formation ? Ses accès terrain seront verrouillés.`)}>Remettre en formation</button>}
              </div>
            </div>
          );
        })}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13, padding: "10px 2px" }}>Aucun agent dans cette catégorie.</div>}
      </div>
    </div>
  );
}

function OngletReglages({ delai, onSaved }) {
  const [val, setVal] = useState(String(delai));
  const [etat, setEtat] = useState("");
  async function sauver() {
    const n = Math.round(Number(val));
    if (!(n >= 1 && n <= 90)) { setEtat("Indique un nombre de jours entre 1 et 90."); return; }
    try {
      await setDoc(doc(db, "settings", "formation"), { delaiJours: n }, { merge: true });
      onSaved(n); setEtat("✓ Délai enregistré.");
    } catch (e) { console.error(e); setEtat("Échec de l'enregistrement."); }
  }
  return (
    <div style={{ ...carte, maxWidth: 520 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Délai pour apprendre les fiches</div>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 12, lineHeight: 1.5 }}>Nombre de jours accordés à un nouveau gendarme, à partir de la création de son compte, pour apprendre les cours avant son entretien. Il voit le compte à rebours sur son tableau de bord.</div>
      <div style={{ maxWidth: 160 }}><Field label="Délai (jours)" value={val} onChange={setVal} placeholder="7" /></div>
      <button type="button" onClick={sauver} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Enregistrer</button>
      {etat && <span style={{ marginLeft: 12, fontSize: 13, color: etat.startsWith("✓") ? "#1F6B42" : "#C0172D", fontWeight: 600 }}>{etat}</span>}
    </div>
  );
}
