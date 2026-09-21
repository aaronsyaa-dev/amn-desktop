import React, { useMemo } from 'react';
import { PinOff } from 'lucide-react';
import { useHaloSignal } from '../EtatEcran';
import { useProfiles } from '../../state/ProfilesContext';
import { parseMentions, type ClientRef, type TaskRef } from '../../lib/mentions';
import type { DerivedSite } from '../../state/RemoteSitesContext';

/**
 * COLLECTIF · ÉQUIPE — le rail des épingles.
 *
 * UNE INVERSION ASSUMÉE. Dans un fil à deux personnes, la conversation est du
 * FLUX et l'épingle est la MÉMOIRE. Le rail passe donc au-dessus, en grand, et
 * le fil coule petit en dessous — l'inverse de ce qu'une messagerie fait, parce
 * qu'ici ce qu'on vient rechercher n'est presque jamais le dernier message.
 *
 * Chaque épingle PEND À SA TIGE, et AUCUNE HAUTEUR N'EST POSÉE sur la fiche :
 * elle est dimensionnée par son message, donc sa hauteur EST sa longueur au
 * lieu de la prétendre. La proportionnalité promise — ce qui pèse pend plus
 * bas — en découle d'elle-même.
 *
 * NE JAMAIS POSER DE HAUTEUR SUR UNE FICHE D'ÉPINGLE. Les puces de mention
 * sont en pied de la fiche : sous une hauteur fixe avec `overflow:hidden`,
 * elles sortent de la boîte et DISPARAISSENT — le message reste lisible, et ce
 * qu'il cite s'évapore. La mise en avant passe donc par la LONGUEUR DE LA
 * TIGE, qui elle n'a rien à contenir.
 *
 * L'AMBRE, unique : la seule épingle dont la tâche citée est ENCORE OUVERTE —
 * sa tige et sa plaque. Deux nœuds. Les puces de mention ne sont PAS des nœuds
 * ambre : ce sont des jetons sombres posés sur la plaque, et c'est ce qui les
 * garde lisibles dessus.
 *
 * UNE MENTION N'EST PAS DU TEXTE. Si la tâche citée se ferme, l'épingle le
 * montre sans qu'on la réécrive — c'est ce qui distingue ce fil d'une
 * messagerie. Les `@` résolvent sur les sites et les clientes, les `#` sur les
 * titres de tâches, les deux en direct (`parseMentions`).
 *
 * LE RAIL NE MONTRE QUE LES ÉPINGLES : ce qui n'est pas épinglé n'a pas
 * vocation à être retrouvé.
 */

/** La tige d'une épingle ordinaire, et celle de l'ambre : elle pend plus haut pour se détacher. */
const TIGE = 18;
const TIGE_AMBRE = 10;
/** La largeur d'une fiche. La HAUTEUR, elle, n'est jamais posée. */
const FICHE_L = 246;

export interface EpingleMessage {
  id: string;
  body: string;
  authorEmail: string;
  pinned?: boolean;
}

