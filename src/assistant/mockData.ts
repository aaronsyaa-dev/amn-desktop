import { mockSites } from '../data/mockSites';
import type {
  DailySummary,
  Insight,
  Suggestion,
  WatchItem,
} from './types';

function trendDelta(trend: number[]): number {
  return trend.length >= 2 ? trend[trend.length - 1] - trend[0] : 0;
}

/**
 * Free-text "daily brief" for the home QG: what happened since last visit and
 * what to focus on today. Grounded in the current mock state. Written to read
 * like a short human/AI briefing (used with a typewriter reveal in the UI).
 */
export function getDailyBrief(): string {
  const offline = mockSites.filter((s) => s.status === 'offline');
  const criticalCount = mockSites.reduce(
    (n, s) => n + s.alerts.filter((a) => a.severity === 'critical').length,
    0,
  );
  const flawless = mockSites.filter((s) => s.uptimePercentage >= 99.9);
  const rising = [...mockSites].sort(
    (a, b) => b.analytics.revenueTrendPct - a.analytics.revenueTrendPct,
  )[0];
  const criticalCve = mockSites.find((s) =>
    s.alerts.some((a) => a.type === 'malware' && a.severity === 'critical'),
  );

  const parts: string[] = [];
  parts.push(
    `Depuis votre dernière visite, ${criticalCount} incident(s) critique(s) ont été détectés sur votre parc.`,
  );
  if (offline.length > 0) {
    parts.push(`${offline.map((s) => s.name).join(', ')} nécessite une intervention immédiate.`);
  }
  parts.push(
    `Côté positif, le trafic de ${rising.name} progresse (${rising.analytics.revenueTrendPct >= 0 ? '+' : ''}${rising.analytics.revenueTrendPct} %) et ${flawless.length} site(s) affichent une disponibilité irréprochable.`,
  );
  const focus = [
    ...offline.map((s) => `rétablir ${s.name}`),
    ...(criticalCve ? [`appliquer le correctif critique sur ${criticalCve.name}`] : []),
  ];
  parts.push(
    focus.length > 0
      ? `Aujourd’hui, concentrez-vous sur : ${focus.join(' et ')}.`
      : `Aucune urgence aujourd’hui — bonne occasion pour traiter la dette de sécurité de fond.`,
  );
  return parts.join(' ');
}

/**
 * Automatic insights — surfaced even when nothing is wrong, so there is always
 * something worthwhile to read. Mixes positive signals with gentle nudges.
 */
export function getInsights(): Insight[] {
  const insights: Insight[] = [];

  const rising = [...mockSites].sort(
    (a, b) => trendDelta(b.trend) - trendDelta(a.trend),
  )[0];
  if (rising && trendDelta(rising.trend) > 0) {
    insights.push({
      id: 'insight-traffic',
      tone: 'positive',
      title: `Tendance en hausse sur ${rising.name}`,
      body: `La disponibilité de ${rising.name} s’améliore régulièrement (${rising.analytics.revenueTrendPct >= 0 ? '+' : ''}${rising.analytics.revenueTrendPct} % de CA). Bon momentum à capitaliser.`,
      siteId: rising.id,
    });
  }

  const flawless = mockSites.filter((s) => s.uptimePercentage >= 99.9);
  if (flawless.length > 0) {
    insights.push({
      id: 'insight-uptime',
      tone: 'positive',
      title: `${flawless.length} site(s) sans le moindre incident de disponibilité`,
      body: `${flawless.map((s) => s.name).join(', ')} maintiennent une disponibilité ≥ 99,9 %. Votre supervision porte ses fruits.`,
    });
  }

  const blocked = mockSites.reduce(
    (n, s) => n + s.alerts.filter((a) => a.severity !== 'info').length,
    0,
  );
  insights.push({
    id: 'insight-security',
    tone: 'neutral',
    title: `${blocked} menaces interceptées cette semaine`,
    body: `Vos défenses ont bloqué ${blocked} événements de sécurité (force brute, injections, uploads suspects) sur l’ensemble du parc.`,
  });

  return insights.slice(0, 3);
}


/** Today at ~07:15 local — simulates a summary that "arrived this morning". */
function thisMorningISO(): string {
  const d = new Date();
  d.setHours(7, 15, 0, 0);
  return d.toISOString();
}

