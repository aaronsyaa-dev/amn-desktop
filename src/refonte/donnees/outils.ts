/**
 * OUTILS DES JEUX DE DONNÉES FICTIVES
 * ═══════════════════════════════════
 *
 * Trois exigences, et rien d'autre :
 *
 *   1. REPRODUCTIBLE — le même `graine` donne les mêmes données, à la virgule
 *      près. Un écran, un test et une capture voient donc le même monde.
 *   2. STABLE DANS LE TEMPS — rien ne lit l'horloge. Le « maintenant » est un
 *      paramètre (`MAINTENANT_REFERENCE` par défaut : le vendredi 30 octobre
 *      2026 à 10 h 15, heure de Paris, le jour des maquettes). Une capture prise
 *      dans un an montre la même chose.
 *   3. JUSTE EN FRANÇAIS — les jours et les heures sont ceux de Paris, y compris
 *      aux changements d'heure.
 *
 * Aucune dépendance : ce fichier tourne dans l'application, sous Node et dans
 * un test, sans rien à installer.
 */

/* ------------------------------ Volumes ------------------------------ */

/**
 * Les quatre « tailles » d'un jeu. Les nombres exacts sont propres à chaque
 * jeu (voir `compter`) : « beaucoup » d'avis, ce n'est pas « beaucoup » de
 * clients. Ce qui est garanti partout : `vide` rend une liste vide, et
 * `beaucoup` dépasse une page d'écran (pour éprouver défilement et pagination).
 */
export type Volume = 'vide' | 'peu' | 'normal' | 'beaucoup';
export const VOLUMES: readonly Volume[] = ['vide', 'peu', 'normal', 'beaucoup'];

/** Le nombre d'éléments d'un jeu selon le volume : `[vide, peu, normal, beaucoup]`. */
export function compter(volume: Volume, tailles: readonly [number, number, number, number]): number {
  return tailles[VOLUMES.indexOf(volume)];
}

/* --------------------------- Hasard à graine --------------------------- */

export interface Hasard {
  /** Réel dans [0, 1). */
  reel(): number;
  /** Entier dans [min, max], bornes comprises. */
  entier(min: number, max: number): number;
  /** Un élément du tableau (le tableau ne doit pas être vide). */
  choix<T>(liste: readonly T[]): T;
  /** Vrai avec la probabilité `p`. */
  chance(p: number): boolean;
  /** Un élément tiré avec des poids (`[valeur, poids]`). */
  pondere<T>(liste: readonly (readonly [T, number])[]): T;
  /** `n` éléments distincts. */
  echantillon<T>(liste: readonly T[], n: number): T[];
  /** Copie mélangée (Fisher-Yates), l'original n'est pas touché. */
  melanger<T>(liste: readonly T[]): T[];
}

/** mulberry32 : 32 bits d'état, rapide, largement suffisant pour des données d'essai. */
export function hasard(graine: number): Hasard {
  let a = graine >>> 0;
  const reel = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entier = (min: number, max: number) => min + Math.floor(reel() * (max - min + 1));
  const choix = <T,>(liste: readonly T[]): T => liste[Math.floor(reel() * liste.length)];
  return {
    reel,
    entier,
    choix,
    chance: (p) => reel() < p,
    pondere: (liste) => {
      const total = liste.reduce((s, [, p]) => s + p, 0);
      let x = reel() * total;
      for (const [valeur, p] of liste) {
        x -= p;
        if (x < 0) return valeur;
      }
      return liste[liste.length - 1][0];
    },
    echantillon: (liste, n) => {
      const copie = [...liste];
      for (let i = copie.length - 1; i > 0; i -= 1) {
        const j = Math.floor(reel() * (i + 1));
        [copie[i], copie[j]] = [copie[j], copie[i]];
      }
      return copie.slice(0, Math.max(0, Math.min(n, copie.length)));
    },
    melanger: (liste) => {
      const copie = [...liste];
      for (let i = copie.length - 1; i > 0; i -= 1) {
        const j = Math.floor(reel() * (i + 1));
        [copie[i], copie[j]] = [copie[j], copie[i]];
      }
      return copie;
    },
  };
}

/** Une graine dérivée d'un texte : chaque jeu a son propre hasard, indépendant des autres. */
export function graineDe(base: number, nom: string): number {
  let h = base >>> 0;
  for (let i = 0; i < nom.length; i += 1) h = Math.imul(h ^ nom.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/* ------------------------------ Calendrier ------------------------------ */

export const MINUTE = 60_000;
export const HEURE = 3_600_000;
export const JOUR = 86_400_000;
const FUSEAU = 'Europe/Paris';

/** Un « jour » est une chaîne `AAAA-MM-JJ` du calendrier de Paris. */
export type Jour = string;

const formatJour = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatDecalage = new Intl.DateTimeFormat('en-US', { timeZone: FUSEAU, timeZoneName: 'longOffset', hour: '2-digit' });

/** Le jour de Paris où tombe cet instant. */
export function jourDe(ms: number): Jour {
  return formatJour.format(new Date(ms));
}

/** Décalage de Paris par rapport à UTC, en millisecondes, à cet instant (3 600 000 l'hiver, 7 200 000 l'été). */
function decalageParis(ms: number): number {
  const texte = formatDecalage.formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+01:00';
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(texte);
  if (!m) return HEURE;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * HEURE + Number(m[3]) * MINUTE);
}

/** L'instant (ms) où il est `hhmm` à Paris le `jour`. Juste aux changements d'heure. */
export function instantParis(jour: Jour, hhmm = '00:00'): number {
  const [a, m, j] = jour.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const brut = Date.UTC(a, m - 1, j, h, mi);
  const premier = brut - decalageParis(brut);
  return brut - decalageParis(premier);
}

/** Le jour + `n` jours calendaires (n négatif pour reculer). Indépendant des changements d'heure. */
export function ajouterJours(jour: Jour, n: number): Jour {
  const [a, m, j] = jour.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + n, 12));
  return d.toISOString().slice(0, 10);
}

