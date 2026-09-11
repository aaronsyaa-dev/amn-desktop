#!/usr/bin/env node
/**
 * LA CAMPAGNE DE CAPTURES — pour juger le rendu sur des écrans REMPLIS
 * ════════════════════════════════════════════════════════════════════
 *
 * `captures-design.mjs` sert la boucle de travail : deux ou trois écrans, à la
 * volée, pendant qu'on compose. Celui-ci sert la REVUE : les deux éditions
 * entières, rangées, nommées, avec un manifeste de ce qui a été mesuré.
 *
 * ## Ce qu'il fait de plus, et pourquoi
 *
 * Il lit le TITRE de chaque écran après l'avoir chargé, et signale ceux qui
 * rendent le même que l'Accueil. C'est un piège déjà tombé une fois dans ce
 * dépôt : `#/automations` n'existait dans aucune des deux éditions, le routeur
 * repliait sur l'Accueil, et un contrôle affichait un vert paisible pour un
 * écran qu'il n'avait jamais vu. Une capture d'Accueil rangée sous le nom
 * « Automatisations » est pire qu'une capture manquante — elle se relit sans
 * qu'on s'en aperçoive.
 *
 * La largeur est celle des maquettes (1180 px) : c'est à cette taille que la
 * direction a été dessinée, donc c'est à cette taille que la comparaison est
 * honnête.
 *
 *   AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… \
 *     node scripts/captures-revue.mjs <bundle> <edition> <sortie> [port]
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [, , bundle, edition, sortie, portArg] = process.argv;
if (!bundle || !edition || !sortie) {
  console.error('Usage : node scripts/captures-revue.mjs <bundle> <interne|cliente> <sortie> [port]');
  process.exit(2);
}

const PORT = Number(portArg ?? 4300);
const APP = `http://127.0.0.1:${PORT}/`;
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';

if (!EMAIL || !MOT_DE_PASSE) {
  console.error('Il faut AMN_E2E_EMAIL et AMN_E2E_PASSWORD (compte `@exemple.test`).');
  process.exit(2);
}

/* La largeur des maquettes. Voir l'en-tête. */
const LARGEUR = 1180;
const HAUTEUR = 1000;

