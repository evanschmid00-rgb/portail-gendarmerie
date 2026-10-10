// lib/questionsCandidature.js — extrait automatiquement de l'ancien App.jsx (aucune logique modifiée)
import { GRADES, OUI_NON } from "./constantes.js";

/* ---------- Configuration des questions de candidature (GAV / SOG / Officier) ---------- */

export const GAV_SECTIONS = [
  {
    title: "Informations générales",
    fields: [
      { key: "pseudoRoblox", label: "Pseudo Roblox", required: true },
      { key: "pseudoDiscord", label: "Pseudo Discord", required: true },
      { key: "age", label: "Âge", type: "number", required: true },
      { key: "anciennete_serveur", label: "Depuis combien de temps es-tu sur le serveur ?", required: true },
      { key: "sanctions_anterieures", label: "As-tu déjà été sanctionné (kick/ban/blacklist) sur un serveur RP ? Si oui, précise.", type: "textarea" },
    ],
  },
  {
    title: "Informations RP",
    fields: [
      { key: "nom_rp", label: "Nom", required: true },
      { key: "prenom_rp", label: "Prénom", required: true },
      { key: "date_naissance_rp", label: "Date de naissance", type: "date" },
      { key: "lieu_naissance_rp", label: "Lieu de naissance" },
      { key: "sexe_rp", label: "Sexe", type: "select", options: ["Homme", "Femme", "Autre"] },
    ],
  },
  {
    title: "Disponibilités",
    fields: [
      { key: "heures_semaine", label: "Combien d'heures par semaine peux-tu consacrer au RP ?", required: true },
      { key: "creneaux", label: "Quels créneaux horaires te conviennent le mieux (matin/après-midi/soir/nuit) ?" },
      { key: "dispo_weekend", label: "Es-tu disponible les week-ends ?", type: "select", options: ["Oui", "Non", "Parfois"] },
    ],
  },
  {
    title: "Motivation",
    fields: [
      { key: "pourquoi_gav", label: "Pourquoi souhaites-tu devenir GAV au sein de la gendarmerie ?", type: "textarea", required: true },
      { key: "sens_metier", label: "Qu'est-ce que le métier de gendarme représente pour toi, en RP comme dans la réalité ?", type: "textarea" },
      { key: "experience_autre_serveur", label: "As-tu déjà occupé un rôle dans les forces de l'ordre (RP) sur un autre serveur ? Lequel, et pourquoi es-tu parti ?", type: "textarea" },
      { key: "attentes", label: "Qu'attends-tu de cette expérience au sein de notre unité ?", type: "textarea" },
    ],
  },
  {
    title: "Connaissances de base",
    fields: [
      { key: "diff_grade_fonction", label: "Quelle est la différence entre un grade et une fonction ?", type: "textarea", required: true },
      { key: "def_gav", label: "Sais-tu ce que signifie l'acronyme GAV ? Explique brièvement son statut (contrat, durée, missions).", type: "textarea", required: true },
      { key: "missions_gendarme", label: "Cite 3 missions principales d'un gendarme sur le terrain.", type: "textarea", required: true },
      { key: "temoin_abus", label: "Que fais-tu si tu es témoin d'un abus de pouvoir commis par un collègue en RP ?", type: "textarea" },
    ],
  },
  {
    title: "Mise en situation RP",
    fields: [
      { key: "situation_controle", label: "Tu contrôles un véhicule qui refuse de s'arrêter. Décris ta procédure étape par étape.", type: "textarea", required: true },
      { key: "situation_agressif", label: "Un civil devient agressif verbalement lors d'un contrôle. Comment réagis-tu ?", type: "textarea" },
      { key: "situation_ordre_illegal", label: "Que fais-tu si un supérieur te donne un ordre qui te semble contraire au règlement ?", type: "textarea" },
    ],
  },
  {
    title: "Engagement",
    fields: [
      { key: "reglement_lu", label: "As-tu lu et accepté le règlement intérieur de la gendarmerie ? (Oui/Non)", type: "select", options: OUI_NON, required: true },
      { key: "engagement_discipline", label: "T'engages-tu à respecter la hiérarchie et la discipline propres au RP militaire ?", type: "select", options: OUI_NON, required: true },
      { key: "questions_remarques", label: "As-tu des questions ou remarques avant l'entretien ?", type: "textarea" },
    ],
  },
];

