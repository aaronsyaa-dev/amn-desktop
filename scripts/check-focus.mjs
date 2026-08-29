#!/usr/bin/env node
/**
 * Contrôle du FOCUS — où il se voit, et où il reste.
 *
 * Deux règles, mesurées dans un vrai navigateur en tabulant pour de bon.
 *
 * ## Ce qu'il mesure, et pourquoi ce n'est pas de la lecture de CSS
 *
 * `index.css` pose bien un anneau sur les boutons et les liens, et remplace
 * l'anneau natif des champs par une bordure et un halo. Mais **cent
 * cinquante-sept** éléments portent `outline-none` dans le JSX, dont
 * trente-cinq sans style de focus écrit à côté. Lire la feuille de style ne
 * dit pas si le compte y est : ça dépend du conteneur, de la cascade, et de
 * ce que Tailwind a réellement produit.
 *
 * Ce contrôle ne lit rien. Il **tabule** — quarante-cinq fois par écran — et à
 * chaque arrêt il compare l'apparence de l'élément AVEC et SANS le focus :
 * contour, ombre, bordure, fond, couleur, soulignement. Si aucune des six ne
 * bouge, la personne qui navigue au clavier ne sait pas où elle se trouve.
 *
 * Relevé à l'écriture : 534 arrêts sur l'édition cliente, 836 sur l'interne,
 * **tous visibles**. Ce contrôle est donc né vert — il n'a rien réparé, il
 * empêche une régression que personne ne verrait autrement, parce qu'on ne
 * tabule pas dans une application qu'on utilise à la souris.
 *
 * ## Pourquoi comparer plutôt que chercher un `outline`
 *
 * Un premier jet cherchait `outlineStyle !== 'none'` ou une `box-shadow`. Il
 * aurait signalé comme fautifs tous les champs dont le focus se marque par un
 * changement de bordure — un choix parfaitement valide, et celui du produit.
 * Comparer l'avant et l'après ne présume d'aucune technique.
 *
 * ## 2. La tabulation ne sort pas d'une fenêtre ouverte
 *
 * Mesuré avant correctif, fenêtre ouverte, trente tabulations : le focus en
 * sortait quinze à vingt-quatre fois selon l'écran, et se promenait dans la
 * navigation DERRIÈRE le voile — « Accueil », « Agenda », « Projets ». Des
 * liens qu'on ne voit pas, qu'on peut atteindre, et activer d'un appui sur
 * Entrée pendant qu'un formulaire est ouvert par-dessus.
 *
 * Le focus ENTRE bien dans les fenêtres (chaque calque place le curseur sur
 * son premier champ) — c'était déjà fait, et c'est ce qui permet au piège de
 * `lib/pileCalques.ts` de savoir quel conteneur retenir.
 *
 * ## Mode d'emploi
 *
 *   1. npm run build:web            (ou build:web:business)
 *   2. npx serve -s dist -l 4180
 *   3. AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… npm run check:focus
 *
 * Même famille que `check:largeur`, `check:mouvement`, `check:contraste` et
 * `check:cibles` : il lui faut un navigateur, un build servi et une session,
 * donc il vit hors CI.
 */

const APP = (process.env.AMN_E2E_URL ?? 'http://127.0.0.1:4180/').replace(/\/?$/, '/');
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';

/** Combien de tabulations par écran. Au-delà on reboucle dans la navigation. */
const TABULATIONS = 45;

if (!EMAIL || !MOT_DE_PASSE) {
  console.log('Contrôle du focus : SAUTÉ — il faut une session pour atteindre les écrans.\n');
  console.log('  AMN_E2E_EMAIL et AMN_E2E_PASSWORD ne sont pas définis. Sans elles, ce');
  console.log('  contrôle ne verrait que l’écran de connexion, et passerait au vert en');
  console.log('  n’ayant rien mesuré — exactement ce qu’il est censé empêcher.');
  console.log('\n  Voir l’en-tête de scripts/check-focus.mjs pour le mode d’emploi.');
  process.exit(0);
}

const { chromium } = await import('playwright-core');
const { parcourirEcrans } = await import('./lib/vues-detail.mjs');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
const page = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

