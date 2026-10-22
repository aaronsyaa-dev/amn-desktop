# Bons cadeaux (`bonsCadeaux`)

**Famille** argent · **Action** vendre · **Niveau** courant · **Route proposée** `/bons-cadeaux`

## Le besoin

Un salon, un restaurant, une boutique ou un artisan vend des bons prépayés
« pour offrir ». Sans outil, ils vivent sur papier : on ne sait plus combien
reste sur un bon entamé, un bon expiré est accepté par erreur, un code
recopié de travers est introuvable, et personne ne connaît la somme encore
due aux clients. Le catalogue a `loyalty` (carte à tampons) mais rien pour un
bon prépayé.

## Ce que fait le module

- **Émettre** : bénéficiaire, montant, validité en mois (12 par défaut,
  réglable), date d'émission (le jour même). Le bon reçoit un code
  `XXXX-XXXX`.
- **Encaisser** : on tape le code et le montant de l'achat. Le bon est débité
  de ce qu'il peut couvrir ; s'il ne suffit pas, l'écran dit le reste à payer.
  Refus clairs : code mal tapé, code inconnu, bon expiré, bon épuisé, montant
  nul, date antérieure à l'émission.
- **Suivre** : quatre chiffres (encours, encaissé, expirés non utilisés,
  nombre de bons par état) et la liste des bons avec leur solde et leur état.
- Un bouton blanc : « Encaisser » (le geste de tous les jours). Émettre est
  secondaire.

## Règles

- **Code** : 7 signes tirés du numéro du bon par une bijection modulo 32⁷ (deux
  numéros, deux codes ; des numéros voisins ne donnent pas des codes voisins),
  plus une **clé de contrôle Luhn modulo 32**. Alphabet de 32 signes sans 0, O,
  1 ni I. La clé détecte toute faute sur un caractère (testé de façon
  exhaustive) et la plupart des inversions de deux voisins. Aucun hasard : le
  même numéro donne le même code. Saisie tolérante à la casse, aux espaces et
  aux tirets.
- Le code n'est **pas un secret** : il se devine si l'on connaît l'algorithme et
  un numéro. Pour des bons de forte valeur vendus en ligne, il faudra un code
  aléatoire tiré côté serveur (voir « Intégration »).
- **Validité** : du jour d'émission inclus à la veille du même quantième,
  n mois plus tard, inclus ; un 31 janvier + 1 mois vaut jusqu'au dernier jour
  de février. Le dernier jour, le bon est encore accepté.
- **Solde** jamais négatif ; argent en centimes entiers ; garde-fou de saisie à
  10 000 € par bon (pas une règle légale).
- **Encours** = solde des bons actifs, c'est-à-dire des prestations encore dues.
  Émis = encaissé + encours + expirés non utilisés (testé).

## TVA (note, sans calcul)

Un bon utilisable pour des biens ou services à des taux de TVA différents est
un « bon à usages multiples » : la TVA est due **à l'utilisation**, pas à la
vente (directive (UE) 2016/1065 ; référence de transposition dans le CGI à
confirmer). Un bon à usage unique (bien, taux et lieu connus dès la
vente) est taxé dès sa vente. Le traitement comptable et fiscal des bons
expirés non utilisés est à voir avec l'expert-comptable. Le module ne calcule
aucune TVA. À faire vérifier avant intégration.

## Intégration

Collection `bonsCadeaux` isolée par organisation ; numéro d'ordre tenu par le
serveur (unicité) ; code aléatoire serveur si vente en ligne ; impression d'un
bon (PDF, QR du code) à prévoir.

## Hors périmètre

Vente en ligne et paiement, impression, remboursement d'un bon, calcul de TVA,
prolongation d'un bon expiré.
