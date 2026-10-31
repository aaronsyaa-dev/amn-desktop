import React from 'react';
import { Eye } from 'lucide-react';
import { useSocleLangue } from '../../i18n';
import { Bouton } from '../Bouton';
import { PileAvatars } from '../Pastilles';
import { propsBouton } from './statique';

/**
 * L'AVIS DE COLLABORATION (H43, modèle 8) — quelqu'un d'autre modifie la même page.
 *
 * Un avis, pas une alerte : les modifications sont fusionnées automatiquement, rien n'est écrasé et la version
 * écrasée est gardée comme copie. Il rassure, il ne reproche rien. Dans une page, il se pose en bandeau en haut.
 *
 *   avatars   — les personnes présentes (initiales seulement, jamais un visage), 26 px, qui se chevauchent de 7 px ;
 *   phrase    — « {prénom} modifie aussi cette page » ; `role="status"` : elle se met à jour en direct ;
 *   sous-carte — ce qui se passe, « fusionnés » en gras ;
 *   boutons   — « Différences » (ouvre la comparaison « Vous / {prénom} ») et « Garder les deux » (valide la fusion).
 *
 * Les prénoms sont des variables : `noms` (dans l'ordre d'affichage) et `prenom` (celui de la phrase).
 */
export interface AvisCollaborationProps {
  /** Les personnes à afficher en avatars. */
  noms: string[];
  /** Le prénom de la phrase : l'autre personne, ou « 2 personnes » quand elles sont plusieurs. */
  prenom: string;
  onDifferences: () => void;
  onGarderLesDeux: () => void;
  /** Aperçu : boutons `aria-disabled`, sans action. */
  statique?: boolean;
  className?: string;
}

export function AvisCollaboration({ noms, prenom, onDifferences, onGarderLesDeux, statique, className }: AvisCollaborationProps) {
  const { ts } = useSocleLangue();
  return (
    <div className={['sc-avis', className].filter(Boolean).join(' ')}>
      <div className="sc-avis__entete">
        <PileAvatars noms={noms} taille={26} libelle={ts('avis.pile')} />
        <p role="status" className="sc-avis__phrase">
          {ts('avis.phrase', { prenom })}
        </p>
      </div>
      <p className="sc-avis__fusion">
        {ts('avis.fusion.avant')}
        <b>{ts('avis.fusion.mot')}</b>
        {ts('avis.fusion.apres')}
      </p>
      <div className="sc-avis__actions">
        <Bouton variante="secondaire" taille="petit" icone={<Eye size={14} strokeWidth={1.9} />} {...propsBouton(statique, onDifferences)}>
          {ts('avis.differences')}
        </Bouton>
        <Bouton variante="primaire" taille="petit" {...propsBouton(statique, onGarderLesDeux)}>
          {ts('avis.garder')}
        </Bouton>
      </div>
    </div>
  );
}
