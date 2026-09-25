import React, { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { uid, useCollection, useSync } from '../../state/SyncContext';
import { AMBRE, ROUGE } from '../jetons';
import { useCyber } from '../donnees/cyber';
import { useSupervisor } from '../donnees/useSupervisor';
import type { VeilleVuln } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { enLettresF, jourMois } from '../format';

/**
 * CYBER · LA VEILLE DES VULNÉRABILITÉS (cahier 15, `51c` · 08).
 *
 * Les failles publiées, notées le jour où elles sortent (`veilleVulns`), et
 * croisées avec l'inventaire : chaque actif qui porte un logiciel et sa
 * version (« WordPress 6.4.1 ») est comparé aux versions touchées. L'écran
 * dit qui est concerné, et par quoi ; il n'invente aucune faille, et ne
 * déclare concernée une cliente que si sa version est connue et touchée.
 *
 * L'ambre : la faille non traitée la plus grave qui concerne au moins une
 * cliente. Une faille critique concernée est aussi le seul rouge de l'écran.
 */

type V = VeilleVuln & { id: string };
const RANG = { critique: 0, haute: 1, moyenne: 2, basse: 3 } as const;

/** « 6.4.1 » → [6, 4, 1] */
const nums = (v: string) => (v.match(/\d+(?:\.\d+)*/)?.[0] ?? '').split('.').filter(Boolean).map(Number);
const compare = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
};

/** La version est-elle touchée ? « < 6.4.3 », « <= 2.1 », « 2.0 – 2.3 », « toutes ». */
export function versionTouchee(version: string, plage: string): boolean | null {
  const p = plage.trim().toLowerCase();
  if (!p || p === 'toutes') return true;
  const v = nums(version);
  if (!v.length) return null;
  const m = /^(<=|<|≤)\s*([\d.]+)$/.exec(p);
  if (m) return m[1] === '<' ? compare(v, nums(m[2])) < 0 : compare(v, nums(m[2])) <= 0;
  const r = /^([\d.]+)\s*[–-]\s*([\d.]+)$/.exec(p);
  if (r) return compare(v, nums(r[1])) >= 0 && compare(v, nums(r[2])) <= 0;
  const e = /^=?\s*([\d.]+)$/.exec(p);
  if (e) return compare(v, nums(e[1])) === 0;
  return null;
}

