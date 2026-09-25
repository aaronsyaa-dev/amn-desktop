import React from 'react';
import { HomeScreen } from '../../screens/HomeScreen';
import type { QG } from './qg';
import { hhmm } from './qg';

/**
 * CE QUI EST COMMUN AUX DIX ACCUEILS INTERNES — l'en-tête discret et la règle
 * de repli : tant que la Garde n'a pas répondu (ou ne répond pas), l'Accueil
 * reste l'Accueil 2a. Un radar vide ou un compteur à zéro diraient « le parc
 * est calme » alors qu'on ne sait rien.
 */
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function EnTeteQG({ q, nom }: { q: QG; nom: string }) {
  const d = q.maintenant;
  return (
    <header data-guide="titre" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="sr-only">Accueil — {nom}</h1>
      <span className="eyebrow text-text-secondary">Accueil</span>
      <span className="h-3 w-px bg-border-raised" aria-hidden />
      <span className="tnum font-mono text-[11px] text-text-muted">
        {JOURS[d.getDay()]} {d.getDate()} {MOIS[d.getMonth()]} · {hhmm(d)}
      </span>
    </header>
  );
}

/** La Garde muette ou pas encore lue : l'Accueil par défaut, qui sait dire ce qu'il sait. */
export function SiGardeLue({ q, children }: { q: QG; children: React.ReactNode }) {
  if (!q.pret) return <div className="min-h-[60vh]" aria-busy="true" />;
  if (!q.accueil) return <HomeScreen />;
  return <>{children}</>;
}

/** Le nom d'une organisation par son identifiant, ou « AMN » pour ce qui n'en a pas. */
export const nomOrg = (q: QG, id: string | null, secours?: string | null) => (id ? q.organisations.find((o) => o.id === id)?.name ?? secours ?? 'une organisation' : secours ?? 'AMN');
