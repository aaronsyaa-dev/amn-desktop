import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneRegistre, PiedDominante } from '../components/cinquante-kit';
import { useCollection } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import { type EnregistrementFormation, type Formation, HORIZON_SEMAINES, type Quiz, SEUIL_RETENTION, courbes } from '../lib/cinquante/rh';
import type { Id } from '../lib/cinquante/guichet';
import { etiquettes } from '../lib/cinquante/finance';
import { useLangue } from '../i18n';

/**
 * FORMATION — la courbe d'oubli (`37c`).
 *
 * Une courbe par personne pour une même formation : elle part de 100 % le
 * jour du quiz, décroît selon `r(t) = 100 × e^(−t/τ)` — τ mesuré sur les
 * rappels de la personne — et remonte à la verticale à chaque rappel. Une
 * ligne marque 60 %, sous laquelle la personne ne manipule plus seule.
 * Échelle : 100 % à y 20, 0 à y 220, dans un `viewBox` 1000 × 240 ; douze
 * semaines en largeur.
 *
 * L'ambre : le point où une courbe franchit le seuil sans rappel, son
 * étiquette, et la courbe à partir de ce point.
 */

const VBH = 240;
const y = (r: number) => 220 - r * 2;
const x = (t: number) => (t / HORIZON_SEMAINES) * 1000;

