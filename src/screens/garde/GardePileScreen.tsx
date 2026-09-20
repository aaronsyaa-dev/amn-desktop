import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AnimatedCounter } from '../../components/AnimatedCounter';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Depliable } from '../../components/Depliable';
import { useHaloSignal } from '../../components/EtatEcran';
import { GraviteChip } from '../../components/garde/GardeUi';
import { garde } from '../../lib/garde';
import { useLangue } from '../../i18n';
import { NOM_DU_CHEF } from '@edition/ajmani';
import { relativeTime } from '../../lib/time';
import type { GardeDossier, GardeMandat, GardePileDossiers, GardePouls, GardeRemontee } from '../../shared/garde';

/**
 * « À VOTRE AVIS » — la pile laminée.
 *
 * Ouverte, elle se lit en DOSSIERS (Bloc 4) : Ajmani regroupe les remontées
 * d'un même agent, d'une même famille, chez une même organisation — deux
 * cents incidents identiques sont une situation, pas deux cents lignes.
 *
 * L'INSTRUMENT : chaque dossier porte à sa gauche une LAMINATION — une strate
 * de 2 px par remontée regroupée, dans une fente de 58 × 104 px. Un dossier de
 * deux cents remontées est un bloc plein et strié ; un dossier d'une seule est
 * un trait au fond de la fente. On VOIT ce qui a été compressé dans la carte
 * avant de lire le chiffre — c'est l'argument entier du module, rendu sans un
 * mot.
 *
 * L'AMBRE, unique : le dossier critique — sa lamination, sa puce de gravité,
 * son titre. Le seul qui ne puisse pas être confié à Ajmani.
 *
 * Décidées et résolues se lisent ligne à ligne, comme avant.
 */

/* ── La fente et ses strates ──────────────────────────────────────────
   Une strate de 2 px par remontée, posée tous les 3 px depuis le fond.
   La capacité de la fente se DÉDUIT de ces trois mesures : elle n'est pas
   un nombre choisi à la main, sinon elle mentirait le jour où l'une des
   trois bouge. Au-delà, la fente est pleine — et une fente pleine se dessine
   comme telle, striée d'un bout à l'autre, jamais comme trente-cinq strates
   qui feraient croire à trente-cinq remontées. */
const FENTE_L = 58;
const FENTE_H = 104;
const STRATE_H = 2;
const STRATE_PAS = 3;
const STRATES_MAX = Math.floor((FENTE_H - STRATE_H) / STRATE_PAS) + 1;

function Lamination({ n, ambre, titre }: { n: number; ambre: boolean; titre: string }) {
  const pleine = n >= STRATES_MAX;
  const encre = ambre ? 'var(--color-signal)' : '#4a4a48';
  return (
    <span
      role="img"
      aria-label={titre}
      title={titre}
      data-lamination={n}
      data-signal-groupe={ambre ? 'dossier-critique' : undefined}
      className={`relative block flex-none overflow-hidden border bg-sunken ${ambre ? 'border-signal-line' : 'border-border'}`}
      style={{ width: FENTE_L, height: FENTE_H }}
    >
      {pleine ? (
        <>
          <span
            className="absolute inset-x-0 bottom-0"
            data-signal-groupe={ambre ? 'dossier-critique' : undefined}
            style={{
              height: FENTE_H,
              background: encre,
              backgroundImage: `repeating-linear-gradient(0deg, rgba(8,8,8,.34) 0 1px, transparent 1px ${STRATE_PAS}px)`,
            }}
          />
          {ambre && <span className="absolute inset-0" style={{ boxShadow: 'inset 0 0 26px -4px var(--color-signal-glow)' }} />}
        </>
      ) : (
        Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            className="absolute inset-x-0"
            data-signal-groupe={ambre ? 'dossier-critique' : undefined}
            style={{ bottom: i * STRATE_PAS, height: STRATE_H, background: encre }}
          />
        ))
      )}
    </span>
  );
}

