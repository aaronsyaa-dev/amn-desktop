import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { getGlobalAlerts } from '../data/mockSites';
import { ALERT_SEVERITY_CONFIG, ALERT_TYPE_CONFIG } from '../lib/alerts';
import { relativeTime } from '../lib/time';
import { useSitePanel } from './site-panel/SitePanelContext';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { openSite } = useSitePanel();

  // Cross-site feed limited to the alerts that actually warrant attention.
  const alerts = useMemo(
    () =>
      getGlobalAlerts()
        .filter((a) => a.severity !== 'info')
        .slice(0, 12),
    [],
  );
  const criticalCount = useMemo(
    () => alerts.filter((a) => a.severity === 'critical').length,
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
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors duration-200 hover:text-text-primary"
      >
        <Bell size={17} strokeWidth={1.75} />
        {criticalCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
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
                  Notifications
                </p>
                <span className="text-xs text-text-muted">
                  {criticalCount} critique{criticalCount > 1 ? 's' : ''}
                </span>
              </div>
              <div className="max-h-[22rem] overflow-y-auto">
                {alerts.map((alert) => {
                  const typeConfig = ALERT_TYPE_CONFIG[alert.type];
                  const severity = ALERT_SEVERITY_CONFIG[alert.severity];
                  const Icon = typeConfig.icon;
                  return (
                    <button
                      key={`${alert.site.id}-${alert.id}`}
                      type="button"
                      onClick={() => handleSelect(alert.site.id)}
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
                            {alert.title}
                          </p>
                          <time className="flex-shrink-0 text-xs text-text-muted">
                            {relativeTime(alert.timestamp)}
                          </time>
                        </div>
                        <p className="truncate text-xs text-text-secondary">
                          {alert.site.name} · {alert.detail}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
