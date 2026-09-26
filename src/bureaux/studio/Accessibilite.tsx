import React, { useState } from 'react';
import { uid } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useStudio } from '../donnees/studio';
import type { PieceStudio } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { useEcrirePiece } from './commun';
import { enLettres } from '../format';

/**
 * STUDIO · L'ACCESSIBILITÉ (cahier 15, `51c` · 12).
 *
 * Contrastes, textes alternatifs, navigation au clavier, titres, formulaires :
 * les manques de chaque pièce, page par page. Une grille pièces × critères,
 * puis la liste des manques ouverts.
 *
 * L'ambre : le manque le plus grave encore ouvert — un contraste d'abord
 * (il empêche de lire), puis le clavier, les alternatives, les formulaires,
 * les titres.
 */

type Critere = NonNullable<PieceStudio['accessibilite']>[number]['critere'];
const CRITERES: { cle: Critere; nom: string }[] = [
  { cle: 'contraste', nom: 'Contrastes' },
  { cle: 'clavier', nom: 'Clavier' },
  { cle: 'alternative', nom: 'Textes alternatifs' },
  { cle: 'formulaires', nom: 'Formulaires' },
  { cle: 'titres', nom: 'Titres' },
];
const RANG: Record<Critere, number> = { contraste: 0, clavier: 1, alternative: 2, formulaires: 3, titres: 4 };

