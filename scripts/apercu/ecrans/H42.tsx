/**
 * APERÇU « H42 » — Démarrage, dans l'état de l'image H42 (2 sur 6, l'étape 3 « Créer votre premier devis » conseillée),
 * rendu par la VRAIE vue (`VueDemarrage`) dans la coquille de présentation. Données FICTIVES de bac à sable : le prénom,
 * Menna Conseil, le numéro D-2026-001, les montants, « Mohamed » et ses créneaux, la ligne « Sauvegarde » et les
 * « Conditions » sont ceux de la maquette et ne vivent qu'ici (l'application les calcule, ou ne les montre pas).
 *
 *   npm run apercu -- H42
 */
import React from 'react';
import { ApercuBureau } from '../coquille';
import { calculerEtapes, MEMOIRE_VIDE } from '../../../src/refonte/systeme/demarrage/etapes';
import { modeleParId } from '../../../src/refonte/systeme/demarrage/modeles';
import { VueDemarrage } from '../../../src/refonte/systeme/demarrage/VueDemarrage';

const rien = () => undefined;
const calcul = calculerEtapes({
  metier: { modele: modeleParId('conseil'), taille: '2-5', passe: false },
  donnees: { clients: 7, quotes: 0, tasks: 0, appointments: 0, membres: 1 },
  memoire: MEMOIRE_VIDE,
});

export default function Apercu() {
  return (
    <ApercuBureau famille="jour" sousPage="accueil" fil={['Ma journée', 'Démarrage']} ajmani="Demandez à Ajmani, par exemple : « invite Mohamed et Riyad »">
      <VueDemarrage
        etat="pret"
        calcul={calcul}
        prenom="Aaron"
        horsLigne={false}
        peutAdministrer
        mac
        resumes={{ metier: 'Conseil et services', client: '7 importés d’Excel' }}
        rempli={{
          devis: [
            { terme: 'Client', suite: 'Menna Conseil, ajouté à l’étape 2' },
            { terme: 'Lignes types', suite: 'celles de votre métier, modifiables' },
            { terme: 'Conditions', suite: 'paiement à 30 jours, TVA 20 %' },
          ],
        }}
        brouillon={{
          numero: 'D-2026-001',
          client: 'Menna Conseil',
          precision: 'valable 30 jours',
          lignes: [
            { libelle: 'Audit des postes', quantite: '1 jour', montant: '1 200 €' },
            { libelle: 'Maintenance mensuelle', quantite: '3 mois', montant: '540 €' },
            { libelle: 'Sensibilisation', quantite: 'offerte', montant: '0 €' },
          ],
          totaux: [
            { libelle: 'Total HT', valeur: '1 740 €' },
            { libelle: 'TVA 20 %', valeur: '348 €' },
            { libelle: 'Total TTC', valeur: '2 088 €' },
          ],
        }}
        client="Menna"
        pret={[
          { id: 'modules', icone: 'modules', titre: '20 modules activés', sous: 'Conseil et services, 6 dans la barre' },
          { id: 'clients', icone: 'clients', titre: '7 clients importés', sous: 'depuis votre fichier Excel' },
          { id: 'garde', icone: 'garde', titre: 'La Garde veille sur vos accès', sous: 'chaque connexion est notée' },
          { id: 'sauvegarde', icone: 'sauvegarde', titre: 'Sauvegarde chaque nuit', sous: 'à 2:00, gardée 30 jours' },
        ]}
        aInviter={['Mohamed', 'Riyad']}
        referent={{ nom: 'Mohamed', delai: 10, enLigne: true, creneaux: ['14:30', '16:00', 'Lun. 9:30'] }}
        lienMobile={null}
        onPlusTard={rien}
        onAccueil={rien}
        onReprendreVisite={rien}
        onReessayer={rien}
        onAgir={rien}
        onOuvrir={rien}
        onMarquer={rien}
        onRetirer={rien}
        onRemettre={rien}
        onRaccourci={rien}
        onReserver={rien}
        onEcrire={rien}
      />
    </ApercuBureau>
  );
}
