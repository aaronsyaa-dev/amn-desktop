/**
 * verifier-propositions.js — chaque maquette de `propositions/` s'affiche-t-elle
 * VRAIMENT, en ligne, sur un téléphone ?
 *
 * Repris le 25/09/2026 du dépôt AllStoreee (même outil, même exigence) pour
 * les maquettes de la page d'accueil d'AMN Desktop. Différences : la page est
 * servie comme sur l'aperçu Vercel de ce dépôt (propositions/ à la racine,
 * public/ pour le reste), avec la politique de sécurité déclarée pour
 * `/propositions/(.*)` dans `vercel.json`, et les textes passent par la liste
 * de formules refusées d'AMN (commentaires de code compris).
 * Une maquette 3D peut être belle sur l'écran de celui qui l'a faite et
 * vide chez tout le monde : un module refusé par la politique de sécurité,
 * une texture chargée en `blob:`, un canvas qui reste noir. Rien de tout ça
 * ne se voit sans le regarder dans les conditions réelles.
 *
 * Pour chaque maquette (dossier `NN-nom/`) :
 *   - servie avec la politique de sécurité de `vercel.json` ;
 *   - ouverte sur bureau (1440 × 900) et sur téléphone (390 × 844) ;
 *   - erreurs de page, erreurs de console, violations de CSP, fichiers en
 *     404 — tout échec les compte ;
 *   - le canvas WebGL est-il VIDE ? (écart-type des pixels, mesuré sur la
 *     capture, pas sur la promesse du code) ;
 *   - défilement horizontal sur téléphone ;
 *   - mouvement réduit : la page tient debout, sans erreur ;
 *   - poids de ce que le visiteur télécharge au premier affichage.
 *
 * Écrit des captures dans `propositions/_captures/` (pour la galerie) et un
 * rapport JSON sur la sortie standard avec `--json`.
 *
 * Usage :
 *   node scripts/verifier-propositions.js                  # toutes
 *   node scripts/verifier-propositions.js --only=07-neon   # une seule
 *   node scripts/verifier-propositions.js --only=07-neon --pleine   # + capture pleine page
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
/* playwright n'est pas une dépendance du dépôt (aucune ajoutée pour des
   maquettes) : on prend celui qui est installé, ou le chemin donné par
   PLAYWRIGHT_CORE=/chemin/vers/node_modules/playwright-core. */
const { chromium } = (() => {
  for (const m of [process.env.PLAYWRIGHT_CORE, 'playwright', 'playwright-core']) {
    if (!m) continue;
    try { return require(m); } catch (_) { /* suivant */ }
  }
  console.error('❌ playwright introuvable : PLAYWRIGHT_CORE=/chemin/node_modules/playwright-core node scripts/verifier-propositions.js');
  process.exit(2);
})();

const RACINE = path.join(__dirname, '..');
const SITE = RACINE;
const PUBLIC = path.join(RACINE, 'public');
const PROPS = path.join(RACINE, 'propositions');
const CAPTURES = path.join(PROPS, '_captures');
const args = process.argv.slice(2);
const opt = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const SEULE = opt('only');
const JSON_OUT = args.includes('--json');
const PLEINE = args.includes('--pleine');
const DOSSIER_PLEINE = opt('pleine-dans') || path.join('/tmp', 'captures-propositions');

/* Budget de premier affichage, en octets NON compressés (Vercel compresse en
   Brotli : three.js passe de ~770 Ko à ~190 Ko). Au-delà de l'avertissement,
   on le dit ; au-delà du plafond, c'est un échec : un visiteur en 4G attend. */
const AVERTIR = 4.5e6;
const PLAFOND = 9e6;

const EN_TETES = (() => {
  const v = JSON.parse(fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8'));
  const h = {};
  for (const bloc of v.headers || []) {
    if (bloc.source !== '/(.*)' && bloc.source !== '/propositions/(.*)') continue;
    for (const x of bloc.headers || []) h[x.key] = x.value;
  }
  return h;
})();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.hdr': 'application/octet-stream',
  '.ktx2': 'image/ktx2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

function serveur() {
  return http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    for (const [k, v] of Object.entries(EN_TETES)) res.setHeader(k, v);
    if (url.endsWith('/')) url += 'index.html';
    /* Comme sur Vercel : propositions/ copié tel quel à la racine du site,
       le reste vient de public/ (icône, manifeste). */
    let f = url.startsWith('/propositions/') ? path.join(RACINE, url.slice(1)) : path.join(PUBLIC, url.slice(1));
    if (!fs.existsSync(f) && !path.extname(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.statusCode = 404; return res.end('introuvable');
    }
    res.setHeader('content-type', TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream');
    res.end(fs.readFileSync(f));
  });
}

function maquettes() {
  if (!fs.existsSync(PROPS)) return [];
  return fs.readdirSync(PROPS)
    .filter((d) => /^\d\d-[a-z0-9-]+$/.test(d) && fs.existsSync(path.join(PROPS, d, 'index.html')))
    .filter((d) => !SEULE || d === SEULE || d.startsWith(SEULE))
    .sort();
}

/** Écart-type des pixels d'une image PNG (buffer) — via le navigateur, pour
    ne dépendre d'aucune bibliothèque d'image côté Node. */
async function ecartType(page, png) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    const w = Math.min(img.width, 320), h = Math.round(img.height * (w / img.width));
    c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; s += l; s2 += l * l; n++; }
    const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m));
  }, png.toString('base64'));
}

