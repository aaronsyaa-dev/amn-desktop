import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
 * L'aperçu : l'image, ou la page vivante réduite. La page est rendue à 1280 px de large (ce qu'une
 * visiteuse voit sur un ordinateur) puis réduite à la largeur RÉELLE du cadre, mesurée — plus une
 * largeur supposée qui la rendait minuscule dans un grand cadre. `interactif` : la page se manipule
 * (l'aperçu en grand) ; sinon un clic la traverse (fenêtre de la façade, punaise du mur).
 */
export function Apercu({
  lien,
  image,
  titre,
  interactif = false,
}: {
  lien: string | null;
  image: string | null;
  titre: string;
  largeur?: number;
  interactif?: boolean;
}) {
  const cadre = useRef<HTMLSpanElement>(null);
  const [l, setL] = useState(0);
  useLayoutEffect(() => {
    const el = cadre.current;
    if (!el) return undefined;
    const mesurer = () => setL(el.clientWidth);
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (image) return <img src={image} alt={titre} draggable={false} className="h-full w-full object-cover object-top" />;
  if (!lien) return null;
  const echelle = Math.max(0.05, (l || 190) / 1280);
  return (
    <span ref={cadre} className="absolute inset-0 overflow-hidden bg-[#f4f3f0]" aria-hidden={!interactif}>
      <iframe
        src={lien}
        title={titre}
        loading="lazy"
        tabIndex={interactif ? 0 : -1}
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
        className={`${interactif ? '' : 'pointer-events-none'} origin-top-left border-0`}
        style={{ width: 1280, height: Math.ceil((cadre.current?.clientHeight || 800) / echelle), transform: `scale(${echelle})` }}
      />
    </span>
  );
}

/** « Voir en grand » : la maquette à la taille de la fenêtre, et manipulable. Échap ou un clic dehors la ferme. */
export function MaquetteEnGrand({ lien, image, titre, onFermer }: { lien: string | null; image: string | null; titre: string; onFermer: () => void }) {
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [onFermer]);
  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-black/80 p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Maquette en grand : ${titre}`}
      onMouseDown={(e) => e.target === e.currentTarget && onFermer()}
      data-maquette-en-grand
    >
      <div className="mb-3 flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">{titre}</p>
        {lien && (
          <a href={lien} target="_blank" rel="noopener noreferrer" className="bx-btn2">
            Ouvrir {hoteDe(lien)} ↗
          </a>
        )}
        <button type="button" className="bx-btn" onClick={onFermer} autoFocus>
          Fermer
        </button>
      </div>
      <div className="relative min-h-0 flex-1 border border-[#3a3834] bg-[#f4f3f0]">
        <Apercu lien={lien} image={image} titre={titre} interactif />
      </div>
    </div>
  );
}
