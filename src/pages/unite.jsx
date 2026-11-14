// pages/unite.jsx — Unités : chaque unité est indépendante.
//  • MonUnitePage : le commandant (ou l'adjoint) gère SON unité — effectif, fonctions propres à l'unité, candidatures.
//  • UnitesAdminPage : les admins nomment le commandant / l'adjoint de chaque unité et règlent les rôles Discord.
import React, { useEffect, useState } from "react";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { NeoBandeau, NeoCompteur, NeoOnglets, NeoCarte, NeoAlerte, NeoBouton, NEO_INP, NEO_LAB, N, FONT_N } from "../composants/neo.jsx";
import { roleUnite, idConfigUnite, configUnite, fonctionsDe, COULEURS_FONCTION } from "../lib/unites.js";
import { appelRolesDiscord } from "../lib/rolesDiscord.js";

const nomDe = (p) => `${p.grade ? p.grade + " " : ""}${p.prenom || ""} ${p.nom || ""}`.trim();
const PUCE = (couleur, plein) => ({ display: "inline-flex", alignItems: "center", gap: 5, border: `1.5px solid ${couleur}`, background: plein ? couleur : "#fff", color: plein ? "#fff" : couleur, borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" });
const BTN = { border: "1px solid #123A7A", background: "#fff", color: "#123A7A", borderRadius: 10, padding: "7px 14px", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };

// ───────────────────────── Mon unité (commandant / adjoint) ─────────────────────────
export function MonUnitePage({ current, personnel = [], configs = {}, nbCandidatures = 0, onOpenCandidatures, onChange, onConfig, unitesListe = [] }) {
  const [onglet, setOnglet] = useState("effectif");
  const [msg, setMsg] = useState({ ton: "ok", texte: "" });
  const [ouvert, setOuvert] = useState("");
  const [recherche, setRecherche] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [couleur, setCouleur] = useState(COULEURS_FONCTION[0]);
  const [occupe, setOccupe] = useState(false);
  const [uniteAdmin, setUniteAdmin] = useState(current.unite || "");
  const unite = current.isAdmin ? uniteAdmin : current.unite;
  const autorise = !!current.isAdmin || !!roleUnite(current);
  const cfg = configUnite(configs, unite);
  const equipe = personnel.filter((p) => p.unite === unite).sort((a, b) => (b.gradeRank ?? 0) - (a.gradeRank ?? 0));
  const avatars = useAvatars(equipe.map((p) => p.robloxId).filter(Boolean));
  if (!autorise) return <NeoAlerte ton="attention" icone="🔒">Cet espace est réservé au commandant d'unité et à son adjoint.</NeoAlerte>;
  if (!unite) return <NeoAlerte ton="attention" icone="ℹ️">Aucune unité n'est rattachée à ton compte. Un admin doit te l'affecter.</NeoAlerte>;

  const dit = (texte, ton = "ok") => setMsg({ texte, ton });
  const nbOp = equipe.filter((p) => p.operateurUnite).length;
  const q = recherche.trim().toLowerCase();
  const liste = equipe.filter((p) => !q || `${nomDe(p)} ${p.matricule || ""}`.toLowerCase().includes(q));

  async function majConfig(patch) {
    await setDoc(doc(db, "unites_config", idConfigUnite(unite)), { nom: unite, ...patch }, { merge: true });
    onConfig && onConfig(unite, { nom: unite, ...patch });
  }
  async function basculerOperateur(p) {
    try {
      await updateDoc(doc(db, "personnel", p.id), { operateurUnite: !p.operateurUnite });
      onChange && onChange(p.id, { operateurUnite: !p.operateurUnite });
      dit(`${nomDe(p)} ${p.operateurUnite ? "n'est plus" : "est maintenant"} opérateur de l'unité.`);
    } catch (e) { console.error(e); dit("Échec : les règles Firestore des unités sont-elles publiées ?", "danger"); }
  }
  async function basculerFonction(p, f) {
    const a = Array.isArray(p.fonctionsUnite) ? p.fonctionsUnite : [];
    const a_deja = a.includes(f.id);
    const suite = a_deja ? a.filter((x) => x !== f.id) : [...a, f.id];
    try {
      await updateDoc(doc(db, "personnel", p.id), { fonctionsUnite: suite });
      onChange && onChange(p.id, { fonctionsUnite: suite });
      let texte = `${nomDe(p)} ${a_deja ? "n'a plus" : "a maintenant"} la fonction « ${f.nom} ».`;
      if (cfg.rolesFonctions[f.id]) {
        const j = await appelRolesDiscord("fonction-unite", { uid: p.id, ...(a_deja ? { retirer: [f.id] } : { ajouter: [f.id] }) });
        texte += j && j.message ? ` Discord : ${j.message}` : "";
        dit(texte, j && j.ok === false ? "attention" : "ok");
      } else dit(texte);
    } catch (e) { console.error(e); dit("Échec : les règles Firestore des unités sont-elles publiées ?", "danger"); }
  }
  async function ajouterFonction() {
    const nom = nouveau.trim().slice(0, 40);
    if (!nom) return;
    if (cfg.fonctions.some((f) => f.nom.toLowerCase() === nom.toLowerCase())) { dit("Cette fonction existe déjà dans ton unité.", "attention"); return; }
    if (cfg.fonctions.length >= 20) { dit("20 fonctions maximum par unité.", "attention"); return; }
    setOccupe(true);
    try {
      await majConfig({ fonctions: [...cfg.fonctions, { id: "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nom, couleur }] });
      setNouveau(""); dit(`Fonction « ${nom} » créée.`);
    } catch (e) { console.error(e); dit("Échec : les règles Firestore des unités sont-elles publiées ?", "danger"); }
    setOccupe(false);
  }
  async function retirerFonction(f) {
    const porteurs = equipe.filter((p) => (p.fonctionsUnite || []).includes(f.id));
    if (!window.confirm(`Supprimer la fonction « ${f.nom} » ?${porteurs.length ? ` Elle sera retirée à ${porteurs.length} gendarme(s).` : ""}`)) return;
    setOccupe(true);
    try {
      for (const p of porteurs) {
        const suite = p.fonctionsUnite.filter((x) => x !== f.id);
        await updateDoc(doc(db, "personnel", p.id), { fonctionsUnite: suite });
        onChange && onChange(p.id, { fonctionsUnite: suite });
      }
      if (cfg.rolesFonctions[f.id] && porteurs.length) await appelRolesDiscord("fonction-unite", { uids: porteurs.map((p) => p.id), retirer: [f.id] });
      await majConfig({ fonctions: cfg.fonctions.filter((x) => x.id !== f.id) });
      dit(`Fonction « ${f.nom} » supprimée.`);
    } catch (e) { console.error(e); dit("Échec de la suppression.", "danger"); }
    setOccupe(false);
  }

  return (
    <div style={{ maxWidth: 940 }}>
      <NeoBandeau
        surtitre={(roleUnite(current) ? roleUnite(current).label : "Administration")}
        titre={unite}
        texte="Ton unité est indépendante : tu gères ses gendarmes, ses fonctions et ses candidatures."
        droite={[<NeoCompteur key="a" n={equipe.length} label="Gendarmes" />, <NeoCompteur key="b" n={cfg.fonctions.length} label="Fonctions" couleur="#C2571A" />, <NeoCompteur key="c" n={nbCandidatures} label="Candidatures" couleur="#F0B048" onClick={nbCandidatures ? onOpenCandidatures : undefined} />]}
      />
      {current.isAdmin && unitesListe.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={NEO_LAB}>Unité affichée (admin)</label>
          <select style={{ ...NEO_INP, maxWidth: 360 }} value={uniteAdmin} onChange={(e) => setUniteAdmin(e.target.value)}>{unitesListe.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        </div>
      )}
      {msg.texte && <NeoAlerte ton={msg.ton} icone={msg.ton === "ok" ? "✅" : "⚠️"}>{msg.texte}</NeoAlerte>}
      <NeoOnglets actif={onglet} onChange={setOnglet} onglets={[{ id: "effectif", label: "Effectif", n: equipe.length }, { id: "fonctions", label: "Fonctions de l'unité", n: cfg.fonctions.length }, { id: "candidatures", label: "Candidatures", n: nbCandidatures, couleur: "#F0B048" }]} />

      {onglet === "effectif" && (
        <NeoCarte titre={`Gendarmes de ${unite}`} droite={<span style={{ fontSize: 12, color: N.gris }}>{nbOp} opérateur{nbOp > 1 ? "s" : ""}</span>}>
          <input style={{ ...NEO_INP, marginBottom: 8 }} placeholder="Rechercher un gendarme…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          {!equipe.length && <div style={{ color: "#7A8CA8", padding: "10px 0" }}>Aucun gendarme dans cette unité.</div>}
          {liste.map((p) => {
            const fs = fonctionsDe(p, cfg);
            const ouv = ouvert === p.id;
            return (
              <div key={p.id} style={{ borderBottom: "1px solid #EEF2F8", padding: "10px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <Avatar src={avatars[p.robloxId]} taille={40} />
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <div style={{ fontWeight: 800, color: N.encre }}>{nomDe(p)}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 3 }}>
                      {roleUnite(p) && <span style={{ ...PUCE(roleUnite(p).couleur, true), cursor: "default" }}>{roleUnite(p).label}</span>}
                      {p.operateurUnite && <span style={{ ...PUCE("#2E7D4F", true), cursor: "default" }}>Opérateur</span>}
                      {fs.map((f) => <span key={f.id} style={{ ...PUCE(f.couleur || N.accent, true), cursor: "default" }}>{f.nom}</span>)}
                      {!roleUnite(p) && !p.operateurUnite && !fs.length && <span style={{ fontSize: 12, color: "#7A8CA8" }}>Gendarme</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => setOuvert(ouv ? "" : p.id)} style={BTN}>{ouv ? "Fermer" : "Gérer les rôles"}</button>
                </div>
                {ouv && (
                  <div style={{ background: "#F3F7FD", border: "1px solid #D3DDEA", borderRadius: 12, padding: 12, marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: N.gris, marginBottom: 8 }}>Clique pour donner ou retirer.</div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => basculerOperateur(p)} disabled={p.id === current.id && !current.isAdmin} style={PUCE("#2E7D4F", !!p.operateurUnite)}>{p.operateurUnite ? "✓ " : "+ "}Opérateur</button>
                      {cfg.fonctions.map((f) => { const on = (p.fonctionsUnite || []).includes(f.id); return <button key={f.id} type="button" onClick={() => basculerFonction(p, f)} style={PUCE(f.couleur || N.accent, on)}>{on ? "✓ " : "+ "}{f.nom}{cfg.rolesFonctions[f.id] ? " 🎭" : ""}</button>; })}
                    </div>
                    {!cfg.fonctions.length && <div style={{ fontSize: 12.5, color: N.gris, marginTop: 8 }}>Tu n'as pas encore créé de fonction : va dans l'onglet « Fonctions de l'unité ».</div>}
                  </div>
                )}
              </div>
            );
          })}
        </NeoCarte>
      )}

      {onglet === "fonctions" && (
        <>
          <NeoCarte titre="Créer une fonction">
            <div style={{ fontSize: 13, color: N.gris, lineHeight: 1.5, marginBottom: 6 }}>Les fonctions n'existent que dans ton unité (ex. « Chef de patrouille », « Instructeur », « Référent radio »). Tu les donnes ensuite aux gendarmes de ton unité.</div>
            <label style={NEO_LAB}>Nom de la fonction</label>
            <input style={NEO_INP} maxLength={40} value={nouveau} onChange={(e) => setNouveau(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ajouterFonction(); }} placeholder="Ex. Chef de patrouille" />
            <label style={NEO_LAB}>Couleur</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {COULEURS_FONCTION.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setCouleur(c)} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: couleur === c ? "3px solid #14213A" : "3px solid #fff", boxShadow: "0 0 0 1px #C3D0E2", cursor: "pointer" }} />)}
            </div>
            <NeoBouton disabled={occupe || !nouveau.trim()} onClick={ajouterFonction}>➕ Créer la fonction</NeoBouton>
          </NeoCarte>
          <NeoCarte titre={`Fonctions de ${unite}`}>
            {!cfg.fonctions.length && <div style={{ color: "#7A8CA8" }}>Aucune fonction pour l'instant.</div>}
            {cfg.fonctions.map((f) => {
              const n = equipe.filter((p) => (p.fonctionsUnite || []).includes(f.id)).length;
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #EEF2F8", flexWrap: "wrap" }}>
                  <span style={{ ...PUCE(f.couleur || N.accent, true), cursor: "default" }}>{f.nom}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: N.gris }}>{n} gendarme{n > 1 ? "s" : ""}{cfg.rolesFonctions[f.id] ? " · 🎭 rôle Discord lié automatiquement" : ""}</span>
                  <button type="button" disabled={occupe} onClick={() => retirerFonction(f)} style={{ ...BTN, borderColor: "#C0172D", color: "#C0172D" }}>Supprimer</button>
                </div>
              );
            })}
            <div style={{ fontSize: 12, color: "#7A8CA8", marginTop: 10 }}>Le rôle Discord associé à une fonction (🎭) est réglé par les admins.</div>
          </NeoCarte>
        </>
      )}

      {onglet === "candidatures" && (
        <NeoCarte titre="Candidatures de l'unité">
          <div style={{ fontSize: 14, color: N.encre, lineHeight: 1.55, marginBottom: 12 }}>
            {nbCandidatures ? <><b>{nbCandidatures}</b> candidature{nbCandidatures > 1 ? "s" : ""} en attente de ta décision.</> : "Aucune candidature en attente."}
          </div>
          <NeoBouton onClick={onOpenCandidatures}>📨 Ouvrir les candidatures</NeoBouton>
          <div style={{ marginTop: 14 }}>
            <NeoAlerte ton="info" icone="🎭">
              {cfg.rolesDiscord.length
                ? <>Quand tu <b>acceptes</b> une candidature de ton unité, <b>{cfg.rolesDiscord.length} rôle{cfg.rolesDiscord.length > 1 ? "s" : ""} Discord</b> {cfg.rolesDiscord.length > 1 ? "sont donnés" : "est donné"} automatiquement au gendarme à la publication de la réponse.</>
                : <>Aucun rôle Discord automatique n'est réglé pour ton unité. Demande à un admin de les choisir (page « Unités »).</>}
            </NeoAlerte>
          </div>
        </NeoCarte>
      )}
    </div>
  );
}

// ───────────────────────── Administration des unités (admins) ─────────────────────────
export function UnitesAdminPage({ personnel = [], configs = {}, unitesListe = [], onConfig, onPersonnel }) {
  const [roles, setRoles] = useState(null);
  const [erreurRoles, setErreurRoles] = useState("");
  const [msg, setMsg] = useState({ ton: "ok", texte: "" });
  const [ouverte, setOuverte] = useState("");
  const toutes = Array.from(new Set([...unitesListe, ...personnel.map((p) => p.unite).filter(Boolean)])).sort();

  useEffect(() => {
    let vivant = true;
    appelRolesDiscord("roles").then((j) => { if (!vivant) return; if (j && j.ok) setRoles(j.roles); else setErreurRoles((j && j.message) || "Impossible de lire les rôles du serveur Discord."); });
    return () => { vivant = false; };
  }, []);

  async function nommer(unite, code, id) {
    const membres = personnel.filter((p) => p.unite === unite);
    try {
      for (const p of membres) if (p.roleUnite === code && p.id !== id) { await updateDoc(doc(db, "personnel", p.id), { roleUnite: "" }); onPersonnel && onPersonnel(p.id, { roleUnite: "" }); }
      if (id) { await updateDoc(doc(db, "personnel", id), { roleUnite: code }); onPersonnel && onPersonnel(id, { roleUnite: code }); }
      setMsg({ ton: "ok", texte: id ? "Nomination enregistrée." : "Poste libéré." });
    } catch (e) { console.error(e); setMsg({ ton: "danger", texte: "Échec de la nomination." }); }
  }
  async function enregistrer(unite, patch) {
    try {
      await setDoc(doc(db, "unites_config", idConfigUnite(unite)), { nom: unite, ...patch }, { merge: true });
      onConfig && onConfig(unite, { nom: unite, ...patch });
      setMsg({ ton: "ok", texte: `Réglages de « ${unite} » enregistrés.` });
    } catch (e) { console.error(e); setMsg({ ton: "danger", texte: "Échec de l'enregistrement (règles Firestore publiées ?)." }); }
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <NeoBandeau surtitre="Administration" titre="Unités & commandants" texte="Nomme le commandant et l'adjoint de chaque unité, et choisis les rôles Discord donnés automatiquement quand une candidature de l'unité est acceptée." />
      {msg.texte && <NeoAlerte ton={msg.ton} icone={msg.ton === "ok" ? "✅" : "⚠️"}>{msg.texte}</NeoAlerte>}
      {erreurRoles && <NeoAlerte ton="attention" icone="🎭">{erreurRoles} (Tu peux quand même nommer les commandants.)</NeoAlerte>}
      {toutes.map((u) => (
        <CarteUnite key={u} unite={u} personnel={personnel} cfg={configUnite(configs, u)} roles={roles} ouverte={ouverte === u} onToggle={() => setOuverte(ouverte === u ? "" : u)} onNommer={nommer} onEnregistrer={enregistrer} />
      ))}
      <div style={{ fontSize: 12, color: "#7A8CA8", lineHeight: 1.5 }}>Le rôle du bot doit être placé AU-DESSUS de ces rôles dans Discord (Paramètres du serveur → Rôles), sinon Discord les refuse.</div>
    </div>
  );
}

function CarteUnite({ unite, personnel, cfg, roles, ouverte, onToggle, onNommer, onEnregistrer }) {
  const membres = personnel.filter((p) => p.unite === unite).sort((a, b) => (b.gradeRank ?? 0) - (a.gradeRank ?? 0));
  const cdt = membres.find((p) => p.roleUnite === "Commandant");
  const adj = membres.find((p) => p.roleUnite === "Adjoint");
  const [auto, setAuto] = useState(cfg.rolesDiscord);
  const [parFonction, setParFonction] = useState(cfg.rolesFonctions);
  useEffect(() => { setAuto(cfg.rolesDiscord); setParFonction(cfg.rolesFonctions); }, [JSON.stringify(cfg.rolesDiscord), JSON.stringify(cfg.rolesFonctions)]); // eslint-disable-line react-hooks/exhaustive-deps
  const bascule = (id) => setAuto((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const nomRole = (id) => ((roles || []).find((r) => r.id === id) || {}).name || id;
  const select = (code, actuel) => (
    <select style={NEO_INP} value={actuel ? actuel.id : ""} onChange={(e) => onNommer(unite, code, e.target.value)}>
      <option value="">— Aucun —</option>
      {membres.map((p) => <option key={p.id} value={p.id}>{nomDe(p)}</option>)}
    </select>
  );
  return (
    <NeoCarte
      titre={unite}
      droite={<button type="button" onClick={onToggle} style={BTN}>{ouverte ? "Réduire" : "Régler"}</button>}
      style={{ borderLeft: `6px solid ${cdt ? "#2E7D4F" : "#E0A02B"}` }}
    >
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: N.gris }}>
        <span>👥 {membres.length} gendarme{membres.length > 1 ? "s" : ""}</span>
        <span>🎖️ Commandant : <b style={{ color: cdt ? N.encre : "#B3261E" }}>{cdt ? nomDe(cdt) : "non nommé"}</b></span>
        <span>Adjoint : <b style={{ color: adj ? N.encre : "#7A8CA8" }}>{adj ? nomDe(adj) : "—"}</b></span>
        <span>🎭 {cfg.rolesDiscord.length} rôle{cfg.rolesDiscord.length > 1 ? "s" : ""} à l'acceptation</span>
        <span>🧩 {cfg.fonctions.length} fonction{cfg.fonctions.length > 1 ? "s" : ""}</span>
      </div>
      {ouverte && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <div><label style={NEO_LAB}>Commandant d'unité</label>{select("Commandant", cdt)}</div>
            <div><label style={NEO_LAB}>Adjoint au commandant</label>{select("Adjoint", adj)}</div>
          </div>
          <label style={NEO_LAB}>🎭 Rôles Discord donnés à l'acceptation d'une candidature de cette unité</label>
          {!roles && <div style={{ fontSize: 12.5, color: N.gris }}>{"Chargement des rôles du serveur…"}</div>}
          {roles && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {roles.map((r) => <button key={r.id} type="button" onClick={() => bascule(r.id)} style={PUCE("#2E7D4F", auto.includes(r.id))}>{auto.includes(r.id) ? "✓ " : ""}{r.name}</button>)}
            </div>
          )}
          {auto.filter((id) => !(roles || []).some((r) => r.id === id)).length > 0 && roles && <div style={{ fontSize: 12, color: "#B3261E", marginTop: 6 }}>Rôle(s) introuvable(s) sur le serveur : {auto.filter((id) => !roles.some((r) => r.id === id)).join(", ")}</div>}
          {cfg.fonctions.length > 0 && (
            <>
              <label style={NEO_LAB}>🧩 Rôle Discord lié à chaque fonction de l'unité (facultatif)</label>
              {cfg.fonctions.map((f) => (
                <div key={f.id} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ ...PUCE(f.couleur || N.accent, true), cursor: "default", minWidth: 110, justifyContent: "center" }}>{f.nom}</span>
                  <select style={{ ...NEO_INP, flex: 1, minWidth: 200 }} value={parFonction[f.id] || ""} onChange={(e) => setParFonction((m) => { const n = { ...m }; if (e.target.value) n[f.id] = e.target.value; else delete n[f.id]; return n; })} disabled={!roles}>
                    <option value="">— Aucun rôle Discord —</option>
                    {(roles || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              ))}
            </>
          )}
          <div style={{ marginTop: 14 }}>
            <NeoBouton disabled={!roles} onClick={() => onEnregistrer(unite, { rolesDiscord: auto, rolesFonctions: parFonction })}>💾 Enregistrer les rôles Discord</NeoBouton>
            {auto.length > 0 && <span style={{ marginLeft: 12, fontSize: 12.5, color: N.gris }}>{auto.map(nomRole).join(", ")}</span>}
          </div>
        </div>
      )}
    </NeoCarte>
  );
}
