import React from 'react';
import { NAV_SECTIONS } from '@edition/modules';
import { PROFILS } from '@edition/guide';
import { DESSIN_CE_QUI_COMPTE as ceQuiCompte, DESSIN_VOS_DONNEES as vosDonnees } from './dessins';

/**
 * LES QUATRE ILLUSTRATIONS DE LA PRÉSENTATION (cahier 43f, ARRIVEE.md §3).
 *
 * Monochromes, sans texte, un seul ambre chacune — et cet ambre veut toujours
 * dire la même chose : ce qui vous attend. Décoratives : le texte de la page
 * dit tout, elles sont donc cachées aux lecteurs d'écran.
 *
 * Deux sont TIRÉES DU PRODUIT, pas dessinées une fois pour toutes, comme le
 * cahier le demande (« si une famille change de taille, la première
 * illustration doit être regénérée ») :
 *
 *   · 01 · les familles : une tour par famille de l'édition cliente, à sa
 *     taille réelle, lue dans `NAV_SECTIONS` — 117 modules aujourd'hui, pas
 *     les 116 du paquet, qui datait d'avant le dernier ajout ;
 *   · 04 · le point de départ : une branche par profil de la porte, finie par
 *     ses épinglés réels (`PROFILS[].epingles`), l'Accueil en premier.
 *
 * Les deux autres disent une RÈGLE, pas une donnée, et viennent du paquet :
 * 02 (un écran, une chose domine) et 03 (aucun chiffre inventé).
 *
 * Le mouvement est en CSS (`.illustration` dans index.css) : le gris d'un
 * coup, l'ambre 400 ms après, puis plus rien ; rien sous « mouvement réduit ».
 */

const GRIS = '#2b2b2b';
const SOCLE = '#1c1c1c';
const TRAIT = '#4a4a48';
const AMBRE = 'var(--color-signal)';

function Cadre({ children }: { children: React.ReactNode }) {
  return <div className="illustration" aria-hidden>{children}</div>;
}

function Lueur({ id }: { id: string }) {
  return (
    <defs>
      <filter id={id} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>
  );
}

/** 01 — les familles, à leur taille réelle. L'ambre : un carré au milieu de la tour « Clients & revenus » (clé `commerce`). */
export function IllustrationFamilles() {
  const tours = NAV_SECTIONS.map((s) => ({ key: s.key, n: s.items.length }));
  const cible = Math.max(0, tours.findIndex((t) => t.key === 'commerce'));
  const pas = Math.min(45, 583 / Math.max(1, tours.length));
  const x0 = (i: number) => 36.5 + i * pas;
  const cases: React.ReactNode[] = [];
  let ambre: { x: number; y: number } | null = null;
  tours.forEach((t, i) => {
    const rangees = Math.ceil(t.n / 2);
    const milieu = Math.floor(rangees / 2);
    for (let k = 0; k < t.n; k += 1) {
      const rangee = Math.floor(k / 2);
      const x = x0(i) + (k % 2) * 15;
      const y = 202 - rangee * 15;
      if (i === cible && rangee === milieu && k % 2 === 1) {
        ambre = { x, y };
        continue;
      }
      cases.push(<rect key={`${t.key}-${k}`} x={x} y={y} width="12" height="12" fill={GRIS} />);
    }
  });
  const a = ambre as { x: number; y: number } | null;
  return (
    <Cadre>
      <svg viewBox="0 0 640 280" width="100%" fill="none" focusable="false" data-illustration="familles" data-familles={tours.map((t) => t.n).join(',')}>
        <Lueur id="a01" />
        <g className="gris">
          {cases}
          <rect x="28.5" y="224" width="583" height="1.5" fill={GRIS} />
          {tours.map((t, i) => <rect key={t.key} x={x0(i)} y="231" width="27" height="2" fill={SOCLE} />)}
        </g>
        {a && (
          <g className="ambre">
            <rect x={a.x} y={a.y} width="12" height="12" fill={AMBRE} opacity=".55" filter="url(#a01)" />
            <rect x={a.x} y={a.y} width="12" height="12" fill={AMBRE} />
          </g>
        )}
      </svg>
    </Cadre>
  );
}

/** 02 — un écran réduit à sa forme ; l'ambre : le dernier segment de l'arc dominant. */
export function IllustrationCeQuiCompte() {
  return <Cadre><div data-illustration="ce-qui-compte" dangerouslySetInnerHTML={{ __html: ceQuiCompte }} /></Cadre>;
}

/** 03 — un instrument vide, sans hauteur inventée ; l'ambre : le premier emplacement, rempli. */
export function IllustrationVosDonnees() {
  return <Cadre><div data-illustration="vos-donnees" dangerouslySetInnerHTML={{ __html: vosDonnees }} /></Cadre>;
}

/** 04 — le point de départ : une branche par profil, finie par ses épinglés réels. L'ambre : le point de départ. */
export function IllustrationPointDeDepart() {
  const branches = PROFILS.map((p) => ({ id: p.id, n: p.epingles.length, accueilDabord: p.epingles[0] === 'home' }));
  const haut = 58;
  const bas = 222;
  const ys = branches.map((_, i) => (branches.length === 1 ? 140 : haut + ((bas - haut) * i) / (branches.length - 1)));
  return (
    <Cadre>
      <svg viewBox="0 0 640 280" width="100%" fill="none" focusable="false" data-illustration="point-de-depart" data-epingles={branches.map((b) => b.n).join(',')}>
        <Lueur id="a04" />
        <g className="gris">
          <g transform="translate(60 0)">
            <path d={`M121 140 H196 M196 ${ys[0]} V${ys[ys.length - 1]}`} stroke={TRAIT} strokeWidth="1.5" />
            {branches.map((b, i) => (
              <g key={b.id}>
                <path d={`M196 ${ys[i]} H262`} stroke={TRAIT} strokeWidth="1.5" />
                {Array.from({ length: b.n }, (_, j) => (
                  <rect key={j} x={276 + j * 22} y={ys[i] - 8} width="16" height="16" fill={j === 0 && b.accueilDabord ? TRAIT : GRIS} />
                ))}
              </g>
            ))}
          </g>
        </g>
        <g className="ambre">
          <g transform="translate(60 0)">
            <circle cx="104" cy="140" r="17" stroke={AMBRE} strokeOpacity=".35" />
            <circle cx="104" cy="140" r="9" fill={AMBRE} opacity=".55" filter="url(#a04)" />
            <circle cx="104" cy="140" r="9" fill={AMBRE} />
          </g>
        </g>
      </svg>
    </Cadre>
  );
}
