/**
 * LES QUATRE NIVEAUX D'ACTION D'AJMANI — la règle de toute l'application (G05, rubrique 6).
 *
 *   N0  lecture              trouver, résumer, expliquer, ouvrir un écran : tout de suite, sans confirmation.
 *   N1  brouillon            Ajmani prépare, la personne relit ; un « Annuler » de 10 s suit le clic.
 *   N2  modification         la proposition écrit l'AVANT et l'APRÈS ; une suppression va à la corbeille.
 *   N3  envoi, effet externe aperçu complet, puis 10 s pour annuler (« Envoi dans 10 s · Annuler »).
 *
 * RÈGLE D'OR : Entrée dans le champ ne confirme JAMAIS un N1, N2 ou N3 ; cela demande une proposition.
 * Seul un clic (ou Entrée) sur le bouton primaire de la proposition exécute. Et Ajmani ne déclenche
 * jamais un paiement, un remboursement ni un virement.
 *
 * Module pur, sans React ni horloge cachée : `scripts/check-systeme-ajmani.ts` le rejoue tel quel.
 */

export type NiveauAction = 'N0' | 'N1' | 'N2' | 'N3';
export const NIVEAUX: readonly NiveauAction[] = ['N0', 'N1', 'N2', 'N3'];

/** Le délai d'annulation, pour N1 et N3. */
export const DELAI_ANNULATION_MS = 10_000;

/**
 * Comment l'annulation joue :
 *   aucun   — rien à annuler ;
 *   defaire — l'effet a lieu au clic, et « Annuler » le défait pendant le délai (N1 : le brouillon créé) ;
 *   retenir — l'effet est RETENU pendant le délai et ne part qu'à son terme (N3 : « Envoi dans 10 s »).
 */
export type ModeAnnulation = 'aucun' | 'defaire' | 'retenir';

export interface RegleNiveau {
  niveau: NiveauAction;
  /** Un clic sur le bouton primaire est nécessaire avant tout effet. */
  confirmation: boolean;
  annulation: ModeAnnulation;
  delaiMs: number;
  /** La phrase doit dire l'avant et l'après. */
  avantApres: boolean;
  /** L'aperçu complet du texte précède le bouton. */
  apercuComplet: boolean;
  /** Hors ligne : seule la lecture reste permise. */
  permisHorsLigne: boolean;
}

export const REGLES: Readonly<Record<NiveauAction, RegleNiveau>> = {
  N0: { niveau: 'N0', confirmation: false, annulation: 'aucun', delaiMs: 0, avantApres: false, apercuComplet: false, permisHorsLigne: true },
  N1: { niveau: 'N1', confirmation: true, annulation: 'defaire', delaiMs: DELAI_ANNULATION_MS, avantApres: false, apercuComplet: false, permisHorsLigne: false },
  N2: { niveau: 'N2', confirmation: true, annulation: 'aucun', delaiMs: 0, avantApres: true, apercuComplet: false, permisHorsLigne: false },
  N3: { niveau: 'N3', confirmation: true, annulation: 'retenir', delaiMs: DELAI_ANNULATION_MS, avantApres: false, apercuComplet: true, permisHorsLigne: false },
};

export function regleDe(niveau: NiveauAction): RegleNiveau {
  return REGLES[niveau];
}

/** Ce niveau exige-t-il un clic sur le bouton primaire ? (tout sauf la lecture) */
export function demandeConfirmation(niveau: NiveauAction): boolean {
  return REGLES[niveau].confirmation;
}

/** D'où vient le geste qui voudrait exécuter. */
export type OrigineGeste = 'champ-entree' | 'bouton-clic' | 'bouton-entree' | 'ligne-clic' | 'ligne-entree';

/**
 * Ce geste peut-il exécuter une proposition de ce niveau ?
 * Entrée dans le champ ne confirme jamais un N1–N3 (elle demande une proposition) ; un clic ou Entrée sur
 * le bouton primaire le peut. Une ligne de suggestion ne confirme rien : elle lance une demande.
 */
export function peutExecuter(niveau: NiveauAction, origine: OrigineGeste): boolean {
  if (!demandeConfirmation(niveau)) return true;
  return origine === 'bouton-clic' || origine === 'bouton-entree';
}

/** Hors ligne, ce niveau est-il encore permis ? */
export function permisHorsLigne(niveau: NiveauAction): boolean {
  return REGLES[niveau].permisHorsLigne;
}

/* ── Le bouton primaire porte un verbe précis ── */

const VERBES_VAGUES = new Set(['ok', 'valider', 'validez', 'oui', 'confirmer', 'confirmez', 'continuer', 'continuez', 'accepter', 'accepte', 'dac', 'dacc', 'go', 'yes', 'confirm', 'validate', 'continue', 'accept', 'submit']);

