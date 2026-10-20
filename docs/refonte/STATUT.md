# Refonte vivante — statut

> Tenu par le CO, mis à jour à chaque « point ». Les sessions ne modifient pas
> ce fichier. Règles : [`REGLES.md`](REGLES.md).

- Branche d'intégration : `claude/refonte-vivante` @ `9a6ffe7` (base `main` @ `630ef45`)
- Dernière mise à jour : 2026-10-20
- CI `editions.yml` sur `9a6ffe7` : « Build interne », « Build business + contrôle de fuite » et « Les garde-fous » réussis. « Garde-fous croisés » échoue à « Récupérer amn-api » (secret `AMN_API_TOKEN` refusé : *Bad credentials*), ce qui ne dépend pas du code.

## Sessions

| Session | Branche | État | Dernier sha | Rapport | Points à trancher |
|---|---|---|---|---|---|
| 00 Lancement sûr | aucune (lecture seule) | inconnu, aucun rapport reçu | — | — | — |
| S0 Socle | `claude/refonte-s0-socle` | **fusionnée** | `b7453e3` | [`docs/refonte-socle.md`](../refonte-socle.md) (avant le modèle) | `data-famille="outils"` partagé avec le rail ; `emit` en fichier partagé à faire via `@edition/socle` |
| S1 Navigation | `claude/refonte-s1-navigation` | à lancer (vague 2) | — | — | — |
| S2 Accueil et Ajmani | `claude/refonte-s2-accueil` | à lancer (vague 2) | — | — | — |
| S3 Supervisor et Garde | `claude/refonte-s3-supervisor` | à lancer (vague 2) | — | — | — |
| S4 Robots métiers | `claude/refonte-s4-robots` | en attente de S2 | — | — | — |
| S5 Modules par catégorie | `claude/refonte-s5-<categorie>` | en attente de S1 | — | — | stratégie pour les écrans partagés (`IS_BUSINESS` ou enveloppes internes) |

États possibles : à lancer · en cours · prête (rapport poussé) · relue · fusionnée · bloquée.

## Zones

| Session | Zone |
|---|---|
| S1 | `src/refonte/navigation/**`, `src/components/AppLayout.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `src/edition/navLexique.internal.ts`, routes de `src/edition/appRoot.internal.tsx`. `BarreRail.tsx` seulement avec accord du CO. |
| S2 | `src/refonte/accueil/**`, `src/accueils/interne/**`, `src/edition/accueils.internal.tsx`, `src/edition/ajmani.internal.ts`. Peut ajouter `emettreMoment` au couple `src/edition/socle.*.tsx` (vide côté cliente), en le signalant. |
| S3 | `src/bureaux/**`, `src/screens/garde/**`, `src/components/garde/**` |
| S4 | `src/refonte/robots/**` |
| S5 | `src/refonte/couverture.ts` et les écrans de sa catégorie, avec du code ajouté réservé à l'interne |

## Ordre de fusion

1. S0 (fait)
2. S3, puis S2, puis S1. S1 passe en dernier parce qu'il touche la mise en page et le routeur que les autres traversent.
3. S4, après S2.
4. S5, une catégorie à la fois, après S1.

## Gardes qui ne tournent nulle part

`check:isolation`, `check:mouvement`, `check:contraste`, `check:signal` et `check:mobile` demandent un build servi et un navigateur. Ni le CO ni la CI ne les lancent : à faire sur un poste, avant la fusion dans `main`.

## Journal des fusions

| Date | Branche | sha | Résultat |
|---|---|---|---|
| 2026-10-20 | `claude/refonte-s0-socle` | `b7453e3` → `9a6ffe7` | sans conflit ; gardes locales et CI de build au vert |
