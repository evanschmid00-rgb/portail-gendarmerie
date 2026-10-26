// pages/vigipirate.jsx — Plan Vigipirate (RP) : bandeau repliable affiché aux civils et aux gendarmes + page de modification (commandement).
import { ChevronDown, Pencil, ShieldAlert } from "lucide-react";
import React, { useState } from "react";
import { h2Style, smallBtn } from "../composants/ui.jsx";
import { NIVEAUX_VIGIPIRATE, planEffectif } from "../lib/vigipirate.js";

const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";
const fmtQuand = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
};

function Points({ n, c }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, verticalAlign: "middle" }} aria-label={`Niveau ${n} sur 3`}>
      {[1, 2, 3].map((i) => <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i <= n ? c : "transparent", border: `1.5px solid ${c}` }} />)}
    </span>
  );
}

const ANIM = `@keyframes vigiEntree { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vigiPulse { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.55); } 70% { box-shadow: 0 0 0 12px rgba(255,255,255,0); } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); } }
@keyframes vigiDefile { from { background-position: 0 0; } to { background-position: 56px 0; } }
@media (prefers-reduced-motion: reduce) { .vigi-anim { animation: none !important; } }`;

const RAYURES = (c1, c2) => `repeating-linear-gradient(135deg, ${c1} 0 14px, ${c2} 14px 28px)`;

// Échelle des 3 niveaux : le niveau en vigueur est mis en avant
function Echelle({ niveau }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", marginBottom: 7 }}>Échelle du plan</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3].map((i) => {
          const d = NIVEAUX_VIGIPIRATE[i];
          const actif = i === niveau;
          return (
            <div key={i} style={{ flex: 1, minWidth: 0, borderRadius: 8, padding: "7px 9px", background: actif ? d.barre : "#EEF2F8", color: actif ? d.tBarre : "#7B8AA3", border: `1.5px solid ${actif ? d.c : "#D3DDEA"}`, opacity: actif ? 1 : 0.8, boxShadow: actif ? `0 6px 14px -8px ${d.c}` : "none" }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>Niveau {i}{actif ? " · en vigueur" : ""}</div>
              <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.nom.split(" – ")[0]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListePuces({ titre, lignes, couleur, icone }) {
  if (!lignes.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${couleur}`, borderRadius: 12, padding: "12px 14px", marginTop: 12 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: couleur, marginBottom: 8 }}>{icone} {titre}</div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {lignes.map((l, i) => (
          <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "#14213A", lineHeight: 1.5 }}>
            <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: couleur, color: "#fff", fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
            <span>{l}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Contenu du volet déroulé : explication + consignes (les gendarmes voient en plus leurs consignes)
function VoletPlan({ p, interne }) {
  const { def } = p;
  return (
    <div style={{ animation: "vigiEntree .22s ease-out" }}>
      <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${def.c}`, borderRadius: 12, padding: "12px 14px", marginTop: 12 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: def.ct, marginBottom: 6 }}>ℹ️ Que signifie ce niveau ?</div>
        <div style={{ fontSize: 13, color: "#14213A", lineHeight: 1.6 }}>{p.explication}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "0 14px" }}>
        <ListePuces titre={interne ? "Consignes données à la population" : "Consignes pour la population"} lignes={p.consignesCivils} couleur={def.ct} icone="👥" />
        {interne && <ListePuces titre="Consignes aux gendarmes" lignes={p.consignesGendarmes} couleur="#123A7A" icone="🛡️" />}
      </div>
      <Echelle niveau={p.niveau} />
      <div style={{ marginTop: 14, fontSize: 11, color: "#5A6B84", lineHeight: 1.45 }}>
        {p.updatedAt ? `Dernière mise à jour : ${fmtQuand(p.updatedAt)}${p.updatedBy ? ` — ${p.updatedBy}` : ""}. ` : ""}
        Plan fictif de jeu de rôle, inspiré du plan Vigipirate. Aucun lien avec le dispositif réel.
      </div>
    </div>
  );
}

/* ---------- Bandeau : niveau en vigueur + volet « explications et consignes » ---------- */

