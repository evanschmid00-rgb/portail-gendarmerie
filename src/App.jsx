// App.jsx — routage, chargement des données et actions du portail
import React, { useCallback, useEffect, useRef, useState } from "react";
import { auth, db } from "./firebase";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { Confirmation, h2Style } from "./composants/ui.jsx";
import { DISCIPLINE_MIN_INDEX, GRADES, UNITE_ALIAS, UNITE_CMD, UNITE_ENC, appliquerReglages, estCommandement, estCorps, genererRIO, normUnite } from "./lib/constantes.js";
import { attribuerRoleDiscord, createAuthUser, loadCollection, loadRecent, loadServicesDe, loadStrict, loadWhere, notifierDiscord, syncGradeDiscord, syncSanctionDiscord, usernameToEmail } from "./lib/donnees.js";
import { avecCache, avecCacheSession, viderCacheSession, viderCache } from "./lib/cache.js";
import { envoyerPublic } from "./lib/envoiPublic.js";
import { COL_PIECES, lierPVAuxDossiers, lierPlainteAuDossier, resoudreRoblox, supprimerPiece } from "./lib/dossierPersonne.js";
import { mentionsGravesDe } from "./lib/casierBloquant.js";
import { FORMAT_DOSSIER, enregistrerDossierLocal, lireDossiersLocaux, oublierDossierLocal } from "./lib/dossier.js";
import { peutAcceder } from "./lib/accesQuestionnaires.js";
import { peutCreerHabilitations, peutModifierConditions, peutModifierVigipirate, peutValiderHabilitations, estOPJ } from "./lib/droits.js";
import "./composants/StyleGlobal.jsx";
import { lire as lirePage, ecrire as ecrirePage, effacer as effacerPage } from "./lib/liaisonLocale.js";
import { QUOTA_DEFAUT, qualiteDepuisGrade, majRegistreAgents, numAgent, calculerDroits, estPalaisJustice, peutSaisirCasierPV, postesCandidaturesGerables, useEstMobile, cleJour, finAutoService, fmtDuree, fmtJourFR, lienValide, refAleatoire, serviceEnCours, serviceExpire, DELAI_REPONSE_POINTAGE_MS, INTERVALLE_POINTAGE_MS, SEUIL_POINTAGE_MS, DUREE_MAX_SERVICE_MS } from "./lib/utils.js";
import { PublicHome } from "./pages/accueil.jsx";
import { AdminPanel, GradesUnitesAdmin, LiensUtilesAdmin, RecrutementPanel, RolesPage } from "./pages/admin.jsx";
import { AvisGendarmeForm, AvisGeneralForm, AvisSuggestionsPage, MesAvisPage, SuggestionForm } from "./pages/avis.jsx";
import { AdminCandidatures, ApplicationForm, DejaPostule, EspaceCandidat, ParcoursConditions, infosDuCandidat, mdpAleatoire, sansAccentsId, QuestionnaireFerme, QuestionnairesAdmin, estOuverte, QuestionnairesListe, SuiviCandidaturePublic, sectionsDe } from "./pages/candidatures.jsx";
import { CartePro, CartesProPage } from "./pages/cartes.jsx";
import { DocumentsPublic } from "./pages/accueil.jsx";
import { CasierPage, CasierPublicLookup, CodePenalPage, CodePenalPublic } from "./pages/casier.jsx";
import { BandeauVigipirate, VigipirateAdmin } from "./pages/vigipirate.jsx";
import { VIGIPIRATE_DOC } from "./lib/vigipirate.js";
import { HabilitationsAdmin, MesHabilitations } from "./pages/habilitations.jsx";
import { ReglementairePage } from "./pages/reglementaire.jsx";
import { CarteVillePage } from "./pages/carteVille.jsx";
import { HierarchiePage } from "./pages/hierarchie.jsx";
import { PersonnelPage } from "./pages/personnel.jsx";
import { BandeauConditionsConfirmees, CONDITIONS_DOC, ConditionsAdmin, ConditionsAdmission, aDesConditions } from "./pages/conditions.jsx";
import { CompteRenduPage, PopupDemandesCR, RapportsInternesPage, demandesAFaire } from "./pages/comptes-rendus.jsx";
import { CreerCompteScreen, LoginScreen } from "./pages/connexion.jsx";
import { MesSanctionsPage, PromotionsPage, SanctionsPage } from "./pages/discipline.jsx";
import { Ecusson } from "./composants/Ecusson.jsx";
import { PointageService } from "./composants/PointageService.jsx";
import { LogoGN } from "./composants/LogoGN.jsx";
import { DashTopBar, PulsarTuiles, RPRibbon, Sidebar, construireMenu } from "./pages/layout.jsx";
import { EssaiPage, enEssai, joursRestants } from "./pages/essai.jsx";
import { ParcoursRecrue, TachesPage, TachesCarte, construireParcours, construireTaches } from "./pages/taches.jsx";
import { MonComptePage } from "./pages/compte.jsx";
import { chargerCasierDe } from "./lib/casierRecherche.js";
import { ModalIdentifiants } from "./composants/ModalIdentifiants.jsx";
import { useFileAttente } from "./lib/useFileAttente.jsx";
import { champsParrain, finEssai, tirerParrain } from "./lib/organisation.js";
import { sanctionConcerne, sanctionsActivesDe } from "./lib/sanctions.js";
import { ajouterFile, estErreurQuota } from "./lib/fileAttente.js";
import { ecrireProfilLocal, lireProfilLocal } from "./lib/profilLocal.js";
import { CommunautePage } from "./pages/communaute.jsx";
import { DemandesJusticePage, MandatsPage, ProfilJusticePage } from "./pages/justice.jsx";
import { AdminPlaintes, AdminPlaintesGendarmes, PlainteForm, estPVPlainte } from "./pages/plaintes.jsx";
import { IGGNPresentation, IGGNInterne } from "./pages/iggn.jsx";
import { HierarchiePublique } from "./pages/hierarchiePublique.jsx";
import { PorteComptes } from "./composants/PorteComptes.jsx";
import { MODELE_PLAINTE_DEFAUT, PVModelesAdmin, PVPage } from "./pages/pv.jsx";
import { CadreJuridiquePage, CadreJuridiquePublic } from "./pages/cadreJuridique.jsx";
import { ReglementsPage, ReglementsPublic, loadReglementsPublics, trierReglements } from "./pages/reglements.jsx";
import { AdminServicesPage, MonServicePage, ServicesEquipePage } from "./pages/services.jsx";

// Affichage mobile : largeur de l'écran réelle + règles d'adaptation (grilles en colonne, champs lisibles…)
const CSS_MOBILE = `
@media (max-width: 820px) {
  html, body { overflow-x: hidden; -webkit-text-size-adjust: 100%; }
  body { margin: 0; }
  img, video { max-width: 100%; }
  input, select, textarea { font-size: 16px !important; max-width: 100%; min-width: 0; box-sizing: border-box; }
  [style*="grid-template-columns"] > * { min-width: 0; }
  [style*="justify-content: space-between"] { flex-wrap: wrap !important; row-gap: 8px; }
  [style*="grid-template-columns: 1fr 1fr"], [style*="grid-template-columns: 2fr 1.4fr"], [style*="grid-template-columns: 1fr 2fr"],
  [style*="grid-template-columns: 170px 130px 1fr"], [style*="grid-template-columns: 130px 150px 1fr"], [style*="minmax(420px"] { grid-template-columns: 1fr !important; }
  table { display: block; overflow-x: auto; max-width: 100%; }
  [style*="white-space: nowrap"] { white-space: normal !important; }
  [style*="position: fixed"][style*="inset: 0"] > div { max-width: 100% !important; }
}
`;
function appliquerAffichageMobile() {
  try {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
    meta.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
    if (!document.getElementById("pulsar-mobile")) {
      const s = document.createElement("style");
      s.id = "pulsar-mobile";
      s.textContent = CSS_MOBILE;
      document.head.appendChild(s);
    }
  } catch (e) { /* le site reste utilisable */ }
}

