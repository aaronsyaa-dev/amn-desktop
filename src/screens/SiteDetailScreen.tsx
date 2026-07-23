import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getSiteById } from '../data/mockSites';
import { StatusBadge } from '../components/StatusBadge';

export function SiteDetailScreen() {
  const { siteId } = useParams<{ siteId: string }>();
  const site = siteId ? getSiteById(siteId) : undefined;

  if (!site) {
    return <Navigate to="/sites" replace />;
  }

  const fields = [
    { label: 'URL', value: site.url },
    { label: 'Disponibilité', value: `${site.uptimePercentage}%` },
    { label: 'Vulnérabilités ouvertes', value: site.openVulnerabilities },
    {
      label: 'Dernière vérification',
      value: new Date(site.lastCheckedAt).toLocaleString('fr-FR'),
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <Link
        to="/sites"
        className="flex w-fit items-center gap-1.5 text-sm text-text-secondary transition-colors duration-200 hover:text-text-primary"
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        Retour au dashboard
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-text-primary">{site.name}</h1>
          <StatusBadge status={site.status} />
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs text-text-secondary">{field.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-text-primary">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
