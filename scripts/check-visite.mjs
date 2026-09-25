#!/usr/bin/env node
/**
 * LA VISITE GUIDÉE AVANCE D'UNE ÉTAPE PAR GESTE — jamais deux, jamais seule.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ## Le défaut que ce contrôle empêche de revenir
 *
 * Signalé le 25/09 : « en avançant, la visite saute parfois une étape : de 1
 * à 3, de 2 à 4. C'est irrégulier. » Mesuré le même jour, sur l'édition
 * interne, visite générale, un clic toutes les 3 s :
 *
 *     1@-19  2@98  ∅@106  3@2626   ← aucun geste entre 98 et 3305
 *     geste @3305 → 4@3351
 *
 * Un clic : le « 2 » s'affiche une image, s'efface, et 2,5 s plus tard la
 * visite passe SEULE à 3 ; le clic suivant mène à 4. Trois défauts dans
 * `src/guide/GuideOverlay.tsx` s'additionnaient :
 *
 *   1. une cible absente était sautée après 2,5 s d'horloge, que l'écran ait
 *      fini de se charger ou non. La cible de « Votre Accueil » n'existe pas
 *      tant que l'Accueil lit la Garde (`SiGardeLue` rend un bloc
 *      `aria-busy`) : l'étape passait ou non selon le temps de réponse du
 *      serveur — d'où l'irrégularité ;
 *   2. pendant une image, la carte montrait le NOUVEAU numéro à l'ANCIENNE
 *      place (un booléen « prêt » restait vrai d'une étape à l'autre) ;
 *   3. le compteur numérotait le parcours, étapes sautées comprises : un
 *      saut se LISAIT « 1 → 3 ».
 *
 * ## Ce que ce contrôle vérifie, dans un vrai navigateur, sur le bundle passé
 *
 *   A · UN GESTE = UNE ÉTAPE, pour chacun des gestes que la visite écoute —
 *       clic sur « Suivant », →, Entrée sur le bouton, clic à droite du
 *       voile — et pour deux → reçus dans la même image ;
 *   B · UNE CIBLE EN RETARD EST ATTENDUE : l'écran se charge encore
 *       (`aria-busy`, la page bouge) et la cible n'arrive qu'au bout de 4 s —
 *       plus que les 2,5 s de l'ancien délai. L'étape doit s'afficher, pas
 *       être sautée ;
 *   C · UNE CIBLE ABSENTE NE LAISSE PAS DE TROU : l'étape est sautée, le
 *       compteur passe au rang suivant et le total perd une unité ;
 *   D · (édition interne) LE CAS MESURÉ : la Garde répond en 5 s, et
 *       « Votre Accueil » s'affiche quand même.
 *
 * À chaque geste : le rang affiché avance d'exactement 1, et rien ne bouge
 * entre deux gestes.
 *
 *   AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-visite.mjs <dossier-du-bundle> [port]
 *
 * L'édition se lit dans le bundle (la visite interne a une étape
 * « supervision » de plus) : le même contrôle tourne sur les deux.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = process.argv[2];
const PORT = Number(process.argv[3] ?? 4199);
const APP = `http://127.0.0.1:${PORT}/`;
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';

if (!BUNDLE || !EMAIL || !MOT_DE_PASSE) {
  console.error('Usage : AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-visite.mjs <dossier-du-bundle> [port]');
  process.exit(2);
}

/* Les titres des étapes, lus dans le dictionnaire : le contrôle suit la visite par ce qu'elle DIT. */
const fr = fs.readFileSync(path.join(RACINE, 'src/i18n/fr.ts'), 'utf8');
const titre = (cle) => {
  const m = new RegExp(`'${cle.replace(/\./g, '\\.')}': '((?:[^'\\\\]|\\\\.)*)'`).exec(fr);
  if (!m) throw new Error(`clé ${cle} introuvable dans src/i18n/fr.ts`);
  return m[1].replace(/\\'/g, "'");
};
const T = {
  accueil: titre('guide.general.accueil.titre'),
  epingles: titre('guide.general.epingles.titre'),
  recherche: titre('guide.general.recherche.titre'),
  lien: titre('guide.general.lien.titre'),
  aide: titre('guide.general.aide.titre'),
  supervision: titre('guide.general.supervision.titre'),
  revoir: titre('guide.revoir'),
};

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const fautes = [];
let verifies = 0;

const serveur = spawn('node', [path.join(RACINE, 'scripts/servir-bundle.mjs'), BUNDLE, String(PORT)], { stdio: 'ignore' });
await attendre(2500);
const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });

