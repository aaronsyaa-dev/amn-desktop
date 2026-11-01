/**
 * APERÇU « COQUILLE-H47 » — la coquille seule, dans l'état de l'image H47 (Ma journée dépliée, « Accueil » allumé), zone
 * principale vide. Données FICTIVES (`../coquille.tsx`).
 *
 *   npm run apercu -- COQUILLE-H47
 */
import React from 'react';
import { ApercuBureau } from '../coquille';

export default function Apercu() {
  return <ApercuBureau famille="jour" sousPage="accueil" fil={['Ma journée', 'Démarrage', 'Votre métier']} ajmani="Décrivez votre activité en une phrase, Ajmani compose l'espace" />;
}
