/**
 * LES PRÉFÉRENCES DE NOTIFICATION (H40) — le modèle, sans React, sans réseau.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * La matrice « Que voulez-vous recevoir ? » : cinq types (tickets urgents, paiements, sécurité, mentions,
 * rendez-vous) × trois canaux (App, Mail, Mobile), plus les heures calmes (20:00–08:00 par défaut) et le résumé du
 * matin (8 h). Chaque geste s'enregistre tout de suite, sans bouton « Enregistrer ».
 *
 * CE QUI EST VRAI AUJOURD'HUI — à ne pas confondre avec ce que la page affiche.
 * ─────────────────────────────────────────────────────────────────────────────
 *   · Seul le canal « App » AGIT : il filtre la liste de la page ET la pastille de la cloche (`filtrerParReglages`).
 *   · Les canaux « Mail » et « Mobile » sont ENREGISTRÉS (ici, et dans la préférence distante `notifications` du
 *     compte) mais rien ne les lit : il n'existe aucun émetteur d'e-mail ni de notification mobile branché sur
 *     ces choix. `NotificationPrefs` (`src/shared/api.ts`), l'ancien réglage de l'application, est un booléen par
 *     type SANS canal : il n'est ni lu ni modifié ici.
 *   · Les heures calmes, le NIVEAU DE BRUIT (trois crans, v3), « Silence 1 h » et le résumé du matin sont
 *     enregistrés ; leur seul effet est de dire quelles notifications sont RETENUES (`estRetenue`) : l'anneau de la
 *     journée les dessine en pointillé. Rien n'envoie de résumé à 8 h, et la liste de la page garde toutes ses
 *     lignes à toute heure (elle est un registre, pas un canal d'envoi).
 *   · La sécurité garde au moins un canal actif (la dernière case ne se désactive pas) ; en plus, la liste de la page
 *     n'est jamais filtrée pour elle — tant que Mail et Mobile ne partent pas, masquer « App » rendrait l'alerte muette.
 *
 * Stockage : local (`amn.notifications.reglages.<adresse>`) et, en essai, la préférence distante du compte
 * (`bridge().remote.prefs`, clé `notifications`). Aucun secret.
 */
import { CATEGORIES_MATRICE, categorieDe, minutesDuJour, type CategorieMatrice, type CategorieReglage, type Notification } from './modele';

export type Canal = 'app' | 'mail' | 'mobile';
export const CANAUX: readonly Canal[] = ['app', 'mail', 'mobile'];

export const VERSION_REGLAGES = 1;
export const CLE_DISTANTE = 'notifications';
export const cleLocaleReglages = (email: string): string => `amn.notifications.reglages.${email || 'anonyme'}`;

/**
 * Le niveau de bruit (v3, rubrique 6) : « Tout, en direct » ; « L'essentiel » (urgences, paiements et mentions en
 * direct, le reste retenu) ; « Urgences seulement » (tout le reste retenu pour le résumé du matin).
 */
export type NiveauBruit = 'tout' | 'essentiel' | 'urgences';
export const NIVEAUX_BRUIT: readonly NiveauBruit[] = ['tout', 'essentiel', 'urgences'];
/** « Silence 1 h » coupe tout sauf les urgences pendant une heure. */
export const SILENCE_MS = 3_600_000;

export interface ReglagesNotifications {
  v: typeof VERSION_REGLAGES;
  niveau: NiveauBruit;
  /** ISO : la fin d'un « Silence 1 h » en cours, ou `null`. */
  silenceJusqua: string | null;
  canaux: Record<CategorieMatrice, Record<Canal, boolean>>;
  heuresCalmes: { actif: boolean; de: string; a: string };
  resume: { actif: boolean; heure: string };
  /** Les types qu'Ajmani a passés en résumé du matin (« Passer en résumé »). */
  enResume: CategorieMatrice[];
}

