import { evaluateProfile } from './calcEngine';
import { calcProfileById } from './calcProfiles';

/**
 * LE MODULE ÉVÉNEMENTS — LOGIQUE PURE
 * ═══════════════════════════════════
 *
 * Séparé de l'écran, comme le moteur de pages, parce que tout ce qui peut être
 * faux sans qu'on le voie est ici : un compte à rebours, un seuil de
 * rentabilité, un état déduit d'une date. `npm run check:evenements` éprouve
 * chaque règle, et chacune par mutation.
 *
 * ## Pourquoi un module, et pas un type de projet
 *
 * Un événement a quatre choses qu'un projet n'a pas, et c'est sur elles qu'on
 * décide :
 *
 *   - une **date butoir** qu'on ne déplace pas. Un projet glisse d'une
 *     semaine ; un concert, non.
 *   - une **jauge** — le nombre de places, qui plafonne tout le reste ;
 *   - un **prix de billet**, donc une recette qui dépend du remplissage ;
 *   - un **seuil de rentabilité** en nombre d'entrées, qu'on regarde trois
 *     semaines avant, quand il est encore temps d'agir.
 *
 * ## L'arithmétique n'est pas réécrite ici
 *
 * Le calcul de rentabilité est celui du profil `evenementiel-rentabilite` du
 * moteur de calcul, déjà écrit et déjà éprouvé (`check:calc` le vérifie sur
 * des cas calculés à la main, dont l'arrondi du seuil au nombre entier
 * d'entrées supérieur). Le refaire ici donnerait deux arithmétiques à tenir
 * d'accord, et l'histoire de ce dépôt dit assez ce qui arrive alors : elles
 * divergent, chacune reste cohérente avec elle-même, et personne ne voit
 * laquelle est fausse.
 */

/* --------------------------------- Domaine -------------------------------- */

/**
 * Ce qu'un événement porte.
 *
 * Les montants sont en CENTIMES entiers, comme partout ailleurs
 * (`src/lib/money.ts`). Les dates sont des jours `YYYY-MM-DD` : un événement
 * se situe à une date, pas à une heure UTC — l'heure de début est un texte
 * libre, parce qu'un festival ouvre « à partir de 18 h » et qu'aucune horloge
 * n'a besoin de le savoir.
 */
export interface EvenementData {
  nom: string;
  /** `YYYY-MM-DD`. Vide tant que la date n'est pas arrêtée. */
  date: string;
  /** Texte libre : « 18 h », « portes 19 h 30 ». Jamais analysé. */
  horaire?: string;
  lieu?: string;
  /** Le nombre de places. Plafonne la recette, donc tout le reste. */
  capacite: number;
  /** Entrées déjà vendues. C'est ce chiffre qu'on compare au seuil. */
  billetsVendus: number;
  prixBilletCents: number;
  commissionBilletterie: number;
  coutLieuCents: number;
  coutPrestatairesCents: number;
  coutCommunicationCents: number;
  coutParEntreeCents: number;
  /** Annulé une fois pour toutes. Voir `etatEvenement`. */
  annule?: boolean;
  notes?: string;
}

export interface Evenement extends EvenementData {
  id: string;
}

/**
 * L'état d'un événement — DÉDUIT, jamais saisi.
 *
 * Un statut qu'on choisit à la main se désynchronise du calendrier : un
 * événement passé reste « à venir » jusqu'à ce que quelqu'un pense à le
 * changer, et personne n'y pense. Les quatre états ci-dessous se lisent donc
 * de la date et d'un seul drapeau, `annule` — le seul qui soit une DÉCISION et
 * pas une conséquence.
 */
export type EtatEvenement = 'annule' | 'passe' | 'imminent' | 'a-venir' | 'sans-date';

/** En dessous de ce nombre de jours, l'événement est imminent. */
export const JOURS_IMMINENT = 14;

