# Métré et quantitatif (`metre`)

**Famille** outils · **Action** terrain · **Niveau** courant · **Route proposée** `/metre`

## Le besoin

Avant un devis de peinture, de carrelage ou de plaques, l'artisan mesure les
pièces, retire portes et fenêtres, ajoute la chute et convertit en cartons,
litres ou plaques. Il le fait sur un carnet ou un tableur, avec des erreurs
d'arrondi qui coûtent un aller-retour chez le fournisseur. Le catalogue n'a
aucun outil de métré.

## Ce que fait le module

- Entrées : des pièces (nom, longueur, largeur, hauteur sous plafond, en
  mètres) et leurs ouvertures à déduire (largeur, hauteur, nombre) ; pour
  chaque ouvrage coché (sol, murs, plafond), un matériau : libellé, unité de
  vente, rendement par unité et par couche, nombre de couches, chute, prix
  unitaire HT.
- Sorties : surface nette par pièce (sol, murs) ; par ouvrage, la surface
  totale, la **quantité à commander** et son coût ; le coût matériaux total HT
  (la réponse).
- Un bouton : copier le quantitatif.

## Règles

- Longueurs en centimètres entiers, surfaces en cm² entiers : aucune erreur de
  virgule (4,25 × 3,10 = 13,18 m² affichés, 131 750 cm² calculés).
- Sol = plafond = longueur × largeur. Murs = 2 × (longueur + largeur) × hauteur
  − Σ ouvertures (largeur × hauteur × nombre).
- Quantité = surface × couches × (1 + chute) / rendement, sur la surface
  **totale** de l'ouvrage (on commande pour le chantier), arrondie à l'unité
  **supérieure**. Calcul en entiers jusqu'à la division.
- Refusé : dimension nulle ou illisible, ouverture plus large que le plus long
  mur ou plus haute que la pièce, ouvertures qui couvrent tous les murs,
  rendement hors 0,01–1 000 m², couches hors 1–10, chute hors 0–100 %, prix négatif.

## Hors périmètre

Pièces non rectangulaires (à découper en rectangles), rampants, plinthes et
linéaires, conditionnements multiples (pot de 10 L vs 2,5 L), main-d'œuvre.
