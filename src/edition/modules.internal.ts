import {
  BadgeCheck,
  BookOpen,
  Building2,
  Calculator,
  CalendarDays,
  CheckSquare,
  Contact,
  FileText,
  FolderKanban,
  Globe,
  History,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  Lock,
  LockKeyhole,
  MonitorDot,
  NotebookPen,
  PartyPopper,
  PiggyBank,
  Radar,
  ReceiptEuro,
  Scale,
  ScanLine,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Timer,
  Users,
  Wallet,
} from 'lucide-react';
import type { NavSection } from '../data/navigation';
import type { ActivityTab } from '../state/ActivityContext';

/**
 * Les modules d'AMN Desktop — l'édition interne d'AMN DevSec.
 *
 * Cette liste alimente la barre latérale, le lanceur et la palette de
 * commandes. C'est aussi elle qui décide, module par module, ce qui existe dans
 * un build : l'édition Business résout `@edition/modules` vers
 * `modules.business.ts`, et rien de ce qui suit n'y est compilé.
 *
 * Depuis la refonte, chaque section porte son ESPACE (voir src/data/spaces.ts).
 * Une seule barre latérale plate mélangeait le travail quotidien et les
 * produits de cybersécurité : à deux personnes et quatre produits ça tenait, à
 * l'échelle de « plein de clients » plus rien ne se distinguait. Les deux
 * espaces ne cachent rien l'un de l'autre — ils répondent à deux questions
 * différentes, et on choisit laquelle on se pose.
 *
 * Les chemins n'ont PAS bougé. Déplacer `/tracker` sous `/tour/tracker` aurait
 * cassé les liens profonds, la mémoire d'onglet, les pastilles d'activité et
 * les entrées de la palette pour un gain purement cosmétique : l'espace est une
 * propriété du module, pas un préfixe d'URL.
 */
/** Ce qu'un poste tout neuf épingle — les cinq écrans réellement ouverts chaque jour. */
export const DEFAULT_FAVORITES = ['home', 'agenda', 'team', 'tasks', 'clients'] as const;

