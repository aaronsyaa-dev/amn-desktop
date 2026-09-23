import React, { useEffect, useState } from 'react';
import { bridge } from '../../lib/bridge';
import { useRemoteSites } from '../../state/RemoteSitesContext';
import type { RemoteEvent } from '../../shared/api';
import { enLettres } from '../lettres';
import { EnTeteQG, SiGardeLue } from './communs';
import { hhmm, useQG } from './qg';
import { METEO, caseHoraire, centile95, palierMeteo, sitesAMontrer } from './parc';

/**
 * I7 · LA MÉTÉO DES SITES (`42g`).
 *
 * Une ligne par site, vingt-quatre cases horaires : plus la case est claire,
 * plus le site a mis de temps à répondre. Un site tombé a sa dernière case en
 * ambre et le verdict « SANS RÉPONSE ».
 *
 * La mesure : les sondes de disponibilité indépendantes d'amn-api (événements
 * `availability`, `payload.latencyMs`), la pire de l'heure pour chaque case.
 * Un site sans sonde (formule qui n'en a pas) n'a pas de météo : il est
 * compté en pied, pas dessiné vide comme s'il allait bien.
 *
 * Règles (ACCUEILS.md), dans `interne/parc` : quatre paliers bornés au 95ᵉ
 * centile du parc ; douze sites au plus, ceux qui ont un incident d'abord
 * puis les plus lents ; l'axe « HIER 16:00 → MAINTENANT » partage la grille.
 * L'ambre : les cases de l'heure en cours des sites qui ne répondent plus, et
 * leur verdict, dans la même colonne.
 */
const TEINTES = ['bg-border-row', 'bg-border-raised', 'bg-border-strong', 'bg-text-muted'] as const;

interface Ligne {
  id: string;
  nom: string;
  hote: string;
  cases: (number | null)[];
  incident: boolean;
  lenteur: number;
  tombeDepuis: Date | null;
}

