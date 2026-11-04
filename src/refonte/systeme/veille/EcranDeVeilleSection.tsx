import React from 'react';
import { useCoquilleActive } from '../../coquille/drapeau';
import { useMots } from './i18n';
import { DELAIS_VEILLE, DELAIS_VERROU, ecrireReglageVeille, useReglageVeille } from './reglage';

/**
 * LA LIGNE « ÉCRAN DE VEILLE » DES RÉGLAGES (H18, pour G09) — édition interne seulement : elle passe par la porte
 * `MouvementSection` de `@edition/socle`, dont le jumeau client rend `null` (le paquet client ne change pas).
 *
 * Trois choix, pour ce poste : afficher ou non l'écran de veille ; le délai de veille (5 min par défaut) ; le délai
 * de verrouillage (15 min par défaut, « Jamais » = 0). Ce dernier est enregistré, et l'aide dit honnêtement qu'il ne
 * change rien aujourd'hui : l'application n'a pas de verrouillage après inactivité, et on n'en crée pas ici.
 *
 * Habillée comme ses voisines (`panel`, `eyebrow`) : l'écran des réglages n'a pas encore migré vers le socle.
 * Groupes de boutons radio natifs (flèches et Espace au clavier), cibles de 36 px et plus.
 */
export function EcranDeVeilleSection() {
  const { tm } = useMots();
  const reglage = useReglageVeille();
  const coquille = useCoquilleActive();
  const puce = (choisi: boolean, inactif: boolean) =>
    `inline-flex min-h-11 cursor-pointer items-center gap-2 border px-3 text-[13px] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-text-primary)] md:min-h-9 ${
      choisi ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-secondary hover:border-border-strong'
    } ${inactif ? 'cursor-not-allowed opacity-60' : ''}`;

  return (
    <section className="panel p-4" id="reglages-ecran-de-veille" aria-labelledby="reglages-ecran-de-veille-titre">
      <p className="eyebrow mb-1" id="reglages-ecran-de-veille-titre">
        {tm('reglage.titre')}
      </p>
      <p className="mb-1 max-w-2xl text-[12px] leading-relaxed text-text-secondary">{tm('reglage.texte')}</p>
      <p className="mb-3 max-w-2xl text-[12px] leading-relaxed text-text-secondary">
        {tm('reglage.jamaisPendant')}
        {!coquille && ` ${tm('reglage.coquille')}`}
      </p>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-border-row pb-3 md:min-h-9">
        <input
          type="checkbox"
          role="switch"
          aria-checked={reglage.actif}
          checked={reglage.actif}
          onChange={(e) => ecrireReglageVeille({ actif: e.target.checked })}
          className="h-4 w-4 flex-none accent-[var(--color-text-primary)]"
        />
        <span className="text-[13.5px] font-semibold text-text-primary">{tm('reglage.activer')}</span>
      </label>

      <fieldset className="mt-3 border-0 p-0" disabled={!reglage.actif}>
        <legend className="mb-2 text-[12.5px] text-text-secondary">{tm('reglage.veille')}</legend>
        <div className="flex flex-wrap gap-2">
          {DELAIS_VEILLE.map((n) => (
            <label key={n} className={puce(reglage.veilleMin === n, !reglage.actif)}>
              <input type="radio" name="amn-veille-delai" value={n} checked={reglage.veilleMin === n} onChange={() => ecrireReglageVeille({ veilleMin: n })} className="sr-only" />
              <span>{tm('reglage.minutes', { n })}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4 border-0 p-0" disabled={!reglage.actif}>
        <legend className="mb-2 text-[12.5px] text-text-secondary">{tm('reglage.verrou')}</legend>
        <div className="flex flex-wrap gap-2">
          {DELAIS_VERROU.map((n) => (
            <label key={n} className={puce(reglage.verrouMin === n, !reglage.actif)}>
              <input type="radio" name="amn-veille-verrou" value={n} checked={reglage.verrouMin === n} onChange={() => ecrireReglageVeille({ verrouMin: n })} className="sr-only" />
              <span>{n === 0 ? tm('reglage.jamais') : tm('reglage.minutes', { n })}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-text-secondary">{tm('reglage.verrou.aide')}</p>
      </fieldset>
    </section>
  );
}
