import { declarerFamille, vue } from '../declarer';

/**
 * MES CONTACTS — clients, prospects, ce qu’ils disent, et les gens avec qui on travaille.
 *
 * Regroupés : Prospects et scoring ; Retours clients (Avis, Sentiment, NPS) ;
 * Fidélité et parrainage.
 */

export default declarerFamille({
  id: 'contacts',
  ordre: 2,
  teinte: 'contacts',
  nom: { fr: 'Mes contacts', en: 'People' },
  actions: {
    clients: { fr: 'Mes clients', en: 'My customers' },
    prospecter: { fr: 'Trouver des clients', en: 'Find customers' },
    ecouter: { fr: 'Écouter les clients', en: 'Listen to customers' },
    fideliser: { fr: 'Fidéliser', en: 'Keep customers' },
    partenaires: { fr: 'Fournisseurs et collègues', en: 'Suppliers and colleagues' },
  },
  modules: [
    {
      action: 'clients',
      niveau: 'essentiel',
      vues: [
        vue('clients', '/clients', ['ajouter un client', 'retrouver un client', 'faire un devis', 'créer un devis', 'trouver un contact', 'voir l’historique d’un client'], ['client', 'cliente', 'fiche', 'devis', 'crm', 'contact', 'répertoire', 'carnet d’adresses'], {
          en: { verbes: ['add a customer', 'find a customer', 'make a quote', 'create a quote'], motsCles: ['customer', 'client', 'contact', 'quote', 'estimate', 'crm'] },
        }),
      ],
    },
    {
      action: 'clients',
      niveau: 'courant',
      vues: [
        vue('aftersales', '/sav', ['traiter une demande de SAV', 'répondre à une réclamation'], ['sav', 'après-vente', 'réclamation', 'panne', 'retour'], {
          en: { verbes: ['handle an after-sales request', 'answer a complaint'], motsCles: ['after-sales', 'complaint', 'breakdown', 'return', 'warranty'] },
        }),
      ],
    },
    {
      nom: { fr: 'Prospects et scoring', en: 'Leads and scoring' },
      action: 'prospecter',
      niveau: 'essentiel',
      vues: [
        vue('pipeline', '/pipeline', ['ajouter un prospect', 'suivre un prospect', 'faire avancer une affaire'], ['prospect', 'lead', 'pipeline', 'opportunité', 'affaire', 'vente', 'commercial'], {
          en: { verbes: ['add a lead', 'follow a lead', 'move a deal forward'], motsCles: ['lead', 'prospect', 'pipeline', 'opportunity', 'deal', 'sales'] },
        }),
        vue('leadScoring', '/scoring-leads', ['savoir quel prospect appeler', 'classer mes prospects'], ['scoring', 'score', 'lead', 'priorité'], {
          en: { verbes: ['know which lead to call', 'rank my leads'], motsCles: ['scoring', 'score', 'lead', 'priority'] },
        }),
      ],
    },
    {
      nom: { fr: 'Retours clients', en: 'Customer feedback' },
      action: 'ecouter',
      niveau: 'courant',
      vues: [
        vue('reviews', '/avis', ['demander un avis', 'lire les avis', 'répondre à un avis'], ['avis', 'note', 'étoiles', 'témoignage', 'google', 'trustpilot', 'e-réputation'], {
          en: { verbes: ['ask for a review', 'read the reviews'], motsCles: ['review', 'rating', 'stars', 'testimonial', 'feedback'] },
        }),
        vue('sentiment', '/sentiment', ['savoir ce que les clients disent', 'analyser les commentaires'], ['sentiment', 'opinion', 'retours'], {
          en: { verbes: ['see what customers say', 'analyze the comments'], motsCles: ['sentiment', 'opinion', 'feedback', 'mood'] },
        }),
        vue('nps', '/nps', ['mesurer la satisfaction', 'envoyer un questionnaire de satisfaction'], ['nps', 'satisfaction', 'recommandation', 'note'], {
          en: { verbes: ['measure satisfaction', 'send a satisfaction survey'], motsCles: ['nps', 'satisfaction', 'recommend', 'score', 'survey'] },
        }),
      ],
    },
    {
      nom: { fr: 'Fidélité et parrainage', en: 'Loyalty and referrals' },
      action: 'fideliser',
      niveau: 'courant',
      vues: [
        vue('loyalty', '/fidelite', ['tamponner une carte de fidélité', 'offrir une récompense'], ['fidélité', 'tampon', 'carte', 'récompense'], {
          en: { verbes: ['stamp a loyalty card', 'give a reward'], motsCles: ['loyalty', 'stamp', 'card', 'reward', 'points'] },
        }),
        vue('referrals', '/parrainage', ['noter un parrainage', 'récompenser un parrain'], ['parrainage', 'parrain', 'recommandation'], {
          en: { verbes: ['note a referral', 'reward a referrer'], motsCles: ['referral', 'referrer', 'recommendation', 'sponsor'] },
        }),
      ],
    },
    {
      action: 'partenaires',
      niveau: 'courant',
      vues: [
        vue('suppliers', '/fournisseurs', ['ajouter un fournisseur', 'retrouver un fournisseur', 'comparer des fournisseurs'], ['fournisseur', 'achat', 'grossiste', 'approvisionnement'], {
          en: { verbes: ['add a supplier', 'find a supplier'], motsCles: ['supplier', 'vendor', 'wholesaler', 'purchasing'] },
        }),
      ],
    },
    {
      action: 'partenaires',
      niveau: 'courant',
      vues: [
        vue('directory', '/trombinoscope', ['retrouver un collègue', 'voir qui fait quoi'], ['trombinoscope', 'annuaire', 'collègue', 'équipe'], {
          en: { verbes: ['find a colleague', 'see who does what'], motsCles: ['directory', 'colleague', 'team', 'people', 'staff'] },
        }),
      ],
    },
  ],
});
