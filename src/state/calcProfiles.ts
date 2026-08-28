import type { CalcProfile } from './calcEngine';

/**
 * Les calculateurs métier — de la CONFIGURATION, pas du code.
 *
 * Rien dans ce fichier n'est exécutable : ce sont des données que
 * `calcEngine.ts` déroule. C'est le test de la généricité annoncée au BLOC A —
 * ajouter un métier ici n'oblige à toucher ni le moteur, ni l'écran, et
 * `npm run check:calc` valide automatiquement tout ce qui est déclaré.
 *
 * ## Comment déclarer un nouveau calculateur
 *
 *   1. Lister les ENTRÉES : ce que l'utilisateur saisit. `money` est en
 *      centimes, `percent` en points (20 pour 20 %), `number` brut.
 *   2. Lister les ÉTAPES, dans l'ordre. Une étape ne peut nommer que les
 *      entrées et les étapes qui la PRÉCÈDENT — les cycles sont donc
 *      impossibles à écrire.
 *   3. Marquer `output: true` sur ce qui est un résultat, pas un intermédiaire.
 *   4. Ajouter le profil à `CALC_PROFILES`. C'est tout.
 *
 * Opérateurs disponibles : `+ - * /`, parenthèses, et `min()`, `max()`,
 * `abs()`, `round()`. Délibérément court : une calculatrice métier qui
 * réclamerait davantage réclame en réalité du code, pas une formule.
 */

/* ============================ E-COMMERCE (BLOC B) ========================== */

/**
 * Prix client — le cas AllStore.
 *
 * ## Le raisonnement, parce qu'il n'est pas évident
 *
 * On part d'un coût fournisseur et on veut un prix client tel qu'il reste, une
 * fois TOUT payé, la marge visée. L'ordre des soustractions compte :
 *
 *   - Les frais de transaction (Stripe) se prennent sur le prix ENCAISSÉ, pas
 *     sur le coût. On ne peut donc pas les retrancher avant de connaître le
 *     prix — d'où la division par `1 - taux`, qui est la façon correcte de
 *     « remonter » un prix TTC à partir d'un net voulu.
 *   - Les charges (URSSAF) portent sur la MARGE, pas sur le chiffre d'affaires
 *     ni sur le coût d'achat : on ne cotise pas sur ce qu'on a payé au
 *     fournisseur.
 *
 * Se tromper d'ordre ici donne un prix crédible et faux de plusieurs euros par
 * article — l'erreur ne se voit qu'à la fin du mois, sur le bénéfice réel.
 */
