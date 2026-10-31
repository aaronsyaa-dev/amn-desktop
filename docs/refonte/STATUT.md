# Refonte vivante — statut

> Tenu par le CO. Une session ne modifie que **la section de son lot** dans « 7. Écrans » (une ligne par écran) ; tout le reste est au CO. Règles : [`REGLES.md`](REGLES.md).

- Branche d'intégration : **`claude/refonte-vivante`** @ `f059f32` (décision du 31 oct., §1.1). Base `main` @ `630ef45`.
- Dernière mise à jour : 2026-10-31. Nouveau dossier de construction `AMN-refonte-CO` reçu de Harun : 127 écrans, un socle de design, 10 lots, 10 prompts.
- Le dossier n'est **pas** committé (dépôt public). Les images ne figurent pas dans l'exemplaire reçu par le CO (§6).
- Gardes locales sur `refonte-vivante` @ `f059f32` : `typecheck`, `typecheck:business`, `lint` et les 43 contrôles sans navigateur de `editions.yml` verts. Selon T1 (`SANTE.md`, passage 1), l'édition cliente n'a pas bougé dans ce que les gardes mesurent, à 15 Ko de CSS inerte près (constat C-001).

## 1. Décisions du CO (31 oct.)

### 1.1 Branche d'intégration : `claude/refonte-vivante`, pas `claude/refonte-design-socle`

Vérifié :

- `refonte-design-socle` @ `e97f479` (24 oct., un seul commit : « Refonte DS : jetons noir et gris, briques, coquille commune, Accueil recâblé ») est **1 commit devant** `refonte-vivante` et 0 derrière. C'est un descendant direct, pas une branche concurrente.
- Sur ce commit : `typecheck`, `typecheck:business`, `lint` et les 43 contrôles sans navigateur de `editions.yml` passent. `check:encres` (hors CI) échoue comme sur `refonte-vivante` : 4 copies de jeton dans `src/refonte/garde/equipes.ts` (S3), rien de nouveau.
- Fusions simulées avec `design-socle` : T1, SIM et F1 sans conflit ; S5 (4 commits postérieurs) : 1 conflit, `src/socle/i18n.ts` ; S2 (5 commits postérieurs) : 5 conflits, tous dans l'Accueil.

Décision :

- **`refonte-vivante` reste la branche d'intégration.** Elle porte S0 à S3, S5 et S2 fusionnées, la coordination (`docs/refonte/`) et l'historique de CI. Une branche non relue ne devient pas une base.
- **LOT-00 se construit sur `claude/refonte-socle`, créée depuis la pointe de `refonte-design-socle` (`e97f479`).** Le travail de DS est réutilisé tel quel, sans rien refaire. Comme la branche descend de `refonte-vivante`, sa fusion sera directe.
- `refonte-design-socle` est **gelée** : plus personne n'y pousse, ses évolutions passent par `refonte-socle`.
- Les lots 01 à 08 partent de `refonte-vivante` **après** la fusion de LOT-00, jamais avant.
- S0 a commencé LOT-00 : le CO ne voit que `e97f479` sur le serveur. Tout ce que S0 a fait depuis n'est visible qu'une fois poussé sur `claude/refonte-socle`.

### 1.2 Écarts entre le travail de DS et le nouveau socle (à corriger par LOT-00)

Comparaison de `src/socle/noir.css` avec `01-SOCLE-DESIGN.md` (le socle fait foi) :

- **Conformes** : fond `#0C0C0D`, latéral `#101011`, carte `#161617` → `#131314`, champ `#131314`, bordures `#232325` / `#1D1D1F` / `#19191B` / `#222224` / `#28282B`, T1 `#EDEDED`, plancher T4 `#8A8A8E`, 7 familles, états succès / critique / info, gabarits 252 et 60.
- **À corriger** :
  - ATTENTION vaut `#D9A27A` (la couleur de la famille Créer) ; le socle dit `#E0B35A` ;
  - le texte courant T2 `#C4C4C8` manque : DS a `#A0A0A5` comme « secondaire », qui est le T3 du socle ;
  - bordure de champ `#6E6E73` ; le socle dit `#5A5A60` ;
  - la 8e famille « La Garde et la supervision » `#D6D6DA` manque ;
  - rayons bouton / champ : 10 / 9 dans `noir.css`, 9 / 10 dans le socle ; sous-carte 11, tag 6 et ticket 12 absents ;
  - bordures `#212123`, `#2E2E31` et le pointillé `#2E2E33` absents ;
  - barre Ajmani : 48 px dans `noir.css`, 46 px dans le socle (§3).
- **Composants du §4** : d'après la liste des fichiers du commit, il manque au moins Toggle, Tabs, Segmented, Table, Ticket et colonne de kanban, Donut, graphiques, TimelineItem, les quatre cartes ludiques et Suggestion. À vérifier par S0.
- La nouvelle coquille de DS est **éteinte par défaut** (Paramètres › Nouvelle coquille). LOT-00 décide quand elle devient la coquille de l'édition interne.

