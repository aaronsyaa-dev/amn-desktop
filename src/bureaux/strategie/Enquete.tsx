import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { uid } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useStrategie } from '../donnees/strategie';
import type { PieceMur } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { enLettresF } from '../format';
import { aujourdHui, champ, jjmm, useEcrire } from './commun';

/**
 * STRATÉGIE · L'ENQUÊTE — la zone d'enquête du mur.
 *
 * Le paquet nomme la zone (le dock « Enquête », le rangement par zones de
 * `49e`) sans la dessiner. Elle est bâtie sur la même idée que le mur : une
 * QUESTION qu'on se pose sur le marché (« les commerces de quartier
 * veulent-ils commander en ligne ? »), les INDICES punaisés dessous — pour,
 * contre, à côté, chacun avec sa source — et, quand on en sait assez, un
 * verdict qui la ferme. Les pièces vivent dans `strategieMur`, comme le reste
 * du mur.
 *
 * L'ambre : la question dont la date pour trancher est arrivée sans verdict
 * (la plus ancienne). Une question qui a encore le temps n'attend personne.
 */

type Piece = PieceMur & { id: string };
const SENS: { cle: NonNullable<PieceMur['sens']>; nom: string }[] = [
  { cle: 'pour', nom: 'pour' },
  { cle: 'contre', nom: 'contre' },
  { cle: 'neutre', nom: 'à côté' },
];

