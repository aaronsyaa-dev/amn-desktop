/**
 * Contrôle des CIBLES TACTILES — ce qu'un doigt n'arrive pas à viser.
 *
 * ## La règle, et d'où elle vient
 *
 * WCAG 2.5.8 (AA) demande 24 × 24 px pour tout ce qui se clique. Ce n'est pas
 * une préférence de confort : sous ce seuil, on rate, on retape, et sur un
 * écran où deux cibles se touchent on déclenche la mauvaise.
 *
 * Le sujet n'est pas neuf ici — la barre de l'agenda avait déjà été
 * redimensionnée « pour un pouce » après une mesure. Ce contrôle généralise :
 * il parcourt l'application à 390 px et mesure TOUT ce qui se clique.
 *
 * Mesuré avant correctif sur l'édition cliente : quatre formes sous le seuil,
 * dont le lien d'action des ÉTATS VIDES — 15 px de haut, c'est-à-dire le
 * premier geste que fait quelqu'un dans un module qu'il découvre. Rater sa
 * première tentative sur une page qui ne propose qu'une seule chose laisse
 * croire que le bouton ne marche pas. Après : zéro.
 *
 * ## Le rembourrage négatif, et pourquoi il est la bonne réponse ici
 *
 * `-my-2 py-2` agrandit la zone tactile de seize pixels et rend au voisinage
 * exactement ce qu'il lui a pris : rien ne bouge à l'écran. C'est ce qui permet
 * de corriger une cible sans redessiner la mise en page — et c'est aussi
 * pourquoi il ne convient PAS partout : dans une liste dense, deux zones
 * agrandies finissent par se chevaucher, et on tape sur la ligne d'à côté.
 * Là, il faut écarter les lignes, ce qui est un choix de mise en page.
 *
 * ## Les dispenses
 *
 * L'édition interne garde des occurrences sous le seuil, regroupées en familles
 * nommées ci-dessous. Elles vivent dans les écrans de supervision les plus
 * denses, où élargir demande d'écarter — donc de redessiner. C'est un chantier,
 * pas une ligne à changer, et il est nommé plutôt qu'oublié.
 *
 * MAIS UNE DISPENSE SE MÉRITE, ELLE AUSSI. Le premier jet en comptait dix, sur
 * la seule impression que ces écrans étaient « denses ». En les mesurant une
 * par une — écart au voisin cliquable le plus proche, vertical et horizontal —
 * HUIT avaient largement la place : 156 px entre deux lignes du tableau des
 * sites, 179 px sous un dépliant du bureau de supervision, 40 px sous un lien
 * de la tour. Elles sont corrigées, pas dispensées.
 *
 * Il en reste deux, et celles-là sont mesurées aussi : dans le dossier client,
 * les puces de sites ont ZÉRO pixel d'écart horizontal, et les champs
 * modifiables zéro en vertical. Élargir la zone les ferait se chevaucher — on
 * ouvrirait le site d'à côté. Il faut écarter, donc redessiner.
 *
 * L'édition CLIENTE, elle, n'en a aucune : c'est celle qu'on utilise au doigt.
 *
 *   1. npm run build:web            (ou build:web:business)
 *   1bis. npm run seed:essai        — sinon les écrans sont VIDES, et ce
 *                                     contrôle ne mesure que des états vides
 *   2. npx serve -s dist -l 4180
 *   3. AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… npm run check:cibles
 */

const APP = (process.env.AMN_E2E_URL ?? 'http://127.0.0.1:4180/').replace(/\/?$/, '/');
const LARGEUR = Number(process.env.AMN_E2E_LARGEUR ?? 390);
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';

/** WCAG 2.5.8 (AA). Le seuil AAA est 44, hors de portée d'une barre d'outils dense. */
const MINIMUM_PX = 24;

/**
 * La taille à partir de laquelle une cible ne se rate plus, donc n'a pas
 * besoin d'être écartée de sa voisine. 44 px est la recommandation de
 * WCAG 2.5.5 (AAA) — ici on ne l'exige pas, on s'en sert comme frontière.
 */
const CIBLE_PLEINE_PX = 44;

/** Le dégagement qu'il faut à une cible plus petite que ça. */
const DEGAGEMENT_PX = 8;

/**
 * Les familles connues de l'édition interne, avec leur raison.
 *
 * La clé est la signature de classe telle que le navigateur la rend, tronquée :
 * c'est ce qui identifie un composant sans dépendre de son texte, qui change
 * avec les données.
 */
