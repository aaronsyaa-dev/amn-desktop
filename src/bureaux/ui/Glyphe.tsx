import React from 'react';
import { GLYPHES, type EspaceKey } from '../jetons';

/** Le glyphe d'un espace, 24 × 24 à trait 1,9 — les tracés exacts du paquet. */
export function Glyphe({ espace, taille = 14, couleur = 'currentColor', className }: { espace: EspaceKey; taille?: number; couleur?: string; className?: string }) {
  const g = GLYPHES[espace];
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke={couleur}
      strokeWidth={1.9}
      aria-hidden
      className={className}
      style={{ flex: 'none', color: couleur }}
    >
      {g.rects?.map(([x, y, w, h], i) => <rect key={`r${i}`} x={x} y={y} width={w} height={h} />)}
      {g.cercles?.map(([cx, cy, r], i) => <circle key={`c${i}`} cx={cx} cy={cy} r={r} />)}
      {g.d.map((d, i) => <path key={`d${i}`} d={d} />)}
      {g.plein?.map((c, i) => <circle key={`p${i}`} cx={c.cx} cy={c.cy} r={c.r} fill="currentColor" />)}
    </svg>
  );
}

/** La marque AMN, monochrome — celle de la barre haute (14 px). */
export function MarqueAmn({ hauteur = 14, couleur = 'var(--color-text-primary)' }: { hauteur?: number; couleur?: string }) {
  // Même géométrie que src/components/Logo.tsx : repère de 274 de large, capitale 80 (y 10 → 90).
  const traits = ['M0 90 L42 10 L84 90', 'M11.6 68 L72.4 68', 'M98 90 L98 10 L140 90 L182 10 L182 90', 'M190 90 L190 10 L274 90 L274 10'];
  const largeur = (274 / 80) * hauteur;
  return (
    <svg width={largeur} height={hauteur} viewBox="0 10 274 80" fill="none" aria-hidden style={{ flex: 'none' }}>
      {traits.map((d) => (
        <path key={d} d={d} stroke={couleur} strokeWidth={7} strokeLinejoin="miter" strokeLinecap="butt" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.4 }} />
      ))}
    </svg>
  );
}
