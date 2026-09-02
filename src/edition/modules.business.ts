import {
  Calculator,
  CalendarDays,
  CheckSquare,
  Contact,
  FileText,
  FolderKanban,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  Lock,
  MessageSquareText,
  NotebookPen,
  PartyPopper,
  PiggyBank,
  ReceiptEuro,
  Settings,
  ShoppingBag,
  ShoppingBasket,
  Timer,
  Users,
  Wallet,
  Compass,
  MessageCircle,
  UsersRound,
  Megaphone,
  Vote,
  CalendarOff,
  ContactRound,
  PhoneCall,
  SquareKanban,
  BellRing,
  Repeat,
  Signature,
  Star,
  Stamp,
  HeartHandshake,
  CalendarCheck,
  Boxes,
  Truck,
  CalendarRange,
  ClipboardCheck,
  Wrench,
  LifeBuoy,
  ListTree,
  Target,
  ListChecks,
  Flame,
  RotateCw,
  BookOpen,
  Globe,
  Send,
  PenTool,
  Sunrise,
  Trophy,
  QrCode,
  ArrowLeftRight,
  Workflow,
  Download,
} from 'lucide-react';
import type { NavSection } from '../data/navigation';
import type { ActivityTab } from '../state/ActivityContext';

/**
 * Les modules d'AMN Business — l'édition livrée aux organisations clientes.
 *
 * Ce n'est pas la liste interne amputée : c'est la liste d'un outil de gestion
 * d'activité pour quelqu'un qui travaille seul. Le calendrier passe en
 * deuxième position parce que c'est le module qui sera ouvert tous les jours,
 * avant même les fiches clients.
 *
 * Ce qui n'y figure pas n'y figure pas non plus dans le bundle :
 *   - Sites, Trackers, Scanner, Comply, SSL Monitor — produits exclusifs
 *     d'AMN DevSec ;
 *   - Équipe, Décisions, Connaissances — outils de collaboration, sans objet
 *     pour une personne seule.
 *
 * Il n'y a donc pas de section « Produits » ici : une section vide dans le
 * lanceur dirait « il y a autre chose, mais pas pour vous », ce qui est
 * exactement l'impression à éviter.
 */
/**
 * Ce qu'une installation toute neuve épingle. L'agenda d'abord : c'est le
 * module de tous les jours, et il doit être à un clic dès la première ouverture.
 */
export const DEFAULT_FAVORITES = ['home', 'agenda', 'clients', 'invoices', 'tasks'] as const;

