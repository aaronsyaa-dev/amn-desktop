import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, RefreshCw, X } from 'lucide-react';
import { bridge } from '../lib/bridge';

/**
 * Partie 5 — the "update ready" step, in-app and terminal-free.
 *
 * The Squirrel auto-updater downloads and stages new versions automatically in
 * the background (see src/main/updater.ts). When one is ready, the main process
 * notifies us and we show this polished panel instead of Electron's stock
 * dialog: a single click on « Redémarrer et installer » relaunches into the new
 * version — no command line, ever. The detailed "what's new" list is shown
 * right after the relaunch by UpdateNotice, which reads the new build's
 * changelog.
 */
export function UpdateReady() {
  const [info, setInfo] = useState<{ version: string; notes?: string } | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const off = bridge().updates.onDownloaded((next) => setInfo(next));
    return off;
  }, []);

  if (!info) return null;

  const install = () => {
    setInstalling(true);
    bridge().updates.install();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, x: 20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 right-6 z-[195] w-80 max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
            <Download size={16} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Mise à jour prête</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Version {info.version}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInfo(null)}
            aria-label="Plus tard"
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:text-text-primary"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>

        <div className="px-4 py-3">
          <p className="text-xs text-text-secondary">
            {info.notes?.trim()
              ? info.notes.trim().slice(0, 200)
              : 'Une nouvelle version a été téléchargée et est prête à s’installer. Le détail des nouveautés s’affichera après le redémarrage.'}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={install}
              disabled={installing}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {installing ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} strokeWidth={2} />
              )}
              {installing ? 'Redémarrage…' : 'Redémarrer et installer'}
            </button>
            <button
              type="button"
              onClick={() => setInfo(null)}
              className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            >
              Plus tard
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