// plan = document Firestore settings/vigipirate (ou null) ; mode = "civil" | "gendarme"
// variante : "barre" (pleine largeur, collée en haut de page — espace civil) ou "carte" (encadré arrondi — espace gendarmes)
// compact : en variante « barre », cache la phrase de résumé (pages civiles secondaires)
export function BandeauVigipirate({ plan, mode = "civil", variante = "carte", compact = false, peutModifier = false, onModifier, ouvertParDefaut = false, style }) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const p = planEffectif(plan);
  const { def } = p;
  const interne = mode === "gendarme";

  if (variante === "barre") {
    const pill = { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.22)", color: "inherit", border: "1px solid currentColor", borderRadius: 999, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" };
    return (
      <div style={{ width: "100%", background: def.barre, color: def.tBarre, fontFamily: FONT, boxShadow: "0 4px 14px -8px rgba(7,20,46,0.5)", ...style }}>
        <style>{ANIM}</style>
        {p.niveau >= 2 && <div className="vigi-anim" style={{ height: 5, backgroundImage: RAYURES(p.niveau === 3 ? "#fff" : "#2B1600", def.barre), backgroundSize: "56px 100%", animation: "vigiDefile 2.4s linear infinite", opacity: 0.55 }} />}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "9px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="vigi-anim" style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "2px solid currentColor", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: p.niveau === 3 ? "vigiPulse 1.6s ease-out infinite" : "none" }}>
            <ShieldAlert size={22} strokeWidth={2.3} />
          </span>
          <div style={{ flex: "1 1 260px", minWidth: 0, lineHeight: 1.3 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.8 }}>Plan Vigipirate en vigueur · RP</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Niveau {p.niveau} — {def.nom} <Points n={p.niveau} c={def.tBarre} /></div>
            {!compact && <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 1 }}>{def.resume}</div>}
          </div>
          <button type="button" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} style={pill}>
            {ouvert ? "Masquer" : "Explications et consignes"}
            <ChevronDown size={16} style={{ transition: "transform .2s", transform: ouvert ? "rotate(180deg)" : "rotate(0deg)" }} />
          </button>
          {peutModifier && onModifier && <button type="button" onClick={onModifier} style={pill}><Pencil size={13} /> Modifier</button>}
        </div>
        {p.message && (
          <div style={{ background: "rgba(0,0,0,0.16)" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 16px", fontSize: 13, lineHeight: 1.5 }}><b>📣 Message du commandement :</b> {p.message}</div>
          </div>
        )}
        {ouvert && (
          <div style={{ background: def.fond, borderBottom: `4px solid ${def.barre}` }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "6px 16px 18px" }}><VoletPlan p={p} interne={interne} /></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: def.fond, border: `1px solid ${def.c}55`, borderLeft: `6px solid ${def.c}`, borderRadius: 14, fontFamily: FONT, boxShadow: "0 6px 18px -12px rgba(7,20,46,0.35)", overflow: "hidden", ...style }}>
      <style>{ANIM}</style>
      {p.niveau >= 2 && <div className="vigi-anim" style={{ height: 4, backgroundImage: RAYURES(def.c, def.fond), backgroundSize: "56px 100%", animation: "vigiDefile 2.4s linear infinite", opacity: 0.6 }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} style={{ flex: "1 1 280px", minWidth: 0, display: "flex", alignItems: "center", gap: 14, background: "transparent", border: "none", cursor: "pointer", padding: "12px 14px", textAlign: "left", fontFamily: FONT }}>
          <span className="vigi-anim" style={{ width: 48, height: 48, borderRadius: 12, background: def.c, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: p.niveau === 3 ? "vigiPulse 1.6s ease-out infinite" : "none" }}>
            <ShieldAlert size={26} color="#fff" strokeWidth={2.2} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#5A6B84" }}>Plan Vigipirate en vigueur · RP</span>
            <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: "#14213A", margin: "2px 0", lineHeight: 1.25 }}>
              <span style={{ color: def.ct }}>Niveau {p.niveau}</span> · {def.nom} <Points n={p.niveau} c={def.c} />
            </span>
            <span style={{ display: "block", fontSize: 12.5, color: "#3A4D6B", lineHeight: 1.4 }}>{def.resume}</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: def.ct, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            <span>{ouvert ? "Masquer" : "Explications et consignes"}</span>
            <ChevronDown size={18} style={{ transition: "transform .2s", transform: ouvert ? "rotate(180deg)" : "rotate(0deg)" }} />
          </span>
        </button>
        {peutModifier && onModifier && (
          <button type="button" onClick={onModifier} style={{ ...smallBtn, display: "inline-flex", alignItems: "center", gap: 6, marginRight: 14 }}>
            <Pencil size={13} /> Modifier le niveau
          </button>
        )}
      </div>
      {p.message && (
        <div style={{ margin: "0 14px 12px", background: "#fff", border: `1px solid ${def.c}66`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#14213A", lineHeight: 1.5 }}>
          <b style={{ color: def.ct }}>📣 Message du commandement :</b> {p.message}
        </div>
      )}
      {ouvert && (
        <div style={{ background: "rgba(255,255,255,0.7)", borderTop: `1px solid ${def.c}33`, padding: "2px 18px 16px" }}>
          <VoletPlan p={p} interne={interne} />
        </div>
      )}
    </div>
  );
}

