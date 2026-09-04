import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Menu } from 'lucide-react';
import { ClientSidebar, CLIENT_NAV_ITEMS } from './ClientSidebar';
import { ClientBanner, CLIENT_BANNER_HEIGHT } from './ClientBanner';
import { OrgRail } from '../components/org-rail/OrgRail';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { isModuleEnabled, isModuleLocked } from '../data/spaces';
import { useOrgContext } from '../state/OrgContextContext';
import { ClientViewProvider } from '../state/ClientViewContext';
import { SpaceProviders } from '../state/SpaceProviders';
import { BootHealthy } from '../components/BootHealthy';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { variantsForPath } from '../lib/transitions';
import { StatusRail } from '../components/StatusRail';
import { SupportNotifier } from '../components/SupportNotifier';
import { useLangue } from '../i18n';

/**
 * La coquille d'un contexte client.
 *
 * Elle reprend la structure de `BusinessLayout` — la même que la cliente a sous
 * les yeux — avec trois différences, toutes voulues :
 *
 *   1. le rail reste à gauche : c'est par lui qu'on est entré, c'est par lui
 *      qu'on ressort, et il rappelle en permanence qu'on est un visiteur ;
 *   2. le bandeau permanent occupe le haut de l'écran, et la mise en page lui
 *      réserve sa hauteur au lieu de passer dessous ;
 *   3. la synchronisation est montée avec la PORTÉE de l'organisation cliente
 *      (`scope`), donc son miroir local est distinct du nôtre. Sans ça, ses
 *      données et les nôtres se mélangeraient dans le même cache — la fuite
 *      exacte que ce contexte doit rendre impossible.
 *
 * Ce qui n'y est pas n'y est pas non plus dans l'application de la cliente :
 * ni assistant, ni appels, ni parc de sites, ni centre de notifications de
 * supervision. L'intérêt de cet écran est de montrer SON application ; y
 * ajouter nos outils en ferait un troisième produit, que personne n'utilise.
 */
export function ClientContextLayout() {
  /*
    LE VERROU DE CONSENTEMENT, à l'écran (Bloc 4). La cliente a fermé ce
    module à son prestataire : l'entrée n'est pas dans sa barre, et ouvrir
    l'adresse directement montre pourquoi plutôt qu'un écran vide.
  */
  const cheminVerrou = useLocation().pathname;
  const moduleVerrouille = CLIENT_NAV_ITEMS.some((item) => item.to !== '/' && (cheminVerrou === item.to || cheminVerrou.startsWith(`${item.to}/`)) && isModuleLocked(item.key));
  const { t } = useLangue();
  const location = useLocation();
  const { support } = useOrgContext();
  const [navOpen, setNavOpen] = React.useState(false);
  React.useEffect(() => setNavOpen(false), [location.pathname]);

  // La clé de portée remonte tout l'arbre de synchronisation quand on change
  // d'organisation : c'est ce qui garantit qu'aucun état React d'une cliente ne
  // survit à la bascule vers une autre.
  const scope = support?.orgId ?? 'unknown';

  return (
    /*
      `ClientViewProvider` bascule les écrans partagés sur leur face Business
      (voir src/state/ClientViewContext.tsx) : sans lui, la fiche client
      afficherait un bloc « sites liés » qui n'existe pas chez elle, et sa liste
      de tâches proposerait de les assigner à nos adresses @amn-devsec.com.
    */
    <ClientViewProvider>
      {/*
        La `key` remonte TOUTE la pile quand on change d'organisation : aucun
        état React d'une cliente ne survit à la bascule vers une autre.
      */}
      <SpaceProviders key={scope} scope={scope}>
              <ClientBanner />
              <div
                className="app-ground flex flex-col overflow-hidden text-text-primary"
                style={{
                  height: `calc(100dvh - ${CLIENT_BANNER_HEIGHT}px)`,
                  marginTop: CLIENT_BANNER_HEIGHT,
                  paddingBottom: 'env(safe-area-inset-bottom)',
                }}
              >
                <div className="flex min-h-0 flex-1">
                <div className="hidden md:flex">
                  <OrgRail />
                </div>
                <ClientSidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
                <main className="relative flex-1 overflow-y-auto overflow-x-hidden overscroll-none">
                  <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-8">
                    <button
                      type="button"
                      onClick={() => setNavOpen(true)}
                      aria-label={t('chrome.ouvrirMenu')}
                      className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary md:hidden"
                    >
                      <Menu size={18} strokeWidth={1.75} />
                    </button>
                    <span className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                      {support?.orgName ?? ''}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <SyncStatusIndicator />
                    </div>
                  </header>
                  <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
                    <motion.div
                      key={location.pathname}
                      variants={variantsForPath(location.pathname)}
                      initial="initial"
                      animate="animate"
                    >
                      {moduleVerrouille ? (
                      <div className="mx-auto max-w-lg py-16 text-center">
                        <Lock size={22} strokeWidth={1.5} className="mx-auto text-text-muted" />
                        <p className="mt-3 text-[15px] font-medium text-text-primary">{t('support.verrou.titre')}</p>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{t('support.verrou.texte')}</p>
                      </div>
                    ) : (
                      <Outlet />
                    )}
                    </motion.div>
                    {/*
                      LA TOUR PARLE AUSSI ICI. Aaron a envoyé une demande depuis
                      un compte cliente et ne l'a jamais vue : il regardait une
                      autre cliente, et cette coquille — celle du contexte de
                      support — ne montait pas le notificateur. Le serveur
                      livre désormais la trame où qu'il regarde (hub.tower) ;
                      encore faut-il quelqu'un pour l'entendre. Les toasts,
                      eux, viennent de la pile partagée (`SpaceProviders`, plus
                      haut) : un second fournisseur monté ici à la main est
                      exactement ce que `check:resilience` interdit — c'est
                      ainsi que les piles des coquilles ont divergé une fois.
                    */}
                    <SupportNotifier />
                  </div>
                </main>
                </div>
                {/*
                  La même barre du pouce que dans les deux autres coquilles,
                  mais nourrie du catalogue de la CLIENTE : afficher ici nos
                  modules internes ferait de ce contexte un espace hybride qui
                  n'existe chez personne, et rendrait le support faux.
                  Le dernier bouton ouvre le tiroir, qui porte la liste
                  complète — il n'y a pas de lanceur dans ce contexte.
                */}
                {/* Le bandeau nomme le contexte, et il n'y a rien de plus
                    honnête à écrire ici : on regarde SON organisation, en
                    session de support. */}
                <StatusRail orgName={support?.orgName ?? ''} context={t('rail.sessionSupport')} />
                <MobileBottomNav
                  items={CLIENT_NAV_ITEMS.filter((item) => isModuleEnabled(item.key))}
                  moreLabel="Menu"
                  onOpenLauncher={() => setNavOpen(true)}
                />
              </div>
        <BootHealthy />
      </SpaceProviders>
    </ClientViewProvider>
  );
}
