import React, { useId } from 'react';
import { idSur, type Teintes } from './commun';

/** Les identifiants des dégradés et filtres d'UN personnage (deux Ajmani à l'écran ne se marchent pas dessus). */
export interface IdsAjmani {
  coque: string;
  satin: string;
  ecran: string;
  reflet: string;
  lueur: string;
  clipEcran: string;
  oeilG: string;
  oeilD: string;
  lignes: string;
}

export function useIdsAjmani(): IdsAjmani {
  const p = `aj${idSur(useId())}`;
  return {
    coque: `${p}-coque`,
    satin: `${p}-satin`,
    ecran: `${p}-ecran`,
    reflet: `${p}-reflet`,
    lueur: `${p}-lueur`,
    clipEcran: `${p}-clip-ecran`,
    oeilG: `${p}-oeil-g`,
    oeilD: `${p}-oeil-d`,
    lignes: `${p}-lignes`,
  };
}

/** L'écran : sa place dans le dessin, partagée par la tête et le visage. */
export const ECRAN = { x: 40, y: 44, largeur: 120, hauteur: 86, rayon: 22 } as const;

/**
 * Les définitions : coque satinée, écran bombé, lueur du visage.
 * `qualite="legere"` retire le filtre de lueur — c'est lui qui coûte sur un
 * appareil modeste.
 */
export function DefsAjmani({ ids, teintes, qualite }: { ids: IdsAjmani; teintes: Teintes; qualite: 'haute' | 'legere' }) {
  return (
    <defs>
      <linearGradient id={ids.coque} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stopColor={teintes.coqueReflet} />
        <stop offset="0.5" stopColor={teintes.coque} />
        <stop offset="1" stopColor={teintes.coqueOmbre} />
      </linearGradient>
      {/* Le satin : un reflet doux en haut à gauche, comme une lumière de fenêtre. */}
      <radialGradient id={ids.satin} cx="0.3" cy="0.22" r="0.55">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      {/* L'écran bombé : plus clair au centre, qui s'enfonce vers les bords. */}
      <radialGradient id={ids.ecran} cx="0.46" cy="0.42" r="0.68">
        <stop offset="0" stopColor="#262A31" />
        <stop offset="0.62" stopColor={teintes.ecran} />
        <stop offset="1" stopColor="#060708" />
      </radialGradient>
      <linearGradient id={ids.reflet} x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
      <pattern id={ids.lignes} width="4" height="3" patternUnits="userSpaceOnUse">
        <rect width="4" height="1" fill="#FFFFFF" opacity="0.035" />
      </pattern>
      {qualite === 'haute' && (
        <filter id={ids.lueur} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="flou" />
          <feMerge>
            <feMergeNode in="flou" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}
      <clipPath id={ids.clipEcran}>
        <rect x={ECRAN.x} y={ECRAN.y} width={ECRAN.largeur} height={ECRAN.hauteur} rx={ECRAN.rayon} />
      </clipPath>
    </defs>
  );
}
