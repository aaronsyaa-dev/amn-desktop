/**
 * LE MAGASIN DES PRÉFÉRENCES (H40) — enregistrement immédiat, retour arrière si le serveur refuse.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Un geste = un enregistrement. Ordre des choses, pour chaque changement :
 *
 *   1. la règle de sécurité (la dernière case de « Sécurité » ne s'éteint pas) ;
 *   2. le réglage change À L'ÉCRAN et dans le stockage local, tout de suite ;
 *   3. si le compte a des préférences distantes (`bridge().remote.prefs`, clé `notifications`) et que le poste
 *      est en ligne, l'ensemble part au serveur. S'il refuse (ou ne répond pas en 10 s), le champ REVIENT à sa
 *      valeur d'avant — seulement ce champ, les autres gestes en vol ne bougent pas — et `echec` dit quoi rejouer :
 *      la page affiche « Le réglage n'a pas pu être enregistré. » avec « Réessayer » ;
 *   4. hors ligne, le changement reste en local et rejoint la file (`enAttente`) ; il part au retour du réseau.
 *
 * Quand le serveur n'a pas du tout de préférences pour ce compte (session de support, ancienne API : la lecture
 * initiale échoue), les réglages vivent en local et ne reviennent JAMAIS en arrière : sans cela chaque case
 * s'éteindrait aussitôt allumée. Les canaux Mail et Mobile n'ont aucun émetteur : voir l'en-tête de `reglages.ts`.
 */
import {
  CLE_DISTANTE,
  appliquerChangement,
  ecrireReglagesLocaux,
  lireReglage,
  lireReglagesLocaux,
  normaliserReglages,
  peutChanger,
  type ChangementReglage,
  type ReglagesNotifications,
} from './reglages';

export interface PrefsDistantes {
  get(): Promise<Record<string, unknown>>;
  set(key: string, value: unknown): Promise<unknown>;
}

export interface InstantaneReglages {
  reglages: ReglagesNotifications;
  /** Les changements qu'un enregistrement refusé a fait revenir en arrière ; `[]` après un retour réseau raté. */
  echec: ChangementReglage[] | null;
  /** Combien de gestes attendent le retour du réseau. */
  enAttente: number;
}

export interface OptionsMagasinReglages {
  stockage: Pick<Storage, 'getItem' | 'setItem'> | null;
  distant: PrefsDistantes | null;
  enLigne: () => boolean;
  delaiMs?: number;
}

export interface MagasinReglages {
  abonner(rappel: () => void): () => void;
  instantane(): InstantaneReglages;
  selectionnerCompte(email: string): void;
  /** Rend `false` quand la règle de sécurité refuse le changement. */
  changer(changements: readonly ChangementReglage[]): boolean;
  reessayer(): void;
  retourReseau(): void;
}

const DELAI_PAR_DEFAUT = 10_000;

export function creerMagasinReglages(options: OptionsMagasinReglages): MagasinReglages {
  const { stockage, distant, enLigne } = options;
  const delai = options.delaiMs ?? DELAI_PAR_DEFAUT;
  const abonnes = new Set<() => void>();
  let email = '';
  let courant: InstantaneReglages = { reglages: lireReglagesLocaux(stockage, email), echec: null, enAttente: 0 };
  let distantDisponible = false;
  let modifieDepuisLaLecture = false;
  let generation = 0;

  const maj = (suite: Partial<InstantaneReglages>): void => {
    courant = { ...courant, ...suite };
    for (const a of abonnes) a();
  };

  const envoyer = (reglages: ReglagesNotifications): Promise<unknown> => {
    if (!distant) return Promise.resolve();
    return Promise.race([distant.set(CLE_DISTANTE, reglages), new Promise((_, rejet) => setTimeout(() => rejet(new Error('delai')), delai))]);
  };

  const magasin: MagasinReglages = {
    abonner(rappel) {
      abonnes.add(rappel);
      return () => {
        abonnes.delete(rappel);
      };
    },
    instantane: () => courant,

    selectionnerCompte(nouveau) {
      if (nouveau === email && generation > 0) return;
      email = nouveau;
      generation += 1;
      const maGeneration = generation;
      distantDisponible = false;
      modifieDepuisLaLecture = false;
      courant = { reglages: lireReglagesLocaux(stockage, email), echec: null, enAttente: 0 };
      for (const a of abonnes) a();
      if (!distant || !email) return;
      // Le serveur fait foi au chargement (il suit la personne d'un appareil à l'autre) ; le local est le repli.
      void distant
        .get()
        .then((prefs) => {
          if (maGeneration !== generation) return;
          distantDisponible = true;
          const distante = prefs[CLE_DISTANTE];
          if (distante && !modifieDepuisLaLecture) {
            const reglages = normaliserReglages(distante);
            ecrireReglagesLocaux(stockage, email, reglages);
            maj({ reglages });
          }
        })
        .catch(() => {
          /* pas de préférences distantes pour ce compte : le local suffit */
        });
    },

    changer(changements) {
      const avant = courant.reglages;
      if (!changements.every((c) => peutChanger(avant, c))) return false;
      const precedent = changements.map((c) => ({ chemin: c.chemin, valeur: lireReglage(avant, c.chemin) }));
      let apres = avant;
      for (const c of changements) apres = appliquerChangement(apres, c);
      modifieDepuisLaLecture = true;
      ecrireReglagesLocaux(stockage, email, apres);
      maj({ reglages: apres, echec: null });
      if (!distant || !distantDisponible) return true;
      if (!enLigne()) {
        maj({ enAttente: courant.enAttente + 1 });
        return true;
      }
      const maGeneration = generation;
      void envoyer(apres).catch(() => {
        if (maGeneration !== generation) return;
        // On ne défait que ces champs, et seulement s'ils n'ont pas bougé depuis.
        let restaure = courant.reglages;
        for (let i = 0; i < changements.length; i += 1) {
          if (lireReglage(restaure, changements[i].chemin) === changements[i].valeur) restaure = appliquerChangement(restaure, { chemin: precedent[i].chemin, valeur: precedent[i].valeur });
        }
        ecrireReglagesLocaux(stockage, email, restaure);
        maj({ reglages: restaure, echec: [...changements] });
      });
      return true;
    },

    reessayer() {
      const rejouer = courant.echec;
      if (rejouer && rejouer.length > 0) {
        magasin.changer(rejouer);
        return;
      }
      magasin.retourReseau();
    },

    retourReseau() {
      if (!distant || !distantDisponible) return;
      if (courant.enAttente === 0 && courant.echec === null) return;
      const maGeneration = generation;
      void envoyer(courant.reglages)
        .then(() => {
          if (maGeneration === generation) maj({ enAttente: 0, echec: null });
        })
        .catch(() => {
          if (maGeneration === generation) maj({ echec: [] });
        });
    },
  };
  return magasin;
}
