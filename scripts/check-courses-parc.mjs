#!/usr/bin/env node
/**
 * LES LISTES PAGINÉES PAR CURSEUR NE MÉLANGENT JAMAIS DEUX QUESTIONS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ## La course trouvée le 25/09
 *
 * Repérée en marge du chantier de la visite guidée, dans le registre des
 * organisations (`useParcPage`, Bloc 4) et la file d'incidents du parc
 * (`ParcSocPanel`, Bloc 6), toutes deux paginées par curseur (cinquante à la
 * fois) : « changer un filtre pendant un chargement peut mélanger d'anciens
 * et de nouveaux résultats. » Deux défauts, dans les deux écrans à la fois,
 * puisqu'ils répétaient la même mécanique chacun de leur côté :
 *
 *   1. le curseur de l'ANCIENNE question restait en mémoire tant que le
 *      premier lot de la NOUVELLE n'était pas arrivé. « Charger plus » cliqué
 *      dans cette fenêtre repartait avec ce curseur, et sa réponse — si elle
 *      arrivait avant celle de la nouvelle question — s'ajoutait quand même
 *      aux lignes affichées, en plein changement de filtre ;
 *   2. deux clics rapides sur « Charger plus » (deux clics DOM synchrones,
 *      sans qu'un rendu ne s'intercale) passaient tous les deux le contrôle
 *      `!loading`, puisque le state React ne reflète le premier clic qu'au
 *      rendu suivant : la même page repartait deux fois.
 *
 * Corrigé une seule fois, dans `src/state/useCursorPage.ts`, dont les deux
 * écrans se servent : le curseur est remis à zéro et toute réponse en vol
 * devient périmée DANS LE MÊME RENDU que le changement de question
 * (`useLayoutEffect`, pas un effet ordinaire qui laisserait passer un clic
 * entre-temps), et le verrou du double clic vit dans une `ref` plutôt que
 * dans le state `loading`.
 *
 * ## Ce que ce contrôle vérifie
 *
 * D'abord, statiquement : que le registre des organisations et la file
 * d'incidents importent bien le MÊME `useCursorPage` — sinon un correctif
 * posé sur l'un ne protège pas l'autre, exactement le défaut d'origine.
 *
 * Ensuite, dans un vrai navigateur, sur CHACUNE des deux listes : le réseau
 * réel est remplacé par des réponses fabriquées et délibérément décalées
 * dans le temps (comme `check-visite.mjs` délaie `**​/v1/garde/**`), pour
 * rendre la course reproductible à coup sûr plutôt que dépendante du hasard
 * du réseau :
 *
 *   A · UNE RÉPONSE PÉRIMÉE NE DOIT JAMAIS S'AFFICHER. « Charger plus » est
 *       cliqué (sa réponse est délibérément lente à revenir), puis le filtre
 *       change aussitôt (sa réponse, plus lente encore, arrive en dernier).
 *       La ligne que la réponse périmée aurait ajoutée ne doit JAMAIS
 *       apparaître à l'écran, à aucun instant — ni transitoirement avant que
 *       la nouvelle question ne réponde, ni dans l'état final.
 *   B · DEUX CLICS SYNCHRONES NE CHARGENT LA MÊME PAGE QU'UNE FOIS. Deux
 *       `.click()` DOM dans le même appel, sans laisser React se re-rendre
 *       entre les deux — la seule façon de forcer la fenêtre où `loading`
 *       n'a pas encore changé pour la seconde lecture.
 *
 *   AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-courses-parc.mjs <bundle-interne> [port]
 *
 * Les deux écrans sont internes (Tour de contrôle) : ce contrôle ne tourne
 * que sur l'édition interne.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = process.argv[2];
const PORT = Number(process.argv[3] ?? 4211);
const APP = `http://127.0.0.1:${PORT}/`;
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';

if (!BUNDLE || !EMAIL || !MOT_DE_PASSE) {
  console.error('Usage : AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-courses-parc.mjs <bundle-interne> [port]');
  process.exit(2);
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const fautes = [];

/* ══════════════════════════════════════════════════════════════════════
   PREMIÈRE PARTIE — statique : les deux écrans partagent un seul utilitaire.
   ══════════════════════════════════════════════════════════════════════ */
{
  const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');
  const importeCursorPage = (src, depuis) => new RegExp(`from '${depuis.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(src);
  const parc = lire('src/state/useParcPage.ts');
  const soc = lire('src/components/tour/ParcSocPanel.tsx');
  if (!importeCursorPage(parc, './useCursorPage')) {
    fautes.push('src/state/useParcPage.ts ne semble plus importer useCursorPage : le registre des organisations a sa propre mécanique, séparée de la file d’incidents — exactement la divergence que ce contrôle existe pour empêcher.');
  }
  if (!importeCursorPage(soc, '../../state/useCursorPage')) {
    fautes.push('src/components/tour/ParcSocPanel.tsx ne semble plus importer useCursorPage : la file d’incidents a sa propre mécanique, séparée du registre des organisations.');
  }
  if (!fs.existsSync(path.join(RACINE, 'src/state/useCursorPage.ts'))) {
    fautes.push('src/state/useCursorPage.ts est introuvable : l’utilitaire partagé a disparu.');
  }
}

/* ══════════════════════════════════════════════════════════════════════
   SECONDE PARTIE — dans un vrai navigateur, réseau fabriqué.
   ══════════════════════════════════════════════════════════════════════ */
const serveur = spawn('node', [path.join(RACINE, 'scripts/servir-bundle.mjs'), BUNDLE, String(PORT)], { stdio: 'ignore' });
await attendre(2500);
const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });

async function session() {
  const page = await (await navigateur.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
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

/** Une réponse de page (organisations ou incidents), au format attendu. */
const pageOrganisations = (items, total, nextCursor) => ({ organizations: items, total, nextCursor });
const pageIncidents = (items, total, nextCursor) => ({ incidents: items, total, nextCursor });

const organisation = (id, nom) => ({
  id, name: nom, plan: 'business_standard', status: 'active', trade: null, language: 'fr', seats: null,
  createdAt: '2026-01-01T00:00:00.000Z', lastActivityAt: '2026-01-01T00:00:00.000Z', userCount: 1,
  tags: [], openIncidents: 0, locks: 0, hasLogo: false,
});
const incident = (id, nom) => ({
  id, siteId: `site-${id}`, siteName: 'site.exemple.test', actor: '203.0.113.4', actorKind: 'ip',
  status: 'new', severity: 'warning', kinds: ['sonde-muette'], alertCount: 1,
  lastSeenAt: '2026-01-01T00:00:00.000Z', orgId: `org-${id}`, orgName: nom, escalationLevel: 0,
});

/**
 * Fabrique le routeur réseau d'un scénario A (réponse périmée). `chemin` est
 * le fragment d'URL à intercepter ; `enveloppe` construit le corps attendu
 * (`pageOrganisations` ou `pageIncidents`) ; `champCurseur` / `champFiltre`
 * disent où lire le curseur et le paramètre qui change dans la question.
 */
function routeurPerime({ chemin, enveloppe, ligne, champFiltre, valeurFiltreB }) {
  return async (route) => {
    const u = new URL(route.request().url());
    const cursor = u.searchParams.get('cursor');
    const filtre = u.searchParams.get(champFiltre) ?? '';
    if (!cursor && filtre !== valeurFiltreB) {
      // Le premier lot de la question A (« Toutes »).
      const items = Array.from({ length: 50 }, (_, i) => ligne(`a${i}`, `SONDE-A-${i}`));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(enveloppe(items, 200, 'curs-a1')) });
      return;
    }
    if (cursor === 'curs-a1') {
      // « Charger plus » de la question A — DÉLIBÉRÉMENT RAPIDE : elle doit
      // revenir avant que la question B n'ait même fini son débond de 250 ms.
      await attendre(120);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(enveloppe([ligne('a-suite', 'SONDE-A-PERIMEE')], 200, null)) });
      return;
    }
    if (!cursor && filtre === valeurFiltreB) {
      // Le premier lot de la question B — DÉLIBÉRÉMENT LENTE : le temps de
      // vérifier que la ligne périmée de A n'est jamais apparue avant qu'elle
      // ne réponde, elle aussi.
      await attendre(900);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(enveloppe([ligne('b0', 'SONDE-B-PROPRE')], 1, null)) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(enveloppe([], 0, null)) });
  };
}

/** Le routeur du scénario B (double clic) : compte les appels par curseur. */
function routeurDoubleClic({ enveloppe, ligne }) {
  const appels = new Map();
  const handler = async (route) => {
    const u = new URL(route.request().url());
    const cursor = u.searchParams.get('cursor');
    if (!cursor) {
      const items = Array.from({ length: 50 }, (_, i) => ligne(`d${i}`, `SONDE-D-${i}`));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(enveloppe(items, 51, 'curs-d1')) });
      return;
    }
    const n = (appels.get(cursor) ?? 0) + 1;
    appels.set(cursor, n);
    await attendre(200);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(enveloppe([ligne(`d-suite-appel${n}`, `SONDE-D-SUITE-APPEL${n}`)], 51, null)) });
  };
  return { handler, appels };
}

/**
 * Un scénario complet sur une liste : A (réponse périmée) puis B (double
 * clic), avec une page FRAÎCHE pour chacun (un routeur par test, pas de
 * cache d'un scénario à l'autre).
 */
async function verifierListe({
  nom, chemin, route, enveloppe, ligne, boutonPlus, champFiltre, choisirFiltreB, valeurFiltreB, selecteurLigne,
}) {
  // ── A · une réponse périmée ne doit jamais s'afficher ──────────────────
  {
    const page = await session();
    await page.route(chemin, routeurPerime({ chemin, enveloppe, ligne, champFiltre, valeurFiltreB }));
    await page.goto(APP + '#' + route);
    await page.waitForSelector(selecteurLigne('SONDE-A-0'), { timeout: 10_000 });
    const plus = page.getByRole('button', { name: boutonPlus });
    if (!(await plus.count())) {
      fautes.push(`${nom} · A : le bouton « ${boutonPlus} » n’est pas apparu après le premier lot — le scénario n’a pas pu être posé.`);
    } else {
      await plus.click();
      await choisirFiltreB(page);
      await attendre(500); // après les 120 ms de la réponse périmée, bien avant les 900 ms de la réponse propre
      const perimeeVisible = await page.locator(selecteurLigne('SONDE-A-PERIMEE')).count();
      if (perimeeVisible > 0) {
        fautes.push(`${nom} · A : « SONDE-A-PERIMEE » (la réponse périmée de « Charger plus », de l’ancienne question) s’est affichée après le changement de filtre.`);
      }
      await attendre(700); // laisse la question B répondre (900 ms au total)
      const propreVisible = await page.locator(selecteurLigne('SONDE-B-PROPRE')).count();
      const perimeeVisibleFinal = await page.locator(selecteurLigne('SONDE-A-PERIMEE')).count();
      if (!propreVisible) fautes.push(`${nom} · A : la réponse propre de la nouvelle question (« SONDE-B-PROPRE ») n’est jamais arrivée à l’écran.`);
      if (perimeeVisibleFinal > 0) fautes.push(`${nom} · A : « SONDE-A-PERIMEE » est encore visible une fois la nouvelle question arrivée — l’état final reste mélangé.`);
    }
    await page.context().close();
  }

  // ── B · deux clics synchrones ne chargent la même page qu'une fois ─────
  {
    const page = await session();
    const { handler, appels } = routeurDoubleClic({ enveloppe, ligne });
    await page.route(chemin, handler);
    await page.goto(APP + '#' + route);
    await page.waitForSelector(selecteurLigne('SONDE-D-0'), { timeout: 10_000 });
    const plus = page.getByRole('button', { name: boutonPlus });
    if (!(await plus.count())) {
      fautes.push(`${nom} · B : le bouton « ${boutonPlus} » n’est pas apparu — le scénario n’a pas pu être posé.`);
    } else {
      // Deux `.click()` DOM dans le même appel : aucun rendu React ne s'intercale entre les deux.
      await plus.evaluate((el) => { el.click(); el.click(); });
      await attendre(900);
      const n = appels.get('curs-d1') ?? 0;
      if (n !== 1) {
        fautes.push(`${nom} · B : deux clics synchrones sur « ${boutonPlus} » ont déclenché ${n} requête(s) pour la même page (curseur curs-d1), attendu exactement 1.`);
      }
      const doublon = await page.locator(selecteurLigne('SONDE-D-SUITE-APPEL2')).count();
      if (doublon > 0) fautes.push(`${nom} · B : la ligne du second appel (« SONDE-D-SUITE-APPEL2 ») est affichée — la page a été chargée deux fois.`);
    }
    await page.context().close();
  }
}

try {
  await verifierListe({
    nom: 'Organisations',
    chemin: '**/v1/admin/organizations/page**',
    route: '/tour/organisations',
    enveloppe: pageOrganisations,
    ligne: organisation,
    boutonPlus: /Cinquante de plus/,
    champFiltre: 'status',
    choisirFiltreB: (page) => page.locator('select[aria-label="Statut"]').selectOption('active'),
    valeurFiltreB: 'active',
    selecteurLigne: (texte) => `li:has-text("${texte}")`,
  });
  await verifierListe({
    nom: 'File d’incidents',
    chemin: '**/v1/admin/incidents/queue**',
    route: '/supervision',
    enveloppe: pageIncidents,
    ligne: incident,
    boutonPlus: /Cinquante de plus/,
    champFiltre: 'severity',
    choisirFiltreB: (page) => page.locator('select[aria-label="Gravité"]').selectOption('critical'),
    valeurFiltreB: 'critical',
    selecteurLigne: (texte) => `section[aria-label="La file du parc"] li:has-text("${texte}")`,
  });
} catch (err) {
  fautes.push(`le contrôle n'a pas pu aller au bout : ${err?.message ?? err}`);
} finally {
  await navigateur.close();
  serveur.kill();
}

if (fautes.length > 0) {
  console.error(`\nCourses du parc : ${fautes.length} défaut(s).\n`);
  for (const f of fautes) console.error(`  ✗ ${f}\n`);
  console.error('Une réponse périmée ne s’affiche jamais, et un seul clic charge une seule page. Voir l’en-tête de scripts/check-courses-parc.mjs.\n');
  process.exit(1);
}
console.log('\nCourses du parc : OK — organisations et incidents partagent un seul utilitaire ; une réponse périmée après un changement de filtre ne s’affiche jamais, et deux clics synchrones ne chargent la même page qu’une fois.');
