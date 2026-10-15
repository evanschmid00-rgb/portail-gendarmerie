// pages/dossiers.jsx — Onglet « Dossiers » : un dossier par personne (compte Roblox) avec son casier judiciaire,
// ses PV et ses plaintes. Réservé aux OPJ et aux admins. Les données viennent des collections « casier » et « dossier_pieces ».
import React, { useState } from "react";
import { Avatar, useAvatars } from "../composants/Avatar.jsx";
import { Field, h2Style, selectStyle } from "../composants/ui.jsx";
import { memePersonne } from "../lib/dossierPersonne.js";
import { BadgeNiveau, CarteMention, CartePiece, PuceCasier, cleDateMention, niveauCasier, resumeCasier } from "./casier.jsx";

const bas = (s) => String(s || "").toLowerCase();

export function DossiersPage({ current, casier = [], pieces = [], onDeletePiece }) {
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [tri, setTri] = useState("recent");
  const [ouverts, setOuverts] = useState({});

  const estOPJ = !!current.isAdmin || (current.qualifications || []).includes("OPJ");

  // Un dossier = une personne : casier (mentions) + pièces (PV, plaintes) rattachées par compte Roblox
  const personnes = casier
    .filter((d) => (d.mentions || []).length > 0)
    .map((d) => ({ d: { ...d, mentions: d.mentions || [] }, ps: [] }));
  pieces.forEach((pc) => {
    let e = personnes.find((x) => memePersonne(x.d, pc));
    if (!e) {
      e = {
        d: { id: "p:" + (pc.robloxId || bas(pc.robloxUsername)), pseudoRoblox: pc.pseudoRoblox, robloxUsername: pc.robloxUsername, robloxId: pc.robloxId, nom: pc.nom, prenom: pc.prenom, mentions: [] },
        ps: [],
      };
      personnes.push(e);
    }
    e.ps.push(pc);
  });

  const avatars = useAvatars(personnes.map(({ d }) => d.robloxId));

  if (!estOPJ) {
    return (
      <div>
        <h2 style={h2Style}>Dossiers</h2>
        <div style={{ color: "#5A6B84", fontSize: 13 }}>Cet onglet est réservé aux OPJ.</div>
      </div>
    );
  }

  const q = bas(search.trim()).replace(/^@/, "");
  const nbPV = (ps) => ps.filter((p) => p.type === "PV").length;
  const nbPlaintes = (ps) => ps.filter((p) => p.type === "Plainte").length;

  const dossiers = personnes
    .filter(({ d, ps }) => {
      const texte = bas(`${d.pseudoRoblox || ""} ${d.robloxUsername || ""} ${d.nom || ""} ${d.prenom || ""}`);
      const okRecherche = !q || texte.includes(q) || ps.some((pc) => bas(pc.ref).includes(q));
      const okFiltre =
        filtre === "tous" ? true
        : filtre === "casier" ? d.mentions.length > 0
        : filtre === "pv" ? nbPV(ps) > 0
        : filtre === "plaintes" ? nbPlaintes(ps) > 0
        : true;
      return okRecherche && okFiltre;
    })
    .map(({ d, ps }) => ({
      d, ps, r: resumeCasier(d.mentions),
      derniere: [...d.mentions.map((m) => String(m.createdAt || "")), ...ps.map((pc) => String(pc.createdAt || ""))].reduce((mx, x) => (x > mx ? x : mx), ""),
    }))
    .sort((a, b) =>
      tri === "nom" ? String(a.d.pseudoRoblox || "").localeCompare(String(b.d.pseudoRoblox || ""))
      : tri === "pieces" ? b.ps.length - a.ps.length
      : tri === "mentions" ? b.r.n - a.r.n
      : b.derniere.localeCompare(a.derniere));

  const tuile = (l, v, c) => (
    <div style={{ background: "#fff", border: "1px solid #D3DDEA", borderTop: `4px solid ${c}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: "#5A6B84", fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  );

  return (
    <div>
      <h2 style={h2Style}>Dossiers</h2>
      <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 16 }}>
        Un dossier par personne (compte Roblox) : casier judiciaire, PV et plaintes. Réservé aux OPJ — le public n'y a jamais accès.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
        {tuile("Dossiers", personnes.length, "#123A7A")}
        {tuile("Avec casier", personnes.filter(({ d }) => d.mentions.length > 0).length, "#C0172D")}
        {tuile("PV rattachés", pieces.filter((p) => p.type === "PV").length, "#123A7A")}
        {tuile("Plaintes rattachées", pieces.filter((p) => p.type === "Plainte").length, "#B25E00")}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
        <div style={{ flex: "1 1 240px", maxWidth: 340 }}>
          <Field label="Rechercher un dossier" value={search} onChange={setSearch} placeholder="Pseudo, @, nom ou n° de PV" />
        </div>
        <select value={filtre} onChange={(e) => setFiltre(e.target.value)} style={{ ...selectStyle, width: "auto", marginBottom: 12 }}>
          <option value="tous">Tous les dossiers</option>
          <option value="casier">Avec casier judiciaire</option>
          <option value="pv">Avec PV</option>
          <option value="plaintes">Avec plainte</option>
        </select>
        <select value={tri} onChange={(e) => setTri(e.target.value)} style={{ ...selectStyle, width: "auto", marginBottom: 12 }}>
          <option value="recent">Trier : dernière activité</option>
          <option value="mentions">Trier : nombre de mentions</option>
          <option value="pieces">Trier : nombre de PV / plaintes</option>
          <option value="nom">Trier : pseudo</option>
        </select>
      </div>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", margin: "6px 0 8px", fontWeight: 700 }}>
        Résultats ({dossiers.length})
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {dossiers.length === 0 && <div style={{ color: "#5A6B84", fontSize: 13 }}>Aucun dossier trouvé.</div>}
        {dossiers.map(({ d: dossier, ps, r }) => {
          const ouvert = !!ouverts[dossier.id];
          const nv = niveauCasier(r.n);
          const mentions = dossier.mentions.slice().sort((a, b) => cleDateMention(b).localeCompare(cleDateMention(a)));
          const pvs = ps.filter((p) => p.type === "PV");
          const plaintes = ps.filter((p) => p.type === "Plainte");
          const trier = (liste) => liste.slice().sort((a, b) => String(b.dateFaits || b.createdAt).localeCompare(String(a.dateFaits || a.createdAt)));
          const titreSection = (t) => (
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, margin: "6px 0 8px" }}>{t}</div>
          );
          return (
            <div key={dossier.id} style={{ background: "#fff", border: "1px solid #D3DDEA", borderLeft: `5px solid ${nv.couleur}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)" }}>
              <div onClick={() => setOuverts({ ...ouverts, [dossier.id]: !ouvert })} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", cursor: "pointer", flexWrap: "wrap" }}>
                {dossier.robloxId
                  ? <Avatar src={avatars[dossier.robloxId]} taille={48} />
                  : <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E6EDF7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#123A7A" }}>{String(dossier.pseudoRoblox || "?").charAt(0).toUpperCase()}</div>}
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                    {dossier.pseudoRoblox}
                    {dossier.robloxUsername && <span style={{ fontWeight: 400, fontSize: 12.5, color: "#5A6B84" }}> · @{dossier.robloxUsername}</span>}
                  </div>
                  {(dossier.nom || dossier.prenom) && <div style={{ fontSize: 12, color: "#5A6B84" }}>{dossier.prenom} {dossier.nom}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    <PuceCasier couleur="#8A1020" fond="#F8DADF">{r.n} mention{r.n > 1 ? "s" : ""}</PuceCasier>
                    {pvs.length > 0 && <PuceCasier couleur="#123A7A" fond="#E6EDF7">📁 {pvs.length} PV</PuceCasier>}
                    {plaintes.length > 0 && <PuceCasier couleur="#B25E00" fond="#FFF1E0">📝 {plaintes.length} plainte{plaintes.length > 1 ? "s" : ""}</PuceCasier>}
                    {r.amendes > 0 && <PuceCasier couleur="#8A5A00" fond="#FFF6E0">💶 {r.amendes} au total</PuceCasier>}
                    {r.gav > 0 && <PuceCasier>⏱ {r.gav} GAV</PuceCasier>}
                  </div>
                </div>
                <BadgeNiveau n={r.n} />
                <span style={{ fontSize: 13, color: "#5A6B84" }}>{ouvert ? "▲" : "▼"}</span>
              </div>

              {ouvert && (
                <div style={{ padding: "6px 16px 10px", borderTop: "1px solid #E3EAF4", background: "#F9FBFE" }}>
                  {titreSection(`Casier judiciaire (${mentions.length})`)}
                  {mentions.length === 0 && <div style={{ fontSize: 12.5, color: "#5A6B84", marginBottom: 10 }}>Aucune mention au casier judiciaire.</div>}
                  {mentions.map((m, i) => <CarteMention key={m.id} m={m} interne dernier={i === mentions.length - 1} />)}

                  {pvs.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 10, borderTop: "1px dashed #C3D0E2" }}>
                      {titreSection(`Procès-verbaux (${pvs.length})`)}
                      {trier(pvs).map((pc) => (
                        <CartePiece key={pc.id} p={pc} lieeAMention={dossier.mentions.some((m) => m.pvRef && m.pvRef === pc.ref)} canModify={estOPJ} onDelete={onDeletePiece} />
                      ))}
                    </div>
                  )}

                  {plaintes.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 10, borderTop: "1px dashed #C3D0E2" }}>
                      {titreSection(`Plaintes (${plaintes.length})`)}
                      {trier(plaintes).map((pc) => (
                        <CartePiece key={pc.id} p={pc} lieeAMention={false} canModify={estOPJ} onDelete={onDeletePiece} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
