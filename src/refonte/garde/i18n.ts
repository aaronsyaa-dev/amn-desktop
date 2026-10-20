import { useLangue, type Langue } from '../../i18n';

/**
 * LES MOTS DE LA GARDE VISIBLE (S3) — fr et en, à part des dictionnaires communs.
 *
 * Même modèle que `src/socle/i18n.ts` : l'anglais est le schéma, le français
 * est typé contre lui (une clé oubliée ne compile pas). Rien ici n'entre dans
 * le paquet de l'édition cliente : seuls les fichiers de `src/refonte/garde/`
 * l'importent, et ils ne sont montés que par l'édition interne.
 *
 * La voix est celle de la Garde (`check:parole`) : pas de point
 * d'exclamation, pas d'apostrophe droite, pas de servilité. Le résumé tient en
 * phrases de douze mots au plus, vérifiées par `check:garde-refonte` avec les
 * nombres remplacés.
 *
 * Les comptes : `.0` (si présent), `.1`, `.n` — voir `compte()`.
 */
const EN = {
  'equipe.sites': 'Sites',
  'equipe.securite': 'Security',
  'equipe.comptes': 'Accounts',
  'equipe.registre': 'Register',
  'equipe.clientes': 'Clients',
  'equipe.produit': 'Product',
  'equipe.taches': 'Tasks',
  'equipe.memoire': 'Memory',

  'resume.titre': 'While you were away',
  'resume.chargement': 'The Watch is gathering its night.',
  'resume.indisponible': 'The Watch did not answer. The summary will wait.',
  'resume.ouverture.calme': 'A quiet night.',
  'resume.ouverture.serieux': 'Some things need you. Start at the top.',
  'resume.ouverture.critique': 'A critical problem is open.',
  'resume.rondes.0': 'No round recorded over this period.',
  'resume.rondes.1': 'The Watch made one round.',
  'resume.rondes.n': 'The Watch made {n} rounds.',
  'resume.regles.1': 'It settled one issue without you.',
  'resume.regles.n': 'It settled {n} issues without you.',
  'resume.remontes.1': 'One issue was raised to you.',
  'resume.remontes.n': '{n} issues were raised to you.',
  'resume.ratees.1': 'One action failed during the rounds.',
  'resume.ratees.n': '{n} actions failed during the rounds.',
  'resume.critique.1': 'One critical case awaits your decision.',
  'resume.critique.n': '{n} critical cases await your decision.',
  'resume.decision.1': 'One case awaits a decision.',
  'resume.decision.n': '{n} cases await a decision.',
  'resume.echec.1': 'One watch is failing. Check it this morning.',
  'resume.echec.n': '{n} watches are failing. Check them this morning.',
  'resume.rien': 'Nothing awaits your decision.',
  'resume.ajmani': 'Ajmani',

  'fil.titre': 'The Watch right now',
  'fil.aria': 'Watch activity, by team',
  'fil.repos': 'Resting.',
  'fil.vide': 'The Watch has said nothing yet.',
  'fil.gardes.1': 'one watch',
  'fil.gardes.n': '{n} watches',
  'fil.echec.1': 'One watch is failing.',
  'fil.echec.n': '{n} watches are failing.',
  'fil.suspecte': 'Suspicious attempt reported by this desk.',
  'fil.maintenant': 'now',

  'salle.titre': 'Situation room',
  'salle.reprendre': 'Move the mouse to resume',
  'salle.carte': 'Situation map. Watch teams in the middle, sites around them.',
  'salle.capitaine': 'Captain',
  'salle.attente': 'The room is getting ready.',
  'salle.calme': 'All quiet. The Watch is on duty.',
  'salle.critiques.1': 'One critical incident is open.',
  'salle.critiques.n': '{n} critical incidents are open.',
  'salle.horsLigne.1': 'One site no longer answers.',
  'salle.horsLigne.n': '{n} sites no longer answer.',
  'salle.enLigne': '{n} online',
  'salle.horsLigneCompte': '{n} offline',
  'salle.incidents.1': 'one incident',
  'salle.incidents.n': '{n} incidents',
  'salle.ouvrir': 'Open the situation room',
  'salle.page.surtitre': 'Supervisor · situation room',
  'salle.page.titre': 'The Watch, at a glance.',
  'salle.page.lede': 'Teams in the middle, sites around them. Lines show who worked where.',

  'alertes.titre': 'Critical alerts when the app is closed',
  'alertes.texte': 'Only what cannot wait. A notification, and an email if you want one.',
  'alertes.notification': 'Notification',
  'alertes.email': 'Email',
  'alertes.type.incident-critique': 'Critical incident on a site',
  'alertes.type.escalade': 'Critical incident nobody has taken',
  'alertes.type.site-muet': 'A site has stopped answering',
  'alertes.type.garde-en-echec': 'A watch keeps failing',
  'alertes.type.remontee-critique': 'Critical case raised by the Watch',
} as const;

export type CleGarde = keyof typeof EN;

