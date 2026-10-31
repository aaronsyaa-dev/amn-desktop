import React from 'react';
import { useSocleLangue } from '../../i18n';
import { arcsDonut, repartirPourcents, sommePositive } from './calculs';
import { TableauAlternatif } from './commun';
import { formaterNombre, formaterPourcent } from './format';
import { couleurTon, type TonGraphique } from './tons';

/**
 * LE DONUT — 112 à 120 px (116 par défaut), épaisseur 14, segments séparés de
 * 2 px, légende à droite : pastille de couleur + libellé + valeur.
 *
 * Les couleurs des segments sont des NOMS de ton (une famille ou un état),
 * jamais une couleur : la valeur vit dans `noir.css`. La couleur ne porte
 * jamais seule : la légende nomme chaque part, et un tableau `sr-only` donne
 * valeur et part (en pour cent entiers dont la somme fait exactement 100).
 *
 *   somme nulle (ou aucun segment) → un anneau vide et « Aucune donnée » ;
 *   un seul segment non nul        → l'anneau entier, sans écart ;
 *   valeur négative ou non finie   → comptée pour zéro (rien à dessiner, la légende la dit).
 *
 * L'entrée est un tracé de 400 ms, supprimé par `prefers-reduced-motion` et
 * par Mouvement « aucun ».
 */
export interface SegmentDonut {
  libelle: string;
  valeur: number;
  /** Famille ou état : c'est lui qui donne la couleur. */
  ton: TonGraphique;
}

export interface DonutProps {
  segments: readonly SegmentDonut[];
  /** Ce que le donut répartit (« Dépenses par catégorie »), en tête du résumé lu à voix haute. */
  libelle: string;
  /** Diamètre en pixels : 112 à 120 selon la spec (défaut 116). */
  taille?: number;
  /** Épaisseur de l'anneau (défaut 14). */
  epaisseur?: number;
  formater?: (valeur: number) => string;
  /** Au centre de l'anneau : un total, un libellé court. Vide : rien. */
  centre?: React.ReactNode;
  /** Ajoute la part (« 42 % ») dans la légende. */
  afficherPart?: boolean;
  className?: string;
}

/** L'écart entre deux segments, en pixels de circonférence (spec : 2 px). */
export const ECART_DONUT = 2;

export function Donut({ segments, libelle, taille = 116, epaisseur = 14, formater = formaterNombre, centre, afficherPart = false, className = '' }: DonutProps) {
  const { ts } = useSocleLangue();
  const valeurs = segments.map((s) => s.valeur);
  const total = sommePositive(valeurs);
  const vide = total <= 0;
  const rayon = (taille - epaisseur) / 2;
  const tour = 2 * Math.PI * rayon;
  const arcs = arcsDonut(valeurs, tour, ECART_DONUT);
  const parts = repartirPourcents(valeurs);
  const resume = `${libelle}. ${vide ? ts('graphique.donut.vide') : ts('graphique.donut', { n: segments.length, total: formater(total) })}`;
  const c = taille / 2;

  return (
    <div className={`sc-g sc-g--donut ${className}`} data-socle="donut" data-vide={vide ? 'true' : undefined}>
      <div className="sc-g__donut-anneau" style={{ width: taille, height: taille }}>
        <svg
          role="img"
          aria-label={resume}
          viewBox={`0 0 ${taille} ${taille}`}
          width={taille}
          height={taille}
          focusable="false"
          className="sc-g__svg"
          style={{ '--sc-g-tour': tour } as React.CSSProperties}
        >
          {vide && <circle className="sc-g__piste" cx={c} cy={c} r={rayon} strokeWidth={epaisseur} />}
          {!vide &&
            segments.map((s, i) =>
              arcs[i].visible > 0 ? (
                <circle
                  key={i}
                  className="sc-g__segment"
                  data-ton={s.ton}
                  cx={c}
                  cy={c}
                  r={rayon}
                  strokeWidth={epaisseur}
                  transform={`rotate(-90 ${c} ${c})`}
                  strokeDasharray={`${arcs[i].visible} ${tour - arcs[i].visible}`}
                  strokeDashoffset={-(arcs[i].debut + arcs[i].ecart / 2)}
                  style={{ stroke: couleurTon(s.ton) }}
                />
              ) : null,
            )}
        </svg>
        {(vide || centre != null) && <div className="sc-g__donut-centre">{vide ? <span className="sc-g__donut-vide">{ts('graphique.aucuneDonnee')}</span> : centre}</div>}
      </div>
      {segments.length > 0 && (
        <ul className="sc-g__legende sc-g__legende--donut" aria-hidden>
          {segments.map((s, i) => (
            <li key={i}>
              <span className="sc-g__pastille" style={{ background: couleurTon(s.ton) }} />
              <span className="sc-g__legende-libelle">{s.libelle}</span>
              <span className="sc-g__legende-valeur">{formater(s.valeur)}</span>
              {afficherPart && !vide && <span className="sc-g__legende-part">{formaterPourcent(parts[i], { decimales: 0 })}</span>}
            </li>
          ))}
        </ul>
      )}
      <TableauAlternatif
        legende={resume}
        colonnes={[ts('graphique.tableau.valeur'), ts('graphique.tableau.part')]}
        lignes={segments.map((s, i) => ({ entete: s.libelle, cellules: [formater(s.valeur), formaterPourcent(parts[i], { decimales: 0 })] }))}
      />
    </div>
  );
}
