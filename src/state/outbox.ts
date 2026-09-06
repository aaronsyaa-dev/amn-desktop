import type { RemoteRecord, SyncedCollection } from '../shared/api';

/**
 * La file de reprise : ce qui a été écrit hors ligne, et qui attend le réseau.
 *
 * ## Ce qui manquait
 *
 * `upsert` et `remove` (SyncContext) écrivent d'abord dans le miroir local,
 * puis appellent amn-api. Quand l'appel échouait, le code disait « will
 * re-sync later » — et rien, nulle part, ne resynchronisait. La pastille
 * promettait pourtant que « vos changements se resynchroniseront
 * automatiquement au retour de la connexion ». Une facture émise pendant une
 * coupure restait sur ce seul poste, pour toujours ; une suppression faite
 * hors ligne ne partait pas non plus, et il suffisait que l'autre opérateur
 * touche l'enregistrement pour que son `updatedAt` batte la tombe locale au
 * prochain rattrapage — l'effacé réapparaissait sur la machine même qui
 * l'avait effacé.
 *
 * ## Ce que fait ce module
 *
 * Chaque écriture dont l'appel réseau échoue est déposée ici, dans
 * localStorage, sous une clé PROPRE À L'ORGANISATION. Elle est rejouée en tête
 * du rattrapage complet (`pullAll`), donc au démarrage, à la reconnexion et au
 * retour au premier plan — AVANT de fusionner ce que renvoie le serveur, pour
 * que l'écriture locale l'emporte sur l'état périmé qu'il détient encore.
 *
 * Pourquoi par organisation et hors du préfixe `amn.sync.` : le miroir est
 * purgé quand une autre organisation se connecte sur le poste. Une file
 * indexée par poste survivrait à cette purge et rejouerait les écritures de
 * la précédente dans le tenant de la suivante — exactement la fuite que la
 * purge vient de fermer. La clé porte l'organisation ; une autre ne la lit
 * pas.
 *
 * ## Les deux sortes d'échec, et pourquoi on les distingue
 *
 * Réseau injoignable : on s'arrête, on garde tout, on réessaiera. Rejouer
 * la suite serait vain et casserait l'ordre.
 *
 * Serveur joint et qui REFUSE (règle d'isolation, corps invalide, quota
 * d'invité) : réessayer ne changera rien. L'entrée est comptée, on passe à
 * la suivante — sinon une écriture refusée bloquerait tout ce qui la suit,
 * pour toujours. Après `maxAttempts` refus elle n'est plus rejouée mais elle
 * RESTE dans la file, visible : la pastille dit « N refusés ». Perdre en
 * silence est précisément ce que ce module remplace.
 *
 * Aucun React ici, et aucun import de valeur : le module se teste en Node
 * (scripts/check-outbox.ts) avec un stockage en mémoire et un faux envoi,
 * comme src/lib/money.ts. C'est pour ça que le préfixe qui marque une panne
 * réseau (`API_UNREACHABLE_PREFIX`) est REÇU en paramètre au lieu d'être
 * importé — l'appelant, SyncContext, fournit la vraie constante.
 */

export interface OutboxEntry {
  collection: SyncedCollection;
  id: string;
  /** `null` : c'est une suppression. */
  data: Record<string, unknown> | null;
  /** Instant de la mise en file, pour l'ordre et le diagnostic. */
  queuedAt: string;
  /** Refus du serveur, pas pannes réseau. */
  attempts: number;
  lastError?: string;
}

/** Le sous-ensemble de `Storage` dont on a besoin — remplaçable en test. */
export interface OutboxStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Ce qu'il faut pour envoyer : les deux appels du transport. */
export interface OutboxSender {
  upsert(collection: SyncedCollection, id: string, data: Record<string, unknown>): Promise<RemoteRecord>;
  remove(collection: SyncedCollection, id: string): Promise<RemoteRecord>;
}

export const OUTBOX_PREFIX = 'amn.outbox.';
export const OUTBOX_MAX_ATTEMPTS = 5;

/**
 * La clé, propre à l'organisation (`'local'` pour une session sans amn-api)
 * et au contexte client s'il y en a un — même découpage que le miroir.
 */
