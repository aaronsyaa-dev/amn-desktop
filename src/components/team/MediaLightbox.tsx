import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';

export interface LightboxImage {
  key: string;
  src: string;
  name: string;
}

interface LightboxValue {
  /** Open the viewer on the image identified by its gallery key. */
  openKey: (key: string) => void;
}

const LightboxContext = createContext<LightboxValue | undefined>(undefined);

/**
 * Fullscreen image viewer (Bloc 1.1). The whole conversation's images form one
 * gallery so the ← / → keys page through every image in the thread, not just
 * the clicked message's. Closes on Échap, the ✕, or a click on the backdrop.
 */
export function LightboxProvider({
  gallery,
  children,
}: {
  gallery: LightboxImage[];
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);

  const openKey = useCallback(
    (key: string) => {
      const i = gallery.findIndex((g) => g.key === key);
      if (i >= 0) setIndex(i);
    },
    [gallery],
  );

  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(() => setIndex((i) => (i === null ? i : (i - 1 + gallery.length) % gallery.length)), [gallery.length]);
  const next = useCallback(() => setIndex((i) => (i === null ? i : (i + 1) % gallery.length)), [gallery.length]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, close, prev, next]);

  const value = useMemo(() => ({ openKey }), [openKey]);
  const current = index !== null ? gallery[index] : null;

  return (
    <LightboxContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {current && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 p-6"
            onClick={close}
          >
            {/* Top bar */}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-5 py-4">
              <span className="min-w-0 truncate font-mono text-[11px] uppercase tracking-widest text-white/60">
                {current.name || 'Image'}
                {gallery.length > 1 && index !== null && (
                  <span className="ml-2 text-white/40">
                    {index + 1} / {gallery.length}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                <a
                  href={current.src}
                  download={current.name || 'image'}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Télécharger l'image"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Download size={17} strokeWidth={1.75} />
                </a>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fermer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X size={19} strokeWidth={2} />
                </button>
              </div>
            </div>

            {gallery.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Image précédente"
                className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
              >
                <ChevronLeft size={22} strokeWidth={2} />
              </button>
            )}

            <motion.img
              key={current.key}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              src={current.src}
              alt={current.name || 'Image'}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />

            {gallery.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Image suivante"
                className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
              >
                <ChevronRight size={22} strokeWidth={2} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </LightboxContext.Provider>
  );
}

export function useLightbox(): LightboxValue {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error('useLightbox must be used within a LightboxProvider');
  return ctx;
}
