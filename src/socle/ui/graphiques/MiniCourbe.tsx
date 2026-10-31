import React, { useId } from 'react';
import { useSocleLangue } from '../../i18n';
import { cheminLigne, estFini, positionner, type Point } from './calculs';
import { phraseSerie } from './commun';
import { formaterNombre } from './format';
import { couleurTon, type TonGraphique } from './tons';

/**
 * LA MINI-COURBE — la « Sparkline » 70 × 26 des tuiles KPI : un trait de 2 px et
 * son point final, rien d'autre (ni axe, ni grille, ni survol).
 *
 * Elle reste un graphique à part entière pour un lecteur d'écran : `role="img"`,
 * un résumé (« Tendance, 12 points, de X à Y, dernier : Z ») et la liste des
 * valeurs en `<desc>`. Moins de deux points : un trait de repos (« pas encore de
 * données »), ou le point seul.
 */
export interface MiniCourbeProps {
  valeurs: readonly number[];
  /** Ce que la tendance mesure (« Encaissements »), en tête du résumé. */
  libelle: string;
  ton?: TonGraphique;
  largeur?: number;
  hauteur?: number;
  formater?: (valeur: number) => string;
  className?: string;
}

/** Marge qui garde le point final (rayon 2,5) et le trait (2 px) dans le cadre. */
const MARGE = 3.5;
const RAYON = 2.5;

export function MiniCourbe({ valeurs, libelle, ton = 'neutre', largeur = 70, hauteur = 26, formater = formaterNombre, className = '' }: MiniCourbeProps) {
  const { ts } = useSocleLangue();
  const idDesc = useId();
  const vues = valeurs.filter(estFini);
  const n = vues.length;
  const style = { '--sc-g-c': couleurTon(ton) } as React.CSSProperties;
  const resume = `${libelle}. ${phraseSerie(ts, { plusieurs: 'graphique.tendance', un: 'graphique.tendance.un', vide: 'graphique.tendance.vide' }, vues, formater)}`;

  const bas = Math.min(...vues);
  const haut = Math.max(...vues);
  const xs = (i: number) => (n === 1 ? largeur - MARGE : MARGE + (i * (largeur - 2 * MARGE)) / (n - 1));
  // Tous égaux : la ligne court au milieu plutôt que de se plaquer sur un bord.
  const y = (v: number) => (haut === bas ? hauteur / 2 : positionner(v, { min: bas, max: haut }, MARGE, hauteur - MARGE));
  const points: Point[] = vues.map((v, i) => [xs(i), y(v)]);

  return (
    <svg
      role="img"
      aria-label={resume}
      aria-describedby={idDesc}
      viewBox={`0 0 ${largeur} ${hauteur}`}
      width={largeur}
      height={hauteur}
      focusable="false"
      className={`sc-g sc-g--mini ${className}`}
      style={style}
      data-socle="mini-courbe"
      data-vide={n === 0 ? 'true' : undefined}
    >
      <desc id={idDesc}>{vues.map((v) => formater(v)).join(' ; ')}</desc>
      {n === 0 && <line className="sc-g__repos" x1={MARGE} x2={largeur - MARGE} y1={hauteur / 2} y2={hauteur / 2} />}
      {n > 1 && <path className="sc-g__mini-ligne" d={cheminLigne(points)} />}
      {n > 0 && <circle className="sc-g__mini-fin" cx={points[n - 1][0]} cy={points[n - 1][1]} r={RAYON} />}
    </svg>
  );
}
