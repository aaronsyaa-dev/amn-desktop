import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useCollection, useSync, uid } from '../../state/SyncContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { AMBRE } from '../jetons';
import { useSupervisor } from '../donnees/useSupervisor';
import { useCyber } from '../donnees/cyber';
import { useReleves } from '../donnees/releves';
import { ACTIONS, EXCEPTIONS, SUJETS, candidates, conditionDe, phraseRegle, rejouer, type EtatDuJour } from '../donnees/regles';
import type { DeclenchementParc, RegleParc } from '../donnees/types';
import { Carte, EnTete, Ligne } from '../ui/kit';
import { enLettres, jourCourt, jourMois, prenomDe } from '../format';

/**
 * SUPERVISOR · AUTOMATISATIONS — la phrase et son rejeu (cahier 12, `46d`).
 *
 * Pendant qu'on écrit la règle, elle est rejouée sur les trente derniers
 * jours : un bâton par jour, haut quand elle se serait déclenchée. On sait
 * avant d'activer si elle va déborder ou rester muette. Un brouillon ne
 * déclenche rien. L'ambre : la carte « À l'activation » — la première tâche
 * qui partira, pour une organisation qui remplit déjà la condition.
 */

type Regle = RegleParc & { id: string };
const NOUVELLE: RegleParc = { sujet: 'organisation', condition: 'silence', duree: 10, action: 'tache_relance', pourQui: 'suivi', sauf: 'arrivee', active: false, nom: '' };

