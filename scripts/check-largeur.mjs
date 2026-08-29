/**
 * Contrôle de LARGEUR — ce qu'un téléphone rend illisible sans le dire.
 *
 * Deux défauts, opposés, et muets tous les deux :
 *
 *   - **ce qui DÉBORDE** — coupé par la coque, sans barre de défilement ;
 *   - **ce qui est ÉCRASÉ** — un paragraphe réduit à une colonne de dix
 *     caractères pour garder un bouton sur la même ligne.
 *
 * Le second a été trouvé APRÈS que le premier soit passé au vert : dix-neuf
 * écrans « aucun contenu coupé », et dans les réglages un texte de cent
 * quatre-vingts caractères rendu sur 88 px de large et 254 px de haut. Rien ne
 * dépassait — tout était comprimé. Voir la deuxième règle, plus bas.
 *
 * ## Le défaut qu'il cherche, et pourquoi rien d'autre ne le voit
 *
 * La coque de l'application porte `overflow-x-hidden`. C'est le bon réglage :
 * une page qui part en biais horizontalement est pire que du contenu coupé.
 * Mais la conséquence est qu'un élément trop large est **coupé en silence** —
 * pas de barre de défilement, pas d'erreur, rien qui laisse deviner qu'il
 * manque quelque chose.
 *
 * La cause est presque toujours la même : un enfant de grille ou de flex vaut
 * `min-width: auto` par défaut, donc il **refuse** de devenir plus étroit que
 * son contenu. Il élargit sa colonne, la colonne élargit la page, et la coque
 * coupe. `min-w-0` sur l'enfant règle le cas, et il n'existe aucune façon de
 * le voir en lisant du CSS.
 *
 * Deux occurrences réelles, trouvées le 29 août 2026 :
 *
 *   - le tableau du calculateur « Panier fournisseur », qui poussait bordures
 *     et fins de phrases hors de l'écran ;
 *   - le bureau de supervision (`/tour`), dont deux sections prenaient 621 px
 *     dans une colonne de 357 — un quart de l'écran invisible sur téléphone.
 *
 * ## Un contenu large n'est PAS un défaut
 *
 * Un tableau de neuf colonnes dans un `overflow-x-auto` est voulu : il défile
 * chez lui, sans emporter la page. Ce contrôle ignore donc tout ce qui vit
 * sous un ancêtre défilant, et ne signale que ce qui dépasse sans recours.
 *
 * ## Pourquoi il n'est pas dans la CI
 *
 * Il lui faut un vrai navigateur, un build servi, et une session ouverte —
 * c'est-à-dire un environnement complet, pas une lecture de fichiers. Il vit
 * donc à côté de `check:deployed` et de `check:mouvement`, qui ont la même
 * nature : on les lance quand on a l'environnement sous la main, et leur mode
 * d'emploi est en tête de chacun.
 *
 *   1. npm run build:web                      (ou build:web:business)
 *   2. npx serve -s dist -l 4180
 *   3. AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… npm run check:largeur
 *
 * Variables : `AMN_E2E_URL` (défaut http://127.0.0.1:4180/),
 * `AMN_E2E_LARGEUR` (défaut 390, la largeur d'un iPhone SE),
 * `AMN_E2E_CHROMIUM` (défaut /opt/pw-browsers/chromium).
 *
 * ## Ce contrôle a lui-même menti une fois
 *
 * Sa première version composait ses adresses avec `APP + route.slice(1)`, ce
 * qui donnait `http://…:4180//tour` — une 404 du serveur statique. Il a donc
 * annoncé « aucun débordement sur 31 écrans » en ne mesurant que des pages
 * d'erreur, qui ne débordent jamais. Il VÉRIFIE désormais qu'il est bien dans
 * l'application avant de mesurer, et refuse de conclure sinon.
 */

const APP = (process.env.AMN_E2E_URL ?? 'http://127.0.0.1:4180/').replace(/\/?$/, '/');
const LARGEUR = Number(process.env.AMN_E2E_LARGEUR ?? 390);
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';

