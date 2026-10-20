import React from 'react';
import { motion, type Transition } from 'framer-motion';
import { OEIL, decoupeOeil, poseCligne, traceBouche, type Pose } from '../expressions';
import type { Teintes } from './commun';
import { ECRAN, type IdsAjmani } from './Defs';

/**
 * LE VISAGE-ÉCRAN — deux yeux, un trait de bouche, en lumière blanc chaud.
 *
 * Les yeux sont des pastilles arrondies découpées par les paupières (le
 * polygone de `decoupeOeil`) : on n'anime que la découpe, l'œil ne se
 * déforme jamais. Le regard décale les deux yeux ensemble ; la bouche ne
 * bouge pas avec lui, sinon le visage glisse.
 */
export function Visage({
  ids,
  teintes,
  pose,
  cligne = false,
  regard = { x: 0, y: 0 },
  qualite,
  transition,
  transitionCligne,
}: {
  ids: IdsAjmani;
  teintes: Teintes;
  pose: Pose;
  cligne?: boolean;
  regard?: { x: number; y: number };
  qualite: 'haute' | 'legere';
  transition?: Transition;
  transitionCligne?: Transition;
}) {
  const p = cligne ? poseCligne(pose) : pose;
  const couleur = pose.lumiere === 'ambre' ? teintes.visageAlerte : teintes.visage;
  const w = OEIL.largeur * pose.echelleYeux;
  const h = OEIL.hauteur * pose.echelleYeux;
  const tYeux = cligne ? transitionCligne : transition;
  const lueur = qualite === 'haute' ? `url(#${ids.lueur})` : undefined;
  // La couleur s'anime comme le reste (du blanc chaud à l'ambre, en 0,4 s).
  const tCouleur = transition && 'duration' in transition && transition.duration === 0 ? transition : { duration: 0.4 };

  return (
    <g filter={lueur}>
      {/* Un halo très doux derrière le visage : l'écran est allumé. */}
      <motion.ellipse cx="100" cy={ECRAN.y + ECRAN.hauteur / 2} rx="44" ry="30" initial={false} animate={{ fill: couleur }} transition={tCouleur} opacity="0.05" />
      <motion.g initial={false} animate={{ x: regard.x, y: regard.y + pose.regardY }} transition={{ type: 'spring', stiffness: 170, damping: 20, mass: 0.6 }}>
        <clipPath id={ids.oeilG}>
          <motion.path initial={false} animate={{ d: decoupeOeil(OEIL.gaucheX, p.oeilG, p.pente, -1, pose.echelleYeux) }} transition={tYeux} />
        </clipPath>
        <clipPath id={ids.oeilD}>
          <motion.path initial={false} animate={{ d: decoupeOeil(OEIL.droitX, p.oeilD, p.pente, 1, pose.echelleYeux) }} transition={tYeux} />
        </clipPath>
        <g clipPath={`url(#${ids.oeilG})`}>
          <motion.rect initial={false} animate={{ x: OEIL.gaucheX - w / 2, y: OEIL.y - h / 2, width: w, height: h, fill: couleur }} transition={{ ...transition, fill: tCouleur }} rx={w / 2} />
        </g>
        <g clipPath={`url(#${ids.oeilD})`}>
          <motion.rect initial={false} animate={{ x: OEIL.droitX - w / 2, y: OEIL.y - h / 2, width: w, height: h, fill: couleur }} transition={{ ...transition, fill: tCouleur }} rx={w / 2} />
        </g>
      </motion.g>
      <motion.path
        initial={false}
        animate={{ d: traceBouche(pose.bouche), fill: couleur, stroke: couleur }}
        transition={{ ...transition, fill: tCouleur, stroke: tCouleur }}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/**
 * LE GRÉSILLEMENT — l'écran qui glitche quand il rit ou panique : deux
 * bandes de lumière et un léger décalage horizontal, une demi-seconde.
 * Rendu seulement en mouvement complet.
 */
export function Glitch({ teintes, actif, cle }: { teintes: Teintes; actif: boolean; cle: number }) {
  if (!actif) return null;
  return (
    <motion.g key={cle} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.4, 1, 0] }} transition={{ duration: 0.55, times: [0, 0.15, 0.45, 0.7, 1] }}>
      <motion.rect x={ECRAN.x} width={ECRAN.largeur} height="5" fill={teintes.visage} opacity="0.18" initial={{ y: ECRAN.y + 20 }} animate={{ y: [ECRAN.y + 20, ECRAN.y + 58, ECRAN.y + 34] }} transition={{ duration: 0.55 }} />
      <motion.rect x={ECRAN.x} width={ECRAN.largeur} height="2" fill={teintes.visage} opacity="0.3" initial={{ y: ECRAN.y + 70 }} animate={{ y: [ECRAN.y + 70, ECRAN.y + 12, ECRAN.y + 50] }} transition={{ duration: 0.55 }} />
    </motion.g>
  );
}
