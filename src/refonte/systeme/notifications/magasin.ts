/**
 * LE MAGASIN DES NOTIFICATIONS (H40) — un seul, lu par la page ET par la cloche de l'en-tête.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Un magasin de module (le même dessin que `src/refonte/coquille/drapeau.ts`) : des abonnés, un instantané
 * stable entre deux changements, `useSyncExternalStore` pour s'y brancher. Il porte :
 *
 *   · les SOURCES alimentées de l'extérieur (points d'attention, messages privés, rendez-vous) et les moments du
 *     bus (`ajouterMoment`, gardés 50 au plus et 30 jours) ;
 *   · l'ÉTAT de la personne (`etat.ts`) : première vue, lu / non lu, reporté, ouvertures. Clé locale par compte :
 *     `amn.notifications.etat.<adresse>`. Un stockage refusé ne casse rien : tout reste en mémoire ;
 *   · l'ÉCHÉANCE des reports : une notification reportée disparaît, puis revient en non lue à l'heure dite
 *     (le magasin se réveille tout seul à la prochaine échéance).
 *
 * La cloche ne recalcule rien : elle lit `useNotificationsNonLues()` (`useNotifications.ts`), qui s'appuie sur le
 * MÊME filtre et le MÊME compteur que l'onglet « Non lues ». Ce fichier est sans React hormis le crochet
 * d'abonnement ; l'horloge et le stockage s'injectent, d'où son contrôle hors navigateur.
 */
import { useSyncExternalStore } from 'react';
import { categorieDe, type CategorieReglage, type Notification, type NotificationBrute, type NotificationSource } from './modele';
import {
  ajouterEvenement,
  annulerReport,
  appliquerEtat,
  dater,
  elaguer,
  etatVide,
  garderJusqua,
  marquerLue,
  marquerNonLue,
  noterOuverture,
  normaliserEtat,
  prochaineEcheance,
  reporter as reporterEtat,
  restaurerLues,
  toutMarquerLu,
  type EtatNotifications,
} from './etat';

export type StatutChargement = 'chargement' | 'pret' | 'erreur';
export type NomSource = 'attention' | 'messages' | 'rendez-vous';
const SOURCES: readonly NomSource[] = ['attention', 'messages', 'rendez-vous'];

export const cleLocaleEtat = (email: string): string => `amn.notifications.etat.${email || 'anonyme'}`;

export interface InstantaneNotifications {
  statut: StatutChargement;
  /** Vrai quand la coquille alimente déjà le magasin : la page n'a pas à le faire elle-même. */
  alimenteParLaCoquille: boolean;
  /** Les notifications après report, lu et rétention — AVANT le filtre des réglages et des modules ouverts. */
  notifications: Notification[];
  etat: EtatNotifications;
}

export interface OptionsMagasin {
  stockage: Pick<Storage, 'getItem' | 'setItem'> | null;
  maintenant?: () => Date;
  /** Programme `rappel` dans `ms` millisecondes ; rend l'annulation. */
  planifier?: (rappel: () => void, ms: number) => () => void;
}

export interface Magasin {
  abonner(rappel: () => void): () => void;
  instantane(): InstantaneNotifications;
  selectionnerCompte(email: string): void;
  alimenter(source: NomSource, notifications: readonly NotificationSource[]): void;
  poserStatut(statut: StatutChargement): void;
  ajouterMoment(notification: NotificationBrute): void;
  ouvrir(id: string): void;
  basculerLue(id: string): void;
  /** Reporte jusqu'à `echeance` ; rend la fonction qui défait. */
  reporter(id: string, echeance: Date): () => void;
  /** Marque lues les notifications données ; rend la fonction qui défait. */
  toutMarquerLu(ids: readonly string[]): () => void;
  garder(categorie: CategorieReglage, jusqua: Date): void;
  rafraichir(): void;
  /** Un alimentateur se déclare (la coquille, ou la page à défaut) ; rend la fonction qui le retire. */
  declarerAlimentateur(genre: 'coquille' | 'page'): () => void;
}

const DELAI_MAX = 2 ** 31 - 1;

