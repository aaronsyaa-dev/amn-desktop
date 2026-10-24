import React from 'react';
import { useSocleLangue } from '../i18n';

/**
 * LA COQUILLE — la grille : barre latérale à gauche ; à droite l'en-tête, le
 * contenu, et la barre Ajmani en bas. Elle ne sait rien des données : on lui
 * passe les quatre pièces.
 *
 * Le contenu est un conteneur (`container-type: inline-size`) : les écrans
 * s'y adaptent à SA largeur. `largeur="lecture"` garde une colonne de lecture
 * pour les écrans qui n'ont pas encore migré ; `"pleine"` est pour les tableaux
 * (la Tour de contrôle).
 */
export interface CoquilleProps {
  lateral: React.ReactNode;
  entete: React.ReactNode;
  ajmani: React.ReactNode;
  children: React.ReactNode;
  largeur?: 'lecture' | 'pleine';
  /** Le tiroir est ouvert (sous 900 px) : le fond sert à le fermer. */
  tiroirOuvert: boolean;
  onFermerTiroir: () => void;
}

export function Coquille({ lateral, entete, ajmani, children, largeur = 'lecture', tiroirOuvert, onFermerTiroir }: CoquilleProps) {
  const { ts } = useSocleLangue();
  return (
    <div data-socle="coquille" data-espace-racine data-espace="poste" className="sc-coquille">
      <a href="#sc-principal" className="sc-evitement" onClick={(e) => { e.preventDefault(); document.getElementById('sc-principal')?.focus(); }}>
        {ts('coquille.evitement')}
      </a>
      {lateral}
      {tiroirOuvert && <button type="button" tabIndex={-1} aria-label={ts('coquille.menu.fermer')} className="sc-fond-tiroir" onClick={onFermerTiroir} />}
      <div className="sc-colonne">
        {entete}
        <main id="sc-principal" tabIndex={-1} data-largeur={largeur} className="sc-principal">
          {children}
          <div aria-hidden className="sc-principal-fin" />
        </main>
        <div className="sc-pied-page">{ajmani}</div>
      </div>
    </div>
  );
}
