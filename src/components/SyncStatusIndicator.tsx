import React from 'react';
import { useSync } from '../state/SyncContext';

/**
 * Discreet live-sync status pill for the top bar. Reflects the amn-api
 * connection so the operator always knows whether their changes are being
 * shared in real time or held locally until reconnection.
 */
export function SyncStatusIndicator() {
  const { connectionStatus } = useSync();

  const meta = {
    online: { dot: 'bg-success', pulse: false, label: 'Synchronisé', title: 'Connecté à amn-api — changements partagés en temps réel.' },
    connecting: { dot: 'bg-warning', pulse: true, label: 'Connexion…', title: 'Connexion au serveur de synchronisation en cours.' },
    offline: { dot: 'bg-warning', pulse: true, label: 'Hors ligne', title: 'Serveur injoignable — vos changements sont enregistrés localement et se resynchroniseront automatiquement au retour de la connexion.' },
    unconfigured: { dot: 'bg-text-muted', pulse: false, label: 'Local', title: 'Mode local (serveur de synchronisation non configuré).' },
  }[connectionStatus];

  return (
    <span
      title={meta.title}
      className="inline-flex items-center gap-1.5 border border-border bg-surface px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary sm:px-2.5"
    >
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${meta.dot} ${meta.pulse ? 'animate-pulse' : ''}`} />
      {/* Label hidden on the narrowest screens — the coloured dot alone carries
          the status there (full text returns at sm+). */}
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
}
