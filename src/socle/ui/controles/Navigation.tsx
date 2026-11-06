import React, { useId, useRef } from 'react';
import { useSocleLangue } from '../../i18n';

export interface OngletDef {
  cle: string;
  libelle: string;
  /** Le nombre d'éléments de l'onglet : une pastille `#1c1c1e` à droite du libellé. */
  compteur?: number;
}

/** Une navigation au clavier d'un groupe de boutons : ← → (↑ ↓), Début, Fin. Rend la clé à activer. */
export function cleSuivante(cles: readonly string[], courante: string, touche: string): string | null {
  const i = cles.indexOf(courante);
  if (i < 0 || cles.length === 0) return null;
  if (touche === 'ArrowRight' || touche === 'ArrowDown') return cles[(i + 1) % cles.length];
  if (touche === 'ArrowLeft' || touche === 'ArrowUp') return cles[(i - 1 + cles.length) % cles.length];
  if (touche === 'Home') return cles[0];
  if (touche === 'End') return cles[cles.length - 1];
  return null;
}

/**
 * Des onglets soulignés (espacement 26, 13 px) : l'actif en 600 T1 avec un filet de 2 px `#ededed`, les autres en
 * T4. `role="tablist"`, un seul onglet dans l'ordre de tabulation (celui qui est actif), flèches pour passer de l'un à l'autre.
 * Le panneau lié se rend avec `PanneauOnglet` et le même `idBase`.
 */
export function Onglets({ libelle, onglets, actif, onChange, idBase }: { libelle: string; onglets: OngletDef[]; actif: string; onChange: (cle: string) => void; idBase?: string }) {
  const { ts } = useSocleLangue();
  const auto = useId();
  const base = idBase ?? auto;
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const cles = onglets.map((o) => o.cle);
  return (
    <div role="tablist" aria-label={libelle} className="sc-onglets">
      {onglets.map((o) => {
        const estActif = o.cle === actif;
        return (
          <button
            key={o.cle}
            ref={(el) => {
              if (el) refs.current.set(o.cle, el);
              else refs.current.delete(o.cle);
            }}
            type="button"
            role="tab"
            id={`${base}-onglet-${o.cle}`}
            aria-selected={estActif}
            aria-controls={`${base}-panneau-${o.cle}`}
            tabIndex={estActif ? 0 : -1}
            onClick={() => onChange(o.cle)}
            onKeyDown={(e) => {
              const suivante = cleSuivante(cles, o.cle, e.key);
              if (suivante) {
                e.preventDefault();
                onChange(suivante);
                refs.current.get(suivante)?.focus();
              }
            }}
            className="sc-onglet sc-focus"
          >
            {o.libelle}
            {o.compteur != null && (
              <b className="sc-onglet__compteur" title={ts('onglets.compteur', { n: o.compteur })}>
                {o.compteur}
              </b>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Le panneau d'un onglet : masqué quand l'onglet n'est pas actif. */
export function PanneauOnglet({ idBase, cle, actif, children }: { idBase: string; cle: string; actif: boolean; children?: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`${idBase}-panneau-${cle}`} aria-labelledby={`${idBase}-onglet-${cle}`} hidden={!actif} tabIndex={0}>
      {actif ? children : null}
    </div>
  );
}

/**
 * Un choix unique entre quelques options (segmented) : conteneur `#141415` bordé `#28282b`, rayon 10, rembourrage 3,
 * l'option active sur `#242427` en T1 / 500. `role="radiogroup"` ; ← → déplacent le choix.
 *
 * `taille="compact"` (LOT-06) : 26 px de haut au lieu de 37 — rembourrage 2, segments 12 px, 3 × 9, rayon 9. Les
 * couleurs ne changent pas. Une cible de 26 px est sous les 34 px du §7.6 : à réserver aux rangées denses, jamais à
 * un réglage principal.
 */
export function Segmente({ libelle, options, valeur, onChange, taille = 'normale' }: { libelle: string; options: { cle: string; libelle: string }[]; valeur: string; onChange: (cle: string) => void; taille?: 'normale' | 'compact' }) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const cles = options.map((o) => o.cle);
  return (
    <div role="radiogroup" aria-label={libelle} data-taille={taille === 'compact' ? 'compact' : undefined} className="sc-segmente">
      {options.map((o) => {
        const estActif = o.cle === valeur;
        return (
          <button
            key={o.cle}
            ref={(el) => {
              if (el) refs.current.set(o.cle, el);
              else refs.current.delete(o.cle);
            }}
            type="button"
            role="radio"
            aria-checked={estActif}
            tabIndex={estActif ? 0 : -1}
            onClick={() => onChange(o.cle)}
            onKeyDown={(e) => {
              const suivante = cleSuivante(cles, o.cle, e.key);
              if (suivante) {
                e.preventDefault();
                onChange(suivante);
                refs.current.get(suivante)?.focus();
              }
            }}
            className="sc-segment sc-focus"
          >
            {o.libelle}
          </button>
        );
      })}
    </div>
  );
}
