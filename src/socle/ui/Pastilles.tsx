import React from 'react';
import type { Famille } from '../familles';

/** Étiquette (pill) : une catégorie, un filtre, un fait court. */
export function Etiquette({ children, famille, compacte = false, ...aria }: { children: React.ReactNode; famille?: Famille; compacte?: boolean; title?: string }) {
  return (
    <span data-famille={famille} data-compacte={compacte || undefined} className="sc-etiquette" title={aria.title}>
      {famille && <span aria-hidden className="sc-point" />}
      {children}
    </span>
  );
}

export type EtatPastille = 'succes' | 'attention' | 'critique' | 'info' | 'neutre';

/** Pastille d'état : la couleur ne porte jamais seule le sens, le mot l'accompagne. */
export function PastilleEtat({ etat = 'neutre', children }: { etat?: EtatPastille; children: React.ReactNode }) {
  return (
    <span data-etat={etat} className="sc-etat">
      {children}
    </span>
  );
}

/** Une ou deux initiales : « Aaron M. » devient « AM ». */
export function initiales(nom: string): string {
  return nom
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join('');
}

/** Avatar : des initiales, jamais un visage ni un dessin. Décoratif — le nom est dit à côté. */
export function Avatar({ nom, taille = 24 }: { nom: string; taille?: number }) {
  return (
    <span aria-hidden className="sc-avatar" style={{ '--sc-avatar': `${taille}px` } as React.CSSProperties}>
      {initiales(nom)}
    </span>
  );
}

/** Une pile d'avatars qui se chevauchent de 7 px, avec « +N » au-delà de `max`. */
export function PileAvatars({ noms, max = 3, taille = 24, libelle }: { noms: string[]; max?: number; taille?: number; libelle: string }) {
  const vus = noms.slice(0, max);
  const reste = noms.length - vus.length;
  return (
    <span role="img" aria-label={libelle} className="sc-pile">
      {vus.map((n, i) => (
        <Avatar key={`${n}-${i}`} nom={n} taille={taille} />
      ))}
      {reste > 0 && (
        <span aria-hidden className="sc-avatar" style={{ '--sc-avatar': `${taille}px` } as React.CSSProperties}>
          +{reste}
        </span>
      )}
    </span>
  );
}

/** Un raccourci clavier, à droite d'un champ ou d'un bouton. */
export function Raccourci({ children }: { children: React.ReactNode }) {
  return <kbd className="sc-kbd">{children}</kbd>;
}
