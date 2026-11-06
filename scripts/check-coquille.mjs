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
 * ## Les coquilles des cinq bureaux (édition interne)
 *
 * La Garde, la Supervision, le Parc et les Produits ne s'ouvrent plus sous le
 * rail mais dans un bureau (cahier 11 §4, cahier 16). Chaque bureau a sa
 * signature, mesurée de la même façon : une barre haute de 48 px avec son
 * indicateur d'espace (28 px), son sélecteur (236 × 28) et sa sortie vers le
 * poste ; puis le pupitre (42 + horizon 22), la console (200 de large + barre
 * d'état 28), les portes (58), le dock en pied (52), l'organigramme (42 +
 * pouls 16). Une entrée courante et une seule ; aucun rail du poste rendu en
 * même temps ; ni ambre ni rouge dans les murs — le signal vit dans la pièce.
 *
 * ## Ce qu'il vérifie en plus, sans navigateur
 *
 * Le code de rail de chaque famille : deux lettres majuscules, et aucun doublon
 * dans une même édition. Deux familles qui affichent « CL » dans la même
 * colonne sont exactement le défaut que le code existe pour éviter, et ça se
 * lit dans les sources.
 *
 * ## La barre latérale v3 (socle v3, 01-SOCLE-DESIGN §0.1 et §0.4)
 *
 * Quand la nouvelle coquille est allumée (`localStorage['amn.coquille'] = 'noir'`,
 * posé par ce script avant la navigation), le rail de 52 + 184 px n'existe
 * plus : une seule colonne de 252 px, `BarreLaterale` de `src/socle/coquille/`.
 * Le second passage mesure alors, sur chaque écran de la liste interne :
 *
 *   · UN SEUL `<aside>` de navigation, 252 px `border-box`, padding 16 / 14 / 14,
 *     et plus aucun rail d'avant rendu en même temps ;
 *   · la ligne de recherche : champ de 34 px et, collé à droite, le bouton
 *     carré 34 × 34 « Tous les modules » ;
 *   · les sections ESPACE / SURVEILLANCE (/ ÉPINGLÉS) : libellés 10,5 px en
 *     capitales, 20 px de haut ;
 *   · les familles : 32 px, icône de trait de 15 px en T3, AUCUNE pastille de
 *     couleur ; la famille active : fond `#19191B`, 600, T1, chevron, icône de
 *     la couleur de la famille (la seule teinte de famille de la colonne) ;
 *   · La Garde : « veille » et son voyant ; Cyber : TOUJOURS présent ;
 *   · la sous-liste de la famille ouverte : au plus 5 lignes de 27 px, le
 *     module courant visible et marqué d'un repère blanc 2 × 13 posé sur le
 *     filet, puis « + N autres » ;
 *   · la carte « Aujourd'hui » : anneau de 34, filet, rendez-vous, présence
 *     sans adresse brute ;
 *   · l'en-tête de 60 px : fil d'Ariane (dernière miette = page), « N en ligne »,
 *     cloche de 34, pastille de La Garde dont le point porte l'onde ;
 *   · la barre Ajmani : 46 px, rayon 14, « Entrée pour envoyer » et ⌘J d'un
 *     bloc ;
 *   · aucun ambre dans la colonne, opaque ou translucide (un fond teinté
 *     `rgba(ambre, .13)`, une lueur, un dégradé comptent) — le seul point
 *     coloré admis est le voyant d'état de La Garde, qui redit l'état unique
 *     de la pastille d'en-tête ;
 *   · une seule ligne active (`aria-current="page"`).
 *
 * Coquille éteinte, les sept mesures d'origine restent ce qu'elles sont.
 *
 * ## Mode d'emploi
 *
 *   A. Le bundle servi (T1 — inchangé) :
 *
 *        npm run build:web            (interne)  ou  build:web:business
 *        AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… \
 *          node scripts/check-coquille.mjs <dossier-du-bundle> [port]
 *
 *      `AMN_EDITION=interne` choisit la liste d'écrans interne et les bureaux,
 *      puis fait le SECOND PASSAGE, coquille v3 allumée (interne seulement : le
 *      drapeau n'existe pas dans l'édition cliente). `AMN_COQUILLE=eteinte` ou
 *      `AMN_COQUILLE=allumee` ne fait qu'un des deux passages — pour isoler
 *      une faute du second, lancer `eteinte` puis `allumee` ; `allumee` hors de
 *      l'édition interne est refusé (sortie 2), pas mesuré à vide.
 *
 *   B. Une page statique, sans serveur ni connexion (ce chantier) :
 *
 *        npm run apercu -- COQUILLE-H42 --sortie /tmp/apercu/x/COQUILLE-H42
 *        node scripts/check-coquille.mjs --page /tmp/apercu/x/COQUILLE-H42/index.html
 *
 *      (ou `AMN_COQUILLE_PAGE=<index.html>`). Les mesures v3 s'exécutent sur le
 *      fichier ouvert en `file://`. Ce mode n'accepte QU'UN FICHIER LOCAL — pas
 *      d'adresse http, même sur cette machine — et refuse toute requête vers un
 *      hôte réseau (comme `scripts/qualite/fidelite/capturer.mjs`) : rien ne
 *      sort, rien n'entre. Les aperçus `COQUILLE-H40`, `-H42`, `-H47`, `-D02`
 *      (`scripts/apercu/ecrans/`) sont faits pour lui.
 *
 *   C. Sans argument : les codes de rail seulement (la moitié que la CI peut
 *      faire tourner).
 *
 * Comme `check:signal` et `check:contraste`, le mode A demande un navigateur,
 * un bundle et une session : il vit hors CI. Ce qu'il rend est une liste de
 * mesures fautives, avec le nombre attendu et le nombre lu — jamais un simple
 * « non ».
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/*
  Deux façons d'appeler : `<dossier-du-bundle> [port]` (T1, positionnel,
  inchangé) ou `--page <index.html>` (une page statique, mode B). `--page` et le
  bundle s'excluent ; une option inconnue est une erreur, pas un oubli.
*/
const ARGS = process.argv.slice(2);
const OPTIONS = {};
const POSITIONNELS = [];
for (let i = 0; i < ARGS.length; i += 1) {
  const a = ARGS[i];
  if (a.startsWith('--')) {
    const nom = a.slice(2);
    if (nom !== 'page') {
      console.error(`option inconnue : --${nom} (seule --page <index.html> existe)`);
      process.exit(2);
    }
    if (i + 1 >= ARGS.length || ARGS[i + 1].startsWith('--')) {
      console.error('--page demande un fichier index.html');
      process.exit(2);
    }
    OPTIONS[nom] = ARGS[i + 1];
    i += 1;
  } else {
    POSITIONNELS.push(a);
  }
}
const PAGE = OPTIONS.page ?? process.env.AMN_COQUILLE_PAGE ?? '';
if (PAGE && POSITIONNELS.length > 0) {
  console.error('--page (page statique) et <dossier-du-bundle> (bundle servi) s’excluent.');
  process.exit(2);
}
const BUNDLE = PAGE ? undefined : POSITIONNELS[0];
const PORT = Number(POSITIONNELS[1] ?? 4193);
const APP = `http://127.0.0.1:${PORT}/`;
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
const INTERNE = process.env.AMN_EDITION === 'interne';
/**
 * Les passages du mode A : la coquille éteinte (les sept mesures), allumée (la barre v3), ou les deux (défaut, interne).
 * Hors de l'édition interne, le drapeau n'existe pas : un seul passage, éteinte — `AMN_COQUILLE=allumee` y est refusé
 * plutôt que mesuré à vide (aucune barre v3 à trouver, une faute par écran sans raison).
 */
const PASSAGES = !INTERNE ? ['eteinte'] : process.env.AMN_COQUILLE === 'allumee' ? ['allumee'] : process.env.AMN_COQUILLE === 'eteinte' ? ['eteinte'] : ['eteinte', 'allumee'];
if (BUNDLE && !INTERNE && process.env.AMN_COQUILLE === 'allumee') {
  console.error('AMN_COQUILLE=allumee demande AMN_EDITION=interne : le drapeau de la coquille n’existe pas dans l’édition cliente.');
  process.exit(2);
}

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
  /* Le Collectif interne a rendu Équipe, Décisions et Connaissances au
     bureau Supervisor (cahier 16) : ses onze autres modules restent au poste. */
  ['Notes (Collectif, 11)', '#/notes'],
  ['Rapports (Livrables)', '#/reports'],
  ['Membres (Système)', '#/membres'],
];

