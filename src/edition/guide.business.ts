import { PAS, type ProfilDepart } from '../guide/profils';

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
