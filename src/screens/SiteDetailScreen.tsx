import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getSiteById } from '../data/mockSites';

export function SiteDetailScreen() {
  const { siteId } = useParams<{ siteId: string }>();
  const site = siteId ? getSiteById(siteId) : undefined;

  if (!site) {
    return <Navigate to="/sites" replace />;
  }

  return (
    <section>
      <p>
        <Link to="/sites">← Retour au dashboard</Link>
      </p>
      <h1>{site.name}</h1>
      <dl>
        <dt>URL</dt>
        <dd>{site.url}</dd>
        <dt>Statut</dt>
        <dd>{site.status}</dd>
        <dt>Disponibilité</dt>
        <dd>{site.uptimePercentage}%</dd>
        <dt>Vulnérabilités ouvertes</dt>
        <dd>{site.openVulnerabilities}</dd>
        <dt>Dernière vérification</dt>
        <dd>{new Date(site.lastCheckedAt).toLocaleString('fr-FR')}</dd>
      </dl>
    </section>
  );
}
