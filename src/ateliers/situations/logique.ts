import { arrondiCentime, type Centimes } from '../_commun/nombres';

/**
 * SITUATIONS DE TRAVAUX — facturer un marché à l'avancement, lot par lot.
 *
 * Chaque situation dit l'avancement CUMULÉ de chaque lot (en %). Le montant
 * de la situation n est ce qui a été fait depuis la situation n − 1 :
 *
 *   cumul HT du lot       = montant HT du lot × avancement cumulé
 *   montant de la période = cumul HT − cumul HT de la situation précédente
 *   TVA                   = par taux (20 / 10 / 5,5), sur le HT de la période
 *   retenue de garantie   = taux × TTC de la période
 *   déduction d'acompte   = l'acompte TTC versé à la commande, remboursé au
 *                           prorata de l'avancement global du marché
 *   net à payer           = TTC − retenue − déduction d'acompte
 *
 * RETENUE DE GARANTIE. Loi n° 71-584 du 16 juillet 1971, article 1er : elle
 * ne peut excéder 5 % du montant du marché. Le module refuse donc un taux
 * au-dessus de 5 %. Elle se calcule ici sur le TTC, la pratique la plus
 * courante ; certains marchés la calculent sur le HT : à vérifier dans le
 * contrat (le module ne propose pas encore ce réglage). Appliquée à chaque
 * période, son cumul ne dépasse jamais 5 % du TTC du marché.
 *
 * ACOMPTE. Il a été facturé TTC à la commande ; chaque situation en reprend
 * la part correspondant à l'avancement (déduction cumulée = acompte ×
 * cumul HT / marché HT), si bien qu'à 100 % l'acompte est entièrement repris.
 *
 * Arrondis : au centime, ligne par ligne, puis par taux de TVA. À 100 %,
 * le cumul d'un lot vaut exactement son montant.
 */
export const TAUX_TVA = [20, 10, 5.5] as const;
export type TauxTva = (typeof TAUX_TVA)[number];

/** Plafond légal de la retenue de garantie (loi n° 71-584 du 16 juillet 1971, art. 1er). */
export const RETENUE_MAX = 5;

export interface Lot {
  id: string;
  libelle: string;
  montantHT: Centimes;
  tauxTva: TauxTva;
}

export interface Marche {
  lots: readonly Lot[];
  /** Acompte versé à la commande, TTC. 0 s'il n'y en a pas. */
  acompteTTC: Centimes;
  /** En %, au plus `RETENUE_MAX`. */
  tauxRetenue: number;
}

/** Avancement cumulé de chaque lot, en %, par identifiant de lot. */
export type Avancements = Readonly<Record<string, number>>;

export type ErreurMarche = 'lotMontant' | 'retenue' | 'acompte';
export type ErreurLot = 'illisible' | 'depasse' | 'recule';

export interface LigneLot {
  id: string;
  libelle: string;
  tauxTva: TauxTva;
  montantHT: Centimes;
  avancementPrecedent: number;
  avancement: number;
  precedentHT: Centimes;
  cumulHT: Centimes;
  periodeHT: Centimes;
}

export interface ParTaux {
  taux: TauxTva;
  ht: Centimes;
  tva: Centimes;
}

export interface ResultatSituation {
  numero: number;
  lignes: LigneLot[];
  parTaux: ParTaux[];
  marcheHT: Centimes;
  marcheTTC: Centimes;
  cumulHT: Centimes;
  /** Avancement global du marché, en % (pondéré par les montants). */
  avancementGlobal: number;
  periodeHT: Centimes;
  tva: Centimes;
  periodeTTC: Centimes;
  retenue: Centimes;
  deductionAcompte: Centimes;
  netAPayer: Centimes;
  /** Cumul des retenues depuis la première situation. */
  retenueCumulee: Centimes;
}

export function totalHT(lots: readonly Lot[]): Centimes {
  return lots.reduce((s, l) => s + l.montantHT, 0);
}

export function totalTTC(lots: readonly Lot[]): Centimes {
  return TAUX_TVA.reduce((s, taux) => {
    const ht = lots.filter((l) => l.tauxTva === taux).reduce((x, l) => x + l.montantHT, 0);
    return s + ht + arrondiCentime((ht * taux) / 100);
  }, 0);
}

export function verifierMarche(m: Marche): ErreurMarche[] {
  const fautes: ErreurMarche[] = [];
  if (m.lots.length === 0 || m.lots.some((l) => !Number.isInteger(l.montantHT) || l.montantHT <= 0 || !TAUX_TVA.includes(l.tauxTva))) fautes.push('lotMontant');
  if (!Number.isFinite(m.tauxRetenue) || m.tauxRetenue < 0 || m.tauxRetenue > RETENUE_MAX) fautes.push('retenue');
  if (!Number.isFinite(m.acompteTTC) || m.acompteTTC < 0 || (fautes.length === 0 && m.acompteTTC > totalTTC(m.lots))) fautes.push('acompte');
  return fautes;
}

