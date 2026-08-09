import type {
  Client,
  Decision,
  KnowledgeDoc,
  LearningGoal,
  Objective,
  Quote,
  SharedTask,
} from '../shared/api';

/**
 * Données de démarrage du pont navigateur — édition BUSINESS.
 *
 * Vides, et c'est le point : une organisation cliente démarre sur un espace
 * réellement vierge. Pas de comptes locaux (elle s'authentifie auprès
 * d'amn-api, jamais contre une empreinte embarquée dans le build), pas de
 * fiches de démonstration à supprimer avant de commencer.
 *
 * Conséquence voulue : hors Electron et sans session, le pont navigateur ne
 * laisse entrer personne. C'est le bon comportement — il n'y a rien à voir
 * sans compte.
 */

export const FALLBACK_ACCOUNTS: Record<string, { name: string; hash: string }> = {};

export function seedClients(): Client[] {
  return [];
}
export function seedQuotes(): Quote[] {
  return [];
}
export function seedTasks(): SharedTask[] {
  return [];
}
export function seedDecisions(): Decision[] {
  return [];
}
export function seedKnowledge(): KnowledgeDoc[] {
  return [];
}
export function seedLearningGoals(): LearningGoal[] {
  return [];
}
export function seedObjectives(): Objective[] {
  return [];
}
