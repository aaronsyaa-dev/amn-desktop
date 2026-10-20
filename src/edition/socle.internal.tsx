import React, { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { configMotion, choixMouvement, ecrireMouvement, NIVEAUX_MOUVEMENT, systemeDemandeMoins, useMouvement, type NiveauMouvement } from '../socle/mouvement';
import { poserJournal } from '../socle/moments';
import { useSocleLangue, type CleSocle } from '../socle/i18n';

/**
 * LE SOCLE DE LA REFONTE, CÔTÉ INTERNE — ce que l'édition interne branche.
 *
 * L'édition cliente reçoit `socle.business.tsx` à la place : une racine qui
 * rend ses enfants telle quelle, et une section de réglages vide. Rien de ce
 * fichier — ni le réglage, ni le journal des moments — n'entre dans son
 * paquet.
 *
 * ## La racine
 *
 * Posée dans `src/renderer.tsx`, SOUS le `MotionConfig reducedMotion="user"`
 * commun : un `MotionConfig` imbriqué hérite de son parent et le remplace là
 * où il redéfinit (framer-motion fusionne les deux). Tout l'arbre — le splash
 * compris — suit donc le réglage Mouvement. Elle pose aussi
 * `data-mouvement` sur <html> pour les animations CSS (voir index.css).
 *
 * En développement (`npm start`), elle branche le journal du bus de moments
 * sur la console. Jamais dans un paquet construit.
 */
export function RacineSocle({ children }: { children: React.ReactNode }) {
  const niveau = useMouvement();

  useEffect(() => {
    document.documentElement.dataset.mouvement = niveau;
  }, [niveau]);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    poserJournal((m) => console.debug(`[moment] ${m.type}`, m.charge));
    return () => poserJournal(null);
  }, []);

  return <MotionConfig {...configMotion(niveau)}>{children}</MotionConfig>;
}

const LIBELLES: Record<NiveauMouvement, { titre: CleSocle; aide: CleSocle }> = {
  complet: { titre: 'mouvement.complet', aide: 'mouvement.complet.aide' },
  reduit: { titre: 'mouvement.reduit', aide: 'mouvement.reduit.aide' },
  aucun: { titre: 'mouvement.aucun', aide: 'mouvement.aucun.aide' },
};

/**
 * Le réglage, dans Paramètres. Habillé comme ses voisines (`panel`,
 * `eyebrow`) : l'écran des réglages n'a pas encore migré vers le socle, et une
 * section graphite au milieu de cartes noires serait une tache.
 *
 * Trois choix exclusifs : un groupe de boutons radio (flèches et Espace au
 * clavier, comme partout ailleurs), pas un interrupteur.
 */
export function MouvementSection() {
  const { ts } = useSocleLangue();
  const niveau = useMouvement();
  const choisi = choixMouvement() !== null;
  const systeme = systemeDemandeMoins();

  return (
    <section className="panel p-4" id="reglages-mouvement">
      <p className="eyebrow mb-1" id="reglages-mouvement-titre">
        {ts('mouvement.titre')}
      </p>
      <p className="mb-3 max-w-2xl text-[12px] leading-relaxed text-text-secondary">{ts('mouvement.texte')}</p>
      <div role="radiogroup" aria-labelledby="reglages-mouvement-titre" className="flex flex-col">
        {NIVEAUX_MOUVEMENT.map((n) => (
          <label key={n} className="flex cursor-pointer items-start gap-3 border-b border-border-row py-3 last:border-b-0">
            <input
              type="radio"
              name="amn-mouvement"
              value={n}
              checked={niveau === n}
              onChange={() => ecrireMouvement(n)}
              className="mt-1 h-4 w-4 flex-none accent-[var(--color-text-primary)]"
            />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-text-primary">{ts(LIBELLES[n].titre)}</span>
              <span className="block text-[12px] leading-relaxed text-text-secondary">{ts(LIBELLES[n].aide)}</span>
            </span>
          </label>
        ))}
      </div>
      {systeme && !choisi && <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">{ts('mouvement.systeme')}</p>}
      {choisi && (
        <button
          type="button"
          onClick={() => ecrireMouvement(null)}
          className="mt-3 inline-flex min-h-11 items-center border border-border-strong px-3 text-[13px] font-semibold text-text-body hover:bg-surface-hover md:min-h-9"
        >
          {ts('mouvement.revenirSysteme')}
        </button>
      )}
    </section>
  );
}

/**
 * `emit` pour le code PARTAGÉ (ajout S2) : un fichier commun aux deux éditions
 * n'importe jamais `src/socle/**` ; il passe par `@edition/socle`. Ici, c'est
 * le vrai bus ; côté cliente, une fonction qui ne fait rien.
 */
export { emit as emettreMoment } from '../socle/moments';
