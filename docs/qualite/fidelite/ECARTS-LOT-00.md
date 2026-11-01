# Fidélité LOT-00 — écarts image contre écran, écran par écran

Pour **S0** (session du socle) et le **CO**. Produit par T1 le 2026-11-01, sur
`claude/refonte-socle` @ `fdd6366` (48 commits au-dessus de `refonte-vivante` @ `f059f32`).

**Verdict : les 8 écrans sont « À CORRIGER », mais aucun n'est loin.** Les dispositions, les grilles et
les contenus sont reconnaissables à ± 1 ou 2 px (liste des conformités par écran plus bas). Ce qui sépare
encore l'app des images tient en une douzaine d'écarts, dont la moitié sont **communs à la coquille** et se
corrigent une fois pour tout le lot.

## Comment lire les chiffres

| Écran | Pixels en écart | Zones | Textes de la maquette retrouvés | Lecture |
|---|---|---|---|---|
| H40 Notifications | 11,03 % | 9 | 20 / 57 | les textes manquants sont des **données d'exemple** (voir H40) |
| H41 Recherche ⌘K | 24,90 % (écran) · **3,81 % (palette seule)** | 8 · 6 | 9 / 57 | l'écran entier n'a pas de sens : le fond est la page Tâches, pas H41 |
| H42 Démarrage | 14,64 % | 11 | 36 / 39 | 3 absents : une donnée, une étape déjà faite, un raccourci non repris |
| H47 Choisir son métier | 6,01 % (sélection reproduite) | 19 | 43 / 50 | 5 absents sur 7 sont des exemples volontairement génériques |
| H43 États et messages | 7,79 % | 16 | 28 / 35 | les 7 absents sont des **noms neutres voulus** (Alex, Exemple SA…) |
| D02 Tous les modules | 12,42 % | 3 | 44 / 86 | les libellés de modules viennent du registre (documenté) |
| G06 Connexion | 6,15 % | 6 | 20 / 22 | les 2 absents sont les valeurs d'exemple (e-mail, points) |
| G05 Ajmani ⌘J | 84,04 % (écran) · **48,51 % (palette seule)** | 1 · 1 | 3 / 17 | le fond (Accueil) n'est pas G05 ; la palette est très proche |

