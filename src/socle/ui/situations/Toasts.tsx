import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleAlert, Undo2, X } from 'lucide-react';
import { calquesOuverts } from '../../../lib/pileCalques';
import { useSocleLangue } from '../../i18n';
import { Bouton } from '../Bouton';
import { propsBouton } from './statique';
import {
  afficheBarre,
  creerMinuteur,
  dureeDuToast,
  echapFermeLeToast,
  empiler,
  enchainer,
  fractionRestante,
  secondesAffichees,
  type Minuteur,
  type TypeToast,
} from './regles';

/**
 * LES TOASTS (H43, modèle 7 et rubrique 8) — un succès qu'on peut défaire, une erreur qu'on peut relancer.
 *
 * Deux étages :
 *
 *   `Toast`            — la carte, sans état (largeur 340 px ; 276 px dans la maquette, que la tuile rétrécit).
 *                        C'est elle que la page de démonstration pose, figée.
 *   `FournisseurToasts` + `useToastsSocle()` — la pile qui vit : minuteur, pause, Échap, trois au plus.
 *
 * LES RÈGLES (toutes dans `regles.ts`, éprouvées sans navigateur) :
 *
 *   succès avec « Annuler » — 8 s, barre de 3 px qui se vide de droite à gauche, « Disparaît dans N s » ;
 *   succès sans retour      — 4 s, ni barre ni bouton ;
 *   erreur                  — ne part JAMAIS toute seule ; « Réessayer » et une croix pour la fermer ;
 *   survol ou focus         — le minuteur se met en pause et garde son temps ;
 *   Échap                   — ferme le plus récent, sauf si un calque (dialogue, panneau) attend l'appui ;
 *   « Annuler » / « Réessayer » — appellent RÉELLEMENT le rappel fourni, puis ferment le toast.
 *
 * `role="status"` pour un succès, `role="alert"` pour une erreur (qui doit interrompre).
 * L'état n'est jamais porté par la couleur seule : coche ou alerte, et le titre le dit.
 *
 * COHABITER AVEC `useToast()` (src/state/ToastContext.tsx, partagé avec l'édition cliente) : les deux piles sont
 * indépendantes. Un écran refondu appelle `useToastsSocle().notifier(…)` pour ses succès et erreurs ; le reste de
 * l'application continue d'appeler `useToast().notify(…)`. Placez `FournisseurToasts` une fois, dans la coquille
 * refondue (édition interne), et réglez `--sc-toast-bas` / `--sc-toast-droite` si la coquille a une barre à éviter.
 */

/* ── La carte ─────────────────────────────────────────────────────────────── */

export interface ToastProps {
  type: TypeToast;
  titre: string;
  detail?: string;
  /** Le détail change à chaque seconde (compte à rebours) : on ne le fait pas annoncer. */
  detailDecoratif?: boolean;
  /** De 1 à 0 : la barre de 3 px sous la carte. Sans cette prop, pas de barre. */
  fraction?: number;
  onAnnuler?: () => void;
  onReessayer?: () => void;
  /** La croix d'une erreur. */
  onFermer?: () => void;
  /** Survol de la carte (pour la pause). */
  onSurvol?: (dedans: boolean) => void;
  /** Focus dans la carte (pour la pause). */
  onFocusDedans?: (dedans: boolean) => void;
  /** Aperçu : boutons `aria-disabled`, sans action. */
  statique?: boolean;
  /** En pixels : 340 par défaut, 276 dans la maquette. */
  largeur?: number;
  /**
   * Les cotes v3 (H43 en situation, modèle 7) : rayon 12, coche de 16, titre 13 px / 600, compte à rebours 11,5 px T4,
   * « Annuler » compact avec sa flèche de retour, et la barre de 3 px posée DANS le pied de la carte.
   */
  compact?: boolean;
}

