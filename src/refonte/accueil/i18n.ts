import { useLangue, type Langue } from '../../i18n';

/**
 * LES MOTS DE L'ACCUEIL ET D'AJMANI — fr et en, à part des dictionnaires communs.
 *
 * Même modèle que `src/socle/i18n.ts` : l'anglais est le schéma, le français
 * est typé contre lui (une clé oubliée ne compile pas). Rien d'ici n'entre
 * dans le paquet de l'édition cliente : seul le code interne l'importe.
 *
 * Ce que dit Ajmani (ses répliques, par situation et par registre) vit à
 * côté, dans `ajmani/phrases.ts` : une bibliothèque à variantes, pas des clés.
 */
const EN = {
  'accueil.titre': 'Home',
  'accueil.ajmani': 'Ajmani, your guide. Click to talk.',
  'accueil.parler': 'Talk to Ajmani',
  'accueil.ecoute': 'Listening…',
  'accueil.reflechit': 'Thinking…',

  'scene.neuf': 'Getting started',
  'scene.alerte': 'Needs you now',
  'scene.matin': 'Three things for today',
  'scene.calme': 'A calm day',
  'scene.soir': 'Today, wrapped up',

  'neuf.etape.client': 'Add your first client',
  'neuf.etape.rdv': 'Plan an appointment',
  'neuf.etape.visite': 'Take the two-minute tour',
  'neuf.fait': 'Done',
  'neuf.faire': 'Do it',

  'alerte.ouvrir': 'Open',

  'calme.ouvrir': 'Open {module}',
  'soir.faits': 'done today',
  'soir.restants': 'left for tomorrow',

  'fil.titre': 'Today’s thread',
  'fil.aide': 'Built from your appointments, invoices and tasks. Tick, hide or add.',
  'fil.vide': 'Nothing on the thread today.',
  'fil.fait': 'Mark as done',
  'fil.defait': 'Mark as not done',
  'fil.masquer': 'Hide for today',
  'fil.reafficher': 'Show {n} hidden',
  'fil.ajouter': 'Add a line',
  'fil.ajouter.aide': 'Something of your own, for today only.',
  'fil.ajouter.ok': 'Add',
  'fil.relancer': 'Chase {nom}',
  'fil.retard': '{jours} days late',
  'fil.enCours': 'in progress',
  'fil.aFaire': 'to do',
  'fil.ouvrir': 'Open',

  'modules.titre': 'Modules',
  'module.agenda': 'Calendar',
  'module.tasks': 'Tasks',
  'module.clients': 'Clients',
  'module.invoices': 'Invoicing',
  'module.reminders': 'Reminders',
  'module.notes': 'Notes',
  'module.team': 'Team',
  'module.projects': 'Projects',
  'module.settings': 'Settings',
  'module.weekly': 'Weekly review',
  'module.routines': 'Routines',
  'module.logbook': 'Logbook',
  'module.okr': 'Objectives',
  'module.priorities': 'Today’s priorities',

  'astuce.masquer': 'Don’t show me this again',
  'astuce.fermer': 'Close',

  'registre.titre': 'Ajmani’s tone',
  'registre.texte': 'How Ajmani talks to you. He always turns serious for alerts. On this device only.',
  'registre.serieux': 'Serious',
  'registre.serieux.aide': 'Short and factual.',
  'registre.chill': 'Chill',
  'registre.chill.aide': 'Relaxed and friendly. The default.',
  'registre.taquin': 'Cheeky',
  'registre.taquin.aide': 'A little teasing, never preachy.',

  'lancement.passer': 'Click to skip',
} as const;

export type CleAccueil = keyof typeof EN;

