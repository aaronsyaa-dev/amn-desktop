import React from 'react';
import { motion, useReducedMotionConfig } from 'framer-motion';
import type { Famille } from '../familles';

/**
 * LA CARTE DU SOCLE — une surface graphite, éventuellement d'une famille.
 *
 * Avec `famille`, la carte porte `data-famille` (les variables `--fam-*` de
 * `src/index.css` descendent alors dans tout son contenu) et un filet de
 * 2 px de sa teinte en tête. Jamais un fond coloré : la famille dit où l'on
 * est, elle ne doit pas crier.
 *
 * Avec `onClick`, la carte entière devient un bouton (clavier, focus, rôle) et
 * se soulève d'un cran au survol — sauf mouvement réduit. Un bouton ne peut
 * contenir que du texte courant : le titre y devient un `<span>`, et
 * `actions` y est ignoré (un bouton dans un bouton n'est pas atteignable).
 */
export interface CarteProps {
  famille?: Famille;
  /** Le petit titre au-dessus du contenu : deux ou trois mots. */
  surtitre?: React.ReactNode;
  titre?: React.ReactNode;
  /** Posé à droite de l'en-tête : un bouton discret, un compteur. */
  actions?: React.ReactNode;
  /** `section` (défaut), `article` ou `div` — ignoré si la carte est cliquable. */
  as?: 'section' | 'article' | 'div';
  /** Le niveau de titre pour `titre` (défaut 2). */
  niveauTitre?: 2 | 3 | 4;
  onClick?: () => void;
  /** Nom accessible d'une carte cliquable, si le titre ne suffit pas. */
  'aria-label'?: string;
  className?: string;
  children?: React.ReactNode;
}

const SURFACE = 'relative overflow-hidden rounded-xl border border-socle-bord bg-socle-surface text-socle-texte';

export function Carte({ famille, surtitre, titre, actions, as = 'section', niveauTitre = 2, onClick, className = '', children, ...aria }: CarteProps) {
  const reduit = useReducedMotionConfig();
  const cliquable = Boolean(onClick);
  // Dans un bouton, tout reste du texte courant (voir l'en-tête).
  const Bloc = cliquable ? 'span' : 'div';
  const Titre = cliquable ? 'span' : (`h${niveauTitre}` as const);
  const Surtitre = cliquable ? 'span' : 'p';
  const aDroite = cliquable ? null : actions;

  const contenu = (
    <>
      {famille && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-[var(--fam)]" />}
      {(surtitre || titre || aDroite) && (
        <Bloc className="mb-3 flex items-start justify-between gap-3">
          <Bloc className="block min-w-0">
            {surtitre && (
              <Surtitre className={`block text-[11px] font-semibold uppercase tracking-[0.08em] ${famille ? 'text-[var(--fam-texte)]' : 'text-socle-texte-discret'}`}>{surtitre}</Surtitre>
            )}
            {titre && <Titre className="mt-0.5 block text-[16px] font-semibold leading-snug text-socle-texte">{titre}</Titre>}
          </Bloc>
          {aDroite && <div className="flex shrink-0 items-center gap-1">{aDroite}</div>}
        </Bloc>
      )}
      <Bloc className="block text-[14px] leading-relaxed text-socle-texte-doux">{children}</Bloc>
    </>
  );

  if (onClick) {
    return (
      <motion.button
        type="button"
        data-famille={famille}
        onClick={onClick}
        aria-label={aria['aria-label']}
        whileHover={reduit ? undefined : { y: -2 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        className={`${SURFACE} block w-full p-4 text-left transition-colors hover:border-socle-bord-fort hover:bg-socle-eleve focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus ${className}`}
      >
        {contenu}
      </motion.button>
    );
  }

  const Balise = as;
  return (
    <Balise data-famille={famille} aria-label={aria['aria-label']} className={`${SURFACE} p-4 ${className}`}>
      {contenu}
    </Balise>
  );
}
