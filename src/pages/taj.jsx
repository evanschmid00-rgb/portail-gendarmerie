// pages/taj.jsx — TAJ (Traitement des Antécédents Judiciaires) et CJN (Casier Judiciaire National).
//  • TAJ : tout gendarme recherche une personne par son @ Roblox et voit ses antécédents (mentions, PV, plaintes, enquêtes BR, condamnations).
//  • CJN : seules les condamnations prononcées par un juge y sont inscrites, uniquement par un OPJ, et elles ne sont jamais purgées.
import React, { useState, useEffect } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { ChoixInfractions } from "../composants/ChoixInfractions.jsx";
import { FicheCasier } from "../composants/FicheCasier.jsx";
import { N, FONT_N, NeoAlerte, NeoBandeau, NeoBouton, NeoCarte, NeoCompteur, NeoFiche, NeoLigne, NeoOnglets, NEO_INP, NEO_LAB } from "../composants/neo.jsx";
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
    <NeoCarte>
      <form onSubmit={chercher}>
        <label style={{ ...NEO_LAB, marginTop: 0 }}>Identifiant Roblox de la personne</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px", position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: 11, fontWeight: 800, color: N.accent, fontSize: 17 }}>@</span>
            <input style={{ ...NEO_INP, paddingLeft: 34, fontSize: 16, fontWeight: 600 }} value={at.replace(/^@/, "")} onChange={(e) => setAt(e.target.value)} placeholder="NomUtilisateur" autoFocus autoCapitalize="none" autoCorrect="off" />
          </div>
          <NeoBouton type="submit" disabled={busy || occupe}>{busy ? "RECHERCHE…" : "RECHERCHER"}</NeoBouton>
        </div>
        {err && <div style={{ marginTop: 10 }}><NeoAlerte ton="danger" icone="⚠️">{err}</NeoAlerte></div>}
      </form>
    </NeoCarte>
  );
}

