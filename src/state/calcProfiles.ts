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
      formula: 'coutsFixes / max(recetteNetteBillet, 1)',
      output: true,
      help: 'En dessous, l’événement coûte de l’argent.',
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
      help: 'Moyenne pondérée. À discuter, pas à appliquer les yeux fermés.',
    },
  ],
};

/* --------------------------------- Catalogue ------------------------------- */

export const CALC_PROFILES: CalcProfile[] = [
  ECOMMERCE_PRICE,
  EVENT_BREAKEVEN,
  GROUP_POT,
  STARTUP_SPLIT,
];

export const DEFAULT_CALC_PROFILE_ID = ECOMMERCE_PRICE.id;

export function calcProfileById(id: string): CalcProfile | undefined {
  return CALC_PROFILES.find((profile) => profile.id === id);
}
