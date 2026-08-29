import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Plus, Users } from 'lucide-react';
import { disposer, rayon } from '../lib/notesGraphe';
import { isolees, type Graphe, type NoteLiable } from '../lib/notesLiens';

/*
  LA VUE GRAPHE — pourquoi elle existe, et ce qu'elle ne fait pas.

  La liste répond à « qu'est-ce que j'ai écrit récemment ». Elle ne répond
  jamais à « qu'est-ce qui se rattache à quoi » : deux notes écrites à six mois
  d'écart et qui se citent l'une l'autre sont, dans une liste triée par date,
  aussi éloignées que deux notes qui n'ont rien à voir. Le graphe est la seule
  vue où cette proximité-là devient visible.

  Ce qu'elle ne fait pas, délibérément : pas de zoom, pas de déplacement à la
  souris, pas de simulation qui continue de bouger. Un graphe qui tremble en
  permanence oblige à attendre qu'il se pose avant de viser un nœud, et on ne
  peut plus s'en servir de repère — la même note serait ailleurs à chaque
  ouverture. `disposer()` est déterministe et calculé une fois : le même carnet
  donne toujours le même dessin, et on finit par savoir où regarder.

  ## Les nœuds sont des boutons HTML, pas des cercles SVG

  Un `<circle>` cliquable ne s'annonce pas, ne prend pas le focus au clavier,
  et n'a pas d'anneau de focus. Ici le SVG ne dessine QUE les traits — il ne
  reçoit aucun clic — et chaque note est un vrai `<button>` posé par-dessus. Il
  hérite donc de tout : nom accessible, tabulation, anneau de focus, taille de
  cible réelle.

  ## La toile prend la place disponible, et grandit avec le carnet

  Deux contraintes, et la plus grande gagne :

    · elle remplit le cadre. Premier jet : une toile de 420 px posée au milieu
      d'un panneau de 1 080 — neuf notes serrées dans un timbre-poste avec des
      étiquettes tronquées, et le reste vide. La place était là, elle n'était
      pas prise.
    · elle ne descend jamais sous √n × un pas. Un graphe dessiné dans la seule
      place disponible devient un amas dès qu'il y a trente notes : les
      libellés se recouvrent et les cibles se collent. Passé ce seuil, la toile
      dépasse le cadre et celui-ci défile — mieux vaut faire défiler qu'obliger
      à viser entre deux étiquettes superposées (`docs/PRINCIPE-CONFORT.md`).

  Elle reste CARRÉE : `disposer()` travaille dans un carré, et l'étirer sur un
  panneau large rapprocherait verticalement des notes que rien ne rapproche.
*/

/** Le pas entre deux notes voisines, en pixels : de quoi loger un point et son titre. */
const PAS_PX = 116;
/** En dessous, le dessin n'est plus lisible quel que soit le cadre. */
const PLANCHER_PX = 420;
/** La marge autour du dessin : un nœud au bord aurait son étiquette coupée. */
const MARGE_PX = 64;
/** La cible d'un nœud : pleine taille, parce qu'on vise un point de 10 px. */
const CIBLE_PX = 44;

