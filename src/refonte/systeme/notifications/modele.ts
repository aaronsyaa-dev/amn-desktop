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
  /**
   * ISO. L'heure à laquelle la chose arrive, quand la notification en porte une (le début d'un rendez-vous) : c'est
   * ce qui la fait passer dans « Maintenant » dans l'heure qui précède (rubrique 6). Absente : aucune échéance.
   */
  echeance?: string;
}

export interface NotificationBrute extends NotificationSource {
  date: string;
}

export interface Notification extends NotificationBrute {
  lue: boolean;
}

export type Onglet = 'tout' | 'non-lues' | 'mentions' | 'urgent';
export const ONGLETS: readonly Onglet[] = ['tout', 'non-lues', 'mentions', 'urgent'];

/**
 * Les trois groupes du fil (v3, rubrique 6) : « Maintenant » (ce qui se traite tout de suite : urgentes non lues, et
 * ce qui arrive dans l'heure), « Aujourd'hui » (le reste du jour), « Plus tôt » (avant aujourd'hui, rangé en paquets).
 */
export type CleGroupe = 'maintenant' | 'aujourdhui' | 'plus-tot';
export const ORDRE_GROUPES: readonly CleGroupe[] = ['maintenant', 'aujourdhui', 'plus-tot'];

/** Le jour d'une date, vu d'aujourd'hui : il décide de l'heure affichée (« 10:12 », « Hier », « Mar. », « 25 oct. »). */
export type CleJour = 'aujourdhui' | 'hier' | 'semaine' | 'plus-tot';

export interface Groupe {
  cle: CleGroupe;
  notifications: Notification[];
}

/** « Maintenant » prend ce qui arrive dans l'heure (un rendez-vous à 11:00 dès 10:00). */
export const FENETRE_MAINTENANT_MIN = 60;

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

/** Dans quel jour tombe une date : aujourd'hui, hier, plus tôt dans la semaine, ou avant. */
export function jourDe(iso: string, maintenant: Date): CleJour {
  const quand = new Date(iso);
  const ecart = numeroDeJour(maintenant) - numeroDeJour(quand);
  if (ecart <= 0) return 'aujourdhui'; // le futur proche (horloge décalée) reste « aujourd'hui »
  if (ecart === 1) return 'hier';
  return numeroDeJour(quand) >= lundiDeLaSemaine(maintenant) ? 'semaine' : 'plus-tot';
}

const MAJUSCULE = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * L'heure affichée à droite d'une ligne (v3) : « 10:12 » aujourd'hui, « Hier » la veille, l'abréviation du jour
 * (« Mar. ») plus tôt dans la semaine, le jour et le mois (« 12 oct. ») au-delà. Toujours formatée par `Intl`, jamais
 * à la main ; « Hier » vient des mots de la page (`hier`).
 */
export function heureAffichee(iso: string, maintenant: Date, locale = 'fr-FR', hier = 'Hier'): string {
  const quand = new Date(iso);
  const jour = jourDe(iso, maintenant);
  if (jour === 'aujourdhui') return heureHorloge(quand, locale);
  if (jour === 'hier') return hier;
  if (jour === 'semaine') return MAJUSCULE(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(quand));
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(quand);
}

/** « 10:42 », « 08:02 » : l'heure à deux chiffres (anneau, cartes, point d'Ajmani). */
export function heureHorloge(d: Date, locale = 'fr-FR'): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
}

