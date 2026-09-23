import React from 'react';
import { Link } from 'react-router-dom';
import type { GardeRemontee } from '../../shared/garde';
import { EnTeteQG, SiGardeLue, nomOrg } from './communs';
import { hhmm, useQG } from './qg';

/**
 * I3 · LE FIL (`42c`).
 *
 * Le flux des remontées, du plus récent au plus ancien : heure, gravité,
 * phrase, organisation. Le critique est ÉPINGLÉ en tête, au-dessus d'un
 * filet, et ne défile pas ; la pastille « EN DIRECT » bat.
 *
 * Règles (ACCUEILS.md) : une seule dépêche épinglée à la fois — la plus
 * ancienne des critiques ouvertes. Le fil s'arrête à trente lignes ; les
 * remontées « normales » de plus de 24 h n'y figurent plus.
 *
 * Les autres situations du dossier épinglé (deux cents incidents regroupés)
 * ne sont pas répétées dans le fil : l'épingle les représente toutes.
 */
export const FIL_MAX = 30;
const JOUR = 86_400_000;
const famille = (cle: string) => cle.split(':')[0];
const memeDossier = (a: GardeRemontee, b: GardeRemontee) => a.agent === b.agent && famille(a.cle) === famille(b.cle) && (a.orgId ?? null) === (b.orgId ?? null);

export function Fil() {
  const q = useQG(15_000);
  const t = q.maintenant.getTime();
  const critiques = q.remontees.filter((r) => r.etat === 'ouverte' && r.gravite === 'critique');
  const epingle = critiques.reduce<GardeRemontee | null>((m, r) => (!m || r.createdAt < m.createdAt ? r : m), null);
  const dossierEpingle = epingle ? (q.accueil?.pile.dossiers ?? []).find((d) => d.remontees.includes(epingle.id)) ?? null : null;

  const fil = q.remontees
    .filter((r) => !(epingle && memeDossier(r, epingle)))
    .filter((r) => !(r.gravite === 'normale' && t - new Date(r.createdAt).getTime() > JOUR))
    .slice(0, FIL_MAX);

  const age = (iso: string) => {
    const j = Math.floor((t - new Date(iso).getTime()) / JOUR);
    return j >= 1 ? `${j} j` : hhmm(new Date(iso));
  };

  /* L'heure pour aujourd'hui ; « hier » ou « 3 j » au-delà — une heure seule mentirait sur le jour. */
  const quand = (iso: string) => {
    const d = new Date(iso);
    if (d.toDateString() === q.maintenant.toDateString()) return hhmm(d);
    const hier = new Date(q.maintenant);
    hier.setDate(hier.getDate() - 1);
    return d.toDateString() === hier.toDateString() ? 'hier' : `${Math.max(1, Math.floor((t - d.getTime()) / JOUR))} j`;
  };

  return (
    <SiGardeLue q={q}>
      <div className="flex flex-col gap-6">
        <EnTeteQG q={q} nom="Le fil" />
        <section className="panel-raised panel-raised-wide px-4 py-6 sm:px-7">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="eyebrow text-text-secondary">Le fil des remontées</span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">EN DIRECT · LE CRITIQUE RESTE ÉPINGLÉ</span>
          </div>
          {epingle && (
            <Link
              to="/garde/pile"
              data-signal-groupe="epingle"
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 bg-signal px-4 py-3.5 shadow-[0_0_30px_-7px_rgba(208,154,74,.85)] md:grid-cols-[62px_86px_minmax(0,1fr)_auto]"
            >
              <span className="hidden font-mono text-[9.5px] font-bold tracking-[0.14em] text-[#3a2a0e] md:inline">ÉPINGLÉ</span>
              <span className="hidden font-mono text-[9.5px] font-bold tracking-[0.12em] text-[#3a2a0e] md:inline">CRITIQUE</span>
              <span className="text-[14.5px] font-semibold text-[#080808]">{(dossierEpingle?.titre ?? epingle.titre).replace(/\.$/, '')}</span>
              <span className="whitespace-nowrap text-[12.5px] text-[#3a2a0e]">
                {nomOrg(q, epingle.orgId, dossierEpingle?.orgNom)} · {age(epingle.createdAt)}
              </span>
            </Link>
          )}
          <div className="mb-1 mt-3.5 h-px bg-[#333]" />
          <div className="flex items-center gap-2 py-1.5">
            <span className="h-[5px] w-[5px] rounded-full anneau-courant bg-text-primary" />
            <span className="font-mono text-[10px] tracking-[0.12em] text-text-muted">EN DIRECT</span>
          </div>
          {fil.length === 0 && <p className="py-3 text-[13.5px] text-text-secondary">Aucune remontée dans les dernières vingt-quatre heures.</p>}
          {fil.map((r) => {
            const vive = r.gravite !== 'normale';
            return (
              <div key={r.id} className="grid grid-cols-[48px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-0.5 border-b border-border-row py-[9px] md:grid-cols-[62px_86px_minmax(0,1fr)_170px]">
                <span className="tnum font-mono text-[11.5px] font-medium text-text-muted">{quand(r.createdAt)}</span>
                <span className={`hidden font-mono text-[9.5px] font-semibold tracking-[0.12em] md:inline ${vive ? 'text-text-body' : 'text-text-muted'}`}>{r.gravite.toUpperCase()}</span>
                <span className={`truncate text-[13.5px] ${vive ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {r.titre.replace(/\.$/, '')}
                  {r.etat !== 'ouverte' ? ` · ${r.etat === 'resolue' ? 'résolue' : r.etat === 'decidee' ? 'décidée' : 'ignorée'}` : ''}
                </span>
                <span className="col-start-2 truncate text-[12px] text-text-muted md:col-start-auto md:text-right">{r.orgId ? nomOrg(q, r.orgId) : 'La Garde'}</span>
              </div>
            );
          })}
        </section>
      </div>
    </SiGardeLue>
  );
}
