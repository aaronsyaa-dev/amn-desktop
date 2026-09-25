import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { uid } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import type { Piece } from '../donnees/studio';
import type { PieceStudio } from '../donnees/types';
import { Carte, Invitation } from '../ui/kit';
import { enLettres } from '../format';
import { jjmm, TetePiece, useEcrirePiece, usePieceCourante, versionSuivante } from './commun';
import { PageEpinglee } from './Retours';

/**
 * STUDIO · LA LIVRAISON (cahier 14, `48d`).
 *
 * À gauche, le rail des mises en ligne, version et date. Au centre, la liste
 * de livraison de la version suivante : tant qu'un point BLOQUANT n'est pas
 * coché, « Mettre en ligne » reste inactif (sans ombre). À droite, les
 * retours de la cliente, épinglés sur la page qu'ils concernent.
 *
 * L'ambre : le point bloquant (le premier, s'il y en a plusieurs).
 *
 * « Mettre en ligne » note la mise en ligne dans le rail et ouvre la liste
 * de la version suivante ; le déploiement lui-même suit son chemin habituel.
 */

type Point = NonNullable<PieceStudio['livraison']>['points'][number];

/** La liste de chaque version, tant qu'on ne l'a pas adaptée. */
export const LISTE_STANDARD: Omit<Point, 'id'>[] = [
  { texte: 'Images compressées', bloquant: true, coche: false },
  { texte: 'Liens vérifiés', bloquant: false, coche: false },
  { texte: 'Formulaire testé en envoi réel', bloquant: false, coche: false },
  { texte: 'Balises titres et descriptions', bloquant: false, coche: false },
  { texte: 'Validation de la cliente', bloquant: false, coche: false },
];

export const libelleVersion = (v: string) => (/^\d/.test(v) ? `v${v}` : v);

export function StudioLivraison() {
  const { p, absente } = usePieceCourante();
  if (!p) return <>{absente}</>;
  return <Livraison p={p} />;
}

