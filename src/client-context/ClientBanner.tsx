import React from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useOrgContext } from '../state/OrgContextContext';

/**
 * Le bandeau permanent du contexte client.
 *
 * Il reprend exactement le parti pris du bandeau de contrôle à distance, qui a
 * fait ses preuves : une barre pleine largeur en haut de l'écran, toujours là,
 * jamais une bulle qui s'estompe. Une notification qu'on peut chasser d'un
 * clic finit par ne plus être lue — et « je croyais être chez moi » est
 * exactement l'erreur qu'on ne peut pas se permettre en travaillant dans le
 * dossier d'une cliente.
 *
 * Il n'a donc PAS de bouton de fermeture. Le seul bouton qu'il porte est celui
 * qui met fin au contexte lui-même : on ne masque pas le bandeau, on sort.
 * Le contenu de l'application est décalé vers le bas par la hauteur du bandeau
 * (voir ClientContextLayout) plutôt que recouvert par lui : recouvrir aurait
 * rendu le premier élément de chaque écran inatteignable.
 */

/** Hauteur réservée dans la mise en page. Une constante, pas une devinette. */
export const CLIENT_BANNER_HEIGHT = 40;

export function ClientBanner() {
  const { support, leaveOrganization } = useOrgContext();
  if (!support) return null;

  return (
    <div
      role="alert"
      style={{ height: CLIENT_BANNER_HEIGHT }}
      className="fixed inset-x-0 top-0 z-[240] flex items-center gap-3 border-b border-warning/50 bg-warning-muted px-3 sm:px-4"
    >
      <ShieldAlert size={14} strokeWidth={2} className="flex-shrink-0 text-warning" />
      <p className="min-w-0 flex-1 truncate text-xs text-text-primary">
        Vous consultez <strong className="font-semibold">{support.orgName}</strong>
        <span className="hidden sm:inline"> en tant qu’administrateur AMN DevSec</span>
        {support.actorEmail && (
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-text-muted md:inline">
            {' '}
            · {support.actorEmail}
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={() => void leaveOrganization()}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover"
      >
        <LogOut size={11} strokeWidth={2} />
        Quitter
      </button>
    </div>
  );
}
