import React, { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { useVault, type VaultTransfer } from '../../state/useVault';
import { vaultCategoryLabel } from '../../lib/vaultCategories';

/**
 * « Transférer dans le coffre-fort » — le bouton qu'on met partout où un secret
 * ne s'affiche qu'une fois.
 *
 * Le problème qu'il règle n'est pas le stockage, c'est le moment. Un mot de
 * passe temporaire d'organisation, un jeton d'activation, une clé d'API :
 * amn-api n'en garde que l'empreinte, donc l'écran qui les affiche est la seule
 * occasion de les conserver. Jusqu'ici il fallait copier, ouvrir le
 * Coffre-fort, créer une entrée, choisir sa rubrique, coller, nommer — six
 * gestes pendant qu'on a une cliente au téléphone. Un seul suffit maintenant, et
 * l'entrée arrive déjà rangée et étiquetée.
 *
 * Le bouton ne masque pas le secret et ne remplace pas « Copier » : les deux
 * répondent à des besoins différents (le transmettre / le retrouver plus tard),
 * et forcer l'un à valoir pour l'autre ferait perdre le second.
 *
 * Le retour visuel nomme la rubrique d'arrivée. « Rangé dans le coffre-fort »
 * seul laisserait à chercher où ; c'est le genre de détail qui décide si on
 * refait le geste la fois suivante.
 */
export function VaultTransferButton({
  transfer,
  disabled = false,
  className = '',
}: {
  transfer: VaultTransfer;
  disabled?: boolean;
  className?: string;
}) {
  const { transferSecret } = useVault();
  const [done, setDone] = useState(false);

  const run = () => {
    if (disabled || !transfer.secret) return;
    transferSecret(transfer);
    setDone(true);
    // Pas de retour à l'état initial : le transfert a eu lieu, et redevenir
    // « Transférer » suggérerait qu'il n'a pas pris. Un second clic reste
    // possible via un nouvel affichage du secret, qui met l'entrée à jour.
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled || done || !transfer.secret}
      aria-label={
        done
          ? `Rangé dans le coffre-fort, rubrique ${vaultCategoryLabel(transfer.category)}`
          : 'Transférer dans le coffre-fort'
      }
      className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors disabled:cursor-default ${
        done
          ? 'border-success/50 bg-success/10 text-text-secondary'
          : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary'
      } ${className}`}
    >
      {done ? <Check size={12} strokeWidth={2} /> : <Lock size={12} strokeWidth={2} />}
      {done ? `Rangé · ${vaultCategoryLabel(transfer.category)}` : 'Transférer dans le coffre-fort'}
    </button>
  );
}