export function creerMagasinNotifications(options: OptionsMagasin): Magasin {
  const { stockage } = options;
  const maintenant = options.maintenant ?? (() => new Date());
  const planifier = options.planifier ?? ((rappel, ms) => {
    const t = setTimeout(rappel, ms);
    return () => clearTimeout(t);
  });
  const abonnes = new Set<() => void>();
  let email = '';
  let etat: EtatNotifications = lireEtat(stockage, email);
  let statut: StatutChargement = 'chargement';
  const sources: Record<NomSource, readonly NotificationSource[]> = { attention: [], messages: [], 'rendez-vous': [] };
  let annulerReveil: (() => void) | null = null;
  let compteChoisi = false;
  const alimentateurs = { coquille: 0, page: 0 };
  let courant: InstantaneNotifications = { statut, alimenteParLaCoquille: false, notifications: [], etat };

  function lireEtat(s: OptionsMagasin['stockage'], adresse: string): EtatNotifications {
    try {
      const brut = s?.getItem(cleLocaleEtat(adresse));
      return brut ? normaliserEtat(JSON.parse(brut)) : etatVide();
    } catch {
      return etatVide();
    }
  }

  function ecrire(): void {
    try {
      stockage?.setItem(cleLocaleEtat(email), JSON.stringify(etat));
    } catch {
      /* stockage refusé : l'état vaut pour cette session */
    }
  }

  /** Recalcule l'instantané : dérivé des sources, de l'état et de l'heure, puis prévient les abonnés. */
  function recalculer(): void {
    const t = maintenant();
    const evenements: NotificationSource[] = etat.evenements;
    const toutes: NotificationSource[] = [];
    const vus = new Set<string>();
    for (const liste of [...SOURCES.map((s) => sources[s]), evenements]) {
      for (const n of liste) {
        if (vus.has(n.id)) continue;
        vus.add(n.id);
        toutes.push(n);
      }
    }
    const avant = etat;
    const datees = dater(toutes, etat, t);
    // On n'élague qu'une fois les sources arrivées : un identifiant pas encore revu ne perd pas sa première vue.
    etat = statut === 'pret' ? elaguer(datees.etat, vus, t) : datees.etat;
    if (etat !== avant) ecrire();
    courant = { statut, alimenteParLaCoquille: alimentateurs.coquille > 0, notifications: appliquerEtat(datees.notifications, etat, t), etat };
    reveiller(t);
    for (const a of abonnes) a();
  }

  /** Se réveille à la prochaine échéance de report : la notification revient, non lue, sans qu'on touche à rien. */
  function reveiller(t: Date): void {
    annulerReveil?.();
    annulerReveil = null;
    const prochaine = prochaineEcheance(etat, t);
    if (prochaine === null) return;
    const delai = Math.min(DELAI_MAX, Math.max(0, prochaine - t.getTime()) + 50);
    annulerReveil = planifier(recalculer, delai);
  }

  function modifier(suite: EtatNotifications): void {
    etat = suite;
    ecrire();
    recalculer();
  }

  return {
    abonner(rappel) {
      abonnes.add(rappel);
      return () => {
        abonnes.delete(rappel);
      };
    },
    instantane: () => courant,

    selectionnerCompte(adresse) {
      if (compteChoisi && adresse === email) return;
      compteChoisi = true;
      email = adresse;
      etat = lireEtat(stockage, email);
      for (const s of SOURCES) sources[s] = [];
      statut = 'chargement';
      recalculer();
    },

    alimenter(source, notifications) {
      // Une source qui redit la même chose (le moteur d'attention se recalcule) ne réveille personne.
      if (JSON.stringify(sources[source]) === JSON.stringify(notifications)) return;
      sources[source] = notifications;
      recalculer();
    },

    declarerAlimentateur(genre) {
      alimentateurs[genre] += 1;
      recalculer();
      return () => {
        alimentateurs[genre] -= 1;
        recalculer();
      };
    },

    poserStatut(suivant) {
      if (suivant === statut) return;
      statut = suivant;
      recalculer();
    },

    ajouterMoment(notification) {
      modifier(ajouterEvenement(etat, notification, maintenant()));
    },

    ouvrir(id) {
      const n = courant.notifications.find((x) => x.id === id);
      let suite = marquerLue(etat, id, maintenant());
      if (n) suite = noterOuverture(suite, categorieDe(n.type), maintenant());
      modifier(suite);
    },

    basculerLue(id) {
      const n = courant.notifications.find((x) => x.id === id);
      if (!n) return;
      modifier(n.lue ? marquerNonLue(etat, id) : marquerLue(etat, id, maintenant()));
    },

    reporter(id, echeance) {
      const avantReport = etat.reportees[id];
      modifier(reporterEtat(etat, id, echeance));
      return () => modifier(annulerReport(etat, id, avantReport));
    },

    toutMarquerLu(ids) {
      const { etat: suite, avant } = toutMarquerLu(etat, ids, maintenant());
      modifier(suite);
      return () => modifier(restaurerLues(etat, avant));
    },

    garder(categorie, jusqua) {
      modifier(garderJusqua(etat, categorie, jusqua));
    },

    rafraichir: recalculer,
  };
}

function stockageDuPoste(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Le magasin du poste : un seul, partagé par la page et la cloche. */
export const magasinNotifications: Magasin = creerMagasinNotifications({ stockage: stockageDuPoste() });

/** S'abonne à un magasin (la page, la cloche : le même instantané). */
export function useInstantane(magasin: Magasin = magasinNotifications): InstantaneNotifications {
  return useSyncExternalStore(magasin.abonner, magasin.instantane, magasin.instantane);
}