/*
  LES CINQ BUREAUX — l'autre coquille de l'édition interne.

  La Garde, la Supervision, le Parc et les Produits ne s'ouvrent plus sous le
  rail : leurs écrans se posent dans un bureau (cahier 11 §4, cahier 16), dont
  la coquille a sa propre signature. Chaque bureau est mesuré sur son accueil,
  sur un écran à lui et sur un module recousu — c'est là qu'une coquille
  copiée à la main ou oubliée se verrait. Une route peut se résoudre en
  suivant le premier lien d'une page (`[page, sélecteur]`) : une pièce du
  Studio n'a pas d'adresse fixe.
*/
const ECRANS_BUREAUX = [
  ['Supervisor · l’horizon', '#/supervisor', 'supervisor'],
  ['Supervisor · Vue d’ensemble (recousue)', '#/tour', 'supervisor'],
  ['Supervisor · Équipe (recousue)', '#/team', 'supervisor'],
  ['Supervisor · prévision de charge', '#/supervisor/charge', 'supervisor'],
  ['Cyber · le rempart', '#/cyber', 'cyber'],
  ['Cyber · Sites (recousu)', '#/sites', 'cyber'],
  ['Cyber · Scanner (Produits)', '#/scanner', 'cyber'],
  ['Cyber · Journal d’accès (recousu)', '#/tour/journal', 'cyber'],
  ['Studio · la façade', '#/studio', 'studio'],
  ['Studio · budget de performance', '#/studio/performance', 'studio'],
  ['Studio · une pièce', ['#/studio', 'a[href*="#/studio/pieces/"]'], 'studio'],
  ['Stratégie · le mur', '#/strategie', 'strategie'],
  ['Stratégie · pipeline', '#/strategie/pipeline', 'strategie'],
  ['Stratégie · trackers', '#/strategie/trackers', 'strategie'],
  ['La Garde · l’organigramme', '#/garde/organigramme', 'garde'],
  ['La Garde · la Salle (recousue)', '#/garde', 'garde'],
  ['La Garde · la nuit écoulée', '#/garde/nuit', 'garde'],
];

/*
  La signature de chaque coquille (cahier 11 §4) : sa navigation principale,
  et les pièces fixes qui l'accompagnent. Les hauteurs sont celles du paquet ;
  la console de Cyber se mesure en largeur.
*/
const SIGNATURES = {
  supervisor: { nav: 'onglets', pieces: { onglets: { h: 42 }, horizon: { h: 22 } } },
  cyber: { nav: 'console', pieces: { console: { l: 200 }, etat: { h: 28 } } },
  studio: { nav: 'portes', pieces: { portes: { h: 58 } } },
  strategie: { nav: 'dock', pieces: { dock: { h: 52 } }, enPied: 'dock' },
  garde: { nav: 'onglets', pieces: { onglets: { h: 42 }, pouls: { h: 16 } } },
};

/**
 * Une teinte, par composantes. Le navigateur rend un fond, une encre, une ombre ou un dégradé en `rgb(r, g, b)` ou,
 * teinté, en `rgba(r, g, b, a)` : le fond d'une pastille (§1 : `rgba(couleur, .10 à .13)`), une lueur, un filet
 * translucide ne contiennent PAS la sous-chaîne `rgb(r, g, b)`. Les mesures comparent donc les triplets, quelle que
 * soit l'alpha (une alpha de 0 ne peint rien et ne compte pas) — voir `porte` dans chaque mesure.
 */
const triplet = (couleur) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(couleur);
  if (hex) return [0, 2, 4].map((i) => Number.parseInt(hex[1].slice(i, i + 2), 16));
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(couleur);
  if (!rgb) throw new Error(`teinte illisible : ${couleur}`);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
};
/** La teinte du signal d'avant (`#d09a4a`), par composantes. */
const AMBRE = [triplet('#d09a4a')];
/** Les rouges du critique (trait, texte, remplissage), par composantes. */
const ROUGES = ['rgb(255, 66, 48)', 'rgb(255, 88, 71)', 'rgb(221, 47, 38)'].map(triplet);

