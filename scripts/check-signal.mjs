#!/usr/bin/env node
/**
 * UN SEUL OBJET AMBRE PAR ÉCRAN — le seul garde-fou du système de design
 * qu'un humain ne tiendra pas à la main sur soixante-huit modules.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ## La règle, et pourquoi elle se perd sans contrôle
 *
 * L'ambre (`--color-signal`, #d09a4a) marque CE QUI DEMANDE UNE DÉCISION :
 * un J-11, un segment en retard, une catégorie dépassée, un créneau déjà pris.
 * Un par écran. Pas un par carte, pas un par colonne.
 *
 * C'est la règle la plus facile à casser sans le remarquer, parce qu'elle se
 * casse toujours de la même façon : deux personnes (ou la même, deux semaines
 * plus tard) ajoutent chacune un ambre justifié dans deux composants
 * différents du même écran. Chaque geste est défendable ; le résultat ne l'est
 * pas. Au troisième, l'ambre ne veut plus rien dire — c'est devenu la couleur
 * de la marque, ce que tout le système existe pour éviter.
 *
 * ## Ce qu'il mesure, et pourquoi dans un navigateur
 *
 * Un `grep` sur les sources ne peut pas répondre : le même composant rend de
 * l'ambre ou pas selon les données (l'encart « à encaisser » n'est en ambre
 * que s'il y a quelque chose à encaisser), et un écran compose des morceaux
 * écrits dans dix fichiers. La question « combien d'objets ambre voit-on sur
 * cet écran » n'a de réponse qu'à l'écran.
 *
 * On compte donc les ÉLÉMENTS RENDUS dont le fond, la couleur, la bordure ou
 * l'ombre portent la teinte du signal. Deux précisions qui évitent les faux
 * positifs :
 *
 *   · un élément dont un ANCÊTRE porte déjà l'ambre ne compte pas — une plaque
 *     ambre avec trois lignes de texte dedans est UN objet, pas quatre ;
 *   · un élément invisible (hauteur ou largeur nulle, `display:none`) ne compte
 *     pas : il n'est pas à l'écran.
 *
 * ## La deuxième règle : un écran VIDE n'a pas d'ambre
 *
 * Le système de design la pose comme l'exception écrite à tout ce qui précède,
 * et elle ne concerne que deux écrans sur soixante-seize : un écran sans
 * données n'a rien à signaler, donc il ne pose pas de décision, donc il n'a
 * pas d'ambre. Elle a un corollaire qui compte autant : AUCUN CHIFFRE À ZÉRO.
 * « 0 € encaissé » se lit comme un échec ; « rien n'est encore passé en
 * caisse » se lit comme un début. Les deux se mesurent ici, sur un écran qui
 * DÉCLARE être vide via `<EcranVide>` (src/components/EtatEcran.tsx) — la
 * garde ne devine pas, elle lit.
 *
 * Cette règle se casse dans l'autre sens que la première : la première se
 * casse en AJOUTANT de l'ambre, la seconde en OUBLIANT de le retirer quand
 * les données disparaissent. Un écran composé sur un jeu de données rempli
 * peut être parfait, et poser trois zéros en mono au premier jour de sa
 * cliente. C'est ce cas-là qui est contrôlé.
 *
 * ## La troisième règle : le rouge dit le critique, une fois
 *
 * Les bureaux (BUREAUX.md §1) posent la règle sœur de l'ambre : le rouge ne
 * s'emploie que pour LE critique, à un seul endroit par écran — l'objet
 * critique lui-même ; ailleurs, « CRITIQUE » s'écrit à l'encre. Et jamais un
 * écran baigné de rouge. Les deux se comptent comme l'ambre : racines
 * rouges (trait, texte, remplissage), réunies par `data-critique-groupe`
 * quand deux marques désignent le même objet ; puis la part du contenu sous
 * un fond rouge, fond sombre du critique et rouge dilué compris. Une légende
 * (`data-legende`) est la clé d'une couleur, pas un objet : elle ne compte pas.
 * Le compte « une fois » fait échouer l'édition interne ; sur l'édition
 * cliente, qui suit la règle du README, il est relevé pour mémoire.
 *
 * ## Mode d'emploi
 *
 *   1. npm run build:web:business   (AMN_WEB_OUT=… pour un dossier à part)
 *   2. AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-signal.mjs <bundle> [port]
 *
 * Comme `check:largeur` et `check:contraste`, il lui faut un navigateur, un
 * bundle construit et une session : il vit hors CI, et son mode d'emploi est
 * ici. Ce qu'il rend est une LISTE D'ÉCRANS FAUTIFS avec ce qu'il a compté,
 * jamais un simple « non ».
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { clesPersonnelles, coffreFort, CLE_COFFRE, ouverturesDEssai, cleOuvertures } from './perso-essai.mjs';

const BUNDLE = process.argv[2];
const PORT = Number(process.argv[3] ?? 4195);
const APP = `http://127.0.0.1:${PORT}/`;
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';

if (!BUNDLE || !EMAIL || !MOT_DE_PASSE) {
  console.error(
    'Usage : AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-signal.mjs <dossier-du-bundle> [port]',
  );
  process.exit(2);
}

/*
  Les écrans parcourus. La liste couvre les familles du système de design —
  pas les soixante-huit modules : ce contrôle mesure la RÈGLE, et un écran par
  famille suffit à attraper la dérive qu'elle guette. En ajouter un est une
  ligne.
*/
/*
  L'ÉDITION INTERNE — vingt-trois modules que cette garde ne voyait PAS.

  `ECRANS` ne couvre que l'édition cliente : la Garde, la Supervision, le Parc
  et les Produits n'y sont pas, et la règle d'ambre y a exactement le même
  poids. Une garde aveugle sur un quart du produit rassure à tort — c'est le
  défaut qu'elle existe pour attraper.

  Le bundle n'est pas le même (`npm run build:web`, sans `AMN_EDITION`), et le
  compte doit appartenir à AMN DevSec. On choisit donc la liste par
  l'environnement :

    AMN_EDITION=interne AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… \
      node scripts/check-signal.mjs <bundle-interne> [port]
*/
const ECRANS_INTERNE = [
  /* La Garde — six instruments neufs, six régions ambre à mesurer. */
  ['La Salle', '#/garde'],
  ['À votre avis', '#/garde/pile'],
  ['Ajmani', '#/garde/ajmani'],
  ['Les bureaux', '#/garde/bureaux'],
  ['Salle commune', '#/garde/commune'],
  ['Calendrier', '#/garde/calendrier'],
  /* Supervision — le parc vu d'en haut. */
  ['Vue d\'ensemble', '#/tour'],
  ['Organisations', '#/tour/organisations'],
  ['Journal d\'accès', '#/tour/journal'],
  ['Atelier', '#/tour/generateur'],
  /* Parc — la famille la plus technique. */
  ['Parc · Supervision', '#/supervision'],
  ['Sites', '#/sites'],
  ['Trackers', '#/tracker'],
  ['Maturité SOC', '#/maturite-soc'],
  ['Comparatif clientes', '#/comparatif'],
  ['Alertes personnalisées', '#/alertes-personnalisees'],
  ['Rapport client enrichi', '#/rapport-client'],
  ['Scanner', '#/scanner'],
  ['Comply', '#/comply'],
  ['SSL Monitor', '#/ssl'],
  ['Décisions', '#/decisions'],
  ['Connaissances', '#/knowledge'],
  ['Équipe', '#/team'],
  /*
    LES CINQ BUREAUX (cahiers 11 à 15) — chaque écran a son objet dominant,
    un ambre au plus, et un rouge au plus : l'objet critique lui-même. Une
    route entre crochets se résout en suivant le premier lien d'une page : un
    dossier, une pièce ou un compte rendu n'ont pas d'adresse fixe.
  */
  ['Supervisor · horizon', '#/supervisor'],
  ['Supervisor · grille', '#/supervisor/grille'],
  ['Supervisor · carte du parc', '#/supervisor/carte'],
  ['Supervisor · à traiter', '#/supervisor/a-traiter'],
  ['Supervisor · dossier client', ['#/supervisor/places', 'a[href*="#/supervisor/dossiers/"]']],
  ['Supervisor · santé des places', '#/supervisor/places'],
  ['Supervisor · renouvellements', '#/supervisor/renouvellements'],
  ['Supervisor · chercheur', '#/supervisor/chercheur'],
  ['Supervisor · automatisations', '#/supervisor/automatisations'],
  ['Supervisor · groupes', '#/supervisor/groupes'],
  ['Supervisor · prévision de charge', '#/supervisor/charge'],
  ['Supervisor · bug chez une cliente', '#/supervisor/bug/bx-bug-1'],
  ['Cyber · rempart', '#/cyber'],
  ['Cyber · posture', '#/cyber/posture'],
  ['Cyber · surface d’attaque', '#/cyber/surface'],
  ['Cyber · alertes', '#/cyber/alertes'],
  ['Cyber · fiche incident', ['#/cyber', 'a[href*="#/cyber/incidents/"]']],
  ['Cyber · vulnérabilités', '#/cyber/vulnerabilites'],
  ['Cyber · inventaire', '#/cyber/inventaire'],
  ['Cyber · inventaire d’une cliente', ['#/cyber/inventaire', 'a[href*="#/cyber/inventaire/"]']],
  ['Cyber · échéances', '#/cyber/echeances'],
  ['Cyber · journal d’audit', '#/cyber/journal'],
  ['Cyber · playbooks', '#/cyber/playbooks'],
  ['Cyber · crise', '#/cyber/crise'],
  ['Cyber · hameçonnage', '#/cyber/hameconnage'],
  ['Cyber · secrets', '#/cyber/secrets'],
  ['Cyber · rapports', '#/cyber/rapports'],
  ['Cyber · carnet de bord', '#/cyber/carnet'],
  ['Studio · façade', '#/studio'],
  ['Studio · pièce, croquis', ['#/studio', 'a[href*="#/studio/pieces/"]', '/croquis']],
  ['Studio · pièce, prompts', ['#/studio', 'a[href*="#/studio/pieces/"]', '/prompts']],
  ['Studio · pièce, notes', ['#/studio', 'a[href*="#/studio/pieces/"]', '/notes']],
  ['Studio · pièce, analytique', ['#/studio', 'a[href*="#/studio/pieces/"]', '/analytique']],
  ['Studio · pièce, livraison', ['#/studio', 'a[href*="#/studio/pieces/"]', '/livraison']],
  ['Studio · pièce, retours', ['#/studio', 'a[href*="#/studio/pieces/"]', '/retours']],
  ['Studio · budget de performance', '#/studio/performance'],
  ['Studio · recette visuelle', '#/studio/recette'],
  ['Studio · accessibilité', '#/studio/accessibilite'],
  ['Stratégie · mur', '#/strategie'],
  ['Stratégie · campagnes', '#/strategie/campagnes'],
  ['Stratégie · storyboards', '#/strategie/storyboards'],
  ['Stratégie · calendrier', '#/strategie/calendrier'],
  ['Stratégie · pipeline', '#/strategie/pipeline'],
  ['Stratégie · fiche prospect', ['#/strategie/pipeline', 'a[href*="#/strategie/pipeline/"]']],
  ['Stratégie · enquête', '#/strategie/enquete'],
  ['Stratégie · objectifs', '#/strategie/objectifs'],
  ['Stratégie · trackers', '#/strategie/trackers'],
  ['Stratégie · liège', '#/strategie/liege'],
  ['Stratégie · attribution', '#/strategie/attribution'],
  ['Stratégie · témoignages', '#/strategie/temoignages'],
  ['La Garde · organigramme', '#/garde/organigramme'],
  ['La Garde · compte rendu', ['#/garde/organigramme', 'a[href*="#/garde/compte-rendu/"]']],
  ['La Garde · historique 30 jours', ['#/garde/organigramme', 'a[href*="/historique"]']],
  ['La Garde · nuit écoulée', '#/garde/nuit'],
  ['La Garde · simulateur', '#/garde/simulateur'],
];

