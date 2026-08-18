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

/**
 * L'EXPORT COMPLET — celui du SERVEUR, et le local seulement à défaut.
 *
 * ## Le défaut
 *
 * `collectBackup` énumère neuf collections À LA MAIN. Le produit en a
 * vingt-six, dont treize appartiennent à une cliente et n'y figuraient pas :
 * factures, identité de facturation, rendez-vous, projets et leurs réglages,
 * dépenses et leurs catégories, temps et son taux horaire, commandes, notes,
 * médias, comptes-rendus. Le bouton s'appelait pourtant « Exporter une
 * sauvegarde » sous le titre « une copie COMPLÈTE de vos données ».
 *
 * C'est la pire forme d'un manque : elle télécharge un fichier, le range en
 * lieu sûr, et croit avoir une sauvegarde. Elle découvrira le trou le jour où
 * elle en aura besoin — c'est-à-dire le jour où elle aura tout perdu par
 * ailleurs.
 *
 * Une liste tenue à la main dérive à chaque module ajouté ; celle-ci avait
 * déjà dérivé de treize entrées. On demande donc au SERVEUR, qui est le seul à
 * savoir ce qu'il détient : `GET /v1/auth/organization/export` rend
 * l'organisation, ses comptes et TOUTES ses collections, sans liste à
 * entretenir nulle part.
 *
 * ## Pourquoi le repli existe quand même
 *
 * Une session locale (poste sans amn-api configuré) n'a pas de serveur à
 * interroger. L'instantané local reste alors la seule chose vraie disponible —
 * il vaut mieux qu'un bouton qui échoue. Le fichier porte donc `kind`, et deux
 * valeurs différentes, pour qu'on sache toujours lequel des deux on relit.
 */
export async function downloadBackup(): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);

  try {
    const complet = await bridge().remote.exportOrganization();
    // Le serveur rend déjà `exportedAt`, `organization`, `users`,
    // `collections` et son `notice`. On n'ajoute que le repère de format.
    const blob = new Blob([JSON.stringify({ kind: 'amn-export', version: 2, ...complet }, null, 2)], {
      type: 'application/json',
    });
    downloadBlob(blob, `mes-donnees-${stamp}.json`);
    return;
  } catch (err) {
    console.warn('[backup] export serveur indisponible, repli sur l’instantané local', err);
  }

  const snapshot = await collectBackup();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `amn-backup-${stamp}.json`);
}
