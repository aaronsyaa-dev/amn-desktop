import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight, LogOut, Minus, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useActivity } from '../state/ActivityContext';
import { Logo, LogoMark } from '../components/Logo';
import { sectionsForSpace } from '../data/spaces';
import { useNavFavorites } from '../state/useNavFavorites';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import { useLangue, libelleNav, libelleSection } from '../i18n';
import { useNavAlleges } from '../state/useNavAlleges';
import { UserAvatar } from '../components/UserAvatar';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 236;
const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };
/** Les familles dépliées par la personne. Par machine : c'est un pli, pas un droit. */
const OUVERTES_KEY = 'amn.nav.familles-ouvertes';

/**
 * Barre latérale de l'édition Business — DEUX NIVEAUX (système de design, 1e).
 *
 * C'est un fichier séparé de `Sidebar.tsx` plutôt qu'une barre commune truffée
 * de conditions : la version interne importe `RemoteSitesContext` et
 * `SitePanelContext`, et il suffirait de l'importer pour que tout le parc
 * revienne dans le bundle livré à une cliente.
 *
 * ## Pourquoi deux niveaux, après avoir tout déplié
 *
 * L'état précédent montrait les huit familles dépliées en permanence : soixante
 * lignes d'affilée dans une colonne de 224 px. C'était le correctif d'un défaut
 * réel — la liste plate d'avant — mais il a produit l'excès inverse : une
 * colonne qu'on parcourt au lieu de la lire.
 *
 * Le système de design tranche autrement, et c'est ce que cette version
 * applique : LES ÉPINGLÉS EN CLAIR, LE RESTE REPLIÉ. Ce qu'on ouvre dix fois
 * par jour tient en haut, en pleine ligne ; les huit familles restent à un clic
 * en dessous, avec leur compte. On ne balaie plus soixante-huit entrées pour en
 * retrouver cinq.
 *
 * Rien n'est redéclaré ici : les groupes viennent de `sectionsForSpace`, les
 * épingles de `useNavFavorites`, exactement comme le lanceur et la barre du
 * pouce — deux listes de modules finissent toujours par diverger, et c'est ce
 * que `scripts/check-modules.mjs` attrape.
 *
 * ## L'ambre, une fois
 *
 * Le seul ambre de cette barre est le MARQUEUR DE L'ÉCRAN COURANT : un filet de
 * 3 px au bord gauche de la ligne active. Les compteurs de nouveautés restent en
 * encre sourdine — un compteur n'appelle pas une décision, il informe. C'est la
 * règle « un seul objet ambre par écran », tenue ici sur la seule surface qui
 * accompagne les soixante-huit modules.
 */
