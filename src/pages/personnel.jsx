// pages/personnel.jsx — Gestion du personnel (nouvelle interface) : liste filtrable, fiche agent, création de compte,
// actions groupées, rôles. Utilise les mêmes gestionnaires que l'ancien panneau (création, modification, suppression, RIO).
import React, { useState } from "react";
import { PseudosAgent } from "../composants/Pseudos.jsx";
import { h2Style, smallBtn } from "../composants/ui.jsx";
import { GRADES, UNITE_CMD, UNITE_ENC } from "../lib/constantes.js";
import { TOUS_LES_DROITS } from "../lib/droits.js";
import { calculerDroits, numAgent, qualiteDepuisGrade } from "../lib/utils.js";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const BLEU = "#123A7A";
const QUALITES = ["OPJ", "APJ", "APJA"];
const champ = { boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 10, padding: "9px 11px", fontSize: 13, fontFamily: FONT, background: "#fff", width: "100%" };
const nettoyer = (o) => JSON.parse(JSON.stringify(o)); // retire les valeurs « undefined » que Firestore refuse
const bas = (s) => String(s || "").toLowerCase();

const mdpAleatoire = () => {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};
const couleurGrade = (rang, total) => `hsl(218, 64%, ${22 + (total > 1 ? (1 - rang / (total - 1)) : 0) * 30}%)`;

