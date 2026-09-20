# Patchs pour `amn-api`

`amn-api` vit dans un autre dépôt. Les changements de serveur qu'un chantier
côté poste rend nécessaires sont donc exportés ici, en clair, plutôt que
laissés dans un conteneur qui disparaît.

## `amn-api-interventions.patch`

Le module **Interventions** (`24c`) a été créé pendant le chantier « système de
design » : `MODULES.md` le décrit, le produit ne l'avait pas. Sa collection
`interventions` doit être acceptée par le serveur, sinon `check:persistence`
refuse le module — et il a raison : une collection que l'API n'accepte pas
reste sur le poste, disparaît à la réinstallation et n'existe pas sur le
téléphone.

Le patch touche deux fichiers :

- `src/db/tenancy.js` — l'entrée du module dans `MODULE_CATALOGUE`, et la
  ligne `interventions: ['interventions']` dans `MODULE_COLLECTIONS` ;
- `src/routes/collections.js` — `'interventions'` dans la liste des
  collections synchronisables.

À appliquer depuis la racine d'`amn-api` :

```
git apply /chemin/vers/amn-desktop/docs/patchs/amn-api-interventions.patch
```

Tant qu'il n'est pas appliqué et déployé, l'écran Interventions fonctionne en
local mais sa donnée ne se synchronise pas.
