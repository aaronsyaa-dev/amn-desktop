import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ModuleRoute } from '../../components/ModuleRoute';
import { useCoquilleActive } from '../coquille/drapeau';
import { REGISTRE_SUBSTITUTIONS, trouverSubstitution, type RegistreSubstitutions } from './registre';

/**
 * LE POINT UNIQUE DE SUBSTITUTION — à la place de chaque `<Outlet />` de la coque interne.
 *
 * `AppLayout` (ses deux sorties : ancienne coquille et `CoquilleRefonte`) et
 * `ClientContextLayout` (la session de support cliente, `support`) le montent
 * par la couture `@edition/substitutions` ; côté cliente, le jumeau rend
 * `<Outlet />` et rien d'autre.
 *
 * Quand le chemin courant est déclaré (`registre.ts`, `matchPath` : routes
 * exactes et paramétrées), le substitut est rendu à la place de la route
 * d'origine : dans `ModuleRoute` si un module est déclaré (un module fermé
 * renvoie à l'Accueil, comme pour la route d'origine), dans `Suspense` avec le
 * même repli (`null`) que les routes paresseuses de `appRoot.internal.tsx`.
 * Sinon, l'`Outlet` : l'écran d'origine, à l'identique. Coquille éteinte, seul
 * un substitut `toujours` apparaît.
 */
export function SubstitutionDEcran({ support = false }: { support?: boolean }) {
  const coquille = useCoquilleActive();
  return <SubstitutionDEcranDe registre={REGISTRE_SUBSTITUTIONS} support={support} coquille={coquille} />;
}

/** Le même point, sur un registre et un contexte donnés : ce que le contrôle déroule avec une substitution factice. */
export function SubstitutionDEcranDe({
  registre,
  support,
  coquille,
}: {
  registre: RegistreSubstitutions;
  support: boolean;
  coquille: boolean;
}) {
  const { pathname } = useLocation();
  const substitution = trouverSubstitution(pathname, { support, coquille }, registre);
  if (!substitution) return <Outlet />;
  const Ecran = substitution.composant;
  const contenu = (
    <Suspense fallback={null}>
      <Ecran />
    </Suspense>
  );
  if (!substitution.module) return contenu;
  return <ModuleRoute module={substitution.module}>{contenu}</ModuleRoute>;
}
