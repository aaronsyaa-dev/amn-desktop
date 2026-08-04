import type { RemoteEvent, RemoteSeverity } from '../shared/api';
import type { DerivedSite } from '../state/RemoteSitesContext';
import type { DerivedStatus } from '../lib/siteStatus';
import { remoteEventDetail, remoteEventLabel } from '../lib/remoteEventDisplay';
import { relativeTime } from '../lib/time';
import type { BlockTone, ReportBlock, ReportMode } from './types';

interface ReportDraft {
  title: string;
  subtitle: string;
  blocks: ReportBlock[];
}

const STATUS_LABEL: Record<DerivedStatus, string> = {
  online: 'en ligne',
  degraded: 'dégradé',
  offline: 'hors ligne',
  unknown: 'sans donnée récente',
};

/** Technical, actionable remediation per event pattern (internal reports). */
const TECH_RECOMMENDATION: Record<string, string> = {
  'brute-force':
    'Renforcer la protection anti-bourrage : rate-limiting par IP, MFA obligatoire et CAPTCHA adaptatif sur les endpoints d’authentification.',
  injection:
    'Auditer les requêtes paramétrées et durcir les règles WAF (OWASP CRS) ; ajouter des tests de non-régression sur les entrées à risque.',
  'payment-failed':
    'Investiguer la latence côté PSP, activer le retry avec back-off et alerter dès 2 % de taux d’échec sur les transactions.',
  offline: 'Vérifier l’origine indisponible, le processus applicatif et les logs serveur ; relancer le service.',
};

/** Reassuring, jargon-free outcome per event pattern (client reports). */
const CLIENT_OUTCOME: Record<string, string> = {
  'brute-force':
    'Nous avons détecté et bloqué des tentatives de connexion non autorisées visant votre site.',
  injection:
    'Des tentatives d’intrusion ont été automatiquement interceptées avant tout impact.',
  'payment-failed':
    'Nous avons surveillé de près vos paiements et signalé les anomalies pour éviter toute perte.',
  offline: 'Nos équipes interviennent pour rétablir le service au plus vite.',
};

/** Classifies a security_alert event into a coarse pattern key for the maps above. */
function classify(event: RemoteEvent): string {
  const pattern = event.payload?.pattern;
  if (typeof pattern === 'string') {
    if (pattern.startsWith('sql') || pattern === 'nosql-operator') return 'injection';
    return pattern;
  }
  if (event.message?.includes('Force brute')) return 'brute-force';
  return 'other';
}

function countBySeverity(events: RemoteEvent[]) {
  return {
    critical: events.filter((e) => e.severity === 'critical').length,
    warning: events.filter((e) => e.severity === 'warning').length,
    info: events.filter((e) => e.severity === 'info').length,
  };
}

function statusTone(status: DerivedStatus): BlockTone {
  if (status === 'online') return 'success';
  if (status === 'degraded') return 'warning';
  if (status === 'offline') return 'danger';
  return 'default';
}

/** Unique alert patterns present, most severe first. */
function distinctPatterns(alerts: RemoteEvent[]): string[] {
  const order: Record<RemoteSeverity, number> = { critical: 0, warning: 1, info: 2 };
  const seen = new Set<string>();
  return [...alerts]
    .sort((a, b) => order[a.severity ?? 'info'] - order[b.severity ?? 'info'])
    .map(classify)
    .filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
}

