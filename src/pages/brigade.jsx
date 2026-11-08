// pages/brigade.jsx — Brigade de Recherche (BR) : enquêtes de flagrance et préliminaires.
// Collection Firestore « enquetes_br » : réservée aux membres de la BR et aux administrateurs.
import React, { useCallback, useEffect, useState } from "react";
import { addDoc, arrayUnion, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { buttonPrimary, labelStyle, smallBtn } from "../composants/ui.jsx";

export const QUAL_BR = "Brigade de Recherche";
export const estBR = (p) => !!p && ((p.qualifications || []).includes(QUAL_BR) || !!p.isAdmin);

const SERIF = "Georgia, 'Times New Roman', serif";
const CARTE = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 20, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 16 };
const INP = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, marginBottom: 12, fontFamily: "inherit", background: "#fff" };
const TYPES = {
  Flagrance: { c: "#C0172D", fond: "#FBE9EC", ico: "🚨", aide: "Crime ou délit en train de se commettre ou venant de se commettre. Durée : 8 jours, prolongeable une fois de 8 jours (art. 53 CPP)." },
  "Préliminaire": { c: "#123A7A", fond: "#E6EEFA", ico: "🔎", aide: "Enquête hors flagrance, sous la direction du procureur : auditions, perquisitions avec accord, GAV si nécessaire." },
};
const STATUTS = ["Ouverte", "En cours", "Clôturée", "Classée"];
const COUL_STATUT = { Ouverte: "#2F6FDE", "En cours": "#B25E00", "Clôturée": "#2E7D4F", "Classée": "#7A8CA8" };
const ACTES = ["Constatations", "Audition de témoin", "Audition de victime", "Audition de mis en cause", "Garde à vue", "Perquisition", "Saisie", "Interpellation", "Réquisition", "Surveillance / filature", "Rapport", "Autre"];
const STATUTS_SUSPECT = ["Libre", "Mis en cause", "En garde à vue", "Déféré", "Hors de cause"];

