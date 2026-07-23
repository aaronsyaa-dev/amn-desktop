import type { Variants } from 'framer-motion';

/**
 * Shared motion vocabulary. Each screen owns a "room-change" entrance (a
 * distinct direction/feel per tab) plus an internal stagger so its sections
 * cascade in rather than appearing all at once. Kept quick — presence, not
 * theatrics.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Per-route page entrance. The direction differs so tabs feel like rooms. */
export const pageVariants: Record<string, Variants> = {
  '/': {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  },
  '/sites': {
    initial: { opacity: 0, x: 18 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, x: -12, transition: { duration: 0.15 } },
  },
  '/team': {
    initial: { opacity: 0, scale: 0.985 },
    animate: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, scale: 0.99, transition: { duration: 0.15 } },
  },
  '/clients': {
    initial: { opacity: 0, x: -18 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, x: 12, transition: { duration: 0.15 } },
  },
  '/tracker': {
    initial: { opacity: 0, y: -14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, y: 10, transition: { duration: 0.15 } },
  },
  '/settings': {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  },
};

export function variantsForPath(pathname: string): Variants {
  if (pathname.startsWith('/sites')) return pageVariants['/sites'];
  if (pathname.startsWith('/team')) return pageVariants['/team'];
  if (pathname.startsWith('/clients')) return pageVariants['/clients'];
  if (pathname.startsWith('/tracker')) return pageVariants['/tracker'];
  if (pathname.startsWith('/settings')) return pageVariants['/settings'];
  return pageVariants['/'];
}

/** Container that cascades its direct <StaggerItem> children. */
export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};