Le pourcentage **n'est pas une note** : une zone de texte décalée de 3 px, ou un fond de page différent,
pèse plus qu'un bouton absent. Ce sont les listes ci-dessous qui comptent. Chaque ligne dit :
**À corriger** (hors ± 2 px ou hors spécification), **À décider** (choix CO), **Voulu** (déjà dit dans
`STATUT.md` ou dans la fiche), ou **Bac à sable** (dû à mon montage, pas à l'app).

## Conditions de mesure

- Build `npm run build:web` (édition interne, production) de `fdd6366`, sur **données fictives uniquement** :
  amn-api en mémoire, compte `@exemple.test`, jeu d'essai `scripts/seed-essai.mjs` plus les fiches des
  maquettes (`scripts/qualite/fidelite/graines-maquettes.mjs` : Menna Conseil, Atelier Dupont, facture F-2041…).
  Aucune donnée réelle, aucun réseau extérieur (« rien de refusé » sur les 8 captures).
- H43 n'existe qu'en développement (`import.meta.env.DEV`) : capturé sur un build `NODE_ENV=development`. Les
  7 autres sur le build de production.
- Chromium 141 sans tête, 1440 × 900, échelle 1, thème sombre, **plateforme simulée Mac** (⌘ comme les
  maquettes), horloge simulée (30 oct. 2026, 20 oct. pour G05), nouvelle coquille allumée
  (`localStorage['amn.coquille'] = 'noir'`, éteinte par défaut), guide et accueil quotidien marqués vus.
- Outil : `docs/refonte/CONTROLE-FIDELITE.md`. Tolérance : position ± 2 px, couleur ± 2 niveaux sur un aplat.
- Les mesures ont été refaites deux fois : mêmes chiffres.

## Écarts communs à la coquille (une correction, plusieurs écrans)

| # | Écarts | Écrans | Gravité |
|---|---|---|---|
| **C1** | **Fil d'Ariane** : l'app n'écrit que le titre de la page (« Notifications », « Demarrage », « Metier », sans accent ni majuscule : libellé tiré de la route). La maquette écrit « Ma journée / Notifications » et « Ma journée / Démarrage » (les deux pages de Démarrage portent le même fil). Seul H41 est juste (« Ma journée / Tâches »). | H40, H42, H47 | À corriger |
| **C2** | **Barre latérale hors famille** : sur ces trois pages aucune famille n'est dépliée. La maquette déplie « Ma journée » avec « Accueil » actif ; « Mes contacts et clients » est à y = 398 dans la maquette et à y = 167 dans l'app. | H40, H42, H47 | À décider |
| **C3** | **Sous-pages** : l'app affiche les noms longs du registre (« Accueil et tableau de bord », « Calendrier et RDV en ligne », « Tâches et priorités du jour », « + 7 autres »), la maquette des noms courts (« Accueil », « Tableau de bord », « Calendrier », « Tâches », « Missions et tickets », « Bilan de la semaine », « + 5 autres »). Plusieurs sont **tronqués par « … »** (« Tâches et priorités du… »), ce que la règle « zéro texte tronqué » interdit. | H41, D02 | À corriger (tronquage) · À décider (noms) |
| **C4** | **Pas des familles** : 36 px dans l'app, 35 px dans la maquette. +1 px par ligne, donc +5 px en bas de liste. | H40…H47 | À corriger |
| **C5** | **Compteurs sur les familles** (« Ma journée 13 », « L'argent 6 ») absents de la maquette, qui ne met les compteurs que sur les sous-pages. | H40, H42, H47 | À décider |
| **C6** | **« La Garde et la supervision »** tronqué en « La Garde et la supervis… » sur une ligne ; la maquette l'écrit en entier sur deux. Même troncature dans la carte de D02. | H40, H41, H42, H47, D02 | À corriger |
| **C7** | **Bloc « EN LIGNE »** : la maquette est une carte bordée à trois personnes avec le module en cours (« Accueil », « Facturation »). L'app n'a ni cadre ni les trois lignes, et affiche **la route brute** (« sur /notifications », « sur /demarrage/metier », « sur /tous-les-modules ») au lieu du libellé du module. | H40, H42, H47, D02 | À corriger (route brute) |
| **C8** | **« ⌘ K » et « ⌘ J » avec une espace** ; la maquette écrit « ⌘K » et « ⌘J » d'un bloc (c'est ce qui fait manquer « ⌘J » au contrôle de textes de H47). | tous les écrans à coquille | À corriger |
| **C9** | **En-tête** : l'app ajoute un sélecteur d'organisation (« ORGANISATION AMN DevSec », x 833–1001) et une pastille « RECONNEXION EN COURS… » (x 653–824) que la maquette n'a pas ; elles décalent la pile « en ligne ». La pastille vient de mon bac à sable (aucun temps réel) : **Bac à sable**. Le sélecteur, lui, est un vrai choix. | H40, H41, H42, H47, D02, G05 | À décider (sélecteur) |
| **C10** | **Bouton rond flottant (✦)** en bas à droite (x ≈ 1402, y ≈ 862), absent des maquettes. | H40, H41, H42, H47, D02, G05 | À corriger |
| **C11** | **Traits d'union élargis** : l'app pose `font-variant-numeric: tabular-nums` sur tout le corps de page (`src/index.css:396`) ; avec Inter cela porte le trait d'union de **7,0 à 9,7 px** à 15 px (test isolé). Mesuré : « Que voulez-vous recevoir ? » 200 px contre 197 px dans la maquette, « Rendez-vous » 82 contre 80. Visible : « Start - up », « êtes - vous », « Décrivez - la ». La fiche demande les chiffres tabulaires pour les **nombres** seulement (§ 2 du socle). | H40, H42, H47 | À corriger |
| **C12** | **Titres de carte en gris** : « Bienvenue, … », « Visite guidée, 2 minutes », « Bon à savoir » (H42), « Votre espace sera composé de », « Votre première journée, en aperçu » et les libellés de la liste (H47) sont à `#8C8C90` dans l'app ; la maquette les écrit en `#EDEDED` (T1). Mesuré sur les pixels, stable après 4 s (ce n'est pas une animation en cours). Cause constatée pour un cas : `.dem-visite__titre` (`demarrage.css:165`) n'a aucune couleur et hérite du gris de la carte. | H42, H47 | À corriger |
| **C13** | **Boutons d'en-tête de page** : « Plus tard » 26 × 73 px (haut à y = 114), « Reprendre la visite » 26 × 150 ; la fiche H42 (Z1) et la maquette donnent **31 px** de haut, ≈ 80 et 159 px de large, haut à y = 107. « Passer » (H47) : 26 × 61 px, haut à y = 114, contre 31 × 68 px, haut à y = 107. **Sur H40 les boutons sont justes** (31 px, y = 107–137, largeur à ± 1 px, mesuré) : H40 et H42/H47 n'utilisent donc pas le même composant de bouton d'en-tête de page. | H42, H47 | À corriger |

