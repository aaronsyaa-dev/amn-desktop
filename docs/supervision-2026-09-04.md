# Supervision & modules — rapport au réveil (nuit du 3 au 4 septembre 2026)

Branche `claude/first-pr-github-setup-ltpqqo` (amn-desktop) et `main` (amn-api), tout est poussé. `version` intacte (1.2.42). Aucune organisation réelle touchée : base d'essai `/tmp/e2e/amn.db`, base de volume `/tmp/e2e/volume.db`, comptes `*.essai@exemple.test`.

Blocs faits : 1, 2, 3, 4, 6, 7, 8. Bloc 5 (jetons de module) non fait, faute de temps devant les Blocs 6 à 8.

## Bloc 2 — l'audit, commité avant toute correction

`docs/audit-modules-2026-09-04.md` — 86 écrans, deux éditions, poste et téléphone, anglais. Table `| Module | Section | Édition | Verdict | Détail |`, commit `405a5b1`, avant la première correction.

| Verdict | Écrans |
|---------|--------|
| Bon | 49 |
| Ajouts nécessaires | 21 |
| À reconsidérer | 11 |
| À retravailler | 5 |

Les problèmes y sont classés par gravité (1 : chargement groupé en 400 et 69 requêtes à chaque ouverture ; 2 : écrans historiques non traduits ; 3 : supervision qui charge tout le parc, rondes site par site ; 4 : finitions). L'audit n'a trouvé aucune erreur JavaScript ni débordement horizontal sur les 86 écrans.

## Bloc 1 — la formule pilote, prouvé par capture

La formule (`business_standard` : quinze modules, deux places ; `business_premium` : tout, cinq places) est la source unique dans le dossier ; ajouts et retraits par organisation sont journalisés (`module_opened`, `module_closed`, `modules_reset`) ; « Inclus » décrit, ne verrouille pas ; les places ne descendent pas sous les comptes existants (409 `seats_below_accounts`, qui dit combien retirer) ; l'épingle est visible sur téléphone même quand rien n'est épinglé.

Captures : `01-module-ajoute.jpg`, `02-module-retire.jpg`, `03-places-plancher.jpg`, `04-telephone-epingle-visible.jpg`, `05-telephone-barre-epinglee.jpg` (dossier `docs/captures/supervision-2026-09-04/`). Tests : `amn-api/test/formules.test.js` (6).

## Bloc 3 — corrigé, et ce qui reste

Corrigé, dans l'ordre des gravités :
- **Chargement groupé** : le poste découpe par lots de cinquante, le serveur accepte toute la liste connue. Plus de 400, plus de 69 allers-retours (`4b17514`, `afb5e61`).
- **Écrans historiques en anglais** : 285 textes passés par i18n, titres et surtitres compris, sur quatorze écrans (`c1841b3`, capture `06-anglais-*.jpg`).
- **Cartes claires** (quoi / pour qui / exemple) pour chaque module, dans Bibliothèque et Découvrir (`07-decouvrir-cartes.jpg`) ; cartes internes séparées de l'édition Business (`@edition/cartes`, garde de pureté).
- **Présentation à la première ouverture**, en place, fermable, non bloquante, mémorisée par personne (`08-premiere-ouverture.jpg`).
- **Renommages** : « Pipeline » → « Prospects », « Nomenclatures » → « Composition & coût de revient » (catalogue serveur et desktop).
- **Alléger / rajouter ma barre**, par personne, mémorisé côté serveur (`nav-alleges`) et suivi en direct sur poste et téléphone (`09-alleger-ma-barre.jpg`, `10-telephone-barre-allegee.jpg`).