/** Les rouges du critique, sous leurs écritures rendues : trait, texte, remplissage. */
const ROUGES = ['rgb(255, 66, 48)', 'rgb(255, 88, 71)', 'rgb(221, 47, 38)'];
/*
  « Jamais un écran baigné de rouge » (BUREAUX.md §1) : au-delà de cette
  part du contenu couverte de fonds rouges — y compris le fond sombre du
  critique et le rouge dilué —, l'écran n'a plus un objet critique, il est
  critique partout, ce qui revient à ne plus rien dire.
*/
const PART_ROUGE_MAX = 0.12;
/*
  « Rouge une fois par écran » est la règle des BUREAUX (BUREAUX.md, « Le
  signal ») : elle tient sur toute l'édition interne, écrans recousus compris.
  L'édition cliente suit la règle du README — le rouge réservé au critique
  (rupture de stock, devis refusé, contrôle non conforme) — sans compte par
  écran : ses répétitions sont relevées ici, pour mémoire, sans faire échouer
  la garde. « Jamais baigné de rouge » vaut pour les deux éditions.
*/
const ROUGE_UNE_FOIS = process.env.AMN_EDITION === 'interne';

/** Une route fixe, ou la cible du premier lien d'une page (et un suffixe à lui ajouter). */
async function resoudre(page, route) {
  if (typeof route === 'string') return route;
  const [depuis, lien, suffixe = ''] = route;
  await page.goto(APP + depuis, { waitUntil: 'networkidle' }).catch(() => undefined);
  await page.waitForTimeout(900);
  const href = await page.locator(lien).first().getAttribute('href').catch(() => null);
  if (!href) return depuis;
  return suffixe ? `${/^#\/[^?]*?\/(pieces|dossiers|incidents)\/[^/?]+/.exec(href)?.[0] ?? href}${suffixe}` : href;
}

