# Clients & revenus — captures du rendu réel

Bac à sable `design@exemple.test`, base sqlite locale, données semées par
`scripts/seed-essai.mjs`. Largeur 1180 px, la largeur des maquettes.

Chaque ligne dit ce que la capture **prouve** — pas ce qu'elle montre. Une
capture qui ne prouve rien n'a pas sa place ici.

| Capture | Module | Ce qu'elle prouve |
| --- | --- | --- |
| `fidelite.png` | Fidélité `23b` | Neuf tampons apposés, tous de travers, et la dixième case en ambre. Les angles sont mesurés par sonde navigateur, pas jugés à l'œil : `rotate(5.6deg) · −6.03 · −2.66 · −6.05 · 1.64 · −3.19 · 2.26 · 0.95 · 4.4`, dixième `−6.67`, **tampons parfaitement droits : 0**. |
| `avis.png` | Avis `23a` | L'aiguille du peson à `((5 − moyenne) / 4) × 100 %` de la course, le ressort étiré avec elle, et la nervosité chiffrée (combien d'avis sans une étoile, combien de cinq). |
| `parrainage.png` | Parrainage `23c` | Deux générations, et le CA de branche = somme de la descendance, jamais les factures du parrain lui-même. |
| `facturation.png` | Facturation `11a` | Le demi-cercle de 340 px, trois arcs proportionnels sur un seul chemin, total émis gravé au centre à 42 px. L'en-tête et la dominante disent **le même** « en attente » : 3 439,20 € des deux côtés (c'était 10 199 vs 3 439 avant correction). |
| `facturation-entier.png` | Facturation `11a` | L'écran entier : douze mois émis avec le prévisionnel du mois courant en filet pointillé, les brouillons non émis avec leur montant en jeu, et le registre — dont les lignes en retard restent **en encre claire**, l'ambre étant le sujet de la carte du haut. |
| `devis.png` · `devis-entier.png` | Devis `13a` | Le fil d'Ariane dit « Facturation · Devis », la barre latérale garde Facturation en actif, aucune entrée « Devis » n'y est ajoutée. Cinq réglettes sur un axe commun de trente jours ; sonde navigateur : parts `100 / 40 / 30 / 20 / 10 %` pour 34 / 12 / 9 / 6 / 3 jours, et le cran de relance au **même pixel** (`584.3`) sur les cinq lignes — la légende partage bien la grille des réglettes. |

## Les mesures de la sonde

`check:signal` sur le bundle complet : **53 écrans, aucun n'a plus d'un objet
ambre**, les écrans vides n'en portent aucun et n'affichent aucun relevé à
zéro. `check:contraste` : 68 écrans, 8 559 textes, aucun sous WCAG AA.

Le demi-cercle : les trois `stroke-dasharray` somment 486,9469 px pour un
chemin de π × 155 = 486,9469 px — le dernier arc prend le reste exact plutôt
que sa propre part arrondie. (`getTotalLength()` du navigateur renvoie
486,9082 : c'est sa polyligne d'approximation, soit 0,008 % de moins, pas un
jour entre deux masses.)
