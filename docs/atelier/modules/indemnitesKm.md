# Indemnités kilométriques (`indemnitesKm`)

**Famille** argent · **Action** dépenser · **Niveau** essentiel · **Route proposée** `/indemnites-kilometriques`

## Le besoin

Un indépendant au réel, ou un salarié aux frais réels, qui roule avec sa
voiture personnelle a droit au barème kilométrique fiscal. Il note ses trajets
sur un carnet, puis applique souvent le barème trajet par trajet, ce qui est
faux dès 5 000 km : le barème se lit sur la **distance annuelle**. Le
catalogue a `expenseClaims` (tickets) et `fleet` (suivi d'un véhicule), rien
qui applique le barème.

## Ce que fait le module

- Journal des trajets de l'année : date, motif, départ → arrivée, distance d'un aller, aller-retour.
- Réglages : puissance fiscale (3 CV et moins, 4, 5, 6, 7 et plus), voiture électrique.
- Sorties : **indemnité de l'année** (la réponse) avec sa formule, kilomètres
  professionnels et tranche, part de chaque trajet, total par mois.
- Ajouter ou retirer un trajet ; un bouton : copier le récapitulatif.

## Règles

- Tranches : d ≤ 5 000 km → d × a ; 5 000 < d ≤ 20 000 → d × b + c ; d > 20 000 → d × e.
  Électrique : + 20 %.
- Le barème s'applique au **total** de l'année ; le montant est ensuite réparti
  entre les trajets au prorata des kilomètres, par la méthode des plus forts
  restes : la somme des trajets et celle des mois tombent juste au centime.
- Taux en millièmes d'euro par km, part fixe en centimes : pas de flottant dans le barème.
- Seuls les trajets de l'année affichée et valides comptent (date réelle,
  motif, départ et arrivée, 0 < km ≤ 2 000).
- Le barème officiel n'est pas parfaitement continu aux bornes (6 CV : 3 325 €
  contre 3 327 € à 5 000 km ; 3 CV : 7 385 € contre 7 400 € à 20 000 km). Le
  module l'applique tel quel ; les tests vérifient qu'il ne baisse jamais en
  passant une borne et que l'écart reste sous 1 %.

## Valeurs à vérifier

Barème voitures publié en 2024 (revenus 2023), reconduit sans changement en
2025 (revenus 2024) — source impots.gouv.fr, BOFiP `BOI-BAREME-000001`. Celui
publié en 2026 n'est pas connu de l'atelier : **à vérifier avant intégration**.
L'écran le dit en clair. Le barème est une donnée (`BAREME_2025`) : en ajouter
un nouveau ne touche pas au calcul.

## Hors périmètre

Deux-roues et cyclomoteurs (barèmes distincts), plafonnement à 40 km
domicile-travail des frais réels salariés, calcul d'itinéraire (`itineraries` existe).