const ECOMMERCE_PRICE: CalcProfile = {
  id: 'ecommerce-prix-client',
  label: 'Prix client',
  description:
    'À partir d’un coût fournisseur, le prix à afficher pour qu’il reste la marge visée une fois les charges et les frais de paiement payés.',
  inputs: [
    {
      key: 'coutFournisseur',
      label: 'Coût fournisseur',
      kind: 'money',
      defaultValue: 4500,
      help: 'Ce que l’article vous coûte, à l’unité, livraison entrante comprise.',
    },
    {
      key: 'fraisLivraison',
      label: 'Livraison sortante',
      kind: 'money',
      defaultValue: 0,
      help: 'Ce que VOUS payez pour l’expédier. Zéro si le client la paie à part.',
    },
    {
      key: 'margeVisee',
      label: 'Marge visée (nette)',
      kind: 'money',
      defaultValue: 2000,
      help: 'Ce qu’il doit rester à répartir, une fois tout payé.',
    },
    {
      key: 'tauxCharges',
      label: 'Charges (URSSAF)',
      kind: 'percent',
      defaultValue: 22,
      help: 'Appliqué à la marge, pas au chiffre d’affaires.',
    },
    {
      key: 'tauxTransaction',
      label: 'Frais de paiement (Stripe)',
      kind: 'percent',
      defaultValue: 1.5,
      help: 'Part variable, prélevée sur le montant encaissé.',
    },
    {
      key: 'fixeTransaction',
      label: 'Frais fixes par transaction',
      kind: 'money',
      defaultValue: 25,
      help: 'La part fixe de Stripe, par paiement.',
    },
    {
      key: 'associes',
      label: 'Nombre d’associés',
      kind: 'number',
      defaultValue: 3,
    },
    /*
      LA FOURCHETTE — deux marges de plus, et rien d'autre.

      Un prix unique ne se négocie pas. Une gérante à qui l'on demande un geste
      sur dix pièces veut savoir jusqu'où elle peut descendre SANS calculer, et
      un client qui accepte tout de suite lui apprend qu'elle était trop bas.

      Ces deux entrées encadrent `margeVisee` ; elles ne la remplacent pas. Le
      prix suggéré reste celui de la marge visée, et la fourchette dit ce qu'on
      peut faire autour.
    */
    {
      key: 'margeBasse',
      label: 'Marge minimale acceptable',
      kind: 'money',
      defaultValue: 1000,
      help: 'La marge en dessous de laquelle la vente ne vaut plus la peine — pas celle où l’on perd de l’argent, qui est le prix plancher.',
    },
    {
      key: 'margeHaute',
      label: 'Marge confortable',
      kind: 'money',
      defaultValue: 3000,
      help: 'Ce qu’on demande quand rien n’oblige à négocier.',
    },
  ],
  steps: [
    {
      key: 'margeBrute',
      label: 'Marge avant charges',
      kind: 'money',
      formula: 'margeVisee / (1 - tauxCharges / 100)',
      help: 'Il faut dégager plus que la marge visée, puisque les charges s’y appliquent.',
    },
    {
      key: 'charges',
      label: 'Charges sociales',
      kind: 'money',
      formula: 'margeBrute - margeVisee',
      output: true,
    },
    {
      key: 'aEncaisser',
      label: 'Net à encaisser',
      kind: 'money',
      formula: 'coutFournisseur + fraisLivraison + margeBrute',
      help: 'Coûts + marge avant charges : ce qui doit rester après les frais de paiement.',
    },
    {
      key: 'prixClient',
      label: 'Prix client suggéré',
      kind: 'money',
      // Le prix DOIT être trouvé en remontant : les frais de Stripe se
      // calculent sur lui, donc on ne peut pas les ajouter au net.
      formula: '(aEncaisser + fixeTransaction) / (1 - tauxTransaction / 100)',
      output: true,
      headline: true,
      help: 'Prix affiché. Les frais de paiement portent sur ce montant, d’où la division.',
    },
    {
      key: 'fraisPaiement',
      label: 'Frais de paiement',
      kind: 'money',
      formula: 'prixClient - aEncaisser',
      output: true,
    },
    {
      key: 'partAssocie',
      label: 'Part par associé (équitable)',
      kind: 'money',
      formula: 'margeVisee / max(associes, 1)',
      output: true,
      help: 'Division simple. La répartition pondérée par le temps se règle dans la vue mensuelle.',
    },

    /*
      LE PRIX PLANCHER — le seul chiffre de cet écran qui soit une LIMITE.

      C'est le prix auquel la vente ne rapporte rien : coûts couverts, frais de
      paiement couverts, marge nulle. En dessous, chaque article vendu coûte de
      l'argent.

      Il ne demande aucune entrée nouvelle — c'est la même chaîne que le prix
      client avec une marge de zéro, d'où l'absence de terme de marge. Les
      charges n'y figurent pas non plus, et c'est juste : elles s'appliquent à
      la marge, et il n'y en a pas.

      Il vaut d'être affiché même quand personne ne négocie : une remise de 30 %
      consentie au téléphone se compare à ce chiffre, pas au prix affiché.
    */
    {
      key: 'prixPlancher',
      label: 'Prix plancher (marge nulle)',
      kind: 'money',
      formula: '(coutFournisseur + fraisLivraison + fixeTransaction) / (1 - tauxTransaction / 100)',
      output: true,
      help: 'En dessous, la vente vous coûte de l’argent. Les charges n’y sont pas : elles portent sur une marge qui est nulle ici.',
    },

    /*
      LES DEUX BORNES, calculées par la MÊME chaîne que le prix suggéré.

      Écrites en entier plutôt que dérivées du prix visé : le moteur n'a pas de
      fonctions, et une règle de trois sur `prixClient` serait fausse — les
      frais fixes par transaction ne sont pas proportionnels à la marge.

      La répétition est donc voulue, et c'est le contrôle qui la tient : les
      trois formules doivent rendre le même résultat que `prixClient` quand on
      leur donne `margeVisee` (voir check-calc).
    */
    {
      key: 'prixBas',
      label: 'Prix bas de fourchette',
      kind: 'money',
      formula:
        '(coutFournisseur + fraisLivraison + margeBasse / (1 - tauxCharges / 100) + fixeTransaction) / (1 - tauxTransaction / 100)',
      output: true,
      help: 'Le plus bas qu’on puisse consentir en gardant la marge minimale.',
    },
    {
      key: 'prixHaut',
      label: 'Prix haut de fourchette',
      kind: 'money',
      formula:
        '(coutFournisseur + fraisLivraison + margeHaute / (1 - tauxCharges / 100) + fixeTransaction) / (1 - tauxTransaction / 100)',
      output: true,
      help: 'Ce qu’on demande quand rien n’oblige à négocier.',
    },
  ],
};

