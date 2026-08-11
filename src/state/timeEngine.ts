/**
 * Le moteur du module Temps — les durées, sans écran.
 *
 * ## Une seule façon de calculer une durée
 *
 * C'est la décision qui gouverne tout le module. Une saisie manuelle
 * (« j'ai oublié de lancer le chrono, mets-moi 2 h hier ») n'écrit PAS une
 * durée dans un champ à part : elle écrit un début et une fin, comme un
 * chronomètre l'aurait fait. Il n'existe donc jamais deux vérités sur la durée
 * d'une période — le cas classique où un total d'écran et un total de facture
 * finissent par ne plus dire la même chose.
 *
 * ## Le chronomètre en cours est un enregistrement comme les autres
 *
 * Une période dont `endedAt` est vide est celle qui tourne. Elle est donc
 * synchronisée : lancée depuis le téléphone, elle se voit et s'arrête depuis
 * le poste. Un état local aurait été plus simple à écrire et faux dès le
 * deuxième appareil.
 */

/* -------------------------------- Les formes ------------------------------- */

/** Ce qui est stocké pour une période (`id` est la clé d'enregistrement). */
export interface TimeEntryData {
  /** Ce sur quoi on travaille, en clair. Peut être vide : le projet suffit souvent. */
  label: string;
  /** Rattachement optionnel à un projet — le même `projectId` que partout. */
  projectId?: string;
  /** Horodatage ISO complet du début. */
  startedAt: string;
  /** Horodatage ISO complet de la fin ; chaîne vide tant que ça tourne. */
  endedAt: string;
  /**
   * Horodatage du report sur une facture ; chaîne vide tant que ça n'a pas été
   * facturé. Un marqueur plutôt qu'un booléen : savoir QUAND un temps est parti
   * en facture est ce qui permet de comprendre un écart six mois plus tard.
   */
  invoicedAt: string;
  createdAt: string;
}

export interface TimeEntry extends TimeEntryData {
  id: string;
  updatedAt: string;
}

export interface TimeConfig {
  /** Tarif horaire proposé quand un temps devient une ligne de facture. */
  hourlyRateCents: number;
}

export function defaultTimeConfig(): TimeConfig {
  return { hourlyRateCents: 0 };
}

export function normalizeTimeConfig(row: Partial<TimeConfig> | undefined): TimeConfig {
  const rate = Math.round(Number(row?.hourlyRateCents));
  return { hourlyRateCents: Number.isFinite(rate) && rate > 0 ? rate : 0 };
}

/* -------------------------------- Les durées ------------------------------- */

/** Une période en cours ? C'est la seule définition, et il n'y en aura pas d'autre. */
export function isRunning(entry: { endedAt: string }): boolean {
  return !entry.endedAt;
}

/**
 * La durée d'une période, en millisecondes.
 *
 * Pour une période en cours, elle se mesure jusqu'à `now` — d'où le paramètre,
 * qui rend la fonction pure et donc vérifiable. Jamais négative : une horloge
 * remise à l'heure entre le début et la fin ne doit pas produire un total qui
 * DIMINUE quand on ajoute du travail.
 */
export function durationMs(entry: { startedAt: string; endedAt: string }, now = Date.now()): number {
  const start = new Date(entry.startedAt).getTime();
  if (!Number.isFinite(start)) return 0;
  const end = entry.endedAt ? new Date(entry.endedAt).getTime() : now;
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

export function totalMs(entries: { startedAt: string; endedAt: string }[], now = Date.now()): number {
  return entries.reduce((sum, entry) => sum + durationMs(entry, now), 0);
}

/**
 * « 2 h 05 », « 45 min », « 0 min » — le format des récapitulatifs.
 *
 * Les secondes n'y figurent pas volontairement : personne ne lit un total de
 * la semaine à la seconde près, et les afficher donne une fausse précision à
 * une saisie qui, elle, est approximative.
 */
export function formatDuration(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalMinutes = Math.floor(safe / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - hours * 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

/**
 * « 00:14:07 » — le chronomètre qui tourne, lui, compte les secondes.
 *
 * C'est ce qui rend visible qu'il TOURNE. Un affichage figé à la minute
 * laisserait croire que le compteur est arrêté, et on relancerait par-dessus.
 */
export function formatStopwatch(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds - hours * 3600) / 60);
  const seconds = totalSeconds - hours * 3600 - minutes * 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Durée → heures décimales arrondies au centième, ce qu'attend une ligne de facture. */
export function msToBillableHours(ms: number): number {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return Math.round((safe / 3600000) * 100) / 100;
}

/* --------------------------------- Les jours -------------------------------- */

/** Jour ISO local (`2026-08-11`) d'un horodatage. */
export function dayOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/**
 * Le lundi de la semaine d'un jour donné, en jour ISO.
 *
 * Lundi et non dimanche : c'est la semaine française, et une semaine de
 * travail qui commencerait le dimanche décalerait tous les récapitulatifs d'un
 * jour sans que personne comprenne pourquoi.
 */
export function weekStart(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDay;
  // `getDay()` vaut 0 le dimanche : on le ramène à 6 pour que lundi vaille 0.
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** « lun. 11 août » — l'en-tête d'un groupe de la liste. */
export function formatDayHeading(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDay;
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
}

/** « 14:05 » — l'heure d'une période dans la liste. */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ------------------------------ La saisie manuelle -------------------------- */

/**
 * Une saisie manuelle → un début et une fin, comme un chronomètre.
 *
 * L'heure de départ conventionnelle (9 h) n'a aucune importance en soi : ce
 * qui compte est que la période tombe dans le bon JOUR et porte la bonne
 * durée. La poser à minuit ferait basculer une saisie de fin de journée sur le
 * lendemain dès qu'on dépasse 24 h cumulées.
 */
export function manualRange(isoDay: string, minutes: number): { startedAt: string; endedAt: string } {
  const safeMinutes = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
  const start = new Date(`${isoDay}T09:00:00`);
  if (Number.isNaN(start.getTime())) {
    const now = new Date();
    return { startedAt: now.toISOString(), endedAt: new Date(now.getTime() + safeMinutes * 60000).toISOString() };
  }
  return {
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + safeMinutes * 60000).toISOString(),
  };
}

/** « 2 » → 120 min, « 1h30 » → 90, « 45m » → 45, « 1,5 » → 90. */
export function parseDurationInput(input: string): number {
  const text = input.trim().toLowerCase().replace(',', '.');
  if (!text) return 0;
  const composite = /^(\d+)\s*h\s*(\d+)?$/.exec(text);
  if (composite) {
    return Number(composite[1]) * 60 + Number(composite[2] ?? 0);
  }
  const minutesOnly = /^(\d+(?:\.\d+)?)\s*(?:m|min)$/.exec(text);
  if (minutesOnly) return Math.round(Number(minutesOnly[1]));
  const hoursOnly = /^(\d+(?:\.\d+)?)\s*h?$/.exec(text);
  if (hoursOnly) return Math.round(Number(hoursOnly[1]) * 60);
  return 0;
}
