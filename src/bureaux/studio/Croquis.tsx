import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { uid } from '../../state/SyncContext';
import { resizeImageToDataUrl } from '../../lib/imageResize';
import { decisionsEnAttente, type Piece } from '../donnees/studio';
import type { PieceStudio } from '../donnees/types';
import { Carte, Invitation } from '../ui/kit';
import { enLettresF } from '../format';
import { jjmm, Punaise, TetePiece, useEcrirePiece, usePieceCourante } from './commun';

/**
 * STUDIO · LE MUR DE CROQUIS (cahier 14, `48a`).
 *
 * Maquettes, croquis, captures, inspirations, déposés en liberté, un peu de
 * travers (−1,2° à +1,2°), légendés. On glisse une image n'importe où sur le
 * mur ; on déplace une pièce en la tirant ; un clic sur une image pose une
 * punaise numérotée, dont la phrase vit dans la colonne de droite.
 *
 * L'ambre : la punaise de la décision qui attend la cliente — la première,
 * s'il y en a plusieurs. Sa phrase reste à l'encre dans la liste, marquée
 * d'un cercle creux.
 */

type Croquis = NonNullable<PieceStudio['croquis']>[number];
type Genre = Croquis['genre'];
type Pos = { x: number; y: number; l: number; h: number };

const GENRES: Genre[] = ['maquette', 'croquis', 'capture', 'inspiration'];
/** Largeur (unités de mur, 1000 = tout le mur) et rapport largeur/hauteur par genre. */
const TAILLES: Record<Genre, { l: number; r: number }> = {
  maquette: { l: 400, r: 1.42 },
  croquis: { l: 250, r: 1.27 },
  capture: { l: 290, r: 1.5 },
  inspiration: { l: 225, r: 0.8 },
};
const LEGENDE = 38;
const MARGE = 30;

const empreinte = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const rotation = (c: Croquis) => c.rot ?? ((empreinte(c.id) % 25) - 12) / 10;

/** Le rangement du mur : ce qui a une place la garde ; le reste se range par rangées. */
function disposer(liste: Croquis[]): Map<string, Pos> {
  const r = new Map<string, Pos>();
  let x = MARGE;
  let y = 26;
  let rang = 0;
  for (const c of liste) {
    const l = c.largeur ?? TAILLES[c.genre].l;
    const h = l / (c.ratio ?? TAILLES[c.genre].r);
    if (typeof c.x === 'number' && typeof c.y === 'number') {
      r.set(c.id, { x: c.x, y: c.y, l, h });
      continue;
    }
    if (x + l > 1000 - MARGE + 5 && x > MARGE) {
      x = MARGE;
      y += rang + LEGENDE + 34;
      rang = 0;
    }
    r.set(c.id, { x, y: y + (empreinte(c.id) % 17) - 8, l, h });
    x += l + 36;
    rang = Math.max(rang, h);
  }
  return r;
}

export function StudioCroquis() {
  const { p, absente } = usePieceCourante();
  if (!p) return <>{absente}</>;
  return <Mur p={p} />;
}

