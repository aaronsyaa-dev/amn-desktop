# Techniques 3D qui ont marché — avec les valeurs

Relevé dans le code des maquettes d'ALLSTORE (`AMN-SITE-WEB/propositions/`),
surtout les quatre retenues : **11-trame-textile** (9/10 en 3D),
**17-typo-cinetique**, **09-galerie-musee**, **12-unboxing**. Les chemins
donnent où lire le code ; les numéros de ligne bougent, chercher le mot-clé.

## 1. Matériaux et shaders

### Tissu (11 — `trame-matiere.js`, `trame-gl.js`)
- **Cartes de matière calculées une seule fois** au processeur : tuiles
  périodiques de 256 px, texture en couches avec mipmaps. Carte A : normale
  xy, hauteur, couverture ; carte B : part chaîne/trame, occlusion, duvet.
- **Orientation des fibres stockée en angle double** (cos 2θ, sin 2θ) : elle
  se moyenne proprement dans les mipmaps, un angle simple non.
- **Chaîne et trame de largeurs différentes** : c'est le sillon entre deux
  flottés qui fait lire un fil plutôt qu'un carreau.
- **Reflet anisotrope Kajiya-Kay à deux lobes** : tangente décalée vers la
  normale de −0,1 et +0,22, exposants 46→10 et 12→5 selon la distance ;
  diffus enveloppé `ndl·0,86+0,14`, velours `pow(1−N·V, 4)·0,3`. Reflet
  réduit (×0,6) sur le sergé pour qu'il ne fourmille pas derrière un titre.
- **Ombre d'un fil sur l'autre** : jusqu'à 6 pas dans la carte de hauteur,
  vers la lampe.
- **Un shader par armure, choisi par `#define`**, dessiné seulement dans sa
  bande d'écran : un GPU logiciel exécute toutes les branches, c'est la
  TAILLE du code qui coûte, pas le chemin suivi.
