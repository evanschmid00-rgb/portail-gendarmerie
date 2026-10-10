// App.jsx — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import React, { useCallback, useEffect, useRef, useState } from "react";
import { auth, db } from "./firebase";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { Confirmation, h2Style } from "./composants/ui.jsx";
import { DISCIPLINE_MIN_INDEX, GRADES, UNITE_ALIAS, UNITE_CMD, UNITE_ENC, appliquerReglages, estCommandement, estCorps, genererRIO, nextRef, normUnite } from "./lib/constantes.js";
import { createAuthUser, journaliserMC, loadCollection, loadRecent, loadServicesDe, loadStrict, loadWhere, notifierDiscord, syncGradeDiscord, syncSanctionDiscord, usernameToEmail } from "./lib/donnees.js";
import { FORMAT_DOSSIER, enregistrerDossierLocal, genererNumeroDossier, lireDossiersLocaux, oublierDossierLocal } from "./lib/dossier.js";
import { GAV_SECTIONS, OFFICIER_SECTIONS, SOG_SECTIONS } from "./lib/questionsCandidature.js";
import { QUOTA_DEFAUT, cleJour, fmtDuree, fmtJourFR, lienValide, refAleatoire } from "./lib/utils.js";
import { PublicHome } from "./pages/accueil.jsx";
import { AdminPanel, GradesUnitesAdmin, LiensUtilesAdmin, NotesServicePanel, RecrutementPanel, RolesPage } from "./pages/admin.jsx";
import { AvisGendarmeForm, AvisGeneralForm, AvisSuggestionsPage, MesAvisPage, SuggestionForm } from "./pages/avis.jsx";
import { AdminCandidatures, ApplicationForm, DejaPostule, QuestionnaireFerme, QuestionnairesAdmin, QuestionnairesListe, SuiviCandidaturePublic, sectionsDe } from "./pages/candidatures.jsx";
import { CartePro, CartesProPage } from "./pages/cartes.jsx";
import { CasierPage, CasierPublicLookup, CodePenalPage, CodePenalPublic } from "./pages/casier.jsx";
import { CompteRenduPage, PopupDemandesCR, RapportsInternesPage, demandesAFaire } from "./pages/comptes-rendus.jsx";
import { CreerCompteScreen, LoginScreen } from "./pages/connexion.jsx";
import { MesSanctionsPage, PromotionsPage, SanctionsPage } from "./pages/discipline.jsx";
import { DashTopBar, PulsarTuiles, RPRibbon, Sidebar, construireMenu } from "./pages/layout.jsx";
import { MATERIEL_PATROUILLE, MainCourantePage } from "./pages/maincourante.jsx";
import { AdminPlaintes, AdminPlaintesGendarmes, PlainteForm, estPVPlainte } from "./pages/plaintes.jsx";
import { MODELE_PLAINTE_DEFAUT, PVModelesAdmin, PVPage } from "./pages/pv.jsx";
import { ReglementsPage, ReglementsPublic, loadReglementsPublics, trierReglements } from "./pages/reglements.jsx";
import { AdminServicesPage, MonServicePage, ServicesEquipePage } from "./pages/services.jsx";

// Sur téléphone et tablette, le site s'affiche comme sur ordinateur (mise en page large, que l'on peut agrandir avec les doigts)
const LARGEUR_BUREAU = 1100;
function appliquerVueBureau() {
  try {
    if (!window.screen || window.screen.width >= LARGEUR_BUREAU) return; // ordinateur : rien à changer
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
    meta.setAttribute("content", `width=${LARGEUR_BUREAU}, minimum-scale=0.1, maximum-scale=5, user-scalable=yes`);
  } catch (e) { /* tant pis : le site reste utilisable */ }
}

