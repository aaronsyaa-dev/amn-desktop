/**
 * À QUEL MODULE APPARTIENT UNE COLLECTION — et pourquoi c'est un écran qui le demande
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * L'état hors-ligne (`27e`) montre la file d'envoi wagon par wagon. Une file
 * ne sert à quelque chose que si on y RECONNAÎT son propre travail : « un
 * devis », « une fiche client ». `clients:cli-7` ne dit rien à la personne
 * qui l'a saisi, et une file qu'on ne sait pas lire ne rassure pas — elle
 * inquiète.
 *
 * Ce fichier fait donc le pont entre la clé technique d'une collection et le
 * MODULE qui la produit ; le libellé, lui, vient ensuite de la barre latérale
 * (`navItemByKey`), jamais d'une seconde liste de noms.
 *
 * LA LISTE EST VÉRIFIÉE. `npm run check:persistence` croise ces clés avec les
 * collections qu'amn-api accepte réellement : une collection inventée ici, ou
 * renommée là-bas, fait échouer le contrôle au lieu d'afficher un wagon
 * anonyme le jour d'une coupure.
 */
export const COLLECTION_MODULE: Record<string, string> = {
  tasks: 'tasks',
  decisions: 'meetings',
  knowledge: 'notes',
  objectives: 'okr',
  messages: 'dm',
  profiles: 'directory',
  clients: 'clients',
  quotes: 'invoices',
  trackers: 'projects',
  notes: 'notes',
  reports: 'reports',
  pages: 'pages',
  appointments: 'agenda',
  media: 'media',
  invoices: 'invoices',
  billing: 'invoices',
  projects: 'projects',
  projectConfig: 'projects',
  expenses: 'expenses',
  expenseConfig: 'expenses',
  timeEntries: 'time',
  timeConfig: 'time',
  orders: 'orders',
  evenements: 'evenements',
  dms: 'dm',
  groups: 'groups',
  groupMessages: 'groups',
  announcements: 'announcements',
  polls: 'polls',
  leaves: 'leaves',
  leaveQuotas: 'leaves',
  calls: 'calls',
  qrCodes: 'qr',
  calcTapes: 'calcPro',
  prospects: 'pipeline',
  paymentReminders: 'reminders',
  subscriptions: 'subscriptions',
  contracts: 'contracts',
  reviews: 'reviews',
  loyaltyCards: 'loyalty',
  referrals: 'referrals',
  bookingConfig: 'booking',
  stockItems: 'stock',
  suppliers: 'suppliers',
  shifts: 'shifts',
  checklists: 'checklists',
  checkRuns: 'checklists',
  interventions: 'interventions',
  assemblies: 'assembly',
  tickets: 'aftersales',
  boms: 'bom',
  okrs: 'okr',
  weeklyReviews: 'weekly',
  meetings: 'meetings',
  dailyPriorities: 'priorities',
  routines: 'routines',
  logbook: 'logbook',
  forms: 'forms',
  formAnswers: 'forms',
  minisite: 'minisite',
  newsletters: 'newsletter',
  signatures: 'esign',
  portfolioItems: 'portfolio',
  templates: 'templates',
  automations: 'automations',
  cashCounts: 'cashCount',
  deliveryRounds: 'rounds',
  resources: 'equipment',
  resourceBookings: 'equipment',
};
