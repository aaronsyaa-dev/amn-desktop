import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GraviteChip } from '../../components/garde/GardeUi';
import { garde } from '../../lib/garde';
import { useLangue } from '../../i18n';
import { relativeTime } from '../../lib/time';
import type { GardePouls, GardeRemontee } from '../../shared/garde';

/**
 * « À VOTRE AVIS » — la seule pile où l'on attend Aaron.
 *
 * Triée par gravité puis par ancienneté ; chaque point porte son contexte,
 * ses options, ce que la Garde recommande, qui l'a émis et combien de fois la
 * situation s'est présentée. Décider ici, c'est journalisé ; la tâche liée
 * suit toute seule.
 */
export function GardePileScreen() {
  const { t } = useLangue();
  const [onglet, setOnglet] = useState<'ouverte' | 'decidee' | 'resolue'>('ouverte');
  const [remontees, setRemontees] = useState<GardeRemontee[]>([]);
  const [compte, setCompte] = useState<GardePouls['compte'] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [libre, setLibre] = useState<Record<string, string>>({});
  const charger = useCallback(async () => {
    try {
      const r = await garde.remontees(onglet);
      setRemontees(r.remontees);
      setCompte(r.compte);
      setErreur(null);
    } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
  }, [onglet]);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => garde.onGarde((trame) => { if (trame.type.startsWith('garde:remontee')) void charger(); }), [charger]);
  const decider = async (id: string, decision: string) => { await garde.decider(id, decision); await charger(); };

  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.pile.titre')} description={t('garde.pile.description')} stats={compte ? [{ label: t('garde.pile.ouvertes'), value: compte.ouvertes, emphasis: compte.critiques > 0 }, { label: t('garde.gravite.critique'), value: compte.critiques, emphasis: compte.critiques > 0 }, { label: t('garde.pile.decidees'), value: compte.decidees }] : []} />
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}
      <div className="flex gap-1" role="tablist">
        {(['ouverte', 'decidee', 'resolue'] as const).map((o) => (
          <button key={o} type="button" role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)} className={`min-h-11 border px-3 font-mono text-[10px] uppercase tracking-widest md:min-h-0 md:py-1.5 ${onglet === o ? 'border-border-strong bg-surface text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
            {t(o === 'ouverte' ? 'garde.pile.ouvertes' : o === 'decidee' ? 'garde.pile.decidees' : 'garde.pile.resolues')}
          </button>
        ))}
      </div>
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
            {r.recommandation && <p className="text-[13px] leading-relaxed text-text-primary"><span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.pile.recommande')} · </span>{r.recommandation}</p>}
            {r.etat === 'ouverte' ? (
              <div className="flex flex-col gap-2 border-t border-border pt-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.pile.options')}</p>
                <div className="flex flex-wrap gap-2">
                  {r.options.map((o) => <button key={o} type="button" onClick={() => void decider(r.id, o)} className="min-h-11 border border-border bg-bg px-2.5 text-xs text-text-primary hover:border-border-strong md:min-h-0 md:py-1">{o}</button>)}
                  {r.orgId && <Link to={`/tour/organisations?org=${encodeURIComponent(r.orgId)}`} className="min-h-11 border border-border px-2.5 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1">{t('garde.pile.dossier')}</Link>}
                </div>
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (libre[r.id]?.trim()) void decider(r.id, libre[r.id].trim()); }}>
                  <input value={libre[r.id] ?? ''} onChange={(e) => setLibre((l) => ({ ...l, [r.id]: e.target.value }))} placeholder={t('garde.pile.decisionLibre')} aria-label={t('garde.pile.decisionLibre')} className="input-focus min-w-0 flex-1 border border-border bg-bg px-2 py-1 text-xs text-text-primary outline-none" />
                  <button type="submit" className="border border-border-strong px-2.5 py-1 text-xs text-text-primary">{t('garde.pile.decider')}</button>
                </form>
                {r.tacheId && !r.tacheId.startsWith('close:') && <p className="font-mono text-[10px] text-text-muted">{t('garde.pile.tache')}</p>}
              </div>
            ) : r.decision ? (
              <p className="border-t border-border pt-2 text-[12px] text-text-secondary">{t('garde.pile.decideePar', { par: r.decideePar ?? '', decision: r.decision })}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
