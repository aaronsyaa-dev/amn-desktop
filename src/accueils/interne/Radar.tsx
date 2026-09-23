import React from 'react';
import { EnTeteQG, SiGardeLue } from './communs';
import { enLettres } from '../lettres';
import { useQG } from './qg';
import { RADAR, cheminSecteur, angleSecteur, ordreFixe, pointsDuDossier, pointsDuSecteur, surRadar } from './parc';
import type { GardeGravite } from '../../shared/garde';

/**
 * I4 · LE RADAR (`42d`).
 *
 * Un secteur par organisation et trois cercles — critique au centre, haute,
 * normale au bord. Chaque dossier ouvert est un point placé dans son secteur
 * à la distance de sa gravité : plus il est près du centre, plus il est grave.
 *
 * Règles (ACCUEILS.md), dans `interne/parc` : un point vaut UN JOUR de
 * dossier ouvert, pas une remontée ; les noms sont posés sur un rayon
 * extérieur au cercle, avec un `viewBox` qui leur laisse de la marge.
 * L'ambre : le secteur de l'organisation critique, ses points et son nom.
 *
 * Un dossier sans organisation (la Garde elle-même) est rangé dans le
 * secteur de l'organisation interne.
 */
const LIBELLE: Record<GardeGravite, [string, string]> = { critique: ['Critique', 'CERCLE INTÉRIEUR'], haute: ['Haute', 'DEUXIÈME CERCLE'], normale: ['Normale', 'BORD'] };
const court = (nom: string) => (nom.length > 16 ? `${nom.slice(0, 15)}…` : nom);

export function Radar() {
  const q = useQG();
  const t = q.maintenant.getTime();
  const orgs = ordreFixe(q.organisations);
  const n = Math.max(1, orgs.length);
  const interne = orgs.find((o) => o.plan === 'internal')?.id ?? null;
  const dossiers = (q.accueil?.pile.dossiers ?? []).map((d) => ({ ...d, org: d.orgId ?? interne, points: pointsDuDossier(d.depuis, t) }));
  const critique = orgs.find((o) => dossiers.some((d) => d.org === o.id && d.gravite === 'critique'))?.id ?? null;
  const exemple = dossiers.find((d) => d.org === critique && d.gravite === 'critique');

  const V = 2 * RADAR.c + 2 * RADAR.marge;

  return (
    <SiGardeLue q={q}>
      <div className="flex flex-col gap-6">
        <EnTeteQG q={q} nom="Le radar" />
        <section className="panel-raised panel-raised-wide grid items-center gap-8 px-4 py-[26px] sm:px-[30px] lg:grid-cols-[480px_minmax(0,1fr)]">
          <svg viewBox={`${-RADAR.marge} ${-RADAR.marge} ${V} ${V}`} className="mx-auto block aspect-square w-full max-w-[480px] overflow-visible" role="img" aria-label="Radar des dossiers ouverts">
            {[RADAR.rCritique, RADAR.rHaute].map((r) => (
              <circle key={r} cx={RADAR.c} cy={RADAR.c} r={r} fill="none" stroke="var(--color-border-raised)" strokeDasharray="3 5" />
            ))}
            <circle cx={RADAR.c} cy={RADAR.c} r={RADAR.rBord} fill="none" stroke="var(--color-border-raised)" />
            {orgs.map((o, i) =>
              o.id === critique ? (
                <path key={o.id} data-signal-groupe="secteur" d={cheminSecteur(i, n)} fill="rgba(208,154,74,.16)" stroke="var(--color-signal)" strokeWidth="1.6" />
              ) : (
                <path key={o.id} d={cheminSecteur(i, n)} fill="none" stroke="var(--color-border)" strokeWidth="1" />
              ),
            )}
            {orgs.flatMap((o, i) =>
              pointsDuSecteur(i, n, dossiers.filter((d) => d.org === o.id)).map((p, k) => (
                <circle
                  key={`${o.id}-${k}`}
                  cx={p.x.toFixed(1)}
                  cy={p.y.toFixed(1)}
                  r={p.gravite === 'critique' ? 6 : 4.5}
                  data-signal-groupe={o.id === critique ? 'secteur' : undefined}
                  fill={o.id === critique ? 'var(--color-signal)' : p.gravite === 'normale' ? 'var(--color-border-strong)' : 'var(--color-text-body)'}
                />
              )),
            )}
            {orgs.map((o, i) => {
              const [x, y] = surRadar(angleSecteur(i, n) + 180 / n, RADAR.rNoms);
              return (
                <text
                  key={o.id}
                  x={x.toFixed(1)}
                  y={(y + 3).toFixed(1)}
                  textAnchor={x > RADAR.c + 20 ? 'start' : x < RADAR.c - 20 ? 'end' : 'middle'}
                  fill={o.id === critique ? 'var(--color-signal)' : 'var(--color-text-muted)'}
                  data-signal-groupe={o.id === critique ? 'secteur' : undefined}
                  fontFamily="JetBrains Mono, monospace"
                  fontSize="10"
                >
                  {court(o.name)}
                </text>
              );
            })}
            <circle cx={RADAR.c} cy={RADAR.c} r="3" fill="#4a4a48" />
          </svg>

          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="eyebrow text-text-secondary">Les dossiers ouverts</span>
              <span className="whitespace-nowrap font-mono text-[10px] tracking-[0.1em] text-text-muted">CENTRE = CRITIQUE</span>
            </div>
            {(['critique', 'haute', 'normale'] as GardeGravite[]).map((g) => {
              const siens = dossiers.filter((d) => d.gravite === g);
              const remontees = siens.reduce((s, d) => s + d.n, 0);
              const nOrg = new Set(siens.map((d) => d.org)).size;
              return (
                <div key={g} className="grid grid-cols-[90px_minmax(0,1fr)] gap-3.5 border-b border-[#1a1a1a] py-[11px]">
                  <span className="text-[13.5px] font-semibold text-text-primary">{LIBELLE[g][0]}</span>
                  <span>
                    <span className="block text-[13px] text-text-secondary">
                      {remontees === 0 ? 'aucune' : `${remontees} · ${nOrg === 1 ? 'une seule organisation' : `${enLettres(nOrg)} organisations`}`}
                    </span>
                    <span className="mt-[3px] block font-mono text-[10px] tracking-[0.1em] text-text-muted">{LIBELLE[g][1]}</span>
                  </span>
                </div>
              );
            })}
            <p className="mt-4 text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
              {exemple && exemple.n > 1
                ? `Un point vaut un jour de dossier ouvert, pas une remontée : les ${exemple.n} situations de ${exemple.orgNom ?? 'la Garde'} forment un seul dossier, ouvert depuis ${enLettres(exemple.points)} jour${exemple.points > 1 ? 's' : ''}, donc ${enLettres(exemple.points)} point${exemple.points > 1 ? 's' : ''}.`
                : 'Un point vaut un jour de dossier ouvert, pas une remontée. Un parc calme laisse le centre vide.'}
            </p>
          </div>
        </section>
      </div>
    </SiGardeLue>
  );
}