async function mesurerBureau(page) {
  return page.evaluate(([AMBRE, ROUGES]) => {
    const px = (v) => Math.round(parseFloat(v) * 100) / 100;
    const vu = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const racine = document.querySelector('[data-bureau]');
    if (!racine) return { absent: true };
    const boite = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: px(r.width), h: px(r.height), haut: px(r.top), bas: px(r.bottom) };
    };
    const main = racine.querySelector('main');
    const pieces = {};
    for (const el of racine.querySelectorAll('[data-coquille-bureau]')) {
      if (vu(el)) pieces[el.dataset.coquilleBureau] = boite(el);
    }
    /* Le module courant a-t-il son entrée marquée, et une seule ? */
    const courants = {};
    for (const el of racine.querySelectorAll('[data-coquille-bureau]')) {
      courants[el.dataset.coquilleBureau] = el.querySelectorAll('[aria-current="page"]').length;
    }
    /* Une seconde colonne de navigation à côté de la console : une barre écrite à la main. */
    const colonnes = [...document.querySelectorAll('div,nav,aside')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < window.innerHeight * 0.6) return false;
      if (r.left > 300 || r.width < 40 || r.width > 320) return false;
      if (el.closest('[data-coquille-bureau="console"]') || el.querySelector('[data-coquille-bureau="console"]')) return false;
      return el.querySelectorAll('a[href^="#/"], a[href^="/"]').length >= 8;
    });
    /* La coquille du poste ne doit pas être rendue en même temps que celle d'un bureau. */
    const rails = [...document.querySelectorAll('[data-coquille]')].filter(vu).length;
    /* Ni ambre ni rouge dans la coquille : le signal vit dans la pièce, pas dans ses murs. Par composantes (rgb ou rgba). */
    const porte = (v, triplets) => {
      for (const m of String(v ?? '').matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g)) {
        if (m[4] !== undefined && Number(m[4]) === 0) continue;
        if (triplets.some(([r, g, b]) => Number(m[1]) === r && Number(m[2]) === g && Number(m[3]) === b)) return true;
      }
      return false;
    };
    const signaux = { ambre: [], rouge: [] };
    for (const el of racine.querySelectorAll('*')) {
      if (main && main.contains(el)) continue;
      if (el.closest('[data-palette-espaces], [data-palette-espaces-voile], [data-aide-bureaux]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
      const valeurs = [s.backgroundColor, s.backgroundImage, s.color, s.fill, s.stroke, s.borderTopColor, s.borderLeftColor, s.boxShadow];
      const nom = `${el.tagName.toLowerCase()}${(el.textContent ?? '').trim() ? ` « ${(el.textContent ?? '').trim().slice(0, 30)} »` : ''}`;
      if (valeurs.some((v) => porte(v, AMBRE))) signaux.ambre.push(nom);
      if (valeurs.some((v) => porte(v, ROUGES))) signaux.rouge.push(nom);
    }
    return {
      bureau: racine.getAttribute('data-bureau'),
      barres: [...document.querySelectorAll('[data-barre-haute]')].filter(vu).map((b) => px(b.getBoundingClientRect().height)),
      indicateur: boite(racine.querySelector('[data-indicateur-espace]')),
      selecteur: boite(racine.querySelector('[data-selecteur-espace]')),
      sortie: Boolean(racine.querySelector('[data-sortie-poste]')),
      main: boite(main),
      pieces,
      courants,
      colonnes: colonnes.length,
      rails,
      signaux,
    };
  }, [AMBRE, ROUGES]);
}

function jugerBureau(nom, attendu, m) {
  const f = [];
  const dire = (quoi, a, lu) => f.push(`${nom} · ${quoi} : attendu ${a}, lu ${lu}`);
  if (m.absent) {
    f.push(`${nom} · aucun bureau rendu : l'écran s'est ouvert hors de sa coquille.`);
    return f;
  }
  if (m.bureau !== attendu) dire('bureau', attendu, m.bureau);
  const sig = SIGNATURES[attendu];
  /* La barre haute commune : une seule, 48 px, l'indicateur d'espace, le sélecteur, la sortie. */
  if (m.barres.length !== 1) dire('barres hautes visibles', 1, m.barres.length);
  else if (m.barres[0] !== 48) dire('hauteur de la barre haute', '48 px', `${m.barres[0]} px`);
  if (!m.indicateur || m.indicateur.h !== 28) dire('indicateur d’espace', 'une plaque de 28 px, toujours visible', m.indicateur ? `${m.indicateur.h} px` : 'absent');
  if (!m.selecteur || m.selecteur.l !== 236 || m.selecteur.h !== 28) dire('sélecteur d’espace', '236 × 28', m.selecteur ? `${m.selecteur.l} × ${m.selecteur.h}` : 'absent');
  if (!m.sortie) f.push(`${nom} · aucun bouton « Poste de travail » : le bureau n'a pas de sortie.`);
  /* La signature de la coquille du bureau. */
  for (const [piece, dims] of Object.entries(sig.pieces)) {
    const b = m.pieces[piece];
    if (!b) {
      f.push(`${nom} · la coquille de ${attendu} n'a pas sa pièce « ${piece} ».`);
      continue;
    }
    if (dims.h !== undefined && b.h !== dims.h) dire(`hauteur de « ${piece} »`, `${dims.h} px`, `${b.h} px`);
    if (dims.l !== undefined && b.l !== dims.l) dire(`largeur de « ${piece} »`, `${dims.l} px`, `${b.l} px`);
  }
  if (sig.enPied && m.pieces[sig.enPied] && m.main && m.pieces[sig.enPied].haut < m.main.bas - 1) {
    f.push(`${nom} · « ${sig.enPied} » doit être en pied, sous le contenu (haut ${m.pieces[sig.enPied].haut} px, contenu jusqu'à ${m.main.bas} px).`);
  }
  /* Une entrée courante, une seule, dans la navigation principale — et dans les sous-onglets s'il y en a. */
  if ((m.courants[sig.nav] ?? 0) !== 1) dire(`entrée courante dans « ${sig.nav} »`, 1, m.courants[sig.nav] ?? 0);
  if (m.pieces['sous-onglets'] && m.courants['sous-onglets'] !== 1) dire('écran courant dans les sous-onglets', 1, m.courants['sous-onglets']);
  if (m.rails > 0) f.push(`${nom} · le rail du poste est rendu en même temps que la coquille du bureau.`);
  if (m.colonnes > 0) f.push(`${nom} · ${m.colonnes} colonne(s) de navigation à côté de la coquille du bureau : une barre écrite à la main.`);
  if (m.signaux.ambre.length) f.push(`${nom} · ambre dans la coquille (${m.signaux.ambre.slice(0, 3).join(', ')}) : le signal vit dans la pièce, pas dans ses murs.`);
  if (m.signaux.rouge.length) f.push(`${nom} · rouge dans la coquille (${m.signaux.rouge.slice(0, 3).join(', ')}) : le critique est dit une fois, par l'écran, jamais par la barre.`);
  return f;
}

/** Une route fixe, ou la cible du premier lien trouvé sur une page. */
async function resoudre(page, route) {
  if (typeof route === 'string') return route;
  const [depuis, lien] = route;
  await page.goto(APP + depuis, { waitUntil: 'networkidle' }).catch(() => undefined);
  await page.waitForTimeout(900);
  const href = await page.locator(lien).first().getAttribute('href').catch(() => null);
  return href ?? depuis;
}

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

    /* L'ambre : fond, encre, bordure, ombre, remplissage SVG — opaque ou translucide (par composantes). */
    const porteTeinte = (v, triplets) => {
      for (const m of String(v ?? '').matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g)) {
        if (m[4] !== undefined && Number(m[4]) === 0) continue;
        if (triplets.some(([r, g, b]) => Number(m[1]) === r && Number(m[2]) === g && Number(m[3]) === b)) return true;
      }
      return false;
    };
    const porte = (v) => porteTeinte(v, AMBRE);
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