export const NAV_SECTIONS: NavSection[] = [
  /*
    LES MÊMES GROUPES QUE L'ÉDITION INTERNE, ET C'EST VOULU (REFONTE)
    ─────────────────────────────────────────────────────────────────
    « Activité » comptait douze entrées : la même liste plate que côté interne,
    avec le même défaut — à douze lignes, l'œil ne reconnaît plus de forme.

    Le découpage reprend celui de l'édition interne (Pilotage, Clients &
    revenus, Production, Documents, Système), non par facilité mais parce que
    la parité EST l'exigence : une cliente ne doit pas recevoir une version
    dégradée de ce qu'Aaron a sous les yeux. Ce qui diffère ici, ce sont les
    modules disponibles — pas le soin apporté à leur rangement.

    Les groupes qui n'ont pas d'objet pour quelqu'un qui travaille seul ne sont
    pas montrés vides : « Collectif » n'existe pas dans cette édition, il ne
    s'affiche donc nulle part. Une section vide dirait « il y a autre chose,
    mais pas pour vous ».
  */
  {
    key: 'pilotage',
    label: 'Pilotage',
    items: [
      { key: 'home', label: 'Accueil', to: '/', icon: LayoutDashboard, hint: 'Votre journée' },
      { key: 'agenda', label: 'Agenda', to: '/agenda', icon: CalendarDays, hint: 'Rendez-vous et disponibilités' },
      { key: 'projects', label: 'Projets', to: '/projets', icon: FolderKanban, hint: 'Ce qui avance, et ce qui bloque' },
      { key: 'tasks', label: 'Tâches', to: '/tasks', icon: CheckSquare, hint: 'Ce qu’il reste à faire' },
      { key: 'okr', label: 'Objectifs & résultats', to: '/objectifs-resultats', icon: Target, hint: 'Trois objectifs, des résultats mesurés, une saison' },
      { key: 'weekly', label: 'Revue hebdo', to: '/revue-hebdo', icon: ListChecks, hint: 'Cinq questions le vendredi, la semaine d’après plus nette' },
      { key: 'meetings', label: 'Réunions', to: '/reunions', icon: Users, hint: 'Un ordre du jour, des décisions, des suites' },
      { key: 'priorities', label: 'Priorités du jour', to: '/priorites', icon: Flame, hint: 'Trois choses, pas dix' },
      { key: 'routines', label: 'Routines', to: '/routines', icon: RotateCw, hint: 'Ce qui revient, coché chaque jour' },
      { key: 'logbook', label: 'Journal de bord', to: '/journal-de-bord', icon: BookOpen, hint: 'Ce qui s’est passé, daté, relisible' },
      { key: 'forms', label: 'Formulaires', to: '/formulaires', icon: FileText, hint: 'Une question posée au public, les réponses ici' },
      { key: 'minisite', label: 'Mini-page publique', to: '/mini-page', icon: Globe, hint: 'Votre page, avec vos avis et votre portfolio' },
      { key: 'newsletter', label: 'Lettre d’information', to: '/lettre', icon: Send, hint: 'Un mot à tous vos clients, depuis votre messagerie' },
      { key: 'esign', label: 'Signature sur place', to: '/signature', icon: PenTool, hint: 'Faire signer un devis ou un bon sur l’écran' },
      { key: 'portfolio', label: 'Portfolio', to: '/portfolio', icon: Images, hint: 'Vos réalisations, montrées sur la mini-page' },
    ],
  },
  {
    key: 'commerce',
    label: 'Clients & revenus',
    // La chaîne complète d'un euro dans son ordre réel : une fiche, un devis
    // qui devient une facture, et les commandes qui arrivent du site sans que
    // personne les ait saisies. Pour une boutique, c'est l'écran du matin.
    items: [
      { key: 'clients', label: 'Clients', to: '/clients', icon: Contact, hint: 'Fiches et devis' },
      { key: 'invoices', label: 'Facturation', to: '/facturation', icon: ReceiptEuro, hint: 'Factures et encaissements' },
      { key: 'orders', label: 'Commandes', to: '/commandes', icon: ShoppingBag, hint: 'Reçues du site' },
      // Les événements vivent avec les revenus, et non dans « Production » :
      // ce qu'on y regarde est un seuil de rentabilité et un nombre d'entrées
      // vendues, pas un temps passé.
      { key: 'evenements', label: 'Événements', to: '/evenements', icon: PartyPopper, hint: 'Dates, jauge, équilibre' },
      { key: 'pipeline', label: 'Pipeline', to: '/pipeline', icon: SquareKanban, hint: 'Les prospects, de contact à gagné' },
      { key: 'reminders', label: 'Relances', to: '/relances', icon: BellRing, hint: 'Les factures échues, et le mot à envoyer' },
      { key: 'subscriptions', label: 'Abonnements', to: '/abonnements', icon: Repeat, hint: 'Ce qui revient chaque mois, facturé en un geste' },
      { key: 'contracts', label: 'Contrats', to: '/contrats', icon: Signature, hint: 'Ce qui est signé, jusqu’à quand, pour combien' },
      { key: 'reviews', label: 'Avis', to: '/avis', icon: Star, hint: 'Ce que les clientes disent, gardé ensemble' },
      { key: 'loyalty', label: 'Fidélité', to: '/fidelite', icon: Stamp, hint: 'La carte à tampons, sans le carton' },
      { key: 'referrals', label: 'Parrainage', to: '/parrainage', icon: HeartHandshake, hint: 'Qui a amené qui, et ce qu’on lui doit' },
      { key: 'booking', label: 'Rendez-vous en ligne', to: '/rdv-en-ligne', icon: CalendarCheck, hint: 'Une page publique branchée sur l’Agenda' },
    ],
  },
  {
    key: 'production',
    label: 'Production',
    // Les deux faces de ce qu'une prestation coûte — ce qu'on sort, ce qu'on y
    // passe — et l'outil qui en tire un prix. Les calculateurs agrègent
    // précisément les deux autres.
    items: [
      { key: 'time', label: 'Temps', to: '/temps', icon: Timer, hint: 'Chronomètre et temps passé' },
      { key: 'expenses', label: 'Dépenses', to: '/depenses', icon: Wallet, hint: 'Ce que vous sortez, avec les reçus' },
      { key: 'calculators', label: 'Calculateurs', to: '/calculateurs', icon: Calculator, hint: 'Prix, marges, répartition' },
      { key: 'board', label: 'Tableau des projets', to: '/tableau-projets', icon: SquareKanban, hint: 'Les projets en colonnes, déplacés d’un geste' },
      { key: 'stock', label: 'Stock', to: '/stock', icon: Boxes, hint: 'Ce qu’il reste, et ce qui va manquer' },
      { key: 'suppliers', label: 'Fournisseurs', to: '/fournisseurs', icon: Truck, hint: 'Qui vous fournit quoi, et depuis quand' },
      { key: 'shifts', label: 'Planning d’équipe', to: '/planning', icon: CalendarRange, hint: 'Qui est là quel jour, semaine par semaine' },
      { key: 'checklists', label: 'Contrôles qualité', to: '/controles', icon: ClipboardCheck, hint: 'Des listes à cocher, et la trace de chaque passage' },
      { key: 'assembly', label: 'Suivi de montage', to: '/montage', icon: Wrench, hint: 'Chaque chantier, étape par étape' },
      { key: 'aftersales', label: 'SAV', to: '/sav', icon: LifeBuoy, hint: 'Les demandes après vente, de l’ouverture à la résolution' },
      { key: 'bom', label: 'Nomenclatures', to: '/nomenclatures', icon: ListTree, hint: 'Ce qui compose un produit, et ce qu’il coûte' },
    ],
  },
  {
    key: 'documents',
    label: 'Documents',
    items: [
      { key: 'notes', label: 'Notes', to: '/notes', icon: NotebookPen, hint: 'Bloc-notes' },
      // Voisin des Notes, et distinct d'elles : une note est un jet personnel,
      // une page est un support qu'on tient à jour et que d'autres relisent.
      { key: 'pages', label: 'Pages', to: '/pages', icon: LayoutTemplate, hint: 'Fiches et supports partagés' },
      { key: 'reports', label: 'Rapports', to: '/reports', icon: FileText, hint: 'Comptes-rendus' },
      { key: 'media', label: 'Médias', to: '/media', icon: Images, hint: 'Photos et fichiers' },
    ],
  },
  {
    key: 'collectif',
    label: 'Collectif',
    items: [
      { key: 'dm', label: 'Messages privés', to: '/messages-prives', icon: MessageCircle, hint: 'Écrire à une personne, sans le groupe' },
      { key: 'groups', label: 'Groupes', to: '/groupes', icon: UsersRound, hint: 'Des fils à plusieurs, par sujet ou par équipe' },
      { key: 'announcements', label: 'Annonces', to: '/annonces', icon: Megaphone, hint: 'Ce que tout le monde doit avoir lu' },
      { key: 'polls', label: 'Sondages', to: '/sondages', icon: Vote, hint: 'Une question, un vote par personne' },
      { key: 'leaves', label: 'Absences', to: '/absences', icon: CalendarOff, hint: 'Congés, maladie, télétravail — qui est là' },
      { key: 'directory', label: 'Trombinoscope', to: '/trombinoscope', icon: ContactRound, hint: 'Les visages, les rôles, qui est là' },
      { key: 'calls', label: 'Appels', to: '/appels', icon: PhoneCall, hint: 'Appeler un membre, inviter un visiteur par lien' },
    ],
  },
  {
    key: 'outils',
    label: 'Outils',
    items: [
      { key: 'qr', label: 'QR codes', to: '/outils/qr', icon: QrCode, hint: 'Une adresse, un code à imprimer' },
      { key: 'converters', label: 'Convertisseurs', to: '/outils/convertisseurs', icon: ArrowLeftRight, hint: 'Unités, TVA, devises : le bon chiffre tout de suite' },
      { key: 'templates', label: 'Modèles', to: '/outils/modeles', icon: LayoutTemplate, hint: 'Des textes prêts, à trous' },
      { key: 'automations', label: 'Automatisations', to: '/outils/automatisations', icon: Workflow, hint: 'Si ceci arrive, alors cela se fait' },
      { key: 'dataPort', label: 'Import / export', to: '/outils/donnees', icon: Download, hint: 'Vos données, dans les deux sens' },
    ],
  },
  {
    /*
      PERSONNEL — UN BONUS, PAS UN PRODUIT (BLOC 2)

      Inclus dans les desktops business déjà payés. Ce n'est pas une phrase de
      commercial posée sur du code neutre : ces deux modules n'ont AUCUNE clé
      dans `ORG_MODULES` (amn-api), donc rien ne permet de les ouvrir ni de
      les fermer par organisation, donc rien ne permet de les vendre. Il n'y a
      pas de levier parce qu'il n'y en a pas — voir `ALWAYS_ON` dans
      `scripts/check-modules.mjs`.

      Ils ne sont pas non plus visibles en session de support : un budget de
      fin de mois et une liste de courses ne regardent pas AMN DevSec. Voir
      `NOT_IN_SUPPORT`, où le Coffre-fort figure déjà pour la même raison.

      Rangés en dernier, juste avant Système : c'est ce qu'on ouvre le soir,
      pas ce qu'on ouvre pour travailler.
    */
    key: 'personnel',
    label: 'Personnel',
    items: [
      { key: 'budget', label: 'Avant la paie', to: '/personnel/budget', icon: PiggyBank, hint: 'Ce qu’il reste à dépenser' },
      { key: 'courses', label: 'Courses', to: '/personnel/courses', icon: ShoppingBasket, hint: 'Liste de courses et pages perso' },
      { key: 'habits', label: 'Habitudes', to: '/personnel/habitudes', icon: Sunrise, hint: 'Les vôtres, jour après jour' },
      { key: 'personalGoals', label: 'Objectifs perso', to: '/personnel/objectifs', icon: Trophy, hint: 'Ce que vous visez, et les pas pour y aller' },
      { key: 'diary', label: 'Journal perso', to: '/personnel/journal', icon: NotebookPen, hint: 'Quelques lignes par jour, pour vous' },
      { key: 'pomodoro', label: 'Pomodoro', to: '/personnel/pomodoro', icon: Timer, hint: '25 minutes, puis une pause — et le temps compté' },
    ],
  },
  {
    key: 'systeme',
    label: 'Système',
    items: [
      { key: 'settings', label: 'Paramètres', to: '/settings', icon: Settings, hint: 'Profil et notifications' },
      { key: 'members', label: 'Membres', to: '/membres', icon: Users, hint: 'Qui travaille ici, et les places' },
      { key: 'assistance', label: 'Assistance', to: '/assistance', icon: MessageSquareText, hint: 'Écrire à votre prestataire' },
      { key: 'discover', label: 'Découvrir', to: '/decouvrir', icon: Compass, hint: 'Tout ce qui existe, rangé' },
      { key: 'vault', label: 'Coffre-fort', to: '/vault', icon: Lock, hint: 'Mots de passe et accès' },
    ],
  },
];