export function Toast({ type, titre, detail, detailDecoratif, fraction, onAnnuler, onReessayer, onFermer, onSurvol, onFocusDedans, statique, largeur, compact = false }: ToastProps) {
  const { ts } = useSocleLangue();
  const erreur = type === 'erreur';
  return (
    <div
      role={erreur ? 'alert' : 'status'}
      data-type={type}
      data-compact={compact || undefined}
      className="sc-toast-bloc"
      style={largeur ? ({ '--sc-toast-largeur': `${largeur}px` } as React.CSSProperties) : undefined}
      onMouseEnter={onSurvol ? () => onSurvol(true) : undefined}
      onMouseLeave={onSurvol ? () => onSurvol(false) : undefined}
      onFocus={onFocusDedans ? () => onFocusDedans(true) : undefined}
      onBlur={
        onFocusDedans
          ? (e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onFocusDedans(false);
            }
          : undefined
      }
    >
      <div className="sc-toast">
        <span aria-hidden className="sc-toast__icone">
          {erreur ? <CircleAlert size={16} strokeWidth={2} /> : <Check size={16} strokeWidth={2.2} />}
        </span>
        <div className="sc-toast__corps">
          <p className="sc-toast__titre">{titre}</p>
          {detail && (
            <p className="sc-toast__detail" aria-hidden={detailDecoratif || undefined}>
              {detail}
            </p>
          )}
          {erreur && onReessayer && (
            <Bouton variante="secondaire" taille="petit" {...propsBouton(statique, onReessayer)}>
              {ts('toast.reessayer')}
            </Bouton>
          )}
        </div>
        {!erreur && onAnnuler && (
          <Bouton variante="secondaire" taille="petit" icone={compact ? <Undo2 size={13} strokeWidth={1.9} /> : undefined} {...propsBouton(statique, onAnnuler)}>
            {ts('toast.annuler')}
          </Bouton>
        )}
        {erreur && onFermer && (
          <button type="button" className="sc-toast__fermer sc-focus" aria-label={ts('toast.fermer')} title={ts('toast.fermer')} onClick={onFermer}>
            <X aria-hidden size={14} strokeWidth={2} />
          </button>
        )}
      </div>
      {fraction !== undefined && (
        <span aria-hidden className="sc-toast__barre">
          <span className="sc-toast__remplissage" style={{ transform: `scaleX(${Math.min(1, Math.max(0, fraction))})` }} />
        </span>
      )}
    </div>
  );
}

/* ── La pile ──────────────────────────────────────────────────────────────── */

export type NotificationToast =
  | {
      type: 'succes';
      titre: string;
      /** Remplace « Disparaît dans N s ». */
      detail?: string;
      /** À défaut : 8 s avec « Annuler », 4 s sans. */
      dureeMs?: number;
      /** Fait apparaître « Annuler » (et la barre de temps) ; défait réellement ce qui vient d'être fait. */
      annuler?: () => void;
    }
  | {
      type: 'erreur';
      /** À défaut : « Votre modification n'a pas pu être enregistrée. » */
      titre?: string;
      detail?: string;
      /** Fait apparaître « Réessayer » ; relance réellement l'enregistrement. */
      reessayer?: () => void;
    };

type Entree = NotificationToast & { id: string };

export interface ToastsSocle {
  /** Affiche un toast. Rend son identifiant, pour le fermer de l'extérieur. */
  notifier: (notification: NotificationToast) => string;
  fermer: (id: string) => void;
}

const ContexteToasts = createContext<ToastsSocle | null>(null);

export function useToastsSocle(): ToastsSocle {
  const valeur = useContext(ContexteToasts);
  if (!valeur) throw new Error('useToastsSocle doit être appelé sous <FournisseurToasts>.');
  return valeur;
}

/** Un champ où Échap sert déjà à annuler la saisie : le toast n'y touche pas. */
function estSaisie(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false;
  return cible.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName);
}

const PAS_DE_TICK_MS = 200;

