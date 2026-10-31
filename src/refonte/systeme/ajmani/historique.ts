/**
 * L'HISTORIQUE DES DEMANDES DE LA PALETTE ⌘J — logique pure, sans React.
 *
 *   · les 5 dernières demandes, texte SEUL (jamais le contenu d'un message, jamais un secret) ;
 *   · gardées 30 jours, propres à chaque compte, effaçables ;
 *   · une demande n'est jamais ré-exécutée telle quelle : la ressortir remet le texte dans le champ,
 *     et la demande repasse par la proposition et sa confirmation ;
 *   · le texte pas encore envoyé reste 30 secondes en mémoire (jamais écrit sur disque) ;
 *   · ↑ dans un champ vide rappelle la demande précédente.
 *
 * Le stockage est injecté (`Stockage`) : le navigateur en production, une table en mémoire au contrôle.
 * Un stockage refusé ne casse rien : l'historique se tait.
 */
import { assainirDemande } from './sensibles';

export interface Stockage {
  getItem: (cle: string) => string | null;
  setItem: (cle: string, valeur: string) => void;
  removeItem: (cle: string) => void;
}

export const MAX_DEMANDES = 5;
export const DUREE_HISTORIQUE_MS = 30 * 24 * 3600 * 1000;
export const DUREE_TEXTE_GARDE_MS = 30_000;

const normaliserEmail = (email: string | null | undefined): string => (email ?? '').trim().toLowerCase() || 'anonyme';

export const cleHistorique = (email: string | null | undefined): string => `amn.ajmani.palette.historique.${normaliserEmail(email)}`;
export const cleUsage = (email: string | null | undefined): string => `amn.ajmani.palette.usage.${normaliserEmail(email)}`;

/** Le stockage du navigateur, ou `null` s'il est refusé. */
export function stockageNavigateur(): Stockage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export interface Demande {
  texte: string;
  /** Quand (ms depuis 1970). */
  le: number;
}

function relire(brut: string | null, maintenant: number): Demande[] {
  if (!brut) return [];
  try {
    const lu: unknown = JSON.parse(brut);
    if (!Array.isArray(lu)) return [];
    const demandes: Demande[] = [];
    for (const e of lu) {
      if (typeof e !== 'object' || e === null) continue;
      const { texte, le } = e as { texte?: unknown; le?: unknown };
      if (typeof texte !== 'string' || typeof le !== 'number' || !Number.isFinite(le)) continue;
      // Ce qui a plus de 30 jours est oublié ; ce qui date « du futur » (horloge déréglée) aussi.
      if (maintenant - le > DUREE_HISTORIQUE_MS || le > maintenant + 60_000) continue;
      const propre = assainirDemande(texte);
      if (propre) demandes.push({ texte: propre, le });
    }
    return demandes.sort((a, b) => b.le - a.le).slice(0, MAX_DEMANDES);
  } catch {
    return [];
  }
}

/** Les demandes gardées, la plus récente d'abord (5 au plus, 30 jours au plus). */
export function lireHistorique(email: string | null | undefined, maintenant: number, stockage: Stockage | null = stockageNavigateur()): Demande[] {
  if (!stockage) return [];
  try {
    return relire(stockage.getItem(cleHistorique(email)), maintenant);
  } catch {
    return [];
  }
}

function ecrire(email: string | null | undefined, demandes: Demande[], stockage: Stockage | null): void {
  if (!stockage) return;
  try {
    stockage.setItem(cleHistorique(email), JSON.stringify(demandes));
  } catch {
    /* stockage refusé : l'historique ne vaut que pour cette fois */
  }
}

/**
 * Retient une demande. Le texte est assaini (valeurs sensibles masquées, secrets et textes trop longs
 * écartés) ; une demande déjà présente remonte en tête au lieu de se répéter.
 */
export function ajouterDemande(email: string | null | undefined, texte: string, maintenant: number, stockage: Stockage | null = stockageNavigateur()): Demande[] {
  const propre = assainirDemande(texte);
  const actuelles = lireHistorique(email, maintenant, stockage);
  if (!propre) return actuelles;
  const cle = propre.toLowerCase();
  const suivantes = [{ texte: propre, le: maintenant }, ...actuelles.filter((d) => d.texte.toLowerCase() !== cle)].slice(0, MAX_DEMANDES);
  ecrire(email, suivantes, stockage);
  return suivantes;
}

/** « Effacer l'historique » : tout part, d'un coup. */
export function effacerHistorique(email: string | null | undefined, stockage: Stockage | null = stockageNavigateur()): void {
  if (!stockage) return;
  try {
    stockage.removeItem(cleHistorique(email));
  } catch {
    /* rien à faire */
  }
}

/**
 * ↑ dans un champ vide : la demande précédente. `position` est l'indice déjà rappelé (`null` : aucune) ;
 * on remonte d'un cran à chaque appui, et on s'arrête sur la plus ancienne.
 */
export function demandePrecedente(historique: readonly Demande[], position: number | null): { texte: string; position: number } | null {
  if (historique.length === 0) return null;
  const suivant = position === null ? 0 : Math.min(position + 1, historique.length - 1);
  return { texte: historique[suivant].texte, position: suivant };
}

/* ── Ce que la palette rouverte retrouve : le texte non envoyé, 30 secondes, en mémoire seulement ── */

let reserve: { texte: string; le: number } | null = null;

export function garderTexte(texte: string, maintenant: number): void {
  reserve = texte.trim() ? { texte, le: maintenant } : null;
}

/** Le texte gardé, s'il date de moins de 30 secondes. */
export function reprendreTexte(maintenant: number): string {
  return reserve && maintenant - reserve.le <= DUREE_TEXTE_GARDE_MS ? reserve.texte : '';
}

export function oublierTexte(): void {
  reserve = null;
}

/* ── Les lignes « OU LANCEZ » les plus utilisées par la personne : un compteur par ligne, sur ce poste ── */

export type Usage = Readonly<Record<string, number>>;

export function lireUsage(email: string | null | undefined, stockage: Stockage | null = stockageNavigateur()): Usage {
  if (!stockage) return {};
  try {
    const lu: unknown = JSON.parse(stockage.getItem(cleUsage(email)) ?? '{}');
    if (typeof lu !== 'object' || lu === null || Array.isArray(lu)) return {};
    const sortie: Record<string, number> = {};
    for (const [id, n] of Object.entries(lu)) if (typeof n === 'number' && Number.isFinite(n) && n > 0) sortie[id] = Math.min(Math.floor(n), 100_000);
    return sortie;
  } catch {
    return {};
  }
}

export function noterUsage(email: string | null | undefined, idLigne: string, stockage: Stockage | null = stockageNavigateur()): Usage {
  const avant = lireUsage(email, stockage);
  const usage = { ...avant, [idLigne]: (avant[idLigne] ?? 0) + 1 };
  if (stockage) {
    try {
      stockage.setItem(cleUsage(email), JSON.stringify(usage));
    } catch {
      /* stockage refusé */
    }
  }
  return usage;
}

/** Écart en jours calendaires (heure locale) entre une demande et maintenant : 0 aujourd'hui, 1 hier… */
export function ecartEnJours(le: number, maintenant: number): number {
  const minuit = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  return Math.round((minuit(maintenant) - minuit(le)) / 86_400_000);
}
