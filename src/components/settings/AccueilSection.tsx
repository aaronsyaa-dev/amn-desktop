import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { ACCUEILS } from '@edition/accueils';
import { useAccueil } from '../../accueils/useAccueil';
import { Vignette } from '../../accueils/Vignette';

/**
 * L'ACCUEIL — onze façons de répondre à « qu'est-ce qu'on vient chercher en
 * ouvrant l'Accueil ? » (ACCUEILS.md).
 *
 * Le choix est PAR COMPTE (il vit sur le profil synchronisé et suit la
 * personne d'un poste à l'autre), et il ne tourne jamais tout seul : changer
 * d'Accueil chaque jour casserait l'habitude de lecture qui fait leur valeur.
 * Chaque Accueil est montré par sa vignette — sa structure, pas une capture.
 */
export function AccueilSection() {
  const { courant, choisir } = useAccueil();
  const [refus, setRefus] = useState(false);

  const prendre = async (code: string) => {
    setRefus(false);
    const ok = await choisir(code);
    if (!ok) setRefus(true);
  };

  return (
    <section className="panel p-4">
      <p className="eyebrow mb-2">Accueil</p>
      <p className="mb-4 max-w-2xl text-[12px] leading-relaxed text-text-secondary">
        L’écran qui s’ouvre en premier, et qui reste épinglé en tête de la barre latérale. Le choix vaut pour votre compte,
        sur tous vos postes ; il ne change jamais de lui-même.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="Accueil">
        {ACCUEILS.map((a) => {
          const actif = a.code === courant.code;
          return (
            <button
              key={a.code}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => void prendre(a.code)}
              className={`flex min-w-0 flex-col gap-2 border p-2.5 text-left transition-colors ${
                actif ? 'border-border-strong bg-surface-hover' : 'border-border hover:border-border-strong'
              }`}
            >
              <Vignette paves={a.vignette} actif={actif} />
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{a.code}</span>
                <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-text-primary">{a.nom}</span>
                {actif && <Check size={13} strokeWidth={2} className="flex-shrink-0 text-text-primary" />}
              </span>
              <span className="text-[11.5px] leading-snug text-text-secondary">{a.phrase}</span>
            </button>
          );
        })}
      </div>
      {refus && (
        <p className="mt-3 text-[12px] text-text-secondary">
          Pas enregistré : votre profil n’est pas encore synchronisé. Réessayez dans un instant.
        </p>
      )}
    </section>
  );
}
