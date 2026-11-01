/**
 * APERÇU « COQUILLE-D02 » — la coquille seule, dans l'état de l'image D02 (Tous les modules) : aucune famille
 * dépliée, le bouton carré « Tous les modules » allumé, fil « Espace / Tous les modules », barre Ajmani
 * contextualisée. Zone principale vide. Données FICTIVES (`../coquille.tsx`).
 *
 *   npm run apercu -- COQUILLE-D02
 */
import React from 'react';
import { ApercuBureau } from '../coquille';

export default function Apercu() {
  return <ApercuBureau fil={['Espace', 'Tous les modules']} tousLesModules ajmani="Dites ce que vous voulez faire, je trouve le bon module" />;
}