const ECRANS = [
  /* La famille Pilotage, recomposée en septembre 2026 : chaque module y a
     reçu son instrument, donc chacun y a une région ambre neuve à mesurer. */
  ['Journal de bord', '#/journal-de-bord'],
  ['Revue hebdo', '#/revue-hebdo'],
  ['Formulaires', '#/formulaires'],
  ['Mini-page', '#/mini-page'],
  ['Lettre d\'information', '#/lettre'],
  ['Signature sur place', '#/signature'],
  ['Portfolio', '#/portfolio'],
  ['Accueil', ''],
  ['Clients', '#/clients'],
  ['Projets', '#/projets'],
  ['Notes', '#/notes'],
  ['Contrats', '#/contrats'],
  ['Commandes', '#/commandes'],
  ['Facturation', '#/facturation'],
  /* Devis n'est PAS une entrée de barre latérale — il vit sous Facturation
     (`MODULES.md`, module 19). Il est mesuré ici par son adresse réelle. */
  ['Devis', '#/facturation/devis'],
  ['Dépenses', '#/depenses'],
  ['Abonnements', '#/abonnements'],
  ['Caisse du jour', '#/caisse'],
  ['Événements', '#/evenements'],
  ['Agenda', '#/agenda'],
  ['Réunions', '#/reunions'],
  ['Priorités', '#/priorites'],
  ['Routines', '#/routines'],
  ['Temps', '#/temps'],
  ['Stock', '#/stock'],
  ['Tournées', '#/tournees'],
  ['Contrôles', '#/controles'],
  ['Matériel', '#/materiel'],
  ['Pages', '#/pages'],
  ['Rapports', '#/reports'],
  ['Médias', '#/media'],
  /* `/outils/automatisations`, et non `/automations` : l'ancienne adresse
     n'existe dans aucune des deux éditions, et le routeur repliait donc sur
     l'accueil — cette ligne mesurait l'Accueil une seconde fois, et rendait un
     vert qui ne parlait pas d'Automatisations. */
  ['Automatisations', '#/outils/automatisations'],
  ['Avant la paie', '#/personnel/budget'],
  ['Tâches', '#/tasks'],
  ['Objectifs & résultats', '#/objectifs-resultats'],
  /* La famille « collectif », composée le 12 septembre : quatre natures
     différentes, donc quatre écrans à mesurer. Groupes est dans la liste
     alors qu'il n'a AUCUN ambre — la garde compte un maximum, zéro la
     satisfait, et l'écran y figure pour que l'ajout d'un ambre un jour
     passe devant elle plutôt qu'à côté. */
  ['Sondages', '#/sondages'],
  ['Annonces', '#/annonces'],
  ['Appels', '#/appels'],
  ['Groupes', '#/groupes'],
  /* La famille « files » : quelque chose arrive et attend une réponse. */
  ['Relances', '#/relances'],
  ['SAV', '#/sav'],
  /* Rendez-vous en ligne : une VITRINE, pas une file — voir l'en-tête de
     `BookingScreen.tsx`. Aucun ambre quand la page est ouverte et pourvue. */
  ['RDV en ligne', '#/rdv-en-ligne'],
  /* La famille « système » : le piège y était l'écran de réglages générique.
     Chacun a un objet — le bloc de diagnostic, la carte du produit, la porte
     fermée, le plan des rubriques, les places de la formule — et un seul
     ambre, parfois aucun quand rien ne demande de décision. */
  ['Assistance', '#/assistance'],
  ['Découvrir', '#/decouvrir'],
  ['Coffre-fort', '#/vault'],
  ['Paramètres', '#/settings'],
  ['Membres', '#/membres'],
  ['Messages privés', '#/messages-prives'],
  /* La famille « plans » : des données à deux axes, et le piège de la
     deuxième matrice — voir l'en-tête de `ShiftsScreen.tsx`. */
  ['Planning d\'équipe', '#/planning'],
  ['Absences', '#/absences'],
  ['Tableau des projets', '#/tableau-projets'],
  ['Prospects', '#/pipeline'],
  /* La famille « registres » : on y cherche une entrée, on n'y surveille pas
     un état. Trombinoscope fait exception depuis `20a` : sa fiche ouverte est
     ambre — non pour dire « décide », mais pour dire où regarde l'œil dans un
     rang de fiches identiques. Un seul objet, donc la garde reste satisfaite ;
     l'arbitrage est écrit dans l'en-tête de `DirectoryScreen.tsx`. */
  ['Fournisseurs', '#/fournisseurs'],
  ['Interventions', '#/interventions'],
  ['Calculatrice pro', '#/outils/calculatrice'],
  /* La famille « personnel » : le ton y change — pas de cible, pas de
     rendement. Les objets y sont des objets (balance, ticket, cadran, marée,
     cairn, carnet), et chacun n'a qu'un ambre, souvent aucun. */
  ['Habitudes', '#/personnel/habitudes'],
  ['Courses', '#/personnel/courses'],
  ['Pomodoro', '#/personnel/pomodoro'],
  ['Journal perso', '#/personnel/journal'],
  ['Objectifs perso', '#/personnel/objectifs'],
  ['Carnet de santé', '#/personnel/sante'],
  /* La famille « outils » : l'objet dominant d'un utilitaire est CE QU'IL
     PRODUIT. Import/export y figure bien qu'il n'ait aucun ambre au repos —
     son aiguillage ne s'allume qu'une fois un fichier lu, et la garde compte
     un maximum, que zéro satisfait. */
  ['QR codes', '#/outils/qr'],
  ['Convertisseurs', '#/outils/convertisseurs'],
  ['Import / export', '#/outils/donnees'],
  ['Nomenclatures', '#/nomenclatures'],
  ['Modèles', '#/outils/modeles'],
  ['Trombinoscope', '#/trombinoscope'],
  /* La famille « ce qui fait revenir » : chacun a un objet à lui, et un seul
     ambre — le dixième tampon, l'aiguille du peson, la racine de la branche
     la plus lourde. */
  ['Fidélité', '#/fidelite'],
  ['Avis', '#/avis'],
  ['Parrainage', '#/parrainage'],
  /* Les quarante-cinq modules des cahiers 6 à 8, famille par famille. Chacun
     a un objet dominant et une région ambre au plus — l'étape qui perd le
     plus, les places à vendre, la plaque « pour l'autre rive », le devis qui
     attend dans le sas, le creux de la FAQ, la promesse hors mandat. */
  ['Boutique', '#/boutique'],
  ['Billetterie', '#/billetterie'],
  ['Dons', '#/dons'],
  ['Acompte en ligne', '#/acompte'],
  ['Chatbot', '#/chatbot'],
  ['Standard', '#/standard'],
  ['Montage vidéo', '#/montage-video'],
  ['Visuels pub', '#/visuels-pub'],
  ['Planificateur', '#/planificateur'],
  ['Podcast', '#/podcast'],
  ['Identité visuelle', '#/identite-visuelle'],
  ['Images produits', '#/images-produits'],
  ['Sentiment', '#/sentiment'],
  ['Veille', '#/veille-prix'],
  ['NPS', '#/nps'],
  ['Trésorerie prévue', '#/tresorerie'],
  ['Scénarios', '#/scenarios'],
  ['Simulateur de prêt', '#/simulateur-pret'],
  ['Analytique', '#/analytique'],
  ['Rapprochement', '#/rapprochement'],
  ['Prévision fiscale', '#/prevision-fiscale'],
  ['Multi-devises', '#/multi-devises'],
  ['Notes de frais', '#/notes-de-frais'],
  ['Factures entrantes', '#/factures-entrantes'],
  ['Recrutement', '#/recrutement'],
  ['Procédures', '#/procedures'],
  ['Formation', '#/formation'],
  ['Habilitations', '#/habilitations'],
  ['Bulletins de paie', '#/bulletins'],
  ['Clausier', '#/clausier'],
  ['Signature à distance', '#/signature-a-distance'],
  ['RGPD', '#/rgpd'],
  ['Impact RSE', '#/impact-rse'],
  ['Vérification d’identité', '#/verification-identite'],
  ['Tableau de bord', '#/tableau-de-bord'],
  ['Scoring des leads', '#/scoring-leads'],
  ['Itinéraires', '#/itineraires'],
  ['Prévision de stock', '#/prevision-stock'],
  ['Flotte', '#/flotte'],
  ['Classeur', '#/classeur'],
  ['Éditeur partagé', '#/editeur-partage'],
  ['Salles', '#/salles'],
  ['Rédaction', '#/outils/redaction'],
  ['Traduction', '#/outils/traduction'],
  ['Extensions', '#/extensions'],
];

