import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useFermetureEchap } from '../../lib/useFermetureEchap';

/**
 * LE FORMULAIRE LONG — une fenêtre à étapes, et trois promesses tenues.
 * ════════════════════════════════════════════════════════════════════
 *
 * Système de design, §5.2. Au-delà de cinq champs, le formulaire en place
 * pousse la liste hors de l'écran et se lit comme un mur ; il passe alors en
 * fenêtre, découpée en étapes nommées.
 *
 * Trois promesses, écrites à l'écran sous les boutons parce qu'elles décident
 * si on ose commencer :
 *
 *   1. « SUIVANT RESTE INACTIF SANS … » — on ne progresse pas en laissant un
 *      trou derrière soi ; la raison est dite, jamais un bouton grisé muet.
 *   2. « RIEN N'EST CRÉÉ AVANT … » — la fenêtre ne crée rien en chemin. C'est
 *      ce qui permet de l'ouvrir pour voir, et de partir sans laisser de
 *      brouillon fantôme.
 *   3. « ÉCHAP FERME » — ici le raccourci existe, contrairement au formulaire
 *      en place : une fenêtre se ferme, et le clavier doit pouvoir le faire.
 *
 * L'étape courante est une PLAQUE AMBRE, et c'est le seul ambre de la fenêtre
 * (§5.2, dernière ligne).
 */
export function AssistantEtapes({
  titre,
  etapes,
  courante,
  onEtape,
  onFermer,
  onPrecedent,
  onSuivant,
  libelleSuivant = 'Suivant',
  empeche,
  promesse,
  icone: Icone,
  children,
}: {
  /** « Nouveau devis · Maison Bertaux » — ce qu'on est en train de faire, et pour qui. */
  titre: string;
  /** Les étapes, dans l'ordre. Trois au plus : au-delà, ce n'est plus un formulaire. */
  etapes: string[];
  /** L'index de l'étape courante. */
  courante: number;
  /** Revenir à une étape DÉJÀ franchie. Les suivantes ne sont pas cliquables. */
  onEtape?: (index: number) => void;
  onFermer: () => void;
  onPrecedent?: () => void;
  onSuivant: () => void;
  libelleSuivant?: string;
  /** Ce qui manque pour avancer. Présent = « Suivant » est inactif. */
  empeche?: string;
  /** Les promesses, en une ligne mono sous les boutons. */
  promesse?: string;
  icone?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  useFermetureEchap(true, onFermer);

  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/70 p-6 pt-[8vh] backdrop-blur-[2px]">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[520px] border border-[#333] bg-sheet shadow-[0_50px_90px_-30px_rgba(0,0,0,1),0_8px_20px_rgba(0,0,0,.7)]"
      >
        <header className="flex items-center gap-2.5 border-b border-border-sheet px-5 py-3.5">
          {Icone && (
            <span className="text-text-muted" aria-hidden>
              <Icone size={14} strokeWidth={2.1} />
            </span>
          )}
          <p className="eyebrow flex-1 truncate">{titre}</p>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="-m-2 p-2 text-text-muted transition-colors hover:text-text-primary"
          >
            <X size={14} strokeWidth={2.1} />
          </button>
        </header>

        {/* Les étapes. Celle en cours est une plaque ambre — le seul ambre ici. */}
        <div className="flex border-b border-border-sheet">
          {etapes.map((etape, i) => {
            const active = i === courante;
            const franchie = i < courante;
            return (
              <button
                key={etape}
                type="button"
                disabled={!franchie && !active}
                onClick={() => franchie && onEtape?.(i)}
                aria-current={active ? 'step' : undefined}
                className={`flex-1 px-3 py-3 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                  active
                    ? 'signal-plate font-bold'
                    : franchie
                      ? 'cursor-pointer text-text-secondary hover:text-text-primary'
                      : 'cursor-not-allowed text-text-muted'
                }`}
              >
                {i + 1}. {etape}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-5">{children}</div>

        <footer className="flex flex-col gap-3 px-5 pb-5">
          <div className="flex items-center justify-between gap-3">
            {onPrecedent && courante > 0 ? (
              <button
                type="button"
                onClick={onPrecedent}
                className="eyebrow -m-2 p-2 text-text-secondary transition-colors hover:text-text-primary"
              >
                Précédent
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onSuivant}
              disabled={Boolean(empeche)}
              className="bg-accent px-5 py-2.5 text-[12.5px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-[#2b2b2b] disabled:text-text-muted"
            >
              {libelleSuivant}
            </button>
          </div>
          {promesse && <p className="eyebrow leading-[1.7] text-text-muted">{promesse}</p>}
        </footer>
      </motion.div>
    </div>
  );
}
