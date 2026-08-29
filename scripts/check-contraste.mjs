/**
 * Contrôle du CONTRASTE — le texte que personne ne peut lire.
 *
 * ## Le défaut qu'il a trouvé
 *
 * La palette est monochrome et volontairement sobre. Le troisième cran de
 * gris, `--color-text-muted`, valait `#616160` : mesuré au navigateur sur les
 * dix-neuf écrans du build client, il rendait un rapport de contraste de 2,89
 * à 3,19 selon la surface, là où WCAG AA en demande 4,5 pour du texte courant.
 *
 * Trois cent cinquante-cinq occurrences, sur tous les écrans. Et pas de la
 * décoration : « Aucun rendez-vous aujourd'hui », « Ce que l'article vous
 * coûte, à l'unité », « Commencez par la plus proche » — les états vides et les
 * phrases d'aide, c'est-à-dire exactement le texte dont quelqu'un qui découvre
 * l'application a le plus besoin.
 *
 * Relevé à `#808080`, le minimum qui passe partout (4,54 sur la surface la plus
 * claire), la mesure retombe de douze combinaisons fautives à zéro. La
 * hiérarchie tient toujours : 242 / 154 / 128.
 *
 * ## Ce qu'il ne juge pas
 *
 * Un premier relevé a signalé le bouton « Ajouter » d'une journée vide de
 * l'agenda, en `text-transparent` — rapport 1,0. C'est un choix, et un bon :
 * l'affordance ne réclame pas l'attention sept fois de suite sur une semaine
 * vide, elle porte un `aria-label` complet, et elle réapparaît au survol comme
 * au focus clavier.
 *
 * Un contrôle qui aurait « corrigé » ça aurait abîmé l'écran pour satisfaire
 * une règle. Les couleurs entièrement transparentes sont donc COMPTÉES ET
 * DITES, jamais fatales : elles s'affichent en fin de rapport pour qu'on
 * puisse les revoir, sans faire échouer la mesure.
 *
 * ## Mode d'emploi
 *
 *   1. npm run build:web            (ou build:web:business)
 *   2. npx serve -s dist -l 4180
 *   3. AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… npm run check:contraste
 *
 * Comme `check:largeur` et `check:mouvement`, il lui faut un navigateur, un
 * build servi et une session : il vit hors CI, et son mode d'emploi est ici.
 */

/*
  LES SIX COMBINAISONS CONNUES, ET POURQUOI ELLES ATTENDENT UNE DÉCISION
  ══════════════════════════════════════════════════════════════════════

  Relever `--color-text-muted` de `#616160` à `#808080` a fait passer l'édition
  CLIENTE de 355 occurrences fautives à zéro. L'édition interne en garde six,
  et elles ne se règlent pas en poussant le même curseur :

    · l'édition interne pose du texte sur DEUX fonds plus clairs que ceux de
      l'édition cliente — `--color-surface-hover` (#1c1c1c) et `--color-border`
      (#262626). Pour y passer AA, `muted` devrait monter à #8c8c8c… soit la
      valeur de `--color-warning` (#8f8f8c) à trois niveaux près. Les deux
      crans deviendraient indiscernables, et le sens avec ;
    · le badge de notification est du BLANC sur le rouge de signal
      (`#ff4230`), à 3,46. Le corriger demande d'assombrir le rouge — celui-là
      même qui est « le seul réservé au critique » — ou d'y poser du texte
      sombre. Les deux changent l'apparence du signal.

  Autrement dit : la rampe de gris est trop resserrée pour satisfaire AA à tous
  les crans, et c'est un arbitrage de PALETTE, pas une correction. Il est
  d'Aaron, pas de ce contrôle.

  Elles sont donc NOMMÉES, une par une, comme les dispenses de `check:ecrans` —
  ce qui les garde visibles, et laisse le contrôle attraper tout ce qui est
  NOUVEAU. Une liste automatique absoudrait le prochain oubli ; celle-ci non.
*/
const CONNUES = new Map([
  [
    'rgb(255, 255, 255) sur rgb(255, 66, 48) @10px/600',
    'badge de notification : blanc sur le rouge de signal (3,46). Assombrir le rouge ' +
      'ou y poser du texte sombre change l’apparence du seul signal réservé au critique.',
  ],
  [
    'rgb(128, 128, 128) sur rgb(38, 38, 38) @12px/400',
    'gris discret sur une bordure claire (3,83) — voir la note de rampe ci-dessus.',
  ],
  [
    'rgb(255, 66, 48) sur rgb(38, 38, 38) @12px/400',
    'rouge de signal sur une bordure claire (4,38) — à trois dixièmes du seuil.',
  ],
  [
    'rgb(128, 128, 128) sur rgb(28, 28, 28) @11px/400',
    'gris discret sur la surface survolée (4,32) — voir la note de rampe.',
  ],
  [
    'rgb(128, 128, 128) sur rgb(28, 28, 28) @10px/400',
    'gris discret sur la surface survolée (4,32) — voir la note de rampe.',
  ],
  [
    'rgb(128, 128, 128) sur rgb(28, 28, 28) @10px/600',
    'gris discret sur la surface survolée (4,32) — voir la note de rampe.',
  ],
]);

