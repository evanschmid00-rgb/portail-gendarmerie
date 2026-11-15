// pages/dossier-agent.jsx — « Mon dossier » : parcours, grades (promotions / rétrogradations), sanctions et affectations d'un agent.
// Chacun voit son propre dossier ; l'État-Major, les admins et les commandants d'unité (pour leur unité) peuvent consulter celui d'un autre agent.
import React, { useEffect, useMemo, useState } from "react";
import { loadWhere } from "../lib/donnees.js";
import { dureeService, fmtDuree } from "../lib/utils.js";
import { estCommandement, estEtatMajor } from "../lib/etatmajor.js";
import { estCmdUnite } from "../lib/unites.js";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { CarteProgramme } from "./programmes.jsx";
import { N, NeoAlerte, NeoBandeau, NeoCarte, NeoCompteur, NeoFiche, NeoLigne, NeoOnglets, NEO_INP } from "../composants/neo.jsx";

const jour = (x) => { const d = new Date(x); return isNaN(d) ? "—" : d.toLocaleDateString("fr-FR"); };
const ts = (x) => { const d = new Date(x); return isNaN(d) ? 0 : d.getTime(); };
const nomDe = (p) => `${p.grade ? p.grade + " " : ""}${p.prenom || ""} ${p.nom || ""}`.trim();
const COUL = { promo: "#1F9D55", retro: "#D62B45", sanction: "#C2571A", affect: "#2F7BFF", essai: "#7A3FB5" };

