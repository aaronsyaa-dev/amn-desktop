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
- **`qrCodes`** — les codes fabriqués et gardés (`20c`) : intitulé,
  destination, emplacement, et le compteur de scans. Le compteur n'est jamais
  écrit par le poste — voir le second patch.
- **`calcTapes`** — les rubans de caisse de la Calculatrice pro (`21b`), un
  module créé pendant le chantier : `MODULES.md` le décrit, le produit n'avait
  que les Calculateurs, qui répondent à une autre question.

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

## `amn-api-qr-scan.patch`

La route publique qui compte les scans d'un QR code.

```
POST /v1/qr/:orgId/:codeId/scan  → +1 scan, et la date du dernier
```

POURQUOI ELLE EXISTE CÔTÉ SERVEUR. Le module QR codes affiche un compteur de
scans, et ce compteur ne peut pas être tenu par le poste : celui qui scanne
est un passant avec un téléphone, sans compte et sans session. La seule trace
de son passage est l'ouverture de l'adresse encodée dans le code. Le comptage
doit donc vivre sur le serveur ou nulle part.

Trois retenues, parce que la route est ouverte :

- elle n'accepte QUE d'incrémenter — aucun corps n'est lu, aucune valeur ne
  peut être posée ;
- elle ne crée rien : un `codeId` inconnu répond 404 ;
- elle est freinée par adresse, comme la page de rendez-vous.

Côté poste, `src/lib/qrScan.ts` l'appelle depuis la page publique de
rendez-vous et la mini-page quand l'adresse porte `?qr=<id>`, une seule fois
par ouverture de page.

Le patch ajoute `src/routes/qr.js` et son branchement dans `src/server.js`.
Tant qu'il n'est pas appliqué, les compteurs de scans restent à leur valeur
de départ et l'écran QR codes affiche un ambre qui ne bouge jamais.
