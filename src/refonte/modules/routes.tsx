import React, { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { ModuleRoute } from '../../components/ModuleRoute';
import { useAssistant } from '../../assistant/AssistantContext';
import type { Registre } from './assembler';
import type { VueRemplacee } from './declarer';
import { REGISTRE_MODULES } from './registre';

/**
 * LES ROUTES DU REGISTRE — ce qui évite de toucher aux routes.
 *
 * `appRoot.internal.tsx` les monte une fois pour toutes (`{routesDuRegistre()}`),
 * comme il monte `routesBureaux()`. Deux sortes :
 *
 *   · les écrans neufs : chaque vue déclarée avec `nouveau` y gagne sa route,
 *     son écran chargé à la demande, et la même garde que les autres modules
 *     (`ModuleRoute` : un module fermé à l'organisation renvoie à l'Accueil).
 *     Aucun aujourd'hui ;
 *   · les vues remplacées : leur route reste et renvoie ailleurs. Celle d'Ajmani
 *     (`/garde/ajmani`) arrive sur la Salle et ouvre le panneau assistant (⌘J).
 */
export function ecransNeufs(registre: Registre = REGISTRE_MODULES): { id: string; route: string; Ecran: React.LazyExoticComponent<React.ComponentType> }[] {
  return registre.vues.flatMap((v) => (v.nouveau ? [{ id: v.id, route: v.route, Ecran: lazy(v.nouveau.ecran) }] : []));
}

/** Les redirections des vues remplacées, pour que le contrôle les lise sans React. */
export function redirections(registre: Registre = REGISTRE_MODULES): { id: string; route: string; vers: string; assistant: boolean }[] {
  return registre.remplacees.map((r: VueRemplacee) => ({ id: r.id, route: r.route, vers: r.redirection.vers, assistant: r.redirection.assistant === true }));
}

// Une fois, au chargement : `lazy` recréé à chaque rendu remonterait l'écran.
const ECRANS = ecransNeufs();
const REDIRECTIONS = redirections();

/** Ouvre le panneau assistant, puis passe là où la vue remplacée renvoie. `replace` : le retour ne reboucle pas. */
function VersLAssistant({ vers }: { vers: string }) {
  const { open } = useAssistant();
  useEffect(() => {
    open();
  }, [open]);
  return <Navigate to={vers} replace />;
}

export function routesDuRegistre(): React.ReactElement[] {
  return [
    ...ECRANS.map(({ id, route, Ecran }) => (
      <Route
        key={id}
        path={route}
        element={
          <ModuleRoute module={id}>
            <Suspense fallback={null}>
              <Ecran />
            </Suspense>
          </ModuleRoute>
        }
      />
    )),
    ...REDIRECTIONS.map(({ id, route, vers, assistant }) => (
      <Route key={id} path={route} element={assistant ? <VersLAssistant vers={vers} /> : <Navigate to={vers} replace />} />
    )),
  ];
}
