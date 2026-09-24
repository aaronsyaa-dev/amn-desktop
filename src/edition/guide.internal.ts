import { PAS, type ProfilDepart } from '../guide/profils';

/**
 * LES PROFILS DE DÉPART DE L'ÉDITION INTERNE — deux portes : superviser le
 * parc (Harun, Mohamed, Riyad), ou travailler dans son propre poste comme
 * une cliente le ferait. Le profil « supervision » n'existe que dans cette
 * édition : il épingle la Tour, la Garde et le Parc.
 */
export const PROFILS: ProfilDepart[] = [
  {
    id: 'supervision',
    label: { fr: 'Je supervise le parc', en: 'I supervise the fleet' },
    phrase: { fr: 'La Tour de contrôle, la Garde, les sites et les clientes : voir de haut, tout piloter.', en: 'The control tower, the Guard, sites and clients: see from above, steer everything.' },
    epingles: ['home', 'tour', 'supervision', 'gardeSalle', 'gardePile', 'orgs'],
    premiersPas: [
      { id: 'tour', titre: { fr: 'Ouvrir la Vue d’ensemble du parc', en: 'Open the fleet overview' }, to: '/tour', module: 'tour', fait: { moduleOuvert: 'tour' } },
      { id: 'salle', titre: { fr: 'Regarder la Salle : qui veille, sur quoi', en: 'Look at the Room: who is on watch, over what' }, to: '/garde', module: 'gardeSalle', fait: { moduleOuvert: 'gardeSalle' } },
      { id: 'pile', titre: { fr: 'Lire la pile « À votre avis »', en: 'Read the “Your call” pile' }, to: '/garde/pile', module: 'gardePile', fait: { moduleOuvert: 'gardePile' } },
      { id: 'orgs', titre: { fr: 'Ouvrir la fiche d’une organisation', en: 'Open an organisation’s record' }, to: '/tour/organisations', module: 'orgs', fait: { moduleOuvert: 'orgs' } },
    ],
  },
  {
    id: 'poste',
    label: { fr: 'Je travaille dans mon poste', en: 'I work in my own workspace' },
    phrase: { fr: 'Le quotidien : tâches, agenda, clients, projets — sans la supervision en premier.', en: 'The daily work: tasks, agenda, clients, projects — without supervision first.' },
    epingles: ['home', 'agenda', 'tasks', 'clients', 'projects', 'team'],
    premiersPas: [PAS.tache, PAS.rdv, PAS.projet, PAS.accueils],
  },
];

export const PROFIL_AUTO: string | null = null;
