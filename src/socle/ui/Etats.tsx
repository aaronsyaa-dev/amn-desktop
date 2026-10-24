import React from 'react';

/**
 * L'ÉTAT VIDE ET LE CHARGEMENT.
 *
 * Zéro zone morte : un emplacement sans contenu dit ce qu'on peut y faire et
 * donne le bouton pour le faire. Un chargement garde la place du contenu à
 * venir (le squelette) et se dit aux lecteurs d'écran (`aria-busy`).
 */
export function EtatVide({ titre, texte, action }: { titre?: string; texte: string; action?: React.ReactNode }) {
  return (
    <div className="sc-vide">
      {titre && <p className="sc-vide__titre">{titre}</p>}
      <p className="sc-vide__texte">{texte}</p>
      {action}
    </div>
  );
}

export function Squelette({ largeur = '100%', hauteur = 16, rayon }: { largeur?: number | string; hauteur?: number | string; rayon?: number }) {
  return <span aria-hidden className="sc-squelette" style={{ width: largeur, height: hauteur, borderRadius: rayon }} />;
}

/** Un bloc en chargement : il annonce « Chargement » une fois, ses squelettes se taisent. */
export function Chargement({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={libelle}>
      {children}
    </div>
  );
}
