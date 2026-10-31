/**
 * LES CROCHETS DE LA PAGE NOTIFICATIONS (H40) — le câblage aux données réelles de l'application.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `modele.ts`, `etat.ts`, `sources.ts`, `reglages.ts` et les deux magasins ne connaissent ni l'authentification, ni
 * la synchronisation, ni le pont Electron : c'est ce fichier, et lui seul, qui les branche.
 *
 *   · `useNotificationsNonLues()`  — le nombre de la pastille de la cloche. C'est LE MÊME calcul que l'onglet
 *     « Non lues » (`visibles` puis `compteurs`) : les deux ne peuvent pas diverger. À poser dans la coquille.
 *   · `useNotificationsNonLuesAvec(items, evalue)` — pareil, quand la coquille a déjà lu `useAttention()` (elle
 *     l'a : `donnees.attention` et `donnees.attentionEvaluee`) et ne veut pas le relire.
 *   · `useAlimenterNotifications()` / `…Avec(items, evalue)` — nourrit le magasin des sources réelles. Les deux
 *     crochets de cloche ci-dessus le font eux-mêmes ; la page le fait seulement si la coquille ne l'a pas fait.
 *   · `useNotifications()` — ce que la page lit : les lignes visibles, les compteurs, l'état de chargement.
 *   · `useReglagesNotifications()` — la matrice, les heures calmes, le résumé du matin.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { bridge } from '../../../lib/bridge';
import { isModuleEnabled } from '../../../data/spaces';
import { langueActive } from '../../../i18n';
import { subscribe } from '../../../socle/moments';
import { useProfilesOptionnel } from '../../../state/ProfilesContext';
import { useCollection } from '../../../state/SyncContext';
import { useAppointments } from '../../../state/useAppointments';
import { useAttention } from '../../../state/useAttention';
import type { AttentionItem } from '../../../lib/attention';
import { useMessagesPrivesNonLus } from '../../../state/messagesPrives';
import { traduire, type Traduire } from './i18n';
import { creerMagasinReglages, type PrefsDistantes } from './magasinReglages';
import { magasinNotifications, useInstantane, type InstantaneNotifications } from './magasin';
import { compteurs, filtrerParReglages, suggestionMoinsDeBruit, type Compteurs, type Notification, type SuggestionMoinsDeBruit } from './modele';
import { appActif, type ReglagesNotifications } from './reglages';
import { attentionVersNotifications, messagesVersNotifications, momentVersNotification, MOMENTS_NOTIFIANTS, rendezVousVersNotifications, type MessagesDunCorrespondant } from './sources';

const t: Traduire = (cle, params) => traduire(langueActive(), cle, params);
const localeDe = (): string => (langueActive() === 'en' ? 'en-GB' : 'fr-FR');

/* ── Les préférences : un magasin pour le poste, branché sur le compte ───── */

const distant: PrefsDistantes = {
  // `async` : un pont absent (session de support, navigateur sans compte) devient un refus, pas une exception.
  get: async () => bridge().remote.prefs.get(),
  set: async (cle, valeur) => bridge().remote.prefs.set(cle, valeur),
};

