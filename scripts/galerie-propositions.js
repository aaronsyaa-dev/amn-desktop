/**
 * galerie-propositions.js — écrit propositions/index.html, la page qui
 * présente toutes les maquettes d'AMN Desktop d'un coup. Reprise du dépôt
 * AllStoreee ; ajout : les notes des critiques, lues dans `_notes.json`.
 *
 * Elle se GÉNÈRE à partir des dossiers `NN-nom/` et de leur `meta.json` :
 * écrite à la main, elle aurait fini par annoncer une maquette retirée ou
 * oublier la dernière arrivée — une galerie qui ment sur son contenu.
 *
 * Les vignettes sont réduites ici (720 px pour le bureau, 300 px pour le
 * téléphone) à partir des captures de `verifier-propositions.js` : trente
 * captures en 1440 px feraient télécharger six mégaoctets pour une page de
 * sommaire.
 *
 * Usage : node scripts/verifier-propositions.js   (écrit les captures)
 *         node scripts/galerie-propositions.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROPS = path.join(__dirname, '..', 'propositions');
const CAPT = path.join(PROPS, '_captures');

const ech = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dossiers = fs.readdirSync(PROPS)
  .filter((d) => /^\d\d-[a-z0-9-]+$/.test(d) && fs.existsSync(path.join(PROPS, d, 'index.html')))
  .sort();

/* Vignettes : Pillow, comme le reste de la chaîne image du dépôt. */
const aReduire = [];
for (const d of dossiers) {
  for (const [format, largeur] of [['bureau', 720], ['mobile', 300]]) {
    const src = path.join(CAPT, `${d}-${format}.jpg`);
    const dst = path.join(CAPT, `${d}-${format}-${largeur}.jpg`);
    if (fs.existsSync(src) && (!fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(src).mtimeMs)) {
      aReduire.push([src, dst, largeur]);
    }
  }
}
if (aReduire.length) {
  execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
for src, dst, w in json.loads(sys.argv[1]):
    im = Image.open(src).convert('RGB')
    h = round(im.height * w / im.width)
    im.resize((w, h), Image.LANCZOS).save(dst, quality=78, optimize=True, progressive=True)
`, JSON.stringify(aReduire)], { stdio: 'inherit' });
}

/* Les maquettes TERMINÉES (construites et passées au vérificateur) sont
   listées dans `_finies.json`. Les autres existent sur le disque pendant
   qu'un agent y travaille : elles restent visibles, mais annoncées comme
   « en construction » et placées après — une page à moitié écrite
   présentée comme finie, c'est la galerie qui ment. */
let finies = null;
try { finies = new Set(JSON.parse(fs.readFileSync(path.join(PROPS, '_finies.json'), 'utf8'))); } catch (_) { /* toutes finies */ }
const estFinie = (d) => !finies || finies.has(d);
dossiers.sort((a, b) => (estFinie(b) - estFinie(a)) || a.localeCompare(b));

/* Notes du dernier critique indépendant : { "01-nom": { "3d": 8, "ensemble": 8, "telephone": 9 } }.
   Écrites par la session qui orchestre, jamais par l'agent qui a construit. */
let notes = {};
try { notes = JSON.parse(fs.readFileSync(path.join(PROPS, '_notes.json'), 'utf8')); } catch (_) { /* pas encore critiquées */ }

const cartes = dossiers.map((d) => {
  let m = {};
  try { m = JSON.parse(fs.readFileSync(path.join(PROPS, d, 'meta.json'), 'utf8')); } catch (_) { /* meta absent */ }
  const num = d.slice(0, 2);
  const titre = m.titre || d.slice(3).replace(/-/g, ' ');
  const aBureau = fs.existsSync(path.join(CAPT, `${d}-bureau-720.jpg`));
  const aMobile = fs.existsSync(path.join(CAPT, `${d}-mobile-300.jpg`));
  const polices = Array.isArray(m.polices) ? m.polices.join(' · ') : '';
  const modeles = Array.isArray(m.modeles) && m.modeles.length ? m.modeles.join(' · ') : '';
  return `
    <article class="carte${estFinie(d) ? '' : ' en-cours'}" style="--i:${Number(num)}">
      <a class="vue" href="./${d}/" aria-label="Ouvrir la maquette ${ech(titre)}">
        ${aBureau ? `<img class="bureau" src="_captures/${d}-bureau-720.jpg" width="720" height="450" alt="Premier écran de la maquette ${ech(titre)} sur ordinateur" loading="lazy" decoding="async">` : '<span class="bureau vide">capture à venir</span>'}
        ${aMobile ? `<img class="tel" src="_captures/${d}-mobile-300.jpg" width="300" height="650" alt="La même maquette sur téléphone" loading="lazy" decoding="async">` : ''}
      </a>
      <div class="texte">
        <p class="num">${num}${estFinie(d) ? '' : ' · <span class="badge">en construction, pas encore vérifiée</span>'}${notes[d] ? ` · <span class="notes">3D ${notes[d]['3d']}/10 · ensemble ${notes[d].ensemble}/10 · téléphone ${notes[d].telephone}/10</span>` : ''}</p>
        <h2><a href="./${d}/">${ech(titre)}</a></h2>
        ${m.direction ? `<p class="direction">${ech(m.direction)}</p>` : ''}
        ${m.description ? `<p class="desc">${ech(m.description)}</p>` : ''}
        <dl>
          ${m.technique ? `<dt>3D</dt><dd>${ech(m.technique)}</dd>` : ''}
          ${polices ? `<dt>Typo</dt><dd>${ech(polices)}</dd>` : ''}
          ${modeles ? `<dt>Modèles</dt><dd>${ech(modeles)}</dd>` : ''}
        </dl>
        <a class="ouvrir" href="./${d}/">Ouvrir la maquette</a>
      </div>
    </article>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Maquettes — AMN Desktop</title>
<meta name="description" content="Les propositions de design de la page d'accueil d'AMN Desktop. Maquettes non publiées.">
<link rel="icon" type="image/png" href="../icon.png">
<link rel="stylesheet" href="_lib/fonts/spectral.css">
<link rel="stylesheet" href="_lib/fonts/space-grotesk.css">
<link rel="stylesheet" href="_lib/fonts/jetbrains-mono.css">
<style>
  :root { --fond:#0a0a0a; --carte:#121212; --encre:#f2f2f0; --doux:#a9a9a5; --accent:#f2f2f0; --filet:#262626; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html { background:var(--fond); }
  body { background:var(--fond); color:var(--encre); font:16px/1.55 'Space Grotesk', system-ui, sans-serif; padding:0 16px 80px; }
  a { color:inherit; }
  a:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
  header { max-width:1320px; margin:0 auto; padding:56px 0 40px; border-bottom:1px solid var(--filet); }
  .marque { font:500 13px/1 'JetBrains Mono', ui-monospace, monospace; letter-spacing:.2em; text-transform:uppercase; color:var(--doux); }
  h1 { font:600 clamp(40px, 8vw, 110px)/.98 'Spectral', Georgia, serif; letter-spacing:-.01em; margin:18px 0 22px; }
  h1 em { font-style:normal; color:var(--doux); }
  .intro { max-width:62ch; color:var(--doux); }
  .intro strong { color:var(--encre); font-weight:400; }
  .grille { max-width:1320px; margin:48px auto 0; display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:40px 32px; }
  @media (max-width: 860px) { .grille { grid-template-columns:1fr; gap:40px; } }
  .carte { background:var(--carte); border:1px solid var(--filet); border-radius:2px; overflow:hidden; display:flex; flex-direction:column; }
  .vue { position:relative; display:block; aspect-ratio:16/10; overflow:hidden; background:#000; }
  .vue .bureau { width:100%; height:100%; object-fit:cover; display:block; transition:transform .6s cubic-bezier(.2,.7,.2,1); }
  .vue .vide { display:grid; place-items:center; height:100%; color:var(--doux); }
  .vue .tel { position:absolute; right:14px; bottom:-18%; width:22%; border-radius:12px; border:3px solid #000; box-shadow:0 12px 40px rgba(0,0,0,.6); transition:transform .6s cubic-bezier(.2,.7,.2,1); }
  .carte:hover .bureau { transform:scale(1.03); }
  .carte:hover .tel { transform:translateY(-12%); }
  .texte { padding:22px 22px 24px; display:flex; flex-direction:column; gap:10px; flex:1; }
  .num { color:var(--doux); font:13px/1.5 'JetBrains Mono', ui-monospace, monospace; letter-spacing:.06em; }
  .notes { color:var(--encre); }
  h2 { font:600 30px/1.1 'Spectral', Georgia, serif; }
  h2 a { text-decoration:none; }
  h2 a:hover { text-decoration:underline; text-decoration-color:var(--accent); text-underline-offset:5px; }
  .direction { color:var(--encre); }
  .desc { color:var(--doux); font-size:14px; }
  dl { display:grid; grid-template-columns:auto 1fr; gap:4px 14px; font-size:13px; color:var(--doux); margin-top:4px; }
  dt { color:var(--encre); text-transform:uppercase; letter-spacing:.1em; font-size:11px; padding-top:2px; }
  .ouvrir { margin-top:auto; align-self:flex-start; display:inline-block; padding:10px 18px; min-height:24px; border:1px solid var(--encre); border-radius:2px; text-decoration:none; font-size:13px; letter-spacing:.08em; text-transform:uppercase; }
  .ouvrir:hover { background:var(--encre); color:var(--fond); }
  .en-cours { opacity:.55; }
  .badge { color:var(--doux); letter-spacing:.04em; }
  footer { max-width:1320px; margin:64px auto 0; padding-top:24px; border-top:1px solid var(--filet); color:var(--doux); font-size:13px; }
  @media (prefers-reduced-motion: reduce) { .vue .bureau, .vue .tel { transition:none; } }
</style>
</head>
<body>
<header>
  <p class="marque">AMN Desktop · maquettes</p>
  <h1>Votre activité dans un seul outil, <em>${dossiers.filter(estFinie).length} façons</em> de la montrer.</h1>
  <p class="intro">Des propositions de design pour la page d'accueil d'AMN Desktop. Chacune pousse une idée jusqu'au bout : 3D, dessin, typographie, mouvement. <strong>Aucune n'est publiée.</strong> Les notes viennent d'un critique qui n'a pas construit la page : 9 veut dire qu'on la montrerait fièrement à un client exigeant. Sur téléphone, chaque maquette s'ouvre en plein écran.</p>
</header>
<main class="grille">
${cartes}
</main>
<footer>
  <p>Maquettes de design, non publiées. Modèles 3D : KhronosGroup glTF-Sample-Assets, licences CC0 et CC BY 4.0, crédités sur chaque maquette qui les utilise. Bibliothèques : three.js (MIT), GSAP, Lenis (MIT). Polices sous licence libre (SIL OFL).</p>
</footer>
</body>
</html>
`;
fs.writeFileSync(path.join(PROPS, 'index.html'), html);
console.log(`✅ propositions/index.html — ${dossiers.length} maquette(s)`);
