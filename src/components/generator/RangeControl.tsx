import React from 'react';

/**
 * UN CURSEUR, ET CE QU'IL DIT PENDANT QU'ON LE BOUGE (BLOC C)
 *
 * Le curseur est le seul contrôle qui rende une valeur PARCOURABLE. On ne
 * choisit pas cinq sièges dans une liste déroulante : on monte jusqu'à cinq et
 * on voit l'aperçu changer en chemin. C'est exactement la différence entre
 * cocher une case et configurer quelque chose — et c'est ce qui manquait.
 *
 * Trois choses le rendent utile plutôt que joli :
 *
 *   · LA PISTE SE REMPLIT. La valeur se lit sans lire le nombre.
 *   · LA CONSÉQUENCE EST ÉCRITE SOUS LE CURSEUR, et elle change avec lui. Un
 *     nombre nu ne dit rien ; « 6 sièges — Business premium recommandé » dit
 *     ce que le geste vient de décider. C'est `consequence` qui porte ça, et
 *     c'est le seul champ obligatoire au-delà des bornes : un curseur sans
 *     conséquence lisible est un curseur qu'on tourne à l'aveugle.
 *   · LE NOMBRE RESTE ATTEIGNABLE AU CLAVIER. Un réglage qui n'existe qu'à la
 *     souris exclut, et se règle mal au pixel près.
 */
export function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  consequence,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  /** La valeur, dite comme on la dirait à voix haute. */
  format: (value: number) => string;
  /** Ce que cette valeur ENTRAÎNE. Change avec le curseur. */
  consequence: string;
  /** Une ligne d'explication fixe, quand le libellé ne suffit pas. */
  hint?: string;
}) {
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const id = `range-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="eyebrow" htmlFor={id}>
          {label}
        </label>
        <span className="tnum text-[15px] font-medium text-text-primary">{format(value)}</span>
      </div>

      <input
        id={id}
        type="range"
        className="amn-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        // La piste se remplit jusqu'au pouce : voir `.amn-range` dans index.css.
        style={{ ['--amn-fill' as string]: `${fill}%` } as React.CSSProperties}
        aria-describedby={`${id}-consequence`}
      />

      <p id={`${id}-consequence`} className="text-[11px] leading-snug text-text-secondary">
        {consequence}
      </p>
      {hint && <p className="text-[11px] leading-snug text-text-muted">{hint}</p>}
    </div>
  );
}
