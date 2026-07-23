import type { Alert, AlertType, Site } from '../types/site';
import { mockSites } from '../data/mockSites';
import { compactEuro, euro } from '../lib/time';
import type { BlockTone, ReportBlock, ReportMode } from './types';

interface ReportDraft {
  title: string;
  subtitle: string;
  blocks: ReportBlock[];
}

const STATUS_LABEL: Record<Site['status'], string> = {
  online: 'en ligne',
  degraded: 'dégradé',
  offline: 'hors ligne',
};

/** Technical, actionable remediation per alert type (internal reports). */
const TECH_RECOMMENDATION: Record<AlertType, string> = {
  'brute-force':
    'Renforcer la protection anti-bourrage : rate-limiting par IP, MFA obligatoire et CAPTCHA adaptatif sur les endpoints d’authentification.',
  injection:
    'Auditer les requêtes paramétrées et durcir les règles WAF (OWASP CRS) ; ajouter des tests de non-régression sur les entrées à risque.',
  'payment-failed':
    'Investiguer la latence côté PSP, activer le retry avec back-off et alerter dès 2 % de taux d’échec sur les transactions.',
  'traffic-spike':
    'Vérifier les seuils d’auto-scaling et la configuration CDN/anti-DDoS pour absorber les pics sans dégradation.',
  malware:
    'Isoler les artefacts suspects, lancer un scan complet et appliquer les correctifs de sécurité en attente en priorité.',
  certificate:
    'Automatiser le renouvellement des certificats (ACME) et superviser leur date d’expiration à J-30.',
};

/** Reassuring, jargon-free outcome per alert type (client reports). */
const CLIENT_OUTCOME: Record<AlertType, string> = {
  'brute-force':
    'Nous avons détecté et bloqué des tentatives de connexion non autorisées visant votre site.',
  injection:
    'Des tentatives d’intrusion ont été automatiquement interceptées avant tout impact.',
  'payment-failed':
    'Nous avons surveillé de près vos paiements et signalé les anomalies pour éviter toute perte.',
  'traffic-spike':
    'Une hausse inhabituelle de fréquentation a été absorbée sans interruption de service.',
  malware:
    'Nous avons repéré et mis en quarantaine des éléments suspects afin de protéger vos visiteurs.',
  certificate:
    'Nous veillons à ce que la connexion à votre site reste sécurisée et vérifiée en permanence.',
};

function trendWord(trend: number[]): string {
  if (trend.length < 2) return 'stable';
  const delta = trend[trend.length - 1] - trend[0];
  if (delta > 0.3) return 'en amélioration';
  if (delta < -0.3) return 'en dégradation';
  return 'stable';
}

function uptimeQualifier(uptime: number): string {
  if (uptime >= 99.9) return 'excellent';
  if (uptime >= 99) return 'très bon';
  if (uptime >= 97) return 'correct mais perfectible';
  return 'insuffisant';
}

function countBySeverity(alerts: Alert[]) {
  return {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  };
}

function statusTone(status: Site['status']): BlockTone {
  return status === 'online'
    ? 'success'
    : status === 'degraded'
      ? 'warning'
      : 'danger';
}

/** Unique alert types present, most severe alerts first. */
function distinctTypes(alerts: Alert[]): AlertType[] {
  const order = { critical: 0, warning: 1, info: 2 };
  const seen = new Set<AlertType>();
  return [...alerts]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .map((a) => a.type)
    .filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
}

