import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useFermetureEchap } from '../../lib/useFermetureEchap';
import { useFocusALOuverture } from '../../lib/useFocusALOuverture';
import { useSocleLangue } from '../i18n';
import type { Famille } from '../familles';

/**
 * LA MODALE DU SOCLE — une fenêtre au-dessus de l'écran, et rien qui s'échappe.
 *
 * Elle ne réinvente rien de ce que le dépôt tient déjà, elle le rassemble :
 *
 *   · Échap ferme CETTE fenêtre et elle seule (`useFermetureEchap` → la pile
 *     de `src/lib/pileCalques.ts`) ;
 *   · la tabulation ne sort pas : la même pile retient le focus dans le
 *     calque du dessus, reconnu à son `position: fixed` et à son `z-50` —
 *     d'où le conteneur ci-dessous, qu'il ne faut pas « simplifier » ;
 *   · le focus entre à l'ouverture (`useFocusALOuverture`, ou le champ qui
 *     porte `autoFocus`) et REVIENT, à la fermeture, sur ce qui l'a ouverte ;
 *   · `role="dialog"`, `aria-modal`, titre et description reliés par
 *     `aria-labelledby` / `aria-describedby`.
 *
 * Le clic sur le voile ferme (sauf `fermetureAuVoile={false}`, pour un
 * formulaire qu'on perdrait d'un geste). L'arrivée est un fondu et une
 * légère montée ; en mouvement réduit, le fondu seul ; en « aucun », rien.
 */
export interface ModaleProps {
  ouverte: boolean;
  onFermer: () => void;
  titre: React.ReactNode;
  description?: React.ReactNode;
  /** Le pied : les boutons, l'action principale à droite. */
  actions?: React.ReactNode;
  taille?: 'petite' | 'moyenne' | 'grande';
  famille?: Famille;
  fermetureAuVoile?: boolean;
  children?: React.ReactNode;
}

const LARGEURS = { petite: 'max-w-sm', moyenne: 'max-w-lg', grande: 'max-w-2xl' } as const;

export function Modale(props: ModaleProps) {
  const { ouverte, onFermer } = props;
  const fenetre = useFocusALOuverture<HTMLDivElement>(ouverte);
  const retour = useRef<HTMLElement | null>(null);

  useFermetureEchap(ouverte, onFermer);

  // Le focus revient sur ce qui a ouvert la fenêtre — sinon il retombe en
  // haut du document, et la personne au clavier doit tout retraverser.
  useEffect(() => {
    if (!ouverte) return undefined;
    retour.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const cible = retour.current;
      if (cible?.isConnected) cible.focus();
    };
  }, [ouverte]);

  if (typeof document === 'undefined') return null;
  return createPortal(<ModaleEnPlace {...props} refFenetre={fenetre} />, document.body);
}

/**
 * Le voile et la fenêtre, sans portail ni gestion du focus — ce que `Modale`
 * place dans <body>. Exporté pour `check:socle`, qui le rend hors navigateur
 * (un portail ne se rend pas côté serveur). Dans un écran, utilisez `Modale`.
 */
export function ModaleEnPlace({
  ouverte,
  onFermer,
  titre,
  description,
  actions,
  taille = 'moyenne',
  famille,
  fermetureAuVoile = true,
  children,
  refFenetre,
}: ModaleProps & { refFenetre?: React.Ref<HTMLDivElement> }) {
  const { ts } = useSocleLangue();
  const idTitre = useId();
  const idDescription = useId();

  return (
    <AnimatePresence>
      {ouverte && (
        <motion.div
          key="voile"
          className="fixed inset-0 z-50 flex items-end justify-center bg-socle-voile p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={fermetureAuVoile ? onFermer : undefined}
        >
          <motion.div
            ref={refFenetre}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitre}
            aria-describedby={description ? idDescription : undefined}
            tabIndex={-1}
            data-famille={famille}
            className={`relative flex max-h-[calc(100vh-2rem)] w-full ${LARGEURS[taille]} flex-col overflow-hidden rounded-2xl border border-socle-bord bg-socle-eleve text-socle-texte shadow-[0_24px_64px_rgba(0,0,0,0.45)] outline-none`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            {famille && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-[var(--fam)]" />}
            <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5">
              <div className="min-w-0">
                <h2 id={idTitre} className="text-[18px] font-semibold leading-snug text-socle-texte">
                  {titre}
                </h2>
                {description && (
                  <p id={idDescription} className="mt-1 text-[14px] leading-relaxed text-socle-texte-doux">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onFermer}
                aria-label={ts('modale.fermer')}
                title={ts('modale.fermer')}
                className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-socle-texte-discret transition-colors hover:bg-socle-survol hover:text-socle-texte"
              >
                <X aria-hidden size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 text-[14px] leading-relaxed text-socle-texte-doux">{children}</div>
            {actions && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-socle-bord px-5 py-4">{actions}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