async function inspecter(nav, base, nom, format) {
  const bureau = format === 'bureau';
  const ctx = await nav.newContext({
    viewport: bureau ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: !bureau, hasTouch: !bureau,
    reducedMotion: format === 'reduit' ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const erreurs = [];
  let octets = 0;
  const lus = new Set();
  page.on('pageerror', (e) => erreurs.push('erreur de page : ' + String(e.message || e).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon/.test(t)) return;
    erreurs.push('console : ' + t.slice(0, 200));
  });
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.startsWith(base)) return;
    if (r.status() >= 400) erreurs.push(`${r.status()} ${u.slice(base.length - 1)}`);
    if (lus.has(u)) return; lus.add(u);
    try { octets += (await r.body()).length; } catch (_) { /* annulée */ }
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!u.startsWith(base) && !/^data:/.test(u)) erreurs.push('requête hors du site (bloquée en ligne) : ' + u.slice(0, 120));
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push(`${e.violatedDirective} ← ${e.blockedURI || 'inline'}`);
    });
  });
  const url = `${base}propositions/${nom}/`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    erreurs.push('chargement : ' + e.message.split('\n')[0]);
  }
  await page.waitForTimeout(2500);
  const csp = await page.evaluate(() => window.__csp || []).catch(() => []);
  for (const v of csp) erreurs.push('CSP : ' + v);

  const mesure = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('canvas')].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 40 && r.height > 40 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(c).visibility !== 'hidden';
    }).map((c) => { const r = c.getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(innerWidth, r.right) - Math.max(0, r.left), h: Math.min(innerHeight, r.bottom) - Math.max(0, r.top), gl: !!(c.getContext && (c.__gl || true)) }; });
    return {
      canvases: cs,
      totalCanvas: document.querySelectorAll('canvas').length,
      debord: document.documentElement.scrollWidth - innerWidth,
      hauteur: document.documentElement.scrollHeight,
      titre: document.title,
      h1: document.querySelectorAll('h1').length,
      lang: document.documentElement.lang,
    };
  }).catch(() => ({ canvases: [], totalCanvas: 0, debord: 0, hauteur: 0, titre: '', h1: 0, lang: '' }));

  /* ⚠️ ON MESURE LE CANVAS SEUL. La première version capturait la zone du
     canvas telle qu'elle s'affiche — donc avec le titre posé par-dessus. Un
     canvas resté noir passait alors pour « rempli » grâce au texte : injection
     vérifiée, le contrôle ne mordait pas. On masque donc tout le reste le
     temps de la capture (le fond de <body> reste, le canvas est au-dessus). */
  const vides = [];
  if (mesure.canvases.length) {
    await page.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' })
      .then((h) => page.evaluate((el) => { el.id = '__isole'; }, h)).catch(() => {});
    await page.waitForTimeout(120);
    for (const c of mesure.canvases) {
      if (c.w < 40 || c.h < 40) continue;
      const png = await page.screenshot({ clip: { x: c.x, y: c.y, width: c.w, height: c.h } }).catch(() => null);
      if (!png) continue;
      const sd = await ecartType(page, png).catch(() => 99);
      if (sd < 2.5) vides.push(Math.round(sd * 10) / 10);
    }
    await page.evaluate(() => { const s = document.getElementById('__isole'); if (s) s.remove(); }).catch(() => {});
    await page.waitForTimeout(120);
  }

  fs.mkdirSync(CAPTURES, { recursive: true });
  if (format !== 'reduit') {
    await page.evaluate(() => scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(CAPTURES, `${nom}-${format}.jpg`), type: 'jpeg', quality: 72 }).catch(() => {});
    if (PLEINE) {
      fs.mkdirSync(DOSSIER_PLEINE, { recursive: true });
      /* On descend lentement : les animations au défilement doivent s'être
         déclenchées, sinon la capture montre des sections encore masquées. */
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.6)) {
          scrollTo(0, y); await new Promise((r) => setTimeout(r, 160));
        }
        scrollTo(0, 0);
      }).catch(() => {});
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(DOSSIER_PLEINE, `${nom}-${format}-pleine.jpg`), type: 'jpeg', quality: 70, fullPage: true }).catch(() => {});
    }
  }
  await ctx.close();
  return { format, erreurs: [...new Set(erreurs)], octets, ...mesure, vides };
}

/* Formules refusées dans une maquette AMN, jusque dans les commentaires :
   promesses creuses, clients ou avis qui n'existent pas. AMN n'a pas encore
   de client payant — une page qui en montre ment. Le prénom privé est écrit
   en morceaux pour ne pas apparaître en clair dans ce dépôt. */
