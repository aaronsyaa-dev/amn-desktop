/**
 * LE MODÈLE DES NOTIFICATIONS (H40) — pur, sans React, sans stockage.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tout ce que la page et la cloche de l'en-tête doivent savoir dire de la même
 * façon se décide ici, une fois : le tri, les groupes par jour, les compteurs
 * des onglets, la pastille de la cloche, l'heure affichée, le sous-titre, les
 * échéances de report, la suggestion « Moins de bruit ». Aucune de ces
 * fonctions ne lit l'horloge : on lui passe `maintenant`, ce qui les rend
 * rejouables par `npm run check:systeme-notifications`.
 *
 * Les notifications elles-mêmes ne sont pas stockées : elles se DÉRIVENT des
 * sources réelles (`sources.ts`), et le magasin (`magasin.ts`) y ajoute ce
 * qui est propre à la personne (lu, reporté). Voir `etat.ts`.
 */
import type { Famille } from '../../../socle/familles';

/* ── Types ───────────────────────────────────────────────────────────────── */

/**
 * Ce qui s'est passé. Cinq types ont leur ligne dans la matrice de préférences
 * (urgent, paiement, securite, mention, rendez-vous) ; les quatre autres n'en
 * ont pas et se rattachent à l'une d'elles (`categorieDe`).
 */
export type TypeNotification = 'urgent' | 'paiement' | 'securite' | 'mention' | 'rendez-vous' | 'devis' | 'stock' | 'client' | 'activite';

/** Une ligne de la matrice de préférences (ou « activite », qui n'a pas de ligne : App seulement). */
export type CategorieReglage = 'urgent' | 'paiement' | 'securite' | 'mention' | 'rendez-vous' | 'activite';

/** Les cinq lignes de la matrice, dans l'ordre de la maquette. */
export const CATEGORIES_MATRICE = ['urgent', 'paiement', 'securite', 'mention', 'rendez-vous'] as const;
export type CategorieMatrice = (typeof CATEGORIES_MATRICE)[number];

export type IconeNotification = 'drapeau' | 'euro' | 'cadenas' | 'bulle' | 'calendrier' | 'coche' | 'boite' | 'utilisateurs' | 'cloche';

/** Où mène « Ouvrir » : une route, et le deep-link que l'écran visé comprend déjà (`state` du routeur). */
export interface VersNotification {
  route: string;
  state?: Record<string, string | number>;
}

/** Une notification telle que les sources la produisent : la date manque quand c'est « la première fois vue ». */
export interface NotificationSource {
  /** Stable d'un rendu à l'autre : sert de clé et d'identité pour « lu » et « reporté ». */
  id: string;
  type: TypeNotification;
  titre: string;
  detail: string;
  vers: VersNotification;
  /** ISO. Absente : le magasin pose la première fois où l'identifiant a été vu. */
  date?: string;
  urgente: boolean;
  /** La famille du module d'origine : donne la couleur de la tuile d'icône. */
  famille: Famille;
  icone: IconeNotification;
  /** Le module d'origine (clé de `src/data/spaces.ts`), ou `null` : toujours ouvert (sécurité). */
  module: string | null;
}

export interface NotificationBrute extends NotificationSource {
  date: string;
}

export interface Notification extends NotificationBrute {
  lue: boolean;
}

export type Onglet = 'tout' | 'non-lues' | 'mentions' | 'urgent';
export const ONGLETS: readonly Onglet[] = ['tout', 'non-lues', 'mentions', 'urgent'];

export type CleGroupe = 'aujourdhui' | 'hier' | 'semaine' | 'plus-tot';
export const ORDRE_GROUPES: readonly CleGroupe[] = ['aujourdhui', 'hier', 'semaine', 'plus-tot'];

export interface Groupe {
  cle: CleGroupe;
  notifications: Notification[];
}

/** « Tout » garde les 30 derniers jours (rubrique 6), puis les notifications s'archivent. */
export const RETENTION_JOURS = 30;
/** Combien de lignes d'un coup avant « Afficher les plus anciennes » (rubrique 8). */
export const LIGNES_PAR_PAGE = 50;

const JOUR_MS = 86_400_000;

/* ── Rattachement des types ──────────────────────────────────────────────── */

