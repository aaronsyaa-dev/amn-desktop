import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Aperture,
  ArrowLeftRight,
  Banknote,
  BellRing,
  Binoculars,
  BookOpen,
  Bot,
  Boxes,
  Calculator,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  Camera,
  ChartLine,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  Contact,
  ContactRound,
  CreditCard,
  Download,
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
  Images,
  Inbox,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LayoutPanelTop,
  LayoutTemplate,
  Leaf,
  LifeBuoy,
  ListChecks,
  ListTree,
  LogOut,
  Megaphone,
  MessageCircle,
  MessageSquareQuote,
  Mic,
  NotebookPen,
  Palette,
  PartyPopper,
  PenLine,
  PenTool,
  PhoneCall,
  QrCode,
  ReceiptEuro,
  Repeat,
  RotateCw,
  Route,
  Scale,
  ScanText,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Signature,
  SlidersVertical,
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
import type { NavItem } from '../data/navigation';
import { isModuleEnabled } from '../data/spaces';
import { useOrgContext } from '../state/OrgContextContext';
import { OrgAvatar } from '../components/org-rail/OrgAvatar';
import { OrgSwitchButton } from '../components/org-rail/OrgSwitchButton';
import { CLIENT_PRODUCT_NAME } from '../edition/edition';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import { libelleNav, libelleSection, useLangue } from '../i18n';
import { BarreRail, type FamilleRail } from '../components/rail/BarreRail';
import { CLE_CHOIX, deplierAuDemarrage, lireChoix } from '../lib/barreLaterale';
import { cheminLePlusPrecis } from '../lib/cheminCourant';

/**
 * La navigation d'un contexte client.
 *
 * Elle liste exactement les modules de l'édition Business — ni plus, ni moins.
 * C'est le point : l'opérateur doit voir ce que voit la cliente, pas une
 * version « interne » de son application. Y ajouter le moindre écran d'AMN
 * DevSec ferait de ce contexte un espace hybride qui n'existe chez personne, et
 * rendrait le support faux.
 *
 * La seule entrée qui n'est pas la sienne est « Administration », visuellement
 * détachée en bas : ce sont les gestes d'AMN DevSec SUR son organisation, et
 * ils n'ont rien à faire au milieu de ses écrans à elle.
 */
