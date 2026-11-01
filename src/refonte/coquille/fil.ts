import type { MiettePain } from '../../socle/coquille';

/**
 * LE FIL D'ARIANE — « Famille / Page » (écart C1 du LOT-00). Pur : la coquille lui passe ce qu'elle a trouvé.
 *
 * Les libellés viennent du registre (la famille, l'écran au catalogue) ou de la page elle-même (les pages
 * système : `pagesSysteme.ts`, `usePageCoquille`) — accentués, jamais tirés de l'adresse. Une page dont on ne
 * sait rien porte une seule miette neutre, « Espace » : le fil n'est jamais vide, et jamais « Demarrage ».
 */
export interface ContexteFil {
  /** Ce que la page dit d'elle : le nom de sa famille (déjà lu au registre) et ses miettes. */
  page?: { famille?: string | null; miettes: MiettePain[] } | null;
  /** Ce que le registre a trouvé pour l'adresse : le nom de la famille et le libellé de l'écran. */
  famille?: string | null;
  module?: string | null;
  /** La miette neutre, « Espace ». */
  espace: string;
}

export function construireFil({ page, famille, module, espace }: ContexteFil): MiettePain[] {
  if (page) {
    const miettes = page.miettes.filter((m) => m.libelle.trim() !== '');
    const tete = page.famille ? [{ libelle: page.famille }] : [];
    const fil = [...tete, ...miettes];
    return fil.length > 0 ? fil : [{ libelle: espace }];
  }
  if (famille && module) return [{ libelle: famille }, { libelle: module }];
  if (module) return [{ libelle: espace }, { libelle: module }];
  if (famille) return [{ libelle: famille }];
  return [{ libelle: espace }];
}
