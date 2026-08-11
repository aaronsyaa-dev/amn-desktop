import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, Trash2, X } from 'lucide-react';
import { resizeImageToDataUrl } from '../../lib/imageResize';
import { centsToInput, formatCents, parsePositiveAmount } from '../../lib/money';
import { ProjectPicker } from '../projects/ProjectPicker';
import type { Expense, ExpenseConfig } from '../../state/expenseEngine';

/**
 * La saisie d'une dépense.
 *
 * ## Ce que ce formulaire refuse d'être
 *
 * Une ligne de tableur. L'ordre des champs est celui du geste réel — on
 * regarde le ticket, on tape le montant, on dit ce que c'est — et non l'ordre
 * des colonnes d'une base. Le montant occupe donc le haut de l'écran en grand,
 * et la catégorie se choisit d'une pression sur une pastille plutôt que dans
 * un menu déroulant : au pouce, un menu natif est deux gestes et une liste à
 * lire.
 *
 * ## La photo
 *
 * Elle passe par `resizeImageToDataUrl`, exactement comme la médiathèque et
 * les photos de fiches clients. Rien n'est relu, rien n'est déchiffré : on
 * garde la PREUVE, ce qui est tout ce qu'on demande à un justificatif quand
 * l'expert-comptable le réclame six mois plus tard.
 */

const MAX_DIMENSION = 1400;

export function ExpenseForm({
  config,
  expense,
  defaultDay,
  onSubmit,
  onDelete,
  onClose,
}: {
  config: ExpenseConfig;
  /** Absent = création. Présent = modification de cette dépense. */
  expense?: Expense;
  /** Jour proposé à la création — le jour affiché à l'écran, pas forcément aujourd'hui. */
  defaultDay: string;
  onSubmit: (values: {
    amountCents: number;
    category: string;
    spentAt: string;
    note: string;
    photoDataUrl: string;
    projectId?: string;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(expense ? centsToInput(expense.amountCents) : '');
  const [category, setCategory] = useState(
    expense?.category || config.categories[0]?.key || 'autre',
  );
  const [spentAt, setSpentAt] = useState(expense?.spentAt || defaultDay);
  const [note, setNote] = useState(expense?.note ?? '');
  const [photo, setPhoto] = useState(expense?.photoDataUrl ?? '');
  const [projectId, setProjectId] = useState(expense?.projectId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const amountCents = parsePositiveAmount(amount);

  const pickPhoto = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choisissez une photo (une image).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setPhoto(await resizeImageToDataUrl(file, MAX_DIMENSION));
    } catch {
      setError('Impossible de lire cette image.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // Un montant à zéro n'est pas une dépense : plutôt que de l'enregistrer et
    // de fausser le total du mois en silence, on le dit ici.
    if (amountCents <= 0) {
      setError('Indiquez un montant.');
      return;
    }
    onSubmit({
      amountCents,
      category,
      spentAt,
      note: note.trim(),
      photoDataUrl: photo,
      projectId: projectId || undefined,
    });
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
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col border border-border-strong bg-surface"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            {expense ? 'Modifier la dépense' : 'Nouvelle dépense'}
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
          {/* ------------------------------------------------- montant ----- */}
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Montant payé
            </span>
            <div className="flex items-baseline gap-2 border border-border bg-bg px-3 py-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                /* `decimal` et non `numeric` : c'est le pavé qui porte la
                   virgule sur iOS comme sur Android. */
                inputMode="decimal"
                autoFocus
                placeholder="0,00"
                aria-label="Montant payé, en euros"
                className="min-w-0 flex-1 bg-transparent text-3xl font-bold tabular-nums text-text-primary outline-none"
              />
              <span className="flex-shrink-0 text-xl font-bold text-text-muted">€</span>
            </div>
            {amountCents > 0 && (
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                {formatCents(amountCents)}
              </span>
            )}
          </label>

          {/* ------------------------------------------------ catégorie ---- */}
          <p className="mb-1 mt-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Catégorie
          </p>
          <div className="flex flex-wrap gap-2">
            {config.categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                aria-pressed={category === cat.key}
                className={`flex min-h-11 items-center border px-3 text-sm transition-colors ${
                  category === cat.key
                    ? 'border-accent bg-accent-muted text-text-primary'
                    : 'border-border text-text-secondary hover:border-border-strong'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* ---------------------------------------------------- jour ----- */}
          <label className="mt-4 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Date
            </span>
            <input
              type="date"
              value={spentAt}
              onChange={(e) => setSpentAt(e.target.value)}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </label>

          {/* ---------------------------------------------------- note ----- */}
          <label className="mt-4 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Note (facultatif)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Taxi retour salon, ramette A4…"
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </label>

          <ProjectPicker
            value={projectId}
            onChange={setProjectId}
            label="Projet (facultatif)"
            className="mt-4"
          />

          {/* --------------------------------------------------- photo ----- */}
          <p className="mb-1 mt-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Justificatif (facultatif)
          </p>
          {photo ? (
            <div className="flex items-start gap-3">
              <img
                src={photo}
                alt="Justificatif"
                className="h-28 w-28 flex-shrink-0 border border-border object-cover"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex min-h-11 items-center gap-2 border border-border px-3 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                >
                  <Camera size={15} strokeWidth={1.75} />
                  Remplacer
                </button>
                <button
                  type="button"
                  onClick={() => setPhoto('')}
                  className="flex min-h-11 items-center gap-2 border border-border px-3 text-sm text-text-muted transition-colors hover:border-danger hover:text-danger"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                  Retirer
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex min-h-[4.5rem] w-full items-center justify-center gap-2 border border-dashed border-border text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} strokeWidth={1.75} />}
              Photographier le reçu
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            /* `capture` ouvre directement l'appareil photo sur mobile : c'est
               le geste attendu devant une caisse, pas la galerie. */
            capture="environment"
            hidden
            onChange={(e) => void pickPhoto(e.target.files)}
          />

          {error && (
            <p role="alert" className="mt-3 border border-danger/40 bg-danger-muted px-3 py-2 font-mono text-xs text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 border-t border-border p-3">
          {onDelete && (
            <button
              type="button"
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              onBlur={() => setConfirmDelete(false)}
              className={`flex min-h-11 items-center gap-1.5 border px-3 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                confirmDelete
                  ? 'border-danger bg-danger-muted text-danger'
                  : 'border-border text-text-muted hover:text-danger'
              }`}
            >
              <Trash2 size={14} strokeWidth={2} />
              {confirmDelete ? 'Confirmer' : 'Supprimer'}
            </button>
          )}
          <button
            type="submit"
            className="ml-auto flex min-h-11 flex-1 items-center justify-center bg-accent px-4 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover sm:flex-none"
          >
            {expense ? 'Enregistrer' : 'Ajouter la dépense'}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