function buildSiteInternalReport(site: DerivedSite, events: RemoteEvent[]): ReportDraft {
  const alerts = events.filter((e) => e.type === 'security_alert');
  const sev = countBySeverity(alerts);
  const patterns = distinctPatterns(alerts);
  const activeVisitors = site.state?.activeVisitors ?? 0;
  const lastSeen = site.state?.lastSeenAt;

  if (site.status === 'offline') {
    patterns.unshift('offline');
  }

  return {
    title: `Rapport de supervision — ${site.name}`,
    subtitle: 'Usage interne · vue technique',
    blocks: [
      { type: 'heading', text: 'Synthèse' },
      {
        type: 'paragraph',
        text: `Le site ${site.name} (#${site.id.slice(0, 8)}) est actuellement ${STATUS_LABEL[site.status]}. Dernier heartbeat ${lastSeen ? relativeTime(lastSeen) : 'jamais reçu'}. Sur les ${events.length} derniers événements enregistrés, ${sev.critical} sont critiques et ${sev.warning} constituent une alerte.`,
      },
      {
        type: 'kpis',
        items: [
          { label: 'Statut', value: site.status, tone: statusTone(site.status) },
          { label: 'Visiteurs actifs', value: activeVisitors.toLocaleString('fr-FR') },
          {
            label: 'Alertes (historique chargé)',
            value: String(alerts.length),
            tone: alerts.length > 0 ? 'warning' : 'success',
          },
        ],
      },
      { type: 'heading', text: 'Incidents de sécurité' },
      alerts.length > 0
        ? {
            type: 'paragraph' as const,
            text: `${alerts.length} événements de sécurité enregistrés : ${sev.critical} critique(s), ${sev.warning} alerte(s) et ${sev.info} informationnel(s). Les plus notables :`,
          }
        : { type: 'paragraph' as const, text: 'Aucun incident de sécurité enregistré sur la période chargée.' },
      ...(alerts.length > 0
        ? ([
            {
              type: 'list',
              items: alerts
                .slice(0, 5)
                .map((a) => `${remoteEventLabel(a)} — ${remoteEventDetail(a) || 'détail non précisé'}`),
            },
          ] as ReportBlock[])
        : []),
      { type: 'heading', text: 'Recommandations' },
      {
        type: 'list',
        items:
          patterns.length > 0
            ? patterns.map((p) => TECH_RECOMMENDATION[p] ?? `Analyser les événements de type « ${p} ».`)
            : ['Aucune action urgente. Maintenir la supervision continue.'],
      },
    ],
  };
}

function buildSiteClientReport(site: DerivedSite, events: RemoteEvent[]): ReportDraft {
  const alerts = events.filter((e) => e.type === 'security_alert' && e.severity !== 'info');
  const patterns = distinctPatterns(alerts);
  const activeVisitors = site.state?.activeVisitors ?? 0;
  const reassuringStatus =
    site.status === 'offline'
      ? 'fait actuellement l’objet d’une intervention de nos équipes'
      : site.status === 'degraded'
        ? 'est surveillé de près suite à quelques ralentissements'
        : 'fonctionne normalement';

  return {
    title: `Bilan sécurité — ${site.name}`,
    subtitle: 'À transmettre au client · langage clair',
    blocks: [
      { type: 'heading', text: 'En résumé' },
      {
        type: 'paragraph',
        text: `Votre site ${site.name} ${reassuringStatus}. Il est supervisé en continu par nos équipes, 24h/24, et nous avons veillé à la sécurité de vos visiteurs tout au long de la période.`,
      },
      {
        type: 'kpis',
        items: [
          { label: 'Statut', value: site.status, tone: statusTone(site.status) },
          { label: 'Visiteurs accueillis', value: activeVisitors.toLocaleString('fr-FR') },
          { label: 'Menaces écartées', value: String(alerts.length), tone: 'success' },
        ],
      },
      { type: 'heading', text: 'Ce que nous avons fait pour vous' },
      {
        type: 'list',
        items: [
          'Surveillance de votre site en continu, jour et nuit.',
          ...patterns.slice(0, 4).map((p) => CLIENT_OUTCOME[p] ?? 'Vos données ont été surveillées et sécurisées.'),
        ],
      },
      { type: 'heading', text: 'Nos recommandations' },
      {
        type: 'list',
        items:
          site.status === 'online' && alerts.length === 0
            ? [
                'Aucune action n’est requise de votre part : tout est sous contrôle.',
                'Nous continuons la surveillance et vous alertons au moindre imprévu.',
              ]
            : [
                'Nos équipes appliquent les mesures nécessaires ; aucune démarche de votre part n’est requise dans l’immédiat.',
                'Nous restons disponibles pour faire un point avec vous quand vous le souhaitez.',
              ],
      },
      {
        type: 'paragraph',
        text: 'Votre tranquillité est notre priorité. N’hésitez pas à nous solliciter pour toute question.',
      },
    ],
  };
}

