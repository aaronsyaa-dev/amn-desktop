/**
 * LES RÈGLES DES SITUATIONS — sans React, donc éprouvables hors navigateur.
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Même parti que `src/lib/pileCalques.ts` : la règle qui compte vit ici, dans un
 * module qu'un contrôle charge tel quel (`scripts/check-socle-situations.ts`), et les
 * composants ne font que la brancher. Ce sont des propriétés d'EXÉCUTION — « pas
 * de clignotement », « la pause garde le temps restant » — qu'aucune lecture du
 * code ne voit.
 *
 * Trois règles (fiche H43, rubriques 6 et 8) :
 *
 *   1. LE CHARGEMENT DIFFÉRÉ. Un squelette n'apparaît que si l'attente dépasse
 *      150 ms (sinon il clignoterait pour rien), reste au moins 400 ms une fois
 *      affiché (sinon il clignoterait aussi en partant), et au bout de 10 s la
 *      légende avoue que c'est long et propose de réessayer.
 *   2. LE MINUTEUR DU TOAST. 8 s quand il y a un « Annuler », 4 s sinon, jamais
 *      pour une erreur. Survol ou focus le met en pause : le temps restant est
 *      GARDÉ, pas remis à zéro, et plusieurs raisons de pause (souris ET focus)
 *      se cumulent — la reprise n'a lieu que quand la dernière est levée.
 *   3. LA PILE DES TOASTS. Trois au plus ; au quatrième, on retire le plus ancien
 *      — mais jamais une erreur tant qu'un succès peut partir à sa place : une
 *      erreur qui disparaît sans qu'on l'ait lue est un échec silencieux.
 *
 * Toute la mécanique du temps passe par une `Horloge` : celle du navigateur en
 * production, une fausse horloge dans le contrôle.
 */

/* ── Les durées, une seule fois ───────────────────────────────────────────── */

export const DELAI_AFFICHAGE_MS = 150;
export const DUREE_MINIMALE_MS = 400;
export const DELAI_LONG_MS = 10_000;
export const DUREE_TOAST_RETOUR_MS = 8_000;
export const DUREE_TOAST_SIMPLE_MS = 4_000;
export const PILE_TOASTS_MAX = 3;

/* ── L'horloge ────────────────────────────────────────────────────────────── */

export interface Horloge {
  maintenant(): number;
  armer(fn: () => void, ms: number): unknown;
  annuler(poignee: unknown): void;
}

export const horlogeReelle: Horloge = {
  maintenant: () => Date.now(),
  armer: (fn, ms) => setTimeout(fn, ms),
  annuler: (poignee) => clearTimeout(poignee as ReturnType<typeof setTimeout>),
};

/* ── 1. Le chargement différé ─────────────────────────────────────────────── */

export interface EtatChargementDiffere {
  /** Le squelette doit être montré. */
  visible: boolean;
  /** L'attente dépasse 10 s : la légende change et « Réessayer » apparaît. */
  long: boolean;
}

export interface DelaisChargement {
  affichageMs: number;
  minimaleMs: number;
  longMs: number;
}

export const DELAIS_CHARGEMENT: DelaisChargement = {
  affichageMs: DELAI_AFFICHAGE_MS,
  minimaleMs: DUREE_MINIMALE_MS,
  longMs: DELAI_LONG_MS,
};

export interface ChargementDiffere {
  /** Dit si l'attente est en cours. Idempotent : redire la même chose ne fait rien. */
  definir(enCours: boolean): void;
  /** L'état courant. */
  lire(): EtatChargementDiffere;
  /** Arme plus rien : à appeler au démontage. */
  liberer(): void;
}

export function creerChargementDiffere(
  surChangement: (etat: EtatChargementDiffere) => void,
  horloge: Horloge = horlogeReelle,
  delais: DelaisChargement = DELAIS_CHARGEMENT,
): ChargementDiffere {
  let etat: EtatChargementDiffere = { visible: false, long: false };
  let enCours = false;
  let visibleDepuis = 0;
  let tAffichage: unknown;
  let tMasquage: unknown;
  let tLong: unknown;

  const emettre = (suite: Partial<EtatChargementDiffere>) => {
    const prochain = { ...etat, ...suite };
    if (prochain.visible === etat.visible && prochain.long === etat.long) return;
    etat = prochain;
    surChangement(etat);
  };
  const desarmer = (poignee: unknown) => {
    if (poignee !== undefined) horloge.annuler(poignee);
    return undefined;
  };
  const masquer = () => {
    tMasquage = undefined;
    emettre({ visible: false, long: false });
  };

  return {
    definir(valeur) {
      if (valeur === enCours) return;
      enCours = valeur;
      if (valeur) {
        // Une attente qui reprend pendant qu'un masquage est en sursis : le squelette reste, sans clignoter.
        tMasquage = desarmer(tMasquage);
        if (!etat.visible && tAffichage === undefined) {
          tAffichage = horloge.armer(() => {
            tAffichage = undefined;
            visibleDepuis = horloge.maintenant();
            emettre({ visible: true });
          }, delais.affichageMs);
        }
        if (tLong === undefined) {
          tLong = horloge.armer(() => {
            tLong = undefined;
            if (enCours && etat.visible) emettre({ long: true });
          }, delais.longMs);
        }
        return;
      }
      // L'attente est finie. Jamais montré : rien à retirer. Montré : au moins `minimaleMs` d'affichage.
      tAffichage = desarmer(tAffichage);
      tLong = desarmer(tLong);
      if (!etat.visible) return;
      const reste = Math.max(0, delais.minimaleMs - (horloge.maintenant() - visibleDepuis));
      if (reste === 0) masquer();
      else tMasquage = horloge.armer(masquer, reste);
    },
    lire: () => etat,
    liberer() {
      tAffichage = desarmer(tAffichage);
      tMasquage = desarmer(tMasquage);
      tLong = desarmer(tLong);
    },
  };
}

