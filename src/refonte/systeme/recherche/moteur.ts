import type { Famille } from '../../../socle/familles';
import { aplatir, chercher } from '../../navigation/recherche';

/**
 * LE MOTEUR DE LA RECHERCHE ⌘K — pur, sans React, sans stockage, sans horloge.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Il reçoit ce qu'on a tapé, un index (des entrées déjà construites : voir
 * `construire.ts`) et un contexte (récents, fréquents, hors ligne, actions de la
 * page), et rend des GROUPES de lignes prêtes à afficher. Rien ici ne connaît
 * un nom de client ni une page : tout vient de l'index.
 *
 * ## Comment une entrée est jugée
 *
 * Le texte tapé est aplati (sans accent, sans casse, sans ponctuation : le même
 * `aplatir` que la navigation) et coupé en mots. Chaque mot tapé est comparé aux
 * mots du libellé, et prend le meilleur de trois niveaux :
 *
 *   exact       le mot est un mot du libellé (le pluriel est toléré) ;
 *   début       le mot est le début d'un mot du libellé (« orch » → « Orchidée ») ;
 *   approximatif  une ou deux fautes de frappe (« orcidée » → « Orchidée »), pour les
 *               mots de 4 lettres et plus seulement : en dessous, une faute
 *               change de mot.
 *
 * L'entrée prend le niveau de son mot le plus faible : « orchidée cons » est un
 * début, « orchidée konseil » est approximatif. Un libellé pèse plus que ce qui
 * l'accompagne (société, adresse, numéro), qui pèse plus que le corps d'une
 * note (jamais approximatif : un texte long trouverait tout).
 *
 * ## L'ordre
 *
 * Niveau d'abord ; à égalité, ce qu'on a ouvert récemment, puis ce qu'on ouvre
 * souvent, puis le type (le client avant sa facture), puis la modification la
 * plus récente. Les pages passent par `chercher` (src/refonte/navigation) — qui
 * connaît leurs verbes et leurs mots-clés — et, quand elle ne trouve rien, par
 * la tolérance aux fautes d'ici.
 */

/* ─────────────────────────────── Types ─────────────────────────────── */

export type TypeResultat = 'client' | 'contact' | 'devis' | 'facture' | 'document' | 'decision' | 'tache' | 'note' | 'message' | 'page';

export const TYPES_RESULTAT: readonly TypeResultat[] = ['client', 'contact', 'devis', 'facture', 'document', 'decision', 'tache', 'note', 'message', 'page'];

/** À égalité de niveau, le type le plus à gauche passe devant. */
const ORDRE_TYPES: Readonly<Record<TypeResultat, number>> = {
  client: 0,
  contact: 1,
  devis: 2,
  facture: 3,
  document: 4,
  decision: 5,
  tache: 6,
  note: 7,
  message: 8,
  page: 9,
};

export interface EntreeIndex {
  /** Unique : `type:identifiant`. C'est ce que la mémoire des récents garde. */
  cle: string;
  type: TypeResultat;
  /** Ce qui s'affiche. */
  libelle: string;
  /** Ce qui aide à trouver sans s'afficher : société, adresse, numéro, verbes d'une page. */
  aussi?: readonly string[];
  /** Le texte d'une note : cherché en dernier recours, jamais affiché. */
  corps?: string;
  route: string;
  /** Le `location.state` du lien profond existant (`focusClientId`, `openTaskId`…). */
  state?: Readonly<Record<string, unknown>>;
  /** La famille du module de destination : elle colore la tuile. */
  famille: Famille;
  /** Dernière modification, en millisecondes. */
  maj?: number;
  /** Pour une page : la clé du module au catalogue (ce que `chercher` attend). */
  module?: string;
  /** Pour une page : une ligne d'indice (`hint` du catalogue). */
  indice?: string;
  /** Pour un client : le nom de la personne, et son adresse si elle est valide. */
  contact?: string;
  courriel?: string;
}

