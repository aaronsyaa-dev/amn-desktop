/**
 * APERÇU « H43 » — la planche « États et messages » v3, sans coquille, telle que sur l'image.
 *
 *   npm run apercu -- H43
 *
 * Rendue par la VRAIE page (`PageEtatsMessages`) et ses briques (`socle/ui/situations`), avec les exemples FICTIFS
 * de la maquette (Menna Conseil, Test Dupuis, Contrat Dupont, Aaron, Mohamed, Riyad…). Rien de ceci n'entre dans
 * l'application : dans `src/`, la page prend des exemples neutres (`exemples.ts`).
 */
import React from 'react';
import '../../../src/refonte/accueil/Ambiance';
import { PageEtatsMessages } from '../../../src/refonte/systeme/h43-etats/PageEtatsMessages';
import type { ExempleH43 } from '../../../src/refonte/systeme/h43-etats/exemples';

const MAQUETTE: ExempleH43 = {
  objet: 'client',
  objets: 'factures',
  enAttente: 2,
  correspondant: 'Mohamed',
  messageRecu: 'Tu peux passer chez Medina cet après-midi ?',
  messageEnvoye: 'Oui, j’y suis à 15 h. Je prends le contrat.',
  prenomAdmin: 'Aaron',
  prenomConnecte: 'Riyad',
  terme: 'contrat dupuis',
  proche: 'Contrat Dupont',
  liste: [{ nom: 'Menna Conseil', detail: 'client' }, { nom: 'Test Dupuis', detail: 'fiche d’essai' }, { nom: 'Cabinet Roux' }, { nom: 'Parc Sud' }, { nom: 'Roux Santé' }],
  rangSupprime: 1,
  factures: [
    { numero: 'F-2047', client: 'Menna Conseil', montant: 2400, statut: 'envoyee' },
    { numero: 'F-2036', client: 'Atelier Sarah', montant: 640, statut: 'retard' },
    { numero: 'F-2035', client: 'Cabinet Roux', montant: 1800, statut: 'payee' },
  ],
  nomClientFacture: 'Menna',
  secondesRestantes: 6,
  prenomCollaborateur: 'Mohamed',
  noms: ['Aaron', 'Mohamed'],
  titrePage: 'Compte rendu · Menna Conseil',
  paragraphe: 'Le tableau de bord affiche de nouveau les utilisateurs actifs.',
  debutModifie: 'Cause : ',
  passageModifie: 'un jeton d’accès expiré, renouvelé à 10:31',
  objetsErreur: 'prévisions',
  genreErreur: 'feminin',
  heureDerniere: '10:12',
  courbe: [0.2, 0.25, 0.27, 0.33, 0.38, 0.45, 0.62, 0.7, 0.67, 0.85],
  prochainEssai: 20,
};

export default function Apercu() {
  return (
    <div style={{ width: 1440, height: 900, overflow: 'hidden' }}>
      <PageEtatsMessages exemple={MAQUETTE} />
    </div>
  );
}
