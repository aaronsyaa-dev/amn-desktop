import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AMBRE } from '../jetons';
import { useStudio, type Piece } from '../donnees/studio';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { useEcrirePiece } from './commun';
import { deNom } from '../format';

/**
 * STUDIO · LE BUDGET DE PERFORMANCE (cahier 15, `51c` · 10).
 *
 * Le poids de chaque page contre un plafond fixé par pièce : la page qui le
 * dépasse ne part pas en ligne — la livraison de la pièce la compte comme un
 * point bloquant tant qu'elle dépasse.
 *
 * L'ambre : la page qui dépasse le plus son budget (en proportion).
 */

export const depassements = (p: { budget?: Piece['budget'] }) => (p.budget ? p.budget.pages.filter((x) => x.ko > p.budget!.plafondKo) : []);
const ko = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${n} Ko`);

export function StudioPerformance() {
  const s = useStudio();
  const ecrire = useEcrirePiece();
  const [edition, setEdition] = useState<{ pieceId: string; page: string; ko: string } | null>(null);
  const avecBudget = s.pieces.filter((p) => p.budget && p.budget.pages.length);
  const toutes = avecBudget.flatMap((p) => p.budget!.pages.map((x) => ({ p, page: x.page, ko: x.ko, part: x.ko / p.budget!.plafondKo })));
  const depasse = toutes.filter((x) => x.part > 1).sort((a, b) => b.part - a.part);
  const ambre = depasse[0] ?? null;
  const titre = ambre ? `La page ${ambre.page} ${deNom(ambre.p.orgNom)} pèse ${ko(ambre.ko)} pour ${ko(ambre.p.budget!.plafondKo)} de budget.` : avecBudget.length ? 'Chaque page tient dans son budget.' : 'Aucun budget n’est posé.';

  return (
    <>
      <EnTete surtitre="Studio · Budget de performance" titre={titre} lede={avecBudget.length ? 'Une page au-dessus de son plafond bloque la mise en ligne de sa pièce.' : undefined} />
      {avecBudget.length === 0 ? (
        <Invitation titre="Pas de budget." texte="Chaque pièce peut fixer un plafond de poids par page. La page qui le dépasse ne part pas en ligne : la livraison la compte comme un point bloquant." />
      ) : (
        <div className="flex flex-col gap-[18px]">
          {avecBudget.map((p) => (
            <Carte key={p.id} dominante={ambre?.p.id === p.id} pad="p-6" titre={`${p.plaque} · ${p.orgNom}`} droite={`plafond : ${ko(p.budget!.plafondKo)} par page`}>
              {p.budget!.pages.map((x) => {
                const part = x.ko / p.budget!.plafondKo;
                const estAmbre = ambre?.p.id === p.id && ambre.page === x.page;
                const max = Math.max(1.6, ...p.budget!.pages.map((y) => y.ko / p.budget!.plafondKo));
                return (
                  <div key={x.page} className="grid grid-cols-[140px_minmax(0,1fr)_150px] items-center gap-4 py-2" data-signal-groupe={estAmbre ? 'budget-ambre' : undefined}>
                    <span className="truncate text-[13px] font-semibold text-text-primary">{x.page}</span>
                    <span className="relative h-[10px] bg-[#1c1b19]" aria-hidden>
                      <span className="block h-full" style={{ width: `${Math.min(100, (part / max) * 100)}%`, background: estAmbre ? AMBRE : part > 1 ? '#bdbdb9' : 'var(--color-trait-sourd)' }} />
                      <span className="absolute -bottom-1.5 -top-1.5 w-[2px] bg-text-primary" style={{ left: `${(1 / max) * 100}%` }} />
                    </span>
                    <span className="flex items-center justify-end gap-3">
                      {edition?.pieceId === p.id && edition.page === x.page ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const v = Number(edition.ko.replace(',', '.'));
                            if (v > 0) ecrire(p.id, (b) => ({ budget: { plafondKo: b.budget!.plafondKo, pages: b.budget!.pages.map((y) => (y.page === x.page ? { ...y, ko: Math.round(v) } : y)) } }));
                            setEdition(null);
                          }}
                        >
                          <input autoFocus value={edition.ko} onChange={(e) => setEdition({ ...edition, ko: e.target.value })} onBlur={() => setEdition(null)} inputMode="numeric" aria-label={`Poids de ${x.page}, en Ko`} className="h-7 w-[80px] border border-[#3a3834] bg-transparent px-1.5 text-right font-mono text-[12px] text-text-primary outline-none" />
                        </form>
                      ) : (
                        <button type="button" onClick={() => setEdition({ pieceId: p.id, page: x.page, ko: String(x.ko) })} className="font-mono text-[11.5px] tabular-nums underline decoration-[#4a4845] underline-offset-4" style={{ color: estAmbre ? AMBRE : part > 1 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }} title="Mettre à jour le poids relevé">
                          {ko(x.ko)}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
              {depassements(p).length > 0 && (
                <p className="mt-3 text-[12.5px] text-text-secondary">
                  {depassements(p).length} page{depassements(p).length > 1 ? 's bloquent' : ' bloque'} la mise en ligne.{' '}
                  <Link to={`/studio/pieces/${p.id}/livraison`} className="bx-lien">
                    La livraison
                  </Link>
                </p>
              )}
            </Carte>
          ))}
        </div>
      )}
    </>
  );
}
