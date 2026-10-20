import { useCallback, useEffect, useState } from 'react';
import { relireEtat, type EtatParole } from './parole';

/**
 * CE QU'AJMANI RETIENT — sur ce poste, par compte.
 *
 * Même convention que la mémoire du guide (`src/guide/memoire.ts`) : une clé
 * `localStorage` par compte, un événement de fenêtre, et tout se comporte
 * correctement si le stockage est refusé (il risque alors de se répéter,
 * c'est tout). Rien ne part en synchronisation : ce sont des préférences de
 * poste, pas des données.
 */
const CLE = (email: string) => `amn.ajmani.parole.${email || 'anonyme'}`;
export const EVENEMENT_PAROLE = 'amn:ajmani-parole';

/*
 * Une copie en mémoire, toujours tenue : si le stockage refuse d'écrire, la
 * relecture rend quand même ce qui vient d'être retenu. Sans elle, la
 * réplique de l'Accueil serait retirée au sort à chaque rendu — une boucle.
 */
const copies = new Map<string, EtatParole>();

export function lireParole(email: string): EtatParole {
  // Ce qui a été écrit pendant cette session fait foi, même si le stockage a refusé l'écriture.
  const copie = copies.get(email);
  if (copie) return copie;
  try {
    const brut = window.localStorage.getItem(CLE(email));
    if (brut !== null) return relireEtat(brut);
  } catch {
    /* stockage refusé : la copie en mémoire fait foi */
  }
  return relireEtat(null);
}

export function ecrireParole(email: string, etat: EtatParole): void {
  copies.set(email, etat);
  try {
    window.localStorage.setItem(CLE(email), JSON.stringify(etat));
  } catch {
    /* stockage refusé : la mémoire ne vaut que pour cette session */
  }
  window.dispatchEvent(new Event(EVENEMENT_PAROLE));
}

/** L'état de parole du compte, et une façon de le transformer. */
export function useParole(email: string): [EtatParole, (fn: (etat: EtatParole) => EtatParole) => void] {
  const [etat, setEtat] = useState(() => lireParole(email));
  useEffect(() => {
    const relire = () => setEtat(lireParole(email));
    relire();
    window.addEventListener(EVENEMENT_PAROLE, relire);
    window.addEventListener('storage', relire);
    return () => {
      window.removeEventListener(EVENEMENT_PAROLE, relire);
      window.removeEventListener('storage', relire);
    };
  }, [email]);
  const transformer = useCallback(
    (fn: (etat: EtatParole) => EtatParole) => {
      const suivant = fn(lireParole(email));
      ecrireParole(email, suivant);
    },
    [email],
  );
  return [etat, transformer];
}

/**
 * Quelqu'un écrit-il, ou est-il au téléphone ? Ajmani se tait alors.
 *
 *   · un champ de saisie a le focus, ou une touche a été frappée il y a
 *     moins de 4 secondes ;
 *   · une fenêtre modale est ouverte (`aria-modal`), ou la barre d'appel est
 *     affichée (le bouton « Raccrocher » de `CallOverlay`). L'état de l'appel
 *     vit dans un contexte monté plus bas que l'Accueil : on lit la page,
 *     faute de mieux — voir le rapport S2.
 */
let derniereFrappe = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => (derniereFrappe = Date.now()), { capture: true, passive: true });
}

export function quelquUnEstOccupe(maintenant = Date.now()): boolean {
  if (typeof document === 'undefined') return false;
  if (maintenant - derniereFrappe < 4000) return true;
  const actif = document.activeElement as HTMLElement | null;
  if (actif && (actif.tagName === 'INPUT' || actif.tagName === 'TEXTAREA' || actif.tagName === 'SELECT' || actif.isContentEditable)) return true;
  return Boolean(document.querySelector('[aria-modal="true"], [aria-label="Raccrocher"]'));
}
