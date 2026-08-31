import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  LogOut,
  Pin,
  PinOff,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useActivity } from '../state/ActivityContext';
import { useNavFavorites } from '../state/useNavFavorites';
import { StatusBadge } from './StatusBadge';
import { useSitePanel } from './site-panel/SitePanelContext';
import { AppLauncher } from './AppLauncher';
import { useLangue, libelleNav, libelleSection, libelleEspace } from '../i18n';
import { OrgSwitchButton } from './org-rail/OrgSwitchButton';
import { type NavItem } from '../data/navigation';
import { SPACES, spaceByKey, spaceForPath, sectionsForSpace } from '../data/spaces';
import { CLE_CHOIX, deplierAuDemarrage, lireChoix } from '../lib/barreLaterale';
import { useFermetureEchap } from '../lib/useFermetureEchap';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 224;
const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

/**
 * La navigation de l'espace courant.
 *
 * Elle ne liste plus tous les écrans (BLOC C) et, depuis la refonte, elle ne
 * liste plus non plus tous les ESPACES : le sélecteur en tête décide lequel des
 * deux — Poste de travail ou Tour de contrôle — occupe la colonne. C'est le
 * point de la refonte : le travail quotidien et la supervision transverse ne se
 * mélangent plus dans une même liste plate.
 *
 * Les deux espaces n'ont pas la même forme de navigation, et c'est délibéré :
 *   - le Poste de travail garde la bande épinglée + le lanceur, parce que sa
 *     liste est longue et personnelle ;
 *   - la Tour de contrôle affiche ses modules en entier, parce qu'ils sont peu
 *     nombreux, fixes, et qu'on veut les voir tous d'un coup d'œil.
 */
