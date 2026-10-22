import { ajouterJours, estDateIso, joursEntre } from '../_commun/nombres';

/**
 * RÉTROPLANNING — partir de la date promise et remonter les étapes.
 *
 * Le calcul remonte le temps :
 *
 *   1. la livraison, ramenée au dernier jour ouvré qui la précède ou l'égale ;
 *   2. le tampon (jours ouvrés gardés en réserve juste avant la livraison) ;
 *   3. les étapes, de la dernière à la première, bout à bout : chacune finit le
 *      jour ouvré qui précède le début de la suivante.
 *
 * Une étape compte en JOURS OUVRÉS (le travail) ou en JOURS CALENDAIRES (un
 * délai fournisseur, un séchage : le temps passe aussi le week-end). Une étape
 * calendaire peut donc commencer un samedi ; la suivante ne commence qu'un
 * jour ouvré.
 *
 * Jours ouvrés : du lundi au vendredi (samedi en option), hors jours fériés
 * nationaux de métropole en option. Le lundi de Pentecôte est compté férié :
 * beaucoup d'entreprises en font la journée de solidarité travaillée, d'où
 * l'option qui retire tous les fériés. Alsace-Moselle (Vendredi saint,
 * 26 décembre) et outre-mer : hors périmètre.
 */
export type Unite = 'ouvres' | 'calendaires';

export interface Etape {
  id: string;
  nom: string;
  duree: number;
  unite: Unite;
}

export interface Calendrier {
  samediOuvre: boolean;
  feries: boolean;
}

export interface EtapePlacee extends Etape {
  debut: string;
  fin: string;
}

export interface Plan {
  livraison: string;
  /** Les jours ouvrés gardés en réserve, du premier au dernier (vide sans tampon). */
  tampon: { debut: string; fin: string } | null;
  etapes: EtapePlacee[];
  /** Le jour où la première étape doit commencer, au plus tard. */
  demarrage: string;
  /**
   * Jours ouvrés entre aujourd'hui (compris) et le démarrage (non compris).
   * Négatif : le démarrage est déjà passé de tant de jours ouvrés.
   */
  marge: number;
}

export type ErreurPlan = 'livraison' | 'aujourdhui' | 'tampon' | 'aucuneEtape' | { etape: string; faute: 'nom' | 'duree' };

export const DUREE_MAX = 365;

/** Pâques (calendrier grégorien), algorithme anonyme dit de Meeus/Jones/Butcher. */
export function paques(annee: number): string {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

/** Les onze jours fériés nationaux de métropole (Code du travail, art. L3133-1). */
export function joursFeries(annee: number): string[] {
  const p = paques(annee);
  const fixes = ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].map((md) => `${annee}-${md}`);
  return [...fixes, ajouterJours(p, 1), ajouterJours(p, 39), ajouterJours(p, 50)].sort();
}

const cacheFeries = new Map<number, Set<string>>();
function estFerie(d: string): boolean {
  const annee = Number(d.slice(0, 4));
  let s = cacheFeries.get(annee);
  if (!s) cacheFeries.set(annee, (s = new Set(joursFeries(annee))));
  return s.has(d);
}

/** 0 = dimanche … 6 = samedi. */
export function jourDeSemaine(d: string): number {
  return new Date(`${d}T00:00:00Z`).getUTCDay();
}

export function estOuvre(d: string, c: Calendrier): boolean {
  const j = jourDeSemaine(d);
  if (j === 0 || (j === 6 && !c.samediOuvre)) return false;
  return !(c.feries && estFerie(d));
}

/** Le dernier jour ouvré qui précède ou égale `d`. */
function ouvreAuPlusTard(d: string, c: Calendrier): string {
  let x = d;
  while (!estOuvre(x, c)) x = ajouterJours(x, -1);
  return x;
}

/** Le jour ouvré strictement avant `d`. */
function ouvrePrecedent(d: string, c: Calendrier): string {
  return ouvreAuPlusTard(ajouterJours(d, -1), c);
}

/** Recule de `n` jours ouvrés depuis le jour ouvré `fin` (compris) : le premier des `n` jours. */
function reculerOuvres(fin: string, n: number, c: Calendrier): string {
  let x = fin;
  for (let i = 1; i < n; i += 1) x = ouvrePrecedent(x, c);
  return x;
}

/** Jours ouvrés de `a` (compris) à `b` (non compris) ; négatif si `b` est avant `a`. */
export function ouvresEntre(a: string, b: string, c: Calendrier): number {
  const signe = joursEntre(a, b) >= 0 ? 1 : -1;
  const [de, a2] = signe > 0 ? [a, b] : [b, a];
  let n = 0;
  for (let x = de; x < a2; x = ajouterJours(x, 1)) if (estOuvre(x, c)) n += 1;
  return signe * n;
}

export function verifier(livraison: string, tampon: number, etapes: readonly Etape[], aujourdhui: string): ErreurPlan[] {
  const e: ErreurPlan[] = [];
  if (!estDateIso(livraison)) e.push('livraison');
  if (!estDateIso(aujourdhui)) e.push('aujourdhui');
  if (!(Number.isInteger(tampon) && tampon >= 0 && tampon <= DUREE_MAX)) e.push('tampon');
  if (etapes.length === 0) e.push('aucuneEtape');
  for (const x of etapes) {
    if (!x.nom.trim()) e.push({ etape: x.id, faute: 'nom' });
    if (!(Number.isInteger(x.duree) && x.duree >= 1 && x.duree <= DUREE_MAX)) e.push({ etape: x.id, faute: 'duree' });
  }
  return e;
}

export function planifier(livraison: string, tampon: number, etapes: readonly Etape[], c: Calendrier, aujourdhui: string): Plan | null {
  if (verifier(livraison, tampon, etapes, aujourdhui).length > 0) return null;
  let curseur = ouvreAuPlusTard(livraison, c);
  let blocTampon: Plan['tampon'] = null;
  if (tampon > 0) {
    const debut = reculerOuvres(curseur, tampon, c);
    blocTampon = { debut, fin: curseur };
    curseur = ouvrePrecedent(debut, c);
  }
  const placees: EtapePlacee[] = [];
  for (let i = etapes.length - 1; i >= 0; i -= 1) {
    const x = etapes[i];
    const fin = curseur;
    const debut = x.unite === 'ouvres' ? reculerOuvres(fin, x.duree, c) : ajouterJours(fin, -(x.duree - 1));
    placees.unshift({ ...x, debut, fin });
    curseur = ouvrePrecedent(debut, c);
  }
  const demarrage = placees[0].debut;
  return { livraison, tampon: blocTampon, etapes: placees, demarrage, marge: ouvresEntre(aujourdhui, demarrage, c) };
}