function ToastVivant({ entree, onFermer }: { entree: Entree; onFermer: () => void }) {
  const { ts } = useSocleLangue();
  const erreur = entree.type === 'erreur';
  const annuler = entree.type === 'succes' ? entree.annuler : undefined;
  const reessayer = entree.type === 'erreur' ? entree.reessayer : undefined;
  const aRetour = !erreur && annuler !== undefined;
  const duree = dureeDuToast(entree.type, aRetour, entree.type === 'succes' ? entree.dureeMs : undefined);
  const barre = afficheBarre(entree.type, aRetour);

  const [restant, setRestant] = useState(duree ?? 0);
  const [survol, setSurvol] = useState(false);
  const [focus, setFocus] = useState(false);
  const minuteur = useRef<Minuteur | null>(null);
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;

  useEffect(() => {
    if (duree === null) return undefined;
    const m = creerMinuteur(duree, () => fermerRef.current());
    minuteur.current = m;
    m.demarrer();
    const tick = barre ? window.setInterval(() => setRestant(m.restantMs()), PAS_DE_TICK_MS) : undefined;
    return () => {
      m.arreter();
      if (tick !== undefined) window.clearInterval(tick);
      minuteur.current = null;
    };
  }, [duree, barre]);

  // Survol et focus : deux raisons de pause qui se cumulent. Le temps restant est gardé.
  useEffect(() => {
    const m = minuteur.current;
    if (!m) return;
    if (survol) m.pauser('survol');
    else m.reprendre('survol');
  }, [survol, duree, barre]);
  useEffect(() => {
    const m = minuteur.current;
    if (!m) return;
    if (focus) m.pauser('focus');
    else m.reprendre('focus');
  }, [focus, duree, barre]);

  const titre = entree.titre ?? ts('toast.erreur');
  const compte = aRetour && entree.detail === undefined;
  return (
    <Toast
      type={entree.type}
      titre={titre}
      detail={compte ? ts('toast.disparait', { n: secondesAffichees(restant) }) : entree.detail}
      detailDecoratif={compte}
      fraction={barre && duree !== null ? fractionRestante(restant, duree) : undefined}
      onAnnuler={annuler ? enchainer(annuler, onFermer) : undefined}
      onReessayer={reessayer ? enchainer(reessayer, onFermer) : undefined}
      onFermer={erreur ? onFermer : undefined}
      onSurvol={setSurvol}
      onFocusDedans={setFocus}
    />
  );
}

export function FournisseurToasts({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Entree[]>([]);
  const compteur = useRef(0);

  const fermer = useCallback((id: string) => setToasts((liste) => liste.filter((t) => t.id !== id)), []);
  const notifier = useCallback((notification: NotificationToast) => {
    compteur.current += 1;
    const id = `toast-socle-${compteur.current}`;
    setToasts((liste) => empiler<Entree>(liste, { ...notification, id }));
    return id;
  }, []);
  const valeur = useMemo<ToastsSocle>(() => ({ notifier, fermer }), [notifier, fermer]);

  // Échap ferme le plus récent — mais pas quand un calque ouvert attend cet appui, ni dans un champ de saisie.
  const dernier = toasts.length > 0 ? toasts[toasts.length - 1].id : null;
  useEffect(() => {
    if (dernier === null) return undefined;
    const surTouche = (e: KeyboardEvent) => {
      const prise = { touche: e.key, dejaPris: e.defaultPrevented, composition: e.isComposing, calquesOuverts: calquesOuverts(), dansUneSaisie: estSaisie(e.target) };
      if (echapFermeLeToast(prise)) fermer(dernier);
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [dernier, fermer]);

  return (
    <ContexteToasts.Provider value={valeur}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="sc-toasts">
            <AnimatePresence initial={false}>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  layout="position"
                  className="sc-toasts__rang"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <ToastVivant entree={t} onFermer={() => fermer(t.id)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ContexteToasts.Provider>
  );
}
