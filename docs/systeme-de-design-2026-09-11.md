# Système de design — ce qui est posé, ce qui reste

Le paquet de passation de Claude Design (direction 2a, « Le poste habité ») est appliqué aux
**fondations** et à **quatre écrans de module**, sur les **deux éditions**. Les 41 modules non
maquettés héritent du langage sans une ligne écrite pour eux — c'est ce que le Bloc 1 devait
prouver, et il le prouve.

**Où je m'arrête, dit franchement** : 4 des 24 écrans de module maquettés sont composés. Les 20
autres portent les fondations (peau, barre, en-tête, états vides, formulaires) mais gardent leur
composition d'avant. Le détail est au §5.

---

## 1. Bloc 0 — l'audit avant de construire

**Le commentaire faux est corrigé.** `modules.business.ts` affirmait que « Collectif n'existe pas
dans cette édition » — le code juste en dessous déclarait ses sept entrées, et
`appRoot.business.tsx` leurs sept routes. Vérifié avant d'écrire : `TEAM_ENABLED: false`
(`exclusive.business.tsx:66`) ne concerne pas cette famille mais l'écran `/team` de l'édition
interne. Le commentaire est réécrit pour garder la distinction, plutôt que supprimé.

**`--signal` est bien distinct de `--accent`, et il fallait le vérifier.** `--accent` vaut
`#ededed` — une encre presque blanche qui sert de **fond** aux boutons primaires. Mesure :
**305 occurrences de `bg-accent`** dans `src/`. Le basculer en ambre aurait rendu ambre chacun de
ces 305 boutons, et la règle « un seul ambre par écran » serait morte à la première page. La
recommandation du paquet est donc confirmée par le code : jeton séparé, `--accent` intouché.

**Un défaut trouvé au passage** : l'Accueil — l'écran de référence — portait **deux** ambres,
la plaque du rendez-vous et l'anneau de journée. L'anneau dit l'heure, il ne demande aucune
décision : il passe en gris. Idem pour les repères d'angle et la dernière barre de série de
l'encart « à encaisser ».

## 2. Bloc 1 — les fondations, et la preuve qu'elles se propagent

| Fichier | Ce qui change |
|---|---|
| `src/index.css` | Rampe à six paliers (fond `#060606`, carte calme `#0d0d0d`, dominante `#121212`, feuille `#111`), jeton `--signal` et ses quatre dérivés, `.panel` / `.panel-raised` / `.panel-sheet`, `.eyebrow` en 700, `.icon-token` de 26 px |
| `src/business/BusinessSidebar.tsx` | Deux niveaux : épinglés en clair, huit familles repliées avec leur compte. 236 px. Marqueur ambre de 3 px sur l'écran courant. Pied de compte |
| `src/components/Sidebar.tsx` | Édition interne : mêmes jetons, même marqueur, même largeur |
| `src/components/ScreenHeader.tsx` | Titre 26/32 px `-.03em`, filets de section, relevés en mono 23 px |
| `src/components/EmptyState.tsx` | Trois variantes (`invite`, `quiet`, `muted`) + amorces nommées |
| 93 fichiers d'écran | 283 occurrences de `strokeWidth` 1,5 et 1,75 portées à 1,9 ; les 2 et 2,25 délibérés intacts |

**La preuve de l'héritage** (`docs/captures/design-2026-09-11/bloc1/`) : avant/après sur
**Routines** et **Objectifs & résultats**, deux modules qui ne sont PAS dans les 27 maquettés et
pour lesquels aucune ligne n'a été écrite. Le titre passe de 22 à 32 px, l'état vide de 15 à 26 px
avec son glyphe, la barre latérale se range en deux niveaux, les icônes s'épaississent, le fond
descend. `check:ecrans` compte **81 écrans** qui passent par `ScreenHeader` : c'est le nombre de
modules qui ont changé de peau sans être touchés.

### L'écart assumé, et sa mesure

Le paquet donne quatre encres. Trois sont adoptées telles quelles. La quatrième — la sourdine
`#6b6b68` — ne l'est pas : mesurée sur le nouveau fond `#060606`, elle rend **3,79:1**, sous le
seuil WCAG AA de 4,5 pour du texte courant. Or `--color-text-muted` porte les surtitres, les
unités et les phrases d'aide. Le dépôt l'avait déjà relevée deux fois pour cette raison
(`#616160` → `#808080` → `#9a9a97`, voir `scripts/check-contraste.mjs`). Elle reste à `#9a9a97`
(7,27:1 sur le fond, 6,31 au pire cas).

