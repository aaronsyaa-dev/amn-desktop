# Taux horaire de revient (`tauxHoraire`)

**Famille** argent · **Action** prévoir · **Niveau** essentiel · **Route proposée** `/taux-horaire`

## Le besoin

Un artisan ou un indépendant fixe son tarif « au marché », sans savoir s'il
couvre sa rémunération, ses charges et ses cotisations une fois retirés les
congés, les fériés et les heures non facturables (devis, trajets,
administratif). Le catalogue a des calculateurs de prix e-commerce, de panier
et d'événement, mais aucun taux horaire.

## Ce que fait le module

- Entrées : rémunération annuelle visée, charges fixes, base et taux de
  cotisations, marge de sécurité, jours par semaine, semaines de congés,
  fériés chômés, autres jours off, heures par jour, part facturable, tarif
  actuel (facultatif).
- Sorties : **taux horaire minimum HT** (la réponse), prix de journée,
  chiffre d'affaires nécessaire (dont cotisations), heures facturables par an
  et par semaine, et l'écart avec le tarif actuel, par heure et sur l'année.
- Un bouton : copier le calcul.

## Règles

- Jours travaillés = jours/semaine × (52 − semaines de congés) − fériés − autres jours.
- Au réel : CA = revenu × (1 + taux) + charges. En micro : CA = (revenu + charges) / (1 − taux),
  les cotisations portant sur le chiffre d'affaires.
- Marge de sécurité appliquée au CA, puis taux = CA / heures facturables,
  **arrondi au centime supérieur** (un minimum ne s'arrondit pas vers le bas).
- Aucun taux de cotisations en dur : il change et dépend du statut ; l'aide
  renvoie au dernier avis URSSAF.
- Argent en centimes entiers.

## Hors périmètre

Impôt sur le revenu, TVA (tout est HT), saisonnalité.
