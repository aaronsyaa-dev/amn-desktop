import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronDown, CircleAlert, Info } from 'lucide-react';
import { useAttention } from '../state/useAttention';
import { formatCentsCompact } from '../lib/money';
import type { AttentionItem, AttentionSeverity } from '../lib/attention';

/**
 * Points d'attention, sur l'accueil.
 *
 * ## Pourquoi ce bloc n'apparaît pas toujours
 *
 * L'accueil est délibérément calme. Un encadré « 0 point d'attention »
 * occuperait tous les jours la place de quelque chose d'utile et
 * apprendrait à ne plus regarder cet endroit de l'écran. Quand il n'y a rien,
 * il n'y a rien : c'est le silence qui porte l'information.
 *
 * ## Pourquoi seulement trois éléments
 *
 * Une liste de quinze alertes n'est pas une liste d'alertes, c'est une
 * archive. Les trois plus urgentes sont montrées, le reste se déplie — ce qui
 * garde la promesse « ce que je vois d'abord est ce qui compte le plus »
 * sans rien cacher.
 */

const SEVERITY: Record<
  AttentionSeverity,
  { icon: typeof AlertTriangle; text: string; border: string; bg: string }
> = {
  critical: {
    icon: CircleAlert,
    text: 'text-danger',
    border: 'border-danger/40',
    bg: 'bg-danger-muted',
  },
  warning: {
    icon: AlertTriangle,
    text: 'text-warning',
    border: 'border-warning/40',
    bg: 'bg-warning-muted',
  },
  info: { icon: Info, text: 'text-text-muted', border: 'border-border', bg: 'bg-surface' },
};

const VISIBLE = 3;

export function AttentionPanel() {
  const { items } = useAttention();
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  if (items.length === 0) return null;

  const shown = expanded ? items : items.slice(0, VISIBLE);
  const hidden = items.length - shown.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Points d’attention"
      className="mt-10"
    >
      <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
        {items.length === 1 ? 'Un point d’attention' : `${items.length} points d’attention`}
      </p>

      <ul className="flex flex-col gap-px overflow-hidden rounded-2xl border border-border bg-border">
        <AnimatePresence initial={false}>
          {shown.map((entry) => (
            <motion.li
              key={entry.key}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Row item={entry} onGo={() => navigate(entry.to)} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {(hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mx-auto mt-2 flex min-h-11 items-center gap-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text-secondary md:min-h-0 md:py-2"
        >
          {expanded ? 'Réduire' : `${hidden} de plus`}
          <ChevronDown
            size={13}
            strokeWidth={2}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </motion.section>
  );
}

function Row({ item, onGo }: { item: AttentionItem; onGo: () => void }) {
  const tone = SEVERITY[item.severity];
  const Icon = tone.icon;

  return (
    <button
      type="button"
      onClick={onGo}
      className={`group flex w-full min-h-11 items-start gap-3 px-4 py-3 text-left transition-colors ${tone.bg} hover:bg-surface-hover`}
    >
      <Icon size={15} strokeWidth={2} className={`mt-0.5 flex-shrink-0 ${tone.text}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-text-primary">{item.title}</span>
        {/*
          La preuve, toujours affichée à côté du titre. C'est ce qui distingue
          un signal d'une impression : « échue depuis 34 jours » se vérifie,
          « facture à surveiller » ne se vérifie pas.
        */}
        <span className="mt-0.5 block text-xs leading-tight text-text-muted">
          <span className={tone.text}>{item.evidence}</span>
          {item.amountCents !== undefined && ` · ${formatCentsCompact(item.amountCents)}`}
          {item.action && ` — ${item.action}`}
        </span>
      </span>
    </button>
  );
}
