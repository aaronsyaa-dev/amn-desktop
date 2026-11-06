/**
 * LOT-06 · CRÉER ET PRODUIRE — aides communes (logique pure, sans React).
 *
 * Rien ici ne lit l'horloge : « aujourd'hui » et « maintenant » sont toujours
 * passés en paramètre, pour qu'un test, une capture et un écran voient le même
 * monde. Les jours sont des chaînes `AAAA-MM-JJ` du calendrier de Paris ; les
 * instants sont des chaînes ISO ou des millisecondes.
 *
 * Les mises en forme chiffrées (« 3 840 € », « 92 % ») existent dans le module de mise en forme des graphiques du socle,
 * mais `check:socle-graphiques` interdit d'importer ce module hors de la liste qu'il connaît :
 * on en garde ici l'essentiel (espaces et séparateurs), à remplacer par l'import du socle le jour
 * où le CO l'autorise (voir `STATUT.md`, section LOT-06).
 */

export type Jour = string;
export type Langue = 'fr' | 'en';

const MS_JOUR = 86_400_000;
/** Espace insécable : devant `%`, `€`, `h`, `min`. */
export const INSECABLE = '\u00a0';
/** Espace insécable fine : entre les milliers. */
export const ESPACE_FINE = '\u202f';

const formateurs = new Map<number, Intl.NumberFormat>();
/** « 12 400 », « 1 234,5 » : milliers en insécable fine, virgule décimale, quelle que soit la version d'ICU. */
export function formaterNombre(valeur: number, options: { decimales?: number } = {}): string {
  if (!Number.isFinite(valeur)) return '—';
  const max = Math.min(10, Math.max(0, Math.trunc(options.decimales ?? 2)));
  let f = formateurs.get(max);
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: max, useGrouping: true });
    formateurs.set(max, f);
  }
  return f.format(valeur).replace(/[\s\u00a0\u202f]/g, ESPACE_FINE);
}

/* ------------------------------ Jours ------------------------------ */

const versUtc = (j: Jour): number => {
  const [a, m, d] = j.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const jourDeUtc = (ms: number): Jour => new Date(ms).toISOString().slice(0, 10);

/** Nombre de jours de `de` à `a` (positif si `a` est après `de`). */
export const ecartJours = (de: Jour, a: Jour): number => Math.round((versUtc(a) - versUtc(de)) / MS_JOUR);
export const ajouterJours = (j: Jour, n: number): Jour => jourDeUtc(versUtc(j) + n * MS_JOUR);

/** Ajoute `n` mois en gardant le jour, ramené à la fin du mois si besoin (31 janv. + 1 mois = 28 ou 29 févr.). */
export function ajouterMois(j: Jour, n: number): Jour {
  const [a, m, d] = j.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  const an = Math.floor(t / 12);
  const mois = (t % 12 + 12) % 12;
  const dernier = new Date(Date.UTC(an, mois + 1, 0)).getUTCDate();
  return `${an}-${String(mois + 1).padStart(2, '0')}-${String(Math.min(d, dernier)).padStart(2, '0')}`;
}

/** 0 = lundi … 6 = dimanche. */
export const jourDeSemaine = (j: Jour): number => (new Date(versUtc(j)).getUTCDay() + 6) % 7;
export const lundiDe = (j: Jour): Jour => ajouterJours(j, -jourDeSemaine(j));
export const debutDeMois = (j: Jour): Jour => `${j.slice(0, 7)}-01`;
export const memeMois = (a: Jour, b: Jour): boolean => a.slice(0, 7) === b.slice(0, 7);

/** Semaine ISO 8601 (« Sem. 44 »). */
export function semaineIso(j: Jour): { annee: number; semaine: number } {
  const jeudi = ajouterJours(lundiDe(j), 3);
  const annee = Number(jeudi.slice(0, 4));
  const premierJeudi = ajouterJours(lundiDe(`${annee}-01-04`), 3);
  return { annee, semaine: 1 + Math.round(ecartJours(premierJeudi, jeudi) / 7) };
}

/**
 * Écart de semaines entre la semaine du `jour` et une `semaine` ISO (numéro seul,
 * comme dans les étapes de chantier). Positif : la semaine citée est passée.
 * Le numéro seul ne dit pas l'année : au-delà de 26 semaines d'écart, on suppose
 * l'année voisine (la semaine 2 vue en décembre est celle de janvier).
 */
export function semainesDepuis(semaine: number, jour: Jour): number {
  const { annee, semaine: courante } = semaineIso(jour);
  const semainesDeLAnnee = semaineIso(`${annee}-12-28`).semaine; // le 28 décembre est toujours dans la dernière semaine ISO
  let ecart = courante - semaine;
  if (ecart > 26) ecart -= semainesDeLAnnee;
  if (ecart < -26) ecart += semainesDeLAnnee;
  return ecart;
}

/* ------------------------- Heures de Paris ------------------------- */

const formateursParis = new Map<string, Intl.DateTimeFormat>();
function parisParts(ms: number): Record<string, string> {
  let f = formateursParis.get('p');
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    formateursParis.set('p', f);
  }
  const sortie: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) sortie[p.type] = p.value;
  return sortie;
}
const msDe = (instant: string | number): number => (typeof instant === 'number' ? instant : Date.parse(instant));