/*
  LA DEUXIÈME RÈGLE : le texte écrasé.

  Un enfant de flex avec `flex-1 min-w-0` et sans base rétrécit jusqu'à zéro
  pour garder son voisin — un bouton, en général — sur la même ligne. Sur un
  écran large personne ne le voit ; sur un téléphone, le paragraphe devient un
  ruban vertical d'un mot par ligne, et le bouton, lui, reste confortable.

  C'est invisible à la première règle : rien ne déborde. C'est invisible à la
  lecture du CSS : `flex-wrap` est bien là, et l'auteur croit que la ligne se
  cassera. Elle ne se casse pas, parce que rien ne dit à quelle largeur.

  Les deux seuils sont mesurés, pas devinés. Le défaut d'origine faisait 88 px
  pour 173 caractères ; après correctif, l'application entière — dix-neuf
  écrans — ne contient plus AUCUN bloc de plus de 90 caractères sous 220 px de
  large. Le seuil est posé à 160 px, entre les deux, donc large des deux côtés.

  Seul le texte porté par l'élément LUI-MÊME est compté : un conteneur hérite
  sinon du texte de tous ses enfants et serait signalé à leur place.
*/
const ETROIT_PX = 160;
const ETROIT_CARACTERES = 90;
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';

if (!EMAIL || !MOT_DE_PASSE) {
  console.log('Contrôle de largeur : SAUTÉ — il faut une session pour atteindre les écrans.\n');
  console.log('  AMN_E2E_EMAIL et AMN_E2E_PASSWORD ne sont pas définis. Sans elles, ce');
  console.log('  contrôle ne verrait que l’écran de connexion, et passerait au vert en');
  console.log('  n’ayant rien mesuré — exactement ce qu’il est censé empêcher.');
  console.log('\n  Voir l’en-tête de scripts/check-largeur.mjs pour le mode d’emploi.');
  process.exit(0);
}

const { chromium } = await import('playwright-core');
const { parcourirVuesDetail, exigerDesVuesDetail } = await import('./lib/vues-detail.mjs');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
const page = await (await nav.newContext({ viewport: { width: LARGEUR, height: 900 } })).newPage();

console.log(`Contrôle de largeur — ${APP} à ${LARGEUR} px\n`);

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

exigerDesVuesDetail(detailsOuverts, 'check:largeur');
  process.exit(1);
}
await attendre(2000);

