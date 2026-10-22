import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, LayoutGrid, Pin, PinOff, Search } from 'lucide-react';
import type { NavItem } from '../../data/navigation';
import { LARGEUR_COQUILLE, LARGEUR_RAIL } from '../../components/rail/BarreRail';
import { useModulesOuverts } from '../../state/useModulesOuverts';
import { familleDe } from './registre';
import { composerRail, ROUTE_TOUS_LES_MODULES } from './moment';
import { useNavLangue, type CleNav } from './i18n';

/**
 * LE RAIL « DU MOMENT » — la colonne de l'édition interne, sur bureau.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Il remplace, dans l'édition interne seulement, les treize tuiles à deux
 * lettres (`PI`, `CR`…) qu'il fallait apprendre par cœur. Ici, chaque ligne
 * porte une icône et un nom en toutes lettres, teintée de la couleur de sa
 * famille (`data-famille`, jetons du socle). Repliée, la colonne garde les
 * icônes ; le nom passe dans l'infobulle et le nom accessible.
 *
 * Ce qu'il montre est décidé dans `moment.ts` : les essentiels, la Garde à
 * part, les épinglés, les récents, et trois suggestions selon l'heure. Tout le
 * reste est à un clic : « Tous les modules », et ⌘K qui cherche par intention.
 *
 * `BarreRail.tsx` n'est pas touché : il continue de servir l'édition cliente,
 * le contexte de support, et le tiroir du téléphone de l'édition interne
 * (voir `Sidebar.tsx`). Les largeurs, elles, sont les siennes : le volet des
 * sites et la barre du haut se calent dessus.
 */

export interface RailDuMomentProps {
  /** Les modules ouverts à l'organisation (fermés et allégés déjà retirés), dans l'ordre du catalogue. */
  catalogue: NavItem[];
  /** Le `to` du module courant, résolu par l'appelant (préfixe le plus long). */
  cheminCourant: string;
  /** Compteurs de nouveautés, par `to`. */
  compteurs?: Record<string, number>;
  /** Clés épinglées par la personne. */
  epingles: string[];
  estEpingle?: (cle: string) => boolean;
  onEpingler?: (cle: string) => void;
  deplie: boolean;
  ouvrirRecherche: () => void;
  libelle: (item: NavItem) => string;
  /** Un ornement propre à un module (le chevron « liste rapide des sites »). */
  rendreExtra?: (item: NavItem) => React.ReactNode;
  enTete?: React.ReactNode;
  pied?: React.ReactNode;
  onNavigate?: () => void;
}

const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

/**
 * Les récents, du plus frais au plus ancien : le journal d'ouvertures du poste
 * (`useModulesOuverts`, déjà tenu pour Découvrir), plus ce qu'on ouvre pendant
 * que la colonne est montée — le journal n'est relu qu'au montage.
 */
function useRecents(catalogue: NavItem[], cheminCourant: string): string[] {
  const journal = useModulesOuverts();
  const [ouverts, setOuverts] = useState<string[]>([]);
  useEffect(() => {
    const item = catalogue.find((i) => i.to === cheminCourant);
    if (!item) return;
    setOuverts((liste) => (liste[0] === item.key ? liste : [item.key, ...liste.filter((k) => k !== item.key)].slice(0, 20)));
  }, [catalogue, cheminCourant]);
  return useMemo(() => {
    const anciens = Object.entries(journal)
      .sort((a, b) => b[1].localeCompare(a[1]))
      .map(([cle]) => cle);
    return [...new Set([...ouverts, ...anciens])];
  }, [journal, ouverts]);
}

/** L'heure, relue chaque quart d'heure : les suggestions suivent la journée sans recharger. */
function useQuartDHeure(): Date {
  const [quand, setQuand] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setQuand(new Date()), 15 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  return quand;
}