const CLIENT_MODULES: NavItem[] = [
  { key: 'home', label: 'Accueil', to: '/', icon: LayoutDashboard, hint: 'Sa journée' },
  { key: 'agenda', label: 'Agenda', to: '/agenda', icon: CalendarDays, hint: 'Rendez-vous' },
  { key: 'clients', label: 'Clients', to: '/clients', icon: Contact, hint: 'Fiches et devis' },
  { key: 'invoices', label: 'Facturation', to: '/facturation', icon: ReceiptEuro, hint: 'Factures et encaissements' },
  { key: 'projects', label: 'Projets', to: '/projets', icon: FolderKanban, hint: 'Ce qui avance, et ce qui bloque' },
  { key: 'tasks', label: 'Tâches', to: '/tasks', icon: CheckSquare, hint: 'Ce qu’il reste à faire' },
  { key: 'expenses', label: 'Dépenses', to: '/depenses', icon: Wallet, hint: 'Frais et justificatifs' },
  { key: 'time', label: 'Temps', to: '/temps', icon: Timer, hint: 'Chronomètre et temps passé' },
  { key: 'calculators', label: 'Calculateurs', to: '/calculateurs', icon: Calculator, hint: 'Prix, marges, répartition' },
  { key: 'orders', label: 'Commandes', to: '/commandes', icon: ShoppingBag, hint: 'Reçues du site' },
  { key: 'evenements', label: 'Événements', to: '/evenements', icon: PartyPopper, hint: 'Dates, jauge, équilibre' },
  { key: 'notes', label: 'Notes', to: '/notes', icon: NotebookPen, hint: 'Bloc-notes' },
  { key: 'pages', label: 'Pages', to: '/pages', icon: LayoutTemplate, hint: 'Fiches et supports partagés' },
  { key: 'reports', label: 'Rapports', to: '/reports', icon: FileText, hint: 'Comptes-rendus' },
  { key: 'media', label: 'Médias', to: '/media', icon: Images, hint: 'Photos et fichiers' },
  { key: 'settings', label: 'Paramètres', to: '/settings', icon: Settings, hint: 'Profil' },
  { key: 'dm', label: 'Messages privés', to: '/messages-prives', icon: MessageCircle, hint: 'Écrire à une personne, sans le groupe' },
  { key: 'groups', label: 'Groupes', to: '/groupes', icon: UsersRound, hint: 'Des fils à plusieurs, par sujet ou par équipe' },
  { key: 'announcements', label: 'Annonces', to: '/annonces', icon: Megaphone, hint: 'Ce que tout le monde doit avoir lu' },
  { key: 'polls', label: 'Sondages', to: '/sondages', icon: Vote, hint: 'Une question, un vote par personne' },
  { key: 'leaves', label: 'Absences', to: '/absences', icon: CalendarOff, hint: 'Congés, maladie, télétravail — qui est là' },
  { key: 'directory', label: 'Trombinoscope', to: '/trombinoscope', icon: ContactRound, hint: 'Les visages, les rôles, qui est là' },
  { key: 'calls', label: 'Appels', to: '/appels', icon: PhoneCall, hint: 'Appeler un membre, inviter un visiteur par lien' },
  { key: 'pipeline', label: 'Prospects', to: '/pipeline', icon: SquareKanban, hint: 'Les prospects, de contact à gagné' },
  { key: 'reminders', label: 'Relances', to: '/relances', icon: BellRing, hint: 'Les factures échues, et le mot à envoyer' },
  { key: 'subscriptions', label: 'Abonnements', to: '/abonnements', icon: Repeat, hint: 'Ce qui revient chaque mois, facturé en un geste' },
  { key: 'contracts', label: 'Contrats', to: '/contrats', icon: Signature, hint: 'Ce qui est signé, jusqu’à quand, pour combien' },
  { key: 'reviews', label: 'Avis', to: '/avis', icon: Star, hint: 'Ce que les clientes disent, gardé ensemble' },
  { key: 'loyalty', label: 'Fidélité', to: '/fidelite', icon: Stamp, hint: 'La carte à tampons, sans le carton' },
  { key: 'referrals', label: 'Parrainage', to: '/parrainage', icon: HeartHandshake, hint: 'Qui a amené qui, et ce qu’on lui doit' },
  { key: 'booking', label: 'Rendez-vous en ligne', to: '/rdv-en-ligne', icon: CalendarCheck, hint: 'Une page publique branchée sur l’Agenda' },
  { key: 'board', label: 'Tableau des projets', to: '/tableau-projets', icon: SquareKanban, hint: 'Les projets en colonnes, déplacés d’un geste' },
  { key: 'stock', label: 'Stock', to: '/stock', icon: Boxes, hint: 'Ce qu’il reste, et ce qui va manquer' },
  { key: 'suppliers', label: 'Fournisseurs', to: '/fournisseurs', icon: Truck, hint: 'Qui vous fournit quoi, et depuis quand' },
  { key: 'shifts', label: 'Planning d’équipe', to: '/planning', icon: CalendarRange, hint: 'Qui est là quel jour, semaine par semaine' },
  { key: 'checklists', label: 'Contrôles qualité', to: '/controles', icon: ClipboardCheck, hint: 'Des listes à cocher, et la trace de chaque passage' },
  { key: 'interventions', label: 'Interventions', to: '/interventions', icon: Camera, hint: 'Avant, pendant, après — le compte rendu d’un déplacement' },
  { key: 'calcPro', label: 'Calculatrice pro', to: '/outils/calculatrice', icon: Calculator, hint: 'Un ruban de caisse qu’on relit avant de chiffrer' },
  { key: 'assembly', label: 'Suivi de montage', to: '/montage', icon: Wrench, hint: 'Chaque chantier, étape par étape' },
  { key: 'aftersales', label: 'SAV', to: '/sav', icon: LifeBuoy, hint: 'Les demandes après vente, de l’ouverture à la résolution' },
  { key: 'bom', label: 'Composition & coût de revient', to: '/nomenclatures', icon: ListTree, hint: 'Ce qui compose un produit, et ce qu’il coûte' },
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
  { key: 'habits', label: 'Habitudes', to: '/personnel/habitudes', icon: Sunrise, hint: 'Les vôtres, jour après jour' },
  { key: 'personalGoals', label: 'Objectifs perso', to: '/personnel/objectifs', icon: Trophy, hint: 'Ce que vous visez, et les pas pour y aller' },
  { key: 'diary', label: 'Journal perso', to: '/personnel/journal', icon: NotebookPen, hint: 'Quelques lignes par jour, pour vous' },
  { key: 'pomodoro', label: 'Pomodoro', to: '/personnel/pomodoro', icon: Timer, hint: '25 minutes, puis une pause — et le temps compté' },
  { key: 'qr', label: 'QR codes', to: '/outils/qr', icon: QrCode, hint: 'Une adresse, un code à imprimer' },
  { key: 'converters', label: 'Convertisseurs', to: '/outils/convertisseurs', icon: ArrowLeftRight, hint: 'Unités, TVA, devises : le bon chiffre tout de suite' },
  { key: 'templates', label: 'Modèles', to: '/outils/modeles', icon: LayoutTemplate, hint: 'Des textes prêts, à trous' },
  { key: 'automations', label: 'Automatisations', to: '/outils/automatisations', icon: Workflow, hint: 'Si ceci arrive, alors cela se fait' },
  { key: 'dataPort', label: 'Import / export', to: '/outils/donnees', icon: Download, hint: 'Vos données, dans les deux sens' },
  { key: 'cashCount', label: 'Caisse du jour', to: '/caisse', icon: Banknote, hint: 'Le fond, les espèces comptées, l’écart' },
  { key: 'rounds', label: 'Tournées', to: '/tournees', icon: Route, hint: 'Les livraisons du jour, arrêt par arrêt' },
  { key: 'equipment', label: 'Matériel', to: '/materiel', icon: CalendarClock, hint: 'Qui a quoi, quand — sans double réservation' },
  { key: 'shop', label: 'Boutique', to: '/boutique', icon: ShoppingCart, hint: 'Ce qu’on achète seul, et où les paniers restent' },
  { key: 'ticketing', label: 'Billetterie', to: '/billetterie', icon: Ticket, hint: 'Les places vendues, puis les entrées à la porte' },
  { key: 'donations', label: 'Dons', to: '/dons', icon: HandCoins, hint: 'Une collecte, et ce qu’il reste à trouver' },
  { key: 'deposits', label: 'Acompte en ligne', to: '/acompte', icon: CreditCard, hint: 'Signé en ligne, payé en ligne — et ce qui attend entre les deux' },
  { key: 'chatbot', label: 'Chatbot', to: '/chatbot', icon: Bot, hint: 'Les questions posées, et celles restées sans réponse' },
  { key: 'switchboard', label: 'Standard', to: '/standard', icon: Headset, hint: 'Ce que l’assistant a promis en votre nom, au téléphone' },
  { key: 'video', label: 'Montage vidéo', to: '/montage-video', icon: Clapperboard, hint: 'Un film court, contre la durée du format visé' },
  { key: 'adVisuals', label: 'Visuels pub', to: '/visuels-pub', icon: Frame, hint: 'Un visuel, décliné dans tous les formats' },
  { key: 'postPlanner', label: 'Planificateur', to: '/planificateur', icon: Clock, hint: 'Les posts de la semaine, contre l’heure où l’audience est là' },
  { key: 'podcast', label: 'Podcast', to: '/podcast', icon: Mic, hint: 'L’épisode entier, ses chapitres et ce qui peut partir' },
  { key: 'brand', label: 'Identité visuelle', to: '/identite-visuelle', icon: Palette, hint: 'Le logo à la taille de chacun de ses usages' },
  { key: 'productShots', label: 'Images produits', to: '/images-produits', icon: Aperture, hint: 'Le produit fixe, le décor qui change' },
  { key: 'sentiment', label: 'Sentiment', to: '/sentiment', icon: MessageSquareQuote, hint: 'Ce qu’on vous dit, en une phrase' },
  { key: 'watch', label: 'Veille', to: '/veille-prix', icon: Binoculars, hint: 'Vos prix, contre ceux du marché' },
  { key: 'nps', label: 'NPS', to: '/nps', icon: Gauge, hint: 'Qui tire de quel côté, et où s’arrête le score' },
  { key: 'cashForecast', label: 'Trésorerie prévue', to: '/tresorerie', icon: ChartLine, hint: 'Le solde sur douze semaines, et quand le pire touche zéro' },
  { key: 'scenarios', label: 'Scénarios', to: '/scenarios', icon: SlidersVertical, hint: 'Les hypothèses du budget, et laquelle pèse' },
  { key: 'loanSim', label: 'Simulateur de prêt', to: '/simulateur-pret', icon: Landmark, hint: 'Même prêt, trois durées, et ce que la trésorerie peut porter' },
  { key: 'analytics', label: 'Analytique', to: '/analytique', icon: TrendingUp, hint: 'La marge prévue au devis, contre la marge réelle' },
  { key: 'reconciliation', label: 'Rapprochement', to: '/rapprochement', icon: GitMerge, hint: 'Le relevé et les écritures, paire par paire' },
  { key: 'taxForecast', label: 'Prévision fiscale', to: '/prevision-fiscale', icon: Scale, hint: 'Ce qui, dans le solde, est déjà au fisc' },
  { key: 'currencies', label: 'Multi-devises', to: '/multi-devises', icon: Coins, hint: 'Ce qu’on vous doit en devises, et ce qu’un point de taux coûte' },
  { key: 'expenseClaims', label: 'Notes de frais', to: '/notes-de-frais', icon: ScanText, hint: 'Un ticket photographié, lu, et vérifié sur lui-même' },
  { key: 'incomingInvoices', label: 'Factures entrantes', to: '/factures-entrantes', icon: Inbox, hint: 'Les factures fournisseurs, triées par échéance' },
  { key: 'recruitment', label: 'Recrutement', to: '/recrutement', icon: UserPlus, hint: 'Le trou dans la semaine, et qui le comble' },
  { key: 'procedures', label: 'Procédures', to: '/procedures', icon: ClipboardList, hint: 'Les procédures telles qu’on les affiche à l’atelier' },
  { key: 'training', label: 'Formation', to: '/formation', icon: GraduationCap, hint: 'Ce qui est su, et ce qui s’efface' },
  { key: 'certifications', label: 'Habilitations', to: '/habilitations', icon: KeyRound, hint: 'Qui peut intervenir sur quoi, et jusqu’à quand' },
  { key: 'payslips', label: 'Bulletins de paie', to: '/bulletins', icon: FileSpreadsheet, hint: 'Du coût employeur au net versé' },
  { key: 'clauses', label: 'Clausier', to: '/clausier', icon: ScrollText, hint: 'Le contrat, et ce qu’il ne contient pas' },
  { key: 'remoteSign', label: 'Signature à distance', to: '/signature-a-distance', icon: PenLine, hint: 'Qui tient le document, et depuis quand' },
  { key: 'gdpr', label: 'RGPD', to: '/rgpd', icon: ShieldCheck, hint: 'Tout ce que le produit garde sur une personne' },
  { key: 'csr', label: 'Impact RSE', to: '/impact-rse', icon: Leaf, hint: 'L’empreinte de l’année, en cubes de cent kilos' },
  { key: 'kyc', label: 'Vérification d’identité', to: '/verification-identite', icon: Fingerprint, hint: 'Les contrôles d’un dossier, et celui qui bloque' },
  { key: 'dashboard', label: 'Tableau de bord', to: '/tableau-de-bord', icon: LayoutPanelTop, hint: 'Un cadran au centre, choisi par vous' },
];

