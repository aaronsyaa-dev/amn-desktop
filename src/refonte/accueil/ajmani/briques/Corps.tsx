import React from 'react';
import { motion, type TargetAndTransition, type Transition } from 'framer-motion';
import { ATTACHES, pivot, type Teintes } from './commun';
import type { IdsAjmani } from './Defs';

/**
 * LE CORPS — d'un seul tenant, blanc satiné, deux petits pieds.
 * Le cou est posé ici : la tête vient s'y emboîter.
 */
export function Corps({ ids, teintes }: { ids: IdsAjmani; teintes: Teintes }) {
  return (
    <g>
      {/* Les pieds : deux galets, légèrement rentrés sous le corps. */}
      <ellipse cx="85" cy="205" rx="11" ry="6.5" fill={`url(#${ids.coque})`} stroke={teintes.coqueOmbre} strokeWidth="0.8" />
      <ellipse cx="115" cy="205" rx="11" ry="6.5" fill={`url(#${ids.coque})`} stroke={teintes.coqueOmbre} strokeWidth="0.8" />
      {/* Le cou. */}
      <rect x="91" y="138" width="18" height="14" rx="4" fill={teintes.coqueOmbre} />
      {/* Le corps : une goutte large, d'un seul tenant. */}
      <path
        d="M 70 162 C 70 148, 130 148, 130 162 L 132.5 186 C 134 201, 119 207, 100 207 C 81 207, 66 201, 67.5 186 Z"
        fill={`url(#${ids.coque})`}
        stroke={teintes.coqueOmbre}
        strokeWidth="0.9"
      />
      <path d="M 77 160 C 80 153, 98 151, 108 153 C 96 156, 84 162, 79 176 Z" fill={`url(#${ids.satin})`} opacity="0.8" />
      {/* Un témoin discret sur la poitrine : il dit qu'il est allumé. */}
      <circle cx="100" cy="178" r="2.2" fill={teintes.ecran} opacity="0.55" />
    </g>
  );
}

/**
 * UN BRAS — une petite capsule et une main ronde, qui pivote à l'épaule.
 * `angle` en degrés : 0 = pendant droit ; positif = tourne dans le sens des
 * aiguilles d'une montre (le bras gauche s'écarte, le droit se replie).
 */
export function Bras({
  cote,
  ids,
  teintes,
  initial,
  animate,
  transition,
}: {
  cote: 'gauche' | 'droit';
  /** La position de départ quand le bras est remonté pour rejouer un geste (sinon : pas d'animation d'entrée). */
  initial?: TargetAndTransition | false;
  ids: IdsAjmani;
  teintes: Teintes;
  animate: TargetAndTransition;
  transition?: Transition;
}) {
  const e = cote === 'gauche' ? ATTACHES.epauleG : ATTACHES.epauleD;
  return (
    <motion.g initial={initial ?? false} animate={animate} transition={transition} style={pivot(e.x, e.y)}>
      <rect x={e.x - 5} y={e.y - 3} width="10" height="25" rx="5" fill={`url(#${ids.coque})`} stroke={teintes.coqueOmbre} strokeWidth="0.8" />
      <circle cx={e.x} cy={e.y + 24} r="6.2" fill={`url(#${ids.coque})`} stroke={teintes.coqueOmbre} strokeWidth="0.8" />
    </motion.g>
  );
}
