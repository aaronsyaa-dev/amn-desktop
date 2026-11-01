import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useSocleLangue } from '../../i18n';
import { Bouton } from '../Bouton';
import { Chargement, Squelette } from '../Etats';
import { creerChargementDiffere, type ChargementDiffere, type EtatChargementDiffere } from './regles';

/**
 * LES SQUELETTES (H43, modèle 2) — le chargement qui garde la place du contenu à venir.
 *
 * `SqueletteLignes` dessine la forme d'une liste : une ligne par pas de 50 px, avec un carré de 34 px, deux barres
 * (122 × 10 et 78 × 8) et une pastille de 42 × 10 à droite. Les cotes sont des variables de `situations.css`
 * (`--sc-squelette-*`) : une liste dont la forme est autre (cartes, KPI) compose sa propre disposition avec `Squelette`.
 *
 * `EtatChargement` y ajoute la règle d'affichage : pas de squelette avant 150 ms d'attente, au moins 400 ms une fois
 * affiché, et après 10 s la légende avoue que c'est long et propose « Réessayer ». Le squelette est `aria-hidden` ;
 * c'est la région `role="status"` (la légende) que les lecteurs d'écran annoncent, une seule fois.
 */
/** Les longueurs des barres d'une ligne compacte (v3) : elles varient d'une ligne à l'autre, comme un vrai contenu. */
const BARRES_COMPACTES: ReadonlyArray<readonly [number, number]> = [
  [177, 104],
  [141, 86],
  [159, 122],
];

export function SqueletteLignes({ lignes = 4, compact = false }: { lignes?: number; compact?: boolean }) {
  if (compact) {
    // v3 (H43 en situation) : lignes de 31 px séparées d'un filet — carré 22, deux barres, pastille 54 × 9.
    return (
      <div aria-hidden className="sc-squelette-lignes" data-compact="true">
        {Array.from({ length: lignes }, (_, i) => {
          const [longue, courte] = BARRES_COMPACTES[i % BARRES_COMPACTES.length];
          return (
            <div key={i} className="sc-squelette-lignes__ligne">
              <Squelette largeur={22} hauteur={22} rayon={7} />
              <span className="sc-squelette-lignes__textes">
                <Squelette largeur={longue} hauteur={8} rayon="99px" ligne />
                <Squelette largeur={courte} hauteur={7} rayon="99px" ligne />
              </span>
              <Squelette largeur={54} hauteur={9} rayon="99px" ligne />
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div aria-hidden className="sc-squelette-lignes">
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="sc-squelette-lignes__ligne">
          <Squelette largeur="var(--sc-squelette-carre)" hauteur="var(--sc-squelette-carre)" rayon="var(--sc-squelette-rayon)" />
          <span className="sc-squelette-lignes__textes">
            <Squelette largeur="var(--sc-squelette-barre-longue)" hauteur="var(--sc-squelette-barre-haut)" rayon="99px" ligne />
            <Squelette largeur="var(--sc-squelette-barre-courte)" hauteur="var(--sc-squelette-barre-fine)" rayon="99px" ligne />
          </span>
          <Squelette largeur="var(--sc-squelette-pastille)" hauteur="var(--sc-squelette-barre-haut)" rayon="99px" ligne />
        </div>
      ))}
    </div>
  );
}

/**
 * Le crochet de la règle d'affichage. `enCours` dit si l'attente dure ; on rend `visible` (montrer le squelette)
 * et `long` (plus de 10 s). La règle elle-même est dans `regles.ts`, sans React.
 */
export function useChargementDiffere(enCours: boolean): EtatChargementDiffere {
  const [etat, setEtat] = useState<EtatChargementDiffere>({ visible: false, long: false });
  const regle = useRef<ChargementDiffere | null>(null);
  useEffect(() => {
    const c = creerChargementDiffere(setEtat);
    regle.current = c;
    return () => {
      c.liberer();
      regle.current = null;
    };
  }, []);
  useEffect(() => {
    regle.current?.definir(enCours);
  }, [enCours]);
  return etat;
}

export interface EtatChargementProps {
  /** Les objets au pluriel, sans déterminant : « clients » → « Chargement de vos clients ». */
  objets: string;
  /** L'attente est en cours. Quand elle finit, le composant se retire (au bout de 400 ms d'affichage au moins). */
  enCours?: boolean;
  lignes?: number;
  /** Relance la requête. Sans lui, la légende « C'est plus long que d'habitude » reste sans bouton : fournissez-le. */
  onReessayer?: () => void;
  /** Aperçu : toujours visible, sans minuterie (page de démonstration, tests de rendu). */
  statique?: boolean;
  className?: string;
}

export function EtatChargement({ objets, enCours = true, lignes = 4, onReessayer, statique = false, className }: EtatChargementProps) {
  const { ts } = useSocleLangue();
  const { visible, long } = useChargementDiffere(enCours && !statique);
  if (statique ? !enCours : !visible) return null;
  const legende = long ? ts('chargement.long') : ts('chargement.legende', { objets });
  return (
    <Chargement libelle={legende} className={['sc-chargement', className].filter(Boolean).join(' ')}>
      <SqueletteLignes lignes={lignes} />
      <p className="sc-chargement__legende">{legende}</p>
      {long && onReessayer && (
        <Bouton variante="secondaire" taille="petit" icone={<RotateCcw size={14} strokeWidth={1.9} />} onClick={onReessayer}>
          {ts('chargement.reessayer')}
        </Bouton>
      )}
    </Chargement>
  );
}
