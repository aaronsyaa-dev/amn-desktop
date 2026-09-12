# Bloc 0 — les 43 modules restants, groupés par nature réelle

Vingt-cinq écrans ont reçu une composition dédiée (les 24 maquettés, plus les
trois écrans de réglages et les deux accueils). Les autres n'ont reçu que
l'habillage des fondations : jetons, barre latérale, en-tête. Ils se ressemblent,
et la revue du 12 septembre le montre sur captures réelles.

## Ce que « se ressembler » veut dire ici, mesuré

Le gabarit commun, visible sur `15-relances`, `28-sav`, `24-fournisseurs` et
vingt autres : un `ScreenHeader`, une rangée de deux à quatre relevés, puis une
**pile de cartes de poids égal**. Rien ne domine, aucun ambre, et l'ordre de la
pile est le seul indice de priorité — un indice qu'on ne lit pas.

Sur Relances, la conséquence est nette : une facture en **mise en demeure** à
45 jours et un simple rappel à 4 jours ont exactement la même carte, la même
taille, la même encre. Le module sait pourtant les distinguer — il écrit trois
lettres de tons différents — mais l'écran ne le dit pas.

## Le groupement

Par **nature des données**, pas par section de barre latérale : deux modules
rangés côte à côte dans la barre peuvent n'avoir aucune logique commune, et deux
modules éloignés peuvent partager la même.

### A — Les files : quelque chose arrive et attend une réponse
`Relances` · `SAV` · `RDV en ligne` · `Assistance` · `Messages privés`

Même logique : un objet entrant, un âge, un état, et une réponse à donner.
**C'est la famille la plus dangereuse à composer** : quatre têtes de file
composées pareil feraient quatre écrans jumeaux. Chacun doit dominer par ce qui
lui est propre — le TON de la lettre pour les relances, l'ÂGE pour le SAV, le
CRÉNEAU demandé pour les rendez-vous, le FIL pour les messages.

### B — Les registres : une référence qu'on consulte
`Fournisseurs` · `Nomenclatures` · `Modèles` · `Trombinoscope` · `Coffre-fort`

On vient y chercher une entrée précise, pas surveiller un état. La question
n'est pas « qu'est-ce qui a changé » mais « où est celui que je cherche » :
c'est la recherche et l'ordre qui dominent, pas une carte de tête.

### C — Les plans : qui fait quoi, quand
`Planning d'équipe` · `Absences` · `Tableau des projets` · `Pipeline` · `Tâches`

Des données à deux axes (personne × temps, ou étape × affaire). Le piège est la
matrice : `5d Routines` en a déjà une, et trois matrices de plus feraient une
famille indistincte. Chacun doit trouver son axe dominant.

### D — Les vitrines : ce que le dehors voit
`Mini-page` · `Portfolio` · `Lettre d'information` · `Formulaires` ·
`Signature sur place` · `QR codes`

Le seul groupe dont l'objet n'est pas dans l'application : il est chez le
visiteur. L'écran doit montrer le RENDU, pas le réglage qui le produit.

### E — Le collectif : ce qui s'écrit à plusieurs
`Groupes` · `Annonces` · `Sondages` · `Appels`

Quatre natures franchement différentes malgré la section commune : une salle,
une diffusion, un vote, une conversation. C'est la famille où « chacun un
monde » est le plus facile à tenir honnêtement.

### F — Les bilans : une période qu'on ferme
`Revue hebdo` · `Journal de bord` · `Caisse du jour` · `Objectifs & résultats`

On les ouvre à un moment précis (fin de semaine, fin de journée) pour arrêter un
compte. Le dominant est le RÉSULTAT de la période, pas la liste qui y mène.

### G — Le personnel : une seule personne, une série
`Courses` · `Habitudes` · `Objectifs perso` · `Journal perso` · `Pomodoro`

Rien de partagé, aucune décision d'équipe. Le piège : `Habitudes` ressemble à
`5d Routines` et `Journal perso` à `Journal de bord`. Il faut que la version
personnelle soit composée AUTREMENT que sa jumelle d'équipe, sinon le doublon
saute aux yeux.

### H — La relation : ce qui fait revenir un client
`Avis` · `Fidélité` · `Parrainage` · `Événements`

### I — Les outils : on entre, on sort, on s'en va
`Calculateurs` · `Convertisseurs` · `Import/export`

Pas de données propres : ce sont des fonctions. Le dominant est le RÉSULTAT du
calcul, et rien d'autre ne doit lui disputer la place.

### J — La production
`Suivi de montage` · `SAV` (déjà en A, par sa logique de file)

### K — Le système
`Découvrir`

## Une contrainte découverte au départ, et qui change le plan

**La plupart de ces modules sont VIDES dans le bac à sable.** `seed-essai.mjs`
peuple les modules déjà composés ; il ne connaît ni les sondages, ni les
absences, ni la caisse. Or composer sans données, c'est deviner : l'objet
dominant d'un écran se trouve en regardant ce qui s'y accumule vraiment.

Chaque famille livrée demande donc, dans l'ordre : lire le modèle, **semer**,
capturer l'avant, composer, capturer l'après, passer les gardes. C'est ce qui
fixe le rythme, et c'est pourquoi ce chantier se livre par familles plutôt que
d'un bloc.

## Où ça s'arrête

Voir le rapport final : les familles réellement livrées y sont listées, avec
pour chaque module l'objet dominant retenu et la raison. Ce qui n'a pas été
composé reste à l'état d'habillage, et est nommé.
