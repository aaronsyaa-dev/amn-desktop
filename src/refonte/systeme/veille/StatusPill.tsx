import React from 'react';
import { LiveDot } from '../../../socle/ui';
import { styleRang } from '../../../socle/couche-mouvement';
import { TON_PASTILLE, pointVivant, rondeMontree, type EtatPastille } from './etat';
import { useMots } from './i18n';

/**
 * LA PASTILLE D'ÉTAT DE LA GARDE, VERSION VEILLE (G09, `StatusPill`) — 34 px, bordée, SANS fond plein : le point
 * vivant du socle (`LiveDot`, 7 px ici), « La Garde veille », l'état en mots, et l'heure de la prochaine ronde en
 * monospace (`.sc-mono`) quand elle est connue. La couleur ne dit jamais l'état seule : le texte le dit.
 *
 * Au rouge, le point est FIXE et rien d'autre n'est dit (« une alerte critique ») : le détail n'apparaît qu'après
 * la reprise. `role="status"` : un changement d'état est annoncé, sans voler le focus.
 */
export function StatusPill({ etat, ronde }: { etat: EtatPastille; ronde: string | null }) {
  const { tm } = useMots();
  const sep = (
    <span aria-hidden className="ve-pastille__sep">
      ·
    </span>
  );
  const rondeVue = ronde && rondeMontree(etat) ? ronde : null;
  return (
    <p className="ve-pastille" data-etat={etat} role="status" data-mvt="entree" style={styleRang(2)}>
      <LiveDot ton={TON_PASTILLE[etat]} libelle="" onde={pointVivant(etat)} halo={false} />
      {etat === 'horsLigne' ? (
        <>
          <span className="ve-pastille__fort">{tm('horsLigne')}</span>
          {sep}
          <span>{tm('horsLigne.texte')}</span>
        </>
      ) : etat === 'inconnu' ? (
        <span className="ve-pastille__fort">{tm('inconnu')}</span>
      ) : (
        <>
          <span className="ve-pastille__fort">{tm('garde')}</span>
          {sep}
          <span>{tm(etat === 'critique' ? 'etat.critique' : etat === 'attention' ? 'etat.attention' : 'etat.calme')}</span>
          {rondeVue && (
            <>
              {sep}
              <span>{tm('ronde')}</span>
              <span className="sc-mono ve-pastille__ronde">{rondeVue}</span>
            </>
          )}
        </>
      )}
    </p>
  );
}