/** Jours entiers entre deux jours (`b - a`). */
export function ecartJours(a: Jour, b: Jour): number {
  const t = (x: Jour) => {
    const [an, m, j] = x.split('-').map(Number);
    return Date.UTC(an, m - 1, j);
  };
  return Math.round((t(b) - t(a)) / JOUR);
}

/** 1 = lundi … 7 = dimanche. */
export function jourSemaine(jour: Jour): number {
  const [a, m, j] = jour.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j, 12)).getUTCDay();
  return d === 0 ? 7 : d;
}

export const estOuvre = (jour: Jour): boolean => jourSemaine(jour) <= 5;

/** Le lundi de la semaine du jour. */
export function lundiDe(jour: Jour): Jour {
  return ajouterJours(jour, 1 - jourSemaine(jour));
}

/** Le jour ouvré le plus proche avant (ou égal à) ce jour. */
export function dernierOuvre(jour: Jour): Jour {
  let j = jour;
  while (!estOuvre(j)) j = ajouterJours(j, -1);
  return j;
}

/** Le 1er du mois du jour. */
export const debutDeMois = (jour: Jour): Jour => `${jour.slice(0, 7)}-01`;

/** L'ISO d'un instant (ms). */
export const iso = (ms: number): string => new Date(ms).toISOString();

/** Heure locale de Paris `HH:MM` d'un instant. */
export function heureDe(ms: number): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
}

/**
 * Le jour de référence des maquettes : vendredi 30 octobre 2026, 10 h 15 à Paris.
 * (Les maquettes le montrent un vendredi ; 2026-10-30 en est bien un.)
 */
export const MAINTENANT_REFERENCE: number = instantParis('2026-10-30', '10:15');

/** La graine de référence : celle que les sessions et les captures partagent. */
export const GRAINE_REFERENCE = 20261030;

/* ------------------------------- Argent ------------------------------- */

/** Euros (nombre à virgule) → centimes entiers. Les montants sont TOUJOURS stockés en centimes. */
export const centimes = (euros: number): number => Math.round(euros * 100);

/** TVA d'un montant HT en centimes, arrondie au centime (demi supérieur), taux en pourcentage. */
export const tva = (htCents: number, taux: number): number => Math.round((htCents * taux) / 100);

/** Arrondit un montant en centimes à une « belle » valeur (au multiple de `pas` centimes). */
export const arrondir = (cents: number, pas = 500): number => Math.max(pas, Math.round(cents / pas) * pas);

/* ------------------------------- Textes -------------------------------- */

/** Minuscules sans accents, tirets entre les mots : `Élodie Müller` → `elodie-muller`. */
export function slug(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** « de » devant un nom, avec l'élision : `de Garage Vallon`, `d’Épicerie du Pont`. */
export function deElision(nom: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûüœ]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
}

/** `Camille Roux` → `CR`. */
export function initiales(nom: string): string {
  return nom
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0].toUpperCase())
    .join('');
}

/** Un identifiant lisible et stable : `t-0042`. */
export const identifiant = (prefixe: string, n: number, largeur = 4): string => `${prefixe}-${String(n).padStart(largeur, '0')}`;

/* ---------------------- Coordonnées sûres par construction ---------------------- */

/**
 * Tout courriel de ces jeux est en `.exemple.test` : le domaine `.test` est
 * réservé (RFC 2606), il ne mène jamais à une vraie boîte. Même convention que
 * les scripts de peuplement du dépôt (`@exemple.test`).
 */
export const DOMAINE_COURRIEL = 'exemple.test';
export const courriel = (local: string, domaine = DOMAINE_COURRIEL): string => `${slug(local).replace(/-/g, '.')}@${domaine}`;

/**
 * Numéros de téléphone issus des plages que l'ARCEP réserve à la fiction :
 * `01 99 00 xx xx` (fixe) et `06 39 98 xx xx` (mobile). Ils ne sont attribués à
 * personne.
 */
export function telephone(h: Hasard, mobile = false): string {
  const fin = String(h.entier(0, 9999)).padStart(4, '0');
  const bloc = mobile ? '06 39 98' : '01 99 00';
  return `${bloc} ${fin.slice(0, 2)} ${fin.slice(2)}`;
}

/** Vrai si le texte est un numéro des plages réservées à la fiction. */
export const estTelephoneFictif = (t: string): boolean => /^(01 99 00|06 39 98) \d{2} \d{2}$/.test(t);

/** Vrai si le texte est un courriel en `.test` (aucune boîte réelle possible). */
export const estCourrielFictif = (c: string): boolean => /^[a-z0-9.+_-]+@([a-z0-9-]+\.)*exemple\.test$/.test(c);