/** Une page connectée, avec le journal horodaté de tout ce que le compteur affiche. */
async function session() {
  const ctx = await navigateur.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__carte = [];
    let dernier = null;
    const lire = () => {
      const o = document.querySelector('[data-guide-overlay]');
      const compteur = o && [...o.querySelectorAll('span')].map((s) => s.textContent.trim()).find((x) => /^Étape \d+ sur \d+$/.test(x));
      const v = compteur ? `${compteur} · ${o.querySelector('[role="dialog"] p')?.textContent.trim() ?? ''}` : null;
      if (v !== dernier) {
        dernier = v;
        window.__carte.push([performance.now(), v]);
      }
    };
    new MutationObserver(lire).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await page.goto(APP);
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(MOT_DE_PASSE);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 30 && (await page.locator('input[name="password"]').count()); i += 1) await attendre(500);
  if (await page.locator('input[name="password"]').count()) throw new Error('connexion refusée — vérifiez le compte d’essai et l’API pointée par le bundle');
  await attendre(2500);
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Escape');
    await attendre(150);
  }
  return page;
}

/** La carte affichée : { rang, total, titre } ou null. */
const carte = (page) =>
  page.evaluate(() => {
    const d = window.__carte.at(-1)?.[1];
    if (!d) return null;
    const m = /^Étape (\d+) sur (\d+) · (.*)$/.exec(d);
    return m ? { rang: Number(m[1]), total: Number(m[2]), titre: m[3] } : null;
  });
const journalDepuis = (page, t0) => page.evaluate((t) => window.__carte.filter(([at]) => at >= t).map(([at, v]) => [Math.round(at - t), v]), t0);
const maintenant = (page) => page.evaluate(() => performance.now());

async function lancerVisiteGenerale(page) {
  await page.goto(APP + '#/');
  await attendre(400);
  await page.locator('[data-guide="aide"]').first().click();
  await page.getByRole('menuitem', { name: T.revoir }).click();
  await page.waitForFunction(() => /^Étape 1 sur/.test(window.__carte.at(-1)?.[1] ?? ''), null, { timeout: 15_000 });
}

/** Avance d'un geste jusqu'à la carte qui porte ce titre (pour se placer avant un scénario). */
const titresVus = new Set();
async function allerJusqua(page, titreVoulu) {
  for (let i = 0; i < 12; i += 1) {
    const c = await carte(page);
    if (c) titresVus.add(c.titre);
    if (c?.titre === titreVoulu) return c;
    await page.keyboard.press('ArrowRight');
    const suite = await page
      .waitForFunction((r) => { const d = window.__carte.at(-1)?.[1]; return (d && !d.startsWith(`Étape ${r} `)) || !document.querySelector('[data-guide-overlay]') && performance.now() - (window.__carte.at(-1)?.[0] ?? 0) > 11_000; }, c?.rang ?? 0, { timeout: 15_000 })
      .then(() => true, () => false);
    if (!suite || !(await carte(page))) break;
    await attendre(250);
  }
  throw new Error(`la visite n'a jamais montré « ${titreVoulu} » (vues : ${[...titresVus].join(' · ')})`);
}

/**
 * Un geste, et ce qu'il a produit. On attend que la carte change, PUIS on
 * observe encore `reste` ms : c'est là qu'un saut « tout seul » se verrait.
 */
