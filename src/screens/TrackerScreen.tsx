import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Lock, Sparkles } from 'lucide-react';
import { trackerCatalog, type TrackerOffer } from '../data/trackerCatalog';
import { StarRating } from '../components/StarRating';
import { staggerContainer, staggerItem } from '../lib/transitions';

const AVAILABILITY_LABEL: Record<TrackerOffer['availability'], string> = {
  available: 'DISPONIBLE',
  'coming-soon': 'À VENIR',
  locked: 'VERROUILLÉ',
};

export function TrackerScreen() {
  const [openSnippetId, setOpenSnippetId] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          Trackers
        </h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
          Catalogue des offres de supervision installables sur un site cible
        </p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="flex gap-4 overflow-x-auto pb-4"
      >
        {trackerCatalog.map((offer) => (
          <motion.div key={offer.id} variants={staggerItem} className="flex-shrink-0">
            <TrackerCard
              offer={offer}
              snippetOpen={openSnippetId === offer.id}
              onToggleSnippet={() =>
                setOpenSnippetId((id) => (id === offer.id ? null : offer.id))
              }
            />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function TrackerCard({
  offer,
  snippetOpen,
  onToggleSnippet,
}: {
  offer: TrackerOffer;
  snippetOpen: boolean;
  onToggleSnippet: () => void;
}) {
  const available = offer.availability === 'available';
  const locked = offer.availability === 'locked';

  return (
    <div
      className={`flex h-full w-80 flex-col border ${
        available ? 'border-border-strong' : 'border-border'
      } bg-surface`}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Palier {offer.tier}
        </span>
        <span
          className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${
            available ? 'text-text-primary' : 'text-text-muted'
          }`}
        >
          {locked && <Lock size={11} strokeWidth={2} />}
          {AVAILABILITY_LABEL[offer.availability]}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-2xl font-bold text-text-primary">{offer.name}</h2>
        <p className="mt-1 font-mono text-xs uppercase tracking-wide text-text-secondary">
          {offer.tagline}
        </p>

        <div className="mt-3">
          <StarRating value={offer.rating} />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-text-secondary">
          {offer.description}
        </p>

        <ul className="mt-4 flex flex-1 flex-col gap-1.5">
          {offer.features.map((feature) => (
            <li
              key={feature}
              className={`flex items-start gap-2 text-xs ${
                available ? 'text-text-secondary' : 'text-text-muted'
              }`}
            >
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-current" />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-5">
          {available ? (
            <button
              type="button"
              onClick={onToggleSnippet}
              className="flex w-full items-center justify-center gap-2 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <Sparkles size={15} strokeWidth={2} />
              {snippetOpen ? 'Masquer le code' : "Voir le code d'installation"}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 border border-border px-3 py-2.5 text-sm font-medium text-text-muted"
            >
              <Lock size={14} strokeWidth={2} />
              Bientôt disponible
            </button>
          )}
        </div>
      </div>

      {available && snippetOpen && offer.installSnippet && (
        <SnippetPanel snippet={offer.installSnippet} packageHint={offer.packageHint} />
      )}
    </div>
  );
}

function SnippetPanel({
  snippet,
  packageHint,
}: {
  snippet: string;
  packageHint?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API unavailable — the user can still select the text manually.
    }
  };

  return (
    <div className="border-t border-border-strong">
      {packageHint && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="font-mono text-[10px] text-text-muted">npm install {packageHint}</span>
        </div>
      )}
      <div className="relative">
        <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap break-words bg-bg p-4 pr-16 font-mono text-[12px] leading-relaxed text-text-primary">
          {snippet}
        </pre>
        <button
          type="button"
          onClick={copy}
          className="absolute right-3 top-3 flex items-center gap-1.5 border border-border-strong bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:bg-surface-hover"
        >
          {copied ? (
            <>
              <Check size={11} strokeWidth={2.5} />
              Copié
            </>
          ) : (
            <>
              <Copy size={11} strokeWidth={2} />
              Copier
            </>
          )}
        </button>
      </div>
    </div>
  );
}
