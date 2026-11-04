import React from 'react';

/**
 * LES ORBITES QUI VEILLENT (G09, `WatchOrbit`) — trois cercles pointillés (372 / 452 / 560 px), huit repères
 * ANONYMES sur celui de 452, et le balayage lent (`SlowSweep`, un tour en 60 s).
 *
 * Les huit repères sont décoratifs : leur nombre est fixe, sans lien avec le nombre réel d'organisations, et
 * aucun ne porte de nom. Celui « en veille » (bord vert, point vert, halo) est tiré au hasard à chaque
 * affichage par l'appelant (`repereEnVeille`, indice 0 à 7). Tout est `aria-hidden`.
 *
 * Le mouvement vient de la couche commune : `data-mvt="balayage"` (60 s ici) et `data-mvt="onde"` sur le point du
 * repère en veille (3,6 s ici). En mouvement réduit, le balayage est FIGÉ (il reste à sa place) et le halo fixe.
 */
export const ANGLES_REPERES = [-158, -126, -52, -20, 24, 50, 134, 160] as const;
export const RAYONS_ORBITES = [372, 452, 560] as const;
export const RAYON_REPERES = 452;
const POINTILLES = ['1 7', '2 8', '1 9'] as const;

/** La place d'un repère (0° = droite, sens horaire), en px depuis le centre. Fonction pure. */
export function placeRepere(angle: number, rayon = RAYON_REPERES): { x: number; y: number } {
  const r = (angle * Math.PI) / 180;
  return { x: Math.round(Math.cos(r) * rayon * 10) / 10 + 0, y: Math.round(Math.sin(r) * rayon * 10) / 10 + 0 };
}

/** Le repère en veille, tiré au hasard (indice 0 à 7). `aleatoire` est injectable pour les contrôles. */
export function tirerRepereEnVeille(aleatoire: () => number = Math.random): number {
  const i = Math.floor(aleatoire() * ANGLES_REPERES.length);
  return Math.min(ANGLES_REPERES.length - 1, Math.max(0, i));
}

export function SlowSweep() {
  return <span aria-hidden className="ve-balayage" data-mvt="balayage" />;
}

export function WatchOrbit({ repereEnVeille }: { repereEnVeille: number }) {
  return (
    <div aria-hidden className="ve-orbites" data-veille="orbites">
      <SlowSweep />
      <svg className="ve-orbites__svg" viewBox="-600 -600 1200 1200" width="1200" height="1200" focusable="false">
        {RAYONS_ORBITES.map((r, i) => (
          <circle key={r} cx="0" cy="0" r={r} fill="none" className="ve-orbite" strokeDasharray={POINTILLES[i]} />
        ))}
      </svg>
      {ANGLES_REPERES.map((a, i) => {
        const { x, y } = placeRepere(a);
        const veille = i === repereEnVeille;
        return (
          <span key={a} className="ve-repere" data-veille={veille || undefined} style={{ left: `${x}px`, top: `${y}px` }}>
            <span className="ve-repere__point" data-mvt={veille ? 'onde' : undefined} />
          </span>
        );
      })}
    </div>
  );
}