export function RailDuMoment({
  catalogue,
  cheminCourant,
  compteurs = {},
  epingles,
  estEpingle,
  onEpingler,
  deplie,
  ouvrirRecherche,
  libelle,
  rendreExtra,
  enTete,
  pied,
  onNavigate,
}: RailDuMomentProps) {
  const { tn } = useNavLangue();
  const { pathname } = useLocation();
  const recents = useRecents(catalogue, cheminCourant);
  const quand = useQuartDHeure();
  const groupes = useMemo(
    () => composerRail({ catalogue, epingles, recents, quand }),
    [catalogue, epingles, recents, quand],
  );

  const ligne = (item: NavItem, accueil = false) => (
    <LigneDuMoment
      key={item.key}
      item={item}
      libelle={libelle(item)}
      courant={item.to === cheminCourant}
      compteur={compteurs[item.to] ?? 0}
      deplie={deplie}
      extra={deplie ? rendreExtra?.(item) : null}
      raccourci={accueil ? tn('rail.accueil.raccourci') : undefined}
      aide={accueil ? tn('rail.accueil.aide') : undefined}
      epingle={estEpingle?.(item.key) ?? false}
      onEpingler={accueil ? undefined : onEpingler}
      libelleEpingler={(nom, oui) => tn(oui ? 'rail.detacher' : 'rail.epingler', { nom })}
      onNavigate={onNavigate}
    />
  );

  const groupe = (titre: CleNav, items: NavItem[], ancre?: string) =>
    items.length === 0 ? null : (
      <div data-guide={ancre} role="group" aria-label={tn(titre)} className="flex flex-col gap-0.5">
        {deplie ? (
          <p className="eyebrow px-2 pb-1 pt-3 text-text-muted">{tn(titre)}</p>
        ) : (
          <span aria-hidden className="mx-auto my-2 h-px w-6 bg-border-strong" />
        )}
        {items.map((i) => ligne(i))}
      </div>
    );

  const accueil = groupes.essentiels.find((i) => i.key === 'home');
  const autresEssentiels = groupes.essentiels.filter((i) => i.key !== 'home');
  const tousCourant = pathname === ROUTE_TOUS_LES_MODULES;

  return (
    <motion.aside
      data-nav-refonte
      aria-label={tn('rail.nav')}
      initial={{ width: deplie ? LARGEUR_COQUILLE : LARGEUR_RAIL + 1 }}
      animate={{ width: deplie ? LARGEUR_COQUILLE : LARGEUR_RAIL + 1 }}
      transition={TRANSITION}
      style={{ background: 'linear-gradient(180deg,#101010 0%,var(--color-sunken) 55%,#090909 100%)' }}
      className="hidden h-full flex-shrink-0 flex-col overflow-hidden border-r border-[#1c1c1c] md:relative md:z-30 md:flex"
    >
      {enTete}

      <div className={`flex-none pt-2.5 ${deplie ? 'px-3' : 'px-1.5'}`} data-guide="recherche">
        <button
          type="button"
          onClick={ouvrirRecherche}
          aria-label={tn('rail.recherche')}
          title={deplie ? undefined : tn('rail.recherche')}
          className={`flex h-[32px] w-full items-center gap-2 border border-border-section bg-sunken text-left text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary ${deplie ? 'px-2.5' : 'justify-center'}`}
        >
          <Search size={13} strokeWidth={2.2} className="flex-none" aria-hidden />
          {deplie && <span className="min-w-0 flex-1 truncate">{tn('rail.recherche')}</span>}
          {deplie && <span className="flex-none font-mono text-[9px] tracking-[0.08em]">⌘K</span>}
        </button>
      </div>

      <nav className={`flex min-h-0 flex-1 flex-col overflow-y-auto pb-3 ${deplie ? 'px-2.5' : 'px-1.5'}`}>
        <div role="group" aria-label={tn('rail.essentiels')} className="flex flex-col gap-0.5">
          {deplie ? (
            <p className="eyebrow px-2 pb-1 pt-3 text-text-muted">{tn('rail.essentiels')}</p>
          ) : (
            <span aria-hidden className="mx-auto my-2 h-px w-6 bg-border-strong" />
          )}
          {accueil && ligne(accueil, true)}
          {autresEssentiels.map((i) => ligne(i))}
          <Link
            to={ROUTE_TOUS_LES_MODULES}
            data-famille="outils"
            aria-current={tousCourant ? 'page' : undefined}
            aria-label={deplie ? undefined : tn('rail.tous')}
            title={deplie ? undefined : tn('rail.tous')}
            onClick={onNavigate}
            className={`relative flex min-h-9 items-center gap-2.5 rounded-md py-1.5 text-[13px] transition-colors ${deplie ? 'px-2' : 'justify-center px-0'} ${tousCourant ? 'bg-surface-hover font-semibold text-text-primary' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
          >
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-strong text-text-secondary">
              <LayoutGrid size={14} strokeWidth={2.1} aria-hidden />
            </span>
            {deplie && <span className="min-w-0 flex-1 truncate">{tn('rail.tous')}</span>}
          </Link>
        </div>
        {groupe('rail.epingles', groupes.epingles, 'epingles')}
        {groupe('rail.recents', groupes.recents)}
        {groupe('rail.maintenant', groupes.maintenant)}
        {groupe('rail.garde', groupes.garde, 'supervision')}
      </nav>

      {pied}
    </motion.aside>
  );
}

function LigneDuMoment({
  item,
  libelle,
  courant,
  compteur,
  deplie,
  extra,
  raccourci,
  aide,
  epingle,
  onEpingler,
  libelleEpingler,
  onNavigate,
}: {
  item: NavItem;
  libelle: string;
  courant: boolean;
  compteur: number;
  deplie: boolean;
  extra?: React.ReactNode;
  raccourci?: string;
  aide?: string;
  epingle: boolean;
  onEpingler?: (cle: string) => void;
  libelleEpingler: (nom: string, epingle: boolean) => string;
  onNavigate?: () => void;
}) {
  const Icone = item.key === 'home' ? Home : item.icon;
  const basculer = (e: React.SyntheticEvent) => {
    // La ligne est un lien : sans ça, épingler navigue.
    e.preventDefault();
    e.stopPropagation();
    onEpingler?.(item.key);
  };
  return (
    <Link
      to={item.to}
      data-famille={familleDe(item.key)}
      data-nav-ligne={item.key}
      aria-current={courant ? 'page' : undefined}
      aria-label={deplie ? undefined : libelle}
      title={aide ?? (deplie ? undefined : libelle)}
      onClick={onNavigate}
      className={`group relative flex min-h-9 items-center gap-2.5 rounded-md py-1.5 text-[13px] transition-colors ${deplie ? 'px-2' : 'justify-center px-0'} ${
        courant ? 'bg-surface-hover font-semibold text-text-primary' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
      }`}
    >
      {/* Le module courant : un filet de la couleur de sa famille. Jamais ambre. */}
      {courant && <span aria-hidden className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-full bg-[var(--fam)]" />}
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-[var(--fam-bord)] bg-[var(--fam-fond)] text-[var(--fam-texte)]">
        <Icone size={14} strokeWidth={2.1} />
      </span>
      {deplie && <span className="min-w-0 flex-1 truncate">{libelle}</span>}
      {compteur > 0 &&
        (deplie ? (
          <span className="flex-none font-mono text-[9.5px] text-text-muted">{compteur > 99 ? '99+' : compteur}</span>
        ) : (
          <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-text-secondary" />
        ))}
      {extra}
      {deplie && raccourci && (
        <kbd className="flex-none border border-border px-1 font-mono text-[9px] text-text-muted">{raccourci}</kbd>
      )}
      {deplie && onEpingler && (
        <span
          role="button"
          tabIndex={0}
          aria-label={libelleEpingler(libelle, epingle)}
          title={libelleEpingler(libelle, epingle)}
          onClick={basculer}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') basculer(e);
          }}
          className="flex h-5 w-5 flex-none items-center justify-center text-text-muted opacity-0 transition-opacity hover:text-text-primary focus:opacity-100 group-hover:opacity-100"
        >
          {epingle ? <PinOff size={11} strokeWidth={2} /> : <Pin size={11} strokeWidth={2} />}
        </span>
      )}
    </Link>
  );
}
