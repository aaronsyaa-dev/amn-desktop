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
export function PastilleEtat({ etat = 'neutre', allegee = false, children }: { etat?: EtatPastille; /** Sans fond ni marge : « ● en cours ». */ allegee?: boolean; children: React.ReactNode }) {
  return (
    <span data-etat={etat} data-allegee={allegee || undefined} className="sc-etat">
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

/** Une teinte de 0 à 5, stable pour un nom donné : la même personne garde la même couleur partout. */
export function teinteDe(nom: string): number {
  let h = 0;
  for (const c of nom.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 6;
}

/**
 * Avatar : des initiales sur la couleur de la personne, jamais un visage ni un dessin. Décoratif — le nom
 * est dit à côté. `forme="carre"` (rayon 9) pour une organisation ou un client ; `enLigne` pose la pastille verte de 8 px.
 */
export function Avatar({ nom, taille = 24, forme = 'rond', enLigne = false }: { nom: string; taille?: number; forme?: 'rond' | 'carre'; enLigne?: boolean }) {
  return (
    <span
      aria-hidden
      className="sc-avatar"
      data-forme={forme}
      data-teinte={teinteDe(nom)}
      data-en-ligne={enLigne || undefined}
      style={{ '--sc-avatar': `${taille}px` } as React.CSSProperties}
    >
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
        <span aria-hidden className="sc-avatar" data-teinte="3" style={{ '--sc-avatar': `${taille}px` } as React.CSSProperties}>
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