### 1.3 Refondre un écran sans changer l'édition cliente

Les écrans à re-habiller vivent dans `src/screens/**`, **partagés avec l'édition cliente**, et sont montés un par un dans `appRoot.internal.tsx` (164 routes). Huit lots y touchant en parallèle donneraient des conflits garantis et un risque de changer l'édition cliente. Règle :

1. Un écran refondu est un **nouveau composant** dans `src/refonte/<lot>/`, qui réutilise les hooks et l'état existants (`src/state/**`, `src/lib/**`). **`src/screens/**` n'est pas modifié** : il continue de servir l'édition cliente.
2. **LOT-00 livre le mécanisme de substitution** : un fichier de déclaration par lot, ramassé automatiquement (comme les familles de S5). Il conserve la route, la garde `ModuleRoute` et la variante « session de support cliente ». Son jumeau `.business` ne fait rien. Piste d'implémentation : un seul point dans la coque interne (`AppLayout`, monté par l'édition interne seulement), au lieu de réécrire 164 routes.
3. Avant que ce mécanisme soit fusionné, **aucun lot ne touche `appRoot.internal.tsx`**. Les écrans NOUVEAU passent par le registre de S5 (`nouveau`), déjà en place.
4. Même règle pour les écrans système partagés avec l'édition cliente (G06 connexion, H40 notifications, H41 ⌘K, H42 démarrage) : couture `@edition/*`, jumeau cliente inerte.
5. **Preuve exigée à chaque fusion** : paquet client identique (`scripts/qualite/comparer-paquet-client.mjs` de T1) et `check:business` vert.
6. Le registre de S5 a un fichier par famille (`src/refonte/modules/declarations/<famille>.ts`), ce qui donne un fichier par lot : jour = LOT-01, contacts = LOT-02, ecrire = LOT-03, argent = LOT-04, echanger = LOT-05, creer = LOT-06, outils = LOT-07, garde = LOT-08. Pas de collision.

### 1.4 Mobile et tablette (LOT-09) : PWA responsive, même code

**Décision : on continue la PWA existante** (`docs/PWA.md`), sans second code ni nouvelle dépendance (règle 9 du dossier).

Le dépôt a déjà ce qu'il faut : le même renderer tourne en PWA installable (manifeste, `sw.js`), le pont navigateur parle à amn-api avec la synchro temps réel, `fileEnvoi.ts` et `EnvoiEnAttente` font la file d'attente hors ligne, `src/assistant/voix.ts` la voix, `useEtroit` le responsive, et `check:mobile`, `check:largeur` et `check:cibles` mesurent déjà le téléphone.