C'est exactement l'arbitrage que le paquet fait lui-même pour la version muette d'`EmptyState` —
il y prend le contrepied du composant actuel au nom de la lisibilité. On applique sa logique à son
propre chiffre.

## 3. Bloc 3 — les systèmes transverses, en composants

Écrits une fois, pour les 68 modules. C'est le « système, pas quatre écrans » du paquet.

- **`components/formulaire/Champ.tsx`** — l'intitulé est un surtitre, jamais un placeholder (un
  placeholder disparaît dès qu'on tape) ; l'exemple vit dans la phrase d'aide ; le champ actif est
  le seul ambre du formulaire.
- **`components/formulaire/FormulaireEnPlace.tsx`** — moins de cinq champs s'ouvrent dans l'écran.
  Le bouton primaire inactif dit toujours ce qui manque. Pas de raccourci Échap, et la raison est
  écrite dans le composant.
- **`components/formulaire/AssistantEtapes.tsx`** — au-delà, une fenêtre à étapes, l'étape courante
  en plaque ambre, et les trois promesses affichées.
- **`components/messages/MessagesSysteme.tsx`** — `Refus` (ce qui bloque, qui le bloque, des
  sorties réelles), `BandeConfirmation` (jamais une fenêtre pour un geste réversible),
  `BandeHorsLigne`.
- **`components/EmptyState.tsx`** — les trois variantes, dont la muette à encre pleine.

**La preuve que ce sont des composants partagés et non des copies** : `Champ` et
`FormulaireEnPlace` sont définis une fois et importés par `ContractsScreen` ; aucune de leurs
règles (surtitre, phrase d'aide, liseré ambre du champ actif, bouton inactif qui s'explique) n'est
réécrite dans l'écran appelant. `EmptyState`/`FirstRun` sont importés par **59 fichiers**.

## 4. Bloc 2 — les écrans composés

| Id | Écran | Objet dominant posé | Ambre |
|---|---|---|---|
| `3d` | Contrats | Carte de tête (échéance la plus proche) + échéancier 12 mois + registre | le J−11 |
| `4a` | Facturation | Bande de masses + barre segmentée + deux factures dépassées + brouillons | le montant/segment en retard |
| `5c` | Priorités du jour | Trois emplacements (fait / en cours / libre) + bande 30 jours | la série en cours |
| `6b` | Stock | Bon de commande + jauges à seuil marqué | la plaque « à commander » |

Chaque écran a été comparé à sa capture (`docs/captures/design-2026-09-11/bloc2/`, maquette et
écran réel côte à côte), et corrigé après comparaison — l'échéancier de Contrats est passé d'une
barre par mois à **un trait par contrat** parce que la maquette le lisait ainsi, et qu'un mois à
trois échéances doit se lire comme trois.

Aucune composition n'est recopiée d'un écran voisin : la carte de tête de Contrats, la bande de
masses de Facturation, les trois emplacements de Priorités et le bon de commande de Stock n'ont
aucune structure commune. C'est le principe du système.

**Deux libertés prises, et pourquoi** : le bouton « Document dans Médias » de `3d` n'est pas
implémenté (aucun lien document-contrat n'existe dans le moteur ; un bouton qui ne fait rien vaut
moins que pas de bouton), et les barres d'onglets de statut que `4a` place dans l'en-tête de
fenêtre restent dans l'écran (les remonter demanderait que les 87 écrans poussent leurs relevés
vers `BusinessTopBar` — un refactor qui dépasse ce chantier et qu'il vaut mieux décider à froid).

## 5. Ce qui n'a pas été fait

- **20 des 24 écrans de module maquettés** gardent leur composition : `3a` Clients, `3b` Projets,
  `3c` Notes, `3e` Commandes, `4b` Devis, `4c` Dépenses, `4d` Abonnements, `5a` Agenda,
  `5b` Réunions, `5d` Routines, `6a` Temps, `6c` Tournées, `6d` Contrôles, `6e` Matériel,
  `7a` Pages, `7b` Rapports, `7c` Médias, `7d` Automatisations, `7e` Avant la paie. Ils ont la
  peau, la barre, l'en-tête, les états vides et les formulaires du système ; il leur manque leur
  objet dominant.
