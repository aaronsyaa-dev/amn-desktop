import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../../auth/AuthContext';
import { useLangue } from '../../../i18n';
import { CATALOGUE_DES_MOMENTS } from '../../../socle/moments';
import { lireParole, ecrireParole, quelquUnEstOccupe } from './memoire';
import { choisir, jourDe, noterReaction, peutReagir } from './parole';
import { useRegistre } from './registre';
import { ecouterFetes, MOMENTS_FETES, type MomentFete } from './reactions';
import { traduireAccueil } from '../i18n';

/**
 * LES PETITS TOASTS D'AJMANI — une facture encaissée, un nouveau client.
 *
 * Une ligne de texte en bas à droite, un point de la couleur de la famille,
 * et elle s'efface après cinq secondes. Dans l'app seulement : aucune
 * notification système. Rien quand quelqu'un écrit, téléphone ou a une
 * fenêtre ouverte, ni au-delà de la limite du jour. Jamais de focus pris.
 */
export function ToastsAjmani() {
  const { user } = useAuth();
  const email = user?.email ?? '';
  const { langue } = useLangue();
  const registre = useRegistre();
  const [toast, setToast] = useState<{ texte: string; type: MomentFete; cle: number } | null>(null);
  const [retenu, setRetenu] = useState(false);

  useEffect(() => {
    if (!email) return undefined;
    return ecouterFetes((m) => {
      const maintenant = Date.now();
      const jour = jourDe(new Date(maintenant));
      const etat = lireParole(email);
      if (!peutReagir(etat, maintenant, jour) || quelquUnEstOccupe(maintenant)) return;
      const { replique, etat: apres } = choisir(etat, langue, MOMENTS_FETES[m.type], registre);
      ecrireParole(email, noterReaction(apres, maintenant, jour));
      setRetenu(false);
      setToast({ texte: replique.texte, type: m.type, cle: maintenant });
    });
  }, [email, langue, registre]);

  // Cinq secondes — et il ne s'efface pas tant qu'on le survole ou qu'il a le focus (WCAG 2.2.1).
  useEffect(() => {
    if (!toast || retenu) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast, retenu]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex max-w-[min(360px,calc(100vw-2rem))] justify-end" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.cle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            data-famille={CATALOGUE_DES_MOMENTS[toast.type].famille}
            onMouseEnter={() => setRetenu(true)}
            onMouseLeave={() => setRetenu(false)}
            onFocus={() => setRetenu(true)}
            onBlur={() => setRetenu(false)}
            className="pointer-events-auto flex items-center gap-3 rounded-lg border border-socle-bord bg-socle-eleve py-2.5 pl-3.5 pr-1.5 text-[13px] text-socle-texte shadow-[0_12px_32px_-16px_rgba(0,0,0,.9)]"
          >
            <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--fam)]" />
            <span className="min-w-0">{toast.texte}</span>
            <button
              type="button"
              onClick={() => {
                setToast(null);
                setRetenu(false);
              }}
              aria-label={traduireAccueil(langue, 'astuce.fermer')}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-socle-texte-doux hover:bg-socle-survol focus-visible:outline-2 focus-visible:outline-socle-focus"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