/* ══════════════════════════════════════════════════════════════════════
   TROISIÈME PARTIE — la barre latérale v3 (coquille allumée), dans un navigateur.
   ══════════════════════════════════════════════════════════════════════ */

/*
  Les valeurs que la barre v3 doit rendre (01-SOCLE-DESIGN §0.1 et §0.4, et
  `src/socle/noir.css`), sous leur écriture calculée par le navigateur. Les
  teintes de famille servent à prouver l'ABSENCE de pastille : la seule teinte
  de famille admise dans la colonne est celle de l'icône de la famille active.
*/
const V3 = {
  largeur: 252,
  padding: { haut: 16, cote: 14, bas: 14 },
  recherche: 34,
  tous: 34,
  famille: 32,
  icone: 15,
  sectionTitre: { taille: 10.5, hauteur: 20, encre: 'rgb(138, 138, 142)', interlettrage: 0.945 }, /* T4 #8a8a8e (`--socle-texte-3`) ; .09em × 10,5 px */
  sousLignes: 5,
  sousLigne: 27,
  repere: { l: 2, h: 13 },
  anneau: 34,
  entete: 60,
  cloche: 34,
  ajmani: { h: 46, rayon: 14 },
  fondActif: 'rgb(25, 25, 27)', /* #19191b */
  t1: 'rgb(237, 237, 237)', /* #ededed */
  iconeInactive: 'rgb(160, 160, 165)', /* #a0a0a5 — T3 du socle (`--socle-texte-2`) */
};
/** Les huit teintes de famille (§1), telles que le navigateur les rend. */
const TEINTES_FAMILLES = {
  jour: 'rgb(138, 164, 214)',
  contacts: 'rgb(111, 183, 168)',
  ecrire: 'rgb(167, 155, 219)',
  argent: 'rgb(143, 191, 122)',
  echanger: 'rgb(217, 143, 168)',
  creer: 'rgb(217, 162, 122)',
  outils: 'rgb(154, 154, 160)',
  garde: 'rgb(214, 214, 218)',
};
/** L'ambre d'avant (`#d09a4a`) et celui du socle v3 (ATTENTION `#e0b35a`), par composantes. */
const AMBRE_V3 = [...AMBRE, triplet('#e0b35a')];
/** Les teintes de famille, par composantes : pour voir une pastille teintée (`rgba(couleur, .13)`) comme une pleine. */
const TRIPLETS_FAMILLES = Object.values(TEINTES_FAMILLES).map(triplet);

