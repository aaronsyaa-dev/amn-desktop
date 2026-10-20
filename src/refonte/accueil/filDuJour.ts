import type { Famille } from '../../socle/familles';

/**
 * LE FIL DU JOUR — automatique, puis modifiable.
 * ══════════════════════════════════════════════
 *
 * Construit sans React à partir de lignes déjà simplifiées (le hook
 * `useFilDuJour` lit les collections existantes et `useAttention`) :
 *
 *   · les points critiques de l'attention, en tête ;
 *   · les rendez-vous du jour, dans l'ordre de l'heure ;
 *   · les factures à relancer, de la plus en retard à la moins en retard ;
 *   · les tâches ouvertes (« en cours » avant « à faire »).
 *
 * Puis la main de la personne par-dessus, rangée sur ce poste pour la
 * journée : cocher une ligne (« fait »), la masquer, ajouter la sienne.
 * Rien ne modifie les données d'origine : cocher une relance ne marque pas
 * la facture payée.
 */

export type TypeLigne = 'alerte' | 'rdv' | 'facture' | 'tache' | 'perso';

export interface LigneFil {
  cle: string;
  type: TypeLigne;
  titre: string;
  /** Une précision courte : l'heure, le retard, le statut. */
  detail: string;
  /** Où aller pour agir. */
  vers: string | null;
  famille: Famille;
  /** Pour l'heure des rendez-vous (tri). */
  quand?: string;
}

export interface SourcesFil {
  alertes: { cle: string; titre: string; detail: string; vers: string }[];
  rdv: { id: string; titre: string; quand: string; heure: string }[];
  factures: { id: string; nom: string; jours: number }[];
  taches: { id: number | string; titre: string; enCours: boolean }[];
}

export interface RetouchesFil {
  jour: string;
  faits: string[];
  masques: string[];
  ajouts: { cle: string; titre: string }[];
}

export function retouchesVides(jour: string): RetouchesFil {
  return { jour, faits: [], masques: [], ajouts: [] };
}

/** Le fil automatique, sans retouches. `libelles` vient des mots de l'Accueil (fr/en). */
export function construireFil(s: SourcesFil, libelles: { relancer: (nom: string) => string; retard: (jours: number) => string; enCours: string; aFaire: string }): LigneFil[] {
  const lignes: LigneFil[] = [];
  for (const a of s.alertes) lignes.push({ cle: `alerte:${a.cle}`, type: 'alerte', titre: a.titre, detail: a.detail, vers: a.vers, famille: 'outils' });
  for (const r of [...s.rdv].sort((x, y) => x.quand.localeCompare(y.quand))) {
    lignes.push({ cle: `rdv:${r.id}`, type: 'rdv', titre: r.titre, detail: r.heure, vers: '/agenda', famille: 'jour', quand: r.quand });
  }
  for (const f of [...s.factures].sort((x, y) => y.jours - x.jours)) {
    lignes.push({ cle: `facture:${f.id}`, type: 'facture', titre: libelles.relancer(f.nom), detail: libelles.retard(f.jours), vers: '/relances', famille: 'argent' });
  }
  for (const t of [...s.taches].sort((x, y) => Number(y.enCours) - Number(x.enCours))) {
    lignes.push({ cle: `tache:${t.id}`, type: 'tache', titre: t.titre, detail: t.enCours ? libelles.enCours : libelles.aFaire, vers: '/tasks', famille: 'jour' });
  }
  return lignes;
}

/** Le fil tel qu'on le montre : retouches du jour appliquées (celles d'un autre jour sont ignorées). */
export function appliquerRetouches(lignes: LigneFil[], r: RetouchesFil, jour: string): { visibles: (LigneFil & { fait: boolean })[]; masquees: number } {
  const ret = r.jour === jour ? r : retouchesVides(jour);
  const perso: LigneFil[] = ret.ajouts.map((a) => ({ cle: a.cle, type: 'perso', titre: a.titre, detail: '', vers: null, famille: 'ecrire' }));
  const toutes = [...lignes, ...perso];
  const visibles = toutes.filter((l) => !ret.masques.includes(l.cle)).map((l) => ({ ...l, fait: ret.faits.includes(l.cle) }));
  // Ce qui est fait descend en bas, sans changer l'ordre du reste.
  visibles.sort((a, b) => Number(a.fait) - Number(b.fait));
  return { visibles, masquees: toutes.length - visibles.length };
}

export function basculerFait(r: RetouchesFil, jour: string, cle: string): RetouchesFil {
  const ret = r.jour === jour ? r : retouchesVides(jour);
  return { ...ret, faits: ret.faits.includes(cle) ? ret.faits.filter((c) => c !== cle) : [...ret.faits, cle] };
}

export function masquer(r: RetouchesFil, jour: string, cle: string): RetouchesFil {
  const ret = r.jour === jour ? r : retouchesVides(jour);
  return ret.masques.includes(cle) ? ret : { ...ret, masques: [...ret.masques, cle] };
}

export function toutReafficher(r: RetouchesFil, jour: string): RetouchesFil {
  const ret = r.jour === jour ? r : retouchesVides(jour);
  return { ...ret, masques: [] };
}

/** Ajoute une ligne à soi ; un titre vide ou trop long (> 140) est refusé. */
export function ajouter(r: RetouchesFil, jour: string, titre: string, cle: string): RetouchesFil {
  const ret = r.jour === jour ? r : retouchesVides(jour);
  const propre = titre.trim().replace(/\s+/g, ' ');
  if (!propre || propre.length > 140) return ret;
  return { ...ret, ajouts: [...ret.ajouts, { cle: `perso:${cle}`, titre: propre }] };
}

/** Les trois choses du matin : les trois premières lignes non faites. */
export function troisChoses<T extends { fait: boolean }>(visibles: T[]): T[] {
  return visibles.filter((l) => !l.fait).slice(0, 3);
}
