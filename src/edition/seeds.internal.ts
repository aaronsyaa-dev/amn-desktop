import { EDITION_PRODUCT_NAME } from './edition';
import type {
  Client,
  Decision,
  KnowledgeDoc,
  LearningGoal,
  Objective,
  Quote,
  SharedTask,
} from '../shared/api';

/**
 * Données de démarrage du pont navigateur — édition INTERNE.
 *
 * Deux choses vivent ici, et elles ont la même raison d'être séparées du reste :
 * ce sont des données d'AMN DevSec.
 *
 *   - `FALLBACK_ACCOUNTS` : les comptes locaux d'Aaron et Mohamed (empreintes
 *     bcrypt réelles — la vérification est vraie, pas « tout passe »).
 *   - `seed*()` : le jeu de démonstration qui garnit un poste vierge, calqué
 *     sur la graine SQLite pour que navigateur et Electron montrent la même
 *     chose.
 *
 * L'édition Business résout `@edition/seeds` vers la variante vide : l'app
 * d'une cliente ne contient ni les adresses d'AMN DevSec, ni leurs empreintes
 * de mots de passe, ni des clients de démonstration qui ne sont pas les siens.
 */

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

export const FALLBACK_ACCOUNTS: Record<string, { name: string; hash: string }> = {
  'aaron@amn-devsec.com': {
    name: 'Aaron',
    hash: '$2b$10$RDGsFc6Vk/22xXFuVpbwQuaI0N//XtYpLyfDA4aOsTEejh1dIxqTe',
  },
  'mohamed@amn-devsec.com': {
    name: 'Mohamed',
    hash: '$2b$10$LUTrx6TGqtz0vG3QrY2noeeNaPQeypeuA2fZpmZxCZY03a.9IoToC',
  },
};

/** Seed mirrors the SQLite seed so the browser fallback shows the same data. */
export function seedClients(): Client[] {
  return [
    {
      id: 1,
      name: 'Mohamed Bensalah',
      company: 'G20 Corvetto',
      status: 'active',
      email: 'contact@g20corvetto.it',
      phone: '+39 02 1234 5678',
      notes:
        'Client historique. Sensible aux temps de réponse en soirée (pic e-commerce). Préfère un point hebdo le lundi.',
      imageDataUrl: '',
      linkedSiteIds: [],
      createdAt: daysAgo(120),
      updatedAt: daysAgo(2),
      events: [
        { id: 4, clientId: 1, title: 'Incident paiement', detail: 'Latence PSP traitée en 40 min.', date: daysAgo(2) },
        { id: 3, clientId: 1, title: 'Renouvellement contrat', detail: 'Contrat annuel reconduit.', date: daysAgo(30) },
        { id: 2, clientId: 1, title: 'Audit sécurité initial', detail: 'Correction de 4 vulnérabilités, durcissement WAF.', date: daysAgo(96) },
        { id: 1, clientId: 1, title: 'Onboarding', detail: 'Mise en place de la supervision des 2 domaines.', date: daysAgo(120) },
      ],
    },
    {
      id: 2,
      name: 'Sarah Lemaire',
      company: 'Atlas Retail',
      status: 'prospect',
      email: 's.lemaire@atlas-retail.fr',
      phone: '+33 6 12 34 56 78',
      notes: 'Prospect entrant via recommandation. Devis supervision + audit envoyé.',
      imageDataUrl: '',
      linkedSiteIds: [],
      createdAt: daysAgo(14),
      updatedAt: daysAgo(5),
      events: [
        { id: 6, clientId: 2, title: 'Devis envoyé', detail: 'Offre supervision + audit initial.', date: daysAgo(5) },
        { id: 5, clientId: 2, title: 'Premier contact', detail: 'Appel de découverte, 3 sites à superviser.', date: daysAgo(14) },
      ],
    },
  ];
}

