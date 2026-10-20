import { useEffect, useRef, useState, type RefObject } from 'react';
import { clignementDouble, coupDOeil, decalageRegard, delaiClignement } from './regard';

/**
 * CE QUI LE REND VIVANT AU REPOS — le clignement et le regard.
 * Les deux s'éteignent quand `actif` est faux (mouvement réduit ou aucun,
 * onglet caché) : aucune minuterie ne tourne pour rien.
 */

/** Vrai pendant les 120 ms d'un clignement, toutes les 3 à 6 s, parfois deux fois de suite. */
export function useClignement(actif: boolean): boolean {
  const [ferme, setFerme] = useState(false);
  useEffect(() => {
    if (!actif) {
      setFerme(false);
      return undefined;
    }
    let minuterie: ReturnType<typeof setTimeout>;
    const minuteries: ReturnType<typeof setTimeout>[] = [];
    const cligner = (encore: boolean) => {
      setFerme(true);
      minuteries.push(
        setTimeout(() => {
          setFerme(false);
          if (encore) minuteries.push(setTimeout(() => cligner(false), 160));
        }, 120),
      );
    };
    const suivant = () => {
      minuterie = setTimeout(() => {
        if (!document.hidden) cligner(clignementDouble());
        suivant();
      }, delaiClignement());
    };
    suivant();
    return () => {
      clearTimeout(minuterie);
      minuteries.forEach(clearTimeout);
    };
  }, [actif]);
  return ferme;
}

/**
 * Le décalage du regard : il suit la souris ; quand elle dort depuis 4 s, il
 * jette un coup d'œil ailleurs de temps en temps.
 */
export function useRegard(cible: RefObject<Element | null>, actif: boolean): { x: number; y: number } {
  const [regard, setRegard] = useState({ x: 0, y: 0 });
  const derniereSouris = useRef(0);
  useEffect(() => {
    if (!actif) {
      setRegard({ x: 0, y: 0 });
      return undefined;
    }
    let image = 0;
    const suivre = (e: PointerEvent) => {
      derniereSouris.current = Date.now();
      cancelAnimationFrame(image);
      image = requestAnimationFrame(() => {
        const el = cible.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        // Les yeux sont au premier tiers de la hauteur du dessin.
        setRegard(decalageRegard({ x: r.left + r.width / 2, y: r.top + r.height * 0.4 }, { x: e.clientX, y: e.clientY }));
      });
    };
    let reverie: ReturnType<typeof setTimeout>;
    const rever = () => {
      reverie = setTimeout(() => {
        if (!document.hidden && Date.now() - derniereSouris.current > 4000) setRegard(coupDOeil());
        rever();
      }, 2200 + Math.random() * 3000);
    };
    rever();
    window.addEventListener('pointermove', suivre, { passive: true });
    return () => {
      window.removeEventListener('pointermove', suivre);
      cancelAnimationFrame(image);
      clearTimeout(reverie);
    };
  }, [cible, actif]);
  return regard;
}
