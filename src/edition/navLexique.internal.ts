import {
  NAV_EN_COMMUN,
  SECTIONS_EN_COMMUN,
  type TraductionNav,
} from '../i18n/nav.en';

/**
 * Le lexique anglais de navigation — ÉDITION INTERNE.
 *
 * Résolu par l'alias `@edition/navLexique` (voir vite.edition.ts), exactement
 * comme le catalogue des modules : ce qui suit nomme les produits exclusifs
 * d'AMN DevSec (Scanner, Comply, SSL Monitor, la Tour de contrôle), et n'a
 * donc pas le DROIT d'exister dans le bundle Business — le contrôle de pureté
 * du bundle (check-business-bundle) refuse le build qui les contiendrait.
 * C'est lui qui a imposé cette coupe.
 */

const NAV_EN_INTERNE: Record<string, TraductionNav> = {
  team: { label: 'Team', hint: 'Messaging & presence' },
  decisions: { label: 'Decisions', hint: 'Decision log' },
  knowledge: { label: 'Knowledge', hint: 'Internal knowledge base' },
  tour: { label: 'Overview', hint: 'The SOC wall' },
  gardeSalle: { label: 'The Room', hint: 'The wall of guards: who does what, now' },
  gardeAjmani: { label: 'Ajmani', hint: 'The chief of staff: speaks first, one proposal' },
  gardePile: { label: 'Your call', hint: 'What awaits a human decision' },
  gardeBureaux: { label: 'The offices', hint: 'Talk to a guard chief' },
  gardeCommune: { label: 'Common room', hint: 'Talk to the whole Guard, the daily brief' },
  gardeCalendrier: { label: 'Calendar', hint: 'What the Guard will do this week' },
  orgs: { label: 'Organisations', hint: 'Every managed client' },
  access: { label: 'Access log', hint: 'Who entered where' },
  generator: { label: 'Workshop', hint: 'Create a tailored workspace' },
  supervision: { label: 'Monitoring', hint: 'Incidents to handle' },
  sites: { label: 'Sites', hint: 'Client site register' },
  tracker: { label: 'Trackers', hint: 'Real-time monitoring' },
  scanner: { label: 'Scanner', hint: 'Vulnerability scanning' },
  comply: { label: 'Comply', hint: 'GDPR compliance' },
  ssl: { label: 'SSL Monitor', hint: 'TLS certificates' },
};

export const NAV_EN: Record<string, TraductionNav> = {
  ...NAV_EN_COMMUN,
  ...NAV_EN_INTERNE,
};

export const SECTIONS_EN: Record<string, string> = {
  ...SECTIONS_EN_COMMUN,
  Collectif: 'Collaboration',
  Livrables: 'Deliverables',
  Supervision: 'Monitoring',
  Parc: 'Estate',
  Produits: 'Products',
};

/** Les deux espaces internes, par clé. L'édition Business n'en a pas. */
export const ESPACES_EN: Record<string, { label: string; hint: string }> = {
  workspace: { label: 'Workstation', hint: 'Day-to-day: clients, tasks, notes, calendar' },
  control: { label: 'Control tower', hint: 'Across the estate: incidents, products, organisations' },
};
