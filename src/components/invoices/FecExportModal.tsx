import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, Download, FileSpreadsheet, X } from 'lucide-react';
import { buildFec, closingDay, fecFileName, toFecFile } from '../../lib/fec';
import { downloadText } from '../../lib/download';
import { formatCents } from '../../lib/money';
import type { BillingIdentity, Invoice } from '../../shared/api';
import { useFermetureEchap } from '../../lib/useFermetureEchap';

/**
 * Export comptable au format FEC.
 *
 * L'écran ne se contente pas de poser un bouton « Exporter ». Il montre
 * D'ABORD ce que le fichier contiendra, et surtout ce qu'il ne contiendra pas.
 * Un export comptable qui sort silencieusement en écartant trois factures est
 * pire que pas d'export du tout : la cliente croit avoir remis sa comptabilité
 * complète, et découvre le contraire au moment où c'est le plus coûteux.
 *
 * D'où les deux éléments qui occupent le plus de place ici : le contrôle
 * d'équilibre (débit = crédit, affiché en clair) et la liste des réserves.
 */
export function FecExportModal({
  invoices,
  identity,
  onClose,
}: {
  invoices: Invoice[];
  identity: BillingIdentity;
  onClose: () => void;
}) {
  /* Les exercices réellement présents, du plus récent au plus ancien. Proposer
     une année sans la moindre facture ne sert personne. */
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

  const years = useMemo(() => {
    const found = new Set<number>();
    for (const invoice of invoices) {
      if (invoice.status === 'draft') continue;
      const year = Number(String(invoice.issuedAt).slice(0, 4));
      if (Number.isFinite(year) && year > 1990) found.add(year);
    }
    found.add(new Date().getFullYear());
    return [...found].sort((a, b) => b - a);
  }, [invoices]);

  const [year, setYear] = useState<number>(years[0]);
  const [done, setDone] = useState(false);

  const result = useMemo(() => buildFec(invoices, { year }), [invoices, year]);
  const balanced = result.totalDebitCents === result.totalCreditCents;
  const fileName = fecFileName(identity.siret, closingDay(year));

  const download = () => {
    downloadText(toFecFile(result.lines), fileName, 'text/plain');
    setDone(true);
    window.setTimeout(() => setDone(false), 2600);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        role="dialog"
        aria-label="Export comptable FEC"
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col border border-border-strong bg-surface"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            <FileSpreadsheet size={14} strokeWidth={1.75} />
            Export comptable · FEC
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
          <p className="text-xs leading-relaxed text-text-secondary">
            Le <strong className="font-semibold text-text-primary">Fichier des Écritures
            Comptables</strong> est le format que l’administration fiscale exige en cas de contrôle
            (art. L47 A du LPF). Il contient le journal des ventes : une écriture par facture émise,
            en partie double.
          </p>

          {/* --------------------------- L'exercice --------------------------- */}
          <div className="mt-4">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Exercice
            </span>
            <div className="flex flex-wrap gap-1.5">
              {years.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setYear(value)}
                  aria-pressed={year === value}
                  className={`flex min-h-11 items-center border px-3 font-mono text-xs tabular-nums transition-colors md:min-h-0 md:py-1.5 ${
                    year === value
                      ? 'border-border-strong bg-accent-muted text-text-primary'
                      : 'border-border text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {/* ------------------------- Ce qui sortira -------------------------- */}
          <dl className="mt-4 grid grid-cols-2 gap-px border border-border bg-border">
            <Cell label="Factures" value={String(result.invoiceCount)} />
            <Cell label="Lignes d’écriture" value={String(result.lines.length)} />
            <Cell label="Total débit" value={formatCents(result.totalDebitCents)} />
            <Cell label="Total crédit" value={formatCents(result.totalCreditCents)} />
          </dl>

          {/*
            L'équilibre est le seul contrôle qui dit si le fichier est
            comptablement valide. Il est calculé, pas affirmé — et affiché même
            quand tout va bien, parce qu'un indicateur qui n'apparaît qu'en cas
            de problème n'apprend à personne qu'il existe.
          */}
          <div
            className={`mt-px flex items-center gap-2 border px-3 py-2 ${
              balanced ? 'border-border bg-surface' : 'border-danger/50 bg-danger-muted'
            }`}
          >
            {balanced ? (
              <Check size={14} strokeWidth={2.5} className="flex-shrink-0 text-success" />
            ) : (
              <AlertTriangle size={14} strokeWidth={2} className="flex-shrink-0 text-danger" />
            )}
            <span className="text-xs leading-tight text-text-secondary">
              {balanced
                ? 'Partie double équilibrée : la somme des débits égale celle des crédits.'
                : 'Écritures déséquilibrées. N’envoyez pas ce fichier — signalez l’anomalie.'}
            </span>
          </div>

          {result.invoiceCount === 0 && (
            <p className="mt-3 border border-border bg-bg px-3 py-2 text-xs leading-relaxed text-text-muted">
              Aucune facture émise sur cet exercice. Le fichier ne contiendrait que sa ligne
              d’en-tête.
            </p>
          )}

          {/* --------------------------- Les réserves -------------------------- */}
          <div className="mt-4">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              À savoir avant de remettre le fichier
            </span>
            <ul className="space-y-1.5">
              {result.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex gap-2 border border-border bg-bg px-3 py-2 text-xs leading-relaxed text-text-secondary"
                >
                  <span aria-hidden className="select-none text-text-muted">
                    —
                  </span>
                  <span className="min-w-0 flex-1">{warning}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Nom du fichier
          </p>
          <p className="mt-1 break-all font-mono text-xs text-text-secondary">{fileName}</p>
          {!identity.siret && (
            <p className="mt-1.5 text-xs leading-relaxed text-warning">
              Le nom normalisé commence par votre SIREN. Renseignez le SIRET dans les coordonnées de
              facturation : un numéro inventé serait pire qu’absent.
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={download}
            disabled={result.lines.length === 0}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {done ? <Check size={16} strokeWidth={2.5} /> : <Download size={16} strokeWidth={2} />}
            {done ? 'Fichier téléchargé' : 'Télécharger le FEC'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 border border-border px-4 text-xs uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}
