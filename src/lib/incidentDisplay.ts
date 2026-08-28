/**
 * CE QUE L'ÉCRAN DIT D'UN INCIDENT — un seul endroit
 * ═════════════════════════════════════════════════
 *
 * Le titre vient du SERVEUR (`incident.title`), délibérément : le même texte
 * part dans la file, le rapport mensuel et la notification. Trois formulations
 * pour un même incident donneraient l'impression de trois choses différentes.
 *
 * Ce qui reste ici est ce que seul l'écran sait faire : mettre en forme un
 * délai pour un œil humain, et choisir un ton.
 */

import type { Incident, IncidentMetrics, IncidentStatus, RemoteSeverity } from '../shared/api';

/**
 * Une durée pour un œil, pas pour une machine.
 *
 * Arrondie franchement — « 3 h » plutôt que « 3 h 07 min 12 s ». Une précision
 * à la seconde sur un délai de prise en charge donne une fausse impression de
 * mesure fine, alors que ce qu'on lit est un ordre de grandeur : quelques
 * minutes, quelques heures, ou trop longtemps.
 */
export function dureeLisible(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = ms / 3_600_000;
  if (h < 24) return `${h < 10 ? h.toFixed(1).replace('.0', '') : Math.round(h)} h`;
  const j = Math.round(h / 24);
  return `${j} j`;
}

/** Depuis combien de temps, en une expression courte. */
export function depuis(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return dureeLisible(ms);
}

export const STATUT_LABEL: Record<IncidentStatus, string> = {
  new: 'À traiter',
  acknowledged: 'En cours',
  resolved: 'Clos',
};

/**
 * Le ton d'une ligne.
 *
 * Le rouge est réservé — c'est la règle de la palette, et elle vaut doublement
 * ici : dans une console de supervision, un rouge distribué largement cesse
 * d'être un signal en une semaine. Il ne sort donc QUE pour un incident
 * critique ENCORE à traiter. Critique mais pris en charge n'est plus une
 * urgence : quelqu'un s'en occupe, et le dire en rouge ferait paniquer pour
 * rien.
 */
export function tonIncident(incident: Pick<Incident, 'severity' | 'status'>): 'urgent' | 'attention' | 'calme' | 'clos' {
  if (incident.status === 'resolved') return 'clos';
  if (incident.severity === 'critical' && incident.status === 'new') return 'urgent';
  if (incident.severity === 'critical' || incident.severity === 'warning') return 'attention';
  return 'calme';
}

export const TON_STYLE: Record<ReturnType<typeof tonIncident>, { point: string; puce: string; bord: string }> = {
  urgent: {
    point: 'bg-danger',
    puce: 'border-danger/50 text-danger',
    bord: 'border-l-danger',
  },
  attention: {
    point: 'bg-text-primary',
    puce: 'border-border-strong text-text-primary',
    bord: 'border-l-border-strong',
  },
  calme: {
    point: 'bg-text-muted',
    puce: 'border-border text-text-secondary',
    bord: 'border-l-border',
  },
  clos: {
    point: 'bg-text-muted/40',
    puce: 'border-border text-text-muted',
    bord: 'border-l-transparent',
  },
};

/**
 * La phrase que la tête d'écran met en avant.
 *
 * Elle dit ce qu'il faut faire, pas ce qui s'est passé. Une console qui
 * annonce « 47 incidents » n'aide personne ; « 2 critiques à traiter » dit où
 * regarder. Et quand il n'y a rien, elle le dit franchement plutôt que
 * d'afficher un zéro : un zéro se lit comme une panne de compteur.
 */
export function resumeSupervision(m: IncidentMetrics | null): string {
  if (!m) return 'Relevé en cours…';
  if (m.critical > 0) {
    return `${m.critical} incident${m.critical > 1 ? 's' : ''} critique${m.critical > 1 ? 's' : ''} à traiter.`;
  }
  if (m.open > 0) {
    return `${m.open} incident${m.open > 1 ? 's' : ''} ouvert${m.open > 1 ? 's' : ''}, rien de critique.`;
  }
  return 'Rien d’ouvert. La supervision tourne.';
}

/** Les sévérités, du plus grave au moins grave — l'ordre de la file. */
export const ORDRE_SEVERITE: RemoteSeverity[] = ['critical', 'warning', 'info'];

/**
 * L'ordre de la file de travail.
 *
 * À traiter avant en cours, puis le plus grave, puis le plus récent. Ce n'est
 * pas un tri par date : une console triée par date seule enterre un incident
 * critique de ce matin sous vingt lignes d'information de cet après-midi.
 */
export function ordonner(incidents: Incident[]): Incident[] {
  const rangStatut: Record<IncidentStatus, number> = { new: 0, acknowledged: 1, resolved: 2 };
  return [...incidents].sort((a, b) => {
    const s = rangStatut[a.status] - rangStatut[b.status];
    if (s !== 0) return s;
    const sev = ORDRE_SEVERITE.indexOf(a.severity) - ORDRE_SEVERITE.indexOf(b.severity);
    if (sev !== 0) return sev;
    return (b.lastSeenAt || '').localeCompare(a.lastSeenAt || '');
  });
}

/**
 * LES NATURES QU'ON REFUSE DE FAIRE TAIRE
 * ═══════════════════════════════════════
 *
 * Miroir de `NATURES_INETOUFFABLES` (amn-api `src/tracker/incidents.js`), et
 * `check:supervision` refuse que les deux listes divergent.
 *
 * Pourquoi le poste en a besoin alors que le serveur refuse déjà : proposer
 * une case à cocher qui se fera refuser en 400 est une promesse qu'on ne tient
 * pas. L'écran doit dire NON lui-même, et dire pourquoi.
 *
 * Le raisonnement, lui, vit côté serveur : une indisponibilité n'est jamais un
 * faux positif au sens où on l'entend — soit le site répondait, soit il ne
 * répondait pas. Si la sonde se trompe, c'est la sonde qu'il faut corriger.
 */
export const NATURES_INETOUFFABLES: readonly string[] = [
  'availability_down',
  'availability_ping',
  'site_unreachable',
];

/**
 * La nature d'un incident qu'on peut proposer de faire taire, ou `null`.
 *
 * La PREMIÈRE étouffable, et une seule : dire « ce scanner commandé n'est pas
 * une attaque » ne dit rien de l'injection que la même adresse tentera demain.
 * Un incident qui ne porte que des natures inétouffables rend `null`, et
 * l'écran explique alors pourquoi plutôt que de masquer la case.
 */
export function natureEtouffable(kinds: readonly string[] | undefined): string | null {
  return (kinds ?? []).find((k) => k && !NATURES_INETOUFFABLES.includes(k)) ?? null;
}