export function seedQuotes(): Quote[] {
  return [
    {
      id: 1,
      clientId: 1,
      title: 'Supervision annuelle + audit initial',
      detail: 'Mise en place du tracker Sentinel sur 2 domaines, audit sécurité initial, suivi mensuel.',
      trackerTier: 'sentinel',
      priceEuro: 2400,
      status: 'accepted',
      paymentStatus: 'paid',
      createdAt: daysAgo(96),
      updatedAt: daysAgo(90),
    },
    {
      id: 2,
      clientId: 2,
      title: 'Supervision + audit initial',
      detail: 'Déploiement Sentinel sur 3 sites, audit initial, rapport de synthèse.',
      trackerTier: 'sentinel',
      priceEuro: 1800,
      status: 'sent',
      paymentStatus: 'unpaid',
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
  ];
}

export function seedTasks(): SharedTask[] {
  return [
    {
      id: 1,
      title: 'Relancer Atlas Retail sur le devis envoyé',
      detail: '',
      assigneeEmail: 'aaron@amn-devsec.com',
      status: 'todo',
      siteId: null,
      clientId: 2,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
    },
    {
      id: 2,
      title: 'Vérifier le certificat SSL du site principal',
      detail: 'Expire dans 3 semaines.',
      assigneeEmail: 'mohamed@amn-devsec.com',
      status: 'doing',
      siteId: null,
      clientId: null,
      createdAt: daysAgo(9),
      updatedAt: daysAgo(9),
    },
    {
      id: 3,
      title: 'Rédiger le rapport mensuel G20 Corvetto',
      detail: '',
      assigneeEmail: 'aaron@amn-devsec.com',
      status: 'done',
      siteId: null,
      clientId: 1,
      createdAt: daysAgo(8),
      updatedAt: daysAgo(8),
    },
  ];
}

export function seedDecisions(): Decision[] {
  return [
    {
      id: 1,
      title: 'Adoption de Supabase (plan gratuit) pour amn-api',
      detail:
        'Évite un coût récurrent tant que le volume reste faible ; migration vers un plan payant possible sans changement de code (client pg standard).',
      authorEmail: 'aaron@amn-devsec.com',
      authorName: 'Aaron',
      createdAt: daysAgo(20),
    },
    {
      id: 2,
      title: 'Tarif de base Sentinel fixé à 1800–2400 €/an selon nombre de sites',
      detail: 'Aligné sur le temps de mise en place + suivi mensuel estimé.',
      authorEmail: 'mohamed@amn-devsec.com',
      authorName: 'Mohamed',
      createdAt: daysAgo(7),
    },
  ];
}

export function seedKnowledge(): KnowledgeDoc[] {
  const now = new Date().toISOString();
  return [
    {
      id: 1,
      title: 'Installation du tracker (procédure)',
      body: `1. npm install @amn-devsec/security-monitor\n2. Enregistrer le site depuis ${EDITION_PRODUCT_NAME} (onglet Sites) pour obtenir la clé API\n3. Ajouter AMN_API_URL et AMN_API_KEY dans le .env du site client\n4. const tracker = createTracker(); app.use(tracker.middleware()); tracker.start();\n5. Vérifier dans ${EDITION_PRODUCT_NAME} que le site passe « en ligne » après le premier heartbeat.`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      title: 'Modèle — email de relance devis',
      body: 'Objet : Suite à notre devis du [date]\n\nBonjour [prénom],\n\nJe reviens vers vous concernant le devis envoyé le [date] pour [mission]. Restez-vous disponible cette semaine pour un point rapide ?\n\nBien à vous,\n[signature]',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function seedLearningGoals(): LearningGoal[] {
  const now = new Date().toISOString();
  return [
    {
      id: 1,
      ownerEmail: 'aaron@amn-devsec.com',
      title: 'Certification OSCP',
      platform: 'TryHackMe',
      progressPct: 35,
      targetDate: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      ownerEmail: 'mohamed@amn-devsec.com',
      title: 'AWS Certified Security',
      platform: 'A Cloud Guru',
      progressPct: 60,
      targetDate: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function seedObjectives(): Objective[] {
  const now = new Date().toISOString();
  const period = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return [
    { id: 1, label: 'Chiffre d’affaires visé', unit: '€', targetValue: 6000, currentValue: 2400, periodLabel: period, updatedAt: now },
    { id: 2, label: 'Nouveaux clients visés', unit: 'clients', targetValue: 3, currentValue: 1, periodLabel: period, updatedAt: now },
  ];
}
