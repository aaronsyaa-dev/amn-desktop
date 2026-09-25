import { createContext, useContext } from 'react';

/**
 * CE QUE LA PIÈCE IMPOSE À L'EN-TÊTE D'UN ÉCRAN.
 *
 * Un écran ne sait pas dans quelle coquille il est monté — et ne doit pas le
 * savoir : les vingt-trois modules internes recousus dans leur bureau
 * (cahier 16) gardent leurs instruments, leurs actions et leur ligne d'état.
 * Seule change la tête : sa typographie et son surtitre, qui disent la pièce.
 * La coquille pose ce contexte ; `ScreenHeader` le lit. Hors d'un bureau, il
 * est vide et rien ne change.
 */
export interface EnTeteContexte {
  /** « CYBER · INCIDENTS » — posé devant le surtitre de l'écran. */
  prefixe?: string;
  /** Les segments du surtitre de l'écran déjà dits par le préfixe, à ne pas répéter. */
  redites?: string[];
  /** La tête du bureau : police, graisse, taille, interlettrage. */
  classeTitre?: string;
  /** Pas de point de famille : la famille est une notion du poste de travail. */
  sansTeinte?: boolean;
}

export const EnTeteCtx = createContext<EnTeteContexte>({});

export function useEnTeteContexte(): EnTeteContexte {
  return useContext(EnTeteCtx);
}

/** Le surtitre recomposé : le préfixe de la pièce, puis ce que l'écran ajoute de neuf. */
export function surtitreDansLaPiece(eyebrow: string | undefined, ctx: EnTeteContexte): string | undefined {
  if (!ctx.prefixe) return eyebrow;
  const redites = new Set((ctx.redites ?? []).map((r) => r.trim().toLowerCase()));
  const reste = (eyebrow ?? '')
    .split(/\s+·\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !redites.has(s.toLowerCase()));
  return [ctx.prefixe, ...reste].join(' · ');
}
