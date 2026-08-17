import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, PlugZap, Search } from 'lucide-react';
import { useOrgContext } from '../../state/OrgContextContext';
import { useOpenAtelier } from './useOpenAtelier';
import { useAuth } from '../../auth/AuthContext';
import { LogoMark } from '../Logo';
import { OrgAvatar } from './OrgAvatar';
import { OrgSwitcher } from './OrgSwitcher';

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
  const openAtelier = useOpenAtelier();
  const {
    organizations,
    support,
    entering,
    leaveOrganization,
    enterOrganization,
    signalLocalSession,
    myOrganizations,
    loadingMine,
    activeOrgId,
    switchToOrganization,
  } = useOrgContext();
  const { sessionKind } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // Le rail continue de se remplir sur une session locale : la liste des
  // organisations part avec le jeton partagé du poste, qui a le droit de la
  // lire. C'est bien pour ça que l'état passait inaperçu — tout avait l'air
  // normal jusqu'au clic. Le pastille ci-dessous le dit en permanence.
  const localSession = sessionKind === 'local';

  // Mon organisation d'origine, et celles que j'ai REJOINTES. La première a sa
  // place en haut du rail ; les secondes forment leur propre groupe.
  const homeOrg = myOrganizations.find((org) => org.home) ?? null;
  const joinedOrgs = myOrganizations.filter((org) => !org.home);

  /*
    Une organisation dont je suis MEMBRE sort de la liste des supervisées.

    Sans ce retrait, AllStore apparaissait DEUX FOIS dans le rail : une fois
    comme appartenance, une fois comme cliente — parce qu'AMN DevSec l'a
    effectivement créée depuis la console. Deux icônes identiques, au même
    nom, et deux gestes différents derrière : l'une bascule la session (durable,
    mon rôle est celui qu'on m'a donné), l'autre ouvre une session de support
    (une heure, tracée au journal). C'est précisément l'ambiguïté que ce rail
    doit lever, et elle était là, visible, au premier essai réel.

    L'appartenance gagne : c'est la relation la plus forte des deux, et celle
    qu'on utilise tous les jours. La supervision reste atteignable par le
    sélecteur (⇧⌘O) pour les organisations qu'on ne fait que gérer.
  */
  const joinedIds = new Set(myOrganizations.map((org) => org.id));

  /*
    Tant qu'on ne SAIT PAS de quelles organisations on est membre, on n'en
    propose aucune en supervision.

    Sans cette attente, les deux listes arrivent dans un ordre imprévisible et
    le rail affichait AllStore dans le groupe des clientes supervisées le temps
    que l'appartenance se charge. Cliquer dessus à cet instant n'ouvrait pas
    l'organisation en tant que MEMBRE : ça ouvrait une SESSION DE SUPPORT —
    une heure, rôle imposé, et une ligne au journal d'accès disant qu'AMN
    DevSec est entrée chez une cliente. Le mauvais geste, la mauvaise trace,
    sans que rien ne le signale.

    Observé une fois sur trois en conditions réelles, ce qui est le pire des
    cas : assez rare pour passer les essais, assez fréquent pour arriver.
  */
  const supervisedOnly = loadingMine ? [] : organizations.filter((org) => !joinedIds.has(org.id));

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
          label={homeOrg?.name ?? 'AMN DevSec'}
          sublabel="Votre organisation"
          active={!support && (!activeOrgId || activeOrgId === homeOrg?.id)}
          onClick={() => {
            // Depuis un contexte client, cliquer AMN DevSec est un geste de
            // sortie, pas une navigation : le jeton de support doit être rendu.
            if (support) void leaveOrganization();
            else if (homeOrg && activeOrgId !== homeOrg.id) void switchToOrganization(homeOrg.id);
          }}
        >
          <LogoMark size={30} />
        </RailButton>

        {/*
          MES autres organisations — celles où je suis membre, pas cliente.

          Séparées des organisations supervisées plus bas, et volontairement :
          entrer ici est une APPARTENANCE (durable, mon rôle y est celui qu'on
          m'a donné), entrer plus bas est une session de SUPPORT (une heure,
          tracée). Deux gestes qui se ressemblent à l'écran et qui n'ont rien à
          voir — les mélanger dans une même colonne indifférenciée, c'est
          exactement l'ambiguïté que ce rail doit lever.
        */}
        {joinedOrgs.length > 0 && (
          <>
            <span className="my-1 h-px w-7 flex-shrink-0 bg-border" aria-hidden />
            <div className="flex flex-shrink-0 flex-col items-center gap-2">
              {joinedOrgs.map((org) => (
                <RailButton
                  key={org.id}
                  label={org.name}
                  sublabel={`Membre · ${org.role}`}
                  active={!support && activeOrgId === org.id}
                  onClick={() => void switchToOrganization(org.id)}
                >
                  <OrgAvatar name={org.name} logoDataUrl={org.logoDataUrl} size={40} />
                </RailButton>
              ))}
            </div>
          </>
        )}

        <span className="my-1 h-px w-7 flex-shrink-0 bg-border" aria-hidden />

        {/* La liste défile ; la barre native est masquée et remplacée par un
            dégradé haut/bas, pour qu'une colonne pleine se lise comme telle. */}
        <div className="sidebar-scroll flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-3">
          {supervisedOnly.map((org) => (
            <RailButton
              key={org.id}
              label={org.name}
              /* Le pendant symétrique du « Membre · rôle » ci-dessus : ici on
                 n'appartient pas, on ouvre une session de support. Le dire des
                 DEUX côtés est ce qui fait de la distinction une information,
                 plutôt qu'une absence de mention qu'il faudrait deviner. */
              sublabel={org.status === 'suspended' ? 'Suspendue' : 'Session de support · 1 h, tracée'}
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
          {localSession && (
            <RailButton
              label="Session locale — aucun dossier client ouvrable"
              sublabel="Reconnectez-vous à amn-api"
              onClick={signalLocalSession}
              small
              warning
            >
              <PlugZap size={17} strokeWidth={1.75} />
            </RailButton>
          )}
          <RailButton label="Chercher une organisation" hint="⇧ ⌘ O" onClick={() => setSwitcherOpen(true)} small>
            <Search size={17} strokeWidth={1.75} />
          </RailButton>
          <RailButton label="Créer une organisation cliente" onClick={openAtelier} small dashed>
            <Plus size={18} strokeWidth={2} />
          </RailButton>
        </div>
      </aside>

      <OrgSwitcher
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        onCreate={openAtelier}
      />
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
  warning = false,
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
  warning?: boolean;
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
        } ${warning ? 'border border-warning/60 bg-warning-muted text-warning' : ''}`}
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
