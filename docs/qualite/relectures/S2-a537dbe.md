# Relecture S2 Accueil recadrée — `claude/refonte-s2-accueil` @ `a537dbe`

- Date : 2026-10-22 · Lecture seule (worktree temporaire, aucun commit sur la branche)
- Base : `claude/refonte-vivante` @ `62de06b` · merge-base `f0b8f12` · 1 commit de retard (docs seulement)
- Fusion simulée (`git merge-tree --write-tree`) : **sans conflit**
- Relecture précédente, sur `8c048ca` (avant recadrage) : personnage complet, 17 commits de retard, 5 conflits. Tout cela est corrigé, sauf les points ci-dessous.

## Verdict

**Pas de bloquant technique.** Les gardes sont vertes et l'édition cliente ne change pas de comportement.
Avant fusion, il reste quatre décisions à prendre (M1 à M4) et deux points à corriger
(m1 et m2, plus l'accessibilité).

## Preuves exécutées

| Garde | Branche | Fusion simulée |
|---|---|---|
| `tsc --noEmit` / `-p tsconfig.business.json` | 0 / 0 | 0 / 0 |
| `lint` | 0 (209 avertissements préexistants, 0 dans les fichiers S2) | 0 |
| `check:accueils` · `socle` · `moments` · `navigation` · `garde-refonte` · `ajmani` | tous 0 | tous 0 |
| Paquet client (build `AMN_EDITION=business`, `comparer-paquet-client.mjs` contre `refonte-vivante`) | JS : 3 composants vides (`return null`) ajoutés, aucun texte. CSS : 25 sélecteurs ajoutés (Tailwind). Aucun mot interdit (« ajmani », « refonte »…). `check:business` vert. | — |
| `tester-branche.mjs` | 0 bloquant automatique ; 13 fichiers hors zone (voir m1) | — |

## Majeur (décision du CO ou de Harun)

- **M1. Ajmani reste une persona de texte.**
  - Preuves :
    - `src/refonte/accueil/ajmani/phrases.ts:84-85` : « Hello, I'm Ajmani… », « Hi, I'm Ajmani… » ;
    - `phrases.ts:49` : « I'll pretend to be busy » ;
    - le message de l'Accueil commence par « Ajmani · » ;
    - les Réglages ont une section « Le ton d'Ajmani » (`RegistreSection`).
  - La direction dit « Ajmani devient une simple barre de texte ».
  - Correctif proposé : des phrases neutres sans « je », sans préfixe « Ajmani · », et le retrait de `RegistreSection` (ce qui retire aussi l'ajout dans `SettingsScreen.tsx`).
- **M2. Les réactions aux moments restent** (`Toasts.tsx`, `ReactionsGuide` branché dans `App.tsx`), alors que STATUT dit : « ses réactions et l'animation de lancement sortent du périmètre ».
  - Correctif proposé : Harun valide les toasts sobres, ou on les retire. Les retirer supprime aussi M3.
- **M3. Deux `emit` dans des fichiers partagés, sans accord écrit du CO** : `src/state/useClients.ts:258` (`client.cree`) et `src/state/useInvoices.ts:431` (`facture.payee`).
  - Ce qui est en règle : ils passent par la couture `@edition/socle`, le jumeau cliente est inerte, et les types existent déjà au catalogue.
  - Correctif proposé : accord écrit dans STATUT, ou retrait (avec M2).
- **M4. `src/App.tsx` (fichier sensible) n'est pas modifié que par des ajouts.**
  - Ce qui change : `SplashScreen` et `hasSplashPlayed` sont remplacés par `Lancement` et `lancementJoue` via `@edition/vivant`. Le lancement interne est un nouvel écran : `Lancement.tsx`, fond `bg-[#0c0c0d]` en dur, alors que STATUT sort « l'animation de lancement » du périmètre.
  - Effet côté cliente : nul, car le jumeau réexporte `SplashScreen`.
  - Correctif proposé : garder `SplashScreen` dans les deux éditions. `App.tsx` ne reçoit alors que des ajouts (`<Ambiance />`).

## Mineur

- **m1. Fichiers hors zone** : `scripts/check-accueils.mjs`, `scripts/check-ajmani.ts`, la couture `src/edition/vivant.*.tsx`, `src/state/useClients.ts` et `src/state/useInvoices.ts`. S'y ajoutent les fichiers sensibles touchés par ajout seul (`editions.yml`, `package.json`, `tsconfig*.json`, `vite.edition.ts`, `SettingsScreen.tsx`). Tous sont signalés dans le rapport de S2. À valider par le CO.
- **m2. L'Accueil coche les tâches de toute l'équipe.** « Aujourd'hui » liste toutes les tâches ouvertes, sans filtre de responsable ni plafond (`useAccueil.ts:226`, `filDuJour.ts:95-107`).
  - Correctif : garder les miennes et les non attribuées, et plafonner.
- **m3. Le message flotte au chargement.** `pret` n'est jamais lu dans `AccueilVivant.tsx`, donc le message change pendant que les données arrivent.
  - Correctif : un état neutre tant que `!pret`.
- **m4. La réplique « du jour » change dès qu'un compteur change.** La clé contient `JSON.stringify(params)` (`parole.ts:99`). De plus, `transformer(() => message.etat)` (`AccueilVivant.tsx:77-79`) écrase l'état au lieu de le transformer.
- **m5. Accessibilité.**
  - Le focus est perdu après « Ajouter », « Annuler » ou « Masquer » : l'élément focalisé est démonté (`AccueilVivant.tsx:251-256, 300, 355`).
  - L'`aria-label` de la case à cocher change avec l'état, en plus d'`aria-checked` : l'état est annoncé deux fois (`:331`).
  - `<aside>` et `<nav>` portent le même `aria-label` (`:459-460`).
  - Le libellé « ⌘J » est figé, alors que c'est Ctrl+J sous Windows.
- **m6. Couleurs en dur.**
  - `Lancement.tsx:79,90` (`#0c0c0d`) et `text-[#8a8a8e]` arrivent dans le CSS au lieu des jetons du socle.
  - Dans `ambiance.css`, `texte-doux` et `texte-discret` ont la même valeur, ce qui fait perdre un niveau de hiérarchie.
- **m7. `emit('tache.terminee')` direct** (`useAccueil.ts:178`) : il réémet à chaque recochage, et seul l'Accueil l'émet (`TasksScreen.tsx` ne l'émet pas).

## Info (conforme)

- **Personnage visuel retiré** : plus de SVG, de visage, de gestes ni d'aperçu. `grep -niE "emotion|geste|mascotte|visage|svg" src/refonte/accueil` ne trouve rien.
- **Barre ⌘J** : un bouton texte qui ouvre l'assistant existant. Aucun nouveau raccourci, et la cliente est inchangée.
- **Fond noir et gris** : la feuille `ambiance.css` (`:root[data-ambiance='noir']`) est posée par `Ambiance`, qui n'existe que côté interne. `index.css` n'est pas touché. Le fond s'applique aussi aux anciens écrans internes, ce qui est voulu.
- **Fichiers `.business` et textes** : aucun `.business` existant n'est modifié hors l'ajout inerte autorisé (`socle.business.tsx`), et il n'y a aucune clé nouvelle dans `src/i18n/fr.ts` ou `en.ts`.
- **Ordre de fusion** : `BarreFamilles` lit `src/refonte/navigation/registre`, que S5 va reprendre. Cela confirme l'ordre de fusion de STATUT (S5 avant S2).

## Non vérifié

- **Gardes navigateur sur cette branche** : prévues au prochain passage, sur le bundle interne de S2.
- **Rendu et focus réels** : aucune capture prise.
- **CI GitHub de la branche.**
