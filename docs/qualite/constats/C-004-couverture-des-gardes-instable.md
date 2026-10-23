# C-004 — La couverture des gardes navigateur change d'un passage à l'autre

- Gravité : **Majeur** (un « vert » peut ne rien avoir regardé)
- Où : `scripts/check-{cibles,contraste,largeur,mouvement,focus,etiquettes}.mjs` et `scripts/lib/vues-detail.mjs` (découverte des écrans)
- Branches : `main` et `claude/refonte-vivante` (le défaut est dans les gardes, pas dans le produit)
- État : ouvert. Contournement dans le bac à sable de T1 ; correctif proposé ci-dessous

## Constat

Chaque garde découvre ses écrans en lisant, juste après la connexion, les liens de la
navigation (`a[href^="#/"]`, affiché « amorce : N route(s) »). Si l'interface n'a pas fini
de se monter à ce moment-là, N est faible et la garde ne parcourt presque rien, **puis
conclut « OK »**.

## Preuve

Même édition, même code (l'édition cliente n'est pas modifiée par la refonte), deux passages
complets le même jour, mêmes comptes factices, machine à 4 cœurs :

| Garde | Édition | Passage 1 (`62de06b`) | Passage 2 (`f059f32`) |
|---|---|---|---|
| `largeur` | cliente | amorce **11**, « OK — 11 écrans » | amorce **118**, 136 écrans mesurés, **rouge** |
| `contraste` | cliente | amorce 118, 135 écrans | amorce **25**, 90 écrans |
| `cibles` | interne | amorce **24** (+ « aucune vue de détail ») | amorce 143 |

Le vert de `largeur` cliente du passage 1 reposait sur 11 écrans sur 118. Le même contrôle,
mieux servi, trouve 9 écrans coupés à 390 px. Ce n'est pas une régression de la refonte : c'est
une mesure qui n'avait pas eu lieu.

## Cause probable (non démontrée)

Les gardes attendent un délai fixe (2 à 2,5 s) après la connexion, puis lisent les liens.
Quand le rail, les données synchronisées ou le processeur sont lents, la liste est incomplète.
Preuve indirecte : les variations tombent sur des passages où la machine faisait autre chose
en parallèle (builds), et disparaissent quand elle est libre.

## Correctif proposé

1. Dans `scripts/lib/vues-detail.mjs` (`parcourirEcrans`), remplacer l'attente fixe par une
   attente de **stabilité** : relire le nombre de liens toutes les 500 ms et ne continuer que
   quand il est identique deux fois de suite (plafond 15 s).
2. Faire échouer la garde — pas passer — si l'amorce est sous un plancher écrit en clair
   (par exemple 80 routes côté cliente), avec un message qui le dit.

## Contournement actuel (bac à sable de T1)

`scripts/qualite/gardes-bac-a-sable.mjs` lit « amorce : N », relance la garde (3 essais au plus)
si N est sous 85 % de la valeur attendue (`docs/qualite/amorce-attendue.json` : 118 côté cliente,
143 côté interne), et la classe « non concluant » si elle reste basse. Les gardes qui
n'impriment pas d'amorce (`signal`, `mobile`, `coquille`, `isolation`, `etiquettes`, `focus`)
ne sont pas protégées : leur couverture est lue à la main.