export const NAV_SECTIONS: NavSection[] = [
  /*
    LES GROUPES, ET POURQUOI CEUX-LÀ (REFONTE)
    ──────────────────────────────────────────
    « Travail » comptait seize entrées. Ce n'est plus une section, c'est une
    liste plate avec un intitulé posé dessus : à seize lignes, l'œil ne
    reconnaît plus de forme et relit tout depuis le haut à chaque fois.

    Le découpage suit les questions qu'on se pose, pas les objets qu'on
    manipule. « Où j'en suis » (Pilotage), « qui me doit quoi » (Clients &
    revenus), « ce que ça coûte » (Production), « ce qu'on s'est dit »
    (Collectif), « ce qu'on rend » (Livrables). Un module se range là où on va
    le chercher, pas là où sa table de données se trouve — c'est pour ça que
    Facturation est avec Clients et non avec Calculateurs, alors que les deux
    manipulent des montants.

    Aucun chemin n'a bougé : regrouper est un geste de navigation, pas une
    réorganisation d'URL. Les liens profonds, la mémoire d'onglet, les
    pastilles d'activité et la palette continuent de fonctionner à l'identique.
  */
  {
    key: 'pilotage',
    label: 'Pilotage',
    space: 'workspace',
    items: [
      { key: 'home', label: 'Accueil', to: '/', icon: LayoutDashboard, hint: 'Le QG du jour' },
      { key: 'agenda', label: 'Calendrier', to: '/agenda', icon: CalendarDays, hint: 'Rendez-vous et disponibilités' },
      { key: 'projects', label: 'Projets', to: '/projets', icon: FolderKanban, hint: 'Ce qui avance, et ce qui bloque' },
      { key: 'tasks', label: 'Tâches', to: '/tasks', icon: CheckSquare, hint: 'Travail partagé' },
    ],
  },
  {
    key: 'commerce',
    label: 'Clients & revenus',
    space: 'workspace',
    // La chaîne complète d'un euro, dans son ordre réel : une fiche, un devis
    // qui devient une facture, et les commandes qui arrivent du site public
    // sans que personne les ait saisies. Les séparer obligerait à traverser la
    // navigation pour suivre une seule affaire.
    items: [
      { key: 'clients', label: 'Clients', to: '/clients', icon: Contact, hint: 'Fiches et devis' },
      { key: 'invoices', label: 'Facturation', to: '/facturation', icon: ReceiptEuro, hint: 'Factures et encaissements' },
      { key: 'orders', label: 'Commandes', to: '/commandes', icon: ShoppingBag, hint: 'Reçues du site' },
      // Les événements vivent avec les revenus, et non dans « Production » :
      // ce qu'on y regarde est un seuil de rentabilité et un nombre d'entrées
      // vendues, pas un temps passé.
      { key: 'evenements', label: 'Événements', to: '/evenements', icon: PartyPopper, hint: 'Dates, jauge, équilibre' },
    ],
  },
  {
    key: 'production',
    label: 'Production',
    space: 'workspace',
    // Les deux faces de ce qu'une prestation coûte — ce qu'on sort et ce qu'on
    // y passe — et l'outil qui en tire un prix. La synthèse des calculateurs
    // agrège précisément les deux autres : les ranger ailleurs séparerait un
    // résultat de ses opérandes.
    items: [
      { key: 'time', label: 'Temps', to: '/temps', icon: Timer, hint: 'Chronomètre et temps passé' },
      { key: 'expenses', label: 'Dépenses', to: '/depenses', icon: Wallet, hint: 'Frais et justificatifs' },
      { key: 'calculators', label: 'Calculateurs', to: '/calculateurs', icon: Calculator, hint: 'Prix, marges, répartition' },
    ],
  },
  {
    key: 'collectif',
    label: 'Collectif',
    space: 'workspace',
    // Ce qui se dit à deux, et ce qui doit s'en souvenir. L'ancienne section
    // « Mémoire » disait la même chose de Décisions et Connaissances, mais les
    // séparait de la messagerie qui les alimente.
    items: [
      { key: 'team', label: 'Équipe', to: '/team', icon: Users, hint: 'Messagerie et présence' },
      { key: 'notes', label: 'Notes', to: '/notes', icon: NotebookPen, hint: 'Bloc-notes' },
      // Une note est un jet personnel ; une page est un support commun qu'on
      // tient à jour et que d'autres relisent. D'où sa place ici, dans le
      // collectif, et non à côté des livrables.
      { key: 'pages', label: 'Pages', to: '/pages', icon: LayoutTemplate, hint: 'Fiches et supports partagés' },
      { key: 'decisions', label: 'Décisions', to: '/decisions', icon: Scale, hint: 'Journal des arbitrages' },
      { key: 'knowledge', label: 'Connaissances', to: '/knowledge', icon: BookOpen, hint: 'Base interne' },
    ],
  },
  {
    key: 'livrables',
    label: 'Livrables',
    space: 'workspace',
    items: [
      { key: 'reports', label: 'Rapports', to: '/reports', icon: FileText, hint: 'Livrables clients' },
      { key: 'media', label: 'Médias', to: '/media', icon: Images, hint: 'Bibliothèque' },
    ],
  },
  {
    /*
      PERSONNEL (BLOC 2) — voir le commentaire jumeau dans `modules.business.ts`.

      Présent des deux côtés parce que ce n'est pas un cadeau fait aux
      clientes depuis l'extérieur : c'est un module qu'Aaron utilise lui aussi,
      et un module qu'on n'utilise pas est un module qu'on ne corrige pas.
    */
    key: 'personnel',
    label: 'Personnel',
    space: 'workspace',
    items: [
      { key: 'budget', label: 'Avant la paie', to: '/personnel/budget', icon: PiggyBank, hint: 'Ce qu’il reste à dépenser' },
      { key: 'courses', label: 'Courses', to: '/personnel/courses', icon: ShoppingBasket, hint: 'Liste de courses et pages perso' },
    ],
  },
  {
    key: 'systeme',
    label: 'Système',
    space: 'workspace',
    items: [
      { key: 'settings', label: 'Paramètres', to: '/settings', icon: Settings, hint: 'Profil et notifications' },
      { key: 'members', label: 'Membres', to: '/membres', icon: Users, hint: 'Qui travaille ici, et les places' },
      { key: 'vault', label: 'Coffre-fort', to: '/vault', icon: Lock, hint: 'Clés et accès' },
    ],
  },
  {
    key: 'tour',
    label: 'Supervision',
    space: 'control',
    items: [
      { key: 'tour', label: 'Vue d’ensemble', to: '/tour', icon: MonitorDot, hint: 'Le mur du SOC' },
      { key: 'orgs', label: 'Organisations', to: '/tour/organisations', icon: Building2, hint: 'Toutes les clientes gérées' },
      { key: 'access', label: 'Journal d’accès', to: '/tour/journal', icon: History, hint: 'Qui est entré chez qui' },
      // L'atelier de création d'un espace client (BLOC C). Dans la Tour de
      // contrôle et non au Poste de travail : créer une cliente est un geste
      // qu'on fait EN supervisant le parc, pas au milieu de sa journée.
      { key: 'generator', label: 'Atelier', to: '/tour/generateur', icon: Sparkles, hint: 'Créer un espace de travail sur mesure' },
    ],
  },
  {
    key: 'parc',
    label: 'Parc',
    space: 'control',
    // Sites quitte le Poste de travail pour venir ici, à côté des trackers qui
    // le surveillent. Le registre des sites n'a jamais servi au travail
    // quotidien : on l'ouvre quand on supervise, jamais quand on facture.
    items: [
      /*
        Le bureau de supervision passe DEVANT les trackers, et ce n'est pas un
        détail d'ordre. « Trackers » répond à « qu'est-ce qui est installé »,
        le bureau répond à « qu'est-ce qui se passe » — et c'est la seconde
        question qu'on se pose en ouvrant l'application un matin.
      */
      { key: 'supervision', label: 'Supervision', to: '/supervision', icon: ShieldAlert, hint: 'Incidents à traiter' },
      { key: 'sites', label: 'Sites', to: '/sites', icon: Globe, hint: 'Registre des sites clients' },
      { key: 'tracker', label: 'Trackers', to: '/tracker', icon: Radar, hint: 'Supervision temps réel' },
    ],
  },
  {
    key: 'produits',
    label: 'Produits',
    space: 'control',
    items: [
      { key: 'scanner', label: 'Scanner', to: '/scanner', icon: ScanLine, hint: 'Analyse de vulnérabilités' },
      { key: 'comply', label: 'Comply', to: '/comply', icon: BadgeCheck, hint: 'Conformité RGPD' },
      { key: 'ssl', label: 'SSL Monitor', to: '/ssl', icon: LockKeyhole, hint: 'Certificats TLS' },
    ],
  },
];

