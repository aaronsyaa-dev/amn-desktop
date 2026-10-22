# Constat — la présence temps réel coûte en N³ pour une grosse organisation

- **Date** : 2026-10-22
- **Session** : SIM (`npm run sim:echelle`)
- **Gravité** : **moyenne** pour une cliente de plusieurs centaines de personnes, nulle pour les petites.
- **Où** : amn-api — `src/ws/hub.js` : chaque arrivée appelle `broadcastPresence(orgId)`, qui envoie la liste complète des présents à tous les présents.

## Mesure

Une seule organisation dont tout le monde ouvre l'application en même temps (100 postes à la fois) :

| Personnes | Trames de présence reçues par les postes |
|---|---|
| 300 | 472 Mo |
| 600 | 3 748 Mo (×7,9 pour 2× plus de monde) |

Croissance en **N³** : N arrivées × environ N/2 destinataires × une liste de N noms. Extrapolé à 2000 :
de l'ordre de 100 Go (estimation d'après l'exposant mesuré, non mesurée). Pendant les 600 arrivées, un collègue déjà
connecté voit ses lectures monter à p95 ≈ 220 ms, avec des pointes de 1,1 s (boucle d'événements occupée).

À l'échelle de 2000 comptes répartis sur 60 organisations de ~33 personnes, aucune gêne : 2000 sockets ouvertes
en 1,7 s, diffusion d'une fiche à 34 collègues en p95 13 ms, mémoire 268 Mo.

## Piste

Diffuser un *delta* (« X est arrivé ») plutôt que la liste complète, et ne renvoyer la liste complète qu'à
l'arrivant. Le coût devient en N².
