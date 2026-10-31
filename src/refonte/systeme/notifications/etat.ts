/**
 * CE QUI EST PROPRE À LA PERSONNE (H40) — lu, reporté, première vue, événements.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les notifications se dérivent des sources (`sources.ts`) ; elles ne portent pas
 * d'état. Cet état-ci, par compte et par poste, dit pour chaque identifiant :
 *
 *   · `vues`       la PREMIÈRE fois où il a été vu — c'est la date d'une notification dont la
 *                  source n'en a pas (les points d'attention sont recalculés, rien n'y est daté) ;
 *   · `lues`       quand il a été lu. Une notification est lue si `lues[id] >= date` : un nouveau
 *                  message du même fil, ou une notification qui revient d'un report, redevient non lue
 *                  sans rien effacer ;
 *   · `reportees`  l'échéance d'un report. Avant, la notification disparaît de la liste ; à l'échéance elle
 *                  revient, datée de l'échéance, donc non lue ;
 *   · `ouvertures` la dernière ouverture par type (pour la suggestion « Moins de bruit ») ;
 *   · `gardees`    « Garder » : jusqu'à quand la suggestion se tait pour un type ;
 *   · `evenements` les moments du bus qui valent une notification (50 au plus, 30 jours).
 *
 * Aucun secret, aucune adresse : des identifiants opaques, des dates, et les textes courts des événements.
 * Le module est pur : il ne touche ni au stockage ni à l'horloge (le magasin s'en charge).
 */
import {
  RETENTION_JOURS,
  type CategorieReglage,
  type Notification,
  type NotificationBrute,
  type NotificationSource,
} from './modele';

export const VERSION_ETAT = 1;
export const EVENEMENTS_MAX = 50;
/** Garde-fou : un état qui enfle sans fin (milliers d'identifiants vus) se coupe au plus ancien. */
export const ENTREES_MAX = 600;

const JOUR_MS = 86_400_000;

export interface EtatNotifications {
  v: typeof VERSION_ETAT;
  vues: Record<string, string>;
  lues: Record<string, string>;
  reportees: Record<string, string>;
  ouvertures: Partial<Record<CategorieReglage, string>>;
  gardees: Partial<Record<CategorieReglage, string>>;
  evenements: NotificationBrute[];
}

export function etatVide(): EtatNotifications {
  return { v: VERSION_ETAT, vues: {}, lues: {}, reportees: {}, ouvertures: {}, gardees: {}, evenements: [] };
}

/* ── Lecture défensive ───────────────────────────────────────────────────── */

const estTexte = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const estDate = (v: unknown): v is string => estTexte(v) && !Number.isNaN(Date.parse(v));

function tableDeDates(brut: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (brut && typeof brut === 'object' && !Array.isArray(brut)) {
    for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) if (estDate(valeur)) out[cle] = valeur;
  }
  return out;
}

const CATEGORIES: readonly CategorieReglage[] = ['urgent', 'paiement', 'securite', 'mention', 'rendez-vous', 'activite'];

function tableParCategorie(brut: unknown): Partial<Record<CategorieReglage, string>> {
  const out: Partial<Record<CategorieReglage, string>> = {};
  const lue = tableDeDates(brut);
  for (const c of CATEGORIES) if (lue[c]) out[c] = lue[c];
  return out;
}

function evenementValide(brut: unknown): NotificationBrute | null {
  if (!brut || typeof brut !== 'object') return null;
  const e = brut as Partial<NotificationBrute>;
  if (!estTexte(e.id) || !estTexte(e.type) || !estTexte(e.titre) || !estDate(e.date) || !e.vers || !estTexte(e.vers.route)) return null;
  return {
    id: e.id,
    type: e.type,
    titre: e.titre,
    detail: typeof e.detail === 'string' ? e.detail : '',
    vers: { route: e.vers.route, ...(e.vers.state ? { state: e.vers.state } : {}) },
    date: e.date,
    urgente: e.urgente === true,
    famille: e.famille ?? 'jour',
    icone: e.icone ?? 'cloche',
    module: typeof e.module === 'string' ? e.module : null,
  };
}