console.log(`Contrôle du focus — visibilité et confinement — ${APP}\n`);

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

/*
  Les écrans sont découverts DE PROCHE EN PROCHE. Ce contrôle relevait les
  liens de la première page et s'arrêtait là — vingt-trois écrans, quand le
  contrôle des cibles en atteignait trente-trois dans la même application.
  Dix écrans, ceux qu'on n'atteint qu'en passant par un autre, n'avaient donc
  jamais vu passer le contrôle du focus.

  Le parcours n'a lieu QU'UNE FOIS : sa liste est gardée pour la seconde
  passe, celle des fenêtres. Redécouvrir doublerait le temps du contrôle pour
  retrouver exactement les mêmes routes.
*/
const routes = [];

const muets = new Map();
let arrets = 0;

/*
  LES TRANSITIONS SONT COUPÉES LE TEMPS DE LA MESURE.

  `.input-focus` anime sa bordure et son halo sur 150 ms. Lire les styles juste
  après un `blur()` rend alors une valeur INTERPOLÉE, encore proche de l'état
  focalisé — les deux lectures se ressemblent, et le contrôle conclut « aucune
  différence » sur un champ parfaitement correct.

  C'est ce qui expliquait deux échecs isolés, jamais reproduits en six
  exécutions ensuite. Un contrôle qui dépend du moment où il regarde n'est pas
  un contrôle : on mesure l'état STABLE, donc on retire l'animation.
*/
await page.addStyleTag({
  content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
});

/*
  ── ET « SAIT-ON OÙ L'ON EST » ? ────────────────────────────────────────────

  Voisin de la visibilité du focus, et mesuré ici parce que ce contrôle passe
  déjà sur chaque écran : le lien ACTIF de la barre latérale doit être visible.

  Trouvé le 29 août : en arrivant sur `#/notes` côté interne, il l'était à
  ZÉRO pour cent — entièrement défilé hors du cadre. La barre porte
  trente-trois entrées ; tout ce qui vit sous la ligne de flottaison laissait
  donc l'utilisateur sans repère sur l'écran même où il venait d'arriver.

  Le seuil est la MOITIÉ de la ligne. Une bande de quelques pixels au bord du
  cadre n'est pas un repère : on ne la lit pas, et on ne la reconnaît pas au
  passage suivant.
*/
const SEUIL_LIGNE_ACTIVE = 0.5;
const barrePerdue = [];
let reperesTrouves = 0;

