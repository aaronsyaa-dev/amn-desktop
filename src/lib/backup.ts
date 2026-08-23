import { bridge } from './bridge';
import { SYNCED_COLLECTIONS } from '../state/SyncContext';
import type { SyncedCollection } from '../shared/api';

/**
 * Sauvegarde et restauration de l'espace de travail.
 *
 * ## Ce que cette version corrige
 *
 * L'export d'avant lisait NEUF collections sur les vingt et une qui existent,
 * et se trompait de base pour six d'entre elles. `api.tasks.list()`,
 * `api.decisions.list()` et leurs voisines ne lisent pas la collection
 * synchronisée : elles lisent le magasin d'AVANT la migration — la table
 * SQLite `shared_tasks` sous Electron, la clé `amn.fallback.tasks` dans le
 * navigateur. Le bridge les déclare lui-même comme sources de migration en
 * lecture seule (`LEGACY_MIGRATION_ONLY_STORES`). L'application, elle, écrit
 * ses tâches par la couche de synchronisation.
 *
 * Autrement dit : sur un poste migré, l'export contenait les clients et les
 * devis (lus correctement), six collections vides ou périmées, une collection
 * morte (`learning`, qu'aucun écran ne lit plus), et rien du reste — ni
 * factures, ni rendez-vous, ni notes, ni médias, ni rapports, ni projets, ni
 * registre des sites. Le bouton disait « copie complète ».
 *
 * ## Le choix qui rend l'oubli impossible
 *
 * La liste des collections n'est pas recopiée ici. Elle est importée de
 * `SYNCED_COLLECTIONS`, la liste que la synchronisation utilise déjà. Une
 * collection ajoutée au produit entre donc dans la sauvegarde sans que
 * personne ait à y penser — c'est le seul moyen fiable, puisque la version
 * précédente est justement morte d'une liste recopiée qui a cessé de suivre.
 *
 * ## Ce que la sauvegarde ne contient pas, et pourquoi
 *
 * Le coffre-fort. Ses entrées sont des mots de passe en clair ; il n'est
 * volontairement pas synchronisé (voir `VaultEntry` dans shared/api.ts), et
 * les écrire dans un JSON que l'on met sur une clé USB ou dans un courriel
 * serait la pire façon de les perdre. Le fichier le déclare (`exclut`) et
 * l'écran le dit, plutôt que de laisser croire à une copie intégrale.
 *
 * ## Les échecs ne sont plus silencieux
 *
 * `remote.listRecords` interroge l'API : hors ligne, il lève. L'ancien code
 * rattrapait chaque erreur et renvoyait `[]`, donc un poste hors ligne
 * téléchargeait un fichier de tableaux vides en affichant « Exporté ». Un
 * export incomplet lève maintenant, avec le détail de ce qui a échoué.
 */

/** Marqueur de format, vérifié à la restauration. */
export const BACKUP_KIND = 'amn-backup';

/**
 * Version 2 : toutes les collections synchronisées, enregistrements bruts.
 *
 * La version 1 ne se restaure pas — elle mélangeait des formes de données
 * différentes (`SharedTask` numéroté d'un côté, enregistrements synchronisés
 * de l'autre) et n'a jamais eu de chemin de retour. Elle est refusée à la
 * restauration, avec une phrase qui explique pourquoi plutôt qu'un code.
 */
export const BACKUP_VERSION = 2;

/** Un enregistrement, tel qu'il est conservé dans le fichier. */
export interface BackupRecord {
  id: string;
  updatedAt: string;
  data: Record<string, unknown>;
}

export interface BackupSnapshot {
  app: string;
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  /** Les collections présentes, pour que la restauration sache quoi attendre. */
  collections: SyncedCollection[];
  /** Ce que le fichier ne contient PAS, en toutes lettres. */
  exclut: string[];
  /** Nombre d'enregistrements par collection — lisible sans tout parcourir. */
  compte: Record<string, number>;
  data: Record<string, BackupRecord[]>;
}

export interface CollectionFailure {
  collection: SyncedCollection;
  raison: string;
}

/**
 * Levée quand une collection au moins n'a pas pu être lue.
 *
 * Elle porte la liste : « la sauvegarde a échoué » n'aide personne, « les
 * factures et les rendez-vous n'ont pas répondu » se corrige.
 */
export class BackupIncompleteError extends Error {
  constructor(readonly failures: CollectionFailure[]) {
    super(
      `Sauvegarde incomplète — ${failures.length} collection(s) illisible(s) : ` +
        failures.map((f) => `${f.collection} (${f.raison})`).join(', '),
    );
    this.name = 'BackupIncompleteError';
  }
}

const message = (err: unknown): string =>
  err instanceof Error ? err.message : String(err ?? 'erreur inconnue');

/**
 * Rassemble un instantané complet de l'espace de travail.
 *
 * Lecture seule. Chaque collection est lue par le même chemin — celui de la
 * synchronisation — pour qu'un export depuis le navigateur et un export depuis
 * Electron contiennent exactement la même chose.
 *
 * @throws {BackupIncompleteError} si une collection n'a pas pu être lue.
 */