export function Meteo() {
  const q = useQG(60_000);
  const { sites } = useRemoteSites();
  const [mesures, setMesures] = useState<Record<string, RemoteEvent[]>>({});
  const t = q.maintenant.getTime();
  const cleSites = sites.map((s) => s.id).join(',');

  useEffect(() => {
    let vivant = true;
    const since = new Date(Date.now() - METEO.cases * 3_600_000).toISOString();
    void Promise.allSettled(sites.map((s) => bridge().remote.getSiteEvents(s.id, { since, limit: 2000 }).then((e) => [s.id, e] as const))).then((r) => {
      if (!vivant) return;
      const m: Record<string, RemoteEvent[]> = {};
      for (const x of r) if (x.status === 'fulfilled') m[x.value[0]] = x.value[1].filter((e) => e.type === 'availability');
      setMesures(m);
    });
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recharger quand la liste des sites change, pas à chaque rendu
  }, [cleSites]);

  const lignes: Ligne[] = [];
  let sansSonde = 0;
  for (const s of sites) {
    const ev = (mesures[s.id] ?? []).slice().sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    if (!ev.length) {
      sansSonde += 1;
      continue;
    }
    const cases: (number | null)[] = Array(METEO.cases).fill(null);
    for (const e of ev) {
      const i = caseHoraire(Date.parse(e.occurredAt), t);
      const ok = e.payload.ok !== false;
      const lat = ok && typeof e.payload.latencyMs === 'number' ? (e.payload.latencyMs as number) : null;
      if (i !== null && lat !== null) cases[i] = Math.max(cases[i] ?? 0, lat);
    }
    const dernier = ev[ev.length - 1];
    const incident = dernier.payload.ok === false;
    let tombeDepuis: Date | null = null;
    if (incident) {
      tombeDepuis = new Date(dernier.occurredAt);
      for (let k = ev.length - 1; k >= 0 && ev[k].payload.ok === false; k--) tombeDepuis = new Date(ev[k].occurredAt);
    }
    const vals = cases.filter((c): c is number => c !== null);
    lignes.push({ id: s.id, nom: s.name, hote: s.url ? s.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '', cases, incident, lenteur: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, tombeDepuis });
  }
  const p95 = centile95(lignes.flatMap((l) => l.cases.filter((c): c is number => c !== null))) ?? 0;
  const { montres, autres } = sitesAMontrer(lignes);
  const tombes = lignes.filter((l) => l.incident);
  const debutAxe = new Date(t - (METEO.cases - 1) * 3_600_000);
  debutAxe.setMinutes(0, 0, 0);
  const milieu = new Date(debutAxe.getTime() + 12 * 3_600_000);
  const depuis = tombes.length ? new Date(Math.min(...tombes.map((l) => l.tombeDepuis?.getTime() ?? t))) : null;
  const calmes = lignes.length - tombes.length;

  const phrase = [
    tombes.length === 1 ? `${tombes[0].nom} ne répond plus depuis ${hhmm(depuis as Date)}.` : tombes.length > 1 ? `${enLettres(tombes.length).replace(/^./, (c) => c.toUpperCase())} sites ne répondent plus depuis ${hhmm(depuis as Date)}.` : null,
    calmes === 1 ? (tombes.length ? 'L’autre site répond.' : 'Le site répond.') : calmes > 1 ? `Les ${enLettres(calmes)} ${tombes.length ? 'autres ' : ''}sites répondent.` : null,
    autres > 0 ? `${enLettres(autres).replace(/^./, (c) => c.toUpperCase())} ne sont pas dessinés : l’Accueil en montre douze.` : null,
    sansSonde > 0 ? `${sansSonde === 1 ? 'Un site n’a' : `${enLettres(sansSonde).replace(/^./, (c) => c.toUpperCase())} sites n’ont`} pas de sonde de disponibilité.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <SiGardeLue q={q}>
      <div className="flex flex-col gap-6">
        <EnTeteQG q={q} nom="La météo des sites" />
        <section className="panel-raised panel-raised-wide px-4 pb-[22px] pt-[26px] sm:px-7">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="eyebrow text-text-secondary">Les sites · vingt-quatre heures</span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
              CASE CLAIRE = RÉPONSE LENTE · {montres.length} SITE{montres.length > 1 ? 'S' : ''} SUR {sites.length}
            </span>
          </div>
          {montres.length === 0 && <p className="text-[13.5px] text-text-secondary">Aucune mesure de disponibilité dans les dernières vingt-quatre heures.</p>}
          {montres.map((l) => (
            <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 py-1 md:grid-cols-[170px_minmax(0,1fr)_92px]">
              <span className="min-w-0">
                <span className={`block truncate text-[12.5px] font-semibold ${l.incident ? 'text-text-primary' : 'text-text-body'}`}>{l.nom}</span>
                {l.hote && l.hote !== l.nom && <span className="block truncate font-mono text-[9px] tracking-[0.08em] text-text-muted">{l.hote}</span>}
              </span>
              <span
                data-signal-groupe={l.incident ? 'tombes' : undefined}
                className={`tnum whitespace-nowrap text-right font-mono text-[10.5px] md:order-last ${l.incident ? 'font-bold text-signal' : 'text-text-muted'}`}
              >
                {l.incident ? 'SANS RÉPONSE' : 'ok'}
              </span>
              <span className="col-span-2 grid h-5 grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5 md:col-span-1">
                {l.cases.map((c, i) =>
                  l.incident && i === METEO.cases - 1 ? (
                    <span key={i} data-signal-groupe="tombes" className="bg-signal shadow-[0_0_16px_-2px_rgba(208,154,74,.9)]" />
                  ) : (
                    <span key={i} className={c === null ? 'border border-border-row' : TEINTES[palierMeteo(c, p95)]} />
                  ),
                )}
              </span>
            </div>
          ))}
          {montres.length > 0 && (
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-3.5 md:grid-cols-[170px_minmax(0,1fr)_92px]">
              <span className="hidden md:block" />
              <span className="flex justify-between font-mono text-[9.5px] tracking-[0.08em] text-text-muted">
                <span>HIER {hhmm(debutAxe)}</span>
                <span>{hhmm(milieu)}</span>
                <span>MAINTENANT</span>
              </span>
            </div>
          )}
          {phrase && <p className="mt-4 border-t border-border-raised pt-3.5 text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">{phrase}</p>}
        </section>
      </div>
    </SiGardeLue>
  );
}
