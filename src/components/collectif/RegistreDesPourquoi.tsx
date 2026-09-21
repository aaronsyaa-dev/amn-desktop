import React, { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { useHaloSignal } from '../EtatEcran';
import { UserAvatar } from '../UserAvatar';
import { ConfirmDelete } from '../ConfirmDelete';
import { relativeTime } from '../../lib/time';

/**
 * COLLECTIF · DÉCISIONS — le registre des pourquoi.
 *
 * Deux colonnes : la décision à gauche, SON MOTIF À DROITE, À SA VRAIE
 * LONGUEUR. Le motif est facultatif dans le produit, et c'est exactement ce
 * qu'il faut rendre visible — une décision sans motif se relit six mois plus
 * tard sans qu'on sache ce qu'on avait en tête. La colonne vide n'est pas un
 * blanc de mise en page : c'est LE MANQUE LUI-MÊME, dessiné en creux à côté de
 * ce qu'il devrait expliquer.
 *
 * Un fil vertical relie les points, le plus récent en haut — l'ordre du produit
 * (`createdAt` décroissant), pas un ordre inventé ici.
 *
 * L'AMBRE, unique : la décision sans motif ENCORE ASSEZ RÉCENTE pour qu'on s'en
 * souvienne — son point sur le fil et son creux. Deux nœuds. Les motifs perdus
 * depuis longtemps restent gris : les signaler ne servirait à rien, personne ne
 * peut plus les écrire.
 *
 * LE SEUIL DE RATTRAPAGE EST UNE DÉCISION DE DESIGN, PAS UNE DONNÉE DU PRODUIT.
 * `DecisionData` ne porte que `title`, `detail`, `authorEmail`, `createdAt` :
 * rien n'y dit à partir de quand un motif est perdu. Un mois est posé ici, et
 * il est ÉCRIT à l'écran plutôt que caché dans le code — un seuil qu'on ne peut
 * pas lire est un seuil qu'on ne peut pas contester.
 */

/** Un mois : au-delà, on ne se rappelle plus assez pour écrire le motif. Seuil de design, dit à l'écran. */
const RATTRAPABLE_MS = 30 * 86_400_000;

export interface Decision {
  id: string;
  title: string;
  detail: string;
  authorEmail: string;
  createdAt: string;
}

export function RegistreDesPourquoi({
  decisions,
  nomDe,
  onRapport,
  onSupprimer,
}: {
  decisions: Decision[];
  nomDe: (email: string) => string;
  onRapport: (d: Decision) => void;
  onSupprimer: (d: Decision) => void;
}) {
  const lecture = useMemo(() => {
    const maintenant = Date.now();
    const sans = decisions.filter((d) => !d.detail?.trim());
    const rattrapables = sans.filter((d) => {
      const at = Date.parse(d.createdAt);
      return Number.isFinite(at) && maintenant - at <= RATTRAPABLE_MS;
    });
    /* La plus récente des rattrapables : une seule décision porte l'ambre, celle qu'on peut encore écrire. */
    const ambre = rattrapables[0] ?? null;
    return { avec: decisions.length - sans.length, sans: sans.length, rattrapables: rattrapables.length, ambre };
  }, [decisions]);

  const { avec, sans, rattrapables, ambre } = lecture;
  const halo = useHaloSignal(ambre !== null);
  /* Un journal vide n'a pas de registre : ni fil, ni part à zéro. */
  if (decisions.length === 0) return null;

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-registre={decisions.length}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Ce qui a été tranché, et pourquoi</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">Le motif à sa vraie longueur · le manque en creux</span>
      </div>

      <ol className="relative">
        {decisions.map((d, i) => {
          const motif = d.detail?.trim() ?? '';
          const enAmbre = ambre?.id === d.id;
          const groupe = enAmbre ? 'motif-rattrapable' : undefined;
          return (
            <li key={d.id} className="group/dec relative grid grid-cols-[13px_minmax(0,1fr)] gap-3.5 pb-5 last:pb-0 sm:grid-cols-[13px_minmax(0,1fr)_minmax(0,1fr)] sm:gap-5" data-decision={d.id}>
              {/* LE FIL : il relie les points, il ne les décore pas. Il s'arrête au dernier. */}
              <span className="relative block">
                {i !== decisions.length - 1 && <span aria-hidden className="absolute bottom-0 left-[6px] top-4 w-px bg-border" />}
                <span
                  data-signal-groupe={groupe}
                  className={`absolute left-0 top-[7px] block h-[11px] w-[11px] rounded-full border-2 ${enAmbre ? `border-signal bg-signal ${halo}` : 'border-border-strong bg-surface'}`}
                />
              </span>

              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-[13.5px] font-semibold text-text-primary">{d.title}</p>
                  <span className="flex flex-none items-center gap-2">
                    <time className="font-mono text-[10px] uppercase tracking-wide text-text-muted">{relativeTime(d.createdAt)}</time>
                    <span className="opacity-0 transition-opacity group-hover/dec:opacity-100">
                      <ConfirmDelete onConfirm={() => onSupprimer(d)} label="Supprimer la décision" />
                    </span>
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <UserAvatar email={d.authorEmail} size={18} />
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">Décidé par {nomDe(d.authorEmail)}</span>
                  <button
                    type="button"
                    onClick={() => onRapport(d)}
                    className="ml-auto flex items-center gap-1.5 border border-border-strong px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-text-secondary opacity-0 transition-opacity hover:text-text-primary group-hover/dec:opacity-100"
                  >
                    <FileText size={10} strokeWidth={2} />
                    Faire un rapport
                  </button>
                </div>
              </div>

              {/*
                LA COLONNE DE DROITE. Un motif y tient SA hauteur — rien ne la
                fixe, donc un long motif pèse visiblement plus qu'un court. Sans
                motif, la colonne n'est pas laissée vide : le creux est dessiné,
                parce que c'est lui l'information.
              */}
              {motif ? (
                <p className="min-w-0 border-l border-border pl-4 text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{motif}</p>
              ) : (
                <p
                  data-signal-groupe={groupe}
                  className={`min-w-0 border border-dashed px-3.5 py-2.5 text-[12.5px] leading-snug ${enAmbre ? `border-signal text-signal ${halo}` : 'border-border text-text-muted'}`}
                >
                  {enAmbre
                    ? 'Pas de motif — et c’est encore frais : écrivez-le pendant que vous vous en souvenez.'
                    : 'Pas de motif. Trop ancien pour être reconstitué de mémoire.'}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-[22px] grid gap-5 border-t border-border-raised pt-5 lg:grid-cols-2">
        <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
          {avec} décision{avec > 1 ? 's' : ''} sur {decisions.length} {avec > 1 ? 'portent' : 'porte'} un motif ; {sans} n’en {sans > 1 ? 'ont' : 'a'} pas
          {sans > 0 && <>, dont {rattrapables === 0 ? 'aucune rattrapable' : `${rattrapables} rattrapable${rattrapables > 1 ? 's' : ''}`}</>}.
          {' '}Un mois : c’est le délai posé ici, pas une donnée du produit — au-delà, le motif ne se reconstitue plus de mémoire, et le creux reste gris.
        </p>
        <p className="text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
          Du journal au rapport : une décision se transforme d’un geste — titre, date, auteur et motif passent tels quels dans le brouillon. Une décision sans motif produit un rapport qui dit « pas de détail », et c’est la seconde raison de remplir la colonne de droite. La suppression passe par l’annulation différée, comme partout dans le poste.
        </p>
      </div>
    </article>
  );
}
