import { useMemo } from 'react';
import { useCollection } from '../../state/SyncContext';
import { useMaintenant } from './useSupervisor';
import type { PieceStudio } from './types';

/**
 * STUDIO — les pièces de Mohamed (cahier 11 `45c`, cahier 14 `48a`–`48e`).
 *
 * L'état d'une pièce VIENT DE LA PIÈCE, jamais d'un réglage d'affichage :
 *   · « attente client » seulement si une demande de validation est ouverte
 *     côté cliente ;
 *   · « chantier » si elle n'est pas en ligne, ou qu'une version suivante se
 *     prépare ;
 *   · « en ligne » sinon.
 * Et l'ambre ne va qu'à UNE pièce : celle où c'est Mohamed qu'on attend — le
 * plus ancien retour de cliente pas encore traité.
 */

export type EtatPiece = 'en_ligne' | 'chantier' | 'attente';
export type Piece = PieceStudio & { id: string; etat: EtatPiece; plaque: string; retourOuvert: NonNullable<PieceStudio['retours']>[number] | null };

export const LIBELLE_ETAT: Record<EtatPiece, string> = { en_ligne: 'EN LIGNE', chantier: 'CHANTIER', attente: 'ATTENTE CLIENT' };

export const plaque = (n: number) => `P-${String(n).padStart(2, '0')}`;

export function etatPiece(p: PieceStudio): EtatPiece {
  if (p.validation && !p.validation.fermeeLe) return 'attente';
  if (p.enLigneLe && !p.chantier) return 'en_ligne';
  return 'chantier';
}

type Punaise = NonNullable<NonNullable<PieceStudio['croquis']>[number]['punaises']>[number];

/** Les punaises du mur qui attendent que la cliente tranche, dans l'ordre de leur numéro. */
export function decisionsEnAttente(p: PieceStudio): (Punaise & { croquisId: string })[] {
  return (p.croquis ?? [])
    .flatMap((c) => (c.punaises ?? []).map((x) => ({ ...x, croquisId: c.id })))
    .filter((x) => x.decision && !x.trancheeLe)
    .sort((a, b) => a.n - b.n);
}

export interface ModeleStudio {
  pieces: Piece[];
  /** La pièce où l'on attend Mohamed — l'ambre du bureau. */
  ambre: Piece | null;
  retoursOuverts: Piece[];
  compte: Record<EtatPiece, number>;
  misesEnLigne: { piece: Piece; version: string; at: string; par: string }[];
  /** Qui attend qui : VOUS (un retour à traiter), ELLE (une validation ouverte). */
  quiAttend: { piece: Piece; qui: 'vous' | 'elle'; texte: string; depuis: string }[];
  /** Un point bloquant non coché empêche la mise en ligne (`48d`). */
  bloquants: { piece: Piece; point: { id: string; texte: string } }[];
}

export function modeleStudio(liste: (PieceStudio & { id: string })[], maintenant: number): ModeleStudio {
  const pieces: Piece[] = liste
    .filter((p) => typeof p.numero === 'number')
    .map((p) => {
      const ouverts = (p.retours ?? []).filter((r) => !r.traiteLe).sort((a, b) => a.at.localeCompare(b.at));
      return { ...p, etat: etatPiece(p), plaque: plaque(p.numero), retourOuvert: ouverts[0] ?? null };
    })
    .sort((a, b) => a.numero - b.numero);
  const retoursOuverts = pieces.filter((p) => p.retourOuvert).sort((a, b) => (a.retourOuvert?.at ?? '').localeCompare(b.retourOuvert?.at ?? ''));
  const compte = { en_ligne: 0, chantier: 0, attente: 0 };
  for (const p of pieces) compte[p.etat] += 1;
  const semaine = maintenant - 7 * 86_400_000;
  const misesEnLigne = pieces
    .flatMap((piece) => (piece.livraison?.misesEnLigne ?? []).map((m) => ({ piece, ...m })))
    .filter((m) => Date.parse(m.at) >= semaine)
    .sort((a, b) => a.at.localeCompare(b.at));
  const quiAttend = [
    ...retoursOuverts.map((piece) => ({
      piece,
      qui: 'vous' as const,
      texte: `${piece.orgNom} : « ${piece.retourOuvert?.texte ?? ''} »${piece.retourOuvert?.page ? ` · page ${piece.retourOuvert.page}` : ''}`,
      depuis: piece.retourOuvert?.at ?? '',
    })),
    ...pieces
      .filter((p) => p.etat === 'attente')
      .map((piece) => ({ piece, qui: 'elle' as const, texte: `${piece.orgNom} doit ${piece.validation?.question ?? 'valider'}`, depuis: piece.validation?.ouverteLe ?? '' })),
    // Une punaise « décision » du mur attend, elle aussi, la cliente (`48a`).
    ...pieces.flatMap((piece) =>
      decisionsEnAttente(piece).map((x) => ({ piece, qui: 'elle' as const, texte: `${piece.orgNom} doit trancher : ${x.texte.replace(/[.?!]+$/, '')}`, depuis: '' })),
    ),
  ];
  const bloquants = pieces.flatMap((piece) => (piece.livraison?.points ?? []).filter((x) => x.bloquant && !x.coche).map((point) => ({ piece, point })));
  return { pieces, ambre: retoursOuverts[0] ?? null, retoursOuverts, compte, misesEnLigne, quiAttend, bloquants };
}

export function useStudio(): ModeleStudio & { pret: boolean } {
  const liste = useCollection<PieceStudio>('studioPieces');
  const maintenant = useMaintenant(60_000);
  return useMemo(() => ({ ...modeleStudio(liste as (PieceStudio & { id: string })[], maintenant), pret: true }), [liste, maintenant]);
}
