import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CircleAlert, Ellipsis, MessageSquare, Plus } from 'lucide-react';
import { estFamille, type Famille } from '../../familles';
import { useSocleLangue } from '../../i18n';
import { BarreProgression } from '../Indicateurs';
import { PileAvatars, type EtatPastille } from '../Pastilles';
import { BoutonIcone, DrapeauUrgent } from '../controles';
import { TexteTronque } from './TexteTronque';
import { deplacerElement, destinations, indexDepot, peutAccueillir, type ColonneLogique } from './logique/kanban';
import { voisinKanban } from './logique/navigation';

/**
 * LE TABLEAU KANBAN (archétype « board ») — des colonnes, des tickets, un déplacement qui se fait aussi au clavier.
 *
 * Mode d'emploi : `<Kanban libelle="…" colonnes={[{ cle, titre, accent, limite, tickets }]} cleTicket={…} titreTicket={…}
 * rendreTicket={(t) => <Ticket cle={t.id} titre={t.titre} urgent={…} tags={…} progression={…} />} onDeplacer={(d) => setColonnes(d.colonnes)} />`.
 * Chaque ticket a un bouton « Déplacer vers… » (menu : ↑ ↓ pour choisir, Entrée pour valider, Échap pour fermer) ;
 * ↑ ↓ ← → passent d'un ticket à l'autre ; la souris peut aussi glisser un ticket (glisser-déposer natif du
 * navigateur, facultatif, sans bibliothèque). Une colonne pleine (`limite`) refuse et le dit à voix haute.
 * `Ticket` et `ColonneKanban` se posent aussi seuls, sans déplacement.
 */

interface ContexteKanbanValeur {
  destinationsDe: (cle: string) => { cle: string; titre: string; pleine: boolean }[];
  titreDe: (cle: string) => string;
  deplacer: (cle: string, vers: string) => void;
  glisse: string | null;
  commencerGlisser: (cle: string) => void;
  finirGlisser: () => void;
}
const ContexteKanban = createContext<ContexteKanbanValeur | null>(null);

/* ─────────────────────────────  Le ticket  ───────────────────────────── */

export interface TicketProps {
  /** Son identifiant : sans lui, pas de menu de déplacement ni de glisser-déposer. */
  cle?: string;
  titre: string;
  /** Filet gauche de 3 px et drapeau « Urgent » (l'icône accompagne toujours le mot). */
  urgent?: boolean;
  /** Des `Tag`. */
  tags?: React.ReactNode;
  /** « 2/5 » : une barre de 4 px et le rapport. */
  progression?: { fait: number; total: number };
  /** Les noms des responsables : avatars de 22 px. */
  responsables?: string[];
  /** Le texte de l'échéance, déjà mis en forme (`CelluleDate`, `formaterDate`) ; `retard` change l'icône et le dit. */
  echeance?: { texte: string; retard?: boolean };
  commentaires?: number;
  /** Ouvre le ticket : le titre devient un bouton. */
  onOuvrir?: () => void;
}