const APP = (process.env.AMN_E2E_URL ?? 'http://127.0.0.1:4180/').replace(/\/?$/, '/');
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';

if (!EMAIL || !MOT_DE_PASSE) {
  console.log('Contrôle du contraste : SAUTÉ — il faut une session pour atteindre les écrans.\n');
  console.log('  AMN_E2E_EMAIL et AMN_E2E_PASSWORD ne sont pas définis. Sans elles, ce');
  console.log('  contrôle ne verrait que l’écran de connexion, et passerait au vert en');
  console.log('  n’ayant rien mesuré — exactement ce qu’il est censé empêcher.');
  console.log('\n  Voir l’en-tête de scripts/check-contraste.mjs pour le mode d’emploi.');
  process.exit(0);
}

const { chromium } = await import('playwright-core');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
const page = await (await nav.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();

console.log(`Contrôle du contraste — ${APP}\n`);

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
const faibles = new Map();
const invisibles = new Map();
let mesures = 0;
let textesLus = 0;

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

  const releve = await page.evaluate(() => {
    const rgb = (s) => {
      const m = /rgba?\(([^)]+)\)/.exec(s ?? '');
      if (!m) return null;
      const p = m[1].split(',').map(parseFloat);
      return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
    };
    const lin = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    // Une couleur semi-transparente se lit SUR son fond : la composer avant de
    // mesurer, sinon on note une couleur que personne ne voit.
    const composer = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
    });
    // Le premier ancêtre VRAIMENT opaque : un fond à 8 % ne cache rien.
    const fond = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = rgb(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0.99) return c;
      }
      return { r: 10, g: 10, b: 10 };
    };

    const bas = [];
    const nuls = [];
    let lus = 0;
    for (const el of document.querySelectorAll('*')) {
      // Seul le texte porté par l'élément LUI-MÊME : sinon chaque conteneur
      // hérite du texte de ses enfants et serait jugé à leur place.
      const propre = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('')
        .trim();
      if (propre.length < 2) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.1) continue;
      const fg = rgb(cs.color);
      if (!fg) continue;
      lus += 1;

      const bg = fond(el);
      const cle = `${cs.color} sur rgb(${bg.r}, ${bg.g}, ${bg.b}) @${parseFloat(cs.fontSize)}px/${cs.fontWeight}`;
      const exemple = propre.replace(/\s+/g, ' ').slice(0, 40);

      if (fg.a < 0.01) {
        nuls.push({ cle, exemple, aria: el.getAttribute('aria-label') ?? '' });
        continue;
      }

      const c = composer(fg, bg);
      const L1 = lum(c);
      const L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const px = parseFloat(cs.fontSize);
      const grand = px >= 24 || (Number(cs.fontWeight) >= 700 && px >= 18.66);
      const seuil = grand ? 3 : 4.5;
      if (ratio < seuil) bas.push({ cle, exemple, ratio: +ratio.toFixed(2), seuil });
    }
    return { bas, nuls, lus };
  });

  textesLus += releve.lus;
  for (const x of releve.bas) {
    const e = faibles.get(x.cle) ?? { ...x, n: 0, exemples: new Set(), routes: new Set() };
    e.n += 1;
    e.exemples.add(x.exemple);
    e.routes.add(route);
    faibles.set(x.cle, e);
  }
  for (const x of releve.nuls) {
    const e = invisibles.get(x.cle) ?? { ...x, n: 0, routes: new Set() };
    e.n += 1;
    e.routes.add(route);
    invisibles.set(x.cle, e);
  }

  const nouvelles = await page.evaluate(() => [
    ...new Set([...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href'))),
  ]);
  for (const r of nouvelles) if (!vues.has(r)) aVisiter.push(r);
}

await nav.close();

/*
  LE TÉMOIN, comme dans `check-mouvement` : sans texte lu, il n'y a pas de
  bonne nouvelle, il y a une mesure vide. Une session fermée ou un rendu qui
  n'aboutit pas donneraient zéro faute et zéro texte.
*/
if (textesLus === 0) {
  console.error('ÉCHEC : aucun texte mesuré. Le contrôle n’a rien lu, il ne conclut pas.');
  process.exit(1);
}

if (invisibles.size > 0) {
  console.log('Couleurs entièrement transparentes — non fatales, mais dites :\n');
  for (const [cle, e] of invisibles) {
    console.log(`  · ${e.n}×  ${cle}`);
    console.log(`      « ${e.exemple} »${e.aria ? `  aria-label: « ${e.aria.slice(0, 60)} »` : '  SANS aria-label'}`);
    console.log(`      ${[...e.routes].slice(0, 4).join(' ')}`);
  }
  console.log('');
}

/*
  Les connues sont retirées du verdict, mais rappelées : une dispense qu'on ne
  relit jamais finit par couvrir autre chose que ce pour quoi elle a été écrite.
*/
const attendues = [...faibles.keys()].filter((c) => CONNUES.has(c));
for (const c of attendues) faibles.delete(c);

if (attendues.length > 0) {
  console.log(`${attendues.length} combinaison(s) connue(s), en attente d’un arbitrage de palette :\n`);
  for (const c of attendues) console.log(`  · ${c}\n      ${CONNUES.get(c)}`);
  console.log('');
}

/*
  Une dispense devenue inutile est retirée, pas gardée « au cas où » : sinon la
  liste ne dit plus ce qui est vraiment en attente.

  Mais elle ne se déduit PAS d'un seul relevé : les six connues vivent dans
  l'édition interne, et l'édition cliente ne les rencontre jamais. Dire « à
  retirer » après avoir mesuré la cliente enverrait supprimer des dispenses qui
  servent encore. Le message dit donc ce qu'il sait, et laisse conclure.
*/
const nonRencontrees = [...CONNUES.keys()].filter((c) => !attendues.includes(c));
if (nonRencontrees.length > 0 && faibles.size === 0) {
  console.log(`${nonRencontrees.length} dispense(s) non rencontrée(s) sur ce build :`);
  for (const c of nonRencontrees) console.log(`  · ${c}`);
  console.log('');
  console.log('  Si vous venez de mesurer l’édition INTERNE, elles sont réglées et peuvent');
  console.log('  quitter `CONNUES`. Sur l’édition cliente, leur absence est normale : ces');
  console.log('  combinaisons n’existent que dans les écrans de supervision.');
  console.log('');
}

if (faibles.size > 0) {
  const total = [...faibles.values()].reduce((n, e) => n + e.n, 0);
  console.error(`${faibles.size} combinaison(s) sous le seuil WCAG AA — ${total} occurrence(s) :\n`);
  for (const [cle, e] of [...faibles.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.error(`  ✗ ${e.n}×  ratio ${e.ratio} (seuil ${e.seuil})  ${cle}`);
    console.error(`      « ${[...e.exemples].slice(0, 2).join(' » « ')} »`);
    console.error(`      ${[...e.routes].slice(0, 5).join(' ')}`);
    console.error('');
  }
  console.error('Un texte sous 4,5:1 n’est pas « discret », il est illisible pour une partie');
  console.error('des gens qui l’ouvrent — et ici il porte les états vides et les phrases');
  console.error('d’aide, c’est-à-dire ce dont on a le plus besoin quand on découvre l’écran.');
  console.error('Les crans de gris vivent dans src/index.css ; voir l’en-tête de ce fichier.');
  process.exit(1);
}

console.log(
  `OK — ${mesures} écrans, ${textesLus} textes mesurés, aucun sous le seuil WCAG AA.`,
);
