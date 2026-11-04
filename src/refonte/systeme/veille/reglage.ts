import { useSyncExternalStore } from 'react';

/**
 * LE RÉGLAGE « ÉCRAN DE VEILLE » (G09, ligne de H18) — un choix du POSTE, rangé comme le réglage Mouvement
 * (`src/socle/mouvement.ts`) : une clé `localStorage`, un événement de fenêtre pour prévenir les abonnés, un hook.
 * Rien ne part en synchronisation.
 *
 *   actif       l'écran de veille peut-il s'afficher ? (défaut : oui) — non : il n'apparaît jamais ;
 *   veilleMin   minutes sans geste avant l'écran (défaut 5) ;
 *   verrouMin   minutes au total avant le verrouillage de l'espace (défaut 15, 0 = jamais).
 *
 * Le délai de verrouillage est ENREGISTRÉ, mais l'application n'a pas aujourd'hui de verrouillage après
 * inactivité : ce délai n'a donc pas d'effet, et l'écran ne l'affiche pas (voir `VueVeille`, prop
 * `verrouApresMin`). Aucune logique d'authentification n'est créée ici.
 *
 * La clé est propre à l'édition interne : `amn.veille.reglages` (src/lib/veille.ts) est celle de la vitrine
 * de l'édition cliente, qu'on ne touche pas.
 */
export interface ReglageVeille {
  actif: boolean;
  veilleMin: number;
  verrouMin: number;
}

export const CLE_ECRAN_DE_VEILLE = 'amn.ecranDeVeille';
export const EVENEMENT_ECRAN_DE_VEILLE = 'amn:ecran-de-veille';

/**
 * Les délais proposés. Le plus court est 5 min, et ce n'est pas un hasard : un message vocal (`VoiceRecorder`)
 * plafonne à 3 min et n'a pas d'état lisible de l'extérieur — avec 5 min au moins depuis le dernier geste (le
 * clic qui l'a lancé), la veille ne peut pas tomber pendant qu'il enregistre.
 */
export const DELAIS_VEILLE: readonly number[] = [5, 10, 15, 30];
/** Les délais de verrouillage proposés ; 0 = jamais. */
export const DELAIS_VERROU: readonly number[] = [15, 30, 60, 0];

export const REGLAGE_VEILLE_DEFAUT: ReglageVeille = Object.freeze({ actif: true, veilleMin: 5, verrouMin: 15 });

/** Un réglage lu, ramené aux valeurs permises (une valeur inconnue reprend le défaut). Fonction pure. */
export function normaliserReglage(brut: unknown): ReglageVeille {
  const o = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {};
  const actif = typeof o.actif === 'boolean' ? o.actif : REGLAGE_VEILLE_DEFAUT.actif;
  const veilleMin = typeof o.veilleMin === 'number' && DELAIS_VEILLE.includes(o.veilleMin) ? o.veilleMin : REGLAGE_VEILLE_DEFAUT.veilleMin;
  const verrouMin = typeof o.verrouMin === 'number' && DELAIS_VERROU.includes(o.verrouMin) ? o.verrouMin : REGLAGE_VEILLE_DEFAUT.verrouMin;
  return { actif, veilleMin, verrouMin };
}

let cache: { brut: string | null; valeur: ReglageVeille } | null = null;

/** Le réglage de ce poste (le défaut si rien n'est écrit, ou si le stockage est refusé). */
export function lireReglageVeille(): ReglageVeille {
  let brut: string | null = null;
  try {
    brut = window.localStorage.getItem(CLE_ECRAN_DE_VEILLE);
  } catch {
    brut = null;
  }
  if (cache && cache.brut === brut) return cache.valeur;
  let valeur = REGLAGE_VEILLE_DEFAUT;
  if (brut) {
    try {
      valeur = normaliserReglage(JSON.parse(brut));
    } catch {
      valeur = REGLAGE_VEILLE_DEFAUT;
    }
  }
  cache = { brut, valeur };
  return valeur;
}

/** Écrit une partie du réglage et prévient les abonnés. */
export function ecrireReglageVeille(patch: Partial<ReglageVeille>): void {
  const suivant = normaliserReglage({ ...lireReglageVeille(), ...patch });
  try {
    window.localStorage.setItem(CLE_ECRAN_DE_VEILLE, JSON.stringify(suivant));
  } catch {
    /* stockage refusé : le choix ne vaut que jusqu'au rechargement */
    cache = { brut: null, valeur: suivant };
  }
  window.dispatchEvent(new Event(EVENEMENT_ECRAN_DE_VEILLE));
}

const abonner = (rappel: () => void) => {
  window.addEventListener(EVENEMENT_ECRAN_DE_VEILLE, rappel);
  window.addEventListener('storage', rappel);
  return () => {
    window.removeEventListener(EVENEMENT_ECRAN_DE_VEILLE, rappel);
    window.removeEventListener('storage', rappel);
  };
};

/** Le réglage en vigueur, relu à chaque changement (Réglages, ou un autre onglet). */
export function useReglageVeille(): ReglageVeille {
  return useSyncExternalStore(abonner, lireReglageVeille, () => REGLAGE_VEILLE_DEFAUT);
}
