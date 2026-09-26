import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { uid, useCollection, useSync } from '../../state/SyncContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { AMBRE } from '../jetons';
import { useCyber } from '../donnees/cyber';
import type { ExerciceCrise } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { hhmm, jourMois, prenomDe } from '../format';

/**
 * CYBER · L'EXERCICE DE CRISE (cahier 15, `51c` · 09).
 *
 * Une panne simulée, pas à pas, pour vérifier que l'équipe et la cliente
 * savent quoi faire : un scénario, des étapes qu'on coche en les faisant
 * (qui, à quelle heure), puis un bilan. Rien ne tombe vraiment : c'est la
 * répétition, pas l'incident.
 *
 * L'ambre : l'étape en cours de l'exercice ouvert.
 */

type Exo = ExerciceCrise & { id: string };
const SCENARIOS: { scenario: string; etapes: string[] }[] = [
  { scenario: 'Le site est injoignable un lundi matin.', etapes: ['Qui constate, qui appelle-t-on en premier ?', 'Vérifier l’hébergeur et le nom de domaine', 'Prévenir la cliente, avec ce qu’on sait', 'Remettre en ligne ou afficher une page d’attente', 'Faire le point : combien de temps, et pourquoi'] },
  { scenario: 'Un compte administrateur a été utilisé depuis l’étranger.', etapes: ['Bloquer le compte et couper ses sessions', 'Changer les mots de passe liés', 'Chercher ce qui a été fait avec, dans le journal', 'Prévenir la cliente et, si besoin, la CNIL (72 h)', 'Activer la double authentification partout'] },
  { scenario: 'Un poste est chiffré par un rançongiciel.', etapes: ['Isoler le poste du réseau', 'Ne pas payer : prévenir la cliente', 'Vérifier les sauvegardes, hors ligne', 'Restaurer sur un poste propre', 'Porter plainte et écrire le bilan'] },
];

