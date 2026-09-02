import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Plus, Vote } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface PollData {
  question: string;
  options: string[];
  votes: Record<string, number>;
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
  anonymous: boolean;
}

/**
 * LES SONDAGES — trancher à plusieurs sans réunion.
 *
 * Pour qui : un collectif ou une petite équipe qui décide d'une date, d'un
 * nom, d'un fournisseur. Ce que ça règle : la question posée trois fois
 * dans le fil et jamais tranchée. Un vote par personne (le serveur ne peut
 * pas le garantir, la clé de vote est l'adresse — c'est dit), des barres
 * qui se lisent d'un coup, et une clôture qui fige le résultat. Anonyme ou
 * nominatif : c'est celle qui pose la question qui choisit, avant le
 * premier vote.
 */
export function PollsScreen() {
  const { t } = useLangue();
  const { user, role } = useAuth();
  const { upsert, remove } = useSync();
  const { profileFor } = useProfiles();
  const brutes = useCollection<PollData>('polls');
  const [ouvert, setOuvert] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState('');
  const [anonyme, setAnonyme] = useState(false);

  const moi = user?.email ?? '';
  const sondages = useMemo(() => [...brutes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [brutes]);
  const ouverts = sondages.filter((s) => !s.closedAt);
  const aVoter = ouverts.filter((s) => s.votes?.[moi] === undefined).length;

  const creer = async () => {
    const choix = options.split('\n').map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || choix.length < 2 || !moi) return;
    await upsert('polls', uid('poll'), {
      question: question.trim(),
      options: choix,
      votes: {},
      createdBy: moi,
      createdAt: new Date().toISOString(),
      closedAt: null,
      anonymous: anonyme,
    });
    setQuestion('');
    setOptions('');
    setAnonyme(false);
    setOuvert(false);
  };
  const voter = (s: PollData & { id: string }, idx: number) => upsert('polls', s.id, { ...s, votes: { ...(s.votes ?? {}), [moi]: idx } });
  const clore = (s: PollData & { id: string }) => upsert('polls', s.id, { ...s, closedAt: new Date().toISOString() });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('collectif.surtitre', { module: t('sondages.titre') })}
          title={t('sondages.titre')}
          description={t('sondages.description')}
          stats={[
            { label: t('sondages.stat.aVoter'), value: aVoter, emphasis: aVoter > 0 },
            { label: t('sondages.stat.ouverts'), value: ouverts.length },
            { label: t('sondages.stat.total'), value: sondages.length },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} />
              {t('sondages.nouveau')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form
          variants={staggerItem}
          onSubmit={(e) => {
            e.preventDefault();
            void creer();
          }}
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
        >
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('sondages.champQuestion')} aria-label={t('sondages.champQuestion')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={options} onChange={(e) => setOptions(e.target.value)} placeholder={t('sondages.champOptions')} aria-label={t('sondages.champOptions')} rows={4} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={anonyme} onChange={(e) => setAnonyme(e.target.checked)} className="h-4 w-4" />
            {t('sondages.anonyme')}
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!question.trim() || options.split('\n').filter((o) => o.trim()).length < 2} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">
              {t('sondages.lancer')}
            </button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
              {t('chrome.fermer')}
            </button>
          </div>
        </motion.form>
      )}

      {sondages.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('sondages.vide.titre')} action={{ label: t('sondages.vide.action'), onClick: () => setOuvert(true) }}>
            {t('sondages.vide.texte')}
          </FirstRun>
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(20rem,1fr))]">
          {sondages.map((s) => {
            const votes = s.votes ?? {};
            const total = Object.keys(votes).length;
            const monVote = votes[moi];
            const clos = Boolean(s.closedAt);
            const peutClore = !clos && (s.createdBy === moi || isAdminRole(role));
            const comptes = s.options.map((_, i) => Object.values(votes).filter((v) => v === i).length);
            return (
              <li key={s.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-text-primary [overflow-wrap:anywhere]">{s.question}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {profileFor(s.createdBy).name} · {relativeTime(s.createdAt)} · {t('sondages.participants', { n: total })}
                      {s.anonymous && ` · ${t('sondages.anonymeCourt')}`}
                    </p>
                  </div>
                  {clos && (
                    <span className="flex flex-shrink-0 items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
                      <Lock size={10} /> {t('sondages.clos')}
                    </span>
                  )}
                </div>
                <ol className="flex flex-col gap-1.5">
                  {s.options.map((option, i) => {
                    const part = total > 0 ? Math.round((comptes[i] / total) * 100) : 0;
                    const choisi = monVote === i;
                    const votants = s.anonymous ? [] : Object.entries(votes).filter(([, v]) => v === i).map(([e]) => e);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          disabled={clos}
                          onClick={() => void voter(s, i)}
                          aria-pressed={choisi}
                          className={`relative flex min-h-11 w-full items-center justify-between gap-3 overflow-hidden rounded-lg border px-3 text-left text-sm transition-colors disabled:cursor-default ${choisi ? 'border-accent text-text-primary' : 'border-border text-text-secondary hover:border-border-strong'}`}
                        >
                          <span aria-hidden className="absolute inset-y-0 left-0 bg-accent-muted transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${part}%` }} />
                          <span className="relative flex min-w-0 items-center gap-2">
                            {choisi && <Vote size={13} className="flex-shrink-0 text-accent" />}
                            <span className="truncate">{option}</span>
                          </span>
                          <span className="relative flex flex-shrink-0 items-center gap-2">
                            {votants.slice(0, 4).map((e) => <UserAvatar key={e} email={e} size={18} />)}
                            <span className="tnum font-mono text-[11px] text-text-muted">{comptes[i]} · {part}%</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {(peutClore || s.createdBy === moi || isAdminRole(role)) && (
                  <div className="flex flex-wrap gap-2">
                    {peutClore && (
                      <button type="button" onClick={() => void clore(s)} className="border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">
                        {t('sondages.clore')}
                      </button>
                    )}
                    <button type="button" onClick={() => void remove('polls', s.id)} className="border border-border px-3 py-1.5 text-xs text-text-muted hover:text-danger">
                      {t('sondages.supprimer')}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </motion.ul>
      )}
    </motion.section>
  );
}
