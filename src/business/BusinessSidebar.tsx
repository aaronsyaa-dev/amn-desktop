import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useActivity } from '../state/ActivityContext';
import { Logo, LogoMark } from '../components/Logo';
import { sectionsForSpace } from '../data/spaces';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 224;
const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

/**
 * Barre latérale de l'édition Business.
 *
 * C'est un fichier séparé de `Sidebar.tsx` plutôt qu'une barre commune truffée
 * de conditions : la version interne importe `RemoteSitesContext` et
 * `SitePanelContext`, et il suffirait de l'importer pour que tout le parc
 * revienne dans le bundle livré à une cliente.
 *
 * ELLE RANGE SES MODULES EN SECTIONS, ET C'EST LE CORRECTIF DE CE CHANTIER
 * ────────────────────────────────────────────────────────────────────────
 * Elle montrait jusqu'ici une bande courte d'épinglés — cinq lignes plates,
 * surmontées d'un bouton « Tous les modules » qui se lisait comme un intitulé.
 * D'où le constat, exact : côté Business, « Tous les modules » était suivi
 * d'une liste plate. Le lanceur, lui, groupait déjà correctement ; le défaut
 * n'a jamais été dans le catalogue ni dans le lanceur, mais ici, dans la
 * seule surface de navigation que la cliente a en permanence sous les yeux.
 *
 * Les groupes viennent de `sectionsForSpace('workspace')`, c'est-à-dire du
 * catalogue de l'édition construite (`@edition/modules`) : le même que celui
 * du lanceur, filtré des modules fermés à cette organisation. Rien n'est
 * redéclaré ici — deux listes de modules finissent toujours par diverger, et
 * c'est exactement ce que `scripts/check-modules.mjs` a été écrit pour
 * attraper.
 *
 * Pourquoi tout montrer plutôt que garder la bande d'épinglés : c'est le même
 * raisonnement que la Tour de contrôle côté interne. On ne « revient » pas sur
 * cinq écrans quand on tient son activité entière dans l'application — on
 * balaie. Quinze entrées d'affilée sans intitulé se relisent depuis le haut à
 * chaque fois ; cinq blocs nommés se reconnaissent d'un coup d'œil. C'est
 * aussi ce que l'opérateur voit déjà de son côté quand il ouvre l'espace d'une
 * cliente en support (`ClientSidebar`) : les deux surfaces disaient des choses
 * différentes de la même application.
 *
 * Le bouton « Tous les modules » disparaît d'ici pour la raison qui l'a fait
 * disparaître de la Tour de contrôle : il ouvrirait la liste qu'on est en
 * train de regarder. Le lanceur reste monté dans `BusinessLayout` pour la
 * barre du pouce, où il garde son utilité propre — choisir les épingles qui
 * nourrissent cette barre sur téléphone.
 */
export function BusinessSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const [isExpandedDesktop, setIsExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { unseen } = useActivity();

  const isExpanded = isExpandedDesktop || mobileOpen;

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

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

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
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
        className={`fixed inset-y-0 left-0 z-[91] flex h-full flex-col border-r border-border bg-surface transition-transform md:relative md:z-auto md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 flex-shrink-0 items-center justify-center border-b border-border px-3">
          {isExpanded ? <Logo height={22} /> : <LogoMark size={22} />}
        </div>

        <nav className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {sectionsForSpace('workspace').map((section) => (
            <div key={section.key} className="flex flex-col gap-1">
              {isExpanded ? (
                <p className="eyebrow px-3 pb-1">{section.label}</p>
              ) : (
                // Barre repliée : l'intitulé ne tiendrait pas dans 72 px. Le
                // filet garde la coupure sans prétendre la nommer — un texte
                // tronqué à trois lettres serait pire que pas de texte.
                <span className="mx-auto my-1 h-px w-6 bg-border" aria-hidden />
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    onClick={onClose}
                    title={!isExpanded ? item.label : undefined}
                    aria-label={item.label}
                    className={`relative flex min-h-11 items-center gap-3 rounded-lg py-1.5 text-sm transition-colors md:min-h-0 ${
                      isExpanded ? 'px-3' : 'justify-center px-0'
                    } ${
                      active
                        ? 'bg-accent-muted text-text-primary'
                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    <span className="flex-shrink-0">
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    {isExpanded && <span className="truncate">{item.label}</span>}
                    {(unseen[item.to] ?? 0) > 0 && (
                      <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-border p-2">
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpandedDesktop ? 'Replier la barre' : 'Déplier la barre'}
            className="hidden items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary md:flex"
          >
            {isExpandedDesktop ? (
              <ChevronsLeft size={18} strokeWidth={1.75} />
            ) : (
              <ChevronsRight size={18} strokeWidth={1.75} />
            )}
            {isExpanded && <span>Replier</span>}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-danger md:min-h-0"
          >
            <LogOut size={18} strokeWidth={1.75} />
            {isExpanded && <span>Se déconnecter</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
