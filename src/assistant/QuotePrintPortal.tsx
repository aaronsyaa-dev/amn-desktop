import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Logo } from '../components/Logo';
import { triggerPrint } from '../lib/print';
import { useExclusive } from '@edition/exclusive';
import { useAuth } from '../auth/AuthContext';
import { EDITION_PRODUCT_NAME, IS_BUSINESS } from '../edition/edition';
import { useBillingIdentity } from '../state/useInvoices';
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
 *
 * ## Il porte la même identité que la facture
 *
 * Ce document part chez un client : c'est une offre commerciale, et s'il la
 * signe, un contrat. Il ne portait pourtant que le nom de l'organisation,
 * pendant que la facture, elle, affichait forme juridique, adresse, SIRET, RCS
 * et TVA. Les deux documents viennent de la même émettrice ; recevoir un devis
 * anonyme puis une facture en règle donne l'impression de deux entreprises
 * différentes.
 *
 * Deux conséquences ont été réparées en même temps :
 *
 *   - **la mention de TVA.** Le pied disait « Prix indicatifs hors taxes »
 *     quelle que soit la situation. Pour une émettrice en franchise en base,
 *     c'est faux et coûteux : le client attend 20 % en plus sur la facture,
 *     ils n'arriveront jamais, et la discussion a lieu au pire moment. La
 *     mention suit maintenant `vatExempt`.
 *   - **le « bon pour accord ».** Un devis sans emplacement de signature ne
 *     peut pas être accepté ; le client devait renvoyer un courriel disant
 *     oui, ce qui ne vaut pas un devis signé si la commande est contestée.
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
  const identity = useBillingIdentity();
  const { QUOTE_OFFERS, QUOTE_ISSUER_TAGLINE } = useExclusive();
  // Tant que l'identité légale n'est pas remplie, le devis retombe sur le nom
  // de l'organisation : un document incomplet reste préférable à un document
  // vide, et l'écran Facturation dit déjà ce qu'il manque.
  const issuerName = identity.legalName.trim() || org?.name || '';
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
          <p className="text-lg font-semibold text-neutral-900">{issuerName}</p>
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
          <p className="font-medium text-neutral-900">{issuerName}</p>
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
          {QUOTE_ISSUER_TAGLINE && <p className="mt-1 text-neutral-600">{QUOTE_ISSUER_TAGLINE}</p>}
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

      {/*
        Bon pour accord — ce qui transforme une offre en commande. Les deux
        lignes sont volontairement vides et hautes : ce devis est fait pour être
        imprimé, signé à la main, puis photographié ou scanné.
      */}
      <div className="mt-10 flex justify-end">
        <div className="w-72">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Bon pour accord</p>
          <p className="mt-1 text-xs text-neutral-500">Date et signature du client, précédées de la mention « Bon pour accord ».</p>
          <div className="mt-10 border-t border-neutral-400" />
        </div>
      </div>

      <div className="mt-8 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
        <p>Statut : {STATUS_LABEL[quote.status]}. Devis valable 30 jours à compter de sa date d’émission.</p>
        <p className="mt-1">
          {identity.vatExempt
            ? 'TVA non applicable, art. 293 B du CGI.'
            : 'Prix hors taxes ; TVA en sus au taux en vigueur.'}{' '}
          Ce document est confidentiel et généré par {EDITION_PRODUCT_NAME}.
        </p>
      </div>
    </div>,
    document.body,
  );
}
