import { useEffect, useMemo } from 'react';
import { useCollection, useSync } from '../../state/SyncContext';
import type { ReleveParc } from './types';

/**
 * LES RELEVÉS DU PARC — la mémoire des chiffres.
 *
 * Le serveur ne garde pas l'histoire des scores ni des poids : il n'en sait
 * que l'instant. Les tendances (« −9 en 7 j »), les courbes de huit semaines
 * et la disponibilité des trente jours se lisent donc dans un relevé
 * quotidien, écrit une fois par jour par le premier poste interne qui ouvre
 * un bureau (clé AAAA-MM-JJ, collection `parcReleves`). Un jour où personne
 * n'a ouvert de bureau n'a pas de relevé : la courbe a un trou, et l'écran le
 * dessine comme tel — il n'invente pas la valeur manquante.
 */

export const jourDe = (t: number | string | Date) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export type Releves = Map<string, ReleveParc>;

export function useReleves(): Releves {
  const liste = useCollection<ReleveParc>('parcReleves');
  return useMemo(() => new Map(liste.map((r) => [r.id, r as ReleveParc])), [liste]);
}

/** Écrit le relevé du jour s'il manque — une fois, quand les modèles sont prêts. */
export function useEcrireReleveDuJour(pret: boolean, construire: () => ReleveParc['orgs'], equipe?: () => ReleveParc['equipe']) {
  const releves = useReleves();
  const { upsert } = useSync();
  const jour = jourDe(Date.now());
  const existe = releves.has(jour);
  useEffect(() => {
    if (!pret || existe) return;
    const orgs = construire();
    if (!Object.keys(orgs).length) return;
    const e = equipe?.();
    void upsert('parcReleves', jour, { jour, at: new Date().toISOString(), orgs, ...(e ? { equipe: e } : {}) });
    // `construire` change à chaque rendu ; seul le passage à « prêt » compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, existe, jour, upsert]);
}

/** La valeur d'un relevé il y a `jours` jours (le plus proche, à un jour près), ou `null`. */
export function valeurIlYA<T>(releves: Releves, jours: number, lire: (r: ReleveParc) => T | null | undefined, maintenant = Date.now()): T | null {
  for (const decalage of [0, 1, -1]) {
    const r = releves.get(jourDe(maintenant - (jours + decalage) * 86_400_000));
    const v = r ? lire(r) : null;
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

/** Une série de `n` points espacés de `pas` jours, le dernier aujourd'hui ; `null` là où il n'y a pas de relevé. */
export function serie<T>(releves: Releves, n: number, pas: number, lire: (r: ReleveParc) => T | null | undefined, maintenant = Date.now()): (T | null)[] {
  const r: (T | null)[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = releves.get(jourDe(maintenant - i * pas * 86_400_000));
    const v = x ? lire(x) : null;
    r.push(v ?? null);
  }
  return r;
}
