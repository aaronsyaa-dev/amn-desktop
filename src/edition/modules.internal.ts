import {
  Aperture,
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  BellRing,
  Binoculars,
  BookOpen,
  Bot,
  Boxes,
  Building2,
  Calculator,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  Camera,
  ChartLine,
  CheckSquare,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  Contact,
  ContactRound,
  CreditCard,
  DoorOpen,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Flame,
  FolderKanban,
  Frame,
  Gauge,
  GitMerge,
  Globe,
  GraduationCap,
  HandCoins,
  Headset,
  HeartHandshake,
  HeartPulse,
  History,
  Images,
  Inbox,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LayoutTemplate,
  Leaf,
  LibraryBig,
  LifeBuoy,
  ListChecks,
  ListTree,
  Lock,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  MessageSquareQuote,
  MessageSquareText,
  MessagesSquare,
  Mic,
  MonitorDot,
  NotebookPen,
  Palette,
  PartyPopper,
  PenLine,
  PenTool,
  PhoneCall,
  PiggyBank,
  QrCode,
  Radar,
  ReceiptEuro,
  Repeat,
  RotateCw,
  Route,
  Scale,
  ScanLine,
  ScanText,
  ScrollText,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Signature,
  SlidersVertical,
  Sparkles,
  SquareKanban,
  Stamp,
  Star,
  Sunrise,
  Target,
  Ticket,
  Timer,
  TrendingUp,
  Trophy,
  Truck,
  UserPlus,
  Users,
  UsersRound,
  Vote,
  Wallet,
  Workflow,
  Wrench,
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
    code: 'PI',
    label: 'Pilotage',
    space: 'workspace',
    items: [
      { key: 'home', label: 'Accueil', to: '/', icon: LayoutDashboard, hint: 'Le QG du jour' },
      { key: 'agenda', label: 'Calendrier', to: '/agenda', icon: CalendarDays, hint: 'Rendez-vous et disponibilités' },
      { key: 'projects', label: 'Projets', to: '/projets', icon: FolderKanban, hint: 'Ce qui avance, et ce qui bloque' },
      { key: 'tasks', label: 'Tâches', to: '/tasks', icon: CheckSquare, hint: 'Travail partagé' },
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
    code: 'CR',
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
      { key: 'pipeline', label: 'Prospects', to: '/pipeline', icon: SquareKanban, hint: 'Les prospects, de contact à gagné' },
      { key: 'reminders', label: 'Relances', to: '/relances', icon: BellRing, hint: 'Les factures échues, et le mot à envoyer' },
      { key: 'subscriptions', label: 'Abonnements', to: '/abonnements', icon: Repeat, hint: 'Ce qui revient chaque mois, facturé en un geste' },
      { key: 'contracts', label: 'Contrats', to: '/contrats', icon: Signature, hint: 'Ce qui est signé, jusqu’à quand, pour combien' },
      { key: 'reviews', label: 'Avis', to: '/avis', icon: Star, hint: 'Ce que les clientes disent, gardé ensemble' },
      { key: 'loyalty', label: 'Fidélité', to: '/fidelite', icon: Stamp, hint: 'La carte à tampons, sans le carton' },
      { key: 'referrals', label: 'Parrainage', to: '/parrainage', icon: HeartHandshake, hint: 'Qui a amené qui, et ce qu’on lui doit' },
      { key: 'booking', label: 'Rendez-vous en ligne', to: '/rdv-en-ligne', icon: CalendarCheck, hint: 'Une page publique branchée sur l’Agenda' },
      { key: 'cashCount', label: 'Caisse du jour', to: '/caisse', icon: Banknote, hint: 'Le fond, les espèces comptées, l’écart' },
    ],
  },
  {
    key: 'guichet',
    code: 'GU',
    label: 'Guichet',
    space: 'workspace',
    items: [
      { key: 'shop', label: 'Boutique', to: '/boutique', icon: ShoppingCart, hint: 'Ce qu’on achète seul, et où les paniers restent' },
      { key: 'ticketing', label: 'Billetterie', to: '/billetterie', icon: Ticket, hint: 'Les places vendues, puis les entrées à la porte' },
      { key: 'donations', label: 'Dons', to: '/dons', icon: HandCoins, hint: 'Une collecte, et ce qu’il reste à trouver' },
      { key: 'deposits', label: 'Acompte en ligne', to: '/acompte', icon: CreditCard, hint: 'Signé en ligne, payé en ligne — et ce qui attend entre les deux' },
      { key: 'chatbot', label: 'Chatbot', to: '/chatbot', icon: Bot, hint: 'Les questions posées, et celles restées sans réponse' },
      { key: 'switchboard', label: 'Standard', to: '/standard', icon: Headset, hint: 'Ce que l’assistant a promis en votre nom, au téléphone' },
    ],
  },
  {
    key: 'marketing',
    code: 'MK',
    label: 'Marketing',
    space: 'workspace',
    items: [
      { key: 'video', label: 'Montage vidéo', to: '/montage-video', icon: Clapperboard, hint: 'Un film court, contre la durée du format visé' },
      { key: 'adVisuals', label: 'Visuels pub', to: '/visuels-pub', icon: Frame, hint: 'Un visuel, décliné dans tous les formats' },
      { key: 'postPlanner', label: 'Planificateur', to: '/planificateur', icon: Clock, hint: 'Les posts de la semaine, contre l’heure où l’audience est là' },
      { key: 'podcast', label: 'Podcast', to: '/podcast', icon: Mic, hint: 'L’épisode entier, ses chapitres et ce qui peut partir' },
      { key: 'brand', label: 'Identité visuelle', to: '/identite-visuelle', icon: Palette, hint: 'Le logo à la taille de chacun de ses usages' },
      { key: 'productShots', label: 'Images produits', to: '/images-produits', icon: Aperture, hint: 'Le produit fixe, le décor qui change' },
      { key: 'sentiment', label: 'Sentiment', to: '/sentiment', icon: MessageSquareQuote, hint: 'Ce qu’on vous dit, en une phrase' },
      { key: 'watch', label: 'Veille', to: '/veille-prix', icon: Binoculars, hint: 'Vos prix, contre ceux du marché' },
      { key: 'nps', label: 'NPS', to: '/nps', icon: Gauge, hint: 'Qui tire de quel côté, et où s’arrête le score' },
    ],
  },
  {
    key: 'production',
    code: 'PR',
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
      { key: 'board', label: 'Tableau des projets', to: '/tableau-projets', icon: SquareKanban, hint: 'Les projets en colonnes, déplacés d’un geste' },
      { key: 'stock', label: 'Stock', to: '/stock', icon: Boxes, hint: 'Ce qu’il reste, et ce qui va manquer' },
      { key: 'suppliers', label: 'Fournisseurs', to: '/fournisseurs', icon: Truck, hint: 'Qui vous fournit quoi, et depuis quand' },
      { key: 'shifts', label: 'Planning d’équipe', to: '/planning', icon: CalendarRange, hint: 'Qui est là quel jour, semaine par semaine' },
      { key: 'checklists', label: 'Contrôles qualité', to: '/controles', icon: ClipboardCheck, hint: 'Des listes à cocher, et la trace de chaque passage' },
      { key: 'interventions', label: 'Interventions', to: '/interventions', icon: Camera, hint: 'Avant, pendant, après — le compte rendu d’un déplacement' },
      { key: 'assembly', label: 'Suivi de montage', to: '/montage', icon: Wrench, hint: 'Chaque chantier, étape par étape' },
      { key: 'aftersales', label: 'SAV', to: '/sav', icon: LifeBuoy, hint: 'Les demandes après vente, de l’ouverture à la résolution' },
      { key: 'bom', label: 'Composition & coût de revient', to: '/nomenclatures', icon: ListTree, hint: 'Ce qui compose un produit, et ce qu’il coûte' },
      { key: 'rounds', label: 'Tournées', to: '/tournees', icon: Route, hint: 'Les livraisons du jour, arrêt par arrêt' },
      { key: 'equipment', label: 'Matériel', to: '/materiel', icon: CalendarClock, hint: 'Qui a quoi, quand — sans double réservation' },
    ],
  },
  {
    key: 'finance',
    code: 'FI',
    label: 'Finance',
    space: 'workspace',
    items: [
      { key: 'cashForecast', label: 'Trésorerie prévue', to: '/tresorerie', icon: ChartLine, hint: 'Le solde sur douze semaines, et quand le pire touche zéro' },
      { key: 'scenarios', label: 'Scénarios', to: '/scenarios', icon: SlidersVertical, hint: 'Les hypothèses du budget, et laquelle pèse' },
      { key: 'loanSim', label: 'Simulateur de prêt', to: '/simulateur-pret', icon: Landmark, hint: 'Même prêt, trois durées, et ce que la trésorerie peut porter' },
      { key: 'analytics', label: 'Analytique', to: '/analytique', icon: TrendingUp, hint: 'La marge prévue au devis, contre la marge réelle' },
      { key: 'reconciliation', label: 'Rapprochement', to: '/rapprochement', icon: GitMerge, hint: 'Le relevé et les écritures, paire par paire' },
      { key: 'taxForecast', label: 'Prévision fiscale', to: '/prevision-fiscale', icon: Scale, hint: 'Ce qui, dans le solde, est déjà au fisc' },
      { key: 'currencies', label: 'Multi-devises', to: '/multi-devises', icon: Coins, hint: 'Ce qu’on vous doit en devises, et ce qu’un point de taux coûte' },
      { key: 'expenseClaims', label: 'Notes de frais', to: '/notes-de-frais', icon: ScanText, hint: 'Un ticket photographié, lu, et vérifié sur lui-même' },
      { key: 'incomingInvoices', label: 'Factures entrantes', to: '/factures-entrantes', icon: Inbox, hint: 'Les factures fournisseurs, triées par échéance' },
    ],
  },
  {
    key: 'collectif',
    code: 'CO',
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
    key: 'rh',
    code: 'RH',
    label: 'RH',
    space: 'workspace',
    items: [
      { key: 'recruitment', label: 'Recrutement', to: '/recrutement', icon: UserPlus, hint: 'Le trou dans la semaine, et qui le comble' },
      { key: 'procedures', label: 'Procédures', to: '/procedures', icon: ClipboardList, hint: 'Les procédures telles qu’on les affiche à l’atelier' },
      { key: 'training', label: 'Formation', to: '/formation', icon: GraduationCap, hint: 'Ce qui est su, et ce qui s’efface' },
      { key: 'certifications', label: 'Habilitations', to: '/habilitations', icon: KeyRound, hint: 'Qui peut intervenir sur quoi, et jusqu’à quand' },
      { key: 'payslips', label: 'Bulletins de paie', to: '/bulletins', icon: FileSpreadsheet, hint: 'Du coût employeur au net versé' },
    ],
  },
  {
    key: 'livrables',
    code: 'LV',
    label: 'Livrables',
    space: 'workspace',
    items: [
      { key: 'reports', label: 'Rapports', to: '/reports', icon: FileText, hint: 'Livrables clients' },
      { key: 'media', label: 'Médias', to: '/media', icon: Images, hint: 'Bibliothèque' },
    ],
  },
  {
    key: 'juridique',
    code: 'JU',
    label: 'Juridique',
    space: 'workspace',
    items: [
      { key: 'clauses', label: 'Clausier', to: '/clausier', icon: ScrollText, hint: 'Le contrat, et ce qu’il ne contient pas' },
      { key: 'remoteSign', label: 'Signature à distance', to: '/signature-a-distance', icon: PenLine, hint: 'Qui tient le document, et depuis quand' },
      { key: 'gdpr', label: 'RGPD', to: '/rgpd', icon: ShieldCheck, hint: 'Tout ce que le produit garde sur une personne' },
      { key: 'csr', label: 'Impact RSE', to: '/impact-rse', icon: Leaf, hint: 'L’empreinte de l’année, en cubes de cent kilos' },
      { key: 'kyc', label: 'Vérification d’identité', to: '/verification-identite', icon: Fingerprint, hint: 'Les contrôles d’un dossier, et celui qui bloque' },
    ],
  },
  {
    key: 'outils',
    code: 'OU',
    label: 'Outils',
    space: 'workspace',
    items: [
      { key: 'qr', label: 'QR codes', to: '/outils/qr', icon: QrCode, hint: 'Une adresse, un code à imprimer' },
      { key: 'converters', label: 'Convertisseurs', to: '/outils/convertisseurs', icon: ArrowLeftRight, hint: 'Unités, TVA, devises : le bon chiffre tout de suite' },
      { key: 'templates', label: 'Modèles', to: '/outils/modeles', icon: LayoutTemplate, hint: 'Des textes prêts, à trous' },
      { key: 'automations', label: 'Automatisations', to: '/outils/automatisations', icon: Workflow, hint: 'Si ceci arrive, alors cela se fait' },
      { key: 'calcPro', label: 'Calculatrice pro', to: '/outils/calculatrice', icon: Calculator, hint: 'Un ruban de caisse qu’on relit avant de chiffrer' },
      { key: 'dataPort', label: 'Import / export', to: '/outils/donnees', icon: Download, hint: 'Vos données, dans les deux sens' },
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
    code: 'PE',
    label: 'Personnel',
    space: 'workspace',
    items: [
      { key: 'budget', label: 'Avant la paie', to: '/personnel/budget', icon: PiggyBank, hint: 'Ce qu’il reste à dépenser' },
      { key: 'courses', label: 'Courses', to: '/personnel/courses', icon: ShoppingBasket, hint: 'Liste de courses et pages perso' },
      { key: 'habits', label: 'Habitudes', to: '/personnel/habitudes', icon: Sunrise, hint: 'Les vôtres, jour après jour' },
      { key: 'personalGoals', label: 'Objectifs perso', to: '/personnel/objectifs', icon: Trophy, hint: 'Ce que vous visez, et les pas pour y aller' },
      { key: 'diary', label: 'Journal perso', to: '/personnel/journal', icon: NotebookPen, hint: 'Quelques lignes par jour, pour vous' },
      { key: 'pomodoro', label: 'Pomodoro', to: '/personnel/pomodoro', icon: Timer, hint: '25 minutes, puis une pause — et le temps compté' },
      { key: 'health', label: 'Carnet de santé', to: '/personnel/sante', icon: HeartPulse, hint: 'Des dates et des échéances, rien de médical' },
    ],
  },
  {
    key: 'systeme',
    code: 'SY',
    label: 'Système',
    space: 'workspace',
    items: [
      { key: 'settings', label: 'Paramètres', to: '/settings', icon: Settings, hint: 'Profil et notifications' },
      { key: 'members', label: 'Membres', to: '/membres', icon: Users, hint: 'Qui travaille ici, et les places' },
      { key: 'assistance', label: 'Assistance', to: '/assistance', icon: MessageSquareText, hint: 'Écrire au prestataire' },
      { key: 'library', label: 'Bibliothèque', to: '/bibliotheque', icon: LibraryBig, hint: 'Tous les modules, rangés par sections' },
      { key: 'vault', label: 'Coffre-fort', to: '/vault', icon: Lock, hint: 'Clés et accès' },
    ],
  },
  /*
    LA GARDE (Bloc 3) — l'espace où l'on délègue : la Salle (le mur des
    gardes), les bureaux des chefs, la pile « À votre avis », la Salle
    commune, le calendrier. Tout vient du serveur (/v1/garde) ; rien ici
    n'est une démonstration.
  */
  {
    key: 'garde',
    code: 'LG',
    label: 'La Garde',
    space: 'garde',
    items: [
      { key: 'gardeSalle', label: 'La Salle', to: '/garde', icon: Shield, hint: 'Le mur des gardes : qui fait quoi, maintenant' },
      { key: 'gardeAjmani', label: 'Ajmani', to: '/garde/ajmani', icon: Sparkles, hint: 'Le chef d’état-major : il parle en premier, d’une seule proposition' },
      { key: 'gardePile', label: 'À votre avis', to: '/garde/pile', icon: Inbox, hint: 'Ce qui attend une décision humaine' },
      { key: 'gardeBureaux', label: 'Les bureaux', to: '/garde/bureaux', icon: DoorOpen, hint: 'Parler à un chef de garde' },
      { key: 'gardeCommune', label: 'Salle commune', to: '/garde/commune', icon: MessagesSquare, hint: 'Parler à toute la Garde, la Relève du jour' },
      { key: 'gardeCalendrier', label: 'Calendrier', to: '/garde/calendrier', icon: CalendarClock, hint: 'Ce que la Garde fera cette semaine' },
    ],
  },
  {
    key: 'tour',
    code: 'SU',
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
    code: 'PA',
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
      { key: 'socMaturity', label: 'Maturité SOC', to: '/maturite-soc', icon: Gauge, hint: 'Où en est chaque cliente, sur des signaux réels' },
      { key: 'orgCompare', label: 'Comparatif clientes', to: '/comparatif', icon: Scale, hint: 'Toutes les organisations côte à côte' },
      { key: 'customAlerts', label: 'Alertes personnalisées', to: '/alertes-personnalisees', icon: BellRing, hint: 'Vos propres seuils sur le parc' },
      { key: 'clientReport', label: 'Rapport client enrichi', to: '/rapport-client', icon: FileBarChart, hint: 'Tout ce qu’on sait d’une cliente, en une page imprimable' },
    ],
  },
  {
    key: 'produits',
    code: 'PD',
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
  ['/assistance', 'fil'],
  ['/verification-identite', 'registre'],
  ['/impact-rse', 'registre'],
  ['/rgpd', 'registre'],
  ['/signature-a-distance', 'registre'],
  ['/clausier', 'registre'],
  ['/bulletins', 'registre'],
  ['/habilitations', 'registre'],
  ['/formation', 'registre'],
  ['/procedures', 'registre'],
  ['/recrutement', 'registre'],
  ['/factures-entrantes', 'analyse'],
  ['/notes-de-frais', 'analyse'],
  ['/multi-devises', 'analyse'],
  ['/prevision-fiscale', 'analyse'],
  ['/rapprochement', 'analyse'],
  ['/analytique', 'analyse'],
  ['/simulateur-pret', 'analyse'],
  ['/scenarios', 'analyse'],
  ['/tresorerie', 'analyse'],
  ['/nps', 'fiches'],
  ['/veille-prix', 'fiches'],
  ['/sentiment', 'fiches'],
  ['/images-produits', 'fiches'],
  ['/identite-visuelle', 'fiches'],
  ['/podcast', 'fiches'],
  ['/planificateur', 'fiches'],
  ['/visuels-pub', 'fiches'],
  ['/montage-video', 'fiches'],
  ['/standard', 'fiches'],
  ['/chatbot', 'fiches'],
  ['/acompte', 'fiches'],
  ['/dons', 'fiches'],
  ['/billetterie', 'fiches'],
  ['/boutique', 'fiches'],
  ['/materiel', 'tableau'],
  ['/tournees', 'registre'],
  ['/caisse', 'registre'],
  ['/rapport-client', 'fiches'],
  ['/alertes-personnalisees', 'reglages'],
  ['/comparatif', 'tableau'],
  ['/maturite-soc', 'tableau'],
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
  ['/bibliotheque', 'reglages'],
  ['/vault', 'coffre'],
];