for await (const route of parcourirEcrans(page, APP, attendre, 1100)) {
  routes.push(route);

  const repere = await page
    .evaluate(() => {
      /*
        On cherche `aria-current="page"` et pas le lien dont l'adresse
        correspond, pour une raison qui a coûté un aller-retour : cinq modules
        apparaissent DEUX fois dans la barre (une épingle, une ligne de
        section), et « le premier lien qui a la bonne adresse » désignait alors
        celui que l'application n'avait pas choisi de mettre en avant. Le
        contrôle réclamait la visibilité d'une ligne dont ce n'était pas le
        rôle — et deux lignes ne peuvent pas être visibles en même temps dans
        une liste qu'on fait défiler.

        `aria-current` est la déclaration de l'application : « voici la ligne
        courante ». C'est elle qu'on doit voir, et c'est aussi ce qu'un lecteur
        d'écran annonce. Une seule par page, par définition.
      */
      const lien = document.querySelector('nav a[aria-current="page"], aside a[aria-current="page"]');
      if (!lien) return null;
      const r = lien.getBoundingClientRect();
      if (r.height === 0) return null;
      let boite = lien.parentElement;
      while (boite) {
        const cs = getComputedStyle(boite);
        if (/auto|scroll/.test(cs.overflowY) && boite.scrollHeight > boite.clientHeight) break;
        boite = boite.parentElement;
      }
      // Pas de conteneur défilant : rien ne peut cacher la ligne.
      if (!boite) return { part: 1 };
      const c = boite.getBoundingClientRect();
      const vu = Math.max(0, Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top));
      return { part: vu / r.height };
    })
    .catch(() => null);

  if (repere) {
    reperesTrouves += 1;
    if (repere.part < SEUIL_LIGNE_ACTIVE) {
      barrePerdue.push({ route, part: Math.round(repere.part * 100) });
    }
  }

  // Une navigation par hash ne recharge pas, mais un `goto` complet si : on
  // repose la règle à chaque écran plutôt que de parier sur sa survie.
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
  await page.evaluate(() => document.body.focus());

  for (let i = 0; i < TABULATIONS; i += 1) {
    await page.keyboard.press('Tab');
    const vu = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      /*
        Les six façons dont un produit peut marquer le focus. On ne présume
        d'aucune : on regarde si l'une d'elles change.
      */
      const lire = () => {
        const cs = getComputedStyle(el);
        return [
          cs.outlineStyle,
          cs.outlineWidth,
          cs.outlineColor,
          cs.boxShadow,
          cs.borderColor,
          cs.backgroundColor,
          cs.color,
          cs.textDecorationLine,
        ].join('|');
      };
      const avec = lire();
      el.blur();
      /*
        UN ÉLÉMENT QUI DISPARAÎT AU BLUR NE SE JUGE PAS.

        Certains contrôles se referment quand ils perdent le focus — un menu,
        une saisie en place. Après `blur()` ils ne sont plus dans le document,
        `getComputedStyle` rend alors les mêmes valeurs vides des deux côtés,
        et le contrôle conclurait « aucune différence » sur un élément qu'il a
        lui-même fait disparaître.

        C'est la seule cause plausible d'un échec isolé observé une fois puis
        jamais reproduit en six exécutions. Plutôt que de relancer jusqu'au
        vert, on retire la cause.
      */
      if (!el.isConnected) return { ignore: true };
      const sans = lire();
      el.focus({ preventScroll: true });
      return {
        change: avec !== sans,
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 55),
        txt: (el.getAttribute('aria-label') || el.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 30),
      };
    });
    if (!vu) break;
    if (vu.ignore) continue;
    arrets += 1;
    if (vu.change) continue;
    const cle = `${vu.tag}|${vu.cls}`;
    const e = muets.get(cle) ?? { ...vu, n: 0, routes: new Set() };
    e.n += 1;
    e.routes.add(route);
    muets.set(cle, e);
  }
}

/*
  Le témoin, comme dans les autres contrôles de cette famille : sans arrêt de
  focus mesuré, il n'y a pas de bonne nouvelle, il y a une mesure vide. Une
  session fermée ou un rendu qui n'aboutit pas donneraient zéro faute.
*/
if (arrets === 0) {
  console.error('ÉCHEC : aucun arrêt de focus mesuré. Le contrôle n’a rien vu, il ne conclut pas.');
  await nav.close();
  process.exit(1);
}

if (muets.size > 0) {
  const total = [...muets.values()].reduce((n, e) => n + e.n, 0);
  console.error(`${muets.size} forme(s) sans indication de focus — ${total} arrêt(s) :\n`);
  for (const e of [...muets.values()].sort((a, b) => b.n - a.n)) {
    console.error(`  ✗ ${e.n}×  <${e.tag}>  « ${e.txt} »`);
    console.error(`      [${e.cls}]  ${[...e.routes].slice(0, 4).join(' ')}`);
    console.error('');
  }
  console.error('Le focus s’arrête là sans que rien ne le montre : au clavier, on ne sait');
  console.error('plus où l’on est. `index.css` pose déjà un anneau sur les boutons et les');
  console.error('liens, et `.input-focus` une bordure et un halo sur les champs — le plus');
  console.error('souvent il suffit d’ajouter cette classe.');
  await nav.close();
  process.exit(1);
}

/* ═══════ 2. La tabulation ne sort pas d'une fenêtre ouverte ═══════════════ */

/*
  On ne devine aucun libellé : on reprend les boutons de chaque écran, on
  clique, et si un calque s'ouvre on tabule trente fois en comptant les sorties.
  Les gestes destructeurs sont écartés par leur libellé — ce contrôle explore,
  il ne doit rien casser.
*/
const DANGEREUX = /supprim|retir|effac|déconnex|deconnex|révoqu|revoqu|vider|désactiv/i;

