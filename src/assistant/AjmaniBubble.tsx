import React, { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Mic, Sparkles, X } from 'lucide-react';
import { useAssistant, previewOfTurn } from './AssistantContext';
import { messageEchecVocal } from './voix';

const INACTIVITE_MS = 20_000;

/**
 * LA BULLE — dire ou déclencher Ajmani (F9) fait apparaître ceci, jamais un changement de page ni
 * le panneau plein (`AssistantPanel`). Petite fenêtre flottante dans le style Signes Vitaux : un
 * fond, une bordure fine, rien de superflu. Montre l'ordre, la réponse courte, l'état d'écoute —
 * « Lire les détails » ouvre le panneau plein SEULEMENT sur demande, la bulle reste le défaut.
 *
 * Se ferme sur Échap, un clic dehors, ou l'inactivité après une réponse — jamais en perdant la
 * conversation : `messages` vit dans `AssistantProvider`, pas ici, donc rouvrir (F9, ou le clic sur
 * le petit point qui reste quand la bulle est fermée) retrouve exactement où on en était.
 */
export function AjmaniBubble() {
  const { bulleOuverte, ouvrirBulle, fermerBulle, voixEtat, voixRaison, voixNiveau, messages, isThinking, open } =
    useAssistant();
  const conteneurRef = useRef<HTMLDivElement>(null);
  const inactiviteRef = useRef<number | null>(null);

  const dernierEchange = useMemo(() => {
    const dernier = messages[messages.length - 1];
    const avantDernier = messages[messages.length - 2];
    if (!dernier) return null;
    if (dernier.role === 'assistant') return { question: avantDernier?.text ?? null, reponse: previewOfTurn(dernier.turn) };
    return { question: dernier.text ?? null, reponse: null };
  }, [messages]);

  // Échap et clic dehors ferment la bulle — jamais la conversation, qui reste dans le contexte.
  useEffect(() => {
    if (!bulleOuverte) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermerBulle();
    };
    const onClickDehors = (e: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) fermerBulle();
    };
    window.addEventListener('keydown', onKey);
    // `mousedown`, pas `click` : évite de fermer sur le même geste qui vient d'ouvrir la bulle (F9 + clic simultané).
    window.addEventListener('mousedown', onClickDehors);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickDehors);
    };
  }, [bulleOuverte, fermerBulle]);

  // Inactivité : une fois la réponse posée et le micro silencieux, la bulle s'efface d'elle-même —
  // jamais pendant l'écoute ou la transcription, qui sont déjà des états actifs.
  useEffect(() => {
    if (inactiviteRef.current) window.clearTimeout(inactiviteRef.current);
    if (!bulleOuverte || voixEtat === 'enregistrement' || voixEtat === 'transcription') return;
    inactiviteRef.current = window.setTimeout(() => fermerBulle(), INACTIVITE_MS);
    return () => {
      if (inactiviteRef.current) window.clearTimeout(inactiviteRef.current);
    };
  }, [bulleOuverte, voixEtat, messages, fermerBulle]);

  const lireLesDetails = () => {
    fermerBulle();
    open('chat');
  };

  if (!bulleOuverte) {
    // Discrète au repos : un point, retrouvable, jamais absent — la conversation n'a pas disparu.
    return (
      <button
        type="button"
        onClick={ouvrirBulle}
        title="Ouvrir Ajmani (ou F9)"
        aria-label="Ouvrir Ajmani"
        className="fixed bottom-[72px] right-4 z-[55] flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-muted opacity-70 shadow-md transition-opacity duration-200 hover:opacity-100 md:bottom-5 md:right-5"
      >
        <Sparkles size={15} strokeWidth={1.9} />
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={conteneurRef}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="fixed bottom-[72px] right-4 z-[55] w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface shadow-[0_16px_48px_rgba(0,0,0,0.35)] md:bottom-5 md:right-5"
        role="dialog"
        aria-label="Ajmani"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-muted text-accent">
              <Sparkles size={12} strokeWidth={2} />
            </span>
            <span className="text-xs font-medium text-text-primary">Ajmani</span>
          </div>
          <button
            type="button"
            onClick={fermerBulle}
            aria-label="Fermer"
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex flex-col gap-2 px-3.5 py-3">
          {voixEtat === 'enregistrement' ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Mic
                size={14}
                className="text-danger"
                style={{ transform: `scale(${1 + voixNiveau * 0.4})`, transition: 'transform 60ms linear' }}
              />
              Écoute…
            </div>
          ) : voixEtat === 'transcription' ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 size={14} className="animate-spin" />
              Transcription…
            </div>
          ) : voixEtat === 'echec' && voixRaison ? (
            <p className="text-sm text-danger">{messageEchecVocal(voixRaison)}</p>
          ) : dernierEchange ? (
            <>
              {dernierEchange.question && (
                <p className="text-sm text-text-secondary">{dernierEchange.question}</p>
              )}
              <p className="text-sm text-text-primary">
                {isThinking ? '…' : dernierEchange.reponse}
              </p>
            </>
          ) : (
            <p className="text-sm text-text-muted">Tenez F9 et parlez, ou posez une question.</p>
          )}
        </div>

        {dernierEchange && voixEtat !== 'enregistrement' && voixEtat !== 'transcription' && (
          <div className="border-t border-border px-3.5 py-2">
            <button
              type="button"
              onClick={lireLesDetails}
              className="text-xs text-text-muted underline decoration-border underline-offset-2 transition-colors hover:text-text-primary hover:decoration-text-primary"
            >
              Lire les détails
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