/** Un verbe du registre : « Envoyer une facture », qui mène à la page qui le porte. */
export interface ActionIndex {
  cle: string;
  libelle: string;
  famille: Famille;
  route: string;
  aussi?: readonly string[];
}

export interface Index {
  entrees: readonly EntreeIndex[];
  actions: readonly ActionIndex[];
}

/** Ce que la page courante propose (ex. « Nouvelle tâche »). L'exécution reste à l'hôte. */
export interface ActionPageDecl {
  id: string;
  libelle: string;
  famille?: Famille;
  /** Vrai : grisée hors ligne, avec une info-bulle. */
  exigeReseau?: boolean;
}

export type Cible =
  | { k: 'ajmani'; texte: string }
  | { k: 'aller'; route: string; state?: Readonly<Record<string, unknown>> }
  | { k: 'lien'; href: string }
  | { k: 'page'; id: string };

export type IconeLigne = 'ajmani' | 'devis' | 'ecrire' | 'action' | TypeResultat;

export interface LigneRecherche {
  cle: string;
  genre: 'action' | 'resultat';
  libelle: string;
  famille: Famille | 'ajmani';
  icone: IconeLigne;
  type?: TypeResultat;
  module?: string;
  cible: Cible;
  /** Vrai : visible mais sans effet (une action qui exige le réseau, hors ligne). */
  grise: boolean;
}

export interface GroupeRecherche {
  id: 'recents' | 'actions' | 'resultats';
  lignes: LigneRecherche[];
}

export interface ReponseRecherche {
  mode: 'vide' | 'recherche' | 'actions';
  /** Ce que la personne a tapé, sans le « > » du mode actions. */
  saisie: string;
  groupes: GroupeRecherche[];
  /** Le nombre de lignes, toutes ensemble. */
  total: number;
  /** Mode recherche, et aucun élément ni page ne correspond. */
  aucunResultat: boolean;
  /** Dans ce cas, l'élément le plus proche (« Vouliez-vous dire … ? »), s'il y en a un. */
  proche: LigneRecherche | null;
}

/** Les phrases que le moteur compose : la langue est celle de l'appelant. */
export interface TextesMoteur {
  ajmaniGenerique: (texte: string) => string;
  ajmaniClient: (nom: string) => string;
  /** Ce qu'on envoie vraiment à Ajmani quand la saisie désigne un client. */
  ajmaniClientDemande: (nom: string) => string;
  devis: (nom: string) => string;
  ecrire: (nom: string) => string;
}

export interface ContexteRecherche {
  textes: TextesMoteur;
  /** Les clés des éléments ouverts récemment, le plus récent d'abord. */
  recents?: readonly string[];
  /** Combien de fois chaque clé a été ouverte. */
  frequences?: Readonly<Record<string, number>>;
  horsLigne?: boolean;
  actionsPage?: readonly ActionPageDecl[];
  /** Lignes par groupe (5 par défaut). */
  plafond?: number;
}

/* ─────────────────────────────── Constantes ─────────────────────────────── */

export const PLAFOND_PAR_GROUPE = 5;
/** Le mode « > » montre toutes les actions : le plafond y est plus haut, la liste défile. */
export const PLAFOND_MODE_ACTIONS = 30;
export const TAILLE_RECENTS = 5;
/** Un mot de moins de 4 lettres ne se corrige pas : une faute en ferait un autre mot. */
export const LONGUEUR_MIN_FLOU = 4;

const MOTS_VIDES = new Set(['un', 'une', 'des', 'le', 'la', 'les', 'de', 'du', 'd', 'l', 'et', 'ou', 'au', 'aux', 'en', 'a']);

/* Le score d'une entrée : un niveau, pesé selon le champ qui l'a donné. */
const POIDS_LIBELLE = [0, 400, 700, 900] as const;
const POIDS_AUSSI = [0, 300, 540, 640] as const;
const POIDS_CORPS = [0, 0, 200, 300] as const;
/** Sous ce score, une saisie ne « désigne » pas un client (une approximation ne suffit pas). */
const SCORE_DESIGNE = 540;

