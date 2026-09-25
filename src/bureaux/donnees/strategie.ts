import { useMemo } from 'react';
import { useCollection } from '../../state/SyncContext';
import { useMaintenant } from './useSupervisor';
import { jourDe } from './releves';
import type { Campagne, PieceMur, ProspectStrategie, Publication, Temoignage } from './types';

/**
 * STRATÉGIE — la salle de Riyad (cahier 11 `45d`, cahier 14 `49a`–`49e`).
 *
 * Le pipeline est celui du module Prospects (même collection `prospects`) :
 * Stratégie n'a pas un second fichier de prospects, elle lit le même et y
 * ajoute la prochaine étape et l'historique des échanges.
 *
 * L'ambre : la seule chose du mur qui attend Riyad aujourd'hui — l'appel le
 * plus ancien dû aujourd'hui (ou en retard). Une campagne programmée
 * n'attend personne : elle reste au papier.
 */

export type Prospect = ProspectStrategie & { id: string };
export type CampagneId = Campagne & { id: string };

export const ETAPES_CAMPAGNE: { cle: Campagne['etape']; nom: string }[] = [
  { cle: 'idee', nom: 'Idée' },
  { cle: 'scenario', nom: 'Scénario' },
  { cle: 'production', nom: 'Production' },
  { cle: 'publiee', nom: 'Publiée' },
  { cle: 'close', nom: 'Résultats' },
];
export const LIBELLE_ETAPE: Record<Campagne['etape'], string> = { idee: 'IDÉE', scenario: 'SCÉNARIO', production: 'EN PRODUCTION', publiee: 'PUBLIÉE', close: 'CLOSE' };

export const ETAPES_PIPELINE: { cle: ProspectStrategie['stage']; nom: string }[] = [
  { cle: 'contact', nom: 'Contact' },
  { cle: 'qualifie', nom: 'Qualifié' },
  { cle: 'proposition', nom: 'Devis envoyé' },
  { cle: 'gagne', nom: 'Gagné' },
  { cle: 'perdu', nom: 'Perdu' },
];

export const EN_COURS: ProspectStrategie['stage'][] = ['contact', 'qualifie', 'proposition'];

export const initiales = (nom: string) =>
  nom
    .split(/[\s'’-]+/)
    .filter((m) => m && /[A-Za-zÀ-ÿ]/.test(m[0]))
    .slice(0, 2)
    .map((m) => m[0].toUpperCase())
    .join('') || '·';

export interface ModeleStrategie {
  prospects: Prospect[];
  campagnes: CampagneId[];
  publications: (Publication & { id: string })[];
  temoignages: (Temoignage & { id: string })[];
  mur: (PieceMur & { id: string })[];
  /** Les appels dus aujourd'hui (ou en retard), le plus ancien d'abord. */
  appels: Prospect[];
  ambre: Prospect | null;
  /** La campagne bloquée — l'ambre des campagnes (`49a`). */
  bloquee: CampagneId | null;
  partAujourdHui: CampagneId[];
  pipeline: { prospects: number; devis: number; aRelancer: number };
  aujourdHui: string;
  semaine: string[];
}

/** Lundi → dimanche de la semaine de `t`, en AAAA-MM-JJ. */
export function semaineDe(t: number): string[] {
  const d = new Date(t);
  const lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => jourDe(new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i)));
}

/** Le numéro de semaine ISO — « SEMAINE 39 ». */
export function numeroDeSemaine(t: number): number {
  const d = new Date(t);
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - jour);
  const debut = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x.getTime() - debut.getTime()) / 86_400_000 + 1) / 7);
}

export function modeleStrategie(e: {
  prospects: Prospect[];
  campagnes: CampagneId[];
  publications: (Publication & { id: string })[];
  temoignages: (Temoignage & { id: string })[];
  mur: (PieceMur & { id: string })[];
  maintenant: number;
}): ModeleStrategie {
  const aujourdHui = jourDe(e.maintenant);
  const vivants = e.prospects.filter((p) => p.name && EN_COURS.includes(p.stage));
  const appels = vivants
    .filter((p) => p.prochaine?.appel && p.prochaine.at.slice(0, 10) <= aujourdHui)
    .sort((a, b) => (a.prochaine?.at ?? '').localeCompare(b.prochaine?.at ?? ''));
  const aRelancer = vivants.filter((p) => p.prochaine && !p.prochaine.appel && p.prochaine.at.slice(0, 10) <= aujourdHui).length;
  const bloquee = e.campagnes.filter((c) => c.bloquee && c.etape !== 'close').sort((a, b) => (a.bloquee?.depuis ?? '').localeCompare(b.bloquee?.depuis ?? ''))[0] ?? null;
  return {
    prospects: e.prospects,
    campagnes: e.campagnes,
    publications: e.publications,
    temoignages: e.temoignages,
    mur: e.mur,
    appels,
    ambre: appels[0] ?? null,
    bloquee,
    partAujourdHui: e.campagnes.filter((c) => c.programmeeLe?.slice(0, 10) === aujourdHui),
    pipeline: { prospects: vivants.length, devis: vivants.filter((p) => p.stage === 'proposition').length, aRelancer },
    aujourdHui,
    semaine: semaineDe(e.maintenant),
  };
}

export function useStrategie(): ModeleStrategie {
  const prospects = useCollection<ProspectStrategie>('prospects');
  const campagnes = useCollection<Campagne>('campagnes');
  const publications = useCollection<Publication>('publications');
  const temoignages = useCollection<Temoignage>('temoignages');
  const mur = useCollection<PieceMur>('strategieMur');
  const maintenant = useMaintenant(60_000);
  return useMemo(
    () =>
      modeleStrategie({
        prospects: prospects as Prospect[],
        campagnes: campagnes as CampagneId[],
        publications: publications as (Publication & { id: string })[],
        temoignages: temoignages as (Temoignage & { id: string })[],
        mur: mur as (PieceMur & { id: string })[],
        maintenant,
      }),
    [prospects, campagnes, publications, temoignages, mur, maintenant],
  );
}
