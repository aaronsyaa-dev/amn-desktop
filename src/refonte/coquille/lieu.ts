import { libelleNav } from '../../i18n';
import type { NavItem } from '../../data/navigation';
import { moduleDuChemin } from '../../state/RegardsContext';

/**
 * OÙ EST UN COLLÈGUE — le libellé du module ouvert, jamais son adresse (écart C7 du LOT-00 : « sur
 * /notifications »). Le module au catalogue (libellé accentué, celui de la page), sinon la page système
 * (`libelleSysteme`), sinon `null` : on n'écrit alors rien, plutôt qu'une route brute.
 */
export function libelleDuLieu(chemin: string, catalogue: readonly NavItem[], libelleSysteme?: (chemin: string) => string | null): string | null {
  const m = moduleDuChemin(chemin);
  const item = catalogue.find((i) => i.to === m) ?? catalogue.find((i) => i.to !== '/' && m.startsWith(`${i.to}/`));
  if (item) return libelleNav(item);
  return libelleSysteme?.(chemin.split('?')[0]) ?? libelleSysteme?.(m) ?? null;
}
