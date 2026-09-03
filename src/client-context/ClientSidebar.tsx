import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
  LogOut,
  NotebookPen,
  PartyPopper,
  ReceiptEuro,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Timer,
  Wallet,
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
  Users,
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
  Banknote,
  Route,
  CalendarClock,
} from 'lucide-react';
import type { NavItem } from '../data/navigation';
import { isModuleEnabled } from '../data/spaces';
import { useOrgContext } from '../state/OrgContextContext';
import { OrgAvatar } from '../components/org-rail/OrgAvatar';
import { OrgSwitchButton } from '../components/org-rail/OrgSwitchButton';
import { CLIENT_PRODUCT_NAME } from '../edition/edition';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import { libelleNav, libelleSection, useLangue } from '../i18n';

const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

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
export const CLIENT_SECTIONS: Array<{ label: string; keys: string[] }> = [
  { label: 'Pilotage', keys: ['home', 'agenda', 'projects', 'tasks', 'okr', 'weekly', 'meetings', 'priorities', 'routines', 'logbook', 'forms', 'minisite', 'newsletter', 'esign', 'portfolio'] },
  { label: 'Clients & revenus', keys: ['clients', 'invoices', 'orders', 'evenements', 'pipeline', 'reminders', 'subscriptions', 'contracts', 'reviews', 'loyalty', 'referrals', 'booking', 'cashCount'] },
  { label: 'Production', keys: ['time', 'expenses', 'calculators', 'board', 'stock', 'suppliers', 'shifts', 'checklists', 'assembly', 'aftersales', 'bom', 'rounds', 'equipment'] },
  { label: 'Documents', keys: ['notes', 'pages', 'reports', 'media'] },
  { label: 'Collectif', keys: ['dm', 'groups', 'announcements', 'polls', 'leaves', 'directory', 'calls'] },
  { label: 'Outils', keys: ['qr', 'converters', 'templates', 'automations', 'dataPort'] },
  { label: 'Personnel', keys: ['habits', 'personalGoals', 'diary', 'pomodoro'] },
  { label: 'Système', keys: ['settings'] },
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
function clientSections(): Array<{ label: string; items: NavItem[] }> {
  const open = clientModules();
  const claimed = new Set(CLIENT_SECTIONS.flatMap((s) => s.keys));
  // L'ordre du GROUPE, pas celui du catalogue. `CLIENT_MODULES` liste les
  // modules dans un ordre hérité (Dépenses avant Temps) ; l'édition Business,
  // elle, les présente dans l'ordre de ses sections. Filtrer le catalogue
  // rendait donc « Dépenses, Temps » ici et « Temps, Dépenses » chez elle —
  // deux fois la même liste, jamais dans le même ordre, ce qui est exactement
  // ce que ce contexte existe pour éviter.
  const sections = CLIENT_SECTIONS.map((section) => ({
    label: libelleSection(section.label),
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
  /*
    Le tiroir de navigation sur téléphone. Il couvre l'écran entier, et son
    fond ne se referme qu'au doigt — Échap est le seul recours au clavier,
    y compris sur un poste où la fenêtre est étroite.
  */
  useFermetureEchap(mobileOpen, () => onClose?.());

  const location = useLocation();
  const { support, leaveOrganization } = useOrgContext();

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null || !mobileOpen) return;
    if ((e.changedTouches[0]?.clientX ?? start) - start < -45) onClose?.();
  };

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  /*
    Même règle que les deux autres barres : la ligne courante doit être
    visible, sinon on arrive sur un écran et la barre ne dit pas où l'on est.
    `nearest` — une ligne déjà visible ne fait rien bouger.
  */
  const barre = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const l = barre.current?.querySelector('a[aria-current="page"]');
    if (l && l.getBoundingClientRect().height > 0) l.scrollIntoView({ block: 'nearest' });
  }, [location.pathname]);

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="client-nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-56 flex-shrink-0 flex-col border-r border-border bg-[#0d0d0d] py-4 transition-transform duration-300 md:relative md:z-30 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile : le rail est masqué, cette ligne le remplace. */}
        <div className="px-3 md:hidden">
          <OrgSwitchButton onNavigate={onClose} />
        </div>

        <div className="mb-3 hidden items-center gap-2.5 px-4 md:flex">
          <OrgAvatar
            name={support?.orgName ?? ''}
            logoDataUrl={support?.logoDataUrl}
            size={32}
            rounded="rounded-xl"
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight text-text-primary">
              {support?.orgName}
            </p>
            {/*
              Le produit que la CLIENTE fait tourner, pas le nôtre.

              La ligne disait « AMN Business » — notre application interne —
              juste sous le nom de la cliente, comme si c'était la sienne. Elle
              en fait tourner une autre, qui s'appelle « AMN Desktop », et c'est
              cette information-là qui est utile ici : on regarde son
              organisation, pas la nôtre.
            */}
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
              {CLIENT_PRODUCT_NAME}
            </p>
          </div>
        </div>

        <nav ref={barre} className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3">
          {clientSections().map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              <p className="eyebrow px-3 pb-1.5">{libelleSection(section.label)}</p>
              {section.items.map((item) => {
                const active = isActive(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    onClick={onClose}
                    // Laquelle des entrées est l'écran courant, pour un lecteur
                    // d'écran comme pour le défilement ci-dessus.
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 md:min-h-0 ${
                      active
                        ? 'text-text-primary'
                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="client-nav-active"
                        className="absolute inset-0 rounded-lg bg-accent-muted"
                        transition={TRANSITION}
                        aria-hidden
                      />
                    )}
                    <span className="relative">
                      <Icon size={19} strokeWidth={1.75} />
                    </span>
                    <span className="relative select-none whitespace-nowrap">{libelleNav(item)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-border px-3 pt-2">
          <Link
            to="/administration"
            onClick={onClose}
            aria-current={isActive('/administration') ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 md:min-h-0 ${
              isActive('/administration')
                ? 'bg-accent-muted text-text-primary'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <ShieldCheck size={19} strokeWidth={1.75} />
            <span className="select-none whitespace-nowrap">Administration</span>
          </Link>
          <button
            type="button"
            onClick={() => void leaveOrganization()}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary md:min-h-0"
          >
            <LogOut size={19} strokeWidth={1.75} />
            <span className="select-none whitespace-nowrap">Quitter le contexte</span>
          </button>
        </div>
      </aside>
    </>
  );
}