function Etiquette({ texte, couleur = "#3A4D6B", fond = "#EEF2F8", bord }) {
  return <span style={{ display: "inline-block", background: fond, color: couleur, border: bord ? `1px solid ${bord}` : "none", borderRadius: 999, padding: "1px 9px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{texte}</span>;
}

export function PersonnelPage({ current, personnel = [], roles = [], onCreate, onUpdate, onDelete, onAssignRIO, onAncienne }) {
  const [recherche, setRecherche] = useState("");
  const [fGrade, setFGrade] = useState("");
  const [fUnite, setFUnite] = useState("");
  const [fRole, setFRole] = useState("");
  const [fQualite, setFQualite] = useState("");
  const [tri, setTri] = useState("grade");
  const [groupe, setGroupe] = useState("");
  const [selection, setSelection] = useState({});
  const [ouvertId, setOuvertId] = useState("");
  const [creation, setCreation] = useState(false);
  const [toast, setToast] = useState("");
  const [uniteGroupee, setUniteGroupee] = useState("");

  const unites = Array.from(new Set([UNITE_CMD, UNITE_ENC, ...personnel.map((p) => p.unite)].filter(Boolean))).sort();
  const rangDe = (p) => (p.gradeRank ?? GRADES.indexOf(p.grade));
  const nomRole = (id) => (roles.find((r) => r.id === id) || {}).nom;
  const rolesDe = (p) => (p.roles || []).map(nomRole).filter(Boolean);
  const signaler = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const q = bas(recherche.trim());
  const liste = personnel
    .filter((p) => !q || bas(`${p.prenom} ${p.nom} ${numAgent(p)} ${p.cipcNumero} ${p.pseudoRoblox} ${p.pseudoDiscord} ${p.username} ${p.fonction} ${p.sousFonction}`).includes(q))
    .filter((p) => !fGrade || p.grade === fGrade)
    .filter((p) => !fUnite || p.unite === fUnite)
    .filter((p) => !fRole || (p.roles || []).includes(fRole))
    .filter((p) => !fQualite || p.qualiteJudiciaire === fQualite)
    .sort((a, b) => (tri === "nom" ? String(a.nom).localeCompare(String(b.nom))
      : tri === "matricule" ? numAgent(a).localeCompare(numAgent(b))
      : tri === "unite" ? String(a.unite).localeCompare(String(b.unite)) || String(a.nom).localeCompare(String(b.nom))
      : (rangDe(b) - rangDe(a)) || String(a.nom).localeCompare(String(b.nom))));

  const groupes = groupe
    ? Array.from(new Set(liste.map((p) => (groupe === "grade" ? p.grade : p.unite) || "—"))).map((cle) => ({ cle, agents: liste.filter((p) => ((groupe === "grade" ? p.grade : p.unite) || "—") === cle) }))
    : [{ cle: "", agents: liste }];

  const sansRIO = personnel.filter((p) => !p.cipcNumero).length;
  const ids = Object.keys(selection).filter((k) => selection[k]);
  const filtresActifs = !!(recherche || fGrade || fUnite || fRole || fQualite);
  const reinitialiser = () => { setRecherche(""); setFGrade(""); setFUnite(""); setFRole(""); setFQualite(""); };

  // Modifie un agent : on renvoie la fiche complète (le gestionnaire met aussi à jour l'annuaire public)
  async function majAgent(agent, patch) {
    const { id, ...reste } = { ...agent, ...patch };
    if (patch.grade !== undefined) reste.gradeRank = GRADES.indexOf(patch.grade);
    // Changement de grade : la qualité judiciaire suit (GAV = APJA, sous-officier = APJ, officier = OPJ)
    if (patch.grade !== undefined && patch.grade !== agent.grade && qualiteDepuisGrade(patch.grade)) reste.qualiteJudiciaire = qualiteDepuisGrade(patch.grade);
    return onUpdate(agent.id, nettoyer(reste));
  }
  async function actionGroupee(patchDe, libelle, question) {
    if (question && !window.confirm(question)) return;
    let ok = 0;
    for (const id of ids) {
      const a = personnel.find((x) => x.id === id);
      if (!a) continue;
      const r = await majAgent(a, patchDe(a));
      if (r && r.ok) ok++;
    }
    setSelection({});
    signaler(`${libelle} : ${ok}/${ids.length} agent${ids.length > 1 ? "s" : ""}.`);
  }
  // Qualités judiciaires qui ne correspondent pas au grade (GAV = APJA, sous-officier = APJ, officier = OPJ)
  const desaccords = personnel.filter((p) => qualiteDepuisGrade(p.grade) && p.qualiteJudiciaire !== qualiteDepuisGrade(p.grade));
  async function alignerQualites() {
    if (!window.confirm(`Aligner la qualité judiciaire de ${desaccords.length} agent(s) sur leur grade ?`)) return;
    let ok = 0;
    for (const a of desaccords) { const r = await majAgent(a, { qualiteJudiciaire: qualiteDepuisGrade(a.grade) }); if (r === undefined || r === true || (r && r.ok !== false)) ok++; }
    signaler(`Qualité judiciaire alignée : ${ok}/${desaccords.length} agent(s).`);
  }
  async function attribuerRIO() {
    const n = onAssignRIO ? await onAssignRIO() : -1;
    signaler(n >= 0 ? `${n} RIO attribué${n > 1 ? "s" : ""}.` : "Échec de l'attribution des RIO.");
  }

  const tuile = (label, valeur, couleur) => (
    <div key={label} style={{ textAlign: "left", background: "#F5F8FC", border: "1px solid #D3DDEA", borderTop: `4px solid ${couleur}`, borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: couleur, lineHeight: 1.1 }}>{valeur}</div>
      <div style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>{label}</div>
    </div>
  );

  const agentOuvert = personnel.find((p) => p.id === ouvertId);

  return (
    <div style={{ fontFamily: FONT, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <h2 style={{ ...h2Style, marginBottom: 0 }}>Gestion du personnel</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onAncienne && <button type="button" onClick={onAncienne} style={smallBtn} title="Revenir à l'ancien panneau (au cas où)">Ancienne interface</button>}
          <button type="button" onClick={() => setCreation(true)} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: FONT }}>+ Nouvel agent</button>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "#5A6B84", margin: "6px 0 16px" }}>Comptes, grades, unités, rôles de tous les agents, au même endroit.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        {tuile("Effectif", personnel.length, BLEU)}
        {tuile("Administrateurs", personnel.filter((p) => p.isAdmin).length, "#8A2A2A")}
      </div>

      {desaccords.length > 0 && (
        <div style={{ background: "#EEF4FF", border: "1px solid #B7CDF3", color: "#123A7A", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 13, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 240px" }}>⚖️ <b>{desaccords.length}</b> agent{desaccords.length > 1 ? "s ont" : " a"} une qualité judiciaire qui ne correspond pas à son grade (GAV jusqu'à Maréchal des Logis = APJA, sous-officier = APJ, officier = OPJ).</span>
          <button type="button" onClick={alignerQualites} style={smallBtn}>Tout aligner sur le grade</button>
        </div>
      )}
      {sansRIO > 0 && (
        <div style={{ background: "#FFF6E0", border: "1px solid #F0D58A", color: "#5C4300", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 13, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 240px" }}>🪪 <b>{sansRIO}</b> agent{sansRIO > 1 ? "s" : ""} sans numéro RIO.</span>
          <button type="button" onClick={attribuerRIO} style={smallBtn}>Attribuer les RIO manquants</button>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔎 Nom, n° d'agent, RIO, pseudo, identifiant…" style={{ ...champ, flex: "1 1 260px", width: "auto" }} />
        <select value={fGrade} onChange={(e) => setFGrade(e.target.value)} style={{ ...champ, width: "auto" }}><option value="">Tous les grades</option>{[...GRADES].reverse().map((g) => <option key={g} value={g}>{g}</option>)}</select>
        <select value={fUnite} onChange={(e) => setFUnite(e.target.value)} style={{ ...champ, width: "auto" }}><option value="">Toutes les unités</option>{unites.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        <select value={fRole} onChange={(e) => setFRole(e.target.value)} style={{ ...champ, width: "auto" }}><option value="">Tous les rôles</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}</select>
        <select value={fQualite} onChange={(e) => setFQualite(e.target.value)} style={{ ...champ, width: "auto" }}><option value="">OPJ / APJ / APJA</option>{QUALITES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>Trier :</span>
        <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ ...champ, width: "auto", padding: "6px 9px" }}><option value="grade">Grade (haut → bas)</option><option value="nom">Nom</option><option value="matricule">N° d'agent</option><option value="unite">Unité</option></select>
        <span style={{ fontSize: 12, color: "#5A6B84", fontWeight: 700 }}>Grouper :</span>
        <select value={groupe} onChange={(e) => setGroupe(e.target.value)} style={{ ...champ, width: "auto", padding: "6px 9px" }}><option value="">Pas de groupe</option><option value="grade">Par grade</option><option value="unite">Par unité</option></select>
        {filtresActifs && <button type="button" onClick={reinitialiser} style={smallBtn}>Effacer les filtres</button>}
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => { const t = {}; liste.forEach((p) => { t[p.id] = ids.length !== liste.length; }); setSelection(ids.length === liste.length ? {} : t); }} style={smallBtn}>{ids.length === liste.length && liste.length > 0 ? "Tout désélectionner" : "Tout sélectionner"}</button>
      </div>

      {ids.length > 0 && (
        <div style={{ position: "sticky", top: 70, zIndex: 20, background: "#14213A", color: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          <b style={{ fontSize: 13 }}>{ids.length} sélectionné{ids.length > 1 ? "s" : ""}</b>
          <input list="unites-groupees" value={uniteGroupee} onChange={(e) => setUniteGroupee(e.target.value)} placeholder="Nouvelle unité…" style={{ ...champ, width: 180, padding: "6px 9px" }} />
          <datalist id="unites-groupees">{unites.map((u) => <option key={u} value={u} />)}</datalist>
          <button type="button" disabled={!uniteGroupee.trim()} onClick={() => actionGroupee(() => ({ unite: uniteGroupee.trim() }), "Unité modifiée", `Affecter ${ids.length} agent(s) à l'unité « ${uniteGroupee.trim()} » ?`)} style={{ ...smallBtn, opacity: uniteGroupee.trim() ? 1 : 0.5 }}>Changer l'unité</button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => setSelection({})} style={{ ...smallBtn, background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}>Annuler</button>
        </div>
      )}

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 8 }}>{liste.length} agent{liste.length > 1 ? "s" : ""}{filtresActifs ? ` sur ${personnel.length}` : ""}</div>

      {groupes.map((g) => (
        <div key={g.cle || "tous"} style={{ marginBottom: 18 }}>
          {groupe && <div style={{ fontSize: 13, fontWeight: 800, color: "#14213A", margin: "6px 2px 8px", borderBottom: "2px solid #D3DDEA", paddingBottom: 4 }}>{g.cle} <span style={{ color: "#5A6B84", fontWeight: 600 }}>· {g.agents.length}</span></div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.agents.map((p) => {
              const moi = p.id === current.id;
              const rang = rangDe(p);
              const total = GRADES.length;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: selection[p.id] ? "#EEF4FF" : "#fff", borderStyle: "solid", borderWidth: "1px 1px 1px 5px", borderColor: `${selection[p.id] ? BLEU : "#D3DDEA"} ${selection[p.id] ? BLEU : "#D3DDEA"} ${selection[p.id] ? BLEU : "#D3DDEA"} ${rang >= 0 ? couleurGrade(total - 1 - rang, total) : "#9AA8BD"}`, borderRadius: 12, padding: "10px 14px", boxShadow: "0 4px 14px -10px rgba(7,20,46,0.3)" }}>
                  <input type="checkbox" checked={!!selection[p.id]} onChange={(e) => setSelection({ ...selection, [p.id]: e.target.checked })} aria-label={`Sélectionner ${p.prenom} ${p.nom}`} style={{ width: 17, height: 17, cursor: "pointer" }} />
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#E6EDF7", color: BLEU, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{`${(p.prenom || "?")[0]}${(p.nom || "?")[0]}`.toUpperCase()}</div>
                  <div style={{ flex: "1 1 230px", minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: "#14213A" }}>
                      {p.prenom} {p.nom}
                      {moi && <span style={{ marginLeft: 6, background: BLEU, color: "#fff", borderRadius: 999, padding: "0 7px", fontSize: 10.5, fontWeight: 700 }}>Toi</span>}
                      {p.isAdmin && <span style={{ marginLeft: 6 }}><Etiquette texte="Admin" couleur="#8A2A2A" fond="#FBE3E7" /></span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 2 }}>{[p.cipcNumero ? `N° ${numAgent(p)}` : "", p.cipcNumero ? `RIO ${p.cipcNumero}` : "sans RIO", p.username].filter(Boolean).join(" · ")}<PseudosAgent agent={p} /></div>
                  </div>
                  <div style={{ flex: "1 1 200px", minWidth: 0, fontSize: 12.5, color: "#14213A", lineHeight: 1.45 }}>
                    <b>{p.grade}</b>{p.qualiteJudiciaire ? ` · ${p.qualiteJudiciaire}` : ""}
                    <div style={{ color: "#5A6B84", fontSize: 11.5 }}>{[p.unite, p.fonction, p.sousFonction].filter(Boolean).join(" — ")}</div>
                  </div>
                  <div style={{ flex: "1 1 190px", display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {rolesDe(p).map((r) => <Etiquette key={r} texte={r} couleur="#3B45B5" fond="#ECEEFE" />)}
                  </div>
                  <button type="button" onClick={() => setOuvertId(p.id)} style={{ ...smallBtn, background: "#E6EDF7", fontWeight: 700 }}>Ouvrir la fiche</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18 }}>Aucun agent ne correspond aux filtres.</div>}

      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#14213A", color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9500, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>{toast}</div>}

      {agentOuvert && (
        <FicheAgent key={agentOuvert.id} agent={agentOuvert} current={current} roles={roles} unites={unites}
          onClose={() => setOuvertId("")} onSave={async (patch) => majAgent(agentOuvert, patch)}
          onDelete={async () => { await onDelete(agentOuvert.id); setOuvertId(""); signaler("Compte supprimé."); }} signaler={signaler} />
      )}
      {creation && <NouvelAgent unites={unites} onClose={() => setCreation(false)} onCreate={onCreate} />}
    </div>
  );
}

/* ---------- Fiche d'un agent (panneau latéral) ---------- */

function Cadre({ titre, children }) {
  return (
    <div style={{ border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px", marginBottom: 14, background: "#fff" }}>
      <div style={{ fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 800, marginBottom: 10 }}>{titre}</div>
      {children}
    </div>
  );
}
const Ligne = ({ label, children }) => (
  <label style={{ display: "block", marginBottom: 10 }}>
    <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#14213A", marginBottom: 3 }}>{label}</span>
    {children}
  </label>
);

function FicheAgent({ agent, current, roles, unites, onClose, onSave, onDelete, signaler }) {
  const [f, setF] = useState({
    prenom: agent.prenom || "", nom: agent.nom || "", grade: agent.grade || "", unite: agent.unite || "", fonction: agent.fonction || "", sousFonction: agent.sousFonction || "",
    qualiteJudiciaire: agent.qualiteJudiciaire || "APJA", pseudoRoblox: agent.pseudoRoblox || "", pseudoDiscord: agent.pseudoDiscord || "", dateNaissance: agent.dateNaissance || "", lieuNaissance: agent.lieuNaissance || "",
    roles: (agent.roles || []).filter((r) => roles.some((ro) => ro.id === r)),
    manuelles: Array.isArray(agent.qualifsManuelles) ? agent.qualifsManuelles : (agent.qualifications || []),
    adminManuel: agent.adminManuel !== undefined ? !!agent.adminManuel : !!agent.isAdmin,
  });
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (patch) => setF((x) => ({ ...x, ...patch }));
  const moi = agent.id === current.id;

  async function enregistrer() {
    setErreur("");
    if (!f.prenom.trim() || !f.nom.trim()) { setErreur("Le prénom et le nom sont obligatoires."); return; }
    const patch = { prenom: f.prenom.trim(), nom: f.nom.trim(), grade: f.grade, unite: f.unite.trim(), fonction: f.fonction.trim(), sousFonction: f.sousFonction.trim(), qualiteJudiciaire: f.qualiteJudiciaire, pseudoRoblox: f.pseudoRoblox.trim(), pseudoDiscord: f.pseudoDiscord.trim(), dateNaissance: f.dateNaissance || "", lieuNaissance: f.lieuNaissance.trim() };

    // Rôles : on recalcule les droits comme le fait la page Rôles & Permissions
    const rolesAvant = (agent.roles || []).slice().sort().join("|");
    const manuAvant = (Array.isArray(agent.qualifsManuelles) ? agent.qualifsManuelles : (agent.qualifications || [])).slice().sort().join("|");
    const adminAvant = agent.adminManuel !== undefined ? !!agent.adminManuel : !!agent.isAdmin;
    if (f.roles.slice().sort().join("|") !== rolesAvant || f.manuelles.slice().sort().join("|") !== manuAvant || f.adminManuel !== adminAvant) {
      const droits = calculerDroits(f.roles, roles, f.manuelles, f.adminManuel);
      if (moi && agent.isAdmin && !droits.isAdmin) { setErreur("Tu ne peux pas te retirer toi-même les droits administrateur."); return; }
      Object.assign(patch, { roles: f.roles, qualifications: droits.qualifications, isAdmin: droits.isAdmin, qualifsManuelles: f.manuelles, adminManuel: f.adminManuel });
    }
    setBusy(true);
    const r = await onSave(patch);
    setBusy(false);
    if (r && r.ok === false) { setErreur(r.error || "Échec de l'enregistrement."); return; }
    signaler("✓ Fiche enregistrée.");
    onClose();
  }

  async function supprimer() {
    if (moi) { setErreur("Tu ne peux pas supprimer ton propre compte."); return; }
    const saisie = window.prompt(`Supprimer définitivement le compte de ${agent.prenom} ${agent.nom} ?\n\nTape SUPPRIMER pour confirmer.`);
    if (saisie !== "SUPPRIMER") return;
    setBusy(true);
    await onDelete();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", justifyContent: "flex-end", background: "rgba(7,20,46,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(540px, 100%)", height: "100%", background: "#F3F6FB", overflowY: "auto", boxShadow: "-12px 0 40px rgba(0,0,0,0.35)", fontFamily: FONT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 2, background: "linear-gradient(135deg, #0C2655, #123A7A)", color: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>{agent.prenom} {agent.nom}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{[agent.cipcNumero ? `N° ${numAgent(agent)}` : "", agent.cipcNumero ? `RIO ${agent.cipcNumero}` : "", agent.username].filter(Boolean).join(" · ")}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ background: "rgba(255,255,255,0.16)", border: "none", color: "#fff", borderRadius: 8, width: 36, height: 36, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: 18 }}>
          <Cadre titre="Identité">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 180px" }}><Ligne label="Prénom"><input style={champ} value={f.prenom} onChange={(e) => maj({ prenom: e.target.value })} /></Ligne></div>
              <div style={{ flex: "1 1 180px" }}><Ligne label="Nom"><input style={champ} value={f.nom} onChange={(e) => maj({ nom: e.target.value })} /></Ligne></div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 180px" }}><Ligne label="Date de naissance"><input type="date" style={champ} value={f.dateNaissance} onChange={(e) => maj({ dateNaissance: e.target.value })} /></Ligne></div>
              <div style={{ flex: "1 1 180px" }}><Ligne label="Lieu de naissance"><input style={champ} value={f.lieuNaissance} onChange={(e) => maj({ lieuNaissance: e.target.value })} /></Ligne></div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 180px" }}><Ligne label="Pseudo Roblox"><input style={champ} value={f.pseudoRoblox} onChange={(e) => maj({ pseudoRoblox: e.target.value })} /></Ligne></div>
              <div style={{ flex: "1 1 180px" }}><Ligne label="Pseudo Discord"><input style={champ} value={f.pseudoDiscord} onChange={(e) => maj({ pseudoDiscord: e.target.value })} /></Ligne></div>
            </div>
          </Cadre>

          <Cadre titre="Poste">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <Ligne label="Grade">
                  <select style={champ} value={f.grade} onChange={(e) => maj({ grade: e.target.value })}>
                    {!GRADES.includes(f.grade) && f.grade && <option value={f.grade}>{f.grade}</option>}
                    {[...GRADES].reverse().map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Ligne>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <Ligne label="Qualité judiciaire">
                  <select style={champ} value={f.qualiteJudiciaire} onChange={(e) => maj({ qualiteJudiciaire: e.target.value })}>{QUALITES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
                </Ligne>
              </div>
            </div>
            {f.grade !== agent.grade && <div style={{ fontSize: 11.5, color: "#8A5A00", background: "#FFF6E0", borderRadius: 8, padding: "6px 9px", marginBottom: 10 }}>Changement de grade direct. Pour garder une trace officielle (promotion / rétrogradation), utilise plutôt la page Promotions.</div>}
            <Ligne label="Unité">
              <input list="liste-unites" style={champ} value={f.unite} onChange={(e) => maj({ unite: e.target.value })} />
              <datalist id="liste-unites">{unites.map((u) => <option key={u} value={u} />)}</datalist>
            </Ligne>
            <Ligne label="Fonction"><input style={champ} value={f.fonction} onChange={(e) => maj({ fonction: e.target.value })} placeholder="Ex : Commandant de brigade" /></Ligne>
            <Ligne label="Sous-fonction"><input style={champ} value={f.sousFonction} onChange={(e) => maj({ sousFonction: e.target.value })} placeholder="Ex : Adjoint, Formateur conduite…" /></Ligne>
          </Cadre>

          <Cadre titre="Rôles et droits">
            {roles.length === 0 && <div style={{ fontSize: 12.5, color: "#5A6B84" }}>Aucun rôle n'existe. Crées-en dans « Rôles & Permissions ».</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {roles.map((r) => {
                const actif = f.roles.includes(r.id);
                return (
                  <button key={r.id} type="button" onClick={() => maj({ roles: actif ? f.roles.filter((x) => x !== r.id) : [...f.roles, r.id] })} style={{ cursor: "pointer", fontFamily: FONT, background: actif ? "#ECEEFE" : "#fff", color: actif ? "#3B45B5" : "#3A4D6B", border: `1px solid ${actif ? "#3B45B5" : "#C3D0E2"}`, borderRadius: 999, padding: "5px 13px", fontSize: 12.5, fontWeight: 700 }}>{actif ? "✓ " : ""}{r.nom}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 8 }}>Les droits (admin, OPJ, recruteur…) sont recalculés automatiquement à l'enregistrement.</div>
          </Cadre>

          <details style={{ border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 16px", marginBottom: 14, background: "#fff" }}>
            <summary style={{ cursor: "pointer", fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 800 }}>Droits supplémentaires (hors rôles)</summary>
            <div style={{ fontSize: 11.5, color: "#5A6B84", margin: "8px 0 10px", lineHeight: 1.5 }}>À utiliser seulement si un droit ne doit pas passer par un rôle. Ces droits s'ajoutent à ceux des rôles.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {TOUS_LES_DROITS.map((d) => {
                const actif = f.manuelles.includes(d);
                return <button key={d} type="button" onClick={() => maj({ manuelles: actif ? f.manuelles.filter((x) => x !== d) : [...f.manuelles, d] })} style={{ cursor: "pointer", fontFamily: FONT, background: actif ? "#ECEEFE" : "#fff", color: actif ? "#3B45B5" : "#3A4D6B", border: `1px solid ${actif ? "#3B45B5" : "#C3D0E2"}`, borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 700 }}>{actif ? "✓ " : ""}{d}</button>;
              })}
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, cursor: "pointer", background: f.adminManuel ? "#FBE3E7" : "transparent", borderRadius: 8, padding: f.adminManuel ? "6px 8px" : 0 }}>
              <input type="checkbox" checked={f.adminManuel} onChange={(e) => maj({ adminManuel: e.target.checked })} style={{ marginTop: 3 }} />
              <span><b>Administrateur (accès complet)</b>{f.adminManuel ? <span style={{ display: "block", color: "#8A1020", fontSize: 11.5 }}>⚠️ Cette personne pourra tout gérer sur le site.</span> : null}</span>
            </label>
          </details>

          <Cadre titre="Compte">
            <div style={{ fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.7 }}>
              Identifiant : <b>{agent.username || "—"}</b><br />N° d'agent : <b>{agent.cipcNumero ? numAgent(agent) : "—"}</b> · RIO : <b>{agent.cipcNumero || "non attribué"}</b>
            </div>
            <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 6 }}>Le mot de passe ne peut pas être modifié depuis le site.</div>
          </Cadre>

          {erreur && <div style={{ background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>{erreur}</div>}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
            <button type="button" onClick={enregistrer} disabled={busy} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "12px 22px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: FONT, opacity: busy ? 0.7 : 1 }}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
            <button type="button" onClick={onClose} style={{ ...smallBtn, padding: "11px 16px" }}>Annuler</button>
            <div style={{ flex: 1 }} />
            {!moi && <button type="button" onClick={supprimer} style={{ ...smallBtn, padding: "11px 16px", color: "#C0172D", borderColor: "#C0172D" }}>🗑 Supprimer le compte</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Création d'un compte ---------- */

function NouvelAgent({ unites, onClose, onCreate }) {
  const gradeBas = GRADES[0] || "";
  const [f, setF] = useState({ prenom: "", nom: "", username: "", password: mdpAleatoire(), grade: gradeBas, unite: "", fonction: "", sousFonction: "", qualiteJudiciaire: "APJA" });
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const [cree, setCree] = useState(null);
  const [copie, setCopie] = useState(false);
  const maj = (patch) => setF((x) => ({ ...x, ...patch }));

  const proposerIdentifiant = (prenom, nom) => `${String(prenom).trim()}.${String(nom).trim()}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]+/g, "");

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    if (!f.prenom.trim() || !f.nom.trim() || !f.username.trim() || !f.unite.trim()) { setErreur("Prénom, nom, identifiant et unité sont obligatoires."); return; }
    if (f.password.length < 6) { setErreur("Mot de passe trop court (6 caractères minimum)."); return; }
    setBusy(true);
    const r = await onCreate({ ...f, prenom: f.prenom.trim(), nom: f.nom.trim(), username: f.username.trim(), unite: f.unite.trim() });
    setBusy(false);
    if (r && r.ok) setCree({ identifiant: f.username.trim(), motDePasse: f.password, nom: `${f.prenom.trim()} ${f.nom.trim()}` });
    else setErreur((r && r.error) || "Échec de la création du compte.");
  }
  async function copier() {
    const texte = `Identifiant : ${cree.identifiant}\nMot de passe : ${cree.motDePasse}`;
    try { await navigator.clipboard.writeText(texte); setCopie(true); setTimeout(() => setCopie(false), 2000); } catch (e) { /* copie impossible */ }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(7,20,46,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)", maxHeight: "92vh", overflowY: "auto", background: "#F3F6FB", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.4)", fontFamily: FONT }}>
        <div style={{ background: "linear-gradient(135deg, #0C2655, #123A7A)", color: "#fff", padding: "16px 20px", borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1, fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 22, fontWeight: 700 }}>+ Nouvel agent</div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ background: "rgba(255,255,255,0.16)", border: "none", color: "#fff", borderRadius: 8, width: 36, height: 36, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        {cree ? (
          <div style={{ padding: 22 }}>
            <div style={{ background: "#E3F2E8", border: "1px solid #2E7D4F", borderRadius: 12, padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 32 }}>✅</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#1F6B42", margin: "4px 0 10px" }}>Compte créé pour {cree.nom}</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 15, background: "#fff", border: "2px dashed #123A7A", borderRadius: 10, padding: "12px 10px", color: "#123A7A", userSelect: "all", lineHeight: 1.8 }}>Identifiant : <b>{cree.identifiant}</b><br />Mot de passe : <b>{cree.motDePasse}</b></div>
              <div style={{ fontSize: 12, color: "#5A6B84", margin: "10px 0" }}>Note ces informations maintenant : le mot de passe ne sera plus affiché.</div>
              <button type="button" onClick={copier} style={smallBtn}>{copie ? "✓ Copié" : "📋 Copier l'identifiant et le mot de passe"}</button>
            </div>
            <div style={{ textAlign: "right", marginTop: 14 }}><button type="button" onClick={onClose} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>Terminer</button></div>
          </div>
        ) : (
          <form onSubmit={creer} style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}><Ligne label="Prénom *"><input style={champ} value={f.prenom} onChange={(e) => maj({ prenom: e.target.value, username: f.username || proposerIdentifiant(e.target.value, f.nom) })} autoFocus /></Ligne></div>
              <div style={{ flex: "1 1 200px" }}><Ligne label="Nom *"><input style={champ} value={f.nom} onChange={(e) => maj({ nom: e.target.value, username: !f.username || f.username === proposerIdentifiant(f.prenom, f.nom) ? proposerIdentifiant(f.prenom, e.target.value) : f.username })} /></Ligne></div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}><Ligne label="Identifiant de connexion *"><input style={champ} value={f.username} onChange={(e) => maj({ username: e.target.value })} /></Ligne></div>
              <div style={{ flex: "1 1 200px" }}>
                <Ligne label="Mot de passe provisoire *">
                  <div style={{ display: "flex", gap: 6 }}>
                    <input style={champ} value={f.password} onChange={(e) => maj({ password: e.target.value })} />
                    <button type="button" onClick={() => maj({ password: mdpAleatoire() })} style={{ ...smallBtn, whiteSpace: "nowrap" }} title="Générer un autre mot de passe">🎲</button>
                  </div>
                </Ligne>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}><Ligne label="Grade"><select style={champ} value={f.grade} onChange={(e) => maj({ grade: e.target.value })}>{[...GRADES].reverse().map((g) => <option key={g} value={g}>{g}</option>)}</select></Ligne></div>
              <div style={{ flex: "1 1 200px" }}><Ligne label="Qualité judiciaire"><select style={champ} value={f.qualiteJudiciaire} onChange={(e) => maj({ qualiteJudiciaire: e.target.value })}>{QUALITES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Ligne></div>
            </div>
            <Ligne label="Unité *">
              <input list="unites-creation" style={champ} value={f.unite} onChange={(e) => maj({ unite: e.target.value })} />
              <datalist id="unites-creation">{unites.map((u) => <option key={u} value={u} />)}</datalist>
            </Ligne>
            <Ligne label="Fonction (facultatif)"><input style={champ} value={f.fonction} onChange={(e) => maj({ fonction: e.target.value })} /></Ligne>
            <Ligne label="Sous-fonction (facultatif)"><input style={champ} value={f.sousFonction} onChange={(e) => maj({ sousFonction: e.target.value })} /></Ligne>
            {erreur && <div style={{ background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>{erreur}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} style={{ ...smallBtn, padding: "11px 16px" }}>Annuler</button>
              <button type="submit" disabled={busy} style={{ background: BLEU, color: "#fff", border: "none", borderRadius: 10, padding: "12px 22px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: FONT, opacity: busy ? 0.7 : 1 }}>{busy ? "Création…" : "Créer le compte"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
