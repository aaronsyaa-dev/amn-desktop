import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { CHANGELOG, changesSince, type ChangelogEntry } from '../data/changelog';
import { APP_VERSION } from '../edition/edition';
import { useFermetureEchap } from '../lib/useFermetureEchap';

const LAST_SEEN_KEY = 'amn.lastSeenVersion';

function readLastSeen(): string | null {
  try {
    return window.localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function markSeen(version: string): void {
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, version);
  } catch {
    /* ignore */
  }
}

/**
 * Resolves the running app version. In Electron we ask the main process
 * (`package.json` version); in the browser fallback we trust the changelog's
 * first entry (which the release process keeps in step with package.json).
 */
async function resolveVersion(): Promise<string> {
  try {
    const info = await bridge().system.getAppInfo();
    if (info?.version && info.version !== '0.0.0-dev') return info.version;
  } catch {
    /* fall through to changelog */
  }
  return APP_VERSION;
}

/**
 * On the first launch after an update, shows a "Nouvelle mise à jour" panel
 * listing what changed since the version the user last saw. First-ever launch
 * shows nothing (we just record the current version). Fully local — the
 * changelog ships with the app (see src/data/changelog.ts).
 */
export function UpdateNotice() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  const [version, setVersion] = useState<string>(APP_VERSION);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await resolveVersion();
      if (cancelled) return;
      const lastSeen = readLastSeen();

      if (lastSeen === null) {
        // First install (or first run since this feature shipped): don't nag,
        // just remember where we are.
        markSeen(current);
        return;
      }
      if (lastSeen === current) return;

      const fresh = changesSince(lastSeen);
      // Mark seen straight away so the notice only ever appears once per update,
      // even if the user closes it without interacting.
      markSeen(current);
      if (fresh.length === 0) return;

      setVersion(current);
      setEntries(fresh);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => setEntries(null);

  /*
    Le bandeau des nouveautés couvre l'écran au premier lancement d'une
    version. Échap le referme : c'est une information, pas une décision, et
    rien ne justifie d'obliger à viser une croix pour reprendre son travail.
  */
  useFermetureEchap(Boolean(entries && entries.length > 0), dismiss);

  return (
    <AnimatePresence>
      {entries && entries.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
          onClick={dismiss}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Nouvelle mise à jour"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface elev-3"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Fermer"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="border-b border-border px-6 py-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg">
                  <Sparkles className="h-4 w-4 text-text-primary" />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-text-primary">
                    Nouvelle mise à jour
                  </h2>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
                    Version {version}
                  </p>
                </div>
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-6 py-5">
              {entries.map((entry) => (
                <div key={entry.version} className="mb-5 last:mb-0">
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="font-mono text-sm font-semibold text-text-primary">
                      {entry.version}
                    </span>
                    {entry.title && (
                      <span className="text-sm text-text-secondary">— {entry.title}</span>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {entry.changes.map((change, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-text-secondary">
                        <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border px-6 py-4">
              <p className="text-xs text-text-muted">
                Historique complet dans Paramètres → À propos.
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg border border-border bg-bg px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
              >
                Compris
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Re-export so callers (e.g. the About screen) have a single import surface.
export { CHANGELOG };
