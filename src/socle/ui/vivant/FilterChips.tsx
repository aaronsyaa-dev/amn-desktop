import React, { useRef } from 'react';
import { useSocleLangue } from '../../i18n';
import { cleSuivante } from '../controles/Navigation';

/**
 * LES PUCES DE FILTRE (`FilterChips`) — v3, §0.4 : des puces de 12 px, une seule active (fond `#242427`, T1, 600).
 *
 * Un choix unique : `role="radiogroup"`, chaque puce est un `radio` (`aria-checked` dit laquelle est active, pas
 * la couleur). Une seule tabulation (la puce active) ; ← → (↑ ↓), Début et Fin déplacent le choix, comme le
 * `Segmente`. Chaque puce est une cible de 34 px de haut ; la pastille visible en fait 26.
 */
export interface PuceFiltre {
  cle: string;
  libelle: string;
  /** Le nombre d'éléments derrière le filtre, en chiffres tabulaires T4. */
  compteur?: number;
}

export interface FilterChipsProps {
  /** Le nom du groupe, pour les lecteurs d'écran (« Filtrer par niveau »). */
  libelle: string;
  puces: readonly PuceFiltre[];
  /** La clé de la puce active. */
  valeur: string;
  onChange: (cle: string) => void;
  className?: string;
}

export function FilterChips({ libelle, puces, valeur, onChange, className = '' }: FilterChipsProps) {
  const { ts } = useSocleLangue();
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const cles = puces.map((p) => p.cle);
  // Si la valeur ne désigne aucune puce, la première reste atteignable au clavier.
  const tabulable = cles.includes(valeur) ? valeur : cles[0];
  return (
    <div role="radiogroup" aria-label={libelle} className={`sc-puces ${className}`.trim()} data-socle="puces">
      {puces.map((p) => {
        const active = p.cle === valeur;
        return (
          <button
            key={p.cle}
            ref={(el) => {
              if (el) refs.current.set(p.cle, el);
              else refs.current.delete(p.cle);
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={p.cle === tabulable ? 0 : -1}
            onClick={() => onChange(p.cle)}
            onKeyDown={(e) => {
              const suivante = cleSuivante(cles, p.cle, e.key);
              if (suivante) {
                e.preventDefault();
                onChange(suivante);
                refs.current.get(suivante)?.focus();
              }
            }}
            className="sc-puce"
          >
            <span className="sc-puce__corps">
              {p.libelle}
              {p.compteur != null && (
                <b className="sc-puce__compteur" title={ts('onglets.compteur', { n: p.compteur })}>
                  {p.compteur}
                </b>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
