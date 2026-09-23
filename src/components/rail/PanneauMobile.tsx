import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import type { NavItem } from '../../data/navigation';
import type { FamilleRail } from './BarreRail';

/**
 * LA NAVIGATION DU TÉLÉPHONE — le rail n'y a pas sa place, et voici pourquoi.
 * ════════════════════════════════════════════════════════════════════════
 *
 * ## Ce qu'on faisait, et ce que ça donnait
 *
 * Le tiroir du téléphone rendait la colonne de bureau telle quelle. Mesuré sur
 * un écran de 390 px, l'écran le plus courant aujourd'hui :
 *
 *   · le tiroir occupait 237 px, soit 61 % de la largeur ;
 *   · dedans, le RAIL prenait 52 px — un septième de l'écran du téléphone —
 *     pour afficher douze codes de deux lettres. « PI », « CR », « DO ». Ces
 *     codes existent parce qu'une tuile de 38 px ne peut rien porter d'autre ;
 *     sur un téléphone, rien n'oblige à une tuile de 38 px ;
 *   · le panneau gardait ses 184 px, et les noms de modules y tenaient dans
 *     150 px — « Composition & coût de revient » coupé à « Composition &… » ;
 *   · le champ de recherche annonçait « ⌘K » sur un appareil sans touche ⌘ ;
 *   · deux colonnes défilaient indépendamment dans une surface de 237 px.
 *
 * Rétrécir une disposition de bureau n'est pas l'adapter. Le rail résout un
 * problème de BUREAU : montrer douze familles en permanence à côté du contenu,
 * sans voler de place au contenu. Sur un téléphone, il n'y a pas de « à côté »,
 * et la navigation couvre l'écran de toute façon le temps qu'on choisit.
 *
 * ## Ce qu'on fait à la place — la même logique, l'autre géométrie
 *
 * Une feuille pleine largeur, et DEUX NIVEAUX qu'on traverse un à la fois :
 *
 *   niveau 1  les familles, une ligne pleine chacune, avec leur compte ;
 *   niveau 2  les modules de la famille choisie, et un retour.
 *
 * C'est exactement la règle du rail — une famille ouverte à la fois, jamais de
 * liste plate de 71 entrées — rendue par un geste au lieu d'une colonne. Le
 * nom complet de chaque famille est lisible, donc les codes de deux lettres
 * n'ont plus d'objet et disparaissent ; le nom des modules dispose de toute la
 * largeur, donc rien n'est coupé.
 *
 * ## Les mesures qui ne sont pas des choix de goût
 *
 *   · une ligne fait 52 px de haut. Sous 44 px une cible n'est pas
 *     confortable (`docs/PRINCIPE-CONFORT.md`), et une liste qu'on parcourt au
 *     pouce en mouvement mérite plus que le minimum ;
 *   · la feuille est pleine largeur jusqu'à 420 px, puis s'arrête là : au-delà
 *     c'est une tablette, et une feuille de 700 px de large fait parcourir
 *     l'écran des yeux pour rien ;
 *   · la recherche filtre à travers TOUTES les familles, parce que c'est le
 *     geste qui remplace le rail : on sait ce qu'on cherche, on le tape.
 *
 * ## Ce qu'elle n'a pas
 *
 * Pas d'ambre. La règle vaut sur toutes les tailles, et la coquille n'en porte
 * plus aucun depuis la bascule vers le rail — `check:coquille` le mesure, et
 * cette feuille vit dans la même coquille.
 */

/** La hauteur d'une ligne tactile. Au-dessus du minimum, pas au minimum. */
const LIGNE = 52;

