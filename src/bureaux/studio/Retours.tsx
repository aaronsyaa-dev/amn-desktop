import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { uid } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import type { Piece } from '../donnees/studio';
import type { PieceStudio } from '../donnees/types';
import { Carte, Invitation } from '../ui/kit';
import { enLettres, ilYA, prenomDe } from '../format';
import { jjmm, Punaise, TetePiece, useEcrirePiece, usePieceCourante } from './commun';

/**
 * STUDIO · LES RETOURS DE LA CLIENTE (cahier 14, `48d` à droite, et l'onglet
 * Retours) — épinglés sur la page qu'ils concernent, pas perdus dans un fil.
 *
 * Numérotés dans l'ordre où ils sont arrivés. L'ambre (onglet Retours
 * seulement) : le plus ancien retour pas encore traité — c'est l'ambre du
 * bureau Studio, la fenêtre qui respire sur la façade.
 */

type Retour = NonNullable<PieceStudio['retours']>[number];

const SANS_PAGE = 'Toute la pièce';
const pageDe = (r: Retour) => r.page?.trim() || SANS_PAGE;
/** Sans place notée, les punaises se répartissent sur la page sans se chevaucher. */
const PLACES = [
  [34, 30],
  [70, 64],
  [48, 78],
  [22, 58],
  [76, 26],
  [56, 46],
];
const placeDe = (r: Retour, i: number) => ({ x: r.x ?? PLACES[i % PLACES.length][0], y: r.y ?? PLACES[i % PLACES.length][1] });

export function useRetours(p: Piece) {
  const ouverts = (p.retours ?? []).filter((r) => !r.traiteLe).sort((a, b) => a.at.localeCompare(b.at));
  const traites = (p.retours ?? []).filter((r) => r.traiteLe).sort((a, b) => (b.traiteLe ?? '').localeCompare(a.traiteLe ?? ''));
  const numero = new Map(ouverts.map((r, i) => [r.id, i + 1]));
  return { ouverts, traites, numero };
}

