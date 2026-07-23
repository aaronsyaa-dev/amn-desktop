import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ShieldAlert, TriangleAlert, XCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { mockSites } from '../data/mockSites';

export function HomeScreen() {
  const { user } = useAuth();

  const onlineCount = mockSites.filter((s) => s.status === 'online').length;
  const degradedCount = mockSites.filter((s) => s.status === 'degraded').length;
  const offlineCount = mockSites.filter((s) => s.status === 'offline').length;
  const totalVulnerabilities = mockSites.reduce(
    (sum, s) => sum + s.openVulnerabilities,
    0,
  );

  const stats = [
    {
      label: 'Sites en ligne',
      value: onlineCount,
      icon: CheckCircle2,
      color: 'text-success',
    },
    {
      label: 'Sites dégradés',
      value: degradedCount,
      icon: TriangleAlert,
      color: 'text-warning',
    },
    {
      label: 'Sites hors ligne',
      value: offlineCount,
      icon: XCircle,
      color: 'text-danger',
    },
    {
      label: 'Vulnérabilités ouvertes',
      value: totalVulnerabilities,
      icon: ShieldAlert,
      color: 'text-accent',
    },
  ];

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Bienvenue, {user?.email}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Vous supervisez actuellement {mockSites.length} site(s).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
            >
              <Icon size={20} strokeWidth={1.75} className={stat.color} />
              <p className="mt-3 text-2xl font-bold text-text-primary">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-text-secondary">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <Link
        to="/sites"
        className="w-fit text-sm font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
      >
        Voir le dashboard des sites →
      </Link>
    </section>
  );
}
