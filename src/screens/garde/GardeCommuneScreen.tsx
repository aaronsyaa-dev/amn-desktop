import React, { useCallback, useEffect, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Conversation } from '../../components/garde/GardeUi';
import { garde } from '../../lib/garde';
import { useLangue, type CleTraduction } from '../../i18n';
import { relativeTime } from '../../lib/time';
import type { GardeMessage, GardeSalle } from '../../shared/garde';

/**
 * LA SALLE COMMUNE — parler à toute la Garde d'un coup.
 *
 * Un ordre ou une annonce posé ici est reçu par le Capitaine, qui le
 * dispatche et rend compte de qui a compris quoi ; chaque chef répond en une
 * ligne. C'est aussi là que tombe la Relève du jour, et que se déclare une
 * absence : le Capitaine prend les rênes, sur un mandat borné.
 */
const DUREES: { cle: CleTraduction; ms: number | null }[] = [
  { cle: 'garde.commune.duree.jour', ms: 86_400_000 },
  { cle: 'garde.commune.duree.troisJours', ms: 3 * 86_400_000 },
  { cle: 'garde.commune.duree.semaine', ms: 7 * 86_400_000 },
  { cle: 'garde.commune.duree.libre', ms: null },
];

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

  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.commune.titre')} description={t('garde.commune.description')} />
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.commune.dire')}>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.commune.dire')}</h2>
            <Conversation envoyer={async (texte, confirmer) => { const r = await garde.commune(texte, confirmer); void charger(); return r; }} aide={t('garde.commune.aide')} />
          </section>
          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.commune.titre')}>
            {messages.length === 0 && <p className="font-mono text-xs text-text-muted">{t('garde.commune.rien')}</p>}
            <ol className="flex flex-col gap-2">
              {messages.map((m) => (
                <li key={m.id} className={`whitespace-pre-line rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${m.agent.includes('@') ? 'self-end border-border-strong bg-bg text-text-primary' : 'self-start border-border text-text-secondary'}`}>
                  <span className="font-mono text-[10px] text-text-muted">{m.agent} · {relativeTime(m.createdAt)}</span>
                  <br />{m.texte}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.commune.releve')}>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.commune.releve')}</h2>
            {releve ? <p className="whitespace-pre-line text-[13px] leading-relaxed text-text-primary">{releve.texte}</p> : <p className="font-mono text-xs text-text-muted">{t('garde.salle.rienRecent')}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy} onClick={() => void geste(() => garde.tour())} className="min-h-11 border border-border px-2.5 text-xs text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50 md:min-h-0 md:py-1">{t('garde.commune.tour')}</button>
              <label className="flex items-center gap-2 text-[11px] text-text-muted">
                {t('garde.commune.heureTour')}
                <select value={salle?.reglages.heureTour ?? 8} onChange={(e) => void geste(() => garde.reglages(Number(e.target.value)))} aria-label={t('garde.commune.heureTour')} className="input-focus bg-bg px-2 py-1 text-[11px] text-text-primary outline-none">
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{t('garde.commune.heures', { h })}</option>)}
                </select>
              </label>
            </div>
          </section>
          <section className={`rounded-xl border p-4 ${absence ? 'border-warning/50 bg-warning-muted' : 'border-border bg-surface'}`} aria-label={t('garde.commune.absence')}>
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
      </div>
    </section>
  );
}
