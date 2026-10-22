# Refonte vivante — statut

> Tenu par le CO, mis à jour à chaque « point ». Les sessions ne modifient pas
> ce fichier. Règles : [`REGLES.md`](REGLES.md).

- Branche d'intégration : `claude/refonte-vivante` (base `main` @ `630ef45`). Dernier code fusionné : `c808dae`. Depuis, documentation seulement.
- Dernière mise à jour : 2026-10-22 (point 2 : aucune branche prête ; pistes F1, T1 et S5 ajoutées ; procédure F1)
- Gardes locales sur `c808dae` : `typecheck`, `typecheck:business`, `lint` et les 47 `check:*` de `editions.yml` sans navigateur, toutes vertes.
- CI `editions.yml` sur `f0b8f12` (S1 et S3 incluses) : « Build interne », « Build business + contrôle de fuite » et « Les garde-fous » réussis. « Garde-fous croisés » échoue toujours à « Récupérer amn-api » (secret `AMN_API_TOKEN` refusé : *Bad credentials*), ce qui ne dépend pas du code.
- Point 2 : aucune nouvelle branche poussée (S5, S6, F1, T1). S2 est inchangée (`8c048ca`). Rien n'a été fusionné.

## Sessions

| Session | Branche | État | Dernier sha | Rapport | Points à trancher |
|---|---|---|---|---|---|
| 00 Lancement sûr | aucune (lecture seule) | inconnu, aucun rapport reçu | — | — | — |
| S0 Socle | `claude/refonte-s0-socle` | **fusionnée** | `b7453e3` | [`docs/refonte-socle.md`](../refonte-socle.md) (avant le modèle) | `data-famille="outils"` partagé avec le rail ; `emit` en fichier partagé à faire via `@edition/socle` |
| S1 Navigation | `claude/refonte-s1-navigation` | **fusionnée** | `e788af8` | [`rapports/S1.md`](rapports/S1.md) | 8e famille « supervision » (et terrain) ou Outils, pour 40 modules `aValider` ; fusionner `/tour` et `/supervisor` ? ; essentiels du rail ; étape « rail » du guide ; `check:coquille` à adapter ; tiroir mobile (accord `BarreRail` ou `MobileBottomNav`) ; recherche dans les contenus |
| S2 Accueil | `claude/refonte-s2-accueil` | **non fusionnée, à recadrer** (décision de Harun) : ne pas fusionner en l'état | `8c048ca` | `rapports/S2.md` (sur sa branche) | Accueil à refaire sur le design noir et gris, **sans personnage**, et **activation du fond noir et gris** (jetons de fond de S0). La mascotte Ajmani, ses réactions et l'animation de lancement sortent du périmètre. Sa branche devra intégrer `refonte-vivante` (bus de moments modifié) avant la prochaine relecture. |
| S3 Supervisor et Garde | `claude/refonte-s3-supervisor` | **fusionnée** | `e7f4f25` | [`rapports/S3.md`](rapports/S3.md) | 8 accents d'équipe à valider ; fond graphite de la veille au lieu du noir ; format de `journal.ressource` côté serveur ; alertes app fermée (travail amn-api, `docs/refonte-alertes.md`) |
| S4 Robots métiers | — | **annulée** (décision de Harun) : plus de personnages ni de robots dans le desktop | — | — | — |
| S5 Modules et registre extensible | `claude/refonte-s5-modules` | à lancer, ou en cours : pas encore de branche (S1 fusionnée) | — | `rapports/S5.md` | Rangement de 142 à 101 modules. Registre où un module ou une famille = un fichier. Vue « Tous les modules ». Reprend des fichiers de S1 (`registre.ts`, `TousLesModules.tsx`, `check:navigation`). Écrans partagés : `IS_BUSINESS` ou écrans enveloppes internes, à trancher. |
| S6 Sécurité et SOC | `claude/refonte-sec-*` | **en cours**, pas encore de branche. Phase 1 en lecture seule. **Ne pas fusionner sans décision de Harun.** Ne bloque aucune autre tranche. | — | `docs/securite/phase1.md` (phase 1) | Couvre aussi le diagnostic de la Garde (pourquoi elle échoue), repris de G0. |
| F1 Atelier de modules | `claude/refonte-atelier-*` | à lancer, ou en cours : pas encore de branche | — | carnet : `docs/atelier/BACKLOG.md`, `docs/atelier/PRET.md` | Crée et teste des modules en continu. **Rien n'est branché tant que Harun n'a pas choisi.** Intégration selon [`INTEGRATION-F1.md`](INTEGRATION-F1.md), dont la validation par Harun est attendue. |
| T1 Qualité et tests | `claude/refonte-qualite-*` | à lancer, ou en cours : pas encore de branche | — | `docs/qualite/SANTE.md` | Lance les gardes navigateur, relit les branches, tient `SANTE.md`. Le dossier `tests/**` est vu par `npm run lint` (`eslint .`) : il doit rester vert. |
| G0 Garde diagnostic | — | **retirée** (décision de Harun) : S6 couvre le diagnostic de la Garde | — | — | — |

