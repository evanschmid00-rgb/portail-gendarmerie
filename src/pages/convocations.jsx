// pages/convocations.jsx — Convocations : à partir d'Adjudant-Chef, on convoque un gendarme ; le bot lui envoie un message privé (où, quand, par qui, pourquoi).
import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { loadWhere, envoyerConvocationDiscord } from "../lib/donnees.js";
import { peutConvoquer } from "../lib/droits.js";
import { N, FONT_N, NeoAlerte, NeoBandeau, NeoBouton, NeoCarte, NeoCompteur, NeoFiche, NeoLigne, NeoOnglets, NEO_INP, NEO_LAB } from "../composants/neo.jsx";

const nomDe = (p) => `${p.grade ? p.grade + " " : ""}${p.prenom || ""} ${p.nom || ""}`.trim();
const quand = (iso) => { const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); };
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ConvocationsPage({ current, personnel = [] }) {
  const peut = peutConvoquer(current);
  const [emises, setEmises] = useState([]);
  const [recues, setRecues] = useState([]);
  const [f, setF] = useState({ cible: "", lieu: "", dateHeure: "", motif: "" });
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const uid = current.id || current.uid;
  const tri = (l) => l.slice().sort((a, b) => String(b.dateHeure).localeCompare(String(a.dateHeure)));

  useEffect(() => {
    let vivant = true;
    (async () => {
      const [r, e] = await Promise.all([loadWhere("convocations", "cibleUid", "==", uid), peut ? loadWhere("convocations", "parUid", "==", uid) : Promise.resolve([])]);
      if (vivant) { setRecues(tri(r)); setEmises(tri(e)); }
    })();
    return () => { vivant = false; };
  }, [uid, peut]);

  async function repondre(c, reponse) {
    let reponseMotif = "";
    if (reponse === "Empêché") { reponseMotif = (window.prompt("Pourquoi es-tu empêché ? (visible par la personne qui t'a convoqué)") || "").trim().slice(0, 300); if (!reponseMotif) return; }
    try {
      const patch = { reponse, reponseLe: new Date().toISOString(), reponseMotif };
      await updateDoc(doc(db, "convocations", c.id), patch);
      setRecues((l) => l.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    } catch (e) { console.error(e); setMsg({ ok: false, t: "Réponse non enregistrée (règles Firestore des convocations publiées ?)." }); }
  }
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const cibles = personnel.filter((p) => p.id !== uid && (!q.trim() || norm(`${p.prenom} ${p.nom} ${p.matricule}`).includes(norm(q.trim())))).slice(0, 8);
  const cible = personnel.find((p) => p.id === f.cible);

  async function envoyer(e) {
    e.preventDefault();
    if (!cible) { setMsg({ ok: false, t: "Choisis le gendarme à convoquer." }); return; }
    if (!f.lieu.trim() || !f.motif.trim() || !f.dateHeure) { setMsg({ ok: false, t: "Renseigne le lieu, la date et l'heure, et le motif." }); return; }
    const d = new Date(f.dateHeure);
    if (isNaN(d)) { setMsg({ ok: false, t: "Date invalide." }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await envoyerConvocationDiscord({ cibleUid: cible.id, lieu: f.lieu, dateHeure: d.toISOString(), motif: f.motif });
      if (r && r.convocation) setEmises((l) => tri([r.convocation, ...l]));
      setMsg({ ok: !!(r && r.ok), t: r && r.message ? r.message : "Envoi impossible pour le moment." });
      if (r && r.ok) setF({ cible: "", lieu: "", dateHeure: "", motif: "" });
    } catch (x) { console.error(x); setMsg({ ok: false, t: "Échec de l'envoi." }); } finally { setBusy(false); }
  }

  const aVenir = (l) => l.filter((c) => new Date(c.dateHeure) > new Date());
  const aConfirmer = recues.filter((c) => new Date(c.dateHeure) > new Date() && !c.reponse);
  const [onglet, setOnglet] = useState("recues");
  const jourC = (iso) => { const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleDateString("fr-FR"); };
  const ligne = (c, sens) => {
    const passe = new Date(c.dateHeure) < new Date();
    const rep = c.reponse === "Confirmée" ? "✅ Présence confirmée" : c.reponse === "Empêché" ? `❌ Empêché${c.reponseMotif ? " : " + c.reponseMotif : ""}` : "";
    const couleur = passe ? "#8A97AB" : c.reponse === "Empêché" ? "#D62B45" : c.reponse === "Confirmée" ? "#1F9D55" : "#E0A02B";
    return (
      <NeoLigne key={c.id} couleur={couleur} pastille={passe ? "PASSÉE" : "À VENIR"} titre={sens === "emise" ? `Convocation de ${c.cibleNom}` : `Convocation par ${c.parGrade || ""} ${c.parNom}`} sous={`${quand(c.dateHeure)} · ${c.lieu}`} date={jourC(c.dateHeure)}
        detail={<>
          <NeoFiche champs={[["Quand", quand(c.dateHeure)], ["Où", c.lieu], ["Par qui", `${c.parGrade || ""} ${c.parNom}`.trim()], ["Pourquoi", c.motif], ["Message privé", sens === "emise" ? (c.mpEnvoye ? "✓ envoyé" : "⚠ non envoyé") : ""], ["Réponse", rep]]} />
          {sens === "recue" && !passe && !c.reponse && (
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <NeoBouton onClick={() => repondre(c, "Confirmée")} style={{ background: "#1F9D55" }}>✅ JE SERAI PRÉSENT</NeoBouton>
              <NeoBouton variante="secondaire" onClick={() => repondre(c, "Empêché")} style={{ color: "#D62B45", borderColor: "#D62B45" }}>❌ JE SUIS EMPÊCHÉ</NeoBouton>
            </div>
          )}
        </>} />
    );
  };
  const onglets = [{ id: "recues", label: "REÇUES", n: recues.length, couleur: "#E0A02B" }, ...(peut ? [{ id: "emises", label: "ÉMISES", n: emises.length }, { id: "nouvelle", label: "NOUVELLE CONVOCATION" }] : [])];

  return (
    <div style={{ maxWidth: 900 }}>
      <NeoBandeau surtitre="Service · commandement" titre="Convocations" texte={peut ? "Convoque un gendarme : le bot lui envoie aussitôt un message privé avec le lieu, la date, l'auteur et le motif, puis un rappel." : "Retrouve ici les convocations qui te concernent et confirme ta présence."} couleur="#E0A02B"
        droite={<><NeoCompteur n={aVenir(recues).length} label="À venir" couleur="#F0B048" /><NeoCompteur n={aConfirmer.length} label="À confirmer" couleur="#FF6B7E" />{peut && <NeoCompteur n={emises.length} label="Émises" couleur="#6FA3FF" />}</>} />
      {aConfirmer.length > 0 && <NeoAlerte ton="attention" icone="📣">Tu as {aConfirmer.length} convocation{aConfirmer.length > 1 ? "s" : ""} à confirmer. Ouvre-la et indique si tu seras présent.</NeoAlerte>}
      {msg && <NeoAlerte ton={msg.ok ? "ok" : "danger"} icone={msg.ok ? "✅" : "⚠️"}>{msg.t}</NeoAlerte>}
      <NeoOnglets onglets={onglets} actif={onglet} onChange={setOnglet} />

      {onglet === "recues" && (recues.length === 0 ? <NeoAlerte ton="ok" icone="✅">Aucune convocation.</NeoAlerte> : recues.map((c) => ligne(c, "recue")))}
      {onglet === "emises" && peut && (emises.length === 0 ? <NeoAlerte ton="info" icone="ℹ️">Aucune convocation émise.</NeoAlerte> : emises.map((c) => ligne(c, "emise")))}

      {onglet === "nouvelle" && peut && (
        <form onSubmit={envoyer}>
          <NeoCarte titre="1 · Le gendarme à convoquer">
            {cible ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ fontSize: 16 }}>{nomDe(cible)}</b><span style={{ color: N.gris, fontSize: 13 }}>{cible.unite}</span>
                {!cible.discordId && <span style={{ fontSize: 12, color: "#D62B45", fontWeight: 700 }}>⚠ non relié à Discord : pas de message privé possible</span>}
                <NeoBouton variante="secondaire" onClick={() => { maj("cible", ""); setQ(""); }} style={{ padding: "5px 12px", fontSize: 12 }}>CHANGER</NeoBouton>
              </div>
            ) : (
              <>
                <input style={NEO_INP} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Nom, prénom ou matricule…" />
                {q.trim() && (
                  <div style={{ border: "1px solid #B8C7E0", borderRadius: 10, marginTop: 6, maxHeight: 240, overflowY: "auto" }}>
                    {cibles.length === 0 ? <div style={{ padding: 10, fontSize: 13, color: N.gris }}>Aucun résultat.</div> : cibles.map((p) => (
                      <button key={p.id} type="button" onClick={() => maj("cible", p.id)} style={{ display: "block", width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #EEF2F7", background: "#fff", padding: "11px 14px", cursor: "pointer", fontSize: 14 }}>{nomDe(p)} <span style={{ color: "#7B8AA3" }}>· {p.unite}</span></button>
                    ))}
                  </div>
                )}
              </>
            )}
          </NeoCarte>
          <NeoCarte titre="2 · Où, quand, pourquoi">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "0 14px" }}>
              <div><label style={NEO_LAB}>Date et heure</label><input type="datetime-local" style={NEO_INP} value={f.dateHeure} onChange={(e) => maj("dateHeure", e.target.value)} /></div>
              <div><label style={NEO_LAB}>Lieu</label><input style={NEO_INP} value={f.lieu} onChange={(e) => maj("lieu", e.target.value)} placeholder="Ex : Bureau du commandant, caserne" /></div>
            </div>
            <label style={NEO_LAB}>Motif de la convocation</label>
            <textarea style={{ ...NEO_INP, minHeight: 90 }} value={f.motif} onChange={(e) => maj("motif", e.target.value)} placeholder="Explique pourquoi le gendarme est convoqué." />
          </NeoCarte>
          <NeoBouton type="submit" disabled={busy} style={{ width: "100%", padding: "15px 20px", fontSize: 15 }}>{busy ? "ENVOI…" : "📣 CONVOQUER ET PRÉVENIR PAR MESSAGE PRIVÉ"}</NeoBouton>
        </form>
      )}
    </div>
  );
}
