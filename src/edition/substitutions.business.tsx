/**
 * LA SUBSTITUTION D'ÉCRANS, CÔTÉ CLIENTE — rien, délibérément.
 *
 * L'édition cliente garde ses écrans tels quels : le point de substitution
 * rend l'`Outlet`, et le registre est vide. Ce fichier n'importe rien de
 * `src/socle/**` ni de `src/refonte/**` : le paquet client n'en contient pas
 * une ligne.
 */
import type React from 'react';
import { Outlet } from 'react-router-dom';

export const SubstitutionDEcran: React.FC<{ support?: boolean }> = () => <Outlet />;

/** Toujours vide : aucune substitution côté cliente. */
export const REGISTRE_SUBSTITUTIONS: { substitutions: readonly never[]; fautes: readonly never[] } = { substitutions: [], fautes: [] };
