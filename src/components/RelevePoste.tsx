import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { construireReleve, type Observation } from '../lib/releve';
import { useLangue } from '../i18n';

/**
 * LA RELÈVE DE POSTE — l'enveloppe partagée des deux tons (Signes Vitaux).
 *
 * Le Majordome (édition cliente) et la relève SOC (accueil interne) disent la
 * même chose avec d'autres mots : ce qui est arrivé pendant l'absence, et un
 * verdict. La grammaire vit dans `releve.ts` (gardée par check:releve) ; ce
 * composant porte tout le reste — le repère de dernier passage et la mise en
 * scène — UNE fois, pour que les deux éditions ne divergent jamais. C'est le
 * motif de défaut le plus fréquent du dépôt : la même règle écrite à deux
 * endroits.
 *
 * ## Le repère du dernier passage
 *
 * `localStorage` par organisation : une présence PAR POSTE — « pendant votre
 * absence » veut dire absence d'ici. Et le PREMIER démarrage d'un onglet
 * épingle SA lecture en `sessionStorage` : la sonde a vu deux morts avant
 * cette règle — le remontage derrière la garde d'authentification, puis le
 * double démarrage de la PWA (le service worker prend la page et la
 * recharge), qui relisaient chacun le battement posé un instant plus tôt.
 * « Absence : 0,3 s », silence. Ce qui est observé est bien enregistré ;
 * c'est le réveil qui doit survivre.
 */

let ecouteurPose = false;
let derniereClePosee: string | null = null;

export function passagePrecedent(orgId: string | undefined): Date | null {
  if (!orgId || typeof window === 'undefined') return null;
  const cle = `amn.releve.passage.${orgId}`;
  const cleSession = `${cle}.lu`;

  try {
    const deja = window.sessionStorage.getItem(cleSession);
    if (deja !== null) {
      if (deja === 'aucun') return null;
      const t = Date.parse(deja);
      return Number.isFinite(t) ? new Date(t) : null;
    }

    let precedent: Date | null = null;
    const brut = window.localStorage.getItem(cle);
    if (brut) {
      const t = Date.parse(brut);
      if (Number.isFinite(t)) precedent = new Date(t);
    }
    window.sessionStorage.setItem(cleSession, precedent ? precedent.toISOString() : 'aucun');
    window.localStorage.setItem(cle, new Date().toISOString());
    derniereClePosee = cle;
    if (!ecouteurPose) {
      ecouteurPose = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && derniereClePosee) {
          try {
            window.localStorage.setItem(derniereClePosee, new Date().toISOString());
          } catch {
            /* stockage indisponible : le prochain chargement fera sans repère */
          }
        }
      });
    }
    return precedent;
  } catch {
    return null;
  }
}

export function RelevePoste({
  depuis,
  observations,
  attentions,
  ton,
  className = '',
}: {
  /** Le dernier passage, lu via `passagePrecedent` — idempotent par onglet. */
  depuis: Date | null;
  /** Déjà comptées sur les vraies collections, ordonnées par importance. */
  observations: readonly Observation[];
  attentions: number;
  ton: 'majordome' | 'soc';
  className?: string;
}) {
  const mouvementReduit = useReducedMotion();
  const { langue, t } = useLangue();

  const releve = useMemo(() => {
    if (!depuis) return null;
    return construireReleve({
      depuis,
      maintenant: new Date(),
      observations: [...observations],
      attentions,
      ton,
      langue,
    });
  }, [depuis, observations, attentions, ton, langue]);

  if (!releve) return null;

  /*
    Les lignes s'écrivent en séquence — l'une APRÈS l'autre, pas un typewriter
    lettre à lettre (lent, criard, illisible pour un lecteur d'écran). En
    mouvement réduit, tout est là d'emblée. Rien ne bloque : la relève est le
    premier paragraphe de la page, pas un voile par-dessus.
  */
  return (
    <motion.section
      aria-label={t('accueil.relev.aria')}
      initial={mouvementReduit ? false : 'cache'}
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.9, delayChildren: 0.4 } } }}
      className={`panel-ticks border border-border bg-surface px-5 py-4 ${className}`}
    >
      <motion.p
        variants={{ cache: { opacity: 0, y: 4 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } }}
        className="eyebrow"
      >
        {releve.entete}
      </motion.p>
      <div className="mt-2 flex flex-col gap-1">
        {releve.lignes.map((ligne, i) => {
          const verdict = i === releve.lignes.length - 1;
          return (
            <motion.p
              key={ligne}
              variants={{
                cache: { opacity: 0, y: 4 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
              }}
              className={verdict ? 'text-v4 font-medium text-text-primary' : 'text-v4 text-text-secondary'}
            >
              {ligne}
            </motion.p>
          );
        })}
      </div>
    </motion.section>
  );
}
