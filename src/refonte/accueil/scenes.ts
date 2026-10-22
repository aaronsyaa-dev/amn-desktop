import type { Situation } from './ajmani/phrases';

/**
 * CE QU'AJMANI DIT EN HAUT DE L'ACCUEIL — une phrase, choisie selon le moment.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Une seule fonction pure : elle reçoit ce qu'on sait de la journée (des
 * comptes, jamais des fiches) et rend la situation de la bibliothèque et ses
 * paramètres. Ajmani n'a plus de corps : c'est un message discret sous la
 * salutation, rien de plus. L'ordre de priorité :
 *
 *   1. compte neuf ou vide — l'invitation à démarrer ;
 *   2. alerte — un point critique, toujours dit sérieusement ;
 *   3. fin de journée (18 h et après) — le récapitulatif ;
 *   4. matin (avant midi) — les rendez-vous du jour ;
 *   5. sinon, journée calme — une relance, ou un module qu'on ouvre peu.
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
  if (j.compteVide) return { scene: 'neuf', situation: 'neuf.bienvenue', params: {} };
  if (j.alerte) return { scene: 'alerte', situation: SITUATION_ALERTE[j.alerte.type], params: { jours: j.alerte.jours ?? 0 } };
  if (j.heure >= 18 || j.heure < 5) {
    if (estTard(j.heure) && j.faitsAujourdhui === 0) return { scene: 'soir', situation: 'tard', params: {} };
    return j.faitsAujourdhui > 0
      ? { scene: 'soir', situation: 'soir.recap', params: { faits: j.faitsAujourdhui, restants: j.restants } }
      : { scene: 'soir', situation: 'soir.leger', params: {} };
  }
  if (j.heure < 12) {
    if (j.rdvAVenir > 1 && j.premierRdv) return { scene: 'matin', situation: 'matin.rdv', params: { n: j.rdvAVenir, nom: j.premierRdv } };
    if (j.rdvAVenir === 1 && j.premierRdv) return { scene: 'matin', situation: 'matin.rdv1', params: { nom: j.premierRdv } };
    return { scene: 'matin', situation: 'matin.libre', params: {} };
  }
  if (j.relance) return { scene: 'calme', situation: 'relance', params: { nom: j.relance.nom, jours: j.relance.jours } };
  if (j.module) return { scene: 'calme', situation: 'calme.module', params: { module: j.module } };
  return { scene: 'calme', situation: 'calme.rien', params: {} };
}
