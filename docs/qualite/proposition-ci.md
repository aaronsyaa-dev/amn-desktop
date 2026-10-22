# Proposition : les gardes navigateur en CI

Statut : **proposition** (T1 ne touche pas `.github/workflows/` ; à reprendre par le CO).

## Ce qui bloque aujourd'hui

1. Les gardes navigateur veulent une amn-api : en CI, elle vient du dépôt
   `aaronsyaa-dev/amn-api`, qui demande le secret `AMN_API_TOKEN`. Ce secret est
   refusé (*Bad credentials*, voir `docs/refonte/STATUT.md`). **Sans un jeton
   valide, rien de ce qui suit ne peut tourner.**
2. Plus aucun autre blocage : `scripts/qualite/api-essai.mjs` démarre amn-api en
   mémoire avec deux comptes `@exemple.test`, `scripts/qualite/gardes-bac-a-sable.mjs`
   peuple, sert et lance tout. Prouvé dans le conteneur du 2026-10-22 (voir `SANTE.md`).

## Tâche proposée pour `editions.yml`

Durée mesurée ici : environ 20 à 40 minutes pour les deux éditions. À lancer
sur `push` vers `claude/refonte-vivante` et sur PR vers `main`, pas sur chaque
push de session.

```yaml
  gardes_navigateur:
    name: Gardes navigateur (bac à sable)
    runs-on: ubuntu-latest
    timeout-minutes: 60
    if: github.ref == 'refs/heads/claude/refonte-vivante' || github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with:
          repository: aaronsyaa-dev/amn-api
          path: serveur
          token: ${{ secrets.AMN_API_TOKEN }}
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm ci
        working-directory: serveur
      - run: npx playwright-core install --with-deps chromium
      - name: Builds pointés sur l'amn-api d'essai
        env: { VITE_AMN_API_URL: 'http://127.0.0.1:4171' }
        run: |
          AMN_WEB_OUT=$RUNNER_TEMP/dist-interne node scripts/build-web.mjs
          AMN_EDITION=business AMN_WEB_OUT=$RUNNER_TEMP/dist-cliente node scripts/build-web.mjs
      - name: Gardes
        env: { AMN_API_ROOT: '${{ github.workspace }}/serveur' }
        run: |
          export AMN_E2E_CHROMIUM=$(node -e "console.log(require('playwright-core').chromium.executablePath())")
          export AMN_CHROMIUM=$AMN_E2E_CHROMIUM
          node scripts/qualite/gardes-bac-a-sable.mjs \
            --cliente $RUNNER_TEMP/dist-cliente --interne $RUNNER_TEMP/dist-interne \
            --sortie $RUNNER_TEMP/resultats
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: gardes-navigateur, path: '${{ runner.temp }}/resultats' }
```

Et, dans la tâche `business` existante, la non-régression du paquet client :

```yaml
      - name: Paquet client identique à main (hors noms minifiés)
        run: |
          git fetch origin main --depth=1
          git worktree add $RUNNER_TEMP/main origin/main
          (cd $RUNNER_TEMP/main && npm ci && AMN_EDITION=business AMN_WEB_OUT=$RUNNER_TEMP/dist-main node scripts/build-web.mjs)
          node scripts/qualite/comparer-paquet-client.mjs $RUNNER_TEMP/dist-main dist --rapport $RUNNER_TEMP/paquet.md
```

`comparer-paquet-client.mjs` sort en 3 tant que C-001 est ouvert : à mettre en
`continue-on-error: true` jusqu'à sa résolution, ou à faire échouer seulement
sur la sortie 1 (mot interdit).

## Points à trancher (CO)

- `check:coquille` interne est attendu rouge depuis S1 (`STATUT.md`) : l'exclure
  de la tâche, ou l'adapter d'abord.
- Le limiteur d'amn-api renvoie 429 pendant le peuplement (3 réponses de
  formulaire perdues sur 637) : sans effet sur les gardes, mais un réglage
  `NODE_ENV=test` sans limiteur serait plus propre côté amn-api.
