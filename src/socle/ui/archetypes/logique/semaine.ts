/**
 * LA SEMAINE, SANS REACT — placement des événements dans la grille horaire.
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Mode d'emploi : `placerEvenements({ jours, heureDebut, heureFin }, evenements)` rend, pour chaque événement,
 * sa colonne de jour, son haut et sa hauteur en pixels (46 px par heure) et sa place parmi ses voisins
 * qui se chevauchent (`colonne` sur `colonnes`). Aucune date n'est écrite ici : tout vient des arguments.
 * Le module n'importe rien, et c'est ce que `scripts/check-socle-archetypes.ts` charge tel quel.
 *
 * Les minutes se lisent à l'heure d'horloge locale (celle des étiquettes de la grille) : le jour d'un
 * changement d'heure, un événement reste donc en face de l'étiquette qui le nomme.
 */

export type Instant = Date | number | string;

/** 46 px par heure (01-SOCLE-DESIGN §5, règle A4). */
export const PX_PAR_HEURE = 46;
/** Hauteur minimale d'un bloc, pour qu'un rendez-vous de quelques minutes reste lisible et cliquable. */
export const HAUTEUR_MIN_BLOC = 22;
const MINUTES_PAR_JOUR = 24 * 60;

export interface EvenementBrut {
  id: string;
  debut: Instant;
  fin: Instant;
}

export interface OptionsPlacement {
  /** Les jours affichés, dans l'ordre (un `Date` par colonne ; seule la date compte). */
  jours: readonly Date[];
  /** Heure d'ouverture de la grille (0 à 24, fractions admises : 8,5 = 8 h 30). */
  heureDebut: number;
  /** Heure de fermeture de la grille. */
  heureFin: number;
  pxParHeure?: number;
  hauteurMin?: number;
}

export interface Placement {
  id: string;
  /** L'index du jour dans `jours`. */
  jour: number;
  /** Pixels depuis le haut de la grille. */
  haut: number;
  hauteur: number;
  /** Minutes depuis minuit, bornées à la plage affichée. */
  debutMin: number;
  finMin: number;
  /** L'événement commence avant la plage (ou la veille) / finit après. */
  coupeDebut: boolean;
  coupeFin: boolean;
  /** Sa colonne parmi `colonnes` voisines (à partir de 0). */
  colonne: number;
  colonnes: number;
  /** Combien de colonnes il occupe (1, ou plus s'il y a de la place à sa droite). */
  empan: number;
}

export interface ResultatPlacement {
  placements: Placement[];
  /** Les événements qui tombent un jour affiché mais hors de la plage d'heures, et ne s'affichent nulle part. */
  horsPlage: string[];
}

export function enMillis(t: Instant): number {
  return t instanceof Date ? t.getTime() : typeof t === 'number' ? t : new Date(t).getTime();
}

