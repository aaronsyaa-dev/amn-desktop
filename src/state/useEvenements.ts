import { useCallback, useMemo } from 'react';
import { useCollection, useSync } from './SyncContext';
import {
  economieEvenement,
  etatEvenement,
  evenementNeuf,
  jourCourant,
  normaliserEvenement,
  trierEvenements,
  type EconomieEvenement,
  type EtatEvenement,
  type Evenement,
  type EvenementData,
} from './eventEngine';

/**
 * Les événements, tels que l'écran les consomme.
 *
 * Ce module ne calcule RIEN : il branche la collection synchronisée sur
 * `eventEngine`, qui porte toute la logique et que `check:evenements` éprouve
 * par mutation. La séparation est la même que pour les pages — ce qui peut
 * être faux sans qu'on le voie ne doit pas vivre dans un composant.
 */

/** Un événement, son état déduit et son économie, prêts à afficher. */
export interface EvenementVu {
  evenement: Evenement;
  etat: EtatEvenement;
  economie: EconomieEvenement;
}

export function useEvenements(maintenant: Date = new Date()) {
  const records = useCollection<Record<string, unknown>>('evenements');
  const { upsert, remove } = useSync();

  /*
    LA DÉPENDANCE EST LE JOUR, PAS L'INSTANT.

    `maintenant` vaut `new Date()` par défaut : un objet neuf à chaque rendu,
    donc un tri et un recalcul complets à chaque rendu si on le mettait en
    dépendance. Or rien de ce qui suit ne dépend de l'heure — l'état, le tri et
    le compte à rebours se lisent tous du JOUR (voir `eventEngine`). On mémorise
    donc sur la chaîne du jour, et on reconstruit la date à midi, qui est
    exactement la convention du moteur.

    Effet de bord voulu : un onglet resté ouvert toute la nuit se remet à jour
    au premier rendu qui suit minuit, sans minuterie à entretenir.
  */
  const jour = jourCourant(maintenant);
  const midi = useMemo(() => new Date(`${jour}T12:00:00`), [jour]);

  const evenements = useMemo<Evenement[]>(
    // Normalisé à la LECTURE : l'enregistrement vient d'une autre machine, et
    // peut-être d'une autre version. Voir `normaliserEvenement`.
    () => trierEvenements(records.map((r) => normaliserEvenement(r.id, r)), midi),
    [records, midi],
  );

  const vus = useMemo<EvenementVu[]>(
    () =>
      evenements.map((evenement) => ({
        evenement,
        etat: etatEvenement(evenement, midi),
        economie: economieEvenement(evenement),
      })),
    [evenements, midi],
  );

  /** Combien d'événements par état — pour l'en-tête, sans recompter à l'écran. */
  const compte = useMemo(() => {
    const out: Record<string, number> = {};
    for (const vu of vus) out[vu.etat] = (out[vu.etat] ?? 0) + 1;
    return out;
  }, [vus]);

  /**
   * Ceux dont il faut s'occuper : imminents ou sans date.
   *
   * Un événement sans date n'est pas une intention vague — c'est une décision
   * qui n'a pas été prise, et elle bloque tout le reste (la salle, la
   * billetterie, la communication). Il compte donc comme « à traiter » au même
   * titre qu'un imminent.
   */
  const aTraiter = useMemo(
    () => vus.filter((v) => v.etat === 'imminent' || v.etat === 'sans-date'),
    [vus],
  );

  const creer = useCallback(
    (patch: Partial<EvenementData> = {}) => {
      const id = `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      void upsert('evenements', id, { ...evenementNeuf(), ...patch });
      return id;
    },
    [upsert],
  );

  const modifier = useCallback(
    (evenement: Evenement, patch: Partial<EvenementData>) => {
      const { id, ...data } = evenement;
      void upsert('evenements', id, { ...data, ...patch });
    },
    [upsert],
  );

  const supprimer = useCallback((id: string) => void remove('evenements', id), [remove]);

  return { evenements, vus, compte, aTraiter, creer, modifier, supprimer };
}