const REFUSES = [
  /solutions? innovantes?/i, /sur[- ]mesure/i, /cl[ée]s? en main/i, /r[ée]volution/i, /\bleader\b/i,
  /n[°o]\s?1\b/i, /num[ée]ro un\b/i, /100\s?%\s?s[ée]curis/i, /inviolable/i, /infaillible/i,
  /ils nous font confiance/i, /clients? satisfaits?/i, /\bnos clients\b/i, /t[ée]moignages?/i, /avis clients?/i,
  new RegExp(['h', 'a', 'r', 'u', 'n'].join(''), 'i'),
];
function textesRefuses(nom) {
  const out = [];
  const tour = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { tour(p); continue; }
      if (!/\.(html|js|mjs|css|json|md|txt|svg)$/i.test(f)) continue;
      const t = fs.readFileSync(p, 'utf8');
      for (const re of REFUSES) { const m = t.match(re); if (m) out.push(`formule refusée « ${m[0]} » dans ${path.relative(PROPS, p)}`); }
    }
  };
  tour(path.join(PROPS, nom));
  return out;
}

(async () => {
  const liste = maquettes();
  if (!liste.length) { console.log(SEULE ? `aucune maquette « ${SEULE} »` : 'aucune maquette'); process.exit(1); }
  const srv = serveur();
  const port = await new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
  const base = `http://127.0.0.1:${port}/`;
  const CHROME = [process.env.CHROME, '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((c) => c && fs.existsSync(c));
  const nav = await chromium.launch({
    ...(CHROME ? { executablePath: CHROME } : {}),
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const rapport = [];
  let echecs = 0;
  for (const nom of liste) {
    const r = { nom, problemes: [], avertissements: [] };
    for (const format of ['bureau', 'mobile', 'reduit']) {
      const m = await inspecter(nav, base, nom, format);
      r[format] = { octets: m.octets, canvas: m.totalCanvas, debord: m.debord, hauteur: m.hauteur };
      for (const e of m.erreurs) r.problemes.push(`[${format}] ${e}`);
      if (m.vides.length) r.problemes.push(`[${format}] canvas VIDE à l'écran (écart-type ${m.vides.join(', ')}) — la 3D ne s'affiche pas`);
      if (format === 'mobile' && m.debord > 1) r.problemes.push(`[mobile] défilement horizontal : la page déborde de ${m.debord} px`);
      if (format === 'bureau') {
        if (!m.titre) r.problemes.push('pas de <title>');
        if (m.h1 !== 1) r.avertissements.push(`${m.h1} titre(s) h1 — il en faut exactement un`);
        if (m.lang !== 'fr') r.problemes.push('langue non déclarée en français (<html lang="fr">)');
        if (!m.totalCanvas) r.avertissements.push('aucun canvas : pas de 3D WebGL sur cette maquette');
        if (m.octets > PLAFOND) r.problemes.push(`premier affichage : ${(m.octets / 1e6).toFixed(1)} Mo — plafond ${(PLAFOND / 1e6)} Mo`);
        else if (m.octets > AVERTIR) r.avertissements.push(`premier affichage lourd : ${(m.octets / 1e6).toFixed(1)} Mo (non compressé)`);
      }
    }
    const html = fs.readFileSync(path.join(PROPS, nom, 'index.html'), 'utf8');
    if (!/<meta name="robots" content="noindex, nofollow">/.test(html)) r.problemes.push('pas de <meta name="robots" content="noindex, nofollow"> — une maquette ne doit pas être référencée');
    if (/https?:\/\/(?!www\.w3\.org)[a-z0-9.-]+\//i.test(html.replace(/<!--[\s\S]*?-->/g, ''))) {
      const m = html.match(/https?:\/\/(?!www\.w3\.org)[a-z0-9.-]+\//i);
      r.avertissements.push(`adresse externe dans la page (${m && m[0]}) — la politique de sécurité bloquera tout script, style, police ou image qui n'est pas servi par le site`);
    }
    for (const t of textesRefuses(nom)) r.problemes.push(t);
    if (r.problemes.length) echecs += 1;
    rapport.push(r);
    if (!JSON_OUT) {
      const kb = (x) => Math.round((x || 0) / 1024);
      console.log(`${r.problemes.length ? '❌' : '✅'} ${nom}  bureau ${kb(r.bureau.octets)} Ko · mobile ${kb(r.mobile.octets)} Ko · ${r.bureau.canvas} canvas`);
      for (const p of r.problemes) console.log('     ❌ ' + p);
      for (const a of r.avertissements) console.log('     ⚠️  ' + a);
    }
  }
  await nav.close();
  srv.close();
  if (JSON_OUT) console.log(JSON.stringify(rapport, null, 1));
  else console.log(`\n${liste.length - echecs}/${liste.length} maquette(s) sans problème. Captures : propositions/_captures/`);
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error('❌', e); process.exit(1); });
