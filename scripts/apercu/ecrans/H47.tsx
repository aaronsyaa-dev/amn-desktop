/**
 * APERÇU « H47 » — Quel est votre métier ?, dans l'état de l'image H47 (« Conseil et services » choisi, « 2 à 5 »),
 * rendu par la VRAIE vue (`VueMetier`) dans la coquille de présentation. Données FICTIVES de bac à sable : les quatre
 * modules et les totaux de chaque carte (« 20 en tout »…), la barre miniature, les exemples de journée (Menna Conseil,
 * Cabinet Roux, 4 260 €) et les deux encarts sont ceux de la maquette et ne vivent qu'ici. L'application les lit dans
 * le modèle de métier et le registre (`PageMetier.tsx`), ou ne les montre pas.
 *
 *   npm run apercu -- H47
 */
import React from 'react';
import { ApercuBureau } from '../coquille';
import { VueMetier, type CarteMetier, type LigneModule } from '../../../src/refonte/systeme/demarrage/VueMetier';

const rien = () => undefined;
const l = (nom: string, teinte: string): LigneModule => ({ id: nom, nom, teinte, actif: true, toujours: false });
const carte = (id: string, lignes: LigneModule[], bande: [string, number][], autres: number): CarteMetier => ({ id, lignes, bande: bande.map(([teinte, n]) => ({ teinte, n })), autres, total: autres + 4 });

const CARTES: CarteMetier[] = [
  carte('conseil', [l('Clients', 'contacts'), l('Contrats', 'argent'), l('Missions et tickets', 'jour'), l('Facturation', 'argent')], [['contacts', 1], ['argent', 1], ['jour', 1]], 16),
  carte('artisan', [l('Chantiers', 'creer'), l('Devis', 'argent'), l('Facturation', 'argent'), l('Stock', 'creer')], [['creer', 6], ['argent', 6], ['contacts', 3], ['jour', 3]], 16),
  carte('commerce', [l('Stock', 'creer'), l('Fournisseurs', 'argent'), l('Retours clients', 'contacts'), l('Fidélité', 'contacts')], [['creer', 6], ['argent', 9]], 14),
  carte('startup', [l('Missions et tickets', 'jour'), l('Tableau de bord', 'jour'), l('Équipe', 'outils'), l('Connecteurs', 'outils')], [['jour', 7], ['argent', 4], ['outils', 4], ['contacts', 4]], 18),
  carte('creation', [l('Projets', 'jour'), l('Visuels et marque', 'creer'), l('Signatures', 'ecrire'), l('Vidéo', 'creer')], [['jour', 3], ['creer', 4], ['ecrire', 3], ['argent', 3], ['contacts', 3]], 15),
  carte('quotidien', [l('Tâches', 'jour'), l('Budget', 'argent'), l('Calendrier', 'jour'), l('Habitudes', 'ecrire')], [['jour', 5], ['argent', 3], ['ecrire', 4]], 8),
  carte('sante', [l('Calendrier', 'jour'), l('Fiches contacts', 'contacts'), l('Rappels', 'jour'), l('Documents', 'ecrire')], [['jour', 5], ['contacts', 3], ['ecrire', 3], ['argent', 3]], 11),
  carte('association', [l('Équipe', 'outils'), l('Annonces', 'echanger'), l('Paiements en ligne', 'argent'), l('Documents', 'ecrire')], [['jour', 4], ['echanger', 4], ['ecrire', 3], ['argent', 3], ['contacts', 2]], 12),
];

export default function Apercu() {
  return (
    <ApercuBureau famille="jour" sousPage="accueil" fil={['Ma journée', 'Démarrage', 'Votre métier']} ajmani="Décrivez votre activité en une phrase, Ajmani compose l'espace">
      <VueMetier
        choix="conseil"
        taille="2-5"
        cartes={CARTES}
        barre={[
          { famille: 'jour', teinte: 'jour', nom: 'Ma journée', modules: ['Missions et tickets', 'Calendrier'] },
          { famille: 'contacts', teinte: 'contacts', nom: 'Mes contacts et clients', modules: ['Clients', 'Relances'] },
          { famille: 'argent', teinte: 'argent', nom: 'L’argent', modules: ['Contrats', 'Facturation'] },
        ]}
        dansLaBarre={6}
        autresPrets={14}
        extras={[
          { icone: 'automatisations', titre: '3 automatisations', detail: 'relance à J+7, rappel, bilan du lundi' },
          { icone: 'documents', titre: '5 modèles de documents', detail: 'devis, contrat, compte rendu' },
        ]}
        totalModules={101}
        teintesApercu={['jour', 'argent', 'contacts']}
        dernierActif={false}
        horsLigne={false}
        erreurEnregistrement={false}
        decrireOuvert={false}
        phrase=""
        composeEnvoye={false}
        onChoisir={rien}
        onTaille={rien}
        onBasculer={rien}
        onContinuer={rien}
        onPasser={rien}
        onReessayer={rien}
        onDecrire={rien}
        onPhrase={rien}
        onComposer={rien}
      />
    </ApercuBureau>
  );
}
