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
      <Route path="/studio" element={s(StudioAccueil)} />
      <Route path="/strategie" element={s(StrategieAccueil)} />
      <Route path="/garde/organigramme" element={s(GardeAccueil)} />
    </>
  );
}
