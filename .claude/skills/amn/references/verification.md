# Vérifier une page 3D — voir ce qu'on prétend mesurer

Une page 3D peut être superbe sur l'écran de celui qui l'a faite et **vide
chez tout le monde** : un module refusé par la CSP, une texture en `blob:`,
un canvas resté noir, un shader qui ne compile pas sur un GPU logiciel. Rien
de tout ça ne se voit sans la regarder dans les conditions réelles.

## Le vérificateur — `scripts/verifier-propositions.js`

```bash
node scripts/verifier-propositions.js --only=NN-nom                    # rapide
node scripts/verifier-propositions.js --only=NN-nom --pleine --pleine-dans=/tmp/cap-NN
node AMN-SITE-WEB/scratchpad/verif-allegations.js                      # mots interdits
```

Pour chaque page, servie avec **les vrais en-têtes de `vercel.json`** :

- bureau 1440 × 900, téléphone 390 × 844, et **mouvement réduit** ;
- échec sur : erreur de page ou de console, violation de CSP, fichier 404,
  requête externe, débordement horizontal, `noindex` absent ;
- **canvas vide** : on masque tout sauf le canvas
  (`body *{visibility:hidden!important} canvas{visibility:visible!important}`)
  puis on mesure l'**écart-type des pixels de la capture**. Sous 2,5 → vide ;
- poids du premier affichage (non compressé) : avertissement à **4,5 Mo**,
  échec à **9 Mo**. three.js seul pèse ~0,8 Mo ;
- écrit `propositions/_captures/<nom>-bureau.jpg` / `-mobile.jpg`, et avec
  `--pleine` des captures pleine page.

⚠️ **Le premier contrôle « canvas vide » ne mordait pas** : il mesurait la
capture entière, et le texte posé par-dessus le canvas suffisait à faire
passer un canvas noir pour plein. D'où l'isolement du canvas avant la mesure
— vérifié par injection (un canvas volontairement vide fait bien échouer).

⚠️ Une vérification qui passe **ne dit pas que c'est beau**. Elle dit que
c'est là. Il faut ensuite **REGARDER les captures** (outil Read) : section
vide, texte illisible sur la 3D, mise en page cassée à 390 px — c'est à l'œil
que ça se voit.

## Le navigateur de test

```js
chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
```

- WebGL rendu **en logiciel (SwiftShader)** : lent mais fidèle. Une scène à
  2 images/s ici sera lourde sur un vieux téléphone → alléger, pas ignorer.
- Ce Chromium **ne décode pas le H.264** (voir CLAUDE.md) : une vidéo `.mp4`
  saine y échoue.
- playwright **1.56.0** va avec `chromium-1194` ; une autre version casse tout.

## Les pièges des captures

- **Canvas en `position: fixed`** : une capture pleine page ne le montre
  qu'en haut ; en dessous, fond uni. Ce n'est pas un défaut de la page. Pour
  juger la 3D d'une section, faire défiler puis capturer l'écran.
- **Au-delà de 8 192 px de haut**, la capture pleine page de Chromium
  **répète le haut de la page**. Compacter la page ou capturer par tranches.
- **Attendre** : après un défilement, une scène qui s'affine progressivement
  n'est pas finie à 2,6 s, elle l'est à 7 s. Une capture trop tôt montre un
  état intermédiaire (moiré, flou) — le noter comme défaut seulement s'il
  dure aussi sur un vrai GPU, mais il EXISTE pendant le défilement.
- **Le drapé et la physique bougent** entre deux captures : comparer deux
  réglages de lumière sur des images prises à des instants différents ne
  prouve rien. Figer le temps (un paramètre `?essai`, une graine fixe) pour
  comparer.
- **Poids variable d'un passage à l'autre** (jusqu'à ×2 sur téléphone) quand
  le chargement dépend du temps écoulé : lire la tendance sur plusieurs
  passages avant de conclure.
- Deux agents qui partagent un dossier de captures **s'écrasent leurs
  scripts** : un dossier et un port par agent.

## Mesurer avant d'affirmer

- Contraste : lire la valeur des pixels (un dessus de socle à 254/255 est
  brûlé ; ramené à 237 il se lit comme du plâtre).
- Superposition : mesurer la part visible de chaque lettre seule puis parmi
  les autres (`17-typo-cinetique`, hook `?essai`) — « 96,3 % visible au pire »
  vaut mieux que « ça a l'air bien ».
- Position d'un élément animé par GSAP : `gsap.getProperty(el, 'y')` et
  `getComputedStyle(el).transform`, pas l'impression visuelle.
