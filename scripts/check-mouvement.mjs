/**
 * Contrôle du MOUVEMENT — l'application obéit-elle à « réduire les animations » ?
 *
 * ## Le défaut qu'il cherche
 *
 * `index.css` honore `prefers-reduced-motion` depuis longtemps, avec soin :
 * quatre blocs coupent le scintillement des squelettes, l'enfoncement des
 * boutons, la lévitation des cartes et le clignotement du point « en direct ».
 *
 * Mais quatre-vingt-dix composants animent avec framer-motion — chaque
 * transition d'écran, chaque apparition en cascade, chaque panneau qui se
 * déplie — et **framer-motion n'obéit à rien par défaut**. La moitié CSS était
 * faite avec attention ; la moitié JavaScript, c'est-à-dire l'essentiel de ce
 * qui bouge, ignorait purement le réglage.
 *
 * Mesuré avant correctif, sur le build client : un visiteur ayant coché
 * « réduire les animations » voyait quand même six déplacements par écran,
 * jusqu'à 5,6 px. Après : zéro.
 *
 * Ce n'est pas un défaut de confort. Quelqu'un qui coche cette case le fait en
 * général parce que le mouvement lui donne la nausée ou déclenche un vertige.
 *
 * ## Ce qu'il mesure, et pourquoi pas autre chose
 *
 * Pas les transformations PRÉSENTES : le logo en porte une, fixe, et elle n'a
 * jamais bougé de sa vie. Un premier jet les comptait et rendait le même
 * chiffre dans les deux modes — donc rien du tout.
 *
 * Il compte les transformations qui CHANGENT d'une image à l'autre, ce qui est
 * la définition d'un déplacement. Les fondus d'opacité ne comptent pas : ils
 * restent volontairement actifs, `reducedMotion="user"` ne coupant que la
 * position et l'échelle. Une interface sans aucune transition ne dirait plus
 * ce qui vient d'arriver à l'écran.
 *
 * ## Le témoin fait partie du contrôle
 *
 * Il exige AUSSI du mouvement quand la préférence n'est pas posée. Sans cette
 * seconde moitié, il passerait au vert sur une page blanche, une session
 * fermée ou une application qui n'anime plus rien — c'est exactement le piège
 * dans lequel `check-largeur` est tombé une fois, en annonçant « aucun
 * débordement » après n'avoir mesuré que des pages d'erreur.
 *
 * ## Mode d'emploi
 *
 *   1. npm run build:web            (ou build:web:business)
 *   2. npx serve -s dist -l 4180
 *   3. AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… npm run check:mouvement
 *
 * Variables : `AMN_E2E_URL` (défaut http://127.0.0.1:4180/),
 * `AMN_E2E_CHROMIUM` (défaut /opt/pw-browsers/chromium).
 */

const APP = (process.env.AMN_E2E_URL ?? 'http://127.0.0.1:4180/').replace(/\/?$/, '/');
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';

/** Un déplacement sous ce seuil est du bruit d'arrondi, pas une animation. */
const SEUIL_PX = 0.5;
/** Combien d'images on observe après l'ouverture d'un écran. */
const IMAGES = 120;

if (!EMAIL || !MOT_DE_PASSE) {
  console.log('Contrôle du mouvement : SAUTÉ — il faut une session pour atteindre les écrans.\n');
  console.log('  AMN_E2E_EMAIL et AMN_E2E_PASSWORD ne sont pas définis. Sans elles, ce');
  console.log('  contrôle ne verrait que l’écran de connexion, et passerait au vert en');
  console.log('  n’ayant rien mesuré — exactement ce qu’il est censé empêcher.');
  console.log('\n  Voir l’en-tête de scripts/check-mouvement.mjs pour le mode d’emploi.');
  process.exit(0);
}

const { chromium } = await import('playwright-core');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });

