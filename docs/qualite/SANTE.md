# Tableau de santé — refonte vivante

> Tenu par T1, mis à jour à chaque passage. Comment relancer : [`README.md`](README.md).
> Bac à sable : amn-api en mémoire, comptes `@exemple.test`, données factices (`seed-essai.mjs`). Aucune donnée réelle, aucun secret.

- **Passage 1 — 2026-10-23.**
- Pointe testée : `claude/refonte-vivante` @ `f059f32` (S0, S1, S2, S3, S5 fusionnées). Référence : `main` @ `630ef45`.
- Machine : 4 cœurs, Chromium 1194 (Playwright), Node 22.22. Une garde à la fois.

## En bref

- **Édition cliente : rien n'a bougé dans ce que les gardes mesurent.** Sur les 6 gardes qui échouent aujourd'hui, `main` et la pointe donnent exactement les mêmes défauts (0 nouveau, 0 disparu). Le paquet web ne contient aucun mot interdit (« Ajmani », `refonte`, `src/socle`…). Il grossit quand même de 15 Ko de CSS inerte (C-001).
- **Une régression de la refonte, côté interne : `check:coquille`**, verte sur `main`, rouge sur la pointe (6 écrans sans colonne de navigation « coquille »). STATUT l'annonçait depuis S1.
- **Les modules de F1 ne sont pas intégrables tant que leur vérificateur casse sur la pointe** (C-003, patch validé). Leur logique d'argent est exacte (139 671 vérifications, 0 défaut).
- **Les gardes navigateur elles-mêmes sont peu fiables** : elles étaient aveuglées par la fenêtre de bienvenue (C-002) et leur couverture varie d'un passage à l'autre (C-004). Les résultats ci-dessous sont obtenus avec les deux contournements du bac à sable.

## Gardes sans navigateur

| Ensemble | Pointe `f059f32` |
|---|---|
| `typecheck`, `typecheck:business`, `lint` | ✓ ✓ ✓ |
| 43 `check:*` de `editions.yml` (dont les 5 contrôles croisés poste ↔ serveur, avec amn-api cloné à côté) | ✓ 43/43 |
| Fusion simulée F1 + pointe : mêmes gardes | ✓ (hors vérificateur de F1, voir C-003) |

La CI GitHub n'a pas été relue par T1. Selon STATUT, « Garde-fous croisés » y échoue pour une raison extérieure au code (secret `AMN_API_TOKEN` refusé) ; ici, ces 5 contrôles passent.

## Gardes navigateur — jamais exécutées avant ce passage

« Amorce » = nombre de routes découvertes par la garde (cliente 118, interne 142-143 attendues). Les défauts sont comptés tels que les garde les rend.

| Garde | Édition | `main` | Pointe | Ce que c'est |
|---|---|---|---|---|
| `business` (paquet client) | cliente | ✓ | ✓ | 28 motifs interdits absents, 3 marqueurs présents |
| `isolation` | cliente / interne | ✓ / ✓ | ✓ / ✓ | aucune donnée d'une organisation chez l'autre |
| `mouvement` | cliente / interne | ✓ / ✓ | ✓ / ✓ | 535 et 394 déplacements, aucun en mouvement réduit |
| `contraste` | cliente / interne | ✓ / ✓ | ✓ / ✓ | 135 et 190 écrans, 22 672 et 27 254 textes, aucun sous WCAG AA |
| `mobile` | cliente / interne | non mesuré | ✓ / ✓ | un objet ambre au plus, navigation du téléphone |
| `coquille` | cliente / interne | ✓ / ✓ | ✓ / **✗** | interne : 6 écrans sur 23 « aucune coquille rendue » — **régression de la refonte** (rail masqué sur bureau depuis S1) |
| `focus` | cliente / interne | ✗ 5 / ✗ 8 | ✗ 5 / ✗ 8 | fenêtres qui s'ouvrent sans prendre le focus. Cliente identique. Interne : 1 nouveau (`/garde/organigramme`, « Ouvrir la conversation »), 1 disparu |
| `cibles` | cliente / interne | ✗ 9 familles / ✗ 12 | ✗ 9 / ✗ 13 | cibles tactiles trop serrées. Interne : nouveau `#/tous-les-modules` (« Accueil et tableau de bord », 32 px, S5) |
| `etiquettes` | cliente / interne | ✗ 1 / ✗ 3 | ✗ 1 / ✗ 5 | champs sans nom. Les 2 nouveaux côté interne (`<input file>` de `#/interventions`, bouton de `#/outils/calculatrice`) sont sur des écrans qui existent aussi sur `main` : le même `<input file>` y est déjà relevé côté cliente. La garde ne les atteignait pas côté interne sur `main` ; la navigation de la pointe les lui montre (cause exacte non isolée) |
| `largeur` | cliente / interne | ✗ 10 / ✗ 20 | ✗ 10 / ✗ 22 | texte écrasé ou coupé à 390 px. Interne : nouveau `#/tous-les-modules` (516-584 px dans 390, S5) |
| `signal` | cliente / interne | ✓ / ✗ | ✓ / ✗ | interne : 4 écrans (Cyber, 16 écrans vides au total) sur `main` comme sur la pointe. Données d'essai absentes (voir ci-dessous) |

