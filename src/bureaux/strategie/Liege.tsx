import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { uid, useSync } from '../../state/SyncContext';
import { useStrategie } from '../donnees/strategie';
import type { PieceMur } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { enLettresF, prenomDe } from '../format';
import { champ, jjmm, useEcrire } from './commun';

/**
 * STRATÉGIE · LE LIÈGE — ce qu'on garde sous la main.
 *
 * Le paquet nomme la zone sans la dessiner. C'est le panneau de liège du
 * bureau : une idée de campagne pas encore mûre, une phrase entendue chez une
 * cliente, une coupure, un chiffre à vérifier. Des notes de papier
 * punaisées, un peu de travers ; rien n'y attend personne, donc pas d'ambre.
 * Une note qui devient une campagne passe dans la colonne Idée.
 */

type Note = PieceMur & { id: string };

export function StrategieLiege() {
  const m = useStrategie();
  const { user } = useAuth();
  const { remove } = useSync();
  const ecrire = useEcrire<PieceMur>('strategieMur');
  const ecrireCampagne = useEcrire<{ titre: string; etape: string; creePar: string; at: string; resultat?: string }>('campagnes');
  const [texte, setTexte] = useState('');
  const notes = (m.mur as Note[]).filter((p) => p.type === 'note').sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  const titre = notes.length ? `${enLettresF(notes.length, true)} note${notes.length > 1 ? 's' : ''} au liège.` : 'Le liège est nu.';

  return (
    <>
      <EnTete surtitre="Stratégie · Liège" titre={titre} lede="Une idée pas encore mûre, une phrase entendue, un chiffre à vérifier. Une note qui devient une campagne passe dans la colonne Idée." />
      <Carte pad="p-5" className="mb-[18px]" titre="Punaiser une note">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!texte.trim()) return;
            ecrire(`note-${uid()}`, () => ({ type: 'note', texte: texte.trim(), x: 0, y: 0, rot: Math.round((Math.random() * 3 - 1.5) * 10) / 10, par: user?.email ?? '', at: new Date().toISOString() }));
            setTexte('');
          }}
        >
          <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="« Les fleuristes demandent tous la même chose : le retrait en boutique »" aria-label="La note" className={`${champ} h-9 min-w-0 flex-1`} />
          <button type="submit" className="bx-btn" disabled={!texte.trim()}>
            Punaiser
          </button>
        </form>
      </Carte>
      {notes.length === 0 ? (
        <Invitation titre="Rien au liège." texte="Ce qui n’est ni une campagne, ni un prospect, ni un chiffre : ce qu’on veut garder sous les yeux." />
      ) : (
        <section className="bx-dom bx-trame p-7" aria-label="Le liège" style={{ background: '#141214' }}>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {notes.map((n) => (
              <article key={n.id} className="bx-papier relative px-4 pb-3.5 pt-5" style={{ transform: `rotate(${n.rot}deg)` }}>
                <span aria-hidden className="bx-punaise absolute left-1/2 top-[-5px] -translate-x-1/2" />
                <p className="text-[13.5px] leading-snug text-[#111]">{n.texte}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-[#cfcdc7] pt-2 text-[11px] text-[#3a3a38]">
                  <span className="whitespace-nowrap">
                    {n.at ? jjmm(n.at) : ''} · {prenomDe(n.par)}
                  </span>
                  <span className="flex gap-3 whitespace-nowrap">
                    <button
                      type="button"
                      className="font-semibold underline decoration-[#8a8a87] underline-offset-2"
                      onClick={() => {
                        ecrireCampagne(`camp-${uid()}`, () => ({ titre: (n.texte ?? '').slice(0, 80), etape: 'idee', resultat: 'née d’une note du liège', creePar: user?.email ?? '', at: new Date().toISOString() }));
                        void remove('strategieMur', n.id);
                      }}
                    >
                      En faire une idée
                    </button>
                    <button type="button" className="underline decoration-[#8a8a87] underline-offset-2" onClick={() => void remove('strategieMur', n.id)}>
                      Dépunaiser
                    </button>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
