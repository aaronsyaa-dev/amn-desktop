import { arrondiCentime, estDateIso, joursEntre, type Centimes } from '../_commun/nombres';

/**
 * PÉNALITÉS DE RETARD — ce qu'une facture payée en retard rapporte de droit.
 *
 * ENTRE PROFESSIONNELS (art. L441-10 du Code de commerce) :
 *   · les pénalités courent dès le lendemain de l'échéance, sans rappel ;
 *   · taux : celui du contrat (conditions générales, facture) ; à défaut, le
 *     taux de la BCE à sa plus récente opération de refinancement, majoré de
 *     10 points (celui en vigueur au 1er janvier ou au 1er juillet du semestre) ;
 *   · plancher : jamais moins de 3 fois le taux d'intérêt légal ;
 *   · plus une indemnité forfaitaire pour frais de recouvrement de 40 € par
 *     facture payée en retard (art. D441-5).
 *
 * ENVERS UN PARTICULIER (art. 1231-6 du Code civil) : intérêts au taux légal,
 * qui ne courent qu'à compter d'une MISE EN DEMEURE ; pas d'indemnité de 40 €.
 * Sans mise en demeure déjà envoyée, rien n'a encore couru : la lettre que
 * produit le module en est une.
 *
 *   intérêts = montant TTC × taux annuel × jours / 365, arrondis au centime.
 *
 * Le taux BCE et le taux légal changent chaque semestre : ce sont des
 * paramètres saisis, jamais des constantes. Seule l'indemnité de 40 € est fixe.
 */

/** Art. D441-5 du Code de commerce : 40 € par facture payée en retard, entre professionnels. */
export const INDEMNITE_FORFAITAIRE: Centimes = 4_000;
/** Points ajoutés au taux BCE à défaut de taux contractuel (art. L441-10). */
export const MAJORATION_BCE = 10;
/** Le taux des pénalités ne peut être inférieur à 3 fois le taux d'intérêt légal (art. L441-10). */
export const MULTIPLE_PLANCHER = 3;

export type TypeDebiteur = 'pro' | 'particulier';

export interface Debiteur {
  id: string;
  nom: string;
  type: TypeDebiteur;
  /** Particulier : date d'une mise en demeure déjà envoyée, s'il y en a une. */
  dateMiseEnDemeure?: string;
}

export interface FactureImpayee {
  id: string;
  debiteur: string;
  numero: string;
  montantTTC: Centimes;
  echeance: string;
}

export interface Parametres {
  dateCalcul: string;
  /** % par an, tel qu'écrit dans le contrat. Absent : taux BCE + 10 points. */
  tauxContractuel?: number;
  /** % par an : taux de refinancement de la BCE retenu pour le semestre. */
  tauxBce: number;
  /** % par an : taux de l'intérêt légal du semestre (créancier professionnel). */
  tauxLegal: number;
}

export type BaseTaux = 'contractuel' | 'bce' | 'plancher' | 'legal';
export type ErreurParametres = 'dateCalcul' | 'tauxContractuel' | 'tauxBce' | 'tauxLegal';

export interface LignePenalite {
  facture: FactureImpayee;
  /** Jours depuis l'échéance (0 si elle n'est pas passée). */
  joursRetard: number;
  /** Date d'où courent les intérêts, ou `null` s'ils n'ont pas commencé. */
  depart: string | null;
  joursInterets: number;
  interets: Centimes;
  indemnite: Centimes;
}

export interface ResultatPenalites {
  taux: number;
  base: BaseTaux;
  lignes: LignePenalite[];
  /** Les factures échues seulement. */
  principal: Centimes;
  interets: Centimes;
  indemnites: Centimes;
  total: Centimes;
}

export function verifierParametres(p: Parametres): ErreurParametres[] {
  const fautes: ErreurParametres[] = [];
  if (!estDateIso(p.dateCalcul)) fautes.push('dateCalcul');
  if (p.tauxContractuel !== undefined && !(Number.isFinite(p.tauxContractuel) && p.tauxContractuel >= 0 && p.tauxContractuel <= 100)) fautes.push('tauxContractuel');
  if (!(Number.isFinite(p.tauxBce) && p.tauxBce >= 0 && p.tauxBce <= 50)) fautes.push('tauxBce');
  if (!(Number.isFinite(p.tauxLegal) && p.tauxLegal >= 0 && p.tauxLegal <= 50)) fautes.push('tauxLegal');
  return fautes;
}

export function factureValide(f: FactureImpayee): boolean {
  return Number.isInteger(f.montantTTC) && f.montantTTC > 0 && estDateIso(f.echeance);
}

/** Le taux annuel appliqué, et d'où il vient. */
export function tauxApplique(type: TypeDebiteur, p: Parametres): { taux: number; base: BaseTaux } {
  if (type === 'particulier') return { taux: p.tauxLegal, base: 'legal' };
  const plancher = Math.round(MULTIPLE_PLANCHER * p.tauxLegal * 100) / 100;
  const candidat = p.tauxContractuel ?? Math.round((p.tauxBce + MAJORATION_BCE) * 100) / 100;
  if (candidat < plancher) return { taux: plancher, base: 'plancher' };
  return { taux: candidat, base: p.tauxContractuel === undefined ? 'bce' : 'contractuel' };
}

export function interets(montant: Centimes, taux: number, jours: number): Centimes {
  return jours > 0 ? arrondiCentime((montant * taux * jours) / (100 * 365)) : 0;
}

/** Pénalités des factures valides de `debiteur` ; `null` si les paramètres sont fautifs. */
export function calculerPenalites(debiteur: Debiteur, factures: readonly FactureImpayee[], p: Parametres): ResultatPenalites | null {
  if (verifierParametres(p).length > 0) return null;
  if (debiteur.dateMiseEnDemeure !== undefined && !estDateIso(debiteur.dateMiseEnDemeure)) return null;
  const { taux, base } = tauxApplique(debiteur.type, p);

  const lignes = factures
    .filter((f) => f.debiteur === debiteur.id && factureValide(f))
    .map((f): LignePenalite => {
      const joursRetard = Math.max(0, joursEntre(f.echeance, p.dateCalcul));
      let depart: string | null = null;
      if (joursRetard > 0) {
        if (debiteur.type === 'pro') depart = f.echeance;
        else if (debiteur.dateMiseEnDemeure) depart = debiteur.dateMiseEnDemeure > f.echeance ? debiteur.dateMiseEnDemeure : f.echeance;
      }
      const joursInterets = depart ? Math.max(0, joursEntre(depart, p.dateCalcul)) : 0;
      return {
        facture: f,
        joursRetard,
        depart,
        joursInterets,
        interets: interets(f.montantTTC, taux, joursInterets),
        indemnite: debiteur.type === 'pro' && joursRetard > 0 ? INDEMNITE_FORFAITAIRE : 0,
      };
    });

  const echues = lignes.filter((l) => l.joursRetard > 0);
  const principal = echues.reduce((s, l) => s + l.facture.montantTTC, 0);
  const totalInterets = echues.reduce((s, l) => s + l.interets, 0);
  const indemnites = echues.reduce((s, l) => s + l.indemnite, 0);
  return { taux, base, lignes, principal, interets: totalInterets, indemnites, total: principal + totalInterets + indemnites };
}
