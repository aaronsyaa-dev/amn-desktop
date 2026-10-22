# Constat — écrasement en écriture concurrente (dernier-gagne) sur amn-api

- **Date** : 2026-10-22 (mis à jour après approfondissement)
- **Session** : SIM (simulation, bac à sable)
- **Gravité** : **haute** — perte de travail silencieuse, sans avertissement.
- **Où** : amn-api — `PUT /v1/collections/:collection/:id` (`src/routes/collections.js`), `upsertRecord` (`src/db/sqlite.js`, `src/db/postgres.js`).
- **Cause racine** : le correctif de fusion écrit en septembre n'est pas dans amn-api (voir plus bas).
- Je ne corrige pas (règle SIM) : constat et preuve.

## Ce qui casse, en trois formes

Rejoué par `npm run sim:usage` et `npm run sim:concurrence` (graine fixe, rejouable).

| Scénario | Résultat mesuré |
|---|---|
| Deux comptes, champs différents, même fiche | une des deux modifications est perdue |
| **Huit personnes**, un champ chacune, 15 tours, lecture puis réécriture de la fiche entière (comme le poste) | **7 champs sur 8** ont perdu la dernière modification de leur auteur |
| Une fiche supprimée par A, réécrite par un poste de B resté hors ligne | la fiche **ressuscite** (`deleted: true → false`) sans que A en soit informé |

Le deuxième chiffre est le plus parlant : dès que plusieurs personnes travaillent sur une même fiche
(un dossier client, un projet), la fiche ne garde presque rien de ce que la majorité y a fait.
La coupure réseau n'est pas nécessaire : deux postes connectés qui ont la fiche ouverte suffisent.

## Cause

`PUT` ne lit que `req.body.data` et remplace la ligne entière (`data = excluded.data`, `deleted = 0`).
Ni champ de base déclaré, ni fusion, ni test de version : dernier-gagne, et toute écriture rend la fiche vivante.

Le correctif existe mais n'est **jamais arrivé dans amn-api** :

```
src/lib/fusion.js          ABSENT   (deciderEcriture)
upsertRecordFusion         ABSENT
```

Il dort dans `docs/captures/fusion-2026-09-10/amn-api-fusion.patch`, et le poste envoie déjà les
champs `base`/`champs` qu'un serveur sans fusion ignore. Même sort pour `amn-api-confort.patch`
(voir `2026-10-22-journal-activite-route-manquante.md`).

## Piste (pour l'équipe amn-api)

1. Appliquer la moitié serveur de `amn-api-fusion.patch` (le test d'applicabilité ne conclut pas : les fichiers ont dérivé, il faudra rebaser le patch).
2. Décider du sort d'une écriture périmée sur une fiche supprimée : refuser plutôt que ressusciter.
3. Relancer `npm run sim:concurrence` : les trois scénarios doivent passer au vert. Vérifier aussi sur Postgres (verrou `FOR UPDATE`), non exercé ici.
