# Paiement en plusieurs fois (`echeancier`)

**Famille** argent · **Action** facturer · **Niveau** courant · **Route proposée** `/echeancier`

## Le besoin

Un artisan ou un commerce accepte qu'une grosse facture (une cuisine, un
dressing) soit payée en plusieurs mois. Il fait le calcul à la main, les
centimes ne tombent pas juste, et il oublie de voir qu'une échéance est passée
sans paiement. Le catalogue a `deposits` (un acompte en ligne) et
`subscriptions` (un abonnement sans fin), rien pour étaler une facture donnée.

## Ce que fait le module

- Une liste d'échéanciers (client, référence de facture, objet) avec ce qui reste dû et un état.
- Pour l'échéancier choisi : montant TTC, acompte déjà versé, nombre
  d'échéances (2 à 12), date de la première ; le tableau des échéances avec
  leur date, leur montant et leur état ; marquer payée ou annuler.
- En tête : reste dû tous échéanciers, montant en retard, encaissé.
- Sur l'échéancier : **reste dû** (la réponse), encaissé sur le total, prochaine échéance.
- Un bouton : copier l'échéancier pour le client.

## Règles

- Reste à étaler = TTC − acompte. Les échéances 2 à N valent reste ÷ N
  arrondi au centime inférieur ; **la première absorbe les centimes restants**
  (au plus N − 1 centimes de plus). Choix : le client lit « puis N − 1
  échéances de X € », et l'écart est encaissé d'emblée. La somme tombe juste.
- Dates : même jour du mois que la première, recalculé depuis la première ; un
  jour absent devient le dernier du mois (31 août → 30 septembre → 31 octobre).
- État : payée si cochée ; en retard dès le lendemain de la date ; à venir sinon
  (aujourd'hui du bac à sable : 22 octobre 2026).
- Encaissé = acompte + échéances payées ; encaissé + reste dû = TTC.
- Réduire le nombre d'échéances oublie les rangs « payés » qui n'existent plus.
- Refus : montant ≤ 0, acompte négatif ou ≥ montant, nombre hors 2–12 ou non
  entier, date impossible, reste plus petit que le nombre d'échéances.

## Hors périmètre

Frais ou intérêts (un paiement en plusieurs fois avec frais peut relever du
crédit à la consommation : à ne pas ajouter sans avis juridique), prélèvement
automatique, relance (voir `reminders`), périodicités autres que mensuelle.
