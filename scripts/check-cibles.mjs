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
 * L'édition interne garde 51 occurrences sous le seuil, regroupées en huit
 * familles nommées ci-dessous. Elles vivent dans les écrans de supervision les
 * plus denses, où élargir demande d'écarter — donc de redessiner. C'est un
 * chantier, pas une ligne à changer, et il est nommé plutôt qu'oublié.
 *
 * L'édition CLIENTE, elle, n'en a aucune : c'est celle qu'on utilise au doigt.
 *
 *   1. npm run build:web            (ou build:web:business)
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
 * Les familles connues de l'édition interne, avec leur raison.
 *
 * La clé est la signature de classe telle que le navigateur la rend, tronquée :
 * c'est ce qui identifie un composant sans dépendre de son texte, qui change
 * avec les données.
 */
const CONNUES = new Map([
  ['flex items-center gap-1.5', 'liste de sites d’un dossier client : dix-sept puces adjacentes — élargir sans écarter les ferait se chevaucher.'],
  ['flex min-w-0 items-center gap-1.5 font-mono text-[', 'adresses des sites : une par ligne, dans un tableau serré.'],
  ['flex items-center gap-1.5 font-mono text-[11px] te', '« Ajouter une URL » : sept fois dans la même colonne étroite.'],
  ['flex items-center gap-1 font-mono text-[10px] uppe', 'liens d’action en ligne de la tour de contrôle.'],
  ['flex items-center gap-1.5 font-mono text-[10px] up', 'retour vers la tour depuis le générateur.'],
  ['flex items-center gap-1.5 text-xs text-text-muted ', 'liens secondaires de l’accueil interne (Notes, Décisions, Connaissances).'],
  ['block w-full truncate border-b border-transparent ', 'champs modifiables sur place d’un dossier client.'],
  ['text-[11px] font-medium text-text-muted transition', 'dépliants d’historique du bureau de supervision.'],
  ['flex w-full items-center gap-2 text-left text-[11p', 'dépliants d’historique du bureau de supervision.'],
  ['block min-w-0 hover:text-text-primary', 'bande du jour de l’accueil interne.'],
]);

if (!EMAIL || !MOT_DE_PASSE) {
  console.log('Contrôle des cibles : SAUTÉ — il faut une session pour atteindre les écrans.\n');
  console.log('  AMN_E2E_EMAIL et AMN_E2E_PASSWORD ne sont pas définis. Sans elles, ce');
  console.log('  contrôle ne verrait que l’écran de connexion, et passerait au vert en');
  console.log('  n’ayant rien mesuré — exactement ce qu’il est censé empêcher.');
  console.log('\n  Voir l’en-tête de scripts/check-cibles.mjs pour le mode d’emploi.');
  process.exit(0);
}

const { chromium } = await import('playwright-core');
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
    e.routes.add(route);
    e.textes.add(x.txt);
    e.min = Math.min(e.min, x.w, x.h);
    petites.set(x.cls, e);
  }

  const nouvelles = await page.evaluate(() => [
    ...new Set([...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href'))),
  ]);
  for (const r of nouvelles) if (!vues.has(r)) aVisiter.push(r);
}

await nav.close();

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
  `OK — ${mesures} écrans, ${cibles} cibles mesurées, aucune sous ${MINIMUM_PX} px hors familles nommées.`,
);
