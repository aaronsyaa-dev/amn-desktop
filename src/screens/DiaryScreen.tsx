import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { usePersonalStore } from '../state/usePersonalStore';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Entree {
  day: string;
  text: string;
  mood: number;
  updatedAt: string;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HUMEURS = [1, 2, 3, 4, 5];

/**
 * LE JOURNAL PERSO — quelques lignes par jour, pour soi.
 *
 * Pour qui : une personne qui veut garder trace de ses journées sans que ça
 * regarde l'équipe. Le Journal de bord est celui de l'organisation ; celui-ci
 * ne quitte pas ce poste. Une entrée par jour, une humeur de un à cinq, et
 * la relecture des jours passés.
 */
export function DiaryScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const [entrees, setEntrees, pret] = usePersonalStore<Entree[]>('journal', []);
  const aujourdhui = isoJour(new Date());
  const duJour = entrees.find((e) => e.day === aujourdhui) ?? null;
  const [texte, setTexte] = useState<string | null>(null);
  const [gardee, setGardee] = useState(false);
  const valeur = texte ?? duJour?.text ?? '';
  const passees = useMemo(() => entrees.filter((e) => e.day !== aujourdhui).sort((a, b) => b.day.localeCompare(a.day)), [entrees, aujourdhui]);
  const trenteJours = isoJour(new Date(Date.now() - 30 * 86_400_000));
  const ceMois = entrees.filter((e) => e.day >= trenteJours).length;
  const serie = useMemo(() => {
    let n = 0;
    for (let k = duJour ? 0 : 1; k < 400; k += 1) {
      if (!entrees.some((e) => e.day === isoJour(new Date(Date.now() - k * 86_400_000)))) break;
      n += 1;
    }
    return n;
  }, [entrees, duJour]);
  const humeurMoyenne = ceMois > 0 ? (entrees.filter((e) => e.day >= trenteJours && e.mood > 0).reduce((s, e) => s + e.mood, 0) / Math.max(1, entrees.filter((e) => e.day >= trenteJours && e.mood > 0).length)).toFixed(1) : null;

  const garder = (mood?: number) => {
    const text = valeur.trim();
    const humeur = mood ?? duJour?.mood ?? 0;
    if (!text && !humeur) return;
    setEntrees((liste) => [...liste.filter((e) => e.day !== aujourdhui), { day: aujourdhui, text, mood: humeur, updatedAt: new Date().toISOString() }]);
    setGardee(true);
    window.setTimeout(() => setGardee(false), 2000);
  };
  const retirer = (day: string) => setEntrees((liste) => liste.filter((e) => e.day !== day));
  const dateLongue = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('perso.surtitre', { module: t('journalPerso.titre') })}
          title={t('journalPerso.titre')}
          description={t('journalPerso.description')}
          stats={[
            { label: t('journalPerso.stat.serie'), value: serie },
            { label: t('journalPerso.stat.mois'), value: ceMois },
            { label: t('journalPerso.stat.humeur'), value: humeurMoyenne ?? '—', title: t('journalPerso.stat.humeurTitre') },
          ]}
        />
      </motion.div>

      <motion.p variants={staggerItem} className="text-xs text-text-muted">{t('perso.local')}</motion.p>

      <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); garder(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <p className="eyebrow">{dateLongue(aujourdhui)}</p>
        <textarea value={valeur} onChange={(e) => setTexte(e.target.value)} rows={5} placeholder={t('journalPerso.champ')} aria-label={t('journalPerso.champ')} className="input-focus border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text-primary outline-none" />
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label={t('journalPerso.humeur')} className="flex gap-1">
            {HUMEURS.map((h) => (
              <button key={h} type="button" role="radio" aria-checked={duJour?.mood === h} aria-label={t('journalPerso.humeurNote', { n: h })} onClick={() => garder(h)} className={`tnum min-h-11 min-w-11 border text-sm ${duJour?.mood === h ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-muted hover:text-text-primary'}`}>{h}</button>
            ))}
          </div>
          <button type="submit" disabled={!valeur.trim()} className="ml-auto flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-2">{gardee ? <Check size={14} /> : null} {gardee ? t('journalPerso.gardee') : t('journalPerso.garder')}</button>
        </div>
      </motion.form>

      {pret && entrees.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('journalPerso.vide.titre')}>{t('journalPerso.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        passees.length > 0 && (
          <motion.section variants={staggerItem} aria-label={t('journalPerso.precedentes')} className="flex flex-col gap-3">
            <p className="eyebrow">{t('journalPerso.precedentes')}</p>
            {passees.map((e) => (
              <article key={e.day} className="group rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">{dateLongue(e.day)}{e.mood > 0 ? <span className="tnum ml-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('journalPerso.humeurNote', { n: e.mood })}</span> : null}</p>
                  <button type="button" onClick={() => retirer(e.day)} aria-label={t('journalPerso.supprimer')} title={t('journalPerso.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                </div>
                {e.text && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{e.text}</p>}
              </article>
            ))}
          </motion.section>
        )
      )}
    </motion.section>
  );
}
