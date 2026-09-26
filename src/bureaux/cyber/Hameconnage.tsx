import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { uid, useCollection, useSync } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useCyber } from '../donnees/cyber';
import type { Hameconnage } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { jourMois } from '../format';

/**
 * CYBER · L'EXERCICE D'HAMEÇONNAGE (cahier 15, `51c` · 05) — le SUIVI.
 *
 * Un exercice de sensibilisation se mène chez une cliente, avec son accord
 * écrit, par l'outil qu'elle a choisi. AMN n'envoie AUCUN courriel piégé :
 * ce module planifie l'exercice, note qui l'a accepté, puis consigne les
 * chiffres rapportés — combien ont cliqué, combien ont signalé — et le bilan.
 *
 * L'ambre : l'exercice passé dont les chiffres montrent le plus de clics
 * sans bilan écrit — c'est le débrief qui attend un humain.
 */

type Exo = Hameconnage & { id: string };
const SEUIL_CLIC = 0.1;

export function CyberHameconnage() {
  const c = useCyber();
  const { user } = useAuth();
  const { upsert } = useSync();
  const exos = (useCollection<Hameconnage>('hameconnages') as Exo[]).slice().sort((a, b) => b.date.localeCompare(a.date));
  const [plan, setPlan] = useState<{ orgId: string; titre: string; date: string; accordPar: string; cibles: string } | null>(null);
  const [chiffres, setChiffres] = useState<{ id: string; cliques: string; signales: string; notes: string } | null>(null);
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const nom = (id: string) => c.orgs.find((o) => o.id === id)?.nom ?? 'une cliente';
  const taux = (e: Exo) => (e.cliques !== null && e.cibles ? e.cliques / e.cibles : null);
  const aDebriefer = exos.filter((e) => e.cliques !== null && (taux(e) ?? 0) >= SEUIL_CLIC && !e.notes?.includes('Bilan')).sort((a, b) => (taux(b) ?? 0) - (taux(a) ?? 0));
  const ambre = aDebriefer[0] ?? null;
  const aVenir = exos.filter((e) => e.date >= aujourdHui && e.cliques === null);
  const aNoter = exos.filter((e) => e.date < aujourdHui && e.cliques === null);
  const maj = (e: Exo, patch: Partial<Hameconnage>) => {
    const { id, ...reste } = e;
    void upsert('hameconnages', id, { ...reste, ...patch });
  };

  const titre = ambre
    ? `${nom(ambre.orgId)} : ${Math.round((taux(ambre) ?? 0) * 100)} % de clics, le bilan reste à faire.`
    : aNoter.length
      ? `${aNoter.length} exercice${aNoter.length > 1 ? 's' : ''} passé${aNoter.length > 1 ? 's' : ''} attend${aNoter.length > 1 ? 'ent' : ''} ses chiffres.`
      : exos.length
        ? 'Les exercices passés ont leur bilan.'
        : 'Aucun exercice planifié.';
  const champ = 'h-9 border border-[#212525] bg-transparent px-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]';

  return (
    <>
      <EnTete
        surtitre="Cyber · Playbooks · Exercice d’hameçonnage"
        titre={titre}
        lede="Le suivi d’un exercice mené avec l’accord de la cliente, par l’outil de son choix : AMN n’envoie aucun courriel piégé. On note ici l’accord, la date, les chiffres et le bilan."
        actions={
          <button type="button" className="bx-btn2" onClick={() => setPlan({ orgId: c.orgs[0]?.id ?? '', titre: '', date: aujourdHui, accordPar: '', cibles: '' })}>
            Planifier un exercice
          </button>
        }
      />
      {plan && (
        <Carte pad="p-5" className="mb-[18px]" titre="Planifier" droite="sans accord écrit, pas d’exercice">
          <form
            className="grid grid-cols-1 gap-2 md:grid-cols-[200px_minmax(0,1fr)_150px_minmax(0,1fr)_90px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const cibles = Number(plan.cibles);
              if (!plan.orgId || !plan.titre.trim() || !plan.accordPar.trim() || !(cibles > 0)) return;
              void upsert('hameconnages', `hame-${uid()}`, { orgId: plan.orgId, titre: plan.titre.trim(), date: plan.date, accordPar: plan.accordPar.trim(), cibles, cliques: null, signales: null, par: user?.email ?? '' });
              setPlan(null);
            }}
          >
            <select value={plan.orgId} onChange={(e) => setPlan({ ...plan, orgId: e.target.value })} aria-label="La cliente" className={`${champ} bg-[#0f1111]`}>
              {c.orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </select>
            <input value={plan.titre} onChange={(e) => setPlan({ ...plan, titre: e.target.value })} placeholder="Ce qu’on vérifie" aria-label="Titre" className={champ} />
            <input type="date" value={plan.date} onChange={(e) => setPlan({ ...plan, date: e.target.value })} aria-label="Date" className={`${champ} [color-scheme:dark]`} />
            <input value={plan.accordPar} onChange={(e) => setPlan({ ...plan, accordPar: e.target.value })} placeholder="Accord donné par…" aria-label="Accord donné par" className={champ} />
            <input value={plan.cibles} onChange={(e) => setPlan({ ...plan, cibles: e.target.value })} inputMode="numeric" placeholder="cibles" aria-label="Personnes concernées" className={`${champ} font-mono`} />
            <button type="submit" className="bx-btn">
              Planifier
            </button>
          </form>
        </Carte>
      )}
      {exos.length === 0 ? (
        <Invitation titre="Aucun exercice." texte="Un exercice se planifie avec la cliente : qui a donné son accord, combien de personnes, quand. Les chiffres se notent ensuite, tels que l’outil les rapporte." />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <Carte dominante pad="p-6" className="self-start" titre={`Les exercices · ${exos.length}`} droite="cliqué · signalé, sur les personnes visées">
            {exos.map((e) => {
              const estAmbre = ambre?.id === e.id;
              const t = taux(e);
              return (
                <div key={e.id} className="border-b border-[#1d2121] py-3.5" style={estAmbre ? { boxShadow: `inset 2px 0 0 ${AMBRE}`, paddingLeft: 12, background: 'rgba(208,154,74,.05)' } : undefined} data-signal-groupe={estAmbre ? 'hame-ambre' : undefined}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-text-primary">{e.titre}</span>
                      <span className="block text-[12px] text-text-secondary">
                        {nom(e.orgId)} · {jourMois(e.date)} · accord : {e.accordPar} · {e.cibles} personne{e.cibles > 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="font-mono text-[10.5px] uppercase" style={{ color: estAmbre ? AMBRE : 'var(--color-text-muted)' }}>
                      {e.cliques === null ? (e.date >= aujourdHui ? 'à venir' : 'chiffres à noter') : estAmbre ? 'bilan à faire' : 'fait'}
                    </span>
                  </div>
                  {e.cliques !== null && (
                    <div className="mt-3 grid grid-cols-[70px_minmax(0,1fr)_60px] items-center gap-x-3 gap-y-1.5">
                      <span className="font-mono text-[10px] uppercase text-text-muted">cliqué</span>
                      <span className="h-[8px] bg-[#1d2121]" aria-hidden>
                        <span className="block h-full" style={{ width: `${(t ?? 0) * 100}%`, background: estAmbre ? AMBRE : '#8a8a87' }} />
                      </span>
                      <span className="text-right font-mono text-[11px] tabular-nums text-text-body">
                        {e.cliques} / {e.cibles}
                      </span>
                      <span className="font-mono text-[10px] uppercase text-text-muted">signalé</span>
                      <span className="h-[8px] bg-[#1d2121]" aria-hidden>
                        <span className="block h-full bg-text-body" style={{ width: `${((e.signales ?? 0) / e.cibles) * 100}%` }} />
                      </span>
                      <span className="text-right font-mono text-[11px] tabular-nums text-text-body">
                        {e.signales ?? 0} / {e.cibles}
                      </span>
                    </div>
                  )}
                  {e.notes && <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">{e.notes}</p>}
                  <div className="mt-2 flex gap-4">
                    {e.date < aujourdHui && (
                      <button type="button" className="bx-lien" onClick={() => setChiffres({ id: e.id, cliques: String(e.cliques ?? ''), signales: String(e.signales ?? ''), notes: e.notes ?? '' })}>
                        {e.cliques === null ? 'Noter les chiffres' : 'Écrire le bilan'}
                      </button>
                    )}
                  </div>
                  {chiffres?.id === e.id && (
                    <form
                      className="mt-3 flex flex-wrap gap-2"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        const cl = Number(chiffres.cliques);
                        const si = Number(chiffres.signales);
                        if (!(cl >= 0 && cl <= e.cibles && si >= 0 && si <= e.cibles)) return;
                        const notes = chiffres.notes.trim();
                        maj(e, { cliques: cl, signales: si, notes: notes && !notes.startsWith('Bilan') && notes !== e.notes ? `Bilan : ${notes}` : notes || e.notes });
                        setChiffres(null);
                      }}
                    >
                      <input value={chiffres.cliques} onChange={(ev) => setChiffres({ ...chiffres, cliques: ev.target.value })} inputMode="numeric" placeholder="ont cliqué" aria-label="Ont cliqué" className={`${champ} w-[110px] font-mono`} />
                      <input value={chiffres.signales} onChange={(ev) => setChiffres({ ...chiffres, signales: ev.target.value })} inputMode="numeric" placeholder="ont signalé" aria-label="Ont signalé" className={`${champ} w-[110px] font-mono`} />
                      <input value={chiffres.notes} onChange={(ev) => setChiffres({ ...chiffres, notes: ev.target.value })} placeholder="Le bilan, ce qu’on fera ensuite…" aria-label="Le bilan" className={`${champ} min-w-0 flex-1`} />
                      <button type="submit" className="bx-btn2">
                        Noter
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </Carte>
          <div className="flex flex-col gap-[18px] self-start">
            <Carte titre="À venir" droite={aVenir.length || ''}>
              {aVenir.length === 0 ? <p className="text-[13px] text-text-secondary">Rien de planifié.</p> : aVenir.map((e) => <p key={e.id} className="border-b border-[#1d2121] py-2 text-[13px] text-text-body">{jourMois(e.date)} · {nom(e.orgId)}</p>)}
            </Carte>
            <Carte titre="La règle">
              <p className="text-[13px] leading-relaxed text-text-secondary">Au-delà de {Math.round(SEUIL_CLIC * 100)} % de clics, un bilan s’écrit avec la cliente : ce qu’on a appris, et ce qu’on change. Un exercice ne sert qu’avec son bilan.</p>
            </Carte>
          </div>
        </div>
      )}
    </>
  );
}
