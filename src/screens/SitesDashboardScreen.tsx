import React from 'react';
import { Link } from 'react-router-dom';
import { mockSites } from '../data/mockSites';
import type { SiteStatus } from '../types/site';
import './SitesDashboardScreen.css';

const STATUS_LABELS: Record<SiteStatus, string> = {
  online: 'En ligne',
  degraded: 'Dégradé',
  offline: 'Hors ligne',
};

export function SitesDashboardScreen() {
  return (
    <section>
      <h1>Sites surveillés</h1>
      <table className="sites-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>URL</th>
            <th>Statut</th>
            <th>Disponibilité</th>
            <th>Vulnérabilités ouvertes</th>
          </tr>
        </thead>
        <tbody>
          {mockSites.map((site) => (
            <tr key={site.id}>
              <td>
                <Link to={`/sites/${site.id}`}>{site.name}</Link>
              </td>
              <td>{site.url}</td>
              <td>
                <span className={`status-badge status-${site.status}`}>
                  {STATUS_LABELS[site.status]}
                </span>
              </td>
              <td>{site.uptimePercentage}%</td>
              <td>{site.openVulnerabilities}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
