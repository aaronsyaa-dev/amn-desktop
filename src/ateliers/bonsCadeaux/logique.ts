import { ajouterJours, ajouterMois, estDateIso, joursEntre, type Centimes } from '../_commun/nombres';

/**
 * BONS CADEAUX — émettre, encaisser en plusieurs fois, suivre les soldes.
 *
 * LE CODE. Huit caractères affichés `XXXX-XXXX`, pris dans un alphabet de 32
 * signes sans les ambigus (pas de 0, O, 1, I). Les sept premiers viennent du
 * numéro du bon, brassé par une bijection (multiplication par une constante
 * impaire modulo 32⁷) : deux numéros différents donnent toujours deux codes
 * différents, et des numéros qui se suivent ne donnent pas des codes qui se
 * suivent. Le huitième est une clé de contrôle Luhn modulo 32 : elle détecte
 * toute faute de frappe sur UN caractère, et la plupart des inversions de deux
 * caractères voisins. Aucun hasard : le même numéro donne le même code, ce qui
 * rend les tests reproductibles.
 *
 * LE SOLDE ne descend jamais sous zéro : un achat plus cher que le solde
 * utilise tout le solde, et le reste est à payer autrement.
 *
 * LA VALIDITÉ court de la date d'émission (incluse) jusqu'à la veille du même
 * quantième, `moisValidite` mois plus tard (inclus) — voir `finDeValidite`.
 */
export const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const N = ALPHABET.length; // 32
const TAILLE_CORPS = 7;
const MODULE_CORPS = BigInt(N) ** BigInt(TAILLE_CORPS); // 2^35
const MULTIPLICATEUR = 0x5deece66dn; // impair : bijection modulo 2^35
const DECALAGE = 0x2545f491n;

/** La validité proposée par défaut, en mois (réglable par bon). */
export const VALIDITE_PAR_DEFAUT = 12;

export interface Utilisation {
  date: string;
  montant: Centimes;
}

export interface Bon {
  code: string;
  beneficiaire: string;
  montant: Centimes;
  emission: string;
  /** Dernier jour de validité, inclus. */
  valableJusquau: string;
  utilisations: readonly Utilisation[];
}

export type EtatBon = 'actif' | 'epuise' | 'expire';

/** La clé Luhn modulo 32 d'une suite de caractères de l'alphabet. */
export function cleDeControle(corps: string): string {
  let facteur = 2;
  let somme = 0;
  for (let i = corps.length - 1; i >= 0; i -= 1) {
    const v = ALPHABET.indexOf(corps[i]);
    if (v < 0) throw new Error(`caractère hors alphabet : ${corps[i]}`);
    let a = facteur * v;
    a = Math.floor(a / N) + (a % N);
    somme += a;
    facteur = facteur === 2 ? 1 : 2;
  }
  return ALPHABET[(N - (somme % N)) % N];
}

/** Le code du bon numéro `numero` (entier ≥ 0), sous la forme `XXXX-XXXX`. */
export function genererCode(numero: number): string {
  if (!Number.isInteger(numero) || numero < 0) throw new Error('numéro de bon invalide');
  let x = (BigInt(numero) * MULTIPLICATEUR + DECALAGE) % MODULE_CORPS;
  let corps = '';
  for (let i = 0; i < TAILLE_CORPS; i += 1) {
    corps = ALPHABET[Number(x % BigInt(N))] + corps;
    x /= BigInt(N);
  }
  const brut = corps + cleDeControle(corps);
  return `${brut.slice(0, 4)}-${brut.slice(4)}`;
}

/** Ce que la personne a tapé, en majuscules, sans espaces ni tirets. */
export function normaliserCode(saisie: string): string {
  return saisie.toUpperCase().replace(/[\s-]/g, '');
}

export function codeValide(saisie: string): boolean {
  const c = normaliserCode(saisie);
  if (c.length !== TAILLE_CORPS + 1 || [...c].some((ch) => !ALPHABET.includes(ch))) return false;
  return cleDeControle(c.slice(0, TAILLE_CORPS)) === c[TAILLE_CORPS];
}

const formeAffichee = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;

export function solde(bon: Bon): Centimes {
  return bon.montant - bon.utilisations.reduce((s, u) => s + u.montant, 0);
}

export function etat(bon: Bon, aujourdhui: string): EtatBon {
  if (solde(bon) <= 0) return 'epuise';
  if (joursEntre(bon.valableJusquau, aujourdhui) > 0) return 'expire';
  return 'actif';
}

/* ── Émettre ──────────────────────────────────────────────────────────────── */