function Mur({ p }: { p: Piece }) {
  const ecrire = useEcrirePiece();
  const croquis = p.croquis ?? [];
  const mur = useRef<HTMLDivElement>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const [largeur, setLargeur] = useState(760);
  const [tire, setTire] = useState<{ id: string; x: number; y: number } | null>(null);
  const [brouillon, setBrouillon] = useState<{ croquisId: string; n: number; x: number; y: number; texte: string } | null>(null);
  const [choisie, setChoisie] = useState<number | null>(null);
  const [piece, setPiece] = useState<string | null>(null);
  const [depot, setDepot] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const geste = useRef<{ id: string; px: number; py: number; x0: number; y0: number; bouge: boolean; cible: HTMLElement } | null>(null);
  const annule = useRef(false);

  useLayoutEffect(() => {
    const el = mur.current;
    if (!el) return;
    const mesurer = () => setLargeur(el.clientWidth || 760);
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const k = largeur / 1000;
  const places = useMemo(() => disposer(croquis), [croquis]);
  const place = (c: Croquis): Pos => {
    const pos = places.get(c.id)!;
    return tire?.id === c.id ? { ...pos, x: tire.x, y: tire.y } : pos;
  };
  const hauteur = Math.max(470, ...croquis.map((c) => place(c).y + place(c).h + LEGENDE + MARGE));
  const punaises = croquis.flatMap((c) => (c.punaises ?? []).map((x) => ({ ...x, croquisId: c.id }))).sort((a, b) => a.n - b.n);
  const attente = decisionsEnAttente(p);
  const ambre = attente[0] ?? null;
  const prochain = Math.max(0, ...punaises.map((x) => x.n)) + 1;

  const majCroquis = (id: string, f: (c: Croquis) => Croquis | null) =>
    ecrire(p.id, (b) => ({ croquis: (b.croquis ?? []).map((c) => (c.id === id ? f(c) : c)).filter((c): c is Croquis => c !== null) }));
  const majPunaise = (n: number, f: (x: NonNullable<Croquis['punaises']>[number]) => NonNullable<Croquis['punaises']>[number] | null) =>
    ecrire(p.id, (b) => ({
      croquis: (b.croquis ?? []).map((c) => ({ ...c, punaises: (c.punaises ?? []).map((x) => (x.n === n ? f(x) : x)).filter((x): x is NonNullable<typeof x> => x !== null) })),
    }));

  /* ── Tirer une pièce, ou poser une punaise d'un clic ── */
  const appuyer = (e: React.PointerEvent<HTMLElement>, c: Croquis) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-punaise]')) return;
    const pos = place(c);
    geste.current = { id: c.id, px: e.clientX, py: e.clientY, x0: pos.x, y0: pos.y, bouge: false, cible: e.currentTarget };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const bouger = (e: React.PointerEvent<HTMLElement>) => {
    const g = geste.current;
    if (!g) return;
    const dx = e.clientX - g.px;
    const dy = e.clientY - g.py;
    if (!g.bouge && Math.hypot(dx, dy) < 5) return;
    g.bouge = true;
    const pos = places.get(g.id)!;
    setTire({ id: g.id, x: Math.min(1000 - pos.l - 6, Math.max(6, g.x0 + dx / k)), y: Math.max(6, g.y0 + dy / k) });
  };
  const lacher = (e: React.PointerEvent<HTMLElement>, c: Croquis) => {
    const g = geste.current;
    geste.current = null;
    if (!g) return;
    if (g.bouge && tire) {
      // La première fois qu'on déplace, tout le mur fige sa place : rien d'autre ne saute.
      const figees = new Map([...places].map(([id, pos]) => [id, id === tire.id ? { ...pos, x: tire.x, y: tire.y } : pos]));
      ecrire(p.id, (b) => ({ croquis: (b.croquis ?? []).map((x) => (figees.has(x.id) ? { ...x, x: Math.round(figees.get(x.id)!.x), y: Math.round(figees.get(x.id)!.y) } : x)) }));
      setTimeout(() => setTire(null), 0);
      return;
    }
    const image = (g.cible.querySelector('[data-image]') as HTMLElement | null)?.getBoundingClientRect();
    if (!image || e.clientY > image.bottom) {
      setPiece(c.id);
      return;
    }
    poser(c.id, ((e.clientX - image.left) / image.width) * 100, ((e.clientY - image.top) / image.height) * 100);
  };
  const poser = (croquisId: string, x: number, y: number) => {
    annule.current = false;
    setBrouillon({ croquisId, n: prochain, x: Math.round(Math.min(96, Math.max(4, x))), y: Math.round(Math.min(94, Math.max(6, y))), texte: '' });
    setChoisie(prochain);
  };
  const enregistrerBrouillon = () => {
    if (!brouillon) return;
    const { croquisId, n, x, y, texte } = brouillon;
    setBrouillon(null);
    if (annule.current || !texte.trim()) {
      annule.current = false;
      return;
    }
    majCroquis(croquisId, (c) => ({ ...c, punaises: [...(c.punaises ?? []), { n, x, y, texte: texte.trim() }] }));
  };

  /* ── Déposer une image ── */
  const deposer = async (fichiers: File[], ou?: { x: number; y: number }) => {
    setErreur(null);
    const images = fichiers.filter((f) => f.type.startsWith('image/')).slice(0, 4);
    if (!images.length) {
      if (fichiers.length) setErreur('Seules les images se déposent sur le mur.');
      return;
    }
    const nouveaux: Croquis[] = [];
    for (const [i, f] of images.entries()) {
      try {
        const image = await resizeImageToDataUrl(f, 720, 0.8);
        const ratio = await new Promise<number>((ok) => {
          const img = new Image();
          img.onload = () => ok(img.width / Math.max(1, img.height));
          img.onerror = () => ok(1.4);
          img.src = image;
        });
        const genre: Genre = /capture|screenshot|écran|ecran/i.test(f.name) ? 'capture' : /croquis|sketch/i.test(f.name) ? 'croquis' : /inspi|ref/i.test(f.name) ? 'inspiration' : 'maquette';
        const l = TAILLES[genre].l;
        const c: Croquis = { id: uid('cq'), titre: f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').slice(0, 60), genre, image, ratio: Math.round(ratio * 100) / 100, legende: `déposée le ${jjmm(new Date().toISOString())}`, punaises: [] };
        if (ou) {
          c.x = Math.round(Math.min(1000 - l - 6, Math.max(6, ou.x - l / 2 + i * 24)));
          c.y = Math.round(Math.max(6, ou.y - l / ratio / 2 + i * 24));
        }
        nouveaux.push(c);
      } catch {
        setErreur(`« ${f.name} » n’a pas pu être lue.`);
      }
    }
    if (!nouveaux.length) return;
    // Déposée sans lieu précis (bouton), une image se range à la suite ; posée à la main, elle garde sa place.
    ecrire(p.id, (b) => ({ croquis: [...(b.croquis ?? []), ...nouveaux] }));
    setPiece(nouveaux[0].id);
  };

  useEffect(() => {
    if (choisie !== null && !brouillon && !punaises.some((x) => x.n === choisie)) setChoisie(null);
  }, [choisie, brouillon, punaises]);

  const titre = !croquis.length
    ? 'Le mur est vide.'
    : `${enLettresF(croquis.length, true)} pièce${croquis.length > 1 ? 's' : ''} au mur${attente.length ? `, et ${attente.length > 1 ? `${enLettresF(attente.length)} décisions qui attendent` : 'une décision qui attend'} la cliente` : ''}.`;
  const choisieC = croquis.find((c) => c.id === piece) ?? null;

  return (
    <>
      <TetePiece p={p} onglet="croquis" titre={titre} />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <Carte dominante pad="p-6" titre={`Le mur · ${p.plaque} ${p.orgNom}`} droite={croquis.length ? `${croquis.length} pièce${croquis.length > 1 ? 's' : ''} déposée${croquis.length > 1 ? 's' : ''}` : ''}>
          <div
            ref={mur}
            className="relative overflow-hidden border"
            style={{ height: hauteur * k, borderColor: depot ? '#8a8a87' : '#2a2826', background: '#100f0e', borderStyle: depot ? 'dashed' : 'solid' }}
            onDragOver={(e) => {
              if ([...e.dataTransfer.types].includes('Files')) {
                e.preventDefault();
                setDepot(true);
              }
            }}
            onDragLeave={() => setDepot(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDepot(false);
              const r = mur.current!.getBoundingClientRect();
              void deposer([...e.dataTransfer.files], { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k });
            }}
            aria-label={`Le mur de ${p.plaque}`}
          >
            {!croquis.length && (
              <div className="absolute inset-6">
                <Invitation
                  titre="Rien n’est encore au mur."
                  texte="Glissez ici une maquette, un croquis, une capture du site actuel ou une inspiration. Un clic sur une image y pose une punaise numérotée."
                  action={
                    <button type="button" className="bx-btn2" onClick={() => fichier.current?.click()}>
                      Choisir une image
                    </button>
                  }
                />
              </div>
            )}
            {croquis.map((c) => {
              const pos = place(c);
              const enMain = tire?.id === c.id;
              return (
                <figure
                  key={c.id}
                  className="absolute m-0 select-none"
                  style={{ left: pos.x * k, top: pos.y * k, width: pos.l * k, transform: `rotate(${rotation(c)}deg)`, zIndex: enMain ? 5 : piece === c.id ? 3 : 1, cursor: enMain ? 'grabbing' : 'crosshair', touchAction: 'none' }}
                  onPointerDown={(e) => appuyer(e, c)}
                  onPointerMove={bouger}
                  onPointerUp={(e) => lacher(e, c)}
                  onPointerCancel={() => {
                    geste.current = null;
                    setTire(null);
                  }}
                >
                  <div
                    data-image
                    className="relative"
                    style={{ height: pos.h * k, background: '#1c1b19', border: `1px solid ${piece === c.id ? '#6b6b68' : '#2e2c29'}`, boxShadow: enMain ? '0 30px 40px -18px rgba(0,0,0,1)' : '0 16px 24px -16px rgba(0,0,0,.9)' }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${c.titre} : Entrée pose une punaise au centre`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        poser(c.id, 50, 50);
                      }
                    }}
                  >
                    {c.image ? (
                      <img src={c.image} alt={c.titre} draggable={false} className="h-full w-full object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#9a9a97]" aria-hidden>
                        {c.genre}
                      </span>
                    )}
                    {(c.punaises ?? []).map((x) => {
                      const estAmbre = ambre?.n === x.n;
                      return (
                        <button
                          key={x.n}
                          type="button"
                          data-punaise
                          onClick={() => setChoisie(x.n)}
                          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                          style={{ left: `${x.x}%`, top: `${x.y}%`, outline: choisie === x.n ? '2px solid #f7f7f5' : undefined, outlineOffset: 3 }}
                          aria-label={`Punaise ${x.n} : ${x.texte}`}
                          data-signal-groupe={estAmbre ? 'mur-decision' : undefined}
                        >
                          <Punaise n={x.n} ambre={estAmbre} />
                        </button>
                      );
                    })}
                    {brouillon?.croquisId === c.id && (
                      <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${brouillon.x}%`, top: `${brouillon.y}%` }}>
                        <Punaise n={brouillon.n} creuse />
                      </span>
                    )}
                  </div>
                  <figcaption className="mt-2.5 line-clamp-2 font-mono text-[10px] font-semibold uppercase leading-[1.5] tracking-[0.14em] text-[#a3a3a0]" title={c.legende}>
                    {c.genre} · {c.titre.replace(new RegExp(`^${c.genre}\\s*·\\s*`, 'i'), '')}
                  </figcaption>
                </figure>
              );
            })}
          </div>
          <input
            ref={fichier}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void deposer([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
          {erreur && <p className="mt-3 text-[12.5px] text-[#e4e4e1]">{erreur}</p>}
        </Carte>

        <div className="flex flex-col gap-[18px] self-start">
          <Carte titre="Les annotations" droite={punaises.length || ''}>
            {punaises.length === 0 && !brouillon && <p className="text-[13px] leading-relaxed text-[#a3a3a0]">{croquis.length ? 'Aucune punaise encore : un clic sur une image en pose une.' : 'Les punaises se posent sur les images du mur.'}</p>}
            <ol>
              {punaises.map((x) => {
                const enAttente = x.decision && !x.trancheeLe;
                const on = choisie === x.n;
                return (
                  <li key={x.n} className="border-b border-[#1f1e1c] py-3">
                    <button type="button" onClick={() => setChoisie(on ? null : x.n)} className="flex w-full items-start gap-3 text-left" aria-expanded={on}>
                      <Punaise n={x.n} creuse={enAttente} taille={20} className="mt-px" />
                      <span className="text-[13.5px] leading-snug text-[#f7f7f5]">{x.texte}</span>
                    </button>
                    {x.decision && x.trancheeLe && <span className="ml-8 mt-1 block font-mono text-[10px] tracking-[0.1em] text-[#9a9a97]">TRANCHÉE LE {jjmm(x.trancheeLe)}</span>}
                    {on && (
                      <span className="ml-8 mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                        {enAttente ? (
                          <button type="button" className="bx-lien" onClick={() => majPunaise(x.n, (y) => ({ ...y, trancheeLe: new Date().toISOString() }))}>
                            Elle a tranché
                          </button>
                        ) : (
                          !x.decision && (
                            <button type="button" className="bx-lien" onClick={() => majPunaise(x.n, (y) => ({ ...y, decision: true, trancheeLe: null }))}>
                              À faire trancher par la cliente
                            </button>
                          )
                        )}
                        <button type="button" className="bx-lien" onClick={() => majPunaise(x.n, () => null)}>
                          Retirer
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
              {brouillon && (
                <li className="border-b border-[#1f1e1c] py-3">
                  <form
                    className="flex items-start gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      enregistrerBrouillon();
                    }}
                  >
                    <Punaise n={brouillon.n} creuse taille={20} className="mt-2" />
                    <input
                      autoFocus
                      value={brouillon.texte}
                      onChange={(e) => setBrouillon({ ...brouillon, texte: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          annule.current = true;
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onBlur={enregistrerBrouillon}
                      placeholder="Ce que dit cette punaise…"
                      aria-label={`La phrase de la punaise ${brouillon.n}`}
                      className="h-9 min-w-0 flex-1 border border-[#3a3834] bg-transparent px-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]"
                    />
                  </form>
                </li>
              )}
            </ol>
            {croquis.length > 0 && (
              <>
                <p className="mt-4 text-[12px] leading-relaxed text-[#9a9a97]">Déposer une image n’importe où sur le mur ; cliquer dessus pose une punaise numérotée.</p>
                <button type="button" className="bx-btn2 mt-3 w-full" onClick={() => fichier.current?.click()}>
                  Choisir une image
                </button>
              </>
            )}
          </Carte>

          {choisieC && (
            <Carte titre="La pièce choisie" droite={choisieC.legende ?? ''}>
              <label className="block">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#9a9a97]">Légende</span>
                <input
                  key={choisieC.id}
                  defaultValue={choisieC.titre}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== choisieC.titre && majCroquis(choisieC.id, (c) => ({ ...c, titre: e.target.value.trim() }))}
                  className="mt-1.5 h-9 w-full border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-[#f7f7f5] outline-none focus:border-[#8a8a87]"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Genre">
                {GENRES.map((g) => (
                  <button key={g} type="button" aria-pressed={choisieC.genre === g} onClick={() => majCroquis(choisieC.id, (c) => ({ ...c, genre: g }))} className="h-7 border px-2 font-mono text-[10.5px] uppercase tracking-[0.08em]" style={{ borderColor: choisieC.genre === g ? '#8a8a87' : '#2a2826', color: choisieC.genre === g ? '#f7f7f5' : '#a3a3a0' }}>
                    {g}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-4">
                <button type="button" className="bx-lien" onClick={() => majCroquis(choisieC.id, (c) => ({ ...c, rot: Math.round((((rotation(c) + 1.2 + 0.8) % 2.4) - 1.2) * 10) / 10 }))}>
                  Pencher autrement
                </button>
                <button
                  type="button"
                  className="bx-lien"
                  onClick={() => {
                    majCroquis(choisieC.id, () => null);
                    setPiece(null);
                  }}
                >
                  Retirer du mur
                </button>
              </div>
            </Carte>
          )}
        </div>
      </div>
    </>
  );
}
