import React from 'react';
import { useCollection } from '../../state/SyncContext';
import { invoiceTotals } from '../../state/useInvoices';
import { EnTeteAccueil, SiPremierJour, euros } from './communs';
import { OUVERTURE, hhmm, useJournee } from './journee';

/**
 * C5 · LA SEMAINE DÉPLIÉE (`40e`).
 *
 * Les cinq jours ouvrés en colonnes ; AUJOURD'HUI s'étale sur 3,2 fois la
 * largeur des autres et détaille ses créneaux ; les autres jours se réduisent
 * à une jauge verticale de charge et un nombre de rendez-vous.
 *
 * Règles : le samedi n'apparaît que s'il porte au moins un rendez-vous. Les
 * jauges sont à la MÊME échelle : heures prises sur la journée ouvrée
 * (08 h → 20 h). L'ambre : le seul créneau d'aujourd'hui qui demande une
 * décision — celui de l'enjeu.
 */
const JOURS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
const JOURNEE_MIN = (OUVERTURE.finH - OUVERTURE.debutH) * 60;

interface Pointage {
  startedAt: string;
  endedAt: string;
}

function numeroSemaine(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - jour);
  const an = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - an.getTime()) / 86_400_000 + 1) / 7);
}

const heures = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${String(Math.round(min % 60)).padStart(2, '0')}` : ''}`;

export function SemaineDepliee() {
  const j = useJournee(60_000);
  const temps = useCollection<Pointage>('timeEntries');
  const t = j.maintenant.getTime();
  const lundi = j.semaine[0]?.date ?? j.maintenant;
  const dureeDe = (p: Pointage) => Math.max(0, ((p.endedAt ? new Date(p.endedAt).getTime() : t) - new Date(p.startedAt).getTime()) / 60_000);
  const pointeJour = temps.filter((p) => new Date(p.startedAt).toDateString() === j.maintenant.toDateString()).reduce((s, p) => s + dureeDe(p), 0);
  const pointeSemaine = temps.filter((p) => new Date(p.startedAt) >= lundi).reduce((s, p) => s + dureeDe(p), 0);
  const lundiIso = `${lundi.getFullYear()}-${String(lundi.getMonth() + 1).padStart(2, '0')}-${String(lundi.getDate()).padStart(2, '0')}`;
  const encaisseSemaine = j.invoices.filter((f) => f.kind !== 'creditNote' && f.status === 'paid' && f.paidAt >= lundiIso).reduce((s, f) => s + invoiceTotals(f).grossCents, 0);

  const colonne = (jour: (typeof j.semaine)[number]) => (
    <div key={jour.cle} className="flex min-w-0 flex-1 flex-col items-center gap-3 border border-border bg-[#0f0f0f] px-2 py-[18px] sm:px-3">
      <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-text-muted">
        {JOURS[jour.date.getDay()]} {jour.date.getDate()}
      </span>
      <span className="relative h-[120px] w-[18px] bg-raised sm:h-[180px]" aria-label={`${heures(jour.minutes)} prises`}>
        <span className="absolute inset-x-0 bottom-0 bg-border-strong" style={{ height: `${Math.min(100, (jour.minutes / JOURNEE_MIN) * 100)}%` }} />
      </span>
      <span className="tnum font-mono text-[13px] font-semibold text-text-secondary">{jour.rdv.length}</span>
      <span className="font-mono text-[9px] tracking-[0.1em] text-text-muted">RDV</span>
    </div>
  );

  const aujourdhui = j.semaine.find((x) => x.aujourdhui);
  const autres = j.semaine.filter((x) => !x.aujourdhui);
  const avant = autres.filter((x) => x.date < j.maintenant);
  const apres = autres.filter((x) => x.date > j.maintenant);

  const detail = aujourdhui ? (
    <div className="flex min-w-0 flex-col gap-[9px] border border-[#333] bg-[#171717] px-4 py-[18px] sm:px-5 md:flex-[3.2]">
      <span className="flex items-baseline justify-between gap-3">
        <span className="whitespace-nowrap font-mono text-[10px] font-bold tracking-[0.16em] text-text-primary">
          {JOURS[aujourdhui.date.getDay()]} {aujourdhui.date.getDate()} · AUJOURD’HUI
        </span>
        <span className="tnum whitespace-nowrap font-mono text-[11px] font-medium text-text-muted">{heures(pointeJour)} pointées</span>
      </span>
      {aujourdhui.rdv.length === 0 && <span className="text-[13.5px] text-text-secondary">Aucun rendez-vous aujourd’hui.</span>}
      {aujourdhui.rdv.map((a) => {
        const decision = j.enJeu?.rdv.id === a.id;
        const fait = new Date(a.startAt).getTime() + a.durationMin * 60_000 <= t;
        return (
          <span
            key={a.id}
            data-signal-groupe={decision ? 'creneau' : undefined}
            className={`grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 px-[11px] py-[9px] ${
              decision ? 'bg-signal shadow-[0_0_30px_-7px_rgba(208,154,74,.85)]' : 'border border-border bg-[#0f0f0f]'
            }`}
          >
            <span className={`tnum font-mono text-[12px] font-semibold ${decision ? 'text-[#0a0a0a]' : fait ? 'text-text-muted' : 'text-text-body'}`}>{hhmm(new Date(a.startAt))}</span>
            <span className={`min-w-0 text-[13.5px] font-semibold [overflow-wrap:anywhere] ${decision ? 'text-[#0a0a0a]' : fait ? 'text-text-muted' : 'text-text-primary'}`}>
              {a.clientName || a.title}
              {decision ? ` · ${j.enJeu?.motif === 'devis' ? 'devis' : 'facture'}` : ''}
            </span>
            <span className={`whitespace-nowrap font-mono text-[9.5px] font-semibold tracking-[0.1em] ${decision ? 'text-[#3a2a0e]' : 'text-text-muted'}`}>
              {decision ? 'DÉCISION' : fait ? 'FAIT' : 'À VENIR'}
            </span>
          </span>
        );
      })}
    </div>
  ) : null;

  return (
    <SiPremierJour j={j}>
      <div className="flex flex-col gap-6">
        <EnTeteAccueil j={j} nom="La semaine dépliée" />
        <section className="panel-raised panel-raised-wide px-4 py-6 sm:px-[26px]">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="eyebrow text-text-secondary">Semaine {numeroSemaine(j.maintenant)}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">Aujourd’hui déplié · les autres jours en jauge de charge</span>
          </div>
          {/* Au téléphone, aujourd'hui passe au-dessus et les jauges se rangent dessous. */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {detail}
            <div className="flex gap-2">{autres.map(colonne)}</div>
          </div>
          <div className="hidden items-stretch gap-2.5 md:flex">
            {avant.map(colonne)}
            {detail}
            {apres.map(colonne)}
          </div>
        </section>
        <section className="panel flex flex-wrap gap-[30px] px-[22px] py-4">
          {[
            ['Semaine', `${heures(pointeSemaine)} pointées`],
            ['Encaissé', euros(encaisseSemaine)],
            ['En retard', euros(j.retard.cents)],
          ].map(([l, v]) => (
            <span key={l}>
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{l}</span>
              <span className="tnum mt-1.5 block whitespace-nowrap font-mono text-[19px] font-semibold tracking-[-0.03em] text-text-primary">{v}</span>
            </span>
          ))}
        </section>
      </div>
    </SiPremierJour>
  );
}
