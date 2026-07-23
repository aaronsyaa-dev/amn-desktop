import React from 'react';

const NOISE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

/**
 * Full-viewport film-grain overlay. Deliberately assertive (~9%) to give the
 * near-black canvas a real material quality — a "developed film" texture rather
 * than a token dusting. Non-interactive so it never blocks input.
 */
export function GrainOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] opacity-[0.09] mix-blend-soft-light"
      style={{ backgroundImage: `url("${NOISE}")`, backgroundSize: '200px 200px' }}
    />
  );
}
