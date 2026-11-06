import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CornerDownRight, Euro, FileText, Flag, LayoutGrid, Mail, MessageCircle, NotebookPen, ReceiptEuro, RefreshCw, Scale, Search, SquareCheckBig, User, Users } from 'lucide-react';
import { useFermetureEchap } from '../../../lib/useFermetureEchap';
import { useMouvement, type NiveauMouvement } from '../../../socle/mouvement';
import { useSocleLangue } from '../../../socle/i18n';
import { Bouton, FilterChips, MiniCourbe, Raccourci, Squelette, formaterEuro, formaterPourcent } from '../../../socle/ui';
import { IconeEtincelle } from '../../../socle/ui/controles';
import { IconTile } from '../../../socle/ui/briques-partagees';
import { NAV_ITEMS } from '../../../data/navigation';
import { useToucheModificatrice } from '../../coquille/touche';
import { apercuDeCle, joursEntre, jourIso, type Apercu, type ApercuClient, type ApercuFacture, type FaitActivite } from './apercu';
import { useIndexRecherche, useMemoireRecherche, useEnLigne, useSourcesApercu } from './index';
import { traduire, useMots, type CleMot } from './i18n';
import {
  actionsRapides,
  groupesDeLaPortee,
  porteeSuivante,
  prechauffer,
  pucesDePortee,
  rechercher,
  surligner,
  type ActionPageDecl,
  type ActionsRapides,
  type ContexteRecherche,
  type GroupeRecherche,
  type IconeLigne,
  type Index,
  type LigneRecherche,
  type Portee,
  type ReponseRecherche,
  type TextesMoteur,
} from './moteur';
import './recherche.css';

/**
 * LA PALETTE ⌘K — chercher n'importe quoi en quelques lettres, et lancer une action connue.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * H41 (LOT-00, v3). Elle ne se confond pas avec la palette d'Ajmani (⌘J) : celle-ci cherche et lance des actions
 * connues ; l'autre comprend des phrases libres. La première ligne de ce qu'on tape est donc toujours une porte vers
 * Ajmani, pour qu'une recherche ne soit jamais une impasse.
 *
 * Cinq bandes : le champ (avec « 9 résultats en 12 ms »), la portée (les puces « Tout 9 », « Actions 3 »…, ⇥ pour
 * passer de l'une à l'autre), le corps à deux volets (la liste groupée à gauche, l'aperçu de la ligne choisie à
 * droite), le pied. L'aperçu d'un client montre ses chiffres LUS dans les modules (`apercu.ts`) ; ce qui n'a pas de
 * source n'y est pas.
 *
 * `PaletteRecherche` est la pièce branchée : elle lit l'index réel, les sources de l'aperçu, la mémoire des
 * ouvertures et le réseau. `PaletteRechercheVue` est la même palette sans rien d'autre que ses propriétés — c'est
 * elle que le contrôle rend en HTML statique, et que l'aperçu de capture montre.
 *
 * Ce que l'hôte doit brancher (la navigation et Ajmani sont injectés, la palette n'a pas de routeur) :
 *   · ⌘K (ou Ctrl K) en phase de capture, avec `stopImmediatePropagation`, comme ⌘J : sinon l'ancienne palette
 *     de commandes s'ouvre aussi ;
 *   · le bouton « Rechercher » de la barre latérale ;
 *   · `surDemanderAjmani` (ouvre ⌘J ou lance la demande) et `surAllerA` (navigation).
 *
 * Le motif ARIA est celui du combobox : le focus reste dans le champ, `aria-activedescendant` désigne la ligne
 * choisie, les lignes sont des `option` d'une `listbox`, un `status` annonce le nombre de résultats, l'aperçu est
 * annoncé poliment. Le calque est fixe, à z-index 50 (`recherche.css`) : c'est ce que la pile des calques
 * reconnaît, et Échap ne ferme que lui. Pas de ⌘↵ : l'application n'a qu'une fenêtre, sans onglets.
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
  facture: Euro,
  document: FileText,
  decision: Scale,
  tache: SquareCheckBig,
  note: NotebookPen,
  message: MessageCircle,
};

const DELAI_FRAPPE = 120;
const DELAI_SQUELETTE = 200;
const LIGNES_SQUELETTE = 3;
/** Au-delà, la durée de la recherche ne se dit plus (« 9 résultats » seulement). */
const DUREE_MAX_AFFICHEE = 1000;

