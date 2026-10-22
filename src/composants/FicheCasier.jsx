// composants/FicheCasier.jsx — extrait de casier judiciaire (document officiel) : bulletin n°3 (civil) ou n°1 (usage judiciaire)
import React from "react";
import { Avatar } from "./Avatar.jsx";
import { CachetJustice } from "./CachetJustice.jsx";

const SERIF = "'Georgia', 'Times New Roman', serif";
const SANS = "'Inter', 'Segoe UI', system-ui, sans-serif";
const nombreDe = (s) => { const m = String(s || "").replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/); return m ? Number(m[1].replace(",", ".")) : 0; };
const jourLong = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const dateMention = (s) => { if (!s) return "—"; const d = new Date(`${s}T12:00:00`); return isNaN(d) ? s : d.toLocaleDateString("fr-FR"); };
const COULEUR_GRAVITE = { Contravention: "#2E7D4F", "Délit": "#C77700", Crime: "#C0172D" };
const cleDate = (m) => String(m.dateFaits || m.createdAt || "");

function Ligne({ k, v }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.6 }}>
      <span style={{ width: 150, flexShrink: 0, color: "#4A5568", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: SANS, fontWeight: 700, paddingTop: 2 }}>{k}</span>
      <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{v}</span>
    </div>
  );
}

