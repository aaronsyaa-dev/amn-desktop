import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AtSign, Command, HelpCircle, Keyboard, MessageSquarePlus, Sparkles, X } from 'lucide-react';

function useModifierKey(): string {
  const [key, setKey] = useState('Ctrl');
  useEffect(() => {
    const isMac = /mac/i.test(navigator.platform || navigator.userAgent);
    setKey(isMac ? '⌘' : 'Ctrl');
  }, []);
  return key;
}

interface HelpItem {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  body: string;
  keys?: string[];
}

/** A discreet "?" button that opens a quick reference; also bound to the "?" key. */
export function HelpButton() {
  const [open, setOpen] = useState(false);

  // Global "?" opens help — but never while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Aide rapide (?)"
        aria-label="Aide rapide"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-muted transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
      >
        <HelpCircle size={16} strokeWidth={1.75} />
      </button>
      <HelpOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const modKey = useModifierKey();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const items: HelpItem[] = [
    {
      icon: Command,
      title: 'Recherche universelle',
      body: 'Ouvrez la palette pour aller partout, trouver un site, un client, une tâche ou une action — sans quitter le clavier.',
      keys: [modKey, 'K'],
    },
    {
      icon: AtSign,
      title: 'Mentionner un site ou un client',
      body: 'Dans le chat de l’équipe, tapez « @ » puis le nom d’un site ou d’un client. La mention devient un raccourci cliquable vers sa fiche.',
    },
    {
      icon: MessageSquarePlus,
      title: 'Messages rapides',
      body: 'Le bouton « messages rapides » du chat insère un modèle prêt à l’emploi. Vous pouvez ajouter et retirer vos propres modèles.',
    },
    {
      icon: Sparkles,
      title: 'Ajmani',
      body: 'Ajmani, l’assistant IA, analyse vos sites et vos clients en temps réel, répond à vos questions (y compris générales) et génère des rapports depuis n’importe quel écran.',
    },
    {
      icon: Keyboard,
      title: 'Raccourcis utiles',
      body: 'Entrée envoie un message, Maj+Entrée insère un retour à la ligne, Échap ferme les panneaux. « ? » rouvre cette aide.',
      keys: ['?'],
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Aide rapide"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg">
                  <HelpCircle size={16} className="text-text-primary" />
                </span>
                <h2 className="text-lg font-bold tracking-tight text-text-primary">Aide rapide</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] divide-y divide-border/60 overflow-y-auto px-6">
              {items.map((item) => (
                <div key={item.title} className="flex gap-3.5 py-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-bg text-text-secondary">
                    <item.icon size={15} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                      {item.keys && (
                        <span className="flex items-center gap-1">
                          {item.keys.map((k) => (
                            <kbd
                              key={k}
                              className="border border-border px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-secondary"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-text-secondary">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