/**
 * Un calque qui BARRE LA PAGE est-il ouvert, où que soit le focus ?
 *
 * `pointer-events` fait toute la distinction, et elle est structurelle — pas
 * une liste de noms à tenir à jour :
 *
 *   · le mode « pointer un endroit de l'app » pose deux voiles en
 *     `pointer-events: none`. Les clics les TRAVERSENT, et c'est tout l'objet
 *     de ce mode : on clique dans la page pour y déposer un repère. Lui donner
 *     le focus casserait la fonction. Ce n'est pas une fenêtre, c'est une
 *     teinte ;
 *   · une vraie fenêtre intercepte les clics. Elle prend la main sur la page,
 *     donc elle doit prendre le focus avec.
 *
 * Un premier jet ne regardait que la position et la taille, et rangeait les
 * deux ensemble. Il aurait fallu nommer une dispense pour le mode de capture —
 * là où une propriété mesurable disait déjà la vérité.
 */
const calqueOuvert = () =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || Number(cs.zIndex) < 50) continue;
      if (cs.pointerEvents === 'none') continue; // une teinte, pas une fenêtre
      const r = el.getBoundingClientRect();
      if (r.width > 200 && r.height > 100 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5) {
        return true;
      }
    }
    return false;
  });

const dansUnCalque = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.position === 'fixed' && Number(cs.zIndex) >= 50) return true;
    }
    return false;
  });

/*
  REMETTRE L'ÉCRAN À NEUF — et pourquoi un `goto` ne suffisait pas.

  Après avoir ouvert une fenêtre, la boucle revenait à l'écran par
  `page.goto(APP + route)`. Sur une application à routage par HASH, aller à
  l'adresse où l'on est DÉJÀ ne recharge rien : la fenêtre restait ouverte, et
  tous les boutons cliqués ensuite sur le même écran étaient trouvés « dans un
  calque » — donc signalés en défaut.

  Mesuré : sur `#/tour`, une seule vraie fenêtre sans focus (« Lien d'appel »)
  en produisait CINQ, dont trois boutons de période et un dépliant. Un
  garde-fou qui invente quatre défauts sur cinq est un garde-fou qu'on
  apprendra à ignorer, et c'est pire que pas de garde-fou du tout.

  Échap d'abord — c'est le geste normal, et il vérifie au passage que la
  fenêtre se ferme. S'il reste quelque chose, on recharge pour de bon.
*/
const remettreALEcran = async (route) => {
  await page.keyboard.press('Escape').catch(() => undefined);
  await attendre(300);
  if (await calqueOuvert()) {
    await page.goto(APP + route).catch(() => undefined);
    await page.reload().catch(() => undefined);
    await attendre(1100);
  }
};

const fuites = [];
const sansFocus = [];
let fenetres = 0;

for (const route of routes) {
  await page.goto(APP + route).catch(() => undefined);
  await attendre(1100);

  const libelles = await page.evaluate(() =>
    [
      ...new Set(
        [...document.querySelectorAll('button')]
          .filter((b) => {
            const r = b.getBoundingClientRect();
            return r.width && r.height;
          })
          .map((b) => (b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim()),
      ),
    ].filter((t) => t.length > 1 && t.length < 40),
  );

  for (const libelle of libelles) {
    if (DANGEREUX.test(libelle)) continue;
    const bouton = page.locator(`button:text-is("${libelle.replace(/"/g, '\\"')}")`).first();
    if ((await bouton.count()) === 0) continue;
    await bouton.click({ timeout: 2500 }).catch(() => undefined);
    await attendre(700);
    if (!(await dansUnCalque())) {
      /*
        DEUX CAS QUE LE PREMIER JET CONFONDAIT.

        Il écartait ensemble « rien ne s'est ouvert » et « un calque s'est
        ouvert mais le focus n'y est pas entré », sous le même commentaire
        « rien à mesurer ». Le second n'est pas une absence de matière : c'est
        un DÉFAUT. Une fenêtre qui s'ouvre sans prendre le focus laisse la
        personne au clavier derrière le voile, à tabuler dans une page qu'elle
        ne voit plus, sans rien qui indique où elle se trouve.

        Et le piège de `pileCalques.ts` ne peut pas la rattraper : il ne
        retient le focus que lorsqu'il est déjà entré quelque part.
      */
      if (await calqueOuvert()) {
        sansFocus.push({ route, libelle });
      }
      await remettreALEcran(route);
      continue;
    }
    fenetres += 1;

    let sorties = 0;
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press('Tab');
      if (!(await dansUnCalque())) sorties += 1;
    }
    if (sorties > 0) fuites.push({ route, libelle, sorties });

    await remettreALEcran(route);
  }
}