/** La page, dessinée, avec ses punaises ; dessous (en compact), la liste des retours ouverts. */
export function PageEpinglee({
  p,
  compacte = false,
  ambreId = null,
  choisi = null,
  onChoisir,
  onPoser,
}: {
  p: Piece;
  compacte?: boolean;
  ambreId?: string | null;
  choisi?: string | null;
  onChoisir?: (id: string) => void;
  onPoser?: (x: number, y: number) => void;
}) {
  const { ouverts, numero } = useRetours(p);
  const pages = [...new Set(ouverts.map(pageDe))];
  const [pageVue, setPageVue] = useState<string | null>(null);
  const duChoisi = ouverts.find((r) => r.id === choisi);
  const page = (duChoisi ? pageDe(duChoisi) : null) ?? (pageVue && pages.includes(pageVue) ? pageVue : pages[0]) ?? null;
  const surPage = ouverts.filter((r) => pageDe(r) === page);

  if (!ouverts.length) {
    return <p className="text-[13px] leading-relaxed text-[#a3a3a0]">Aucun retour en attente : tout ce que la cliente a signalé est traité.</p>;
  }
  return (
    <div>
      {pages.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Les pages">
          {pages.map((x) => (
            <button key={x} type="button" aria-pressed={x === page} onClick={() => setPageVue(x)} className="h-7 border px-2 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ borderColor: x === page ? '#8a8a87' : '#2a2826', color: x === page ? '#f7f7f5' : '#a3a3a0' }}>
              {x} · {ouverts.filter((r) => pageDe(r) === x).length}
            </button>
          ))}
        </div>
      )}
      <div
        className="relative border border-[#2a2826] bg-[#1c1b19]"
        style={{ aspectRatio: compacte ? '4 / 3' : '16 / 10', cursor: onPoser ? 'crosshair' : undefined }}
        onClick={(e) => {
          if (!onPoser || (e.target as HTMLElement).closest('button')) return;
          const r = e.currentTarget.getBoundingClientRect();
          onPoser(Math.round(((e.clientX - r.left) / r.width) * 100), Math.round(((e.clientY - r.top) / r.height) * 100));
        }}
        aria-label={`La page ${page}`}
      >
        {!compacte && (
          <>
            <span aria-hidden className="absolute left-[6%] right-[6%] top-[7%] h-[5%] bg-[#24221f]" />
            <span aria-hidden className="absolute left-[6%] top-[18%] h-[26%] w-[52%] bg-[#211f1c]" />
            <span aria-hidden className="absolute right-[6%] top-[18%] h-[26%] w-[30%] bg-[#211f1c]" />
            <span aria-hidden className="absolute bottom-[10%] left-[6%] right-[6%] top-[52%] bg-[#1f1d1a]" />
          </>
        )}
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#9a9a97]" aria-hidden>
          page {page}
        </span>
        {surPage.map((r) => {
          const pos = placeDe(r, (numero.get(r.id) ?? 1) - 1);
          const estAmbre = r.id === ambreId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onChoisir?.(r.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, outline: choisi === r.id ? '2px solid #f7f7f5' : undefined, outlineOffset: 3 }}
              aria-label={`Retour ${numero.get(r.id)} : ${r.texte}`}
              data-signal-groupe={estAmbre ? 'retour-ambre' : undefined}
            >
              <Punaise n={numero.get(r.id) ?? 0} ambre={estAmbre} />
            </button>
          );
        })}
      </div>
      {compacte && (
        <ol className="mt-3">
          {ouverts.map((r) => (
            <li key={r.id} className="grid grid-cols-[20px_minmax(0,1fr)] items-baseline gap-3 border-b border-[#1f1e1c] py-2.5">
              <span className="font-mono text-[11px] text-[#9a9a97]">{numero.get(r.id)}</span>
              <span className="min-w-0">
                <span className="block text-[13px] leading-snug text-[#f7f7f5]">« {r.texte} »</span>
                {r.page && <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#9a9a97]">page {r.page}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function StudioRetours() {
  const { p, absente } = usePieceCourante();
  if (!p) return <>{absente}</>;
  return <Retours p={p} />;
}

function Retours({ p }: { p: Piece }) {
  const ecrire = useEcrirePiece();
  const { user } = useAuth();
  const { ouverts, traites, numero } = useRetours(p);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [reponse, setReponse] = useState('');
  const [nouveau, setNouveau] = useState<{ texte: string; page: string } | null>(null);
  const ambre = ouverts[0] ?? null;
  const courant = ouverts.find((r) => r.id === choisi) ?? null;

  const maj = (id: string, f: (r: Retour) => Retour) => ecrire(p.id, (b) => ({ retours: (b.retours ?? []).map((r) => (r.id === id ? f(r) : r)) }));
  const traiter = (r: Retour, texte?: string) => {
    maj(r.id, (x) => ({ ...x, traiteLe: new Date().toISOString(), ...(texte ? { reponse: texte } : {}) }));
    setChoisi(null);
    setReponse('');
  };

  const titre = ouverts.length === 0 ? 'Tous les retours sont traités.' : ouverts.length === 1 ? 'Un retour attend votre réponse.' : `${enLettres(ouverts.length, true)} retours attendent votre réponse.`;

  return (
    <>
      <TetePiece
        p={p}
        onglet="retours"
        titre={titre}
        actions={
          <button type="button" className="bx-btn2" onClick={() => setNouveau({ texte: '', page: '' })}>
            Noter un retour
          </button>
        }
      />
      {nouveau && (
        <Carte pad="p-5" className="mb-[18px]" titre="Un retour reçu autrement" droite="téléphone, courriel, de vive voix">
          <form
            className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_200px_auto_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nouveau.texte.trim()) return;
              const id = uid('rt');
              ecrire(p.id, (b) => ({ retours: [...(b.retours ?? []), { id, texte: nouveau.texte.trim().replace(/^«\s*|\s*»$/g, ''), page: nouveau.page.trim() || null, at: new Date().toISOString(), par: user?.email ?? null }] }));
              setNouveau(null);
              setChoisi(id);
            }}
          >
            <input autoFocus value={nouveau.texte} onChange={(e) => setNouveau({ ...nouveau, texte: e.target.value })} placeholder="Ce qu’elle a dit…" aria-label="Le retour" className="h-9 border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]" />
            <input value={nouveau.page} onChange={(e) => setNouveau({ ...nouveau, page: e.target.value })} placeholder="La page (« Tarifs »)" aria-label="La page" className="h-9 border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]" />
            <button type="submit" className="bx-btn" disabled={!nouveau.texte.trim()}>
              Épingler
            </button>
            <button type="button" className="bx-btn2" onClick={() => setNouveau(null)}>
              Annuler
            </button>
          </form>
        </Carte>
      )}
      {ouverts.length === 0 && traites.length === 0 ? (
        <Invitation titre="Aucun retour pour l’instant." texte="Ce que la cliente signale s’épingle sur la page concernée, numéroté, et attend une réponse ici." />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_380px]">
          <Carte dominante pad="p-6" className="self-start" titre="La page, et ses punaises" droite={courant ? `cliquer sur la page déplace la punaise ${numero.get(courant.id)}` : 'un clic sur une punaise ouvre son retour'}>
            <PageEpinglee p={p} ambreId={ambre?.id ?? null} choisi={choisi} onChoisir={setChoisi} onPoser={courant ? (x, y) => maj(courant.id, (r) => ({ ...r, x, y })) : undefined} />
          </Carte>
          <div className="flex flex-col gap-[18px] self-start">
            <Carte titre="À traiter" droite={ouverts.length || ''}>
              {ouverts.length === 0 && <p className="text-[13px] text-[#a3a3a0]">Rien n’attend.</p>}
              <ol>
                {ouverts.map((r) => {
                  const estAmbre = r.id === ambre?.id;
                  const on = r.id === choisi;
                  return (
                    <li key={r.id} className="border-b border-[#1f1e1c]" style={estAmbre ? { boxShadow: `inset 2px 0 0 ${AMBRE}`, background: 'rgba(208,154,74,.05)' } : undefined} data-signal-groupe={estAmbre ? 'retour-ambre' : undefined}>
                      <button type="button" onClick={() => setChoisi(on ? null : r.id)} className="grid w-full grid-cols-[22px_minmax(0,1fr)] gap-3 px-2.5 py-3 text-left" aria-expanded={on}>
                        <Punaise n={numero.get(r.id) ?? 0} taille={18} creuse={!estAmbre} ambre={false} className="mt-px" />
                        <span className="min-w-0">
                          <span className="block text-[13.5px] leading-snug text-[#f7f7f5]">« {r.texte} »</span>
                          <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: estAmbre ? AMBRE : '#9a9a97' }}>
                            {r.page ? `page ${r.page} · ` : ''}
                            {ilYA(r.at)}
                            {estAmbre ? ' · attend votre réponse' : ''}
                          </span>
                        </span>
                      </button>
                      {on && (
                        <div className="px-2.5 pb-3 pl-[46px]">
                          <textarea value={reponse} onChange={(e) => setReponse(e.target.value)} rows={2} placeholder="Ce qu’on lui répond (gardé avec le retour)…" aria-label="La réponse" className="w-full resize-none border border-[#2a2826] bg-transparent p-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]" />
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                            <button type="button" className="bx-btn2" disabled={!reponse.trim()} onClick={() => traiter(r, reponse.trim())}>
                              Répondu, traité
                            </button>
                            <button type="button" className="bx-lien" onClick={() => traiter(r)}>
                              Traité sans réponse
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </Carte>
            {traites.length > 0 && (
              <Carte titre="Traités" droite={traites.length}>
                {traites.slice(0, 8).map((r) => (
                  <div key={r.id} className="border-b border-[#1f1e1c] py-2.5">
                    <span className="block text-[13px] leading-snug text-[#a3a3a0]">« {r.texte} »</span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-[#9a9a97]">
                      {r.page ? `page ${r.page} · ` : ''}traité le {jjmm(r.traiteLe ?? r.at)}
                      {r.par ? ` · de ${prenomDe(r.par)}` : ''}
                    </span>
                    {r.reponse && <span className="mt-1.5 block text-[12.5px] text-[#e4e4e1]">↳ {r.reponse}</span>}
                  </div>
                ))}
              </Carte>
            )}
          </div>
        </div>
      )}
    </>
  );
}
