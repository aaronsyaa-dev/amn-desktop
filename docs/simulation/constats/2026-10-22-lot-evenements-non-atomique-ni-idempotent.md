# Constat — un lot d'événements n'est ni atomique ni rejouable sans doublon

- **Date** : 2026-10-22
- **Session** : SIM (`npm run sim:concurrence`, `npm run sim:durabilite`)
- **Gravité** : **moyenne** — données dupliquées ou à moitié écrites, détection faussée.
- **Où** : amn-api — `POST /v1/events` (`src/routes/events.js`, boucle `insertEvent` événement par événement).

## Ce qui casse

1. **Pas de transaction sur le lot.** Un lot de 200 événements coupé par un redémarrage brutal laisse une
   partie du lot en base : sur 5 essais, 200, 94, 134, 18 et 0 événements stockés (les valeurs varient avec le
   moment du crash ; 3 lots sur 5 étaient à moitié écrits).
2. **Pas de clé d'idempotence.** Un poste qui n'a pas reçu l'accusé renvoie son lot : 20 événements envoyés
   puis renvoyés une fois donnent **40 stockés**.

Les deux se cumulent : après un crash, le poste renvoie le lot entier, et les événements déjà écrits sont
doublés. Les compteurs de la détection (force brute : 5 échecs en 5 min) les comptent deux fois, et le rapport
mensuel aussi.

## Piste

Insérer le lot dans une transaction ; accepter un identifiant d'événement fourni par le traceur (ou le dériver :
site + horodatage + type + empreinte du contenu) et ignorer les doublons.

## À noter

L'ingestion est durable à l'unité : sur 10 `SIGKILL` sous six écrivains, 0 écriture accusée perdue,
0 base corrompue (`sim:durabilite`).
