import React from 'react';
import { useSync } from '../state/SyncContext';

/**
 * Discreet live-sync status pill for the top bar. Reflects the amn-api
 * connection so the operator always knows whether their changes are being
 * shared in real time or held locally until reconnection.
 */
export function SyncStatusIndicator() {
  const { connectionStatus, pendingWrites, rejectedWrites } = useSync();

  const base = {
    online: { dot: 'bg-success', pulse: false, label: 'Synchronisé', title: 'Connecté à amn-api — changements partagés en temps réel.' },
    connecting: { dot: 'bg-warning', pulse: true, label: 'Connexion…', title: 'Connexion au serveur de synchronisation en cours.' },
    offline: { dot: 'bg-warning', pulse: true, label: 'Hors ligne', title: 'Serveur injoignable — vos changements sont gardés sur ce poste et renvoyés au prochain rattrapage : reconnexion, retour au premier plan, ou redémarrage.' },
    unconfigured: { dot: 'bg-text-muted', pulse: false, label: 'Local', title: 'Mode local (serveur de synchronisation non configuré).' },
  }[connectionStatus];

  /* Le chiffre remplace la promesse. Tant qu'une écriture attend, la
     pastille le dit — et si le serveur en a refusé, elle le dit aussi, en
     rouge : perdre en silence est ce que la file de reprise remplace. */
  const meta =
    rejectedWrites > 0
      ? {
          dot: 'bg-danger',
          pulse: false,
          label: `${rejectedWrites} refusé${rejectedWrites > 1 ? 's' : ''}`,
          title: `${rejectedWrites} changement(s) refusé(s) par le serveur après plusieurs essais. Ils sont conservés sur ce poste. ${base.title}`,
        }
      : pendingWrites > 0
        ? {
            dot: 'bg-warning',
            pulse: true,
            label: `${pendingWrites} en attente`,
            title: `${pendingWrites} changement(s) fait(s) hors ligne, en attente d’envoi au serveur. ${base.title}`,
          }
        : base;

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
