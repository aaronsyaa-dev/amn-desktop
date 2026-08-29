/**
 * LA PILE DES CALQUES OUVERTS — ÉCHAP N'EN FERME QU'UN
 * ════════════════════════════════════════════════════
 *
 * Module SANS React, et c'est délibéré : `scripts/check-calques.ts` le charge
 * tel quel depuis les sources. La règle qui compte ici — « un appui, un
 * calque » — est une propriété d'EXÉCUTION qu'aucun contrôle statique ne peut
 * voir. Elle a d'ailleurs survécu à une mutation du garde-fou de clavier, ce
 * qui est exactement ce qui a motivé cette séparation.
 *
 * ## Le défaut qu'elle empêche
 *
 * Deux calques peuvent se superposer : un panneau de projet, et par-dessus la
 * confirmation d'un geste irréversible. Si chaque calque écoute Échap dans son
 * coin, les DEUX répondent au même appui — la confirmation disparaît, et le
 * panneau derrière aussi. On perd son travail pour avoir voulu annuler une
 * confirmation.
 *
 * Chaque calque ouvert s'inscrit donc ici. Un seul écouteur existe, posé à la
 * première inscription et retiré à la dernière ; il ne notifie que le SOMMET.
 * Un appui, un calque, dans l'ordre inverse de l'ouverture.
 *
 * ## Un seul écouteur, et pas un par calque
 *
 * Le premier jet en posait un par calque, chacun vérifiant s'il était au
 * sommet. Ça marchait, mais avec douze panneaux ouverts dans une session
 * longue, douze écouteurs se déclenchent à chaque frappe de touche pour que
 * onze d'entre eux décident de ne rien faire. Un seul suffit, et il sait déjà
 * qui est au sommet.
 */

type Fermeture = () => void;

const pile: Fermeture[] = [];
let ecouteurPose = false;

/**
 * Le conteneur du calque où le focus se trouvait la dernière fois.
 *
 * C'est ce qui permet de le ramener quand il essaie de sortir, sans que chaque
 * calque ait à déclarer son élément : à l'ouverture le focus entre dans la
 * fenêtre (tous nos calques placent le curseur sur leur premier champ), donc
 * le conteneur est connu avant que la tabulation puisse en sortir.
 */
let dernierConteneur: HTMLElement | null = null;

/** Ce qui peut recevoir le focus, dans l'ordre du document. */
const SELECTEUR_FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * LE PROCHAIN ARRÊT DE TABULATION, EN BOUCLE.
 *
 * Fonction pure, et c'est délibéré : c'est la règle qui compte — « après le
 * dernier vient le premier » — et elle s'éprouve sans navigateur.
 *
 * Rend `null` quand il n'y a rien à cibler : l'appelant laisse alors la touche
 * suivre son cours plutôt que de bloquer le focus sur place.
 */
export function prochainFocus(
  focusables: readonly HTMLElement[],
  actuel: HTMLElement | null,
  versArriere: boolean,
): HTMLElement | null {
  if (focusables.length === 0) return null;
  const i = actuel ? focusables.indexOf(actuel) : -1;
  if (i === -1) {
    // Le focus n'est pas (ou plus) dans la fenêtre : on le ramène au bout par
    // lequel il essayait d'entrer.
    return versArriere ? focusables[focusables.length - 1] : focusables[0];
  }
  const suivant = versArriere ? i - 1 : i + 1;
  if (suivant >= 0 && suivant < focusables.length) return null; // rien à forcer
  return versArriere ? focusables[focusables.length - 1] : focusables[0];
}

