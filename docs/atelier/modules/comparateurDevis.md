# Comparateur de devis fournisseurs (`comparateurDevis`)

**Famille** argent · **Action** dépenser · **Niveau** courant · **Route proposée** `/comparer-des-devis`

## Le besoin

Une PME qui refait une toiture, change de logiciel ou choisit un sous-traitant
reçoit plusieurs devis qui ne se comparent pas d'un coup d'œil : le moins cher
a souvent le délai le plus court mais la garantie la plus faible, ou un acompte
élevé. Le catalogue a un annuaire de fournisseurs (`suppliers`), rien pour
départager des offres.

## Ce que fait le module

- Le besoin, 2 à 5 devis : fournisseur, prix HT, délai (jours), garantie
  (mois), qualité perçue (1 à 5), acompte demandé (%), modifiables sur place.
- Cinq poids libres (prix 40, délai 20, garantie 15, qualité 15, acompte 10 par défaut).
- Sortie : classement avec la note sur 100, la note par critère, l'écart au
  moins cher, et un signal **offre anormalement basse**.
- Un bouton : copier la comparaison.

## Règles

- Notes relatives : prix mini / prix ; (délai mini + 1) / (délai + 1) ;
  garantie / garantie maxi (toutes nulles : 100) ; qualité × 20 ; 100 − acompte.
- Note finale = moyenne pondérée, au dixième. Égalité : le moins cher, puis l'alphabet.
- Offre anormalement basse : plus de 30 % sous la moyenne des **autres** offres.
  C'est un signal à vérifier (poste oublié, besoin mal compris), pas un rejet.
- Saisies refusées : moins de 2 ou plus de 5 devis, tous les poids à zéro,
  prix nul, qualité hors de 1 à 5, acompte hors de 0 à 100.

## Hors périmètre

Marchés publics (critères et pondérations réglementés), lecture automatique
des devis PDF, critères personnalisés au-delà des cinq.
