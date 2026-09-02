import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { formatCents } from '../lib/money';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface CashCountData {
  day: string;
  floatCents: number;
  expectedCents: number;
  countedCents: number;
  note: string;
  byEmail: string;
  countedAt: string;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const centimes = (s: string) => Math.round((Number(String(s).trim().replace(',', '.')) || 0) * 100);
const ecartDe = (c: CashCountData) => c.countedCents - (c.floatCents + c.expectedCents);

/**
 * LA CAISSE DU JOUR — le fond, les espèces comptées, l'écart.
 *
 * Pour qui : une boutique qui compte sa caisse le soir sur un coin de
 * comptoir et perd le papier. Ce que ça règle : trois montants par jour —
 * le fond de caisse du matin, les ventes en espèces attendues (le ticket
 * de la caisse enregistreuse), ce qui est réellement compté — et l'écart
 * qui en découle, gardé jour après jour. Un écart n'est pas une faute : c'est
 * un chiffre qu'on voit, au lieu de le découvrir en fin de mois.
 */
export function CashCountScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const brutes = useCollection<CashCountData>('cashCounts');
  const aujourdhui = isoJour(new Date());
  const duJour = brutes.find((c) => c.day === aujourdhui) ?? null;
  const [floatEuros, setFloatEuros] = useState<string | null>(null);
  const [expected, setExpected] = useState<string | null>(null);
  const [counted, setCounted] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [gardee, setGardee] = useState(false);

  const passes = useMemo(() => brutes.filter((c) => c.day !== aujourdhui).sort((a, b) => b.day.localeCompare(a.day)), [brutes, aujourdhui]);
  const trente = isoJour(new Date(Date.now() - 30 * 86_400_000));
  const recents = brutes.filter((c) => c.day >= trente);
  const cumul = recents.reduce((n, c) => n + ecartDe(c), 0);
  const dernierFond = passes[0]?.floatCents ?? 0;
  const vFloat = floatEuros ?? (duJour ? String(duJour.floatCents / 100) : dernierFond ? String(dernierFond / 100) : '');
  const vExpected = expected ?? (duJour ? String(duJour.expectedCents / 100) : '');
  const vCounted = counted ?? (duJour ? String(duJour.countedCents / 100) : '');
  const ecartCourant = vCounted.trim() === '' ? null : centimes(vCounted) - (centimes(vFloat) + centimes(vExpected));

  const garder = async () => {
    if (vCounted.trim() === '') return;
    await upsert('cashCounts', `caisse-${aujourdhui}`, { day: aujourdhui, floatCents: centimes(vFloat), expectedCents: centimes(vExpected), countedCents: centimes(vCounted), note: (note ?? duJour?.note ?? '').trim(), byEmail: user?.email ?? '', countedAt: new Date().toISOString() });
    setGardee(true);
    window.setTimeout(() => setGardee(false), 2000);
  };
  const ecartTexte = (n: number) => `${n > 0 ? '+' : ''}${formatCents(n)}`;
  const champ = 'input-focus tnum min-h-11 w-full border border-border bg-bg px-3 text-right text-sm text-text-primary outline-none';

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('caisse.titre') })}
          title={t('caisse.titre')}
          description={t('caisse.description')}
          stats={[
            { label: t('caisse.stat.ecartJour'), value: duJour ? ecartTexte(ecartDe(duJour)) : '—', emphasis: Boolean(duJour && ecartDe(duJour) !== 0) },
            { label: t('caisse.stat.jours'), value: recents.length },
            { label: t('caisse.stat.cumul'), value: recents.length ? ecartTexte(cumul) : '—', emphasis: cumul !== 0 },
          ]}
        />
      </motion.div>

      <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void garder(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-text-muted">{t('caisse.champFond')}<input value={vFloat} onChange={(e) => setFloatEuros(e.target.value)} inputMode="decimal" className={champ} /></label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">{t('caisse.champAttendu')}<input value={vExpected} onChange={(e) => setExpected(e.target.value)} inputMode="decimal" className={champ} /></label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">{t('caisse.champCompte')}<input value={vCounted} onChange={(e) => setCounted(e.target.value)} inputMode="decimal" className={champ} /></label>
        <input value={note ?? duJour?.note ?? ''} onChange={(e) => setNote(e.target.value)} placeholder={t('caisse.champNote')} aria-label={t('caisse.champNote')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none sm:col-span-2" />
        <div className="flex items-center justify-between gap-3">
          <p className={`tnum text-lg font-medium ${ecartCourant === null ? 'text-text-muted' : ecartCourant === 0 ? 'text-success' : 'text-warning'}`}>{ecartCourant === null ? t('caisse.ecart') : `${t('caisse.ecart')} ${ecartTexte(ecartCourant)}`}</p>
          <button type="submit" disabled={vCounted.trim() === ''} className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-2">{gardee ? <Check size={14} /> : null} {gardee ? t('caisse.gardee') : t('caisse.garder')}</button>
        </div>
      </motion.form>

      {brutes.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('caisse.vide.titre')}>{t('caisse.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        passes.length > 0 && (
          <motion.div variants={staggerItem} className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead><tr>{[t('caisse.colonne.jour'), t('caisse.champFond'), t('caisse.champAttendu'), t('caisse.champCompte'), t('caisse.ecart'), ''].map((h, i) => <th key={i} scope="col" className="eyebrow p-2 text-left">{h}</th>)}</tr></thead>
              <tbody>
                {passes.map((c) => (
                  <tr key={c.day} className="group border-t border-border">
                    <th scope="row" className="p-2 text-left font-medium text-text-primary">{c.day}{c.note && <span className="block text-xs font-normal text-text-muted">{c.note}</span>}</th>
                    <td className="tnum p-2 text-text-secondary">{formatCents(c.floatCents)}</td>
                    <td className="tnum p-2 text-text-secondary">{formatCents(c.expectedCents)}</td>
                    <td className="tnum p-2 text-text-primary">{formatCents(c.countedCents)}</td>
                    <td className={`tnum p-2 ${ecartDe(c) === 0 ? 'text-success' : 'text-warning'}`}>{ecartTexte(ecartDe(c))}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => void remove('cashCounts', c.id)}
                        aria-label={t('caisse.supprimer')}
                        title={t('caisse.supprimer')}
                        className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )
      )}
    </motion.section>
  );
}