await nav.close();

if (sansFocus.length > 0) {
  console.error(`\n${sansFocus.length} fenêtre(s) qui s'ouvrent SANS prendre le focus :\n`);
  for (const f of sansFocus) console.error(`  ✗ ${f.route} — « ${f.libelle} »`);
  console.error('');
  console.error('La personne au clavier reste derrière le voile : elle tabule dans une page');
  console.error('qu’elle ne voit plus, et rien ne lui dit où elle est. Le piège de');
  console.error('src/lib/pileCalques.ts ne peut pas la rattraper — il ne retient le focus');
  console.error('que lorsqu’il est déjà entré. À l’ouverture, placez le curseur sur le');
  console.error('premier champ, ou sur le conteneur (`tabIndex={-1}` puis `.focus()`).');
  process.exit(1);
}

if (fuites.length > 0) {
  console.error(`\n${fuites.length} fenêtre(s) d'où le focus s'échappe :\n`);
  for (const f of fuites) {
    console.error(`  ✗ ${f.route} — « ${f.libelle} » : ${f.sorties} sortie(s) sur 30 tabulations`);
  }
  console.error('');
  console.error('Le focus part derrière le voile, sur des liens qu’on ne voit pas et qu’on');
  console.error('peut activer d’un appui sur Entrée. Le piège vit dans lib/pileCalques.ts et');
  console.error('s’arme dès qu’un calque est inscrit : vérifiez que la fenêtre appelle bien');
  console.error('`useFermetureEchap`.');
  process.exit(1);
}

/*
  Le témoin de cette règle-ci : si plus aucune ligne ne porte `aria-current`,
  la boucle ci-dessus ne trouve rien et ne signale donc rien — un vert obtenu
  en ne regardant nulle part. Or l'absence d'`aria-current` EST le défaut le
  plus grave des deux : la barre ne dit plus du tout où l'on est, ni à l'œil
  ni à l'oreille.
*/
if (reperesTrouves < routes.length / 2) {
  console.error(
    `ÉCHEC : seulement ${reperesTrouves} écran(s) sur ${routes.length} ont une ligne de barre\n` +
      '  marquée `aria-current="page"`. La barre ne déclare plus l’écran courant — ni\n' +
      '  pour un lecteur d’écran, ni pour ce contrôle, qui ne peut alors rien mesurer.',
  );
  process.exit(1);
}

if (barrePerdue.length > 0) {
  console.error(
    `${barrePerdue.length} écran(s) où le lien actif de la barre est hors de vue :\n`,
  );
  for (const x of barrePerdue) console.error(`  ✗ ${x.route}  — visible à ${x.part} %`);
  console.error(
    '\nOn arrive sur l’écran et la barre ne dit pas où l’on est. Le correctif tient\n' +
      'en une ligne : `scrollIntoView({ block: \'nearest\' })` sur le lien actif quand\n' +
      'la route change — voir `src/components/Sidebar.tsx`. `nearest` et pas\n' +
      '`center` : une ligne déjà visible ne doit rien faire bouger.',
  );
  process.exit(1);
}

console.log(
  `OK — ${routes.length} écrans, ${arrets} arrêts de focus tous visibles, ` +
    `${fenetres} fenêtre(s) dont le focus ne sort pas, ` +
    'le lien actif de la barre visible partout.',
);
