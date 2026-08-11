import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { triggerPrint } from '../lib/print';
import { formatCents, formatVatRate, lineAmounts } from '../lib/money';
import { formatDay, invoiceTotals } from '../state/useInvoices';
import type { BillingIdentity, Invoice } from '../shared/api';

/**
 * Le document imprimé — une vraie facture, pas une capture d'écran mise au
 * propre.
 *
 * Ce composant est l'endroit où le module tient ou ne tient pas ses promesses :
 * ce qui sort d'ici part chez un client, chez un comptable, et éventuellement
 * devant un contrôle. Il porte donc les mentions rendues obligatoires par le
 * code de commerce et le CGI, et chacune vient de données réelles, jamais d'un
 * texte décoratif :
 *
 *   - numéro, date d'émission, date d'échéance ;
 *   - identité complète de l'émetteur (raison sociale, forme, capital,
 *     adresse, SIRET, RCS, TVA intracommunautaire) ;
 *   - identité du client facturé, figée à l'émission ;
 *   - désignation, quantité, prix unitaire HT et taux de TVA ligne par ligne ;
 *   - total HT, TVA VENTILÉE PAR TAUX, total TTC ;
 *   - taux des pénalités de retard et indemnité forfaitaire de 40 € pour frais
 *     de recouvrement, qui sont obligatoires entre professionnels ;
 *   - « TVA non applicable, art. 293 B du CGI » quand l'émettrice est en
 *     franchise en base — auquel cas aucune TVA n'apparaît nulle part.
 *
 * Comme pour le devis, « PDF » est l'option « Enregistrer au format PDF » de la
 * boîte d'impression : aucune bibliothèque PDF embarquée, donc rien à mettre à
 * jour et rien qui puisse rendre un caractère accentué de travers.
 */
