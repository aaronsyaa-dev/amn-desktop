import type { EntreeEnvoi } from './fileEnvoi';

/**
 * LA FILE D'ENVOI D'AVANT L'INDEXATION PAR ORGANISATION — rien ne s'y perd.
 *
 * Jusqu'à la PR #34, les écritures pas encore parties (hors ligne, serveur
 * indisponible) attendaient sous `amn.sync.__envoi`, une clé commune à toutes
 * les organisations du poste. La première version indexée les a mises « en
 * quarantaine » (`amn.sync.quarantaine.__envoi`) sans jamais les renvoyer — et
 * la déconnexion, qui efface tout `amn.sync.*`, les détruisait. Mesuré dans le
 * bac à sable : un client créé hors ligne disparaissait à la mise à jour.
 *
 * Ici, trois temps, et aucun n'efface avant d'avoir écrit ailleurs :
 *
 *   1. METTRE DE CÔTÉ (au montage) — les deux anciennes clés rejoignent
 *      `amn.envoi-herite`, HORS du préfixe que la déconnexion efface, avec
 *      l'adresse du compte connecté à ce moment-là (c'est forcément lui qui
 *      les a posées : une déconnexion aurait vidé l'ancienne file).
 *   2. PARTAGER — ce qui peut être rejoué SANS AMBIGUÏTÉ dans l'organisation
 *      courante : même compte, auteur concordant, et un compte qui n'appartient
 *      qu'à une organisation (la file n'a alors pu venir que d'elle).
 *   3. REJOUER — l'appelant pose ces entrées dans la file de l'organisation,
 *      puis retire de la file héritée ce qui y est passé.
 *
 * Ce qui ne passe pas reste, intact, jusqu'à ce que quelqu'un décide : un
 * compte membre de plusieurs organisations ne permet pas de dire d'où venait
 * une écriture, et la ranger au hasard serait refaire la fuite corrigée.
 */
export const CLE_FILE_HERITEE = 'amn.envoi-herite';
const SOURCES = ['amn.sync.__envoi', 'amn.sync.quarantaine.__envoi'];

export interface FileHeritee {
  /** Le compte connecté quand la file a été mise de côté ; `null` si inconnu. */
  proprietaire: string | null;
  entrees: EntreeEnvoi[];
}

type Stockage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function lireTableau(brut: string | null): EntreeEnvoi[] {
  if (!brut) return [];
  try {
    const v = JSON.parse(brut) as unknown;
    return Array.isArray(v)
      ? (v.filter((e) => e && typeof e === 'object' && typeof (e as EntreeEnvoi).collection === 'string' && typeof (e as EntreeEnvoi).id === 'string') as EntreeEnvoi[])
      : [];
  } catch {
    return [];
  }
}

export function lireFileHeritee(stockage: Stockage): FileHeritee {
  try {
    const brut = stockage.getItem(CLE_FILE_HERITEE);
    if (!brut) return { proprietaire: null, entrees: [] };
    const v = JSON.parse(brut) as Partial<FileHeritee>;
    return {
      proprietaire: typeof v.proprietaire === 'string' ? v.proprietaire : null,
      entrees: lireTableau(JSON.stringify(v.entrees ?? [])),
    };
  } catch {
    return { proprietaire: null, entrees: [] };
  }
}

function ecrire(stockage: Stockage, file: FileHeritee): void {
  if (file.entrees.length === 0) stockage.removeItem(CLE_FILE_HERITEE);
  else stockage.setItem(CLE_FILE_HERITEE, JSON.stringify(file));
}

const memeGeste = (a: EntreeEnvoi, b: EntreeEnvoi) => a.collection === b.collection && a.id === b.id && a.pose === b.pose;

/** Temps 1. Idempotent : sans ancienne clé, ne fait rien. */
export function mettreDeCote(stockage: Stockage, emailCourant: string | null): FileHeritee {
  const existante = lireFileHeritee(stockage);
  const nouvelles = SOURCES.flatMap((cle) => lireTableau(stockage.getItem(cle)));
  if (nouvelles.length === 0) {
    for (const cle of SOURCES) if (stockage.getItem(cle) !== null) stockage.removeItem(cle);
    return existante;
  }
  const entrees = [...existante.entrees];
  for (const e of nouvelles) if (!entrees.some((x) => memeGeste(x, e))) entrees.push(e);
  const suite: FileHeritee = { proprietaire: existante.proprietaire ?? emailCourant, entrees };
  // Écrire AVANT d'effacer : un plantage entre les deux laisse un double, jamais un trou.
  ecrire(stockage, suite);
  for (const cle of SOURCES) stockage.removeItem(cle);
  return suite;
}

export type RaisonGardee = 'autre-compte' | 'plusieurs-organisations' | 'auteur-different' | 'compte-inconnu';

/** Temps 2. Pur : décide, n'écrit rien. */
export function partager(
  file: FileHeritee,
  { email, nombreOrganisations }: { email: string | null; nombreOrganisations: number },
): { aRejouer: EntreeEnvoi[]; aGarder: EntreeEnvoi[]; raison: RaisonGardee | null } {
  if (!email) return { aRejouer: [], aGarder: file.entrees, raison: 'compte-inconnu' };
  if (file.proprietaire && file.proprietaire.toLowerCase() !== email.toLowerCase()) {
    return { aRejouer: [], aGarder: file.entrees, raison: 'autre-compte' };
  }
  if (nombreOrganisations > 1) return { aRejouer: [], aGarder: file.entrees, raison: 'plusieurs-organisations' };
  const aRejouer: EntreeEnvoi[] = [];
  const aGarder: EntreeEnvoi[] = [];
  for (const e of file.entrees) {
    const auteur = typeof e.donnees?._by === 'string' ? (e.donnees._by as string) : null;
    if (auteur && auteur.toLowerCase() !== email.toLowerCase()) aGarder.push(e);
    else aRejouer.push(e);
  }
  return { aRejouer, aGarder, raison: aGarder.length ? 'auteur-different' : null };
}

/** Temps 3, côté stockage : ne garde que ce qui n'a pas été repris. */
export function conserverSeulement(stockage: Stockage, file: FileHeritee, restantes: EntreeEnvoi[]): void {
  ecrire(stockage, { proprietaire: file.proprietaire, entrees: restantes });
}