export async function collectBackup(): Promise<BackupSnapshot> {
  const api = bridge();
  const failures: CollectionFailure[] = [];
  const data: Record<string, BackupRecord[]> = {};
  const compte: Record<string, number> = {};

  const lues = await Promise.all(
    SYNCED_COLLECTIONS.map(async (collection) => {
      try {
        const records = await api.remote.listRecords(collection);
        return { collection, records };
      } catch (err) {
        failures.push({ collection, raison: message(err) });
        return { collection, records: null };
      }
    }),
  );

  if (failures.length > 0) throw new BackupIncompleteError(failures);

  for (const { collection, records } of lues) {
    /* Les pierres tombales sont écartées. Un enregistrement supprimé reste
       dans la collection avec `deleted: true` pour que la suppression se
       propage à l'autre poste ; le remettre dans une sauvegarde le
       ressusciterait à la restauration, puisque l'écriture ne transporte que
       `data`. Une sauvegarde contient ce qui existe. */
    const vivants = (records ?? []).filter((r) => !r.deleted);
    data[collection] = vivants.map((r) => ({ id: r.id, updatedAt: r.updatedAt, data: r.data }));
    compte[collection] = vivants.length;
  }

  return {
    app: 'AMN Desktop',
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    collections: [...SYNCED_COLLECTIONS],
    exclut: [
      'coffre-fort (mots de passe en clair — jamais écrits dans ce fichier)',
      'réglages locaux du poste (fenêtre, démarrage, préférences d’affichage)',
    ],
    compte,
    data,
  };
}

/** Total d'enregistrements d'un instantané. */
export function totalRecords(snapshot: BackupSnapshot): number {
  return Object.values(snapshot.compte).reduce((n, v) => n + v, 0);
}

/** Construit la sauvegarde et déclenche le téléchargement du JSON. */
export async function downloadBackup(): Promise<BackupSnapshot> {
  const snapshot = await collectBackup();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `amn-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Laisser au téléchargement le temps de démarrer avant de révoquer l'URL.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return snapshot;
}

/* ------------------------------ Restauration ------------------------------ */

export interface RestoreReport {
  /** Enregistrements réécrits avec succès. */
  restaures: number;
  /** Collections du fichier inconnues de cette version — ignorées, pas perdues. */
  ignorees: string[];
  echecs: { collection: string; id: string; raison: string }[];
}

/** Lecture défensive d'un fichier choisi par l'utilisateur. */
export function parseBackup(texte: string): BackupSnapshot {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new Error("Ce fichier n'est pas un JSON lisible.");
  }
  const s = brut as Partial<BackupSnapshot>;
  if (!s || typeof s !== 'object' || s.kind !== BACKUP_KIND) {
    throw new Error("Ce fichier n'est pas une sauvegarde AMN.");
  }
  if (s.version === 1) {
    throw new Error(
      'Sauvegarde au format 1, non restaurable : elle ne contenait que neuf ' +
        'collections sur vingt et une, et six étaient lues dans les magasins ' +
        "d'avant la migration. Exporter à nouveau depuis l'application à jour.",
    );
  }
  if (s.version !== BACKUP_VERSION) {
    throw new Error(
      `Sauvegarde au format ${String(s.version)}, cette version en attend ${BACKUP_VERSION}.`,
    );
  }
  if (!s.data || typeof s.data !== 'object') throw new Error('Sauvegarde sans données.');
  return s as BackupSnapshot;
}

/**
 * Réécrit les enregistrements d'un instantané dans l'espace de travail.
 *
 * FUSION, jamais remplacement : rien n'est supprimé. Un enregistrement présent
 * dans le fichier écrase celui qui porte le même identifiant, les autres sont
 * laissés en place. Restaurer ne peut donc pas vider un espace par surprise —
 * et récupérer une fiche effacée par erreur reste possible.
 *
 * L'écriture passe par `remote.upsertRecord` et NON par le `upsert` de
 * SyncContext : ce dernier applique l'écriture au miroir local d'abord et
 * avale l'erreur réseau, ce qui est le bon comportement pour une saisie
 * courante (on reprendra plus tard) et le mauvais pour une restauration —
 * l'écran afficherait les données revenues alors que rien n'a été écrit.
 * Ici, chaque échec est compté et rendu.
 */
export async function restoreBackup(
  snapshot: BackupSnapshot,
  onProgress?: (fait: number, total: number) => void,
): Promise<RestoreReport> {
  const api = bridge();
  const connues = new Set<string>(SYNCED_COLLECTIONS);
  const rapport: RestoreReport = { restaures: 0, ignorees: [], echecs: [] };

  const travail: { collection: SyncedCollection; rec: BackupRecord }[] = [];
  for (const [collection, records] of Object.entries(snapshot.data)) {
    if (!connues.has(collection)) {
      rapport.ignorees.push(collection);
      continue;
    }
    for (const rec of records ?? []) {
      if (rec && typeof rec.id === 'string' && rec.data && typeof rec.data === 'object') {
        travail.push({ collection: collection as SyncedCollection, rec });
      }
    }
  }

  /* Écriture par petits paquets. Une médiathèque tient des images en base64 :
     tout envoyer d'un coup ouvrirait des centaines de requêtes simultanées et
     l'API en refuserait une partie, ce qui ferait échouer une restauration
     pour une raison qui n'a rien à voir avec les données. */
  const PARALLELE = 6;
  const total = travail.length;
  let fait = 0;
  for (let i = 0; i < travail.length; i += PARALLELE) {
    const lot = travail.slice(i, i + PARALLELE);
    await Promise.all(
      lot.map(async ({ collection, rec }) => {
        try {
          await api.remote.upsertRecord(collection, rec.id, rec.data);
          rapport.restaures += 1;
        } catch (err) {
          rapport.echecs.push({ collection, id: rec.id, raison: message(err) });
        }
      }),
    );
    fait += lot.length;
    onProgress?.(fait, total);
  }

  return rapport;
}
