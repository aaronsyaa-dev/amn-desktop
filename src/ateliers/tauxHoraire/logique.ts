import { arrondiCentime, type Centimes } from '../_commun/nombres';

/**
 * TAUX HORAIRE DE REVIENT — le prix de l'heure en dessous duquel on travaille à perte.
 *
 * Le chemin, sans formule cachée :
 *
 *   jours travaillés  = jours par semaine × (52 − semaines de congés) − fériés chômés − autres jours off
 *   heures facturables = jours travaillés × heures par jour × part facturable
 *   chiffre d'affaires HT nécessaire :
 *     au réel  : revenu × (1 + taux de cotisations) + charges fixes
 *     en micro : (revenu + charges fixes) / (1 − taux de cotisations)   (cotisations prises sur le CA)
 *   puis + marge de sécurité, et taux horaire = CA / heures facturables, arrondi AU CENTIME SUPÉRIEUR
 *   (un minimum ne s'arrondit pas vers le bas).
 *
 * Les taux de cotisations ne sont pas codés en dur : ils changent, et dépendent
 * du statut. La personne reprend le sien sur son dernier avis URSSAF.
 */
export type Regime = 'reel' | 'micro';

export interface EntreesTaux {
  regime: Regime;
  /** Ce qu'on veut se verser sur l'année, avant impôt sur le revenu. */
  revenuAnnuel: Centimes;
  /** Loyer, assurances, véhicule, logiciels, comptable… sur l'année. */
  chargesFixes: Centimes;
  /** En %, du revenu au réel, du chiffre d'affaires en micro. */
  tauxCotisations: number;
  joursParSemaine: number;
  semainesConges: number;
  feriesChomes: number;
  /** Maladie, formation, salons : jours sans production prévus. */
  autresJoursOff: number;
  heuresParJour: number;
  /** En % : le reste part en devis, déplacements, administratif. */
  partFacturable: number;
  /** En % ajouté au chiffre d'affaires nécessaire. */
  margeSecurite: number;
  /** Optionnel : le tarif horaire HT pratiqué aujourd'hui, pour comparer. */
  tarifActuel?: Centimes;
}

export interface ResultatTaux {
  joursTravailles: number;
  heuresFacturables: number;
  cotisations: Centimes;
  caNecessaire: Centimes;
  tauxHoraire: Centimes;
  prixJournee: Centimes;
  heuresFacturablesParSemaine: number;
  /** Présent si `tarifActuel` : positif = il manque tant par heure. */
  manqueParHeure?: Centimes;
  manqueSurAnnee?: Centimes;
}

export type ErreurTaux = 'revenu' | 'charges' | 'cotisations' | 'jours' | 'heures' | 'partFacturable' | 'marge' | 'aucuneHeure';

export function verifier(e: EntreesTaux): ErreurTaux[] {
  const fautes: ErreurTaux[] = [];
  if (!Number.isFinite(e.revenuAnnuel) || e.revenuAnnuel < 0) fautes.push('revenu');
  if (!Number.isFinite(e.chargesFixes) || e.chargesFixes < 0) fautes.push('charges');
  if (!Number.isFinite(e.tauxCotisations) || e.tauxCotisations < 0 || e.tauxCotisations >= (e.regime === 'micro' ? 100 : 200)) fautes.push('cotisations');
  if (!(e.joursParSemaine > 0 && e.joursParSemaine <= 7) || !(e.semainesConges >= 0 && e.semainesConges < 52) || !(e.feriesChomes >= 0) || !(e.autresJoursOff >= 0))
    fautes.push('jours');
  if (!(e.heuresParJour > 0 && e.heuresParJour <= 24)) fautes.push('heures');
  if (!(e.partFacturable > 0 && e.partFacturable <= 100)) fautes.push('partFacturable');
  if (!(e.margeSecurite >= 0 && e.margeSecurite <= 100)) fautes.push('marge');
  if (fautes.length === 0 && joursTravailles(e) <= 0) fautes.push('aucuneHeure');
  return fautes;
}

export function joursTravailles(e: Pick<EntreesTaux, 'joursParSemaine' | 'semainesConges' | 'feriesChomes' | 'autresJoursOff'>): number {
  return Math.max(0, e.joursParSemaine * (52 - e.semainesConges) - e.feriesChomes - e.autresJoursOff);
}

export function calculerTaux(e: EntreesTaux): ResultatTaux | null {
  if (verifier(e).length > 0) return null;
  const jours = joursTravailles(e);
  const heures = (jours * e.heuresParJour * e.partFacturable) / 100;
  const t = e.tauxCotisations / 100;

  const caBrut = e.regime === 'reel' ? e.revenuAnnuel * (1 + t) + e.chargesFixes : (e.revenuAnnuel + e.chargesFixes) / (1 - t);
  const cotisations = e.regime === 'reel' ? arrondiCentime(e.revenuAnnuel * t) : arrondiCentime(caBrut * t);
  const caNecessaire = arrondiCentime(caBrut * (1 + e.margeSecurite / 100));
  const tauxHoraire = Math.ceil(caNecessaire / heures);
  const prixJournee = arrondiCentime((tauxHoraire * e.heuresParJour * e.partFacturable) / 100);

  const r: ResultatTaux = {
    joursTravailles: jours,
    heuresFacturables: Math.round(heures * 10) / 10,
    cotisations,
    caNecessaire,
    tauxHoraire,
    prixJournee,
    heuresFacturablesParSemaine: Math.round(((e.heuresParJour * e.joursParSemaine * e.partFacturable) / 100) * 10) / 10,
  };
  if (e.tarifActuel !== undefined && Number.isFinite(e.tarifActuel) && e.tarifActuel > 0) {
    r.manqueParHeure = tauxHoraire - e.tarifActuel;
    r.manqueSurAnnee = arrondiCentime(r.manqueParHeure * heures);
  }
  return r;
}
