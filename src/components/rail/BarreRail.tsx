import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Pin, PinOff, Search } from 'lucide-react';
import type { NavItem } from '../../data/navigation';
import { createPortal } from 'react-dom';
import { PanneauMobile } from './PanneauMobile';
import { HINT_FAMILLE } from './famillesHints';
import { teinteFamille } from '../../lib/teintes';

/**
 * LA COQUILLE EN RAIL — la colonne, et une seule fois dans tout le produit.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ## Pourquoi ce fichier existe
 *
 * Il y avait TROIS barres latérales : `components/Sidebar.tsx` (interne),
 * `business/BusinessSidebar.tsx` (cliente) et `client-context/ClientSidebar.tsx`
 * (le contexte de support, qui reflète l'application d'une cliente). Trois
 * fichiers, trois géométries, trois façons de marquer la ligne courante — pour
 * une pièce que les 94 modules des deux éditions ont en permanence sous les
 * yeux. Le paquet de design le dit sans détour : « la divergence entre deux
 * barres est le défaut le plus coûteux de ce projet, il s'est produit deux
 * fois. »
 *
 * Ce composant est donc la géométrie, seule et complète. Les trois appelants
 * lui passent LEUR catalogue en props.
 *
 * ## Et pourquoi il n'importe rien d'une édition
 *
 * C'est la contrainte dure du dépôt, et elle a déjà été enfreinte deux fois :
 * jamais un composant ni une donnée d'une édition ne traverse vers l'autre.
 * `Sidebar.tsx` importe `RemoteSitesContext` et `SitePanelContext` — il suffit
 * qu'un fichier partagé les importe pour que tout le parc de sites reparte
 * dans le bundle livré à une cliente (`scripts/check-business-bundle.mjs` le
 * refuserait, mais tard).
 *
 * D'où la règle de ce fichier : AUCUN import de `@edition/modules`, de
 * `data/spaces`, d'un contexte, d'un état. Les familles, les épingles, les
 * compteurs, l'en-tête et le pied arrivent tous par `props`. Ce composant ne
 * sait pas dans quelle édition il tourne, et c'est ce qui rend la fuite
 * impossible plutôt qu'improbable.
 *
 * ## La géométrie, et le piège de `box-sizing`
 *
 * Les maquettes sont en `content-box` (le cahier ne pose aucune règle
 * `*{box-sizing}`) ; Tailwind met tout le produit en `border-box`. Les deux
 * nombres que le paquet donne comme mesurables sont le RAIL à 52 px et le
 * PANNEAU à 184 px. Pour qu'ils tombent juste ici :
 *
 *     <aside>  237 px au total  =  236 px de contenu + 1 px de bordure droite
 *       rail   52 px            =  5 + 38 + 2×1(bordure de tuile) + 5 + 1(bordure droite)
 *       panneau 184 px          =  236 − 52
 *
 * Le rail porte `box-sizing:border-box` explicitement, alors même que Tailwind
 * le donne déjà : c'est la déclaration qui rend la faute visible à la lecture,
 * et c'est exactement celle qui a été commise une fois. En `content-box`, le
 * même rail ferait 63 px et le panneau 173.
 *
 * ## La formule `27n + 8`
 *
 * Une famille s'affiche EN ENTIER — jamais « + 4 autres ». Sa hauteur est
 * donc connue d'avance, et c'est ce qui permet de la vérifier :
 *
 *     ligne 26 px  ·  interligne 1 px  ·  respiration sous le surtitre 9 px
 *     hauteur = 9 + n×26 + (n−1)×1 = 27n + 8
 *
 * Deux conséquences qui ne sont pas décoratives :
 *
 *   · la ligne fait 26 px parce que `line-height` vaut 16 px, posé ici. Sans
 *     lui, la hauteur dépend de la police héritée et la formule devient fausse
 *     sans que rien ne bouge à l'écran ;
 *   · le nom du module ne revient JAMAIS à la ligne (`min-width:0` +
 *     `text-overflow:ellipsis`). Sans ça « Composition & coût de revient »
 *     passe sur deux lignes, sa ligne fait 42 px, et la formule devient fausse
 *     pour la famille même qui sert à la vérifier.
 *
 * `scripts/check-coquille.mjs` mesure tout cela dans un vrai navigateur, sur
 * les deux éditions.
 *
 * ## Deux plaques, jamais trois
 *
 * La plaque (`linear-gradient(90deg,#1e1e1e,#151515)`) dit « vous êtes ici ».
 * Il y en a exactement DEUX par coquille :
 *
 *   1. la tuile de rail de la famille ouverte — elle marque la FAMILLE ;
 *   2. la ligne du module courant — dans la bande épinglée s'il est épinglé,
 *      dans le panneau sinon. Jamais les deux.
 *
 * Un module épinglé garde donc sa ligne dans le panneau, mais en encre claire,
 * sans plaque ni marqueur : il est à sa place dans sa famille, et sa plaque
 * est là-haut.
 *
 * ## Plus aucun ambre dans la colonne
 *
 * Les trois barres portaient un filet ambre de 3 px sur la ligne active. C'est
 * retiré, et ce n'est pas un détail de goût : l'ambre marque CE QUI DEMANDE UNE
 * DÉCISION, un par écran. Une barre qui en porte un en permanence consomme le
 * budget de tous les écrans à la fois, et `check:signal` ne pouvait pas le voir
 * — il ne regarde que `<main>`. Le marqueur de ligne courante est désormais un
 * filet de 2 px en encre claire, et `check:coquille` refuse le moindre nœud
 * ambre dans la colonne.
 */