export function RailDesEpingles({
  pinned,
  sites,
  clients,
  tasks,
  tachesOuvertes,
  onJump,
  onUnpin,
}: {
  pinned: EpingleMessage[];
  sites: DerivedSite[];
  clients: ClientRef[];
  tasks: TaskRef[];
  /** Les identifiants des tâches encore ouvertes — l'état vient du produit, pas du texte de l'épingle. */
  tachesOuvertes: Set<string>;
  onJump: (id: string) => void;
  onUnpin: (message: EpingleMessage) => void;
}) {
  const { profileFor } = useProfiles();

  const fiches = useMemo(
    () =>
      pinned.map((m) => {
        const segments = parseMentions(m.body ?? '', sites, clients, tasks);
        const mentions = segments.filter((s) => s.type !== 'text' && s.type !== 'link');
        const taches = segments.flatMap((s) => (s.type === 'taskMention' ? [s] : []));
        return { m, segments, mentions, taches, ouverte: taches.some((t) => tachesOuvertes.has(t.taskId)) };
      }),
    [pinned, sites, clients, tasks, tachesOuvertes],
  );

  /* UNE SEULE épingle porte l'ambre : la première dont une tâche citée est encore ouverte. */
  const ambre = fiches.find((f) => f.ouverte) ?? null;
  const halo = useHaloSignal(ambre !== null);
  /* Rien d'épinglé, pas de rail : le fil suffit, et un rail vide ne dirait rien. */
  if (fiches.length === 0) return null;

  return (
    <div className="border-b border-border bg-bg/60 px-3 pb-3 pt-2" data-rail={fiches.length}>
      <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">
        Épinglé · {fiches.length}
      </span>
      <div className="flex items-start gap-3 overflow-x-auto pt-1">
        {fiches.map((f) => {
          const enAmbre = ambre?.m.id === f.m.id;
          const groupe = enAmbre ? 'epingle-ouverte' : undefined;
          return (
            <div key={f.m.id} className="group/pin flex flex-none flex-col items-center" style={{ width: FICHE_L }} data-epingle={f.m.id}>
              {/* LA TIGE : c'est elle qui porte la mise en avant, parce qu'elle n'a rien à contenir. */}
              <span
                aria-hidden
                data-signal-groupe={groupe}
                className={`block w-px ${enAmbre ? `bg-signal ${halo}` : 'bg-border-strong'}`}
                style={{ height: enAmbre ? TIGE_AMBRE : TIGE }}
              />
              {/* LA FICHE : aucune hauteur, aucun overflow. Elle fait la taille de ce qu'elle porte. */}
              <div
                data-signal-groupe={groupe}
                className={`w-full border px-3 py-2.5 text-left ${enAmbre ? `bg-signal text-signal-ink border-signal ${halo}` : 'border-border bg-surface'}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate font-mono text-[9px] uppercase tracking-[0.1em] ${enAmbre ? 'opacity-70' : 'text-text-muted'}`}>
                    {profileFor(f.m.authorEmail).name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUnpin(f.m)}
                    aria-label="Désépingler"
                    className={`flex-none opacity-0 transition-opacity group-hover/pin:opacity-100 ${enAmbre ? 'text-signal-ink' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    <PinOff size={12} strokeWidth={2} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onJump(f.m.id)}
                  className={`mt-1 block w-full text-left text-[12.5px] leading-snug [text-wrap:pretty] ${enAmbre ? 'font-medium' : 'text-text-body'}`}
                >
                  {f.m.body || '(pièce jointe)'}
                </button>
                {f.mentions.length > 0 && (
                  /*
                    LES PUCES, EN PIED DE FICHE. Jetons sombres même sur la
                    plaque ambre : une puce ambre sur fond ambre serait illisible
                    — et ce ne sont pas des nœuds de signal, seulement ce que
                    l'épingle cite.
                  */
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {f.mentions.map((s, i) => (
                      <span
                        key={`${f.m.id}-${i}`}
                        /* Une puce tronquée ne cite plus rien : elle passe à la ligne plutôt que de couper le nom. */
                        className={`inline-flex max-w-full items-center break-words border px-1.5 py-[2px] font-mono text-[9.5px] leading-tight ${
                          enAmbre ? 'border-[#171717] bg-[#1e1e1e] text-text-body' : 'border-border-raised bg-raised text-text-secondary'
                        }`}
                      >
                        {s.type === 'taskMention'
                          ? `#${s.title}${tachesOuvertes.has(s.taskId) ? '' : ' · close'}`
                          : s.type === 'clientMention'
                            ? `@${s.client.name}`
                            : s.type === 'mention'
                              ? `@${s.site.name}`
                              : ''}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-[11.5px] leading-snug text-text-muted [text-wrap:pretty]">
        {ambre
          ? <>Une épingle cite une tâche encore ouverte : elle pend plus haut que les autres. Si la tâche se ferme, l’épingle le montrera sans qu’on la réécrive — une mention n’est pas du texte.</>
          : <>Aucune épingle ne cite de tâche ouverte. Le rail ne montre que ce qui a été épinglé : ce qui ne l’est pas n’a pas vocation à être retrouvé.</>}
      </p>
    </div>
  );
}
