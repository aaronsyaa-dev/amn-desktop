/**
 * MR01 · VIDÉO — logique pure (étapes, frise de montage, relecture, série hebdomadaire).
 *
 * Règles de la fiche MR01, rubrique 6. La frise est EN LECTURE tant que le dépôt n'a
 * pas de moteur de montage : tout ce qui suit calcule sans rien couper.
 */

import { ajouterJours, borner, ecartJours, formaterNombre, jourDeSemaine, lundiDe, INSECABLE, type Jour } from './commun';

/** Étapes (Proposition) : Idée → Enregistrement → Montage → Sous-titrage → Relecture → Publiée. */
export const ETAPES_VIDEO = ['Idée', 'Enregistrement', 'Montage', 'Sous-titrage', 'Relecture', 'Publiée'] as const;
export type EtapeVideo = (typeof ETAPES_VIDEO)[number];

/** Les jeux fictifs disent « Tournage » : même étape que « Enregistrement ». */
export function etapeNormalisee(brute: string): EtapeVideo {
  const t = brute === 'Tournage' ? 'Enregistrement' : brute;
  return (ETAPES_VIDEO as readonly string[]).includes(t) ? (t as EtapeVideo) : 'Idée';
}

export interface VideoEntree {
  id: string;
  titre: string;
  etape: string;
  /** 0–100. 100 seulement à « Publiée ». */
  avancement: number;
  prevueLe?: Jour | null;
  publieeLe?: Jour | null;
  vues?: number;
  lienPublication?: string | null;
  dureeSec?: number;
}

/** « 3 en cours » : ni publiées, ni à l'état d'idée. */
export function videosEnCours<T extends VideoEntree>(videos: readonly T[]): T[] {
  return videos.filter((v) => { const e = etapeNormalisee(v.etape); return e !== 'Publiée' && e !== 'Idée'; });
}

/** L'avancement ne peut atteindre 100 % qu'à « Publiée ». */
export function avancementVideo(v: VideoEntree): number {
  return etapeNormalisee(v.etape) === 'Publiée' ? 100 : Math.min(99, Math.round(borner(v.avancement, 0, 100)));
}

/** Nombre de vues : « 12 400 vues » (espace insécable), « 1 vue ». */
export function vuesLibelle(n: number, un = 'vue', plusieurs = 'vues'): string {
  return `${formaterNombre(n, { decimales: 0 })}${INSECABLE}${n >= 2 ? plusieurs : un}`;
}

export type LigneEtat = { type: 'vues'; vues: number } | { type: 'prochaine'; etape: EtapeVideo; le: Jour } | { type: 'etape'; etape: EtapeVideo };

/**
 * Ligne d'état de la liste : le nombre de vues d'une vidéo publiée, ou la prochaine
 * action datée (« À tourner mardi »), ou le nom de l'étape. Une vidéo non publiée n'a pas de vues.
 */
export function ligneEtat(v: VideoEntree): LigneEtat {
  const etape = etapeNormalisee(v.etape);
  if (etape === 'Publiée') return { type: 'vues', vues: v.vues ?? 0 };
  if (v.prevueLe && (etape === 'Idée' || etape === 'Enregistrement')) return { type: 'prochaine', etape, le: v.prevueLe };
  return { type: 'etape', etape };
}

export interface SousTitre {
  /** « presque prête » à partir de 80 %, sinon « en <étape> ». */
  etat: { type: 'presque-prete' } | { type: 'en-etape'; etape: EtapeVideo };
  retoursATraiter: number;
}
export const SEUIL_PRESQUE_PRETE = 80;
export function sousTitreDePage(v: VideoEntree, retours: readonly Commentaire[]): SousTitre {
  const etat = avancementVideo(v) >= SEUIL_PRESQUE_PRETE ? ({ type: 'presque-prete' } as const) : ({ type: 'en-etape', etape: etapeNormalisee(v.etape) } as const);
  return { etat, retoursATraiter: retours.filter((c) => c.etat === 'À traiter').length };
}

/* -------- Frise de montage -------- */

export interface Plan { id: string; debut: number; fin: number; rush?: string }
export interface SousTitreLigne { debut: number; fin: number; texte: string }
export interface PisteAudio { type: 'voix' | 'musique'; niveauDb: number }

export type ZoomFrise = 'tout' | '30s' | '10s';
export const FENETRE_ZOOM_SEC: Record<Exclude<ZoomFrise, 'tout'>, number> = { '30s': 30, '10s': 10 };

/** Échelle : px par seconde = largeur de la zone de pistes ÷ durée visible. */
export const echelle = (largeurPx: number, dureeVisibleSec: number): number => (dureeVisibleSec > 0 ? largeurPx / dureeVisibleSec : 0);

/**
 * Fenêtre visible de la frise. « Tout » montre la vidéo entière ; « 30 s » et « 10 s »
 * zooment autour de la tête de lecture, sans sortir de [0, durée].
 */
export function fenetreVisible(zoom: ZoomFrise, tete: number, duree: number): { debut: number; fin: number } {
  if (zoom === 'tout' || duree <= 0) return { debut: 0, fin: Math.max(0, duree) };
  const largeur = Math.min(FENETRE_ZOOM_SEC[zoom], duree);
  const debut = borner(tete - largeur / 2, 0, duree - largeur);
  return { debut, fin: debut + largeur };
}

