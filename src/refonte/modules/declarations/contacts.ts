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
    { action: 'clients', niveau: 'essentiel', vues: [vue('clients', '/clients', ['ajouter un client', 'retrouver un client', 'faire un devis', 'créer un devis'], ['client', 'cliente', 'fiche', 'devis', 'crm'])] },
    { action: 'clients', niveau: 'courant', vues: [vue('aftersales', '/sav', ['traiter une demande de SAV', 'répondre à une réclamation'], ['sav', 'après-vente', 'réclamation', 'panne'])] },
    {
      nom: { fr: 'Prospects et scoring', en: 'Leads and scoring' },
      action: 'prospecter',
      niveau: 'essentiel',
      vues: [
        vue('pipeline', '/pipeline', ['ajouter un prospect', 'suivre un prospect', 'faire avancer une affaire'], ['prospect', 'lead', 'pipeline', 'opportunité', 'affaire']),
        vue('leadScoring', '/scoring-leads', ['savoir quel prospect appeler', 'classer mes prospects'], ['scoring', 'score', 'lead', 'priorité']),
      ],
    },
    {
      nom: { fr: 'Retours clients', en: 'Customer feedback' },
      action: 'ecouter',
      niveau: 'courant',
      vues: [
        vue('reviews', '/avis', ['demander un avis', 'lire les avis'], ['avis', 'note', 'étoiles', 'témoignage']),
        vue('sentiment', '/sentiment', ['savoir ce que les clients disent'], ['sentiment', 'opinion', 'retours']),
        vue('nps', '/nps', ['mesurer la satisfaction', 'envoyer un questionnaire de satisfaction'], ['nps', 'satisfaction', 'recommandation', 'note']),
      ],
    },
    {
      nom: { fr: 'Fidélité et parrainage', en: 'Loyalty and referrals' },
      action: 'fideliser',
      niveau: 'courant',
      vues: [
        vue('loyalty', '/fidelite', ['tamponner une carte de fidélité', 'offrir une récompense'], ['fidélité', 'tampon', 'carte', 'récompense']),
        vue('referrals', '/parrainage', ['noter un parrainage', 'récompenser un parrain'], ['parrainage', 'parrain', 'recommandation']),
      ],
    },
    { action: 'partenaires', niveau: 'courant', vues: [vue('suppliers', '/fournisseurs', ['ajouter un fournisseur', 'retrouver un fournisseur'], ['fournisseur', 'achat', 'grossiste'])] },
    { action: 'partenaires', niveau: 'courant', vues: [vue('directory', '/trombinoscope', ['retrouver un collègue', 'voir qui fait quoi'], ['trombinoscope', 'annuaire', 'collègue', 'équipe'])] },
  ],
});
