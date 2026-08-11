import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isModuleEnabled } from '../data/spaces';

/**
 * Une route dont le module peut être fermé pour cette organisation (BLOC E).
 *
 * Retirer une entrée de la navigation ne suffit pas : un onglet mémorisé d'une
 * version antérieure, un lien collé ou l'adresse tapée à la main atteignent
 * l'écran quand même. On atterrit donc sur l'accueil, exactement comme le fait
 * déjà la route attrape-tout pour un chemin inconnu — le module fermé et le
 * module inexistant se comportent pareil, ce qui est le but.
 *
 * À redire une fois de plus, parce que c'est ce qui compte : ceci fait
 * disparaître un écran, ce n'est pas une frontière de sécurité. Les données
 * d'une organisation restent isolées par `org_id` côté amn-api, et c'est cette
 * isolation-là qui protège, pas cette redirection.
 */
export function ModuleRoute({
  module,
  children,
}: {
  module: string;
  children: React.ReactElement;
}) {
  const location = useLocation();
  if (isModuleEnabled(module)) return children;
  return <Navigate to="/" replace state={{ closedModule: module, from: location.pathname }} />;
}
