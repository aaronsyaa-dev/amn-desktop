import React from 'react';
import { HomeSoloScreen } from '../../business/HomeSoloScreen';
import type { Journee } from './journee';
import { hhmm } from './journee';

/**
 * CE QUI EST COMMUN AUX DIX ACCUEILS CLIENTS — l'en-tête discret (le nom de
 * l'espace, la date, l'heure) et la règle du premier jour : un espace vide
 * s'ouvre sur l'état « premier jour » de l'Accueil 2a (`27b`), quelle que
 * soit la variante choisie. Une une, une lettre ou un cadran sans rien
 * dedans diraient une journée vide comme un échec.
 */

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const dateCourte = (d: Date) => `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;

export function EnTeteAccueil({ j, nom }: { j: Journee; nom: string }) {
  return (
    <header data-guide="titre" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="sr-only">Accueil — {nom}</h1>
      <span className="eyebrow text-text-secondary">{j.org?.name ?? 'Accueil'}</span>
      <span className="h-3 w-px bg-border-raised" aria-hidden />
      <span className="tnum font-mono text-[11px] text-text-muted">
        {dateCourte(j.maintenant)} · {hhmm(j.maintenant)}
      </span>
    </header>
  );
}

/** Le premier jour : l'état `27b` de l'Accueil par défaut, pour toutes les variantes. */
export function SiPremierJour({ j, children }: { j: Journee; children: React.ReactNode }) {
  if (j.vide) return <HomeSoloScreen />;
  return <>{children}</>;
}

/** « 26 min » sous l'heure, « 2 h 10 » au-delà. */
export function duree(minutes: number): { nombre: string; unite: string } {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return { nombre: String(m), unite: 'min' };
  return { nombre: `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`, unite: '' };
}

export const euros = (cents: number) => `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;

export { enLettres } from '../lettres';
