import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, ChevronDown, CircleAlert, Info } from 'lucide-react';
import type { AttentionState } from '../state/useAttention';
import { formatCentsCompact } from '../lib/money';
import type { AttentionItem, AttentionSeverity } from '../lib/attention';

/**
 * Points d'attention, sur l'accueil.
 *
 * ## Trois états, pas deux
 *
 * La première version n'en avait que deux : des alertes, ou rien du tout. Elle
 * était fausse à l'usage — Aaron a cherché le bloc, ne l'a pas vu, et n'avait
 * aucun moyen de savoir s'il n'y avait rien à signaler ou si le bloc était
 * cassé. Un silence qui ne se distingue pas d'une panne n'informe de rien.
 *
 *   1. Pas encore évalué  → rien. On n'affirme pas « tout va bien » avant
 *                           d'avoir regardé.
 *   2. Évalué, rien à dire → UNE ligne discrète, avec l'heure du contrôle.
 *                           C'est la preuve que le mécanisme a tourné.
 *   3. Des points          → la liste.
 *
 * L'état 2 reste volontairement une ligne et non un encadré : un grand cadre
 * « 0 point d'attention » occuperait tous les jours la place de quelque chose
 * d'utile, et apprendrait à ne plus regarder cet endroit de l'écran.
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
    // Posée sur la liste à filet (`bg-border`, #262626), l'encre rouge donne
    // 4,38 — sous le seuil. `--color-danger-ink` est le même rouge d'un cran
    // plus clair : 4,86 ici, 6,68 sur le fond principal.
    text: 'text-danger-ink',
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

/**
 * L'ÉTAT VIENT DE L'ÉCRAN, il n'est plus relu ici.
 *
 * Le panneau appelait `useAttention()` lui-même. C'était commode tant que
 * personne d'autre n'en avait besoin — mais la salutation d'accueil doit
 * savoir, elle aussi, s'il y a quelque chose à traiter : elle affirmait « la
 * nuit est calme » au-dessus de vingt et un points d'attention.
 *
 * Deux appels auraient donné deux évaluations, deux minuteries de soixante
 * secondes et deux lectures d'incidents — pour deux vérités qui peuvent
 * diverger d'un rendu à l'autre. L'écran évalue une fois et passe l'état ici.
 */
export function AttentionPanel({
  state,
  className = '',
}: {
  state: AttentionState;
  className?: string;
}) {
  const { items, checkedAt } = state;
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  // État 1 : rien n'a encore été évalué. On se tait plutôt que d'annoncer un
  // calme qu'on n'a pas vérifié.
  if (!checkedAt) return null;

  // État 2 : évalué, rien à signaler. Une ligne, et l'heure — c'est ce qui
  // manquait et ce qui a fait chercher le bloc en vain.
  if (items.length === 0) return <NothingToReport checkedAt={checkedAt} className={className} />;

  const shown = expanded ? items : items.slice(0, VISIBLE);
  const hidden = items.length - shown.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Points d’attention"
      className={className}
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

/**
 * « J'ai regardé, il n'y a rien. »
 *
 * L'heure n'est pas décorative : c'est elle qui distingue un contrôle qui a
 * tourné d'un bloc qui ne s'affiche pas.
 */
function NothingToReport({ checkedAt, className = '' }: { checkedAt: string; className?: string }) {
  const time = new Date(checkedAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.35, duration: 0.7 }}
      aria-label="Points d’attention"
      className={`flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted ${className}`}
    >
      <Check size={12} strokeWidth={2.5} className="flex-shrink-0 text-success" />
      Points d’attention · rien à signaler · vérifié à {time}
    </motion.p>
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