export function DossierPage({ current, personnel = [], promotions = [], sanctions = [], services = [], onNavigate }) {
  const [cibleId, setCibleId] = useState(current.id);
  const [onglet, setOnglet] = useState("parcours");
  const [recherche, setRecherche] = useState("");
  const [affectations, setAffectations] = useState([]);
  const [chargement, setChargement] = useState(true);

  const peutVoirTous = !!current.isAdmin || estEtatMajor(current) || estCommandement(current);
  const peutVoirUnite = estCmdUnite(current);
  const consultables = useMemo(() => personnel.filter((p) => peutVoirTous || (peutVoirUnite && p.unite === current.unite) || p.id === current.id), [personnel, peutVoirTous, peutVoirUnite, current.id, current.unite]);
  const agent = personnel.find((p) => p.id === cibleId && consultables.some((c) => c.id === p.id)) || current;
  const moi = agent.id === current.id;
  const mat = agent.matricule;
  const avatars = useAvatars([agent.robloxId].filter(Boolean));

  useEffect(() => {
    let v = true;
    setChargement(true);
    loadWhere("affectations", "matricule", "==", mat).then((l) => { if (v) { setAffectations(l || []); setChargement(false); } }).catch(() => { if (v) { setAffectations([]); setChargement(false); } });
    return () => { v = false; };
  }, [mat]);

  const promos = promotions.filter((p) => p.matricule === mat).sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
  const sancs = sanctions.filter((s) => s.matricule === mat || (agent.id && s.cibleUid === agent.id)).sort((a, b) => ts(b.dateDebut || b.createdAt) - ts(a.dateDebut || a.createdAt));
  const actives = sancs.filter((s) => s.levee !== true && new Date(s.dateFin) > new Date());
  const affs = affectations.slice().sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
  const now = Date.now();
  const totalMs = services.filter((s) => s.matricule === mat && s.type !== "ajustement").reduce((t, s) => t + (dureeService(s, now) || 0), 0);
  const quals = agent.qualifications || [];

  // Frise chronologique : tout mélangé, du plus récent au plus ancien
  const frise = [
    ...promos.map((p) => ({ k: "p" + p.id, t: ts(p.createdAt), couleur: p.type === "Promotion" ? COUL.promo : COUL.retro, pastille: p.type === "Promotion" ? "PROMOTION" : "RÉTROGRADATION", titre: `${p.ancienGrade} → ${p.nouveauGrade}`, sous: p.motif, date: jour(p.createdAt) })),
    ...sancs.map((s) => ({ k: "s" + s.id, t: ts(s.dateDebut || s.createdAt), couleur: COUL.sanction, pastille: s.levee ? "SANCTION LEVÉE" : "SANCTION", titre: s.type, sous: s.motif, date: jour(s.dateDebut || s.createdAt) })),
    ...affs.map((a) => ({ k: "a" + a.id, t: ts(a.createdAt), couleur: COUL.affect, pastille: "AFFECTATION", titre: a.ancienneUnite ? `${a.ancienneUnite} → ${a.nouvelleUnite}` : `Affecté à ${a.nouvelleUnite}`, sous: a.motif || (a.parNom ? `Décidé par ${a.parNom}` : ""), date: jour(a.createdAt) })),
    ...(agent.titulariseLe ? [{ k: "tit", t: ts(agent.titulariseLe), couleur: COUL.essai, pastille: "TITULARISATION", titre: "Fin de la période d'essai", sous: "", date: jour(agent.titulariseLe) }] : []),
  ].sort((a, b) => b.t - a.t);

  const q = recherche.trim().toLowerCase();
  const liste = consultables.filter((p) => !q || `${nomDe(p)} ${p.unite || ""}`.toLowerCase().includes(q)).slice(0, 60);

  return (
    <div style={{ maxWidth: 940 }}>
      <NeoBandeau
        surtitre={moi ? "Mon dossier" : "Dossier d'un agent"}
        titre={nomDe(agent)}
        texte={`${agent.unite || "Sans unité"}${agent.fonction ? " · " + agent.fonction : ""}`}
        droite={[
          <NeoCompteur key="a" n={promos.length} label="Grades" couleur="#6FA3FF" onClick={() => setOnglet("grades")} />,
          <NeoCompteur key="b" n={sancs.length} label="Sanctions" couleur="#FF6B7E" onClick={() => setOnglet("sanctions")} />,
          <NeoCompteur key="c" n={affs.length} label="Affectations" couleur="#F0B048" onClick={() => setOnglet("affectations")} />,
        ]}
      />
      {(peutVoirTous || peutVoirUnite) && consultables.length > 1 && (
        <NeoCarte titre="Consulter le dossier d'un agent" style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input style={{ ...NEO_INP, flex: "1 1 200px" }} placeholder="Rechercher (nom, unité)…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            <select style={{ ...NEO_INP, flex: "2 1 260px" }} value={agent.id} onChange={(e) => { setCibleId(e.target.value); setOnglet("parcours"); }}>
              <option value={current.id}>👤 Mon dossier</option>
              {liste.filter((p) => p.id !== current.id).map((p) => <option key={p.id} value={p.id}>{nomDe(p)} · {p.unite || "—"}</option>)}
            </select>
          </div>
          {peutVoirUnite && !peutVoirTous && <div style={{ fontSize: 11.5, color: N.gris, marginTop: 6 }}>Tu peux consulter les dossiers des gendarmes de ton unité.</div>}
        </NeoCarte>
      )}
      {actives.length > 0 && <NeoAlerte ton="danger" icone="⚖️">{actives.length} sanction{actives.length > 1 ? "s" : ""} en cours.</NeoAlerte>}
      <NeoOnglets actif={onglet} onChange={setOnglet} onglets={[
        { id: "parcours", label: "Parcours", n: frise.length },
        { id: "grades", label: "Promotions / rétrogradations", n: promos.length, couleur: "#1F9D55" },
        { id: "sanctions", label: "Sanctions", n: sancs.length, couleur: "#D62B45" },
        { id: "affectations", label: "Affectations", n: affs.length, couleur: "#F0B048" },
        { id: "fiche", label: "Fiche" },
      ]} />

      {onglet === "parcours" && <CarteProgramme key={agent.id} agentId={agent.id} />}
      {onglet === "parcours" && (
        <NeoCarte titre="Chronologie de la carrière">
          {chargement && <div style={{ fontSize: 12.5, color: N.gris, marginBottom: 6 }}>Chargement des affectations…</div>}
          {!frise.length && !chargement && <div style={{ fontSize: 13.5, color: N.gris }}>Aucun événement enregistré pour le moment.</div>}
          {frise.map((e) => <NeoLigne key={e.k} couleur={e.couleur} pastille={e.pastille} titre={e.titre} sous={e.sous} date={e.date} />)}
        </NeoCarte>
      )}

      {onglet === "grades" && (
        <NeoCarte titre="Promotions et rétrogradations" droite={<span style={{ fontSize: 12.5, color: N.gris }}>Grade actuel : <b style={{ color: N.encre }}>{agent.grade || "—"}</b></span>}>
          {!promos.length && <div style={{ fontSize: 13.5, color: N.gris }}>Aucun mouvement de grade enregistré.</div>}
          {promos.map((p) => <NeoLigne key={p.id} couleur={p.type === "Promotion" ? COUL.promo : COUL.retro} pastille={p.type === "Promotion" ? "PROMOTION" : "RÉTROGRADATION"} titre={`${p.ancienGrade} → ${p.nouveauGrade}`} sous={p.motif} date={jour(p.createdAt)} detail={p.auteurNom || p.par ? `Décidé par ${p.auteurNom || p.par}` : null} />)}
        </NeoCarte>
      )}

      {onglet === "sanctions" && (
        <NeoCarte titre="Sanctions disciplinaires" droite={moi ? <button type="button" onClick={() => onNavigate && onNavigate("mes-sanctions")} style={{ border: 0, background: "none", color: N.accent, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Détail ›</button> : null}>
          {!sancs.length && <NeoAlerte ton="ok" icone="✅">Aucune sanction.</NeoAlerte>}
          {sancs.map((s) => <NeoLigne key={s.id} couleur={COUL.sanction} pastille={s.levee ? "LEVÉE" : (new Date(s.dateFin) > new Date() ? "EN COURS" : "TERMINÉE")} titre={s.type} sous={s.motif} date={`${jour(s.dateDebut)} → ${jour(s.dateFin)}`} />)}
        </NeoCarte>
      )}

      {onglet === "affectations" && (
        <NeoCarte titre="Affectations" droite={<span style={{ fontSize: 12.5, color: N.gris }}>Unité actuelle : <b style={{ color: N.encre }}>{agent.unite || "—"}</b></span>}>
          {chargement && <div style={{ fontSize: 12.5, color: N.gris }}>Chargement…</div>}
          {!chargement && !affs.length && <div style={{ fontSize: 13.5, color: N.gris, lineHeight: 1.5 }}>Aucun changement d'unité enregistré. L'historique commence à partir de la mise en service de cette fonction.</div>}
          {affs.map((a) => <NeoLigne key={a.id} couleur={COUL.affect} pastille="AFFECTATION" titre={a.ancienneUnite ? `${a.ancienneUnite} → ${a.nouvelleUnite}` : `Affecté à ${a.nouvelleUnite}`} sous={a.motif || (a.parNom ? `Décidé par ${a.parNom}` : "")} date={jour(a.createdAt)} />)}
          {agent.unite && <NeoLigne couleur="#1F9D55" pastille="ACTUELLE" titre={agent.unite} sous={agent.fonction || ""} date="aujourd'hui" />}
        </NeoCarte>
      )}

      {onglet === "fiche" && (
        <>
          <NeoCarte titre="Situation">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
              <Avatar src={avatars[agent.robloxId]} taille={56} />
              <div style={{ fontSize: 13, color: N.gris }}>{agent.pseudoRoblox ? `Roblox : ${agent.pseudoRoblox}` : "Compte Roblox non lié"}</div>
            </div>
            <NeoFiche champs={[["Grade", agent.grade], ["Unité", agent.unite], ["Poste occupé", agent.fonction], ["N° CIPC", agent.cipcNumero], ["Qualité judiciaire", agent.qualiteJudiciaire], ["Temps de service cumulé", totalMs ? fmtDuree(totalMs) : "—"], ["Période d'essai", agent.essaiStatut]]} />
          </NeoCarte>
          <NeoCarte titre="Habilitations">
            {!quals.length ? <div style={{ fontSize: 13.5, color: N.gris }}>Aucune habilitation particulière.</div> : <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{quals.map((x) => <span key={x} style={{ background: "#E8F0FF", color: "#123A7A", border: "1px solid #B8C7E0", borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 800 }}>{x}</span>)}</div>}
          </NeoCarte>
        </>
      )}
    </div>
  );
}
