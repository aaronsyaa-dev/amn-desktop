/**
 * APERÇU « COQUILLE-H40 » — la coquille seule, dans l'état de l'image H40 (Ma journée dépliée, « Accueil » allumé), zone
 * principale vide. Données FICTIVES (`../coquille.tsx`).
 *
 *   npm run apercu -- COQUILLE-H40
 */
import React from 'react';
import { ApercuBureau } from '../coquille';

export default function Apercu() {
  return <ApercuBureau famille="jour" sousPage="accueil" fil={['Ma journée', 'Notifications']} ajmani="Demandez à Ajmani, par exemple : « reporte tout ce qui n'est pas urgent à demain »" />;
}
