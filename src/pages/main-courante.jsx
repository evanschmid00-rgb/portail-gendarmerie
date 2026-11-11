// pages/main-courante.jsx — Main courante numérique : journal des événements et interventions du service (comme sur NEO).
import React, { useState, useEffect } from "react";
import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { loadRecent } from "../lib/donnees.js";
import { N, NeoAlerte, NeoBandeau, NeoBouton, NeoCarte, NeoCompteur, NeoLigne, NeoOnglets, NEO_INP, NEO_LAB } from "../composants/neo.jsx";

export const TYPES_MC = [
  { id: "Prise de service", couleur: "#1F9D55" }, { id: "Fin de service", couleur: "#5A6B84" },
  { id: "Contrôle d'identité", couleur: "#2F7BFF" }, { id: "Contrôle routier", couleur: "#2F7BFF" },
  { id: "Intervention", couleur: "#D62B45" }, { id: "Patrouille", couleur: "#123A7A" },
  { id: "Interpellation", couleur: "#B04A00" }, { id: "Renseignement", couleur: "#7A1FA2" },
  { id: "Autre", couleur: "#5A6B84" },
];
const JOURS = 14;
const coul = (t) => (TYPES_MC.find((x) => x.id === t) || {}).couleur || N.accent;
const heure = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
const jourLabel = (iso) => { const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); };
const nomDe = (p) => `${p.grade ? p.grade + " " : ""}${p.prenom || ""} ${p.nom || ""}`.trim();
const maintenant = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const VIDE = () => ({ type: "Patrouille", lieu: "", dateHeure: maintenant(), resume: "", personnes: "", vehicules: "", moyens: "", suites: "" });

