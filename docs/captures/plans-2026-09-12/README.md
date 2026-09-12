# Famille C — les plans, avant et après

Cinq modules composés le 12 septembre : `Planning d'équipe`, `Absences`,
`Tableau des projets`, `Prospects`, `Tâches`. La famille est entière.

## Le piège de la famille, vérifié avant d'écrire une ligne

Le Bloc 0 annonçait « des données à deux axes, et le piège de la matrice ». La
lecture des cinq fichiers l'a confirmé, en pire :

- `Tableau des projets` et `Prospects` étaient **le même composant** : colonnes
  en `auto-fit`, cartes de poids égal, bouton fléché par carte. Deux captures
  côte à côte ne se distinguaient qu'au texte.
- `Planning d'équipe` était une grille membres × jours, et `5d Routines` — déjà
  validé — est une grille routines × jours avec sa colonne du jour en plaque
  ambre. Deux matrices, le gabarit se reconnaît avant le sujet.
- `Absences` et `Planning` parlent tous deux de personnes et de jours.

## L'après, module par module

| Écran | Objet dominant | Pourquoi celui-là | Ambre |
|---|---|---|---|
| Planning d'équipe | La semaine en lignes de JOURS, couverture en chiffre de tête | La question d'un planning n'est pas « que fait Nadia » mais « est-ce que jeudi tient ». La matrice est retournée pour que l'axe qui décide soit celui qu'on lit | Le premier jour sans personne, à partir d'aujourd'hui |
| Absences | Une frise de quinze jours, une barre continue par absence | Une absence n'est pas une case, c'est une PLAGE `from`→`to` : les chevauchements se voient, c'est-à-dire les jours où il manquera deux personnes | Les demandes à valider, et seulement pour qui peut valider |
| Tableau des projets | La prochaine action, le nom du projet en second | `nextAction` n'existe nulle part ailleurs dans l'application, et c'est la seule ligne qui dit par quoi reprendre un projet rouvert trois semaines plus tard | Les projets SANS prochaine action |
| Prospects | L'entonnoir en euros : une barre par étape, longueur = argent | Le fichier le disait déjà en tête — « un total en euros, c'est ce qui rend la lecture immédiate » — et les colonnes comptaient des cartes | Le prospect qui n'a pas bougé depuis plus de quinze jours |
| Tâches | La charge : qui porte quoi, en barres par personne — par priorité quand on travaille seul | Le tableau range par statut, ce qui est juste ici. Mais il ne dit pas qui porte quoi, ni ce que personne ne porte | Les tâches ouvertes sans personne dessus |

Planning se range **par jour**, la frise **par personne** ; l'un pose des jetons
un par un, l'autre étend des barres. Le tableau lit des **actions**, l'entonnoir
lit de l'**argent**. Aucun des quatre ne partage sa structure avec un autre, ni
avec Routines.

## Une régression trouvée en semant, pas en relisant

En peuplant cette famille, `check:signal` a refusé **Automatisations**, un écran
pourtant validé : deux plaques « N en attente », donc aucun signal. La plaque se
posait sur CHAQUE règle suspendue ayant des éléments en attente ; le bac à sable
n'en avait qu'une, la garde passait. Une deuxième règle suffisait à casser la
règle des trois ambres.

Corrigé à la source : une seule règle porte l'ambre, celle qui a le plus
d'éléments en attente — sa reprise change le plus de choses. Les autres gardent
leur compte en encre neutre. L'information reste, l'appel à décider est unique.

C'est le meilleur argument pour semer avant de composer : le défaut n'était
visible dans aucune relecture de code, seulement sous des données réalistes.

## Une barre mesurée, pas devinée

Le premier entonnoir avait une piste `bg-bg` (#060606) et un remplissage
`bg-elevated` (#121212), dans un panneau `bg-surface` (#0d0d0d). Douze valeurs
d'écart, et une piste plus sombre que le panneau : à l'œil, les barres
semblaient inversées. Mesuré au navigateur (largeurs et couleurs calculées), le
remplissage partait bien de la gauche aux bonnes proportions — c'était le
contraste, pas la géométrie. Le remplissage passe en `border-strong` (#3a3a3a)
et la piste redevient le fond du panneau.

## Les gardes, à la livraison de la famille

| Garde | Résultat |
|---|---|
| `tsc` | 0 erreur |
| lint | 76 avertissements, 0 erreur — la ligne de base inchangée |
| `check:encres` | aucun défaut, 33 copies connues |
| `check:langue` | 8 contrôles sur 2386 clés |
| `check:signal` | 38 écrans, aucun avec plus d'un ambre, dans les DEUX éditions |
| `check:contraste` | 101 écrans, 21 359 textes, aucun sous WCAG AA |

## Le seul tableau à colonnes qui survit, et pourquoi

Quatre écrans ont perdu leurs colonnes dans ce chantier : SAV, Tableau des
projets, Prospects — et le rail de Groupes avant eux. Tâches les garde.

La différence n'est pas de goût. Sur le SAV, les colonnes rangeaient par ÉTAT
alors que le sujet était l'âge ; sur les deux autres, elles comptaient des
cartes alors que le sujet était une action ou de l'argent. Sur Tâches, le
statut EST le flux de travail : une tâche va de « à faire » à « en cours » à
« fait », et c'est le seul écran de l'application où une colonne par état
raconte le travail lui-même.

Ce qui manquait n'était donc pas le tableau, mais ce qu'il ne dit pas : qui
porte quoi. La charge passe au-dessus, le tableau devient le registre.

`TasksScreen.tsx` fait 1060 lignes et porte la file unifiée de La Garde,
l'attribution, les repères, les commentaires et les filtres. La composition est
donc ADDITIVE — 116 lignes ajoutées, aucune retirée — et c'est délibéré : y
refaire la mise en page des cartes aurait touché le panneau de tâche, la
création et les repères d'un coup, sur l'écran le plus chargé de
l'application.

## Les deux éditions, prouvées séparément

`apres/taches.png` est le poste de travail : barres par personne. 
`apres/taches-solo.png` est l'édition cliente, où `TEAM_ENABLED` est faux :
« qui porte quoi » n'a pas de sens quand on est seul, et l'écran range alors par
priorité — haute, normale, basse. Deux compositions, une seule règle.
