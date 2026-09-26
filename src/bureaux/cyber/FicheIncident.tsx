import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useCollection, useSync } from '../../state/SyncContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { bridge } from '../../lib/bridge';
import type { IncidentDetail } from '../../shared/api';
import { AMBRE, ROUGE } from '../jetons';
import { useSourceBureaux } from '../donnees/source';
import type { FicheIncident } from '../donnees/types';
import { Carte, Chargement, EnTete, Ligne } from '../ui/kit';
import { hhmm, jourLong, prenomDe } from '../format';

/**
 * CYBER · LA FICHE INCIDENT — la chronologie à deux voies (cahier 13, `47c`).
 *
 * Une voie pour ce que les systèmes ont vu (les alertes de l'incident, lues
 * au serveur), une pour ce que l'équipe a fait (la prise, les gestes notés,
 * la clôture), sur la même échelle de temps, coupées par le trait de l'heure
 * courante. Dessous : les éléments concernés, les notes d'enquête, la liste
 * de clôture — l'incident ne se clôt qu'avec elle. L'ambre : la prochaine
 * action, cercle creux sur la voie de l'équipe, et sa carte « avant 18:00 ».
 * Le rouge : l'étiquette CRITIQUE.
 */

const CLOTURE_DEFAUT = ['Accès bloqué', 'Mots de passe changés', 'Clés d’API tournées', 'Rapport envoyé à la cliente'];
export const numeroIncident = (id: string) => `INC-${id.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase()}`;

type Point = { at: number; texte: string; plein: boolean };