/*
  LA CARTE EST VIDE, ET C'EST LE BUT.

  Elle a porté deux familles, toutes deux renvoyées à « un choix de mise en
  page » qu'il fallait laisser à quelqu'un d'autre. Les deux étaient des
  renoncements trop rapides :

    · les puces de sites d'un dossier — « élargir la zone les ferait se
      chevaucher ». Vrai HORIZONTALEMENT, la pastille d'état est juste à côté.
      Mais la puce avait déjà son `py-1`, et grandir VERTICALEMENT ne coûtait
      rien à personne : `-my-1 py-1` reprend exactement ce remplissage, 16 px
      deviennent 24, et pas un pixel ne bouge à l'écran ;

    · les champs modifiables sur place — « empilés sans aucun écart vertical ».
      Vrai aussi, et un remplissage négatif aurait fait se chevaucher les zones
      du nom et de la société. Mais une hauteur MINIMALE grandit l'élément
      lui-même : elle ne mord sur personne et n'a besoin d'aucun écart.

  Les deux fois, la dispense décrivait correctement l'obstacle et concluait
  trop vite qu'il n'y avait pas de porte. C'est le même travers que les huit
  dispenses démontées plus tôt cette nuit, à ceci près qu'ici c'est moi qui les
  avais écrites.

  Une dispense se MÉRITE, et se relit.
*/
const CONNUES = new Map([]);

if (!EMAIL || !MOT_DE_PASSE) {
  console.log('Contrôle des cibles : SAUTÉ — il faut une session pour atteindre les écrans.\n');
  console.log('  AMN_E2E_EMAIL et AMN_E2E_PASSWORD ne sont pas définis. Sans elles, ce');
  console.log('  contrôle ne verrait que l’écran de connexion, et passerait au vert en');
  console.log('  n’ayant rien mesuré — exactement ce qu’il est censé empêcher.');
  console.log('\n  Voir l’en-tête de scripts/check-cibles.mjs pour le mode d’emploi.');
  process.exit(0);
}

const { chromium } = await import('playwright-core');
const { parcourirVuesDetail, parcourirBascules, exigerDesVuesDetail } = await import('./lib/vues-detail.mjs');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
const page = await (
  await nav.newContext({ viewport: { width: LARGEUR, height: 844 }, hasTouch: true, isMobile: true })
).newPage();

console.log(`Contrôle des cibles tactiles — ${APP} à ${LARGEUR} px (minimum ${MINIMUM_PX} px)\n`);

await page.goto(APP);
await attendre(2500);
await page.locator('input[name="email"]').fill(EMAIL);
await page.locator('input[name="password"]').fill(MOT_DE_PASSE);
await page.locator('button:has-text("Se connecter")').click();
for (let i = 0; i < 15 && (await page.content()).includes('name="password"'); i += 1) {
  await attendre(1000);
}
if ((await page.content()).includes('name="password"')) {
  console.error('ÉCHEC : la connexion n’a pas abouti. Rien n’a pu être mesuré.');
  await nav.close();
  process.exit(1);
}
await attendre(2000);

