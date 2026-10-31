import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CalendarDays, Clock, ExternalLink, FileText, ListChecks, MessageSquare, Phone, Plus, Receipt, Search, Send, Shield, StickyNote, User, WifiOff, type LucideIcon } from 'lucide-react';
import { Bouton } from '../../../socle/ui/Bouton';
import { PastilleEtat, Raccourci } from '../../../socle/ui/Pastilles';
import { IconeEtincelle } from '../../../socle/ui/controles';
import { useFermetureEchap } from '../../../lib/useFermetureEchap';
import { useMots, traduire, type CleMot } from './i18n';
import {
  analyser, etatDeRepos, segmenter,
  type BoutonProposition, type ContexteAjmani, type DonneesAjmani, type Effet, type Env, type IconeAjmani, type Mots, type Phrase, type Reponse, type Segment,
} from './intentions';
import { lignesLancer, type LigneLancer } from './lancer';
import { CHAMP, deplacer, indiceValide, type Cible } from './navigation';
import { DELAI_ANNULATION_MS, DelaiAnnulation, peutExecuter, permisHorsLigne, type OrigineGeste } from './niveaux';
import { DELAI_PROPOSITION_MS, DELAI_SQUELETTE_MS, DUREE_FERMETURE_MS, attenteAvantReponse, decisionEchap, etatAffiche } from './etat';
import { ajouterDemande, ecartEnJours, effacerHistorique, garderTexte, lireHistorique, lireUsage, noterUsage, oublierTexte, reprendreTexte, demandePrecedente, type Demande, type Usage } from './historique';
import { corrigerResultat, noterAction, type ResultatAction } from './journal';
import type { ActionsAjmani } from './useActionsAjmani';
import './palette.css';

/**
 * LA PALETTE ⌘J D'AJMANI — G05 : « Ajmani, palette ⌘J ouverte ».
 *
 * Un champ, une proposition, quatre lignes « Ou lancez », une aide au clavier. Ajmani n'a ni visage ni avatar : sa
 * seule marque est son nom et l'étincelle verte. Le ton est celui de la charte (vouvoiement, phrases courtes,
 * chiffres exacts, jamais de point d'exclamation).
 *
 * LA RÈGLE D'OR. Entrée dans le champ ne confirme jamais un N1, N2 ou N3 : elle demande une proposition. Seul un
 * clic (ou Entrée) sur le bouton primaire de la proposition exécute. Les faits (numéro, montant, jours de retard)
 * viennent des données qu'on passe, jamais d'un modèle ; ce que l'analyseur ne comprend pas, `surDemander` le
 * confie à l'assistant existant. Le détail des niveaux : `niveaux.ts` ; l'analyse : `intentions.ts`.
 *
 * Le calque est fixe, z-index 50 : la pile des calques (`pileCalques.ts`) le reconnaît, y tient Échap (un premier
 * Échap annule une requête en cours, un second ferme) et y enferme la tabulation. Le focus entre dans le champ à
 * l'ouverture et revient à ce qui l'avait à la fermeture.
 *
 * Le motif ARIA est celui du « combobox » : le focus reste dans le champ, `aria-activedescendant` désigne la ligne
 * choisie ; quand la sélection est sur un bouton de la proposition, le focus passe sur ce bouton.
 */

/** Le contexte que l'appelant passe : l'écran, les droits, la connexion, le compte. */
export type ContextePalette = ContexteAjmani;

/** Un analyseur peut répondre tout de suite, ou plus tard (une requête) : le squelette de réflexion couvre l'attente. */
export type Analyseur = (texte: string, env: Env) => Reponse | null | Promise<Reponse | null>;

export interface PaletteAjmaniRefonteProps {
  ouverte: boolean;
  onFermer: () => void;
  contexte: ContextePalette;
  donnees: DonneesAjmani;
  /** « Demander à Ajmani » : confie le texte à l'assistant existant. */
  surDemander: (texte: string) => void;
  surAllerA: (route: string, state?: Record<string, unknown>) => void;
  /** « Voir tous les résultats » : ouvre la recherche (⌘K). */
  surOuvrirRecherche: () => void;
  /** Les écritures que la palette sait faire (un brouillon de facture). Sans elles, « Modifier » ouvre le module. */
  actions?: ActionsAjmani;
  /** Par défaut : l'analyseur local. */
  analyseur?: Analyseur;
}

const ICONES: Record<IconeAjmani, LucideIcon> = {
  plus: Plus, loupe: Search, bouclier: Shield, document: FileText, envoi: Send, fleche: ArrowRight, horloge: Clock, liste: ListChecks,
  ouvrir: ExternalLink, utilisateur: User, appel: Phone, message: MessageSquare, agenda: CalendarDays, note: StickyNote, facture: Receipt,
};

