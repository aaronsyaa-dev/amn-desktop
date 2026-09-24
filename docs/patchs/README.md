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

Il porte aussi deux entrées de catalogue sans aucune collection :

- **`calcPro`** et **`health`** (le Carnet de santé, `25e`) doivent exister
  dans `MODULE_CATALOGUE`, sinon le serveur refuse la clé à la création d'une
  organisation — même si le Carnet, lui, ne synchronise rien : ses dates
  restent sur le poste, comme le Budget et les Courses.

Le patch touche deux fichiers :

- `src/db/tenancy.js` — les entrées `interventions`, `calcPro` et `health`
  dans `MODULE_CATALOGUE`, et les lignes de `MODULE_COLLECTIONS` pour les
  modules qui ont bien une collection ;
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

## `amn-api-2026-09-24/` — le Hall, et l'invité (vision cliente, chantiers 4 à 6)

Le serveur du Hall, l'espace commun entre organisations volontaires. Sans
lui, l'écran « Le Hall » du poste dit « Le Hall a besoin du lien » et
l'index des extensions ne peut pas dire si l'organisation y est. Cette
série est le seul côté serveur du chantier « vision cliente » ; la
référence d'isolation est `docs/le-hall-2026-09-24.md`. Les mêmes commits
sont sur la branche `claude/cinquante-modules` du dépôt `amn-api` — la
série ici est la copie qui survit au conteneur.

- `0001` — les tables, les routes, la modération, sept tests ;
- `0002` — le nom d'affichage ne se fait pas passer pour le prestataire ni
  pour une organisation présente ; le consentement a un frein ;
- `0003`, `0004` — les tests du frein, et la correction du remise-à-zéro des
  freins dans les tests (chaque garde tient son registre par fermeture).
- `0005` — l'invité ne lit pas la vie interne de l'entreprise : congés,
  candidatures, formations, habilitations, paies, procédures, messages privés,
  groupes, annonces, réunions, objectifs se lisent vides pour un `guest` et
  ne s'écrivent pas (`test/invite.test.js`).

Il touche sept fichiers :

- `src/db/sqlite.js`, `src/db/postgres.js`, `src/db/schema.sql` — deux
  tables (`hall_participation`, `hall_messages`) et leurs méthodes dans les
  deux couches ;
- `src/routes/hall.js` — `/v1/hall/participation` (GET, PUT owner/admin),
  `/v1/hall/messages` (GET, POST), `/v1/hall/messages/:id/signaler` ;
- `src/routes/admin.js` — `/v1/admin/hall/participants`,
  `/v1/admin/hall/messages`, `PUT /v1/admin/hall/messages/:id/masquer` ;
- `src/server.js` — le montage ;
- `test/hall.test.js` — neuf tests (consentement, rôles, session de support,
  fuite, retrait, bornes, frein, signalement, masquage, nom d'affichage,
  frein de consentement) ; `src/middleware/rateLimit.js` — la remise à zéro
  des freins en test.

À appliquer sur `main` : `git am docs/patchs/amn-api-2026-09-24/*.patch`,
puis `npm test` (la suite complète passe : 476 tests). Aucune migration à
la main : les deux tables naissent au démarrage (`CREATE TABLE IF NOT
EXISTS`), sur SQLite comme sur Postgres.