export function BusinessSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  // Les modules allégés par la personne : s'abonner, pour que la barre suive le geste sans rechargement.
  useNavAlleges();
  /*
    Le tiroir de navigation sur téléphone. Il couvre l'écran entier, et son
    fond ne se referme qu'au doigt — Échap est le seul recours au clavier,
    y compris sur un poste où la fenêtre est étroite.
  */
  useFermetureEchap(mobileOpen, () => onClose?.());
  const { t } = useLangue();

  const [isExpandedDesktop, setIsExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, org } = useAuth();
  const { unseen } = useActivity();
  const { favorites } = useNavFavorites();

  const isExpanded = isExpandedDesktop || mobileOpen;

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  const sections = sectionsForSpace('workspace');

  /*
    Les épinglés, dans l'ordre où la personne les a posés — et jamais un module
    qu'elle a allégé ou que son organisation n'a pas : on repart du catalogue
    filtré, pas de la liste d'épingles, qui n'est qu'un ordre.
  */
  const parCle = useMemo(() => {
    const map = new Map<string, (typeof sections)[number]['items'][number]>();
    for (const section of sections) for (const item of section.items) map.set(item.key, item);
    return map;
  }, [sections]);
  const epingles = useMemo(
    () => favorites.map((k) => parCle.get(k)).filter((i): i is NonNullable<typeof i> => Boolean(i)),
    [favorites, parCle],
  );
  const epinglesKeys = useMemo(() => new Set(epingles.map((i) => i.key)), [epingles]);
  const total = useMemo(() => sections.reduce((n, s) => n + s.items.length, 0), [sections]);

  /*
    Quelle famille est ouverte. Au premier lancement : celle de l'écran courant,
    parce qu'arriver sur une barre entièrement repliée ne dit pas où l'on est.
  */
  const familleCourante = useMemo(
    () => sections.find((s) => s.items.some((i) => isActive(i.to)))?.key ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.pathname, sections.length],
  );
  const [ouvertes, setOuvertes] = useState<string[]>(() => {
    try {
      const brut = window.localStorage.getItem(OUVERTES_KEY);
      if (brut) return JSON.parse(brut) as string[];
    } catch {
      /* mode privé : on retombe sur la famille courante */
    }
    return [];
  });
  const basculer = (key: string) => {
    setOuvertes((prev) => {
      const suivant = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        window.localStorage.setItem(OUVERTES_KEY, JSON.stringify(suivant));
      } catch {
        /* ignore quota */
      }
      return suivant;
    });
  };
  const estOuverte = (key: string) => ouvertes.includes(key) || (ouvertes.length === 0 && key === familleCourante);

  const touchStartX = useRef<number | null>(null);

  /*
    RAMENER LA LIGNE COURANTE DANS LA VUE — même règle que la barre interne,
    et pour la même raison : sur une fenêtre courte, l'écran où l'on vient
    d'arriver peut être défilé hors du cadre, et la barre ne dit alors plus
    rien. `nearest` : une ligne déjà visible ne fait rien bouger.
  */
  const barre = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const l = barre.current?.querySelector('a[aria-current="page"]');
    if (l && l.getBoundingClientRect().height > 0) l.scrollIntoView({ block: 'nearest' });
  }, [location.pathname]);
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

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  /** Une ligne de module, pleine largeur — le premier niveau. */
  const Ligne = ({ item, indent = false }: { item: (typeof sections)[number]['items'][number]; indent?: boolean }) => {
    const Icon = item.icon;
    const active = isActive(item.to);
    const nouveautes = unseen[item.to] ?? 0;
    return (
      <Link
        to={item.to}
        onClick={onClose}
        title={!isExpanded ? libelleNav(item) : undefined}
        aria-label={libelleNav(item)}
        // Ce qui dit à un lecteur d'écran laquelle des entrées est l'écran
        // courant — et ce que le défilement ci-dessus vise.
        aria-current={active ? 'page' : undefined}
        className={`group relative flex min-h-11 items-center gap-2.5 py-1.5 text-[13.5px] transition-colors md:min-h-0 ${
          isExpanded ? (indent ? 'pl-9 pr-2.5' : 'px-2.5') : 'justify-center px-0'
        } ${active ? 'bg-[#191919] text-text-primary' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
      >
        {/*
          LE MARQUEUR AMBRE — le seul de cette barre. Un filet de 3 px au bord
          gauche de la ligne courante : il ne colore pas la ligne, il la pointe.
        */}
        {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-signal" aria-hidden />}
        {!indent && (
          <span
            className={`icon-token ${
              active ? 'border-border-raised bg-[#1c1c1c] text-text-primary' : 'text-text-muted group-hover:text-text-primary'
            }`}
          >
            <Icon size={14} strokeWidth={2.1} />
          </span>
        )}
        {isExpanded && <span className={`truncate ${active ? 'font-medium' : ''}`}>{libelleNav(item)}</span>}
        {isExpanded && nouveautes > 0 && (
          /* Un compteur informe, il ne décide pas : il reste en encre sourdine. */
          <span className="tnum ml-auto font-mono text-[10.5px] text-text-muted">{nouveautes}</span>
        )}
        {!isExpanded && nouveautes > 0 && (
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Voile du tiroir mobile. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[2px] md:hidden"
            aria-hidden
          />
        )}
      </AnimatePresence>

      <motion.aside
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        initial={false}
        animate={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        transition={TRANSITION}
        className={`fixed inset-y-0 left-0 z-[91] flex h-full flex-col border-r border-[#1c1c1c] bg-[#0c0c0c] transition-transform md:relative md:z-auto md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[#1c1c1c] px-3.5">
          {isExpanded ? <Logo height={20} /> : <LogoMark size={20} />}
        </div>

        <nav ref={barre} className="sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3">
          {/* ── Premier niveau : les épinglés, en clair ───────────────────── */}
          {epingles.length > 0 && (
            <div className="flex flex-col">
              {isExpanded && <p className="eyebrow px-2.5 pb-2">{t('chrome.epingles')}</p>}
              {epingles.map((item) => (
                <Ligne key={item.key} item={item} />
              ))}
            </div>
          )}

          {/* ── Second niveau : les familles, repliées ────────────────────── */}
          <div className={`flex flex-col ${epingles.length > 0 ? 'mt-4 border-t border-[#1c1c1c] pt-3' : ''}`}>
            {isExpanded && (
              <p className="eyebrow flex items-baseline justify-between px-2.5 pb-2">
                <span>{t('chrome.tout')}</span>
                <span className="tnum">{total}</span>
              </p>
            )}
            {sections.map((section) => {
              // Un épinglé reste dans sa famille : le retirer ferait mentir le
              // compte, et chercher un module là où il est rangé est légitime.
              const ouverte = estOuverte(section.key);
              const contientCourant = section.items.some((i) => isActive(i.to));
              if (!isExpanded) {
                // Barre repliée : 72 px ne tiennent pas un intitulé de famille.
                // On montre les entrées non épinglées en jetons, séparées par un
                // filet — un texte tronqué à trois lettres serait pire que rien.
                return (
                  <div key={section.key} className="flex flex-col">
                    <span className="mx-auto my-1.5 h-px w-6 bg-[#1c1c1c]" aria-hidden />
                    {section.items
                      .filter((i) => !epinglesKeys.has(i.key))
                      .map((item) => (
                        <Ligne key={item.key} item={item} />
                      ))}
                  </div>
                );
              }
              return (
                <div key={section.key} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => basculer(section.key)}
                    aria-expanded={ouverte}
                    className={`flex min-h-11 items-center gap-2 px-2.5 py-1.5 text-left text-[13.5px] transition-colors md:min-h-0 ${
                      contientCourant ? 'bg-[#121212] text-text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <span className="flex h-3 w-3 flex-shrink-0 items-center justify-center text-text-muted">
                      {ouverte ? <Minus size={11} strokeWidth={2.1} /> : <Plus size={11} strokeWidth={2.1} />}
                    </span>
                    <span className="truncate">{libelleSection(section.label)}</span>
                    <span className="tnum ml-auto font-mono text-[10.5px] text-text-muted">
                      {section.items.length}
                    </span>
                  </button>
                  {ouverte && (
                    <div className="flex flex-col pb-1">
                      {section.items.map((item) => (
                        <Ligne key={item.key} item={item} indent />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* ── Le pied de compte — qui est connecté, et où ─────────────────── */}
        <div className="flex flex-col border-t border-[#1c1c1c]">
          {isExpanded && user && (
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <UserAvatar email={user.email} size={28} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] text-text-primary">{user.email}</span>
                {org?.name && (
                  <span className="block truncate font-mono text-[10px] text-text-muted">{org.name}</span>
                )}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-0.5 p-2">
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              aria-label={isExpandedDesktop ? t('chrome.replierBarre') : t('chrome.deplierBarre')}
              className="hidden items-center gap-2.5 px-2.5 py-2 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary md:flex"
            >
              {isExpandedDesktop ? (
                <ChevronsLeft size={16} strokeWidth={2.1} />
              ) : (
                <ChevronsRight size={16} strokeWidth={2.1} />
              )}
              {isExpanded && <span>{t('chrome.replier')}</span>}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              /*
                Le libellé disparaît quand la barre est repliée — il ne reste
                qu'une icône, sans nom pour un lecteur d'écran ni au survol. Les
                liens de navigation juste au-dessus portent déjà les deux ; ce
                bouton-ci était le seul oublié, et c'est le plus conséquent :
                on ne se déconnecte pas par erreur.
              */
              aria-label={t('chrome.seDeconnecter')}
              title={!isExpanded ? t('chrome.seDeconnecter') : undefined}
              className="flex min-h-11 items-center gap-2.5 px-2.5 py-2 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-danger md:min-h-0"
            >
              <LogOut size={16} strokeWidth={2.1} />
              {isExpanded && <span>{t('chrome.seDeconnecter')}</span>}
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
