# Refonte vivante — statut

> Tenu par le CO, mis à jour à chaque « point ». Les sessions ne modifient pas
> ce fichier. Règles : [`REGLES.md`](REGLES.md).

- Branche d'intégration : `claude/refonte-vivante` @ `c808dae` + ce statut (base `main` @ `630ef45`)
- Dernière mise à jour : 2026-10-22 (point 1)
- Gardes locales sur `c808dae` : `typecheck`, `typecheck:business`, `lint` et les 47 `check:*` de `editions.yml` sans navigateur, toutes vertes.
- CI `editions.yml` : sur `9a6ffe7`, les builds et les garde-fous ont réussi. « Garde-fous croisés » échoue à « Récupérer amn-api » (secret `AMN_API_TOKEN` refusé : *Bad credentials*), ce qui ne dépend pas du code. Sur ce point, résultat à relire au point suivant.

## Sessions

| Session | Branche | État | Dernier sha | Rapport | Points à trancher |
|---|---|---|---|---|---|
| 00 Lancement sûr | aucune (lecture seule) | inconnu, aucun rapport reçu | — | — | — |
| S0 Socle | `claude/refonte-s0-socle` | **fusionnée** | `b7453e3` | [`docs/refonte-socle.md`](../refonte-socle.md) (avant le modèle) | `data-famille="outils"` partagé avec le rail ; `emit` en fichier partagé à faire via `@edition/socle` |
| S1 Navigation | `claude/refonte-s1-navigation` | **fusionnée** | `e788af8` | [`rapports/S1.md`](rapports/S1.md) | 8e famille « supervision » (et terrain) ou Outils, pour 40 modules `aValider` ; fusionner `/tour` et `/supervisor` ? ; essentiels du rail ; étape « rail » du guide ; `check:coquille` à adapter ; tiroir mobile (accord `BarreRail` ou `MobileBottomNav`) ; recherche dans les contenus |
| S2 Accueil et Ajmani | `claude/refonte-s2-accueil` | **non fusionnée, à recadrer** (décision de Harun) | `8c048ca` | `rapports/S2.md` (sur sa branche) | recadrage ; sa branche devra intégrer `refonte-vivante` (bus de moments modifié) avant la prochaine relecture |
| S3 Supervisor et Garde | `claude/refonte-s3-supervisor` | **fusionnée** | `e7f4f25` | [`rapports/S3.md`](rapports/S3.md) | 8 accents d'équipe à valider ; fond graphite de la veille au lieu du noir ; format de `journal.ressource` côté serveur ; alertes app fermée (travail amn-api, `docs/refonte-alertes.md`) |
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
2. S3, puis S1 (faits). S2 viendra après son recadrage.
3. S4, après S2.
4. S5, une catégorie à la fois, après S1.

## Gardes qui ne tournent nulle part

`check:isolation`, `check:mouvement`, `check:contraste`, `check:signal`, `check:mobile` et `check:coquille` demandent un build servi et un navigateur. Ni le CO ni la CI ne les lancent : à faire sur un poste, avant la fusion dans `main`. `check:coquille` échouera côté interne depuis S1 (colonne `BarreRail` masquée sur bureau).

## Bus de moments

Ajoutés au point 1 (demande de S3, décision de Harun) : `garde.escalade` (critique), `site.muet` (decision) et `garde.remontee-critique` (critique), tous dans la famille outils. Rien ne les émet encore. Les tons critiques forment une liste fermée dans `check:moments` : l'allonger passe par le CO.

## Isolement des éditions

Deux contrôles le vérifient par lecture des sources : `check:navigation` (S1) et `check:garde-refonte` (S3). Ils se recoupent, et ils se sont contredits au point 1 : `src/bureaux/**` et `IdleScreensaver.tsx` sont internes sans porter le suffixe `.internal`. C'est corrigé dans `c808dae`. À terme, il faudrait un seul contrôle fondé sur le graphe d'imports réel depuis la racine cliente.

## Journal des fusions

| Date | Branche | sha | Résultat |
|---|---|---|---|
| 2026-10-20 | `claude/refonte-s0-socle` | `b7453e3` → `9a6ffe7` | sans conflit ; gardes locales et CI de build au vert |
| 2026-10-22 | `claude/refonte-s3-supervisor` | `e7f4f25` → `596239e` | sans conflit |
| 2026-10-22 | `claude/refonte-s1-navigation` | `e788af8` → `c5f4707` | conflit additif dans `editions.yml` (deux étapes après `check:moments`), les deux gardées. Commit `CommandPalette.tsx` hors zone accepté par Harun. |
| 2026-10-22 | (CO) | `c808dae` | 3 types de moments ; `check:navigation` corrigé pour S3 ; gardes locales vertes |