async function unGeste(page, nom, geste, { reste = 3500, delai = 15_000 } = {}) {
  const avant = await carte(page);
  const t0 = await maintenant(page);
  await geste();
  await page
    .waitForFunction(([r, t]) => window.__carte.some(([at, v]) => at >= t && v && !v.startsWith(`Étape ${r} sur`)), [avant.rang, t0], { timeout: delai })
    .catch(() => undefined);
  await attendre(reste);
  const j = await journalDepuis(page, t0);
  const vues = j.map(([, v]) => v).filter(Boolean).map((v) => /^Étape (\d+) sur (\d+) · (.*)$/.exec(v)).filter(Boolean);
  const rangs = vues.map((m) => Number(m[1]));
  const trace = j.map(([at, v]) => `${v ? v.replace(/^Étape (\d+) sur (\d+) · (.*)$/, '$1/$2 « $3 »') : '∅'}@${at}ms`).join('  ');
  verifies += 1;
  if (rangs.length === 0) {
    fautes.push(`${nom} : aucune carte après le geste (attendu : l'étape ${avant.rang + 1}). Journal : ${trace || '(vide)'}`);
    return { avant, apres: null, trace };
  }
  const distincts = [...new Set(rangs)];
  if (distincts.length !== 1 || distincts[0] !== avant.rang + 1) {
    fautes.push(`${nom} : depuis l'étape ${avant.rang}, un seul geste a montré ${distincts.join(' puis ')} (attendu : ${avant.rang + 1}, et rien d'autre). Journal : ${trace}`);
  }
  /* Une carte qui paraît puis s'efface — l'image « fantôme » d'avant le correctif — n'est pas une étape montrée. */
  const premiere = j.findIndex(([, v]) => v);
  if (premiere >= 0 && j.slice(premiere).some(([, v]) => !v)) {
    fautes.push(`${nom} : la carte s'est affichée puis effacée sans geste — une étape entrevue n'est pas une étape montrée. Journal : ${trace}`);
  }
  if (!(await carte(page))) {
    fautes.push(`${nom} : ${reste} ms après le changement, aucune carte n'est affichée (attendu : l'étape ${avant.rang + 1}). Journal : ${trace}`);
  }
  const m = vues.at(-1);
  return { avant, apres: { rang: Number(m[1]), total: Number(m[2]), titre: m[3] }, trace };
}

