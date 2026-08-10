import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Pin, PinOff, X } from 'lucide-react';
import type { SpaceKey } from '../data/navigation';
import { sectionsForSpace } from '../data/spaces';
import { useNavFavorites } from '../state/useNavFavorites';

/**
 * The module launcher (BLOC C).
 *
 * The sidebar can no longer hold every screen — it grew a row per product and
 * had started to scroll. It now shows a short pinned strip; everything else
 * lives here, as a grid, opened from one button.
 *
 * Two surfaces, one behaviour: an overlay panel anchored under the launcher on
 * desktop, a bottom sheet on mobile. Both animate in the same way and are
 * dismissed the same way — outside click, Escape, or the close button.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

/** Staggered reveal: the grid assembles instead of appearing all at once. */
const GRID = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.018, delayChildren: 0.04 } },
};
const TILE = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: EASE } },
};

export function AppLauncher({
  open,
  onClose,
  space = 'workspace',
}: {
  open: boolean;
  onClose: () => void;
  /**
   * L'espace dont on ouvre la grille. Le lanceur ne montre jamais les deux à
   * la fois : ce serait remettre dans une même surface exactement ce que la
   * séparation en espaces vient de démêler.
   */
  space?: SpaceKey;
}) {
  const location = useLocation();
  const { isFavorite, toggleFavorite } = useNavFavorites();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes, and focus moves into the panel so the keyboard has somewhere
  // to land — a grid you can only leave with the mouse is not "fluide".
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const timer = window.setTimeout(() => panelRef.current?.focus(), 60);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <AnimatePresence>
      {open && (
        <React.Fragment key="launcher">
          {/* Outside click closes. The blur is what makes the panel read as a
              layer above the app rather than another pane inside it. */}
          <motion.div
            key="launcher-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-[2px]"
            aria-hidden
          />

          <motion.div
            key="launcher-panel"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Tous les modules"
            // Mobile: rises from the bottom edge like a sheet.
            // Desktop (sm+): slides in from the sidebar and fades, anchored left.
            initial={{ opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.99 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="fixed inset-x-0 bottom-0 z-[151] max-h-[82vh] overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 elev-3 outline-none sm:inset-x-auto sm:bottom-auto sm:left-[max(5rem,4.5vw)] sm:top-1/2 sm:max-h-[80vh] sm:w-[min(46rem,calc(100vw-8rem))] sm:-translate-y-1/2 sm:rounded-2xl sm:p-6"
          >
            {/* Sheet grabber — mobile only, the affordance people expect. */}
            <span
              className="mx-auto mb-4 block h-1 w-10 rounded-full bg-border-strong sm:hidden"
              aria-hidden
            />

            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-text-primary">Tous les modules</h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                  Épinglez ceux que vous ouvrez tous les jours
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <motion.div variants={GRID} initial="hidden" animate="shown" className="flex flex-col gap-6">
              {sectionsForSpace(space).map((section) => (
                <div key={section.key}>
                  <p className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.25em] text-text-muted">
                    {section.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const pinned = isFavorite(item.key);
                      return (
                        <motion.div key={item.key} variants={TILE} className="group relative">
                          <Link
                            to={item.to}
                            onClick={onClose}
                            className={`elev-hover flex h-full flex-col gap-2 rounded-xl border p-3 transition-colors duration-200 ${
                              isActive(item.to)
                                ? 'border-border-strong bg-accent-muted'
                                : 'border-border bg-bg hover:border-border-strong hover:bg-surface-hover'
                            }`}
                          >
                            <span className="text-text-primary transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5">
                              <Icon size={22} strokeWidth={1.5} />
                            </span>
                            <span className="text-sm font-medium leading-tight text-text-primary">
                              {item.label}
                            </span>
                            <span className="text-[11px] leading-snug text-text-muted">{item.hint}</span>
                          </Link>
                          {/* Pinning is what keeps the sidebar short AND personal:
                              the strip is a choice, not a fixed list. */}
                          <button
                            type="button"
                            onClick={() => toggleFavorite(item.key)}
                            aria-label={pinned ? `Détacher ${item.label}` : `Épingler ${item.label}`}
                            title={pinned ? 'Détacher de la barre' : 'Épingler à la barre'}
                            className={`absolute right-1.5 top-1.5 rounded-md p-1.5 transition-colors ${
                              pinned
                                ? 'text-accent hover:text-text-primary'
                                : 'text-transparent hover:bg-white/5 hover:text-text-secondary group-hover:text-text-muted'
                            }`}
                          >
                            {pinned ? (
                              <Pin size={13} strokeWidth={2} />
                            ) : (
                              <PinOff size={13} strokeWidth={2} />
                            )}
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