/**
 * Le même catalogue, pour la barre du pouce (voir MobileBottomNav). Exporté
 * plutôt que recopié : deux listes de modules clientes finiraient par diverger,
 * et la barre basse annoncerait des écrans que le tiroir ne montre pas.
 */
export const CLIENT_NAV_ITEMS = CLIENT_MODULES;

/**
 * Le même rangement que sa barre à elle (REFONTE).
 *
 * L'édition Business groupe ses modules (Pilotage, Clients & revenus,
 * Production, Documents, Système) ; cette barre-ci doit montrer la MÊME chose,
 * puisque tout l'intérêt du contexte de support est de voir son application
 * telle qu'elle est chez elle. Les groupes sont redéclarés plutôt qu'importés :
 * `@edition/modules` est résolu à la compilation, et dans un build interne il
 * rend le catalogue interne — importer d'ici afficherait nos sections à nous.
 *
 * Le regroupement est déclaré par CLÉS, jamais par recopie des entrées : un
 * module ajouté au catalogue et oublié ici n'est pas perdu, il tombe dans le
 * dernier groupe (voir `clientSections`). Une barre qui perd silencieusement un
 * écran est exactement le défaut que `scripts/check-modules.mjs` a été écrit
 * pour attraper.
 */
export const CLIENT_SECTIONS: Array<{ label: string; code: string; keys: string[] }> = [
  { label: 'Pilotage', code: 'PI', keys: ['home', 'agenda', 'projects', 'tasks', 'okr', 'weekly', 'meetings', 'priorities', 'routines', 'logbook', 'forms', 'minisite', 'newsletter', 'esign', 'portfolio', 'dashboard'] },
  { label: 'Clients & revenus', code: 'CR', keys: ['clients', 'invoices', 'orders', 'evenements', 'pipeline', 'reminders', 'subscriptions', 'contracts', 'reviews', 'loyalty', 'referrals', 'booking', 'cashCount'] },
  { label: 'Guichet', code: 'GU', keys: ['shop', 'ticketing', 'donations', 'deposits', 'chatbot', 'switchboard'] },
  { label: 'Marketing', code: 'MK', keys: ['video', 'adVisuals', 'postPlanner', 'podcast', 'brand', 'productShots', 'sentiment', 'watch', 'nps'] },
  { label: 'Production', code: 'PR', keys: ['time', 'expenses', 'calculators', 'board', 'stock', 'suppliers', 'shifts', 'checklists', 'interventions', 'assembly', 'aftersales', 'bom', 'rounds', 'equipment'] },
  { label: 'Finance', code: 'FI', keys: ['cashForecast', 'scenarios', 'loanSim', 'analytics', 'reconciliation', 'taxForecast', 'currencies', 'expenseClaims', 'incomingInvoices'] },
  { label: 'Documents', code: 'DO', keys: ['notes', 'pages', 'reports', 'media'] },
  { label: 'Juridique', code: 'JU', keys: ['clauses', 'remoteSign', 'gdpr', 'csr', 'kyc'] },
  { label: 'Collectif', code: 'CO', keys: ['dm', 'groups', 'announcements', 'polls', 'leaves', 'directory', 'calls'] },
  { label: 'RH', code: 'RH', keys: ['recruitment', 'procedures', 'training', 'certifications', 'payslips'] },
  { label: 'Outils', code: 'OU', keys: ['qr', 'converters', 'templates', 'automations', 'calcPro', 'dataPort'] },
  { label: 'Personnel', code: 'PE', keys: ['habits', 'personalGoals', 'diary', 'pomodoro'] },
  { label: 'Système', code: 'SY', keys: ['settings'] },
];

