import { jourDe, type Releves } from './releves';
import type { OrgPoints } from './parc';
import type { RegleParc, ReleveParc } from './types';

/**
 * LES AUTOMATISATIONS DE SUPERVISOR — cahier 12, `46d`.
 *
 * Une règle s'écrit en phrase : QUAND [sujet] [condition] [durée] ALORS
 * [action] [pour qui] SAUF [exception]. Chaque morceau est un menu ; le
 * vocabulaire est fermé, ici, parce que chaque condition doit pouvoir se
 * REJOUER sur les trente derniers jours — c'est-à-dire se lire dans les
 * relevés quotidiens du parc (`parcReleves`). Une condition qu'on ne saurait
 * pas rejouer ne serait pas proposée.
 *
 * Les actions, elles, sont toutes réelles : une tâche dans le module Tâches
 * (pour la personne choisie, ou pour celle qui suit l'organisation), ou une
 * note au carnet de bord de Cyber, attachée à la cliente.
 */

export type Unite = 'jours' | 'heures';
export interface Condition {
  cle: string;
  nom: string;
  unite: Unite;
  defaut: number;
  /** La condition, lue dans le relevé d'un jour (et ceux d'avant). */
  vraie: (lire: (decalage: number) => ReleveParc['orgs'][string] | null, duree: number) => boolean;
  /** La même, sur l'état d'aujourd'hui. */
  aujourdhui: (o: OrgPoints, e: EtatDuJour, duree: number) => boolean;
  /** Ce qu'on dit d'une organisation qui la remplit aujourd'hui. */
  constat: (o: OrgPoints, e: EtatDuJour) => string;
}

export interface EtatDuJour {
  maintenant: number;
  /** La tendance de posture sur 7 jours, par organisation (Cyber). */
  tendance: Map<string, number | null>;
  /** Organisations dont un site est tombé (incident de disponibilité ouvert). */
  enPanne: Set<string>;
}

const silence = (o: OrgPoints, maintenant: number) => (o.org.lastActivityAt ? Math.floor((maintenant - Date.parse(o.org.lastActivityAt)) / 86_400_000) : null);

export const SUJETS: { cle: string; nom: string; conditions: Condition[] }[] = [
  {
    cle: 'organisation',
    nom: 'une organisation',
    conditions: [
      {
        cle: 'silence',
        nom: 'n’a pas ouvert son desktop',
        unite: 'jours',
        defaut: 10,
        vraie: (lire, d) => {
          const s = lire(0)?.silenceJ;
          return typeof s === 'number' && s >= d;
        },
        aujourdhui: (o, e, d) => {
          const s = silence(o, e.maintenant);
          return s !== null && s >= d;
        },
        constat: (o, e) => `${silence(o, e.maintenant)} jours sans ouverture`,
      },
      {
        cle: 'sans_personne',
        nom: 'a des points et personne pour les suivre',
        unite: 'jours',
        defaut: 2,
        vraie: (lire, d) => {
          for (let k = 0; k < Math.max(1, d); k += 1) {
            const r = lire(k);
            if (!r || !(r.poids > 0) || r.suivi !== 'personne') return false;
          }
          return true;
        },
        aujourdhui: (o) => o.poids > 0 && o.suivi.type === 'personne',
        constat: (o) => `poids ${o.poids}, personne dessus`,
      },
      {
        cle: 'critique',
        nom: 'est au critique',
        unite: 'jours',
        defaut: 1,
        vraie: (lire) => (lire(0)?.points?.critique ?? 0) > 0,
        aujourdhui: (o) => o.points.critique > 0,
        constat: () => 'un critique ouvert',
      },
    ],
  },
  {
    cle: 'jeton',
    nom: 'un jeton de places',
    conditions: [
      {
        cle: 'attend',
        nom: 'attend une validation',
        unite: 'jours',
        defaut: 1,
        vraie: (lire, d) => {
          for (let k = 0; k < Math.max(1, d); k += 1) if (!((lire(k)?.points?.jeton ?? 0) > 0)) return false;
          return true;
        },
        aujourdhui: (o) => o.points.jeton > 0,
        constat: () => 'un jeton de places en attente',
      },
    ],
  },
  {
    cle: 'posture',
    nom: 'la posture',
    conditions: [
      {
        cle: 'baisse',
        nom: 'perd plus de 5 points',
        unite: 'jours',
        defaut: 7,
        vraie: (lire, d) => {
          const a = lire(0)?.score;
          const b = lire(d)?.score;
          return typeof a === 'number' && typeof b === 'number' && a - b <= -5;
        },
        aujourdhui: (o, e) => (e.tendance.get(o.id) ?? 0) <= -5,
        constat: (o, e) => `${e.tendance.get(o.id)} points en 7 jours`,
      },
    ],
  },
  {
    cle: 'site',
    nom: 'un site',
    conditions: [
      {
        cle: 'panne',
        nom: 'tombe',
        unite: 'jours',
        defaut: 1,
        vraie: (lire) => Boolean(lire(0)?.enPanne),
        aujourdhui: (o, e) => e.enPanne.has(o.id),
        constat: () => 'un site injoignable',
      },
    ],
  },
];

