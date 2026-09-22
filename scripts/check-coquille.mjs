#!/usr/bin/env node
/**
 * LA COQUILLE EN RAIL — ce que le paquet de design donne comme mesurable.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * La barre latérale est la seule pièce que les 94 modules des deux éditions
 * ont en permanence sous les yeux : une erreur ici ne casse pas un écran, elle
 * casse le produit d'un coup. Le README du paquet en fait le cinquième de ses
 * contrôles mécaniques, et il le formule comme une SIGNATURE :
 *
 *   « compter les `<aside>` et vérifier que chacun contient la signature du
 *     rail. Un écran dont la barre a été écrite à la main se repère à son
 *     absence. Dans le produit : un seul composant, aucune copie. »
 *
 * Ce fichier est cette phrase, exécutable. Il mesure dans un vrai navigateur
 * — un `grep` ne peut pas répondre : la hauteur d'une famille dépend du nombre
 * de modules réellement ouverts à l'organisation connectée, et le nombre de
 * plaques dépend de savoir si le module courant est épinglé ou non.
 *
 * ## Les sept mesures
 *
 *  1. UNE SEULE COLONNE DE NAVIGATION, et c'est la coquille partagée. Une
 *     seconde colonne pleine hauteur, ancrée à gauche et portant huit liens ou
 *     plus, c'est une barre écrite à la main à côté du composant.
 *
 *  2. LA SIGNATURE DU RAIL : 52 px, `box-sizing:border-box`, `padding:12px 5px`,
 *     bordure droite de 1 px. En `content-box` la même déclaration donne 63 px
 *     et un panneau de 173 — c'est la faute exacte qui a été commise une fois.
 *
 *  3. LE PANNEAU FAIT 184 px. 52 + 184 = 236, le contenu de la colonne.
 *
 *  4. LES TUILES FONT 38 × 38, BORDURE COMPRISE, DANS LES DEUX ÉTATS. Sans la
 *     bordure transparente sur la tuile ouverte, elle perd 2 px et se recentre :
 *     tout le rail tressaute d'une famille à l'autre.
 *
 *  5. `27n + 8`. Chaque ligne fait 26 px, l'interligne 1, la respiration sous
 *     le surtitre 9. La formule ne tient que si aucun nom ne revient à la
 *     ligne : on vérifie donc aussi les quatre déclarations qui l'empêchent
 *     (`min-width:0`, `overflow:hidden`, `text-overflow:ellipsis`,
 *     `white-space:nowrap`). Sans elles, « Composition & coût de revient »
 *     passe sur deux lignes, sa ligne fait 42 px, et la formule devient fausse
 *     pour la famille même qui sert à la vérifier.
 *
 *  6. DEUX PLAQUES, JAMAIS TROIS. La tuile de rail de la famille ouverte, et
 *     la ligne du module courant — épinglée OU dans le panneau, jamais les
 *     deux. C'est le quatrième contrôle du paquet, mot pour mot.
 *
 *  7. AUCUN AMBRE DANS LA COLONNE. Décision arbitrée du paquet, et le rail ne
 *     la rouvre pas : ni tuile, ni pastille, ni marqueur. `check:signal` ne
 *     peut pas la tenir — il ne regarde que `<main>` (voir sa ligne 303), donc
 *     les trois barres ont porté un filet ambre permanent sans que rien ne le
 *     signale. C'est le trou que ce fichier bouche.
 *
 * ## Ce qu'il vérifie en plus, sans navigateur
 *
 * Le code de rail de chaque famille : deux lettres majuscules, et aucun doublon
 * dans une même édition. Deux familles qui affichent « CL » dans la même
 * colonne sont exactement le défaut que le code existe pour éviter, et ça se
 * lit dans les sources.
 *
 * ## Mode d'emploi
 *
 *   1. npm run build:web            (interne)  ou  build:web:business
 *   2. AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… \
 *        node scripts/check-coquille.mjs <dossier-du-bundle> [port]
 *
 *   `AMN_EDITION=interne` choisit la liste d'écrans interne.
 *
 * Comme `check:signal` et `check:contraste`, il lui faut un navigateur, un
 * bundle et une session : il vit hors CI. Ce qu'il rend est une liste de
 * mesures fautives, avec le nombre attendu et le nombre lu — jamais un
 * simple « non ».
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ══════════════════════════════════════════════════════════════════════
   PREMIÈRE PARTIE — les codes de rail, lus dans les sources.
   ══════════════════════════════════════════════════════════════════════ */