function FicheIndividu({ compte, avatar, extra }) {
  return (
    <NeoCarte style={{ borderTop: `4px solid ${N.accent}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Avatar src={avatar} taille={72} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: "inline-block", background: "#E3F4EA", color: "#1F6B42", fontSize: 11, fontWeight: 800, borderRadius: 8, padding: "2px 9px", marginBottom: 4, letterSpacing: 0.5 }}>✓ COMPTE ROBLOX VÉRIFIÉ</div>
          <div style={{ fontFamily: FONT_N, fontSize: 26, fontWeight: 700, color: N.encre, lineHeight: 1.1 }}>{compte.displayName}</div>
          <div style={{ fontSize: 13, color: N.gris }}>@{compte.username}</div>
        </div>
        <NeoFiche colonnes={3} champs={[["Identifiant", compte.id], ...(extra || [])]} />
      </div>
    </NeoCarte>
  );
}

// ───────────── TAJ ─────────────
export function TajPage({ current }) {
  const [fiche, setFiche] = useState(null);
  const [bulletin, setBulletin] = useState(false);
  const [onglet, setOnglet] = useState("synthese");
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
    setBulletin(false); setOnglet("synthese");
    setFiche({
      compte: c, consulteLe: new Date(),
      mentions: dossiers.filter((d) => memePersonne(d, moi)).flatMap((d) => d.mentions || []),
      pieces: pieces.filter((p) => memePersonne(moi, p)),
      cjn, enquetes,
    });
  }

  const f = fiche;
  const mentions = f ? [...f.mentions].sort((a, b) => String(b.dateFaits || b.createdAt || "").localeCompare(String(a.dateFaits || a.createdAt || ""))) : [];
  const lCjn = f ? f.cjn.map((d) => ({ k: "c" + d.id, date: d.dateDecision, pastille: "CJN", couleur: "#7A1FA2", titre: (d.infractions || []).map((i) => i.nom).join(", ") || "Condamnation", sous: [d.juridiction, d.peine && `${d.peine}${d.duree ? " " + d.duree : ""}${d.montant ? " · " + d.montant : ""}`].filter(Boolean).join(" · "), detail: <NeoFiche champs={[["Juridiction", d.juridiction], ["Juge", d.juge], ["Date de la décision", jour(d.dateDecision)], ["N° d'affaire", d.numeroAffaire], ["Peine", d.peine], ["Durée", d.duree], ["Amende", d.montant], ["Inscrit par", d.saisiParNom], ["Observations", d.observations]]} /> })) : [];
  const lMentions = mentions.map((m, i) => ({ k: "m" + (m.id || i), date: m.dateFaits || m.createdAt, pastille: m.gravite || "MENTION", couleur: COUL[m.gravite] || "#123A7A", titre: m.nature, sous: [m.amende && `Amende ${m.amende}`, m.tempsGav && `GAV ${m.tempsGav}`].filter(Boolean).join(" · "), detail: <NeoFiche champs={[["Gravité", m.gravite], ["Date des faits", jour(m.dateFaits || m.createdAt)], ["Amende", m.amende], ["Temps de GAV", m.tempsGav], ["PV de référence", m.pvRef], ["Agent", m.gendarmeNom], ["Remarques", m.remarques]]} /> }));
  const lPieces = f ? f.pieces.map((p) => ({ k: "p" + p.id, date: p.dateFaits || p.createdAt, pastille: p.type === "Plainte" ? "PLAINTE" : "PV", couleur: p.type === "Plainte" ? "#B04A00" : "#123A7A", titre: `${p.titre || p.type}${p.ref ? " · " + p.ref : ""}`, sous: [p.role && `Rôle : ${p.role}`, p.lieu].filter(Boolean).join(" · "), detail: <NeoFiche champs={[["Référence", p.ref], ["Rôle", p.role], ["Lieu", p.lieu], ["Date des faits", jour(p.dateFaits || p.createdAt)], ["Rédigé par", p.auteurNom && `${p.auteurGrade ? p.auteurGrade + " " : ""}${p.auteurNom}`], ["Visé par", p.viseParNom], ["Résumé", p.resume]]} /> })) : [];
  const lEnq = f ? f.enquetes.map((e) => { const role = ((e.suspects || []).find((x) => String(x.robloxId) === String(f.compte.id)) || {}).role || "Mis en cause"; return { k: "e" + e.id, date: e.dateFaits || e.createdAt, pastille: "BR", couleur: "#0F6E6E", titre: `${e.type === "Flagrance" ? "Flagrance" : "Préliminaire"} · ${e.titre || e.infraction || "Enquête"}`, sous: `Rôle : ${role} · ${e.statut || ""}`, detail: <NeoFiche champs={[["Type", e.type], ["Statut", e.statut], ["Rôle", role], ["Infraction", e.infraction], ["Date des faits", jour(e.dateFaits || e.createdAt)]]} /> }; }) : [];
  const parOnglet = { synthese: [...lCjn, ...lMentions, ...lPieces, ...lEnq].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))), cjn: lCjn, mentions: lMentions, pieces: lPieces, enquetes: lEnq };
  const enCours = f ? f.enquetes.filter((e) => !/class|clos/i.test(String(e.statut || ""))).length : 0;
  const onglets = f ? [{ id: "synthese", label: "SYNTHÈSE", n: parOnglet.synthese.length }, { id: "cjn", label: "CJN", n: lCjn.length, couleur: "#7A1FA2" }, { id: "mentions", label: "MENTIONS", n: lMentions.length, couleur: "#C77700" }, { id: "pieces", label: "PV / PLAINTES", n: lPieces.length }, ...(voirBR ? [{ id: "enquetes", label: "ENQUÊTES BR", n: lEnq.length, couleur: "#0F6E6E" }] : [])] : [];

  return (
    <div style={{ maxWidth: 940 }}>
      <NeoBandeau surtitre="Fichiers · consultation" titre="TAJ — Traitement des Antécédents Judiciaires" texte="Consulte les antécédents d'une personne à partir de son identifiant Roblox. Chaque consultation est réservée au cadre du service." couleur="#7A1FA2"
        droite={f && <><NeoCompteur n={f.cjn.length} label="CJN" couleur="#B56BD6" /><NeoCompteur n={mentions.length} label="Mentions" couleur="#F0B048" /><NeoCompteur n={f.pieces.length} label="PV / plaintes" couleur="#6FA3FF" /></>} />
      <RechercheRoblox onTrouve={rechercher} />
      {f && (
        <>
          <FicheIndividu compte={f.compte} avatar={avatars[f.compte.id]} extra={[["Consulté le", f.consulteLe.toLocaleString("fr-FR")], ["Consulté par", `${current.grade || ""} ${current.nom || ""}`.trim()]]} />
          {f.cjn.length > 0 && <NeoAlerte ton="justice" icone="⚖️">{f.cjn.length} condamnation{f.cjn.length > 1 ? "s" : ""} inscrite{f.cjn.length > 1 ? "s" : ""} au Casier Judiciaire National.</NeoAlerte>}
          {enCours > 0 && <NeoAlerte ton="attention" icone="🔎">{enCours} enquête{enCours > 1 ? "s" : ""} de la Brigade de Recherche en cours concernant cette personne.</NeoAlerte>}
          {parOnglet.synthese.length === 0 && <NeoAlerte ton="ok" icone="✅">Aucun antécédent enregistré pour ce compte.</NeoAlerte>}
          <NeoOnglets onglets={onglets} actif={onglet} onChange={setOnglet} />
          {(parOnglet[onglet] || []).length === 0 ? <div style={{ fontSize: 14, color: N.gris, padding: "6px 4px 14px" }}>Rien dans cette rubrique.</div> : parOnglet[onglet].map((l) => <NeoLigne key={l.k} couleur={l.couleur} pastille={l.pastille} titre={l.titre} sous={l.sous} date={jour(l.date)} detail={l.detail} />)}
          <div style={{ fontSize: 11.5, color: "#7A8799", margin: "8px 2px 14px", lineHeight: 1.5 }}>Les mentions, PV et plaintes du TAJ sont conservés temporairement (purge automatique). Seules les condamnations du CJN sont définitives.</div>
          <NeoBouton variante="secondaire" onClick={() => setBulletin(!bulletin)} style={{ marginBottom: 14 }}>{bulletin ? "MASQUER" : "AFFICHER"} L'EXTRAIT DU CJN (BULLETIN N°1)</NeoBouton>
          {bulletin && <FicheCasier personne={{ displayName: f.compte.displayName, username: f.compte.username, robloxId: f.compte.id }} avatar={avatars[f.compte.id]} mentions={f.cjn.map(decisionEnMention)} bulletin="1" />}
        </>
      )}
    </div>
  );
}

// ───────────── CJN ─────────────
const VIDE = { juridiction: JURIDICTIONS[1], juge: "", dateDecision: new Date().toISOString().slice(0, 10), numeroAffaire: "", infractions: [], peine: PEINES[0], duree: "", montant: "", observations: "" };
const Etape = ({ n, titre }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 4px" }}>
    <span style={{ width: 26, height: 26, borderRadius: 13, background: "#7A1FA2", color: "#fff", fontFamily: FONT_N, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{n}</span>
    <span style={{ fontFamily: FONT_N, fontSize: 16, fontWeight: 700, color: N.encre, letterSpacing: 0.4 }}>{titre}</span>
  </div>
);

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
    <div style={{ maxWidth: 940 }}>
      <NeoBandeau surtitre="Fichiers · justice" titre="CJN — Casier Judiciaire National" texte="Ne contient que les condamnations prononcées par un juge. Seul un Officier de Police Judiciaire (OPJ) inscrit une décision, au vu de la décision rendue. Les inscriptions sont définitives." couleur="#7A1FA2"
        droite={compte && <NeoCompteur n={liste.length} label="Condamnations" couleur="#B56BD6" />} />
      {!peut && <NeoAlerte ton="attention" icone="🔒">Tu peux consulter le CJN, mais seul un OPJ peut y inscrire une décision.</NeoAlerte>}
      <RechercheRoblox onTrouve={trouver} />
      {compte && (
        <>
          <FicheIndividu compte={compte} avatar={avatars[compte.id]} />
          <NeoCarte titre="Décisions inscrites">
            {liste.length === 0 ? <NeoAlerte ton="ok" icone="✅">Casier vierge : aucune condamnation.</NeoAlerte> : liste.map((d) => (
              <NeoLigne key={d.id} couleur={COUL[d.gravite] || "#7A1FA2"} pastille={(d.gravite || "CJN").toUpperCase()} titre={(d.infractions || []).map((i) => i.nom).join(", ")} sous={`${d.juridiction} · ${d.peine}${d.duree ? " " + d.duree : ""}`} date={jour(d.dateDecision)}
                detail={<><NeoFiche champs={[["Juridiction", d.juridiction], ["Juge", d.juge], ["N° d'affaire", d.numeroAffaire], ["Peine", d.peine], ["Durée", d.duree], ["Amende", d.montant], ["Inscrit par", d.saisiParNom], ["Observations", d.observations]]} />{current.isAdmin && <div style={{ marginTop: 10 }}><NeoBouton variante="danger" onClick={() => supprimer(d)} style={{ padding: "7px 14px", fontSize: 12 }}>SUPPRIMER (ERREUR DE SAISIE)</NeoBouton></div>}</>} />
            ))}
          </NeoCarte>
          {peut && (
            <NeoCarte titre="Inscrire une décision de justice">
              <form onSubmit={enregistrer}>
                <div style={{ fontSize: 12.5, color: N.gris }}>À remplir uniquement lorsqu'un juge a prononcé la condamnation.</div>
                <Etape n="1" titre="La décision" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "0 14px" }}>
                  <div><label style={NEO_LAB}>Juridiction</label><select style={NEO_INP} value={f.juridiction} onChange={(e) => maj("juridiction", e.target.value)}>{JURIDICTIONS.map((j) => <option key={j}>{j}</option>)}</select></div>
                  <div><label style={NEO_LAB}>Juge (nom RP)</label><input style={NEO_INP} value={f.juge} onChange={(e) => maj("juge", e.target.value)} placeholder="Ex : Mme Durand" /></div>
                  <div><label style={NEO_LAB}>Date de la décision</label><input type="date" style={NEO_INP} value={f.dateDecision} onChange={(e) => maj("dateDecision", e.target.value)} /></div>
                  <div><label style={NEO_LAB}>N° d'affaire (facultatif)</label><input style={NEO_INP} value={f.numeroAffaire} onChange={(e) => maj("numeroAffaire", e.target.value)} /></div>
                </div>
                <Etape n="2" titre="Les infractions retenues" />
                <ChoixInfractions codePenal={codePenal} choisies={f.infractions} onChange={(v) => maj("infractions", v)} />
                <Etape n="3" titre="La peine prononcée" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "0 14px" }}>
                  <div><label style={NEO_LAB}>Peine</label><select style={NEO_INP} value={f.peine} onChange={(e) => maj("peine", e.target.value)}>{PEINES.map((j) => <option key={j}>{j}</option>)}</select></div>
                  <div><label style={NEO_LAB}>Durée / modalités</label><input style={NEO_INP} value={f.duree} onChange={(e) => maj("duree", e.target.value)} placeholder="Ex : 6 mois, 2 ans d'interdiction" /></div>
                  <div><label style={NEO_LAB}>Amende (si prononcée)</label><input style={NEO_INP} value={f.montant} onChange={(e) => maj("montant", e.target.value)} placeholder="Ex : 1500 €" /></div>
                </div>
                <label style={NEO_LAB}>Observations (facultatif)</label>
                <textarea style={{ ...NEO_INP, minHeight: 60 }} value={f.observations} onChange={(e) => maj("observations", e.target.value)} />
                <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <NeoBouton type="submit" disabled={busy} style={{ background: "#7A1FA2" }}>{busy ? "INSCRIPTION…" : "⚖️ INSCRIRE AU CJN"}</NeoBouton>
                  {msg && <span style={{ fontSize: 13.5, fontWeight: 700, color: msg.startsWith("✅") ? "#1F6B42" : "#8A1020" }}>{msg}</span>}
                </div>
              </form>
            </NeoCarte>
          )}
        </>
      )}
    </div>
  );
}
