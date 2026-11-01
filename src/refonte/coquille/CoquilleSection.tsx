import React from 'react';
import { Bouton, PastilleEtat } from '../../socle/ui';
import { useSocleLangue } from '../../socle/i18n';
import { ecrireCoquille, useCoquilleActive } from './drapeau';

/**
 * LE RÉGLAGE « NOUVELLE COQUILLE » — dans Paramètres, édition interne seulement.
 * Allume ou éteint, sur CE poste, la coquille noir et gris (une navigation,
 * un fil d'Ariane, ⌘K, ⌘J). Éteinte par défaut ; prend effet à l'instant.
 */
export function CoquilleSection() {
  const { ts } = useSocleLangue();
  const actif = useCoquilleActive();
  return (
    <section aria-labelledby="reglage-coquille" className="panel mt-6 flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="reglage-coquille" className="text-[16px] font-semibold text-text-primary">
          {ts('coquille.reglage.titre')}
        </h2>
        <PastilleEtat etat={actif ? 'succes' : 'neutre'}>{ts(actif ? 'coquille.reglage.allumee' : 'coquille.reglage.eteinte')}</PastilleEtat>
      </div>
      <p className="max-w-prose text-[14px] text-text-secondary">{ts('coquille.reglage.texte')}</p>
      <div>
        <Bouton variante="secondaire" taille="petit" aria-pressed={actif} onClick={() => ecrireCoquille(!actif)}>
          {ts(actif ? 'coquille.reglage.eteindre' : 'coquille.reglage.allumer')}
        </Bouton>
      </div>
    </section>
  );
}