type Niveau = 0 | 1 | 2 | 3;

/* ─────────────────────────────── Texte ─────────────────────────────── */

/** Les mots d'un texte, aplatis (sans accent, sans casse, sans ponctuation). */
export function motsDe(texte: string): string[] {
  return aplatir(texte).split(' ').filter(Boolean);
}

function motsRequete(texte: string): string[] {
  const tous = motsDe(texte);
  const utiles = tous.filter((m) => !MOTS_VIDES.has(m));
  return utiles.length > 0 ? utiles : tous;
}

const singulier = (m: string): string => (m.length > 3 && /[sx]$/.test(m) ? m.slice(0, -1) : m);

/**
 * La distance d'édition (Damerau, transposition d'une paire comprise), bornée :
 * au-delà de `max`, elle rend `max + 1` sans finir le calcul.
 */
export function distanceEdition(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (la === 0 || lb === 0) return Math.max(la, lb);
  let avantPrecedente: number[] = [];
  let precedente = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i += 1) {
    const courante = [i];
    let plusPetit = i;
    for (let j = 1; j <= lb; j += 1) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, avantPrecedente[j - 2] + 1);
      courante[j] = v;
      if (v < plusPetit) plusPetit = v;
    }
    if (plusPetit > max) return max + 1;
    avantPrecedente = precedente;
    precedente = courante;
  }
  return Math.min(precedente[lb], max + 1);
}

/** Combien de fautes on pardonne à un mot tapé : 1 jusqu'à 7 lettres, 2 au-delà. */
export function toleranceDe(mot: string): number {
  if (mot.length < LONGUEUR_MIN_FLOU) return 0;
  return mot.length >= 8 ? 2 : 1;
}

/**
 * Le mot tapé est-il, à une ou deux fautes près, ce mot ou son début ? On compare au mot entier et à ses
 * débuts de même longueur (à une lettre près) : « orcid » est à une faute de « orchi », le début de « orchidée ».
 *
 * Jamais pour un nombre ni un mot qui en contient un : « 2031 » et « 2032 » sont deux factures, pas une faute.
 * Le résultat est gardé (mot tapé, mot de l'index) : un mot revient dans des centaines de libellés.
 */
const MEMO_FLOU = new Map<string, boolean>();
const MEMO_FLOU_MAX = 60000;

function flou(tape: string, mot: string): boolean {
  const k = toleranceDe(tape);
  if (k === 0 || mot.length < LONGUEUR_MIN_FLOU || /\d/.test(tape) || /\d/.test(mot)) return false;
  const cle = `${tape}|${mot}`;
  const connu = MEMO_FLOU.get(cle);
  if (connu !== undefined) return connu;
  const l = tape.length;
  let ok = false;
  for (const c of [mot, mot.slice(0, l), mot.slice(0, l - 1), mot.slice(0, l + 1)]) {
    if (c.length >= 3 && distanceEdition(tape, c, k) <= k) {
      ok = true;
      break;
    }
  }
  if (MEMO_FLOU.size >= MEMO_FLOU_MAX) MEMO_FLOU.clear();
  MEMO_FLOU.set(cle, ok);
  return ok;
}

function niveauMot(tape: string, cible: readonly string[], avecFlou: boolean): Niveau {
  const s = singulier(tape);
  let meilleur: Niveau = 0;
  for (const mot of cible) {
    if (mot === tape || singulier(mot) === s) return 3;
    if (meilleur < 2 && (mot.startsWith(tape) || (s !== tape && mot.startsWith(s)))) meilleur = 2;
    else if (meilleur < 1 && avecFlou && flou(tape, mot)) meilleur = 1;
  }
  return meilleur;
}

/** Le niveau d'un texte pour une saisie : celui du mot tapé qui s'y retrouve le moins bien (0 s'il en manque un). */
function evaluer(requete: readonly string[], cible: readonly string[], avecFlou = true): Niveau {
  if (requete.length === 0 || cible.length === 0) return 0;
  let plusFaible: Niveau = 3;
  for (const tape of requete) {
    const n = niveauMot(tape, cible, avecFlou);
    if (n === 0) return 0;
    if (n < plusFaible) plusFaible = n;
  }
  return plusFaible;
}

