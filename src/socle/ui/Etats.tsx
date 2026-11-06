import React from 'react';

/**
 * L'ÉTAT VIDE ET LE CHARGEMENT.
 *
 * Zéro zone morte : un emplacement sans contenu dit ce qu'on peut y faire et
 * donne le bouton pour le faire. Un chargement garde la place du contenu à
 * venir (le squelette) et se dit aux lecteurs d'écran (`aria-busy`).
 */
/**
 * L'ÉTAT VIDE (« Empty », §4) : cadre pointillé `#2e2e33`, rayon 14, icône de 44 px dans un carré arrondi (en option),
 * titre 14 px / 600, texte 12,5 px T4 (300 px au plus), et TOUJOURS une action — `action` est demandé ; un appelant
 * qui n'en a aucune le dit avec `action={null}` (lecture seule), jamais en l'oubliant.
 */
export function EtatVide({ titre, texte, action, icone }: { titre?: string; texte: string; action: React.ReactNode; /** Le glyphe (lucide, 20 px) : décoratif, le titre dit déjà la situation. */ icone?: React.ReactNode }) {
  return (
    <div className="sc-vide">
      {icone && (
        <span aria-hidden className="sc-vide__icone">
          {icone}
        </span>
      )}
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