Lecture :

- **Défauts hérités de `main` et inchangés** (focus, cibles, étiquettes, largeur, côté cliente comme interne) : la refonte ne les a ni créés ni corrigés.
- **Défauts apportés par la refonte** : `coquille` interne (S1), `#/tous-les-modules` en cibles et en largeur (S5), une fenêtre sans focus sur l'organigramme de la Garde (S3).
- **`signal` interne n'est pas concluant sur le fond** : les écrans Cyber et Studio sont « vides » parce que `seed-essai.mjs` ne les peuple pas (aucun incident, aucune pièce de studio). La garde dit elle-même qu'un écran vide n'a rien à signaler. À corriger côté données d'essai, pas côté produit.

## Couverture

- **Scripts de garde dans le dépôt : 73** `scripts/check-*`. Pas de mesure de couverture de code (aucun lanceur de tests unitaires ; convention du dépôt, voir `check-money.ts`).
- **Tests de T1 : `tests/f1/argent.test.mjs`**, 139 671 vérifications sur 6 modules de F1 recalculés avec un oracle en entiers. 3 sabotages volontaires du code de F1 sont détectés.
- **Écrans parcourus par les gardes navigateur** : 136 écrans cliente, 188-190 interne (largeur) ; 135 et 190 (contraste).
- **Pas couverts** : l'application Electron (aucune garde ne l'ouvre, seulement le build web) ; l'édition cliente en tant que paquet installé ; les écrans de F1 (hors application) ; les appels, la voix, le temps réel ; le guide de première connexion lui-même (les gardes le masquent, voir C-002).

## Constats ouverts

| # | Gravité | Sujet | Proposé à |
|---|---|---|---|
| [C-001](constats/C-001-css-socle-dans-paquet-client.md) | Mineur | Le CSS du socle (+15 Ko, 124 sélecteurs) part dans le paquet client ; inerte aujourd'hui | CO (déjà repris dans STATUT) |
| [C-002](constats/C-002-gardes-navigateur-masquees-par-le-guide.md) | Majeur | La fenêtre de bienvenue masque tout aux gardes navigateur (277 faux défauts de focus) | auteurs des gardes |
| [C-003](constats/C-003-verifier-f1-casse-sur-refonte-vivante.md) | Majeur | Le vérificateur de F1 casse sur la pointe ; patch testé joint | F1 |
| [C-004](constats/C-004-couverture-des-gardes-instable.md) | Majeur | La couverture des gardes varie sans changement de code (11 routes vues au lieu de 118) | auteurs des gardes |

Relectures : [S2 @ a537dbe](relectures/S2-a537dbe.md) (fusionnée depuis ; 4 décisions restantes, M1 à M4), [F1 @ 59056ad](relectures/F1-59056ad.md).

## Relectures de branches

| Branche | État | T1 |
|---|---|---|
| `refonte-s2-accueil` | fusionnée | relue avant fusion : aucun bloquant technique, 4 décisions (persona de texte Ajmani, toasts, `emit` partagés, `App.tsx`) |
| `refonte-atelier-f1` | non fusionnée | relue et testée : voir ci-dessus ; **bloquée par C-003** |
| S6 (`refonte-sec-*`) | **rien de poussé** | rien à relire. Conforme à la règle du dépôt public (rien qui décrive une faille). T1 n'a pas non plus produit de document de sécurité |
| `refonte-sim-bac-a-sable` | non fusionnée, session « SIM » inconnue du CO | parcourue : ses constats de sécurité restent locaux (`.gitignore`), la carte poussée est « hors sécurité ». Non testée par T1 |
| S5 (`refonte-s5-modules`) | fusionnée | non relue avant fusion. Mesurée après : 2 défauts nouveaux sur `#/tous-les-modules` |

## Ce que T1 n'a pas pu vérifier

- **Les gardes navigateur sur la CI** : proposition prête ([`proposition-ci.md`](proposition-ci.md)), mais rien n'a été essayé sur GitHub Actions ; elle dépend du secret `AMN_API_TOKEN`, aujourd'hui refusé.
- **`check:mobile` et `check:signal` sur `main`** : `mobile` n'a pas été lancé sur `main` ; `signal` interne échoue des deux côtés mais pour une raison de données d'essai.
- **La reprise automatique du bac à sable** (relance d'une garde dont l'amorce est basse) : écrite et chargée, jamais déclenchée en conditions réelles (le dernier passage a eu une bonne couverture du premier coup).
- **Les rendus.** Aucune capture regardée ; les contrastes sont mesurés par calcul, pas à l'œil.
- **Le barème kilométrique 2026 et les autres valeurs légales** de F1 : mes tests prouvent que le code applique sa table, pas que la table est celle en vigueur.
- **Ce qui a changé sur `refonte-vivante` depuis `f059f32`.**
