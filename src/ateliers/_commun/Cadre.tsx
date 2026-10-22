import React, { useId } from 'react';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import type { Famille } from '../../socle/familles';
import { useSocleLangue } from '../../socle/i18n';
import { useTextesCommuns } from './i18n';

/**
 * LE CADRE D'UN ÉCRAN D'ATELIER — noir et gris, Inter, la famille en petit point.
 *
 * Règles tenues par `verifier.mjs` sur chaque écran : un seul bouton
 * `primaire` (le blanc plein), aucune couleur en dur, aucun appel réseau.
 * La famille ne colore qu'un point de 8 px et le surtitre : jamais un fond.
 */
export function CadreAtelier({ famille, nom, intro, children }: { famille: Famille; nom: string; intro: string; children: React.ReactNode }) {
  const { ts } = useSocleLangue();
  const { tx } = useTextesCommuns();
  return (
    <div data-famille={famille} data-atelier className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 font-[Inter,system-ui,sans-serif] text-socle-texte">
      <header className="flex flex-col gap-1.5">
        <p className="flex items-center gap-2 text-[12px] font-medium text-socle-texte-discret">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-[var(--fam)]" />
          {ts(`famille.${famille}`)} · {tx('atelier')}
        </p>
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.01em]">{nom}</h1>
        <p className="max-w-2xl text-[14px] leading-relaxed text-socle-texte-doux">{intro}</p>
      </header>
      {children}
      <p className="border-t border-socle-bord pt-4 text-[12px] text-socle-texte-discret">{tx('bacASable')}</p>
    </div>
  );
}

/** Un chiffre clé : petit intitulé, grand nombre, une ligne d'explication. */
export function Chiffre({ intitule, valeur, detail, fort = false }: { intitule: string; valeur: string; detail?: string; fort?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl border p-4 ${fort ? 'border-socle-bord-fort bg-socle-eleve' : 'border-socle-bord bg-socle-surface'}`}>
      <span className="text-[12px] font-medium text-socle-texte-discret">{intitule}</span>
      <span className={`font-semibold tabular-nums leading-tight ${fort ? 'text-[28px]' : 'text-[20px]'}`}>{valeur}</span>
      {detail && <span className="text-[12.5px] leading-relaxed text-socle-texte-doux">{detail}</span>}
    </div>
  );
}

export type Ton = 'neutre' | 'succes' | 'attention' | 'danger';

const POINT: Record<Ton, string> = {
  neutre: 'bg-socle-texte-discret',
  succes: 'bg-etat-succes',
  attention: 'bg-etat-attention',
  danger: 'bg-etat-danger',
};

/** Un état dit en texte, avec un petit point : la couleur ne porte jamais seule le sens. */
export function Etat({ ton, children }: { ton: Ton; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-socle-texte-doux">
      <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${POINT[ton]}`} />
      {children}
    </span>
  );
}

/** Une liste déroulante au gabarit de `Saisie` (le socle n'en a pas encore). */
export function Choix<V extends string>({
  etiquette,
  valeur,
  options,
  onChange,
  aide,
}: {
  etiquette: string;
  valeur: V;
  options: readonly { valeur: V; libelle: string }[];
  onChange: (v: V) => void;
  aide?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-socle-texte">
        {etiquette}
      </label>
      <select
        id={id}
        value={valeur}
        onChange={(e) => onChange(e.target.value as V)}
        aria-describedby={aide ? `${id}-aide` : undefined}
        className="w-full rounded-lg border border-socle-bord-fort bg-socle-creux px-3 py-2.5 text-[14.5px] text-socle-texte outline-none focus-visible:border-socle-focus focus-visible:ring-2 focus-visible:ring-socle-focus/25"
      >
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
      {aide && (
        <p id={`${id}-aide`} className="text-[12.5px] leading-relaxed text-socle-texte-discret">
          {aide}
        </p>
      )}
    </div>
  );
}

/** Un tableau sobre : en-têtes discrets, lignes séparées par un filet, chiffres alignés à droite. */
export function Tableau({ entetes, lignes, droite = [] }: { entetes: readonly string[]; lignes: readonly (readonly React.ReactNode[])[]; droite?: readonly number[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-socle-bord">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="bg-socle-surface">
            {entetes.map((e, i) => (
              <th key={i} scope="col" className={`px-3 py-2 text-[12px] font-semibold text-socle-texte-discret ${droite.includes(i) ? 'text-right' : 'text-left'}`}>
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i} className="border-t border-socle-bord">
              {l.map((c, j) => (
                <td key={j} className={`px-3 py-2 text-socle-texte-doux ${droite.includes(j) ? 'text-right tabular-nums' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