- **Les réglages (`9a`–`9c`)** : les composants qu'ils demandent existent (formulaires, messages
  système), la recomposition des écrans ne l'est pas.
- **Le mobile** : le paquet est dessiné en 1180 px et ne le traite pas. Les écrans composés ici
  restent responsives (grilles qui retombent en une colonne, cibles de 44 px), mais aucune
  composition téléphone n'a été dessinée ni vérifiée.
- **Les sept modules de `Collectif`** signalés au §6 du paquet : aucune maquette, aucune
  composition inventée — c'était la règle.

## 6. Le garde-fou qui tient la règle

`npm run check:signal <bundle>` ouvre 25 écrans dans un vrai navigateur et compte les objets
ambre **rendus** dans le contenu (la barre latérale est de la coquille : son marqueur accompagne
les 68 modules). Un `grep` ne peut pas répondre — l'ambre dépend des données.

État : **25 écrans mesurés, aucun au-dessus d'un objet.**

Un signal peut s'écrire à deux endroits et rester un signal : sur Facturation, le montant en retard
et son segment de barre disent la même chose. `data-signal-groupe="retard"` rend cette parenté
explicite dans le code, et le contrôle la compte pour un. Deux groupes différents restent deux
fautes.

## 7. Les deux éditions

- **AMN Business** — `npm run build:web:business` passe, `check:business` est vert (aucune trace
  d'AMN DevSec dans le bundle livré). Captures : `bloc1/`, `bloc2/`, `editions/business-stock.png`.
- **AMN Desktop (interne)** — `npm run build:web` passe. Captures :
  `editions/interne-accueil.png`, `editions/interne-taches.png`. La barre latérale interne reçoit
  les jetons, le marqueur ambre et la largeur ; sa composition propre (sélecteur d'espaces,
  lanceur, épingles) n'est pas touchée — le paquet ne l'a pas dessinée, et l'inventer aurait été
  du hors-sujet.

Rien n'est conditionné à une édition sans raison : les six fondations vivent dans des fichiers
partagés, et les deux barres latérales sont séparées pour une raison technique qui préexiste
(la barre interne importe le parc, et l'importer côté Business ramènerait tout le parc dans le
bundle d'une cliente).

## 8. Ce qui n'a pas bougé, et c'est vérifié

- **Fusion par champ en édition concurrente** : `amn-api` 477/477, dont les 11 tests de
  `fusion.test.js`. Le poste envoie toujours `base` et `patch` (`SyncContext.tsx:660`).
- **Notification des messages privés** : le contrôle sur `m.to === user.email` est intact
  (`NotificationsManager.tsx:196`).
- **Neuf garde-fous existants** verts : `check:ecrans`, `check:modules`, `check:sync`,
  `check:roles`, `check:naming`, `check:persistence`, `check:business`, `check:langue`,
  `check:envoi`. `tsc` propre sur les deux éditions, `eslint` sans erreur.

`check:ecrans` a d'ailleurs refusé la première version : il épinglait la taille de titre d'avant.
La règle qu'il tient — une seule source, jamais recopiée écran par écran — n'a pas changé ; seul
son motif suit la nouvelle valeur.

## 9. Ce qu'Harun doit faire

1. **Relire les quatre écrans composés** dans l'application, à côté de leur maquette
   (`docs/captures/design-2026-09-11/bloc2/`). Ce sont eux qui disent si la direction tient en vrai.
2. **Dire si l'écart sur la sourdine convient** (§2). C'est le seul endroit où je n'ai pas suivi un
   chiffre du paquet, et la raison est mesurée.
3. **Décider de la suite** : les 20 écrans restants, dans l'ordre des familles du paquet, ou
   d'abord les réglages. Le système est posé — ce qui reste est de la composition, pas de la
   fondation.
4. **Reconstruire et tester avec Mohamed** : `npm run make`, puis ouvrir les quatre écrans à deux
   (un contrat qui arrive à échéance, une facture en retard, les priorités du jour, un article sous
   son seuil) pour vérifier que ce qui est dominant à l'écran est bien ce qui compte dans la
   journée.
5. **Le bac à sable est jetable** : la base sqlite, le compte `design@exemple.test` et les
   enregistrements fictifs (Studio Nord, Maison Bertaux…) vivent dans le dossier temporaire de la
   session. Aucune donnée réelle n'a été touchée — `seed-essai.mjs` refuse tout compte qui n'est
   pas `@exemple.test`.