export interface DemandeEmission {
  beneficiaire: string;
  montant: Centimes;
  emission: string;
  moisValidite: number;
  /** Le numéro d'ordre du bon, qui fait son code. */
  numero: number;
}

/**
 * La veille du même quantième, `mois` mois plus tard. Si ce quantième n'existe
 * pas (un 31 vers février), le bon vaut jusqu'au dernier jour du mois.
 */
export function finDeValidite(emission: string, mois: number): string {
  const cible = ajouterMois(emission, mois);
  return cible.slice(8) < emission.slice(8) ? cible : ajouterJours(cible, -1);
}

export type ErreurEmission = 'beneficiaire' | 'montant' | 'date' | 'validite' | 'doublon';

export const MONTANT_MAX: Centimes = 1_000_000; // 10 000 € : garde-fou de saisie, pas une règle légale

export function emettre(d: DemandeEmission, existants: readonly Bon[]): { bon: Bon } | { erreurs: ErreurEmission[] } {
  const erreurs: ErreurEmission[] = [];
  if (!d.beneficiaire.trim() || d.beneficiaire.trim().length > 80) erreurs.push('beneficiaire');
  if (!Number.isInteger(d.montant) || d.montant <= 0 || d.montant > MONTANT_MAX) erreurs.push('montant');
  if (!estDateIso(d.emission)) erreurs.push('date');
  if (!Number.isInteger(d.moisValidite) || d.moisValidite < 1 || d.moisValidite > 60) erreurs.push('validite');
  if (erreurs.length) return { erreurs };
  const code = genererCode(d.numero);
  if (existants.some((b) => b.code === code)) return { erreurs: ['doublon'] };
  return {
    bon: {
      code,
      beneficiaire: d.beneficiaire.trim(),
      montant: d.montant,
      emission: d.emission,
      valableJusquau: finDeValidite(d.emission, d.moisValidite),
      utilisations: [],
    },
  };
}

/* ── Encaisser ────────────────────────────────────────────────────────────── */

export type ErreurEncaissement = 'codeInvalide' | 'inconnu' | 'expire' | 'epuise' | 'montant' | 'date';

export interface Encaissement {
  bon: Bon;
  /** Ce qui a été pris sur le bon. */
  utilise: Centimes;
  /** Ce que le client doit encore payer autrement. */
  resteAPayer: Centimes;
}

/** Encaisse `achat` sur le bon `saisie` à la date `date`. Ne modifie rien : rend le bon mis à jour. */
export function encaisser(bons: readonly Bon[], saisie: string, achat: Centimes, date: string): Encaissement | { erreur: ErreurEncaissement } {
  if (!codeValide(saisie)) return { erreur: 'codeInvalide' };
  const code = formeAffichee(normaliserCode(saisie));
  const bon = bons.find((b) => b.code === code);
  if (!bon) return { erreur: 'inconnu' };
  if (!Number.isInteger(achat) || achat <= 0) return { erreur: 'montant' };
  if (!estDateIso(date) || joursEntre(bon.emission, date) < 0) return { erreur: 'date' };
  const e = etat(bon, date);
  if (e === 'epuise') return { erreur: 'epuise' };
  if (e === 'expire') return { erreur: 'expire' };
  const utilise = Math.min(achat, solde(bon));
  return {
    bon: { ...bon, utilisations: [...bon.utilisations, { date, montant: utilise }] },
    utilise,
    resteAPayer: achat - utilise,
  };
}

/** Remplace dans la liste le bon de même code. */
export function remplacer(bons: readonly Bon[], bon: Bon): Bon[] {
  return bons.map((b) => (b.code === bon.code ? bon : b));
}

/* ── Totaux ───────────────────────────────────────────────────────────────── */

export interface Totaux {
  emis: Centimes;
  encaisse: Centimes;
  /** Solde des bons actifs : ce que l'entreprise doit encore en prestations. */
  encours: Centimes;
  /** Solde des bons expirés sans avoir été utilisés en entier. */
  expiresNonUtilises: Centimes;
  nombre: Record<EtatBon, number>;
}

export function totaux(bons: readonly Bon[], aujourdhui: string): Totaux {
  const t: Totaux = { emis: 0, encaisse: 0, encours: 0, expiresNonUtilises: 0, nombre: { actif: 0, epuise: 0, expire: 0 } };
  for (const b of bons) {
    const s = solde(b);
    const e = etat(b, aujourdhui);
    t.emis += b.montant;
    t.encaisse += b.montant - s;
    t.nombre[e] += 1;
    if (e === 'actif') t.encours += s;
    if (e === 'expire') t.expiresNonUtilises += s;
  }
  return t;
}
