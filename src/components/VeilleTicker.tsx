import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Newspaper } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useAssistant } from '../assistant/AssistantContext';
import type { WatchItem } from '../shared/api';

/**
 * Thin, continuously-scrolling veille ticker for the Accueil (Bloc 2).
 *
 * Shows the latest watch headlines already fetched by the RSS system. Clicking
 * one opens Ajmani straight on the Veille tab. Renders NOTHING when there's no
 * data yet (RSS still loading, or the web build where veille is desktop-only) —
 * no ugly empty state. The scroll is pure CSS (a duplicated track translated
 * -50%), so it stays smooth and cheap; it pauses on hover for readability.
 */
export function VeilleTicker() {
  const { open } = useAssistant();
  const [items, setItems] = useState<WatchItem[]>([]);

  useEffect(() => {
    let active = true;
    bridge()
      .watch.list()
      .then((r) => active && setItems(r.items.slice(0, 20)))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (items.length === 0) return null;

  // Duplicate the list so the -50% translation loops seamlessly. Speed scales
  // with the number of headlines to keep a readable, constant pace.
  const loop = [...items, ...items];
  const durationMs = Math.max(30000, items.length * 4500);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="amn-ticker-wrap relative mt-8 flex items-center gap-2 overflow-hidden rounded-full border border-border bg-surface/60 py-1.5 pl-3 pr-1"
    >
      <style>{`
        @keyframes amn-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .amn-ticker-track { animation: amn-ticker linear infinite; }
        .amn-ticker-wrap:hover .amn-ticker-track { animation-play-state: paused; }
      `}</style>

      <span className="z-10 flex flex-shrink-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-text-muted">
        <Newspaper size={11} strokeWidth={2} />
        Veille
      </span>
      {/* Fade the left edge under the label. */}
      <span className="pointer-events-none absolute left-14 top-0 z-[5] h-full w-6 bg-gradient-to-r from-bg to-transparent" />

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div
          className="amn-ticker-track flex w-max items-center gap-6 whitespace-nowrap"
          style={{ animationDuration: `${durationMs}ms` }}
        >
          {loop.map((it, i) => (
            <button
              key={`${it.id}-${i}`}
              type="button"
              onClick={() => open('watch')}
              className="flex items-center gap-2 text-xs text-text-secondary transition-colors hover:text-text-primary"
              title={it.summary || it.title}
            >
              <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">{it.source}</span>
              <span className="max-w-[38ch] truncate">{it.title}</span>
              <span aria-hidden className="text-text-muted">·</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