async function mesurerV3(page) {
  return page.evaluate(
    ([V3, AMBRE, TRIPLETS]) => {
      const px = (v) => Math.round(parseFloat(v) * 100) / 100;
      const vu = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const boite = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { l: px(r.width), h: px(r.height), x: px(r.left), y: px(r.top), droite: px(r.right), bas: px(r.bottom) };
      };
      const texte = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
      /* Une valeur calculée porte-t-elle une des teintes ? Par composantes : rgb ou rgba, quelle que soit l'alpha (sauf 0). */
      const porte = (v, triplets) => {
        for (const m of String(v ?? '').matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g)) {
          if (m[4] !== undefined && Number(m[4]) === 0) continue;
          if (triplets.some(([r, g, b]) => Number(m[1]) === r && Number(m[2]) === g && Number(m[3]) === b)) return true;
        }
        return false;
      };

      const laterales = [...document.querySelectorAll('[data-socle="lateral"]')].filter(vu);
      /* Une seconde colonne de navigation à côté de la barre v3 : une barre écrite à la main (même règle qu'avant). */
      const colonnes = [...document.querySelectorAll('div,nav,aside')].filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.height < window.innerHeight * 0.9) return false;
        if (r.left > 300 || r.width < 40 || r.width > 320) return false;
        if (el.closest('[data-socle="lateral"]') || el.querySelector('[data-socle="lateral"]')) return false;
        return el.querySelectorAll('a[href^="#/"], a[href^="/"]').length >= 8;
      });
      const ancienRail = [...document.querySelectorAll('[data-coquille]')].filter(vu).length;
      if (laterales.length !== 1) return { absente: true, laterales: laterales.length, colonnes: colonnes.length, ancienRail };
      const aside = laterales[0];
      const s = getComputedStyle(aside);
      const boiteAside = boite(aside);

      /* La ligne de recherche : le champ et, collé à droite, le bouton carré. */
      const recherche = boite(aside.querySelector('.sc-recherche'));
      const tous = aside.querySelector('.sc-tous');
      const boiteTous = boite(tous);
      /* Le bord droit du contenu : la largeur moins le filet droit (1 px) et le padding. */
      const droiteContenu = px(boiteAside.droite - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight));

      /* Les sections nommées : taille, capitales, hauteur, encre et interlettrage (§0.1 : 10,5 px, capitales, .09em, T4, 20). */
      const sections = [...aside.querySelectorAll('[data-section]')].map((sec) => {
        const h2 = sec.querySelector('.sc-section__titre');
        const st = h2 ? getComputedStyle(h2) : null;
        return {
          id: sec.dataset.section,
          titre: texte(h2),
          taille: st ? px(st.fontSize) : null,
          capitales: st?.textTransform === 'uppercase',
          hauteur: h2 ? boite(h2).h : null,
          encre: st ? st.color : null,
          /* « normal » donne NaN : jugé faux. */
          interlettrage: st ? parseFloat(st.letterSpacing) : null,
        };
      });

      /* Les familles : hauteur, icône, teintes, état actif. */
      const familles = [...aside.querySelectorAll('.sc-famille')].map((f) => {
        const li = f.closest('li');
        const icone = f.querySelector('.sc-famille__icone');
        const sf = getComputedStyle(f);
        return {
          cle: li?.dataset.cle ?? '?',
          nom: texte(f.querySelector('.sc-famille__nom')),
          h: boite(f).h,
          icone: icone ? boite(icone) : null,
          couleurIcone: icone ? getComputedStyle(icone).color : null,
          active: f.dataset.active === 'true',
          fond: sf.backgroundColor,
          poids: sf.fontWeight,
          couleur: sf.color,
          chevron: Boolean(f.querySelector('.sc-famille__chevron')),
          section: li?.closest('[data-section]')?.dataset.section ?? null,
        };
      });
      const teintes = TRIPLETS;
      /* Une pastille de couleur : un nœud des listes au fond teinté d'une famille, plein ou translucide — hors le voyant vivant de La Garde. */
      const pastilles = [];
      for (const el of aside.querySelectorAll('.sc-nav *')) {
        if (el.closest('.sc-voyant')) continue;
        if (!vu(el)) continue;
        const se = getComputedStyle(el);
        if (porte(se.backgroundColor, teintes) || porte(se.backgroundImage, teintes)) pastilles.push(el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : ''));
      }

      /* La Garde et Cyber, dans SURVEILLANCE. */
      const liGarde = aside.querySelector('[data-section="surveillance"] li[data-cle="garde"]');
      const liCyber = aside.querySelector('[data-section="surveillance"] li[data-cle="cyber"]');
      const garde = liGarde
        ? {
            veille: texte(liGarde.querySelector('.sc-famille__veille')),
            voyant: Boolean(liGarde.querySelector('.sc-famille__etat .sc-voyant')),
            etat: liGarde.querySelector('.sc-famille__etat')?.dataset.etat ?? null,
          }
        : null;

      /* La sous-liste de la famille ouverte. */
      const ouverte = aside.querySelector('.sc-famille[aria-expanded="true"]');
      const ul = ouverte ? aside.querySelector(`#${CSS.escape(ouverte.getAttribute('aria-controls') ?? '')}`) : null;
      let sous = null;
      if (ul) {
        const lignes = [...ul.querySelectorAll('.sc-module:not(.sc-module--autres)')];
        const courant = ul.querySelector('.sc-module[aria-current="page"]');
        const autres = ul.querySelector('.sc-module--autres');
        const bUl = boite(ul);
        let repere = null;
        if (courant) {
          const bc = boite(courant);
          const sb = getComputedStyle(courant, '::before');
          repere = {
            l: px(sb.width),
            h: px(sb.height),
            couleur: sb.backgroundColor,
            /* Le repère est posé SUR le filet : son bord gauche est celui de la liste (où vit `border-left`). */
            x: px(bc.x + parseFloat(sb.left)),
            filet: bUl.x,
            filetLargeur: px(getComputedStyle(ul).borderLeftWidth),
          };
        }
        sous = {
          famille: ouverte.closest('li')?.dataset.cle ?? '?',
          n: lignes.length,
          hauteurs: lignes.map((l) => boite(l).h),
          courant: courant ? { visible: vu(courant) && boite(courant).y >= boiteAside.y && boite(courant).bas <= boiteAside.bas, texte: texte(courant) } : null,
          repere,
          /* « + N autres » : le « + » est une icône de trait de 11 px, le texte dit « N autres ». */
          autres: autres ? { texte: texte(autres), plus: Boolean(autres.querySelector('svg')), h: boite(autres).h } : null,
        };
      }

      /* La carte « Aujourd'hui ». */
      const carte = aside.querySelector('[data-socle="aujourdhui"]');
      const aujourdhui = carte
        ? {
            anneau: boite(carte.querySelector('.sc-aujourdhui__tete svg')),
            filet: boite(carte.querySelector('.sc-aujourdhui__filet')),
            rdv: Boolean(carte.querySelector('.sc-aujourdhui__rdv')),
            lieux: [...carte.querySelectorAll('.sc-aujourdhui__lieu')].map(texte),
            presence: Boolean(carte.querySelector('.sc-aujourdhui__presence') || carte.querySelector('.sc-aujourdhui__vide')),
          }
        : null;

      /* L'en-tête. */
      const entete = document.querySelector('[data-socle="entete"]');
      const miettes = entete ? [...entete.querySelectorAll('.sc-fil ol > li')] : [];
      const pointGarde = entete?.querySelector('.sc-garde .sc-voyant__point');
      const enTete = entete
        ? {
            h: boite(entete).h,
            miettes: miettes.map(texte),
            derniereCourante: miettes.length > 0 && miettes[miettes.length - 1].getAttribute('aria-current') === 'page',
            presence: texte(entete.querySelector('.sc-entete__presence')) || null,
            cloche: boite(entete.querySelector('.sc-cloche')),
            garde: entete.querySelector('.sc-garde') ? { etat: entete.querySelector('.sc-garde').dataset.etat ?? null, onde: pointGarde?.dataset.mvt === 'onde' } : null,
          }
        : null;

      /* La barre Ajmani. */
      const barre = document.querySelector('[data-socle="ajmani"]');
      const envoi = barre?.querySelector('.sc-ajmani__envoi');
      const kbd = barre?.querySelector('.sc-kbd');
      const ajmani = barre
        ? {
            h: boite(barre).h,
            rayon: getComputedStyle(barre).borderTopLeftRadius,
            envoi: envoi ? texte(envoi) : null,
            kbd: kbd ? texte(kbd) : null,
            ecart: envoi && kbd ? px(boite(kbd).x - boite(envoi).droite) : null,
          }
        : null;

      /* L'ambre, dans toute la colonne — sauf le voyant de La Garde (l'état unique, redit). */
      const ambre = [];
      for (const el of aside.querySelectorAll('*')) {
        if (el.closest('.sc-famille__etat .sc-voyant')) continue;
        if (!vu(el)) continue;
        const se = getComputedStyle(el);
        if (se.visibility === 'hidden' || se.display === 'none' || Number(se.opacity) === 0) continue;
        const valeurs = [se.backgroundColor, se.backgroundImage, se.color, se.fill, se.stroke, se.borderTopColor, se.borderLeftColor, se.boxShadow];
        if (valeurs.some((v) => porte(v, AMBRE))) ambre.push(el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : ''));
      }

      return {
        laterales: laterales.length,
        colonnes: colonnes.length,
        ancienRail,
        aside: { l: boiteAside.l, boxSizing: s.boxSizing, padHaut: px(s.paddingTop), padDroite: px(s.paddingRight), padBas: px(s.paddingBottom), padGauche: px(s.paddingLeft) },
        recherche,
        tous: boiteTous ? { ...boiteTous, droiteContenu, memeLigne: recherche ? Math.abs(boiteTous.y - recherche.y) < 0.5 : false } : null,
        sections,
        familles,
        pastilles,
        garde,
        cyber: liCyber ? { section: 'surveillance', nom: texte(liCyber.querySelector('.sc-famille__nom')) } : null,
        sous,
        aujourdhui,
        enTete,
        ajmani,
        ambre,
        actives: aside.querySelectorAll('[aria-current="page"]').length,
      };
    },
    [V3, AMBRE_V3, TRIPLETS_FAMILLES],
  );
}

/**
 * Juge les mesures v3. `exigeant` (mode B, page statique) : la section
 * ÉPINGLÉS, la carte « Aujourd'hui », La Garde, « + N autres » et « N en
 * ligne » doivent être là — l'aperçu les porte. Dans l'application (mode A),
 * chacun peut manquer pour une raison de données (aucun épinglé, aucun module
 * de La Garde ouvert à l'organisation, personne d'autre en ligne, famille de
 * cinq modules ou moins) : on ne juge alors que ce qui est rendu.
 */