export function FicheCasier({ personne, avatar, mentions = [], bulletin = "3", pieces = 0, actions }) {
  const interne = bulletin === "1";
  const liste = mentions.slice().sort((a, b) => cleDate(a).localeCompare(cleDate(b)));
  const maintenant = new Date();
  const total = liste.reduce((s, m) => s + nombreDe(m.amende), 0);
  const gav = liste.filter((m) => m.tempsGav).length;
  const graves = liste.filter((m) => m.gravite === "Délit" || m.gravite === "Crime").length;
  const stamp = `${maintenant.getFullYear()}${String(maintenant.getMonth() + 1).padStart(2, "0")}${String(maintenant.getDate()).padStart(2, "0")}`;
  const numero = `CJ-B${bulletin}-${stamp}-${String(personne.robloxId || personne.username || "0").replace(/\D/g, "").slice(-5).padStart(5, "0")}`;
  const nomComplet = [personne.prenom, personne.nom].filter(Boolean).join(" ");
  return (
    <div style={{ position: "relative", background: "#fff", border: "1px solid #C9CFD9", borderRadius: 4, padding: 8, boxShadow: "0 12px 30px -16px rgba(15,25,45,0.45)", fontFamily: SERIF, color: "#111827", overflow: "hidden" }}>
      <div style={{ border: `1.5px solid ${interne ? "#8A1020" : "#123A7A"}`, padding: "22px 26px 20px", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", opacity: 0.06 }}><CachetJustice taille={320} /></div>

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ display: "inline-block", height: 5, width: 78, background: "linear-gradient(90deg,#123A7A 33%,#fff 33% 66%,#C0172D 66%)", outline: "1px solid #C9CFD9", marginBottom: 6 }} />
              <div style={{ fontSize: 12, letterSpacing: 3, fontWeight: 700 }}>RÉPUBLIQUE FRANÇAISE</div>
              <div style={{ fontSize: 10.5, fontStyle: "italic", color: "#4A5568" }}>Liberté · Égalité · Fraternité</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11.5, color: "#374151", lineHeight: 1.45 }}>
              <b style={{ fontSize: 12.5 }}>MINISTÈRE DE LA JUSTICE</b><br />Service du casier judiciaire<br />Tribunal judiciaire de Nîmes
            </div>
          </div>

          <div style={{ borderTop: "3px double #111827", borderBottom: "3px double #111827", padding: "11px 0", textAlign: "center", margin: "0 0 16px" }}>
            <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: 3 }}>EXTRAIT DU CASIER JUDICIAIRE</div>
            <div style={{ fontSize: 12, marginTop: 4, letterSpacing: 1 }}>BULLETIN N° {bulletin}{interne ? " — USAGE JUDICIAIRE · CONFIDENTIEL" : ""}</div>
            <div style={{ fontSize: 11.5, marginTop: 3, fontFamily: "'Courier New', monospace", color: "#4A5568" }}>Réf. {numero}</div>
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center", border: "1px solid #D1D5DB", background: "#FAFAFB", borderRadius: 6, padding: "12px 14px", marginBottom: 16, flexWrap: "wrap" }}>
            <Avatar src={avatar} taille={76} />
            <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 2 }}>
              <Ligne k="Pseudo" v={<b style={{ fontSize: 16 }}>{personne.displayName}</b>} />
              {personne.username && <Ligne k="Identifiant" v={`@${personne.username}`} />}
              {nomComplet && <Ligne k="Identité RP" v={nomComplet} />}
              {personne.robloxId && <Ligne k="ID Roblox" v={<span style={{ fontFamily: "'Courier New', monospace" }}>{personne.robloxId}</span>} />}
            </div>
          </div>

          <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: "#4A5568", fontWeight: 700, fontFamily: SANS, marginBottom: 6 }}>Condamnations et mentions</div>
          {liste.length === 0 ? (
            <div style={{ border: "1.5px dashed #9CA3AF", borderRadius: 6, padding: "24px 16px", textAlign: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 6 }}>NÉANT</div>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>Ce bulletin ne comporte aucune condamnation ni mention.</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                <thead>
                  <tr style={{ background: "#F3F4F6", fontFamily: SANS, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "#374151" }}>
                    {["N°", "Date des faits", "Nature de l'infraction", "Qualification", "Peine"].map((h) => <th key={h} style={{ textAlign: "left", padding: "7px 8px", border: "1px solid #D1D5DB" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {liste.map((m, i) => (
                    <tr key={m.id || i} style={{ verticalAlign: "top" }}>
                      <td style={{ padding: "7px 8px", border: "1px solid #D1D5DB", fontFamily: "'Courier New', monospace", width: 36 }}>{i + 1}</td>
                      <td style={{ padding: "7px 8px", border: "1px solid #D1D5DB", whiteSpace: "nowrap" }}>{dateMention(m.dateFaits)}</td>
                      <td style={{ padding: "7px 8px", border: "1px solid #D1D5DB" }}>
                        <b>{m.nature}</b>
                        {interne && m.pvRef && <div style={{ fontSize: 11.5, color: "#123A7A", fontFamily: "'Courier New', monospace" }}>PV {m.pvRef}</div>}
                        {interne && m.remarques && <div style={{ fontSize: 12, color: "#4B5563", fontStyle: "italic", whiteSpace: "pre-wrap" }}>{m.remarques}</div>}
                        {interne && m.gendarmeNom && <div style={{ fontSize: 11, color: "#6B7280" }}>Agent : {m.gendarmeNom}{m.gendarmeMatricule ? ` (${m.gendarmeMatricule})` : ""}</div>}
                      </td>
                      <td style={{ padding: "7px 8px", border: "1px solid #D1D5DB", fontWeight: 700, color: COULEUR_GRAVITE[m.gravite] || "#4B5563", whiteSpace: "nowrap" }}>{m.gravite || "—"}</td>
                      <td style={{ padding: "7px 8px", border: "1px solid #D1D5DB" }}>
                        {m.amende ? <div>Amende : {m.amende}</div> : null}
                        {m.tempsGav ? <div>Garde à vue : {m.tempsGav}</div> : null}
                        {!m.amende && !m.tempsGav ? "—" : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {liste.length > 0 && (
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12.5, margin: "12px 0 0", fontFamily: SANS, color: "#374151" }}>
              <span><b>{liste.length}</b> mention{liste.length > 1 ? "s" : ""}</span>
              {graves > 0 && <span style={{ color: "#C0172D" }}><b>{graves}</b> délit(s) ou crime(s)</span>}
              {total > 0 && <span>Amendes cumulées : <b>{total}</b></span>}
              {gav > 0 && <span><b>{gav}</b> passage(s) en garde à vue</span>}
              {interne && pieces > 0 && <span><b>{pieces}</b> pièce(s) au dossier</span>}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              Extrait délivré à Nîmes,<br />le {jourLong(maintenant)}.
              <div style={{ fontSize: 10.5, color: "#6B7280", marginTop: 6, fontFamily: SANS, maxWidth: 300 }}>
                {interne ? "Document réservé aux autorités judiciaires et aux officiers de police judiciaire." : "Ce bulletin est délivré à l'intéressé. Document de jeu de rôle sans valeur officielle."}
              </div>
            </div>
            <div style={{ textAlign: "center", minWidth: 190 }}>
              <CachetJustice taille={92} style={{ margin: "0 auto", mixBlendMode: "multiply" }} />
              <div style={{ fontSize: 11, color: "#4A5568" }}>Le greffier en chef</div>
            </div>
          </div>
        </div>
      </div>
      {actions && <div style={{ padding: "10px 12px 4px", display: "flex", gap: 8, flexWrap: "wrap", fontFamily: SANS }}>{actions}</div>}
    </div>
  );
}
