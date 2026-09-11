import React, { useId } from 'react';

/**
 * UN CHAMP DE FORMULAIRE — la même voix partout (système de design, §5.2).
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Jusqu'ici chaque écran dessinait ses champs à la main : un `<label>` ici, un
 * `placeholder` en guise d'intitulé là, une phrase d'aide parfois, jamais au
 * même endroit. Rien de faux isolément — mais soixante-huit modules qui
 * demandent la même chose de soixante-huit façons.
 *
 * Trois règles portées par ce composant, et qu'aucun appelant n'a plus à
 * connaître :
 *
 *   1. L'INTITULÉ EST UN SURTITRE, pas un placeholder. Un placeholder disparaît
 *      dès qu'on tape : la personne qui revient sur un formulaire à moitié
 *      rempli ne sait plus ce qu'elle a écrit où.
 *   2. UN CHAMP NE MONTRE JAMAIS UNE VALEUR ET SON EXEMPLE EN MÊME TEMPS.
 *      L'exemple vit dans la phrase d'aide, en dessous, où il reste lisible.
 *   3. LE CHAMP ACTIF EST LE SEUL AMBRE DU FORMULAIRE. C'est là que la personne
 *      agit ; rien d'autre sur l'écran ne doit disputer ce signal.
 */
export function Champ({
  intitule,
  aide,
  suffixe,
  children,
}: {
  /** Le surtitre du champ : deux ou trois mots, jamais une phrase. */
  intitule: string;
  /** Ce que la personne doit savoir pour répondre, l'exemple compris. */
  aide?: string;
  /** L'unité posée dans le champ (€, h, %) — jamais dans l'intitulé. */
  suffixe?: string;
  /** Le contrôle lui-même : `<input>`, `<textarea>`, `<select>`. */
  children: React.ReactElement<{ id?: string; className?: string }>;
}) {
  const id = useId();
  const controle = React.cloneElement(children, {
    id: children.props.id ?? id,
    className: [
      'w-full border border-border bg-sunken px-3.5 py-2.5 text-[14.5px] text-text-primary outline-none transition-colors',
      'placeholder:text-text-muted',
      // Le liseré ambre du champ actif — la règle 3 ci-dessus.
      'focus:border-signal focus:bg-[#0b0b0b]',
      suffixe ? 'pr-10' : '',
      children.props.className ?? '',
    ]
      .filter(Boolean)
      .join(' '),
  });

  return (
    <div className="flex flex-col">
      <label htmlFor={children.props.id ?? id} className="eyebrow mb-2">
        {intitule}
      </label>
      <div className="relative">
        {controle}
        {suffixe && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[12.5px] text-text-muted">
            {suffixe}
          </span>
        )}
      </div>
      {aide && <p className="mt-2 text-[12.5px] leading-[1.6] text-text-muted">{aide}</p>}
    </div>
  );
}

/**
 * Une case à cocher, à la même voix. Séparée de `Champ` parce qu'elle n'a ni
 * surtitre ni phrase d'aide : son intitulé est à droite et se lit d'un trait.
 */
export function Case({
  coche,
  onChange,
  children,
}: {
  coche: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-text-primary md:min-h-0">
      <input
        type="checkbox"
        checked={coche}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[18px] w-[18px] flex-shrink-0 cursor-pointer appearance-none border border-border-strong bg-sunken checked:border-accent checked:bg-accent"
      />
      <span>{children}</span>
    </label>
  );
}