export function StudioAccessibilite() {
  const s = useStudio();
  const ecrire = useEcrirePiece();
  const [nouveau, setNouveau] = useState<{ pieceId: string; critere: Critere; page: string; texte: string } | null>(null);
  const ouverts = s.pieces.flatMap((p) => (p.accessibilite ?? []).filter((a) => !a.corrige).map((a) => ({ p, a }))).sort((x, y) => RANG[x.a.critere] - RANG[y.a.critere]);
  const ambre = ouverts[0] ?? null;
  const pieces = s.pieces.filter((p) => (p.accessibilite ?? []).length);
  const titre = ambre ? `${enLettres(ouverts.length, true)} manque${ouverts.length > 1 ? 's' : ''} ouvert${ouverts.length > 1 ? 's' : ''}, d’abord ${ambre.a.critere === 'contraste' ? 'un contraste' : ambre.a.critere === 'clavier' ? 'le clavier' : 'des textes alternatifs'} chez ${ambre.p.orgNom}.` : pieces.length ? 'Aucun manque ouvert.' : 'Aucune pièce n’a encore été relue.';

  return (
    <>
      <EnTete
        surtitre="Studio · Accessibilité"
        titre={titre}
        actions={
          <button type="button" className="bx-btn2" onClick={() => setNouveau({ pieceId: s.pieces[0]?.id ?? '', critere: 'contraste', page: '', texte: '' })}>
            Noter un manque
          </button>
        }
      />
      {nouveau && (
        <Carte pad="p-5" className="mb-[18px]" titre="Un manque">
          <form
            className="grid grid-cols-1 gap-2 md:grid-cols-[180px_160px_150px_minmax(0,1fr)_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nouveau.pieceId || !nouveau.page.trim() || !nouveau.texte.trim()) return;
              ecrire(nouveau.pieceId, (b) => ({ accessibilite: [...(b.accessibilite ?? []), { id: uid('a'), critere: nouveau.critere, page: nouveau.page.trim(), texte: nouveau.texte.trim() }] }));
              setNouveau(null);
            }}
          >
            <select value={nouveau.pieceId} onChange={(e) => setNouveau({ ...nouveau, pieceId: e.target.value })} aria-label="La pièce" className="h-9 border border-[#2a2826] bg-[#141312] px-2.5 text-[13px] text-text-primary">
              {s.pieces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plaque} · {p.orgNom}
                </option>
              ))}
            </select>
            <select value={nouveau.critere} onChange={(e) => setNouveau({ ...nouveau, critere: e.target.value as Critere })} aria-label="Le critère" className="h-9 border border-[#2a2826] bg-[#141312] px-2.5 text-[13px] text-text-primary">
              {CRITERES.map((c) => (
                <option key={c.cle} value={c.cle}>
                  {c.nom}
                </option>
              ))}
            </select>
            <input value={nouveau.page} onChange={(e) => setNouveau({ ...nouveau, page: e.target.value })} placeholder="La page" aria-label="La page" className="h-9 border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-muted" />
            <input value={nouveau.texte} onChange={(e) => setNouveau({ ...nouveau, texte: e.target.value })} placeholder="Ce qui manque, précisément" aria-label="Le manque" className="h-9 border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-muted" />
            <button type="submit" className="bx-btn">
              Noter
            </button>
          </form>
        </Carte>
      )}
      {pieces.length === 0 ? (
        <Invitation titre="Rien de relu." texte="Chaque pièce se relit sur cinq critères : contrastes, clavier, textes alternatifs, formulaires, titres. Les manques se notent page par page." />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_380px]">
          <Carte dominante pad="p-6" className="self-start" titre="Les pièces relues" droite="plein = un manque ouvert · cerclé = corrigé">
            <table className="w-full border-separate" style={{ borderSpacing: '0 6px' }}>
              <thead>
                <tr>
                  <th className="w-[200px]" />
                  {CRITERES.map((c) => (
                    <th key={c.cle} scope="col" className="text-center font-mono text-[9.5px] font-medium uppercase tracking-[0.1em] text-text-muted">
                      {c.nom}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pieces.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className="pr-3 text-left text-[13px] font-semibold text-text-primary">
                      {p.plaque} · {p.orgNom}
                    </th>
                    {CRITERES.map((c) => {
                      const ici = (p.accessibilite ?? []).filter((a) => a.critere === c.cle);
                      const ouvert = ici.filter((a) => !a.corrige);
                      const estAmbre = ambre?.p.id === p.id && ambre.a.critere === c.cle;
                      return (
                        <td key={c.cle} className="text-center">
                          <span
                            className="mx-auto flex h-[26px] w-[44px] items-center justify-center font-mono text-[10.5px]"
                            style={estAmbre ? { background: AMBRE, color: '#0b0a09' } : ouvert.length ? { background: '#8a8a87', color: '#0b0a09' } : ici.length ? { border: '1px solid var(--color-trait-sourd)', color: 'var(--color-text-secondary)' } : { border: '1px dashed #2a2826' }}
                            data-signal-groupe={estAmbre ? 'a11y-ambre' : undefined}
                            title={ici.map((a) => `${a.page} : ${a.texte}${a.corrige ? ' (corrigé)' : ''}`).join('\n') || undefined}
                          >
                            {ouvert.length || (ici.length ? '✓' : '')}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Carte>
          <Carte className="self-start" titre="Les manques ouverts" droite={ouverts.length}>
            {ouverts.length === 0 && <p className="text-[13px] text-text-secondary">Rien d’ouvert.</p>}
            {ouverts.map(({ p, a }) => {
              const estAmbre = ambre?.a.id === a.id;
              return (
                <div key={a.id} className="border-b border-[#1f1e1c] py-2.5" style={estAmbre ? { boxShadow: `inset 2px 0 0 ${AMBRE}`, paddingLeft: 10 } : undefined} data-signal-groupe={estAmbre ? 'a11y-ambre' : undefined}>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: estAmbre ? AMBRE : 'var(--color-text-muted)' }}>
                    {p.plaque} · {a.page} · {CRITERES.find((c) => c.cle === a.critere)?.nom}
                  </span>
                  <span className="mt-1 block text-[13px] leading-snug text-text-body">{a.texte}</span>
                  <button type="button" className="bx-lien mt-1.5" onClick={() => ecrire(p.id, (b) => ({ accessibilite: (b.accessibilite ?? []).map((x) => (x.id === a.id ? { ...x, corrige: true } : x)) }))}>
                    Corrigé
                  </button>
                </div>
              );
            })}
          </Carte>
        </div>
      )}
    </>
  );
}
