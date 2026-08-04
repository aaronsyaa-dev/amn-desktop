import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface ActionButtonProps {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  activeLabel: string;
}

/**
 * Mock security action with a confirmation state: a click toggles the button
 * into an "engaged" red state with a check icon. No real backend logic —
 * purely a visual affordance for the demo.
 */
export function ActionButton({
  icon: Icon,
  label,
  activeLabel,
}: ActionButtonProps) {
  const [engaged, setEngaged] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setEngaged((v) => !v)}
      aria-pressed={engaged}
      className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors duration-200 active:scale-[0.99] ${
        engaged
          ? 'border-danger/40 bg-danger-muted text-danger'
          : 'border-border bg-surface-hover text-text-secondary hover:border-white/15 hover:text-text-primary'
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 ${
          engaged ? 'bg-danger/15 text-danger' : 'bg-white/5 text-text-secondary'
        }`}
      >
        {engaged ? (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          >
            <Check size={16} strokeWidth={2.25} />
          </motion.span>
        ) : (
          <Icon size={16} strokeWidth={1.75} />
        )}
      </span>
      <span className="flex-1 text-left">{engaged ? activeLabel : label}</span>
      {engaged && (
        <span className="text-xs font-semibold uppercase tracking-wide text-danger/80">
          Actif
        </span>
      )}
    </button>
  );
}
