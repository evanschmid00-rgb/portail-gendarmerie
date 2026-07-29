import React, { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const personnelRef = doc(db, "gendarmerie", "personnel");

/* ---------- Données de référence ---------- */

const GRADES = [
  "Gendarme Adjoint Volontaire",
  "Gendarme",
  "Maréchal des Logis",
  "Maréchal des Logis-Chef",
  "Adjudant",
  "Adjudant-Chef",
  "Major",
  "Sous-Lieutenant",
  "Lieutenant",
  "Capitaine",
  "Commandant",
  "Lieutenant-Colonel",
  "Colonel",
];

const OFFICIER_INDEX = GRADES.indexOf("Sous-Lieutenant");

const UNITES = [
  "Brigade Territoriale",
  "ERI",
  "PSIG",
  "Section de Recherches",
  "UNPJ",
  "GIGN",
  "IGGN",
  "BMO",
  "DGGN",
];

const UNITE_ORDER = UNITES.reduce((acc, u, i) => ({ ...acc, [u]: i }), {});

function insignia(gradeName) {
  const idx = GRADES.indexOf(gradeName);
  if (idx < 0) return null;
  const isOfficier = idx >= OFFICIER_INDEX;
  const count = isOfficier ? idx - OFFICIER_INDEX + 1 : idx;
  if (count <= 0) return <span style={{ opacity: 0.5, fontSize: 11 }}>recrue</span>;
  const symbol = isOfficier ? "★" : "▲";
  return (
    <span style={{ letterSpacing: 2, color: "#B08D57", fontSize: 13 }}>
      {symbol.repeat(Math.min(count, 6))}
    </span>
  );
}

function nextMatricule(personnel) {
  const year = new Date().getFullYear();
  const n = personnel.length + 1;
  return `GH-${year}-${String(n).padStart(4, "0")}`;
}

/* ---------- Carte de service ---------- */

function CarteService({ p }) {
  return (
    <div
      style={{
        background: "#F5F2EA",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)",
        maxWidth: 420,
        fontFamily: "Georgia, 'Times New Roman', serif",
        border: "1px solid #D8D2C2",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0B1626, #16305C)",
          color: "#F5F2EA",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, opacity: 0.75, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>
            RÉPUBLIQUE FRANÇAISE — RP
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Carte de Service</div>
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "1.5px solid #B08D57",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: "#B08D57",
            fontFamily: "-apple-system, Segoe UI, sans-serif",
          }}
        >
          GN
        </div>
      </div>
      <div style={{ padding: "16px 18px", color: "#1A1F29" }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {p.prenom} {p.nom?.toUpperCase()}
        </div>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#5A4A32", marginTop: 2 }}>
          Matricule {p.matricule}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, fontFamily: "-apple-system, Segoe UI, sans-serif" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1, color: "#7A7362", textTransform: "uppercase" }}>Grade</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.grade}</div>
            <div style={{ marginTop: 2 }}>{insignia(p.grade)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1, color: "#7A7362", textTransform: "uppercase" }}>Unité</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.unite}</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 10, letterSpacing: 1, color: "#7A7362", textTransform: "uppercase" }}>Fonction</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.fonction || "—"}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          {p.opj && (
            <span style={{ fontSize: 10, fontFamily: "-apple-system, Segoe UI, sans-serif", background: "#16305C", color: "#F5F2EA", padding: "3px 8px", borderRadius: 20 }}>
              OPJ
            </span>
          )}
          {p.isAdmin && (
            <span style={{ fontSize: 10, fontFamily: "-apple-system, Segoe UI, sans-serif", background: "#B08D57", color: "#1A1F29", padding: "3px 8px", borderRadius: 20 }}>
              ADMINISTRATION
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Écran de connexion / configuration initiale ---------- */

function LoginScreen({ personnel, onLogin, onCreateFirstAdmin, loading }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [setupNom, setSetupNom] = useState("");
  const [setupPrenom, setSetupPrenom] = useState("");
  const [setupUser, setSetupUser] = useState("");
  const [setupPass, setSetupPass] = useState("");

  const isEmpty = !loading && personnel.length === 0;

  function handleLogin(e) {
    e.preventDefault();
    const found = personnel.find((p) => p.username === username.trim() && p.password === password);
    if (!found) {
      setError("Identifiants incorrects.");
      return;
    }
    setError("");
    onLogin(found);
  }

  function handleSetup(e) {
    e.preventDefault();
    if (!setupNom || !setupPrenom || !setupUser || !setupPass) return;
    onCreateFirstAdmin({
      nom: setupNom,
      prenom: setupPrenom,
      username: setupUser.trim(),
      password: setupPass,
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 20% 20%, #16305C, #0B1626 60%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "-apple-system, Segoe UI, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 24, color: "#F5F2EA" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6 }}>EMERGENCY HAMBOURG</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 700, marginTop: 4 }}>
            Portail Gendarmerie
          </div>
        </div>

        {loading ? (
          <div style={{ color: "#F5F2EA", textAlign: "center", opacity: 0.7 }}>Chargement…</div>
        ) : isEmpty ? (
          <form
            onSubmit={handleSetup}
            style={{ background: "#F5F2EA", borderRadius: 10, padding: 24, boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "#1A1F29" }}>
              Configuration initiale
            </div>
            <div style={{ fontSize: 12, color: "#5A4A32", marginBottom: 14 }}>
              Aucun compte n'existe encore. Crée le premier compte administrateur (Directeur Général).
            </div>
            <Field label="Prénom" value={setupPrenom} onChange={setSetupPrenom} />
            <Field label="Nom" value={setupNom} onChange={setSetupNom} />
            <Field label="Identifiant" value={setupUser} onChange={setSetupUser} />
            <Field label="Mot de passe" value={setupPass} onChange={setSetupPass} type="password" />
            <button type="submit" style={buttonPrimary}>
              Créer le compte administrateur
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleLogin}
            style={{ background: "#F5F2EA", borderRadius: 10, padding: 24, boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}
          >
            <Field label="Identifiant" value={username} onChange={setUsername} autoFocus />
            <Field label="Mot de passe" value={password} onChange={setPassword} type="password" />
            {error && <div style={{ color: "#9C2B2B", fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <button type="submit" style={buttonPrimary}>
              Se connecter
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", color: "#F5F2EA", opacity: 0.45, fontSize: 11, marginTop: 16 }}>
          Usage interne roleplay — données non chiffrées.
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", autoFocus }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 4 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "9px 10px",
          borderRadius: 6,
          border: "1px solid #D8D2C2",
          background: "#FFFFFF",
          fontSize: 14,
          boxSizing: "border-box",
          outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#16305C")}
        onBlur={(e) => (e.target.style.borderColor = "#D8D2C2")}
      />
    </div>
  );
}

const buttonPrimary = {
  width: "100%",
  padding: "10px 0",
  marginTop: 6,
  background: "#16305C",
  color: "#F5F2EA",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

/* ---------- Tableau de bord ---------- */

function Sidebar({ current, section, setSection, isAdmin, onLogout }) {
  const items = [
    { id: "dossier", label: "Mon dossier" },
    { id: "annuaire", label: "Annuaire" },
    ...(isAdmin ? [{ id: "admin", label: "Gestion du personnel" }] : []),
  ];
  return (
    <div style={{ width: 220, background: "#10233D", color: "#F5F2EA", padding: "20px 14px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Emergency Hambourg</div>
      <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 24 }}>Portail Gendarmerie</div>

      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => setSection(it.id)}
          style={{
            textAlign: "left",
            background: section === it.id ? "#16305C" : "transparent",
            color: "#F5F2EA",
            border: "none",
            borderRadius: 6,
            padding: "9px 10px",
            marginBottom: 4,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {it.label}
        </button>
      ))}

      <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
          {current.prenom} {current.nom}
        </div>
        <button
          onClick={onLogout}
          style={{ fontSize: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.25)", color: "#F5F2EA", padding: "6px 10px", borderRadius: 6, cursor: "pointer", width: "100%" }}
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}

function Annuaire({ personnel }) {
  const byUnite = {};
  personnel.forEach((p) => {
    byUnite[p.unite] = byUnite[p.unite] || [];
    byUnite[p.unite].push(p);
  });
  const unites = Object.keys(byUnite).sort((a, b) => (UNITE_ORDER[a] ?? 99) - (UNITE_ORDER[b] ?? 99));

  return (
    <div>
      <h2 style={h2Style}>Annuaire du personnel</h2>
      {unites.map((u) => (
        <div key={u} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>{u}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {byUnite[u]
              .sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade))
              .map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#fff",
                    border: "1px solid #E4E0D4",
                    borderRadius: 8,
                    padding: "10px 14px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {p.prenom} {p.nom}
                    </div>
                    <div style={{ fontSize: 12, color: "#7A7362" }}>
                      {p.grade}
                      {p.fonction ? ` — ${p.fonction}` : ""}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#7A7362" }}>{p.matricule}</div>
                </div>
              ))}
          </div>
        </div>
      ))}
      {unites.length === 0 && <div style={{ color: "#7A7362", fontSize: 13 }}>Aucun personnel enregistré.</div>}
    </div>
  );
}

const h2Style = { fontFamily: "Georgia, serif", fontSize: 20, marginBottom: 16, color: "#1A1F29" };

function AdminPanel({ personnel, onCreate, onDelete, onUpdate }) {
  const blank = { nom: "", prenom: "", username: "", password: "", grade: GRADES[1], unite: UNITES[0], fonction: "", opj: false, isAdmin: false };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  function submit(e) {
    e.preventDefault();
    if (!form.nom || !form.prenom || !form.username || !form.password) return;
    if (editingId) {
      onUpdate(editingId, form);
      setEditingId(null);
    } else {
      onCreate(form);
    }
    setForm(blank);
  }

  function startEdit(p) {
    setEditingId(p.id);
    setForm({ nom: p.nom, prenom: p.prenom, username: p.username, password: p.password, grade: p.grade, unite: p.unite, fonction: p.fonction || "", opj: !!p.opj, isAdmin: !!p.isAdmin });
  }

  return (
    <div>
      <h2 style={h2Style}>Gestion du personnel</h2>

      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E0D4", borderRadius: 10, padding: 18, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Modifier le compte" : "Créer un compte"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Prénom" value={form.prenom} onChange={(v) => setForm({ ...form, prenom: v })} />
          <Field label="Nom" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
          <Field label="Identifiant" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          <Field label="Mot de passe" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="text" />
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Grade</label>
            <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} style={selectStyle}>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Unité</label>
            <select value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} style={selectStyle}>
              {UNITES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <Field label="Fonction" value={form.fonction} onChange={(v) => setForm({ ...form, fonction: v })} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, paddingBottom: 10 }}>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={form.opj} onChange={(e) => setForm({ ...form, opj: e.target.checked })} />
              Qualification OPJ
            </label>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={form.isAdmin} onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })} />
              Administrateur
            </label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" style={{ ...buttonPrimary, width: "auto", padding: "9px 18px" }}>
            {editingId ? "Enregistrer" : "Créer le compte"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setForm(blank); }}
              style={{ ...buttonPrimary, width: "auto", padding: "9px 18px", background: "transparent", color: "#16305C", border: "1px solid #16305C" }}
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 8 }}>
        Registre ({personnel.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {personnel.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #E4E0D4", borderRadius: 8, padding: "10px 14px" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.prenom} {p.nom} <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#7A7362" }}>({p.matricule})</span></div>
              <div style={{ fontSize: 12, color: "#7A7362" }}>{p.grade} — {p.unite}{p.isAdmin ? " — Admin" : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => startEdit(p)} style={smallBtn}>Modifier</button>
              <button onClick={() => onDelete(p.id)} style={{ ...smallBtn, color: "#9C2B2B", borderColor: "#9C2B2B" }}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#7A7362", marginBottom: 4 };
const selectStyle = { width: "100%", padding: "9px 10px", borderRadius: 6, border: "1px solid #D8D2C2", background: "#fff", fontSize: 13, boxSizing: "border-box" };
const smallBtn = { fontSize: 12, background: "transparent", border: "1px solid #D8D2C2", borderRadius: 6, padding: "5px 10px", cursor: "pointer" };

/* ---------- App racine ---------- */

export default function App() {
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [section, setSection] = useState("dossier");
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDoc(personnelRef);
      setPersonnel(snap.exists() ? snap.data().list || [] : []);
    } catch (e) {
      console.error(e);
      setPersonnel([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function persist(list) {
    setPersonnel(list);
    try {
      await setDoc(personnelRef, { list });
      setSaveError("");
    } catch (e) {
      console.error(e);
      setSaveError("Échec de l'enregistrement, réessaie (vérifie ta config Firebase).");
    }
  }

  function handleCreateFirstAdmin(data) {
    const p = { id: crypto.randomUUID(), matricule: nextMatricule([]), grade: "Colonel", unite: "DGGN", fonction: "Directeur Général", opj: true, isAdmin: true, ...data };
    persist([p]);
    setCurrent(p);
  }

  function handleCreate(data) {
    const p = { id: crypto.randomUUID(), matricule: nextMatricule(personnel), ...data };
    persist([...personnel, p]);
  }

  function handleUpdate(id, data) {
    const list = personnel.map((p) => (p.id === id ? { ...p, ...data } : p));
    persist(list);
    if (current?.id === id) setCurrent({ ...current, ...data });
  }

  function handleDelete(id) {
    if (id === current?.id) return;
    persist(personnel.filter((p) => p.id !== id));
  }

  if (!current) {
    return <LoginScreen personnel={personnel} loading={loading} onLogin={setCurrent} onCreateFirstAdmin={handleCreateFirstAdmin} />;
  }

  return (
    <div style={{ display: "flex", fontFamily: "-apple-system, Segoe UI, sans-serif", background: "#EFECE2", minHeight: "100vh" }}>
      <Sidebar current={current} section={section} setSection={setSection} isAdmin={!!current.isAdmin} onLogout={() => setCurrent(null)} />
      <div style={{ flex: 1, padding: "32px 40px" }}>
        {saveError && <div style={{ color: "#9C2B2B", fontSize: 12, marginBottom: 14 }}>{saveError}</div>}
        {section === "dossier" && (
          <div>
            <h2 style={h2Style}>Mon dossier</h2>
            <CarteService p={current} />
          </div>
        )}
        {section === "annuaire" && <Annuaire personnel={personnel} />}
        {section === "admin" && current.isAdmin && (
          <AdminPanel personnel={personnel} onCreate={handleCreate} onDelete={handleDelete} onUpdate={handleUpdate} />
        )}
      </div>
    </div>
  );
}