## H40 — Notifications (`/notifications`)

Textes : les 37 manquants sont des exemples de la maquette (Menna Conseil, F-2038, Riyad…) ; l'app affiche 7
notifications tirées du jeu d'essai (7 factures en retard), la maquette 14 de sources variées.
Mêmes en-têtes de colonne, onglets, matrice de réglages.

| # | Où (px absolus) | Maquette | App | Gravité |
|---|---|---|---|---|
| H40.1 | colonne droite, 3ᵉ carte (1001–1399 × 625–780) | « Suggestion d'Ajmani » : titre « Moins de bruit », texte, boutons « Passer en résumé » / « Garder » | carte « Astuce — ⌘⇧L marque tout comme lu. » : une ligne dans une carte de 155 px, donc **presque vide** | À décider (la spec §3 prévoit la suggestion en 3ᵉ position) |
| H40.2 | fil | trois sections : AUJOURD'HUI, HIER, CETTE SEMAINE | une seule section (les 7 notifications sont du jour) | Bac à sable (données) |
| H40.3 | première ligne | boutons « Ouvrir » / « Reporter » visibles (ligne survolée) | non vérifié : l'outil ne simule pas le survol | non vérifié |
| — | C1, C2, C4, C5, C6, C7, C8, C9, C10, C11 | | | voir plus haut |

Conforme (à ± 2 px) : titre (Inter 28/600, y = 99), sous-titre, boutons « Tout marquer comme lu » / « Réglages »
(31 px), onglets (Tout / Non lues / Mentions / Urgent), pas des lignes (61 px), colonne droite à x = 1001–1399,
matrice App/Mail/Mobile (interrupteurs à ± 1 px), cartes « Heures calmes » et « Résumé du matin », barre Ajmani
(y = 835–880), intitulés de groupe (Inter 11/500, 0,08 em, majuscules : **conforme** au socle).

## H41 — Recherche ⌘K (palette ouverte sur Tâches, « menna » saisi)

Comparaison limitée à la palette (360–1080 × 90–550) : **3,81 %**. Le reste de l'écran (page Tâches, coquille)
n'est pas l'écran H41.

| # | Où | Maquette | App | Gravité |
|---|---|---|---|---|
| H41.1 | libellés des lignes | ≈ 13,5 px | **14 px / 400** (CSS calculé), soit **+3,1 à +3,5 %** de largeur, mesurée sur 4 libellés : « Menna Conseil » 93 → 96 px, « Contrat de maintenance Menna » 198 → 205 px, « Valider le tableau de bord de Menna » 228 → 236 px (+ 8 px), « Créer un devis pour Menna Conseil » 223 → 230 px | À corriger (hors ± 2 px sur les longs libellés ; la fiche ne donne pas la taille) |
| H41.2 | pied de palette | « ↑↓ pour naviguer · ↵ pour ouvrir · **⌘↵ dans un nouvel onglet** · Astuce : tapez « > » … » | la mention « ⌘↵ dans un nouvel onglet » manque | Voulu (STATUT : « pas de ⌘↵ ») |
| H41.3 | 1ʳᵉ ligne, 3ᵉ ligne | « …résumer l'historique de **Menna** », « Écrire à **Menna** » | « …de **Menna Conseil** », « Écrire à **Menna Conseil** » | À décider (nom complet ou prénom) |
| H41.4 | étiquettes « Document » | à x = 645 | à x = 652 (suit H41.1) | corrigé par H41.1 |

Conforme : emplacement et taille de la palette (371–1069 × 97–540 contre 370–1070 × 97–540), **mêmes six
résultats dans le même ordre** (3 actions, 3 « clients et pages »), tuiles d'icône et étiquettes, pas de 44 px
(à − 1 px), pastille « esc », ligne active avec « ↵ ».

## H42 — Démarrage (`/demarrage`)