/* ─────────────────────────────── Index normalisé ─────────────────────────────── */

interface Normalise {
  libelle: string[];
  aussi: string[];
  /** Le libellé et ce qui l'accompagne : une saisie à plusieurs mots peut s'y répartir. */
  tout: string[];
  corps: string[];
}

const NORMALISES = new WeakMap<object, Normalise>();

/** Les mots d'une entrée, calculés une fois (l'index est mémoïsé, la frappe ne le refait pas). */
function normalise(e: EntreeIndex | ActionIndex): Normalise {
  let n = NORMALISES.get(e);
  if (!n) {
    const libelle = motsDe(e.libelle);
    const aussi = (e.aussi ?? []).flatMap(motsDe);
    n = { libelle, aussi, tout: [...libelle, ...aussi], corps: 'corps' in e && e.corps ? motsDe(e.corps.slice(0, 2000)) : [] };
    NORMALISES.set(e, n);
  }
  return n;
}

/** Prépare les mots de tout l'index (à l'ouverture, hors du chemin de la frappe) : la première recherche n'a plus à le faire. */
export function prechauffer(index: Index): void {
  for (const e of index.entrees) normalise(e);
  for (const a of index.actions) normalise(a);
}

/** Le score d'une entrée pour une saisie, ou 0. */
function noter(requete: readonly string[], e: EntreeIndex | ActionIndex): number {
  const n = normalise(e);
  let score = 0;
  const l = evaluer(requete, n.libelle);
  if (l > 0) score = POIDS_LIBELLE[l];
  if (n.aussi.length > 0) {
    const a = evaluer(requete, n.tout);
    if (a > 0) score = Math.max(score, POIDS_AUSSI[a]);
  }
  if (n.corps.length > 0) {
    const c = evaluer(requete, n.corps, false);
    if (c > 0) score = Math.max(score, POIDS_CORPS[c]);
  }
  return score;
}

/** Les pages : le score de `chercher` (25 à 120) ramené aux mêmes bandes que le reste. */
function bandePage(scoreChercher: number): number {
  if (scoreChercher >= 105) return POIDS_LIBELLE[3];
  if (scoreChercher >= 80) return POIDS_LIBELLE[2];
  if (scoreChercher >= 40) return 500;
  return 350;
}

/* ─────────────────────────────── Saisie ─────────────────────────────── */

/** « > » en première position : seules les actions comptent, filtrées par ce qui suit. */
export function analyserSaisie(brut: string): { mode: ReponseRecherche['mode']; texte: string } {
  const debut = brut.trimStart();
  if (debut.startsWith('>')) return { mode: 'actions', texte: debut.slice(1).trim() };
  const texte = brut.trim();
  return { mode: texte ? 'recherche' : 'vide', texte };
}

/** Une adresse qu'on peut mettre dans un `mailto:` sans rien y glisser d'autre. */
export function courrielValide(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && valeur.length <= 254 && /^[^\s@<>"',;?&=]+@[^\s@<>"',;?&=]+\.[^\s@<>"',;?&=]+$/.test(valeur);
}

export function lienCourriel(courriel: string): string {
  return `mailto:${encodeURIComponent(courriel).replace(/%40/g, '@')}`;
}

/* ─────────────────────────────── Lignes ─────────────────────────────── */

function ligneDeEntree(e: EntreeIndex): LigneRecherche {
  return {
    cle: e.cle,
    genre: 'resultat',
    libelle: e.libelle,
    famille: e.famille,
    icone: e.type,
    type: e.type,
    module: e.module,
    cible: { k: 'aller', route: e.route, state: e.state },
    grise: false,
  };
}

function ligneDeAction(a: ActionIndex): LigneRecherche {
  return { cle: a.cle, genre: 'action', libelle: a.libelle, famille: a.famille, icone: 'action', cible: { k: 'aller', route: a.route }, grise: false };
}

