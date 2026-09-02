import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Check, Circle, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Arret {
  id: string;
  label: string;
  address: string;
  doneAt: string | null;
}
interface RoundData {
  title: string;
  day: string;
  stops: Arret[];
  createdAt: string;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** « Boulangerie Martin, 12 rue des Lilas, Nantes » → un arrêt : le premier morceau nomme, le reste adresse. */
export function lireArret(ligne: string): Arret | null {
  const [label, ...reste] = ligne.split(',').map((p) => p.trim());
  if (!label) return null;
  return { id: uid('stp'), label, address: reste.join(', '), doneAt: null };
}
const carte = (a: Arret) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(a.address || a.label)}`;

/**
 * LES TOURNÉES — les livraisons du jour, arrêt par arrêt.
 *
 * Pour qui : un traiteur, un fleuriste, un artisan qui livre et note ses
 * arrêts sur un papier qui reste dans le camion. Ce que ça règle : une
 * tournée par jour avec ses arrêts dans l'ordre, cochés en route depuis le
 * téléphone, et la carte ouverte d'un geste — la recherche OpenStreetMap,
 * sans compte ni clé. L'ordre se règle à la main : personne ne connaît la
 * ville mieux que celui qui la livre.
 */
export function DeliveryRoundsScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const { upsert, remove } = useSync();
  const brutes = useCollection<RoundData>('deliveryRounds');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(isoJour(new Date()));
  const [stops, setStops] = useState('');
  const aujourdhui = isoJour(new Date());

  const tournees = useMemo(() => [...brutes].sort((a, b) => b.day.localeCompare(a.day) || a.createdAt.localeCompare(b.createdAt)), [brutes]);
  const duJour = tournees.filter((r) => r.day === aujourdhui);
  const restants = duJour.reduce((n, r) => n + r.stops.filter((s) => !s.doneAt).length, 0);
  const faits = duJour.reduce((n, r) => n + r.stops.filter((s) => s.doneAt).length, 0);

  const ajouter = async () => {
    const arrets = stops.split('\n').map(lireArret).filter((a): a is Arret => Boolean(a));
    if (!title.trim() || arrets.length === 0) return;
    await upsert('deliveryRounds', uid('rnd'), { title: title.trim(), day, stops: arrets, createdAt: new Date().toISOString() });
    setTitle(''); setStops(''); setOuvert(false);
  };
  const basculer = (r: RoundData & { id: string }, a: Arret) => upsert('deliveryRounds', r.id, { ...r, stops: r.stops.map((s) => (s.id === a.id ? { ...s, doneAt: s.doneAt ? null : new Date().toISOString() } : s)) });
  const deplacer = (r: RoundData & { id: string }, index: number, delta: number) => {
    const cible = index + delta;
    if (cible < 0 || cible >= r.stops.length) return;
    const stops = [...r.stops];
    [stops[index], stops[cible]] = [stops[cible], stops[index]];
    return upsert('deliveryRounds', r.id, { ...r, stops });
  };
  const dateLongue = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('tournees.titre') })}
          title={t('tournees.titre')}
          description={t('tournees.description')}
          stats={[
            { label: t('tournees.stat.aujourdhui'), value: duJour.length },
            { label: t('tournees.stat.restants'), value: restants, emphasis: restants > 0 },
            { label: t('tournees.stat.faits'), value: faits },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('tournees.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('tournees.champTitre')} aria-label={t('tournees.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('tournees.champJour')}<input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" /></label>
          <textarea value={stops} onChange={(e) => setStops(e.target.value)} rows={5} placeholder={t('tournees.champArrets')} aria-label={t('tournees.champArrets')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!title.trim() || !stops.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('tournees.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {tournees.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('tournees.vide.titre')} action={{ label: t('tournees.vide.action'), onClick: () => setOuvert(true) }}>{t('tournees.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="flex flex-col gap-3">
          {tournees.map((r) => {
            const faitsIci = r.stops.filter((s) => s.doneAt).length;
            const finie = r.stops.length > 0 && faitsIci === r.stops.length;
            return (
              <article key={r.id} className={`group rounded-xl border bg-surface p-4 ${finie ? 'border-success/30' : r.day === aujourdhui ? 'border-accent/40' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{r.title}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{dateLongue(r.day)} · {t('tournees.avancement', { fait: faitsIci, total: r.stops.length })}</p>
                  </div>
                  <button type="button" onClick={() => void remove('deliveryRounds', r.id)} aria-label={t('tournees.supprimer')} title={t('tournees.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                </div>
                <ol className="mt-2 flex flex-col divide-y divide-border">
                  {r.stops.map((a, i) => (
                    <li key={a.id} className="flex items-center gap-2 py-1">
                      <button type="button" onClick={() => void basculer(r, a)} aria-pressed={Boolean(a.doneAt)} aria-label={a.doneAt ? t('tournees.livre') : t('tournees.aLivrer')} className="flex min-h-11 min-w-11 items-center justify-center">
                        {a.doneAt ? <Check size={16} className="text-success" /> : <Circle size={16} className="text-text-muted" />}
                      </button>
                      <span className="tnum w-5 font-mono text-xs text-text-muted">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${a.doneAt ? 'text-text-muted line-through' : 'text-text-primary'}`}>{a.label}</p>
                        {a.address && <p className="truncate text-xs text-text-muted">{a.address}</p>}
                      </div>
                      <a href={carte(a)} target="_blank" rel="noreferrer" aria-label={t('tournees.carte')} title={t('tournees.carte')} className="flex min-h-11 min-w-11 items-center justify-center text-text-muted hover:text-text-primary"><ExternalLink size={13} /></a>
                      <button type="button" onClick={() => void deplacer(r, i, -1)} disabled={i === 0} aria-label={t('tournees.monter')} className="flex min-h-11 min-w-11 items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30 md:min-h-8 md:min-w-8"><ArrowUp size={12} /></button>
                      <button type="button" onClick={() => void deplacer(r, i, 1)} disabled={i === r.stops.length - 1} aria-label={t('tournees.descendre')} className="flex min-h-11 min-w-11 items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30 md:min-h-8 md:min-w-8"><ArrowDown size={12} /></button>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </motion.div>
      )}
    </motion.section>
  );
}
