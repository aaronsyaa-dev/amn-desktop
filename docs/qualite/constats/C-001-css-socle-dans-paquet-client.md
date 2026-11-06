# C-001 — Le CSS du socle part dans le paquet client

- Gravité : **Mineur** (aucun effet visible prouvé, mais le paquet client n'est plus identique)
- Branche : `claude/refonte-vivante` @ `f0b8f12` (origine : S0, `src/index.css`)
- Responsable proposé : CO (fichier sensible `src/index.css`, ajouts seulement)
- État : ouvert

## Constat

Le paquet de l'édition cliente (AMN Desktop) construit depuis `refonte-vivante`
diffère de celui de `main`. Le JavaScript ne change que par deux coutures vides
(attendu), mais la feuille CSS grossit de 13 Ko : 96 sélecteurs ajoutés, tous
issus du socle et de la refonte.

## Preuve

Builds faits avec les mêmes variables (`VITE_AMN_API_URL=http://127.0.0.1:4171 AMN_EDITION=business`),
le build est déterministe (deux builds de `refonte-vivante` : même empreinte).

```
$ node scripts/qualite/comparer-paquet-client.mjs dist-cliente-main dist-cliente
## JavaScript (noms minifiés masqués)
- index-AmLhifhp.js → index-Dx_zyjq-.js : 8 ligne(s) ajoutée(s), 2 retirée(s)
    + function ι ( { children : ι } ) { return ι ; }      ← jumeau .business vide (SettingsScreen)
    + function ι ( ) { return null ; }                     ← jumeau .business vide (SettingsScreen)
    + … render ( … children : ι . ι ( ι , { children : … } ) … )   ← une enveloppe vide de plus (renderer.tsx)
## CSS (sélecteurs)
- 96 sélecteur(s) ajouté(s), 1 retiré(s)
    + .bg-socle-surface { … } .text-socle-texte { … } .border-[var(--fam-bord)] { … } …
    + [data-famille=jour] { --fam: … }  … [data-famille=outils] { --fam: … }
    + :root[data-mouvement=reduit] * { … }  :root[data-mouvement=aucun] * { … }
## Mots interdits dans « après »
- aucun (« ajmani », « src/socle », « src/refonte », « refonte », « emettreMoment », …)
```

Taille : `index-Don4G_Kq.css` 205 916 o (main) → `index-g3xtXunz.css` 218 987 o.
Le « retiré » est un regroupement de sélecteurs (`.accent-[var(--color-accent)]`), pas une perte de règle.

## Effet réel côté cliente : nul aujourd'hui

- `data-mouvement` n'est posé que par `src/edition/socle.internal.tsx:30` : côté cliente, ces règles ne s'appliquent jamais.
- `[data-famille=…]` s'applique bien aux tuiles du rail partagé (`BarreRail.tsx:707` pose `data-famille`), mais ne fait que définir `--fam*`, que rien ne lit hors `src/socle` et `src/refonte` (vérifié par `grep -rn "var(--fam" src`).
- Les classes `socle-*`, `fam-*`, `etat-*` ne sont employées que par du code interne.

Donc inerte, comme le dit le commentaire de S0 dans `src/index.css`. Le risque
est pour la suite : une règle globale ajoutée dans ce bloc (par exemple un
sélecteur sans `data-*`) partirait chez les clientes sans qu'aucune garde ne le
voie, puisque `check:business` ne cherche que des mots.

## Correctif proposé

1. Sortir le bloc socle de `src/index.css` vers `src/socle/socle.css`, importé
   seulement par `src/edition/socle.internal.tsx` (le jumeau `.business` ne
   l'importe pas). Dans `src/index.css`, exclure les sources internes du scan
   Tailwind : `@source not "./socle";` et `@source not "./refonte";`.
   À vérifier : que `src/socle/socle.css` génère bien ses utilitaires
   (`@import "tailwindcss/theme" layer(theme); @theme {…}; @source "./"; @source "../refonte"; @import "tailwindcss/utilities" layer(utilities);`).
2. Ou, a minima, ajouter à la CI `comparer-paquet-client.mjs` entre `main` et
   la branche, et accepter explicitement la liste des sélecteurs ajoutés.
