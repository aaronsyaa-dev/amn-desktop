import React, { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCollection, useSync, uid } from '../../state/SyncContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { AMBRE } from '../jetons';
import { useCyber } from '../donnees/cyber';
import type { Campagne, NoteCarnet, RapportPosture } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { hhmm, jourLong, jourMois, prenomDe } from '../format';
import { numeroIncident } from './FicheIncident';

/**
 * CYBER · LE CARNET DE BORD — des notes qui tiennent à quelque chose (cahier
 * 13, `47i`).
 *
 * Chaque note est attachée à ce dont elle parle : un incident, une cliente,
 * un actif, une campagne. Ses étiquettes sont ses liens ; son pied dit où
 * elle est citée. Une note sans lien n'existe pas — le formulaire le refuse.
 * L'ambre : la question ouverte d'une note, la seule chose qui empêche de
 * clore ce dont elle parle.
 */

type Note = NoteCarnet & { id: string };
type Lien = NoteCarnet['liens'][number];

export function CyberCarnet() {
  const c = useCyber();
  const { user } = useAuth();
  const { upsert } = useSync();
  const profils = useProfilesOptionnel();
  const notes = (useCollection<NoteCarnet>('carnet') as Note[]).slice().sort((a, b) => b.at.localeCompare(a.at));
  const campagnes = useCollection<Campagne>('campagnes');
  const rapports = useCollection<RapportPosture>('rapportsPosture');
  const [choisie, setChoisie] = useState<string | null>(null);
  const [redaction, setRedaction] = useState<{ texte: string; liens: Lien[]; question: boolean } | null>(null);
  const questions = notes.filter((n) => n.question && !n.resolue);
  const note = notes.find((n) => n.id === choisie) ?? questions[0] ?? notes[0] ?? null;
  const nom = (e: string) => profils?.profileFor(e).name?.split(' ')[0] || prenomDe(e);

  const liensPossibles = useMemo<Lien[]>(
    () => [
      ...c.incidents.map((g) => ({ type: 'incident' as const, id: g.incidents[0].id, label: numeroIncident(g.incidents[0].id) })),
      ...c.orgs.map((o) => ({ type: 'cliente' as const, id: o.id, label: o.nom })),
      ...c.actifs.map((a) => ({ type: 'actif' as const, id: a.id, label: a.nom })),
      ...campagnes.map((x) => ({ type: 'campagne' as const, id: x.id, label: x.titre })),
    ],
    [c.incidents, c.orgs, c.actifs, campagnes],
  );

  /** Où la note est citée : ce qui partage ses liens et en garde la trace. */
  const citations = (n: Note) => {
    const r: { ou: string; quoi: string }[] = [];
    for (const l of n.liens) {
      if (l.type === 'incident') r.push({ ou: l.label, quoi: 'la fiche incident, notes d’enquête' });
      if (l.type === 'cliente') {
        const rap = rapports.filter((x) => x.orgId === l.id).sort((a, b) => b.mois.localeCompare(a.mois))[0];
        if (rap) r.push({ ou: `Rapport de ${new Date(`${rap.mois}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long' })}`, quoi: `${l.label}, page 3` });
      }
      if (l.type === 'campagne') r.push({ ou: l.label, quoi: 'Stratégie, la fiche de la campagne' });
    }
    return r;
  };

  const enregistrer = () => {
    if (!redaction || !redaction.texte.trim() || !redaction.liens.length || !user?.email) return;
    const id = `note-${uid()}`;
    void upsert('carnet', id, { texte: redaction.texte.trim(), liens: redaction.liens, question: redaction.question, resolue: false, par: user.email, at: new Date().toISOString() });
    setRedaction(null);
    setChoisie(id);
  };
  const resoudre = (n: Note) => {
    const { id, ...reste } = n;
    void upsert('carnet', id, { ...reste, resolue: true });
  };
  const titreDe = (t: string) => t.split(/(?<=[.?!:])\s/)[0].replace(/[.:]$/, '');
  const corps = (t: string) => t.slice(titreDe(t).length).replace(/^[.:]\s*/, '');

  return (
    <>
      <EnTete
        surtitre={`Cyber · Carnet de bord${notes.length ? ` · ${notes.length} note${notes.length > 1 ? 's' : ''}` : ''}`}
        titre="Ce qu’on a appris, attaché à ce dont ça parle"
        actions={<button type="button" className="bx-btn2" onClick={() => setRedaction({ texte: '', liens: [], question: false })}>Nouvelle note</button>}
      />
      {redaction && (
        <Carte pad="p-5" className="mb-[18px]" titre="Nouvelle note" droite="une note sans lien n’existe pas">
          <textarea value={redaction.texte} onChange={(e) => setRedaction({ ...redaction, texte: e.target.value })} rows={3} placeholder="Ce qu’on a appris…" aria-label="La note" className="w-full resize-none border border-[#2b3030] bg-transparent p-3 text-[13.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value="" onChange={(e) => {
              const l = liensPossibles.find((x) => `${x.type}:${x.id}` === e.target.value);
              if (l && !redaction.liens.some((x) => x.id === l.id)) setRedaction({ ...redaction, liens: [...redaction.liens, l] });
            }} aria-label="Attacher à" className="h-9 border border-[#2b3030] bg-[#111414] px-2.5 text-[13px] text-text-primary">
              <option value="">Attacher à…</option>
              {(['incident', 'cliente', 'actif', 'campagne'] as const).map((t) => (
                <optgroup key={t} label={t === 'incident' ? 'Incidents' : t === 'cliente' ? 'Clientes' : t === 'actif' ? 'Actifs' : 'Campagnes'}>
                  {liensPossibles.filter((x) => x.type === t).slice(0, 60).map((x) => (
                    <option key={`${x.type}:${x.id}`} value={`${x.type}:${x.id}`}>
                      {x.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {redaction.liens.map((l) => (
              <button key={l.id} type="button" onClick={() => setRedaction({ ...redaction, liens: redaction.liens.filter((x) => x.id !== l.id) })} className="border border-[#3a3f3f] px-2 py-1 font-mono text-[11px] text-text-body" title="Retirer ce lien">
                {l.label} ×
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-[12.5px] text-text-secondary">
              <input type="checkbox" checked={redaction.question} onChange={(e) => setRedaction({ ...redaction, question: e.target.checked })} className="accent-[#8a8a87]" />
              c’est une question ouverte
            </label>
            <button type="button" className="bx-btn" disabled={!redaction.texte.trim() || !redaction.liens.length} onClick={enregistrer} title={!redaction.liens.length ? 'Attachez la note à quelque chose d’abord.' : undefined}>
              Noter
            </button>
          </div>
        </Carte>
      )}
      {!notes.length ? (
        <Invitation titre="Le carnet est vide." texte="Chaque note s’attache à un incident, une cliente, un actif ou une campagne : c’est la mémoire des enquêtes, pas un bloc-notes." />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[340px_minmax(0,1fr)]">
          <Carte pad="p-2" className="self-start">
            {notes.slice(0, 30).map((n) => (
              <button key={n.id} type="button" onClick={() => setChoisie(n.id)} className="block w-full border-b border-[#171a1a] px-3 py-3 text-left hover:bg-white/[0.02]" style={note?.id === n.id ? { background: '#161919', boxShadow: 'inset 2px 0 0 var(--color-text-primary)' } : undefined} aria-pressed={note?.id === n.id}>
                <span className="block font-mono text-[10px] text-text-muted">
                  {n.at.slice(8, 10)}/{n.at.slice(5, 7)}
                  {note?.id === n.id ? ` · ${hhmm(n.at)}` : ''}
                </span>
                <span className="mt-1 block text-[13px] font-semibold leading-snug text-text-primary">{titreDe(n.texte)}</span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {n.liens.map((l) => (
                    <span key={l.id} className="border border-[#2b3030] px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                      {l.label}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </Carte>
          {note && (
            <Carte dominante pad="p-7" className="self-start">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">
                {jourLong(note.at)} {jourMois(note.at)} · {hhmm(note.at)} · {nom(note.par)}
              </span>
              <h2 className="mt-3 font-mono text-[21px] font-semibold leading-snug tracking-[-0.01em] text-text-primary">{titreDe(note.texte)}</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {note.liens.map((l) => (
                  <span key={l.id} className="border border-[#3a3f3f] px-2 py-1 font-mono text-[11px] text-text-body">
                    {l.label}
                  </span>
                ))}
              </div>
              {corps(note.texte) && <p className="mt-4 text-[14px] leading-relaxed text-text-body">{corps(note.texte)}</p>}
              {note.question && !note.resolue && (
                <div className="mt-5 p-4" style={{ border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.06)' }} data-signal-groupe="carnet-question">
                  <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.18em]" style={{ color: AMBRE }}>
                    Question ouverte
                  </span>
                  <span className="mt-2 block text-[14px] font-semibold leading-snug text-text-primary">{note.texte.split(/(?<=[.!])\s/).find((x) => x.includes('?')) ?? titreDe(note.texte)}</span>
                  <button type="button" onClick={() => resoudre(note)} className="mt-3 text-[12px] font-semibold text-text-primary underline decoration-trait-sourd underline-offset-4">
                    Elle a sa réponse
                  </button>
                </div>
              )}
              {citations(note).length > 0 && (
                <div className="mt-6 border-t border-[#1d2121] pt-4">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-text-muted">Citée par</span>
                  {citations(note).map((x, i) => (
                    <p key={i} className="mt-2 text-[12.5px] text-text-secondary">
                      <b className="font-mono text-text-primary">{x.ou}</b> &nbsp;{x.quoi}
                    </p>
                  ))}
                </div>
              )}
            </Carte>
          )}
        </div>
      )}
    </>
  );
}