export function CyberVulnerabilites() {
  const c = useCyber();
  const sup = useSupervisor();
  const { user } = useAuth();
  const { upsert } = useSync();
  const vulns = (useCollection<VeilleVuln>('veilleVulns') as V[]).slice().sort((a, b) => b.publieeLe.localeCompare(a.publieeLe));
  const [choisie, setChoisie] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState<{ ref: string; logiciel: string; versions: string; gravite: VeilleVuln['gravite']; resume: string; correctif: string } | null>(null);

  /** Pour chaque faille, les actifs touchés (logiciel connu, version touchée). */
  const concernes = useMemo(() => {
    const r = new Map<string, { orgId: string; actif: string; version: string }[]>();
    for (const v of vulns) {
      const l = v.logiciel.trim().toLowerCase();
      r.set(
        v.id,
        c.actifs
          .filter((a) => a.logiciel && a.logiciel.toLowerCase().startsWith(l) && versionTouchee(a.logiciel.slice(l.length), v.versions) === true)
          .map((a) => ({ orgId: a.orgId, actif: a.nom, version: a.logiciel!.slice(v.logiciel.length).trim() })),
      );
    }
    return r;
  }, [vulns, c.actifs]);
  const ouvertes = vulns.filter((v) => !v.traiteeLe && (concernes.get(v.id)?.length ?? 0) > 0).sort((a, b) => RANG[a.gravite] - RANG[b.gravite] || b.publieeLe.localeCompare(a.publieeLe));
  const ambre = ouvertes[0] ?? null;
  const rouge = ouvertes.find((v) => v.gravite === 'critique') ?? null;
  const vue = vulns.find((v) => v.id === choisie) ?? ambre ?? vulns[0] ?? null;
  const nom = (id: string) => c.orgs.find((o) => o.id === id)?.nom ?? 'une cliente';
  const avecVersion = c.actifs.filter((a) => a.logiciel).length;

  const prevenir = (v: V) => {
    const orgs = [...new Set((concernes.get(v.id) ?? []).map((x) => x.orgId))];
    for (const orgId of orgs) {
      const suiviPar = sup.orgs.find((o) => o.id === orgId)?.suivi;
      const qui = suiviPar?.type === 'humain' ? suiviPar.email : user?.email ?? '';
      void upsert('tasks', `veille-${v.id}-${orgId}`, { title: `${v.ref} : prévenir ${nom(orgId)}`, detail: `${v.logiciel} ${v.versions} — ${v.resume}${v.correctif ? ` Correctif : ${v.correctif}.` : ''}`, assigneeEmail: qui, status: 'todo', siteId: null, clientId: null, createdAt: new Date().toISOString(), priority: v.gravite === 'critique' || v.gravite === 'haute' ? 'high' : 'normal' });
    }
    const { id, ...reste } = v;
    void upsert('veilleVulns', id, { ...reste, traiteeLe: new Date().toISOString() });
  };
  const nAmbre = ambre ? new Set((concernes.get(ambre.id) ?? []).map((x) => x.orgId)).size : 0;
  const titre = ambre ? `${ambre.ref}, ${ambre.gravite}, touche ${enLettresF(nAmbre)} cliente${nAmbre > 1 ? 's' : ''} du parc.` : vulns.length ? 'Aucune faille notée ne touche le parc aujourd’hui.' : 'La veille n’a encore rien noté.';
  const champ = 'h-9 border border-[#212525] bg-transparent px-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]';

  return (
    <>
      <EnTete
        surtitre="Cyber · Alertes · Veille des vulnérabilités"
        titre={titre}
        actions={
          <button type="button" className="bx-btn2" onClick={() => setNouvelle({ ref: '', logiciel: '', versions: '', gravite: 'haute', resume: '', correctif: '' })}>
            Noter une faille publiée
          </button>
        }
      />
      {nouvelle && (
        <Carte pad="p-5" className="mb-[18px]" titre="Une faille publiée" droite="telle que l’éditeur ou le CERT la décrit">
          <form
            className="grid grid-cols-1 gap-2 md:grid-cols-[170px_170px_130px_130px_minmax(0,1fr)]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nouvelle.ref.trim() || !nouvelle.logiciel.trim() || !nouvelle.resume.trim()) return;
              void upsert('veilleVulns', `vuln-${uid()}`, { ref: nouvelle.ref.trim(), logiciel: nouvelle.logiciel.trim(), versions: nouvelle.versions.trim() || 'toutes', gravite: nouvelle.gravite, resume: nouvelle.resume.trim(), correctif: nouvelle.correctif.trim() || null, publieeLe: new Date().toISOString(), par: user?.email ?? '' });
              setNouvelle(null);
            }}
          >
            <input value={nouvelle.ref} onChange={(e) => setNouvelle({ ...nouvelle, ref: e.target.value })} placeholder="CVE-2026-…" aria-label="Référence" className={`${champ} font-mono`} />
            <input value={nouvelle.logiciel} onChange={(e) => setNouvelle({ ...nouvelle, logiciel: e.target.value })} placeholder="Logiciel" aria-label="Logiciel" className={champ} />
            <input value={nouvelle.versions} onChange={(e) => setNouvelle({ ...nouvelle, versions: e.target.value })} placeholder="< 6.4.3" aria-label="Versions touchées" className={`${champ} font-mono`} />
            <select value={nouvelle.gravite} onChange={(e) => setNouvelle({ ...nouvelle, gravite: e.target.value as VeilleVuln['gravite'] })} aria-label="Gravité" className={`${champ} bg-[#0f1111]`}>
              {(['critique', 'haute', 'moyenne', 'basse'] as const).map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <input value={nouvelle.resume} onChange={(e) => setNouvelle({ ...nouvelle, resume: e.target.value })} placeholder="Ce qu’elle permet, en une phrase" aria-label="Résumé" className={champ} />
            <input value={nouvelle.correctif} onChange={(e) => setNouvelle({ ...nouvelle, correctif: e.target.value })} placeholder="Le correctif (« mettre à jour vers 6.4.3 »)" aria-label="Correctif" className={`${champ} md:col-span-4`} />
            <button type="submit" className="bx-btn">
              Noter
            </button>
          </form>
        </Carte>
      )}
      {vulns.length === 0 ? (
        <Invitation titre="Rien de noté." texte="Chaque faille publiée qui peut toucher le parc se note ici, avec son logiciel et ses versions : l’écran la croise avec l’inventaire et dit qui est concerné." />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_380px]">
          <Carte dominante pad="p-6" className="self-start" titre={`Les failles · ${vulns.length}`} droite={`croisées avec ${avecVersion} actif${avecVersion > 1 ? 's' : ''} versionné${avecVersion > 1 ? 's' : ''}`}>
            {vulns.map((v) => {
              const n = new Set((concernes.get(v.id) ?? []).map((x) => x.orgId)).size;
              const estAmbre = ambre?.id === v.id;
              const estRouge = rouge?.id === v.id;
              return (
                <button key={v.id} type="button" onClick={() => setChoisie(v.id)} aria-pressed={vue?.id === v.id} className="grid w-full grid-cols-[150px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-b border-[#1d2121] py-3 text-left" style={estAmbre ? { boxShadow: `inset 2px 0 0 ${AMBRE}`, paddingLeft: 10, background: 'rgba(208,154,74,.05)' } : vue?.id === v.id ? { background: '#161919' } : undefined} data-signal-groupe={estAmbre ? 'veille-ambre' : undefined}>
                  <span className="font-mono text-[11.5px] text-[#e4e4e1]">{v.ref}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] text-[#f7f7f5]">
                      {v.logiciel} {v.versions}
                    </span>
                    <span className="block truncate text-[12px] text-[#a3a3a0]">{v.resume}</span>
                  </span>
                  <span className="text-right font-mono text-[10px] uppercase">
                    <span className="block" style={{ color: estRouge ? ROUGE.texte : '#9a9a97' }}>
                      {v.gravite}
                    </span>
                    <span className="block" style={{ color: estAmbre ? AMBRE : '#9a9a97' }}>
                      {v.traiteeLe ? 'traitée' : n ? `${n} concernée${n > 1 ? 's' : ''}` : 'personne'}
                    </span>
                  </span>
                </button>
              );
            })}
          </Carte>
          {vue && (
            <Carte className="self-start" titre={vue.ref} droite={`publiée le ${jourMois(vue.publieeLe)}`}>
              <p className="text-[14px] font-semibold leading-snug text-[#f7f7f5]">{vue.resume}</p>
              <p className="mt-2 font-mono text-[11.5px] text-[#a3a3a0]">
                {vue.logiciel} · versions {vue.versions}
                {vue.correctif ? ` · ${vue.correctif}` : ''}
              </p>
              <span className="mt-5 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#9a9a97]">Qui est concerné</span>
              {(concernes.get(vue.id) ?? []).length === 0 ? (
                <p className="mt-2 text-[13px] text-[#a3a3a0]">Aucun actif du parc ne porte une version touchée — ou sa version n’est pas au dossier.</p>
              ) : (
                (concernes.get(vue.id) ?? []).map((x, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#1d2121] py-2">
                    <span className="text-[13px] text-[#e4e4e1]">
                      {nom(x.orgId)} · {x.actif}
                    </span>
                    <span className="font-mono text-[11px] text-[#a3a3a0]">{x.version}</span>
                  </div>
                ))
              )}
              {!vue.traiteeLe && (concernes.get(vue.id) ?? []).length > 0 && (
                <button type="button" className="bx-btn mt-4" onClick={() => prevenir(vue)}>
                  Prévenir les clientes concernées
                </button>
              )}
              {vue.traiteeLe && <p className="mt-3 text-[12.5px] text-[#a3a3a0]">Traitée le {jourMois(vue.traiteeLe)} : une tâche par cliente, chez qui la suit.</p>}
            </Carte>
          )}
        </div>
      )}
    </>
  );
}