export function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  /** Whether the mobile overlay drawer is open (< md only). */
  mobileOpen?: boolean;
  /** Close the mobile drawer (nav click, backdrop tap, swipe-left). */
  onClose?: () => void;
}) {
  const { t } = useLangue();
  /*
    Le tiroir de navigation sur téléphone. Il couvre l'écran entier, et son
    fond ne se referme qu'au doigt — Échap est le seul recours au clavier,
    y compris sur un poste où la fenêtre est étroite.
  */
  useFermetureEchap(mobileOpen, () => onClose?.());

  /*
    DÉPLIÉE PAR DÉFAUT QUAND L'ÉCRAN LE PERMET.

    C'était `useState(false)` — replié en toutes circonstances, sans raison
    écrite. Conséquence mesurée à 1 280, 1 400 et 1 920 px : le sélecteur
    d'espace se réduisait à une icône de 47 × 44 px sans texte, et les mots
    « Poste de travail » / « Tour de contrôle » n'apparaissaient nulle part.
    Or c'est par là qu'on atteint la Supervision, les Sites, les Trackers, le
    Scanner et Comply — tout le métier. D'où « l'étouffoir est introuvable » :
    il ne manquait pas, il était derrière une icône muette.

    La règle vit dans `src/lib/barreLaterale.ts`, avec ses deux entrées : un
    choix explicite gagne toujours, la largeur décide sinon.
  */
  const [isExpandedDesktop, setIsExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    let choix: boolean | null = null;
    try {
      choix = lireChoix(window.localStorage.getItem(CLE_CHOIX));
    } catch {
      /* stockage refusé (navigation privée) : la largeur décidera */
    }
    return deplierAuDemarrage(window.innerWidth, choix);
  });
  const [isSitesFlyoutOpen, setIsSitesFlyoutOpen] = useState(false);

  /* Le volet des sites se referme à Échap, comme tout ce qui s’ouvre par-dessus. */
  useFermetureEchap(isSitesFlyoutOpen, () => setIsSitesFlyoutOpen(false));
  const [isLauncherOpen, setLauncherOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { openSite } = useSitePanel();
  const { sites } = useRemoteSites();
  const { unseen } = useActivity();
  const { favorites, isFavorite, toggleFavorite } = useNavFavorites();

  // On mobile the drawer always shows the full (labelled) sidebar; on desktop
  // the collapse toggle controls it. Deriving it here keeps every render site
  // below working unchanged for both platforms.
  const isExpanded = isExpandedDesktop || mobileOpen;

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  // Every nav item — Sites included — navigates to its screen. The Sites
  // "registre" lives at /sites (with the "Nouveau site" button), so clicking
  // Sites must land there; the quick site-list flyout is opened separately via
  // the chevron, never by hijacking the main click.
  const handleNavClick = () => {
    setIsSitesFlyoutOpen(false);
    setLauncherOpen(false);
    onClose?.(); // close the mobile drawer after navigating
  };

  // Swipe-left on the open drawer closes it (mobile only).
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null || !mobileOpen) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (dx < -45) onClose?.();
  };

  // L'espace courant se lit dans l'URL : arriver sur `/scanner` par la palette
  // de commandes ou par une notification doit basculer la colonne, sans que
  // l'appelant ait à y penser.
  const space = spaceForPath(location.pathname);
  /*
    Les modules épinglés de l'ESPACE COURANT, dans l'ordre du catalogue.

    Filtrés sur l'espace : une épingle posée sur « Trackers » (Tour de contrôle)
    n'a rien à faire en tête du Poste de travail. Et l'ordre vient du catalogue
    plutôt que de l'ordre d'épinglage — la barre doit se relire pareil d'un jour
    à l'autre, pas se réorganiser selon l'ordre où l'on a cliqué.
  */
  const epingles = useMemo(
    () =>
      sectionsForSpace(space)
        .flatMap((section) => section.items)
        .filter((item) => favorites.includes(item.key)),
    [favorites, space],
  );


  /*
    Les clés RÉELLEMENT dessinées dans la bande. `epingles` ne suffit pas : la
    bande ne s'affiche que barre dépliée, et repliée c'est la ligne de section
    qui redevient l'unique occurrence.
  */
  const dansLaBande = useMemo(
    () => new Set(isExpanded ? epingles.map((e) => e.key) : []),
    [epingles, isExpanded],
  );

  // The pinned modules, in the catalogue's own order so the strip never
  // reshuffles itself under the cursor. An unknown key (a module removed since
  // the choice was made) is dropped rather than rendered as a dead row.
  // Restreint à l'espace courant : une épingle posée dans un espace n'a pas à
  // apparaître dans l'autre.
  // One nav row. Shared by both sections (workspace + produits) so the badge,
  // active indicator and collapsed/expanded behaviour stay identical.
  /*
    RAMENER L'ÉLÉMENT COURANT DANS LA VUE.

    Mesuré : en arrivant sur `#/notes` côté interne, le lien actif de la barre
    était visible à ZÉRO pour cent — entièrement défilé hors du cadre. La barre
    porte trente-trois entrées ; tout ce qui vit sous la ligne de flottaison
    laissait donc l'utilisateur sans repère, sur l'écran même où il venait
    d'arriver. La barre disait « tu n'es nulle part ».

    `block: 'nearest'` et pas `'center'` : quand l'élément est DÉJÀ visible, le
    navigateur ne bouge rien. On ne recentre donc pas la barre à chaque
    navigation — ce serait un mouvement gratuit, et la règle de confort
    (`docs/PRINCIPE-CONFORT.md`) tient autant contre l'agitation que pour la
    lisibilité. Le défilement est instantané, jamais animé : personne n'a
    demandé à regarder une barre glisser avant de lire son écran.
  */
  const barre = useRef<HTMLElement | null>(null);
  useEffect(() => {
    /*
      On cherche la ligne dans le DOM plutôt que de garder une `ref` dessus :
      un même écran peut apparaître DEUX fois dans la barre (« Tâches » vit à
      la fois dans le poste de travail et dans le pilotage), plus une troisième
      dans le tiroir du téléphone, replié à zéro pixel. Une `ref` posée sur
      « l'élément actif » recevait donc le dernier rendu — la copie invisible —
      et faisait défiler vers rien du tout.

      On prend la première ligne active qui a une hauteur : celle qu'on voit.
    */
    const lignes = barre.current?.querySelectorAll('a[aria-current="page"]') ?? [];
    for (const l of lignes) {
      if (l.getBoundingClientRect().height > 0) {
        l.scrollIntoView({ block: 'nearest' });
        return;
      }
    }
  }, [location.pathname]);

  /*
    UN SEUL « VOUS ÊTES ICI », ET C'EST CELUI DE LA SECTION.

    Cinq modules apparaissent DEUX fois dans la barre : une fois dans la bande
    d'épingles, une fois dans leur section (c'est assumé — un raccourci qui
    déplace la chose au lieu d'y mener n'est pas un raccourci). Sur `#/tasks`,
    les deux lignes se déclaraient donc courantes, et deux défauts avec :

      · deux `aria-current="page"` — l'attribut désigne LA page courante, au
        singulier. Un lecteur d'écran en annonçait deux ;
      · deux `layoutId` identiques pour framer-motion, qui est un cas non
        défini : deux éléments prétendent être le même, et c'est la
        bibliothèque qui arbitre en silence.

    Laquelle gagne ? La question a été tranchée par le MOUVEMENT, pas par le
    balisage. Les épingles sont la liste que l'utilisateur s'est faite de ce
    qu'il ouvre le plus. Si la ligne courante est celle de la section, alors
    ces cinq écrans-là — les plus fréquents — font défiler la barre à chaque
    fois, et la bande d'épingles disparaît vers le haut. En donnant la ligne
    courante à l'épingle, la barre ne bouge pas du tout pour eux et le repère
    est toujours au même endroit. « Utilisable des heures durant » se joue
    exactement là (`docs/PRINCIPE-CONFORT.md`).

    L'épingle est donc canonique quand elle est DESSINÉE — barre repliée, la
    bande n'existe pas et la section reprend le rôle. La ligne perdante garde
    la couleur du texte actif : on voit qu'on y est, sans le fond ni le trait,
    qui n'ont qu'un seul porteur.
  */
  const renderNavItem = (item: NavItem, canonique = true) => {
    const active = isActive(item.to);
    const Icon = item.icon;
    const count = unseen[item.to] ?? 0;
    const badge = count > 99 ? '99+' : String(count);
    return (
      <Link
        key={item.key}
        to={item.to}
        // `aria-current` dit à un lecteur d'écran laquelle des trente-trois
        // entrées est l'écran courant — et sert de repère au défilement
        // ci-dessus, qui n'a alors rien à deviner.
        aria-current={active && canonique ? 'page' : undefined}
        onClick={handleNavClick}
        title={!isExpanded ? libelleNav(item) : undefined}
        aria-label={libelleNav(item)}
        // 44 px sous `md` : le tiroir est la navigation principale du
        // téléphone, ses lignes ne peuvent pas être plus petites que les
        // cibles de la barre basse. Au pointeur, la densité d'origine reste.
        className={`group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-lg py-1.5 text-sm transition-colors duration-200 md:min-h-0 ${
          isExpanded ? 'px-3' : 'justify-center px-0'
        } ${
          active
            ? 'text-text-primary'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
        }`}
      >
        {/* The active state is a single surface that *slides* from the previous
            item rather than a flat background that blinks on. Two shared-layout
            elements — the tint and the left bar — travel together, which is the
            whole micro-interaction: the eye follows the selection instead of
            re-finding it. */}
        {active && canonique && (
          <>
            <motion.span
              layoutId="sidebar-active-surface"
              className="absolute inset-0 rounded-lg bg-accent-muted"
              transition={TRANSITION}
              aria-hidden
            />
            <motion.span
              layoutId="sidebar-active-indicator"
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
              transition={TRANSITION}
              aria-hidden
            />
          </>
        )}
        <span
          className={`relative transition-transform duration-200 ${
            active ? 'scale-105' : 'group-hover:scale-105'
          }`}
        >
          <Icon size={20} strokeWidth={1.75} />
        </span>
        {isExpanded && (
          <span className="relative select-none whitespace-nowrap">
            {libelleNav(item)}
          </span>
        )}
        {/* Unseen-activity badge (A3.3): additions/changes by the other
            operator since this tab was last opened. */}
        {count > 0 &&
          (isExpanded ? (
            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-none text-bg">
              {badge}
            </span>
          ) : (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold leading-none text-bg">
              {badge}
            </span>
          ))}
        {/*
          L'ÉPINGLE, RENDUE À LA BARRE (BLOC 1)

          L'épinglage n'avait pas disparu du code : il vivait dans le lanceur
          « Tous les modules », et le rangement en sections a retiré le seul
          bouton qui l'ouvrait sur ordinateur. La fonction est donc restée
          entière et devenue inatteignable — le lanceur ne subsiste que dans la
          barre du pouce, sous `md`.

          Elle revient ici, sur la ligne elle-même : c'est l'endroit où l'on est
          déjà quand on se dit « celui-là, je l'ouvre tous les jours », et ça
          n'ajoute aucun écran. Au survol seulement — une colonne d'épingles
          visible en permanence ferait dix-huit boutons devant dix-huit modules.

          `<span role="button">` et non `<button>` : la ligne EST un lien, et un
          bouton imbriqué dans un lien n'est pas du HTML valide (le même procédé
          que la liste rapide des sites, juste en dessous).
        */}
        {isExpanded && (
          <span
            role="button"
            tabIndex={0}
            aria-label={
              isFavorite(item.key) ? t('chrome.detacher', { nom: libelleNav(item) }) : t('chrome.epingler', { nom: libelleNav(item) })
            }
            title={isFavorite(item.key) ? 'Détacher des épinglés' : 'Épingler en haut'}
            onClick={(event) => {
              // La ligne est un lien : sans ça, épingler navigue.
              event.preventDefault();
              event.stopPropagation();
              toggleFavorite(item.key);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              toggleFavorite(item.key);
            }}
            className={`relative ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded transition-opacity hover:bg-surface-hover ${
              isFavorite(item.key)
                ? 'text-text-secondary opacity-100'
                : 'text-text-muted opacity-0 focus:opacity-100 group-hover:opacity-100'
            }`}
          >
            {isFavorite(item.key) ? (
              <PinOff size={12} strokeWidth={2} />
            ) : (
              <Pin size={12} strokeWidth={2} />
            )}
          </span>
        )}
        {item.key === 'sites' && isExpanded && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Voir la liste rapide des sites"
            onClick={(event) => {
              // Toggle the quick-list flyout without navigating away.
              event.preventDefault();
              event.stopPropagation();
              setIsSitesFlyoutOpen((open) => !open);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                setIsSitesFlyoutOpen((open) => !open);
              }
            }}
            className={`ml-auto -my-1 flex select-none items-center rounded px-1 py-1 text-xs text-text-muted transition-transform duration-200 hover:text-text-primary ${
              isSitesFlyoutOpen ? 'rotate-90' : ''
            }`}
          >
            ›
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile backdrop behind the drawer (< md only). */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        /*
          `initial` À LA LARGEUR RÉSOLUE : la barre ne s'ouvre pas en glissant
          à chaque chargement.

          Tant qu'elle démarrait toujours repliée, `animate` seul suffisait —
          il n'y avait rien à parcourir au montage. Depuis qu'elle démarre
          dépliée sur un grand écran, framer-motion animait la largeur de 72 à
          224 px À CHAQUE OUVERTURE DE PAGE. Deux défauts d'un coup :
          `check:mouvement` l'a signalé sur trois écrans (jusqu'à 289 px de
          déplacement malgré « réduire les animations » — `reducedMotion` ne
          couvre pas une largeur), et visuellement une navigation qui se
          déplie sous les yeux à chaque page fait bon marché.

          L'animation reste ce pour quoi elle est faite : le geste de replier
          ou de déplier, qui vient de quelqu'un.
        */
        initial={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        animate={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        transition={TRANSITION}
        className={`fixed inset-y-0 left-0 z-50 flex h-full flex-shrink-0 flex-col border-r border-border bg-[#0d0d0d] py-4 transition-transform duration-300 md:relative md:z-30 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        {/* Mobile uniquement : le rail est masqué sous `md`, cette ligne le
            remplace pour que changer d'organisation reste possible. */}
        <div className="px-3 md:hidden">
          <OrgSwitchButton onNavigate={onClose} />
        </div>

        <SpaceSwitcher
          expanded={isExpanded}
          onNavigate={() => {
            setIsSitesFlyoutOpen(false);
            setLauncherOpen(false);
            onClose?.();
          }}
        />

        {/* The nav scrolls only when the window is genuinely too short. The
            native scrollbar is hidden and replaced by a mask that fades the
            first/last rows out, so a short window looks deliberate instead of
            showing a grey gutter down the middle of the chrome. */}
        {/* Pinned strip. Fixed by choice, not by catalogue size: adding a
            module adds a tile to the launcher, never a row here. */}
        <nav ref={barre} className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {/*
            LES DEUX ESPACES SONT GROUPÉS — ET LE POSTE DE TRAVAIL A ÉTÉ LE
            DERNIER À L'ÊTRE.

            Il montrait une bande d'épinglés : cinq écrans choisis, le reste
            dans le lanceur. L'intention se défendait, mais elle ne survit pas à
            l'usage — on épingle, on épingle encore, et la bande finit par
            porter les dix-huit modules dans l'ordre du catalogue, sans un
            intitulé. C'est exactement ce qu'Aaron avait sous les yeux : une
            longue liste plate, pendant que sa cliente, elle, avait ses cinq
            groupes.

            Trois surfaces montraient déjà des sections — la Tour de contrôle
            ici même, la barre de l'édition Business, et le contexte de support
            qui reflète celle d'une cliente. Celle-ci était la quatrième, et la
            seule à ne pas suivre.

            Le catalogue déclarait pourtant ses six groupes depuis le début
            (`modules.internal.ts` : Pilotage, Clients & revenus, Production,
            Collectif, Livrables, Système). Rien à inventer : il suffisait de
            les lire.
          */}
          {/*
            LES ÉPINGLÉS, AU-DESSUS DES SECTIONS

            Un RACCOURCI, pas une septième catégorie — et c'est une décision.
            Les six sections sont le rangement ; les épingles sont un chemin
            court vers ce qu'on ouvre tous les jours. Deux conséquences
            assumées :

              · un module épinglé reste AUSSI dans sa section. Le retirer
                ferait disparaître « Clients » de « Clients & revenus », et la
                première question serait « où est passé Clients ? ». Un
                raccourci qui déplace la chose au lieu d'y mener n'est pas un
                raccourci ;
              · la bande n'a pas d'intitulé en majuscules et se ferme sur un
                filet, pour qu'elle se lise comme une avance sur la liste et
                non comme un groupe de plus.

            Les mêmes épingles nourrissent la barre du pouce sur téléphone
            (MobileBottomNav) : une seule notion, deux surfaces.
          */}
          {isExpanded && epingles.length > 0 && (
            <div className="flex flex-col gap-1 border-b border-border pb-2">
              {epingles.map((item) => renderNavItem(item))}
            </div>
          )}

          {sectionsForSpace(space).map((section) => (
            <div key={section.key} className="flex flex-col gap-1">
              {isExpanded ? (
                <p className="eyebrow px-3 pb-1 pt-1">{libelleSection(section.label)}</p>
              ) : (
                // Barre repliée : l'intitulé ne tiendrait pas dans 72 px, le
                // filet garde la coupure sans prétendre la nommer.
                <span className="mx-auto my-1.5 h-px w-6 bg-border" aria-hidden />
              )}
              {section.items.map((item) => renderNavItem(item, !dansLaBande.has(item.key)))}
            </div>
          ))}

          {/*
            Plus de bouton « Tous les modules » ici, dans aucun des deux
            espaces : il ouvrirait la liste qu'on est en train de regarder. Le
            lanceur reste monté dans `AppLayout` pour la barre du pouce, où il
            garde son utilité propre — choisir les épingles qui la nourrissent
            sur téléphone.
          */}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-border px-3 pt-2">
          <button
            type="button"
            onClick={logout}
            title={!isExpanded ? t('chrome.deconnexion') : undefined}
            aria-label={t('chrome.deconnexion')}
            className={`flex min-h-11 items-center gap-3 rounded-lg py-2 text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary md:min-h-0 ${
              isExpanded ? 'px-3' : 'justify-center px-0'
            }`}
          >
            <LogOut size={20} strokeWidth={1.75} />
            {isExpanded && (
              <span className="select-none whitespace-nowrap">{t('chrome.deconnexion')}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setIsExpanded((v) => {
                /*
                  Le geste est un CHOIX, et il se retient. Sans ça, replier la
                  barre sur un grand écran ne durerait que jusqu'au prochain
                  rechargement — un réglage qu'on doit refaire n'en est pas un.
                */
                try {
                  window.localStorage.setItem(CLE_CHOIX, String(!v));
                } catch {
                  /* stockage refusé : le choix ne vaut que pour cette session */
                }
                return !v;
              })
            }
            className={`hidden items-center gap-3 rounded-lg py-2 text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary md:flex ${
              isExpanded ? 'px-3' : 'justify-center px-0'
            }`}
            aria-label={isExpanded ? t('chrome.replierBarre') : t('chrome.deplierBarre')}
          >
            {isExpanded ? (
              <ChevronsLeft size={20} strokeWidth={1.75} />
            ) : (
              <ChevronsRight size={20} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </motion.aside>

      <AppLauncher open={isLauncherOpen} onClose={() => setLauncherOpen(false)} space={space} />

      <AnimatePresence>
        {isSitesFlyoutOpen && (
          <React.Fragment>
            <motion.div
              key="sites-flyout-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-20"
              onClick={() => setIsSitesFlyoutOpen(false)}
            />
            <motion.div
              key="sites-flyout"
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -16, opacity: 0 }}
              transition={TRANSITION}
              className="fixed top-0 z-30 h-full w-64 border-r border-border bg-surface py-4 elev-2"
              style={{ left: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
            >
              <p className="px-4 pb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Sites surveillés
              </p>
              <div className="flex flex-col gap-0.5 px-2">
                {sites.length === 0 ? (
                  <div className="px-3 py-4">
                    <p className="text-sm text-text-muted">Aucun site enregistré pour l’instant.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSitesFlyoutOpen(false);
                        navigate('/sites');
                      }}
                      className="mt-3 w-full bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
                    >
                      Ouvrir le registre des sites
                    </button>
                  </div>
                ) : (
                  sites.map((site) => (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => {
                        setIsSitesFlyoutOpen(false);
                        if (location.pathname !== '/sites') navigate('/sites');
                        openSite(site.id);
                      }}
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
                    >
                      <span className="truncate">{site.name}</span>
                      <StatusBadge status={site.status} />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Le sélecteur d'espace, en tête de la colonne.
 *
 * Il occupe la place qu'occupait le logo AMN — lequel n'y avait plus sa place :
 * le rail, à gauche, dit déjà chez qui on est. Cette ligne-ci répond à l'autre
 * question, celle qui change tout le contenu de la colonne : dans quel espace
 * de travail suis-je ?
 *
 * Replié (barre étroite), il ne montre que l'icône de l'espace et bascule
 * directement sur l'autre au clic : à deux espaces, un menu déroulant pour
 * choisir entre deux entrées est une cérémonie inutile.
 */
function SpaceSwitcher({
  expanded,
  onNavigate,
}: {
  expanded: boolean;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const current = spaceByKey(spaceForPath(location.pathname));
  const CurrentIcon = current.icon;
  const { t } = useLangue();
  const courant = libelleEspace(current);
  const { org } = useAuth();
  const orgName = org?.name ?? 'AMN DevSec';

  const go = (home: string) => {
    setOpen(false);
    onNavigate();
    navigate(home);
  };

  return (
    <div className="relative mb-2 px-3">
      <button
        type="button"
        onClick={() => {
          if (expanded) {
            setOpen((v) => !v);
            return;
          }
          const other = SPACES.find((s) => s.key !== current.key);
          if (other) go(other.home);
        }}
        aria-haspopup={expanded ? 'menu' : undefined}
        aria-expanded={expanded ? open : undefined}
        title={expanded ? undefined : t('chrome.changerEspace', { espace: courant.label })}
        className={`group flex h-11 w-full items-center gap-2.5 rounded-xl border border-border bg-surface transition-colors duration-200 hover:border-border-strong ${
          expanded ? 'px-3' : 'justify-center px-0'
        }`}
      >
        <span className="flex-shrink-0 text-text-primary transition-transform duration-200 group-hover:scale-105">
          <CurrentIcon size={18} strokeWidth={1.75} />
        </span>
        {expanded && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-semibold leading-tight text-text-primary">
                {courant.label}
              </span>
              {/* L'organisation RÉELLE, pas une chaîne en dur.
                  Elle l'était : en contexte client, ce sous-titre affichait
                  « AMN DevSec » pendant qu'on travaillait dans le dossier
                  d'une cliente — exactement l'erreur que toute la mécanique de
                  contexte existe pour empêcher.
                  Masqué sous `md` : le sélecteur d'organisation, juste
                  au-dessus dans le tiroir mobile, dit déjà la même chose, et
                  le voir deux fois à 60 px d'intervalle donne l'impression
                  d'un montage bricolé. */}
              <span className="hidden truncate font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted md:block">
                {orgName}
              </span>
            </span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={`flex-shrink-0 text-text-muted transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && expanded && (
          <React.Fragment key="space-menu">
            <motion.div
              key="space-menu-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40"
            />
            <motion.div
              key="space-menu-panel"
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.99 }}
              transition={TRANSITION}
              className="elev-2 absolute left-3 right-3 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-surface"
            >
              {SPACES.map((space) => {
                const Icon = space.icon;
                const active = space.key === current.key;
                const libelles = libelleEspace(space);
                return (
                  <button
                    key={space.key}
                    type="button"
                    role="menuitem"
                    onClick={() => go(space.home)}
                    className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      active ? 'bg-accent-muted' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <span className="mt-0.5 flex-shrink-0 text-text-primary">
                      <Icon size={16} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-text-primary">
                        {libelles.label}
                      </span>
                      <span className="block text-[11px] leading-snug text-text-muted">
                        {libelles.hint}
                      </span>
                    </span>
                    {active && (
                      <Check size={14} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-text-secondary" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </div>
  );
}