/*
  LES ÉCRANS, GROUPÉS COMME LA BARRE LATÉRALE LES GROUPE.

  L'ordre n'est pas décoratif : quelqu'un qui relit cinquante captures d'affilée
  juge une direction, et une direction se juge par familles — les listes entre
  elles, l'argent entre lui, la supervision entre elle. Mélanger les familles
  ferait passer pour de l'incohérence ce qui n'est qu'un changement de sujet.

  `attente` : quelques écrans chargent leurs données par le réseau après le
  premier rendu (la supervision, la Tour). Sans ce délai on capture leur
  squelette, c'est-à-dire l'écran vide qu'on cherche justement à éviter.

  `geste` : certains écrans ne montrent leur objet dominant qu'une fois qu'on a
  CHOISI quelque chose — la feuille de Pages, la fiche d'un client, le passage
  d'un contrôle. À l'arrivée, leur panneau principal dit « choisissez à
  gauche ». C'est un état juste, et c'est le seul qu'on ne peut pas juger : la
  composition qu'on vient regarder est précisément celle d'après le choix. Un
  clic, donc, sur la première entrée de la liste.
*/
const ECRANS = {
  cliente: [
    ['accueil', ''],
    ['agenda', '#/agenda'],
    ['clients', '#/clients', 1700, 'button:has-text("Maison Bertaux")'],
    ['projets', '#/projets'],
    ['taches', '#/tasks'],
    ['priorites', '#/priorites'],
    ['objectifs-resultats', '#/objectifs-resultats'],
    ['revue-hebdo', '#/revue-hebdo'],
    ['journal-de-bord', '#/journal-de-bord'],
    ['facturation', '#/facturation'],
    ['commandes', '#/commandes'],
    ['contrats', '#/contrats'],
    ['abonnements', '#/abonnements'],
    ['depenses', '#/depenses'],
    ['relances', '#/relances'],
    ['evenements', '#/evenements'],
    ['pipeline', '#/pipeline'],
    ['caisse', '#/caisse'],
    ['temps', '#/temps'],
    ['stock', '#/stock'],
    ['tournees', '#/tournees', 1700, '[class*="panel"] button >> nth=0'],
    ['controles', '#/controles', 1700, '[class*="panel"] button >> nth=0'],
    ['materiel', '#/materiel'],
    ['fournisseurs', '#/fournisseurs'],
    ['planning', '#/planning'],
    ['tableau-projets', '#/tableau-projets'],
    ['montage', '#/montage'],
    ['sav', '#/sav'],
    ['calculateurs', '#/calculateurs'],
    ['nomenclatures', '#/nomenclatures'],
    ['notes', '#/notes'],
    ['pages', '#/pages', 1700, 'button:has-text("Accueil d’un nouveau client")'],
    ['rapports', '#/reports'],
    ['medias', '#/media'],
    ['formulaires', '#/formulaires'],
    ['mini-page', '#/mini-page'],
    ['lettre', '#/lettre'],
    ['portfolio', '#/portfolio'],
    ['signature', '#/signature'],
    ['reunions', '#/reunions', 1700, '[class*="panel"] button >> nth=0'],
    ['routines', '#/routines'],
    ['messages-prives', '#/messages-prives'],
    ['groupes', '#/groupes'],
    ['annonces', '#/annonces'],
    ['sondages', '#/sondages'],
    ['absences', '#/absences'],
    ['trombinoscope', '#/trombinoscope'],
    ['appels', '#/appels'],
    ['automatisations', '#/outils/automatisations'],
    ['convertisseurs', '#/outils/convertisseurs'],
    ['modeles', '#/outils/modeles'],
    ['qr', '#/outils/qr'],
    ['donnees', '#/outils/donnees'],
    ['avant-la-paie', '#/personnel/budget'],
    ['courses', '#/personnel/courses'],
    ['habitudes', '#/personnel/habitudes'],
    ['objectifs-perso', '#/personnel/objectifs'],
    ['journal-perso', '#/personnel/journal'],
    ['pomodoro', '#/personnel/pomodoro'],
    ['avis', '#/avis'],
    ['fidelite', '#/fidelite'],
    ['parrainage', '#/parrainage'],
    ['rdv-en-ligne', '#/rdv-en-ligne'],
    ['membres', '#/membres'],
    ['parametres', '#/settings'],
    ['coffre-fort', '#/vault'],
    ['assistance', '#/assistance'],
    ['decouvrir', '#/decouvrir'],
  ],
  interne: [
    ['accueil', ''],
    ['taches', '#/tasks'],
    ['garde-salle', '#/garde', 2600],
    ['garde-pile', '#/garde/pile', 2600],
    ['garde-bureaux', '#/garde/bureaux', 2600],
    ['garde-commune', '#/garde/commune', 2600],
    ['garde-calendrier', '#/garde/calendrier', 2600],
    ['garde-ajmani', '#/garde/ajmani', 2600],
    ['tour-de-controle', '#/tour', 2600],
    ['tour-organisations', '#/tour/organisations', 2600],
    ['tour-journal', '#/tour/journal', 2600],
    ['tour-generateur', '#/tour/generateur', 2600],
    ['salle-de-controle', '#/salle', 2600],
    ['supervision', '#/supervision', 2600],
    ['sites', '#/sites', 2200],
    ['tracker', '#/tracker', 2200],
    ['scanner', '#/scanner', 2200],
    ['comply', '#/comply', 2200],
    ['ssl', '#/ssl', 2200],
    ['maturite-soc', '#/maturite-soc', 2200],
    ['alertes-personnalisees', '#/alertes-personnalisees'],
    /*
      `/administration` n'est PAS dans cette liste, et ce n'est pas un oubli :
      la route vit sous `ClientContextLayout`, c'est-à-dire seulement quand un
      opérateur a ouvert le dossier d'une cliente. Tapée depuis le haut, elle
      tombe sur le `*` qui ramène à l'Accueil — comportement juste, que le
      détecteur de repli a d'ailleurs signalé au premier passage.
    */
    ['bibliotheque', '#/bibliotheque'],
    ['comparatif', '#/comparatif'],
    ['equipe', '#/team'],
    ['clients', '#/clients'],
    ['facturation', '#/facturation'],
    ['agenda', '#/agenda'],
    ['decisions', '#/decisions'],
    ['connaissances', '#/knowledge'],
    ['notes', '#/notes'],
    ['membres', '#/membres'],
    ['parametres', '#/settings'],
  ],
};

const liste = ECRANS[edition];
if (!liste) {
  console.error(`Édition inconnue : « ${edition} ». Attendu : interne ou cliente.`);
  process.exit(2);
}