/** Une famille du rail : ce que l'appelant doit fournir pour une tuile. */
export interface FamilleRail {
  key: string;
  label: string;
  /** Deux lettres majuscules — le seul texte qui tienne dans 38 px. */
  code: string;
  items: NavItem[];
  /** Une famille de supervision (édition interne) : groupée à part, tuile à l'arête allumée. */
  supervision?: boolean;
  /** Une phrase pour la bulle du rail ; à défaut, celle de `famillesHints` par code. */
  hint?: string;
}

export interface BarreRailProps {
  /** Les familles, dans l'ordre du catalogue. Une tuile chacune. */
  familles: FamilleRail[];
  /** Les modules épinglés, déjà filtrés et ordonnés par l'appelant. */
  epingles?: NavItem[];
  /**
   * Le `to` du module courant — résolu par l'appelant, jamais deviné ici : la
   * règle du préfixe le plus long dépend du catalogue, qui est à lui.
   */
  cheminCourant: string;
  /** Compteurs de nouveautés, par `to`. Sert aussi aux pastilles de famille. */
  compteurs?: Record<string, number>;
  /** L'en-tête et le pied, propres à chaque appelant (identité, compte, actions). */
  enTete?: React.ReactNode;
  pied?: React.ReactNode;
  /** Dépliée (236 px) ou réduite au rail seul (52 px). */
  deplie: boolean;
  /** Le tiroir du téléphone : ouvert, la barre est toujours dépliée. */
  mobileOpen?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
  /**
   * Ce que fait ⌘K. Fourni (édition interne) : la palette de commandes, qui
   * cherche aussi les sites, les notes et la Garde. Absent (édition cliente,
   * contexte de support) : le champ filtre les modules sur place — la palette
   * importe le parc, elle ne peut pas traverser.
   */
  ouvrirRecherche?: () => void;
  /** L'épingle sur la ligne, quand l'appelant sait l'enlever et la remettre. */
  estEpingle?: (cle: string) => boolean;
  onEpingler?: (cle: string) => void;
  /** Un ornement propre à un module (le chevron « liste rapide des sites »). */
  rendreExtra?: (item: NavItem) => React.ReactNode;
  /** Libellés — passés pour que ce fichier n'importe pas l'i18n d'une édition. */
  libelle?: (item: NavItem) => string;
  /** Le panneau liste les familles par leur nom (l'index), la famille ouverte dépliée. */
  indexFamilles?: boolean;
}

/* ── La géométrie, en un seul endroit. Le contrôle relit ces nombres. ── */
/** Largeur totale de la colonne : 236 de contenu + 1 de bordure droite. */
export const LARGEUR_COQUILLE = 237;
/** Le rail, bordure droite et respiration comprises (`box-sizing:border-box`). */
export const LARGEUR_RAIL = 52;
/** Le panneau : le reste. 236 − 52. */
export const LARGEUR_PANNEAU = 184;
/** La tuile, bordure comprise dans les deux états. */
export const COTE_TUILE = 38;
/** Une ligne de module. 16 (interligne) + 2×5 (respiration verticale). */
export const HAUTEUR_LIGNE = 26;
/** L'interligne du panneau. Le « 1 » de `27n + 8`. */
export const INTERLIGNE = 1;
/** La respiration sous le surtitre. Le « 8 » de `27n + 8`, moins l'interligne. */
export const RESPIRATION = 9;
/**
 * L'ÉCART ENTRE DEUX TUILES — 8 px, où le paquet de design en donne 5.
 *
 * Écart assumé, et mesuré. `check:cibles` a compté 88 occurrences : une tuile
 * de 38 px est sous les 44 px d'une cible confortable, et sous 44 px la règle
 * du dépôt (`docs/PRINCIPE-CONFORT.md`) demande 8 px de dégagement. À 5 px, on
 * vise juste ou on ouvre la famille d'à côté — douze fois dans une colonne de
 * 52 px de large, sur les 94 modules des deux éditions.
 *
 * Ce qui change est le seul nombre que le paquet ne donne pas comme mesurable :
 * la gouttière VERTICALE du rail. Les quatre qu'il donne — rail 52,
 * panneau 184, tuile 38 × 38, famille `27n + 8` — sont intacts, et
 * `check:coquille` les mesure tous. Le rail passe de 535 à 568 px de haut pour
 * douze familles ; il défile déjà, et rien d'autre ne bouge.
 *
 * Le paquet a raison sur la forme, le dépôt sur le geste. Les deux tiennent
 * ensemble en ne touchant qu'à la gouttière.
 */
