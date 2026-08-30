/**
 * LA SÉRIE VITALE — la mémoire d'un chiffre, calculée honnêtement
 * ═══════════════════════════════════════════════════════════════
 *
 * Un nombre nu (« 7 clients ») ne dit ni d'où il vient ni où il va. La refonte
 * des Signes Vitaux veut que chaque relevé porte sa mémoire — une mini-courbe
 * des sept derniers jours et un delta. Ce module la calcule ; il ne l'invente
 * JAMAIS : pas de dates, pas de série, et l'écran affiche alors le nombre seul.
 *
 * ## Flux et stock — deux natures, deux lectures
 *
 * Un FLUX se compte par jour : trois rendez-vous lundi, zéro mardi. La courbe
 * est celle des arrivées, et « aujourd'hui » peut redescendre à zéro — c'est
 * une information, pas un bug.
 *
 * Un STOCK (le nombre de fiches clients) n'a pas d'historique d'états : on ne
 * stocke pas « combien de tâches étaient ouvertes mardi ». La seule lecture
 * honnête sans inventer est le CUMUL des créations : la courbe monte quand on
 * crée, et son dernier point est le total d'aujourd'hui. Elle ne prétend pas
 * savoir ce qui a été fermé quand — et son delta dit « n de plus en 7 jours »,
 * pas « le stock a monté de n », précisément pour ça.
 *
 * ## Pourquoi un module pur
 *
 * Même discipline que `notesLiens.ts` : tout ce qui est décidable sans écran
 * est écrit sans React ni DOM, et `scripts/check-vitaux.ts` l'exerce dans Node
 * avec des mutations. Une courbe fausse sous un vrai chiffre serait pire que
 * pas de courbe : elle donnerait au mensonge la crédibilité du reste.
 */

/** Un point de la série : la clé du jour (YYYY-MM-DD) et sa valeur. */
export interface PointVital {
  readonly jour: string;
  readonly valeur: number;
}

export interface SerieVitale {
  readonly points: PointVital[];
  /** Flux : le total des 7 jours. Stock : la variation sur 7 jours. */
  readonly delta: number;
  readonly nature: 'flux' | 'stock';
}

/** La clé locale d'un jour. LOCALE : un rendez-vous à 23 h n'est pas demain. */
export function cleJour(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Les `n` clés de jour jusqu'à aujourd'hui inclus, dans l'ordre. */
export function derniersJours(n: number, maintenant: Date): string[] {
  const jours: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(maintenant);
    d.setDate(d.getDate() - i);
    jours.push(cleJour(d));
  }
  return jours;
}

/** Une date exploitable, ou rien. Un enregistrement sans date ne compte pas. */
function jourDe(brut: unknown): string | null {
  if (typeof brut !== 'string' || !brut) return null;
  const t = Date.parse(brut);
  if (!Number.isFinite(t)) return null;
  return cleJour(new Date(t));
}

/**
 * FLUX — combien par jour, sur `jours` jours.
 *
 * Les enregistrements plus vieux que la fenêtre n'apparaissent pas ; ceux dont
 * la date est invalide non plus. Le delta est le total de la fenêtre : c'est le
 * chiffre qu'une phrase peut porter (« cinq cette semaine »).
 */
export function serieFlux(
  dates: ReadonlyArray<unknown>,
  jours: number,
  maintenant: Date,
): SerieVitale {
  const fenetre = derniersJours(jours, maintenant);
  const compte = new Map<string, number>(fenetre.map((j) => [j, 0]));
  for (const brut of dates) {
    const j = jourDe(brut);
    if (j !== null && compte.has(j)) compte.set(j, (compte.get(j) ?? 0) + 1);
  }
  const points = fenetre.map((jour) => ({ jour, valeur: compte.get(jour) ?? 0 }));
  return {
    points,
    delta: points.reduce((somme, p) => somme + p.valeur, 0),
    nature: 'flux',
  };
}

/**
 * STOCK — le cumul des créations, jour par jour.
 *
 * Chaque point vaut « combien existaient à la fin de ce jour-là », en ne
 * comptant que les créations (voir l'en-tête : les fermetures n'ont pas
 * d'historique, on ne les invente pas). Les enregistrements SANS date comptent
 * dans le socle : ils existent, on ne sait simplement pas depuis quand — les
 * exclure ferait mentir le dernier point, qui doit être le total d'aujourd'hui.
 */
export function serieStock(
  dates: ReadonlyArray<unknown>,
  jours: number,
  maintenant: Date,
): SerieVitale {
  const fenetre = derniersJours(jours, maintenant);
  const premier = fenetre[0];
  let socle = 0;
  const parJour = new Map<string, number>(fenetre.map((j) => [j, 0]));
  for (const brut of dates) {
    const j = jourDe(brut);
    if (j === null || j < premier) socle += 1;
    else if (parJour.has(j)) parJour.set(j, (parJour.get(j) ?? 0) + 1);
    // Une date FUTURE (horloge décalée) ne rentre nulle part : elle
    // gonflerait un jour qui n'existe pas encore.
  }
  let cumul = socle;
  const points = fenetre.map((jour) => {
    cumul += parJour.get(jour) ?? 0;
    return { jour, valeur: cumul };
  });
  return {
    points,
    delta: (points[points.length - 1]?.valeur ?? 0) - socle,
    nature: 'stock',
  };
}

/**
 * LE DELTA EN TOUTES LETTRES — la grammaire des Signes Vitaux.
 *
 * Pas de flèche ↑↓ (réflexe de tableau de bord), pas de pourcentage sur une
 * base de zéro. Les petits nombres s'écrivent en lettres, comme dans la
 * Relève. Un delta nul rend une chaîne vide : « zéro cette semaine » sous
 * chaque chiffre serait du bruit répété huit fois par écran.
 */
const EN_LETTRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];

export function litLeNombre(n: number): string {
  return n >= 0 && n <= 10 ? EN_LETTRES[n] : String(n);
}

export function phraseDelta(serie: SerieVitale): string {
  if (serie.delta === 0) return '';
  const n = litLeNombre(Math.abs(serie.delta));
  if (serie.nature === 'flux') return `${n} sur 7 jours`;
  return serie.delta > 0 ? `${n} de plus en 7 jours` : `${n} de moins en 7 jours`;
}

/**
 * LE TRACÉ — la courbe fantôme, prête pour un `<polyline>`.
 *
 * Normalisé dans [0..1] × [0..1], y=0 en HAUT (convention SVG). Une série
 * plate ne se dessine pas au bord mais au TIERS BAS : une ligne collée au
 * plancher se lit « zéro », or un stock plat à 7 n'est pas un zéro.
 * L'appelant multiplie par sa taille — le tracé ne connaît aucun pixel.
 */
export function traceSerie(serie: SerieVitale): Array<{ x: number; y: number }> {
  const n = serie.points.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: 0.5, y: 0.5 }];
  const valeurs = serie.points.map((p) => p.valeur);
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const plat = max === min;
  return serie.points.map((p, i) => ({
    x: i / (n - 1),
    y: plat ? 0.66 : 1 - (p.valeur - min) / (max - min),
  }));
}
