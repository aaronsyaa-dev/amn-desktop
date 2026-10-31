import { useCallback, useMemo } from 'react';
import { uid, useSync } from '../../../state/SyncContext';
import { partyFromClient, useInvoices } from '../../../state/useInvoices';
import { useClients } from '../../../state/useClients';
import type { InvoiceLine } from '../../../shared/api';
import type { LigneFactureBrouillon } from './intentions';

export interface EntreeBrouillonFacture {
  clientId: number;
  clientNom: string;
  lignes: LigneFactureBrouillon[];
}

/** Ce que la palette sait écrire : un brouillon de facture, et le défaire. Rien d'autre. */
export interface ActionsAjmani {
  creerBrouillonFacture?: (entree: EntreeBrouillonFacture) => { id: string; defaire: () => void } | null;
}

/**
 * LES SEULES ÉCRITURES DE LA PALETTE : créer un brouillon de facture (N1), et le supprimer si la personne
 * annule dans les 10 secondes. Un brouillon n'a pas de numéro, n'est envoyé à personne et ne compte nulle
 * part : c'est la seule écriture qu'Ajmani fait de lui-même. Il n'émet ni n'envoie jamais une facture.
 */
export function useActionsAjmani(): ActionsAjmani {
  const { createDraft, identity } = useInvoices();
  const { remove } = useSync();
  const { clients } = useClients();

  const creerBrouillonFacture = useCallback<NonNullable<ActionsAjmani['creerBrouillonFacture']>>(
    (entree) => {
      const client = clients.find((c) => c.id === entree.clientId);
      if (!client) return null;
      const lines: InvoiceLine[] = entree.lignes.map((l) => ({
        id: uid('line'),
        label: l.label,
        quantity: l.quantite,
        unitPriceCents: l.prixCentimes,
        vatRate: identity.vatExempt ? 0 : 20,
      }));
      const id = createDraft({ clientId: client.id, billTo: partyFromClient(client), lines });
      // `remove` ne dépend d'aucun instantané : l'annulation marche même si elle vient aussitôt après la création.
      return { id, defaire: () => remove('invoices', id) };
    },
    [clients, createDraft, remove, identity.vatExempt],
  );

  return useMemo(() => ({ creerBrouillonFacture }), [creerBrouillonFacture]);
}