/**
 * Le panier fournisseur — plusieurs références, chacune avec SA charge.
 *
 * ## Ce qu'il répond
 *
 * « Prix client » traite UN article. Une commande de six références obligeait à
 * l'ouvrir six fois et à additionner à la main — c'est-à-dire à refaire dehors
 * ce que l'outil est censé faire dedans, avec le risque d'erreur que ça suppose
 * et sans trace de ce qui a été additionné.
 *
 * ## Deux choses que le calcul ligne à ligne ne peut PAS faire
 *
 * Elles justifient à elles seules ce profil, parce qu'elles ne se rattrapent
 * pas en additionnant des résultats séparés.
 *
 *   - **Les frais fixes de paiement se prennent UNE FOIS.** Le client paie une
 *     fois, quel que soit le nombre d'articles. Calculer six articles
 *     séparément ajoute six fois la part fixe : le panier ressort trop cher, et
 *     d'autant plus qu'il a de lignes. C'est pour cela que la part fixe est une
 *     entrée GLOBALE et n'apparaît dans aucune formule de ligne.
 *   - **Chaque ligne a sa propre charge.** Un produit revendu et une prestation
 *     ne cotisent pas au même taux. Un taux unique appliqué au total est faux
 *     dès que le panier mélange les deux, et l'écart grandit avec le montant.
 *
 * ## Le chemin de l'argent, dans l'ordre
 *
 * Le client paie le prix du panier. La plateforme prélève sa part variable et
 * sa part fixe. Ce qui reste paie la livraison, puis le fournisseur de chaque
 * ligne, puis les charges de chaque ligne à SON taux. Ce qui reste alors est la
 * marge nette — et elle doit valoir exactement la somme des marges visées ligne
 * par ligne. C'est cette égalité que `check:calc` refait comme la banque.
 */