function ligneDeActionPage(a: ActionPageDecl, horsLigne: boolean): LigneRecherche {
  return { cle: `page-action:${a.id}`, genre: 'action', libelle: a.libelle, famille: a.famille ?? 'outils', icone: 'action', cible: { k: 'page', id: a.id }, grise: horsLigne && Boolean(a.exigeReseau) };
}

function ligneAjmani(saisie: string, ctx: ContexteRecherche, client: EntreeIndex | null): LigneRecherche {
  return {
    cle: 'action:ajmani',
    genre: 'action',
    libelle: client ? ctx.textes.ajmaniClient(client.libelle) : ctx.textes.ajmaniGenerique(saisie),
    famille: 'ajmani',
    icone: 'ajmani',
    cible: { k: 'ajmani', texte: client ? ctx.textes.ajmaniClientDemande(client.libelle) : saisie },
    grise: false,
  };
}

/* ─────────────────────────────── Index : accès ─────────────────────────────── */

const PAR_CLE = new WeakMap<readonly EntreeIndex[], Map<string, EntreeIndex>>();

function parCle(index: Index): Map<string, EntreeIndex> {
  let m = PAR_CLE.get(index.entrees);
  if (!m) {
    m = new Map(index.entrees.map((e) => [e.cle, e]));
    PAR_CLE.set(index.entrees, m);
  }
  return m;
}

/** Les éléments ouverts récemment qui existent (et sont permis) encore : un récent ne contourne jamais l'index. */
export function recentsResolus(index: Index, recents: readonly string[], max = TAILLE_RECENTS): EntreeIndex[] {
  const m = parCle(index);
  const vus = new Set<string>();
  const sortie: EntreeIndex[] = [];
  for (const cle of recents) {
    const e = m.get(cle);
    if (!e || vus.has(cle)) continue;
    vus.add(cle);
    sortie.push(e);
    if (sortie.length >= max) break;
  }
  return sortie;
}

/* ─────────────────────────────── La recherche ─────────────────────────────── */

interface Trouve {
  entree: EntreeIndex;
  score: number;
  /** Le score de `chercher`, pour départager deux pages de même bande. */
  finesse: number;
  /** Sa place parmi les récents (le plus récent : 0), ou l'infini. */
  recent: number;
  frequence: number;
}

const COLLATEUR = new Intl.Collator('fr');

function comparer(a: Trouve, b: Trouve): number {
  return (
    b.score - a.score ||
    a.recent - b.recent ||
    b.frequence - a.frequence ||
    b.finesse - a.finesse ||
    ORDRE_TYPES[a.entree.type] - ORDRE_TYPES[b.entree.type] ||
    (b.entree.maj ?? 0) - (a.entree.maj ?? 0) ||
    COLLATEUR.compare(a.entree.libelle, b.entree.libelle)
  );
}

/** Les éléments et pages qui répondent à la saisie, du meilleur au moins bon (sans plafond). */
export function classer(texte: string, entrees: readonly EntreeIndex[], ctx: ContexteRecherche): { entree: EntreeIndex; score: number }[] {
  const requete = motsRequete(texte);
  if (requete.length === 0) return [];
  const trouves: Trouve[] = [];
  const rang = new Map((ctx.recents ?? []).map((cle, i) => [cle, i]));
  const frequences = ctx.frequences ?? {};
  const trouve = (entree: EntreeIndex, score: number, finesse: number) =>
    trouves.push({ entree, score, finesse, recent: rang.get(entree.cle) ?? Infinity, frequence: frequences[entree.cle] ?? 0 });

  // Les pages d'abord : `chercher` connaît leurs verbes et leurs mots-clés.
  const pages = entrees.filter((e) => e.type === 'page' && e.module);
  const parModule = new Map(pages.map((p) => [p.module as string, p]));
  const parIntention = chercher(texte, pages.map((p) => ({ key: p.module as string, label: p.libelle, hint: p.indice })));
  for (const t of parIntention) {
    const entree = parModule.get(t.item.key);
    if (entree) trouve(entree, bandePage(t.score), t.score);
  }
  // Repli : `chercher` ne trouve rien, la tolérance aux fautes prend le relais.
  if (parIntention.length === 0) {
    for (const entree of pages) {
      const score = noter(requete, entree);
      if (score > 0) trouve(entree, score, 0);
    }
  }

  for (const entree of entrees) {
    if (entree.type === 'page') continue;
    const score = noter(requete, entree);
    if (score > 0) trouve(entree, score, 0);
  }

  return trouves.sort(comparer).map(({ entree, score }) => ({ entree, score }));
}

