# La boîte à outils 3D, servie par le site lui-même

Tout ce qui suit a été monté et éprouvé le 24/09/2026 pour les 27 maquettes
d'ALLSTORE (`AMN-SITE-WEB/propositions/_lib/`). À réutiliser tel quel pour un
autre client AMN : copier `_lib/` et le gabarit, pas les réinstaller.

## Pourquoi tout est « vendu » (copié dans le site)

La politique de sécurité (CSP) d'un site sérieux ressemble à celle d'ALLSTORE :

```
default-src 'self'; script-src 'self' 'unsafe-inline' …; style-src 'self' 'unsafe-inline';
font-src 'self'; img-src 'self' data: …; connect-src 'self' …
```

Conséquences, toutes vérifiées en ligne :

| Interdit | Parce que | À la place |
|---|---|---|
| CDN (jsdelivr, unpkg, cdnjs) | `script-src 'self'` | three/gsap/lenis copiés dans `_lib/` |
| Google Fonts | `font-src 'self'` | `.woff2` + un `.css` `@font-face` par famille |
| `.glb` à textures intégrées | le chargeur crée des URL `blob:` | `.gltf` + textures en fichiers séparés |
| worker créé depuis un blob | `blob:` | rien, ou un vrai fichier `.js` |
| Draco, KTX2/Basis, moteur physique wasm | pas de `'wasm-unsafe-eval'` | géométrie non compressée, physique écrite à la main |
| `eval`, `new Function` | pas de `'unsafe-eval'` | — |

La carte d'import est un script **inline**, autorisé par `'unsafe-inline'` :

```html
<script type="importmap">
{ "imports": { "three": "../_lib/three/three.module.js",
               "three/addons/": "../_lib/three/addons/" } }
</script>
```

## Récupérer les paquets depuis cet environnement

La liste blanche réseau des sessions Claude **autorise le registre npm et
`raw.githubusercontent.com`**, et **bloque** jsdelivr, unpkg, threejs.org,
polyhaven, vercel.com. Donc :

```bash
# jamais à la racine du dépôt (pas de package.json : npm y reconstruirait
# node_modules et supprimerait playwright) — un dossier à part, ignoré par git
mkdir -p .outils-3d && cd .outils-3d && echo '{"name":"outils-3d","private":true}' > package.json
npm install three@0.186 gsap@3.15 lenis esbuild @fontsource/syne @fontsource/anton …
```

- **three.js** : `three.core.js` + `three.module.js` passés par esbuild
  (`--minify`, format esm) — ~770 Ko non compressés, ~190 Ko en Brotli. Le
  dossier `examples/jsm/` est copié en `addons/` (controls, postprocessing,
  geometries, math, objects, environments, loaders, lines, shaders…).
- **Polices 3D pour `TextGeometry`** : `helvetiker_bold`, `optimer_bold`,
  `droid_sans_bold` (`.typeface.json`, fournies avec three). Pour une police
  d'affiche (Anton…), la convertir en `typeface.json` — c'est ce qu'a fait
  `17-typo-cinetique/anton-3d.json`, capitales accentuées comprises.
- **GSAP 3.15** : entièrement gratuit, plugins compris (ScrollTrigger,
  SplitText, Flip, Observer, CustomEase, MotionPathPlugin, DrawSVGPlugin,
  MorphSVGPlugin, ScrollSmoother, TextPlugin, Draggable, InertiaPlugin) —
  scripts classiques, `window.gsap`.
- **Lenis** : `lenis.min.js` + `lenis.css`.
- **Polices web** : `@fontsource/<nom>` → on ne garde que le sous-ensemble
  `latin` en `.woff2`, et on écrit un `<nom>.css` avec un `@font-face` par
  graisse, `font-display: swap`. Inventaire dans `fonts/fonts.json`.
- **Modèles glTF** : `KhronosGroup/glTF-Sample-Assets` via
  `raw.githubusercontent.com`, en `.gltf` (pas `.glb`). Textures réduites à
  1024 px et passées en JPEG quand elles n'ont pas de transparence. Licences
  dans `modeles/CREDITS.md` : les **CC-BY-4.0 doivent être crédités sur la
  page** (« Modèle 3D : MaterialsVariantsShoe — Shopify, CC BY 4.0 »).

Modèles disponibles (tous éprouvés derrière la CSP) : MaterialsVariantsShoe
(CC-BY, Shopify), SheenCloth, SheenChair, Corset, ClearcoatWicker,
GlassVaseFlowers, WaterBottle, Lantern, DiffuseTransmissionTeacup, ToyCar,
Avocado (CC0), SpecularSilkPouf, GlamVelvetSofa, ChairDamaskPurplegold,
IridescenceLamp (CC-BY).

## Le gabarit minimal qui marche derrière la CSP

`AMN-SITE-WEB/propositions/_gabarit/index.html` : carte d'import,
`WebGLRenderer` avec `setPixelRatio(Math.min(devicePixelRatio, 2))`,
`ACESFilmicToneMapping`, environnement `RoomEnvironment` passé par
`PMREMGenerator`, un `GLTFLoader`, et **une seule image** sous
`prefers-reduced-motion`. Partir de lui, jamais d'une page vide.

## Ce qui ne part pas en ligne

`propositions/_BRIEF.md` est dans `AMN-SITE-WEB/.vercelignore`. Tout fichier
de travail d'un dossier déployé doit y être aussi — ou vivre hors du dossier
déployé (`scripts/`).
