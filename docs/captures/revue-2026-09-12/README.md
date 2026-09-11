# Revue du rendu réel — 12 septembre 2026

Captures de l'application sur un bac à sable **peuplé**, pour juger la direction
de design sur des écrans qui ont quelque chose dessus. Un écran vide ne prouve
rien d'une composition : il ne montre ni hiérarchie, ni objet dominant, ni la
tenue d'une liste quand elle est longue.

## Ce qui est là

| Dossier | Édition | Écrans |
|---|---|---|
| `interne/` | poste de travail AMN DevSec | Accueil, Tâches, **La Garde** (6 vues), **Tour de contrôle** (4 vues), Salle de contrôle, supervision, parc, produits, administration |
| `cliente/` | espace d'une cliente (AMN Business) | les 24 écrans maquettés + le reste des modules, réglages compris |

Chaque dossier porte un `index.md` : la liste numérotée, l'adresse de chaque
écran et le titre qu'il a réellement rendu.

## Comment lire ces images

- **Largeur 1180 px**, celle à laquelle la direction a été dessinée. C'est la
  seule largeur où la comparaison avec les maquettes est honnête.
- **Hauteur 1000 px**, soit une fenêtre d'ordinateur portable. Ce qui dépasse
  est coupé : plusieurs écrans continuent sous le pli, et c'est voulu — on juge
  ce qu'on voit en ouvrant, pas une page dépliée qui n'existe pour personne.
- Les bandeaux de **première ouverture** des modules (« Compris ») sont
  refermés avant les captures : ils masquaient le haut de chaque écran.
- La carte **« Quel est votre poste ? »** reste visible en bas de l'Accueil
  interne. Elle n'apparaît qu'une fois par compte et ne revient pas ; la
  refermer par script n'a pas fonctionné de façon fiable, et la laisser est
  honnête — c'est ce qu'un compte neuf voit réellement. Elle est sous la file
  des points d'attention, donc elle ne masque rien de la composition à juger.

## Les données

Inventées, et invérifiables par construction : tous les comptes sont en
`@exemple.test`, domaine réservé par la RFC 2606. Trois commerces fictifs —
Maison Bertaux, Brasserie du Port, Studio Nord — et une organisation cliente,
Atelier Syraagensy.

Deux scripts les écrivent, et refusent tous les deux de s'exécuter ailleurs que
sur un bac à sable :

- `scripts/seed-essai.mjs` — les modules : clients, devis, factures, rendez-vous,
  projets, dépenses, temps, tournées, contrôles, médias, pages, rapports.
- `scripts/seed-supervision.mjs` — le parc : neuf sites sur trois clientes, dans
  les trois états qui comptent (en ligne, hors ligne, jamais vu), et trois
  incidents ouverts dont un critique que personne n'a pris.

La Garde tourne pendant la campagne : les tâches qu'on voit sur l'écran Tâches
ont été écrites par elle, à partir des incidents du parc. Ce ne sont pas des
tâches posées à la main pour la photo.

## Une limite à dire

Les captures sont **datées**. Le parc a un battement de cœur : un site silencieux
plus de cinq minutes repasse hors ligne tout seul, et l'heure change les
salutations comme les écarts (« non pris en charge depuis 7 h »). Deux campagnes
lancées à une heure d'intervalle ne donnent donc pas exactement les mêmes
chiffres. C'est le sujet qui veut ça, pas un défaut de la mesure.

## Refaire la campagne

```
# l'API du bac à sable
cd ../amn-api && PORT=8791 SQLITE_PATH=<bac>/design.db node src/server.js

# les données
AMN_API=http://127.0.0.1:8791 AMN_E2E_EMAIL=design@exemple.test \
  AMN_E2E_PASSWORD=… node scripts/seed-essai.mjs
SQLITE_PATH=<bac>/design.db node scripts/seed-supervision.mjs

# les bundles
VITE_AMN_API_URL=http://127.0.0.1:8791 AMN_WEB_OUT=<bac>/interne npm run build:web
VITE_AMN_API_URL=http://127.0.0.1:8791 AMN_WEB_OUT=<bac>/cliente npm run build:web:business

# les captures
AMN_E2E_EMAIL=design@exemple.test AMN_E2E_PASSWORD=… \
  node scripts/captures-revue.mjs <bac>/interne interne docs/captures/<date>/interne 4301
AMN_E2E_EMAIL=design@exemple.test AMN_E2E_PASSWORD=… \
  node scripts/captures-revue.mjs <bac>/cliente cliente docs/captures/<date>/cliente 4302
```