/**
 * Identité réservée de l'assistant dans le chat d'équipe. Les enregistrements
 * qu'il écrit ne comptent pas comme « activité de l'autre opérateur ».
 */
export const AJMANI_EMAIL = 'ajmani@amn-devsec.com';

/** Onglets dont la collection est partagée et où « l'autre a ajouté » a du sens. */
export const ACTIVITY_TABS: ActivityTab[] = [
  { routeKey: '/team', collection: 'messages', noun: 'Message' },
  { routeKey: '/tasks', collection: 'tasks', noun: 'Tâche' },
  { routeKey: '/decisions', collection: 'decisions', noun: 'Décision' },
  { routeKey: '/knowledge', collection: 'knowledge', noun: 'Connaissance' },
  { routeKey: '/notes', collection: 'notes', noun: 'Note' },
  { routeKey: '/pages', collection: 'pages', noun: 'Page' },
  // Le calendrier entre dans le Poste de travail : un rendez-vous ajouté par
  // l'un doit se signaler à l'autre, exactement comme une tâche.
  { routeKey: '/agenda', collection: 'appointments', noun: 'Rendez-vous' },
  // Une commande qui arrive du site est le cas le plus fort de cette liste :
  // personne ne l'a écrite depuis un poste, donc personne ne l'attend. La
  // pastille est le seul signal qu'elle existe.
  { routeKey: '/commandes', collection: 'orders', noun: 'Commande' },
];


/**
 * Correspondance chemin → « pièce » d'animation (voir lib/transitions.ts).
 * Le préfixe le plus long d'abord : `/tracker/site/:id` doit tomber sur la
 * même entrée que `/tracker`, pas sur le défaut.
 */
export const PAGE_ROOMS: [string, string][] = [
  // Les trois écrans de la Tour de contrôle partagent l'entrée « supervision » :
  // on y arrive par le haut, comme sur un mur d'écrans qui s'allume.
  // AVANT `/tour` : la correspondance est au PREMIER préfixe qui colle (voir
  // variantsForPath), donc un chemin plus long placé après ne serait jamais
  // atteint. L'atelier n'entre pas comme un mur d'écrans qui s'allume : c'est
  // un lieu où l'on fabrique, donc une entrée posée et frontale.
  ['/tour/generateur', 'analyse'],
  ['/tour', 'supervision'],
  ['/agenda', 'registre'],
  ['/sites', 'registre'],
  ['/team', 'fil'],
  ['/tasks', 'tableau'],
  ['/clients', 'fiches'],
  ['/facturation', 'fiches'],
  ['/projets', 'tableau'],
  ['/depenses', 'fiches'],
  ['/temps', 'registre'],
  ['/calculateurs', 'analyse'],
  ['/commandes', 'fiches'],
  ['/supervision', 'supervision'],
  ['/tracker', 'supervision'],
  ['/scanner', 'analyse'],
  ['/comply', 'analyse'],
  // SSL Monitor est un écran produit comme les deux autres — même entrée.
  ['/ssl', 'analyse'],
  ['/pages', 'journal'],
  ['/personnel/budget', 'analyse'],
  ['/personnel/courses', 'journal'],
  ['/decisions', 'journal'],
  ['/knowledge', 'base'],
  ['/reports', 'livrables'],
  ['/settings', 'reglages'],
  ['/membres', 'reglages'],
  ['/vault', 'coffre'],
];
