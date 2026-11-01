import { createContext, useContext, useLayoutEffect } from 'react';
import type { MiettePain } from '../../socle/coquille';

/**
 * CE QU'UNE PAGE DIT D'ELLE À LA COQUILLE — son fil d'Ariane, sa famille et sa sous-page allumées dans la barre
 * latérale, le texte de la barre Ajmani.
 *
 * Une page du registre n'a rien à dire : la coquille lit sa famille et son libellé au registre. Une page HORS
 * registre (Notifications, Démarrage, Votre métier, Tous les modules…) le dit explicitement, de deux façons :
 *
 *   · la table des pages système (`pagesSysteme.ts`), lue par la coquille d'après l'adresse ;
 *   · ou, depuis la page elle-même, `usePageCoquille({ famille: 'jour', sousPage: 'home', miettes: [{ libelle:
 *     'Notifications' }], ajmani: 'Demandez à Ajmani…' })`, qui l'emporte sur la table tant que la page est montée.
 *
 * Les libellés viennent de la page ou du registre, accentués : jamais d'un segment d'adresse (écart C1).
 */
export interface PageCoquille {
  /**
   * La famille de la page (identifiant du registre : `jour`, `argent`…) : la coquille écrit son nom en première
   * miette et la déplie dans la barre latérale. `null` : aucune famille dépliée (« Espace / Tous les modules »).
   */
  famille?: string | null;
  /** L'entrée du registre allumée dans la sous-liste de cette famille (`home` : l'Accueil). */
  sousPage?: string | null;
  /** Les miettes après la famille (ou toutes, sans famille) : libellés de la page. */
  miettes: MiettePain[];
  /** Le bouton carré « Tous les modules » est allumé. */
  tousLesModules?: boolean;
  /** Le texte de la barre Ajmani sur cet écran (défaut : celui du socle). */
  ajmani?: string;
}

/** Posé par `CoquilleRefonte` : la page montée y écrit ce qu'elle dit d'elle. */
export const ContextePageCoquille = createContext<((page: PageCoquille | null) => void) | null>(null);

/**
 * Une page hors registre donne son fil, sa famille et sa sous-page à la coquille (sans coquille, ne fait rien).
 * À appeler avec des libellés déjà traduits ; la valeur est relue quand elle change.
 */
export function usePageCoquille(page: PageCoquille | null): void {
  const poser = useContext(ContextePageCoquille);
  const cle = page ? JSON.stringify(page) : '';
  useLayoutEffect(() => {
    if (!poser) return undefined;
    poser(cle ? (JSON.parse(cle) as PageCoquille) : null);
    return () => poser(null);
  }, [poser, cle]);
}
