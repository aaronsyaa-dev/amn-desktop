#!/usr/bin/env node
/**
 * Contrôle du FOCUS VISIBLE — sait-on où l'on est quand on tabule ?
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
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
const page = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

console.log(`Contrôle du focus visible — ${APP}\n`);

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

const routes = await page.evaluate(() => [
  ...new Set([...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href'))),
]);
if (routes.length === 0) {
  console.error('ÉCHEC : aucune route trouvée dans la navigation. Rien n’a pu être mesuré.');
  await nav.close();
  process.exit(1);
}

const muets = new Map();
let arrets = 0;

for (const route of routes) {
  await page.goto(APP + route).catch(() => undefined);
  await attendre(1100);
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

await nav.close();

/*
  Le témoin, comme dans les autres contrôles de cette famille : sans arrêt de
  focus mesuré, il n'y a pas de bonne nouvelle, il y a une mesure vide. Une
  session fermée ou un rendu qui n'aboutit pas donneraient zéro faute.
*/
if (arrets === 0) {
  console.error('ÉCHEC : aucun arrêt de focus mesuré. Le contrôle n’a rien vu, il ne conclut pas.');
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
  process.exit(1);
}

console.log(
  `OK — ${routes.length} écrans, ${arrets} arrêts de focus, tous visibles.`,
);