/** Position horizontale (px) d'un instant dans la fenêtre visible. */
export const positionPx = (sec: number, fenetre: { debut: number; fin: number }, largeurPx: number): number =>
  (sec - fenetre.debut) * echelle(largeurPx, fenetre.fin - fenetre.debut);

/** « Plan sélectionné » = le plan sous la tête de lecture (début compris, fin exclue). */
export const planSousLaTete = (plans: readonly Plan[], tete: number): Plan | null => plans.find((p) => tete >= p.debut && tete < p.fin) ?? null;

/** Code temporel « 01:24 ». */
export function codeTemporel(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** La musique baisse automatiquement sous la voix off (Proposition : −10 dB). */
export const BAISSE_SOUS_VOIX_DB = 10;
export const niveauMusiqueEffectif = (niveauDb: number, voixActive: boolean): number => (voixActive ? niveauDb - BAISSE_SOUS_VOIX_DB : niveauDb);

/* -------- Relecture -------- */

export interface Commentaire {
  id: string;
  auteur: string;
  /** Code temporel en secondes. */
  t: number;
  texte: string;
  etat: 'À traiter' | 'Traité';
}

/** « 1 sur 3 traité » : commentaires traités sur le total de la version ouverte. */
export function compteRelecture(commentaires: readonly Commentaire[]): { traites: number; total: number } {
  return { traites: commentaires.filter((c) => c.etat === 'Traité').length, total: commentaires.length };
}

/** Marqueurs posés sur la règle : orange si à traiter, vert si traité, dans l'ordre du temps. */
export function marqueursDeRegle(commentaires: readonly Commentaire[]): { id: string; t: number; ton: 'orange' | 'vert' }[] {
  return [...commentaires].sort((a, b) => a.t - b.t).map((c) => ({ id: c.id, t: c.t, ton: c.etat === 'À traiter' ? 'orange' : 'vert' }));
}

/* -------- Enregistrement automatique -------- */

export type Enregistre = { type: 'instant' } | { type: 'minutes'; n: number } | { type: 'heures'; n: number } | { type: 'jours'; n: number };

/** « Enregistré à l'instant » puis « il y a 2 min », « il y a 3 h »… */
export function enregistreIl(dernierMs: number, maintenantMs: number): Enregistre {
  const s = Math.max(0, (maintenantMs - dernierMs) / 1000);
  if (s < 60) return { type: 'instant' };
  if (s < 3600) return { type: 'minutes', n: Math.floor(s / 60) };
  if (s < 86400) return { type: 'heures', n: Math.floor(s / 3600) };
  return { type: 'jours', n: Math.floor(s / 86400) };
}

/* -------- Série « Une vidéo par semaine » -------- */

export interface CaseSemaine {
  /** Lundi de la semaine civile. */
  debut: Jour;
  cochee: boolean;
  /** La semaine en cours n'est jamais comptée comme manquée. */
  enCours: boolean;
}

/** Les 6 dernières semaines civiles, la plus récente à droite ; une case cochée par semaine avec au moins une publication. */
export function serieUneVideoParSemaine(publications: readonly Jour[], aujourdhui: Jour, n = 6): { cases: CaseSemaine[]; faites: number } {
  const lundi = lundiDe(aujourdhui);
  const cases: CaseSemaine[] = [];
  for (let k = n - 1; k >= 0; k -= 1) {
    const debut = ajouterJours(lundi, -7 * k);
    const fin = ajouterJours(debut, 6);
    cases.push({ debut, cochee: publications.some((p) => p >= debut && p <= fin), enCours: k === 0 });
  }
  return { cases, faites: cases.filter((c) => c.cochee).length };
}

/* -------- Publication -------- */

export interface DroitsVideo { ecrire: boolean; publier: boolean; enLigne: boolean }

/** Hors ligne ou sans droit de publier : « Préparer la publication » est désactivé (raison donnée). */
export function publicationPossible(d: DroitsVideo): { ok: true } | { ok: false; raison: 'hors-ligne' | 'droit' } {
  if (!d.enLigne) return { ok: false, raison: 'hors-ligne' };
  if (!d.publier) return { ok: false, raison: 'droit' };
  return { ok: true };
}

/**
 * Ce qui devient public après confirmation, et ce qui reste privé. Rushes, versions de
 * travail, commentaires, noms des collègues et statistiques ne sortent jamais.
 */
export const PUBLIC_APRES_CONFIRMATION = ['titre', 'description', 'miniature', 'sous-titres', 'video-publiee'] as const;
export const TOUJOURS_PRIVE = ['rushes', 'versions-de-travail', 'commentaires', 'noms-des-collegues', 'statistiques'] as const;

/** Nombre de jours depuis la dernière publication (pour une remarque douce, jamais un reproche). */
export function joursDepuisDernierePublication(publications: readonly Jour[], aujourdhui: Jour): number | null {
  const derniere = [...publications].sort().pop();
  return derniere ? ecartJours(derniere, aujourdhui) : null;
}

/** Jour de la semaine du tournage prévu (0 = lundi) : « À tourner mardi ». */
export const jourDeTournage = (le: Jour): number => jourDeSemaine(le);
