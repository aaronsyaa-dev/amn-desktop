import { useSyncExternalStore } from 'react';
import { lireMemoire, MEMOIRE_VIDE, type MemoireEtapes } from './etapes';

/**
 * LA MÉMOIRE DE DÉMARRAGE — par compte, sur ce poste (même dessin que `src/refonte/coquille/drapeau.ts`).
 *
 *   amn.demarrage.faites.<adresse>    les étapes vues faites : elles ne redeviennent jamais « à faire »
 *   amn.demarrage.retirees.<adresse>  les étapes que la personne a retirées (« Pas pour moi »)
 *
 * Rien d'autre : pas de date, pas de compteur de visites. Les règles (qui devient quoi) sont dans `etapes.ts`.
 */
export const cleFaites = (email: string): string => `amn.demarrage.faites.${email || 'anonyme'}`;
export const cleRetirees = (email: string): string => `amn.demarrage.retirees.${email || 'anonyme'}`;
const EVENEMENT = 'amn:demarrage';

const vues = new Map<string, { faites: string | null; retirees: string | null; valeur: MemoireEtapes }>();

function lireBrut(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function analyser(brut: string | null): unknown {
  if (!brut) return [];
  try {
    return JSON.parse(brut);
  } catch {
    return [];
  }
}

/** La mémoire de ce compte. La MÊME référence tant que les textes stockés ne changent pas (`useSyncExternalStore`). */
export function lireMemoireStockee(email: string): MemoireEtapes {
  const faites = lireBrut(cleFaites(email));
  const retirees = lireBrut(cleRetirees(email));
  const vu = vues.get(email);
  if (vu && vu.faites === faites && vu.retirees === retirees) return vu.valeur;
  const valeur = faites === null && retirees === null ? MEMOIRE_VIDE : lireMemoire({ faites: analyser(faites), retirees: analyser(retirees) });
  vues.set(email, { faites, retirees, valeur });
  return valeur;
}

/** Garde la mémoire. `false` quand le stockage refuse : la page vit alors sur ce qu'elle voit, sans rien promettre de plus. */
export function ecrireMemoire(email: string, memoire: MemoireEtapes): boolean {
  try {
    window.localStorage.setItem(cleFaites(email), JSON.stringify(memoire.faites));
    window.localStorage.setItem(cleRetirees(email), JSON.stringify(memoire.retirees));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(EVENEMENT));
  return true;
}

const abonner = (rappel: () => void) => {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener('storage', rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener('storage', rappel);
  };
};

export function useMemoireEtapes(email: string): MemoireEtapes {
  return useSyncExternalStore(
    abonner,
    () => lireMemoireStockee(email),
    () => MEMOIRE_VIDE,
  );
}
