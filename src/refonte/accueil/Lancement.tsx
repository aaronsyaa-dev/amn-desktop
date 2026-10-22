import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { lireMouvement } from '../../socle/mouvement';
import { useLangue } from '../../i18n';
import { Logo } from '../../components/Logo';
import { appareilModeste, dureeLancement } from './dureeLancement';
import { traduireAccueil } from './i18n';

/**
 * LE LANCEMENT DE L'ÉDITION INTERNE — le logo, une seconde, sur le noir.
 *
 * Remplace, dans l'édition interne seulement, le rideau `SplashScreen` (que
 * l'édition cliente garde tel quel, via la couture `@edition/vivant`). Même
 * contrat : `onDone` à la fin, une seule fois par lancement.
 *
 *   · environ 1 s au premier lancement sur ce poste, plus court ensuite ;
 *   · un clic ou une touche le passe, sans prendre le focus ;
 *   · réglage Mouvement : « réduit » = un fondu, « aucun » = une image fixe.
 */

let lancementDejaJoue = false;
export function lancementJoue(): boolean {
  return lancementDejaJoue;
}

const CLE_VUS = 'amn.lancement.vus';

function lancementsVus(): number {
  try {
    return Number(window.localStorage.getItem(CLE_VUS)) || 0;
  } catch {
    return 0;
  }
}

export function Lancement({ onDone }: { onDone: () => void }) {
  const [reglages] = useState(() => {
    const premier = lancementsVus() === 0;
    const niveau = lireMouvement();
    return { premier, niveau, duree: dureeLancement(premier, appareilModeste(), niveau) };
  });
  const [visible, setVisible] = useState(true);
  const fini = useRef(false);
  const { langue } = useLangue();

  useEffect(() => {
    lancementDejaJoue = true;
    try {
      window.localStorage.setItem(CLE_VUS, String(lancementsVus() + 1));
    } catch {
      /* stockage refusé : chaque lancement sera le « premier », un peu plus long */
    }
    const t = setTimeout(() => setVisible(false), reglages.duree);
    return () => clearTimeout(t);
  }, [reglages]);

  // Passer : un clic (sur le rideau) ou une touche. Aucun focus n'est pris.
  useEffect(() => {
    const passer = () => setVisible(false);
    window.addEventListener('keydown', passer);
    return () => window.removeEventListener('keydown', passer);
  }, []);

  const terminer = () => {
    if (fini.current) return;
    fini.current = true;
    onDone();
  };

  const complet = reglages.niveau === 'complet';
  return (
    <AnimatePresence onExitComplete={terminer}>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reglages.niveau === 'aucun' ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setVisible(false)}
          className="fixed inset-0 z-[300] flex cursor-pointer flex-col items-center justify-center gap-4 bg-[#0c0c0d]"
          aria-hidden
        >
          <motion.div
            initial={complet ? { opacity: 0, scale: 0.97 } : { opacity: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: complet ? 0.45 : 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <Logo height={48} showTagline={false} showAppName />
          </motion.div>
          {reglages.premier && reglages.niveau !== 'aucun' && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 0.5, duration: 0.3 }} className="absolute bottom-8 text-[11px] text-[#8a8a8e]">
              {traduireAccueil(langue, 'lancement.passer')}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
