/**
 * MR07 · COMMANDES — logique pure (parcours en 4 étapes, urgence, tri, palier, suivi).
 *
 * Règles de la fiche MR07, rubrique 6. Deux sources de statut coexistent : celui du module
 * actuel (`new`, `confirmed`, `preparing`, `shipped`, `delivered`, `cancelled`) et celui des
 * jeux fictifs (`À préparer`, `En préparation`, `Prête`, `Remise`). Les deux se ramènent aux
 * mêmes 4 étapes de la bande ; « Payée » n'existe que dans le suivi détaillé.
 */

import { ajouterJours, debutDeMois, ecartJours, jourDeSemaine, jourEtMois, JOURS_COURTS, type Jour, type Langue } from './commun';

export type EtapeBande = 'recues' | 'preparation' | 'expediees' | 'livrees';
export const ETAPES_BANDE: readonly EtapeBande[] = ['recues', 'preparation', 'expediees', 'livrees'];

export type ModeDeRemise = 'Retrait' | 'Colis' | 'Tournée';

export interface CommandeEntree {
  id: string;
  numero: string;
  /** Statut du module actuel (`new`…) OU de la fiche (`À préparer`…). */
  statut: string;
  remise?: ModeDeRemise;
  creeLe: Jour;
  /** Instant ISO de la création, pour « +1 il y a 4 min ». */
  creeAt?: string;
  /** Échéance : jour (et heure facultative « 16:00 »). */
  echeanceLe?: Jour | null;
  echeanceHeure?: string | null;
  livreeLe?: Jour | null;
  urgente?: boolean;
  /** Montant HT en centimes. */
  montantHtCents?: number;
  paiementEnLigne?: boolean;
  paye?: boolean;
  annulee?: boolean;
}

/** Ramène un statut (module actuel ou fiche) à une étape de la bande ; `null` pour une commande annulée. */
export function etapeDeLaBande(c: Pick<CommandeEntree, 'statut' | 'annulee'>): EtapeBande | null {
  if (c.annulee) return null;
  switch (c.statut) {
    case 'new': case 'confirmed': case 'À préparer': case 'Reçue': case 'Payée': return 'recues';
    case 'preparing': case 'En préparation': return 'preparation';
    // Un retrait au comptoir (« Prête au retrait ») est compté avec les expédiées.
    case 'shipped': case 'Prête': case 'Expédiée': case 'Prête au retrait': return 'expediees';
    case 'delivered': case 'Remise': case 'Livrée': return 'livrees';
    case 'cancelled': return null;
    default: return 'recues';
  }
}

