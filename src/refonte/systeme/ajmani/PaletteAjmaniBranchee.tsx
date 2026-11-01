import { useMemo } from 'react';
import { PaletteAjmaniRefonte, type PaletteAjmaniRefonteProps } from './PaletteAjmaniRefonte';
import { useActionsAjmani } from './useActionsAjmani';
import { useContextePalette } from './useContextePalette';
import { useDonneesAjmani, useTexteRelance } from './useDonneesAjmani';

/**
 * LA PALETTE, BRANCHÉE — les données réelles de l'application, le contexte de l'écran, les droits et la connexion.
 *
 * C'est la pièce que la coquille monte à la place de l'ancienne `PaletteAjmani` : elle ne reçoit que les trois
 * rappels qui sortent de la palette (aller quelque part, ouvrir la recherche, confier une demande à l'assistant).
 *
 *   <PaletteAjmaniBranchee
 *     ouverte={palette} onFermer={() => setPalette(false)}
 *     surDemander={demander} surAllerA={aller} surOuvrirRecherche={recherche.open}
 *   />
 *
 * Interne seulement : le mot « Ajmani » n'entre jamais dans l'édition cliente.
 */
export type PaletteAjmaniBrancheeProps = Pick<PaletteAjmaniRefonteProps, 'ouverte' | 'onFermer' | 'surDemander' | 'surAllerA' | 'surOuvrirRecherche'>;

export function PaletteAjmaniBranchee(props: PaletteAjmaniBrancheeProps) {
  const contexte = useContextePalette(props.ouverte);
  const lues = useDonneesAjmani();
  // « à jour à 10:42 » : l'heure où la palette a lu les données (à l'ouverture, puis à chaque changement).
  const donnees = useMemo(() => (props.ouverte ? { ...lues, luesA: new Date().toISOString() } : lues), [lues, props.ouverte]);
  const actions = useActionsAjmani();
  const texteRelance = useTexteRelance();
  return <PaletteAjmaniRefonte {...props} contexte={contexte} donnees={donnees} actions={actions} texteRelance={texteRelance} />;
}
