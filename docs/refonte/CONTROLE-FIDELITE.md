# Contrôle de fidélité — votre écran contre son image

> Valable pour tous les lots. Règle des fiches : un écran est « fini » quand il est
> identique à son image **à ± 2 px**. Ce contrôle la mesure, de la même façon pour tout le monde.
> Il vient après `npm run typecheck`, `lint` et les `check:*` : il ne les remplace pas.

## Avant de commencer

- **Les images restent hors du dépôt** (il est public, les maquettes ne le sont pas). Gardez le
  dossier du lot où il est ; ci-dessous `IMAGES=<dossier>/images`, `DATA=<dossier>/_data`.
- Node 22 et Chromium sans tête (`/opt/pw-browsers/chromium`, ou `AMN_E2E_CHROMIUM=<chemin>`).
- **Aucune donnée réelle, aucun secret, aucun serveur exposé.** La capture refuse tout hôte qui n'est
  pas cette machine, et tout compte qui n'est pas en `@exemple.test`. Voir « Sûreté » plus bas.

## 1. Capturer (1440 × 900)

**A. Une page statique** : un fichier HTML ouvert directement, sans serveur ni réseau. C'est le cas
de l'aperçu d'un écran en cours de construction.

```sh
node scripts/qualite/fidelite/capturer.mjs --page mon-ecran.html --sortie /tmp/fid/H41.png
```

**B. Le build de l'app, sur données fictives.** Construisez l'édition interne en visant l'API d'essai,
puis capturez la route voulue. Aucun serveur n'écoute : les fichiers sont servis depuis le disque.

```sh
VITE_AMN_API_URL=http://127.0.0.1:4171 AMN_WEB_OUT=/tmp/fid/dist node scripts/build-web.mjs
# l'amn-api d'essai en mémoire et ses comptes factices : docs/qualite/README.md (branche T1)
AMN_E2E_EMAIL=essai.interne@exemple.test AMN_E2E_PASSWORD=… \
  node scripts/qualite/fidelite/capturer.mjs --dist /tmp/fid/dist --route '#/tasks' \
  --api http://127.0.0.1:4171 --date 2026-10-22T09:41:00 --sortie /tmp/fid/H41.png
```

Utiles : `--attendre '<sélecteur>'` (attend qu'un élément soit visible), `--pause <ms>`.
La capture écrit aussi `H41.txt`, le texte visible de la page.

Pour atteindre l'état de l'image (palette ouverte, texte saisi, carte cliquée) :

- `--etapes <fichier.json>` : des gestes joués avant la capture, par exemple
  `[{"touches":"Meta+k"},{"attendre":"[role=dialog] input"},{"saisie":"menna","delai":40},{"pause":700}]`
  (`clic`, `touches`, `saisie`, `remplir`, `attendre`, `pause`) ;
- `--stockage 'clé=valeur;;clé=valeur'` : le `localStorage` posé avant le chargement (par exemple le drapeau d'une
  nouvelle coquille éteinte par défaut) ;
- `--mac` : l'app se croit sur un Mac, donc ⌘ au lieu de `Ctrl` (les maquettes sont dessinées ainsi) ;
- `--date 2026-10-30T09:41:00` : fige l'horloge (« en retard de 12 jours », « Ven. 31 ») ;
- `--sans-connexion` : un écran d'avant la connexion (G06).

Le guide de bienvenue et l'accueil quotidien (« Bienvenue sur AMN Business », cinq secondes) masqueraient tout
dans un navigateur neuf : la capture les marque déjà vus pour le jour de l'horloge, comme le ferait quelqu'un
qui les a déjà parcourus. Un écran qui n'existe qu'en développement (`import.meta.env.DEV`, comme H43) demande un
build `NODE_ENV=development`.

**Tout un lot d'un coup** : décrivez ses écrans dans un fichier de scénarios (modèle :
`scripts/qualite/fidelite/ecrans-lot00.json`) puis

```sh
node scripts/qualite/fidelite/lot.mjs --scenarios <fichier.json> --dist <build> [--dist-dev <build-dev>] \
  --images "$IMAGES" --data "$DATA" --api http://127.0.0.1:4171 --sortie /tmp/fid
```

Un scénario peut limiter la comparaison à une zone (`"zone": [x,y,l,h]`) quand l'écran est une palette posée
sur une autre page : le pourcentage de l'écran entier n'a alors pas de sens. Les fiches des maquettes qui
supposent des données (Menna Conseil, F-2041…) se sèment avec `scripts/qualite/fidelite/graines-maquettes.mjs`.
Premier résultat : [`docs/qualite/fidelite/ECARTS-LOT-00.md`](../qualite/fidelite/ECARTS-LOT-00.md).

## 2. Comparer

```sh
node scripts/qualite/fidelite/comparer.mjs /tmp/fid/H41.png --id H41 --images "$IMAGES" \
  --textes "$DATA/H41-recherche.json" --sortie /tmp/fid
```

