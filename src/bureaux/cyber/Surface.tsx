import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { uid, useSync } from '../../state/SyncContext';
import { bridge } from '../../lib/bridge';
import type { Scan } from '../../shared/api';
import { AMBRE } from '../jetons';
import { useCyber } from '../donnees/cyber';
import type { Actif } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { jourMois } from '../format';

/**
 * CYBER · LA SURFACE D'ATTAQUE (cahier 15, `51c` · 06).
 *
 * Tout ce qu'une cliente expose sur Internet, découvert sans elle : ses
 * domaines et sous-domaines, les sites suivis, les ports et services ouverts.
 * Deux sources, dites à l'écran : l'inventaire (ce qui a été relevé ou
 * déclaré, avec ce que chaque exposition risque) et le scanner (les
 * constats « ports », « exposition », « divulgation » de ses analyses).
 *
 * L'ambre : l'exposition au risque le plus haut encore ouverte — la plus
 * ancienne s'il y en a plusieurs.
 */

type Expo = { cle: string; hote: string; service: string; port: number | null; risque: 'haut' | 'moyen' | 'bas'; depuis: string; source: 'inventaire' | 'scanner'; actif?: Actif & { id: string } };
const RANG = { haut: 0, moyen: 1, bas: 2 } as const;

export function CyberSurface() {
  const c = useCyber();
  const { user } = useAuth();
  const { upsert } = useSync();
  const [params, setParams] = useSearchParams();
  const [scans, setScans] = useState<Scan[]>([]);
  const [declare, setDeclare] = useState<{ hote: string; port: string; service: string; risque: 'haut' | 'moyen' | 'bas' } | null>(null);

  useEffect(() => {
    let vivant = true;
    bridge()
      .remote.listScans?.()
      .then((s) => vivant && setScans(s))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  // Les expositions ouvertes, par cliente.
  const parOrg = useMemo(() => {
    const r = new Map<string, { hotes: Set<string>; expos: Expo[] }>();
    const de = (orgId: string) => {
      const e = r.get(orgId) ?? { hotes: new Set<string>(), expos: [] };
      r.set(orgId, e);
      return e;
    };
    for (const a of c.actifs) {
      if (a.famille === 'domaine' || a.famille === 'site') de(a.orgId).hotes.add(a.nom);
      if (a.expose && !a.expose.fermeLe) de(a.orgId).expos.push({ cle: a.id, hote: a.nom, service: a.expose.service, port: a.expose.port ?? null, risque: a.expose.risque, depuis: a.expose.decouvertLe, source: 'inventaire', actif: a });
    }
    for (const o of c.orgs) for (const h of o.hotes ?? []) de(o.id).hotes.add(h);
    // Le scanner : la dernière analyse de chaque hôte connu d'une cliente.
    const hoteOrg = new Map<string, string>();
    for (const [orgId, v] of r) for (const h of v.hotes) hoteOrg.set(h.replace(/^https?:\/\//, '').split('/')[0].toLowerCase(), orgId);
    const derniers = new Map<string, Scan>();
    for (const s of scans) {
      if (s.status !== 'done' || !('findings' in (s.results ?? {}))) continue;
      const hote = (s.results as { target: { host: string } }).target.host.toLowerCase();
      const d = derniers.get(hote);
      if (!d || s.createdAt > d.createdAt) derniers.set(hote, s);
    }
    for (const [hote, s] of derniers) {
      const orgId = hoteOrg.get(hote);
      if (!orgId) continue;
      for (const f of (s.results as { findings: { id: string; title: string; severity: string; category: string }[] }).findings) {
        if (!['ports', 'exposure', 'disclosure'].includes(f.category)) continue;
        de(orgId).expos.push({ cle: `${hote}::${f.id}`, hote, service: f.title, port: null, risque: f.severity === 'critical' || f.severity === 'high' ? 'haut' : f.severity === 'medium' ? 'moyen' : 'bas', depuis: s.createdAt, source: 'scanner' });
      }
    }
    return r;
  }, [c.actifs, c.orgs, scans]);

  const toutes = [...parOrg.entries()].flatMap(([orgId, v]) => v.expos.map((e) => ({ ...e, orgId })));
  const ambre = toutes.filter((e) => e.risque === 'haut').sort((a, b) => a.depuis.localeCompare(b.depuis))[0] ?? null;
  const orgs = c.orgs.filter((o) => parOrg.has(o.id)).sort((a, b) => (parOrg.get(b.id)?.expos.length ?? 0) - (parOrg.get(a.id)?.expos.length ?? 0));
  const orgId = params.get('org') ?? ambre?.orgId ?? orgs[0]?.id ?? null;
  const o = c.orgs.find((x) => x.id === orgId) ?? null;
  const ici = o ? parOrg.get(o.id) ?? { hotes: new Set<string>(), expos: [] } : null;
  const nomOrg = (id: string) => c.orgs.find((x) => x.id === id)?.nom ?? '';

  const fermer = (e: Expo) => {
    if (!e.actif) return;
    const { id, ...reste } = e.actif;
    void upsert('inventaire', id, { ...reste, expose: { ...e.actif.expose!, fermeLe: new Date().toISOString() } });
  };
  const titre = ambre ? `${ambre.service}, ouvert sur ${ambre.hote}${ambre.port ? ` (port ${ambre.port})` : ''}, chez ${nomOrg(ambre.orgId)}.` : toutes.length ? 'Rien de haut risque n’est exposé.' : 'Aucune exposition relevée.';
  const champ = 'h-9 border border-[#212525] bg-transparent px-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]';

  return (
    <>
      <EnTete
        surtitre="Cyber · Posture · Surface d’attaque"
        titre={titre}
        actions={
          <select value={orgId ?? ''} onChange={(e) => setParams({ org: e.target.value }, { replace: true })} aria-label="La cliente" className="h-9 border border-[#212525] bg-[#0f1111] px-2.5 text-[13px] text-[#f7f7f5]">
            {c.orgs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nom}
                {parOrg.get(x.id)?.expos.length ? ` · ${parOrg.get(x.id)!.expos.length}` : ''}
              </option>
            ))}
          </select>
        }
      />
      {!o || !ici ? (
        <Invitation titre="Rien n’est encore relevé." texte="La surface d’une cliente se lit dans son inventaire (domaines, sites, services exposés) et dans les analyses du scanner." />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <Carte dominante pad="p-6" className="self-start" titre={`${o.nom} · ce qui se voit d’Internet`} droite={`${ici.hotes.size} hôte${ici.hotes.size > 1 ? 's' : ''} · ${ici.expos.length} exposition${ici.expos.length > 1 ? 's' : ''}`}>
            <div className="flex flex-wrap gap-2">
              {[...ici.hotes].map((h) => {
                const expos = ici.expos.filter((e) => e.hote === h);
                const estAmbre = expos.some((e) => e.cle === ambre?.cle);
                return (
                  <span key={h} className="border px-3 py-2 font-mono text-[11.5px]" style={{ borderColor: estAmbre ? AMBRE : expos.length ? '#6b6b68' : '#212525', color: estAmbre ? AMBRE : '#e4e4e1' }} data-signal-groupe={estAmbre ? 'surface-ambre' : undefined}>
                    {h}
                    {expos.length > 0 && <span className="ml-2 text-[10px]">· {expos.length}</span>}
                  </span>
                );
              })}
            </div>
            <div className="mt-5">
              {ici.expos.length === 0 && <p className="text-[13px] text-[#a3a3a0]">Aucun port ni service exposé relevé.</p>}
              {[...ici.expos]
                .sort((a, b) => RANG[a.risque] - RANG[b.risque])
                .map((e) => {
                  const estAmbre = e.cle === ambre?.cle;
                  return (
                    <div key={e.cle} className="grid grid-cols-[70px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-b border-[#1d2121] py-3" style={estAmbre ? { boxShadow: `inset 2px 0 0 ${AMBRE}`, paddingLeft: 10 } : undefined} data-signal-groupe={estAmbre ? 'surface-ambre' : undefined}>
                      <span className="font-mono text-[11px] tabular-nums text-[#a3a3a0]">{e.port ? `:${e.port}` : '—'}</span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] text-[#f7f7f5]">{e.service}</span>
                        <span className="block font-mono text-[10px] text-[#9a9a97]">
                          {e.hote} · {e.source === 'scanner' ? 'relevé par le scanner' : 'inventaire'} · depuis le {jourMois(e.depuis)}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-mono text-[10px] uppercase" style={{ color: estAmbre ? AMBRE : '#9a9a97' }}>
                          risque {e.risque}
                        </span>
                        {e.actif && (
                          <button type="button" className="bx-lien" onClick={() => fermer(e)}>
                            Refermé
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
            </div>
          </Carte>
          <div className="flex flex-col gap-[18px] self-start">
            <Carte titre="Noter une exposition" droite="découverte sans elle">
              {declare ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    if (!declare.hote.trim() || !declare.service.trim()) return;
                    const port = Number(declare.port);
                    void upsert('inventaire', `expo-${uid()}`, { orgId: o.id, famille: 'domaine', nom: declare.hote.trim(), source: 'releve', expose: { port: port > 0 ? port : null, service: declare.service.trim(), risque: declare.risque, decouvertLe: new Date().toISOString(), fermeLe: null }, at: new Date().toISOString(), par: user?.email ?? '' });
                    setDeclare(null);
                  }}
                >
                  <input value={declare.hote} onChange={(ev) => setDeclare({ ...declare, hote: ev.target.value })} placeholder="admin.exemple.fr" aria-label="L’hôte" className={champ} />
                  <div className="flex gap-2">
                    <input value={declare.port} onChange={(ev) => setDeclare({ ...declare, port: ev.target.value })} inputMode="numeric" placeholder="port" aria-label="Port" className={`${champ} w-[90px] font-mono`} />
                    <input value={declare.service} onChange={(ev) => setDeclare({ ...declare, service: ev.target.value })} placeholder="Ce qui répond" aria-label="Le service" className={`${champ} min-w-0 flex-1`} />
                  </div>
                  <select value={declare.risque} onChange={(ev) => setDeclare({ ...declare, risque: ev.target.value as 'haut' | 'moyen' | 'bas' })} aria-label="Le risque" className={`${champ} bg-[#0f1111]`}>
                    <option value="haut">risque haut</option>
                    <option value="moyen">risque moyen</option>
                    <option value="bas">risque bas</option>
                  </select>
                  <button type="submit" className="bx-btn">
                    Noter
                  </button>
                </form>
              ) : (
                <button type="button" className="bx-btn2" onClick={() => setDeclare({ hote: [...ici.hotes][0] ?? '', port: '', service: '', risque: 'moyen' })}>
                  Noter une exposition
                </button>
              )}
            </Carte>
            <Carte titre="Tout le parc" droite={`${toutes.length} ouverte${toutes.length > 1 ? 's' : ''}`}>
              {orgs.slice(0, 10).map((x) => (
                <button key={x.id} type="button" onClick={() => setParams({ org: x.id }, { replace: true })} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#1d2121] py-2 text-left" aria-pressed={x.id === orgId}>
                  <span className="truncate text-[13px] text-[#e4e4e1]">{x.nom}</span>
                  <span className="font-mono text-[11px] tabular-nums text-[#a3a3a0]">{parOrg.get(x.id)?.expos.length ?? 0}</span>
                </button>
              ))}
            </Carte>
          </div>
        </div>
      )}
    </>
  );
}
