import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Logo } from '../components/Logo';
import { triggerPrint } from '../lib/print';
import { useExclusive } from '@edition/exclusive';
import { useAuth } from '../auth/AuthContext';
import { EDITION_PRODUCT_NAME, IS_BUSINESS } from '../edition/edition';
import { useBillingIdentity } from '../state/useInvoices';
import {
  depositSplit,
  documentTotals,
  eurosToCents,
  formatCents,
  formatVatRate,
  lineAmounts,
} from '../lib/money';
import { hasDetailedLines, quoteLines } from '../lib/quote';
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
  /*
    La référence.

    Elle sortait « AMN-1788814302278873 » : un préfixe qui retombait sur
    « AMN » dès que l'organisation n'était pas chargée — donc le nom d'AMN
    DevSec sur le devis d'une cliente — suivi de l'identifiant technique brut,
    qui est un horodatage en millisecondes multiplié par mille. Le
    `padStart(4)` ne servait qu'aux tout premiers identifiants, d'un temps où
    ils étaient séquentiels.

    Maintenant : les trois premières lettres de l'ÉMETTRICE, l'année
    d'émission, et cinq chiffres tirés de l'identifiant. « GIO-2026-78873 » se
    dicte au téléphone, se retrouve dans un dossier, et ne raconte rien sur
    l'outil qui l'a produit.
  */
  const refPrefix = (identity.legalName || org?.name || '')
    .replace(/[^A-Za-zÀ-ÿ0-9]/g, '')
    .slice(0, 3)
    .toUpperCase() || 'DEV';
  const refYear = Number.isNaN(issued.getTime()) ? '' : `${issued.getFullYear()}-`;
  const refTail = String(Math.abs(Math.trunc(quote.id))).slice(-5).padStart(5, '0');
  const ref = `${refPrefix}-${refYear}${refTail}`;

  // Le chiffrage : le détail s'il existe, sinon la ligne unique reconstituée
  // depuis `priceEuro`, qui redonne exactement le document d'avant.
  const detaille = hasDetailedLines(quote);
  const lignes = quoteLines(quote, {
    id: 'forfait',
    label: offer?.name ?? quote.trackerTier,
    quantity: 1,
    unitPriceCents: eurosToCents(quote.priceEuro),
    vatRate: 0,
  });
  const totaux = documentTotals(lignes);
  const avecTva = totaux.vatCents !== 0;
  const acompte = depositSplit(totaux.grossCents, quote.depositPct);

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
          {/*
            Assurance décennale — obligatoire sur le devis ET la facture de
            toute activité de construction (art. L. 241-1 du code des
            assurances). Un devis de maçon qui ne la porte pas se fait
            écarter par un client averti. Vide pour les métiers non
            concernés, auquel cas rien ne s'affiche.
          */}
          {identity.decennaleInsurer && (
            <p className="mt-1 text-neutral-600">
              Assurance décennale : {identity.decennaleInsurer}
              {identity.decennaleCoverage ? ` — ${identity.decennaleCoverage}` : ''}
            </p>
          )}
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

      {/* Le chiffrage */}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-neutral-300 text-left text-[11px] uppercase tracking-wider text-neutral-500">
            <th className="py-2">Prestation</th>
            <th className="py-2 text-center">Qté</th>
            <th className="py-2 text-right">Prix unitaire</th>
            {avecTva && <th className="py-2 text-right">TVA</th>}
            <th className="py-2 text-right">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne.id} className="border-b border-neutral-200">
              <td className="py-3 text-neutral-800">
                <p className="whitespace-pre-wrap font-medium">{ligne.label}</p>
                {/* La légende de l'offre n'a de sens que sur le forfait
                    reconstitué : une ligne de chantier porte déjà tout dans
                    son intitulé. */}
                {!detaille && offer?.tagline && <p className="text-xs text-neutral-500">{offer.tagline}</p>}
              </td>
              <td className="py-3 text-center text-neutral-700">
                {ligne.quantity.toLocaleString('fr-FR')}
              </td>
              <td className="py-3 text-right text-neutral-700">{formatCents(ligne.unitPriceCents)}</td>
              {avecTva && (
                <td className="py-3 text-right text-neutral-700">{formatVatRate(ligne.vatRate)}</td>
              )}
              <td className="py-3 text-right font-medium text-neutral-900">
                {formatCents(lineAmounts(ligne.quantity, ligne.unitPriceCents, ligne.vatRate).netCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/*
        Le pied de chiffrage. Sans TVA — franchise en base, ou devis d'avant
        qui n'en a jamais porté — il reste une seule ligne « Total », comme
        avant : afficher « HT » puis « TTC » pour le même montant fait douter
        d'un document qui doit rassurer.
      */}
      <div className="mt-4 flex justify-end">
        <table className="w-72 border-collapse text-sm">
          <tbody>
            {avecTva ? (
              <>
                <tr>
                  <td className="py-1 text-[11px] uppercase tracking-wider text-neutral-500">Total HT</td>
                  <td className="py-1 text-right text-neutral-800">{formatCents(totaux.netCents)}</td>
                </tr>
                {totaux.vatBuckets
                  .filter((bucket) => bucket.vatCents !== 0)
                  .map((bucket) => (
                    <tr key={bucket.rate}>
                      <td className="py-1 text-[11px] uppercase tracking-wider text-neutral-500">
                        TVA {formatVatRate(bucket.rate)} sur {formatCents(bucket.netCents)}
                      </td>
                      <td className="py-1 text-right text-neutral-800">{formatCents(bucket.vatCents)}</td>
                    </tr>
                  ))}
                <tr className="border-t border-neutral-300">
                  <td className="py-2 text-[11px] uppercase tracking-wider text-neutral-500">Total TTC</td>
                  <td className="py-2 text-right text-lg font-bold text-neutral-900">
                    {formatCents(totaux.grossCents)}
                  </td>
                </tr>
              </>
            ) : (
              <tr className="border-t border-neutral-300">
                <td className="py-2 text-[11px] uppercase tracking-wider text-neutral-500">Total</td>
                <td className="py-2 text-right text-lg font-bold text-neutral-900">
                  {formatCents(totaux.grossCents)}
                </td>
              </tr>
            )}

            {/*
              L'acompte, quand il y en a un. Un artisan ne démarre pas un
              chantier sans, et un devis qui n'en mentionne aucun se fait
              renégocier à la signature.
            */}
            {acompte.pct > 0 && (
              <>
                <tr className="border-t border-neutral-200">
                  <td className="pt-2 text-[11px] uppercase tracking-wider text-neutral-500">
                    Acompte à la commande ({formatVatRate(acompte.pct)})
                  </td>
                  <td className="pt-2 text-right font-medium text-neutral-900">
                    {formatCents(acompte.depositCents)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-[11px] uppercase tracking-wider text-neutral-500">
                    Solde à la livraison
                  </td>
                  <td className="py-1 text-right text-neutral-800">{formatCents(acompte.balanceCents)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

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
