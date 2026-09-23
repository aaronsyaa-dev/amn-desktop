import React from 'react';
import { Link } from 'react-router-dom';
import { EnTeteAccueil, SiPremierJour } from './communs';
import { type ActionDuJour, hhmm, useJournee } from './journee';

/**
 * C4 · LA FILE UNIQUE (`40d`).
 *
 * Une seule liste ordonnée des actions du jour, où LA TAILLE ENCODE LE RANG :
 * la première occupe un bandeau de 124 px avec un numéro de 72 px et son
 * action ; puis 19, 17, 15, 14, 13 px. L'argent, le stock et les rendez-vous
 * rangés ensemble par ce qui presse, sans catégories.
 *
 * Règles : six rangs au plus ; le rang est CALCULÉ (`useJournee`), jamais
 * réordonné à la main ; la décroissance est fixe et ne dépend pas du nombre
 * d'actions.
 */
const RANGS = 6;
const TAILLES = [19, 17, 15, 14, 13];
const NUMEROS = [17, 15, 13, 12, 11];

export function FileUnique() {
  const j = useJournee(30_000);
  /* Les rendez-vous de routine à venir ferment la file : ils ont une heure, mais rien à trancher. */
  const routine: ActionDuJour[] = j.aVenir
    .filter((a) => !j.enjeuDeRdv(a) && new Date(a.startAt) > j.maintenant)
    .map((a) => ({ cle: `rdv-${a.id}`, titre: a.title || `Rendez-vous ${a.clientName}`, detail: `${hhmm(new Date(a.startAt))} · ${a.clientName}`, to: '/agenda', geste: 'Ouvrir', poids: 1 }));
  const file = [...j.actions, ...routine].slice(0, RANGS);
  const [premiere, ...suite] = file;

  return (
    <SiPremierJour j={j}>
      <div className="flex flex-col gap-6">
        <EnTeteAccueil j={j} nom="La file unique" />
        <section className="panel-raised panel-raised-wide pb-3 pt-[22px]">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 sm:px-7">
            <span className="eyebrow text-text-secondary">Aujourd’hui, dans l’ordre</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{file.length} action{file.length > 1 ? 's' : ''} · la taille suit le rang</span>
          </div>
          {!premiere ? (
            <p className="px-5 pb-4 text-[15px] text-text-secondary sm:px-7">Rien à faire aujourd’hui qui ne puisse attendre.</p>
          ) : (
            <>
              <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-5 gap-y-4 border border-[#333] bg-[#171717] px-5 py-[26px] sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:gap-6 sm:px-7">
                <span
                  className="tnum flex h-[72px] w-[72px] items-center justify-center bg-signal font-mono text-[34px] font-bold text-[#0a0a0a] shadow-[0_0_30px_-7px_rgba(208,154,74,.85)]"
                  data-signal-groupe="rang-1"
                >
                  1
                </span>
                <span className="min-w-0">
                  <span className="block text-[22px] font-bold leading-[1.15] tracking-[-0.025em] text-text-primary [text-wrap:pretty] sm:text-[28px]">{premiere.titre}</span>
                  <span className="mt-2 block text-[14px] leading-[1.55] text-text-secondary [text-wrap:pretty]">{premiere.detail}</span>
                </span>
                <Link
                  to={premiere.to}
                  className="col-span-2 flex min-h-11 items-center justify-center bg-text-primary px-[13px] text-[12.5px] font-semibold text-[#0a0a0a] shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] sm:col-span-1 sm:min-h-[30px]"
                >
                  {premiere.geste}
                </Link>
              </div>
              {suite.map((a, i) => (
                <Link
                  key={a.cle}
                  to={a.to}
                  className={`grid grid-cols-[40px_minmax(0,1fr)] items-baseline gap-4 border-b border-[#1a1a1a] px-5 transition-colors hover:bg-surface-hover sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-6 sm:px-7 ${i < 2 ? 'py-3.5' : 'py-2.5'}`}
                >
                  <span className="tnum text-center font-mono font-semibold text-text-muted" style={{ fontSize: NUMEROS[i] }}>
                    {i + 2}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-0.5">
                    <span className={`font-semibold ${i < 2 ? 'text-text-body' : 'text-text-secondary'}`} style={{ fontSize: TAILLES[i] }}>
                      {a.titre}
                    </span>
                    <span className="text-[12.5px] text-text-muted">{a.detail}</span>
                  </span>
                </Link>
              ))}
            </>
          )}
        </section>
      </div>
    </SiPremierJour>
  );
}
