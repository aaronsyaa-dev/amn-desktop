import React, { useEffect, useMemo, useState } from 'react';
import { useAccueil } from '../accueils/useAccueil';
import { avecAccueilEnTete } from '../accueils/epingle';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight, ListTree, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useActivity } from '../state/ActivityContext';
import { useNavFavorites } from '../state/useNavFavorites';
import { StatusBadge } from './StatusBadge';
import { useSitePanel } from './site-panel/SitePanelContext';
import { useLangue, libelleNav, libelleSection } from '../i18n';
import { OrgSwitchButton } from './org-rail/OrgSwitchButton';
import { type NavItem } from '../data/navigation';
import { toutesLesSections } from '../data/spaces';
import { EDITION_PRODUCT_NAME } from '../edition/edition';
import { CLE_CHOIX, EVENEMENT_INDEX, deplierAuDemarrage, ecrireIndexFamilles, lireChoix, lireIndexFamilles } from '../lib/barreLaterale';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import { useNavAlleges } from '../state/useNavAlleges';
import { useCommandPalette } from './command-palette/CommandPalette';
import { BarreRail, LARGEUR_COQUILLE, LARGEUR_RAIL, type FamilleRail } from './rail/BarreRail';
import { cheminLePlusPrecis } from '../lib/cheminCourant';

/* La phrase de chaque famille de supervision, sous son nom dans la bulle du rail. Interne : ce fichier n'entre pas dans le paquet cliente. */
const PHRASE_SUPERVISION: Record<string, string> = {
  LG: 'Déléguer : les équipes qui veillent côté serveur, leurs bureaux, ce qui attend votre avis.',
  SU: 'Décider : toutes les clientes, leurs dossiers, et l’équipe qui les suit.',
  PA: 'Surveiller : incidents, sites, trackers, maturité, alertes, qui est entré chez qui.',
  PD: 'Les produits de Cyber : Scanner, Comply, SSL Monitor.',
};