| # | Où | Maquette | App | Gravité |
|---|---|---|---|---|
| H42.1 | titres de carte | `#EDEDED` | `#8C8C90` | voir C12 |
| H42.2 | coches des étapes faites | disque clair (≈ 203 au centre) | disque **plus sombre** (≈ 169) ; la spec dit « disque `#EDEDED` avec coche `#0C0C0D` » | À corriger |
| H42.3 | boutons d'en-tête | 31 px | 26 px | voir C13 |
| H42.4 | « Bon à savoir » | 4 lignes dont « N · Créer, partout » | 3 lignes : le raccourci N manque | Voulu (STATUT : « non repris, n'existe pas ») |
| H42.5 | étapes | 2/6 : métier et client faits, devis à faire (bouton « Créer un devis ») | 2/6 aussi, mais métier à faire (bouton « Choisir »), client et devis faits : l'état suit les données | Bac à sable (le jeu d'essai contient des devis) |
| H42.6 | accueil | « Bienvenue, Aaron » | « Bienvenue, Essai » | Bac à sable (prénom du compte) |
| — | C1, C2, C4, C5, C6, C7, C8, C9, C10, C11 | | | voir plus haut |

Conforme : anneau « 2/6 » (à ± 2 px), liste de 6 étapes au pas de **63 px** (identique), texte « Plus que 4 étapes… »,
cartes « Visite guidée » et « Bon à savoir » aux bonnes cotes, rangée des trois cartes du bas (y = 681–771),
barre Ajmani.

## H47 — Choisir son métier (`/demarrage/metier`, « Artisan du bâtiment » sélectionné)

