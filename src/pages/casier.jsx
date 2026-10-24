// pages/casier.jsx — code pénal, casier judiciaire (consultation publique et gestion interne)
import React, { useState } from "react";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { FicheCasier } from "../composants/FicheCasier.jsx";
import { Field, Select, buttonPrimary, h2Style, selectStyle, smallBtn } from "../composants/ui.jsx";
import { FONT_TITRE, TYPES_INFRACTION } from "../lib/constantes.js";
import { graviteMax } from "../lib/casierBloquant.js";
import { peutGererCodePenal } from "../lib/droits.js";
import { numAgent, peutSaisirCasierPV } from "../lib/utils.js";
import { memePersonne, resoudreRoblox } from "../lib/dossierPersonne.js";
import { chargerCasierDe } from "../lib/casierRecherche.js";

// Gravité d'une mention : sert à savoir si le casier empêche de déposer une candidature (délit et crime = oui)
const GRAVITE_NC = "Non précisée";
const OPTIONS_GRAVITE = [GRAVITE_NC, "Contravention", "Délit", "Crime"];

/* ---------- Code pénal : affichage commun (consultation publique + page interne) ---------- */

const sansAccents = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const STYLES_TYPE = {
  Contravention: { c: "#2E7D4F", fond: "#E3F2E8", ico: "🟢", desc: "Amende seule" },
  "Délit": { c: "#C77700", fond: "#FFF1DC", ico: "🟠", desc: "Prison + amende · tribunal correctionnel" },
  Crime: { c: "#C0172D", fond: "#FBE3E7", ico: "🔴", desc: "Infraction la plus grave · cour d'assises" },
};
const styleType = (t) => STYLES_TYPE[t] || { c: "#123A7A", fond: "#E6EDF7", ico: "⚪", desc: "" };
const ORDRE_TYPES = ["Contravention", "Délit", "Crime"];
const rangType = (t) => { const i = ORDRE_TYPES.indexOf(t); return i === -1 ? 99 : i; };

function ListeInfractions({ codePenal, actions }) {
  const [search, setSearch] = useState("");
  const [typeFiltre, setTypeFiltre] = useState("");
  const [replies, setReplies] = useState({});

  const q = sansAccents(search.trim());
  const types = Array.from(new Set(codePenal.map((a) => a.type))).sort((a, b) => rangType(a) - rangType(b) || String(a).localeCompare(String(b)));
  const nbParType = {};
  codePenal.forEach((a) => { nbParType[a.type] = (nbParType[a.type] || 0) + 1; });

  const filtres = codePenal.filter((a) => (!typeFiltre || a.type === typeFiltre) && (!q || sansAccents(a.nom).includes(q) || sansAccents(a.article).includes(q) || sansAccents(a.classe).includes(q)));
  const parType = {};
  filtres.forEach((a) => { (parType[a.type] = parType[a.type] || []).push(a); });
  const typesAffiches = Object.keys(parType).sort((a, b) => rangType(a) - rangType(b) || String(a).localeCompare(String(b)));
  const filtreActif = !!(q || typeFiltre);

  return (
    <div>
      {types.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 16 }}>
          {types.map((t) => {
            const st = styleType(t);
            const actif = typeFiltre === t;
            return (
              <button key={t} type="button" onClick={() => setTypeFiltre(actif ? "" : t)} style={{ textAlign: "left", cursor: "pointer", background: actif ? st.fond : "#fff", border: `1px solid ${actif ? st.c : "#D3DDEA"}`, borderTop: `4px solid ${st.c}`, borderRadius: 12, padding: "10px 14px", boxShadow: "0 4px 14px -10px rgba(7,20,46,0.3)", fontFamily: "inherit" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: st.c }}>{st.ico} {t}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: st.c }}>{nbParType[t]}</span>
                </div>
                {st.desc && <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 3, lineHeight: 1.35 }}>{st.desc}</div>}
                <div style={{ fontSize: 10.5, color: "#7A8AA3", marginTop: 5 }}>{actif ? "Filtre actif — cliquer pour retirer" : "Cliquer pour filtrer"}</div>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ flex: "1 1 260px", maxWidth: 380 }}>
          <Field label="Rechercher une infraction" value={search} onChange={setSearch} placeholder="Ex : vitesse, stationnement, vol…" />
        </div>
        <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 14 }}>
          <b>{filtres.length}</b> infraction{filtres.length > 1 ? "s" : ""}
          {filtreActif && <button type="button" onClick={() => { setSearch(""); setTypeFiltre(""); }} style={{ ...smallBtn, marginLeft: 10 }}>Tout afficher</button>}
        </div>
      </div>

      {typesAffiches.map((t) => {
        const st = styleType(t);
        const ouvert = filtreActif || !replies[t];
        const parClasse = {};
        parType[t].forEach((a) => { (parClasse[a.classe || ""] = parClasse[a.classe || ""] || []).push(a); });
        const classes = Object.keys(parClasse).sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
        return (
          <div key={t} style={{ marginBottom: 22 }}>
            <button type="button" onClick={() => !filtreActif && setReplies({ ...replies, [t]: !replies[t] })} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: st.fond, border: `1px solid ${st.c}33`, borderLeft: `5px solid ${st.c}`, borderRadius: 10, padding: "9px 14px", cursor: filtreActif ? "default" : "pointer", marginBottom: 10, fontFamily: "inherit", textAlign: "left" }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: st.c, letterSpacing: 0.3 }}>{st.ico} {t}</span>
              <span style={{ fontSize: 12, color: "#5A6B84", flex: 1 }}>{parType[t].length} infraction{parType[t].length > 1 ? "s" : ""}</span>
              {!filtreActif && <span style={{ color: st.c, fontSize: 13 }}>{ouvert ? "▲" : "▼"}</span>}
            </button>
            {ouvert && classes.map((cl) => (
              <div key={cl || "_"} style={{ marginBottom: 10 }}>
                {cl && <div style={{ fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, margin: "4px 4px 6px" }}>{cl}</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {parClasse[cl].slice().sort((a, b) => (Number(a.amende) || 0) - (Number(b.amende) || 0) || String(a.nom).localeCompare(String(b.nom))).map((a) => (
                    <div key={a.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `4px solid ${st.c}`, borderRadius: 10, padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", boxShadow: "0 3px 12px -8px rgba(7,20,46,0.18)" }}>
                      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: "#14213A" }}>{a.nom}</div>
                        {a.article && <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: 2 }}>⚖️ {a.article}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        {a.amende ? <PuceCasier couleur="#8A5A00" fond="#FFF6E0">💶 {a.amende} crédits</PuceCasier> : null}
                        {a.tempsGav ? <PuceCasier>⏱ {a.tempsGav}</PuceCasier> : null}
                        {actions && actions(a)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {typesAffiches.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13, padding: "14px 4px" }}>{codePenal.length === 0 ? "Aucune infraction enregistrée pour l'instant." : "Aucune infraction ne correspond à ta recherche."}</div>}
    </div>
  );
}

/* ---------- Consultation publique du code pénal ---------- */

export function CodePenalPublic({ codePenal, onCancel }) {
  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 60px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>

        <div style={{ background: "linear-gradient(135deg, #0C2655, #123A7A)", color: "#fff", borderRadius: 16, padding: "22px 24px", marginBottom: 16, boxShadow: "0 10px 30px -14px rgba(7,20,46,0.6)" }}>
          <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>📖 Code Pénal de Nîmes RP</div>
          <div style={{ fontSize: 13.5, opacity: 0.85, lineHeight: 1.5 }}>Toutes les infractions, avec leur amende et leur temps de garde à vue. Touche un type pour filtrer, ou cherche directement une infraction.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginBottom: 20 }}>
          <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.45 }}>💶 <b>Les amendes s'additionnent</b> : toutes les infractions retenues sont cumulées.</div>
          <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.45 }}>⏱ <b>La garde à vue ne s'additionne pas</b> : seul le temps le plus long est retenu.</div>
        </div>

        <ListeInfractions codePenal={codePenal} />
      </div>
    </div>
  );
}