/** Les déplacements observés sur une poignée d'écrans, sous une préférence donnée. */
async function mesurer(preference) {
  const ctx = await nav.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: preference });
  const page = await ctx.newPage();

  await page.goto(APP);
  await attendre(2500);
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(MOT_DE_PASSE);
  await page.locator('button:has-text("Se connecter")').click();
  for (let i = 0; i < 15 && (await page.content()).includes('name="password"'); i += 1) {
    await attendre(1000);
  }
  if ((await page.content()).includes('name="password"')) {
    await ctx.close();
    throw new Error('la connexion n’a pas abouti');
  }
  await attendre(2000);

  const routes = await page.evaluate(() => [
    ...new Set([...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href'))),
  ]);
  if (routes.length === 0) {
    await ctx.close();
    throw new Error('aucune route trouvée dans la navigation');
  }

  const trouves = [];
  // Quelques écrans suffisent : ce qui est mesuré est un RÉGLAGE global, pas
  // une propriété par écran. En parcourir vingt coûterait vingt fois le temps
  // pour la même réponse.
  for (const route of routes.slice(0, 5)) {
    const p = await ctx.newPage();
    // On charge D'ABORD puis on observe : lancer l'observation avant la
    // navigation détruit son contexte d'exécution.
    await p.goto(APP + route, { waitUntil: 'commit' }).catch(() => undefined);
    const vu = await p
      .evaluate(
        async ({ seuil, images }) => {
          const lire = () => {
            const m = new Map();
            for (const el of document.querySelectorAll('*')) {
              const r = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform || '');
              if (!r) continue;
              const p = r[1].split(',').map(Number);
              m.set(el, [p[4] ?? 0, p[5] ?? 0]);
            }
            return m;
          };
          let n = 0;
          let amplitude = 0;
          let avant = lire();
          for (let k = 0; k < images; k += 1) {
            await new Promise((r) => requestAnimationFrame(r));
            const apres = lire();
            for (const [el, [x, y]] of apres) {
              const p = avant.get(el);
              if (!p) continue;
              const d = Math.max(Math.abs(x - p[0]), Math.abs(y - p[1]));
              if (d > seuil) {
                n += 1;
                amplitude = Math.max(amplitude, d);
              }
            }
            avant = apres;
          }
          return { n, amplitude };
        },
        { seuil: SEUIL_PX, images: IMAGES },
      )
      .catch(() => ({ n: 0, amplitude: 0 }));
    await p.close();
    if (vu.n > 0) trouves.push({ route, ...vu });
  }

  await ctx.close();
  return trouves;
}

console.log(`Contrôle du mouvement — ${APP}\n`);

const libre = await mesurer('no-preference');
const reduit = await mesurer('reduce');
await nav.close();

const totalLibre = libre.reduce((n, e) => n + e.n, 0);

if (totalLibre === 0) {
  console.error('ÉCHEC : aucun mouvement mesuré MÊME sans la préférence.');
  console.error('');
  console.error('Ce n’est pas une bonne nouvelle, c’est un contrôle aveugle : une page');
  console.error('blanche, une session fermée ou une application qui n’anime plus rien');
  console.error('donneraient exactement ce résultat. Le témoin fait partie du contrôle.');
  process.exit(1);
}

if (reduit.length > 0) {
  const total = reduit.reduce((n, e) => n + e.n, 0);
  console.error(`ÉCHEC : ${total} déplacement(s) malgré « réduire les animations ».\n`);
  for (const e of reduit) {
    console.error(`  ✗ ${e.route} — ${e.n} déplacements, jusqu’à ${e.amplitude.toFixed(1)} px`);
  }
  console.error('');
  console.error('framer-motion n’obéit pas au réglage du système par défaut. Le contexte');
  console.error('`<MotionConfig reducedMotion="user">` doit envelopper TOUT l’arbre — voir');
  console.error('src/renderer.tsx. Un sous-arbre laissé dehors continue de bouger, et');
  console.error('personne ne le remarque sans cocher la case et relire les vingt écrans.');
  process.exit(1);
}

console.log(
  `OK — ${totalLibre} déplacements quand le mouvement est permis, aucun quand il est réduit.`,
);
