# Atelier de modules (F1)

Un bac à sable où naissent des modules pour petite entreprise, **avant** que
Harun ne choisisse lesquels entrent dans l'application. Rien n'y est branché :
ni au rail, ni aux routes, ni au registre de S1. L'édition cliente n'en voit
pas un octet.

- [`BACKLOG.md`](BACKLOG.md) : les idées, classées, avec le manque qu'elles comblent.
- [`PRET.md`](PRET.md) : la note de chaque module et son statut.
- `modules/<id>.md` : la spec courte de chaque module.
- `apercus/<id>.html` : l'aperçu autonome, généré depuis le vrai écran. Il
  s'ouvre seul dans un navigateur, hors ligne (bouton FR / EN en haut à droite).

## Un module

```
src/ateliers/<id>/
  module.ts    le manifeste, au format du registre de S1 + `niveau`
  logique.ts   les calculs, purs (argent en centimes, dates AAAA-MM-JJ)
  donnees.ts   les données fictives du bac à sable
  i18n.ts      les textes, anglais = schéma, français typé contre lui
  Ecran.tsx    l'écran, dans `CadreAtelier`, avec les briques du socle
  tests.ts     `TESTS`, lancés par le vérificateur
```

`src/ateliers/_commun/` : le manifeste, le cadre d'écran, les nombres, les
textes, le banc d'essai. Un module n'importe que `_commun`, le socle,
`src/i18n` (la langue active), React, lucide-react et framer-motion. Jamais un
autre module : chacun se supprime en effaçant son dossier, sa spec, son
aperçu et sa ligne de `PRET.md`.

## Commandes

```
node src/ateliers/verifier.mjs            # tous les modules
node src/ateliers/verifier.mjs metre      # un seul
node src/ateliers/apercu.mjs metre        # régénère docs/atelier/apercus/metre.html
node src/ateliers/capture.mjs metre       # photo de l'aperçu (Chromium local, aucun serveur)
```

Le vérificateur tient, pour chaque module : les pièces présentes, le manifeste
confronté au registre de S1 (famille, action de la famille, id et route
libres), les mêmes clés de texte en fr et en en, les tests, le rendu de
l'écran en fr et en en (cadre, un seul bouton blanc plein, aucun `undefined`
ni `NaN` affiché), les imports permis, ni réseau ni stockage, aucune couleur
en dur, aucun émoji, l'aperçu sans ressource du réseau, et l'isolement (rien
hors de `src/ateliers/` n'importe l'atelier).

Les `.mjs` ne sont pas dans `package.json` : l'atelier reste hors des gardes
communes tant qu'il n'est pas choisi. Ils sont lancés à la main.

## Design

Noir et gris, Inter, un seul bouton blanc plein (`variante="primaire"`) par
écran, la couleur de la famille en petit point de 8 px, aucun personnage.
L'écran utilise les jetons du socle (`socle-*`, `etat-*`, `--fam`) : quand S2
activera le fond noir et gris dans l'application, l'atelier suivra sans
retouche. L'aperçu pose déjà ce noir et gris par-dessus les jetons.

## Intégrer un module choisi

1. Recopier la ligne du manifeste dans `REGISTRE` (sans `nom` ni `pourQui`,
   `niveau` à ajouter au type si S1 l'accepte).
2. Déclarer le module dans `src/edition/modules.internal.ts` et sa route dans
   `src/edition/appRoot.internal.tsx` (édition interne seulement).
3. Remplacer l'état local du bac à sable par une collection (`useCollection`),
   isolée par organisation.
4. Importer Inter dans l'application (le cadre l'importe déjà, depuis
   `@fontsource/inter`, déjà installé).