const serveur = spawn('node', [new URL('./servir-bundle.mjs', import.meta.url).pathname, BUNDLE, String(PORT)], {
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 3000));

const navigateur = await chromium.launch({ executablePath: CHROMIUM });
const page = await navigateur.newPage({ viewport: { width: 1180, height: 1000 } });
const fautifs = [];
/* Les deux règles de l'écran vide — comptées à part, parce qu'elles se corrigent autrement. */
const videAmbre = [];
const videZeros = [];
/* La règle rouge : un critique par écran, jamais un écran baigné de rouge. */
const rougesMultiples = [];
const rougesPourMemoire = [];
const baignes = [];
let mesures = 0;

try {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(MOT_DE_PASSE);
  await page.locator('button[type="submit"]').click();
  for (let i = 0; i < 20 && (await page.content()).includes('name="password"'); i += 1) {
    await page.waitForTimeout(500);
  }
  if ((await page.content()).includes('name="password"')) {
    throw new Error('connexion refusée — vérifiez le compte d’essai et l’API pointée par le bundle');
  }
  await page.waitForTimeout(1200);

  /*
    LA FAMILLE « PERSONNEL » NE PASSE PAS PAR L'API.

    Ses six écrans lisent `localStorage`, par compte : ouverts tels quels, ils
    sont VIDES, et cette garde — qui compte un MAXIMUM — les déclarait en
    règle sans avoir rien mesuré. Un écran vide qui passe la garde ne prouve
    rien du tout. On pose donc le même jeu d'essai que la campagne de
    captures avant de mesurer.
  */
  await page.evaluate((entrees) => {
    for (const [cle, valeur] of Object.entries(entrees)) {
      window.localStorage.setItem(cle, JSON.stringify(valeur));
    }
  }, clesPersonnelles(EMAIL));
  /* Le Coffre-fort non plus ne passe pas par l'API : sans secrets, sa porte
     fermée annonce « 0 », et l'écran est jugé vide. */
  await page.evaluate(([cle, secrets]) => window.localStorage.setItem(cle, JSON.stringify(secrets)), [
    CLE_COFFRE,
    coffreFort(),
  ]);
  /* La carte de Découvrir non plus : sans journal d'ouvertures, ses huit
     familles lisent « 0 / n » et ses trois relevés valent zéro. */
  await page.evaluate(([cle, journal]) => window.localStorage.setItem(cle, JSON.stringify(journal)), [
    cleOuvertures(EMAIL),
    ouverturesDEssai(),
  ]);

  for (const [nom, adresse] of (process.env.AMN_EDITION === 'interne' ? ECRANS_INTERNE : ECRANS)) {
    const route = await resoudre(page, adresse);
    await page.goto(APP + route, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(900);
    const mesure = await page.evaluate((ROUGES) => {
      // La teinte du signal, sous ses deux écritures possibles une fois rendue.
      const AMBRE = ['rgb(208, 154, 74)', '#d09a4a'];
      const porte = (valeur) => AMBRE.some((a) => (valeur ?? '').toLowerCase().includes(a));
      const marques = [];
      const contenu = document.querySelector('main') ?? document.querySelector('[role="main"]');
      for (const el of (contenu ? contenu.querySelectorAll('*') : [])) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
        /*
          `fill` et `stroke` SONT LUS, comme le fond et l'encre.

          Sans eux, tout un instrument dessiné en SVG — un jeton de
          diagramme, un curseur d'abaque, une impulsion — pouvait être ambre
          sans que cette garde le voie. Elle comptait alors zéro objet sur un
          écran qui en portait un, et aurait laissé passer un SECOND ambre
          posé plus tard en HTML. Une garde aveugle sur la moitié des dessins
          est une garde qui rassure à tort.

          `fill` s'HÉRITE en SVG : un `<g>` ambre rend tous ses enfants ambre
          au calcul. Ce n'est pas un problème ici — le filtre des racines
          (« un descendant d'un objet déjà compté n'est pas un deuxième
          objet ») les réduit à un seul nœud, qui est précisément le groupe.
        */
        const touche =
          porte(s.backgroundColor) ||
          porte(s.backgroundImage) ||
          porte(s.color) ||
          porte(s.fill) ||
          porte(s.stroke) ||
          porte(s.borderTopColor) ||
          porte(s.borderLeftColor) ||
          porte(s.boxShadow);
        if (touche) marques.push(el);
      }
      // Un descendant d'un objet déjà compté n'est pas un deuxième objet.
      const racines = marques.filter((el) => !marques.some((autre) => autre !== el && autre.contains(el)));
      /*
        UN SIGNAL PEUT S'ÉCRIRE EN DEUX ENDROITS — et reste un signal.

        Cas réel, prévu par le paquet de design lui-même : sur Facturation, le
        montant en retard et le segment de barre qui le représente disent LA
        MÊME CHOSE, à deux endroits de la même bande. La table des écrans les
        nomme d'ailleurs d'un seul terme (« le segment en retard »), et le
        montant est l'une des deux exceptions écrites de la règle 2.
        `data-signal-groupe` rend cette parenté explicite dans le code plutôt
        que de la laisser à l'appréciation de qui relit. Deux groupes
        différents sur un écran restent deux fautes.
      */
      const vus = new Set();
      const uniques = racines.filter((el) => {
        const groupe = el.getAttribute('data-signal-groupe') ?? el.closest('[data-signal-groupe]')?.getAttribute('data-signal-groupe');
        if (!groupe) return true;
        if (vus.has(groupe)) return false;
        vus.add(groupe);
        return true;
      });
      const nomme = (el) => {
        const t = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 48);
        return `${el.tagName.toLowerCase()}${t ? ` « ${t} »` : ''}`;
      };

      /*
        L'ÉCRAN VIDE — la deuxième règle, et son corollaire.

        Le système de design la tire des deux états transverses : « un écran
        vide n'a pas d'ambre » (il n'a rien à signaler), et « aucun chiffre à
        zéro nulle part » (« 0 € encaissé » se lit comme un échec). Les deux
        se mesurent ici parce qu'elles ne se voient qu'une fois rendues, sur
        un compte qui n'a pas encore de données.

        Le marqueur vient de `<EcranVide>` (src/components/EtatEcran.tsx) : un
        nœud en `display: contents`, sans boîte, posé autour du contenu de
        l'écran. Un écran qui ne le pose pas n'est pas contrôlé — la garde ne
        DEVINE pas qu'un écran est vide, elle lit ce qu'il déclare.
      */
      const marqueur = contenu?.querySelector('[data-ecran-vide]');
      const vide = Boolean(marqueur);
      const zeros = [];
      if (vide) {
        for (const el of contenu.querySelectorAll('.tnum, [class*="font-mono"]')) {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          /* Une TOUCHE n'est pas un relevé : la touche « 0 » du pavé de la
             Calculatrice pro, le taux « 0 % » qu'on choisit, se lisent comme
             des commandes, pas comme « rien n'est encore passé ». */
          if (el.closest('button, [role="radio"], [role="button"]')) continue;
          const t = (el.textContent ?? '').trim();
          // « 0 », « 0 € », « 0,00 € », « 0 h », « 0 % » — un relevé nul écrit en clair.
          if (/^0([.,]0+)?\s*(€|%|h|j|min)?$/i.test(t)) zeros.push(nomme(el));
        }
      }

      /*
        LE ROUGE — le critique seul, et à un seul endroit par écran.

        Même mesure que l'ambre (racines, groupes), avec son propre attribut
        de parenté, `data-critique-groupe` : le repère rouge d'une jauge et
        l'étiquette qu'il désigne sont UN objet critique. Ailleurs sur le même
        écran, le critique s'écrit à l'encre (« CRITIQUE »).
      */
      const porteRouge = (valeur) => ROUGES.some((a) => (valeur ?? '').toLowerCase().includes(a));
      const rouges = [];
      for (const el of (contenu ? contenu.querySelectorAll('*') : [])) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
        /* Une LÉGENDE n'est pas un objet : c'est la clé de la couleur, telle que
           le paquet la dessine (45a, « Critique ×10 » à côté de sa pastille). */
        if (el.closest('[data-legende]')) continue;
        if ([s.backgroundColor, s.backgroundImage, s.color, s.fill, s.stroke, s.borderTopColor, s.borderLeftColor, s.boxShadow].some(porteRouge)) rouges.push(el);
      }
      const racinesRouges = rouges.filter((el) => !rouges.some((autre) => autre !== el && autre.contains(el)));
      const vusRouges = new Set();
      const critiques = racinesRouges.filter((el) => {
        const groupe = el.closest('[data-critique-groupe]')?.getAttribute('data-critique-groupe');
        if (!groupe) return true;
        if (vusRouges.has(groupe)) return false;
        vusRouges.add(groupe);
        return true;
      });
      /* La part du contenu sous un fond rouge — trait, texte, remplissage, fond sombre du critique, rouge dilué. */
      const FONDS = [...ROUGES, 'rgb(20, 9, 8)', 'rgba(255, 66, 48, 0.14)'];
      const fonds = [];
      for (const el of (contenu ? contenu.querySelectorAll('*') : [])) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        if (FONDS.some((f) => (s.backgroundColor ?? '').toLowerCase().includes(f))) fonds.push(el);
      }
      const racinesFonds = fonds.filter((el) => !fonds.some((autre) => autre !== el && autre.contains(el)));
      const cadre = contenu?.getBoundingClientRect();
      const aireContenu = cadre ? cadre.width * Math.max(contenu.scrollHeight, cadre.height) : 1;
      const aireRouge = racinesFonds.reduce((t, el) => {
        const r = el.getBoundingClientRect();
        return t + r.width * r.height;
      }, 0);

      return { objets: uniques.map(nomme), vide, zeros, critiques: critiques.map(nomme), partRouge: aireRouge / Math.max(1, aireContenu) };
    }, ROUGES);
    mesures += 1;
    const { objets, vide, zeros, critiques, partRouge } = mesure;
    if (objets.length > 1) fautifs.push({ nom, route, objets });
    if (vide && objets.length > 0) videAmbre.push({ nom, route, objets });
    if (zeros.length > 0) videZeros.push({ nom, route, zeros });
    if (critiques.length > 1) (ROUGE_UNE_FOIS ? rougesMultiples : rougesPourMemoire).push({ nom, route, critiques });
    if (partRouge > PART_ROUGE_MAX) baignes.push({ nom, route, partRouge });
    const faute = objets.length > 1 || (vide && objets.length > 0) || zeros.length || (ROUGE_UNE_FOIS && critiques.length > 1) || partRouge > PART_ROUGE_MAX;
    const etat = faute ? '✗' : objets.length === 1 || critiques.length === 1 ? '·' : ' ';
    const suffixe = `${critiques.length ? ` · ${critiques.length} rouge` : ''}${partRouge > 0.005 ? ` (${Math.round(partRouge * 100)} % du contenu)` : ''}${vide ? ' · écran vide' : ''}`;
    console.log(`  ${etat} ${nom.padEnd(24)} ${objets.length} objet(s) ambre${suffixe}`);
  }
} finally {
  await navigateur.close();
  serveur.kill('SIGTERM');
}