export function SupervisorAutomatisations() {
  const m = useSupervisor();
  const cyber = useCyber();
  const releves = useReleves();
  const { user } = useAuth();
  const { upsert } = useSync();
  const profils = useProfilesOptionnel();
  const taches = useCollection<{ status: string }>('tasks');
  const declenchements = useCollection<DeclenchementParc>('parcDeclenchements');
  const toutes = m.regles as Regle[];
  const [editee, setEditee] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Partial<RegleParc>>(() => ({ ...NOUVELLE }));
  const [tout, setTout] = useState(false);
  const courante: RegleParc = editee ? { ...(toutes.find((r) => r.id === editee) ?? NOUVELLE), ...brouillon } : { ...NOUVELLE, ...brouillon };

  const nomPour = (q: string) => (q === 'suivi' ? 'celui qui la suit' : q === user?.email ? 'moi' : profils?.profileFor(q).name?.split(' ')[0] || prenomDe(q));
  const equipe = useMemo(() => {
    const e = new Set<string>([...(profils?.profiles ?? []).map((p) => p.email), user?.email ?? ''].filter(Boolean));
    return [...e];
  }, [profils, user]);

  const orgIds = useMemo(() => m.orgs.map((o) => o.id), [m.orgs]);
  const rejeu = useMemo(() => rejouer(courante, releves, orgIds, m.maintenant), [courante, releves, orgIds, m.maintenant]);
  const etat: EtatDuJour = useMemo(
    () => ({ maintenant: m.maintenant, tendance: new Map(cyber.orgs.map((o) => [o.id, o.tendance])), enPanne: new Set(cyber.incidents.filter((g) => g.incidents.some((i) => i.kinds.some((k) => k === 'site_unreachable' || k === 'availability_down'))).map((g) => g.orgId)) }),
    [m.maintenant, cyber],
  );
  const premieres = useMemo(() => candidates(courante, m.orgs, etat), [courante, m.orgs, etat]);
  const cond = conditionDe(courante);
  const noms = new Map(m.orgs.map((o) => [o.id, o.nom]));

  const poser = (patch: Partial<RegleParc>) => setBrouillon((b) => ({ ...b, ...patch }));
  const enregistrer = (active: boolean) => {
    const id = editee ?? `regle-${uid()}`;
    const base = editee ? toutes.find((r) => r.id === editee) : null;
    const { id: _ignore, ...propre } = { ...(base ?? {}), ...courante } as RegleParc & { id?: string };
    void upsert('parcRegles', id, { ...propre, nom: courante.nom || titreDe(courante), active, creePar: base?.creePar ?? user?.email ?? '', creeLe: base?.creeLe ?? new Date().toISOString() });
    setEditee(id);
    setBrouillon({});
  };
  const ouvrir = (r: Regle) => {
    setEditee(r.id);
    setBrouillon({});
  };
  const basculer = (r: Regle) => {
    const { id, ...propre } = r;
    void upsert('parcRegles', id, { ...propre, active: !r.active });
  };

  const debut = new Date(m.maintenant - 29 * 86_400_000);
  const phraseRejeu =
    rejeu.sansReleve === 30
      ? 'Aucun relevé du parc sur ces trente jours : le rejeu ne peut rien dire encore. Il se remplit jour après jour, dès qu’un bureau est ouvert.'
      : rejeu.total === 0
        ? `Elle ne se serait jamais déclenchée${rejeu.sansReleve ? ` (sur ${30 - rejeu.sansReleve} jours relevés)` : ''}.`
        : `Elle se serait déclenchée ${rejeu.total === 1 ? 'une fois' : `${enLettres(rejeu.total)} fois`}${rejeu.distinctes > 1 ? `, chez ${enLettres(rejeu.distinctes)} organisations différentes` : ''}. ${rejeu.maxParOrg > 1 ? `Une organisation l’aurait reçue ${enLettres(rejeu.maxParOrg)} fois.` : 'Aucune ne l’aurait reçue deux fois.'}`;

  const recents = declenchements
    .filter((d) => m.maintenant - Date.parse(d.at) < 7 * 86_400_000)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
  const suite = (d: DeclenchementParc) => {
    if (d.suite) return d.suite;
    if (!d.tacheId) return 'fait';
    const t = taches.find((x) => x.id === d.tacheId);
    if (t?.status === 'done') return 'fait';
    if (!t && m.maintenant - Date.parse(d.at) > 14 * 86_400_000) return 'sans suite';
    return 'en cours';
  };
  const actives = toutes.filter((r) => r.active).length;
  const brouillonActif = !editee || !toutes.find((r) => r.id === editee)?.active;

  return (
    <>
      <EnTete surtitre={`Supervisor · Automatisations${toutes.length ? ` · ${toutes.length} règle${toutes.length > 1 ? 's' : ''}` : ''}`} titre={courante.nom || titreDe(courante)} actions={<button type="button" className="bx-btn2" onClick={() => { setEditee(null); setBrouillon({ ...NOUVELLE }); }}>Nouvelle règle</button>} />
      <Carte dominante pad="p-7" titre="La règle · en cours d’écriture" droite={brouillonActif ? 'brouillon · rien ne se déclenche avant « activer »' : 'active'}>
        <div className="flex flex-wrap items-center gap-2.5">
          <Mot>Quand</Mot>
          <Menu valeur={courante.sujet} options={SUJETS.map((s) => [s.cle, s.nom])} onChange={(v) => poser({ sujet: v, condition: SUJETS.find((s) => s.cle === v)!.conditions[0].cle, duree: SUJETS.find((s) => s.cle === v)!.conditions[0].defaut })} />
          <Menu valeur={courante.condition} options={(SUJETS.find((s) => s.cle === courante.sujet)?.conditions ?? []).map((c) => [c.cle, c.nom])} onChange={(v) => poser({ condition: v, duree: conditionDe({ sujet: courante.sujet, condition: v })?.defaut ?? 1 })} />
          {cond && (
            <Menu valeur={String(courante.duree)} options={[1, 2, 3, 5, 7, 10, 14, 30].map((n) => [String(n), `depuis ${n} ${n > 1 ? cond.unite : cond.unite.replace(/s$/, '')}`])} onChange={(v) => poser({ duree: Number(v) })} />
          )}
          <Mot>Alors</Mot>
          <Menu valeur={courante.action} options={ACTIONS.map((a) => [a.cle, a.nom])} onChange={(v) => poser({ action: v })} />
          {courante.action !== 'carnet' && <Menu valeur={courante.pourQui} options={[['suivi', 'pour celui qui la suit'], ...equipe.map((e) => [e, `pour ${nomPour(e)}`] as [string, string])]} onChange={(v) => poser({ pourQui: v })} />}
          <Mot>Sauf</Mot>
          <Menu valeur={courante.sauf} options={EXCEPTIONS.map((x) => [x.cle, x.nom])} onChange={(v) => poser({ sauf: v })} />
        </div>
        <div className="mt-7 grid grid-cols-1 gap-6 border-t border-border pt-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">
              Le rejeu · du {jourMois(debut)} à aujourd’hui, 30 jours
            </span>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-body">{phraseRejeu}</p>
            <div className="mt-5 flex h-[34px] items-end gap-[3px]" role="img" aria-label="Le rejeu, un bâton par jour">
              {rejeu.jours.map((j) => (
                <span key={j.jour} title={`${jourCourt(j.jour)}${j.orgs.length ? ` · ${j.orgs.map((id) => noms.get(id) ?? id).join(', ')}` : releves.has(j.jour) ? ' · rien' : ' · pas de relevé'}`} className="flex-1" style={{ height: j.orgs.length ? 30 : 6, background: j.orgs.length ? 'var(--color-trait-sourd)' : releves.has(j.jour) ? '#252525' : 'transparent', border: releves.has(j.jour) ? undefined : '1px dashed #252525' }} />
              ))}
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-text-muted">
              {rejeu.jours.filter((_, i) => i % 5 === 0 || i === 29).map((j) => (
                <span key={j.jour}>{Number(j.jour.slice(8))}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {premieres.length > 0 ? (
              <div className="p-4" style={{ border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.06)', boxShadow: '0 0 26px -12px rgba(208,154,74,.6)' }} data-signal-groupe="activation">
                <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.18em]" style={{ color: AMBRE }}>
                  À l’activation
                </span>
                <span className="mt-2.5 block text-[15px] font-semibold leading-snug text-text-primary">
                  {premieres[0].nom}
                  {cond ? `, ${cond.constat(premieres[0], etat)}` : ''}
                </span>
                <span className="mt-2 block text-[12px] leading-relaxed text-text-secondary">
                  Elle remplit déjà la condition : {courante.action === 'carnet' ? 'une note partira au carnet de Cyber' : `une tâche partira pour ${nomPour(courante.pourQui === 'suivi' ? (premieres[0].suivi.type === 'humain' ? premieres[0].suivi.email : user?.email ?? '') : courante.pourQui)}`} dès que la règle sera active.
                  {premieres.length > 1 ? ` ${premieres.length - 1} autre${premieres.length > 2 ? 's' : ''} ensuite.` : ''}
                </span>
              </div>
            ) : (
              <p className="border border-[#252525] p-4 text-[12.5px] leading-relaxed text-text-secondary">Aucune organisation ne remplit la condition aujourd’hui : rien ne partira à l’activation.</p>
            )}
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" className="bx-btn2" onClick={() => enregistrer(false)}>
                Garder en brouillon
              </button>
              <button type="button" className="bx-btn" onClick={() => enregistrer(true)}>
                Activer la règle
              </button>
            </div>
          </div>
        </div>
      </Carte>
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <Carte titre={`Les règles${toutes.length ? ` · ${toutes.length}` : ''}`} droite={actives ? 'trace des 30 derniers jours' : ''}>
          {toutes.length === 0 && <p className="text-[13px] text-text-secondary">Aucune règle encore. La première s’écrit au-dessus.</p>}
          {(tout ? toutes : toutes.slice(0, 6)).map((r) => {
            const trace = rejouer(r, releves, orgIds, m.maintenant);
            return (
              <div key={r.id} className="flex items-center gap-3.5 border-b border-[#1a1a1a] py-3">
                <button type="button" role="switch" aria-checked={r.active} aria-label={`${r.nom ?? 'Règle'} : ${r.active ? 'active' : 'coupée'}`} onClick={() => basculer(r)} className={`flex h-[14px] w-[26px] flex-none rounded-[7px] p-[2px] ${r.active ? 'justify-end bg-border-strong' : 'justify-start bg-action-inactive'}`}>
                  <span className={`h-[10px] w-[10px] rounded-full ${r.active ? 'bg-text-body' : 'bg-[#8a8a87]'}`} />
                </button>
                <button type="button" onClick={() => ouvrir(r)} className="min-w-0 flex-1 text-left">
                  <span className="block text-[13.5px] font-semibold text-text-primary">
                    {r.nom || titreDe(r)} {!r.active && <span className="font-mono text-[9.5px] tracking-[0.12em] text-text-muted">· BROUILLON</span>}
                  </span>
                  <span className="block truncate text-[12px] text-text-muted">{phraseRegle(r, nomPour)}</span>
                </button>
                <span className="flex h-[16px] w-[120px] flex-none items-end gap-px" aria-hidden>
                  {trace.jours.map((j) => (
                    <span key={j.jour} className="flex-1" style={{ height: j.orgs.length ? 14 : 1, background: j.orgs.length ? '#8a8a87' : '#2b2b2b' }} />
                  ))}
                </span>
              </div>
            );
          })}
          {!tout && toutes.length > 6 && (
            <button type="button" onClick={() => setTout(true)} className="mt-3 text-[12px] text-text-secondary hover:text-text-primary">
              + {toutes.length - 6} règles
            </button>
          )}
        </Carte>
        <Carte titre="Ce qu’elles ont déclenché" droite="7 derniers jours">
          {recents.length === 0 ? (
            <p className="text-[13px] text-text-secondary">Rien ne s’est déclenché cette semaine.</p>
          ) : (
            recents.map((d) => {
              const r = toutes.find((x) => x.id === d.regleId);
              return <Ligne key={d.id} a={jourCourt(d.jour)} b={`${r?.nom ?? 'Règle retirée'} · ${noms.get(d.orgId) ?? 'organisation'} → ${d.quoi}`} c={suite(d)} />;
            })
          )}
        </Carte>
      </div>
    </>
  );
}

function titreDe(r: Pick<RegleParc, 'sujet' | 'condition' | 'action'>): string {
  const c = conditionDe(r);
  if (r.condition === 'silence') return 'Relancer une cliente qui n’ouvre plus son desktop.';
  if (r.condition === 'sans_personne') return 'Ne laisser aucune organisation sans personne.';
  if (r.condition === 'attend') return 'Ne pas laisser un jeton de places attendre.';
  if (r.condition === 'baisse') return 'Voir une posture qui baisse avant qu’elle tombe.';
  if (r.condition === 'panne') return 'Savoir quand un site tombe.';
  if (r.condition === 'critique') return 'Ne jamais laisser un critique seul.';
  return c ? `Quand ${c.nom}.` : 'Une règle.';
}

function Mot({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">{children}</span>;
}

function Menu({ valeur, options, onChange }: { valeur: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <span className="relative inline-flex">
      <select value={valeur} onChange={(e) => onChange(e.target.value)} className="h-10 appearance-none border border-[#2b2b2b] bg-raised pl-3.5 pr-9 text-[14.5px] font-semibold text-text-primary outline-none focus:border-[#8a8a87]">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" aria-hidden />
    </span>
  );
}

