# Patchs pour `amn-api`

`amn-api` vit dans un autre dépôt. Les changements de serveur qu'un chantier
côté poste rend nécessaires sont donc exportés ici, en clair, plutôt que
laissés dans un conteneur qui disparaît.

## `amn-api-interventions.patch`

Trois collections nées du chantier « système de design ». Aucune n'est un
caprice d'écran : sans elles, `check:persistence` refuse les modules
concernés — et il a raison, une collection que l'API n'accepte pas reste sur
le poste, disparaît à la réinstallation et n'existe pas sur le téléphone.

- **`interventions`** — le module Interventions (`24c`) a été créé pendant le
  chantier : `MODULES.md` le décrit, le produit ne l'avait pas.
- **`leaveQuotas`** — le droit à congés d'une personne pour une année. Le
  module Absences s'en passait délibérément (« un compteur de jours, ce serait
  une paie ») ; le carnet à souches de `19e` a besoin d'un TOTAL, et sans lui
  il ne peut rien dessiner. Un nombre de jours saisi à la main, sans
  acquisition ni ancienneté — donc pas une paie.
- **`calls`** — le journal des appels (`20b`) : qui, dans quel sens, quand,
  combien de temps. Rien du contenu ; l'audio reste de poste à poste.

Le patch touche deux fichiers :

- `src/db/tenancy.js` — l'entrée `interventions` dans `MODULE_CATALOGUE`, et
  les lignes de `MODULE_COLLECTIONS` pour les trois modules ;
- `src/routes/collections.js` — les trois noms dans la liste des collections
  synchronisables.

À appliquer depuis la racine d'`amn-api` :

```
git apply /chemin/vers/amn-desktop/docs/patchs/amn-api-interventions.patch
```

Tant qu'il n'est pas appliqué et déployé, les écrans Interventions, Absences
et Appels fonctionnent en local, mais ces trois collections-là ne se
synchronisent pas : les carnets de congés et le journal d'appels resteront
vides sur le téléphone.
