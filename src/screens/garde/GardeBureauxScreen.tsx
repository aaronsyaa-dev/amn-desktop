import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useHaloSignal } from '../../components/EtatEcran';
import { Conversation, EtatPoint, GraviteChip, JournalLigne } from '../../components/garde/GardeUi';
import { ComptesBureau } from '../../components/garde/ComptesBureau';
import { garde, domaineDEquipe, motDeParametre } from '../../lib/garde';
import { useLangue } from '../../i18n';
import { relativeTime } from '../../lib/time';
import type { GardeBureau, GardeEquipe, GardeSalle } from '../../shared/garde';

/* ── LE CALQUE ────────────────────────────────────────────────────────
   Le relevé fait 210 px de haut ; toute ordonnée s'en déduit. La fenêtre
   rejouée est celle du serveur : trente jours (`capitaine.js`, `etSi`). */
const PLOT_H = 210;
/** Une marge haute et basse : sans elle, une trace à zéro se confond avec la bordure du relevé et l'on croit qu'il n'y a pas de trace. */
const PLOT_MARGE = 6;
const FENETRE_JOURS = 30;

/**
 * LES BUREAUX DES CHEFS DE GARDE — on entre, on parle, il répond avec ses preuves.
 *
 * Chaque chef tient l'historique de tout ce que son équipe a fait ; Aaron
 * pointe une action et la marque « mauvaise » : le chef ordonne la
 * correction (annulation si c'est réversible, plan sinon), tout est tracé, et
 * la règle qui l'a produite est comptée puis, s'il le faut, proposée à
 * l'ajustement. Le Capitaine a son bureau aussi.
 */
export function GardeBureauxScreen() {
  const { equipe } = useParams<{ equipe?: string }>();
  const [salle, setSalle] = useState<GardeSalle | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => { garde.salle().then(setSalle).catch((err) => setErreur(err instanceof Error ? err.message : String(err))); }, []);

  if (equipe) return <Bureau equipeKey={equipe} definition={salle?.equipes.find((e) => e.key === equipe) ?? null} />;
  return <Bureaux salle={salle} erreur={erreur} />;
}

/**
 * LES BUREAUX — le calque.
 *
 * On pose une question à un chef, il répond avec ses preuves. Et on peut lui
 * demander « et si ? » : il rejoue le mois écoulé avec la règle changée, et le
 * résultat hypothétique se pose PAR-DESSUS le réel, sur le même axe. On ne
 * compare pas deux nombres, on regarde si les deux traces se séparent.
 *
 * L'AMBRE, unique : la plaque de verdict et son relevé. Deux nœuds, une plaque.
 * Tant qu'aucun « et si ? » n'a été joué, il n'y a pas d'ambre du tout.
 *
 * CE QUE LE PRODUIT PERMET, ET CE QU'IL NE PERMET PAS ENCORE. La maquette
 * trace deux courbes jour par jour. `regle.rejouer()` (amn-api,
 * `src/garde/equipes/*.js`) ne rend qu'un TOTAL sur la fenêtre de trente
 * jours — il n'existe aucune série quotidienne à tracer. Plutôt que d'inventer
 * trente jours faux, le calque se lit ici sur un seul axe : deux niveaux
 * superposés, trait plein pour le réel, pointillé pour l'hypothèse. Quand ils
 * se recouvrent, on le voit sans lire un chiffre — l'argument de l'instrument
 * est tenu. Le jour où `etSi` rendra `serieAvant` / `serieApres`, le tracé
 * temporel s'affiche tout seul : le code les lit déjà.
 */
