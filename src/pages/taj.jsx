// pages/taj.jsx — TAJ (Traitement des Antécédents Judiciaires) et CJN (Casier Judiciaire National).
//  • TAJ : tout gendarme recherche une personne par son @ Roblox et voit ses antécédents (mentions, PV, plaintes, enquêtes BR, condamnations).
//  • CJN : seules les condamnations prononcées par un juge y sont inscrites, uniquement par un OPJ, et elles ne sont jamais purgées.
import React, { useState, useEffect } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { ChoixInfractions } from "../composants/ChoixInfractions.jsx";
import { FicheCasier } from "../composants/FicheCasier.jsx";
import { estOPJ } from "../lib/droits.js";
import { chargerCasierDe } from "../lib/casierRecherche.js";
import { memePersonne, resoudreRoblox, COL_PIECES } from "../lib/dossierPersonne.js";

export const COL_CJN = "cjn";
const SERIF = "Georgia, 'Times New Roman', serif";
const CARTE = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 20, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 16 };
const INP = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #C3D0E2", borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: "#fff", color: "#14213A" };
const LAB = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase", color: "#5A6B84", margin: "12px 0 5px" };
const BTN = { border: 0, borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", background: "#123A7A", color: "#fff" };
const COUL = { Contravention: "#2E7D4F", "Délit": "#C77700", Crime: "#C0172D" };
const JURIDICTIONS = ["Tribunal de police", "Tribunal correctionnel", "Cour d'assises", "Juge des enfants", "Comparution immédiate"];
const PEINES = ["Emprisonnement ferme", "Emprisonnement avec sursis", "Emprisonnement partiellement avec sursis", "Amende", "Travail d'intérêt général", "Interdiction / déchéance", "Dispense de peine"];

const jour = (s) => { if (!s) return "—"; const d = new Date(String(s).length <= 10 ? `${s}T12:00:00` : s); return isNaN(d) ? String(s) : d.toLocaleDateString("fr-FR"); };
const nomAgent = (p) => `${p.grade ? p.grade + " " : ""}${p.prenom || ""} ${p.nom || ""}`.trim();
const estBR = (p) => !!p && Array.isArray(p.qualifications) && p.qualifications.includes("Brigade de Recherche");

// Une décision du CJN, présentée comme une « mention » pour réutiliser l'extrait officiel (FicheCasier)
export const decisionEnMention = (d) => ({
  id: d.id, nature: (d.infractions || []).map((i) => i.nom).join(", ") || d.libelle || "Condamnation",
  gravite: d.gravite || "", dateFaits: d.dateDecision || "", createdAt: d.createdAt || "",
  amende: d.montant || "", tempsGav: "",
  remarques: [d.juridiction, d.juge && `Juge : ${d.juge}`, d.peine && `Peine : ${d.peine}${d.duree ? " (" + d.duree + ")" : ""}`, d.numeroAffaire && `Affaire n° ${d.numeroAffaire}`, d.observations].filter(Boolean).join(" · "),
  gendarmeNom: d.saisiParNom || "", gendarmeMatricule: d.saisiParMatricule || "",
});

export async function chargerCjnDe(compte) {
  const id = String(compte.id);
  const s = await getDocs(query(collection(db, COL_CJN), where("robloxId", "in", [id, Number(id)])));
  return s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => String(b.dateDecision || "").localeCompare(String(a.dateDecision || "")));
}

function Entete({ icone, titre, texte }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(120deg, #0B1D44 0%, #14305F 70%, #1B3F7D 100%)", borderRadius: 18, padding: "22px 26px", marginBottom: 16, color: "#fff" }}>
      <div style={{ fontSize: 10.5, letterSpacing: 2.6, color: "#8FB6FF", fontWeight: 700 }}>{icone} GENDARMERIE NATIONALE</div>
      <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, marginTop: 3 }}>{titre}</div>
      <div style={{ fontSize: 13.5, color: "#C9D6EC", marginTop: 4, lineHeight: 1.5, maxWidth: 640 }}>{texte}</div>
      <div style={{ height: 3, width: 90, marginTop: 10, background: "linear-gradient(90deg,#1F4E9F 33%,#fff 33% 66%,#C0172D 66%)", borderRadius: 2 }} />
    </div>
  );
}