/* ---------- Consultation publique du casier judiciaire ---------- */

/* ---------- Casier judiciaire : outils d'affichage communs ---------- */

const nombreDe = (s) => { const m = String(s || "").replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/); return m ? Number(m[1].replace(",", ".")) : 0; };
const fmtDateCasier = (s) => {
  if (!s) return "Date non précisée";
  const d = new Date(`${s}T12:00:00`);
  return isNaN(d) ? s : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};
export function niveauCasier(n) {
  if (n === 0) return { label: "Casier vierge", couleur: "#2E7D4F", fond: "#E3F2E8" };
  if (n <= 2) return { label: "Casier léger", couleur: "#B7791F", fond: "#FFF6E0" };
  if (n <= 5) return { label: "Casier chargé", couleur: "#D1471F", fond: "#FDE3DA" };
  return { label: "Multirécidiviste", couleur: "#8A1020", fond: "#F8DADF" };
}
export const resumeCasier = (mentions) => ({ n: mentions.length, amendes: mentions.reduce((s, m) => s + nombreDe(m.amende), 0), gav: mentions.filter((m) => m.tempsGav).length });
export const cleDateMention = (m) => String(m.dateFaits || m.createdAt || "");

export function BadgeNiveau({ n }) {
  const nv = niveauCasier(n);
  return <span style={{ background: nv.fond, color: nv.couleur, border: `1px solid ${nv.couleur}`, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 11px", whiteSpace: "nowrap" }}>{nv.label}</span>;
}

export function PuceCasier({ children, couleur = "#3A4D6B", fond = "#F0F4FA" }) {
  return <span style={{ background: fond, color: couleur, fontSize: 12, fontWeight: 600, borderRadius: 14, padding: "3px 10px" }}>{children}</span>;
}

// Une mention sur la frise du casier (le public ne voit ni les remarques ni l'agent)
export function CarteMention({ m, interne, children, dernier }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#C0172D", marginTop: 14, flexShrink: 0 }} />
        {!dernier && <span style={{ flex: 1, width: 2, background: "#D3DDEA", marginTop: 4 }} />}
      </div>
      <div style={{ flex: 1, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "12px 14px", marginBottom: 10, boxShadow: "0 3px 12px -8px rgba(7,20,46,0.2)" }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "#14213A" }}>{m.nature}</div>
        <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>📅 {fmtDateCasier(m.dateFaits)}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {m.amende && <PuceCasier couleur="#8A5A00" fond="#FFF6E0">💶 Amende : {m.amende}</PuceCasier>}
          {m.tempsGav && <PuceCasier couleur="#8A1020" fond="#F8DADF">⏱ GAV : {m.tempsGav}</PuceCasier>}
          {!m.amende && !m.tempsGav && <PuceCasier>Peine non précisée</PuceCasier>}
          {m.gravite && <PuceCasier couleur={styleType(m.gravite).c} fond={styleType(m.gravite).fond}>{styleType(m.gravite).ico} {m.gravite}</PuceCasier>}
        </div>
        {interne && m.pvRef && <div style={{ marginTop: 8 }}><PuceCasier couleur="#123A7A" fond="#E6EDF7">📎 PV lié : {m.pvRef}</PuceCasier></div>}
        {interne && m.remarques && <div style={{ fontSize: 12.5, color: "#3A4D6B", background: "#F5F8FC", borderRadius: 8, padding: "7px 10px", marginTop: 8, whiteSpace: "pre-wrap" }}>{m.remarques}</div>}
        {interne && <div style={{ fontSize: 11, color: "#2F6FDE", marginTop: 8 }}>Agent verbalisateur : {m.gendarmeNom} (n° {numAgent(m.gendarmeMatricule)})</div>}
        {children}
      </div>
    </div>
  );
}