function jugerV3(nom, m, exigeant) {
  const f = [];
  const dire = (quoi, attendu, lu) => f.push(`${nom} · ${quoi} : attendu ${attendu}, lu ${lu}`);

  if (m.absente) {
    f.push(`${nom} · ${m.laterales} barre(s) latérale(s) v3 rendue(s) au lieu d'une (${m.colonnes} colonne(s) de navigation, ${m.ancienRail} ancien rail) — la coquille est-elle allumée ?`);
    return f;
  }

  /* Un seul <aside>, 252 px en border-box, padding 16 / 14 / 14 ; aucun rail d'avant, aucune colonne à la main. */
  if (m.laterales !== 1) dire('barres latérales v3 visibles', 1, m.laterales);
  if (m.colonnes > 0) f.push(`${nom} · ${m.colonnes} colonne(s) de navigation à côté de la barre v3 : une barre écrite à la main vit à côté du composant partagé.`);
  if (m.ancienRail > 0) f.push(`${nom} · l'ancien rail (${m.ancienRail}) est rendu en même temps que la barre v3.`);
  if (m.aside.l !== V3.largeur) dire('largeur de la barre', `${V3.largeur} px`, `${m.aside.l} px`);
  if (m.aside.boxSizing !== 'border-box') dire('box-sizing de la barre', 'border-box', m.aside.boxSizing);
  if (m.aside.padHaut !== V3.padding.haut || m.aside.padDroite !== V3.padding.cote || m.aside.padBas !== V3.padding.bas || m.aside.padGauche !== V3.padding.cote) {
    dire('padding de la barre', '16 / 14 / 14 / 14', `${m.aside.padHaut} / ${m.aside.padDroite} / ${m.aside.padBas} / ${m.aside.padGauche}`);
  }

  /* La ligne de recherche et le bouton carré collé à droite. */
  if (!m.recherche) f.push(`${nom} · pas de champ de recherche ⌘K dans la barre.`);
  else if (m.recherche.h !== V3.recherche) dire('hauteur du champ de recherche', `${V3.recherche} px`, `${m.recherche.h} px`);
  if (!m.tous) f.push(`${nom} · pas de bouton carré « Tous les modules » à côté de la recherche.`);
  else {
    if (m.tous.l !== V3.tous || m.tous.h !== V3.tous) dire('bouton « Tous les modules »', `${V3.tous} × ${V3.tous} px`, `${m.tous.l} × ${m.tous.h} px`);
    if (!m.tous.memeLigne) f.push(`${nom} · le bouton « Tous les modules » n'est pas sur la ligne de la recherche.`);
    if (Math.abs(m.tous.droite - m.tous.droiteContenu) > 0.5) dire('bouton « Tous les modules » collé à droite', `bord droit à ${m.tous.droiteContenu} px`, `${m.tous.droite} px`);
  }

  /* Les sections nommées. */
  const ids = m.sections.map((sct) => sct.id);
  for (const attendu of ['espace', 'surveillance']) if (!ids.includes(attendu)) f.push(`${nom} · la section « ${attendu.toUpperCase()} » manque.`);
  if (exigeant && !ids.includes('epingles')) f.push(`${nom} · la section « ÉPINGLÉS » manque (l'aperçu porte trois épinglés).`);
  if (ids.length > 0 && ids.join(',') !== ['espace', 'surveillance', 'epingles'].filter((i) => ids.includes(i)).join(',')) dire('ordre des sections', 'ESPACE, SURVEILLANCE, ÉPINGLÉS', ids.join(', '));
  for (const sct of m.sections) {
    const t = V3.sectionTitre;
    if (sct.taille !== t.taille || !sct.capitales || sct.hauteur !== t.hauteur || sct.encre !== t.encre || !(Math.abs(sct.interlettrage - t.interlettrage) <= 0.05)) {
      dire(
        `libellé de section « ${sct.titre} »`,
        `${t.taille} px, capitales, ${t.hauteur} px de haut, encre T4 ${t.encre}, interlettrage ${t.interlettrage} px (0,09 em)`,
        `${sct.taille} px, ${sct.capitales ? 'capitales' : 'sans capitales'}, ${sct.hauteur} px, encre ${sct.encre}, interlettrage ${sct.interlettrage} px`,
      );
    }
  }

  /* Les familles : 32 px, icône 15 px en T3, aucune pastille ; l'active : fond, graisse, encre, chevron, icône teintée. */
  if (m.familles.length === 0) f.push(`${nom} · aucune famille dans la barre.`);
  const actives = m.familles.filter((fa) => fa.active);
  for (const fa of m.familles) {
    if (fa.h !== V3.famille) dire(`famille « ${fa.nom} »`, `${V3.famille} px`, `${fa.h} px`);
    if (!fa.icone) f.push(`${nom} · famille « ${fa.nom} » sans icône de trait.`);
    else if (fa.icone.l !== V3.icone || fa.icone.h !== V3.icone) dire(`icône de « ${fa.nom} »`, `${V3.icone} × ${V3.icone} px`, `${fa.icone.l} × ${fa.icone.h} px`);
    if (fa.active) {
      if (fa.fond !== V3.fondActif) dire(`fond de la famille active « ${fa.nom} »`, '#19191b', fa.fond);
      if (String(fa.poids) !== '600') dire(`graisse de la famille active « ${fa.nom} »`, 600, fa.poids);
      if (fa.couleur !== V3.t1) dire(`encre de la famille active « ${fa.nom} »`, 'T1 #ededed', fa.couleur);
      const teinte = TEINTES_FAMILLES[fa.cle === 'cyber' ? 'garde' : fa.cle];
      if (teinte && fa.couleurIcone !== teinte) dire(`icône de la famille active « ${fa.nom} »`, `la teinte de la famille (${teinte})`, fa.couleurIcone);
      /* Le chevron : la famille active se déroule — sauf Cyber hors de ses écrans et La Garde, qui écrivent autre chose à droite. */
      if (!fa.chevron && fa.cle !== 'cyber' && fa.cle !== 'garde') f.push(`${nom} · la famille active « ${fa.nom} » n'a pas son chevron.`);
    } else if (fa.couleurIcone !== V3.iconeInactive) {
      dire(`icône de « ${fa.nom} » (inactive)`, 'T3 #a0a0a5 — la teinte de famille ne colore que l’icône de la famille active', fa.couleurIcone);
    }
  }
  if (actives.length !== 1 && !(actives.length === 0 && m.actives === 1)) dire('familles actives', '1 (ou 0 sur « Tous les modules »)', actives.length);
  if (m.pastilles.length > 0) f.push(`${nom} · ${m.pastilles.length} pastille(s) de couleur dans les listes (${m.pastilles.slice(0, 3).join(', ')}) : plus aucune pastille en v3.`);

  /* La Garde (« veille » + voyant) et Cyber (toujours là). */
  if (!m.garde) {
    if (exigeant) f.push(`${nom} · La Garde manque dans SURVEILLANCE.`);
  } else {
    if (!m.garde.veille) f.push(`${nom} · La Garde n'écrit pas « veille » à droite.`);
    if (!m.garde.voyant) f.push(`${nom} · La Garde n'a pas son voyant.`);
  }
  if (!m.cyber) f.push(`${nom} · Cyber manque dans SURVEILLANCE : Cyber est TOUJOURS visible (§1.10).`);

  /* La sous-liste de la famille ouverte. */
  if (m.sous) {
    if (m.sous.n > V3.sousLignes) dire(`lignes sous « ${m.sous.famille} »`, `au plus ${V3.sousLignes}`, m.sous.n);
    for (const h of m.sous.hauteurs) if (h !== V3.sousLigne) dire(`ligne de la sous-liste « ${m.sous.famille} »`, `${V3.sousLigne} px`, `${h} px`);
    if (!m.sous.courant) {
      if (actives.some((fa) => fa.cle === m.sous.famille)) f.push(`${nom} · la famille ouverte « ${m.sous.famille} » est active mais aucune de ses lignes n'est le module courant.`);
    } else {
      if (!m.sous.courant.visible) f.push(`${nom} · le module courant « ${m.sous.courant.texte} » n'est pas visible dans la barre.`);
      const r = m.sous.repere;
      if (!r || r.l !== V3.repere.l || r.h !== V3.repere.h) dire('repère du module courant', `${V3.repere.l} × ${V3.repere.h} px`, r ? `${r.l} × ${r.h} px` : 'absent');
      if (r && r.couleur !== V3.t1) dire('couleur du repère', 'blanc T1', r.couleur);
      if (r && (r.filetLargeur !== 1 || Math.abs(r.x - r.filet) > 0.5)) dire('repère posé sur le filet', `x = ${r.filet} px (filet de 1 px)`, `x = ${r.x} px (filet de ${r.filetLargeur} px)`);
    }
    if (m.sous.autres === null) {
      if (exigeant) f.push(`${nom} · pas de « + N autres » sous « ${m.sous.famille} ».`);
    } else if (!m.sous.autres.plus || !/^\+?\s?\d+\s\S/.test(m.sous.autres.texte)) {
      dire('« + N autres »', 'l’icône « + » puis « N autres »', `${m.sous.autres.plus ? 'icône' : 'sans icône'}, « ${m.sous.autres.texte} »`);
    }
  } else if (actives.length === 1 && actives[0].cle !== 'cyber') {
    f.push(`${nom} · la famille active « ${actives[0].nom} » n'est pas déroulée.`);
  }

  /* La carte « Aujourd'hui ». */
  if (!m.aujourdhui) {
    if (exigeant) f.push(`${nom} · la carte « Aujourd'hui » manque en bas de la barre.`);
  } else {
    const a = m.aujourdhui;
    if (!a.anneau || a.anneau.l !== V3.anneau || a.anneau.h !== V3.anneau) dire('anneau de la carte « Aujourd’hui »', `${V3.anneau} × ${V3.anneau} px`, a.anneau ? `${a.anneau.l} × ${a.anneau.h} px` : 'absent');
    if (!a.filet || a.filet.h !== 1) dire('filet de la carte « Aujourd’hui »', '1 px', a.filet ? `${a.filet.h} px` : 'absent');
    if (!a.rdv) f.push(`${nom} · la carte « Aujourd'hui » n'a pas sa ligne de rendez-vous.`);
    if (!a.presence) f.push(`${nom} · la carte « Aujourd'hui » ne dit rien de la présence.`);
    for (const lieu of a.lieux) if (/^#?\//.test(lieu)) f.push(`${nom} · la présence montre une adresse brute (« ${lieu} ») au lieu du libellé du module.`);
  }

  /* L'en-tête. */
  if (!m.enTete) f.push(`${nom} · pas d'en-tête de la coquille.`);
  else {
    const e = m.enTete;
    if (e.h !== V3.entete) dire('hauteur de l’en-tête', `${V3.entete} px`, `${e.h} px`);
    if (e.miettes.length === 0) f.push(`${nom} · le fil d'Ariane est vide.`);
    else if (!e.derniereCourante) f.push(`${nom} · la dernière miette du fil (« ${e.miettes[e.miettes.length - 1]} ») n'est pas marquée page courante.`);
    if (e.miettes.some((mi) => /^#?\//.test(mi))) f.push(`${nom} · une miette du fil est un segment d'adresse (${e.miettes.join(' / ')}).`);
    if (!e.presence) {
      if (exigeant) f.push(`${nom} · l'en-tête n'écrit pas « N en ligne ».`);
    } else if (!/\d/.test(e.presence)) dire('« N en ligne »', 'un nombre', `« ${e.presence} »`);
    if (!e.cloche) f.push(`${nom} · pas de cloche dans l'en-tête.`);
    else if (e.cloche.l !== V3.cloche || e.cloche.h !== V3.cloche) dire('cloche', `${V3.cloche} × ${V3.cloche} px`, `${e.cloche.l} × ${e.cloche.h} px`);
    if (!e.garde) f.push(`${nom} · pas de pastille de La Garde dans l'en-tête.`);
    else if (e.garde.etat !== 'inconnu' && !e.garde.onde) f.push(`${nom} · le point de la pastille de La Garde n'a pas l'onde du voyant vivant (§0.4).`);
  }

  /* La barre Ajmani. */
  if (!m.ajmani) f.push(`${nom} · pas de barre Ajmani.`);
  else {
    const b = m.ajmani;
    if (b.h !== V3.ajmani.h) dire('hauteur de la barre Ajmani', `${V3.ajmani.h} px`, `${b.h} px`);
    if (b.rayon !== `${V3.ajmani.rayon}px`) dire('rayon de la barre Ajmani', `${V3.ajmani.rayon}px`, b.rayon);
    if (!b.envoi) f.push(`${nom} · la barre Ajmani n'écrit pas « Entrée pour envoyer ».`);
    if (!b.kbd) f.push(`${nom} · la barre Ajmani n'a pas son raccourci ⌘J.`);
    if (b.ecart !== null && (b.ecart < 0 || b.ecart > 16)) dire('« Entrée pour envoyer » puis ⌘J, d’un bloc', 'le raccourci juste après le texte (0 à 16 px)', `${b.ecart} px`);
  }

  /* Aucun ambre ; une seule ligne active. */
  if (m.ambre.length > 0) f.push(`${nom} · ${m.ambre.length} nœud(s) ambre dans la colonne (${m.ambre.slice(0, 4).join(', ')}). Aucun ambre dans la barre v3.`);
  if (m.actives !== 1) dire('lignes actives (aria-current="page") dans la barre', 1, m.actives);

  return f;
}

/** Les écrans du second passage (mode A, coquille allumée) : la liste interne, sans les bureaux (ils gardent leur coquille propre). */
const ECRANS_V3 = ECRANS_INTERNE;

/* ══════════════════════════════════════════════════════════════════════ */

const fautesDeCode = verifierLesCodes();

if (!BUNDLE && !PAGE) {
  /* Sans bundle ni page, la moitié statique vaut quand même : elle est le seul
     contrôle que la CI peut faire tourner sans navigateur. */
  if (fautesDeCode.length > 0) {
    console.error('\nCodes de rail : incohérences trouvées.\n');
    for (const f of fautesDeCode) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log('\nCodes de rail : cohérents (deux lettres, aucun doublon dans une édition).');
  console.log(
    'Géométrie non mesurée — passez un bundle : AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-coquille.mjs <bundle> [port]\n' +
      'ou une page statique : node scripts/check-coquille.mjs --page /tmp/apercu/<x>/COQUILLE-H42/index.html',
  );
  process.exit(0);
}

/* ── Mode B : une page statique en file://, mesures v3, aucun réseau ── */
if (PAGE) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(PAGE)) {
    console.error(`--page n’accepte qu’un fichier local, pas une adresse (${PAGE}).`);
    process.exit(2);
  }
  const fichier = path.resolve(PAGE);
  if (!fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
    console.error(`page introuvable : ${fichier}`);
    process.exit(2);
  }
  const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox', '--font-render-hinting=none'] });
  const fautes = [...fautesDeCode];
  const refuses = [];
  try {
    /* 1440 × 900 : la fenêtre des maquettes, celle où l'aperçu se compare à son image. */
    const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
    /* Le gardien du réseau : rien ne sort de cette machine, rien n'entre. Seuls file:, data:, blob: et about: passent. */
    await contexte.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === 'file:' || url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol === 'about:') return route.continue();
      refuses.push(`${route.request().method()} ${url.origin}${url.pathname}`.slice(0, 120));
      return route.abort();
    });
    const page = await contexte.newPage();
    await page.goto(pathToFileURL(fichier).href);
    await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
    await page.waitForTimeout(600);
    const m = await mesurerV3(page);
    fautes.push(...jugerV3(path.basename(path.dirname(fichier)), m, true));
  } finally {
    await navigateur.close();
  }
  if (refuses.length > 0) {
    fautes.push(`la page a tenté ${refuses.length} requête(s) réseau, refusée(s) : ${[...new Set(refuses)].slice(0, 4).join(' ; ')} — un aperçu statique ne parle à personne.`);
  }
  if (fautes.length > 0) {
    console.error(`\nCoquille v3 (page statique) : ${fautes.length} mesure(s) fautive(s).\n`);
    for (const f of fautes) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(
    `\nCoquille v3 : OK — ${path.relative(process.cwd(), fichier)} : une barre de 252 px (16 / 14 / 14), recherche 34 + bouton carré 34, sections ESPACE / SURVEILLANCE / ÉPINGLÉS,\nfamilles de 32 px à icône de 15 sans pastille, La Garde « veille » + voyant, Cyber présent, sous-liste ≤ 5 × 27 px avec repère 2 × 13 sur le filet, « + N autres »,\ncarte « Aujourd'hui » (anneau 34), en-tête 60 (fil, « N en ligne », cloche 34, Garde avec onde), barre Ajmani 46 / rayon 14 (« Entrée pour envoyer » + ⌘J), aucun ambre, une seule ligne active. Réseau : rien de refusé.`,
  );
  process.exit(0);
}

