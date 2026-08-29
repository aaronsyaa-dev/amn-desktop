/**
 * Arithmétique de calendrier, en heure LOCALE.
 *
 * Tout passe par des `Date` locales et des clés `YYYY-MM-DD` construites à la
 * main. `toISOString().slice(0, 10)` aurait été plus court et faux : il rend la
 * date UTC, donc un rendez-vous du 3 à 23 h en France tombe le 4 dans la
 * grille. La semaine commence lundi, comme partout en France.
 */

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const MONTH_LABELS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** Clé de jour en heure locale — l'index de regroupement de tout le module. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  // On repart du 1er du mois : ajouter un mois au 31 janvier donnerait le
  // 3 mars, et la grille sauterait février.
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return d;
}

/** Lundi de la semaine contenant `date`. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const shift = (d.getDay() + 6) % 7; // 0 = lundi
  return addDays(d, -shift);
}

/**
 * Les 42 jours affichés par une grille mensuelle : le mois complet, complété
 * par les jours des mois voisins. Toujours 6 semaines, pour que la grille ne
 * change pas de hauteur d'un mois à l'autre.
 */
export function monthGrid(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function weekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function monthLabel(date: Date): string {
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * La première lettre en capitale, ET RIEN D'AUTRE.
 *
 * Les trois libellés de l'agenda passaient par la classe CSS `capitalize`, qui
 * met une capitale à CHAQUE mot. En anglais c'est la convention ; en français
 * c'est une faute, et elle se lisait à l'écran :
 *
 *     Semaine Du 24 Août        au lieu de   Semaine du 24 août
 *     Lundi 24 Août             au lieu de   Lundi 24 août
 *
 * Les noms de mois et de jours ne prennent pas de majuscule en français, et
 * « du » encore moins. `toLocaleDateString('fr-FR')` rend d'ailleurs déjà tout
 * en minuscules — c'est exactement ce qu'il faut, à la première lettre près
 * quand le libellé ouvre une phrase.
 *
 * D'où cette fonction plutôt qu'une classe : seul l'appelant sait si son
 * libellé commence une phrase, et le CSS ne sait pas lire le français.
 */
export function capitaliserPhrase(texte: string): string {
  return texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : texte;
}

export function longDayLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Valeur d'un `<input type="datetime-local">` pour une date locale donnée. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * Lecture d'un `datetime-local`. La valeur n'a pas de fuseau : `new Date(v)`
 * l'interprète en heure locale, ce qui est exactement ce qu'a saisi
 * l'utilisatrice. On repasse ensuite en ISO absolu pour le stockage.
 */
export function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

/** « dans 2 h 15 » / « il y a 10 min », pour l'accueil et les rappels. */
export function relativeToNow(iso: string): string {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  const abs = Math.abs(diffMin);
  const spell = abs < 60 ? `${abs} min` : `${Math.floor(abs / 60)} h ${String(abs % 60).padStart(2, '0')}`;
  if (diffMin >= 0) return `dans ${spell}`;
  return `il y a ${spell}`;
}
