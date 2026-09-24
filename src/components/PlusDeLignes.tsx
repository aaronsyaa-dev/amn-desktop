import React from 'react';

/**
 * « Afficher plus » — une liste longue n'est pas rendue d'un bloc (simulation
 * S2 : 1 745 factures, 15 934 nœuds dans l'écran). La liste en montre une
 * page ; ce bouton en ajoute une, et dit combien il en reste.
 */
export function PlusDeLignes({ affichees, total, onPlus }: { affichees: number; total: number; onPlus: () => void }) {
  if (affichees >= total) return null;
  return (
    <button type="button" onClick={onPlus} className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-border px-4 py-2 text-[12.5px] text-text-secondary hover:bg-surface-hover hover:text-text-primary">
      Afficher plus <span className="font-mono text-[11px] text-text-muted">{total - affichees} restant{total - affichees > 1 ? 's' : ''}</span>
    </button>
  );
}
