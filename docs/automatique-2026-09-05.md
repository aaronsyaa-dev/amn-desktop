# L'Automatique — rapport de chantier (en cours)

Chantier « de la voiture manuelle à l'automatique », nuit du 5 au 6 septembre 2026.
Point de départ : branches `avant-automatique` sur les deux dépôts.

## Bloc 2 — Futurisme sobre

### Recensement : les décisions que l'écran prenait pour vous, et celles qu'il prend maintenant

| Décision | Avant | Maintenant |
|---|---|---|
| Quelle équipe regarder dans la Salle | à rechoisir à chaque ouverture | mémorisée sur le poste (« amn.garde.salle.equipe ») |
| Que faire ensuite dans la conversation avec Ajmani | à deviner, catalogue ouvert | ≤ 3 suites proposées après chaque réponse (Bloc 3) |
| Quoi lire d'abord dans la Tour | tout, à plat | exceptions d'abord, la Garde de fond (Bloc 0) |
| D'où vient un chiffre de la Salle | un nombre nu | sa courbe sur sept jours, comptée par le serveur, jamais simulée |
| Un dossier décidé disparaît | d'un coup, on perd le fil | il se retire d'un souffle ; « Décidées à l'instant » compte ce que vous venez de faire |
| Quel poste choisir à la première ouverture | carte proposée, rien de pré-choisi | inchangé : rien dans les données ne permet de deviner sans se tromper, on ne pré-coche pas au hasard |

### Ce qui change à l'écran

- **L'anneau qui respire** : le pouls (Salle, Ajmani, Tour) respire au rythme du rail — quatre secondes au calme, plus court quand quelque chose attend. Plus aucun « ping » radar : ni sur le pouls, ni sur un garde en ronde, ni sur un site en ligne (le point « à jour » des Signes Vitaux le remplace). La couleur glisse en 700 ms quand l'état change au lieu de sauter.
- **Les chiffres à mémoire** : l'en-tête de la Salle porte « Remontées, 7 jours » et « Réglé seul, 7 jours » avec leur courbe fantôme. Le serveur compte par jour (`/v1/garde/salle` → `series`) ; le poste ne fabrique aucun historique (`serieFluxComptee`, gardée par `check:vitaux`).
- **Le mouvement qui dit quelque chose** : une bulle d'Ajmani arrive d'un glissement de six pixels ; un dossier décidé se replie. `prefers-reduced-motion` : les deux deviennent une simple apparition/disparition (`useReducedMotion`), et le souffle devient une intensité fixe.
- **Ludique, sérieusement** : dans « À votre avis », un relevé « Décidées à l'instant » compte ce que vous avez décidé depuis l'ouverture de l'écran — un compteur qui compte, pas un score, pas de confettis.
- **Parole** : une organisation disparue n'est plus nommée par son identifiant (« chez ba1426c2-… ») : on ne dit rien plutôt qu'un identifiant.

### Mesure

Captures dans `docs/captures/automatique-2026-09-05/apres-interne/` (poste et téléphone).
Auto-notation : Salle 4/5 (deux fois), À votre avis 4/5, Ajmani 4/5. « Est-ce que ça donne envie de lire ? » — la Salle et la pile, oui ; Ajmani reste dépendant de la longueur de ses réponses (voir Bloc 5).

Limite dite : le souffle et le glissement ne se voient pas sur une capture fixe ; ils se vérifient en ouvrant l'écran (classes `sv-souffle-*`, `motion.li`).
