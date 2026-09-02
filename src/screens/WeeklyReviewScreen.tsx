import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Question = 'avance' | 'bloque' | 'lache' | 'garde' | 'prochaine';
interface ReviewData {
  week: string;
  avance: string;
  bloque: string;
  lache: string;
  garde: string;
  prochaine: string;
  byEmail: string;
  updatedAt: string;
}
const QUESTIONS: Question[] = ['avance', 'bloque', 'lache', 'garde', 'prochaine'];
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function lundiDe(d: Date): string {
  const j = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  j.setDate(j.getDate() - ((j.getDay() + 6) % 7));
  return isoJour(j);
}
const VIDE: Record<Question, string> = { avance: '', bloque: '', lache: '', garde: '', prochaine: '' };

/**
 * LA REVUE HEBDO — cinq questions le vendredi.
 *
 * Pour qui : une petite équipe ou une indépendante qui enchaîne les semaines
 * sans jamais s'arrêter dessus. Ce que ça règle : une page par semaine, cinq
 * réponses courtes, gardées ensemble — la suivante commence plus nette. Une
 * seule revue par semaine et par organisation : c'est un rite d'équipe, pas
 * un journal intime (le Journal de bord et les Priorités sont là pour ça).
 */
export function WeeklyReviewScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const { user } = useAuth();
  const { upsert } = useSync();
  const brutes = useCollection<ReviewData>('weeklyReviews');
  const semaine = lundiDe(new Date());
  const courante = brutes.find((r) => r.week === semaine) ?? null;
  const [reponses, setReponses] = useState<Record<Question, string>>(VIDE);
  const [gardee, setGardee] = useState(false);

  useEffect(() => {
    if (courante) setReponses({ avance: courante.avance, bloque: courante.bloque, lache: courante.lache, garde: courante.garde, prochaine: courante.prochaine });
  }, [courante?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const passees = useMemo(() => brutes.filter((r) => r.week !== semaine).sort((a, b) => b.week.localeCompare(a.week)), [brutes, semaine]);
  const serie = useMemo(() => {
    let n = 0;
    const d = new Date();
    if (!courante) d.setDate(d.getDate() - 7);
    for (let k = 0; k < 104; k += 1) {
      if (!brutes.some((r) => r.week === lundiDe(d))) break;
      n += 1;
      d.setDate(d.getDate() - 7);
    }
    return n;
  }, [brutes, courante]);
  const remplie = QUESTIONS.some((q) => reponses[q].trim());
  const dateSemaine = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  const garder = async () => {
    if (!remplie) return;
    await upsert('weeklyReviews', `week-${semaine}`, { week: semaine, ...reponses, byEmail: user?.email ?? '', updatedAt: new Date().toISOString() });
    setGardee(true);
    window.setTimeout(() => setGardee(false), 2500);
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('revueHebdo.titre') })}
          title={t('revueHebdo.titre')}
          description={t('revueHebdo.description')}
          stats={[
            { label: t('revueHebdo.stat.cetteSemaine'), value: courante ? t('revueHebdo.faite') : t('revueHebdo.aFaire'), emphasis: !courante },
            { label: t('revueHebdo.stat.revues'), value: brutes.length },
            { label: t('revueHebdo.stat.serie'), value: serie },
          ]}
        />
      </motion.div>

      {brutes.length === 0 && (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('revueHebdo.vide.titre')}>{t('revueHebdo.vide.texte')}</FirstRun>
        </motion.div>
      )}

      <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void garder(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <p className="eyebrow">{t('revueHebdo.semaineDu', { date: dateSemaine(semaine) })}</p>
        {QUESTIONS.map((q) => (
          <label key={q} className="flex flex-col gap-1 text-sm text-text-primary">
            {t(`revueHebdo.q.${q}` as Parameters<typeof t>[0])}
            <textarea value={reponses[q]} onChange={(e) => setReponses((r) => ({ ...r, [q]: e.target.value }))} rows={2} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!remplie} className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-2">
            {gardee ? <Check size={14} /> : null} {gardee ? t('revueHebdo.enregistree') : t('revueHebdo.enregistrer')}
          </button>
          {courante && <span className="text-xs text-text-muted">{courante.byEmail.split('@')[0]}</span>}
        </div>
      </motion.form>

      {passees.length > 0 && (
        <motion.section variants={staggerItem} aria-label={t('revueHebdo.precedentes')} className="flex flex-col gap-3">
          <p className="eyebrow">{t('revueHebdo.precedentes')}</p>
          {passees.map((r) => (
            <article key={r.week} className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-2 text-sm font-semibold text-text-primary">{t('revueHebdo.semaineDu', { date: dateSemaine(r.week) })}</p>
              <dl className="grid gap-2 text-xs sm:grid-cols-2">
                {QUESTIONS.filter((q) => r[q].trim()).map((q) => (
                  <div key={q}>
                    <dt className="text-text-muted">{t(`revueHebdo.q.${q}` as Parameters<typeof t>[0])}</dt>
                    <dd className="whitespace-pre-wrap text-text-secondary">{r[q]}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </motion.section>
      )}
    </motion.section>
  );
}
