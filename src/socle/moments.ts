import type { Famille } from './familles';

/**
 * LE BUS DE MOMENTS — « quelque chose vient d'arriver », dit une fois.
 * ════════════════════════════════════════════════════════════════════
 *
 * Une facture payée, un client créé, un rendez-vous qui approche, une
 * tentative suspecte : aujourd'hui chaque écran qui veut y réagir le
 * redécouvre à sa façon (`Celebrations.tsx` compte des collections, les
 * rappels de rendez-vous ont leur minuterie). Le bus donne UN endroit où le
 * dire, et un seul où l'écouter — l'Accueil, la mascotte, le Supervisor s'y
 * brancheront plus tard.
 *
 * Module SANS React et sans dépendance : il s'éprouve hors application
 * (`npm run check:moments`).
 *
 * ## Ce qu'il fait, et rien de plus
 *
 *   · `emit(type, charge)` prévient, de façon synchrone, les abonnés du type
 *     puis ceux de `'*'` ;
 *   · un abonné qui lève une erreur ne prive pas les suivants du moment ;
 *   · `subscribe` rend sa propre désinscription ;
 *   · aucun historique, aucune file, aucune persistance, aucune interface.
 *     Le seul témoin est le journal de développement (`poserJournal`), que
 *     l'édition interne pose en `npm start` et nulle part ailleurs.
 *
 * ## La charge : des identifiants, jamais des données
 *
 * Un moment dit QUOI et OÙ le retrouver (`clientId`, `factureId`), pas le
 * contenu : ni nom, ni adresse, ni montant libellé, ni secret. Un abonné qui
 * veut le détail le relit dans sa collection. C'est ce qui permet de journaliser
 * un moment sans craindre de journaliser une cliente.
 */

/* ── Le catalogue ─────────────────────────────────────────────────────────── */

/**
 * Le ton d'un moment, pour qui voudra y réagir :
 *   fete     — une réussite (une phrase chaleureuse, une fois) ;
 *   info     — à savoir, rien à faire ;
 *   decision — quelqu'un doit trancher : c'est le seul ton qui a droit à l'ambre ;
 *   critique — le rouge, réservé.
 */
export type TonDeMoment = 'fete' | 'info' | 'decision' | 'critique';

/** La charge de chaque type de moment. Ajouter un type = ajouter une ligne ici ET au catalogue. */
export interface ChargesDeMoments {
  'facture.payee': { factureId: string };
  'facture.envoyee': { factureId: string };
  'facture.en-retard': { factureId: string; joursDeRetard: number };
  'devis.accepte': { devisId: string };
  'client.cree': { clientId: string };
  'rdv.proche': { rdvId: string; dansMinutes: number };
  'tache.terminee': { tacheId: string };
  'projet.cree': { projetId: string };
  'message.recu': { conversationId: string; messageId?: string };
  'tentative.suspecte': { origine: 'connexion' | 'acces' | 'site' | 'autre'; reference?: string };
  'sauvegarde.terminee': { reussie: boolean };
  'synchro.retablie': { horsLigneDepuisMs: number };
  'premiere.fois': { quoi: 'tache' | 'client' | 'facture' | 'projet' };
}

export type TypeDeMoment = keyof ChargesDeMoments;

export interface Moment<T extends TypeDeMoment = TypeDeMoment> {
  type: T;
  charge: ChargesDeMoments[T];
  /** `Date.now()` à l'émission. */
  quand: number;
}

/** Ce que chaque type veut dire : sa famille et son ton. */
export const CATALOGUE_DES_MOMENTS = {
  'facture.payee': { famille: 'argent', ton: 'fete' },
  'facture.envoyee': { famille: 'argent', ton: 'info' },
  'facture.en-retard': { famille: 'argent', ton: 'decision' },
  'devis.accepte': { famille: 'argent', ton: 'fete' },
  'client.cree': { famille: 'contacts', ton: 'fete' },
  'rdv.proche': { famille: 'jour', ton: 'decision' },
  'tache.terminee': { famille: 'jour', ton: 'fete' },
  'projet.cree': { famille: 'creer', ton: 'info' },
  'message.recu': { famille: 'echanger', ton: 'info' },
  'tentative.suspecte': { famille: 'outils', ton: 'critique' },
  'sauvegarde.terminee': { famille: 'outils', ton: 'info' },
  'synchro.retablie': { famille: 'outils', ton: 'info' },
  'premiere.fois': { famille: 'jour', ton: 'fete' },
} as const satisfies Record<TypeDeMoment, { famille: Famille; ton: TonDeMoment }>;

export const TYPES_DE_MOMENTS = Object.keys(CATALOGUE_DES_MOMENTS) as TypeDeMoment[];

/* ── Le bus ───────────────────────────────────────────────────────────────── */

type Abonne<T extends TypeDeMoment> = (moment: Moment<T>) => void;
type AbonneTous = (moment: Moment) => void;

const abonnes = new Map<TypeDeMoment | '*', Set<AbonneTous>>();
let journal: ((moment: Moment) => void) | null = null;

/** Écoute un type de moment, ou tous (`'*'`). Rend la désinscription. */
export function subscribe<T extends TypeDeMoment>(type: T, abonne: Abonne<T>): () => void;
export function subscribe(type: '*', abonne: AbonneTous): () => void;
export function subscribe(type: TypeDeMoment | '*', abonne: AbonneTous): () => void {
  let liste = abonnes.get(type);
  if (!liste) {
    liste = new Set();
    abonnes.set(type, liste);
  }
  // Une copie de la fonction : s'abonner deux fois donne deux désinscriptions
  // indépendantes, au lieu d'une seule entrée de Set partagée.
  const entree: AbonneTous = (m) => abonne(m);
  liste.add(entree);
  return () => {
    liste?.delete(entree);
  };
}

/** Dit qu'un moment vient d'arriver. Synchrone ; rend le moment émis. */
export function emit<T extends TypeDeMoment>(type: T, charge: ChargesDeMoments[T]): Moment<T> {
  const moment: Moment<T> = { type, charge, quand: Date.now() };
  if (journal) {
    try {
      journal(moment as Moment);
    } catch {
      /* un journal qui casse ne casse pas le moment */
    }
  }
  // Copie avant d'itérer : un abonné qui se désinscrit pendant l'appel ne
  // décale pas les suivants.
  const destinataires = [...(abonnes.get(type) ?? []), ...(abonnes.get('*') ?? [])];
  for (const abonne of destinataires) {
    try {
      abonne(moment as Moment);
    } catch (err) {
      // Isolé : la mascotte qui plante ne doit pas empêcher l'Accueil
      // d'apprendre la nouvelle. L'erreur reste visible dans la console,
      // comme le fait `dispatchEvent` pour un écouteur fautif.
      if (typeof globalThis.reportError === 'function') globalThis.reportError(err);
      else console.error(err);
    }
  }
  return moment;
}

/**
 * Le journal de développement : une fonction appelée avant les abonnés, ou
 * `null` pour l'ôter. Posé par l'édition interne en `npm start` seulement.
 */
export function poserJournal(fn: ((moment: Moment) => void) | null): void {
  journal = fn;
}

/** Vide tous les abonnements — pour les contrôles, jamais dans l'application. */
export function reinitialiserMoments(): void {
  abonnes.clear();
  journal = null;
}