/** Statut du module actuel : transitions fermées, vers l'avant, plus l'annulation. */
export const STATUTS_SUIVANTS: Readonly<Record<string, readonly string[]>> = {
  new: ['confirmed', 'preparing', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** Étapes d'une commande non livrée : « en cours ». */
export const estEnCours = (c: CommandeEntree): boolean => {
  const e = etapeDeLaBande(c);
  return e !== null && e !== 'livrees';
};

/**
 * Urgente : marquée à la main, ou automatiquement si l'échéance est dépassée sans expédition.
 * Une commande livrée ou annulée n'est jamais urgente.
 */
export function estUrgente(c: CommandeEntree, aujourdhui: Jour): boolean {
  if (!estEnCours(c)) return false;
  if (c.urgente) return true;
  const e = etapeDeLaBande(c);
  return !!c.echeanceLe && c.echeanceLe < aujourdhui && (e === 'recues' || e === 'preparation');
}

/** « À expédier aujourd'hui » : non livrées, échéance aujourd'hui, mode différent du retrait. */
export const aExpedierAujourdhui = (c: CommandeEntree, aujourdhui: Jour): boolean => estEnCours(c) && c.echeanceLe === aujourdhui && c.remise !== 'Retrait';

export interface Compteurs {
  recues: number;
  enPreparation: number;
  expediees: number;
  /** Somme des trois = « 11 en cours ». */
  enCours: number;
  urgentes: number;
  aExpedier: number;
  livreesCeMois: number;
  /** Écart avec le même nombre de jours du mois précédent. */
  evolutionLivrees: number;
  /** Commandes reçues dans les 15 dernières minutes, avec le délai de la plus récente (minutes). */
  recentes: { nombre: number; ilYaMin: number | null };
}

export const FENETRE_RECENTES_MIN = 15;

export function compter(commandes: readonly CommandeEntree[], aujourdhui: Jour, maintenantMs: number): Compteurs {
  const nb = (e: EtapeBande) => commandes.filter((c) => etapeDeLaBande(c) === e).length;
  const jourDuMois = Number(aujourdhui.slice(8, 10));
  const debut = debutDeMois(aujourdhui);
  const debutPrec = moisPrecedent(debut);
  const finPrec = ajouterJours(debutPrec, jourDuMois - 1);
  const livrees = commandes.filter((c) => etapeDeLaBande(c) === 'livrees' && c.livreeLe);
  const ceMois = livrees.filter((c) => (c.livreeLe as Jour) >= debut && (c.livreeLe as Jour) <= aujourdhui).length;
  const precedent = livrees.filter((c) => (c.livreeLe as Jour) >= debutPrec && (c.livreeLe as Jour) <= finPrec).length;
  const recents = commandes
    .filter((c) => c.creeAt && etapeDeLaBande(c) === 'recues')
    .map((c) => (maintenantMs - Date.parse(c.creeAt as string)) / 60000)
    .filter((m) => m >= 0 && m <= FENETRE_RECENTES_MIN)
    .sort((a, b) => a - b);
  return {
    recues: nb('recues'),
    enPreparation: nb('preparation'),
    expediees: nb('expediees'),
    enCours: nb('recues') + nb('preparation') + nb('expediees'),
    urgentes: commandes.filter((c) => estUrgente(c, aujourdhui)).length,
    aExpedier: commandes.filter((c) => aExpedierAujourdhui(c, aujourdhui)).length,
    livreesCeMois: ceMois,
    evolutionLivrees: ceMois - precedent,
    recentes: { nombre: recents.length, ilYaMin: recents.length ? Math.floor(recents[0]) : null },
  };
}

/** Premier jour du mois précédent. */
function moisPrecedent(debutDeMoisCourant: Jour): Jour {
  return ajouterJours(debutDeMoisCourant, -1).slice(0, 7) + '-01';
}

/**
 * Tri de la liste « Commandes en cours » : échéance croissante, urgentes en tête à échéance
 * égale ; les expédiées (« en route ») en fin.
 */
export function trierEnCours<T extends CommandeEntree>(commandes: readonly T[], aujourdhui: Jour): T[] {
  const sansEcheance = '9999-12-31';
  return commandes
    .filter(estEnCours)
    .sort((a, b) => {
      const ea = etapeDeLaBande(a) === 'expediees' ? 1 : 0;
      const eb = etapeDeLaBande(b) === 'expediees' ? 1 : 0;
      if (ea !== eb) return ea - eb;
      return (a.echeanceLe ?? sansEcheance).localeCompare(b.echeanceLe ?? sansEcheance) || Number(estUrgente(b, aujourdhui)) - Number(estUrgente(a, aujourdhui)) || a.numero.localeCompare(b.numero);
    });
}

export type Echeance = { type: 'aujourdhui'; heure: string | null } | { type: 'demain' } | { type: 'jour'; libelle: string } | { type: 'date'; libelle: string } | { type: 'aucune' };

/** « Auj. 16:00 », « Demain », jour abrégé dans les 6 jours, sinon « 4 nov. » ; orange si aujourd'hui. */
export function echeanceAffichee(c: Pick<CommandeEntree, 'echeanceLe' | 'echeanceHeure'>, aujourdhui: Jour, langue: Langue = 'fr'): { echeance: Echeance; orange: boolean } {
  if (!c.echeanceLe) return { echeance: { type: 'aucune' }, orange: false };
  const d = ecartJours(aujourdhui, c.echeanceLe);
  if (d === 0) return { echeance: { type: 'aujourdhui', heure: c.echeanceHeure ?? null }, orange: true };
  if (d === 1) return { echeance: { type: 'demain' }, orange: false };
  if (d > 1 && d <= 6) return { echeance: { type: 'jour', libelle: JOURS_COURTS[langue][jourDeSemaine(c.echeanceLe)] }, orange: false };
  return { echeance: { type: 'date', libelle: jourEtMois(c.echeanceLe, langue) }, orange: d < 0 };
}

/** Jetons de la bande : 3 au plus par étape, les plus urgents d'abord, « + n autre(s) » au-delà. */
export function jetonsDeLEtape<T extends CommandeEntree>(commandes: readonly T[], etape: EtapeBande, aujourdhui: Jour, max = 3): { visibles: T[]; autres: number } {
  const dans = commandes
    .filter((c) => etapeDeLaBande(c) === etape)
    .sort((a, b) => Number(estUrgente(b, aujourdhui)) - Number(estUrgente(a, aujourdhui)) || (a.echeanceLe ?? '9999').localeCompare(b.echeanceLe ?? '9999'));
  return { visibles: dans.slice(0, max), autres: Math.max(0, dans.length - max) };
}

/**
 * Palier des livraisons (Proposition) : prochain multiple de 10 au-dessus du record mensuel.
 * « Plus que n pour un nouveau record ». Jamais de message négatif si le palier n'est pas
 * atteint en fin de mois, et aucune célébration au passage du palier.
 */
export function palierDeLivraisons(livreesCeMois: number, recordMensuel: number, pas = 10): { palier: number; restant: number; atteint: boolean } {
  const palier = (Math.floor(Math.max(0, recordMensuel) / pas) + 1) * pas;
  return { palier, restant: Math.max(0, palier - livreesCeMois), atteint: livreesCeMois >= palier };
}

/* -------- Suivi pas à pas, retours en arrière -------- */

export type EtapeSuivi = 'recue' | 'payee' | 'preparation' | 'expediee' | 'prete-au-retrait' | 'livree';

/** Suivi détaillé : « Payée » seulement si le paiement est en ligne ; « Prête au retrait » remplace « Expédiée » pour un retrait. */
export function suiviDeLaCommande(c: CommandeEntree): { etape: EtapeSuivi; fait: boolean }[] {
  const courante = etapeDeLaBande(c);
  const rang: Record<EtapeBande, number> = { recues: 0, preparation: 1, expediees: 2, livrees: 3 };
  const r = courante ? rang[courante] : -1;
  const liste: { etape: EtapeSuivi; fait: boolean }[] = [{ etape: 'recue', fait: r >= 0 }];
  if (c.paiementEnLigne) liste.push({ etape: 'payee', fait: !!c.paye });
  liste.push({ etape: 'preparation', fait: r >= 1 });
  liste.push({ etape: c.remise === 'Retrait' ? 'prete-au-retrait' : 'expediee', fait: r >= 2 });
  liste.push({ etape: 'livree', fait: r >= 3 });
  return liste;
}

/** Retour en arrière d'une seule étape, avec confirmation ; une commande livrée ne revient jamais (on crée un retour). */
export function retourPossible(c: CommandeEntree): { possible: boolean; versEtape: EtapeBande | null; confirmation: boolean } {
  const e = etapeDeLaBande(c);
  if (e === null || e === 'livrees' || e === 'recues') return { possible: false, versEtape: null, confirmation: false };
  return { possible: true, versEtape: e === 'preparation' ? 'recues' : 'preparation', confirmation: true };
}

/** Montant total HT d'un ensemble de lignes (HT partout si c'est la règle du dépôt). */
export const totalHtCents = (lignes: readonly { quantite: number; prixHtCents: number }[]): number => lignes.reduce((s, l) => s + l.quantite * l.prixHtCents, 0);
