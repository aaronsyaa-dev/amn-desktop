import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useCollection, useSync, uid } from '../../state/SyncContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { AMBRE } from '../jetons';
import { CONTROLES, useCyber } from '../donnees/cyber';
import type { Playbook, PlaybookRun } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { hhmm, prenomDe } from '../format';

/**
 * CYBER · LES PLAYBOOKS — la procédure en cours (cahier 13, `47g`).
 *
 * Un playbook est une suite d'étapes cochables, avec ses branches (« si… »)
 * décalées et tracées en pointillé. Lancé sur un cas réel, il garde qui l'a
 * lancé, quand, et ce qui est fait ; les étapes faites s'éteignent. Un
 * playbook se COPIE pour une cliente et s'adapte : l'original ne change pas.
 * L'ambre : l'étape en cours.
 */

type Pb = Playbook & { id: string };
type Run = PlaybookRun & { id: string };

export function CyberPlaybooks() {
  const c = useCyber();
  const { user } = useAuth();
  const { upsert } = useSync();
  const profils = useProfilesOptionnel();
  const [params, setParams] = useSearchParams();
  const playbooks = useCollection<Playbook>('playbooks') as Pb[];
  const runs = useCollection<PlaybookRun>('playbookRuns') as Run[];
  const [choisi, setChoisi] = useState<string | null>(null);
  const [lancer, setLancer] = useState<{ playbookId: string; orgId: string } | null>(null);
  const enCours = runs.filter((r) => !r.closLe).sort((a, b) => b.lanceLe.localeCompare(a.lanceLe));
  const run = (choisi ? runs.find((r) => r.id === choisi) : null) ?? enCours[0] ?? null;
  const pb = run ? playbooks.find((p) => p.id === run.playbookId) ?? null : null;
  const noms = new Map(c.orgs.map((o) => [o.id, o.nom]));
  const nom = (e: string | null | undefined) => (e ? profils?.profileFor(e).name?.split(' ')[0] || prenomDe(e) : '—');

  // « Préparer une campagne » depuis la matrice : un playbook pour généraliser un contrôle.
  const campagne = params.get('campagne');
  useEffect(() => {
    if (!campagne || !user?.email) return;
    const k = CONTROLES.find((x) => x.cle === campagne);
    if (!k) return;
    const id = `campagne-${k.cle}`;
    if (!playbooks.some((p) => p.id === id)) {
      const cibles = c.orgs.filter((o) => o.controles[k.cle] && o.controles[k.cle]!.etat !== 'conforme').map((o) => o.nom);
      void upsert('playbooks', id, {
        nom: `Généraliser : ${k.nom.toLowerCase()}`,
        description: `Campagne pour ${cibles.length} organisation${cibles.length > 1 ? 's' : ''} : ${cibles.slice(0, 6).join(', ')}${cibles.length > 6 ? '…' : ''}.`,
        etapes: [
          { id: 'e0', texte: 'Lister les organisations concernées et qui les suit', si: null },
          { id: 'e1', texte: 'Préparer le message, avec la marche à suivre pas à pas', si: null },
          { id: 'e2', texte: 'Prévenir chaque cliente, par son canal habituel', si: null },
          { id: 'e3', texte: 'Accompagner : proposer une session d’assistance', si: 'Si une cliente bloque' },
          { id: 'e4', texte: 'Vérifier dans la matrice, contrôle par contrôle', si: null },
          { id: 'e5', texte: 'Noter au carnet ce qui a résisté, et pourquoi', si: null },
        ],
        creePar: user.email,
        at: new Date().toISOString(),
      });
    }
    setLancer({ playbookId: id, orgId: '' });
    params.delete('campagne');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campagne, user?.email]);

  const cocher = (r: Run, etapeId: string) => {
    const faites = { ...r.faites };
    if (faites[etapeId]) delete faites[etapeId];
    else faites[etapeId] = new Date().toISOString();
    const p = playbooks.find((x) => x.id === r.playbookId);
    const toutes = p ? p.etapes.every((e) => faites[e.id]) : false;
    const { id, ...reste } = r;
    void upsert('playbookRuns', id, { ...reste, faites, closLe: toutes ? new Date().toISOString() : null });
  };
  const demarrer = () => {
    if (!lancer?.playbookId || !user?.email) return;
    const id = `run-${uid()}`;
    void upsert('playbookRuns', id, { playbookId: lancer.playbookId, orgId: lancer.orgId || null, incidentId: null, lancePar: user.email, lanceLe: new Date().toISOString(), faites: {}, closLe: null });
    setChoisi(id);
    setLancer(null);
  };
  const copier = (p: Pb, orgId: string) => {
    if (!orgId) return;
    const { id, ...reste } = p;
    void upsert('playbooks', `pb-${uid()}`, { ...reste, nom: `${p.nom} · ${noms.get(orgId) ?? ''}`, pourOrg: orgId, origine: id, creePar: user?.email ?? '', at: new Date().toISOString() });
  };
  const annee = new Date().getFullYear();
  const emplois = (p: Pb) => runs.filter((r) => r.playbookId === p.id && new Date(r.lanceLe).getFullYear() === annee).length;
  const maxEmplois = Math.max(1, ...playbooks.map(emplois));
  const indexCourant = pb && run ? pb.etapes.findIndex((e) => !run.faites[e.id]) : -1;
  const champ = 'h-9 border border-[#2b3030] bg-[#111414] px-2.5 text-[13px] text-[#f7f7f5] outline-none focus:border-[#8a8a87]';

  return (
    <>
      <EnTete
        surtitre={`Cyber · Playbooks${run && !run.closLe ? ' · en cours' : ''}`}
        titre={pb && run ? (run.closLe ? `${pb.nom} : terminé.` : `${pb.nom} : étape ${indexCourant + 1} sur ${pb.etapes.length}.`) : playbooks.length ? 'Aucune procédure en cours.' : 'La bibliothèque est vide.'}
      />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <Carte dominante pad="p-6" className="self-start" titre={pb && run ? `${pb.nom}${run.orgId ? ` · ${noms.get(run.orgId) ?? ''}` : ''}` : 'La procédure'} droite={pb && run ? `${Object.keys(run.faites).length} sur ${pb.etapes.length} · lancé à ${hhmm(run.lanceLe)} par ${nom(run.lancePar)}` : ''}>
          {!pb || !run ? (
            <Invitation titre="Rien n’est lancé." texte="Choisissez un playbook dans la bibliothèque et une cliente : ses étapes se cochent ici, et le journal garde qui a fait quoi." />
          ) : (
            <ol className="flex flex-col">
              {pb.etapes.map((e, i) => {
                const fait = Boolean(run.faites[e.id]);
                const courante = i === indexCourant && !run.closLe;
                return (
                  <li key={e.id} className={e.si ? 'ml-12 border-l border-dashed border-[#3a3f3f] pl-4' : ''}>
                    <div className="flex items-start gap-4 border-b border-[#171a1a] px-3 py-3.5" style={courante ? { border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.06)', boxShadow: '0 0 26px -12px rgba(208,154,74,.6)' } : undefined} data-signal-groupe={courante ? 'playbook-etape' : undefined}>
                      <button type="button" onClick={() => cocher(run, e.id)} aria-label={fait ? `Décocher : ${e.texte}` : `Cocher : ${e.texte}`} className="mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center border font-mono text-[10px]" style={{ borderColor: courante ? AMBRE : fait ? '#8a8a87' : '#3a3f3f', background: fait ? '#8a8a87' : 'transparent', color: fait ? '#0b0c0c' : courante ? AMBRE : '#a3a3a0' }}>
                        {fait ? '✓' : i + 1}
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold" style={{ color: fait ? '#9a9a97' : '#f7f7f5' }}>
                          {e.si && <span className="mr-2 font-mono text-[10px] tracking-[0.12em] text-[#a3a3a0]">SI ·</span>}
                          {e.si ? `${e.si.replace(/^Si\s+/i, '').replace(/^./, (x) => x.toUpperCase())}` : e.texte}
                        </span>
                        {e.si && <span className="block text-[12px] text-[#9a9a97]">{e.texte}</span>}
                      </div>
                      <span className="font-mono text-[9.5px] font-semibold tracking-[0.12em]" style={{ color: courante ? AMBRE : '#9a9a97' }}>
                        {fait ? 'FAIT' : courante ? 'EN COURS' : ''}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {enCours.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {enCours.map((r) => (
                <button key={r.id} type="button" onClick={() => setChoisi(r.id)} className="border border-[#2b3030] px-2.5 py-1 text-[12px] text-[#a3a3a0] hover:text-[#f7f7f5]" aria-pressed={run?.id === r.id}>
                  {playbooks.find((p) => p.id === r.playbookId)?.nom ?? 'Playbook'}
                  {r.orgId ? ` · ${noms.get(r.orgId) ?? ''}` : ''}
                </button>
              ))}
            </div>
          )}
        </Carte>
        <Carte pad="p-6" className="self-start" titre={`Les playbooks · ${playbooks.length}`} droite="emplois cette année">
          {playbooks.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-[#171a1a] py-2.5">
              <button type="button" onClick={() => setLancer({ playbookId: p.id, orgId: lancer?.orgId ?? '' })} className="min-w-0 flex-1 truncate text-left text-[13.5px] font-semibold text-[#f7f7f5] hover:underline" title={p.description}>
                {p.nom}
              </button>
              <span className="h-[3px] w-[90px] bg-[#1d2121]" aria-hidden>
                <span className="block h-full bg-[#6b7070]" style={{ width: `${(emplois(p) / maxEmplois) * 100}%` }} />
              </span>
              <span className="w-6 text-right font-mono text-[11px] text-[#a3a3a0]">{emplois(p) || ''}</span>
            </div>
          ))}
          <p className="mt-3 text-[12.5px] leading-relaxed text-[#a3a3a0]">Un playbook se copie pour une cliente et s’adapte ; l’original ne change pas.</p>
          {lancer && (
            <div className="mt-4 flex flex-col gap-2 border border-[#2b3030] p-3">
              <select value={lancer.playbookId} onChange={(e) => setLancer({ ...lancer, playbookId: e.target.value })} className={champ} aria-label="Le playbook">
                {playbooks.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
              <select value={lancer.orgId} onChange={(e) => setLancer({ ...lancer, orgId: e.target.value })} className={champ} aria-label="Pour quelle cliente">
                <option value="">Tout le parc</option>
                {c.orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nom}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button type="button" className="bx-btn" onClick={demarrer}>
                  Lancer
                </button>
                <button type="button" className="bx-btn2" disabled={!lancer.orgId} onClick={() => copier(playbooks.find((p) => p.id === lancer.playbookId)!, lancer.orgId)}>
                  Copier pour elle
                </button>
              </div>
            </div>
          )}
        </Carte>
      </div>
    </>
  );
}

export function usePlaybooks() {
  const playbooks = useCollection<Playbook>('playbooks');
  return useMemo(() => playbooks, [playbooks]);
}