export function outboxKey(orgKey: string, scope?: string): string {
  return scope ? `${OUTBOX_PREFIX}${orgKey}.ctx-${scope}` : `${OUTBOX_PREFIX}${orgKey}`;
}

export function readOutbox(storage: OutboxStorage, key: string): OutboxEntry[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(storage: OutboxStorage, key: string, entries: OutboxEntry[]): void {
  try {
    if (entries.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(entries));
  } catch {
    /* quota : la file en mémoire de cet appel reste la seule ; on réessaiera d'écrire à la prochaine mutation */
  }
}

/**
 * Dépose une écriture. Une entrée existante pour le même enregistrement est
 * REMPLACÉE, à sa place dans l'ordre : la dernière version locale est celle
 * qu'il faut envoyer, et l'envoyer deux fois ne servirait à rien.
 */
export function enqueue(
  storage: OutboxStorage,
  key: string,
  entry: Pick<OutboxEntry, 'collection' | 'id' | 'data'>,
  now: string,
): OutboxEntry[] {
  const entries = readOutbox(storage, key);
  const fresh: OutboxEntry = { ...entry, queuedAt: now, attempts: 0 };
  const index = entries.findIndex((e) => e.collection === entry.collection && e.id === entry.id);
  if (index >= 0) entries[index] = fresh;
  else entries.push(fresh);
  writeOutbox(storage, key, entries);
  return entries;
}

/**
 * Une panne de réseau, par opposition à un refus du serveur.
 * `unreachablePrefix` : ce que le pont navigateur met devant ses erreurs
 * réseau (API_UNREACHABLE_PREFIX), passé par l'appelant.
 */
export function isTransientNetworkError(err: unknown, unreachablePrefix: string): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  if (unreachablePrefix && message.startsWith(unreachablePrefix)) return true;
  // Le process main (Electron) laisse passer l'erreur brute de fetch/undici.
  return /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network|injoignable|Failed to fetch|Load failed/i.test(
    message,
  );
}

export interface FlushResult {
  /** Enregistrements tels que le serveur les a rendus, à fusionner localement. */
  sent: RemoteRecord[];
  /** Ce qui reste : en attente (réseau) ou refusé (serveur, `attempts` ≥ max). */
  remaining: OutboxEntry[];
  /** Vrai si on s'est arrêté sur une panne réseau — le reste n'a pas été tenté. */
  halted: boolean;
}

/**
 * Rejoue la file dans l'ordre. Voir l'en-tête pour la règle des deux échecs.
 */
export async function flushOutbox(
  storage: OutboxStorage,
  key: string,
  sender: OutboxSender,
  opts: { unreachablePrefix: string; maxAttempts?: number },
): Promise<FlushResult> {
  const maxAttempts = opts.maxAttempts ?? OUTBOX_MAX_ATTEMPTS;
  const entries = readOutbox(storage, key);
  const sent: RemoteRecord[] = [];
  const remaining: OutboxEntry[] = [];
  let halted = false;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (halted || entry.attempts >= maxAttempts) {
      remaining.push(entry);
      continue;
    }
    try {
      const saved =
        entry.data === null
          ? await sender.remove(entry.collection, entry.id)
          : await sender.upsert(entry.collection, entry.id, entry.data);
      sent.push(saved);
    } catch (err) {
      if (isTransientNetworkError(err, opts.unreachablePrefix)) {
        halted = true;
        remaining.push(entry);
      } else {
        remaining.push({
          ...entry,
          attempts: entry.attempts + 1,
          lastError: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  writeOutbox(storage, key, remaining);
  return { sent, remaining, halted };
}

/** Compte ce qui attend encore le réseau, et ce que le serveur a refusé. */
export function outboxCounts(entries: OutboxEntry[], maxAttempts = OUTBOX_MAX_ATTEMPTS): {
  pending: number;
  rejected: number;
} {
  let pending = 0;
  let rejected = 0;
  for (const e of entries) {
    if (e.attempts >= maxAttempts) rejected += 1;
    else pending += 1;
  }
  return { pending, rejected };
}
