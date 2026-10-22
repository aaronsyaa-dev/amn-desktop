# Pénalités de retard (`penalites`)

**Famille** argent · **Action** facturer · **Niveau** courant · **Route proposée** `/penalites-de-retard`

## Le besoin

Entre professionnels, une facture payée en retard ouvre droit, sans rappel
préalable, à des intérêts de retard et à une indemnité forfaitaire de 40 €.
Presque aucune petite entreprise ne les réclame : elle ne sait pas les
calculer, ni sur quel taux. Le catalogue relance (`reminders`) mais ne calcule
rien.

## Ce que fait le module

- On choisit un débiteur (fictif) : ses factures impayées s'affichent.
- Paramètres : date du calcul, taux des conditions générales (facultatif),
  taux BCE et taux légal du semestre ; pour un particulier, la date d'une
  mise en demeure déjà envoyée.
- Sorties : par facture, jours de retard, intérêts, indemnité ; **somme
  réclamable** (la réponse), taux appliqué et d'où il vient.
- Une **mise en demeure** rédigée (fr ou en), prête à copier : le bouton.

## Règles

- **Professionnel** (art. L441-10 du Code de commerce) : intérêts dès le
  lendemain de l'échéance ; taux du contrat, ou à défaut taux de
  refinancement de la BCE + 10 points ; jamais moins de **3 × le taux légal** ;
  plus **40 € par facture** en retard (art. D441-5).
- **Particulier** (art. 1231-6 du Code civil) : taux légal, intérêts à compter
  d'une mise en demeure seulement (ou de l'échéance si la mise en demeure est
  antérieure), pas d'indemnité de 40 €.
- Intérêts = montant TTC × taux × jours / 365, arrondis au centime.
- Une facture pas encore échue reste listée, sans rien compter.
- Le taux BCE et le taux légal sont des **paramètres** : les valeurs du bac à
  sable (2,15 % et 3,15 %) sont des exemples **à vérifier** pour le semestre
  en cours. Seuls l'indemnité de 40 €, la majoration de 10 points et le
  plancher de 3 fois le taux légal sont fixes (textes cités).
- Refusés : date impossible, taux négatifs ou hors bornes, facture à montant
  nul ou à échéance illisible (écartée du calcul).

## Hors périmètre

Paiements partiels, capitalisation des intérêts, frais de recouvrement
au-delà de 40 € sur justificatifs, injonction de payer, envoi du courrier.
La lettre est un modèle, pas un conseil juridique.
