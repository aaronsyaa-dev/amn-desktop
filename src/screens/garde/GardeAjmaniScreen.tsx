import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Conversation, PoulsBadge } from '../../components/garde/GardeUi';
import { garde } from '../../lib/garde';
import { useLangue } from '../../i18n';
import { NOM_DU_CHEF } from '@edition/ajmani';
import { relativeTime } from '../../lib/time';
import type { GardeAccueil, GardeGeste, GardeGuideEntree } from '../../shared/garde';

/**
 * AJMANI, CHEF D'ÉTAT-MAJOR — l'écran où il parle en premier.
 *
 * Une seule proposition, choisie par une règle lisible côté serveur (le
 * critique d'abord, puis la pile, puis le tour des bureaux, puis une règle à
 * ajuster, sinon rien). Ses gestes tiennent en un bouton. Dessous : ce qu'il
 * ne sait pas, le guide « Que voulez-vous faire ? » dérivé du Lexique, la
 * conversation, le mandat, le silence, ses derniers mots, les ordres reçus.
 *
 * Aucune formulation ici : tout vient du Capitaine, avec ses preuves.
 */
const HEURES = Array.from({ length: 24 }, (_, h) => h);
const BUDGETS = [0, 2, 4, 6, 8, 10, 12];

export function GardeAjmaniScreen() {
  const { t } = useLangue();
  const [acc, setAcc] = useState<GardeAccueil | null>(null);
  const [guide, setGuide] = useState<GardeGuideEntree[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reponse, setReponse] = useState<{ texte: string; confirmation?: string; original?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const charger = useCallback(async () => {
    try {
      const [a, g] = await Promise.all([garde.accueil(), garde.guide()]);
      setAcc(a);
      setGuide(g.guide);
      setErreur(null);
    } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
  }, []);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => garde.onGarde((trame) => { if (['garde:remontee', 'garde:remontee-decidee', 'garde:releve', 'garde:ajmani', 'garde:mandat'].includes(trame.type)) void charger(); }), [charger]);

  const geste = async (g: GardeGeste, confirmer = false) => {
    if (busy) return;
    setBusy(true);
    try {
      if (g.dossier && g.decision) {
        const r = await garde.deciderDossier(g.dossier, g.decision);
        setReponse({ texte: t('garde.pile.decideDossier', { n: r.n }) });
      } else if (g.ordre) {
        const r = await garde.ordre(g.ordre, confirmer);
        setReponse({ texte: r.question ?? r.reponse, ...(r.confirmation ? { confirmation: r.confirmation, original: g.ordre } : {}) });
      }
      await charger();
    } catch (err) { setReponse({ texte: t('garde.erreur', { message: err instanceof Error ? err.message : String(err) }) }); } finally { setBusy(false); }
  };
  const reglerSilence = async (patch: { de?: number; a?: number }) => {
    if (!acc) return;
    await garde.reglages({ silence: { de: patch.de ?? acc.silence.de, a: patch.a ?? acc.silence.a } });
    await charger();
  };
  const retirer = async (cle: string) => { await garde.retirerMandat(cle); await charger(); };
  const reglerBudget = async (budgetParoles: number) => { await garde.reglages({ budgetParoles }); await charger(); };
  // La clôture du soir : un seul ordre, « je ferme pour ce soir » — le Capitaine dit ce qui attend et ce que la Garde fera cette nuit.
  const cloturer = () => geste({ label: t('garde.chef.cloture'), ordre: 'je ferme pour ce soir' });
  const familles: GardeGuideEntree['famille'][] = ['savoir', 'faire', 'regler'];
  const rapides = guide.map((g) => ({ label: g.libelle, texte: g.exemple }));

  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.chef.titre', { chef: NOM_DU_CHEF })} description={t('garde.chef.description')} stats={acc ? [{ label: t('garde.pile.dossiers'), value: acc.pile.compte.dossiers, emphasis: acc.pile.compte.critiques > 0 }, { label: t('garde.gravite.critique'), value: acc.pile.compte.critiques, emphasis: acc.pile.compte.critiques > 0 }, { label: t('garde.chef.mandat'), value: Object.keys(acc.mandat.regles).length }] : []} />
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          {/* Il parle en premier : une seule proposition, ses gestes. */}
          <section className="rounded-xl border border-border-strong bg-surface p-4" aria-label={t('garde.chef.parole')} aria-live="polite">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.parole')}</h2>
              {acc && <PoulsBadge pouls={acc.pouls} compact />}
              {acc && <span className={`font-mono text-[10px] uppercase tracking-widest ${acc.silence.actif ? 'text-warning' : 'text-text-muted'}`}>{acc.silence.actif ? t('garde.chef.silenceActif') : t('garde.chef.silenceInactif')} · {acc.silence.de} h – {acc.silence.a} h</span>}
            </div>
            {!acc && !erreur && <p className="font-mono text-xs text-text-muted">{t('garde.salle.chargement')}</p>}
            {acc && (
              <>
                <p className="text-[13px] text-text-secondary">{acc.salut}</p>
                <p className="mt-2 text-base font-semibold leading-snug text-text-primary" data-proposition={acc.proposition.cle}>{acc.proposition.texte}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {acc.proposition.gestes.map((g) => g.vers
                    ? <Link key={g.label} to={g.vers} className="min-h-11 border border-border px-3 text-sm text-text-primary hover:border-border-strong md:min-h-0 md:py-1.5">{g.label}</Link>
                    : <button key={g.label} type="button" disabled={busy} onClick={() => void geste(g)} className="min-h-11 border border-accent bg-accent px-3 text-sm font-medium text-bg hover:bg-accent-hover disabled:opacity-50 md:min-h-0 md:py-1.5">{g.label}</button>)}
                  <button type="button" disabled={busy} onClick={() => void cloturer()} data-cloture title={t('garde.chef.clotureAide')} className="min-h-11 border border-border px-3 text-sm text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50 md:min-h-0 md:py-1.5">{t('garde.chef.cloture')}</button>
                </div>
                {reponse && (
                  <div className="mt-3 whitespace-pre-line rounded-lg border border-border bg-bg px-3 py-2 text-[13px] leading-relaxed text-text-primary" data-chef-reponse>
                    {reponse.texte}
                    {reponse.confirmation && reponse.original && (
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => void geste({ label: '', ordre: reponse.original }, true)} className="border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-bg">{t('garde.bureau.confirmer')}</button>
                        <button type="button" onClick={() => setReponse({ texte: t('garde.bureau.annuler') })} className="border border-border px-2.5 py-1 text-xs text-text-muted">{t('garde.bureau.annuler')}</button>
                      </div>
                    )}
                  </div>
                )}
                {acc.aveux.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.chef.saitPas')}</h3>
                    <ul className="mt-1 flex flex-col gap-1">
                      {acc.aveux.map((x) => <li key={x} className="text-[13px] leading-relaxed text-text-secondary">{x}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Le guide, puis la conversation : on lui parle ; il répond avec ses preuves, ou dit qu'il ne sait pas. */}
          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.chef.guide')}>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.guide')}</h2>
            <p className="mb-3 mt-1 text-[12px] text-text-muted">{t('garde.chef.guideAide')}</p>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {familles.map((f) => (
                <div key={f}>
                  <h3 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">{t(`garde.chef.famille.${f}`)}</h3>
                  <ul className="flex flex-col gap-0.5">
                    {guide.filter((g) => g.famille === f).map((g) => <li key={g.intention} className="text-[12px] text-text-secondary" title={g.exemple}>{g.libelle}{g.modifie ? <span className="text-text-muted"> ·</span> : null}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <Conversation envoyer={async (texte, confirmer) => { const r = await garde.ordre(texte, confirmer); void charger(); return r; }} rapides={rapides} aide={t('garde.bureau.questionAide')} />
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.chef.mandat')}>
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
                  <button type="button" onClick={() => void retirer(cle)} className="min-h-11 border border-border px-2 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-0.5">{t('garde.chef.retirer')}</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.chef.budget')}>
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

          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.chef.silence')}>
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

          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.chef.derniersMots')}>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.derniersMots')}</h2>
            {acc && acc.messages.length === 0 && <p className="font-mono text-xs text-text-muted">{t('garde.chef.rienDit')}</p>}
            <ol className="flex flex-col gap-2">
              {acc?.messages.map((m) => <li key={m.id} className="text-[13px] leading-relaxed text-text-secondary"><span className="font-mono text-[10px] text-text-muted">{relativeTime(m.createdAt)} · </span>{m.texte}</li>)}
            </ol>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.chef.ordres')}>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.ordres')}</h2>
            {acc && acc.ordres.length === 0 && <p className="font-mono text-xs text-text-muted">{t('garde.chef.ordresVide')}</p>}
            <ol className="flex flex-col divide-y divide-border">
              {acc?.ordres.map((o) => (
                <li key={o.id} className="py-2">
                  <p className="text-[13px] text-text-primary">{o.texte}</p>
                  <p className="font-mono text-[10px] text-text-muted">{o.etat}{o.intention ? ` · ${o.intention}` : ''} · {o.auteurEmail} · {relativeTime(o.createdAt)}</p>
                  {o.reponse && <p className="mt-0.5 line-clamp-2 text-[12px] text-text-secondary">{o.reponse}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </section>
  );
}
