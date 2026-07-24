import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Logo } from '../components/Logo';
import { trackerCatalog } from '../data/trackerCatalog';
import type { Client, Quote } from '../shared/api';

/**
 * Print-to-PDF preview for a quote — same portal/print-root pattern as the
 * assistant's report export (see PrintPortal.tsx): renders into a light
 * print-only region and triggers the browser/Electron print dialog.
 */
export function QuotePrintPortal({
  quote,
  client,
  onDone,
}: {
  quote: Quote;
  client: Client;
  onDone: () => void;
}) {
  useEffect(() => {
    const handleAfterPrint = () => onDone();
    window.addEventListener('afterprint', handleAfterPrint);
    const raf = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [onDone]);

  const offer = trackerCatalog.find((o) => o.id === quote.trackerTier);
  const issued = new Date(quote.createdAt).toLocaleDateString('fr-FR');

  return createPortal(
    <div className="print-root">
      <div className="mb-8 flex items-center justify-between border-b border-neutral-200 pb-5">
        <Logo height={30} showTagline showAppName />
        <div className="text-right text-xs text-neutral-500">
          <p className="font-medium text-neutral-700">Devis</p>
          <p>Émis le {issued}</p>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-neutral-900">{quote.title}</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        Pour {client.name}
        {client.company ? ` · ${client.company}` : ''}
      </p>

      {quote.detail && (
        <p className="mb-6 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{quote.detail}</p>
      )}

      <div className="mb-6 border border-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <span className="text-sm text-neutral-600">Offre</span>
          <span className="text-sm font-medium text-neutral-900">{offer?.name ?? quote.trackerTier}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-neutral-600">Montant</span>
          <span className="text-lg font-bold text-neutral-900">
            {quote.priceEuro.toLocaleString('fr-FR')} €
          </span>
        </div>
      </div>

      {client.email && <p className="text-xs text-neutral-500">Contact : {client.email}</p>}

      <p className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-400">
        Document généré par AMN Desktop · confidentiel
      </p>
    </div>,
    document.body,
  );
}
