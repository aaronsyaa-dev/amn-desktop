import React from 'react';
import { Caret, IconeEtincelle, Raccourci } from '../ui';
import { useSocleLangue } from '../i18n';

/**
 * LA BARRE AJMANI v3 (46 px, rayon 14 ; 01-SOCLE-DESIGN §0.4) — une barre de texte, et rien d'autre.
 *
 * L'étincelle (le seul signe d'Ajmani avec son nom), le curseur qui clignote avant le texte, le texte — « Demandez
 * à Ajmani, ou dites ce que vous voulez faire », ou celui que l'écran donne (`texte`) —, puis « Entrée pour
 * envoyer » et ⌘J à droite. Au survol, la bordure passe à `#3a3a3e`. Ni tête, ni avatar, ni personnage : Ajmani
 * n'existe que sous cette forme et sous celle de la palette qu'elle ouvre. `check:socle` refuse qu'un dessin y
 * revienne.
 */
export function BarreAjmani({ onOuvrir, raccourci, texte }: { onOuvrir: () => void; raccourci: string; texte?: string }) {
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
      <IconeEtincelle taille={16} className="sc-ajmani__etincelle" />
      <Caret className="sc-ajmani__curseur" />
      <span className="sc-ajmani__texte">{texte || ts('ajmani.barre')}</span>
      <span aria-hidden className="sc-ajmani__envoi">
        {ts('ajmani.barre.envoi')}
      </span>
      <Raccourci>{raccourci}</Raccourci>
    </button>
  );
}