const CATALOGUES = [
  ['src/edition/modules.business.ts', /^\s*code: '([^']*)'/gm],
  ['src/edition/modules.internal.ts', /^\s*code: '([^']*)'/gm],
  ['src/client-context/ClientSidebar.tsx', /code: '([^']*)'/g],
];

function verifierLesCodes() {
  const fautes = [];
  for (const [fichier, re] of CATALOGUES) {
    const source = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
    const codes = [...source.matchAll(re)].map((m) => m[1]);
    if (codes.length === 0) {
      fautes.push(`${fichier} : aucun code de rail lu — le lecteur est cassé ou le catalogue n'en porte pas.`);
      continue;
    }
    for (const code of codes) {
      if (!/^[A-Z]{2}$/.test(code)) {
        fautes.push(`${fichier} : le code « ${code} » n'est pas deux lettres majuscules — il ne tiendra pas dans 38 px.`);
      }
    }
    const vus = new Set();
    for (const code of codes) {
      if (vus.has(code)) {
        fautes.push(
          `${fichier} : le code « ${code} » sert à deux familles. Deux tuiles identiques dans la même colonne, c'est le défaut que le code existe pour éviter.`,
        );
      }
      vus.add(code);
    }
  }
  return fautes;
}

/* ══════════════════════════════════════════════════════════════════════
   SECONDE PARTIE — la géométrie, dans un navigateur.
   ══════════════════════════════════════════════════════════════════════ */

const BUNDLE = process.argv[2];
const PORT = Number(process.argv[3] ?? 4193);
const APP = `http://127.0.0.1:${PORT}/`;
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
const INTERNE = process.env.AMN_EDITION === 'interne';

/*
  Les écrans parcourus. Peu nombreux, et choisis : ce contrôle mesure une
  pièce UNIQUE, pas soixante-dix écrans différents. Ce qui varie d'un écran à
  l'autre et qu'il faut donc couvrir, c'est :

    · la famille ouverte — et notamment LA PLUS DENSE (Pilotage, 15 modules,
      413 px), parce que c'est celle qui casse la formule en premier si un nom
      revient à la ligne ;
    · le fait que le module courant soit ÉPINGLÉ ou non — c'est ce qui décide
      laquelle des deux plaques est où, et la règle des deux plaques ne se
      vérifie que dans les deux cas.
*/
const ECRANS = [
  /* Accueil est épinglé par défaut : la plaque du module est dans la bande. */
  ['Accueil (épinglé)', '#/'],
  /* Pilotage, la famille la plus dense de l'édition. */
  ['Objectifs & résultats (Pilotage, 15)', '#/objectifs-resultats'],
  /* Le nom le plus long du catalogue — celui qui déborde si l'ellipse manque. */
  ['Composition & coût de revient', '#/nomenclatures'],
  ['Stock (Production, 14)', '#/stock'],
  ['Membres (Système)', '#/membres'],
  ['Parrainage (Clients & revenus)', '#/parrainage'],
  ['Trombinoscope (Collectif)', '#/trombinoscope'],
  ['QR codes (Outils)', '#/outils/qr'],
  ['Pomodoro (Personnel)', '#/personnel/pomodoro'],
];
const ECRANS_INTERNE = [
  ['Accueil (épinglé)', '#/'],
  ['Objectifs & résultats (Pilotage, 15)', '#/objectifs-resultats'],
  ['Composition & coût de revient', '#/nomenclatures'],
  /* Les quatre familles que l'édition cliente n'a pas — celles qui vivaient
     derrière le sélecteur d'espace, et qui sont désormais des tuiles. */
  ['La Salle (La Garde)', '#/garde'],
  ['Vue d\'ensemble (Supervision)', '#/tour'],
  ['Sites (Parc)', '#/sites'],
  ['Scanner (Produits)', '#/scanner'],
  ['Connaissances (Collectif, 12)', '#/knowledge'],
  ['Rapports (Livrables)', '#/reports'],
  ['Membres (Système)', '#/membres'],
];

