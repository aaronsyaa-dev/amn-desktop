import React from 'react';
import { REGISTRES, ecrireRegistre, useRegistre, type Registre } from './registre';
import { useAccueilLangue, type CleAccueil } from '../i18n';
import { AjmaniPetit } from './Ajmani';
import type { Emotion } from './expressions';

const LIBELLES: Record<Registre, { titre: CleAccueil; aide: CleAccueil; emotion: Emotion }> = {
  serieux: { titre: 'registre.serieux', aide: 'registre.serieux.aide', emotion: 'concentre' },
  chill: { titre: 'registre.chill', aide: 'registre.chill.aide', emotion: 'content' },
  taquin: { titre: 'registre.taquin', aide: 'registre.taquin.aide', emotion: 'taquin' },
};

/**
 * Le réglage du ton, dans Paramètres — habillé comme sa voisine Mouvement
 * (`panel`, `eyebrow`, boutons radio) pour ne pas faire tache.
 */
export function RegistreSection() {
  const { ta } = useAccueilLangue();
  const registre = useRegistre();
  return (
    <section className="panel p-4" id="reglages-registre">
      <div className="flex items-start gap-3">
        <AjmaniPetit emotion={LIBELLES[registre].emotion} taille={44} />
        <div className="min-w-0">
          <p className="eyebrow mb-1" id="reglages-registre-titre">
            {ta('registre.titre')}
          </p>
          <p className="mb-3 max-w-2xl text-[12px] leading-relaxed text-text-secondary">{ta('registre.texte')}</p>
        </div>
      </div>
      <div role="radiogroup" aria-labelledby="reglages-registre-titre" className="flex flex-col">
        {REGISTRES.map((r) => (
          <label key={r} className="flex cursor-pointer items-start gap-3 border-b border-border-row py-3 last:border-b-0">
            <input
              type="radio"
              name="amn-ajmani-registre"
              value={r}
              checked={registre === r}
              onChange={() => ecrireRegistre(r)}
              className="mt-1 h-4 w-4 flex-none accent-[var(--color-text-primary)]"
            />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-text-primary">{ta(LIBELLES[r].titre)}</span>
              <span className="block text-[12px] leading-relaxed text-text-secondary">{ta(LIBELLES[r].aide)}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
