# check:migration — aucune donnée ne se perd à la mise à jour

**Pourquoi.** Le 4 septembre 2026, la version 1.2.44 a fait disparaître les logos des organisations de l'écran. La base les avait toujours : la page du parc, nouvelle, ne portait pas le logo et le poste le mettait à `null` (`src/lib/parcEchantillon.ts`). Aucun test ne comparait ce que la version précédente possédait à ce que la candidate montre. Ce garde le fait, à chaque publication, et la publication attend son verdict (`release.yml`, travail `migration`, `needs`).

**Ce qu'il rejoue** (`scripts/check-migration.mjs`) :

1. La version précédente d'amn-api (celle de `main` à la date du dernier tag `v*` publié) écrit un **jeu de données complet** dans une base neuve : deux organisations (logo, accent, places, ajustements de modules, étiquettes, verrous de consentement, comptes de chaque rôle, préférences), un enregistrement riche et un enregistrement supprimé dans **chaque collection que cette version connaît** (la liste est lue dans son code : 69 aujourd'hui), sites, événements, incident, étouffoir, fenêtre de maintenance, scan, abonnement push, invitation, lien de bienvenue, journal (`scripts/migration/jeu-complet.mjs`).
2. La base est relevée table par table, ligne par ligne (`scripts/migration/dump-sqlite.mjs`).
3. L'amn-api **candidat** démarre sur cette base, ses migrations s'appliquent, la base est relevée à nouveau : chaque ligne d'hier doit être là, chaque valeur non nulle identique (une valeur nulle peut être remplie par un rattrapage, jamais l'inverse ; tables et colonnes nouvelles libres).
4. Le desktop **candidat** (build web, édition interne) est construit contre cet amn-api et ouvert dans un navigateur réel (`scripts/migration/contrat-poste.mjs`) : connexion, logos dans le rail, chaque organisation dans le registre avec ses étiquettes, son dossier (places, logo affiché, geste « Changer le logo »), puis, en session de support chez la première, **chaque enregistrement vivant de chaque collection** dans le miroir de synchronisation du poste, champ par champ. Les collections des modules que la cliente a fermés au prestataire sont sautées ici : c'est le consentement qui marche, et la base migrée les couvre.
5. L'identité de l'application (`name`, `appId`, `productName`) n'a pas bougé depuis la version précédente : elle décide du dossier de données utilisateur, et un dossier qui change est une perte qui ne dit pas son nom.

**La preuve qu'il refuse une perte** : `--mutation=poste` remet les logos à `null` dans une copie du candidat (la régression d'origine), `--mutation=serveur` efface la colonne des logos à la migration ; le garde doit échouer dans les deux cas, et la CI le vérifie à chaque publication.

**Le lancer** :

```
AMN_API_DIR=../amn-api npm run check:migration
npm run check:migration -- --mutation=poste
npm run check:migration -- --mutation=serveur
```

Variables : `MIGRATION_PRECEDENT` (tag desktop de référence), `MIGRATION_API_PRECEDENT` (commit amn-api de référence), `MIGRATION_CAPTURES` (dossier des captures), `CHROMIUM` (exécutable, sinon `/opt/pw-browsers/chromium`).

**Ce qu'il ne rejoue pas, et le dit** : le dossier de données utilisateur d'Electron (coffre-fort local, cache) — la version précédente de l'application de bureau n'est pas lancée ; l'identité stable (5) en est la garde. Postgres n'est pas exercé ici : `check:postgres` (amn-api) rejoue le schéma d'hier vers aujourd'hui sur un vrai Postgres.