console.log('');
if (rougesPourMemoire.length > 0) {
  console.log(`Pour mémoire (édition cliente, règle du README) — ${rougesPourMemoire.length} écran(s) répètent le rouge du critique :`);
  for (const f of rougesPourMemoire) console.log(`  · ${f.nom} (${f.route || '/'}) — ${f.critiques.length} marques`);
  console.log('');
}
if (fautifs.length === 0 && videAmbre.length === 0 && videZeros.length === 0 && rougesMultiples.length === 0 && baignes.length === 0) {
  console.log(`OK — ${mesures} écran(s) mesuré(s), aucun n’a plus d’un objet ambre.`);
  console.log('Les écrans déclarés vides n’en portent aucun, et n’affichent aucun relevé à zéro.');
  console.log(
    ROUGE_UNE_FOIS
      ? `Le rouge : un objet critique au plus par écran, et aucun écran à plus de ${Math.round(PART_ROUGE_MAX * 100)} % de fonds rouges.`
      : `Le rouge : aucun écran à plus de ${Math.round(PART_ROUGE_MAX * 100)} % de fonds rouges.`,
  );
  process.exit(0);
}

if (rougesMultiples.length > 0) {
  console.error(`${rougesMultiples.length} écran(s) disent le critique en rouge plus d’une fois :\n`);
  for (const f of rougesMultiples) {
    console.error(`  ✗ ${f.nom} (${f.route || '/'}) — ${f.critiques.length} objets :`);
    for (const o of f.critiques) console.error(`      · ${o}`);
  }
  console.error('\nLe rouge marque l’objet critique lui-même, une fois ; ailleurs, « CRITIQUE » s’écrit à l’encre.\n');
}

