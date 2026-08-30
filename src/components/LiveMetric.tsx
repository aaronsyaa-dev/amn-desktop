import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedCounter } from './AnimatedCounter';
import { phraseDelta, traceSerie, type SerieVitale } from '../lib/serieVitale';

/**
 * LIVEMETRIC — la colonne vertébrale des Signes Vitaux.
 *
 * Plus jamais un nombre nu : chaque relevé porte sa mémoire (la courbe fantôme
 * des sept derniers jours), son mouvement (le delta, en toutes lettres), et sa
 * vie (il compte quand il change, au lieu d'être remplacé).
 *
 * ## Trois états, un composant
 *
 *   REPOS        le nombre + la courbe fantôme + le delta.
 *   ÉVÉNEMENT    la valeur change → le compteur compte depuis l'ancienne
 *                valeur, et une impulsion lumineuse traverse le bloc une fois.
 *   INTERACTION  au survol, la courbe s'éclaire et livre ses jours un à un —
 *                le chiffre « ouvre sa mémoire » sur place, sans tooltip
 *                générique et sans déplacer la mise en page.
 *
 * ## La règle d'honnêteté
 *
 * PAS DE SÉRIE, PAS DE COURBE. Ce composant ne fabrique jamais d'historique :
 * si l'appelant n'a pas de vraies dates à donner (`serie` absent), le nombre
 * s'affiche seul, comme avant. Une courbe simulée sous un vrai chiffre
 * donnerait au mensonge la crédibilité du reste — c'est la classe de défaut
 * que `check:vitaux` existe pour interdire.
 *
 * ## Pourquoi la courbe est FANTÔME et pas un graphique
 *
 * Le chiffre est le sujet ; la courbe est sa mémoire, pas un second sujet.
 * Elle vit donc SOUS le chiffre, dans la matière du fond (28 % d'opacité au
 * repos), et ne rivalise jamais avec lui. Un vrai graphique à côté d'un nombre
 * transforme chaque relevé en tableau de bord — exactement le réflexe
 * générique que la refonte veut éviter.
 *
 * ## Mouvement
 *
 * Uniquement `transform` et `opacity` (la lueur d'événement est une couche
 * pré-rendue dont on anime l'opacité). `prefers-reduced-motion` : le compteur
 * saute à la valeur (déjà géré par AnimatedCounter) et l'impulsion devient un
 * simple changement d'intensité sans balayage.
 */

const JOURS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

function jourCourt(cle: string): string {
  const d = new Date(`${cle}T12:00:00`);
  return Number.isFinite(d.getTime()) ? JOURS_COURTS[d.getDay()] : '';
}

export function LiveMetric({
  value,
  format,
  serie,
  emphasis = false,
  size = 'md',
}: {
  /** La valeur d'aujourd'hui — TOUJOURS calculée sur les données affichées. */
  value: number;
  /**
   * Comment l'écrire (montants, unités). Sans lui, le nombre compte quand il
   * change ; avec lui, il s'affiche tel quel — un montant en euros qui défile
   * au hasard donne l'impression que la somme hésite.
   */
  format?: (n: number) => string;
  /** La mémoire du chiffre. Absente → le nombre s'affiche seul. Jamais simulée. */
  serie?: SerieVitale;
  emphasis?: boolean;
  size?: 'md' | 'lg';
}) {
  const [survole, setSurvole] = useState(false);

  /*
    L'impulsion d'événement : une couche claire dont l'opacité s'allume puis
    retombe quand `value` change — pas au premier rendu, qui n'est pas un
    événement, juste une arrivée.
  */
  const [impulsion, setImpulsion] = useState(false);
  const precedente = useRef(value);
  useEffect(() => {
    if (precedente.current === value) return;
    precedente.current = value;
    setImpulsion(true);
    const t = window.setTimeout(() => setImpulsion(false), 900);
    return () => window.clearTimeout(t);
  }, [value]);

  const trace = useMemo(() => (serie ? traceSerie(serie) : []), [serie]);
  const delta = serie ? phraseDelta(serie) : '';

  /* La courbe en pixels — viewBox fixe, le tracé est déjà normalisé. */
  const L = 72;
  const H = 20;
  const points = trace.map((p) => `${(p.x * L).toFixed(1)},${(2 + p.y * (H - 4)).toFixed(1)}`).join(' ');
  const dernier = trace[trace.length - 1];

  const taille = size === 'lg' ? 'text-v1 font-bold' : 'text-v3 font-semibold';

  return (
    <span
      className="relative inline-flex flex-col"
      onMouseEnter={() => setSurvole(true)}
      onMouseLeave={() => setSurvole(false)}
    >
      {/* La couche d'impulsion : pré-rendue, seule son opacité vit. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-1 bg-white/[0.07] transition-opacity duration-500"
        style={{ opacity: impulsion ? 1 : 0 }}
      />

      <span
        className={`${taille} leading-none tracking-tight ${
          emphasis ? 'text-text-primary' : 'text-text-secondary'
        }`}
      >
        {format ? format(value) : <AnimatedCounter value={value} />}
      </span>

      {serie && trace.length > 1 && (
        <span className="mt-1.5 flex items-end gap-2" aria-hidden>
          <svg
            width={L}
            height={H}
            viewBox={`0 0 ${L} ${H}`}
            className="overflow-visible transition-opacity duration-300"
            style={{ opacity: survole ? 0.9 : 0.35 }}
          >
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.25}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="text-text-primary"
            />
            {dernier && (
              <circle
                cx={dernier.x * L}
                cy={2 + dernier.y * (H - 4)}
                r={2}
                className="fill-text-primary"
              />
            )}
          </svg>
          {delta && (
            <span className="whitespace-nowrap font-mono text-v6 leading-none text-text-muted">
              {delta}
            </span>
          )}
        </span>
      )}

      {/*
        LA MÉMOIRE OUVERTE — le survol déploie les sept jours sur place.

        En absolu sous le bloc : la mise en page ne bouge pas d'un pixel.
        `aria-hidden` : c'est un enrichissement visuel d'une donnée déjà
        annoncée (valeur + delta en texte) ; il n'est pas focusable et ne
        cache rien qu'un clavier ne puisse obtenir autrement.
      */}
      {serie && trace.length > 1 && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-full z-20 mt-2 flex origin-top-left gap-2 border border-border bg-raised px-2.5 py-2 elev-2 transition-[opacity,transform] duration-200"
          style={{
            opacity: survole ? 1 : 0,
            transform: survole ? 'translateY(0) scale(1)' : 'translateY(-3px) scale(0.98)',
          }}
        >
          {serie.points.map((p) => (
            <span key={p.jour} className="flex w-7 flex-col items-center gap-0.5">
              <span className="font-mono text-v5 leading-none text-text-primary">{p.valeur}</span>
              <span className="font-mono text-v6 uppercase leading-none text-text-muted">
                {jourCourt(p.jour)}
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
