// pages/cartes.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import cipcFond from "../cipc-fond.jpg";
import { buttonPrimary, h2Style, labelStyle, smallBtn } from "../composants/ui.jsx";

/* ---------- Carte de service ---------- */

/* ---------- CIPC : Carte d'Identité Professionnelle et de Circulation ---------- */

export function CartePro({ p, onLinked, lectureSeule }) {
  const [pseudo, setPseudo] = useState("");
  const [photo, setPhoto] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [modif, setModif] = useState(false);
  const lie = !!p.robloxVerifie && !!p.robloxId;

  useEffect(() => {
    let off = false;
    (async () => {
      if (!lie) { setPhoto(""); return; }
      try {
        const r = await fetch(`/api/roblox-head?id=${p.robloxId}`);
        const j = await r.json();
        if (!off && j.imageUrl) setPhoto(j.imageUrl);
      } catch (e) { /* la carte reste affichée sans photo */ }
    })();
    return () => { off = true; };
  }, [p.robloxId, lie]);

  async function appel(action) {
    const user = auth.currentUser;
    if (!user) throw new Error("non connecté");
    const idToken = await user.getIdToken();
    const r = await fetch("/api/roblox-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, action, pseudo: pseudo.trim() }) });
    return r.json();
  }
  async function demarrer() {
    if (!pseudo.trim()) { setMsg("Écris ton pseudo Roblox."); return; }
    setBusy(true); setMsg("");
    try {
      const j = await appel("start");
      if (j.ok) setCode(j.code); else setMsg(j.message || "Erreur, réessaie.");
    } catch (e) { setMsg("Erreur de connexion, réessaie."); }
    setBusy(false);
  }
  async function verifier() {
    setBusy(true); setMsg("");
    try {
      const j = await appel("verify");
      if (j.ok) {
        await onLinked({ pseudoRoblox: j.nom, robloxId: String(j.id), robloxVerifie: true });
        setCode(""); setModif(false); setPseudo(""); setMsg("Compte Roblox lié ✅");
      } else setMsg(j.message || "Vérification impossible, réessaie.");
    } catch (e) { setMsg("Erreur de connexion, réessaie."); }
    setBusy(false);
  }

  const nom = (p.nom || "").toUpperCase();
  const prenom = (p.prenom || "").toUpperCase();
  const num = p.cipcNumero || "";
  const qualite = p.qualiteJudiciaire || "APJA";
  const taille = (t) => Math.min(3.7, (3.7 * 15) / Math.max(t.length, 15)) + "cqw";
  const txt = { position: "absolute", fontFamily: "'Open Sans', 'Segoe UI', Arial, sans-serif", fontWeight: 800, color: "#0d0d0d", whiteSpace: "nowrap", transform: "translateY(-50%)", lineHeight: 1 };
  const inp = { flex: 1, minWidth: 180, padding: "9px 10px", border: "1px solid #C3D0E2", borderRadius: 6, fontSize: 14 };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ containerType: "inline-size", width: "100%" }}>
        <div style={{ position: "relative", aspectRatio: "1367 / 768", backgroundImage: `url(${cipcFond})`, backgroundSize: "100% 100%", borderRadius: 14, overflow: "hidden", boxShadow: "0 14px 34px -14px rgba(7,20,46,0.55)" }}>
          <div style={{ position: "absolute", left: "68.3%", top: "5.2%", width: "29.1%", height: "62.8%", boxSizing: "border-box", border: "0.55cqw solid #17275a", borderRadius: "0.9cqw", background: "linear-gradient(180deg, #3b3e45, #2a2d33)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {photo ? <img src={photo} alt="Photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#9aa0ab", fontSize: "1.8cqw", fontFamily: "Arial, sans-serif", textAlign: "center", padding: "0 6%" }}>{lie ? "Photo Roblox" : "Compte Roblox à lier"}</span>}
          </div>
          <div style={{ ...txt, left: "28.3%", top: "66.5%", fontSize: taille(nom) }}>{nom}</div>
          <div style={{ ...txt, left: "28.3%", top: "74%", fontSize: taille(prenom) }}>{prenom}</div>
          <div style={{ ...txt, left: "6.4%", top: "81.4%", fontSize: "4.2cqw" }}>{qualite}</div>
          <div style={{ ...txt, left: "28.3%", top: "81.6%", fontSize: "3.7cqw", letterSpacing: "0.02em" }}>{num || "—"}</div>
        </div>
      </div>

      {!lectureSeule && <div style={{ marginTop: 14, background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: 16 }}>
        {lie && !modif ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13 }}>Compte Roblox lié : <b>{p.pseudoRoblox}</b> ✅</div>
            <button type="button" style={smallBtn} onClick={() => { setModif(true); setMsg(""); setCode(""); }}>Changer de compte</button>
          </div>
        ) : !code ? (
          <>
            <label style={labelStyle}>Lier mon compte Roblox (la photo de ta carte sera la tête de ton personnage)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Ton pseudo Roblox" style={inp} />
              <button type="button" disabled={busy} onClick={demarrer} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>{busy ? "…" : "Lier mon compte"}</button>
              {lie && <button type="button" style={smallBtn} onClick={() => { setModif(false); setMsg(""); }}>Annuler</button>}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, marginBottom: 8 }}>Pour prouver que ce compte est bien le tien :</div>
            <ol style={{ fontSize: 13, margin: "0 0 10px 18px", padding: 0, lineHeight: 1.6 }}>
              <li>Copie ce code : <b style={{ fontFamily: "'Courier New', monospace", background: "#E9EFF7", padding: "2px 8px", borderRadius: 5, userSelect: "all" }}>{code}</b></li>
              <li>Sur Roblox, ouvre ton profil → <b>Modifier</b>, colle le code dans la description (« À propos ») et enregistre.</li>
              <li>Reviens ici et clique sur « J'ai mis le code ». Tu pourras l'enlever ensuite.</li>
            </ol>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" disabled={busy} onClick={verifier} className="gh-btn-anim" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", marginTop: 0 }}>{busy ? "Vérification…" : "J'ai mis le code"}</button>
              <button type="button" style={smallBtn} onClick={() => { setCode(""); setMsg(""); }}>Annuler</button>
            </div>
          </>
        )}
        {msg && <div style={{ fontSize: 12, color: msg.includes("✅") ? "#2E7D4F" : "#C0172D", marginTop: 8 }}>{msg}</div>}
        {!num && <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 8 }}>Ton RIO n'est pas encore attribué : demande à un administrateur de l'attribuer.</div>}
      </div>}
    </div>
  );
}

