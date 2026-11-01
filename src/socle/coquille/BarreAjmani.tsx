import React from 'react';
import { Raccourci } from '../ui';
import { useSocleLangue } from '../i18n';

/**
 * LA BARRE AJMANI (48 px) — une barre de texte, et rien d'autre.
 *
 * « Demandez à Ajmani, ou dites ce que vous voulez faire », ⌘J à droite. Ni
 * tête, ni avatar, ni icône de personnage : Ajmani n'existe que sous cette
 * forme et sous celle de la palette qu'elle ouvre. `check:socle` refuse qu'un
 * dessin y revienne.
 */
export function BarreAjmani({ onOuvrir, raccourci }: { onOuvrir: () => void; raccourci: string }) {
  const { ts } = useSocleLangue();
  return (
    <button
      type="button"
      onClick={onOuvrir}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+J Meta+J"
      title={ts('ajmani.barre.aide')}
      data-socle="ajmani"
      className="sc-ajmani sc-focus"
    >
      <span>{ts('ajmani.barre')}</span>
      <Raccourci>{raccourci}</Raccourci>
    </button>
  );
}
