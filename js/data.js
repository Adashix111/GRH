/* ==========================================================================
   js/data.js — Données du portail RH « TECHNOVA INDUSTRIE SA »
   ==========================================================================
   Entreprise et données FICTIVES : cas d'étude TECHNOVA (TD du module GRH,
   ENCG Settat). Démo pédagogique.

   D'OÙ VIENNENT LES CHIFFRES ?
   - Repris à l'identique du TD TECHNOVA : effectif au 31/12/2025 par
     catégorie, sexe et âge ; départs à la retraite 2026–2028 ; taux de
     démission ; mobilité interne ; besoins 2028 ; compétences cibles ;
     réponses RH.
   - Simulé pour la démo (non fourni par le TD) : le détail individuel des
     1 200 salariés (âge exact, ancienneté, salaire, absentéisme, formation)
     et les 15 salariés de la page « Risque de départ ». Un générateur
     pseudo-aléatoire « à graine » produit toujours les mêmes nombres : tout
     le monde voit les mêmes chiffres, et les totaux du TD sont respectés.

   LA MÉTHODE DE PRÉVISION (formule du TD)
     Effectif disponible = Effectif 2025 − Retraites − Démissions ± Mobilité interne
     - Retraites : salariés qui atteignent l'âge légal (60 ans, paramètre).
     - Démissions : taux annuel constant × effectif 2025, chaque année
       (cadres 5 %, techniciens 4 %, agents d'exécution 2,5 %).
     - Mobilité interne : 15 techniciens promus cadres entre 2026 et 2028.
     Écart 2028 = Disponible 2028 − Besoins 2028
     (positif = surplus, négatif = déficit).

   LES SCÉNARIOS
     - Central = hypothèses du TD (besoins 2028 : 250 cadres, 640 techniciens,
       260 agents d'exécution).
     - Pessimiste et optimiste : on fait varier la croissance de l'activité et
       le rythme d'automatisation du plan « Industrie 4.0 » :
       Besoins 2028 = Effectif 2025 × (1 + croissance)³ + effet du plan × rythme
       (l'effet du plan est calculé pour retrouver exactement le TD en central).

   LE SCORE DE RISQUE DE DÉPART (page « Risque de départ »)
     Score = 30 points de base + points ajoutés ou retirés par 6 facteurs
     (ancienneté, écart salaire/marché, dernière augmentation, évaluation,
     formations suivies, absentéisme), borné entre 0 et 100.
     C'est une aide à la décision : le manager décide, jamais l'algorithme.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Générateur pseudo-aléatoire à graine (algorithme « mulberry32 »)
     ------------------------------------------------------------------------ */
  function creerGenerateur(graine) {
    let etat = graine >>> 0;
    return function () {
      etat = (etat + 0x6D2B79F5) >>> 0;
      let t = etat;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // nombre entre 0 et 1
    };
  }

  const arrondi = (x, decimales = 0) => {
    const f = Math.pow(10, decimales);
    return Math.round(x * f) / f;
  };
  const borner = (x, min, max) => Math.min(max, Math.max(min, x));
  const somme = (liste) => liste.reduce((a, b) => a + b, 0);
  const moyenne = (liste) => (liste.length ? somme(liste) / liste.length : 0);
  const pourcentage = (partie, tout) => (tout ? arrondi((100 * partie) / tout, 1) : 0);

  // Mélange une liste (toujours dans le même ordre, grâce à la graine)
  function melanger(liste, alea) {
    for (let i = liste.length - 1; i > 0; i--) {
      const j = Math.floor(alea() * (i + 1));
      const temp = liste[i];
      liste[i] = liste[j];
      liste[j] = temp;
    }
    return liste;
  }

  /* ------------------------------------------------------------------------
     2. L'entreprise et ses 3 catégories (chiffres du TD)
     ------------------------------------------------------------------------ */
  const ENTREPRISE = {
    nom: 'TECHNOVA INDUSTRIE SA',
    nomCourt: 'TECHNOVA',
    mention: 'Entreprise fictive · cas d’étude',
    secteur: 'Industrie : lignes d’assemblage et maintenance industrielle',
    dateReference: '31/12/2025',
    plan: 'Industrie 4.0',
    periodePlan: '2026–2028',
    source: 'TD TECHNOVA — module GRH, ENCG Settat',
  };

  const ANNEE_REFERENCE = 2025;            // effectif au 31/12/2025
  const ANNEES_PREVISION = [2026, 2027, 2028];
  const HORIZON = 2028;                    // horizon du plan « Industrie 4.0 »
  const AGE_RETRAITE_DEFAUT = 60;          // âge légal de départ (paramètre)
  const PART_DEMISSIONS_TECH_MOINS_35 = 70; // TD : 70 % des démissions de techniciens ont moins de 35 ans
  const DELAI_RECRUTEMENT_MOIS = 5;        // TD : délai moyen d'un recrutement
  const BUDGET_FORMATION_MDH = 4.5;        // TD : budget formation sur 3 ans

  /* Pour chaque catégorie :
     - hommes, femmes, moins30, plus50 : effectif au 31/12/2025 (TD)
     - retraites : départs à la retraite 2026, 2027, 2028 (TD) — ce sont les
       salariés âgés de 59, 58 et 57 ans au 31/12/2025
     - tauxDemission : % par an (TD) ; mobilite : solde 2026–2028 (TD)
     - besoin2028 : besoins du plan stratégique (TD, scénario central)
     - les autres paramètres servent seulement à SIMULER le détail individuel */
  const CATEGORIES = [
    {
      id: 'cadres', nom: 'Cadres', court: 'Cadres', pluriel: 'cadres',
      hommes: 166, femmes: 74, moins30: 30, plus50: 60,
      retraites: [7, 6, 5], tauxDemission: 5, mobilite: 15, besoin2028: 250,
      ageDebut: 23, profilAge: 1.0,
      salaire: { min: 16000, max: 30000, parAnnee: 280 },
      profilAnciennete: 1.2, absenteisme: 2.2, probaFormation: 0.55,
    },
    {
      id: 'techniciens', nom: 'Techniciens', court: 'Techniciens', pluriel: 'techniciens',
      hommes: 464, femmes: 136, moins30: 150, plus50: 120,
      retraites: [11, 10, 9], tauxDemission: 4, mobilite: -15, besoin2028: 640,
      ageDebut: 20, profilAge: 1.3,
      salaire: { min: 7000, max: 11000, parAnnee: 140 },
      profilAnciennete: 1.1, absenteisme: 3.9, probaFormation: 0.46,
    },
    {
      id: 'agents', nom: 'Agents d’exécution', court: 'Agents', pluriel: 'agents d’exécution',
      hommes: 247, femmes: 113, moins30: 40, plus50: 160,
      retraites: [18, 16, 14], tauxDemission: 2.5, mobilite: 0, besoin2028: 260,
      ageDebut: 19, profilAge: 0.7,
      salaire: { min: 3600, max: 5200, parAnnee: 55 },
      profilAnciennete: 0.6, absenteisme: 5.6, probaFormation: 0.30,
    },
  ];
  CATEGORIES.forEach((c) => { c.effectif = c.hommes + c.femmes; });

  /* ------------------------------------------------------------------------
     3. Les 1 200 salariés (détail SIMULÉ, totaux du TD respectés)
     ------------------------------------------------------------------------ */
  const alea = creerGenerateur(20251231);
  const salaries = [];
  let numero = 1;

  CATEGORIES.forEach((c) => {
    // Âges : on respecte exactement les « moins de 30 ans », les « 50 ans et
    // plus » et les futurs retraités (59, 58 et 57 ans) donnés par le TD.
    const ages = [];
    for (let i = 0; i < c.moins30; i++) ages.push(c.ageDebut + Math.floor((30 - c.ageDebut) * Math.pow(alea(), 0.7)));
    const nb30a49 = c.effectif - c.moins30 - c.plus50;
    for (let i = 0; i < nb30a49; i++) ages.push(30 + Math.floor(20 * Math.pow(alea(), c.profilAge)));
    const nb50a56 = c.plus50 - somme(c.retraites);
    for (let i = 0; i < nb50a56; i++) ages.push(50 + Math.floor(7 * alea()));
    c.retraites.forEach((nombre, k) => {
      for (let i = 0; i < nombre; i++) ages.push(59 - k);
    });

    // Sexe : exactement le nombre d'hommes et de femmes du TD
    const sexes = melanger(Array(c.hommes).fill('H').concat(Array(c.femmes).fill('F')), alea);

    ages.forEach((age, i) => {
      const ancienneteMax = Math.max(0, age - c.ageDebut);
      const anciennete = Math.round(ancienneteMax * Math.pow(alea(), c.profilAnciennete));
      const salaireBrut = c.salaire.min + alea() * (c.salaire.max - c.salaire.min) + c.salaire.parAnnee * anciennete;
      salaries.push({
        id: 'TN-' + String(numero++).padStart(4, '0'),
        categorie: c.id,
        sexe: sexes[i],
        age: age, // âge au 31/12/2025
        anneeNaissance: ANNEE_REFERENCE - age,
        anciennete: anciennete,
        salaireMensuel: Math.round(salaireBrut / 50) * 50, // MAD brut, arrondi à 50
        absenteisme: arrondi((c.absenteisme * (0.25 + 1.5 * Math.pow(alea(), 2))) / 0.75, 1),
        forme2025: alea() < c.probaFormation,
      });
    });
  });

  /* ------------------------------------------------------------------------
     4. Indicateurs descriptifs (diagnostic au 31/12/2025)
     ------------------------------------------------------------------------ */
  const parCategorie = (id) => salaries.filter((s) => s.categorie === id);
  const effectifTotal = salaries.length;
  const masseMensuelle = somme(salaries.map((s) => s.salaireMensuel));
  const demissionsParAn = somme(CATEGORIES.map((c) => (c.effectif * c.tauxDemission) / 100));

  const indicateurs = {
    effectifTotal: effectifTotal,
    nbFemmes: salaries.filter((s) => s.sexe === 'F').length,
    partFemmes: pourcentage(salaries.filter((s) => s.sexe === 'F').length, effectifTotal),
    nbMoins30: salaries.filter((s) => s.age < 30).length,
    partMoins30: pourcentage(salaries.filter((s) => s.age < 30).length, effectifTotal),
    nbPlus50: salaries.filter((s) => s.age >= 50).length,
    partPlus50: pourcentage(salaries.filter((s) => s.age >= 50).length, effectifTotal),
    demissionsParAn: demissionsParAn,                                   // 45 (TD)
    tauxTurnover: arrondi((100 * demissionsParAn) / effectifTotal, 2),   // 3,75 % (TD)
    tauxAbsenteisme: arrondi(moyenne(salaries.map((s) => s.absenteisme)), 1), // simulé
    ageMoyen: arrondi(moyenne(salaries.map((s) => s.age)), 1),
    ancienneteMoyenne: arrondi(moyenne(salaries.map((s) => s.anciennete)), 1), // simulé
    nbFormes2025: salaries.filter((s) => s.forme2025).length,                  // simulé
    partFormes2025: pourcentage(salaries.filter((s) => s.forme2025).length, effectifTotal),
    masseSalarialeAnnuelle: masseMensuelle * 12,                               // simulé
    salaireMoyenMensuel: Math.round(masseMensuelle / effectifTotal),
  };

  // Pyramide des âges : tranches de 5 ans, de la plus âgée à la plus jeune
  const TRANCHES_AGE = [[55, 59], [50, 54], [45, 49], [40, 44], [35, 39], [30, 34], [25, 29], [18, 24]];
  const pyramide = {
    tranches: TRANCHES_AGE.map(([a, b]) => (a === 18 ? 'Moins de 25 ans' : a + '–' + b + ' ans')),
    hommes: TRANCHES_AGE.map(([a, b]) => salaries.filter((s) => s.sexe === 'H' && s.age >= a && s.age <= b).length),
    femmes: TRANCHES_AGE.map(([a, b]) => salaries.filter((s) => s.sexe === 'F' && s.age >= a && s.age <= b).length),
  };

  const detailCategories = CATEGORIES.map((c) => {
    const membres = parCategorie(c.id);
    const moins30 = membres.filter((s) => s.age < 30).length;
    const plus50 = membres.filter((s) => s.age >= 50).length;
    return {
      id: c.id, nom: c.nom, court: c.court,
      effectif: membres.length,
      part: pourcentage(membres.length, effectifTotal),
      hommes: membres.filter((s) => s.sexe === 'H').length,
      femmes: membres.filter((s) => s.sexe === 'F').length,
      partFemmes: pourcentage(membres.filter((s) => s.sexe === 'F').length, membres.length),
      moins30: moins30, partMoins30: pourcentage(moins30, membres.length),
      moins35: membres.filter((s) => s.age < 35).length,
      plus50: plus50, partPlus50: pourcentage(plus50, membres.length),
      ageMoyen: arrondi(moyenne(membres.map((s) => s.age)), 1),
      salaireMoyen: Math.round(moyenne(membres.map((s) => s.salaireMensuel))),
      tauxDemission: c.tauxDemission,
    };
  });

  /* ------------------------------------------------------------------------
     5. Modèle prédictif 2026–2028
     ------------------------------------------------------------------------ */
  const SCENARIOS = {
    pessimiste: {
      id: 'pessimiste', nom: 'Pessimiste',
      description: 'Activité en recul et automatisation retardée',
      croissance: -0.01, rythmeAutomatisation: 0.75,
    },
    central: {
      id: 'central', nom: 'Central',
      description: 'Plan stratégique « Industrie 4.0 » 2026–2028 : hypothèses du TD',
      croissance: 0.01, rythmeAutomatisation: 1,
    },
    optimiste: {
      id: 'optimiste', nom: 'Optimiste',
      description: 'Forte croissance et automatisation accélérée',
      croissance: 0.03, rythmeAutomatisation: 1.25,
    },
  };

  // Effet du plan « Industrie 4.0 » sur les besoins 2028, calé sur le TD :
  // en scénario central, on retrouve exactement 250 cadres, 640 techniciens et 260 agents.
  CATEGORIES.forEach((c) => {
    c.effetPlan = c.besoin2028 - c.effectif * Math.pow(1 + SCENARIOS.central.croissance, ANNEES_PREVISION.length);
  });

  function besoin2028(categorie, scenario) {
    const n = ANNEES_PREVISION.length;
    return Math.round(categorie.effectif * Math.pow(1 + scenario.croissance, n) + categorie.effetPlan * scenario.rythmeAutomatisation);
  }

  function prevoir(idScenario, ageRetraite) {
    const scenario = SCENARIOS[idScenario] || SCENARIOS.central;
    const age = ageRetraite || AGE_RETRAITE_DEFAUT;
    const n = ANNEES_PREVISION.length;
    const annees = [ANNEE_REFERENCE].concat(ANNEES_PREVISION);
    const resultat = { scenario: scenario, ageRetraite: age, annees: annees, categories: {}, total: null };

    CATEGORIES.forEach((c) => {
      const membres = parCategorie(c.id);
      const cible = besoin2028(c, scenario);
      const demissionsAnnuelles = Math.round((c.effectif * c.tauxDemission) / 100); // taux constant (TD)
      const mobiliteAnnuelle = c.mobilite / n;
      let ressources = c.effectif;
      const serie = {
        besoins: [c.effectif], ressources: [c.effectif], ecarts: [0],
        retraites: [], demissions: [], mobilite: [],
      };

      ANNEES_PREVISION.forEach((annee, k) => {
        // Retraites : salariés qui atteignent l'âge de départ cette année-là
        const retraites = membres.filter((s) => Math.max(s.anneeNaissance + age, ANNEES_PREVISION[0]) === annee).length;
        ressources = ressources - retraites - demissionsAnnuelles + mobiliteAnnuelle;
        // Besoins : trajectoire régulière jusqu'à l'objectif 2028 du plan
        const besoin = Math.round(c.effectif + ((cible - c.effectif) * (k + 1)) / n);
        serie.besoins.push(besoin);
        serie.ressources.push(Math.round(ressources));
        serie.ecarts.push(Math.round(ressources) - besoin);
        serie.retraites.push(retraites);
        serie.demissions.push(demissionsAnnuelles);
        serie.mobilite.push(mobiliteAnnuelle);
      });

      serie.effectif2025 = c.effectif;
      serie.totalRetraites = somme(serie.retraites);
      serie.totalDemissions = somme(serie.demissions);
      serie.totalMobilite = somme(serie.mobilite);
      serie.disponible2028 = serie.ressources[n];
      serie.besoin2028 = cible;
      serie.ecart2028 = serie.disponible2028 - cible;
      resultat.categories[c.id] = serie;
    });

    const sommeSur = (cle) => annees.map((a, i) => somme(CATEGORIES.map((c) => resultat.categories[c.id][cle][i])));
    const sommeDe = (cle) => somme(CATEGORIES.map((c) => resultat.categories[c.id][cle]));
    resultat.total = {
      besoins: sommeSur('besoins'),
      ressources: sommeSur('ressources'),
      ecarts: sommeSur('ecarts'),
      retraites: ANNEES_PREVISION.map((a, i) => somme(CATEGORIES.map((c) => resultat.categories[c.id].retraites[i]))),
      effectif2025: sommeDe('effectif2025'),
      totalRetraites: sommeDe('totalRetraites'),
      totalDemissions: sommeDe('totalDemissions'),
      totalMobilite: sommeDe('totalMobilite'),
      disponible2028: sommeDe('disponible2028'),
      besoin2028: sommeDe('besoin2028'),
      ecart2028: sommeDe('ecart2028'),
    };
    return resultat;
  }

  // Statut d'un écart, comme dans le TD : positif = surplus, négatif = déficit
  function statutEcart(ecart) {
    if (ecart > 0) return 'surplus';
    if (ecart < 0) return 'deficit';
    return 'equilibre';
  }

  /* ------------------------------------------------------------------------
     6. Compétences : écart qualitatif 2025 → 2028 (TD)
     Salariés à former ou recruter = besoins 2028 × objectif − effectif 2025 × maîtrise
     (exemple du TD : robotique 600 × 25 % = 150 → 640 × 60 % = 384, soit 234)
     ------------------------------------------------------------------------ */
  const COMPETENCES = [
    { categorie: 'cadres', nom: 'Management agile', maitrise2025: 30, objectif2028: 70 },
    { categorie: 'cadres', nom: 'IA appliquée', maitrise2025: 10, objectif2028: 40 },
    { categorie: 'cadres', nom: 'Pilotage de l’innovation', maitrise2025: 20, objectif2028: 50 },
    { categorie: 'techniciens', nom: 'Robotique', maitrise2025: 25, objectif2028: 60 },
    { categorie: 'techniciens', nom: 'Analyse de données', maitrise2025: 15, objectif2028: 50 },
    { categorie: 'techniciens', nom: 'Cybersécurité industrielle', maitrise2025: 5, objectif2028: 30 },
    { categorie: 'agents', nom: 'Outils numériques', maitrise2025: 40, objectif2028: 80 },
    { categorie: 'agents', nom: 'Maintenance de 1er niveau', maitrise2025: 20, objectif2028: 50 },
  ];

  function besoinsCompetences(prevision) {
    return COMPETENCES.map((comp) => {
      const s = prevision.categories[comp.categorie];
      const maitrisants2025 = Math.round((s.effectif2025 * comp.maitrise2025) / 100);
      const requis2028 = Math.round((s.besoin2028 * comp.objectif2028) / 100);
      return Object.assign({}, comp, {
        effectif2025: s.effectif2025,
        besoin2028: s.besoin2028,
        maitrisants2025: maitrisants2025,
        requis2028: requis2028,
        aFormer: Math.max(0, requis2028 - maitrisants2025),
        ecartPoints: comp.objectif2028 - comp.maitrise2025,
      });
    });
  }

  const METIERS = {
    emergents: [
      { nom: 'Technicien(ne) en maintenance prédictive', detail: 'Nouvelle offre de maintenance prédictive' },
      { nom: 'Roboticien(ne) / programmeur(se) de robots', detail: 'Deux lignes d’assemblage automatisées' },
      { nom: 'Analyste de données industrielles', detail: 'Analyse des données des capteurs et des machines' },
      { nom: 'Expert(e) en cybersécurité industrielle', detail: 'Protéger les machines connectées' },
      { nom: 'Chef(fe) de projet transformation digitale', detail: 'Cellule « Innovation et transformation digitale »' },
    ],
    declin: [
      { nom: 'Agent d’assemblage manuel', detail: 'Remplacé par les deux lignes automatisées' },
      { nom: 'Tâches manuelles répétitives', detail: 'Manutention, saisie, contrôles simples' },
      { nom: 'Contrôle visuel manuel', detail: 'Remplacé par des capteurs et la vision industrielle' },
    ],
  };

  /* ------------------------------------------------------------------------
     7. Risque de départ : 15 salariés suivis (SIMULÉS, graine 2028)
     ------------------------------------------------------------------------ */
  const SCORE_BASE = 30;
  const SEUILS_RISQUE = { eleve: 65, moyen: 40 };

  // Chaque facteur ajoute (+) ou retire (−) des points : c'est ce qui rend le score explicable.
  const FACTEURS_RISQUE = [
    { id: 'anciennete', nom: 'Ancienneté',
      points: (v) => (v < 2 ? 12 : v < 5 ? 7 : v < 10 ? 0 : -6) },
    { id: 'ecartSalaire', nom: 'Écart salaire / marché',
      points: (v) => borner(Math.round(-v * 1.2), -8, 22) },
    { id: 'derniereAugmentation', nom: 'Dernière augmentation',
      points: (v) => (v > 24 ? 14 : v > 12 ? 6 : -4) },
    { id: 'evaluation', nom: 'Évaluation annuelle',
      points: (v) => (v <= 2 ? 10 : v === 3 ? 3 : v === 4 ? 0 : -2) },
    { id: 'formations', nom: 'Formations suivies (2 ans)',
      points: (v) => (v === 0 ? 8 : v === 1 ? 3 : v === 2 ? 0 : -5) },
    { id: 'absenteisme', nom: 'Absentéisme',
      points: (v) => (v > 8 ? 10 : v > 5 ? 5 : v >= 2 ? 0 : -3) },
  ];

  // Profils types (fourchettes de valeurs) utilisés pour simuler les salariés
  const PROFILS = {
    eleve: { anciennete: [1, 4], ecartSalaire: [-18, -11], derniereAugmentation: [22, 34], evaluation: [4, 5], formations: [0, 1], absenteisme: [1.5, 4.5] },
    moyen: { anciennete: [4, 9], ecartSalaire: [-9, -4], derniereAugmentation: [13, 22], evaluation: [3, 4], formations: [1, 2], absenteisme: [3, 6.5] },
    faible: { anciennete: [10, 26], ecartSalaire: [-2, 6], derniereAugmentation: [3, 11], evaluation: [3, 5], formations: [2, 4], absenteisme: [1, 4] },
  };

  const SALARIES_SUIVIS = [
    { nom: 'Hamza El Mansouri', poste: 'Technicien robotique', categorie: 'techniciens', profil: 'eleve' },
    { nom: 'Salma Bennani', poste: 'Technicienne analyse de données', categorie: 'techniciens', profil: 'eleve' },
    { nom: 'Ayoub Tahiri', poste: 'Technicien maintenance prédictive', categorie: 'techniciens', profil: 'eleve' },
    { nom: 'Meryem Hilali', poste: 'Ingénieure innovation', categorie: 'cadres', profil: 'eleve' },
    { nom: 'Imane Chraibi', poste: 'Technicienne automatisme', categorie: 'techniciens', profil: 'moyen' },
    { nom: 'Youssef Ouazzani', poste: 'Technicien méthodes', categorie: 'techniciens', profil: 'moyen' },
    { nom: 'Karim Sabri', poste: 'Chef de projet transformation digitale', categorie: 'cadres', profil: 'moyen' },
    { nom: 'Omar Kettani', poste: 'Contrôleur de gestion', categorie: 'cadres', profil: 'moyen' },
    { nom: 'Fatima Zahra Amrani', poste: 'Opératrice d’assemblage — ligne 1', categorie: 'agents', profil: 'moyen' },
    { nom: 'Mustapha Haddad', poste: 'Cariste', categorie: 'agents', profil: 'moyen' },
    { nom: 'Rachid Lahlou', poste: 'Technicien de maintenance', categorie: 'techniciens', profil: 'faible' },
    { nom: 'Nadia Tazi', poste: 'Responsable qualité', categorie: 'cadres', profil: 'faible' },
    { nom: 'Abdelilah Naciri', poste: 'Agent d’assemblage — ligne 2', categorie: 'agents', profil: 'faible' },
    { nom: 'Khadija Rami', poste: 'Agente de contrôle qualité', categorie: 'agents', profil: 'faible' },
    { nom: 'Zineb Fahmi', poste: 'Agente logistique', categorie: 'agents', profil: 'faible' },
  ];

  const aleaRisque = creerGenerateur(2028);
  const entierEntre = (a, b) => a + Math.floor(aleaRisque() * (b - a + 1));
  const reelEntre = (a, b) => arrondi(a + aleaRisque() * (b - a), 1);

  function niveauRisque(score) {
    if (score >= SEUILS_RISQUE.eleve) return 'eleve';
    if (score >= SEUILS_RISQUE.moyen) return 'moyen';
    return 'faible';
  }

  const salariesSuivis = SALARIES_SUIVIS.map((s, i) => {
    const p = PROFILS[s.profil];
    const valeurs = {
      anciennete: entierEntre(p.anciennete[0], p.anciennete[1]),
      ecartSalaire: entierEntre(p.ecartSalaire[0], p.ecartSalaire[1]),
      derniereAugmentation: entierEntre(p.derniereAugmentation[0], p.derniereAugmentation[1]),
      evaluation: entierEntre(p.evaluation[0], p.evaluation[1]),
      formations: entierEntre(p.formations[0], p.formations[1]),
      absenteisme: reelEntre(p.absenteisme[0], p.absenteisme[1]),
    };
    const contributions = FACTEURS_RISQUE.map((f) => ({ id: f.id, nom: f.nom, valeur: valeurs[f.id], points: f.points(valeurs[f.id]) }));
    const score = borner(SCORE_BASE + somme(contributions.map((c) => c.points)), 0, 100);
    return {
      id: 'TN-' + String(137 + i * 71).padStart(4, '0'),
      nom: s.nom, poste: s.poste, categorie: s.categorie,
      anciennete: valeurs.anciennete,
      valeurs: valeurs, contributions: contributions,
      score: score, niveau: niveauRisque(score),
    };
  }).sort((a, b) => b.score - a.score);

  /* ------------------------------------------------------------------------
     8. Plan d'action GPEC : recommandations calculées à partir des écarts
     (les 6 réponses RH du TD + les écarts restants)
     ------------------------------------------------------------------------ */
  const RESPONSABLES = {
    drh: 'C. Ez-zarzari (DRH)',
    industriel: 'Y. Alami (Directeur industriel)',
    maintenance: 'S. Idrissi (Resp. maintenance)',
    innovation: 'N. Berrada (Resp. innovation)',
  };

  function genererPlanAction(prevision) {
    const c = prevision.categories;
    const deficitTechniciens = Math.max(0, -c.techniciens.ecart2028);
    const deficitCadres = Math.max(0, -c.cadres.ecart2028);
    const surplusAgents = Math.max(0, c.agents.ecart2028);
    const retraites = prevision.total.totalRetraites;
    const jeunesDemissionnaires = Math.round((c.techniciens.totalDemissions * PART_DEMISSIONS_TECH_MOINS_35) / 100);
    const competences = besoinsCompetences(prevision);
    const robotique = competences.find((x) => x.nom === 'Robotique');
    const agile = competences.find((x) => x.nom === 'Management agile');
    const techMoins35 = detailCategories.find((d) => d.id === 'techniciens').moins35;
    const parAn = (n) => Math.ceil(n / ANNEES_PREVISION.length);
    const actions = [];

    if (deficitTechniciens > 0) {
      actions.push({
        levier: 'Recruter', action: 'Recruter ' + deficitTechniciens + ' techniciens (robotique, données, maintenance prédictive)',
        detail: 'Délai moyen de ' + DELAI_RECRUTEMENT_MOIS + ' mois par recrutement : ouvrir environ ' + parAn(deficitTechniciens) +
          ' postes par an, 5 mois avant chaque besoin.',
        cible: 'Techniciens', effectif: deficitTechniciens, echeance: '2026–2028, en continu', priorite: 'haute', responsable: RESPONSABLES.drh,
      });
    }
    actions.push({
      levier: 'Former', action: 'Former à la robotique, à l’analyse de données et à l’IA',
      detail: 'Budget de 4,5 MDH sur 3 ans (1,5 MDH par an). Robotique : ' + robotique.maitrisants2025 + ' → ' + robotique.requis2028 +
        ' techniciens qualifiés, soit ' + robotique.aFormer + ' à former ou recruter.',
      cible: 'Techniciens', effectif: robotique.aFormer, echeance: '2026–2028', priorite: 'haute', responsable: RESPONSABLES.drh,
    });
    actions.push({
      levier: 'Transmettre', action: 'Tutorat des seniors : binômes senior–junior avant les départs',
      detail: retraites + ' départs à la retraite d’ici 2028, dont ' + c.agents.totalRetraites + ' agents d’exécution (44,4 % des agents ont 50 ans ou plus).',
      cible: 'Agents et techniciens', effectif: retraites, echeance: 'Avant chaque départ', priorite: 'haute', responsable: RESPONSABLES.maintenance,
    });
    actions.push({
      levier: 'Fidéliser', action: 'Retenir les jeunes techniciens : rémunération et perspectives d’évolution',
      detail: PART_DEMISSIONS_TECH_MOINS_35 + ' % des démissions de techniciens concernent des moins de 35 ans, attirés par la concurrence (≈ ' +
        jeunesDemissionnaires + ' départs d’ici 2028).',
      cible: 'Techniciens de moins de 35 ans', effectif: techMoins35, echeance: '2027', priorite: 'haute', responsable: RESPONSABLES.drh,
    });
    if (surplusAgents > 0) {
      actions.push({
        levier: 'Mobilité et reconversion', action: 'Orienter le surplus d’agents (+' + surplusAgents + ') vers la maintenance de 1er niveau',
        detail: 'Après l’automatisation des deux lignes d’assemblage : formation à la maintenance de 1er niveau.',
        cible: 'Agents d’exécution', effectif: surplusAgents, echeance: '2027', priorite: 'moyenne', responsable: RESPONSABLES.industriel,
      });
    }
    if (deficitCadres > 0) {
      actions.push({
        levier: 'Recruter', action: 'Recruter ' + deficitCadres + ' cadres pour la cellule « Innovation et transformation digitale »',
        detail: 'Profils management agile, IA appliquée et pilotage de l’innovation (' + agile.aFormer + ' cadres à former au management agile).',
        cible: 'Cadres', effectif: deficitCadres, echeance: '2027', priorite: 'moyenne', responsable: RESPONSABLES.innovation,
      });
    }
    actions.push({
      levier: 'Mobilité interne', action: 'Promouvoir 15 techniciens chefs d’équipe maintenance prédictive',
      detail: 'Déjà intégré dans le calcul de l’effectif disponible (+15 cadres, −15 techniciens).',
      cible: 'Techniciens → cadres', effectif: 15, echeance: '2026–2028', priorite: 'moyenne', responsable: RESPONSABLES.maintenance,
    });
    actions.push({
      levier: 'Alternance', action: 'Partenariat avec un établissement de formation local',
      detail: 'Alternance et stages : viser 1 recrutement de technicien sur 4 par cette voie.',
      cible: 'Techniciens', effectif: Math.round(deficitTechniciens / 4), echeance: 'Rentrée 2027', priorite: 'moyenne', responsable: RESPONSABLES.drh,
    });
    actions.push({
      levier: 'Piloter', action: 'Actualiser chaque année le modèle prévisionnel avec les données du SIRH',
      detail: 'Une prévision n’est pas une certitude : on compare chaque année le prévu et le réalisé.',
      cible: 'Toutes catégories', effectif: effectifTotal, echeance: 'Chaque janvier', priorite: 'basse', responsable: RESPONSABLES.drh,
    });
    return actions;
  }

  /* ------------------------------------------------------------------------
     9. Ce que le reste du site peut utiliser
     ------------------------------------------------------------------------ */
  window.RH = {
    entreprise: ENTREPRISE,
    anneeReference: ANNEE_REFERENCE,
    anneesPrevision: ANNEES_PREVISION,
    horizon: HORIZON,
    ageRetraiteDefaut: AGE_RETRAITE_DEFAUT,
    partDemissionsTechMoins35: PART_DEMISSIONS_TECH_MOINS_35,
    delaiRecrutementMois: DELAI_RECRUTEMENT_MOIS,
    budgetFormationMDH: BUDGET_FORMATION_MDH,
    categories: CATEGORIES.map((c) => ({
      id: c.id, nom: c.nom, court: c.court, pluriel: c.pluriel,
      tauxDemission: c.tauxDemission, mobilite: c.mobilite, besoin2028: c.besoin2028,
    })),
    salaries: salaries,
    indicateurs: indicateurs,
    pyramide: pyramide,
    detailCategories: detailCategories,
    scenarios: SCENARIOS,
    prevoir: prevoir,
    statutEcart: statutEcart,
    competences: COMPETENCES,
    besoinsCompetences: besoinsCompetences,
    metiers: METIERS,
    scoreBase: SCORE_BASE,
    seuilsRisque: SEUILS_RISQUE,
    facteursRisque: FACTEURS_RISQUE.map((f) => ({ id: f.id, nom: f.nom })),
    salariesSuivis: salariesSuivis,
    responsables: RESPONSABLES,
    genererPlanAction: genererPlanAction,
  };
})();