const nomDe = (p) => `${p.grade ? p.grade + " " : ""}${p.prenom || ""} ${p.nom || ""}`.trim();
const jour = (iso) => { try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return iso || ""; } };
const heure = (iso) => { try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const nid = () => Math.random().toString(36).slice(2, 10);

// Jours restants de l'enquête de flagrance (8 jours, +8 si prolongée)
export function delaiFlagrance(e) {
  if (!e || e.type !== "Flagrance" || !e.flagranceDebut) return null;
  const duree = e.prolongee ? 16 : 8;
  const fin = new Date(`${e.flagranceDebut}T00:00:00`); fin.setDate(fin.getDate() + duree);
  const reste = Math.ceil((fin - new Date()) / 86400000);
  return { duree, reste, fin: fin.toISOString().slice(0, 10) };
}

function Puce({ c, fond, children }) {
  return <span style={{ background: fond || "#EEF2F8", color: c || "#123A7A", border: `1px solid ${c || "#C3D0E2"}33`, borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{children}</span>;
}

function Entete({ sous, action }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(120deg, #0B1D44 0%, #14305F 60%, #7A1424 160%)", borderRadius: 18, padding: "22px 26px", marginBottom: 22, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <div style={{ position: "absolute", right: -40, top: -50, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(192,23,45,0.3), transparent 70%)" }} />
      <div style={{ position: "relative", width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🔎</div>
      <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 10.5, letterSpacing: 2.6, color: "#F2A5B0", fontWeight: 700 }}>COMPAGNIE DE GENDARMERIE DE SAINT-TROPEZ</div>
        <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: "#fff", marginTop: 3 }}>Brigade de Recherche</div>
        <div style={{ fontSize: 13.5, color: "#C9D6EC", marginTop: 4 }}>{sous}</div>
        <div style={{ height: 3, width: 90, marginTop: 10, background: "linear-gradient(90deg,#1F4E9F 33%,#fff 33% 66%,#C0172D 66%)", borderRadius: 2 }} />
      </div>
      {action}
    </div>
  );
}

function Tuile({ label, valeur, couleur }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${couleur}`, borderRadius: 12, padding: "10px 16px", flex: "1 1 120px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: couleur, lineHeight: 1.1 }}>{valeur}</div>
      <div style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>{label}</div>
    </div>
  );
}

export function BrigadeEnquetesPage({ current, personnel = [] }) {
  const [liste, setListe] = useState(null);
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("actives");
  const [ouverte, setOuverte] = useState(null); // id de l'enquête affichée
  const [creation, setCreation] = useState(false);

  const charger = useCallback(async () => {
    try {
      const s = await getDocs(collection(db, "enquetes_br"));
      setListe(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.creeLe || "").localeCompare(String(a.creeLe || ""))));
      setErreur("");
    } catch (e) { console.error(e); setListe([]); setErreur("Lecture impossible : les règles Firestore de la Brigade de Recherche ne sont pas encore publiées."); }
  }, []);
  useEffect(() => { if (estBR(current)) charger(); }, [charger, current]);

  if (!estBR(current)) return <div style={CARTE}>🔒 Cet espace est réservé au personnel de la Brigade de Recherche.</div>;
  if (!liste) return <div style={{ color: "#5A6B84" }}>Chargement…</div>;

  const membres = personnel.filter((p) => (p.qualifications || []).includes(QUAL_BR));
  const actives = liste.filter((e) => e.statut === "Ouverte" || e.statut === "En cours");
  const flagActives = actives.filter((e) => e.type === "Flagrance");
  const urgentes = flagActives.filter((e) => { const d = delaiFlagrance(e); return d && d.reste <= 2; });
  const vue = liste.filter((e) => (filtre === "actives" ? actives.includes(e) : filtre === "flagrance" ? e.type === "Flagrance" : filtre === "preliminaire" ? e.type === "Préliminaire" : filtre === "closes" ? !actives.includes(e) : true));
  const courante = ouverte && liste.find((e) => e.id === ouverte);

  if (courante) return <FicheEnquete e={courante} current={current} membres={membres} onBack={() => setOuverte(null)} onChange={charger} onDeleted={() => { setOuverte(null); charger(); }} />;

  return (
    <div style={{ maxWidth: 980 }}>
      <Entete sous="Enquêtes de flagrance et enquêtes préliminaires" action={<button onClick={() => setCreation(true)} className="gh-btn-anim" style={{ position: "relative", background: "#fff", color: "#0F2A5C", border: "none", borderRadius: 12, padding: "12px 22px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>+ Ouvrir une enquête</button>} />
      {erreur && <div style={{ ...CARTE, background: "#FFF4E5", color: "#8A5200", fontWeight: 700 }}>{erreur}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Tuile label="Enquêtes actives" valeur={actives.length} couleur="#2F6FDE" />
        <Tuile label="Flagrances en cours" valeur={flagActives.length} couleur="#C0172D" />
        <Tuile label="Préliminaires en cours" valeur={actives.length - flagActives.length} couleur="#123A7A" />
        <Tuile label="Flagrances bientôt échues" valeur={urgentes.length} couleur={urgentes.length ? "#B25E00" : "#9AA8BD"} />
        <Tuile label="Enquêteurs BR" valeur={membres.length} couleur="#2E7D4F" />
      </div>
      {urgentes.length > 0 && <div style={{ ...CARTE, background: "#FFF4E5", border: "1px solid #F0C98A", color: "#8A5200", fontWeight: 700, padding: 14 }}>⏳ {urgentes.length} enquête{urgentes.length > 1 ? "s" : ""} de flagrance arrive{urgentes.length > 1 ? "nt" : ""} à échéance : prolonge-la, ou passe-la en préliminaire.</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[["actives", "En cours"], ["flagrance", "🚨 Flagrance"], ["preliminaire", "🔎 Préliminaire"], ["closes", "Terminées"], ["toutes", "Toutes"]].map(([k, l]) => (
          <button key={k} onClick={() => setFiltre(k)} style={{ border: `1px solid ${filtre === k ? "#123A7A" : "#C3D0E2"}`, background: filtre === k ? "#123A7A" : "#fff", color: filtre === k ? "#fff" : "#26364F", borderRadius: 999, padding: "6px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
        ))}
      </div>
      {!vue.length && <div style={{ ...CARTE, color: "#5A6B84", textAlign: "center" }}>Aucune enquête ici pour l'instant.</div>}
      {vue.map((e) => {
        const t = TYPES[e.type] || TYPES["Préliminaire"]; const d = delaiFlagrance(e);
        return (
          <button key={e.id} onClick={() => setOuverte(e.id)} className="gh-card-anim" style={{ ...CARTE, display: "block", width: "100%", textAlign: "left", cursor: "pointer", borderLeft: `6px solid ${t.c}`, marginBottom: 12, fontFamily: "inherit" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontWeight: 800, color: "#5A6B84", fontSize: 12 }}>{e.numero}</span>
              <Puce c={t.c} fond={t.fond}>{t.ico} {e.type}</Puce>
              <Puce c={COUL_STATUT[e.statut]} fond="#fff">{e.statut}</Puce>
              {d && (e.statut === "Ouverte" || e.statut === "En cours") && <Puce c={d.reste <= 2 ? "#C0172D" : "#B25E00"} fond="#FFF4E5">{d.reste > 0 ? `⏳ ${d.reste} j restant${d.reste > 1 ? "s" : ""}` : "⏳ Délai dépassé"}</Puce>}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: "#14213A" }}>{e.titre}</div>
            <div style={{ fontSize: 12.5, color: "#5A6B84", marginTop: 4 }}>{[e.lieu, e.dateFaits && `faits du ${jour(e.dateFaits)}`, `dirigée par ${e.directeurNom || "—"}`, `${(e.actes || []).length} acte(s)`, `${(e.suspects || []).length} mis en cause`].filter(Boolean).join(" · ")}</div>
          </button>
        );
      })}
      {creation && <FormulaireEnquete current={current} membres={membres} onClose={() => setCreation(false)} onCreated={(id) => { setCreation(false); charger().then(() => setOuverte(id)); }} />}
    </div>
  );
}

function FormulaireEnquete({ current, membres, onClose, onCreated }) {
  const [f, setF] = useState({ type: "Flagrance", titre: "", faits: "", lieu: "", dateFaits: aujourdhui(), qualification: "", directeur: current.id || "", enqueteurs: [] });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const maj = (p) => setF({ ...f, ...p });
  const dir = membres.find((m) => m.id === f.directeur) || (f.directeur === current.id ? current : null);
  async function creer() {
    if (!f.titre.trim() || !f.faits.trim()) { setErr("Le titre et les faits sont obligatoires."); return; }
    setBusy(true);
    try {
      const numero = `BR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const data = {
        numero, type: f.type, titre: f.titre.trim(), faits: f.faits.trim(), lieu: f.lieu.trim(), dateFaits: f.dateFaits, qualification: f.qualification.trim(),
        statut: "Ouverte", directeurUid: dir ? dir.id : current.id, directeurNom: nomDe(dir || current), enqueteurs: f.enqueteurs.map((id) => { const m = membres.find((x) => x.id === id); return { id, nom: m ? nomDe(m) : id }; }),
        suspects: [], victimes: "", actes: [{ id: nid(), date: new Date().toISOString(), type: "Ouverture", texte: `Ouverture de l'enquête ${f.type === "Flagrance" ? "de flagrance" : "préliminaire"}.`, par: nomDe(current) }],
        creeLe: new Date().toISOString(), creePar: nomDe(current), creeParUid: current.id,
      };
      if (f.type === "Flagrance") { data.flagranceDebut = f.dateFaits || aujourdhui(); data.prolongee = false; }
      const ref = await addDoc(collection(db, "enquetes_br"), data);
      onCreated(ref.id);
    } catch (e) { console.error(e); setErr("Échec de l'ouverture (règles Firestore publiées ?)."); setBusy(false); }
  }
  const t = TYPES[f.type];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(7,20,46,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ ...CARTE, width: "100%", maxWidth: 640, marginTop: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700 }}>Ouvrir une enquête</div>
          <button type="button" style={smallBtn} onClick={onClose}>Fermer</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
          {Object.entries(TYPES).map(([k, v]) => (
            <button key={k} type="button" onClick={() => maj({ type: k })} style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", border: `2px solid ${f.type === k ? v.c : "#C3D0E2"}`, background: f.type === k ? v.fond : "#fff", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontWeight: 800, color: v.c }}>{v.ico} {k}</div>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 12, lineHeight: 1.5 }}>{t.aide}</div>
        <label style={labelStyle}>Titre de l'enquête *</label>
        <input style={INP} value={f.titre} onChange={(e) => maj({ titre: e.target.value })} placeholder="Ex : Braquage de la bijouterie du port" />
        <label style={labelStyle}>Faits *</label>
        <textarea style={{ ...INP, minHeight: 90 }} value={f.faits} onChange={(e) => maj({ faits: e.target.value })} placeholder="Résumé des faits, circonstances, éléments connus…" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={labelStyle}>Lieu</label><input style={INP} value={f.lieu} onChange={(e) => maj({ lieu: e.target.value })} /></div>
          <div><label style={labelStyle}>Date des faits</label><input type="date" style={INP} value={f.dateFaits} onChange={(e) => maj({ dateFaits: e.target.value })} /></div>
        </div>
        <label style={labelStyle}>Qualification juridique (si connue)</label>
        <input style={INP} value={f.qualification} onChange={(e) => maj({ qualification: e.target.value })} placeholder="Ex : Vol à main armée" />
        <label style={labelStyle}>Directeur d'enquête (OPJ)</label>
        <select style={INP} value={f.directeur} onChange={(e) => maj({ directeur: e.target.value })}>
          <option value={current.id}>{nomDe(current)} (moi)</option>
          {membres.filter((m) => m.id !== current.id).map((m) => <option key={m.id} value={m.id}>{nomDe(m)}</option>)}
        </select>
        {!!membres.length && (<>
          <label style={labelStyle}>Enquêteurs affectés</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {membres.map((m) => { const on = f.enqueteurs.includes(m.id); return <button key={m.id} type="button" onClick={() => maj({ enqueteurs: on ? f.enqueteurs.filter((x) => x !== m.id) : [...f.enqueteurs, m.id] })} style={{ border: `1px solid ${on ? "#123A7A" : "#C3D0E2"}`, background: on ? "#123A7A" : "#fff", color: on ? "#fff" : "#26364F", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{nomDe(m)}</button>; })}
          </div>
        </>)}
        {err && <div style={{ color: "#C0172D", fontWeight: 700, marginBottom: 10 }}>{err}</div>}
        <button type="button" disabled={busy} onClick={creer} style={buttonPrimary}>{busy ? "Ouverture…" : "Ouvrir l'enquête"}</button>
      </div>
    </div>
  );
}

function FicheEnquete({ e, current, membres, onBack, onChange, onDeleted }) {
  const t = TYPES[e.type] || TYPES["Préliminaire"]; const d = delaiFlagrance(e);
  const clos = e.statut === "Clôturée" || e.statut === "Classée";
  const [acte, setActe] = useState({ type: ACTES[0], texte: "" });
  const [sus, setSus] = useState({ nom: "", statut: STATUTS_SUSPECT[1] });
  const [concl, setConcl] = useState(e.conclusion || "");
  const [msg, setMsg] = useState("");
  const maj = async (patch, ok) => { try { await updateDoc(doc(db, "enquetes_br", e.id), patch); if (ok) setMsg(ok); await onChange(); } catch (x) { console.error(x); setMsg("Échec de l'enregistrement."); } };
  const ajouterActe = async () => {
    if (!acte.texte.trim()) return;
    await maj({ actes: arrayUnion({ id: nid(), date: new Date().toISOString(), type: acte.type, texte: acte.texte.trim(), par: nomDe(current) }), statut: e.statut === "Ouverte" ? "En cours" : e.statut });
    setActe({ ...acte, texte: "" });
  };
  const ajouterSuspect = async () => { if (!sus.nom.trim()) return; await maj({ suspects: arrayUnion({ id: nid(), nom: sus.nom.trim(), statut: sus.statut }) }); setSus({ ...sus, nom: "" }); };
  const changerSuspect = (id, statut) => maj({ suspects: (e.suspects || []).map((s) => (s.id === id ? { ...s, statut } : s)) });
  const actes = [...(e.actes || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const bloc = { ...CARTE, marginBottom: 14 };
  return (
    <div style={{ maxWidth: 980 }}>
      <button type="button" onClick={onBack} style={{ ...smallBtn, marginBottom: 14 }}>← Retour aux enquêtes</button>
      <div style={{ ...bloc, borderTop: `6px solid ${t.c}` }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontWeight: 800, color: "#5A6B84" }}>{e.numero}</span><Puce c={t.c} fond={t.fond}>{t.ico} {e.type}</Puce><Puce c={COUL_STATUT[e.statut]} fond="#fff">{e.statut}</Puce>
          {e.qualification && <Puce>{e.qualification}</Puce>}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: "#14213A" }}>{e.titre}</div>
        <div style={{ fontSize: 13, color: "#5A6B84", margin: "6px 0 12px" }}>{[e.lieu, e.dateFaits && `faits du ${jour(e.dateFaits)}`, `ouverte le ${jour(e.creeLe)} par ${e.creePar || "—"}`].filter(Boolean).join(" · ")}</div>
        <div style={{ whiteSpace: "pre-line", lineHeight: 1.65, fontSize: 14, color: "#26364F", background: "#F7FAFD", border: "1px solid #E1E8F2", borderRadius: 10, padding: "12px 14px" }}>{e.faits}</div>
        <div style={{ marginTop: 12, fontSize: 13.5, color: "#26364F", lineHeight: 1.7 }}>
          <b>Directeur d'enquête :</b> {e.directeurNom || "—"}<br />
          <b>Enquêteurs :</b> {(e.enqueteurs || []).map((x) => x.nom).join(", ") || "—"}
        </div>
        {d && !clos && (
          <div style={{ marginTop: 14, background: d.reste <= 2 ? "#FBE9EC" : "#FFF4E5", border: `1px solid ${d.reste <= 2 ? "#F2B8C0" : "#F0C98A"}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontWeight: 800, color: d.reste <= 2 ? "#C0172D" : "#8A5200" }}>⏳ Flagrance : {d.reste > 0 ? `${d.reste} jour${d.reste > 1 ? "s" : ""} restant${d.reste > 1 ? "s" : ""}` : "délai dépassé"} (fin le {jour(d.fin)}, durée {d.duree} jours{e.prolongee ? ", prolongée" : ""})</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {!e.prolongee && <button type="button" style={smallBtn} onClick={() => window.confirm("Prolonger la flagrance de 8 jours (une seule fois) ?") && maj({ prolongee: true, actes: arrayUnion({ id: nid(), date: new Date().toISOString(), type: "Prolongation", texte: "Prolongation de l'enquête de flagrance de 8 jours.", par: nomDe(current) }) }, "Flagrance prolongée de 8 jours.")}>Prolonger de 8 jours</button>}
              <button type="button" style={smallBtn} onClick={() => window.confirm("Basculer cette enquête en préliminaire ?") && maj({ type: "Préliminaire", actes: arrayUnion({ id: nid(), date: new Date().toISOString(), type: "Changement de cadre", texte: "Passage de l'enquête de flagrance en enquête préliminaire.", par: nomDe(current) }) }, "Enquête passée en préliminaire.")}>Passer en préliminaire</button>
            </div>
          </div>
        )}
        {msg && <div style={{ marginTop: 10, color: "#2E7D4F", fontWeight: 700 }}>{msg}</div>}
      </div>

      <div style={bloc}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, marginBottom: 10 }}>👥 Mis en cause et personnes concernées</div>
        {(e.suspects || []).map((s) => (
          <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "7px 0", borderBottom: "1px solid #EEF2F8" }}>
            <b style={{ flex: 1, minWidth: 140 }}>{s.nom}</b>
            <select disabled={clos} value={s.statut} onChange={(ev) => changerSuspect(s.id, ev.target.value)} style={{ ...INP, width: "auto", marginBottom: 0 }}>{STATUTS_SUSPECT.map((x) => <option key={x}>{x}</option>)}</select>
          </div>
        ))}
        {!(e.suspects || []).length && <div style={{ color: "#7A8CA8", fontSize: 13 }}>Aucun mis en cause enregistré.</div>}
        {!clos && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <input style={{ ...INP, flex: "1 1 200px", marginBottom: 0, width: "auto" }} placeholder="Nom / pseudo Roblox" value={sus.nom} onChange={(ev) => setSus({ ...sus, nom: ev.target.value })} />
            <select style={{ ...INP, width: "auto", marginBottom: 0 }} value={sus.statut} onChange={(ev) => setSus({ ...sus, statut: ev.target.value })}>{STATUTS_SUSPECT.map((x) => <option key={x}>{x}</option>)}</select>
            <button type="button" style={smallBtn} onClick={ajouterSuspect}>Ajouter</button>
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Victimes / témoins</label>
          <textarea disabled={clos} style={{ ...INP, minHeight: 60, marginBottom: 6 }} defaultValue={e.victimes || ""} onBlur={(ev) => ev.target.value !== (e.victimes || "") && maj({ victimes: ev.target.value })} placeholder="Qui sont les victimes et les témoins ?" />
        </div>
      </div>

      <div style={bloc}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, marginBottom: 10 }}>📒 Journal des actes d'enquête</div>
        {!clos && (
          <div style={{ background: "#F7FAFD", border: "1px solid #E1E8F2", borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <select style={INP} value={acte.type} onChange={(ev) => setActe({ ...acte, type: ev.target.value })}>{ACTES.map((x) => <option key={x}>{x}</option>)}</select>
            <textarea style={{ ...INP, minHeight: 70 }} value={acte.texte} onChange={(ev) => setActe({ ...acte, texte: ev.target.value })} placeholder="Décris l'acte : date, lieu, personnes, éléments recueillis…" />
            <button type="button" style={buttonPrimary} onClick={ajouterActe}>Ajouter au journal</button>
          </div>
        )}
        {actes.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #EEF2F8" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.c, marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>{heure(a.date)} · {a.type} · {a.par}</div>
              <div style={{ whiteSpace: "pre-line", fontSize: 14, color: "#26364F", lineHeight: 1.6 }}>{a.texte}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={bloc}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, marginBottom: 10 }}>🗂️ Conclusion</div>
        <textarea disabled={clos} style={{ ...INP, minHeight: 80 }} value={concl} onChange={(ev) => setConcl(ev.target.value)} placeholder="Résultat de l'enquête, suites données (transmission au parquet, classement…)" />
        {!clos ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={buttonPrimary} onClick={() => window.confirm("Clôturer l'enquête ?") && maj({ statut: "Clôturée", conclusion: concl, clotureLe: new Date().toISOString(), actes: arrayUnion({ id: nid(), date: new Date().toISOString(), type: "Clôture", texte: concl || "Enquête clôturée.", par: nomDe(current) }) }, "Enquête clôturée.")}>Clôturer l'enquête</button>
            <button type="button" style={smallBtn} onClick={() => window.confirm("Classer l'enquête sans suite ?") && maj({ statut: "Classée", conclusion: concl, clotureLe: new Date().toISOString(), actes: arrayUnion({ id: nid(), date: new Date().toISOString(), type: "Classement", texte: concl || "Enquête classée sans suite.", par: nomDe(current) }) }, "Enquête classée.")}>Classer sans suite</button>
          </div>
        ) : <button type="button" style={smallBtn} onClick={() => maj({ statut: "En cours", clotureLe: null }, "Enquête rouverte.")}>Rouvrir l'enquête</button>}
        {current.isAdmin && <button type="button" style={{ ...smallBtn, marginLeft: 8, color: "#C0172D" }} onClick={async () => { if (window.confirm("Supprimer définitivement cette enquête ?")) { await deleteDoc(doc(db, "enquetes_br", e.id)); onDeleted(); } }}>Supprimer</button>}
      </div>
    </div>
  );
}