export const SOG_SECTIONS = [
  {
    title: "Informations générales",
    fields: [
      { key: "pseudoRoblox", label: "Pseudo Roblox", required: true },
      { key: "pseudoDiscord", label: "Pseudo Discord", required: true },
      { key: "grade_actuel", label: "Grade actuel", type: "select", options: GRADES, required: true },
      { key: "date_integration", label: "Date d'intégration dans la gendarmerie", type: "date" },
      { key: "unite_actuelle", label: "Unité actuelle (SR, COG, PSIG, GIGN, etc. si applicable)" },
      { key: "heures_service", label: "Nombre d'heures de service effectuées" },
    ],
  },
  {
    title: "Bilan de service",
    fields: [
      { key: "interventions_marquantes", label: "Cite 2-3 interventions marquantes que tu as menées ou auxquelles tu as participé", type: "textarea", required: true },
      { key: "encadrement_experience", label: "As-tu déjà occupé une fonction d'encadrement (chef de patrouille, formateur, tuteur de GAV) ?", type: "textarea" },
      { key: "sanctions_sog", label: "As-tu des sanctions disciplinaires à ton actif ? Si oui, lesquelles et que retiens-tu de ces erreurs ?", type: "textarea" },
    ],
  },
  {
    title: "Motivation",
    fields: [
      { key: "pourquoi_sog", label: "Pourquoi souhaites-tu devenir SOG ?", type: "textarea", required: true },
      { key: "diff_gav_sog", label: "Qu'est-ce que ce grade change concrètement dans tes responsabilités par rapport à GAV ?", type: "textarea" },
      { key: "role_encadrement", label: "Comment envisages-tu ton rôle vis-à-vis des GAV que tu encadreras ?", type: "textarea" },
    ],
  },
  {
    title: "Connaissances hiérarchiques et légales",
    fields: [
      { key: "place_sog_hierarchie", label: "Quelle est la place du SOG dans la chaîne de commandement (entre qui et qui) ?", type: "textarea", required: true },
      { key: "diff_sousofficier_officier", label: "Quelle est la différence entre un sous-officier et un officier ?", type: "textarea" },
      { key: "opj_sog", label: "Qu'est-ce qu'un OPJ, et un SOG peut-il l'être automatiquement ?", type: "textarea" },
      { key: "grades_sousofficier", label: "Cite les grades de sous-officier dans l'ordre croissant", type: "textarea" },
    ],
  },
  {
    title: "Mises en situation (encadrement)",
    fields: [
      { key: "situation_erreur_gav", label: "Un GAV sous tes ordres commet une erreur de procédure pendant une intervention. Comment réagis-tu sur le moment, puis après ?", type: "textarea", required: true },
      { key: "situation_repartition", label: "Tu dois répartir les tâches entre plusieurs GAV lors d'une patrouille. Comment organises-tu le groupe ?", type: "textarea" },
      { key: "situation_conflit", label: "Un GAV te rapporte un conflit avec un autre gradé. Quelle est ta démarche ?", type: "textarea" },
      { key: "situation_demotive", label: "Comment gères-tu un GAV démotivé ou peu impliqué ?", type: "textarea" },
    ],
  },
  {
    title: "Leadership et discipline",
    fields: [
      { key: "qualites_sog", label: "Selon toi, quelles qualités doit avoir un bon sous-officier ?", type: "textarea" },
      { key: "sanction_ami", label: "Es-tu prêt à sanctionner un ami RP en cas de faute grave ?", type: "select", options: OUI_NON },
      { key: "formation_complementaire", label: "Acceptes-tu de suivre une formation/évaluation complémentaire si ta candidature est validée sous conditions ?", type: "select", options: OUI_NON },
    ],
  },
  {
    title: "Engagement",
    fields: [
      { key: "engagement_exemplaire", label: "T'engages-tu à être exemplaire en service comme référence pour les grades inférieurs ?", type: "select", options: OUI_NON, required: true },
      { key: "remarques_sog", label: "Remarques ou questions avant l'entretien ?", type: "textarea" },
    ],
  },
];

