import type { Alert, Site, SiteAnalytics } from '../types/site';

const NOW = Date.now();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Timestamp helper: `ago(2 * HOUR)` → ISO string two hours before now. */
function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

/**
 * Small deterministic PRNG (mulberry32) so visitor curves are realistic and
 * stable across renders without shipping hundreds of hand-written numbers.
 */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a `days`-long series around `base` with a gentle overall `trend`
 * (fractional change end-to-end) plus day-to-day noise.
 */
function series(seed: number, days: number, base: number, trend: number): number[] {
  const rand = seeded(seed);
  return Array.from({ length: days }, (_, i) => {
    const progress = i / (days - 1);
    const drift = base * trend * progress;
    const noise = (rand() - 0.5) * base * 0.18;
    const weekend = [0, 6].includes((i + 3) % 7) ? -base * 0.12 : 0;
    return Math.max(0, Math.round(base + drift + noise + weekend));
  });
}

function analytics(
  seed: number,
  opts: {
    activeVisitors: number;
    base: number;
    trend: number;
    revenueToday: number;
    revenueMonth: number;
    revenueTrendPct: number;
  },
): SiteAnalytics {
  const visitors30d = series(seed, 30, opts.base, opts.trend);
  return {
    activeVisitors: opts.activeVisitors,
    visitors7d: visitors30d.slice(-7),
    visitors30d,
    revenueToday: opts.revenueToday,
    revenueMonth: opts.revenueMonth,
    revenueTrendPct: opts.revenueTrendPct,
  };
}