/*
  ON PARCOURT, on ne prend pas une photo.

  Les routes viennent de la navigation elle-même — une liste recopiée ici
  oublierait le prochain écran ajouté, et c'est précisément celui-là qu'il
  faudrait mesurer. Mais un seul relevé depuis l'accueil ne voit que l'espace
  COURANT : la Tour de contrôle a sa propre barre, qui n'apparaît qu'une fois
  qu'on y est.

  C'est exactement ce qui a fait passer ce contrôle au vert sur un écran
  cassé : vingt-trois routes mesurées, et `/tour` — le seul qui débordait —
  absent de la liste. On récolte donc les liens à CHAQUE page visitée, et on
  continue tant que la file n'est pas vide.
*/
const aVisiter = await page.evaluate(() => [
  ...new Set([...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href'))),
]);
if (aVisiter.length === 0) {
  console.error('ÉCHEC : aucune route trouvée dans la navigation. Rien n’a pu être mesuré.');
  await nav.close();
  process.exit(1);
}

const vues = new Set();
const coupables = [];
const ecrases = [];
let mesures = 0;
let detailsOuverts = 0;

while (aVisiter.length > 0) {
  const route = aVisiter.shift();
  if (vues.has(route)) continue;
  vues.add(route);

  await page.goto(APP + route).catch(() => undefined);
  await attendre(1100);

  const dansLApp = await page.evaluate(
    () => !document.body.textContent.includes('Error response') && Boolean(document.querySelector('nav, main')),
  );
  if (!dansLApp) {
    console.error(`ÉCHEC : ${route} n’a pas ouvert l’application — mesure impossible.`);
    await nav.close();
    process.exit(1);
  }
  mesures += 1;

  const mesurer = async (ou) => {
  const pire = await page.evaluate(() => {
    const vp = window.innerWidth;
    const defilable = (el) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
      return false;
    };
    let trouve = null;
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width <= vp + 1) continue;
      if (defilable(el)) continue;
      if (!trouve || r.width > trouve.w) {
        trouve = {
          w: Math.round(r.width),
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || '').slice(0, 100),
          txt: (el.textContent || '').replace(/\s+/g, ' ').slice(0, 60),
        };
      }
    }
    return trouve;
  });

  if (pire) coupables.push({ route: ou, pire });

  const comprimes = await page.evaluate(
    ({ largeurMax, minCaracteres }) => {
      const out = [];
      for (const el of document.querySelectorAll('p,li,span,div,td,h1,h2,h3,h4,label,a,button')) {
        const propre = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent)
          .join('')
          .replace(/\s+/g, ' ')
          .trim();
        if (propre.length < minCaracteres) continue;
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.width >= largeurMax) continue;
        out.push({
          w: Math.round(b.width),
          h: Math.round(b.height),
          n: propre.length,
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || '').slice(0, 100),
          txt: propre.slice(0, 60),
        });
      }
      return out.sort((a, b) => a.w - b.w)[0] ?? null;
    },
    { largeurMax: ETROIT_PX, minCaracteres: ETROIT_CARACTERES },
  );
  if (comprimes) ecrases.push({ route: ou, pire: comprimes });
  };

  await mesurer(route);

  /*
    LES VUES DE DÉTAIL, ET PAS SEULEMENT LES LISTES.

    C'est là que vivent les tableaux — l'éditeur de pages en compose, les
    factures en affichent — et un tableau est ce qui déborde le plus
    naturellement sur un écran de 390 px. Ce contrôle ne les avait jamais vus.
  */
  detailsOuverts += await parcourirVuesDetail(page, route, mesurer, attendre);

  // Les liens de CET écran rejoignent la file : c'est ainsi qu'on atteint la
  // Tour de contrôle, le contexte client, et tout ce qui n'est pas dans la
  // barre de l'accueil.
  const nouvelles = await page.evaluate(() => [
    ...new Set([...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href'))),
  ]);
  for (const r of nouvelles) if (!vues.has(r)) aVisiter.push(r);
}

await nav.close();

if (ecrases.length > 0) {
  console.error(`${ecrases.length} écran(s) au texte écrasé sur ${mesures} mesuré(s) :\n`);
  for (const c of ecrases) {
    console.error(`  ✗ ${c.route} — ${c.pire.n} caractères dans ${c.pire.w} px de large (${c.pire.h} px de haut)`);
    console.error(`      <${c.pire.tag}> ${c.pire.cls}`);
    console.error(`      « ${c.pire.txt} »`);
    console.error('');
  }
  console.error('Rien ne déborde ici : le texte est COMPRIMÉ pour garder son voisin sur la');
  console.error('même ligne. La cause est presque toujours un `flex-1 min-w-0` sans base :');
  console.error('ajoutez `basis-64` (ou une base adaptée) pour que la ligne se casse et que');
  console.error('le voisin passe dessous. Voir l’en-tête de ce fichier.');
}

if (coupables.length > 0) {
  console.error(`${coupables.length} écran(s) coupé(s) sur ${mesures} mesuré(s) :\n`);
  for (const c of coupables) {
    console.error(`  ✗ ${c.route} — ${c.pire.w} px dans ${LARGEUR} px`);
    console.error(`      <${c.pire.tag}> ${c.pire.cls}`);
    console.error(`      « ${c.pire.txt} »`);
    console.error('');
  }
  console.error('La coque porte `overflow-x-hidden` : ce dépassement est COUPÉ en silence,');
  console.error('sans barre de défilement pour le laisser deviner. La cause est presque');
  console.error('toujours un enfant de grille ou de flex sans `min-w-0` — il refuse de');
  console.error('devenir plus étroit que son contenu. Voir l’en-tête de ce fichier.');
}

if (coupables.length > 0 || ecrases.length > 0) process.exit(1);

console.log(
  `OK — ${mesures} écrans + ${detailsOuverts} vue(s) de détail à ${LARGEUR} px : ` +
    'rien de coupé sans recours, rien d’écrasé.',
);