| # | Où | Maquette | App | Gravité |
|---|---|---|---|---|
| H47.1 | carte « Votre espace sera composé de » | 6 lignes : Chantiers, Devis, Facturation, Stock, Clients, Calendrier ; « + 14 autres modules » | Chantiers, Facturation, Clients, **Stock et prévision, Calendrier et RDV en ligne, Fournisseurs** ; « + 6 autres modules » (noms du registre) | À décider |
| H47.2 | carte et lignes en gris | `#EDEDED` | `#8C8C90` | voir C12 |
| H47.3 | « Votre première journée, en aperçu » | pas de tag | tag « **Exemple** » ajouté en haut à droite ; trois exemples génériques (« Chantier du jour »…) à la place de « Dupont, salle de bain », « 3 à envoyer · 8 400 € », « Carrelage 30×30 » | Voulu (pas de donnée d'exemple en dur) · À décider (le tag) |
| H47.4 | boutons « Passer » / « Continuer » | 31 px, haut à y = 107 | 26 px, haut à y = 114 | voir C13 |
| — | C1, C2, C4, C5, C6, C7, C8, C9, C10, C11 | | | voir plus haut |

Conforme : les 8 cartes de métier (177 × 126, à ± 1 px), la **sélection** (coche en rond, bord clair), le
segmenté « Seul / 2 à 5 / 6 à 20 / Plus », la ligne « Votre activité n'est pas dans la liste ? », la grille
générale.

## H43 — États et messages (`/dev/etats`, développement seulement)

C'est l'écran le plus proche : disposition des 8 cartes à ± 1 px, titres et textes identiques.

| # | Où | Maquette | App | Gravité |
|---|---|---|---|---|
| H43.1 | fond de page | **lueur d'ambiance** : (18 · 18 · 19) en haut à droite (1100, 40), 14,3 au centre haut | fond plat (12,6 · 12,6 · 13,7) partout | À corriger (spec § 1 : « lueur d'ambiance de page ») |
| H43.2 | pastilles d'icône des 4 premières cartes | ex. 29,38,37 / 29,27,23 / 30,30,32 | 31,41,41 / 31,28,25 / 32,32,34 : **2 à 4 niveaux plus claires** | À corriger (hors ± 2 sur un aplat) |
| H43.3 | exemples nommés | « Menna Conseil », « Aaron », « Test Dupuis », « Mohamed » | « Exemple SA », « Alex », « Client exemple », « Sacha » | Voulu (aucune donnée d'exemple en dur) |
| H43.4 | carte « Chargement », zone x 415–705 × y 224–431 | squelettes | squelettes d'une teinte voisine (13 % de pixels hors tolérance) | à relire à l'œil |

## D02 — Tous les modules (lien « Tous les modules », « envoyer une fac » saisi)

| # | Où | Maquette | App | Gravité |
|---|---|---|---|---|
| D02.1 | rythme vertical | titre y = 96, champ 85–127, puces y = 165, cartes à partir de **199**, cartes de 300 px | titre y = 99 (+ 3), champ 90–132 (+ 5), puces y = 172 (+ 7), cartes à partir de **207** (+ 8), cartes de **315 px** (espace titre → 1ʳᵉ ligne : 40 px contre 30) | À corriger |
| D02.2 | bas du panneau | 2ᵉ rangée de cartes entière (514–814), « + N autres » visible | **2ᵉ rangée coupée** par le bord du panneau : « + 8 autres » à y = 810, bord bas des cartes absent | À corriger (zone coupée) |
| D02.3 | voile | fond plein derrière le panneau | la coquille (barre latérale, en-tête) reste visible derrière | À décider |
| D02.4 | champ de recherche | bordure grise, pas de croix | croix d'effacement « × » et **anneau de focus blanc épais** | À corriger / À décider |
| D02.5 | titre de carte | « La Garde et la supervision » | « La Garde et la supervi… » | voir C6 |
| D02.6 | comptes et noms | 12 / 14 / 9 / 18 // 10 / 16 / 14 / 8 ; noms courts | 14 / 7 / 12 / 12 // 15 / 7 / 19 / 15 ; noms du registre | Voulu (STATUT : « comptes issus du registre ») |
| D02.7 | « Utilisés maintenant par l'équipe », pastille « en cours » (Rondes) | 3 avatars ; pastille verte | 1 avatar ; pas de pastille | Bac à sable (données) |

Conforme : panneau (100–1340 × 57–843 contre 56–844), **puces « Tous 101 · Essentiels 16 · Courants 62 · Avancés 23 »
identiques**, ligne active « Envoyer une facture » avec ↵, pas de ligne 28 px, bouton « Échap ».

## G06 — Connexion (`/login`, sans session)

Quasi conforme : les deux panneaux, la grille, les textes. Ce qui diffère est mesuré.

| # | Où | Maquette | App | Gravité |
|---|---|---|---|---|
| G06.1 | bloc du formulaire | titre à y = 252–268, consigne 283–294, bouton **495–540**, pied 640–650 | titre 243–259 (**− 9**), consigne 277–286 (− 6), bouton **486–531** (− 9), pied 645–655 (+ 5) | À corriger |
| G06.2 | note « Connexion protégée… » | 359 × **58** px (y 559–616) | 359 × **67** px (y 550–616) | À corriger |
| G06.3 | trois indicateurs (101, H24, 8) | **chiffre**, puis libellé dessous (chiffre y 760–775, libellé 786–794) | **libellé au-dessus**, chiffre dessous (libellé 749–756, chiffre 770–788) ; chiffres ≈ 19 px de haut contre 16 | À corriger |
| G06.4 | pied de gauche | « AMN DevSec · édition interne de l'équipe » | idem **+ « · v1.2.50 »** | À décider |
| G06.5 | pastille « La Garde veille… » | ≈ 205 px de large | ≈ 214 px (lu sur l'image, non mesuré au pixel) | À corriger si confirmé |
| G06.6 | champ e-mail | pas d'anneau de focus ; c'est le champ « Mot de passe » qui a le bord plus clair | **anneau blanc épais** (≈ 3 px) sur l'e-mail dès le chargement ; la spec demande 2 px décalé de 2 | À corriger |
| G06.7 | lueur en haut du panneau gauche | 15,16,17 en (450, 100) | 19,20,20 : **4 niveaux plus clair** | À corriger |
| G06.8 | valeurs d'exemple | « aaron@amndevsec.fr », 10 points | champs vides (non saisis) | Bac à sable |

Conforme : panneau gauche de 600 px et filet à x = 599, titre en deux lignes (« Tout votre travail, / sous une
seule main. »), paragraphe, formulaire de 360 px à x 840–1200, boutons de 46 px, libellés, lien « Oublié ? »,
« Afficher ».

## G05 — Ajmani ⌘J (palette ouverte sur l'Accueil, « Relancer l'Atelier Dupont » saisi)

Comparaison limitée à la palette (400–1040 × 108–638) : 48,51 %. Le chiffre est tiré vers le haut par un voile
plus transparent que dans la maquette (voir G05.5) et par les lignes de la liste ; la mise en page de la boîte est
presque identique : 411–1029 × 119–619 contre 410–1030 × 118–620, lignes au pas de 54 px, en-tête avec la tuile ✦
et « ⌘J », pied « échap pour fermer ». « En retard de **12 jours** » : l'horloge simulée donne le bon calcul.

| # | Où | Maquette | App | Gravité |
|---|---|---|---|---|
| G05.1 | bouton principal | « **Envoyer** la relance » (icône d'envoi) | « **Préparer** la relance » (icône document) | Voulu (STATUT : « prépare un brouillon, n'envoie rien ») |
| G05.2 | texte de la proposition | « …Je peux envoyer la relance que vous aviez approuvée, ou la modifier avant. » | « …Je peux ouvrir la relance prête à copier : rien ne part d'ici. » | Voulu (idem) |
| G05.3 | liste « OU LANCEZ » | Créer une facture · Trouver un module ou un client · Demander un point à la Garde · **Rédiger un compte rendu** (« À partir de vos notes ») | **Relancer une facture en retard** · Créer une facture · Trouver un module ou un client · Demander un point à la Garde | À décider (la 4ᵉ entrée de la maquette manque, une entrée contextuelle s'ajoute en tête) |
| G05.4 | caret vert après le texte saisi | présent | non visible (l'outil masque le curseur de saisie) | Bac à sable |
| G05.5 | voile | quasi noir : on ne devine que des formes | on lit encore la coquille et la liste de l'Accueil | À décider |
| G05.6 | fond | Accueil « Bonjour, Aaron », cartes de chiffres | Accueil de S2 (autre écran) | sans objet pour ce lot |

## Ce qui est conforme, pour mémoire

Le lot est bien avancé : **H43** est presque à l'identique ; **G06** est à 6 % avec des écarts de positions
mesurables ; les **deux palettes** (H41, G05) ont la bonne taille, la bonne position, les bons contenus ; **H47**
reproduit la sélection ; les **grilles** de H40, H42, H47 et D02 tombent à ± 1 ou 2 px ; les **compteurs** de D02
(101 / 16 / 62 / 23) sont exacts.

## Limites de cette mesure

- Un état par écran : pas de survol, de focus clavier, de défilement, ni les états vides ou d'erreur.
- Les écrans dépendent des données : j'ai semé ce que les maquettes supposent (Menna, F-2041…) mais pas leur
  population (3 personnes en ligne, 14 notifications, compteurs). Ces différences sont étiquetées « Bac à sable ».
- La pastille « RECONNEXION EN COURS… » est due à l'absence de temps réel dans le bac à sable.
- H43 vient d'un build de développement : sa fidélité de rendu est celle du code, pas d'une minification.
- Les positions « lues sur l'image » (pastille de G06, boutons de H40) sont à ± 1 px ; celles marquées « mesuré »
  sont calculées sur les pixels.

## Reproduire

```sh
# 1. builds (production, et développement pour H43), sur l'amn-api d'essai
VITE_AMN_API_URL=http://127.0.0.1:4171 AMN_WEB_OUT=/tmp/fid/dist node scripts/build-web.mjs
NODE_ENV=development VITE_AMN_API_URL=http://127.0.0.1:4171 AMN_WEB_OUT=/tmp/fid/dist-dev node scripts/build-web.mjs
# 2. amn-api d'essai en mémoire (branche claude/refonte-qualite-t1), jeu d'essai et fiches des maquettes
AMN_API_ROOT=../amn-api node scripts/qualite/api-essai.mjs 4171 &
AMN_E2E_EMAIL=essai.interne@exemple.test AMN_E2E_PASSWORD=Interne-2026-Essai node scripts/seed-essai.mjs
AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/qualite/fidelite/graines-maquettes.mjs
# 3. les 8 écrans
AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/qualite/fidelite/lot.mjs \
  --scenarios scripts/qualite/fidelite/ecrans-lot00.json --dist /tmp/fid/dist --dist-dev /tmp/fid/dist-dev \
  --images <dossier>/images --data <dossier>/_data --sortie /tmp/fid/sortie
```

Les captures et les images des écarts (rouge : en trop, bleu : manquant, jaune : zones) sont dans
`/tmp/claude-0/-home-user-amn-desktop/22aa31cd-ee78-5188-9732-cee3fdc41abe/scratchpad/fid-final/`
(`H40.png`, `H40-ecarts.png`, …, `H41-ecarts-zone.png`, `G05-ecarts-zone.png`). Elles ne sont pas dans le dépôt :
public, et 5 Mo.