export function GardePileScreen() {
  const { t } = useLangue();
  const [onglet, setOnglet] = useState<'ouverte' | 'decidee' | 'resolue'>('ouverte');
  const [pile, setPile] = useState<GardePileDossiers | null>(null);
  const [remontees, setRemontees] = useState<GardeRemontee[]>([]);
  const [compte, setCompte] = useState<GardePouls['compte'] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [libre, setLibre] = useState<Record<string, string>>({});
  /** Ce qu'Ajmani vient de faire — en tête, parce qu'un dossier décidé disparaît de la liste avec sa carte. */
  const [message, setMessage] = useState<string | null>(null);
  /* La progression visible : ce que VOUS avez décidé depuis l'ouverture de l'écran, en dossiers ET en points. Le compteur compte — une micro-satisfaction honnête, jamais un score. */
  const [seance, setSeance] = useState({ dossiers: 0, points: 0 });
  const [mandat, setMandat] = useState<GardeMandat | null>(null);
  const mouvementReduit = useReducedMotion();
  /* Un dossier décidé se retire d'un souffle au lieu de disparaître d'un coup — et sans mouvement demandé, il disparaît simplement. */
  const sortie = mouvementReduit ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, height: 0, marginBottom: -12, overflow: 'hidden' as const }, transition: { duration: 0.26, ease: 'easeOut' as const } };
  const charger = useCallback(async () => {
    try {
      if (onglet === 'ouverte') {
        const [p, r] = await Promise.all([garde.pile(100), garde.remontees('ouverte', { limit: 1 })]);
        setPile(p);
        setCompte(r.compte);
      } else {
        const r = await garde.remontees(onglet);
        setRemontees(r.remontees);
        setCompte(r.compte);
      }
      setErreur(null);
    } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
  }, [onglet]);
  useEffect(() => { void charger(); }, [charger]);
  const chargerMandat = useCallback(async () => { try { setMandat(await garde.mandat()); } catch { setMandat(null); } }, []);
  useEffect(() => { void chargerMandat(); }, [chargerMandat]);
  useEffect(() => garde.onGarde((trame) => { if (trame.type.startsWith('garde:remontee') || trame.type === 'garde:mandat') { void charger(); void chargerMandat(); } }), [charger, chargerMandat]);
  const decider = async (id: string, decision: string) => { await garde.decider(id, decision); setSeance((s) => ({ dossiers: s.dossiers + 1, points: s.points + 1 })); await charger(); };
  const deciderDossier = async (d: GardeDossier, decision: string) => {
    const r = await garde.deciderDossier(d.id, decision);
    setSeance((s) => ({ dossiers: s.dossiers + 1, points: s.points + r.n }));
    setMessage(t('garde.pile.decideDossier', { n: r.n }));
    await charger();
  };
  const confier = async (d: GardeDossier) => {
    if (!d.recommandation) return;
    const r = await garde.donnerMandat({ agent: d.agent, famille: d.famille, decision: d.recommandation });
    setSeance((s) => ({ dossiers: s.dossiers + 1, points: s.points + r.appliquees }));
    setMessage(t('garde.chef.decidezSeulFait', { decision: d.recommandation ?? '', n: r.appliquees, chef: NOM_DU_CHEF }));
    await charger();
    await chargerMandat();
  };

  const stats = compte ? [{ label: t('garde.pile.ouvertes'), value: compte.ouvertes, emphasis: compte.critiques > 0 }, { label: t('garde.pile.dossiers'), value: pile?.compte.dossiers ?? '—' }, { label: t('garde.gravite.critique'), value: compte.critiques, emphasis: compte.critiques > 0 }, { label: t('garde.pile.decidees'), value: compte.decidees }, ...(seance.points > 0 ? [{ label: t('garde.pile.decideesSeance'), value: <AnimatedCounter value={seance.points} /> }] : [])] : [];

  /*
    L'AMBRE n'en prend qu'un : le premier dossier critique de la pile. La pile
    peut en porter plusieurs le même soir — ambrer chacun d'eux rendrait
    l'écran illisible au moment précis où il doit trancher.
  */
  const dossierAmbre = useMemo(() => pile?.dossiers.find((d) => d.gravite === 'critique') ?? null, [pile]);
  const halo = useHaloSignal(dossierAmbre !== null);
  /* Le chef de file le plus lourd : celui dont une seule décision ferme le plus de points. C'est lui que nomme le pied de la carte. */
  const leplusLourd = useMemo(() => (pile?.dossiers ?? []).filter((d) => d.chefDeFile).sort((a, b) => b.n - a.n)[0] ?? null, [pile]);
  const mandats = Object.entries(mandat?.regles ?? {});

  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.pile.titre')} description={t('garde.pile.description')} stats={stats} />
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}
      <div className="flex gap-1" role="tablist">
        {(['ouverte', 'decidee', 'resolue'] as const).map((o) => (
          <button key={o} type="button" role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)} className={`min-h-11 border px-3 font-mono text-[10px] uppercase tracking-widest md:min-h-0 md:py-1.5 ${onglet === o ? 'border-border-strong bg-surface text-text-primary' : 'border-border text-text-muted hover:text-text-primary'}`}>
            {t(o === 'ouverte' ? 'garde.pile.ouvertes' : o === 'decidee' ? 'garde.pile.decidees' : 'garde.pile.resolues')}
          </button>
        ))}
      </div>

      {message && <p className="border border-border-strong bg-surface px-3 py-2 text-[13px] text-text-primary" aria-live="polite" data-message="pile">{message}</p>}
      {onglet === 'ouverte' ? (
        <>
          {pile && pile.dossiers.length === 0 && !erreur && <p className="font-mono text-xs text-text-muted">{t('garde.pile.vide')}</p>}

          {/* ═══ L'OBJET DOMINANT : la pile, chaque dossier sur sa lamination ═══ */}
          {pile && pile.dossiers.length > 0 && (
            <article className="border border-border-raised bg-elevated px-5 py-6 sm:px-7">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.pile.lesDossiers')}</h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.pile.lamineLegende')}</span>
              </div>

              <ol className="flex flex-col gap-3" aria-label={t('garde.pile.dossiers')}>
                <AnimatePresence initial={false}>
                {pile.dossiers.map((d) => {
                  const ambre = dossierAmbre?.id === d.id;
                  const groupe = ambre ? 'dossier-critique' : undefined;
                  return (
                  <motion.li
                    key={d.id}
                    {...sortie}
                    data-dossier={d.famille}
                    /* Les dossiers qui se rangent derrière le chef de file sont décalés de 34 px : le retrait EST la subordination. */
                    style={d.chefDeFile ? undefined : { marginLeft: 34 }}
                    className={`flex items-stretch gap-4 border p-4 sm:px-[18px] ${ambre ? `bg-signal-muted border-signal-line ${halo}` : 'border-border bg-raised'}`}
                  >
                    <Lamination n={d.n} ambre={ambre} titre={t('garde.pile.laminationAide', { n: d.n })} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span data-signal-groupe={groupe}><GraviteChip gravite={d.gravite} /></span>
                        <span className="font-mono text-[10px] text-text-muted">{t('garde.pile.par', { agent: d.agent })}</span>
                        {d.n > 1 && <span className="font-mono text-[10px] text-text-muted">· {t('garde.pile.situations', { n: d.n })} · {t('garde.pile.vues', { n: d.vues })}</span>}
                        {d.n === 1 && d.vues > 1 && <span className="font-mono text-[10px] text-text-muted">· {t('garde.pile.compte', { n: d.vues })}</span>}
                        {!d.chefDeFile && <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">· {t('garde.pile.derriere')}</span>}
                        <span className="ml-auto font-mono text-[10px] text-text-muted">{relativeTime(d.depuis)}</span>
                      </div>
                      <p data-signal-groupe={groupe} className="mt-2 text-[15px] font-semibold leading-snug text-text-primary [text-wrap:pretty]">{d.titre}</p>
                      {d.n > 1 && (
                        <p className="mt-1.5 text-[12px] text-text-secondary"><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">{t('garde.pile.exemples')} · </span>{d.exemples.join(' ; ')}</p>
                      )}
                      {d.contexte && <Depliable lignes={2}><p className="mt-1.5 text-[12.5px] leading-relaxed text-text-secondary"><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">{t('garde.pile.contexte')} · </span>{d.contexte}</p></Depliable>}
                      {d.recommandation
                        ? <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-body"><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">{t('garde.pile.recommande')} · </span>{d.recommandation}</p>
                        : <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-secondary"><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">{t('garde.pile.sansRecommandationSurtitre')} · </span>{t('garde.pile.sansRecommandation', { chef: NOM_DU_CHEF })}</p>}

                      <div className="mt-auto flex flex-wrap items-center gap-[7px] pt-3">
                        {d.options.map((o) => <button key={o} type="button" onClick={() => void deciderDossier(d, o)} className="min-h-11 border border-border-sheet bg-sunken px-[11px] text-[11.5px] font-semibold text-text-body hover:border-border-strong md:min-h-0 md:py-[7px]">{o}</button>)}
                        {d.orgId && <Link to={`/tour/organisations?org=${encodeURIComponent(d.orgId)}`} className="flex min-h-11 items-center border border-border-sheet px-[11px] text-[11.5px] text-text-secondary hover:text-text-primary md:min-h-0 md:py-[7px]">{t('garde.pile.dossier')}</Link>}
                        {/* « Décidez seul, désormais » n'apparaît JAMAIS sur du critique : un mandat ne porte pas ce qui ne peut pas être délégué. */}
                        {d.recommandation && d.gravite !== 'critique' && <button type="button" onClick={() => void confier(d)} className="min-h-11 border border-dashed border-border-strong px-[11px] text-[11.5px] font-semibold text-text-secondary hover:text-text-primary md:min-h-0 md:py-[7px]">{t('garde.chef.decidezSeul')}</button>}
                        {d.gravite === 'critique' && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.pile.nonDelegable')}</span>}
                      </div>
                      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (libre[d.id]?.trim()) void deciderDossier(d, libre[d.id].trim()); }}>
                        <input value={libre[d.id] ?? ''} onChange={(e) => setLibre((l) => ({ ...l, [d.id]: e.target.value }))} placeholder={t('garde.pile.decisionLibre')} aria-label={t('garde.pile.decisionLibre')} className="input-focus min-w-0 flex-1 border border-border bg-bg px-2 py-1 text-xs text-text-primary outline-none" />
                        <button type="submit" className="border border-border-strong px-2.5 py-1 text-xs text-text-primary">{t('garde.pile.decider')}</button>
                      </form>
                      {d.tache && <p className="mt-1 font-mono text-[10px] text-text-muted">{t('garde.pile.tache')}</p>}
                      {d.chefDeFile && d.memeOrg > 0 && <p className="mt-1 font-mono text-[10px] text-text-muted">{t('garde.pile.aussi')} · {d.memeOrg}</p>}
                    </div>
                  </motion.li>
                  );
                })}
                </AnimatePresence>
              </ol>

              <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-border-raised pt-5">
                <p className="min-w-[16rem] flex-1 text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
                  {leplusLourd && leplusLourd.n > 1 ? t('garde.pile.piedPhrase', { n: leplusLourd.n }) : t('garde.pile.piedPhraseSansChef')}
                </p>
                {leplusLourd?.orgId && leplusLourd.orgNom && (
                  <Link to={`/tour/organisations?org=${encodeURIComponent(leplusLourd.orgId)}`} className="flex h-[30px] flex-none items-center border border-border-strong px-3.5 text-[12.5px] font-semibold text-text-body hover:bg-surface-hover">
                    {t('garde.pile.ouvrirDossierOrg', { org: leplusLourd.orgNom })}
                  </Link>
                )}
              </div>
            </article>
          )}

          <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="min-w-0 border border-border bg-surface px-[22px] py-5" aria-label={t('garde.pile.depuisOuverture')}>
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.pile.depuisOuverture')}</h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.pile.compteurLegende')}</span>
              </div>
              {/* Tant que rien n'a été décidé, il n'y a pas de zéro à afficher : un grand 0 apprendrait à ne plus regarder ce chiffre. */}
              {seance.dossiers === 0 ? (
                <p className="text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.pile.rienDecide')}</p>
              ) : (
                <div className="flex items-end gap-4">
                  <span className="font-mono text-[46px] font-bold leading-[0.9] tabular-nums tracking-[-0.05em] text-text-primary"><AnimatedCounter value={seance.dossiers} /></span>
                  <span className="pb-[5px] text-[13.5px] leading-snug text-text-secondary">
                    {t('garde.pile.dossiersDecides', { n: seance.dossiers })}<br />{t('garde.pile.pointsFermes', { n: seance.points })}
                  </span>
                </div>
              )}
              <p className="mt-[18px] border-t border-border pt-4 text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.pile.souffle')}</p>
            </section>

            <section className="flex flex-col border border-border bg-surface px-5 py-5" aria-label={t('garde.pile.mandats')} data-mandats={mandats.length}>
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.pile.mandats')}</h2>
              {mandats.length === 0 ? (
                <p className="mt-4 text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.pile.mandatAucun')}</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {mandats.map(([cle, r]) => (
                    <li key={cle} className="flex items-start gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-text-primary">{r.agent} · {r.famille}</span>
                        <span className="mt-[3px] block text-[12px] text-text-muted">{t('garde.pile.mandatDecideSeul', { chef: NOM_DU_CHEF, decision: r.decision })}</span>
                      </span>
                      <button type="button" onClick={() => void garde.retirerMandat(cle).then(() => chargerMandat())} className="flex-none border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted hover:border-border-strong hover:text-text-primary">{t('garde.pile.retirerMandat')}</button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-auto pt-[18px] text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.pile.mandatJamaisCritique')}</p>
            </section>
          </div>
        </>
      ) : (
        <>
          {remontees.length === 0 && !erreur && <p className="font-mono text-xs text-text-muted">{t('garde.pile.vide')}</p>}
          <ol className="flex flex-col gap-3">
            {remontees.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <GraviteChip gravite={r.gravite} />
                  <span className="font-mono text-[10px] text-text-muted">{t('garde.pile.par', { agent: r.agent })}</span>
                  {r.compte > 1 && <span className="font-mono text-[10px] text-text-muted">· {t('garde.pile.compte', { n: r.compte })}</span>}
                  <span className="ml-auto font-mono text-[10px] text-text-muted">{relativeTime(r.updatedAt)}</span>
                </div>
                <p className="text-sm font-semibold text-text-primary">{r.titre}</p>
                {r.contexte && <Depliable lignes={2}><p className="text-[13px] leading-relaxed text-text-secondary"><span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.pile.contexte')} · </span>{r.contexte}</p></Depliable>}
                {r.etat === 'ouverte' ? (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                    {r.options.map((o) => <button key={o} type="button" onClick={() => void decider(r.id, o)} className="min-h-11 border border-border bg-bg px-2.5 text-xs text-text-primary hover:border-border-strong md:min-h-0 md:py-1">{o}</button>)}
                  </div>
                ) : r.decision ? (
                  <p className="border-t border-border pt-2 text-[12px] text-text-secondary">{t('garde.pile.decideePar', { par: r.decideePar ?? '', decision: r.decision })}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
