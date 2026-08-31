# Les sondes — la boucle visuelle, à la main

Ce ne sont **pas des gardes** : rien ici ne tourne en CI, rien ne bloque un
build. Ce sont les scripts de la *boucle visuelle* — ouvrir un vrai
navigateur sur un vrai build, dérouler un vrai parcours, produire des
captures qu'on regarde. Les gardes automatiques (`npm run gardes`,
`check:*`) prouvent des règles ; les sondes montrent des écrans.

## Le décor attendu

- amn-api sur `127.0.0.1:4171` (SQLite d'essai, jamais de production) ;
- le build à sonder servi sur `127.0.0.1:4180` (`npx serve -s dist -l 4180`) ;
- des comptes d'ESSAI uniquement — ceux du décor `/tmp/e2e`, rien de réel.

Chaque sonde se lance avec `node scripts/sondes/<nom>.mjs`, certaines
paramétrées par variables d'environnement (voir leur en-tête). Les captures
partent dans `/tmp/e2e/`.

## Ce qu'elles couvrent

| Sonde | Ce qu'elle déroule |
| --- | --- |
| `mobile.mjs` | chaque écran au format téléphone (390 × 844, tactile) |
| `rouge.mjs` | les écrans du rationnement du rouge (docs/ROUGE.md) |
| `langue-en.mjs` | connexion, rideau, relève et réglages en anglais |
| `langue-reglages.mjs` | la section Langue et la bascule en direct |
| `atelier-langue.mjs` | le sélecteur de langue de l'atelier |
| `atelier-creation.mjs` | la création complète d'une organisation d'essai |
| `poste-vierge.mjs` | un poste sans choix personnel suit la langue de l'organisation |
| `incident-cycle.mjs` | prise puis clôture d'un incident, compteurs à l'appui |
| `parcours-interne.mjs` | tour, organisations, supervision, bascule d'org, salle |
| `parcours-cliente.mjs` | créer une fiche, une tâche, une note — et survivre au rechargement |
