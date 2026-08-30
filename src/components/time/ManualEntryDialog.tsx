import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ProjectPicker } from '../projects/ProjectPicker';
import { formatDuration, parseDurationInput } from '../../state/timeEngine';
import { useFermetureEchap } from '../../lib/useFermetureEchap';

/**
 * La saisie de secours : « j'ai oublié de lancer le chrono ».
 *
 * Volontairement en second, jamais en premier. Le geste normal est le
 * chronomètre — c'est lui qui donne une durée juste. Ouvrir l'application sur
 * un formulaire d'heures redonnerait la feuille de temps qu'on remplit le
 * vendredi soir de mémoire, c'est-à-dire faux.
 *
 * Le champ accepte ce qu'on a envie d'y taper : `2`, `2h`, `1h30`, `45min`,
 * `1,5`. Imposer une écriture unique, c'est se faire rejeter une saisie sur
 * deux — et abandonner.
 */
export function ManualEntryDialog({
  defaultDay,
  onSubmit,
  onClose,
}: {
  defaultDay: string;
  onSubmit: (values: { day: string; minutes: number; label: string; projectId?: string }) => void;
  onClose: () => void;
}) {
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

  const [day, setDay] = useState(defaultDay);
  const [duration, setDuration] = useState('');
  const [label, setLabel] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const minutes = parseDurationInput(duration);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (minutes <= 0) {
      setError('Indiquez une durée : 2h, 1h30, 45min…');
      return;
    }
    onSubmit({ day, minutes, label: label.trim(), projectId: projectId || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative flex max-h-[92vh] w-full max-w-md flex-col border border-border-strong bg-surface"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Ajouter un temps à la main
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Durée
            </span>
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              autoFocus
              placeholder="2h, 1h30, 45min…"
              className="input-focus min-h-14 w-full border border-border bg-bg px-3 text-xl font-bold text-text-primary outline-none"
            />
            {minutes > 0 && (
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                {formatDuration(minutes * 60000)}
              </span>
            )}
          </label>

          <label className="mt-4 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Jour
            </span>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Sur quoi ? (facultatif)
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Retouches photos, appel client…"
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </label>

          <ProjectPicker
            value={projectId}
            onChange={setProjectId}
            label="Projet (facultatif)"
            className="mt-4"
          />

          {error && (
            <p role="alert" className="mt-3 border border-danger/40 bg-danger-muted px-3 py-2 font-mono text-xs text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center border border-border px-3 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="flex min-h-11 items-center bg-accent px-4 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            Ajouter
          </button>
        </div>
      </motion.form>
    </div>
  );
}
