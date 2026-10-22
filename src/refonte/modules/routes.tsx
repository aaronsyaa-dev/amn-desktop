import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { ModuleRoute } from '../../components/ModuleRoute';
import type { Registre } from './assembler';
import { REGISTRE_MODULES } from './registre';

/**
 * LES ROUTES DES ÉCRANS NEUFS — ce qui évite de toucher aux routes.
 *
 * `appRoot.internal.tsx` les monte une fois pour toutes (`{routesDuRegistre()}`),
 * comme il monte `routesBureaux()`. Chaque vue déclarée avec `nouveau` y
 * gagne sa route, son écran chargé à la demande, et la même garde que les
 * autres modules (`ModuleRoute` : un module fermé à l'organisation renvoie à
 * l'Accueil). Aucune aujourd'hui : la liste est vide.
 */
export function ecransNeufs(registre: Registre = REGISTRE_MODULES): { id: string; route: string; Ecran: React.LazyExoticComponent<React.ComponentType> }[] {
  return registre.vues.flatMap((v) => (v.nouveau ? [{ id: v.id, route: v.route, Ecran: lazy(v.nouveau.ecran) }] : []));
}

// Une fois, au chargement : `lazy` recréé à chaque rendu remonterait l'écran.
const ECRANS = ecransNeufs();

export function routesDuRegistre(): React.ReactElement[] {
  return ECRANS.map(({ id, route, Ecran }) => (
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
  ));
}