/**
 * La ligne de la matrice qui gouverne un type. Proposition de la rubrique 13 de la fiche, à valider : le devis
 * signé rejoint « Paiements » ; le stock et les nouveaux clients forment « Activité de l'équipe » (App seulement,
 * incluse dans le résumé du matin).
 */
export function categorieDe(type: TypeNotification): CategorieReglage {
  switch (type) {
    case 'devis':
      return 'paiement';
    case 'stock':
    case 'client':
    case 'activite':
      return 'activite';
    default:
      return type;
  }
}

/** L'icône d'un type : celle de la maquette. */
export function iconeDe(type: TypeNotification): IconeNotification {
  switch (type) {
    case 'urgent':
      return 'drapeau';
    case 'paiement':
      return 'euro';
    case 'securite':
      return 'cadenas';
    case 'mention':
      return 'bulle';
    case 'rendez-vous':
      return 'calendrier';
    case 'devis':
      return 'coche';
    case 'stock':
      return 'boite';
    case 'client':
      return 'utilisateurs';
    default:
      return 'cloche';
  }
}

/* ── Les jours ───────────────────────────────────────────────────────────── */

/** Le numéro du jour civil local (pour compter des jours sans dépendre de l'heure d'été). */
function numeroDeJour(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / JOUR_MS);
}

/** Le lundi de la semaine de `d`, en numéro de jour (la semaine française commence le lundi). */
function lundiDeLaSemaine(d: Date): number {
  const jour = (d.getDay() + 6) % 7; // lundi = 0
  return numeroDeJour(d) - jour;
}

/** Dans quel groupe tombe une date : aujourd'hui, hier, plus tôt dans la semaine, ou avant. */
export function groupeDe(iso: string, maintenant: Date): CleGroupe {
  const quand = new Date(iso);
  const ecart = numeroDeJour(maintenant) - numeroDeJour(quand);
  if (ecart <= 0) return 'aujourdhui'; // le futur proche (horloge décalée) reste « aujourd'hui »
  if (ecart === 1) return 'hier';
  return numeroDeJour(quand) >= lundiDeLaSemaine(maintenant) ? 'semaine' : 'plus-tot';
}

const MAJUSCULE = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * L'heure affichée à droite d'une ligne : « 10:12 » aujourd'hui et hier, l'abréviation du jour (« Mar. ») plus tôt
 * dans la semaine, le jour et le mois (« 12 oct. ») au-delà. Toujours formatée par `Intl`, jamais à la main.
 */
export function heureAffichee(iso: string, maintenant: Date, locale = 'fr-FR'): string {
  const quand = new Date(iso);
  const groupe = groupeDe(iso, maintenant);
  if (groupe === 'aujourdhui' || groupe === 'hier') return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(quand);
  if (groupe === 'semaine') return MAJUSCULE(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(quand));
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(quand);
}