export function MainCourantePage({ current }) {
  const uid = current.id || current.uid;
  const [liste, setListe] = useState([]);
  const [charge, setCharge] = useState(false);
  const [f, setF] = useState(VIDE);
  const [vue, setVue] = useState("flux");
  const [mes, setMes] = useState(false);
  const [filtre, setFiltre] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const l = await loadRecent("main_courante", 150);
      if (vivant) { setListe(l); setCharge(true); }
    })();
    return () => { vivant = false; };
  }, []);
  useEffect(() => {
    try {
      const pre = sessionStorage.getItem("gn-mc-pre");
      if (pre) { sessionStorage.removeItem("gn-mc-pre"); setF({ ...VIDE(), ...JSON.parse(pre) }); setVue("saisie"); }
    } catch (e) { /* ignore */ }
  }, []);

  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function enregistrer(e) {
    e.preventDefault();
    if (!f.resume.trim()) { setMsg({ ok: false, t: "Décris l'événement dans le résumé." }); return; }
    setBusy(true); setMsg(null);
    const d = new Date(f.dateHeure);
    const entree = {
      type: f.type, lieu: f.lieu.trim(), dateHeure: isNaN(d) ? new Date().toISOString() : d.toISOString(),
      resume: f.resume.trim().slice(0, 1500), personnes: f.personnes.trim().slice(0, 400), vehicules: f.vehicules.trim().slice(0, 300),
      moyens: f.moyens.trim().slice(0, 300), suites: f.suites.trim().slice(0, 500),
      auteurUid: uid, auteurNom: nomDe(current), auteurMatricule: current.matricule || "", unite: current.unite || "",
      createdAt: new Date().toISOString(),
    };
    try {
      const r = await addDoc(collection(db, "main_courante"), entree);
      setListe((l) => [{ ...entree, id: r.id }, ...l]);
      setF(VIDE()); setMsg({ ok: true, t: "Événement inscrit à la main courante." }); setVue("flux");
    } catch (x) { console.error(x); setMsg({ ok: false, t: "Enregistrement impossible (règles Firestore de la main courante publiées ? base saturée ?)." }); }
    finally { setBusy(false); }
  }
  async function supprimer(id) {
    if (!window.confirm("Supprimer cette entrée de la main courante ?")) return;
    try { await deleteDoc(doc(db, "main_courante", id)); setListe((l) => l.filter((x) => x.id !== id)); } catch (x) { console.error(x); setMsg({ ok: false, t: "Suppression refusée." }); }
  }

  const limite = Date.now() - JOURS * 86400000;
  const visibles = liste
    .filter((x) => new Date(x.dateHeure).getTime() >= limite)
    .filter((x) => (!mes || x.auteurUid === uid) && (!filtre || x.type === filtre))
    .sort((a, b) => String(b.dateHeure).localeCompare(String(a.dateHeure)));
  const groupes = [];
  visibles.forEach((x) => { const j = jourLabel(x.dateHeure); const g = groupes[groupes.length - 1]; if (g && g.j === j) g.l.push(x); else groupes.push({ j, l: [x] }); });
  const auj = liste.filter((x) => new Date(x.dateHeure).toDateString() === new Date().toDateString());

  return (
    <div style={{ maxWidth: 940 }}>
      <NeoBandeau surtitre="Terrain · journal de service" titre="MAIN COURANTE" texte={`Inscris chaque événement du service (contrôle, intervention, patrouille…). Les entrées sont conservées ${JOURS} jours.`}
        droite={<><NeoCompteur n={auj.length} label="Aujourd'hui" couleur="#5CC8FF" /><NeoCompteur n={auj.filter((x) => x.auteurUid === uid).length} label="Les miennes" couleur="#34C38F" /></>} />
      <NeoOnglets onglets={[{ id: "flux", label: "JOURNAL", n: visibles.length }, { id: "saisie", label: "NOUVELLE ENTRÉE" }]} actif={vue} onChange={setVue} />
      {msg && <NeoAlerte ton={msg.ok ? "ok" : "danger"} icone={msg.ok ? "✅" : "⚠️"}>{msg.t}</NeoAlerte>}
      {vue === "saisie" && (
        <NeoCarte titre="Nouvelle entrée">
          <form onSubmit={enregistrer}>
            <label style={{ ...NEO_LAB, marginTop: 0 }}>Nature de l'événement</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {TYPES_MC.map((t) => (
                <button type="button" key={t.id} onClick={() => maj("type", t.id)} style={{ border: `2px solid ${t.couleur}`, background: f.type === t.id ? t.couleur : "#fff", color: f.type === t.id ? "#fff" : t.couleur, borderRadius: 20, padding: "7px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{t.id}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <div><label style={NEO_LAB}>Date et heure</label><input type="datetime-local" style={NEO_INP} value={f.dateHeure} onChange={(e) => maj("dateHeure", e.target.value)} /></div>
              <div><label style={NEO_LAB}>Lieu</label><input style={NEO_INP} value={f.lieu} onChange={(e) => maj("lieu", e.target.value)} placeholder="Ex : Port, Place des Lices…" /></div>
            </div>
            <label style={NEO_LAB}>Résumé des faits *</label>
            <textarea style={{ ...NEO_INP, minHeight: 100, resize: "vertical" }} value={f.resume} onChange={(e) => maj("resume", e.target.value)} placeholder="Que s'est-il passé ? Reste factuel." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <div><label style={NEO_LAB}>Personnes (@ Roblox)</label><input style={NEO_INP} value={f.personnes} onChange={(e) => maj("personnes", e.target.value)} placeholder="@Pseudo1, @Pseudo2" /></div>
              <div><label style={NEO_LAB}>Véhicules</label><input style={NEO_INP} value={f.vehicules} onChange={(e) => maj("vehicules", e.target.value)} placeholder="Marque, plaque…" /></div>
              <div><label style={NEO_LAB}>Moyens engagés</label><input style={NEO_INP} value={f.moyens} onChange={(e) => maj("moyens", e.target.value)} placeholder="Patrouille, renfort, BR…" /></div>
            </div>
            <label style={NEO_LAB}>Suites données</label>
            <input style={NEO_INP} value={f.suites} onChange={(e) => maj("suites", e.target.value)} placeholder="PV dressé, rappel à la loi, transmission au procureur…" />
            <div style={{ marginTop: 16 }}><NeoBouton type="submit" disabled={busy}>{busy ? "ENREGISTREMENT…" : "INSCRIRE À LA MAIN COURANTE"}</NeoBouton></div>
          </form>
        </NeoCarte>
      )}
      {vue === "flux" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "4px 0 12px", alignItems: "center" }}>
            <select style={{ ...NEO_INP, width: "auto" }} value={filtre} onChange={(e) => setFiltre(e.target.value)}><option value="">Tous les types</option>{TYPES_MC.map((t) => <option key={t.id}>{t.id}</option>)}</select>
            <label style={{ fontSize: 13.5, fontWeight: 700, color: N.encre, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={mes} onChange={(e) => setMes(e.target.checked)} /> Mes entrées seulement</label>
          </div>
          {!charge && <div style={{ color: N.gris, padding: 10 }}>Chargement…</div>}
          {charge && groupes.length === 0 && <NeoAlerte ton="info" icone="📓">Aucune entrée. Clique sur « Nouvelle entrée » pour ouvrir la main courante.</NeoAlerte>}
          {groupes.map((g) => (
            <div key={g.j}>
              <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: N.gris, margin: "16px 2px 8px" }}>{g.j}</div>
              {g.l.map((x) => (
                <NeoLigne key={x.id} couleur={coul(x.type)} pastille={x.type.toUpperCase()} titre={`${heure(x.dateHeure)} · ${x.lieu || "Lieu non précisé"}`} sous={`${x.auteurNom}${x.unite ? " · " + x.unite : ""}`} date={x.resume.length > 90 ? x.resume.slice(0, 90) + "…" : x.resume}
                  detail={
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: N.encre }}>
                      <div style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>{x.resume}</div>
                      {[["Personnes", x.personnes], ["Véhicules", x.vehicules], ["Moyens", x.moyens], ["Suites", x.suites]].filter((r) => r[1]).map((r) => <div key={r[0]}><b>{r[0]} :</b> {r[1]}</div>)}
                      {(x.auteurUid === uid || current.isAdmin) && <div style={{ marginTop: 10 }}><NeoBouton variante="danger" onClick={() => supprimer(x.id)}>SUPPRIMER</NeoBouton></div>}
                    </div>
                  } />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
