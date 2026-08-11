import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { centsToInput, formatCents, parsePositiveAmount } from '../../lib/money';
import { formatDuration, msToBillableHours, totalMs, type TimeEntry } from '../../state/timeEngine';

/**
 * Un temps passé qui devient une ligne de facture.
 *
 * ## Pourquoi ce n'est pas automatique
 *
 * C'est le point du bloc 3, et c'est une décision, pas une simplification. Une
 * facturation automatique du temps enregistré produit tôt ou tard une facture
 * qu'on n'a pas voulue : le chrono resté ouvert pendant le déjeuner, l'heure
 * offerte à un client fidèle, la reprise d'un travail mal fait qui ne se
 * facture pas deux fois. L'utilisatrice choisit donc — quel projet, combien
 * d'heures, à quel tarif — et ce qu'elle valide part en BROUILLON de facture,
 * qu'elle relit avant d'émettre.
 *
 * ## Ce qui se passe après
 *
 * Les périodes reportées sont marquées comme facturées. Elles restent
 * visibles dans l'historique — supprimer un temps parce qu'il est facturé
 * ferait disparaître la preuve du travail — mais elles ne seront plus
 * proposées une seconde fois.
 */
export function TimeInvoiceDialog({
  projectTitle,
  clientName,
  entries,
  defaultRateCents,
  onConfirm,
  onClose,
}: {
  projectTitle: string;
  /** Vide si le projet n'a pas de client : on le dit au lieu de laisser deviner. */
  clientName: string;
  /** Les périodes terminées, non encore facturées, de ce projet. */
  entries: TimeEntry[];
  defaultRateCents: number;
  onConfirm: (values: { hours: number; rateCents: number; entryIds: string[] }) => void;
  onClose: () => void;
}) {
  const [rate, setRate] = useState(defaultRateCents > 0 ? centsToInput(defaultRateCents) : '');
  const [hoursInput, setHoursInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const measuredMs = useMemo(() => totalMs(entries, Date.now()), [entries]);
  const measuredHours = msToBillableHours(measuredMs);
  // Le champ vide vaut le temps mesuré : le cas courant est « facture ce que
  // j'ai passé », et il ne doit demander aucune saisie.
  const hours = hoursInput.trim() ? Math.max(0, Number(hoursInput.replace(',', '.'))) : measuredHours;
  const rateCents = parsePositiveAmount(rate);
  const totalCents = Math.round(hours * rateCents);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isFinite(hours) || hours <= 0) {
      setError('Aucune heure à facturer.');
      return;
    }
    if (rateCents <= 0) {
      setError('Indiquez un tarif horaire.');
      return;
    }
    onConfirm({ hours, rateCents, entryIds: entries.map((e) => e.id) });
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
            Facturer ce temps
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
          <p className="text-sm text-text-primary">{projectTitle || 'Sans projet'}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {clientName ? clientName : 'Aucun client sur ce projet'}
            {' · '}
            {entries.length} période{entries.length > 1 ? 's' : ''} · {formatDuration(measuredMs)}
          </p>

          {!clientName && (
            <p className="mt-3 border border-border px-3 py-2 text-xs leading-relaxed text-text-secondary">
              Ce projet n’est rattaché à aucun client. Le brouillon sera créé sans destinataire —
              vous choisirez le client dans Facturation avant d’émettre.
            </p>
          )}

          <label className="mt-4 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Heures à facturer
            </span>
            <input
              value={hoursInput}
              onChange={(e) => setHoursInput(e.target.value)}
              inputMode="decimal"
              placeholder={String(measuredHours).replace('.', ',')}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm tabular-nums text-text-primary outline-none"
            />
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Temps mesuré : {measuredHours.toString().replace('.', ',')} h — modifiable
            </span>
          </label>

          <label className="mt-4 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Tarif horaire
            </span>
            <div className="flex min-h-11 items-center border border-border bg-bg px-3">
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="min-w-0 flex-1 bg-transparent text-sm tabular-nums text-text-primary outline-none"
              />
              <span className="ml-1 flex-shrink-0 text-sm text-text-muted">€ / h</span>
            </div>
          </label>

          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Ligne de facture
            </span>
            <span className="text-xl font-bold tabular-nums text-text-primary">
              {formatCents(totalCents)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Un BROUILLON de facture est créé. Rien n’est émis, rien n’est envoyé : vous le relisez
            dans Facturation, et c’est là que la TVA et le numéro sont posés.
          </p>

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
            Créer le brouillon
          </button>
        </div>
      </motion.form>
    </div>
  );
}