/**
 * L'élément le plus proche d'une saisie qui ne trouve rien : une tolérance plus large que la recherche
 * (3 fautes pour un mot de 7 lettres ou plus, 2 sinon), pour le « Vouliez-vous dire … ? » de l'état vide.
 */
export function procheDe(texte: string, entrees: readonly EntreeIndex[]): EntreeIndex | null {
  const requete = motsRequete(texte).filter((m) => m.length >= LONGUEUR_MIN_FLOU && !/\d/.test(m));
  if (requete.length === 0) return null;
  const memo = new Map<string, number>();
  /** La plus petite distance du mot tapé à un mot (ou à son début), au-delà de `k` : `k + 1`. */
  const distance = (tape: string, mot: string, k: number): number => {
    const l = tape.length;
    if (mot.length < 3 || mot.length + k < l || /\d/.test(mot)) return k + 1;
    const cle = `${tape}|${mot}`;
    let d = memo.get(cle);
    if (d === undefined) {
      d = k + 1;
      for (const c of new Set([mot, mot.slice(0, l), mot.slice(0, l - 1), mot.slice(0, l + 1)])) if (c.length >= 3) d = Math.min(d, distanceEdition(tape, c, k));
      memo.set(cle, d);
    }
    return d;
  };
  let meilleur: { e: EntreeIndex; d: number } | null = null;
  for (const e of entrees) {
    const mots = normalise(e).libelle;
    let total = 0;
    let ok = true;
    for (const tape of requete) {
      const k = tape.length >= 7 ? 3 : 2;
      let plusProche = k + 1;
      for (const mot of mots) plusProche = Math.min(plusProche, distance(tape, mot, k));
      if (plusProche > k) {
        ok = false;
        break;
      }
      total += plusProche;
    }
    if (ok && (!meilleur || total < meilleur.d || (total === meilleur.d && ORDRE_TYPES[e.type] < ORDRE_TYPES[meilleur.e.type]))) meilleur = { e, d: total };
  }
  return meilleur?.e ?? null;
}