function MenuDeplacer({ cle, titre }: { cle: string; titre: string }) {
  const ctx = useContext(ContexteKanban);
  const { ts } = useSocleLangue();
  const [ouvert, setOuvert] = useState(false);
  const [place, setPlace] = useState({ haut: 0, gauche: 0 });
  const declencheur = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const idMenu = useId();
  const cibles = ctx?.destinationsDe(cle) ?? [];

  const fermer = (rendreLeFocus: boolean) => {
    setOuvert(false);
    if (rendreLeFocus) declencheur.current?.focus();
  };

  useLayoutEffect(() => {
    if (!ouvert || !declencheur.current) return;
    const r = declencheur.current.getBoundingClientRect();
    const largeur = menu.current?.offsetWidth ?? 220;
    const hauteur = menu.current?.offsetHeight ?? 0;
    const bas = r.bottom + 4;
    setPlace({
      haut: bas + hauteur > window.innerHeight && r.top - 4 - hauteur > 0 ? r.top - 4 - hauteur : bas,
      gauche: Math.max(8, Math.min(r.right - largeur, window.innerWidth - largeur - 8)),
    });
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return undefined;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    const dehors = (e: MouseEvent) => {
      const cible = e.target as Node;
      if (!menu.current?.contains(cible) && !declencheur.current?.contains(cible)) setOuvert(false);
    };
    const replier = () => setOuvert(false);
    document.addEventListener('mousedown', dehors);
    window.addEventListener('resize', replier);
    window.addEventListener('scroll', replier, true);
    return () => {
      document.removeEventListener('mousedown', dehors);
      window.removeEventListener('resize', replier);
      window.removeEventListener('scroll', replier, true);
    };
  }, [ouvert]);

  if (!ctx) return null;

  const surTouche = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      fermer(true);
    } else if (e.key === 'Tab') {
      setOuvert(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const vers = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[vers]?.focus();
    }
  };

  return (
    <>
      <button
        ref={declencheur}
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idMenu : undefined}
        aria-label={ts('kanban.deplacerTicket', { titre })}
        title={ts('kanban.deplacer')}
        data-ouvert={ouvert || undefined}
        onClick={() => setOuvert((o) => !o)}
        className="sc-ticket__menu sc-focus"
      >
        <Ellipsis aria-hidden size={16} />
      </button>
      {ouvert &&
        createPortal(
          <div ref={menu} id={idMenu} role="menu" aria-label={ts('kanban.deplacer')} onKeyDown={surTouche} style={{ top: place.haut, left: place.gauche }} className="sc-kanban__menu">
            <p aria-hidden className="sc-kanban__menu-titre">
              {ts('kanban.deplacer')}
            </p>
            {cibles.map((c) => (
              <button
                key={c.cle}
                type="button"
                role="menuitem"
                aria-disabled={c.pleine || undefined}
                onClick={() => {
                  if (c.pleine) return;
                  setOuvert(false);
                  ctx.deplacer(cle, c.cle);
                }}
                className="sc-kanban__menu-item sc-focus"
              >
                <span>{c.titre}</span>
                {c.pleine && <span className="sc-kanban__menu-note">{ts('kanban.pleine')}</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export function Ticket({ cle, titre, urgent = false, tags, progression, responsables, echeance, commentaires, onOuvrir }: TicketProps) {
  const ctx = useContext(ContexteKanban);
  const { ts } = useSocleLangue();
  const idTitre = useId();
  const deplacable = Boolean(ctx && cle);
  const aUnPied = Boolean(responsables?.length) || Boolean(echeance) || commentaires != null;
  const corpsTitre = <TexteTronque lignes={2}>{titre}</TexteTronque>;
  return (
    <article
      aria-labelledby={idTitre}
      data-ticket={cle}
      data-ticket-focus={onOuvrir ? undefined : cle}
      data-urgent={urgent || undefined}
      data-menu={deplacable || undefined}
      data-glisse={(cle && ctx?.glisse === cle) || undefined}
      draggable={deplacable || undefined}
      tabIndex={!onOuvrir && deplacable ? 0 : undefined}
      onDragStart={
        deplacable && cle
          ? (e) => {
              e.dataTransfer.setData('text/plain', cle);
              e.dataTransfer.effectAllowed = 'move';
              ctx?.commencerGlisser(cle);
            }
          : undefined
      }
      onDragEnd={deplacable ? () => ctx?.finirGlisser() : undefined}
      className="sc-ticket sc-focus"
    >
      {urgent && (
        <span className="sc-ticket__urgent">
          <DrapeauUrgent />
        </span>
      )}
      <span id={idTitre} className="sc-ticket__titre">
        {onOuvrir ? (
          <button type="button" data-ticket-focus={cle} onClick={onOuvrir} className="sc-ticket__lien sc-focus">
            {corpsTitre}
          </button>
        ) : (
          corpsTitre
        )}
      </span>
      {tags && <span className="sc-ticket__tags">{tags}</span>}
      {progression && (
        <span className="sc-ticket__progression">
          <BarreProgression
            valeur={progression.total > 0 ? progression.fait / progression.total : 0}
            hauteur={4}
            libelle={ts('ticket.progression', { x: progression.fait, y: progression.total })}
            texte={ts('ticket.progression', { x: progression.fait, y: progression.total })}
          />
          <span aria-hidden className="sc-ticket__ratio">
            {progression.fait}/{progression.total}
          </span>
        </span>
      )}
      {aUnPied && (
        <span className="sc-ticket__pied">
          {responsables && responsables.length > 0 && <PileAvatars noms={responsables} max={2} taille={22} libelle={ts('ticket.responsables', { noms: responsables.join(', ') })} />}
          {(echeance || commentaires != null) && (
            <span className="sc-ticket__droite">
              {echeance && (
                <span className="sc-ticket__echeance" data-retard={echeance.retard || undefined} title={echeance.retard ? ts('ticket.enRetard') : ts('ticket.echeance', { date: echeance.texte })}>
                  {echeance.retard ? <CircleAlert aria-hidden size={12} /> : <Calendar aria-hidden size={12} />}
                  <span>{echeance.texte}</span>
                  {echeance.retard && <span className="sr-only"> — {ts('ticket.enRetard')}</span>}
                </span>
              )}
              {commentaires != null && (
                <span className="sc-ticket__commentaires" role="img" aria-label={ts('ticket.commentaires', { n: commentaires })}>
                  <MessageSquare aria-hidden size={12} />
                  <span aria-hidden>{commentaires}</span>
                </span>
              )}
            </span>
          )}
        </span>
      )}
      {deplacable && cle && <MenuDeplacer cle={cle} titre={titre} />}
    </article>
  );
}

/* ─────────────────────────────  La colonne  ───────────────────────────── */

export interface ColonneKanbanProps {
  cle?: string;
  titre: string;
  /** La couleur du point : une famille ou un état. */
  accent?: Famille | EtatPastille;
  /** Le nombre de tickets. */
  nombre: number;
  /** « sur N » à côté du nombre : une limite de travaux en cours. */
  limite?: number;
  /** Le « + » de l'en-tête et la zone « Ajouter ou glisser ici ». */
  onAjouter?: () => void;
  /** Des `Ticket`. */
  children?: React.ReactNode;
  /** Pour le glisser-déposer : posé par `Kanban`. */
  depot?: { actif: boolean; survol: boolean; onSurvol: () => void; onQuitter: () => void; onDeposer: (index: number) => void };
}

export function ColonneKanban({ cle, titre, accent, nombre, limite, onAjouter, children, depot }: ColonneKanbanProps) {
  const { ts } = useSocleLangue();
  const idTitre = useId();
  const pleine = limite != null && nombre >= limite;
  const zone = (
    <>
      <Plus aria-hidden size={14} />
      <span>{onAjouter ? ts('kanban.ajouter') : ts('kanban.deposer')}</span>
    </>
  );
  return (
    <section
      aria-labelledby={idTitre}
      data-colonne-kanban={cle}
      data-survol={(depot?.actif && depot.survol) || undefined}
      data-pleine={pleine || undefined}
      onDragOver={
        depot?.actif
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              depot.onSurvol();
            }
          : undefined
      }
      onDragLeave={depot?.actif ? (e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && depot.onQuitter() : undefined}
      onDrop={
        depot?.actif
          ? (e) => {
              e.preventDefault();
              const milieux = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-ticket]')).map((el) => {
                const r = el.getBoundingClientRect();
                return r.top + r.height / 2;
              });
              depot.onDeposer(indexDepot(milieux, e.clientY));
            }
          : undefined
      }
      className="sc-kanban__colonne"
    >
      <header className="sc-kanban__entete">
        {accent && <span aria-hidden className="sc-point sc-kanban__accent" data-taille="8" data-famille={estFamille(accent) ? accent : undefined} data-etat={estFamille(accent) ? undefined : accent} />}
        <h3 id={idTitre} className="sc-kanban__nom">
          <TexteTronque>{titre}</TexteTronque>
        </h3>
        <span className="sc-kanban__compteur" data-pleine={pleine || undefined} title={pleine ? ts('kanban.pleine') : undefined}>
          {nombre}
          {limite != null && <span> {ts('kanban.sur', { n: limite })}</span>}
          {pleine && <span className="sr-only"> — {ts('kanban.pleine')}</span>}
        </span>
        {onAjouter && <BoutonIcone libelle={ts('kanban.ajouterDans', { colonne: titre })} icone={<Plus />} onClick={onAjouter} className="sc-kanban__plus" />}
      </header>
      <div className="sc-kanban__defile">
        <ul role="list" className="sc-kanban__liste">
          {React.Children.toArray(children).map((c, i) => (
            <li key={React.isValidElement(c) && c.key != null ? c.key : i}>{c}</li>
          ))}
        </ul>
        {onAjouter ? (
          <button type="button" onClick={onAjouter} className="sc-kanban__ajout sc-focus">
            {zone}
          </button>
        ) : (
          <div className="sc-kanban__ajout" data-statique="">
            {zone}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────  Le tableau  ───────────────────────────── */

export interface ColonneKanbanDef<T> {
  cle: string;
  titre: string;
  accent?: Famille | EtatPastille;
  limite?: number;
  tickets: T[];
}

export interface DeplacementKanban<T> {
  cle: string;
  depuis: string;
  vers: string;
  /** Le rang du ticket dans sa nouvelle colonne. */
  index: number;
  /** Les colonnes après le déplacement, prêtes à être rangées (`setColonnes`). */
  colonnes: ColonneLogique<T>[];
}

export interface KanbanProps<T> {
  libelle: string;
  colonnes: ColonneKanbanDef<T>[];
  cleTicket: (ticket: T) => string;
  /** Le titre d'un ticket, pour le menu et pour l'annonce du déplacement. */
  titreTicket: (ticket: T) => string;
  rendreTicket: (ticket: T) => React.ReactNode;
  /** Appelé pour un déplacement permis (menu ou souris). Rangez `deplacement.colonnes`. */
  onDeplacer: (deplacement: DeplacementKanban<T>) => void;
  /** Le « + » et la zone « Ajouter ou glisser ici » de chaque colonne. */
  onAjouter?: (colonne: string) => void;
}

export function Kanban<T>({ libelle, colonnes, cleTicket, titreTicket, rendreTicket, onDeplacer, onAjouter }: KanbanProps<T>) {
  const { ts } = useSocleLangue();
  const racine = useRef<HTMLDivElement | null>(null);
  const [glisse, setGlisse] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState('');
  const aRefocaliser = useRef<string | null>(null);

  const logiques: ColonneLogique<T>[] = colonnes.map((c) => ({ cle: c.cle, elements: c.tickets, limite: c.limite }));
  const tous = colonnes.flatMap((c) => c.tickets);
  const titreDe = (cle: string) => {
    const t = tous.find((x) => cleTicket(x) === cle);
    return t ? titreTicket(t) : cle;
  };

  const deplacer = (cle: string, vers: string, index?: number) => {
    const depuis = colonnes.find((c) => c.tickets.some((t) => cleTicket(t) === cle))?.cle;
    const colonneCible = colonnes.find((c) => c.cle === vers);
    const r = deplacerElement(logiques, cleTicket, cle, vers, index);
    if (!r.deplace) {
      if (r.raison === 'limite' && colonneCible) setAnnonce(ts('kanban.refuse', { colonne: colonneCible.titre, titre: titreDe(cle) }));
      return;
    }
    if (!depuis || !colonneCible) return;
    const final = r.colonnes.find((c) => c.cle === vers)?.elements.findIndex((t) => cleTicket(t) === cle) ?? 0;
    aRefocaliser.current = cle;
    setAnnonce(ts(depuis === vers ? 'kanban.reordonne' : 'kanban.deplace', { titre: titreDe(cle), colonne: colonneCible.titre }));
    onDeplacer({ cle, depuis, vers, index: final, colonnes: r.colonnes });
  };

  // Après un déplacement, le ticket change de colonne (donc de nœud) : le focus le suit.
  useEffect(() => {
    const cle = aRefocaliser.current;
    if (!cle) return;
    aRefocaliser.current = null;
    racine.current?.querySelectorAll<HTMLElement>('[data-ticket-focus]').forEach((el) => {
      if (el.getAttribute('data-ticket-focus') === cle) el.focus();
    });
  });

  const contexte: ContexteKanbanValeur = {
    destinationsDe: (cle) =>
      destinations(logiques, cleTicket, cle).map((d) => ({ cle: d.cle, titre: colonnes.find((c) => c.cle === d.cle)?.titre ?? d.cle, pleine: d.pleine })),
    titreDe,
    deplacer: (cle, vers) => deplacer(cle, vers),
    glisse,
    commencerGlisser: setGlisse,
    finirGlisser: () => {
      setGlisse(null);
      setSurvol(null);
    },
  };

  const surTouche = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const cible = e.target as HTMLElement;
    const cle = cible.getAttribute?.('data-ticket-focus');
    if (!cle || !racine.current) return;
    const cols = Array.from(racine.current.querySelectorAll<HTMLElement>('[data-colonne-kanban]'));
    const listes = cols.map((c) => Array.from(c.querySelectorAll<HTMLElement>('[data-ticket-focus]')));
    const colonne = listes.findIndex((l) => l.includes(cible));
    if (colonne < 0) return;
    const vers = voisinKanban(listes.map((l) => l.length), { colonne, index: listes[colonne].indexOf(cible) }, e.key);
    if (!vers) return;
    e.preventDefault();
    listes[vers.colonne][vers.index]?.focus();
  };

  return (
    <div className="sc-kanban sc-zone" style={{ '--sc-kanban-colonnes': Math.max(1, colonnes.length) } as React.CSSProperties}>
      <ContexteKanban.Provider value={contexte}>
        <div ref={racine} role="group" aria-label={libelle} onKeyDown={surTouche} className="sc-kanban__colonnes">
          {colonnes.map((c) => {
            const accepte = glisse != null && peutAccueillir({ elements: c.tickets, limite: c.limite }, c.tickets.some((t) => cleTicket(t) === glisse));
            return (
              <ColonneKanban
                key={c.cle}
                cle={c.cle}
                titre={c.titre}
                accent={c.accent}
                nombre={c.tickets.length}
                limite={c.limite}
                onAjouter={onAjouter ? () => onAjouter(c.cle) : undefined}
                depot={{
                  actif: glisse != null,
                  survol: survol === c.cle && accepte,
                  onSurvol: () => setSurvol(c.cle),
                  onQuitter: () => setSurvol((s) => (s === c.cle ? null : s)),
                  onDeposer: (index) => {
                    const cle = glisse;
                    setGlisse(null);
                    setSurvol(null);
                    if (cle) deplacer(cle, c.cle, index);
                  },
                }}
              >
                {c.tickets.map((t) => (
                  <React.Fragment key={cleTicket(t)}>{rendreTicket(t)}</React.Fragment>
                ))}
              </ColonneKanban>
            );
          })}
        </div>
      </ContexteKanban.Provider>
      <div role="status" aria-live="polite" className="sr-only">
        {annonce}
      </div>
    </div>
  );
}
