# Famille C — les plans, avant et après

Quatre modules composés le 12 septembre : `Planning d'équipe`, `Absences`,
`Tableau des projets`, `Prospects`. Le cinquième de la famille, `Tâches`, n'est
pas fait — voir la fin de ce fichier.

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
| `check:langue` | 8 contrôles sur 2374 clés |
| `check:signal` | 38 écrans, aucun avec plus d'un ambre, dans les DEUX éditions |
| `check:contraste` | 101 écrans, 21 401 textes, aucun sous WCAG AA |

## Ce qui reste de la famille : Tâches

`TasksScreen.tsx` fait 1060 lignes — huit fois la taille des quatre autres
réunis par module. Il porte la file unifiée de La Garde, l'attribution, les
priorités et les filtres. Le composer demande une passe à lui seul, et le
bâcler en fin de famille serait exactement ce que ce chantier refuse. Il est
donc nommé comme restant, en tête de la suite.
