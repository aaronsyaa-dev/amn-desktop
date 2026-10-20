import type { Emotion } from './ajmani/expressions';
import type { Situation } from './ajmani/phrases';
import type { Geste } from './ajmani/Ajmani';

/**
 * LES SCÈNES DE L'ACCUEIL — laquelle jouer, selon le moment.
 * ══════════════════════════════════════════════════════════
 *
 * Une seule fonction pure : elle reçoit ce qu'on sait de la journée (des
 * comptes, jamais des fiches) et rend la scène, l'émotion d'Ajmani, son geste
 * et ce qu'il dit. L'ordre de priorité :
 *
 *   1. compte neuf ou vide — les étapes guidées ;
 *   2. alerte — un point critique : il est sérieux, le visage passe à l'ambre ;
 *   3. fin de journée (18 h et après) — le récapitulatif ;
 *   4. matin (avant midi) — les trois choses du jour ;
 *   5. sinon, journée calme — il suggère un module qu'on n'ouvre pas souvent.
 *
 * Tard le soir (21 h – 6 h), il est fatigué, sauf en alerte.
 * Les modules, eux, ne bougent jamais : la scène change le haut de l'Accueil,
 * pas la grille.
 */

export type Scene = 'neuf' | 'alerte' | 'matin' | 'calme' | 'soir';

export type TypeAlerte = 'site' | 'facture' | 'securite' | 'autre';

export interface Journee {
  heure: number;
  /** Rien du tout dans le compte : ni client, ni facture, ni rendez-vous, ni tâche. */
  compteVide: boolean;
  /** Le premier point critique, s'il y en a un. */
  alerte: { type: TypeAlerte; jours?: number } | null;
  /** Rendez-vous encore à venir aujourd'hui, dans l'ordre. */
  rdvAVenir: number;
  premierRdv: string | null;
  /** Relance la plus ancienne qui n'est pas critique. */
  relance: { nom: string; jours: number } | null;
  faitsAujourdhui: number;
  restants: number;
  /** Le module suggéré en journée calme. */
  module: string | null;
}

export interface Mise {
  scene: Scene;
  emotion: Emotion;
  geste: Geste | null;
  situation: Situation;
  params: Record<string, string | number>;
}

const SITUATION_ALERTE: Record<TypeAlerte, Situation> = {
  site: 'alerte.site',
  facture: 'alerte.facture',
  securite: 'alerte.securite',
  autre: 'alerte.autre',
};

export function estTard(heure: number): boolean {
  return heure >= 21 || heure < 6;
}

export function choisirScene(j: Journee): Mise {
  const tard = estTard(j.heure);
  if (j.compteVide) return { scene: 'neuf', emotion: 'curieux', geste: 'saluer', situation: 'neuf.bienvenue', params: {} };
  if (j.alerte) {
    return { scene: 'alerte', emotion: 'alerte', geste: 'pointer', situation: SITUATION_ALERTE[j.alerte.type], params: { jours: j.alerte.jours ?? 0 } };
  }
  if (j.heure >= 18 || j.heure < 5) {
    if (tard && j.faitsAujourdhui === 0) return { scene: 'soir', emotion: 'fatigue', geste: null, situation: 'tard', params: {} };
    return j.faitsAujourdhui > 0
      ? { scene: 'soir', emotion: tard ? 'fatigue' : 'content', geste: tard ? null : 'hocher', situation: 'soir.recap', params: { faits: j.faitsAujourdhui, restants: j.restants } }
      : { scene: 'soir', emotion: tard ? 'fatigue' : 'neutre', geste: null, situation: 'soir.leger', params: {} };
  }
  if (j.heure < 12) {
    if (j.rdvAVenir > 1 && j.premierRdv) return { scene: 'matin', emotion: 'content', geste: 'hocher', situation: 'matin.rdv', params: { n: j.rdvAVenir, nom: j.premierRdv } };
    if (j.rdvAVenir === 1 && j.premierRdv) return { scene: 'matin', emotion: 'content', geste: 'hocher', situation: 'matin.rdv1', params: { nom: j.premierRdv } };
    return { scene: 'matin', emotion: 'curieux', geste: null, situation: 'matin.libre', params: {} };
  }
  if (j.relance) return { scene: 'calme', emotion: 'taquin', geste: 'pointer', situation: 'relance', params: { nom: j.relance.nom, jours: j.relance.jours } };
  if (j.module) return { scene: 'calme', emotion: 'curieux', geste: 'pointer', situation: 'calme.module', params: { module: j.module } };
  return { scene: 'calme', emotion: 'neutre', geste: 'hausser', situation: 'calme.rien', params: {} };
}
