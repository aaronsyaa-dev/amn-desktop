# Famille E — le collectif, avant et après

Quatre modules composés le 12 septembre : `Sondages`, `Annonces`, `Appels`,
`Groupes`. Ils partagent une section de barre latérale et rien d'autre — une
distribution de voix, une couverture de lecture, une présence en direct, une
conversation. C'est la famille qui met le mieux à l'épreuve la règle du
chantier : deux écrans ne doivent jamais se ressembler dans leur structure.

## L'avant, mesuré

Les quatre partaient du même gabarit : un `ScreenHeader`, une rangée de relevés,
puis une pile de cartes de poids égal. Sur `avant/sondages.png`, un sondage clos
depuis une semaine, un sondage déjà voté et un sondage qui attend ma voix ont la
même carte. Sur `avant/groupes.png`, un rail alphabétique de trois lignes
« 3 membre(s) » et, à droite, 60 % de la hauteur de fenêtre en panneau vide.

## L'après, module par module

| Écran | Objet dominant | Pourquoi celui-là | Ambre |
|---|---|---|---|
| Sondages | Le sondage qui attend MA voix, question à 27 px, choix en barres | Voter est le seul geste que personne ne peut faire à ma place ; les autres sondages sont des résultats, pas des questions | `IL ATTEND VOTRE VOIX` |
| Annonces | Deux trombinoscopes : qui a lu, qui n'a pas lu | Une annonce ne pose pas de question, elle attend d'être reçue ; ce qui manque, ce sont des personnes, donc des visages | `N'ONT PAS LU`, ou le bouton « marquer lue » selon qui regarde |
| Appels | Les joignables en portraits de 44 px, seuls, en grand | C'est la seule liste dont chaque entrée est actionnable à la seconde ; quand elle est vide, « Personne n'est joignable. » se dit en grand plutôt qu'en gris | aucun : la présence est un état, pas une décision — l'ambre est réservé aux appels manqués |
| Groupes | Une bande horizontale de salles, la plus vivante en tête | Un groupe n'est pas un document qu'on choisit dans une liste : c'est une salle, et ce qu'on veut savoir en arrivant est laquelle a parlé | aucun : `groupMessages` n'a pas de `readBy`, un ambre y marquerait une heure et non une décision |

Trois rails verticaux existent déjà (Notes, Pages, Contrôles qualité). Groupes
n'en devient pas un quatrième, et c'est l'arbitrage le plus disputé de la
famille : il est écrit en tête de `src/screens/GroupsScreen.tsx`.

## Les preuves

- `apres/appels.png` — personne en ligne : la branche vide, et le registre des
  absents avec leur dernière connexion.
- `apres/appels-joignable.png` — la branche qui compte, prouvée en ouvrant une
  **seconde session** (Nadia) pendant la capture. La présence vient du hub, pas
  de la base : elle ne se sème pas, elle se tient ouverte.
- `apres/sondages-business.png` — le même écran dans l'édition Business. Les
  quatre modules sont partagés entre les deux éditions.

## Les gardes, à la livraison de la famille

| Garde | Résultat |
|---|---|
| `tsc` | 0 erreur |
| lint | 76 avertissements, 0 erreur — la ligne de base inchangée |
| `check:encres` | aucun défaut, 33 copies connues |
| `check:langue` | 8 contrôles sur 2291 clés |
| `check:signal` | 29 écrans, aucun avec plus d'un ambre (les deux éditions) |
| `check:contraste` | 101 écrans, 20 288 textes, aucun sous WCAG AA |

## Deux choses apprises sur la mesure elle-même

**Les gardes navigateur écrivent dans le bac à sable.** `check:contraste`
bascule les interrupteurs qu'il rencontre pour mesurer les deux états : il a
voté dans un sondage, et la capture suivante montrait « à voter : 0 ». Une
campagne de captures se fait donc après un `seed-essai`, jamais après une garde.

**L'intro « Bienvenue sur AMN Business » mange la première capture** d'une
session de navigateur neuve. Le script la referme maintenant par un clic sur la
barre d'état, en bas à gauche : un clic au centre avait, lui, voté.