export function CyberCrise() {
  const c = useCyber();
  const { user } = useAuth();
  const { upsert } = useSync();
  const profils = useProfilesOptionnel();
  const exos = (useCollection<ExerciceCrise>('exercicesCrise') as Exo[]).slice().sort((a, b) => b.date.localeCompare(a.date));
  const [lancer, setLancer] = useState<{ orgId: string; modele: number; date: string } | null>(null);
  const [bilan, setBilan] = useState('');
  const ouvert = exos.find((e) => !e.bilan && e.etapes.some((x) => !x.faiteLe)) ?? null;
  const courante = ouvert ? ouvert.etapes.find((x) => !x.faiteLe) ?? null : null;
  const aBilan = exos.find((e) => !e.bilan && e.etapes.every((x) => x.faiteLe)) ?? null;
  const nom = (id?: string | null) => (id ? c.orgs.find((o) => o.id === id)?.nom ?? 'une cliente' : 'l’équipe');
  const qui = (e?: string | null) => (e ? profils?.profileFor(e).name?.split(' ')[0] || prenomDe(e) : '');
  const maj = (e: Exo, patch: Partial<ExerciceCrise>) => {
    const { id, ...reste } = e;
    void upsert('exercicesCrise', id, { ...reste, ...patch });
  };
  const cocher = (e: Exo, etapeId: string) => maj(e, { etapes: e.etapes.map((x) => (x.id === etapeId ? { ...x, faiteLe: x.faiteLe ? null : new Date().toISOString(), qui: x.faiteLe ? null : user?.email ?? null } : x)) });
  const exo = ouvert ?? aBilan ?? exos[0] ?? null;
  const titre = ouvert && courante ? `${nom(ouvert.orgId)} : étape ${ouvert.etapes.indexOf(courante) + 1} sur ${ouvert.etapes.length}.` : aBilan ? `L’exercice ${nom(aBilan.orgId) === 'l’équipe' ? 'de l’équipe' : `de ${nom(aBilan.orgId)}`} attend son bilan.` : exos.length ? 'Aucun exercice en cours.' : 'Aucun exercice encore.';

  return (
    <>
      <EnTete
        surtitre="Cyber · Playbooks · Exercice de crise"
        titre={titre}
        actions={
          <button type="button" className="bx-btn2" onClick={() => setLancer({ orgId: c.orgs[0]?.id ?? '', modele: 0, date: new Date().toISOString().slice(0, 10) })}>
            Préparer un exercice
          </button>
        }
      />
      {lancer && (
        <Carte pad="p-5" className="mb-[18px]" titre="Préparer un exercice" droite="une panne simulée, rien ne tombe vraiment">
          <form
            className="grid grid-cols-1 gap-2 md:grid-cols-[220px_minmax(0,1fr)_160px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const m = SCENARIOS[lancer.modele];
              void upsert('exercicesCrise', `crise-${uid()}`, { orgId: lancer.orgId || null, scenario: m.scenario, date: lancer.date, etapes: m.etapes.map((texte, i) => ({ id: `e${i}`, texte })), par: user?.email ?? '' });
              setLancer(null);
            }}
          >
            <select value={lancer.orgId} onChange={(e) => setLancer({ ...lancer, orgId: e.target.value })} aria-label="Avec quelle cliente" className="h-9 border border-[#212525] bg-[#0f1111] px-2.5 text-[13px] text-text-primary">
              <option value="">L’équipe seule</option>
              {c.orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </select>
            <select value={lancer.modele} onChange={(e) => setLancer({ ...lancer, modele: Number(e.target.value) })} aria-label="Le scénario" className="h-9 border border-[#212525] bg-[#0f1111] px-2.5 text-[13px] text-text-primary">
              {SCENARIOS.map((s, i) => (
                <option key={i} value={i}>
                  {s.scenario}
                </option>
              ))}
            </select>
            <input type="date" value={lancer.date} onChange={(e) => setLancer({ ...lancer, date: e.target.value })} aria-label="Le jour" className="h-9 border border-[#212525] bg-transparent px-2.5 text-[13px] text-text-primary [color-scheme:dark]" />
            <button type="submit" className="bx-btn">
              Préparer
            </button>
          </form>
        </Carte>
      )}
      {!exo ? (
        <Invitation titre="Aucun exercice." texte="Une panne simulée, avec la cliente ou l’équipe seule : les étapes se cochent en les faisant, et le bilan dit ce qu’on change." />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px]">
          <Carte dominante pad="p-6" className="self-start" titre={`${nom(exo.orgId)} · ${jourMois(exo.date)}`} droite={`${exo.etapes.filter((x) => x.faiteLe).length} sur ${exo.etapes.length}`}>
            <p className="mb-4 text-[16px] font-semibold leading-snug text-text-primary">{exo.scenario}</p>
            <ol className="flex flex-col">
              {exo.etapes.map((x, i) => {
                const estAmbre = exo === ouvert && courante?.id === x.id;
                return (
                  <li key={x.id} className="flex items-start gap-4 border-b border-[#171a1a] px-3 py-3.5" style={estAmbre ? { border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.06)' } : undefined} data-signal-groupe={estAmbre ? 'crise-etape' : undefined}>
                    <button type="button" onClick={() => cocher(exo, x.id)} aria-label={x.faiteLe ? `Décocher : ${x.texte}` : `Cocher : ${x.texte}`} className="mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center border font-mono text-[10px]" style={{ borderColor: estAmbre ? AMBRE : x.faiteLe ? '#8a8a87' : '#3a3f3f', background: x.faiteLe ? '#8a8a87' : 'transparent', color: x.faiteLe ? '#0b0c0c' : estAmbre ? AMBRE : 'var(--color-text-secondary)' }}>
                      {x.faiteLe ? '✓' : i + 1}
                    </button>
                    <span className="min-w-0 flex-1 text-[14px]" style={{ color: x.faiteLe ? 'var(--color-text-muted)' : 'var(--color-text-primary)', fontWeight: x.faiteLe ? 400 : 600 }}>
                      {x.texte}
                    </span>
                    <span className="font-mono text-[10px] text-text-muted">{x.faiteLe ? `${hhmm(x.faiteLe)} · ${qui(x.qui)}` : estAmbre ? <span style={{ color: AMBRE }}>EN COURS</span> : ''}</span>
                  </li>
                );
              })}
            </ol>
            {exo.bilan ? (
              <p className="mt-4 text-[13.5px] leading-relaxed text-text-body">Bilan : {exo.bilan}</p>
            ) : exo.etapes.every((x) => x.faiteLe) ? (
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!bilan.trim()) return;
                  maj(exo, { bilan: bilan.trim() });
                  setBilan('');
                }}
              >
                <input value={bilan} onChange={(e) => setBilan(e.target.value)} placeholder="Ce qu’on a appris, ce qu’on change…" aria-label="Le bilan" className="h-9 min-w-0 flex-1 border border-[#212525] bg-transparent px-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]" />
                <button type="submit" className="bx-btn" disabled={!bilan.trim()}>
                  Écrire le bilan
                </button>
              </form>
            ) : null}
          </Carte>
          <Carte className="self-start" titre="Les exercices" droite={exos.length}>
            {exos.map((e) => (
              <p key={e.id} className="border-b border-[#1d2121] py-2 text-[13px] text-text-body">
                {jourMois(e.date)} · {nom(e.orgId)}
                <span className="block text-[12px] text-text-secondary">{e.bilan ? 'bilan écrit' : e.etapes.every((x) => x.faiteLe) ? 'bilan à écrire' : `${e.etapes.filter((x) => x.faiteLe).length} étape${e.etapes.filter((x) => x.faiteLe).length > 1 ? 's' : ''} sur ${e.etapes.length}`}</span>
              </p>
            ))}
          </Carte>
        </div>
      )}
    </>
  );
}
