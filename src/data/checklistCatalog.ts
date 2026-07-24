import type { ChecklistItemDef } from '../shared/api';

/**
 * Static catalog of recurring checks. Content is hardcoded (no real scanning
 * logic yet, as requested) — only the "last checked" timestamp per item is
 * persisted (see checklist:getState/check in the bridge). An item is
 * considered "due again" once its frequency window has elapsed since the
 * last check — see isChecklistItemDue() below.
 */
export const CHECKLIST_CATALOG: ChecklistItemDef[] = [
  {
    id: 'ssl-certs',
    label: 'Vérifier les certificats SSL',
    detail: 'S’assurer qu’aucun certificat des sites supervisés n’expire dans les 30 prochains jours.',
    frequency: 'weekly',
  },
  {
    id: 'dependencies',
    label: 'Revoir les dépendances obsolètes',
    detail: 'Vérifier les mises à jour de sécurité disponibles sur les projets suivis (tracker, sites clients).',
    frequency: 'weekly',
  },
  {
    id: 'backups',
    label: 'Contrôler les sauvegardes',
    detail: 'Confirmer qu’une sauvegarde récente existe pour chaque site actif.',
    frequency: 'weekly',
  },
  {
    id: 'access-review',
    label: 'Revoir les accès et mots de passe partagés',
    detail: 'Vérifier qu’aucun accès obsolète (ancien prestataire, ancien compte) ne traîne encore.',
    frequency: 'monthly',
  },
  {
    id: 'incident-review',
    label: 'Relire les incidents du mois',
    detail: 'Repasser sur les alertes critiques du mois pour en tirer des actions correctives.',
    frequency: 'monthly',
  },
];

const FREQUENCY_MS: Record<ChecklistItemDef['frequency'], number> = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

/** An item is "due" (unchecked again) once its frequency window has elapsed. */
export function isChecklistItemDue(
  item: ChecklistItemDef,
  lastCheckedAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!lastCheckedAt) return true;
  return now - new Date(lastCheckedAt).getTime() >= FREQUENCY_MS[item.frequency];
}
