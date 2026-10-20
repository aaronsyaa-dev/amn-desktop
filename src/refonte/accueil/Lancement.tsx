import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { lireMouvement } from '../../socle/mouvement';
import { dureeLancement } from './dureeLancement';
import { EDITION_PRODUCT_NAME } from '../../edition/edition';
import { Ajmani, appareilModeste } from './ajmani/Ajmani';
import type { Emotion } from './ajmani/expressions';
import { traduireAccueil } from './i18n';
import { useLangue } from '../../i18n';

/**
 * L'ANIMATION DE LANCEMENT DE L'ÉDITION INTERNE — Ajmani allume son écran.
 * ════════════════════════════════════════════════════════════════════════
 *
 * Remplace, dans l'édition interne seulement, le rideau `SplashScreen` (que
 * l'édition cliente garde tel quel, via la couture `@edition/vivant`). Même
 * contrat : `onDone` à la fin, une seule fois par lancement.
 *
 *   · environ 2 s au premier lancement sur ce poste, moins d'1 s ensuite ;
 *   · un clic ou une touche le passe, sans prendre le focus ;
 *   · sur un appareil modeste : plus court, et sans lueur (le filtre coûte) ;
 *   · réglage Mouvement : « réduit » = fondus seulement, « aucun » = une image
 *     fixe à peine le temps de la voir.
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
    const modeste = appareilModeste();
    const niveau = lireMouvement();
    return { premier, modeste, niveau, duree: dureeLancement(premier, modeste, niveau) };
  });
  const [visible, setVisible] = useState(true);
  const [allume, setAllume] = useState(reglages.niveau !== 'complet');
  const [emotion, setEmotion] = useState<Emotion>('neutre');
  const fini = useRef(false);
  const { langue } = useLangue();

  useEffect(() => {
    lancementDejaJoue = true;
    try {
      window.localStorage.setItem(CLE_VUS, String(lancementsVus() + 1));
    } catch {
      /* stockage refusé : chaque lancement sera le « premier », un peu plus long */
    }
    const { premier, duree, niveau } = reglages;
    const t: ReturnType<typeof setTimeout>[] = [];
    if (niveau === 'complet') {
      t.push(setTimeout(() => setAllume(true), premier ? 380 : 120));
      t.push(setTimeout(() => setEmotion('content'), premier ? 1050 : 420));
    } else {
      setEmotion('content');
    }
    t.push(setTimeout(() => setVisible(false), duree));
    return () => t.forEach(clearTimeout);
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
          transition={{ duration: reglages.niveau === 'aucun' ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setVisible(false)}
          className="fixed inset-0 z-[300] flex cursor-pointer flex-col items-center justify-center gap-5 bg-bg"
          aria-hidden
        >
          <motion.div
            initial={complet ? { opacity: 0, scale: 0.92, y: 8 } : { opacity: 0 }}
            animate={complet ? { opacity: 1, scale: [0.92, 1.03, 1], y: [8, -3, 0] } : { opacity: 1 }}
            transition={{ duration: complet ? 0.7 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Ajmani cadrage="tete" taille={132} emotion={emotion} allume={allume} mouvement={reglages.niveau} qualite={reglages.modeste ? 'legere' : 'haute'} />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: complet ? (reglages.premier ? 0.7 : 0.2) : 0 }}
            className="font-mono text-[12px] uppercase tracking-[0.28em] text-text-secondary"
          >
            {EDITION_PRODUCT_NAME}
          </motion.p>
          {reglages.premier && reglages.niveau !== 'aucun' && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 0.9, duration: 0.4 }} className="absolute bottom-8 text-[11px] text-text-muted">
              {traduireAccueil(langue, 'lancement.passer')}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