export const ACTIONS = [
  { cle: 'tache_relance', nom: 'créer une tâche de relance' },
  { cle: 'prevenir', nom: 'prévenir' },
  { cle: 'carnet', nom: 'noter au carnet de Cyber' },
] as const;

export const EXCEPTIONS: { cle: string; nom: string; vraie: (r: ReleveParc['orgs'][string] | null) => boolean; aujourdhui: (o: OrgPoints) => boolean }[] = [
  { cle: 'rien', nom: 'rien', vraie: () => false, aujourdhui: () => false },
  { cle: 'arrivee', nom: 'si elle est en arrivée', vraie: (r) => (r?.points?.arrivee ?? 0) > 0, aujourdhui: (o) => o.points.arrivee > 0 },
  { cle: 'suspendue', nom: 'si elle est suspendue', vraie: (r) => r?.actif === false, aujourdhui: (o) => o.statut === 'suspended' },
  { cle: 'incident', nom: 'si un incident est déjà ouvert', vraie: (r) => (r?.points?.incident ?? 0) + (r?.points?.critique ?? 0) > 0, aujourdhui: (o) => o.points.incident + o.points.critique > 0 },
  { cle: 'garde', nom: 'si la Garde la suit', vraie: (r) => r?.suivi === 'garde', aujourdhui: (o) => o.suivi.type === 'garde' },
];

export const conditionDe = (r: Pick<RegleParc, 'sujet' | 'condition'>) => SUJETS.find((s) => s.cle === r.sujet)?.conditions.find((c) => c.cle === r.condition) ?? null;
export const exceptionDe = (cle: string) => EXCEPTIONS.find((e) => e.cle === cle) ?? EXCEPTIONS[0];
export const actionDe = (cle: string) => ACTIONS.find((a) => a.cle === cle) ?? ACTIONS[0];

/** La phrase d'une règle, telle qu'on la lit dans la liste. */
export function phraseRegle(r: RegleParc, nomPour: (qui: string) => string): string {
  const s = SUJETS.find((x) => x.cle === r.sujet);
  const c = conditionDe(r);
  return `${s?.nom ?? r.sujet} ${c?.nom ?? r.condition}${c && r.duree ? ` depuis ${r.duree} ${c.unite}` : ''}, alors ${actionDe(r.action).nom} pour ${nomPour(r.pourQui)}${r.sauf && r.sauf !== 'rien' ? `, sauf ${exceptionDe(r.sauf).nom}` : ''}`;
}

export interface Rejeu {
  jours: { jour: string; orgs: string[] }[];
  total: number;
  distinctes: number;
  /** Le plus grand nombre de déclenchements pour une même organisation. */
  maxParOrg: number;
  /** Jours du rejeu qui n'avaient pas de relevé : ils ne peuvent rien dire. */
  sansReleve: number;
}

/**
 * Le rejeu : la règle appliquée aux trente derniers jours. Elle se déclenche
 * sur un FRONT — le jour où la condition devient vraie pour une organisation —
 * et non chaque jour où elle le reste : c'est ce qu'elle ferait en vrai.
 */
export function rejouer(r: Pick<RegleParc, 'sujet' | 'condition' | 'duree' | 'sauf'>, releves: Releves, orgIds: string[], maintenant: number, jours = 30): Rejeu {
  const c = conditionDe(r);
  const x = exceptionDe(r.sauf);
  const res: Rejeu = { jours: [], total: 0, distinctes: 0, maxParOrg: 0, sansReleve: 0 };
  if (!c) return res;
  const lire = (orgId: string, j: number) => (decalage: number) => releves.get(jourDe(maintenant - (j + decalage) * 86_400_000))?.orgs[orgId] ?? null;
  const parOrg = new Map<string, number>();
  for (let j = jours - 1; j >= 0; j -= 1) {
    const jour = jourDe(maintenant - j * 86_400_000);
    if (!releves.has(jour)) {
      res.sansReleve += 1;
      res.jours.push({ jour, orgs: [] });
      continue;
    }
    const orgs: string[] = [];
    for (const id of orgIds) {
      const auj = c.vraie(lire(id, j), r.duree);
      if (!auj || x.vraie(lire(id, j)(0))) continue;
      const veille = c.vraie(lire(id, j + 1), r.duree);
      if (veille) continue;
      orgs.push(id);
      parOrg.set(id, (parOrg.get(id) ?? 0) + 1);
    }
    res.total += orgs.length;
    res.jours.push({ jour, orgs });
  }
  res.distinctes = parOrg.size;
  res.maxParOrg = Math.max(0, ...parOrg.values());
  return res;
}

/** Les organisations qui remplissent la règle AUJOURD'HUI — ce qui partira à l'activation. */
export function candidates(r: Pick<RegleParc, 'sujet' | 'condition' | 'duree' | 'sauf'>, orgs: OrgPoints[], e: EtatDuJour): OrgPoints[] {
  const c = conditionDe(r);
  if (!c) return [];
  const x = exceptionDe(r.sauf);
  return orgs.filter((o) => c.aujourdhui(o, e, r.duree) && !x.aujourdhui(o)).sort((a, b) => b.poids - a.poids || a.nom.localeCompare(b.nom, 'fr'));
}