// Une pièce du dossier : un PV visé ou une plainte traitée, rattaché à la personne (visible du personnel uniquement)
export function CartePiece({ p, lieeAMention, canModify, onDelete }) {
  const estPV = p.type === "PV";
  const c = estPV ? "#123A7A" : "#B25E00";
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${c}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "#14213A" }}>{p.titre}</div>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11.5, fontWeight: 700, color: c }}>{p.ref}</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        <PuceCasier couleur={c} fond="#F0F4FA">{p.type}</PuceCasier>
        <PuceCasier>{p.role}</PuceCasier>
        {p.dateFaits && <PuceCasier>📅 {fmtDateCasier(p.dateFaits)}</PuceCasier>}
        {p.lieu && <PuceCasier>📍 {p.lieu}</PuceCasier>}
        {lieeAMention && <PuceCasier couleur="#1F6B42" fond="#E3F2E8">🔗 Liée à une mention</PuceCasier>}
      </div>
      {p.resume && <div style={{ fontSize: 12.5, color: "#3A4D6B", background: "#F5F8FC", borderRadius: 8, padding: "7px 10px", marginTop: 8, whiteSpace: "pre-wrap" }}>{p.resume}</div>}
      <div style={{ fontSize: 11, color: "#2F6FDE", marginTop: 8 }}>
        {p.auteurNom ? `Rédigé par ${p.auteurGrade ? p.auteurGrade + " " : ""}${p.auteurNom}` : ""}{p.viseParNom ? ` · visé par ${p.viseParNom}` : ""}
      </div>
      {canModify && <div style={{ marginTop: 8 }}><button onClick={() => { if (window.confirm("Retirer cette pièce du dossier ? (le PV ou la plainte d'origine n'est pas touché)")) onDelete(p.id); }} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Retirer du dossier</button></div>}
    </div>
  );
}

