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
    <div className="sc-champ">
      <label htmlFor={idChamp} className="sc-champ__etiquette">
        {etiquette}
      </label>
      <div className="sc-champ__zone">
        <input
          ref={ref}
          id={idChamp}
          data-socle="champ"
          data-suffixe={suffixe ? 'true' : undefined}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit}
          className={`sc-champ__controle ${className}`.trim()}
          {...reste}
        />
        {suffixe && (
          <span aria-hidden className="sc-champ__suffixe">
            {suffixe}
          </span>
        )}
      </div>
      {aide && (
        <p id={idAide} className="sc-champ__aide">
          {aide}
        </p>
      )}
      {erreur && (
        <p id={idErreur} className="sc-champ__erreur">
          {erreur}
        </p>
      )}
    </div>
  );
});