États possibles : à lancer · en cours · prête (rapport poussé) · relue · fusionnée · bloquée · annulée.

Modèles conseillés : S6 Opus 5.5, effort élevé.

**Relances automatiques : aucune.** Ni tâche programmée ni relance de nuit, tant que Harun n'a pas validé le plafond proposé (une relance par nuit et par piste).

## Zones

| Session | Zone |
|---|---|
| S1 | `src/refonte/navigation/**`, `src/components/AppLayout.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `src/edition/navLexique.internal.ts`, routes de `src/edition/appRoot.internal.tsx`. `BarreRail.tsx` seulement avec accord du CO. |
| S2 | `src/refonte/accueil/**`, `src/accueils/interne/**`, `src/edition/accueils.internal.tsx`, `src/edition/ajmani.internal.ts`. Peut ajouter `emettreMoment` au couple `src/edition/socle.*.tsx` (vide côté cliente), en le signalant. |
| S3 | `src/bureaux/**`, `src/screens/garde/**`, `src/components/garde/**` |
| S4 | annulée |
| S5 | registre et rangement des modules : `src/refonte/navigation/**` (repris de S1, qui est terminée), `src/edition/modules.internal.ts`, la vue « Tous les modules », `check:navigation` ; écrans partagés seulement avec du code ajouté réservé à l'interne |
| S6 | `docs/securite/**` et `src/securite/**`. Pour tout le reste, elle **propose** des tickets dans `docs/securite/tickets/`, sans rien modifier. |
| F1 | `src/ateliers/**` et `docs/atelier/**`. Branchement (registre de S5 et route) seulement à l'intégration d'un module choisi. |
| T1 | `tests/**` et `docs/qualite/**` |

Ces zones n'existaient pas avant (`src/ateliers`, `tests`, `docs/atelier`, `docs/qualite`, `docs/securite`, `src/securite` : vérifié au point 2), donc il n'y a aucun recouvrement avec l'existant.

## Ordre de fusion (proposé, à valider par Harun)

Fait : S0, puis S3, puis S1.

1. **T1, en continu.** Ses tests et `SANTE.md` sont fusionnés dès qu'ils sont prêts, avant chaque autre fusion, pour que la porte de contrôle existe avant ce qu'elle contrôle. Sa zone ne recouvre personne.
2. **S5**, dès qu'elle est prête et testée par T1. Elle passe avant F1 et avant S2, parce que son registre est l'endroit où se branchent les modules de F1, et que l'Accueil le lit.
3. **S2 recadrée** (Accueil noir et gris, activation du fond), après S5. Elle devra intégrer `refonte-vivante` avant relecture.
4. **F1, un module à la fois**, après S5, selon [`INTEGRATION-F1.md`](INTEGRATION-F1.md) : choix de Harun, puis T1, puis la liste du CO, puis la validation de Harun.
5. **S6** : à part, sur décision de Harun seulement. Elle ne bloque rien et rien ne l'attend.

Si une branche arrive avant celle qui la précède, elle attend, sauf si sa zone ne touche rien de la précédente. Dans ce cas, je le signale et je propose de la fusionner.

## Direction design (validée par Harun, 2026-10-22)

- **Noir et gris**, structure très rangée.
- **Ludique premium** : une journée avec des cases à cocher, une progression, l'équipe en ligne.
- **Aucun personnage ni robot** dans le desktop.
- **Ajmani** devient une simple barre de texte, ouverte par ⌘J.

- **Couleurs** (tranché par Harun) : rien à refaire. Les 7 familles de S0 (`data-famille`, `--fam*`), les 8 accents d'équipe de S3 (`src/refonte/garde/equipes.ts`) et les couleurs du rail de S1 restent, en **petits points de couleur** sur fond noir et gris. S0, S1 et S3 restent valides.
- **Fond noir et gris** : les jetons de fond de S0 existent mais ne sont pas encore activés. Leur activation fait partie de **S2 recadrée**.

Points encore ouverts :

- **Ajmani dans S3** : `ResumeDeNuit` garde un emplacement prévu pour lui (`ajmani={…}`). Il reste vide, et il faudra le retirer ou le brancher sur la barre ⌘J.
- **⌘J** ouvre déjà l'assistant (`src/assistant/AssistantContext.tsx:238`, fichier partagé). La barre de texte peut reprendre ce raccourci, mais en passant par une couture : l'édition cliente garde son comportement actuel.

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
| 2026-10-22 | point 2 | — | rien de prêt : aucune fusion |