const aVisiter = await page.evaluate(() => [
  ...new Set([...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href'))),
]);
if (aVisiter.length === 0) {
  console.error('ÉCHEC : aucune route trouvée dans la navigation. Rien n’a pu être mesuré.');
  await nav.close();
  process.exit(1);
}

const vues = new Set();
const petites = new Map();
let mesures = 0;
let cibles = 0;
let detailsOuverts = 0;
let basculesVues = 0;
const collees = new Map();

while (aVisiter.length > 0) {
  const route = aVisiter.shift();
  if (vues.has(route)) continue;
  vues.add(route);

  await page.goto(APP + route).catch(() => undefined);
  await attendre(900);

  const dansLApp = await page.evaluate(
    () =>
      !document.body.textContent.includes('Error response') &&
      Boolean(document.querySelector('nav, main')),
  );
  if (!dansLApp) {
    console.error(`ÉCHEC : ${route} n’a pas ouvert l’application — mesure impossible.`);
    await nav.close();
    process.exit(1);
  }
  mesures += 1;

  const mesurer = async (ou) => {
    /*
      DEUX CIBLES VOISINES QUI SE TOUCHENT — LA SECONDE RÈGLE
      ═══════════════════════════════════════════════════════

      Voir `docs/PRINCIPE-CONFORT.md`. Atteindre les 24 px de WCAG 2.5.8 en
      COLLANT deux cibles ne rend pas le geste confortable : on vise juste, ou
      on déclenche la voisine. Le seuil est un plancher légal, pas un objectif.

      Mais un écart minimal appliqué bêtement serait pire que rien. Mesuré sur
      l'édition interne : 536 paires de cibles voisines à moins de 8 px, dont
      la quasi-totalité est parfaitement confortable — 337 liens de navigation
      hauts de 44 px, 92 onglets pleine hauteur, 22 lignes pleine largeur. On
      ne rate pas une ligne qui prend tout l'écran. Signaler ces 337-là, c'est
      obtenir un garde-fou qu'on apprend à ignorer.

      Ce qui compte est donc l'écart RAPPORTÉ À LA TAILLE, dans l'axe où l'on
      vise :

        une cible d'au moins 44 px dans cet axe → on ne peut pas la manquer,
        l'écart n'a pas d'importance ;
        en dessous → il lui faut 8 px de dégagement.

      Calibrée ainsi, la règle rendait quatre familles au premier passage — les
      actions d'un message (36 px à 2 px, dont une qui supprime), la navigation
      de période de l'agenda, les pastilles d'accent, les boutons de
      l'enregistreur vocal — et zéro une fois celles-ci corrigées. C'est le
      signe d'un seuil qui décrit quelque chose plutôt qu'un seuil choisi pour
      passer.

      Seulement entre ENFANTS DIRECTS d'un même conteneur : deux boutons de
      régions différentes qui se frôlent à l'écran ne se confondent pas, et les
      comparer donnait un bruit ingérable.
    */
    const serrees = await page.evaluate(
      ({ pleine, degagement }) => {
        const SEL = 'button,a[href],input:not([type=hidden]),select,textarea,[role=button]';
        const visible = (el) => {
          const b = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.1;
        };
        const out = [];
        for (const parent of document.querySelectorAll('*')) {
          const enfants = [...parent.children].filter((c) => c.matches(SEL) && visible(c));
          for (let i = 0; i < enfants.length - 1; i += 1) {
            const A = enfants[i].getBoundingClientRect();
            const B = enfants[i + 1].getBoundingClientRect();
            const dx = Math.max(0, Math.max(A.left - B.right, B.left - A.right));
            const dy = Math.max(0, Math.max(A.top - B.bottom, B.top - A.bottom));
            // L'axe où elles se suivent : celui qui porte l'écart.
            const cote = dx > 0 || (dy === 0 && A.top < B.bottom && B.top < A.bottom);
            const ecart = cote ? dx : dy;
            const petite = Math.min(cote ? A.width : A.height, cote ? B.width : B.height);
            if (petite >= pleine || ecart >= degagement) continue;
            out.push({
              ecart: Math.round(ecart),
              petite: Math.round(petite),
              cls: String(enfants[i].className || '').slice(0, 50),
              txt: (enfants[i].getAttribute('aria-label') || enfants[i].textContent || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 30),
            });
          }
        }
        return out;
      },
      { pleine: CIBLE_PLEINE_PX, degagement: DEGAGEMENT_PX },
    );
    for (const x of serrees) {
      const e = collees.get(x.cls) ?? { ...x, n: 0, routes: new Set() };
      e.n += 1;
      e.routes.add(ou);
      e.ecart = Math.min(e.ecart, x.ecart);
      collees.set(x.cls, e);
    }

    const releve = await page.evaluate((minimum) => {
      const out = [];
      let vus = 0;
      const cliquables =
      'button, a[href], input[type=checkbox], input[type=radio], [role=button], select, summary';
    for (const el of document.querySelectorAll(cliquables)) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.1) continue;
      vus += 1;
      const min = Math.min(b.width, b.height);
      if (min >= minimum) continue;
      out.push({
        w: Math.round(b.width),
        h: Math.round(b.height),
        tag: el.tagName.toLowerCase(),
        // Le texte accessible : c'est ce qui permet de retrouver la cible.
        txt: (el.getAttribute('aria-label') || el.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 34),
        cls: String(el.className || '').slice(0, 50),
      });
    }
      return { out, vus };
    }, MINIMUM_PX);

    cibles += releve.vus;
    for (const x of releve.out) {
      const e = petites.get(x.cls) ?? { ...x, n: 0, routes: new Set(), textes: new Set(), min: 999 };
      e.n += 1;
      e.routes.add(ou);
      e.textes.add(x.txt);
      e.min = Math.min(e.min, x.w, x.h);
      petites.set(x.cls, e);
    }
  };

  await mesurer(route);

  /*
    LES VUES DE DÉTAIL, ET PAS SEULEMENT LES LISTES.

    Ce contrôle ne visitait que des écrans de liste, et il était vert. Le
    bouton « Supprimer le document » (15 × 15 px, un geste irréversible) ne
    s'affiche qu'une fois un document OUVERT ; le « Fermer » de huit fenêtres
    mesurait 18 px ; « Retirer la ligne », dans l'éditeur de pages, 12 × 12.
    Rien de tout ça n'était atteignable depuis une liste.

    La boucle vit dans `scripts/lib/vues-detail.mjs` : quatre contrôles ont le
    même angle mort, et recopier le parcours dans chacun garantissait qu'ils
    divergeraient.
  */
  detailsOuverts += await parcourirVuesDetail(page, route, mesurer, attendre);

  /*
    Les bascules de vue (« Liste » / « Graphe »…) : ce que l'autre état de
    l'écran dessine n'avait jamais été mesuré, alors qu'on y passe des heures.
  */
  basculesVues += await parcourirBascules(page, route, mesurer, attendre);

  const nouvelles = await page.evaluate(() => [
    ...new Set([...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href'))),
  ]);
  for (const r of nouvelles) if (!vues.has(r)) aVisiter.push(r);
}

await nav.close();

exigerDesVuesDetail(detailsOuverts, 'check:cibles');

/* Le témoin : sans cible mesurée, il n'y a pas de bonne nouvelle. */
if (cibles === 0) {
  console.error('ÉCHEC : aucun élément cliquable mesuré. Le contrôle n’a rien vu, il ne conclut pas.');
  process.exit(1);
}

const dispensees = [...petites.keys()].filter((c) => CONNUES.has(c));
for (const c of dispensees) petites.delete(c);

if (dispensees.length > 0) {
  console.log(`${dispensees.length} famille(s) connue(s), chantier nommé :\n`);
  for (const c of dispensees) console.log(`  · ${CONNUES.get(c)}`);
  console.log('');
}

/*
  UNE DISPENSE QUI NE SERT PLUS DOIT PARTIR.

  Sans ce contrôle, une famille corrigée resterait inscrite ici pour toujours,
  et couvrirait en silence sa propre RÉAPPARITION : le jour où quelqu'un
  réécrit ces puces trop petites, la dispense les absoudrait sans que personne
  ne le voie. Une carte de dispenses non relue finit par être une carte de
  défauts tolérés.
*/
const inutiles = [...CONNUES.keys()].filter((c) => !dispensees.includes(c));
if (inutiles.length > 0) {
  console.error(`\n${inutiles.length} dispense(s) qui ne servent plus :\n`);
  for (const c of inutiles) console.error(`  · ${CONNUES.get(c)}\n    (sélecteur « ${c} »)`);
  console.error(
    '\nCes familles ne sont plus sous le seuil. Retirez-les de `CONNUES` : une\n' +
      'dispense qui traîne couvre la réapparition du défaut qu’elle décrivait.',
  );
  process.exit(1);
}

if (collees.size > 0) {
  const total = [...collees.values()].reduce((n, e) => n + e.n, 0);
  console.error(
    `\n${collees.size} famille(s) de cibles VOISINES trop serrées — ${total} occurrence(s) :\n`,
  );
  for (const e of [...collees.values()].sort((a, b) => b.n - a.n)) {
    console.error(`  ✗ ${e.n}×  cible ${e.petite} px, écart ${e.ecart} px  « ${e.txt} »`);
    console.error(`      [${e.cls}]  ${[...e.routes].slice(0, 4).join(' ')}\n`);
  }
  console.error(
    `Sous ${CIBLE_PLEINE_PX} px, une cible a besoin de ${DEGAGEMENT_PX} px de dégagement : atteindre\n` +
      `les ${MINIMUM_PX} px de WCAG en COLLANT deux cibles ne rend pas le geste confortable — on vise\n` +
      'juste, ou on déclenche la voisine. Écartez-les (`gap-2` sur le conteneur), ou\n' +
      `portez-les à ${CIBLE_PLEINE_PX} px. Voir docs/PRINCIPE-CONFORT.md.`,
  );
  process.exit(1);
}

if (petites.size > 0) {
  const total = [...petites.values()].reduce((n, e) => n + e.n, 0);
  console.error(`${petites.size} forme(s) sous ${MINIMUM_PX} px — ${total} occurrence(s) :\n`);
  for (const e of [...petites.values()].sort((a, b) => a.min - b.min)) {
    console.error(`  ✗ ${e.n}×  ${e.w}×${e.h}  <${e.tag}>  « ${[...e.textes][0]} »`);
    console.error(`      [${e.cls}]  ${[...e.routes].slice(0, 4).join(' ')}`);
    console.error('');
  }
  console.error(`WCAG 2.5.8 demande ${MINIMUM_PX} px : en dessous, on rate, on retape, et sur un écran`);
  console.error('dense on déclenche la cible d’à côté. Quand la mise en page le permet,');
  console.error('`-my-2 py-2` agrandit la zone de seize pixels sans rien déplacer. Dans une');
  console.error('liste serrée, il faut écarter les lignes — voir l’en-tête de ce fichier.');
  process.exit(1);
}

console.log(
  `OK — ${mesures} écrans + ${detailsOuverts} vue(s) de détail + ${basculesVues} bascule(s), ${cibles} cibles mesurées, ` +
    `aucune sous ${MINIMUM_PX} px, et aucune paire voisine trop serrée.`,
);
