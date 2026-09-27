import React from 'react';
import type { PieceStudio } from '../donnees/types';

/**
 * STUDIO · LA MAQUETTE EN LIGNE — le site réel d'une pièce, là où Mohamed le regarde.
 *
 * Une maquette a souvent une adresse avant d'avoir une image : le déploiement
 * Vercel d'une branche. On la montre donc vivante — la page elle-même, réduite
 * dans le cadre (sans interaction : un clic sur la fenêtre ouvre le vrai site,
 * un clic sur le mur pose une punaise) — ou son image, quand il y en a une.
 */

/** Une adresse web complète, ou `null`. « keller.vercel.app » devient « https://keller.vercel.app ». */
export function lienPropre(brut: string | null | undefined): string | null {
  const t = (brut ?? '').trim();
  if (!t) return null;
  const avec = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(avec);
    return u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}

export const hoteDe = (lien: string | null | undefined) => {
  try {
    return lien ? new URL(lien).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
};

type Croquis = NonNullable<PieceStudio['croquis']>[number];

/** La maquette qui représente la pièce sur la façade : la première maquette du mur qui a une image ou un lien, sinon l'adresse de la pièce. */
export function maquetteDe(p: PieceStudio): { lien: string | null; image: string | null; titre: string | null } {
  const m = (p.croquis ?? []).find((c: Croquis) => c.genre === 'maquette' && (c.image || lienPropre(c.lien)));
  const lien = lienPropre(m?.lien) ?? lienPropre(p.url);
  return { lien, image: m?.image ?? null, titre: m?.titre ?? null };
}

/** Le nombre d'idées (punaises) posées sur les maquettes de la pièce. */
export const ideesDe = (p: PieceStudio) => (p.croquis ?? []).reduce((n, c) => n + (c.punaises?.length ?? 0), 0);

/**
 * L'aperçu : l'image, ou la page vivante réduite. `largeur` : la largeur affichée en px (la page est
 * rendue à 1280 px de large puis réduite, pour qu'elle ressemble à ce qu'une visiteuse voit).
 */
export function Apercu({ lien, image, titre, largeur }: { lien: string | null; image: string | null; titre: string; largeur: number }) {
  if (image) return <img src={image} alt={titre} draggable={false} className="h-full w-full object-cover object-top" />;
  if (!lien) return null;
  const echelle = Math.max(0.05, largeur / 1280);
  return (
    <span className="absolute inset-0 overflow-hidden bg-[#f4f3f0]" aria-hidden>
      <iframe
        src={lien}
        title={titre}
        loading="lazy"
        tabIndex={-1}
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="no-referrer"
        className="pointer-events-none origin-top-left border-0"
        style={{ width: 1280, height: 1280 * 1.2, transform: `scale(${echelle})` }}
      />
    </span>
  );
}