/* ── Mode A : le bundle servi, connexion d'essai, un ou deux passages ── */
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
let mesuresV3 = 0;

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

  if (PASSAGES.includes('eteinte')) {
    /* ── Premier passage : la coquille d'avant (le drapeau absent), les sept mesures d'origine ── */
    await page.evaluate(() => window.localStorage.removeItem('amn.coquille'));
    for (const [nom, route] of INTERNE ? ECRANS_INTERNE : ECRANS) {
      await page.goto(APP + route, { waitUntil: 'networkidle' }).catch(() => undefined);
      await page.waitForTimeout(700);
      const m = await mesurer(page);
      mesures += 1;
      fautes.push(...juger(nom, m));
    }
    if (INTERNE) {
      for (const [nom, route, bureau] of ECRANS_BUREAUX) {
        const cible = await resoudre(page, route);
        await page.goto(APP + cible, { waitUntil: 'networkidle' }).catch(() => undefined);
        await page.waitForTimeout(900);
        const m = await mesurerBureau(page);
        mesures += 1;
        fautes.push(...jugerBureau(nom, bureau, m));
      }
    }
  }

  if (PASSAGES.includes('allumee')) {
    /*
      ── Second passage : la coquille v3 allumée (interne) ──
      Le drapeau `amn.coquille = 'noir'` (`src/refonte/coquille/drapeau.ts`) est
      posé AVANT la navigation, et l'événement `amn:coquille` auquel le drapeau
      s'abonne est levé aussitôt (l'événement `storage`, lui, n'atteint pas la
      fenêtre qui écrit) : `AppLayout` monte `CoquilleRefonte` à la place du
      rail sans attendre un autre re-rendu. La fenêtre passe à 1440 × 900, celle
      des maquettes v3.
    */
    await page.evaluate(() => {
      window.localStorage.setItem('amn.coquille', 'noir');
      window.dispatchEvent(new Event('amn:coquille'));
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [nom, route] of ECRANS_V3) {
      await page.goto(APP + route, { waitUntil: 'networkidle' }).catch(() => undefined);
      await page.waitForTimeout(900);
      const m = await mesurerV3(page);
      mesuresV3 += 1;
      fautes.push(...jugerV3(`${nom} (coquille v3)`, m, false));
    }
    await page.evaluate(() => {
      window.localStorage.removeItem('amn.coquille');
      window.dispatchEvent(new Event('amn:coquille'));
    });
  }
} finally {
  await navigateur.close();
  serveur.kill();
}

