import { bridge } from './bridge';
import { downloadBlob } from './download';

/**
 * Gathers a full snapshot of the workspace data reachable through the bridge
 * and returns it as a single JSON-serialisable object. Read-only — never
 * mutates anything. Each collection is fetched independently so one failure
 * (e.g. an empty table) doesn't sink the whole export.
 */
export async function collectBackup(): Promise<Record<string, unknown>> {
  const api = bridge();
  const safe = async <T>(label: string, fn: () => Promise<T>): Promise<T | []> => {
    try {
      return await fn();
    } catch (err) {
      console.warn(`[backup] ${label} failed`, err);
      return [];
    }
  };

  const [clients, quotes, tasks, decisions, knowledge, learning, objectives, messages, profiles] =
    await Promise.all([
      // Read through the synced collections so an export from the web build and
      // one from Electron contain the same clients — they used to read two
      // different databases.
      safe('clients', () => api.remote.listRecords('clients')),
      safe('quotes', () => api.remote.listRecords('quotes')),
      safe('tasks', () => api.tasks.list()),
      safe('decisions', () => api.decisions.list()),
      safe('knowledge', () => api.knowledge.list()),
      safe('learning', () => api.learning.list()),
      safe('objectives', () => api.objectives.list()),
      safe('messages', () => api.messages.list()),
      safe('profiles', () => api.profiles.list()),
    ]);

  return {
    app: 'AMN Desktop',
    kind: 'amn-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { clients, quotes, tasks, decisions, knowledge, learning, objectives, messages, profiles },
  };
}

/** Builds the backup and triggers a browser/Electron download of the JSON file. */
export async function downloadBackup(): Promise<void> {
  const snapshot = await collectBackup();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `amn-backup-${stamp}.json`);
}
