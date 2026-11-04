/**
 * LE TEMPS DE L'ÉCRAN DE VEILLE (G09) — l'horloge du poste et la géométrie de l'anneau des 24 heures.
 * Fonctions pures : `check:systeme-veille` les éprouve sans navigateur.
 *
 * L'anneau a MIDI EN HAUT et MINUIT EN BAS, 18 h à droite, 6 h à gauche : l'heure h est à l'angle
 * θ = (h − 12) × 15°, compté depuis le haut dans le sens des aiguilles d'une montre. En coordonnées d'écran
 * (y vers le bas) : x = r · sin θ, y = −r · cos θ.
 */

/** Le centre du dessin et ses rayons, en px de l'image 1440 × 900 (fiche G09, rubrique 3). */
export const CENTRE = { x: 720, y: 410 } as const;
export const RAYON_ANNEAU = 300;
/** Les traits partent de 292 px et vont vers l'extérieur : 11 px, 16 px aux repères 12, 18, 00 et 06. */
export const RAYON_TRAITS = 292;
export const TRAIT_COURT = 11;
export const TRAIT_LONG = 16;
export const RAYON_ETIQUETTES = 326;
export const ETIQUETTES: readonly { heure: number; texte: string }[] = [
  { heure: 12, texte: '12' },
  { heure: 18, texte: '18' },
  { heure: 0, texte: '00' },
  { heure: 6, texte: '06' },
];

/** L'angle d'une heure (décimale, 0 à 24), en degrés depuis le haut, sens horaire : midi 0°, minuit ±180°. */
export function angleHeure(heure: number): number {
  return (heure - 12) * 15;
}

/** Un point de l'anneau, en px depuis le centre (y vers le bas), arrondi au dixième. */
export function pointHeure(heure: number, rayon: number): { x: number; y: number } {
  const t = (angleHeure(heure) * Math.PI) / 180;
  const arrondi = (v: number) => Math.round(v * 10) / 10 + 0;
  return { x: arrondi(rayon * Math.sin(t)), y: arrondi(-rayon * Math.cos(t)) };
}

/** L'heure décimale locale du poste (10:42 → 10,7). Les secondes ne comptent pas : l'écran avance à la minute. */
export function heureDecimale(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

export type EtatTrait = 'ecoulee' | 'encours' | 'avenir';

/** L'état des 24 traits : écoulées avant l'heure en cours (partie entière de l'heure locale), à venir après. */
export function etatsDesHeures(d: Date): EtatTrait[] {
  const h = d.getHours();
  return Array.from({ length: 24 }, (_, i) => (i < h ? 'ecoulee' : i === h ? 'encours' : 'avenir'));
}

/** Un trait de l'anneau : son état, sa longueur, ses deux bouts (px depuis le centre). */
export function traitsDeLAnneau(d: Date): { heure: number; etat: EtatTrait; long: boolean; de: { x: number; y: number }; a: { x: number; y: number } }[] {
  const etats = etatsDesHeures(d);
  return etats.map((etat, heure) => {
    const long = heure % 6 === 0;
    return { heure, etat, long, de: pointHeure(heure, RAYON_TRAITS), a: pointHeure(heure, RAYON_TRAITS + (long ? TRAIT_LONG : TRAIT_COURT)) };
  });
}

/**
 * L'arc écoulé, de minuit à l'instant, en chemin SVG centré sur (0, 0). À minuit pile : `null` (rien d'écoulé).
 * Il tourne dans le sens horaire (drapeau 1), et prend le grand arc passé midi.
 */
export function arcEcoule(d: Date, rayon = RAYON_ANNEAU): string | null {
  const h = heureDecimale(d);
  if (h <= 0) return null;
  const de = pointHeure(0, rayon);
  const a = pointHeure(h, rayon);
  const grand = h > 12 ? 1 : 0;
  return `M ${de.x} ${de.y} A ${rayon} ${rayon} 0 ${grand} 1 ${a.x} ${a.y}`;
}

type Langue = 'fr' | 'en';
const locale = (langue: Langue) => (langue === 'fr' ? 'fr-FR' : 'en-GB');

/** « 10:42 » : heures et minutes du fuseau du poste, sur deux chiffres, JAMAIS de secondes. */
export function heureVeille(d: Date, langue: Langue): string {
  return d.toLocaleTimeString(locale(langue), { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** « Vendredi 30 octobre » : le jour du poste, avec une capitale. */
export function jourVeille(d: Date, langue: Langue): string {
  const jour = d.toLocaleDateString(locale(langue), { weekday: 'long', day: 'numeric', month: 'long' });
  return jour.charAt(0).toLocaleUpperCase(locale(langue)) + jour.slice(1);
}

/** Les millisecondes jusqu'à la prochaine minute pleine (pour réveiller l'horloge juste à temps). */
export function avantLaMinute(d: Date): number {
  return 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds());
}

/**
 * LA DÉRIVE ANTI-USURE : un pixel par minute, sur un petit carré (0,0) → (1,0) → (1,1) → (0,1). L'œil ne la voit
 * pas ; un écran qui reste des heures sur la même image s'use moins.
 */
export function deriveDeLaMinute(d: Date): { x: number; y: number } {
  const pas = Math.floor(d.getTime() / 60_000) % 4;
  return [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ][pas];
}