fs.mkdirSync(sortie, { recursive: true });

const serveur = spawn(
  'node',
  [new URL('./servir-bundle.mjs', import.meta.url).pathname, bundle, String(PORT)],
  { stdio: 'ignore' },
);
await new Promise((r) => setTimeout(r, 3500));

const navigateur = await chromium.launch({ executablePath: CHROMIUM });
const page = await navigateur.newPage({ viewport: { width: LARGEUR, height: HAUTEUR } });

/** Le titre lisible de l'écran — ce qui permet de repérer un repli sur l'Accueil. */
async function titreDeLEcran() {
  return page
    .evaluate(() => {
      const h = document.querySelector('main h1, main h2, h1');
      return (h?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
    })
    .catch(() => '');
}

const journal = [];
try {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(MOT_DE_PASSE);
  await page.locator('button[type="submit"]').click();
  for (let i = 0; i < 24 && (await page.content()).includes('name="password"'); i += 1) {
    await page.waitForTimeout(500);
  }
  if ((await page.content()).includes('name="password"')) {
    throw new Error('connexion refusée — le bac à sable ne répond pas');
  }
  await page.waitForTimeout(2000);

  /*
    La carte de première ouverture masque le haut de chaque écran. Elle est
    juste, et elle ne doit pas être sur cinquante captures : on la referme une
    fois pour toutes avant de commencer.
  */
  for (let i = 0; i < 3; i += 1) {
    const compris = page.locator('button:has-text("Compris")').first();
    if ((await compris.count()) === 0) break;
    await compris.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }

  /*
    La carte « Quel est votre poste ? » ne se referme pas par « Compris » — ses
    boutons sont les missions elles-mêmes. Elle n'apparaît qu'une fois par
    compte, mais tant qu'elle est là elle occupe le haut de l'Accueil et cache
    précisément ce qu'on vient juger. « Tout garder » la referme sans rien
    retirer de la barre latérale.
  */
  const toutGarder = page.locator('button:has-text("Tout garder")').first();
  if ((await toutGarder.count()) > 0) {
    await toutGarder.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
  }

  let accueilTitre = '';
  for (const [nom, route, attente, geste] of liste) {
    await page.goto(APP + route, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(attente ?? 1700);
    /* La carte de première ouverture réapparaît par module : on la referme ici aussi. */
    const compris = page.locator('button:has-text("Compris")').first();
    if ((await compris.count()) > 0) {
      await compris.click({ timeout: 2500 }).catch(() => undefined);
      await page.waitForTimeout(500);
    }

    if (geste) {
      await page.locator(geste).first().click({ timeout: 4000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
    }

    const titre = await titreDeLEcran();
    if (route === '') accueilTitre = titre;
    const repli = route !== '' && titre !== '' && titre === accueilTitre;

    const index = String(journal.length + 1).padStart(2, '0');
    const fichier = path.join(sortie, `${index}-${nom}.png`);
    await page.screenshot({ path: fichier });
    journal.push({ nom, route, titre, repli, fichier: path.basename(fichier) });
    console.log(`  ${repli ? '⚠' : '✓'} ${nom.padEnd(24)} ${titre || '(sans titre)'}`);
  }
} finally {
  await navigateur.close();
  serveur.kill('SIGTERM');
}

const replis = journal.filter((e) => e.repli);
const manifeste = [
  `# Captures — édition ${edition}`,
  '',
  `${journal.length} écrans, mesurés à ${LARGEUR} × ${HAUTEUR} px (la largeur des maquettes).`,
  '',
  '| # | Écran | Adresse | Titre rendu |',
  '|---|---|---|---|',
  ...journal.map(
    (e, i) =>
      `| ${String(i + 1).padStart(2, '0')} | \`${e.fichier}\` | \`${e.route || '/'}\` | ${
        e.repli ? '**repli sur l’Accueil**' : e.titre || '—'
      } |`,
  ),
  '',
].join('\n');
fs.writeFileSync(path.join(sortie, 'index.md'), manifeste);

console.log(`\n${journal.length} capture(s) dans ${sortie}`);
if (replis.length > 0) {
  console.log(`\n⚠ ${replis.length} écran(s) ont rendu le même titre que l’Accueil :`);
  for (const e of replis) console.log(`  · ${e.nom} (${e.route})`);
  console.log('  Une adresse qui n’existe pas se replie sans rien dire — à vérifier.');
}