export function StrategieEnquete() {
  const m = useStrategie();
  const { user } = useAuth();
  const ecrire = useEcrire<PieceMur>('strategieMur');
  const [question, setQuestion] = useState<{ texte: string; echeance: string } | null>(null);
  const [indice, setIndice] = useState<{ questionId: string; texte: string; source: string; sens: NonNullable<PieceMur['sens']> } | null>(null);
  const [verdict, setVerdict] = useState<{ id: string; texte: string } | null>(null);
  const auj = aujourdHui();
  const pieces = m.mur as Piece[];
  const questions = pieces.filter((p) => p.type === 'question').sort((a, b) => (a.echeance ?? '9').localeCompare(b.echeance ?? '9'));
  const ouvertes = questions.filter((q) => !q.verdict);
  const closes = questions.filter((q) => q.verdict);
  const indices = (q: Piece) => pieces.filter((p) => p.type === 'indice' && p.questionId === q.id);
  const dues = ouvertes.filter((q) => q.echeance && q.echeance.slice(0, 10) <= auj);
  const ambre = dues[0] ?? null;

  const titre = questions.length === 0
    ? 'Aucune question en cours.'
    : ambre
      ? `Une question est à trancher${ambre.echeance!.slice(0, 10) === auj ? ' aujourd’hui' : ''}.`
      : `${enLettresF(ouvertes.length, true)} question${ouvertes.length > 1 ? 's' : ''} ouverte${ouvertes.length > 1 ? 's' : ''}, aucune à trancher aujourd’hui.`;
  const base = (type: PieceMur['type']) => ({ type, x: 0, y: 0, rot: 0, par: user?.email ?? '', at: new Date().toISOString() });

  return (
    <>
      <EnTete
        surtitre="Stratégie · Enquête"
        titre={titre}
        lede={questions.length ? undefined : 'Une question qu’on se pose sur le marché, les indices qui y répondent, et un verdict quand on en sait assez.'}
        actions={
          <button type="button" className="bx-btn2" onClick={() => setQuestion({ texte: '', echeance: '' })}>
            Poser une question
          </button>
        }
      />
      {question && (
        <Carte pad="p-5" className="mb-[18px]" titre="Une question" droite="une date pour trancher, sinon elle ne se tranche jamais">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!question.texte.trim()) return;
              ecrire(`q-${uid()}`, () => ({ ...base('question'), texte: question.texte.trim(), echeance: question.echeance || null, verdict: null }));
              setQuestion(null);
            }}
          >
            <input autoFocus value={question.texte} onChange={(e) => setQuestion({ ...question, texte: e.target.value })} placeholder="« Les commerces de quartier veulent-ils commander en ligne ? »" aria-label="La question" className={`${champ} h-9 min-w-0 flex-1`} />
            <input type="date" value={question.echeance} onChange={(e) => setQuestion({ ...question, echeance: e.target.value })} aria-label="À trancher avant" className={`${champ} h-9 [color-scheme:dark]`} />
            <button type="submit" className="bx-btn" disabled={!question.texte.trim()}>
              Poser
            </button>
            <button type="button" className="bx-btn2" onClick={() => setQuestion(null)}>
              Annuler
            </button>
          </form>
        </Carte>
      )}
      {questions.length === 0 ? (
        <Invitation titre="L’enquête n’a pas commencé." texte="Posez une question sur le marché, punaisez les indices qui y répondent — un entretien, un chiffre, une réponse à un devis — et tranchez quand vous en savez assez." />
      ) : (
        <div className="flex flex-col gap-[18px]">
          {ouvertes.map((q) => {
            const estAmbre = ambre?.id === q.id;
            const ind = indices(q);
            const compte = (s: PieceMur['sens']) => ind.filter((i) => (i.sens ?? 'neutre') === s).length;
            return (
              <section key={q.id} className="bx-dom p-6" style={estAmbre ? { borderColor: AMBRE } : undefined} aria-label={q.texte} data-signal-groupe={estAmbre ? 'enquete-ambre' : undefined}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="block font-mono text-[9.5px] uppercase tracking-[0.16em]" style={{ color: estAmbre ? AMBRE : 'var(--color-text-secondary)' }} data-signal-groupe={estAmbre ? 'enquete-ambre' : undefined}>
                      {q.echeance ? (estAmbre ? `À trancher ${q.echeance.slice(0, 10) === auj ? 'aujourd’hui' : `depuis le ${jjmm(q.echeance)}`}` : `À trancher avant le ${jjmm(q.echeance)}`) : 'Question ouverte'} · {ind.length} indice{ind.length > 1 ? 's' : ''}
                    </span>
                    <h2 className="mt-2 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-text-primary">{q.texte}</h2>
                  </div>
                  <span className="flex gap-3 font-mono text-[10.5px] tabular-nums text-text-secondary">
                    <span>{compte('pour')} pour</span>
                    <span>{compte('contre')} contre</span>
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {ind.map((i) => (
                    <article key={i.id} className="bx-papier relative px-3.5 pb-3 pt-4" style={{ transform: `rotate(${((i.id.charCodeAt(i.id.length - 1) % 5) - 2) * 0.4}deg)` }}>
                      <span aria-hidden className="bx-punaise absolute left-1/2 top-[-5px] -translate-x-1/2" />
                      <span className="block font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#55554f]">{SENS.find((s) => s.cle === (i.sens ?? 'neutre'))?.nom}</span>
                      <span className="mt-1.5 block text-[13px] leading-snug text-[#111]">{i.texte}</span>
                      {i.source && <span className="mt-2 block border-t border-[#cfcdc7] pt-1.5 text-[11px] text-[#3a3a38]">{i.source}</span>}
                    </article>
                  ))}
                  {ind.length === 0 && <p className="text-[13px] text-text-secondary md:col-span-3">Aucun indice encore.</p>}
                </div>
                {indice?.questionId === q.id ? (
                  <form
                    className="mt-4 flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!indice.texte.trim()) return;
                      ecrire(`i-${uid()}`, () => ({ ...base('indice'), questionId: q.id, texte: indice.texte.trim(), source: indice.source.trim() || null, sens: indice.sens }));
                      setIndice(null);
                    }}
                  >
                    <input autoFocus value={indice.texte} onChange={(e) => setIndice({ ...indice, texte: e.target.value })} placeholder="Ce qu’on a appris…" aria-label="L’indice" className={`${champ} h-9 min-w-0 flex-1`} />
                    <input value={indice.source} onChange={(e) => setIndice({ ...indice, source: e.target.value })} placeholder="D’où ça vient" aria-label="La source" className={`${champ} h-9 w-[200px]`} />
                    <select value={indice.sens} onChange={(e) => setIndice({ ...indice, sens: e.target.value as NonNullable<PieceMur['sens']> })} aria-label="Ce qu’il dit" className={`${champ} h-9 bg-[#141416]`}>
                      {SENS.map((s) => (
                        <option key={s.cle} value={s.cle}>
                          {s.nom}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="bx-btn" disabled={!indice.texte.trim()}>
                      Punaiser
                    </button>
                    <button type="button" className="bx-lien" onClick={() => setIndice(null)}>
                      Annuler
                    </button>
                  </form>
                ) : verdict?.id === q.id ? (
                  <form
                    className="mt-4 flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!verdict.texte.trim()) return;
                      ecrire(q.id, () => ({ verdict: verdict.texte.trim() }));
                      setVerdict(null);
                    }}
                  >
                    <input autoFocus value={verdict.texte} onChange={(e) => setVerdict({ ...verdict, texte: e.target.value })} placeholder="Ce qu’on en conclut…" aria-label="Le verdict" className={`${champ} h-9 min-w-0 flex-1`} />
                    <button type="submit" className="bx-btn" disabled={!verdict.texte.trim()}>
                      Trancher
                    </button>
                    <button type="button" className="bx-lien" onClick={() => setVerdict(null)}>
                      Annuler
                    </button>
                  </form>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <button type="button" className="bx-btn2" onClick={() => setIndice({ questionId: q.id, texte: '', source: '', sens: 'pour' })}>
                      Punaiser un indice
                    </button>
                    <button type="button" className={estAmbre ? 'bx-btn' : 'bx-btn2'} onClick={() => setVerdict({ id: q.id, texte: '' })}>
                      Trancher
                    </button>
                  </div>
                )}
              </section>
            );
          })}
          {closes.length > 0 && (
            <Carte titre="Tranchées" droite={closes.length}>
              {closes.map((q) => (
                <div key={q.id} className="border-b border-[#222226] py-3">
                  <span className="block text-[13px] text-text-secondary">{q.texte}</span>
                  <span className="mt-1 block text-[13.5px] font-semibold text-text-primary">→ {q.verdict}</span>
                </div>
              ))}
            </Carte>
          )}
        </div>
      )}
    </>
  );
}