function RechercheRoblox({ onTrouve, occupe }) {
  const [at, setAt] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function chercher(e) {
    e.preventDefault();
    const n = at.trim().replace(/^@/, "");
    if (!n) { setErr("Saisis un @ Roblox."); return; }
    setBusy(true); setErr("");
    try {
      const c = await resoudreRoblox(n);
      if (!c) { setErr("Compte Roblox introuvable. Vérifie l'orthographe exacte du nom d'utilisateur."); return; }
      await onTrouve(c);
    } catch (x) { console.error(x); setErr("Recherche impossible pour le moment. Réessaie dans un instant."); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={chercher} style={{ ...CARTE, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div style={{ flex: "1 1 240px" }}>
        <label style={{ ...LAB, marginTop: 0 }}>@ Roblox de la personne</label>
        <input style={INP} value={at} onChange={(e) => setAt(e.target.value)} placeholder="Ex : @MonPseudo" autoFocus />
      </div>
      <button type="submit" disabled={busy || occupe} style={{ ...BTN, opacity: busy ? 0.7 : 1 }}>{busy ? "Recherche…" : "🔎 Rechercher"}</button>
      {err && <div style={{ flexBasis: "100%", background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>{err}</div>}
    </form>
  );
}

function Identite({ compte, avatar, badges }) {
  return (
    <div style={{ ...CARTE, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <Avatar src={avatar} taille={64} />
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: "inline-block", background: "#E3F2E8", color: "#1F6B42", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 9px", marginBottom: 4 }}>✓ Compte Roblox vérifié</div>
        <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, color: "#14213A" }}>{compte.displayName}</div>
        <div style={{ fontSize: 13, color: "#5A6B84" }}>@{compte.username} · ID {compte.id}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{badges}</div>
    </div>
  );
}

const Pastille = ({ n, label, couleur }) => (
  <div style={{ background: n ? couleur + "18" : "#F1F5FA", border: `1px solid ${n ? couleur : "#D3DDEA"}`, borderRadius: 12, padding: "8px 14px", textAlign: "center", minWidth: 84 }}>
    <div style={{ fontSize: 20, fontWeight: 800, color: n ? couleur : "#8A97AB" }}>{n}</div>
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "#5A6B84" }}>{label}</div>
  </div>
);

function Ligne({ pastille, couleur, titre, sous, date }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: "1px solid #EEF2F7", alignItems: "flex-start" }}>
      <span style={{ background: couleur + "1f", color: couleur, border: `1px solid ${couleur}`, borderRadius: 14, padding: "2px 10px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", marginTop: 1 }}>{pastille}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#14213A", overflowWrap: "anywhere" }}>{titre}</div>
        {sous && <div style={{ fontSize: 12.5, color: "#5A6B84", marginTop: 2, lineHeight: 1.45, overflowWrap: "anywhere" }}>{sous}</div>}
      </div>
      <div style={{ fontSize: 12, color: "#5A6B84", whiteSpace: "nowrap" }}>{jour(date)}</div>
    </div>
  );
}

