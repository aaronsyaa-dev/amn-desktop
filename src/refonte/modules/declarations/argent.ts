import { declarerFamille, vue } from '../declarer';

/**
 * ARGENT — facturer, vendre, dépenser, prévoir, tenir les comptes.
 *
 * Regroupés : Facturation (Relances, Acompte) ; Contrats et abonnements ;
 * Dépenses et achats (Notes de frais, Factures entrantes) ; Prévisions
 * (Trésorerie, Scénarios, Simulateur de prêt, Prévision fiscale).
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
        vue('invoices', '/facturation', ['envoyer une facture', 'créer une facture', 'facturer un client', 'marquer une facture payée', 'faire un avoir', 'exporter pour mon comptable', 'exporter mes factures'], ['facture', 'facturation', 'paiement', 'encaissement', 'tva', 'avoir', 'fec', 'comptable', 'pdf'], {
          en: { verbes: ['send an invoice', 'create an invoice', 'invoice a customer', 'mark an invoice paid', 'export for my accountant'], motsCles: ['invoice', 'invoicing', 'payment', 'billing', 'vat', 'credit note', 'accountant'] },
        }),
        vue('reminders', '/relances', ['relancer un impayé', 'relancer une facture', 'réclamer un paiement'], ['relance', 'impayé', 'retard', 'échue'], {
          en: { verbes: ['chase an unpaid invoice', 'send a payment reminder', 'claim a payment'], motsCles: ['reminder', 'unpaid', 'overdue', 'late payment', 'dunning'] },
        }),
        vue('deposits', '/acompte', ['demander un acompte', 'faire payer en ligne'], ['acompte', 'paiement en ligne', 'arrhes'], {
          en: { verbes: ['ask for a deposit', 'get paid online'], motsCles: ['deposit', 'online payment', 'down payment'] },
        }),
      ],
    },
    {
      nom: { fr: 'Contrats et abonnements', en: 'Contracts and subscriptions' },
      action: 'facturer',
      niveau: 'courant',
      vues: [
        vue('contracts', '/contrats', ['suivre un contrat', 'voir quand un contrat se termine', 'renouveler un contrat'], ['contrat', 'échéance', 'engagement', 'renouvellement', 'résiliation'], {
          en: { verbes: ['follow a contract', 'see when a contract ends'], motsCles: ['contract', 'deadline', 'commitment', 'renewal'] },
        }),
        vue('subscriptions', '/abonnements', ['facturer un abonnement', 'facturer chaque mois', 'suspendre un abonnement'], ['abonnement', 'mensuel', 'récurrent', 'récurrence'], {
          en: { verbes: ['bill a subscription', 'bill every month'], motsCles: ['subscription', 'monthly', 'recurring'] },
        }),
      ],
    },
    {
      action: 'vendre',
      niveau: 'courant',
      vues: [
        vue('orders', '/commandes', ['voir les commandes', 'traiter une commande', 'expédier une commande'], ['commande', 'vente', 'site', 'expédition'], {
          en: { verbes: ['see orders', 'process an order'], motsCles: ['order', 'sale', 'website', 'shipping'] },
        }),
      ],
    },
    {
      action: 'vendre',
      niveau: 'courant',
      vues: [
        vue('cashCount', '/caisse', ['faire la caisse', 'compter les espèces'], ['caisse', 'espèces', 'fond de caisse', 'écart'], {
          en: { verbes: ['do the till count', 'count the cash'], motsCles: ['till', 'cash', 'float', 'difference', 'cash register'] },
        }),
      ],
    },
    {
      action: 'vendre',
      niveau: 'courant',
      vues: [
        vue('shop', '/boutique', ['vendre en ligne', 'voir les paniers abandonnés'], ['boutique', 'e-commerce', 'panier', 'produit'], {
          en: { verbes: ['sell online', 'see abandoned carts'], motsCles: ['shop', 'store', 'e-commerce', 'cart', 'product'] },
        }),
      ],
    },
    {
      action: 'vendre',
      niveau: 'avance',
      vues: [
        vue('ticketing', '/billetterie', ['vendre des billets', 'contrôler les entrées'], ['billet', 'billetterie', 'place', 'entrée'], {
          en: { verbes: ['sell tickets', 'check people in'], motsCles: ['ticket', 'ticketing', 'seat', 'entry'] },
        }),
      ],
    },
    {
      action: 'vendre',
      niveau: 'avance',
      vues: [
        vue('donations', '/dons', ['collecter des dons', 'lancer une collecte'], ['don', 'collecte', 'cagnotte'], {
          en: { verbes: ['collect donations', 'start a fundraiser'], motsCles: ['donation', 'fundraiser', 'collection', 'crowdfunding'] },
        }),
      ],
    },
    {
      nom: { fr: 'Dépenses et achats', en: 'Expenses and purchases' },
      action: 'depenser',
      niveau: 'essentiel',
      vues: [
        vue('expenses', '/depenses', ['ajouter une dépense', 'garder un justificatif', 'classer mes dépenses'], ['dépense', 'frais', 'achat', 'justificatif', 'ticket', 'reçu'], {
          en: { verbes: ['add an expense', 'keep a receipt'], motsCles: ['expense', 'cost', 'purchase', 'receipt', 'proof'] },
        }),
        vue('expenseClaims', '/notes-de-frais', ['faire une note de frais', 'scanner un ticket'], ['note de frais', 'ticket', 'remboursement'], {
          en: { verbes: ['file an expense claim', 'scan a receipt'], motsCles: ['expense claim', 'receipt', 'reimbursement'] },
        }),
        vue('incomingInvoices', '/factures-entrantes', ['enregistrer une facture fournisseur', 'payer un fournisseur', 'saisir une facture d’achat'], ['facture fournisseur', 'achat', 'échéance', 'facture d’achat'], {
          en: { verbes: ['record a supplier invoice', 'pay a supplier'], motsCles: ['supplier invoice', 'purchase invoice', 'purchase', 'due date'] },
        }),
      ],
    },
    {
      nom: { fr: 'Prévisions', en: 'Forecasts' },
      action: 'prevoir',
      niveau: 'courant',
      vues: [
        vue('cashForecast', '/tresorerie', ['prévoir ma trésorerie', 'voir mon solde à venir', 'voir si je tiens jusqu’à la fin du mois'], ['trésorerie', 'solde', 'banque', 'prévision', 'cash', 'liquidités', 'cash flow'], {
          en: { verbes: ['forecast my cash', 'see my upcoming balance'], motsCles: ['cash flow', 'cash', 'balance', 'bank', 'forecast', 'liquidity'] },
        }),
        vue('scenarios', '/scenarios', ['tester un budget', 'simuler une embauche', 'simuler une hausse de prix'], ['scénario', 'budget', 'simulation'], {
          en: { verbes: ['test a budget', 'simulate a hire', 'simulate a price increase'], motsCles: ['scenario', 'budget', 'simulation', 'what if'] },
        }),
        vue('loanSim', '/simulateur-pret', ['simuler un prêt', 'calculer une mensualité'], ['prêt', 'crédit', 'emprunt', 'mensualité'], {
          en: { verbes: ['simulate a loan', 'work out a monthly payment'], motsCles: ['loan', 'credit', 'borrowing', 'repayment', 'mortgage'] },
        }),
        vue('taxForecast', '/prevision-fiscale', ['prévoir mes impôts', 'mettre de côté la TVA'], ['impôt', 'fiscal', 'tva', 'urssaf', 'impôts', 'charges', 'tva à payer'], {
          en: { verbes: ['forecast my taxes', 'set VAT aside'], motsCles: ['tax', 'taxes', 'vat', 'social charges'] },
        }),
      ],
    },
    {
      action: 'prevoir',
      niveau: 'courant',
      vues: [
        vue('watch', '/veille-prix', ['comparer mes prix', 'surveiller la concurrence'], ['veille', 'prix', 'concurrence', 'marché'], {
          en: { verbes: ['compare my prices', 'watch the competition'], motsCles: ['price watch', 'prices', 'competition', 'market'] },
        }),
      ],
    },
    {
      action: 'prevoir',
      niveau: 'avance',
      vues: [
        vue('analytics', '/analytique', ['voir la marge d’un projet', 'comparer prévu et réel'], ['analytique', 'marge', 'rentabilité', 'rentabilité des projets', 'prévu réel'], {
          en: { verbes: ['see a project’s margin', 'compare planned and actual'], motsCles: ['analytics', 'margin', 'profitability', 'planned vs actual'] },
        }),
      ],
    },
    {
      action: 'comptabilite',
      niveau: 'courant',
      vues: [
        vue('reconciliation', '/rapprochement', ['pointer mon relevé bancaire', 'rapprocher la banque'], ['rapprochement', 'relevé', 'banque', 'pointage'], {
          en: { verbes: ['match my bank statement', 'reconcile the bank'], motsCles: ['reconciliation', 'statement', 'bank', 'matching'] },
        }),
      ],
    },
    {
      action: 'comptabilite',
      niveau: 'avance',
      vues: [
        vue('currencies', '/multi-devises', ['suivre les montants en devises', 'mesurer le risque de change'], ['devise', 'change', 'dollar', 'taux', 'euro', 'taux de change'], {
          en: { verbes: ['track amounts in foreign currency', 'measure exchange risk'], motsCles: ['currency', 'exchange', 'dollar', 'rate', 'foreign'] },
        }),
      ],
    },
  ],
});