/** Relit un état stocké ; tout ce qui est illisible repart d'un état vide plutôt que de casser la page. */
export function normaliserEtat(brut: unknown): EtatNotifications {
  if (!brut || typeof brut !== 'object') return etatVide();
  const e = brut as Record<string, unknown>;
  if (e.v !== VERSION_ETAT) return etatVide();
  return {
    v: VERSION_ETAT,
    vues: tableDeDates(e.vues),
    lues: tableDeDates(e.lues),
    reportees: tableDeDates(e.reportees),
    ouvertures: tableParCategorie(e.ouvertures),
    gardees: tableParCategorie(e.gardees),
    evenements: Array.isArray(e.evenements) ? e.evenements.map(evenementValide).filter((x): x is NotificationBrute => x !== null) : [],
  };
}

/* ── Application de l'état aux sources ───────────────────────────────────── */

/** Pose la date d'une notification qui n'en a pas : la première fois où son identifiant a été vu. Ne mute rien. */
export function dater(sources: readonly NotificationSource[], etat: EtatNotifications, maintenant: Date): { notifications: NotificationBrute[]; etat: EtatNotifications } {
  let vues = etat.vues;
  const notifications = sources.map((s) => {
    if (s.date) return { ...s, date: s.date };
    let vue = vues[s.id];
    if (!vue) {
      vue = maintenant.toISOString();
      if (vues === etat.vues) vues = { ...etat.vues };
      vues[s.id] = vue;
    }
    return { ...s, date: vue };
  });
  return { notifications, etat: vues === etat.vues ? etat : { ...etat, vues } };
}

/**
 * Applique le report, le lu et la rétention aux notifications datées :
 *   · reportée et pas encore à l'échéance → absente de la liste ;
 *   · revenue d'un report → datée de l'échéance (elle remonte en tête d'aujourd'hui) ;
 *   · lue ⇔ `lues[id] >= date` ;
 *   · plus vieille que 30 jours → archivée (absente).
 */
export function appliquerEtat(brutes: readonly NotificationBrute[], etat: EtatNotifications, maintenant: Date): Notification[] {
  const t = maintenant.getTime();
  const limite = t - RETENTION_JOURS * JOUR_MS;
  const out: Notification[] = [];
  for (const b of brutes) {
    const echeance = etat.reportees[b.id];
    let date = b.date;
    if (echeance) {
      const e = Date.parse(echeance);
      if (e > t) continue;
      if (e > Date.parse(date)) date = echeance;
    }
    if (Date.parse(date) < limite) continue;
    const lue = etat.lues[b.id];
    out.push({ ...b, date, lue: lue !== undefined && Date.parse(lue) >= Date.parse(date) });
  }
  return out;
}

/** Le prochain instant où la liste change toute seule : l'échéance de report la plus proche. */
export function prochaineEcheance(etat: EtatNotifications, maintenant: Date): number | null {
  let proche: number | null = null;
  for (const e of Object.values(etat.reportees)) {
    const t = Date.parse(e);
    if (t > maintenant.getTime() && (proche === null || t < proche)) proche = t;
  }
  return proche;
}

/* ── Transitions (chacune rend un nouvel état) ───────────────────────────── */

export function marquerLue(etat: EtatNotifications, id: string, maintenant: Date): EtatNotifications {
  return { ...etat, lues: { ...etat.lues, [id]: maintenant.toISOString() } };
}

export function marquerNonLue(etat: EtatNotifications, id: string): EtatNotifications {
  if (!(id in etat.lues)) return etat;
  const lues = { ...etat.lues };
  delete lues[id];
  return { ...etat, lues };
}

