# Refonte vivante — statut

> Tenu par le CO. Une session ne modifie que **la section de son lot** dans « 7. Écrans » (une ligne par écran) ; tout le reste est au CO. Règles : [`REGLES.md`](REGLES.md).

- Branche d'intégration : **`claude/refonte-vivante`** (décision du 31 oct., §1.1). Base `main` @ `630ef45`.
- Dernière mise à jour : 2026-11-01. Décisions de Harun : LOT-06 confié à S7 (F1 écartée), LOT-09 à S1 après LOT-02, widgets natifs hors du premier jet. Nouveau lot **LOT-10 Cyber** (14 écrans, S6) : **141 écrans, 11 lots**.
- **LOT-00 n'est pas encore fusionné** : 8 écrans sur 8 faits sur `claude/refonte-socle`, il reste quatre tâches à S0 (§5).
- Fusionnés le 1er nov. : T1 (API d'essai, bac à sable) et les données fictives de SIM, avec `check:donnees` en CI.
- Gardes locales sur `refonte-vivante` : `typecheck`, `typecheck:business`, `lint` et les 44 contrôles sans navigateur de `editions.yml` verts.
- Le dossier de construction n'est pas committé (dépôt public). Les images arrivent lot par lot, dans le zip de chaque lot.

## 1. Décisions du CO (31 oct., complétées le 1er nov.)

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
6. Le registre de S5 a un fichier par famille (`src/refonte/modules/declarations/<famille>.ts`), ce qui donne un fichier par lot : jour = LOT-01, contacts = LOT-02, ecrire = LOT-03, argent = LOT-04, echanger = LOT-05, creer = LOT-06, outils = LOT-07, garde = LOT-08, et `cyber` (nouveau fichier, famille contextuelle) = LOT-10. Pas de collision.

### 1.4 Mobile et tablette (LOT-09) : PWA responsive, même code

**Décision : on continue la PWA existante** (`docs/PWA.md`), sans second code ni nouvelle dépendance (règle 9 du dossier).

Le dépôt a déjà ce qu'il faut : le même renderer tourne en PWA installable (manifeste, `sw.js`), le pont navigateur parle à amn-api avec la synchro temps réel, `fileEnvoi.ts` et `EnvoiEnAttente` font la file d'attente hors ligne, `src/assistant/voix.ts` la voix, `useEtroit` le responsive, et `check:mobile`, `check:largeur` et `check:cibles` mesurent déjà le téléphone.

- Les écrans MB et T sont des vues propres à l'édition interne, branchées par le même mécanisme de substitution que les autres lots (§1.3). Seuils proposés : téléphone < 768 px, tablette de 768 à 1199 px (rail 76 px, vue scindée), bureau ≥ 1200 px. LOT-09 peut les ajuster.
- Cibles tactiles ≥ 42 px (04-C : MB04 et MB05 sont à 32-34 px sur les images).
- **Limites assumées en PWA** : scan de reçu (MB07) par la caméra du navigateur, sans scanneur natif ; dictée (MB05) par `voix.ts`, à tester sur iPhone avant de promettre.
- **MB09 (widgets et écran verrouillé)** : non faisable en PWA. Premier jet = connexion, démarrage, notifications web avec **aperçu masqué par défaut** (04-B #6). Les widgets natifs sont **hors du premier jet** (*confirmé par Harun le 1er nov.*) ; si Harun les veut, l'étape suivante est une enveloppe Capacitor autour du même build web, décidée à part. React Native (second code) est écarté.
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

### 1.7 La famille Cyber dans la barre latérale (LOT-10)

État du socle (`claude/refonte-socle`) :

- `BarreLaterale` reçoit `familles` (les 7 de base) et `garde` (la 8e, sous un filet).
- `src/socle/familles.ts` ne connaît que les 7.
- La Garde a son jeton `--socle-fam-garde` (`#D6D6DA`). Le fichier 05 donne la même valeur à Cyber : les deux se distinguent par l'**icône** (bouclier, cible), pas par la couleur.

Comment l'ajouter sans changer les 127 autres écrans :

1. **Socle** (S0, petit complément « LOT-00b » juste après la fusion de LOT-00, avant que LOT-10 ne démarre) :
   - `BarreLaterale` gagne une prop facultative `contextuelle?: FamilleLaterale | null`, avec son icône. Elle s'affiche sous le bloc de La Garde, dépliée. Absente ou `null`, le rendu est **identique à aujourd'hui** : `check:socle-coquille` le prouve par un rendu statique avec et sans.
   - Jeton `--socle-fam-cyber: #d6d6da` dans `noir.css`. La teinte `cyber` est acceptée par `FamilleLaterale` comme celle de La Garde, **sans** l'ajouter aux 7 familles de base : D02 et « Tous les modules (101) » ne bougent pas.
   - `src/refonte/coquille/donnees.ts` ne passe `contextuelle` que si le module courant appartient à une famille déclarée « contextuelle » au registre.
2. **Registre** (LOT-10) :
   - un fichier `src/refonte/modules/declarations/cyber.ts`, famille marquée `contextuelle: true`, avec les sous-éléments Red Team, Blue Team, SOC, Veille, OSINT et Missions ;
   - hors des comptes de D02 ;
   - LOT-10 adapte `check:navigation` pour exclure les familles contextuelles des totaux.
3. **Liens** : « Ouvrir Cyber » sur F70 est fait par LOT-08 (c'est son écran) ; le renvoi de CY04 vers La Garde est fait par LOT-10.

### 1.8 Les 15 questions de S3 (note `docs/refonte/preparation-garde.md`, branche `claude/refonte-garde`)

**Règle générale : on habille ce qui existe, rien de neuf côté serveur dans ce lot.**

- Ce qui se calcule depuis les données existantes est calculé dans l'interface.
- Ce qui demande une donnée absente s'affiche « non disponible », avec la raison. Cela devient une demande à amn-api, notée dans la section du lot, et ne bloque pas l'écran.
- En cas de doute : la solution la plus simple, notée.

| # | Question | Règle |
|---|---|---|
| 1 | Route du hub F70 | `/ensemble/garde`, la route générique des « Vue d'ensemble » posée par LOT-00, que F70 remplit. `/garde` (Salle) et `/tour` restent inchangés. Même règle pour F10 à F60 : `/ensemble/<famille>`. |
| 2 | Un seul score de maturité | `scoreDe` (sur 100) fait foi pour F70, N02, H30, H31 et H34. Niveau 1 à 5 = tranches de 20 points. Les six domaines de H34 = les six signaux de `maturiteSoc.ts`. Pas de nouveau référentiel. |
| 3 | État et score par organisation | Règle N02 §6.1 calculée localement : le plus grave du score, des alertes ouvertes et du retard de ronde. « Dernière ronde » d'une organisation = dernière entrée de ronde de `garde.journal({ org })`. Rien côté amn-api. |
| 4 | Libellés d'état | **Sain / Attention / Critique** (04-B #3) sur tous les écrans refondus. Les anciens écrans et `src/i18n` restent inchangés. |
| 5 | Déclarer un incident ; prise en charge | Pas d'API serveur : bouton présent mais **désactivé**, avec la raison, plus une demande à amn-api. Pas d'incident local qui ne serait vu que d'un poste. Prise en charge : un mécanisme par objet. `acknowledgeIncident` pour un incident, `garde.prendre` pour une remontée. Les écrans refondus n'écrivent plus `suivis`. |
| 6 | Gravités et « alerte ouverte » | Trois niveaux affichés : Critique (critique / critical), Moyenne (haute, moyenne, normale, warning), Faible (faible, info). « Alerte ouverte » = remontées ouvertes de la Garde + incidents non résolus + alertes Cyber non prises en charge, chaque source comptée une fois, avec sa source affichée. MG02 lit `garde.journal` (`useJournalGarde`), sans troisième accès. |
| 7 | Astreinte (N03) | Hors du lot. « Qui veille » = les absences et retours existants (`garde.absence`, `garde.retour`). « Mode astreinte » absent, noté en écart. |
| 8 | Silence de nuit ; salles | Le réglage du silence de nuit va dans N03 (Veille H24), puisque `/garde/ajmani` ouvre désormais ⌘J (commit de S5 repris par LOT-00). N02 est la page de pilotage ; la Salle de situation de S3 reste l'écran de veille. |
| 9 | Périmètre Cyber | Zones de LOT-08 et LOT-10 élargies à `src/bureaux/cyber/**`, avec le partage de `REGLES.md` : LOT-08 possède `FicheIncident.tsx`, `Alertes.tsx` et `JournalAudit.tsx`, LOT-10 le reste. |
| 10 | Le mot « ronde » (H33) | L'écran s'adapte aux gardes du code. « Nouvelle ronde » ouvre le réglage d'une garde existante (`majAgent`). Pas de ronde programmable (la « Proposition B » attend Harun, 04-B #4). |
| 11 | Journal d'accès (H35) | Re-habillage du journal existant (ouvertures de dossiers par l'équipe), avec un titre et une légende qui le disent. « D'où » et « Résultat » : écart, plus une demande à amn-api. |
| 12 | Produits cyber (MG03) | Les produits = les outils existants (Scanner, Comply, SSL). « Client protégé » = organisation cliente qui a au moins un site surveillé (`clientOrgId`). Prix, objectifs et revenu récurrent : « non disponible », plus une demande. |
| 13 | Couleur de la famille | `--socle-fam-garde` (`#D6D6DA`, déjà dans le socle). LOT-08 aligne `declarations/garde.ts` sur ce jeton. |
| 14 | Raccourcis | On prend la touche de la fiche si elle est libre, sinon pas de raccourci (écart noté). On ne déplace jamais un raccourci existant. `⌘ ⇧ I` est libre en production ; `⌘ O` est libre ; `⇧ ⌘ O` reste au sélecteur d'organisation. |
| 15 | Textes | Français mot pour mot. Anglais traduit, avec les mêmes clés, dans `src/refonte/garde/i18n.ts` (le français est typé contre l'anglais, comme partout). |

### 1.9 Quand allumer la nouvelle coquille

La coquille de LOT-00 est éteinte par défaut (drapeau `amn.coquille`). **Proposition : l'allumer par défaut dans l'édition interne au moment de la fusion de LOT-00**, à trois conditions :

1. T1 a fait un passage sur le paquet interne, coquille allumée : `check:coquille`, `contraste`, `focus` et `mouvement`, sans régression par rapport à `main` ;
2. Harun l'a regardée une dizaine de minutes sur un vrai poste ;
3. le réglage « Paramètres › Nouvelle coquille » reste, pour revenir en arrière, jusqu'à la fin de LOT-09. L'ancienne coquille est retirée après LOT-09.

Pourquoi ce moment :

- les 141 maquettes sont dessinées dans la nouvelle coquille, et T1 ne peut comparer à ± 2 px que coquille allumée ;
- chaque lot construit dedans ;
- l'édition cliente n'est pas concernée (couture vide).

Le prix : pendant la transition, les écrans pas encore refondus s'affichent dans la nouvelle coquille. C'est acceptable pour une édition interne à trois personnes. S0 change la valeur par défaut (une ligne de `drapeau.ts`) quand Harun dit oui.

## 2. Les lots

Ordre : **LOT-00 d'abord, fusionné** ; puis les lots 01 à 08 et **10** en parallèle, une branche chacun ; **LOT-09 en dernier**. Les chiffres viennent de `03-INDEX.md` : 8 + 16 + 13 + 9 + 17 + 10 + 15 + 16 + 12 + 11 + 14 = **141**. (Le tableau du fichier 00 compte G05 dans LOT-05 ; l'index et les prompts le rangent dans LOT-00. Le CO suit l'index.)

| Vague | Lot | Écrans (re-habillage / mixte / nouveau) | Branche | Session | Modèle · effort | Dépend de | État |
|---|---|---|---|---|---|---|---|
| 1 | **LOT-00** Système et démarrage | 8 (1 / 6 / 1) | `claude/refonte-socle` | S0 | Opus 5.5, élevé | aucune | **fait, non fusionné** (§5) |
| 2 | **LOT-01** Ma journée | 16 (4 / 8 / 4) | `claude/refonte-journee` | S2 | Sonnet 5.5, élevé | LOT-00 fusionné | à faire |
| 2 | **LOT-02** Mes contacts et clients | 13 (3 / 9 / 1) | `claude/refonte-contacts` | S1 | Sonnet 5.5, élevé | LOT-00 fusionné | à faire |
| 2 | **LOT-03** Écrire et retenir | 9 (3 / 5 / 1) | `claude/refonte-ecrire` | S5 | Sonnet 5.5, élevé | LOT-00 fusionné | à faire |
| 2 | **LOT-04** L'argent | 17 (0 / 16 / 1) | `claude/refonte-argent` | DS | Sonnet 5.5, élevé | LOT-00 fusionné | à faire |
| 2 | **LOT-05** Échanger | 10 (2 / 7 / 1) | `claude/refonte-echanger` | S5 | Sonnet 5.5, élevé | LOT-00 fusionné ; après LOT-03 | à faire |
| 2 | **LOT-06** Créer et produire | 15 (0 / 14 / 1) | `claude/refonte-creer` | S7 (à créer) | Sonnet 5.5, élevé | LOT-00 fusionné | à faire |
| 2 | **LOT-07** Outils et réglages | 16 (3 / 9 / 4) | `claude/refonte-outils` | S6 | Opus 5.5, élevé | LOT-00 fusionné ; phase 1 de S6 | à faire |
| 2 | **LOT-08** La Garde et la supervision | 12 (3 / 8 / 1) | `claude/refonte-garde` | S3 | Opus 5.5, élevé | LOT-00 fusionné | préparation (note, §1.8) |
| 3 | **LOT-09** Mobile et tablette | 11 (0 / 0 / 11) | `claude/refonte-mobile` | S1, après LOT-02 | Sonnet 5.5, élevé | lots 01 à 08 et 10 fusionnés | à faire |
| 2 | **LOT-10** Cyber | 14 (0 / 4 / 10) | `claude/refonte-cyber` | S6, après LOT-07 | Opus 5.5, élevé | LOT-00 et LOT-00b fusionnés ; phase 1 de S6 ; LOT-07 | à faire |

## 3. Répartition (décisions de Harun du 1er nov. incluses)

| Session | Lot | Avis | Précisions |
|---|---|---|---|
| S0 Socle | LOT-00, puis LOT-00b | ✓ | 8 écrans sur 8 faits. Il reste quatre tâches avant la fusion, et LOT-00b après (§5). |
| S2 | LOT-01 | ✓ | N01 remplace son Accueil ; M1, M2 et M4 sont absorbés par G05, H40 et H42. Ses 5 commits postérieurs (`b228f5d`) ne sont pas fusionnés. |
| S1 | LOT-02, puis LOT-09 | ✓ | **LOT-09 confié à S1 après LOT-02** (décision de Harun). |
| S5 | LOT-03, puis LOT-05 | ✓ | S5 reste propriétaire du registre. |
| DS | LOT-04 | ✓ à condition | Ne pousse plus dans `src/socle/**`. Banque en lecture seule ; LOT-04 n'affiche que l'état « connecté / à connecter », la configuration est dans H21 (LOT-07). |
| **S7** (nouvelle) | LOT-06 | ✓ | **Décision de Harun : LOT-06 confié à S7, F1 écartée.** Sonnet 5.5, effort élevé. À créer. |
| F1 | — | écartée de LOT-06 | Continue l'Atelier. Vérificateur cassé sur `refonte-vivante` (C-003, patch de T1 à appliquer par F1). Ses modules rejoignent les familles par le registre, après LOT-06. |
| S6 | LOT-07, puis LOT-10 | ⚠ à condition | Les deux après sa phase 1 (privée ; Harun dit au CO quand elle est finie). LOT-07 d'abord : CY07 étend MO02 (Sites et trackers), qui est dans LOT-07. 30 écrans à elle seule, Opus 5.5, effort élevé. Audit privé ; commits sans description de faiblesse ; écrans sensibles relus par T1. |
| S3 | LOT-08 | ✓ | Règles du §1.8. Zone élargie à `src/bureaux/cyber/**` (partage dans `REGLES.md`). Ajoute « Ouvrir Cyber » sur F70. |
| T1 | transversal | ✓ | API d'essai et bac à sable **fusionnés** (`97929c1`). Seule session autorisée à `build:web` sur données fictives (`REGLES.md`). Fait les captures et les comparaisons à ± 2 px de tous les lots. L'outil de fidélité est sur `claude/refonte-qualite` (`f2e243a`, non fusionné). |
| SIM | transversal | ✓ | 25 jeux fusionnés (`src/refonte/donnees/`), **`check:donnees` branché en CI**. Reste à faire : les jeux d'Écrire, Échanger, Créer, Outils, La Garde et Cyber, puis les chargeurs vers l'API d'essai. |

## 4. Sessions et branches (état au 1er nov.)

| Session | Branche | État | Dernier sha | Rapport | Points |
|---|---|---|---|---|---|
| S0 / LOT-00 | `claude/refonte-socle` | **8 sur 8 faits, non fusionné** (§5) | `fdd6366` | `rapports/LOT-00.md` (sur sa branche) | Questions de LOT-00 : §7, section LOT-00 |
| DS | `claude/refonte-design-socle` | gelée, reprise par LOT-00 | `e97f479` | `rapports/DS.md` (branche LOT-00) | — |
| S1 | `claude/refonte-s1-navigation` | fusionnée (ancienne tranche) | `e788af8` | [`rapports/S1.md`](rapports/S1.md) | Prend LOT-02 puis LOT-09 |
| S2 | `claude/refonte-s2-accueil` | fusionnée à `a537dbe` ; 5 commits non fusionnés | `b228f5d` | [`rapports/S2.md`](rapports/S2.md) | Remplacée par LOT-01 |
| S3 | `claude/refonte-s3-supervisor` (ancienne), `claude/refonte-garde` (LOT-08) | ancienne fusionnée ; LOT-08 en préparation (note seulement, aucun code) | `e7f4f25`, `2eedc9b` | `docs/refonte/preparation-garde.md` (branche LOT-08) | 15 questions tranchées au §1.8 |
| S4 | — | annulée | — | — | — |
| S5 | `claude/refonte-s5-modules` | fusionnée à `69cd802` ; 4 commits **à reprendre par S0** | `b82e50f` | [`rapports/S5.md`](rapports/S5.md) | Conflit `src/socle/i18n.ts` |
| S6 | `claude/refonte-sec-*` | phase 1 en cours, privée. **Ne pas fusionner sans décision de Harun.** | — | `docs/securite/**`, hors dépôt | Prend LOT-07 puis LOT-10 |
| S7 | `claude/refonte-creer` | **à créer** | — | — | LOT-06 |
| F1 | `claude/refonte-atelier-f1` | prête, non fusionnée, rien de branché | `59056ad` | `docs/atelier/PRET.md` | C-003 à appliquer ; [`INTEGRATION-F1.md`](INTEGRATION-F1.md) à valider |
| T1 | `claude/refonte-qualite-t1`, `claude/refonte-qualite` | **`qualite-t1` fusionnée** (`97929c1`) ; `qualite` (fidélité) non fusionnée | `51a962d`, `f2e243a` | [`../qualite/SANTE.md`](../qualite/SANTE.md) | Passage 2 attendu sur LOT-00 |
| SIM | `claude/refonte-sim-bac-a-sable`, `claude/refonte-donnees-fictives` | **données fusionnées** (`d017393`) + `check:donnees` en CI ; bac à sable non fusionné | `95d9765`, `d017393` | [`rapports/DONNEES.md`](rapports/DONNEES.md) | Jeux des autres lots à faire |
| G0 | — | retirée | — | — | — |

### Zones

| Session | Zone |
|---|---|
| Lots 00 à 10 | `src/refonte/<lot>/**`, le fichier de sa famille dans `src/refonte/modules/declarations/`, ses textes dans `src/refonte/<lot>/i18n.ts`, sa section de `STATUT.md`. LOT-00 seul écrit dans `src/socle/**` et livre le mécanisme de substitution. |
| LOT-08 et LOT-10 | en plus, `src/bureaux/cyber/**`, partagé selon `REGLES.md`. LOT-10 : `src/refonte/cyber/**` et `declarations/cyber.ts`. |
| S6 | `docs/securite/**` (hors dépôt) et `src/securite/**` ; pour ses lots, `src/refonte/outils/**` et `src/refonte/cyber/**`. |
| F1 | `src/ateliers/**` et `docs/atelier/**`. |
| T1 | `tests/**`, `scripts/qualite/**`, `docs/qualite/**`. Constats de sécurité : à S6, en privé. |
| SIM | `simulation/**`, `docs/simulation/**`, `src/refonte/donnees/**`, `scripts/check-donnees.ts`. |

**Relances automatiques : aucune**, tant que Harun n'a pas validé le plafond proposé (une relance par nuit et par piste).

## 5. Ordre et prochaines actions

**LOT-00 n'est pas fusionné dans `refonte-vivante`.** Le lot est fait (8 écrans sur 8). Sur une fusion d'essai avec `refonte-vivante`, `typecheck`, `typecheck:business`, `lint` et les 54 contrôles sans navigateur de sa CI passent. Il reste quatre choses à faire par **S0 sur `claude/refonte-socle`**, dans cet ordre :

1. **Fusionner `claude/refonte-vivante`** dans sa branche. 1 conflit, `docs/refonte/STATUT.md` : prendre la version de `refonte-vivante`, où le CO a déjà reporté le tableau de LOT-00 et la liste des composants (§7).
2. **Reprendre les 4 commits de S5** : fusionner `claude/refonte-s5-modules` (`b82e50f`). 1 conflit, `src/socle/i18n.ts` : garder les deux côtés, c'est-à-dire le nom « Créer et produire » de S5 et les nouvelles clés de LOT-00. Vérifier aussi que `/garde/ajmani` ouvre bien la **nouvelle** palette ⌘J (G05), et pas l'ancien panneau.
3. **Livrer le mécanisme de substitution d'écran** (§1.3). Sans lui, un lot ne peut pas re-habiller un écran existant sans toucher `appRoot.internal.tsx`, et huit lots s'y croiseraient. Point d'accroche naturel : l'`<Outlet />` que `AppLayout` place dans `CoquilleRefonte`.
4. **Relancer les gardes et pousser**. Puis T1 fait son passage 2 : paquet client identique, gardes navigateur coquille éteinte et allumée. Ensuite **le CO fusionne** LOT-00 dans `refonte-vivante`.

Après la fusion :

- **LOT-00b** (S0, court) : la famille contextuelle Cyber (§1.7), et l'allumage de la coquille si Harun dit oui (§1.9).
- **Lots 01 à 08** en parallèle depuis `refonte-vivante`. LOT-06 démarre quand S7 est créée ; LOT-07 attend la fin de la phase 1 de S6.
- **LOT-10** après LOT-07 (même session) et LOT-00b.
- **LOT-09** (S1) en dernier, après les lots 01 à 08 et 10.
- **Fusion d'un lot** : relu par T1, paquet client identique, gardes vertes. Harun valide avant tout passage dans `main`, et le CO ne fusionne jamais dans `main`.

Dépendances croisées à surveiller :

- la pastille de La Garde (LOT-00 l'affiche, LOT-08 en fixe la règle, N02) ;
- les connecteurs (LOT-04 lit leur état, LOT-07 les configure) ;
- le registre et `TousLesModules` (propriétaire S5) ;
- Cyber : CY07 étend MO02 (LOT-07), CY11 s'appuie sur H20 (LOT-07), CY12 sur H03 (LOT-01), CY13 sur H11 et H12 (LOT-03), CY04 et F70 se renvoient l'un à l'autre (LOT-08).

## 6. Ce qui manque au CO

- Les images, qui arrivent dans le zip de chaque lot : la comparaison à ± 2 px se fera lot par lot, par T1.
- La fin de la phase 1 de S6 (privée) : LOT-07 et LOT-10 l'attendent.
- Ton feu vert sur trois propositions : les règles du §1.8 (questions de S3), l'allumage de la coquille (§1.9), la procédure F1 ([`INTEGRATION-F1.md`](INTEGRATION-F1.md)).
- La création de la session S7.

## 7. Écrans (141)

Une ligne par écran, par lot. **Chaque session ne modifie que la section de son lot** (état : `à faire`, `en cours`, `fait`, `écart`, avec la raison en note). Les sections sont séparées pour que les branches ne se gênent pas à la fusion. Le CO tient les autres sections.

Total : 141 écrans = 19 re-habillage + 86 mixtes + 36 nouveaux. Captures et comparaisons à ± 2 px : faites par T1 (colonne « Écart / note »).

### LOT-00 · Système et démarrage — `claude/refonte-socle` — 8 écrans

8 sur 8 faits par S0 (`fdd6366`, rapport `docs/refonte/rapports/LOT-00.md` sur la branche). **Non fusionné** : voir §5. Aucune capture, l'app n'ayant pas été lancée : T1 les fera au passage 2.

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| H40 | Système · Notifications | mixte | fait | `/notifications`, cloche de l'en-tête. Seul le canal « App » a des émetteurs ; mail et mobile : filtres seulement |
| H41 | Système · Recherche ⌘K | mixte | fait | « Écrire à X » ouvre `mailto:` ; pas de ⌘↵ (fenêtre unique d'Electron) |
| H42 | Système · Démarrage | mixte | fait | `/demarrage`, une fois, à la toute première connexion. Étapes 5 et 6 (paiement, appareil mobile) manuelles : aucune donnée de connecteur |
| H47 | Système · Choisir son métier | mixte | fait | `/demarrage/metier`. Réglage personnel, pas d'organisation ; « Passer » ne masque aucun module |
| H43 | Système · États et messages | nouveau | fait | `/dev/etats`, en développement seulement, et les briques `situations` |
| D02 | Système · Tous les modules | mixte | fait | Comptes par famille tirés du registre (14 / 7 / 12 / 12 / 15 / 7 / 19 / 15), pas de la maquette (12 / 14 / 9 / 18 / 10 / 16 / 14 / 8). Total 101 et niveaux 16 / 62 / 23 conformes |
| G06 | Système · Connexion | re-habillage | fait | `/login`. « Demandez un accès » affiche un texte, sans flux de demande ; « 12 organisations » est une constante de présentation à valider |
| G05 | Échanger · Ajmani, barre ⌘J ouverte | mixte | fait | Prépare un brouillon de relance, n'envoie rien ; « Décrire » passe à l'assistant existant |

Questions de S0 et réponses du CO :

1. *Allumer la nouvelle coquille par défaut ?* Proposition au §1.9, en attente de Harun.
2. *Phrase « Connexion protégée… journal de la Garde » et constante « 12 organisations » (G06) ?* À valider par Harun. Par défaut, on garde le texte de la fiche, et la constante reste un texte fixe, jamais une donnée lue avant la connexion.
3. *Réglage d'organisation pour le métier (H47) ?* Pas au premier jet : le réglage reste personnel, la solution la plus simple.
4. *Émetteurs « mail » et « mobile » pour H40 ?* Hors LOT-00. Le mobile passe par LOT-09 (notifications web), le mail devient une demande à amn-api.

Gardes en échec avant comme après le lot, sans lien avec lui : `check:encres` (`src/refonte/garde/equipes.ts`), `check:migration`, `check:xss`, `check:visite`, `check:support`. Aucune n'est dans la CI ; elles attendent un environnement.

#### Composants disponibles pour les autres lots

Tout s'importe depuis `src/socle/ui` (`index.ts`), dans le code interne seulement, jamais depuis un fichier partagé.

| Groupe | Dossier | Contenu |
|---|---|---|
| Base | `src/socle/ui/*.tsx` | `Bouton` (`raccourci`), `Carte`, `Modale`, `Saisie`, `TuileKpi`, `BarreProgression`, `AnneauProgression`, `Etiquette`, `PastilleEtat`, `Avatar`, `PileAvatars`, `Raccourci`, `CaseACocher`, `LigneTache`, `LigneActivite`, `EtapeFranchie`, `EtatVide`, `Squelette` |
| Contrôles | `controles/` | `Interrupteur`, `BoutonIcone`, `Selecteur`, `BoiteRecherche`, `Onglets`, `Segmente`, `SuggestionAjmani`, `Tag`, `SousCarte`, `CarteCases`, `CarteAnneau`, `CarteSerie`, `CarteJalon` |
| Situations | `situations/` | `EtatChargement`, `SqueletteLignes`, `DialogueConfirmation`, `FournisseurToasts` + `useToastsSocle`, `AvisCollaboration` |
| Graphiques | `graphiques/` | `Courbe`, `MiniCourbe`, `Barres`, `Donut`, `Anneau` ; formats `formaterNombre`, `formaterEuro`, `formaterPourcent` |
| Archétypes | `archetypes/` | `Page`, `RangeeKpi`, `ColonneDroite`, `Kanban`, `GrilleCartes`, `Scinde`, `Semaine`, `LigneTemps`, tableau triable (`trierLignes`…) |
| Coquille | `src/socle/coquille/` | `BarreLaterale`, `EnTete`, `BarreAjmani`, `Coquille` |
| Système | `src/refonte/systeme/` | notifications, recherche, Ajmani, modules, connexion, démarrage, H43, démonstration (`/dev/socle`) |

Mots fr/en par `definirMots`. Gardes : `check:socle-controles|graphiques|situations|archetypes|coquille`, `check:systeme-modules|notifications|recherche|ajmani|demo|demarrage`.

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

### LOT-10 · Cyber — `claude/refonte-cyber` — 14 écrans

Lire `05-CYBER-MODELE-COMMUN.md` : consentement d'abord (accord signé, périmètre, dates), OSINT limité à l'organisation du client, interface seulement. Famille contextuelle dans la barre latérale (§1.7).

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| CY01 | Cyber · Vue d'ensemble | nouveau | à faire | |
| CY02 | Cyber · Red Team | nouveau | à faire | |
| CY03 | Cyber · Blue Team | nouveau | à faire | |
| CY04 | Cyber · SOC | nouveau | à faire | |
| CY05 | Cyber · Veille | nouveau | à faire | |
| CY06 | Cyber · OSINT | nouveau | à faire | |
| CY07 | Cyber · Sites et vie privée | mixte | à faire | |
| CY08 | Cyber · Réponse à incident | nouveau | à faire | |
| CY09 | Cyber · Conformité | nouveau | à faire | |
| CY10 | Cyber · Sensibilisation | nouveau | à faire | |
| CY11 | Cyber · Automatisation | mixte | à faire | |
| CY12 | Cyber · Missions | mixte | à faire | |
| CY13 | Cyber · Documents | mixte | à faire | |
| CY14 | Cyber · Dossier de mission | nouveau | à faire | |

## 8. Références

### Le dépôt est public

`aaronsyaa-dev/amn-desktop` est **public**. Rien qui décrive une faille de sécurité n'y est poussé (documents, commentaires, commits, noms de branche) ; `docs/securite/` est ignoré par `.gitignore`. La règle 4 du dossier de construction dit la même chose. Les images des maquettes et le dossier `AMN-refonte-CO` restent hors dépôt. Des documents déjà publiés sur `main` décrivent des mécanismes de détection (`docs/nuit-2026-08-28.md`, `docs/audit-soc.md`, `docs/casser-2026-09-04.md`) : à faire relire par S6, et/ou passer le dépôt en privé. **À trancher par Harun.**

### Niveau d'un module

`essentiel`, `courant`, `avance`, affichés Essentiel, Courant, Avancé (registre de S5). F1 est aligné (`59056ad`). Le dossier de construction compte 101 modules : 16 essentiels, 62 courants, 23 avancés, ce que le registre de S5 donne déjà.

### Gardes

- **Sans navigateur** : `typecheck`, `typecheck:business`, `lint`, 44 `check:*` de `editions.yml` (dont `check:donnees`). Chaque lot les lance avant de rendre la main ; le CO les relance à chaque fusion.
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
| 2026-11-01 | `claude/refonte-qualite-t1` | `51a962d` → `97929c1` | sans conflit ; API d'essai, bac à sable, `SANTE.md` |
| 2026-11-01 | `claude/refonte-donnees-fictives` | `d017393` | sans conflit ; 25 jeux |
| 2026-11-01 | (CO) | `4da65a8` | `check:donnees` dans `package.json` et en CI ; 44 contrôles verts |