/* ---------- Cartes professionnelles de tous les agents ---------- */

export function CartesProPage({ personnel }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const liste = personnel
    .filter((p) => norm(`${p.prenom} ${p.nom} ${p.cipcNumero || ""} ${p.grade} ${p.unite}`).includes(norm(q)))
    .slice()
    .sort((a, b) => (b.gradeRank || 0) - (a.gradeRank || 0) || `${a.nom}${a.prenom}`.localeCompare(`${b.nom}${b.prenom}`));
  const choisi = personnel.find((p) => p.id === sel);

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={h2Style}>Cartes professionnelles</h2>
      {choisi && (
        <div style={{ marginBottom: 26 }}>
          <button style={{ ...smallBtn, marginBottom: 10 }} onClick={() => setSel(null)}>✕ Fermer la carte</button>
          <CartePro p={choisi} lectureSeule />
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un agent (nom, prénom, RIO, grade…)" style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", border: "1px solid #C3D0E2", borderRadius: 10, fontSize: 14, marginBottom: 14, background: "#fff" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 10 }}>
        {liste.map((p) => (
          <button key={p.id} onClick={() => { setSel(p.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="gh-btn-anim" style={{ textAlign: "left", background: sel === p.id ? "#E6EDF7" : "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "12px 14px", cursor: "pointer", boxShadow: "0 3px 12px -9px rgba(7,20,46,0.35)" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#14213A" }}>{p.prenom} {p.nom}</div>
            <div style={{ fontSize: 12, color: "#5A6B84", marginTop: 2 }}>{p.grade} — {p.unite}</div>
            <div style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontFamily: "'Courier New', monospace", background: "#E6EDF7", color: "#123A7A", padding: "2px 7px", borderRadius: 5, fontWeight: 700 }}>RIO {p.cipcNumero || "—"}</span>
              <span style={{ color: "#5A6B84", fontWeight: 600 }}>{p.qualiteJudiciaire || "APJA"}</span>
            </div>
          </button>
        ))}
        {liste.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun agent trouvé.</div>}
      </div>
    </div>
  );
}