/** Les éléments focusables d'un conteneur, ceux qu'on voit seulement. */
function focusablesDe(conteneur: HTMLElement): HTMLElement[] {
  return [...conteneur.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)].filter((el) => {
    if (el.hasAttribute('inert')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/** Le calque qui contient cet élément, s'il y en a un. */
function calqueDe(el: Element | null): HTMLElement | null {
  for (let n = el as HTMLElement | null; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.position === 'fixed' && Number(cs.zIndex) >= 50) return n;
  }
  return null;
}

/**
 * Fait réagir le calque du dessus, s'il y en a un.
 *
 * Rend `true` quand quelque chose s'est fermé — ce qui permet à l'appelant de
 * ne consommer la touche que dans ce cas, et de la laisser passer sinon.
 */
export function fermerLeSommet(): boolean {
  const sommet = pile[pile.length - 1];
  if (!sommet) return false;
  sommet();
  return true;
}

/**
 * LA TABULATION NE SORT PAS D'UNE FENÊTRE OUVERTE.
 *
 * Mesuré avant correctif, fenêtre ouverte, trente tabulations : le focus en
 * sortait quinze à vingt-quatre fois, et se promenait dans la navigation
 * DERRIÈRE le voile — « Accueil », « Agenda », « Projets ». Des liens qu'on ne
 * voit pas, qu'on peut atteindre, et activer d'un appui sur Entrée pendant
 * qu'un formulaire est ouvert par-dessus.
 *
 * On ne bloque rien tant que le focus circule à l'intérieur : la touche suit
 * son cours normal, et l'ordre du document reste celui du navigateur. On
 * n'intervient qu'au moment où il allait franchir un bord.
 */
function surTabulation(e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  if (pile.length === 0) return;

  const actuel = document.activeElement as HTMLElement | null;
  const conteneur = calqueDe(actuel) ?? dernierConteneur;
  if (!conteneur || !conteneur.isConnected) return;
  dernierConteneur = conteneur;

  const focusables = focusablesDe(conteneur);
  const cible = prochainFocus(focusables, calqueDe(actuel) ? actuel : null, e.shiftKey);
  if (!cible) return;
  e.preventDefault();
  cible.focus();
}

function surTouche(e: KeyboardEvent): void {
  if (e.key === 'Tab') {
    surTabulation(e);
    return;
  }
  if (e.key !== 'Escape') return;
  /*
    Pendant une saisie au clavier japonais ou chinois, Échap annule la
    composition en cours. Fermer la fenêtre à ce moment-là ferait perdre le
    texte que la personne était en train d'écrire.
  */
  if (e.isComposing) return;
  if (pile.length === 0) return;
  e.preventDefault();
  /*
    Sans `stopPropagation`, un parent qui écoute aussi Échap — la palette de
    commandes, par exemple — se fermerait dans la foulée. Un appui, un calque.
  */
  e.stopPropagation();
  fermerLeSommet();
}

/**
 * Inscrit un calque au sommet. Rend la fonction qui l'en retire.
 *
 * L'appelant DOIT appeler le retrait au démontage : un calque oublié dans la
 * pile capterait Échap pour toujours, et les calques ouverts ensuite ne
 * répondraient plus jamais.
 */
export function inscrireCalque(fermer: Fermeture): () => void {
  pile.push(fermer);
  if (!ecouteurPose && typeof window !== 'undefined') {
    window.addEventListener('keydown', surTouche);
    ecouteurPose = true;
  }

  // Le conteneur se redécouvrira au premier Tab : un calque qui vient de
  // s'ouvrir n'a pas encore reçu le focus au moment de l'inscription.
  dernierConteneur = null;

  let retire = false;
  return () => {
    // Idempotent : React peut rejouer un nettoyage (mode strict, remontages).
    // Sans cette garde, le second appel dépilerait le calque d'un voisin.
    if (retire) return;
    retire = true;
    /*
      `lastIndexOf` parce qu'une pile se dépile par le haut : le retrait le
      plus probable est celui de l'inscription la plus récente, et le chercher
      là évite de parcourir toute la pile à chaque fermeture.

      Sur le comportement observable, `indexOf` donnerait le même résultat —
      vérifié en mutant. Deux entrées identiques sont interchangeables, et deux
      entrées différentes sont trouvées au même endroit par les deux. Le
      commentaire précédent affirmait que `indexOf` « dépilerait le mauvais
      calque » : c'était plus fort que les faits, et la mutation l'a dit.
    */
    const i = pile.lastIndexOf(fermer);
    if (i !== -1) pile.splice(i, 1);
    if (pile.length === 0) {
      dernierConteneur = null;
      if (ecouteurPose && typeof window !== 'undefined') {
        window.removeEventListener('keydown', surTouche);
        ecouteurPose = false;
      }
    }
  };
}

/** Combien de calques attendent Échap. Pour les contrôles. */
export function calquesOuverts(): number {
  return pile.length;
}

/** Remet la pile à zéro. Réservé aux contrôles — jamais appelé par l'application. */
export function viderLaPile(): void {
  pile.length = 0;
  dernierConteneur = null;
  if (ecouteurPose && typeof window !== 'undefined') {
    window.removeEventListener('keydown', surTouche);
    ecouteurPose = false;
  }
}
