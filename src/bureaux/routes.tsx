import React, { Suspense, lazy } from 'react';
import { Route } from 'react-router-dom';

/**
 * LES ROUTES DES BUREAUX — montées sous `AppLayout` (édition interne), qui
 * pose chaque chemin de bureau dans sa coquille (voir `CadreBureau`).
 *
 * Chargées à la demande : le poste de travail ne paie pas pour cinq bureaux
 * qu'il n'ouvre peut-être pas aujourd'hui. Le repli est vide et calme — la
 * coquille, elle, est déjà là.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const l = <T extends Record<string, any>>(charger: () => Promise<T>, nom: keyof T) =>
  lazy(async () => ({ default: (await charger())[nom] as React.ComponentType }));

const SupervisorAccueil = l(() => import('./supervisor/Accueil'), 'SupervisorAccueil');
const CyberAccueil = l(() => import('./cyber/Accueil'), 'CyberAccueil');
const StudioAccueil = l(() => import('./studio/Accueil'), 'StudioAccueil');
const StrategieAccueil = l(() => import('./strategie/Accueil'), 'StrategieAccueil');
const GardeAccueil = l(() => import('./garde/Accueil'), 'GardeAccueil');
const SupervisorGrille = l(() => import('./supervisor/Grille'), 'SupervisorGrille');
const SupervisorATraiter = l(() => import('./supervisor/ATraiter'), 'SupervisorATraiter');
const SupervisorAutomatisations = l(() => import('./supervisor/Automatisations'), 'SupervisorAutomatisations');
const SupervisorDossier = l(() => import('./supervisor/Dossier'), 'SupervisorDossier');
const SupervisorChercheur = l(() => import('./supervisor/Chercheur'), 'SupervisorChercheur');
const SupervisorBug = l(() => import('./supervisor/Bug'), 'SupervisorBug');
const SupervisorGroupes = l(() => import('./supervisor/Groupes'), 'SupervisorGroupes');
const CyberMatrice = l(() => import('./cyber/Matrice'), 'CyberMatrice');
const CyberAlertes = l(() => import('./cyber/Alertes'), 'CyberAlertes');
const CyberFicheIncident = l(() => import('./cyber/FicheIncident'), 'CyberFicheIncident');
const CyberInventaire = l(() => import('./cyber/Inventaire'), 'CyberInventaire');
const CyberEcheances = l(() => import('./cyber/Echeances'), 'CyberEcheances');
const CyberJournalAudit = l(() => import('./cyber/JournalAudit'), 'CyberJournalAudit');
const CyberPlaybooks = l(() => import('./cyber/Playbooks'), 'CyberPlaybooks');
const CyberRapports = l(() => import('./cyber/Rapports'), 'CyberRapports');
const CyberCarnet = l(() => import('./cyber/Carnet'), 'CyberCarnet');
const StudioPiece = l(() => import('./studio/Piece'), 'StudioPiece');
const StrategieCampagnes = l(() => import('./strategie/Campagnes'), 'StrategieCampagnes');
const StrategieStoryboards = l(() => import('./strategie/Storyboards'), 'StrategieStoryboards');
const StrategieCalendrier = l(() => import('./strategie/Calendrier'), 'StrategieCalendrier');
const StrategiePipeline = l(() => import('./strategie/Pipeline'), 'StrategiePipeline');
const StrategieEnquete = l(() => import('./strategie/Enquete'), 'StrategieEnquete');
const StrategieObjectifs = l(() => import('./strategie/Objectifs'), 'StrategieObjectifs');
const StrategieLiege = l(() => import('./strategie/Liege'), 'StrategieLiege');
const GardeCompteRendu = l(() => import('./garde/CompteRendu'), 'GardeCompteRendu');
const GardeHistorique = l(() => import('./garde/Historique'), 'GardeHistorique');
const GardeNuit = l(() => import('./garde/Nuit'), 'GardeNuit');
const SupervisorCarte = l(() => import('./supervisor/Carte'), 'SupervisorCarte');
const SupervisorCharge = l(() => import('./supervisor/Charge'), 'SupervisorCharge');
const SupervisorPlaces = l(() => import('./supervisor/Places'), 'SupervisorPlaces');
const SupervisorRenouvellements = l(() => import('./supervisor/Renouvellements'), 'SupervisorRenouvellements');
const CyberHameconnage = l(() => import('./cyber/Hameconnage'), 'CyberHameconnage');
const CyberSurface = l(() => import('./cyber/Surface'), 'CyberSurface');
const CyberSecrets = l(() => import('./cyber/Secrets'), 'CyberSecrets');
const CyberVulnerabilites = l(() => import('./cyber/Vulnerabilites'), 'CyberVulnerabilites');
const CyberCrise = l(() => import('./cyber/Crise'), 'CyberCrise');
const StudioPerformance = l(() => import('./studio/Performance'), 'StudioPerformance');
const StudioRecette = l(() => import('./studio/Recette'), 'StudioRecette');
const StudioAccessibilite = l(() => import('./studio/Accessibilite'), 'StudioAccessibilite');
const StrategieAttribution = l(() => import('./strategie/Attribution'), 'StrategieAttribution');
const StrategieTemoignages = l(() => import('./strategie/Temoignages'), 'StrategieTemoignages');
const StrategieTrackers = l(() => import('./strategie/Trackers'), 'StrategieTrackers');
const GardeSimulateur = l(() => import('./garde/Simulateur'), 'GardeSimulateur');

const calme = <div className="min-h-[40vh]" aria-busy="true" />;
const s = (C: React.ComponentType) => (
  <Suspense fallback={calme}>
    <C />
  </Suspense>
);

export function routesBureaux() {
  return (
    <>
      <Route path="/supervisor" element={s(SupervisorAccueil)} />
      <Route path="/supervisor/grille" element={s(SupervisorGrille)} />
      <Route path="/supervisor/a-traiter" element={s(SupervisorATraiter)} />
      <Route path="/supervisor/automatisations" element={s(SupervisorAutomatisations)} />
      <Route path="/supervisor/dossiers/:orgId" element={s(SupervisorDossier)} />
      <Route path="/supervisor/chercheur" element={s(SupervisorChercheur)} />
      <Route path="/supervisor/bug/:id" element={s(SupervisorBug)} />
      <Route path="/supervisor/groupes" element={s(SupervisorGroupes)} />
      <Route path="/supervisor/carte" element={s(SupervisorCarte)} />
      <Route path="/supervisor/charge" element={s(SupervisorCharge)} />
      <Route path="/supervisor/places" element={s(SupervisorPlaces)} />
      <Route path="/supervisor/renouvellements" element={s(SupervisorRenouvellements)} />
      <Route path="/cyber" element={s(CyberAccueil)} />
      <Route path="/cyber/posture" element={s(CyberMatrice)} />
      <Route path="/cyber/alertes" element={s(CyberAlertes)} />
      <Route path="/cyber/incidents/:id" element={s(CyberFicheIncident)} />
      <Route path="/cyber/inventaire" element={s(CyberInventaire)} />
      <Route path="/cyber/inventaire/:orgId" element={s(CyberInventaire)} />
      <Route path="/cyber/echeances" element={s(CyberEcheances)} />
      <Route path="/cyber/journal" element={s(CyberJournalAudit)} />
      <Route path="/cyber/playbooks" element={s(CyberPlaybooks)} />
      <Route path="/cyber/rapports" element={s(CyberRapports)} />
      <Route path="/cyber/carnet" element={s(CyberCarnet)} />
      <Route path="/cyber/hameconnage" element={s(CyberHameconnage)} />
      <Route path="/cyber/surface" element={s(CyberSurface)} />
      <Route path="/cyber/secrets" element={s(CyberSecrets)} />
      <Route path="/cyber/vulnerabilites" element={s(CyberVulnerabilites)} />
      <Route path="/cyber/crise" element={s(CyberCrise)} />
      <Route path="/studio" element={s(StudioAccueil)} />
      <Route path="/studio/pieces/:id" element={s(StudioPiece)} />
      <Route path="/studio/pieces/:id/:onglet" element={s(StudioPiece)} />
      <Route path="/studio/performance" element={s(StudioPerformance)} />
      <Route path="/studio/recette" element={s(StudioRecette)} />
      <Route path="/studio/accessibilite" element={s(StudioAccessibilite)} />
      <Route path="/strategie" element={s(StrategieAccueil)} />
      <Route path="/strategie/campagnes" element={s(StrategieCampagnes)} />
      <Route path="/strategie/storyboards" element={s(StrategieStoryboards)} />
      <Route path="/strategie/calendrier" element={s(StrategieCalendrier)} />
      <Route path="/strategie/pipeline" element={s(StrategiePipeline)} />
      <Route path="/strategie/pipeline/:id" element={s(StrategiePipeline)} />
      <Route path="/strategie/enquete" element={s(StrategieEnquete)} />
      <Route path="/strategie/objectifs" element={s(StrategieObjectifs)} />
      <Route path="/strategie/liege" element={s(StrategieLiege)} />
      <Route path="/strategie/attribution" element={s(StrategieAttribution)} />
      <Route path="/strategie/temoignages" element={s(StrategieTemoignages)} />
      <Route path="/strategie/trackers" element={s(StrategieTrackers)} />
      <Route path="/garde/organigramme" element={s(GardeAccueil)} />
      <Route path="/garde/compte-rendu/:id" element={s(GardeCompteRendu)} />
      <Route path="/garde/bureaux/:equipe/historique" element={s(GardeHistorique)} />
      <Route path="/garde/nuit" element={s(GardeNuit)} />
      <Route path="/garde/simulateur" element={s(GardeSimulateur)} />
    </>
  );
}
