// pages/services.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useEffect, useMemo, useState } from "react";
import { auth } from "../firebase";
import { BarreTemps, Field, Select, StatBox, buttonPrimary, h2Style, labelStyle, selectStyle, smallBtn } from "../composants/ui.jsx";
import { FONT_TITRE } from "../lib/constantes.js";
import { QUOTA_DEFAUT, absenceActive, absenceSemaine, cleJour, dateRefService, debutSemaine, dureeService, estReserviste, fmtDuree, fmtHeure, fmtJourCourt, fmtJourFR, grouperParMatricule, lundiProchainStr, quotaMsDe, statsService, triDate, useNow } from "../lib/utils.js";

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
    .filter(({ p }) => !q || norm(`${p.prenom} ${p.nom} ${p.matricule} ${p.grade} ${p.cipcNumero || ""}`).includes(q))
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
          <div style={{ fontSize: 12, color: "#5A6B84" }}>{[p.grade, p.unite].filter(Boolean).join(" · ") || `Matricule ${p.matricule}`}</div>
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

export function MonServicePage({ current, services, onStart, onStop, quotaReglages = QUOTA_DEFAUT, absences = [], onAddAbsence, onCancelAbsence }) {
  const now = useNow(1000);
  const mine = services.filter((s) => s.matricule === current.matricule);
  const actif = mine.find((s) => s.type !== "ajustement" && !s.fin);
  const st = statsService(mine, now);
  const groupes = [];
  mine.slice().sort(triDate).slice(0, 60).forEach((s) => {
    const ref = dateRefService(s);
    const cle = cleJour(ref);
    let g = groupes.find((x) => x.cle === cle);
    if (!g) { g = { cle, date: ref, items: [], ms: 0 }; groupes.push(g); }
    g.items.push(s);
    g.ms += dureeService(s, now);
  });

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={h2Style}>Mon service</h2>
      <div style={{ background: actif ? "linear-gradient(135deg, #E3F2E8, #F4FAF6)" : "#fff", border: "1px solid " + (actif ? "#2E7D4F" : "#D3DDEA"), borderRadius: 16, padding: "26px 22px", marginBottom: 20, textAlign: "center", boxShadow: "0 8px 24px -16px rgba(7,20,46,0.35)" }}>
        {actif ? (
          <>
            <div style={{ fontSize: 13, color: "#2E7D4F", fontWeight: 700, letterSpacing: 1 }}>🟢 EN SERVICE depuis {fmtHeure(actif.debut)}</div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 42, fontWeight: 700, margin: "8px 0 16px", color: "#14213A" }}>{fmtDuree(dureeService(actif, now))}</div>
            <button className="gh-btn-anim" onClick={() => onStop(actif.id)} style={{ ...buttonPrimary, width: "auto", padding: "10px 28px", background: "#C0172D" }}>Terminer mon service</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: "#5A6B84", marginBottom: 14 }}>🔴 Tu n'es pas en service</div>
            <button className="gh-btn-anim" onClick={onStart} style={{ ...buttonPrimary, width: "auto", padding: "10px 28px", background: "#2E7D4F" }}>Prendre mon service</button>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="Aujourd'hui" ms={st.jour} accent="#2E7D4F" />
        <StatBox label="Cette semaine" ms={st.semaine} accent="#2F6FDE" />
        <StatBox label="Total" ms={st.total} accent="#123A7A" />
      </div>
      <CarteQuota st={st} quotaMs={quotaMsDe(current, quotaReglages)} reserviste={estReserviste(current)} auto={quotaReglages.quotaAuto === true} absenceSem={absences.some((a) => a.matricule === current.matricule && absenceSemaine(a, debutSemaine(new Date(now))))} />
      <RepartitionService st={st} />
      {onAddAbsence && <AbsencesCard current={current} absences={absences} onAdd={onAddAbsence} onCancel={onCancelAbsence} />}
      <div style={{ ...labelStyle, marginBottom: 10 }}>Historique de mes services</div>
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
        {groupes.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun service enregistré.</div>}
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

export function AdminServicesPage({ personnel, services, onForceStop, onAdjust, onDelete, quotaReglages = QUOTA_DEFAUT, absences = [], onSaveQuota }) {
  const now = useNow(1000);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ sens: "Retirer du temps", heures: "", minutes: "", motif: "" });
  const [msg, setMsg] = useState("");
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("semaine");
  const actifs = services.filter((s) => s.type !== "ajustement" && !s.fin);
  const nomDe = (mat) => { const p = personnel.find((x) => x.matricule === mat); return p ? `${p.prenom} ${p.nom}` : mat; };
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
        <h2 style={h2Style}>{p ? `${p.prenom} ${p.nom}` : sel} <span style={{ fontSize: 13, color: "#5A6B84" }}>({sel})</span></h2>
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
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🟢 Actuellement en service ({actifs.length})</div>
        {actifs.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #E6EDF7", fontSize: 13 }}>
            <span><b>{nomDe(s.matricule)}</b> — depuis {fmtHeure(s.debut)} ({fmtDuree(dureeService(s, now))})</span>
            <button style={smallBtn} onClick={() => { if (window.confirm(`Forcer l'arrêt du service de ${nomDe(s.matricule)} ?`)) onForceStop(s.id); }}>Forcer l'arrêt</button>
          </div>
        ))}
        {actifs.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Personne n'est en service.</div>}
      </div>
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
