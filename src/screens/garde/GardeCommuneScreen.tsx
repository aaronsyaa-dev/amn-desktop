import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Conversation } from '../../components/garde/GardeUi';
import { useHaloSignal } from '../../components/EtatEcran';
import { garde } from '../../lib/garde';
import { useLangue, type CleTraduction } from '../../i18n';
import { relativeTime } from '../../lib/time';
import type { GardeMessage, GardeSalle } from '../../shared/garde';

/**
 * LA SALLE COMMUNE — la gerbe.
 *
 * Une question posée à gauche se répartit en ÉVENTAIL vers les sept chefs, et
 * chacun ne renvoie qu'UNE ligne. La contrainte d'une ligne est ce qui rend
 * l'écran lisible : sept paragraphes seraient illisibles, sept lignes se
 * balaient d'un regard, et celle qui n'est pas « rien à signaler » saute aux
 * yeux. La gerbe montre aussi le travail du Capitaine — c'est lui qui a décidé
 * quels chefs étaient concernés.
 *
 * L'AMBRE, unique : la seule réponse qui porte un fait — son nom de chef et sa
 * ligne. Deux nœuds.
 *
 * CE QUE LE PRODUIT DIT AUJOURD'HUI. `POST /commune` (amn-api,
 * `src/routes/garde.js`) fait répondre les sept chefs avec la MÊME phrase du
 * Lexique, `commune.compris` : un accusé de réception, pas une inspection.
 * Aucun chef ne « porte un fait » tant que cela n'a pas changé — et l'écran ne
 * doit donc allumer aucun ambre, plutôt que d'en désigner un au hasard. La
 * règle de lecture est nommée et tient d'elle-même le jour où les chefs
 * inspecteront : une réponse porte un fait quand elle avance un chiffre.
 */
const DUREES: { cle: CleTraduction; ms: number | null }[] = [
  { cle: 'garde.commune.duree.jour', ms: 86_400_000 },
  { cle: 'garde.commune.duree.troisJours', ms: 3 * 86_400_000 },
  { cle: 'garde.commune.duree.semaine', ms: 7 * 86_400_000 },
  { cle: 'garde.commune.duree.libre', ms: null },
];

/** La colonne de la gerbe : 76 px, la largeur que traversent les tiges. */
const GERBE_L = 76;
/** Une réponse porte un fait quand elle avance un chiffre — sinon elle dit seulement qu'on a regardé. */
const porteUnFait = (texte: string) => /\d/.test(texte);

