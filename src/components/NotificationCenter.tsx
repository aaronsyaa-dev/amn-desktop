import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { ALERT_SEVERITY_CONFIG } from '../lib/alerts';
import { remoteEventDetail, remoteEventIcon, remoteEventLabel } from '../lib/remoteEventDisplay';
import { relativeTime } from '../lib/time';
import { useSitePanel } from './site-panel/SitePanelContext';
import type { RemoteEvent } from '../shared/api';
import { useLangue } from '../i18n';

export function NotificationCenter() {
  const { t } = useLangue();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { openSite } = useSitePanel();
  const { sites, eventsBySite, ensureEventsLoaded } = useRemoteSites();

  // Cross-site feed needs each site's event history loaded.
  useEffect(() => {
    for (const site of sites) ensureEventsLoaded(site.id);
  }, [sites, ensureEventsLoaded]);

  const alerts = useMemo(() => {
    const withSite: Array<{ site: (typeof sites)[number]; event: RemoteEvent }> = [];
    for (const site of sites) {
      const events = eventsBySite[site.id] ?? [];
      for (const event of events) {
        if (event.type === 'security_alert' && event.severity && event.severity !== 'info') {
          withSite.push({ site, event });
        }
      }
    }
    return withSite
      .sort(
        (a, b) => new Date(b.event.occurredAt).getTime() - new Date(a.event.occurredAt).getTime(),
      )
      .slice(0, 12);
  }, [sites, eventsBySite]);

  const criticalCount = useMemo(
    () => alerts.filter((a) => a.event.severity === 'critical').length,
    [alerts],
  );

  const handleSelect = (siteId: string) => {
    setIsOpen(false);
    navigate('/sites');
    openSite(siteId);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={t('chrome.notifications')}
        // 44 px au pouce sous `md`, 36 px au pointeur ensuite — même règle que
        // les autres boutons de cette barre.
        className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors duration-200 hover:text-text-primary md:h-9 md:w-9"
      >
        <Bell size={17} strokeWidth={1.75} />
        {criticalCount > 0 && (
          <span /*
              Mesurée 42 fois sur les écrans : du blanc sur `--color-danger`
              donne 3,46, sous les 4,5 exigés. `--color-danger-fill` est le
              même rouge d'un cran plus sombre — 4,66 — et le signal reste le
              signal.
            */
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-fill px-1 text-[10px] font-semibold text-white">
            {criticalCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <button
              type="button"
              aria-label="Fermer les notifications"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute right-0 top-11 z-50 w-96 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-text-primary">
                  {t('chrome.notifications')}
                </p>
                <span className="text-xs text-text-muted">
                  {criticalCount} critique{criticalCount > 1 ? 's' : ''}
                </span>
              </div>
              <div className="max-h-[22rem] overflow-y-auto">
                {alerts.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-text-secondary">
                    Aucune alerte pour l’instant.
                  </p>
                ) : (
                  alerts.map(({ site, event }) => {
                    const severity = ALERT_SEVERITY_CONFIG[event.severity ?? 'info'];
                    const Icon = remoteEventIcon(event);
                    const detail = remoteEventDetail(event);
                    return (
                      <button
                        key={`${site.id}-${event.id}`}
                        type="button"
                        onClick={() => handleSelect(site.id)}
                        className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors duration-150 last:border-b-0 hover:bg-surface-hover"
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${severity.bg} ${severity.text}`}
                        >
                          <Icon size={14} strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-text-primary">
                              {remoteEventLabel(event)}
                            </p>
                            <time className="flex-shrink-0 text-xs text-text-muted">
                              {relativeTime(event.occurredAt)}
                            </time>
                          </div>
                          <p className="truncate text-xs text-text-secondary">
                            {site.name}
                            {detail ? ` · ${detail}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