/** La teinte du signal, sous ses deux écritures possibles une fois rendue. */
const AMBRE = ['rgb(208, 154, 74)', '#d09a4a'];

async function mesurer(page) {
  return page.evaluate((AMBRE) => {
    const px = (v) => Math.round(parseFloat(v) * 100) / 100;
    /*
      UNE COLONNE DE NAVIGATION, ET PAS « UN <aside> ».

      Le README compte les `<aside>` sur les maquettes, où la barre est le seul
      qu'une page porte. Dans le produit, `<aside class="panel">` est une carte
      latérale parfaitement légitime — il y en a huit, dans le Coffre-fort, la
      Bibliothèque, les Membres, les Paramètres. Les compter rendait ce
      contrôle rouge partout sans qu'aucune barre soit écrite à la main : une
      garde qui crie toujours ne dit plus rien.

      Ce qu'on cherche vraiment, c'est une SECONDE COLONNE DE NAVIGATION :
      pleine hauteur, ancrée à gauche, étroite, et portant assez de liens pour
      en être une. Les quatre conditions ensemble ne décrivent qu'une barre
      latérale.
    */
    const colonnes = [...document.querySelectorAll('div,nav,aside')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < window.innerHeight * 0.9) return false;
      if (r.left > 300 || r.width < 40 || r.width > 320) return false;
      return el.querySelectorAll('a[href^="#/"], a[href^="/"]').length >= 8;
    });
    /* Les colonnes qui ne sont ni la coquille ni un morceau d'elle. */
    const asides = colonnes.filter(
      (el) => !el.closest('[data-coquille]') && !el.querySelector('[data-coquille]'),
    );
    const coquilles = [...document.querySelectorAll('[data-coquille]')].filter(
      (a) => a.getBoundingClientRect().width > 0,
    );
    const coquille = coquilles[0];
    if (!coquille) return { absente: true, asides: asides.length };

    const rail = coquille.querySelector('[data-rail]');
    const panneau = coquille.querySelector('[data-rail-panneau]');
    const lignes = coquille.querySelector('[data-rail-lignes]');
    if (!rail || !panneau || !lignes) return { incomplete: true };

    const sRail = getComputedStyle(rail);
    const tuiles = [...coquille.querySelectorAll('[data-rail-tuile]')].map((t) => {
      const r = t.getBoundingClientRect();
      const s = getComputedStyle(t);
      return {
        famille: t.dataset.famille,
        ouverte: t.dataset.ouverte !== undefined,
        l: px(r.width),
        h: px(r.height),
        bord: px(s.borderTopWidth),
      };
    });

    const rangs = [...lignes.querySelectorAll('[data-rail-ligne]')].map((l) => {
      const nom = l.querySelector('[data-rail-nom]');
      const s = nom ? getComputedStyle(nom) : null;
      return {
        h: px(l.getBoundingClientRect().height),
        texte: (nom?.textContent ?? '').trim(),
        /* Le nom déborde-t-il de ce qu'on lui laisse ? `scrollWidth` le dit
           même quand `overflow:hidden` le cache à l'œil. */
        coupe: nom ? nom.scrollWidth > nom.clientWidth + 1 : false,
        ellipse: s?.textOverflow === 'ellipsis',
        nowrap: s?.whiteSpace === 'nowrap',
        cache: s?.overflow === 'hidden',
        minLargeur: s ? px(s.minWidth) : null,
      };
    });

    /* Les plaques : les nœuds qui portent le dégradé, comptés par leur marque
       plutôt que par leur couleur — et VÉRIFIÉS par leur couleur, pour qu'une
       marque posée sans la plaque (ou l'inverse) se voie. */
    const marques = [...coquille.querySelectorAll('[data-plaque]')];
    const degrade = (el) => getComputedStyle(el).backgroundImage.includes('linear-gradient');
    const peintes = [...coquille.querySelectorAll('*')].filter(
      (el) =>
        getComputedStyle(el).backgroundImage.includes('rgb(30, 30, 30)') &&
        getComputedStyle(el).backgroundImage.includes('rgb(21, 21, 21)'),
    );

    /* L'ambre : fond, encre, bordure, ombre, remplissage SVG. */
    const porte = (v) => AMBRE.some((a) => (v ?? '').toLowerCase().includes(a));
    const ambre = [];
    for (const el of coquille.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
      if (
        porte(s.backgroundColor) ||
        porte(s.backgroundImage) ||
        porte(s.color) ||
        porte(s.fill) ||
        porte(s.stroke) ||
        porte(s.borderTopColor) ||
        porte(s.borderLeftColor) ||
        porte(s.boxShadow)
      ) {
        ambre.push(`${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`);
      }
    }

    return {
      asides: asides.length,
      coquilles: coquilles.length,
      largeurCoquille: px(coquille.getBoundingClientRect().width),
      rail: {
        l: px(rail.getBoundingClientRect().width),
        boxSizing: sRail.boxSizing,
        padH: px(sRail.paddingLeft),
        padV: px(sRail.paddingTop),
        bordDroit: px(sRail.borderRightWidth),
      },
      panneau: px(panneau.getBoundingClientRect().width),
      tuiles,
      surtitre: px(
        getComputedStyle(coquille.querySelector('[data-rail-surtitre]')).paddingBottom,
      ),
      /*
        LA FAMILLE OUVERTE CONTIENT-ELLE LE MODULE COURANT ?

        C'est la règle « aucun cas ne retombe sur un défaut », rendue
        mesurable : la ligne qui porte `aria-current="page"` doit être DANS le
        panneau — c'est-à-dire que la famille ouverte est bien celle du module
        où l'on est, et non la première de la liste faute de mieux. Une ligne
        épinglée courante compte aussi : sa famille doit quand même être celle
        qui s'ouvre.
      */
      familleOuverteEstLaBonne: (() => {
        const courant = coquille.querySelector('[data-rail-ligne][aria-current="page"]');
        if (courant) return true;
        /* Le module courant est épinglé : sa ligne de panneau n'est pas
           marquée `aria-current` (la plaque est en haut), on la retrouve par
           son href. */
        const epingle = coquille.querySelector('[data-rail-epingle][aria-current="page"]');
        if (!epingle) return null; /* aucun module courant : hors catalogue */
        const href = epingle.getAttribute('href');
        return [...lignes.querySelectorAll('[data-rail-ligne]')].some(
          (l) => l.getAttribute('href') === href,
        );
      })(),
      famille: coquille.querySelector('[data-rail-tuile][data-ouverte]')?.dataset.famille ?? null,
      n: Number(lignes.dataset.modules),
      hauteurLignes: px(lignes.getBoundingClientRect().height),
      rangs,
      marques: marques.length,
      marquesSansDegrade: marques.filter((m) => !degrade(m)).length,
      peintes: peintes.length,
      ambre,
    };
  }, AMBRE);
}

