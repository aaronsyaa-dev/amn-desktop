import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { uid } from '../../state/SyncContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import type { Piece } from '../donnees/studio';
import { Carte, Invitation } from '../ui/kit';
import { enLettresF, jourMois, prenomDe } from '../format';
import { TetePiece, useEcrirePiece, usePieceCourante } from './commun';

/**
 * STUDIO · LES NOTES D'UNE PIÈCE — ce qu'il faut savoir avant d'y toucher
 * (la cliente préfère le téléphone, le fournisseur des photos, l'accès à
 * l'hébergeur…). Rien n'y attend personne : pas d'ambre.
 */
export function StudioNotes() {
  const { p, absente } = usePieceCourante();
  if (!p) return <>{absente}</>;
  return <Notes p={p} />;
}

function Notes({ p }: { p: Piece }) {
  const ecrire = useEcrirePiece();
  const { user } = useAuth();
  const profils = useProfilesOptionnel();
  const [texte, setTexte] = useState('');
  const notes = [...(p.notes ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  const nom = (e: string) => profils?.profileFor(e).name?.split(' ')[0] || prenomDe(e);
  const titre = notes.length ? `${enLettresF(notes.length, true)} note${notes.length > 1 ? 's' : ''}, à lire avant d’y toucher.` : 'Aucune note sur cette pièce.';

  return (
    <>
      <TetePiece p={p} onglet="notes" titre={titre} />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <Carte dominante pad="p-6" className="self-start" titre={`Les notes · ${p.plaque}`} droite={notes.length || ''}>
          {notes.length === 0 ? (
            <Invitation titre="Rien de noté." texte="Ce qu’il faut savoir avant de toucher à la pièce : comment la cliente préfère être jointe, qui fournit les photos, où sont les accès." />
          ) : (
            notes.map((n) => (
              <article key={n.id} className="border-b border-[#1f1e1c] py-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                  {jourMois(n.at)} · {nom(n.par)}
                </span>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-text-body">{n.texte}</p>
                {n.par === user?.email && (
                  <button type="button" className="mt-2 text-[11.5px] font-semibold text-text-secondary underline decoration-trait-sourd underline-offset-4 hover:text-text-primary" onClick={() => ecrire(p.id, (b) => ({ notes: (b.notes ?? []).filter((x) => x.id !== n.id) }))}>
                    Retirer ma note
                  </button>
                )}
              </article>
            ))
          )}
        </Carte>
        <Carte titre="Ajouter une note" className="self-start">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!texte.trim() || !user?.email) return;
              ecrire(p.id, (b) => ({ notes: [...(b.notes ?? []), { id: uid('nt'), texte: texte.trim(), par: user.email!, at: new Date().toISOString() }] }));
              setTexte('');
            }}
          >
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} placeholder="Ce qu’il faut savoir…" aria-label="La note" className="w-full resize-none border border-[#2a2826] bg-transparent p-3 text-[13.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]" />
            <button type="submit" className="bx-btn mt-2" disabled={!texte.trim()}>
              Noter
            </button>
          </form>
        </Carte>
      </div>
    </>
  );
}
