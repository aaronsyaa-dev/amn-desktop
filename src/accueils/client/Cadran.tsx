import React from 'react';
import { appointmentEnd, type Appointment } from '../../state/useAppointments';
import { EnTeteAccueil, SiPremierJour, enLettres } from './communs';
import { OUVERTURE, hhmm, useJournee } from './journee';
import { CADRAN, CIRCONFERENCE, arcCadran, pointCadran, surLeCadran as surCadran } from '../formules';

/**
 * C6 · LE CADRAN (`40f`).
 *
 * Un cadran de douze heures, de 08 h en haut à 20 h au même point. Chaque
 * rendez-vous est un arc de 22 px, à sa vraie place et à sa vraie durée ;
 * une aiguille marque l'heure qu'il est, écrite sous le moyeu. La légende en
 * regard nomme les arcs.
 *
 * Règles (ACCUEILS.md), littéralement :
 *   · les arcs sont des `stroke-dasharray` sur un cercle :
 *       longueur = durée × (2πr / 12)
 *       décalage = −(début − 8) × (2πr / 12)
 *   · le `viewBox` laisse 40 px de marge autour du cercle pour les graduations ;
 *   · un rendez-vous hors de 08 h–20 h n'apparaît pas sur le cadran et est
 *     signalé en légende.
 * L'ambre : l'arc du rendez-vous à enjeu et son heure dans la légende.
 */
const { r: R, c: C, marge: MARGE, epaisseur: EPAISSEUR } = CADRAN;
const HEURES = (d: Date) => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
const point = pointCadran;
const f = (n: number) => n.toFixed(1);
const surLeCadran = (a: Appointment) => surCadran(HEURES(new Date(a.startAt)), a.durationMin / 60);
const arc = (a: Appointment) => arcCadran(HEURES(new Date(a.startAt)), a.durationMin / 60);

