import type { Site } from '../types/site';

export const mockSites: Site[] = [
  {
    id: 'site-1',
    name: 'Portail Client',
    url: 'https://portail.example.com',
    status: 'online',
    uptimePercentage: 99.98,
    lastCheckedAt: '2026-07-23T06:00:00Z',
    openVulnerabilities: 0,
    trend: [98.2, 98.9, 99.1, 99.4, 99.6, 99.9, 99.98],
  },
  {
    id: 'site-2',
    name: 'API Facturation',
    url: 'https://api-facturation.example.com',
    status: 'degraded',
    uptimePercentage: 97.2,
    lastCheckedAt: '2026-07-23T05:45:00Z',
    openVulnerabilities: 2,
    trend: [99.5, 99.1, 98.4, 97.9, 98.2, 97.6, 97.2],
  },
  {
    id: 'site-3',
    name: 'Site Vitrine',
    url: 'https://www.example.com',
    status: 'offline',
    uptimePercentage: 91.4,
    lastCheckedAt: '2026-07-23T05:30:00Z',
    openVulnerabilities: 1,
    trend: [99.0, 97.8, 96.1, 94.5, 93.0, 92.1, 91.4],
  },
];

export function getSiteById(id: string): Site | undefined {
  return mockSites.find((site) => site.id === id);
}