function buildSiteInternalReport(site: Site): ReportDraft {
  const sev = countBySeverity(site.alerts);
  const types = distinctTypes(site.alerts);
  const trend = trendWord(site.trend);

  const criticalAlerts = site.alerts.filter((a) => a.severity !== 'info');

  return {
    title: `Rapport de supervision — ${site.name}`,
    subtitle: 'Usage interne · vue technique',
    blocks: [
      { type: 'heading', text: 'Synthèse' },
      {
        type: 'paragraph',
        text: `Le site ${site.name} (${site.url}) est actuellement ${STATUS_LABEL[site.status]}. Sur la période analysée, la disponibilité s’établit à ${site.uptimePercentage} % (tendance ${trend}), avec ${site.openVulnerabilities} vulnérabilité(s) ouverte(s) et ${sev.critical} incident(s) critique(s) sur ${site.alerts.length} événements de sécurité enregistrés.`,
      },
      {
        type: 'kpis',
        items: [
          {
            label: 'Disponibilité',
            value: `${site.uptimePercentage} %`,
            tone: statusTone(site.status),
          },
          {
            label: 'Visiteurs actifs',
            value: site.analytics.activeVisitors.toLocaleString('fr-FR'),
          },
          {
            label: 'CA du mois',
            value: compactEuro(site.analytics.revenueMonth),
          },
          {
            label: 'Vulnérabilités',
            value: String(site.openVulnerabilities),
            tone: site.openVulnerabilities > 0 ? 'warning' : 'success',
          },
        ],
      },
      { type: 'heading', text: 'Disponibilité & performance' },
      {
        type: 'paragraph',
        text: `La disponibilité mesurée (${site.uptimePercentage} %) est jugée ${uptimeQualifier(site.uptimePercentage)}. La tendance récente est ${trend}. Le site traite actuellement ${site.analytics.activeVisitors.toLocaleString('fr-FR')} visiteurs actifs ; le chiffre d’affaires du jour atteint ${euro(site.analytics.revenueToday)} (${site.analytics.revenueTrendPct >= 0 ? '+' : ''}${site.analytics.revenueTrendPct} % vs période précédente).`,
      },
      { type: 'heading', text: 'Incidents de sécurité' },
      {
        type: 'paragraph',
        text: `${site.alerts.length} événements ont été enregistrés : ${sev.critical} critique(s), ${sev.warning} alerte(s) et ${sev.info} informationnel(s). Les incidents les plus notables :`,
      },
      {
        type: 'list',
        items: criticalAlerts
          .slice(0, 5)
          .map((a) => `${a.title} — ${a.detail}`),
      },
      { type: 'heading', text: 'Recommandations' },
      {
        type: 'list',
        items:
          types.length > 0
            ? types.map((t) => TECH_RECOMMENDATION[t])
            : ['Aucune action urgente. Maintenir la supervision continue.'],
      },
    ],
  };
}

