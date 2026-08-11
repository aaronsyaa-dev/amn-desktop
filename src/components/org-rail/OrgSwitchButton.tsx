import React, { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { useOrgContext } from '../../state/OrgContextContext';
import { OrgAvatar } from './OrgAvatar';
import { OrgSwitcher } from './OrgSwitcher';
import { CreateOrgDialog } from './CreateOrgDialog';
import { LogoMark } from '../Logo';

/**
 * L'entrée du rail pour les écrans étroits.
 *
 * Sur téléphone, le rail et le tiroir de navigation ne tiennent pas côte à
 * côte : la colonne d'icônes est masquée. Sans cette ligne, changer
 * d'organisation deviendrait impossible sur mobile — c'est-à-dire exactement
 * là où on ouvre l'app pour jeter un œil entre deux rendez-vous.
 *
 * Elle ouvre le même sélecteur que la loupe du rail : un seul comportement à
 * connaître, quelle que soit la taille de l'écran.
 */
export function OrgSwitchButton({ onNavigate }: { onNavigate?: () => void }) {
  const { support } = useOrgContext();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setSwitcherOpen(true)}
        className="mb-2 flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-border-strong"
      >
        {support ? (
          <OrgAvatar
            name={support.orgName}
            logoDataUrl={support.logoDataUrl}
            size={26}
            rounded="rounded-lg"
          />
        ) : (
          <LogoMark size={26} />
        )}
        <span className="min-w-0 flex-1">
          {/* L'étiquette d'abord, le nom en vedette ensuite : c'est la même
              hiérarchie que partout ailleurs dans l'app (petite capitale mono
              au-dessus, valeur en dessous), et surtout c'est ce qui empêche le
              repli sur deux lignes.
              « Changer d'organisation » tenait sur deux lignes dans cette
              colonne de 113 px : une instruction verbeuse là où un mot suffit,
              le chevron disant déjà que c'est cliquable. */}
          <span className="block truncate font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
            Organisation
          </span>
          <span className="block truncate text-[13px] font-semibold leading-tight text-text-primary">
            {support ? support.orgName : 'AMN DevSec'}
          </span>
        </span>
        <ChevronsUpDown size={14} strokeWidth={2} className="flex-shrink-0 text-text-muted" />
      </button>

      <OrgSwitcher
        open={switcherOpen}
        onClose={() => {
          setSwitcherOpen(false);
          onNavigate?.();
        }}
        onCreate={() => setCreateOpen(true)}
      />
      <CreateOrgDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