if (baignes.length > 0) {
  console.error(`${baignes.length} écran(s) baignés de rouge :\n`);
  for (const f of baignes) console.error(`  ✗ ${f.nom} (${f.route || '/'}) — ${Math.round(f.partRouge * 100)} % du contenu sous un fond rouge`);
  console.error('');
}

if (fautifs.length > 0) {
  console.error(`${fautifs.length} écran(s) portent plus d’un objet ambre :\n`);
  for (const f of fautifs) {
    console.error(`  ✗ ${f.nom} (${f.route || '/'}) — ${f.objets.length} objets :`);
    for (const o of f.objets) console.error(`      · ${o}`);
  }
  console.error(
    '\nL’ambre marque ce qui demande une DÉCISION, et un écran n’en pose qu’une à la fois.\n' +
      'Deux ambres sur un écran, ce n’est pas deux signaux : c’est aucun.',
  );
}

if (videAmbre.length > 0) {
  console.error(`\n${videAmbre.length} écran(s) VIDES portent de l’ambre :\n`);
  for (const f of videAmbre) {
    console.error(`  ✗ ${f.nom} (${f.route || '/'}) :`);
    for (const o of f.objets) console.error(`      · ${o}`);
  }
  console.error('\nUn écran vide n’a rien à signaler. C’est l’exception écrite à la règle d’ambre.');
}

if (videZeros.length > 0) {
  console.error(`\n${videZeros.length} écran(s) vides affichent un relevé à zéro :\n`);
  for (const f of videZeros) {
    console.error(`  ✗ ${f.nom} (${f.route || '/'}) :`);
    for (const z of f.zeros) console.error(`      · ${z}`);
  }
  console.error(
    '\n« 0 € encaissé » se lit comme un échec ; « rien n’est encore passé en caisse »\n' +
      'se lit comme un début. Sur un écran vide, on écrit la phrase, pas le chiffre.',
  );
}
process.exit(1);