const ECOMMERCE_BASKET: CalcProfile = {
  id: 'ecommerce-panier',
  label: 'Panier fournisseur',
  description:
    'Une commande à plusieurs références, chacune avec son coût et sa charge : le prix à demander pour l’ensemble, et ce qu’il vous reste.',
  inputs: [
    {
      key: 'fraisLivraison',
      label: 'Livraison de la commande',
      kind: 'money',
      defaultValue: 0,
      help: 'Ce que VOUS payez pour expédier l’ensemble — une fois, pas par article.',
    },
    {
      key: 'tauxTransaction',
      label: 'Frais de paiement (Stripe)',
      kind: 'percent',
      defaultValue: 1.5,
      help: 'Part variable, prélevée sur le montant encaissé.',
    },
    {
      key: 'fixeTransaction',
      label: 'Frais fixes par paiement',
      kind: 'money',
      defaultValue: 25,
      help: 'Prélevés UNE FOIS sur la commande, quel que soit le nombre d’articles.',
    },
  ],
  rows: {
    label: 'Les lignes de la commande',
    addLabel: 'Ajouter une ligne',
    nameLabel: 'Référence',
    help: 'Une ligne par référence. Le taux de charges est propre à chacune : un produit revendu et une prestation ne cotisent pas pareil.',
    defaultRows: 2,
    inputs: [
      {
        key: 'coutUnitaire',
        label: 'Coût unitaire',
        kind: 'money',
        defaultValue: 4500,
        help: 'Ce que l’article vous coûte à l’unité.',
      },
      // La seule colonne SAISIE dont la somme veut dire quelque chose : deux
      // articles plus trois en font bien cinq. Les montants unitaires
      // au-dessus et en dessous, eux, ne se totalisent pas — 45 € et 45 € ne
      // font pas 90 €, ils font deux articles à 45 €.
      { key: 'quantite', label: 'Quantité', kind: 'number', defaultValue: 1, sum: true },
      {
        key: 'margeUnitaire',
        label: 'Marge visée / unité',
        kind: 'money',
        defaultValue: 2000,
        help: 'Ce qu’il doit rester par article, une fois tout payé.',
      },
      {
        key: 'tauxChargesLigne',
        // Pas « Charges de la ligne » : l'étape calculée porte déjà ce
        // libellé, et deux colonnes du même nom — l'une en %, l'autre en
        // euros — se lisent comme une erreur d'affichage.
        label: 'Taux de charges',
        kind: 'percent',
        defaultValue: 22,
        help: 'Le taux propre à cette ligne. Appliqué à sa marge, pas à son chiffre d’affaires.',
      },
    ],
    /*
      ON MULTIPLIE PAR LA QUANTITÉ D'ABORD, ON DIVISE ENSUITE.

      Chaque étape « money » est arrondie au centime, comme une ligne de
      facture. Une première version calculait la marge brute PAR UNITÉ puis la
      multipliait par la quantité : l'arrondi de l'unité se trouvait donc
      multiplié par la quantité lui aussi. Sur une marge de 3 € à 22 % de
      charges, l'unité arrondit de 0,385 centime — invisible ; à mille
      exemplaires, le panier était faux de 3,85 €.

      Toutes les étapes ci-dessous travaillent donc au niveau de la LIGNE :
      l'arrondi reste d'un centime par ligne, quelle que soit la quantité.
      C'est aussi ce que fait déjà `lineAmounts` en facturation.
    */
    steps: [
      {
        key: 'coutLigne',
        label: 'Coût de la ligne',
        kind: 'money',
        formula: 'coutUnitaire * quantite',
        output: true,
      },
      {
        key: 'margeLigne',
        label: 'Marge nette de la ligne',
        kind: 'money',
        formula: 'margeUnitaire * quantite',
        output: true,
      },
      {
        key: 'margeBruteLigne',
        label: 'Marge avant charges',
        kind: 'money',
        formula: 'margeLigne / (1 - tauxChargesLigne / 100)',
      },
      {
        key: 'chargesLigne',
        label: 'Charges de la ligne',
        kind: 'money',
        formula: 'margeBruteLigne - margeLigne',
        output: true,
      },
      {
        key: 'netLigne',
        label: 'À encaisser pour la ligne',
        kind: 'money',
        // Les frais de paiement N'ENTRENT PAS ici : ils portent sur le panier
        // entier, une seule fois. Les faire descendre dans la ligne est
        // précisément l'erreur que ce profil existe pour éviter.
        formula: 'coutLigne + margeBruteLigne',
        output: true,
      },
    ],
  },
  steps: [
    {
      key: 'netPanier',
      label: 'Net à encaisser',
      kind: 'money',
      formula: 'total_netLigne + fraisLivraison',
      help: 'La somme des lignes, plus la livraison : ce qui doit rester après les frais de paiement.',
    },
    {
      key: 'prixPanier',
      label: 'Prix du panier',
      kind: 'money',
      // Comme pour un article seul, le prix se trouve en REMONTANT : les frais
      // se calculent sur lui, donc on ne peut pas les ajouter au net.
      formula: '(netPanier + fixeTransaction) / (1 - tauxTransaction / 100)',
      output: true,
      headline: true,
      help: 'Le prix à demander pour l’ensemble de la commande.',
    },
    {
      key: 'fraisPaiement',
      label: 'Frais de paiement',
      kind: 'money',
      formula: 'prixPanier - netPanier',
      output: true,
      help: 'Part variable et part fixe réunies, prélevées une seule fois.',
    },
    {
      key: 'margePanier',
      label: 'Marge nette du panier',
      kind: 'money',
      formula: 'total_margeLigne',
      output: true,
      help: 'La somme des marges visées, une fois les charges de chaque ligne payées.',
    },
    {
      key: 'chargesPanier',
      label: 'Charges sociales',
      kind: 'money',
      formula: 'total_chargesLigne',
      output: true,
    },
    {
      key: 'prixMoyenArticle',
      label: 'Prix moyen par article',
      kind: 'money',
      formula: 'prixPanier / max(total_quantite, 1)',
      output: true,
      help: 'Pour se situer, pas pour vendre à l’unité : la part fixe y est diluée.',
    },
  ],
};