export function getDailySummary(): DailySummary {
  const online = mockSites.filter((s) => s.status === 'online').length;
  const offline = mockSites.filter((s) => s.status === 'offline');
  const degraded = mockSites.filter((s) => s.status === 'degraded');
  const totalVulns = mockSites.reduce((n, s) => n + s.openVulnerabilities, 0);
  const overnightCritical = mockSites.flatMap((s) =>
    s.alerts.filter((a) => a.severity === 'critical').map((a) => ({ s, a })),
  );

  const attention = [...offline, ...degraded]
    .map((s) => s.name)
    .join(', ');

  return {
    generatedAt: thisMorningISO(),
    headline: `${online}/${mockSites.length} sites opérationnels · ${overnightCritical.length} incident(s) critique(s) durant la nuit`,
    blocks: [
      {
        type: 'paragraph',
        text: `Bonjour. Voici votre point de situation du matin. Sur vos ${mockSites.length} sites, ${online} sont pleinement opérationnels. ${
          attention
            ? `Points de vigilance : ${attention}.`
            : 'Aucun point de vigilance majeur.'
        }`,
      },
      {
        type: 'kpis',
        items: [
          { label: 'Opérationnels', value: `${online}/${mockSites.length}`, tone: 'success' },
          {
            label: 'Incidents nuit',
            value: String(overnightCritical.length),
            tone: overnightCritical.length > 0 ? 'danger' : 'success',
          },
          {
            label: 'Vulnérabilités',
            value: String(totalVulns),
            tone: totalVulns > 0 ? 'warning' : 'success',
          },
        ],
      },
      { type: 'heading', text: 'À traiter en priorité' },
      {
        type: 'list',
        items:
          overnightCritical.length > 0
            ? overnightCritical
                .slice(0, 4)
                .map(({ s, a }) => `${s.name} — ${a.title} : ${a.detail}`)
            : ['Rien d’urgent ce matin. Bonne journée !'],
      },
    ],
  };
}

/** Derives proactive suggestions from the current mock state of the parc. */
export function getSuggestions(): Suggestion[] {
  const suggestions: Suggestion[] = [];

  mockSites.forEach((site) => {
    const criticalCve = site.alerts.find(
      (a) => a.type === 'malware' && a.severity === 'critical',
    );
    if (criticalCve) {
      suggestions.push({
        id: `sugg-cve-${site.id}`,
        title: `Patcher une vulnérabilité critique sur ${site.name}`,
        detail: criticalCve.detail,
        severity: 'critical',
        siteId: site.id,
      });
    }
    if (site.status === 'offline') {
      suggestions.push({
        id: `sugg-offline-${site.id}`,
        title: `Rétablir ${site.name}`,
        detail: 'Le site est hors ligne : vérifier l’origine et relancer le service.',
        severity: 'critical',
        siteId: site.id,
      });
    }
    if (site.alerts.some((a) => a.type === 'brute-force')) {
      suggestions.push({
        id: `sugg-bf-${site.id}`,
        title: `Renforcer l’authentification de ${site.name}`,
        detail: 'Attaques par force brute détectées : envisager MFA + rate-limiting.',
        severity: 'warning',
        siteId: site.id,
      });
    }
  });

  // Most severe first, keep it focused.
  const order = { critical: 0, warning: 1, info: 2 };
  return suggestions
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, 5);
}

/** Mock cyber/AI/Anthropic watch feed. Plausible, fictional content. */
export function getWatchItems(): WatchItem[] {
  return [
    {
      id: 'watch-1',
      category: 'Vulnérabilité',
      title: 'CVE-2026-0442 : exécution de code à distance dans une passerelle de paiement répandue',
      summary:
        'Une faille critique (CVSS 9.8) affecte plusieurs SDK de paiement. Un correctif est disponible ; l’application immédiate est recommandée pour tout service transactionnel.',
      source: 'Bulletin CERT-FR',
      date: '2026-07-22',
    },
    {
      id: 'watch-2',
      category: 'Cybersécurité',
      title: 'Hausse de 40 % des campagnes de credential stuffing sur les portails B2B',
      summary:
        'Les botnets ciblent en priorité les endpoints d’authentification OAuth. Le MFA et la limitation de débit restent les contre-mesures les plus efficaces.',
      source: 'Rapport trimestriel — ANSSI',
      date: '2026-07-21',
    },
    {
      id: 'watch-3',
      category: 'Anthropic',
      title: 'Anthropic publie de nouveaux garde-fous pour les agents autonomes',
      summary:
        'Les dernières recommandations couvrent l’isolation des outils, la journalisation des actions et la validation humaine des opérations sensibles — pertinent pour l’automatisation de la supervision.',
      source: 'Blog Anthropic',
      date: '2026-07-20',
    },
    {
      id: 'watch-4',
      category: 'IA',
      title: 'L’IA générative accélère la rédaction de rapports d’incident',
      summary:
        'De plus en plus d’équipes SOC s’appuient sur des modèles pour produire des post-mortems et des synthèses client, réduisant le temps de reporting de plusieurs heures à quelques minutes.',
      source: 'The Hacker News',
      date: '2026-07-19',
    },
    {
      id: 'watch-5',
      category: 'Cybersécurité',
      title: 'Fin de vie de TLS 1.1 : derniers rappels pour la mise en conformité',
      summary:
        'Les navigateurs durcissent leurs exigences. Vérifier la configuration des certificats et l’activation de HSTS sur l’ensemble des domaines exposés.',
      source: 'Mozilla Security',
      date: '2026-07-18',
    },
  ];
}