/** Le jour courant en `YYYY-MM-DD`, dans le fuseau de la machine. */
export function jourCourant(maintenant: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${p(maintenant.getMonth() + 1)}-${p(maintenant.getDate())}`;
}

/**
 * Combien de jours nous séparent de la date, en JOURS DE CALENDRIER.
 *
 * Pas en millisecondes divisées par 86 400 000 : cette division-là compte 0
 * jour entre 23 h 50 aujourd'hui et 00 h 10 demain, alors que c'est « demain »
 * pour tout le monde. On compare donc des dates à midi UTC, ce qui neutralise
 * aussi les changements d'heure — une nuit de 23 heures en mars ferait sinon
 * disparaître un jour de compte à rebours.
 *
 * Négatif = passé. `null` si la date est absente ou illisible.
 */
export function joursAvant(date: string, maintenant: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ''))) return null;
  const cible = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(cible)) return null;
  const aujourdhui = Date.parse(`${jourCourant(maintenant)}T12:00:00Z`);
  return Math.round((cible - aujourdhui) / 86_400_000);
}

/** L'état, déduit. Voir `EtatEvenement`. */
export function etatEvenement(evenement: EvenementData, maintenant: Date = new Date()): EtatEvenement {
  // L'annulation passe avant tout : un événement annulé la semaine dernière ne
  // se lit pas « passé », il se lit « annulé », et la nuance compte pour qui
  // relit la liste six mois après.
  if (evenement.annule) return 'annule';
  const jours = joursAvant(evenement.date, maintenant);
  if (jours === null) return 'sans-date';
  if (jours < 0) return 'passe';
  return jours <= JOURS_IMMINENT ? 'imminent' : 'a-venir';
}

export const ETAT_LABELS: Record<EtatEvenement, string> = {
  annule: 'Annulé',
  passe: 'Passé',
  imminent: 'Imminent',
  'a-venir': 'À venir',
  'sans-date': 'Sans date',
};

/* ----------------------------- L'économie ---------------------------------- */

/** Ce que l'économie d'un événement donne, une fois le calcul déroulé. */
export interface EconomieEvenement {
  coutsFixesCents: number;
  /** Ce que rapporte réellement une entrée, commission et coût variable déduits. */
  recetteNetteBilletCents: number;
  /**
   * Le nombre ENTIER d'entrées à partir duquel l'événement est à l'équilibre —
   * ou `null` quand IL N'EN EXISTE PAS.
   *
   * `null` dès qu'une entrée rapporte zéro ou moins. Le moteur de calcul rend
   * alors un nombre grand mais fini (`coûts fixes / max(recette, 1)`), pour ne
   * pas laisser un `Infinity` traverser tout le calcul — c'est sa garantie à
   * lui, et elle est bonne. Mais ce nombre-là n'est PAS un seuil : sur des
   * coûts de 2 300 € il vaut 230 000, et « SEUIL : 230 000 » se lit comme
   * « il faut vendre 230 000 places ». Un chiffre faux avec l'autorité d'un
   * chiffre juste. Ici on dit qu'il n'y en a pas.
   */
  seuilEntrees: number | null;
  /** Ce qu'il rapporte si la salle est pleine. Peut être négatif. */
  margeSalleCombleCents: number;
  /** Ce que rapportent les billets DÉJÀ vendus, coûts fixes déduits. */
  resultatActuelCents: number;
  /** Entrées restant à vendre pour atteindre l'équilibre. Jamais négatif. */
  entreesAvantEquilibre: number;
  /**
   * Le seuil tient-il dans la salle ?
   *
   * Faux = l'événement ne peut PAS être rentable, même complet. C'est le
   * verdict le plus important de tout ce module, et le seul qu'on ne
   * rattrapera pas en vendant mieux : il faut baisser les coûts ou monter le
   * prix du billet.
   */
  atteignable: boolean;
  /** Le remplissage, en points de pourcentage. Peut dépasser 100 (surbooking). */
  remplissage: number;
  /** Ce que le moteur de calcul n'a pas pu calculer, avec la raison. */
  erreurs: { key: string; message: string }[];
}

/**
 * L'économie d'un événement, par le moteur de calcul.
 *
 * `resultatActuelCents` mérite un mot : c'est
 * `recette nette × billets vendus − coûts fixes`, et il est volontairement
 * NÉGATIF tant que le seuil n'est pas atteint. Afficher zéro à la place, ou
 * s'arrêter à « il reste 37 entrées », cacherait le montant qu'on est en train
 * de perdre — qui est justement ce qu'on veut savoir trois semaines avant.
 */
export function economieEvenement(evenement: EvenementData): EconomieEvenement {
  const profile = calcProfileById('evenementiel-rentabilite');
  const vide: EconomieEvenement = {
    coutsFixesCents: 0,
    recetteNetteBilletCents: 0,
    seuilEntrees: 0,
    margeSalleCombleCents: 0,
    resultatActuelCents: 0,
    entreesAvantEquilibre: 0,
    atteignable: false,
    remplissage: 0,
    erreurs: [{ key: 'profil', message: 'Le calculateur de rentabilité est introuvable.' }],
  };
  if (!profile) return vide;

  const r = evaluateProfile(profile, {
    coutLieu: evenement.coutLieuCents,
    coutPrestataires: evenement.coutPrestatairesCents,
    coutCommunication: evenement.coutCommunicationCents,
    coutParEntree: evenement.coutParEntreeCents,
    prixBillet: evenement.prixBilletCents,
    commissionBilletterie: evenement.commissionBilletterie,
    capacite: evenement.capacite,
  });

  const coutsFixes = r.scope.coutsFixes ?? 0;
  const recette = r.scope.recetteNetteBillet ?? 0;
  const vendus = Math.max(evenement.billetsVendus, 0);
  // Pas de recette par entrée, pas de seuil. Voir `seuilEntrees`.
  const seuil = recette > 0 ? (r.scope.seuilEntrees ?? null) : null;

  return {
    coutsFixesCents: coutsFixes,
    recetteNetteBilletCents: recette,
    seuilEntrees: seuil,
    margeSalleCombleCents: r.scope.margeSalleComble ?? 0,
    resultatActuelCents: Math.round(recette * vendus - coutsFixes),
    // Sans seuil, « il reste N entrées » n'a pas de sens non plus : la valeur
    // reste à zéro, et l'écran affiche le verdict au lieu d'un décompte.
    entreesAvantEquilibre: seuil === null ? 0 : Math.max(seuil - vendus, 0),
    // Deux façons de ne pas être atteignable, et l'écran les distingue :
    // aucune recette par entrée (vendre creuse le trou), ou un seuil qui ne
    // tient pas dans la salle (vendre ne suffira jamais).
    atteignable: seuil !== null && seuil <= evenement.capacite,
    remplissage: evenement.capacite > 0 ? (vendus * 100) / evenement.capacite : 0,
    erreurs: r.errors,
  };
}

/* ------------------------------- Le tri ------------------------------------ */

/**
 * L'ordre de la liste : ce qui demande une décision, d'abord.
 *
 * Un tri chronologique pur mettrait un concert d'il y a trois ans avant celui
 * de la semaine prochaine, ou l'inverse — dans les deux cas, la personne
 * cherche. L'ordre ci-dessous répond à « de quoi dois-je m'occuper » :
 *
 *   1. les imminents, du plus proche au plus lointain ;
 *   2. les autres à venir, dans l'ordre ;
 *   3. ceux sans date — une intention qu'il faut arrêter ;
 *   4. les passés, du plus récent au plus ancien ;
 *   5. les annulés, en dernier.
 *
 * Les annulés ne disparaissent pas : on annule rarement sans avoir déjà
 * dépensé, et la trace sert au bilan.
 */
const RANG: Record<EtatEvenement, number> = {
  imminent: 0,
  'a-venir': 1,
  'sans-date': 2,
  passe: 3,
  annule: 4,
};

export function trierEvenements<T extends EvenementData>(
  evenements: T[],
  maintenant: Date = new Date(),
): T[] {
  return [...evenements].sort((a, b) => {
    const ea = etatEvenement(a, maintenant);
    const eb = etatEvenement(b, maintenant);
    if (RANG[ea] !== RANG[eb]) return RANG[ea] - RANG[eb];

    const ja = joursAvant(a.date, maintenant);
    const jb = joursAvant(b.date, maintenant);
    if (ja === null && jb === null) return a.nom.localeCompare(b.nom, 'fr');
    if (ja === null) return 1;
    if (jb === null) return -1;
    // Les passés se lisent du plus récent au plus ancien : le dernier
    // événement est celui dont on tire le bilan, pas le premier de l'histoire.
    return ea === 'passe' || ea === 'annule' ? jb - ja : ja - jb;
  });
}

/* --------------------------- Lecture d'un enregistrement ------------------- */

const nombre = (v: unknown, defaut = 0): number => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : defaut;
};

/**
 * Remet un enregistrement reçu d'équerre.
 *
 * Même raison que pour les pages : il arrive de la synchronisation, donc d'une
 * autre machine et peut-être d'une autre version. Une capacité `undefined`
 * dans une division donnerait `NaN %` à l'écran — un affichage qui ne dit rien
 * de son origine. On remet en forme à la LECTURE plutôt que de faire confiance.
 */
export function normaliserEvenement(id: string, raw: Record<string, unknown> | null | undefined): Evenement {
  const r = raw ?? {};
  return {
    id,
    nom: typeof r.nom === 'string' && r.nom.trim() ? r.nom : 'Sans nom',
    date: typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : '',
    horaire: typeof r.horaire === 'string' ? r.horaire : undefined,
    lieu: typeof r.lieu === 'string' ? r.lieu : undefined,
    // Négatives, ces trois valeurs n'ont aucun sens et fausseraient tout le
    // reste en silence : une jauge de −50 donnerait un remplissage négatif.
    capacite: Math.max(Math.round(nombre(r.capacite, 0)), 0),
    billetsVendus: Math.max(Math.round(nombre(r.billetsVendus, 0)), 0),
    prixBilletCents: Math.max(Math.round(nombre(r.prixBilletCents, 0)), 0),
    commissionBilletterie: Math.min(Math.max(nombre(r.commissionBilletterie, 0), 0), 100),
    coutLieuCents: Math.max(Math.round(nombre(r.coutLieuCents, 0)), 0),
    coutPrestatairesCents: Math.max(Math.round(nombre(r.coutPrestatairesCents, 0)), 0),
    coutCommunicationCents: Math.max(Math.round(nombre(r.coutCommunicationCents, 0)), 0),
    coutParEntreeCents: Math.max(Math.round(nombre(r.coutParEntreeCents, 0)), 0),
    annule: r.annule === true,
    notes: typeof r.notes === 'string' ? r.notes : undefined,
  };
}

/** Un événement neuf, avec des valeurs qui tiennent debout. */
export function evenementNeuf(): EvenementData {
  return {
    nom: '',
    date: '',
    capacite: 200,
    billetsVendus: 0,
    prixBilletCents: 2500,
    commissionBilletterie: 5,
    coutLieuCents: 120000,
    coutPrestatairesCents: 80000,
    coutCommunicationCents: 30000,
    coutParEntreeCents: 150,
  };
}
