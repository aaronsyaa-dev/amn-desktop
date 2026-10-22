import { declarerFamille, vue } from '../declarer';

/**
 * ARGENT — facturer, vendre, dépenser, prévoir, tenir les comptes.
 *
 * Regroupés : Facturation (Relances, Acompte) ; Dépenses et achats (Notes de
 * frais, Factures entrantes) ; Prévisions (Trésorerie, Scénarios, Simulateur de
 * prêt, Prévision fiscale).
 */

export default declarerFamille({
  id: 'argent',
  ordre: 4,
  teinte: 'argent',
  nom: { fr: 'Argent', en: 'Money' },
  actions: {
    facturer: { fr: 'Facturer', en: 'Invoice' },
    vendre: { fr: 'Vendre et encaisser', en: 'Sell and get paid' },
    depenser: { fr: 'Dépenses', en: 'Spending' },
    prevoir: { fr: 'Prévoir', en: 'Forecast' },
    comptabilite: { fr: 'Comptabilité', en: 'Accounting' },
  },
  modules: [
    {
      nom: { fr: 'Facturation', en: 'Invoicing' },
      action: 'facturer',
      niveau: 'essentiel',
      vues: [
        vue('invoices', '/facturation', ['envoyer une facture', 'créer une facture', 'facturer un client', 'marquer une facture payée'], ['facture', 'facturation', 'paiement', 'encaissement', 'tva']),
        vue('reminders', '/relances', ['relancer un impayé', 'relancer une facture', 'réclamer un paiement'], ['relance', 'impayé', 'retard', 'échue']),
        vue('deposits', '/acompte', ['demander un acompte', 'faire payer en ligne'], ['acompte', 'paiement en ligne', 'arrhes']),
      ],
    },
    { action: 'vendre', niveau: 'courant', vues: [vue('orders', '/commandes', ['voir les commandes', 'traiter une commande'], ['commande', 'vente', 'site'])] },
    { action: 'vendre', niveau: 'courant', vues: [vue('cashCount', '/caisse', ['faire la caisse', 'compter les espèces'], ['caisse', 'espèces', 'fond de caisse', 'écart'])] },
    { action: 'vendre', niveau: 'courant', vues: [vue('shop', '/boutique', ['vendre en ligne', 'voir les paniers abandonnés'], ['boutique', 'e-commerce', 'panier', 'produit'])] },
    { action: 'vendre', niveau: 'avance', vues: [vue('ticketing', '/billetterie', ['vendre des billets', 'contrôler les entrées'], ['billet', 'billetterie', 'place', 'entrée'])] },
    { action: 'vendre', niveau: 'avance', vues: [vue('donations', '/dons', ['collecter des dons', 'lancer une collecte'], ['don', 'collecte', 'cagnotte'])] },
    {
      nom: { fr: 'Dépenses et achats', en: 'Expenses and purchases' },
      action: 'depenser',
      niveau: 'essentiel',
      vues: [
        vue('expenses', '/depenses', ['ajouter une dépense', 'garder un justificatif'], ['dépense', 'frais', 'achat', 'justificatif', 'ticket']),
        vue('expenseClaims', '/notes-de-frais', ['faire une note de frais', 'scanner un ticket'], ['note de frais', 'ticket', 'remboursement']),
        vue('incomingInvoices', '/factures-entrantes', ['enregistrer une facture fournisseur', 'payer un fournisseur'], ['facture fournisseur', 'achat', 'échéance']),
      ],
    },
    {
      nom: { fr: 'Prévisions', en: 'Forecasts' },
      action: 'prevoir',
      niveau: 'courant',
      vues: [
        vue('cashForecast', '/tresorerie', ['prévoir ma trésorerie', 'voir mon solde à venir'], ['trésorerie', 'solde', 'banque', 'prévision']),
        vue('scenarios', '/scenarios', ['tester un budget', 'simuler une embauche', 'simuler une hausse de prix'], ['scénario', 'budget', 'simulation']),
        vue('loanSim', '/simulateur-pret', ['simuler un prêt', 'calculer une mensualité'], ['prêt', 'crédit', 'emprunt', 'mensualité']),
        vue('taxForecast', '/prevision-fiscale', ['prévoir mes impôts', 'mettre de côté la TVA'], ['impôt', 'fiscal', 'tva', 'urssaf']),
      ],
    },
    { action: 'prevoir', niveau: 'courant', vues: [vue('watch', '/veille-prix', ['comparer mes prix', 'surveiller la concurrence'], ['veille', 'prix', 'concurrence', 'marché'])] },
    { action: 'prevoir', niveau: 'avance', vues: [vue('analytics', '/analytique', ['voir la marge d’un projet', 'comparer prévu et réel'], ['analytique', 'marge', 'rentabilité'])] },
    { action: 'comptabilite', niveau: 'courant', vues: [vue('reconciliation', '/rapprochement', ['pointer mon relevé bancaire', 'rapprocher la banque'], ['rapprochement', 'relevé', 'banque', 'pointage'])] },
    { action: 'comptabilite', niveau: 'avance', vues: [vue('currencies', '/multi-devises', ['suivre les montants en devises', 'mesurer le risque de change'], ['devise', 'change', 'dollar', 'taux'])] },
  ],
});