// ───────────── TAJ ─────────────
export function TajPage({ current }) {
  const [fiche, setFiche] = useState(null);
  const [bulletin, setBulletin] = useState(false);
  const avatars = useAvatars([fiche && fiche.compte.id]);
  const voirBR = !!current.isAdmin || estBR(current);

  async function rechercher(c) {
    const id = String(c.id);
    const moi = { robloxId: id, robloxUsername: c.username, pseudoRoblox: c.displayName };
    const [dossiers, pieces, cjn, enquetes] = await Promise.all([
      chargerCasierDe(c).catch(() => []),
      getDocs(query(collection(db, COL_PIECES), where("robloxId", "in", [id, Number(id)]))).then((s) => s.docs.map((d) => ({ ...d.data(), id: d.id }))).catch(() => []),
      chargerCjnDe(c).catch(() => []),
      voirBR ? getDocs(collection(db, "enquetes_br")).then((s) => s.docs.map((d) => ({ ...d.data(), id: d.id })).filter((e) => (e.suspects || []).some((x) => String(x.robloxId) === id))).catch(() => []) : Promise.resolve([]),
    ]);
    setBulletin(false);
    setFiche({
      compte: c,
      mentions: dossiers.filter((d) => memePersonne(d, moi)).flatMap((d) => d.mentions || []),
      pieces: pieces.filter((p) => memePersonne(moi, p)),
      cjn, enquetes,
    });
  }

  const f = fiche;
  const mentions = f ? [...f.mentions].sort((a, b) => String(b.dateFaits || b.createdAt || "").localeCompare(String(a.dateFaits || a.createdAt || ""))) : [];
  const lignes = f ? [
    ...f.cjn.map((d) => ({ k: "c" + d.id, date: d.dateDecision, pastille: "CJN", couleur: "#7A1FA2", titre: (d.infractions || []).map((i) => i.nom).join(", ") || "Condamnation", sous: [d.juridiction, d.peine && `${d.peine}${d.duree ? " " + d.duree : ""}${d.montant ? " · " + d.montant : ""}`, d.numeroAffaire && `affaire n° ${d.numeroAffaire}`].filter(Boolean).join(" · ") })),
    ...mentions.map((m, i) => ({ k: "m" + (m.id || i), date: m.dateFaits || m.createdAt, pastille: m.gravite || "Mention", couleur: COUL[m.gravite] || "#123A7A", titre: m.nature, sous: [m.amende && `Amende ${m.amende}`, m.tempsGav && `GAV ${m.tempsGav}`, m.gendarmeNom && `Agent : ${m.gendarmeNom}`, m.remarques].filter(Boolean).join(" · ") })),
    ...f.pieces.map((p) => ({ k: "p" + p.id, date: p.dateFaits || p.createdAt, pastille: p.type === "Plainte" ? "Plainte" : "PV", couleur: p.type === "Plainte" ? "#B04A00" : "#123A7A", titre: `${p.titre || p.type}${p.ref ? " · " + p.ref : ""}`, sous: [p.role && `Rôle : ${p.role}`, p.lieu, p.resume, p.auteurNom && `Rédigé par ${p.auteurGrade ? p.auteurGrade + " " : ""}${p.auteurNom}`].filter(Boolean).join(" · ") })),
    ...f.enquetes.map((e) => ({ k: "e" + e.id, date: e.dateFaits || e.createdAt, pastille: "Enquête BR", couleur: "#0F6E6E", titre: `${e.type === "Flagrance" ? "Flagrance" : "Préliminaire"} · ${e.titre || e.infraction || "Enquête"}`, sous: `Rôle : ${((e.suspects || []).find((x) => String(x.robloxId) === String(f.compte.id)) || {}).role || "Mis en cause"} · ${e.statut || ""}` })),
  ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))) : [];

  return (
    <div style={{ maxWidth: 900 }}>
      <Entete icone="🗂️" titre="TAJ — Antécédents judiciaires" texte="Recherche une personne par son @ Roblox : mentions de casier, procès-verbaux, plaintes, enquêtes de la Brigade de Recherche et condamnations du CJN. Consultation réservée aux gendarmes, dans le cadre du service." />
      <RechercheRoblox onTrouve={rechercher} />
      {f && (
        <>
          <Identite compte={f.compte} avatar={avatars[f.compte.id]} badges={<>
            <Pastille n={f.cjn.length} label="CJN" couleur="#7A1FA2" />
            <Pastille n={mentions.length} label="Mentions" couleur="#C77700" />
            <Pastille n={f.pieces.length} label="PV / plaintes" couleur="#123A7A" />
            {voirBR && <Pastille n={f.enquetes.length} label="Enquêtes" couleur="#0F6E6E" />}
          </>} />
          {f.cjn.length > 0 && <div style={{ background: "#F3E6FA", border: "1px solid #7A1FA2", color: "#4A1166", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13.5, fontWeight: 600 }}>⚖️ Cette personne a {f.cjn.length} condamnation{f.cjn.length > 1 ? "s" : ""} inscrite{f.cjn.length > 1 ? "s" : ""} au CJN.</div>}
          <div style={CARTE}>
            <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: "#14213A", marginBottom: 6 }}>Historique des antécédents</div>
            {lignes.length === 0 ? <div style={{ fontSize: 14, color: "#5A6B84", padding: "14px 0" }}>✅ Aucun antécédent enregistré pour ce compte.</div> : lignes.map((l) => <Ligne key={l.k} {...l} />)}
            <div style={{ fontSize: 11.5, color: "#7A8799", marginTop: 12, lineHeight: 1.5 }}>Les mentions, PV et plaintes du TAJ sont conservés temporairement (purge automatique). Seules les condamnations du CJN sont définitives.</div>
          </div>
          <button type="button" onClick={() => setBulletin(!bulletin)} style={{ ...BTN, background: "#fff", color: "#123A7A", border: "1px solid #123A7A", marginBottom: 14 }}>{bulletin ? "Masquer" : "📄 Afficher"} l'extrait du CJN (bulletin n°1)</button>
          {bulletin && <FicheCasier personne={{ displayName: f.compte.displayName, username: f.compte.username, robloxId: f.compte.id }} avatar={avatars[f.compte.id]} mentions={f.cjn.map(decisionEnMention)} bulletin="1" />}
        </>
      )}
    </div>
  );
}

