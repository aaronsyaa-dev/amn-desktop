import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EtatPoint, dureeCourte } from '../../components/garde/GardeUi';
import { garde } from '../../lib/garde';
import { useLangue, type CleTraduction } from '../../i18n';
import type { GardeAgent, GardeCalendrierItem } from '../../shared/garde';

/**
 * LE CALENDRIER VISIBLE DE LA GARDE — aucune surprise, jamais.
 *
 * Ce qu'elle fera cette semaine, jour par jour : rondes, fins de grâce,
 * rapports, la Relève. Et les horaires de chaque garde, réglables ici — une
 * période, une pause, une reprise — journalisés par le Capitaine.
 */
const PERIODES = [60_000, 5 * 60_000, 15 * 60_000, 3_600_000, 6 * 3_600_000, 24 * 3_600_000];
const CLE_PERIODE: Record<number, CleTraduction> = {
  60000: 'garde.calendrier.periodes.1min',
  300000: 'garde.calendrier.periodes.5min',
  900000: 'garde.calendrier.periodes.15min',
  3600000: 'garde.calendrier.periodes.1h',
  21600000: 'garde.calendrier.periodes.6h',
  86400000: 'garde.calendrier.periodes.24h',
};

export function GardeCalendrierScreen() {
  const { t, langue } = useLangue();
  const [items, setItems] = useState<GardeCalendrierItem[]>([]);
  const [agents, setAgents] = useState<GardeAgent[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([garde.calendrier(7), garde.salle()]);
      setItems(c);
      setAgents(s.agents);
      setErreur(null);
    } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
  }, []);
  useEffect(() => { void charger(); }, [charger]);
  const jours = useMemo(() => {
    const m = new Map<string, GardeCalendrierItem[]>();
    for (const i of items) { const j = new Date(i.at).toDateString(); m.set(j, [...(m.get(j) ?? []), i]); }
    return [...m.entries()];
  }, [items]);
  const libelleJour = (d: string) => {
    const aujourdhui = new Date().toDateString();
    const demain = new Date(Date.now() + 86_400_000).toDateString();
    return d === aujourdhui ? t('garde.calendrier.aujourdhui') : d === demain ? t('garde.calendrier.demain') : new Date(d).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const regler = async (key: string, patch: Partial<Pick<GardeAgent, 'actif' | 'everyMs'>>) => { await garde.majAgent(key, patch); await charger(); };

  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.calendrier.titre')} description={t('garde.calendrier.description')} />
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="flex flex-col gap-3" aria-label={t('garde.calendrier.titre')}>
          {jours.map(([jour, liste]) => (
            <div key={jour} className="rounded-xl border border-border bg-surface p-3">
              <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{libelleJour(jour)}</h2>
              <ul className="flex flex-col gap-1">
                {liste.slice(0, 40).map((i, k) => (
                  <li key={`${i.agent}-${i.at}-${k}`} className="flex items-baseline gap-2 text-[13px]">
                    <span className="w-14 flex-shrink-0 font-mono text-[11px] text-text-muted">{new Date(i.at).toLocaleTimeString(langue === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="min-w-0 flex-1 text-text-primary">{i.quoi}</span>
                    <span className="font-mono text-[10px] text-text-muted">{i.agent}{i.periode ? ` · ${t('garde.calendrier.toutesLes', { duree: dureeCourte(i.periode, t) })}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
        <section className="rounded-xl border border-border bg-surface p-3" aria-label={t('garde.calendrier.horaires')}>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.calendrier.horaires')}</h2>
          <ul className="flex flex-col divide-y divide-border">
            {agents.map((a) => (
              <li key={a.key} className="flex flex-wrap items-center gap-2 py-2">
                <EtatPoint etat={a.etat} actif={a.actif} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{a.nom} <span className="text-[11px] text-text-muted">· {a.equipe}</span></span>
                <label className="flex items-center gap-1 text-[11px] text-text-muted">
                  {t('garde.calendrier.periode')}
                  <select value={PERIODES.includes(a.everyMs) ? a.everyMs : a.everyMs} onChange={(e) => void regler(a.key, { everyMs: Number(e.target.value) })} aria-label={`${t('garde.calendrier.periode')} ${a.nom}`} className="input-focus bg-bg px-1 py-0.5 text-[11px] text-text-primary outline-none">
                    {[...new Set([...PERIODES, a.everyMs])].sort((x, y) => x - y).map((p) => <option key={p} value={p}>{CLE_PERIODE[p] ? t(CLE_PERIODE[p]) : dureeCourte(p, t)}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => void regler(a.key, { actif: !a.actif })} className="min-h-11 border border-border px-2 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-0.5">{a.actif ? t('garde.calendrier.mettreEnPause') : t('garde.calendrier.reprendre')}</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