/* ============================ ÉVÉNEMENTIEL (BLOC C) ======================== */

/**
 * Seuil de rentabilité d'un événement.
 *
 * Le chiffre qui compte n'est pas le prix du billet : c'est le NOMBRE d'entrées
 * à partir duquel l'événement cesse de coûter de l'argent. C'est lui qu'on
 * regarde trois semaines avant, quand il est encore temps d'agir.
 */
const EVENT_BREAKEVEN: CalcProfile = {
  id: 'evenementiel-rentabilite',
  label: 'Rentabilité d’un événement',
  description:
    'Combien d’entrées vendues avant que l’événement ne coûte plus d’argent, et ce que rapporte la salle pleine.',
  inputs: [
    { key: 'coutLieu', label: 'Location du lieu', kind: 'money', defaultValue: 120000 },
    {
      key: 'coutPrestataires',
      label: 'Prestataires',
      kind: 'money',
      defaultValue: 80000,
      help: 'Son, lumière, sécurité, traiteur — le total, pas l’unité.',
    },
    { key: 'coutCommunication', label: 'Communication', kind: 'money', defaultValue: 30000 },
    {
      key: 'coutParEntree',
      label: 'Coût par entrée',
      kind: 'money',
      defaultValue: 150,
      help: 'Ce que chaque personne coûte en plus : bracelet, boisson d’accueil…',
    },
    { key: 'prixBillet', label: 'Prix du billet', kind: 'money', defaultValue: 2500 },
    {
      key: 'commissionBilletterie',
      label: 'Commission billetterie',
      kind: 'percent',
      defaultValue: 5,
    },
    { key: 'capacite', label: 'Capacité de la salle', kind: 'number', defaultValue: 200 },
  ],
  steps: [
    {
      key: 'coutsFixes',
      label: 'Coûts fixes',
      kind: 'money',
      formula: 'coutLieu + coutPrestataires + coutCommunication',
      output: true,
    },
    {
      key: 'recetteNetteBillet',
      label: 'Recette nette par billet',
      kind: 'money',
      formula: 'prixBillet - prixBillet * commissionBilletterie / 100 - coutParEntree',
      output: true,
      help: 'Ce que rapporte réellement une entrée, commission et coût variable déduits.',
    },
    {
      key: 'seuilEntrees',
      label: 'Entrées pour l’équilibre',
      kind: 'number',
      // `max(…, 1)` : une recette nette nulle ou négative rendrait le seuil
      // infini. On préfère un nombre absurdement grand mais fini, que l'écran
      // affiche à côté de la recette négative qui l'explique.
      //
      // `ceil` et non `round` : on compte des entrées. Le calcul brut donnait
      // 103,37 sur les valeurs par défaut, et l'arrondi au plus proche aurait
      // affiché 103 — un seuil auquel l'événement perd encore de l'argent.
      // Le chiffre annoncé doit être celui à partir duquel on est à
      // l'équilibre, donc toujours l'entier SUPÉRIEUR.
      formula: 'ceil(coutsFixes / max(recetteNetteBillet, 1))',
      output: true,
      headline: true,
      help: 'À partir de ce nombre d’entrées vendues, l’événement est à l’équilibre.',
    },
    {
      key: 'margeSalleComble',
      label: 'Marge si salle comble',
      kind: 'money',
      formula: 'recetteNetteBillet * capacite - coutsFixes',
      output: true,
    },
  ],
};

/* ============================= COLLECTIF (BLOC C) ========================== */

/**
 * Cagnotte de groupe.
 *
 * Pensé pour une classe ou une association : le chiffre utile est « combien
 * chacun doit encore mettre », pas le total déjà collecté — c'est celui-là
 * qu'on peut envoyer dans une relance.
 */
