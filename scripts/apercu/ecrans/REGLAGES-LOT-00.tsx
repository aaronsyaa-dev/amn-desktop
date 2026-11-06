/**
 * APERÇU « REGLAGES-LOT-00 » — les trois surfaces de réglages que LOT-00 possède dans les Paramètres (H18, LOT-07,
 * qui n'est pas construit ici) : Mouvement, Écran de veille, Nouvelle coquille, telles que la porte `MouvementSection`
 * de `@edition/socle` les rend, dans la coquille v3. Aucune image de référence (H18 n'a pas de fiche dans ce lot) :
 * la capture sert de contrôle visuel. Données FICTIVES (`../coquille.tsx`) ; les réglages lus sont ceux par défaut.
 *
 *   npm run apercu -- REGLAGES-LOT-00
 */
import React from 'react';
import { ApercuBureau } from '../coquille';
import { MouvementSection } from '../../../src/edition/socle.internal';

export default function Apercu() {
  return (
    <ApercuBureau famille="outils" sousPage="parametres" fil={['Outils et réglages', 'Paramètres']} ajmani="Demandez à Ajmani, par exemple : « coupe les animations »">
      <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
        <MouvementSection />
      </div>
    </ApercuBureau>
  );
}
