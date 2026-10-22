# Carte des points faibles — classés par gravité (hors sécurité)

> Passe du 2026-10-22, bac à sable amn-api. Chaque ligne renvoie à son constat et à la commande qui la rejoue.
> Les points de sécurité sont tenus en local (dépôt public) : voir `constats-securite/` sur le poste qui a lancé la passe.

| # | Gravité | Point faible | Preuve | Rejouer |
|---|---|---|---|---|
| 1 | 🔴 haute | **Écrasement concurrent** : dernier-gagne, 7 champs sur 8 perdus à huit personnes ; une fiche supprimée ressuscite | [constat](constats/2026-10-22-ecrasement-ecriture-concurrente.md) | `npm run sim:concurrence` |
| 2 | 🟠 moyenne | **Lot d'événements** : non atomique (9 à 116 événements sur 200 après un crash), renvoyé = doublons | [constat](constats/2026-10-22-lot-evenements-non-atomique-ni-idempotent.md) | `npm run sim:durabilite` |
| 3 | 🟠 moyenne | **Journal d'activité du poste** : la route `_activity` n'existe pas, l'écran reste vide sans le dire | [constat](constats/2026-10-22-journal-activite-route-manquante.md) | `npm run sim:contrat` |
| 4 | 🟠 moyenne | **Présence temps réel en N³** : une organisation de 600 personnes reçoit 3,7 Go de trames d'arrivée | [constat](constats/2026-10-22-presence-websocket-cout-cubique.md) | `npm run sim:echelle` |
| 5 | 🟡 basse | **Un gros espace fige l'API** : dix postes qui lisent 10 000 fiches (5,3 Mo chacun) bloquent la boucle d'événements de 0,3 à 0,9 s ; toute l'API attend (lecture et sérialisation synchrones, sans pagination) | `RAPPORT.md` local | `npm run sim:echelle` |
| 6 | 🟡 basse | **Tempête de connexions** : hachage lié au CPU, ~82/s sur 4 cœurs (≈ 10/s sur 0,5 CPU, estimation) ; les sessions durent 30 jours, donc rare | `RAPPORT.md` local | `npm run sim:echelle` |
| 7 | 🟡 basse | **Ronde de Garde interrompue** : état « en ronde » périmé et lignes sans fin (cosmétique ; une ronde planifiée est rejouée) | `RAPPORT.md` local | `npm run sim:durabilite` |
| 8 | 🟡 basse | **Freins en mémoire** remis à zéro par un redémarrage | `RAPPORT.md` local | `npm run sim:durabilite` |
| 9 | ⚪ latent | **Curseur `since`** (`>` strict, milliseconde) : non reproduit sur 900 fiches ; le poste ne l'emploie pas | `RAPPORT.md` local | `npm run sim:concurrence` |

## Cause commune des points 1 et 3

Deux correctifs amn-api de septembre (`amn-api-fusion.patch`, `amn-api-confort.patch`) sont documentés et validés dans
ce dépôt mais **ne sont pas dans amn-api** : `src/lib/fusion.js`, `src/lib/activityLabel.js`, `upsertRecordFusion` et la
table `record_activity_log` n'y existent pas. Les appliquer (après rebase : les fichiers ont dérivé) ferme les
points 1 et 3 d'un coup.

## Ce qui tient

400 connexions simultanées · 10 `SIGKILL` sans perte ni corruption · isolement entre organisations · 2000 sockets ·
10 000 fiches lues d'un coup · Garde à 2000 comptes.
