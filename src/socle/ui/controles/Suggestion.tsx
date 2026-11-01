import React, { useId } from 'react';
import { useSocleLangue } from '../../i18n';
import { Bouton } from '../Bouton';

/**
 * L'étincelle d'Ajmani : huit rayons, en trait fin (24 × 24, trait 1,8, extrémités rondes). C'est le SEUL signe
 * d'Ajmani avec son nom — jamais un visage, un avatar, une lettre ni un logo. Verte (`--socle-etat-succes`) par défaut.
 */
export function IconeEtincelle({ taille = 16, className = '' }: { taille?: number; className?: string }) {
  return (
    <svg aria-hidden width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={`sc-etincelle ${className}`.trim()}>
      <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
      <path d="M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" opacity="0.7" />
    </svg>
  );
}

export interface ActionSuggestion {
  libelle: string;
  onClick: () => void;
  icone?: React.ReactNode;
}

/**
 * La suggestion d'Ajmani : une carte teintée (dégradé `#17181a` → `#141415`, bordure `#2c2e32`) avec l'étincelle
 * verte, un titre, un texte et deux boutons — le premier est le SEUL second bouton blanc autorisé d'un écran
 * (exception du socle, §3). « Plus tard » masque 7 jours ; l'appelant gère cette règle.
 */
export function SuggestionAjmani({ titre, texte, primaire, secondaire, className = '' }: { titre: string; texte: React.ReactNode; primaire: ActionSuggestion; secondaire?: ActionSuggestion; className?: string }) {
  const { ts } = useSocleLangue();
  const id = useId();
  return (
    <section aria-labelledby={id} data-socle="suggestion" className={`sc-suggestion ${className}`.trim()}>
      <p className="sc-suggestion__entete">
        <IconeEtincelle taille={12} />
        <span>{ts('suggestion.titre')}</span>
      </p>
      <h3 id={id} className="sc-suggestion__titre">
        {titre}
      </h3>
      <p className="sc-suggestion__texte">{texte}</p>
      <div className="sc-suggestion__actions">
        <Bouton variante="primaire" icone={primaire.icone} onClick={primaire.onClick}>
          {primaire.libelle}
        </Bouton>
        {secondaire && (
          <Bouton variante="secondaire" icone={secondaire.icone} onClick={secondaire.onClick}>
            {secondaire.libelle}
          </Bouton>
        )}
      </div>
    </section>
  );
}