/** Marque lues toutes les notifications données et rend aussi ce qu'il faut pour défaire. */
export function toutMarquerLu(etat: EtatNotifications, ids: readonly string[], maintenant: Date): { etat: EtatNotifications; avant: Record<string, string | undefined> } {
  const avant: Record<string, string | undefined> = {};
  const lues = { ...etat.lues };
  const quand = maintenant.toISOString();
  for (const id of ids) {
    avant[id] = lues[id];
    lues[id] = quand;
  }
  return { etat: { ...etat, lues }, avant };
}

/** Défait `toutMarquerLu` (ou le report) : remet chaque valeur d'avant, ou l'ôte si elle n'existait pas. */
export function restaurerLues(etat: EtatNotifications, avant: Record<string, string | undefined>): EtatNotifications {
  const lues = { ...etat.lues };
  for (const [id, valeur] of Object.entries(avant)) {
    if (valeur === undefined) delete lues[id];
    else lues[id] = valeur;
  }
  return { ...etat, lues };
}

export function reporter(etat: EtatNotifications, id: string, echeance: Date): EtatNotifications {
  return { ...etat, reportees: { ...etat.reportees, [id]: echeance.toISOString() } };
}

export function annulerReport(etat: EtatNotifications, id: string, avant: string | undefined): EtatNotifications {
  const reportees = { ...etat.reportees };
  if (avant === undefined) delete reportees[id];
  else reportees[id] = avant;
  return { ...etat, reportees };
}

export function noterOuverture(etat: EtatNotifications, categorie: CategorieReglage, maintenant: Date): EtatNotifications {
  return { ...etat, ouvertures: { ...etat.ouvertures, [categorie]: maintenant.toISOString() } };
}

export function garderJusqua(etat: EtatNotifications, categorie: CategorieReglage, jusqua: Date): EtatNotifications {
  return { ...etat, gardees: { ...etat.gardees, [categorie]: jusqua.toISOString() } };
}

/** Ajoute un événement du bus (sans doublon d'identifiant), garde les 50 plus récents et ceux de moins de 30 jours. */
export function ajouterEvenement(etat: EtatNotifications, evenement: NotificationBrute, maintenant: Date): EtatNotifications {
  const limite = maintenant.getTime() - RETENTION_JOURS * JOUR_MS;
  const evenements = [evenement, ...etat.evenements.filter((e) => e.id !== evenement.id)]
    .filter((e) => Date.parse(e.date) >= limite)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, EVENEMENTS_MAX);
  return { ...etat, evenements };
}

/**
 * Élague ce qui ne sert plus : un identifiant absent des sources depuis plus de 30 jours perd sa première vue, son
 * « lu » et son report ; les événements de plus de 30 jours partent ; l'ensemble ne dépasse jamais `ENTREES_MAX`.
 */
export function elaguer(etat: EtatNotifications, idsActuels: ReadonlySet<string>, maintenant: Date): EtatNotifications {
  const limite = maintenant.getTime() - RETENTION_JOURS * JOUR_MS;
  const evenements = etat.evenements.filter((e) => Date.parse(e.date) >= limite);
  const idsEvenements = new Set(evenements.map((e) => e.id));
  const garde = (id: string, quand: string): boolean => idsActuels.has(id) || idsEvenements.has(id) || Date.parse(quand) >= limite;
  const filtre = (table: Record<string, string>): Record<string, string> => {
    const entrees = Object.entries(table).filter(([id, quand]) => garde(id, quand));
    entrees.sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]));
    return Object.fromEntries(entrees.slice(0, ENTREES_MAX));
  };
  const vues = filtre(etat.vues);
  const lues = filtre(etat.lues);
  const reportees = Object.fromEntries(Object.entries(etat.reportees).filter(([id, quand]) => garde(id, quand)));
  const inchange =
    evenements.length === etat.evenements.length &&
    Object.keys(vues).length === Object.keys(etat.vues).length &&
    Object.keys(lues).length === Object.keys(etat.lues).length &&
    Object.keys(reportees).length === Object.keys(etat.reportees).length;
  return inchange ? etat : { ...etat, vues, lues, reportees, evenements };
}
