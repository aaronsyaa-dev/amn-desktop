import { PAS, type PagePresentation, type ProfilDepart } from '../guide/profils';

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

/* LA PRÉSENTATION DU PRODUIT — édition interne (U4). */
export const PRESENTATION: PagePresentation[] = [
  {
    sur: { fr: 'Bienvenue', en: 'Welcome' },
    titre: { fr: 'Le poste d’AMN DevSec : votre travail et celui de vos clientes.', en: 'The AMN DevSec workstation: your work and your clients’.' },
    texte: { fr: 'À gauche, vos organisations. En tête du rail, la supervision ; en dessous, le quotidien — les mêmes modules que vos clientes.', en: 'On the left, your organisations. At the top of the rail, supervision; below, daily work — the same modules as your clients.' },
    dessin: 'coquille',
  },
  {
    sur: { fr: 'La supervision', en: 'Supervision' },
    titre: { fr: 'La Garde veille, vous décidez.', en: 'The Guard watches, you decide.' },
    texte: { fr: 'La Tour, le Parc, la Garde et les Produits : ce qui attend votre avis arrive dans une seule pile. Le lexique (« ? ») traduit chaque mot.', en: 'The Tower, the Fleet, the Guard and the Products: what awaits your call lands in one pile. The glossary (“?”) translates every word.' },
    dessin: 'supervision',
  },
  {
    sur: { fr: 'Le support', en: 'Support' },
    titre: { fr: 'Entrer chez une cliente, c’est tracé et limité.', en: 'Entering a client is logged and time-boxed.' },
    texte: { fr: 'Un clic sur son avatar ouvre une session d’une heure, inscrite à son journal. Elle voit que vous êtes passé.', en: 'A click on their avatar opens a one-hour session, written to their log. They see you came by.' },
    dessin: 'equipe',
  },
  {
    sur: { fr: 'L’aide', en: 'Help' },
    titre: { fr: 'Le « ? » répond à tout, partout.', en: 'The “?” answers everything, everywhere.' },
    texte: { fr: 'Revoir la visite, faire présenter l’écran ouvert, changer de profil, ouvrir le lexique.', en: 'Replay the tour, have the open screen explained, change profile, open the glossary.' },
    dessin: 'aide',
  },
];
