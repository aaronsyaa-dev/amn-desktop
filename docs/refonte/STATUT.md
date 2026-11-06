# Refonte vivante — statut

> Tenu par le CO. Une session ne modifie que **la section de son lot** dans « 7. Écrans » (une ligne par écran) ; tout le reste est au CO. Règles : [`REGLES.md`](REGLES.md).

- Branche d'intégration : **`claude/refonte-vivante`** (décision du 31 oct., §1.1). Base `main` @ `630ef45`.
- Dernière mise à jour : 2026-11-06. Design v3 validé (§1.10). G09 Écran de veille ajouté à LOT-00 : **142 écrans**. S0 finit le socle v3 en mode ULTRA ; S7 est créée ; prompts de préparation dans [`PROMPTS-6NOV.md`](PROMPTS-6NOV.md) (§1.12).
- LOT-00 (socle v2) est fusionné (`488cdcc`), avec les 4 commits de S5. **Le socle v3 s'y ajoute avant la construction visuelle des lots** (S0 a ses consignes). D'ici là, chaque lot prépare et construit sa logique : §5.
- Fusionnés aussi le 1er nov. : T1 (API d'essai, bac à sable, contrôle de fidélité) et les données fictives de SIM (100 jeux, `4fe559b`), avec `check:donnees` en CI (87 contrôles).
- Gardes locales sur `refonte-vivante` : `typecheck`, `typecheck:business`, `lint` et les 55 contrôles sans navigateur de `editions.yml` verts.
- Sources : le dossier de construction **v3** (`AMN-refonte-v3-CO`) remplace le précédent. Il n'est pas committé (dépôt public). Les lots 01 à 10 démarrent avec leur zip v3 (`AMN-refonte-v3-LOT-xx-….zip`, images comprises) et leur prompt v3.

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

### 1.5 Décisions par défaut (`04-ECARTS-MAQUETTES.md`, section B, points 1 à 8), appliquées jusqu'à contre-ordre de Harun

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

Les points 9 à 15 sont **validés** (§1.10). Les règles A1 à A9 de la section A du fichier 04 valent aussi pour tous les lots : chiffres calculés depuis les données réelles, un seul bouton primaire par page plus celui de la suggestion d'Ajmani, colonne droite de 340 px, format français, pastille de La Garde selon N02 §6.2, aucun avatar pour Ajmani.

### 1.6 Direction design (verrouillée par Harun)

Sobre, noir et gris, ultra professionnel, ludique premium (cases à cocher, « x sur y fait », anneaux, séries, jalons, « Boîte à zéro »). **Aucun robot, aucune mascotte, aucun personnage** : Ajmani est une barre de texte en bas de page (⌘J) et une palette ⌘J. Vouvoiement, français. En v3 (§1.10), la barre latérale n'a plus de pastilles : la couleur d'une famille n'apparaît que sur l'icône de la famille active ; les teintes des familles et les accents d'équipe restent des accents rares sur fond noir et gris.

### 1.7 La famille Cyber dans la barre latérale (LOT-10) — **remplacé par la v3 (§1.10)**

> En v3, Cyber est **toujours visible** (section SURVEILLANCE, avec un compteur d'alertes du SOC) et dépliée seulement sur ses écrans : plus de famille « contextuelle ». Ce qui reste valable ci-dessous : Cyber n'entre ni dans les 7 familles de base ni dans le total « 101 », son fichier de déclaration est `declarations/cyber.ts`, et S0 l'ajoute au socle v3.

État du socle (`claude/refonte-socle`) :

- `BarreLaterale` reçoit `familles` (les 7 de base) et `garde` (la 8e, sous un filet).
- `src/socle/familles.ts` ne connaît que les 7.
- La Garde a son jeton `--socle-fam-garde` (`#D6D6DA`). Le fichier 05 donne la même valeur à Cyber : les deux se distinguent par l'**icône** (bouclier, cible), pas par la couleur.

Comment l'ajouter sans changer les 127 autres écrans :

1. **Socle** (S0, dans le socle v3 de §1.10, avant que LOT-10 ne démarre) :
   - `BarreLaterale` gagne une prop facultative `contextuelle?: FamilleLaterale | null`, avec son icône. Elle s'affiche sous le bloc de La Garde, dépliée. Absente ou `null`, le rendu est **identique à aujourd'hui** : `check:socle-coquille` le prouve par un rendu statique avec et sans.
   - Jeton `--socle-fam-cyber: #d6d6da` dans `noir.css`. La teinte `cyber` est acceptée par `FamilleLaterale` comme celle de La Garde, **sans** l'ajouter aux 7 familles de base : D02 et « Tous les modules (101) » ne bougent pas.
   - `src/refonte/coquille/donnees.ts` ne passe `contextuelle` que si le module courant appartient à une famille déclarée « contextuelle » au registre.
2. **Registre** (LOT-10) :
   - un fichier `src/refonte/modules/declarations/cyber.ts`, famille marquée `contextuelle: true`, avec les sous-éléments Red Team, Blue Team, SOC, Veille, OSINT et Missions ;
   - hors des comptes de D02 ;
   - LOT-10 adapte `check:navigation` pour exclure les familles contextuelles des totaux.
3. **Liens** : « Ouvrir Cyber » sur F70 est fait par LOT-08 (c'est son écran) ; le renvoi de CY04 vers La Garde est fait par LOT-10.

### 1.8 Les 15 questions de S3 (note `docs/refonte/preparation-garde.md`, branche `claude/refonte-garde`) — **décidé** le 1er nov.

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

### 1.9 Quand allumer la nouvelle coquille — **décidé** le 1er nov.

La coquille de LOT-00 est éteinte par défaut (drapeau `amn.coquille`). **Proposition : l'allumer par défaut dans l'édition interne au moment de la fusion de LOT-00**, à trois conditions :

1. T1 a fait un passage sur le paquet interne, coquille allumée : `check:coquille`, `contraste`, `focus` et `mouvement`, sans régression par rapport à `main` ;
2. le réglage « Paramètres › Nouvelle coquille » reste, pour revenir en arrière, jusqu'à la fin de LOT-09. L'ancienne coquille est retirée après LOT-09.

Pourquoi ce moment :

- les 141 maquettes sont dessinées dans la nouvelle coquille, et T1 ne peut comparer à ± 2 px que coquille allumée ;
- chaque lot construit dedans ;
- l'édition cliente n'est pas concernée (couture vide).

Le prix : pendant la transition, les écrans pas encore refondus s'affichent dans la nouvelle coquille. C'est acceptable pour une édition interne à trois personnes. S0 change la valeur par défaut (une ligne de `drapeau.ts`) dans le socle v3, dès que le passage 2 de T1 est propre.

### 1.10 Design v3 (1er nov., validé par le dirigeant dans son ensemble)

Nouveau dossier `AMN-refonte-v3-CO` (141 écrans redessinés, sans images), qui **remplace** le précédent. Identifiants et titres des 141 fiches inchangés (vérifié) ; changent le contenu des fiches, 19 types dans l'index (tous les « re-habillage » passent en « mixte »), les prompts et le socle. Le dirigeant valide l'ensemble.

**Ce qui change**

- **Socle v3 (`01-SOCLE-DESIGN.md` §0)**, prioritaire sur le reste :
  - barre latérale v3 : icônes grises, sections ESPACE / SURVEILLANCE / ÉPINGLÉS, sous-liste de 5 lignes au plus, carte « Aujourd'hui » à la place de « En ligne », bouton « Tous les modules (101) » à côté de la recherche ;
  - couche de mouvement commune (§0.2), coupée par `prefers-reduced-motion` ;
  - police monospace ;
  - composants `LiveDot`, `Caret`, `FilterChips`, `Severity`, `Gauge`, `HeatCell`, `FlowLine`, `InlineSuggestion` ;
  - barre Ajmani v3 (curseur, « Entrée pour envoyer »).
- **Une surface propre à chaque écran** : les 5 archétypes du §5 ne sont plus des gabarits (les briques de `src/socle/ui/archetypes/` restent disponibles, mais aucun écran n'est tenu de s'en servir). Plus de rangée de 4 KPI sur beaucoup d'écrans.
- **Plus de pastilles de couleur** dans la barre latérale : la couleur de la famille n'apparaît que sur l'icône de la famille active. Cela remplace la ligne « petits points de couleur » de la direction du 31 oct. ; les 7 familles et les accents d'équipe gardent leurs teintes ailleurs, en accent rare.
- **Cyber est toujours visible** dans la barre latérale (section SURVEILLANCE, avec un compteur d'alertes du SOC), dépliée seulement sur ses écrans. Cela remplace la famille « contextuelle » du §1.7.
- **Dates fictives des images** : vendredi 30 oct. 2026, 10:42 pour tout le bureau ; mardi 3 nov. 2026 pour Cyber.
- Les écrans mobiles et tablette (H46, MB*, T*) n'ont pas changé.

**Points 9 à 15 de `04-ECARTS-MAQUETTES.md` §B : validés par le dirigeant** (ce n'est plus un défaut à confirmer)

| # | Sujet | Décision validée |
|---|---|---|
| 9 | OSINT (CY06) | Accord signé valide exigé avant toute recherche, même passive |
| 10 | G07 Messagerie | Boîte des **clients** (courriel, WhatsApp, SMS) ; les échanges internes passent par Canaux (MX04). WhatsApp et la passerelle SMS sont des connecteurs de H21 |
| 11 | Téléphonie (H13) | Sans ligne pro branchée : appel dans l'application seulement (repli de la fiche) |
| 12 | Défi d'équipe (L07) | Contribution de chacun = engagement écrit, aucun chiffre individuel |
| 13 | Pastille de La Garde | Un seul état réel (N02 §6.2), identique partout au même instant |
| 14 | Rangées de KPI retirées | Les chiffres utiles sont dans la surface ; ne pas les réintroduire sans accord |
| 15 | Gris intermédiaires | Autorisés pour les illustrations (photos, objets, aperçus), jamais pour le texte ni les états |

Les points 1 à 8 (§1.5) restent des décisions par défaut, sauf le n° 1 (banque) confirmé.

**À ne pas simplifier à l'assemblage** (demande du dirigeant, qui y tient) : le **défi d'équipe L07** (défi de la semaine, jauge, « Ce que chacun apporte », « Aussi en cours », frise des défis passés, célébrations, « Proposer un défi »), les **trophées et paliers** (H02, H04, L01, MB04, CY01, CY04) et les **défis hebdomadaires**. Seules limites : celles qu'il a fixées, soit aucun chiffre individuel, aucun classement, aucune perte de points, aucun reproche. Si une session propose de couper ou d'alléger l'un de ces éléments pour tenir un délai, la réponse du CO est non ; T1 vérifie leur présence à la comparaison à ± 2 px. LOT-01 (S2) en est le gardien ; les trophées de Cyber, de MO02 et de MB04 relèvent de LOT-10, LOT-07 et LOT-09.

**Ce que le CO adapte dans son ordre d'assemblage**

1. **`ModuleTile` n'appartient à aucun lot.** Le prompt v3 de LOT-02 demande de le construire dans F10 et de le partager avec les autres vues d'ensemble. Cela ferait attendre ou dupliquer six lots (les fiches F10 à F60 le déclarent partagé, F70 a sa variante `LiveModuleTile`). **Décision : il entre dans le socle v3** avec `ModuleGroupGrid` (F10, F30, F50), `AddModuleTile` et les petites briques citées par dix lots ou plus (`PageHead`, `IconTile`, `IconButton`, `StatusPill`, `SearchBox`, `AvatarStack`, `AjmaniBar`, `SuggestionCompact`, `FlagUrgent`). S0 les livre ou les aligne sur les briques existantes. LOT-02 ne construit plus `ModuleTile`.
2. **Les hubs F10 à F70 sont sept écrans indépendants**, chacun construit par son lot, au-dessus de la route générique `/ensemble/<famille>` qui reste le repli. Plus de « F10 d'abord » : chaque lot commence par ce qui lui convient.
3. **La carte « Aujourd'hui » de la barre latérale et N01 lisent les mêmes chiffres.** Ils viennent d'un seul calcul, `useAujourdhui` (tâches faites sur prévues, série, prochain rendez-vous, présence), livré par S0 dans `src/refonte/coquille/` ; LOT-01 le lit sans le recalculer.
4. **G07 en boîte des clients** (point 10) et **H13 téléphonie** (point 11) dépendent des connecteurs de H21 (LOT-07, S6, après sa phase 1). LOT-05 construit les écrans et affiche « connecteur à brancher » en attendant.
5. **`check:coquille`** devra mesurer la barre latérale v3 : S0 l'adapte avec le socle v3.

**LOT-00 et le socle v3.** LOT-00 (v2) est déjà fusionné (`488cdcc`). **Le socle v3 s'y ajoute avant que les lots ne construisent leurs écrans** : S0 a ses consignes, sur `claude/refonte-socle`, repartie de `refonte-vivante`. Le CO fusionne dès que les gardes sont vertes et que T1 a passé le paquet client. Il couvre, dans l'ordre : le mouvement et les composants du §0.4, la barre latérale v3 avec la carte « Aujourd'hui » et Cyber, les briques partagées du point 1 ci-dessus, le mécanisme de substitution (§1.3), l'adaptation de `check:coquille`, puis l'allumage de la coquille (§1.9).

**Sources des sessions.** Les lots 01 à 10 démarrent avec leur zip v3 (`AMN-refonte-v3-LOT-xx-….zip`, images comprises) et leur prompt v3 du dossier `prompts/`, pas avec la version précédente. Les fiches v2 d'une session déjà démarrée sont périmées.

### 1.11 Données fictives de SIM (1er nov.) : 100 jeux, règles validées

`claude/refonte-donnees-fictives` @ `4fe559b` est **fusionnée** dans `refonte-vivante` : 75 jeux de plus, **100 au total** (Écrire, Échanger, Créer, Outils, La Garde, Cyber, et les écrans manquants TVA et impôts, paie, tarifs, partenaires, planning, défis). `check:donnees` passe de 55 à 87 contrôles, tous verts, déjà en CI. Fusion sans conflit, rien hors de `src/refonte/donnees/**`, `scripts/check-donnees.ts` et le rapport ; aucune adresse hors `exemple.test`, aucun motif de secret ; `typecheck`, `typecheck:business`, `lint` et les 55 contrôles sans navigateur de la CI verts après la fusion. Rapport : [`rapports/DONNEES.md`](rapports/DONNEES.md). Mode d'emploi : `src/refonte/donnees/LISEZ-MOI.md`.

**Règles validées par le dirigeant** (les écrans peuvent s'y fier) :

1. **État d'une organisation de La Garde** : Sain à partir de 70, à surveiller de 45 à 69, Critique sous 45 ; une alerte Critique ouverte rend l'organisation Critique, une alerte Moyenne ouverte la rend « à surveiller » ; une ronde en retard de plus de 2 intervalles la rend « à surveiller », de plus de 24 h Critique. **Le libellé affiché reste « Attention »** (04-B n° 3 et §1.8 n° 4), pas « À surveiller » : SIM aligne le libellé, le seuil ne change pas.
2. **Niveaux de maturité** : score = points obtenus ÷ points possibles ; niveaux de 1 à 5 par tranches de 20 points (§1.8 n° 2).
3. **Cotisations sociales de la paie fictive = 46 % du net.**
4. **États d'un accord Cyber** : En attente, Valide, Expire bientôt (à 30 jours), Expiré.
5. **Catalogue d'outils Cyber volontairement générique** (9 familles de 6 outils, aucun nom d'outil réel). Un écran qui réclame un nom précis le signale dans la section de son lot ; le CO tranche.

**Limites connues.** Aucun écran ne consomme encore ces jeux : un champ peut manquer. Règle : la session de lot qui manque d'un champ l'écrit dans la section de son lot de `STATUT.md` ; SIM l'ajoute, avec un contrôle, à son passage suivant. Les jeux sont datés du vendredi 30 oct. 2026 à **10 h 15** ; les images v3 supposent **10 h 42**, et **mardi 3 nov.** pour Cyber (§1.10) : à aligner (suite de SIM, n° 1).

**Suite de SIM, dans cet ordre** (SIM enchaîne, elle n'attend rien) :

1. **Aligner les dates** sur les images v3 : 10 h 42 le 30 oct. pour le bureau, mardi 3 nov. pour Cyber. Sans cela, T1 compare des écrans qui ne montrent pas les mêmes jours que leurs images.
2. **Le chargeur vers le bac à sable API** (celui de T1, `scripts/qualite/api-essai.mjs`) : il conditionne les captures de T1 et les essais de tout lot sur des données réelles de l'API. La Garde avec S3 (`scripts/seed-supervision.mjs`).
3. **Les jeux calculés** (trésorerie prévisionnelle H09, bilan de la semaine H04, cockpit client G08, configuration du tableau de bord H25) : sous forme de **valeurs attendues pour les tests**, pas de seconde implémentation. Le calcul reste à la session du lot (DS pour H09, S2 pour H04, G08 et H25), qui le compare aux attendus de SIM.
4. **Volumes « beaucoup » de Cyber** en situation, dès que LOT-10 a un écran.

### 1.12 Mises à jour du 6 nov.

**Dossier.** Le zip v3 léger du 6 nov. remplace la copie du CO (hors dépôt). Il ajoute **G09 Écran de veille** à LOT-00 : **142 écrans, LOT-00 en compte 9**. Les images partent avec le zip de chaque lot, que Harun donne aux sessions.

**S0** est en mode ULTRA (Fable 5.1, effort max) pour finir le socle v3. C'est la priorité absolue. Sa branche `claude/refonte-socle` (`de625f8`, 4 nov.) contient déjà :

- les 9 écrans en v3, dont G09 (0 % de pixels hors ± 2 px) ;
- la couche de mouvement, la police monospace, `LiveDot`, `Caret`, `Severity`, `Gauge`, `HeatCell`, `FlowLine`, `FilterChips` et `InlineSuggestion` ;
- la barre latérale v3 avec la carte « Aujourd'hui » et Cyber, l'en-tête, la barre Ajmani v3 ;
- `usePageCoquille` ;
- les 4 commits de S5, repris.

**Ce que le CO attend encore du socle v3 avant de le fusionner :**

1. **`ModuleTile`, `ModuleGroupGrid` et `AddModuleTile`**, ainsi que les briques citées par dix lots ou plus : `PageHead`, `IconTile`, `SuggestionCompact`, `FlagUrgent`, et `IconButton`, `StatusPill`, `SearchBox`, `AvatarStack`, `AjmaniBar` si les briques existantes ne les couvrent pas sous ces noms. Aucun lot ne les construit (§1.10).
2. **Le mécanisme de substitution d'écran** (§1.3) : remplacer l'écran d'une route interne existante, et monter une page qui n'est pas un module (hubs `/ensemble/<famille>`, pages L*) sans la compter dans les 101.
3. **Un seul calcul pour « Aujourd'hui »** (tâches faites sur prévues, série, prochain rendez-vous, présence), exporté pour N01, et **un seul calcul pour la pastille de La Garde** (`usePoulsGarde`), exporté pour LOT-08.
4. **`check:coquille`** adapté à la barre latérale v3.
5. **La liste exacte des composants disponibles** avec leurs chemins, envoyée au CO : c'est le signal de fusion.

**Réponses du CO aux questions de S0** (par délégation de Harun) :

| Question de S0 | Décision |
|---|---|
| Basculer la coquille, donc G09, par défaut ? | **Oui**, dans le socle v3, dès que le passage de T1 sur `claude/refonte-socle` est propre (paquet client identique, gardes navigateur coquille éteinte puis allumée) (§1.9) |
| Créer un vrai verrouillage menant à G06 ? | **Non dans LOT-00** : cela touche l'authentification. Le délai reste enregistré sans effet, « Espace verrouillé » ne s'affiche pas (écart actuel gardé). S6 étudiera le verrouillage dans sa phase sécurité, en privé. |
| Masquer les notifications natives pendant la veille ? | **Oui** : pendant la veille, une notification native n'affiche que « AMN Business · nouvelle notification », sans contenu. C'est le but de G09 : aucun nom ni montant visible depuis la salle. |
| 1. G05 : envoi réel des relances (N3, 10 s pour annuler) ? | **Non au premier jet** : Ajmani prépare, la personne envoie (écart « Préparer les n relances » gardé). |
| 2. G06 : compte mémorisé sur le poste ? | **Non au premier jet** (aucune adresse gardée en local). |
| 3. D02 : lignes de 21 px ou cibles de 34 px ; « 101 » | **Cibles de 34 px** (règle d'accessibilité §7.6, qui l'emporte), la colonne défile dans sa carte ; pas d'équilibrage, l'ordre du registre fait foi ; **un seul total** : celui de D02, repris tel quel par la barre, H47 et G06. |
| 4. Sources manquantes | Aucune nouvelle source dans LOT-00. Chacune revient au lot qui la possède : devis prérempli à LOT-04, contacts par client à LOT-02, note épinglée à LOT-03, automatisations et modèles des métiers (L04) à LOT-07. Créneaux du référent et historique des ouvertures : écarts gardés. |
| 5. H40 : émetteurs du bruit, du silence et du résumé ; rendez-vous dans « L'essentiel » | Pas d'émetteur nouveau dans LOT-00 (écarts gardés). Rendez-vous dans « L'essentiel » **comme la fiche** (pour le contenu d'un écran, la fiche l'emporte). |
| 6. H43 : exporter les pièces d'`EnSituation.tsx` | **Oui**, et les montrer sur `/dev/socle` : les lots en ont besoin pour leurs états. |
| 7. Hauteur des pages sous `AppLayout` | **Dans la coquille, une seule fois**, pas page par page. |

**S7** est créée (LOT-06, en mode préparation). Elle a déjà poussé `claude/refonte-creer` (`e402d0e`) : la logique pure des 15 écrans, `check:creer` et sa note `docs/refonte/preparation/LOT-06-creer.md`. **Ce dossier, `docs/refonte/preparation/LOT-xx-<nom>.md`, devient la règle pour toutes les notes de préparation**, et S3 y déplace la sienne.

**T1** a comparé les 8 écrans v2 de LOT-00 (`0a1751c`, `docs/qualite/fidelite/ECARTS-LOT-00.md`) ; S0 en a corrigé une partie dans le socle v3.

**Réglages par session** (recommandés par Harun, relus par le CO) :

| Session | Réglage | Avis du CO |
|---|---|---|
| CO, S2 (LOT-01), S3 (LOT-08), DS (LOT-04) | Opus 5.5, effort élevé | ✓ (au-dessus du dossier pour S2 et DS, sans inconvénient) |
| S0 (socle v3) | Fable 5.1, effort max (ULTRA) | ✓ |
| S6, sécurité (phases 0 à 3) | Opus 5.5, effort max, pas de Fable | ✓ |
| S6, LOT-10 Cyber | Opus 5.5, effort élevé | ✓ |
| **S6, LOT-07 Outils** | Sonnet 5.5, effort élevé | **À relever en Opus 5.5, effort élevé** : c'est ce que conseille le dossier, pour les surfaces sensibles (accès H19, connecteurs H21 dont WhatsApp et SMS, coffre-fort H24). |
| S1 (LOT-02, LOT-09), S5 (LOT-03, LOT-05), S7 (LOT-06), T1, SIM | Sonnet 5.5, effort élevé | ✓ |
| F1 (non cité) | — | Sonnet 5.5, effort élevé |

**Règles qui ne changent pas** : des branches seulement, jamais de push sur `main`, **jamais de tag `v*`, aucune release, aucun déploiement client**, aucun secret dans le code.

**Ordre de lancement après la fusion du socle v3**, inchangé : S2 et S3 d'abord ; puis S1, S5, DS et S7 en parallèle ; S6 dès la fin de sa phase 1 ; S1 pour LOT-09 en dernier.

**SIM** doit encore : aligner ses dates sur 10 h 42 (mardi 3 nov. pour Cyber) ; livrer le chargeur vers l'API d'essai avec S3 ; fournir les valeurs attendues des écrans calculés (§1.11).

Les prompts de préparation du 6 nov. sont dans [`PROMPTS-6NOV.md`](PROMPTS-6NOV.md).

## 2. Les lots

Ordre : **LOT-00 d'abord, fusionné** ; puis les lots 01 à 08 et **10** en parallèle, une branche chacun ; **LOT-09 en dernier**. Les chiffres viennent de `03-INDEX.md` : 9 + 16 + 13 + 9 + 17 + 10 + 15 + 16 + 12 + 11 + 14 = **142**. (Le tableau du fichier 00 compte G05 dans LOT-05 ; l'index et les prompts le rangent dans LOT-00. Le CO suit l'index.)

| Vague | Lot | Écrans (re-habillage / mixte / nouveau) | Branche | Session | Modèle · effort | Dépend de | État |
|---|---|---|---|---|---|---|---|
| 1 | **LOT-00** Système et démarrage | 9 (0 / 7 / 2) | `claude/refonte-socle` | S0 | Opus 5.5, élevé | aucune | **v2 fusionné** (`488cdcc`) ; socle v3 en cours |
| 2 | **LOT-01** Ma journée | 16 (0 / 12 / 4) | `claude/refonte-journee` | S2 | Sonnet 5.5, élevé | socle v3 fusionné | à faire |
| 2 | **LOT-02** Mes contacts et clients | 13 (0 / 12 / 1) | `claude/refonte-contacts` | S1 | Sonnet 5.5, élevé | socle v3 fusionné | à faire |
| 2 | **LOT-03** Écrire et retenir | 9 (0 / 8 / 1) | `claude/refonte-ecrire` | S5 | Sonnet 5.5, élevé | socle v3 fusionné | à faire |
| 2 | **LOT-04** L'argent | 17 (0 / 16 / 1) | `claude/refonte-argent` | DS | Sonnet 5.5, élevé | socle v3 fusionné | à faire |
| 2 | **LOT-05** Échanger | 10 (0 / 9 / 1) | `claude/refonte-echanger` | S5 | Sonnet 5.5, élevé | socle v3 fusionné ; après LOT-03 | à faire |
| 2 | **LOT-06** Créer et produire | 15 (0 / 14 / 1) | `claude/refonte-creer` | S7 (à créer) | Sonnet 5.5, élevé | socle v3 fusionné | à faire |
| 2 | **LOT-07** Outils et réglages | 16 (0 / 12 / 4) | `claude/refonte-outils` | S6 | Opus 5.5, élevé | socle v3 fusionné ; phase 1 de S6 | à faire |
| 2 | **LOT-08** La Garde et la supervision | 12 (0 / 11 / 1) | `claude/refonte-garde` | S3 | Opus 5.5, élevé | socle v3 fusionné | préparation (note, §1.8) |
| 3 | **LOT-09** Mobile et tablette | 11 (0 / 0 / 11) | `claude/refonte-mobile` | S1, après LOT-02 | Sonnet 5.5, élevé | lots 01 à 08 et 10 fusionnés | à faire |
| 2 | **LOT-10** Cyber | 14 (0 / 4 / 10) | `claude/refonte-cyber` | S6, après LOT-07 | Opus 5.5, élevé | socle v3 fusionné ; phase 1 de S6 ; LOT-07 | à faire |

## 3. Répartition (décisions de Harun du 1er nov. incluses)

| Session | Lot | Avis | Précisions |
|---|---|---|---|
| S0 Socle | LOT-00 puis socle v3 | ✓ | LOT-00 (v2) fusionné. Socle v3 en cours : §1.10 et §5. |
| S2 | LOT-01 | ✓ | N01 remplace son Accueil ; M1, M2 et M4 sont absorbés par G05, H40 et H42. Ses 5 commits postérieurs (`b228f5d`) ne sont pas fusionnés. |
| S1 | LOT-02, puis LOT-09 | ✓ | **LOT-09 confié à S1 après LOT-02** (décision de Harun). |
| S5 | LOT-03, puis LOT-05 | ✓ | S5 reste propriétaire du registre. |
| DS | LOT-04 | ✓ à condition | Ne pousse plus dans `src/socle/**`. Banque en lecture seule ; LOT-04 n'affiche que l'état « connecté / à connecter », la configuration est dans H21 (LOT-07). |
| **S7** (nouvelle) | LOT-06 | ✓ | **Décision de Harun : LOT-06 confié à S7, F1 écartée.** Sonnet 5.5, effort élevé. À créer. |
| F1 | — | écartée de LOT-06 | Continue l'Atelier. Vérificateur cassé sur `refonte-vivante` (C-003, patch de T1 à appliquer par F1). Ses modules rejoignent les familles par le registre, après LOT-06. |
| S6 | LOT-07, puis LOT-10 | ⚠ à condition | Les deux après sa phase 1 (privée ; Harun dit au CO quand elle est finie). LOT-07 d'abord : CY07 étend MO02 (Sites et trackers), qui est dans LOT-07. 30 écrans à elle seule, Opus 5.5, effort élevé. Audit privé ; commits sans description de faiblesse ; écrans sensibles relus par T1. |
| S3 | LOT-08 | ✓ | Règles du §1.8. Zone élargie à `src/bureaux/cyber/**` (partage dans `REGLES.md`). Ajoute « Ouvrir Cyber » sur F70. |
| T1 | transversal | ✓ | API d'essai et bac à sable **fusionnés** (`97929c1`). Seule session autorisée à `build:web` sur données fictives (`REGLES.md`). Fait les captures et les comparaisons à ± 2 px de tous les lots. Outil de fidélité fusionné (`3cc8dff`). |
| SIM | transversal | ✓ | **100 jeux fusionnés** (`4fe559b`), `check:donnees` à 87 contrôles en CI, règles validées (§1.11). Enchaîne : dates v3, chargeur vers l'API d'essai, attendus des écrans calculés. |

## 4. Sessions et branches (état au 1er nov.)

| Session | Branche | État | Dernier sha | Rapport | Points |
|---|---|---|---|---|---|
| S0 / LOT-00 | `claude/refonte-socle` | **v2 fusionné** (`488cdcc`) ; socle v3 à suivre sur la même branche | `fdd6366` | `rapports/LOT-00.md` (sur sa branche) | Questions de LOT-00 : §7, section LOT-00 |
| DS | `claude/refonte-design-socle` | gelée, reprise par LOT-00 | `e97f479` | `rapports/DS.md` (branche LOT-00) | — |
| S1 | `claude/refonte-s1-navigation` | fusionnée (ancienne tranche) | `e788af8` | [`rapports/S1.md`](rapports/S1.md) | Prend LOT-02 puis LOT-09 |
| S2 | `claude/refonte-s2-accueil` | fusionnée à `a537dbe` ; 5 commits non fusionnés | `b228f5d` | [`rapports/S2.md`](rapports/S2.md) | Remplacée par LOT-01 |
| S3 | `claude/refonte-s3-supervisor` (ancienne), `claude/refonte-garde` (LOT-08) | ancienne fusionnée ; LOT-08 en préparation (note seulement, aucun code) | `e7f4f25`, `2eedc9b` | `docs/refonte/preparation-garde.md` (branche LOT-08) | 15 questions tranchées au §1.8 |
| S4 | — | annulée | — | — | — |
| S5 | `claude/refonte-s5-modules` | fusionnée, y compris les 4 commits postérieurs (`5410081`) | `b82e50f` | [`rapports/S5.md`](rapports/S5.md) | Prend LOT-03 puis LOT-05 |
| S6 | `claude/refonte-sec-*` | phase 1 en cours, privée. **Ne pas fusionner sans décision de Harun.** | — | `docs/securite/**`, hors dépôt | Prend LOT-07 puis LOT-10 |
| S7 | `claude/refonte-creer` | **à créer** | — | — | LOT-06 |
| F1 | `claude/refonte-atelier-f1` | prête, non fusionnée, rien de branché | `59056ad` | `docs/atelier/PRET.md` | C-003 à appliquer ; [`INTEGRATION-F1.md`](INTEGRATION-F1.md) à valider |
| T1 | `claude/refonte-qualite-t1`, `claude/refonte-qualite` | **les deux fusionnées** (`97929c1`, `3cc8dff`) | `51a962d`, `f2e243a` | [`../qualite/SANTE.md`](../qualite/SANTE.md) | Passage 2 à faire sur `refonte-vivante` |
| SIM | `claude/refonte-donnees-fictives`, `claude/refonte-sim-bac-a-sable` | **données fusionnées** (`4fe559b`) + `check:donnees` en CI ; bac à sable non fusionné | `4fe559b`, `95d9765` | [`rapports/DONNEES.md`](rapports/DONNEES.md) | Suite : §1.11 |
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

## 5. Qui peut travailler, et ce qui lui manque (1er nov., après le passage à la v3)

**État.** LOT-00 (socle v2) et les 4 commits de S5 sont fusionnés dans `refonte-vivante` (`488cdcc`, `5410081`) ; les gardes sans navigateur y sont vertes. Le GO du matin pour les lots 01 à 08 et 10 est **ajusté, pas retiré** : le design est maintenant v3, et un écran construit sur les briques v2 serait à refaire. Donc :

- **Construction visuelle d'un écran : à la fusion du socle v3** (§1.10), pas avant.
- **Tout le reste peut commencer maintenant**, avec le zip v3 du lot : (1) lire les fiches v3 et écrire une note de préparation `docs/refonte/preparation-<lot>.md` sur sa branche (module existant, données disponibles, ce qui manque ; S3 l'a déjà fait pour La Garde, à reprendre sur les fiches v3) ; (2) construire la logique pure du lot dans `src/refonte/<lot>/` : modèles, calculs, hooks, textes fr/en, avec leurs gardes, **sans importer de brique visuelle du socle** ; (3) lister dans la section du lot de `STATUT.md` ce qui manque au socle.

| Session | Peut travailler maintenant ? | Sur quoi | Ce qui lui manque |
|---|---|---|---|
| **S0** | **oui, priorité absolue** (ULTRA) | Finir le socle v3 sur `claude/refonte-socle` : ce qui reste est listé au §1.12 (`ModuleTile` et briques partagées, substitution, calculs « Aujourd'hui » et pastille exportés, `check:coquille`, pièces de H43, veille sans contenu de notification, bascule après T1). Puis envoyer la liste des composants au CO | rien (réponses au §1.12) |
| **S2** | préparation et logique | LOT-01 `claude/refonte-journee` : note de préparation ; règles de calcul des séries, paliers, défis et jalons (L01, L07, H02, H04), à protéger telles quelles (§1.10) | zip v3 de LOT-01 ; socle v3 pour construire |
| **S1** | préparation et logique | LOT-02 `claude/refonte-contacts` : note de préparation ; modèles du pipeline et des relances | zip v3 de LOT-02 ; socle v3 |
| **S5** | préparation et logique | LOT-03 `claude/refonte-ecrire` puis LOT-05 `claude/refonte-echanger` : notes de préparation ; G07 en boîte des clients (§1.10 point 10) | zips v3 de LOT-03 et LOT-05 ; jeux Écrire et Échanger : fusionnés ; socle v3 |
| **DS** | préparation et logique | LOT-04 `claude/refonte-argent` : note de préparation ; calculs d'argent ; banque en lecture seule | zip v3 de LOT-04 ; socle v3 |
| **S7** | **oui** (créée le 6 nov.) | LOT-06 `claude/refonte-creer` : préparation déjà poussée (`e402d0e`) ; la compléter (prompt du 6 nov.) | socle v3 pour construire |
| **S3** | préparation et logique | LOT-08 `claude/refonte-garde` : mettre sa note `preparation-garde.md` à jour sur les fiches v3 ; règle de la pastille (N02 §6.2) et calculs d'état par organisation (§1.8) | zip v3 de LOT-08 ; jeux La Garde : fusionnés ; socle v3 |
| **S6** | **oui** | Phase 1 sécurité (privée). Puis LOT-07 `claude/refonte-outils` et LOT-10 `claude/refonte-cyber`, dont les connecteurs de H21 (WhatsApp, SMS) qu'attendent G07 et H13 | fin de la phase 1 ; zips v3 de LOT-07 et LOT-10 ; socle v3 |
| **T1** | **oui** | Passage 2 sur `refonte-vivante` (paquet client identique, gardes navigateur coquille éteinte puis allumée) ; adapter l'outil de fidélité aux images v3 (dates fictives du 30 oct. 10:42, mardi 3 nov. pour Cyber) | rien (images lot par lot) |
| **SIM** | **oui, elle enchaîne** | (1) dates des jeux sur les images v3 (10 h 42 le 30 oct., mardi 3 nov. pour Cyber) ; (2) chargeur vers l'API d'essai, La Garde avec S3 ; (3) valeurs attendues des écrans calculés (H09, H04, G08, H25) ; (4) champs manquants signalés par les lots | rien |
| **F1** | **oui** | Appliquer le correctif C-003 de T1 à son vérificateur ; poursuivre l'Atelier | ton choix des modules à intégrer |
| **S1 (LOT-09)** | après les lots 01 à 08 et 10 | LOT-09 `claude/refonte-mobile` (inchangé en v3) | — |

**À lancer en premier après la fusion du socle v3**, par vagues (toutes les sessions ont leur zip v3 et leur note de préparation) :

1. **S2 (LOT-01) et S3 (LOT-08)** : ce sont elles qui produisent les chiffres que les autres écrans lisent (« Aujourd'hui », séries, pastille de La Garde).
2. **S1 (LOT-02), S5 (LOT-03 puis LOT-05), DS (LOT-04), S7 (LOT-06)** en parallèle.
3. **S6 (LOT-07 puis LOT-10)** dès la phase 1 terminée ; LOT-10 après LOT-07 parce que CY07 étend MO02 et CY11 s'appuie sur H20.
4. **S1 (LOT-09)** en dernier.

**Prérequis des lots 01 à 10 : les 100 jeux de données, fusionnés (`4fe559b`).** Les lots y lisent `src/refonte/donnees/` ; il leur manque encore, côté données, le chargeur vers l'API et les attendus calculés (SIM, §1.11).

Décisions prises par le CO, par délégation de Harun : les règles du §1.8, l'allumage de la coquille (§1.9), la procédure F1, l'entrée de `ModuleTile` dans le socle (§1.10). Restent à Harun : le choix des modules de F1, la constante « 12 organisations » de G06 (texte de la fiche par défaut), la création de S7.

**Fusion d'un lot** : relu par T1, paquet client identique, gardes vertes, éléments ludiques protégés présents (§1.10). Le CO fusionne dans `refonte-vivante`, jamais dans `main` ; Harun valide le passage dans `main`.

Dépendances croisées à surveiller :

- la pastille de La Garde (S0 l'affiche, S3 en fixe la règle) et « Aujourd'hui » (S0 l'affiche, S2 en fixe les chiffres) ;
- les connecteurs (LOT-04 lit leur état, LOT-07 les configure, LOT-05 en dépend pour G07 et H13) ;
- le registre et `TousLesModules` (propriétaire S5) ;
- Cyber : CY07 étend MO02 (LOT-07), CY11 s'appuie sur H20 (LOT-07), CY12 sur H03 (LOT-01), CY13 sur H11 et H12 (LOT-03), CY04 et F70 se renvoient l'un à l'autre.

## 6. Ce qui manque au CO

- **La liste des composants de S0** : c'est le signal de fusion du socle v3.
- **Le passage de T1 sur `claude/refonte-socle`** : il conditionne la bascule de la coquille.
- La fin de la phase 1 de S6.

## 7. Écrans (142)

Une ligne par écran, par lot. **Chaque session ne modifie que la section de son lot** (état : `à faire`, `en cours`, `fait`, `écart`, avec la raison en note). Les sections sont séparées pour que les branches ne se gênent pas à la fusion. Le CO tient les autres sections.

Total : 142 écrans = 0 re-habillage + 105 mixtes + 37 nouveaux (types de l'index v3 du 6 nov.). Captures et comparaisons à ± 2 px : faites par T1 (colonne « Écart / note »).

### LOT-00 · Système et démarrage — `claude/refonte-socle` — 9 écrans

8 sur 8 faits par S0, **fusionné** (`488cdcc`, rapport [`rapports/LOT-00.md`](rapports/LOT-00.md)). Aucune capture, l'app n'ayant pas été lancée : T1 les fera au passage 2.

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| H40 | Système · Notifications | mixte | fait | `/notifications`, cloche de l'en-tête. Seul le canal « App » a des émetteurs ; mail et mobile : filtres seulement |
| H41 | Système · Recherche ⌘K | mixte | fait | « Écrire à X » ouvre `mailto:` ; pas de ⌘↵ (fenêtre unique d'Electron) |
| H42 | Système · Démarrage | mixte | fait | `/demarrage`, une fois, à la toute première connexion. Étapes 5 et 6 (paiement, appareil mobile) manuelles : aucune donnée de connecteur |
| H47 | Système · Choisir son métier | mixte | fait | `/demarrage/metier`. Réglage personnel, pas d'organisation ; « Passer » ne masque aucun module |
| H43 | Système · États et messages | nouveau | fait | `/dev/etats`, en développement seulement, et les briques `situations` |
| D02 | Système · Tous les modules | mixte | fait | Comptes par famille tirés du registre (14 / 7 / 12 / 12 / 15 / 7 / 19 / 15), pas de la maquette (12 / 14 / 9 / 18 / 10 / 16 / 14 / 8). Total 101 et niveaux 16 / 62 / 23 conformes |
| G06 | Système · Connexion | mixte | fait | `/login`. « Demandez un accès » affiche un texte, sans flux de demande ; « 12 organisations » est une constante de présentation à valider |
| G05 | Échanger · Ajmani, barre ⌘J ouverte | mixte | fait | Prépare un brouillon de relance, n'envoie rien ; « Décrire » passe à l'assistant existant |
| G09 | Système · Écran de veille | nouveau | fait dans le socle v3 (non fusionné) | Ajouté le 6 nov. Capture comparée : 0 % hors ± 2 px. Verrouillage : écart gardé (§1.12). Bascule avec la nouvelle coquille |

Questions de S0 et réponses du CO :

1. *Allumer la nouvelle coquille par défaut ?* Oui, dans le socle v3, après le passage 2 de T1 (§1.9).
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

**À ne pas simplifier** (§1.10) : le défi d'équipe L07, les trophées et paliers (H02, H04, L01) et les défis hebdomadaires. Aucun chiffre individuel, aucun classement, aucun reproche.

| ID | Écran | Type | État | Écart / note |
|---|---|---|---|---|
| N01 | Ma journée · Accueil | mixte | à faire | |
| H25 | Ma journée · Tableau de bord, widgets | mixte | à faire | |
| G08 | Ma journée · Cockpit client : Stripe, utilisateurs, tickets | mixte | à faire | |
| H01 | Ma journée · Calendrier | mixte | à faire | |
| H02 | Ma journée · Tâches | mixte | à faire | |
| H03 | Ma journée · Missions et tickets, kanban | mixte | à faire | |
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
| H05 | Contacts · Clients | mixte | à faire | |
| G04 | Contacts · Fiche client | mixte | à faire | |
| H06 | Contacts · Prospects | mixte | à faire | |
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
| H10 | Écrire · Notes | mixte | à faire | |
| H11 | Écrire · Documents | mixte | à faire | |
| H12 | Écrire · Signatures | mixte | à faire | |
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
| G07 | Échanger · Messagerie d'équipe | mixte | à faire | |
| H13 | Échanger · Appels | mixte | à faire | |
| H14 | Échanger · Annonces | mixte | à faire | |
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
| H18 | Outils · Paramètres | mixte | à faire | |
| H19 | Outils · Membres et accès | mixte | à faire | |
| H20 | Outils · Automatisations | mixte | à faire | |
| H21 | Outils · Connecteurs | mixte | à faire | |
| H22 | Outils · Corbeille et historique | mixte | à faire | |
| H23 | Outils · Assistance | mixte | à faire | |
| H24 | Outils · Coffre-fort | mixte | à faire | |
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
| H31 | La Garde · Fiche organisation | mixte | à faire | |
| H32 | La Garde · Incident | mixte | à faire | |
| H33 | La Garde · Rondes | mixte | à faire | |
| H34 | La Garde · Maturité SOC | mixte | à faire | |
| H35 | La Garde · Journal d'accès | mixte | à faire | |
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
| 2026-11-01 | `claude/refonte-socle` (LOT-00) | `fdd6366` → `488cdcc` | conflit `STATUT.md` (version de `refonte-vivante` gardée) |
| 2026-11-01 | `claude/refonte-s5-modules` | `b82e50f` → `5410081` | conflit `src/socle/i18n.ts` (« Outils et réglages » gardé) ; 55 contrôles verts |
| 2026-11-01 | `claude/refonte-qualite` (T1) | `f2e243a` | sans conflit ; contrôle de fidélité, local seulement |
| 2026-11-01 | `claude/refonte-donnees-fictives` (SIM) | `4fe559b` | sans conflit ; 100 jeux ; `check:donnees` 87 contrôles ; 55 contrôles de la CI verts |
| 2026-11-01 | — | `1ca2d7a` | design v3 : dossier remplacé, points 9 à 15 validés, `ModuleTile` dans le socle, GO ajusté |
