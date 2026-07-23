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
  },
  {
    id: 'site-2',
    name: 'API Facturation',
    url: 'https://api-facturation.example.com',
    status: 'degraded',
    uptimePercentage: 97.2,
    lastCheckedAt: '2026-07-23T05:45:00Z',
    openVulnerabilities: 2,
  },
  {
    id: 'site-3',
    name: 'Site Vitrine',
    url: 'https://www.example.com',
    status: 'offline',
    uptimePercentage: 91.4,
    lastCheckedAt: '2026-07-23T05:30:00Z',
    openVulnerabilities: 1,
  },
];

export function getSiteById(id: string): Site | undefined {
  return mockSites.find((site) => site.id === id);
}
