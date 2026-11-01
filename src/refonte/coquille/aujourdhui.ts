import { useMemo } from 'react';
import type { Langue } from '../../i18n';
import { traduireSocle } from '../../socle/i18n';
import type { CarteAujourdhui } from '../../socle/coquille';
import { useAccueil } from '../accueil/useAccueil';

/**
 * LA CARTE « AUJOURD'HUI » DE LA BARRE LATÉRALE (§0.1) — les MÊMES chiffres que l'Accueil (N01), parce qu'elle
 * les lit au même endroit : `useAccueil` (le fil du jour et ce qui y est coché, la série des routines, le prochain
 * rendez-vous du jour, les collègues en ligne et le libellé de leur module). Rien n'est calculé ici, sauf la mise
 * en mots de l'heure (« 11:00 · dans 18 min »).
 */

/** « dans 18 min », « dans 2 h », « dans 1 h 05 », « en cours » : le temps qui reste avant un début. Pur. */
export function delaiAvant(debut: Date, maintenant: Date, langue: Langue): string {
  const minutes = Math.ceil((debut.getTime() - maintenant.getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return traduireSocle(langue, 'coquille.jour.enCours');
  if (minutes < 60) return traduireSocle(langue, 'coquille.jour.dans.min', { n: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? traduireSocle(langue, 'coquille.jour.dans.h', { h }) : traduireSocle(langue, 'coquille.jour.dans.hmin', { h, m: String(m).padStart(2, '0') });
}

/** L'heure d'un début, à la française (« 11:00 »). */
export function heureDe(debut: Date, langue: Langue): string {
  return debut.toLocaleTimeString(langue === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function useCarteAujourdhui(langue: Langue, versAccueil: string): CarteAujourdhui | null {
  const a = useAccueil();
  return useMemo(() => {
    if (!a.pret) return null;
    const rdv = a.prochainRdv;
    const debut = rdv ? new Date(rdv.debut) : null;
    return {
      faites: a.faits,
      total: a.fil.length,
      serie: a.serie,
      rendezVous: rdv && debut && rdv.titre ? { titre: rdv.titre, heure: heureDe(debut, langue), dans: delaiAvant(debut, a.maintenant, langue) } : null,
      collegues: a.enLigne.map((p) => ({ cle: p.email, nom: p.nom, lieu: p.module })),
      presenceMontree: a.presenceMontree,
      vers: versAccueil,
    };
  }, [a.pret, a.prochainRdv, a.faits, a.fil.length, a.serie, a.enLigne, a.presenceMontree, a.maintenant, langue, versAccueil]);
}