/** Les valeurs de la maquette : ce qu'une personne trouve la première fois. */
export function reglagesParDefaut(): ReglagesNotifications {
  return {
    v: VERSION_REGLAGES,
    niveau: 'essentiel',
    silenceJusqua: null,
    canaux: {
      urgent: { app: true, mail: true, mobile: true },
      paiement: { app: true, mail: true, mobile: false },
      securite: { app: true, mail: true, mobile: true },
      mention: { app: true, mail: false, mobile: true },
      'rendez-vous': { app: true, mail: false, mobile: true },
    },
    heuresCalmes: { actif: true, de: '20:00', a: '08:00' },
    resume: { actif: true, heure: '08:00' },
    enResume: [],
  };
}

/* ── Les heures ──────────────────────────────────────────────────────────── */

export const estHeure = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Toutes les demi-heures, de 00:00 à 23:30 : ce que proposent les deux sélecteurs des heures calmes. */
export const HEURES_PROPOSEES: readonly string[] = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** « 08:00 » devient « 8 h », « 08:30 » devient « 8 h 30 » (l'heure du résumé, dite en toutes lettres). */
export function heureEnMots(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/* ── Lecture défensive ───────────────────────────────────────────────────── */

const bool = (v: unknown, defaut: boolean): boolean => (typeof v === 'boolean' ? v : defaut);

/** Remet la règle de sécurité en vigueur : si aucun canal ne reste, l'App est réactivée. */
function garantirSecurite(r: ReglagesNotifications): ReglagesNotifications {
  const s = r.canaux.securite;
  if (s.app || s.mail || s.mobile) return r;
  return { ...r, canaux: { ...r.canaux, securite: { ...s, app: true } } };
}

/** Relit des réglages stockés : tout champ absent ou illisible reprend sa valeur par défaut. */
export function normaliserReglages(brut: unknown): ReglagesNotifications {
  const d = reglagesParDefaut();
  if (!brut || typeof brut !== 'object') return d;
  const r = brut as Record<string, unknown>;
  const canauxBruts = (r.canaux ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const canaux = Object.fromEntries(
    CATEGORIES_MATRICE.map((c) => [c, { app: bool(canauxBruts[c]?.app, d.canaux[c].app), mail: bool(canauxBruts[c]?.mail, d.canaux[c].mail), mobile: bool(canauxBruts[c]?.mobile, d.canaux[c].mobile) }]),
  ) as ReglagesNotifications['canaux'];
  const calmes = (r.heuresCalmes ?? {}) as Record<string, unknown>;
  const resume = (r.resume ?? {}) as Record<string, unknown>;
  return garantirSecurite({
    v: VERSION_REGLAGES,
    niveau: (NIVEAUX_BRUIT as readonly unknown[]).includes(r.niveau) ? (r.niveau as NiveauBruit) : d.niveau,
    silenceJusqua: typeof r.silenceJusqua === 'string' && !Number.isNaN(Date.parse(r.silenceJusqua)) ? r.silenceJusqua : null,
    canaux,
    heuresCalmes: { actif: bool(calmes.actif, d.heuresCalmes.actif), de: estHeure(calmes.de) ? calmes.de : d.heuresCalmes.de, a: estHeure(calmes.a) ? calmes.a : d.heuresCalmes.a },
    resume: { actif: bool(resume.actif, d.resume.actif), heure: estHeure(resume.heure) ? resume.heure : d.resume.heure },
    enResume: Array.isArray(r.enResume) ? (r.enResume.filter((c): c is CategorieMatrice => (CATEGORIES_MATRICE as readonly unknown[]).includes(c))) : [],
  });
}

/* ── Les gestes ──────────────────────────────────────────────────────────── */

/** Un changement d'un seul champ : assez petit pour être défait champ par champ si l'enregistrement échoue. */
export type CheminReglage =
  | `canaux.${CategorieMatrice}.${Canal}`
  | 'heuresCalmes.actif'
  | 'heuresCalmes.de'
  | 'heuresCalmes.a'
  | 'resume.actif'
  | 'niveau'
  /** La fin du silence (ISO), ou `''` pour l'arrêter. */
  | 'silence'
  | `enResume.${CategorieMatrice}`;

export interface ChangementReglage {
  chemin: CheminReglage;
  valeur: boolean | string;
}

export function lireReglage(r: ReglagesNotifications, chemin: CheminReglage): boolean | string {
  const [groupe, a, b] = chemin.split('.');
  switch (groupe) {
    case 'canaux':
      return r.canaux[a as CategorieMatrice][b as Canal];
    case 'heuresCalmes':
      return r.heuresCalmes[a as 'actif' | 'de' | 'a'];
    case 'resume':
      return r.resume.actif;
    case 'niveau':
      return r.niveau;
    case 'silence':
      return r.silenceJusqua ?? '';
    default:
      return r.enResume.includes(a as CategorieMatrice);
  }
}

/** Applique un changement sans rien muter. La règle de sécurité vit ici : voir `peutChanger`. */
export function appliquerChangement(r: ReglagesNotifications, ch: ChangementReglage): ReglagesNotifications {
  const [groupe, a, b] = ch.chemin.split('.');
  switch (groupe) {
    case 'canaux': {
      const categorie = a as CategorieMatrice;
      return { ...r, canaux: { ...r.canaux, [categorie]: { ...r.canaux[categorie], [b]: ch.valeur === true } } };
    }
    case 'heuresCalmes':
      return { ...r, heuresCalmes: { ...r.heuresCalmes, [a]: ch.valeur } };
    case 'resume':
      return { ...r, resume: { ...r.resume, actif: ch.valeur === true } };
    case 'niveau':
      return (NIVEAUX_BRUIT as readonly unknown[]).includes(ch.valeur) ? { ...r, niveau: ch.valeur as NiveauBruit } : r;
    case 'silence':
      return { ...r, silenceJusqua: typeof ch.valeur === 'string' && ch.valeur && !Number.isNaN(Date.parse(ch.valeur)) ? ch.valeur : null };
    default: {
      const categorie = a as CategorieMatrice;
      const sans = r.enResume.filter((c) => c !== categorie);
      return { ...r, enResume: ch.valeur === true ? [...sans, categorie] : sans };
    }
  }
}

/**
 * Le changement est-il permis ? Seule règle : la sécurité garde au moins un canal actif, donc la dernière case
 * allumée de sa ligne ne s'éteint pas (« Les alertes de sécurité restent actives »).
 */
export function peutChanger(r: ReglagesNotifications, ch: ChangementReglage): boolean {
  if (ch.chemin.startsWith('canaux.securite.') && ch.valeur === false) {
    const canal = ch.chemin.split('.')[2] as Canal;
    const autres = CANAUX.filter((c) => c !== canal).some((c) => r.canaux.securite[c]);
    return autres;
  }
  return true;
}

/** Vrai quand la case est la dernière allumée de la sécurité : elle s'affiche verrouillée, avec son info-bulle. */
export function estVerrouillee(r: ReglagesNotifications, categorie: CategorieMatrice, canal: Canal): boolean {
  return categorie === 'securite' && r.canaux.securite[canal] && !peutChanger(r, { chemin: `canaux.securite.${canal}`, valeur: false });
}

/** Les changements de « Passer en résumé » : App et Mobile éteints pour ce type, ajouté au résumé du matin. */
export function changementsPasserEnResume(categorie: CategorieMatrice): ChangementReglage[] {
  return [
    { chemin: `canaux.${categorie}.app`, valeur: false },
    { chemin: `canaux.${categorie}.mobile`, valeur: false },
    { chemin: `enResume.${categorie}`, valeur: true },
  ];
}

/** Le canal « App » de cette ligne est-il actif ? « Activité de l'équipe » n'a pas de ligne : App seulement, toujours actif. */
export function appActif(r: ReglagesNotifications, categorie: CategorieReglage): boolean {
  return categorie === 'activite' ? true : r.canaux[categorie].app;
}

/* ── Ce qui est retenu (l'anneau de la journée, rubrique 6) ───────────────── */

const enMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** La minute `m` (depuis minuit) tombe-t-elle dans les heures calmes ? La plage peut passer minuit (20:00 → 08:00). */
export function dansHeuresCalmes(m: number, de: string, a: string): boolean {
  const debut = enMinutes(de);
  const fin = enMinutes(a);
  if (debut === fin) return false;
  return debut < fin ? m >= debut && m < fin : m >= debut || m < fin;
}

/** Le silence en cours : sa fin, ou `null` (aucun, ou déjà fini). */
export function silenceEnCours(r: ReglagesNotifications, maintenant: Date): Date | null {
  if (!r.silenceJusqua) return null;
  const fin = new Date(r.silenceJusqua);
  return fin.getTime() > maintenant.getTime() ? fin : null;
}

/** Les catégories qui passent toujours : les urgences (tickets urgents, sécurité) ne sont jamais retenues. */
const PASSE_TOUJOURS: readonly CategorieReglage[] = ['urgent', 'securite'];
/** « L'essentiel » laisse passer en plus les paiements et les mentions. */
const PASSE_ESSENTIEL: readonly CategorieReglage[] = ['paiement', 'mention'];

/**
 * La notification a-t-elle été RETENUE (elle attend le résumé du matin au lieu de passer en direct) ? Par les heures
 * calmes à l'heure où elle est arrivée, par un « Silence 1 h » qui la couvrait, ou par le niveau de bruit. Les
 * urgences passent toujours. Calculé avec les réglages d'aujourd'hui (on ne garde pas l'historique des réglages).
 */
export function estRetenue(n: Notification, r: ReglagesNotifications): boolean {
  const categorie = categorieDe(n.type);
  if (n.urgente || PASSE_TOUJOURS.includes(categorie)) return false;
  const quand = new Date(n.date);
  if (r.silenceJusqua) {
    const fin = Date.parse(r.silenceJusqua);
    if (quand.getTime() <= fin && quand.getTime() >= fin - SILENCE_MS) return true;
  }
  if (r.heuresCalmes.actif && dansHeuresCalmes(minutesDuJour(quand), r.heuresCalmes.de, r.heuresCalmes.a)) return true;
  if (r.niveau === 'urgences') return true;
  if (r.niveau === 'essentiel') return !PASSE_ESSENTIEL.includes(categorie);
  return false;
}

/* ── Les types affichés selon les modules ouverts ────────────────────────── */

/** Les modules dont une ligne dépend : la ligne s'affiche si l'un au moins est ouvert ; `null` = toujours. */
export const MODULES_PAR_LIGNE: Readonly<Record<CategorieMatrice, readonly string[] | null>> = {
  urgent: ['tasks', 'projects'],
  paiement: ['invoices'],
  securite: null,
  mention: ['dm'],
  'rendez-vous': ['agenda'],
};

/** Les lignes de la matrice qu'un métier voit : un métier sans facturation ne voit pas « Paiements ». */
export function lignesVisibles(moduleOuvert: (module: string) => boolean): CategorieMatrice[] {
  return CATEGORIES_MATRICE.filter((c) => {
    const modules = MODULES_PAR_LIGNE[c];
    return modules === null || modules.some(moduleOuvert);
  });
}

/* ── Stockage ────────────────────────────────────────────────────────────── */

type Stockage = Pick<Storage, 'getItem' | 'setItem'>;

export function lireReglagesLocaux(stockage: Stockage | null, email: string): ReglagesNotifications {
  try {
    const brut = stockage?.getItem(cleLocaleReglages(email));
    return brut ? normaliserReglages(JSON.parse(brut)) : reglagesParDefaut();
  } catch {
    return reglagesParDefaut();
  }
}

/** Un stockage refusé (navigation privée, quota) ne casse rien : le choix vaut jusqu'au rechargement. */
export function ecrireReglagesLocaux(stockage: Stockage | null, email: string, r: ReglagesNotifications): void {
  try {
    stockage?.setItem(cleLocaleReglages(email), JSON.stringify(r));
  } catch {
    /* le réglage reste en mémoire */
  }
}