function Icone({ nom, taille = 16 }: { nom: IconeAjmani; taille?: number }) {
  const C = ICONES[nom];
  return <C size={taille} aria-hidden strokeWidth={1.8} />;
}

/** ⌘ sur macOS, Ctrl ailleurs. */
function toucheModificatrice(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /mac/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
}

const estThenable = (x: unknown): x is Promise<Reponse | null> => typeof x === 'object' && x !== null && typeof (x as { then?: unknown }).then === 'function';

/** Ce que la palette garde pour piloter Échap : une requête est-elle en cours, et comment l'annuler. */
interface PiloteRequete {
  enCours: boolean;
  annuler: () => void;
}

/* ═══ La palette : montée en portail, avec ses animations d'ouverture et de fermeture ═══ */

export function PaletteAjmaniRefonte(props: PaletteAjmaniRefonteProps) {
  const { ouverte, onFermer } = props;
  const [monte, setMonte] = useState(ouverte);
  const [sortie, setSortie] = useState(false);
  const pilote = useRef<PiloteRequete>({ enCours: false, annuler: () => undefined });
  const champ = useRef<HTMLInputElement>(null);
  const retour = useRef<HTMLElement | null>(null);

  // Échap : une requête en cours d'abord, la palette ensuite.
  useFermetureEchap(ouverte, () => {
    if (decisionEchap(pilote.current.enCours) === 'annuler-requete') pilote.current.annuler();
    else onFermer();
  });

  // Le focus entre dans le champ, et revient à l'élément qui l'avait. L'élément précédent est relevé AVANT de
  // poser le focus dans le champ (pas d'`autoFocus` : il passerait devant).
  useEffect(() => {
    if (!ouverte) return undefined;
    const actif = document.activeElement;
    retour.current = actif instanceof HTMLElement && actif !== document.body ? actif : null;
    champ.current?.focus({ preventScroll: true });
    return () => {
      const cible = retour.current;
      retour.current = null;
      if (cible?.isConnected) cible.focus({ preventScroll: true });
    };
  }, [ouverte]);

  // Monter à l'ouverture ; à la fermeture, rester le temps de l'animation (120 ms) puis retirer.
  const dejaOuverte = useRef(ouverte);
  useEffect(() => {
    if (ouverte) {
      dejaOuverte.current = true;
      setMonte(true);
      setSortie(false);
      return undefined;
    }
    if (!dejaOuverte.current) return undefined;
    setSortie(true);
    const id = window.setTimeout(() => {
      setMonte(false);
      setSortie(false);
    }, DUREE_FERMETURE_MS);
    return () => window.clearTimeout(id);
  }, [ouverte]);

  if (typeof document === 'undefined' || (!ouverte && !monte)) return null;
  return createPortal(<ContenuPalette {...props} sortie={sortie && !ouverte} champ={champ} pilote={pilote} />, document.body);
}

/* ═══ Le contenu ═══ */

interface LigneUI {
  id: string;
  titre: string;
  sous?: string;
  icone: IconeAjmani;
  groupe?: string;
  jour?: string;
  desactivee?: boolean;
  /** « Réservé aux administrateurs » : dit en sous-titre, sans bouton. */
  reservee?: boolean;
  surActiver: () => void;
}

interface BoutonUI {
  id: string;
  role: 'primaire' | 'secondaire' | 'annuler';
  libelle: string;
  icone?: IconeAjmani;
  desactive?: boolean;
  raison?: string;
  surActiver: (origine: OrigineGeste) => void;
}

interface Vue {
  /** `data-vue` : ce que la palette montre dans sa deuxième bande. */
  mode: 'repos' | 'reponse' | 'reflexion' | 'erreur' | 'resultat';
  section: string;
  phrase: Segment[];
  details: string[];
  pastille?: { etat: 'succes' | 'attention' | 'critique' | 'neutre'; libelle: string };
  lignes: LigneUI[];
  boutons: BoutonUI[];
  /** Une ligne d'état sous les boutons (le compte à rebours de l'annulation). */
  etat?: string;
  effacerHistorique?: boolean;
}

type Resultat =
  | { type: 'brouillon'; client: string; factureId: string; delai: DelaiAnnulation; secondes: number; etat: 'en-cours' | 'ecoule' | 'annule'; idJournal: string }
  | { type: 'copie'; ok: boolean }
  | { type: 'echec' };

/** L'état de départ d'une palette — pour les contrôles et les captures, qui ne veulent pas attendre l'analyse. */
export interface EtatInitial {
  texte?: string;
  reponse?: Reponse | null;
  enCours?: boolean;
  squelette?: boolean;
  erreur?: 'analyse' | 'action' | null;
}

