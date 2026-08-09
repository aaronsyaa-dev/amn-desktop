import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Crosshair, X } from 'lucide-react';
import { captureAt, resolveMarkerPoint, type TaskMarker } from '../../lib/taskMarkers';
import { uid } from '../../state/SyncContext';
import { TagHighlight } from './TagHighlight';
import { NAV_ITEMS } from '../../data/navigation';

/**
 * Libellés lisibles des routes, servant d'intitulé par défaut à un repère.
 *
 * Dérivés des modules de l'édition construite plutôt que réécrits à la main :
 * une liste en dur redonnait « Tracker », « Décisions » et « Connaissances »
 * au bundle Business, pour des écrans qui n'y existent pas.
 */
const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.to, item.label]),
);

export function routeLabel(routeKey: string): string {
  return ROUTE_LABELS[routeKey] ?? routeKey;
}

interface TagContextValue {
  /** True while the operator is picking a spot for a new repère. */
  capturing: boolean;
  /** Enter capture mode; `onCaptured` receives the finished marker. */
  beginCapture: (onCaptured: (marker: TaskMarker) => void) => void;
  /** Abort capture mode without creating a marker. */
  cancelCapture: () => void;
  /** Navigate to a marker and pulse a highlight on its spot for ~2s. */
  showMarker: (marker: TaskMarker) => void;
}

const TagContext = createContext<TagContextValue | undefined>(undefined);

const PULSE_MS = 2000;

export function TagProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [capturing, setCapturing] = useState(false);
  const [pulse, setPulse] = useState<{ left: number; top: number } | null>(null);

  const onCapturedRef = useRef<((m: TaskMarker) => void) | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelCapture = useCallback(() => {
    onCapturedRef.current = null;
    setCapturing(false);
  }, []);

  const beginCapture = useCallback((onCaptured: (m: TaskMarker) => void) => {
    onCapturedRef.current = onCaptured;
    setCapturing(true);
  }, []);

  // While capturing: crosshair cursor + a document-level click interceptor.
  // Clicks in the sidebar (aside) or the banner pass through so the operator can
  // still navigate/cancel; a click anywhere in the content captures the spot.
  useEffect(() => {
    if (!capturing) return;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (document.querySelector('aside')?.contains(target)) return; // let nav work
      if (bannerRef.current?.contains(target)) return; // banner handles itself
      const point = captureAt(e.clientX, e.clientY);
      if (!point) return; // outside the content area
      e.preventDefault();
      e.stopPropagation();
      const routeKey = pathRef.current;
      const marker: TaskMarker = {
        id: uid('mark'),
        routeKey,
        xPct: point.xPct,
        yPct: point.yPct,
        elementId: point.elementId,
        label: routeLabel(routeKey),
        createdAt: new Date().toISOString(),
      };
      onCapturedRef.current?.(marker);
      cancelCapture();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelCapture();
    };

    document.addEventListener('click', onClick, true); // capture phase
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.cursor = prevCursor;
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [capturing, cancelCapture]);

  const showMarker = useCallback(
    (marker: TaskMarker) => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      const reveal = () => {
        const point = resolveMarkerPoint(marker);
        if (!point) return;
        setPulse(point);
        pulseTimer.current = setTimeout(() => setPulse(null), PULSE_MS);
      };
      if (location.pathname !== marker.routeKey) {
        navigate(marker.routeKey);
        // Let the destination screen mount + lay out before locating the spot.
        setTimeout(reveal, 320);
      } else {
        setTimeout(reveal, 60);
      }
    },
    [location.pathname, navigate],
  );

  useEffect(
    () => () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    },
    [],
  );

  const value = useMemo(
    () => ({ capturing, beginCapture, cancelCapture, showMarker }),
    [capturing, beginCapture, cancelCapture, showMarker],
  );

  return (
    <TagContext.Provider value={value}>
      {children}

      {/* Ghost tint over the whole window during capture (non-interactive). */}
      <AnimatePresence>
        {capturing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed inset-0 z-[220] bg-accent/[0.04] ring-2 ring-inset ring-accent/30"
          />
        )}
      </AnimatePresence>

      {/* Instruction banner (A4): "Veuillez cliquer l'endroit à indiquer". */}
      <AnimatePresence>
        {capturing && (
          <motion.div
            ref={bannerRef}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-4 z-[230] flex -translate-x-1/2 items-center gap-3 rounded-full border border-accent/40 bg-surface/95 px-4 py-2 elev-2 backdrop-blur"
          >
            <Crosshair size={16} strokeWidth={2} className="text-accent" />
            <span className="text-sm text-text-primary">
              Veuillez cliquer l’endroit à indiquer
            </span>
            <span className="hidden text-xs text-text-muted sm:inline">Échap pour annuler</span>
            <button
              type="button"
              onClick={cancelCapture}
              aria-label="Annuler le repère"
              className="flex h-6 w-6 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <TagHighlight point={pulse} />
    </TagContext.Provider>
  );
}

export function useTags(): TagContextValue {
  const ctx = useContext(TagContext);
  if (!ctx) throw new Error('useTags must be used within a TagProvider');
  return ctx;
}
