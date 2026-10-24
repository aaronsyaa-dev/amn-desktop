import React from 'react';
import { Flag } from 'lucide-react';
import type { Famille } from '../familles';
import { Avatar } from './Pastilles';

/**
 * L'ACTIVITÉ D'UNE ÉQUIPE — une ligne qui dit qui a fait quoi, et l'étape
 * franchie quand il y a de quoi se féliciter (« 100 factures envoyées »).
 *
 * Le jalon est une carte, pas une animation : il se lit, il ne distrait pas.
 */
export function LigneActivite({ nom, texte, quand, famille }: { nom?: string | null; texte: string; quand: string; famille?: Famille }) {
  return (
    <li data-famille={famille} className="sc-activite">
      {nom ? <Avatar nom={nom} taille={26} /> : <span aria-hidden className="sc-point" style={{ margin: '0 9px' }} />}
      <span className="sc-activite__corps">
        <span className="sc-activite__texte">{texte}</span>
        <span className="sc-activite__quand">{[nom, quand].filter(Boolean).join(' · ')}</span>
      </span>
    </li>
  );
}

export function EtapeFranchie({ libelle, texte, quand, famille }: { libelle: string; texte: string; quand: string; famille?: Famille }) {
  return (
    <li data-famille={famille} className="sc-etape">
      <span aria-hidden className="sc-etape__marque">
        <Flag size={14} />
      </span>
      <span className="sc-activite__corps">
        <span className="sc-activite__texte" style={{ fontWeight: 500 }}>
          {texte}
        </span>
        <span className="sc-activite__quand">
          <span className="sc-etape__etiquette">{libelle}</span> · {quand}
        </span>
      </span>
    </li>
  );
}