function ResumeCasier({ r }) {
  const tuile = (l, v, c) => (
    <div style={{ flex: 1, minWidth: 110, background: "#F5F8FC", border: "1px solid #D3DDEA", borderTop: `3px solid ${c}`, borderRadius: 10, padding: "9px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {tuile("Mentions", r.n, "#C0172D")}
      {tuile("Total des amendes", r.amendes || "—", "#B7791F")}
      {tuile("Passages en GAV", r.gav, "#8A1020")}
    </div>
  );
}

export function CasierPublicLookup({ casier, onCancel }) {
  const CLE = "gn_casier_pseudo";
  const [pseudo, setPseudo] = useState(() => { try { return localStorage.getItem(CLE) || ""; } catch (e) { return ""; } });
  const [etat, setEtat] = useState({ busy: false, erreur: "", compte: null });
  const [casierDuCompte, setCasierDuCompte] = useState([]);
  const compte = etat.compte;

  // Le casier est retrouvé grâce au compte Roblox vérifié (identifiant unique), pas à un simple texte tapé
  const dossiers = compte ? casierDuCompte.filter((d) => memePersonne(d, { robloxId: compte.id, robloxUsername: compte.username, pseudoRoblox: compte.displayName })) : [];
  const mentions = dossiers.flatMap((d) => d.mentions || []).sort((a, b) => cleDateMention(b).localeCompare(cleDateMention(a)));
  const avatars = useAvatars([compte && compte.id]);
  const r = resumeCasier(mentions);

  async function chercher(e) {
    e.preventDefault();
    const at = pseudo.trim().replace(/^@/, "");
    if (!at) { setEtat({ busy: false, erreur: "Renseigne ton @ Roblox (ton nom d'utilisateur exact, sans espace).", compte: null }); return; }
    setEtat({ busy: true, erreur: "", compte: null });
    const c = await resoudreRoblox(at);
    if (!c) { setEtat({ busy: false, erreur: "Compte Roblox introuvable (ou Roblox ne répond pas). Vérifie l'orthographe exacte de ton nom d'utilisateur puis réessaie.", compte: null }); return; }
    try { localStorage.setItem(CLE, c.username); } catch (err) { /* stockage indisponible */ }
    try { setCasierDuCompte(await chargerCasierDe(c)); } catch (err) { console.error(err); setEtat({ busy: false, erreur: "Impossible de consulter le casier pour le moment. Réessaie dans un instant.", compte: null }); return; }
    setEtat({ busy: false, erreur: "", compte: c });
  }
  function changerDeCompte() { setEtat({ busy: false, erreur: "", compte: null }); setCasierDuCompte([]); }

  const etape = (n, t, ok) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 150px" }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: ok ? "#2E7D4F" : "#123A7A", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{ok ? "✓" : n}</span>
      <span style={{ fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.3 }}>{t}</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#E9EFF7", padding: "32px 20px 60px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button onClick={onCancel} style={{ ...smallBtn, marginBottom: 16 }}>← Retour</button>

        <div style={{ background: "linear-gradient(135deg, #0C2655, #123A7A)", color: "#fff", borderRadius: 16, padding: "22px 24px", marginBottom: 16, boxShadow: "0 10px 30px -14px rgba(7,20,46,0.6)" }}>
          <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>⚖️ Mon casier judiciaire</div>
          <div style={{ fontSize: 13.5, opacity: 0.85, lineHeight: 1.5 }}>Lie ton compte Roblox pour consulter les mentions enregistrées à ton nom. Rien à créer, rien à retenir : ton @ suffit.</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, padding: "0 4px" }}>
          {etape(1, "Saisis ton @ Roblox", !!compte)}
          {etape(2, "Ton compte est vérifié", !!compte)}
          {etape(3, "Tu vois ton casier", !!compte)}
        </div>

        {!compte && (
          <form onSubmit={chercher} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 18 }}>
            <Field label="Ton @ Roblox (nom d'utilisateur exact)" value={pseudo} onChange={setPseudo} placeholder="Ex : @MonPseudo" />
            <div style={{ fontSize: 11.5, color: "#5A6B84", marginTop: -4, marginBottom: 12, lineHeight: 1.45 }}>C'est le nom d'utilisateur de ton profil Roblox, pas ton nom affiché.</div>
            <button type="submit" disabled={etat.busy} className="gh-btn-anim" style={{ ...buttonPrimary, marginTop: 0, opacity: etat.busy ? 0.7 : 1 }}>{etat.busy ? "Vérification du compte…" : "Vérifier mon compte et consulter mon casier"}</button>
            {etat.erreur && <div style={{ marginTop: 12, background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.45 }}>{etat.erreur}</div>}
          </form>
        )}

        {compte && (
          <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
              <Avatar src={avatars[compte.id]} taille={64} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ display: "inline-block", background: "#E3F2E8", color: "#1F6B42", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 9px", marginBottom: 4 }}>✓ Compte Roblox vérifié</div>
                <div style={{ fontFamily: FONT_TITRE, fontSize: 20, fontWeight: 700, color: "#14213A" }}>{compte.displayName}</div>
                <div style={{ fontSize: 13, color: "#5A6B84" }}>@{compte.username}</div>
              </div>
              {mentions.length > 0 && <BadgeNiveau n={mentions.length} />}
            </div>

            <FicheCasier personne={{ displayName: compte.displayName, username: compte.username, robloxId: compte.id }} avatar={avatars[compte.id]} mentions={mentions} bulletin="3" />

            <button type="button" onClick={changerDeCompte} style={{ ...smallBtn, marginTop: 16 }}>Ce n'est pas mon compte / changer de compte</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CodePenalPage({ current, codePenal, onAdd, onUpdate, onDelete }) {
  const isAdmin = peutGererCodePenal(current);
  const blank = { type: "Contravention", classe: "", nom: "", article: "", amende: "", tempsGav: "" };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  function submit(e) {
    e.preventDefault();
    if (!form.nom.trim()) return;
    const data = { ...form, amende: form.amende ? Number(form.amende) : "" };
    if (editingId) { onUpdate(editingId, data); setEditingId(null); } else { onAdd(data); }
    setForm(blank);
  }
  function startEdit(a) {
    setEditingId(a.id);
    setForm({ type: a.type, classe: a.classe || "", nom: a.nom, article: a.article || "", amende: a.amende || "", tempsGav: a.tempsGav || "" });
  }
  return (
    <div>
      <h2 style={h2Style}>Code Pénal</h2>

      {isAdmin && (
        <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier l'article" : "Ajouter un article"}</div>
          <form onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={TYPES_INFRACTION} />
              <Field label="Classe / précision (facultatif)" value={form.classe} onChange={(v) => setForm({ ...form, classe: v })} placeholder="Ex : Classe 3" />
            </div>
            <Field label="Nom de l'infraction" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
            <Field label="Référence légale (facultatif)" value={form.article} onChange={(v) => setForm({ ...form, article: v })} placeholder="Ex : art. R412-30 C. route" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Amende (€)" type="number" value={form.amende} onChange={(v) => setForm({ ...form, amende: v })} />
              <Field label="Temps de GAV" value={form.tempsGav} onChange={(v) => setForm({ ...form, tempsGav: v })} placeholder="Ex : 3 jours" />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>{editingId ? "Enregistrer" : "Ajouter"}</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }} style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#123A7A", border: "1px solid #123A7A" }}>Annuler</button>}
            </div>
          </form>
        </div>
      )}

      <ListeInfractions
        codePenal={codePenal}
        actions={isAdmin ? (a) => (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => startEdit(a)} style={smallBtn}>Modifier</button>
            <button onClick={() => onDelete(a.id)} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Suppr.</button>
          </div>
        ) : null}
      />
    </div>
  );
}