/**
 * Pas d'assistant dans cette édition : la chaîne vide ne peut correspondre à
 * aucun auteur d'enregistrement, donc le filtre d'activité la traverse sans
 * rien exclure.
 */
export const AJMANI_EMAIL = '';

/**
 * Onglets suivis pour les pastilles « non vu ».
 *
 * Utile même à une seule personne : la synchronisation entre son ordinateur et
 * son téléphone fait bien apparaître, d'un appareil à l'autre, ce qu'elle a
 * ajouté depuis l'autre.
 */
export const ACTIVITY_TABS: ActivityTab[] = [
  { routeKey: '/agenda', collection: 'appointments', noun: 'Rendez-vous' },
  { routeKey: '/tasks', collection: 'tasks', noun: 'Tâche' },
  { routeKey: '/clients', collection: 'clients', noun: 'Client' },
  { routeKey: '/notes', collection: 'notes', noun: 'Note' },
  // Une page est écrite à plusieurs : c'est justement le module où « quelqu'un
  // a changé quelque chose depuis l'autre appareil » mérite d'être signalé.
  { routeKey: '/pages', collection: 'pages', noun: 'Page' },
  { routeKey: '/media', collection: 'media', noun: 'Média' },
  // Une dépense saisie sur le téléphone doit se signaler sur le poste — c'est
  // le cas d'usage même du module : on photographie le reçu dehors, on
  // retrouve la dépense en rentrant. Le temps n'y figure pas : un chronomètre
  // en cours ferait clignoter une pastille en permanence.
  { routeKey: '/depenses', collection: 'expenses', noun: 'Dépense' },
  // Le cas le plus fort de cette liste : une commande arrive du site, personne
  // ne l'a écrite, donc personne ne l'attend. La pastille est le seul signal.
  { routeKey: '/commandes', collection: 'orders', noun: 'Commande' },
];


