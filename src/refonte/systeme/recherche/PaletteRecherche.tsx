import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownRight, FileText, LayoutGrid, Mail, MessageCircle, NotebookPen, ReceiptEuro, RefreshCw, Scale, Search, SquareCheckBig, User, Users } from 'lucide-react';
import { useFermetureEchap } from '../../../lib/useFermetureEchap';
import { useMouvement, type NiveauMouvement } from '../../../socle/mouvement';
import { Bouton, Raccourci, Squelette } from '../../../socle/ui';
import { IconeEtincelle } from '../../../socle/ui/controles';
import { NAV_ITEMS } from '../../../data/navigation';
import { useIndexRecherche, useMemoireRecherche, useEnLigne } from './index';
import { traduire, useMots, type CleMot } from './i18n';
import { prechauffer, rechercher, type ActionPageDecl, type ContexteRecherche, type GroupeRecherche, type IconeLigne, type Index, type LigneRecherche, type ReponseRecherche, type TextesMoteur } from './moteur';
import './recherche.css';

/**
 * LA PALETTE ⌘K — chercher n'importe quoi en quelques lettres, et lancer une action connue.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * H41 (LOT-00). Elle ne se confond pas avec la palette d'Ajmani (⌘J, `src/socle/coquille`) : celle-ci
 * cherche et lance des actions connues ; l'autre comprend des phrases libres. La première ligne de ce qu'on
 * tape est donc toujours une porte vers Ajmani, pour qu'une recherche ne soit jamais une impasse.
 *
 * `PaletteRecherche` est la pièce branchée : elle lit l'index réel, la mémoire des ouvertures et le réseau.
 * `PaletteRechercheVue` est la même palette sans rien d'autre que ses propriétés — c'est elle que le
 * contrôle rend en HTML statique, et que les tests visuels montrent par état.
 *
 * Ce que l'hôte doit brancher (la navigation et Ajmani sont injectés, la palette n'a pas de routeur) :
 *   · ⌘K (ou Ctrl K) en phase de capture, avec `stopImmediatePropagation`, comme ⌘J : sinon l'ancienne palette
 *     de commandes s'ouvre aussi ;
 *   · le bouton « Rechercher » de la barre latérale ;
 *   · `surDemanderAjmani` (ouvre ⌘J ou lance la demande) et `surAllerA` (navigation).
 *
 * Le motif ARIA est celui du combobox : le focus reste dans le champ, `aria-activedescendant` désigne la
 * ligne choisie, les lignes sont des `option` d'une `listbox`, un `status` annonce le nombre de résultats.
 * Le calque est fixe, à z-index 50 (`recherche.css`) : c'est ce que la pile des calques reconnaît, et
 * Échap ne ferme que lui.
 */

export interface ActionPage extends ActionPageDecl {
  executer: () => void;
}

export interface PaletteRechercheProps {
  ouverte: boolean;
  onFermer: () => void;
  /** Entrée sur « Demander à Ajmani » : le texte à lui confier (la saisie, ou « Résume l'historique de … »). */
  surDemanderAjmani: (texte: string) => void;
  /** Ouvre une destination : une route et, au besoin, le `location.state` du lien profond. */
  surAllerA: (route: string, state?: Record<string, unknown>) => void;
  /** Ce que la page courante sait faire (« Nouvelle tâche »). Montré à saisie vide, et cherché quand on tape. */
  actionsPage?: readonly ActionPage[];
}

type IconeComposant = React.ComponentType<{ size?: number; strokeWidth?: number }>;

const ICONES: Readonly<Record<Exclude<IconeLigne, 'ajmani' | 'page'>, IconeComposant>> = {
  devis: FileText,
  ecrire: Mail,
  action: CornerDownRight,
  client: Users,
  contact: User,
  facture: ReceiptEuro,
  document: FileText,
  decision: Scale,
  tache: SquareCheckBig,
  note: NotebookPen,
  message: MessageCircle,
};

const DELAI_FRAPPE = 120;
const DELAI_SQUELETTE = 200;
const LIGNES_SQUELETTE = 3;

/** L'icône d'une page : celle de son module au catalogue. */
function iconeDePage(module: string | undefined): IconeComposant | undefined {
  return module ? NAV_ITEMS.find((i) => i.key === module)?.icon : undefined;
}

