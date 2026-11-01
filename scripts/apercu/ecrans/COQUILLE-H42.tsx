/**
 * APERÇU « COQUILLE-H42 » — la coquille seule, dans l'état de l'image H42 (Démarrage) : Ma journée dépliée,
 * « Accueil » allumé, fil « Ma journée / Démarrage », barre Ajmani contextualisée. Zone principale vide. Données
 * FICTIVES (`../coquille.tsx`).
 *
 *   npm run apercu -- COQUILLE-H42
 */
import React from 'react';
import { ApercuBureau } from '../coquille';

export default function Apercu() {
  return <ApercuBureau famille="jour" sousPage="accueil" fil={['Ma journée', 'Démarrage']} ajmani="Demandez à Ajmani, par exemple : « invite Mohamed et Riyad »" />;
}
