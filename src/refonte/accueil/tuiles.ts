/**
 * LES QUATRE TUILES DE L'ACCUEIL — des chiffres qui existent, ou rien.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Règle de la refonte : on n'affiche que des données qui existent vraiment.
 * Une tuile dont la source est vide, ou pas encore synchronisée, n'est PAS
 * rendue — jamais un zéro inventé, jamais un tiret qui ferait croire à un
 * chiffre. Pur : les contrôles le rejouent hors application.
 *
 *   ca        — ce qui a été encaissé ce mois-ci (factures payées, TTC), et
 *               le mois précédent pour comparer, s'il y a eu quelque chose ;
 *   attente   — les factures émises qui restent dues, leur montant, et
 *               combien sont en retard ;
 *   equipe    — les tâches ouvertes de l'équipe, dont en cours, et faites
 *               depuis lundi ;
 *   objectif  — ce que la revue hebdo de la semaine passée a fixé pour
 *               celle-ci (« la semaine prochaine »).
 */

export interface FactureTuile {
  /** `creditNote` pour un avoir. */
  kind?: string;
  status: string;
  /** AAAA-MM-JJ, vide si impayée. */
  paidAt: string;
  /** TTC, en centimes. */
  brutCents: number;
  /** Ce qui reste dû (avoirs déduits), en centimes. */
  duCents: number;
  enRetard: boolean;
}

export interface TacheTuile {
  status: string;
  updatedAt?: string;
}

export interface SourcesTuiles {
  /** Les collections ont répondu au moins une fois. */
  pret: boolean;
  maintenant: Date;
  factures: FactureTuile[];
  taches: TacheTuile[];
  /** Le « semaine prochaine » de la revue de la semaine passée, tel quel. */
  objectif: string | null;
}

export type Tuile =
  | { cle: 'ca'; cents: number; moisPrecedentCents: number | null }
  | { cle: 'attente'; nombre: number; cents: number; enRetard: number }
  | { cle: 'equipe'; ouvertes: number; enCours: number; faitesSemaine: number }
  | { cle: 'objectif'; texte: string };

const mois = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Le lundi de la semaine de `d`, en AAAA-MM-JJ local. */
export function lundiDe(d: Date): string {
  const j = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  j.setDate(j.getDate() - ((j.getDay() + 6) % 7));
  return `${j.getFullYear()}-${String(j.getMonth() + 1).padStart(2, '0')}-${String(j.getDate()).padStart(2, '0')}`;
}

export function calculerTuiles(s: SourcesTuiles): Tuile[] {
  if (!s.pret) return [];
  const tuiles: Tuile[] = [];
  const factures = s.factures.filter((f) => f.kind !== 'creditNote' && (f.status === 'issued' || f.status === 'paid'));

  if (factures.length) {
    const ceMois = mois(s.maintenant);
    const avant = mois(new Date(s.maintenant.getFullYear(), s.maintenant.getMonth() - 1, 1));
    const encaisse = (m: string) => factures.filter((f) => f.status === 'paid' && f.paidAt.slice(0, 7) === m).reduce((n, f) => n + f.brutCents, 0);
    const precedent = encaisse(avant);
    tuiles.push({ cle: 'ca', cents: encaisse(ceMois), moisPrecedentCents: precedent > 0 ? precedent : null });

    const dues = factures.filter((f) => f.status === 'issued' && f.duCents > 0);
    tuiles.push({ cle: 'attente', nombre: dues.length, cents: dues.reduce((n, f) => n + f.duCents, 0), enRetard: dues.filter((f) => f.enRetard).length });
  }

  if (s.taches.length) {
    const lundi = lundiDe(s.maintenant);
    tuiles.push({
      cle: 'equipe',
      ouvertes: s.taches.filter((t) => t.status === 'todo' || t.status === 'doing').length,
      enCours: s.taches.filter((t) => t.status === 'doing').length,
      faitesSemaine: s.taches.filter((t) => t.status === 'done' && (t.updatedAt ?? '').slice(0, 10) >= lundi).length,
    });
  }

  const objectif = s.objectif?.trim();
  if (objectif) tuiles.push({ cle: 'objectif', texte: objectif.length > 140 ? `${objectif.slice(0, 138).trimEnd()}…` : objectif });

  return tuiles;
}

/** Le « + 12 % » face au mois précédent, ou `null` s'il n'y a rien à comparer. */
export function evolution(cents: number, precedent: number | null): number | null {
  if (!precedent) return null;
  return Math.round(((cents - precedent) / precedent) * 100);
}

/**
 * LA SÉRIE — jours consécutifs cochés, la meilleure de toutes les routines.
 * Même règle que l'écran Routines : on remonte depuis aujourd'hui, ou depuis
 * hier si aujourd'hui n'est pas encore coché. Moins de 2 jours, ce n'est pas
 * une série : la pastille n'apparaît pas.
 */
export function meilleureSerie(routines: { ticks: string[] }[], maintenant: Date): number {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let meilleure = 0;
  for (const r of routines) {
    const set = new Set(r.ticks ?? []);
    const jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    if (!set.has(iso(jour))) jour.setDate(jour.getDate() - 1);
    let n = 0;
    while (n < 400 && set.has(iso(jour))) {
      n += 1;
      jour.setDate(jour.getDate() - 1);
    }
    meilleure = Math.max(meilleure, n);
  }
  return meilleure >= 2 ? meilleure : 0;
}