// ───────────── CJN ─────────────
const VIDE = { juridiction: JURIDICTIONS[1], juge: "", dateDecision: new Date().toISOString().slice(0, 10), numeroAffaire: "", infractions: [], peine: PEINES[0], duree: "", montant: "", observations: "" };

export function CjnPage({ current, codePenal }) {
  const peut = !!current.isAdmin || estOPJ(current);
  const [compte, setCompte] = useState(null);
  const [liste, setListe] = useState([]);
  const [f, setF] = useState(VIDE);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const avatars = useAvatars([compte && compte.id]);
  useEffect(() => { setMsg(""); }, [compte]);

  async function trouver(c) { setListe(await chargerCjnDe(c)); setCompte(c); setF(VIDE); }
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const gravite = (f.infractions || []).reduce((m, i) => (i.type === "Crime" ? "Crime" : i.type === "Délit" && m !== "Crime" ? "Délit" : m || i.type || ""), "");

  async function enregistrer(e) {
    e.preventDefault();
    if (!peut) return;
    if (!f.infractions.length) { setMsg("⚠️ Choisis au moins une infraction retenue par le juge."); return; }
    if (!f.juge.trim()) { setMsg("⚠️ Indique le nom du juge qui a prononcé la décision."); return; }
    setBusy(true); setMsg("");
    try {
      const d = {
        robloxId: String(compte.id), robloxUsername: compte.username, pseudoRoblox: compte.displayName,
        juridiction: f.juridiction, juge: f.juge.trim().slice(0, 80), dateDecision: f.dateDecision, numeroAffaire: f.numeroAffaire.trim().slice(0, 40),
        infractions: f.infractions, gravite, peine: f.peine, duree: f.duree.trim().slice(0, 60), montant: f.montant.trim().slice(0, 40), observations: f.observations.trim().slice(0, 500),
        saisiParUid: current.id || current.uid || "", saisiParNom: nomAgent(current), saisiParMatricule: current.matricule || "", createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, COL_CJN), d);
      setListe((l) => [{ ...d, id: ref.id }, ...l]);
      setF(VIDE); setMsg("✅ Décision inscrite au Casier Judiciaire National.");
    } catch (x) { console.error(x); setMsg("❌ Inscription impossible. Les règles Firestore du CJN sont-elles publiées ? Es-tu bien OPJ ?"); } finally { setBusy(false); }
  }
  async function supprimer(d) {
    if (!current.isAdmin) return;
    if (!window.confirm("Supprimer définitivement cette décision du CJN ? (erreur de saisie uniquement)")) return;
    try { await deleteDoc(doc(db, COL_CJN, d.id)); setListe((l) => l.filter((x) => x.id !== d.id)); } catch (x) { console.error(x); setMsg("❌ Suppression impossible."); }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <Entete icone="⚖️" titre="CJN — Casier Judiciaire National" texte="Le CJN ne contient que les condamnations prononcées par un juge. Seul un Officier de Police Judiciaire (OPJ) peut y inscrire une décision, au vu de la décision rendue. Les inscriptions sont définitives." />
      {!peut && <div style={{ ...CARTE, background: "#FFF7E6", borderColor: "#E0B15A", color: "#6B4A00", fontSize: 14 }}>🔒 Tu peux consulter le CJN, mais seul un OPJ peut y inscrire une décision.</div>}
      <RechercheRoblox onTrouve={trouver} />
      {compte && (
        <>
          <Identite compte={compte} avatar={avatars[compte.id]} badges={<Pastille n={liste.length} label="Condamnations" couleur="#7A1FA2" />} />
          <div style={CARTE}>
            <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: "#14213A", marginBottom: 6 }}>Décisions inscrites</div>
            {liste.length === 0 ? <div style={{ fontSize: 14, color: "#5A6B84", padding: "10px 0" }}>Casier vierge : aucune condamnation.</div> : liste.map((d) => (
              <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}><Ligne pastille={d.gravite || "CJN"} couleur={COUL[d.gravite] || "#7A1FA2"} titre={(d.infractions || []).map((i) => i.nom).join(", ")} sous={`${d.juridiction} · Juge : ${d.juge} · ${d.peine}${d.duree ? " " + d.duree : ""}${d.montant ? " · " + d.montant : ""}${d.numeroAffaire ? " · affaire n° " + d.numeroAffaire : ""}${d.observations ? " · " + d.observations : ""} · Inscrit par ${d.saisiParNom || "—"}`} date={d.dateDecision} /></div>
                {current.isAdmin && <button type="button" onClick={() => supprimer(d)} title="Supprimer (erreur de saisie)" style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 16, marginTop: 10 }}>🗑️</button>}
              </div>
            ))}
          </div>
          {peut && (
            <form onSubmit={enregistrer} style={CARTE}>
              <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: "#14213A" }}>Inscrire une décision de justice</div>
              <div style={{ fontSize: 12.5, color: "#5A6B84", marginTop: 2 }}>À remplir uniquement lorsqu'un juge a prononcé la condamnation.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "0 14px" }}>
                <div><label style={LAB}>Juridiction</label><select style={INP} value={f.juridiction} onChange={(e) => maj("juridiction", e.target.value)}>{JURIDICTIONS.map((j) => <option key={j}>{j}</option>)}</select></div>
                <div><label style={LAB}>Juge (nom RP)</label><input style={INP} value={f.juge} onChange={(e) => maj("juge", e.target.value)} placeholder="Ex : Mme Durand" /></div>
                <div><label style={LAB}>Date de la décision</label><input type="date" style={INP} value={f.dateDecision} onChange={(e) => maj("dateDecision", e.target.value)} /></div>
                <div><label style={LAB}>N° d'affaire (facultatif)</label><input style={INP} value={f.numeroAffaire} onChange={(e) => maj("numeroAffaire", e.target.value)} /></div>
              </div>
              <label style={LAB}>Infractions retenues</label>
              <ChoixInfractions codePenal={codePenal} choisies={f.infractions} onChange={(v) => maj("infractions", v)} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "0 14px" }}>
                <div><label style={LAB}>Peine prononcée</label><select style={INP} value={f.peine} onChange={(e) => maj("peine", e.target.value)}>{PEINES.map((j) => <option key={j}>{j}</option>)}</select></div>
                <div><label style={LAB}>Durée / modalités</label><input style={INP} value={f.duree} onChange={(e) => maj("duree", e.target.value)} placeholder="Ex : 6 mois, 2 ans d'interdiction" /></div>
                <div><label style={LAB}>Amende (si prononcée)</label><input style={INP} value={f.montant} onChange={(e) => maj("montant", e.target.value)} placeholder="Ex : 1500 €" /></div>
              </div>
              <label style={LAB}>Observations (facultatif)</label>
              <textarea style={{ ...INP, minHeight: 60 }} value={f.observations} onChange={(e) => maj("observations", e.target.value)} />
              <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button type="submit" disabled={busy} style={{ ...BTN, opacity: busy ? 0.7 : 1 }}>{busy ? "Inscription…" : "⚖️ Inscrire au CJN"}</button>
                {msg && <span style={{ fontSize: 13.5, fontWeight: 600, color: msg.startsWith("✅") ? "#1F6B42" : "#8A1020" }}>{msg}</span>}
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
