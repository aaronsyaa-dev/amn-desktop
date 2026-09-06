import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PoulsBadge } from '../../components/garde/GardeUi';
import { garde } from '../../lib/garde';
import { useLangue } from '../../i18n';
import { NOM_DU_CHEF } from '@edition/ajmani';
import { relativeTime } from '../../lib/time';
import type { GardeAccueil, GardeGeste, GardeGuideEntree } from '../../shared/garde';

/**
 * AJMANI, CHEF D'ÉTAT-MAJOR — une conversation, pas un pupitre (Bloc 3 de l'Automatique).
 *
 * Avant : un mur de quarante boutons, trois familles de commandes étalées,
 * quatre panneaux de réglages. « Ce n'est ni intelligent, ni naturel. »
 *
 * Maintenant : il parle en premier (une proposition, choisie côté serveur
 * par une règle lisible), on lui répond dans une seule zone, il répond en
 * prose courte, et propose au plus trois suites selon le contexte. Le
 * catalogue complet de ce qu'il sait faire est derrière « ? » ; ses réglages
 * (mandat, parole du jour, silence) derrière « Réglages ». Rien n'est étalé.
 *
 * Aucune formulation ici : tout vient du Capitaine, avec ses preuves. Le
 * champ accepte du texte libre — c'est là que la voix se branchera.
 */
const HEURES = Array.from({ length: 24 }, (_, h) => h);
const BUDGETS = [0, 2, 4, 6, 8, 10, 12];
interface Bulle { de: 'moi' | 'chef'; texte: string; confirmation?: string; original?: string; at?: string }