function buildSiteClientReport(site: Site): ReportDraft {
  const types = distinctTypes(site.alerts);
  const blockedCount = site.alerts.filter((a) => a.severity !== 'info').length;
  const reassuringStatus =
    site.status === 'offline'
      ? 'fait actuellement l’objet d’une intervention de nos équipes'
      : site.status === 'degraded'
        ? 'est surveillé de près suite à quelques ralentissements'
        : 'fonctionne normalement';

  return {
    title: `Bilan sécurité & performance — ${site.name}`,
    subtitle: 'À transmettre au client · langage clair',
    blocks: [
      { type: 'heading', text: 'En résumé' },
      {
        type: 'paragraph',
        text: `Votre site ${site.name} ${reassuringStatus}. Il est supervisé en continu par nos équipes, 24h/24. Sa disponibilité est de ${site.uptimePercentage} %, un niveau ${uptimeQualifier(site.uptimePercentage)}, et nous avons veillé à la sécurité de vos visiteurs tout au long de la période.`,
      },
      {
        type: 'kpis',
        items: [
          {
            label: 'Disponibilité',
            value: `${site.uptimePercentage} %`,
            tone: statusTone(site.status),
          },
          {
            label: 'Visiteurs accueillis',
            value: site.analytics.activeVisitors.toLocaleString('fr-FR'),
          },
          {
            label: 'Menaces écartées',
            value: String(blockedCount),
            tone: 'success',
          },
        ],
      },
      { type: 'heading', text: 'Ce que nous avons fait pour vous' },
      {
        type: 'list',
        items: [
          'Surveillance de votre site en continu, jour et nuit.',
          ...types.slice(0, 4).map((t) => CLIENT_OUTCOME[t]),
        ],
      },
      { type: 'heading', text: 'Nos recommandations' },
      {
        type: 'list',
        items:
          site.status === 'online' && site.openVulnerabilities === 0
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

export function buildSiteReport(site: Site, mode: ReportMode): ReportDraft {
  return mode === 'client'
    ? buildSiteClientReport(site)
    : buildSiteInternalReport(site);
}

export function buildGlobalReport(mode: ReportMode): ReportDraft {
  const online = mockSites.filter((s) => s.status === 'online').length;
  const degraded = mockSites.filter((s) => s.status === 'degraded').length;
  const offline = mockSites.filter((s) => s.status === 'offline').length;
  const totalVulns = mockSites.reduce((n, s) => n + s.openVulnerabilities, 0);
  const totalRevenue = mockSites.reduce(
    (n, s) => n + s.analytics.revenueMonth,
    0,
  );
  const criticalAcross = mockSites.flatMap((s) =>
    s.alerts
      .filter((a) => a.severity === 'critical')
      .map((a) => ({ site: s, alert: a })),
  );

  if (mode === 'client') {
    return {
      title: 'Bilan global de votre parc',
      subtitle: 'À transmettre au client · langage clair',
      blocks: [
        { type: 'heading', text: 'En résumé' },
        {
          type: 'paragraph',
          text: `Sur l’ensemble de vos ${mockSites.length} sites, ${online} fonctionnent normalement. Nos équipes supervisent la totalité de votre parc en continu et interviennent dès qu’un point de vigilance apparaît.`,
        },
        {
          type: 'kpis',
          items: [
            { label: 'Sites opérationnels', value: `${online}/${mockSites.length}`, tone: 'success' },
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
        text: `Parc de ${mockSites.length} sites : ${online} en ligne, ${degraded} dégradé(s), ${offline} hors ligne. ${totalVulns} vulnérabilité(s) ouverte(s) au total et ${criticalAcross.length} incident(s) critique(s) actif(s). CA mensuel cumulé : ${euro(totalRevenue)}.`,
      },
      {
        type: 'kpis',
        items: [
          { label: 'En ligne', value: String(online), tone: 'success' },
          { label: 'Dégradés', value: String(degraded), tone: 'warning' },
          { label: 'Hors ligne', value: String(offline), tone: 'danger' },
          { label: 'Vulnérabilités', value: String(totalVulns), tone: totalVulns > 0 ? 'warning' : 'success' },
        ],
      },
      { type: 'heading', text: 'Incidents critiques à traiter' },
      {
        type: 'list',
        items:
          criticalAcross.length > 0
            ? criticalAcross
                .slice(0, 6)
                .map(({ site, alert }) => `${site.name} — ${alert.title} : ${alert.detail}`)
            : ['Aucun incident critique en cours.'],
      },
      { type: 'heading', text: 'Priorités recommandées' },
      {
        type: 'list',
        items: buildGlobalPriorities(),
      },
    ],
  };
}

function buildGlobalPriorities(): string[] {
  const priorities: string[] = [];
  const offline = mockSites.filter((s) => s.status === 'offline');
  const withCriticalCve = mockSites.filter((s) =>
    s.alerts.some((a) => a.type === 'malware' && a.severity === 'critical'),
  );
  const degraded = mockSites.filter((s) => s.status === 'degraded');

  offline.forEach((s) =>
    priorities.push(`Rétablir ${s.name} : site hors ligne, impact direct sur le service.`),
  );
  withCriticalCve.forEach((s) =>
    priorities.push(`Appliquer en urgence les correctifs de sécurité sur ${s.name}.`),
  );
  degraded.forEach((s) =>
    priorities.push(`Stabiliser ${s.name} : performances dégradées à surveiller.`),
  );

  return priorities.length > 0
    ? priorities
    : ['Maintenir la supervision ; aucun point bloquant identifié.'];
}
