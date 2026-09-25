import React, { useState } from 'react';
import { uid } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useStrategie } from '../donnees/strategie';
import type { Temoignage } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { jourMois } from '../format';
import { champ, useEcrire } from './commun';

/**
 * STRATÉGIE · LA BANQUE DE TÉMOIGNAGES (cahier 15, `51c` · 14).
 *
 * Les témoignages recueillis, leur accord de diffusion, et les campagnes qui
 * les emploient. Un témoignage sans accord écrit ne sort pas.
 *
 * L'ambre : le témoignage qu'une campagne emploie alors que l'accord manque
 * (en attente ou refusé) — le risque qu'un humain doit lever avant la
 * diffusion. À défaut, le plus ancien accord en attente.
 */

type T = Temoignage & { id: string };
const ACCORD: Record<Temoignage['accord'], string> = { oui: 'accord écrit', non: 'refusé', en_attente: 'accord en attente' };

export function StrategieTemoignages() {
  const m = useStrategie();
  const ecrire = useEcrire<Temoignage>('temoignages');
  const [nouveau, setNouveau] = useState<{ auteur: string; texte: string } | null>(null);
  const temoignages = m.temoignages as T[];
  const titres = new Map(m.campagnes.map((c) => [c.id, c.titre]));
  const risques = temoignages.filter((t) => t.accord !== 'oui' && (t.campagnes ?? []).length > 0);
  const attente = temoignages.filter((t) => t.accord === 'en_attente').sort((a, b) => a.at.localeCompare(b.at));
  const ambre = risques[0] ?? attente[0] ?? null;
  const titre = risques.length
    ? `« ${titres.get(risques[0].campagnes![0]) ?? 'Une campagne'} » emploie un témoignage sans accord.`
    : attente.length
      ? `${attente.length} accord${attente.length > 1 ? 's' : ''} de diffusion en attente.`
      : temoignages.length
        ? 'Chaque témoignage a son accord.'
        : 'La banque est vide.';

  return (
    <>
      <EnTete
        surtitre="Stratégie · Campagnes · Témoignages"
        titre={titre}
        actions={
          <button type="button" className="bx-btn2" onClick={() => setNouveau({ auteur: '', texte: '' })}>
            Recueillir un témoignage
          </button>
        }
      />
      {nouveau && (
        <Carte pad="p-5" className="mb-[18px]" titre="Un témoignage" droite="l’accord se demande à part, par écrit">
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nouveau.auteur.trim() || !nouveau.texte.trim()) return;
              ecrire(`temo-${uid()}`, () => ({ auteur: nouveau.auteur.trim(), texte: nouveau.texte.trim().replace(/^«\s*|\s*»$/g, ''), accord: 'en_attente', campagnes: [], at: new Date().toISOString() }));
              setNouveau(null);
            }}
          >
            <input value={nouveau.auteur} onChange={(e) => setNouveau({ ...nouveau, auteur: e.target.value })} placeholder="Qui (« Boulangerie Keller »)" aria-label="Qui" className={`${champ} h-9`} />
            <textarea value={nouveau.texte} onChange={(e) => setNouveau({ ...nouveau, texte: e.target.value })} rows={2} placeholder="Ce qui a été dit, mot pour mot" aria-label="Le témoignage" className={`${champ} resize-none py-2`} />
            <button type="submit" className="bx-btn self-start">
              Garder
            </button>
          </form>
        </Carte>
      )}
      {temoignages.length === 0 ? (
        <Invitation titre="Aucun témoignage." texte="Ce qu’une cliente dit de son travail avec vous, mot pour mot, avec son accord de diffusion — et les campagnes qui l’emploient." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {temoignages.map((t) => {
            const estAmbre = ambre?.id === t.id;
            return (
              <article key={t.id} className="bx-papier relative px-5 pb-4 pt-5" style={estAmbre ? { boxShadow: `0 0 0 2px ${AMBRE}, 0 18px 30px -18px rgba(0,0,0,.9)` } : undefined} data-signal-groupe={estAmbre ? 'temoignage-ambre' : undefined}>
                <p className="text-[15px] font-semibold leading-snug text-[#111]">« {t.texte} »</p>
                <p className="mt-2 text-[12.5px] text-[#3a3a38]">
                  {t.auteur} · recueilli le {jourMois(t.at)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#cfcdc7] pt-2.5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: t.accord === 'oui' ? '#3a3a38' : '#111' }}>
                    {ACCORD[t.accord]}
                  </span>
                  {(t.campagnes ?? []).map((id) => (
                    <span key={id} className="border border-[#8a8a87] px-1.5 py-0.5 text-[11px] text-[#111]">
                      {titres.get(id) ?? 'campagne'}
                    </span>
                  ))}
                  <span className="ml-auto flex gap-3 text-[11.5px] font-semibold text-[#111]">
                    {t.accord !== 'oui' && (
                      <button type="button" className="underline decoration-[#8a8a87] underline-offset-2" onClick={() => ecrire(t.id, () => ({ accord: 'oui' }))}>
                        Accord reçu
                      </button>
                    )}
                    {t.accord === 'en_attente' && (
                      <button type="button" className="underline decoration-[#8a8a87] underline-offset-2" onClick={() => ecrire(t.id, () => ({ accord: 'non', campagnes: [] }))}>
                        Refusé
                      </button>
                    )}
                    {t.accord === 'oui' && (
                      <select value="" onChange={(e) => e.target.value && ecrire(t.id, (b) => ({ campagnes: [...new Set([...(b?.campagnes ?? []), e.target.value])] }))} aria-label="L’employer dans une campagne" className="h-6 border border-[#8a8a87] bg-transparent px-1 text-[11px] text-[#111]">
                        <option value="">+ une campagne</option>
                        {m.campagnes.filter((c) => !(t.campagnes ?? []).includes(c.id)).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.titre}
                          </option>
                        ))}
                      </select>
                    )}
                  </span>
                </div>
                {estAmbre && t.accord !== 'oui' && (t.campagnes ?? []).length > 0 && <p className="mt-2 text-[12px] font-semibold text-[#111]">Employé sans accord : à retirer de la campagne, ou à faire signer avant sa sortie.</p>}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
