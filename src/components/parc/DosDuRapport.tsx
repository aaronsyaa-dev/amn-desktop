import React, { useMemo } from 'react';
import { useHaloSignal } from '../EtatEcran';
import type { Section } from '../../lib/rapportClient';

/**
 * PARC · RAPPORT CLIENT ENRICHI — le dos du document.
 *
 * Le sommaire est une liste de bascules ; à sa gauche se dresse LE DOS DU
 * DOCUMENT — une pile verticale où chaque section occupe la hauteur de ce
 * qu'elle pèse. Un sommaire seul ne dit pas qu'une case à cocher double le
 * rapport ; le dos le montre AVANT qu'on clique.
 *
 * Une section DÉCOCHÉE GARDE SON SEGMENT, EN CREUX : on voit ce qu'elle
 * coûterait avant de la cocher. Toute section du sommaire a un segment, et
 * tout segment a une ligne au sommaire — les deux viennent du même tableau,
 * `sectionsDuRapport`.
 *
 * L'AMBRE, unique : la section la plus lourde qu'on puisse décocher — sa
 * bascule, son libellé, son poids et son segment dans le dos. Quatre nœuds,
 * tous dans la carte dominante. C'est celle dont la case à cocher change le
 * plus le document, donc la seule qui demande une décision.
 *
 * LE DOS NE PORTE AUCUN TEXTE. Si un poids devient trop fin pour porter un
 * libellé, le libellé sort du segment — c'est le sommaire à côté qui nomme. Le
 * dos ne fait qu'une chose : montrer des proportions.
 *
 * L'UNITÉ EST LA LIGNE, PAS LA PAGE. Le rapport n'est pas paginé : il s'imprime
 * par le navigateur, et sa pagination dépend du papier, de la fonte et de la
 * marge. Compter en pages aurait demandé un chiffre que personne ne mesure ;
 * les lignes, elles, se comptent. Voir `lib/rapportClient.ts`.
 */

/** La hauteur d'une ligne dans le dos. C'est la SEULE échelle : une ligne vaut ceci, partout. */
const LIGNE_PX = 9;
/** Un segment d'une ligne resterait invisible entre deux traits : on lui garde de quoi exister. */
const SEGMENT_MIN = 6;
/** En deçà, une section ne change pas assez le document pour qu'on ait à trancher. */
const PART_DECISIVE = 0.2;

