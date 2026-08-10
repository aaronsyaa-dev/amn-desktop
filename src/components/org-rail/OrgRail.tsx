import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search } from 'lucide-react';
import { useOrgContext } from '../../state/OrgContextContext';
import { LogoMark } from '../Logo';
import { OrgAvatar } from './OrgAvatar';
import { OrgSwitcher } from './OrgSwitcher';
import { CreateOrgDialog } from './CreateOrgDialog';

const RAIL_WIDTH = 64;
const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

/**
 * Le rail des organisations — la colonne la plus à gauche, toujours visible.
 *
 * Elle répond à une seule question, en permanence : « chez qui suis-je ? ».
 * AMN DevSec en haut, un séparateur, puis les organisations clientes ; le
 * contexte actif porte une barre pleine qui GLISSE d'une icône à l'autre plutôt
 * que de s'allumer ailleurs — l'œil suit la sélection au lieu de la retrouver.
 *
 * Le rail est dimensionné pour beaucoup d'organisations : la liste défile, la
 * loupe ouvre un sélecteur cherchable au clavier (voir OrgSwitcher), et rien
 * dans la colonne ne grandit avec le nombre de clientes. À trois organisations
 * on parcourt la colonne ; à trois cents, on cherche — les deux gestes sont là.
 */
export function OrgRail() {
  const { organizations, support, entering, leaveOrganization, enterOrganization } = useOrgContext();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // ⌘/Ctrl + Maj + O : le raccourci du changement d'organisation. Distinct de
  // ⌘K (qui cherche DANS le contexte courant) parce que ce n'est pas le même
  // geste — l'un navigue, l'autre change de monde.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        setSwitcherOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <aside
        style={{ width: RAIL_WIDTH, paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        className="relative z-40 flex h-full flex-shrink-0 flex-col items-center gap-2 border-r border-border bg-[#070707] pb-3"
        aria-label="Organisations"
      >
        <RailButton
          label="AMN DevSec"
          sublabel="Votre organisation"
          active={!support}
          onClick={() => {
            // Depuis un contexte client, cliquer AMN DevSec est un geste de
            // sortie, pas une navigation : le jeton de support doit être rendu.
            if (support) void leaveOrganization();
          }}
        >
          <LogoMark size={30} />
        </RailButton>

        <span className="my-1 h-px w-7 flex-shrink-0 bg-border" aria-hidden />

        {/* La liste défile ; la barre native est masquée et remplacée par un
            dégradé haut/bas, pour qu'une colonne pleine se lise comme telle. */}
        <div className="sidebar-scroll flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-3">
          {organizations.map((org) => (
            <RailButton
              key={org.id}
              label={org.name}
              sublabel={org.status === 'suspended' ? 'Suspendue' : undefined}
              active={support?.orgId === org.id}
              busy={entering === org.id}
              dimmed={org.status === 'suspended'}
              onClick={() => void enterOrganization(org.id)}
            >
              <OrgAvatar name={org.name} logoDataUrl={org.logoDataUrl} size={40} />
            </RailButton>
          ))}
        </div>

        <div className="flex flex-shrink-0 flex-col items-center gap-2 pt-1">
          <RailButton label="Chercher une organisation" hint="⇧ ⌘ O" onClick={() => setSwitcherOpen(true)} small>
            <Search size={17} strokeWidth={1.75} />
          </RailButton>
          <RailButton label="Créer une organisation cliente" onClick={() => setCreateOpen(true)} small dashed>
            <Plus size={18} strokeWidth={2} />
          </RailButton>
        </div>
      </aside>

      <OrgSwitcher
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        onCreate={() => setCreateOpen(true)}
      />
      <CreateOrgDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

/**
 * Une case du rail. Le libellé n'est jamais écrit dans la colonne — il apparaît
 * au survol, à droite, comme dans les rails qu'on connaît. Une colonne d'icônes
 * qui essaie aussi de porter du texte n'est plus une colonne d'icônes.
 */
function RailButton({
  children,
  label,
  sublabel,
  hint,
  active = false,
  busy = false,
  dimmed = false,
  small = false,
  dashed = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  sublabel?: string;
  hint?: string;
  active?: boolean;
  busy?: boolean;
  dimmed?: boolean;
  small?: boolean;
  dashed?: boolean;
  onClick: () => void;
}) {
  const size = small ? 36 : 44;
  return (
    <div className="group relative flex-shrink-0">
      {active && (
        <motion.span
          layoutId="rail-active-marker"
          transition={TRANSITION}
          className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'true' : undefined}
        style={{ width: size, height: size }}
        className={`flex items-center justify-center overflow-hidden rounded-2xl transition-[transform,background-color,border-color,opacity] duration-200 ${
          dashed ? 'border border-dashed border-border-strong text-text-muted hover:text-text-primary' : ''
        } ${
          active
            ? 'bg-accent-muted ring-1 ring-border-strong'
            : 'hover:bg-surface-hover hover:-translate-y-[1px] active:translate-y-0'
        } ${dimmed && !active ? 'opacity-45 grayscale' : ''} ${busy ? 'animate-pulse' : ''} ${
          small ? 'text-text-secondary' : ''
        }`}
      >
        {children}
      </button>

      {/* Infobulle. `pointer-events-none` : elle ne doit jamais s'interposer
          entre le curseur et l'icône suivante. */}
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 elev-2 group-hover:block">
        <span className="block text-xs font-medium text-text-primary">{label}</span>
        {sublabel && (
          <span className="block font-mono text-[9px] uppercase tracking-widest text-text-muted">
            {sublabel}
          </span>
        )}
        {hint && (
          <span className="block font-mono text-[9px] uppercase tracking-widest text-text-muted">
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}