export function InvoicePrintPortal({
  invoice,
  identity,
  onDone,
}: {
  invoice: Invoice;
  identity: BillingIdentity;
  onDone: () => void;
}) {
  useEffect(() => triggerPrint(onDone), [onDone]);

  const totals = invoiceTotals(invoice);
  const cancelled = invoice.status === 'cancelled';

  return createPortal(
    <div className="print-root">
      {/*
        Une facture annulée doit rester lisible ET impossible à confondre avec
        une facture due : elle garde son numéro (la séquence ne doit pas avoir
        de trou) mais l'annonce dès la première ligne.
      */}
      {cancelled && (
        <div className="mb-6 border-2 border-neutral-900 px-4 py-2 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-neutral-900">Facture annulée</p>
          {invoice.cancelReason && (
            <p className="mt-1 text-xs text-neutral-600">Motif : {invoice.cancelReason}</p>
          )}
        </div>
      )}

      <div className="mb-8 flex items-start justify-between gap-8 border-b border-neutral-300 pb-5">
        <div className="text-sm leading-snug">
          <p className="text-base font-semibold text-neutral-900">{identity.legalName}</p>
          {identity.legalForm && (
            <p className="text-neutral-600">
              {identity.legalForm}
              {identity.capital ? ` au capital de ${identity.capital}` : ''}
            </p>
          )}
          {identity.address && <p className="whitespace-pre-line text-neutral-600">{identity.address}</p>}
          {identity.siret && <p className="text-neutral-600">SIRET {identity.siret}</p>}
          {identity.rcsCity && <p className="text-neutral-600">RCS {identity.rcsCity}</p>}
          {identity.vatNumber && <p className="text-neutral-600">TVA {identity.vatNumber}</p>}
          {identity.email && <p className="text-neutral-600">{identity.email}</p>}
          {identity.phone && <p className="text-neutral-600">{identity.phone}</p>}
        </div>

        <div className="shrink-0 text-right text-xs text-neutral-600">
          <p className="text-lg font-bold tracking-tight text-neutral-900">Facture</p>
          <p className="mt-1 font-mono text-sm text-neutral-900">
            N° {invoice.number || '—'}
          </p>
          <p className="mt-2">Émise le {formatDay(invoice.issuedAt) || '—'}</p>
          <p>Échéance le {formatDay(invoice.dueAt) || '—'}</p>
        </div>
      </div>

      <div className="mb-8 flex justify-end">
        <div className="min-w-[45%] border border-neutral-300 px-4 py-3 text-sm leading-snug">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Facturé à
          </p>
          <p className="font-medium text-neutral-900">
            {invoice.billTo.company || invoice.billTo.name}
          </p>
          {invoice.billTo.company && invoice.billTo.name && (
            <p className="text-neutral-600">{invoice.billTo.name}</p>
          )}
          {invoice.billTo.address && (
            <p className="whitespace-pre-line text-neutral-600">{invoice.billTo.address}</p>
          )}
          {invoice.billTo.email && <p className="text-neutral-600">{invoice.billTo.email}</p>}
          {invoice.billTo.vatNumber && (
            <p className="text-neutral-600">TVA {invoice.billTo.vatNumber}</p>
          )}
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-neutral-400 text-left text-[10px] uppercase tracking-wider text-neutral-500">
            <th className="py-2">Désignation</th>
            <th className="py-2 text-right">Qté</th>
            <th className="py-2 text-right">P.U. HT</th>
            {!identity.vatExempt && <th className="py-2 text-right">TVA</th>}
            <th className="py-2 text-right">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id} className="border-b border-neutral-200 align-top">
              <td className="py-2.5 pr-4 text-neutral-800">{line.label || '—'}</td>
              <td className="py-2.5 text-right text-neutral-700">
                {line.quantity.toString().replace('.', ',')}
              </td>
              <td className="py-2.5 text-right text-neutral-700">{formatCents(line.unitPriceCents)}</td>
              {!identity.vatExempt && (
                <td className="py-2.5 text-right text-neutral-700">{formatVatRate(line.vatRate)}</td>
              )}
              <td className="py-2.5 text-right font-medium text-neutral-900">
                {/* `lineAmounts` et non un produit recalculé ici : la règle
                    d'arrondi doit être la MÊME que celle du pied de page,
                    sinon le total ne serait pas la somme des lignes. */}
                {formatCents(lineAmounts(line.quantity, line.unitPriceCents, line.vatRate).netCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 flex justify-end">
        <table className="min-w-[52%] border-collapse text-sm">
          <tbody>
            <tr>
              <td className="py-1.5 pr-6 text-right text-neutral-600">Total HT</td>
              <td className="py-1.5 text-right font-medium text-neutral-900">
                {formatCents(totals.netCents)}
              </td>
            </tr>
            {/*
              La TVA se détaille TAUX PAR TAUX. Une facture qui mêle 20 % et
              5,5 % et n'affiche qu'un montant global de taxe est incomplète :
              c'est cette ventilation que le comptable reporte.
            */}
            {!identity.vatExempt &&
              totals.vatBuckets.map((bucket) => (
                <tr key={bucket.rate}>
                  <td className="py-1.5 pr-6 text-right text-neutral-600">
                    TVA {formatVatRate(bucket.rate)} sur {formatCents(bucket.netCents)}
                  </td>
                  <td className="py-1.5 text-right text-neutral-700">{formatCents(bucket.vatCents)}</td>
                </tr>
              ))}
            <tr className="border-t-2 border-neutral-400">
              <td className="py-2.5 pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                Total {identity.vatExempt ? 'net' : 'TTC'}
              </td>
              <td className="py-2.5 text-right text-lg font-bold text-neutral-900">
                {formatCents(identity.vatExempt ? totals.netCents : totals.grossCents)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {identity.vatExempt && (
        <p className="mt-4 text-right text-xs font-medium text-neutral-700">
          TVA non applicable, art. 293 B du CGI
        </p>
      )}

      {invoice.status === 'paid' && (
        <p className="mt-6 border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900">
          Facture acquittée le {formatDay(invoice.paidAt)}
          {invoice.paymentMethod ? ` — ${invoice.paymentMethod}` : ''}.
        </p>
      )}

      {invoice.notes && (
        <div className="mt-6 border-t border-neutral-200 pt-4 text-sm leading-relaxed text-neutral-700">
          <p className="whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      <div className="mt-8 border-t border-neutral-300 pt-4 text-[11px] leading-relaxed text-neutral-600">
        <p>
          Règlement à effectuer au plus tard le {formatDay(invoice.dueAt) || '—'}.
        </p>
        {(identity.iban || identity.bic) && (
          <p className="mt-1 font-mono">
            {identity.iban ? `IBAN ${identity.iban}` : ''}
            {identity.iban && identity.bic ? ' · ' : ''}
            {identity.bic ? `BIC ${identity.bic}` : ''}
          </p>
        )}
        {/*
          Les deux mentions de retard sont obligatoires entre professionnels et
          l'indemnité de 40 € est fixée par l'article D. 441-5 du code de
          commerce — c'est un montant réglementaire, pas un réglage, d'où sa
          présence en dur alors que le taux de pénalité, lui, est paramétrable.
        */}
        <p className="mt-1">
          Pénalités de retard : {formatVatRate(identity.latePenaltyRate)} par an, exigibles sans
          rappel dès le lendemain de l’échéance. Indemnité forfaitaire pour frais de recouvrement :
          40 €.
        </p>
        <p className="mt-1">Aucun escompte accordé pour paiement anticipé.</p>
      </div>
    </div>,
    document.body,
  );
}