function juger(nom, m) {
  const f = [];
  const dire = (quoi, attendu, lu) => f.push(`${nom} · ${quoi} : attendu ${attendu}, lu ${lu}`);

  if (m.absente) {
    f.push(`${nom} · aucune coquille rendue (${m.asides} colonne(s) de navigation trouvée(s)) — la barre est-elle montée ?`);
    return f;
  }
  if (m.incomplete) {
    f.push(`${nom} · la coquille n'a pas ses trois pièces (rail, panneau, lignes) — barre écrite à la main ?`);
    return f;
  }

  /* 1 · une seule coquille, et aucun autre <aside> à côté d'elle. */
  if (m.coquilles !== 1) dire('coquilles visibles', 1, m.coquilles);
  if (m.asides > 0) {
    f.push(
      `${nom} · ${m.asides} colonne(s) de navigation à côté de la coquille : une barre écrite à la main vit à côté du composant partagé.`,
    );
  }

  /* 2 · la signature du rail. */
  if (m.rail.l !== 52) dire('largeur du rail', '52 px', `${m.rail.l} px`);
  if (m.rail.boxSizing !== 'border-box') dire('box-sizing du rail', 'border-box', m.rail.boxSizing);
  if (m.rail.padH !== 5) dire('respiration latérale du rail', '5 px', `${m.rail.padH} px`);
  if (m.rail.padV !== 12) dire('respiration verticale du rail', '12 px', `${m.rail.padV} px`);
  if (m.rail.bordDroit !== 1) dire('bordure droite du rail', '1 px', `${m.rail.bordDroit} px`);

  /* 3 · le panneau prend le reste. */
  if (m.panneau !== 184) dire('largeur du panneau', '184 px', `${m.panneau} px`);
  if (m.largeurCoquille !== 237) {
    dire('largeur de la coquille', '237 px (236 de contenu + 1 de bordure)', `${m.largeurCoquille} px`);
  }

  /* 4 · les tuiles, dans les deux états. */
  for (const t of m.tuiles) {
    if (t.l !== 38 || t.h !== 38) {
      dire(`tuile « ${t.famille} »${t.ouverte ? ' (ouverte)' : ''}`, '38 × 38 px', `${t.l} × ${t.h} px`);
    }
    if (t.bord !== 1) {
      f.push(
        `${nom} · tuile « ${t.famille} »${t.ouverte ? ' (ouverte)' : ''} : bordure de ${t.bord} px au lieu de 1. Les DEUX états la portent — sinon la tuile ouverte rétrécit de 2 px et se recentre.`,
      );
    }
  }
  const ouvertes = m.tuiles.filter((t) => t.ouverte).length;
  if (ouvertes !== 1) dire('familles ouvertes', 1, ouvertes);
  if (m.familleOuverteEstLaBonne === false) {
    f.push(
      `${nom} · la famille ouverte (« ${m.famille} ») ne contient pas le module courant : la colonne est retombée sur un défaut au lieu d'ouvrir la vraie famille.`,
    );
  }
  if (m.familleOuverteEstLaBonne === null) {
    f.push(
      `${nom} · aucun module courant dans la colonne : cet écran n'est atteignable par aucune ligne, ou la règle du préfixe le plus long l'a manqué.`,
    );
  }

  /* 5 · 27n + 8, et ce qui la rend vraie. */
  const attendue = 27 * m.n + 8;
  const lue = m.hauteurLignes + m.surtitre;
  if (lue !== attendue) {
    f.push(
      `${nom} · hauteur de la famille : attendu 27×${m.n} + 8 = ${attendue} px, lu ${lue} px (lignes ${m.hauteurLignes} + respiration ${m.surtitre})`,
    );
  }
  for (const r of m.rangs) {
    if (r.h !== 26) dire(`ligne « ${r.texte} »`, '26 px', `${r.h} px`);
    if (!r.ellipse || !r.nowrap || !r.cache || r.minLargeur !== 0) {
      f.push(
        `${nom} · « ${r.texte} » : le nom peut revenir à la ligne (ellipsis:${r.ellipse} nowrap:${r.nowrap} hidden:${r.cache} min-width:${r.minLargeur}). Les quatre déclarations vont ensemble.`,
      );
    }
  }

  /* 6 · deux plaques, jamais trois. */
  if (m.marques !== 2) {
    f.push(
      `${nom} · ${m.marques} plaque(s) au lieu de 2. Il en faut exactement deux : la tuile de rail (la famille) et la ligne du module courant — épinglée OU dans le panneau, jamais les deux.`,
    );
  }
  if (m.marquesSansDegrade > 0) {
    dire('plaques marquées mais non peintes', 0, m.marquesSansDegrade);
  }
  if (m.peintes !== m.marques) {
    f.push(
      `${nom} · ${m.peintes} nœud(s) portent le dégradé de plaque pour ${m.marques} marqué(s) : une plaque posée sans sa marque échappe au compte.`,
    );
  }

  /* 7 · aucun ambre. */
  if (m.ambre.length > 0) {
    f.push(
      `${nom} · ${m.ambre.length} nœud(s) ambre dans la colonne (${m.ambre.slice(0, 4).join(', ')}). Le paquet a arbitré : plus aucun ambre dans la coquille, ni tuile, ni pastille, ni marqueur.`,
    );
  }

  return f;
}