export function buildSiteReport(
  site: DerivedSite,
  events: RemoteEvent[],
  mode: ReportMode,
): ReportDraft {
  return mode === 'client'
    ? buildSiteClientReport(site, events)
    : buildSiteInternalReport(site, events);
}

export function buildGlobalReport(
  sites: DerivedSite[],
  eventsBySite: Record<string, RemoteEvent[]>,
  mode: ReportMode,
): ReportDraft {
  const online = sites.filter((s) => s.status === 'online').length;
  const degraded = sites.filter((s) => s.status === 'degraded').length;
  const offline = sites.filter((s) => s.status === 'offline').length;

  const criticalAcross = sites.flatMap((site) =>
    (eventsBySite[site.id] ?? [])
      .filter((e) => e.type === 'security_alert' && e.severity === 'critical')
      .map((event) => ({ site, event })),
  );

  if (mode === 'client') {
    return {
      title: 'Bilan global de votre parc',
      subtitle: 'À transmettre au client · langage clair',
      blocks: [
        { type: 'heading', text: 'En résumé' },
        {
          type: 'paragraph',
          text: `Sur l’ensemble de vos ${sites.length} sites, ${online} fonctionnent normalement. Nos équipes supervisent la totalité de votre parc en continu et interviennent dès qu’un point de vigilance apparaît.`,
        },
        {
          type: 'kpis',
          items: [
            { label: 'Sites opérationnels', value: `${online}/${sites.length}`, tone: 'success' },
            { label: 'Menaces écartées', value: String(criticalAcross.length), tone: 'success' },
            { label: 'Surveillance', value: '24/7' },
          ],
        },
        { type: 'heading', text: 'Notre engagement' },
        {
          type: 'list',
          items: [
            'Supervision permanente de tous vos sites, sans interruption.',
            'Détection et blocage automatiques des tentatives malveillantes.',
            'Intervention prioritaire de nos experts en cas d’incident.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Vous pouvez compter sur nous : votre présence en ligne est entre de bonnes mains.',
        },
      ],
    };
  }

  return {
    title: 'Rapport global du parc',
    subtitle: 'Usage interne · vue technique',
    blocks: [
      { type: 'heading', text: 'Synthèse' },
      {
        type: 'paragraph',
        text: `Parc de ${sites.length} sites : ${online} en ligne, ${degraded} dégradé(s), ${offline} hors ligne. ${criticalAcross.length} incident(s) critique(s) sur l’historique chargé.`,
      },
      {
        type: 'kpis',
        items: [
          { label: 'En ligne', value: String(online), tone: 'success' },
          { label: 'Dégradés', value: String(degraded), tone: 'warning' },
          { label: 'Hors ligne', value: String(offline), tone: 'danger' },
          {
            label: 'Incidents critiques',
            value: String(criticalAcross.length),
            tone: criticalAcross.length > 0 ? 'danger' : 'success',
          },
        ],
      },
      { type: 'heading', text: 'Incidents critiques à traiter' },
      {
        type: 'list',
        items:
          criticalAcross.length > 0
            ? criticalAcross
                .slice(0, 6)
                .map(
                  ({ site, event }) =>
                    `${site.name} — ${remoteEventLabel(event)} : ${remoteEventDetail(event) || 'détail non précisé'}`,
                )
            : ['Aucun incident critique en cours.'],
      },
      { type: 'heading', text: 'Priorités recommandées' },
      {
        type: 'list',
        items: buildGlobalPriorities(sites),
      },
    ],
  };
}

function buildGlobalPriorities(sites: DerivedSite[]): string[] {
  const priorities: string[] = [];
  const offline = sites.filter((s) => s.status === 'offline');
  const degraded = sites.filter((s) => s.status === 'degraded');

  offline.forEach((s) =>
    priorities.push(`Rétablir ${s.name} : site hors ligne, impact direct sur le service.`),
  );
  degraded.forEach((s) =>
    priorities.push(`Stabiliser ${s.name} : incident de sécurité récent à surveiller.`),
  );

  return priorities.length > 0
    ? priorities
    : ['Maintenir la supervision ; aucun point bloquant identifié.'];
}
