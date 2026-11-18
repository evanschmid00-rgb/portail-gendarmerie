// pages/services.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { NeoBandeau, NeoCompteur } from "../composants/neo.jsx";
import React, { useEffect, useMemo, useState } from "react";
import { auth } from "../firebase";
import { BarreTemps, Field, Select, StatBox, buttonPrimary, h2Style, labelStyle, selectStyle, smallBtn } from "../composants/ui.jsx";
import { FONT_TITRE } from "../lib/constantes.js";
import { DELAI_REPONSE_POINTAGE_MS, DUREE_MAX_SERVICE_MS, INTERVALLE_POINTAGE_MS, QUOTA_DEFAUT, absenceActive, absenceSemaine, cleJour, dateRefService, debutSemaine, dureeService, estReserviste, fmtDuree, fmtHeure, fmtJourCourt, fmtJourFR, grouperParMatricule, lundiProchainStr, quotaMsDe, statsService, triDate, useNow, numAgent } from "../lib/utils.js";

function RepartitionService({ st }) {
  const aujourdhui = cleJour(new Date());
  const maxJ = Math.max(1, ...st.parJour.map((j) => j.ms));
  const maxS = Math.max(1, ...st.parSemaine.map((w) => w.ms));
  const ligne = { display: "grid", gridTemplateColumns: "92px 1fr 64px", gap: 10, alignItems: "center", fontSize: 12.5, padding: "4px 0" };
  const bloc = { flex: 1, minWidth: 250, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px" };
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div style={bloc}>
        <div style={labelStyle}>Par jour (cette semaine)</div>
        {st.parJour.map((j) => (
          <div key={j.cle} style={{ ...ligne, fontWeight: j.cle === aujourdhui ? 700 : 400 }}>
            <span style={{ textTransform: "capitalize" }}>{fmtJourCourt(j.date)}</span>
            <BarreTemps ms={j.ms} max={maxJ} couleur={j.cle === aujourdhui ? "#2E7D4F" : "#2F6FDE"} />
            <b style={{ textAlign: "right" }}>{fmtDuree(j.ms)}</b>
          </div>
        ))}
      </div>
      <div style={bloc}>
        <div style={labelStyle}>Par semaine</div>
        {st.parSemaine.map((w, i) => (
          <div key={w.cle} style={{ ...ligne, fontWeight: i === 0 ? 700 : 400 }}>
            <span>{i === 0 ? "Cette semaine" : `Sem. du ${w.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`}</span>
            <BarreTemps ms={w.ms} max={maxS} couleur={i === 0 ? "#2E7D4F" : "#7A93BD"} />
            <b style={{ textAlign: "right" }}>{fmtDuree(w.ms)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

const initialesDe = (p) => `${(p.prenom || "?").charAt(0)}${(p.nom || "?").charAt(0)}`.toUpperCase();

// Une ligne par gendarme avec son temps de service (utilisée par la page équipe et par la gestion admin)
function lignesTemps(personnel, parMat, now, recherche, tri) {
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = norm(recherche);
  const cles = { semaine: (x) => x.st.semaine, jour: (x) => x.st.jour, total: (x) => x.st.total };
  return personnel
    .filter((p) => p.matricule)
    .map((p) => { const list = parMat[p.matricule] || []; return { p, st: statsService(list, now), actif: list.find((s) => s.type !== "ajustement" && !s.fin) }; })
    .filter(({ p }) => !q || norm(`${p.prenom} ${p.nom} ${numAgent(p)} ${p.grade} ${p.cipcNumero || ""}`).includes(q))
    .sort((a, b) => (tri === "nom" ? 0 : (cles[tri] || cles.semaine)(b) - (cles[tri] || cles.semaine)(a)) || `${a.p.nom}${a.p.prenom}`.localeCompare(`${b.p.nom}${b.p.prenom}`));
}

function CarteTemps({ p, st, actif, now, max, moi, ouvert, onToggle, action, quotaMs, absence }) {
  const enService = !!actif;
  return (
    <div style={{ background: "#fff", border: `1px solid ${moi ? "#9DB6DD" : "#D3DDEA"}`, borderLeft: `5px solid ${enService ? "#2E7D4F" : "#C3D0E2"}`, borderRadius: 12, overflow: "hidden", boxShadow: moi ? "0 4px 16px -10px rgba(18,58,122,0.45)" : "none" }}>
      <div onClick={onToggle} style={{ padding: "12px 16px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", cursor: onToggle ? "pointer" : "default" }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: enService ? "#2E7D4F" : "#123A7A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_TITRE, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{initialesDe(p)}</div>
        <div style={{ flex: "1 1 190px", minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#14213A" }}>
            {p.prenom} {p.nom}
            {moi && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#123A7A", borderRadius: 10, padding: "2px 8px" }}>TOI</span>}
            {estReserviste(p) && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#7B3FA0", borderRadius: 10, padding: "2px 8px" }}>RÉSERVISTE</span>}
            {absence && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#6B4E00", background: "#FFF4D6", border: "1px solid #E8D28A", borderRadius: 10, padding: "2px 8px" }}>🏖️ ABSENT(E) jusqu'au {fmtJourFR(absence.fin)}</span>}
          </div>
          <div style={{ fontSize: 12, color: "#5A6B84" }}>{[p.grade, p.unite].filter(Boolean).join(" · ") || `N° ${numAgent(p)}`}</div>
          <div style={{ fontSize: 12, marginTop: 3, fontWeight: 600, color: enService ? "#1F6B42" : "#7B8AA3" }}>
            {enService ? `🟢 En service depuis ${fmtHeure(actif.debut)} (${fmtDuree(dureeService(actif, now))})` : "⚪ Hors service"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {[["Aujourd'hui", st.jour], ["Semaine", st.semaine], ["Total", st.total]].map(([l, ms]) => (
            <div key={l} style={{ textAlign: "center", minWidth: 62 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", color: "#7B8AA3", fontWeight: 600 }}>{l}</div>
              <div style={{ fontFamily: FONT_TITRE, fontSize: 16, fontWeight: 700, color: l === "Total" ? "#123A7A" : "#14213A" }}>{fmtDuree(ms)}</div>
            </div>
          ))}
        </div>
        {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
      </div>
      <div style={{ padding: "0 16px 12px" }}>
        <BarreTemps ms={st.semaine} max={quotaMs || max} couleur={quotaMs && st.semaine >= quotaMs ? "#2E7D4F" : enService ? "#2E7D4F" : "#2F6FDE"} />
        {quotaMs ? <div style={{ fontSize: 11, color: st.semaine >= quotaMs ? "#1F6B42" : "#5A6B84", marginTop: 4, fontWeight: 600 }}>{st.semaine >= quotaMs ? "✅ " : ""}Quota : {fmtDuree(st.semaine)} / {fmtDuree(quotaMs)}</div> : null}
      </div>
      {ouvert && <div style={{ padding: "14px 16px 0", borderTop: "1px solid #E3EAF4", background: "#F9FBFE" }}><RepartitionService st={st} /></div>}
    </div>
  );
}

function LigneService({ s, now, onDelete, onForceStop }) {
  const box = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" };
  if (s.archive) {
    return (
      <div style={{ ...box, background: "#F3F0FA", borderColor: "#D5CBEE" }}>
        <div style={{ fontSize: 13 }}>📦 <b>Semaines archivées</b> — heures cumulées conservées : <b style={{ color: "#4B2E91" }}>{fmtDuree(s.minutes * 60000)}</b>
          <div style={{ fontSize: 11.5, color: "#6B5E8F", marginTop: 2 }}>Les détails des services de plus de deux semaines sont supprimés chaque semaine ; seul le total est gardé.</div>
        </div>
      </div>
    );
  }
  if (s.type === "ajustement") {
    return (
      <div style={{ ...box, background: "#EEF3FA" }}>
        <div style={{ fontSize: 13 }}>
          <b>{fmtJourCourt(s.date)}</b> — Ajustement par l'administration : <b style={{ color: s.minutes < 0 ? "#C0172D" : "#2E7D4F" }}>{fmtDuree(s.minutes * 60000)}</b>
          {s.motif ? <span style={{ color: "#5A6B84" }}> ({s.motif})</span> : null}
        </div>
        {onDelete && <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => onDelete(s.id)}>Supprimer</button>}
      </div>
    );
  }
  return (
    <div style={box}>
      <div style={{ fontSize: 13 }}>
        <b style={{ textTransform: "capitalize" }}>{fmtJourCourt(s.debut)}</b> — {fmtHeure(s.debut)} → {s.fin ? fmtHeure(s.fin) : "en cours"} : <b>{fmtDuree(dureeService(s, now))}</b>
        {s.force && <span style={{ color: "#C0172D", fontSize: 11 }}> (arrêt forcé{s.forcePar ? " par " + s.forcePar : ""})</span>}
        {s.motifArret === "pointage" && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "#7A0F1E", background: "#FDECEE", border: "1px solid #E8A0AA", borderRadius: 10, padding: "1px 7px" }}>⏱️ Arrêt : pointage non confirmé</span>}
        {s.motifArret === "duree" && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "#7A4A0F", background: "#FFF3DC", border: "1px solid #E8C98A", borderRadius: 10, padding: "1px 7px" }}>⏱️ Arrêt auto (3 h)</span>}
        {s.fin && s.type === "service" && s.activite === 0 && !s.force && s.resume !== undefined && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "#7A4A0F", background: "#FFF3DC", border: "1px solid #E8C98A", borderRadius: 10, padding: "1px 7px" }}>Aucun PV / CR</span>}
        {s.resume && <div style={{ fontSize: 12, color: "#3A4D6B", marginTop: 4, fontStyle: "italic" }}>« {s.resume} »</div>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {!s.fin && onForceStop && <button style={smallBtn} onClick={() => onForceStop(s.id)}>Forcer l'arrêt</button>}
        {onDelete && <button style={{ ...smallBtn, color: "#C0172D", borderColor: "#C0172D" }} onClick={() => onDelete(s.id)}>Supprimer</button>}
      </div>
    </div>
  );
}

// Progression de la semaine par rapport au quota
function CarteQuota({ st, quotaMs, reserviste, auto, absenceSem }) {
  const fait = st.semaine;
  const atteint = fait >= quotaMs;
  const reste = Math.max(0, quotaMs - fait);
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${atteint ? "#2E7D4F" : absenceSem ? "#B7791F" : "#2F6FDE"}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>🎯 Quota de la semaine {reserviste && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#7B3FA0", borderRadius: 10, padding: "2px 8px" }}>RÉSERVISTE</span>}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: atteint ? "#1F6B42" : "#14213A" }}>{fmtDuree(fait)} / {fmtDuree(quotaMs)}</div>
      </div>
      <BarreTemps ms={fait} max={quotaMs} couleur={atteint ? "#2E7D4F" : "#2F6FDE"} />
      <div style={{ fontSize: 12.5, color: "#3A4D6B", marginTop: 8, lineHeight: 1.5 }}>
        {atteint ? "✅ Quota atteint pour cette semaine, bravo !" : `Il te reste ${fmtDuree(reste)} à effectuer avant dimanche soir.`}
        {!atteint && auto && !absenceSem && " Sans quota atteint, une mise en garde automatique est émise à la fin de la semaine."}
        {!atteint && auto && absenceSem && " 🏖️ Tu as une absence déclarée cette semaine : tu ne seras pas sanctionné(e)."}
      </div>
    </div>
  );
}

// Déclarer / annuler une absence
function AbsencesCard({ current, absences, onAdd, onCancel }) {
  const aujourdhui = cleJour(new Date());
  const [debut, setDebut] = useState(aujourdhui);
  const [fin, setFin] = useState(aujourdhui);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState("");
  const [msg, setMsg] = useState("");
  const miennes = absences.filter((a) => a.matricule === current.matricule && a.annulee !== true && a.fin >= aujourdhui).sort((a, b) => a.debut.localeCompare(b.debut));
  const passees = absences.filter((a) => a.matricule === current.matricule && (a.annulee === true || a.fin < aujourdhui)).sort((a, b) => b.debut.localeCompare(a.debut)).slice(0, 5);

  async function submit(e) {
    e.preventDefault();
    if (!debut || !fin) { setErreur("Indique les dates de début et de fin."); return; }
    if (fin < debut) { setErreur("La date de fin doit être après la date de début."); return; }
    if (fin < aujourdhui) { setErreur("L'absence ne peut pas être entièrement dans le passé."); return; }
    const jours = Math.round((new Date(`${fin}T12:00:00`) - new Date(`${debut}T12:00:00`)) / 86400000) + 1;
    if (jours > 60) { setErreur("Une absence ne peut pas dépasser 60 jours : contacte ton commandement pour une absence plus longue."); return; }
    setErreur("");
    const ok = await onAdd({ debut, fin, motif });
    if (ok) { setMsg("Absence enregistrée : tu ne seras pas sanctionné(e) pour le quota pendant cette période."); setMotif(""); setTimeout(() => setMsg(""), 6000); }
    else setErreur("Impossible d'enregistrer l'absence, réessaie.");
  }
  const ligne = (a, passee) => (
    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", background: passee ? "#F5F8FC" : a.debut <= aujourdhui ? "#FFF4E0" : "#fff", border: "1px solid #D3DDEA", borderRadius: 8, padding: "9px 12px", fontSize: 13, opacity: passee ? 0.75 : 1 }}>
      <div>
        <b>{fmtJourFR(a.debut)}{a.fin !== a.debut ? ` → ${fmtJourFR(a.fin)}` : ""}</b>
        {a.annulee === true ? <span style={{ color: "#8A2A2A" }}> · annulée</span> : !passee && a.debut <= aujourdhui ? <span style={{ color: "#B25E00", fontWeight: 700 }}> · en cours</span> : !passee ? <span style={{ color: "#5A6B84" }}> · à venir</span> : null}
        {a.motif ? <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>{a.motif}</div> : null}
      </div>
      {!passee && <button style={smallBtn} onClick={() => { if (window.confirm("Annuler cette absence ?")) onCancel(a.id); }}>Annuler</button>}
    </div>
  );
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "16px 18px", marginBottom: 22 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🏖️ Mes absences</div>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 12, lineHeight: 1.5 }}>Pendant une absence déclarée, tu n'es pas sanctionné(e) si tu n'atteins pas ton quota de la semaine. Déclare-la <b>avant</b> la fin de la semaine concernée.</div>
      <form onSubmit={submit}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px" }}><Field label="Du" type="date" value={debut} onChange={setDebut} /></div>
          <div style={{ flex: "1 1 150px" }}><Field label="Au (inclus)" type="date" value={fin} onChange={setFin} /></div>
        </div>
        <Field label="Motif (facultatif)" value={motif} onChange={setMotif} placeholder="Ex : vacances, examens, indisponible…" />
        {erreur && <div style={{ color: "#C0172D", fontSize: 12.5, marginBottom: 8 }}>{erreur}</div>}
        {msg && <div style={{ color: "#2E7D4F", fontSize: 12.5, marginBottom: 8, fontWeight: 600 }}>{msg}</div>}
        <button type="submit" className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>Déclarer mon absence</button>
      </form>
      {(miennes.length > 0 || passees.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
          {miennes.map((a) => ligne(a, false))}
          {passees.map((a) => ligne(a, true))}
        </div>
      )}
    </div>
  );
}

// Panneau admin : quotas, date de début, activation, simulation
function QuotaAdminPanel({ reglages, onSave }) {
  const [heures, setHeures] = useState(String(reglages.quotaHebdoMin / 60));
  const [heuresRes, setHeuresRes] = useState(String(reglages.quotaReserveMin / 60));
  const [debut, setDebut] = useState(reglages.quotaDebut || lundiProchainStr());
  const [auto, setAuto] = useState(reglages.quotaAuto === true);
  const [etat, setEtat] = useState("");
  const [sim, setSim] = useState(null);
  useEffect(() => {
    setHeures(String(reglages.quotaHebdoMin / 60)); setHeuresRes(String(reglages.quotaReserveMin / 60));
    setDebut(reglages.quotaDebut || lundiProchainStr()); setAuto(reglages.quotaAuto === true);
  }, [reglages]);
  const inp = { padding: "8px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, width: 110, boxSizing: "border-box" };

  async function enregistrer() {
    const h = Number(String(heures).replace(",", ".")), hr = Number(String(heuresRes).replace(",", "."));
    if (!(h > 0 && h <= 100) || !(hr > 0 && hr <= 100)) { setEtat("Indique des quotas valides (en heures)."); return; }
    if (auto && !debut) { setEtat("Choisis la date de début des sanctions automatiques."); return; }
    setEtat("Enregistrement…");
    const ok = await onSave({ quotaHebdoMin: Math.round(h * 60), quotaReserveMin: Math.round(hr * 60), quotaDebut: debut, quotaAuto: auto });
    setEtat(ok ? "Réglages enregistrés." : "Échec de l'enregistrement.");
  }
  async function simuler() {
    setSim({ chargement: true });
    try {
      const idToken = await auth.currentUser.getIdToken();
      const r = await fetch("/api/quota-hebdo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
      setSim({ data: await r.json() });
    } catch (e) { setSim({ erreur: "Simulation impossible (le fichier serveur est-il en ligne ?)." }); }
  }
  const libelle = { sanction: "🔴 Mise en garde", "exempt-absent": "🏖️ Absent(e)", "exempt-nouveau": "🆕 Nouveau compte", "exempt-mise-a-pied": "⛔ Mise à pied", ok: "✅ OK" };
  return (
    <details style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 16px", marginBottom: 18 }}>
      <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#123A7A" }}>🎯 Quota hebdomadaire et sanctions automatiques (admin)</summary>
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <div><label style={labelStyle}>Quota gendarme (heures)</label><input value={heures} onChange={(e) => setHeures(e.target.value)} style={inp} /></div>
          <div><label style={labelStyle}>Quota réserviste (heures)</label><input value={heuresRes} onChange={(e) => setHeuresRes(e.target.value)} style={inp} /></div>
          <div><label style={labelStyle}>Contrôle à partir du lundi</label><input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} style={{ ...inp, width: 160 }} /></div>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Émettre automatiquement une mise en garde aux gendarmes sous leur quota
        </label>
        <div style={{ fontSize: 12, color: "#5A6B84", lineHeight: 1.5, marginBottom: 12 }}>Chaque lundi matin, la semaine précédente est contrôlée. Sont dispensés : les gendarmes déclarés absents pendant la semaine, les comptes créés pendant la semaine et les gendarmes en mise à pied. Pour qu'un gendarme soit réserviste, ajoute-lui la qualification « Réserviste » dans la gestion du personnel.</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={enregistrer} style={{ ...buttonPrimary, width: "auto", padding: "8px 18px", marginTop: 0 }}>Enregistrer</button>
          <button type="button" onClick={simuler} style={smallBtn}>Simuler le contrôle de la semaine dernière</button>
          {etat && <span style={{ fontSize: 12.5, color: etat.startsWith("Réglages") ? "#1F6B42" : "#5A6B84", fontWeight: 600 }}>{etat}</span>}
        </div>
        {sim && (
          <div style={{ marginTop: 14, background: "#F5F8FC", border: "1px solid #D3DDEA", borderRadius: 10, padding: 12 }}>
            {sim.chargement && <div style={{ fontSize: 13 }}>Calcul en cours…</div>}
            {sim.erreur && <div style={{ fontSize: 13, color: "#C0172D" }}>{sim.erreur}</div>}
            {sim.data && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{sim.data.message}{sim.data.lundi ? ` (semaine du ${fmtJourFR(sim.data.lundi)} au ${fmtJourFR(sim.data.dimanche)})` : ""}</div>
                {(sim.data.resultats || []).filter((r) => r.statut !== "ok").map((r) => (
                  <div key={r.matricule} style={{ fontSize: 12.5, padding: "3px 0" }}>{libelle[r.statut]} — <b>{r.nom}</b> : {fmtDuree(r.minutes * 60000)} / {fmtDuree(r.quota * 60000)}{r.reserviste ? " (réserviste)" : ""}</div>
                ))}
                {sim.data.resultats && sim.data.resultats.every((r) => r.statut === "ok") && <div style={{ fontSize: 12.5 }}>Tout le monde a atteint son quota.</div>}
              </>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

const MIN = 60000;
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}` : `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

// Anneau de progression (temps de service par rapport aux 3 h maximum)
function AnneauService({ pct, couleur, children, taille = 190 }) {
  const r = (taille - 18) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <div style={{ position: "relative", width: taille, height: taille, flexShrink: 0 }}>
      <svg width={taille} height={taille} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="9" />
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={couleur} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} style={{ transition: "stroke-dasharray 1s linear" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", textAlign: "center" }}>{children}</div>
    </div>
  );
}

// État du pointage de l'agent en service
function etatPointage(actif, now) {
  if (!actif.pointage) return { ton: "off" };
  const dernier = new Date(actif.dernierPointage || actif.debut).getTime();
  const echeance = dernier + INTERVALLE_POINTAGE_MS, limite = echeance + DELAI_REPONSE_POINTAGE_MS;
  if (now < echeance) return { ton: "ok", dans: echeance - now, pct: (now - dernier) / INTERVALLE_POINTAGE_MS, dernier, echeance, limite };
  return { ton: "du", reste: limite - now, pct: 1, dernier, echeance, limite };
}

const PUCES_RESUME = ["Patrouille", "Contrôles routiers", "Intervention", "Prise de plainte", "Formation", "Surveillance", "RAS"];
const CHEMIN_TACHE = (t) => t.section;

function CarteServiceEnCours({ actif, now, onStop, discordLie, mienne = true }) {
  const [finEnCours, setFinEnCours] = useState(false);
  const [resume, setResume] = useState("");
  const duree = dureeService(actif, now);
  const pt = etatPointage(actif, now);
  const restant = Math.max(0, DUREE_MAX_SERVICE_MS - duree);
  const alerte = pt.ton === "du";
  const couleur = alerte ? "#FF6B6B" : restant < 15 * MIN ? "#FFB84D" : "#34C38F";
  const ajouter = (t) => setResume((r) => (r.trim() ? `${r.trim().replace(/[.,;]$/, "")}, ${t.toLowerCase()}` : t));
  return (
    <div style={{ position: "relative", overflow: "hidden", background: alerte ? "linear-gradient(135deg, #4A1020, #2A0C16)" : "linear-gradient(135deg, #0E3B2C, #0A2433)", border: `1px solid ${alerte ? "#8A2A3A" : "#1F6B52"}`, borderRadius: 20, padding: "24px 22px", marginBottom: 20, color: "#fff", boxShadow: "0 18px 40px -24px rgba(7,20,46,0.7)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #2F6FDE 0 33%, #fff 33% 66%, #E5384F 66%)" }} />
      <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
        <AnneauService pct={duree / DUREE_MAX_SERVICE_MS} couleur={couleur}>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.8, fontWeight: 700 }}>{alerte ? "⚠️ POINTAGE DÛ" : "🟢 EN SERVICE"}</div>
          <div style={{ fontFamily: "'Roboto Mono', 'Courier New', monospace", fontSize: 31, fontWeight: 700, margin: "4px 0 2px" }}>{fmtDuree(duree)}</div>
          <div style={{ fontSize: 11.5, opacity: 0.8 }}>depuis {fmtHeure(actif.debut)}</div>
        </AnneauService>
        <div style={{ flex: "1 1 280px", minWidth: 0, maxWidth: 420 }}>
          {pt.ton === "ok" && (
            <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700 }}><span>⏱️ Prochain pointage</span><span style={{ fontFamily: "monospace" }}>dans {mmss(pt.dans)}</span></div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.16)", borderRadius: 3, marginTop: 8, overflow: "hidden" }}><div style={{ width: `${Math.min(100, pt.pct * 100)}%`, height: "100%", background: "#5CC8FF" }} /></div>
              <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 6 }}>{discordLie ? "Tu recevras un message privé Discord avec un bouton, et une fenêtre s'ouvrira ici." : "Une fenêtre s'ouvrira ici. Lie ton Discord (Mon profil) pour aussi recevoir le rappel en message privé."}</div>
            </div>
          )}
          {pt.ton === "du" && (
            <div style={{ background: "rgba(229,56,79,0.22)", border: "1px solid #E5384F", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>⚠️ Confirme ta présence !</div>
              <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>Il te reste <b style={{ fontFamily: "monospace" }}>{mmss(pt.reste)}</b> : sans pointage, ton service sera arrêté automatiquement (compté jusqu'à ton dernier pointage).</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11.5, marginBottom: 12 }}>
            <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: 999, padding: "3px 10px" }}>✅ {Number(actif.pointages) || 0} pointage{(Number(actif.pointages) || 0) > 1 ? "s" : ""}</span>
            <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: 999, padding: "3px 10px" }}>🛑 arrêt auto dans {fmtDuree(restant)}</span>
          </div>
          {!finEnCours && <button className="gh-btn-anim" onClick={() => setFinEnCours(true)} style={{ ...buttonPrimary, width: "100%", marginTop: 0, background: "#E5384F" }}>Terminer mon service</button>}
        </div>
      </div>
      {finEnCours && (
        <div style={{ maxWidth: 640, margin: "18px auto 0", background: "#fff", color: "#14213A", borderRadius: 16, padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>📝 Résumé de ton service <span style={{ color: "#C0172D" }}>(obligatoire)</span></div>
          <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 8 }}>Il te sera renvoyé en message privé Discord à la fin du service.</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {PUCES_RESUME.map((t) => <button key={t} type="button" onClick={() => ajouter(t)} style={{ background: "#EEF3FA", border: "1px solid #C9D6EC", color: "#123A7A", borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ {t}</button>)}
          </div>
          <textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={3} maxLength={600} placeholder="Ex : patrouille centre-ville, 2 contrôles routiers, 1 intervention…" style={{ width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid #C3D0E2", padding: 10, fontSize: 13.5, fontFamily: "inherit", resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: resume.trim().length < 15 ? "#C0172D" : "#1F6B42", margin: "4px 0 10px" }}><span>Au moins 15 caractères. Les PV et comptes rendus rédigés pendant ton service sont comptés automatiquement.</span><span>{resume.trim().length}/600</span></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setFinEnCours(false)} style={smallBtn}>Annuler</button>
            <button className="gh-btn-anim" disabled={resume.trim().length < 15} onClick={() => { onStop(actif.id, { resume: resume.trim() }); setResume(""); setFinEnCours(false); }} style={{ ...buttonPrimary, width: "auto", padding: "10px 24px", marginTop: 0, background: "#C0172D", opacity: resume.trim().length < 15 ? 0.5 : 1 }}>Valider et terminer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CarteHorsService({ onStart, discordLie, prenom }) {
  const regles = [["⏱️", "3 h maximum", "puis arrêt automatique"], ["✅", "Pointage toutes les heures", "10 min pour répondre"], ["📝", "Résumé obligatoire", "à la fin du service"], ["💬", "Messages Discord", discordLie ? "début, rappels et résumé" : "lie ton Discord pour les recevoir"]];
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "radial-gradient(480px 240px at 100% 0%, rgba(92,200,255,0.25), transparent 70%), linear-gradient(135deg, #0D1A2E, #12305F)", border: "1px solid #234A85", borderRadius: 20, padding: "26px 22px", marginBottom: 20, color: "#fff", textAlign: "center", boxShadow: "0 18px 40px -24px rgba(7,20,46,0.7)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #2F6FDE 0 33%, #fff 33% 66%, #E5384F 66%)" }} />
      <div style={{ fontSize: 12, letterSpacing: 2.5, opacity: 0.8, fontWeight: 700 }}>🔴 HORS SERVICE</div>
      <div style={{ fontFamily: FONT_TITRE, fontSize: 24, fontWeight: 700, margin: "6px 0 16px" }}>Prêt à prendre ton service{prenom ? `, ${prenom}` : ""} ?</div>
      <button className="gh-btn-anim" onClick={onStart} style={{ ...buttonPrimary, width: "auto", padding: "13px 38px", fontSize: 16, background: "#2E7D4F", marginTop: 0 }}>🟢 Prendre mon service</button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 20, textAlign: "left" }}>
        {regles.map(([i, t, d]) => <div key={t} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 12px" }}><div style={{ fontSize: 13, fontWeight: 800 }}>{i} {t}</div><div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 2 }}>{d}</div></div>)}
      </div>
    </div>
  );
}

function CarteTachesService({ taches, onOpen }) {
  if (!taches || !taches.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: "5px solid #E0A23A", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>📋 À faire pendant ton service</div>
      <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 10 }}>Ces tâches sont aussi rappelées dans ton message Discord de prise de service.</div>
      <div style={{ display: "grid", gap: 6 }}>
        {taches.slice(0, 6).map((t) => (
          <button key={t.id} type="button" onClick={() => onOpen && onOpen(t.section)} style={{ textAlign: "left", display: "flex", gap: 10, alignItems: "center", background: "#FBFCFE", border: "1px solid #E1E8F2", borderRadius: 10, padding: "8px 12px", cursor: onOpen ? "pointer" : "default", fontFamily: "inherit" }}>
            <span style={{ fontSize: 20 }}>{t.icone}</span>
            <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 13.5, color: "#14213A" }}>{t.titre}</b><span style={{ display: "block", fontSize: 12, color: "#5A6B84" }}>{t.detail}</span></span>
            {t.nombre > 0 && <span style={{ background: "#FFF4D6", color: "#6B4E00", border: "1px solid #E8D28A", borderRadius: 999, padding: "1px 9px", fontSize: 12, fontWeight: 800 }}>{t.nombre}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MonServicePage({ current, services, onStart, onStop, quotaReglages = QUOTA_DEFAUT, absences = [], onAddAbsence, onCancelAbsence, taches = [], onOpenSection }) {
  const now = useNow(1000);
  const mine = services.filter((s) => s.matricule === current.matricule);
  const actif = mine.find((s) => s.type !== "ajustement" && !s.fin);
  const archive = mine.find((s) => s.archive);
  const st = statsService(mine, now);
  const groupes = [];
  mine.filter((s) => !s.archive).slice().sort(triDate).slice(0, 60).forEach((s) => {
    const ref = dateRefService(s);
    const cle = cleJour(ref);
    let g = groupes.find((x) => x.cle === cle);
    if (!g) { g = { cle, date: ref, items: [], ms: 0 }; groupes.push(g); }
    g.items.push(s);
    g.ms += dureeService(s, now);
  });
  const discordLie = !!current.discordId;

  return (
    <div style={{ maxWidth: 780 }}>
      <NeoBandeau surtitre="Terrain · carnet de service" titre="PRISE DE SERVICE" texte="Prends et termine ton service ; ton temps est comptabilisé automatiquement."
        droite={<><NeoCompteur n={fmtDuree(st.jour)} label="Aujourd'hui" couleur="#34C38F" /><NeoCompteur n={fmtDuree(st.semaine)} label="Semaine" couleur="#5CC8FF" /></>} />
      {actif ? <CarteServiceEnCours actif={actif} now={now} onStop={onStop} discordLie={discordLie} /> : <CarteHorsService onStart={onStart} discordLie={discordLie} prenom={current.prenom} />}
      <CarteTachesService taches={taches} onOpen={onOpenSection} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="Aujourd'hui" ms={st.jour} accent="#2E7D4F" />
        <StatBox label="Cette semaine" ms={st.semaine} accent="#2F6FDE" />
        <StatBox label="Total" ms={st.total} accent="#123A7A" />
      </div>
      <CarteQuota st={st} quotaMs={quotaMsDe(current, quotaReglages)} reserviste={estReserviste(current)} auto={quotaReglages.quotaAuto === true} absenceSem={absences.some((a) => a.matricule === current.matricule && absenceSemaine(a, debutSemaine(new Date(now))))} />
      <RepartitionService st={st} />
      {onAddAbsence && <AbsencesCard current={current} absences={absences} onAdd={onAddAbsence} onCancel={onCancelAbsence} />}
      <div style={{ ...labelStyle, marginBottom: 6 }}>Historique de mes services</div>
      <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 10, lineHeight: 1.5 }}>🗂️ Chaque semaine, les services des semaines passées sont archivés automatiquement. <b>Ton total d'heures est conservé.</b></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {groupes.map((g) => (
          <div key={g.cle}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, color: "#3A4D6B", marginBottom: 6, textTransform: "capitalize" }}>
              <span>{new Date(g.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
              <span style={{ color: "#123A7A" }}>{fmtDuree(g.ms)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.items.map((s) => <LigneService key={s.id} s={s} now={now} />)}
            </div>
          </div>
        ))}
        {archive && <LigneService s={archive} now={now} />}
        {groupes.length === 0 && !archive && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun service enregistré.</div>}
      </div>
    </div>
  );
}

// Visible par tous les gendarmes : temps de service de toute l'équipe
export function ServicesEquipePage({ current, personnel, services, etat, quotaReglages = QUOTA_DEFAUT, absences = [] }) {
  const now = useNow(30000);
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("semaine");
  const [ouverts, setOuverts] = useState({});
  const parMat = useMemo(() => grouperParMatricule(services), [services]);
  const toutes = useMemo(() => lignesTemps(personnel, parMat, now, "", tri), [personnel, parMat, now, tri]);
  const lignes = useMemo(() => lignesTemps(personnel, parMat, now, recherche, tri), [personnel, parMat, now, recherche, tri]);
  const enService = toutes.filter((x) => x.actif).sort((a, b) => new Date(a.actif.debut) - new Date(b.actif.debut));
  const totalSemaine = toutes.reduce((n, x) => n + x.st.semaine, 0);
  const actifsSemaine = toutes.filter((x) => x.st.semaine > 0).length;
  const maxSemaine = Math.max(1, ...lignes.map((x) => x.st.semaine));
  const auj = cleJour(now);
  const absenceDe = (mat) => absences.find((a) => a.matricule === mat && absenceActive(a, auj)) || null;
  const nbAbsents = toutes.filter((x) => absenceDe(x.p.matricule)).length;
  const tuile = (l, v, c) => (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );
  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={h2Style}>Services de l'équipe</h2>
      {etat === "erreur" ? (
        <div style={{ background: "#FDECEC", border: "1px solid #E5B4B4", color: "#8A2A2A", borderRadius: 10, padding: 16, fontSize: 13.5 }}>
          Impossible de charger les services de l'équipe pour le moment. Si le problème continue, les règles Firestore de la collection « services » doivent autoriser la lecture à tous les gendarmes connectés.
        </div>
      ) : etat !== "ok" ? (
        <div style={{ color: "#5A6B84", fontSize: 13 }}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
            {tuile("En service maintenant", enService.length, "#2E7D4F")}
            {tuile("Heures de l'équipe cette semaine", fmtDuree(totalSemaine), "#2F6FDE")}
            {tuile("Gendarmes actifs cette semaine", actifsSemaine, "#123A7A")}
            {tuile("Absents aujourd'hui", nbAbsents, "#B7791F")}
          </div>

          <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🟢 En service maintenant ({enService.length})</div>
            {enService.length === 0 ? <div style={{ fontSize: 13, color: "#5A6B84" }}>Personne n'est en service.</div> : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {enService.map(({ p, actif }) => (
                  <span key={p.id} style={{ background: "#E3F2E8", color: "#1F6B42", fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 16 }}>
                    {p.prenom} {p.nom} · depuis {fmtHeure(actif.debut)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un gendarme…" style={{ padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, flex: "1 1 220px", boxSizing: "border-box" }} />
            <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
              <option value="semaine">Trier : cette semaine</option>
              <option value="jour">Trier : aujourd'hui</option>
              <option value="total">Trier : total</option>
              <option value="nom">Trier : nom</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lignes.map(({ p, st, actif }) => (
              <CarteTemps key={p.id} p={p} st={st} actif={actif} now={now} max={maxSemaine} quotaMs={quotaMsDe(p, quotaReglages)} absence={absenceDe(p.matricule)} moi={p.id === current.id} ouvert={!!ouverts[p.id]} onToggle={() => setOuverts({ ...ouverts, [p.id]: !ouverts[p.id] })} />
            ))}
            {lignes.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun gendarme trouvé.</div>}
          </div>
          <div style={{ fontSize: 11.5, color: "#7B8AA3", marginTop: 14 }}>Clique sur un gendarme pour voir le détail de sa semaine. Les temps se mettent à jour quand tu rouvres la page.</div>
        </>
      )}
    </div>
  );
}

// Services à vérifier : pointage non confirmé, arrêt automatique, aucune activité (PV / CR) ou service sans résumé (7 derniers jours)
function ServicesSuspects({ services, nomDe }) {
  const limite = Date.now() - 7 * 86400000;
  const liste = services
    .filter((s) => s.type === "service" && s.fin && !s.force && new Date(s.debut).getTime() >= limite)
    .map((s) => {
      const raisons = [];
      if (s.motifArret === "pointage") raisons.push("pointage non confirmé");
      else if (s.motifArret === "duree") raisons.push("service jamais terminé (arrêt auto)");
      if (s.resume !== undefined && s.activite === 0 && new Date(s.fin) - new Date(s.debut) >= 60 * 60000) raisons.push("1 h+ sans aucun PV / compte rendu");
      return { s, raisons };
    })
    .filter((x) => x.raisons.length)
    .sort((a, b) => new Date(b.s.debut) - new Date(a.s.debut));
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: "5px solid #C0172D", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🚩 Services suspects ({liste.length}) — 7 derniers jours</div>
      <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 8 }}>Pas forcément de la triche : à vérifier avec le gendarme (lis son résumé).</div>
      {liste.slice(0, 30).map(({ s, raisons }) => (
        <div key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid #E6EDF7", fontSize: 13 }}>
          <b>{nomDe(s.matricule)}</b> — {fmtJourCourt(s.debut)} {fmtHeure(s.debut)} → {fmtHeure(s.fin)} : <span style={{ color: "#C0172D", fontWeight: 600 }}>{raisons.join(" · ")}</span>
          {s.resume && <div style={{ fontSize: 12, color: "#3A4D6B", fontStyle: "italic" }}>« {s.resume} »</div>}
        </div>
      ))}
      {liste.length === 0 && <div style={{ color: "#2E7D4F", fontSize: 13 }}>✅ Rien de suspect.</div>}
    </div>
  );
}

export function AdminServicesPage({ personnel, services, onForceStop, onAdjust, onDelete, quotaReglages = QUOTA_DEFAUT, absences = [], onSaveQuota }) {
  const now = useNow(1000);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ sens: "Retirer du temps", heures: "", minutes: "", motif: "" });
  const [msg, setMsg] = useState("");
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("semaine");
  const actifs = services.filter((s) => s.type !== "ajustement" && !s.fin);
  const nomDe = (mat) => { const p = personnel.find((x) => x.matricule === mat); return p ? `${p.prenom} ${p.nom}` : "Agent"; };
  const card = { background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 18, marginBottom: 18 };

  if (sel) {
    const p = personnel.find((x) => x.matricule === sel);
    const liste = services.filter((s) => s.matricule === sel);
    const st = statsService(liste, now);
    const histo = liste.slice().sort(triDate).slice(0, 60);
    async function ajuster(e) {
      e.preventDefault();
      const total = Number(form.heures || 0) * 60 + Number(form.minutes || 0);
      if (!(total > 0)) { setMsg("Indique une durée (heures et/ou minutes)."); return; }
      const ok = await onAdjust({ matricule: sel, nom: nomDe(sel), minutes: form.sens === "Retirer du temps" ? -total : total, motif: form.motif.trim() });
      if (ok) { setMsg("Ajustement enregistré."); setForm({ ...form, heures: "", minutes: "", motif: "" }); }
    }
    return (
      <div style={{ maxWidth: 760 }}>
        <button style={{ ...smallBtn, marginBottom: 14 }} onClick={() => { setSel(null); setMsg(""); }}>← Retour à la liste</button>
        <h2 style={h2Style}>{p ? `${p.prenom} ${p.nom}` : "Agent"} {p && <span style={{ fontSize: 13, color: "#5A6B84" }}>(n° {numAgent(p)})</span>}</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <StatBox label="Aujourd'hui" ms={st.jour} />
          <StatBox label="Cette semaine" ms={st.semaine} />
          <StatBox label="Total" ms={st.total} />
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Ajouter ou retirer du temps</div>
          <form onSubmit={ajuster}>
            <Select label="Action" value={form.sens} onChange={(v) => setForm({ ...form, sens: v })} options={["Retirer du temps", "Ajouter du temps"]} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Heures" type="number" value={form.heures} onChange={(v) => setForm({ ...form, heures: v })} /></div>
              <div style={{ flex: 1 }}><Field label="Minutes" type="number" value={form.minutes} onChange={(v) => setForm({ ...form, minutes: v })} /></div>
            </div>
            <Field label="Motif (facultatif)" value={form.motif} onChange={(v) => setForm({ ...form, motif: v })} />
            {msg && <div style={{ fontSize: 12, color: "#123A7A", marginBottom: 8 }}>{msg}</div>}
            <button className="gh-btn-anim" type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>Valider</button>
          </form>
        </div>
        <RepartitionService st={st} />
        <div style={{ ...labelStyle, marginBottom: 8 }}>Historique</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {histo.map((s) => <LigneService key={s.id} s={s} now={now} onDelete={(id) => { if (window.confirm("Supprimer cette ligne définitivement ?")) onDelete(id); }} onForceStop={onForceStop} />)}
          {histo.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun service enregistré.</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={h2Style}>Gestion des services</h2>
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>🟢 Actuellement en service ({actifs.length})</div>
        <div style={{ fontSize: 12, color: "#5A6B84", marginBottom: 10, lineHeight: 1.5 }}>Si tu forces l'arrêt, le gendarme reçoit un message Discord l'avertissant que l'administration a arrêté son service.</div>
        {actifs.map((s) => {
          const pt = etatPointage(s, now);
          const du = pt.ton === "du";
          return (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "9px 12px", marginBottom: 6, background: du ? "#FDECEE" : "#F5FAF7", border: `1px solid ${du ? "#E8A0AA" : "#CFE6D8"}`, borderLeft: `5px solid ${du ? "#C0172D" : "#2E7D4F"}`, borderRadius: 10, fontSize: 13 }}>
              <span>
                <b>{nomDe(s.matricule)}</b> — depuis {fmtHeure(s.debut)} ({fmtDuree(dureeService(s, now))})
                <span style={{ display: "block", fontSize: 11.5, color: du ? "#8A1020" : "#5A6B84", fontWeight: du ? 700 : 400, marginTop: 2 }}>
                  {pt.ton === "off" ? "Service sans pointage" : du ? `⚠️ Pointage dû : arrêt automatique dans ${mmss(pt.reste)}` : `✅ ${Number(s.pointages) || 0} pointage(s) · prochain dans ${mmss(pt.dans)}`}
                </span>
              </span>
              <button style={smallBtn} onClick={() => { if (window.confirm(`Forcer l'arrêt du service de ${nomDe(s.matricule)} ? Il en sera prévenu par message Discord.`)) onForceStop(s.id); }}>Forcer l'arrêt</button>
            </div>
          );
        })}
        {actifs.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Personne n'est en service.</div>}
      </div>
      <ServicesSuspects services={services} nomDe={nomDe} />
      {onSaveQuota && <QuotaAdminPanel reglages={quotaReglages} onSave={onSaveQuota} />}
      <div style={{ ...labelStyle, marginBottom: 8 }}>Heures par gendarme</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un gendarme…" style={{ padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 13.5, flex: "1 1 220px", boxSizing: "border-box" }} />
        <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
          <option value="semaine">Trier : cette semaine</option>
          <option value="jour">Trier : aujourd'hui</option>
          <option value="total">Trier : total</option>
          <option value="nom">Trier : nom</option>
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(() => {
          const parMat = grouperParMatricule(services);
          const lignes = lignesTemps(personnel, parMat, now, recherche, tri);
          const max = Math.max(1, ...lignes.map((x) => x.st.semaine));
          return lignes.map(({ p, st, actif }) => (
            <CarteTemps key={p.id} p={p} st={st} actif={actif} now={now} max={max} quotaMs={quotaMsDe(p, quotaReglages)} absence={absences.find((a) => a.matricule === p.matricule && absenceActive(a, cleJour(now))) || null} action={<button style={smallBtn} onClick={() => { setSel(p.matricule); setMsg(""); }}>Détails / modifier</button>} />
          ));
        })()}
      </div>
    </div>
  );
}
