import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GraviteChip } from '../../components/garde/GardeUi';
import { garde } from '../../lib/garde';
import { useLangue } from '../../i18n';
import { NOM_DU_CHEF } from '@edition/ajmani';
import { relativeTime } from '../../lib/time';
import type { GardeDossier, GardePileDossiers, GardePouls, GardeRemontee } from '../../shared/garde';

/**
 * « À VOTRE AVIS » — la seule pile où l'on attend Aaron.
 *
 * Ouverte, elle se lit en DOSSIERS (Bloc 4) : Ajmani regroupe les remontées
 * d'un même agent, d'une même famille, chez une même organisation — deux
 * cents incidents identiques sont une situation, pas deux cents lignes. Triés
 * par gravité puis par ancienneté ; chez une organisation, le plus grave mène
 * et les autres se rangent derrière. Une décision vaut pour tout le dossier ;
 * « Décidez seul, désormais » confie la famille à Ajmani, hors critique.
 *
 * Décidées et résolues se lisent ligne à ligne, comme avant.
 */
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
  useEffect(() => garde.onGarde((trame) => { if (trame.type.startsWith('garde:remontee') || trame.type === 'garde:mandat') void charger(); }), [charger]);
  const decider = async (id: string, decision: string) => { await garde.decider(id, decision); await charger(); };
  const deciderDossier = async (d: GardeDossier, decision: string) => {
    const r = await garde.deciderDossier(d.id, decision);
    setMessage(t('garde.pile.decideDossier', { n: r.n }));
    await charger();
  };
  const confier = async (d: GardeDossier) => {
    if (!d.recommandation) return;
    const r = await garde.donnerMandat({ agent: d.agent, famille: d.famille, decision: d.recommandation });
    setMessage(t('garde.chef.decidezSeulFait', { decision: d.recommandation ?? '', n: r.appliquees, chef: NOM_DU_CHEF }));
    await charger();
  };

  const stats = compte ? [{ label: t('garde.pile.ouvertes'), value: compte.ouvertes, emphasis: compte.critiques > 0 }, { label: t('garde.pile.dossiers'), value: pile?.compte.dossiers ?? '—' }, { label: t('garde.gravite.critique'), value: compte.critiques, emphasis: compte.critiques > 0 }, { label: t('garde.pile.decidees'), value: compte.decidees }] : [];

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
          <ol className="flex flex-col gap-3" aria-label={t('garde.pile.dossiers')}>
            {pile?.dossiers.map((d) => (
              <li key={d.id} data-dossier={d.famille} className={`flex flex-col gap-2 rounded-xl border bg-surface p-4 ${d.chefDeFile ? 'border-border' : 'ml-4 border-border/70 md:ml-8'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <GraviteChip gravite={d.gravite} />
                  <span className="font-mono text-[10px] text-text-muted">{t('garde.pile.par', { agent: d.agent })}</span>
                  {d.n > 1 && <span className="font-mono text-[10px] text-text-muted">· {t('garde.pile.situations', { n: d.n })} · {t('garde.pile.vues', { n: d.vues })}</span>}
                  {d.n === 1 && d.vues > 1 && <span className="font-mono text-[10px] text-text-muted">· {t('garde.pile.compte', { n: d.vues })}</span>}
                  {!d.chefDeFile && <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">· {t('garde.pile.derriere')}</span>}
                  <span className="ml-auto font-mono text-[10px] text-text-muted">{relativeTime(d.depuis)}</span>
                </div>
                <p className="text-sm font-semibold text-text-primary">{d.titre}</p>
                {d.n > 1 && (
                  <p className="text-[12px] text-text-secondary"><span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.pile.exemples')} · </span>{d.exemples.join(' ; ')}</p>
                )}
                {d.contexte && <p className="text-[13px] leading-relaxed text-text-secondary"><span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.pile.contexte')} · </span>{d.contexte}</p>}
                {d.recommandation
                  ? <p className="text-[13px] leading-relaxed text-text-primary"><span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.pile.recommande')} · </span>{d.recommandation}</p>
                  : <p className="text-[13px] leading-relaxed text-text-secondary">{t('garde.pile.sansRecommandation', { chef: NOM_DU_CHEF })}</p>}
                <div className="flex flex-col gap-2 border-t border-border pt-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.pile.options')}</p>
                  <div className="flex flex-wrap gap-2">
                    {d.options.map((o) => <button key={o} type="button" onClick={() => void deciderDossier(d, o)} className="min-h-11 border border-border bg-bg px-2.5 text-xs text-text-primary hover:border-border-strong md:min-h-0 md:py-1">{o}</button>)}
                    {d.orgId && <Link to={`/tour/organisations?org=${encodeURIComponent(d.orgId)}`} className="min-h-11 border border-border px-2.5 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1">{t('garde.pile.dossier')}</Link>}
                    {d.recommandation && d.gravite !== 'critique' && <button type="button" onClick={() => void confier(d)} className="min-h-11 border border-dashed border-border px-2.5 text-xs text-text-secondary hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-1">{t('garde.chef.decidezSeul')}</button>}
                  </div>
                  <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (libre[d.id]?.trim()) void deciderDossier(d, libre[d.id].trim()); }}>
                    <input value={libre[d.id] ?? ''} onChange={(e) => setLibre((l) => ({ ...l, [d.id]: e.target.value }))} placeholder={t('garde.pile.decisionLibre')} aria-label={t('garde.pile.decisionLibre')} className="input-focus min-w-0 flex-1 border border-border bg-bg px-2 py-1 text-xs text-text-primary outline-none" />
                    <button type="submit" className="border border-border-strong px-2.5 py-1 text-xs text-text-primary">{t('garde.pile.decider')}</button>
                  </form>
                  {d.tache && <p className="font-mono text-[10px] text-text-muted">{t('garde.pile.tache')}</p>}
                  {d.chefDeFile && d.memeOrg > 0 && <p className="font-mono text-[10px] text-text-muted">{t('garde.pile.aussi')} · {d.memeOrg}</p>}
                </div>
              </li>
            ))}
          </ol>
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
                {r.contexte && <p className="text-[13px] leading-relaxed text-text-secondary"><span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.pile.contexte')} · </span>{r.contexte}</p>}
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