/**
 * Les modules réellement ouverts à cette cliente (BLOC E).
 *
 * Calculé à l'affichage plutôt que figé : le support doit voir SON application
 * telle qu'elle est chez elle. Montrer un module qu'on lui a fermé donnerait
 * un contexte hybride qui n'existe nulle part, et rendrait le support faux —
 * la même raison qui interdit d'ajouter ici nos écrans internes.
 */
function clientModules(): NavItem[] {
  return CLIENT_MODULES.filter((item) => isModuleEnabled(item.key));
}

/**
 * Les modules ouverts, rangés par groupe. Un groupe vidé de tous ses modules
 * disparaît — un intitulé seul dirait « il y a autre chose, mais pas pour
 * vous ». Ce qu'aucun groupe ne réclame atterrit dans le dernier plutôt que de
 * disparaître : perdre un écran en silence serait pire que le mal ranger.
 */
function clientSections(): Array<{ key: string; label: string; code: string; items: NavItem[] }> {
  const open = clientModules();
  const claimed = new Set(CLIENT_SECTIONS.flatMap((s) => s.keys));
  // L'ordre du GROUPE, pas celui du catalogue. `CLIENT_MODULES` liste les
  // modules dans un ordre hérité (Dépenses avant Temps) ; l'édition Business,
  // elle, les présente dans l'ordre de ses sections. Filtrer le catalogue
  // rendait donc « Dépenses, Temps » ici et « Temps, Dépenses » chez elle —
  // deux fois la même liste, jamais dans le même ordre, ce qui est exactement
  // ce que ce contexte existe pour éviter.
  const sections = CLIENT_SECTIONS.map((section) => ({
    key: section.code,
    label: libelleSection(section.label),
    code: section.code,
    items: section.keys
      .map((key) => open.find((item) => item.key === key))
      .filter((item): item is NavItem => Boolean(item)),
  }));
  const orphans = open.filter((item) => !claimed.has(item.key));
  if (orphans.length > 0) {
    const last = sections[sections.length - 1];
    last.items = [...last.items, ...orphans];
  }
  return sections.filter((section) => section.items.length > 0);
}

