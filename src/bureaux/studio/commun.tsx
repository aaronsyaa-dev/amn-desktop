import React, { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { stripMeta, useCollection, useSync } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useStudio, type Piece } from '../donnees/studio';
import type { PieceStudio } from '../donnees/types';
import { Chargement, EnTete, LienFort } from '../ui/kit';

/**
 * STUDIO · LA PIÈCE PROJET — ce que ses six onglets partagent (cahier 14,
 * `48a`–`48d`) : la tête (« STUDIO · P-06 · BOULANGERIE KELLER · PROMPTS »,
 * puis la phrase de l'onglet), la rangée d'onglets soulignée, l'écriture
 * dans la pièce, et la punaise numérotée de 22 px.
 */

export const ONGLETS_PIECE = [
  { cle: 'croquis', nom: 'Croquis' },
  { cle: 'prompts', nom: 'Prompts' },
  { cle: 'notes', nom: 'Notes' },
  { cle: 'analytique', nom: 'Analytique' },
  { cle: 'livraison', nom: 'Livraison' },
  { cle: 'retours', nom: 'Retours' },
] as const;
export type OngletPiece = (typeof ONGLETS_PIECE)[number]['cle'];

/** La pièce de l'adresse, ou l'état qui la remplace (chargement, pièce inconnue). */
export function usePieceCourante(): { p: Piece | null; absente: React.ReactNode | null } {
  const { id } = useParams();
  const s = useStudio();
  const { ready } = useSync();
  const p = s.pieces.find((x) => x.id === id) ?? null;
  if (p) return { p, absente: null };
  if (!ready) {
    return {
      p: null,
      absente: (
        <>
          <EnTete surtitre="Studio · pièce" titre="La pièce s’ouvre." />
          <Chargement texte="Lecture de la pièce" />
        </>
      ),
    };
  }
  return {
    p: null,
    absente: (
      <>
        <EnTete surtitre="Studio · pièce" titre="Cette pièce n’existe plus." lede="Elle a peut-être été fermée, ou l’adresse est ancienne. Toutes les pièces sont sur la façade." />
        <LienFort to="/studio">Revenir à la façade</LienFort>
      </>
    ),
  };
}

/** Écrire dans la pièce : on repart de l'enregistrement brut, jamais des champs dérivés (état, plaque). */
export function useEcrirePiece() {
  const brutes = useCollection<PieceStudio>('studioPieces');
  const { upsert } = useSync();
  return useCallback(
    (id: string, modifier: (brute: PieceStudio) => Partial<PieceStudio>) => {
      const brute = brutes.find((x) => x.id === id);
      if (!brute) return;
      const donnees = stripMeta(brute) as unknown as PieceStudio;
      void upsert('studioPieces', id, { ...donnees, ...modifier(donnees) } as unknown as Record<string, unknown>);
    },
    [brutes, upsert],
  );
}

export function TetePiece({ p, onglet, titre, actions }: { p: Piece; onglet: OngletPiece; titre: React.ReactNode; actions?: React.ReactNode }) {
  const nom = ONGLETS_PIECE.find((o) => o.cle === onglet)?.nom ?? '';
  return (
    <>
      <EnTete surtitre={`Studio · ${p.plaque} · ${p.orgNom} · ${onglet === 'croquis' ? p.quoi : nom}`} titre={titre} actions={actions} marge={22} />
      <nav aria-label={`Les onglets de ${p.plaque}`} className="mb-[22px] flex gap-1 overflow-x-auto border-b border-[#2a2826]">
        {ONGLETS_PIECE.map((o) => {
          const on = o.cle === onglet;
          return (
            <Link
              key={o.cle}
              to={`/studio/pieces/${p.id}/${o.cle}`}
              aria-current={on ? 'page' : undefined}
              className="bx-nav relative flex-none px-3.5 pb-3 pt-1 text-[13.5px]"
              style={{ fontWeight: on ? 600 : 500, color: on ? '#f7f7f5' : '#a3a3a0' }}
            >
              {o.nom}
              {on && <span aria-hidden className="absolute bottom-[-1px] left-1.5 right-1.5 h-[2px] bg-[#f7f7f5]" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/**
 * La punaise numérotée (22 px). Blanche ; ambre quand c'est la décision qui
 * attend la cliente ; creuse dans la liste pour la marquer sans la colorer.
 */
export function Punaise({ n, ambre = false, creuse = false, taille = 22, className = '', style }: { n: number; ambre?: boolean; creuse?: boolean; taille?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full font-mono font-bold tabular-nums ${className}`}
      style={{
        width: taille,
        height: taille,
        fontSize: taille <= 18 ? 9.5 : 10.5,
        background: ambre ? AMBRE : creuse ? 'transparent' : '#f7f7f5',
        color: ambre || !creuse ? '#0b0a09' : '#f7f7f5',
        border: creuse ? '1.5px solid #f7f7f5' : undefined,
        boxShadow: ambre ? '0 0 0 4px rgba(208,154,74,.18), 0 0 22px rgba(208,154,74,.55)' : creuse ? undefined : '0 2px 6px rgba(0,0,0,.55)',
        ...style,
      }}
      aria-hidden
    >
      {n}
    </span>
  );
}

/** « 23/09 » */
export const jjmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** La version qui suit : « 2.4 » → « 2.5 », « 3.9 » → « 3.10 », sinon on ajoute « .1 ». */
export function versionSuivante(v: string): string {
  const m = /^(.*?)(\d+)$/.exec(v.trim());
  return m ? `${m[1]}${Number(m[2]) + 1}` : `${v}.1`;
}

export type Segment = { genre: 'meme' | 'retire' | 'ajoute'; texte: string };

/** Deux textes mot à mot (plus longue sous-suite commune) : ce qui reste, ce qui part, ce qui arrive. */
export function segmentsMots(avant: string, apres: string): Segment[] {
  const a = avant.split(/\s+/).filter(Boolean);
  const b = apres.split(/\s+/).filter(Boolean);
  const l: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) l[i][j] = a[i] === b[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1]);
  const r: Segment[] = [];
  const pousser = (genre: Segment['genre'], mot: string) => {
    const dernier = r[r.length - 1];
    if (dernier && dernier.genre === genre) dernier.texte += ` ${mot}`;
    else r.push({ genre, texte: mot });
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      pousser('meme', a[i]);
      i += 1;
      j += 1;
    } else if (j < b.length && (i >= a.length || l[i][j + 1] >= l[i + 1][j])) {
      pousser('ajoute', b[j]);
      j += 1;
    } else {
      pousser('retire', a[i]);
      i += 1;
    }
  }
  return r;
}

/** Ce qui a changé, change par change : « 12 mots → 8 mots », « chaleureux → direct ». */
export function ecartMots(avant: string, apres: string): { retire: string; ajoute: string }[] {
  const r: { retire: string; ajoute: string }[] = [];
  let cour: { retire: string; ajoute: string } | null = null;
  for (const s of segmentsMots(avant, apres)) {
    if (s.genre === 'meme') {
      if (cour) r.push(cour);
      cour = null;
    } else {
      cour = cour ?? { retire: '', ajoute: '' };
      if (s.genre === 'retire') cour.retire = s.texte;
      else cour.ajoute = s.texte;
    }
  }
  if (cour) r.push(cour);
  return r;
}