const FR: Record<CleAccueil, string> = {
  'accueil.titre': 'Accueil',
  'accueil.ajmani': 'Ajmani, ton guide. Clique pour lui parler.',
  'accueil.parler': 'Parler à Ajmani',
  'accueil.ecoute': 'J’écoute…',
  'accueil.reflechit': 'Je réfléchis…',

  'scene.neuf': 'Pour bien démarrer',
  'scene.alerte': 'À traiter maintenant',
  'scene.matin': 'Trois choses pour aujourd’hui',
  'scene.calme': 'Une journée calme',
  'scene.soir': 'La journée, bouclée',

  'neuf.etape.client': 'Ajoute ton premier client',
  'neuf.etape.rdv': 'Prévois un rendez-vous',
  'neuf.etape.visite': 'Fais la visite de deux minutes',
  'neuf.fait': 'Fait',
  'neuf.faire': 'Y aller',

  'alerte.ouvrir': 'Ouvrir',

  'calme.ouvrir': 'Ouvrir {module}',
  'soir.faits': 'faites aujourd’hui',
  'soir.restants': 'pour demain',

  'fil.titre': 'Le fil du jour',
  'fil.aide': 'Tiré de tes rendez-vous, factures et tâches. Coche, masque ou ajoute.',
  'fil.vide': 'Rien sur le fil aujourd’hui.',
  'fil.fait': 'Marquer comme fait',
  'fil.defait': 'Marquer comme pas fait',
  'fil.masquer': 'Masquer pour aujourd’hui',
  'fil.reafficher': 'Réafficher {n} masquée(s)',
  'fil.ajouter': 'Ajouter une ligne',
  'fil.ajouter.aide': 'Une chose à toi, pour aujourd’hui seulement.',
  'fil.ajouter.ok': 'Ajouter',
  'fil.relancer': 'Relancer {nom}',
  'fil.retard': '{jours} jours de retard',
  'fil.enCours': 'en cours',
  'fil.aFaire': 'à faire',
  'fil.ouvrir': 'Ouvrir',

  'modules.titre': 'Modules',
  'module.agenda': 'Calendrier',
  'module.tasks': 'Tâches',
  'module.clients': 'Clients',
  'module.invoices': 'Facturation',
  'module.reminders': 'Relances',
  'module.notes': 'Notes',
  'module.team': 'Équipe',
  'module.projects': 'Projets',
  'module.settings': 'Réglages',
  'module.weekly': 'la revue hebdo',
  'module.routines': 'les routines',
  'module.logbook': 'le journal de bord',
  'module.okr': 'les objectifs',
  'module.priorities': 'les priorités du jour',

  'astuce.masquer': 'Ne plus me montrer ça',
  'astuce.fermer': 'Fermer',

  'registre.titre': 'Le ton d’Ajmani',
  'registre.texte': 'Comment Ajmani te parle. Il redevient toujours sérieux face à une alerte. Sur ce poste seulement.',
  'registre.serieux': 'Sérieux',
  'registre.serieux.aide': 'Court et factuel.',
  'registre.chill': 'Chill',
  'registre.chill.aide': 'Détendu et amical. Le réglage par défaut.',
  'registre.taquin': 'Taquin',
  'registre.taquin.aide': 'Un peu moqueur, jamais moralisateur.',

  'lancement.passer': 'Cliquer pour passer',
};

export const DICTIONNAIRES_ACCUEIL: Record<Langue, Record<CleAccueil, string>> = { en: EN, fr: FR };

export function traduireAccueil(langue: Langue, cle: CleAccueil, params: Record<string, string | number> = {}): string {
  const brut = DICTIONNAIRES_ACCUEIL[langue][cle] ?? EN[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, k: string) => (k in params ? String(params[k]) : tout));
}

/** Comme `useLangue`, pour les mots de l'Accueil : re-rend quand la langue change. */
export function useAccueilLangue(): { langue: Langue; ta: (cle: CleAccueil, params?: Record<string, string | number>) => string } {
  const { langue } = useLangue();
  return { langue, ta: (cle, params) => traduireAccueil(langue, cle, params) };
}
