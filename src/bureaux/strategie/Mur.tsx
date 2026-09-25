import React from 'react';
import { Link } from 'react-router-dom';
import { AMBRE } from '../jetons';
import { LIBELLE_ETAPE, initiales, type CampagneId, type ModeleStrategie, type Prospect } from '../donnees/strategie';
import type { PieceMur, Temoignage } from '../donnees/types';

/**
 * LE MUR DE STRATÉGIE — cahier 11 `45d`, planche `49e`.
 *
 * Les campagnes en fiches de papier, les prospects et les clients en tirages,
 * les chiffres en notes ; chaque pièce punaisée, légèrement de travers. Des
 * fils gris relient ce qui se tient — ils partent et arrivent AUX PUNAISES,
 * et n'existent que si un lien réel existe dans les données (un prospect
 * ciblé par une campagne, un témoignage qu'elle emploie, un chiffre qu'elle a
 * produit). Un fil n'apparaît qu'avec ses deux bouts.
 *
 * Les pièces sont posées en pourcentage de la largeur et en pixels de
 * hauteur ; les fils sont un SVG `0 0 1000 440` dont les abscisses valent dix
 * fois les pourcentages. Une position enregistrée sur le mur (`strategieMur`)
 * l'emporte sur la disposition calculée.
 */

export const HAUTEUR_MUR = 440;

type Genre = 'campagne' | 'prospect' | 'client' | 'chiffre';
export interface Epingle {
  cle: string;
  genre: Genre;
  x: number;
  y: number;
  l: number;
  rot: number;
  titre: string;
  surtitre?: string;
  ligne?: string;
  valeur?: string;
  lien: string;
  ambre?: boolean;
}

const rotDe = (cle: string) => {
  let h = 0;
  for (const c of cle) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 41) - 20) / 10; // −2° à +2°
};

export function disposer(m: ModeleStrategie): { epingles: Epingle[]; fils: [string, string][] } {
  const positions = new Map(m.mur.filter((p) => p.refId).map((p) => [`${p.type}:${p.refId}`, p]));
  // Au mur : la campagne bloquée d'abord, puis celle qui est publiée, puis la plus récente des autres.
  const rang = (c: CampagneId) => (c.bloquee ? 0 : c.etape === 'publiee' ? 1 : 2);
  const campagnes = m.campagnes
    .filter((c) => c.etape !== 'close')
    .sort((a, b) => rang(a) - rang(b) || (b.at ?? '').localeCompare(a.at ?? ''))
    .slice(0, 3);
  const idsCampagnes = new Set(campagnes.map((c) => c.id));
  const parId = new Map(m.prospects.map((p) => [p.id, p]));
  const prospects: Prospect[] = [];
  const ajoute = (p: Prospect | undefined) => {
    if (p && !prospects.includes(p) && prospects.length < 3) prospects.push(p);
  };
  if (m.ambre) ajoute(m.ambre);
  for (const c of campagnes) for (const id of c.prospects ?? []) ajoute(parId.get(id));
  const clients = m.temoignages.filter((t) => t.accord === 'oui' && (t.campagnes ?? []).some((id) => idsCampagnes.has(id))).slice(0, 2);
  const chiffres = m.mur.filter((p) => p.type === 'chiffre').slice(0, 2);

  const place = (cle: string, defaut: { x: number; y: number }) => {
    const p = positions.get(cle);
    return p ? { x: p.x, y: p.y, rot: p.rot } : { ...defaut, rot: rotDe(cle) };
  };
  const epingles: Epingle[] = [];
  const hautX = [13, 41, 69];
  campagnes.forEach((c, i) => {
    const cle = `campagne:${c.id}`;
    epingles.push({ cle, genre: 'campagne', ...place(cle, { x: hautX[i], y: 22 + (i % 2) * 16 }), l: 19, titre: c.titre, surtitre: `Campagne · ${LIBELLE_ETAPE[c.etape].toLowerCase()}`, ligne: c.resultat ?? '', lien: `/strategie/campagnes#${c.id}` });
  });
  const bas: { cle: string; genre: Genre; titre: string; ligne: string; valeur?: string; lien: string; ambre?: boolean; l: number }[] = [
    ...prospects.map((p) => ({
      cle: `prospect:${p.id}`,
      genre: 'prospect' as Genre,
      titre: p.company || p.name,
      ligne: lignePropect(p, m.aujourdHui),
      lien: `/strategie/pipeline/${p.id}`,
      ambre: m.ambre?.id === p.id,
      l: 12.5,
    })),
    ...clients.map((t: Temoignage & { id: string }) => ({ cle: `client:${t.id}`, genre: 'client' as Genre, titre: t.auteur, ligne: 'Client · témoignage accepté', lien: '/strategie/temoignages', l: 12.5 })),
    ...chiffres.map((c: PieceMur & { id: string }) => ({ cle: `chiffre:${c.id}`, genre: 'chiffre' as Genre, titre: c.libelle ?? '', valeur: c.valeur ?? '', ligne: '', lien: '/strategie/objectifs', l: 12.5 })),
  ].slice(0, 6);
  const pas = bas.length > 1 ? 82 / (bas.length - 1) : 0;
  bas.forEach((b, i) => {
    epingles.push({ ...b, ...place(b.cle, { x: 6 + i * pas, y: 200 + ((i + 1) % 2) * 12 }) });
  });

  const presentes = new Set(epingles.map((e) => e.cle));
  const fils: [string, string][] = [];
  const relie = (a: string, b: string) => {
    if (presentes.has(a) && presentes.has(b)) fils.push([a, b]);
  };
  for (const c of campagnes) {
    for (const id of c.prospects ?? []) relie(`campagne:${c.id}`, `prospect:${id}`);
  }
  for (const t of clients) for (const id of t.campagnes ?? []) relie(`campagne:${id}`, `client:${t.id}`);
  for (const ch of chiffres) if (ch.campagneId) relie(`campagne:${ch.campagneId}`, `chiffre:${ch.id}`);
  return { epingles, fils };
}