export const OFFICIER_SECTIONS = [
  {
    title: "Informations générales",
    fields: [
      { key: "pseudoRoblox", label: "Pseudo Roblox", required: true },
      { key: "pseudoDiscord", label: "Pseudo Discord", required: true },
      { key: "grade_actuel", label: "Grade actuel", type: "select", options: GRADES, required: true },
      { key: "unite_fonction", label: "Unité actuelle et fonction(s) occupée(s)" },
      { key: "anciennete_totale", label: "Ancienneté totale dans la gendarmerie" },
      { key: "anciennete_sog", label: "Ancienneté en tant que SOG" },
    ],
  },
  {
    title: "Bilan de carrière",
    fields: [
      { key: "parcours", label: "Résume ton parcours depuis ton entrée (GAV → SOG → aujourd'hui)", type: "textarea", required: true },
      { key: "responsabilites_encadrement", label: "Quelles responsabilités d'encadrement as-tu déjà exercées (chef de groupe, formateur, commandant d'unité...) ?", type: "textarea" },
      { key: "realisations", label: "Cite 2-3 réalisations concrètes dont tu es fier (opérations menées, formations dispensées, projets internes)", type: "textarea" },
      { key: "gestion_recrutement", label: "As-tu déjà géré un recrutement, une formation, ou un rapport disciplinaire en tant que gradé ?", type: "textarea" },
      { key: "sanctions_officier", label: "As-tu des sanctions à ton actif ? Comment les expliques-tu ?", type: "textarea" },
      { key: "appui_officiers", label: "Un ou plusieurs officiers peuvent-ils appuyer ta candidature ? Lesquels ?", type: "textarea" },
    ],
  },
  {
    title: "Motivation et vision",
    fields: [
      { key: "pourquoi_officier", label: "Pourquoi souhaites-tu devenir officier ?", type: "textarea", required: true },
      { key: "diff_sog_officier_chaine", label: "Quelle différence fais-tu entre le rôle d'un sous-officier et celui d'un officier dans la chaîne de commandement ?", type: "textarea" },
      { key: "vision_unite", label: "As-tu un projet ou une vision pour l'unité/le serveur si tu obtiens ce grade (formation, réorganisation, recrutement) ?", type: "textarea" },
      { key: "conciliation_dispo", label: "Comment comptes-tu concilier ce rôle avec ta disponibilité ?", type: "textarea" },
    ],
  },
  {
    title: "Connaissances institutionnelles",
    fields: [
      { key: "diff_commandement", label: "Quelle est la différence entre commandement opérationnel et commandement administratif ?", type: "textarea", required: true },
      { key: "role_iggn", label: "Qu'est-ce que le Corps d'Encadrement et quel est son rôle vis-à-vis des officiers ?", type: "textarea" },
      { key: "opj_apj_officier", label: "Un officier peut-il être OPJ ou APJ ? Quelle est la nuance ?", type: "textarea" },
      { key: "grades_officier_ordre", label: "Cite les grades d'officier dans l'ordre croissant", type: "textarea" },
    ],
  },
  {
    title: "Mises en situation (commandement)",
    fields: [
      { key: "situation_conflit_sog", label: "Deux sous-officiers sous ton commandement sont en conflit ouvert. Comment gères-tu la situation ?", type: "textarea", required: true },
      { key: "situation_decision_seul", label: "Tu dois prendre une décision stratégique en l'absence de ta hiérarchie directe. Comment procèdes-tu ?", type: "textarea" },
      { key: "situation_motivation_unite", label: "Comment motives-tu une unité en perte d'effectifs ou de dynamique ?", type: "textarea" },
      { key: "situation_ordre_dggn", label: "Un ordre venu du Corps de Commandement te semble en décalage avec le terrain. Que fais-tu ?", type: "textarea" },
    ],
  },
  {
    title: "Leadership et exemplarité",
    fields: [
      { key: "qualites_officier", label: "Quelles qualités humaines et RP juges-tu indispensables à un officier ?", type: "textarea" },
      { key: "gestion_pression", label: "Comment gères-tu la pression et les responsabilités qui viennent avec ce grade ?", type: "textarea" },
      { key: "rendre_comptes", label: "Es-tu prêt à rendre des comptes directement au commandement supérieur (Corps de Commandement / Corps d'Encadrement) ?", type: "select", options: OUI_NON },
      { key: "periode_essai", label: "Acceptes-tu une période d'essai ou d'observation avant confirmation définitive du grade ?", type: "select", options: OUI_NON },
    ],
  },
  {
    title: "Engagement",
    fields: [
      { key: "engagement_exemplarite", label: "T'engages-tu à incarner l'exemplarité et la rigueur attendues à ce niveau ?", type: "select", options: OUI_NON, required: true },
      { key: "mot_libre", label: "Souhaites-tu ajouter un mot de motivation libre ou une remarque avant l'entretien ?", type: "textarea" },
    ],
  },
];