function Bureaux({ salle, erreur }: { salle: GardeSalle | null; erreur: string | null }) {
  const { t } = useLangue();
  const [choix, setChoix] = useState<string>('');
  const [valeur, setValeur] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [calque, setCalque] = useState<{ parametre: string; valeur: number; actuelle: number; avant: number; apres: number; serieAvant?: number[]; serieApres?: number[] } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /* Toutes les règles rejouables du parc, à plat : « équipe/agent/règle/paramètre ». */
  const rejouables = useMemo(() => (salle?.equipes ?? []).flatMap((e) => e.agents.flatMap((a) => Object.entries(a.regles)
    .filter(([, r]) => r.rejouable && Object.keys(r.parametres).length > 0)
    .map(([k, r]) => {
      const parametre = Object.keys(r.parametres)[0];
      const agentEtat = salle?.agents.find((x) => x.key === a.key);
      const actuelle = Number((agentEtat?.parametres?.[k] as Record<string, unknown> | undefined)?.[parametre] ?? r.parametres[parametre]);
      return { id: `${a.key}|${k}`, agent: a.key, regle: k, parametre, actuelle, libelle: `${a.nom} · ${r.description}`, equipe: e.nom };
    }))), [salle]);
  const choisie = rejouables.find((r) => r.id === choix) ?? rejouables[0] ?? null;

  const rejouer = async () => {
    if (!choisie || busy) return;
    const v = Number(valeur === '' ? choisie.actuelle : valeur);
    if (!Number.isFinite(v)) return;
    setBusy(true);
    try {
      const r = await garde.etSi(choisie.agent, choisie.regle, choisie.parametre, v);
      if (r.avant === null || r.apres === null) { setCalque(null); setNote(r.note ?? t('garde.bureaux.rejoueImpossible')); }
      else { setNote(null); setCalque({ parametre: choisie.parametre, valeur: v, actuelle: r.actuelle ?? choisie.actuelle, avant: r.avant, apres: r.apres, serieAvant: r.serieAvant, serieApres: r.serieApres }); }
    } catch (err) { setCalque(null); setNote(t('garde.erreur', { message: err instanceof Error ? err.message : String(err) })); }
    finally { setBusy(false); }
  };

  const ecart = calque ? calque.apres - calque.avant : 0;
  const halo = useHaloSignal(calque !== null && !(calque.avant === 0 && calque.apres === 0));

  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.bureaux.titre')} description={t('garde.bureaux.description')} />
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}

      {/* ═══ L'OBJET DOMINANT : le calque ═══ */}
      <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            {calque ? t('garde.bureaux.etSiQuestion', { parametre: motDeParametre(calque.parametre), valeur: calque.valeur }) : t('garde.bureaux.rejouer')}
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.bureaux.calqueLegende')}</span>
        </div>

        <form className="mb-5 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void rejouer(); }}>
          <label className="flex min-w-0 flex-1 flex-col gap-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">
            {t('garde.bureaux.laRegle')}
            <select value={choisie?.id ?? ''} onChange={(e) => { setChoix(e.target.value); setValeur(''); setCalque(null); setNote(null); }} className="input-focus min-h-9 w-full border border-border bg-bg px-2 text-[12.5px] normal-case tracking-normal text-text-primary outline-none">
              {rejouables.map((r) => <option key={r.id} value={r.id}>{domaineDEquipe(r.equipe)} · {r.libelle}</option>)}
            </select>
          </label>
          <label className="flex w-28 flex-col gap-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">
            {t('garde.bureaux.laValeur')}
            <input type="number" inputMode="numeric" value={valeur} placeholder={choisie ? String(choisie.actuelle) : ''} onChange={(e) => setValeur(e.target.value)} className="input-focus min-h-9 border border-border bg-bg px-2 text-[12.5px] tracking-normal text-text-primary outline-none" />
          </label>
          <button type="submit" disabled={busy || !choisie} className="flex h-9 items-center border border-border-strong px-[13px] text-[12.5px] font-semibold text-text-body hover:bg-surface-hover disabled:opacity-50">{t('garde.bureaux.rejouer')}</button>
        </form>

        {note && <p className="mb-4 text-[13px] text-text-secondary">{note}</p>}

        {calque ? (() => {
          /* L'échelle : un seul maximum pour les deux traces, sinon la superposition ne voudrait rien dire. */
          const toutes = [calque.avant, calque.apres, ...(calque.serieAvant ?? []), ...(calque.serieApres ?? [])];
          const max = Math.max(1, ...toutes);
          const y = (v: number) => PLOT_H - PLOT_MARGE - (v / max) * (PLOT_H - 2 * PLOT_MARGE);
          /* Les graduations se dédoublonnent : à max = 1, « 1 · 1 · 0 » poserait deux fois la même. */
          const graduations = [...new Set([max, Math.round(max / 2), 0])];
          const rien = calque.avant === 0 && calque.apres === 0;
          const chemin = (serie: number[]) => serie.map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / Math.max(1, serie.length - 1)) * 1000).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
          const temporel = Boolean(calque.serieAvant?.length && calque.serieApres?.length);
          const debutFenetre = new Date(Date.now() - FENETRE_JOURS * 86_400_000);
          const jourCourt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
          return (
            <>
              <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
                {/* Les graduations d'ordonnée sont posées à leur hauteur réelle, jamais réparties à intervalles égaux. */}
                <div className="relative font-mono text-[9.5px] text-text-muted" style={{ height: PLOT_H }}>
                  {graduations.map((v) => (
                    <span key={v} className="absolute right-0 tabular-nums" style={{ bottom: PLOT_MARGE + (v / max) * (PLOT_H - 2 * PLOT_MARGE) - 5 }}>{v}</span>
                  ))}
                </div>
                <div>
                  <div
                    className="relative overflow-hidden border border-border-raised bg-sunken"
                    style={{ height: PLOT_H, backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0 1px, transparent 1px ${(100 / FENETRE_JOURS).toFixed(2)}%)` }}
                    role="img"
                    aria-label={t('garde.bureaux.auLieuDe', { apres: calque.apres, avant: calque.avant })}
                  >
                    <svg viewBox={`0 0 1000 ${PLOT_H}`} preserveAspectRatio="none" className="absolute inset-0 block h-full w-full" aria-hidden>
                      {temporel ? (
                        <>
                          <path d={chemin(calque.serieAvant ?? [])} fill="none" stroke="#4a4a48" strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
                          <path d={chemin(calque.serieApres ?? [])} fill="none" stroke="var(--color-text-body)" strokeWidth={1.4} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
                        </>
                      ) : (
                        <>
                          <path d={`M0 ${y(calque.avant)} L1000 ${y(calque.avant)}`} fill="none" stroke="#4a4a48" strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
                          <path d={`M0 ${y(calque.apres)} L1000 ${y(calque.apres)}`} fill="none" stroke="var(--color-text-body)" strokeWidth={1.4} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
                        </>
                      )}
                    </svg>
                    <span className="absolute left-3.5 top-3 flex flex-col gap-1.5">
                      <span className="flex items-center gap-[7px]">
                        <span aria-hidden className="h-[3px] w-3.5 bg-[#4a4a48]" />
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-text-muted">{t('garde.bureaux.reel', { parametre: motDeParametre(calque.parametre), valeur: calque.actuelle, n: calque.avant })}</span>
                      </span>
                      <span className="flex items-center gap-[7px]">
                        <span aria-hidden className="h-0.5 w-3.5 bg-text-body" />
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-text-secondary">{t('garde.bureaux.calque', { parametre: motDeParametre(calque.parametre), valeur: calque.valeur, n: calque.apres })}</span>
                      </span>
                    </span>
                  </div>
                  {/* La rangée d'abscisses partage la largeur de ce qu'elle gradue : début, milieu, fin de la fenêtre rejouée. */}
                  <div className="relative mt-2.5 h-3.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-muted">
                    <span className="absolute left-0">{jourCourt(debutFenetre)}</span>
                    <span className="absolute left-1/2 -translate-x-1/2">{jourCourt(new Date(Date.now() - (FENETRE_JOURS / 2) * 86_400_000))}</span>
                    <span className="absolute right-0">{jourCourt(new Date())}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-stretch gap-[18px]">
                {/* Un mois qui n'a rien produit n'a pas de verdict à rendre : pas de plaque, donc pas d'ambre. Un « 0 au lieu de 0 » en ambre crierait un résultat là où il n'y a eu aucune mesure. */}
                {!rien && (
                  <div data-signal-groupe="verdict" className={`signal-plate flex flex-none flex-col justify-center px-5 py-[15px] ${halo}`}>
                    <span data-signal-groupe="verdict" className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] opacity-80">
                      {ecart === 0 ? t('garde.bureaux.aucunEcart') : ecart > 0 ? t('garde.bureaux.ecartPlus', { n: ecart }) : t('garde.bureaux.ecartMoins', { n: -ecart })}
                    </span>
                    <span data-signal-groupe="verdict" className="mt-[7px] font-mono text-[23px] font-bold tabular-nums tracking-[-0.03em]">{t('garde.bureaux.auLieuDe', { apres: calque.apres, avant: calque.avant })}</span>
                  </div>
                )}
                <div className="flex min-w-[16rem] flex-1 flex-col justify-center gap-2.5">
                  <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
                    {rien ? t('garde.bureaux.rienAJouer') : ecart === 0 ? t('garde.bureaux.verdictIdentique') : t('garde.bureaux.verdictEcart', { apres: calque.apres, avant: calque.avant })}
                  </p>
                  {!temporel && <p className="text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">{t('garde.bureaux.sansSerie')}</p>}
                  <button type="button" onClick={() => setCalque(null)} className="flex h-[30px] self-start items-center border border-border-strong px-[13px] text-[12.5px] font-semibold text-text-body hover:bg-surface-hover">
                    {t('garde.bureaux.garder', { parametre: motDeParametre(calque.parametre), valeur: calque.actuelle })}
                  </button>
                </div>
              </div>
            </>
          );
        })() : (
          <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.bureaux.avantDeJouer')}</p>
        )}
      </article>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 border border-border bg-surface px-[22px] py-5" aria-label={t('garde.bureaux.septBureaux')}>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureaux.septBureaux')}</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.bureaux.septLegende')}</span>
          </div>
          <ul>
            <li className="grid grid-cols-[104px_minmax(0,1fr)_56px] items-baseline gap-4 border-b border-border-row py-2.5">
              <Link to="/garde/bureaux/capitaine" className="truncate text-[13.5px] font-semibold text-text-primary hover:underline">{t('garde.bureaux.capitaine')}</Link>
              <span className="text-[12.5px] text-text-secondary [text-wrap:pretty]">{t('garde.bureaux.capitaineRole')}</span>
              <span className="text-right font-mono text-[12px] tabular-nums text-text-muted">—</span>
            </li>
            {(salle?.equipes ?? []).map((e) => (
              <li key={e.key} className="grid grid-cols-[104px_minmax(0,1fr)_56px] items-baseline gap-4 border-b border-border-row py-2.5 last:border-b-0">
                <Link to={`/garde/bureaux/${e.key}`} title={e.nom} className="truncate text-[13.5px] font-semibold text-text-primary hover:underline">{domaineDEquipe(e.nom)}</Link>
                <span className="text-[12.5px] text-text-secondary [text-wrap:pretty]">{e.agents.map((a) => a.nom.toLowerCase()).join(', ')}</span>
                <span className="text-right font-mono text-[12px] tabular-nums text-text-muted">{e.agents.reduce((n, a) => n + Object.values(a.regles).filter((r) => Object.keys(r.parametres).length > 0).length, 0)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col border border-border bg-surface px-5 py-5" aria-label={t('garde.bureaux.saReponse')}>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureaux.saReponse')}</h2>
          <p className="mt-4 text-[13.5px] leading-relaxed text-text-body [text-wrap:pretty]">{t('garde.bureaux.preuvePhrase')}</p>
          <p className="mt-auto pt-[18px] text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.bureaux.etSiNeReglePas')}</p>
        </section>
      </div>
    </section>
  );
}

function Bureau({ equipeKey, definition }: { equipeKey: string; definition: GardeEquipe | null }) {
  const { t } = useLangue();
  const [bureau, setBureau] = useState<GardeBureau | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [couloirs, setCouloirs] = useState<Record<string, { min: string; max: string }>>({});
  const [toutJournal, setToutJournal] = useState(false);
  const charger = useCallback(async () => {
    try { setBureau(await garde.bureau(equipeKey)); setErreur(null); } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
  }, [equipeKey]);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => garde.onGarde((trame) => { if (['garde:journal', 'garde:remontee', 'garde:ronde', 'garde:correction'].includes(trame.type)) void charger(); }), [charger]);
  const c = bureau?.comptes ?? {};
  const rapides = [t('garde.bureau.q.nuit'), t('garde.bureau.q.semaine'), t('garde.bureau.q.quoi'), ...(equipeKey === 'capitaine' ? [] : [t('garde.bureau.q.ronde')])];

  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader
        eyebrow={`${t('garde.surtitre')} · ${t('garde.bureaux.titre')}`}
        title={bureau?.equipe.chef.nom ?? '…'}
        description={bureau ? `${bureau.equipe.nom} · ${bureau.equipe.chef.role}` : ''}
        stats={bureau ? [{ label: t('garde.bureau.regles'), value: c.regle ?? 0 }, { label: t('garde.bureau.remontes'), value: c.remonte ?? 0, emphasis: (c.remonte ?? 0) > 0 }, { label: t('garde.bureau.echecs'), value: c.echec ?? 0, emphasis: (c.echec ?? 0) > 0 }] : []}
      >
        <Link to="/garde/bureaux" className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-[12px] text-text-secondary hover:border-border-strong hover:text-text-primary">← {t('garde.bureaux.titre')}</Link>
      </ScreenHeader>
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.bureau.question')}>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureau.question')}</h2>
            <Conversation envoyer={async (texte, confirmer) => { const r = await garde.question(equipeKey, texte, confirmer); void charger(); return r; }} rapides={rapides} />
          </section>

          {bureau && bureau.propositions.length > 0 && (
            <section className="rounded-xl border border-warning/40 bg-surface p-4" aria-label={t('garde.bureau.propositions')}>
              <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureau.propositions')}</h2>
              <ul className="flex flex-col gap-3">
                {bureau.propositions.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <p className="text-sm text-text-primary">{t('garde.bureau.proposition', { parametre: p.parametre, actuelle: p.valeurActuelle, proposee: p.valeurProposee })} <span className="font-mono text-[10px] text-text-muted">({p.regle})</span></p>
                    {p.preuve?.stats && <p className="text-[12px] text-text-secondary">{t('garde.bureau.preuve', { mauvais: p.preuve.stats.mauvais, total: p.preuve.stats.total })}{p.preuve.etSi && typeof p.preuve.etSi.apres === 'number' ? ` · ${t('garde.bureau.etsi', { avant: p.preuve.etSi.avant ?? '—', apres: p.preuve.etSi.apres })}` : ''}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void garde.deciderProposition(p.id, 'acceptee').then(charger)} className="border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-bg">{t('garde.bureau.accepter')}</button>
                      <button type="button" onClick={() => void garde.deciderProposition(p.id, 'refusee').then(charger)} className="border border-border px-2.5 py-1 text-xs text-text-secondary">{t('garde.bureau.refuser')}</button>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.bureau.couloir')}</span>
                      <input type="number" value={couloirs[p.id]?.min ?? ''} onChange={(e) => setCouloirs((k) => ({ ...k, [p.id]: { min: e.target.value, max: k[p.id]?.max ?? '' } }))} placeholder="min" aria-label="min" className="input-focus w-16 border border-border bg-bg px-2 py-1 text-xs text-text-primary outline-none" />
                      <input type="number" value={couloirs[p.id]?.max ?? ''} onChange={(e) => setCouloirs((k) => ({ ...k, [p.id]: { min: k[p.id]?.min ?? '', max: e.target.value } }))} placeholder="max" aria-label="max" className="input-focus w-16 border border-border bg-bg px-2 py-1 text-xs text-text-primary outline-none" />
                      <button type="button" disabled={!couloirs[p.id]?.min || !couloirs[p.id]?.max} onClick={() => void garde.deciderProposition(p.id, 'acceptee', { min: Number(couloirs[p.id].min), max: Number(couloirs[p.id].max) }).then(charger)} className="border border-border-strong px-2.5 py-1 text-xs text-text-primary disabled:opacity-50">{t('garde.bureau.couloir')}</button>
                    </div>
                    <p className="text-[11px] text-text-muted">{t('garde.bureau.couloirAide')}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Le Chef des Comptes a un pupitre : les jetons et les règlements (Bloc 5). */}
          {equipeKey === 'comptes' && <ComptesBureau />}
          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.bureau.historique')}>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureau.historique')}</h2>
            {bureau && bureau.journal.length === 0 && <p className="font-mono text-xs text-text-muted">{t('garde.salle.rienRecent')}</p>}
            <ul>
              {(bureau?.journal ?? []).slice(0, toutJournal ? undefined : 12).map((e) => <JournalLigne key={e.id} entree={e} onMauvais={async (id, note) => { await garde.mauvais(id, note); await charger(); }} />)}
            </ul>
            {bureau && bureau.journal.length > 12 && !toutJournal && (
              <button type="button" onClick={() => setToutJournal(true)} className="mt-2 min-h-8 font-mono text-[10px] uppercase tracking-widest text-text-muted hover:text-text-primary">{t('commun.voirPlus', { n: bureau.journal.length - 12 })}</button>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.bureau.messages')}>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureau.messages')}</h2>
            {bureau && bureau.messages.length === 0 && <p className="font-mono text-xs text-text-muted">{t('garde.bureau.rienEcrit')}</p>}
            <ul className="flex flex-col gap-2">
              {(bureau?.messages ?? []).map((m) => <li key={m.id} className="text-[13px] leading-relaxed text-text-secondary"><span className="font-mono text-[10px] text-text-muted">{relativeTime(m.createdAt)} · </span>{m.texte}</li>)}
            </ul>
          </section>
          {bureau && bureau.remontees.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.pile.titre')}>
              <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.pile.titre')}</h2>
              <ul className="flex flex-col gap-2">
                {bureau.remontees.map((r) => <li key={r.id} className="flex items-start gap-2 text-[13px] text-text-primary"><GraviteChip gravite={r.gravite} /><span>{r.titre}</span></li>)}
              </ul>
              <Link to="/garde/pile" className="mt-2 inline-block font-mono text-[10px] uppercase tracking-widest text-text-muted hover:text-text-primary">{t('garde.pile.titre')} →</Link>
            </section>
          )}
          {definition && definition.agents.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.bureau.agents')}>
              <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureau.agents')}</h2>
              <ul className="flex flex-col gap-3">
                {definition.agents.map((a) => {
                  const etat = bureau?.agents.find((x) => x.key === a.key);
                  return (
                    <li key={a.key} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2"><EtatPoint etat={etat?.etat ?? 'repos'} actif={etat?.actif ?? true} /><span className="text-sm font-medium text-text-primary">{a.nom}</span><span className="text-[11px] text-text-muted">{a.role}</span></div>
                      <p className="text-[11px] text-text-muted"><span className="font-mono uppercase tracking-wider">{t('garde.bureau.prises')}</span> — {a.prises.lit.join(', ') || '—'} · {a.prises.modifie.join(', ') || '—'} · {a.prises.demande.join(', ') || '—'}</p>
                      {Object.entries(a.regles).length > 0 && (
                        <details className="pl-3">
                        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('commun.details')}</summary>
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {Object.entries(a.regles).map(([k, r]) => {
                            const parametres = (etat?.parametres?.[k] ?? r.parametres) as Record<string, unknown>;
                            const premier = Object.keys(r.parametres)[0];
                            return (
                              <li key={k} className="text-[11px] text-text-secondary">
                                {r.description}{Object.keys(r.parametres).length ? ` (${Object.entries(parametres).map(([n, v]) => `${n} ${String(v)}`).join(', ')})` : ''}
                                {r.rejouable && premier && <EtSi agent={a.key} regle={k} parametre={premier} valeur={Number(parametres[premier] ?? r.parametres[premier])} />}
                              </li>
                            );
                          })}
                        </ul>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * « ET SI ? » — un seuil rejoué sur le mois écoulé, sans rien changer.
 *
 * Le garde relit ses propres traces (pings, incidents, demandes) avec la
 * valeur proposée et dit ce que le mois aurait produit, contre ce qu'il a
 * produit. Rien n'est modifié : c'est une lecture. Pour changer la règle,
 * on passe par la proposition d'ajustement ou par un ordre.
 */
function EtSi({ agent, regle, parametre, valeur }: { agent: string; regle: string; parametre: string; valeur: number }) {
  const { t } = useLangue();
  const [essai, setEssai] = useState(String(valeur));
  const [resultat, setResultat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rejouer = async () => {
    const v = Number(essai);
    if (!Number.isFinite(v) || busy) return;
    setBusy(true);
    try {
      const r = await garde.etSi(agent, regle, parametre, v);
      setResultat(r.apres === null ? (r.note ?? t('garde.bureau.etsiImpossible')) : t('garde.bureau.etsiResultat', { parametre, valeur: v, apres: r.apres, avant: r.avant ?? '—' }));
    } catch (err) { setResultat(t('garde.erreur', { message: err instanceof Error ? err.message : String(err) })); } finally { setBusy(false); }
  };
  return (
    <form className="mt-1 flex flex-wrap items-center gap-2" aria-label={`${t('garde.bureau.etsiTitre')} ${regle}`} onSubmit={(e) => { e.preventDefault(); void rejouer(); }}>
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.bureau.etsiTitre')}</span>
      <label className="flex items-center gap-1 text-[11px] text-text-secondary">{parametre}
        <input type="number" inputMode="numeric" value={essai} onChange={(e) => setEssai(e.target.value)} aria-label={`${t('garde.bureau.etsiTitre')} ${parametre}`} className="input-focus w-20 border border-border bg-bg px-2 py-0.5 text-[12px] text-text-primary outline-none" />
      </label>
      <button type="submit" disabled={busy} className="min-h-11 border border-border px-2 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50 md:min-h-0 md:py-0.5">{t('garde.bureau.etsiEssayer')}</button>
      {resultat && <span className="text-[11px] text-text-primary" data-etsi={regle}>{resultat}</span>}
    </form>
  );
}
