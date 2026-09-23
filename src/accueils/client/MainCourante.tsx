import React, { useState } from 'react';
import { EnTeteAccueil, SiPremierJour } from './communs';
import { hhmm, useJournee } from './journee';

/**
 * C3 · LA MAIN COURANTE (`40c`).
 *
 * Un registre vertical de la journée, une ligne par événement : heure en
 * mono, fait en 14 px, détail en 12,5 px. Le passé en encre éteinte, puis le
 * trait ambre « MAINTENANT », puis l'à-venir en encre pleine.
 *
 * Règles : toutes les familles mêlées (rendez-vous, interventions, appels,
 * temps pointé) dans l'ordre chronologique STRICT. Au-delà de douze lignes,
 * le PASSÉ se replie en tête (« 7 événements plus tôt ») ; l'à-venir ne se
 * replie jamais. Le trait descend quand un événement passe au passé.
 */
const LIGNES_MAX = 12;

export function MainCourante() {
  const j = useJournee(30_000);
  const [deplie, setDeplie] = useState(false);
  const t = j.maintenant.getTime();
  const passe = j.evenements.filter((e) => e.at.getTime() <= t);
  const avenir = j.evenements.filter((e) => e.at.getTime() > t);
  const place = Math.max(0, LIGNES_MAX - avenir.length);
  const replies = deplie ? 0 : Math.max(0, passe.length - place);
  const passeVisible = passe.slice(replies);

  const Ligne = ({ heure, fait, detail, vif }: { heure: string; fait: string; detail: string; vif: boolean }) => (
    <div className="grid grid-cols-[56px_minmax(0,1fr)] items-baseline gap-4 border-b border-border-row py-[9px] sm:grid-cols-[76px_minmax(0,1fr)] sm:gap-5">
      <span className={`tnum font-mono text-[12.5px] font-medium ${vif ? 'text-text-body' : 'text-text-muted'}`}>{heure}</span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-3.5 gap-y-0.5">
        <span className={`text-[14px] ${vif ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>{fait}</span>
        {detail && <span className={`text-[12.5px] ${vif ? 'text-text-secondary' : 'text-text-muted'}`}>{detail}</span>}
      </span>
    </div>
  );

  return (
    <SiPremierJour j={j}>
      <div className="flex flex-col gap-6">
        <EnTeteAccueil j={j} nom="La main courante" />
        <section className="panel-raised panel-raised-wide px-5 pb-[22px] pt-[26px] sm:px-[34px]">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="eyebrow text-text-secondary">La main courante du jour</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">Passé en encre éteinte · à venir en encre pleine</span>
          </div>
          {replies > 0 && (
            <button type="button" onClick={() => setDeplie(true)} className="mb-1 min-h-11 font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary md:min-h-0">
              {replies} événement{replies > 1 ? 's' : ''} plus tôt
            </button>
          )}
          {passeVisible.map((e) => (
            <Ligne key={e.cle} heure={hhmm(e.at)} fait={e.fait} detail={e.detail} vif={false} />
          ))}
          <div className="my-1 grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[76px_minmax(0,1fr)] sm:gap-5" data-signal-groupe="maintenant">
            <span className="tnum font-mono text-[13px] font-bold text-signal">{hhmm(j.maintenant)}</span>
            <span className="relative flex h-[30px] items-center">
              <span className="absolute inset-x-0 top-1/2 h-0.5 bg-signal shadow-[0_0_20px_-2px_rgba(208,154,74,.9)]" aria-hidden />
              <span className="relative bg-signal px-[9px] py-1 font-mono text-[9.5px] font-bold tracking-[0.16em] text-[#0a0a0a]">MAINTENANT</span>
            </span>
          </div>
          {avenir.map((e) => (
            <Ligne key={e.cle} heure={hhmm(e.at)} fait={e.fait} detail={e.detail} vif />
          ))}
          {avenir.length === 0 && <p className="py-3 text-[13.5px] text-text-secondary">Plus rien de prévu aujourd’hui.</p>}
        </section>
      </div>
    </SiPremierJour>
  );
}