/** Une heure sans zéro devant l'heure ronde de la matinée : « 9:00 », « 18:00 ». */
export function heureCourte(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ── Tri et groupes ──────────────────────────────────────────────────────── */

/** Le rang d'une notification dans son groupe : 0 urgente non lue, 1 non lue, 2 lue. */
function rang(n: Notification): number {
  if (n.lue) return 2;
  return n.urgente ? 0 : 1;
}

/**
 * Le tri de la fiche (rubrique 6) : non lues d'abord, les urgentes en tête, puis les lues ; chaque sous-ensemble par
 * heure décroissante. On ne retrie donc JAMAIS par heure seule : « 10:30 » (lue) passe sous « 08:02 » (non lue).
 */
export function comparerNotifications(a: Notification, b: Notification): number {
  const r = rang(a) - rang(b);
  if (r !== 0) return r;
  const t = Date.parse(b.date) - Date.parse(a.date);
  if (t !== 0) return t;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function trier(notifications: readonly Notification[]): Notification[] {
  return [...notifications].sort(comparerNotifications);
}

/** Les groupes non vides, dans l'ordre Aujourd'hui, Hier, Cette semaine, Plus tôt, chacun trié. */
export function grouper(notifications: readonly Notification[], maintenant: Date): Groupe[] {
  const parGroupe = new Map<CleGroupe, Notification[]>();
  for (const n of notifications) {
    const cle = groupeDe(n.date, maintenant);
    const liste = parGroupe.get(cle);
    if (liste) liste.push(n);
    else parGroupe.set(cle, [n]);
  }
  return ORDRE_GROUPES.flatMap((cle) => {
    const liste = parGroupe.get(cle);
    return liste ? [{ cle, notifications: trier(liste) }] : [];
  });
}

/** Garde les `max` premières lignes (dans l'ordre d'affichage) et dit combien restent. */
export function decouper(groupes: readonly Groupe[], max: number): { groupes: Groupe[]; restantes: number } {
  let reste = max;
  let restantes = 0;
  const out: Groupe[] = [];
  for (const g of groupes) {
    if (reste <= 0) {
      restantes += g.notifications.length;
      continue;
    }
    const garde = g.notifications.slice(0, reste);
    reste -= garde.length;
    restantes += g.notifications.length - garde.length;
    out.push({ cle: g.cle, notifications: garde });
  }
  return { groupes: out, restantes };
}

/* ── Onglets et compteurs ────────────────────────────────────────────────── */

export interface Compteurs {
  tout: number;
  nonLues: number;
  mentions: number;
  urgent: number;
}

/** « Urgent » = les urgentes non traitées, c'est-à-dire non lues. Le même prédicat filtre l'onglet et le compte. */
const estUrgenteATraiter = (n: Notification): boolean => n.urgente && !n.lue;

export function compteurs(notifications: readonly Notification[]): Compteurs {
  let nonLues = 0;
  let mentions = 0;
  let urgent = 0;
  for (const n of notifications) {
    if (!n.lue) nonLues += 1;
    if (n.type === 'mention') mentions += 1;
    if (estUrgenteATraiter(n)) urgent += 1;
  }
  return { tout: notifications.length, nonLues, mentions, urgent };
}

export function filtrerOnglet(notifications: readonly Notification[], onglet: Onglet): Notification[] {
  switch (onglet) {
    case 'non-lues':
      return notifications.filter((n) => !n.lue);
    case 'mentions':
      return notifications.filter((n) => n.type === 'mention');
    case 'urgent':
      return notifications.filter(estUrgenteATraiter);
    default:
      return [...notifications];
  }
}

/** Ce que la cloche affiche : le nombre de « Non lues », « 99+ » au-delà de 99, rien à zéro. Jamais un autre calcul. */
export function pastilleCloche(nonLues: number): string | null {
  if (nonLues <= 0) return null;
  return nonLues > 99 ? '99+' : String(nonLues);
}

/** Le sous-titre de la page : la clé de mots et son paramètre (les pluriels français vivent dans `i18n.ts`). */
export function sousTitre(nonLues: number): { cle: 'sous.zero' | 'sous.un' | 'sous.n'; params: { n: number } } {
  if (nonLues <= 0) return { cle: 'sous.zero', params: { n: 0 } };
  return { cle: nonLues === 1 ? 'sous.un' : 'sous.n', params: { n: nonLues } };
}

/* ── Report ──────────────────────────────────────────────────────────────── */

export type CleReport = 'heure' | 'soir' | 'demain' | 'lundi';

export interface OptionReport {
  cle: CleReport;
  echeance: Date;
  /** L'heure de l'échéance, « 18:00 » ou « 9:00 », pour les libellés qui la disent. */
  heure: string;
}

const A_HEURE = (base: Date, jours: number, h: number): Date => new Date(base.getFullYear(), base.getMonth(), base.getDate() + jours, h, 0, 0, 0);

/**
 * Les échéances proposées par « Reporter » : dans 1 heure, ce soir 18:00 (tant qu'il reste au moins 30 minutes),
 * demain 9:00, lundi 9:00 (sauf quand lundi est demain, déjà proposé). Chaque échéance est calculée, jamais lue d'un
 * libellé.
 */
export function optionsReport(maintenant: Date): OptionReport[] {
  const options: OptionReport[] = [];
  const dansUneHeure = new Date(maintenant.getTime() + 3_600_000);
  options.push({ cle: 'heure', echeance: dansUneHeure, heure: heureCourte(dansUneHeure) });
  const soir = A_HEURE(maintenant, 0, 18);
  if (soir.getTime() - maintenant.getTime() >= 30 * 60_000) options.push({ cle: 'soir', echeance: soir, heure: heureCourte(soir) });
  const demain = A_HEURE(maintenant, 1, 9);
  options.push({ cle: 'demain', echeance: demain, heure: heureCourte(demain) });
  const joursJusquAuLundi = ((1 - maintenant.getDay() + 7) % 7) || 7;
  if (joursJusquAuLundi >= 2) {
    const lundi = A_HEURE(maintenant, joursJusquAuLundi, 9);
    options.push({ cle: 'lundi', echeance: lundi, heure: heureCourte(lundi) });
  }
  return options;
}

/* ── Visibilité selon les réglages et les modules ouverts ────────────────── */

export interface FiltreVisibilite {
  /** Le canal « App » de la ligne de matrice est-il actif ? */
  appActif: (categorie: CategorieReglage) => boolean;
  /** Le module d'origine est-il ouvert à cette personne ? (`isModuleEnabled`.) */
  moduleOuvert: (module: string) => boolean;
}

/**
 * Ce que la personne doit voir dans la liste ET compter sur la cloche : un module fermé n'émet pas de ligne, et
 * seul le canal « App » filtre aujourd'hui (Mail et Mobile n'ont pas d'émetteur). La SÉCURITÉ n'est jamais masquée par
 * le canal « App » : tant que Mail et Mobile n'envoient rien, un seul clic ne doit pas rendre une alerte invisible.
 */
export function filtrerParReglages(notifications: readonly Notification[], filtre: FiltreVisibilite): Notification[] {
  return notifications.filter((n) => {
    if (n.module !== null && !filtre.moduleOuvert(n.module)) return false;
    const categorie = categorieDe(n.type);
    return categorie === 'securite' || filtre.appActif(categorie);
  });
}

/* ── Suggestion « Moins de bruit » (rubrique 10) ─────────────────────────── */

/** Les seules lignes qu'Ajmani propose de passer en résumé : jamais un ticket urgent ni la sécurité. */
export const CATEGORIES_SUGGERABLES = ['paiement', 'mention', 'rendez-vous'] as const;
export type CategorieSuggerable = (typeof CATEGORIES_SUGGERABLES)[number];

export const JOURS_SANS_OUVRIR = 14;
export const NOTIFICATIONS_MINIMUM = 5;
export const JOURS_DE_SILENCE_APRES_GARDER = 30;

export interface SuggestionMoinsDeBruit {
  categorie: CategorieSuggerable;
  /** Depuis combien de jours rien de ce type n'a été ouvert. */
  jours: number;
}

/**
 * Le déclencheur : un type qui a produit au moins 5 notifications dont la plus ancienne a au moins 14 jours, sans que
 * la personne en ait OUVERT une depuis 14 jours (`ouvertures` : la dernière ouverture, par type), et pour lequel
 * « Garder » n'a pas répondu dans les 30 derniers jours (`gardees` : jusqu'à quand le silence dure). Le type qui
 * a gardé le plus de notifications passe en premier. Rien d'éligible : `null` (la carte « Astuce » prend la place).
 */
export function suggestionMoinsDeBruit(
  notifications: readonly Notification[],
  ouvertures: Partial<Record<CategorieReglage, string>>,
  gardees: Partial<Record<CategorieReglage, string>>,
  maintenant: Date,
): SuggestionMoinsDeBruit | null {
  const t = maintenant.getTime();
  let meilleure: (SuggestionMoinsDeBruit & { nombre: number }) | null = null;
  for (const categorie of CATEGORIES_SUGGERABLES) {
    const propres = notifications.filter((n) => categorieDe(n.type) === categorie);
    if (propres.length < NOTIFICATIONS_MINIMUM) continue;
    const jusqua = gardees[categorie];
    if (jusqua && Date.parse(jusqua) > t) continue;
    const plusAncienne = Math.min(...propres.map((n) => Date.parse(n.date)));
    const derniereOuverture = ouvertures[categorie] ? Date.parse(ouvertures[categorie] as string) : Number.NEGATIVE_INFINITY;
    const depuis = Math.max(plusAncienne, derniereOuverture);
    const jours = Math.floor((t - depuis) / JOUR_MS);
    if (jours < JOURS_SANS_OUVRIR) continue;
    if (!meilleure || propres.length > meilleure.nombre) meilleure = { categorie, jours, nombre: propres.length };
  }
  return meilleure ? { categorie: meilleure.categorie, jours: meilleure.jours } : null;
}
