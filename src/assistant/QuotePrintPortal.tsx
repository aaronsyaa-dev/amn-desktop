import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Logo } from '../components/Logo';
import { triggerPrint } from '../lib/print';
import { useExclusive } from '@edition/exclusive';
import { useAuth } from '../auth/AuthContext';
import { EDITION_PRODUCT_NAME, IS_BUSINESS } from '../edition/edition';
import type { Client, Quote } from '../shared/api';

const STATUS_LABEL: Record<Quote['status'], string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
};

/**
 * Print-to-PDF preview for a quote — a clean, readable devis document rendered
 * into the shared light print-only region (see index.css `.print-root`) and
 * printed via the robust {@link triggerPrint} timing. "PDF" is "Save as PDF" in
 * the print dialog — no PDF library needed.
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
  useEffect(() => triggerPrint(onDone), [onDone]);

  const { org } = useAuth();
  const { QUOTE_OFFERS, QUOTE_ISSUER_TAGLINE } = useExclusive();
  const offer = QUOTE_OFFERS.find((o) => o.id === quote.trackerTier);
  const issued = new Date(quote.createdAt);
  const issuedLabel = issued.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const validUntil = new Date(issued.getTime() + 30 * 86400000).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  // Préfixe de référence tiré de l'organisation : « AMN-0001 » sur le devis
  // d'une cliente laisserait croire que le document vient de chez nous.
  const refPrefix = (org?.name ?? 'AMN')
    .replace(/[^A-Za-zÀ-ÿ0-9]/g, '')
    .slice(0, 3)
    .toUpperCase() || 'DEV';
  const ref = `${refPrefix}-${String(quote.id).padStart(4, '0')}`;
  const price = quote.priceEuro.toLocaleString('fr-FR');

  return createPortal(
    <div className="print-root">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between border-b border-neutral-200 pb-5">
        {/*
          Sur un devis, l'en-tête doit porter le nom de celle qui l'envoie.
          Notre logo n'apparaît que sur nos propres devis.
        */}
        {IS_BUSINESS ? (
          <p className="text-lg font-semibold text-neutral-900">{org?.name ?? ''}</p>
        ) : (
          <Logo height={30} showTagline showAppName />
        )}
        <div className="text-right text-xs text-neutral-500">
          <p className="text-base font-semibold text-neutral-800">Devis</p>
          <p className="mt-1 font-mono">Réf. {ref}</p>
          <p>Émis le {issuedLabel}</p>
          <p>Valable jusqu’au {validUntil}</p>
        </div>
      </div>

      {/* Parties */}
      <div className="mb-8 flex justify-between gap-8 text-sm">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Émetteur</p>
          {/*
            L'émetteur du devis est l'organisation connectée, pas une raison
            sociale codée en dur : sur le devis d'une cliente, « AMN DevSec »
            au lieu de son propre nom n'est pas un détail cosmétique, c'est un
            document faux.
          */}
          <p className="font-medium text-neutral-900">{org?.name ?? ''}</p>
          {QUOTE_ISSUER_TAGLINE && <p className="text-neutral-600">{QUOTE_ISSUER_TAGLINE}</p>}
        </div>
        <div className="text-right">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Client</p>
          <p className="font-medium text-neutral-900">{client.name}</p>
          {client.company && <p className="text-neutral-600">{client.company}</p>}
          {client.email && <p className="text-neutral-600">{client.email}</p>}
          {client.phone && <p className="text-neutral-600">{client.phone}</p>}
        </div>
      </div>

      <h1 className="text-xl font-bold text-neutral-900">{quote.title}</h1>
      {quote.detail && (
        <p className="mb-6 mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{quote.detail}</p>
      )}

      {/* Prestation table */}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-neutral-300 text-left text-[11px] uppercase tracking-wider text-neutral-500">
            <th className="py-2">Prestation</th>
            <th className="py-2 text-center">Qté</th>
            <th className="py-2 text-right">Prix unitaire</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-neutral-200">
            <td className="py-3 text-neutral-800">
              <p className="font-medium">{offer?.name ?? quote.trackerTier}</p>
              <p className="text-xs text-neutral-500">{offer?.tagline ?? ''}</p>
            </td>
            <td className="py-3 text-center text-neutral-700">1</td>
            <td className="py-3 text-right text-neutral-700">{price} €</td>
            <td className="py-3 text-right font-medium text-neutral-900">{price} €</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} />
            <td className="py-3 text-right text-[11px] uppercase tracking-wider text-neutral-500">Total</td>
            <td className="py-3 text-right text-lg font-bold text-neutral-900">{price} €</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-8 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
        <p>Statut : {STATUS_LABEL[quote.status]}. Devis valable 30 jours à compter de sa date d’émission.</p>
        <p className="mt-1">Prix indicatifs hors taxes. Ce document est confidentiel et généré par {EDITION_PRODUCT_NAME}.</p>
      </div>
    </div>,
    document.body,
  );
}
