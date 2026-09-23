import React from 'react';
import type { Pave } from './types';

/*
  L'AMBRE D'UN ACCUEIL SE DIT SANS AMBRE ICI. Les Paramètres ont déjà leur
  région ambre ; onze vignettes ambrées en feraient douze. La région ambre de
  chaque Accueil est donc un pavé cerclé d'encre claire : on voit où elle est,
  sans que l'écran des réglages en porte une de plus.
*/
const TEINTE: Record<Pave[4], string> = {
  clair: 'var(--color-text-body)',
  moyen: '#4a4a48',
  sombre: 'var(--color-border-strong)',
  ambre: 'transparent',
};

/** La vignette d'un Accueil : sa structure en quelques pavés, jamais une capture. */
export function Vignette({ paves, actif }: { paves: Pave[]; actif: boolean }) {
  return (
    <svg viewBox="0 0 100 60" className={`block w-full border ${actif ? 'border-text-body' : 'border-border'} bg-sunken`} aria-hidden>
      {paves.map(([x, y, l, h, t], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={l}
          height={h}
          fill={TEINTE[t]}
          stroke={t === 'ambre' ? 'var(--color-text-primary)' : undefined}
          strokeWidth={t === 'ambre' ? 1.5 : undefined}
          strokeDasharray={t === 'ambre' && !actif ? '3 2' : undefined}
        />
      ))}
    </svg>
  );
}