export function GardeCommuneScreen() {
  const { t } = useLangue();
  const [messages, setMessages] = useState<GardeMessage[]>([]);
  const [salle, setSalle] = useState<GardeSalle | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [duree, setDuree] = useState<number | null>(3 * 86_400_000);
  const [busy, setBusy] = useState(false);
  const charger = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([garde.messages({ canal: 'commune', limit: 60 }), garde.salle()]);
      setMessages([...m].reverse());
      setSalle(s);
      setErreur(null);
    } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
  }, []);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => garde.onGarde((trame) => { if (['garde:releve', 'garde:absence', 'garde:journal'].includes(trame.type)) void charger(); }), [charger]);
  const geste = async (f: () => Promise<unknown>) => { setBusy(true); try { await f(); await charger(); } finally { setBusy(false); } };
  const absence = salle?.absence ?? null;
  const releve = messages.filter((m) => m.agent === 'capitaine').at(-1) ?? null;

  /*
    LES QUESTIONS ET LEURS GERBES. Le canal « commune » porte tout dans
    l'ordre : la question (écrite au nom de qui l'a posée), puis les lignes des
    chefs saisis, puis la question suivante. On regroupe en relisant la suite,
    sans rien demander de plus au serveur.
  */
  const equipes = useMemo(() => new Map((salle?.equipes ?? []).map((e) => [e.key, e])), [salle]);
  const questions = useMemo(() => {
    const liste: { question: GardeMessage; reponses: GardeMessage[] }[] = [];
    for (const m of messages) {
      if (equipes.has(m.agent)) { liste.at(-1)?.reponses.push(m); continue; }
      if (m.agent === 'capitaine') continue; // la Relève et la clôture ne sont pas des questions
      liste.push({ question: m, reponses: [] });
    }
    return liste;
  }, [messages, equipes]);
  const derniere = questions.filter((q) => q.reponses.length > 0).at(-1) ?? null;
  const faits = derniere?.reponses.filter((r) => porteUnFait(r.texte)) ?? [];
  /* L'ambre n'en prend qu'UNE. Aucune, ou plusieurs : dans les deux cas, en désigner une serait un choix arbitraire — on n'en allume qu'une quand elle est seule. */
  const reponseAmbre = faits.length === 1 ? faits[0] : null;
  const halo = useHaloSignal(reponseAmbre !== null);

  /*
    LA GERBE se dessine sur les hauteurs RÉELLES des réponses : la ligne qui
    porte un fait est plus haute que les autres, donc aucune tige ne peut être
    posée à un pourcentage décidé d'avance. On mesure la colonne, et les tiges
    tombent sur le centre exact de chaque réponse.
  */
  const colonne = useRef<HTMLDivElement | null>(null);
  const [tiges, setTiges] = useState<{ h: number; ys: number[] }>({ h: 0, ys: [] });
  useLayoutEffect(() => {
    const el = colonne.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const mesurer = () => {
      const enfants = Array.from(el.children) as HTMLElement[];
      setTiges({ h: el.offsetHeight, ys: enfants.map((c) => c.offsetTop + c.offsetHeight / 2) });
    };
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    for (const c of Array.from(el.children)) ro.observe(c);
    return () => ro.disconnect();
  }, [derniere]);

  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.commune.titre')} description={t('garde.commune.description')} />
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}

      {/* Parler à toute la Garde : la question part d'ici. */}
      <section className="border border-border bg-surface p-4" aria-label={t('garde.commune.dire')}>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.commune.dire')}</h2>
        <Conversation envoyer={async (texte, confirmer) => { const r = await garde.commune(texte, confirmer); void charger(); return r; }} aide={t('garde.commune.aide')} />
      </section>

      {/* ═══ L'OBJET DOMINANT : la gerbe ═══ */}
      <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8">
        {derniere ? (
          <>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="min-w-0 font-mono text-[11px] uppercase tracking-widest text-text-secondary">« {derniere.question.texte} »</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.commune.poseeIlYa', { quand: relativeTime(derniere.question.createdAt) })}</span>
            </div>

            <div className="grid items-center gap-4 lg:grid-cols-[262px_76px_minmax(0,1fr)] lg:gap-0">
              <div className="min-w-0 border border-border-sheet bg-sunken px-5 py-[18px]">
                <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">{t('garde.commune.votreQuestion')}</span>
                <p className="mt-2.5 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-text-primary [text-wrap:pretty]">{derniere.question.texte}</p>
                <span className="mt-4 flex items-center gap-[7px] border-t border-border pt-3.5">
                  <span aria-hidden className="anneau-courant h-[5px] w-[5px] flex-none rounded-full bg-accent" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary">{t('garde.commune.chefsSaisis', { n: derniere.reponses.length })}</span>
                </span>
              </div>

              {/* Les tiges : de la question au centre exact de chaque réponse. Masquées sous lg, où les colonnes s'empilent et où l'éventail n'aurait plus de sens. */}
              <div className="relative hidden self-stretch lg:block" style={{ width: GERBE_L }} aria-hidden>
                {tiges.h > 0 && (
                  <svg viewBox={`0 0 ${GERBE_L} ${tiges.h}`} className="absolute inset-0 block h-full w-full" fill="none">
                    {tiges.ys.map((y, i) => {
                      const ambre = reponseAmbre !== null && derniere.reponses[i]?.id === reponseAmbre.id;
                      return (
                        <path
                          key={derniere.reponses[i]?.id ?? i}
                          d={`M0 ${tiges.h / 2} C${GERBE_L * 0.45} ${tiges.h / 2} ${GERBE_L * 0.55} ${y} ${GERBE_L} ${y}`}
                          stroke={ambre ? 'var(--color-signal)' : '#2e2e2e'}
                          strokeWidth={ambre ? 2.2 : 1.4}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}
                  </svg>
                )}
              </div>

              <div ref={colonne} className="flex min-w-0 flex-col gap-1.5">
                {derniere.reponses.map((r) => {
                  const ambre = reponseAmbre?.id === r.id;
                  const chef = equipes.get(r.agent);
                  return (
                    <div
                      key={r.id}
                      data-signal-groupe={ambre ? 'porte-un-fait' : undefined}
                      data-chef={r.agent}
                      className={`flex min-w-0 items-baseline gap-3 ${ambre ? `bg-signal px-3.5 py-3 text-signal-ink ${halo}` : 'border border-border bg-raised px-3 py-[9px]'}`}
                    >
                      <span data-signal-groupe={ambre ? 'porte-un-fait' : undefined} className={`w-[76px] flex-none font-mono text-[9.5px] uppercase tracking-[0.1em] ${ambre ? 'font-bold opacity-80' : 'font-semibold text-text-muted'}`}>
                        {chef?.nom ?? r.agent}
                      </span>
                      <span data-signal-groupe={ambre ? 'porte-un-fait' : undefined} className={`min-w-0 flex-1 leading-snug [text-wrap:pretty] ${ambre ? 'text-[13.5px] font-semibold' : 'text-[12.5px] text-text-secondary'}`}>
                        {r.texte}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-[22px] border-t border-border-raised pt-5">
              <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
                {t('garde.commune.rienADire', { n: derniere.reponses.length - faits.length, total: derniere.reponses.length })}
                {' '}
                {reponseAmbre ? t('garde.commune.unFait', { chef: equipes.get(reponseAmbre.agent)?.nom ?? reponseAmbre.agent }) : t('garde.commune.aucunFait')}
              </p>
              {faits.length === 0 && <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">{t('garde.commune.faitNote')}</p>}
            </div>
          </>
        ) : (
          <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.commune.avantDeDemander')}</p>
        )}
      </article>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 border border-border bg-surface px-[22px] py-5" aria-label={t('garde.commune.questionsSemaine')}>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.commune.questionsSemaine')}</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.commune.quiARepondu')}</span>
          </div>
          {questions.length === 0 ? (
            <p className="text-[13px] text-text-muted">{t('garde.commune.rien')}</p>
          ) : (
            <>
              <ul>
                {[...questions].reverse().slice(0, 6).map((q) => {
                  const n = q.reponses.filter((r) => porteUnFait(r.texte)).length;
                  return (
                    <li key={q.question.id} className="grid grid-cols-[minmax(0,1fr)_104px_62px_62px] items-baseline gap-3.5 border-b border-border-row py-[11px] last:border-b-0">
                      <span className="text-[13px] text-text-primary [text-wrap:pretty]">{q.question.texte}</span>
                      <span className="font-mono text-[11px] tabular-nums text-text-muted">{relativeTime(q.question.createdAt)}</span>
                      <span className="text-right font-mono text-[12px] tabular-nums text-text-secondary">{t('garde.commune.nChefs', { n: q.reponses.length })}</span>
                      {/* Zéro fait se dit par un tiret : un « 0 » dans une colonne de comptes se lit comme un échec, alors que c'est un résultat. */}
                      <span className={`text-right font-mono text-[12px] font-semibold tabular-nums ${n > 0 ? 'text-text-body' : 'text-[#4a4a48]'}`}>{n > 0 ? n : '—'}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3.5 text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.commune.colonneFaits')}</p>
            </>
          )}
        </section>

        <section className="flex flex-col border border-border bg-surface px-5 py-5" aria-label={t('garde.commune.regleUneLigne')}>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.commune.regleUneLigne')}</h2>
          <p className="mt-4 text-[14px] leading-relaxed text-text-body [text-wrap:pretty]">{t('garde.commune.regleUneLignePhrase')}</p>
          <p className="mt-auto pt-[18px] text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.commune.capitaineSaisit')}</p>
        </section>
      </div>

      {/* La Relève du jour et la régence : deux gestes qui vivent dans cette salle, sous la gerbe. */}
      <div className="grid gap-[18px] lg:grid-cols-2">
        <section className="border border-border bg-surface p-4" aria-label={t('garde.commune.releve')}>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.commune.releve')}</h2>
          {releve ? <p className="whitespace-pre-line text-[13px] leading-relaxed text-text-primary">{releve.texte}</p> : <p className="font-mono text-xs text-text-muted">{t('garde.salle.rienRecent')}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => void geste(() => garde.tour())} className="min-h-11 border border-border px-2.5 text-xs text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50 md:min-h-0 md:py-1">{t('garde.commune.tour')}</button>
            <label className="flex items-center gap-2 text-[11px] text-text-muted">
              {t('garde.commune.heureTour')}
              <select value={salle?.reglages.heureTour ?? 8} onChange={(e) => void geste(() => garde.reglages({ heureTour: Number(e.target.value) }))} aria-label={t('garde.commune.heureTour')} className="input-focus bg-bg px-2 py-1 text-[11px] text-text-primary outline-none">
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{t('garde.commune.heures', { h })}</option>)}
              </select>
            </label>
          </div>
        </section>
        <section className={`border p-4 ${absence ? 'border-border-strong bg-surface-hover' : 'border-border bg-surface'}`} aria-label={t('garde.commune.absence')}>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.commune.absence')}</h2>
          {absence ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-text-primary">{t('garde.commune.regence', { depuis: new Date(absence.depuis).toLocaleString(), par: absence.par })}</p>
              <p className="text-[11px] text-text-secondary">{t('garde.commune.mandat', { seul: absence.mandat.decideSeul.join(', '), gele: absence.mandat.gele.join(', ') || '—', escalade: absence.mandat.escalade })}</p>
              <button type="button" disabled={busy} onClick={() => void geste(() => garde.retour())} className="min-h-11 self-start border border-accent bg-accent px-3 text-sm font-medium text-bg disabled:opacity-50 md:min-h-0 md:py-1.5">{t('garde.commune.retour')}</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-text-secondary">{t('garde.commune.absenceAide')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={String(duree)} onChange={(e) => setDuree(e.target.value === 'null' ? null : Number(e.target.value))} aria-label={t('garde.commune.absence')} className="input-focus bg-bg px-2 py-1 text-[12px] text-text-primary outline-none">
                  {DUREES.map((d) => <option key={d.cle} value={String(d.ms)}>{t(d.cle)}</option>)}
                </select>
                <button type="button" disabled={busy} onClick={() => void geste(() => garde.absence(duree))} className="min-h-11 border border-border-strong px-3 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50 md:min-h-0 md:py-1.5">{t('garde.commune.absence')}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
