export type SiteStatus = 'online' | 'degraded' | 'offline';

export interface Site {
  id: string;
  name: string;
  url: string;
  status: SiteStatus;
  uptimePercentage: number;
  lastCheckedAt: string;
  openVulnerabilities: number;
  trend: number[];
}