export function PanneauMobile({
  familles,
  epingles,
  cheminCourant,
  compteurs = {},
  onFermer,
  onNavigate,
  libelle = (item) => item.label,
  pied,
}: {
  familles: FamilleRail[];
  epingles: NavItem[];
  cheminCourant: string;
  compteurs?: Record<string, number>;
  onFermer?: () => void;
  onNavigate?: () => void;
  libelle?: (item: NavItem) => string;
  pied?: React.ReactNode;
}) {
  const total = useMemo(() => familles.reduce((n, f) => n + f.items.length, 0), [familles]);

  /*
    La famille du module courant est ouverte d'emblée : on arrive dans la
    navigation depuis un écran, et la première chose qu'on doit y lire est
    « vous êtes ici ». Retomber sur la liste des familles obligerait à
    retrouver la sienne avant de pouvoir bouger.
  */
  const familleDuCourant = useMemo(
    () => familles.find((f) => f.items.some((i) => i.to === cheminCourant))?.key ?? null,
    [familles, cheminCourant],
  );
  const [ouverte, setOuverte] = useState<string | null>(familleDuCourant);
  const famille = familles.find((f) => f.key === ouverte) ?? null;

  const [filtre, setFiltre] = useState('');
  const champ = useRef<HTMLInputElement | null>(null);

  /*
    LE CHAMP NE PREND PAS LE FOCUS À L'OUVERTURE.

    Le faire lèverait le clavier logiciel sur la moitié de l'écran, devant une
    liste qu'on vient d'ouvrir pour la PARCOURIR. Chercher est le second geste,
    pas le premier : on tape dans le champ quand on a décidé de chercher.
  */
  const aplatir = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const resultats = useMemo(() => {
    const q = aplatir(filtre.trim());
    if (!q) return null;
    return familles
      .flatMap((f) => f.items.map((i) => ({ item: i, famille: f.label })))
      .filter(({ item }) => aplatir(libelle(item)).includes(q));
  }, [filtre, familles, libelle]);

  /* Échap remonte d'un niveau plutôt que de tout fermer : c'est le geste
     attendu, et sur un clavier externe branché à une tablette c'est le seul. */
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (filtre) setFiltre('');
      else if (ouverte) setOuverte(null);
      else onFermer?.();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [filtre, ouverte, onFermer]);

  const choisir = () => {
    setFiltre('');
    onNavigate?.();
    onFermer?.();
  };

  return (
    <div className="flex h-full w-full flex-col bg-bg" data-nav-mobile>
      {/* ── L'en-tête : où l'on est dans la navigation, et la sortie ── */}
      <div className="flex flex-none items-center gap-2 border-b border-border px-2 py-2">
        {famille && !resultats ? (
          <button
            type="button"
            onClick={() => setOuverte(null)}
            aria-label="Revenir aux familles"
            className="flex h-11 min-w-11 items-center gap-1 px-2 text-sm text-text-secondary"
          >
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
            Familles
          </button>
        ) : (
          <span className="px-2 text-sm font-semibold text-text-primary">Navigation</span>
        )}
        <span className="ml-auto font-mono text-[11px] text-text-muted">
          {famille && !resultats ? `${famille.items.length} / ${total}` : `${total} modules`}
        </span>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer la navigation"
          className="flex h-11 w-11 items-center justify-center text-text-secondary"
        >
          <X size={20} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {/* ── La recherche. Pas de « ⌘K » : ce clavier n'a pas de touche ⌘. ── */}
      <div className="flex-none px-3 pt-3">
        <div className="flex h-11 items-center gap-2 border border-border-section bg-sunken px-3 focus-within:border-border-strong">
          <Search size={15} strokeWidth={2.2} className="flex-none text-text-muted" aria-hidden />
          <input
            ref={champ}
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Chercher un module"
            aria-label="Chercher un module"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {filtre && (
            <button
              type="button"
              onClick={() => setFiltre('')}
              aria-label="Effacer la recherche"
              className="flex h-8 w-8 flex-none items-center justify-center text-text-muted"
            >
              <X size={15} strokeWidth={2} aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-3">
        <AnimatePresence mode="wait" initial={false}>
          {resultats ? (
            <motion.div
              key="resultats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              {resultats.length === 0 ? (
                <p className="px-2 py-6 text-sm text-text-muted">Aucun module ne porte ce nom.</p>
              ) : (
                resultats.map(({ item, famille: nomFamille }) => (
                  <LigneModule
                    key={item.key}
                    item={item}
                    libelle={libelle(item)}
                    dessous={nomFamille}
                    courant={item.to === cheminCourant}
                    compteur={compteurs[item.to] ?? 0}
                    onClick={choisir}
                  />
                ))
              )}
            </motion.div>
          ) : famille ? (
            <motion.div
              key={`famille-${famille.key}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="eyebrow px-2 pb-2 text-text-secondary">{famille.label}</p>
              {famille.items.map((item) => (
                <LigneModule
                  key={item.key}
                  item={item}
                  libelle={libelle(item)}
                  courant={item.to === cheminCourant}
                  compteur={compteurs[item.to] ?? 0}
                  onClick={choisir}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="familles"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {epingles.length > 0 && (
                <>
                  <p className="eyebrow px-2 pb-2 text-text-muted">Épinglés</p>
                  {epingles.map((item) => (
                    <LigneModule
                      key={item.key}
                      item={item}
                      libelle={libelle(item)}
                      courant={item.to === cheminCourant}
                      compteur={compteurs[item.to] ?? 0}
                      onClick={choisir}
                    />
                  ))}
                  <div className="my-3 h-px bg-border" aria-hidden />
                </>
              )}
              <p className="eyebrow px-2 pb-2 text-text-muted">Familles</p>
              {familles.map((f) => {
                const signale = f.items.some((i) => (compteurs[i.to] ?? 0) > 0);
                const ici = f.key === familleDuCourant;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setOuverte(f.key)}
                    style={{ minHeight: LIGNE }}
                    className={`flex w-full items-center gap-3 border-b border-border-row px-2 text-left ${
                      ici ? 'text-text-primary' : 'text-text-body'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px]">{f.label}</span>
                    {signale && (
                      <span className="h-1.5 w-1.5 flex-none rounded-full bg-text-secondary" aria-hidden />
                    )}
                    <span className="flex-none font-mono text-[12px] text-text-muted">
                      {f.items.length}
                    </span>
                    <ChevronRight size={16} strokeWidth={2} className="flex-none text-text-muted" aria-hidden />
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {pied && <div className="flex-none border-t border-border">{pied}</div>}
    </div>
  );
}

/**
 * Une ligne de module. Pleine largeur, 52 px, nom non tronqué.
 *
 * `dessous` porte le nom de la famille dans les résultats de recherche : sans
 * lui, « Calendrier » et « Agenda » se ressemblent assez pour qu'on ouvre le
 * mauvais.
 */
function LigneModule({
  item,
  libelle,
  dessous,
  courant,
  compteur,
  onClick,
}: {
  item: NavItem;
  libelle: string;
  dessous?: string;
  courant: boolean;
  compteur: number;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      aria-current={courant ? 'page' : undefined}
      style={{ minHeight: LIGNE }}
      className={`flex w-full items-center gap-3 border-b border-border-row px-2 ${
        courant ? 'text-text-primary' : 'text-text-body'
      }`}
    >
      <span
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg border ${
          courant ? 'border-text-primary bg-text-primary text-bg' : 'border-border-section bg-elevated'
        }`}
      >
        <Icon size={16} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] ${courant ? 'font-semibold' : ''}`}>{libelle}</span>
        {dessous && <span className="block truncate text-[12px] text-text-muted">{dessous}</span>}
      </span>
      {compteur > 0 && (
        <span className="flex-none font-mono text-[12px] text-text-muted">
          {compteur > 99 ? '99+' : compteur}
        </span>
      )}
    </Link>
  );
}