function ContenuPalette({
  ouverte,
  onFermer,
  contexte,
  donnees,
  surDemander,
  surAllerA,
  surOuvrirRecherche,
  actions,
  analyseur = analyser,
  sortie,
  champ,
  pilote,
  initial,
}: PaletteAjmaniRefonteProps & { sortie: boolean; champ: React.RefObject<HTMLInputElement | null>; pilote: React.RefObject<PiloteRequete>; initial?: EtatInitial }) {
  const { langue } = useMots();
  const mots = useMemo<Mots>(() => (cle, params) => traduire(langue, cle, params), [langue]);
  const tm = mots;
  /** Une phrase de l'analyseur, ses faits en gras : le gabarit est traduit SANS ses paramètres, qui se placent ensuite. */
  const dire = (p: Phrase): Segment[] => segmenter(tm(p.cle), p.params, p.gras);
  const idBase = useId();
  const idListeReponse = `${idBase}-reponse`;
  const idListeLancer = `${idBase}-lancer`;
  const idOption = (id: string) => `${idBase}-o-${id}`;
  const email = contexte.email ?? '';
  const horsLigne = !contexte.enLigne;

  const [texte, setTexte] = useState(() => initial?.texte ?? reprendreTexte(Date.now()));
  const [reponse, setReponse] = useState<Reponse | null>(initial?.reponse ?? null);
  const [enCours, setEnCours] = useState(initial?.enCours ?? false);
  const [squelette, setSquelette] = useState(initial?.squelette ?? false);
  const [erreur, setErreur] = useState<'analyse' | 'action' | null>(initial?.erreur ?? null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [index, setIndex] = useState(CHAMP);
  const [historique, setHistorique] = useState<Demande[]>(() => lireHistorique(email, Date.now()));
  const [usage, setUsage] = useState<Usage>(() => lireUsage(email));
  const [rappel, setRappel] = useState<number | null>(null);

  const requete = useRef(0);
  const minuteurSquelette = useRef<number | null>(null);
  const squeletteDepuis = useRef<number | null>(null);
  /** La demande dont une requête est en vol : la même frappe ne la relance pas. */
  const enVol = useRef<string | null>(null);
  const reponseCourante = useRef<Reponse | null>(null);
  const texteCourant = useRef(texte);
  const termine = useRef(false);
  const dernierEffet = useRef<(() => void) | null>(null);
  const boutonsDom = useRef(new Map<string, HTMLButtonElement>());
  texteCourant.current = texte;
  reponseCourante.current = reponse;

  const env = useMemo<Env>(() => ({ donnees, contexte, mots }), [donnees, contexte, mots]);
  const envRef = useRef(env);
  envRef.current = env;
  const analyseurRef = useRef(analyseur);
  analyseurRef.current = analyseur;

  /* ── Préparer une proposition ── */

  const finirAttente = useCallback(() => {
    if (minuteurSquelette.current !== null) window.clearTimeout(minuteurSquelette.current);
    minuteurSquelette.current = null;
    squeletteDepuis.current = null;
    enVol.current = null;
    pilote.current.enCours = false;
    setEnCours(false);
    setSquelette(false);
  }, [pilote]);

  const annulerRequete = useCallback(() => {
    requete.current += 1;
    finirAttente();
  }, [finirAttente]);

  const lancer = useCallback(
    (demande: string) => {
      const numero = ++requete.current;
      finirAttente();
      setErreur(null);
      setResultat(null);
      let sortieAnalyse: ReturnType<Analyseur>;
      try {
        sortieAnalyse = analyseurRef.current(demande, envRef.current);
      } catch {
        setErreur('analyse');
        return;
      }
      if (!estThenable(sortieAnalyse)) {
        setReponse(sortieAnalyse);
        setIndex(CHAMP);
        return;
      }
      // Une requête : le squelette n'apparaît qu'après 150 ms, et reste au moins 400 ms (pas de clignotement).
      pilote.current.enCours = true;
      enVol.current = demande;
      setEnCours(true);
      minuteurSquelette.current = window.setTimeout(() => {
        if (numero !== requete.current) return;
        squeletteDepuis.current = Date.now();
        setSquelette(true);
      }, DELAI_SQUELETTE_MS);
      sortieAnalyse
        .then(async (r) => {
          if (numero !== requete.current) return;
          const attente = attenteAvantReponse(squeletteDepuis.current, Date.now());
          if (attente > 0) await new Promise<void>((fin) => window.setTimeout(fin, attente));
          if (numero !== requete.current) return;
          finirAttente();
          setReponse(r);
          setIndex(CHAMP);
        })
        .catch(() => {
          if (numero !== requete.current) return;
          finirAttente();
          setErreur('analyse');
        });
    },
    [finirAttente, pilote],
  );

  // Échap annule la requête en cours.
  useEffect(() => {
    const p = pilote.current;
    p.annuler = annulerRequete;
    return () => {
      p.annuler = () => undefined;
      p.enCours = false;
    };
  }, [annulerRequete, pilote]);

  // Après 250 ms sans frappe, une proposition. Entre deux frappes, l'ancienne reste affichée : rien ne clignote.
  useEffect(() => {
    const demande = texte.trim();
    if (!demande) {
      annulerRequete();
      setReponse(null);
      setErreur(null);
      setResultat(null);
      return undefined;
    }
    if (reponseCourante.current?.pour === demande || enVol.current === demande) return undefined;
    const id = window.setTimeout(() => lancer(demande), DELAI_PROPOSITION_MS);
    return () => window.clearTimeout(id);
  }, [texte, lancer, annulerRequete]);

  // Ce qui reste à la fermeture : le texte non envoyé (30 s), les minuteurs défaits.
  useEffect(
    () => () => {
      if (termine.current) oublierTexte();
      else garderTexte(texteCourant.current, Date.now());
      requete.current += 1;
      if (minuteurSquelette.current !== null) window.clearTimeout(minuteurSquelette.current);
    },
    [],
  );

  /* ── Ce qui s'exécute ── */

  const noter = useCallback(
    (fait: string, niveau: Reponse['niveau'], resultatAction: ResultatAction) =>
      noterAction(email, { demande: texteCourant.current.trim() || fait, fait, niveau, resultat: resultatAction }, Date.now()),
    [email],
  );

  const retenirDemande = useCallback(
    (demande: string) => {
      if (demande.trim()) setHistorique(ajouterDemande(email, demande, Date.now()));
    },
    [email],
  );

  const poserTexte = useCallback(
    (nouveau: string) => {
      setTexte(nouveau);
      setRappel(null);
      setIndex(CHAMP);
      if (nouveau.trim()) {
        retenirDemande(nouveau);
        lancer(nouveau.trim());
      }
      champ.current?.focus({ preventScroll: true });
    },
    [champ, lancer, retenirDemande],
  );

  const fermerApres = useCallback(() => {
    termine.current = true;
    onFermer();
  }, [onFermer]);

  const executer = useCallback(
    (effet: Effet, niveau: Reponse['niveau'], origine: OrigineGeste) => {
      if (!peutExecuter(niveau, origine)) return;
      if (horsLigne && !permisHorsLigne(niveau)) return;
      const demande = texteCourant.current;
      switch (effet.type) {
        case 'aller': {
          retenirDemande(demande);
          const facture = typeof effet.state?.factureId === 'string' ? donnees.factures.find((f) => f.id === effet.state?.factureId) : undefined;
          noter(facture ? tm('journal.relance', { numero: facture.numero }) : tm('journal.ouvrir', { route: effet.route }), niveau, 'reussi');
          surAllerA(effet.route, effet.state);
          fermerApres();
          break;
        }
        case 'texte':
          poserTexte(effet.texte);
          break;
        case 'demander':
          retenirDemande(demande);
          noter(tm('journal.demande'), niveau, 'reussi');
          surDemander(effet.texte);
          fermerApres();
          break;
        case 'rechercher':
          retenirDemande(demande);
          noter(tm('journal.recherche'), niveau, 'reussi');
          surOuvrirRecherche();
          fermerApres();
          break;
        case 'effacer':
          setTexte('');
          setRappel(null);
          setIndex(CHAMP);
          champ.current?.focus({ preventScroll: true });
          break;
        case 'copier': {
          const ecrire = typeof navigator !== 'undefined' && navigator.clipboard?.writeText ? navigator.clipboard.writeText(effet.texte) : Promise.reject(new Error('indisponible'));
          ecrire.then(
            () => {
              noter(tm('journal.copie'), niveau, 'reussi');
              setResultat({ type: 'copie', ok: true });
            },
            () => setResultat({ type: 'copie', ok: false }),
          );
          break;
        }
        case 'creer-brouillon-facture': {
          retenirDemande(demande);
          if (!actions?.creerBrouillonFacture) {
            // Pas d'écriture branchée : « Créer le brouillon » ouvre la facturation, rien n'est créé.
            noter(tm('journal.ouvrir', { route: '/facturation' }), niveau, 'reussi');
            surAllerA('/facturation', { nouvelleFacture: { clientId: effet.clientId } });
            fermerApres();
            break;
          }
          const fait = actions.creerBrouillonFacture({ clientId: effet.clientId, clientNom: effet.clientNom, lignes: effet.lignes });
          if (!fait) {
            noter(tm('journal.brouillonEchec', { client: effet.clientNom }), niveau, 'echec');
            setErreur('action');
            dernierEffet.current = () => executer(effet, niveau, 'bouton-clic');
            break;
          }
          const ecriture = noter(tm('journal.brouillon', { client: effet.clientNom }), niveau, 'reussi');
          // N1 : « Annuler » défait le brouillon pendant 10 s.
          const delai = new DelaiAnnulation({
            dureeMs: DELAI_ANNULATION_MS,
            surTic: (secondes) => setResultat((r) => (r?.type === 'brouillon' ? { ...r, secondes } : r)),
            surEcoulement: () => setResultat((r) => (r?.type === 'brouillon' ? { ...r, etat: 'ecoule' } : r)),
            surAnnulation: () => {
              fait.defaire();
              corrigerResultat(email, ecriture.id, 'annule');
              setResultat((r) => (r?.type === 'brouillon' ? { ...r, etat: 'annule' } : r));
            },
          });
          setResultat({ type: 'brouillon', client: effet.clientNom, factureId: fait.id, delai, secondes: DELAI_ANNULATION_MS / 1000, etat: 'en-cours', idJournal: ecriture.id });
          delai.demarrer();
          break;
        }
      }
    },
    [actions, champ, donnees.factures, email, fermerApres, horsLigne, noter, poserTexte, retenirDemande, surAllerA, surDemander, surOuvrirRecherche, tm],
  );

  // Le délai d'annulation ne survit pas à la palette.
  const delaiEnCours = resultat?.type === 'brouillon' ? resultat.delai : null;
  useEffect(() => () => delaiEnCours?.abandonner(), [delaiEnCours]);

  /* ── Ce que la palette montre ── */

  const afficheRepos = !texte.trim();
  const repos = useMemo(
    () => (afficheRepos ? etatDeRepos({ donnees, contexte, historique, mots }) : null),
    [afficheRepos, donnees, contexte, historique, mots],
  );
  const courante: Reponse | null = afficheRepos ? repos : reponse;
  const maintenant = Date.now();

  const boutonUI = (b: BoutonProposition, niveau: Reponse['niveau']): BoutonUI => {
    const bloque = horsLigne && !permisHorsLigne(niveau) && b.role === 'primaire';
    return {
      id: b.id,
      role: b.role,
      libelle: tm(b.cle, b.params),
      icone: b.icone,
      desactive: bloque,
      raison: bloque ? tm('horsligne.raison') : undefined,
      surActiver: (origine) => executer(b.effet, b.role === 'primaire' ? niveau : 'N0', origine),
    };
  };

  const vue: Vue = (() => {
    if (erreur) {
      return {
        mode: 'erreur',
        section: tm('section.propose'),
        phrase: segmenter(tm(erreur === 'action' ? 'erreur.action' : 'erreur.reponse')),
        details: [],
        lignes: [],
        boutons: [
          {
            id: 'reessayer',
            role: 'secondaire',
            libelle: tm('bouton.reessayer'),
            icone: undefined,
            surActiver: () => {
              setErreur(null);
              if (erreur === 'action' && dernierEffet.current) dernierEffet.current();
              else lancer(texte.trim());
            },
          },
        ],
      };
    }
    if (resultat) {
      if (resultat.type === 'brouillon') {
        const enAttente = resultat.etat === 'en-cours';
        return {
          mode: 'resultat',
          section: tm('section.propose'),
          phrase: segmenter(tm(resultat.etat === 'annule' ? 'resultat.annule' : 'resultat.brouillon'), { client: resultat.client }, ['client']),
          details: [],
          lignes: [],
          etat: enAttente ? tm('delai.brouillon', { n: resultat.secondes }) : undefined,
          boutons: [
            ...(resultat.etat === 'annule'
              ? []
              : [{ id: 'voir', role: 'primaire' as const, libelle: tm('resultat.voir'), icone: 'facture' as const, surActiver: () => { surAllerA('/facturation', { openInvoiceId: resultat.factureId }); fermerApres(); } }]),
            ...(enAttente ? [{ id: 'defaire', role: 'secondaire' as const, libelle: tm('bouton.annuler'), surActiver: () => { resultat.delai.annuler(); } }] : []),
          ],
        };
      }
      if (resultat.type === 'copie') {
        return { mode: 'resultat', section: tm('section.propose'), phrase: segmenter(tm(resultat.ok ? 'resultat.copie' : 'resultat.copieEchec')), details: [], lignes: [], boutons: [] };
      }
    }
    if (enCours) {
      return { mode: 'reflexion', section: tm('section.propose'), phrase: [], details: [], lignes: [], boutons: [] };
    }
    if (!courante) {
      return { mode: 'repos', section: tm('section.propose'), phrase: [], details: [], lignes: [], boutons: [] };
    }
    const lignes: LigneUI[] = courante.lignes.map((l) => ({
      id: l.id,
      titre: l.titre ?? (l.titreCle ? tm(l.titreCle, l.titreParams) : ''),
      sous: l.sous ?? (l.sousCle ? tm(l.sousCle) : undefined),
      icone: l.icone,
      groupe: l.groupe ? tm(`groupe.${l.groupe}` as CleMot) : undefined,
      jour: courante.genre === 'vide-recent' ? jourDe(historique.find((d) => d.texte === l.titre), maintenant, langue, tm) : undefined,
      surActiver: () => executer(l.effet, 'N0', 'ligne-entree'),
    }));
    return {
      mode: afficheRepos ? 'repos' : 'reponse',
      section: tm(courante.section),
      phrase: courante.genre === 'vide-recent' ? [] : [...dire(courante.phrase), ...(courante.complement ? [{ texte: ' ', gras: false }, ...dire(courante.complement)] : [])],
      details: courante.details,
      pastille: courante.pastille ? { etat: courante.pastille.etat, libelle: tm(courante.pastille.cle) } : undefined,
      lignes,
      boutons: courante.boutons.map((b) => boutonUI(b, courante.niveau)),
      effacerHistorique: courante.genre === 'vide-recent',
    };
  })();

  /* ── Les lignes « Ou lancez » ── */

  const lancer4 = useMemo(
    () => lignesLancer({ famille: contexte.famille, usage, texte, libelle: (cle) => traduire(langue, cle) }),
    [contexte.famille, usage, texte, langue],
  );
  const activerLigneLancer = (l: LigneLancer) => {
    if (l.reservee && !contexte.admin) return;
    setUsage(noterUsage(email, l.id));
    if (l.effet.type === 'texte') poserTexte(tm(l.effet.cle));
    else if (l.effet.type === 'aller') executer({ type: 'aller', route: l.effet.route }, 'N0', 'ligne-entree');
    else executer({ type: 'demander', texte: tm(l.effet.cle) }, 'N0', 'ligne-entree');
  };

  /* ── Le parcours au clavier ── */

  const lignesDeLaReponse = vue.mode === 'reponse' || vue.mode === 'repos' ? vue.lignes : [];
  const cibles = useMemo<Cible[]>(
    () => [
      ...lignesDeLaReponse.map((l) => ({ zone: 'reponse' as const, id: l.id })),
      ...(vue.effacerHistorique ? [{ zone: 'lien' as const, id: 'effacer-historique' }] : []),
      ...vue.boutons.map((b) => ({ zone: 'bouton' as const, id: b.id, desactivee: b.desactive })),
      ...lancer4.map((l) => ({ zone: 'lancer' as const, id: l.id, desactivee: l.reservee && !contexte.admin })),
    ],
    // `vue` est reconstruite à chaque rendu : on ne dépend que de ce qui change les cibles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lignesDeLaReponse.map((l) => l.id).join('|'), vue.effacerHistorique, vue.boutons.map((b) => `${b.id}${b.desactive ? '!' : ''}`).join('|'), lancer4, contexte.admin],
  );
  const actif = indiceValide(cibles, index);
  const cible = actif >= 0 ? cibles[actif] : null;

  // Le focus suit la sélection : sur le bouton choisi, sinon dans le champ (la ligne choisie s'annonce par aria-activedescendant).
  const idCible = cible ? `${cible.zone}:${cible.id}` : '';
  useEffect(() => {
    if (cible?.zone === 'bouton' || cible?.zone === 'lien') boutonsDom.current.get(cible.id)?.focus({ preventScroll: true });
    else if (document.activeElement !== champ.current && champ.current && document.activeElement?.closest('.ajp-palette')) champ.current.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCible]);

  // Le focus ne sort pas de la palette : un bouton qui disparaît (« Annuler », « Réessayer ») le rend au champ.
  useEffect(() => {
    if (!ouverte || sortie) return;
    const racine = champ.current?.closest('.ajp-palette');
    if (racine && !racine.contains(document.activeElement)) champ.current?.focus({ preventScroll: true });
  });

  const effacerLHistorique = () => {
    effacerHistorique(email);
    setHistorique([]);
    setIndex(CHAMP);
  };

  const activerCible = (c: Cible) => {
    if (c.zone === 'lien') effacerLHistorique();
    else if (c.zone === 'reponse') vue.lignes.find((l) => l.id === c.id)?.surActiver();
    else if (c.zone === 'lancer') {
      const l = lancer4.find((x) => x.id === c.id);
      if (l) activerLigneLancer(l);
    }
  };

  const surTouche = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return;
    const dansChamp = e.target === champ.current;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIndex(deplacer(cibles, actif, 'bas'));
        break;
      case 'ArrowUp':
        e.preventDefault();
        // ↑ dans un champ vide : la demande précédente.
        if (dansChamp && (!texte.trim() || rappel !== null) && actif === CHAMP) {
          const prec = demandePrecedente(historique, rappel);
          if (prec) {
            setTexte(prec.texte);
            setRappel(prec.position);
            break;
          }
        }
        setIndex(deplacer(cibles, actif, 'haut'));
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (!dansChamp && cible?.zone === 'bouton') {
          e.preventDefault();
          setIndex(deplacer(cibles, actif, e.key === 'ArrowRight' ? 'droite' : 'gauche'));
        }
        break;
      case 'Tab':
        // Tab fait le même parcours que ↓ (Maj+Tab que ↑) et ne sort jamais de la palette.
        e.preventDefault();
        e.stopPropagation();
        setIndex(deplacer(cibles, actif, e.shiftKey ? 'haut' : 'bas'));
        break;
      case 'Enter':
        if (!dansChamp) break; // un bouton s'active tout seul
        e.preventDefault();
        if (cible && (cible.zone === 'reponse' || cible.zone === 'lancer')) activerCible(cible);
        else if (texte.trim()) {
          // Entrée dans le champ : « comprendre ma demande ». Jamais l'exécution d'un N1, N2 ou N3.
          retenirDemande(texte);
          lancer(texte.trim());
        }
        break;
      default:
        // Une lettre frappée alors que le focus est sur un bouton : elle va dans le champ, on n'en perd aucune.
        if (!dansChamp && e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          setIndex(CHAMP);
          champ.current?.focus({ preventScroll: true });
        }
        break;
    }
  };

  const idActif = cible && (cible.zone === 'reponse' || cible.zone === 'lancer') ? idOption(cible.id) : undefined;
  const etat = etatAffiche({ texte, reponse: afficheRepos ? null : reponse, enCours, erreur: erreur !== null });
  const touche = toucheModificatrice();

  const rendreLigne = (l: LigneUI, zone: 'reponse' | 'lancer', desactivee?: boolean) => {
    const c = cibles.findIndex((x) => x.zone === zone && x.id === l.id);
    const choisie = c === actif && c >= 0;
    return (
      <li
        key={l.id}
        id={idOption(l.id)}
        role="option"
        aria-selected={choisie}
        aria-disabled={desactivee || undefined}
        tabIndex={-1}
        className="ajp-ligne"
        data-zone={zone}
        data-recent={l.jour ? true : undefined}
        onMouseMove={() => !desactivee && c >= 0 && setIndex(c)}
        onClick={() => !desactivee && l.surActiver()}
        onKeyDown={(e) => e.key === 'Enter' && !desactivee && l.surActiver()}
      >
        <span className="ajp-ligne__tuile" aria-hidden>
          <Icone nom={l.icone} />
        </span>
        <span className="ajp-ligne__texte">
          <span className="ajp-ligne__titre">{l.titre}</span>
          {(l.sous || desactivee) && <span className="ajp-ligne__sous">{desactivee ? tm('droits.admin') : l.sous}</span>}
        </span>
        {l.jour ? <span className="ajp-ligne__jour">{l.jour}</span> : <ArrowRight className="ajp-ligne__fleche" aria-hidden strokeWidth={1.8} />}
      </li>
    );
  };

  // Les lignes de la réponse, groupées (modules, clients, documents) quand elles le sont.
  const groupes: Array<{ titre?: string; lignes: LigneUI[] }> = [];
  for (const l of lignesDeLaReponse) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.titre === l.groupe) dernier.lignes.push(l);
    else groupes.push({ titre: l.groupe, lignes: [l] });
  }

  return (
    <div className="ajp-voile" data-sortie={sortie || undefined} data-palette-ajmani onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div role="dialog" aria-modal="true" aria-label={tm('palette.titre')} tabIndex={-1} className="ajp-palette" data-etat={etat} data-ouverte={ouverte || undefined} onKeyDown={surTouche}>
        {/* Bande 1 · le champ */}
        <div className="ajp-champ">
          <span className="ajp-tuile" aria-hidden data-tourne={enCours || undefined}>
            <IconeEtincelle taille={16} />
          </span>
          <input
            ref={champ}
            className="ajp-champ__saisie"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${idListeReponse} ${idListeLancer}`}
            aria-autocomplete="list"
            aria-activedescendant={idActif}
            aria-label={tm('champ.libelle')}
            placeholder={tm('champ.placeholder')}
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
              setRappel(null);
              setIndex(CHAMP);
            }}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
          />
          <Raccourci>{touche === '⌘' ? '⌘J' : `${touche} J`}</Raccourci>
        </div>

        {horsLigne && (
          <p className="ajp-bandeau" role="status">
            <WifiOff aria-hidden strokeWidth={1.8} />
            <span>{tm('horsligne.bandeau')}</span>
          </p>
        )}

        {/* Bande 2 · la proposition */}
        <section className="ajp-proposition" aria-label={tm('aria.proposition')} aria-live="polite" data-vue={vue.mode}>
          <p className="ajp-section">{vue.section}</p>
          {vue.mode === 'reflexion' ? (
            <>
              {squelette && (
                <div className="ajp-squelettes" aria-hidden>
                  <span className="ajp-squelette" />
                  <span className="ajp-squelette" data-court="true" />
                </div>
              )}
              <p className="ajp-phrase">{tm('reflexion.texte')}</p>
            </>
          ) : (
            <>
              {vue.phrase.length > 0 && (
                <p className="ajp-phrase">
                  {vue.phrase.map((s, i) => (s.gras ? <strong key={i}>{s.texte}</strong> : <React.Fragment key={i}>{s.texte}</React.Fragment>))}
                </p>
              )}
              {vue.details.length > 0 && (
                <ul className="ajp-details">
                  {vue.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
              {vue.pastille && (
                <p className="ajp-pastille">
                  <PastilleEtat etat={vue.pastille.etat}>{vue.pastille.libelle}</PastilleEtat>
                </p>
              )}
              <ul id={idListeReponse} role="listbox" aria-label={vue.section} className="ajp-liste" hidden={groupes.length === 0}>
                {groupes.map((g, gi) => (
                  <React.Fragment key={`${g.titre ?? ''}-${gi}`}>
                    {g.titre && (
                      <li role="presentation" className="ajp-groupe">
                        {g.titre}
                      </li>
                    )}
                    {g.lignes.map((l) => rendreLigne(l, 'reponse'))}
                  </React.Fragment>
                ))}
              </ul>
              {vue.effacerHistorique && (
                <button
                  type="button"
                  ref={(el) => {
                    if (el) boutonsDom.current.set('effacer-historique', el);
                    else boutonsDom.current.delete('effacer-historique');
                  }}
                  className="ajp-lien"
                  onClick={effacerLHistorique}
                >
                  {tm('historique.effacer')}
                </button>
              )}
              {vue.boutons.length > 0 && (
                <div className="ajp-boutons" role="group" aria-label={tm('aria.boutons')}>
                  {vue.boutons.map((b) => (
                    <Bouton
                      key={b.id}
                      ref={(el) => {
                        if (el) boutonsDom.current.set(b.id, el);
                        else boutonsDom.current.delete(b.id);
                      }}
                      variante={b.role === 'primaire' ? 'primaire' : 'secondaire'}
                      icone={b.icone ? <Icone nom={b.icone} taille={14} /> : undefined}
                      disabled={b.desactive}
                      title={b.raison}
                      onClick={(e) => b.surActiver(e.detail === 0 ? 'bouton-entree' : 'bouton-clic')}
                    >
                      {b.libelle}
                    </Bouton>
                  ))}
                </div>
              )}
              {vue.etat && (
                <p className="ajp-etat" role="status">
                  {vue.etat}
                </p>
              )}
            </>
          )}
        </section>

        {/* Bande 3 · ou lancez */}
        <section className="ajp-lancer" aria-label={tm('section.lancer')}>
          <p className="ajp-section">{tm('section.lancer')}</p>
          <ul id={idListeLancer} role="listbox" aria-label={tm('section.lancer')} className="ajp-lancer__liste">
            {lancer4.map((l) =>
              rendreLigne(
                { id: l.id, titre: tm(l.titre), sous: tm(l.sous), icone: l.icone, surActiver: () => activerLigneLancer(l) },
                'lancer',
                Boolean(l.reservee && !contexte.admin),
              ),
            )}
          </ul>
        </section>

        {/* Bande 4 · le pied */}
        <footer className="ajp-pied">
          <div className="ajp-pied__aide">
            <p>{tm('pied.naviguer')}</p>
            <p>{tm('pied.valider')}</p>
          </div>
          <p>{tm('pied.fermer')}</p>
        </footer>
      </div>
    </div>
  );
}

/** Le jour d'une demande récente : « Aujourd'hui », « Hier », sinon « 12 oct. ». */
function jourDe(d: Demande | undefined, maintenant: number, langue: 'fr' | 'en', tm: Mots): string | undefined {
  if (!d) return undefined;
  const ecart = ecartEnJours(d.le, maintenant);
  if (ecart <= 0) return tm('jour.aujourdhui');
  if (ecart === 1) return tm('jour.hier');
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' }).format(new Date(d.le));
}

export { ContenuPalette };
