export type SiteStatus = 'online' | 'degraded' | 'offline';

export type SiteCategory =
  | 'e-commerce'
  | 'saas'
  | 'vitrine'
  | 'api'
  | 'portail'
  | 'blog';

export type AlertType =
  | 'brute-force'
  | 'injection'
  | 'payment-failed'
  | 'traffic-spike'
  | 'malware'
  | 'certificate';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  detail: string;
  /** ISO timestamp */
  timestamp: string;
}

export interface SiteAnalytics {
  /** Live active visitors right now */
  activeVisitors: number;
  /** Daily unique visitors over the last 7 days (oldest → newest) */
  visitors7d: number[];
  /** Daily unique visitors over the last 30 days (oldest → newest) */
  visitors30d: number[];
  /** Revenue generated today, in euros */
  revenueToday: number;
  /** Revenue generated this month, in euros */
  revenueMonth: number;
  /** Revenue trend vs. previous period, as a percentage (can be negative) */
  revenueTrendPct: number;
}

export interface Site {
  id: string;
  name: string;
  url: string;
  category: SiteCategory;
  status: SiteStatus;
  uptimePercentage: number;
  /** ISO timestamp of the last heartbeat/scan */
  lastCheckedAt: string;
  openVulnerabilities: number;
  /** Short uptime trend used for the card sparkline */
  trend: number[];
  analytics: SiteAnalytics;
  alerts: Alert[];
}
