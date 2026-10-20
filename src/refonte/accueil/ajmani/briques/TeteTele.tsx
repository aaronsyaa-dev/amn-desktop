import React from 'react';
import { motion, type Transition } from 'framer-motion';
import { ATTACHES, pivot, type Teintes } from './commun';
import { ECRAN, type IdsAjmani } from './Defs';

/**
 * LA TÊTE-TÉLÉ — très grosse, coque satinée, écran légèrement bombé.
 *
 * Elle reçoit le visage en `children` (dessiné DANS l'écran, découpé par
 * lui), et un emplacement `accessoire` au-dessus de la coque : c'est là que
 * les robots à métiers (S4) posent leur casquette, leur casque ou leur loupe.
 */
export function TeteTele({
  ids,
  teintes,
  children,
  accessoire,
  antenne,
}: {
  ids: IdsAjmani;
  teintes: Teintes;
  children?: React.ReactNode;
  accessoire?: React.ReactNode;
  antenne?: React.ReactNode;
}) {
  return (
    <g>
      {antenne}
      {/* La coque. */}
      <rect x="25" y="30" width="150" height="116" rx="34" fill={`url(#${ids.coque})`} stroke={teintes.coqueOmbre} strokeWidth="1" />
      <path d="M 44 36 C 70 31, 118 31, 140 34 C 104 38, 70 44, 46 60 C 40 52, 38 42, 44 36 Z" fill={`url(#${ids.satin})`} opacity="0.9" />
      {/* Le cadre de l'écran, en léger creux. */}
      <rect x={ECRAN.x - 3} y={ECRAN.y - 3} width={ECRAN.largeur + 6} height={ECRAN.hauteur + 6} rx={ECRAN.rayon + 3} fill={teintes.ecranBord} />
      <rect x={ECRAN.x} y={ECRAN.y} width={ECRAN.largeur} height={ECRAN.hauteur} rx={ECRAN.rayon} fill={`url(#${ids.ecran})`} />
      {/* Le visage, puis le grain de l'écran et son reflet bombé par-dessus. */}
      <g clipPath={`url(#${ids.clipEcran})`}>
        {children}
        <rect x={ECRAN.x} y={ECRAN.y} width={ECRAN.largeur} height={ECRAN.hauteur} fill={`url(#${ids.lignes})`} />
        <path d={`M ${ECRAN.x + 8} ${ECRAN.y + 30} C ${ECRAN.x + 10} ${ECRAN.y + 10}, ${ECRAN.x + 30} ${ECRAN.y + 4}, ${ECRAN.x + 70} ${ECRAN.y + 5} C ${ECRAN.x + 40} ${ECRAN.y + 10}, ${ECRAN.x + 20} ${ECRAN.y + 18}, ${ECRAN.x + 8} ${ECRAN.y + 30} Z`} fill={`url(#${ids.reflet})`} />
      </g>
      {/* Deux boutons et une grille de haut-parleur : c'est une télé, pas un casque. */}
      <circle cx="150" cy="138" r="2.6" fill={teintes.coqueOmbre} />
      <circle cx="159" cy="138" r="2.6" fill={teintes.coqueOmbre} />
      <path d="M 44 136 h 12 M 44 139.5 h 9" stroke={teintes.coqueOmbre} strokeWidth="1.4" strokeLinecap="round" />
      {accessoire}
    </g>
  );
}

/**
 * L'ANTENNE — un peu tordue (c'est un de ses petits défauts), qui pivote à
 * son pied : elle se dresse à la surprise, tombe quand il est fatigué.
 */
export function Antenne({ teintes, torsion, transition, lumiere }: { teintes: Teintes; torsion: number; transition?: Transition; lumiere?: string }) {
  const a = ATTACHES.antenne;
  return (
    <motion.g initial={false} animate={{ rotate: torsion }} transition={transition} style={pivot(a.x, a.y)}>
      <ellipse cx={a.x} cy={a.y + 1} rx="7" ry="3" fill={teintes.coqueOmbre} />
      {/* La tige : droite, puis ce coude qui ne s'est jamais remis d'un carton de déménagement. */}
      <path d={`M ${a.x} ${a.y} L ${a.x + 1} ${a.y - 12} L ${a.x + 6} ${a.y - 17} L ${a.x + 7} ${a.y - 23}`} fill="none" stroke={teintes.coqueOmbre} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={a.x + 7} cy={a.y - 26} r="4.6" fill={lumiere ?? teintes.coque} stroke={teintes.coqueOmbre} strokeWidth="0.9" />
    </motion.g>
  );
}

/** LE CÂBLE QUI TRAÎNE — sort du dos, serpente au sol, finit sur une prise. */
export function Cable({ teintes }: { teintes: Teintes }) {
  return (
    <g>
      <path d="M 124 196 C 138 205, 146 213, 160 211 S 178 204, 186 210" fill="none" stroke={teintes.cable} strokeWidth="3" strokeLinecap="round" />
      <rect x="184" y="206.5" width="9" height="7" rx="2" fill={teintes.cable} />
      <path d="M 193 208.5 h 3 M 193 211.5 h 3" stroke={teintes.cable} strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

/** L'OMBRE au sol : elle rétrécit quand il saute. */
export function Ombre({ echelle = 1, transition }: { echelle?: number | number[]; transition?: Transition }) {
  return (
    <motion.ellipse
      cx="100"
      cy={ATTACHES.sol}
      rx="46"
      ry="5"
      fill="#000000"
      initial={false}
      animate={{ scaleX: echelle, opacity: Array.isArray(echelle) ? echelle.map((e) => 0.28 * e) : 0.28 * echelle }}
      transition={transition}
      style={pivot(100, ATTACHES.sol)}
    />
  );
}
