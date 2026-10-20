import React, { useId } from 'react';

/**
 * LE CHAMP DE SAISIE DU SOCLE — intitulé, aide, erreur, unité.
 *
 * Mêmes règles que `src/components/formulaire/Champ.tsx` (l'intitulé est un
 * vrai `<label>`, jamais un placeholder ; l'exemple vit dans l'aide), sur les
 * surfaces graphite. Une différence assumée : le champ actif n'est PAS ambre.
 * Dans la refonte, l'ambre est réservé aux décisions qui attendent ; le
 * focus prend l'anneau neutre du socle.
 *
 * L'erreur se dit en texte (relié par `aria-describedby`, et `aria-invalid`),
 * pas seulement par la couleur de la bordure.
 */
export interface SaisieProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  etiquette: string;
  aide?: string;
  erreur?: string;
  /** L'unité posée dans le champ (€, h, %) — jamais dans l'intitulé. */
  suffixe?: string;
}

export const Saisie = React.forwardRef<HTMLInputElement, SaisieProps>(function Saisie(
  { etiquette, aide, erreur, suffixe, id, className = '', ...reste },
  ref,
) {
  const auto = useId();
  const idChamp = id ?? auto;
  const idAide = `${idChamp}-aide`;
  const idErreur = `${idChamp}-erreur`;
  const decrit = [aide ? idAide : null, erreur ? idErreur : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idChamp} className="text-[13px] font-semibold text-socle-texte">
        {etiquette}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={idChamp}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit}
          className={[
            'w-full rounded-lg border bg-socle-creux px-3 py-2.5 text-[14.5px] text-socle-texte outline-none transition-colors',
            'placeholder:text-socle-texte-discret',
            'focus-visible:border-socle-focus focus-visible:ring-2 focus-visible:ring-socle-focus/25',
            'disabled:cursor-not-allowed disabled:opacity-60',
            erreur ? 'border-etat-danger' : 'border-socle-bord-fort',
            suffixe ? 'pr-10' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...reste}
        />
        {suffixe && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-socle-texte-discret">
            {suffixe}
          </span>
        )}
      </div>
      {aide && (
        <p id={idAide} className="text-[12.5px] leading-relaxed text-socle-texte-discret">
          {aide}
        </p>
      )}
      {erreur && (
        <p id={idErreur} className="text-[12.5px] font-medium leading-relaxed text-etat-danger-texte">
          {erreur}
        </p>
      )}
    </div>
  );
});