export const GOUTTIERE_TUILES = 8;

const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

/**
 * LA PLAQUE — et pourquoi elle est écrite ici plutôt qu'en classe Tailwind.
 *
 * `check:coquille` compte les nœuds dont le `background-image` calculé est ce
 * dégradé. Une seule déclaration, donc, relue par les deux endroits qui la
 * posent (la tuile ouverte et la ligne courante) : deux copies finiraient par
 * différer d'un point de gris, et le contrôle n'en verrait plus qu'une.
 */
const PLAQUE: React.CSSProperties = {
  backgroundImage: 'linear-gradient(90deg,#1e1e1e,#151515)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07),0 1px 3px rgba(0,0,0,.65)',
};

export function BarreRail({
  familles,
  epingles = [],
  cheminCourant,
  compteurs = {},
  enTete,
  pied,
  deplie,
  mobileOpen = false,
  onClose,
  onNavigate,
  ouvrirRecherche,
  estEpingle,
  onEpingler,
  rendreExtra,
  libelle = (item) => item.label,
  indexFamilles = false,
}: BarreRailProps) {
  /* La bulle du rail : le nom de la famille survolée (ou au clavier), tout de suite, sans attendre l'infobulle native. */
  const [bulle, setBulle] = useState<{ f: FamilleRail; top: number; left: number } | null>(null);
  /*
    `deplie` seul : la colonne est désormais une surface de BUREAU. Le tiroir
    du téléphone est la feuille `PanneauMobile`, qui ne se plie pas — elle
    couvre l'écran le temps qu'on choisit, puis s'en va.
  */
  const expanded = deplie;
  const total = useMemo(() => familles.reduce((n, f) => n + f.items.length, 0), [familles]);

  /*
    QUELLE FAMILLE EST OUVERTE : CELLE DU MODULE COURANT.

    Aucun cas ne retombe sur un défaut. Si le chemin courant n'appartient à
    aucune famille — une route hors catalogue, un écran d'erreur — on ouvre la
    première, et la coquille ne ment pas : aucune ligne ne porte de plaque,
    parce qu'aucun module n'est courant.
  */
  const [familleChoisie, setFamilleChoisie] = useState<string | null>(null);
  const familleDuCourant = useMemo(
    () => familles.find((f) => f.items.some((i) => i.to === cheminCourant))?.key ?? null,
    [familles, cheminCourant],
  );
  /*
    Le choix manuel ne survit pas à une navigation : ouvrir un module ouvre SA
    famille. Sans ça, on arrive sur « Scanner » avec « Pilotage » déplié et la
    colonne dit « tu n'es nulle part » — le défaut que ce rail existe pour
    corriger.
  */
  useEffect(() => {
    setFamilleChoisie(null);
  }, [cheminCourant]);
  const ouverte =
    familles.find((f) => f.key === (familleChoisie ?? familleDuCourant)) ?? familles[0];

  /* ── Le champ ⌘K ── */
  const champ = useRef<HTMLInputElement | null>(null);
  const [filtre, setFiltre] = useState('');
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
      /*
        Là où une palette existe, elle gagne : elle cherche les sites, les
        notes et les ordres de la Garde en plus des modules, et elle est déjà
        le geste appris. Ailleurs, ⌘K amène au champ — qui, lui, existe dans
        les deux éditions.
      */
      if (ouvrirRecherche) return;
      e.preventDefault();
      champ.current?.focus();
      champ.current?.select();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [ouvrirRecherche]);

  /*
    LE FILTRE, QUAND IL Y EN A UN : il remplace le contenu du panneau, pas la
    famille ouverte. Le rail ne bouge pas — on cherche un module, on ne change
    pas de rangement. Sans accent et sans casse : personne ne tape « Réunions »
    avec son accent dans un champ de recherche.
  */
  const aplatir = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const resultats = useMemo(() => {
    const q = aplatir(filtre.trim());
    if (!q) return null;
    return familles.flatMap((f) => f.items).filter((i) => aplatir(libelle(i)).includes(q));
  }, [filtre, familles, libelle]);

  const clesEpinglees = useMemo(
    () => new Set(expanded ? epingles.map((e) => e.key) : []),
    [epingles, expanded],
  );
  /* Le module courant est-il déjà plaqué dans la bande ? Alors sa ligne de
     panneau reste en encre claire : deux plaques, jamais trois. */
  const courantEstEpingle = epingles.some((e) => e.to === cheminCourant) && expanded;

  const lignesAffichees = resultats ?? ouverte?.items ?? [];

  return (
    <>
      {/* Le fond du tiroir, sous `md` uniquement. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="rail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden"
          />
        )}
      </AnimatePresence>

      {/*
        LE TIROIR DU TÉLÉPHONE N'EST PAS LA COLONNE RÉTRÉCIE.

        `mobileOpen` n'est vrai que sous `md` : les deux mises en page ne
        montrent leur bouton de menu qu'à cette largeur. On rend donc une
        FEUILLE, pleine largeur, à deux niveaux — voir `PanneauMobile`, qui
        explique pourquoi le rail de 52 px n'a pas de sens sur 390 px.

        La colonne de bureau reste montée en dessous (`md:` la révèle) : elle
        n'est pas remplacée, elle est doublée d'une surface qui répond à la
        même question autrement.
      */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="nav-mobile"
            data-coquille-mobile
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={TRANSITION}
            className="fixed inset-y-0 left-0 z-50 w-full max-w-[420px] md:hidden"
          >
            <PanneauMobile
              familles={familles}
              epingles={epingles}
              cheminCourant={cheminCourant}
              compteurs={compteurs}
              libelle={libelle}
              onFermer={onClose}
              onNavigate={onNavigate}
              pied={pied}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.aside
        data-coquille
        /*
          `initial` à la largeur résolue : la colonne ne se déplie pas en
          glissant à chaque ouverture de page (`check:mouvement` l'avait
          relevé sur trois écrans). L'animation reste pour le GESTE de replier.
        */
        initial={{ width: expanded ? LARGEUR_COQUILLE : LARGEUR_RAIL + 1 }}
        animate={{ width: expanded ? LARGEUR_COQUILLE : LARGEUR_RAIL + 1 }}
        transition={TRANSITION}
        style={{
          /* Le dégradé de la colonne. `var(--color-sunken)` au milieu plutôt
             qu'une copie de #0b0b0b : le jour où le jeton bouge, la colonne
             bouge avec lui au lieu de rester seule en arrière. */
          background:
            'linear-gradient(180deg,#101010 0%,var(--color-sunken) 55%,#090909 100%)',
          boxShadow: 'inset -1px 0 0 rgba(255,255,255,.02)',
        }}
        /*
          `hidden md:flex` : sous `md`, la colonne n'existe pas. Elle glissait
          jusqu'ici dans le tiroir, ce qui mettait un rail de 52 px et un
          panneau de 184 sur un écran de 390. La feuille ci-dessus a pris ce
          rôle ; laisser la colonne montée en plus ferait deux navigations
          dans le DOM, dont une invisible que `check:coquille` compterait.
        */
        className="hidden h-full flex-shrink-0 flex-col overflow-hidden border-r border-[#1c1c1c] md:relative md:z-30 md:flex"
      >
        {enTete}

        {/*
          LE CHAMP ⌘K, SOUS L'EN-TÊTE.

          Le contraste de son texte d'invite est le point qu'on rate ici : le
          paquet le donne en #6b6b68, valeur que ce dépôt REFUSE (3,79:1 sur le
          fond, sous le seuil AA — voir REFUSEES dans check-encres.mjs). On
          garde la structure du paquet et on remonte l'encre à la sourdine du
          dépôt, #9a9a97, qui tient AA sur le #0b0b0b du champ.
        */}
        {expanded && (
          <div className="flex-none px-3 pt-2.5" data-guide="recherche">
            <div className="flex h-[30px] items-center gap-2 border border-border-section bg-sunken px-2.5 focus-within:border-border-strong">
              <Search size={12} strokeWidth={2.2} className="flex-none text-text-muted" aria-hidden />
              {ouvrirRecherche ? (
                <button
                  type="button"
                  onClick={ouvrirRecherche}
                  className="min-w-0 flex-1 text-left text-xs text-text-muted"
                >
                  Aller à un module
                </button>
              ) : (
                <input
                  ref={champ}
                  value={filtre}
                  onChange={(e) => setFiltre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setFiltre('');
                  }}
                  placeholder="Aller à un module"
                  aria-label="Aller à un module"
                  className="min-w-0 flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
                />
              )}
              <span className="flex-none font-mono text-[9px] tracking-[0.08em] text-text-muted">
                ⌘K
              </span>
            </div>
          </div>
        )}

        {/*
          LA BANDE ÉPINGLÉE — un raccourci, pas une famille de plus.

          Plafonnée en hauteur et défilante : quelqu'un qui épingle quinze
          modules ne doit pas écraser le rail et le panneau, qui sont le
          rangement. Le plafond est un nombre de lignes, pas un pixel arbitraire.
        */}
        {expanded && epingles.length > 0 && (
          <div className="flex-none px-2.5 pt-3" data-guide="epingles">
            <div className="flex items-center gap-2 px-2 pb-2">
              <span className="eyebrow text-text-muted">Épinglés</span>
              <span className="h-px flex-1 bg-border-row" aria-hidden />
              <span className="font-mono text-[9.5px] text-text-muted">{epingles.length}</span>
            </div>
            <div className="flex max-h-[240px] flex-col gap-0.5 overflow-y-auto">
              {epingles.map((item) => (
                <LigneEpinglee
                  key={item.key}
                  item={item}
                  courant={item.to === cheminCourant}
                  compteur={compteurs[item.to] ?? 0}
                  libelle={libelle(item)}
                  onNavigate={onNavigate}
                  estEpingle={estEpingle}
                  onEpingler={onEpingler}
                  rendreExtra={rendreExtra}
                />
              ))}
            </div>
            <div
              className="mt-3 h-px"
              style={{ background: 'linear-gradient(90deg,#2b2b2b,#1a1a1a 55%,transparent)' }}
              aria-hidden
            />
          </div>
        )}

        {/* ── Le rail et le panneau : ils prennent le reste, et défilent
              indépendamment l'un de l'autre. ── */}
        <div className="flex min-h-0 flex-1 items-stretch">
          <div
            data-rail
            /*
              `box-sizing:border-box` EXPLICITE. Tailwind le pose déjà pour
              tout le produit ; il est réécrit ici parce que c'est la
              déclaration dont dépendent les deux nombres du paquet, et parce
              que la faute inverse a été commise une fois. 52 = 5 + 40 + 5 + 1
              (bordure droite), soit 41 px utiles pour une tuile de 40 avec sa
              bordure.
            */
            style={{ width: LARGEUR_RAIL, boxSizing: 'border-box', padding: '12px 5px', gap: GOUTTIERE_TUILES }}
            className="flex flex-none flex-col items-center overflow-y-auto border-r border-[#171717] bg-[#0a0a0a]"
          >
            {(() => {
              /*
                LA SUPERVISION À PART. Les familles marquées `supervision`
                (édition interne : la Garde, la Tour, le Parc, les Produits)
                viennent en tête, groupées, séparées du quotidien par un filet.
                Elles ne sont plus quatre tuiles grises parmi dix-sept.
              */
              const tuile = (f: FamilleRail) => (
                <TuileFamille
                  key={f.key}
                  famille={f}
                  ouverte={f.key === ouverte?.key}
                  /*
                    LA PASTILLE — quand la famille a quelque chose à signaler.
                    Dérivée des compteurs réels de nouveautés, jamais d'un
                    drapeau posé à la main : une pastille qui ne correspond à
                    rien est pire qu'aucune pastille.
                  */
                  signale={f.items.some((i) => (compteurs[i.to] ?? 0) > 0)}
                  onOuvrir={() => setFamilleChoisie(f.key)}
                  onSurvol={(rect) => setBulle({ f, top: rect.top, left: rect.right + 8 })}
                  onQuitte={() => setBulle((b) => (b?.f.key === f.key ? null : b))}
                />
              );
              const sup = familles.filter((f) => f.supervision);
              const reste = familles.filter((f) => !f.supervision);
              return (
                <>
                  {sup.length > 0 && (
                    <div data-guide="supervision" className="flex flex-col items-center" style={{ gap: GOUTTIERE_TUILES }}>
                      {sup.map(tuile)}
                    </div>
                  )}
                  {sup.length > 0 && reste.length > 0 && <span className="h-px w-6 flex-none bg-border-strong" aria-hidden />}
                  {reste.map(tuile)}
                </>
              );
            })()}
          </div>

          {/*
            Repliée, la colonne EST le rail : le panneau n'est pas réduit à
            zéro pixel, il n'est pas rendu. Un panneau de largeur nulle
            laisserait ses lignes dans le DOM — mesurables, focalisables au
            clavier, et comptées par `check:coquille` avec des largeurs
            fausses.
          */}
          {expanded && (
          <div
            data-rail-panneau
            style={{ width: LARGEUR_PANNEAU, boxSizing: 'border-box' }}
            className="relative flex min-w-0 flex-col overflow-y-auto px-2.5 pb-3.5 pt-3"
          >
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 top-2"
              style={{
                backgroundImage: 'radial-gradient(rgba(255,255,255,.035) .5px,transparent .5px)',
                backgroundSize: '5px 5px',
              }}
              aria-hidden
            />
            {/*
              LE SURTITRE : le nom de la famille ouverte, et son compte sur le
              total de l'édition. Sa respiration de 9 px sous le texte est le
              « 8 » de `27n + 8` (9 − 1 d'interligne) : elle est posée ici, pas
              héritée d'une marge de voisin.
            */}
            <div
              data-rail-surtitre
              className="relative flex items-baseline justify-between gap-2 px-[9px]"
              style={{ paddingBottom: RESPIRATION }}
            >
              <span className="eyebrow min-w-0 truncate text-text-secondary">
                {resultats ? 'Résultats' : indexFamilles ? 'Familles' : (ouverte?.label ?? '')}
              </span>
              <span className="flex-none font-mono text-[9.5px] text-text-muted">
                {resultats ? `${resultats.length} / ${total}` : indexFamilles ? `${familles.length}` : `${ouverte?.items.length ?? 0} / ${total}`}
              </span>
            </div>

            {/*
              L'INDEX — chaque famille en toutes lettres, la famille ouverte
              dépliée sous son nom. Pour qui ne lit pas encore les codes du
              rail. Les lignes de module gardent leur marque et leur plaque :
              « deux plaques, jamais trois » tient aussi ici.
            */}
            {indexFamilles && !resultats && (
              <div className="relative flex flex-col" data-rail-index>
                {familles.map((f, i) => {
                  const ici = f.key === ouverte?.key;
                  const premierDuQuotidien = f.supervision === undefined || f.supervision === false ? familles.findIndex((x) => !x.supervision) === i : false;
                  const premierDeSupervision = f.supervision ? familles.findIndex((x) => x.supervision) === i : false;
                  return (
                    <React.Fragment key={f.key}>
                      {(premierDeSupervision || (premierDuQuotidien && familles.some((x) => x.supervision))) && (
                        <span className="mb-1 mt-2 px-[9px] font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted first:mt-0">
                          {f.supervision ? 'Supervision des clientes' : 'Quotidien'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setFamilleChoisie(ici ? null : f.key)}
                        aria-expanded={ici}
                        style={{ height: HAUTEUR_LIGNE }}
                        className={`flex w-full items-center gap-2 px-[9px] text-left ${ici ? 'text-text-primary' : 'text-text-body hover:text-text-primary'}`}
                      >
                        <span className={`min-w-0 flex-1 truncate text-[12.5px] ${ici ? 'font-semibold' : ''}`}>{f.label}</span>
                        <span className="flex-none font-mono text-[9px] text-text-muted">{f.items.length}</span>
                      </button>
                      {ici && (
                        <div className="mb-1 ml-[9px] flex flex-col border-l border-border-strong pl-1.5" style={{ gap: INTERLIGNE }}>
                          {f.items.map((item) => (
                            <LigneModule
                              key={item.key}
                              item={item}
                              libelle={libelle(item)}
                              courant={item.to === cheminCourant}
                              plaque={item.to === cheminCourant && !courantEstEpingle}
                              epingle={clesEpinglees.has(item.key)}
                              compteur={compteurs[item.to] ?? 0}
                              onNavigate={() => onNavigate?.()}
                            />
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {(!indexFamilles || resultats) && (
            <div
              data-rail-lignes
              data-modules={lignesAffichees.length}
              className="relative flex flex-col"
              style={{ gap: INTERLIGNE }}
            >
              {lignesAffichees.map((item) => (
                <LigneModule
                  key={item.key}
                  item={item}
                  libelle={libelle(item)}
                  courant={item.to === cheminCourant}
                  /* Plaqué ici SEULEMENT si sa plaque n'est pas déjà en haut. */
                  plaque={item.to === cheminCourant && !courantEstEpingle}
                  epingle={clesEpinglees.has(item.key)}
                  compteur={compteurs[item.to] ?? 0}
                  onNavigate={() => {
                    setFiltre('');
                    onNavigate?.();
                  }}
                />
              ))}
              {resultats?.length === 0 && (
                <p className="px-[9px] py-2 text-xs text-text-muted">Aucun module ne porte ce nom.</p>
              )}
            </div>
            )}
          </div>
          )}
        </div>

        {pied}
      </motion.aside>

      {/*
        LA BULLE DU RAIL — le nom en toutes lettres, tout de suite. L'infobulle
        native arrive après une seconde et disparaît au moindre geste ; celle-ci
        suit le survol et le clavier. En portail : la colonne coupe ce qui la
        déborde, et repliée elle ne fait que 53 px.
      */}
      {bulle &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[120] w-[220px] border border-border-raised bg-elevated px-3 py-2.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,1)]"
            style={{ top: bulle.top, left: bulle.left, borderLeftWidth: 2, borderLeftColor: teinteFamille(bulle.f.code) ?? 'var(--color-border-raised)' }}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-semibold text-text-primary">{bulle.f.label}</span>
              <span className="font-mono text-[10px] text-text-muted">{bulle.f.items.length} module{bulle.f.items.length > 1 ? 's' : ''}</span>
            </span>
            {(bulle.f.hint ?? HINT_FAMILLE[bulle.f.code]) && (
              <span className="mt-1 block text-[12px] leading-[1.45] text-text-secondary">{bulle.f.hint ?? HINT_FAMILLE[bulle.f.code]}</span>
            )}
            <span className="mt-1.5 block truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">
              {bulle.f.items.slice(0, 4).map((i) => libelle(i)).join(' · ')}
              {bulle.f.items.length > 4 ? ' …' : ''}
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Une tuile de rail : deux lettres, un compte, et une pastille s'il y a lieu.
 *
 * LES DEUX ÉTATS PORTENT UNE BORDURE DE 1 PX — `#1f1f1f` au repos,
 * `transparent` sur la plaque. Sans la seconde, la tuile ouverte perd 2 px et
 * se recentre : tout le rail tressaute d'une famille à l'autre. C'est le genre
 * de défaut qu'on ne voit pas sur une capture et qu'on sent à l'usage.
 */
function TuileFamille({
  famille,
  ouverte,
  signale,
  onOuvrir,
  onSurvol,
  onQuitte,
}: {
  famille: FamilleRail;
  ouverte: boolean;
  signale: boolean;
  onOuvrir: () => void;
  onSurvol: (rect: DOMRect) => void;
  onQuitte: () => void;
}) {
  const survoler = (e: React.SyntheticEvent<HTMLButtonElement>) => onSurvol(e.currentTarget.getBoundingClientRect());
  return (
    <button
      type="button"
      data-rail-tuile
      data-famille={famille.key}
      data-supervision={famille.supervision ? '' : undefined}
      data-ouverte={ouverte ? '' : undefined}
      data-plaque={ouverte ? '' : undefined}
      onClick={onOuvrir}
      onMouseEnter={survoler}
      onFocus={survoler}
      onMouseLeave={onQuitte}
      onBlur={onQuitte}
      aria-label={`${famille.label} — ${famille.items.length} modules`}
      aria-pressed={ouverte}
      style={{
        width: COTE_TUILE,
        height: COTE_TUILE,
        boxSizing: 'border-box',
        ...(ouverte ? PLAQUE : { backgroundColor: '#131313' }),
        /* La supervision porte l'arête haute allumée — la signature de la Tour de contrôle, et d'elle seule. */
        ...(famille.supervision && !ouverte ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,.14)' } : {}),
      }}
      className={`relative flex flex-none flex-col items-center justify-center gap-0.5 border ${
        ouverte ? 'border-transparent' : 'border-border'
      }`}
    >
      {/* Le marqueur de famille ouverte : 2 px, en encre claire. Jamais ambre. */}
      {ouverte && (
        <span className="absolute bottom-[3px] left-0 top-[3px] w-[2px] bg-text-primary" aria-hidden />
      )}
      <span
        className={`font-mono text-[9px] tracking-[0.06em] ${
          ouverte ? 'font-bold text-text-primary' : 'font-semibold text-[#8a8a87]'
        }`}
      >
        {famille.code}
      </span>
      <span className="font-mono text-[8px] text-[#8a8a87]">{famille.items.length}</span>
      {signale && (
        <span
          className={`absolute right-[4px] top-[4px] h-[4px] w-[4px] rounded-full ${
            ouverte ? 'bg-text-primary' : 'bg-text-secondary'
          }`}
          aria-hidden
        />
      )}
    </button>
  );
}

/**
 * Une ligne de module dans le panneau. 26 px, jamais 27, jamais 42.
 *
 * `lineHeight: 16` est posé en dur : 16 + 2×5 de respiration = 26, et la
 * formule `27n + 8` tient. Hérité, il dépendrait de la police et changerait
 * sans qu'on y touche.
 */
function LigneModule({
  item,
  libelle,
  courant,
  plaque,
  epingle,
  compteur,
  onNavigate,
}: {
  item: NavItem;
  libelle: string;
  courant: boolean;
  plaque: boolean;
  epingle: boolean;
  compteur: number;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={item.to}
      data-rail-ligne
      data-plaque={plaque ? '' : undefined}
      aria-current={courant ? 'page' : undefined}
      onClick={onNavigate}
      title={libelle}
      style={{
        height: HAUTEUR_LIGNE,
        boxSizing: 'border-box',
        padding: '5px 9px',
        fontSize: 12,
        lineHeight: '16px',
        ...(plaque ? PLAQUE : null),
      }}
      className={`relative flex items-center justify-between gap-2 ${
        plaque
          ? 'font-semibold text-text-primary'
          : courant || epingle
            ? 'text-text-body'
            : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      {/* Le marqueur du module courant : 2 px d'encre, à `left:-1px`. */}
      {plaque && (
        <span className="absolute bottom-[2px] left-[-1px] top-[2px] w-[2px] bg-text-primary" aria-hidden />
      )}
      {/*
        LE NOM NE REVIENT JAMAIS À LA LIGNE. Les quatre déclarations vont
        ensemble : sans `min-width:0`, un enfant flex refuse de rétrécir sous sa
        largeur de contenu et `text-overflow` n'a rien à couper.
      */}
      <span
        data-rail-nom
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        className="relative"
      >
        {libelle}
      </span>
      {compteur > 0 && (
        <span
          className={`relative flex-none font-mono text-[9.5px] ${
            plaque ? 'font-semibold text-text-primary' : 'text-text-muted'
          }`}
        >
          {compteur > 99 ? '99+' : compteur}
        </span>
      )}
    </Link>
  );
}

/**
 * Une ligne de la bande épinglée. Plus haute que celle du panneau (elle porte
 * un jeton d'icône de 26 px), et c'est voulu : la bande est un raccourci, elle
 * se lit d'un coup d'œil ; le panneau est un rangement, il se parcourt.
 *
 * Elle ne participe donc PAS à `27n + 8`, qui ne mesure que le panneau.
 */
function LigneEpinglee({
  item,
  courant,
  compteur,
  libelle,
  onNavigate,
  estEpingle,
  onEpingler,
  rendreExtra,
}: {
  item: NavItem;
  courant: boolean;
  compteur: number;
  libelle: string;
  onNavigate?: () => void;
  estEpingle?: (cle: string) => boolean;
  onEpingler?: (cle: string) => void;
  rendreExtra?: (item: NavItem) => React.ReactNode;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      data-rail-epingle
      data-plaque={courant ? '' : undefined}
      aria-current={courant ? 'page' : undefined}
      onClick={onNavigate}
      style={courant ? { ...PLAQUE, paddingLeft: 13 } : { paddingLeft: 13 }}
      className={`group relative flex min-h-11 items-center gap-2.5 py-[7px] pr-2.5 text-[13px] md:min-h-0 ${
        courant ? 'font-semibold text-text-primary' : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      {courant && (
        <span className="absolute bottom-1 left-0 top-1 w-[2px] bg-text-primary" aria-hidden />
      )}
      <span
        className={`relative flex h-[26px] w-[26px] flex-none items-center justify-center rounded-md border ${
          courant
            ? 'border-text-primary bg-text-primary text-bg'
            : 'border-border-section bg-[#151515]'
        }`}
      >
        <Icon size={14} strokeWidth={2.1} />
      </span>
      <span className="relative min-w-0 flex-1 truncate">{libelle}</span>
      {compteur > 0 && (
        <span className="relative flex-none font-mono text-[9.5px] text-text-muted">
          {compteur > 99 ? '99+' : compteur}
        </span>
      )}
      {rendreExtra?.(item)}
      {onEpingler && (
        <span
          role="button"
          tabIndex={0}
          aria-label={estEpingle?.(item.key) ? `Détacher ${libelle}` : `Épingler ${libelle}`}
          title={estEpingle?.(item.key) ? 'Détacher des épinglés' : 'Épingler en haut'}
          onClick={(e) => {
            // La ligne est un lien : sans ça, détacher navigue.
            e.preventDefault();
            e.stopPropagation();
            onEpingler(item.key);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            onEpingler(item.key);
          }}
          className="relative flex h-5 w-5 flex-none items-center justify-center text-text-muted opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
        >
          {estEpingle?.(item.key) ? <PinOff size={11} strokeWidth={2} /> : <Pin size={11} strokeWidth={2} />}
        </span>
      )}
    </Link>
  );
}