export function CasierPage({ current, casier, pieces = [], onDeletePiece, codePenal, onAdd, onUpdateMention, onDeleteMention }) {
  const canModify = current.isAdmin || (current.qualifications || []).includes("OPJ");
  const peutSaisir = peutSaisirCasierPV(current);
  const blank = { pseudoRoblox: "", robloxUsername: "", nom: "", prenom: "", nature: "", gravite: "", dateFaits: "", amende: "", tempsGav: "", remarques: "", pvRef: "" };
  const [form, setForm] = useState(blank);
  const [roblox, setRoblox] = useState(null); // compte Roblox vérifié { id, username, displayName, imageUrl, cle }
  const [verifBusy, setVerifBusy] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // { dossierId, mentionId }
  const [editForm, setEditForm] = useState(blank);
  const [showCodePenal, setShowCodePenal] = useState(false);
  const [extraits, setExtraits] = useState({}); // dossiers affichés sous forme d'extrait officiel
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [articleSearch, setArticleSearch] = useState("");
  const [tri, setTri] = useState("recent");
  const [ouverts, setOuverts] = useState({});

  const cleSaisie = `${form.pseudoRoblox.trim()}|${form.robloxUsername.trim().replace(/^@/, "")}`;
  const verifieOk = !!roblox && roblox.cle === cleSaisie;
  const existingDossier = verifieOk
    ? casier.find((d) => d.robloxId === roblox.id)
      || casier.find((d) => !d.robloxId && [roblox.displayName, roblox.username].some((v) => (d.pseudoRoblox || "").trim().toLowerCase() === v.trim().toLowerCase()))
    : null;

  const pvsDeLaPersonne = verifieOk ? pieces.filter((pc) => pc.type === "PV" && memePersonne({ robloxId: roblox.id, robloxUsername: roblox.username, pseudoRoblox: roblox.displayName }, pc)) : [];

  const [error, setError] = useState("");

  function toggleArticle(id) {
    setSelectedArticleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applySelection() {
    const selected = codePenal.filter((a) => selectedArticleIds.includes(a.id));
    if (selected.length === 0) return;
    const totalAmende = selected.reduce((s, a) => s + (Number(a.amende) || 0), 0);
    // Le temps de GAV ne s'additionne jamais : on retient seulement le plus élevé de la sélection.
    function minutesDe(str) {
      const m = String(str || "").match(/(\d+)/);
      return m ? Number(m[1]) : 0;
    }
    let pireTempsGav = "";
    let pireMinutes = -1;
    selected.forEach((a) => {
      const mins = minutesDe(a.tempsGav);
      if (mins > pireMinutes) { pireMinutes = mins; pireTempsGav = a.tempsGav || ""; }
    });
    const nature = selected.map((a) => a.nom).join(", ");
    const gravite = graviteMax(selected.map((a) => a.type)); // la plus haute de la sélection
    setForm((f) => ({ ...f, nature, gravite: gravite || f.gravite, amende: totalAmende ? String(totalAmende) : f.amende, tempsGav: pireTempsGav || f.tempsGav }));
    setShowCodePenal(false);
  }

  const filteredArticles = codePenal.filter((a) => !articleSearch.trim() || a.nom.toLowerCase().includes(articleSearch.trim().toLowerCase()));

  // Vérifie que le pseudo et l'@ correspondent bien au même compte Roblox
  async function verifierRoblox() {
    const at = form.robloxUsername.trim().replace(/^@/, "");
    const pseudo = form.pseudoRoblox.trim();
    if (!pseudo || !at) { setRoblox(null); setError("Renseigne le pseudo ET l'@ exact du joueur : ils servent à retrouver son compte Roblox."); return null; }
    setVerifBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/roblox-head?pseudo=${encodeURIComponent(at)}`);
      const j = await r.json();
      if (!j.id) { setRoblox(null); setError(j.message || "Compte Roblox introuvable."); return null; }
      if (j.displayName && j.displayName.trim().toLowerCase() !== pseudo.toLowerCase()) {
        setRoblox(null);
        setError(`Le compte @${j.nom} s'appelle « ${j.displayName} » sur Roblox, pas « ${pseudo} ». Vérifie le pseudo.`);
        return null;
      }
      const res = { id: String(j.id), username: j.nom, displayName: j.displayName || pseudo, imageUrl: j.imageUrl || "", cle: `${pseudo}|${at}` };
      setRoblox(res);
      return res;
    } catch (e) { setRoblox(null); setError("Roblox ne répond pas, réessaie dans un instant."); return null; }
    finally { setVerifBusy(false); }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.nature.trim()) { setError("La nature de l'infraction est obligatoire."); return; }
    const rb = verifieOk ? roblox : await verifierRoblox();
    if (!rb) return;
    const dossier = casier.find((d) => d.robloxId === rb.id)
      || casier.find((d) => !d.robloxId && [rb.displayName, rb.username].some((v) => (d.pseudoRoblox || "").trim().toLowerCase() === v.trim().toLowerCase()));
    setError("");
    onAdd({ ...form, pseudoRoblox: rb.displayName, robloxUsername: rb.username, robloxId: rb.id });
    setConfirmMsg(dossier ? `Mention ajoutée au casier existant de ${rb.displayName} (@${rb.username}).` : `Nouveau casier créé pour ${rb.displayName} (@${rb.username}).`);
    setForm(blank);
    setRoblox(null);
    setSelectedArticleIds([]);
    setTimeout(() => setConfirmMsg(""), 4000);
  }

  function startEdit(dossierId, m) {
    setEditing({ dossierId, mentionId: m.id });
    setEditForm({ nature: m.nature, gravite: m.gravite || "", dateFaits: m.dateFaits || "", amende: m.amende || "", tempsGav: m.tempsGav || "", remarques: m.remarques || "", pvRef: m.pvRef || "" });
  }
  function submitEdit(e) {
    e.preventDefault();
    onUpdateMention(editing.dossierId, editing.mentionId, editForm);
    setEditing(null);
  }

  // Aplatit tous les dossiers/mentions pour l'affichage, filtré par pseudo
  const flat = casier
    .filter((d) => `${d.pseudoRoblox || ""} ${d.robloxUsername || ""} ${d.nom || ""} ${d.prenom || ""}`.toLowerCase().includes(search.trim().toLowerCase().replace(/^@/, "")))
    .flatMap((d) => d.mentions.map((m) => ({ dossier: d, mention: m })))
    .sort((a, b) => new Date(a.mention.createdAt) - new Date(b.mention.createdAt));

  const avatars = useAvatars([...flat.map(({ dossier }) => dossier.robloxId), ...pieces.map((pc) => pc.robloxId)]);

  return (
    <div>
      <h2 style={h2Style}>Casier judiciaire</h2>

      {peutSaisir && <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Ajouter une mention</div>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Pseudo Roblox (nom affiché)" value={form.pseudoRoblox} onChange={(v) => setForm({ ...form, pseudoRoblox: v })} />
            <Field label="@ Roblox (nom d'utilisateur exact)" value={form.robloxUsername} onChange={(v) => setForm({ ...form, robloxUsername: v })} placeholder="Ex : @MonPseudo" />
            <Field label="Date des faits" type="date" value={form.dateFaits} onChange={(v) => setForm({ ...form, dateFaits: v })} />
            <Field label="Nom (si connu)" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
            <Field label="Prénom (si connu)" value={form.prenom} onChange={(v) => setForm({ ...form, prenom: v })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "0 0 14px" }}>
            <button type="button" onClick={verifierRoblox} disabled={verifBusy} style={smallBtn}>{verifBusy ? "Vérification…" : "Vérifier le compte Roblox"}</button>
            {verifieOk && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar src={roblox.imageUrl} taille={48} />
                <div style={{ fontSize: 12 }}>
                  <div><b>{roblox.displayName}</b> · @{roblox.username} ✅</div>
                  <div style={{ color: existingDossier ? "#2F6FDE" : "#2E7D4F", marginTop: 2 }}>
                    {existingDossier ? "Un casier existe déjà pour ce compte : cette entrée s'y ajoutera." : "Aucun casier existant pour ce compte : un nouveau sera créé."}
                  </div>
                  {pvsDeLaPersonne.length > 0 && <div style={{ color: "#123A7A", marginTop: 2 }}>PV au dossier de cette personne : {pvsDeLaPersonne.map((p) => p.ref).join(", ")}</div>}
                </div>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <button type="button" onClick={() => setShowCodePenal((s) => !s)} style={{ ...smallBtn, background: "#2F6FDE", color: "#14213A" }}>
              📖 {showCodePenal ? "Fermer le code pénal" : "Choisir dans le code pénal"}
            </button>
            {showCodePenal && (
              <div style={{ marginTop: 10, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 14, maxHeight: 280, overflowY: "auto" }}>
                <Field label="Filtrer" value={articleSearch} onChange={setArticleSearch} placeholder="Ex : vitesse, vol..." />
                {codePenal.length === 0 && <div style={{ fontSize: 12, color: "#5A6B84" }}>Aucun article enregistré — demande à un admin d'importer/ajouter le code pénal.</div>}
                {filteredArticles.map((a) => (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 0" }}>
                    <input type="checkbox" checked={selectedArticleIds.includes(a.id)} onChange={() => toggleArticle(a.id)} />
                    <span style={{ flex: 1 }}>{a.nom} <span style={{ color: "#5A6B84" }}>({a.type}{a.classe ? " " + a.classe : ""})</span></span>
                    <span style={{ color: "#5A6B84" }}>{a.amende ? `${a.amende}€` : ""}</span>
                  </label>
                ))}
                {selectedArticleIds.length > 0 && (
                  <button type="button" onClick={applySelection} style={{ ...smallBtn, background: "#123A7A", color: "#fff", marginTop: 10 }}>
                    Appliquer la sélection ({selectedArticleIds.length})
                  </button>
                )}
              </div>
            )}
          </div>
          <Field label="Nature de l'infraction" value={form.nature} onChange={(v) => setForm({ ...form, nature: v })} placeholder="Décris librement l'infraction" />
          <Select label="Gravité (un délit ou un crime empêche de déposer une candidature)" value={form.gravite || GRAVITE_NC} onChange={(v) => setForm({ ...form, gravite: v === GRAVITE_NC ? "" : v })} options={OPTIONS_GRAVITE} />
          <Field label="N° du PV lié (facultatif)" value={form.pvRef} onChange={(v) => setForm({ ...form, pvRef: v.trim().toUpperCase() })} placeholder="Ex : INT-261014-143000" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Amende" value={form.amende} onChange={(v) => setForm({ ...form, amende: v })} placeholder="Ex : 500 crédits" />
            <Field label="Temps de GAV" value={form.tempsGav} onChange={(v) => setForm({ ...form, tempsGav: v })} placeholder="Ex : 3 jours" />
          </div>
          <Field label="Remarques (facultatif)" textarea value={form.remarques} onChange={(v) => setForm({ ...form, remarques: v })} />
          {error && <div style={{ color: "#C0172D", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {confirmMsg && <div style={{ color: "#2E7D4F", fontSize: 12, marginBottom: 10 }}>{confirmMsg}</div>}
          <button className="gh-btn-anim" type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>Enregistrer la mention</button>
        </form>
      </div>}

      {(() => {
        const q = search.trim().toLowerCase().replace(/^@/, "");
        const maintenant = Date.now();
        const tousDossiers = casier.filter((d) => d.mentions && d.mentions.length > 0);
        // Dossiers = casiers (avec mentions) + personnes qui n'ont que des PV / plaintes (casier vierge) ; chaque pièce va chez la bonne personne
        const personnes = tousDossiers.map((d) => ({ d, ps: [] }));
        pieces.forEach((pc) => {
          let e = personnes.find((x) => memePersonne(x.d, pc));
          if (!e) {
            e = { d: { id: "p:" + (pc.robloxId || String(pc.robloxUsername || "").toLowerCase()), pseudoRoblox: pc.pseudoRoblox, robloxUsername: pc.robloxUsername, robloxId: pc.robloxId, nom: pc.nom, prenom: pc.prenom, mentions: [] }, ps: [] };
            personnes.push(e);
          }
          e.ps.push(pc);
        });
        const dossiers = personnes
          .filter(({ d, ps }) => `${d.pseudoRoblox || ""} ${d.robloxUsername || ""} ${d.nom || ""} ${d.prenom || ""}`.toLowerCase().includes(q) || ps.some((pc) => String(pc.ref || "").toLowerCase().includes(q)))
          .map(({ d, ps }) => ({ d, ps, r: resumeCasier(d.mentions), derniere: [...d.mentions.map((m) => String(m.createdAt || "")), ...ps.map((pc) => String(pc.createdAt || ""))].reduce((mx, x) => (x > mx ? x : mx), "") }))
          .sort((a, b) => (tri === "mentions" ? b.r.n - a.r.n : tri === "nom" ? String(a.d.pseudoRoblox).localeCompare(String(b.d.pseudoRoblox)) : b.derniere.localeCompare(a.derniere)));
        const totalMentions = tousDossiers.reduce((n, d) => n + d.mentions.length, 0);
        const recentes = tousDossiers.reduce((n, d) => n + d.mentions.filter((m) => maintenant - new Date(m.createdAt).getTime() < 30 * 86400000).length, 0);
        const recidivistes = tousDossiers.filter((d) => d.mentions.length >= 3).length;
        const tuile = (l, v, c) => (
          <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
            <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
          </div>
        );
        return (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
              {tuile("Casiers ouverts", tousDossiers.length, "#123A7A")}
              {tuile("Mentions au total", totalMentions, "#C0172D")}
              {tuile("Ajoutées ces 30 jours", recentes, "#B7791F")}
              {tuile("Récidivistes (3 mentions et +)", recidivistes, "#8A1020")}
              {tuile("PV et plaintes rattachés", pieces.length, "#123A7A")}
            </div>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 8, fontWeight: 700 }}>
              Dossiers ({dossiers.length}){!canModify && " — lecture seule"}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
              <div style={{ flex: "1 1 240px", maxWidth: 340 }}><Field label="Rechercher un dossier" value={search} onChange={setSearch} placeholder="Pseudo, @, nom ou n° de PV" /></div>
              <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ ...selectStyle, width: "auto", marginBottom: 12 }}>
                <option value="recent">Trier : dernière mention</option>
                <option value="mentions">Trier : nombre de mentions</option>
                <option value="nom">Trier : pseudo</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dossiers.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun casier trouvé.</div>}
              {dossiers.map(({ d: dossier, ps, r }) => {
                const ouvert = !!ouverts[dossier.id];
                const nv = niveauCasier(r.n);
                const mentions = dossier.mentions.slice().sort((a, b) => cleDateMention(b).localeCompare(cleDateMention(a)));
                return (
                  <div key={dossier.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${nv.couleur}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)" }}>
                    <div onClick={() => setOuverts({ ...ouverts, [dossier.id]: !ouvert })} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", cursor: "pointer", flexWrap: "wrap" }}>
                      {dossier.robloxId ? <Avatar src={avatars[dossier.robloxId]} taille={48} /> : <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E6EDF7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#123A7A" }}>{String(dossier.pseudoRoblox || "?").charAt(0).toUpperCase()}</div>}
                      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{dossier.pseudoRoblox}{dossier.robloxUsername && <span style={{ fontWeight: 400, fontSize: 12.5, color: "#5A6B84" }}> · @{dossier.robloxUsername}</span>}</div>
                        {(dossier.nom || dossier.prenom) && <div style={{ fontSize: 12, color: "#5A6B84" }}>{dossier.prenom} {dossier.nom}</div>}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          <PuceCasier couleur="#8A1020" fond="#F8DADF">{r.n} mention{r.n > 1 ? "s" : ""}</PuceCasier>
                          {r.amendes > 0 && <PuceCasier couleur="#8A5A00" fond="#FFF6E0">💶 {r.amendes} au total</PuceCasier>}
                          {r.gav > 0 && <PuceCasier>⏱ {r.gav} GAV</PuceCasier>}
                          {ps.length > 0 && <PuceCasier couleur="#123A7A" fond="#E6EDF7">📁 {ps.length} PV / plainte{ps.length > 1 ? "s" : ""}</PuceCasier>}
                        </div>
                      </div>
                      <BadgeNiveau n={r.n} />
                      <span style={{ fontSize: 13, color: "#5A6B84" }}>{ouvert ? "▲" : "▼"}</span>
                    </div>
                    {ouvert && (
                      <div style={{ padding: "6px 16px 8px", borderTop: "1px solid #E3EAF4", background: "#F9FBFE" }}>
                        <div style={{ display: "flex", gap: 8, margin: "8px 0 12px" }}>
                          <button type="button" onClick={() => setExtraits({ ...extraits, [dossier.id]: true })} style={{ ...smallBtn, background: extraits[dossier.id] ? "#123A7A" : "#fff", color: extraits[dossier.id] ? "#fff" : "#123A7A" }}>📄 Extrait officiel</button>
                          <button type="button" onClick={() => setExtraits({ ...extraits, [dossier.id]: false })} style={{ ...smallBtn, background: !extraits[dossier.id] ? "#123A7A" : "#fff", color: !extraits[dossier.id] ? "#fff" : "#123A7A" }}>✏️ Mentions{canModify ? " (modifier)" : ""}</button>
                        </div>
                        {extraits[dossier.id] && (
                          <div style={{ marginBottom: 14 }}>
                            <FicheCasier personne={{ displayName: dossier.pseudoRoblox, username: dossier.robloxUsername, robloxId: dossier.robloxId, prenom: dossier.prenom, nom: dossier.nom }} avatar={dossier.robloxId ? avatars[dossier.robloxId] : null} mentions={mentions} bulletin="1" pieces={ps.length} />
                          </div>
                        )}
                        {!extraits[dossier.id] && mentions.map((m, i) =>
                          editing && editing.dossierId === dossier.id && editing.mentionId === m.id ? (
                            <form key={m.id} onSubmit={submitEdit} style={{ background: "#fff", border: "1px solid #123A7A", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                              <Field label="Nature de l'infraction" value={editForm.nature} onChange={(v) => setEditForm({ ...editForm, nature: v })} />
                              <Select label="Gravité (un délit ou un crime empêche de déposer une candidature)" value={editForm.gravite || GRAVITE_NC} onChange={(v) => setEditForm({ ...editForm, gravite: v === GRAVITE_NC ? "" : v })} options={OPTIONS_GRAVITE} />
                              <Field label="N° du PV lié (facultatif)" value={editForm.pvRef} onChange={(v) => setEditForm({ ...editForm, pvRef: v.trim().toUpperCase() })} />
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <Field label="Date des faits" type="date" value={editForm.dateFaits} onChange={(v) => setEditForm({ ...editForm, dateFaits: v })} />
                                <Field label="Amende" value={editForm.amende} onChange={(v) => setEditForm({ ...editForm, amende: v })} />
                                <Field label="Temps de GAV" value={editForm.tempsGav} onChange={(v) => setEditForm({ ...editForm, tempsGav: v })} />
                              </div>
                              <Field label="Remarques" textarea value={editForm.remarques} onChange={(v) => setEditForm({ ...editForm, remarques: v })} />
                              <div style={{ display: "flex", gap: 8 }}>
                                <button type="submit" style={{ ...smallBtn, background: "#123A7A", color: "#fff" }}>Enregistrer</button>
                                <button type="button" onClick={() => setEditing(null)} style={smallBtn}>Annuler</button>
                              </div>
                            </form>
                          ) : (
                            <CarteMention key={m.id} m={m} interne dernier={i === mentions.length - 1}>
                              {canModify && (
                                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                  <button onClick={() => startEdit(dossier.id, m)} style={smallBtn}>Modifier</button>
                                  <button onClick={() => { if (window.confirm("Supprimer cette mention du casier ?")) onDeleteMention(dossier.id, m.id); }} style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }}>Supprimer</button>
                                </div>
                              )}
                            </CarteMention>
                          )
                        )}
                        {!extraits[dossier.id] && mentions.length === 0 && <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 10 }}>Aucune mention au casier judiciaire.</div>}
                        {ps.length > 0 && (
                          <div style={{ marginTop: 6, paddingTop: 10, borderTop: "1px dashed #C3D0E2" }}>
                            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 8 }}>Pièces du dossier — PV et plaintes ({ps.length})</div>
                            {ps.slice().sort((a, b) => String(b.dateFaits || b.createdAt).localeCompare(String(a.dateFaits || a.createdAt))).map((pc) => (
                              <CartePiece key={pc.id} p={pc} lieeAMention={dossier.mentions.some((m) => m.pvRef && m.pvRef === pc.ref)} canModify={canModify} onDelete={onDeletePiece} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
}