function Livraison({ p }: { p: Piece }) {
  const ecrire = useEcrirePiece();
  const { user } = useAuth();
  const [ajout, setAjout] = useState<{ texte: string; bloquant: boolean } | null>(null);
  const [quoi, setQuoi] = useState('');
  const l = p.livraison ?? null;
  const points = l?.points ?? [];
  const bloquants = points.filter((x) => x.bloquant && !x.coche);
  const ambre = bloquants[0] ?? null;
  const coches = points.filter((x) => x.coche).length;
  const rail = [...(l?.misesEnLigne ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  const version = l?.version ?? '1.0';

  const majPoints = (f: (x: Point[]) => Point[]) => ecrire(p.id, (b) => ({ livraison: { version: b.livraison?.version ?? '1.0', points: f(b.livraison?.points ?? []), misesEnLigne: b.livraison?.misesEnLigne ?? [] } }));
  const cocher = (id: string) => majPoints((xs) => xs.map((x) => (x.id === id ? { ...x, coche: !x.coche } : x)));
  const ouvrir = () => ecrire(p.id, () => ({ livraison: { version, points: LISTE_STANDARD.map((x, i) => ({ ...x, id: `l${i}` })), misesEnLigne: l?.misesEnLigne ?? [] } }));
  const mettreEnLigne = () => {
    if (!l || bloquants.length) return;
    const at = new Date().toISOString();
    ecrire(p.id, (b) => ({
      enLigneLe: at,
      chantier: false,
      livraison: {
        version: versionSuivante(b.livraison?.version ?? version),
        points: LISTE_STANDARD.map((x, i) => ({ ...x, id: uid(`l${i}`) })),
        misesEnLigne: [...(b.livraison?.misesEnLigne ?? []), { version: b.livraison?.version ?? version, at, par: user?.email ?? '', ...(quoi.trim() ? { quoi: quoi.trim() } : {}) }],
      },
    }));
    setQuoi('');
  };

  const titre = !l
    ? 'Aucune version en préparation.'
    : bloquants.length === 1
      ? `La version ${version} attend un seul point.`
      : bloquants.length > 1
        ? `La version ${version} attend ${enLettres(bloquants.length)} points.`
        : coches === points.length
          ? `La version ${version} est prête à partir.`
          : `Rien ne bloque la version ${version}.`;

  return (
    <>
      <TetePiece p={p} onglet="livraison" titre={titre} />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <Carte pad="p-6" className="self-start" titre="Les mises en ligne">
          {rail.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-[#a3a3a0]">Rien n’est encore parti en ligne.</p>
          ) : (
            <ol className="relative">
              <span aria-hidden className="absolute bottom-3 left-[4.5px] top-3 w-px bg-[#2a2826]" />
              {rail.slice(0, 8).map((m, i) => (
                <li key={`${m.version}-${m.at}`} className="relative flex gap-4 pb-4">
                  <span className="relative mt-[5px] h-[10px] w-[10px] flex-none rounded-full" style={{ background: i === 0 ? '#f7f7f5' : '#4a4845' }} aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-mono text-[12.5px] font-semibold text-[#f7f7f5]">
                      {libelleVersion(m.version)} · {jjmm(m.at)}
                    </span>
                    {m.quoi && <span className="mt-0.5 block text-[12.5px] text-[#a3a3a0]">{m.quoi}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Carte>

        <Carte dominante pad="p-6" className="self-start" titre={`La liste de livraison · ${libelleVersion(version)}`} droite={points.length ? `${coches} sur ${points.length}` : ''}>
          {!l || points.length === 0 ? (
            <Invitation
              titre="La liste de livraison n’est pas ouverte."
              texte="Cinq points pour chaque version : images compressées, liens vérifiés, formulaire testé, balises, validation de la cliente. Un point bloquant non coché empêche la mise en ligne."
              action={
                <button type="button" className="bx-btn2" onClick={ouvrir}>
                  Ouvrir la liste de {libelleVersion(version)}
                </button>
              }
            />
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {points.map((x) => {
                  const estAmbre = ambre?.id === x.id;
                  const bloque = x.bloquant && !x.coche;
                  return (
                    <li key={x.id}>
                      <label className="flex cursor-pointer items-center gap-3.5 border px-3.5 py-3" style={{ borderColor: estAmbre ? AMBRE : '#2a2826', background: estAmbre ? 'rgba(208,154,74,.07)' : x.coche ? '#141312' : 'transparent' }} data-signal-groupe={estAmbre ? 'livraison-bloquant' : undefined}>
                        <input type="checkbox" checked={x.coche} onChange={() => cocher(x.id)} className="peer sr-only" />
                        <span aria-hidden className="flex h-[18px] w-[18px] flex-none items-center justify-center border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#f7f7f5]" style={{ borderColor: estAmbre ? AMBRE : x.coche ? '#8a8a87' : '#6b6b68', background: x.coche ? '#8a8a87' : 'transparent' }} />
                        <span className="min-w-0 flex-1 text-[13.5px]" style={{ fontWeight: x.coche ? 400 : 600, color: x.coche ? '#9a9a97' : '#f7f7f5', textDecoration: x.coche ? 'line-through' : undefined }}>
                          {x.texte}
                        </span>
                        {bloque && (
                          <span className="font-mono text-[9.5px] font-bold tracking-[0.12em]" style={{ color: estAmbre ? AMBRE : '#a3a3a0' }}>
                            {estAmbre ? 'BLOQUE LA MISE EN LIGNE' : 'BLOQUE AUSSI'}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
              {ajout ? (
                <form
                  className="mt-3 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!ajout.texte.trim()) return;
                    majPoints((xs) => [...xs, { id: uid('l'), texte: ajout.texte.trim(), bloquant: ajout.bloquant, coche: false }]);
                    setAjout(null);
                  }}
                >
                  <input autoFocus value={ajout.texte} onChange={(e) => setAjout({ ...ajout, texte: e.target.value })} placeholder="Le point à vérifier…" aria-label="Le point à vérifier" className="h-9 min-w-0 flex-1 border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]" />
                  <label className="flex items-center gap-2 text-[12.5px] text-[#a3a3a0]">
                    <input type="checkbox" checked={ajout.bloquant} onChange={(e) => setAjout({ ...ajout, bloquant: e.target.checked })} className="accent-[#8a8a87]" />
                    bloquant
                  </label>
                  <button type="submit" className="bx-btn2" disabled={!ajout.texte.trim()}>
                    Ajouter
                  </button>
                </form>
              ) : (
                <button type="button" className="bx-lien mt-3" onClick={() => setAjout({ texte: '', bloquant: false })}>
                  Ajouter un point
                </button>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-[#2a2826] pt-4">
                <input value={quoi} onChange={(e) => setQuoi(e.target.value)} placeholder="Ce qui part (« page Tarifs »)" aria-label="Ce qui part en ligne" className="h-[34px] min-w-0 flex-1 border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]" />
                <button type="button" className="bx-btn" disabled={bloquants.length > 0} onClick={mettreEnLigne} title={bloquants.length ? `Encore bloqué : ${bloquants.map((x) => x.texte).join(', ')}` : undefined}>
                  Mettre en ligne {libelleVersion(version)}
                </button>
              </div>
            </>
          )}
        </Carte>

        <Carte pad="p-6" className="self-start" titre="Les retours de la cliente" droite="épinglés sur la page">
          <PageEpinglee p={p} compacte />
        </Carte>
      </div>
    </>
  );
}
