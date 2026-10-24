import React from 'react';
import { motion, useReducedMotionConfig, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useSocleLangue } from '../i18n';

/**
 * LE BOUTON DU SOCLE — quatre variantes, trois tailles, un état de chargement.
 *
 *   primaire   — l'action principale de l'écran ou de la fenêtre. Une par vue.
 *   secondaire — une action d'égale dignité, moins pressée (Annuler, Exporter).
 *   discret    — une action de passage, sans cadre (Voir tout, Modifier).
 *   danger     — détruit ou retire. Jamais l'action par défaut d'une fenêtre.
 *
 * L'ambre n'est PAS une variante : un bouton n'est pas une décision qui
 * attend, c'est le moyen d'en prendre une.
 *
 * `chargement` garde la largeur du bouton (le libellé reste sous la roue,
 * transparent mais toujours lu par les lecteurs d'écran), pose `aria-busy` et
 * bloque les clics : un double envoi pendant qu'une facture part est
 * exactement ce qu'il empêche.
 */
export type VarianteBouton = 'primaire' | 'secondaire' | 'discret' | 'danger';
export type TailleBouton = 'petit' | 'moyen' | 'grand';

export interface BoutonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variante?: VarianteBouton;
  taille?: TailleBouton;
  chargement?: boolean;
  /** Une icône posée avant le libellé (lucide-react, 16 px conseillés). */
  icone?: React.ReactNode;
  pleineLargeur?: boolean;
  children?: React.ReactNode;
}

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-lg font-semibold ' +
  'transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus ' +
  'disabled:cursor-not-allowed aria-busy:cursor-progress';

const VARIANTES: Record<VarianteBouton, string> = {
  primaire:
    'bg-socle-primaire text-socle-primaire-encre shadow-[0_1px_2px_rgba(0,0,0,0.35)] hover:bg-socle-primaire-survol ' +
    'disabled:bg-socle-eleve disabled:text-socle-texte-discret disabled:shadow-none',
  secondaire:
    'border border-socle-bord-fort bg-transparent text-socle-texte hover:bg-socle-survol ' +
    'disabled:border-socle-bord disabled:text-socle-texte-discret disabled:hover:bg-transparent',
  discret:
    'bg-transparent text-socle-texte-doux hover:bg-socle-survol hover:text-socle-texte ' +
    'disabled:text-socle-texte-discret disabled:hover:bg-transparent',
  danger:
    'bg-etat-danger-plein text-etat-danger-encre hover:bg-etat-danger-plein-survol ' +
    'disabled:bg-socle-eleve disabled:text-socle-texte-discret',
};

const TAILLES: Record<TailleBouton, string> = {
  petit: 'min-h-8 px-3 text-[13px]',
  moyen: 'min-h-10 px-4 text-[14px]',
  grand: 'min-h-12 px-5 text-[15px]',
};

export const Bouton = React.forwardRef<HTMLButtonElement, BoutonProps>(function Bouton(
  { variante = 'secondaire', taille = 'moyen', chargement = false, icone, pleineLargeur = false, disabled, className = '', type = 'button', children, ...reste },
  ref,
) {
  const { ts } = useSocleLangue();
  const reduit = useReducedMotionConfig();
  const inactif = disabled || chargement;

  return (
    <motion.button
      ref={ref}
      type={type}
      data-socle="bouton"
      data-variante={variante}
      data-taille={taille}
      disabled={inactif}
      aria-busy={chargement || undefined}
      whileTap={inactif || reduit ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 600, damping: 32 }}
      className={[BASE, VARIANTES[variante], TAILLES[taille], pleineLargeur ? 'w-full' : '', className].filter(Boolean).join(' ')}
      {...reste}
    >
      <span className={`inline-flex items-center gap-2 ${chargement ? 'opacity-0' : ''}`}>
        {icone && <span aria-hidden className="inline-flex shrink-0">{icone}</span>}
        {children}
      </span>
      {chargement && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 aria-hidden size={16} className="animate-spin motion-reduce:animate-none" />
          <span className="sr-only">{ts('bouton.chargement')}</span>
        </span>
      )}
    </motion.button>
  );
});