- **Profondeur de champ gratuite** : un niveau de mipmap plus grossier au loin.
- Leçons de matière : un sergé à flottés bombés se lit en **écailles** (c'est
  la côte continue qui fait le denim) ; la toile indigo réutilisée en écru
  donnait une **toile de jute** ; un jour entre les fils presque noir sur un
  écru fait **sale** — il doit être un écru foncé (~#8a7f6a), relief et
  ombres réduits d'environ 40 %, fils plus serrés. Une maille dont les creux
  sont noirs paraît **posée sur du noir** : les creux prennent la couleur
  foncée du fil.
- **Étoffe drapée en verlet** (`trame-etoffe.js`) : contraintes de structure,
  cisaillement et flexion, bords épinglés.

### Laque et lettres (17 — `heros.js`)
- `MeshPhysicalMaterial` : clearcoat 0,9, clearcoatRoughness 0,09,
  roughness 0,34 ; l'encre noire à clearcoat 0,45 / 0,13.
- **L'encre n'est pas un noir absolu** (0x1c1b21) : à 0x161512 les lettres
  noires n'avaient ni biseau ni reflet.
- **Peau d'orange** : bruit à 3 octaves dessiné dans un canvas, en
  `clearcoatNormalMap` avec une échelle de 0,05. Plus fort, un flanc vu en
  rasant ressemblait à une feuille de bronze froissée.
- **Ombre de contact DANS la matière** (`onBeforeCompile`, 3 contacts par
  lettre en uniformes) : un quad d'ombre posé devant se voyait dans les creux
  du U, du V, du N. Pied de chaque lettre assombri de 8 %.
- **Dessus des lettres assombri** : vu en plongée, le pied éclairé du C
  faisait la barre d'un G — « RACONTE » se lisait « RAGONTE ».

### Verre (09 — `galerie-3d.js`)
- La vitre reflète la salle (Fresnel), mais le reflet s'efface là où l'œuvre
  est sombre ; l'éclat des lampes reste.
- **Une bande de reflet oblique qui glisse en parallaxe** (0,55 × la caméra) :
  c'est le glissement que l'œil lit comme « il y a une vitre ». Une vitre
  immobile ne se voit pas.
- Vase en verre **simulé** (sonde + Fresnel) plutôt qu'en transmission, qui
  redessinerait toute la salle.

### Papier, kraft, holographie
- **Kraft** (12) : tuile couleur + normales précalculée une fois au GPU au
  lieu d'un bruit fractal à 4 octaves par pixel et par image.
- **Papier de soie** (12) : translucidité faite à la main dans l'émissif
  (contre-jour × regard vers la lumière), opacité 0,9 ; au verso le motif
  n'est qu'une ombre.
- **Coton** (12) : sheen 0,45, roughness 0,8, seulement au palier de qualité
  haut (`customProgramCacheKey`).
- **Papier découpé** (07) : Lambert + bumpMap sur un grain canvas ; recto de
  couleur et verso blanc dans un seul programme.
- **Holographie** (27) : arc-en-ciel HSV selon l'angle de vue, franges
  sinusoïdales, une paillette par cellule (`pow 180`), vernis (`pow 90`),
  piloté par un masque RGB. Les lettres restent d'encre, sinon le mot se perd
  dans le reflet.

### Tonalité
- **Khronos Neutral** pour les couleurs franches (17, 11) : AgX ternit rouge,
  outremer et jaune, ACES vire l'indigo au lilas.
- **ACES, exposition 1,2** pour une scène de nuit (09) : AgX aplatissait la
  nuit en gris.
- Tonalité et sRGB **faits dans le shader** (11) : changer de cible de rendu
  aurait recompilé le programme — des secondes en rendu logiciel.

## 2. Lumière, ombres, environnement

- **Ombres VSM** (17) : la seule qui se floute vraiment ; en PCF, le téléphone
  dessinait un trapèze gris à arêtes droites. Carte 384 px (256 au
  téléphone), radius 3,2 / 2,3, blurSamples 6 / 4, bias −0,0004,
  normalBias 0,02. `shadowMap.autoUpdate = false` : recalculée seulement si
  quelque chose bouge. Caméra d'ombre resserrée sur le sujet.
- **Studio pour laque** (17) : `RoomEnvironment` assourdi (lampes ×0,3, murs
  ×0,55 — ses murs délavaient les couleurs) + **3 rampes lumineuses minces**
  qui tracent un filet dans le vernis. PMREM à **128 px** (à 64 les rampes
  n'étaient que des taches), sans flou initial (il coûtait ~2 s en logiciel).
- **Lumière rasante** : directionnelle chaude 0xffc27a, intensité 0,9, très
  basse sur le côté — c'est elle qui sculpte les biseaux (17) et le tombé
  d'un tissu (12 : une douche frontale surexposait le t-shirt et écrasait
  ses plis ; en la baissant sur le côté et en baissant l'ambiance, les plis
  ont retrouvé un côté éclairé et un côté ombré).
- **Lampe qui suit le curseur par un ressort critique** (K = 60, sous-pas de
  1/30 s) : sans ressort, sur un appareil lent, elle traînait des secondes.
  Au doigt, elle suit le défilement (11).
- **Ombres de contact en shader** : profondeur vue du dessous,
  `pow(1−z, 1,6)`, flou séparable deux fois, refaite seulement si ça bouge
  (12) ; ou quads instanciés (28 au plus) — un SSAO coûterait plus que la
  scène (17).
- **Reflector** : sol ciré (09, ordinateur seulement, mipmaps, flou selon la
  distance, faisceaux exclus du reflet, mise à jour une image sur deux quand
  la caméra bouge peu) ; podium laqué (04, fumée et poussière exclues).
- **Cônes volumétriques** (09) : diffusion intégrée le long du rayon, phase
  Henyey-Greenstein g = 0,42, poussière plus dense près de la lampe. Version
  bon marché (12) : cylindre additif estompé par Fresnel (`pow 2,2`) — il
  n'éclaire rien, il se voit.
- **Lumière cuite** (09) : atlas calculé au démarrage, esquisse au quart puis
  pleine définition par bandes d'~150 000 texels ; ambiante en demi-flottant
  (en 8 bits les pénombres dessinaient des paliers).
- **Une lampe par pièce dans le shader** (03, attribut `piece`) au lieu de
  5 PointLight : chaque pixel n'écoute que sa lampe, et la lumière ne
  traverse plus les cloisons.
- **Ne jamais ajouter de lumière en cours de route** (12) : ça recompile tous
  les shaders au pire moment. On recolore une lumière existante.

## 3. Physique et animation

- **Corps rigides 2D écrits à la main** (17 — `physique.js`, d'après
  Box2D-Lite) : impulsions séquentielles, **démarrage à chaud** (c'est ce qui
  permet d'empiler sans trembler), 12 itérations, SAT + clipping. Chaque
  glyphe découpé en boîtes par bande de hauteur. Pas de 1/120, gravité −21.
  Profondeur et lacet sont visuels, bornés à 0,6 / 0,5 rad au contact —
  sinon une lettre couchée traverse ses voisines.
- **Pose déterministe, puis physique** (17) : la pose finale est calculée
  d'avance ; une lettre arrivée près de sa place y glisse en 0,1 s puis est
  figée (masse infinie). Au premier contact, toute la pile se réveille sans
  saut. **Rappel 4,5 s après le dernier contact** : chaque lettre regagne sa
  place, étage du bas d'abord — l'interaction n'est plus destructrice.
  Hasard à graine fixe pour une chorégraphie reproductible.
- **Verlet avec budget** (12) : pas fixe de 1/120 sous un budget
  `clamp(dt·180, 9, 32)` ms, 12 sous-pas au plus — un appareil lent voit un
  tissu au ralenti, jamais un tissu qui explose.
- **Ressorts partout** : progression ressort critique ω = 6 ; rabats de
  carton k = 150, amortissement 9, butées avec rebond ×0,3 (12) ; caméra
  ressort critique ω = 2π·0,9 en sous-pas de 1/60, secousse en bruit simplex
  qui s'éteint en 0,22 s (17).
- **Sommeil** : la boucle s'arrête après 24 images calmes (12).
- Plafonner les effets à 0,1 s par image : à 1 image/s, une onde de choc
  tenait sinon en une seule image (17).

## 4. Caméra et défilement

- **Images clés + Catmull-Rom** (12 : 14 clés — cible, azimut, élévation,
  rayon, focale).
- **`camera.setViewOffset`** pour poser le sujet à côté du texte : à droite au
  bureau, en haut au téléphone (12, 17). Distance ajustée en projetant
  réellement le sujet à l'écran.
- **Un réglage de caméra par section** (17 : tangage presque nul pour la
  phrase où la plongée créait une fausse lecture).
- **Au téléphone, jamais de gros plan qui coupe l'objet** ; réserver la zone
  où passent les cartes de texte (12).
- Galerie (09) : dans un couloir on regarde devant soi ; à l'arrêt devant
  une œuvre, un pas en avant ; balancement de marche lié à la distance
  parcourue, coupé si l'appareil peine. **Le cartel de la salle qu'on quitte
  s'efface avec la progression du trajet** (de 6 % à 36 %).
- Projection décentrée où 1 unité = 100 px CSS (07) : un papier à hauteur
  zéro tombe exactement sur son pixel de page.
- **GSAP + ScrollTrigger + Lenis** (11 — `page.js`) : Lenis `lerp 0,1`,
  `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker`,
  `lagSmoothing(0)`. **Pas de `once: true`** : un déclencheur déjà dépassé
  au chargement faisait planter ScrollTrigger → `toggleActions: 'play none
  none none'`. Ignorer les événements scroll sans déplacement émis au
  chargement (09).

## 5. Performance

- **Rendu progressif** (11) : en défilant, dessin à 0,35 de définition (0,42
  au téléphone) sans réallouer (on ne dessine qu'un coin de la cible) ; au
  calme, affinage par bandes — ciseaux arrondis bord par bord, **rien calculé
  sous les cartes opaques**. L'objet animé (navette) sur un calque dessiné en
  pleine définition par-dessus.
- **Juger le coût sur la MÉDIANE** des dernières images, en excluant celles
  qui compilent un shader : avec une moyenne, un pic de compilation a fait
  croire à un appareil lent et figé le tissu dix secondes.
- **Redessin partiel** (17) : `preserveDrawingBuffer`, puis seulement les
  lettres qui ont bougé avec leur ombre. **Qualité adaptative pendant le
  mouvement seulement** : le vernis part d'abord, puis la définition
  (planchers 0,6 bureau / 0,72 téléphone, cible 40 ms) ; l'image au repos
  garde tout.
- **Paliers mesurés vite** : sur ~1 s en temps réel, pas sur 45 images — à
  5 images/s ça fait 9 s de saccades avant la moindre décision (04).
- **Précompiler** : `renderer.compileAsync` si `KHR_parallel_shader_compile`
  existe ; sinon un dessin sur 1 pixel (ciseaux), parce qu'un pilote logiciel
  compile au premier DESSIN. Suivi d'un `fenceSync` avant la première
  animation (17).
- **`fenceSync` pour la cadence** (03) : ne pas soumettre une image avant que
  la précédente soit sortie du GPU ; démarrer bas en définition et monter.
  Réveil du GPU dans un OffscreenCanvas dès le chargement.
- **Fusionner l'immobile** en une géométrie à couleurs par sommet et
  uniformiser les matériaux : moins de programmes à compiler (03).
- **Charger les modèles quand ils servent** : `import()` au premier usage
  (11), `requestIdleCallback` et jamais au téléphone (09), à l'approche de la
  section (04).
- **Pause** hors écran (IntersectionObserver) et onglet caché
  (`visibilitychange`) ; au retour, poser directement l'état juste (17).
- **Pixel ratio** : `min(dpr, 2)` au repos, 1 à 1,5 en mouvement ou au
  téléphone selon la scène. Ne pas suréchantillonner un écran 1× (un
  `clamp(dpr, 1,5, 2)` dessinait en 1,5× pour rien).
- **Détecter le rendu logiciel** : `WEBGL_debug_renderer_info` +
  `/swiftshader|llvmpipe/i`, ou `failIfMajorPerformanceCaveat` (04).
- `checkShaderErrors = false` en production : trois allers-retours bloquants
  par programme (17).

## 6. Téléphone et accessibilité

- **Gyroscope iOS** : `DeviceOrientationEvent.requestPermission()` demandé
  au CLIC (bouton « Secouer » avec `aria-pressed`). Zone morte de 10°,
  secousse au-delà de 14 m/s² (17).
- **Tactile** : n'attraper un objet qu'après un glisser de plus de 6 px ;
  `touch-action: pan-y` laisse le défilement vertical au navigateur (17).
  Appui long = pincer le tissu, jamais sur un glissé ;
  `user-select: none` + `-webkit-touch-callout: none` sur le héros, sinon
  l'appui long sélectionne le titre (11). `navigator.vibrate(8)` au premier
  geste marquant (12).
- **Barre d'adresse mobile** : ignorer les changements de hauteur de moins
  de 120 px (11) ; ne reconstruire que si la LARGEUR change (07).
- **Mouvement réduit** : une seule image composée — la pile posée d'un coup,
  la simulation calculée d'un bloc, ou des images fixes.
- **Sans WebGL** : classe `sans-gl` et fond en CSS de la même composition ;
  un paramètre `?sans3d` pour le tester ; gérer la perte et le retour du
  contexte ; **sonder WebGL2 avant de charger three.js** pour ne pas remplir
  la console d'erreurs.
- **Texte lisible sur la 3D** : la scène se calme derrière les textes (11) ;
  les éléments 3D s'effacent dans la zone du texte (04, uniforme `uZone`) ;
  aucun objet animé ne passe sur le texte ni sur l'en-tête (17, 11) ; pas de
  `backdrop-filter` au-dessus d'une scène qui bouge (recalculé à chaque
  image). Le canvas reste `aria-hidden` : les vrais liens sont en HTML.