export function CyberFicheIncident() {
  const { id = '' } = useParams();
  const src = useSourceBureaux();
  const { user } = useAuth();
  const { upsert } = useSync();
  const profils = useProfilesOptionnel();
  const fiches = useCollection<FicheIncident>('incidentsFiches');
  const fiche: FicheIncident = (fiches.find((f) => f.id === id) as FicheIncident | undefined) ?? {};
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [prochaine, setProchaine] = useState({ quoi: '', avant: '' });
  const [note, setNote] = useState('');
  const [element, setElement] = useState('');
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setMaintenant(Date.now()), 60_000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    let vivant = true;
    bridge()
      .remote.getIncident(id)
      .then((d) => vivant && setDetail(d))
      .catch((e) => vivant && setErreur(e instanceof Error ? e.message : 'Incident introuvable.'));
    return () => {
      vivant = false;
    };
  }, [id]);
  const nom = (e: string | null | undefined) => (e ? profils?.profileFor(e).name?.split(' ')[0] || prenomDe(e) : '—');
  const fleet = src.incidents.find((i) => i.id === id);
  const orgNom = fleet?.orgName ?? 'AMN DevSec';

  const ecrire = (patch: Partial<FicheIncident>) => {
    const { id: _i, ...reste } = fiche as FicheIncident & { id?: string };
    void upsert('incidentsFiches', id, { ...reste, orgId: fleet?.orgId ?? reste.orgId ?? null, ...patch });
  };

  const inc = detail?.incident ?? null;
  const systemes = useMemo<Point[]>(() => {
    if (!detail) return [];
    // Les alertes en rafale font UN point : « 200 tentatives en 10 min ».
    const ev = [...detail.events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const points: Point[] = [];
    let paquet: typeof ev = [];
    const vider = () => {
      if (!paquet.length) return;
      const a = Date.parse(paquet[0].occurredAt);
      const b = Date.parse(paquet[paquet.length - 1].occurredAt);
      const m = paquet[0].message ?? paquet[0].type;
      points.push({ at: a, texte: paquet.length > 1 ? `${paquet.length} alertes en ${Math.max(1, Math.round((b - a) / 60_000))} min · ${m}` : m, plein: true });
      paquet = [];
    };
    for (const e of ev) {
      if (paquet.length && Date.parse(e.occurredAt) - Date.parse(paquet[paquet.length - 1].occurredAt) > 10 * 60_000) vider();
      paquet.push(e);
    }
    vider();
    if (detail.incident.lastSeenAt && maintenant - Date.parse(detail.incident.lastSeenAt) > 60 * 60_000 && !detail.incident.resolvedAt) {
      points.push({ at: Date.parse(detail.incident.lastSeenAt) + 60 * 60_000, texte: `Aucune nouvelle alerte depuis ${Math.round((maintenant - Date.parse(detail.incident.lastSeenAt)) / 3_600_000)} h`, plein: true });
    }
    return points.slice(-8);
  }, [detail, maintenant]);
  const equipe = useMemo<Point[]>(() => {
    if (!inc) return [];
    const p: Point[] = [];
    if (inc.acknowledgedAt) p.push({ at: Date.parse(inc.acknowledgedAt), texte: `${nom(inc.acknowledgedBy)} prend l’incident`, plein: true });
    for (const a of fiche.actions ?? []) p.push({ at: Date.parse(a.at), texte: a.quoi, plein: true });
    if (inc.resolvedAt) p.push({ at: Date.parse(inc.resolvedAt), texte: `${nom(inc.resolvedBy)} clôt l’incident`, plein: true });
    return p.sort((a, b) => a.at - b.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inc, fiche.actions, profils]);

  if (erreur) return <EnTete surtitre="Cyber · Incidents" titre="Cet incident est introuvable." lede={erreur} actions={<Link to="/supervision" className="bx-btn2">Tous les incidents</Link>} />;
  if (!inc) {
    return (
      <>
        <EnTete surtitre="Cyber · Incidents" titre="La fiche s’ouvre." />
        <Chargement texte="Lecture de l’incident et de ses alertes" />
      </>
    );
  }

  const cloture = fiche.cloture?.length ? fiche.cloture : CLOTURE_DEFAUT.map((texte, i) => ({ id: `c${i}`, texte, fait: false }));
  const faites = cloture.filter((c) => c.fait).length;
  const reste = cloture.length - faites;
  const debut = Math.min(Date.parse(inc.firstSeenAt), ...systemes.map((s) => s.at), ...equipe.map((e) => e.at)) - 20 * 60_000;
  const avant = fiche.prochaine?.avant ? Date.parse(fiche.prochaine.avant) : null;
  const fin = Math.max(maintenant, avant ?? 0, ...equipe.map((e) => e.at)) + 40 * 60_000;
  const x = (t: number) => ((t - debut) / (fin - debut)) * 100;
  const heures: number[] = [];
  const h0 = new Date(debut);
  h0.setMinutes(0, 0, 0);
  const pas = fin - debut > 12 * 3_600_000 ? 4 : 2;
  for (let t = h0.getTime() + 3_600_000; t < fin; t += pas * 3_600_000) heures.push(t);
  const critique = inc.severity === 'critical';
  const clos = Boolean(inc.resolvedAt);
  const titre = clos ? 'L’incident est clos.' : reste === 0 ? 'Tout est fait : l’incident peut être clos.' : reste === 1 ? 'Il reste une action avant de pouvoir clore.' : `Il reste ${reste} actions avant de pouvoir clore.`;

  const clore = async () => {
    try {
      await bridge().remote.resolveIncident(id, 'resolved', `Clôture : ${cloture.map((c) => c.texte).join(', ')}.`);
      const d = await bridge().remote.getIncident(id);
      setDetail(d);
      void src.recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Clôture refusée.');
    }
  };

  return (
    <>
      <EnTete surtitre={`Cyber · Incidents · ${numeroIncident(id)}`} titre={titre} />
      <Carte dominante pad="p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="border px-1.5 py-[3px] font-mono text-[10px] font-semibold tracking-[0.12em]" style={critique ? { borderColor: ROUGE.bordure, color: ROUGE.texte, background: ROUGE.fond } : { borderColor: '#2b3030', color: 'var(--color-text-secondary)' }}>
            {critique ? 'CRITIQUE' : inc.severity === 'warning' ? 'AVERTISSEMENT' : 'INFORMATION'}
          </span>
          <span className="font-mono text-[13px] font-semibold text-text-primary">{numeroIncident(id)}</span>
          <span className="text-[12.5px] text-text-secondary">
            {orgNom} · ouvert à {hhmm(inc.firstSeenAt)}
            {inc.acknowledgedBy ? ` · suivi par ${nom(inc.acknowledgedBy)}` : ' · personne ne l’a pris'}
          </span>
          <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">La chronologie à deux voies · {jourLong(inc.firstSeenAt)} {new Date(inc.firstSeenAt).getDate()}</span>
        </div>
        <div className="relative" style={{ height: 250 }}>
          <Voie titre="Ce que les systèmes ont vu" y={20} points={systemes} x={x} />
          <Voie titre="Ce que l’équipe a fait" y={140} points={equipe} x={x} prochaine={avant && !clos ? { at: avant, x: x(avant) } : null} />
          {maintenant < fin && (
            <>
              {/* L'heure est posée À CÔTÉ du trait, pas dedans : son fond est la carte, pas le trait de 1 px. */}
              <div className="absolute bottom-6 top-[70px] w-px bg-[#6b7070]" style={{ left: `${x(maintenant)}%` }} aria-hidden />
              <span className="absolute top-[50px] -translate-x-1/2 font-mono text-[9.5px] text-text-secondary" style={{ left: `${x(maintenant)}%` }} aria-hidden>
                {hhmm(maintenant)}
              </span>
            </>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-4 font-mono text-[9.5px] text-text-muted" aria-hidden>
            {heures.map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>
                {hhmm(t)}
              </span>
            ))}
          </div>
        </div>
        {!clos && (
          fiche.prochaine ? (
            <div className="mt-4 flex flex-wrap items-center gap-4 p-4" style={{ border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.06)' }} data-signal-groupe="prochaine-action">
              <div className="min-w-0 flex-1">
                <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.18em]" style={{ color: AMBRE }}>
                  La prochaine action{fiche.prochaine.avant ? ` · avant ${hhmm(fiche.prochaine.avant)}` : ''}
                </span>
                <span className="mt-1.5 block text-[14.5px] font-semibold text-text-primary">{fiche.prochaine.quoi}</span>
              </div>
              <button type="button" className="bx-btn2" onClick={() => ecrire({ actions: [...(fiche.actions ?? []), { id: `a${Date.now()}`, at: new Date().toISOString(), quoi: fiche.prochaine!.quoi, par: user?.email ?? '' }], prochaine: null })}>
                C’est fait
              </button>
              <Link to="/cyber/playbooks" className="bx-btn2">
                Ouvrir le playbook
              </Link>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2 border border-[#212525] p-3">
              <input value={prochaine.quoi} onChange={(e) => setProchaine({ ...prochaine, quoi: e.target.value })} placeholder="La prochaine action" aria-label="La prochaine action" className="h-9 min-w-0 flex-1 border border-[#2b3030] bg-transparent px-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]" />
              <input type="time" value={prochaine.avant} onChange={(e) => setProchaine({ ...prochaine, avant: e.target.value })} aria-label="Avant quelle heure" className="h-9 border border-[#2b3030] bg-transparent px-2 font-mono text-[13px] text-text-primary outline-none focus:border-[#8a8a87]" />
              <button type="button" className="bx-btn2" disabled={!prochaine.quoi.trim()} onClick={() => {
                const d = new Date();
                if (prochaine.avant) {
                  const [h, m] = prochaine.avant.split(':').map(Number);
                  d.setHours(h, m, 0, 0);
                } else d.setHours(d.getHours() + 2, 0, 0, 0);
                ecrire({ prochaine: { quoi: prochaine.quoi.trim(), avant: d.toISOString(), par: user?.email ?? null } });
                setProchaine({ quoi: '', avant: '' });
              }}>
                Poser la prochaine action
              </button>
            </div>
          )
        )}
        {!clos && (
          <div className="mt-3 flex gap-2">
            <input value={action} onChange={(e) => setAction(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' && action.trim()) {
                ecrire({ actions: [...(fiche.actions ?? []), { id: `a${Date.now()}`, at: new Date().toISOString(), quoi: action.trim(), par: user?.email ?? '' }] });
                setAction('');
              }
            }} placeholder="Noter ce qui vient d’être fait (Entrée)" aria-label="Noter ce qui vient d’être fait" className="h-9 min-w-0 flex-1 border border-[#2b3030] bg-transparent px-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]" />
          </div>
        )}
      </Carte>
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-3">
        <Carte titre="Éléments concernés" droite={(fiche.elements ?? []).length ? `${fiche.elements!.length}` : ''}>
          {(fiche.elements ?? []).map((e, i) => {
            const [type, valeur, etat] = e.split('|');
            return <Ligne key={i} colonnes="70px minmax(0,1fr) auto" a={type} b={valeur ?? ''} c={etat ?? ''} />;
          })}
          {inc.siteName && !(fiche.elements ?? []).length && <Ligne colonnes="70px minmax(0,1fr) auto" a="SITE" b={inc.siteName} c="concerné" />}
          <input value={element} onChange={(e) => setElement(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter' && element.trim()) {
              const [type, ...reste] = element.split(':');
              ecrire({ elements: [...(fiche.elements ?? []), `${type.trim().toUpperCase().slice(0, 8)}|${reste.join(':').trim() || type.trim()}|`] });
              setElement('');
            }
          }} placeholder="Compte : 3 comptes administrateurs" aria-label="Ajouter un élément concerné" className="mt-3 h-9 w-full border border-[#2b3030] bg-transparent px-3 text-[12.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]" />
        </Carte>
        <Carte titre="Notes d’enquête" droite={(fiche.notes ?? []).length || ''}>
          {(fiche.notes ?? []).map((n) => (
            <div key={n.id} className="mb-3">
              <p className="border-l border-[#3a3f3f] bg-[#131616] px-3.5 py-2.5 text-[13px] leading-relaxed text-text-body">{n.texte}</p>
              <span className="mt-1.5 block font-mono text-[9.5px] text-text-muted">
                {prenomDe(n.par).slice(0, 2).toUpperCase()} · {hhmm(n.at)}
              </span>
            </div>
          ))}
          <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter' && note.trim()) {
              ecrire({ notes: [...(fiche.notes ?? []), { id: `n${Date.now()}`, texte: note.trim(), par: user?.email ?? '', at: new Date().toISOString() }] });
              setNote('');
            }
          }} placeholder="Une note d’enquête (Entrée)" aria-label="Une note d’enquête" className="h-9 w-full border border-[#2b3030] bg-transparent px-3 text-[12.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]" />
        </Carte>
        <Carte titre="Clôture" droite={`${faites} sur ${cloture.length}`}>
          <ul className="flex flex-col gap-2">
            {cloture.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-3 text-[13px]">
                  <input type="checkbox" checked={c.fait} disabled={clos} onChange={() => ecrire({ cloture: cloture.map((x) => (x.id === c.id ? { ...x, fait: !x.fait } : x)) })} className="h-4 w-4 accent-[#8a8a87]" />
                  <span className={c.fait ? 'text-text-muted line-through' : 'text-text-body'}>{c.texte}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <Link to={`/cyber/rapports?incident=${id}`} className={`bx-btn2 ${faites < cloture.length - 1 ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={faites < cloture.length - 1}>
              Préparer le rapport
            </Link>
            {!clos && (
              <button type="button" className="bx-btn" disabled={reste > 0} onClick={() => void clore()}>
                Clore l’incident
              </button>
            )}
          </div>
        </Carte>
      </div>
    </>
  );
}

function Voie({ titre, y, points, x, prochaine = null }: { titre: string; y: number; points: Point[]; x: (t: number) => number; prochaine?: { at: number; x: number } | null }) {
  return (
    <div className="absolute left-0 right-0" style={{ top: y }}>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-secondary">{titre}</span>
      <div className="relative mt-2 h-px bg-[#3a3f3f]">
        {points.map((p, i) => (
          <span key={i} className="absolute -top-[4px]" style={{ left: `${x(p.at)}%` }}>
            <span className="block h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-text-body" />
            <span className="absolute left-0 top-3 w-[150px] -translate-x-[6px] text-[11.5px] leading-snug text-[#c9c9c6]" style={{ top: 12 + (i % 2) * 30 }}>
              {p.texte}
            </span>
          </span>
        ))}
        {prochaine && (
          <span className="absolute -top-[7px]" style={{ left: `${prochaine.x}%` }} data-signal-groupe="prochaine-action">
            <span className="block h-[15px] w-[15px] -translate-x-1/2 rounded-full border-2" style={{ borderColor: AMBRE, boxShadow: '0 0 12px rgba(208,154,74,.6)' }} />
          </span>
        )}
      </div>
    </div>
  );
}