Exemple de rapport (sortie réelle, sur une page de connexion écrite à la hâte pour G06) :

```
G06 · 1440×900 · ±2 px, couleur ±2
À CORRIGER — 6,86 % des pixels en écart (88 884 px), 4 zones
 1. x 0–597, y 724–899 (598×176) · 49,1 % · absent de la capture
 2. x 0–335, y 0–284 (336×285) · 36,4 % · différent
 3. x 837–1202, y 426–475 (366×50) · 10,2 % · différent
 4. x 290–334, y 560–614 (45×55) · 9,33 % · différent
Textes de la maquette : 21 sur 22 retrouvés — absents : « Afficher »
Image des écarts (rouge : en trop, bleu : manquant, jaune : zones) : /tmp/fid/G06-ecarts.png
```

Avec un écran de la coquille (`--gabarit bureau`, par défaut), chaque zone est aussi située (barre
latérale, en-tête, zone principale, colonne droite, barre Ajmani), et, quand un élément n'est pas à sa
place, le rapport donne le décalage à appliquer.

Sortie `0` = **OK**, `1` = **À CORRIGER**, `2` = erreur d'usage (taille, fichier). Ouvrez `H41-ecarts.png` :
les cadres jaunes sont les zones. Les coordonnées « dans la zone principale » sont celles des
fiches et de `_data` (x = 0 au pixel 252, y = 0 au pixel 60).

## 3. Corriger, ou justifier

- **À CORRIGER** : corrigez, recapturez, recomparez. La plupart des écarts sont une marge, une taille
  de texte ou un jeton de couleur : relisez la fiche (rubriques 3 et 5) et `01-SOCLE-DESIGN.md`.
- **Une donnée d'exemple** (nom, montant, date de la maquette) ne se code jamais en dur : écartez-la
  avec `--ignorer x,y,largeur,hauteur` (pixels absolus, répétable). Le rapport la liste.
- **Impossible à reproduire** : l'écart minimal, puis une ligne dans `STATUT.md` (écran, raison, ce qui
  diffère). Ne jamais dévier en silence.
- **OK** : notez dans `STATUT.md` « fidélité OK » avec le sha du commit.

## Ce que « ± 2 px » veut dire

Un pixel de la capture est accepté s'il existe, à 2 px ou moins, un pixel de la référence de la
même couleur ; et réciproquement. Un bord ou un texte décalé de 2 px passe, de 3 px non. Un élément
absent ou en trop ne passe jamais.

| Réglage | Défaut | Pourquoi |
|---|---|---|
| position `--rayon` | 2 px | la règle des fiches |
| couleur `--couleur` | ±2 niveaux sur un aplat | les surfaces du socle diffèrent de 2 à 10 niveaux (`#0C0C0D`, `#111112`, `#131314`, `#161617`) : une mauvaise teinte doit se voir |
| bord de texte `--contour` | ±40 % du contraste local | le crénelage d'une lettre bouge de beaucoup pour un demi-pixel ; un filet faible, lui, reste surveillé |
| carré `--bloc` / `--taux` | 48 px, 2 % | un carré est en écart au-delà de 2 % de pixels refusés ; aucun carré en écart = OK |

Réglages calibrés sur trois images du lot 00 (D02, G06, H41) : un décalage de 1 ou 2 px est accepté, de 3 px
refusé ; sur G06, un aplat de teinte décalée de 3 niveaux est vu. Les huit écrans du lot ont ensuite été
capturés et comparés (résultats : `docs/qualite/fidelite/ECARTS-LOT-00.md`). Les règles sont figées par
`node tests/fidelite/comparer.test.mjs` (45 vérifications, sur des images fabriquées).

## Sûreté

- Pas de `npm start`, pas de serveur d'application, aucune donnée réelle (REGLES.md). Ici : page
  statique en `file://`, ou build servi depuis le disque par interception de Chromium.
- Toute requête vers un hôte autre que cette machine est **refusée** et comptée dans le compte rendu
  (« Réseau : … refusée(s) »). Un build qui viserait la production ne l'atteint pas.
- Le compte doit être en `@exemple.test` ; le service worker est bloqué ; les images de référence et
  les captures ne sont jamais commitées.

## Limites

- Compare **une image fixe** : pas de survol, de focus, d'animation, de défilement, ni les états
  vide, chargement, erreur (un état = une capture à part, avec son image).
- `--gabarit aucun` pour la connexion, le téléphone et la tablette (pas de coquille de bureau à nommer).
- La liste de textes est indicative : les noms et montants d'exemple sont fictifs, un libellé d'interface
  absent ne l'est pas. Elle ne remplace pas la rubrique 4 de la fiche.
- Les polices doivent être celles de l'app (Inter) : une machine sans Inter donnera des écarts de texte.
