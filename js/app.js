/* ==========================================================================
   js/app.js — Fonctionnement du portail RH « TECHNOVA INDUSTRIE SA »
   Navigation entre les pages, graphiques (Chart.js), tableaux, animations.
   Toutes les données viennent de js/data.js (objet window.RH).
   Rien de ce qui est saisi n'est lu, enregistré, envoyé ni affiché.
   ========================================================================== */

(function () {
  'use strict';

  const RH = window.RH;
  if (!RH) return; // js/data.js absent : rien à afficher

  const doc = document;
  const $ = (selecteur, racine) => (racine || doc).querySelector(selecteur);
  const $$ = (selecteur, racine) => Array.from((racine || doc).querySelectorAll(selecteur));
  const reduireAnimations = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ecranEtroit = window.matchMedia('(max-width: 640px)');

  /* ------------------------------------------------------------------------
     1. Formats français : 1 250 000 MAD · 12,5 % · lundi 9 novembre 2026
     ------------------------------------------------------------------------ */
  // Espaces insécables : bien visibles, même en grand sur un vidéoprojecteur
  const ESPACE_FINE = ' '; // avant %  (12,5 %)
  const ESPACE = ' ';      // avant : ? ! et unités
  const formats = [0, 1, 2].map((d) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  // Séparateur de milliers : espace insécable normale (1 250 000), plus lisible que l'espace fine
  const nombre = (decimales, n) => formats[decimales].format(n).replace(/ /g, ' ');
  const formatDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const fmt = {
    entier: (n) => nombre(0, Math.round(n)),
    signe: (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + nombre(0, Math.abs(Math.round(n))),
    decimal: (n) => nombre(1, n),
    pourcentage: (n, decimales) => nombre(decimales === undefined ? 1 : decimales, n) + ESPACE_FINE + '%',
    mad: (n) => nombre(0, Math.round(n)) + ESPACE + 'MAD',
    ans: (n) => nombre(1, n) + ESPACE + 'ans',
  };

  // Échappe un texte avant de l'insérer dans du HTML
  const echapper = (texte) => String(texte).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const somme = (liste) => liste.reduce((a, b) => a + b, 0);

  /* ------------------------------------------------------------------------
     2. Couleurs (palette stricte : nuances d'un même bleu + couleurs d'état)
     Bleu foncé + bleu 500 : écart de clarté vérifié (lisible aussi pour les
     personnes daltoniennes) et contraste suffisant sur le fond des cartes.
     ------------------------------------------------------------------------ */
  const C = {
    bleu900: '#0B2545', bleu800: '#13315C', bleu600: '#365E98', bleu500: '#507AB6',
    bleu400: '#759AD0', bleu300: '#9CB9E5', bleu200: '#C1D4F1', bleu100: '#DCE7F7', bleu50: '#EEF4FB',
    blanc: '#FFFFFF', gris: '#5A6B80',
    rouge: '#C0392B', ambre: '#E0A100', vert: '#2E8B57',
  };
  C.grille = C.bleu200;  // lignes de grille : discrètes
  C.surface = C.bleu50;  // fond des cartes (sert d'anneau autour des points)

  /* ------------------------------------------------------------------------
     3. Configuration de Chart.js en français
     ------------------------------------------------------------------------ */
  // Étiquettes de valeurs : au bout des barres (ou à l'intérieur), au dernier point d'une courbe
  const pluginEtiquettes = {
    id: 'etiquettes',
    afterDatasetsDraw(chart, args, options) {
      if (!options) return;
      const texte = typeof options.texte === 'function' ? options.texte : null;
      const interieur = typeof options.interieur === 'function' ? options.interieur : null;
      if (!texte && !interieur) return;
      const ctx = chart.ctx;
      const police = Chart.defaults.font.family;
      const horizontal = chart.options.indexAxis === 'y';
      ctx.save();
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach((jeu, indexJeu) => {
        if (!chart.isDatasetVisible(indexJeu)) return;
        chart.getDatasetMeta(indexJeu).data.forEach((element, i) => {
          const valeur = jeu.data[i];
          if (interieur && horizontal) {
            const t = interieur(valeur, i, indexJeu);
            if (t) {
              ctx.font = '700 12px ' + police;
              const place = Math.abs(element.x - element.base);
              if (ctx.measureText(t).width + 14 < place) {
                ctx.fillStyle = C.blanc;
                ctx.textAlign = 'center';
                ctx.fillText(t, (element.x + element.base) / 2, element.y);
              }
            }
          }
          if (!texte) return;
          const t = texte(valeur, i, indexJeu);
          if (!t) return;
          ctx.font = '700 13px ' + police;
          ctx.fillStyle = C.bleu900;
          if (chart.config.type === 'line') {
            ctx.textAlign = 'left';
            ctx.fillText(t, element.x + 10, element.y);
          } else if (horizontal) {
            const negatif = valeur < 0;
            ctx.textAlign = negatif ? 'right' : 'left';
            ctx.fillText(t, element.x + (negatif ? -8 : 8), element.y);
          } else {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(t, element.x, element.y - 6);
            ctx.textBaseline = 'middle';
          }
        });
      });
      ctx.restore();
    },
  };

  // Ligne verticale qui suit la souris sur les courbes
  const pluginReticule = {
    id: 'reticule',
    afterDatasetsDraw(chart, args, options) {
      if (!options || !options.actif || !chart.tooltip) return;
      const actifs = chart.tooltip.getActiveElements();
      if (!actifs.length) return;
      const x = actifs[0].element.x;
      const zone = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = C.gris;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, zone.top);
      ctx.lineTo(x, zone.bottom);
      ctx.stroke();
      ctx.restore();
    },
  };

  function configurerChartJs() {
    const D = Chart.defaults;
    D.locale = 'fr-FR'; // nombres des axes au format français (1 000 ; 12,5)
    D.font.family = getComputedStyle(doc.body).fontFamily;
    D.font.size = 13;
    D.color = C.gris;
    D.borderColor = C.grille;
    D.responsive = true;
    D.maintainAspectRatio = false;
    D.animation.duration = reduireAnimations ? 0 : 700;

    D.elements.bar.borderRadius = 4;
    D.elements.line.borderWidth = 2.5;
    D.elements.line.borderCapStyle = 'round';
    D.elements.line.borderJoinStyle = 'round';
    D.elements.point.radius = 4;
    D.elements.point.hoverRadius = 6;
    D.elements.point.borderWidth = 2;
    D.elements.point.hitRadius = 14;

    const legende = D.plugins.legend.labels;
    legende.usePointStyle = true;
    legende.boxWidth = 10;
    legende.boxHeight = 10;
    legende.padding = 12;
    legende.color = C.bleu900;
    legende.font = { size: 13, weight: '600' };

    const infobulle = D.plugins.tooltip;
    infobulle.backgroundColor = C.bleu900;
    infobulle.titleColor = C.blanc;
    infobulle.bodyColor = C.blanc;
    infobulle.footerColor = C.blanc;
    infobulle.padding = 12;
    infobulle.cornerRadius = 8;
    infobulle.titleFont = { size: 13, weight: '700' };
    infobulle.bodyFont = { size: 13 };
    infobulle.footerFont = { size: 13, weight: '700' };
    infobulle.boxPadding = 6;
    infobulle.usePointStyle = true;

    Chart.register(pluginEtiquettes, pluginReticule);
  }

  const graphiques = {}; // graphiques affichés (pour les recréer proprement)
  const tableaux = {};   // données des tableaux « Voir les données »

  function creerGraphique(id, configuration) {
    const toile = doc.getElementById(id);
    if (!toile || !window.Chart) return null;
    if (graphiques[id]) graphiques[id].destroy();
    graphiques[id] = new Chart(toile, configuration);
    return graphiques[id];
  }

  function detruireGraphiques() {
    Object.keys(graphiques).forEach((id) => {
      graphiques[id].destroy();
      delete graphiques[id];
    });
  }

  /* ------------------------------------------------------------------------
     4. Pages et niveaux d'analyse
     ------------------------------------------------------------------------ */
  // Étiquette de module affichée à côté du titre de chaque page
  const MODULES = {
    descriptif: { nom: 'Analyse descriptive', icone: 'ico-graphique' },
    predictif: { nom: 'Analyse prédictive', icone: 'ico-courbe' },
    prescriptif: { nom: 'Analyse prescriptive', icone: 'ico-cible' },
    methode: { nom: 'Documentation', icone: 'ico-livre' },
  };

  const PAGES = [
    { id: 'vue-ensemble', titre: "Vue d'ensemble", niveau: 'descriptif', rendu: rendreVueEnsemble, graphiques: graphiquesVueEnsemble },
    { id: 'previsions', titre: 'Prévisions 2026–2028', niveau: 'predictif', rendu: rendrePrevisions,
      graphiques: () => majTableauFlux(previsionCourante()) },
    { id: 'risque', titre: 'Risque de départ', niveau: 'predictif', rendu: rendreRisque },
    { id: 'competences', titre: 'Compétences de demain', niveau: 'predictif', rendu: rendreCompetences },
    { id: 'plan-action', titre: "Plan d'action GPEC", niveau: 'prescriptif', rendu: rendrePlanAction },
    { id: 'methodologie', titre: 'Méthodologie & éthique', niveau: 'methode', rendu: rendreMethodologie },
  ];
  const NOM_SITE = 'Portail RH · TECHNOVA INDUSTRIE SA';

  function creerBadge(niveau) {
    const m = MODULES[niveau] || MODULES.methode;
    const etiquette = doc.createElement('span');
    etiquette.className = 'module module--' + niveau;
    etiquette.innerHTML = '<svg class="icone" aria-hidden="true"><use href="#' + m.icone + '"></use></svg>';
    etiquette.appendChild(doc.createTextNode(m.nom));
    return etiquette;
  }

  function construireElementsCommuns() {
    PAGES.forEach((page) => {
      const section = doc.getElementById('page-' + page.id);
      if (!section) return;
      const emplacement = $('[data-badge]', section);
      if (emplacement) emplacement.replaceWith(creerBadge(page.niveau));
    });
    // Cloche de la barre du haut : nombre d'alertes critiques (scénario central)
    const critiques = genererAlertes(RH.prevoir('central')).filter((a) => a.niveau === 'critique').length;
    $('#nombre-alertes').textContent = critiques;
    $('#lien-alertes').setAttribute('aria-label', critiques + ' alertes prédictives');
  }

  // Onglets (téléphone) : un seul graphique ou tableau visible à la fois
  function initialiserOnglets(conteneur) {
    const panneaux = Array.from(conteneur.children).filter((e) => e.dataset.onglet);
    if (!panneaux.length) return;
    let barre = conteneur.previousElementSibling;
    if (!barre || !barre.classList.contains('onglets__barre')) {
      barre = doc.createElement('div');
      barre.className = 'onglets__barre';
      barre.setAttribute('role', 'tablist');
      conteneur.parentNode.insertBefore(barre, conteneur);
    }
    barre.textContent = '';
    const choisir = (index) => {
      panneaux.forEach((panneau, i) => panneau.classList.toggle('onglet-inactif', i !== index));
      Array.from(barre.children).forEach((bouton, i) => bouton.setAttribute('aria-selected', String(i === index)));
      panneaux[index].querySelectorAll('canvas').forEach((toile) => { if (graphiques[toile.id]) graphiques[toile.id].resize(); });
    };
    panneaux.forEach((panneau, i) => {
      const bouton = doc.createElement('button');
      bouton.type = 'button';
      bouton.setAttribute('role', 'tab');
      bouton.textContent = panneau.dataset.onglet;
      bouton.addEventListener('click', () => choisir(i));
      barre.appendChild(bouton);
    });
    choisir(0);
  }

  // Sections repliables : ouvertes sur grand écran, fermées sur téléphone
  function appliquerReplis(racine) {
    $$('details[data-repli-mobile]', racine).forEach((details) => {
      if (ecranEtroit.matches && !details.hasAttribute('data-ouvert-mobile')) details.removeAttribute('open');
      else details.setAttribute('open', '');
    });
  }

  /* ------------------------------------------------------------------------
     5. Navigation : connexion ⇄ portail, pages, menu mobile
     ------------------------------------------------------------------------ */
  let pageCourante = null;

  function pageDepuisAdresse() {
    const id = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
    return PAGES.find((p) => p.id === id) || null;
  }

  function appliquerAdresse() {
    const page = pageDepuisAdresse();
    if (page) afficherPortail(page);
    else afficherConnexion();
  }

  function afficherConnexion() {
    detruireGraphiques();
    fermerMenu();
    fermerFeuille();
    $('#ecran-portail').hidden = true;
    $('#ecran-connexion').hidden = false;
    doc.body.classList.remove('est-connecte');
    doc.title = 'Connexion — ' + NOM_SITE;
    pageCourante = null;
  }

  function afficherPortail(page) {
    const venaitDeLaConnexion = pageCourante === null;
    $('#ecran-connexion').hidden = true;
    $('#ecran-portail').hidden = false;
    doc.body.classList.add('est-connecte');
    fermerMenu();

    $$('.page').forEach((section) => { section.hidden = section.dataset.page !== page.id; });
    $$('[data-lien]').forEach((lien) => {
      const actif = lien.dataset.lien === page.id;
      lien.classList.toggle('est-actif', actif);
      if (actif) lien.setAttribute('aria-current', 'page');
      else lien.removeAttribute('aria-current');
    });

    doc.title = page.titre + ' — ' + NOM_SITE;
    $('#fil-page').textContent = page.titre;
    fermerFeuille();
    window.scrollTo(0, 0);
    detruireGraphiques();
    pageCourante = page.id;
    if (page.rendu) page.rendu();
    const section = doc.getElementById('page-' + page.id);
    appliquerReplis(section);
    $$('[data-onglets]', section).forEach(initialiserOnglets);

    if (!venaitDeLaConnexion) {
      const titre = $('#page-' + page.id + ' .titre-page');
      if (titre) titre.focus({ preventScroll: true });
    }
  }

  function ouvrirMenu() {
    doc.body.classList.add('menu-ouvert');
    $('#voile-menu').hidden = false;
    $('#bouton-menu').setAttribute('aria-expanded', 'true');
  }

  function fermerMenu() {
    doc.body.classList.remove('menu-ouvert');
    $('#voile-menu').hidden = true;
    $('#bouton-menu').setAttribute('aria-expanded', 'false');
  }

  function brancherEvenements() {
    // Connexion de démonstration : on ne lit pas les champs, on ouvre le portail.
    $('#formulaire-connexion').addEventListener('submit', (evenement) => {
      evenement.preventDefault();
      location.hash = '#vue-ensemble';
    });

    $('#bouton-deconnexion').addEventListener('click', () => {
      $('#formulaire-connexion').reset(); // remet les valeurs de démonstration
      location.hash = '#connexion';
    });

    $('#bouton-menu').addEventListener('click', ouvrirMenu);
    $('#bouton-fermer-menu').addEventListener('click', fermerMenu);
    $('#voile-menu').addEventListener('click', fermerMenu);
    $$('.menu-lien').forEach((lien) => lien.addEventListener('click', fermerMenu));
    doc.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Escape') {
        fermerMenu();
        fermerFeuille();
      }
    });

    // Alertes : « Voir toutes les alertes » sur téléphone
    $('#bouton-alertes').addEventListener('click', () => {
      const liste = $('#alertes-previsions');
      const reduite = liste.classList.toggle('est-reduite');
      const bouton = $('#bouton-alertes');
      bouton.textContent = reduite ? 'Voir les ' + liste.children.length + ' alertes' : 'Réduire la liste';
      bouton.setAttribute('aria-expanded', String(!reduite));
    });

    // Fiche salarié (téléphone) : fermeture par le voile
    $('#voile-detail').addEventListener('click', fermerFeuille);

    // Boutons « Voir les données » : affichent le tableau sous le graphique
    doc.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('[data-bascule-tableau]');
      if (!bouton) return;
      const cle = bouton.dataset.basculeTableau;
      const zone = doc.getElementById('donnees-' + cle);
      if (!zone) return;
      const ouvrir = zone.hidden;
      if (ouvrir) construireTableau(zone, tableaux[cle]);
      zone.hidden = !ouvrir;
      bouton.setAttribute('aria-expanded', String(ouvrir));
      libellerBoutonDonnees(bouton, ouvrir);
    });

    window.addEventListener('hashchange', appliquerAdresse);

    // Passage téléphone ⇄ grand écran : on redessine les graphiques de la page
    const auChangement = () => {
      fermerFeuille();
      const page = PAGES.find((p) => p.id === pageCourante);
      if (!page) return;
      if (page.graphiques) page.graphiques();
      appliquerReplis(doc.getElementById('page-' + page.id));
    };
    if (ecranEtroit.addEventListener) ecranEtroit.addEventListener('change', auChangement);
    else if (ecranEtroit.addListener) ecranEtroit.addListener(auChangement);
  }

  /* ------------------------------------------------------------------------
     6. Petits outils d'affichage
     ------------------------------------------------------------------------ */
  function construireTableau(zone, donnees) {
    zone.textContent = '';
    if (!donnees) return;
    const table = doc.createElement('table');
    table.className = 'tableau';
    const legende = doc.createElement('caption');
    legende.textContent = donnees.legende;
    table.appendChild(legende);
    const ligneEntete = table.createTHead().insertRow();
    donnees.entetes.forEach((texte) => {
      const th = doc.createElement('th');
      th.scope = 'col';
      th.textContent = texte;
      ligneEntete.appendChild(th);
    });
    const corps = table.createTBody();
    donnees.lignes.forEach((ligne) => {
      const tr = corps.insertRow();
      ligne.forEach((valeur, i) => {
        const cellule = doc.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) cellule.scope = 'row';
        cellule.textContent = valeur;
        tr.appendChild(cellule);
      });
    });
    zone.appendChild(table);
  }

  function reinitialiserTableaux(racine) {
    $$('[data-bascule-tableau]', racine).forEach((bouton) => {
      const zone = doc.getElementById('donnees-' + bouton.dataset.basculeTableau);
      if (zone) zone.hidden = true;
      bouton.setAttribute('aria-expanded', 'false');
      libellerBoutonDonnees(bouton, false);
    });
  }

  function libellerBoutonDonnees(bouton, ouvert) {
    const texte = ouvert ? 'Masquer les données' : 'Voir les données';
    if (bouton.classList.contains('bouton-donnees')) {
      bouton.setAttribute('aria-label', texte);
      bouton.title = texte;
    } else {
      bouton.textContent = texte;
    }
  }

  // Les chiffres « montent » jusqu'à leur valeur (animation légère)
  function animerNombre(element, cible, formater) {
    element.textContent = formater(cible);
    if (reduireAnimations) return;
    const duree = 900;
    const debut = performance.now();
    const etape = (maintenant) => {
      const p = Math.min(1, (maintenant - debut) / duree);
      const adouci = 1 - Math.pow(1 - p, 3);
      element.textContent = formater(p < 1 ? cible * adouci : cible);
      if (p < 1) requestAnimationFrame(etape);
    };
    requestAnimationFrame(etape);
  }

  function rendreKpi(conteneur, liste) {
    conteneur.textContent = '';
    liste.forEach((kpi, i) => {
      const carte = doc.createElement('article');
      carte.className = 'kpi' + (kpi.large ? ' kpi--large' : '');
      carte.style.animationDelay = i * 45 + 'ms';
      carte.innerHTML =
        '<div class="kpi__haut"><span class="kpi__icone" aria-hidden="true"><svg class="icone"><use href="#' + kpi.icone + '"></use></svg></span>' +
        '<p class="kpi__libelle"></p></div>' +
        '<p class="kpi__valeur"></p><p class="kpi__detail"></p>';
      $('.kpi__libelle', carte).textContent = kpi.libelle;
      $('.kpi__detail', carte).textContent = kpi.detail;
      conteneur.appendChild(carte);
      animerNombre($('.kpi__valeur', carte), kpi.valeur, kpi.format);
    });
  }

  // Coupe un libellé long sur plusieurs lignes (axes des graphiques)
  function decouperLibelle(texte, longueurMax) {
    const lignes = [];
    let ligne = '';
    texte.split(' ').forEach((mot) => {
      const essai = ligne ? ligne + ' ' + mot : mot;
      if (essai.length > longueurMax && ligne) {
        lignes.push(ligne);
        ligne = mot;
      } else {
        ligne = essai;
      }
    });
    if (ligne) lignes.push(ligne);
    return lignes.length > 1 ? lignes : lignes[0];
  }

  // Libellé long sur grand écran, court sur téléphone (dans les tableaux)
  function libelleDouble(long, court) {
    const fragment = doc.createDocumentFragment();
    [['nom-long', long], ['nom-court', court]].forEach(([classe, texte]) => {
      const span = doc.createElement('span');
      span.className = classe;
      span.textContent = texte;
      fragment.appendChild(span);
    });
    return fragment;
  }

  const ORDRE_CATEGORIES = ['cadres', 'techniciens', 'agents'];
  const categorieRH = (id) => RH.categories.find((c) => c.id === id);
  const detailCategorie = (id) => RH.detailCategories.find((d) => d.id === id);

  /* ------------------------------------------------------------------------
     7. PAGE « VUE D'ENSEMBLE » (Descriptif) — diagnostic au 31/12/2025
     ------------------------------------------------------------------------ */
  function rendreVueEnsemble() {
    const section = doc.getElementById('page-vue-ensemble');
    reinitialiserTableaux(section);

    const aujourdhui = new Date();
    const date = $('#date-du-jour');
    date.textContent = formatDate.format(aujourdhui);
    date.setAttribute('datetime', aujourdhui.toISOString().slice(0, 10));

    const k = RH.indicateurs;
    rendreKpi($('#kpi-vue-ensemble'), [
      { libelle: 'Effectif total', valeur: k.effectifTotal, format: fmt.entier, icone: 'ico-equipe',
        detail: 'salariés au 31/12/2025 · ' + RH.categories.length + ' catégories' },
      { libelle: 'Taux de turnover', valeur: k.tauxTurnover, format: (v) => fmt.pourcentage(v, 2), icone: 'ico-rotation',
        detail: fmt.entier(k.demissionsParAn) + ' démissions par an (taux du TD)' },
      { libelle: "Taux d'absentéisme", valeur: k.tauxAbsenteisme, format: (v) => fmt.pourcentage(v), icone: 'ico-calendrier',
        detail: 'du temps de travail théorique' },
      { libelle: 'Âge moyen', valeur: k.ageMoyen, format: fmt.ans, icone: 'ico-personne',
        detail: fmt.entier(k.nbPlus50) + ' salariés ont 50 ans ou plus (' + fmt.pourcentage(k.partPlus50) + ')' },
      { libelle: 'Ancienneté moyenne', valeur: k.ancienneteMoyenne, format: fmt.ans, icone: 'ico-horloge',
        detail: 'dans l’entreprise' },
      { libelle: 'Salariés formés en 2025', valeur: k.partFormes2025, format: (v) => fmt.pourcentage(v), icone: 'ico-formation',
        detail: fmt.entier(k.nbFormes2025) + ' salariés sur ' + fmt.entier(k.effectifTotal) },
      { libelle: 'Masse salariale annuelle', valeur: k.masseSalarialeAnnuelle, format: fmt.mad, icone: 'ico-billet', large: true,
        detail: 'salaires bruts · ' + fmt.mad(k.salaireMoyenMensuel) + ' par mois en moyenne' },
    ]);

    rendreFaitsMarquants();
    graphiquesVueEnsemble();
  }

  function graphiquesVueEnsemble() {
    graphiquePyramide();
    graphiqueCategories();
    graphiqueAges();
  }

  function graphiquePyramide() {
    const p = RH.pyramide;
    const maximum = Math.max.apply(null, p.hommes.concat(p.femmes));
    const pas = maximum > 80 ? 50 : 20;
    const borne = Math.ceil((maximum + 5) / pas) * pas;
    const totalH = somme(p.hommes);
    const totalF = somme(p.femmes);
    const commun = { maxBarThickness: 24, barPercentage: 0.9, categoryPercentage: 0.9 };

    creerGraphique('graph-pyramide', {
      type: 'bar',
      data: {
        labels: p.tranches,
        datasets: [
          Object.assign({ label: 'Hommes', data: p.hommes.map((v) => -v), backgroundColor: C.bleu900, hoverBackgroundColor: C.bleu800 }, commun),
          Object.assign({ label: 'Femmes', data: p.femmes, backgroundColor: C.bleu500, hoverBackgroundColor: C.bleu600 }, commun),
        ],
      },
      options: {
        indexAxis: 'y',
        interaction: { mode: 'index', axis: 'y', intersect: false },
        scales: {
          x: {
            stacked: true, min: -borne, max: borne,
            ticks: { stepSize: pas, maxRotation: 0, callback: (v) => fmt.entier(Math.abs(v)) },
            grid: { color: C.grille }, border: { display: false },
          },
          y: {
            stacked: true, grid: { display: false }, border: { display: false },
            ticks: { color: C.bleu900, font: { weight: '600' } },
          },
        },
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: (c) => ' ' + c.dataset.label + ESPACE + ': ' + fmt.entier(Math.abs(c.raw)) } },
        },
      },
    });

    $('#graph-pyramide').setAttribute('aria-label',
      'Pyramide des âges : ' + fmt.entier(totalH) + ' hommes et ' + fmt.entier(totalF) + ' femmes. Les 55–59 ans comptent ' + (p.hommes[0] + p.femmes[0]) + ' salariés.');
    tableaux.pyramide = {
      legende: 'Pyramide des âges au 31/12/2025 (nombre de salariés)',
      entetes: ["Tranche d'âge", 'Hommes', 'Femmes', 'Total'],
      lignes: p.tranches.map((t, i) => [t, fmt.entier(p.hommes[i]), fmt.entier(p.femmes[i]), fmt.entier(p.hommes[i] + p.femmes[i])])
        .concat([['Total', fmt.entier(totalH), fmt.entier(totalF), fmt.entier(totalH + totalF)]]),
    };
  }

  function graphiqueCategories() {
    const d = RH.detailCategories;
    const etroit = $('#graph-categories').parentElement.clientWidth < 480;
    const commun = { maxBarThickness: 24, barPercentage: 0.75, categoryPercentage: 0.9 };

    creerGraphique('graph-categories', {
      type: 'bar',
      data: {
        labels: d.map((x) => (etroit ? x.court : decouperLibelle(x.nom, 12))),
        datasets: [
          Object.assign({ label: 'Hommes', data: d.map((x) => x.hommes), backgroundColor: C.bleu900, hoverBackgroundColor: C.bleu800,
            borderColor: C.surface, borderWidth: { right: 2 } }, commun),
          Object.assign({ label: 'Femmes', data: d.map((x) => x.femmes), backgroundColor: C.bleu500, hoverBackgroundColor: C.bleu600 }, commun),
        ],
      },
      options: {
        indexAxis: 'y',
        layout: { padding: { right: 48 } },
        scales: {
          x: { stacked: true, display: false, beginAtZero: true },
          y: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: C.bleu900, font: { weight: '600' } } },
        },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              title: (elements) => d[elements[0].dataIndex].nom,
              label: (c) => ' ' + c.dataset.label + ESPACE + ': ' + fmt.entier(c.raw) + ' (' + fmt.pourcentage((100 * c.raw) / d[c.dataIndex].effectif) + ')',
            },
          },
          etiquettes: {
            interieur: (v) => fmt.entier(v),
            texte: (v, i, indexJeu) => (indexJeu === 1 ? fmt.entier(d[i].effectif) : ''),
          },
        },
      },
    });

    tableaux.categories = {
      legende: 'Effectifs par catégorie et par sexe au 31/12/2025 (TD TECHNOVA)',
      entetes: ['Catégorie', 'Hommes', 'Femmes', 'Total', 'Part de femmes'],
      lignes: d.map((x) => [x.nom, fmt.entier(x.hommes), fmt.entier(x.femmes), fmt.entier(x.effectif), fmt.pourcentage(x.partFemmes)])
        .concat([['Total', fmt.entier(somme(d.map((x) => x.hommes))), fmt.entier(somme(d.map((x) => x.femmes))),
          fmt.entier(RH.indicateurs.effectifTotal), fmt.pourcentage(RH.indicateurs.partFemmes)]]),
    };
  }

  function graphiqueAges() {
    const d = RH.detailCategories;
    const etroit = $('#graph-ages').parentElement.clientWidth < 480;
    const part = (i, indexJeu) => (indexJeu === 0 ? d[i].partMoins30 : d[i].partPlus50);
    const commun = { maxBarThickness: 22, barPercentage: 0.85, categoryPercentage: 0.8 };

    creerGraphique('graph-ages', {
      type: 'bar',
      data: {
        labels: d.map((x) => (etroit ? x.court : decouperLibelle(x.nom, 12))),
        datasets: [
          Object.assign({ label: 'Moins de 30 ans', data: d.map((x) => x.moins30), backgroundColor: C.bleu500, hoverBackgroundColor: C.bleu600 }, commun),
          Object.assign({ label: '50 ans et plus', data: d.map((x) => x.plus50), backgroundColor: C.bleu900, hoverBackgroundColor: C.bleu800 }, commun),
        ],
      },
      options: {
        indexAxis: 'y',
        layout: { padding: { right: 62 } },
        scales: {
          x: { display: false, beginAtZero: true },
          y: { grid: { display: false }, border: { display: false }, ticks: { color: C.bleu900, font: { weight: '600' } } },
        },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              title: (elements) => d[elements[0].dataIndex].nom,
              label: (c) => ' ' + c.dataset.label + ESPACE + ': ' + fmt.entier(c.raw) + ' (' + fmt.pourcentage(part(c.dataIndex, c.datasetIndex)) + ')',
            },
          },
          etiquettes: { texte: (v, i, indexJeu) => fmt.pourcentage(part(i, indexJeu)) },
        },
      },
    });

    tableaux.ages = {
      legende: 'Moins de 30 ans et 50 ans et plus, par catégorie (TD TECHNOVA)',
      entetes: ['Catégorie', 'Effectif', 'Moins de 30 ans', '50 ans et plus'],
      lignes: d.map((x) => [x.nom, fmt.entier(x.effectif), fmt.entier(x.moins30) + ' (' + fmt.pourcentage(x.partMoins30) + ')',
        fmt.entier(x.plus50) + ' (' + fmt.pourcentage(x.partPlus50) + ')'])
        .concat([['Total', fmt.entier(RH.indicateurs.effectifTotal),
          fmt.entier(RH.indicateurs.nbMoins30) + ' (' + fmt.pourcentage(RH.indicateurs.partMoins30) + ')',
          fmt.entier(RH.indicateurs.nbPlus50) + ' (' + fmt.pourcentage(RH.indicateurs.partPlus50) + ')']]),
    };
  }

  function rendreFaitsMarquants() {
    const k = RH.indicateurs;
    const cadres = detailCategorie('cadres');
    const agents = detailCategorie('agents');
    const faits = [
      { icone: 'ico-equipe',
        html: 'Seulement <strong>' + echapper(fmt.pourcentage(k.partFemmes)) + ' de femmes</strong> (' + echapper(fmt.entier(k.nbFemmes)) +
          ' sur ' + echapper(fmt.entier(k.effectifTotal)) + ').' },
      { icone: 'ico-horloge',
        html: '<strong>' + echapper(fmt.pourcentage(agents.partPlus50)) + ' des agents d’exécution ont 50 ans ou plus</strong> (' +
          agents.plus50 + ' sur ' + agents.effectif + ')&nbsp;: risque de perte de savoir-faire.' },
      { icone: 'ico-personne',
        html: 'Peu de jeunes chez les cadres (' + echapper(fmt.pourcentage(cadres.partMoins30)) + ') et les agents (' +
          echapper(fmt.pourcentage(agents.partMoins30)) + ')&nbsp;: il faut préparer la <strong>transmission des connaissances</strong>.' },
    ];
    const liste = $('#faits-vue-ensemble');
    liste.textContent = '';
    faits.forEach((fait) => {
      const element = doc.createElement('li');
      element.innerHTML = '<svg class="icone" aria-hidden="true"><use href="#' + fait.icone + '"></use></svg><span>' + fait.html + '</span>';
      liste.appendChild(element);
    });
  }

  /* ------------------------------------------------------------------------
     8. État partagé entre les pages : scénario et âge de départ choisis
     (gardé en mémoire uniquement, jamais enregistré)
     ------------------------------------------------------------------------ */
  const etat = {
    scenario: 'central',
    ageRetraite: RH.ageRetraiteDefaut,
  };
  const previsionCourante = () => RH.prevoir(etat.scenario, etat.ageRetraite);

  const STATUTS = {
    surplus: { libelle: 'Surplus', icone: 'ico-fleche-haut' },
    deficit: { libelle: 'Déficit', icone: 'ico-fleche-bas' },
    equilibre: { libelle: 'Équilibre', icone: 'ico-egal' },
  };

  function creerStatut(ecart, sansNombre) {
    const cle = RH.statutEcart(ecart);
    const puce = doc.createElement('span');
    puce.className = 'statut statut--' + cle;
    puce.innerHTML = '<svg class="icone" aria-hidden="true"><use href="#' + STATUTS[cle].icone + '"></use></svg>';
    puce.appendChild(doc.createTextNode(STATUTS[cle].libelle + (sansNombre ? '' : ' ' + fmt.signe(ecart))));
    return puce;
  }

  // Boutons « Pessimiste / Central / Optimiste »
  function rendreChoixScenario(conteneur, auChangement) {
    conteneur.textContent = '';
    Object.keys(RH.scenarios).forEach((id) => {
      const bouton = doc.createElement('button');
      bouton.type = 'button';
      bouton.setAttribute('role', 'radio');
      bouton.dataset.scenario = id;
      bouton.textContent = RH.scenarios[id].nom;
      bouton.setAttribute('aria-checked', String(id === etat.scenario));
      bouton.addEventListener('click', () => {
        if (etat.scenario === id) return;
        etat.scenario = id;
        $$('button', conteneur).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.scenario === id)));
        auChangement();
      });
      conteneur.appendChild(bouton);
    });
  }

  function texteHypotheses(p) {
    const sc = p.scenario;
    const croissance = (sc.croissance > 0 ? '+' : sc.croissance < 0 ? '−' : '') + fmt.pourcentage(Math.abs(sc.croissance * 100), 0);
    const besoins = ORDRE_CATEGORIES.map((id) => p.categories[id].besoin2028 + ' ' + categorieRH(id).pluriel.split(' ')[0]).join(', ');
    return 'Scénario <strong>' + echapper(sc.nom.toLowerCase()) + '</strong> — ' + echapper(sc.description.charAt(0).toLowerCase() + sc.description.slice(1)) +
      '. Croissance de l’activité <strong>' + echapper(croissance) + ' par an</strong>, automatisation à <strong>' +
      echapper(fmt.pourcentage(sc.rythmeAutomatisation * 100, 0)) + ' du rythme du plan</strong>. Besoins 2028&nbsp;: <strong>' + echapper(besoins) +
      '</strong>. Retraite à <strong>' + p.ageRetraite + '&nbsp;ans</strong>, sans aucune embauche.';
  }

  /* ------------------------------------------------------------------------
     9. PAGE « PRÉVISIONS 2026–2028 » (Prédictif)
     ------------------------------------------------------------------------ */
  function rendrePrevisions() {
    const section = doc.getElementById('page-previsions');
    reinitialiserTableaux(section);
    rendreChoixScenario($('[data-choix-scenario]', section), majPrevisions);

    const choixAge = $('#choix-age-retraite');
    choixAge.value = String(etat.ageRetraite);
    choixAge.onchange = () => {
      etat.ageRetraite = Number(choixAge.value);
      majPrevisions();
    };

    construireMultiples();
    majPrevisions();
  }

  function majPrevisions() {
    const p = previsionCourante();
    $('#hypotheses-previsions').innerHTML = texteHypotheses(p);
    rendreSynthese(p);
    rendreAlertes(genererAlertes(p));
    majMultiples(p);
    majTableauFlux(p);
    majTableauRetraites(p);
    majTableauDemissions(p);

    tableaux.previsions = {
      legende: 'Besoins, effectif disponible et écarts — scénario ' + p.scenario.nom.toLowerCase() + ', retraite à ' + p.ageRetraite + ' ans',
      entetes: ['Catégorie', 'Indicateur'].concat(p.annees.map(String)),
      lignes: [].concat.apply([], ORDRE_CATEGORIES.map((id) => {
        const s = p.categories[id];
        return [
          [categorieRH(id).nom, 'Besoins'].concat(s.besoins.map(fmt.entier)),
          ['', 'Effectif disponible'].concat(s.ressources.map(fmt.entier)),
          ['', 'Écart'].concat(s.ecarts.map(fmt.signe)),
        ];
      })),
    };
    const zone = $('#donnees-previsions');
    if (!zone.hidden) construireTableau(zone, tableaux.previsions);
  }

  function rendreSynthese(p) {
    const t = p.total;
    const conteneur = $('#synthese-previsions');
    conteneur.textContent = '';
    const tuiles = [
      { libelle: 'Effectif disponible au 31/12/2028', valeur: fmt.entier(t.disponible2028),
        detail: fmt.entier(t.effectif2025) + ' salariés en 2025 − ' + t.totalRetraites + ' retraites − ' + t.totalDemissions + ' démissions' },
      { libelle: 'Besoins 2028', valeur: fmt.entier(t.besoin2028), detail: 'plan « Industrie 4.0 », scénario ' + p.scenario.nom.toLowerCase() },
      { libelle: 'Écart 2028', valeur: fmt.signe(t.ecart2028), fonce: true, statut: true,
        detail: t.ecart2028 < 0 ? Math.abs(t.ecart2028) + ' salariés manquants si l’entreprise ne fait rien' : 'salariés en surplus' },
    ];
    tuiles.forEach((tuile, i) => {
      const element = doc.createElement('article');
      element.className = 'synthese' + (tuile.fonce ? ' synthese--fonce' : '');
      element.style.animationDelay = i * 50 + 'ms';
      element.innerHTML = '<p class="synthese__libelle"></p><p class="synthese__valeur"><span></span></p><p class="synthese__detail"></p>';
      $('.synthese__libelle', element).textContent = tuile.libelle;
      $('.synthese__valeur span', element).textContent = tuile.valeur;
      if (tuile.statut) $('.synthese__valeur', element).appendChild(creerStatut(t.ecart2028, true));
      $('.synthese__detail', element).textContent = tuile.detail;
      conteneur.appendChild(element);
    });
  }

  function genererAlertes(p) {
    const c = p.categories;
    const t = p.total;
    const alertes = [];
    const deficits = ORDRE_CATEGORIES.filter((id) => c[id].ecart2028 < 0).sort((a, b) => c[a].ecart2028 - c[b].ecart2028);

    // 1. Le plus gros déficit, et sa part dans le déficit total
    if (deficits.length) {
      const id = deficits[0];
      const e = Math.abs(c[id].ecart2028);
      let html = '<strong>Déficit de ' + e + ' ' + echapper(categorieRH(id).pluriel) + '</strong> en 2028 (' + c[id].disponible2028 +
        ' disponibles pour ' + c[id].besoin2028 + ' besoins)';
      if (t.ecart2028 < 0) html += '&nbsp;: ' + echapper(fmt.pourcentage((100 * e) / Math.abs(t.ecart2028), 0)) + ' du déficit total (' + e + ' sur ' + Math.abs(t.ecart2028) + ').';
      else html += '.';
      alertes.push({ niveau: 'critique', etiquette: 'Déficit · ' + categorieRH(id).court, icone: 'ico-fleche-bas', html: html });
    }

    // 2. Départs à la retraite : la catégorie la plus touchée
    const retraite = ORDRE_CATEGORIES
      .map((id) => ({ id: id, n: c[id].totalRetraites, part: c[id].totalRetraites / c[id].effectif2025 }))
      .sort((a, b) => b.part - a.part)[0];
    if (retraite.n > 0) {
      const detail = detailCategorie(retraite.id);
      alertes.push({
        niveau: 'critique', etiquette: 'Départs à la retraite', icone: 'ico-horloge',
        html: '<strong>' + t.totalRetraites + ' départs à la retraite</strong> d’ici 2028, dont ' + retraite.n + ' ' + echapper(categorieRH(retraite.id).pluriel) +
          ', une catégorie où ' + echapper(fmt.pourcentage(detail.partPlus50)) + ' des salariés ont 50 ans ou plus (risque de perte de savoir-faire).',
      });
    }

    // 3. Démissions des jeunes techniciens (alerte du TD)
    const demissionsTech = c.techniciens.totalDemissions;
    alertes.push({
      niveau: 'critique', etiquette: 'Démissions · Techniciens', icone: 'ico-risque',
      html: '<strong>' + demissionsTech + ' démissions de techniciens</strong> prévues d’ici 2028&nbsp;: ' + RH.partDemissionsTechMoins35 +
        '&nbsp;% concernent des moins de 35 ans, attirés par la concurrence (≈&nbsp;' + Math.round((demissionsTech * RH.partDemissionsTechMoins35) / 100) + ').',
    });

    // 4. Les autres déficits
    deficits.slice(1).forEach((id) => {
      let html = '<strong>Déficit de ' + Math.abs(c[id].ecart2028) + ' ' + echapper(categorieRH(id).pluriel) + '</strong> en 2028';
      if (c[id].totalMobilite > 0) html += ', malgré la promotion de ' + c[id].totalMobilite + ' techniciens';
      alertes.push({ niveau: 'critique', etiquette: 'Déficit · ' + categorieRH(id).court, icone: 'ico-fleche-bas', html: html + '.' });
    });

    // 5. Surplus
    ORDRE_CATEGORIES.filter((id) => c[id].ecart2028 > 0).forEach((id) => {
      let html = '<strong>Surplus de ' + c[id].ecart2028 + ' ' + echapper(categorieRH(id).pluriel) + '</strong> en 2028';
      if (id === 'agents') html += ' avec l’automatisation de deux lignes d’assemblage&nbsp;: un vivier pour la maintenance de 1er niveau.';
      else html += '.';
      alertes.push({ niveau: 'positif', etiquette: 'Surplus · ' + categorieRH(id).court, icone: 'ico-fleche-haut', html: html });
    });

    // 6. Synthèse
    alertes.push({
      niveau: 'info', etiquette: 'Synthèse 2028', icone: 'ico-ampoule',
      html: '<strong>' + echapper(fmt.entier(t.disponible2028)) + ' salariés disponibles pour ' + echapper(fmt.entier(t.besoin2028)) + ' besoins</strong>&nbsp;: ' +
        (t.ecart2028 < 0 ? 'déficit de ' + Math.abs(t.ecart2028) : 'surplus de ' + t.ecart2028) + ' salariés. Le plan d’action GPEC doit combler cet écart.',
    });
    return alertes;
  }

  function rendreAlertes(alertes) {
    const liste = $('#alertes-previsions');
    liste.textContent = '';
    alertes.forEach((a, i) => {
      const element = doc.createElement('li');
      element.className = 'alerte alerte--' + a.niveau;
      element.style.animationDelay = i * 40 + 'ms';
      element.innerHTML = '<span class="alerte__icone" aria-hidden="true"><svg class="icone"><use href="#' + a.icone + '"></use></svg></span>' +
        '<span><span class="alerte__etiquette"></span>' + a.html + '</span>';
      $('.alerte__etiquette', element).textContent = a.etiquette;
      liste.appendChild(element);
    });
    const bouton = $('#bouton-alertes');
    liste.classList.add('est-reduite');
    bouton.hidden = alertes.length <= 3;
    bouton.textContent = 'Voir les ' + alertes.length + ' alertes';
    bouton.setAttribute('aria-expanded', 'false');
  }

  function construireMultiples() {
    const grille = $('#grille-previsions');
    grille.textContent = '';
    ORDRE_CATEGORIES.forEach((id, i) => {
      const carte = doc.createElement('article');
      carte.className = 'carte carte--multiple';
      carte.dataset.onglet = categorieRH(id).court;
      carte.style.animationDelay = i * 50 + 'ms';
      carte.innerHTML = '<div class="multiple__entete"><h3 class="multiple__titre"></h3><span data-statut></span></div>' +
        '<p class="multiple__chiffres"></p>' +
        '<div class="zone-graphique zone-graphique--multiple"><canvas id="graph-prev-' + id + '" role="img"></canvas></div>';
      $('.multiple__titre', carte).textContent = categorieRH(id).nom;
      grille.appendChild(carte);
    });
  }

  function majMultiples(p) {
    ORDRE_CATEGORIES.forEach((id) => {
      const s = p.categories[id];
      const toile = doc.getElementById('graph-prev-' + id);
      const carte = toile.closest('.carte');

      const statut = creerStatut(s.ecart2028);
      statut.setAttribute('data-statut', '');
      $('[data-statut]', carte).replaceWith(statut);
      $('.multiple__chiffres', carte).innerHTML = '2028&nbsp;: besoins <strong>' + fmt.entier(s.besoin2028) +
        '</strong> · disponible <strong>' + fmt.entier(s.disponible2028) + '</strong>';
      toile.setAttribute('aria-label', categorieRH(id).nom + ' : en 2028, besoins ' + s.besoin2028 + ', effectif disponible ' +
        s.disponible2028 + ', écart ' + fmt.signe(s.ecart2028) + '.');

      const existant = graphiques[toile.id];
      if (existant) {
        existant.data.datasets[0].data = s.besoins.slice();
        existant.data.datasets[1].data = s.ressources.slice();
        existant.update();
      } else {
        graphiqueMultiple(toile.id, p.annees, s);
      }
    });
  }

  function graphiqueMultiple(id, annees, s) {
    const point = (couleur) => ({ borderColor: couleur, backgroundColor: couleur, pointBackgroundColor: couleur, pointBorderColor: C.surface, tension: 0.2 });
    creerGraphique(id, {
      type: 'line',
      data: {
        labels: annees.map(String),
        datasets: [
          Object.assign({ label: 'Besoins', data: s.besoins.slice(), fill: false }, point(C.bleu900)),
          Object.assign({
            label: 'Effectif disponible', data: s.ressources.slice(),
            // zone entre les deux courbes : verte si surplus, rouge si déficit
            fill: { target: 0, above: 'rgba(46, 139, 87, 0.22)', below: 'rgba(192, 57, 43, 0.18)' },
          }, point(C.bleu500)),
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 4, right: 8 } },
        scales: {
          x: { grid: { display: false }, border: { color: C.grille }, ticks: { color: C.bleu900, font: { weight: '600' } } },
          y: { grace: '12%', ticks: { maxTicksLimit: 5, precision: 0 }, grid: { color: C.grille }, border: { display: false } },
        },
        plugins: {
          legend: { display: false },
          reticule: { actif: true },
          tooltip: {
            callbacks: {
              label: (c) => ' ' + c.dataset.label + ESPACE + ': ' + fmt.entier(c.raw),
              footer: (elements) => {
                const g = elements[0].chart;
                const i = elements[0].dataIndex;
                const e = g.data.datasets[1].data[i] - g.data.datasets[0].data[i];
                return 'Écart' + ESPACE + ': ' + fmt.signe(e) + (e > 0 ? ' (surplus)' : e < 0 ? ' (déficit)' : '');
              },
            },
          },
        },
      },
    });
  }

  // Construit un tableau HTML à partir de lignes de cellules {texte | noeud, classe, style}
  function tableauHTML(legende, entetes, lignes, pied) {
    const table = doc.createElement('table');
    table.className = 'tableau';
    const titre = doc.createElement('caption');
    titre.className = 'visuellement-cache';
    titre.textContent = legende;
    table.appendChild(titre);
    const remplir = (tr, cellules, enTete) => {
      cellules.forEach((cellule, i) => {
        const element = doc.createElement(enTete || i === 0 ? 'th' : 'td');
        if (enTete) element.scope = 'col';
        else if (i === 0) element.scope = 'row';
        const contenu = cellule && typeof cellule === 'object' && !(cellule instanceof Node) ? cellule : { texte: cellule };
        if (contenu.noeud) element.appendChild(contenu.noeud);
        else element.textContent = contenu.texte;
        if (contenu.classe) element.className = contenu.classe;
        if (contenu.fond) { element.style.background = contenu.fond; element.style.color = contenu.encre; }
        tr.appendChild(element);
      });
    };
    remplir(table.createTHead().insertRow(), entetes, true);
    const corps = table.createTBody();
    lignes.forEach((ligne) => remplir(corps.insertRow(), ligne, false));
    if (pied) remplir(table.createTFoot().insertRow(), pied, false);
    return table;
  }

  const placer = (id, table) => {
    const zone = doc.getElementById(id);
    zone.textContent = '';
    zone.appendChild(table);
  };

  // Tableau « Effectif disponible au 31/12/2028 » (comme dans le TD)
  function majTableauFlux(p) {
    const negatif = (n) => ({ texte: n ? fmt.signe(-n) : '0', classe: n ? 'texte-deficit' : '' });
    const mobilite = (n) => ({ texte: n ? fmt.signe(n) : '0' });
    const ligne = (nom, court, s) => [
      { noeud: libelleDouble(nom, court) },
      fmt.entier(s.effectif2025), negatif(s.totalRetraites), negatif(s.totalDemissions), mobilite(s.totalMobilite),
      { texte: fmt.entier(s.disponible2028), classe: 'cellule-forte' }, fmt.entier(s.besoin2028),
      { noeud: creerStatut(s.ecart2028) },
    ];
    const legende = 'Effectif disponible au 31/12/2028 et écart avec les besoins';

    // Sur téléphone : tableau « retourné » (les catégories en colonnes) pour tenir dans l'écran
    if (ecranEtroit.matches) {
      const colonnes = ORDRE_CATEGORIES.map((id) => p.categories[id]).concat([p.total]);
      const rangee = (titre, fabrique, classe) => [{ texte: titre, classe: classe }].concat(colonnes.map(fabrique));
      placer('tableau-flux', tableauHTML(legende,
        ['Indicateur'].concat(ORDRE_CATEGORIES.map((id) => categorieRH(id).court), ['Total']),
        [
          rangee('Effectif 2025', (s) => fmt.entier(s.effectif2025)),
          rangee('Retraites', (s) => negatif(s.totalRetraites)),
          rangee('Démissions', (s) => negatif(s.totalDemissions)),
          rangee('Mobilité', (s) => mobilite(s.totalMobilite)),
          rangee('Disponible 2028', (s) => ({ texte: fmt.entier(s.disponible2028), classe: 'cellule-forte' })),
          rangee('Besoins 2028', (s) => fmt.entier(s.besoin2028)),
          rangee('Écart 2028', (s) => ({ texte: fmt.signe(s.ecart2028), classe: s.ecart2028 < 0 ? 'texte-deficit' : 'texte-surplus' })),
        ]));
      return;
    }

    const entetes = [['Catégorie', 'Catégorie'], ['Effectif 2025', '2025'], ['Retraites', 'Retr.'], ['Démissions', 'Dém.'],
      ['Mobilité', 'Mob.'], ['Disponible 2028', 'Dispo.'], ['Besoins 2028', 'Besoins'], ['Écart 2028', 'Écart']]
      .map((e) => ({ noeud: libelleDouble(e[0], e[1]) }));
    placer('tableau-flux', tableauHTML(legende, entetes,
      ORDRE_CATEGORIES.map((id) => ligne(categorieRH(id).nom, categorieRH(id).court, p.categories[id])),
      ligne('Total', 'Total', p.total)
    ));
  }

  // Couleur d'une case selon le nombre de départs (plus il y en a, plus c'est foncé)
  function teinte(n, maximum) {
    if (n <= 0 || !maximum) return null;
    const r = n / maximum;
    if (r <= 0.3) return [C.bleu100, C.bleu900];
    if (r <= 0.5) return [C.bleu200, C.bleu900];
    if (r <= 0.7) return [C.bleu300, C.bleu900];
    if (r <= 0.9) return [C.bleu400, C.bleu900];
    return [C.bleu500, C.blanc];
  }

  // Tableau des départs à la retraite par année (comme dans le TD)
  function majTableauRetraites(p) {
    $('#sous-titre-retraites').textContent = 'Salariés atteignant ' + p.ageRetraite + ' ans entre 2026 et 2028 (âge de départ choisi)';
    const maximum = Math.max.apply(null, [].concat.apply([], ORDRE_CATEGORIES.map((id) => p.categories[id].retraites)));
    const lignes = RH.anneesPrevision.map((annee, i) => {
      const valeurs = ORDRE_CATEGORIES.map((id) => p.categories[id].retraites[i]);
      return [String(annee)].concat(valeurs.map((n) => {
        const couleurs = teinte(n, maximum);
        return { texte: fmt.entier(n), classe: 'chaleur', fond: couleurs ? couleurs[0] : '', encre: couleurs ? couleurs[1] : '' };
      }), [{ texte: fmt.entier(somme(valeurs)), classe: 'cellule-forte' }]);
    });
    const pied = ['Total'].concat(ORDRE_CATEGORIES.map((id) => fmt.entier(p.categories[id].totalRetraites)), [fmt.entier(p.total.totalRetraites)]);
    placer('tableau-retraites', tableauHTML(
      'Départs à la retraite prévus par année et par catégorie',
      ['Année'].concat(ORDRE_CATEGORIES.map((id) => ({ noeud: libelleDouble(categorieRH(id).nom, categorieRH(id).court) })), ['Total']),
      lignes, pied
    ));
  }

  // Tableau des démissions : taux annuel constant × effectif 2025 × 3 ans (TD)
  function majTableauDemissions(p) {
    const n = RH.anneesPrevision.length;
    const lignes = ORDRE_CATEGORIES.map((id) => {
      const s = p.categories[id];
      const calcul = fmt.entier(s.effectif2025) + ' × ' + fmt.pourcentage(categorieRH(id).tauxDemission, categorieRH(id).tauxDemission % 1 ? 1 : 0) + ' × ' + n;
      return [{ noeud: libelleDouble(categorieRH(id).nom, categorieRH(id).court) }, calcul, { texte: fmt.entier(s.totalDemissions), classe: 'cellule-forte' }];
    });
    placer('tableau-demissions', tableauHTML(
      'Démissions prévues entre 2026 et 2028',
      ['Catégorie', 'Calcul', 'Démissions'],
      lignes, ['Total', '', fmt.entier(p.total.totalDemissions)]
    ));
  }

  /* ------------------------------------------------------------------------
     10. PAGE « RISQUE DE DÉPART » (Prédictif, individuel)
     ------------------------------------------------------------------------ */
  const NIVEAUX_RISQUE = {
    eleve: { libelle: 'Élevé', icone: 'ico-alerte' },
    moyen: { libelle: 'Moyen', icone: 'ico-info' },
    faible: { libelle: 'Faible', icone: 'ico-coche' },
  };
  let salarieChoisi = null; // gardé en mémoire seulement

  function creerNiveau(niveau) {
    const puce = doc.createElement('span');
    puce.className = 'niveau niveau--' + niveau;
    puce.innerHTML = '<svg class="icone" aria-hidden="true"><use href="#' + NIVEAUX_RISQUE[niveau].icone + '"></use></svg>';
    puce.appendChild(doc.createTextNode(NIVEAUX_RISQUE[niveau].libelle));
    return puce;
  }

  function rendreRisque() {
    const liste = RH.salariesSuivis;
    if (!salarieChoisi) salarieChoisi = liste[0].id;
    rendreSyntheseRisque(liste);
    rendreListeRisque(liste);
    rendreDetailRisque(liste.find((s) => s.id === salarieChoisi), false);
  }

  function rendreSyntheseRisque(liste) {
    const compte = (niveau) => liste.filter((s) => s.niveau === niveau).length;
    const seuils = RH.seuilsRisque;
    const tuiles = [
      { libelle: 'Risque élevé', valeur: compte('eleve'), detail: 'score de ' + seuils.eleve + ' à 100', pastille: 'eleve' },
      { libelle: 'Risque moyen', valeur: compte('moyen'), detail: 'score de ' + seuils.moyen + ' à ' + (seuils.eleve - 1), pastille: 'moyen' },
      { libelle: 'Risque faible', valeur: compte('faible'), detail: 'score inférieur à ' + seuils.moyen, pastille: 'faible' },
      { libelle: 'Score moyen', valeur: Math.round(somme(liste.map((s) => s.score)) / liste.length) + ' / 100',
        detail: liste.length + ' salariés suivis', fonce: true },
    ];
    const conteneur = $('#synthese-risque');
    conteneur.textContent = '';
    tuiles.forEach((tuile, i) => {
      const element = doc.createElement('article');
      element.className = 'synthese' + (tuile.fonce ? ' synthese--fonce' : '');
      element.style.animationDelay = i * 50 + 'ms';
      element.innerHTML = '<p class="synthese__libelle"></p><p class="synthese__valeur"></p><p class="synthese__detail"></p>';
      const libelle = $('.synthese__libelle', element);
      if (tuile.pastille) libelle.innerHTML = '<span class="synthese__pastille fond-' + tuile.pastille + '" aria-hidden="true"></span>';
      libelle.appendChild(doc.createTextNode(tuile.libelle));
      $('.synthese__valeur', element).textContent = tuile.valeur;
      $('.synthese__detail', element).textContent = tuile.detail;
      conteneur.appendChild(element);
    });
  }

  function rendreListeRisque(liste) {
    const table = doc.createElement('table');
    table.className = 'tableau tableau--risque';
    table.innerHTML = '<caption class="visuellement-cache">Salariés suivis, du risque le plus élevé au plus faible</caption>' +
      '<thead><tr><th scope="col">Salarié</th><th scope="col" class="col-anciennete">Ancienneté</th><th scope="col">Score</th><th scope="col">Niveau</th></tr></thead>';
    const corps = table.createTBody();
    liste.forEach((s) => {
      const tr = corps.insertRow();
      tr.dataset.id = s.id;
      if (s.id === salarieChoisi) tr.className = 'est-choisi';
      const th = doc.createElement('th');
      th.scope = 'row';
      th.innerHTML = '<button type="button" class="lien-salarie"></button><span class="poste"></span>';
      $('button', th).textContent = s.nom;
      $('button', th).setAttribute('aria-pressed', String(s.id === salarieChoisi));
      $('.poste', th).textContent = s.poste + ' · ' + categorieRH(s.categorie).court;
      tr.appendChild(th);
      const anciennete = tr.insertCell();
      anciennete.className = 'col-anciennete';
      anciennete.textContent = s.anciennete + (s.anciennete > 1 ? ' ans' : ' an');
      const score = tr.insertCell();
      score.innerHTML = '<span class="score"><span></span><span class="score__barre" aria-hidden="true"><span class="fond-' + s.niveau + '"></span></span></span>';
      score.querySelector('.score > span').textContent = s.score;
      score.querySelector('.score__barre > span').style.width = s.score + '%';
      tr.insertCell().appendChild(creerNiveau(s.niveau));
    });
    table.addEventListener('click', (evenement) => {
      const ligne = evenement.target.closest('tr[data-id]');
      if (ligne) choisirSalarie(ligne.dataset.id, true);
    });
    const zone = $('#liste-risque');
    zone.textContent = '';
    zone.appendChild(table);
  }

  function choisirSalarie(id, defiler) {
    salarieChoisi = id;
    $$('#liste-risque tbody tr').forEach((tr) => {
      const actif = tr.dataset.id === id;
      tr.classList.toggle('est-choisi', actif);
      $('button', tr).setAttribute('aria-pressed', String(actif));
    });
    rendreDetailRisque(RH.salariesSuivis.find((s) => s.id === id), defiler);
  }

  // Valeur d'un facteur, en clair
  function texteFacteur(id, v) {
    switch (id) {
      case 'anciennete': return v + (v > 1 ? ' ans' : ' an') + ' dans l’entreprise';
      case 'ecartSalaire': return v < 0 ? fmt.signe(v) + ESPACE_FINE + '% sous le marché' : v > 0 ? '+' + v + ESPACE_FINE + '% au-dessus du marché' : 'au niveau du marché';
      case 'derniereAugmentation': return 'il y a ' + v + ' mois';
      case 'evaluation': return v + ' / 5';
      case 'formations': return v === 0 ? 'aucune formation en 2 ans' : v + (v > 1 ? ' formations' : ' formation') + ' en 2 ans';
      case 'absenteisme': return fmt.pourcentage(v) + ' du temps de travail';
      default: return String(v);
    }
  }

  // Le même facteur, en morceau de phrase (pour le résumé)
  function phraseFacteur(id, v, hausse) {
    switch (id) {
      case 'anciennete': return hausse ? 'une faible ancienneté (' + v + (v > 1 ? ' ans' : ' an') + ')' : 'une forte ancienneté (' + v + ' ans)';
      case 'ecartSalaire': return hausse ? 'un salaire inférieur au marché (' + fmt.signe(v) + ESPACE_FINE + '%)' : 'un salaire au niveau du marché';
      case 'derniereAugmentation': return hausse ? 'aucune augmentation depuis ' + v + ' mois' : 'une augmentation récente (il y a ' + v + ' mois)';
      case 'evaluation': return hausse ? 'une évaluation moyenne (' + v + '/5)' : 'une excellente évaluation (' + v + '/5)';
      case 'formations': return hausse ? (v === 0 ? 'aucune formation récente' : 'peu de formations (' + v + ' en 2 ans)') : 'des formations régulières (' + v + ' en 2 ans)';
      case 'absenteisme': return hausse ? 'un absentéisme élevé (' + fmt.pourcentage(v) + ')' : 'un absentéisme faible (' + fmt.pourcentage(v) + ')';
      default: return '';
    }
  }

  function rendreDetailRisque(s, defiler) {
    if (!s) return;
    const zone = $('#detail-risque');
    const mots = s.nom.split(' ').filter(Boolean);
    const initiales = (mots[0].charAt(0) + mots[mots.length - 1].charAt(0)).toUpperCase();
    zone.innerHTML =
      '<header class="detail__entete"><span class="avatar avatar--clair" aria-hidden="true"></span>' +
      '<div><h2 class="detail__nom"></h2><p class="detail__poste"></p></div>' +
      '<button type="button" class="bouton-icone detail__fermer" aria-label="Fermer la fiche"><svg class="icone" aria-hidden="true"><use href="#ico-fermer"></use></svg></button></header>' +
      '<div class="detail__score">' +
        '<div class="detail__score-ligne"><p class="detail__valeur"><span></span><small> / 100</small></p><span data-niveau></span></div>' +
        '<div class="jauge" aria-hidden="true"><span class="jauge__remplissage fond-' + s.niveau + '"></span>' +
          '<span class="jauge__seuil" style="left:' + RH.seuilsRisque.moyen + '%"></span><span class="jauge__seuil" style="left:' + RH.seuilsRisque.eleve + '%"></span></div>' +
        '<div class="jauge__legende"><span>0</span><span>moyen dès ' + RH.seuilsRisque.moyen + ' · élevé dès ' + RH.seuilsRisque.eleve + '</span><span>100</span></div>' +
      '</div>' +
      '<h3 class="detail__sous-titre">Pourquoi ce score&nbsp;? <small>IA explicable</small></h3>' +
      '<p class="detail__base">Point de départ&nbsp;: ' + RH.scoreBase + ' points (score de référence). Chaque facteur ajoute (+) ou retire (−) des points.</p>' +
      '<ul class="facteurs"></ul>' +
      '<p class="detail__resume"></p>' +
      '<p class="detail__note"><svg class="icone" aria-hidden="true"><use href="#ico-bouclier"></use></svg>' +
        '<span>Aide à la décision&nbsp;: à discuter lors d’un entretien entre le salarié et son manager. Aucune décision automatique.</span></p>';

    $('.avatar', zone).textContent = initiales;
    $('.detail__fermer', zone).addEventListener('click', fermerFeuille);
    $('.detail__nom', zone).textContent = s.nom;
    $('.detail__poste', zone).textContent = s.poste + ' · ' + categorieRH(s.categorie).nom + ' · matricule ' + s.id;
    $('.detail__valeur span', zone).textContent = s.score;
    $('[data-niveau]', zone).replaceWith(creerNiveau(s.niveau));
    const jauge = $('.jauge__remplissage', zone);
    jauge.style.width = '0%';
    requestAnimationFrame(() => { jauge.style.width = s.score + '%'; });

    const contributions = s.contributions.slice().sort((a, b) => b.points - a.points);
    const maximum = 22;
    const liste = $('.facteurs', zone);
    contributions.forEach((c) => {
      const sens = c.points > 0 ? 'hausse' : c.points < 0 ? 'baisse' : 'neutre';
      const element = doc.createElement('li');
      element.className = 'facteur facteur--' + sens;
      element.innerHTML = '<span><span class="facteur__nom"></span><span class="facteur__valeur"></span></span>' +
        '<span class="facteur__barre" aria-hidden="true"><span class="facteur__remplissage"></span></span><span class="facteur__points"></span>';
      $('.facteur__nom', element).textContent = c.nom;
      $('.facteur__valeur', element).textContent = texteFacteur(c.id, c.valeur);
      $('.facteur__remplissage', element).style.width = (50 * Math.min(Math.abs(c.points), maximum)) / maximum + '%';
      $('.facteur__points', element).textContent = (c.points > 0 ? '+' : c.points < 0 ? '−' : '') + Math.abs(c.points) + ESPACE + 'pts';
      liste.appendChild(element);
    });

    const risques = contributions.filter((c) => c.points > 0).slice(0, 2);
    const fidelite = contributions.filter((c) => c.points < 0).sort((a, b) => a.points - b.points).slice(0, 2);
    const joindre = (morceaux) => morceaux.map((m) => '<strong>' + echapper(m) + '</strong>').join(' et ');
    $('.detail__resume', zone).innerHTML = risques.length
      ? 'Principaux facteurs de risque&nbsp;: ' + joindre(risques.map((c) => phraseFacteur(c.id, c.valeur, true))) + '.'
      : 'Principaux facteurs de fidélité&nbsp;: ' + joindre(fidelite.map((c) => phraseFacteur(c.id, c.valeur, false))) + '.';

    if (!defiler) return;
    if (ecranEtroit.matches) ouvrirFeuille();
    else if (window.innerWidth < 1200) zone.scrollIntoView({ behavior: reduireAnimations ? 'auto' : 'smooth', block: 'start' });
  }

  // Volet « fiche salarié » qui monte du bas de l'écran (téléphone)
  function ouvrirFeuille() {
    $('#detail-risque').classList.add('est-ouvert');
    $('#voile-detail').hidden = false;
    doc.body.classList.add('feuille-ouverte');
  }

  function fermerFeuille() {
    const detail = doc.getElementById('detail-risque');
    if (detail) detail.classList.remove('est-ouvert');
    const voile = doc.getElementById('voile-detail');
    if (voile) voile.hidden = true;
    doc.body.classList.remove('feuille-ouverte');
  }

  /* ------------------------------------------------------------------------
     11. PAGE « COMPÉTENCES DE DEMAIN » (Prédictif)
     ------------------------------------------------------------------------ */
  function rendreCompetences() {
    const p = previsionCourante();
    const competences = RH.besoinsCompetences(p);

    // Le chiffre clé du TD : techniciens maîtrisant la robotique
    const robotique = competences.find((c) => c.nom === 'Robotique');
    $('#chiffre-cle-valeur').textContent = fmt.entier(robotique.maitrisants2025) + ' → ' + fmt.entier(robotique.requis2028);
    $('#chiffre-cle-calcul').innerHTML =
      '2025&nbsp;: ' + echapper(fmt.entier(robotique.effectif2025)) + ' × ' + echapper(fmt.pourcentage(robotique.maitrise2025, 0)) + ' = ' + echapper(fmt.entier(robotique.maitrisants2025)) +
      '<br>2028&nbsp;: ' + echapper(fmt.entier(robotique.besoin2028)) + ' × ' + echapper(fmt.pourcentage(robotique.objectif2028, 0)) + ' = ' + echapper(fmt.entier(robotique.requis2028));
    $('#chiffre-cle-conclusion').textContent = robotique.aFormer + ' techniciens de plus à former ou recruter en robotique';
    $('#sous-titre-competences').textContent = 'Part des salariés de chaque catégorie qui maîtrisent la compétence · besoins 2028 du scénario ' + p.scenario.nom.toLowerCase();

    rendreTableauCompetences(competences);
    rendreMetiers(p);
  }

  // Couleur d'une case selon le pourcentage (plus c'est élevé, plus c'est foncé)
  function teintePourcentage(v) {
    if (v < 20) return [C.bleu100, C.bleu900];
    if (v < 40) return [C.bleu200, C.bleu900];
    if (v < 60) return [C.bleu300, C.bleu900];
    if (v < 80) return [C.bleu400, C.bleu900];
    return [C.bleu500, C.blanc];
  }

  function rendreTableauCompetences(competences) {
    const lignes = competences.map((c, i) => {
      const premiere = i === 0 || competences[i - 1].categorie !== c.categorie;
      const avant = teintePourcentage(c.maitrise2025);
      const apres = teintePourcentage(c.objectif2028);
      const haltere = doc.createElement('div');
      haltere.className = 'haltere';
      haltere.setAttribute('aria-hidden', 'true');
      haltere.innerHTML = '<span class="haltere__barre"></span><span class="haltere__point haltere__point--avant"></span><span class="haltere__point haltere__point--apres"></span>';
      haltere.children[0].style.left = c.maitrise2025 + '%';
      haltere.children[0].style.width = c.objectif2028 - c.maitrise2025 + '%';
      haltere.children[1].style.left = c.maitrise2025 + '%';
      haltere.children[2].style.left = c.objectif2028 + '%';
      const aFormer = doc.createElement('span');
      aFormer.innerHTML = '+' + echapper(fmt.entier(c.aFormer)) + '<small></small>';
      aFormer.lastChild.textContent = fmt.entier(c.maitrisants2025) + ' → ' + fmt.entier(c.requis2028) + ' salariés';
      return {
        premiere: premiere,
        cellules: [
          premiere
            ? { noeud: libelleDouble(categorieRH(c.categorie).nom, categorieRH(c.categorie).court), classe: 'categorie-cellule' }
            : { texte: '', classe: 'categorie-cellule' },
          c.nom,
          { texte: fmt.pourcentage(c.maitrise2025, 0), classe: 'pourcentage', fond: avant[0], encre: avant[1] },
          { noeud: haltere, classe: 'col-haltere' },
          { texte: fmt.pourcentage(c.objectif2028, 0), classe: 'pourcentage', fond: apres[0], encre: apres[1] },
          { noeud: aFormer, classe: 'a-former' },
        ],
      };
    });

    const table = tableauHTML(
      'Écart qualitatif : maîtrise 2025 et objectif 2028 par compétence',
      ['Catégorie', { noeud: libelleDouble('Compétence cible', 'Compétence') }, { noeud: libelleDouble('Maîtrise 2025', '2025') }, { texte: 'Progression', classe: 'col-haltere' },
        { noeud: libelleDouble('Objectif 2028', '2028') }, { noeud: libelleDouble('À former ou recruter', 'À former') }],
      lignes.map((l) => l.cellules)
    );
    table.classList.add('tableau--competences');
    $$('tbody tr', table).forEach((tr, i) => { if (lignes[i].premiere && i > 0) tr.classList.add('groupe-debut'); });
    placer('tableau-competences', table);
  }

  function rendreMetiers(p) {
    const remplir = (id, elements) => {
      const liste = doc.getElementById(id);
      liste.textContent = '';
      elements.forEach((e) => {
        const element = doc.createElement('li');
        element.innerHTML = '<strong></strong><span></span>';
        $('strong', element).textContent = e.nom;
        $('span', element).textContent = e.detail;
        liste.appendChild(element);
      });
    };
    const c = p.categories;

    remplir('metiers-emergents', RH.metiers.emergents);

    const tension = ORDRE_CATEGORIES
      .filter((id) => c[id].ecart2028 < 0)
      .sort((a, b) => c[a].ecart2028 - c[b].ecart2028)
      .map((id) => ({
        nom: categorieRH(id).nom + ' : déficit de ' + Math.abs(c[id].ecart2028) + ' en 2028',
        // minuscule au début du mot, sauf pour les sigles (« IA »)
        detail: 'Compétences clés : ' + RH.competences.filter((x) => x.categorie === id)
          .map((x) => (x.nom.charAt(1) === x.nom.charAt(1).toLowerCase() ? x.nom.charAt(0).toLowerCase() + x.nom.slice(1) : x.nom)).join(', '),
      }));
    tension.push({
      nom: 'Jeunes techniciens (moins de 35 ans)',
      detail: RH.partDemissionsTechMoins35 + ' % des démissions de techniciens : attirés par la concurrence',
    });
    remplir('metiers-tension', tension);

    const declin = RH.metiers.declin.slice();
    if (c.agents.ecart2028 > 0) {
      declin[0] = { nom: declin[0].nom, detail: 'Deux lignes automatisées : surplus de ' + c.agents.ecart2028 + ' agents d’exécution en 2028' };
    }
    remplir('metiers-declin', declin);
  }

  /* ------------------------------------------------------------------------
     12. PAGE « PLAN D'ACTION GPEC » (Prescriptif)
     ------------------------------------------------------------------------ */
  const PRIORITES = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' };

  function creerPriorite(cle) {
    const puce = doc.createElement('span');
    puce.className = 'priorite priorite--' + cle;
    puce.innerHTML = '<span class="priorite__barres" aria-hidden="true"><i></i><i></i><i></i></span>';
    puce.appendChild(doc.createTextNode(PRIORITES[cle]));
    return puce;
  }

  // Tuiles de synthèse (chiffre + libellé + détail)
  function rendreTuiles(conteneur, tuiles) {
    conteneur.textContent = '';
    tuiles.forEach((tuile, i) => {
      const element = doc.createElement('article');
      element.className = 'synthese' + (tuile.fonce ? ' synthese--fonce' : '');
      element.style.animationDelay = i * 50 + 'ms';
      element.innerHTML = '<p class="synthese__libelle"></p><p class="synthese__valeur"></p><p class="synthese__detail"></p>';
      $('.synthese__libelle', element).textContent = tuile.libelle;
      $('.synthese__valeur', element).textContent = tuile.valeur;
      $('.synthese__detail', element).textContent = tuile.detail;
      conteneur.appendChild(element);
    });
  }

  function rendrePlanAction() {
    const section = doc.getElementById('page-plan-action');
    rendreChoixScenario($('[data-choix-scenario]', section), majPlanAction);
    majPlanAction();
  }

  function majPlanAction() {
    const p = previsionCourante();
    const actions = RH.genererPlanAction(p);
    $('#hypotheses-plan').innerHTML = 'Scénario <strong>' + echapper(p.scenario.nom.toLowerCase()) + '</strong>' +
      (p.scenario.id === 'central' ? ' (hypothèses du TD)' : '') + '&nbsp;: écart 2028 de <strong>' + echapper(fmt.signe(p.total.ecart2028)) +
      ' salariés</strong>. Les effectifs concernés suivent le scénario choisi.';

    const c = p.categories;
    const deficitTech = Math.max(0, -c.techniciens.ecart2028);
    const deficitCadres = Math.max(0, -c.cadres.ecart2028);
    const robotique = RH.besoinsCompetences(p).find((x) => x.nom === 'Robotique');
    rendreTuiles($('#synthese-plan'), [
      { libelle: 'Recrutements à prévoir', valeur: fmt.entier(deficitTech + deficitCadres),
        detail: deficitTech + ' techniciens + ' + deficitCadres + ' cadres · ' + RH.delaiRecrutementMois + ' mois par recrutement' },
      { libelle: 'À former en robotique', valeur: '+' + fmt.entier(robotique.aFormer),
        detail: fmt.entier(robotique.maitrisants2025) + ' → ' + fmt.entier(robotique.requis2028) + ' techniciens qualifiés' },
      { libelle: 'Budget formation', valeur: fmt.decimal(RH.budgetFormationMDH) + ESPACE + 'MDH',
        detail: 'sur 3 ans, soit ' + fmt.decimal(RH.budgetFormationMDH / 3) + ESPACE + 'MDH par an' },
      { libelle: 'Actions haute priorité', valeur: actions.filter((a) => a.priorite === 'haute').length + ' / ' + actions.length,
        detail: 'à lancer en premier', fonce: true },
    ]);

    rendreEcartsActions(p);
    rendreTableauPlan(actions);
  }

  function rendreEcartsActions(p) {
    const c = p.categories;
    const competences = RH.besoinsCompetences(p);
    const aFormer = (nom) => competences.find((x) => x.nom === nom).aFormer;
    const deficit = (id) => Math.max(0, -c[id].ecart2028);
    const blocs = [
      { id: 'techniciens', actions: [
        'Recruter ' + deficit('techniciens') + ' techniciens (' + RH.delaiRecrutementMois + ' mois par recrutement)',
        'Former à la robotique&nbsp;: +' + aFormer('Robotique') + ' techniciens qualifiés',
        'Fidéliser les moins de 35 ans (' + RH.partDemissionsTechMoins35 + '&nbsp;% des démissions)',
        'Alternance&nbsp;: ≈&nbsp;' + Math.round(deficit('techniciens') / 4) + ' recrutements',
      ] },
      { id: 'cadres', actions: [
        'Recruter ' + deficit('cadres') + ' cadres (cellule innovation)',
        'Promouvoir ' + c.cadres.totalMobilite + ' techniciens chefs d’équipe',
        'Former au management agile&nbsp;: +' + aFormer('Management agile') + ' cadres',
      ] },
      { id: 'agents', actions: [
        c.agents.ecart2028 > 0 ? 'Orienter le surplus (+' + c.agents.ecart2028 + ') vers la maintenance de 1er niveau' : 'Ajuster les effectifs des lignes automatisées',
        'Tutorat des seniors&nbsp;: ' + c.agents.totalRetraites + ' départs à la retraite d’ici 2028',
        'Former aux outils numériques&nbsp;: +' + aFormer('Outils numériques') + ' agents',
      ] },
    ];
    const conteneur = $('#ecarts-actions');
    conteneur.textContent = '';
    blocs.forEach((bloc) => {
      const element = doc.createElement('div');
      element.className = 'ecart-bloc';
      element.innerHTML = '<div class="ecart-bloc__entete"><h3 class="ecart-bloc__titre"></h3><span data-statut></span></div><ul class="ecart-bloc__liste"></ul>';
      $('.ecart-bloc__titre', element).textContent = categorieRH(bloc.id).nom;
      $('[data-statut]', element).replaceWith(creerStatut(c[bloc.id].ecart2028));
      const liste = $('.ecart-bloc__liste', element);
      bloc.actions.forEach((texte) => {
        const item = doc.createElement('li');
        item.innerHTML = '<svg class="icone" aria-hidden="true"><use href="#ico-coche"></use></svg><span>' + texte + '</span>';
        liste.appendChild(item);
      });
      conteneur.appendChild(element);
    });
  }

  function rendreTableauPlan(actions) {
    const table = doc.createElement('table');
    table.className = 'tableau tableau--plan';
    table.innerHTML = '<caption class="visuellement-cache">Plan d’action GPEC</caption><thead><tr>' +
      ['Action', 'Catégorie ciblée', 'Effectif concerné', 'Échéance', 'Priorité', 'Responsable'].map((t) => '<th scope="col">' + t + '</th>').join('') +
      '</tr></thead>';
    const corps = table.createTBody();
    actions.forEach((a) => {
      const tr = corps.insertRow();
      const th = doc.createElement('th');
      th.scope = 'row';
      th.innerHTML = '<span class="action__levier"></span><span class="action__titre"></span><span class="action__detail"></span>';
      $('.action__levier', th).textContent = a.levier;
      $('.action__titre', th).textContent = a.action;
      $('.action__detail', th).textContent = a.detail;
      tr.appendChild(th);
      const cellule = (texte, libelle, classe) => {
        const td = tr.insertCell();
        td.textContent = texte;
        td.dataset.libelle = libelle;
        if (classe) td.className = classe;
        return td;
      };
      cellule(a.cible, 'Catégorie ciblée', 'meta');
      cellule(fmt.entier(a.effectif), 'Effectif concerné', 'effectif');
      cellule(a.echeance, 'Échéance', 'meta');
      const priorite = tr.insertCell();
      priorite.dataset.libelle = 'Priorité';
      priorite.appendChild(creerPriorite(a.priorite));
      cellule(a.responsable, 'Responsable', 'responsable');
    });
    placer('tableau-plan', table);

    // Sur téléphone : d'abord les actions prioritaires, puis « Voir les N actions »
    const prioritaires = actions.filter((a) => a.priorite === 'haute').length;
    const bouton = $('#bouton-actions');
    table.classList.add('est-reduit');
    table.style.setProperty('--actions-visibles', prioritaires);
    table.dataset.visibles = prioritaires;
    bouton.hidden = actions.length <= prioritaires;
    bouton.textContent = 'Voir les ' + actions.length + ' actions';
    bouton.setAttribute('aria-expanded', 'false');
    bouton.onclick = () => {
      const reduit = table.classList.toggle('est-reduit');
      bouton.textContent = reduit ? 'Voir les ' + actions.length + ' actions' : 'Réduire la liste';
      bouton.setAttribute('aria-expanded', String(!reduit));
    };
  }

  /* ------------------------------------------------------------------------
     13. PAGE « MÉTHODOLOGIE & ÉTHIQUE »
     ------------------------------------------------------------------------ */
  const pourcentageSigne = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmt.pourcentage(Math.abs(x * 100), 0);

  function rendreMethodologie() {
    const central = RH.prevoir('central', etat.ageRetraite);

    placer('tableau-hypotheses', tableauHTML(
      'Hypothèses du TD par catégorie',
      ['Catégorie', { noeud: libelleDouble('Effectif 2025', '2025') }, { noeud: libelleDouble('Retraites 2026–2028', 'Retr.') },
        { noeud: libelleDouble('Taux de démission', 'Dém.') }, { noeud: libelleDouble('Mobilité', 'Mob.') }, { noeud: libelleDouble('Besoins 2028', 'Besoins') }],
      ORDRE_CATEGORIES.map((id) => {
        const c = categorieRH(id);
        const s = central.categories[id];
        return [{ noeud: libelleDouble(c.nom, c.court) }, fmt.entier(s.effectif2025), fmt.entier(s.totalRetraites),
          fmt.pourcentage(c.tauxDemission, c.tauxDemission % 1 ? 1 : 0) + '/an', s.totalMobilite ? fmt.signe(s.totalMobilite) : '0', fmt.entier(c.besoin2028)];
      })
    ));

    placer('tableau-scenarios', tableauHTML(
      'Les trois scénarios',
      ['Scénario', { noeud: libelleDouble('Croissance', 'Croiss.') }, { noeud: libelleDouble('Automatisation', 'Autom.') },
        { noeud: libelleDouble('Besoins 2028', 'Besoins') }, { noeud: libelleDouble('Écart 2028', 'Écart') }],
      Object.keys(RH.scenarios).map((id) => {
        const sc = RH.scenarios[id];
        const p = RH.prevoir(id, etat.ageRetraite);
        return [sc.nom, pourcentageSigne(sc.croissance) + '/an', fmt.pourcentage(sc.rythmeAutomatisation * 100, 0),
          fmt.entier(p.total.besoin2028), { noeud: creerStatut(p.total.ecart2028) }];
      })
    ));

    $('#texte-score').textContent = 'Score = ' + RH.scoreBase + ' points de base + les points de chaque facteur, entre 0 et 100. Risque élevé dès ' +
      RH.seuilsRisque.eleve + ', moyen dès ' + RH.seuilsRisque.moyen + '. Chaque point est visible sur la page « Risque de départ ».';
    const regles = [
      ['Ancienneté', 'moins de 2 ans : +12 · 2 à 5 ans : +7 · 5 à 10 ans : 0 · plus de 10 ans : −6'],
      ['Écart salaire / marché', '+1,2 point par % sous le marché (au plus +22) · au-dessus du marché : jusqu’à −8'],
      ['Dernière augmentation', 'plus de 24 mois : +14 · 13 à 24 mois : +6 · 12 mois ou moins : −4'],
      ['Évaluation annuelle', '2/5 ou moins : +10 · 3/5 : +3 · 4/5 : 0 · 5/5 : −2'],
      ['Formations suivies (2 ans)', 'aucune : +8 · une : +3 · deux : 0 · trois ou plus : −5'],
      ['Absentéisme', 'plus de 8 % : +10 · 5 à 8 % : +5 · 2 à 5 % : 0 · moins de 2 % : −3'],
    ];
    const table = tableauHTML('Règles de calcul du score de risque', ['Facteur', 'Règle de calcul (points)'],
      regles.map((r) => [r[0], { texte: r[1].replace(/ %/g, ESPACE_FINE + '%').replace(/ : /g, ESPACE + ': ') }]));
    table.classList.add('tableau--regles');
    placer('tableau-score', table);
  }

  /* ------------------------------------------------------------------------
     14. Démarrage
     ------------------------------------------------------------------------ */
  if (window.Chart) configurerChartJs();
  construireElementsCommuns();
  brancherEvenements();
  appliquerAdresse();
})();
