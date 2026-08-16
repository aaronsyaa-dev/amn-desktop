import React from 'react';
import { LayoutDashboard, Settings } from 'lucide-react';
import { CONFIGURABLE_MODULES } from '../../data/tradeProfiles';
import { accentById } from '../../lib/accent';
import { OrgAvatar } from '../org-rail/OrgAvatar';

/**
 * L'APERÇU VIVANT — ce qui va être créé, pendant qu'on le règle (BLOC C)
 * ══════════════════════════════════════════════════════════════════════
 *
 * C'est la pièce qui fait la différence entre un formulaire et un atelier. Sans
 * elle, « ouvrir le module Dépenses » est une case cochée dont on verra le
 * résultat plus tard, chez quelqu'un d'autre. Avec elle, la ligne apparaît dans
 * la barre à l'instant où on coche, à sa vraie place, dans son vrai groupe, à
 * côté des autres — et on voit tout de suite si l'application qu'on fabrique
 * tient debout ou si elle est vide.
 *
 * CE QUE C'EST VRAIMENT. Une maquette fidèle, pas l'application montée en
 * miniature : on ne peut pas monter la vraie coquille Business ici, elle
 * exigerait une session, une synchronisation et une organisation qui n'existe
 * pas encore. Ce qu'elle reproduit exactement, en revanche, c'est ce qui se
 * décide dans cet écran : les modules ouverts, leur regroupement, le nom,
 * le logo, et l'accent proposé. Tout le reste est volontairement gris et muet —
 * une maquette qui inventerait du contenu ferait croire à des données.
 *
 * LES GROUPES SONT CEUX DE LA VRAIE BARRE (voir modules.business.ts). S'ils
 * divergeaient, l'aperçu montrerait un rangement que la cliente ne verra
 * jamais, ce qui est pire que pas d'aperçu du tout.
 *
 * L'ACCENT EST UNE PROPOSITION. Il colore la ligne active, exactement comme
 * chez elle. Ce n'est pas un choix qu'on lui impose : elle en change quand elle
 * veut depuis ses paramètres, et le générateur ne fait que lui éviter d'ouvrir
 * une application grise le premier jour.
 */

/** Le même découpage que la barre de l'édition Business. */
const PREVIEW_SECTIONS: Array<{ label: string; keys: string[] }> = [
  { label: 'Pilotage', keys: ['agenda', 'projects', 'tasks'] },
  { label: 'Clients & revenus', keys: ['clients', 'invoices', 'orders'] },
  { label: 'Production', keys: ['time', 'expenses', 'calculators'] },
  { label: 'Documents', keys: ['notes', 'reports', 'media'] },
  { label: 'Système', keys: ['vault'] },
];

export function LivePreview({
  orgName,
  logoDataUrl,
  modules,
  accentId,
  seats,
}: {
  orgName: string;
  logoDataUrl: string;
  modules: string[];
  accentId: string;
  seats: number;
}) {
  const accent = accentById(accentId);
  const labelOf = (key: string) =>
    CONFIGURABLE_MODULES.find((m) => m.key === key)?.label ?? key;

  const sections = PREVIEW_SECTIONS.map((section) => ({
    label: section.label,
    keys: section.keys.filter((k) => modules.includes(k)),
  })).filter((section) => section.keys.length > 0);

  const displayName = orgName.trim() || 'Nom de l’organisation';

  return (
    <div className="panel panel-ticks overflow-hidden">
      <div className="panel-head flex items-center gap-2 px-3 py-2">
        <span className="eyebrow">Aperçu — son application</span>
        <span className="ml-auto eyebrow">{modules.length + 2} écrans</span>
      </div>

      {/* La maquette. Proportions d'une fenêtre, pas d'une carte. */}
      <div className="flex h-[22rem] bg-bg">
        {/* Sa barre latérale, avec SES modules, dans SES groupes. */}
        <div className="flex w-44 flex-shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-2.5">
            <OrgAvatar name={displayName} logoDataUrl={logoDataUrl} size={22} rounded="rounded" />
            <span className="truncate text-[11px] font-medium text-text-primary">
              {displayName}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-2 py-2.5">
            {/* Accueil est toujours ouvert, et c'est la ligne active de la
                maquette : c'est là qu'elle atterrira le premier jour. */}
            <PreviewRow
              label="Accueil"
              icon={LayoutDashboard}
              active
              accent={accent.value}
              on={accent.on}
            />

            {sections.map((section) => (
              <div key={section.label} className="flex flex-col gap-0.5">
                <span className="px-1.5 pb-1 font-mono text-[7px] uppercase tracking-[0.2em] text-text-muted">
                  {section.label}
                </span>
                {section.keys.map((key) => (
                  <PreviewRow key={key} label={labelOf(key)} />
                ))}
              </div>
            ))}

            <div className="mt-auto">
              <PreviewRow label="Paramètres" icon={Settings} />
            </div>
          </div>
        </div>

        {/* Le contenu : volontairement muet. Inventer des chiffres ici ferait
            croire à des données, et cette organisation n'a encore rien. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-8 flex-shrink-0 items-center gap-2 border-b border-border px-3">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent.value }} />
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-text-muted">
              {seats} siège{seats > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="h-2.5 w-1/3 rounded-sm bg-border" />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 border border-border bg-surface" />
              ))}
            </div>
            <div className="flex-1 border border-border bg-surface" />
          </div>

          <div className="flex h-5 flex-shrink-0 items-center gap-2 border-t border-border bg-raised px-3">
            <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-text-muted">
              {displayName}
            </span>
            <span className="ml-auto h-1 w-1 rounded-full bg-success" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  icon: Icon,
  active = false,
  accent,
  on,
}: {
  label: string;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  active?: boolean;
  accent?: string;
  on?: string;
}) {
  return (
    <span
      className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px]"
      style={
        active
          ? { background: accent, color: on }
          : { color: 'var(--color-text-secondary)' }
      }
    >
      {Icon ? (
        <Icon size={10} strokeWidth={1.75} />
      ) : (
        <span className="h-1 w-1 flex-shrink-0 rounded-full bg-current opacity-50" />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}
