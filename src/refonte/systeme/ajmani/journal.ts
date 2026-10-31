/**
 * LE JOURNAL DES ACTIONS EXÉCUTÉES PAR LA PALETTE — logique pure, sans React.
 *
 * Chaque action que la palette exécute est tracée sur ce poste, pour ce compte : qui l'a demandée, la phrase
 * demandée, ce qui a été fait, quand, avec quel résultat. 200 entrées au plus (les plus anciennes partent).
 *
 * Ce journal ne contient JAMAIS un secret ni le contenu d'un message : la phrase demandée passe par
 * `assainirDemande` (valeurs sensibles masquées, secrets écartés), et « ce qui a été fait » est une phrase courte
 * écrite par la palette, pas un texte venu de l'extérieur. Il est local : la consultation dans l'historique
 * général (H22) lit `lireJournal()`.
 */
import { assainirDemande, masquerSensibles } from './sensibles';
import { stockageNavigateur, type Stockage } from './historique';
import type { NiveauAction } from './niveaux';

export const MAX_JOURNAL = 200;
export type ResultatAction = 'reussi' | 'echec' | 'annule';

export interface EntreeJournal {
  id: string;
  /** Le compte qui a demandé. */
  qui: string;
  /** La phrase demandée (assainie). */
  demande: string;
  /** Ce qui a été fait, en une phrase. */
  fait: string;
  niveau: NiveauAction;
  /** Quand (ms depuis 1970). */
  le: number;
  resultat: ResultatAction;
}

export const cleJournal = (email: string | null | undefined): string => `amn.ajmani.palette.journal.${(email ?? '').trim().toLowerCase() || 'anonyme'}`;

const NIVEAUX_VALIDES = new Set<string>(['N0', 'N1', 'N2', 'N3']);
const RESULTATS_VALIDES = new Set<string>(['reussi', 'echec', 'annule']);
/** Ce que le journal écrit quand la demande ne peut pas être gardée (un secret annoncé). */
export const DEMANDE_MASQUEE = '••••';

function relire(brut: string | null): EntreeJournal[] {
  if (!brut) return [];
  try {
    const lu: unknown = JSON.parse(brut);
    if (!Array.isArray(lu)) return [];
    return lu.filter((e): e is EntreeJournal => {
      if (typeof e !== 'object' || e === null) return false;
      const x = e as Record<string, unknown>;
      return (
        typeof x.id === 'string' && typeof x.qui === 'string' && typeof x.demande === 'string' && typeof x.fait === 'string' &&
        typeof x.le === 'number' && NIVEAUX_VALIDES.has(String(x.niveau)) && RESULTATS_VALIDES.has(String(x.resultat))
      );
    });
  } catch {
    return [];
  }
}

/** Le journal de ce compte, la plus récente en tête. */
export function lireJournal(email?: string | null, stockage: Stockage | null = stockageNavigateur()): EntreeJournal[] {
  if (!stockage) return [];
  try {
    return relire(stockage.getItem(cleJournal(email))).sort((a, b) => b.le - a.le);
  } catch {
    return [];
  }
}

function ecrire(email: string | null | undefined, entrees: EntreeJournal[], stockage: Stockage | null): void {
  if (!stockage) return;
  try {
    stockage.setItem(cleJournal(email), JSON.stringify(entrees.slice(0, MAX_JOURNAL)));
  } catch {
    /* stockage refusé : le journal ne vaut que pour cette session */
  }
}

export interface ActionExecutee {
  demande: string;
  fait: string;
  niveau: NiveauAction;
  resultat: ResultatAction;
}

let compteur = 0;

/** Trace une action exécutée. Rend l'entrée écrite (son `id` sert à la corriger si la personne annule à temps). */
export function noterAction(email: string | null | undefined, action: ActionExecutee, maintenant: number, stockage: Stockage | null = stockageNavigateur()): EntreeJournal {
  compteur += 1;
  const entree: EntreeJournal = {
    id: `j-${maintenant.toString(36)}-${compteur.toString(36)}`,
    qui: (email ?? '').trim().toLowerCase() || 'anonyme',
    demande: assainirDemande(action.demande) ?? DEMANDE_MASQUEE,
    fait: masquerSensibles(action.fait).slice(0, 200),
    niveau: action.niveau,
    le: maintenant,
    resultat: action.resultat,
  };
  ecrire(email, [entree, ...lireJournal(email, stockage)], stockage);
  return entree;
}

/** « Annuler » à temps : l'entrée passe à `annule`, elle n'est pas effacée (la trace dit ce qui s'est passé). */
export function corrigerResultat(email: string | null | undefined, id: string, resultat: ResultatAction, stockage: Stockage | null = stockageNavigateur()): void {
  const entrees = lireJournal(email, stockage);
  if (!entrees.some((e) => e.id === id)) return;
  ecrire(email, entrees.map((e) => (e.id === id ? { ...e, resultat } : e)), stockage);
}
