import React from 'react';
import { Flag } from 'lucide-react';
import type { Famille } from '../../familles';
import { useSocleLangue } from '../../i18n';
import type { EtatPastille } from '../Pastilles';

/** Une sous-carte : rayon 11, fond `#111112`, bordure `#212123`, rembourrage 12 × 14. Un encart dans une carte. */
export function SousCarte({ children, className = '', as: Balise = 'div' }: { children?: React.ReactNode; className?: string; as?: 'div' | 'section' | 'li' | 'article' }) {
  return (
    <Balise data-socle="sous-carte" className={`sc-sous-carte ${className}`.trim()}>
      {children}
    </Balise>
  );
}

/** Une étiquette de 11 px (tag) : un fait court, avec un point de famille ou d'état si besoin. */
export function Tag({ children, famille, etat }: { children: React.ReactNode; famille?: Famille; etat?: EtatPastille }) {
  return (
    <span data-famille={famille} data-etat={etat} className="sc-tag">
      {(famille || etat) && <span aria-hidden className="sc-point" data-taille="6" />}
      {children}
    </span>
  );
}

/** Le drapeau « Urgent » d'un ticket : 11 px / 600, rouge d'état sur fond teinté. L'icône accompagne toujours le mot. */
export function DrapeauUrgent({ children }: { children?: React.ReactNode }) {
  const { ts } = useSocleLangue();
  return (
    <span className="sc-urgent">
      <Flag aria-hidden size={11} strokeWidth={2.2} />
      {children ?? ts('urgent')}
    </span>
  );
}

/**
 * Une pastille de filtre à choix unique : active = fond `#ededed`, texte `#0c0c0d` 600 ; inactive = bordure
 * `#2e2e31`. Le compteur reste le total global. `aria-pressed` dit l'état, pas la couleur.
 */
export function PastilleFiltre({ actif, onClick, compteur, children }: { actif: boolean; onClick: () => void; compteur?: number | string; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={actif} onClick={onClick} className="sc-filtre sc-focus">
      <span>{children}</span>
      {compteur != null && <b className="sc-filtre__compteur">{compteur}</b>}
    </button>
  );
}
