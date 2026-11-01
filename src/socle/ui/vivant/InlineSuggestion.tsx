import React from 'react';
import { useSocleLangue } from '../../i18n';
import { IconeEtincelle } from '../controles/Suggestion';

/**
 * LA SUGGESTION EN LIGNE (`InlineSuggestion`) — v3, §0.4 : un bandeau posé dans la surface (un détail, une
 * fiche), l'étincelle verte d'Ajmani, une phrase, et deux réponses « Oui » / « Non ». Jamais d'avatar ni de
 * visage : l'étincelle est le seul signe d'Ajmani.
 *
 * Les deux boutons sont secondaires (le primaire de l'écran reste unique) et font 34 px de haut. Le groupe est
 * nommé « Suggestion d'Ajmani » pour les lecteurs d'écran ; la phrase dit ce qui serait fait.
 */
export interface InlineSuggestionProps {
  /** La proposition, en une phrase (« Relier ce message au projet A ? »). */
  texte: React.ReactNode;
  onOui: () => void;
  onNon: () => void;
  /** Défaut « Oui ». */
  libelleOui?: string;
  /** Défaut « Non ». */
  libelleNon?: string;
  className?: string;
}

export function InlineSuggestion({ texte, onOui, onNon, libelleOui, libelleNon, className = '' }: InlineSuggestionProps) {
  const { ts } = useSocleLangue();
  return (
    <div role="group" aria-label={ts('suggestion.titre')} className={`sc-suggestion-ligne ${className}`.trim()} data-socle="suggestion-ligne">
      <IconeEtincelle taille={14} />
      <p className="sc-suggestion-ligne__texte">{texte}</p>
      <div className="sc-suggestion-ligne__actions">
        <button type="button" onClick={onOui} className="sc-suggestion-ligne__bouton sc-focus" data-reponse="oui">
          {libelleOui ?? ts('vivant.suggestion.oui')}
        </button>
        <button type="button" onClick={onNon} className="sc-suggestion-ligne__bouton sc-focus" data-reponse="non">
          {libelleNon ?? ts('vivant.suggestion.non')}
        </button>
      </div>
    </div>
  );
}
