import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useHaloSignal } from '../../components/EtatEcran';
import { PoulsBadge } from '../../components/garde/GardeUi';
import { Depliable } from '../../components/Depliable';
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
/* La voix comptée : une marque de 44 px par parole du jour. */
const MARQUE_H = 44;
/* La règle du silence : vingt-quatre heures, et rien d'autre. Toute position s'en déduit. */
const AXE_H = 34;
const pct = (heures: number) => (heures / 24) * 100;
interface Bulle { de: 'moi' | 'chef'; texte: string; confirmation?: string; original?: string; at?: string }

export function GardeAjmaniScreen() {
  const { t, langue } = useLangue();
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
  /* Le halo ne bat que s'il reste une parole : budget épuisé, il n'y a plus d'ambre sur l'écran. */
  const halo = useHaloSignal(Boolean(acc) && (acc?.budget.max ?? 0) - (acc?.budget.dites ?? 0) > 0);

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

      {/* ═══ L'OBJET DOMINANT : sa proposition, et le budget qui la rend chère ═══
          La contrainte du module EST l'objet : Ajmani n'a droit qu'à six paroles
          de lui-même par jour. Un assistant qui parle à volonté n'a pas de
          valeur à ce qu'il dit ; un budget visible en donne à chaque phrase.

          L'AMBRE, unique : la ou les marques restantes du budget, et leur
          libellé. PAS la proposition, qui reste en encre claire. */}
      <section className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" aria-label={t('garde.chef.conversation')} aria-live="polite">
        {!acc && !erreur && <p className="font-mono text-xs text-text-muted">{t('garde.salle.chargement')}</p>}
        {acc && (
          <>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.saProposition')}</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.chef.deterministe')}</span>
            </div>

            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_292px] lg:gap-[38px]">
              <div className="min-w-0">
                <div className="border-l-2 border-[#4a4a48] bg-sunken px-6 py-[22px]">
                  <span className="flex flex-wrap items-center gap-2 pb-2.5"><PoulsBadge pouls={acc.pouls} compact />{acc.silence.actif && <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.chef.silenceActif')}</span>}</span>
                  <p className="text-[15px] leading-relaxed text-text-secondary">{acc.salut}</p>
                  <p className="mt-2 text-[27px] font-bold leading-[1.28] tracking-[-0.025em] text-text-primary [text-wrap:pretty]" data-proposition={acc.proposition.cle}>{acc.proposition.texte}</p>
                  {acc.aveux.length > 0 && <p className="mt-2 text-[12px] text-text-muted">{acc.aveux.join(' ')}</p>}
                  {/* Un geste porte parfois la recommandation entière du Capitaine — trois lignes de texte.
                      Une hauteur FIXE les faisait se chevaucher : la hauteur vient du libellé, pas l'inverse. */}
                  <div className="mt-5 flex flex-wrap items-stretch gap-[9px]">
                    {acc.proposition.gestes.slice(0, 3).map((g) => g.vers
                      ? <Link key={g.label} to={g.vers} className="flex min-h-[30px] max-w-full items-center border border-border-strong px-[13px] py-1.5 text-left text-[12.5px] font-semibold leading-snug text-text-body hover:bg-surface-hover">{g.label}</Link>
                      : <button key={g.label} type="button" disabled={busy} onClick={() => void geste(g)} className="flex min-h-[30px] max-w-full items-center border border-border-strong px-[13px] py-1.5 text-left text-[12.5px] font-semibold leading-snug text-text-body hover:bg-surface-hover disabled:opacity-50">{g.label}</button>)}
                    <button type="button" disabled={busy} onClick={() => void dire('je ferme pour ce soir')} data-cloture className="flex min-h-[30px] max-w-full items-center border border-dashed border-border-strong px-[13px] py-1.5 text-left text-[12.5px] font-semibold leading-snug text-text-secondary hover:text-text-primary disabled:opacity-50">{t('garde.chef.cloture')}</button>
                  </div>
                </div>

                {/* Trois suites AU PLUS — jamais quatre. */}
                <span className="mt-[22px] block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">{t('garde.chef.sesSuites')}</span>
                <div className="mt-3 flex flex-wrap gap-[9px]" data-suites={suitesAffichees.length}>
                  {suitesAffichees.slice(0, 3).map((s2) => (
                    <button key={s2} type="button" disabled={busy} onClick={() => void dire(s2)} className="min-w-0 flex-1 border border-border-sheet bg-surface-hover px-3.5 py-[13px] text-left text-[13px] font-semibold text-text-body hover:border-border-strong disabled:opacity-50 [text-wrap:pretty]">{s2}</button>
                  ))}
                </div>

                {/* LA VOIX COMPTÉE. Une marque par parole du jour : dépensée en gris, restante en ambre.
                    Budget à zéro, il n'y a pas d'ambre du tout — un signal qui ne signale rien ne doit pas briller. */}
                {(() => {
                  const marques = Math.max(acc.budget.max, acc.budget.dites);
                  const reste = Math.max(0, acc.budget.max - acc.budget.dites);
                  return (
                    <div className="mt-[26px] border-t border-border-raised pt-5" data-budget={acc.budget.dites} data-budget-max={acc.budget.max}>
                      {reste > 0
                        ? <span data-signal-groupe="voix-comptee" className={`signal-plate inline-flex px-2 py-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] ${halo}`}>{t(reste > 1 ? 'garde.chef.resteParoles' : 'garde.chef.resteParole', { n: reste })}</span>
                        : <span className="inline-flex font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-text-muted">{t('garde.chef.plusDeParole')}</span>}
                      {marques > 0 && (
                        <div className="mt-3 flex gap-1.5" role="img" aria-label={t('garde.chef.budgetJour', { dites: acc.budget.dites, max: acc.budget.max })}>
                          {/*
                            L'AMBRE NE PREND QU'UNE MARQUE : LA DERNIÈRE.

                            Toutes les marques restantes en ambre, c'est six barres qui
                            brillent le matin quand rien n'a encore été dit — l'ambre
                            redevient la couleur de la marque, ce que tout le système
                            existe pour éviter. La marque ambre est donc celle où sa
                            parole S'ARRÊTE ; les autres restantes sont en encre de
                            remplissage, les dépensées en gris de bordure. Sur le cas
                            de la maquette (cinq dites sur six) les deux lectures
                            coïncident exactement.
                          */}
                          {Array.from({ length: marques }, (_, i) => {
                            const depensee = i < acc.budget.dites;
                            const derniere = i === marques - 1 && !depensee;
                            return (
                              <span
                                key={i}
                                data-signal-groupe={derniere ? 'voix-comptee' : undefined}
                                className="flex-1"
                                style={{
                                  height: MARQUE_H,
                                  background: derniere ? 'var(--color-signal)' : depensee ? 'var(--color-border-strong)' : '#4a4a48',
                                  boxShadow: derniere ? '0 0 22px -3px var(--color-signal-glow)' : undefined,
                                }}
                              />
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-2.5 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">
                        <span>{t('garde.chef.ditesAujourdhui', { n: acc.budget.dites })}</span>
                        <span>{t('garde.chef.budgetDuJour', { n: acc.budget.max })}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex min-w-0 flex-col gap-[22px]">
                {/* LE SILENCE DE NUIT sur une règle de 24 h. Rien n'est posé à la main :
                    chaque bande et le repère de l'heure courante sortent de `pct()`. Quand le
                    silence enjambe minuit (22 h → 7 h), ce sont DEUX bandes, pas une bande
                    inversée — une plage qui repart de zéro se dessine en deux morceaux. */}
                <div>
                  <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">{t('garde.chef.silenceDeNuit')}</span>
                  {(() => {
                    const d = new Date();
                    const heureCourante = d.getHours() + d.getMinutes() / 60;
                    const { de, a } = acc.silence;
                    const bandes = de === a ? [] : de > a ? [[0, a], [de, 24]] : [[de, a]];
                    /* Un repère d'heure ronde que l'heure courante recouvre s'efface : deux étiquettes superposées n'en font aucune de lisible. */
                    const maintenantTexte = d.toLocaleTimeString(langue === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
                    const bornes = de === a ? [] : [{ h: a, texte: t('garde.commune.heures', { h: a }) }, { h: de, texte: t('garde.commune.heures', { h: de }) }];
                    /* Le seuil se mesure en POURCENTAGE de la règle, pas en heures : c'est la place
                       qu'occupe une étiquette qui décide, et douze pour cent de 24 h font trois heures. */
                    const colleAMaintenant = (h: number) => Math.abs(pct(h) - pct(heureCourante)) < 12;
                    const reperes = [{ h: 0, texte: '00' }, ...bornes.filter((b) => !colleAMaintenant(b.h)), { h: heureCourante, texte: maintenantTexte }].sort((x, y) => x.h - y.h);
                    return (
                      <>
                        <div className="relative mt-3 overflow-hidden border border-border-raised bg-sunken" style={{ height: AXE_H }} role="img" aria-label={t('garde.chef.silencePhrase')}>
                          {bandes.map(([x1, x2]) => (
                            <span
                              key={`${x1}-${x2}`}
                              className="absolute inset-y-0 bg-surface-hover"
                              style={{ left: `${pct(x1)}%`, width: `${pct(x2 - x1)}%`, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.04) 0 2px, transparent 2px 6px)' }}
                            />
                          ))}
                          <span className="absolute -top-[3px] -bottom-[3px] w-0.5 bg-text-primary" style={{ left: `${pct(heureCourante)}%` }} />
                        </div>
                        {/* La rangée de graduations partage l'échelle de ce qu'elle gradue : chaque repère est posé à son pourcentage, pas réparti à intervalles égaux. */}
                        <div className="relative mt-2 h-3.5">
                          {reperes.map((r) => (
                            <span
                              key={r.texte}
                              className="absolute top-0 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.08em] text-text-muted"
                              style={{ left: `${pct(r.h)}%`, transform: r.h <= 0.5 ? 'none' : r.h >= 23.5 ? 'translateX(-100%)' : 'translateX(-50%)' }}
                            >{r.texte}</span>
                          ))}
                        </div>
                        <p className="mt-3 text-[12.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">{de === a ? t('garde.chef.silenceJamais') : t('garde.chef.silencePhrase')}</p>
                      </>
                    );
                  })()}
                </div>

                <div className="flex flex-col gap-3.5 border-t border-border-raised pt-[18px]">
                  <span>
                    <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{t('garde.chef.mandatsDonnes')}</span>
                    <span className="mt-1.5 block font-mono text-[19px] font-semibold tabular-nums tracking-tight text-text-primary">{Object.keys(acc.mandat.regles).length}</span>
                  </span>
                  <span>
                    <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{t('garde.chef.paroleRejetee')}</span>
                    {/* Le rejet est compté par la garde des faits, côté serveur. Sans cerveau déclaré, il n'y a rien à compter — et un zéro le dirait à tort. */}
                    <span className="mt-1.5 block font-mono text-[19px] font-semibold tabular-nums tracking-tight text-text-primary">{acc.cerveau ? acc.cerveau.budget.rejets : '—'}</span>
                  </span>
                  <span>
                    <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{t('garde.chef.modele')}</span>
                    <span className="mt-1.5 block font-mono text-[19px] font-semibold tracking-tight text-text-primary">{t('garde.chef.modeleAucun')}</span>
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Les échanges : l'historique relu du serveur, plié, puis ce qui vient d'être dit. */}
        <section className="min-w-0 border border-border bg-surface px-[22px] py-5" aria-label={t('garde.chef.echanges')}>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.echanges')}</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.chef.echangesLegende')}</span>
          </div>
          {historique.length === 0 && fil.length === 0 && <p className="text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.chef.aucunEchange')}</p>}
          <ol className="flex flex-col gap-3.5">
            {historique.slice(-8).map((m, i) => (
              <li key={`h${i}`} title={m.at ? relativeTime(m.at) : undefined}>
                {m.de === 'moi'
                  ? <span className="block text-[13px] text-text-muted">{m.texte}</span>
                  : <Depliable lignes={3}><span className="mt-1.5 block whitespace-pre-line text-[13.5px] leading-relaxed text-text-body [text-wrap:pretty]">{m.texte}</span></Depliable>}
              </li>
            ))}
            {fil.map((m, i) => (
              <motion.li key={`f${i}`} {...arrivee} data-chef-reponse={m.de === 'chef' ? '' : undefined}>
                {m.de === 'moi'
                  ? <span className="block text-[13px] text-text-muted">{m.texte}</span>
                  : <span className="mt-1.5 block whitespace-pre-line text-[13.5px] leading-relaxed text-text-body [text-wrap:pretty]">{m.texte}</span>}
                {m.confirmation && m.original && (
                  <span className="mt-2 flex gap-2">
                    <button type="button" onClick={() => void dire(m.original as string, true)} className="border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-bg">{t('garde.bureau.confirmer')}</button>
                    <button type="button" onClick={() => setFil((f) => [...f, { de: 'chef', texte: t('garde.bureau.annuler') }])} className="border border-border px-2.5 py-1 text-xs text-text-muted">{t('garde.bureau.annuler')}</button>
                  </span>
                )}
              </motion.li>
            ))}
          </ol>
          <div ref={bas} />
          <form className="mt-5 flex gap-2 border-t border-border pt-4" onSubmit={(e) => { e.preventDefault(); void dire(texte); }}>
            <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t('garde.bureau.question')} aria-label={t('garde.bureau.question')} autoComplete="off" className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            <button type="submit" disabled={busy || !texte.trim()} className="min-h-11 border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50">{t('garde.bureau.envoyer')}</button>
          </form>
        </section>

        <section className="flex flex-col border border-border bg-surface px-5 py-5" aria-label={t('garde.chef.neFaitPas')}>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.neFaitPas')}</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {[t('garde.chef.neFaitPas1'), t('garde.chef.neFaitPas2'), t('garde.chef.neFaitPas3')].map((ligne) => (
              <li key={ligne} className="flex gap-2.5">
                <span aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-none border border-border-strong" />
                <span className="flex-1 text-[13px] leading-snug text-text-body [text-wrap:pretty]">{ligne}</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-[18px] text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.chef.horsGarde')}</p>
        </section>
      </div>

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
          {/* Son cerveau : en ligne ou non, et ce qu'il a coûté ce mois-ci. Sans clé, il le dit ; il ne se règle pas d'ici (la clé vit sur le serveur). */}
          {acc?.cerveau !== undefined && (
            <section aria-label={t('garde.chef.cerveau')} data-cerveau={acc.cerveau ? (acc.cerveau.actif && !acc.cerveau.budget.epuise ? 'actif' : acc.cerveau.raison ?? 'inactif') : 'absent'}>
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.chef.cerveau')}</h2>
              <p className="mt-1 text-[13px] text-text-primary">
                {!acc.cerveau ? t('garde.chef.cerveauAbsent')
                  : acc.cerveau.raison === 'sans_cle' ? t('garde.chef.cerveauSansCle')
                    : acc.cerveau.raison === 'budget' ? t('garde.chef.cerveauBudget', { cout: acc.cerveau.budget.cout, eur: acc.cerveau.budget.eur })
                      : t('garde.chef.cerveauActif', { cout: acc.cerveau.budget.cout, eur: acc.cerveau.budget.eur, appels: acc.cerveau.budget.appels })}
              </p>
              {acc.cerveau && acc.cerveau.budget.rejets > 0 && <p className="text-[11px] text-text-muted">{t('garde.chef.cerveauRejets', { n: acc.cerveau.budget.rejets })}</p>}
            </section>
          )}
        </div>
      </details>
    </section>
  );
}
