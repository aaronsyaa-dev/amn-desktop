import React from 'react';
import { Carte, Interrupteur, Segmente, Selecteur } from '../../../socle/ui';
import { useCoquilleActive } from '../../coquille/drapeau';
import { useMots } from './i18n';
import { DELAIS_VEILLE, DELAIS_VERROU, ecrireReglageVeille, useReglageVeille } from './reglage';

/**
 * LA SURFACE « ÉCRAN DE VEILLE » DES RÉGLAGES (H18, pour G09) — édition interne seulement : elle passe par la porte
 * `MouvementSection` de `@edition/socle`, dont le jumeau client rend `null` (le paquet client ne change pas).
 *
 * Sa composition, à elle : une carte du socle dont l'en-tête porte l'interrupteur (afficher ou non l'écran de
 * veille, sur ce poste) ; le texte dit ce que l'écran montre et quand il ne vient jamais ; puis deux délais côte à
 * côte — « Veille après » dans un segmenté (5, 10, 15, 30 min ; 5 par défaut) et « Verrouiller l'espace après »
 * dans une liste (15, 30, 60 min ou jamais ; 15 par défaut), dont l'aide dit honnêtement qu'il ne change rien
 * aujourd'hui : l'application n'a pas de verrouillage après inactivité, et on n'en crée pas ici. Interrupteur
 * éteint : les deux délais restent lisibles mais ne se changent plus.
 */
export function EcranDeVeilleSection() {
  const { tm } = useMots();
  const reglage = useReglageVeille();
  const coquille = useCoquilleActive();

  return (
    <div id="reglages-ecran-de-veille" data-reglage="ecran-de-veille">
      <Carte titre={tm('reglage.titre')} actions={<Interrupteur actif={reglage.actif} libelle={tm('reglage.activer')} onChange={(actif) => ecrireReglageVeille({ actif })} />}>
        <p className="max-w-2xl">{tm('reglage.texte')}</p>
        <p className="mt-1 max-w-2xl">
          {tm('reglage.jamaisPendant')}
          {!coquille && ` ${tm('reglage.coquille')}`}
        </p>
        <fieldset disabled={!reglage.actif} className="mt-4 grid gap-4 border-0 p-0 sm:grid-cols-2">
          <legend className="sr-only">{tm('reglage.activer')}</legend>
          <div className="sc-champ">
            <span className="sc-champ__etiquette">
              {tm('reglage.veille')}
            </span>
            <Segmente
              libelle={tm('reglage.veille')}
              options={DELAIS_VEILLE.map((n) => ({ cle: String(n), libelle: tm('reglage.minutes', { n }) }))}
              valeur={String(reglage.veilleMin)}
              onChange={(cle) => ecrireReglageVeille({ veilleMin: Number(cle) })}
            />
          </div>
          <Selecteur etiquette={tm('reglage.verrou')} aide={tm('reglage.verrou.aide')} value={String(reglage.verrouMin)} onChange={(e) => ecrireReglageVeille({ verrouMin: Number(e.target.value) })}>
            {DELAIS_VERROU.map((n) => (
              <option key={n} value={String(n)}>
                {n === 0 ? tm('reglage.jamais') : tm('reglage.minutes', { n })}
              </option>
            ))}
          </Selecteur>
        </fieldset>
      </Carte>
    </div>
  );
}
