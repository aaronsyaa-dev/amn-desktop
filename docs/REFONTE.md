# La refonte visuelle

> « J'ai regardé l'app aujourd'hui : rien n'a changé. »

Ce document dit ce que la refonte change, pourquoi chaque choix a été fait, et
comment vérifier soi-même qu'elle est là.

---

## Les trois principes

1. **La profondeur se lit.** Un panneau est un objet posé sur un plan : bord
   net, arête haute éclairée, ombre portée courte. Pas de dégradé décoratif,
   pas de lueur colorée. Le fond est descendu à `#060707` et les surfaces sont
   remontées : l'écart de luminance entre le vide et ce qui est posé dessus
   passe de 9 à 14 points. C'est ce qui fait qu'un panneau se lit comme un
   objet et non comme une zone légèrement plus claire du même plan.

2. **Le fond est un plan technique.** Une trame de 44 px à 2,2 % de blanc et une
   atténuation radiale. Elle donne l'échelle et la rigueur d'un instrument, et
   elle ne doit **jamais** se remarquer consciemment : si on la voit, elle est
   trop forte.

3. **Une animation qui n'explique rien n'existe pas.** Chaque mouvement déclaré
   répond à une question précise, et porte en commentaire ce qu'il communique :

   | Mouvement          | Ce qu'il dit                          | Où                        |
   | ------------------ | ------------------------------------- | ------------------------- |
   | `.live-dot`        | « ce flux est vivant »                | lien temps réel, ronde à l'heure |
   | `.just-changed`    | « cette ligne-ci vient de changer »   | listes qui se mettent à jour seules |
   | dépliement (0,22 s)| « ce contenu appartient à cette ligne »| banderoles d'organisation |
   | le voile de bascule| « on change d'organisation »          | changement de contexte    |

   Le point **ne bat que quand quelque chose est réellement en cours**. Hors
   ligne il reste fixe : un point qui continuerait de battre dirait « ça vit »
   au moment précis où rien ne vit, ce qui est le seul mensonge qu'une animation
   peut commettre.

---

## Ce qui se voit sur tous les écrans

- **`ScreenHeader`** — étiquette technique, titre, relevés chiffrés, filet. Les
  relevés se calculent sur les données affichées à chaque rendu ; un en-tête
  sans relevé est permis, un en-tête avec un relevé faux ne l'est pas.
- **`StatusRail`** — la bande fine en bas de toutes les coquilles :
  organisation active, contexte, lien temps réel, horloge. C'est la pièce qui
  fait reconnaître l'application avant d'avoir rien lu ; un poste de
  commandement a toujours cette ligne, un site web n'en a jamais.
- **La navigation regroupée** — « Travail » comptait seize entrées côté interne,
  « Activité » douze côté Business. Cinq groupes qui suivent les questions qu'on
  se pose : Pilotage, Clients & revenus, Production, Collectif (Documents en
  Business), Système. Aucun chemin n'a bougé.

## La parité, et pourquoi elle est structurelle

`StatusRail`, `ScreenHeader` et le regroupement sont **les mêmes pièces** dans
les deux éditions. La cliente ne reçoit pas une version dégradée du soin : ce
qui diffère est la liste des modules, pas la qualité du rangement.

Ce n'est pas une promesse relue à la main :

- `npm run check:modules` tient l'accord des catalogues (serveur, édition
  Business, routes, barre du contexte de support) ;
- `npm run check:business` relit le bundle livré et refuse le moindre marqueur
  interne (21 motifs interdits, 3 marqueurs attendus) ;
- `npm run check:accent` vérifie que chaque couleur proposée reste lisible sur
  le nouveau fond.

---

## Les deux espaces (Tour de contrôle)

Le Poste de travail lit des **textes**, la Tour de contrôle lit des **tableaux**.
Leur donner la même peau était le défaut signalé — « rien ne le distingue d'un
autre rayon ».

| | Poste de travail | Tour de contrôle |
| --- | --- | --- |
| Texture | trame carrée (une feuille) | rayage horizontal (un balayage) |
| Fond | `#060707` | `#030404`, un cran plus sombre |
| Arête haute | aucune | **allumée** — seul élément « allumé » de l'app |
| Largeur | colonne de lecture confortable | pleine largeur |
| Densité | par défaut | `13 px`, interlignes resserrés |
| Barre latérale | cinq épingles | trois sections nommées |

Décidé dans la coquille (`AppLayout`), jamais écran par écran : la densité et la
texture sont des propriétés du **lieu**, et il aurait suffi d'oublier un écran
pour qu'il ait l'air d'appartenir à l'autre espace.

Ce qui **ne** change pas : palette, fontes, matière des panneaux, vocabulaire
des mouvements. On change de pièce, pas de bâtiment.

---

## Vérifier soi-même

```bash
npm run typecheck && npm run typecheck:business
npm run build:web && npm run build:web:business && npm run check:business
npm run check:modules && npm run check:accent && npm run check:sync
```

À l'écran, dans les **deux** éditions : la bande d'état en bas de chaque écran,
les groupes dans la barre latérale et le lanceur, et — côté interne seulement —
le changement de plan de travail en entrant dans `/tour`.
