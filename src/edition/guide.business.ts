import { PAS, type PagePresentation, type ProfilDepart } from '../guide/profils';

/**
 * LES PROFILS DE DÉPART DE L'ÉDITION CLIENTE — de la collégienne au chef
 * d'entreprise. Quatre portes, pas dix : on choisit en cinq secondes, on
 * change quand on veut dans Paramètres.
 */
export const PROFILS: ProfilDepart[] = [
  {
    id: 'etudes',
    indexFamilles: true,
    label: { fr: 'Élève ou étudiant·e', en: 'Pupil or student' },
    phrase: { fr: 'Devoirs, cours, projets de classe, habitudes à tenir.', en: 'Homework, classes, school projects, habits to keep.' },
    epingles: ['home', 'tasks', 'agenda', 'projects', 'notes', 'habits', 'pomodoro'],
    alleges: ['clients', 'invoices', 'orders', 'evenements', 'calculators', 'expenses', 'reports', 'vault'],
    accueil: '40e',
    premiersPas: [
      { ...PAS.tache, titre: { fr: 'Noter un premier devoir dans Tâches', en: 'Write a first homework in Tasks' } },
      { ...PAS.rdv, titre: { fr: 'Poser tes cours de la semaine dans l’Agenda', en: 'Put this week’s classes in the Agenda' } },
      { ...PAS.projet, titre: { fr: 'Ouvrir un projet de classe', en: 'Open a school project' } },
      PAS.habitude,
    ],
  },
  {
    id: 'solo',
    indexFamilles: true,
    label: { fr: 'Je travaille seul·e', en: 'I work on my own' },
    phrase: { fr: 'Artisan, indépendant·e, profession libérale : clients, devis, rendez-vous.', en: 'Tradesperson, freelancer, practitioner: clients, quotes, appointments.' },
    epingles: ['home', 'agenda', 'clients', 'invoices', 'tasks', 'expenses'],
    premiersPas: [PAS.client, PAS.devis, PAS.rdv, PAS.depense],
  },
  {
    id: 'equipe',
    label: { fr: 'Une petite équipe', en: 'A small team' },
    phrase: { fr: 'Deux à dix personnes : qui fait quoi, les clients, les projets en commun.', en: 'Two to ten people: who does what, clients, shared projects.' },
    epingles: ['home', 'agenda', 'projects', 'tasks', 'clients', 'invoices', 'members'],
    premiersPas: [PAS.membre, PAS.projet, PAS.client, PAS.reunion],
  },
  {
    id: 'entreprise',
    label: { fr: 'Plusieurs équipes, plusieurs projets', en: 'Several teams, several projects' },
    phrase: { fr: 'Piloter de haut : objectifs, portefeuille de projets, tableau de bord.', en: 'Steer from above: goals, project portfolio, dashboard.' },
    epingles: ['home', 'dashboard', 'projects', 'board', 'okr', 'tasks', 'members'],
    accueil: '40i',
    premiersPas: [PAS.projet, PAS.membre, PAS.objectifs, PAS.tableau],
  },
];

/** Le profil pris d'office quand aucune question n'est posée ; `null` = on demande. */
export const PROFIL_AUTO: string | null = null;

/* LA PRÉSENTATION DU PRODUIT — cinq pages, avant la porte « Qui êtes-vous ? » (U4). Aucune ne nomme le prestataire. */
export const PRESENTATION: PagePresentation[] = [
  {
    sur: { fr: 'Bienvenue', en: 'Welcome' },
    titre: { fr: 'Votre espace de travail, entier, en un seul endroit.', en: 'Your whole workspace, in one place.' },
    texte: { fr: 'Clients, agenda, factures, tâches, équipe : tout ce que vous faisiez dans dix outils vit ici, relié, sur ordinateur comme sur téléphone.', en: 'Clients, calendar, invoices, tasks, team: everything you did in ten tools lives here, connected, on computer and phone.' },
    dessin: 'coquille',
  },
  {
    sur: { fr: 'L’Accueil', en: 'Home' },
    titre: { fr: 'Chaque matin, votre journée d’un coup d’œil.', en: 'Every morning, your day at a glance.' },
    texte: { fr: 'Vos rendez-vous sur un axe, ce qui attend une décision de votre part, et une seule chose mise en avant quand elle compte vraiment.', en: 'Your appointments on a timeline, what awaits your decision, and one thing highlighted when it really matters.' },
    dessin: 'journee',
  },
  {
    sur: { fr: 'Les familles', en: 'Families' },
    titre: { fr: 'Des modules rangés par famille, ouverts pour vous.', en: 'Modules grouped by family, opened for you.' },
    texte: { fr: 'À gauche, chaque famille a deux lettres et une couleur. Survolez-la pour lire son nom ; épinglez ce que vous ouvrez tous les jours.', en: 'On the left, each family has two letters and a colour. Hover to read its name; pin what you open every day.' },
    dessin: 'familles',
  },
  {
    sur: { fr: 'À plusieurs', en: 'Together' },
    titre: { fr: 'Votre équipe voit la même chose, en direct.', en: 'Your team sees the same thing, live.' },
    texte: { fr: 'Ce qu’une personne écrit apparaît chez les autres. Invitez vos collègues depuis Membres ; chacun a son accès, son rôle, son journal.', en: 'What one person writes appears for the others. Invite colleagues from Members; each has their access, role and log.' },
    dessin: 'equipe',
  },
  {
    sur: { fr: 'Vos données', en: 'Your data' },
    titre: { fr: 'Ce qui est à vous reste à vous.', en: 'What is yours stays yours.' },
    texte: { fr: 'Aucune autre organisation ne voit rien de chez vous. Tout s’exporte, tout s’efface, depuis Paramètres. Une question ? Le « ? » en haut à droite, toujours.', en: 'No other organisation sees anything of yours. Everything exports, everything erases, from Settings. A question? The “?” top right, always.' },
    dessin: 'coffre',
  },
];