const FR: Record<CleGarde, string> = {
  'equipe.sites': 'Sites',
  'equipe.securite': 'Sécurité',
  'equipe.comptes': 'Comptes',
  'equipe.registre': 'Registre',
  'equipe.clientes': 'Clientes',
  'equipe.produit': 'Produit',
  'equipe.taches': 'Tâches',
  'equipe.memoire': 'Mémoire',

  'resume.titre': 'Pendant votre absence',
  'resume.chargement': 'La Garde rassemble sa nuit.',
  'resume.indisponible': 'La Garde n’a pas répondu. Le résumé attendra.',
  'resume.ouverture.calme': 'Nuit calme.',
  'resume.ouverture.serieux': 'Des points vous attendent. Commencez par le haut.',
  'resume.ouverture.critique': 'Un problème critique est ouvert.',
  'resume.rondes.0': 'Aucune ronde enregistrée sur la période.',
  'resume.rondes.1': 'La Garde a fait une ronde.',
  'resume.rondes.n': 'La Garde a fait {n} rondes.',
  'resume.regles.1': 'Elle a réglé un point sans vous.',
  'resume.regles.n': 'Elle a réglé {n} points sans vous.',
  'resume.remontes.1': 'Un point vous a été remonté.',
  'resume.remontes.n': '{n} points vous ont été remontés.',
  'resume.ratees.1': 'Une action a échoué pendant les rondes.',
  'resume.ratees.n': '{n} actions ont échoué pendant les rondes.',
  'resume.critique.1': 'Un dossier critique attend votre décision.',
  'resume.critique.n': '{n} dossiers critiques attendent votre décision.',
  'resume.decision.1': 'Un dossier attend une décision.',
  'resume.decision.n': '{n} dossiers attendent une décision.',
  'resume.echec.1': 'Une garde est en échec. À vérifier ce matin.',
  'resume.echec.n': '{n} gardes sont en échec. À vérifier ce matin.',
  'resume.rien': 'Rien n’attend votre décision.',
  'resume.ajmani': 'Ajmani',

  'fil.titre': 'La Garde en ce moment',
  'fil.aria': 'Activité de la Garde, par équipe',
  'fil.repos': 'Au repos.',
  'fil.vide': 'La Garde n’a encore rien dit.',
  'fil.gardes.1': 'une garde',
  'fil.gardes.n': '{n} gardes',
  'fil.echec.1': 'Une garde en échec.',
  'fil.echec.n': '{n} gardes en échec.',
  'fil.suspecte': 'Tentative suspecte signalée par le poste.',
  'fil.maintenant': 'à l’instant',

  'salle.titre': 'Salle de situation',
  'salle.reprendre': 'Bougez la souris pour reprendre',
  'salle.carte': 'Carte de situation. Les équipes de la Garde au centre, les sites autour.',
  'salle.capitaine': 'Capitaine',
  'salle.attente': 'La salle se met en place.',
  'salle.calme': 'Parc calme. La Garde veille.',
  'salle.critiques.1': 'Un incident critique est ouvert.',
  'salle.critiques.n': '{n} incidents critiques sont ouverts.',
  'salle.horsLigne.1': 'Un site ne répond plus.',
  'salle.horsLigne.n': '{n} sites ne répondent plus.',
  'salle.enLigne': '{n} en ligne',
  'salle.horsLigneCompte': '{n} hors ligne',
  'salle.incidents.1': 'un incident',
  'salle.incidents.n': '{n} incidents',
  'salle.ouvrir': 'Ouvrir la salle de situation',
  'salle.page.surtitre': 'Supervisor · salle de situation',
  'salle.page.titre': 'La Garde, d’un coup d’œil.',
  'salle.page.lede': 'Les équipes au centre, les sites autour. Les lignes disent qui a travaillé où.',

  'alertes.titre': 'Alertes critiques quand l’app est fermée',
  'alertes.texte': 'Seulement ce qui ne peut pas attendre. Une notification, et un e-mail si vous le voulez.',
  'alertes.notification': 'Notification',
  'alertes.email': 'E-mail',
  'alertes.type.incident-critique': 'Incident critique sur un site',
  'alertes.type.escalade': 'Incident critique que personne n’a pris',
  'alertes.type.site-muet': 'Un site ne répond plus',
  'alertes.type.garde-en-echec': 'Une garde échoue sans relâche',
  'alertes.type.remontee-critique': 'Dossier critique remonté par la Garde',
};

export const DICTIONNAIRES_GARDE: Record<Langue, Record<CleGarde, string>> = { en: EN, fr: FR };

/** Le mot, avec ses `{variables}` remplacées. */
export function traduireGarde(langue: Langue, cle: CleGarde, vars: Record<string, string | number> = {}): string {
  const brut = DICTIONNAIRES_GARDE[langue][cle] ?? EN[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Les familles de clés qui se comptent : `<base>.1`, `<base>.n`, et `<base>.0` si elle existe. */
type BaseComptee<K = CleGarde> = K extends `${infer B}.n` ? B : never;
export type CleComptee = BaseComptee;

export function compte(langue: Langue, base: CleComptee, n: number, vars: Record<string, string | number> = {}): string {
  const zero = `${base}.0` as CleGarde;
  const cle = (n === 0 && zero in EN ? zero : n === 1 ? `${base}.1` : `${base}.n`) as CleGarde;
  return traduireGarde(langue, cle, { n, ...vars });
}

/** Comme `useSocleLangue`, pour les mots de la Garde visible. */
export function useGardeLangue() {
  const { langue } = useLangue();
  return {
    langue,
    tg: (cle: CleGarde, vars?: Record<string, string | number>) => traduireGarde(langue, cle, vars),
    tc: (base: CleComptee, n: number, vars?: Record<string, string | number>) => compte(langue, base, n, vars),
  };
}
