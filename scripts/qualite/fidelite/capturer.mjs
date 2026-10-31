#!/usr/bin/env node
/**
 * CAPTURER UN ÉCRAN À 1440 × 900 — sans serveur, sans réseau, sans donnée réelle.
 *
 * Fait la capture que `comparer.mjs` compare à l'image de la maquette. Chromium
 * sans tête (celui de Playwright, `/opt/pw-browsers/chromium` ou
 * `AMN_E2E_CHROMIUM`), fenêtre 1440 × 900, échelle 1, français, fuseau de Paris,
 * thème sombre, mouvement réduit.
 *
 * ## Les trois façons de présenter l'écran
 *
 *   --page <fichier.html>      une page statique ouverte en file:// (aucun serveur,
 *                              aucun réseau) : maquette de travail, aperçu d'un module ;
 *   --dist <dossier>           un build de l'app (`build:web`, interne), servi depuis le
 *                              disque par interception — AUCUN serveur n'écoute ;
 *                              avec --route '#/tasks' pour l'écran voulu ;
 *   --page http://127.0.0.1:…  une page déjà servie sur cette machine (jamais ailleurs).
 *
 * ## Ce que ce script s'interdit
 *
 *   - tout hôte hors de cette machine : les requêtes vers un autre hôte sont REFUSÉES et
 *     comptées dans le compte rendu (un build qui viserait la production ne l'atteint pas) ;
 *   - un compte qui n'est pas en `@exemple.test` : la connexion (build) exige
 *     AMN_E2E_EMAIL et AMN_E2E_PASSWORD, comme les gardes navigateur, et refuse le reste ;
 *   - le service worker (il parlerait au réseau dans le dos de l'interception).
 * La connexion d'un build vise une amn-api d'essai en mémoire sur 127.0.0.1 (voir
 * docs/refonte/CONTROLE-FIDELITE.md), avec des données factices : jamais de données réelles.
 *
 *   node scripts/qualite/fidelite/capturer.mjs --page <fichier.html> --sortie <capture.png>
 *   AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/qualite/fidelite/capturer.mjs \
 *       --dist <dossier> --route '#/tasks' --api http://127.0.0.1:4171 --sortie <capture.png>
 *
 * Options : --attendre <sélecteur CSS> (attend qu'il soit visible), --pause <ms> (après le
 * rendu, défaut 800), --date <ISO> (fige l'horloge de la page), --theme sombre|clair.
 * Écrit aussi <capture>.txt : le texte visible de la page, pour `comparer.mjs --textes`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(ICI, '..', '..', '..', 'package.json'));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json' };
const ORIGINE_VIRTUELLE = 'https://amn.local';
const LOCAL = new Set(['127.0.0.1', 'localhost', '[::1]']);

function lireOptions(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`argument inattendu : ${a}`);
    const nom = a.slice(2);
    if (!['page', 'dist', 'route', 'api', 'sortie', 'attendre', 'pause', 'date', 'theme'].includes(nom)) throw new Error(`option inconnue : --${nom}`);
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`--${nom} demande une valeur`);
    o[nom] = argv[i + 1];
    i += 1;
  }
  return o;
}

async function principal() {
  let navigateur;
  try {
    const o = lireOptions(process.argv.slice(2));
    if (!!o.page === !!o.dist) throw new Error('il faut --page <fichier|url locale> OU --dist <dossier>, pas les deux ni aucun');
    if (!o.sortie) throw new Error('il manque --sortie <capture.png>');
    const sortie = path.resolve(o.sortie);
    fs.mkdirSync(path.dirname(sortie), { recursive: true });

    // Quelle adresse ouvrir, et quels hôtes sont permis.
    const hotesPermis = new Set();
    let adresse;
    let dist = null;
    if (o.dist) {
      dist = path.resolve(o.dist);
      if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`pas d’index.html dans ${dist}`);
      adresse = `${ORIGINE_VIRTUELLE}/`;
    } else if (/^https?:\/\//i.test(o.page)) {
      const u = new URL(o.page);
      if (!LOCAL.has(u.hostname)) throw new Error(`--page n’accepte que cette machine (127.0.0.1 ou localhost), pas ${u.hostname}`);
      hotesPermis.add(u.host);
      adresse = o.page;
    } else {
      const fichier = path.resolve(o.page);
      if (!fs.existsSync(fichier)) throw new Error(`page introuvable : ${fichier}`);
      adresse = pathToFileURL(fichier).href;
    }
    if (o.api) {
      const u = new URL(o.api);
      if (!LOCAL.has(u.hostname)) throw new Error(`--api n’accepte que cette machine (127.0.0.1 ou localhost), pas ${u.hostname}`);
      hotesPermis.add(u.host);
    }
    let email = '';
    let motDePasse = '';
    if (dist) {
      email = process.env.AMN_E2E_EMAIL ?? '';
      motDePasse = process.env.AMN_E2E_PASSWORD ?? '';
      if (!email || !motDePasse) throw new Error('un build demande AMN_E2E_EMAIL et AMN_E2E_PASSWORD (compte d’essai en @exemple.test)');
      if (!/@exemple\.test$/i.test(email)) throw new Error(`le compte doit être en @exemple.test (reçu : ${email}) — jamais de compte réel`);
    }

    const { chromium } = require('playwright-core');
    // Chromium (141 et plus) retient tout appel d'une page « publique » vers le réseau local en attendant une
    // autorisation qu'un navigateur sans tête ne donne jamais, et une page livrée par interception compte comme
    // publique : la connexion à l'amn-api d'essai restait suspendue. On lève ces contrôles pour CE lancement ;
    // le gardien ci-dessous reste la seule porte (seuls les hôtes de cette machine, listés, sortent).
    const sansReseauLocalBloque = '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests';
    navigateur = await chromium.launch({ executablePath: process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--font-render-hinting=none', sansReseauLocalBloque] });
    const contexte = await navigateur.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      colorScheme: o.theme === 'clair' ? 'light' : 'dark',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const refuses = [];
    // Le gardien du réseau : rien ne sort de cette machine, rien n’entre que ce qu’on a permis.
    await contexte.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === 'file:' || url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol === 'about:') return route.continue();
      if (dist && url.origin === ORIGINE_VIRTUELLE) {
        let chemin = decodeURIComponent(url.pathname);
        let fichier = path.join(dist, chemin);
        if (!fichier.startsWith(dist + path.sep) && fichier !== dist) return route.abort();
        if (!fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) fichier = path.join(dist, 'index.html'); // le routeur de l’app prend la suite
        return route.fulfill({ status: 200, body: fs.readFileSync(fichier), contentType: TYPES[path.extname(fichier).toLowerCase()] ?? 'application/octet-stream' });
      }
      if (hotesPermis.has(url.host)) return route.continue();
      refuses.push(`${route.request().method()} ${url.origin}${url.pathname}`.slice(0, 120));
      return route.abort();
    });

    const page = await contexte.newPage();
    if (o.date && page.clock) await page.clock.install({ time: new Date(o.date) });

    if (dist) {
      // Le guide de première connexion masque tout à un navigateur neuf : on le marque comme vu, comme le ferait quelqu’un qui l’a parcouru.
      await contexte.addInitScript((mail) => {
        try { for (const q of ['general', 'profil', 'presentation']) localStorage.setItem(`amn.guide.${q}.${mail}`, 'vu'); } catch { /* sans stockage */ }
      }, email);
      await page.goto(adresse);
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="password"]').fill(motDePasse);
      await page.locator('button:has-text("Se connecter")').click();
      for (let i = 0; i < 20 && (await page.content()).includes('name="password"'); i += 1) await new Promise((r) => setTimeout(r, 500));
      if ((await page.content()).includes('name="password"')) throw new Error('la connexion n’a pas abouti (amn-api d’essai joignable ? compte créé ? voir --api)');
      await new Promise((r) => setTimeout(r, 1500));
      if (o.route) {
        const cible = o.route.startsWith('#') ? `${ORIGINE_VIRTUELLE}/${o.route}` : `${ORIGINE_VIRTUELLE}${o.route}`;
        await page.goto(cible);
      }
    } else {
      await page.goto(adresse);
    }

    // Un rendu déterministe : plus d’animation ni de transition, curseur de saisie masqué, polices chargées.
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; scroll-behavior: auto !important; }' });
    await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
    if (o.attendre) await page.locator(o.attendre).first().waitFor({ state: 'visible', timeout: 15000 });
    await new Promise((r) => setTimeout(r, Number(o.pause ?? 800)));

    await page.screenshot({ path: sortie, fullPage: false });
    const texte = await page.evaluate(() => document.body.innerText).catch(() => '');
    fs.writeFileSync(sortie.replace(/\.png$/i, '.txt'), texte);

    console.log(`Capture : ${sortie} (1440×900)`);
    console.log(`Réseau : ${refuses.length === 0 ? 'rien de refusé' : `${refuses.length} requête(s) refusée(s) hors de cette machine — ${[...new Set(refuses)].slice(0, 4).join(' ; ')}`}`);
    await navigateur.close();
  } catch (e) {
    console.error(`Erreur : ${e.message}`);
    if (navigateur) await navigateur.close().catch(() => undefined);
    process.exit(2);
  }
}

principal();