const GROUP_POT: CalcProfile = {
  id: 'groupe-cagnotte',
  label: 'Cagnotte de groupe',
  description: 'Où en est la collecte, et ce qu’il reste à demander à chacun.',
  inputs: [
    { key: 'objectif', label: 'Objectif', kind: 'money', defaultValue: 120000 },
    { key: 'dejaCollecte', label: 'Déjà collecté', kind: 'money', defaultValue: 45000 },
    { key: 'participants', label: 'Participants', kind: 'number', defaultValue: 24 },
    { key: 'ontDejaPaye', label: 'Ont déjà payé', kind: 'number', defaultValue: 9 },
    {
      key: 'fraisPlateforme',
      label: 'Frais de plateforme',
      kind: 'percent',
      defaultValue: 2.9,
      help: 'Prélevés sur les sommes collectées — l’objectif doit en tenir compte.',
    },
  ],
  steps: [
    {
      key: 'objectifBrut',
      label: 'À collecter, frais compris',
      kind: 'money',
      formula: 'objectif / (1 - fraisPlateforme / 100)',
      output: true,
      help: 'Collecter l’objectif tout rond laisserait moins que l’objectif après frais.',
    },
    {
      key: 'restant',
      label: 'Reste à collecter',
      kind: 'money',
      formula: 'max(objectifBrut - dejaCollecte, 0)',
      output: true,
    },
    {
      key: 'restantsAPayer',
      label: 'N’ont pas encore payé',
      kind: 'number',
      formula: 'max(participants - ontDejaPaye, 0)',
      output: true,
    },
    {
      key: 'partRestante',
      label: 'Part par personne restante',
      kind: 'money',
      formula: 'restant / max(restantsAPayer, 1)',
      output: true,
      headline: true,
      help: 'Le montant à mettre dans la relance.',
    },
    {
      key: 'avancement',
      label: 'Avancement',
      kind: 'percent',
      formula: 'dejaCollecte * 100 / max(objectifBrut, 1)',
      output: true,
    },
  ],
};

/* ============================== STARTUP (BLOC C) =========================== */

/**
 * Répartition de parts entre fondateurs, pondérée.
 *
 * Volontairement simple : trois critères pondérés, et le résultat en
 * pourcentage. Ce n'est pas un pacte d'associés — c'est le calcul qu'on fait
 * sur un coin de table avant d'aller voir un avocat, et il vaut mieux qu'il
 * soit juste.
 */
const STARTUP_SPLIT: CalcProfile = {
  id: 'startup-repartition',
  label: 'Répartition entre fondateurs',
  description:
    'La part d’un fondateur à partir de son apport, de son temps et de son risque, chacun pondéré.',
  inputs: [
    { key: 'apportMoi', label: 'Mon apport financier', kind: 'money', defaultValue: 500000 },
    { key: 'apportTotal', label: 'Apports de tous', kind: 'money', defaultValue: 1500000 },
    { key: 'moisMoi', label: 'Mes mois à temps plein', kind: 'number', defaultValue: 12 },
    { key: 'moisTotal', label: 'Mois de tous', kind: 'number', defaultValue: 30 },
    {
      key: 'poidsCapital',
      label: 'Poids du capital',
      kind: 'percent',
      defaultValue: 40,
      help: 'La part de la décision qui revient à l’argent apporté.',
    },
    {
      key: 'poidsTemps',
      label: 'Poids du temps',
      kind: 'percent',
      defaultValue: 60,
      help: 'Le reste. Capital + temps devraient faire 100.',
    },
  ],
  steps: [
    {
      key: 'partCapital',
      label: 'Ma part du capital',
      kind: 'percent',
      formula: 'apportMoi * 100 / max(apportTotal, 1)',
    },
    {
      key: 'partTemps',
      label: 'Ma part du temps',
      kind: 'percent',
      formula: 'moisMoi * 100 / max(moisTotal, 1)',
    },
    {
      key: 'sommePoids',
      label: 'Somme des poids',
      kind: 'percent',
      formula: 'max(poidsCapital + poidsTemps, 1)',
      help: 'Normalise si les poids ne font pas exactement 100.',
    },
    {
      key: 'partFinale',
      label: 'Part suggérée',
      kind: 'percent',
      formula: '(partCapital * poidsCapital + partTemps * poidsTemps) / sommePoids',
      output: true,
      headline: true,
      help: 'Moyenne pondérée. À discuter, pas à appliquer les yeux fermés.',
    },
  ],
};

/* --------------------------------- Catalogue ------------------------------- */

export const CALC_PROFILES: CalcProfile[] = [
  ECOMMERCE_PRICE,
  ECOMMERCE_BASKET,
  EVENT_BREAKEVEN,
  GROUP_POT,
  STARTUP_SPLIT,
];

export const DEFAULT_CALC_PROFILE_ID = ECOMMERCE_PRICE.id;

export function calcProfileById(id: string): CalcProfile | undefined {
  return CALC_PROFILES.find((profile) => profile.id === id);
}