/* ---------- Page de modification (Corps de Commandement + admins) ---------- */

const zone = { width: "100%", boxSizing: "border-box", border: "1px solid #C3D0E2", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: FONT, lineHeight: 1.5, resize: "vertical", background: "#fff" };

export function VigipirateAdmin({ plan, onSave }) {
  const init = planEffectif(plan);
  const [niveau, setNiveau] = useState(init.niveau);
  const [message, setMessage] = useState(init.message);
  const [explication, setExplication] = useState(init.explication);
  const [civils, setCivils] = useState(init.consignesCivils.join("\n"));
  const [gendarmes, setGendarmes] = useState(init.consignesGendarmes.join("\n"));
  const [etat, setEtat] = useState({ busy: false, ok: false, erreur: "" });

  const defDe = (n) => NIVEAUX_VIGIPIRATE[n];
  const textesParDefaut = (n) => ({ explication: defDe(n).explication, civils: defDe(n).consignesCivils.join("\n"), gendarmes: defDe(n).consignesGendarmes.join("\n") });
  const charger = (n) => { const t = textesParDefaut(n); setExplication(t.explication); setCivils(t.civils); setGendarmes(t.gendarmes); };

  function choisir(n) {
    if (n === niveau) return;
    const t = textesParDefaut(niveau);
    const modifie = explication !== t.explication || civils !== t.civils || gendarmes !== t.gendarmes;
    if (modifie && !window.confirm(`Les textes que tu as modifiés seront remplacés par ceux du niveau ${n}. Continuer ?`)) return;
    setNiveau(n);
    charger(n);
    setEtat({ busy: false, ok: false, erreur: "" });
  }

  async function publier() {
    setEtat({ busy: true, ok: false, erreur: "" });
    const ok = await onSave({ niveau, message: message.trim(), explication: explication.trim(), consignesCivils: civils.trim(), consignesGendarmes: gendarmes.trim() });
    setEtat(ok ? { busy: false, ok: true, erreur: "" } : { busy: false, ok: false, erreur: "L'enregistrement a échoué. Vérifie ta connexion et tes droits (Corps de Commandement ou admin), puis réessaie." });
  }

  const apercu = { niveau, message, explication, consignesCivils: civils, consignesGendarmes: gendarmes };
  const compte = (v, max) => <div style={{ fontSize: 11, color: v.length >= max ? "#C0172D" : "#7B8AA3", textAlign: "right", margin: "-12px 0 12px" }}>{v.length} / {max}</div>;
  const titreEtape = (n, t) => <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 10px" }}><span style={{ width: 26, height: 26, borderRadius: "50%", background: "#123A7A", color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span><span style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontWeight: 800, color: "#14213A" }}>{t}</span></div>;
  const label = (t, aide) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#14213A", marginBottom: 4 }}>{t}</div>
      {aide && <div style={{ fontSize: 11.5, color: "#5A6B84", marginBottom: 5 }}>{aide}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={h2Style}>Plan Vigipirate</h2>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 16, lineHeight: 1.5 }}>
        Choisis le niveau en vigueur : il s'affiche aussitôt en haut du site civil et de l'espace gendarmes, avec un volet d'explications et de consignes.
        Réservé au Corps de Commandement et aux admins.
      </div>

      {titreEtape(1, "Choisir le niveau")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 22 }}>
        {[1, 2, 3].map((n) => {
          const d = defDe(n);
          const actif = n === niveau;
          return (
            <button key={n} type="button" onClick={() => choisir(n)} style={{ textAlign: "left", cursor: "pointer", background: actif ? d.fond : "#fff", border: `2px solid ${actif ? d.c : "#D3DDEA"}`, borderRadius: 14, padding: "12px 14px", fontFamily: FONT, boxShadow: actif ? `0 6px 18px -10px ${d.c}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: d.c, letterSpacing: 1, textTransform: "uppercase" }}>Niveau {n}</span>
                <Points n={n} c={d.c} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#14213A", marginBottom: 3 }}>{d.nom}</div>
              <div style={{ fontSize: 11.5, color: "#5A6B84", lineHeight: 1.4 }}>{d.resume}</div>
              {actif && <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: d.c }}>✓ Niveau sélectionné</div>}
            </button>
          );
        })}
      </div>

      {titreEtape(2, "Rédiger les textes")}
      <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 14, padding: 20, boxShadow: "0 6px 20px -10px rgba(7,20,46,0.3)", marginBottom: 22 }}>
        {label("📣 Message du commandement (facultatif)", "Une phrase affichée en évidence sous le niveau (ex : « Rassemblement sur la place ce soir, présence renforcée »). Laisse vide s'il n'y a rien à ajouter.")}
        <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 400))} rows={2} style={{ ...zone, marginTop: -8, marginBottom: 16 }} />
        {compte(message, 400)}

        {label("Explication du plan en vigueur", "Texte affiché dans le volet « Que signifie ce niveau ? ».")}
        <textarea value={explication} onChange={(e) => setExplication(e.target.value.slice(0, 1800))} rows={5} style={{ ...zone, marginTop: -8, marginBottom: 16 }} />

        {label("Consignes pour la population (civils)", "Une consigne par ligne.")}
        <textarea value={civils} onChange={(e) => setCivils(e.target.value.slice(0, 2800))} rows={6} style={{ ...zone, marginTop: -8, marginBottom: 16 }} />

        {label("Consignes aux gendarmes", "Une consigne par ligne. Visibles uniquement dans l'espace gendarmes.")}
        <textarea value={gendarmes} onChange={(e) => setGendarmes(e.target.value.slice(0, 2800))} rows={6} style={{ ...zone, marginTop: -8, marginBottom: 16 }} />

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={publier} disabled={etat.busy} style={{ background: defDe(niveau).c, color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: etat.busy ? 0.7 : 1, fontFamily: FONT }}>
            {etat.busy ? "Publication…" : `Publier le niveau ${niveau}`}
          </button>
          <button type="button" onClick={() => { charger(niveau); setEtat({ busy: false, ok: false, erreur: "" }); }} style={smallBtn}>Remettre les textes par défaut du niveau {niveau}</button>
          {etat.ok && <span style={{ color: "#1F6B42", fontWeight: 700, fontSize: 13 }}>✓ Niveau publié : il est visible partout.</span>}
        </div>
        {etat.erreur && <div style={{ marginTop: 12, background: "#FBE3E7", border: "1px solid #C0172D", color: "#8A1020", borderRadius: 10, padding: "10px 12px", fontSize: 12.5 }}>{etat.erreur}</div>}
      </div>

      {titreEtape(3, "Vérifier l'aperçu")}
      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 8 }}>Aperçu espace civil</div>
      <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 22, border: "1px solid #D3DDEA" }}>
        <BandeauVigipirate key={`c${niveau}`} plan={apercu} mode="civil" variante="barre" ouvertParDefaut />
      </div>
      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 8 }}>Aperçu espace gendarmes</div>
      <BandeauVigipirate key={`g${niveau}`} plan={apercu} mode="gendarme" ouvertParDefaut />
    </div>
  );
}
