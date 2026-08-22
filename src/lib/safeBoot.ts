/**
 * DÉMARRAGE DE SECOURS — SORTIR D'UNE BOUCLE DE PLANTAGE SANS DÉSINSTALLER
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ## Le piège observé
 *
 * Le contexte d'organisation survit à la fermeture de l'application : le jeton
 * de support est gardé en `localStorage` pour que le bandeau « vous consultez
 * X » revienne tel quel après un redémarrage. C'est un bon comportement, et
 * c'est aussi ce qui a transformé un plantage d'écran en application morte.
 *
 * L'enchaînement, mesuré :
 *
 *   1. entrer dans le contexte d'une organisation faisait rendre un écran qui
 *      levait une erreur ;
 *   2. l'écran d'erreur ne proposait que « Réessayer » et « Recharger » — deux
 *      gestes qui ramènent au MÊME état ;
 *   3. au redémarrage, le jeton était restauré, le même écran remonté, la même
 *      erreur levée. En boucle.
 *
 * Et ce jeton vit dans le dossier `userData` d'Electron, qui n'est pas le
 * dossier d'installation : réinstaller l'application, même après une
 * désinstallation complète, ne l'efface pas. D'où une application qui reste
 * cassée après une réinstallation propre — le symptôme le plus déroutant, parce
 * qu'il donne l'impression que le programme lui-même est corrompu.
 *
 * ## Le principe
 *
 * Un démarrage laisse une marque en entrant et l'efface quand il a RÉUSSI.
 * Trouver la marque encore en place au démarrage suivant est la preuve que le
 * précédent n'est jamais arrivé au bout. On repart alors sur un état sûr :
 * l'espace d'AMN DevSec, sans contexte restauré.
 *
 * C'est volontairement une preuve par l'échec plutôt qu'un piège à erreurs :
 * une erreur peut être avalée, un rendu peut mourir sans rien lever, le
 * processus peut être tué. Aucune de ces morts ne s'annonce — mais aucune
 * n'efface la marque non plus.
 *
 * ## Ce que « réussi » veut dire
 *
 * Pas « React a rendu quelque chose » : l'écran d'erreur AUSSI est un rendu.
 * La marque n'est levée que par `<BootHealthy />`, monté dans la coquille
 * applicative — donc uniquement quand l'application est réellement utilisable.
 *
 * ## Ce qui n'est jamais effacé
 *
 * Rien de ce qui compte. Le mode de secours ne touche qu'au CONTEXTE de
 * navigation : le jeton de support, qui n'est qu'un pointeur vers
 * l'organisation regardée, et qui se rétablit d'un clic dans le rail. Les
 * données locales (SQLite), la session, les préférences, le coffre-fort ne sont
 * pas concernés.
 */

/** Marque posée à l'entrée d'un démarrage, levée quand il aboutit. */
const BOOT_FLAG = 'amn.boot.inflight';

/**
 * Le jeton de contexte d'organisation.
 *
 * Recopié ici plutôt qu'importé de `OrgContextContext` : ce module tourne AVANT
 * que React soit monté, et importer le contexte tirerait tout l'arbre
 * applicatif — donc, potentiellement, le module même qui plante. Un module de
 * secours ne peut pas dépendre de ce dont il nous sauve. La constante est
 * verrouillée par `scripts/check-safe-boot.ts`, qui échoue si les deux
 * s'écartent.
 */
const SUPPORT_TOKEN_KEY = 'amn.support.token';

let secours = false;

/** Vrai quand ce démarrage-ci a été lancé en mode de secours. */
export function isSafeBoot(): boolean {
  return secours;
}

function lire(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: string | null): void {
  try {
    if (valeur === null) window.localStorage.removeItem(cle);
    else window.localStorage.setItem(cle, valeur);
  } catch {
    /* mode privé, quota : le démarrage ne doit pas échouer pour si peu */
  }
}

/**
 * Efface le CONTEXTE de navigation, rien d'autre.
 *
 * Exporté parce que l'écran d'erreur s'en sert aussi : « Retour à l'accueil »
 * doit désamorcer l'état qui vient de faire planter, sinon le bouton renvoie
 * dans le mur qu'il est censé contourner.
 */
export function clearNavigationState(): void {
  ecrire(SUPPORT_TOKEN_KEY, null);
}

/**
 * À appeler une seule fois, avant le rendu.
 *
 * Rend `true` si le démarrage précédent n'a jamais abouti — auquel cas le
 * contexte a déjà été désamorcé au moment où cette fonction rend la main.
 */
export function beginBoot(): boolean {
  const precedentInacheve = lire(BOOT_FLAG) !== null;
  if (precedentInacheve) {
    secours = true;
    clearNavigationState();
    // eslint-disable-next-line no-console
    /*
      Sans raison sociale : ce message part AUSSI dans le bundle d'une cliente,
      et `scripts/check-business-bundle.mjs` refuse toute trace de notre nom
      chez elle — il a d'ailleurs refusé la première version de cette ligne.
      Le contrôle avait raison : le mot n'apporte rien ici, et le concept
      d'« espace AMN DevSec » n'existe même pas dans l'édition Business, où la
      cliente n'a qu'un seul espace, le sien.
    */
    console.warn(
      '[AMN] le démarrage précédent ne s’est pas terminé — reprise sur un écran sûr, contexte d’organisation abandonné.',
    );
  }
  ecrire(BOOT_FLAG, new Date().toISOString());
  return precedentInacheve;
}

/** Le démarrage a abouti : la marque est levée. */
export function markBootHealthy(): void {
  ecrire(BOOT_FLAG, null);
}