function stockageDuPoste(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const enLigne = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

export const magasinReglages = creerMagasinReglages({ stockage: stockageDuPoste(), distant, enLigne });

/** Les lignes que la personne voit et compte : modules ouverts et canal « App » (voir `filtrerParReglages`). */
export function visibles(notifications: readonly Notification[], reglages: ReglagesNotifications): Notification[] {
  return filtrerParReglages(notifications, { appActif: (c) => appActif(reglages, c), moduleOuvert: isModuleEnabled });
}

/* ── Les sources réelles ─────────────────────────────────────────────────── */

let abonnementsAuBus = 0;
let desabonnerLeBus: (() => void) | null = null;

/** Écoute le bus de moments une seule fois, quel que soit le nombre d'alimentateurs montés. */
function ecouterLeBus(): () => void {
  abonnementsAuBus += 1;
  if (abonnementsAuBus === 1) {
    desabonnerLeBus = subscribe('*', (moment) => {
      if (!(MOMENTS_NOTIFIANTS as readonly string[]).includes(moment.type)) return;
      const notification = momentVersNotification(moment, t);
      if (notification) magasinNotifications.ajouterMoment(notification);
    });
  }
  return () => {
    abonnementsAuBus -= 1;
    if (abonnementsAuBus === 0) {
      desabonnerLeBus?.();
      desabonnerLeBus = null;
    }
  };
}

function nomDepuisAdresse(email: string): string {
  return (email.split('@')[0] || email).replace(/[._-]+/g, ' ').replace(/(^|\s)(\S)/g, (_, a: string, b: string) => a + b.toUpperCase());
}

interface MessagePriveLu {
  from: string;
  to: string;
  body?: string;
  createdAt?: string;
}

/** Nourrit le magasin des sources réelles. `genre` dit qui le fait : la coquille (cloche) ou, à défaut, la page. */
function useSources(points: readonly AttentionItem[], evalues: boolean, genre: 'coquille' | 'page'): void {
  const { user } = useAuth();
  const email = user?.email ?? '';
  const profils = useProfilesOptionnel();
  const dms = useCollection<MessagePriveLu>('dms');
  const nonLus = useMessagesPrivesNonLus();
  const { appointments } = useAppointments();

  useEffect(() => {
    magasinNotifications.selectionnerCompte(email);
    magasinReglages.selectionnerCompte(email);
  }, [email]);

  useEffect(() => magasinNotifications.declarerAlimentateur(genre), [genre]);
  useEffect(() => ecouterLeBus(), []);
  useEffect(() => {
    const retour = () => magasinReglages.retourReseau();
    window.addEventListener('online', retour);
    return () => window.removeEventListener('online', retour);
  }, []);

  // Le moteur d'attention n'a de « fin d'évaluation » que quand toutes ses sources ont répondu.
  useEffect(() => {
    magasinNotifications.alimenter('attention', attentionVersNotifications(points, t));
  }, [points]);
  // Après les sources : « prêt » autorise l'élagage, qui ne doit pas voir une liste encore vide.
  useEffect(() => {
    magasinNotifications.poserStatut(evalues ? 'pret' : 'chargement');
  }, [evalues]);

  useEffect(() => {
    const entrees: MessagesDunCorrespondant[] = [];
    for (const [adresse, nombre] of nonLus.parCorrespondant) {
      const derniers = dms.filter((m) => m.from === adresse && m.to === email).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      const dernier = derniers[0];
      entrees.push({
        email: adresse,
        nom: profils?.profileFor(adresse).name ?? nomDepuisAdresse(adresse),
        nombre,
        apercu: dernier?.body ?? '',
        date: dernier?.createdAt && !Number.isNaN(Date.parse(dernier.createdAt)) ? dernier.createdAt : new Date().toISOString(),
      });
    }
    magasinNotifications.alimenter('messages', messagesVersNotifications(entrees, t));
  }, [nonLus.parCorrespondant, dms, email, profils]);

  // Les rendez-vous se recomptent à la minute (« dans 30 minutes » devient « dans 29 »).
  useEffect(() => {
    const lire = () =>
      magasinNotifications.alimenter(
        'rendez-vous',
        rendezVousVersNotifications(
          appointments.map((a) => ({ id: a.id, title: a.title, startAt: a.startAt, clientName: a.clientName, location: a.location, status: a.status })),
          new Date(),
          t,
          localeDe(),
        ),
      );
    lire();
    const minuteur = window.setInterval(lire, 60_000);
    return () => window.clearInterval(minuteur);
  }, [appointments]);
}

/**
 * À poser dans la coquille, qui a déjà lu `useAttention()` : nourrit le magasin sans relire le moteur.
 * `evalue` est vrai quand toutes les sources du moteur ont répondu (`checkedAt !== null`, ou `attentionEvaluee`).
 */
export function useAlimenterNotificationsAvec(points: readonly AttentionItem[], evalue: boolean): void {
  useSources(points, evalue, 'coquille');
}

/** À poser dans la coquille quand elle n'a pas déjà lu `useAttention()`. */
export function useAlimenterNotifications(): void {
  const { items, checkedAt } = useAttention();
  useSources(items, checkedAt !== null, 'coquille');
}

/** Le recours de la page : elle nourrit le magasin si la coquille ne le fait pas. */
export function useAlimenterPourLaPage(points: readonly AttentionItem[], evalue: boolean): void {
  useSources(points, evalue, 'page');
}

/* ── Ce que lisent la cloche et la page ──────────────────────────────────── */

function abonnerAuxDeux(rappel: () => void): () => void {
  const a = magasinNotifications.abonner(rappel);
  const b = magasinReglages.abonner(rappel);
  return () => {
    a();
    b();
  };
}

const nonLuesVisibles = (): number => compteurs(visibles(magasinNotifications.instantane().notifications, magasinReglages.instantane().reglages)).nonLues;

/** La pastille de la cloche : le nombre de « Non lues » de la page, jamais un autre calcul. Alimente le magasin. */
export function useNotificationsNonLues(): number {
  useAlimenterNotifications();
  return useSyncExternalStore(abonnerAuxDeux, nonLuesVisibles, () => 0);
}

/** Comme `useNotificationsNonLues`, avec l'état d'attention que la coquille a déjà lu. */
export function useNotificationsNonLuesAvec(points: readonly AttentionItem[], evalue: boolean): number {
  useAlimenterNotificationsAvec(points, evalue);
  return useSyncExternalStore(abonnerAuxDeux, nonLuesVisibles, () => 0);
}

export interface VueDesNotifications {
  statut: InstantaneNotifications['statut'];
  alimenteParLaCoquille: boolean;
  /** Les lignes que la personne voit (modules ouverts, canal « App »), triées par `grouper` à l'affichage. */
  notifications: Notification[];
  compteurs: Compteurs;
  suggestion: SuggestionMoinsDeBruit | null;
}

export function useNotifications(maintenant: Date): VueDesNotifications {
  const instantane = useInstantane(magasinNotifications);
  const reglages = useSyncExternalStore(magasinReglages.abonner, () => magasinReglages.instantane().reglages, () => magasinReglages.instantane().reglages);
  const notifications = useMemo(() => visibles(instantane.notifications, reglages), [instantane.notifications, reglages]);
  const compte = useMemo(() => compteurs(notifications), [notifications]);
  const minute = Math.floor(maintenant.getTime() / 60_000);
  const suggestion = useMemo(
    () => suggestionMoinsDeBruit(notifications, instantane.etat.ouvertures, instantane.etat.gardees, new Date(minute * 60_000)),
    // La minute suffit : la suggestion se compte en jours.
    [notifications, instantane.etat, minute],
  );
  return { statut: instantane.statut, alimenteParLaCoquille: instantane.alimenteParLaCoquille, notifications, compteurs: compte, suggestion };
}

export function useReglagesNotifications() {
  const instantane = useSyncExternalStore(magasinReglages.abonner, magasinReglages.instantane, magasinReglages.instantane);
  const changer = useCallback((changements: Parameters<typeof magasinReglages.changer>[0]) => magasinReglages.changer(changements), []);
  const reessayer = useCallback(() => magasinReglages.reessayer(), []);
  return { ...instantane, changer, reessayer };
}