function AppInner() {
  useEffect(() => { appliquerVueBureau(); }, []);
  const [view, setView] = useState("public"); // public | login | dashboard
  const [publicSection, setPublicSection] = useState("home"); // home | plainte | candidature | confirmation
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationDash, setConfirmationDash] = useState(null);

  const [personnel, setPersonnel] = useState([]);
  const [candidatures, setCandidatures] = useState([]);
  const [plaintes, setPlaintes] = useState([]);
  const [plaintesGendarmes, setPlaintesGendarmes] = useState([]);
  const [comptesRendus, setComptesRendus] = useState([]);
  const [demandesCR, setDemandesCR] = useState([]);
  const [rapportsInternes, setRapportsInternes] = useState([]);
  const [casier, setCasier] = useState([]);
  const [codePenal, setCodePenal] = useState([]);
  const [avisGendarmes, setAvisGendarmes] = useState([]);
  const [avisGeneraux, setAvisGeneraux] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [notesService, setNotesService] = useState([]);
  const [reglements, setReglements] = useState([]);
  const [reglementsPublic, setReglementsPublic] = useState(null);
  const [materielPatrouille, setMaterielPatrouille] = useState(MATERIEL_PATROUILLE);
  const [servicesEquipeEtat, setServicesEquipeEtat] = useState("idle");
  const [reouverts, setReouverts] = useState({}); // postes pour lesquels la personne a choisi de redéposer une candidature
  const [sanctionRoles, setSanctionRoles] = useState({});
  const [quotaReglages, setQuotaReglages] = useState(QUOTA_DEFAUT);
  const [absences, setAbsences] = useState([]);
  const [lienDiscord, setLienDiscord] = useState("");
  const [lienZello, setLienZello] = useState("");
  const [recrutementOuvert, setRecrutementOuvert] = useState(true);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [questionnaireId, setQuestionnaireId] = useState(null);
  const [pvs, setPvs] = useState([]);
  const [modelesPVState, setModelesPVState] = useState(null);
  const [, setTickReglages] = useState(0);
  const [purgeInfo, setPurgeInfo] = useState(null); // { le, legacy } lu dans settings/general
  const purgeEnCours = useRef(false);
  const [migrUnites, setMigrUnites] = useState([]);
  const [services, setServices] = useState([]);
  const [enService, setEnService] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [popupCR, setPopupCR] = useState(false);
  const crAFaire = demandesAFaire(demandesCR, comptesRendus, current);
  const crAFaireIds = crAFaire.map((d) => d.id).join(",");
  // Message à la connexion : une seule fois par session pour chaque demande
  useEffect(() => {
    if (!current || !crAFaireIds) return;
    let vus = [];
    try { vus = JSON.parse(window.sessionStorage.getItem("pulsar_popup_cr") || "[]"); } catch (e) { vus = []; }
    if (crAFaireIds.split(",").some((id) => !vus.includes(id))) setPopupCR(true);
  }, [current && current.id, crAFaireIds]);
  function fermerPopupCR() {
    try { window.sessionStorage.setItem("pulsar_popup_cr", JSON.stringify(crAFaireIds.split(","))); } catch (e) { /* tant pis */ }
    setPopupCR(false);
  }
  // Retire les rôles Discord des sanctions terminées (au plus toutes les 10 minutes par session)
  useEffect(() => {
    if (!current) return;
    try {
      const k = "pulsar_balayage_sanctions";
      const dernier = Number(window.sessionStorage.getItem(k) || 0);
      if (Date.now() - dernier < 10 * 60 * 1000) return;
      window.sessionStorage.setItem(k, String(Date.now()));
    } catch (e) { /* stockage indisponible : on continue */ }
    syncSanctionDiscord("", "balayer");
  }, [current && current.id]);
  const [dashSection, setDashSection] = useState("dossier");
  const [saveError, setSaveError] = useState("");
  const [loginBlockedMsg, setLoginBlockedMsg] = useState("");

  // Charge les données visibles compte tenu des règles Firestore (les collections
  // restreintes reviendront vides pour un visiteur non autorisé, sans erreur).
  // Données chargées « à la demande » (casier, code pénal, avis, services de toute l'équipe) : une seule fois par visite
  const dejaCharge = useRef({});
  const servicesTousRef = useRef(false);

  const loadAll = useCallback(async () => {
    const user = auth.currentUser;
    let pNorm = [];
    let san = [];
    if (user) {
      // Temps 1 : le personnel, pour savoir qui est connecté et ce qu'il a le droit de lire
      const [p, ens] = await Promise.all([loadCollection("personnel"), loadCollection("en_service")]);
      pNorm = p.map((x) => (UNITE_ALIAS[x.unite] ? { ...x, unite: UNITE_ALIAS[x.unite] } : x));
      setMigrUnites(p.filter((x) => UNITE_ALIAS[x.unite]).map((x) => ({ id: x.id, unite: UNITE_ALIAS[x.unite] })));
      setPersonnel(pNorm);
      setEnService(ens);
      const moi = pNorm.find((x) => x.id === user.uid);
      const quals = (moi && moi.qualifications) || [];
      const admin = !!(moi && moi.isAdmin);
      const corps = !!(moi && estCorps(moi.unite));
      const cmd = !!(moi && estCommandement(moi.unite));
      const vide = Promise.resolve([]);
      // Temps 2 : seulement ce que cette personne peut lire, et seulement les plus récents quand la liste grossit
      const [c, pl, plg, cr, sanL, promo, rl, ns, rgl, pvl, mesServices, demCR, rapI] = await Promise.all([
        admin || quals.includes("Recruteur") ? loadRecent("candidatures", 150) : vide,
        admin || quals.includes("OPJ") ? loadRecent("plaintes", 150) : vide,
        admin || corps ? loadRecent("plaintes_gendarmes", 100) : vide,
        admin || corps ? loadRecent("comptes_rendus", 100) : (moi ? loadWhere("comptes_rendus", "auteurUid", "==", user.uid) : vide),
        loadCollection("sanctions"),
        loadCollection("promotions"),
        loadCollection("roles"),
        loadCollection("notes_service"),
        loadCollection("reglements"),
        loadRecent("pv", 80),
        moi ? (servicesTousRef.current ? loadCollection("services") : loadServicesDe(moi.matricule)) : vide,
        admin || corps ? loadRecent("demandes_cr", 150) : (moi ? loadWhere("demandes_cr", "cibleUids", "array-contains", user.uid) : vide),
        admin || cmd ? loadRecent("rapports_internes", 150) : (moi ? loadWhere("rapports_internes", "auteurUid", "==", user.uid) : vide),
      ]);
      setCandidatures(c); setPlaintes(pl); setPlaintesGendarmes(plg); setComptesRendus(cr);
      setSanctions(sanL); setPromotions(promo); setRoles(rl); setNotesService(ns); setReglements(rgl); setPvs(pvl); setServices(mesServices); setDemandesCR(demCR); setRapportsInternes(rapI);
      // Lien Zello : lisible uniquement par les gendarmes connectés
      if (moi) {
        try { const z = await getDoc(doc(db, "liens_internes", "zello")); setLienZello(z.exists() ? lienValide(z.data().url, true) : ""); } catch (e) { setLienZello(""); }
      } else setLienZello("");
      san = sanL;
    } else {
      // Visiteur : on ne charge rien de privé (et on vide ce qui aurait pu rester en mémoire)
      setPersonnel([]); setEnService([]); setCandidatures([]); setPlaintes([]); setPlaintesGendarmes([]); setComptesRendus([]); setDemandesCR([]); setRapportsInternes([]);
      setSanctions([]); setPromotions([]); setRoles([]); setNotesService([]); setReglements([]); setPvs([]); setServices([]);
      setAvisGendarmes([]); setAvisGeneraux([]); setSuggestions([]);
      dejaCharge.current.avisGendarmes = false; dejaCharge.current.avisGeneraux = false; dejaCharge.current.suggestions = false; servicesTousRef.current = false; dejaCharge.current.servicesTous = false; dejaCharge.current.absences = false; setAbsences([]); setServicesEquipeEtat("idle");
    }
    try {
      const snap = await getDoc(doc(db, "settings", "general"));
      if (snap.exists()) {
        setRecrutementOuvert(snap.data().recrutementOuvert !== false);
        setQuestionnaires(Array.isArray(snap.data().questionnaires) ? snap.data().questionnaires : []);
        setModelesPVState(Array.isArray(snap.data().modelesPV) ? snap.data().modelesPV : null);
        if (Array.isArray(snap.data().materielPatrouille) && snap.data().materielPatrouille.length) setMaterielPatrouille(snap.data().materielPatrouille);
        if (snap.data().sanctionRoles && typeof snap.data().sanctionRoles === "object") setSanctionRoles(snap.data().sanctionRoles);
        setLienDiscord(lienValide(snap.data().lienDiscord));
        setQuotaReglages({ quotaHebdoMin: Number(snap.data().quotaHebdoMin) > 0 ? Number(snap.data().quotaHebdoMin) : 300, quotaReserveMin: Number(snap.data().quotaReserveMin) > 0 ? Number(snap.data().quotaReserveMin) : 180, quotaDebut: snap.data().quotaDebut || "", quotaAuto: snap.data().quotaAuto === true });
        appliquerReglages(snap.data());
        setTickReglages((t) => t + 1);
        setPurgeInfo({ le: snap.data().purgeLe || "", legacy: !!snap.data().purgeLegacyFait });
      } else setPurgeInfo({ le: "", legacy: false });
    } catch (e) { /* visible par tous, pas d'erreur bloquante */ }
    return { personnel: pNorm, sanctions: san };
  }, []);

  // Chargement à la demande selon la page ouverte
  const chargerUneFois = useCallback(async (cle, fn) => {
    if (dejaCharge.current[cle]) return;
    dejaCharge.current[cle] = true;
    try { await fn(); } catch (e) { dejaCharge.current[cle] = false; console.error("Chargement", cle, e); }
  }, []);
  useEffect(() => {
    const pub = view === "public" ? publicSection : "";
    const dash = view === "dashboard" ? dashSection : "";
    if (pub === "casier-public" || dash === "casier") chargerUneFois("casier", async () => setCasier(await loadStrict("casier")));
    if (pub === "code-penal" || dash === "casier" || dash === "code-penal-interne") chargerUneFois("codePenal", async () => setCodePenal(await loadStrict("code_penal")));
    if (pub === "reglements") chargerUneFois("reglementsPublic", async () => {
      try { setReglementsPublic(await loadReglementsPublics()); } catch (e) { console.error("Règlements publics", e); setReglementsPublic("erreur"); }
    });
    if (dash === "mes-avis") chargerUneFois("avisGendarmes", async () => setAvisGendarmes(await loadStrict("avis_gendarmes")));
    if (dash === "avis-suggestions") {
      chargerUneFois("avisGeneraux", async () => setAvisGeneraux(await loadStrict("avis_generaux")));
      chargerUneFois("suggestions", async () => setSuggestions(await loadCollection("suggestions")));
    }
    if (current && (dash === "mon-service" || dash === "services-equipe" || dash === "admin-services")) {
      chargerUneFois("absences", async () => { setAbsences(await loadStrict("absences")); });
    }
    if (current && (dash === "services-equipe" || (dash === "admin-services" && current.isAdmin))) {
      chargerUneFois("servicesTous", async () => {
        try {
          const tous = await loadStrict("services");
          servicesTousRef.current = true;
          setServices(tous);
          setServicesEquipeEtat("ok");
        } catch (e) { setServicesEquipeEtat("erreur"); throw e; }
      });
    }
  }, [view, publicSection, dashSection, current && current.isAdmin, chargerUneFois]);

  // Écoute l'état de connexion Firebase Auth : reste connecté après un rafraîchissement,
  // sans jamais stocker de mot de passe côté navigateur.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      const { personnel: p, sanctions: san } = await loadAll();
      if (user) {
        const found = p.find((pers) => pers.id === user.uid);
        if (found) {
          const now = new Date();
          const miseAPied = san.find((s) => s.matricule === found.matricule && s.type === "Mise à pied" && new Date(s.dateFin) > now);
          if (miseAPied) {
            setCurrent(null);
            setLoginBlockedMsg(`Compte suspendu (mise à pied) jusqu'au ${new Date(miseAPied.dateFin).toLocaleString("fr-FR")}.`);
            try { await signOut(auth); } catch (e) {}
          } else {
            setCurrent(found);
            setView("dashboard");
          }
        } else {
          setCurrent(null);
          try { await signOut(auth); } catch (e) {}
        }
      } else {
        setCurrent(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [loadAll]);

  // Retour de la connexion Discord (jeton dans le # de l'adresse, ou message d'erreur)
  useEffect(() => {
    const dt = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("dt");
    const err = new URLSearchParams(window.location.search).get("discord_error");
    if (dt) {
      window.history.replaceState(null, "", window.location.pathname);
      signInWithCustomToken(auth, dt).catch((e) => { console.error(e); setLoginBlockedMsg("Connexion Discord impossible, réessaie."); setView("login"); });
    } else if (err) {
      window.history.replaceState(null, "", window.location.pathname);
      setLoginBlockedMsg(err);
      setView("login");
    }
  }, []);

  // Nettoyage automatique : les éléments archivés depuis plus de 7 jours sont supprimés (lancé par un administrateur, au plus 1 fois par jour)
  useEffect(() => {
    if (!current || !current.isAdmin || !purgeInfo || purgeEnCours.current) return;
    const dernier = purgeInfo.le ? new Date(purgeInfo.le).getTime() : 0;
    if (purgeInfo.legacy && Date.now() - dernier < 20 * 3600 * 1000) return;
    purgeEnCours.current = true; // verrou : une seule exécution par visite, même si l'enregistrement de la date échoue
    (async () => {
      try {
        const maintenant = new Date();
        const coupe7 = new Date(maintenant.getTime() - 7 * 86400000).toISOString();
        const coupe30 = new Date(maintenant.getTime() - 30 * 86400000).toISOString();
        const COLS = ["candidatures", "plaintes", "plaintes_gendarmes", "comptes_rendus", "pv"];
        const archive = (col, d) => (col === "candidatures" ? d.statut && d.statut !== "En attente" : col === "comptes_rendus" || col === "pv" ? !!d.traite : d.statut === "Traitée" || d.statut === "Classée");
        let supprimes = 0;
        for (const col of COLS) {
          // 1) archivés depuis plus de 7 jours
          const snap = await getDocs(query(collection(db, col), where("archiveLe", "<", coupe7)));
          for (const d of snap.docs) { await deleteDoc(doc(db, col, d.id)); supprimes++; }
          // 2) une seule fois : anciens éléments déjà archivés avant cette fonction (sans date d'archivage)
          if (!purgeInfo.legacy) {
            const tous = await loadStrict(col);
            for (const d of tous) {
              if (d.archiveLe || !archive(col, d)) continue;
              if (String(d.createdAt || "") < coupe30) { await deleteDoc(doc(db, col, d.id)); supprimes++; }
              else await updateDoc(doc(db, col, d.id), { archiveLe: maintenant.toISOString() });
            }
          }
        }
        await setDoc(doc(db, "settings", "general"), { purgeLe: maintenant.toISOString(), purgeLegacyFait: true }, { merge: true });
        setPurgeInfo({ le: maintenant.toISOString(), legacy: true });
        if (supprimes > 0) await loadAll();
      } catch (e) { console.error("Nettoyage des archives :", e); }
      // on ne remet PAS le verrou à zéro : prochain nettoyage à la prochaine visite
    })();
  }, [current, purgeInfo, loadAll]);

  // Marqueur « en service » (lu par les règles Firebase pour autoriser la main courante)
  useEffect(() => {
    if (!current) return;
    const actif = services.find((s) => s.matricule === current.matricule && s.type !== "ajustement" && !s.fin);
    const marqueur = enService.some((e) => e.id === current.id);
    if (actif && !marqueur) {
      setDoc(doc(db, "en_service", current.id), { matricule: current.matricule, nom: `${current.prenom} ${current.nom}`, debut: actif.debut })
        .then(() => setEnService((prev) => [...prev, { id: current.id }])).catch((e) => console.error(e));
    } else if (!actif && marqueur) {
      deleteDoc(doc(db, "en_service", current.id))
        .then(() => setEnService((prev) => prev.filter((e) => e.id !== current.id))).catch((e) => console.error(e));
    }
  }, [current, services, enService]);

  // Migration automatique des anciens noms d'unités (DGGN/IGGN) par un administrateur
  useEffect(() => {
    if (!current || !current.isAdmin || migrUnites.length === 0) return;
    const aFaire = migrUnites;
    setMigrUnites([]);
    Promise.all(aFaire.map((m) => updateDoc(doc(db, "personnel", m.id), { unite: m.unite }))).catch((e) => console.error(e));
  }, [current, migrUnites]);

  // Lien direct vers un questionnaire : https://ton-site.vercel.app/?q=ID
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("q");
    if (id) { setQuestionnaireId(id); setPublicSection("questionnaire"); }
  }, []);

  async function refresh() {
    await loadAll();
  }

  // Journal d'activité retiré : aucune écriture (économise le quota Firebase)
  async function logAction() {}

  // Connexion
  async function handleLogin(username, password) {
    try {
      await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "Identifiants incorrects." };
    }
  }

  // Premier compte administrateur (à utiliser une seule fois)
  async function handleCreateFirstAdmin(data) {
    try {
      const uid = await createAuthUser(usernameToEmail(data.username), data.password);
      const profile = { matricule: nextRef([], "GH"), nom: data.nom, prenom: data.prenom, username: data.username, grade: "Colonel", gradeRank: GRADES.indexOf("Colonel"), unite: UNITE_CMD, fonction: "Directeur Général", qualifications: ["OPJ"], isAdmin: true };
      await setDoc(doc(db, "personnel", uid), profile);
      await signInWithEmailAndPassword(auth, usernameToEmail(data.username), data.password);
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false, error: e.message || "Erreur lors de la création du compte." };
    }
  }

  // Gestion du personnel (admin uniquement)
  async function handleCreatePersonnel(data) {
    try {
      const username = (data.username || "").trim();
      if (!username || !data.password) return { ok: false, error: "Identifiant et mot de passe obligatoires." };
      if (data.password.length < 6) return { ok: false, error: "Mot de passe trop court (6 caractères minimum)." };
      const rio = genererRIO(personnel);
      if (!rio) return { ok: false, error: "Plus de RIO disponible (100 agents maximum)." };
      const year = new Date().getFullYear();
      let n = personnel.length + 1;
      let matricule;
      do { matricule = `GH-${year}-${String(n++).padStart(4, "0")}`; } while (personnel.some((p) => p.matricule === matricule));
      const uid = await createAuthUser(usernameToEmail(username), data.password);
      const profile = {
        matricule, cipcNumero: rio, qualiteJudiciaire: data.qualiteJudiciaire || "APJA",
        nom: data.nom.trim(), prenom: data.prenom.trim(), username, pseudoRoblox: "", pseudoDiscord: "",
        grade: data.grade, gradeRank: GRADES.indexOf(data.grade), unite: data.unite, fonction: data.fonction || "", qualifications: [], isAdmin: false,
      };
      await setDoc(doc(db, "personnel", uid), profile);
      await setDoc(doc(db, "annuaire_public", uid), { prenom: profile.prenom, nom: profile.nom, pseudoRoblox: "", pseudoDiscord: "" });
      await refresh();
      logAction("Création de compte", `${profile.prenom} ${profile.nom} (RIO ${rio})`);
      return { ok: true };
    } catch (e) {
      console.error(e);
      const m = String(e.message || "");
      return { ok: false, error: m.includes("EMAIL_EXISTS") ? "Cet identifiant existe déjà." : m.includes("WEAK_PASSWORD") ? "Mot de passe trop court (6 caractères minimum)." : (m || "Erreur lors de la création du compte.") };
    }
  }
  // Attribue un RIO à tous les agents qui n'en ont pas encore
  async function handleAssignRIO() {
    try {
      const manque = personnel.filter((p) => !p.cipcNumero);
      const nouveaux = {};
      for (const p of manque) {
        const n = genererRIO(personnel, Object.values(nouveaux));
        if (!n) break;
        nouveaux[p.id] = n;
      }
      await Promise.all(Object.entries(nouveaux).map(([id, n]) => updateDoc(doc(db, "personnel", id), { cipcNumero: n })));
      await refresh();
      logAction("RIO", `${Object.keys(nouveaux).length} RIO attribué(s)`);
      return Object.keys(nouveaux).length;
    } catch (e) { console.error(e); return -1; }
  }
  async function handleUpdatePersonnel(id, data) {
    try {
      const { password, username, ...profile } = data;
      const avant = personnel.find((p) => p.id === id);
      await updateDoc(doc(db, "personnel", id), profile);
      if (avant && avant.grade !== profile.grade) {
        syncGradeDiscord(id).then((j) => { if (j && j.alerte) setSaveError("Grade modifié sur le site, mais Discord : " + j.message); });
      }
      await setDoc(doc(db, "annuaire_public", id), { prenom: profile.prenom, nom: profile.nom, pseudoRoblox: profile.pseudoRoblox || "", pseudoDiscord: profile.pseudoDiscord || "" });
      if (current?.id === id) setCurrent({ ...current, ...profile });
      await refresh();
      logAction("Modification de compte", `${profile.prenom} ${profile.nom} (${profile.matricule})`);
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false, error: "Erreur lors de la mise à jour." };
    }
  }
  async function handleDeletePersonnel(id) {
    if (id === current?.id) return;
    const target = personnel.find((p) => p.id === id);
    try {
      await deleteDoc(doc(db, "personnel", id));
      try { await deleteDoc(doc(db, "annuaire_public", id)); } catch (e) {}
      await refresh();
      logAction("Suppression de compte", target ? `${target.prenom} ${target.nom} (${target.matricule})` : id);
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  // Candidatures (GAV publique, SOG/Officier internes)
  async function handleSubmitCandidature(data, auteur) {
    const ref = genererNumeroDossier(data.poste);
    const maintenant = new Date().toISOString();
    const nomAuteur = auteur ? `${auteur.prenom} ${auteur.nom}` : "";
    const c = { ref, statut: "En attente", createdAt: maintenant, auteurMatricule: auteur ? auteur.matricule : null, ...data, displayName: data.displayName === "Candidat" && nomAuteur ? nomAuteur : data.displayName };
    try {
      // Fiche de suivi consultable par le candidat avec son numéro (ne contient que le poste et l'état)
      let suiviOk = true;
      try {
        await setDoc(doc(db, "suivi_candidatures", ref), { poste: data.poste, statut: "En attente", createdAt: maintenant, updatedAt: maintenant });
      } catch (e0) { suiviOk = false; console.error("Suivi de candidature indisponible (règles Firestore ?)", e0); }
      const docRef = await addDoc(collection(db, "candidatures"), c);
      setCandidatures([...candidatures, { id: docRef.id, ...c }]);
      notifierDiscord("candidature", `${c.displayName} — ${c.poste} (${ref})`);
      const conf = suiviOk
        ? { title: "Candidature envoyée", message: "Ta candidature a bien été transmise à l'administration. Tu seras recontacté via Discord, et tu peux aussi consulter la réponse avec ton numéro de dossier.", refNumber: ref, dossier: true }
        : { title: "Candidature envoyée", message: "Ta candidature a bien été transmise à l'administration. Tu seras recontacté via Discord.", refNumber: ref };
      if (auteur) setConfirmationDash(conf);
      else {
        if (suiviOk) enregistrerDossierLocal(data.poste, ref);
        setReouverts({});
        setConfirmation(conf);
        setPublicSection("confirmation");
      }
    } catch (e) { console.error(e); setSaveError("Échec de l'envoi, réessaie."); }
  }
  async function handleUpdateCandidatureStatut(id, statut) {
    try {
      const maintenant = new Date().toISOString();
      const patch = { statut, archiveLe: statut !== "En attente" ? maintenant : null };
      await updateDoc(doc(db, "candidatures", id), patch);
      setCandidatures(candidatures.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      const cand = candidatures.find((c) => c.id === id);
      if (cand && FORMAT_DOSSIER.test(String(cand.ref || ""))) {
        try { await updateDoc(doc(db, "suivi_candidatures", cand.ref), { statut, updatedAt: maintenant }); }
        catch (e1) { console.error("Mise à jour du suivi public impossible", e1); setSaveError("Statut enregistré, mais le suivi public du candidat n'a pas pu être mis à jour (règles Firestore)."); }
      }
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }

  // Plaintes (publiques)
  async function handleSubmitPlainte(data) {
    const ref = genererNumeroDossier("PLT");
    const p = { ref, statut: "En attente", source: "en_ligne", createdAt: new Date().toISOString(), ...data, preuves: (data.preuves || []).slice(0, 12) };
    try {
      const docRef = await addDoc(collection(db, "plaintes"), p);
      setPlaintes([...plaintes, { id: docRef.id, ...p }]);
      setConfirmation({ title: "Plainte enregistrée", message: "Ta plainte a bien été transmise à la gendarmerie. Un gendarme la traitera prochainement. Note bien ton numéro de plainte : il identifie ton dossier.", refNumber: ref });
      setPublicSection("confirmation");
    } catch (e) { console.error(e); setSaveError("Échec de l'envoi, réessaie."); }
  }
  async function handleUpdatePlainteStatut(id, statut) {
    try {
      const patch = { statut, archiveLe: statut === "Traitée" || statut === "Classée" ? new Date().toISOString() : null };
      await updateDoc(doc(db, "plaintes", id), patch);
      setPlaintes(plaintes.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleTakeChargePlainte(id) {
    const data = { prisEnChargeMatricule: current.matricule, prisEnChargeNom: `${current.prenom} ${current.nom}` };
    try {
      await updateDoc(doc(db, "plaintes", id), data);
      setPlaintes(plaintes.map((p) => (p.id === id ? { ...p, ...data } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la prise en charge."); }
  }

  // Plaintes contre des gendarmes (traitées par IGGN/DGGN uniquement)
  async function handleUpdatePlainteGendarmeStatut(id, statut) {
    try {
      const patch = { statut, archiveLe: statut === "Traitée" || statut === "Classée" ? new Date().toISOString() : null };
      await updateDoc(doc(db, "plaintes_gendarmes", id), patch);
      setPlaintesGendarmes(plaintesGendarmes.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleTakeChargePlainteGendarme(id) {
    const data = { prisEnChargeMatricule: current.matricule, prisEnChargeNom: `${current.prenom} ${current.nom}` };
    try {
      await updateDoc(doc(db, "plaintes_gendarmes", id), data);
      setPlaintesGendarmes(plaintesGendarmes.map((p) => (p.id === id ? { ...p, ...data } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la prise en charge."); }
  }

  // Comptes rendus d'intervention (uniquement sur demande du commandement / de l'encadrement)
  async function handleCreateDemandeCR(data) {
    const d = {
      ref: refAleatoire("DCR"), intervention: data.intervention.trim().slice(0, 200), dateIntervention: data.dateIntervention || "",
      lieu: (data.lieu || "").trim().slice(0, 150), consignes: (data.consignes || "").trim().slice(0, 1500), echeance: data.echeance || "",
      cibles: data.cibles, cibleUids: data.cibles.map((c) => c.uid),
      demandePar: current.matricule, demandeParNom: `${current.prenom} ${current.nom}`, demandeParUnite: normUnite(current.unite) || "",
      cloturee: false, createdAt: new Date().toISOString(),
    };
    try {
      const docRef = await addDoc(collection(db, "demandes_cr"), d);
      setDemandesCR((prev) => [...prev, { id: docRef.id, ...d }]);
      logAction("Compte rendu demandé", `${d.intervention} — ${d.cibles.length} gendarme(s)`);
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleCloseDemandeCR(id) {
    try {
      const patch = { cloturee: true, clotureeLe: new Date().toISOString() };
      await updateDoc(doc(db, "demandes_cr", id), patch);
      setDemandesCR((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    } catch (e) { console.error(e); setSaveError("Impossible de clôturer la demande."); }
  }
  async function handleSubmitCRIntervention(demande, f) {
    const champs = { heure: f.heure || "", effectifs: f.effectifs.trim(), deroulement: f.deroulement.trim(), personnes: f.personnes.trim(), bilan: f.bilan.trim() };
    const contenu = [
      `Intervention : ${demande.intervention}${demande.dateIntervention ? ` (${demande.dateIntervention})` : ""}${demande.lieu ? ` — ${demande.lieu}` : ""}`,
      champs.heure && `Heure des faits : ${champs.heure}`,
      champs.effectifs && `Effectifs et moyens : ${champs.effectifs}`,
      `Déroulement : ${champs.deroulement}`,
      champs.personnes && `Personnes concernées : ${champs.personnes}`,
      champs.bilan && `Bilan et suites : ${champs.bilan}`,
    ].filter(Boolean).join("\n");
    const cr = {
      type: "intervention", demandeId: demande.id, demandeRef: demande.ref,
      destinataire: demande.demandeParUnite === UNITE_ENC ? UNITE_ENC : UNITE_CMD,
      objet: `Compte rendu — ${demande.intervention}`.slice(0, 190), contenu: contenu.slice(0, 4900), champs,
      createdAt: new Date().toISOString(), auteurUid: current.id, auteurMatricule: current.matricule, auteurNom: `${current.prenom} ${current.nom}`, traite: false,
    };
    try {
      const docRef = await addDoc(collection(db, "comptes_rendus"), cr);
      setComptesRendus((prev) => [...prev, { id: docRef.id, ...cr }]);
      logAction("Compte rendu rédigé", demande.intervention);
      return true;
    } catch (e) { console.error(e); setSaveError("Échec de l'envoi, réessaie."); return false; }
  }
  async function handleMarkCompteRenduTraite(id) {
    const cr0 = comptesRendus.find((x) => x.id === id);
    try {
      // Les comptes rendus d'intervention restent consultables (ils justifient le suivi de la demande) : pas d'archivage automatique
      const patch = cr0 && cr0.type === "intervention" ? { traite: true } : { traite: true, archiveLe: new Date().toISOString() };
      await updateDoc(doc(db, "comptes_rendus", id), patch);
      setComptesRendus((prev) => prev.map((cr) => (cr.id === id ? { ...cr, ...patch } : cr)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }

  // Rapports internes (lus uniquement par le Corps de Commandement)
  async function handleCreateRapport(data) {
    const r = {
      ref: refAleatoire("RPT"), objet: data.objet.trim().slice(0, 190), contenu: data.contenu.trim().slice(0, 4500), gravite: data.gravite,
      auteurUid: current.id, auteurMatricule: current.matricule, auteurNom: `${current.prenom} ${current.nom}`,
      statut: "Nouveau", reponse: "", createdAt: new Date().toISOString(),
    };
    try {
      const docRef = await addDoc(collection(db, "rapports_internes"), r);
      setRapportsInternes((prev) => [...prev, { id: docRef.id, ...r }]);
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleUpdateRapport(id, patch) {
    const p = { ...patch, traiteParNom: `${current.prenom} ${current.nom}`, traiteLe: new Date().toISOString() };
    try {
      await updateDoc(doc(db, "rapports_internes", id), p);
      setRapportsInternes((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour du rapport."); }
  }

  // Casier judiciaire (un dossier par pseudo Discord, chaque dossier contient plusieurs mentions)
  // Code pénal
  // Grades, unités et seuils (réglages enregistrés dans settings/general)
  async function handleSaveReglages({ grades, gradesTags, unites, seuils, renomGrades, renomUnites }) {
    try {
      await setDoc(doc(db, "settings", "general"), { grades, gradesTags, unites, ...seuils, seuilHautRang: grades.indexOf(seuils.seuilHaut) }, { merge: true });
      await Promise.all(personnel.map(async (p) => {
        const g = renomGrades[p.grade] || p.grade;
        const u = renomUnites[p.unite] || p.unite;
        const rank = grades.indexOf(g);
        if (g !== p.grade || u !== p.unite || rank !== p.gradeRank) await updateDoc(doc(db, "personnel", p.id), { grade: g, unite: u, gradeRank: rank });
      }));
      appliquerReglages({ grades, gradesTags, unites, ...seuils });
      await loadAll();
      setTickReglages((t) => t + 1);
      logAction("Réglages", "Grades et unités modifiés");
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false, error: "Échec de l'enregistrement (vérifie les règles Firebase)." }; }
  }

  // Compte Roblox lié (vérifié par le serveur) pour la photo de la CIPC
  function handleRobloxLinked(data) {
    setCurrent((c) => ({ ...c, ...data }));
    setPersonnel((prev) => prev.map((p) => (p.id === current.id ? { ...p, ...data } : p)));
    return true;
  }

  // Service (prise / fin de service)
  async function handleStartService() {
    if (services.some((s) => s.matricule === current.matricule && s.type !== "ajustement" && !s.fin)) return;
    const s = { type: "service", matricule: current.matricule, nom: `${current.prenom} ${current.nom}`, debut: new Date().toISOString(), fin: null };
    try {
      const ref = await addDoc(collection(db, "services"), s);
      setServices((prev) => [...prev, { id: ref.id, ...s }]);
      notifierDiscord("service_debut", `${s.nom} (${s.matricule}) prend son service`);
      try {
        await setDoc(doc(db, "en_service", current.id), { matricule: current.matricule, nom: s.nom, debut: s.debut });
        setEnService((prev) => (prev.some((e) => e.id === current.id) ? prev : [...prev, { id: current.id }]));
      } catch (e2) { console.error(e2); }
      journaliserMC(current, "Prise de service.");
    } catch (e) { console.error(e); setSaveError("Impossible de prendre le service, réessaie."); }
  }
  async function handleStopService(id, forcePar) {
    const patch = { fin: new Date().toISOString(), ...(forcePar ? { force: true, forcePar } : {}) };
    try {
      await updateDoc(doc(db, "services", id), patch);
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      const t = services.find((s) => s.id === id);
      if (t) notifierDiscord("service_fin", `${t.nom} (${t.matricule}) termine son service — ${fmtDuree(new Date(patch.fin) - new Date(t.debut))}${forcePar ? " (arrêt forcé par " + forcePar + ")" : ""}`);
      if (forcePar) logAction("Service", `Arrêt forcé du service de ${t ? t.nom : id}`);
      if (t) {
        const duree = fmtDuree(new Date(patch.fin) - new Date(t.debut));
        journaliserMC(current, forcePar ? `Service de ${t.nom} terminé de force par ${forcePar} — durée ${duree}.` : `Fin de service — durée ${duree}.`);
      }
      if (forcePar && t) {
        const pp = personnel.find((x) => x.matricule === t.matricule);
        if (pp) deleteDoc(doc(db, "en_service", pp.id)).then(() => setEnService((prev) => prev.filter((e) => e.id !== pp.id))).catch(() => {});
      }
    } catch (e) { console.error(e); setSaveError("Impossible de terminer le service, réessaie."); }
  }
  async function handleAdjustService(data) {
    const a = { type: "ajustement", matricule: data.matricule, nom: data.nom, minutes: data.minutes, motif: data.motif || "", date: new Date().toISOString(), auteur: `${current.prenom} ${current.nom}` };
    try {
      const ref = await addDoc(collection(db, "services"), a);
      setServices((prev) => [...prev, { id: ref.id, ...a }]);
      logAction("Service", `Ajustement de ${data.minutes} min pour ${data.nom}${data.motif ? " (" + data.motif + ")" : ""}`);
      return true;
    } catch (e) { console.error(e); setSaveError("Échec de l'ajustement."); return false; }
  }
  async function handleDeleteService(id) {
    try {
      const t = services.find((s) => s.id === id);
      await deleteDoc(doc(db, "services", id));
      setServices((prev) => prev.filter((s) => s.id !== id));
      if (t && t.type !== "ajustement" && !t.fin) {
        const pp = personnel.find((x) => x.matricule === t.matricule);
        if (pp) deleteDoc(doc(db, "en_service", pp.id)).then(() => setEnService((prev) => prev.filter((e) => e.id !== pp.id))).catch(() => {});
      }
      logAction("Service", "Suppression d'une ligne de service");
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  // Procès-verbaux
  async function handleSubmitPV(data) {
    const now = new Date();
    const serie = String(data.serie || "PV").toUpperCase();
    const ref = `${serie}-${cleJour(now).replace(/-/g, "").slice(2)}-${now.toTimeString().slice(0, 8).replace(/:/g, "")}`;
    const p = {
      ref, traite: false, createdAt: now.toISOString(),
      auteurMatricule: current.matricule, auteurUid: current.id, auteurNom: `${current.prenom} ${current.nom}`, auteurGrade: current.grade,
      auteurRIO: current.cipcNumero || "", auteurQualite: current.qualiteJudiciaire || "APJA", auteurUnite: current.unite || "",
      ...data,
    };
    try {
      const r = await addDoc(collection(db, "pv"), p);
      const saved = { id: r.id, ...p };
      setPvs((prev) => [saved, ...prev]);
      notifierDiscord("pv", `${p.modeleTitre} — par ${p.auteurNom} (${p.ref})`);
      journaliserMC(current, `PV transmis à l'OPJ : ${p.modeleTitre} (${p.ref}).`);
      return saved;
    } catch (e) { console.error(e); return null; }
  }
  async function handleVisaPV(id, observations) {
    const visa = { par: `${current.prenom} ${current.nom}`, grade: current.grade, rio: current.cipcNumero || "", le: new Date().toISOString(), observations: observations || "" };
    try {
      const patch = { traite: true, traitePar: visa.par, visa, archiveLe: visa.le };
      await updateDoc(doc(db, "pv", id), patch);
      setPvs((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      logAction("PV visé", id);
      return true;
    } catch (e) { console.error(e); setSaveError("Échec du visa (réservé aux OPJ)."); return false; }
  }
  async function handleSavePVModeles(list) {
    try {
      const garde = questionnaires.filter((q) => q.visibilite !== "pv"); // les anciens modèles de PV sont repris dans la nouvelle liste
      await setDoc(doc(db, "settings", "general"), { modelesPV: list, questionnaires: garde }, { merge: true });
      setModelesPVState(list);
      setQuestionnaires(garde);
      logAction("Modèles de PV", `${list.length} modèle(s) enregistré(s)`);
      return true;
    } catch (e) { console.error(e); setSaveError("Échec de l'enregistrement des modèles de PV."); return false; }
  }

  // Questionnaires personnalisés (stockés dans settings/general, lisibles par le public)
  async function handleSaveQuestionnaires(list) {
    try {
      const complet = [...list, ...questionnaires.filter((q) => q.visibilite === "pv")]; // on garde les anciens modèles de PV non encore migrés
      await setDoc(doc(db, "settings", "general"), { questionnaires: complet }, { merge: true });
      setQuestionnaires(complet);
      logAction("Questionnaires", `${list.length} questionnaire(s) enregistré(s)`);
      return true;
    } catch (e) { console.error(e); setSaveError("Échec de l'enregistrement des questionnaires."); return false; }
  }

  // Recrutement (bandeau d'accueil)
  async function handleToggleRecrutement() {
    const next = !recrutementOuvert;
    try {
      await setDoc(doc(db, "settings", "general"), { recrutementOuvert: next }, { merge: true });
      setRecrutementOuvert(next);
      logAction("Recrutement", next ? "Ouvert" : "Fermé");
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }

  // Avis sur un gendarme (publics, non modifiables par les gendarmes)
  async function handleSubmitAvisGendarme(data) {
    const a = { ...data, createdAt: new Date().toISOString() };
    try {
      const docRef = await addDoc(collection(db, "avis_gendarmes"), a);
      setAvisGendarmes([...avisGendarmes, { id: docRef.id, ...a }]);
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false }; }
  }

  // Avis généraux sur la gendarmerie
  async function handleSubmitAvisGeneral(data) {
    const a = { ...data, createdAt: new Date().toISOString() };
    try {
      const docRef = await addDoc(collection(db, "avis_generaux"), a);
      setAvisGeneraux([...avisGeneraux, { id: docRef.id, ...a }]);
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false }; }
  }

  // Suggestions (lecture réservée DGGN)
  async function handleSubmitSuggestion(data) {
    const s = { ...data, createdAt: new Date().toISOString() };
    try {
      const docRef = await addDoc(collection(db, "suggestions"), s);
      setSuggestions([...suggestions, { id: docRef.id, ...s }]);
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false }; }
  }

  // Sanctions disciplinaires (Commandant et grades supérieurs)
  async function handleIssueSanction(data) {
    const dateDebut = new Date();
    const dateFin = new Date(dateDebut.getTime() + Number(data.dureeJours) * 24 * 60 * 60 * 1000);
    const roleDiscordId = (sanctionRoles && sanctionRoles[data.type]) || "";
    const s = {
      matricule: data.matricule,
      nomCible: data.nomCible,
      type: data.type,
      motif: data.motif.trim(),
      dureeJours: Number(data.dureeJours),
      dateDebut: dateDebut.toISOString(),
      dateFin: dateFin.toISOString(),
      emisPar: current.matricule,
      emisParNom: `${current.prenom} ${current.nom}`,
      levee: false,
      roleDiscordId,
      statutDiscord: roleDiscordId ? "en attente" : "aucun",
    };
    try {
      const docRef = await addDoc(collection(db, "sanctions"), s);
      setSanctions([...sanctions, { id: docRef.id, ...s }]);
      logAction("Sanction émise", `${s.type} — ${s.nomCible} (${s.matricule})`);
      if (roleDiscordId) syncSanctionDiscord(docRef.id, "ajouter").then((j) => { if (j && j.alerte) setSaveError("Sanction enregistrée, mais Discord : " + j.message); });
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false, error: "Échec de l'envoi." }; }
  }
  async function handleLeverSanction(id) {
    const s = sanctions.find((x) => x.id === id);
    if (!s) return;
    const patch = { levee: true, leveeLe: new Date().toISOString(), leveePar: `${current.prenom} ${current.nom}` };
    try {
      await updateDoc(doc(db, "sanctions", id), patch);
      setSanctions(sanctions.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      logAction("Sanction levée", `${s.type} — ${s.nomCible}`);
      if (s.roleDiscordId) syncSanctionDiscord(id, "retirer").then((j) => { if (j && j.alerte) setSaveError("Sanction levée, mais Discord : " + j.message); });
    } catch (e) { console.error(e); setSaveError("Échec de la levée de la sanction."); }
  }
  async function handleAddAbsence(data) {
    const a = { matricule: current.matricule, nom: `${current.prenom} ${current.nom}`, debut: data.debut, fin: data.fin, motif: (data.motif || "").trim().slice(0, 300), annulee: false, createdAt: new Date().toISOString() };
    try {
      const r = await addDoc(collection(db, "absences"), a);
      setAbsences((prev) => [...prev, { id: r.id, ...a }]);
      logAction("Absence déclarée", `${a.nom} du ${a.debut} au ${a.fin}`);
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleCancelAbsence(id) {
    try {
      await updateDoc(doc(db, "absences", id), { annulee: true });
      setAbsences((prev) => prev.map((a) => (a.id === id ? { ...a, annulee: true } : a)));
    } catch (e) { console.error(e); setSaveError("Impossible d'annuler l'absence."); }
  }
  async function handleSaveLiens({ discord, zello }) {
    try {
      await setDoc(doc(db, "settings", "general"), { lienDiscord: discord }, { merge: true });
      await setDoc(doc(db, "liens_internes", "zello"), { url: zello });
      setLienDiscord(discord); setLienZello(zello);
      logAction("Liens utiles", `Discord ${discord ? "renseigné" : "vide"}, Zello ${zello ? "renseigné" : "vide"}`);
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleSaveQuota(r) {
    try {
      await setDoc(doc(db, "settings", "general"), r, { merge: true });
      setQuotaReglages(r);
      logAction("Quota de service", `${r.quotaHebdoMin} min (réserviste ${r.quotaReserveMin} min), contrôle auto ${r.quotaAuto ? "activé" : "désactivé"}`);
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleSaveSanctionRoles(map) {
    try {
      await setDoc(doc(db, "settings", "general"), { sanctionRoles: map }, { merge: true });
      setSanctionRoles(map);
      logAction("Rôles Discord des sanctions", `${Object.keys(map).length} rôle(s) configuré(s)`);
      return true;
    } catch (e) { console.error(e); return false; }
  }

  // Promotions / rétrogradations (Commandant et grades supérieurs, sur grade inférieur au sien)
  async function handleIssuePromotion(targetPersonnel, nouveauGrade, motif = "") {
    const ancienGrade = targetPersonnel.grade;
    const type = GRADES.indexOf(nouveauGrade) > GRADES.indexOf(ancienGrade) ? "Promotion" : "Rétrogradation";
    const p = {
      matricule: targetPersonnel.matricule,
      nomCible: `${targetPersonnel.prenom} ${targetPersonnel.nom}`,
      ancienGrade,
      nouveauGrade,
      type,
      motif,
      emisPar: current.matricule,
      emisParNom: `${current.prenom} ${current.nom}`,
      createdAt: new Date().toISOString(),
    };
    try {
      await updateDoc(doc(db, "personnel", targetPersonnel.id), { grade: nouveauGrade, gradeRank: GRADES.indexOf(nouveauGrade) });
      const docRef = await addDoc(collection(db, "promotions"), p);
      setPromotions([...promotions, { id: docRef.id, ...p }]);
      await refresh();
      logAction(type, `${p.nomCible} : ${ancienGrade} → ${nouveauGrade}`);
      syncGradeDiscord(targetPersonnel.id).then((j) => { if (j && j.alerte) setSaveError("Grade modifié sur le site, mais Discord : " + j.message); });
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false, error: "Échec de l'opération." }; }
  }

  // Rôles personnalisés
  // Notes de service (épinglées à l'accueil du tableau de bord)
  async function handleCreateNoteService(data) {
    const n = { ...data, auteurNom: `${current.prenom} ${current.nom}`, createdAt: new Date().toISOString() };
    try {
      const docRef = await addDoc(collection(db, "notes_service"), n);
      setNotesService([...notesService, { id: docRef.id, ...n }]);
      logAction("Note de service publiée", data.titre);
    } catch (e) { console.error(e); setSaveError("Échec de la publication."); }
  }
  async function handleDeleteNoteService(id) {
    try {
      await deleteDoc(doc(db, "notes_service", id));
      setNotesService(notesService.filter((n) => n.id !== id));
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  // Règlements (cases créées/modifiables par l'admin)
  async function handleCreateReglement(data) {
    const now = new Date().toISOString();
    const r = { titre: data.titre.trim(), contenu: data.contenu, audience: data.audience || "gendarmes", categorie: (data.categorie || "").trim(), ordre: Date.now(), createdAt: now, updatedAt: now };
    try {
      const docRef = await addDoc(collection(db, "reglements"), r);
      setReglements([...reglements, { id: docRef.id, ...r }]);
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
      logAction("Règlement créé", data.titre);
    } catch (e) { console.error(e); setSaveError("Échec de la création."); }
  }
  async function handleUpdateReglement(id, data) {
    const r = { titre: data.titre.trim(), contenu: data.contenu, audience: data.audience || "gendarmes", categorie: (data.categorie || "").trim(), updatedAt: new Date().toISOString() };
    try {
      await updateDoc(doc(db, "reglements", id), r);
      setReglements(reglements.map((x) => (x.id === id ? { ...x, ...r } : x)));
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
      logAction("Règlement modifié", data.titre);
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleMoveReglement(id, dir) {
    const liste = trierReglements(reglements);
    const i = liste.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= liste.length) return;
    const nouvelle = liste.slice();
    [nouvelle[i], nouvelle[j]] = [nouvelle[j], nouvelle[i]];
    // On renumérote proprement (0, 1, 2…) pour que l'ordre reste stable
    const changes = nouvelle.map((x, k) => ({ x, k })).filter(({ x, k }) => x.ordre !== k);
    try {
      await Promise.all(changes.map(({ x, k }) => updateDoc(doc(db, "reglements", x.id), { ordre: k })));
      const ordres = {}; nouvelle.forEach((x, k) => { ordres[x.id] = k; });
      setReglements(reglements.map((x) => ({ ...x, ordre: ordres[x.id] })));
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
    } catch (e) { console.error(e); setSaveError("Échec du déplacement."); }
  }
  async function handleDeleteReglement(id) {
    try {
      await deleteDoc(doc(db, "reglements", id));
      setReglements(reglements.filter((r) => r.id !== id));
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  async function handleSaveMateriel(liste) {
    try {
      await setDoc(doc(db, "settings", "general"), { materielPatrouille: liste }, { merge: true });
      setMaterielPatrouille(liste);
      logAction("Matériel de patrouille", `${liste.length} élément(s)`);
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleCreateRole(data) {
    try {
      const docRef = await addDoc(collection(db, "roles"), data);
      setRoles([...roles, { id: docRef.id, ...data }]);
      logAction("Création de rôle", data.nom);
    } catch (e) { console.error(e); setSaveError("Échec de la création du rôle."); }
  }
  async function handleUpdateRole(id, data) {
    try {
      await updateDoc(doc(db, "roles", id), data);
      setRoles(roles.map((r) => (r.id === id ? { ...r, ...data } : r)));
      logAction("Modification de rôle", data.nom);
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour du rôle."); }
  }
  async function handleDeleteRole(id) {
    try {
      await deleteDoc(doc(db, "roles", id));
      setRoles(roles.filter((r) => r.id !== id));
    } catch (e) { console.error(e); setSaveError("Échec de la suppression du rôle."); }
  }

  async function handleAddArticle(data) {
    try {
      const docRef = await addDoc(collection(db, "code_penal"), data);
      setCodePenal([...codePenal, { id: docRef.id, ...data }]);
    } catch (e) { console.error(e); setSaveError("Échec de l'ajout, réessaie."); }
  }
  async function handleUpdateArticle(id, data) {
    try {
      await updateDoc(doc(db, "code_penal", id), data);
      setCodePenal(codePenal.map((a) => (a.id === id ? { ...a, ...data } : a)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleDeleteArticle(id) {
    try {
      await deleteDoc(doc(db, "code_penal", id));
      setCodePenal(codePenal.filter((a) => a.id !== id));
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }
  async function handleAddCasier(data, auteur) {
    const { pseudoRoblox, robloxUsername, robloxId, nom, prenom, ...mentionFields } = data;
    const mention = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), gendarmeMatricule: auteur.matricule, gendarmeNom: `${auteur.prenom} ${auteur.nom}`, ...mentionFields };
    const bas = (s) => String(s || "").trim().toLowerCase();
    // Le compte Roblox (identifiant unique) sert de clé ; à défaut, ancien dossier au même pseudo : on le relie au compte
    const existing = casier.find((d) => d.robloxId && d.robloxId === robloxId)
      || casier.find((d) => !d.robloxId && [pseudoRoblox, robloxUsername].some((v) => bas(v) && bas(v) === bas(d.pseudoRoblox)));
    try {
      if (existing) {
        const mentions = [...existing.mentions, mention];
        const patch = { mentions, nom: nom || existing.nom || "", prenom: prenom || existing.prenom || "" };
        if (!existing.robloxId) Object.assign(patch, { robloxId, robloxUsername, robloxDisplayName: pseudoRoblox });
        await updateDoc(doc(db, "casier", existing.id), patch);
        setCasier(casier.map((d) => (d.id === existing.id ? { ...d, ...patch } : d)));
      } else {
        const dossier = { pseudoRoblox, pseudoDiscord: "", robloxId, robloxUsername, robloxDisplayName: pseudoRoblox, nom, prenom, mentions: [mention] };
        const docRef = await addDoc(collection(db, "casier"), dossier);
        setCasier([...casier, { id: docRef.id, ...dossier }]);
      }
      logAction("Ajout mention casier", `${pseudoRoblox} (@${robloxUsername}) — ${mentionFields.nature}`);
      const cible = [prenom, nom].filter(Boolean).join(" ") || `${pseudoRoblox} (@${robloxUsername})`;
      journaliserMC(auteur, `Casier judiciaire : ${existing ? "mention ajoutée au dossier" : "nouveau dossier ouvert"} — ${cible}${mentionFields.nature ? ` (${mentionFields.nature})` : ""}.`);
    } catch (e) { console.error(e); setSaveError("Échec de l'enregistrement, réessaie."); }
  }
  async function handleUpdateCasierMention(dossierId, mentionId, data) {
    const dossier = casier.find((d) => d.id === dossierId);
    if (!dossier) return;
    const mentions = dossier.mentions.map((m) => (m.id === mentionId ? { ...m, ...data } : m));
    try {
      await updateDoc(doc(db, "casier", dossierId), { mentions });
      setCasier(casier.map((d) => (d.id === dossierId ? { ...d, mentions } : d)));
      logAction("Modification mention casier", `${dossier.pseudoRoblox || dossier.pseudoDiscord}`);
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleDeleteCasierMention(dossierId, mentionId) {
    const dossier = casier.find((d) => d.id === dossierId);
    if (!dossier) return;
    const mentions = dossier.mentions.filter((m) => m.id !== mentionId);
    try {
      await updateDoc(doc(db, "casier", dossierId), { mentions });
      setCasier(casier.map((d) => (d.id === dossierId ? { ...d, mentions } : d)));
      logAction("Suppression mention casier", `${dossier.pseudoRoblox || dossier.pseudoDiscord}`);
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  /* ---------- Routage ---------- */

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#07142E", display: "flex", alignItems: "center", justifyContent: "center", color: "#F2F6FC", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
        Chargement…
      </div>
    );
  }

  const questionnairesPublics = questionnaires.filter((q) => q.visibilite === "public" && q.actif);
  const questionnairesInternes = questionnaires.filter((q) => q.visibilite === "interne" && q.actif);
  // Modèles de PV : liste dédiée ; à défaut, reprise des anciens modèles créés dans les questionnaires
  const modelesPVListe = modelesPVState || questionnaires.filter((q) => q.visibilite === "pv").map((q) => ({
    id: q.id, titre: q.titre, type: "Autre", serie: "PV", visa: "", actif: !!q.actif,
    sections: (q.sections || []).map((s) => ({ id: s.id, title: s.title, fields: (s.fields || []).map((f) => ({ key: f.key, label: f.label, type: f.type || "text", required: !!f.required, options: f.options || [] })) })),
  }));
  const modelesPVActifs = modelesPVListe.filter((m) => m.actif);
  const modelesPV = modelesPVActifs.some((m) => m.type === "Plainte" || /plainte/i.test(m.titre || "")) ? modelesPVActifs : [...modelesPVActifs, MODELE_PLAINTE_DEFAUT];

  if (view === "public") {
    if (publicSection === "home") return <PublicHome onNavigate={(s) => (s === "login" ? setView("login") : s === "creer-compte" ? setView("creer-compte") : setPublicSection(s))} recrutementOuvert={recrutementOuvert} nbQuestionnaires={questionnairesPublics.length} lienDiscord={lienDiscord} />;
    if (publicSection === "plainte") return <PlainteForm onSubmit={handleSubmitPlainte} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "suivi-candidature") return <SuiviCandidaturePublic onCancel={() => setPublicSection("home")} />;
    if (publicSection === "candidature") {
      const gavQ = questionnaires.find((q) => q.id === "gav");
      const dejaGav = lireDossiersLocaux().GAV;
      if (dejaGav && !reouverts.GAV) return <DejaPostule poste="GAV" numero={dejaGav.numero} onCancel={() => setPublicSection("home")} onNouvelle={() => { oublierDossierLocal("GAV"); setReouverts({ ...reouverts, GAV: true }); }} />;
      if (gavQ && !gavQ.actif) return <QuestionnaireFerme onBack={() => setPublicSection("home")} />;
      return (
        <ApplicationForm
          title={gavQ ? gavQ.titre : "Candidature — Gendarme Adjoint Volontaire (GAV)"}
          intro={gavQ ? gavQ.intro : "Rejoins les rangs de la Gendarmerie Nationale de Black RP. Réponds avec sérieux, ta candidature sera étudiée par l'administration."}
          sections={gavQ ? sectionsDe(gavQ) : GAV_SECTIONS}
          poste="GAV"
          onSubmit={(data) => handleSubmitCandidature(data)}
          onCancel={() => setPublicSection("home")}
        />
      );
    }
    if (publicSection === "questionnaires")
      return <QuestionnairesListe liste={questionnairesPublics} onOpen={(id) => { setQuestionnaireId(id); setPublicSection("questionnaire"); }} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "questionnaire") {
      const q = questionnaires.find((x) => x.id === questionnaireId && x.visibilite === "public");
      const posteQ = q ? (q.poste || q.titre) : "";
      const dejaQ = posteQ ? lireDossiersLocaux()[posteQ] : null;
      if (q && dejaQ && !reouverts[posteQ]) return <DejaPostule poste={posteQ} numero={dejaQ.numero} onCancel={() => setPublicSection("home")} onNouvelle={() => { oublierDossierLocal(posteQ); setReouverts({ ...reouverts, [posteQ]: true }); }} />;
      if (!q || !q.actif) return <QuestionnaireFerme onBack={() => setPublicSection("home")} />;
      return (
        <ApplicationForm
          key={q.id}
          title={q.titre}
          intro={q.intro}
          sections={sectionsDe(q)}
          poste={q.poste || q.titre}
          onSubmit={(data) => handleSubmitCandidature(data)}
          onCancel={() => setPublicSection("home")}
        />
      );
    }
    if (publicSection === "casier-public") return <CasierPublicLookup casier={casier} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "reglements") return <ReglementsPublic reglements={reglementsPublic} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "code-penal") return <CodePenalPublic codePenal={codePenal} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "avis-gendarme") return <AvisGendarmeForm onSubmit={handleSubmitAvisGendarme} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "avis-general") return <AvisGeneralForm onSubmit={handleSubmitAvisGeneral} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "suggestion") return <SuggestionForm onSubmit={handleSubmitSuggestion} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "confirmation" && confirmation) {
      return <Confirmation {...confirmation} onBack={() => { setPublicSection("home"); setConfirmation(null); }} onSuivi={() => { setPublicSection("suivi-candidature"); setConfirmation(null); }} />;
    }
  }

  if (view === "creer-compte") return <CreerCompteScreen onBack={() => setView("public")} onLogin={() => setView("login")} />;
  if (view === "login") {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onBack={() => setView("public")}
        blockedMsg={loginBlockedMsg}
      />
    );
  }

  // view === "dashboard"
  if (!current) { setView("public"); return null; }

  if (confirmationDash) {
    return <Confirmation {...confirmationDash} onBack={() => { setConfirmationDash(null); setDashSection("dossier"); }} />;
  }

  const compteurs = {
    candidatures: candidatures.filter((c) => c.statut === "En attente").length,
    plaintes: plaintes.filter((p) => p.statut === "En attente").length + pvs.filter((p) => estPVPlainte(p) && !p.traite).length,
    cr: crAFaire.length,
    rapports: (current.isAdmin || estCommandement(current.unite)) ? rapportsInternes.filter((r) => r.statut === "Nouveau").length : 0,
    plaintesGendarmes: plaintesGendarmes.filter((p) => p.statut === "En attente").length,
    questionnaires: questionnairesInternes.length,
    pv: pvs.filter((p) => !p.traite).length,
  };
  const menuDash = construireMenu(current, !!current.isAdmin, compteurs);
  const itemDash = menuDash.flatMap((g) => g.items).find((it) => it.id === dashSection);
  const titreSection = itemDash ? itemDash.label.replace(/ \(\d+\)$/, "") : dashSection.startsWith("postuler") ? "Candidature" : "Pulsar RP";
  const serviceActif = services.find((s) => s.matricule === current.matricule && s.type !== "ajustement" && !s.fin);

  return (
    <div style={{ display: "flex", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", background: "#E9EFF7", minHeight: "100vh" }}>
      <Sidebar
        current={current}
        section={dashSection}
        setSection={setDashSection}
        isAdmin={!!current.isAdmin}
        lienDiscord={lienDiscord}
        lienZello={lienZello}
        onLogout={async () => { try { await signOut(auth); } catch (e) {} setView("public"); setPublicSection("home"); }}
        counts={compteurs}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <DashTopBar current={current} titre={titreSection} actif={serviceActif} />
      <div style={{ flex: 1, padding: dashSection.startsWith("postuler") ? 0 : "32px 40px" }}>
        {saveError && <div style={{ color: "#C0172D", fontSize: 12, margin: "14px 0 0 40px" }}>{saveError}</div>}
        {dashSection === "dossier" && (
          <div>
            {(() => {
              const now = new Date();
              const mesSanctionsActives = sanctions.filter((s) => s.matricule === current.matricule && !s.levee && new Date(s.dateFin) > now);
              const heure = now.getHours();
              const salutation = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
              const isRecruteurOuAdmin = current.isAdmin || (current.qualifications || []).includes("Recruteur");
              const isOpjOuAdmin = current.isAdmin || (current.qualifications || []).includes("OPJ");
              const stats = [
                isRecruteurOuAdmin && { label: "Candidatures en attente", value: candidatures.filter((c) => c.statut === "En attente").length },
                isOpjOuAdmin && { label: "Plaintes en attente", value: plaintes.filter((p) => p.statut === "En attente").length + pvs.filter((p) => estPVPlainte(p) && !p.traite).length },
                (current.isAdmin || estCorps(current.unite)) && { label: "Signalements gendarmes", value: plaintesGendarmes.filter((p) => p.statut === "En attente").length },
                { label: "Personnel enregistré", value: personnel.length },
              ].filter(Boolean);
              return (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 26, fontWeight: 700, color: "#14213A" }}>{salutation}, {current.prenom} 👋</div>
                    <div style={{ fontSize: 13, color: "#5A6B84", marginTop: 4 }}>{current.grade} — {current.unite}{current.fonction ? ` — ${current.fonction}` : ""}</div>
                  </div>
                  {crAFaire.length > 0 && (
                    <div style={{ background: "#FFF4E0", border: "1px solid #E8A33A", color: "#6B4E00", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, lineHeight: 1.55 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>📝 {crAFaire.length} compte{crAFaire.length > 1 ? "s" : ""} rendu{crAFaire.length > 1 ? "s" : ""} à rédiger</div>
                      {crAFaire.map((d) => <div key={d.id} style={{ marginBottom: 3 }}>• <b>{d.intervention}</b>{d.echeance ? ` — avant le ${fmtJourFR(d.echeance)}` : ""}</div>)}
                      <button onClick={() => setDashSection("comptes-rendus")} style={{ background: "#B25E00", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>Rédiger maintenant</button>
                    </div>
                  )}
                  {mesSanctionsActives.length > 0 && (
                    <div style={{ background: "#C0172D", color: "#fff", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, lineHeight: 1.55 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ Tu as {mesSanctionsActives.length} sanction{mesSanctionsActives.length > 1 ? "s" : ""} en cours</div>
                      {mesSanctionsActives.map((s) => (
                        <div key={s.id} style={{ background: "rgba(255,255,255,0.14)", borderRadius: 8, padding: "8px 11px", marginBottom: 6 }}>
                          <b>{s.type}</b> — jusqu'au {new Date(s.dateFin).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                          <div style={{ marginTop: 2 }}>Motif : {s.motif}</div>
                        </div>
                      ))}
                      <button onClick={() => setDashSection("mes-sanctions")} style={{ background: "#fff", color: "#C0172D", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>Voir le détail</button>
                    </div>
                  )}
                  {stats.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
                      {stats.map((s) => (
                        <div key={s.label} style={{ background: "#fff", border: "1px solid #D3DDEA", borderRadius: 12, padding: "16px 18px", boxShadow: "0 4px 16px -10px rgba(7,20,46,0.25)" }}>
                          <div style={{ fontSize: 24, fontWeight: 700, color: "#123A7A", fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif" }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: "#5A6B84", marginTop: 2, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            <PulsarTuiles groups={menuDash} onOpen={setDashSection} />
            {(current.isAdmin || notesService.length > 0) && (
              <div style={{ marginBottom: 28 }}>
                <h2 style={h2Style}>Notes de service</h2>
                <NotesServicePanel current={current} notesService={notesService} onCreate={handleCreateNoteService} onDelete={handleDeleteNoteService} />
              </div>
            )}
            <h2 style={h2Style}>𝐂𝐈𝐏𝐂 — Carte d'Identité Professionnelle et de Circulation</h2>
          <CartePro p={current} onLinked={handleRobloxLinked} />
          </div>
        )}
        {dashSection === "reglements" && (
          <ReglementsPage current={current} reglements={reglements} onCreate={handleCreateReglement} onUpdate={handleUpdateReglement} onDelete={handleDeleteReglement} onMove={handleMoveReglement} />
        )}
        {dashSection === "casier" && <CasierPage current={current} casier={casier} codePenal={codePenal} onAdd={(data) => handleAddCasier(data, current)} onUpdateMention={handleUpdateCasierMention} onDeleteMention={handleDeleteCasierMention} />}
        {dashSection === "code-penal-interne" && <CodePenalPage current={current} codePenal={codePenal} onAdd={handleAddArticle} onUpdate={handleUpdateArticle} onDelete={handleDeleteArticle} />}
        {dashSection === "postuler-sog" && (
          <ApplicationForm
            title="Candidature — Sous-Officier de Gendarmerie (SOG)"
            intro="Réservé au personnel ayant au minimum le grade de Maréchal des Logis."
            sections={SOG_SECTIONS}
            poste="SOG"
            prefill={{ grade_actuel: current.grade }}
            onSubmit={(data) => handleSubmitCandidature(data, current)}
            onCancel={() => setDashSection("dossier")}
          />
        )}
        {dashSection === "postuler-officier" && (
          <ApplicationForm
            title="Candidature — Officier"
            intro="Réservé au personnel ayant au minimum le grade de Major."
            sections={OFFICIER_SECTIONS}
            poste="Officier"
            prefill={{ grade_actuel: current.grade }}
            onSubmit={(data) => handleSubmitCandidature(data, current)}
            onCancel={() => setDashSection("dossier")}
          />
        )}
        {dashSection === "admin-liens" && current.isAdmin && <LiensUtilesAdmin lienDiscord={lienDiscord} lienZello={lienZello} onSave={handleSaveLiens} />}
        {dashSection === "admin-grades" && current.isAdmin && <GradesUnitesAdmin personnel={personnel} onSave={handleSaveReglages} />}
        {dashSection === "cartes-pro" && <CartesProPage personnel={personnel} />}
        {dashSection === "main-courante" && (
          <MainCourantePage current={current} enService={!!serviceActif} canEdit={!!current.isAdmin || (current.qualifications || []).includes("OPJ") || current.qualiteJudiciaire === "OPJ"} canDelete={!!current.isAdmin} nbEnService={enService.length} agentsEnService={enService.map((e) => { const p = personnel.find((x) => x.id === e.id); return { id: e.id, nom: p ? `${p.prenom} ${p.nom}` : (e.nom || "Agent"), grade: p ? p.grade : "" }; })} materiel={materielPatrouille} onSaveMateriel={handleSaveMateriel} onGoService={() => setDashSection("mon-service")} onLog={logAction} />
        )}
        {dashSection === "mon-service" && <MonServicePage current={current} services={services} onStart={handleStartService} onStop={(id) => handleStopService(id)} quotaReglages={quotaReglages} absences={absences} onAddAbsence={handleAddAbsence} onCancelAbsence={handleCancelAbsence} />}
        {dashSection === "services-equipe" && <ServicesEquipePage current={current} personnel={personnel} services={services} etat={servicesEquipeEtat} quotaReglages={quotaReglages} absences={absences} />}
        {dashSection === "pv" && <PVPage current={current} modeles={modelesPV} pvs={pvs} onSubmit={handleSubmitPV} onVisa={handleVisaPV} />}
        {dashSection === "admin-services" && current.isAdmin && (
          <AdminServicesPage personnel={personnel} services={services} onForceStop={(id) => handleStopService(id, `${current.prenom} ${current.nom}`)} onAdjust={handleAdjustService} onDelete={handleDeleteService} quotaReglages={quotaReglages} absences={absences} onSaveQuota={handleSaveQuota} />
        )}
        {dashSection === "questionnaires-internes" && (
          <QuestionnairesListe liste={questionnairesInternes} onOpen={(id) => { setQuestionnaireId(id); setDashSection("postuler-questionnaire"); }} />
        )}
        {dashSection === "postuler-questionnaire" && (() => {
          const q = questionnairesInternes.find((x) => x.id === questionnaireId);
          if (!q) return <div style={{ padding: "32px 40px" }}>Questionnaire introuvable ou fermé.</div>;
          return (
            <ApplicationForm
              key={q.id}
              title={q.titre}
              intro={q.intro}
              sections={sectionsDe(q)}
              poste={q.poste || q.titre}
              onSubmit={(data) => handleSubmitCandidature(data, current)}
              onCancel={() => setDashSection("questionnaires-internes")}
            />
          );
        })()}
        {dashSection === "admin-questionnaires" && current.isAdmin && (
          <QuestionnairesAdmin questionnaires={questionnaires.filter((q) => q.visibilite !== "pv")} onSave={handleSaveQuestionnaires} />
        )}
        {dashSection === "admin-modeles-pv" && current.isAdmin && (
          <PVModelesAdmin modeles={modelesPVListe} onSave={handleSavePVModeles} />
        )}
        {dashSection === "admin-personnel" && current.isAdmin && (
          <div>
            <RecrutementPanel recrutementOuvert={recrutementOuvert} onToggle={handleToggleRecrutement} />
            <AdminPanel personnel={personnel} roles={roles} onCreate={handleCreatePersonnel} onDelete={handleDeletePersonnel} onUpdate={handleUpdatePersonnel} onAssignRIO={handleAssignRIO} />
          </div>
        )}
        {dashSection === "roles" && current.isAdmin && (
          <RolesPage roles={roles} onCreate={handleCreateRole} onUpdate={handleUpdateRole} onDelete={handleDeleteRole} />
        )}
        {dashSection === "admin-candidatures" && (current.isAdmin || (current.qualifications || []).includes("Recruteur")) && (
          <AdminCandidatures candidatures={candidatures} onUpdateStatut={handleUpdateCandidatureStatut} />
        )}
        {dashSection === "admin-plaintes" && (current.isAdmin || (current.qualifications || []).includes("OPJ")) && (
          <AdminPlaintes plaintes={plaintes} pvs={pvs} current={current} onUpdateStatut={handleUpdatePlainteStatut} onTakeCharge={handleTakeChargePlainte} onVisa={handleVisaPV} />
        )}
        {dashSection === "plaintes-gendarmes" && (current.isAdmin || estCorps(current.unite)) && (
          <AdminPlaintesGendarmes plaintes={plaintesGendarmes} current={current} onUpdateStatut={handleUpdatePlainteGendarmeStatut} onTakeCharge={handleTakeChargePlainteGendarme} />
        )}
        {popupCR && crAFaire.length > 0 && <PopupDemandesCR demandes={crAFaire} onOpen={() => { fermerPopupCR(); setDashSection("comptes-rendus"); }} onLater={fermerPopupCR} />}
        {dashSection === "rapports-internes" && <RapportsInternesPage current={current} rapports={rapportsInternes} onCreate={handleCreateRapport} onUpdate={handleUpdateRapport} />}
        {dashSection === "comptes-rendus" && (
          <CompteRenduPage current={current} personnel={personnel} demandes={demandesCR} comptesRendus={comptesRendus} onCreateDemande={handleCreateDemandeCR} onCloseDemande={handleCloseDemandeCR} onSubmitCR={handleSubmitCRIntervention} onMarkTraite={handleMarkCompteRenduTraite} />
        )}
        {dashSection === "mes-avis" && <MesAvisPage current={current} avisGendarmes={avisGendarmes} personnel={personnel} />}
        {dashSection === "avis-suggestions" && (
          <AvisSuggestionsPage current={current} avisGeneraux={avisGeneraux} suggestions={suggestions} />
        )}
        {dashSection === "sanctions" && (current.isAdmin || (current.gradeRank ?? GRADES.indexOf(current.grade)) >= DISCIPLINE_MIN_INDEX) && (
          <SanctionsPage current={current} personnel={personnel} sanctions={sanctions} onIssue={handleIssueSanction} onLever={handleLeverSanction} sanctionRoles={sanctionRoles} onSaveRoles={handleSaveSanctionRoles} />
        )}
        {dashSection === "mes-sanctions" && <MesSanctionsPage current={current} sanctions={sanctions} />}
        {dashSection === "promotions" && (
          <PromotionsPage current={current} personnel={personnel} promotions={promotions} onIssue={handleIssuePromotion} />
        )}
      </div>
      </div>
    </div>
  );
}


export default function App() {
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Barlow+Semi+Condensed:wght@500;600;700&family=Open+Sans:wght@800&display=swap";
    document.head.appendChild(l);
    const s = document.createElement("style");
    s.textContent = "html,body{background:#E9EFF7;font-family:'Inter','Segoe UI',system-ui,sans-serif;-webkit-font-smoothing:antialiased}button,input,select,textarea{font-family:inherit}::selection{background:#2F6FDE;color:#fff}";
    document.head.appendChild(s);
  }, []);
  return (
    <div style={{ paddingBottom: 30 }}>
      <AppInner />
      <RPRibbon />
    </div>
  );
}
