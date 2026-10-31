import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useFermetureEchap } from '../../../lib/useFermetureEchap';
import { useSocleLangue } from '../../i18n';
import { Bouton } from '../Bouton';
import { propsBouton } from './statique';

/**
 * LE DIALOGUE DE CONFIRMATION (H43, modèle 6) — pour ce qui est irréversible ou touche plusieurs éléments liés.
 *
 * Une action qu'on peut défaire d'un geste n'a PAS besoin de lui : elle préfère un toast avec « Annuler ».
 *
 * Ce qu'il tient, et d'où :
 *
 *   · `role="alertdialog"` et `aria-modal`, titre et texte reliés par `aria-labelledby` / `aria-describedby` ;
 *   · Échap = « Annuler » — `useFermetureEchap`, donc la pile de `pileCalques.ts` : Échap ne ferme que CE dialogue,
 *     et la tabulation ne sort pas de lui, parce que son voile est `position: fixed; z-index: 50` (c'est à cela que
 *     la pile reconnaît un calque : ne le « simplifiez » pas) ;
 *   · le focus entre sur le bouton de DROITE si l'action est récupérable (corbeille : on peut se tromper sans
 *     conséquence), sur « Annuler » sinon ; à la fermeture il REVIENT sur ce qui a ouvert le dialogue ;
 *   · le clic sur le voile ne ferme PAS : un dialogue d'alerte demande une décision, pas un clic à côté ;
 *   · le bouton d'action est BLANC (primaire), jamais rouge plein, et porte un verbe précis (« À la corbeille ») —
 *     jamais « OK » ni « Oui ».
 *
 * Largeur : 400 px (proposition de la fiche) ; la maquette en montre 276 parce que la tuile la rétrécit.
 */
export interface DialogueConfirmationProps {
  ouvert: boolean;
  /** « Annuler » et Échap. */
  onAnnuler: () => void;
  onConfirmer: () => void;
  /** Une question avec le nom de l'objet entre « » : « Supprimer « … » ? ». */
  titre: string;
  /** Ce qui se passe, et si c'est réversible. */
  texte: string;
  /** Le verbe précis du bouton de droite. */
  libelleAction: string;
  /** Une icône de 14 px avant le libellé (la corbeille, par exemple). */
  iconeAction?: React.ReactNode;
  /** Le libellé de « Annuler », s'il faut le dire autrement. */
  libelleAnnuler?: string;
  /** L'action peut être défaite (corbeille de 30 jours) : le focus entre sur le bouton d'action. Sinon, sur « Annuler ». */
  recuperable?: boolean;
  /** En pixels. 400 par défaut. */
  largeur?: number;
}

/** Les mêmes, plus ce que la version « en place » comprend. */
interface EnPlaceProps extends DialogueConfirmationProps {
  refAnnuler?: React.Ref<HTMLButtonElement>;
  refAction?: React.Ref<HTMLButtonElement>;
  /** Sans voile ni positionnement : la boîte seule, dans le flux (page de démonstration). Elle ne se dit alors plus modale. */
  sansVoile?: boolean;
  /** Aperçu : les deux boutons restent atteignables mais ne font rien. */
  statique?: boolean;
}

/** Le focus entre avec un léger retard : la boîte arrive en fondu, et un `focus()` sur un élément encore transparent est ignoré par certains navigateurs. */
const DELAI_FOCUS_MS = 60;

export function DialogueConfirmation(props: DialogueConfirmationProps) {
  const { ouvert, onAnnuler, recuperable = true } = props;
  const refAnnuler = useRef<HTMLButtonElement>(null);
  const refAction = useRef<HTMLButtonElement>(null);
  const declencheur = useRef<HTMLElement | null>(null);

  useFermetureEchap(ouvert, onAnnuler);

  // Le focus revient sur ce qui a ouvert le dialogue — sinon il retombe en haut du document.
  useEffect(() => {
    if (!ouvert) return undefined;
    declencheur.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const cible = declencheur.current;
      if (cible?.isConnected) cible.focus();
    };
  }, [ouvert]);

  // Et il entre là où la décision est la moins risquée.
  useEffect(() => {
    if (!ouvert) return undefined;
    const t = window.setTimeout(() => (recuperable ? refAction : refAnnuler).current?.focus(), DELAI_FOCUS_MS);
    return () => window.clearTimeout(t);
  }, [ouvert, recuperable]);

  if (typeof document === 'undefined') return null;
  return createPortal(<DialogueConfirmationEnPlace {...props} refAnnuler={refAnnuler} refAction={refAction} />, document.body);
}

/**
 * Le voile et la boîte, sans portail ni gestion du focus — ce que `DialogueConfirmation` place dans <body>.
 * Exporté pour la page de démonstration et pour `check:socle-situations`, qui le rend hors navigateur (un portail
 * ne se rend pas côté serveur). Dans un écran, utilisez `DialogueConfirmation`.
 */
export function DialogueConfirmationEnPlace({
  ouvert,
  onAnnuler,
  onConfirmer,
  titre,
  texte,
  libelleAction,
  iconeAction,
  libelleAnnuler,
  largeur = 400,
  refAnnuler,
  refAction,
  sansVoile = false,
  statique = false,
}: EnPlaceProps) {
  const { ts } = useSocleLangue();
  const idTitre = useId();
  const idTexte = useId();

  // La boîte est un `motion.div` pour s'animer sous le voile ; sans voile (aperçu), elle reste un bloc ordinaire.
  const animation = sansVoile
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 6 },
        transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
      };
  const boite = (
    <motion.div
      role={sansVoile ? 'group' : 'alertdialog'}
      aria-modal={sansVoile ? undefined : 'true'}
      aria-labelledby={idTitre}
      aria-describedby={idTexte}
      tabIndex={sansVoile ? undefined : -1}
      className="sc-dialogue"
      style={{ '--sc-dialogue-largeur': `${largeur}px` } as React.CSSProperties}
      {...animation}
    >
      <h2 id={idTitre} className="sc-dialogue__titre">
        {titre}
      </h2>
      <p id={idTexte} className="sc-dialogue__texte">
        {texte}
      </p>
      <div className="sc-dialogue__actions">
        <Bouton ref={refAnnuler} variante="secondaire" taille="petit" {...propsBouton(statique, onAnnuler)}>
          {libelleAnnuler ?? ts('dialogue.annuler')}
        </Bouton>
        <Bouton ref={refAction} variante="primaire" taille="petit" icone={iconeAction} {...propsBouton(statique, onConfirmer)}>
          {libelleAction}
        </Bouton>
      </div>
    </motion.div>
  );

  if (sansVoile) return ouvert ? boite : null;
  return (
    <AnimatePresence>
      {ouvert && (
        <motion.div
          key="voile"
          className="sc-dialogue-voile"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          {boite}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
