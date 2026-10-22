# Tableau d'amortissement (`amortissements`)

**Famille** argent · **Action** comptabilité · **Niveau** avancé · **Route proposée** `/amortissements`

## Le besoin

Un indépendant ou une petite société au régime réel qui achète une machine,
un véhicule ou un ordinateur doit l'amortir : une dotation par exercice, pas
la dépense entière d'un coup. Sans outil, le tableau est refait chaque année
sur un tableur, le prorata de la première année est faux, et la valeur nette
à la revente est inconnue. Le catalogue a `loanSim` (le tableau d'un prêt),
rien pour une immobilisation.

## Ce que fait le module

- Liste d'immobilisations : désignation, valeur HT, date de mise en service,
  durée en années.
- Choix de l'exercice et du mois de clôture (décembre par défaut).
- Chiffres : **dotations de l'exercice** (la réponse, pour la liasse ou le
  comptable), valeur nette comptable des biens en service, nombre de biens.
- Tableau de l'exercice : dotation et valeur nette par bien ; un bien de
  500 € HT ou moins est signalé « peut passer en charge (à vérifier) ».
- Plan complet d'un bien : exercice, jours, dotation, cumul, valeur nette.
- Un bouton blanc : « Ajouter l'immobilisation ».

## Règles

- **Linéaire**, base amortissable = valeur HT, sans valeur résiduelle.
- **Prorata temporis en jours**, année commerciale de 360 jours, mois de 30
  jours, date de mise en service comprise. Le dernier jour d'un mois, et le
  31, comptent pour 30 : 1er avril → 31 décembre = 270 jours, 15 mars = 286.
  C'est l'usage courant (logiciels comptables, exemples du PCG) ; un calcul en
  jours réels (365) donnerait quelques euros d'écart la première année.
- **Le cumul d'abord** : cumul théorique arrondi au centime, puis dotation =
  différence avec le cumul précédent. La somme des dotations égale la valeur
  au centime, la dernière annuité est exactement le reste (testé sur 432
  combinaisons de valeurs, durées, dates et clôtures).
- Exercices de 12 mois, nommés par leur année de clôture ; clôture le dernier
  jour du mois choisi (29 février compris).
- **Petit matériel** : seuil de 500 € HT en paramètre (`SEUIL_PETIT_MATERIEL`),
  tolérance administrative (BOI-BIC-CHG-20-30-10), relevé le 2026-10-22,
  **à vérifier**. Signalé, jamais décidé à la place de la personne.
- Argent en centimes entiers ; durée de 1 à 50 ans entiers.

## Hors périmètre

Dégressif fiscal et ses coefficients, amortissement par composants, valeur
résiduelle, premier exercice long ou court, cession et plus-value, écritures
comptables, amortissements dérogatoires.
