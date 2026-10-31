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

/**
 * Un bloc qui garde la place (fiche H43) : fond `--socle-squelette`, reflet lent de 1,4 s, immobile si le
 * système demande moins de mouvement. `ligne` donne la teinte d'une barre de texte (`--socle-squelette-ligne`),
 * un peu plus claire que celle d'un carré ou d'une pastille.
 */
export function Squelette({ largeur = '100%', hauteur = 16, rayon, ligne = false }: { largeur?: number | string; hauteur?: number | string; rayon?: number | string; ligne?: boolean }) {
  return <span aria-hidden className="sc-squelette" data-ligne={ligne || undefined} style={{ width: largeur, height: hauteur, borderRadius: rayon }} />;
}

/** Un bloc en chargement : il annonce « Chargement » une fois, ses squelettes se taisent. */
export function Chargement({ libelle, children, className }: { libelle: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={libelle} className={className}>
      {children}
    </div>
  );
}