export function DosDuRapport({
  sections,
  choisies,
  onBasculer,
}: {
  sections: Section[];
  choisies: Set<string>;
  onBasculer: (cle: string) => void;
}) {
  const lecture = useMemo(() => {
    const poids = (s: Section) => s.lignes.length;
    const total = sections.reduce((n, s) => n + poids(s), 0);
    const retenues = sections.filter((s) => s.obligatoire || choisies.has(s.cle));
    const retenu = retenues.reduce((n, s) => n + poids(s), 0);
    /*
      LA PLUS LOURDE QU'ON PUISSE DÉCOCHER, et seulement si elle pèse assez pour
      qu'on ait à y penser. Une section qui ne fait qu'un vingtième du document
      ne demande aucune décision : l'ambre irait alors à un détail. À poids
      égal, la plus basse du sommaire l'emporte — c'est la plus annexe, et
      l'ordre du tableau est stable, donc l'ambre ne saute pas d'une lecture à
      l'autre.
    */
    const decochables = sections.filter((s) => !s.obligatoire && poids(s) > 0);
    const candidate = decochables.length > 0 ? decochables.reduce((h, s) => (poids(s) >= poids(h) ? s : h)) : null;
    const lourde = candidate && total > 0 && poids(candidate) / total >= PART_DECISIVE ? candidate : null;
    return { poids, total, retenu, lourde };
  }, [sections, choisies]);

  const { poids, total, retenu, lourde } = lecture;
  const halo = useHaloSignal(lourde !== null);
  /* Un dossier sans ligne n'a pas de dos : ni segment, ni poids à zéro. */
  if (total === 0) return null;

  const part = (s: Section) => (total > 0 ? poids(s) / total : 0);
  const pourcent = (x: number) => `${Math.round(x * 100)} %`;

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-dos={sections.length}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Ce que le rapport pèsera</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
          {retenu} ligne{retenu > 1 ? 's' : ''} retenue{retenu > 1 ? 's' : ''} sur {total}
        </span>
      </div>

      <div className="flex items-start gap-6 sm:gap-8">
        {/* LE DOS. Il ne porte aucun texte : il ne montre que des proportions. */}
        <div className="flex w-[34px] flex-none flex-col gap-[2px]" aria-hidden>
          {sections.map((s) => {
            const retenue = s.obligatoire || choisies.has(s.cle);
            const ambre = lourde?.cle === s.cle;
            return (
              <span
                key={s.cle}
                data-signal-groupe={ambre ? 'section-lourde' : undefined}
                data-segment={s.cle}
                className={`block border ${ambre ? `bg-signal border-signal ${halo}` : retenue ? 'border-border-strong bg-[#4a4a48]' : 'border-dashed border-border-strong bg-transparent'}`}
                style={{ height: Math.max(SEGMENT_MIN, poids(s) * LIGNE_PX) }}
              />
            );
          })}
        </div>

        {/* LE SOMMAIRE. Une ligne par segment, dans le même ordre : le dos ne nomme pas, il montre. */}
        <ul className="min-w-0 flex-1">
          {sections.map((s) => {
            const retenue = s.obligatoire || choisies.has(s.cle);
            const ambre = lourde?.cle === s.cle;
            const groupe = ambre ? 'section-lourde' : undefined;
            return (
              <li key={s.cle} className="border-b border-border py-2 last:border-b-0" data-section={s.cle}>
                <div className="flex items-baseline gap-3">
                  {s.obligatoire ? (
                    <span className="flex-none font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">toujours</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onBasculer(s.cle)}
                      aria-pressed={retenue}
                      data-signal-groupe={groupe}
                      className={`flex-none border px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.1em] ${
                        ambre
                          ? 'border-signal bg-signal text-signal-ink font-bold'
                          : retenue
                            ? 'border-border-strong bg-surface-hover text-text-primary'
                            : 'border-border-strong text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {retenue ? 'retenue' : 'écartée'}
                    </button>
                  )}
                  <span data-signal-groupe={groupe} className={`min-w-0 flex-1 truncate text-[13px] ${ambre ? 'font-semibold text-signal' : retenue ? 'text-text-body' : 'text-text-muted'}`}>
                    {s.titre}
                  </span>
                  <span data-signal-groupe={groupe} className={`flex-none font-mono text-[11.5px] tabular-nums ${ambre ? 'font-bold text-signal' : 'text-text-muted'}`}>
                    {poids(s)} l. · {pourcent(part(s))}
                  </span>
                </div>
                {s.note && <p className="mt-1 text-[11.5px] leading-snug text-text-muted [text-wrap:pretty]">{s.note}</p>}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-[22px] border-t border-border-raised pt-5 text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
        {/* La phrase suit l'état de la bascule : « cocher » sur une section déjà retenue serait un contresens. */}
        {lourde
          ? choisies.has(lourde.cle)
            ? <>Écarter «&nbsp;<b className="font-semibold text-text-primary">{lourde.titre}</b>&nbsp;» retire {poids(lourde)} lignes du document, soit {pourcent(part(lourde))} de tout ce qu’il pourrait contenir. C’est la section dont la bascule le change le plus.</>
            : <>Cocher «&nbsp;<b className="font-semibold text-text-primary">{lourde.titre}</b>&nbsp;» ajoute {poids(lourde)} lignes au document, soit {pourcent(part(lourde))} de tout ce qu’il pourrait contenir. Une section écartée garde son segment, en creux : on voit ce qu’elle coûterait avant de la cocher.</>
          : <>Aucune section écartable ne pèse assez pour qu’on ait à trancher : le dos n’a pas de décision à poser, et le rapport est déjà choisi.</>}
        {' '}Enrichi veut dire CHOISI, pas long — chaque section ajoutée doit valoir les lignes qu’elle coûte.
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
        Le dos et le sommaire viennent du même tableau, et la hauteur d’un segment est son nombre de lignes. L’unité est la ligne et non la page : le rapport n’est pas paginé, il s’imprime par le navigateur, et une page dépend du papier autant que du texte.
      </p>
    </article>
  );
}
