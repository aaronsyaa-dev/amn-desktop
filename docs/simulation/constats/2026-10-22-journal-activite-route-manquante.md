# Constat — le poste appelle une route qu'amn-api n'a pas (`/v1/collections/_activity`)

- **Date** : 2026-10-22
- **Session** : SIM — contrôle de contrat poste ↔ API (`npm run sim:contrat`)
- **Gravité** : **moyenne** — une fonction du poste ne marche pas, et ne le dit pas.
- **Où** : poste `src/lib/bridge.ts:711` et `src/main/remoteApi.ts:230` ; amn-api n'a aucune route `_activity`.

## Ce qui casse

Le poste demande `GET /v1/collections/_activity?limit=50` pour afficher le journal d'activité de l'équipe
(`src/screens/TeamScreen.tsx:402`). Côté amn-api, `_activity` est lu comme un nom de collection
(`/:collection`) : **404 « Unknown collection »**. L'écran avale l'erreur (`.catch(() => setEntrees([]))`) :
le journal est vide en permanence, sans message, et le poste redemande toutes les 20 s pour rien.

## Méthode

Le contrôle lit les chemins `/v1/…` littéraux des sources du poste (lecture seule, commentaires écartés) et les
compare à l'inventaire des routes de l'application amn-api montée (236 routes). Un seul écart réel sur la
passe : celui-ci. Limite : les chemins composés par concaténation complexe échappent à l'analyse.

## Cause

Même racine que l'écrasement concurrent : `amn-api-confort.patch` (11/09) crée `src/lib/activityLabel.js`
et la table `record_activity_log` ; **ni l'un ni l'autre n'existe dans amn-api**.

## Piste

Appliquer (après rebase) la partie `confort` du patch, puis `npm run sim:contrat` doit passer au vert.
À garder comme garde-fou : ce contrôle attrapera la prochaine route oubliée.