- Les écrans MB et T sont des vues propres à l'édition interne, branchées par le même mécanisme de substitution que les autres lots (§1.3). Seuils proposés : téléphone < 768 px, tablette de 768 à 1199 px (rail 76 px, vue scindée), bureau ≥ 1200 px. LOT-09 peut les ajuster.
- Cibles tactiles ≥ 42 px (04-C : MB04 et MB05 sont à 32-34 px sur les images).
- **Limites assumées en PWA** : scan de reçu (MB07) par la caméra du navigateur, sans scanneur natif ; dictée (MB05) par `voix.ts`, à tester sur iPhone avant de promettre.
- **MB09 (widgets et écran verrouillé)** : non faisable en PWA. Premier jet = connexion, démarrage, notifications web avec **aperçu masqué par défaut** (04-B #6). Les widgets natifs sont **hors du premier jet** ; si Harun les veut, l'étape suivante est une enveloppe Capacitor autour du même build web, décidée à part. React Native (second code) est écarté.
- Avant MB08 (La Garde mobile) et MB03 (Argent) : vérifier écran par écran que les droits du jeton web (`WEB_OPERATOR_TOKEN`) suffisent. S6 relit ce point en privé.
- Pas de mode édition du tableau de bord sur téléphone au premier jet (04-B #5).
- LOT-09 démarre quand les lots 01 à 08 sont fusionnés. Il reprend le tiroir mobile resté ouvert chez S1 (`PanneauMobile`, `MobileBottomNav`).

### 1.5 Décisions par défaut (`04-ECARTS-MAQUETTES.md`, section B), appliquées jusqu'à contre-ordre de Harun

| # | Sujet | Décision appliquée |
|---|---|---|
| 1 | Banque | **Lecture seule. L'application n'émet jamais de virement** : elle prépare un ordre ou un rappel que la personne exécute dans sa banque. *Confirmé par Harun.* |
| 2 | Série quotidienne | Règle de L01 : la journée compte à la clôture des 3 priorités |
| 3 | Libellés d'état de La Garde | Sain (vert), Attention (orange), Critique (rouge), une seule table |
| 4 | Rondes (H33) | Reproduire l'image ; la « Proposition B » attend l'accord de Harun |
| 5 | Mode édition du tableau de bord sur mobile (MB06) | Absent au premier jet |
| 6 | Écran verrouillé et widgets (MB09) | Aperçu masqué par défaut |
| 7 | Anneau d'objectif (G08) | Orange, comme l'image |
| 8 | Libellés « Nouveau » | Base de connaissances = mixte ; dictée = barre Ajmani et mobile |

Les règles A1 à A9 de la section A du fichier 04 valent aussi pour tous les lots : chiffres calculés depuis les données réelles, un seul bouton primaire par page plus celui de la suggestion d'Ajmani, colonne droite de 340 px, format français, pastille de La Garde selon N02 §6.2, aucun avatar pour Ajmani.

### 1.6 Direction design (verrouillée par Harun)

Sobre, noir et gris, ultra professionnel, ludique premium (cases à cocher, « x sur y fait », anneaux, séries, jalons, « Boîte à zéro »). **Aucun robot, aucune mascotte, aucun personnage** : Ajmani est une barre de texte en bas de page (⌘J) et une palette ⌘J. Vouvoiement, français. Les 7 familles, les 8 accents d'équipe et le rail restent en petits points de couleur sur fond noir et gris.

## 2. Les lots

Ordre : **LOT-00 d'abord, fusionné** ; puis les lots 01 à 08 en parallèle, une branche chacun ; **LOT-09 en dernier**. Les chiffres viennent de `03-INDEX.md` : 8 + 16 + 13 + 9 + 17 + 10 + 15 + 16 + 12 + 11 = **127**. (Le tableau du fichier 00 compte G05 dans LOT-05 ; l'index et les prompts le rangent dans LOT-00. Le CO suit l'index.)

| Vague | Lot | Écrans (re-habillage / mixte / nouveau) | Branche | Session | Modèle · effort | Dépend de | État |
|---|---|---|---|---|---|---|---|
| 1 | **LOT-00** Système et démarrage | 8 (1 / 6 / 1) | `claude/refonte-socle` | S0 | Opus 5.5, élevé | aucune (LOT-00 passe en premier) | à faire |
| 2 | **LOT-01** Ma journée | 16 (4 / 8 / 4) | `claude/refonte-journee` | S2 | Sonnet 5.5, élevé | LOT-00 fusionné | à faire |
| 2 | **LOT-02** Mes contacts et clients | 13 (3 / 9 / 1) | `claude/refonte-contacts` | S1 | Sonnet 5.5, élevé | LOT-00 fusionné | à faire |
| 2 | **LOT-03** Écrire et retenir | 9 (3 / 5 / 1) | `claude/refonte-ecrire` | S5 | Sonnet 5.5, élevé | LOT-00 fusionné | à faire |
| 2 | **LOT-04** L'argent | 17 (0 / 16 / 1) | `claude/refonte-argent` | DS | Sonnet 5.5, élevé | LOT-00 fusionné | à faire |
| 2 | **LOT-05** Échanger | 10 (2 / 7 / 1) | `claude/refonte-echanger` | S5 | Sonnet 5.5, élevé | LOT-00 fusionné ; S5 le fait après LOT-03 | à faire |
| 2 | **LOT-06** Créer et produire | 15 (0 / 14 / 1) | `claude/refonte-creer` | F1 (à reconsidérer, voir §3) | Sonnet 5.5, élevé | LOT-00 fusionné | à faire |
| 2 | **LOT-07** Outils et réglages | 16 (3 / 9 / 4) | `claude/refonte-outils` | S6 (après sa phase sécurité) | Opus 5.5, élevé | LOT-00 fusionné ; fin de la phase sécurité de S6 | à faire |
| 2 | **LOT-08** La Garde et la supervision | 12 (3 / 8 / 1) | `claude/refonte-garde` | S3 | Opus 5.5, élevé | LOT-00 fusionné | à faire |
| 3 | **LOT-09** Mobile et tablette | 11 (0 / 0 / 11) | `claude/refonte-mobile` | à assigner (proposé : S1, après LOT-02) | Sonnet 5.5, élevé | lots 01 à 08 fusionnés ; approche tranchée au §1.4 | à faire |

## 3. Répartition proposée : ce qui convient et ce qui ne convient pas

| Session | Lot | Avis | Précisions |
|---|---|---|---|
| S0 Socle | LOT-00 | ✓ | Part de `refonte-design-socle` (§1.1). Corrige les écarts du §1.2, livre le mécanisme de substitution (§1.3), adapte `check:coquille` (rouge côté interne depuis S1, selon T1). Implémente **une seule fois** la pastille de La Garde de l'en-tête (N02 §6.2) : LOT-08 la réutilise. À la fin, liste dans « 7. Écrans » les composants disponibles et leur chemin. Pendant LOT-00, S5 ne touche ni au registre ni à `TousLesModules` (D02 les reprend). |
| S2 | LOT-01 | ✓ | N01 remplace son Accueil. Ses décisions M1 (voix d'Ajmani à la première personne), M2 (petites notifications de réaction) et M4 (écran de lancement) sont absorbées par G05, H40 et H42 : plus rien à trancher. Ses 5 commits postérieurs (`b228f5d`) ne sont pas fusionnés ; ils restent en référence. |
| S1 | LOT-02 | ✓ | Connaît le rail et le registre. |
| S5 | LOT-03 puis LOT-05 | ✓ | 19 écrans sur deux branches, l'une après l'autre. S5 reste propriétaire du registre. |
| DS | LOT-04 | ✓ à condition | DS ne pousse plus dans `src/socle/**` : S0 a repris sa base, deux sessions dans le même dossier se marcheraient dessus. C'est le plus gros lot (17) et le plus sensible : banque en lecture seule, paie masquée par défaut, « à valider par un comptable » sur la TVA et les impôts. Les clés et jetons ne se saisissent que dans H21 (LOT-07) ; LOT-04 n'affiche que l'état « connecté / à connecter ». |
| **F1** | LOT-06 | **✗ ne convient pas** | Sa mission est l'inverse : créer des modules neufs hors de l'application, rien de branché. LOT-06 re-habille des écrans en production. Son vérificateur est de plus cassé sur `refonte-vivante` (C-003, patch validé par T1, non appliqué) et 13 modules attendent le choix de Harun. **Proposition : une nouvelle session « S7 » pour LOT-06** ; F1 continue l'Atelier, et ses modules rejoignent les familles par le registre une fois LOT-06 fusionné. |
| S6 | LOT-07 | ⚠ à condition | Son audit reste privé. Ses commits sur `claude/refonte-outils` ne contiennent que du code, jamais la description d'une faiblesse. Sa zone s'élargit à `src/refonte/outils/**` et aux écrans de LOT-07 : c'est noté. Les écrans sensibles (H19 accès, H21 connecteurs, H24 coffre-fort) sont relus par **T1**, pour que celle qui construit ne soit pas seule à relire. Valeurs toujours masquées ; « Révéler » du coffre-fort avec confirmation. Le CO ne voit pas la phase 1 de S6 (privée) : **Harun dit au CO quand elle est terminée**. |
| S3 | LOT-08 | ✓ | Réutilise la pastille de LOT-00. Les libellés Sain / Attention / Critique suivent la table unique (§1.5 #3). |
| T1 | transversal | ✓ | Prépare le contrôle image / écran : capture à 1440 × 900 puis comparaison à l'image à ± 2 px, dans le bac à sable existant. Les images restent sur le poste, jamais committées. Commence par les 8 écrans de LOT-00. Doit d'abord rendre ses gardes fiables (constats C-002 et C-004). Relit aussi chaque lot avec `tester-branche.mjs`. |
| SIM | transversal | ✓ | Un jeu de données fictives unique, par métier (pour H47 et L04), consommé par T1 et par les lots. Il doit aussi peupler Cyber et Studio : c'est la cause de `check:signal` « vide » côté interne selon T1. Zone `simulation/**` et `docs/simulation/**`. Les constats de sécurité restent en local. |
| LOT-09 | | à assigner | Proposition : **S1**, après LOT-02 (le tiroir mobile est son point resté ouvert). |

## 4. Sessions et branches existantes (état au 31 oct.)

| Session | Branche | État | Dernier sha | Rapport | Points |
|---|---|---|---|---|---|
| 00 Lancement sûr | aucune | inconnu | — | — | — |
| S0 Socle | `claude/refonte-s0-socle` (ancienne), `claude/refonte-socle` (LOT-00) | ancienne **fusionnée** ; LOT-00 **en cours** | `b7453e3` ; LOT-00 non visible | [`docs/refonte-socle.md`](../refonte-socle.md) | Constat T1 C-001 : le CSS du socle part dans le paquet client (inerte, 15 Ko) |
| DS | `claude/refonte-design-socle` | **gelée**, non fusionnée | `e97f479` | message du commit | Sert de base à LOT-00 |
| S1 Navigation | `claude/refonte-s1-navigation` | **fusionnée** | `e788af8` | [`rapports/S1.md`](rapports/S1.md) | Étape « rail » du guide ; `check:coquille` ; tiroir mobile (→ LOT-09) |
| S2 Accueil | `claude/refonte-s2-accueil` | **fusionnée** à `a537dbe` ; 5 commits postérieurs **non fusionnés** | `b228f5d` | [`rapports/S2.md`](rapports/S2.md) | Remplacée par LOT-01 ; ne pas fusionner (conflit avec DS) |
| S3 Supervisor et Garde | `claude/refonte-s3-supervisor` | **fusionnée** | `e7f4f25` | [`rapports/S3.md`](rapports/S3.md) | Format de `journal.ressource` ; emplacement Ajmani de `ResumeDeNuit` à retirer (→ LOT-08) |
| S4 Robots métiers | — | **annulée** | — | — | Aucun personnage ni robot |
| S5 Modules et registre | `claude/refonte-s5-modules` | **fusionnée** à `69cd802` ; 4 commits postérieurs **non fusionnés** | `b82e50f` | [`rapports/S5.md`](rapports/S5.md) | Contrats → Argent, `/garde/ajmani` ouvre ⌘J, recherche en anglais, « Créer et produire ». Fusion propre dans `refonte-vivante`. |
| S6 Sécurité et SOC | `claude/refonte-sec-*` | **en cours**, privé. **Ne pas fusionner sans décision de Harun.** | — | `docs/securite/**`, local ou privé | Phase 1 inconnue du CO |
| F1 Atelier de modules | `claude/refonte-atelier-f1` | **prête, non fusionnée** ; rien n'est branché | `59056ad` | `docs/atelier/PRET.md` | Vérificateur cassé (C-003) ; procédure [`INTEGRATION-F1.md`](INTEGRATION-F1.md) à valider |
| T1 Qualité et tests | `claude/refonte-qualite-t1` | **en cours**, non fusionnée, 12 commits | `51a962d` | `docs/qualite/SANTE.md` (passage 1, 23 oct.) | Régression interne `check:coquille` ; constats C-001 à C-004 |
| SIM | `claude/refonte-sim-bac-a-sable` | **en cours**, non fusionnée, 2 commits | `95d9765` | `docs/simulation/CARTE-POINTS-FAIBLES.md` | Constats d'intégrité et de performance publiés ; sécurité en local |
| G0 | — | **retirée** | — | — | S6 couvre le diagnostic de la Garde |

### Zones

| Session | Zone |
|---|---|
| Lot 00 à 09 | `src/refonte/<lot>/**`, le fichier de sa famille dans `src/refonte/modules/declarations/`, ses textes dans `src/refonte/<lot>/i18n.ts`, sa section de `STATUT.md`. LOT-00 seul écrit dans `src/socle/**`, et livre le mécanisme de substitution. |
| S6 | `docs/securite/**` (hors dépôt) et `src/securite/**` ; pour LOT-07, `src/refonte/outils/**`. Pour tout le reste, des tickets proposés en privé, sans rien modifier. |
| F1 | `src/ateliers/**` et `docs/atelier/**`. Branchement seulement à l'intégration d'un module choisi. |
| T1 | `tests/**`, `scripts/qualite/**`, `docs/qualite/**`. Aucun constat de sécurité dans `docs/qualite/` : ils vont à S6, en privé. |
| SIM | `simulation/**` et `docs/simulation/**` ; `package.json` pour ses scripts. |

**Relances automatiques : aucune**, tant que Harun n'a pas validé le plafond proposé (une relance par nuit et par piste).

## 5. Ordre et prochaines actions

Fait : S0, S3, S1, S5, S2 (anciennes tranches).

1. **Au prochain point** (sur ton feu vert) : fusionner dans `refonte-vivante` les 4 commits de S5 (`b82e50f`, fusion propre), pour que S0 les reprenne avant la fusion de LOT-00. Ensuite T1 et SIM : sans conflit avec `refonte-vivante`, rien sous `src/` (SIM ajoute seulement des scripts à `package.json`).
2. **S0** poursuit LOT-00 sur `claude/refonte-socle`, partie de `e97f479`.
3. **Fusion de LOT-00**, conditions : `typecheck`, `typecheck:business`, `lint` et les contrôles de `editions.yml` verts ; paquet client identique ; `check:coquille` interne vert ; mécanisme de substitution livré ; composants listés au §7. Aucun autre lot ne démarre avant.
4. **Lots 01 à 08** en parallèle depuis `refonte-vivante`. LOT-07 attend la fin de la phase sécurité de S6 ; LOT-06 attend ta réponse sur S7.
5. **LOT-09** quand les lots 01 à 08 sont fusionnés.
6. **Fusion d'un lot** : relue par T1, paquet client identique, gardes vertes ; **Harun valide** avant tout passage dans `main`. Jamais de fusion dans `main` par le CO.

Dépendances croisées à surveiller : pastille de La Garde (LOT-00 ← règle de N02, LOT-08) ; connecteurs (LOT-04 lit l'état, LOT-07 le configure) ; `TousLesModules` et registre (LOT-00 D02, propriétaire S5) ; widgets du tableau de bord H25 (LOT-01) qui peuvent afficher des éléments de La Garde.

## 6. Ce qui manque au CO

- **Les 127 images et les `_data/*.json`** : l'exemplaire « sans images » reçu ne les contient pas. Le CO n'a donc vérifié les fiches que contre l'index et le texte. Chaque session de lot, et T1, ont besoin de l'exemplaire complet, hors dépôt.
- **Ce que S0 a fait depuis le 24 oct.** : seul `e97f479` est visible.
- **La phase 1 de S6** (privée).
- **Tes réponses** : F1 ou S7 pour LOT-06 ; qui prend LOT-09 ; les widgets natifs sont-ils hors du premier jet (§1.4).

## 7. Écrans (127)

Une ligne par écran, par lot. **Chaque session ne modifie que la section de son lot** (état : `à faire`, `en cours`, `fait`, `écart`, avec la raison en note). Les sections sont séparées pour que les branches ne se gênent pas à la fusion. Le CO tient les autres sections.

Total : 127 écrans = 19 re-habillage + 82 mixtes + 26 nouveaux. À la fin de LOT-00, S0 ajoute ici la liste des composants disponibles et leur chemin.

### LOT-00 · Système et démarrage — `claude/refonte-socle` — 8 écrans

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| H40 | Système · Notifications | mixte | à faire | |
| H41 | Système · Recherche ⌘K | mixte | à faire | |
| H42 | Système · Démarrage | mixte | à faire | |
| H47 | Système · Choisir son métier | mixte | à faire | |
| H43 | Système · États et messages | nouveau | à faire | |
| D02 | Système · Tous les modules | mixte | à faire | |
| G06 | Système · Connexion | re-habillage | à faire | |
| G05 | Échanger · Ajmani, barre ⌘J ouverte | mixte | à faire | |

### LOT-01 · Ma journée — `claude/refonte-journee` — 16 écrans

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| N01 | Ma journée · Accueil | mixte | à faire | |
| H25 | Ma journée · Tableau de bord, widgets | re-habillage | à faire | |
| G08 | Ma journée · Cockpit client : Stripe, utilisateurs, tickets | mixte | à faire | |
| H01 | Ma journée · Calendrier | re-habillage | à faire | |
| H02 | Ma journée · Tâches | re-habillage | à faire | |
| H03 | Ma journée · Missions et tickets, kanban | re-habillage | à faire | |
| H04 | Ma journée · Bilan de la semaine | mixte | à faire | |
| MJ01 | Ma journée · Projets | mixte | à faire | |
| MJ03 | Ma journée · Planning de l'équipe | mixte | à faire | |
| MJ02 | Ma journée · Habitudes | mixte | à faire | |
| MJ04 | Ma journée · Notes rapides | mixte | à faire | |
| MJ05 | Ma journée · Rappels | mixte | à faire | |
| L03 | Ma journée · Rituel du matin | nouveau | à faire | |
| L02 | Ma journée · Mode Focus | nouveau | à faire | |
| L01 | Ma journée · Séries et jalons | nouveau | à faire | |
| L07 | Ma journée · Défis d'équipe | nouveau | à faire | |

### LOT-02 · Mes contacts et clients — `claude/refonte-contacts` — 13 écrans

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| F10 | Contacts · Vue d'ensemble | nouveau | à faire | |
| H05 | Contacts · Clients | re-habillage | à faire | |
| G04 | Contacts · Fiche client | re-habillage | à faire | |
| H06 | Contacts · Prospects | re-habillage | à faire | |
| H44 | Contacts · Retours clients | mixte | à faire | |
| H45 | Contacts · Fournisseurs | mixte | à faire | |
| MC01 | Contacts · Pipeline commercial | mixte | à faire | |
| MC02 | Contacts · Fidélité | mixte | à faire | |
| MC03 | Contacts · Fiches contacts | mixte | à faire | |
| MC04 | Contacts · Équipe | mixte | à faire | |
| MC05 | Contacts · Partenaires | mixte | à faire | |
| MC06 | Contacts · Rendez-vous clients | mixte | à faire | |
| MC07 | Contacts · Relances | mixte | à faire | |

### LOT-03 · Écrire et retenir — `claude/refonte-ecrire` — 9 écrans

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| F20 | Écrire · Vue d'ensemble | nouveau | à faire | |
| H10 | Écrire · Notes | re-habillage | à faire | |
| H11 | Écrire · Documents | re-habillage | à faire | |
| H12 | Écrire · Signatures | re-habillage | à faire | |
| ME03 | Écrire · Modèles | mixte | à faire | |
| ME01 | Écrire · Journal | mixte | à faire | |
| ME02 | Écrire · Rédaction et traduction | mixte | à faire | |
| ME04 | Écrire · Archives | mixte | à faire | |
| ME05 | Écrire · Base de connaissances | mixte | à faire | |

### LOT-04 · L'argent — `claude/refonte-argent` — 17 écrans

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| F30 | Argent · Vue d'ensemble | nouveau | à faire | |
| G03 | Argent · Facturation | mixte | à faire | |
| H07 | Argent · Devis | mixte | à faire | |
| H08 | Argent · Dépenses | mixte | à faire | |
| H09 | Argent · Prévisions | mixte | à faire | |
| MA07 | Argent · Trésorerie | mixte | à faire | |
| MA04 | Argent · Impayés | mixte | à faire | |
| MA01 | Argent · Contrats | mixte | à faire | |
| MA02 | Argent · Comptabilité | mixte | à faire | |
| MA03 | Argent · Paiements en ligne | mixte | à faire | |
| MA05 | Argent · Notes de frais | mixte | à faire | |
| MA06 | Argent · Budget | mixte | à faire | |
| MA08 | Argent · TVA et impôts | mixte | à faire | |
| MA09 | Argent · Abonnements récurrents | mixte | à faire | |
| MA10 | Argent · Banque | mixte | à faire | |
| MA11 | Argent · Paie | mixte | à faire | |
| MA12 | Argent · Tarifs et remises | mixte | à faire | |

### LOT-05 · Échanger — `claude/refonte-echanger` — 10 écrans

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| F40 | Échanger · Vue d'ensemble | nouveau | à faire | |
| G07 | Échanger · Messagerie d'équipe | re-habillage | à faire | |
| H13 | Échanger · Appels | mixte | à faire | |
| H14 | Échanger · Annonces | re-habillage | à faire | |
| MX01 | Échanger · Courriel | mixte | à faire | |
| MX02 | Échanger · Réunions | mixte | à faire | |
| MX03 | Échanger · Partage de fichiers | mixte | à faire | |
| MX04 | Échanger · Canaux | mixte | à faire | |
| MX05 | Échanger · Sondages | mixte | à faire | |
| MX06 | Échanger · Réponses automatiques | mixte | à faire | |

### LOT-06 · Créer et produire — `claude/refonte-creer` — 15 écrans

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| F50 | Créer · Vue d'ensemble | nouveau | à faire | |
| H15 | Créer · Stock | mixte | à faire | |
| H16 | Créer · Chantiers | mixte | à faire | |
| H17 | Créer · Visuels et marque | mixte | à faire | |
| MR01 | Créer · Vidéo | mixte | à faire | |
| MR02 | Créer · Ma page publique | mixte | à faire | |
| MR03 | Créer · Tournées | mixte | à faire | |
| MR04 | Créer · Matériel | mixte | à faire | |
| MR05 | Créer · Catalogue produits | mixte | à faire | |
| MR06 | Créer · Réservations | mixte | à faire | |
| MR07 | Créer · Commandes | mixte | à faire | |
| MR08 | Créer · Boutique en ligne | mixte | à faire | |
| MR09 | Créer · Flotte de véhicules | mixte | à faire | |
| MR10 | Créer · Photos de chantier | mixte | à faire | |
| MR11 | Créer · Qualité et contrôles | mixte | à faire | |

### LOT-07 · Outils et réglages — `claude/refonte-outils` — 16 écrans

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| F60 | Outils · Vue d'ensemble | nouveau | à faire | |
| H18 | Outils · Paramètres | re-habillage | à faire | |
| H19 | Outils · Membres et accès | re-habillage | à faire | |
| H20 | Outils · Automatisations | mixte | à faire | |
| H21 | Outils · Connecteurs | mixte | à faire | |
| H22 | Outils · Corbeille et historique | mixte | à faire | |
| H23 | Outils · Assistance | mixte | à faire | |
| H24 | Outils · Coffre-fort | re-habillage | à faire | |
| L04 | Outils · Galerie de modèles par métier | nouveau | à faire | |
| L05 | Outils · Import guidé | nouveau | à faire | |
| L06 | Outils · Nouveautés et aide | nouveau | à faire | |
| MO01 | Outils · Calculs | mixte | à faire | |
| MO02 | Outils · Sites et trackers | mixte | à faire | |
| MO03 | Outils · Sauvegardes | mixte | à faire | |
| MO04 | Outils · Import et export | mixte | à faire | |
| MO05 | Outils · Raccourcis et favoris | mixte | à faire | |

### LOT-08 · La Garde et la supervision — `claude/refonte-garde` — 12 écrans

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| F70 | La Garde · Vue d'ensemble | nouveau | à faire | |
| N02 | La Garde · Salle de contrôle | mixte | à faire | |
| N03 | La Garde · Veille H24 | mixte | à faire | |
| H30 | La Garde · Organisations | mixte | à faire | |
| H31 | La Garde · Fiche organisation | re-habillage | à faire | |
| H32 | La Garde · Incident | mixte | à faire | |
| H33 | La Garde · Rondes | re-habillage | à faire | |
| H34 | La Garde · Maturité SOC | mixte | à faire | |
| H35 | La Garde · Journal d'accès | re-habillage | à faire | |
| MG01 | La Garde · Alertes | mixte | à faire | |
| MG02 | La Garde · Journal de sécurité | mixte | à faire | |
| MG03 | La Garde · Produits cyber | mixte | à faire | |

### LOT-09 · Mobile et tablette — `claude/refonte-mobile` — 11 écrans

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| H46 | Mobile · Accueil, tâches, ticket urgent | nouveau | à faire | |
| MB02 | Mobile · Agenda et clients | nouveau | à faire | |
| MB03 | Mobile · Argent | nouveau | à faire | |
| MB04 | Mobile · Messages et alertes | nouveau | à faire | |
| MB05 | Mobile · Recherche, Ajmani, dictée | nouveau | à faire | |
| MB06 | Mobile · Tableau de bord, tickets, modules | nouveau | à faire | |
| MB07 | Mobile · Scan de reçu, dépense, hors ligne | nouveau | à faire | |
| MB08 | Mobile · La Garde | nouveau | à faire | |
| MB09 | Mobile · Connexion, démarrage, écran verrouillé | nouveau | à faire | |
| T01 | Tablette · Accueil | nouveau | à faire | |
| T02 | Tablette · Clients en vue scindée | nouveau | à faire | |

## 8. Références

### Le dépôt est public

`aaronsyaa-dev/amn-desktop` est **public**. Rien qui décrive une faille de sécurité n'y est poussé (documents, commentaires, commits, noms de branche) ; `docs/securite/` est ignoré par `.gitignore`. La règle 4 du dossier de construction dit la même chose. Les images des maquettes et le dossier `AMN-refonte-CO` restent hors dépôt. Des documents déjà publiés sur `main` décrivent des mécanismes de détection (`docs/nuit-2026-08-28.md`, `docs/audit-soc.md`, `docs/casser-2026-09-04.md`) : à faire relire par S6, et/ou passer le dépôt en privé. **À trancher par Harun.**

### Niveau d'un module

`essentiel`, `courant`, `avance`, affichés Essentiel, Courant, Avancé (registre de S5). F1 est aligné (`59056ad`). Le dossier de construction compte 101 modules : 16 essentiels, 62 courants, 23 avancés, ce que le registre de S5 donne déjà.

### Gardes

- **Sans navigateur** : `typecheck`, `typecheck:business`, `lint`, 43 `check:*` de `editions.yml`. Chaque lot les lance avant de rendre la main ; le CO les relance à chaque fusion.
- **Avec navigateur** (`isolation`, `mouvement`, `contraste`, `mobile`, `coquille`, `focus`, `cibles`, `etiquettes`, `largeur`, `signal`, `business`) : lancées par T1 dans son bac à sable (passage 1 du 23 oct.). Elles ne tournent pas en CI ; T1 propose de les y mettre (`docs/qualite/proposition-ci.md`). Défauts hérités de `main` et inchangés : `focus`, `cibles`, `etiquettes`, `largeur`. Apportés par la refonte : `coquille` interne (S1), `#/tous-les-modules` en cibles et en largeur (S5), une fenêtre sans focus sur l'organigramme de la Garde (S3).
- **CI GitHub** : « Garde-fous croisés » échoue à « Récupérer amn-api » (secret `AMN_API_TOKEN` refusé). Cela ne dépend pas du code ; **le secret est à renouveler**.

### Bus de moments

Types de la Garde ajoutés au point 1 : `garde.escalade` (critique), `site.muet` (decision), `garde.remontee-critique` (critique). La liste des tons critiques est fermée dans `check:moments` : l'allonger passe par le CO. Émis aujourd'hui : `client.cree` et `facture.payee` par `@edition/socle` ; `tache.terminee` par l'Accueil.

### Isolement des éditions

Contrôlé par lecture des sources (`check:navigation`, `check:garde-refonte`, `check:accueils`, `check:ajmani`) et sur le vrai paquet client (« Build business + contrôle de fuite » en CI, comparateur de T1). À terme : un seul contrôle fondé sur le graphe d'imports depuis la racine cliente.

### Journal des fusions

| Date | Branche | sha | Résultat |
|---|---|---|---|
| 2026-10-20 | `claude/refonte-s0-socle` | `b7453e3` → `9a6ffe7` | sans conflit |
| 2026-10-22 | `claude/refonte-s3-supervisor` | `e7f4f25` → `596239e` | sans conflit |
| 2026-10-22 | `claude/refonte-s1-navigation` | `e788af8` → `c5f4707` | conflit additif dans `editions.yml`, les deux étapes gardées |
| 2026-10-22 | (CO) | `c808dae` | 3 types de moments ; `check:navigation` corrigé pour S3 |
| 2026-10-22 | `claude/refonte-s5-modules` | `69cd802` → `25c1d0d` | sans conflit |
| 2026-10-22 | `claude/refonte-s2-accueil` | `a537dbe` → `408a3f5` | sans conflit ; `check:clavier` rouge, corrigé par le CO (`c88814c`) |
| 2026-10-22 | (CO, branche F1) | `274381f` → `59056ad` | niveau `expert` → `avance` |
| 2026-10-31 | — | `f059f32` | nouveau plan : 10 lots, 127 écrans ; aucune fusion de code |