export function NotesGraphe({
  graphe,
  selectionne,
  onOuvrir,
  onCreer,
}: {
  graphe: Graphe;
  selectionne: string | null;
  onOuvrir: (id: string) => void;
  onCreer?: (titre: string) => void;
}) {
  const cadre = useRef<HTMLDivElement | null>(null);
  const [dispo, setDispo] = useState(0);

  /*
    On mesure le cadre plutôt que de deviner : la barre latérale se replie, la
    fenêtre change de taille, et le poste comme le téléphone passent par ici.
  */
  useEffect(() => {
    const el = cadre.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setDispo(Math.floor(Math.min(r.width, r.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const places = useMemo(() => disposer(graphe.noeuds, graphe.arcs), [graphe]);
  const parId = useMemo(() => new Map(graphe.noeuds.map((n) => [n.id, n])), [graphe]);
  const seules = useMemo(() => isolees(graphe), [graphe]);

  /*
    √n × un pas : la densité reste constante quand le carnet grossit, au lieu
    que le dessin se tasse. Le plancher garde un petit carnet lisible plutôt
    que trois points perdus dans un timbre-poste.
  */
  const cote = Math.max(
    PLANCHER_PX,
    dispo,
    Math.ceil(Math.sqrt(Math.max(places.length, 1))) * PAS_PX,
  );
  const utile = cote - 2 * MARGE_PX;
  const px = (v: number) => MARGE_PX + v * utile;

  const pos = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  if (graphe.noeuds.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center border border-border bg-surface p-8">
        <p className="max-w-sm text-center text-sm text-text-secondary">
          Rien à relier pour l’instant. Écrivez <code className="font-mono text-text-primary">[[titre]]</code> dans une
          note : le lien apparaîtra ici.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
        <span>
          {graphe.noeuds.length} note{graphe.noeuds.length > 1 ? 's' : ''}
        </span>
        <span>
          {graphe.arcs.length} lien{graphe.arcs.length > 1 ? 's' : ''}
        </span>
        {seules.length > 0 && (
          <span>
            {seules.length} isolée{seules.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/*
        `min-h-[420px]` : sur un téléphone, le panneau se faisait comprimer à
        deux cents pixels de haut par tout ce qui l'entoure, et on ne voyait
        plus qu'un tiers du dessin par une meurtrière. Le cadre garde donc une
        hauteur tenable et c'est la PAGE qui s'allonge — faire défiler la page
        est un geste ordinaire, deviner un graphe par un hublot ne l'est pas.
      */}
      <div ref={cadre} className="min-h-[420px] flex-1 overflow-auto p-2">
        <div className="relative mx-auto" style={{ width: cote, height: cote }}>
          {/*
            Le SVG ne porte aucun clic : `pointer-events-none` évite qu'un trait
            passant sous un nœud vole le clic destiné à la note. `aria-hidden`
            parce que les traits ne disent rien de plus que les boutons — la
            relation est déjà lisible par les rétroliens, à l'oreille.
          */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0"
            width={cote}
            height={cote}
            viewBox={`0 0 ${cote} ${cote}`}
          >
            {graphe.arcs.map((a) => {
              const d = pos.get(a.de);
              const v = pos.get(a.vers);
              if (!d || !v) return null;
              const touche = selectionne === a.de || selectionne === a.vers;
              return (
                <line
                  key={`${a.de}→${a.vers}`}
                  x1={px(d.x)}
                  y1={px(d.y)}
                  x2={px(v.x)}
                  y2={px(v.y)}
                  stroke="currentColor"
                  /*
                    `text-border` sur `bg-surface`, c'était deux gris à un
                    cheveu l'un de l'autre : les traits existaient sans se
                    voir, et le dessin ne disait donc rien. Le confort de
                    lecture passe avant la discrétion.
                  */
                  className={touche ? 'text-accent' : 'text-text-muted'}
                  strokeOpacity={touche ? 1 : 0.55}
                  strokeWidth={touche ? 2 : 1.25}
                />
              );
            })}
          </svg>

          {places.map((p) => {
            const note = parId.get(p.id);
            if (!note) return null;
            const d = rayon(p.degre) * 2;
            const actif = p.id === selectionne;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onOuvrir(p.id)}
                title={note.title || 'Sans titre'}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                style={{ left: px(p.x), top: px(p.y), minWidth: CIBLE_PX, minHeight: CIBLE_PX }}
              >
                <span
                  aria-hidden
                  className={`block flex-shrink-0 rounded-full transition-colors ${
                    actif
                      ? 'bg-accent ring-2 ring-accent/40'
                      : note.scope === 'personal'
                        ? 'bg-text-muted'
                        : 'bg-text-secondary'
                  }`}
                  style={{ width: d, height: d }}
                />
                <span
                  className={`max-w-[140px] truncate text-[11px] leading-none ${
                    actif ? 'text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  {note.title || 'Sans titre'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/*
        LES NOTES CITÉES QUI N'EXISTENT PAS.

        Obsidian les appelle « liens non résolus », et c'est là qu'elles ont
        leur place : dans le graphe, on voit d'un coup tout ce qu'on s'est
        promis d'écrire. Les laisser seulement en pointillé au fil du texte,
        c'est ne jamais en retrouver la liste.
      */}
      {onCreer && graphe.manquants.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Cité{graphe.manquants.length > 1 ? 's' : ''} mais pas encore écrit
            {graphe.manquants.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {graphe.manquants.slice(0, 24).map((titre) => (
              <button
                key={titre}
                type="button"
                onClick={() => onCreer(titre)}
                title={`Créer la note « ${titre} »`}
                className="flex min-h-6 items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
              >
                <Plus size={12} strokeWidth={2} className="flex-shrink-0" />
                <span className="max-w-[180px] truncate">{titre}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Legende seules={seules} />
    </div>
  );
}

/*
  Deux gris ne se distinguent pas sans qu'on dise lequel est lequel — et une
  légende de deux lignes coûte moins qu'un code couleur qu'il faut deviner.
*/
function Legende({ seules }: { seules: NoteLiable[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-[11px] text-text-secondary">
      <span className="flex items-center gap-1.5">
        <Users size={12} strokeWidth={1.75} className="text-text-secondary" />
        Équipe
      </span>
      <span className="flex items-center gap-1.5">
        <Lock size={12} strokeWidth={1.75} className="text-text-muted" />
        Personnelle
      </span>
      <span className="text-text-muted">Un point plus gros a plus de liens.</span>
      {seules.length > 0 && (
        <span className="text-text-muted">
          Les points sans trait ne citent rien et ne sont cités par personne.
        </span>
      )}
    </div>
  );
}
