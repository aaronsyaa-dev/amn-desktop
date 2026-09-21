/**
 * CE QU'UN RÉGLAGE CHANGE AILLEURS — la seule chose qui rend un réglage intéressant
 * ═════════════════════════════════════════════════════════════════════════════════
 *
 * Un écran de paramètres est une colonne d'interrupteurs : chacun dit ce
 * qu'il est, aucun ne dit ce qu'il FAIT. On y entre pour changer une chose et
 * on en ressort sans savoir ce qui vient de bouger dans le produit.
 *
 * Ce fichier est donc l'inverse d'une liste d'interrupteurs : pour chaque
 * rubrique, le réglage qui a une conséquence AILLEURS, et la liste des
 * modules qui le lisent. Le plan des Paramètres (`26d`) en tire son compte
 * « CITÉS N FOIS » — `lecteurs.length`, jamais un nombre écrit à la main.
 *
 * LE COMPTE EST VÉRIFIÉ, PAS DÉCLARÉ. `npm run check:consequences` ouvre
 * chaque fichier listé et refuse un lecteur qui ne contient pas le `marqueur`
 * du réglage. Une rubrique dont le réglage ne change rien ailleurs n'a pas
 * d'entrée ici, et son plan n'affiche alors aucun compte de citations — c'est
 * la même règle que partout : pas de chiffre sans mesure.
 */

export interface Lecteur {
  /** La clé de module, telle que la barre latérale la nomme. */
  module: string;
  /** Le fichier qui lit le réglage, relatif à la racine du dépôt. */
  fichier: string;
}

export interface ConsequenceReglage {
  /** La rubrique du plan des Paramètres. */
  rubrique: string;
  /** Le réglage, dans les mots de l'écran. */
  reglage: string;
  /**
   * Le symbole par lequel un lecteur lit ce réglage. C'est ce que la garde
   * cherche dans chaque fichier : un lecteur qui ne le contient pas ne lit
   * pas ce réglage, et le compte serait faux.
   */
  marqueur: string;
  lecteurs: Lecteur[];
}

export const CONSEQUENCES: ConsequenceReglage[] = [
  {
    rubrique: 'profil',
    reglage: 'Votre nom',
    marqueur: 'profileFor',
    /*
      Le nom du profil n'est pas décoratif : c'est lui qui signe un message,
      un vote, une annonce, un appel, une absence. Le changer ici réécrit la
      signature dans tous ces modules d'un coup — c'est le réglage le plus
      cité du produit, et le seul qu'on modifie sans s'en douter.
    */
    lecteurs: [
      { module: 'directory', fichier: 'src/screens/DirectoryScreen.tsx' },
      { module: 'dm', fichier: 'src/screens/DirectMessagesScreen.tsx' },
      { module: 'groups', fichier: 'src/screens/GroupsScreen.tsx' },
      { module: 'announcements', fichier: 'src/screens/AnnouncementsScreen.tsx' },
      { module: 'polls', fichier: 'src/screens/PollsScreen.tsx' },
      { module: 'leaves', fichier: 'src/screens/LeavesScreen.tsx' },
      { module: 'calls', fichier: 'src/screens/CallsScreen.tsx' },
      { module: 'tasks', fichier: 'src/screens/TasksScreen.tsx' },
      { module: 'reports', fichier: 'src/screens/ReportsScreen.tsx' },
      { module: 'media', fichier: 'src/screens/MediaLibraryScreen.tsx' },
      { module: 'aftersales', fichier: 'src/screens/AfterSalesScreen.tsx' },
      { module: 'meetings', fichier: 'src/screens/DecisionsScreen.tsx' },
    ],
  },
  {
    rubrique: 'modules',
    reglage: 'Les modules ouverts',
    marqueur: 'isModuleEnabled',
    /*
      Fermer un module ne masque pas seulement une entrée de barre : sa route
      cesse d'être atteignable, et Découvrir recompte sa carte.
    */
    lecteurs: [
      { module: 'discover', fichier: 'src/screens/LibraryScreen.tsx' },
      { module: 'home', fichier: 'src/data/spaces.ts' },
      { module: 'settings', fichier: 'src/components/ModuleRoute.tsx' },
    ],
  },
];

/** La conséquence d'une rubrique, ou `null` quand elle ne change rien ailleurs. */
export function consequenceDe(rubrique: string): ConsequenceReglage | null {
  return CONSEQUENCES.find((c) => c.rubrique === rubrique) ?? null;
}
