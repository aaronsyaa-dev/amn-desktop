import React, { useRef, useState } from 'react';
import { resizeImageToDataUrl } from '../../lib/imageResize';
import { uid } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useStudio } from '../donnees/studio';
import type { PieceStudio } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { deNom, enLettres, jourMois } from '../format';
import { useEcrirePiece } from './commun';

/**
 * STUDIO · LA RECETTE VISUELLE (cahier 15, `51c` · 11).
 *
 * Deux captures de la même page, avant et après une livraison, et ce qui a
 * bougé, écrit ligne à ligne. Une recette se valide : tant qu'elle ne l'est
 * pas, elle attend quelqu'un.
 *
 * L'ambre : la plus ancienne recette qui attend sa validation.
 */

type Recette = NonNullable<PieceStudio['recettes']>[number];

export function StudioRecette() {
  const s = useStudio();
  const ecrire = useEcrirePiece();
  const [choisie, setChoisie] = useState<string | null>(null);
  const [ecart, setEcart] = useState('');
  const [nouvelle, setNouvelle] = useState<{ pieceId: string; page: string } | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const cote = useRef<'avant' | 'apres'>('avant');
  const toutes = s.pieces.flatMap((p) => (p.recettes ?? []).map((r) => ({ p, r })));
  const attente = toutes.filter((x) => !x.r.validee).sort((a, b) => a.r.at.localeCompare(b.r.at));
  const ambre = attente[0] ?? null;
  const vue = toutes.find((x) => x.r.id === choisie) ?? ambre ?? toutes[0] ?? null;
  const majRecette = (pieceId: string, id: string, f: (r: Recette) => Recette) => ecrire(pieceId, (b) => ({ recettes: (b.recettes ?? []).map((r) => (r.id === id ? f(r) : r)) }));
  const titre = ambre ? `La page ${ambre.r.page} ${deNom(ambre.p.orgNom)} a bougé : ${enLettres(ambre.r.ecarts.length)} écart${ambre.r.ecarts.length > 1 ? 's' : ''} à valider.` : toutes.length ? 'Toutes les recettes sont validées.' : 'Aucune recette encore.';

  return (
    <>
      <EnTete
        surtitre="Studio · Recette visuelle"
        titre={titre}
        actions={
          <button type="button" className="bx-btn2" onClick={() => setNouvelle({ pieceId: s.pieces[0]?.id ?? '', page: '' })}>
            Nouvelle recette
          </button>
        }
      />
      {nouvelle && (
        <Carte pad="p-5" className="mb-[18px]" titre="Nouvelle recette">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nouvelle.pieceId || !nouvelle.page.trim()) return;
              const id = uid('rc');
              ecrire(nouvelle.pieceId, (b) => ({ recettes: [...(b.recettes ?? []), { id, page: nouvelle.page.trim(), ecarts: [], at: new Date().toISOString(), validee: false }] }));
              setNouvelle(null);
              setChoisie(id);
            }}
          >
            <select value={nouvelle.pieceId} onChange={(e) => setNouvelle({ ...nouvelle, pieceId: e.target.value })} aria-label="La pièce" className="h-9 border border-[#2a2826] bg-[#141312] px-2.5 text-[13px] text-text-primary">
              {s.pieces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plaque} · {p.orgNom}
                </option>
              ))}
            </select>
            <input value={nouvelle.page} onChange={(e) => setNouvelle({ ...nouvelle, page: e.target.value })} placeholder="La page (« Commande »)" aria-label="La page" className="h-9 min-w-0 flex-1 border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]" />
            <button type="submit" className="bx-btn">
              Ouvrir
            </button>
          </form>
        </Carte>
      )}
      {!vue ? (
        <Invitation titre="Aucune recette." texte="Avant et après une livraison : deux captures de la même page, et ce qui a bougé. On valide, ou on corrige." />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px]">
          <Carte dominante pad="p-6" className="self-start" titre={`${vue.p.plaque} · ${vue.p.orgNom} · page ${vue.r.page}`} droite={jourMois(vue.r.at)}>
            <div className="grid grid-cols-2 gap-4">
              {(['avant', 'apres'] as const).map((c) => {
                const img = vue.r[c];
                return (
                  <figure key={c} className="m-0">
                    <button
                      type="button"
                      onClick={() => {
                        cote.current = c;
                        fichier.current?.click();
                      }}
                      className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden border border-[#2a2826] bg-[#1c1b19]"
                      style={c === 'apres' && vue.r.id === ambre?.r.id ? { borderColor: AMBRE } : undefined}
                      data-signal-groupe={c === 'apres' && vue.r.id === ambre?.r.id ? 'recette-ambre' : undefined}
                      aria-label={img ? `Changer la capture ${c === 'avant' ? 'd’avant' : 'd’après'}` : `Déposer la capture ${c === 'avant' ? 'd’avant' : 'd’après'}`}
                    >
                      {img ? <img src={img} alt={`Page ${vue.r.page}, ${c === 'avant' ? 'avant' : 'après'}`} className="h-full w-full object-cover object-top" /> : <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">{c === 'avant' ? 'avant' : 'après'} · déposer</span>}
                    </button>
                    <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary">{c === 'avant' ? 'Avant la livraison' : 'Après'}</figcaption>
                  </figure>
                );
              })}
            </div>
            <input
              ref={fichier}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const img = await resizeImageToDataUrl(f, 900, 0.8);
                majRecette(vue.p.id, vue.r.id, (r) => ({ ...r, [cote.current]: img }));
              }}
            />
            <span className="mt-5 block font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#9a9a97]">Ce qui a bougé</span>
            {vue.r.ecarts.length === 0 && <p className="mt-2 text-[13px] text-[#a3a3a0]">Rien de noté.</p>}
            <ol className="mt-1">
              {vue.r.ecarts.map((x, i) => (
                <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-3 border-b border-[#1f1e1c] py-2.5 text-[13.5px] text-[#e4e4e1]">
                  <span className="font-mono text-[11px] text-[#9a9a97]">{i + 1}</span>
                  {x}
                </li>
              ))}
            </ol>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!ecart.trim()) return;
                majRecette(vue.p.id, vue.r.id, (r) => ({ ...r, ecarts: [...r.ecarts, ecart.trim()] }));
                setEcart('');
              }}
            >
              <input value={ecart} onChange={(e) => setEcart(e.target.value)} placeholder="Un écart (« le bouton passe sur deux lignes à 390 px »)" aria-label="Un écart" className="h-9 min-w-0 flex-1 border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]" />
              <button type="submit" className="bx-btn2" disabled={!ecart.trim()}>
                Noter
              </button>
            </form>
            <div className="mt-4 flex gap-2.5">
              {vue.r.validee ? (
                <span className="text-[13px] text-[#a3a3a0]">Validée.</span>
              ) : (
                <button type="button" className="bx-btn" onClick={() => majRecette(vue.p.id, vue.r.id, (r) => ({ ...r, validee: true }))}>
                  Valider la recette
                </button>
              )}
            </div>
          </Carte>
          <Carte className="self-start" titre="Les recettes" droite={toutes.length}>
            {toutes.map((x) => (
              <button key={x.r.id} type="button" onClick={() => setChoisie(x.r.id)} aria-pressed={vue.r.id === x.r.id} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#1f1e1c] py-2.5 text-left">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-[#f7f7f5]">
                    {x.p.plaque} · {x.r.page}
                  </span>
                  <span className="block truncate text-[12px] text-[#a3a3a0]">{x.p.orgNom}</span>
                </span>
                <span className="font-mono text-[10px] uppercase text-[#9a9a97]">{x.r.validee ? 'validée' : 'à valider'}</span>
              </button>
            ))}
          </Carte>
        </div>
      )}
    </>
  );
}