/** Vrai quand la date tombe le jour civil de `maintenant`. */
export function estDuJour(iso: string, maintenant: Date): boolean {
  return numeroDeJour(new Date(iso)) === numeroDeJour(maintenant);
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

/**
 * « Maintenant » (rubrique 6) : les urgentes non traitées (non lues), et ce qui porte une échéance dans l'heure (de
 * maintenant à + 60 min : le rendez-vous de 11:00 dès 10:00), lu ou non — il se traite tout de suite. Lue, une
 * urgente rejoint son jour ; un rendez-vous commencé aussi.
 */
export function estMaintenant(n: Notification, maintenant: Date): boolean {
  if (n.urgente && !n.lue) return true;
  if (!n.echeance) return false;
  const ecart = Date.parse(n.echeance) - maintenant.getTime();
  return Number.isFinite(ecart) && ecart >= 0 && ecart <= FENETRE_MAINTENANT_MIN * 60_000;
}

/** Le groupe d'une notification : Maintenant, Aujourd'hui (le reste du jour), Plus tôt (avant aujourd'hui). */
export function groupeDe(n: Notification, maintenant: Date): CleGroupe {
  if (estMaintenant(n, maintenant)) return 'maintenant';
  return jourDe(n.date, maintenant) === 'aujourdhui' ? 'aujourdhui' : 'plus-tot';
}

/** Les groupes non vides, dans l'ordre Maintenant, Aujourd'hui, Plus tôt, chacun trié (non lues d'abord). */
export function grouper(notifications: readonly Notification[], maintenant: Date): Groupe[] {
  const parGroupe = new Map<CleGroupe, Notification[]>();
  for (const n of notifications) {
    const cle = groupeDe(n, maintenant);
    const liste = parGroupe.get(cle);
    if (liste) liste.push(n);
    else parGroupe.set(cle, [n]);
  }
  return ORDRE_GROUPES.flatMap((cle) => {
    const liste = parGroupe.get(cle);
    return liste ? [{ cle, notifications: trier(liste) }] : [];
  });
}

/* ── Les paquets ─────────────────────────────────────────────────────────── */

/** Une ligne du fil : une notification seule, ou un paquet (au moins deux de la même clé, en une ligne). */
export type ElementFil =
  | { genre: 'seule'; id: string; notification: Notification }
  | {
      genre: 'paquet';
      id: string;
      /** `famille` : le paquet de « Plus tôt » réunit une famille ; `type` : celui d'« Aujourd'hui » réunit une source et un type. */
      par: 'famille' | 'type';
      /** Triées comme le fil : la première est la plus récente des non lues, ou la plus récente. */
      notifications: Notification[];
      lue: boolean;
      famille: Famille;
      type: TypeNotification;
      icone: IconeNotification;
    };

export interface GroupeFil {
  cle: CleGroupe;
  elements: ElementFil[];
  /** Combien de notifications du groupe ne sont pas lues (le compteur de « Aujourd'hui »). */
  nonLues: number;
}

/**
 * La clé de regroupement d'une notification dans son groupe (rubrique 6, proposition) : rien dans « Maintenant »
 * (chaque geste reste visible) ; la source et le type dans « Aujourd'hui » ; la famille dans « Plus tôt ».
 */
export function cleDePaquet(n: Notification, groupe: CleGroupe): string | null {
  if (groupe === 'maintenant') return null;
  if (groupe === 'plus-tot') return `famille:${n.famille}`;
  return `type:${n.module ?? n.famille}:${n.type}`;
}

/** Le rang d'un élément : 0 urgente non lue, 1 non lue, 2 lue (un paquet prend celui de sa meilleure notification). */
function rangElement(e: ElementFil): number {
  return e.genre === 'seule' ? rang(e.notification) : Math.min(...e.notifications.map(rang));
}

function dateElement(e: ElementFil): number {
  return e.genre === 'seule' ? Date.parse(e.notification.date) : Math.max(...e.notifications.map((n) => Date.parse(n.date)));
}

/**
 * Range un groupe en lignes : au moins deux notifications de même clé font un paquet ; le tri reste celui du fil
 * (non lues d'abord, puis l'heure décroissante), un paquet prenant la place de sa meilleure notification.
 */
export function enPaquets(groupe: Groupe): GroupeFil {
  const parCle = new Map<string, Notification[]>();
  for (const n of groupe.notifications) {
    const cle = cleDePaquet(n, groupe.cle);
    if (cle === null) continue;
    const liste = parCle.get(cle);
    if (liste) liste.push(n);
    else parCle.set(cle, [n]);
  }
  const elements: ElementFil[] = [];
  const faits = new Set<string>();
  for (const n of groupe.notifications) {
    const cle = cleDePaquet(n, groupe.cle);
    const liste = cle === null ? undefined : parCle.get(cle);
    if (!cle || !liste || liste.length < 2) {
      elements.push({ genre: 'seule', id: n.id, notification: n });
      continue;
    }
    if (faits.has(cle)) continue;
    faits.add(cle);
    const notifications = trier(liste);
    elements.push({
      genre: 'paquet',
      id: `paquet:${groupe.cle}:${cle}`,
      par: groupe.cle === 'plus-tot' ? 'famille' : 'type',
      notifications,
      lue: notifications.every((x) => x.lue),
      famille: n.famille,
      type: n.type,
      icone: n.icone,
    });
  }
  elements.sort((a, b) => rangElement(a) - rangElement(b) || dateElement(b) - dateElement(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { cle: groupe.cle, elements, nonLues: groupe.notifications.filter((x) => !x.lue).length };
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

/** Le sous-titre de la page : la clé de mots et ses paramètres (les pluriels français vivent dans `i18n.ts`). */
export type CleSousTitre = 'sous.zero' | 'sous.un' | 'sous.n' | 'sous.un.urgente' | 'sous.n.urgente' | 'sous.n.urgentes';

/**
 * « {non lues} nouvelles, dont {urgentes} urgente(s) · l'important d'abord, le reste attend » (rubrique 6) ;
 * sans urgence, la seconde moitié seulement ; à zéro, « Boîte à zéro ».
 */
export function sousTitre(nonLues: number, urgentes = 0): { cle: CleSousTitre; params: { n: number; u: number } } {
  const u = Math.max(0, Math.min(urgentes, nonLues));
  if (nonLues <= 0) return { cle: 'sous.zero', params: { n: 0, u: 0 } };
  if (u === 0) return { cle: nonLues === 1 ? 'sous.un' : 'sous.n', params: { n: nonLues, u } };
  if (nonLues === 1) return { cle: 'sous.un.urgente', params: { n: 1, u: 1 } };
  return { cle: u === 1 ? 'sous.n.urgente' : 'sous.n.urgentes', params: { n: nonLues, u } };
}

/* ── La journée (l'anneau de 24 h) et le point d'Ajmani ──────────────────── */

/** Les minutes depuis minuit (heure locale) d'une date. */
export function minutesDuJour(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export interface Journee {
  /** Les notifications du jour, dans l'ordre des heures (un rayon chacune). */
  notifications: Notification[];
  /** « 4 à voir » : les non lues du jour. */
  aVoir: number;
  /** « sur 9 aujourd'hui » : toutes celles du jour, lues comprises. */
  total: number;
}

/** Ce que l'anneau dit de la journée : un rayon par notification du jour, « à voir » sur le total du jour. */
export function journee(notifications: readonly Notification[], maintenant: Date): Journee {
  const duJour = notifications.filter((n) => estDuJour(n.date, maintenant)).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return { notifications: duJour, aVoir: duJour.filter((n) => !n.lue).length, total: duJour.length };
}

/** L'importance d'un rayon : sa longueur (24 pour l'urgente, 15 pour une non lue, 11 pour une lue). */
export function importanceDe(n: Notification): 'urgente' | 'non-lue' | 'lue' {
  if (n.urgente && !n.lue) return 'urgente';
  return n.lue ? 'lue' : 'non-lue';
}

/** Les quatre catégories que le point d'Ajmani résume, dans l'ordre où il les dit (la cinquième, si place). */
export const CATEGORIES_DU_POINT = ['urgent', 'paiement', 'securite', 'rendez-vous', 'mention'] as const;
export type CategorieDuPoint = (typeof CATEGORIES_DU_POINT)[number];
export const LIGNES_DU_POINT = 4;

export interface LignePoint {
  categorie: CategorieDuPoint;
  /** Combien de notifications du jour la ligne résume. */
  nombre: number;
  /** Le titre de la plus récente : le fait, tel que le module l'a écrit (jamais réécrit, jamais inventé). */
  titre: string;
  famille: Famille;
}

/**
 * « Le point d'Ajmani » (rubrique 6) : au plus quatre phrases, une par catégorie importante du jour, faites des titres
 * que les modules ont écrits. « 1 urgence » compte les urgentes non lues ; les autres lignes comptent les notifications
 * du jour de leur catégorie (une urgente non lue n'est dite qu'une fois). Rien d'important : aucune ligne.
 */
export function pointDuJour(notifications: readonly Notification[], maintenant: Date): LignePoint[] {
  const duJour = notifications.filter((n) => estDuJour(n.date, maintenant));
  const lignes: LignePoint[] = [];
  for (const categorie of CATEGORIES_DU_POINT) {
    if (lignes.length >= LIGNES_DU_POINT) break;
    const propres = duJour.filter((n) => (categorie === 'urgent' ? n.urgente && !n.lue : !(n.urgente && !n.lue) && categorieDe(n.type) === categorie));
    if (propres.length === 0) continue;
    const plusRecente = [...propres].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
    lignes.push({ categorie, nombre: propres.length, titre: plusRecente.titre, famille: plusRecente.famille });
  }
  return lignes;
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
