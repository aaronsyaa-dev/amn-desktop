# Constat — écrasement en écriture concurrente (dernier-gagne) sur amn-api

- **Date** : 2026-10-22
- **Session** : SIM (simulation, bac à sable)
- **Gravité** : haute — perte de travail silencieuse, sans avertissement.
- **Où** : `amn-api` — `PUT /v1/collections/:collection/:id` (`src/routes/collections.js`), couche données `upsertRecord` (`src/db/sqlite.js`, `src/db/postgres.js`).
- **Je ne corrige pas** (règle SIM) : constat + preuve. Le correctif existe déjà, non poussé (voir plus bas).

## Ce qui casse

Deux comptes de la **même** organisation modifient des champs **différents** de la
**même** fiche, quasi simultanément (ou l'un après une coupure réseau). Le second
`PUT` écrase le premier intégralement : le champ modifié par l'autre poste est
**perdu**, et personne n'est averti.

C'est exactement le scénario S5 de `docs/audit-fiabilite-2026-09-10.md`, et le
défaut que `docs/fusion-ecriture-concurrente-2026-09-10.md` déclare fermé —
mais le correctif n'est **pas déployé** dans amn-api (voir « Cause »).

## Reproduction (rejouable)

```
npm run sim:usage        # scénarios « Conflits d'écriture » et « Hors ligne puis reconnexion »
```

Les deux scénarios partent d'une fiche `tasks` `{ status:"todo", priority:"normal" }`
lue par deux comptes, puis :

| Étape | Poste A (en ligne) | Poste B (hors ligne / concurrent) |
|---|---|---|
| 1 | — | part de l'état `todo/normal` |
| 2 | `priority → "high"` (accepté) | — |
| 3 | — | rejoue son écriture : `status → "doing"`, `priority="normal"` (périmé) |

**État final observé** : `{ status:"doing", priority:"normal" }`.
`priority="high"` (modification de A) n'existe plus nulle part. Mesuré côté HTTP,
pas seulement supposé — sortie de la passe du 2026-10-22 :

```
Conflits d’écriture  🔴 CASSE — état final { status:"doing", priority:"normal" } — une modification écrasée
Hors ligne/reconnexion 🔴 CASSE — priority="high" (A) perdue : état final { status:"doing", priority:"normal" }
```

## Cause

`PUT /v1/collections/:collection/:id` ne lit que `req.body.data` et appelle
`upsertRecord`, qui remplace la ligne entière (`data = excluded.data`). Aucun
champ de base déclaré, aucune fusion : c'est du **dernier-gagne**.

Le correctif est écrit et validé mais **jamais poussé** : `src/lib/fusion.js`
(`deciderEcriture`) et la route `upsertRecordFusion` (`FOR UPDATE` côté Postgres)
sont **absents** du HEAD d'amn-api (`git`). Le patch dort dans
`amn-desktop/docs/captures/fusion-2026-09-10/amn-api-fusion.patch`, et le poste
envoie déjà `base`/`champs` qu'un serveur sans fusion ignore.

```
$ ls amn-api/src/lib/fusion.js
→ No such file or directory
```

## Piste (pour l'équipe amn-api, pas pour moi)

Appliquer `amn-api-fusion.patch` (5 fichiers) : la moitié poste est déjà en place,
donc pousser la moitié serveur ferme le scénario sans rien changer d'autre.
À revérifier ensuite par `npm run sim:usage` (les deux rouges doivent passer au vert)
et sur Postgres (verrou `FOR UPDATE`, non exercé par la simulation SQLite).