/** Correspondance chemin → « pièce » d'animation (voir lib/transitions.ts). */
export const PAGE_ROOMS: [string, string][] = [
  ['/agenda', 'registre'],
  ['/tasks', 'tableau'],
  ['/clients', 'fiches'],
  ['/facturation', 'fiches'],
  ['/projets', 'tableau'],
  ['/depenses', 'fiches'],
  ['/temps', 'registre'],
  ['/calculateurs', 'analyse'],
  ['/commandes', 'fiches'],
  ['/notes', 'journal'],
  ['/pages', 'journal'],
  ['/personnel/budget', 'analyse'],
  ['/personnel/courses', 'journal'],
  ['/media', 'base'],
  ['/reports', 'livrables'],
  ['/settings', 'reglages'],
  ['/membres', 'reglages'],
  ['/assistance', 'fil'],
  ['/outils/donnees', 'reglages'],
  ['/outils/automatisations', 'reglages'],
  ['/outils/modeles', 'fiches'],
  ['/outils/convertisseurs', 'registre'],
  ['/outils/qr', 'registre'],
  ['/personnel/pomodoro', 'registre'],
  ['/personnel/journal', 'fil'],
  ['/personnel/objectifs', 'registre'],
  ['/personnel/habitudes', 'registre'],
  ['/portfolio', 'fiches'],
  ['/signature', 'registre'],
  ['/lettre', 'fil'],
  ['/mini-page', 'reglages'],
  ['/formulaires', 'registre'],
  ['/journal-de-bord', 'fil'],
  ['/routines', 'registre'],
  ['/priorites', 'registre'],
  ['/reunions', 'fil'],
  ['/revue-hebdo', 'fil'],
  ['/objectifs-resultats', 'tableau'],
  ['/nomenclatures', 'fiches'],
  ['/sav', 'registre'],
  ['/montage', 'fil'],
  ['/controles', 'registre'],
  ['/planning', 'tableau'],
  ['/fournisseurs', 'fiches'],
  ['/stock', 'registre'],
  ['/tableau-projets', 'tableau'],
  ['/rdv-en-ligne', 'reglages'],
  ['/parrainage', 'registre'],
  ['/fidelite', 'fiches'],
  ['/avis', 'fiches'],
  ['/contrats', 'registre'],
  ['/abonnements', 'registre'],
  ['/relances', 'fiches'],
  ['/pipeline', 'tableau'],
  ['/appels', 'reglages'],
  ['/trombinoscope', 'fiches'],
  ['/absences', 'registre'],
  ['/sondages', 'tableau'],
  ['/annonces', 'fil'],
  ['/groupes', 'fil'],
  ['/messages-prives', 'fil'],
  ['/decouvrir', 'reglages'],
  ['/vault', 'coffre'],
];