/* ─────────────────────────────── La palette branchée ─────────────────────────────── */

/**
 * Le calque n'existe que pendant que la palette est ouverte : sa lecture de l'index, de la mémoire et du
 * réseau commence à l'ouverture et s'arrête à la fermeture. `AnimatePresence` garde l'élément 100 ms pour
 * la sortie.
 */
export function PaletteRecherche(props: PaletteRechercheProps) {
  const niveau = useMouvement();
  if (typeof document === 'undefined') return null;
  return createPortal(<AnimatePresence>{props.ouverte && <PaletteOuverte key="palette" {...props} animation={niveau} />}</AnimatePresence>, document.body);
}

function PaletteOuverte({ onFermer, surDemanderAjmani, surAllerA, actionsPage, animation }: PaletteRechercheProps & { animation: NiveauMouvement }) {
  const { index, pret, erreur, recharger } = useIndexRecherche();
  const memoire = useMemoireRecherche();
  const horsLigne = !useEnLigne();
  useFermetureEchap(true, onFermer);

  /* La palette est déjà là : on prépare l'index pendant que la personne commence à taper. */
  useEffect(() => {
    const t = window.setTimeout(() => prechauffer(index), 0);
    return () => window.clearTimeout(t);
  }, [index]);

  /*
    Le focus revient à ce qui l'avait avant — sauf si l'action l'a déjà posé ailleurs (le panneau d'Ajmani, une page).
    L'élément est relevé au rendu, AVANT que le champ ne prenne le focus (`autoFocus` joue à la mise en place).
  */
  const [retour] = useState<HTMLElement | null>(() => (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(
    () => () => {
      const actuel = document.activeElement;
      if (retour?.isConnected && (!actuel || actuel === document.body)) retour.focus();
    },
    [retour],
  );

  /* La page derrière ne défile pas : seule la liste défile. */
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);

  const executer = useCallback(
    (ligne: LigneRecherche) => {
      if (ligne.grise) return;
      const { cible } = ligne;
      if (cible.k === 'ajmani') surDemanderAjmani(cible.texte);
      else if (cible.k === 'aller') {
        memoire.noter(ligne);
        surAllerA(cible.route, cible.state ? { ...cible.state } : undefined);
      } else if (cible.k === 'lien') {
        if (cible.href.startsWith('mailto:')) window.location.href = cible.href;
      } else actionsPage?.find((a) => a.id === cible.id)?.executer();
      onFermer();
    },
    [actionsPage, memoire, onFermer, surAllerA, surDemanderAjmani],
  );

  return (
    <PaletteRechercheVue
      index={index}
      pret={pret}
      erreur={erreur}
      horsLigne={horsLigne}
      recents={memoire.recents}
      frequences={memoire.frequences}
      actionsPage={actionsPage}
      animation={animation}
      iconePage={iconeDePage}
      onFermer={onFermer}
      onExecuter={executer}
      onReessayer={recharger}
    />
  );
}

/* ─────────────────────────────── La palette, sans rien d'autre que ses propriétés ─────────────────────────────── */

export interface PaletteRechercheVueProps {
  index: Index;
  /** Les collections ont été lues : sinon, des squelettes (après 200 ms). */
  pret: boolean;
  erreur: boolean;
  horsLigne: boolean;
  recents: readonly string[];
  frequences: Readonly<Record<string, number>>;
  actionsPage?: readonly ActionPageDecl[];
  /** Le texte de départ (les tests visuels, un état donné). */
  texteInitial?: string;
  /** Le squelette est-il déjà visible ? (200 ms d'attente écoulées) */
  attenteEcoulee?: boolean;
  /** Absent : aucun mouvement (les tests). */
  animation?: NiveauMouvement;
  iconePage?: (module: string | undefined) => IconeComposant | undefined;
  onFermer: () => void;
  onExecuter: (ligne: LigneRecherche) => void;
  onReessayer: () => void;
}

/** Un groupe de lignes, ou la place d'un groupe qu'on attend (trois squelettes). */
type GroupeAffiche = GroupeRecherche | { id: GroupeRecherche['id']; squelette: true };

const REPONSE_VIDE: ReponseRecherche = { mode: 'vide', saisie: '', groupes: [], total: 0, aucunResultat: false, proche: null };

export function PaletteRechercheVue({
  index,
  pret,
  erreur,
  horsLigne,
  recents,
  frequences,
  actionsPage,
  texteInitial = '',
  attenteEcoulee = false,
  animation,
  iconePage,
  onFermer,
  onExecuter,
  onReessayer,
}: PaletteRechercheVueProps) {
  const { langue, tm } = useMots();
  const idTitre = useId();
  const idListe = useId();
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const [texte, setTexte] = useState(texteInitial);
  const [appliquee, setAppliquee] = useState(texteInitial);
  const [actif, setActif] = useState(0);
  const [attendu, setAttendu] = useState(attenteEcoulee);

  /* Les résultats se recalculent 120 ms après la dernière frappe. */
  useEffect(() => {
    if (texte === appliquee) return undefined;
    const t = window.setTimeout(() => setAppliquee(texte), DELAI_FRAPPE);
    return () => window.clearTimeout(t);
  }, [texte, appliquee]);
  useEffect(() => setActif(0), [appliquee]);

  /* Un chargement qui dure moins de 200 ms ne montre rien : jamais un flash. */
  useEffect(() => {
    if (pret) {
      setAttendu(false);
      return undefined;
    }
    const t = window.setTimeout(() => setAttendu(true), DELAI_SQUELETTE);
    return () => window.clearTimeout(t);
  }, [pret]);

  const textes = useMemo<TextesMoteur>(
    () => ({
      ajmaniGenerique: (t) => traduire(langue, 'ajmani.generique', { texte: t }),
      ajmaniClient: (nom) => traduire(langue, 'ajmani.client', { nom }),
      ajmaniClientDemande: (nom) => traduire(langue, 'ajmani.client.demande', { nom }),
      devis: (nom) => traduire(langue, 'action.devis', { nom }),
      ecrire: (nom) => traduire(langue, 'action.ecrire', { nom }),
    }),
    [langue],
  );
  const contexte = useMemo<ContexteRecherche>(() => ({ textes, recents, frequences, horsLigne, actionsPage }), [textes, recents, frequences, horsLigne, actionsPage]);

  const calculer = useCallback(
    (saisie: string): ReponseRecherche | null => {
      try {
        return rechercher(saisie, index, contexte);
      } catch {
        return null;
      }
    },
    [index, contexte],
  );
  const calcul = useMemo(() => calculer(appliquee), [calculer, appliquee]);
  const reponse = calcul ?? REPONSE_VIDE;
  const erreurAffichee = erreur || calcul === null;

  /* Index pas encore lu : les groupes qui en dépendent deviennent des squelettes (les actions, elles, sont déjà là). */
  const groupes = useMemo<GroupeAffiche[]>(() => {
    if (pret) return reponse.groupes;
    const attendus: GroupeRecherche['id'][] = reponse.mode === 'vide' ? ['recents'] : reponse.mode === 'recherche' ? ['resultats'] : [];
    if (attendus.length === 0) return reponse.groupes;
    const ordre: GroupeRecherche['id'][] = reponse.mode === 'vide' ? ['recents', 'actions'] : ['actions', 'resultats'];
    return ordre.flatMap((id): GroupeAffiche[] => (attendus.includes(id) ? (attendu ? [{ id, squelette: true }] : []) : reponse.groupes.filter((g) => g.id === id)));
  }, [pret, attendu, reponse]);

  const plat = useMemo(() => groupes.flatMap((g) => ('lignes' in g ? g.lignes : [])), [groupes]);
  const courante: LigneRecherche | undefined = plat[Math.min(actif, plat.length - 1)];
  const idOption = (i: number) => `${idListe}-${i}`;
  const indexCourant = courante ? plat.indexOf(courante) : -1;

  useEffect(() => {
    if (indexCourant < 0) return;
    document.getElementById(idOption(indexCourant))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexCourant, courante?.cle]);

  const annonce = !pret ? '' : reponse.mode === 'recherche' && reponse.aucunResultat ? tm('annonce.aucun') : plat.length === 0 ? '' : tm(plat.length === 1 ? 'annonce.un' : 'annonce.n', { n: plat.length });

  const surTouche = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActif(() => (plat.length ? (indexCourant + 1) % plat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif(() => (plat.length ? (indexCourant - 1 + plat.length) % plat.length : 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActif(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActif(Math.max(plat.length - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (texte !== appliquee) {
        // La frappe n'a pas encore été recalculée : on lance la première ligne de CE qui est tapé, pas du texte d'avant.
        const ligne = calculer(texte)?.groupes.flatMap((g) => g.lignes)[0];
        if (ligne) onExecuter(ligne);
      } else if (courante) onExecuter(courante);
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      onFermer();
    }
  };

  const effacer = () => {
    setTexte('');
    setAppliquee('');
    champ.current?.focus();
  };

  let rang = -1;
  const contenu = (
    <>
      <h2 id={idTitre} className="sr-only">
        {tm('titre')}
      </h2>
      <div className="rc-champ">
        <Search size={16} aria-hidden className="rc-champ__loupe" />
        <input
          ref={champ}
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={idListe}
          aria-autocomplete="list"
          aria-activedescendant={indexCourant >= 0 ? idOption(indexCourant) : undefined}
          aria-label={tm('champ')}
          placeholder={tm('champ')}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={surTouche}
          autoComplete="off"
          spellCheck={false}
          className="rc-champ__saisie"
        />
        <span aria-hidden className="rc-champ__echap">
          <Raccourci>{tm('echap')}</Raccourci>
        </span>
      </div>

      <div ref={liste} className="rc-liste">
        {horsLigne && <p className="rc-info">{tm('horsligne')}</p>}
        <div id={idListe} role="listbox" aria-label={tm('liste')} aria-busy={!pret || undefined} className="rc-options">
          {groupes.map((g) => {
            if ('squelette' in g) {
              return (
                <div key={`${g.id}-sq`} role="presentation" aria-hidden className="rc-groupe" data-squelette="">
                  <div className="rc-groupe__titre">{tm(`groupe.${g.id}` as CleMot)}</div>
                  {Array.from({ length: LIGNES_SQUELETTE }, (_, i) => (
                    <div key={i} className="rc-ligne rc-ligne--squelette">
                      <Squelette largeur={28} hauteur={28} rayon={8} />
                      <Squelette largeur={`${62 - i * 9}%`} hauteur={12} />
                    </div>
                  ))}
                </div>
              );
            }
            const idGroupe = `${idListe}-g-${g.id}`;
            return (
              <div key={g.id} role="group" aria-labelledby={idGroupe} className="rc-groupe">
                <div id={idGroupe} className="rc-groupe__titre">
                  {tm(`groupe.${g.id}` as CleMot)}
                </div>
                {g.lignes.map((ligne) => {
                  rang += 1;
                  const i = rang;
                  const choisie = ligne === courante;
                  return (
                    <LigneOption
                      key={ligne.cle}
                      id={idOption(i)}
                      ligne={ligne}
                      choisie={choisie}
                      etiquette={ligne.type ? tm(`type.${ligne.type}` as CleMot) : undefined}
                      info={ligne.grise ? tm('action.reseau') : undefined}
                      iconePage={iconePage}
                      onSurvol={() => setActif(i)}
                      onExecuter={() => onExecuter(ligne)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {pret && reponse.mode === 'vide' && plat.length === 0 && <p className="rc-info">{tm('vide.invite')}</p>}

        {pret && reponse.mode === 'recherche' && reponse.aucunResultat && (
          <div className="rc-aucun">
            <span aria-hidden className="rc-aucun__icone">
              <Search size={16} />
            </span>
            <div className="rc-aucun__texte">
              <p className="rc-aucun__titre">{tm('aucun.titre', { texte: reponse.saisie })}</p>
              <p className="rc-aucun__aide">{reponse.proche ? tm('aucun.proche', { nom: reponse.proche.libelle }) : tm('aucun.sans')}</p>
            </div>
            {reponse.proche ? (
              <Bouton variante="primaire" taille="petit" onClick={() => reponse.proche && onExecuter(reponse.proche)}>
                {tm('aucun.voir', { nom: reponse.proche.libelle })}
              </Bouton>
            ) : (
              <Bouton variante="primaire" taille="petit" onClick={effacer}>
                {tm('aucun.effacer')}
              </Bouton>
            )}
          </div>
        )}

        {erreurAffichee && (
          <div className="rc-erreur" role="alert">
            <p className="rc-erreur__texte">{tm('erreur.texte')}</p>
            <Bouton variante="secondaire" taille="petit" icone={<RefreshCw size={14} aria-hidden />} onClick={onReessayer}>
              {tm('erreur.reessayer')}
            </Bouton>
          </div>
        )}
      </div>

      <div role="status" className="sr-only">
        {attendu && !pret ? tm('chargement') : annonce}
      </div>

      <div className="rc-pied">
        <span className="rc-pied__mention" data-secondaire="">
          {tm('pied.naviguer')}
        </span>
        <span className="rc-pied__mention">{tm('pied.ouvrir')}</span>
        <span className="rc-pied__mention rc-pied__astuce" data-secondaire="">
          {tm('pied.astuce')}
        </span>
      </div>
    </>
  );

  const surVoile = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onFermer();
  };
  const proprietesPalette = { role: 'dialog', 'aria-modal': true, 'aria-labelledby': idTitre, tabIndex: -1, className: 'rc-palette' } as const;

  if (!animation) {
    return (
      <div className="rc-voile" onMouseDown={surVoile} data-palette-recherche="">
        <div {...proprietesPalette}>{contenu}</div>
      </div>
    );
  }
  /* Ouverture 140 ms (fondu + 6 px de glissement), fermeture 100 ms. « Réduit » : le fondu seul. « Aucun » : rien. */
  const duree = animation === 'aucun' ? 0 : 0.14;
  const glisse = animation === 'complet' ? -6 : 0;
  return (
    <motion.div className="rc-voile" onMouseDown={surVoile} data-palette-recherche="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: animation === 'aucun' ? 0 : 0.1 } }} transition={{ duration: duree }}>
      <motion.div {...proprietesPalette} initial={{ opacity: 0, y: glisse }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 0, transition: { duration: animation === 'aucun' ? 0 : 0.1 } }} transition={{ duration: duree, ease: 'easeOut' }}>
        {contenu}
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────── Une ligne ─────────────────────────────── */

function LigneOption({
  id,
  ligne,
  choisie,
  etiquette,
  info,
  iconePage,
  onSurvol,
  onExecuter,
}: {
  id: string;
  ligne: LigneRecherche;
  choisie: boolean;
  etiquette?: string;
  info?: string;
  iconePage?: (module: string | undefined) => IconeComposant | undefined;
  onSurvol: () => void;
  onExecuter: () => void;
}) {
  const dernierePosition = useRef<string>('');
  const Icone: IconeComposant | undefined = ligne.icone === 'ajmani' ? undefined : ligne.icone === 'page' ? (iconePage?.(ligne.module) ?? LayoutGrid) : ICONES[ligne.icone];
  return (
    <div
      id={id}
      role="option"
      aria-selected={choisie}
      aria-disabled={ligne.grise || undefined}
      title={info}
      data-genre={ligne.genre}
      className="rc-ligne"
      tabIndex={-1}
      onMouseMove={(e) => {
        // La liste qui défile sous une souris immobile n'est pas un geste : seule une vraie translation déplace la sélection.
        const position = `${e.clientX},${e.clientY}`;
        if (position === dernierePosition.current) return;
        dernierePosition.current = position;
        onSurvol();
      }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onExecuter}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onExecuter();
      }}
    >
      <span aria-hidden className="rc-tuile" data-famille={ligne.famille === 'ajmani' ? undefined : ligne.famille} data-ajmani={ligne.famille === 'ajmani' || undefined}>
        {Icone ? <Icone size={15} strokeWidth={1.8} /> : <IconeEtincelle taille={15} />}
      </span>
      <span className="rc-ligne__libelle">{ligne.libelle}</span>
      {etiquette && <span className="rc-ligne__type">{etiquette}</span>}
      {choisie && (
        <span aria-hidden className="rc-ligne__touche">
          <Raccourci>↵</Raccourci>
        </span>
      )}
    </div>
  );
}