/** Le jour (calendrier de Paris) d'un instant. */
export function jourParis(instant: string | number): Jour {
  const p = parisParts(msDe(instant));
  return `${p.year}-${p.month}-${p.day}`;
}
/** Minutes écoulées depuis minuit, heure de Paris. */
export function minutesParis(instant: string | number): number {
  const p = parisParts(msDe(instant));
  return Number(p.hour) * 60 + Number(p.minute);
}

/** « 09:30 » → 570. */
export function minutesDe(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}
/** 570 → « 09:30 » (revient dans 00:00–23:59). */
export function hhmmDe(minutes: number): string {
  const t = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** « 2 h », « 2 h 30 », « 1 h 15 », « 45 min » (règle de MR06). */
export function formaterDuree(minutes: number): string {
  const t = Math.max(0, Math.round(minutes));
  if (t < 60) return `${t}${INSECABLE}min`;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return m === 0 ? `${h}${INSECABLE}h` : `${h}${INSECABLE}h${INSECABLE}${String(m).padStart(2, '0')}`;
}

/* ------------------------------ Mots ------------------------------ */

export const JOURS_COURTS: Record<Langue, readonly string[]> = {
  fr: ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};
export const MOIS_COURTS: Record<Langue, readonly string[]> = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
export const MOIS_LONGS: Record<Langue, readonly string[]> = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** « 4 nov. » / « Nov 4 ». */
export function jourEtMois(j: Jour, langue: Langue = 'fr'): string {
  const mois = MOIS_COURTS[langue][Number(j.slice(5, 7)) - 1];
  const jour = Number(j.slice(8, 10));
  return langue === 'fr' ? `${jour}${INSECABLE}${mois}` : `${mois} ${jour}`;
}
/** « jeu. 5 ». */
export function jourCourtEtNumero(j: Jour, langue: Langue = 'fr'): string {
  return `${JOURS_COURTS[langue][jourDeSemaine(j)]} ${Number(j.slice(8, 10))}`;
}

/** Première lettre en capitale (« janv. 2027 » → « Janv. 2027 »). */
export const capitale = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ----------------------------- Nombres ----------------------------- */

export const borner = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
/** Pourcentage entier de `part` sur `total` ; 0 si le total est nul. */
export const pourcentDe = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);
export const somme = (valeurs: readonly number[]): number => valeurs.reduce((s, v) => s + v, 0);

/** Choisit le singulier pour 0 et 1 (usage français), le pluriel au-delà. */
export const estPluriel = (n: number): boolean => Math.abs(n) >= 2;

/** Les mêmes éléments, regroupés par clé, dans l'ordre d'apparition. */
export function grouper<T, K extends string | number>(liste: readonly T[], cle: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const t of liste) {
    const k = cle(t);
    const g = m.get(k);
    if (g) g.push(t);
    else m.set(k, [t]);
  }
  return m;
}
