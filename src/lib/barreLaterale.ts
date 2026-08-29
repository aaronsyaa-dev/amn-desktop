/**
 * LA BARRE LATÉRALE EST-ELLE DÉPLIÉE ?
 * ════════════════════════════════════
 *
 * Module sans React, pour que la règle soit éprouvable — et parce qu'elle a
 * deux entrées qui se contredisent facilement : la largeur de la fenêtre, et
 * un choix que quelqu'un a fait explicitement.
 *
 * ## Le défaut qu'elle répare
 *
 * REMONTÉ EN TESTANT : « l'étouffoir et les règles mises en sourdine sont
 * introuvables dans l'interface ».
 *
 * Ils ne l'étaient pas : le bureau de supervision existe, le panneau des
 * règles tues aussi, et ils fonctionnent. Ce qui manquait était le CHEMIN.
 *
 * L'application a deux espaces — Poste de travail et Tour de contrôle — et
 * cinq modules vivent dans le second : Supervision, Sites, Trackers, Scanner,
 * Comply. Autrement dit, tout le métier de cybersécurité. On bascule de l'un à
 * l'autre par un sélecteur en tête de barre latérale.
 *
 * MESURÉ à 1 280, 1 400 et 1 920 px : la barre était repliée à 72 px dans les
 * trois cas, et le sélecteur se réduisait à une icône de 47 × 44 px sans le
 * moindre texte. Les mots « Poste de travail » et « Tour de contrôle »
 * n'apparaissaient **nulle part à l'écran**. Le seul indice était une
 * infobulle au survol — donc rien, sur un écran tactile, et rien pour qui ne
 * pense pas à survoler une icône qu'il prend pour un logo.
 *
 * La cause était un `useState(false)` posé une fois, sans raison écrite et
 * jamais revu : ni la largeur disponible, ni le choix de la personne.
 *
 * ## Les deux entrées, et laquelle gagne
 *
 * Un choix EXPLICITE gagne toujours. Quelqu'un qui replie la barre sur un
 * grand écran veut qu'elle reste repliée, y compris demain — sinon le réglage
 * n'en est pas un.
 *
 * En l'absence de choix, la largeur décide. En dessous du seuil, une barre
 * dépliée mangerait le contenu ; au-dessus, il y a la place, et la
 * navigation d'un produit ne se cache pas quand rien ne l'y oblige.
 */

/**
 * Le seuil de dépliage, en pixels de fenêtre.
 *
 * La barre dépliée occupe 224 px. À 1 100 px de fenêtre il reste 876 px de
 * contenu, ce qui tient largement les mises en page à deux colonnes du
 * produit. En dessous, on est sur une fenêtre étroite ou une tablette : la
 * barre reprend sa forme d'icônes, et le tiroir plein écran prend le relais.
 */
export const SEUIL_DEPLIAGE_PX = 1100;

/** La clé du choix explicite, s'il y en a eu un. */
export const CLE_CHOIX = 'amn.sidebar.expanded';

/**
 * Faut-il déplier, au premier rendu ?
 *
 * `choix` est ce qu'on a lu dans le stockage : `null` quand personne n'a
 * jamais tranché, `true`/`false` sinon.
 */
export function deplierAuDemarrage(largeurFenetre: number, choix: boolean | null): boolean {
  if (choix !== null) return choix;
  return largeurFenetre >= SEUIL_DEPLIAGE_PX;
}

/**
 * Relit le choix explicite. Rend `null` dès que la réponse n'est pas un oui ou
 * un non franc — stockage refusé en navigation privée, valeur abîmée, clé
 * écrite par une version antérieure. Dans le doute, c'est la largeur qui
 * décide, et elle décide bien.
 */
export function lireChoix(brut: string | null): boolean | null {
  if (brut === 'true') return true;
  if (brut === 'false') return false;
  return null;
}