export function FormationScreen() {
  const { t, langue } = useLangue();
  const tout = useCollection<EnregistrementFormation>('trainings');
  const [maintenant] = useState(() => new Date());
  const [choisie, setChoisie] = useState<string | null>(null);
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const formations = tout.filter((e): e is Id<Formation> & { updatedAt: string } => e.kind === 'formation');
  const quiz = tout.filter((e): e is Id<Quiz> & { updatedAt: string } => e.kind === 'quiz');
  const toutes = useMemo(() => formations.map((f) => ({ f, c: courbes(tout, f.id, maintenant) })), [formations, tout, maintenant]);
  const courante = toutes.find((x) => x.f.id === choisie) ?? toutes.find((x) => x.c.ambre) ?? toutes[0] ?? null;
  const vide = !courante || courante.c.courbes.length === 0;
  const a = courante?.c.ambre ?? null;
  const trimestre = new Date(maintenant.getFullYear(), Math.floor(maintenant.getMonth() / 3) * 3, 1);
  const duTrimestre = quiz.filter((q) => new Date(q.le) >= trimestre);
  const tauMin = Math.min(...toutes.flatMap((x) => x.c.courbes.map((c) => c.tau)));
  const aProposer = courante?.c.courbes.filter((c) => c.rappelPropose) ?? [];

  const description = vide
    ? t('m50.training.descriptionVide')
    : a
      ? t('m50.training.description')
      : t('m50.training.descriptionSansFranchissement');

  /* Le chemin d'une courbe, coupé au point d'ambre s'il y en a un. */
  const chemin = (pts: Array<{ t: number; r: number }>) => pts.filter((p) => p.t <= HORIZON_SEMAINES).map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.r).toFixed(1)}`).join(' ');

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.rh'), module: t('m50.training.titre') })}
          title={t('m50.training.titre')}
          description={description}
          phraseVide={t('m50.training.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={courante ? `Ce qui reste de « ${courante.f.nom} » · ${L(HORIZON_SEMAINES)} semaines` : 'Ce qui reste de la formation'}
        note={vide ? undefined : `Part de bonnes réponses estimée · seuil ${SEUIL_RETENTION} %`}
      >
        {vide || !courante ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Après le premier quiz d’une formation, une courbe suivra chaque personne : elle partira de 100 %, descendra avec
            le temps et remontera à chaque rappel. Le seuil de 60 % marquera qui ne doit plus manipuler seul.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-2 sm:grid-cols-[44px_minmax(0,1fr)_96px] sm:gap-3">
              <div className="relative h-[240px] font-mono text-[9.5px] text-text-muted">
                {[100, SEUIL_RETENTION, 0].map((r) => (
                  <span key={r} className="absolute right-0 -translate-y-1/2" style={{ top: `${(y(r) / VBH) * 100}%` }}>
                    {r === 0 ? '0' : `${r} %`}
                  </span>
                ))}
              </div>
              <div className="relative h-[240px] border border-border-raised bg-sunken">
                <svg viewBox={`0 0 1000 ${VBH}`} preserveAspectRatio="none" className="absolute inset-0 h-[240px] w-full" aria-hidden>
                  <path d={`M0 ${y(SEUIL_RETENTION)} L1000 ${y(SEUIL_RETENTION)}`} stroke="var(--color-text-muted)" strokeWidth={1.5} strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
                  {courante.c.courbes.map((c, i) => {
                    const estA = c.personne === a?.personne;
                    const coupe = estA && c.sousLeSeuilDepuis !== null ? c.sousLeSeuilDepuis : Infinity;
                    return (
                      <React.Fragment key={c.personne}>
                        <path d={chemin(c.points.filter((p) => p.t <= coupe))} fill="none" stroke={i % 2 ? '#4a4a48' : 'var(--color-text-muted)'} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
                        {estA && (
                          <path
                            data-signal-groupe="sous-le-seuil"
                            d={chemin(c.points.filter((p) => p.t >= coupe))}
                            fill="none"
                            stroke="var(--color-signal)"
                            strokeWidth={2.6}
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </svg>
                {a && a.sousLeSeuilDepuis !== null && (
                  <>
                    <span
                      data-signal-groupe="sous-le-seuil"
                      className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]"
                      style={{ left: `${(a.sousLeSeuilDepuis / HORIZON_SEMAINES) * 100}%`, top: `${(y(SEUIL_RETENTION) / VBH) * 100}%` }}
                    />
                    <span
                      data-signal-groupe="sous-le-seuil"
                      className="absolute whitespace-nowrap bg-signal px-2 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] text-signal-ink [--plaque:6rem] sm:[--plaque:15rem]"
                      style={{
                        left: `clamp(0px, calc(${(a.sousLeSeuilDepuis / HORIZON_SEMAINES) * 100}% - var(--plaque) / 2), calc(100% - var(--plaque)))`,
                        top: `calc(${(y(SEUIL_RETENTION) / VBH) * 100}% + 14px)`,
                      }}
                    >
                      {a.personne}
                      <span className="max-sm:hidden"> · sous le seuil depuis S{Math.round(a.sousLeSeuilDepuis)}</span>
                    </span>
                  </>
                )}
              </div>
              {/* Les noms, à la hauteur de la fin de leur courbe. */}
              <div className="relative h-[240px] max-sm:hidden">
                {courante.c.courbes.map((c) => {
                  /* Deux noms à moins de 14 px : le second se décale (même règle que la pente de l'Analytique). */
                  const places = etiquettes(courante.c.courbes.map((x) => ({ id: x.personne, y: y(x.points[x.points.length - 1]?.r ?? 0) })));
                  const yNom = places.get(c.personne)?.y ?? 0;
                  return (
                    <span
                      key={c.personne}
                      data-signal-groupe={c.personne === a?.personne ? 'sous-le-seuil' : undefined}
                      className={`absolute -translate-y-1/2 whitespace-nowrap text-[12px] ${c.personne === a?.personne ? 'font-semibold text-signal' : 'text-text-secondary'}`}
                      style={{ top: `${(yNom / VBH) * 100}%` }}
                    >
                      {c.personne}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[36px_minmax(0,1fr)] gap-2 sm:grid-cols-[44px_minmax(0,1fr)_96px] sm:gap-3">
              <span />
              <span className="relative h-[13px] font-mono text-[9.5px] text-text-muted">
                <span className="absolute left-0">S0</span>
                <span className="absolute left-1/2 -translate-x-1/2">S{HORIZON_SEMAINES / 2}</span>
                <span className="absolute right-0">S{HORIZON_SEMAINES}</span>
              </span>
            </div>

            <PiedDominante>
              {a
                ? `${a.personne} n’a pas repassé le quiz depuis le ${new Date(a.dernierQuiz).getDate()}/${new Date(a.dernierQuiz).getMonth() + 1} : sa part de bonnes réponses est estimée à ${Math.round(a.retentionMaintenant)} %, sous le seuil de ${SEUIL_RETENTION} %. Tant que le quiz n’est pas repassé, les produits concernés ne se manipulent plus sans quelqu’un d’autre.`
                : aProposer.length
                  ? `Un rappel est proposé à ${aProposer.map((c) => c.personne).join(', ')} : ${aProposer.length > 1 ? 'leurs courbes passeront' : 'sa courbe passera'} sous ${SEUIL_RETENTION} % dans les deux semaines.`
                  : 'Toutes les courbes restent au-dessus du seuil, et aucune ne doit le franchir dans les deux semaines.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les formations" note={toutes.length ? 'Sous le seuil' : undefined}>
          {toutes.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune formation en cours.</p>
          ) : (
            toutes.map(({ f, c }, i) => (
              <button key={f.id} type="button" onClick={() => setChoisie(f.id)} className={`block w-full text-left ${f.id === courante?.f.id ? 'bg-surface-hover/40' : ''}`}>
                <LigneRegistre colonnes="minmax(0,1fr) auto 28px" derniere={i === toutes.length - 1}>
                  <span className="min-w-0 text-[13.5px] text-text-primary">{f.nom}</span>
                  <span className="font-mono text-[11.5px] text-text-muted">{c.courbes.length} pers.</span>
                  <span className="tnum text-right font-mono text-[11.5px] text-text-secondary">{c.courbes.filter((x) => x.sousLeSeuilDepuis !== null).length}</span>
                </LigneRegistre>
              </button>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le trimestre"
          releves={[
            { label: 'Quiz passés', valeur: duTrimestre.length },
            { label: 'Taux moyen', valeur: duTrimestre.length ? `${Math.round(duTrimestre.reduce((s, q) => s + q.score, 0) / duTrimestre.length)} %` : '—' },
            { label: 'Oubli le plus rapide', valeur: Number.isFinite(tauMin) ? `τ = ${Math.round(tauMin)} sem.` : '—' },
          ]}
        >
          Un quiz de rappel remet la courbe à 100 % et affine la vitesse d’oubli mesurée.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