function lignePropect(p: Prospect, aujourdHui: string): string {
  const ouvertures = (p.echanges ?? []).filter((e) => e.type === 'ouverture').length;
  if (ouvertures >= 2 && p.stage === 'proposition') return `Prospect · a ouvert le devis ${ouvertures} fois`;
  if (p.prochaine && p.prochaine.at.slice(0, 10) > aujourdHui) return `Prospect · ${p.prochaine.quoi} le ${Number(p.prochaine.at.slice(8, 10))}`;
  return p.stage === 'gagne' ? 'Client' : 'Prospect';
}

/** La punaise au sommet d'une pièce : abscisse × 10, ordonnée en px. */
const punaise = (e: Epingle) => ({ x: (e.x + e.l / 2) * 10, y: e.y + 6 });

export function Mur({ m, pieces }: { m: ModeleStrategie; pieces?: ReturnType<typeof disposer> }) {
  const { epingles, fils } = pieces ?? disposer(m);
  const parCle = new Map(epingles.map((e) => [e.cle, e]));
  return (
    <div
      className="relative overflow-hidden"
      style={{ height: HAUTEUR_MUR, background: '#101012', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.012) 0 1px, transparent 1px 7px)', boxShadow: 'inset 0 0 60px rgba(0,0,0,.6)' }}
    >
      <div data-mv className="bx-respire absolute inset-0">
        <svg viewBox={`0 0 1000 ${HAUTEUR_MUR}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {fils.map(([a, b]) => {
            const p = punaise(parCle.get(a)!);
            const q = punaise(parCle.get(b)!);
            const creux = Math.max(p.y, q.y) + 26;
            return <path key={`${a}-${b}`} d={`M${p.x} ${p.y} Q${(p.x + q.x) / 2} ${creux} ${q.x} ${q.y}`} fill="none" stroke="#5a5a5f" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        {epingles.map((e) => (
          <Piece key={e.cle} e={e} />
        ))}
      </div>
    </div>
  );
}

function Piece({ e }: { e: Epingle }) {
  const style: React.CSSProperties = { left: `${e.x}%`, top: e.y, width: `${e.l}%`, transform: `rotate(${e.rot}deg)` };
  const epingle = (
    <span aria-hidden className="absolute left-1/2 top-[-4px] z-10 -translate-x-1/2">
      {e.ambre ? <span className="block h-3 w-3 rounded-full" style={{ background: AMBRE, boxShadow: '0 0 12px rgba(208,154,74,.8)' }} /> : <span className="bx-punaise block" />}
    </span>
  );
  if (e.genre === 'campagne') {
    return (
      <Link to={e.lien} className="bx-nav bx-papier absolute block px-4 pb-4 pt-5" style={style}>
        {epingle}
        <span className="block font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#55554f]">{e.surtitre}</span>
        <span className="mt-2 block text-[15px] font-semibold leading-snug text-[#111]">{e.titre}</span>
        {e.ligne && <span className="mt-3 block border-t border-[#cfcdc7] pt-2.5 text-[12px] leading-snug text-[#3a3a38]">{e.ligne}</span>}
      </Link>
    );
  }
  if (e.genre === 'chiffre') {
    return (
      <Link to={e.lien} className="bx-nav absolute block bg-[#26262a] px-4 pb-4 pt-5 shadow-[0_18px_30px_-18px_rgba(0,0,0,1)]" style={style}>
        {epingle}
        <span className="block font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] text-[#f7f7f5]">{e.valeur}</span>
        <span className="mt-2.5 block text-[12px] leading-snug text-[#c9c9c6]">{e.titre}</span>
      </Link>
    );
  }
  return (
    <Link
      to={e.lien}
      className="bx-nav absolute block bg-[#1c1c1f] p-2.5 shadow-[0_18px_30px_-18px_rgba(0,0,0,1)]"
      style={{ ...style, border: `1px solid ${e.ambre ? AMBRE : '#2a2a2e'}` }}
      data-signal-groupe={e.ambre ? 'mur-ambre' : undefined}
    >
      {epingle}
      <span className="flex h-[72px] items-center justify-center bg-[#232326] font-mono text-[24px] font-semibold tracking-[0.04em] text-[#9a9a97]">{initiales(e.titre)}</span>
      <span className="mt-2.5 block truncate text-[13px] font-semibold text-[#f7f7f5]">{e.titre}</span>
      <span className="mt-1 block text-[11.5px] leading-snug text-[#a3a3a0]">{e.ligne}</span>
      {e.ambre && (
        <span className="-mx-2.5 -mb-2.5 mt-2.5 block px-2.5 py-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ background: AMBRE, color: '#080808' }}>
          À appeler aujourd’hui
        </span>
      )}
    </Link>
  );
}

export type { CampagneId };