export function GardeAjmaniScreen() {
  const { t } = useLangue();
  const [acc, setAcc] = useState<GardeAccueil | null>(null);
  const [guide, setGuide] = useState<GardeGuideEntree[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fil, setFil] = useState<Bulle[]>([]);
  const [suites, setSuites] = useState<string[]>([]);
  const [texte, setTexte] = useState('');
  const [busy, setBusy] = useState(false);
  const [catalogue, setCatalogue] = useState(false);
  const bas = useRef<HTMLDivElement | null>(null);
  /* Une bulle qui arrive glisse d'un souffle ; sans mouvement demandé, elle apparaît simplement. */
  const mouvementReduit = useReducedMotion();
  const arrivee = mouvementReduit ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22, ease: 'easeOut' as const } };

  const charger = useCallback(async () => {
    try {
      const [a, g] = await Promise.all([garde.accueil(), garde.guide()]);
      setAcc(a);
      setGuide(g.guide);
      setErreur(null);
    } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
  }, []);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => garde.onGarde((trame) => { if (['garde:remontee', 'garde:remontee-decidee', 'garde:releve', 'garde:mandat'].includes(trame.type)) void charger(); }), [charger]);
  useEffect(() => { bas.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [fil.length]);

  // L'historique : les derniers échanges déjà tenus, relus du serveur — la conversation continue, elle ne recommence pas.
  const historique: Bulle[] = (acc?.ordres ?? []).slice(0, 6).reverse().flatMap((o) => [
    { de: 'moi' as const, texte: o.texte, at: o.createdAt },
    ...(o.reponse ? [{ de: 'chef' as const, texte: o.reponse, at: o.createdAt }] : []),
  ]);

  const dire = async (quoi: string, confirmer = false) => {
    if (!quoi.trim() || busy) return;
    setBusy(true);
    setFil((f) => [...f, { de: 'moi', texte: quoi }]);
    setTexte('');
    try {
      const r = await garde.ordre(quoi, confirmer);
      setFil((f) => [...f, { de: 'chef', texte: r.question ?? r.reponse, ...(r.confirmation ? { confirmation: r.confirmation, original: quoi } : {}) }]);
      setSuites(r.suites ?? []);
      if (r.ordre?.etat === 'fait') void charger();
    } catch (err) {
      setFil((f) => [...f, { de: 'chef', texte: t('garde.erreur', { message: err instanceof Error ? err.message : String(err) }) }]);
    } finally { setBusy(false); }
  };
  const geste = async (g: GardeGeste) => {
    if (g.dossier && g.decision) {
      setBusy(true);
      try { const r = await garde.deciderDossier(g.dossier, g.decision); setFil((f) => [...f, { de: 'chef', texte: t('garde.pile.decideDossier', { n: r.n }) }]); await charger(); } finally { setBusy(false); }
    } else if (g.ordre) await dire(g.ordre);
  };
  const reglerSilence = async (patch: { de?: number; a?: number }) => { if (!acc) return; await garde.reglages({ silence: { de: patch.de ?? acc.silence.de, a: patch.a ?? acc.silence.a } }); await charger(); };
  const reglerBudget = async (budgetParoles: number) => { await garde.reglages({ budgetParoles }); await charger(); };
  const retirer = async (cle: string) => { await garde.retirerMandat(cle); await charger(); };
  const familles: GardeGuideEntree['famille'][] = ['savoir', 'faire', 'regler'];
  const suitesAffichees = suites.length > 0 ? suites : [t('garde.chef.suite.pouls'), t('garde.chef.suite.attend'), t('garde.chef.suite.tour')];

  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.chef.titre', { chef: NOM_DU_CHEF })} description={t('garde.chef.descriptionCourte')} stats={acc ? [{ label: t('garde.pile.dossiers'), value: acc.pile.compte.dossiers, emphasis: acc.pile.compte.critiques > 0 }, { label: t('garde.gravite.critique'), value: acc.pile.compte.critiques, emphasis: acc.pile.compte.critiques > 0 }, { label: t('garde.chef.mandat'), value: Object.keys(acc.mandat.regles).length }] : []}
        actions={<button type="button" onClick={() => setCatalogue((c) => !c)} aria-expanded={catalogue} aria-label={t('garde.chef.guide')} title={t('garde.chef.guide')} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border font-mono text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">?</button>}
      />
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}

      {/* Le catalogue, derrière « ? » : jamais étalé. */}
      {catalogue && (
        <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.chef.guide')}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.guide')}</h2>
            <p className="text-[12px] text-text-muted">{t('garde.chef.guideAide')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {familles.map((f) => (
              <div key={f}>
                <h3 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">{t(`garde.chef.famille.${f}`)}</h3>
                <ul className="flex flex-col gap-0.5">
                  {guide.filter((g) => g.famille === f).map((g) => (
                    <li key={g.intention}>
                      <button type="button" title={g.exemple} onClick={() => { setCatalogue(false); void dire(g.exemple); }} className="min-h-8 text-left text-[12px] text-text-secondary hover:text-text-primary">{g.libelle}{g.modifie ? <span className="text-text-muted"> ·</span> : null}</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* La conversation : il parle en premier ; on répond ; il propose au plus trois suites. */}
      <section className="flex flex-col gap-3 rounded-xl border border-border-strong bg-surface p-4" aria-label={t('garde.chef.conversation')} aria-live="polite">
        {!acc && !erreur && <p className="font-mono text-xs text-text-muted">{t('garde.salle.chargement')}</p>}
        {acc && (
          <ol className="flex flex-col gap-2">
            {historique.map((m, i) => (
              <li key={`h${i}`} className={`max-w-[85%] whitespace-pre-line rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${m.de === 'moi' ? 'self-end border-border bg-bg text-text-secondary' : 'self-start border-border bg-surface text-text-secondary'}`} title={m.at ? relativeTime(m.at) : undefined}>{m.texte}</li>
            ))}
            <li className="max-w-[85%] self-start rounded-lg border border-border-strong bg-bg px-3 py-2.5 text-[13px] leading-relaxed text-text-primary">
              <span className="flex flex-wrap items-center gap-2 pb-1"><PoulsBadge pouls={acc.pouls} compact />{acc.silence.actif && <span className="font-mono text-[10px] uppercase tracking-widest text-warning">{t('garde.chef.silenceActif')}</span>}</span>
              <span className="block text-text-secondary">{acc.salut}</span>
              <span className="mt-1 block font-medium" data-proposition={acc.proposition.cle}>{acc.proposition.texte}</span>
              {acc.aveux.length > 0 && <span className="mt-1 block text-[12px] text-text-muted">{acc.aveux.join(' ')}</span>}
              <span className="mt-2 flex flex-wrap gap-2">
                {acc.proposition.gestes.slice(0, 3).map((g) => g.vers
                  ? <Link key={g.label} to={g.vers} className="min-h-9 border border-border px-2.5 py-1 text-[12px] text-text-primary hover:border-border-strong">{g.label}</Link>
                  : <button key={g.label} type="button" disabled={busy} onClick={() => void geste(g)} className="min-h-9 border border-accent bg-accent px-2.5 py-1 text-[12px] font-medium text-bg hover:bg-accent-hover disabled:opacity-50">{g.label}</button>)}
                <button type="button" disabled={busy} onClick={() => void dire('je ferme pour ce soir')} data-cloture className="min-h-9 border border-border px-2.5 py-1 text-[12px] text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50">{t('garde.chef.cloture')}</button>
              </span>
            </li>
            {fil.map((m, i) => (
              <motion.li key={`f${i}`} {...arrivee} className={`max-w-[85%] whitespace-pre-line rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${m.de === 'moi' ? 'self-end border-border-strong bg-bg text-text-primary' : 'self-start border-border bg-surface text-text-primary'}`} data-chef-reponse={m.de === 'chef' ? '' : undefined}>
                {m.texte}
                {m.confirmation && m.original && (
                  <span className="mt-2 flex gap-2">
                    <button type="button" onClick={() => void dire(m.original as string, true)} className="border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-bg">{t('garde.bureau.confirmer')}</button>
                    <button type="button" onClick={() => setFil((f) => [...f, { de: 'chef', texte: t('garde.bureau.annuler') }])} className="border border-border px-2.5 py-1 text-xs text-text-muted">{t('garde.bureau.annuler')}</button>
                  </span>
                )}
              </motion.li>
            ))}
          </ol>
        )}
        <div ref={bas} />
        <div className="flex flex-wrap gap-2" data-suites={suitesAffichees.length}>
          {suitesAffichees.slice(0, 3).map((s) => <button key={s} type="button" disabled={busy} onClick={() => void dire(s)} className="min-h-9 border border-border bg-bg px-2.5 py-1 text-[12px] text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50">{s}</button>)}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void dire(texte); }}>
          <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t('garde.bureau.question')} aria-label={t('garde.bureau.question')} autoComplete="off" className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <button type="submit" disabled={busy || !texte.trim()} className="min-h-11 border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50">{t('garde.bureau.envoyer')}</button>
        </form>
      </section>

      {/* Les réglages, derrière une ligne : le mandat, sa parole du jour, le silence. */}
      <details className="rounded-xl border border-border bg-surface" data-reglages>
        <summary className="cursor-pointer px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.reglages')}{acc ? ` · ${t('garde.chef.reglagesResume', { mandats: Object.keys(acc.mandat.regles).length, dites: acc.budget.dites, max: acc.budget.max, de: acc.silence.de, a: acc.silence.a })}` : ''}</summary>
        <div className="grid gap-5 border-t border-border p-4 lg:grid-cols-3">
          <section aria-label={t('garde.chef.mandat')}>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.mandat')}</h2>
            <p className="mb-2 mt-1 text-[12px] text-text-muted">{t('garde.chef.mandatAide')}</p>
            {acc && Object.keys(acc.mandat.regles).length === 0 && <p className="font-mono text-xs text-text-muted">{t('garde.chef.mandatVide')}</p>}
            <ul className="flex flex-col divide-y divide-border">
              {acc && Object.entries(acc.mandat.regles).map(([cle, r]) => (
                <li key={cle} className="flex items-start gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-text-primary">« {r.decision} »</p>
                    <p className="font-mono text-[10px] text-text-muted">{r.agent} · {r.famille} · {r.par} · {relativeTime(r.at)}</p>
                  </div>
                  <button type="button" onClick={() => void retirer(cle)} className="min-h-9 border border-border px-2 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary">{t('garde.chef.retirer')}</button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label={t('garde.chef.budget')}>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.budget')}</h2>
            <p className="mb-2 mt-1 text-[12px] text-text-muted">{t('garde.chef.budgetAide', { chef: NOM_DU_CHEF })}</p>
            {acc && (
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-text-secondary">
                <p className="text-[13px] text-text-primary" data-budget={acc.budget.dites} data-budget-max={acc.budget.max}>{t('garde.chef.budgetJour', { dites: acc.budget.dites, max: acc.budget.max })}{acc.budget.retenues > 0 ? ` · ${t('garde.chef.budgetRetenues', { n: acc.budget.retenues })}` : ''}</p>
                <label className="flex items-center gap-1">{t('garde.chef.budgetMax')}
                  <select value={BUDGETS.includes(acc.budget.max) ? acc.budget.max : 6} onChange={(e) => void reglerBudget(Number(e.target.value))} aria-label={t('garde.chef.budgetMax')} className="input-focus bg-bg px-1 py-0.5 text-[12px] text-text-primary outline-none">
                    {BUDGETS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
            )}
          </section>
          <section aria-label={t('garde.chef.silence')}>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.silence')}</h2>
            <p className="mb-2 mt-1 text-[12px] text-text-muted">{t('garde.chef.silenceAide')}</p>
            {acc && (
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-secondary">
                <label className="flex items-center gap-1">{t('garde.chef.silenceDe')}
                  <select value={acc.silence.de} onChange={(e) => void reglerSilence({ de: Number(e.target.value) })} aria-label={`${t('garde.chef.silence')} ${t('garde.chef.silenceDe')}`} className="input-focus bg-bg px-1 py-0.5 text-[12px] text-text-primary outline-none">
                    {HEURES.map((h) => <option key={h} value={h}>{t('garde.commune.heures', { h })}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1">{t('garde.chef.silenceA')}
                  <select value={acc.silence.a} onChange={(e) => void reglerSilence({ a: Number(e.target.value) })} aria-label={`${t('garde.chef.silence')} ${t('garde.chef.silenceA')}`} className="input-focus bg-bg px-1 py-0.5 text-[12px] text-text-primary outline-none">
                    {HEURES.map((h) => <option key={h} value={h}>{t('garde.commune.heures', { h })}</option>)}
                  </select>
                </label>
              </div>
            )}
          </section>
        </div>
      </details>
    </section>
  );
}
