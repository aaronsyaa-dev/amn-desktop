import { ajouterMois, estDateIso, joursEntre, type Centimes } from '../_commun/nombres';

/**
 * PAIEMENT EN PLUSIEURS FOIS — découper une facture en échéances datées, puis suivre ce qui est payé.
 *
 *   reste à étaler = montant TTC − acompte
 *   échéances 2 à N = reste ÷ N, arrondi au centime INFÉRIEUR
 *   échéance 1      = le reste exact moins les autres : elle absorbe les centimes
 *                     (au plus N − 1 centimes de plus que les suivantes).
 *
 * Pourquoi la première : le client lit « puis N − 1 échéances de X € », un
 * montant rond et répété ; et l'écart est encaissé tout de suite plutôt qu'à
 * la fin. La somme des échéances vaut toujours exactement le reste.
 *
 * Les dates suivent la première, mois après mois, au même jour du mois. Un
 * jour qui n'existe pas devient le dernier du mois (31 → 30 septembre → 31
 * octobre) : chaque date est recalculée depuis la première, jamais depuis la
 * précédente, pour ne pas glisser au 28 pour toujours après février.
 *
 * Une échéance non payée est « en retard » le lendemain de sa date, « à venir »
 * jusqu'au jour même.
 */

export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 12;

export interface Echeancier {
  id: string;
  client: string;
  /** Référence de la facture : « F-2026-041 ». */
  reference: string;
  objet: string;
  montantTTC: Centimes;
  acompte: Centimes;
  nombre: number;
  premiereDate: string;
  /** Rangs payés, à partir de 0. */
  payees: readonly number[];
}

export type EtatEcheance = 'payee' | 'aVenir' | 'enRetard';

export interface Echeance {
  rang: number;
  date: string;
  montant: Centimes;
  etat: EtatEcheance;
  /** Jours de retard (> 0 seulement si en retard). */
  retard: number;
}

export type ErreurEcheancier = 'montant' | 'acompte' | 'nombre' | 'date' | 'tropPetit';

export function verifier(e: Pick<Echeancier, 'montantTTC' | 'acompte' | 'nombre' | 'premiereDate'>): ErreurEcheancier[] {
  const fautes: ErreurEcheancier[] = [];
  if (!Number.isInteger(e.montantTTC) || e.montantTTC <= 0) fautes.push('montant');
  if (!Number.isInteger(e.acompte) || e.acompte < 0 || (fautes.length === 0 && e.acompte >= e.montantTTC)) fautes.push('acompte');
  if (!Number.isInteger(e.nombre) || e.nombre < NOMBRE_MIN || e.nombre > NOMBRE_MAX) fautes.push('nombre');
  if (!estDateIso(e.premiereDate)) fautes.push('date');
  if (fautes.length === 0 && e.montantTTC - e.acompte < e.nombre) fautes.push('tropPetit');
  return fautes;
}

/** Les montants : la première absorbe les centimes, les suivantes sont égales. */
export function montants(reste: Centimes, nombre: number): Centimes[] {
  const base = Math.trunc(reste / nombre);
  return [reste - base * (nombre - 1), ...Array.from({ length: nombre - 1 }, () => base)];
}

export function echeances(e: Echeancier, aujourdhui: string): Echeance[] | null {
  if (verifier(e).length > 0) return null;
  return montants(e.montantTTC - e.acompte, e.nombre).map((montant, i) => {
    const date = ajouterMois(e.premiereDate, i);
    const ecart = joursEntre(date, aujourdhui);
    const etat: EtatEcheance = e.payees.includes(i) ? 'payee' : ecart > 0 ? 'enRetard' : 'aVenir';
    return { rang: i + 1, date, montant, etat, retard: etat === 'enRetard' ? ecart : 0 };
  });
}

export interface Synthese {
  encaisse: Centimes;
  resteDu: Centimes;
  enRetard: Centimes;
  nbEnRetard: number;
  prochaine?: Echeance;
  solde: boolean;
}

/** `encaisse` compte l'acompte et les échéances payées ; la somme encaissé + reste dû vaut le TTC. */
export function synthese(e: Echeancier, aujourdhui: string): Synthese | null {
  const liste = echeances(e, aujourdhui);
  if (!liste) return null;
  const payees = liste.filter((x) => x.etat === 'payee');
  const retard = liste.filter((x) => x.etat === 'enRetard');
  const encaisse = e.acompte + payees.reduce((s, x) => s + x.montant, 0);
  return {
    encaisse,
    resteDu: e.montantTTC - encaisse,
    enRetard: retard.reduce((s, x) => s + x.montant, 0),
    nbEnRetard: retard.length,
    prochaine: liste.find((x) => x.etat !== 'payee'),
    solde: payees.length === liste.length,
  };
}

/** Marque le rang `i` payé, ou le dé-marque s'il l'était. */
export function basculerPayee(e: Echeancier, i: number): Echeancier {
  const payees = e.payees.includes(i) ? e.payees.filter((x) => x !== i) : [...e.payees, i].sort((a, b) => a - b);
  return { ...e, payees };
}

/** Ne garde que les rangs qui existent encore après un changement du nombre d'échéances. */
export function ajusterPayees(e: Echeancier): Echeancier {
  return { ...e, payees: e.payees.filter((i) => Number.isInteger(i) && i >= 0 && i < e.nombre) };
}