/** Minuit local du jour de `d`. */
export function debutDeJour(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Le jour suivant, à minuit local (sûr aux changements d'heure). */
export function jourSuivant(d: Date, n = 1): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function memeJour(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** `n` jours consécutifs à partir de `debut`. */
export function joursConsecutifs(debut: Date, n: number): Date[] {
  return Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => jourSuivant(debut, i));
}

/** Le premier jour de la semaine de `d` (`premierJour` : 0 = dimanche, 1 = lundi). */
export function debutDeSemaine(d: Date, premierJour = 1): Date {
  const ecart = (d.getDay() - premierJour + 7) % 7;
  return jourSuivant(debutDeJour(d), -ecart);
}

/** Les heures pleines dont on écrit l'étiquette : de `heureDebut` (incluse) à `heureFin` (exclue). */
export function heuresAffichees(heureDebut: number, heureFin: number): number[] {
  const n = Math.max(0, Math.ceil(heureFin - heureDebut));
  return Array.from({ length: n }, (_, i) => Math.floor(heureDebut) + i);
}

/** La hauteur totale de la grille. */
export function hauteurGrille(heureDebut: number, heureFin: number, pxParHeure = PX_PAR_HEURE): number {
  return Math.max(0, (heureFin - heureDebut) * pxParHeure);
}

/** Minutes d'horloge locale de `t` dans le jour qui commence à `jour`, bornées à [0, 1440]. */
/** Au millième de pixel : deux blocs qui se touchent ne se recouvrent pas de 10⁻¹⁴ px. */
const arrondi = (v: number): number => Math.round(v * 1000) / 1000;

function minutesDansJour(t: number, jour: Date): number {
  const debut = debutDeJour(jour).getTime();
  const fin = jourSuivant(jour).getTime();
  if (t <= debut) return 0;
  if (t >= fin) return MINUTES_PAR_JOUR;
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

interface Brouillon {
  id: string;
  /** Début et fin AFFICHÉS, en minutes : un bloc court garde sa hauteur minimale, et c'est elle qui le fait chevaucher. */
  s: number;
  e: number;
  placement: Placement;
}

/**
 * Chevauchements → colonnes. Les événements d'un même jour sont triés par début (le plus long d'abord), regroupés
 * en « amas » d'événements qui se touchent de proche en proche, puis rangés dans la première colonne libre de leur
 * amas. Tous les événements d'un amas partagent le même nombre de colonnes ; un événement s'élargit vers la droite
 * tant que les colonnes voisines sont libres sous lui.
 */
export function repartirEnColonnes(items: { id: string; s: number; e: number }[]): { id: string; colonne: number; colonnes: number; empan: number }[] {
  const tries = [...items].sort((a, b) => a.s - b.s || b.e - a.e || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const sortie: { id: string; colonne: number; colonnes: number; empan: number }[] = [];
  let amas: { item: { id: string; s: number; e: number }; colonne: number }[] = [];
  let finAmas = -Infinity;

  const clore = () => {
    if (amas.length === 0) return;
    const colonnes = Math.max(...amas.map((a) => a.colonne)) + 1;
    for (const a of amas) {
      let empan = 1;
      for (let c = a.colonne + 1; c < colonnes; c += 1) {
        const bloque = amas.some((b) => b.colonne === c && b.item.s < a.item.e && b.item.e > a.item.s);
        if (bloque) break;
        empan += 1;
      }
      sortie.push({ id: a.item.id, colonne: a.colonne, colonnes, empan });
    }
    amas = [];
    finAmas = -Infinity;
  };

  const finsDeColonne: number[] = [];
  for (const item of tries) {
    if (item.s >= finAmas) {
      clore();
      finsDeColonne.length = 0;
    }
    let colonne = finsDeColonne.findIndex((fin) => fin <= item.s);
    if (colonne < 0) colonne = finsDeColonne.length;
    finsDeColonne[colonne] = item.e;
    amas.push({ item, colonne });
    finAmas = Math.max(finAmas, item.e);
  }
  clore();
  return sortie;
}

export function placerEvenements(options: OptionsPlacement, evenements: readonly EvenementBrut[]): ResultatPlacement {
  const px = options.pxParHeure ?? PX_PAR_HEURE;
  const hauteurMin = options.hauteurMin ?? HAUTEUR_MIN_BLOC;
  const debutPlage = options.heureDebut * 60;
  const finPlage = options.heureFin * 60;
  const minutesMin = (hauteurMin / px) * 60;
  const placements: Placement[] = [];
  const horsPlage = new Set<string>();

  options.jours.forEach((jour, indexJour) => {
    const debutJour = debutDeJour(jour).getTime();
    const finJour = jourSuivant(jour).getTime();
    const brouillons: Brouillon[] = [];
    for (const ev of evenements) {
      const d = enMillis(ev.debut);
      let f = enMillis(ev.fin);
      if (!Number.isFinite(d) || !Number.isFinite(f)) continue;
      if (f < d) f = d;
      // Touche-t-il ce jour ? Un événement sans durée compte s'il tombe dans le jour.
      const sansDuree = d === f;
      if (!(d < finJour && (f > debutJour || (sansDuree && d >= debutJour)))) continue;
      const brutDebut = minutesDansJour(d, jour);
      const brutFin = minutesDansJour(f, jour);
      if (brutDebut >= finPlage || (sansDuree ? brutDebut < debutPlage : brutFin <= debutPlage)) {
        horsPlage.add(ev.id);
        continue;
      }
      const s = Math.max(brutDebut, debutPlage);
      const e = Math.min(Math.max(brutFin, s), finPlage);
      // Le bloc affiché : au moins `hauteurMin`, et remonté s'il dépasserait le bas de la grille.
      const sVis = Math.min(s, Math.max(debutPlage, finPlage - minutesMin));
      const eVis = Math.min(Math.max(e, sVis + minutesMin), finPlage);
      brouillons.push({
        id: ev.id,
        s: sVis,
        e: eVis,
        placement: {
          id: ev.id,
          jour: indexJour,
          haut: arrondi(((sVis - debutPlage) / 60) * px),
          hauteur: arrondi(((eVis - sVis) / 60) * px),
          debutMin: s,
          finMin: e,
          coupeDebut: d < debutJour || brutDebut < debutPlage,
          coupeFin: f > finJour || brutFin > finPlage,
          colonne: 0,
          colonnes: 1,
          empan: 1,
        },
      });
    }
    const rangs = repartirEnColonnes(brouillons.map((b) => ({ id: b.id, s: b.s, e: b.e })));
    const parId = new Map(brouillons.map((b) => [b.id, b.placement]));
    for (const r of rangs) {
      const p = parId.get(r.id);
      if (!p) continue;
      p.colonne = r.colonne;
      p.colonnes = r.colonnes;
      p.empan = r.empan;
    }
    placements.push(...brouillons.map((b) => b.placement).sort((a, b) => a.haut - b.haut || a.colonne - b.colonne));
  });
  const affiches = new Set(placements.map((p) => p.id));
  return { placements, horsPlage: [...horsPlage].filter((id) => !affiches.has(id)) };
}

/** La ligne « maintenant » : dans quelle colonne, à quelle hauteur ; `null` si ce n'est pas dans la grille. */
export function positionMaintenant(
  maintenant: Date,
  jours: readonly Date[],
  heureDebut: number,
  heureFin: number,
  pxParHeure = PX_PAR_HEURE,
): { jour: number; haut: number } | null {
  const jour = jours.findIndex((j) => memeJour(j, maintenant));
  if (jour < 0) return null;
  const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
  if (minutes < heureDebut * 60 || minutes > heureFin * 60) return null;
  return { jour, haut: arrondi(((minutes - heureDebut * 60) / 60) * pxParHeure) };
}
