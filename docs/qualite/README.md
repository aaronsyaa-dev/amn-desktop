# Qualité et tests (T1)

Tenu par la session T1. Zone : `tests/**`, `scripts/qualite/**`, `docs/qualite/**`.
T1 ne corrige pas le code des autres sessions : chaque défaut devient un
constat dans [`constats/`](constats/), avec preuve et correctif proposé.

- Tableau de santé : [`SANTE.md`](SANTE.md), mis à jour à chaque passage.
- Constats : [`constats/`](constats/), un fichier par constat (`C-NNN-…md`).
- Proposition de CI pour les gardes navigateur : [`proposition-ci.md`](proposition-ci.md).

## Lancer les gardes navigateur ici (bac à sable)

Aucune donnée réelle, aucun secret : amn-api tourne en mémoire, les comptes
sont en `@exemple.test`, les données viennent de `scripts/seed-essai.mjs`.

```sh
# 1. amn-api à côté (lecture seule) : ../amn-api, ou AMN_API_ROOT=<chemin>
# 2. dépendances
npm ci --ignore-scripts && npm rebuild esbuild
(cd ../amn-api && npm ci --ignore-scripts && npm rebuild better-sqlite3)

# 3. les deux bundles, pointés sur l'amn-api d'essai
VITE_AMN_API_URL=http://127.0.0.1:4171 AMN_WEB_OUT=/tmp/dist-interne node scripts/build-web.mjs
VITE_AMN_API_URL=http://127.0.0.1:4171 AMN_EDITION=business AMN_WEB_OUT=/tmp/dist-cliente node scripts/build-web.mjs

# 4. toutes les gardes, sur les deux éditions (≈ 20 à 40 min)
AMN_API_ROOT=../amn-api node scripts/qualite/gardes-bac-a-sable.mjs \
  --cliente /tmp/dist-cliente --interne /tmp/dist-interne --sortie /tmp/resultats
# une partie seulement : --seulement mouvement,contraste
```

Chromium est pris dans `/opt/pw-browsers/chromium` (préinstallé dans le
conteneur ; ailleurs, `AMN_E2E_CHROMIUM=<chemin>`).

## Non-régression de l'édition cliente

```sh
# build de référence (main) et build candidat, mêmes variables
node scripts/qualite/comparer-paquet-client.mjs <dist-cliente-main> <dist-cliente-candidat> --rapport rapport.md
```

Sortie 0 : seuls les noms minifiés diffèrent. 3 : du code ou du CSS a changé
(le rapport dit quoi). 1 : un mot interdit (« Ajmani », `refonte`, `src/socle`…)
est dans le paquet.