if (fautes.length > 0) {
  console.error(`\nCoquille : ${fautes.length} mesure(s) fautive(s) sur ${mesures + mesuresV3} écran(s).\n`);
  for (const f of fautes) console.error(`  ✗ ${f}`);
  console.error(
    '\nLa colonne est la seule pièce que les 94 modules ont en permanence sous les yeux :\nune erreur ici ne casse pas un écran, elle casse le produit d’un coup.\n',
  );
  process.exit(1);
}

console.log(
  (mesures > 0
    ? `\nCoquille : OK — ${mesures} écran(s), rail 52 px en border-box, panneau 184, tuiles 38 × 38,\nhauteur de famille 27n + 8, deux plaques, aucun ambre.`
    : '') +
    (mesures > 0 && INTERNE
      ? `\nBureaux : ${ECRANS_BUREAUX.length} écran(s) dans leur coquille — barre haute 48, pupitre 42 + horizon 22, console 200 + état 28,\nportes 58, dock 52 en pied, organigramme 42 + pouls 16, une entrée courante, ni ambre ni rouge dans les murs.`
      : '') +
    (mesuresV3 > 0
      ? `\nCoquille v3 (allumée) : OK — ${mesuresV3} écran(s), une barre de 252 px, familles de 32 à icône de 15 sans pastille, Cyber présent,\nsous-liste ≤ 5 × 27 px avec repère sur le filet, carte « Aujourd'hui », en-tête 60, barre Ajmani 46 / rayon 14, aucun ambre, une seule ligne active.`
      : ''),
);
