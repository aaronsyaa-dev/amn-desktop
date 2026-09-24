/**
 * LA VISITE GUIDÉE — ce qu'est une étape, ce qu'est un parcours.
 *
 * Un parcours est une liste d'étapes. Chaque étape vise UN élément de
 * l'écran (par un sélecteur), y amène un curseur simulé, l'entoure d'un
 * projecteur et pose une carte à côté. Une étape sans cible est une carte au
 * centre (le bonjour, la fin). Une étape dont la cible n'existe pas — la barre
 * latérale sous `md`, un bouton que l'écran n'a pas — est sautée, jamais
 * affichée dans le vide : `cibleMobile` propose un autre élément pour le
 * téléphone.
 */
export interface Etape {
  /** Le sélecteur de la cible ; `null` pour une carte centrée. */
  cible: string | null;
  /** Une autre cible sous `md` (la barre du pouce plutôt que la colonne). */
  cibleMobile?: string | null;
  titre: string;
  texte: string;
  /** Où poser la carte. `auto` choisit le côté où il y a de la place. */
  cote?: 'auto' | 'droite' | 'gauche' | 'haut' | 'bas';
}

export interface Parcours {
  /** `general`, `module:<clé>`, … — sert à la mémoire « déjà vu ». */
  id: string;
  etapes: Etape[];
  /** Où aller avant de commencer (le tuto général part de l'Accueil). */
  route?: string;
}