export function Cadran() {
  const j = useJournee(10_000);
  const t = j.maintenant.getTime();
  const h = HEURES(j.maintenant);
  const enjeu = j.enJeu?.rdv.id ?? null;
  const fini = (a: Appointment) => appointmentEnd(a).getTime() <= t;

  /* Le premier creux : le premier intervalle d'au moins 30 min entre deux rendez-vous à venir. */
  const aVenir = j.duJour.filter((a) => !fini(a));
  let creux: { de: Date; a: Date } | null = null;
  for (let i = 0; i + 1 < aVenir.length && !creux; i++) {
    const de = new Date(Math.max(appointmentEnd(aVenir[i]).getTime(), t));
    const a = new Date(aVenir[i + 1].startAt);
    if (a.getTime() - de.getTime() >= 30 * 60_000) creux = { de, a };
  }
  const dernier = aVenir[aVenir.length - 1];
  const phrase = creux
    ? `Un trou de ${enLettres((creux.a.getTime() - creux.de.getTime()) / 60_000)} minutes entre ${hhmm(creux.de)} et ${hhmm(creux.a)} : de quoi avancer ce qui attend sans se presser.`
    : dernier
      ? `Pas de creux d’ici ${hhmm(appointmentEnd(dernier))}${appointmentEnd(dernier).getHours() < OUVERTURE.finH ? ' ; la fin de journée est libre.' : '.'}`
      : 'Plus aucun rendez-vous : le reste de la journée est libre.';

  const aiguille = h >= OUVERTURE.debutH && h <= OUVERTURE.finH ? point(h, 122) : null;

  return (
    <SiPremierJour j={j}>
      <div className="flex flex-col gap-6">
        <EnTeteAccueil j={j} nom="Le cadran" />
        <section className="panel-raised panel-raised-wide grid items-center gap-9 px-5 py-[30px] sm:px-[34px] lg:grid-cols-[440px_minmax(0,1fr)]">
          <div className="relative mx-auto aspect-square w-full max-w-[440px]">
            <svg viewBox={`${-MARGE} ${-MARGE} ${2 * C + 2 * MARGE} ${2 * C + 2 * MARGE}`} className="block h-full w-full overflow-visible" role="img" aria-label={`Cadran de la journée, ${hhmm(j.maintenant)}`}>
              <circle cx={C} cy={C} r={R} fill="none" stroke="var(--color-border-row)" strokeWidth={EPAISSEUR} />
              {Array.from({ length: 12 }, (_, i) => {
                const [x1, y1] = point(OUVERTURE.debutH + i, R + EPAISSEUR / 2 + 7);
                const [x2, y2] = point(OUVERTURE.debutH + i, R + EPAISSEUR / 2 + 15);
                return <path key={i} d={`M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`} stroke="var(--color-border-strong)" strokeWidth="2" />;
              })}
              {[0, 3, 6, 9].map((i) => {
                const [x, y] = point(OUVERTURE.debutH + i, R + 46);
                return (
                  <text key={i} x={f(x)} y={f(y + 4)} textAnchor="middle" fill="var(--color-text-muted)" fontFamily="JetBrains Mono, monospace" fontSize="11">
                    {String(OUVERTURE.debutH + i).padStart(2, '0')}
                  </text>
                );
              })}
              {j.duJour.filter(surLeCadran).map((a) => {
                const { longueur, decalage } = arc(a);
                const ambre = a.id === enjeu;
                return (
                  <circle
                    key={a.id}
                    cx={C}
                    cy={C}
                    r={R}
                    fill="none"
                    stroke={ambre ? 'var(--color-signal)' : fini(a) ? 'var(--color-border-strong)' : 'var(--color-text-body)'}
                    strokeWidth={EPAISSEUR}
                    strokeDasharray={`${longueur.toFixed(2)} ${CIRCONFERENCE.toFixed(2)}`}
                    strokeDashoffset={decalage.toFixed(2)}
                    transform={`rotate(-90 ${C} ${C})`}
                    className={ambre ? 'halo-signal' : undefined}
                    data-signal-groupe={ambre ? 'enjeu' : undefined}
                  />
                );
              })}
              {aiguille && <path d={`M${C} ${C} L${f(aiguille[0])} ${f(aiguille[1])}`} stroke="var(--color-text-primary)" strokeWidth="2.5" strokeLinecap="round" />}
              <circle cx={C} cy={C} r="5" fill="var(--color-text-primary)" />
            </svg>
            <div className="absolute inset-x-0 top-[55.9%] text-center">
              <span className="tnum font-mono text-[24px] font-bold tracking-[-0.03em] text-text-primary sm:text-[30px]">{hhmm(j.maintenant)}</span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="eyebrow text-text-secondary">La journée ouvrée</span>
              <span className="whitespace-nowrap font-mono text-[10px] tracking-[0.1em] text-text-muted">08 → 20 · UN ARC PAR RENDEZ-VOUS</span>
            </div>
            {j.duJour.length === 0 && <p className="text-[13.5px] text-text-secondary">Aucun rendez-vous aujourd’hui.</p>}
            {j.duJour.map((a) => {
              const ambre = a.id === enjeu;
              const passe = fini(a);
              const dedans = surLeCadran(a);
              return (
                <div key={a.id} className="grid grid-cols-[14px_104px_minmax(0,1fr)] items-baseline gap-3 border-b border-[#1a1a1a] py-2.5">
                  <span className={`h-2.5 w-2.5 ${!dedans ? 'border border-border-strong' : ambre ? 'bg-signal' : passe ? 'bg-border-strong' : 'bg-text-body'}`} data-signal-groupe={ambre ? 'enjeu' : undefined} />
                  <span
                    className={`tnum whitespace-nowrap font-mono text-[12.5px] ${ambre ? 'font-bold text-signal' : passe ? 'font-medium text-text-muted' : 'font-medium text-text-body'}`}
                    data-signal-groupe={ambre ? 'enjeu' : undefined}
                  >
                    {hhmm(new Date(a.startAt))} → {hhmm(appointmentEnd(a))}
                  </span>
                  <span className={`truncate text-[13.5px] ${passe ? 'text-text-muted' : 'text-text-primary'}`}>
                    {a.clientName || a.title}
                    {ambre && j.enJeu ? ` · ${j.enJeu.motif === 'devis' ? 'remise du devis' : 'facture échue'}` : ''}
                    {!dedans ? ' · hors cadran' : ''}
                  </span>
                </div>
              );
            })}
            <p className="mt-4 text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">{phrase}</p>
          </div>
        </section>
      </div>
    </SiPremierJour>
  );
}