/**
 * La navigation de l'édition interne — LE RAIL (Direction B).
 *
 * ## Ce que ce fichier a cessé d'être
 *
 * Il dessinait sa propre colonne : sélecteur d'espace, bande d'épingles,
 * sections dépliées, marqueur ambre, deux largeurs. Huit cents lignes, pour une
 * pièce que `BusinessSidebar.tsx` et `client-context/ClientSidebar.tsx`
 * dessinaient CHACUN de leur côté, autrement. La géométrie vit désormais dans
 * `components/rail/BarreRail.tsx`, une seule fois pour les trois.
 *
 * Ce fichier garde ce qui lui est propre, et rien d'autre : le catalogue
 * interne, la liste rapide des sites, la palette de commandes, le compte.
 *
 * ## LE SÉLECTEUR D'ESPACE A DISPARU, ET C'EST LE RAIL QUI LE REMPLACE
 *
 * C'est l'arbitrage de cette refonte, et il mérite d'être écrit.
 *
 * Les trois espaces (Poste de travail, Tour de contrôle, La Garde) existaient
 * pour une raison réelle : à trente-trois entrées dans une liste plate, l'œil
 * ne reconnaît plus de forme, et le travail quotidien n'a rien à voir avec la
 * supervision du parc. Le sélecteur était le remède — mais un remède qui CACHE
 * deux tiers du produit derrière un menu. « L'étouffoir est introuvable » vient
 * de là.
 *
 * Le rail résout le même problème sans rien cacher : les douze familles des
 * trois espaces sont douze tuiles permanentes, et une seule est ouverte à la
 * fois. On voit tout le produit et on n'en lit qu'un douzième. Un menu qui
 * choisit entre trois listes n'a plus d'objet quand les trois sont à l'écran.
 *
 * La NOTION d'espace, elle, reste entière : `spaceForPath` continue de déduire
 * l'espace du chemin pour le lanceur, la barre du pouce et la mémoire
 * d'onglet. Ce qui disparaît est le sélecteur, pas le rangement.
 *
 * ## L'ambre a quitté la colonne
 *
 * Le filet de 3 px sur la ligne courante était `bg-signal`. Il ne l'est plus.
 * L'ambre marque ce qui demande une décision, un par écran ; une colonne qui en
 * porte un en permanence le consomme sur les 94 écrans à la fois. Et
 * `check:signal` ne pouvait pas le voir — il ne regarde que `<main>`. C'est
 * `check:coquille` qui tient désormais la règle dans la colonne.
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
  // Les modules allégés par la personne : s'abonner, pour que la barre suive le geste sans rechargement.
  const { alleges } = useNavAlleges();
  const { t } = useLangue();
  useFermetureEchap(mobileOpen, () => onClose?.());

  const [deplie, setDeplie] = useState(() => {
    if (typeof window === 'undefined') return false;
    let choix: boolean | null = null;
    try {
      choix = lireChoix(window.localStorage.getItem(CLE_CHOIX));
    } catch {
      /* stockage refusé (navigation privée) : la largeur décidera */
    }
    return deplierAuDemarrage(window.innerWidth, choix);
  });
  const [voletSites, setVoletSites] = useState(false);
  useFermetureEchap(voletSites, () => setVoletSites(false));

  const location = useLocation();
  const navigate = useNavigate();
  const { logout, org } = useAuth();
  const { openSite } = useSitePanel();
  const { sites } = useRemoteSites();
  const { unseen } = useActivity();
  const { favorites, isFavorite, toggleFavorite } = useNavFavorites();
  const { open: ouvrirPalette } = useCommandPalette();

  /*
    LES DOUZE FAMILLES, TOUS ESPACES CONFONDUS.

    `toutesLesSections()` et non `sectionsForSpace`, qui filtre par espace : le
    rail les montre toutes. Les deux filtres qui comptent restent appliqués là
    où ils vivent (`data/spaces.ts`) — un module fermé pour l'organisation ou
    allégé par la personne n'apparaît pas, et une famille vidée de tous les
    siens disparaît au lieu de laisser une tuile qui n'ouvre rien.
  */
  const familles: FamilleRail[] = useMemo(
    () => {
      /*
        LA SUPERVISION D'ABORD, ET À PART. Les quatre familles qui ne sont pas
        le quotidien d'un poste (la Garde, la Tour, le Parc, les Produits)
        viennent en tête du rail, marquées `supervision` : le rail les groupe
        et les sépare d'un filet, le panneau mobile les titre. Avant, elles
        étaient quatre tuiles grises parmi dix-sept, et Mohamed comme Riyad ne
        voyaient pas où commençait « ce qu'AMN Business fait pour ses clientes ».
      */
      const toutes = toutesLesSections().map((section) => ({
        key: section.key,
        label: libelleSection(section.label),
        code: section.code,
        items: section.items,
        supervision: section.space !== undefined && section.space !== 'workspace',
        hint: PHRASE_SUPERVISION[section.code],
      }));
      return [...toutes.filter((f) => f.supervision), ...toutes.filter((f) => !f.supervision)];
    },
    /*
      `location.pathname` en dépendance, bien qu'ESLint le croie inutile :
      `isModuleEnabled` et `isModuleAllege` lisent un registre de module, pas
      un état React. Ils changent sous nos pieds (bascule d'organisation,
      geste d'allègement), et rien dans ce `useMemo` ne le signalerait. Le
      chemin est ce qui bouge à coup sûr quand ces deux-là ont bougé.
    */
    /*
      … et la liste des modules allégés : sans elle, alléger « Tâches » depuis
      la Bibliothèque estompait la tuile mais laissait la ligne dans la barre
      et dans les épinglés jusqu'au prochain changement d'écran.
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.pathname, alleges],
  );

  const tousLesModules = useMemo(() => familles.flatMap((f) => f.items), [familles]);
  const cheminCourant = useMemo(
    () => cheminLePlusPrecis(location.pathname, tousLesModules),
    [location.pathname, tousLesModules],
  );

  /*
    Les épinglés, dans l'ordre du CATALOGUE et non d'épinglage : la barre doit
    se relire pareil d'un jour à l'autre, pas se réorganiser selon l'ordre où
    l'on a cliqué. Plus de filtre par espace — il n'y a plus d'espace courant
    dans cette colonne.
  */
  const { courant: accueil } = useAccueil();
  const epingles = useMemo(
    () =>
      avecAccueilEnTete(
        tousLesModules.filter((i) => favorites.includes(i.key)),
        tousLesModules.find((i) => i.key === 'home'),
        accueil.nom,
      ),
    [tousLesModules, favorites, accueil.nom],
  );

  const basculer = () => {
    setDeplie((v) => {
      try {
        window.localStorage.setItem(CLE_CHOIX, String(!v));
      } catch {
        /* stockage refusé : le choix ne vaut que pour cette session */
      }
      return !v;
    });
  };

  const expanded = deplie || mobileOpen;

  /* L'index des familles : le choix du poste, et la bascule depuis le profil de départ. */
  const [indexFamilles, setIndexFamilles] = useState(lireIndexFamilles);
  useEffect(() => {
    const relire = () => setIndexFamilles(lireIndexFamilles());
    window.addEventListener(EVENEMENT_INDEX, relire);
    return () => window.removeEventListener(EVENEMENT_INDEX, relire);
  }, []);

  /*
    LA LISTE RAPIDE DES SITES — le seul ornement propre à cette édition.

    Un chevron sur la ligne « Sites », qui ouvre le volet sans naviguer.
    `<span role="button">` et non `<button>` : la ligne EST un lien, et un
    bouton imbriqué dans un lien n'est pas du HTML valide.
  */
  const rendreExtra = (item: NavItem) =>
    item.key === 'sites' && expanded ? (
      <span
        role="button"
        tabIndex={0}
        aria-label="Voir la liste rapide des sites"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setVoletSites((o) => !o);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
          setVoletSites((o) => !o);
        }}
        className={`relative flex-none select-none px-1 text-xs text-text-muted transition-transform duration-200 hover:text-text-primary ${
          voletSites ? 'rotate-90' : ''
        }`}
      >
        ›
      </span>
    ) : null;

  return (
    <>
      <BarreRail
        familles={familles}
        indexFamilles={indexFamilles}
        epingles={epingles}
        cheminCourant={cheminCourant}
        compteurs={unseen}
        deplie={deplie}
        mobileOpen={mobileOpen}
        onClose={onClose}
        onNavigate={() => {
          setVoletSites(false);
          onClose?.();
        }}
        libelle={libelleNav}
        estEpingle={isFavorite}
        onEpingler={toggleFavorite}
        rendreExtra={rendreExtra}
        /*
          ⌘K ouvre la palette de commandes, qui cherche les modules MAIS AUSSI
          les sites, les notes et les ordres de la Garde. C'est un surensemble
          du champ de la coquille, et c'est le geste déjà appris ici.
        */
        ouvrirRecherche={ouvrirPalette}
        enTete={
          <div className="flex-none border-b border-[#1c1c1c]">
            {/* Mobile uniquement : le rail d'organisations est masqué sous `md`. */}
            <div className="px-3 pt-3 md:hidden">
              <OrgSwitchButton onNavigate={onClose} />
            </div>
            <div className="flex h-14 items-center gap-2.5 px-3.5">
              <span className="flex h-[23px] w-[23px] flex-none items-center justify-center border border-border-section bg-[#1d1d1d] font-mono text-[10.5px] font-bold text-text-primary">
                A
              </span>
              {expanded && (
                <span className="min-w-0 flex-1 leading-tight">
                  {/* Le nom de l'édition vient du jeton, jamais d'une chaîne
                      figée : le renommage du Bloc 1 a déjà échangé les deux
                      noms une fois. */}
                  <span className="block truncate text-[12.5px] font-semibold text-text-primary">
                    {EDITION_PRODUCT_NAME}
                  </span>
                  {/* L'organisation RÉELLE, jamais une chaîne en dur : en
                      contexte client, ce sous-titre a déjà affiché « AMN
                      DevSec » pendant qu'on travaillait chez une cliente. */}
                  <span className="block truncate font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
                    {org?.name ?? 'AMN DevSec'}
                  </span>
                </span>
              )}
            </div>
          </div>
        }
        pied={
          <div className="flex flex-none flex-col gap-0.5 border-t border-[#1c1c1c] bg-[#0a0a0a] p-2">
            {expanded && (
              <button
                type="button"
                onClick={() => ecrireIndexFamilles(!indexFamilles)}
                aria-pressed={indexFamilles}
                title={t('chrome.indexFamillesAide')}
                className={`hidden items-center gap-2.5 px-2.5 py-2 text-[13px] transition-colors hover:bg-surface-hover hover:text-text-primary md:flex ${indexFamilles ? 'text-text-primary' : 'text-text-muted'}`}
              >
                <ListTree size={16} strokeWidth={2.1} />
                <span>{t('chrome.indexFamilles')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={basculer}
              aria-label={deplie ? t('chrome.replierBarre') : t('chrome.deplierBarre')}
              className="hidden items-center gap-2.5 px-2.5 py-2 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary md:flex"
            >
              {deplie ? (
                <ChevronsLeft size={16} strokeWidth={2.1} />
              ) : (
                <ChevronsRight size={16} strokeWidth={2.1} />
              )}
              {expanded && <span>{t('chrome.replier')}</span>}
            </button>
            <button
              type="button"
              onClick={logout}
              title={!expanded ? t('chrome.deconnexion') : undefined}
              aria-label={t('chrome.deconnexion')}
              className="flex min-h-11 items-center gap-2.5 px-2.5 py-2 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-danger md:min-h-0"
            >
              <LogOut size={16} strokeWidth={2.1} />
              {expanded && <span>{t('chrome.deconnexion')}</span>}
            </button>
          </div>
        }
      />

      <AnimatePresence>
        {voletSites && (
          <React.Fragment>
            <motion.div
              key="sites-flyout-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-20"
              onClick={() => setVoletSites(false)}
            />
            <motion.div
              key="sites-flyout"
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -16, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="elev-2 fixed top-0 z-30 h-full w-64 border-r border-border bg-surface py-4"
              style={{ left: expanded ? LARGEUR_COQUILLE : LARGEUR_RAIL + 1 }}
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
                        setVoletSites(false);
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
                        setVoletSites(false);
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
