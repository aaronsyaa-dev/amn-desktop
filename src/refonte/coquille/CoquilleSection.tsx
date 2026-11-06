import React from 'react';
import { Carte, Interrupteur, PastilleEtat, Raccourci } from '../../socle/ui';
import { useSocleLangue } from '../../socle/i18n';
import { ecrireCoquille, useCoquilleActive } from './drapeau';

/**
 * LA SURFACE « NOUVELLE COQUILLE » DES RÉGLAGES — édition interne seulement.
 * Allume ou éteint, sur CE poste, la coquille noir et gris (une navigation,
 * un fil d'Ariane, ⌘K, ⌘J). Éteinte par défaut ; prend effet à l'instant.
 *
 * Sa composition, à elle : l'état en pastille dans l'en-tête de la carte ; les
 * quatre choses que la coquille apporte, avec leurs raccourcis ; puis une seule
 * ligne, l'interrupteur « La nouvelle coquille sur ce poste », dans un
 * `<label>` : le texte visible est relié au contrôle (un bouton est
 * étiquetable) et le cliquer bascule l'interrupteur. Les tailles de texte sont
 * celles de la `Carte` du socle, héritées.
 */
export function CoquilleSection() {
  const { ts } = useSocleLangue();
  const actif = useCoquilleActive();
  const points: { cle: 'coquille.reglage.point.navigation' | 'coquille.reglage.point.fil' | 'coquille.reglage.point.recherche' | 'coquille.reglage.point.ajmani'; raccourci?: string }[] = [
    { cle: 'coquille.reglage.point.navigation' },
    { cle: 'coquille.reglage.point.fil' },
    { cle: 'coquille.reglage.point.recherche', raccourci: '⌘K' },
    { cle: 'coquille.reglage.point.ajmani', raccourci: '⌘J' },
  ];
  return (
    <div id="reglages-coquille" data-reglage="coquille">
      <Carte titre={ts('coquille.reglage.titre')} actions={<PastilleEtat etat={actif ? 'succes' : 'neutre'}>{ts(actif ? 'coquille.reglage.allumee' : 'coquille.reglage.eteinte')}</PastilleEtat>}>
        <p className="max-w-2xl">{ts('coquille.reglage.texte')}</p>
        <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p.cle} className="flex items-center gap-2 text-socle-texte">
              {p.raccourci && <Raccourci>{p.raccourci}</Raccourci>}
              <span>{ts(p.cle)}</span>
            </li>
          ))}
        </ul>
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-4">
          <span className="font-medium text-socle-texte">{ts('coquille.reglage.surCePoste')}</span>
          <Interrupteur actif={actif} libelle={ts('coquille.reglage.surCePoste')} onChange={ecrireCoquille} />
        </label>
      </Carte>
    </div>
  );
}
