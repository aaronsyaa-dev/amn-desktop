import React from 'react';
import { Link } from 'react-router-dom';
import { appointmentEnd } from '../../state/useAppointments';
import { EnTeteAccueil, SiPremierJour, duree, euros } from './communs';
import { hhmm, useJournee } from './journee';

/**
 * C1 · LA PROCHAINE HEURE (`40a`).
 *
 * Un compte à rebours de 132 px jusqu'au prochain rendez-vous QUI DEMANDE UNE
 * DÉCISION, avec sous lui une barre fine qui mesure l'intervalle écoulé
 * depuis la fin du rendez-vous précédent. À droite, le rendez-vous lui-même.
 *
 * Règles (ACCUEILS.md) : le compte vise le prochain rendez-vous À ENJEU — un
 * rendez-vous de routine est sauté. Aucun dans les trois heures : « Rien
 * avant 19:00 » en encre claire, et pas d'ambre. Sous 60 min l'unité est la
 * minute ; au-delà, « 2 h 10 ». Le compte décroît à la minute.
 */
const FENETRE_H = 3;

export function ProchaineHeure() {
  const j = useJournee(15_000);
  const t = j.maintenant.getTime();
  const cible = j.aVenir.find((a) => new Date(a.startAt).getTime() > t && new Date(a.startAt).getTime() - t <= FENETRE_H * 3_600_000 && j.enjeuDeRdv(a)) ?? null;
  const enjeu = cible ? j.enjeuDeRdv(cible) : null;
  /* Sans cible : le prochain rendez-vous tout court reste à droite, en encre claire. */
  const aDroite = cible ?? j.aVenir.find((a) => new Date(a.startAt).getTime() > t) ?? null;
  const ensuite = aDroite ? j.aVenir.find((a) => a.startAt > aDroite.startAt) ?? null : null;

  const debutCible = cible ? new Date(cible.startAt) : null;
  const finPrec = cible ? j.finPrecedent(cible) : null;
  const part = cible && finPrec && debutCible ? Math.min(1, Math.max(0, (t - finPrec.getTime()) / Math.max(1, debutCible.getTime() - finPrec.getTime()))) : 0;
  const d = debutCible ? duree((debutCible.getTime() - t) / 60_000) : null;
  /* « Rien avant 19:00 » : jusqu'au prochain enjeu s'il en existe un plus tard, sinon la fin de la fenêtre. */
  const plusTard = j.aVenir.find((a) => j.enjeuDeRdv(a) && new Date(a.startAt).getTime() > t);
  const rienAvant = plusTard ? new Date(plusTard.startAt) : new Date(Math.ceil((t + FENETRE_H * 3_600_000) / 3_600_000) * 3_600_000);

  const phrase = enjeu
    ? enjeu.motif === 'devis'
      ? `Remise en main propre du devis « ${enjeu.devis?.title ?? ''} », ${enjeu.jours ?? '?'} jour${(enjeu.jours ?? 0) > 1 ? 's' : ''} sans réponse.`
      : `Une facture de ce client est échue depuis ${enjeu.jours ?? '?'} jour${(enjeu.jours ?? 0) > 1 ? 's' : ''} : le rendez-vous est l’occasion d’en parler.`
    : aDroite?.notes?.trim() || aDroite?.location?.trim() || '';

  return (
    <SiPremierJour j={j}>
      <div className="flex flex-col gap-6">
        <EnTeteAccueil j={j} nom="La prochaine heure" />

        <section className="panel-raised panel-raised-wide grid items-center gap-8 px-6 pb-[30px] pt-[34px] sm:px-9 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-11">
          <div className="min-w-0">
            {cible && d ? (
              <div data-signal-groupe="compte">
                <span className="block font-mono text-[10px] font-bold tracking-[0.2em] text-signal">DANS</span>
                <span className="tnum mt-2.5 block font-mono text-[84px] font-bold leading-[0.82] tracking-[-0.07em] text-signal sm:text-[132px]">
                  {d.nombre}
                  {d.unite && <span className="ml-2.5 text-[30px] tracking-[-0.03em] sm:text-[46px]">{d.unite}</span>}
                </span>
              </div>
            ) : (
              <>
                <span className="block font-mono text-[10px] font-bold tracking-[0.2em] text-text-muted">RIEN AVANT</span>
                <span className="tnum mt-2.5 block font-mono text-[64px] font-bold leading-[0.9] tracking-[-0.05em] text-text-primary sm:text-[96px]">{hhmm(rienAvant)}</span>
              </>
            )}
            {cible && finPrec && (
              <>
                <div className="mt-6 h-1.5 bg-[#191919]">
                  <span className="block h-1.5 bg-border-strong" style={{ width: `${Math.round(part * 100)}%` }} />
                </div>
                <div className="mt-2 flex justify-between gap-3 whitespace-nowrap font-mono text-[9.5px] tracking-[0.1em] text-text-muted">
                  <span>FIN DU PRÉCÉDENT · {hhmm(finPrec)}</span>
                  <span>{hhmm(new Date(cible.startAt))}</span>
                </div>
              </>
            )}
          </div>

          <div className="min-w-0">
            {aDroite ? (
              <>
                <span className="tnum block font-mono text-[15px] font-semibold text-text-primary">
                  {hhmm(new Date(aDroite.startAt))} → {hhmm(appointmentEnd(aDroite))}
                </span>
                <span className="mt-2.5 block text-[24px] font-bold leading-[1.1] tracking-[-0.025em] text-text-primary [overflow-wrap:anywhere] sm:text-[30px]">
                  {aDroite.clientName || aDroite.title}
                </span>
                {phrase && <p className="mt-3 text-[14.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">{phrase}</p>}
                <div className="mt-5 flex flex-wrap gap-[9px]">
                  {enjeu && (
                    <Link
                      to={enjeu.motif === 'devis' ? '/facturation/devis' : '/facturation'}
                      className="flex min-h-11 items-center bg-text-primary px-[13px] text-[12.5px] font-semibold text-[#0a0a0a] shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] sm:min-h-[30px]"
                    >
                      {enjeu.motif === 'devis' ? 'Ouvrir le devis' : 'Ouvrir la facture'}
                    </Link>
                  )}
                  {aDroite.location?.trim() && (
                    <a
                      href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(aDroite.location)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-11 items-center border border-border-strong px-[13px] text-[12.5px] font-semibold text-text-body sm:min-h-[30px]"
                    >
                      Itinéraire
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[15px] leading-relaxed text-text-secondary">Plus aucun rendez-vous aujourd’hui.</p>
            )}
          </div>
        </section>

        <section className="panel flex flex-wrap items-center gap-x-[26px] gap-y-2 px-[22px] py-4">
          <span className="font-mono text-[9.5px] tracking-[0.14em] text-text-muted">ENSUITE</span>
          <span className="text-[13.5px] text-text-body">
            {ensuite ? (
              <>
                <span className="tnum font-mono text-text-secondary">{hhmm(new Date(ensuite.startAt))}</span> · {ensuite.clientName || ensuite.title}
              </>
            ) : (
              'plus rien après'
            )}
          </span>
          <span className="hidden h-3.5 w-px bg-border-raised sm:block" aria-hidden />
          {j.retard.n > 0 && (
            <Link to="/relances" className="text-[13.5px] text-text-secondary hover:text-text-primary">
              {j.retard.n} facture{j.retard.n > 1 ? 's' : ''} en retard · {euros(j.retard.cents)}
            </Link>
          )}
          {j.ruptures[0] && (
            <Link to="/stock" className="text-[13.5px] text-text-secondary hover:text-text-primary">
              {j.ruptures[0].name} en rupture
            </Link>
          )}
          <span className="text-[13px] text-text-muted sm:ml-auto">{euros(j.encaisseJour)} encaissés aujourd’hui</span>
        </section>
      </div>
    </SiPremierJour>
  );
}