const edition = { interne: false };
try {
  /* ── A · un geste = une étape, pour chaque geste écouté ──────────────── */
  const page = await session();
  const GESTES = [
    ['clic sur « Suivant »', (p) => p.locator('[data-guide-overlay] [role="dialog"] button').last().click()],
    ['touche →', (p) => p.keyboard.press('ArrowRight')],
    ['Entrée sur « Suivant »', async (p) => { await p.locator('[data-guide-overlay] [role="dialog"] button').last().focus(); await p.keyboard.press('Enter'); }],
    ['clic à droite du voile', (p) => p.mouse.click(1390, 940)],
    [
      'deux → dans la même image',
      (p) => p.evaluate(() => {
        for (let i = 0; i < 2; i += 1) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      }),
    ],
  ];
  for (const [nom, geste] of GESTES) {
    await lancerVisiteGenerale(page);
    await unGeste(page, `A · ${nom}`, () => geste(page), { reste: 3200 });
    await page.keyboard.press('Escape');
    await attendre(300);
  }

  /* ── B · une cible en retard, pendant que l'écran se charge ──────────── */
  await lancerVisiteGenerale(page);
  await allerJusqua(page, T.accueil);
  await page.evaluate(() => {
    /* La cible suivante n'est « pas encore là », et l'écran le dit comme le font les vrais : un bloc aria-busy qui vit. */
    const style = document.createElement('style');
    style.id = '__retard';
    style.textContent = '[data-guide="epingles"]{display:none !important}';
    document.head.appendChild(style);
    const occupe = document.createElement('div');
    occupe.id = '__occupe';
    occupe.setAttribute('aria-busy', 'true');
    document.querySelector('main').appendChild(occupe);
    const tic = setInterval(() => { occupe.textContent = String(Date.now()); }, 150);
    const fin = () => { clearInterval(tic); style.remove(); occupe.remove(); };
    window.__finRetard = fin;
    setTimeout(fin, 4000);
  });
  const b = await unGeste(page, 'B · cible en retard (écran en chargement, 4 s)', () => page.keyboard.press('ArrowRight'), { reste: 3500, delai: 12_000 });
  if (b.apres && b.apres.titre !== T.epingles) {
    fautes.push(`B · la visite a sauté « ${T.epingles} », dont la cible arrivait après 4 s de chargement : elle a montré « ${b.apres.titre} ». Journal : ${b.trace}`);
  }
  await page.evaluate(() => window.__finRetard?.());
  await page.keyboard.press('Escape');
  await attendre(300);

  /* ── C · une cible absente : sautée, sans trou dans le compte ──────────── */
  await lancerVisiteGenerale(page);
  const avantC = await allerJusqua(page, T.recherche);
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = '__absent';
    style.textContent = '[data-guide="lien"]{display:none !important}';
    document.head.appendChild(style);
  });
  const t0c = await maintenant(page);
  const c = await unGeste(page, 'C · cible absente de l’écran', () => page.keyboard.press('ArrowRight'), { reste: 3500, delai: 12_000 });
  const tSautC = (await journalDepuis(page, t0c)).find(([, v]) => v && !v.startsWith(`Étape ${avantC.rang} sur`))?.[0];
  if (c.apres) {
    if (c.apres.titre !== T.aide) fautes.push(`C · après « ${T.recherche} », avec « ${T.lien} » absent, la carte attendue était « ${T.aide} » ; vu « ${c.apres.titre} ».`);
    if (c.apres.total !== avantC.total - 1) fautes.push(`C · une étape absente doit sortir du compte : total ${avantC.total} → ${c.apres.total} (attendu ${avantC.total - 1}).`);
    if (tSautC !== undefined && tSautC < 1400) fautes.push(`C · la carte a changé ${tSautC} ms après le geste, alors que la cible suivante est absente : l'étape doit être attendue un court instant (≥ 1,5 s) avant d'être sautée, sans rien montrer entre-temps.`);
  }
  await page.evaluate(() => document.getElementById('__absent')?.remove());
  await page.keyboard.press('Escape');
  await attendre(300);
  await page.context().close();
  /* L'édition se lit dans la visite elle-même : seule l'interne a l'étape « supervision ». */
  edition.interne = titresVus.has(T.supervision);

  /* ── D · édition interne : la Garde lente, le cas mesuré ─────────────── */
  if (edition.interne) {
    const p2 = await session();
    await p2.route('**/v1/garde/**', async (route) => {
      await attendre(5000);
      await route.continue().catch(() => undefined);
    });
    await p2.goto(APP + '#/tasks');
    await attendre(800);
    await p2.goto(APP + '#/');
    await attendre(200);
    await p2.locator('[data-guide="aide"]').first().click();
    await p2.getByRole('menuitem', { name: T.revoir }).click();
    await p2.waitForFunction(() => /^Étape 1 sur/.test(window.__carte.at(-1)?.[1] ?? ''), null, { timeout: 15_000 });
    const d = await unGeste(p2, 'D · Accueil dont la Garde répond en 5 s', () => p2.keyboard.press('ArrowRight'), { reste: 3500, delai: 15_000 });
    if (d.apres && d.apres.titre !== T.accueil) {
      fautes.push(`D · « ${T.accueil} » a été sautée pendant que l'Accueil lisait la Garde : la visite a montré « ${d.apres.titre} ». Journal : ${d.trace}`);
    }
    await p2.context().close();
  }
} catch (err) {
  fautes.push(`le contrôle n'a pas pu aller au bout : ${err?.message ?? err}`);
} finally {
  await navigateur.close();
  serveur.kill();
}

if (fautes.length > 0) {
  console.error(`\nVisite guidée : ${fautes.length} défaut(s) sur ${verifies} geste(s) observé(s).\n`);
  for (const f of fautes) console.error(`  ✗ ${f}\n`);
  console.error('Un geste, une étape — toujours. Voir l’en-tête de scripts/check-visite.mjs.\n');
  process.exit(1);
}
console.log(
  `\nVisite guidée : OK — ${verifies} geste(s), chacun a avancé d'exactement une étape ; une cible en retard est attendue, ` +
    `une cible absente sort du compte sans trou${edition.interne ? ', et « Votre Accueil » attend la Garde (édition interne)' : ''}.`,
);
