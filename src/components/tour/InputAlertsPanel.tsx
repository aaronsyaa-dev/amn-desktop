import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { relativeTime } from '../../lib/time';
import type { InputAlert } from '../../shared/api';

/**
 * TENTATIVES D'INJECTION — la sentinelle des entrées, vue de la Tour (Bloc 5).
 *
 * Chaque ligne est une détection dans un champ saisi chez une cliente :
 * injection SQL, XSS, traversée de chemin, injection de commande. La requête
 * est passée (la défense est ailleurs : SQL paramétré, texte rendu comme
 * texte) ; ce qu'on lit ici, c'est QUI a tenté QUOI, et CHEZ QUI. C'est
 * notre métier, transformé en fonctionnalité.
 */

const FAMILLE: Record<InputAlert['family'], string> = {
  sql_injection: 'Injection SQL',
  xss: 'Script injecté',
  path_traversal: 'Traversée de chemin',
  command_injection: 'Injection de commande',
};

export function InputAlertsPanel() {
  const [alertes, setAlertes] = useState<InputAlert[] | null>(null);

  const charger = useCallback(async () => {
    try {
      setAlertes(await bridge().remote.admin.inputAlerts({ limit: 30 }));
    } catch {
      setAlertes([]);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    const surAlerte = bridge().remote.onInputAlert;
    return surAlerte ? surAlerte(() => void charger()) : undefined;
  }, [charger]);

  if (!alertes || alertes.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <p className="eyebrow mb-1 flex items-center gap-2">
        <ShieldAlert size={13} strokeWidth={1.75} />
        Tentatives d’injection · {alertes.length}
      </p>
      <p className="mb-3 text-xs leading-relaxed text-text-muted">
        Détectées dans un champ saisi, enregistrées comme du texte, jamais exécutées. Chaque ligne dit
        qui a tenté quoi, et chez qui.
      </p>
      <ul className="flex flex-col gap-px bg-border">
        {alertes.map((a) => (
          <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 bg-surface px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-text-primary">
                <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-text-secondary">{FAMILLE[a.family] ?? a.family}</span>
                {a.orgName ?? 'Hors organisation'}
              </p>
              <p className="text-[11px] text-text-muted">
                {a.userEmail ?? 'sans compte'} · {a.ip ?? 'ip inconnue'} · {a.route} · champ {a.field}
              </p>
              <p className="mt-1 max-w-prose break-all font-mono text-[11px] leading-relaxed text-text-secondary">{a.sample}</p>
            </div>
            <time className="flex-shrink-0 font-mono text-[10px] uppercase tracking-widest text-text-muted">{relativeTime(a.createdAt)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}