/** Les fautes d'avancement, lot par lot : illisible, hors de 0–100 %, ou en recul sur la situation précédente. */
export function verifierAvancements(lots: readonly Lot[], precedent: Avancements, courant: Avancements): Record<string, ErreurLot> {
  const fautes: Record<string, ErreurLot> = {};
  for (const l of lots) {
    const a = courant[l.id] ?? 0;
    const p = precedent[l.id] ?? 0;
    if (!Number.isFinite(a)) fautes[l.id] = 'illisible';
    else if (a < 0 || a > 100) fautes[l.id] = 'depasse';
    else if (a < p) fautes[l.id] = 'recule';
  }
  return fautes;
}

const cumul = (l: Lot, avancement: number): Centimes => arrondiCentime((l.montantHT * avancement) / 100);

function cumulMarche(lots: readonly Lot[], av: Avancements): Centimes {
  return lots.reduce((s, l) => s + cumul(l, av[l.id] ?? 0), 0);
}

/**
 * La situation qui suit `historique` (les avancements des situations déjà
 * facturées, dans l'ordre). `null` si le marché ou un avancement est fautif.
 */
export function calculerSituation(m: Marche, historique: readonly Avancements[], courant: Avancements): ResultatSituation | null {
  if (verifierMarche(m).length > 0) return null;
  for (let i = 0; i < historique.length; i++) {
    if (Object.keys(verifierAvancements(m.lots, i === 0 ? {} : historique[i - 1], historique[i])).length > 0) return null;
  }
  const precedent = historique.length > 0 ? historique[historique.length - 1] : {};
  if (Object.keys(verifierAvancements(m.lots, precedent, courant)).length > 0) return null;

  const lignes: LigneLot[] = m.lots.map((l) => {
    const avancementPrecedent = precedent[l.id] ?? 0;
    const avancement = courant[l.id] ?? 0;
    const precedentHT = cumul(l, avancementPrecedent);
    const cumulHT = cumul(l, avancement);
    return { id: l.id, libelle: l.libelle, tauxTva: l.tauxTva, montantHT: l.montantHT, avancementPrecedent, avancement, precedentHT, cumulHT, periodeHT: cumulHT - precedentHT };
  });

  const parTaux: ParTaux[] = TAUX_TVA.map((taux) => {
    const ht = lignes.filter((l) => l.tauxTva === taux).reduce((s, l) => s + l.periodeHT, 0);
    return { taux, ht, tva: arrondiCentime((ht * taux) / 100) };
  }).filter((t) => m.lots.some((l) => l.tauxTva === t.taux));

  const marcheHT = totalHT(m.lots);
  const periodeHT = parTaux.reduce((s, t) => s + t.ht, 0);
  const tva = parTaux.reduce((s, t) => s + t.tva, 0);
  const periodeTTC = periodeHT + tva;
  const retenue = arrondiCentime((periodeTTC * m.tauxRetenue) / 100);

  const cumulHT = cumulMarche(m.lots, courant);
  const cumulPrecedentHT = cumulMarche(m.lots, precedent);
  const acompteRepris = (c: Centimes) => arrondiCentime((m.acompteTTC * c) / marcheHT);
  const deductionAcompte = acompteRepris(cumulHT) - acompteRepris(cumulPrecedentHT);

  // Les retenues des situations déjà facturées, recalculées de la même façon.
  let retenueCumulee = retenue;
  for (let i = 0; i < historique.length; i++) {
    const avant = i === 0 ? {} : historique[i - 1];
    const ttc = TAUX_TVA.reduce((s, taux) => {
      const ht = m.lots.filter((l) => l.tauxTva === taux).reduce((x, l) => x + cumul(l, historique[i][l.id] ?? 0) - cumul(l, avant[l.id] ?? 0), 0);
      return s + ht + arrondiCentime((ht * taux) / 100);
    }, 0);
    retenueCumulee += arrondiCentime((ttc * m.tauxRetenue) / 100);
  }

  return {
    numero: historique.length + 1,
    lignes,
    parTaux,
    marcheHT,
    marcheTTC: totalTTC(m.lots),
    cumulHT,
    avancementGlobal: Math.round((cumulHT / marcheHT) * 1000) / 10,
    periodeHT,
    tva,
    periodeTTC,
    retenue,
    deductionAcompte,
    netAPayer: periodeTTC - retenue - deductionAcompte,
    retenueCumulee,
  };
}