/** L'icône d'une page : celle de son module au catalogue. */
function iconeDePage(module: string | undefined): IconeComposant | undefined {
  return module ? NAV_ITEMS.find((i) => i.key === module)?.icon : undefined;
}

const horlogeParDefaut = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

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
  const sources = useSourcesApercu();
  const memoire = useMemoireRecherche();
  const horsLigne = !useEnLigne();
  const touche = useToucheModificatrice();
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

  /* L'aperçu se calcule à la demande, pour la ligne choisie seulement : l'heure est celle du moment où on la regarde. */
  const apercuDe = useCallback((ligne: LigneRecherche) => apercuDeCle(ligne.lie, sources, new Date()), [sources]);

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
      apercuDe={apercuDe}
      touche={touche}
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
  /** La ligne choisie au départ (son rang dans la liste) : à l'ouverture, la première. */
  choixInitial?: number;
  /** Le squelette est-il déjà visible ? (200 ms d'attente écoulées) */
  attenteEcoulee?: boolean;
  /** Absent : aucun mouvement (les tests). */
  animation?: NiveauMouvement;
  iconePage?: (module: string | undefined) => IconeComposant | undefined;
  /** Les chiffres de l'élément d'une ligne (`apercu.ts`) ; absent ou `null` : le volet dit ce que la ligne dit. */
  apercuDe?: (ligne: LigneRecherche) => Apercu | null;
  /** L'instant de référence de l'aperçu (« dans 18 min ») ; par défaut, maintenant. */
  maintenant?: Date;
  /** La touche des raccourcis : ⌘ sur macOS, Ctrl ailleurs. */
  touche?: '⌘' | 'Ctrl';
  /** Ce qui mesure la durée d'une recherche, en millisecondes (par défaut `performance.now`). */
  horloge?: () => number;
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
  choixInitial = 0,
  attenteEcoulee = false,
  animation,
  iconePage,
  apercuDe,
  maintenant,
  touche = 'Ctrl',
  horloge = horlogeParDefaut,
  onFermer,
  onExecuter,
  onReessayer,
}: PaletteRechercheVueProps) {
  const { langue, tm } = useMots();
  const { ts } = useSocleLangue();
  const idTitre = useId();
  const idListe = useId();
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const [texte, setTexte] = useState(texteInitial);
  const [appliquee, setAppliquee] = useState(texteInitial);
  const [actif, setActif] = useState(choixInitial);
  const [portee, setPortee] = useState<Portee>('tout');
  const [attendu, setAttendu] = useState(attenteEcoulee);
  const premierCalcul = useRef(true);

  /* Les résultats se recalculent 120 ms après la dernière frappe. */
  useEffect(() => {
    if (texte === appliquee) return undefined;
    const t = window.setTimeout(() => setAppliquee(texte), DELAI_FRAPPE);
    return () => window.clearTimeout(t);
  }, [texte, appliquee]);
  useEffect(() => {
    // Une nouvelle saisie repart de la première ligne et de « Tout » (pas au montage : le choix de départ tient).
    if (premierCalcul.current) {
      premierCalcul.current = false;
      return;
    }
    setActif(0);
    setPortee('tout');
  }, [appliquee]);

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
  /* La durée annoncée est celle de la requête elle-même (« 9 résultats en 12 ms »). */
  const { calcul, duree } = useMemo(() => {
    const debut = horloge();
    const r = calculer(appliquee);
    return { calcul: r, duree: Math.max(0, Math.round(horloge() - debut)) };
  }, [calculer, appliquee, horloge]);
  const reponse = calcul ?? REPONSE_VIDE;
  const erreurAffichee = erreur || calcul === null;

  const puces = useMemo(() => (pret ? pucesDePortee(reponse) : []), [pret, reponse]);
  const porteeValide: Portee = puces.some((p) => p.cle === portee) ? portee : 'tout';

  /* Index pas encore lu : les groupes qui en dépendent deviennent des squelettes (les actions, elles, sont déjà là). */
  const groupes = useMemo<GroupeAffiche[]>(() => {
    if (pret) return groupesDeLaPortee(reponse, porteeValide);
    if (reponse.mode === 'vide') return [...(attendu ? [{ id: 'recents' as const, squelette: true as const }] : []), ...reponse.groupes.filter((g) => g.id === 'actions')];
    if (reponse.mode === 'recherche') return [...reponse.groupes.filter((g) => g.id === 'actions'), ...(attendu ? [{ id: 'clients' as const, squelette: true as const }] : [])];
    return reponse.groupes;
  }, [pret, attendu, reponse, porteeValide]);

  const plat = useMemo(() => groupes.flatMap((g) => ('lignes' in g ? g.lignes : [])), [groupes]);
  const courante: LigneRecherche | undefined = plat[Math.min(actif, plat.length - 1)];
  const idOption = (i: number) => `${idListe}-${i}`;
  const indexCourant = courante ? plat.indexOf(courante) : -1;

  useEffect(() => {
    if (indexCourant < 0) return;
    document.getElementById(idOption(indexCourant))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexCourant, courante?.cle]);

  /* L'aperçu : les chiffres de l'élément de la ligne choisie, et ses actions rapides (lues dans l'index). */
  const apercu = useMemo(() => (courante && apercuDe ? apercuDe(courante) : null), [courante, apercuDe]);
  const entreeLiee = useMemo(() => (courante?.lie ? index.entrees.find((e) => e.cle === courante.lie) : undefined), [courante, index]);
  const rapides = useMemo(() => (entreeLiee ? actionsRapides(entreeLiee, contexte) : null), [entreeLiee, contexte]);

  const annonce = !pret ? '' : reponse.mode === 'recherche' && reponse.aucunResultat ? tm('annonce.aucun') : plat.length === 0 ? '' : tm(plat.length === 1 ? 'annonce.un' : 'annonce.n', { n: plat.length });
  let compteur = '';
  if (reponse.mode === 'recherche') {
    if (!pret) compteur = attendu ? tm('compteur.recherche') : '';
    else if (duree > DUREE_MAX_AFFICHEE) compteur = tm(reponse.total === 1 ? 'compteur.un.court' : 'compteur.n.court', { n: reponse.total });
    else compteur = tm(reponse.total === 1 ? 'compteur.un' : 'compteur.n', { n: reponse.total, ms: duree });
  }

  const changerPortee = (suivante: Portee) => {
    setPortee(suivante);
    setActif(0);
  };

  const surTouche = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const modif = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
    const lettre = e.key.toLowerCase();
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
    } else if (e.key === 'Tab' && puces.length > 1) {
      // ⇥ : la portée suivante (⇧⇥ : la précédente). Le focus reste dans le champ.
      e.preventDefault();
      changerPortee(porteeSuivante(puces, porteeValide, e.shiftKey));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (texte !== appliquee) {
        // La frappe n'a pas encore été recalculée : on lance la première ligne de CE qui est tapé, pas du texte d'avant.
        const ligne = calculer(texte)?.groupes.flatMap((g) => g.lignes)[0];
        if (ligne) onExecuter(ligne);
      } else if (courante) onExecuter(courante);
    } else if ((e.metaKey || e.ctrlKey) && lettre === 'k') {
      e.preventDefault();
      onFermer();
    } else if (modif && lettre === 'd' && rapides?.devis) {
      // Les raccourcis de l'aperçu ne valent que dans la palette (jamais déclarés globalement).
      e.preventDefault();
      onExecuter(rapides.devis);
    } else if (modif && lettre === 'e' && rapides?.ecrire) {
      e.preventDefault();
      onExecuter(rapides.ecrire);
    }
  };

  const effacer = () => {
    setTexte('');
    setAppliquee('');
    champ.current?.focus();
  };

  const etiquetteDe = (ligne: LigneRecherche): string | undefined => {
    if (ligne.nature) return tm(`nature.${ligne.nature}` as CleMot);
    if (ligne.enRetard) return tm('etat.retard');
    if (ligne.type === 'page' && ligne.famille !== 'ajmani') return ts(`famille.${ligne.famille}`);
    return ligne.type ? tm(`type.${ligne.type}` as CleMot) : undefined;
  };

  const raccourci = (lettre: string) => (touche === '⌘' ? `⌘${lettre}` : `${touche} ${lettre}`);

  let rang = -1;
  const contenu = (
    <>
      <h2 id={idTitre} className="sr-only">
        {tm('titre')}
      </h2>
      <div className="rc-champ">
        <Search size={18} strokeWidth={1.8} aria-hidden className="rc-champ__loupe" />
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
        {compteur && (
          <span aria-hidden className="rc-champ__compteur">
            {compteur}
          </span>
        )}
        <span aria-hidden className="rc-champ__echap">
          <Raccourci>{tm('echap')}</Raccourci>
        </span>
      </div>

      <div className="rc-portee">
        {puces.length > 0 && (
          <FilterChips
            libelle={tm('portee.libelle')}
            puces={puces.map((p) => ({ cle: p.cle, libelle: tm(`groupe.${p.cle}` as CleMot), compteur: p.compteur }))}
            valeur={porteeValide}
            onChange={(cle) => {
              changerPortee(cle as Portee);
              champ.current?.focus();
            }}
            className="rc-portee__puces"
          />
        )}
        {puces.length > 1 && (
          <span aria-hidden className="rc-portee__aide">
            <Raccourci>{tm('portee.touche')}</Raccourci>
            {tm('portee.changer')}
          </span>
        )}
      </div>

      <div className="rc-corps">
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
                        <Squelette largeur={26} hauteur={26} rayon={7} />
                        <Squelette largeur={`${62 - i * 9}%`} hauteur={12} />
                      </div>
                    ))}
                  </div>
                );
              }
              const idGroupe = `${idListe}-g-${g.id}`;
              const total = reponse.groupes.find((x) => x.id === g.id)?.lignes.length ?? g.lignes.length;
              return (
                <div key={g.id} role="group" aria-labelledby={idGroupe} className="rc-groupe">
                  <div className="rc-groupe__titre">
                    <span id={idGroupe}>{tm(`groupe.${g.id}` as CleMot)}</span>
                    {reponse.mode === 'recherche' && (
                      <span className="rc-groupe__compteur" title={tm('groupe.compteur', { n: total })}>
                        {total}
                      </span>
                    )}
                  </div>
                  {g.lignes.map((ligne) => {
                    rang += 1;
                    const i = rang;
                    return (
                      <LigneOption
                        key={ligne.cle}
                        id={idOption(i)}
                        ligne={ligne}
                        // La porte générique vers Ajmani répète la saisie : rien à y mettre en évidence.
                        saisie={reponse.mode === 'recherche' && !(ligne.nature === 'ajmani' && !ligne.lie) ? reponse.saisie : ''}
                        choisie={ligne === courante}
                        etiquette={etiquetteDe(ligne)}
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

        <section className="rc-apercu" aria-label={tm('apercu.titre')} aria-live="polite">
          {!pret && attendu ? (
            <ApercuSquelette />
          ) : courante ? (
            <VoletApercu
              key={courante.lie ?? courante.cle}
              ligne={courante}
              apercu={apercu}
              etiquette={etiquetteDe(courante)}
              iconePage={iconePage}
              rapides={rapides}
              maintenant={maintenant}
              raccourci={raccourci}
              onExecuter={onExecuter}
            />
          ) : null}
        </section>
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
  /* Ouverture 160 ms (fondu + 6 px de glissement), fermeture 100 ms. « Réduit » : le fondu seul. « Aucun » : rien. */
  const ouverture = animation === 'aucun' ? 0 : 0.16;
  const glisse = animation === 'complet' ? -6 : 0;
  return (
    <motion.div className="rc-voile" onMouseDown={surVoile} data-palette-recherche="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: animation === 'aucun' ? 0 : 0.1 } }} transition={{ duration: ouverture }}>
      <motion.div {...proprietesPalette} initial={{ opacity: 0, y: glisse }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 0, transition: { duration: animation === 'aucun' ? 0 : 0.1 } }} transition={{ duration: ouverture, ease: 'easeOut' }}>
        {contenu}
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────── Une ligne ─────────────────────────────── */

function LigneOption({
  id,
  ligne,
  saisie,
  choisie,
  etiquette,
  info,
  iconePage,
  onSurvol,
  onExecuter,
}: {
  id: string;
  ligne: LigneRecherche;
  saisie: string;
  choisie: boolean;
  etiquette?: string;
  info?: string;
  iconePage?: (module: string | undefined) => IconeComposant | undefined;
  onSurvol: () => void;
  onExecuter: () => void;
}) {
  const dernierePosition = useRef<string>('');
  const morceaux = useMemo(() => surligner(ligne.libelle, saisie), [ligne.libelle, saisie]);
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
      <Tuile ligne={ligne} iconePage={iconePage} />
      <span className="rc-ligne__libelle">
        {morceaux.map((m, i) => (m.trouve ? <mark key={i}>{m.texte}</mark> : <React.Fragment key={i}>{m.texte}</React.Fragment>))}
      </span>
      {etiquette && <span className="rc-ligne__type">{etiquette}</span>}
      {choisie && (
        <span aria-hidden className="rc-ligne__touche">
          <Raccourci>↵</Raccourci>
        </span>
      )}
    </div>
  );
}

/**
 * La tuile d'une ligne : `IconTile` du socle, aux cotes de l'image H41 (26 px, part de teinte 14 % ; l'aperçu : 42 px,
 * 18 %). L'action d'Ajmani est verte : la couleur d'un état réussi, la même que son étincelle.
 */
function Tuile({ ligne, iconePage, grande = false }: { ligne: LigneRecherche; iconePage?: (module: string | undefined) => IconeComposant | undefined; grande?: boolean }) {
  const Icone: IconeComposant | undefined = ligne.icone === 'ajmani' ? undefined : ligne.icone === 'page' ? (iconePage?.(ligne.module) ?? LayoutGrid) : ICONES[ligne.icone];
  const taille = grande ? 18 : 13;
  const ajmani = ligne.famille === 'ajmani';
  return (
    <IconTile
      className="rc-tuile"
      taille={grande ? 42 : 26}
      part={grande ? 18 : 14}
      famille={ligne.famille === 'ajmani' ? undefined : ligne.famille}
      ton={ajmani ? 'succes' : undefined}
      icone={Icone ? <Icone size={taille} strokeWidth={1.8} /> : <IconeEtincelle taille={taille} />}
    />
  );
}

/* ─────────────────────────────── L'aperçu ─────────────────────────────── */

function ApercuSquelette() {
  return (
    <div className="rc-apercu__corps" aria-hidden data-squelette="">
      <div className="rc-apercu__tete">
        <Squelette largeur={42} hauteur={42} rayon={10} />
        <Squelette largeur="50%" hauteur={14} />
      </div>
      <div className="rc-chiffres">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rc-chiffre">
            <Squelette largeur="60%" hauteur={10} />
            <Squelette largeur="80%" hauteur={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

type Langue = 'fr' | 'en';
const locale = (langue: Langue): string => (langue === 'en' ? 'en-GB' : 'fr-FR');
const moisCourt = (langue: Langue, mois: string): string => new Intl.DateTimeFormat(locale(langue), { month: 'short', timeZone: 'UTC' }).format(new Date(`${mois}-01T00:00:00Z`));
const moisLong = (langue: Langue, iso: string): string => new Intl.DateTimeFormat(locale(langue), { month: 'long', year: 'numeric' }).format(new Date(iso));
const heure = (langue: Langue, d: Date): string => new Intl.DateTimeFormat(locale(langue), { hour: '2-digit', minute: '2-digit' }).format(d);
const jourCourt = (langue: Langue, d: Date): string => new Intl.DateTimeFormat(locale(langue), { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
const euros = (centimes: number): string => formaterEuro(Math.round(centimes) / 100);

interface ActionRapide {
  id: string;
  libelle: string;
  icone: IconeComposant;
  touche?: string;
  ligne: LigneRecherche;
}

function IconeEtincelleComposant({ size = 14 }: { size?: number; strokeWidth?: number }) {
  return <IconeEtincelle taille={size} />;
}

function VoletApercu({
  ligne,
  apercu,
  etiquette,
  iconePage,
  rapides,
  maintenant,
  raccourci,
  onExecuter,
}: {
  ligne: LigneRecherche;
  apercu: Apercu | null;
  etiquette?: string;
  iconePage?: (module: string | undefined) => IconeComposant | undefined;
  rapides: ActionsRapides | null;
  maintenant?: Date;
  raccourci: (lettre: string) => string;
  onExecuter: (ligne: LigneRecherche) => void;
}) {
  const { langue, tm } = useMots();
  // L'aperçu montre l'élément de la ligne : elle-même, ou le client d'une action.
  const lui = rapides?.ouvrir ?? ligne;
  const sousTitre = apercu?.genre === 'client' && apercu.depuis ? tm('apercu.depuis', { mois: moisLong(langue, apercu.depuis) }) : rapides ? undefined : etiquette;

  const actions: ActionRapide[] = [];
  const estAjmani = ligne.nature === 'ajmani';
  if (rapides) {
    // L'action choisie elle-même (« Résumer l'historique… ») passe en tête quand ce n'est pas l'une des rapides.
    if (ligne.cle !== rapides.ouvrir.cle && ligne.cle !== rapides.devis?.cle && ligne.cle !== rapides.ecrire?.cle) {
      actions.push({ id: 'ligne', libelle: estAjmani ? tm('apercu.demander') : ligne.libelle, icone: estAjmani ? IconeEtincelleComposant : CornerDownRight, touche: '↵', ligne });
    }
    actions.push({ id: 'ouvrir', libelle: tm(rapides.ouvrir.type === 'client' ? 'apercu.ouvrirFiche' : 'apercu.ouvrir'), icone: ArrowRight, touche: ligne.cle === rapides.ouvrir.cle ? '↵' : undefined, ligne: rapides.ouvrir });
    if (rapides.devis) actions.push({ id: 'devis', libelle: tm('apercu.devis'), icone: FileText, touche: raccourci('D'), ligne: rapides.devis });
    if (rapides.ecrire) actions.push({ id: 'ecrire', libelle: tm('apercu.ecrire'), icone: Mail, touche: raccourci('E'), ligne: rapides.ecrire });
  } else {
    actions.push({ id: 'ligne', libelle: tm(estAjmani ? 'apercu.demander' : 'apercu.ouvrir'), icone: estAjmani ? IconeEtincelleComposant : ArrowRight, touche: '↵', ligne });
  }

  return (
    <div className="rc-apercu__corps">
      <div className="rc-apercu__tete">
        {apercu?.genre === 'client' ? (
          <span aria-hidden className="rc-apercu__monogramme" data-famille={lui.famille === 'ajmani' ? undefined : lui.famille}>
            {lui.libelle.trim().charAt(0).toUpperCase()}
          </span>
        ) : (
          <Tuile ligne={lui} iconePage={iconePage} grande />
        )}
        <div className="rc-apercu__nom">
          <p className="rc-apercu__titre">{lui.libelle}</p>
          {sousTitre && <p className="rc-apercu__sous">{sousTitre}</p>}
        </div>
      </div>

      {apercu?.genre === 'client' && <ChiffresClient apercu={apercu} maintenant={maintenant ?? new Date()} />}
      {apercu?.genre === 'facture' && <ChiffresFacture apercu={apercu} />}

      <div className="rc-rapides" role="group" aria-label={tm('apercu.actions')} data-impair={actions.length % 2 === 1 || undefined}>
        {actions.map((a) => (
          <button key={a.id} type="button" tabIndex={-1} className="rc-rapide" onMouseDown={(e) => e.preventDefault()} onClick={() => onExecuter(a.ligne)}>
            <span aria-hidden className="rc-rapide__icone">
              <a.icone size={14} strokeWidth={1.8} />
            </span>
            <span className="rc-rapide__libelle">{a.libelle}</span>
            {a.touche && <Raccourci>{a.touche}</Raccourci>}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChiffresClient({ apercu, maintenant }: { apercu: ApercuClient; maintenant: Date }) {
  const { langue, tm } = useMots();
  const rdv = apercu.rendezVous ? new Date(apercu.rendezVous) : null;
  let rdvValeur = '—';
  let rdvDetail = tm('apercu.rdv.aucun');
  if (rdv) {
    const minutes = Math.round((rdv.getTime() - maintenant.getTime()) / 60000);
    if (jourIso(rdv) === jourIso(maintenant)) {
      rdvValeur = heure(langue, rdv);
      rdvDetail = minutes < 60 ? tm('apercu.rdv.min', { n: Math.max(0, minutes) }) : tm('apercu.rdv.heures', { n: Math.floor(minutes / 60) });
    } else {
      rdvValeur = jourCourt(langue, rdv);
      rdvDetail = tm('apercu.rdv.jour', { heure: heure(langue, rdv) });
    }
  }
  const precedente = apercu.annee - 1;
  const evolution =
    apercu.evolution === null
      ? tm('apercu.evolution.aucune', { annee: precedente })
      : tm('apercu.evolution', { pourcent: `${apercu.evolution > 0 ? '+' : ''}${formaterPourcent(apercu.evolution, { decimales: 0 })}`, annee: precedente });
  const tonEvolution = apercu.evolution === null ? 'neutre' : apercu.evolution >= 0 ? 'succes' : 'critique';
  const courbe = tm('apercu.courbe', { n: apercu.courbe.valeurs.length });

  return (
    <>
      <div className="rc-chiffres">
        <Chiffre libelle={tm('apercu.facture', { annee: apercu.annee })} valeur={euros(apercu.factureCentimes)} detail={evolution} ton={tonEvolution} />
        <Chiffre
          libelle={tm('apercu.retard')}
          valeur={euros(apercu.retard?.centimes ?? 0)}
          detail={apercu.retard ? tm(apercu.retard.jours === 1 ? 'apercu.retard.un' : 'apercu.retard.n', { numero: apercu.retard.numero, n: apercu.retard.jours }) : tm('apercu.retard.aucun')}
          ton={apercu.retard ? 'attention' : 'neutre'}
        />
        <Chiffre libelle={tm('apercu.rdv')} valeur={rdvValeur} detail={rdvDetail} ton={rdv ? 'info' : 'neutre'} />
      </div>

      <div className="rc-courbe">
        <div className="rc-courbe__tete">
          <span>{courbe}</span>
          <span className="rc-courbe__mois">{tm('apercu.courbe.mois', { debut: moisCourt(langue, apercu.courbe.premier), fin: moisCourt(langue, apercu.courbe.dernier) })}</span>
        </div>
        <MiniCourbe valeurs={apercu.courbe.valeurs.map((c) => c / 100)} libelle={courbe} ton="contacts" largeur={380} hauteur={40} formater={(v) => formaterEuro(v)} className="rc-courbe__trace" />
      </div>

      <div className="rc-activite">
        <p className="rc-activite__titre">{tm('apercu.activite')}</p>
        {apercu.activite.length === 0 ? (
          <p className="rc-activite__vide">{tm('apercu.activite.aucune')}</p>
        ) : (
          <ul className="rc-activite__liste">
            {apercu.activite.map((f, i) => (
              <LigneFait key={`${f.genre}-${f.le}-${i}`} fait={f} maintenant={maintenant} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function LigneFait({ fait, maintenant }: { fait: FaitActivite; maintenant: Date }) {
  const { langue, tm } = useMots();
  const d = new Date(fait.heure ? fait.le : `${fait.le.slice(0, 10)}T12:00:00`);
  const ecart = joursEntre(fait.heure ? jourIso(d) : fait.le.slice(0, 10), jourIso(maintenant));
  let quand: string;
  if (fait.heure && ecart === 0) quand = heure(langue, d);
  else if (ecart === 0) quand = tm('apercu.jour.aujourdhui');
  else if (ecart === 1) quand = tm('apercu.jour.hier');
  else quand = new Intl.DateTimeFormat(locale(langue), { day: 'numeric', month: 'short' }).format(d);
  const texte = fait.genre === 'evenement' ? fait.titre : tm(fait.genre === 'encaissement' ? 'apercu.fait.encaissement' : 'apercu.fait.emission', { numero: fait.numero, montant: euros(fait.montantCentimes) });
  const Icone = fait.genre === 'evenement' ? Flag : fait.genre === 'encaissement' ? Euro : ReceiptEuro;
  return (
    <li className="rc-fait" data-genre={fait.genre}>
      <span className="rc-fait__quand sc-mono">{quand}</span>
      <span aria-hidden className="rc-fait__icone">
        <Icone size={13} strokeWidth={1.8} />
      </span>
      <span className="rc-fait__texte">{texte}</span>
    </li>
  );
}

function ChiffresFacture({ apercu }: { apercu: ApercuFacture }) {
  const { langue, tm } = useMots();
  const etat = apercu.etat === 'retard' ? tm(apercu.jours === 1 ? 'apercu.etat.retard.un' : 'apercu.etat.retard.n', { n: apercu.jours }) : tm(`apercu.etat.${apercu.etat}` as CleMot);
  const echeance = apercu.echeance ? new Intl.DateTimeFormat(locale(langue), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${apercu.echeance.slice(0, 10)}T00:00:00Z`)) : '—';
  return (
    <div className="rc-chiffres">
      <Chiffre libelle={tm('apercu.montant')} valeur={euros(apercu.totalCentimes)} detail={apercu.resteDuCentimes > 0 ? tm('apercu.reste', { montant: euros(apercu.resteDuCentimes) }) : tm('apercu.solde')} ton="neutre" />
      <Chiffre libelle={tm('apercu.echeance')} valeur={echeance} ton="neutre" texte />
      <Chiffre libelle={tm('apercu.etat')} valeur={etat} ton={apercu.etat === 'retard' ? 'attention' : apercu.etat === 'payee' ? 'succes' : 'neutre'} texte />
    </div>
  );
}

function Chiffre({ libelle, valeur, detail, ton, texte = false }: { libelle: string; valeur: string; detail?: string; ton: 'succes' | 'attention' | 'critique' | 'info' | 'neutre'; texte?: boolean }) {
  return (
    <div className="rc-chiffre">
      <span className="rc-chiffre__libelle">{libelle}</span>
      <span className="rc-chiffre__valeur" data-texte={texte || undefined}>
        {valeur}
      </span>
      {detail && (
        <span className="rc-chiffre__detail" data-ton={ton}>
          {detail}
        </span>
      )}
    </div>
  );
}
