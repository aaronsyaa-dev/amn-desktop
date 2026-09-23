import { useCallback, useEffect, useState } from 'react';
import { garde } from '../../lib/garde';
import { bridge } from '../../lib/bridge';
import type { AdminOrganization, SslStatus } from '../../shared/api';
import type { GardeAccueil, GardeRemontee, GardeSalle } from '../../shared/garde';

/**
 * LE QG — ce que lisent les dix Accueils de l'édition interne.
 *
 * Même principe que la journée de l'édition cliente : une seule source,
 * les variantes changent la STRUCTURE, jamais la donnée. Tout vient de la
 * Garde (amn-api) : l'accueil d'Ajmani (pouls, pile en dossiers, relève,
 * proposition, budget de paroles), les remontées, la Salle (agents,
 * réglages, séries), le parc des organisations et les certificats.
 *
 * Ce fichier n'existe que dans l'édition interne : `@edition/accueils`
 * n'importe les variantes `interne/*` que depuis `accueils.internal.tsx`.
 */

export interface QG {
  pret: boolean;
  erreur: string | null;
  accueil: GardeAccueil | null;
  salle: GardeSalle | null;
  /** Les remontées récentes, tous états confondus, du plus récent au plus ancien. */
  remontees: GardeRemontee[];
  organisations: AdminOrganization[];
  ssl: SslStatus[];
  maintenant: Date;
  recharger: () => Promise<void>;
}

const TRAMES = ['garde:remontee', 'garde:remontee-decidee', 'garde:remontee-resolue', 'garde:releve', 'garde:ronde', 'garde:presence', 'garde:journal', 'garde:prise'];

export function useQG(tickMs = 30_000): QG {
  const [etat, setEtat] = useState<Omit<QG, 'maintenant' | 'recharger'>>({ pret: false, erreur: null, accueil: null, salle: null, remontees: [], organisations: [], ssl: [] });
  const [maintenant, setMaintenant] = useState(() => new Date());

  const recharger = useCallback(async () => {
    const r = bridge().remote;
    const [accueil, salle, remontees, organisations, ssl] = await Promise.allSettled([
      garde.accueil(),
      garde.salle(),
      garde.remontees('toutes', { limit: 200 }),
      r.admin.listOrganizations(),
      r.listSslStatus(),
    ]);
    const val = <T,>(p: PromiseSettledResult<T>, d: T): T => (p.status === 'fulfilled' ? p.value : d);
    setEtat({
      pret: true,
      erreur: accueil.status === 'rejected' ? 'La Garde ne répond pas.' : null,
      accueil: val(accueil, null),
      salle: val(salle, null),
      remontees: [...(remontees.status === 'fulfilled' ? remontees.value.remontees : [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      organisations: val(organisations, [] as AdminOrganization[]),
      ssl: val(ssl, [] as SslStatus[]),
    });
  }, []);

  useEffect(() => {
    void recharger();
    const off = garde.onGarde((trame) => {
      if (TRAMES.includes(trame.type)) void recharger();
    });
    const t = setInterval(() => {
      setMaintenant(new Date());
    }, tickMs);
    const r = setInterval(() => void recharger(), 120_000);
    return () => {
      off();
      clearInterval(t);
      clearInterval(r);
    };
  }, [recharger, tickMs]);

  return { ...etat, maintenant, recharger };
}

export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
/** « 6 412 » : l'espace fine insécable des milliers. */
export const nombre = (n: number) => n.toLocaleString('fr-FR');