/* ══════════════════════════════════════════════════════════════════════ */

const fautesDeCode = verifierLesCodes();

if (!BUNDLE) {
  /* Sans bundle, la moitié statique vaut quand même : elle est le seul
     contrôle que la CI peut faire tourner sans navigateur. */
  if (fautesDeCode.length > 0) {
    console.error('\nCodes de rail : incohérences trouvées.\n');
    for (const f of fautesDeCode) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log('\nCodes de rail : cohérents (deux lettres, aucun doublon dans une édition).');
  console.log(
    'Géométrie non mesurée — passez un bundle : AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-coquille.mjs <bundle> [port]',
  );
  process.exit(0);
}

if (!EMAIL || !MOT_DE_PASSE) {
  console.error(
    'Usage : AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-coquille.mjs <dossier-du-bundle> [port]',
  );
  process.exit(2);
}

const serveur = spawn(
  'node',
  [new URL('./servir-bundle.mjs', import.meta.url).pathname, BUNDLE, String(PORT)],
  { stdio: 'ignore' },
);
await new Promise((r) => setTimeout(r, 3000));

const navigateur = await chromium.launch({ executablePath: CHROMIUM });
/*
  1180 × 1000 : la même fenêtre que `check:signal`, et assez haute pour que la
  famille la plus dense (Pilotage, 15 modules, 413 px) tienne sans défiler. Un
  panneau défilant mesurerait la hauteur du CADRE et non celle de la famille.
*/
const page = await navigateur.newPage({ viewport: { width: 1180, height: 1000 } });
const fautes = [...fautesDeCode];
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
    LA BARRE DOIT ÊTRE DÉPLIÉE POUR ÊTRE MESURÉE — et c'est un vrai cas, pas
    un artifice : repliée, la colonne EST le rail, le panneau n'est pas rendu,
    et la moitié des mesures n'a pas d'objet. On pose donc le choix explicite,
    que `lib/barreLaterale.ts` fait gagner sur la largeur de la fenêtre.
  */
  await page.evaluate(() => window.localStorage.setItem('amn.sidebar.expanded', 'true'));

  for (const [nom, route] of INTERNE ? ECRANS_INTERNE : ECRANS) {
    await page.goto(APP + route, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(700);
    const m = await mesurer(page);
    mesures += 1;
    fautes.push(...juger(nom, m));
  }
} finally {
  await navigateur.close();
  serveur.kill();
}

if (fautes.length > 0) {
  console.error(`\nCoquille : ${fautes.length} mesure(s) fautive(s) sur ${mesures} écran(s).\n`);
  for (const f of fautes) console.error(`  ✗ ${f}`);
  console.error(
    '\nLa colonne est la seule pièce que les 94 modules ont en permanence sous les yeux :\nune erreur ici ne casse pas un écran, elle casse le produit d’un coup.\n',
  );
  process.exit(1);
}

console.log(
  `\nCoquille : OK — ${mesures} écran(s), rail 52 px en border-box, panneau 184, tuiles 38 × 38,\nhauteur de famille 27n + 8, deux plaques, aucun ambre.`,
);
