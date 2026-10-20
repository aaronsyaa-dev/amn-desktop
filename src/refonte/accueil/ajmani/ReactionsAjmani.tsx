import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../../auth/AuthContext';
import { useLangue } from '../../../i18n';
import { AjmaniPetit } from './Ajmani';
import { lireParole, ecrireParole, quelquUnEstOccupe } from './memoire';
import { choisir, jourDe, noterReaction, peutReagir } from './parole';
import { useRegistre } from './registre';
import { accueilEcoute, ecouterFetes, MOMENTS_FETES } from './reactions';
import { traduireAccueil } from '../i18n';

/**
 * LA PETITE TÊTE QUI RÉAGIT — partout dans l'app, sauf sur l'Accueil vivant
 * (qui réagit lui-même, en grand).
 *
 * Une facture encaissée, un nouveau client : la tête d'Ajmani apparaît en bas
 * à droite, dit une phrase, et repart après cinq secondes. Dans l'app
 * seulement : aucune notification système. Pas de réaction quand quelqu'un
 * écrit, téléphone ou a une fenêtre ouverte, ni au-delà de la limite du jour.
 * Elle ne prend jamais le focus.
 */
export function ReactionsAjmani() {
  const { user } = useAuth();
  const email = user?.email ?? '';
  const { langue } = useLangue();
  const registre = useRegistre();
  const [bulle, setBulle] = useState<{ texte: string; cle: number } | null>(null);

  useEffect(() => {
    if (!email) return undefined;
    return ecouterFetes((m) => {
      if (accueilEcoute.actif()) return;
      const maintenant = Date.now();
      const jour = jourDe(new Date(maintenant));
      const etat = lireParole(email);
      if (!peutReagir(etat, maintenant, jour) || quelquUnEstOccupe(maintenant)) return;
      const { replique, etat: apres } = choisir(etat, langue, MOMENTS_FETES[m.type], registre);
      ecrireParole(email, noterReaction(apres, maintenant, jour));
      setBulle({ texte: replique.texte, cle: maintenant });
    });
  }, [email, langue, registre]);

  useEffect(() => {
    if (!bulle) return undefined;
    const t = setTimeout(() => setBulle(null), 5000);
    return () => clearTimeout(t);
  }, [bulle]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex max-w-[min(360px,calc(100vw-2rem))] justify-end" role="status" aria-live="polite">
      <AnimatePresence>
        {bulle && (
          <motion.div
            key={bulle.cle}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-socle-bord bg-socle-eleve py-2 pl-2 pr-2 shadow-[0_18px_40px_-18px_rgba(0,0,0,.8)]"
          >
            <AjmaniPetit emotion="tres-content" taille={52} />
            <span className="min-w-0 text-[14px] font-semibold text-socle-texte">{bulle.texte}</span>
            <button
              type="button"
              onClick={() => setBulle(null)}
              aria-label={traduireAccueil(langue, 'astuce.fermer')}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-socle-texte-doux hover:bg-socle-survol focus-visible:outline-2 focus-visible:outline-socle-focus"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