export const mockSites: Site[] = [
  {
    id: 'site-1',
    name: 'Nova Store',
    url: 'https://shop.novastore.io',
    category: 'e-commerce',
    status: 'online',
    uptimePercentage: 99.98,
    lastCheckedAt: ago(42 * 1000),
    openVulnerabilities: 0,
    trend: [99.7, 99.8, 99.9, 99.85, 99.95, 99.97, 99.98],
    analytics: analytics(101, {
      activeVisitors: 342,
      base: 8200,
      trend: 0.22,
      revenueToday: 12480,
      revenueMonth: 318900,
      revenueTrendPct: 14.2,
    }),
    alerts: [
      {
        id: 'a-1-1',
        type: 'traffic-spike',
        severity: 'info',
        title: 'Pic de trafic',
        detail: 'Trafic +180% suite à la campagne newsletter.',
        timestamp: ago(35 * MINUTE),
      },
      {
        id: 'a-1-2',
        type: 'payment-failed',
        severity: 'warning',
        title: 'Paiements refusés en série',
        detail: '7 paiements refusés par le PSP en 5 minutes.',
        timestamp: ago(3 * HOUR),
      },
      {
        id: 'a-1-3',
        type: 'brute-force',
        severity: 'warning',
        title: 'Tentatives de connexion',
        detail: '124 échecs de login depuis 3 IP (Brésil).',
        timestamp: ago(9 * HOUR),
      },
      {
        id: 'a-1-4',
        type: 'certificate',
        severity: 'info',
        title: 'Certificat TLS renouvelé',
        detail: 'Let’s Encrypt renouvelé automatiquement.',
        timestamp: ago(2 * DAY),
      },
      {
        id: 'a-1-5',
        type: 'traffic-spike',
        severity: 'info',
        title: 'Pic de trafic',
        detail: 'Affluence inhabituelle sur /soldes.',
        timestamp: ago(3 * DAY),
      },
    ],
  },
  {
    id: 'site-2',
    name: 'Atlas Analytics',
    url: 'https://app.atlas-analytics.com',
    category: 'saas',
    status: 'online',
    uptimePercentage: 99.91,
    lastCheckedAt: ago(1.2 * MINUTE),
    openVulnerabilities: 1,
    trend: [99.6, 99.7, 99.8, 99.88, 99.9, 99.89, 99.91],
    analytics: analytics(202, {
      activeVisitors: 1287,
      base: 15400,
      trend: 0.31,
      revenueToday: 8940,
      revenueMonth: 251200,
      revenueTrendPct: 9.6,
    }),
    alerts: [
      {
        id: 'a-2-1',
        type: 'injection',
        severity: 'critical',
        title: 'Injection SQL bloquée',
        detail: 'Payload `UNION SELECT` bloqué par le WAF sur /api/reports.',
        timestamp: ago(1 * HOUR),
      },
      {
        id: 'a-2-2',
        type: 'brute-force',
        severity: 'warning',
        title: 'Bourrage d’identifiants',
        detail: '2 300 tentatives sur l’endpoint OAuth en 10 min.',
        timestamp: ago(6 * HOUR),
      },
      {
        id: 'a-2-3',
        type: 'traffic-spike',
        severity: 'info',
        title: 'Montée en charge',
        detail: 'Auto-scaling déclenché (4 → 9 instances).',
        timestamp: ago(11 * HOUR),
      },
      {
        id: 'a-2-4',
        type: 'malware',
        severity: 'warning',
        title: 'Dépendance vulnérable',
        detail: 'CVE-2026-1288 détectée dans une librairie transitive.',
        timestamp: ago(28 * HOUR),
      },
      {
        id: 'a-2-5',
        type: 'injection',
        severity: 'info',
        title: 'Scan automatisé',
        detail: 'Sonde XSS ignorée (entrées échappées).',
        timestamp: ago(4 * DAY),
      },
    ],
  },
  {
    id: 'site-3',
    name: 'Meridian Corp',
    url: 'https://www.meridian-corp.fr',
    category: 'vitrine',
    status: 'online',
    uptimePercentage: 100,
    lastCheckedAt: ago(2.4 * MINUTE),
    openVulnerabilities: 0,
    trend: [99.9, 99.95, 100, 100, 99.98, 100, 100],
    analytics: analytics(303, {
      activeVisitors: 58,
      base: 1900,
      trend: 0.05,
      revenueToday: 0,
      revenueMonth: 0,
      revenueTrendPct: 0,
    }),
    alerts: [
      {
        id: 'a-3-1',
        type: 'traffic-spike',
        severity: 'info',
        title: 'Trafic référencement',
        detail: 'Hausse organique +22% cette semaine.',
        timestamp: ago(5 * HOUR),
      },
      {
        id: 'a-3-2',
        type: 'certificate',
        severity: 'info',
        title: 'Certificat TLS',
        detail: 'Expiration dans 74 jours — OK.',
        timestamp: ago(6 * DAY),
      },
      {
        id: 'a-3-3',
        type: 'brute-force',
        severity: 'info',
        title: 'Scan /wp-admin',
        detail: 'Sondes automatisées bloquées (site statique).',
        timestamp: ago(8 * DAY),
      },
    ],
  },
  {
    id: 'site-4',
    name: 'Ledger Pay API',
    url: 'https://api.ledgerpay.co',
    category: 'api',
    status: 'degraded',
    uptimePercentage: 97.3,
    lastCheckedAt: ago(18 * 1000),
    openVulnerabilities: 3,
    trend: [99.4, 99.1, 98.6, 98.0, 97.8, 97.5, 97.3],
    analytics: analytics(404, {
      activeVisitors: 4102,
      base: 42000,
      trend: -0.08,
      revenueToday: 41230,
      revenueMonth: 1184000,
      revenueTrendPct: -4.3,
    }),
    alerts: [
      {
        id: 'a-4-1',
        type: 'payment-failed',
        severity: 'critical',
        title: 'Taux d’échec paiements élevé',
        detail: 'Échecs à 8.4% (seuil 2%) — latence PSP suspectée.',
        timestamp: ago(22 * MINUTE),
      },
      {
        id: 'a-4-2',
        type: 'traffic-spike',
        severity: 'warning',
        title: 'Latence p95 dégradée',
        detail: 'p95 à 1 240 ms sur /v2/charges.',
        timestamp: ago(48 * MINUTE),
      },
      {
        id: 'a-4-3',
        type: 'injection',
        severity: 'critical',
        title: 'Injection détectée',
        detail: 'Tentative NoSQL sur /v2/customers, bloquée.',
        timestamp: ago(2 * HOUR),
      },
      {
        id: 'a-4-4',
        type: 'brute-force',
        severity: 'warning',
        title: 'Clés API abusées',
        detail: 'Rate-limit atteint pour 12 clés en 1h.',
        timestamp: ago(5 * HOUR),
      },
      {
        id: 'a-4-5',
        type: 'malware',
        severity: 'critical',
        title: 'Vulnérabilité critique',
        detail: 'CVE-2026-0442 (RCE) exploitable — patch requis.',
        timestamp: ago(14 * HOUR),
      },
      {
        id: 'a-4-6',
        type: 'payment-failed',
        severity: 'warning',
        title: 'Webhooks en retard',
        detail: 'File d’attente webhooks > 3 min.',
        timestamp: ago(20 * HOUR),
      },
      {
        id: 'a-4-7',
        type: 'certificate',
        severity: 'info',
        title: 'Certificat mutualisé mis à jour',
        detail: 'Rotation mTLS effectuée.',
        timestamp: ago(2 * DAY),
      },
    ],
  },
  {
    id: 'site-5',
    name: 'Client Hub',
    url: 'https://portail.clienthub.app',
    category: 'portail',
    status: 'online',
    uptimePercentage: 99.72,
    lastCheckedAt: ago(3.1 * MINUTE),
    openVulnerabilities: 1,
    trend: [99.5, 99.6, 99.65, 99.7, 99.68, 99.71, 99.72],
    analytics: analytics(505, {
      activeVisitors: 214,
      base: 6100,
      trend: 0.12,
      revenueToday: 3210,
      revenueMonth: 92400,
      revenueTrendPct: 6.1,
    }),
    alerts: [
      {
        id: 'a-5-1',
        type: 'brute-force',
        severity: 'warning',
        title: 'Attaque par force brute',
        detail: '540 tentatives sur /login depuis un botnet.',
        timestamp: ago(52 * MINUTE),
      },
      {
        id: 'a-5-2',
        type: 'traffic-spike',
        severity: 'info',
        title: 'Pic de connexions',
        detail: 'Afflux en début de mois (facturation).',
        timestamp: ago(7 * HOUR),
      },
      {
        id: 'a-5-3',
        type: 'malware',
        severity: 'warning',
        title: 'Fichier suspect uploadé',
        detail: 'Upload `.php` bloqué et mis en quarantaine.',
        timestamp: ago(26 * HOUR),
      },
      {
        id: 'a-5-4',
        type: 'certificate',
        severity: 'info',
        title: 'HSTS activé',
        detail: 'En-tête Strict-Transport-Security déployé.',
        timestamp: ago(3 * DAY),
      },
    ],
  },
  {
    id: 'site-6',
    name: 'DevSec Blog',
    url: 'https://blog.amn-devsec.com',
    category: 'blog',
    status: 'offline',
    uptimePercentage: 89.6,
    lastCheckedAt: ago(6 * MINUTE),
    openVulnerabilities: 2,
    trend: [98.4, 97.1, 95.0, 93.2, 91.5, 90.4, 89.6],
    analytics: analytics(606, {
      activeVisitors: 0,
      base: 3400,
      trend: -0.35,
      revenueToday: 0,
      revenueMonth: 1450,
      revenueTrendPct: -38.0,
    }),
    alerts: [
      {
        id: 'a-6-1',
        type: 'malware',
        severity: 'critical',
        title: 'Site hors ligne',
        detail: 'Réponse 502 depuis 6 min — origine injoignable.',
        timestamp: ago(6 * MINUTE),
      },
      {
        id: 'a-6-2',
        type: 'injection',
        severity: 'critical',
        title: 'Compromission suspectée',
        detail: 'Modification non autorisée de wp-config détectée.',
        timestamp: ago(38 * MINUTE),
      },
      {
        id: 'a-6-3',
        type: 'brute-force',
        severity: 'warning',
        title: 'Force brute XML-RPC',
        detail: '1 800 requêtes /xmlrpc.php en 15 min.',
        timestamp: ago(2 * HOUR),
      },
      {
        id: 'a-6-4',
        type: 'traffic-spike',
        severity: 'warning',
        title: 'Trafic anormal',
        detail: 'Pic soudain avant l’indisponibilité (DDoS ?).',
        timestamp: ago(3 * HOUR),
      },
      {
        id: 'a-6-5',
        type: 'certificate',
        severity: 'warning',
        title: 'Certificat expiré',
        detail: 'Le certificat TLS a expiré il y a 2 jours.',
        timestamp: ago(2 * DAY),
      },
      {
        id: 'a-6-6',
        type: 'malware',
        severity: 'critical',
        title: 'Injection de code détectée',
        detail: 'Scripts malveillants trouvés dans le thème.',
        timestamp: ago(4 * DAY),
      },
    ],
  },
];

export function getSiteById(id: string): Site | undefined {
  return mockSites.find((site) => site.id === id);
}

/** All alerts across sites, newest first, with their originating site attached. */
export function getGlobalAlerts(): Array<Alert & { site: Site }> {
  return mockSites
    .flatMap((site) => site.alerts.map((alert) => ({ ...alert, site })))
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}