function premierMot(libelle: string): string {
  return libelle
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .trim()
    .split(/\s+/)[0] ?? '';
}

/**
 * Un libellé de bouton primaire est précis s'il commence par un verbe qui dit ce qui va se passer
 * (« Préparer la relance », « Créer le brouillon ») : jamais « OK » ni « Valider », et jamais un mot seul
 * qui ne dit pas quoi.
 */
export function estLibelleBoutonPrecis(libelle: string): boolean {
  const mots = libelle.trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return false;
  return !VERBES_VAGUES.has(premierMot(libelle));
}

/* ── Le délai d'annulation ── */

/** Les secondes à afficher pour un temps restant : on arrondit vers le haut, « 10 s » jusqu'au bout de la première seconde. */
export function secondesRestantes(restantMs: number): number {
  return Math.max(0, Math.ceil(restantMs / 1000));
}

export type EtatDelai = 'en-cours' | 'annule' | 'ecoule';

/** L'horloge injectée : le contrôle la remplace par une horloge à la main. */
export interface HorlogeDelai {
  maintenant: () => number;
  /** Planifie `fn` dans `ms` ; rend la fonction qui l'annule. */
  planifier: (fn: () => void, ms: number) => () => void;
}

const HORLOGE_REELLE: HorlogeDelai = {
  maintenant: () => Date.now(),
  planifier: (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
};

export interface OptionsDelai {
  /** 10 s par défaut. */
  dureeMs?: number;
  /** N3 : appelé À LA FIN du délai, sauf annulation — c'est lui qui envoie. N1 : sans objet. */
  surEcoulement?: () => void;
  /** Appelé si la personne annule dans le délai. */
  surAnnulation?: () => void;
  /** Appelé chaque seconde avec le nombre de secondes restantes (« Envoi dans 10 s · Annuler »). */
  surTic?: (secondes: number) => void;
  horloge?: HorlogeDelai;
}

/**
 * LE DÉLAI D'ANNULATION — dix secondes pendant lesquelles « Annuler » existe.
 *
 *   const delai = new DelaiAnnulation({ surEcoulement: envoyer });
 *   delai.demarrer();      // « Envoi dans 10 s · Annuler »
 *   delai.annuler();       // avant la fin : surEcoulement n'est JAMAIS appelé
 *
 * L'état se lit à tout instant (`etat`, `secondes`) ; l'annulation n'a d'effet qu'une fois, et seulement
 * tant que le délai court. Passé le terme, `annuler()` ne défait plus rien.
 */
export class DelaiAnnulation {
  private readonly duree: number;
  private readonly opts: OptionsDelai;
  private readonly horloge: HorlogeDelai;
  private debut = 0;
  private etatCourant: EtatDelai = 'en-cours';
  private demarre = false;
  private arrets: Array<() => void> = [];

  constructor(options: OptionsDelai = {}) {
    this.opts = options;
    this.duree = options.dureeMs ?? DELAI_ANNULATION_MS;
    this.horloge = options.horloge ?? HORLOGE_REELLE;
  }

  get etat(): EtatDelai {
    return this.etatCourant;
  }

  /** Temps restant, en ms (0 une fois écoulé ou annulé). */
  get restantMs(): number {
    if (!this.demarre || this.etatCourant !== 'en-cours') return 0;
    return Math.max(0, this.duree - (this.horloge.maintenant() - this.debut));
  }

  get secondes(): number {
    return secondesRestantes(this.restantMs);
  }

  demarrer(): void {
    if (this.demarre) return;
    this.demarre = true;
    this.debut = this.horloge.maintenant();
    this.opts.surTic?.(secondesRestantes(this.duree));
    const pas = Math.ceil(this.duree / 1000);
    for (let i = 1; i < pas; i += 1) {
      this.arrets.push(this.horloge.planifier(() => this.opts.surTic?.(secondesRestantes(this.duree - i * 1000)), i * 1000));
    }
    this.arrets.push(this.horloge.planifier(() => this.terminer(), this.duree));
  }

  /** Annule. Rend `true` si l'effet a bien été empêché (ou défait à temps), `false` s'il était trop tard. */
  annuler(): boolean {
    if (!this.demarre || this.etatCourant !== 'en-cours') return false;
    this.etatCourant = 'annule';
    this.arreter();
    this.opts.surAnnulation?.();
    return true;
  }

  private terminer(): void {
    if (this.etatCourant !== 'en-cours') return;
    this.etatCourant = 'ecoule';
    this.arreter();
    this.opts.surTic?.(0);
    this.opts.surEcoulement?.();
  }

  private arreter(): void {
    for (const stop of this.arrets) stop();
    this.arrets = [];
  }

  /** Libère les minuteurs sans rien déclencher (démontage). */
  abandonner(): void {
    this.arreter();
  }
}