function AppInner() {
  useEffect(() => { appliquerAffichageMobile(); }, []);
  const [quotaAtteint, setQuotaAtteint] = useState(false);
  const bandeauFile = useFileAttente(); // envois mis en attente pendant une saturation de la base
  useEffect(() => { const f = () => setQuotaAtteint(true); window.addEventListener("gn-quota", f); return () => window.removeEventListener("gn-quota", f); }, []);
  const mobile = useEstMobile();
  const [minuteCourante, setMinuteCourante] = useState(0); // fait battre l'horloge chaque minute (services à arrêter, etc.)
  useEffect(() => { const t = setInterval(() => setMinuteCourante((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  const arretsEnCours = useRef({});
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [view, setView] = useState("public"); // public | login | dashboard
  const [publicSection, setPublicSection] = useState("home"); // home | plainte | candidature | confirmation
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationDash, setConfirmationDash] = useState(null);

  const [personnel, setPersonnel] = useState([]);
  majRegistreAgents(personnel); // numéro d'agent affichable partout (2 derniers chiffres du RIO)
  const [candidatures, setCandidatures] = useState([]);
  const [plaintes, setPlaintes] = useState([]);
  const [signalementsIGGN, setSignalementsIGGN] = useState([]); // signalements à l'IGGN (admins et Référents Déontologie)
  const [plaintesGendarmes, setPlaintesGendarmes] = useState([]); // plaintes contre un gendarme (Commandement, Référent Déontologie, admins)
  const [comptesRendus, setComptesRendus] = useState([]);
  const [demandesCR, setDemandesCR] = useState([]);
  const [rapportsInternes, setRapportsInternes] = useState([]);
  const [casier, setCasier] = useState([]);
  const [conditionsAdmission, setConditionsAdmission] = useState(null); // conditions d'admission (settings/conditions_admission)
  const [conditionsErr, setConditionsErr] = useState(""); // code d'erreur si la lecture des conditions échoue (diagnostic)
  const [conditionsOk, setConditionsOk] = useState(false); // le civil a confirmé respecter les conditions
  const [anciennePersonnel, setAnciennePersonnel] = useState(false); // Gestion du personnel : true = ancien panneau
  const [vigipirate, setVigipirate] = useState(null); // plan Vigipirate en vigueur (settings/vigipirate)
  const [dossierPieces, setDossierPieces] = useState([]); // PV et plaintes rattachés aux dossiers (personnel uniquement)
  const [codePenal, setCodePenal] = useState([]);
  const [avisGendarmes, setAvisGendarmes] = useState([]);
  const [avisGeneraux, setAvisGeneraux] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [reglements, setReglements] = useState([]);
  const [reglementsPublic, setReglementsPublic] = useState(null);
  const [servicesEquipeEtat, setServicesEquipeEtat] = useState("idle");
  const [reouverts, setReouverts] = useState({}); // postes pour lesquels la personne a choisi de redéposer une candidature
  const [sanctionRoles, setSanctionRoles] = useState({});
  const [quotaReglages, setQuotaReglages] = useState(QUOTA_DEFAUT);
  const [absences, setAbsences] = useState([]);
  const [lienDiscord, setLienDiscord] = useState("");
  const [lienJustice, setLienJustice] = useState("");
  const [lienRoblox, setLienRoblox] = useState("");
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
  // Retour de Discord (#dt=…) : on garde l'écran « Connexion… » jusqu'à l'ouverture de la session, au lieu d'afficher l'accueil du site
  const discordEnCours = useRef(typeof window !== "undefined" && /(^|[#&])dt=/.test(window.location.hash || ""));
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
  const [identifiantsFaits, setIdentifiantsFaits] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loginBlockedMsg, setLoginBlockedMsg] = useState("");

  // Charge les données visibles compte tenu des règles Firestore (les collections
  // restreintes reviendront vides pour un visiteur non autorisé, sans erreur).
  // Données chargées « à la demande » (casier, code pénal, avis, services de toute l'équipe) : une seule fois par visite
  const dejaCharge = useRef({});
  const servicesTousRef = useRef(false);

  const loadAll = useCallback(async (force = false) => {
    const user = auth.currentUser;
    // Les listes internes sont gardées quelques minutes dans l'onglet (rafraîchir la page ne relit plus tout Firestore). force = true après une modification.
    const ca = (cle, minutes, charger) => (user ? avecCacheSession(`${cle}:${user.uid}`, minutes * 60000, charger, force) : charger());
    let pNorm = [];
    let san = [];
    const reglagesP = getDoc(doc(db, "settings", "general")).catch(() => null); // lancé tout de suite, en parallèle du reste
    if (user) {
      // Temps 1 : le personnel, pour savoir qui est connecté et ce qu'il a le droit de lire
      const [p, ens] = await Promise.all([ca("personnel", 20, () => loadCollection("personnel")), ca("en_service", 2, () => loadCollection("en_service"))]);
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
      const [c, pl, cr, sanL, promo, rl, rgl, pvl, mesServices, demCR, rapI] = await Promise.all([
        admin || quals.includes("Recruteur") ? ca("candidatures", 5, () => loadRecent("candidatures", 80)) : vide,
        admin || estOPJ(moi) || quals.includes("Brigade de Recherche") ? ca("plaintes", 5, () => loadRecent("plaintes", 60)) : vide,
        admin || corps ? ca("comptes_rendus", 5, () => loadRecent("comptes_rendus", 60)) : (moi ? ca("comptes_rendus", 5, () => loadWhere("comptes_rendus", "auteurUid", "==", user.uid)) : vide),
        ca("sanctions", 5, () => loadCollection("sanctions")),
        ca("promotions", 60, () => loadCollection("promotions")),
        avecCache("roles", 30 * 60000, () => loadCollection("roles")),
        avecCache("reglements-g", 30 * 60000, () => loadCollection("reglements")),
        (admin || estOPJ(moi) || estPalaisJustice(moi)) ? ca("pv", 5, () => loadRecent("pv", 60)) : (moi && moi.matricule ? ca("pv-perso", 5, () => loadWhere("pv", "auteurMatricule", "==", moi.matricule)) : vide),
        moi ? ca("services", 5, () => (servicesTousRef.current ? loadCollection("services") : loadServicesDe(moi.matricule))) : vide,
        admin || corps ? ca("demandes_cr", 10, () => loadRecent("demandes_cr", 60)) : (moi ? ca("demandes_cr", 10, () => loadWhere("demandes_cr", "cibleUids", "array-contains", user.uid)) : vide),
        admin || cmd ? ca("rapports_internes", 10, () => loadRecent("rapports_internes", 60)) : (moi ? ca("rapports_internes", 10, () => loadWhere("rapports_internes", "auteurUid", "==", user.uid)) : vide),
      ]);
      setCandidatures(c); setPlaintes(pl); setComptesRendus(cr);
      if (admin || cmd || quals.includes("Référent Déontologie")) {
        try { setPlaintesGendarmes(await ca("plaintes_gendarmes", 5, () => loadRecent("plaintes_gendarmes", 60))); } catch (e) { console.error("Plaintes contre gendarmes", e); setPlaintesGendarmes([]); }
      } else setPlaintesGendarmes([]);
      if (admin || quals.includes("Référent Déontologie")) {
        try { setSignalementsIGGN(await ca("signalements_iggn", 5, () => loadRecent("signalements_iggn", 60))); } catch (e) { console.error("Signalements IGGN", e); setSignalementsIGGN([]); }
      } else setSignalementsIGGN([]);
      setSanctions(sanL); setPromotions(promo); setRoles(rl); setReglements(rgl); setPvs(pvl); setServices(mesServices); setDemandesCR(demCR); setRapportsInternes(rapI);
      // Lien de la communauté Roblox : lisible uniquement par les gendarmes connectés
      if (moi) {
        try { const z = await getDoc(doc(db, "liens_internes", "roblox")); setLienRoblox(z.exists() ? lienValide(z.data().url) : ""); } catch (e) { setLienRoblox(""); }
      } else setLienRoblox("");
      san = sanL;
    } else {
      // Visiteur : on ne charge rien de privé (et on vide ce qui aurait pu rester en mémoire)
      setPersonnel([]); setEnService([]); setCandidatures([]); setPlaintes([]); setPlaintesGendarmes([]); setComptesRendus([]); setDemandesCR([]); setRapportsInternes([]);
      setSanctions([]); setPromotions([]); setRoles([]); setReglements([]); setPvs([]); setServices([]);
      setAvisGendarmes([]); setAvisGeneraux([]); setSuggestions([]);
      dejaCharge.current.avisGendarmes = false; dejaCharge.current.avisGeneraux = false; dejaCharge.current.suggestions = false; servicesTousRef.current = false; dejaCharge.current.servicesTous = false; dejaCharge.current.absences = false; setAbsences([]); setServicesEquipeEtat("idle");
    }
    try {
      const snap = await reglagesP;
      if (snap && snap.exists()) {
        setRecrutementOuvert(snap.data().recrutementOuvert !== false);
        setQuestionnaires(Array.isArray(snap.data().questionnaires) ? snap.data().questionnaires : []);
        setModelesPVState(Array.isArray(snap.data().modelesPV) ? snap.data().modelesPV : null);
        if (snap.data().sanctionRoles && typeof snap.data().sanctionRoles === "object") setSanctionRoles(snap.data().sanctionRoles);
        setLienDiscord(lienValide(snap.data().lienDiscord));
        setLienJustice(lienValide(snap.data().lienJustice));
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
    let arreter = () => {};
    try { arreter = onSnapshot(doc(db, "settings", VIGIPIRATE_DOC), (snap) => setVigipirate(snap.exists() ? snap.data() : null), () => {}); } catch (e) { /* plan indisponible : niveau 1 par défaut */ }
    return () => arreter();
  }, []);
  useEffect(() => {
    let arreter = () => {};
    try { arreter = onSnapshot(doc(db, "settings", CONDITIONS_DOC), (snap) => { setConditionsAdmission(snap.exists() ? snap.data() : null); setConditionsErr(""); }, (err) => setConditionsErr(String((err && err.code) || "erreur"))); } catch (e) { /* conditions indisponibles : pas de filtre */ }
    return () => arreter();
  }, []);
  useEffect(() => {
    if (view === "dashboard" && current && estPalaisJustice(current)) {
      if (!["demandes-justice", "mandats", "pv", "casier", "code-penal-interne", "cadre-juridique", "mon-profil-justice", "compte"].includes(dashSection)) setDashSection("demandes-justice");
      return;
    }
  }, [view, current, dashSection]);
  useEffect(() => {
    const pub = view === "public" ? publicSection : "";
    const dash = view === "dashboard" ? dashSection : "";
    if (dash === "casier") chargerUneFois("casier", async () => setCasier(await avecCacheSession("casier-staff", 15 * 60000, () => loadStrict("casier"))));
    if (dash === "casier") chargerUneFois("dossierPieces", async () => { try { setDossierPieces(await avecCacheSession("dossier-pieces", 15 * 60000, () => loadStrict(COL_PIECES))); } catch (e) { console.warn("Pièces des dossiers non lisibles (règles Firestore) :", e); } });
    if (pub === "code-penal" || pub === "cadre-juridique" || dash === "casier" || dash === "code-penal-interne" || dash === "cadre-juridique" || dash === "demandes-justice" || dash === "pv") chargerUneFois("codePenal", async () => setCodePenal(await avecCache("code_penal", 10 * 60000, () => loadStrict("code_penal"))));
    if (pub === "reglements" || pub === "cadre-juridique") chargerUneFois("reglementsPublic", async () => {
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
      if (!user && discordEnCours.current) return; // la session Discord est en cours d'ouverture : on attend
      discordEnCours.current = false;
      setLoading(true);
      const { personnel: p, sanctions: san } = await loadAll();
      if (user) {
        let found = p.find((pers) => pers.id === user.uid);
        if (found) ecrireProfilLocal(found);
        else {
          // Fiche introuvable dans la liste : lecture directe, puis copie gardée sur l'appareil si la base est saturée ou injoignable
          try {
            const d = await getDoc(doc(db, "personnel", user.uid));
            if (d.exists()) { found = { id: d.id, ...d.data() }; ecrireProfilLocal(found); }
          } catch (e) {
            const local = lireProfilLocal(user.uid);
            if (local) { found = local; setPersonnel((prev) => (prev.length ? prev : [local])); }
            else if (estErreurQuota(e)) setLoginBlockedMsg("La base de données a atteint sa limite du jour : connexion impossible pour le moment. Elle se remet à zéro dans la nuit (vers 9 h) : réessaie à ce moment-là.");
          }
        }
        if (found) {
          const now = new Date();
          // Lecture FRAÎCHE de ses propres sanctions (pas de cache) : une sanction levée ne doit plus bloquer la connexion
          let siennes = san;
          try { siennes = await loadWhere("sanctions", "matricule", "==", found.matricule); } catch (e) { /* on garde la liste chargée */ }
          const miseAPied = siennes.find((s) => sanctionConcerne(s, found) && !s.levee && s.type === "Mise à pied" && new Date(s.dateFin) > now);
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
        viderCacheSession();
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
      signInWithCustomToken(auth, dt).catch((e) => { console.error(e); discordEnCours.current = false; setLoading(false); setView("login"); setLoginBlockedMsg(`Discord a bien reconnu ton compte, mais le site n'a pas pu ouvrir ta session${e && e.code ? ` (${e.code})` : ""}. Réessaie dans une minute ; si ça persiste, préviens un administrateur.`); setView("login"); });
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
        const COLS = ["candidatures", "plaintes", "comptes_rendus", "pv"];
        const archive = (col, d) => (col === "candidatures" ? d.statut && d.statut !== "En attente" && (d.statutPublie === undefined || d.statutPublie === d.statut) : col === "comptes_rendus" || col === "pv" ? !!d.traite : d.statut === "Traitée" || d.statut === "Classée");
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
        // Conservation limitée : casiers, dossiers et PV disparaissent au bout de JOURS_CONSERVATION_DOSSIERS jours
        const coupeDossiers = new Date(maintenant.getTime() - JOURS_CONSERVATION_DOSSIERS * 86400000).toISOString();
        for (const col of ["pv", COL_PIECES]) {
          const tous = await loadStrict(col);
          for (const d of tous) {
            const date = String(d.createdAt || d.date || d.creeLe || "");
            if (date < coupeDossiers) { await deleteDoc(doc(db, col, d.id)); supprimes++; }
          }
        }
        const casiers = await loadStrict("casier");
        for (const d of casiers) {
          const ms = Array.isArray(d.mentions) ? d.mentions : [];
          const restantes = ms.filter((m) => String((m && (m.createdAt || m.date)) || "") >= coupeDossiers);
          if (!restantes.length) { await deleteDoc(doc(db, "casier", d.id)); supprimes++; }
          else if (restantes.length !== ms.length) { await updateDoc(doc(db, "casier", d.id), { mentions: restantes }); supprimes++; }
        }
        if (supprimes > 0) viderCacheSession();
        await setDoc(doc(db, "settings", "general"), { purgeLe: maintenant.toISOString(), purgeLegacyFait: true }, { merge: true });
        setPurgeInfo({ le: maintenant.toISOString(), legacy: true });
        if (supprimes > 0) await loadAll(true);
      } catch (e) { console.error("Nettoyage des archives :", e); }
      // on ne remet PAS le verrou à zéro : prochain nettoyage à la prochaine visite
    })();
  }, [current, purgeInfo, loadAll]);

  // Service oublié : arrêt automatique (3 h max, ou dernier pointage confirmé), jamais à « maintenant »
  useEffect(() => {
    if (!current) return;
    const expire = services.find((s) => s.matricule === current.matricule && serviceExpire(s, Date.now()));
    if (!expire || arretsEnCours.current[expire.id]) return;
    arretsEnCours.current[expire.id] = true;
    const parPointage = !!expire.pointage && Date.now() - new Date(expire.debut).getTime() < DUREE_MAX_SERVICE_MS + 1 && Date.now() - new Date(expire.dernierPointage || expire.debut).getTime() >= SEUIL_POINTAGE_MS;
    const patch = { fin: finAutoService(expire), arretAuto: true, motifArret: parPointage ? "pointage" : "duree" };
    updateDoc(doc(db, "services", expire.id), patch)
      .then(() => {
        setServices((prev) => prev.map((s) => (s.id === expire.id ? { ...s, ...patch } : s)));
        deleteDoc(doc(db, "en_service", current.id)).then(() => setEnService((prev) => prev.filter((e) => e.id !== current.id))).catch(() => {});
        notifierDiscord("service_fin", `${expire.nom} (n° ${numAgent(expire.matricule)}) — service arrêté automatiquement (durée maximale de 3 h ou pointage non confirmé)`);
      })
      .catch((e) => { console.error(e); delete arretsEnCours.current[expire.id]; });
  }, [current, services, minuteCourante]);

  // Pointage : l'agent en service confirme régulièrement sa présence ; sans réponse, le service est arrêté (temps validé jusqu'au dernier pointage)
  const [pointageDu, setPointageDu] = useState(null); // { id, limite }
  const prochainPointage = useRef({}); // id du service → heure du prochain pointage
  useEffect(() => {
    if (!current) return;
    const actif = services.find((s) => s.matricule === current.matricule && s.pointage && serviceEnCours(s, Date.now()));
    if (!actif) { if (pointageDu) setPointageDu(null); return; }
    const t = Date.now();
    const cle = actif.id + "|" + (actif.dernierPointage || actif.debut);
    if (!prochainPointage.current[cle]) prochainPointage.current[cle] = new Date(actif.dernierPointage || actif.debut).getTime() + INTERVALLE_POINTAGE_MS * (0.83 + Math.random() * 0.34);
    if (pointageDu && pointageDu.id === actif.id) {
      if (t > pointageDu.limite && !arretsEnCours.current[actif.id]) {
        arretsEnCours.current[actif.id] = true;
        const patch = { fin: finAutoService(actif), arretAuto: true, motifArret: "pointage" };
        setPointageDu(null);
        updateDoc(doc(db, "services", actif.id), patch).then(() => {
          setServices((prev) => prev.map((x) => (x.id === actif.id ? { ...x, ...patch } : x)));
          deleteDoc(doc(db, "en_service", current.id)).then(() => setEnService((prev) => prev.filter((e) => e.id !== current.id))).catch(() => {});
          notifierDiscord("service_fin", `${actif.nom} (n° ${numAgent(actif.matricule)}) — service arrêté : pointage non confirmé`);
        }).catch((e) => { console.error(e); delete arretsEnCours.current[actif.id]; });
      }
      return;
    }
    if (t >= prochainPointage.current[cle]) setPointageDu({ id: actif.id, limite: t + DELAI_REPONSE_POINTAGE_MS });
  }, [current, services, minuteCourante, pointageDu]);
  async function confirmerPointage() {
    if (!pointageDu) return;
    const s = services.find((x) => x.id === pointageDu.id);
    const patch = { dernierPointage: new Date().toISOString(), pointages: ((s && s.pointages) || 0) + 1 };
    setPointageDu(null);
    try {
      await updateDoc(doc(db, "services", pointageDu.id), patch);
      setServices((prev) => prev.map((x) => (x.id === pointageDu.id ? { ...x, ...patch } : x)));
    } catch (e) { console.error(e); setSaveError("Pointage non enregistré : réessaie dans un instant."); }
  }

  // Marqueur « en service » (lu par les règles Firebase pour autoriser la main courante)
  useEffect(() => {
    if (!current) return;
    const actif = services.find((s) => s.matricule === current.matricule && serviceEnCours(s, Date.now()));
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

  // Retour sur la page en cours après un rechargement (mobile : on part chercher un code sur Discord puis on revient)
  const premierPassage = useRef(true);
  useEffect(() => {
    const direct = new URLSearchParams(window.location.search);
    if (direct.get("q") || direct.get("page")) return;
    const s = lirePage("page");
    if (s && s.section && Date.now() - (s.t || 0) < 40 * 60000) {
      if (s.section === "questionnaire" && s.qid) { setQuestionnaireId(s.qid); setConditionsOk(!!s.cond); }
      setPublicSection(s.section);
    }
  }, []);
  useEffect(() => {
    if (premierPassage.current) { premierPassage.current = false; return; }
    if (["plainte", "iggn-form", "questionnaire", "avis-gendarme", "avis-general", "suggestion"].includes(publicSection)) ecrirePage("page", { section: publicSection, qid: questionnaireId, cond: conditionsOk, t: Date.now() });
    else effacerPage("page");
  }, [publicSection, questionnaireId, conditionsOk]);

  // Lien direct vers un questionnaire : https://ton-site.vercel.app/?q=ID
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("q");
    if (id) { setConditionsOk(false); setQuestionnaireId(id); setPublicSection("questionnaire"); }
  }, []);

  // Lien direct vers le code pénal public : https://ton-site.vercel.app/?page=code-penal
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("page") === "code-penal") setPublicSection("cadre-juridique");
  }, []);

  async function refresh() {
    await loadAll(true);
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

  // Gestion du personnel (admin uniquement)
  async function handleCreatePersonnel(data) {
    try {
      const username = (data.username || "").trim();
      if (!username || !data.password) return { ok: false, error: "Identifiant et mot de passe obligatoires." };
      if (data.password.length < 6) return { ok: false, error: "Mot de passe trop court (6 caractères minimum)." };
      const year = new Date().getFullYear();
      // Liste fraîche (pas celle du cache) et numéro jamais réutilisé : on prend le plus grand numéro existant + 1
      let frais = personnel;
      try { frais = await loadCollection("personnel"); } catch (e) { /* on garde la liste en mémoire */ }
      const suffixe = (m) => Number((String(m || "").match(/-(\d+)$/) || [])[1] || 0);
      const rio = genererRIO(frais);
      if (!rio) return { ok: false, error: "Plus de RIO disponible (100 agents maximum)." };
      let n = Math.max(frais.length, ...frais.map((p) => suffixe(p.matricule)), ...sanctions.map((x) => suffixe(x.matricule))) + 1;
      let matricule;
      do { matricule = `GH-${year}-${String(n++).padStart(4, "0")}`; } while (frais.some((p) => p.matricule === matricule));
      const uid = await createAuthUser(usernameToEmail(username), data.password);
      const profile = {
        matricule, cipcNumero: rio, qualiteJudiciaire: qualiteDepuisGrade(data.grade) || data.qualiteJudiciaire || "APJA",
        nom: data.nom.trim(), prenom: data.prenom.trim(), username, pseudoRoblox: data.pseudoRoblox || "", pseudoDiscord: data.pseudoDiscord || "", ...(data.dateNaissance ? { dateNaissance: String(data.dateNaissance).trim() } : {}), ...(data.lieuNaissance ? { lieuNaissance: String(data.lieuNaissance).trim() } : {}), ...(data.discordId ? { discordId: String(data.discordId) } : {}), ...(data.robloxId ? { robloxId: String(data.robloxId), robloxUsername: data.robloxUsername || "", robloxVerifie: true } : {}),
        grade: data.grade, gradeRank: GRADES.indexOf(data.grade), unite: data.unite, fonction: data.fonction || "", sousFonction: data.sousFonction || "", qualifications: [], isAdmin: false,
        creeLe: new Date().toISOString(), essaiStatut: "En cours", essaiFin: finEssai(), ...champsParrain(tirerParrain(personnel, [...GRADES])),
      };
      await setDoc(doc(db, "personnel", uid), profile);
      await setDoc(doc(db, "annuaire_public", uid), { prenom: profile.prenom, nom: profile.nom, pseudoRoblox: profile.pseudoRoblox, pseudoDiscord: profile.pseudoDiscord });
      await refresh();
      logAction("Création de compte", `${profile.prenom} ${profile.nom} (RIO ${rio})`);
      return { ok: true };
    } catch (e) {
      console.error(e);
      const m = String(e.message || "");
      return { ok: false, error: m.includes("EMAIL_EXISTS") ? "Cet identifiant existe déjà." : m.includes("WEAK_PASSWORD") ? "Mot de passe trop court (6 caractères minimum)." : (m || "Erreur lors de la création du compte.") };
    }
  }
  // Période d'essai : parrain, prolongation, titularisation (recruteurs et admins)
  async function handleUpdateEssai(id, patch) {
    try {
      await updateDoc(doc(db, "personnel", id), patch);
      setPersonnel((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      viderCacheSession();
      return true;
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour de la période d'essai."); return false; }
  }
  // Recrutement : crée le compte d'un candidat accepté, puis le note sur sa candidature
  async function handleCreerCompteCandidat(c, data) {
    const res = await handleCreatePersonnel(data);
    if (!res.ok) return res;
    try {
      const patch = { compteCreeLe: new Date().toISOString(), compteCreePar: `${current.prenom} ${current.nom}`, compteIdentifiant: data.username.trim() };
      await updateDoc(doc(db, "candidatures", c.id), patch);
      if (FORMAT_DOSSIER.test(String(c.ref || ""))) await updateDoc(doc(db, "suivi_candidatures", c.ref), { compteCree: true }).catch(() => {});
      setCandidatures((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
      viderCacheSession();
    } catch (e) { console.error(e); }
    return res;
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
      logAction("Modification de compte", `${profile.prenom} ${profile.nom} (n° ${numAgent(profile)})`);
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
      logAction("Suppression de compte", target ? `${target.prenom} ${target.nom} (n° ${numAgent(target)})` : id);
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  // Candidature publique : le compte Roblox doit exister et son casier ne doit contenir ni délit ni crime (les contraventions ne bloquent pas)
  async function verifierCandidatRoblox(pseudo) {
    const at = String(pseudo || "").trim().replace(/^@/, "");
    if (!at) return { ok: false, error: "Renseigne ton pseudo Roblox (nom d'utilisateur exact)." };
    const compte = await resoudreRoblox(at);
    if (!compte) return { ok: false, error: "Compte Roblox introuvable (ou Roblox ne répond pas). Vérifie l'orthographe exacte de ton nom d'utilisateur puis réessaie." };
    let casierComplet; let codePenalComplet;
    try { [casierComplet, codePenalComplet] = await Promise.all([chargerCasierDe(compte), avecCache("code_penal", 10 * 60000, () => loadStrict("code_penal"))]); }
    catch (e) { console.error("Vérification du casier impossible", e); return { ok: false, error: "Impossible de consulter le casier pour le moment. Réessaie dans quelques instants." }; }
    const graves = mentionsGravesDe(casierComplet, compte, codePenalComplet);
    if (graves.length) return { ok: false, error: `Ton casier contient ${graves.length} mention${graves.length > 1 ? "s" : ""} de délit ou de crime : tu ne peux pas déposer de candidature pour le moment. Tu peux consulter ton casier depuis l'accueil, ou contacter le recrutement sur Discord.` };
    return { ok: true, compte };
  }
  // Une personne avec un rôle limité ne gère que les candidatures de ses postes (null = toutes)
  const peutGererCandidature = (c) => { const p = postesCandidaturesGerables(current, roles); return p === null || p.includes(c.poste); };

  // Candidatures (GAV publique, SOG/Officier internes)
  async function handleSubmitCandidature(data, auteur) {
    const nomAuteur = auteur ? `${auteur.prenom} ${auteur.nom}` : "";
    const confirmeConditions = !auteur && conditionsOk;
    const envoi = { ...data, displayName: data.displayName === "Candidat" && nomAuteur ? nomAuteur : data.displayName, ...(confirmeConditions ? { conditionsAcceptees: true, conditionsAccepteesLe: new Date().toISOString() } : {}) };
    try {
      // Envoi via le service protégé (limites anti-spam) : le numéro de dossier est créé côté serveur
      const res = await envoyerPublic("candidature", envoi, { connecte: !!auteur });
      const ref = res.ref;
      const c = { id: res.id, ref, statut: "En attente", createdAt: new Date().toISOString(), auteurMatricule: auteur ? auteur.matricule : null, ...envoi };
      setCandidatures([...candidatures, c]);
      notifierDiscord("candidature", `${c.displayName} — ${c.poste} (${ref})${confirmeConditions ? " — ✅ conditions d'admission confirmées" : ""}`);
      const conf = { title: "Candidature envoyée", message: "Ta candidature a bien été transmise à l'administration. Tu seras recontacté via Discord, et tu peux aussi consulter la réponse avec ton numéro de dossier.", refNumber: ref, dossier: true };
      if (auteur) setConfirmationDash(conf);
      else {
        enregistrerDossierLocal(data.poste, ref);
        setConditionsOk(false);
        setReouverts({});
        setConfirmation(conf);
        setPublicSection("confirmation");
      }
      return { ok: true };
    } catch (e) { console.error(e); const msg = e.message || "Échec de l'envoi, réessaie."; setSaveError(msg); return { ok: false, error: msg }; }
  }
  // Note interne du recrutement sur une candidature (jamais visible du candidat)
  async function handleUpdateCandidatureNote(id, note) {
    const cand = candidatures.find((c) => c.id === id);
    if (!cand || !peutGererCandidature(cand)) { setSaveError("Tu n'as pas le droit de gérer cette candidature."); return false; }
    try {
      const patch = { noteRecruteur: String(note || "").slice(0, 2000), noteParLe: new Date().toISOString(), noteParNom: `${current.grade} ${current.prenom} ${current.nom}` };
      await updateDoc(doc(db, "candidatures", id), patch);
      setCandidatures(candidatures.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleUpdateCandidatureEntretien(id, entretien) {
    const cand = candidatures.find((c) => c.id === id);
    if (!cand || !peutGererCandidature(cand)) { setSaveError("Tu n'as pas le droit de gérer cette candidature."); return false; }
    try {
      const patch = { entretien: { ...entretien, parNom: `${current.grade} ${current.prenom} ${current.nom}`, le: new Date().toISOString() } };
      await updateDoc(doc(db, "candidatures", id), patch);
      setCandidatures(candidatures.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      viderCacheSession();
      return true;
    } catch (e) { console.error(e); return false; }
  }
  // Création automatique du compte d'un candidat accepté (identifiant et mot de passe générés, grade et unité de départ)
  async function creerCompteAutomatique(cand) {
    const info = infosDuCandidat(cand);
    let { prenom, nom } = info;
    if (!prenom || !nom) {
      const morceaux = String(cand.displayName || "").trim().split(/\s+/).filter(Boolean);
      if (morceaux.length >= 2) { prenom = prenom || morceaux[0]; nom = nom || morceaux.slice(1).join(" "); }
    }
    if (!prenom || !nom) return { ok: false, error: "prénom ou nom introuvable dans la candidature" };
    const unitesDispo = Array.from(new Set([UNITE_CMD, UNITE_ENC, ...personnel.map((x) => x.unite)].filter(Boolean)));
    const unite = unitesDispo.includes("Brigade territoriale") ? "Brigade territoriale" : (unitesDispo[0] || "Brigade territoriale");
    const pseudoDiscord = info.pseudoDiscord || cand.discordPseudo || "";
    const base = sansAccentsId(`${prenom}.${nom}`) || "recrue";
    const password = mdpAleatoire(10);
    let username = base; let res = null;
    for (let essai = 0; essai < 4; essai++) {
      username = essai === 0 ? base : `${base}${Math.floor(10 + Math.random() * 90)}`;
      res = await handleCreatePersonnel({ prenom, nom, username, password, grade: GRADES[0], unite, qualiteJudiciaire: "APJA", fonction: "", pseudoRoblox: info.pseudoRoblox, robloxUsername: info.robloxUsername, robloxId: info.robloxId, pseudoDiscord, dateNaissance: info.dateNaissance, lieuNaissance: info.lieuNaissance, discordId: cand.discordId || "" });
      if (res.ok || !/existe d/i.test(res.error || "")) break;
    }
    if (!res || !res.ok) return { ok: false, error: (res && res.error) || "création impossible" };
    const patch = { compteCreeLe: new Date().toISOString(), compteCreePar: "Automatique (recrutement)", compteIdentifiant: username };
    try {
      await updateDoc(doc(db, "candidatures", cand.id), patch);
      if (FORMAT_DOSSIER.test(String(cand.ref || ""))) await updateDoc(doc(db, "suivi_candidatures", cand.ref), { compteCree: true }).catch(() => {});
    } catch (e) { console.error(e); }
    return { ok: true, patch, identifiants: { username, password } };
  }
  // La décision reste interne : le candidat ne la voit qu'après « Publier les réponses » (statutPublie = ce qu'il voit actuellement)
  async function handleUpdateCandidatureStatut(id, statut) {
    const cand = candidatures.find((c) => c.id === id);
    if (!cand) return;
    if (!peutGererCandidature(cand)) { setSaveError("Tu n'as pas le droit de gérer cette candidature."); return; }
    try {
      const dejaPublie = cand.statutPublie !== undefined ? cand.statutPublie : cand.statut;
      const patch = { statut, statutPublie: dejaPublie, archiveLe: null };
      await updateDoc(doc(db, "candidatures", id), patch);
      setCandidatures(candidatures.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  // Publie les décisions : le suivi public (numéro de dossier) prend le statut décidé, et l'archivage de 7 jours démarre à ce moment
  async function handlePublierCandidatures(ids) {
    const maintenant = new Date().toISOString();
    const maj = {};
    let ok = 0; let echecs = 0;
    for (const id of ids) {
      const cand = candidatures.find((c) => c.id === id);
      if (!cand || !peutGererCandidature(cand) || cand.statutPublie === undefined || cand.statutPublie === cand.statut) continue;
      try {
        if (FORMAT_DOSSIER.test(String(cand.ref || ""))) await updateDoc(doc(db, "suivi_candidatures", cand.ref), { statut: cand.statut, updatedAt: maintenant });
        const patch = { statutPublie: cand.statut, publieLe: maintenant, archiveLe: cand.statut !== "En attente" ? maintenant : null };
        await updateDoc(doc(db, "candidatures", id), patch);
        maj[id] = patch; ok++;
      } catch (e) { console.error("Publication impossible pour", cand.ref, e); echecs++; }
    }
    // Candidats acceptés : compte créé, rôle Discord « Militaire Engagé » donné et identifiants envoyés en message privé — tout est automatique
    const roles = { donnes: 0, echecs: [], dms: 0 };
    const comptes = { crees: 0, echecs: [] };
    const aTransmettre = [];
    for (const id of Object.keys(maj)) {
      const cand = candidatures.find((c) => c.id === id);
      if (!cand || cand.statut !== "Acceptée") continue;
      const nom = cand.displayName || cand.ref || id;
      let identifiants = null;
      if (!cand.compteCreeLe) {
        const rc = await creerCompteAutomatique(cand);
        if (rc.ok) { comptes.crees++; identifiants = rc.identifiants; maj[id] = { ...maj[id], ...rc.patch }; }
        else comptes.echecs.push(`${nom} : ${rc.error}`);
      }
      if (cand.roleDiscordLe && !identifiants) continue;
      const r = await attribuerRoleDiscord(id, identifiants);
      if (r && r.ok) {
        if (!cand.roleDiscordLe) roles.donnes++;
        if (r.roleDiscordLe) maj[id] = { ...maj[id], roleDiscordLe: r.roleDiscordLe };
        if (identifiants) { if (r.dm) roles.dms++; else aTransmettre.push({ id, nom, ...identifiants }); }
      } else {
        if (!cand.roleDiscordLe) roles.echecs.push(`${nom} : ${(r && r.message) || "échec"}`);
        if (identifiants) aTransmettre.push({ id, nom, ...identifiants });
      }
    }
    if (ok) setCandidatures((prev) => prev.map((c) => (maj[c.id] ? { ...c, ...maj[c.id] } : c)));
    if (ok) logAction("Publication des réponses de candidature", `${ok} réponse(s)`);
    if (echecs) setSaveError(`${echecs} réponse(s) n'ont pas pu être publiées (règles Firestore ou connexion).`);
    return { ok, echecs, roles, comptes, aTransmettre };
  }
  // Attribution manuelle (ou nouvel essai) du rôle Discord à un candidat accepté
  async function handleRoleDiscord(id) {
    const r = await attribuerRoleDiscord(id);
    if (r && r.ok) setCandidatures((prev) => prev.map((c) => (c.id === id ? { ...c, roleDiscordLe: r.roleDiscordLe || new Date().toISOString() } : c)));
    return r || { ok: false, message: "échec" };
  }

  // Plaintes (publiques)
  async function handleSubmitPlainte(data) {
    try {
      const res = await envoyerPublic("plainte", data);
      const contreGendarme = data.cible === "gendarme" || data.cible === "iggn";
      const versIGGN = data.cible === "iggn";
      if (!contreGendarme) {
        const p = { id: res.id, ref: res.ref, statut: "En attente", source: "en_ligne", createdAt: new Date().toISOString(), ...data, preuves: (data.preuves || []).slice(0, 12) };
        setPlaintes([...plaintes, p]);
      }
      setConfirmation({ title: versIGGN ? "Signalement transmis à l'IGGN" : "Plainte enregistrée", message: versIGGN ? "Ton signalement a bien été transmis à l'Inspection Générale. Il est lu uniquement par les administrateurs et les Référents Déontologie, qui te recontacteront sur Discord. Note bien ton numéro de dossier : il identifie ton signalement." : contreGendarme ? "Ta plainte a bien été transmise au Corps de Commandement et au Référent Déontologie, qui te recontacteront sur Discord. Note bien ton numéro de plainte : il identifie ton dossier." : "Ta plainte a bien été transmise à la gendarmerie. Un OPJ ou la Brigade de Recherche te recontactera sur Discord. Note bien ton numéro de plainte : il identifie ton dossier.", refNumber: res.ref });
      setPublicSection("confirmation");
      return { ok: true, ref: res.ref };
    } catch (e) { console.error(e); const msg = e.message || "Échec de l'envoi, réessaie."; setSaveError(msg); return { ok: false, error: msg }; }
  }
  async function handleUpdatePlainteStatut(id, statut) {
    try {
      const patch = { statut, archiveLe: statut === "Traitée" || statut === "Classée" ? new Date().toISOString() : null };
      await updateDoc(doc(db, "plaintes", id), patch);
      setPlaintes(plaintes.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      if (statut === "Traitée") {
        const pl = plaintes.find((p) => p.id === id);
        if (pl) {
          try {
            const rap = await lierPlainteAuDossier({ ...pl, id });
            if (rap.pieces.length) setDossierPieces((prev) => [...rap.pieces, ...prev]);
            if (rap.ignores.length) setSaveError("Plainte traitée, mais non rattachée à un dossier : " + rap.ignores.join(" ; ") + ".");
          } catch (e1) { console.error("Rattachement au dossier impossible", e1); setSaveError("Plainte traitée, mais elle n'a pas pu être ajoutée au dossier (règles Firestore de la collection « dossier_pieces »)."); }
        }
      }
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleUpdatePlainteGendarme(id, patch) {
    try {
      await updateDoc(doc(db, "plaintes_gendarmes", id), patch);
      setPlaintesGendarmes((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour de la plainte (règles Firestore de « plaintes_gendarmes »)."); }
  }
  async function handleUpdateSignalementIGGN(id, patch) {
    try {
      await updateDoc(doc(db, "signalements_iggn", id), patch);
      setSignalementsIGGN((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour du signalement (règles Firestore de « signalements_iggn »)."); }
  }
  async function handleTakeChargePlainte(id) {
    const data = { prisEnChargeMatricule: current.matricule, prisEnChargeNom: `${current.prenom} ${current.nom}`, prisEnChargeService: estOPJ(current) || current.isAdmin ? "OPJ" : "Brigade de Recherche" };
    try {
      await updateDoc(doc(db, "plaintes", id), data);
      setPlaintes(plaintes.map((p) => (p.id === id ? { ...p, ...data } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de la prise en charge."); }
  }

  // Orientation d'une plainte : OPJ ou Brigade de Recherche
  async function handleOrienterPlainte(id, orientation) {
    try {
      await updateDoc(doc(db, "plaintes", id), { orientation });
      setPlaintes(plaintes.map((p) => (p.id === id ? { ...p, orientation } : p)));
    } catch (e) { console.error(e); setSaveError("Échec de l'orientation de la plainte."); }
  }

  async function handleSaveConditions(texte) {
    const plan = { texte: String(texte || "").slice(0, 6000), updatedAt: new Date().toISOString(), updatedBy: `${current.grade} ${current.prenom} ${current.nom}` };
    try {
      await setDoc(doc(db, "settings", CONDITIONS_DOC), plan);
      setConditionsAdmission(plan);
      logAction("Conditions générales modifiées", plan.texte ? "Publiées" : "Retirées");
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleSaveVigipirate(data) {
    const niveau = [1, 2, 3].includes(Number(data.niveau)) ? Number(data.niveau) : 1;
    const plan = {
      niveau,
      message: String(data.message || "").slice(0, 400),
      explication: String(data.explication || "").slice(0, 1800),
      consignesCivils: String(data.consignesCivils || "").slice(0, 2800),
      consignesGendarmes: String(data.consignesGendarmes || "").slice(0, 2800),
      updatedAt: new Date().toISOString(),
      updatedBy: `${current.grade} ${current.prenom} ${current.nom}`,
    };
    try {
      await setDoc(doc(db, "settings", VIGIPIRATE_DOC), plan);
      setVigipirate(plan);
      logAction("Plan Vigipirate modifié", `Niveau ${niveau}`);
      return true;
    } catch (e) { console.error(e); return false; }
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

  // Grades, unités et seuils (réglages enregistrés dans settings/general)
  async function handleSaveReglages({ grades, gradesTags, unites, unitesCommandement = [], unitesEncadrement = [], seuils, renomGrades, renomUnites }) {
    try {
      await setDoc(doc(db, "settings", "general"), { grades, gradesTags, unites, unitesCommandement, unitesEncadrement, ...seuils, seuilHautRang: grades.indexOf(seuils.seuilHaut) }, { merge: true });
      await Promise.all(personnel.map(async (p) => {
        const g = renomGrades[p.grade] || p.grade;
        const u = renomUnites[p.unite] || p.unite;
        const rank = grades.indexOf(g);
        if (g !== p.grade || u !== p.unite || rank !== p.gradeRank) await updateDoc(doc(db, "personnel", p.id), { grade: g, unite: u, gradeRank: rank, ...(g !== p.grade && qualiteDepuisGrade(g) ? { qualiteJudiciaire: qualiteDepuisGrade(g) } : {}) });
      }));
      appliquerReglages({ grades, gradesTags, unites, unitesCommandement, unitesEncadrement, ...seuils });
      await loadAll(true);
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
    if (services.some((s) => s.matricule === current.matricule && serviceEnCours(s, Date.now()))) return;
    const debutIso = new Date().toISOString();
    const s = { type: "service", matricule: current.matricule, nom: `${current.prenom} ${current.nom}`, debut: debutIso, fin: null, pointage: true, dernierPointage: debutIso, pointages: 0 };
    try {
      const ref = await addDoc(collection(db, "services"), s);
      setServices((prev) => [...prev, { id: ref.id, ...s }]);
      notifierDiscord("service_debut", `${s.nom} (n° ${numAgent(s.matricule)}) prend son service`);
      try {
        await setDoc(doc(db, "en_service", current.id), { matricule: current.matricule, nom: s.nom, debut: s.debut });
        setEnService((prev) => (prev.some((e) => e.id === current.id) ? prev : [...prev, { id: current.id }]));
      } catch (e2) { console.error(e2); }
    } catch (e) { console.error(e); setSaveError("Impossible de prendre le service, réessaie."); }
  }
  async function handleStopService(id, forcePar, extra) {
    const finIso = new Date().toISOString();
    let bonus = {};
    if (extra && !forcePar) {
      // Activité réelle pendant le service : PV et comptes rendus rédigés entre la prise et la fin
      const t = services.find((x) => x.id === id);
      const d0 = t ? new Date(t.debut).getTime() : 0;
      const dans = (iso) => { const v = new Date(iso).getTime(); return v >= d0 && v <= Date.now(); };
      const nbPV = pvs.filter((p) => p.auteurMatricule === current.matricule && p.createdAt && dans(p.createdAt)).length;
      const nbCR = comptesRendus.filter((c) => (c.auteurUid === current.id || c.auteurMatricule === current.matricule) && c.createdAt && dans(c.createdAt)).length;
      bonus = { resume: String(extra.resume || "").trim().slice(0, 600), activite: nbPV + nbCR };
    }
    const patch = { fin: finIso, ...bonus, ...(forcePar ? { force: true, forcePar } : {}) };
    try {
      await updateDoc(doc(db, "services", id), patch);
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      const t = services.find((s) => s.id === id);
      if (t) notifierDiscord("service_fin", `${t.nom} (n° ${numAgent(t.matricule)}) termine son service — ${fmtDuree(new Date(patch.fin) - new Date(t.debut))}${forcePar ? " (arrêt forcé par " + forcePar + ")" : ""}`);
      if (forcePar) logAction("Service", `Arrêt forcé du service de ${t ? t.nom : id}`);
      if (t) {
        const duree = fmtDuree(new Date(patch.fin) - new Date(t.debut));
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
    viderCacheSession(); // la liste des PV en cache doit être relue au prochain chargement
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
      return saved;
    } catch (e) { console.error(e); return null; }
  }
  async function handleVisaPV(id, observations) {
    viderCacheSession(); // la liste des PV en cache doit être relue au prochain chargement
    const visa = { par: `${current.prenom} ${current.nom}`, grade: current.grade, rio: current.cipcNumero || "", le: new Date().toISOString(), observations: observations || "" };
    try {
      // Le visa vaut signature : le PV est transmis automatiquement au Palais de justice
      const patch = { traite: true, traitePar: visa.par, visa, archiveLe: visa.le, transmisJustice: true, transmisLe: visa.le, transmisPar: visa.par, transmisAuto: true };
      await updateDoc(doc(db, "pv", id), patch);
      setPvs((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      logAction("PV visé", id);
      // Le PV est copié (résumé) dans le dossier de chaque personne citée avec un pseudo Roblox : il survivra à la suppression automatique
      const pvVise = pvs.find((p) => p.id === id);
      if (pvVise) {
        try {
          const rap = await lierPVAuxDossiers({ ...pvVise, id }, visa);
          if (rap.pieces.length) setDossierPieces((prev) => [...rap.pieces, ...prev]);
          if (rap.ignores.length) setSaveError("PV visé, mais non rattaché au dossier de : " + rap.ignores.join(" ; ") + ".");
        } catch (e1) { console.error("Rattachement au dossier impossible", e1); setSaveError("PV visé, mais il n'a pas pu être ajouté au dossier de la personne (règles Firestore de la collection « dossier_pieces »)."); }
      }
      return true;
    } catch (e) { console.error(e); setSaveError("Échec du visa (réservé aux OPJ)."); return false; }
  }
  async function handleTransmettrePV(id) {
    viderCacheSession(); // la liste des PV en cache doit être relue au prochain chargement
    try {
      const maintenant = new Date().toISOString();
      const patch = { transmisJustice: true, transmisLe: maintenant, transmisPar: `${current.grade ? current.grade + " " : ""}${current.prenom} ${current.nom}`, archiveLe: maintenant };
      await updateDoc(doc(db, "pv", id), patch);
      setPvs((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      logAction("PV transmis au Palais de justice", id);
      return true;
    } catch (e) { console.error(e); setSaveError("Échec de la transmission (réservée aux OPJ)."); return false; }
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
      logAction("Candidatures", `${list.length} candidature(s) enregistrée(s)`);
      return true;
    } catch (e) { console.error(e); setSaveError("Échec de l'enregistrement des candidatures."); return false; }
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
    try {
      const res = await envoyerPublic("avis_gendarme", data);
      setAvisGendarmes([...avisGendarmes, { id: res.id, ...data, createdAt: new Date().toISOString() }]);
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false, error: e.message || "Échec de l'envoi, réessaie." }; }
  }

  // Avis généraux sur la gendarmerie
  async function handleSubmitAvisGeneral(data) {
    try {
      const res = await envoyerPublic("avis_general", data);
      setAvisGeneraux([...avisGeneraux, { id: res.id, ...data, createdAt: new Date().toISOString() }]);
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false, error: e.message || "Échec de l'envoi, réessaie." }; }
  }

  // Suggestions (lecture réservée DGGN)
  async function handleSubmitSuggestion(data) {
    try {
      const res = await envoyerPublic("suggestion", data);
      setSuggestions([...suggestions, { id: res.id, ...data, createdAt: new Date().toISOString() }]);
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false, error: e.message || "Échec de l'envoi, réessaie." }; }
  }

  // Sanctions disciplinaires (Commandant et grades supérieurs)
  async function handleIssueSanction(data) {
    const dateDebut = new Date();
    const dateFin = new Date(dateDebut.getTime() + Number(data.dureeJours) * 24 * 60 * 60 * 1000);
    const roleDiscordId = (sanctionRoles && sanctionRoles[data.type]) || "";
    const s = {
      matricule: data.matricule,
      cibleUid: data.cibleUid || "",
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
      logAction("Sanction émise", `${s.type} — ${s.nomCible} (n° ${numAgent(s.matricule)})`);
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
  // Un membre du Palais de justice modifie son propre nom, prénom et compte Roblox
  async function handleSaveProfilJustice(patch) {
    try {
      await updateDoc(doc(db, "personnel", current.id), patch);
      setCurrent((c) => ({ ...c, ...patch }));
      setPersonnel((prev) => prev.map((p) => (p.id === current.id ? { ...p, ...patch } : p)));
      return true;
    } catch (e) { console.error(e); return false; }
  }
  async function handleSaveLiens({ discord, roblox, justice }) {
    try {
      await setDoc(doc(db, "settings", "general"), { lienDiscord: discord, lienJustice: justice || "" }, { merge: true });
      await setDoc(doc(db, "liens_internes", "roblox"), { url: roblox });
      setLienDiscord(discord); setLienRoblox(roblox); setLienJustice(justice || "");
      logAction("Liens utiles", `Discord ${discord ? "renseigné" : "vide"}, Communauté Roblox ${roblox ? "renseigné" : "vide"}`);
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
      await updateDoc(doc(db, "personnel", targetPersonnel.id), { grade: nouveauGrade, gradeRank: GRADES.indexOf(nouveauGrade), qualiteJudiciaire: qualiteDepuisGrade(nouveauGrade) || targetPersonnel.qualiteJudiciaire || "APJA" });
      const docRef = await addDoc(collection(db, "promotions"), p);
      setPromotions([...promotions, { id: docRef.id, ...p }]);
      await refresh();
      logAction(type, `${p.nomCible} : ${ancienGrade} → ${nouveauGrade}`);
      syncGradeDiscord(targetPersonnel.id).then((j) => { if (j && j.alerte) setSaveError("Grade modifié sur le site, mais Discord : " + j.message); });
      return { ok: true };
    } catch (e) { console.error(e); return { ok: false, error: "Échec de l'opération." }; }
  }

  // Règlements (cases créées/modifiables par l'admin)
  async function handleCreateReglement(data) {
    const now = new Date().toISOString();
    const r = { titre: data.titre.trim(), contenu: data.contenu, audience: data.audience || "gendarmes", categorie: (data.categorie || "").trim(), rubrique: data.rubrique === "code" ? "code" : "reglement", ordre: Date.now(), createdAt: now, updatedAt: now };
    try {
      viderCache("reglements-g"); const docRef = await addDoc(collection(db, "reglements"), r);
      setReglements([...reglements, { id: docRef.id, ...r }]);
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
      logAction("Règlement créé", data.titre);
    } catch (e) { console.error(e); setSaveError("Échec de la création."); }
  }
  async function handleUpdateReglement(id, data) {
    const r = { titre: data.titre.trim(), contenu: data.contenu, audience: data.audience || "gendarmes", categorie: (data.categorie || "").trim(), rubrique: data.rubrique === "code" ? "code" : "reglement", updatedAt: new Date().toISOString() };
    try {
      viderCache("reglements-g"); await updateDoc(doc(db, "reglements", id), r);
      setReglements(reglements.map((x) => (x.id === id ? { ...x, ...r } : x)));
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
      logAction("Règlement modifié", data.titre);
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleMoveReglement(id, dir, rubrique = "reglement") {
    const liste = trierReglements(reglements).filter((x) => (rubrique === "code" ? x.rubrique === "code" : x.rubrique !== "code"));
    const i = liste.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= liste.length) return;
    const nouvelle = liste.slice();
    [nouvelle[i], nouvelle[j]] = [nouvelle[j], nouvelle[i]];
    // On renumérote proprement (0, 1, 2…) pour que l'ordre reste stable
    const changes = nouvelle.map((x, k) => ({ x, k })).filter(({ x, k }) => x.ordre !== k);
    try {
      viderCache("reglements-g"); await Promise.all(changes.map(({ x, k }) => updateDoc(doc(db, "reglements", x.id), { ordre: k })));
      const ordres = {}; nouvelle.forEach((x, k) => { ordres[x.id] = k; });
      setReglements(reglements.map((x) => (ordres[x.id] !== undefined ? { ...x, ordre: ordres[x.id] } : x)));
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
    } catch (e) { console.error(e); setSaveError("Échec du déplacement."); }
  }
  async function handleDeleteReglement(id) {
    try {
      viderCache("reglements-g"); await deleteDoc(doc(db, "reglements", id));
      setReglements(reglements.filter((r) => r.id !== id));
      setReglementsPublic(null); dejaCharge.current.reglementsPublic = false;
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }

  async function handleCreateRole(data) {
    try {
      viderCache("roles"); const docRef = await addDoc(collection(db, "roles"), data);
      setRoles([...roles, { id: docRef.id, ...data }]);
      logAction("Création de rôle", data.nom);
    } catch (e) { console.error(e); setSaveError("Échec de la création du rôle."); }
  }
  // Recalcule les droits (qualifications + admin) de toutes les personnes qui ont ce rôle
  async function recalculerDroitsPourRole(roleId, rolesApres) {
    const concernes = personnel.filter((x) => (x.roles || []).includes(roleId));
    const maj = {};
    for (const x of concernes) {
      const rolesPerso = (x.roles || []).filter((r) => rolesApres.some((ro) => ro.id === r));
      const droits = calculerDroits(rolesPerso, rolesApres, x.qualifsManuelles !== undefined ? x.qualifsManuelles : (x.qualifications || []), x.adminManuel !== undefined ? x.adminManuel : !!x.isAdmin);
      const patch = { roles: rolesPerso, qualifications: droits.qualifications, isAdmin: droits.isAdmin };
      await updateDoc(doc(db, "personnel", x.id), patch);
      maj[x.id] = patch;
    }
    if (concernes.length) {
      setPersonnel((prev) => prev.map((x) => (maj[x.id] ? { ...x, ...maj[x.id] } : x)));
      if (current && maj[current.id]) setCurrent({ ...current, ...maj[current.id] });
    }
    return concernes.length;
  }
  async function handleUpdateRole(id, data) {
    try {
      viderCache("roles"); await updateDoc(doc(db, "roles", id), data);
      const rolesApres = roles.map((r) => (r.id === id ? { ...r, ...data } : r));
      setRoles(rolesApres);
      const n = await recalculerDroitsPourRole(id, rolesApres);
      logAction("Modification de rôle", `${data.nom}${n ? ` (${n} personne(s) mise(s) à jour)` : ""}`);
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour du rôle."); }
  }
  async function handleDeleteRole(id) {
    try {
      const rolesApres = roles.filter((r) => r.id !== id);
      await recalculerDroitsPourRole(id, rolesApres);
      viderCache("roles"); await deleteDoc(doc(db, "roles", id));
      setRoles(rolesApres);
    } catch (e) { console.error(e); setSaveError("Échec de la suppression du rôle."); }
  }

  async function handleAddArticle(data) {
    try {
      viderCache("code_penal"); const docRef = await addDoc(collection(db, "code_penal"), data);
      setCodePenal([...codePenal, { id: docRef.id, ...data }]);
    } catch (e) { console.error(e); setSaveError("Échec de l'ajout, réessaie."); }
  }
  async function handleUpdateArticle(id, data) {
    try {
      viderCache("code_penal"); await updateDoc(doc(db, "code_penal", id), data);
      setCodePenal(codePenal.map((a) => (a.id === id ? { ...a, ...data } : a)));
    } catch (e) { console.error(e); setSaveError("Échec de la mise à jour."); }
  }
  async function handleDeleteArticle(id) {
    try {
      viderCache("code_penal"); await deleteDoc(doc(db, "code_penal", id));
      setCodePenal(codePenal.filter((a) => a.id !== id));
    } catch (e) { console.error(e); setSaveError("Échec de la suppression."); }
  }
  async function handleAddCasier(data, auteur) {
    viderCacheSession(); // le casier en cache doit être relu
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
    } catch (e) {
      console.error(e);
      if (estErreurQuota(e) && auth.currentUser) {
        // Base saturée : la mention est gardée sur cet appareil et sera enregistrée automatiquement plus tard
        ajouterFile({ kind: "casier", type: "casier", auteurUid: auth.currentUser.uid, payload: { robloxId, robloxUsername, pseudoRoblox, nom, prenom, mention } });
        try { window.dispatchEvent(new Event("gn-file-maj")); } catch (x) { /* rien */ }
        if (existing) setCasier(casier.map((d) => (d.id === existing.id ? { ...d, mentions: [...d.mentions, mention], enAttente: true } : d)));
        else setCasier([...casier, { id: `local-${mention.id}`, pseudoRoblox, pseudoDiscord: "", robloxId, robloxUsername, robloxDisplayName: pseudoRoblox, nom, prenom, mentions: [mention], enAttente: true }]);
        setSaveError("⏳ La base de données est saturée : la mention est conservée sur cet appareil et sera enregistrée automatiquement (garde ce navigateur). Inutile de la refaire.");
      } else setSaveError("Échec de l'enregistrement, réessaie.");
    }
  }
  async function handleDeletePiece(id) {
    viderCacheSession(); // le casier en cache doit être relu
    try {
      await supprimerPiece(id);
      setDossierPieces((prev) => prev.filter((p) => p.id !== id));
      logAction("Retrait d'une pièce du dossier", id);
    } catch (e) { console.error(e); setSaveError("Échec du retrait de la pièce."); }
  }
  async function handleUpdateCasierMention(dossierId, mentionId, data) {
    viderCacheSession(); // le casier en cache doit être relu
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
    viderCacheSession(); // le casier en cache doit être relu
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
        {discordEnCours.current ? "Connexion avec Discord en cours…" : "Chargement…"}
      </div>
    );
  }

  const questionnairesPublics = questionnaires.filter((q) => q.visibilite === "public" && estOuverte(q));
  const questionnairesInternes = questionnaires.filter((q) => q.visibilite === "interne" && estOuverte(q) && peutAcceder(q, current));
  // Modèles de PV : liste dédiée ; à défaut, reprise des anciens modèles créés dans les questionnaires
  const modelesPVListe = modelesPVState || questionnaires.filter((q) => q.visibilite === "pv").map((q) => ({
    id: q.id, titre: q.titre, type: "Autre", serie: "PV", visa: "", actif: !!q.actif,
    sections: (q.sections || []).map((s) => ({ id: s.id, title: s.title, fields: (s.fields || []).map((f) => ({ key: f.key, label: f.label, type: f.type || "text", required: !!f.required, options: f.options || [] })) })),
  }));
  const modelesPVActifs = modelesPVListe.filter((m) => m.actif);
  const modelesPV = modelesPVActifs.some((m) => m.type === "Plainte" || /plainte/i.test(m.titre || "")) ? modelesPVActifs : [...modelesPVActifs, MODELE_PLAINTE_DEFAUT];

  if (view === "public") {
  const pageCivile = (() => {
    if (publicSection === "home") return <PublicHome onNavigate={(s) => (s === "login" ? setView("login") : s === "creer-compte" ? setView("creer-compte") : setPublicSection(s))} recrutementOuvert={recrutementOuvert} nbQuestionnaires={questionnairesPublics.length} lienDiscord={lienDiscord} lienJustice={lienJustice} />;
    if (publicSection === "hierarchie") return <HierarchiePublique onCancel={() => setPublicSection("home")} />;
    if (publicSection === "plainte") return <PlainteForm onSubmit={handleSubmitPlainte} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "iggn") return <IGGNPresentation onStart={() => setPublicSection("iggn-form")} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "iggn-form") return <PlainteForm iggn onSubmit={handleSubmitPlainte} onCancel={() => setPublicSection("iggn")} />;
    if (publicSection === "suivi-candidature") return <SuiviCandidaturePublic onCancel={() => setPublicSection("home")} onCreerCompte={() => setView("creer-compte")} />;
    if (publicSection === "questionnaires" || publicSection === "candidature")
      return <EspaceCandidat liste={questionnairesPublics} recrutementOuvert={recrutementOuvert} onOpen={(id) => { setConditionsOk(false); setQuestionnaireId(id); setPublicSection("questionnaire"); window.scrollTo(0, 0); }} onCancel={() => setPublicSection("home")} onSuivi={() => setPublicSection("suivi-candidature")} />;
    // Un questionnaire public : écran des conditions d'admission, puis formulaire en étapes
    const rendreQuestionnairePublic = (q) => {
      const posteQ = q ? (q.poste || q.titre) : "";
      const dejaQ = posteQ ? lireDossiersLocaux()[posteQ] : null;
      if (q && dejaQ && !reouverts[posteQ]) return <DejaPostule poste={posteQ} numero={dejaQ.numero} onCancel={() => setPublicSection("home")} onNouvelle={() => { oublierDossierLocal(posteQ); setReouverts({ ...reouverts, [posteQ]: true }); }} />;
      if (!q || !estOuverte(q)) return <QuestionnaireFerme onBack={() => setPublicSection("home")} />;
      const generales = q.conditions !== false && aDesConditions(conditionsAdmission);
      const propres = !!String(q.conditionsPropres || "").trim();
      const avecConditions = generales || propres;
      if (avecConditions && !conditionsOk) return <ParcoursConditions q={q} texteGeneral={generales ? conditionsAdmission.texte : ""} onConfirm={() => { setConditionsOk(true); window.scrollTo(0, 0); }} onCancel={() => setPublicSection("questionnaires")} />;
      return (
        <>
        {avecConditions && <BandeauConditionsConfirmees />}
        <ApplicationForm
          key={q.id}
          title={q.titre}
          intro={q.intro}
          sections={sectionsDe(q)}
          poste={q.poste || q.titre}
          diag={`conditions : ${conditionsErr ? "erreur de lecture (" + conditionsErr + ")" : aDesConditions(conditionsAdmission) ? "publiées" : conditionsAdmission ? "document vide" : "aucune trouvée"}`}
          verifierCompte={verifierCandidatRoblox}
          onSubmit={(data) => handleSubmitCandidature(data)}
          onCancel={() => { setConditionsOk(false); setPublicSection("home"); }}
        />
        </>
      );
    };
    if (publicSection === "questionnaire") return rendreQuestionnairePublic(questionnaires.find((x) => x.id === questionnaireId && x.visibilite === "public"));
    if (publicSection === "documents") return <DocumentsPublic onNavigate={(s) => setPublicSection(s)} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "casier-public") return <CasierPublicLookup casier={casier} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "reglements") return <ReglementsPublic reglements={reglementsPublic} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "code-penal" || publicSection === "cadre-juridique") return <CadreJuridiquePublic codePenal={codePenal} reglements={reglementsPublic} onCancel={() => setPublicSection("home")} />;
    if (publicSection === "avis-gendarme") return <PorteComptes titre="Avis sur un agent" icone="👮" couleur="#2E7D4F" sous="Félicitez ou commentez le comportement d'un gendarme. Réservé aux civils : les gendarmes ne peuvent pas donner d'avis sur un autre gendarme." onCancel={() => setPublicSection("home")}>{(l) => <AvisGendarmeForm onSubmit={(d) => handleSubmitAvisGendarme({ ...d, ...l })} onCancel={() => setPublicSection("home")} />}</PorteComptes>;
    if (publicSection === "avis-general") return <PorteComptes titre="Avis sur la brigade" icone="⭐" couleur="#B7791F" sous="Notez la gendarmerie et dites-nous ce que vous en pensez." onCancel={() => setPublicSection("home")}>{(l) => <AvisGeneralForm onSubmit={(d) => handleSubmitAvisGeneral({ ...d, ...l })} onCancel={() => setPublicSection("home")} />}</PorteComptes>;
    if (publicSection === "suggestion") return <PorteComptes titre="Faire une suggestion" icone="💡" couleur="#7B3FA0" sous="Une idée pour améliorer la gendarmerie ou le site ? Écrivez-nous." onCancel={() => setPublicSection("home")}>{(l) => <SuggestionForm onSubmit={(d) => handleSubmitSuggestion({ ...d, ...l })} onCancel={() => setPublicSection("home")} />}</PorteComptes>;
    if (publicSection === "confirmation" && confirmation) {
      return <Confirmation {...confirmation} onBack={() => { setPublicSection("home"); setConfirmation(null); }} onSuivi={() => { setPublicSection("suivi-candidature"); setConfirmation(null); }} />;
    }
  })();
  if (pageCivile) return (<><BandeauVigipirate plan={vigipirate} mode="civil" variante="barre" compact={publicSection !== "home"} />{bandeauFile}{pageCivile}</>);
  }

  if (view === "creer-compte") return <CreerCompteScreen onBack={() => setView("public")} onLogin={() => setView("login")} />;
  if (view === "login") {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onBack={() => setView("public")}
        onCreerCompte={() => setView("creer-compte")}
        blockedMsg={loginBlockedMsg}
      />
    );
  }

  // view === "dashboard"
  if (!current) { setView("public"); return null; }

  if (confirmationDash) {
    return <Confirmation {...confirmationDash} onBack={() => { setConfirmationDash(null); setDashSection("dossier"); }} />;
  }

  // Candidatures visibles pour la personne connectée (un rôle peut être limité à certains postes) et choix proposés dans les rôles
  const postesGerables = postesCandidaturesGerables(current, roles);
  const candidaturesVisibles = postesGerables === null ? candidatures : candidatures.filter((c) => postesGerables.includes(c.poste));
  const postesCandidature = Array.from(new Set([...questionnaires.filter((q) => q.visibilite !== "pv").map((q) => q.poste || q.titre), ...candidatures.map((c) => c.poste)].filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "fr"));

  const compteurs = {
    candidatures: candidaturesVisibles.filter((c) => c.statut === "En attente").length,
    plaintes: plaintes.filter((p) => p.statut === "En attente").length + pvs.filter((p) => estPVPlainte(p) && !p.traite).length,
    plaintesGendarmes: plaintesGendarmes.filter((p) => p.statut === "En attente").length,
    signalementsIGGN: signalementsIGGN.filter((p) => p.statut === "En attente").length,
    cr: crAFaire.length,
    rapports: (current.isAdmin || estCommandement(current.unite)) ? rapportsInternes.filter((r) => r.statut === "Nouveau").length : 0,
    questionnaires: questionnairesInternes.length,
    pv: pvs.filter((p) => !p.traite).length,
  };
  const estOPJTaches = !estPalaisJustice(current) && (current.isAdmin || estOPJ(current));
  const tachesListe = construireTaches({
    current, isAdmin: !!current.isAdmin, estOPJ: estOPJTaches, estBR: (current.qualifications || []).includes("Brigade de Recherche"),
    estRecruteur: current.isAdmin || (current.qualifications || []).includes("Recruteur"),
    estCorpsOuAdmin: current.isAdmin || estCorps(current.unite),
    estCommandementOuAdmin: current.isAdmin || estCommandement(current.unite),
    compteurs, pvs, crAFaire: crAFaire.length,
    essaisEcheance: personnel.filter((p) => enEssai(p) && joursRestants(p.essaiFin) !== null && joursRestants(p.essaiFin) <= 1).length,
    sanctionsActives: sanctionsActivesDe(sanctions, current).length,
  });
  compteurs.taches = tachesListe.reduce((n, t) => n + t.nombre, 0);
  compteurs.filleuls = personnel.filter((p) => enEssai(p) && p.parrainMatricule && p.parrainMatricule === current.matricule).length;
  const parcoursRecrue = estPalaisJustice(current) ? null : construireParcours({
    current,
    aMotDePasse: !!(auth.currentUser && auth.currentUser.providerData && auth.currentUser.providerData.some((x) => x.providerId === "password")),
    aPrisService: services.some((x) => x.matricule === current.matricule) || enService.some((x) => x.id === current.id || x.matricule === current.matricule),
  });
  const menuDash = construireMenu(current, !!current.isAdmin, compteurs);
  const itemDash = menuDash.flatMap((g) => g.items).find((it) => it.id === dashSection);
  const titreSection = itemDash ? itemDash.label.replace(/ \(\d+\)$/, "") : dashSection === "accueil" ? "Accueil" : dashSection.startsWith("postuler") ? "Candidature" : "Pulsar RP";
  const serviceActif = services.find((s) => s.matricule === current.matricule && serviceEnCours(s, Date.now()));
  // Information affichée une fois : un service précédent a été arrêté automatiquement
  const serviceAutoArrete = services.find((s) => s.matricule === current.matricule && s.arretAuto === true && s.fin && Date.now() - new Date(s.fin).getTime() < 3 * 86400000 && (() => { try { return !window.localStorage.getItem(`pulsar_arret_auto_vu_${s.id}`); } catch (e) { return true; } })()) || null;

  return (
    <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", background: "#E9EFF7", minHeight: "100vh" }}>
      {(() => {
        // Connecté avec Discord et sans identifiant/mot de passe : on propose d'en créer (une fois par session si « Plus tard »)
        const u = auth.currentUser;
        const aDejaMdp = !!(u && u.providerData && u.providerData.some((x) => x.providerId === "password"));
        let reporte = false;
        try { reporte = window.sessionStorage.getItem("gn_ident_plus_tard") === "1"; } catch (e) { /* rien */ }
        if (!u || aDejaMdp || identifiantsFaits) return null;
        // Obligatoire : après la première connexion Discord, le gendarme crée son identifiant et son mot de passe (il ne repassera plus par Discord)
        return <ModalIdentifiants auth={auth} current={current} obligatoire onFini={(cree) => { if (cree) setIdentifiantsFaits(true); }} />;
      })()}
      {mobile && menuOuvert && <div onClick={() => setMenuOuvert(false)} style={{ position: "fixed", inset: 0, background: "rgba(7,20,46,0.55)", zIndex: 400 }} />}
      <Sidebar
        mobile={mobile}
        ouvert={menuOuvert}
        onClose={() => setMenuOuvert(false)}
        current={current}
        section={dashSection}
        setSection={(s) => { setDashSection(s); setMenuOuvert(false); window.scrollTo(0, 0); }}
        isAdmin={!!current.isAdmin}
        lienDiscord={lienDiscord}
        lienRoblox={lienRoblox}
        lienJustice={lienJustice}
        onLogout={async () => { try { await signOut(auth); } catch (e) {} setView("public"); setPublicSection("home"); }}
        counts={compteurs}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <DashTopBar current={current} titre={titreSection} actif={serviceActif} mobile={mobile} onMenu={() => setMenuOuvert(true)} onHome={() => { setDashSection("accueil"); setMenuOuvert(false); window.scrollTo(0, 0); }} accueilActif={dashSection === "accueil"} />
      <div style={{ flex: 1, padding: dashSection.startsWith("postuler") ? 0 : mobile ? "16px 14px 90px" : "32px 40px" }}>
        {bandeauFile && <div style={{ margin: "-10px -14px 4px" }}>{bandeauFile}</div>}
        {quotaAtteint && <div style={{ background: "#FFF6DD", border: "1px solid #E6C766", color: "#6B4E00", borderRadius: 10, padding: "12px 16px", fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>⏳ <b>Le site est très sollicité en ce moment</b> : la limite quotidienne de la base de données est atteinte, certaines listes peuvent s'afficher vides. Ce n'est pas une panne : tout revient automatiquement à la remise à zéro du quota (dans la nuit). <button type="button" onClick={() => window.location.reload()} style={{ marginLeft: 8, background: "none", border: "none", color: "#6B4E00", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>Réessayer</button></div>}
        {saveError && <div style={{ color: "#C0172D", fontSize: 12, margin: mobile ? "0 0 10px" : "14px 0 0 40px" }}>{saveError}</div>}
        {!estPalaisJustice(current) && !dashSection.startsWith("postuler") && dashSection !== "vigipirate" && <div style={{ marginBottom: mobile ? 14 : 22 }}><BandeauVigipirate plan={vigipirate} mode="gendarme" peutModifier={peutModifierVigipirate(current)} onModifier={() => { setDashSection("vigipirate"); window.scrollTo(0, 0); }} /></div>}
        {dashSection === "essai" && <EssaiPage personnel={personnel} current={current} onUpdate={handleUpdateEssai} />}
        {dashSection === "compte" && <MonComptePage auth={auth} current={current} />}
        {dashSection === "taches" && !estPalaisJustice(current) && <TachesPage taches={tachesListe} parcours={parcoursRecrue} prenom={current.prenom} onOpen={(sec) => { setDashSection(sec); window.scrollTo(0, 0); }} />}
        {dashSection === "dossier" && (
          <div>
            {(() => {
              const now = new Date();
              const mesSanctionsActives = sanctionsActivesDe(sanctions, current, now);
              const heure = now.getHours();
              const salutation = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
              const isRecruteurOuAdmin = current.isAdmin || (current.qualifications || []).includes("Recruteur");
              const isOpjOuAdmin = current.isAdmin || estOPJ(current) || (current.qualifications || []).includes("Brigade de Recherche");
              const stats = [
                isRecruteurOuAdmin && { label: "Candidatures en attente", value: candidaturesVisibles.filter((c) => c.statut === "En attente").length },
                isOpjOuAdmin && { label: "Plaintes en attente", value: plaintes.filter((p) => p.statut === "En attente").length + pvs.filter((p) => estPVPlainte(p) && !p.traite).length },
                { label: "Personnel enregistré", value: personnel.length },
              ].filter(Boolean);
              return (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontFamily: "'Barlow Semi Condensed', 'Inter', sans-serif", fontSize: 26, fontWeight: 700, color: "#14213A" }}>{salutation}, {current.prenom} 👋</div>
                    <div style={{ fontSize: 13, color: "#5A6B84", marginTop: 4 }}>{current.grade} — {current.unite}{current.fonction ? ` — ${current.fonction}` : ""}</div>
                  </div>
                  {serviceAutoArrete && (
                    <div style={{ background: "#FFF4E0", border: "1px solid #E8A33A", color: "#6B4E00", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, lineHeight: 1.55 }}>
                      <b>⏱ Service arrêté automatiquement.</b> Ton service du {new Date(serviceAutoArrete.debut).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} {serviceAutoArrete.motifArret === "pointage" ? "a été arrêté faute de confirmation de ta présence (pointage) : seul le temps validé jusqu'à ton dernier pointage est compté. Pendant un service, reste sur le site et réponds au pointage « Je suis là »." : "n'avait pas été terminé : il a été arrêté automatiquement (un service dure 3 h maximum). Pense à terminer ton service quand tu as fini."}
                      <div><button onClick={() => { try { window.localStorage.setItem(`pulsar_arret_auto_vu_${serviceAutoArrete.id}`, "1"); } catch (e) { /* tant pis */ } setMinuteCourante((x) => x + 1); }} style={{ background: "#B25E00", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>J'ai compris</button></div>
                    </div>
                  )}
                  <ParcoursRecrue parcours={parcoursRecrue} compact onOpen={(sec) => { setDashSection(sec); window.scrollTo(0, 0); }} />
                  {tachesListe.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: "#5A6B84", fontWeight: 700, marginBottom: 8 }}>À faire ({compteurs.taches})</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {tachesListe.slice(0, 3).map((t) => <TachesCarte key={t.id} tache={t} onOpen={(sec) => { setDashSection(sec); window.scrollTo(0, 0); }} />)}
                        {tachesListe.length > 3 && <button onClick={() => setDashSection("taches")} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#123A7A", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "2px 0" }}>Voir toutes mes tâches ›</button>}
                      </div>
                    </div>
                  )}
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
            <h2 style={h2Style}>𝐂𝐈𝐏𝐂 — Carte d'Identité Professionnelle et de Circulation</h2>
          <CartePro p={current} onLinked={handleRobloxLinked} />
            <div style={{ marginTop: 40, paddingTop: 24, borderTop: "2px solid #D3DDEA" }}>
              <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: "#5A6B84", fontWeight: 800, marginBottom: 14 }}>Cartes professionnelles de l'équipe</div>
              <CartesProPage personnel={personnel} />
            </div>
          </div>
        )}
        {dashSection === "accueil" && (
          <div>
            <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", background: "radial-gradient(circle at 12% 20%, #1B4A9E, #0A1E45 62%)", color: "#F2F6FC", borderRadius: 20, padding: "22px 26px", marginBottom: 22, boxShadow: "0 24px 50px -28px rgba(7,20,46,0.8)" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, display: "flex" }}><div style={{ flex: 1, background: "#2F6FDE" }} /><div style={{ flex: 1, background: "#FFFFFF" }} /><div style={{ flex: 1, background: "#E5384F" }} /></div>
              <Ecusson taille={78} />
              <div style={{ minWidth: 200, flex: 1 }}>
                <div style={{ fontSize: 10.5, letterSpacing: 3, opacity: 0.7 }}>RÉPUBLIQUE FRANÇAISE — RP</div>
                <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, fontWeight: 700, margin: "4px 0 6px" }}>Bienvenue, {current.grade} {current.nom}</div>
                <div style={{ fontSize: 13, color: "#C9D6EC", lineHeight: 1.5 }}>Gendarmerie Nationale de Nîmes RP — toutes les pages du portail, rangées par catégorie.</div>
              </div>
            </div>
            <PulsarTuiles groups={menuDash} onOpen={setDashSection} inclureCipc />
          </div>
        )}
        {dashSection === "reglements" && (
          <ReglementsPage current={current} reglements={reglements} onCreate={handleCreateReglement} onUpdate={handleUpdateReglement} onDelete={handleDeleteReglement} onMove={handleMoveReglement} />
        )}
        {dashSection === "casier" && <CasierPage current={current} casier={casier} pieces={dossierPieces} onDeletePiece={handleDeletePiece} codePenal={codePenal} onAdd={(data) => handleAddCasier(data, current)} onUpdateMention={handleUpdateCasierMention} onDeleteMention={handleDeleteCasierMention} />}
        {dashSection === "cadre-juridique" && <CadreJuridiquePage current={current} codePenal={codePenal} onAddArticle={handleAddArticle} onUpdateArticle={handleUpdateArticle} onDeleteArticle={handleDeleteArticle} reglements={reglements} onCreate={handleCreateReglement} onUpdate={handleUpdateReglement} onDelete={handleDeleteReglement} onMove={handleMoveReglement} />}
        {dashSection === "code-penal-interne" && <CodePenalPage current={current} codePenal={codePenal} onAdd={handleAddArticle} onUpdate={handleUpdateArticle} onDelete={handleDeleteArticle} />}
        {dashSection === "admin-liens" && current.isAdmin && <LiensUtilesAdmin lienDiscord={lienDiscord} lienRoblox={lienRoblox} lienJustice={lienJustice} onSave={handleSaveLiens} />}
        {dashSection === "admin-grades" && current.isAdmin && <GradesUnitesAdmin personnel={personnel} onSave={handleSaveReglages} />}
        {dashSection === "cartes-pro" && <CartesProPage personnel={personnel} />}
        {dashSection === "mon-service" && <MonServicePage current={current} services={services} onStart={handleStartService} onStop={(id, extra) => handleStopService(id, undefined, extra)} quotaReglages={quotaReglages} absences={absences} onAddAbsence={handleAddAbsence} onCancelAbsence={handleCancelAbsence} />}
        {dashSection === "services-equipe" && <ServicesEquipePage current={current} personnel={personnel} services={services} etat={servicesEquipeEtat} quotaReglages={quotaReglages} absences={absences} />}
        {dashSection === "demandes-justice" && (estPalaisJustice(current) || current.isAdmin || estOPJ(current)) && <DemandesJusticePage current={current} codePenal={codePenal} />}
        {dashSection === "mon-profil-justice" && estPalaisJustice(current) && <ProfilJusticePage current={current} onSave={handleSaveProfilJustice} />}
        {dashSection === "mandats" && <MandatsPage current={current} />}
        {dashSection === "pv" && <PVPage current={current} modeles={peutSaisirCasierPV(current) ? modelesPV : []} pvs={estPalaisJustice(current) ? pvs.filter((p) => p.traite === true) : pvs} personnel={personnel} onSubmit={handleSubmitPV} onVisa={handleVisaPV} onTransmettre={handleTransmettrePV} codePenal={codePenal} />}
        {dashSection === "admin-services" && current.isAdmin && (
          <AdminServicesPage personnel={personnel} services={services} onForceStop={(id) => handleStopService(id, `${current.prenom} ${current.nom}`)} onAdjust={handleAdjustService} onDelete={handleDeleteService} quotaReglages={quotaReglages} absences={absences} onSaveQuota={handleSaveQuota} />
        )}
        {dashSection === "questionnaires-internes" && (
          <QuestionnairesListe liste={questionnairesInternes} onOpen={(id) => { setQuestionnaireId(id); setDashSection("postuler-questionnaire"); }} />
        )}
        {dashSection === "postuler-questionnaire" && (() => {
          const q = questionnairesInternes.find((x) => x.id === questionnaireId);
          if (!q) return <div style={{ padding: "32px 40px" }}>Candidature introuvable ou fermée.</div>;
          return (
            <ApplicationForm
              key={q.id}
              title={q.titre}
              intro={q.intro}
              sections={sectionsDe(q)}
              poste={q.poste || q.titre}
              prefill={{ ...(current.pseudoRoblox ? { pseudoRoblox: current.pseudoRoblox } : {}), ...(current.pseudoDiscord ? { pseudoDiscord: current.pseudoDiscord } : {}) }}
              onSubmit={(data) => handleSubmitCandidature(data, current)}
              onCancel={() => setDashSection("questionnaires-internes")}
            />
          );
        })()}
        {dashSection === "admin-questionnaires" && current.isAdmin && (
          <QuestionnairesAdmin questionnaires={questionnaires.filter((q) => q.visibilite !== "pv")} candidatures={candidatures} onSave={handleSaveQuestionnaires} grades={[...GRADES]} unites={Array.from(new Set([UNITE_CMD, UNITE_ENC, ...personnel.map((x) => x.unite)].filter(Boolean))).sort()} />
        )}
        {dashSection === "admin-modeles-pv" && current.isAdmin && (
          <PVModelesAdmin modeles={modelesPVListe} onSave={handleSavePVModeles} />
        )}
        {dashSection === "admin-personnel" && current.isAdmin && (
          <div>
            <RecrutementPanel recrutementOuvert={recrutementOuvert} onToggle={handleToggleRecrutement} />
            {anciennePersonnel ? (
              <div>
                <button type="button" onClick={() => setAnciennePersonnel(false)} style={{ background: "#E6EDF7", border: "1px solid #9FB6D8", color: "#123A7A", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", marginBottom: 14 }}>← Retour à la nouvelle interface</button>
                <AdminPanel personnel={personnel} roles={roles} onCreate={handleCreatePersonnel} onDelete={handleDeletePersonnel} onUpdate={handleUpdatePersonnel} onAssignRIO={handleAssignRIO} />
              </div>
            ) : (
              <PersonnelPage current={current} personnel={personnel} roles={roles} onCreate={handleCreatePersonnel} onUpdate={handleUpdatePersonnel} onDelete={handleDeletePersonnel} onAssignRIO={handleAssignRIO} onAncienne={() => setAnciennePersonnel(true)} />
            )}
          </div>
        )}
        {dashSection === "roles" && current.isAdmin && (
          <RolesPage roles={roles} personnel={personnel} postesCandidature={postesCandidature} onCreate={handleCreateRole} onUpdate={handleUpdateRole} onDelete={handleDeleteRole} />
        )}
        {dashSection === "admin-candidatures" && (current.isAdmin || (current.qualifications || []).includes("Recruteur")) && (
          <AdminCandidatures candidatures={candidaturesVisibles} onUpdateStatut={handleUpdateCandidatureStatut} onUpdateNote={handleUpdateCandidatureNote} onPublier={handlePublierCandidatures} onCreerCompte={handleCreerCompteCandidat} onUpdateEntretien={handleUpdateCandidatureEntretien} onRoleDiscord={handleRoleDiscord} personnel={personnel} unites={Array.from(new Set([UNITE_CMD, UNITE_ENC, ...personnel.map((x) => x.unite)].filter(Boolean))).sort()} />
        )}
        {dashSection === "admin-plaintes" && (current.isAdmin || estOPJ(current) || (current.qualifications || []).includes("Brigade de Recherche")) && (
          <AdminPlaintes plaintes={plaintes} pvs={pvs} current={current} onUpdateStatut={handleUpdatePlainteStatut} onTakeCharge={handleTakeChargePlainte} onOrienter={handleOrienterPlainte} onVisa={handleVisaPV} />
        )}
        {dashSection === "contacter-iggn" && <IGGNInterne onSubmit={handleSubmitPlainte} />}
        {dashSection === "signalements-iggn" && (current.isAdmin || (current.qualifications || []).includes("Référent Déontologie")) && (
          <AdminPlaintesGendarmes iggn plaintes={signalementsIGGN} current={current} onUpdate={handleUpdateSignalementIGGN} />
        )}
        {dashSection === "plaintes-gendarmes" && (current.isAdmin || estCommandement(current.unite) || (current.qualifications || []).includes("Référent Déontologie")) && (
          <AdminPlaintesGendarmes plaintes={plaintesGendarmes} current={current} onUpdate={handleUpdatePlainteGendarme} />
        )}
        {popupCR && crAFaire.length > 0 && <PopupDemandesCR demandes={crAFaire} onOpen={() => { fermerPopupCR(); setDashSection("comptes-rendus"); }} onLater={fermerPopupCR} />}
        {dashSection === "conditions-admission" && peutModifierConditions(current) && <ConditionsAdmin key={conditionsAdmission ? "charge" : "vide"} conditions={conditionsAdmission} onSave={handleSaveConditions} />}
        {dashSection === "communaute" && <CommunautePage current={current} lienRoblox={lienRoblox} />}
        {dashSection === "hierarchie" && <HierarchiePage current={current} personnel={personnel} />}
        {dashSection === "carte-ville" && <CarteVillePage current={current} personnel={personnel} roles={roles} />}
        {dashSection === "habilitations" && <MesHabilitations current={current} />}
        {dashSection === "habilitations-admin" && (peutValiderHabilitations(current) || peutCreerHabilitations(current)) && <HabilitationsAdmin current={current} personnel={personnel} />}
        {dashSection === "vigipirate" && peutModifierVigipirate(current) && <VigipirateAdmin key={vigipirate ? "charge" : "vide"} plan={vigipirate} onSave={handleSaveVigipirate} />}
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
      {pointageDu && <PointageService limite={pointageDu.limite} onConfirm={confirmerPointage} />}
    </div>
  );
}


// Durée de conservation des casiers, dossiers et PV (en jours) : au-delà, ils sont supprimés automatiquement
const JOURS_CONSERVATION_DOSSIERS = 7;

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