/* ── 2. Le minuteur d'un toast ────────────────────────────────────────────── */

export interface Minuteur {
  /** Lance le compte à rebours (sans effet s'il est déjà lancé, ou fini). */
  demarrer(): void;
  /** Met en pause pour une raison (« survol », « focus »). Les raisons se cumulent. */
  pauser(raison: string): void;
  /** Lève UNE raison. Le temps reprend quand il n'en reste aucune. */
  reprendre(raison: string): void;
  /** Coupe tout : plus aucun rappel ne partira. */
  arreter(): void;
  restantMs(): number;
  enPause(): boolean;
  termine(): boolean;
}

export function creerMinuteur(dureeMs: number, auTerme: () => void, horloge: Horloge = horlogeReelle): Minuteur {
  let restant = Math.max(0, dureeMs);
  let demarre = false;
  let fini = false;
  let coupe = false;
  let enMarche = false;
  let depuis = 0;
  let poignee: unknown;
  const raisons = new Set<string>();

  const armer = () => {
    if (fini || coupe || !demarre || enMarche || raisons.size > 0) return;
    enMarche = true;
    depuis = horloge.maintenant();
    poignee = horloge.armer(() => {
      enMarche = false;
      poignee = undefined;
      restant = 0;
      fini = true;
      auTerme();
    }, restant);
  };
  const figer = () => {
    if (!enMarche) return;
    restant = Math.max(0, restant - (horloge.maintenant() - depuis));
    enMarche = false;
    if (poignee !== undefined) horloge.annuler(poignee);
    poignee = undefined;
  };

  return {
    demarrer() {
      if (demarre) return;
      demarre = true;
      armer();
    },
    pauser(raison) {
      raisons.add(raison);
      figer();
    },
    reprendre(raison) {
      raisons.delete(raison);
      armer();
    },
    arreter() {
      figer();
      coupe = true;
    },
    restantMs: () => (enMarche ? Math.max(0, restant - (horloge.maintenant() - depuis)) : restant),
    enPause: () => raisons.size > 0,
    termine: () => fini,
  };
}

/** Ce qui reste de la barre de temps, de 1 (pleine) à 0 (vide) : elle se vide de droite à gauche. */
export function fractionRestante(restantMs: number, dureeMs: number): number {
  if (dureeMs <= 0) return 0;
  return Math.min(1, Math.max(0, restantMs / dureeMs));
}

/** Les secondes affichées dans « Disparaît dans N s » : on arrondit vers le haut, jamais « 0 s » tant que ça tourne. */
export function secondesAffichees(restantMs: number): number {
  return Math.max(0, Math.ceil(restantMs / 1000));
}

/* ── 3. Les durées et la pile des toasts ──────────────────────────────────── */

export type TypeToast = 'succes' | 'erreur';

/**
 * La durée d'un toast, ou `null` s'il ne part pas tout seul.
 *   · erreur → `null`, quoi qu'on demande ;
 *   · succès avec « Annuler » → 8 s ;
 *   · succès sans retour possible → 4 s.
 */
export function dureeDuToast(type: TypeToast, aRetour: boolean, demandeeMs?: number): number | null {
  if (type === 'erreur') return null;
  if (typeof demandeeMs === 'number' && demandeeMs > 0) return demandeeMs;
  return aRetour ? DUREE_TOAST_RETOUR_MS : DUREE_TOAST_SIMPLE_MS;
}

/** La barre de temps n'existe que pour un succès qui part tout seul ET qu'on peut annuler. */
export function afficheBarre(type: TypeToast, aRetour: boolean): boolean {
  return type === 'succes' && aRetour;
}

/**
 * Ajoute un toast en bas de la pile (le plus récent en bas) et en garde `max` au plus.
 * Au-delà, part le plus ancien — un succès avant une erreur.
 */
export function empiler<T extends { type: TypeToast }>(pile: readonly T[], nouveau: T, max: number = PILE_TOASTS_MAX): T[] {
  const suite = [...pile, nouveau];
  while (suite.length > max) {
    const i = suite.findIndex((t, rang) => rang < suite.length - 1 && t.type !== 'erreur');
    suite.splice(i === -1 ? 0 : i, 1);
  }
  return suite;
}

/**
 * « Annuler » et « Réessayer » : appellent RÉELLEMENT le rappel fourni, puis ferment le toast. Dans cet ordre —
 * si le rappel lève, le toast reste, et la personne voit encore de quoi réessayer.
 */
export function enchainer(rappel: () => void, fermer: () => void): () => void {
  return () => {
    rappel();
    fermer();
  };
}

export interface ToucheEchap {
  touche: string;
  /** Un autre écouteur (un champ, un menu) a déjà pris l'appui. */
  dejaPris: boolean;
  /** Une composition de saisie (clavier japonais, chinois) est en cours. */
  composition: boolean;
  /** Combien de calques (dialogue, panneau) attendent Échap : c'est à eux de le prendre. */
  calquesOuverts: number;
  /** L'appui vient d'un champ de saisie, où Échap sert à annuler la frappe. */
  dansUneSaisie: boolean;
}

/** Échap ferme le toast le plus récent, mais jamais l'appui d'un autre : un calque, une saisie, une composition. */
export function echapFermeLeToast(t: ToucheEchap): boolean {
  return t.touche === 'Escape' && !t.dejaPris && !t.composition && t.calquesOuverts === 0 && !t.dansUneSaisie;
}