/** Les actions des verbes du registre qui répondent au texte (vide : toutes, dans l'ordre du registre). */
function actionsFiltrees(texte: string, index: Index, ctx: ContexteRecherche): LigneRecherche[] {
  const horsLigne = Boolean(ctx.horsLigne);
  const requete = motsRequete(texte);
  const deLaPage = (ctx.actionsPage ?? []).filter((a) => requete.length === 0 || evaluer(requete, motsDe(a.libelle)) > 0).map((a) => ligneDeActionPage(a, horsLigne));
  if (requete.length === 0) return [...deLaPage, ...index.actions.map(ligneDeAction)];
  const notees = index.actions
    .map((a, rang) => ({ a, rang, score: noter(requete, a) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.rang - y.rang);
  return [...deLaPage, ...notees.map((x) => ligneDeAction(x.a))];
}

/** Les actions déduites du meilleur client trouvé (la fiche, l'écriture) : de la navigation et de la lecture, jamais une écriture. */
function actionsDuClient(client: EntreeIndex, ctx: ContexteRecherche): LigneRecherche[] {
  const lignes: LigneRecherche[] = [
    // La création d'un devis prérempli n'existe pas encore : on ouvre la fiche, d'où il se crée.
    { cle: `action:devis:${client.cle}`, genre: 'action', libelle: ctx.textes.devis(client.libelle), famille: 'argent', icone: 'devis', cible: { k: 'aller', route: client.route, state: client.state }, grise: false },
  ];
  if (client.courriel && courrielValide(client.courriel)) {
    lignes.push({ cle: `action:ecrire:${client.cle}`, genre: 'action', libelle: ctx.textes.ecrire(client.contact || client.libelle), famille: 'echanger', icone: 'ecrire', cible: { k: 'lien', href: lienCourriel(client.courriel) }, grise: false });
  }
  return lignes;
}

function reponse(mode: ReponseRecherche['mode'], saisie: string, groupes: GroupeRecherche[], extra: Partial<Pick<ReponseRecherche, 'aucunResultat' | 'proche'>> = {}): ReponseRecherche {
  const gardes = groupes.filter((g) => g.lignes.length > 0);
  return { mode, saisie, groupes: gardes, total: gardes.reduce((n, g) => n + g.lignes.length, 0), aucunResultat: extra.aucunResultat ?? false, proche: extra.proche ?? null };
}

/**
 * LA FONCTION : ce qu'on a tapé → des groupes de lignes.
 *
 *   saisie vide  « RÉCENTS » (5 derniers éléments ouverts) puis « ACTIONS » (celles de la page courante) ;
 *   « > texte »  « ACTIONS » seulement : toutes celles de l'application, filtrées par le texte ;
 *   texte        « ACTIONS » (Demander à Ajmani d'abord, toujours ; puis celles du meilleur client et de la page)
 *                puis « CLIENTS ET PAGES » (au plus 5 par groupe).
 *
 * Hors ligne, seuls les pages et les éléments récents sont proposés.
 */
export function rechercher(brut: string, index: Index, ctx: ContexteRecherche): ReponseRecherche {
  const { mode, texte } = analyserSaisie(brut);
  const plafond = ctx.plafond ?? PLAFOND_PAR_GROUPE;
  const horsLigne = Boolean(ctx.horsLigne);

  if (mode === 'vide') {
    const recents = recentsResolus(index, ctx.recents ?? []).map(ligneDeEntree);
    const actions = (ctx.actionsPage ?? []).slice(0, plafond).map((a) => ligneDeActionPage(a, horsLigne));
    return reponse('vide', '', [{ id: 'recents', lignes: recents }, { id: 'actions', lignes: actions }]);
  }

  if (mode === 'actions') {
    const lignes = actionsFiltrees(texte, index, ctx);
    const ajmani = texte ? [ligneAjmani(texte, ctx, null)] : [];
    return reponse('actions', texte, [{ id: 'actions', lignes: [...ajmani, ...lignes].slice(0, PLAFOND_MODE_ACTIONS) }]);
  }

  // Hors ligne : les pages et ce qu'on a ouvert récemment, rien d'autre.
  const permises = horsLigne
    ? index.entrees.filter((e) => e.type === 'page' || (ctx.recents ?? []).includes(e.cle))
    : index.entrees;
  const classes = classer(texte, permises, ctx);

  const client = classes.find((c) => c.entree.type === 'client' && c.score >= SCORE_DESIGNE)?.entree ?? null;
  const dePage = (ctx.actionsPage ?? []).filter((a) => evaluer(motsRequete(texte), motsDe(a.libelle)) > 0).map((a) => ligneDeActionPage(a, horsLigne));
  const actions = [ligneAjmani(texte, ctx, client), ...(client ? actionsDuClient(client, ctx) : []), ...dePage].slice(0, plafond);
  const resultats = classes.slice(0, plafond).map((c) => ligneDeEntree(c.entree));

  const aucun = resultats.length === 0;
  const proche = aucun ? procheDe(texte, permises) : null;
  return reponse('recherche', texte, [{ id: 'actions', lignes: actions }, { id: 'resultats', lignes: resultats }], { aucunResultat: aucun, proche: proche ? ligneDeEntree(proche) : null });
}