Reste :
- Anglais encore partiel dans les sous-sections de Réglages, les textes des profils de calcul et une variante de la Médiathèque.
- Les **fusions « À reconsidérer »** (Tableau des projets / Projets, Relances / Facturation, la section Personnel, Messages / Groupes, Trombinoscope / Membres, Notes / Pages / Connaissances) sont des décisions de produit : posées dans l'audit, pas tranchées.
- Finitions de gravité 4 (un mot en dur dans Calculateurs, étiquettes doublées des données d'essai).

## Blocs 4 et 6 — la supervision à l'échelle, mesurée

Ce qui a été réellement testé : une base d'essai de **100 000 organisations, 100 000 sites, 300 000 incidents, 600 000 événements** (`amn-api/scripts/volume-seed.mjs`), mesurée par `volume-measure*.mjs`, sur SQLite. Postgres n'a été exercé que pour la parité du schéma (`check:postgres`, vert à chaque envoi).

| Mesure | Avant | Après |
|--------|-------|-------|
| Liste des organisations (registre, rail, Vue d'ensemble…) | 1,5–2,6 s, 48 Mo | page de 50 : 3 ms (page 402 : 2 ms) |
| Recherche dans le parc | — | 28 ms |
| Résumé agrégé du parc | — | 98 ms |
| Ronde de battement de cœur (90 909 sites qui basculent) | 4,4 s, une requête par site | 460 ms, une instruction |
| File des incidents du parc (31 198 ouverts) | — | 65 ms la page (page 202 : 56 ms) |
| Résumé SOC | — | 295 ms |
| Santé du serveur, rondes actives | dépassement de 10 s | 2 ms en moyenne, 35 ms au pire sur 70 s |

À l'écran (captures 11 à 15) : registre à 100 000 organisations, premières lignes en 3,3 s, recherche 321 ms, filtres (statut, formule, secteur, langue, étiquette, activité, incidents), sélection et gestes groupés (suspendre, réactiver, ouvrir/fermer un module, étiqueter, annoncer — 500 par appel, confirmation, journal « (groupé) »), dossier d'une organisation, et la file du parc sur l'écran de supervision (122 ms). Le consentement de la cliente (verrous par module) est respecté par la session de support et journalisé des deux côtés ; le compte reste administrable.

Ce qui ne tient pas encore au million, dit franchement : les rondes de disponibilité et de SSL avancent par lots de 200 sites par tour (à un million de sites, un cycle est long : il faudra de la concurrence ou un second processus) ; l'escalade traite 50 incidents par minute ; le relevé `/insights` est borné aux 200 organisations les plus actives ; le verrou « compter puis écrire » est un verrou de processus (une seule instance d'API).

## Bloc 7 — casser exprès

`docs/casser-2026-09-04.md`. Huit cassures trouvées et fermées, chacune avec un garde : nom d'organisation et identifiant sans borne (serveur), course sur les places (cinq comptes créés pour une place libre), phrase perdue au rechargement pendant la frappe, deux postes qui divergent sur une note, téléphone qui pose trois mille cartes, raccourcis vers des modules fermés en session de support, garde `check:resilience` rouge depuis le 2 septembre. Ce qui n'a pas cédé est listé : injection, HTML, emoji, droits croisés, curseurs et lots en vrac, mot de passe d'un mégaoctet, force brute, API tuée puis revenue (captures 16 à 21). Limite importante : le serveur freine les écritures à 600 par minute et par personne ; une reprise de données volumineuse passera par un import serveur, à écrire.

## Bloc 8 — conformité

`docs/conformite-2026-09-04.md`. Inventaire technique : ce que le code stocke (table par table, avec durées), ce qui est en place et prouvé, ce qui manque. Le document dit qu'il n'est pas un avis juridique et n'invente aucun texte engageant : le seul texte légal du produit est le gabarit de `WelcomeScreen`, marqué comme tel. Les points les plus lourds pour un juriste : aucune durée de conservation (événements du tracker avec données de visiteurs, compteurs de freinage par IP, journal), aucune mention sur les pages publiques qui collectent nom, email et téléphone, le tracker et le scanner sans cadre d'accord, l'acceptation de la politique non horodatée.

## Gardes

Desktop : tous les `check:*` verts (44), y compris `check:modules`, `check:persistence`, `check:langue`, `check:business`, `check:resilience` (remis au vert cette nuit) ; seuls `check:deployed` (demande une URL) et `check:installer` (Windows) ne s'appliquent pas ici. Typecheck des deux éditions vert. amn-api : 420 tests verts, `check:postgres` vert avant chaque envoi.

## Ce qu'Aaron doit faire

1. **Déployer amn-api** (Render) : la branche `main` porte les migrations additives (colonnes `modules_added/removed`, `last_activity_at` avec son rattrapage au premier démarrage, tables `user_prefs`, `organization_tags`, `org_module_locks`, index SOC). Elles se rejouent sans rien casser (`check:postgres`). Tant que Render est sur l'ancien commit, le desktop de cette branche ouvrira le parc en repli (listes complètes) et les nouveaux gestes répondront 404.
2. **Fusionner** `claude/first-pr-github-setup-ltpqqo` dans la branche principale d'amn-desktop, puis reconstruire les deux éditions.
3. **Décider** les fusions « À reconsidérer » de l'audit, et le sort des modules qui ne sont qu'une vue d'un autre.
4. **Remplacer le gabarit** de politique d'utilisation et compléter les `[À COMPLÉTER — AARON]` du document de conformité (régions d'hébergement, sauvegardes, journaux de l'hébergeur), puis faire relire par un professionnel du droit.
5. **Trancher** les durées de conservation ; la purge se code ensuite en une ronde.
6. Bloc 5 (jetons de module) reste à faire.