export function ClientSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  useLangue();
  useFermetureEchap(mobileOpen, () => onClose?.());

  const location = useLocation();
  const { support, leaveOrganization } = useOrgContext();
  const [deplie, setDeplie] = useState(() => {
    if (typeof window === 'undefined') return true;
    let choix: boolean | null = null;
    try {
      choix = lireChoix(window.localStorage.getItem(CLE_CHOIX));
    } catch {
      /* stockage refusé (navigation privée) : la largeur décidera */
    }
    return deplierAuDemarrage(window.innerWidth, choix);
  });

  const sections = clientSections();
  const familles: FamilleRail[] = sections.map((section) => ({
    key: section.key,
    label: section.label,
    code: section.code,
    items: section.items,
  }));
  const cheminCourant = cheminLePlusPrecis(
    location.pathname,
    sections.flatMap((section) => section.items),
  );

  const expanded = deplie || mobileOpen;

  return (
    <BarreRail
      familles={familles}
      cheminCourant={cheminCourant}
      deplie={deplie}
      mobileOpen={mobileOpen}
      onClose={onClose}
      onNavigate={onClose}
      libelle={libelleNav}
      /*
        Pas de palette ici non plus, et pour la même raison que l'édition
        cliente : `CommandPalette` importe le parc de sites et la Garde. ⌘K
        amène au champ de la coquille, qui filtre les modules de la CLIENTE —
        c'est-à-dire exactement ce que ce contexte existe pour montrer.
      */
      enTete={
        <div className="flex-none border-b border-border">
          {/* Mobile : le rail est masqué, cette ligne le remplace. */}
          <div className="px-3 pt-3 md:hidden">
            <OrgSwitchButton onNavigate={onClose} />
          </div>
          <div className="flex h-14 items-center gap-2.5 px-3.5">
            <OrgAvatar
              name={support?.orgName ?? ''}
              logoDataUrl={support?.logoDataUrl}
              size={26}
              rounded="rounded-lg"
            />
            {expanded && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold leading-tight text-text-primary">
                  {support?.orgName}
                </p>
                {/*
                  Le produit que la CLIENTE fait tourner, pas le nôtre. La ligne
                  a déjà affiché « AMN Business » — notre application interne —
                  juste sous le nom de la cliente, comme si c'était la sienne.
                */}
                <p className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
                  {CLIENT_PRODUCT_NAME}
                </p>
              </div>
            )}
          </div>
        </div>
      }
      pied={
        <div className="flex flex-none flex-col gap-0.5 border-t border-border bg-[#0a0a0a] p-2">
          {/*
            « Administration » reste DÉTACHÉE des familles, et c'est la même
            décision qu'avant le rail : ce sont les gestes d'AMN DevSec SUR
            l'organisation de la cliente, ils n'ont rien à faire au milieu de
            ses écrans à elle. Une tuile de rail les rangerait parmi les siens.
          */}
          <Link
            to="/administration"
            onClick={onClose}
            aria-current={location.pathname.startsWith('/administration') ? 'page' : undefined}
            title={!expanded ? 'Administration' : undefined}
            className={`flex min-h-11 items-center gap-2.5 px-2.5 py-2 text-[13px] transition-colors md:min-h-0 ${
              location.pathname.startsWith('/administration')
                ? 'bg-accent-muted text-text-primary'
                : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <ShieldCheck size={16} strokeWidth={2.1} />
            {expanded && <span className="truncate">Administration</span>}
          </Link>
          <button
            type="button"
            onClick={() => {
              setDeplie((v) => {
                try {
                  window.localStorage.setItem(CLE_CHOIX, String(!v));
                } catch {
                  /* stockage refusé : le choix ne vaut que pour cette session */
                }
                return !v;
              });
            }}
            aria-label={deplie ? 'Replier la barre' : 'Déplier la barre'}
            className="hidden items-center gap-2.5 px-2.5 py-2 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary md:flex"
          >
            {deplie ? (
              <ChevronsLeft size={16} strokeWidth={2.1} />
            ) : (
              <ChevronsRight size={16} strokeWidth={2.1} />
            )}
            {expanded && <span>Replier</span>}
          </button>
          <button
            type="button"
            onClick={() => void leaveOrganization()}
            title={!expanded ? 'Quitter le contexte' : undefined}
            aria-label="Quitter le contexte"
            className="flex min-h-11 items-center gap-2.5 px-2.5 py-2 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary md:min-h-0"
          >
            <LogOut size={16} strokeWidth={2.1} />
            {expanded && <span>Quitter le contexte</span>}
          </button>
        </div>
      }
    />
  );
}
